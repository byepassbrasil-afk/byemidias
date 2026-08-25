import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import sql from '@/lib/db';

export async function requireAuth() {
  const user = await requireAuthApi();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireAuthApi() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return null;

  try {
    const data = JSON.parse(sessionCookie);
    const email = data.email;
    if (!email) return null;

    const [profile] = await sql`SELECT * FROM profiles WHERE email = ${email} LIMIT 1`;
    if (!profile) return null;

    return { id: profile.id, email: profile.email };
  } catch {
    return null;
  }
}

export async function getProfile(userId: string) {
  const [data] = await sql`SELECT * FROM profiles WHERE id = ${userId} LIMIT 1`;
  return data || null;
}
