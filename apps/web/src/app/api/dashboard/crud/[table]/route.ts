import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import sql, { bumpContentVersion } from '@/lib/db';

// Generic CRUD for org managers (mirrors /api/admin/crud)
const VALID_TABLES = new Set([
  'organizations', 'devices', 'campaigns', 'playlists', 'media',
  'partners', 'partner_access', 'partner_devices', 'partner_contracts',
  'partner_media_uploads', 'device_groups', 'units',
  'contract_templates', 'expenses', 'revenues', 'notifications',
  'invoices', 'partner_payments'
]);

const PROTECTED_FIELDS: Record<string, string[]> = {
  devices: ['organization_id', 'created_at', 'content_version'],
  campaigns: ['organization_id', 'created_at'],
  playlists: ['organization_id', 'created_at'],
  media: ['organization_id', 'created_at'],
  organizations: ['owner_id', 'primary_color', 'created_at', 'subscription_status'],
  partner_access: ['organization_id', 'created_at'],
  partner_contracts: ['organization_id', 'created_at'],
  contract_templates: ['organization_id', 'created_at'],
  expenses: ['organization_id', 'created_at'],
  revenues: ['organization_id', 'created_at'],
  invoices: ['organization_id', 'created_at'],
  partner_payments: ['organization_id', 'created_at'],
};

function sanitizeTableName(name: string): string | null {
  return VALID_TABLES.has(name) ? name : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { table: rawTable } = await params;
    const table = sanitizeTableName(rawTable);
    if (!table) return NextResponse.json({ error: 'Tabela não permitida' }, { status: 403 });

    const body = await request.json();
    const protectedFields = PROTECTED_FIELDS[table] || [];
    const cleanedBody: Record<string, unknown> = { ...body };
    if (user.role !== 'super_admin') {
      for (const field of protectedFields) {
        if (field in cleanedBody) delete cleanedBody[field];
      }
    }

    // Auto-inject organization_id for org-restricted tables
    const orgRestricted = ['devices', 'campaigns', 'playlists', 'media', 'partner_access', 'partner_devices', 'partner_contracts', 'partner_media_uploads', 'device_groups', 'units', 'contract_templates', 'expenses', 'revenues', 'invoices', 'partner_payments'];
    if (orgRestricted.includes(table) && user.role !== 'super_admin' && user.organization_id) {
      if (!('organization_id' in cleanedBody)) {
        cleanedBody.organization_id = user.organization_id;
      }
    }

    const columns = Object.keys(cleanedBody);
    if (columns.length === 0) return NextResponse.json({ error: 'Nenhum campo para inserir' }, { status: 400 });

    const values = columns.map((col) => cleanedBody[col] ?? null);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const valuesTyped = values as (string | number | boolean | null)[];

    const [row] = await sql.unsafe(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      valuesTyped
    );

    const CONTENT_TABLES = ['playlists', 'playlist_items', 'playlist_slots', 'campaigns', 'campaign_playlists', 'campaign_time_slots', 'campaign_targets', 'media', 'layout_templates', 'devices'];
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
        if (field in updates) delete updates[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    let whereClause = `WHERE id = $${Object.values(updates).length + 1}`;
    const queryValues: (string | number | boolean | null)[] = [...Object.values(updates), id];

    if (user.role !== 'super_admin') {
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

    const CONTENT_TABLES = ['playlists', 'playlist_items', 'playlist_slots', 'campaigns', 'campaign_playlists', 'campaign_time_slots', 'campaign_targets', 'media', 'layout_templates', 'devices'];
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

    if (user.role !== 'super_admin') {
      const [own] = await sql.unsafe(`SELECT organization_id FROM ${table} WHERE id = $1`, [id]);
      if (!own || own.organization_id !== user.organization_id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
    }

    const [row] = await sql.unsafe(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    return NextResponse.json({ data: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const user = await requireAuthApi();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { table: rawTable } = await params;
    const table = sanitizeTableName(rawTable);
    if (!table) return NextResponse.json({ error: 'Tabela não permitida' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const order = searchParams.get('order') || 'created_at';
    const asc = searchParams.get('asc') === 'true';
    const id = searchParams.get('id');
    const orgId = searchParams.get('organization_id');

    let query;
    const isOrgScoped = ['devices', 'campaigns', 'playlists', 'media', 'partner_access', 'partner_devices', 'partner_contracts', 'partner_media_uploads', 'device_groups', 'units', 'contract_templates', 'expenses', 'revenues', 'invoices', 'partner_payments'].includes(table);

    if (user.role === 'super_admin') {
      if (id) {
        query = sql.unsafe(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
      } else if (orgId) {
        query = sql.unsafe(`SELECT * FROM ${table} WHERE organization_id = $1 ORDER BY ${order} ${asc ? 'ASC' : 'DESC'}`, [orgId]);
      } else if (isOrgScoped) {
        query = sql.unsafe(`SELECT * FROM ${table} ORDER BY ${order} ${asc ? 'ASC' : 'DESC'}`);
      } else {
        query = sql.unsafe(`SELECT * FROM ${table} ORDER BY ${order} ${asc ? 'ASC' : 'DESC'}`);
      }
    } else {
      if (!user.organization_id) {
        return NextResponse.json({ data: [] });
      }
      if (isOrgScoped) {
        const targetOrgId = orgId || user.organization_id;
        if (id) {
          query = sql.unsafe(`SELECT * FROM ${table} WHERE id = $1 AND organization_id = $2 LIMIT 1`, [id, targetOrgId]);
        } else {
          query = sql.unsafe(`SELECT * FROM ${table} WHERE organization_id = $1 ORDER BY ${order} ${asc ? 'ASC' : 'DESC'}`, [targetOrgId]);
        }
      } else {
        query = sql.unsafe(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id || 'null']);
      }
    }

    const data = await query;
    return NextResponse.json({ data: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
