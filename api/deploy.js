// Deploy controls for the team portal: trigger a Render deploy now, or schedule
// one for later. Access is admin-managed (api/deploy/config): an allow-list of
// team-member emails, plus an optional password gate. Every deploy is logged
// with who triggered it, when, and the commit/PR being deployed. Scheduled
// deploys are fired by sweepDeploys(), invoked on an interval from server.js.
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getMemberSession, hashPassword, verifyPassword } from './_security.js';
import { logAudit } from './_ticketing.js';

// The Render deploy hook. Prefer the env var; fall back to the configured hook
// so deploys work even before the env is set on the host.
const DEPLOY_HOOK = process.env.RENDER_DEPLOY_HOOK
  || 'https://api.render.com/deploy/srv-d7fpe03bc2fs739oqie0?key=PMMpeoiKHOE';

// Render REST API (cancel a running deploy + read its live logs). Needs a
// RENDER_API_KEY; the deploy-hook key alone cannot do either.
const SERVICE_ID = (DEPLOY_HOOK.match(/deploy\/(srv-[a-z0-9]+)/i) || [])[1];
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_OWNER_ID = process.env.RENDER_OWNER_ID;
const renderApi = (path, init = {}) => fetch(`https://api.render.com/v1${path}`, {
  ...init, headers: { Authorization: `Bearer ${RENDER_API_KEY}`, Accept: 'application/json', ...(init.headers || {}) }
});

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

// Load the admin-managed deploy config (allow-list + password).
const loadConfig = async () => {
  try {
    const [row] = await queryDb(`SELECT password_hash, password_salt, allowed_emails FROM deploy_config WHERE id=1`);
    return {
      passwordHash: row?.password_hash || null,
      passwordSalt: row?.password_salt || null,
      allowedEmails: String(row?.allowed_emails || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    };
  } catch { return { passwordHash: null, passwordSalt: null, allowedEmails: [] }; }
};

// Resolve who is acting and whether they may deploy.
const getActor = async (req) => {
  const cfg = await loadConfig();
  if (isAdmin(req)) return { who: 'admin', admin: true, allowed: true, cfg };
  const member = getMemberSession(req);
  if (!member) return { who: null, allowed: false, cfg };
  const email = (member.email || '').toLowerCase();
  return { who: member.email || member.name || 'team_member', email, admin: false, allowed: cfg.allowedEmails.includes(email), cfg };
};

// Best-effort: the latest commit on main (the one a hook deploy will build).
const latestCommit = async () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return {};
  const owner = process.env.GITHUB_OWNER || 'PatienceAIiN';
  const repo = process.env.GITHUB_REPO || 'MAIN-SITE';
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/main`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    });
    if (!r.ok) return {};
    const c = await r.json();
    const msg = (c.commit?.message || '').split('\n')[0];
    const prNum = (msg.match(/#(\d+)/) || [])[1];
    return { sha: (c.sha || '').slice(0, 7), msg: msg.slice(0, 300), pr: prNum ? `#${prNum}` : null };
  } catch { return {}; }
};

const fireDeploy = async () => {
  const r = await fetch(DEPLOY_HOOK, { method: 'POST' });
  if (!r.ok) throw new Error(`Render hook responded ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return j?.deploy?.id || null; // Render returns the new deploy id
};

// Fire any scheduled deploys whose time has arrived. Called from server.js.
export const sweepDeploys = async () => {
  try {
    const due = await queryDb(`SELECT id FROM deploys WHERE status='scheduled' AND run_at <= NOW() ORDER BY run_at ASC`);
    for (const row of due) {
      try {
        const c = await latestCommit();
        const deployId = await fireDeploy();
        await queryDb(`UPDATE deploys SET status='triggered', deploy_id=$2, commit_sha=$3, commit_msg=$4, pr=$5, updated_at=NOW() WHERE id=$1`,
          [row.id, deployId, c.sha || null, c.msg || null, c.pr || null]);
        await logAudit('system', 'scheduler', 'deploy_triggered', `deploy:${row.id}`).catch(() => {});
      } catch (e) {
        await queryDb(`UPDATE deploys SET status='failed', note=$2, updated_at=NOW() WHERE id=$1`, [row.id, e.message]).catch(() => {});
      }
    }
  } catch (e) {
    if (!isMissingTableError(e.message)) console.error('[deploy] sweep error:', e.message);
  }
};

export default async function handler(req, res) {
  const actor = await getActor(req);
  if (!actor.who) return res.status(401).json({ error: 'Not authenticated' });

  // ── Admin-only config: allow-list + password ─────────────────────────────
  if (req.url?.includes('/config')) {
    if (!actor.admin) return res.status(403).json({ error: 'Admin only' });
    if (req.method === 'GET') {
      return res.status(200).json({ allowedEmails: actor.cfg.allowedEmails, passwordSet: Boolean(actor.cfg.passwordHash) });
    }
    if (req.method === 'POST') {
      const { allowedEmails, password, clearPassword } = req.body || {};
      try {
        await queryDb(`INSERT INTO deploy_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
        if (Array.isArray(allowedEmails)) {
          const clean = allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean).join(',');
          await queryDb(`UPDATE deploy_config SET allowed_emails=$1, updated_at=NOW() WHERE id=1`, [clean]);
        }
        if (clearPassword) {
          await queryDb(`UPDATE deploy_config SET password_hash=NULL, password_salt=NULL, updated_at=NOW() WHERE id=1`);
        } else if (password) {
          if (String(password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
          const { salt, hash } = hashPassword(String(password));
          await queryDb(`UPDATE deploy_config SET password_hash=$1, password_salt=$2, updated_at=NOW() WHERE id=1`, [hash, salt]);
        }
        await logAudit('admin', 'admin', 'deploy_config_updated', 'deploy_config').catch(() => {});
        const cfg = await loadConfig();
        return res.status(200).json({ ok: true, allowedEmails: cfg.allowedEmails, passwordSet: Boolean(cfg.passwordHash) });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET /api/deploy/logs?id= — live deployment status + build log lines.
  if (req.method === 'GET' && req.url?.includes('/logs')) {
    const id = parseInt(req.query.id, 10);
    if (!RENDER_API_KEY) return res.status(200).json({ status: null, lines: [], note: 'Set RENDER_API_KEY (and optionally RENDER_OWNER_ID) on the server to stream live Render logs.' });
    try {
      const [row] = id ? await queryDb(`SELECT deploy_id FROM deploys WHERE id=$1`, [id]) : [];
      const deployId = row?.deploy_id;
      if (!deployId) return res.status(200).json({ status: null, lines: [], note: 'No Render deploy id recorded for this entry yet.' });
      const dRes = await renderApi(`/services/${SERVICE_ID}/deploys/${deployId}`);
      const dep = dRes.ok ? await dRes.json() : null;
      const status = dep?.status || dep?.deploy?.status || null;
      let lines = [];
      if (RENDER_OWNER_ID) {
        const q = new URLSearchParams({ ownerId: RENDER_OWNER_ID, resource: SERVICE_ID, limit: '100' });
        const lRes = await renderApi(`/logs?${q}`);
        if (lRes.ok) { const lj = await lRes.json(); lines = (lj?.logs || lj || []).map((l) => `${l.timestamp || ''} ${l.message || l.text || ''}`.trim()); }
      }
      return res.status(200).json({ status, lines, deployId });
    } catch (e) {
      return res.status(200).json({ status: null, lines: [], note: e.message });
    }
  }

  // GET — current schedule + recent history (visible to any authenticated member).
  if (req.method === 'GET') {
    try {
      const scheduled = await queryDb(`SELECT id, triggered_by, run_at, note, created_at FROM deploys WHERE status='scheduled' ORDER BY run_at ASC`);
      const recent = await queryDb(`SELECT id, triggered_by, status, run_at, note, deploy_id, commit_sha, commit_msg, pr, created_at FROM deploys WHERE status<>'scheduled' ORDER BY created_at DESC LIMIT 15`);
      return res.status(200).json({ scheduled, recent, canDeploy: actor.allowed, passwordSet: Boolean(actor.cfg.passwordHash), hasRenderApi: Boolean(RENDER_API_KEY) });
    } catch (e) {
      if (isMissingTableError(e.message)) return res.status(200).json({ scheduled: [], recent: [], canDeploy: actor.allowed, passwordSet: false });
      return res.status(500).json({ error: e.message });
    }
  }

  if (!actor.allowed) return res.status(403).json({ error: 'You are not allowed to deploy. Ask an admin to grant access.' });

  // Password gate (non-admins) when a deploy password is configured.
  const checkPassword = () => {
    if (actor.admin || !actor.cfg.passwordHash) return true;
    const pw = (req.body || {}).password;
    return pw && verifyPassword(String(pw), actor.cfg.passwordSalt, actor.cfg.passwordHash);
  };

  // POST /api/deploy/cancel { id } — cancel a scheduled deploy, or abort a running one.
  if (req.method === 'POST' && req.url?.includes('/cancel')) {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      const [row] = await queryDb(`SELECT status, deploy_id FROM deploys WHERE id=$1`, [id]);
      if (!row) return res.status(404).json({ error: 'Deploy not found' });
      if (row.status === 'scheduled') {
        await queryDb(`UPDATE deploys SET status='cancelled', updated_at=NOW() WHERE id=$1`, [id]);
        return res.status(200).json({ ok: true, message: 'Scheduled deploy cancelled.' });
      }
      // Mark cancelled locally regardless, so the UI reverts immediately.
      await queryDb(`UPDATE deploys SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status='triggered'`, [id]);
      if (!RENDER_API_KEY) return res.status(200).json({ ok: true, message: 'Marked cancelled. Set RENDER_API_KEY to also abort the running Render build.' });
      if (!row.deploy_id) return res.status(200).json({ ok: true, message: 'Marked cancelled (no Render deploy id recorded).' });
      const r = await renderApi(`/services/${SERVICE_ID}/deploys/${row.deploy_id}/cancel`, { method: 'POST' });
      await logAudit('team', actor.who, 'deploy_cancelled', `deploy:${id}`).catch(() => {});
      return res.status(200).json({ ok: true, message: r.ok ? 'Deploy cancelled on Render.' : `Marked cancelled (Render returned ${r.status}).` });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/deploy/schedule — schedule a deploy for later.
  if (req.method === 'POST' && req.url?.includes('/schedule')) {
    if (!checkPassword()) return res.status(401).json({ error: 'Incorrect deploy password' });
    const { runAt, note } = req.body || {};
    const when = runAt ? new Date(runAt) : null;
    if (!when || isNaN(when.getTime())) return res.status(400).json({ error: 'A valid runAt time is required' });
    if (when.getTime() < Date.now() - 60000) return res.status(400).json({ error: 'Scheduled time must be in the future' });
    try {
      const rows = await queryDb(`INSERT INTO deploys (triggered_by, status, run_at, note) VALUES ($1,'scheduled',$2,$3) RETURNING id, run_at, note`,
        [actor.who, when.toISOString(), (note || '').slice(0, 300)]);
      await logAudit('team', actor.who, 'deploy_scheduled', `deploy:${rows[0].id}`).catch(() => {});
      return res.status(200).json({ ok: true, scheduled: rows[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE /api/deploy/schedule?id= — cancel a scheduled deploy.
  if (req.method === 'DELETE') {
    const id = parseInt(req.query.id, 10);
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      await queryDb(`UPDATE deploys SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status='scheduled'`, [id]);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/deploy — trigger an immediate deploy.
  if (req.method === 'POST') {
    if (!checkPassword()) return res.status(401).json({ error: 'Incorrect deploy password' });
    try {
      const c = await latestCommit();
      const rows = await queryDb(`INSERT INTO deploys (triggered_by, status, note, commit_sha, commit_msg, pr) VALUES ($1,'triggered','manual',$2,$3,$4) RETURNING id`,
        [actor.who, c.sha || null, c.msg || null, c.pr || null]);
      const deployId = await fireDeploy();
      await queryDb(`UPDATE deploys SET deploy_id=$2 WHERE id=$1`, [rows[0].id, deployId]).catch(() => {});
      await logAudit('team', actor.who, 'deploy_triggered', `deploy:${rows[0].id}${c.sha ? ` @${c.sha}` : ''}`).catch(() => {});
      return res.status(200).json({ ok: true, id: rows[0].id, deployId, commit: c, message: 'Deploy triggered on Render.' });
    } catch (e) {
      return res.status(502).json({ error: `Deploy failed: ${e.message}` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
