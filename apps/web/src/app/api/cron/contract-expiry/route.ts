import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron job — runs daily at 02:00 UTC (configured in vercel.json).
 * - Marks expired contracts (status='active' AND end_date < NOW()) as 'expired'
 * - Notifies admin for contracts expiring in the next 30 days
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // 1. Mark expired contracts
    const expiredResult = await sql`
      UPDATE partner_contracts
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'active' AND end_date IS NOT NULL AND end_date < CURRENT_DATE
      RETURNING id, partner_id, organization_id, end_date
    `;

    // Notify admin for each expired contract
    for (const c of (expiredResult ?? []) as Array<{ id: string; organization_id: string; partner_id: string }>) {
      await sql`
        INSERT INTO notifications (organization_id, type, title, message)
        VALUES (
          ${c.organization_id},
          'contract_expired',
          'Contrato expirado',
          ${`Contrato #${c.id.slice(0, 8)} expirou. Renove manualmente se quiser continuar a parceria.`}
        )
      `;
    }

    // 2. Notify contracts expiring soon (next 30 days)
    const expiringSoon = await sql`
      SELECT pc.id, pc.organization_id, pc.end_date, pa.display_name
      FROM partner_contracts pc
      LEFT JOIN partner_access pa ON pa.id = pc.partner_id
      WHERE pc.status = 'active'
        AND pc.end_date IS NOT NULL
        AND pc.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'contract_expiring_soon'
            AND n.message LIKE '%' || pc.id::text || '%'
            AND n.created_at > NOW() - INTERVAL '7 days'
        )
    ` as Array<{ id: string; organization_id: string; end_date: string; display_name: string }>;

    for (const c of expiringSoon) {
      const days = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
      await sql`
        INSERT INTO notifications (organization_id, type, title, message)
        VALUES (
          ${c.organization_id},
          'contract_expiring_soon',
          'Contrato expira em breve',
          ${`Contrato #${c.id.slice(0, 8)} de ${c.display_name || 'parceiro'} expira em ${days} dias (${c.end_date}).`}
        )
      `;
    }

    return NextResponse.json({
      expired_marked: (expiredResult ?? []).length,
      expiring_notified: expiringSoon.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
