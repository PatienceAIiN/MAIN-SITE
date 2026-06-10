// Ticketing configuration: SLA rules, categories and saved responses.
// Read: any signed-in staff (admin / executive / member). Write: admin only.
import { queryDb } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession, getMemberSession } from './_security.js';
import { ensureTicketingSeeds, logAudit } from './_ticketing.js';
import { cached, invalidate, cacheKeys } from './_cache.js';

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

export default async function handler(req, res) {
  const authed = isAdmin(req) || getExecSession(req) || getMemberSession(req);
  if (!authed) return res.status(401).json({ error: 'Not authenticated' });
  await ensureTicketingSeeds();

  if (req.method === 'GET') {
    try {
      // Near-static config; admin writes below invalidate explicitly.
      return res.status(200).json(await cached(cacheKeys.ticketSettings, 300, async () => {
        const [slas, categories, savedResponses] = await Promise.all([
          queryDb(`SELECT priority, hours FROM sla_policies ORDER BY hours ASC`),
          queryDb(`SELECT id, name FROM ticket_categories ORDER BY name ASC`),
          queryDb(`SELECT id, label, body, kind FROM saved_responses ORDER BY id ASC`)
        ]);
        return { slas, categories, savedResponses };
      }));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
  await invalidate(cacheKeys.ticketSettings); // every admin write below changes config

  // PATCH — update SLA hours for a priority
  if (req.method === 'PATCH') {
    const { priority, hours } = req.body || {};
    const h = parseInt(hours, 10);
    if (!['low', 'medium', 'high', 'urgent'].includes(priority) || !Number.isFinite(h) || h < 1 || h > 720) {
      return res.status(400).json({ error: 'priority and hours (1-720) required' });
    }
    try {
      await queryDb(
        `INSERT INTO sla_policies (priority, hours) VALUES ($1,$2)
         ON CONFLICT (priority) DO UPDATE SET hours=$2, updated_at=NOW()`,
        [priority, h]
      );
      await logAudit('admin', 'admin', 'sla_updated', priority, { hours: h });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — add category or saved response
  if (req.method === 'POST') {
    const { categoryName, response } = req.body || {};
    try {
      if (categoryName?.trim()) {
        const rows = await queryDb(
          `INSERT INTO ticket_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *`,
          [categoryName.trim().slice(0, 80)]
        );
        return res.status(200).json({ category: rows[0] || null });
      }
      if (response?.label?.trim() && response?.body?.trim()) {
        const rows = await queryDb(
          `INSERT INTO saved_responses (label, body, kind) VALUES ($1,$2,$3) RETURNING *`,
          [response.label.trim().slice(0, 60), response.body.trim().slice(0, 2000), response.kind || 'general']
        );
        return res.status(200).json({ response: rows[0] });
      }
      return res.status(400).json({ error: 'categoryName or response {label, body} required' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE — remove category or saved response
  if (req.method === 'DELETE') {
    const { categoryId, responseId } = req.body || {};
    try {
      if (categoryId) await queryDb(`DELETE FROM ticket_categories WHERE id=$1`, [categoryId]);
      else if (responseId) await queryDb(`DELETE FROM saved_responses WHERE id=$1`, [responseId]);
      else return res.status(400).json({ error: 'categoryId or responseId required' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
