// Deploy controls for the team portal: trigger a deploy now, or schedule one
// for later. Deploys run via GitHub Actions (workflow_dispatch) — the workflow
// builds on GitHub's runners and ships to the VM over SSH. Access is
// admin-managed (api/deploy/config): an allow-list of team-member emails, plus
// an optional password gate. Every deploy is logged with who triggered it,
// when, and the commit/PR being deployed. Scheduled deploys are fired by
// sweepDeploys(), invoked on an interval from server.js.
//
// A deploy TARGET maps to a GitHub repo + workflow file + branch:
//   repo          -> deploy_targets.repo        e.g. "PatienceAIiN/Law-firm"
//   workflow file -> deploy_targets.deploy_hook  e.g. "deploy.yml"  (default)
//   git ref/branch-> deploy_targets.api_key      e.g. "main"        (default)
// (Column names are reused verbatim to avoid a schema migration.)
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getMemberSession, hashPassword, verifyPassword } from './_security.js';
import { logAudit } from './_ticketing.js';
import { sweepDue, setSweepNextDue, invalidateSweep } from './_sweepgate.js';

const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const GH_OWNER = process.env.GITHUB_OWNER || 'PatienceAIiN';
const DEFAULT_WORKFLOW = 'deploy.yml';
const DEFAULT_REF = 'main';
const hasGitHub = () => Boolean(GH_TOKEN);

// GitHub REST helper scoped to a repo (owner/name). Fails soft (caller checks .ok).
const gh = (repo, path, init = {}) => fetch(`https://api.github.com/repos/${repo}${path}`, {
  ...init,
  headers: {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers || {}),
  },
});

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

// Normalise a target into { repo, workflow, ref }. Owner defaults to GH_OWNER
// when the stored repo omits it.
const targetRef = (t) => {
  let repo = String(t?.repo || '').trim();
  if (repo && !repo.includes('/')) repo = `${GH_OWNER}/${repo}`;
  if (!repo) repo = `${GH_OWNER}/MAIN-SITE`;
  // deploy_hook historically held a Render URL; treat any non-".yml" value as
  // "use the default workflow" so legacy rows keep working.
  const wfRaw = String(t?.deploy_hook || '').trim();
  const workflow = /\.ya?ml$/i.test(wfRaw) ? wfRaw : DEFAULT_WORKFLOW;
  const ref = String(t?.api_key || '').trim() || DEFAULT_REF;
  return { repo, workflow, ref };
};

const IN_PROGRESS = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']);

// Load the admin-managed deploy config (allow-list + password).
const loadConfig = async () => {
  try {
    const [row] = await queryDb(`SELECT password_hash, password_salt, allowed_emails FROM deploy_config WHERE id=1`);
    return {
      passwordHash: row?.password_hash || null,
      passwordSalt: row?.password_salt || null,
      allowedEmails: String(row?.allowed_emails || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    };
  } catch { return { passwordHash: null, passwordSalt: null, allowedEmails: [] }; }
};

const getActor = async (req) => {
  const cfg = await loadConfig();
  const member = getMemberSession(req);
  if (member) {
    const email = (member.email || '').toLowerCase();
    let allowedRepos = [];
    try { const [row] = await queryDb(`SELECT allowed_repos FROM team_members WHERE id=$1`, [member.id]); allowedRepos = String(row?.allowed_repos || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean); } catch { /* ignore */ }
    return { who: member.name || member.email || 'team_member', email, admin: false, allowed: cfg.allowedEmails.includes(email), allowedRepos, cfg };
  }
  if (isAdmin(req)) return { who: 'admin', admin: true, allowed: true, allowedRepos: null, cfg };
  return { who: null, allowed: false, allowedRepos: [], cfg };
};

// Best-effort: the latest commit on the target's branch (the one a dispatch builds).
const latestCommit = async (repoFull, ref = DEFAULT_REF) => {
  if (!GH_TOKEN) return {};
  const repo = String(repoFull || '').includes('/') ? repoFull : `${GH_OWNER}/${repoFull || 'MAIN-SITE'}`;
  try {
    const r = await gh(repo, `/commits/${encodeURIComponent(ref)}`);
    if (!r.ok) return {};
    const c = await r.json();
    const msg = (c.commit?.message || '').split('\n')[0];
    const prNum = (msg.match(/#(\d+)/) || [])[1];
    return { sha: (c.sha || '').slice(0, 7), msg: msg.slice(0, 300), pr: prNum ? `#${prNum}` : null };
  } catch { return {}; }
};

// Trigger a workflow_dispatch, then resolve the run it created. GitHub's
// dispatch endpoint returns 204 with no body, so we read back the newest
// workflow_dispatch run on that workflow (retry briefly — it can lag a moment).
const fireDeploy = async (target) => {
  if (!GH_TOKEN) throw new Error('No GITHUB_TOKEN configured — set it in the environment to enable deploys.');
  const { repo, workflow, ref } = targetRef(target);
  const disp = await gh(repo, `/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref }),
  });
  if (!disp.ok) {
    const body = await disp.text().catch(() => '');
    throw new Error(`GitHub dispatch failed (${disp.status})${body ? ': ' + body.slice(0, 160) : ''}`);
  }
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const rr = await gh(repo, `/actions/workflows/${encodeURIComponent(workflow)}/runs?event=workflow_dispatch&per_page=1`);
    if (rr.ok) {
      const j = await rr.json().catch(() => ({}));
      const run = (j.workflow_runs || [])[0];
      if (run?.id) return String(run.id);
    }
  }
  return null;
};

const loadTargets = async () => {
  try { return await queryDb(`SELECT id, label, repo, deploy_hook, api_key, allowed_emails FROM deploy_targets ORDER BY label ASC`); }
  catch { return []; }
};
const targetGrants = (t) => String(t.allowed_emails || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const canSeeTarget = (actor, t) => actor.admin || (targetGrants(t).length ? targetGrants(t).includes(actor.email) : actor.allowed);

// Fire any scheduled deploys whose time has arrived. Called from server.js.
export const sweepDeploys = async () => {
  if (!(await sweepDue('deploys'))) return;
  let ok = false; let nextMs = null;
  try {
    const due = await queryDb(`SELECT id, target_id FROM deploys WHERE status='scheduled' AND run_at <= NOW() ORDER BY run_at ASC`);
    const targets = await loadTargets();
    for (const row of due) {
      try {
        const target = row.target_id ? targets.find((t) => Number(t.id) === Number(row.target_id)) : null;
        const { repo, ref } = targetRef(target || {});
        const c = await latestCommit(repo, ref);
        const runId = await fireDeploy(target || {});
        await queryDb(`UPDATE deploys SET status='triggered', deploy_id=$2, commit_sha=$3, commit_msg=$4, pr=$5, updated_at=NOW() WHERE id=$1`,
          [row.id, runId, c.sha || null, c.msg || null, c.pr || null]);
        await logAudit('system', 'scheduler', 'deploy_triggered', `deploy:${row.id}`).catch(() => {});
      } catch (e) {
        await queryDb(`UPDATE deploys SET status='failed', note=$2, updated_at=NOW() WHERE id=$1`, [row.id, e.message]).catch(() => {});
      }
    }
    const [nxt] = await queryDb(`SELECT MIN(run_at) AS t FROM deploys WHERE status='scheduled' AND run_at > NOW()`);
    nextMs = nxt?.t ? new Date(nxt.t).getTime() : null;
    ok = true;
  } catch (e) {
    if (!isMissingTableError(e.message)) console.error('[deploy] sweep error:', e.message);
  }
  if (ok) await setSweepNextDue('deploys', nextMs);
};

export default async function handler(req, res) {
  const actor = await getActor(req);
  if (!actor.who) return res.status(401).json({ error: 'Not authenticated' });

  // ── Admin-only config: allow-list + password ─────────────────────────────
  if (req.url?.includes('/config')) {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
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

  // ── Admin-only: per-repo deploy targets CRUD ──────────────────────────────
  // A target = GitHub repo + workflow file + branch. `deployHook` now carries
  // the workflow filename (e.g. "deploy.yml"); `apiKey` carries the git branch.
  if (req.url?.includes('/targets')) {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    try {
      if (req.method === 'GET') {
        const rows = await loadTargets();
        const out = rows.map((t) => { const r = targetRef(t); return { ...t, repo: r.repo, workflow: r.workflow, ref: r.ref }; });
        return res.status(200).json({ targets: out });
      }
      if (req.method === 'POST') {
        const { label, repo, deployHook, apiKey, allowedEmails } = req.body || {};
        if (!label?.trim() || !repo?.trim()) return res.status(400).json({ error: 'label and repo (owner/name) are required' });
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo.trim())) return res.status(400).json({ error: 'repo must be "owner/name"' });
        const workflow = (deployHook || '').trim() || DEFAULT_WORKFLOW;   // deployHook field = workflow filename
        const ref = (apiKey || '').trim() || DEFAULT_REF;                 // apiKey field = branch
        const emails = Array.isArray(allowedEmails) ? allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean).join(',') : null;
        const rows = await queryDb(`INSERT INTO deploy_targets (label, repo, deploy_hook, api_key, allowed_emails) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [label.trim().slice(0, 120), repo.trim().slice(0, 200), workflow, ref, emails]);
        await logAudit('admin', 'admin', 'deploy_target_created', `${label} (${rows[0].id})`).catch(() => {});
        return res.status(200).json({ ok: true, id: rows[0].id });
      }
      if (req.method === 'PUT') {
        const { id, label, repo, deployHook, apiKey } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        if (repo && !/^[\w.-]+\/[\w.-]+$/.test(String(repo).trim())) return res.status(400).json({ error: 'repo must be "owner/name"' });
        const emails = Array.isArray(req.body?.allowedEmails) ? req.body.allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean).join(',') : null;
        await queryDb(`UPDATE deploy_targets SET label=COALESCE($2,label), repo=COALESCE($3,repo), deploy_hook=COALESCE($4,deploy_hook), api_key=COALESCE($5,api_key), allowed_emails=COALESCE($6,allowed_emails), updated_at=NOW() WHERE id=$1`,
          [id, label ? String(label).trim().slice(0, 120) : null, repo ? String(repo).trim().slice(0, 200) : null,
           deployHook ? String(deployHook).trim() : null, apiKey ? String(apiKey).trim() : null, emails]);
        await logAudit('admin', 'admin', 'deploy_target_updated', String(id)).catch(() => {});
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'DELETE') {
        const id = parseInt(req.query.id, 10);
        if (!id) return res.status(400).json({ error: 'id required' });
        await queryDb(`DELETE FROM deploy_targets WHERE id=$1`, [id]);
        await logAudit('admin', 'admin', 'deploy_target_deleted', String(id)).catch(() => {});
        return res.status(200).json({ ok: true });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── Admin-only: recent workflow runs for a target (GitHub-Actions view) ────
  if (req.url?.includes('/services')) {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    if (!GH_TOKEN) return res.status(200).json({ services: [], runs: [], note: 'No GITHUB_TOKEN set — add it to the environment to view GitHub Actions runs.' });
    try {
      const targets = await loadTargets();
      const tid = req.query.id ? parseInt(req.query.id, 10) : null;
      const target = tid ? targets.find((t) => Number(t.id) === tid) : null;
      if (!target) {
        return res.status(200).json({ services: targets.map((t) => { const r = targetRef(t); return { id: t.id, name: t.label, repo: r.repo, workflow: r.workflow, branch: r.ref }; }) });
      }
      const { repo, workflow, ref } = targetRef(target);
      const rr = await gh(repo, `/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=20`);
      const j = rr.ok ? await rr.json().catch(() => ({})) : {};
      const runs = (j.workflow_runs || []).map((d) => ({
        id: d.id, status: d.status, conclusion: d.conclusion, createdAt: d.created_at,
        commitId: (d.head_sha || '').slice(0, 7), commitMsg: (d.head_commit?.message || '').split('\n')[0]?.slice(0, 120),
        event: d.event, url: d.html_url,
      }));
      return res.status(200).json({ service: { id: target.id, name: target.label, repo, workflow, branch: ref }, runs });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // GET /api/deploy/logs?id= — run status + per-step lines from GitHub Actions.
  if (req.method === 'GET' && req.url?.includes('/logs')) {
    const id = parseInt(req.query.id, 10);
    try {
      const [row] = id ? await queryDb(`SELECT deploy_id, target_id FROM deploys WHERE id=$1`, [id]) : [];
      const runId = row?.deploy_id;
      if (!GH_TOKEN) return res.status(200).json({ status: null, lines: [], note: 'No GITHUB_TOKEN set — cannot read run status.' });
      if (!runId) return res.status(200).json({ status: null, lines: [], note: 'No GitHub run id recorded for this entry yet.' });
      const targets = await loadTargets();
      const target = row?.target_id ? targets.find((t) => Number(t.id) === Number(row.target_id)) : null;
      const { repo } = targetRef(target || {});
      const runRes = await gh(repo, `/actions/runs/${runId}`);
      const run = runRes.ok ? await runRes.json() : null;
      // Map GitHub's vocabulary onto the statuses the team-portal UI already
      // knows (from the Render era): success→'live' (green, done), a bad
      // conclusion→'failed', cancellation→'cancelled'. In-progress states pass
      // through as-is (the UI treats anything not in DEPLOY_DONE as "running").
      let status = null;
      if (run) {
        if (run.status === 'completed') {
          status = run.conclusion === 'success' ? 'live' : (run.conclusion === 'cancelled' ? 'cancelled' : 'failed');
          // Resolve the local history row so the button reverts and the
          // recent-list "still running?" heuristic stops re-activating it.
          const dbStatus = run.conclusion === 'success' ? 'success' : (run.conclusion === 'cancelled' ? 'cancelled' : 'failed');
          await queryDb(`UPDATE deploys SET status=$2, updated_at=NOW() WHERE id=$1 AND status='triggered'`, [id, dbStatus]).catch(() => {});
        } else {
          status = run.status;
        }
      }
      let lines = [];
      const jobsRes = await gh(repo, `/actions/runs/${runId}/jobs`);
      if (jobsRes.ok) {
        const jj = await jobsRes.json().catch(() => ({}));
        for (const job of (jj.jobs || [])) {
          lines.push(`▸ ${job.name}: ${job.status}${job.conclusion ? ' → ' + job.conclusion : ''}`);
          for (const step of (job.steps || [])) lines.push(`   ${step.number}. ${step.name} — ${step.status}${step.conclusion ? ' (' + step.conclusion + ')' : ''}`);
        }
      }
      if (run?.html_url) lines.push(`View full logs: ${run.html_url}`);
      return res.status(200).json({ status, lines, deployId: runId });
    } catch (e) {
      return res.status(200).json({ status: null, lines: [], note: e.message });
    }
  }

  // GET /api/deploy/active — detect an in-progress GitHub Actions run for any
  // target the actor can see; reconcile with local history so /logs and /cancel work.
  if (req.method === 'GET' && req.url?.includes('/active')) {
    try {
      const visible = (await loadTargets()).filter((t) => canSeeTarget(actor, t));
      const candidates = visible.length ? visible : (actor.admin || actor.allowed ? [{ id: null, repo: `${GH_OWNER}/MAIN-SITE`, deploy_hook: DEFAULT_WORKFLOW, label: null }] : []);
      if (!GH_TOKEN || !candidates.length) return res.status(200).json({ active: null, hasRenderApi: hasGitHub() });
      for (const t of candidates) {
        const { repo, workflow } = targetRef(t);
        const rr = await gh(repo, `/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=1`);
        if (!rr.ok) continue;
        const j = await rr.json().catch(() => ({}));
        const d = (j.workflow_runs || [])[0];
        if (!d || !IN_PROGRESS.has(d.status)) continue;
        let [local] = await queryDb(`SELECT id, status FROM deploys WHERE deploy_id=$1 LIMIT 1`, [String(d.id)]);
        if (!local) {
          const sha = (d.head_sha || '').slice(0, 7) || null;
          const msg = (d.head_commit?.message || '').split('\n')[0]?.slice(0, 300) || null;
          const ins = await queryDb(
            `INSERT INTO deploys (triggered_by, status, note, deploy_id, commit_sha, commit_msg, target_id, target_label) VALUES ($1,'triggered','external',$2,$3,$4,$5,$6) RETURNING id`,
            [d.triggering_actor?.login || d.event || 'github', String(d.id), sha, msg, t.id, t.label]
          );
          local = { id: ins[0].id, status: 'triggered' };
          await logAudit('system', 'github', 'deploy_detected', `deploy:${local.id} (${d.event})`).catch(() => {});
        } else if (local.status === 'cancelled' || local.status === 'failed') { continue; }
        return res.status(200).json({
          active: { id: local.id, deployId: String(d.id), status: d.status, trigger: d.event || 'external', label: t.label,
            commit: { sha: (d.head_sha || '').slice(0, 7), msg: (d.head_commit?.message || '').split('\n')[0]?.slice(0, 120) }, createdAt: d.created_at || null },
          hasRenderApi: true,
        });
      }
      return res.status(200).json({ active: null, hasRenderApi: hasGitHub() });
    } catch (e) {
      return res.status(200).json({ active: null, note: e.message });
    }
  }

  // GET — current schedule + recent history (visible to any authenticated member).
  if (req.method === 'GET') {
    try {
      let targetId = parseInt(req.query.targetId, 10) || null;
      const visible = (await loadTargets()).filter((t) => canSeeTarget(actor, t));
      const targets = visible.map((t) => { const r = targetRef(t); return { id: t.id, label: t.label, repo: r.repo, serviceId: null }; });
      if (targetId && !visible.some((t) => Number(t.id) === targetId)) targetId = -1;
      const scheduled = await queryDb(`SELECT id, triggered_by, run_at, note, target_label, created_at FROM deploys WHERE status='scheduled' ORDER BY run_at ASC`);
      const recent = targetId
        ? await queryDb(`SELECT id, triggered_by, status, run_at, note, deploy_id, commit_sha, commit_msg, pr, target_label, created_at FROM deploys WHERE status<>'scheduled' AND target_id=$1 ORDER BY created_at DESC LIMIT 15`, [targetId])
        : await queryDb(`SELECT id, triggered_by, status, run_at, note, deploy_id, commit_sha, commit_msg, pr, target_label, created_at FROM deploys WHERE status<>'scheduled' ORDER BY created_at DESC LIMIT 15`);
      const canDeploy = actor.admin || actor.allowed;
      return res.status(200).json({ scheduled, recent, targets, canDeploy, passwordSet: Boolean(actor.cfg.passwordHash), hasRenderApi: hasGitHub() });
    } catch (e) {
      if (isMissingTableError(e.message)) return res.status(200).json({ scheduled: [], recent: [], targets: [], canDeploy: actor.allowed, passwordSet: false });
      return res.status(500).json({ error: e.message });
    }
  }

  if (!actor.admin && !actor.allowed) return res.status(403).json({ error: 'You are not allowed to deploy. Ask an admin to add you to the deployer list.' });

  const checkPassword = () => {
    if (!actor.cfg.passwordHash) return true;
    const pw = (req.body || {}).password;
    return Boolean(pw) && verifyPassword(String(pw), actor.cfg.passwordSalt, actor.cfg.passwordHash);
  };

  // POST /api/deploy/cancel { id } — cancel a scheduled deploy, or abort a running run.
  if (req.method === 'POST' && req.url?.includes('/cancel')) {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      const [row] = await queryDb(`SELECT status, deploy_id, target_id FROM deploys WHERE id=$1`, [id]);
      if (!row) return res.status(404).json({ error: 'Deploy not found' });
      if (row.status === 'scheduled') {
        await queryDb(`UPDATE deploys SET status='cancelled', updated_at=NOW() WHERE id=$1`, [id]);
        return res.status(200).json({ ok: true, message: 'Scheduled deploy cancelled.' });
      }
      await queryDb(`UPDATE deploys SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status='triggered'`, [id]);
      if (!GH_TOKEN || !row.deploy_id) return res.status(200).json({ ok: true, message: 'Marked cancelled (no GitHub run id to abort).' });
      const targets = await loadTargets();
      const target = row.target_id ? targets.find((t) => Number(t.id) === Number(row.target_id)) : null;
      const { repo } = targetRef(target || {});
      const r = await gh(repo, `/actions/runs/${row.deploy_id}/cancel`, { method: 'POST' });
      await logAudit('team', actor.who, 'deploy_cancelled', `deploy:${id}`).catch(() => {});
      return res.status(200).json({ ok: true, message: r.ok ? 'Deploy cancelled on GitHub Actions.' : `Marked cancelled (GitHub returned ${r.status}).` });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/deploy/schedule — schedule a deploy for later.
  if (req.method === 'POST' && req.url?.includes('/schedule')) {
    if (!checkPassword()) return res.status(401).json({ error: 'Incorrect deploy password' });
    const { runAt, note, targetId } = req.body || {};
    const when = runAt ? new Date(runAt) : null;
    if (!when || isNaN(when.getTime())) return res.status(400).json({ error: 'A valid runAt time is required' });
    if (when.getTime() < Date.now() - 60000) return res.status(400).json({ error: 'Scheduled time must be in the future' });
    try {
      const targets = await loadTargets();
      const tid = parseInt(targetId, 10) || null;
      const target = tid ? targets.find((t) => Number(t.id) === tid) : null;
      if (targets.length && !target) return res.status(400).json({ error: 'Select a repository to deploy.', needTarget: true });
      if (target && !canSeeTarget(actor, target)) return res.status(403).json({ error: 'You are not granted access to deploy this repository.' });
      const rows = await queryDb(`INSERT INTO deploys (triggered_by, status, run_at, note, target_id, target_label) VALUES ($1,'scheduled',$2,$3,$4,$5) RETURNING id, run_at, note`,
        [actor.who, when.toISOString(), (note || '').slice(0, 300), target?.id || null, target?.label || null]);
      await logAudit('team', actor.who, 'deploy_scheduled', `deploy:${rows[0].id}`).catch(() => {});
      await invalidateSweep('deploys');
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

  // POST /api/deploy — trigger an immediate deploy (workflow_dispatch) for the target.
  if (req.method === 'POST') {
    if (!checkPassword()) return res.status(401).json({ error: 'Incorrect deploy password' });
    try {
      const targets = await loadTargets();
      const targetId = parseInt((req.body || {}).targetId, 10) || null;
      let target = null;
      if (targetId) {
        target = targets.find((t) => Number(t.id) === targetId);
        if (!target) return res.status(400).json({ error: 'Selected repo target not found.' });
        if (!canSeeTarget(actor, target)) return res.status(403).json({ error: 'You are not granted access to deploy this repository.' });
      } else if (targets.length) {
        return res.status(400).json({ error: 'Select a repository to deploy.', needTarget: true });
      }
      const { repo, ref } = targetRef(target || {});
      const label = target?.label;
      const c = await latestCommit(repo, ref);
      const rows = await queryDb(`INSERT INTO deploys (triggered_by, status, note, commit_sha, commit_msg, pr, target_id, target_label) VALUES ($1,'triggered','manual',$2,$3,$4,$5,$6) RETURNING id`,
        [actor.who, c.sha || null, c.msg || null, c.pr || null, target?.id || null, target?.label || null]);
      const runId = await fireDeploy(target || {});
      await queryDb(`UPDATE deploys SET deploy_id=$2 WHERE id=$1`, [rows[0].id, runId]).catch(() => {});
      await logAudit('team', actor.who, 'deploy_triggered', `deploy:${rows[0].id}${label ? ` [${label}]` : ''}${c.sha ? ` @${c.sha}` : ''}`).catch(() => {});
      return res.status(200).json({ ok: true, id: rows[0].id, deployId: runId, commit: c, target: target?.label || null, message: `Deploy triggered${label ? ` for ${label}` : ''} via GitHub Actions.` });
    } catch (e) {
      return res.status(502).json({ error: `Deploy failed: ${e.message}` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
