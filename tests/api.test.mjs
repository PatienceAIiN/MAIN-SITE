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
