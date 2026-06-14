// Deploy controls for the team portal: trigger a Render deploy now, or schedule
// one for later. Access is admin-managed (api/deploy/config): an allow-list of
// team-member emails, plus an optional password gate. Every deploy is logged
// with who triggered it, when, and the commit/PR being deployed. Scheduled
// deploys are fired by sweepDeploys(), invoked on an interval from server.js.
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getMemberSession, hashPassword, verifyPassword } from './_security.js';
import { logAudit } from './_ticketing.js';

// The Render deploy hook MUST come from the environment — never hardcode a live
// deploy credential in source (anyone who can read the repo could force a prod
// deploy, bypassing the allow-list + password gate). Fails closed if unset.
const DEPLOY_HOOK = process.env.RENDER_DEPLOY_HOOK || '';

// Render REST API (cancel a running deploy + read its live logs). Needs a
// RENDER_API_KEY; the deploy-hook key alone cannot do either.
const SERVICE_ID = (DEPLOY_HOOK.match(/deploy\/(srv-[a-z0-9]+)/i) || [])[1];
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_OWNER_ID = process.env.RENDER_OWNER_ID;
const renderApi = (path, init = {}, key) => fetch(`https://api.render.com/v1${path}`, {
  ...init, headers: { Authorization: `Bearer ${key || RENDER_API_KEY}`, Accept: 'application/json', ...(init.headers || {}) }
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

// Resolve who is acting and whether they may deploy. A team-member session is
// evaluated FIRST (and purely against the admin-managed allow-list), so a
// lingering admin cookie in the same browser can never grant a team member
// deploy access or bypass the password. Pure-admin (no member session) is only
// used for the /config management endpoints.
const getActor = async (req) => {
  const cfg = await loadConfig();
  const member = getMemberSession(req);
  if (member) {
    const email = (member.email || '').toLowerCase();
    let allowedRepos = [];
    try { const [row] = await queryDb(`SELECT allowed_repos FROM team_members WHERE id=$1`, [member.id]); allowedRepos = String(row?.allowed_repos || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean); } catch { /* ignore */ }
    return { who: member.name || member.email || 'team_member', email, admin: false, allowed: cfg.allowedEmails.includes(email), allowedRepos, cfg };
  }
  if (isAdmin(req)) return { who: 'admin', admin: true, allowed: true, allowedRepos: null, cfg }; // null = all repos
  return { who: null, allowed: false, allowedRepos: [], cfg };
};

// Best-effort: the latest commit on main (the one a hook deploy will build).
const latestCommit = async (repoFull) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return {};
  const [ro, rn] = String(repoFull || '').includes('/') ? repoFull.split('/') : [];
  const owner = ro || process.env.GITHUB_OWNER || 'PatienceAIiN';
  const repo = rn || process.env.GITHUB_REPO || 'MAIN-SITE';
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

const fireDeploy = async (hook) => {
  const url = hook || DEPLOY_HOOK;
  if (!url) throw new Error('No deploy hook configured for this repo. An admin must set its deploy hook.');
  const r = await fetch(url, { method: 'POST' });
  if (!r.ok) throw new Error(`Render hook responded ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return j?.deploy?.id || null; // Render returns the new deploy id
};

// Per-repo deploy targets (admin-managed). Each has its own Render deploy hook.
const loadTargets = async () => {
  try { return await queryDb(`SELECT id, label, repo, deploy_hook, api_key, allowed_emails FROM deploy_targets ORDER BY label ASC`); }
  catch { return []; }
};
const svcIdOf = (hook) => (String(hook || '').match(/deploy\/(srv-[a-z0-9]+)/i) || [])[1] || '';
// Who may deploy a given target: empty grant = any deploy-allowed user (legacy);
// otherwise only the listed emails. Admins always.
const targetGrants = (t) => String(t.allowed_emails || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const canSeeTarget = (actor, t) => actor.admin || (targetGrants(t).length ? targetGrants(t).includes(actor.email) : actor.allowed);

// Fire any scheduled deploys whose time has arrived. Called from server.js.
export const sweepDeploys = async () => {
  try {
    const due = await queryDb(`SELECT id, target_id FROM deploys WHERE status='scheduled' AND run_at <= NOW() ORDER BY run_at ASC`);
    const targets = await loadTargets();
    for (const row of due) {
      try {
        const target = row.target_id ? targets.find((t) => Number(t.id) === Number(row.target_id)) : null;
        const c = await latestCommit(target?.repo);
        const deployId = await fireDeploy(target?.deploy_hook);
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

  // ── Admin-only: per-repo deploy targets CRUD (label + repo + deploy hook) ──
  if (req.url?.includes('/targets')) {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    try {
      if (req.method === 'GET') {
        const rows = await loadTargets();
        return res.status(200).json({ targets: rows }); // admin sees full hooks for editing
      }
      if (req.method === 'POST') {
        const { label, repo, deployHook, apiKey, allowedEmails } = req.body || {};
        if (!label?.trim() || !deployHook?.trim()) return res.status(400).json({ error: 'label and deployHook are required' });
        if (!/^https:\/\/api\.render\.com\/deploy\//.test(deployHook.trim())) return res.status(400).json({ error: 'deployHook must be a Render deploy-hook URL' });
        const emails = Array.isArray(allowedEmails) ? allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean).join(',') : null;
        const rows = await queryDb(`INSERT INTO deploy_targets (label, repo, deploy_hook, api_key, allowed_emails) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [label.trim().slice(0, 120), (repo || '').trim().slice(0, 200) || null, deployHook.trim(), (apiKey || '').trim() || null, emails]);
        await logAudit('admin', 'admin', 'deploy_target_created', `${label} (${rows[0].id})`).catch(() => {});
        return res.status(200).json({ ok: true, id: rows[0].id });
      }
      if (req.method === 'PUT') {
        const { id, label, repo, deployHook, apiKey } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id required' });
        if (deployHook && !/^https:\/\/api\.render\.com\/deploy\//.test(String(deployHook).trim())) return res.status(400).json({ error: 'deployHook must be a Render deploy-hook URL' });
        // apiKey: undefined = leave; '' = clear; string = set
        const apiKeyArg = apiKey === undefined ? null : (String(apiKey).trim() || '');
        const emails = Array.isArray(req.body?.allowedEmails) ? req.body.allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean).join(',') : null;
        await queryDb(`UPDATE deploy_targets SET label=COALESCE($2,label), repo=$3, deploy_hook=COALESCE($4,deploy_hook), api_key=CASE WHEN $5::text IS NULL THEN api_key ELSE NULLIF($5,'') END, allowed_emails=COALESCE($6,allowed_emails), updated_at=NOW() WHERE id=$1`,
          [id, label ? String(label).trim().slice(0, 120) : null, (repo || '').trim().slice(0, 200) || null, deployHook ? String(deployHook).trim() : null, apiKey === undefined ? null : apiKeyArg, emails]);
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

  // ── Admin-only Render dashboard: services, env vars, settings, history ────
  // Exposes secrets (env values) → admin session required, RENDER_API_KEY needed.
  if (req.url?.includes('/services')) {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    const sid = req.query.id;
    // Per-repo API key (set by admin next to the deploy hook) overrides the
    // global RENDER_API_KEY, so a service in a different Render account loads.
    let key = RENDER_API_KEY;
    if (sid) { const tgt = (await loadTargets()).find((t) => svcIdOf(t.deploy_hook) === sid); if (tgt?.api_key) key = tgt.api_key; }
    if (!key) return res.status(200).json({ services: [], service: null, envVars: [], deploys: [], note: 'No Render API key set. Add one next to this repo\'s deploy hook in Admin → Deploy.' });
    try {
      if (req.method === 'GET') {
        if (!sid) {
          // List every service on the account (grouped client-side by owner/project).
          const r = await renderApi('/services?limit=100', {}, key);
          const raw = (await r.json().catch(() => [])) || [];
          const list = Array.isArray(raw) ? raw : [];
          const services = list.map((x) => x.service || x).map((s) => ({
            id: s.id, name: s.name, type: s.type, env: s.env, branch: s.branch,
            repo: s.repo, autoDeploy: s.autoDeploy, ownerId: s.ownerId, url: s.serviceDetails?.url || s.dashboardUrl,
            suspended: s.suspended, updatedAt: s.updatedAt,
          }));
          return res.status(200).json({ services });
        }
        // Single service: details + env vars + recent deploys.
        const [sRes, eRes, dRes] = await Promise.all([
          renderApi(`/services/${sid}`, {}, key),
          renderApi(`/services/${sid}/env-vars?limit=100`, {}, key),
          renderApi(`/services/${sid}/deploys?limit=20`, {}, key),
        ]);
        const s = await sRes.json().catch(() => ({}));
        if (!sRes.ok || !s?.id) {
          return res.status(200).json({ service: null, envVars: [], deploys: [], note: `Couldn't load this service (Render returned ${sRes.status}). Set this repo's own Render API key next to its deploy hook in Admin → Deploy (the key must own this service).` });
        }
        const envRaw = (await eRes.json().catch(() => [])) || [];
        const depRaw = (await dRes.json().catch(() => [])) || [];
        const envArr = Array.isArray(envRaw) ? envRaw : [];
        const depArr = Array.isArray(depRaw) ? depRaw : [];
        const envVars = envArr.map((x) => x.envVar || x).map((e) => ({ key: e.key, value: e.value }));
        const deploys = depArr.map((x) => x.deploy || x).map((d) => ({ id: d.id, status: d.status, createdAt: d.createdAt, finishedAt: d.finishedAt, commitId: d.commit?.id?.slice(0, 7), commitMsg: d.commit?.message?.split('\n')[0]?.slice(0, 120), trigger: d.trigger }));
        return res.status(200).json({ service: { id: s.id, name: s.name, type: s.type, env: s.env, branch: s.branch, repo: s.repo, autoDeploy: s.autoDeploy, rootDir: s.rootDir, buildCommand: s.serviceDetails?.envSpecificDetails?.buildCommand, startCommand: s.serviceDetails?.envSpecificDetails?.startCommand, region: s.serviceDetails?.region, plan: s.serviceDetails?.plan, url: s.serviceDetails?.url, dashboardUrl: s.dashboardUrl }, envVars, deploys });
      }
      if (req.method === 'PUT' && sid) {
        // Replace the full env-var set (Render PUT semantics).
        const vars = Array.isArray(req.body?.envVars) ? req.body.envVars : null;
        if (!vars) return res.status(400).json({ error: 'envVars array required' });
        const clean = vars.map((v) => ({ key: String(v.key || '').trim(), value: String(v.value ?? '') })).filter((v) => v.key);
        const r = await renderApi(`/services/${sid}/env-vars`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) }, key);
        if (!r.ok) return res.status(r.status).json({ error: `Render env update failed (${r.status})` });
        await logAudit('admin', 'admin', 'render_env_updated', sid).catch(() => {});
        return res.status(200).json({ ok: true, count: clean.length });
      }
      if (req.method === 'PATCH' && sid) {
        // Update select service settings (name / branch / autoDeploy).
        const body = {};
        if (typeof req.body?.name === 'string' && req.body.name.trim()) body.name = req.body.name.trim().slice(0, 120);
        if (typeof req.body?.branch === 'string' && req.body.branch.trim()) body.branch = req.body.branch.trim();
        if (typeof req.body?.autoDeploy === 'string') body.autoDeploy = req.body.autoDeploy; // 'yes' | 'no'
        if (!Object.keys(body).length) return res.status(400).json({ error: 'Nothing to update' });
        const r = await renderApi(`/services/${sid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, key);
        if (!r.ok) return res.status(r.status).json({ error: `Render settings update failed (${r.status})` });
        await logAudit('admin', 'admin', 'render_service_updated', `${sid}:${Object.keys(body).join(',')}`).catch(() => {});
        return res.status(200).json({ ok: true });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // GET /api/deploy/logs?id= — live deployment status + build log lines.
  if (req.method === 'GET' && req.url?.includes('/logs')) {
    const id = parseInt(req.query.id, 10);
    try {
      const [row] = id ? await queryDb(`SELECT deploy_id, target_id FROM deploys WHERE id=$1`, [id]) : [];
      const deployId = row?.deploy_id;
      // Use the deploy's own target service + key, else the global ones.
      let svc = SERVICE_ID, key = RENDER_API_KEY;
      if (row?.target_id) { const tgt = (await loadTargets()).find((t) => Number(t.id) === Number(row.target_id)); if (tgt) { svc = svcIdOf(tgt.deploy_hook) || svc; if (tgt.api_key) key = tgt.api_key; } }
      if (!key) return res.status(200).json({ status: null, lines: [], note: 'No Render API key for this deploy — set one on the repo target (or RENDER_API_KEY) to stream live logs.' });
      if (!deployId) return res.status(200).json({ status: null, lines: [], note: 'No Render deploy id recorded for this entry yet.' });
      const dRes = await renderApi(`/services/${svc}/deploys/${deployId}`, {}, key);
      const dep = dRes.ok ? await dRes.json() : null;
      const status = dep?.status || dep?.deploy?.status || null;
      let lines = [];
      if (RENDER_OWNER_ID) {
        const q = new URLSearchParams({ ownerId: RENDER_OWNER_ID, resource: svc, limit: '100' });
        const lRes = await renderApi(`/logs?${q}`, {}, key);
        if (lRes.ok) { const lj = await lRes.json(); lines = (lj?.logs || lj || []).map((l) => `${l.timestamp || ''} ${l.message || l.text || ''}`.trim()); }
      }
      return res.status(200).json({ status, lines, deployId });
    } catch (e) {
      return res.status(200).json({ status: null, lines: [], note: e.message });
    }
  }

  // GET /api/deploy/active — detect a deploy currently in progress on Render,
  // no matter how it was started (our deploy hook, a scheduled sweep, OR a
  // manual deploy from the Render dashboard). For any in-progress deploy not yet
  // tracked locally, a tracking row is inserted so the existing /logs and
  // /cancel flows (which key off the local id) work for externally-started
  // deploys too. This is what keeps the Team portal in sync continuously.
  if (req.method === 'GET' && req.url?.includes('/active')) {
    // Render statuses that mean "still running".
    const IN_PROGRESS = new Set(['created', 'queued', 'build_in_progress', 'update_in_progress', 'pre_deploy_in_progress']);
    try {
      // Candidate services the actor may watch: their visible targets, plus the
      // global service for legacy (no-target) setups when they can deploy.
      const visible = (await loadTargets()).filter((t) => canSeeTarget(actor, t));
      const candidates = visible
        .map((t) => ({ targetId: Number(t.id), svc: svcIdOf(t.deploy_hook), key: t.api_key || RENDER_API_KEY, label: t.label }))
        .filter((c) => c.svc && c.key);
      if (!visible.length && SERVICE_ID && RENDER_API_KEY && (actor.admin || actor.allowed)) {
        candidates.push({ targetId: null, svc: SERVICE_ID, key: RENDER_API_KEY, label: null });
      }
      if (!candidates.length) return res.status(200).json({ active: null, hasRenderApi: Boolean(RENDER_API_KEY) });

      for (const cand of candidates) {
        const r = await renderApi(`/services/${cand.svc}/deploys?limit=1`, {}, cand.key);
        if (!r.ok) continue;
        const raw = (await r.json().catch(() => [])) || [];
        const d = (Array.isArray(raw) ? raw : []).map((x) => x.deploy || x)[0];
        if (!d || !IN_PROGRESS.has(d.status)) continue;

        // Reconcile with local history: reuse an existing row for this Render
        // deploy id, otherwise insert one so it's tracked + cancellable.
        let [local] = await queryDb(`SELECT id, status FROM deploys WHERE deploy_id=$1 LIMIT 1`, [d.id]);
        if (!local) {
          const sha = (d.commit?.id || '').slice(0, 7) || null;
          const msg = (d.commit?.message || '').split('\n')[0]?.slice(0, 300) || null;
          const by = d.trigger === 'deploy_hook' ? 'deploy hook' : (d.trigger || 'Render dashboard');
          const ins = await queryDb(
            `INSERT INTO deploys (triggered_by, status, note, deploy_id, commit_sha, commit_msg, target_id, target_label) VALUES ($1,'triggered','external',$2,$3,$4,$5,$6) RETURNING id`,
            [by, d.id, sha, msg, cand.targetId, cand.label]
          );
          local = { id: ins[0].id, status: 'triggered' };
          await logAudit('system', 'render', 'deploy_detected', `deploy:${local.id} (${d.trigger || 'external'})`).catch(() => {});
        } else if (local.status === 'cancelled' || local.status === 'failed') {
          // A user cancelled locally but Render still reports it running — keep
          // the local decision; don't resurrect it as active.
          continue;
        }
        return res.status(200).json({
          active: {
            id: local.id, deployId: d.id, status: d.status,
            trigger: d.trigger || 'external', label: cand.label,
            commit: { sha: (d.commit?.id || '').slice(0, 7), msg: (d.commit?.message || '').split('\n')[0]?.slice(0, 120) },
            createdAt: d.createdAt || null,
          },
          hasRenderApi: true,
        });
      }
      return res.status(200).json({ active: null, hasRenderApi: Boolean(RENDER_API_KEY) });
    } catch (e) {
      return res.status(200).json({ active: null, note: e.message });
    }
  }

  // GET — current schedule + recent history (visible to any authenticated member).
  if (req.method === 'GET') {
    try {
      let targetId = parseInt(req.query.targetId, 10) || null;
      // Team users see only the deploy targets an admin granted them (per-target),
      // independent of GitHub repo access; admins see all.
      const visible = (await loadTargets()).filter((t) => canSeeTarget(actor, t));
      const targets = visible.map((t) => ({ id: t.id, label: t.label, repo: t.repo, serviceId: svcIdOf(t.deploy_hook) })); // hook/key never exposed here
      // A team user may only read history for a target they can see.
      if (targetId && !visible.some((t) => Number(t.id) === targetId)) targetId = -1;
      const scheduled = await queryDb(`SELECT id, triggered_by, run_at, note, target_label, created_at FROM deploys WHERE status='scheduled' ORDER BY run_at ASC`);
      const recent = targetId
        ? await queryDb(`SELECT id, triggered_by, status, run_at, note, deploy_id, commit_sha, commit_msg, pr, target_label, created_at FROM deploys WHERE status<>'scheduled' AND target_id=$1 ORDER BY created_at DESC LIMIT 15`, [targetId])
        : await queryDb(`SELECT id, triggered_by, status, run_at, note, deploy_id, commit_sha, commit_msg, pr, target_label, created_at FROM deploys WHERE status<>'scheduled' ORDER BY created_at DESC LIMIT 15`);
      // The Deploy button shows ONLY for users on the admin deployer allow-list
      // (or admin). Per-target grants only narrow WHICH repos a deployer sees.
      const canDeploy = actor.admin || actor.allowed;
      return res.status(200).json({ scheduled, recent, targets, canDeploy, passwordSet: Boolean(actor.cfg.passwordHash), hasRenderApi: Boolean(RENDER_API_KEY) });
    } catch (e) {
      if (isMissingTableError(e.message)) return res.status(200).json({ scheduled: [], recent: [], targets: [], canDeploy: actor.allowed, passwordSet: false });
      return res.status(500).json({ error: e.message });
    }
  }

  // Deploying requires being on the admin deployer allow-list (or admin).
  if (!actor.admin && !actor.allowed) return res.status(403).json({ error: 'You are not allowed to deploy. Ask an admin to add you to the deployer list.' });

  // Password gate: whenever a deploy password is configured it must match —
  // for everyone, admin included. No password set ⇒ allow-list alone governs.
  const checkPassword = () => {
    if (!actor.cfg.passwordHash) return true;
    const pw = (req.body || {}).password;
    return Boolean(pw) && verifyPassword(String(pw), actor.cfg.passwordSalt, actor.cfg.passwordHash);
  };

  // POST /api/deploy/cancel { id } — cancel a scheduled deploy, or abort a running one.
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
      // Mark cancelled locally regardless, so the UI reverts immediately.
      await queryDb(`UPDATE deploys SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status='triggered'`, [id]);
      // Abort the RIGHT Render service: the deploy's own target (its service id +
      // its API key), falling back to the global service/key for hookless deploys.
      let svc = SERVICE_ID, key = RENDER_API_KEY;
      if (row.target_id) { const tgt = (await loadTargets()).find((t) => Number(t.id) === Number(row.target_id)); if (tgt) { svc = svcIdOf(tgt.deploy_hook) || svc; if (tgt.api_key) key = tgt.api_key; } }
      if (!key || !svc) return res.status(200).json({ ok: true, message: 'Marked cancelled. No Render API key/service to abort the live build.' });
      if (!row.deploy_id) return res.status(200).json({ ok: true, message: 'Marked cancelled (no Render deploy id recorded).' });
      const r = await renderApi(`/services/${svc}/deploys/${row.deploy_id}/cancel`, { method: 'POST' }, key);
      await logAudit('team', actor.who, 'deploy_cancelled', `deploy:${id}`).catch(() => {});
      return res.status(200).json({ ok: true, message: r.ok ? 'Deploy cancelled on Render.' : `Marked cancelled (Render returned ${r.status}).` });
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
      if (target && !canSeeTarget(actor, target))
        return res.status(403).json({ error: 'You are not granted access to deploy this repository.' });
      const rows = await queryDb(`INSERT INTO deploys (triggered_by, status, run_at, note, target_id, target_label) VALUES ($1,'scheduled',$2,$3,$4,$5) RETURNING id, run_at, note`,
        [actor.who, when.toISOString(), (note || '').slice(0, 300), target?.id || null, target?.label || null]);
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

  // POST /api/deploy — trigger an immediate deploy for the selected repo target.
  if (req.method === 'POST') {
    if (!checkPassword()) return res.status(401).json({ error: 'Incorrect deploy password' });
    try {
      const targets = await loadTargets();
      const targetId = parseInt((req.body || {}).targetId, 10) || null;
      let target = null;
      if (targetId) {
        target = targets.find((t) => Number(t.id) === targetId);
        if (!target) return res.status(400).json({ error: 'Selected repo target not found.' });
        if (!canSeeTarget(actor, target))
          return res.status(403).json({ error: 'You are not granted access to deploy this repository.' });
      } else if (targets.length) {
        // Targets are configured → a repo MUST be chosen (no blanket all-repos deploy).
        return res.status(400).json({ error: 'Select a repository to deploy.', needTarget: true });
      }
      const c = await latestCommit(target?.repo);
      const rows = await queryDb(`INSERT INTO deploys (triggered_by, status, note, commit_sha, commit_msg, pr, target_id, target_label) VALUES ($1,'triggered','manual',$2,$3,$4,$5,$6) RETURNING id`,
        [actor.who, c.sha || null, c.msg || null, c.pr || null, target?.id || null, target?.label || null]);
      const deployId = await fireDeploy(target?.deploy_hook);
      await queryDb(`UPDATE deploys SET deploy_id=$2 WHERE id=$1`, [rows[0].id, deployId]).catch(() => {});
      await logAudit('team', actor.who, 'deploy_triggered', `deploy:${rows[0].id}${target ? ` [${target.label}]` : ''}${c.sha ? ` @${c.sha}` : ''}`).catch(() => {});
      return res.status(200).json({ ok: true, id: rows[0].id, deployId, commit: c, target: target?.label || null, message: `Deploy triggered${target ? ` for ${target.label}` : ''}.` });
    } catch (e) {
      return res.status(502).json({ error: `Deploy failed: ${e.message}` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
