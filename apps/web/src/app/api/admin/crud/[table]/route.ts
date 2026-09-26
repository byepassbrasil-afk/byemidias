import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';
import { getAdminClient } from '@/lib/pb-server';

export const dynamic = 'force-dynamic';


const ALLOWED_TABLES = ['organizations', 'units', 'campaigns', 'playlists', 'devices', 'media', 'playlist_items', 'campaign_playlists', 'campaign_targets', 'partner_access', 'partner_devices', 'profiles', 'activation_codes', 'device_logs', 'playlist_slots', 'campaign_time_slots', 'campaign_calendar', 'content_schedules', 'device_groups', 'device_group_members', 'device_uptime_sessions', 'partner_payments', 'partner_invoices', 'partner_media_uploads', 'playback_logs', 'keepalive_log', 'layout_templates'];

const PROTECTED_FIELDS: Record<string, string[]> = {
  organizations: ['owner_id'],
};

function sanitizeTableName(table: string): string | null {
  if (!ALLOWED_TABLES.includes(table)) return null;
  return table.replace(/[^a-zA-Z0-9_]/g, '');
}

async function ensureDeviceSchema(pb: any) {
  const collection = await pb.collections.getOne('devices');
  const fields = [
    { name: 'content_version', type: 'number' },
    { name: 'screen_rotation', type: 'number' },
    { name: 'mirror_horizontal', type: 'bool' },
    { name: 'mirror_vertical', type: 'bool' },
    { name: 'video_volume', type: 'number' },
    { name: 'support_id', type: 'text' },
    { name: 'support_type', type: 'text' },
    { name: 'api_base_url', type: 'text' },
    { name: 'video_player', type: 'text' },
    { name: 'html_render', type: 'text' },
    { name: 'image_fit_mode', type: 'text' },
    { name: 'image_rotation_lock', type: 'number' },
    { name: 'auto_update', type: 'bool' },
    { name: 'low_mem_restart', type: 'bool' },
  ];
  const existingFields = collection.fields || collection.schema || [];
  const missing = fields.filter((f) => !existingFields.some((s: any) => s.name === f.name));
  if (missing.length > 0) await pb.collections.update('devices', { fields: [...existingFields, ...missing] });
}

async function ensurePartnerSchema(pb: any) {
  const collection = await pb.collections.getOne('partner_access');
  const fields = [
    { name: 'password_hash', type: 'text' },
    { name: 'status', type: 'text' },
  ];
  const existingFields = collection.fields || collection.schema || [];
  const missing = fields.filter((f) => !existingFields.some((s: any) => s.name === f.name));
  if (missing.length > 0) await pb.collections.update('partner_access', { fields: [...existingFields, ...missing] });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { table: rawTable } = await params;
    const table = sanitizeTableName(rawTable);
    if (!table) return NextResponse.json({ error: 'Tabela não permitida' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const orderByRaw = searchParams.get('order') || 'created_at';
    const ascending = searchParams.get('asc') !== 'false';
    const ALLOWED_ORDER_COLUMNS = new Set(['created_at', 'updated_at', 'name', 'status', 'last_heartbeat', 'model', 'id']);
    const orderBy = ALLOWED_ORDER_COLUMNS.has(orderByRaw) ? orderByRaw : 'created_at';

    if (table === 'devices' || table === 'campaigns') {
      const pb = await getAdminClient();
      const filters: string[] = [];
      if (user.role !== 'super_admin' && user.organization_id) {
        filters.push(`organization_id = "${user.organization_id.replace(/"/g, '\\"')}"`);
      }
      for (const [key, value] of searchParams.entries()) {
        if (key.startsWith('_') || ['limit', 'offset', 'order', 'asc', 'organization_id'].includes(key)) continue;
        filters.push(`${key} = "${value.replace(/"/g, '\\"')}"`);
      }
      const filter = filters.length > 0 ? filters.join(' && ') : undefined;
      const result = await pb.collection(table).getList(
        Math.floor(offset / limit) + 1,
        limit,
        { filter, sort: `${ascending ? '' : '-'}${orderBy}` },
      );
      return NextResponse.json({ data: result.items ?? [] });
    }

    const pocketbaseContentTables = ['playlists', 'media', 'playlist_items', 'playlist_slots', 'campaign_playlists'];
    if (pocketbaseContentTables.includes(table)) {
      const pb = await getAdminClient();
      const filters: string[] = [];
      if (user.role !== 'super_admin' && user.organization_id && (table === 'playlists' || table === 'media')) {
        filters.push(`organization_id = "${user.organization_id.replace(/"/g, '\\"')}"`);
      }
      for (const [key, value] of searchParams.entries()) {
        if (key.startsWith('_') || ['limit', 'offset', 'order', 'asc', 'organization_id'].includes(key)) continue;
        filters.push(`${key} = "${value.replace(/"/g, '\\"')}"`);
      }
      const filter = filters.length > 0 ? filters.join(' && ') : undefined;
      const result = await pb.collection(table).getList(
        Math.floor(offset / limit) + 1,
        limit,
        { filter, sort: `${ascending ? '' : '-'}${orderBy}` },
      );
      const data = (result.items ?? []).map((item: any) => table === 'media'
        ? { ...item, file_url: item.file_url || item.url || '' }
        : item);
      return NextResponse.json({ data });
    }

    const filters: string[] = [];
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('_') || ['limit', 'offset', 'order', 'asc'].includes(key)) continue;
      filters.push(`${key} = '${value.replace(/'/g, "''")}'`);
    }

    if (user.role !== 'super_admin') {
      if (table === 'organizations') {
        filters.push(`id = '${user.organization_id}'`);
      } else {
        const hasOrgCol = await sql.unsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'organization_id' LIMIT 1`);
        if (hasOrgCol.length > 0 && user.organization_id) {
          filters.push(`organization_id = '${user.organization_id?.replace(/'/g, "''")}'`);
        }
      }
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const data = await sql.unsafe(`SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} ${ascending ? 'ASC' : 'DESC'} LIMIT ${limit} OFFSET ${offset}`);

    return NextResponse.json({ data: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[admin/crud GET]:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { table: rawTable } = await params;
    const table = sanitizeTableName(rawTable);
    if (!table) return NextResponse.json({ error: 'Tabela não permitida' }, { status: 403 });

    const body = await request.json();
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'Dados obrigatórios' }, { status: 400 });
    }

    if (table === 'devices') {
      const pb = await getAdminClient();
      await ensureDeviceSchema(pb);
      const existing = await pb.collection('devices').getOne(body.id);
      if (user.role !== 'super_admin' && existing.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
      }

      const { id, organization_id, ...updates } = body;
      const row = await pb.collection('devices').update(id, {
        ...updates,
        content_version: updates.content_version || Date.now(),
      });
      return NextResponse.json({ data: row });
    }

    const pocketbaseContentTables = ['playlists', 'media', 'playlist_items', 'playlist_slots', 'campaign_playlists'];
    if (pocketbaseContentTables.includes(table)) {
      const pb = await getAdminClient();
      const data: any = { ...body };
      delete data.id;
      delete data.file_url;
      if (table === 'media' && body.file_url) data.url = body.file_url;
      if (table === 'playlist_slots' && data.duration_seconds !== undefined) {
        data.duration = data.duration_seconds;
        delete data.duration_seconds;
      }
      if (user.organization_id && !data.organization_id && (table === 'playlists' || table === 'media')) {
        data.organization_id = user.organization_id;
      }
      const row = await pb.collection(table).create(data);
      const contentOrgId = data.organization_id || (data.playlist_id
        ? (await pb.collection('playlists').getOne(data.playlist_id).catch(() => null))?.organization_id
        : null);
      if (contentOrgId) {
        const devices = await pb.collection('devices').getList(1, 200, { filter: `organization_id = "${contentOrgId}"` });
        for (const device of devices.items) {
          await pb.collection('devices').update(device.id, { content_version: Date.now() });
        }
      }
      return NextResponse.json({ data: row });
    }

    // Auto-inject organization_id if table has it and body doesn't include it
    if (user.organization_id && !body.organization_id) {
      const hasOrgCol = await sql.unsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'organization_id' LIMIT 1`);
      if (hasOrgCol.length > 0) {
        body.organization_id = user.organization_id;
      }
    }

    const columns = Object.keys(body);
    const values = Object.values(body);
    const placeholders = values.map((v, i) => `$${i + 1}`);

    const [row] = await sql.unsafe(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values as (string | number | boolean | null)[]
    );

    // Bump content_version when content-related tables are created
    const CONTENT_TABLES = ['playlists', 'playlist_items', 'playlist_slots', 'campaigns', 'campaign_playlists', 'campaign_time_slots', 'campaign_targets', 'media', 'layout_templates'];
    if (CONTENT_TABLES.includes(table) && user.organization_id) {
      bumpContentVersion(user.organization_id).catch(() => {});
    }

    return NextResponse.json({ data: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { table: rawTable } = await params;
    const table = sanitizeTableName(rawTable);
    if (!table) return NextResponse.json({ error: 'Tabela não permitida' }, { status: 403 });

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const protectedFields = PROTECTED_FIELDS[table] || [];
    if (user.role !== 'super_admin') {
      for (const field of protectedFields) {
        if (field in updates) {
          delete updates[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    if (table === 'devices') {
      const pb = await getAdminClient();
      await ensureDeviceSchema(pb);
      const existing = await pb.collection('devices').getOne(id);
      if (user.role !== 'super_admin' && existing.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
      }
      const data: any = { ...updates };
      if (data.content_version === undefined) data.content_version = Date.now();
      const row = await pb.collection('devices').update(id, data);
      return NextResponse.json({ data: row });
    }

    const pocketbaseContentTables = ['playlists', 'media', 'playlist_items', 'playlist_slots', 'campaign_playlists'];
    if (pocketbaseContentTables.includes(table)) {
      const pb = await getAdminClient();
      const data: any = { ...updates };
      delete data.file_url;
      if (table === 'media' && updates.file_url) data.url = updates.file_url;
      if (table === 'playlist_slots' && data.duration_seconds !== undefined) {
        data.duration = data.duration_seconds;
        delete data.duration_seconds;
      }
      const existing = await pb.collection(table).getOne(id);
      const row = await pb.collection(table).update(id, data);
      const contentOrgId = data.organization_id || existing.organization_id || (data.playlist_id || existing.playlist_id
        ? (await pb.collection('playlists').getOne(data.playlist_id || existing.playlist_id).catch(() => null))?.organization_id
        : null);
      if (contentOrgId) {
        const devices = await pb.collection('devices').getList(1, 200, { filter: `organization_id = "${contentOrgId}"` });
        for (const device of devices.items) {
          await pb.collection('devices').update(device.id, { content_version: Date.now() });
        }
      }
      return NextResponse.json({ data: row });
    }

    if (table === 'organizations' && user.role !== 'super_admin') {
      const [org] = await sql`SELECT owner_id FROM organizations WHERE id = ${id}`;
      if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
      if (org.owner_id !== user.id) return NextResponse.json({ error: 'Apenas o proprietário pode editar esta organização' }, { status: 403 });
    }

    let whereClause = `WHERE id = $${Object.values(updates).length + 1}`;
    const queryValues: (string | number | boolean | null)[] = [...Object.values(updates), id];

    if (user.role !== 'super_admin' && table !== 'organizations') {
      const hasOrgCol = await sql.unsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'organization_id' LIMIT 1`);
      if (hasOrgCol.length > 0 && user.organization_id) {
        whereClause += ` AND organization_id = $${queryValues.length + 1}`;
        queryValues.push(user.organization_id);
      }
    }

    const setClauses = Object.entries(updates).map(([key, value], i) => `${key} = $${i + 1}`);

    const [row] = await sql.unsafe(
      `UPDATE ${table} SET ${setClauses.join(', ')} ${whereClause} RETURNING *`,
      queryValues
    );

    // Bump content_version when content-related tables change
    const CONTENT_TABLES = ['playlists', 'playlist_items', 'playlist_slots', 'campaigns', 'campaign_playlists', 'campaign_time_slots', 'campaign_targets', 'media', 'layout_templates'];
    if (CONTENT_TABLES.includes(table) && user.organization_id) {
      bumpContentVersion(user.organization_id).catch(() => {});
    }

    console.log('[admin/crud PUT]', id, 'updates=' + JSON.stringify(updates), 'row=' + JSON.stringify(row));
    return NextResponse.json({ data: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[admin/crud PUT] ERROR:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { table: rawTable } = await params;
    const table = sanitizeTableName(rawTable);
    if (!table) return NextResponse.json({ error: 'Tabela não permitida' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const pocketbaseContentTables = ['playlists', 'media', 'playlist_items', 'playlist_slots', 'campaign_playlists'];
    if (pocketbaseContentTables.includes(table)) {
      const pb = await getAdminClient();
      const existing = await pb.collection(table).getOne(id);
      if (user.role !== 'super_admin' && existing.organization_id && existing.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
      await pb.collection(table).delete(id);
      const contentOrgId = existing.organization_id || (existing.playlist_id
        ? (await pb.collection('playlists').getOne(existing.playlist_id).catch(() => null))?.organization_id
        : null);
      if (contentOrgId) {
        const devices = await pb.collection('devices').getList(1, 200, { filter: `organization_id = "${contentOrgId}"` });
        for (const device of devices.items) {
          await pb.collection('devices').update(device.id, { content_version: Date.now() });
        }
      }
      return NextResponse.json({ success: true });
    }

    if (table === 'organizations' && user.role !== 'super_admin') {
      const [org] = await sql`SELECT owner_id FROM organizations WHERE id = ${id}`;
      if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
      if (org.owner_id !== user.id) return NextResponse.json({ error: 'Apenas o proprietário pode excluir esta organização' }, { status: 403 });
    }

    // Special handling: clean FKs BEFORE any DELETE attempt
    if (table === 'profiles') {
      await deleteProfile(id, user);
      return NextResponse.json({ success: true });
    }
    if (table === 'devices') {
      await deleteDevice(id);
      return NextResponse.json({ success: true });
    }
    if (table === 'media') {
      await sql`DELETE FROM playback_logs WHERE media_id = ${id}`;
      await sql`DELETE FROM partner_media_uploads WHERE media_id = ${id}`;
    }
    if (table === 'campaigns') {
      // Limpa FKs antes de excluir a campanha
      await sql`DELETE FROM playback_logs WHERE campaign_id = ${id}`;
      await sql`DELETE FROM campaign_playlists WHERE campaign_id = ${id}`;
      await sql`DELETE FROM campaign_targets WHERE campaign_id = ${id}`;
      await sql`DELETE FROM campaign_time_slots WHERE campaign_id = ${id}`;
      await sql`DELETE FROM campaign_calendar WHERE campaign_id = ${id}`;
      await sql`DELETE FROM revenues WHERE campaign_id = ${id}`;
      await sql`UPDATE devices SET campaign_id = NULL WHERE campaign_id = ${id}`;
      await sql`UPDATE device_logs SET campaign_id = NULL WHERE campaign_id = ${id}`;
    }
    if (table === 'playlists') {
      await sql`UPDATE devices SET campaign_id = NULL WHERE campaign_id IN (SELECT campaign_id FROM campaign_playlists WHERE playlist_id = ${id})`;
      await sql`DELETE FROM campaign_playlists WHERE playlist_id = ${id}`;
      await sql`DELETE FROM campaign_time_slots WHERE playlist_id = ${id}`;
      await sql`DELETE FROM playlist_items WHERE playlist_id = ${id}`;
      await sql`DELETE FROM playlist_slots WHERE playlist_id = ${id}`;
    }
    if (table === 'devices') {
      await sql`DELETE FROM advertiser_devices WHERE device_id = ${id}`;
      await sql`DELETE FROM device_categories WHERE device_id = ${id}`;
      await sql`DELETE FROM device_overrides WHERE device_id = ${id}`;
      await sql`DELETE FROM device_logs WHERE device_id = ${id}`;
      await sql`DELETE FROM device_uptime_sessions WHERE device_id = ${id}`;
      await sql`DELETE FROM partner_devices WHERE device_id = ${id}`;
      await sql`DELETE FROM playback_logs WHERE device_id = ${id}`;
    }
    if (table === 'organizations') {
      await sql`DELETE FROM organization_admins WHERE organization_id = ${id}`;
      await sql`DELETE FROM campaign_targets WHERE organization_id = ${id}`;
      await sql`UPDATE profiles SET organization_id = NULL WHERE organization_id = ${id}`;
    }

    if (user.role !== 'super_admin' && table !== 'organizations') {
      const hasOrgCol = await sql.unsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'organization_id' LIMIT 1`);
      if (hasOrgCol.length > 0 && user.organization_id) {
        await sql.unsafe(`DELETE FROM ${table} WHERE id = $1 AND organization_id = $2`, [id, user.organization_id]);
        // Bump content_version when content-related tables are deleted
        const CONTENT_TABLES = ['playlists', 'playlist_items', 'playlist_slots', 'campaigns', 'campaign_playlists', 'campaign_time_slots', 'campaign_targets', 'media', 'layout_templates'];
        if (CONTENT_TABLES.includes(table)) {
          bumpContentVersion(user.organization_id).catch(() => {});
        }
        return NextResponse.json({ success: true });
      }
      // Table has no organization_id column or no org set — delete without org filter
      if (hasOrgCol.length === 0) {
        await sql.unsafe(`DELETE FROM ${table} WHERE id = $1`, [id]);
        return NextResponse.json({ success: true });
      }
      // hasOrgCol > 0 but no user.organization_id — treat as super_admin path
    }

    await sql.unsafe(`DELETE FROM ${table} WHERE id = $1`, [id]);

    // Bump content_version when content-related tables are deleted (super_admin path)
    const CONTENT_TABLES = ['playlists', 'playlist_items', 'playlist_slots', 'campaigns', 'campaign_playlists', 'campaign_time_slots', 'campaign_targets', 'media', 'layout_templates'];
    if (CONTENT_TABLES.includes(table) && user.organization_id) {
      bumpContentVersion(user.organization_id).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Handle profile deletion with FK cleanup
async function deleteProfile(id: string, user: { role: string }) {
  // Clean FK references first
  await sql`UPDATE organizations SET owner_id = NULL WHERE owner_id = ${id}`;
  await sql`DELETE FROM push_subscriptions WHERE user_id = ${id}`;
  // Now safe to delete
  await sql`DELETE FROM profiles WHERE id = ${id}`;
}

// Handle device deletion with FK cleanup
async function deleteDevice(id: string) {
  // Clean all FK references to devices before deleting.
  // To add new FK, just add another DELETE line below.
  await sql`UPDATE activation_codes SET linked_device_id = NULL WHERE linked_device_id = ${id}`;
  await sql`DELETE FROM partner_devices WHERE device_id = ${id}`;
  await sql`DELETE FROM device_logs WHERE device_id = ${id}`;
  await sql`DELETE FROM playback_logs WHERE device_id = ${id}`;
  await sql`DELETE FROM device_uptime_sessions WHERE device_id = ${id}`;
  await sql`DELETE FROM device_group_members WHERE device_id = ${id}`;
  await sql`DELETE FROM campaign_calendar WHERE device_id = ${id}`;
  // Now safe to delete the device
  await sql`DELETE FROM devices WHERE id = ${id}`;
}
