// Shared helpers for the ticketing system: audit trail, in-app notifications,
// SLA policy lookup and seed data. All writes are best-effort — a failed audit
// or notification must never fail the user-facing request.
import { queryDb } from './_db.js';
import { invalidate, cacheKeys } from './_cache.js';

export const DEFAULT_SLA_HOURS = { urgent: 4, high: 12, medium: 24, low: 72 };

export const DEFAULT_CATEGORIES = [
  'Technical Issue', 'Billing', 'Account Access', 'Feature Request',
  'Bug Report', 'General Inquiry', 'Other'
];

export const DEFAULT_SAVED_RESPONSES = [
  { label: 'Greeting', kind: 'greeting', body: 'Hi! Thanks for reaching out. I have picked up your ticket and will get back to you shortly.' },
  { label: 'Follow-up', kind: 'followup', body: 'Just following up on this ticket — could you share any additional details so we can move forward?' },
  { label: 'Resolution', kind: 'resolution', body: 'This issue has been resolved. Please let us know if anything else comes up — happy to help!' }
];

export const logAudit = async (actorRole, actorEmail, action, target = null, metadata = null) => {
  try {
    await queryDb(
      `INSERT INTO audit_logs (actor_role, actor_email, action, target, metadata) VALUES ($1,$2,$3,$4,$5)`,
      [actorRole, actorEmail, action, target, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error('[audit] log failed:', err.message);
  }
};

// recipientEmail 'admin' is a pseudo-address for the admin notification feed.
export const notify = async (recipientEmail, type, ticketId, message) => {
  if (!recipientEmail) return;
  try {
    await queryDb(
      `INSERT INTO notifications (recipient_email, type, ticket_id, message) VALUES ($1,$2,$3,$4)`,
      [String(recipientEmail).toLowerCase(), type, ticketId, message]
    );
    await invalidate(cacheKeys.notifications(String(recipientEmail).toLowerCase()));
  } catch (err) {
    console.error('[notify] failed:', err.message);
  }
};

export const getSlaHours = async (priority) => {
  try {
    const rows = await queryDb(`SELECT hours FROM sla_policies WHERE priority=$1 LIMIT 1`, [priority]);
    if (rows[0]?.hours) return Number(rows[0].hours);
  } catch { /* fall through to defaults */ }
  return DEFAULT_SLA_HOURS[priority] || 24;
};

let seeded = false;
export const ensureTicketingSeeds = async () => {
  if (seeded) return;
  try {
    const cats = await queryDb(`SELECT count(*)::int AS n FROM ticket_categories`);
    if (!cats[0]?.n) {
      for (const name of DEFAULT_CATEGORIES) {
        await queryDb(`INSERT INTO ticket_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
      }
    }
    const slas = await queryDb(`SELECT count(*)::int AS n FROM sla_policies`);
    if (!slas[0]?.n) {
      for (const [priority, hours] of Object.entries(DEFAULT_SLA_HOURS)) {
        await queryDb(`INSERT INTO sla_policies (priority, hours) VALUES ($1,$2) ON CONFLICT (priority) DO NOTHING`, [priority, hours]);
      }
    }
    const resp = await queryDb(`SELECT count(*)::int AS n FROM saved_responses`);
    if (!resp[0]?.n) {
      for (const r of DEFAULT_SAVED_RESPONSES) {
        await queryDb(`INSERT INTO saved_responses (label, body, kind) VALUES ($1,$2,$3)`, [r.label, r.body, r.kind]);
      }
    }
    seeded = true;
  } catch (err) {
    console.error('[ticketing] seed failed:', err.message);
  }
};

// Mentions: "@First Last" or "@name" — match against executives + team members.
// Returns notified emails. Creates a notification + audit entry per mention.
export const handleMentions = async (message, ticketId, ticketKey, authorName) => {
  const raw = String(message).match(/@([\w.+-]+(?:\s[A-Z][\w-]*)?)/g);
  if (!raw?.length) return [];
  try {
    const people = await queryDb(
      `SELECT email, name FROM team_members WHERE status='active'
       UNION SELECT email, name FROM support_executives WHERE status='active'`
    );
    const notified = [];
    for (const token of new Set(raw.map((m) => m.slice(1).toLowerCase()))) {
      const person = people.find((p) =>
        p.name?.toLowerCase() === token || p.email.split('@')[0] === token.split(' ')[0]
      ) || people.find((p) => p.name?.toLowerCase().startsWith(token.split(' ')[0]));
      if (person && !notified.includes(person.email)) {
        notified.push(person.email);
        await notify(person.email, 'mention', ticketId, `${authorName} mentioned you on ${ticketKey}`);
        await logAudit('system', null, 'mention', ticketKey, { mentioned: person.email, by: authorName });
      }
    }
    return notified;
  } catch {
    return [];
  }
};
