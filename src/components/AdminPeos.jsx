import React, { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../common/fetchJson';
import { confirmDialog } from '../common/confirm';

// PEOS — engineering tab. Sub-tabbed workspace over /api/peos and /api/github.
const card = 'rounded-[1.75rem] border border-white/10 bg-white/5 p-5';
const inp = 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70';
const sel = `${inp} bg-slate-900`;
const btn = 'text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors';
const btnPri = 'text-xs px-4 py-2 rounded-xl bg-white text-slate-950 font-semibold hover:bg-white/90 transition-colors';
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(v)) : '—';

const BADGE = {
  'SEV-1': 'bg-red-500/20 text-red-300', 'SEV-2': 'bg-orange-500/20 text-orange-300',
  'SEV-3': 'bg-amber-400/20 text-amber-300', 'SEV-4': 'bg-slate-400/20 text-slate-300',
  active: 'bg-emerald-400/20 text-emerald-300', planned: 'bg-sky-400/20 text-sky-300', done: 'bg-slate-400/20 text-slate-300',
  open: 'bg-sky-400/20 text-sky-300', investigating: 'bg-amber-400/20 text-amber-300',
  resolved: 'bg-emerald-400/20 text-emerald-300', postmortem: 'bg-violet-400/20 text-violet-300', closed: 'bg-slate-400/20 text-slate-300',
  pass: 'bg-emerald-400/20 text-emerald-300', fail: 'bg-red-500/20 text-red-300', pending: 'bg-slate-400/20 text-slate-300', blocked: 'bg-amber-400/20 text-amber-300'
};
const Badge = ({ v }) => v ? <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${BADGE[v] || 'bg-white/10 text-white/60'}`}>{v}</span> : null;

const Empty = ({ children }) => <div className="text-center py-8 text-white/35 text-sm">{children}</div>;

/* ── KPI drill-down modal: view + CRUD on the entities behind each number ── */
const KPI_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const KPI_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
function KpiModal({ kpi, dash, onClose, onChanged }) {
  const [tickets, setTickets] = useState(null);
  const [incidents, setIncidents] = useState(null);
  const [sprints, setSprints] = useState(null);
  const [err, setErr] = useState('');
  const load = () => {
    if (['Open tickets', 'Overdue', 'SLA breaches', 'Closed (7d)'].includes(kpi))
      fetchJson('/api/tickets').then((d) => setTickets(d.tickets || [])).catch((e) => setErr(e.message));
    if (kpi === 'Critical incidents') fetchJson('/api/peos?resource=incidents').then((d) => setIncidents(d.items || [])).catch((e) => setErr(e.message));
    if (kpi === 'Sprint velocity') fetchJson('/api/peos?resource=sprints').then((d) => setSprints(d.items || [])).catch((e) => setErr(e.message));
  };
  useEffect(load, [kpi]);  
  const patchTicket = (id, body) => fetchJson('/api/tickets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }).then(() => { load(); onChanged(); }).catch((e) => setErr(e.message));
  const delTicket = async (id) => { if (!(await confirmDialog({ title: 'Delete ticket', message: `Delete PA-${id}? This cannot be undone.`, confirmText: 'Delete' }))) return; fetchJson('/api/tickets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(() => { load(); onChanged(); }).catch((e) => setErr(e.message)); };
  const peosCall = (resource, method, body) => fetchJson(`/api/peos?resource=${resource}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(() => { load(); onChanged(); }).catch((e) => setErr(e.message));

  const now = Date.now();
  const rows = tickets && {
    'Open tickets': tickets.filter((t) => ['open', 'in_progress'].includes(t.status)),
    'Overdue': tickets.filter((t) => ['open', 'in_progress'].includes(t.status) && t.due_at && new Date(t.due_at) < now),
    'SLA breaches': tickets.filter((t) => t.sla_breached),
    'Closed (7d)': tickets.filter((t) => t.resolved_at && now - new Date(t.resolved_at) < 7 * 86400000)
  }[kpi];

  const TicketRow = ({ t }) => (
    <div className="flex items-center gap-2 py-2 border-b border-white/5 text-sm">
      <span className="font-mono text-[11px] text-white/40 w-14 shrink-0">PA-{t.id}</span>
      <span className="flex-1 min-w-0 truncate text-white/85">{t.subject}</span>
      <span className="text-[11px] text-white/40 truncate max-w-[140px] hidden md:block">{t.assignee_email}</span>
      {t.due_at && <span className={`text-[10px] shrink-0 ${new Date(t.due_at) < now && !t.resolved_at ? 'text-red-300' : 'text-white/35'}`}>due {fmt(t.due_at)}</span>}
      <select value={t.priority} onChange={(e) => patchTicket(t.id, { priority: e.target.value })} className="text-[11px] rounded-lg border border-white/10 bg-slate-900 px-1.5 py-1 text-white/70 capitalize">
        {KPI_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={t.status} onChange={(e) => patchTicket(t.id, { status: e.target.value })} className="text-[11px] rounded-lg border border-white/10 bg-slate-900 px-1.5 py-1 text-cyan-200 capitalize">
        {KPI_STATUSES.map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}
      </select>
      <button onClick={() => delTicket(t.id)} className="text-[11px] px-2 py-1 rounded-lg border border-red-400/20 text-red-300/70 hover:bg-red-500/10">✕</button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-950 border border-white/10 rounded-[1.5rem] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
          <p className="font-semibold text-white">{kpi}</p>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">
          {err && <p className="text-red-300 text-xs mb-2">{err}</p>}

          {kpi === 'Health score' && (
            <div className="space-y-3 text-sm text-white/75">
              <p className="text-3xl font-bold text-cyan-300">{dash?.health ?? 0} / 100</p>
              <p className="text-white/50 text-xs">Health = 100 − (overdue × 5) − (SLA breaches × 5) − (critical incidents × 15)</p>
              {[['Overdue tickets', dash?.tickets?.overdue, 5], ['SLA breaches', dash?.tickets?.breaches, 5], ['Critical incidents', dash?.incidents?.critical, 15]].map(([l, v, w]) => (
                <div key={l} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                  <span>{l}</span><span className={Number(v) > 0 ? 'text-red-300 font-semibold' : 'text-emerald-300'}>{v ?? 0} × −{w} = −{(v || 0) * w}</span>
                </div>
              ))}
              <p className="text-[11px] text-white/40">Open the alerting card (overdue / breaches / incidents) to act on the items dragging the score down.</p>
            </div>
          )}

          {rows && (rows.length ? rows.map((t) => <TicketRow key={t.id} t={t} />) : <Empty>No tickets in this bucket right now.</Empty>)}

          {kpi === 'Critical incidents' && incidents && (
            (incidents.filter((i) => ['SEV-1', 'SEV-2'].includes(i.severity) && i.status !== 'closed').length ? incidents.filter((i) => ['SEV-1', 'SEV-2'].includes(i.severity) && i.status !== 'closed') : []).map((i) => (
              <div key={i.id} className="flex items-center gap-2 py-2 border-b border-white/5 text-sm">
                <Badge v={i.severity} />
                <span className="flex-1 min-w-0 truncate text-white/85">{i.title}</span>
                <span className="text-[11px] text-white/40 hidden md:block">{i.service}</span>
                <select value={i.status} onChange={(e) => peosCall('incidents', 'PATCH', { id: i.id, status: e.target.value })} className="text-[11px] rounded-lg border border-white/10 bg-slate-900 px-1.5 py-1 text-amber-200 capitalize">
                  {['investigating', 'resolved', 'postmortem', 'closed'].map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <button onClick={async () => { if (await confirmDialog({ title: 'Delete incident', message: 'Delete this incident?', confirmText: 'Delete' })) peosCall('incidents', 'DELETE', { id: i.id }); }} className="text-[11px] px-2 py-1 rounded-lg border border-red-400/20 text-red-300/70 hover:bg-red-500/10">✕</button>
              </div>
            ))
          )}
          {kpi === 'Critical incidents' && incidents && !incidents.some((i) => ['SEV-1', 'SEV-2'].includes(i.severity) && i.status !== 'closed') && <Empty>No open critical incidents. 🎉</Empty>}

          {kpi === 'Sprint velocity' && (
            <div className="space-y-2 text-sm">
              <p className="text-3xl font-bold text-cyan-300">{dash?.velocity ?? 0} <span className="text-sm text-white/40 font-normal">story points resolved in active sprints</span></p>
              {(sprints || []).map((sp) => (
                <div key={sp.id} className="flex items-center gap-2 py-2 border-b border-white/5">
                  <Badge v={sp.status} />
                  <span className="flex-1 truncate text-white/85">{sp.name}</span>
                  <span className="text-[11px] text-white/40">{sp.capacity_points || 0} pts cap · {fmt(sp.starts_on)} → {fmt(sp.ends_on)}</span>
                  {sp.status === 'planned' && <button className={btn} onClick={() => peosCall('sprints', 'PATCH', { id: sp.id, status: 'active' })}>Start</button>}
                  {sp.status === 'active' && <button className={btn} onClick={() => peosCall('sprints', 'PATCH', { id: sp.id, status: 'done' })}>Finish</button>}
                  <button onClick={async () => { if (await confirmDialog({ title: 'Delete sprint', message: 'Delete this sprint?', confirmText: 'Delete' })) peosCall('sprints', 'DELETE', { id: sp.id }); }} className="text-[11px] px-2 py-1 rounded-lg border border-red-400/20 text-red-300/70 hover:bg-red-500/10">✕</button>
                </div>
              ))}
              {!sprints?.length && <Empty>No sprints yet — create one in the Delivery tab.</Empty>}
            </div>
          )}

          {(rows === undefined && !['Health score', 'Critical incidents', 'Sprint velocity'].includes(kpi)) && <Empty>Loading…</Empty>}
        </div>
      </div>
    </div>
  );
}

// field: [key, label, type] — type: text | textarea | date | number | select:opt1|opt2
const FORMS = {
  sprints: [['name', 'Sprint name'], ['goal', 'Goal'], ['starts_on', 'Start', 'date'], ['ends_on', 'End', 'date'], ['capacity_points', 'Capacity pts', 'number'], ['status', 'Status', 'select:planned|active|done']],
  epics: [['title', 'Epic title'], ['description', 'Description'], ['owner_email', 'Owner email'], ['milestone', 'Milestone'], ['status', 'Status', 'select:open|done']],
  incidents: [['title', 'Incident title'], ['severity', 'Severity', 'select:SEV-1|SEV-2|SEV-3|SEV-4'], ['service', 'Service'], ['owner_email', 'Owner email'], ['summary', 'Summary', 'textarea'], ['status', 'Status', 'select:investigating|resolved|postmortem|closed']],
  services: [['name', 'Service name'], ['description', 'Description'], ['owner_email', 'Owner'], ['backup_owner_email', 'Backup owner'], ['team', 'Team'], ['repository', 'Repo URL'], ['runbook', 'Runbook URL'], ['sla', 'SLA'], ['dependencies', 'Depends on (comma-separated services)']],
  okrs: [['level', 'Level', 'select:company|department|team|sprint'], ['objective', 'Objective'], ['key_result', 'Key result'], ['progress', 'Progress %', 'number'], ['owner_email', 'Owner'], ['quarter', 'Quarter (Q3-2026)']],
  announcements: [['kind', 'Type', 'select:company|release|maintenance|team'], ['title', 'Title'], ['body', 'Body', 'textarea']],
  testcases: [['ticket_id', 'Ticket # (e.g. 12)', 'number'], ['title', 'Test case title'], ['steps', 'Steps', 'textarea'], ['expected', 'Expected result', 'textarea']]
};
const TITLE = (x) => x.title || x.name || x.objective || '—';

function Field({ def, value, onChange }) {
  const [, label, type = 'text'] = def;
  if (type.startsWith('select:')) {
    return (
      <select value={value || ''} onChange={onChange} className={sel}>
        <option value="">{label}</option>
        {type.slice(7).split('|').map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (type === 'textarea') return <textarea rows={2} placeholder={label} value={value || ''} onChange={onChange} className={`${inp} resize-none col-span-2`} />;
  return <input type={type} placeholder={label} value={value || ''} onChange={onChange} className={inp} title={label} />;
}

function useResource(name) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const load = () => fetchJson(`/api/peos?resource=${name}`).then((d) => setItems(d.items || [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, [name]);
  const call = async (method, body) => {
    try { await fetchJson(`/api/peos?resource=${name}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setErr(''); load(); }
    catch (e) { setErr(e.message); }
  };
  return { items, err, load, add: (b) => call('POST', b), patch: (id, b) => call('PATCH', { id, ...b }), del: (id) => call('DELETE', { id }) };
}

function Resource({ name, title, subtitle, actions }) {
  const r = useResource(name);
  const [draft, setDraft] = useState({});
  const [showForm, setShowForm] = useState(false);
  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button className={btn} onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New'}</button>
      </div>
      <p className="text-xs text-white/40 mb-3">{subtitle}</p>
      {r.err && <p className="text-red-300 text-xs mb-2">{r.err}</p>}
      {showForm && (
        <div className="grid grid-cols-2 gap-2 mb-4 rounded-2xl border border-white/10 bg-slate-900/40 p-3">
          {FORMS[name].map((f) => (
            <Field key={f[0]} def={f} value={draft[f[0]]} onChange={(e) => setDraft((d) => ({ ...d, [f[0]]: e.target.value }))} />
          ))}
          <button onClick={() => { r.add(draft); setDraft({}); setShowForm(false); }} className={`${btnPri} col-span-2`}>Create</button>
        </div>
      )}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {!r.items.length && <Empty>Nothing here yet — create the first one.</Empty>}
        {r.items.map((x) => (
          <div key={x.id} className="rounded-xl bg-slate-900/60 border border-white/10 px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="text-white flex items-center gap-2 flex-wrap">
                <span className="truncate font-medium">{TITLE(x)}</span>
                <Badge v={x.severity} /><Badge v={x.status} /><Badge v={x.last_result} />
                {name === 'okrs' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-20 h-1.5 rounded-full bg-white/10 inline-block"><span className="block h-1.5 rounded-full bg-cyan-400" style={{ width: `${Math.min(100, x.progress || 0)}%` }} /></span>
                    <span className="text-cyan-300 text-xs">{x.progress || 0}%</span>
                  </span>
                )}
              </p>
              <p className="text-xs text-white/40 truncate mt-1">
                {[x.id && name !== 'testcases' ? `#${x.id}` : null, x.ticket_id ? `PA-${x.ticket_id}` : null, x.level, x.owner_email, x.team, x.goal, x.key_result, x.service, x.kind, x.milestone, x.quarter,
                  x.starts_on && `${fmt(x.starts_on)} → ${fmt(x.ends_on)}`, x.capacity_points && `${x.capacity_points} pts`,
                  x.run_by && `last run by ${x.run_by}`].filter(Boolean).join(' · ')}
              </p>
              {(x.body || x.summary) && <p className="text-xs text-white/55 mt-1 line-clamp-2">{x.body || x.summary}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0 justify-end max-w-[40%]">
              {actions?.(x, r)}
              <button className="text-xs px-2 py-1.5 rounded-lg border border-red-400/20 text-red-300/70 hover:bg-red-500/10" onClick={() => r.del(x.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── GitHub console ──────────────────────────────────────────────────────── */
function GitHubPanel() {
  const [status, setStatus] = useState(null);
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState(null); // {owner, name}
  const [view, setView] = useState({ branches: [], prs: [], commits: [] });
  const [newBranch, setNewBranch] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchJson('/api/github?status=1').then((d) => {
      setStatus(d);
      if (d.connected) fetchJson('/api/github?repos=1').then((x) => setRepos(x.repos || [])).catch((e) => setMsg(e.message));
    }).catch((e) => setStatus({ connected: false, error: e.message }));
  }, []);

  const openRepo = async (full) => {
    const [owner, name] = full.split('/');
    setRepo({ owner, name }); setMsg('');
    const qs = `owner=${owner}&repo=${name}`;
    const [b, p, c] = await Promise.all([
      fetchJson(`/api/github?branches=1&${qs}`).catch(() => ({ branches: [] })),
      fetchJson(`/api/github?prs=1&${qs}`).catch(() => ({ prs: [] })),
      fetchJson(`/api/github?commits=1&${qs}`).catch(() => ({ commits: [] }))
    ]);
    setView({ branches: b.branches, prs: p.prs, commits: c.commits });
  };

  const act = async (body) => {
    setMsg('Working…');
    try {
      await fetchJson(`/api/github?owner=${repo.owner}&repo=${repo.name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setMsg('Done ✓'); openRepo(`${repo.owner}/${repo.name}`);
    } catch (e) { setMsg(e.message); }
  };

  if (!status) return <Empty>Checking GitHub connection…</Empty>;
  if (!status.connected) {
    return (
      <div className={card}>
        <h3 className="text-lg font-semibold mb-2">GitHub</h3>
        <p className="text-sm text-white/55">Not connected. Add <span className="text-cyan-300">GITHUB_TOKEN</span> (fine-grained PAT or App token) and optional <span className="text-cyan-300">GITHUB_OWNER</span> to the environment, then reload.</p>
        <p className="text-xs text-white/40 mt-2">The inbound webhook works independently: point repos at <span className="text-cyan-300">/api/github-webhook</span> and PA-n references auto-link to tickets.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <p className="text-xs text-white/40">Connected as <span className="text-emerald-300">{status.login}</span>{status.owner && <> · default owner <span className="text-cyan-300">{status.owner}</span></>} {msg && <span className="ml-3 text-amber-300">{msg}</span>}</p>
      <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-5">
        <div className={card}>
          <h3 className="text-lg font-semibold mb-3">Repositories</h3>
          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1">
            {repos.map((x) => (
              <button key={x.full_name} onClick={() => openRepo(x.full_name)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${repo?.name === x.name ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/10 bg-slate-900/50 hover:bg-white/5'}`}>
                <p className="text-sm text-white truncate">{x.full_name} {x.private && <span className="text-[10px] text-amber-300">private</span>}</p>
                <p className="text-xs text-white/40">★ {x.stars} · {x.open_issues} issues · pushed {fmt(x.pushed_at)}</p>
              </button>
            ))}
            {!repos.length && <Empty>No repositories visible to this token.</Empty>}
          </div>
        </div>
        <div className="space-y-5">
          {repo ? (
            <>
              <div className={card}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Pull requests — {repo.name}</h3>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {view.prs.map((p) => (
                    <div key={p.number} className="rounded-xl bg-slate-900/60 border border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-cyan-300 truncate block">#{p.number} {p.title}</a>
                        <p className="text-xs text-white/40 truncate">{p.author} · {p.branch} → {p.base}{p.reviewers.length ? ` · reviewers: ${p.reviewers.join(', ')}` : ''}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button className={btn} onClick={() => act({ action: 'merge_pr', number: p.number })}>Merge</button>
                        <button className={btn} onClick={() => act({ action: 'close_pr', number: p.number })}>Close</button>
                      </div>
                    </div>
                  ))}
                  {!view.prs.length && <Empty>No open pull requests.</Empty>}
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className={card}>
                  <h3 className="text-lg font-semibold mb-3">Branches</h3>
                  <div className="flex gap-2 mb-3">
                    <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="PA-123-fix-login" className={`${inp} flex-1`} />
                    <button className={btn} onClick={() => newBranch && act({ action: 'create_branch', branch: newBranch })}>Create</button>
                  </div>
                  <div className="space-y-1 max-h-44 overflow-y-auto pr-1 text-sm">
                    {view.branches.map((b) => (
                      <p key={b.name} className="text-white/75 truncate">{b.name} <span className="text-white/30 text-xs">{b.sha}</span> {b.protected && <span className="text-[10px] text-amber-300">protected</span>}</p>
                    ))}
                  </div>
                </div>
                <div className={card}>
                  <h3 className="text-lg font-semibold mb-3">Recent commits</h3>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 text-sm">
                    {view.commits.map((c2) => (
                      <a key={c2.sha} href={c2.url} target="_blank" rel="noopener noreferrer" className="block text-white/75 hover:text-cyan-300 truncate">
                        <span className="text-white/30 font-mono text-xs mr-2">{c2.sha}</span>{c2.message}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : <div className={card}><Empty>Select a repository to manage branches and pull requests.</Empty></div>}
        </div>
      </div>
    </div>
  );
}

/* ── Service dependency map (simple layered text-graph) ──────────────────── */
function DependencyMap() {
  const { items } = useResource('services');
  const byName = useMemo(() => Object.fromEntries(items.map((s) => [s.name, s])), [items]);
  if (!items.length) return null;
  return (
    <div className={card}>
      <h3 className="text-lg font-semibold mb-3">Dependency map</h3>
      <div className="space-y-2">
        {items.map((s) => {
          const deps = String(s.dependencies || '').split(',').map((d) => d.trim()).filter(Boolean);
          return (
            <div key={s.id} className="flex items-center gap-2 flex-wrap text-sm">
              <span className="px-3 py-1.5 rounded-xl bg-cyan-300/10 border border-cyan-300/30 text-cyan-200">{s.name}</span>
              {deps.length ? <span className="text-white/30">→</span> : <span className="text-white/25 text-xs">no dependencies</span>}
              {deps.map((d) => (
                <span key={d} className={`px-3 py-1.5 rounded-xl border text-sm ${byName[d] ? 'bg-white/5 border-white/10 text-white/75' : 'bg-red-500/10 border-red-400/30 text-red-300'}`}>
                  {d}{!byName[d] && ' (uncataloged)'}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
const SUBTABS = ['overview', 'delivery', 'quality', 'operations', 'org', 'github'];

export default function AdminPeos() {
  const [tab, setTab] = useState('overview');
  const [dash, setDash] = useState(null);
  const [kpiModal, setKpiModal] = useState(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [plan, setPlan] = useState({ ticket: '', sprintId: '', epicId: '', storyPoints: '' });
  const [planMsg, setPlanMsg] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [aiOut, setAiOut] = useState('');

  const loadDash = () => fetchJson('/api/peos?dashboard=1&resource=epics').then(setDash).catch(() => {});
  useEffect(() => { loadDash(); const i = setInterval(loadDash, 20000); return () => clearInterval(i); }, []);

  const search = async () => {
    if (!q.trim()) return setResults(null);
    setResults((await fetchJson(`/api/peos?search=${encodeURIComponent(q)}&resource=epics`).catch(() => ({ results: [] }))).results);
  };
  const planTicket = async () => {
    setPlanMsg('');
    try {
      await fetchJson(`/api/peos?ticket=${encodeURIComponent(plan.ticket)}&resource=epics`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprintId: plan.sprintId || null, epicId: plan.epicId || null, storyPoints: plan.storyPoints || null })
      });
      setPlanMsg(`${plan.ticket.toUpperCase()} planned ✓`);
    } catch (e) { setPlanMsg(e.message); }
  };
  const summarize = async () => {
    setAiOut('Thinking…');
    try { setAiOut((await fetchJson(`/api/peos?summarize=${encodeURIComponent(aiKey)}&resource=epics`)).summary); }
    catch (e) { setAiOut(e.message); }
  };

  const t = dash?.tickets || {}; const inc = dash?.incidents || {};
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Engineering OS</h2>
          <p className="text-white/55 text-sm mt-1">Tickets at the center — sprints, QA, incidents, services, OKRs and GitHub all link back.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUBTABS.map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${tab === s ? 'bg-white text-slate-950' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'Health score', value: dash?.health ?? '—', alert: (dash?.health ?? 100) < 70 },
              { label: 'Open tickets', value: t.open }, { label: 'Overdue', value: t.overdue, alert: t.overdue > 0 },
              { label: 'SLA breaches', value: t.breaches, alert: t.breaches > 0 },
              { label: 'Closed (7d)', value: t.closed_week },
              { label: 'Critical incidents', value: inc.critical, alert: inc.critical > 0 },
              { label: 'Sprint velocity', value: dash?.velocity }
            ].map((k) => (
              <button key={k.label} onClick={() => setKpiModal(k.label)} title="Click for details & actions"
                className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center hover:border-cyan-300/40 hover:bg-white/10 transition-colors cursor-pointer">
                <p className={`text-2xl font-bold ${k.alert ? 'text-red-300' : 'text-cyan-300'}`}>{k.value ?? 0}</p>
                <p className="text-xs text-white/50 mt-1">{k.label}</p>
              </button>
            ))}
          </div>
          {kpiModal && <KpiModal kpi={kpiModal} dash={dash} onClose={() => setKpiModal(null)} onChanged={loadDash} />}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className={card}>
              <h3 className="text-lg font-semibold mb-2">Universal search</h3>
              <div className="flex gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder="Tickets, incidents, services, docs, people, PRs…" className={`${inp} flex-1`} />
                <button onClick={search} className={btn}>Go</button>
              </div>
              {results && (
                <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto">
                  {results.map((r2, ix) => (
                    <p key={ix} className="text-sm text-white/80 truncate">
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-cyan-300/10 text-cyan-200 mr-2">{r2.kind}</span>
                      {(r2.kind === 'ticket' || r2.kind === 'github') ? `PA-${r2.id} · ` : ''}{r2.title} <span className="text-white/35">{r2.status || ''}</span>
                    </p>
                  ))}
                  {!results.length && <Empty>No matches.</Empty>}
                </div>
              )}
            </div>
            <div className={card}>
              <h3 className="text-lg font-semibold mb-2">Plan a ticket</h3>
              <p className="text-xs text-white/45 mb-3">Attach a ticket to a sprint/epic with story points.</p>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="PA-12" value={plan.ticket} onChange={(e) => setPlan((p) => ({ ...p, ticket: e.target.value }))} className={inp} />
                <input placeholder="Sprint id" value={plan.sprintId} onChange={(e) => setPlan((p) => ({ ...p, sprintId: e.target.value }))} className={inp} />
                <input placeholder="Epic id" value={plan.epicId} onChange={(e) => setPlan((p) => ({ ...p, epicId: e.target.value }))} className={inp} />
                <input placeholder="Story points" value={plan.storyPoints} onChange={(e) => setPlan((p) => ({ ...p, storyPoints: e.target.value }))} className={inp} />
              </div>
              <button onClick={planTicket} className={`${btnPri} mt-3`}>Save plan</button>
              {planMsg && <p className="text-xs text-emerald-300 mt-2">{planMsg}</p>}
            </div>
            <div className={card}>
              <h3 className="text-lg font-semibold mb-2">AI ticket summary</h3>
              <p className="text-xs text-white/45 mb-3">Provider-abstracted (Groq / Anthropic / OpenAI).</p>
              <div className="flex gap-2">
                <input placeholder="PA-12" value={aiKey} onChange={(e) => setAiKey(e.target.value)} className={`${inp} flex-1`} />
                <button onClick={summarize} className={btn}>Summarize</button>
              </div>
              {aiOut && <p className="text-xs text-white/70 mt-3 whitespace-pre-wrap max-h-48 overflow-y-auto">{aiOut}</p>}
            </div>
          </div>
          <p className="text-xs text-white/35">
            API contract: <a className="text-cyan-300 hover:underline" href="/api/openapi.json" target="_blank" rel="noopener noreferrer">/api/openapi.json</a> ·
            GitHub webhook: <span className="text-cyan-300">/api/github-webhook</span> (PA-n auto-linking)
          </p>
        </>
      )}

      {tab === 'delivery' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Resource name="sprints" title="Sprints" subtitle="Plan, start and finish sprints; velocity flows into the dashboard."
            actions={(x, r) => (
              <>
                {x.status !== 'active' && x.status !== 'done' && <button className={btn} onClick={() => r.patch(x.id, { status: 'active' })}>Start</button>}
                {x.status === 'active' && <button className={btn} onClick={() => r.patch(x.id, { status: 'done' })}>Finish</button>}
              </>
            )} />
          <Resource name="epics" title="Epics & milestones" subtitle="Group tickets into larger initiatives."
            actions={(x, r) => x.status !== 'done' && <button className={btn} onClick={() => r.patch(x.id, { status: 'done' })}>Mark done</button>} />
        </div>
      )}

      {tab === 'quality' && (
        <Resource name="testcases" title="QA test cases" subtitle="Link cases to tickets (PA-n) and record pass/fail runs — gate releases on green."
          actions={(x, r) => (
            <>
              <button className={btn} onClick={() => r.patch(x.id, { last_result: 'pass', run_at: new Date().toISOString(), run_by: 'QA' })}>Pass</button>
              <button className={btn} onClick={() => r.patch(x.id, { last_result: 'fail', run_at: new Date().toISOString(), run_by: 'QA' })}>Fail</button>
              <button className={btn} onClick={() => r.patch(x.id, { last_result: 'blocked' })}>Blocked</button>
            </>
          )} />
      )}

      {tab === 'operations' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Resource name="incidents" title="Incidents" subtitle="SEV-1..4 · investigate → resolve → postmortem → close."
              actions={(x, r) => x.status !== 'closed' && (
                <button className={btn} onClick={() => r.patch(x.id, { status: x.status === 'investigating' ? 'resolved' : x.status === 'resolved' ? 'postmortem' : 'closed' })}>
                  {x.status === 'investigating' ? 'Resolve' : x.status === 'resolved' ? 'Postmortem' : 'Close'}
                </button>
              )} />
            <Resource name="services" title="Service catalog" subtitle="Owners, runbooks, SLAs and dependencies — the API & architecture registry." />
          </div>
          <DependencyMap />
        </div>
      )}

      {tab === 'org' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Resource name="okrs" title="OKRs" subtitle="Company → department → team → sprint."
            actions={(x, r) => <button className={btn} onClick={() => r.patch(x.id, { progress: Math.min(100, (Number(x.progress) || 0) + 10) })}>+10%</button>} />
          <Resource name="announcements" title="Announcements" subtitle="Company, release, maintenance and team updates." />
        </div>
      )}

      {tab === 'github' && <GitHubPanel />}
    </div>
  );
}
