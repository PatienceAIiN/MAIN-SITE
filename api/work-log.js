// Admin timesheet: turns the presence_log (online/away/offline transitions)
// into per-person, per-day worked hours. "Worked" = time spent online (busy on
// a call counts as online); away/offline time is excluded. Target is 9h/day.
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const days = Math.min(parseInt(req.query.days, 10) || 14, 90);
  try {
    const rows = await queryDb(
      `SELECT email, name, role, status, at FROM presence_log
       WHERE at > NOW() - ($1 || ' days')::interval ORDER BY email, at ASC`,
      [String(days)]
    );

    // Walk each person's events; each event's status spans until the next event
    // (or now). Accumulate worked/away seconds into the day the span starts in.
    const now = Date.now();
    const byPerson = {};
    for (const r of rows) {
      if (!byPerson[r.email]) byPerson[r.email] = { name: r.name, role: r.role, events: [] };
      byPerson[r.email].events.push(r);
      if (r.name) byPerson[r.email].name = r.name;
      if (r.role) byPerson[r.email].role = r.role;
    }
    const out = {}; // email -> { name, role, days: { day: {worked, away} } }
    for (const [email, p] of Object.entries(byPerson)) {
      out[email] = { email, name: p.name || email, role: p.role || '—', days: {} };
      for (let i = 0; i < p.events.length; i += 1) {
        const ev = p.events[i];
        const start = new Date(ev.at).getTime();
        const end = i + 1 < p.events.length ? new Date(p.events[i + 1].at).getTime() : now;
        let secs = Math.max(0, Math.min(end - start, 24 * 3600 * 1000) / 1000);
        if (ev.status === 'offline') continue;
        const k = dayKey(ev.at);
        if (!out[email].days[k]) out[email].days[k] = { worked: 0, away: 0 };
        const slot = out[email].days[k];
        if (ev.status === 'online') slot.worked += secs; else slot.away += secs;
      }
    }

    // Flatten to rows sorted by day desc then name.
    const flat = [];
    for (const p of Object.values(out)) {
      for (const [day, v] of Object.entries(p.days)) {
        flat.push({ email: p.email, name: p.name, role: p.role, day,
          workedSeconds: Math.round(v.worked), awaySeconds: Math.round(v.away) });
      }
    }
    flat.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.name.localeCompare(b.name)));
    return res.status(200).json({ rows: flat, targetHours: 9, days });
  } catch (e) {
    if (isMissingTableError(e.message)) return res.status(200).json({ rows: [], targetHours: 9, days });
    return res.status(500).json({ error: e.message });
  }
}
