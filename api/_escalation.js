// Background escalation + SLA engine. Runs on an interval from server.js.
// Ladder when the assignee hasn't responded (no first_response_at):
//   level 1 — reminder email + notification to the assignee
//   level 2 — escalate to the executive who raised the ticket
//   level 3 — escalate to admin (CONTACT_TO_EMAIL)
// Separately: SLA warning when the deadline is near, breach when passed.
import { queryDb } from './_db.js';
import { sendEmail } from './_email.js';
import { notify, logAudit } from './_ticketing.js';
import { bumpVersion, verScopes } from './_cache.js';

const REMINDER_HOURS = parseFloat(process.env.TICKET_REMINDER_HOURS || '2');
const SLA_WARNING_HOURS = parseFloat(process.env.TICKET_SLA_WARNING_HOURS || '2');

const safeSendEmail = async (opts) => {
  try { await sendEmail(opts); return true; }
  catch (e) { console.error('[escalation] email failed:', e.message); return false; }
};

const recordEscalation = async (ticket, level, reason, notifiedEmail) => {
  await queryDb(
    `INSERT INTO ticket_escalations (ticket_id, level, reason, notified_email) VALUES ($1,$2,$3,$4)`,
    [ticket.id, level, reason, notifiedEmail]
  ).catch(() => {});
  await queryDb(
    `UPDATE support_tickets SET escalation_level=$1, last_reminder_at=NOW(), updated_at=NOW() WHERE id=$2`,
    [level, ticket.id]
  ).catch(() => {});
  await queryDb(
    `INSERT INTO ticket_comments (ticket_id, author_role, author_name, message) VALUES ($1,'system','System',$2)`,
    [ticket.id, reason]
  ).catch(() => {});
  await logAudit('system', null, 'ticket_escalated', `PA-${ticket.id}`, { level, notifiedEmail });
  await bumpVersion(verScopes.tickets, verScopes.ticket(ticket.id));
};

export const runEscalationSweep = async () => {
  if (!process.env.DATABASE_URL) return;
  const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

  try {
    // ── No-response escalation ladder ─────────────────────────────────────
    const stale = await queryDb(
      `SELECT * FROM support_tickets
       WHERE status IN ('open','in_progress') AND first_response_at IS NULL AND escalation_level < 3
         AND COALESCE(last_reminder_at, created_at) < $1
       ORDER BY created_at ASC LIMIT 20`,
      [hoursAgo(REMINDER_HOURS)]
    );

    for (const t of stale) {
      const key = `PA-${t.id}`;
      if (Number(t.escalation_level) === 0) {
        const reason = `Reminder sent to ${t.assignee_name || t.assignee_email} — no response on ${key} yet.`;
        await safeSendEmail({
          to: { email: t.assignee_email, name: t.assignee_name || undefined },
          subject: `Reminder: ticket ${key} is waiting for your response — ${t.subject}`,
          text: `Hi ${t.assignee_name || ''},\n\nTicket ${key} ("${t.subject}", ${t.priority} priority) was assigned to you and has not received a response yet. Please follow up from the ticket portal.\n\n— Patience AI Support`
        });
        await notify(t.assignee_email, 'escalation', t.id, `Reminder: ${key} is waiting for your first response`);
        await recordEscalation(t, 1, reason, t.assignee_email);
      } else if (Number(t.escalation_level) === 1) {
        const creator = t.created_by_id
          ? (await queryDb(`SELECT email, name FROM support_executives WHERE id=$1 LIMIT 1`, [t.created_by_id]).catch(() => []))[0]
          : null;
        const target = creator?.email || process.env.CONTACT_TO_EMAIL?.split(',')[0];
        const reason = `Escalated to ${creator?.name || 'support lead'} — ${t.assignee_name || t.assignee_email} has not responded on ${key}.`;
        if (target) {
          await safeSendEmail({
            to: { email: target },
            subject: `Escalation: ticket ${key} has no response from ${t.assignee_email}`,
            text: `Ticket ${key} ("${t.subject}", ${t.priority} priority) assigned to ${t.assignee_email} has not received a response despite a reminder. Please intervene.\n\n— Patience AI ticket system`
          });
          await notify(target, 'escalation', t.id, `${key} escalated to you — assignee unresponsive`);
        }
        await recordEscalation(t, 2, reason, target || null);
      } else if (Number(t.escalation_level) === 2) {
        const adminEmail = process.env.CONTACT_TO_EMAIL?.split(',')[0];
        const reason = `Escalated to admin — ${key} still unresolved with no assignee response.`;
        if (adminEmail) {
          await safeSendEmail({
            to: { email: adminEmail },
            subject: `ADMIN escalation: ticket ${key} unresolved — ${t.subject}`,
            text: `Ticket ${key} ("${t.subject}", ${t.priority} priority) assigned to ${t.assignee_email} remains unanswered after two escalations. Immediate attention required.\n\n— Patience AI ticket system`
          });
        }
        await notify('admin', 'escalation', t.id, `${key} escalated to admin — still no response`);
        await recordEscalation(t, 3, reason, adminEmail || 'admin');
      }
    }

    // ── SLA warnings (deadline approaching) ───────────────────────────────
    const warn = await queryDb(
      `SELECT * FROM support_tickets
       WHERE status IN ('open','in_progress') AND sla_warned=false AND due_at IS NOT NULL
         AND due_at > NOW() AND due_at < $1 LIMIT 20`,
      [new Date(Date.now() + SLA_WARNING_HOURS * 3600 * 1000).toISOString()]
    );
    for (const t of warn) {
      await notify(t.assignee_email, 'sla_warning', t.id, `SLA warning: PA-${t.id} is due ${new Date(t.due_at).toUTCString()}`);
      await queryDb(`UPDATE support_tickets SET sla_warned=true WHERE id=$1`, [t.id]).catch(() => {});
      await bumpVersion(verScopes.tickets, verScopes.ticket(t.id));
    }

    // ── SLA breaches (deadline passed) ────────────────────────────────────
    const breached = await queryDb(
      `SELECT * FROM support_tickets
       WHERE status IN ('open','in_progress') AND sla_breached=false AND due_at IS NOT NULL AND due_at < NOW() LIMIT 20`
    );
    for (const t of breached) {
      const key = `PA-${t.id}`;
      await notify(t.assignee_email, 'sla_breach', t.id, `SLA BREACHED on ${key} — please act now`);
      await notify('admin', 'sla_breach', t.id, `SLA breached on ${key} (${t.assignee_email})`);
      await queryDb(`UPDATE support_tickets SET sla_breached=true WHERE id=$1`, [t.id]).catch(() => {});
      await queryDb(
        `INSERT INTO ticket_comments (ticket_id, author_role, author_name, message) VALUES ($1,'system','System',$2)`,
        [t.id, `SLA deadline passed without resolution.`]
      ).catch(() => {});
      await bumpVersion(verScopes.tickets, verScopes.ticket(t.id));
    }
  } catch (err) {
    console.error('[escalation] sweep failed:', err.message);
  }
};
