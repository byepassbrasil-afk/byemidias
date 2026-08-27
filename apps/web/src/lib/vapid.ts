import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BFI-toRUgrlXybrm6_YfR_Fn8ibS14f4VxN5BRL79NBPpZKLnjFwnJDlyXysnvstcjynLoF4HRnqZWcpqvFB3hg';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '2TVzb9omf6_b_Y6kSTfNpMqfEiNXcyKgwB5MI4rFJcU';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@byemidias.com';

let configured = false;

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function ensureVapidConfigured() {
  if (!configured) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
}

export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
) {
  ensureVapidConfigured();
  try {
    await webpush.sendNotification(
      subscription,
      payload,
      { TTL: 60 } // 60 seconds TTL
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 = subscription expired, remove it
    if (status === 404 || status === 410) {
      return false; // signal to remove subscription
    }
    console.error('Push notification error:', err);
    return true; // don't remove on other errors
  }
}
