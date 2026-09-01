import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql from '@/lib/db';

// DELETE /api/admin/organizations/[id] — CASCADE delete org + all related data
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthApi();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  if (!['super_admin', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const [org] = await sql`SELECT id, name FROM organizations WHERE id = ${id} LIMIT 1`;
    if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });

    if (user.role !== 'super_admin') {
      const [own] = await sql`SELECT owner_id FROM organizations WHERE id = ${id}`;
      if (!own || own.owner_id !== user.id) {
        return NextResponse.json({ error: 'Apenas o proprietário pode excluir esta organização' }, { status: 403 });
      }
    }

    // 1. Clear org as owner of other orgs (nullable)
    await sql`UPDATE organizations SET owner_id = NULL WHERE owner_id = ${id}`;

    // 2. Delete profiles + related user data
    await sql`DELETE FROM push_subscriptions WHERE user_id IN (SELECT id FROM profiles WHERE organization_id = ${id})`;

    // 3. Devices-related: clean FKs before deleting devices
    await sql`DELETE FROM device_uptime_sessions WHERE device_id IN (SELECT id FROM devices WHERE organization_id = ${id})`;
    await sql`DELETE FROM device_logs WHERE device_id IN (SELECT id FROM devices WHERE organization_id = ${id})`;
    await sql`DELETE FROM playback_logs WHERE device_id IN (SELECT id FROM devices WHERE organization_id = ${id})`;
    await sql`DELETE FROM activation_codes WHERE linked_device_id IN (SELECT id FROM devices WHERE organization_id = ${id})`;
    await sql`UPDATE activation_codes SET organization_id = NULL WHERE organization_id = ${id}`;

    // 4. Partner data (FKs to devices too)
    await sql`DELETE FROM partner_devices WHERE device_id IN (SELECT id FROM devices WHERE organization_id = ${id})`;
    await sql`DELETE FROM partner_media_uploads WHERE organization_id = ${id}`;
    await sql`DELETE FROM partner_payments WHERE organization_id = ${id}`;
    await sql`DELETE FROM partner_invoices WHERE organization_id = ${id}`;
    await sql`DELETE FROM partner_notifications WHERE organization_id = ${id}`;

    // 5. Contract data
    await sql`DELETE FROM partner_contracts WHERE organization_id = ${id}`;
    await sql`UPDATE partner_contracts SET template_id = NULL WHERE template_id IN (SELECT id FROM contract_templates WHERE organization_id = ${id})`;
    await sql`DELETE FROM contract_templates WHERE organization_id = ${id}`;

    // 6. Playlists: delete playback_logs and playlist_items FIRST (FKs to playlists)
    await sql`DELETE FROM playback_logs WHERE playlist_id IN (SELECT id FROM playlists WHERE organization_id = ${id})`;
    await sql`DELETE FROM playlist_items WHERE playlist_id IN (SELECT id FROM playlists WHERE organization_id = ${id})`;
    await sql`DELETE FROM playlist_slots WHERE playlist_id IN (SELECT id FROM playlists WHERE organization_id = ${id})`;
    await sql`DELETE FROM playlists WHERE organization_id = ${id}`;

    // 7. Campaigns: clear playback_logs (campaign FK) before deleting campaigns
    await sql`DELETE FROM playback_logs WHERE campaign_id IN (SELECT id FROM campaigns WHERE organization_id = ${id})`;
    await sql`DELETE FROM campaign_calendar WHERE organization_id = ${id}`;
    await sql`DELETE FROM campaign_time_slots WHERE campaign_id IN (SELECT id FROM campaigns WHERE organization_id = ${id})`;
    await sql`DELETE FROM campaign_targets WHERE campaign_id IN (SELECT id FROM campaigns WHERE organization_id = ${id})`;
    await sql`DELETE FROM campaign_playlists WHERE campaign_id IN (SELECT id FROM campaigns WHERE organization_id = ${id})`;
    await sql`DELETE FROM campaigns WHERE organization_id = ${id}`;

    // 8. Devices (after all device-related FKs cleared)
    await sql`DELETE FROM device_group_members WHERE device_id IN (SELECT id FROM devices WHERE organization_id = ${id})`;
    await sql`UPDATE device_groups SET organization_id = NULL WHERE organization_id = ${id}`;
    await sql`DELETE FROM devices WHERE organization_id = ${id}`;

    // 9. Units, device_groups, media, schedules, templates
    await sql`DELETE FROM units WHERE organization_id = ${id}`;
    await sql`DELETE FROM device_groups WHERE organization_id = ${id}`;
    await sql`DELETE FROM media WHERE organization_id = ${id}`;
    await sql`DELETE FROM content_schedules WHERE organization_id = ${id}`;
    await sql`DELETE FROM layout_templates WHERE organization_id = ${id}`;
    // keepalive_log has no organization_id column
    await sql`DELETE FROM keepalive_log`;

    // 10. Financial and notifications
    await sql`DELETE FROM notifications WHERE organization_id = ${id}`;
    await sql`DELETE FROM contact_leads WHERE organization_id = ${id}`;
    await sql`DELETE FROM expenses WHERE organization_id = ${id}`;
    await sql`DELETE FROM revenues WHERE organization_id = ${id}`;

    // 11. Users and partners
    await sql`DELETE FROM profiles WHERE organization_id = ${id}`;
    await sql`DELETE FROM partner_access WHERE organization_id = ${id}`;

    // 12. Finally, the org itself
    await sql`DELETE FROM organizations WHERE id = ${id}`;

    return NextResponse.json({ success: true, deleted: org.name });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('Delete org error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
