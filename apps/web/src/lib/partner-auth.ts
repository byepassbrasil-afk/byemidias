import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SECRET = new TextEncoder().encode(
  process.env.PARTNER_JWT_SECRET || 'byemidias-partner-secret-change-in-production'
);

const COOKIE_NAME = 'partner_session';

export interface PartnerSession {
  partnerAccessId: string;
  organizationId: string;
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

export async function validatePartnerCredentials(
  username: string,
  password: string
): Promise<{ valid: boolean; partner?: PartnerSession }> {
  // Use service_role client to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: partner, error } = await supabase
    .from('partner_access')
    .select('id, organization_id, username, display_name, password_hash, status')
    .eq('username', username.toLowerCase().trim())
    .single();

  if (error || !partner || partner.status !== 'active') {
    return { valid: false };
  }

  // Always use bcryptjs for verification (consistent with creation)
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
      username: partner.username,
      displayName: partner.display_name,
    },
  };
}
