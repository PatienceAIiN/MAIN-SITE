// Outbound GitHub integration — PatienceAI as the operational interface.
// Uses a fine-grained PAT or GitHub App installation token via GITHUB_TOKEN
// (+ optional GITHUB_OWNER default org/user). Read endpoints for repos,
// branches and PRs; write endpoints for branch create and PR merge/close.
// Admin + executives only. Degrades with a clear hint when unconfigured.
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession } from './_security.js';
import { logAudit } from './_ticketing.js';

const allowed = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)) || getExecSession(req));

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
  if (!allowed(req)) return res.status(401).json({ error: 'Not authenticated' });
  const owner = req.query.owner || process.env.GITHUB_OWNER;
  const repo = req.query.repo;

  try {
    if (req.method === 'GET') {
      // connection status
      if (req.query.status === '1') {
        if (!process.env.GITHUB_TOKEN) return res.status(200).json({ connected: false });
        const me = await gh('/user').catch(() => null);
        return res.status(200).json({ connected: true, login: me?.login || 'token', owner: owner || null });
      }
      // repos
      if (req.query.repos === '1') {
        const list = owner
          ? await gh(`/users/${owner}/repos?sort=pushed&per_page=30`).catch(() => gh(`/orgs/${owner}/repos?sort=pushed&per_page=30`))
          : await gh('/user/repos?sort=pushed&per_page=30');
        return res.status(200).json({
          repos: list.map((r) => ({ name: r.name, full_name: r.full_name, private: r.private, stars: r.stargazers_count, open_issues: r.open_issues_count, pushed_at: r.pushed_at, default_branch: r.default_branch, url: r.html_url }))
        });
      }
      if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
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
      // commits
      if (req.query.commits === '1') {
        const list = await gh(`/repos/${owner}/${repo}/commits?per_page=20`);
        return res.status(200).json({ commits: list.map((c) => ({ sha: c.sha.slice(0, 7), message: c.commit?.message?.split('\n')[0], author: c.commit?.author?.name, date: c.commit?.author?.date, url: c.html_url })) });
      }
      return res.status(400).json({ error: 'Unknown query' });
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};
      if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
      const exec = getExecSession(req);
      const actorEmail = exec?.email || 'admin';

      if (action === 'create_branch') {
        const { branch, from } = req.body;
        if (!branch) return res.status(400).json({ error: 'branch required' });
        const base = from || (await gh(`/repos/${owner}/${repo}`)).default_branch;
        const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${base}`);
        await gh(`/repos/${owner}/${repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: ref.object.sha } });
        await logAudit('staff', actorEmail, 'github_branch_created', `${repo}:${branch}`);
        return res.status(200).json({ ok: true, branch });
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
