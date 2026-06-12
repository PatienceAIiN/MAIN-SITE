// Team notes: personal notes + auto-saved Minutes of Meeting (MoM). Any team
// member or support executive can create/edit/delete their own notes; MoM notes
// are visible to the whole team and can be emailed to meeting participants.
import { queryDb, isMissingTableError } from './_db.js';
import { getMemberSession, getExecSession } from './_security.js';
import { sendEmail } from './_email.js';

const actorOf = (req) => getMemberSession(req) || getExecSession(req);

export default async function handler(req, res) {
  const me = actorOf(req);
  if (!me) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      // Own notes + all team MoMs.
      const rows = await queryDb(
        `SELECT id, author_email, author_name, title, body, kind, created_at, updated_at
         FROM team_notes WHERE author_email=$1 OR kind='mom' ORDER BY updated_at DESC LIMIT 300`,
        [me.email]
      );
      return res.status(200).json({ notes: rows });
    }

    if (req.method === 'POST') {
      const { title = 'Untitled', body = '', kind = 'note', emailTo } = req.body || {};
      const rows = await queryDb(
        `INSERT INTO team_notes (author_email, author_name, title, body, kind) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [me.email, me.name || me.email, String(title).slice(0, 200), String(body).slice(0, 20000), kind === 'mom' ? 'mom' : 'note']
      );
      // MoM: email the meeting participants a copy.
      if (kind === 'mom' && Array.isArray(emailTo) && emailTo.length) {
        const html = `<h2>📝 Minutes of Meeting — ${String(title).slice(0, 200)}</h2><p style="color:#475569;white-space:pre-wrap">${String(body).slice(0, 20000).replace(/</g, '&lt;')}</p><p style="color:#94a3b8;font-size:12px">Recorded by ${me.name || me.email} via the PATIENCE AI team portal.</p>`;
        for (const to of emailTo.filter(Boolean).slice(0, 30)) {
          await sendEmail({ to, subject: `Minutes of Meeting — ${String(title).slice(0, 120)}`, html, text: body }).catch(() => {});
        }
      }
      return res.status(200).json({ note: rows[0] });
    }

    if (req.method === 'PATCH') {
      const { id, title, body } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const rows = await queryDb(
        `UPDATE team_notes SET title=COALESCE($1,title), body=COALESCE($2,body), updated_at=NOW()
         WHERE id=$3 AND author_email=$4 RETURNING *`,
        [title != null ? String(title).slice(0, 200) : null, body != null ? String(body).slice(0, 20000) : null, id, me.email]
      );
      if (!rows[0]) return res.status(403).json({ error: 'Not your note' });
      return res.status(200).json({ note: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id || (req.body || {}).id, 10);
      if (!id) return res.status(400).json({ error: 'id required' });
      await queryDb(`DELETE FROM team_notes WHERE id=$1 AND author_email=$2`, [id, me.email]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    if (isMissingTableError(e.message)) return res.status(200).json({ notes: [] });
    return res.status(500).json({ error: e.message });
  }
}
