/**
 * Endpoint genérico para ler dados do PocketBase.
 * Substitui /api/admin/crud/[table] para casos simples de GET.
 *
 * Formato: /api/pb/crud?table=organizations&order=name&asc=true
 *
 * Aplica automaticamente filtro por organization_id (exceto super_admin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

// Tabelas permitidas (whitelist)
const ALLOWED_TABLES = [
  'organizations',
  'units',
  'campaigns',
  'playlists',
  'devices',
  'media',
  'playlist_items',
  'campaign_playlists',
  'campaign_targets',
  'partner_access',
  'partner_devices',
  'profiles',
  'activation_codes',
  'device_logs',
  'playlist_slots',
  'campaign_time_slots',
  'campaign_calendar',
  'content_schedules',
  'device_groups',
  'device_group_members',
  'device_uptime_sessions',
  'partner_payments',
  'partner_invoices',
  'partner_media_uploads',
  'playback_logs',
  'keepalive_log',
  'layout_templates',
  'categories',
  'device_categories',
  'media_categories',
  'media_overrides',
  'category_history',
  'category_history_sync_state',
];

const ALLOWED_ORDER = new Set([
  'created', 'updated', 'name', 'status', 'last_heartbeat', 'model', 'id',
  'date', 'expires_at', 'position', 'expires',
  'order', 'start_date', 'end_date', 'sort',
]);

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await (await import('next/headers')).cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ data: [], unauthorized: true }, { status: 200 });
    }
    let session: any;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ data: [], unauthorized: true }, { status: 200 });
    }
    if (!session?.email) {
      return NextResponse.json({ data: [], unauthorized: true }, { status: 200 });
    }

    const pb = await getAdminClient();

    // Pega user para checar role e org
    const user = await pb.collection('users').getFirstListItem(`email = "${session.email}"`);
    let userProfile = null;
    try {
      userProfile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
    } catch {}
    const isSuperAdmin = userProfile?.role === 'super_admin';
    const userOrgId = userProfile?.organization_id;

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const order = searchParams.get('order') || 'created';
    const ascending = searchParams.get('asc') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ data: [] });
    }

    // Filtros
    const filterParts: string[] = [];
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('_') || ['table', 'limit', 'offset', 'order', 'asc'].includes(key)) continue;
      // Escapa aspas
      filterParts.push(`${key} = "${String(value).replace(/"/g, '\\"')}"`);
    }

    // Auto-filtro por organization_id (se a tabela tem esse campo e não for super_admin)
    const tablesWithOrg = [
      'organizations', 'devices', 'media', 'playlists', 'campaigns',
      'units', 'playlist_items', 'campaign_playlists', 'campaign_targets',
      'device_logs', 'playlist_slots', 'campaign_time_slots',
      'device_categories', 'media_categories', 'media_overrides',
      'device_uptime_sessions', 'device_groups', 'device_group_members',
      'campaign_calendar', 'content_schedules', 'layout_templates',
      'playback_logs', 'partner_devices', 'partner_payments',
      'partner_invoices', 'partner_media_uploads', 'activation_codes',
    ];
    if (!isSuperAdmin && userOrgId && tablesWithOrg.includes(table) && !filterParts.some(f => f.startsWith('organization_id'))) {
      filterParts.push(`organization_id = "${userOrgId}"`);
    }

    // Partner
    if (table === 'partner_access' && !isSuperAdmin) {
      filterParts.push(`organization_id = "${userOrgId}"`);
    }

    const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';
    const sort = ALLOWED_ORDER.has(order) ? order : 'created';
    const sortSign = ascending ? '' : '-';

    const result = await pb.collection(table).getList(1, limit, {
      filter,
      sort: `${sortSign}${sort}`,
    });

    return NextResponse.json({ data: result.items });
  } catch (e: any) {
    console.error('[pb/crud GET] erro:', e);
    return NextResponse.json({ data: [], error: e.message }, { status: 200 });
  }
}
