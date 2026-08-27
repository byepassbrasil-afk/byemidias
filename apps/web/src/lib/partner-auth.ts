import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import sql from '@/lib/db';

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
 */
export async function validateOrgSlug(slug: string): Promise<{ id: string; name: string } | null> {
  const [org] = await sql`SELECT id, name FROM organizations WHERE slug = ${slug} AND status != 'inactive' LIMIT 1`;
  return org || null;
}

/**
 * Validate partner credentials against a specific org slug
 */
export async function validatePartnerCredentials(
  username: string,
  password: string,
  slug: string
): Promise<{ valid: boolean; partner?: PartnerSession }> {
  // First validate slug
  const org = await validateOrgSlug(slug);
  if (!org) return { valid: false };

  const partners = await sql`
    SELECT id, organization_id, username, name as display_name, password_hash, status
    FROM partner_access
    WHERE username = ${username.toLowerCase().trim()}
      AND organization_id = ${org.id}
    LIMIT 1
  `;

  const partner = partners[0];

  if (!partner || partner.status !== 'active') {
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
