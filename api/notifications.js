// In-app notification center for executives, team members and admin.
// Admin notifications use the pseudo-recipient 'admin'.
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession, getMemberSession } from './_security.js';
import { cached, invalidate, cacheKeys } from './_cache.js';

const getRecipient = (req) => {
  const exec = getExecSession(req);
  if (exec) return exec.email;
  const member = getMemberSession(req);
  if (member) return member.email;
  if (verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME))) return 'admin';
  return null;
};

export default async function handler(req, res) {
  const recipient = getRecipient(req);
  if (!recipient) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    try {
      // Polled every 15s per signed-in user; cache is dropped the moment a
      // new notification is written (see notify() in _ticketing.js).
      return res.status(200).json(await cached(cacheKeys.notifications(recipient), 30, async () => {
        const [items, unread] = await Promise.all([
          queryDb(
            `SELECT id, type, ticket_id, message, read, created_at FROM notifications
             WHERE recipient_email=$1 ORDER BY created_at DESC LIMIT 30`,
            [recipient]
          ),
          queryDb(`SELECT count(*)::int AS n FROM notifications WHERE recipient_email=$1 AND read=false`, [recipient])
        ]);
        return { notifications: items, unread: unread[0]?.n || 0 };
      }));
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ notifications: [], unread: 0 });
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH — mark read: { ids: [...] } or { all: true }
  if (req.method === 'PATCH') {
    const { ids, all } = req.body || {};
    try {
      if (all) {
        await queryDb(`UPDATE notifications SET read=true WHERE recipient_email=$1 AND read=false`, [recipient]);
      } else if (Array.isArray(ids) && ids.length) {
        const clean = ids.map((n) => parseInt(n, 10)).filter(Number.isFinite).slice(0, 100);
        const placeholders = clean.map((_, i) => `$${i + 2}`).join(',');
        await queryDb(
          `UPDATE notifications SET read=true WHERE recipient_email=$1 AND id IN (${placeholders})`,
          [recipient, ...clean]
        );
      } else {
        return res.status(400).json({ error: 'ids or all required' });
      }
      await invalidate(cacheKeys.notifications(recipient));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
