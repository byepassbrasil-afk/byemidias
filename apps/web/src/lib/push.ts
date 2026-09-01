import sql from '@/lib/db';
import { sendPushNotification } from '@/lib/vapid';

/**
 * Send push notification to all users in an organization
 * Also cleans up expired subscriptions (404/410)
 */
export async function sendPushToOrg(
  organizationId: string,
  title: string,
  body: string,
  url: string = '/dashboard/monitoring'
) {
  try {
    const subscriptions = await sql`
      SELECT endpoint, p256dh_key, auth_key
      FROM push_subscriptions
      WHERE organization_id = ${organizationId}
    `;

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ title, body, url, icon: '/icons/icon-192.png' });

    const staleEndpoints: string[] = [];

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const alive = await sendPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          payload
        );
        if (!alive) {
          staleEndpoints.push(sub.endpoint);
        }
      })
    );

    // Clean up expired subscriptions
    if (staleEndpoints.length > 0) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${staleEndpoints})`;
    }

    return results.length;
  } catch (e) {
    console.error('sendPushToOrg error:', e);
    return 0;
  }
}

/**
 * Send push to super_admin users (org_id = null)
 */
export async function sendPushToSuperAdmins(title: string, body: string, url: string = '/dashboard/monitoring') {
  try {
    const subscriptions = await sql`
      SELECT endpoint, p256dh_key, auth_key
      FROM push_subscriptions
      WHERE organization_id IS NULL
    `;

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ title, body, url, icon: '/icons/icon-192.png' });
    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const alive = await sendPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          payload
        );
        if (!alive) staleEndpoints.push(sub.endpoint);
      })
    );

    if (staleEndpoints.length > 0) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${staleEndpoints})`;
    }
  } catch (e) {
    console.error('sendPushToSuperAdmins error:', e);
  }
}
