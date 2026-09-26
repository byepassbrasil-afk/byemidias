import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getAdminClient } from '@/lib/pb-server';

const SECRET = new TextEncoder().encode(
  process.env.PARTNER_JWT_SECRET || 'byemidias-partner-secret-change-in-production'
);

const COOKIE_NAME = 'partner_session';

export interface PartnerSession {
  partnerAccessId: string;
  organizationId: string;
  slug: string;
  username: string;
  displayName: string;
}

export async function createPartnerSession(session: PartnerSession): Promise<string> {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);

  return token;
}

export async function getPartnerSession(): Promise<PartnerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as PartnerSession;
  } catch {
    return null;
  }
}

export async function setPartnerSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearPartnerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Validate slug → returns organization_id or null
 * Aceita match exato OU aproximado (case-insensitive, sem espaços extras)
 */
export async function validateOrgSlug(slug: string): Promise<{ id: string; name: string } | null> {
  if (!slug) return null;
  const cleanSlug = slug.toLowerCase().trim();
  const pb = await getAdminClient();
  const exact = await pb.collection('organizations').getFirstListItem(
    `slug = "${cleanSlug}" && status != "inactive"`,
  ).catch(() => null);
  if (exact) return { id: exact.id, name: exact.name };

  const all = await pb.collection('organizations').getList(1, 100, {
    filter: 'status != "inactive"',
  });
  const normalized = cleanSlug.replace(/[-\s]+/g, '');
  for (const row of all.items) {
    const rowSlug = String(row.slug || '').toLowerCase().replace(/[-\s]+/g, '');
    if (rowSlug === normalized) return { id: row.id, name: row.name };
  }

  return null;
}

/**
 * Validate partner credentials against a specific org slug
 */
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

export async function validatePartnerCredentials(
  username: string,
  password: string,
  slug: string
): Promise<{ valid: boolean; partner?: PartnerSession }> {
  // First validate slug
  const org = await validateOrgSlug(slug);
  if (!org) return { valid: false };

  const pb = await getAdminClient();
  await ensurePartnerSchema(pb);
  const normalizedUsername = username.toLowerCase().trim();
  let partner: any = null;
  try {
    const list = await pb.collection('partner_access').getList(1, 200, {
      filter: `organization_id = "${org.id}"`,
    });
    partner = (list.items || []).find((p: any) => String(p.username || '').toLowerCase().trim() === normalizedUsername) || null;
  } catch {}

  if (!partner || (partner.status && partner.status !== 'active')) {
    return { valid: false };
  }

  let valid = false;
  try {
    const bcrypt = await import('bcryptjs');
    valid = await bcrypt.compare(password, partner.password_hash);
  } catch {
    valid = false;
  }

  if (!valid) {
    return { valid: false };
  }

  return {
    valid: true,
    partner: {
      partnerAccessId: partner.id,
      organizationId: partner.organization_id,
      slug,
      username: partner.username,
      displayName: partner.display_name,
    },
  };
}

/**
 * Get partner session, optionally validating slug matches
 */
export async function getPartnerSessionWithSlug(slug: string): Promise<PartnerSession | null> {
  const session = await getPartnerSession();
  if (!session) return null;
  if (session.slug !== slug) return null;
  return session;
}
