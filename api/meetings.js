// Team meeting scheduler: any team member / executive can schedule a meeting and
// invite colleagues by email. Invites are emailed on create.
import { queryDb, isMissingTableError } from './_db.js';
import { getMemberSession, getExecSession } from './_security.js';
import { sendEmail } from './_email.js';

const actorOf = (req) => getMemberSession(req) || getExecSession(req);

export default async function handler(req, res) {
  const me = actorOf(req);
  if (!me) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      const rows = await queryDb(
        `SELECT * FROM team_meetings WHERE scheduled_at > NOW() - interval '1 day' ORDER BY scheduled_at ASC LIMIT 200`
      );
      return res.status(200).json({ meetings: rows });
    }

    if (req.method === 'POST') {
      const { title, description = '', scheduledAt, durationMins = 30, attendees = [] } = req.body || {};
      if (!title?.trim() || !scheduledAt) return res.status(400).json({ error: 'title and scheduledAt are required' });
      const when = new Date(scheduledAt);
      if (isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid scheduledAt' });
      const list = (Array.isArray(attendees) ? attendees : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
      const room = `mtg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const rows = await queryDb(
        `INSERT INTO team_meetings (title, description, scheduled_at, duration_mins, created_by_email, created_by_name, attendees, room)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [String(title).slice(0, 200), String(description).slice(0, 4000), when.toISOString(), parseInt(durationMins, 10) || 30, me.email, me.name || me.email, list.join(','), room]
      );
      const when2 = when.toLocaleString();
      const html = `<h2>📅 Meeting: ${String(title).slice(0, 200)}</h2><p style="color:#475569"><b>When:</b> ${when2} (${durationMins} min)<br><b>Organizer:</b> ${me.name || me.email}</p>${description ? `<p style="color:#475569;white-space:pre-wrap">${String(description).replace(/</g, '&lt;')}</p>` : ''}<p style="color:#94a3b8;font-size:12px">Join from the PATIENCE AI team portal at the scheduled time.</p>`;
      for (const to of list.slice(0, 30)) {
        await sendEmail({ to, subject: `Meeting invite: ${String(title).slice(0, 120)} — ${when2}`, html, text: `${title} at ${when2}` }).catch(() => {});
      }
      return res.status(200).json({ meeting: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id || (req.body || {}).id, 10);
      if (!id) return res.status(400).json({ error: 'id required' });
      await queryDb(`DELETE FROM team_meetings WHERE id=$1 AND created_by_email=$2`, [id, me.email]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    if (isMissingTableError(e.message)) return res.status(200).json({ meetings: [] });
    return res.status(500).json({ error: e.message });
  }
}
