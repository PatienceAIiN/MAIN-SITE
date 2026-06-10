import { queryDb, isMissingTableError } from './_db.js';
import {
  getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession, getMemberSession
} from './_security.js';
import { sendEmail } from './_email.js';
import { logAudit, notify, getSlaHours, ensureTicketingSeeds, handleMentions } from './_ticketing.js';
import { cached, cacheKeys, getVersion, bumpVersion, verScopes } from './_cache.js';
import crypto from 'node:crypto';

const filterHash = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 16);

const ALLOWED_DOMAIN = '@patienceai.in';
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const PRIORITY_COLORS = { low: '#64748b', medium: '#2563eb', high: '#d97706', urgent: '#dc2626' };

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

const getSiteBase = () => {
  const url = process.env.SITE_URL || '';
  if (url.startsWith('http')) return url.replace(/\/$/, '');
  return `https://${url || 'patienceai.in'}`;
};

// Who is calling? Executives and admin get full access; members only see their tickets.
const getActor = (req) => {
  const exec = getExecSession(req);
  if (exec) return { role: 'executive', id: exec.id, email: exec.email, name: exec.name };
  const member = getMemberSession(req);
  if (member) return { role: 'member', id: member.id, email: member.email, name: member.name };
  if (isAdmin(req)) return { role: 'admin', id: null, email: 'admin', name: 'Admin' };
  return null;
};

const ticketKey = (id) => `PA-${id}`;
const parseTicketId = (value) => {
  const n = parseInt(String(value).replace(/^pa-/i, ''), 10);
  return Number.isFinite(n) ? n : null;
};

const addSystemComment = async (ticketId, message) => {
  await queryDb(
    `INSERT INTO ticket_comments (ticket_id, author_role, author_name, message) VALUES ($1,'system','System',$2)`,
    [ticketId, message]
  ).catch(() => {});
};

const sendClientEmail = async (ticket) => {
  const link = `${getSiteBase()}/my-ticket?key=${ticketKey(ticket.id)}&email=${encodeURIComponent(ticket.customer_email)}`;
  await sendEmail({
    to: { email: ticket.customer_email, name: ticket.customer_name || undefined },
    subject: `Your support ticket ${ticketKey(ticket.id)} has been created — Patience AI`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f172a">Hi ${ticket.customer_name || 'there'},</h2>
      <p style="color:#475569">Thanks for chatting with our support team. We've raised a ticket to track your request and assigned it to a specialist.</p>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:20px 0">
        <p style="margin:4px 0;color:#0f172a"><strong>Ticket:</strong> ${ticketKey(ticket.id)}</p>
        <p style="margin:4px 0;color:#0f172a"><strong>Subject:</strong> ${ticket.subject}</p>
        <p style="margin:4px 0;color:#0f172a"><strong>Category:</strong> ${ticket.category}</p>
        <p style="margin:4px 0"><strong style="color:#0f172a">Priority:</strong> <span style="color:${PRIORITY_COLORS[ticket.priority]};text-transform:capitalize">${ticket.priority}</span></p>
      </div>
      <p style="color:#475569">You can check status, reply and share files any time from your ticket page:</p>
      <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">View My Ticket</a>
      <p style="color:#94a3b8;font-size:12px">— Patience AI Support</p>
    </div>`,
    text: `Hi ${ticket.customer_name || 'there'},\n\nYour support ticket ${ticketKey(ticket.id)} has been created.\nSubject: ${ticket.subject}\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\n\nTrack it here: ${link}\n\n— Patience AI Support`
  });
};

const sendAssigneeEmail = async (ticket) => {
  const link = `${getSiteBase()}/team`;
  await sendEmail({
    to: { email: ticket.assignee_email, name: ticket.assignee_name || undefined },
    subject: `[${ticket.priority.toUpperCase()}] Ticket ${ticketKey(ticket.id)} assigned to you — ${ticket.subject}`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f172a">New ticket assigned to you</h2>
      <p style="color:#475569">The support team has assigned you a task. Please follow up from the ticket portal.</p>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:20px 0">
        <p style="margin:4px 0;color:#0f172a"><strong>Ticket:</strong> ${ticketKey(ticket.id)}</p>
        <p style="margin:4px 0;color:#0f172a"><strong>Subject:</strong> ${ticket.subject}</p>
        <p style="margin:4px 0;color:#0f172a"><strong>Category:</strong> ${ticket.category}</p>
        <p style="margin:4px 0"><strong style="color:#0f172a">Priority:</strong> <span style="color:${PRIORITY_COLORS[ticket.priority]};text-transform:capitalize">${ticket.priority}</span></p>
        ${ticket.due_at ? `<p style="margin:4px 0;color:#0f172a"><strong>Respond by (SLA):</strong> ${new Date(ticket.due_at).toUTCString()}</p>` : ''}
        <p style="margin:4px 0;color:#0f172a"><strong>Raised by:</strong> ${ticket.created_by_name || 'Support team'}</p>
        ${ticket.customer_email ? `<p style="margin:4px 0;color:#0f172a"><strong>Client:</strong> ${ticket.customer_name || ''} ${ticket.customer_email}</p>` : ''}
      </div>
      ${ticket.description ? `<p style="color:#475569;white-space:pre-wrap">${ticket.description}</p>` : ''}
      <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open Ticket Portal</a>
      <p style="color:#94a3b8;font-size:12px">— Patience AI Support</p>
    </div>`,
    text: `New ticket assigned to you.\n\nTicket: ${ticketKey(ticket.id)}\nSubject: ${ticket.subject}\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\nRaised by: ${ticket.created_by_name || 'Support team'}\n${ticket.customer_email ? `Client: ${ticket.customer_email}\n` : ''}\n${ticket.description || ''}\n\nOpen the ticket portal: ${link}`
  });
};

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default async function handler(req, res) {
  const actor = getActor(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  await ensureTicketingSeeds();

  // ── POST /api/tickets/comments — comment / internal note (ticket chat) ────
  if (req.method === 'POST' && req.url?.includes('/comments')) {
    const { ticketId, message, isInternal = false } = req.body || {};
    if (!ticketId || !message?.trim()) return res.status(400).json({ error: 'ticketId and message required' });
    try {
      const rows = await queryDb(`SELECT * FROM support_tickets WHERE id=$1 LIMIT 1`, [ticketId]);
      const ticket = rows[0];
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (actor.role === 'member' && ticket.assignee_email !== actor.email)
        return res.status(403).json({ error: 'Not your ticket' });
      const inserted = await queryDb(
        `INSERT INTO ticket_comments (ticket_id, author_role, author_name, author_email, message, is_internal)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [ticketId, actor.role, actor.name, actor.email, String(message).slice(0, 4000), Boolean(isInternal)]
      );
      // First response from the assignee stops the SLA/escalation clock.
      if (actor.role === 'member' && actor.email === ticket.assignee_email && !ticket.first_response_at) {
        await queryDb(`UPDATE support_tickets SET first_response_at=NOW(), updated_at=NOW() WHERE id=$1`, [ticketId]).catch(() => {});
      } else {
        await queryDb(`UPDATE support_tickets SET updated_at=NOW() WHERE id=$1`, [ticketId]).catch(() => {});
      }
      // Notify the other side of the conversation.
      const key = ticketKey(ticket.id);
      const others = new Set();
      if (actor.email !== ticket.assignee_email) others.add(ticket.assignee_email);
      if (actor.role !== 'executive' && ticket.created_by_id) {
        const creator = await queryDb(`SELECT email FROM support_executives WHERE id=$1 LIMIT 1`, [ticket.created_by_id]).catch(() => []);
        if (creator[0]?.email && creator[0].email !== actor.email) others.add(creator[0].email);
      }
      for (const email of others) await notify(email, 'comment', ticket.id, `${actor.name} commented on ${key}: ${String(message).slice(0, 80)}`);
      await handleMentions(message, ticket.id, key, actor.name);
      await bumpVersion(verScopes.tickets, verScopes.ticket(ticket.id));
      return res.status(200).json({ comment: inserted[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/tickets?suggest=1 — most-used assignees + team member list ───
  if (req.method === 'GET' && req.query.suggest === '1') {
    if (actor.role === 'member') return res.status(403).json({ error: 'Forbidden' });
    try {
      const ver = await getVersion(verScopes.tickets);
      return res.status(200).json(await cached(cacheKeys.ticketSuggest(ver), 60, async () => {
      const [mostUsed, members] = await Promise.all([
        queryDb(
          `SELECT assignee_email AS email, MAX(assignee_name) AS name, COUNT(*)::int AS uses
           FROM support_tickets GROUP BY assignee_email ORDER BY uses DESC LIMIT 8`
        ).catch(() => []),
        queryDb(
          `SELECT email, name FROM team_members WHERE status='active' ORDER BY name ASC`
        ).catch(() => [])
      ]);
      return { mostUsed, members };
      }));
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ mostUsed: [], members: [] });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/tickets?id=X — single ticket with comments + attachments ─────
  if (req.method === 'GET' && req.query.id) {
    try {
      const id = parseTicketId(req.query.id);
      // Detail view is polled every ~4s while open; the per-ticket version bump
      // on any write means a fresh key (cache miss) the moment data changes.
      const ver = await getVersion(verScopes.ticket(id));
      const payload = await cached(cacheKeys.ticketDetail(id, ver), 20, async () => {
        const rows = await queryDb(`SELECT * FROM support_tickets WHERE id=$1 LIMIT 1`, [id]);
        const ticket = rows[0];
        if (!ticket) return { missing: true };
        const [comments, attachments, escalations] = await Promise.all([
          queryDb(`SELECT * FROM ticket_comments WHERE ticket_id=$1 ORDER BY created_at ASC LIMIT 300`, [ticket.id]).catch(() => []),
          queryDb(`SELECT id, comment_id, file_name, content_type, size_bytes, storage, uploaded_by_name, uploaded_by_role, created_at
                   FROM ticket_attachments WHERE ticket_id=$1 ORDER BY created_at ASC`, [ticket.id]).catch(() => []),
          queryDb(`SELECT * FROM ticket_escalations WHERE ticket_id=$1 ORDER BY created_at ASC`, [ticket.id]).catch(() => [])
        ]);
        return { ticket: { ...ticket, key: ticketKey(ticket.id) }, comments, attachments, escalations };
      });
      if (payload.missing) return res.status(404).json({ error: 'Ticket not found' });
      if (actor.role === 'member' && payload.ticket.assignee_email !== actor.email)
        return res.status(403).json({ error: 'Not your ticket' });
      return res.status(200).json(payload);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/tickets — list with advanced filters (+ CSV export) ──────────
  if (req.method === 'GET') {
    const { status, priority, search, category, assignee, clientEmail, dateFrom, dateTo, ticketId } = req.query;
    try {
      const where = [];
      const params = [];
      const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };
      if (actor.role === 'member') add('assignee_email = ?', actor.email);
      if (status && STATUSES.includes(status)) add('status = ?', status);
      if (priority && PRIORITIES.includes(priority)) add('priority = ?', priority);
      if (category?.trim()) add('category = ?', category.trim());
      if (assignee?.trim()) add('assignee_email ILIKE ?', `%${assignee.trim()}%`);
      if (clientEmail?.trim()) add('customer_email ILIKE ?', `%${clientEmail.trim()}%`);
      if (dateFrom) add('created_at >= ?', new Date(dateFrom).toISOString());
      if (dateTo) add('created_at <= ?', new Date(`${dateTo}T23:59:59`).toISOString());
      if (ticketId) {
        const id = parseTicketId(ticketId);
        if (id) add('id = ?', id);
      }
      if (search?.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        where.push(`(lower(subject) LIKE $${params.length} OR lower(coalesce(customer_email,'')) LIKE $${params.length} OR lower(assignee_email) LIKE $${params.length} OR lower(coalesce(category,'')) LIKE $${params.length})`);
      }
      // List polls (exec 10s, member 8s) are version-stamped: any ticket write
      // bumps the version so the next poll recomputes; otherwise Redis serves it.
      const ver = await getVersion(verScopes.tickets);
      const scope = actor.role === 'member' ? `m:${actor.email}` : 'staff';
      const listKey = cacheKeys.ticketList(ver, scope, filterHash(JSON.stringify([where, params])));
      const tickets = await cached(listKey, 15, async () => {
        const rows = await queryDb(
          `SELECT * FROM support_tickets ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
           ORDER BY created_at DESC LIMIT 500`,
          params
        );
        return rows.map((t) => ({ ...t, key: ticketKey(t.id) }));
      });

      if (req.query.export === 'csv') {
        if (actor.role === 'member') return res.status(403).json({ error: 'Forbidden' });
        const header = ['Ticket', 'Subject', 'Category', 'Priority', 'Status', 'Assignee', 'Client', 'Created', 'Due (SLA)', 'First response', 'Resolved', 'Escalation level'];
        const lines = tickets.map((t) => [
          t.key, t.subject, t.category, t.priority, t.status, t.assignee_email,
          t.customer_email || '', t.created_at, t.due_at || '', t.first_response_at || '', t.resolved_at || '', t.escalation_level
        ].map(csvEscape).join(','));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="tickets-export.csv"');
        return res.status(200).send([header.map(csvEscape).join(','), ...lines].join('\n'));
      }

      return res.status(200).json({ tickets });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ tickets: [] });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/tickets — create (executive/admin only) ─────────────────────
  if (req.method === 'POST') {
    if (actor.role === 'member') return res.status(403).json({ error: 'Only support executives can create tickets' });
    const {
      subject, description = '', priority = 'medium', assigneeEmail, assigneeName = '',
      category = 'General Inquiry',
      conversationId = null, customerEmail = null, customerName = null
    } = req.body || {};
    if (!subject?.trim()) return res.status(400).json({ error: 'subject required' });
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
    const assignee = String(assigneeEmail || '').trim().toLowerCase();
    if (!assignee.endsWith(ALLOWED_DOMAIN)) {
      return res.status(400).json({ error: `Tickets can only be assigned to ${ALLOWED_DOMAIN} email addresses` });
    }
    try {
      // Prefer the registered team-member name for the assignee when we have one.
      const memberRows = await queryDb(`SELECT name FROM team_members WHERE email=$1 LIMIT 1`, [assignee]).catch(() => []);
      const finalAssigneeName = memberRows[0]?.name || assigneeName.trim() || assignee.split('@')[0];
      const slaHours = await getSlaHours(priority);
      const dueAt = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

      const rows = await queryDb(
        `INSERT INTO support_tickets
           (subject, description, priority, status, category, conversation_id, customer_email, customer_name,
            created_by_id, created_by_name, assignee_email, assignee_name, due_at)
         VALUES ($1,$2,$3,'open',$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [subject.trim().slice(0, 300), String(description).slice(0, 8000), priority,
         String(category).slice(0, 80), conversationId,
         customerEmail ? String(customerEmail).trim().toLowerCase() : null, customerName,
         actor.id, actor.name, assignee, finalAssigneeName, dueAt]
      );
      const ticket = rows[0];
      const key = ticketKey(ticket.id);
      await addSystemComment(ticket.id, `Ticket created by ${actor.name} and assigned to ${finalAssigneeName} (${assignee}) — ${priority} priority, ${category}. SLA: respond within ${slaHours}h.`);
      await notify(assignee, 'assignment', ticket.id, `${actor.name} assigned ${key} to you: ${ticket.subject}`);
      await logAudit(actor.role, actor.email, 'ticket_created', key, { assignee, priority, category });

      // Send notifications; failures are recorded, never block creation.
      let clientStatus = 'skipped';
      if (ticket.customer_email) {
        try { await sendClientEmail(ticket); clientStatus = 'sent'; }
        catch (e) { clientStatus = 'failed'; console.error('[ticket] client email failed:', e.message); }
      }
      let assigneeStatus = 'pending';
      try { await sendAssigneeEmail(ticket); assigneeStatus = 'sent'; }
      catch (e) { assigneeStatus = 'failed'; console.error('[ticket] assignee email failed:', e.message); }

      const updated = await queryDb(
        `UPDATE support_tickets SET client_email_status=$1, assignee_email_status=$2, updated_at=NOW()
         WHERE id=$3 RETURNING *`,
        [clientStatus, assigneeStatus, ticket.id]
      );

      // Drop a note in the live chat so the customer sees the ticket reference.
      if (conversationId) {
        await queryDb(
          `INSERT INTO support_chats (conversation_id, sender, message) VALUES ($1,'system',$2)`,
          [conversationId, `Ticket ${key} created (${priority} priority) — our team will follow up by email.`]
        ).catch(() => {});
      }

      await bumpVersion(verScopes.tickets, verScopes.ticket(ticket.id));
      return res.status(200).json({ ticket: { ...updated[0], key } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PATCH /api/tickets — update status/priority/assignee (single or bulk) ──
  if (req.method === 'PATCH') {
    const { id, ids, status, priority, assigneeEmail } = req.body || {};
    const targetIds = Array.isArray(ids) && ids.length ? ids.map(parseTicketId).filter(Boolean) : (id ? [parseTicketId(id)] : []);
    if (!targetIds.length) return res.status(400).json({ error: 'id or ids required' });
    if (targetIds.length > 1 && actor.role === 'member') return res.status(403).json({ error: 'Bulk operations are for support staff' });
    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

    let newAssignee = null;
    if (assigneeEmail) {
      if (actor.role === 'member') return res.status(403).json({ error: 'Members cannot reassign tickets' });
      const a = String(assigneeEmail).trim().toLowerCase();
      if (!a.endsWith(ALLOWED_DOMAIN)) return res.status(400).json({ error: `Tickets can only be assigned to ${ALLOWED_DOMAIN} email addresses` });
      const memberRows = await queryDb(`SELECT name FROM team_members WHERE email=$1 LIMIT 1`, [a]).catch(() => []);
      newAssignee = { email: a, name: memberRows[0]?.name || a.split('@')[0] };
    }
    if (!status && !priority && !newAssignee) return res.status(400).json({ error: 'Nothing to update' });

    try {
      const results = [];
      for (const tid of targetIds) {
        const rows = await queryDb(`SELECT * FROM support_tickets WHERE id=$1 LIMIT 1`, [tid]);
        const ticket = rows[0];
        if (!ticket) continue;
        if (actor.role === 'member' && ticket.assignee_email !== actor.email) continue;

        const sets = [];
        const params = [];
        const notes = [];
        const key = ticketKey(ticket.id);
        if (status && status !== ticket.status) {
          params.push(status); sets.push(`status = $${params.length}`);
          notes.push(`${actor.name} moved the ticket from "${ticket.status.replace('_', ' ')}" to "${status.replace('_', ' ')}".`);
          if (['resolved', 'closed'].includes(status) && !ticket.resolved_at) sets.push(`resolved_at = NOW()`);
          if (!['resolved', 'closed'].includes(status)) sets.push(`resolved_at = NULL`);
          if (actor.email !== ticket.assignee_email) await notify(ticket.assignee_email, 'status_change', ticket.id, `${actor.name} set ${key} to ${status.replace('_', ' ')}`);
        }
        if (priority && priority !== ticket.priority) {
          params.push(priority); sets.push(`priority = $${params.length}`);
          const hours = await getSlaHours(priority);
          params.push(new Date(new Date(ticket.created_at).getTime() + hours * 3600 * 1000).toISOString());
          sets.push(`due_at = $${params.length}`);
          notes.push(`${actor.name} changed priority from ${ticket.priority} to ${priority}.`);
        }
        if (newAssignee && newAssignee.email !== ticket.assignee_email) {
          params.push(newAssignee.email); sets.push(`assignee_email = $${params.length}`);
          params.push(newAssignee.name); sets.push(`assignee_name = $${params.length}`);
          notes.push(`${actor.name} reassigned the ticket from ${ticket.assignee_email} to ${newAssignee.email}.`);
          await notify(newAssignee.email, 'assignment', ticket.id, `${actor.name} assigned ${key} to you: ${ticket.subject}`);
          await notify(ticket.assignee_email, 'reassignment', ticket.id, `${key} was reassigned from you to ${newAssignee.name}`);
          await logAudit(actor.role, actor.email, 'ticket_reassigned', key, { from: ticket.assignee_email, to: newAssignee.email });
        }
        if (!sets.length) { results.push({ ...ticket, key }); continue; }

        params.push(tid);
        const updated = await queryDb(
          `UPDATE support_tickets SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`,
          params
        );
        for (const note of notes) await addSystemComment(tid, note);

        if (newAssignee && newAssignee.email !== ticket.assignee_email) {
          let assigneeEmailStatus = 'sent';
          try { await sendAssigneeEmail({ ...updated[0] }); }
          catch (e) { assigneeEmailStatus = 'failed'; console.error('[ticket] reassign email failed:', e.message); }
          await queryDb(`UPDATE support_tickets SET assignee_email_status=$1 WHERE id=$2`, [assigneeEmailStatus, tid]).catch(() => {});
        }
        results.push({ ...updated[0], key });
      }
      if (targetIds.length > 1) await logAudit(actor.role, actor.email, 'ticket_bulk_update', `${results.length} tickets`, { status, priority, assignee: newAssignee?.email });
      await bumpVersion(verScopes.tickets, ...targetIds.map((tid) => verScopes.ticket(tid)));
      return res.status(200).json(targetIds.length > 1 ? { tickets: results, updated: results.length } : { ticket: results[0] || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE /api/tickets — admin or executive ───────────────────────────────
  if (req.method === 'DELETE') {
    if (actor.role === 'member') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      await queryDb(`DELETE FROM support_tickets WHERE id=$1`, [parseTicketId(id)]);
      await logAudit(actor.role, actor.email, 'ticket_deleted', ticketKey(parseTicketId(id)));
      await bumpVersion(verScopes.tickets, verScopes.ticket(parseTicketId(id)));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
