// TEMPORARY admin-only maintenance endpoint. Wipes all ticket + conversation +
// chat data. Guarded by the admin session AND an explicit confirm token.
// Removed again right after the one-time cleanup.
import { queryDb } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';
import { logAudit } from './_ticketing.js';

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

// Children first conceptually, but CASCADE + a full list handles FK order.
const TABLES = [
  'support_chats', 'support_sessions', 'voice_rooms', 'chat_transfers',
  'executive_internal_messages', 'team_chat_files', 'team_chat_messages', 'team_chats',
  'ticket_github_links', 'qa_test_cases', 'ticket_attachments', 'ticket_escalations',
  'ticket_comments', 'notifications', 'support_tickets'
];

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if ((req.body || {}).confirm !== 'ERASE-ALL') {
    return res.status(400).json({ error: 'Pass {"confirm":"ERASE-ALL"} to wipe tickets, conversations and chats.' });
  }
  try {
    await queryDb(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    await logAudit('admin', 'admin', 'data_wiped', 'tickets+conversations+chats').catch(() => {});
    return res.status(200).json({ ok: true, wiped: TABLES });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
