// One-off launch broadcast: notify ALL confirmed newsletter subscribers about Barrister.
// Honors EMAIL_TEST_REDIRECT (set in .env) — in dev every message routes to the test inbox.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

const { queryDb } = await import('../api/_db.js');
const { sendEmail } = await import('../api/_email.js');

const siteUrl = (process.env.SITE_URL || 'https://patienceai.in').replace(/\/$/, '');
const productUrl = 'https://barrister.patienceai.in';

const footer = (token) => {
  const unsub = `${siteUrl}/api/newsletter?action=unsubscribe&token=${encodeURIComponent(token)}`;
  return {
    html: `<hr style="margin-top:32px;border:none;border-top:1px solid #eee"><p style="font-size:11px;color:#888;text-align:center;margin-top:16px">You're receiving this because you subscribed to Patience AI updates.<br><a href="${unsub}" style="color:#888;text-decoration:underline">Unsubscribe</a></p>`,
    text: `\n\nUnsubscribe: ${unsub}`
  };
};

const subject = 'New launch: Barrister — case management for law firms';

const bodyHtml = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
    <p style="display:inline-block;background:#10b981;color:#fff;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:5px 12px;border-radius:9999px;margin:0 0 16px">● Live</p>
    <h2 style="margin:0 0 12px">Introducing Barrister</h2>
    <p style="font-size:16px;line-height:1.6;color:#444">Case management built for law firms. Barrister brings case tracking, document management, payment recording, automated court reminders, and dual admin/advocate portals into a single secure portal — so firms spend less time on paperwork and more time on clients.</p>
    <ul style="font-size:15px;line-height:1.7;color:#444;padding-left:20px">
      <li>Full case lifecycle tracking — status, court details, hearing dates, fees, and advocate assignment.</li>
      <li>Dual portals: a full-control admin portal and a focused advocate portal.</li>
      <li>Per-case document management with secure uploads and access auditing.</li>
      <li>Payment tracking (cash, cheque, NEFT, UPI, card, DD) with auto-generated receipts.</li>
      <li>Automated court-appearance reminders and PDF case/receipt documents.</li>
    </ul>
    <p style="margin:28px 0">
      <a href="${productUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:13px 24px;border-radius:9999px;text-decoration:none;font-weight:600">Explore Barrister →</a>
    </p>
    <p style="font-size:13px;color:#888">It's live now at <a href="${productUrl}" style="color:#1a1a1a">barrister.patienceai.in</a>.</p>
  </div>`;

const bodyText = `Introducing Barrister — case management built for law firms.\n\nCase tracking, document management, payment recording, automated court reminders, and dual admin/advocate portals in one secure portal.\n\nIt's live now: ${productUrl}`;

const rows = await queryDb(
  `SELECT email, unsubscribe_token FROM public.newsletter_subscriptions WHERE confirmed_at IS NOT NULL`
);

console.log(`Confirmed subscribers: ${rows.length}`);
if (process.env.EMAIL_TEST_REDIRECT) {
  console.log(`EMAIL_TEST_REDIRECT active -> all mail routes to ${process.env.EMAIL_TEST_REDIRECT}`);
}

let sent = 0;
const failed = [];
for (const row of rows) {
  const f = footer(row.unsubscribe_token);
  try {
    await sendEmail({ to: row.email, subject, html: bodyHtml + f.html, text: bodyText + f.text });
    sent += 1;
  } catch (e) {
    failed.push(row.email);
    console.error('[broadcast]', row.email, e.message);
  }
}

console.log(`Done. sent=${sent} failed=${failed.length}`);
if (failed.length) console.log('failed:', failed.join(', '));
process.exit(0);
