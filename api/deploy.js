// Deploy controls for the team portal: trigger a Render deploy now, or schedule
// one for later. Available to every team role EXCEPT QA and Software Developers
// (and to the admin session). Scheduled deploys are fired by sweepDeploys(),
// invoked on an interval from server.js.
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getMemberSession } from './_security.js';
import { logAudit } from './_ticketing.js';

// The Render deploy hook. Prefer the env var; fall back to the configured hook
// so deploys work even before the env is set on the host.
const DEPLOY_HOOK = process.env.RENDER_DEPLOY_HOOK
  || 'https://api.render.com/deploy/srv-d7fpe03bc2fs739oqie0?key=PMMpeoiKHOE';

const BLOCKED_ROLES = ['qa', 'software_dev'];

// Render REST API (for cancelling a running deploy + reading its live logs).
// Needs a RENDER_API_KEY; the deploy-hook key alone cannot do either.
const SERVICE_ID = (DEPLOY_HOOK.match(/deploy\/(srv-[a-z0-9]+)/i) || [])[1];
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_OWNER_ID = process.env.RENDER_OWNER_ID;
const renderApi = (path, init = {}) => fetch(`https://api.render.com/v1${path}`, {
  ...init, headers: { Authorization: `Bearer ${RENDER_API_KEY}`, Accept: 'application/json', ...(init.headers || {}) }
});

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

// Resolve who is acting and whether they may deploy. Returns { who, allowed }.
const getActor = async (req) => {
  if (isAdmin(req)) return { who: 'admin', allowed: true };
  const member = getMemberSession(req);
  if (!member) return { who: null, allowed: false };
  let role = 'member';
  try {
    const rows = await queryDb(`SELECT team_role FROM team_members WHERE id=$1`, [member.id]);
    role = rows[0]?.team_role || 'member';
  } catch { /* default role */ }
  return { who: member.email || member.name || 'team_member', role, allowed: !BLOCKED_ROLES.includes(role) };
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
    const due = await queryDb(
      `SELECT id FROM deploys WHERE status='scheduled' AND run_at <= NOW() ORDER BY run_at ASC`
    );
    for (const row of due) {
      try {
        const deployId = await fireDeploy();
        await queryDb(`UPDATE deploys SET status='triggered', deploy_id=$2, updated_at=NOW() WHERE id=$1`, [row.id, deployId]);
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

  // GET /api/deploy/logs?id= — live deployment status + build log lines from Render.
  if (req.method === 'GET' && req.url?.includes('/logs')) {
    const id = parseInt(req.query.id, 10);
    if (!RENDER_API_KEY) return res.status(200).json({ status: null, lines: [], note: 'Set RENDER_API_KEY (and optionally RENDER_OWNER_ID) on the server to stream live Render logs.' });
    try {
      const [row] = id ? await queryDb(`SELECT deploy_id FROM deploys WHERE id=$1`, [id]) : [];
      const deployId = row?.deploy_id;
      if (!deployId) return res.status(200).json({ status: null, lines: [], note: 'No Render deploy id recorded for this entry yet.' });
      // Deploy status (build → update → live/failed).
      const dRes = await renderApi(`/services/${SERVICE_ID}/deploys/${deployId}`);
      const dep = dRes.ok ? await dRes.json() : null;
      const status = dep?.status || dep?.deploy?.status || null;
      // Best-effort log lines (requires owner id).
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
      const scheduled = await queryDb(
        `SELECT id, triggered_by, run_at, note, created_at FROM deploys WHERE status='scheduled' ORDER BY run_at ASC`
      );
      const recent = await queryDb(
        `SELECT id, triggered_by, status, run_at, note, deploy_id, created_at FROM deploys WHERE status<>'scheduled' ORDER BY created_at DESC LIMIT 10`
      );
      return res.status(200).json({ scheduled, recent, canDeploy: actor.allowed, hasRenderApi: Boolean(RENDER_API_KEY) });
    } catch (e) {
      if (isMissingTableError(e.message)) return res.status(200).json({ scheduled: [], recent: [], canDeploy: actor.allowed });
      return res.status(500).json({ error: e.message });
    }
  }

  if (!actor.allowed) {
    return res.status(403).json({ error: 'Your role is not permitted to deploy.' });
  }

  // POST /api/deploy/schedule — schedule a deploy for later.
  if (req.method === 'POST' && req.url?.includes('/schedule')) {
    const { runAt, note } = req.body || {};
    const when = runAt ? new Date(runAt) : null;
    if (!when || isNaN(when.getTime())) return res.status(400).json({ error: 'A valid runAt time is required' });
    if (when.getTime() < Date.now() - 60000) return res.status(400).json({ error: 'Scheduled time must be in the future' });
    try {
      const rows = await queryDb(
        `INSERT INTO deploys (triggered_by, status, run_at, note) VALUES ($1,'scheduled',$2,$3) RETURNING id, run_at, note`,
        [actor.who, when.toISOString(), (note || '').slice(0, 300)]
      );
      await logAudit('team', actor.who, 'deploy_scheduled', `deploy:${rows[0].id}`).catch(() => {});
      return res.status(200).json({ ok: true, scheduled: rows[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/deploy/cancel { id } — cancel a scheduled deploy, or abort a
  // running Render deploy (the latter needs RENDER_API_KEY).
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
      if (!RENDER_API_KEY) return res.status(400).json({ error: 'Set RENDER_API_KEY on the server to cancel a running deploy.' });
      if (!row.deploy_id) return res.status(400).json({ error: 'No Render deploy id recorded for this deploy.' });
      const r = await renderApi(`/services/${SERVICE_ID}/deploys/${row.deploy_id}/cancel`, { method: 'POST' });
      if (!r.ok) return res.status(502).json({ error: `Render cancel failed (${r.status}).` });
      await queryDb(`UPDATE deploys SET status='cancelled', updated_at=NOW() WHERE id=$1`, [id]);
      await logAudit('team', actor.who, 'deploy_cancelled', `deploy:${id}`).catch(() => {});
      return res.status(200).json({ ok: true, message: 'Deploy cancelled on Render.' });
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
    try {
      const rows = await queryDb(
        `INSERT INTO deploys (triggered_by, status, note) VALUES ($1,'triggered','manual') RETURNING id`,
        [actor.who]
      );
      const deployId = await fireDeploy();
      await queryDb(`UPDATE deploys SET deploy_id=$2 WHERE id=$1`, [rows[0].id, deployId]).catch(() => {});
      await logAudit('team', actor.who, 'deploy_triggered', `deploy:${rows[0].id}`).catch(() => {});
      return res.status(200).json({ ok: true, id: rows[0].id, deployId, message: 'Deploy triggered on Render.' });
    } catch (e) {
      return res.status(502).json({ error: `Deploy failed: ${e.message}` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
