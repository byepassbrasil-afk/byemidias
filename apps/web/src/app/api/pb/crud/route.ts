/**
 * /api/pb/crud
 * Endpoint genérico PB para listagem de coleções.
 * GET /api/pb/crud?table=organizations&order=name&asc=true&limit=10
 *
 * Diferente de /api/admin/crud/[table] que usa Postgres (que está fora).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

const ALLOWED_TABLES = [
  'organizations', 'units', 'campaigns', 'playlists', 'devices', 'media',
  'playlist_items', 'campaign_playlists', 'campaign_targets',
  'partner_access', 'partner_devices', 'profiles', 'activation_codes',
  'device_logs', 'playlist_slots', 'campaign_time_slots', 'campaign_calendar',
  'content_schedules', 'device_groups', 'device_group_members',
  'device_uptime_sessions', 'partner_payments', 'partner_invoices',
  'partner_media_uploads', 'playback_logs', 'keepalive_log', 'layout_templates',
  'categories', 'device_categories', 'media_categories', 'media_overrides',
  'category_history', 'category_history_sync_state', 'contract_templates',
  'partner_contracts', 'advertisers', 'advertiser_devices', 'advertiser_media',
  'advertiser_invoices', 'expenses', 'revenues', 'contact_leads',
];

// Colunas permitidas para ORDER BY
const ALLOWED_ORDER = new Set([
  'created', 'updated', 'name', 'status', 'last_heartbeat', 'model', 'id',
  'date', 'expires_at', 'position',
]);

// Tabelas que têm organization_id (auto-filtra para non-super_admin)
const TABLES_WITH_ORG = new Set([
  'organizations', 'devices', 'media', 'playlists', 'campaigns',
  'units', 'playlist_items', 'campaign_playlists', 'campaign_targets',
  'device_logs', 'playlist_slots', 'campaign_time_slots',
  'device_categories', 'media_categories', 'media_overrides',
  'device_uptime_sessions', 'device_groups', 'device_group_members',
  'campaign_calendar', 'content_schedules', 'layout_templates',
  'playback_logs', 'partner_devices', 'partner_payments',
  'partner_invoices', 'partner_media_uploads', 'activation_codes',
  'expenses', 'revenues',
]);

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica sessão
    const cookieStore = await (await import('next/headers')).cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ data: [] });
    }
    let session: any;
    try { session = JSON.parse(sessionCookie); } catch {
      return NextResponse.json({ data: [] });
    }
    if (!session?.email) {
      return NextResponse.json({ data: [] });
    }

    // 2. Pega user, profile, role
    const pb = await getAdminClient();
    let user;
    try {
      user = await pb.collection('users').getFirstListItem(`email = "${session.email}"`);
    } catch {
      return NextResponse.json({ data: [] });
    }
    let profile = null;
    try {
      profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
    } catch {}
    const isSuperAdmin = profile?.role === 'super_admin';
    const userOrgId = profile?.organization_id;

    // 3. Parse params
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const order = searchParams.get('order') || 'created';
    const ascending = searchParams.get('asc') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ data: [] });
    }

    // 4. Filtros
    const filterParts: string[] = [];
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('_') || ['table', 'limit', 'offset', 'order', 'asc'].includes(key)) continue;
      filterParts.push(`${key} = "${String(value).replace(/"/g, '\\"')}"`);
    }

    // 5. Auto-filtro por organization_id (gestor vê só sua org)
    if (!isSuperAdmin && userOrgId && TABLES_WITH_ORG.has(table) && !filterParts.some(f => f.startsWith('organization_id'))) {
      filterParts.push(`organization_id = "${userOrgId}"`);
    }
    // organizations: non-super_admin só vê a sua
    if (!isSuperAdmin && table === 'organizations' && !filterParts.some(f => f.startsWith('id'))) {
      filterParts.push(`id = "${userOrgId}"`);
    }

    const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';
    const safeOrder = ALLOWED_ORDER.has(order) ? order : 'created';
    const sortSign = ascending ? '' : '-';

    // 4. Query no PB
    const result = await pb.collection(table).getList(1, limit, {
      filter: filter || undefined,
      sort: `${sortSign}${safeOrder}`,
    });

    return NextResponse.json({ data: result.items });
  } catch (e: any) {
    console.error('[pb/crud GET] erro:', e?.message || e);
    return NextResponse.json({ data: [], error: e?.message });
  }
}
