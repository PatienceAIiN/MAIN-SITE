// Outbound GitHub integration — PatienceAI as the operational interface.
// Uses a fine-grained PAT or GitHub App installation token via GITHUB_TOKEN
// (+ optional GITHUB_OWNER default org/user). Read endpoints for repos,
// branches and PRs; write endpoints for branch create and PR merge/close.
// Admin + executives only. Degrades with a clear hint when unconfigured.
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession, getMemberSession } from './_security.js';
import { logAudit } from './_ticketing.js';
import { queryDb } from './_db.js';
import { resolvePerms } from './team-members.js';

// admin/executive: full access to every repo. Team members: per-user
// permission flags (github_read / github_write) set by admin, defaulting by
// team role — PLUS an admin-granted repo allowlist (team_members.allowed_repos,
// csv of owner/name). A member with github access but no granted repos sees
// nothing: repos are never shown to the whole team by default.
const getGhActor = async (req) => {
  if (verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME))) return { email: 'admin', read: true, write: true, collab: true, allRepos: true };
  // Member session is checked BEFORE the executive session: if both cookies
  // exist in one browser, the restrictive repo allowlist must win — a team
  // member must never see repos beyond what an admin granted them.
  const m = getMemberSession(req);
  if (m) {
    const [row] = await queryDb(`SELECT team_role, permissions, allowed_repos FROM team_members WHERE id=$1`, [m.id]).catch(() => []);
    const perms = resolvePerms(row);
    const allowed = String(row?.allowed_repos || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    return {
      email: m.email,
      // an admin repo grant implies read access to those repos, even if the
      // member's permission flags were customised without github_read
      read: perms.includes('github_read') || perms.includes('github_write') || allowed.length > 0,
      write: perms.includes('github_write'),
      collab: perms.includes('collaborator_manage'),
      allRepos: false,
      allowed
    };
  }
  const e = getExecSession(req);
  if (e) return { email: e.email, read: true, write: true, collab: true, allRepos: true };
  return null;
};

const repoAllowed = (actor, owner, repo) =>
  actor.allRepos || actor.allowed.includes(`${owner}/${repo}`.toLowerCase());

// ── GitHub CLI console ────────────────────────────────────────────────────
// A safe, web-based `gh`-style console. Commands are NOT shelled out — they are
// parsed and routed to the GitHub REST API via gh() below. This means no shell
// injection is possible and no gh binary is needed. Read commands need
// github_read; mutating commands need github_write; every command is scoped to
// repositories the actor has been granted (and a few destructive ops are hard-
// blocked for everyone but admins).
const READ_METHODS = new Set(['GET', 'HEAD']);
// Split a command line into tokens, honouring single/double quotes.
const tokenize = (s) => {
  const out = []; const re = /"([^"]*)"|'([^']*)'|(\S+)/g; let m;
  while ((m = re.exec(s)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
};
const normPath = (p) => '/' + String(p || '').replace(/^https?:\/\/api\.github\.com/i, '').replace(/^\/+/, '');
// A repo path like /repos/owner/name/... — returns [owner, name] or null.
const repoOfPath = (p) => { const m = normPath(p).match(/^\/repos\/([^/?#]+)\/([^/?#]+)/); return m ? [m[1], m[2]] : null; };

// Build a {owner,repo}-scoped REST request from a parsed `gh api` invocation.
const buildApiCall = (tokens) => {
  let method = 'GET'; let path = null; const body = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-X' || t === '--method') { method = (tokens[++i] || 'GET').toUpperCase(); }
    else if (t === '-f' || t === '--raw-field' || t === '-F' || t === '--field') {
      const kv = tokens[++i] || ''; const eq = kv.indexOf('='); if (eq > 0) {
        const k = kv.slice(0, eq); let v = kv.slice(eq + 1);
        if (t === '-F' || t === '--field') { if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^-?\d+$/.test(v)) v = Number(v); }
        body[k] = v;
      }
      // a body field implies a write verb unless one was given
      if (method === 'GET') method = 'POST';
    } else if (t === '-q' || t === '--jq' || t === '-H' || t === '--header' || t === '--paginate' || t === '--slurp') { if (t === '-q' || t === '--jq' || t === '-H' || t === '--header') i++; /* ignore */ }
    else if (!t.startsWith('-') && !path) path = t;
  }
  return { method, path, body: Object.keys(body).length ? body : undefined };
};

const handleCli = async (req, res, actor, owner, repo) => {
  const raw = String(req.body?.command || '').trim();
  if (!raw) return res.status(400).json({ error: 'Empty command' });
  if (raw.length > 1000) return res.status(400).json({ error: 'Command too long' });
  // No shell features — we never exec; reject obvious shell metacharacters so a
  // user isn't misled into thinking piping/chaining works.
  if (/[|;&`$><\\]|\$\(/.test(raw)) return res.status(400).json({ error: 'Shell operators (| & ; $ ` > <) are not supported — this console runs GitHub API commands only.' });

  let tokens = tokenize(raw);
  if (tokens[0] === 'gh') tokens = tokens.slice(1);
  const sub = (tokens[0] || '').toLowerCase();
  const rest = tokens.slice(1);
  const scoped = (path) => `/repos/${owner}/${repo}/${String(path).replace(/^\/+/, '')}`;
  const run = async (method, path, body) => {
    const data = await gh(path, { method, body });
    return res.status(200).json({ ok: true, command: raw, method, path, data });
  };
  const needWrite = () => { if (!actor.write) { res.status(403).json({ error: 'This command writes — you need the github_write permission.' }); return true; } return false; };

  try {
    if (sub === 'help' || sub === '') {
      return res.status(200).json({ ok: true, help: true, output: [
        'GitHub CLI console — runs against this repository via the GitHub API.',
        '',
        'Read:',
        '  gh repo view',
        '  gh pr list                 gh pr view <n>',
        '  gh issue list              gh issue view <n>',
        '  gh branch list             gh release list',
        '  gh run list                gh workflow list',
        '  gh api repos/' + owner + '/' + repo + '/contributors',
        '',
        'Write (needs github_write):',
        '  gh pr create --title "T" --head <branch> [--base <b>] [--body "B"]',
        '  gh pr merge <n>            gh pr close <n>',
        '  gh issue create --title "T" [--body "B"]   gh issue close <n>',
        '  gh api -X POST repos/' + owner + '/' + repo + '/labels -f name=bug -f color=ff0000',
        '',
        'Notes: scoped to repos an admin granted you. Shell pipes/redirects are not supported.',
      ].join('\n') });
    }

    // Generic passthrough: gh api [-X METHOD] <path> [-f k=v ...]
    if (sub === 'api') {
      const { method, path, body } = buildApiCall(rest);
      if (!path) return res.status(400).json({ error: 'Usage: gh api [-X METHOD] <path> [-f key=value ...]' });
      const np = normPath(path);
      const rp = repoOfPath(np);
      // Hard block: deleting/transferring a repository, and org-level mutations.
      if (!actor.allRepos) {
        if (/^DELETE$/i.test(method) && rp && np.replace(/\/+$/, '') === `/repos/${rp[0]}/${rp[1]}`) return res.status(403).json({ error: 'Deleting a repository is not allowed from this console.' });
        if (/^\/orgs\//i.test(np) && !READ_METHODS.has(method)) return res.status(403).json({ error: 'Organisation-level changes are not allowed from this console.' });
      }
      if (rp) { if (!repoAllowed(actor, rp[0], rp[1])) return res.status(403).json({ error: `Repository ${rp[0]}/${rp[1]} has not been granted to you.` }); }
      else if (!READ_METHODS.has(method) && !actor.allRepos) return res.status(403).json({ error: 'Only repository-scoped writes are allowed from this console.' });
      if (!READ_METHODS.has(method) && needWrite()) return;
      const out = await run(method, np, body);
      await logAudit('staff', actor.email, 'github_cli', `${method} ${np}`.slice(0, 200)).catch(() => {});
      return out;
    }

    // Friendly aliases, all scoped to the selected repo.
    if (sub === 'repo' && (rest[0] === 'view' || !rest[0])) return run('GET', `/repos/${owner}/${repo}`);
    if (sub === 'branch' && (rest[0] === 'list' || !rest[0])) return run('GET', scoped('branches?per_page=100'));
    if (sub === 'release' && (rest[0] === 'list' || !rest[0])) return run('GET', scoped('releases?per_page=50'));
    if (sub === 'run' && (rest[0] === 'list' || !rest[0])) return run('GET', scoped('actions/runs?per_page=30'));
    if (sub === 'workflow' && (rest[0] === 'list' || !rest[0])) return run('GET', scoped('actions/workflows'));
    if (sub === 'label' && (rest[0] === 'list' || !rest[0])) return run('GET', scoped('labels?per_page=100'));

    if (sub === 'pr') {
      const op = rest[0] || 'list';
      if (op === 'list') return run('GET', scoped(`pulls?state=${/* */ 'open'}&per_page=30`));
      if (op === 'view' && rest[1]) return run('GET', scoped(`pulls/${parseInt(rest[1], 10)}`));
      const flags = parseFlags(rest.slice(1));
      if (op === 'create') { if (needWrite()) return; if (!flags.title || !flags.head) return res.status(400).json({ error: 'gh pr create --title "T" --head <branch> [--base <b>] [--body "B"]' }); const r = await gh(scoped('pulls'), { method: 'POST', body: { title: flags.title, head: flags.head, base: flags.base || (await gh(`/repos/${owner}/${repo}`)).default_branch, body: flags.body || '' } }); await logAudit('staff', actor.email, 'github_cli_pr_created', `${repo}#${r.number}`).catch(() => {}); return res.status(200).json({ ok: true, command: raw, data: { number: r.number, url: r.html_url } }); }
      if (op === 'merge' && rest[1]) { if (needWrite()) return; const r = await gh(scoped(`pulls/${parseInt(rest[1], 10)}/merge`), { method: 'PUT', body: { merge_method: 'squash' } }); await logAudit('staff', actor.email, 'github_cli_pr_merged', `${repo}#${rest[1]}`).catch(() => {}); return res.status(200).json({ ok: true, command: raw, data: r }); }
      if (op === 'close' && rest[1]) { if (needWrite()) return; const r = await gh(scoped(`pulls/${parseInt(rest[1], 10)}`), { method: 'PATCH', body: { state: 'closed' } }); await logAudit('staff', actor.email, 'github_cli_pr_closed', `${repo}#${rest[1]}`).catch(() => {}); return res.status(200).json({ ok: true, command: raw, data: { number: r.number, state: r.state } }); }
      return res.status(400).json({ error: 'Usage: gh pr list | view <n> | create … | merge <n> | close <n>' });
    }

    if (sub === 'issue') {
      const op = rest[0] || 'list';
      if (op === 'list') return run('GET', scoped('issues?state=open&per_page=30'));
      if (op === 'view' && rest[1]) return run('GET', scoped(`issues/${parseInt(rest[1], 10)}`));
      const flags = parseFlags(rest.slice(1));
      if (op === 'create') { if (needWrite()) return; if (!flags.title) return res.status(400).json({ error: 'gh issue create --title "T" [--body "B"]' }); const r = await gh(scoped('issues'), { method: 'POST', body: { title: flags.title, body: flags.body || '' } }); await logAudit('staff', actor.email, 'github_cli_issue_created', `${repo}#${r.number}`).catch(() => {}); return res.status(200).json({ ok: true, command: raw, data: { number: r.number, url: r.html_url } }); }
      if (op === 'close' && rest[1]) { if (needWrite()) return; const r = await gh(scoped(`issues/${parseInt(rest[1], 10)}`), { method: 'PATCH', body: { state: 'closed' } }); await logAudit('staff', actor.email, 'github_cli_issue_closed', `${repo}#${rest[1]}`).catch(() => {}); return res.status(200).json({ ok: true, command: raw, data: { number: r.number, state: r.state } }); }
      return res.status(400).json({ error: 'Usage: gh issue list | view <n> | create … | close <n>' });
    }

    return res.status(400).json({ error: `Unsupported command: "${sub}". Type \`gh help\` for the supported commands.` });
  } catch (err) {
    return res.status(err.code === 503 ? 503 : 200).json({ ok: false, command: raw, error: err.message });
  }
};
// Parse --flag value / --flag="value" pairs from alias commands.
const parseFlags = (toks) => {
  const f = {};
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.startsWith('--')) { const eq = t.indexOf('='); if (eq > 0) { f[t.slice(2, eq)] = t.slice(eq + 1); } else { f[t.slice(2)] = toks[++i] ?? true; } }
  }
  return f;
};

const gh = async (path, { method = 'GET', body } = {}) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw Object.assign(new Error('GitHub is not connected. Set GITHUB_TOKEN (and optional GITHUB_OWNER) in the environment.'), { code: 503 });
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || `GitHub ${res.status}`), { code: res.status });
  return data;
};

export default async function handler(req, res) {
  const actor = await getGhActor(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (req.method === 'GET' && !actor.read) return res.status(403).json({ error: 'No GitHub access — ask an admin to grant the github_read permission' });
  const owner = req.query.owner || process.env.GITHUB_OWNER;
  const repo = req.query.repo;

  // GitHub CLI console — own permission model (read commands need read, write
  // commands need write), so it is handled before the blanket POST-write guard.
  if (req.method === 'POST' && req.body?.action === 'cli') {
    if (!actor.read) return res.status(403).json({ error: 'No GitHub access — ask an admin to grant the github_read permission' });
    if (!owner || !repo) return res.status(400).json({ error: 'Select a repository first' });
    if (!repoAllowed(actor, owner, repo)) return res.status(403).json({ error: 'This repository has not been granted to you by an admin' });
    return handleCli(req, res, actor, owner, repo);
  }

  if (req.method === 'POST' && !actor.write) return res.status(403).json({ error: 'No GitHub write access — ask an admin to grant the github_write permission' });

  try {
    if (req.method === 'GET') {
      // connection status
      if (req.query.status === '1') {
        if (!process.env.GITHUB_TOKEN) return res.status(200).json({ connected: false });
        const me = await gh('/user').catch(() => null);
        return res.status(200).json({ connected: true, login: me?.login || 'token', owner: owner || null, canWrite: actor.write });
      }
      // repos
      if (req.query.repos === '1') {
        const list = owner
          ? await gh(`/users/${owner}/repos?sort=pushed&per_page=30`).catch(() => gh(`/orgs/${owner}/repos?sort=pushed&per_page=30`))
          : await gh('/user/repos?sort=pushed&per_page=30');
        const mapped = list.map((r) => ({ name: r.name, full_name: r.full_name, private: r.private, stars: r.stargazers_count, open_issues: r.open_issues_count, pushed_at: r.pushed_at, default_branch: r.default_branch, url: r.html_url, clone_url: r.clone_url, ssh_url: r.ssh_url }));
        return res.status(200).json({
          repos: actor.allRepos ? mapped : mapped.filter((r) => actor.allowed.includes(r.full_name.toLowerCase()))
        });
      }
      if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
      if (!repoAllowed(actor, owner, repo)) return res.status(403).json({ error: 'This repository has not been granted to you by an admin' });
      // collaborators (only for members granted collaborator_manage)
      if (req.query.collaborators === '1') {
        if (!actor.collab) return res.status(403).json({ error: 'No collaborator-management access — ask an admin to grant the collaborator_manage permission' });
        const list = await gh(`/repos/${owner}/${repo}/collaborators?per_page=100`);
        return res.status(200).json({ collaborators: list.map((c) => ({ login: c.login, avatar: c.avatar_url, url: c.html_url, role: c.role_name || (c.permissions?.admin ? 'admin' : c.permissions?.push ? 'write' : 'read') })) });
      }
      // branches
      if (req.query.branches === '1') {
        const list = await gh(`/repos/${owner}/${repo}/branches?per_page=50`);
        return res.status(200).json({ branches: list.map((b) => ({ name: b.name, protected: b.protected, sha: b.commit?.sha?.slice(0, 7) })) });
      }
      // pull requests
      if (req.query.prs === '1') {
        const list = await gh(`/repos/${owner}/${repo}/pulls?state=${req.query.state || 'open'}&per_page=30`);
        return res.status(200).json({
          prs: list.map((p) => ({ number: p.number, title: p.title, author: p.user?.login, state: p.state, draft: p.draft, branch: p.head?.ref, base: p.base?.ref, url: p.html_url, created_at: p.created_at, reviewers: (p.requested_reviewers || []).map((u) => u.login) }))
        });
      }
      // commits (optionally for a branch via &sha=)
      if (req.query.commits === '1') {
        const shaQ = req.query.ref ? `&sha=${encodeURIComponent(req.query.ref)}` : '';
        const list = await gh(`/repos/${owner}/${repo}/commits?per_page=30${shaQ}`);
        return res.status(200).json({ commits: list.map((c) => ({ sha: c.sha.slice(0, 7), fullSha: c.sha, message: c.commit?.message?.split('\n')[0], author: c.commit?.author?.name, date: c.commit?.author?.date, url: c.html_url })) });
      }
      // file tree for a branch — { files:[{path,size}] }
      if (req.query.tree === '1') {
        const refName = req.query.ref || (await gh(`/repos/${owner}/${repo}`)).default_branch;
        const br = await gh(`/repos/${owner}/${repo}/branches/${encodeURIComponent(refName)}`);
        const t = await gh(`/repos/${owner}/${repo}/git/trees/${br.commit.commit.tree.sha}?recursive=1`);
        const files = (t.tree || []).filter((n) => n.type === 'blob').map((n) => ({ path: n.path, size: n.size }));
        return res.status(200).json({ files, truncated: Boolean(t.truncated), ref: refName });
      }
      // a single file's content at a ref
      if (req.query.file) {
        const ref = req.query.ref ? `?ref=${encodeURIComponent(req.query.ref)}` : '';
        const ghPath = String(req.query.file).split('/').map(encodeURIComponent).join('/');
        const f = await gh(`/repos/${owner}/${repo}/contents/${ghPath}${ref}`);
        const content = f.content ? Buffer.from(f.content, 'base64').toString('utf8') : '';
        return res.status(200).json({ path: f.path, content, sha: f.sha, size: f.size, canWrite: actor.write });
      }
      // a single commit with its file diffs/patches
      if (req.query.commit) {
        const c = await gh(`/repos/${owner}/${repo}/commits/${encodeURIComponent(req.query.commit)}`);
        return res.status(200).json({
          sha: c.sha.slice(0, 7), message: c.commit?.message, author: c.commit?.author?.name, date: c.commit?.author?.date,
          files: (c.files || []).map((f) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch || '' }))
        });
      }
      return res.status(400).json({ error: 'Unknown query' });
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};
      if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
      if (!repoAllowed(actor, owner, repo)) return res.status(403).json({ error: 'This repository has not been granted to you by an admin' });
      const actorEmail = actor.email;

      if (action === 'create_branch') {
        const { branch, from } = req.body;
        if (!branch) return res.status(400).json({ error: 'branch required' });
        const base = from || (await gh(`/repos/${owner}/${repo}`)).default_branch;
        const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${base}`);
        await gh(`/repos/${owner}/${repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: ref.object.sha } });
        await logAudit('staff', actorEmail, 'github_branch_created', `${repo}:${branch}`);
        return res.status(200).json({ ok: true, branch });
      }
      if (action === 'create_pr') {
        const { title, head, base, body: prBody } = req.body;
        if (!title || !head) return res.status(400).json({ error: 'title and head branch required' });
        const baseBranch = base || (await gh(`/repos/${owner}/${repo}`)).default_branch;
        const pr = await gh(`/repos/${owner}/${repo}/pulls`, { method: 'POST', body: { title, head, base: baseBranch, body: prBody || '' } });
        await logAudit('staff', actorEmail, 'github_pr_created', `${repo}#${pr.number}`);
        return res.status(200).json({ ok: true, number: pr.number, url: pr.html_url });
      }
      if (action === 'delete_branch') {
        const { branch } = req.body;
        if (!branch) return res.status(400).json({ error: 'branch required' });
        await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, { method: 'DELETE' });
        await logAudit('staff', actorEmail, 'github_branch_deleted', `${repo}:${branch}`);
        return res.status(200).json({ ok: true });
      }
      if (action === 'merge_pr') {
        const { number } = req.body;
        const out = await gh(`/repos/${owner}/${repo}/pulls/${number}/merge`, { method: 'PUT', body: { merge_method: 'squash' } });
        await logAudit('staff', actorEmail, 'github_pr_merged', `${repo}#${number}`);
        return res.status(200).json({ ok: true, merged: out.merged });
      }
      if (action === 'close_pr') {
        const { number } = req.body;
        await gh(`/repos/${owner}/${repo}/pulls/${number}`, { method: 'PATCH', body: { state: 'closed' } });
        await logAudit('staff', actorEmail, 'github_pr_closed', `${repo}#${number}`);
        return res.status(200).json({ ok: true });
      }
      if (action === 'put_file') {
        // Commit an edited file (write permission enforced by the POST guard above).
        const { path: fp, content, message, branch, sha } = req.body;
        if (!fp || content === undefined) return res.status(400).json({ error: 'path and content required' });
        const ghPath = String(fp).split('/').map(encodeURIComponent).join('/');
        const out = await gh(`/repos/${owner}/${repo}/contents/${ghPath}`, {
          method: 'PUT',
          body: { message: message || `Update ${fp} via portal`, content: Buffer.from(String(content), 'utf8').toString('base64'), sha: sha || undefined, branch: branch || undefined }
        });
        await logAudit('staff', actorEmail, 'github_file_committed', `${repo}:${fp}`);
        return res.status(200).json({ ok: true, commit: out.commit?.sha?.slice(0, 7) });
      }
      if (action === 'add_collaborator') {
        if (!actor.collab) return res.status(403).json({ error: 'No collaborator-management access' });
        const { username, permission } = req.body;
        if (!username) return res.status(400).json({ error: 'username required' });
        const perm = ['pull', 'triage', 'push', 'maintain', 'admin'].includes(permission) ? permission : 'push';
        const out = await gh(`/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`, { method: 'PUT', body: { permission: perm } });
        await logAudit('staff', actorEmail, 'github_collaborator_added', `${repo}:${username} (${perm})`);
        return res.status(200).json({ ok: true, invited: Boolean(out?.id) });
      }
      if (action === 'remove_collaborator') {
        if (!actor.collab) return res.status(403).json({ error: 'No collaborator-management access' });
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'username required' });
        await gh(`/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`, { method: 'DELETE' });
        await logAudit('staff', actorEmail, 'github_collaborator_removed', `${repo}:${username}`);
        return res.status(200).json({ ok: true });
      }
      if (action === 'request_review') {
        const { number, reviewers } = req.body;
        await gh(`/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`, { method: 'POST', body: { reviewers: [].concat(reviewers || []) } });
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err.code === 503 ? 503 : 500).json({ error: err.message });
  }
}
