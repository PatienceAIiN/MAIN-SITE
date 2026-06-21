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
  publicKey: 'BJ5m55KRGpjjdNta-b2vVfJKMphLPgL0K57ZCgzkGAooI1wL9SoDLsj3nfWifqvwYXZsUfSUoT8U0tCyuTahSV0',
  privateKey: 'hZkPFfS2J2och_UZwXHbrwzxhLs-hSz2mAvSooj1yDE'
};

// base64url → byte length (0 if it isn't decodable base64). A valid VAPID
// public key is 65 bytes (uncompressed P-256 point) and the private key 32.
const byteLen = (b64) => {
  try {
    const s = String(b64 || '').trim().replace(/\s+/g, '');
    const std = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(std, 'base64').length;
  } catch { return 0; }
};
const validVapid = (pub, priv) => byteLen(pub) === 65 && byteLen(priv) === 32;

const loadKeys = () => {
  if (keys) return keys;
  const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  // Use env keys ONLY if they're a valid base64url P-256 keypair; otherwise a
  // malformed env value (wrong length / not base64url) would make the browser
  // throw "Vapid public key should be 65 bytes long". Fall back to baked-in.
  if (envPub && envPriv && validVapid(envPub, envPriv)) {
    keys = { publicKey: envPub, privateKey: envPriv };
  } else {
    if (envPub || envPriv) console.warn('[push] VAPID env keys are invalid (public must decode to 65 bytes, private to 32) — using built-in keypair.');
    keys = DEFAULT_VAPID;
  }
  const subject = (process.env.VAPID_SUBJECT || 'mailto:growth@patienceai.in').trim();
  try { webpush.setVapidDetails(/^https?:|^mailto:/.test(subject) ? subject : 'mailto:growth@patienceai.in', keys.publicKey, keys.privateKey); }
  catch (e) { console.error('[push] setVapidDetails failed, retrying with built-in keys:', e.message); keys = DEFAULT_VAPID; webpush.setVapidDetails('mailto:growth@patienceai.in', keys.publicKey, keys.privateKey); }
  return keys;
};

export const getVapidPublicKey = () => loadKeys().publicKey;

// Fire-and-forget push to a set of member emails. Respects the per-member
// notifications_enabled toggle; dead endpoints (410/404) are pruned.
// Shared team-side features (colleague chat, calls) live in several portals,
// each of which is now its own installable PWA. When a push targets one of
// these, we retarget it to each recipient's home portal so clicking the
// notification opens *their* app: support executives → /support-executive,
// everyone else (team members) → /team. Portal-specific pushes (e.g. the
// client ticket tracker at /my-ticket) are left untouched.
const RETARGETABLE_PORTALS = new Set(['/team', '/admin', '/support-executive']);
const homePortalUrl = (originalUrl, isSupport) => {
  if (!RETARGETABLE_PORTALS.has(originalUrl)) return originalUrl;
  return isSupport ? '/support-executive' : '/team';
};

export const sendPushToEmails = async (emails, payload) => {
  if (!emails?.length) return;
  loadKeys();
  try {
    const placeholders = emails.map((_, i) => `$${i + 1}`).join(',');
    const rows = await queryDb(
      `SELECT s.id, s.email, s.subscription,
              EXISTS (SELECT 1 FROM support_executives x WHERE x.email = s.email) AS is_support
       FROM push_subscriptions s
       WHERE s.email IN (${placeholders})
         AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.email = s.email AND m.notifications_enabled = false)`,
      emails
    );
    await Promise.allSettled(rows.map(async (r) => {
      const sub = typeof r.subscription === 'string' ? JSON.parse(r.subscription) : r.subscription;
      const url = homePortalUrl(payload.url, r.is_support);
      const body = JSON.stringify(url === payload.url ? payload : { ...payload, url });
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
