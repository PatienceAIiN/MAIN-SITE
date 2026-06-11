import React, { useEffect, useState } from 'react';
import { fetchJson } from '../common/fetchJson';

// PEOS — engineering tab in the admin console. Compact, generic resource UI:
// exec dashboard, universal search, sprints (board + planning), epics,
// incidents, service catalog, OKRs, announcements, AI ticket summaries.
const card = 'rounded-[1.75rem] border border-white/10 bg-white/5 p-5';
const inp = 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70';
const btn = 'text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5';
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(v)) : '—';

const FORMS = {
  sprints: [['name', 'Sprint name'], ['goal', 'Goal'], ['starts_on', 'date'], ['ends_on', 'date'], ['capacity_points', 'Capacity pts'], ['status', 'planned|active|done']],
  epics: [['title', 'Epic title'], ['description', 'Description'], ['owner_email', 'Owner email'], ['milestone', 'Milestone'], ['status', 'open|done']],
  incidents: [['title', 'Incident title'], ['severity', 'SEV-1..4'], ['service', 'Service'], ['owner_email', 'Owner'], ['summary', 'Summary'], ['status', 'investigating|resolved|postmortem|closed']],
  services: [['name', 'Service name'], ['description', 'Description'], ['owner_email', 'Owner'], ['backup_owner_email', 'Backup owner'], ['team', 'Team'], ['repository', 'Repo URL'], ['runbook', 'Runbook URL'], ['sla', 'SLA'], ['dependencies', 'Depends on (csv)']],
  okrs: [['level', 'company|department|team|sprint'], ['objective', 'Objective'], ['key_result', 'Key result'], ['progress', '0-100'], ['owner_email', 'Owner'], ['quarter', 'Q3-2026']],
  announcements: [['kind', 'company|release|maintenance|team'], ['title', 'Title'], ['body', 'Body']]
};
const TITLE = (x) => x.title || x.name || x.objective || '—';

function Resource({ name }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({});
  const [err, setErr] = useState('');
  const load = () => fetchJson(`/api/peos?resource=${name}`).then((d) => setItems(d.items || [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, [name]);
  const add = async () => {
    try { await fetchJson(`/api/peos?resource=${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); setDraft({}); load(); }
    catch (e) { setErr(e.message); }
  };
  const patch = async (id, body) => {
    try { await fetchJson(`/api/peos?resource=${name}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }); load(); }
    catch (e) { setErr(e.message); }
  };
  const del = async (id) => {
    try { await fetchJson(`/api/peos?resource=${name}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load(); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className={card}>
      <h3 className="text-lg font-semibold capitalize mb-3">{name}</h3>
      {err && <p className="text-red-300 text-xs mb-2">{err}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        {FORMS[name].map(([k, ph]) => (
          <input key={k} type={ph === 'date' ? 'date' : 'text'} placeholder={ph === 'date' ? k : ph} value={draft[k] || ''}
            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className={inp} />
        ))}
        <button onClick={add} className="text-xs px-3 py-2 rounded-xl bg-white text-slate-950 font-semibold hover:bg-white/90">Add</button>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {items.map((x) => (
          <div key={x.id} className="rounded-xl bg-slate-900/60 border border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-white truncate">{TITLE(x)} {x.severity && <span className="text-red-300 text-xs ml-1">{x.severity}</span>}
                {x.progress !== undefined && x.progress !== null && name === 'okrs' && <span className="text-cyan-300 text-xs ml-1">{x.progress}%</span>}</p>
              <p className="text-xs text-white/40 truncate">
                {[x.status, x.owner_email, x.team, x.goal, x.key_result, x.service, x.kind].filter(Boolean).join(' · ')} · {fmt(x.created_at)}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {name === 'sprints' && x.status !== 'active' && <button className={btn} onClick={() => patch(x.id, { status: 'active' })}>Start</button>}
              {name === 'sprints' && x.status === 'active' && <button className={btn} onClick={() => patch(x.id, { status: 'done' })}>Finish</button>}
              {name === 'incidents' && x.status !== 'closed' && <button className={btn} onClick={() => patch(x.id, { status: x.status === 'investigating' ? 'resolved' : 'closed' })}>{x.status === 'investigating' ? 'Resolve' : 'Close'}</button>}
              {name === 'okrs' && <button className={btn} onClick={() => patch(x.id, { progress: Math.min(100, (Number(x.progress) || 0) + 10) })}>+10%</button>}
              {name === 'epics' && x.status !== 'done' && <button className={btn} onClick={() => patch(x.id, { status: 'done' })}>Done</button>}
              <button className="text-xs px-2 py-1.5 rounded-lg border border-red-400/20 text-red-300/70 hover:bg-red-500/10" onClick={() => del(x.id)}>✕</button>
            </div>
          </div>
        ))}
        {!items.length && <p className="text-white/40 text-sm">None yet.</p>}
      </div>
    </div>
  );
}

export default function AdminPeos() {
  const [dash, setDash] = useState(null);
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

  const t = dash?.tickets || {}; const i = dash?.incidents || {};
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Engineering OS</h2>
        <p className="text-white/55 text-sm mt-1">Tickets are the center — sprints, epics, incidents, services, OKRs and GitHub all link back to them.</p>
      </div>

      {/* Executive dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: 'Health score', value: dash?.health ?? '—', alert: (dash?.health ?? 100) < 70 },
          { label: 'Open tickets', value: t.open }, { label: 'Overdue', value: t.overdue, alert: t.overdue > 0 },
          { label: 'SLA breaches', value: t.breaches, alert: t.breaches > 0 },
          { label: 'Closed (7d)', value: t.closed_week },
          { label: 'Critical incidents', value: i.critical, alert: i.critical > 0 },
          { label: 'Sprint velocity (pts)', value: dash?.velocity }
        ].map((k) => (
          <div key={k.label} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center">
            <p className={`text-2xl font-bold ${k.alert ? 'text-red-300' : 'text-cyan-300'}`}>{k.value ?? 0}</p>
            <p className="text-xs text-white/50 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Universal search + sprint planning + AI */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
                  {r2.kind === 'ticket' || r2.kind === 'github' ? `PA-${r2.id} · ` : ''}{r2.title} <span className="text-white/35">{r2.status || ''}</span>
                </p>
              ))}
              {!results.length && <p className="text-white/40 text-sm">No matches.</p>}
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
          <button onClick={planTicket} className={`${btn} mt-2`}>Save</button>
          {planMsg && <p className="text-xs text-emerald-300 mt-2">{planMsg}</p>}
        </div>
        <div className={card}>
          <h3 className="text-lg font-semibold mb-2">AI ticket summary</h3>
          <div className="flex gap-2">
            <input placeholder="PA-12" value={aiKey} onChange={(e) => setAiKey(e.target.value)} className={`${inp} flex-1`} />
            <button onClick={summarize} className={btn}>Summarize</button>
          </div>
          {aiOut && <p className="text-xs text-white/70 mt-3 whitespace-pre-wrap max-h-48 overflow-y-auto">{aiOut}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Resource name="sprints" />
        <Resource name="epics" />
        <Resource name="incidents" />
        <Resource name="services" />
        <Resource name="okrs" />
        <Resource name="announcements" />
      </div>

      <p className="text-xs text-white/40">GitHub: point a repo webhook at <span className="text-cyan-300">/api/github-webhook</span> (secret: GITHUB_WEBHOOK_SECRET). Branches/commits/PRs/releases mentioning PA-&lt;n&gt; auto-link to the ticket and advance its workflow.</p>
    </div>
  );
}
