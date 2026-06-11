// PatienceAI platform regression suite.
// Run: npm test   (requires the server running on TEST_BASE, default :3100,
// with a reachable DATABASE_URL — the suite creates and removes its own data.)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.loadEnvFile?.();
const BASE = process.env.TEST_BASE || 'http://localhost:3100';
const PASS = 'SuiteTest1234';

const jars = {}; // name -> cookie string
const api = async (path, { method = 'GET', body, jar, raw } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...(raw ? { 'Content-Type': 'application/octet-stream' } : {}),
      ...(jar && jars[jar] ? { Cookie: jars[jar] } : {})
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  const setCookie = res.headers.get('set-cookie');
  if (jar && setCookie) jars[jar] = setCookie.split(';')[0];
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data, headers: res.headers };
};

const { queryDb } = await import('../api/_db.js');
const cleanup = async () => {
  await queryDb(`DELETE FROM support_tickets WHERE subject LIKE 'SUITE:%'`);
  await queryDb(`DELETE FROM team_chats WHERE created_by LIKE 'suite-%@patienceai.in'`).catch(() => {});
  await queryDb(`DELETE FROM team_members WHERE email LIKE 'suite-%@patienceai.in'`);
  await queryDb(`DELETE FROM support_executives WHERE email LIKE 'suite-%@patienceai.in'`);
  await queryDb(`DELETE FROM sprints WHERE name LIKE 'SUITE:%'`);
  await queryDb(`DELETE FROM incidents WHERE title LIKE 'SUITE:%'`);
  await queryDb(`DELETE FROM notifications WHERE message LIKE '%SUITE:%'`);
};

const inviteMember = async (email, name, teamRole) => {
  await api('/api/team-members', { method: 'POST', jar: 'admin', body: { email, name, teamRole } });
  const [row] = await queryDb(`SELECT invite_token FROM team_members WHERE email=$1`, [email]);
  const act = await api('/api/team-members/activate', { method: 'POST', body: { token: row.invite_token, password: PASS } });
  assert.equal(act.status, 200, `activate ${email}`);
  const login = await api('/api/team-members/login', { method: 'POST', jar: email, body: { email, password: PASS } });
  assert.equal(login.status, 200, `login ${email}`);
};

let ticketId;

before(async () => {
  await cleanup();
  // admin login
  const r = await api('/api/auth', { method: 'POST', jar: 'admin', body: { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD } });
  assert.equal(r.data?.authenticated, true, 'admin login');
  // executive (immediate activation)
  const ex = await api('/api/support-executives', { method: 'POST', jar: 'admin', body: { name: 'Suite Exec', email: 'suite-exec@patienceai.in', activateImmediately: true } });
  const le = await api('/api/support-executives/login', { method: 'POST', jar: 'exec', body: { email: 'suite-exec@patienceai.in', password: ex.data.generatedPassword } });
  assert.equal(le.status, 200, 'exec login');
  // role members
  await inviteMember('suite-pm@patienceai.in', 'Suite PM', 'product_manager');
  await inviteMember('suite-lead@patienceai.in', 'Suite Lead', 'team_lead');
  await inviteMember('suite-dev@patienceai.in', 'Suite Dev', 'software_dev');
  await inviteMember('suite-qa@patienceai.in', 'Suite QA', 'qa');
});

after(async () => { await cleanup(); });

test('unauthenticated requests are rejected', async () => {
  assert.equal((await api('/api/tickets')).status, 401);
  assert.equal((await api('/api/peos?resource=sprints')).status, 401);
  assert.equal((await api('/api/dev-workflow')).status, 401);
});

test('ticket creation enforces @patienceai.in assignment', async () => {
  const bad = await api('/api/tickets', { method: 'POST', jar: 'exec', body: { subject: 'SUITE: bad', assigneeEmail: 'x@gmail.com' } });
  assert.equal(bad.status, 400);
});

test('ticket lifecycle: create → comment → internal note → status', async () => {
  const r = await api('/api/tickets', {
    method: 'POST', jar: 'exec',
    body: { subject: 'SUITE: checkout bug', description: 'cart total wrong', priority: 'high', category: 'Bug Report', assigneeEmail: 'suite-dev@patienceai.in' }
  });
  assert.equal(r.status, 200);
  ticketId = Number(r.data.ticket.id);
  assert.ok(r.data.ticket.due_at, 'SLA due_at stamped');
  assert.equal(r.data.ticket.priority, 'high');

  const c = await api('/api/tickets/comments', { method: 'POST', jar: 'exec', body: { ticketId, message: 'public note' } });
  assert.equal(c.status, 200);
  const n = await api('/api/tickets/comments', { method: 'POST', jar: 'exec', body: { ticketId, message: 'secret SUITE: internal', isInternal: true } });
  assert.equal(n.data.comment.is_internal, true);

  const up = await api('/api/tickets', { method: 'PATCH', jar: 'exec', body: { id: ticketId, status: 'in_progress' } });
  assert.equal(up.data.ticket.status, 'in_progress');
});

test('duplicate detection surfaces similar open tickets', async () => {
  const r = await api('/api/tickets', {
    method: 'POST', jar: 'exec',
    body: { subject: 'SUITE: checkout bug again', priority: 'low', assigneeEmail: 'suite-dev@patienceai.in' }
  });
  assert.ok(r.data.similar?.some((s) => Number(s.key.replace('PA-', '')) === ticketId), 'similar ticket detected');
});

test('member scoping: dev sees only own tickets; cannot reassign', async () => {
  const list = await api('/api/tickets', { jar: 'suite-dev@patienceai.in' });
  assert.ok(list.data.tickets.every((t) => t.assignee_email === 'suite-dev@patienceai.in'));
  const re = await api('/api/tickets', { method: 'PATCH', jar: 'suite-dev@patienceai.in', body: { id: ticketId, assigneeEmail: 'suite-qa@patienceai.in' } });
  assert.equal(re.status, 403);
});

test('client portal: privacy + reply + wrong email rejected', async () => {
  // attach client email so the portal works
  await queryDb(`UPDATE support_tickets SET customer_email='client@example.com', customer_name='Client' WHERE id=$1`, [ticketId]);
  const wrong = await api(`/api/client-tickets?key=PA-${ticketId}&email=wrong@x.com`);
  assert.equal(wrong.status, 404);
  const ok = await api(`/api/client-tickets?key=PA-${ticketId}&email=client@example.com`);
  assert.equal(ok.status, 200);
  assert.ok(!JSON.stringify(ok.data.comments).includes('secret SUITE: internal'), 'internal note hidden from client');
  assert.ok(ok.data.comments.every((c) => !['Suite Exec', 'Suite Dev'].includes(c.author_name)), 'staff names hidden');
  const reply = await api('/api/client-tickets', { method: 'POST', body: { key: `PA-${ticketId}`, email: 'client@example.com', message: 'thanks SUITE:' } });
  assert.equal(reply.status, 200);
});

test('dev workflow: full ladder with role gates and QA reject loop', async () => {
  const act = (jar, action, extra = {}) => api('/api/dev-workflow', { method: 'POST', jar, body: { ticketId, action, ...extra } });
  assert.equal((await act('exec', 'escalate')).data.ticket.stage, 'pm_review');
  // wrong role blocked
  assert.equal((await act('suite-dev@patienceai.in', 'pm_approve')).status, 403);
  // PM approve routes to EM review when an EM exists, else straight to lead triage.
  let stage = (await act('suite-pm@patienceai.in', 'pm_approve')).data.ticket.stage;
  assert.ok(['em_review', 'lead_triage'].includes(stage), `unexpected stage ${stage}`);
  if (stage === 'em_review') stage = (await act('admin', 'em_approve')).data.ticket.stage; // admin may act for any role
  assert.equal(stage, 'lead_triage');
  assert.equal((await act('suite-lead@patienceai.in', 'lead_assign', { assigneeEmail: 'suite-dev@patienceai.in' })).data.ticket.stage, 'dev');
  assert.equal((await act('suite-dev@patienceai.in', 'dev_complete')).data.ticket.stage, 'qa');
  // QA reject requires comment
  assert.equal((await act('suite-qa@patienceai.in', 'qa_reject')).status, 400);
  assert.equal((await act('suite-qa@patienceai.in', 'qa_reject', { comment: 'edge case' })).data.ticket.stage, 'dev');
  assert.equal((await act('suite-dev@patienceai.in', 'dev_complete')).data.ticket.stage, 'qa');
  const done = await act('suite-qa@patienceai.in', 'qa_approve');
  assert.equal(done.data.ticket.stage, 'done');
  assert.equal(done.data.ticket.status, 'resolved');
});

test('PEOS RBAC: dev blocked from sprints, lead allowed; managers delete', async () => {
  const devTry = await api('/api/peos?resource=sprints', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { name: 'SUITE: nope' } });
  assert.equal(devTry.status, 403);
  const lead = await api('/api/peos?resource=sprints', { method: 'POST', jar: 'suite-lead@patienceai.in', body: { name: 'SUITE: sprint', status: 'active' } });
  assert.equal(lead.status, 200);
  const del = await api('/api/peos?resource=sprints', { method: 'DELETE', jar: 'suite-pm@patienceai.in', body: { id: lead.data.item.id } });
  assert.equal(del.status, 200);
  const devDel = await api('/api/peos?resource=incidents', { method: 'DELETE', jar: 'suite-dev@patienceai.in', body: { id: 1 } });
  assert.equal(devDel.status, 403);
});

test('permissions: explicit empty set blocks GitHub; QA read-only', async () => {
  const qaWrite = await api('/api/github?repo=MAIN-SITE', { method: 'POST', jar: 'suite-qa@patienceai.in', body: { action: 'create_branch', branch: 'x' } });
  assert.equal(qaWrite.status, 403);
  const [dev] = await queryDb(`SELECT id FROM team_members WHERE email='suite-dev@patienceai.in'`);
  await api('/api/team-members', { method: 'PATCH', jar: 'admin', body: { id: dev.id, permissions: [] } });
  const blocked = await api('/api/github?repos=1', { jar: 'suite-dev@patienceai.in' });
  assert.equal(blocked.status, 403);
  await api('/api/team-members', { method: 'PATCH', jar: 'admin', body: { id: dev.id, permissions: ['github_read'] } });
});

test('notifications, settings, dashboard, search respond correctly', async () => {
  const n = await api('/api/notifications', { jar: 'suite-dev@patienceai.in' });
  assert.ok(Array.isArray(n.data.notifications));
  const s = await api('/api/ticket-settings', { jar: 'exec' });
  assert.equal(s.data.slas.find((x) => x.priority === 'urgent')?.hours > 0, true);
  const d = await api('/api/peos?dashboard=1&resource=epics', { jar: 'exec' });
  assert.ok(d.data.health >= 0 && d.data.health <= 100);
  const u = await api('/api/peos?search=SUITE&resource=epics', { jar: 'exec' });
  assert.ok(u.data.results.some((x) => x.kind === 'ticket'));
});

test('attachments: upload, list, oversize rejected', async () => {
  const up = await api(`/api/attachments/upload?ticketId=${ticketId}&fileName=suite.txt`, { method: 'POST', jar: 'exec', body: Buffer.from('suite file'), raw: true });
  assert.equal(up.status, 200);
  const list = await api(`/api/attachments?ticketId=${ticketId}`, { jar: 'exec' });
  assert.ok(list.data.attachments.some((a) => a.file_name === 'suite.txt'));
  const big = await api(`/api/attachments/upload?ticketId=${ticketId}&fileName=big.bin`, { method: 'POST', jar: 'exec', body: Buffer.alloc(11 * 1024 * 1024), raw: true });
  assert.equal(big.status, 413);
});

test('password strength + change-password guard', async () => {
  const weak = await api('/api/team-members/change-password', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { currentPassword: PASS, newPassword: 'abcdefgh' } });
  assert.equal(weak.status, 400);
  const wrongCur = await api('/api/team-members/change-password', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { currentPassword: 'nope', newPassword: 'Valid1234' } });
  assert.equal(wrongCur.status, 401);
});

test('CSAT: client rates a resolved ticket; invalid ratings rejected', async () => {
  const bad = await api('/api/client-tickets', { method: 'POST', body: { key: `PA-${ticketId}`, email: 'client@example.com', action: 'rate', rating: 9 } });
  assert.equal(bad.status, 400);
  const ok = await api('/api/client-tickets', { method: 'POST', body: { key: `PA-${ticketId}`, email: 'client@example.com', action: 'rate', rating: 5 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.ticket.csat, 5);
  const stats = await api('/api/ticket-stats', { jar: 'admin' });
  assert.ok(Number(stats.data.totals.avg_csat) >= 1, 'avg CSAT computed');
});

test('sprint board returns burndown inputs (dates + resolved_at)', async () => {
  const sp = await api('/api/peos?resource=sprints', { method: 'POST', jar: 'suite-pm@patienceai.in', body: { name: 'SUITE: bd', status: 'active', starts_on: '2026-06-01', ends_on: '2026-06-14', capacity_points: 10 } });
  await api(`/api/peos?ticket=PA-${ticketId}&resource=epics`, { method: 'PATCH', jar: 'admin', body: { sprintId: sp.data.item.id, storyPoints: 3 } });
  const board = await api(`/api/peos?sprintBoard=${sp.data.item.id}&resource=epics`, { jar: 'admin' });
  assert.equal(board.data.sprint.name, 'SUITE: bd');
  assert.ok(board.data.tickets[0].resolved_at, 'resolved_at present for burndown');
  await api('/api/peos?resource=sprints', { method: 'DELETE', jar: 'admin', body: { id: sp.data.item.id } });
});

test('openapi contract served', async () => {
  const r = await api('/api/openapi.json');
  assert.equal(r.data.openapi, '3.0.3');
  assert.ok(r.data.paths['/api/dev-workflow']);
});

test('colleagues: roster, dm + group chat CRUD, message edit/delete, pagination', async () => {
  // roster excludes self, includes presence field
  const roster = await api('/api/colleagues?list=1', { jar: 'suite-dev@patienceai.in' });
  assert.equal(roster.status, 200);
  assert.ok(roster.data.colleagues.every((c) => c.email !== 'suite-dev@patienceai.in'));
  assert.ok(roster.data.colleagues.some((c) => c.email === 'suite-qa@patienceai.in'));
  assert.ok(['online', 'away', 'offline'].includes(roster.data.colleagues[0].presence));

  // dm create is idempotent (same chat returned twice)
  const dm1 = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'create_chat', kind: 'dm', memberEmails: ['suite-qa@patienceai.in'] } });
  assert.equal(dm1.status, 200);
  const dm2 = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'create_chat', kind: 'dm', memberEmails: ['suite-qa@patienceai.in'] } });
  assert.equal(dm2.data.chat.id, dm1.data.chat.id);

  // send → edit → delete a message; non-author cannot edit
  const sent = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'send', chatId: dm1.data.chat.id, message: 'SUITE: hello' } });
  assert.equal(sent.status, 200);
  const edited = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'edit_message', id: sent.data.message.id, message: 'SUITE: hello v2' } });
  assert.equal(edited.data.message.edited, true);
  const foreign = await api('/api/colleagues', { method: 'POST', jar: 'suite-qa@patienceai.in', body: { action: 'edit_message', id: sent.data.message.id, message: 'hax' } });
  assert.equal(foreign.status, 403);
  const del = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'delete_message', id: sent.data.message.id } });
  assert.equal(del.data.message.deleted, true);

  // history pagination shape + membership privacy (PM not in dm)
  const hist = await api(`/api/colleagues?messages=${dm1.data.chat.id}`, { jar: 'suite-qa@patienceai.in' });
  assert.ok(Array.isArray(hist.data.messages));
  const spy = await api(`/api/colleagues?messages=${dm1.data.chat.id}`, { jar: 'suite-pm@patienceai.in' });
  assert.equal(spy.status, 404);

  // group chat: create, rename, both members listed, delete
  const grp = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'create_chat', kind: 'group', name: 'SUITE group', memberEmails: ['suite-qa@patienceai.in', 'suite-pm@patienceai.in'] } });
  assert.equal(grp.data.chat.kind, 'group');
  const ren = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'update_chat', chatId: grp.data.chat.id, name: 'SUITE group v2' } });
  assert.equal(ren.data.chat.name, 'SUITE group v2');
  const chats = await api('/api/colleagues?chats=1', { jar: 'suite-pm@patienceai.in' });
  assert.ok(chats.data.chats.some((c) => c.id === grp.data.chat.id));
  const gone = await api('/api/colleagues', { method: 'DELETE', jar: 'suite-qa@patienceai.in', body: { chatId: grp.data.chat.id } });
  assert.equal(gone.status, 200);
  await api('/api/colleagues', { method: 'DELETE', jar: 'suite-dev@patienceai.in', body: { chatId: dm1.data.chat.id } });
});

test('colleagues: settings toggle + vapid key + unauthenticated rejected', async () => {
  assert.equal((await api('/api/colleagues?list=1')).status, 401);
  const off = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'settings', notificationsEnabled: false } });
  assert.equal(off.data.notificationsEnabled, false);
  const me = await api('/api/team-members/me', { jar: 'suite-dev@patienceai.in' });
  assert.equal(me.data.member.notificationsEnabled, false);
  await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'settings', notificationsEnabled: true } });
  const vap = await api('/api/colleagues?vapid=1', { jar: 'suite-dev@patienceai.in' });
  assert.ok(typeof vap.data.key === 'string' && vap.data.key.length > 20, 'vapid public key served');
});

test('github repo grants: members see only admin-granted repos', async () => {
  const [dev] = await queryDb(`SELECT id FROM team_members WHERE email='suite-dev@patienceai.in'`);
  // no grants → repo-scoped reads are forbidden even with github_read
  const ungranted = await api('/api/github?branches=1&owner=someorg&repo=somerepo', { jar: 'suite-dev@patienceai.in' });
  assert.equal(ungranted.status, 403);
  // grant a repo → that owner/repo passes the gate (may 503 without GITHUB_TOKEN, but never 403)
  await api('/api/team-members', { method: 'PATCH', jar: 'admin', body: { id: dev.id, allowedRepos: ['someorg/somerepo'] } });
  const granted = await api('/api/github?branches=1&owner=someorg&repo=somerepo', { jar: 'suite-dev@patienceai.in' });
  assert.notEqual(granted.status, 403);
  await api('/api/team-members', { method: 'PATCH', jar: 'admin', body: { id: dev.id, allowedRepos: [] } });
});

test('colleagues: file upload, preview fetch, privacy, oversize rejected', async () => {
  const dm = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'create_chat', kind: 'dm', memberEmails: ['suite-qa@patienceai.in'] } });
  const up = await api(`/api/colleagues/upload?chatId=${dm.data.chat.id}&fileName=suite.png`, { method: 'POST', jar: 'suite-dev@patienceai.in', body: Buffer.from('suite-img-bytes'), raw: true });
  assert.equal(up.status, 200);
  assert.equal(up.data.message.file_name, 'suite.png');
  const f = await fetch(`${BASE}/api/colleagues?file=${up.data.message.id}`, { headers: { Cookie: jars['suite-qa@patienceai.in'] } });
  assert.equal(f.status, 200);
  assert.equal(await f.text(), 'suite-img-bytes');
  const spy = await api(`/api/colleagues?file=${up.data.message.id}`, { jar: 'suite-pm@patienceai.in' });
  assert.equal(spy.status, 404);
  const big = await api(`/api/colleagues/upload?chatId=${dm.data.chat.id}&fileName=big.bin`, { method: 'POST', jar: 'suite-dev@patienceai.in', body: Buffer.alloc(11 * 1024 * 1024), raw: true });
  assert.equal(big.status, 413);
  await api('/api/colleagues', { method: 'DELETE', jar: 'suite-dev@patienceai.in', body: { chatId: dm.data.chat.id } });
});

test('colleagues: reply-to works in dm and group chats', async () => {
  const dm = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'create_chat', kind: 'dm', memberEmails: ['suite-qa@patienceai.in'] } });
  const m1 = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'send', chatId: dm.data.chat.id, message: 'SUITE: original' } });
  const m2 = await api('/api/colleagues', { method: 'POST', jar: 'suite-qa@patienceai.in', body: { action: 'send', chatId: dm.data.chat.id, message: 'SUITE: reply', replyTo: m1.data.message.id } });
  assert.equal(Number(m2.data.message.reply_to), Number(m1.data.message.id));
  assert.equal(m2.data.message.reply_text, 'SUITE: original');
  const grp = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'create_chat', kind: 'group', name: 'SUITE rg', memberEmails: ['suite-qa@patienceai.in', 'suite-pm@patienceai.in'] } });
  const g1 = await api('/api/colleagues', { method: 'POST', jar: 'suite-pm@patienceai.in', body: { action: 'send', chatId: grp.data.chat.id, message: 'SUITE: g-orig' } });
  const g2 = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'send', chatId: grp.data.chat.id, message: 'SUITE: g-reply', replyTo: g1.data.message.id } });
  assert.equal(g2.data.message.reply_name, 'Suite PM');
  // replying to a message from another chat is ignored (no cross-chat leak)
  const x = await api('/api/colleagues', { method: 'POST', jar: 'suite-dev@patienceai.in', body: { action: 'send', chatId: dm.data.chat.id, message: 'SUITE: x', replyTo: g1.data.message.id } });
  assert.equal(x.data.message.reply_to, null);
  await api('/api/colleagues', { method: 'DELETE', jar: 'suite-dev@patienceai.in', body: { chatId: dm.data.chat.id } });
  await api('/api/colleagues', { method: 'DELETE', jar: 'suite-dev@patienceai.in', body: { chatId: grp.data.chat.id } });
});
