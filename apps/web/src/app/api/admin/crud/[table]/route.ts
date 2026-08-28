import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';

const ALLOWED_TABLES = ['organizations', 'units', 'campaigns', 'playlists', 'devices', 'media', 'playlist_items', 'campaign_playlists', 'campaign_targets', 'partner_access', 'partner_devices', 'profiles', 'activation_codes', 'device_logs', 'playlist_slots', 'campaign_time_slots', 'campaign_calendar', 'content_schedules', 'device_groups', 'device_group_members', 'device_uptime_sessions', 'partner_payments', 'partner_invoices', 'partner_media_uploads', 'playback_logs', 'keepalive_log', 'layout_templates'];

const PROTECTED_FIELDS: Record<string, string[]> = {
  organizations: ['owner_id'],
};

function sanitizeTableName(table: string): string | null {
  if (!ALLOWED_TABLES.includes(table)) return null;
  return table.replace(/[^a-zA-Z0-9_]/g, '');
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
    const orderBy = searchParams.get('order') || 'created_at';
    const ascending = searchParams.get('asc') !== 'false';

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
          filters.push(`organization_id = '${user.organization_id}'`);
        }
      }
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const data = await sql.unsafe(`SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} ${ascending ? 'ASC' : 'DESC'} LIMIT ${limit} OFFSET ${offset}`);

    return NextResponse.json({ data: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
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

    return NextResponse.json({ data: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
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

    if (table === 'organizations' && user.role !== 'super_admin') {
      const [org] = await sql`SELECT owner_id FROM organizations WHERE id = ${id}`;
      if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
      if (org.owner_id !== user.id) return NextResponse.json({ error: 'Apenas o proprietário pode excluir esta organização' }, { status: 403 });
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

    // Special handling for profiles: clean FKs first
    if (table === 'profiles') {
      await deleteProfile(id, user);
      return NextResponse.json({ success: true });
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
