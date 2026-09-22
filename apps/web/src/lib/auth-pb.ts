/**
 * Auth server-side usando PocketBase SDK.
 * Substitui o uso de lib/db.ts (Postgres/Neon) que está fora do ar.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminClient } from '@/lib/pb-server';

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

export async function requireAuth(): Promise<UserProfile> {
  const user = await requireAuthApi();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireAuthApi(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return null;

  let data: any;
  try {
    data = JSON.parse(sessionCookie);
  } catch {
    return null;
  }
  const email = data?.email;
  if (!email) return null;

  try {
    const pb = await getAdminClient();

    // 1. Busca user (collection users) por email
    let user;
    try {
      user = await pb.collection('users').getFirstListItem(`email = "${email}"`);
    } catch {
      return null;
    }

    // 2. Busca profile (collection profiles) por user_id
    let profile = null;
    try {
      profile = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`);
    } catch {
      // Sem profile — não bloqueia login
    }

    // 3. Busca organization (collection organizations) por id
    let org = null;
    if (profile?.organization_id) {
      try {
        org = await pb.collection('organizations').getOne(profile.organization_id);
      } catch {
        // org pode ter sido deletada
      }
    }

    if (profile?.status && profile.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.name || user.email,
      role: profile?.role || 'manager',
      status: profile?.status || 'active',
      avatar_url: user.avatar || null,
      phone: null,
      organization_id: profile?.organization_id || null,
      org_name: org?.name,
      org_renewal_date: org?.renewal_date,
      org_plan: org?.plan,
      org_status: org?.status,
    };
  } catch (e) {
    console.error('[auth-pb] erro ao buscar user:', e);
    return null;
  }
}

export async function getOrgId(): Promise<string | null> {
  const user = await requireAuthApi();
  return user?.organization_id || null;
}

export async function isSuperAdmin(): Promise<boolean> {
  const user = await requireAuthApi();
  return user?.role === 'super_admin';
}
