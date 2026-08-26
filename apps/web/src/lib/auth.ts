import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import sql from '@/lib/db';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  avatar_url: string | null;
  phone: string | null;
  organization_id: string | null;
  org_name?: string;
  org_renewal_date?: string;
  org_plan?: string;
  org_status?: string;
}

export async function requireAuth() {
  const user = await requireAuthApi();
  if (!user) {
    redirect('/login');
  }
  if (user.org_renewal_date && user.org_status !== 'suspended') {
    const renewal = new Date(user.org_renewal_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (renewal < today && user.role !== 'super_admin') {
      redirect('/subscription-expired');
    }
  }
  return user;
}

export async function requireAuthApi(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return null;

  try {
    const data = JSON.parse(sessionCookie);
    const email = data.email;
    if (!email) return null;

    const [profile] = await sql`
      SELECT p.id, p.email, p.full_name, p.role, p.status, p.avatar_url, p.phone, p.organization_id,
             o.name as org_name, o.renewal_date as org_renewal_date, o.plan as org_plan, o.status as org_status
      FROM profiles p
      LEFT JOIN organizations o ON p.organization_id = o.id
      WHERE p.email = ${email} LIMIT 1
    `;
    if (!profile) return null;
    if (profile.status !== 'active') return null;

    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      status: profile.status,
      avatar_url: profile.avatar_url,
      phone: profile.phone,
      organization_id: profile.organization_id,
      org_name: profile.org_name,
      org_renewal_date: profile.org_renewal_date,
      org_plan: profile.org_plan,
      org_status: profile.org_status,
    };
  } catch {
    return null;
  }
}

export async function getProfile(userId: string) {
  const [data] = await sql`
    SELECT p.*, o.name as org_name, o.renewal_date as org_renewal_date, o.plan as org_plan
    FROM profiles p
    LEFT JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = ${userId} LIMIT 1
  `;
  return data || null;
}

export async function getOrgId(): Promise<string | null> {
  const user = await requireAuthApi();
  return user?.organization_id || null;
}

export async function isSuperAdmin(): Promise<boolean> {
  const user = await requireAuthApi();
  return user?.role === 'super_admin';
}
