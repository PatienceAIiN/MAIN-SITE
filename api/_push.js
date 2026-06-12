// Web-push helper (open-source `web-push` lib). VAPID keys come from env
// (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) or are generated once and persisted
// to .vapid.json so local dev keeps working subscriptions across restarts.
import webpush from 'web-push';
import { queryDb } from './_db.js';

let keys = null;

// Stable fallback keypair so push keeps working on hosts with an ephemeral
// filesystem (e.g. Render), where a generated .vapid.json would reset every
// deploy and silently invalidate every existing subscription. Override with
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars for stricter key custody.
const DEFAULT_VAPID = {
  publicKey: 'BBWKB42_SS7pb3qX8kuXgyz6d_8zMnYAp7dd_R7oo5YwPgVSqvJnvOZqD38cnrTPB-8-Z2I3MXdiW-1aH8u-9UE',
  privateKey: 'lfi8fFSAblQB2Vv0PpOw3TbNJ-ruZBupvsJ-Yz8SfLc'
};

const loadKeys = () => {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    // Stable baked-in keys (no per-restart regeneration). env overrides above.
    keys = DEFAULT_VAPID;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:growth@patienceai.in', keys.publicKey, keys.privateKey);
  return keys;
};

export const getVapidPublicKey = () => loadKeys().publicKey;

// Fire-and-forget push to a set of member emails. Respects the per-member
// notifications_enabled toggle; dead endpoints (410/404) are pruned.
export const sendPushToEmails = async (emails, payload) => {
  if (!emails?.length) return;
  loadKeys();
  try {
    const placeholders = emails.map((_, i) => `$${i + 1}`).join(',');
    const rows = await queryDb(
      `SELECT s.id, s.email, s.subscription FROM push_subscriptions s
       WHERE s.email IN (${placeholders})
         AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.email = s.email AND m.notifications_enabled = false)`,
      emails
    );
    const body = JSON.stringify(payload);
    await Promise.allSettled(rows.map(async (r) => {
      const sub = typeof r.subscription === 'string' ? JSON.parse(r.subscription) : r.subscription;
      try {
        await webpush.sendNotification(sub, body);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await queryDb(`DELETE FROM push_subscriptions WHERE id=$1`, [r.id]).catch(() => {});
        }
      }
    }));
  } catch (err) {
    console.error('[push] send failed:', err.message);
  }
};
