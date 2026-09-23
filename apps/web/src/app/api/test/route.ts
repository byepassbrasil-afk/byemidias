import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    success: true,
    pbUrl: PB_URL,
    hasEmail: !!process.env.PB_ADMIN_EMAIL,
    hasPassword: !!process.env.PB_ADMIN_PASSWORD,
    timestamp: new Date().toISOString(),
  });
}
