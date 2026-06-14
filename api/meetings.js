// Team / Growth meeting scheduler: schedule (or start instant) meetings and
// invite colleagues + external guests by email. Invites are emailed on create
// and on edit, with full time details, organizer, reason and a join link.
// Also stores per-meeting notes / call transcript.
import { queryDb, isMissingTableError } from './_db.js';
import { getMemberSession, getExecSession } from './_security.js';
import { sendEmail } from './_email.js';

const actorOf = (req) => getMemberSession(req) || getExecSession(req);
const SITE = (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://patienceai.in').replace(/\/$/, '');
const esc = (s) => String(s || '').replace(/</g, '&lt;');

// Google Calendar "add event" link (no attachment infra needed).
const gcalLink = (title, desc, startISO, durationMins, joinUrl) => {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + (durationMins || 30) * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${desc ? desc + '\n\n' : ''}Join: ${joinUrl}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

const inviteEmail = ({ title, description, when, durationMins, organizer, joinUrl, edited }) => {
  const safeTitle = esc(title);
  const gcal = gcalLink(title, description, when, durationMins, joinUrl);
  const whenStr = new Date(when).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });
  const html = `<div style="font-family:sans-serif;max-width:540px;margin:auto;padding:28px">
    <h2 style="color:#0f172a">${edited ? '🔁 Updated: ' : '📅 You are invited: '}${safeTitle}</h2>
    <p style="color:#475569;font-size:15px"><b>When:</b> ${whenStr} (${durationMins} min)<br><b>Organizer:</b> ${esc(organizer)}</p>
    ${description ? `<p style="color:#475569;white-space:pre-wrap"><b>Reason:</b> ${esc(description)}</p>` : ''}
    <p style="margin:20px 0"><a href="${joinUrl}" style="background:#4f46e5;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600">Join the meeting</a></p>
    <p style="color:#64748b;font-size:13px"><a href="${gcal}">+ Add to Google Calendar</a></p>
    <p style="color:#94a3b8;font-size:12px">Or open this link at the scheduled time: <a href="${joinUrl}">${joinUrl}</a></p>
  </div>`;
  const text = `${edited ? 'Updated: ' : 'You are invited: '}${title}\nWhen: ${whenStr} (${durationMins} min)\nOrganizer: ${organizer}\n${description ? `Reason: ${description}\n` : ''}Join: ${joinUrl}\nAdd to calendar: ${gcal}`;
  return { html, text };
};

const notifyAttendees = async ({ list, organizerEmail, subjectPrefix, title, description, when, durationMins, organizer, joinUrl, edited }) => {
  const { html, text } = inviteEmail({ title, description, when, durationMins, organizer, joinUrl, edited });
  const whenStr = new Date(when).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  for (const to of list.slice(0, 40)) {
    await sendEmail({ to, subject: `${subjectPrefix}: ${String(title).slice(0, 120)} — ${whenStr}`, html, text }).catch(() => {});
  }
  if (organizerEmail && !list.includes(organizerEmail.toLowerCase())) {
    await sendEmail({ to: organizerEmail, subject: `Meeting ${edited ? 'updated' : 'scheduled'}: ${String(title).slice(0, 120)} — ${whenStr}`, html, text }).catch(() => {});
  }
};

// Append a line to a meeting's notes/transcript. Used to auto-capture in-call
// chat — keyed by the room token (the same credential as the join link), so
// unauthenticated guests in the room can contribute their lines.
const appendTranscript = async (room, line) => {
  if (!room || !line) return null;
  const cur = (await queryDb(`SELECT id, notes FROM team_meetings WHERE room=$1 LIMIT 1`, [room]))[0];
  if (!cur) return null;
  const stamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const next = `${cur.notes ? cur.notes + '\n' : ''}[${stamp}] ${String(line).slice(0, 500)}`.slice(-20000);
  await queryDb(`UPDATE team_meetings SET notes=$1 WHERE id=$2`, [next, cur.id]);
  return true;
};

export default async function handler(req, res) {
  // Transcript capture is room-token authenticated (no session) so guests count.
  if (req.method === 'POST' && (req.body || {}).action === 'transcript') {
    const ok = await appendTranscript((req.body || {}).room, (req.body || {}).line).catch(() => null);
    return res.status(200).json({ ok: Boolean(ok) });
  }

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
      const b = req.body || {};
      // Save notes / call transcript for a meeting.
      if (b.action === 'notes') {
        const id = parseInt(b.id, 10);
        if (!id) return res.status(400).json({ error: 'id required' });
        const rows = await queryDb(`UPDATE team_meetings SET notes=$1 WHERE id=$2 RETURNING *`, [String(b.notes || '').slice(0, 20000), id]);
        return res.status(200).json({ meeting: rows[0] });
      }

      const { title, description = '', scheduledAt, durationMins = 30, attendees = [], organizerName, mode = 'video' } = b;
      if (!title?.trim() || !scheduledAt) return res.status(400).json({ error: 'title and scheduledAt are required' });
      const when = new Date(scheduledAt);
      if (isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid scheduledAt' });
      const list = (Array.isArray(attendees) ? attendees : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
      const organizer = String(organizerName || me.name || me.email).slice(0, 120);
      const room = `mtg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const rows = await queryDb(
        `INSERT INTO team_meetings (title, description, scheduled_at, duration_mins, created_by_email, created_by_name, attendees, room, mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [String(title).slice(0, 200), String(description).slice(0, 4000), when.toISOString(), parseInt(durationMins, 10) || 30, me.email, organizer, list.join(','), room, mode === 'voice' ? 'voice' : 'video']
      );
      const joinUrl = `${SITE}/meet?room=${room}${mode === 'voice' ? '&audio=1' : ''}`;
      await notifyAttendees({ list, organizerEmail: me.email, subjectPrefix: 'Meeting invite', title, description, when: when.toISOString(), durationMins, organizer, joinUrl });
      return res.status(200).json({ meeting: rows[0] });
    }

    // PATCH — edit a scheduled meeting and re-notify attendees.
    if (req.method === 'PATCH') {
      const b = req.body || {};
      const id = parseInt(b.id, 10);
      if (!id) return res.status(400).json({ error: 'id required' });
      const cur = (await queryDb(`SELECT * FROM team_meetings WHERE id=$1 LIMIT 1`, [id]))[0];
      if (!cur) return res.status(404).json({ error: 'Meeting not found' });
      const title = b.title != null ? String(b.title).slice(0, 200) : cur.title;
      const description = b.description != null ? String(b.description).slice(0, 4000) : (cur.description || '');
      const when = b.scheduledAt ? new Date(b.scheduledAt) : new Date(cur.scheduled_at);
      if (isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid scheduledAt' });
      const durationMins = b.durationMins != null ? (parseInt(b.durationMins, 10) || 30) : cur.duration_mins;
      const organizer = b.organizerName != null ? String(b.organizerName).slice(0, 120) : (cur.created_by_name || me.name || me.email);
      const list = b.attendees != null
        ? (Array.isArray(b.attendees) ? b.attendees : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean)
        : String(cur.attendees || '').split(',').filter(Boolean);
      const rows = await queryDb(
        `UPDATE team_meetings SET title=$1, description=$2, scheduled_at=$3, duration_mins=$4, created_by_name=$5, attendees=$6 WHERE id=$7 RETURNING *`,
        [title, description, when.toISOString(), durationMins, organizer, list.join(','), id]
      );
      const joinUrl = `${SITE}/meet?room=${cur.room}${cur.mode === 'voice' ? '&audio=1' : ''}`;
      if (b.notify !== false) await notifyAttendees({ list, organizerEmail: me.email, subjectPrefix: 'Meeting updated', title, description, when: when.toISOString(), durationMins, organizer, joinUrl, edited: true });
      return res.status(200).json({ meeting: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id || (req.body || {}).id, 10);
      if (!id) return res.status(400).json({ error: 'id required' });
      const del = await queryDb(`DELETE FROM team_meetings WHERE id=$1 RETURNING id`, [id]);
      return res.status(200).json({ ok: true, deleted: del.length });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    if (isMissingTableError(e.message)) return res.status(200).json({ meetings: [] });
    return res.status(500).json({ error: e.message });
  }
}

// Reminder sweep — emails attendees + organizer ~10 min before a meeting starts,
// once per meeting. Wired to a setInterval in server.js.
export const runMeetingReminders = async () => {
  try {
    const due = await queryDb(
      `SELECT * FROM team_meetings
       WHERE reminded_at IS NULL AND scheduled_at > NOW() AND scheduled_at <= NOW() + interval '10 minutes'`
    );
    for (const m of due) {
      const list = String(m.attendees || '').split(',').filter(Boolean);
      const joinUrl = `${SITE}/meet?room=${m.room}${m.mode === 'voice' ? '&audio=1' : ''}`;
      await notifyAttendees({
        list, organizerEmail: m.created_by_email, subjectPrefix: 'Starting soon',
        title: m.title, description: m.description, when: m.scheduled_at, durationMins: m.duration_mins,
        organizer: m.created_by_name || m.created_by_email, joinUrl,
      });
      await queryDb(`UPDATE team_meetings SET reminded_at=NOW() WHERE id=$1`, [m.id]).catch(() => {});
    }
  } catch (e) {
    if (!isMissingTableError(e.message)) console.error('[meeting reminders]', e.message);
  }
};
