import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiEye, FiEyeOff, FiSun, FiMoon } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import AdminTicketOps from '../components/AdminTicketOps';
import AdminPeos from '../components/AdminPeos';
import AdminGrowth from '../components/AdminGrowth';
import { ServiceDetail } from '../components/RenderServices';
import { confirmDialog } from '../common/confirm';
import { fetchJson } from '../common/fetchJson';

const TABS = ['analytics', 'content', 'blog', 'submissions', 'responses', 'conversations', 'support', 'executives', 'team', 'growth', 'deploy', 'tickets', 'engineering', 'worklog', 'logs'];

/* ── Security & audit log viewer: every recorded event, exportable ───────── */
function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    fetchJson('/api/ticket-stats?audit=1&limit=1000').then((d) => setLogs(d.logs || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);
  const needle = q.trim().toLowerCase();
  const filtered = logs.filter((l) => !needle || JSON.stringify(l).toLowerCase().includes(needle));
  const COLOR = { login: 'text-emerald-300', login_failed: 'text-red-300', team_member_removed: 'text-red-300', ticket_escalated: 'text-amber-300' };
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Security & Audit Logs</h2>
          <p className="text-white/55 text-sm mt-1">Every recorded event — logins (incl. failures), permission & roster changes, GitHub actions, deployments via webhook, escalations, deletions. Newest first.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/ticket-stats?audit=1&limit=5000&format=pdf" className="text-xs px-4 py-2 rounded-xl bg-white text-slate-950 font-semibold hover:bg-white/90">Download PDF report</a>
          <a href="/api/ticket-stats?audit=1&limit=5000&format=xlsx" className="text-xs px-4 py-2 rounded-xl border border-white/15 text-white/80 hover:bg-white/5">Download XLSX</a>
          <button onClick={load} className="text-xs px-3 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5">{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by actor, action, target, details…"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70" />
      <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-[150px_90px_1fr_1fr_1fr] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40 border-b border-white/10">
          <span>Time</span><span>Role</span><span>Actor</span><span>Action → Target</span><span>Details</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/5">
          {!filtered.length && <p className="text-white/35 text-sm p-5 text-center">{loading ? 'Loading…' : 'No log entries match.'}</p>}
          {filtered.map((l, i) => (
            <div key={i} className="grid grid-cols-[150px_90px_1fr_1fr_1fr] gap-2 px-4 py-2 text-xs items-start hover:bg-white/[0.03]">
              <span className="text-white/40 font-mono text-[10px]">{new Date(l.created_at).toLocaleString()}</span>
              <span className="text-white/50 capitalize">{l.actor_role || '—'}</span>
              <span className="text-white/70 truncate">{l.actor_email || '—'}</span>
              <span className={`font-medium truncate ${COLOR[l.action] || 'text-cyan-200'}`}>{l.action}{l.target ? ` → ${l.target}` : ''}</span>
              <span className="text-white/45 truncate">{l.metadata ? (typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata)) : ''}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-white/30">Exports include up to 5,000 most recent events; the table shows 1,000 and auto-refreshes every 30s.</p>
    </div>
  );
}

/* ── Worklog: per-person daily worked hours from presence transitions ─────── */
function AdminWorkLog() {
  const [data, setData] = useState({ rows: [], targetHours: 9 });
  const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); fetchJson('/api/work-log?days=14').then(setData).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);
  const hrs = (s) => (s / 3600);
  const fmtH = (s) => `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Worklog</h2>
          <p className="text-white/55 text-sm mt-1">Daily worked hours per team member &amp; executive (online time; away/offline excluded). Target {data.targetHours}h/day. Last 14 days.</p>
        </div>
        <button onClick={load} className="text-xs px-3 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5">{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-[110px_1fr_120px_120px_1fr] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40 border-b border-white/10">
          <span>Date</span><span>Person</span><span>Worked</span><span>Away</span><span>vs {data.targetHours}h target</span>
        </div>
        <div className="max-h-[62vh] overflow-y-auto divide-y divide-white/5">
          {!data.rows.length && <p className="text-white/35 text-sm p-5 text-center">No work activity recorded yet.</p>}
          {data.rows.map((r, i) => {
            const pct = Math.min(100, (hrs(r.workedSeconds) / data.targetHours) * 100);
            const met = hrs(r.workedSeconds) >= data.targetHours;
            return (
              <div key={i} className="grid grid-cols-[110px_1fr_120px_120px_1fr] gap-2 px-4 py-2 text-xs text-white/70 items-center">
                <span className="text-white/50">{r.day}</span>
                <span className="truncate">{r.name} <span className="text-white/35">· {(r.role || '').replace(/_/g, ' ')}</span></span>
                <span className={met ? 'text-emerald-300' : 'text-amber-300'}>{fmtH(r.workedSeconds)}</span>
                <span className="text-white/40">{fmtH(r.awaySeconds)}</span>
                <span className="flex items-center gap-2">
                  <span className="flex-1 h-1.5 rounded-full bg-white/10"><span className={`block h-1.5 rounded-full ${met ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} /></span>
                  <span className="text-[10px] text-white/40 w-9 text-right">{Math.round(pct)}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Deploy management: who may deploy, optional password, deploy history ─── */
/* ── Responses: every form submission grouped by type (contact, sales, demo…) ── */
const RESPONSE_GROUPS = [
  { key: 'contact', label: 'Contact Us', match: (s) => s === 'contact' },
  { key: 'sales', label: 'Sales Enquiries', match: (s) => s === 'sales' || s === 'chatbot' },
  { key: 'product-demo', label: 'Product Demo Requests', match: (s) => s === 'product-demo' },
  { key: 'careers', label: 'Job Inquiries', match: (s) => s === 'careers' || s === 'job-inquiry-chat' },
  { key: 'newsletter', label: 'Newsletter Signups', match: (s) => s === 'newsletter' },
];
const STATUS_TINT = { new: 'bg-cyan-500/20 text-cyan-200', reviewing: 'bg-amber-500/20 text-amber-200', replied: 'bg-emerald-500/20 text-emerald-200', archived: 'bg-white/10 text-white/50' };

function AdminResponses() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const [busyId, setBusyId] = useState(null);
  const load = () => {
    setLoading(true); setErr('');
    fetchJson('/api/admin').then((d) => setItems(d.items || [])).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  const setStatus = async (id, status) => {
    setBusyId(id);
    try {
      const d = await fetchJson('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (d.item) setItems((cur) => cur.map((it) => (it.id === d.item.id ? d.item : it)));
    } catch (e) { setErr(e.message); } finally { setBusyId(null); }
  };
  const remove = async (id) => {
    if (!(await confirmDialog({ title: 'Delete response', message: 'Permanently delete this submission?', confirmText: 'Delete', danger: true }))) return;
    setBusyId(id);
    try { await fetchJson('/api/admin', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); setItems((cur) => cur.filter((it) => it.id !== id)); }
    catch (e) { setErr(e.message); } finally { setBusyId(null); }
  };

  const needle = q.trim().toLowerCase();
  const visible = items.filter((it) => !needle || JSON.stringify(it).toLowerCase().includes(needle));
  const grouped = RESPONSE_GROUPS.map((g) => ({ ...g, rows: visible.filter((it) => g.match((it.source || '').toLowerCase())) }));
  // Anything with an unrecognised source lands in a catch-all "Other" group.
  const other = visible.filter((it) => !RESPONSE_GROUPS.some((g) => g.match((it.source || '').toLowerCase())));
  if (other.length) grouped.push({ key: 'other', label: 'Other', rows: other });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Responses</h2>
          <p className="text-white/55 text-sm mt-1">Every form submission from the website — Contact Us, Sales, Product Demo, Job Inquiries and more — grouped by type. Newest first. Auto-refreshes every 30s.</p>
        </div>
        <button onClick={load} className="text-xs px-3 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 self-start">{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search across all responses…"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70" />
      {err && <p className="text-red-300 text-sm">{err}</p>}
      <div className="space-y-5">
        {grouped.map((g) => (
          <div key={g.key} className="rounded-[1.5rem] border border-white/10 bg-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white/90">{g.label}</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{g.rows.length}</span>
            </div>
            {!g.rows.length ? (
              <p className="text-white/30 text-xs p-4">No {g.label.toLowerCase()} yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {g.rows.map((it) => {
                  const isOpen = open[it.id];
                  return (
                    <div key={it.id} className="px-4 py-3 text-sm hover:bg-white/[0.03]">
                      <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setOpen((o) => ({ ...o, [it.id]: !o[it.id] }))}>
                        <div className="min-w-0">
                          <p className="font-medium text-white/90 truncate">{it.name} <span className="text-white/40 font-normal">· {it.email}</span></p>
                          <p className="text-white/55 truncate">{it.subject}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${STATUS_TINT[it.status] || 'bg-white/10 text-white/50'}`}>{it.status}</span>
                          <span className="text-[10px] text-white/35 font-mono hidden sm:inline">{new Date(it.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                          {it.company && <p className="text-white/60 text-xs"><span className="text-white/40">Company:</span> {it.company}</p>}
                          {it.product_name && <p className="text-white/60 text-xs"><span className="text-white/40">Product:</span> {it.product_name}</p>}
                          <p className="text-white/40 text-[10px] uppercase tracking-wider">Message</p>
                          <p className="text-white/75 whitespace-pre-wrap leading-relaxed text-xs">{it.message}</p>
                          <p className="text-white/30 text-[10px] font-mono">{new Date(it.created_at).toLocaleString()} · source: {it.source}</p>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {['new', 'reviewing', 'replied', 'archived'].map((st) => (
                              <button key={st} disabled={busyId === it.id || it.status === st} onClick={() => setStatus(it.id, st)}
                                className={`text-[10px] px-2.5 py-1 rounded-lg capitalize transition-colors disabled:opacity-40 ${it.status === st ? 'bg-white text-slate-950' : 'border border-white/15 text-white/70 hover:bg-white/10'}`}>{st}</button>
                            ))}
                            <button disabled={busyId === it.id} onClick={() => remove(it.id)} className="text-[10px] px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-40 ml-auto">Delete</button>
                            <a href={`mailto:${it.email}?subject=Re: ${encodeURIComponent(it.subject)}`} className="text-[10px] px-2.5 py-1 rounded-lg border border-white/15 text-white/70 hover:bg-white/10">Reply</a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminDeploy() {
  const [members, setMembers]   = useState([]);
  const [allowed, setAllowed]   = useState([]);          // emails granted deploy access
  const [passwordSet, setPwSet] = useState(false);
  const [newPw, setNewPw]       = useState('');
  const [history, setHistory]   = useState([]);
  const [msg, setMsg]           = useState('');
  const [busy, setBusy]         = useState(false);

  const load = async () => {
    try {
      const [cfg, tm, dep] = await Promise.all([
        fetchJson('/api/deploy/config'),
        fetchJson('/api/team-members').catch(() => ({ members: [] })),
        fetchJson('/api/deploy').catch(() => ({ recent: [] }))
      ]);
      setAllowed(cfg.allowedEmails || []); setPwSet(Boolean(cfg.passwordSet));
      setMembers(tm.members || []); setHistory(dep.recent || []);
    } catch (e) { setMsg(e.message); }
  };
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  const toggle = (email) => setAllowed((a) => a.includes(email) ? a.filter((x) => x !== email) : [...a, email]);
  const save = async (extra = {}) => {
    setBusy(true); setMsg('');
    try {
      const r = await fetchJson('/api/deploy/config', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedEmails: allowed, ...extra }) });
      setAllowed(r.allowedEmails || []); setPwSet(Boolean(r.passwordSet)); setNewPw('');
      setMsg('Saved.');
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Deploy</h2>
        <p className="text-white/55 text-sm mt-1">Choose who can deploy from the team portal, set an optional deploy password, and review the deployment history (who, when, and which commit/PR).</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Allow-list */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold mb-1">Allowed deployers</p>
          <p className="text-white/45 text-xs mb-3">Selected team members see the Deploy button & controls on login.</p>
          <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
            {members.map((m) => (
              <label key={m.email} className="flex items-center gap-3 py-2 cursor-pointer">
                <input type="checkbox" checked={allowed.includes(m.email.toLowerCase())} onChange={() => toggle(m.email.toLowerCase())} className="accent-cyan-400" />
                <span className="min-w-0">
                  <span className="block text-sm text-white truncate">{m.name} <span className="text-white/40 text-xs">· {(m.team_role || 'member').replace(/_/g, ' ')}</span></span>
                  <span className="block text-xs text-white/40 truncate">{m.email}</span>
                </span>
              </label>
            ))}
            {!members.length && <p className="text-white/35 text-sm py-3">No team members yet.</p>}
          </div>
          <button onClick={() => save()} disabled={busy} className="mt-3 text-xs px-4 py-2 rounded-xl bg-white text-slate-950 font-semibold hover:bg-white/90 disabled:opacity-50">Save access list</button>
        </div>

        {/* Password */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold mb-1">Deploy password</p>
          <p className="text-white/45 text-xs mb-3">Status: <span className={passwordSet ? 'text-emerald-300' : 'text-amber-300'}>{passwordSet ? 'set — required to deploy' : 'not set'}</span></p>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New deploy password (min 4 chars)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 mb-3" />
          <div className="flex items-center gap-2">
            <button onClick={() => newPw && save({ password: newPw })} disabled={busy || !newPw} className="text-xs px-4 py-2 rounded-xl bg-white text-slate-950 font-semibold hover:bg-white/90 disabled:opacity-50">{passwordSet ? 'Change password' : 'Set password'}</button>
            {passwordSet && <button onClick={() => save({ clearPassword: true })} disabled={busy} className="text-xs px-4 py-2 rounded-xl border border-white/15 text-white/80 hover:bg-white/5">Remove password</button>}
          </div>
        </div>
      </div>
      {msg && <p className="text-xs text-white/60">{msg}</p>}

      {/* History */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_90px_1fr_90px] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40 border-b border-white/10">
          <span>Time</span><span>Triggered by</span><span>Commit</span><span>PR / Note</span><span>Status</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-white/5">
          {!history.length && <p className="text-white/35 text-sm p-5 text-center">No deployments recorded yet.</p>}
          {history.map((d) => (
            <div key={d.id} className="grid grid-cols-[160px_1fr_90px_1fr_90px] gap-2 px-4 py-2 text-xs text-white/70 items-center">
              <span className="text-white/50">{new Date(d.created_at).toLocaleString()}</span>
              <span className="truncate">{d.triggered_by}</span>
              <span className="font-mono text-white/60">{d.commit_sha || '—'}</span>
              <span className="truncate">{d.pr || d.commit_msg || d.note || '—'}</span>
              <span className={['failed', 'build_failed', 'cancelled', 'canceled'].includes(d.status) ? 'text-red-300' : d.status === 'live' ? 'text-emerald-300' : 'text-amber-300'}>{d.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-repo deploy targets — each repo + its own Render deploy hook
          (each card has its own Service & environment + env/settings/history). */}
      <DeployTargets />
    </div>
  );
}

/* ── Configure deployment per repo: each repo has its own Render deploy hook ── */
function DeployTargets() {
  const [targets, setTargets] = useState([]);
  const [repos, setRepos] = useState([]);
  const [members, setMembers] = useState([]);
  const [draft, setDraft] = useState({ label: '', repo: '', deployHook: '', apiKey: '', allowedEmails: [], ghToken: '', envPath: '', svcUnit: '' });
  const [msg, setMsg] = useState('');
  const load = () => fetchJson('/api/deploy/targets').then((d) => setTargets(d.targets || [])).catch((e) => setMsg(e.message));
  useEffect(() => {
    load();
    fetchJson('/api/github?repos=1').then((d) => setRepos((d.repos || []).map((r) => r.full_name))).catch(() => {});
    fetchJson('/api/team-members').then((d) => setMembers(d.members || [])).catch(() => {});
  }, []);
  const emailArr = (csv) => String(csv || '').split(',').map((x) => x.trim()).filter(Boolean);
  const repoOpts = (cur) => [<option key="" value="">Select repo…</option>, ...Array.from(new Set([...(cur ? [cur] : []), ...repos])).map((r) => <option key={r} value={r}>{r}</option>)];
  const add = async () => {
    if (!draft.label.trim() || !draft.repo.trim()) { setMsg('Label and repository are required.'); return; }
    try { await fetchJson('/api/deploy/targets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); setDraft({ label: '', repo: '', deployHook: '', apiKey: '', allowedEmails: [], ghToken: '', envPath: '', svcUnit: '' }); setMsg('Added ✓'); load(); }
    catch (e) { setMsg(e.message); }
  };
  const saveRow = async (t) => {
    try {
      const body = { id: t.id, label: t.label, repo: t.repo, deployHook: t.deploy_hook, apiKey: t.api_key || '', allowedEmails: emailArr(t.allowed_emails), envPath: t.env_path || '', svcUnit: t.svc_unit || '' };
      if (t.gh_token) body.ghToken = t.gh_token;   // only send a token when the admin typed a new one
      await fetchJson('/api/deploy/targets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setMsg(`Saved “${t.label}” ✓`); load(); }
    catch (e) { setMsg(e.message); }
  };
  const del = async (id) => { if (!(await confirmDialog({ title: 'Remove deploy target', message: 'Remove and delink this repo deployment? This does not affect the GitHub repo or its workflow.', confirmText: 'Remove' }))) return; try { await fetchJson(`/api/deploy/targets?id=${id}`, { method: 'DELETE' }); load(); } catch (e) { setMsg(e.message); } };
  const setField = (id, k, v) => setTargets((ts) => ts.map((t) => (t.id === id ? { ...t, [k]: v } : t)));
  const [openSvc, setOpenSvc] = useState(null);
  const svcId = (hook) => (String(hook || '').match(/deploy\/(srv-[a-z0-9]+)/i) || [])[1] || '';
  const inp = 'rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:outline-none';
  // Selects need a SOLID dark background or the native option list is white-on-white in dark mode.
  const sel = 'rounded-lg border border-white/10 bg-slate-800 text-white px-2.5 py-1.5 text-xs focus:outline-none [&>option]:bg-slate-800 [&>option]:text-white';
  const toggleEmail = (arr, e) => (arr.includes(e) ? arr.filter((x) => x !== e) : [...arr, e]);
  const memberChecks = (selected, onToggle) => (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2 max-h-28 overflow-y-auto space-y-1">
      {members.map((m) => { const e = m.email.toLowerCase(); return (
        <label key={e} className="flex items-center gap-2 text-[11px] text-white/80 cursor-pointer">
          <input type="checkbox" checked={selected.includes(e)} onChange={() => onToggle(e)} className="accent-cyan-400" />{m.name} · <span className="text-white/45">{m.email}</span>
        </label>); })}
      {!members.length && <p className="text-[10px] text-white/35">No team members.</p>}
    </div>
  );
  return (
    <div>
      <h3 className="text-lg font-semibold mb-1">Configure deployment (per repo)</h3>
      <p className="text-white/55 text-sm mb-3">Each repository deploys via its own GitHub Actions workflow. Team users pick a repo before deploying, and only that repo's workflow is dispatched — the build runs on GitHub and ships to the VM.</p>
      <div className="space-y-2">
        {targets.map((t) => (
          <div key={t.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="grid md:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center">
              <input className={inp} value={t.label} onChange={(e) => setField(t.id, 'label', e.target.value)} placeholder="Label (e.g. Main site)" />
              <select className={sel} value={t.repo || ''} onChange={(e) => setField(t.id, 'repo', e.target.value)}>{repoOpts(t.repo)}</select>
              <input className={`${inp} font-mono`} value={t.deploy_hook} onChange={(e) => setField(t.id, 'deploy_hook', e.target.value)} placeholder="Workflow file (default: deploy.yml)" />
              <span className="flex gap-1.5">
                <button onClick={() => saveRow(t)} className="text-xs px-3 py-1.5 rounded-lg bg-white text-slate-950 font-semibold">Save</button>
                <button onClick={() => del(t.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10">✕</button>
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              <input type="password" autoComplete="new-password" className={`${inp} font-mono`} value={t.gh_token || ''} onChange={(e) => setField(t.id, 'gh_token', e.target.value)} placeholder={t.hasToken ? 'GitHub PAT: •••• set (type to replace)' : 'GitHub PAT (needed only for repos under another owner)'} />
              <input className={`${inp} font-mono`} value={t.api_key || ''} onChange={(e) => setField(t.id, 'api_key', e.target.value)} placeholder="Git branch to deploy (default: main)" />
              <input className={`${inp} font-mono`} value={t.env_path || ''} onChange={(e) => setField(t.id, 'env_path', e.target.value)} placeholder="Env file path (auto for known apps)" />
              <input className={`${inp} font-mono`} value={t.svc_unit || ''} onChange={(e) => setField(t.id, 'svc_unit', e.target.value)} placeholder="systemd unit to restart (auto for known apps)" />
            </div>
            <div className="grid md:grid-cols-2 gap-2 items-start">
              <div className="text-[10px] text-white/45">Team users allowed to deploy this repo (none = all deploy-allowed users)
                {memberChecks(emailArr(t.allowed_emails), (e) => setField(t.id, 'allowed_emails', toggleEmail(emailArr(t.allowed_emails), e).join(',')))}
              </div>
              <p className="text-[10px] text-white/35 md:pt-4">The workflow file builds & ships to the VM; the PAT is only needed for repos under another GitHub owner. "Service & environment" edits this app's .env on the VM and restarts it.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {t.repo && <button onClick={() => setOpenSvc(openSvc === t.id ? null : t.id)} className="text-[11px] px-3 py-1 rounded-lg border border-white/15 text-white/80 hover:bg-white/5">{openSvc === t.id ? 'Hide' : 'Service & environment'}</button>}
              {t.repo && <a href={`https://github.com/${t.repo}/actions`} target="_blank" rel="noreferrer" className="text-[11px] px-3 py-1 rounded-lg border border-white/15 text-white/80 hover:bg-white/5">GitHub Actions ↗</a>}
              <button onClick={() => del(t.id)} className="text-[11px] px-3 py-1 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10">Remove &amp; delink</button>
            </div>
            {openSvc === t.id && t.repo && <ServiceDetail id={t.id} dark />}
          </div>
        ))}
        {/* New target */}
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-3 grid md:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center">
          <input className={inp} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="New label" />
          <select className={sel} value={draft.repo} onChange={(e) => setDraft({ ...draft, repo: e.target.value })}>{repoOpts(draft.repo)}</select>
          <input className={`${inp} font-mono`} value={draft.deployHook} onChange={(e) => setDraft({ ...draft, deployHook: e.target.value })} placeholder="Workflow file (default: deploy.yml)" />
          <button onClick={add} className="text-xs px-4 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white font-semibold">+ Add</button>
          <input className={`${inp} font-mono md:col-span-2`} value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="Git branch (default: main — optional)" />
          <input type="password" autoComplete="new-password" className={`${inp} font-mono md:col-span-2`} value={draft.ghToken} onChange={(e) => setDraft({ ...draft, ghToken: e.target.value })} placeholder="GitHub PAT (only for another-owner repos — optional)" />
          <div className="md:col-span-4 text-[10px] text-white/45">Team users allowed to deploy this repo (optional — none = all deploy-allowed users)
            {memberChecks(draft.allowedEmails, (e) => setDraft({ ...draft, allowedEmails: toggleEmail(draft.allowedEmails, e) }))}
          </div>
        </div>
      </div>
      {msg && <p className="text-xs text-white/60 mt-2">{msg}</p>}
    </div>
  );
}

const Spinner = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className="animate-spin"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4" strokeDashoffset="10" opacity="0.3" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
const STATUS_OPTIONS = ['all', 'new', 'reviewing', 'replied', 'archived'];

const createEmptyBlogDraft = () => ({
  slug: '',
  header: 'Product',
  title: '',
  by: 'Patience AI Team',
  publishedAt: new Date().toISOString().slice(0, 16),
  excerpt: '',
  tags: '',
  content: ''
});

const formatDate = (value) =>
  value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Unknown';

const AdminPage = ({ onAction, defaultContent, currentContent, currentContentSource, onContentSaved }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('content');
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('pa_admin_theme') || 'light'; } catch { return 'light'; } });
  const themeClass = theme === 'light' ? 'admin-light' : 'admin-dark';
  const toggleTheme = () => setTheme((t) => { const n = t === 'light' ? 'dark' : 'light'; try { localStorage.setItem('pa_admin_theme', n); } catch { /* ignore */ } return n; });
  const [contentJson, setContentJson] = useState(JSON.stringify(currentContent || defaultContent, null, 2));
  const [contentError, setContentError] = useState('');
  const [contentSaving, setContentSaving] = useState(false);
  const [blogDraft, setBlogDraft] = useState(createEmptyBlogDraft());
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState({ total: 0, new: 0, reviewing: 0, replied: 0, archived: 0 });
  const [submissionFilter, setSubmissionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessage, setEditingMessage] = useState('');

  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [visitorPage, setVisitorPage] = useState(0);
  const VISITORS_PER_PAGE = 10;
  const [supportColleagues, setSupportColleagues] = useState([]);
  const PRESENCE_DOT = { online: 'bg-emerald-500', away: 'bg-amber-500', offline: 'bg-slate-500' };

  const [supportSessions, setSupportSessions] = useState([]);
  const [supportSessionsLoading, setSupportSessionsLoading] = useState(false);
  const [selectedSupportId, setSelectedSupportId] = useState('');
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportMessagesLoading, setSupportMessagesLoading] = useState(false);
  const [supportReply, setSupportReply] = useState('');
  const [supportReplySending, setSupportReplySending] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [executiveName, setExecutiveName] = useState(() => {
    try { return window.localStorage.getItem('pa_exec_name') || ''; } catch { return ''; }
  });

  // Executives management tab
  const [executives, setExecutives]             = useState([]);
  const [execLoading, setExecLoading]           = useState(false);
  const [execError, setExecError]               = useState('');
  const [execInviteForm, setExecInviteForm]     = useState({ name: '', email: '' });
  const [execInviteSending, setExecInviteSending] = useState(false);
  const [execInviteSuccess, setExecInviteSuccess] = useState('');
  const [activityLogs, setActivityLogs]         = useState([]);
  const [activityLoading, setActivityLoading]   = useState(false);
  const [selectedExecId, setSelectedExecId]     = useState(null);

  // Team members (ticket portal) management tab
  const [teamMembers, setTeamMembers]           = useState([]);
  const [teamLoading, setTeamLoading]           = useState(false);
  const [teamError, setTeamError]               = useState('');
  const [teamInviteForm, setTeamInviteForm]     = useState({ name: '', email: '', teamRole: 'member' });
  const [teamInviteSending, setTeamInviteSending] = useState(false);
  const [teamInviteSuccess, setTeamInviteSuccess] = useState('');
  const [ghRepoList, setGhRepoList]             = useState(null); // null = not loaded yet
  const [repoPanelFor, setRepoPanelFor]         = useState(null); // member id whose repo-grant panel is open
  const selectedSubmission = submissions.find((item) => item.id === selectedId) || submissions[0] || null;

  // Per-member GitHub repo grants: only admin-granted repos are visible to a member.
  const toggleRepoPanel = async (memberId) => {
    if (repoPanelFor === memberId) { setRepoPanelFor(null); return; }
    setRepoPanelFor(memberId);
    if (ghRepoList === null) {
      try {
        const d = await fetchJson('/api/github?repos=1');
        setGhRepoList(d.repos || []);
      } catch (e) { setGhRepoList([]); setTeamError(e.message); }
    }
  };
  const toggleRepoGrant = (m, fullName) => {
    const current = String(m.allowed_repos || '').split(',').map((x) => x.trim()).filter(Boolean);
    const next = current.includes(fullName) ? current.filter((x) => x !== fullName) : [...current, fullName];
    fetchJson('/api/team-members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, allowedRepos: next })
    }).then(loadTeamMembers).catch((e) => setTeamError(e.message));
  };

  const loadSiteContent = async () => {
    try {
      const payload = await fetchJson('/api/site-content', { cache: 'no-store' });
      if (payload?.content) {
        setContentJson(JSON.stringify(payload.content, null, 2));
        onContentSaved(payload.content);
      }
    } catch (error) {
      setContentError(error.message);
      setContentJson(JSON.stringify(defaultContent, null, 2));
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const data = await fetchJson('/api/analytics');
      setAnalyticsData(data);
    } catch (err) {
      setAnalyticsError(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const notifySiteContentUpdate = () => {
    if (typeof window === 'undefined') return;

    const token = String(Date.now());
    try {
      window.localStorage.setItem('pa_site_content_version', token);
    } catch {
      // Ignore storage failures and still emit a local event.
    }

    window.dispatchEvent(new Event('site-content-updated'));
  };

  const loadSubmissions = async () => {
    setSubmissionLoading(true);
    setSubmissionError('');

    try {
      const params = new URLSearchParams();
      if (submissionFilter !== 'all') {
        params.set('status', submissionFilter);
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }

      const payload = await fetchJson(`/api/admin?${params.toString()}`);
      setSubmissions(payload.items || []);
      setCounts(payload.counts || { total: 0, new: 0, reviewing: 0, replied: 0, archived: 0 });
      setSelectedId((current) => current || payload.items?.[0]?.id || null);
    } catch (error) {
      setSubmissionError(error.message);
    } finally {
      setSubmissionLoading(false);
    }
  };

  const checkSession = async () => {
    setLoadingAuth(true);
    try {
      const payload = await fetchJson('/api/auth');
      if (payload.authenticated) {
        setAuthenticated(true);
        setUsername(payload.user?.username || '');
        await Promise.all([loadSiteContent(), loadSubmissions(), loadConversations()]);
      } else {
        setAuthenticated(false);
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    loadSubmissions();
  }, [submissionFilter]);

  useEffect(() => {
    if (!authenticated || activeTab !== 'conversations') {
      return;
    }

    loadConversations(conversationSearch.trim());
  }, [activeTab]);

  useEffect(() => {
    if (!authenticated || activeTab !== 'analytics') return;
    loadAnalytics();
  }, [activeTab, authenticated]);

  useEffect(() => {
    if (!authenticated || activeTab !== 'support') return;
    loadSupportSessions();
    const loadPresence = () => fetchJson('/api/support-executives?colleagues=1')
      .then((d) => setSupportColleagues(d.colleagues || [])).catch(() => {});
    loadPresence();
    const id = setInterval(loadPresence, 10000);
    const sessionsId = setInterval(loadSupportSessions, 10000);
    return () => { clearInterval(id); clearInterval(sessionsId); };
  }, [activeTab, authenticated]);

  useEffect(() => {
    if (!selectedSupportId) return;
    loadSupportMessages(selectedSupportId);
    // Live thread — incoming customer messages appear without a manual refresh.
    const id = setInterval(() => loadSupportMessages(selectedSupportId), 5000);
    return () => clearInterval(id);
  }, [selectedSupportId]);

  useEffect(() => {
    try { window.localStorage.setItem('pa_exec_name', executiveName); } catch (e) { /* ignore */ }
  }, [executiveName]);

  useEffect(() => {
    if (!authenticated || activeTab !== 'executives') return;
    loadExecutives();
    // Auto-refresh so a freshly-activated executive flips to "active" without a manual reload.
    const id = setInterval(loadExecutives, 15000);
    return () => clearInterval(id);
  }, [activeTab, authenticated]);

  useEffect(() => {
    if (!authenticated || activeTab !== 'team') return;
    loadTeamMembers();
    // Live refresh — newly activated members flip to "active" automatically.
    const id = setInterval(loadTeamMembers, 15000);
    return () => clearInterval(id);
  }, [activeTab, authenticated]);

  const loadTeamMembers = async () => {
    setTeamLoading(true); setTeamError('');
    try {
      const data = await fetchJson('/api/team-members');
      setTeamMembers(data.members || []);
    } catch (e) { setTeamError(e.message); }
    finally { setTeamLoading(false); }
  };

  const inviteTeamMember = async (e) => {
    e.preventDefault();
    setTeamInviteSending(true); setTeamError(''); setTeamInviteSuccess('');
    try {
      const data = await fetchJson('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamInviteForm)
      });
      if (data.emailSent === false && data.inviteLink) {
        setTeamInviteSuccess(`Invite created but the email could not be sent. Share this activation link manually: ${data.inviteLink}`);
      } else if (data.emailSent === false) {
        throw new Error(data.emailError || 'Invite created but email was not sent.');
      } else {
        setTeamInviteSuccess(`Invite sent to ${teamInviteForm.email}`);
      }
      setTeamInviteForm({ name: '', email: '', teamRole: 'member' });
      await loadTeamMembers();
    } catch (e) { setTeamError(e.message); }
    finally { setTeamInviteSending(false); }
  };

  const updateTeamMemberStatus = async (id, status) => {
    try {
      await fetchJson('/api/team-members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      await loadTeamMembers();
    } catch (e) { setTeamError(e.message); }
  };

  const deleteTeamMember = async (id) => {
    try {
      await fetchJson('/api/team-members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadTeamMembers();
    } catch (e) { setTeamError(e.message); }
  };

  const loadExecutives = async () => {
    setExecLoading(true); setExecError('');
    try {
      const data = await fetchJson('/api/support-executives');
      setExecutives(data.executives || []);
    } catch (e) { setExecError(e.message); }
    finally { setExecLoading(false); }
  };

  const inviteExecutive = async (e) => {
    e.preventDefault();
    setExecInviteSending(true); setExecError(''); setExecInviteSuccess('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 18000);
    try {
      const data = await fetchJson('/api/support-executives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(execInviteForm)
      });
      if (data.emailSent === false) {
        throw new Error(data.emailError || 'Invite created but email was not sent.');
      }
      setExecInviteSuccess(`Invite sent to ${execInviteForm.email}`);
      setExecInviteForm({ name: '', email: '' });
      await loadExecutives();
    } catch (e) {
      setExecError(e.name === 'AbortError' ? 'Invite email timed out. Check SMTP settings and try again.' : e.message);
    }
    finally {
      window.clearTimeout(timer);
      setExecInviteSending(false);
    }
  };

  const updateExecStatus = async (id, status) => {
    try {
      await fetchJson('/api/support-executives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      await loadExecutives();
    } catch (e) { setExecError(e.message); }
  };

  const deleteExecutive = async (id) => {
    try {
      await fetchJson('/api/support-executives', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadExecutives();
    } catch (e) { setExecError(e.message); }
  };

  const loadActivityLogs = async (execId) => {
    setActivityLoading(true);
    try {
      const data = await fetchJson(`/api/support-executives/activity?executiveId=${execId}`);
      setActivityLogs(data.logs || []);
    } catch (e) { setExecError(e.message); }
    finally { setActivityLoading(false); }
  };

  useEffect(() => {
    if (selectedExecId) {
      loadActivityLogs(selectedExecId);
    }
  }, [selectedExecId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const payload = await fetchJson('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      if (payload.authenticated) {
        setLoginSuccess(true);
        setUsername(payload.user?.username || loginForm.username);
        await Promise.all([loadSiteContent(), loadSubmissions(), loadConversations()]);
        window.setTimeout(() => {
          setLoginSuccess(false);
          setAuthenticated(true);
        }, 1600);
      }
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const confirmLogout = async () => {
    setShowLogoutDialog(false);
    await fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
    setAuthenticated(false);
    setUsername('');
  };

  const saveContent = async () => {
    setContentError('');
    setContentSaving(true);

    try {
      const parsed = JSON.parse(contentJson);
      const payload = await fetchJson('/api/site-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: parsed })
      });

      if (payload?.content) {
        setContentJson(JSON.stringify(payload.content, null, 2));
        onContentSaved(payload.content);
        notifySiteContentUpdate();
      }
    } catch (error) {
      setContentError(error.message);
    } finally {
      setContentSaving(false);
    }
  };

  const resetContent = async () => {
    setContentError('');
    setContentSaving(true);

    try {
      const payload = await fetchJson('/api/site-content', {
        method: 'DELETE'
      });

      const content = payload?.content || defaultContent;
      setContentJson(JSON.stringify(content, null, 2));
      onContentSaved(content);
      notifySiteContentUpdate();
    } catch (error) {
      setContentError(error.message);
    } finally {
      setContentSaving(false);
    }
  };

  const populateBlogDraft = (post = null) => {
    setBlogDraft({
      slug: post?.slug || '',
      header: post?.header || 'Product',
      title: post?.title || '',
      by: post?.by || 'Patience AI Team',
      publishedAt: post?.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      excerpt: post?.excerpt || '',
      tags: Array.isArray(post?.tags) ? post.tags.join(', ') : '',
      content: Array.isArray(post?.content) ? post.content.join('\n\n') : ''
    });
  };

  const publishBlogDraft = async () => {
    setContentError('');
    setContentSaving(true);

    try {
      const parsed = JSON.parse(contentJson);
      const posts = Array.isArray(parsed.blogPage?.posts) ? [...parsed.blogPage.posts] : [];
      const publishedAt = new Date(blogDraft.publishedAt).toISOString();
      const nextPost = {
        slug: blogDraft.slug.trim(),
        header: blogDraft.header.trim() || 'Product',
        title: blogDraft.title.trim(),
        by: blogDraft.by.trim() || 'Patience AI Team',
        publishedAt,
        excerpt: blogDraft.excerpt.trim(),
        tags: blogDraft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        content: blogDraft.content
          .split('\n')
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
      };

      if (!nextPost.slug || !nextPost.title || !nextPost.excerpt || !nextPost.content.length) {
        throw new Error('Slug, title, excerpt, and content are required.');
      }

      const existingIndex = posts.findIndex((post) => post.slug === nextPost.slug);
      if (existingIndex >= 0) {
        posts[existingIndex] = nextPost;
      } else {
        posts.unshift(nextPost);
      }

      parsed.blogPage = {
        ...(parsed.blogPage || {}),
        posts
      };

      const payload = await fetchJson('/api/site-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: parsed })
      });

      if (payload?.content) {
        setContentJson(JSON.stringify(payload.content, null, 2));
        onContentSaved(payload.content);
        populateBlogDraft(nextPost);
        notifySiteContentUpdate();
      }
    } catch (error) {
      setContentError(error.message);
    } finally {
      setContentSaving(false);
    }
  };

  const updateSubmissionStatus = async (id, status) => {
    setSavingId(id);
    setSubmissionError('');

    try {
      const payload = await fetchJson('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });

      const updated = payload.item;
      setSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setSubmissionError(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteSubmission = async (id) => {
    setSavingId(id);
    setSubmissionError('');

    try {
      await fetchJson('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setSubmissions((current) => current.filter((item) => item.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
    } catch (error) {
      setSubmissionError(error.message);
    } finally {
      setSavingId(null);
    }
  };


  const loadConversations = async (conversationId = '') => {
    setConversationLoading(true);
    setConversationError('');

    try {
      const params = new URLSearchParams();
      if (conversationId) {
        params.set('conversationId', conversationId);
      }
      const payload = await fetchJson(`/api/chat-admin?${params.toString()}`);
      const next = payload.conversations || [];
      setConversations(next);
      setSelectedConversationId((current) => current || next[0]?.conversationId || '');
    } catch (error) {
      setConversationError(error.message);
    } finally {
      setConversationLoading(false);
    }
  };

  const deleteConversation = async (conversationId) => {
    await fetchJson('/api/chat-admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId })
    });
    await loadConversations(conversationSearch.trim());
  };

  const deleteConversationMessage = async (id) => {
    await fetchJson('/api/chat-admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    await loadConversations(conversationSearch.trim());
  };

  const saveConversationMessage = async () => {
    if (!editingMessageId || !editingMessage.trim()) {
      return;
    }

    await fetchJson('/api/chat-admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingMessageId, message: editingMessage.trim() })
    });

    setEditingMessageId(null);
    setEditingMessage('');
    await loadConversations(conversationSearch.trim());
  };

  const loadSupportSessions = async () => {
    setSupportSessionsLoading(true);
    setSupportError('');
    try {
      const payload = await fetchJson('/api/support-chat?listSessions=1');
      const sessions = payload.sessions || [];
      setSupportSessions(sessions);
      setSelectedSupportId((current) => current || sessions[0]?.conversation_id || '');
    } catch (error) {
      setSupportError(error.message);
    } finally {
      setSupportSessionsLoading(false);
    }
  };

  const loadSupportMessages = async (conversationId) => {
    if (!conversationId) return;
    setSupportMessagesLoading(true);
    try {
      const payload = await fetchJson(`/api/support-chat?conversationId=${encodeURIComponent(conversationId)}`);
      setSupportMessages(payload.messages || []);
    } catch (error) {
      setSupportError(error.message);
    } finally {
      setSupportMessagesLoading(false);
    }
  };

  const sendSupportReply = async () => {
    if (!supportReply.trim() || !selectedSupportId) return;
    setSupportReplySending(true);
    setSupportError('');
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedSupportId,
          message: supportReply.trim(),
          sender: 'executive',
          executiveName: executiveName.trim() || 'Support Team'
        })
      });
      setSupportReply('');
      await loadSupportMessages(selectedSupportId);
    } catch (error) {
      setSupportError(error.message);
    } finally {
      setSupportReplySending(false);
    }
  };

  const closeSupportSession = async (conversationId) => {
    try {
      await fetchJson('/api/support-chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, status: 'closed' })
      });
      await loadSupportSessions();
    } catch (error) {
      setSupportError(error.message);
    }
  };

  const deleteSupportSession = async (conversationId) => {
    if (!conversationId) return;
    try {
      await fetchJson('/api/support-chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      });
      setSupportMessages([]);
      setSelectedSupportId('');
      await loadSupportSessions();
    } catch (error) {
      setSupportError(error.message);
    }
  };

  const filteredSubmissions = submissions.filter((item) => {
    const haystack = [item.name, item.email, item.subject, item.message, item.status, item.source, item.company, item.product_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return search.trim() ? haystack.includes(search.trim().toLowerCase()) : true;
  });

  if (loadingAuth) {
    return (
      <main className={`admin-console ${themeClass} bg-slate-950 text-white px-4 py-6 md:px-8 lg:px-10 min-h-[70vh] flex items-center justify-center`}>
        <p className="text-white/60">Loading admin console...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className={`admin-console ${themeClass} bg-slate-950 text-white px-4 py-6 md:px-8 lg:px-10 min-h-[70vh] flex items-center justify-center`}>
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl relative overflow-hidden">
          {loginSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 text-3xl">
                ✓
              </div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300/80 mb-2">Success</p>
              <h2 className="text-2xl font-semibold mb-2">Welcome back, {username || loginForm.username}</h2>
              <p className="text-white/55 text-sm">Loading admin console…</p>
              <div className="mt-6 flex items-center gap-2 text-white/40 text-sm">
                <Spinner size={15} />
                <span>Preparing dashboard</span>
              </div>
            </motion.div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80 mb-3">Admin access</p>
              <h1 className="text-3xl font-semibold mb-3">Sign in</h1>
              <p className="text-white/60 mb-8">Sign in with your admin account to manage site content and submissions.</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-2">Username</label>
                  <input
                    value={loginForm.username}
                    onChange={(e) => setLoginForm((current) => ({ ...current, username: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                    placeholder="Enter admin username"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((current) => ({ ...current, password: e.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                      placeholder="Enter admin password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>
                {loginError && <div className="text-red-200 text-sm">{loginError}</div>}
                <Button variant="white" className="w-full rounded-2xl px-6 py-3 gap-2" disabled={loginLoading}>
                  {loginLoading ? (
                    <>
                      <Spinner size={16} />
                      Signing in…
                    </>
                  ) : (
                    'Login'
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    );
  }

  const contentObject = (() => {
    try {
      return JSON.parse(contentJson);
    } catch {
      return null;
    }
  })();

  const blogPosts = contentObject?.blogPage?.posts || [];

  return (
    <main className={`admin-console ${themeClass} bg-slate-950 text-white px-4 py-6 md:px-8 lg:px-10 min-h-screen`}>
      <section className="max-w-7xl mx-auto">
        <div className="rounded-[2rem] overflow-hidden border border-white/10 bg-[linear-gradient(135deg,#0f172a_0%,#111827_45%,#1f2937_100%)] shadow-2xl">
          <div className="p-6 md:p-8 border-b border-white/10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80 mb-3">Patience AI Admin panel</p>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Submission + content console</h1>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                className="rounded-2xl p-3 border border-white/15 text-white/80 hover:bg-white/5 transition-colors">
                {theme === 'light' ? <FiMoon size={16} /> : <FiSun size={16} />}
              </button>
              <Button variant="white" className="rounded-2xl px-6 py-3" onClick={() => onAction({ type: 'route', to: '/' })}>
                Back home
              </Button>
              <Button variant="secondary" className="rounded-2xl px-6 py-3" onClick={() => setShowLogoutDialog(true)}>
                Logout
              </Button>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={['px-4 py-2 rounded-full text-sm font-medium transition-colors',
                    activeTab === tab ? 'bg-white text-slate-950' : 'bg-white/5 text-white/70 hover:bg-white/10'].join(' ')}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'content' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-semibold">Site JSON</h2>
                      <p className="text-white/55 text-sm mt-1">Update the whole site from a single JSON document.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="secondary" className="rounded-2xl px-5 py-3 gap-2" onClick={resetContent} disabled={contentSaving}>
                        {contentSaving ? <><Spinner size={15} />Resetting…</> : 'Reset'}
                      </Button>
                      <Button variant="white" className="rounded-2xl px-5 py-3 gap-2" onClick={saveContent} disabled={contentSaving}>
                        {contentSaving ? <><Spinner size={15} />Saving…</> : 'Save JSON'}
                      </Button>
                    </div>
                  </div>

                  {contentError && (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 mb-4">
                      {contentError}
                    </div>
                  )}

                  <textarea
                    value={contentJson}
                    onChange={(e) => setContentJson(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[520px] rounded-[1.5rem] border border-white/10 bg-slate-950/80 px-4 py-4 font-mono text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                  />

                  {!contentObject && (
                    <div className="mt-4 text-sm text-amber-200">
                      JSON is invalid. Fix the syntax before saving.
                    </div>
                  )}
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 space-y-4">
                  <h3 className="text-xl font-semibold">Live notes</h3>
                  <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                    <p className="text-white/45 text-sm mb-1">Current source</p>
                    <p className="text-white">{currentContentSource || 'local'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                    <p className="text-white/45 text-sm mb-1">Editing mode</p>
                    <p className="text-white">Whole-site JSON editing with live publish to NeonDB.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                    <p className="text-white/45 text-sm mb-1">Temp login</p>
                    <p className="text-white">Set ADMIN_USERNAME and ADMIN_PASSWORD in Render environment variables.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                    <p className="text-white/45 text-sm mb-1">Save behavior</p>
                    <p className="text-white">Save updates the site_content row. Reset deletes the custom row and restores defaults.</p>
                  </div>
                </div>
              </div>
            )}


            {activeTab === 'conversations' && (
              <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      value={conversationSearch}
                      onChange={(e) => setConversationSearch(e.target.value)}
                      placeholder="Find by conversation id (PatienceAI-...)"
                      className="flex-1 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
                    />
                    <Button variant="secondary" className="rounded-xl px-4 py-2" onClick={() => loadConversations(conversationSearch.trim())}>
                      Search
                    </Button>
                  </div>

                  {conversationError && <p className="text-red-200 text-sm mb-3">{conversationError}</p>}
                  {conversationLoading && <p className="text-white/60 text-sm">Loading conversations...</p>}

                  <div className="space-y-2 max-h-[420px] overflow-y-auto">
                    {(conversations || []).map((conversation) => (
                      <button
                        type="button"
                        key={conversation.conversationId}
                        onClick={() => setSelectedConversationId(conversation.conversationId)}
                        className={['w-full rounded-xl border text-left px-3 py-3 transition-colors',
                          selectedConversationId === conversation.conversationId
                            ? 'border-cyan-300/60 bg-cyan-300/10'
                            : 'border-white/10 bg-slate-900/50 hover:bg-white/5'].join(' ')}
                      >
                        <p className="font-medium text-sm">{conversation.conversationId}</p>
                        <p className="text-xs text-white/50 mt-1">IP: {conversation.ipAddress || 'unknown'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  {(() => {
                    const activeConversation = conversations.find((item) => item.conversationId === selectedConversationId) || conversations[0];
                    if (!activeConversation) {
                      return <p className="text-white/60">No conversations found.</p>;
                    }

                    return (
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div>
                            <h3 className="text-xl font-semibold">{activeConversation.conversationId}</h3>
                            <p className="text-xs text-white/50">IP: {activeConversation.ipAddress || 'unknown'}</p>
                          </div>
                          <Button variant="secondary" className="rounded-xl px-4 py-2" onClick={() => deleteConversation(activeConversation.conversationId)}>
                            Delete conversation
                          </Button>
                        </div>

                        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                          {activeConversation.messages.map((item) => (
                            <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-xs uppercase tracking-wide text-white/40 mb-2">{item.role} • {formatDate(item.created_at)}</p>
                              {editingMessageId === item.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingMessage}
                                    onChange={(e) => setEditingMessage(e.target.value)}
                                    className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm min-h-20"
                                  />
                                  <div className="flex gap-2">
                                    <Button variant="white" className="rounded-lg px-3 py-2" onClick={saveConversationMessage}>Save</Button>
                                    <Button variant="secondary" className="rounded-lg px-3 py-2" onClick={() => { setEditingMessageId(null); setEditingMessage(''); }}>Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm text-white/90 whitespace-pre-wrap">{item.message}</p>
                                  <div className="flex gap-2 mt-3">
                                    <Button variant="secondary" className="rounded-lg px-3 py-1.5" onClick={() => { setEditingMessageId(item.id); setEditingMessage(item.message); }}>
                                      Edit
                                    </Button>
                                    <Button variant="secondary" className="rounded-lg px-3 py-1.5" onClick={() => deleteConversationMessage(item.id)}>
                                      Delete
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'blog' && (
              <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold">Published posts</h2>
                      <p className="text-white/50 text-sm mt-1">Select a post to edit or create a new article.</p>
                    </div>
                    <Button
                      variant="secondary"
                      className="rounded-2xl px-4 py-2"
                      onClick={() => populateBlogDraft()}
                    >
                      New post
                    </Button>
                  </div>
                  <div className="divide-y divide-white/10">
                    {blogPosts.length ? (
                      blogPosts.map((post) => (
                        <button
                          key={post.slug}
                          type="button"
                          onClick={() => populateBlogDraft(post)}
                          className="w-full text-left p-5 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <p className="font-semibold text-white">{post.title}</p>
                            <span className="text-xs uppercase tracking-[0.25em] px-2.5 py-1 rounded-full bg-cyan-300/10 text-cyan-200">
                              {post.header}
                            </span>
                          </div>
                          <p className="text-sm text-white/60 line-clamp-2">{post.excerpt}</p>
                          <p className="text-xs text-white/40 mt-3">
                            {post.by} • {formatDate(post.publishedAt)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="p-6 text-white/60">No blog posts yet.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                    <div>
                      <h2 className="text-2xl font-semibold">Blog editor</h2>
                      <p className="text-white/50 text-sm mt-1">Write and publish posts to the website blog section.</p>
                    </div>
                    <Button
                      variant="white"
                      className="rounded-2xl px-5 py-3 gap-2"
                      onClick={publishBlogDraft}
                      disabled={contentSaving}
                    >
                      {contentSaving ? <><Spinner size={15} />Publishing…</> : 'Publish post'}
                    </Button>
                  </div>

                  {contentError && (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 mb-4">
                      {contentError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {[
                      { label: 'Slug', key: 'slug', type: 'text', placeholder: 'new-post-slug' },
                      { label: 'Header', key: 'header', type: 'text', placeholder: 'Product' },
                      { label: 'Title', key: 'title', type: 'text', placeholder: 'Post title' },
                      { label: 'By', key: 'by', type: 'text', placeholder: 'Author name' },
                      { label: 'Published at', key: 'publishedAt', type: 'datetime-local', placeholder: '' },
                      { label: 'Tags', key: 'tags', type: 'text', placeholder: 'Tag 1, Tag 2' }
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm text-white/70 mb-2">{field.label}</label>
                        <input
                          type={field.type}
                          value={blogDraft[field.key]}
                          onChange={(e) => setBlogDraft((current) => ({ ...current, [field.key]: e.target.value }))}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-white/70 mb-2">Excerpt</label>
                    <textarea
                      value={blogDraft.excerpt}
                      onChange={(e) => setBlogDraft((current) => ({ ...current, excerpt: e.target.value }))}
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 resize-none"
                      placeholder="Short summary shown on the blog index"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-white/70 mb-2">Content</label>
                    <textarea
                      value={blogDraft.content}
                      onChange={(e) => setBlogDraft((current) => ({ ...current, content: e.target.value }))}
                      rows={12}
                      className="w-full rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 resize-none"
                      placeholder="Write one paragraph per line"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      className="rounded-2xl px-5 py-3"
                      onClick={() => setBlogDraft(createEmptyBlogDraft())}
                    >
                      Reset draft
                    </Button>
                    {blogPosts[0] && (
                      <Button
                        variant="white"
                        className="rounded-2xl px-5 py-3"
                        onClick={() => populateBlogDraft(blogPosts[0])}
                      >
                        Load latest
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'submissions' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 text-sm text-white/55 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <span>Submissions</span>
                    <span>{filteredSubmissions.length} shown</span>
                  </div>

                  <div className="p-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSubmissionFilter(option)}
                          className={['px-4 py-2 rounded-full text-sm font-medium transition-colors',
                            submissionFilter === option ? 'bg-white text-slate-950' : 'bg-white/5 text-white/70 hover:bg-white/10'].join(' ')}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadSubmissions();
                        }
                      }}
                      placeholder="Search submissions"
                      className="w-full lg:w-[360px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                    />
                  </div>

                  {submissionError && (
                    <div className="px-4 pb-4">
                      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100">
                        {submissionError}
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-white/10">
                    {submissionLoading ? (
                      <div className="p-6 text-white/60">Loading submissions...</div>
                    ) : filteredSubmissions.length ? (
                      filteredSubmissions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className={['w-full text-left p-5 transition-colors',
                            selectedSubmission?.id === item.id ? 'bg-white/10' : 'hover:bg-white/5'].join(' ')}
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2 items-center">
                                <p className="font-semibold text-white">{item.name}</p>
                                <span className="text-xs uppercase tracking-[0.25em] px-2.5 py-1 rounded-full bg-cyan-300/10 text-cyan-200">
                                  {item.status}
                                </span>
                              </div>
                              <p className="text-sm text-white/65">{item.email}</p>
                              {(item.product_name || item.company) && (
                                <p className="text-sm text-white/55">
                                  {[item.product_name, item.company].filter(Boolean).join(' • ')}
                                </p>
                              )}
                              <p className="text-white/90">{item.subject}</p>
                              <p className="text-sm text-white/55 line-clamp-2">{item.message}</p>
                            </div>
                            <div className="text-sm text-white/45 md:text-right shrink-0">
                              <p>{formatDate(item.created_at)}</p>
                              <p className="mt-1">Source: {item.source}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-6 text-white/60">No submissions match your filters.</div>
                    )}
                  </div>
                </div>

                <motion.aside
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 md:p-7"
                >
                  {selectedSubmission ? (
                    <div className="space-y-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80 mb-3">Selected lead</p>
                        <h2 className="text-2xl font-semibold">{selectedSubmission.name}</h2>
                        <p className="text-white/60 mt-2">{selectedSubmission.email}</p>
                      </div>

                      <div className="space-y-3 text-sm text-white/70">
                        <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                          <p className="text-white/45 mb-1">Subject</p>
                          <p className="text-white">{selectedSubmission.subject}</p>
                        </div>
                        {(selectedSubmission.product_name || selectedSubmission.company) && (
                          <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                            <p className="text-white/45 mb-1">Product / Company</p>
                            <p className="text-white">
                              {[selectedSubmission.product_name, selectedSubmission.company].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                        )}
                        <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                          <p className="text-white/45 mb-1">Message</p>
                          <p className="leading-relaxed whitespace-pre-wrap">{selectedSubmission.message}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <p className="text-white/45">Source</p>
                          <p className="text-white mt-1">{selectedSubmission.source}</p>
                        </div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <p className="text-white/45">Created</p>
                          <p className="text-white mt-1">{formatDate(selectedSubmission.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {['new', 'reviewing', 'replied', 'archived'].map((status) => (
                          <Button
                            key={status}
                            variant={selectedSubmission.status === status ? 'white' : 'secondary'}
                            className="rounded-2xl px-4 py-3"
                            onClick={() => updateSubmissionStatus(selectedSubmission.id, status)}
                            disabled={savingId === selectedSubmission.id}
                          >
                            {savingId === selectedSubmission.id && selectedSubmission.status !== status ? 'Saving...' : status}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="coral"
                        className="rounded-2xl px-4 py-3 w-full"
                        onClick={() => deleteSubmission(selectedSubmission.id)}
                        disabled={savingId === selectedSubmission.id}
                      >
                        Delete submission
                      </Button>
                    </div>
                  ) : (
                    <div className="min-h-[340px] flex items-center justify-center text-white/55 text-center">
                      Select a submission to inspect the message and update its status.
                    </div>
                  )}
                </motion.aside>
              </div>
            )}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">Analytics Dashboard</h2>
                    <p className="text-white/55 text-sm mt-1">Real-time traffic — powered by your own NeonDB. 100% free.</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadAnalytics}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                  >
                    {analyticsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>

                {analyticsError && (
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 text-sm">
                    {analyticsError}
                  </div>
                )}

                {analyticsLoading && !analyticsData && (
                  <div className="text-white/55 text-sm py-8 text-center">Loading analytics…</div>
                )}

                {analyticsData && (
                  <>
                    {/* KPI Row */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                      {[
                        { label: 'All-time views', value: analyticsData.total },
                        { label: 'This month', value: analyticsData.month },
                        { label: 'This week', value: analyticsData.week },
                        { label: 'Today', value: analyticsData.today },
                        { label: 'Unique today', value: analyticsData.uniqueToday },
                        { label: 'Unique this week', value: analyticsData.uniqueWeek },
                      ].map((kpi) => (
                        <div key={kpi.label} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center">
                          <p className="text-3xl font-bold text-cyan-300">{kpi.value?.toLocaleString()}</p>
                          <p className="text-xs text-white/50 mt-1">{kpi.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* Top Pages */}
                      <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                        <h3 className="text-lg font-semibold mb-4">Top Pages</h3>
                        {analyticsData.topPages.length === 0 ? (
                          <p className="text-white/40 text-sm">No data yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {analyticsData.topPages.map((row, i) => {
                              const max = analyticsData.topPages[0]?.count || 1;
                              const pct = Math.round((row.count / max) * 100);
                              return (
                                <div key={i} className="text-sm">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-white/80 truncate max-w-[75%]">{row.page || '/'}</span>
                                    <span className="text-cyan-300 font-medium">{row.count}</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-white/10">
                                    <div className="h-1.5 rounded-full bg-cyan-400" style={{ width: pct + '%' }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Top Referrers */}
                      <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                        <h3 className="text-lg font-semibold mb-4">Traffic Sources</h3>
                        {analyticsData.topReferrers.length === 0 ? (
                          <p className="text-white/40 text-sm">No referrer data yet — mostly direct traffic.</p>
                        ) : (
                          <div className="space-y-2">
                            {analyticsData.topReferrers.map((row, i) => {
                              const max = analyticsData.topReferrers[0]?.count || 1;
                              const pct = Math.round((row.count / max) * 100);
                              const label = row.referrer.replace(/^https?:\/\//, '').split('/')[0];
                              return (
                                <div key={i} className="text-sm">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-white/80 truncate max-w-[75%]">{label}</span>
                                    <span className="text-cyan-300 font-medium">{row.count}</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-white/10">
                                    <div className="h-1.5 rounded-full bg-violet-400" style={{ width: pct + '%' }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Devices */}
                      <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                        <h3 className="text-lg font-semibold mb-4">Devices</h3>
                        <div className="flex flex-wrap gap-3">
                          {analyticsData.devices.length === 0 ? (
                            <p className="text-white/40 text-sm">No data yet.</p>
                          ) : (
                            analyticsData.devices.map((row, i) => (
                              <div key={i} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-center min-w-[90px]">
                                <p className="text-2xl font-bold text-emerald-300">{row.count}</p>
                                <p className="text-xs text-white/50 capitalize mt-1">{row.device}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Browsers */}
                      <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                        <h3 className="text-lg font-semibold mb-4">Browsers</h3>
                        <div className="flex flex-wrap gap-3">
                          {analyticsData.browsers.length === 0 ? (
                            <p className="text-white/40 text-sm">No data yet.</p>
                          ) : (
                            analyticsData.browsers.map((row, i) => (
                              <div key={i} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-center min-w-[90px]">
                                <p className="text-2xl font-bold text-amber-300">{row.count}</p>
                                <p className="text-xs text-white/50 mt-1">{row.browser}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Recent Visitors */}
                    <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                      <h3 className="text-lg font-semibold mb-4">Recent Visitors (last 50)</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-white/75">
                          <thead>
                            <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                              <th className="pb-3 pr-4">Page</th>
                              <th className="pb-3 pr-4">Referrer</th>
                              <th className="pb-3 pr-4">Device</th>
                              <th className="pb-3 pr-4">Browser</th>
                              <th className="pb-3">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {analyticsData.recent
                              .slice(visitorPage * VISITORS_PER_PAGE, visitorPage * VISITORS_PER_PAGE + VISITORS_PER_PAGE)
                              .map((row, i) => (
                              <tr key={visitorPage * VISITORS_PER_PAGE + i} className="hover:bg-white/5">
                                <td className="py-2 pr-4 max-w-[200px] truncate">{row.page}</td>
                                <td className="py-2 pr-4 max-w-[160px] truncate text-white/45">
                                  {row.referrer ? row.referrer.replace(/^https?:\/\//, '').split('/')[0] : '—'}
                                </td>
                                <td className="py-2 pr-4 capitalize">{row.device_type}</td>
                                <td className="py-2 pr-4">{row.browser}</td>
                                <td className="py-2 text-white/40">{formatDate(row.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {analyticsData.recent.length === 0 && (
                          <p className="text-white/40 text-sm py-4 text-center">No visits tracked yet — deploy and visit the site to start tracking.</p>
                        )}
                      </div>
                      {analyticsData.recent.length > VISITORS_PER_PAGE && (() => {
                        const totalPages = Math.ceil(analyticsData.recent.length / VISITORS_PER_PAGE);
                        const page = Math.min(visitorPage, totalPages - 1);
                        const start = page * VISITORS_PER_PAGE;
                        return (
                          <div className="flex items-center justify-between mt-4 text-xs text-white/50">
                            <span>
                              Showing {start + 1}–{Math.min(start + VISITORS_PER_PAGE, analyticsData.recent.length)} of {analyticsData.recent.length}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setVisitorPage((p) => Math.max(0, p - 1))}
                                disabled={page <= 0}
                                className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                Prev
                              </button>
                              <span className="text-white/70">Page {page + 1} / {totalPages}</span>
                              <button
                                type="button"
                                onClick={() => setVisitorPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'support' && (
              <div className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Live Support Chat</h2>
                    <p className="text-white/55 text-sm mt-1">View and reply to customer live support requests.</p>
                    {supportColleagues.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="text-[11px] uppercase tracking-wider text-white/40 mr-1">Executives:</span>
                        {supportColleagues.map((c) => (
                          <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/75">
                            <span className={`h-2 w-2 rounded-full ${PRESENCE_DOT[c.status] || 'bg-slate-500'}`} />
                            {c.name}
                            <span className="text-white/35 capitalize">· {c.status}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      value={executiveName}
                      onChange={(e) => setExecutiveName(e.target.value)}
                      placeholder="Your name (shown to customer)"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 w-52"
                    />
                    <Button variant="secondary" className="rounded-xl px-4 py-2" onClick={loadSupportSessions}>
                      {supportSessionsLoading ? 'Loading…' : 'Refresh'}
                    </Button>
                  </div>
                </div>

                {supportError && (
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 text-sm">
                    {supportError}
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
                  {/* Sessions list */}
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                    <h3 className="text-base font-semibold mb-3 text-white/70">Conversations</h3>
                    {supportSessionsLoading && <p className="text-white/50 text-sm">Loading sessions…</p>}
                    {!supportSessionsLoading && supportSessions.length === 0 && (
                      <p className="text-white/50 text-sm">No live chat sessions yet.</p>
                    )}
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {supportSessions.map((session) => (
                        <div
                          key={session.conversation_id}
                          className={['w-full rounded-xl border text-left px-3 py-3 transition-colors',
                            selectedSupportId === session.conversation_id
                              ? 'border-emerald-400/60 bg-emerald-400/10'
                              : 'border-white/10 bg-slate-900/50 hover:bg-white/5'].join(' ')}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedSupportId(session.conversation_id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="font-medium text-sm truncate">{session.conversation_id}</p>
                              <span className={['text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0',
                                session.status === 'waiting' ? 'bg-amber-400/20 text-amber-300' :
                                session.status === 'active' ? 'bg-emerald-400/20 text-emerald-300' :
                                'bg-white/10 text-white/40'].join(' ')}>
                                {session.status}
                              </span>
                            </div>
                            <p className="text-xs text-white/50">{session.customer_name || session.customer_email || 'Anonymous customer'}</p>
                            {session.assigned_executive && (
                              <p className="text-xs text-cyan-300/70 mt-0.5">Assigned: {session.assigned_executive}</p>
                            )}
                            <p className="text-xs text-white/35 mt-1">{formatDate(session.updated_at)}</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSupportSession(session.conversation_id)}
                            className="mt-2 text-xs text-red-300/80 hover:text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chat thread + reply */}
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
                    {!selectedSupportId ? (
                      <p className="text-white/50 text-sm">Select a session to view the chat.</p>
                    ) : (
                      <>
                        {(() => {
                          const session = supportSessions.find((s) => s.conversation_id === selectedSupportId);
                          return (
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-base">{selectedSupportId}</h3>
                                <p className="text-xs text-white/50">{session?.customer_name || session?.customer_email || 'No name'}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  className="rounded-xl px-3 py-2 text-xs"
                                  onClick={() => loadSupportMessages(selectedSupportId)}
                                >
                                  Refresh
                                </Button>
                                {session?.status !== 'closed' && (
                                  <Button
                                    variant="secondary"
                                    className="rounded-xl px-3 py-2 text-xs"
                                    onClick={() => closeSupportSession(selectedSupportId)}
                                  >
                                    Close chat
                                  </Button>
                                )}
                                <Button
                                  variant="secondary"
                                  className="rounded-xl px-3 py-2 text-xs text-red-700"
                                  onClick={() => deleteSupportSession(selectedSupportId)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex-1 space-y-2 max-h-[340px] overflow-y-auto pr-1">
                          {supportMessagesLoading && <p className="text-white/50 text-sm">Loading…</p>}
                          {!supportMessagesLoading && supportMessages.length === 0 && (
                            <p className="text-white/50 text-sm">No messages yet.</p>
                          )}
                          {supportMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={[
                                'rounded-xl px-3 py-2.5 text-sm',
                                msg.sender === 'system' ? 'mx-auto max-w-[92%] text-center bg-amber-50 border border-amber-200 text-amber-800' : 'max-w-[88%]',
                                msg.sender === 'system' ? '' : msg.sender === 'executive'
                                  ? 'ml-auto bg-cyan-300/15 border border-cyan-300/20 text-white'
                                  : 'bg-white/5 border border-white/10 text-white/85'
                              ].join(' ')}
                            >
                              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                                {msg.sender === 'system' ? 'Call event' : msg.sender === 'executive' ? (msg.executive_name || 'Support Team') : 'Customer'} • {formatDate(msg.created_at)}
                              </p>
                              <p className="whitespace-pre-wrap leading-snug">{msg.message}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-1">
                          <textarea
                            value={supportReply}
                            onChange={(e) => setSupportReply(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendSupportReply(); }
                            }}
                            placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                            rows={2}
                            className="flex-1 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 resize-none"
                          />
                          <Button
                            variant="white"
                            className="rounded-xl px-4 py-2 self-end"
                            onClick={sendSupportReply}
                            disabled={supportReplySending || !supportReply.trim()}
                          >
                            {supportReplySending ? 'Sending…' : 'Send'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'executives' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Support Executives</h2>
                    <p className="text-white/55 text-sm mt-1">Manage who can handle live support chats.</p>
                  </div>
                  <a href="/support-executive" target="_blank" rel="noopener noreferrer"
                    className="text-sm text-cyan-300 hover:text-cyan-100 underline underline-offset-2">
                    Open executive panel ↗
                  </a>
                </div>

                {execError && (
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 text-sm">{execError}</div>
                )}
                {execInviteSuccess && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm">{execInviteSuccess}</div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.7fr] gap-6">
                  {/* List */}
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                      <h3 className="font-semibold">All executives</h3>
                      <button onClick={loadExecutives} className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/10">
                        {execLoading ? 'Loading…' : 'Refresh'}
                      </button>
                    </div>
                    <div className="divide-y divide-white/5">
                      {executives.length === 0 && !execLoading && (
                        <p className="text-white/40 text-sm p-5">No executives added yet.</p>
                      )}
                      {executives.map(exec => (
                        <div key={exec.id} className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5" onClick={() => setSelectedExecId(exec.id)}>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{exec.name}</p>
                            <p className="text-sm text-white/55 truncate">{exec.email}</p>
                            {exec.last_seen_at && (
                              <p className="text-xs text-white/30 mt-0.5">Last seen {formatDate(exec.last_seen_at)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={['text-xs px-2.5 py-1 rounded-full font-medium',
                              exec.status === 'active' ? 'bg-emerald-400/20 text-emerald-300' :
                              exec.status === 'invited' ? 'bg-amber-400/20 text-amber-300' :
                              'bg-white/10 text-white/40'].join(' ')}>{exec.status}</span>
                            {exec.status !== 'active' && (
                              <button onClick={() => updateExecStatus(exec.id, 'active')}
                                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                                Activate
                              </button>
                            )}
                            {exec.status === 'active' && (
                              <button onClick={() => updateExecStatus(exec.id, 'inactive')}
                                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                                Deactivate
                              </button>
                            )}
                            <button onClick={() => deleteExecutive(exec.id)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-red-400/20 text-red-300/70 hover:text-red-200 hover:bg-red-500/10 transition-colors">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Invite form */}
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                    <h3 className="font-semibold mb-4">Invite executive</h3>
                    <form onSubmit={inviteExecutive} className="space-y-3">
                      <div>
                        <label className="block text-sm text-white/70 mb-1.5">Name</label>
                        <input value={execInviteForm.name}
                          onChange={e => setExecInviteForm(f => ({...f, name: e.target.value}))}
                          required placeholder="Full name"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70" />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1.5">Email</label>
                        <input type="email" value={execInviteForm.email}
                          onChange={e => setExecInviteForm(f => ({...f, email: e.target.value}))}
                          required placeholder="email@company.com"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70" />
                      </div>
                      <Button variant="white" className="rounded-2xl px-5 py-3 w-full gap-2" disabled={execInviteSending}>
                        {execInviteSending ? 'Sending invite…' : 'Send invite email'}
                      </Button>
                    </form>
                    <div className="mt-4 rounded-xl bg-slate-900/60 border border-white/10 p-4 text-xs text-white/50 space-y-1">
                      <p>The executive will receive an email with a link to set their password.</p>
                      <p>Once activated they can log in at <span className="text-cyan-300">/support-executive</span>.</p>
                    </div>
                  </div>
                </div>

                {/* Activity Logs Section */}
                {selectedExecId && (
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden mt-6">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                      <h3 className="font-semibold">Activity Logs</h3>
                      <button onClick={() => loadActivityLogs(selectedExecId)} className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/10">
                        {activityLoading ? 'Loading…' : 'Refresh'}
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {activityLoading ? (
                        <div className="p-5 text-center text-white/40">
                          <Spinner size={20} className="mx-auto mb-2" />
                          <p className="text-sm">Loading activity logs...</p>
                        </div>
                      ) : activityLogs.length === 0 ? (
                        <p className="text-white/40 text-sm p-5 text-center">No activity logs found.</p>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {activityLogs.map((log, index) => (
                            <div key={index} className="px-5 py-3">
                              <div className="flex items-center justify-between gap-4 mb-1">
                                <span className={['text-xs px-2 py-1 rounded font-medium',
                                  log.action === 'login' ? 'bg-emerald-400/20 text-emerald-300' :
                                  log.action === 'logout' ? 'bg-red-400/20 text-red-300' :
                                  log.action === 'status_change' ? 'bg-amber-400/20 text-amber-300' :
                                  log.action === 'chat_assigned' ? 'bg-blue-400/20 text-blue-300' :
                                  log.action === 'chat_closed' ? 'bg-slate-400/20 text-slate-300' :
                                  'bg-purple-400/20 text-purple-300'].join(' ')}>
                                  {log.action.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-white/40">{formatDate(log.created_at)}</span>
                              </div>
                              {log.old_status && log.new_status && (
                                <p className="text-xs text-white/50 mb-1">
                                  Status: {log.old_status}{' -> '}{log.new_status}
                                </p>
                              )}
                              {log.metadata && (
                                <p className="text-xs text-white/40">
                                  {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Team Members</h2>
                    <p className="text-white/55 text-sm mt-1">Invite teammates (@patienceai.in) who receive and resolve support tickets.</p>
                  </div>
                  <a href="/team" target="_blank" rel="noopener noreferrer"
                    className="text-sm text-cyan-300 hover:text-cyan-100 underline underline-offset-2">
                    Open team portal ↗
                  </a>
                </div>

                {teamError && (
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 text-sm">{teamError}</div>
                )}
                {teamInviteSuccess && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm">{teamInviteSuccess}</div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.7fr] gap-6">
                  {/* List */}
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                      <h3 className="font-semibold">All members</h3>
                      <button onClick={loadTeamMembers} className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/10">
                        {teamLoading ? 'Loading…' : 'Refresh'}
                      </button>
                    </div>
                    <div className="divide-y divide-white/5">
                      {teamMembers.length === 0 && !teamLoading && (
                        <p className="text-white/40 text-sm p-5">No team members added yet.</p>
                      )}
                      {teamMembers.map((m) => (
                        <div key={m.id} className="px-5 py-4 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{m.name}</p>
                            <p className="text-sm text-white/55 truncate">{m.email}</p>
                            {m.last_seen_at && (
                              <p className="text-xs text-white/30 mt-0.5">Last seen {formatDate(m.last_seen_at)}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {['github_read', 'github_write', 'roster_manage', 'collaborator_manage'].map((perm) => {
                                const current = m.permissions ? m.permissions.split(',').filter(Boolean) : null;
                                const roleDefaults = { software_dev: ['github_read','github_write'], team_lead: ['github_read','github_write','collaborator_manage'], engineering_manager: ['github_read','github_write','roster_manage','collaborator_manage'], product_manager: ['github_read','roster_manage'], qa: ['github_read'], member: [] };
                                const effective = current || roleDefaults[m.team_role || 'member'] || [];
                                const on = effective.includes(perm);
                                return (
                                  <button key={perm} type="button"
                                    title={current ? 'Custom permission' : 'Role default — click to customise'}
                                    onClick={() => {
                                      const next = on ? effective.filter((x) => x !== perm) : [...effective, perm];
                                      fetchJson('/api/team-members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, permissions: next }) }).then(loadTeamMembers).catch((e) => setTeamError(e.message));
                                    }}
                                    className={['text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                                      on ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300' : 'border-white/10 text-white/30 hover:text-white/60'].join(' ')}>
                                    {perm.replace('_', ' ')} {on ? '✓' : '＋'}
                                  </button>
                                );
                              })}
                              <button type="button" onClick={() => toggleRepoPanel(m.id)}
                                title="Grant specific GitHub repositories — members only see repos granted here"
                                className={['text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                                  String(m.allowed_repos || '').trim()
                                    ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300'
                                    : 'border-white/10 text-white/30 hover:text-white/60'].join(' ')}>
                                repos: {String(m.allowed_repos || '').split(',').filter(Boolean).length} granted {repoPanelFor === m.id ? '▴' : '▾'}
                              </button>
                            </div>
                            {repoPanelFor === m.id && (
                              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2.5 max-h-44 overflow-y-auto space-y-1">
                                {ghRepoList === null && <p className="text-xs text-white/40">Loading repositories…</p>}
                                {ghRepoList !== null && !ghRepoList.length && <p className="text-xs text-white/40">No repositories found (is GITHUB_TOKEN configured?).</p>}
                                {(ghRepoList || []).map((r) => {
                                  const granted = String(m.allowed_repos || '').split(',').map((x) => x.trim()).filter(Boolean).includes(r.full_name);
                                  return (
                                    <button key={r.full_name} type="button" onClick={() => toggleRepoGrant(m, r.full_name)}
                                      className={['w-full text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center justify-between gap-2',
                                        granted ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-white/5 text-white/50 hover:text-white/80 hover:bg-white/5'].join(' ')}>
                                      <span className="truncate">{r.full_name}{r.private ? ' · private' : ''}</span>
                                      <span className="shrink-0">{granted ? '✓ granted' : 'grant'}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select value={m.team_role || 'member'}
                              onChange={(e) => fetchJson('/api/team-members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, teamRole: e.target.value }) }).then(loadTeamMembers)}
                              className="text-xs rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-cyan-200 focus:outline-none">
                              {['member','software_dev','team_lead','engineering_manager','product_manager','qa'].map((r) => (
                                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                            <span className={['text-xs px-2.5 py-1 rounded-full font-medium',
                              m.status === 'active' ? 'bg-emerald-400/20 text-emerald-300' :
                              m.status === 'invited' ? 'bg-amber-400/20 text-amber-300' :
                              'bg-white/10 text-white/40'].join(' ')}>{m.status}</span>
                            {m.status === 'inactive' && (
                              <button onClick={() => updateTeamMemberStatus(m.id, 'active')}
                                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                                Activate
                              </button>
                            )}
                            {m.status === 'active' && (
                              <button onClick={() => updateTeamMemberStatus(m.id, 'inactive')}
                                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                                Deactivate
                              </button>
                            )}
                            <button onClick={() => deleteTeamMember(m.id)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-red-400/20 text-red-300/70 hover:text-red-200 hover:bg-red-500/10 transition-colors">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Invite form */}
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                    <h3 className="font-semibold mb-4">Invite member</h3>
                    <form onSubmit={inviteTeamMember} className="space-y-3">
                      <div>
                        <label className="block text-sm text-white/70 mb-1.5">Name</label>
                        <input value={teamInviteForm.name}
                          onChange={(e) => setTeamInviteForm((f) => ({ ...f, name: e.target.value }))}
                          required placeholder="Full name"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70" />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1.5">Email (@patienceai.in only)</label>
                        <input type="email" value={teamInviteForm.email}
                          onChange={(e) => setTeamInviteForm((f) => ({ ...f, email: e.target.value }))}
                          required placeholder="name@patienceai.in" pattern=".*@patienceai\.in$"
                          title="Must be a @patienceai.in email address"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70" />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1.5">Role</label>
                        <select value={teamInviteForm.teamRole}
                          onChange={(e) => setTeamInviteForm((f) => ({ ...f, teamRole: e.target.value }))}
                          className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/70">
                          {['member','software_dev','team_lead','engineering_manager','product_manager','qa'].map((r) => (
                            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <Button variant="white" className="rounded-2xl px-5 py-3 w-full gap-2" disabled={teamInviteSending}>
                        {teamInviteSending ? 'Sending invite…' : 'Send invite email'}
                      </Button>
                    </form>
                    <div className="mt-4 rounded-xl bg-slate-900/60 border border-white/10 p-4 text-xs text-white/50 space-y-1">
                      <p>The member receives an email with a link to set their password.</p>
                      <p>Once activated they sign in at <span className="text-cyan-300">/team</span> to see tickets assigned to them.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tickets' && <AdminTicketOps />}

            {activeTab === 'engineering' && <AdminPeos />}
            {activeTab === 'growth' && <AdminGrowth />}
            {activeTab === 'responses' && <AdminResponses />}
            {activeTab === 'deploy' && <AdminDeploy />}
            {activeTab === 'worklog' && <AdminWorkLog />}
            {activeTab === 'logs' && <AdminLogs />}
          </div>
        </div>
      </section>

      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="admin-logout-title">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
              <FiAlertTriangle size={22} />
            </div>
            <h2 id="admin-logout-title" className="text-2xl font-semibold">Log out of admin?</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">Any unsaved edits or active admin work will be left behind. Confirm only if you are ready to end this session.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowLogoutDialog(false)} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white">
                Stay signed in
              </button>
              <button type="button" onClick={confirmLogout} className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-400">
                Yes, logout
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default AdminPage;
