/**
 * /api/pb/crud
 * Endpoint genérico PB para CRUD em qualquer collection.
 * GET    /api/pb/crud?table=X&order=Y&asc=true&limit=10
 * POST   /api/pb/crud?table=X   body: {...campos}
 * PUT    /api/pb/crud?table=X   body: {id, ...campos}
 * DELETE /api/pb/crud?table=X   body: {id}  ou  ?id=X
 *
 * Substitui o /api/admin/crud/[table]/route.ts original que usava Postgres.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


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

const ALLOWED_ORDER = new Set([
  'id', '-id', 'name', 'status', 'last_heartbeat', 'model',
  'date', 'expires_at', 'position', 'expires', 'start_date', 'end_date',
  'email', 'role', 'full_name', 'user_id', 'organization_id',
]);

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

async function getAuthAndScope() {
  const cookieStore = await (await import('next/headers')).cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return { error: 'Não autenticado', status: 401 };
  let session: any;
  try { session = JSON.parse(sessionCookie); } catch { return { error: 'Sessão inválida', status: 401 }; }
  if (!session?.email) return { error: 'Não autenticado', status: 401 };

  const pb = await getAdminClient();
  const user = await pb.collection('users').getFirstListItem(`email = "${session.email}"`);
  let profile = null;
  try { profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`); } catch {}
  if (!profile) return { error: 'Profile não encontrado', status: 403 };

  return {
    pb,
    isSuperAdmin: profile.role === 'super_admin',
    userOrgId: profile.organization_id,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthAndScope();
    if (auth.error) return NextResponse.json({ data: [] }, { status: auth.status });
    const { pb, isSuperAdmin, userOrgId } = auth;

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ data: [] });
    }
    const order = searchParams.get('order') || 'id';
    const ascending = searchParams.get('asc') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);

    console.log('[pb/crud GET] raw URL:', request.url);
    console.log('[pb/crud GET] all params:', Array.from(searchParams.entries()));

    const filterParts: string[] = [];
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('_') || ['table', 'limit', 'offset', 'order', 'asc'].includes(key)) continue;
      filterParts.push(`${key} = "${String(value).replace(/"/g, '\\"')}"`);
    }
    if (!isSuperAdmin && userOrgId) {
      if (table === 'organizations') {
        // Para organizations, usar id (que é único)
        if (!filterParts.some(f => f.startsWith('id'))) {
          filterParts.push(`id = "${userOrgId}"`);
        }
      } else if (!filterParts.some(f => f.startsWith('organization_id'))) {
        // Verifica se a collection tem o campo organization_id antes de filtrar
        try {
          const collection = await pb.collections.getOne(table);
          const hasOrgField = collection.fields?.some((f: any) => f.name === 'organization_id');
          if (hasOrgField) {
            filterParts.push(`organization_id = "${userOrgId}"`);
          }
        } catch (e) {
          // Se não conseguir verificar, tenta filtrar mesmo assim
          filterParts.push(`organization_id = "${userOrgId}"`);
        }
      }
    }
    const filter = filterParts.length > 0 ? filterParts.join(' && ') : '';
    const safeOrder = ALLOWED_ORDER.has(order) ? order : 'id';
    const sortSign = ascending ? '' : '-';
    const opts: any = { perPage: limit };
    if (filter) opts.filter = filter;
    if (safeOrder) opts.sort = `${sortSign}${safeOrder}`;

    console.log('[pb/crud GET]', { table, filter, sort: opts.sort, isSuperAdmin, userOrgId, hasOrgFilter: TABLES_WITH_ORG.has(table) });

    const result = await pb.collection(table).getList(1, limit, opts);
    return NextResponse.json({ data: result.items });
  } catch (e: any) {
    console.error('[pb/crud GET] erro:', e?.message);
    console.error('[pb/crud GET] stack:', e?.stack?.slice(0, 500));
    if (e?.data) console.error('[pb/crud GET] data:', JSON.stringify(e.data).slice(0, 500));
    if (e?.status) console.error('[pb/crud GET] status:', e.status);
    return NextResponse.json({ data: [], error: e?.message });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthAndScope();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { pb, isSuperAdmin, userOrgId } = auth;

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Tabela não permitida' }, { status: 400 });
    }

    const body = await request.json();

    // Auto-inject organization_id se tabela tem esse campo e body não tem
    if (TABLES_WITH_ORG.has(table) && !body.organization_id && userOrgId && !isSuperAdmin) {
      body.organization_id = userOrgId;
    }

    const result = await pb.collection(table).create(body);
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error('[pb/crud POST] erro:', e?.message);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthAndScope();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { pb } = auth;

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Tabela não permitida' }, { status: 400 });
    }

    const body = await request.json();
    const id = body.id;
    if (!id) {
      // Tenta pegar id da query string
      const idFromQuery = searchParams.get('id');
      if (!idFromQuery) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
      delete body.id;
      const result = await pb.collection(table).update(idFromQuery, body);
      return NextResponse.json({ data: result });
    }
    delete body.id;
    const result = await pb.collection(table).update(id, body);
    return NextResponse.json({ data: result });
  } catch (e: any) {
    console.error('[pb/crud PUT] erro:', e?.message);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthAndScope();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { pb } = auth;

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Tabela não permitida' }, { status: 400 });
    }
    const id = searchParams.get('id') || (await request.json().catch(() => ({}))).id;
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    await pb.collection(table).delete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[pb/crud DELETE] erro:', e?.message);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
