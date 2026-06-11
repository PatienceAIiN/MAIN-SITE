import React, { useEffect, useState } from 'react';
import { fetchJson } from '../common/fetchJson';

// Engineering workspace inside the /team portal — pipeline board + PEOS
// resources, role-gated (what you can create/edit depends on the team role
// the admin assigned). Light/dark aware to match the portal theme.
const box = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4';
const inp = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none';
const selCls = `${inp}`;
const tb = 'text-[11px] px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:opacity-90';
const tb2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(v)) : '—';

const BADGE = {
  'SEV-1': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', 'SEV-2': 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  'SEV-3': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', 'SEV-4': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', planned: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  done: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', open: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  investigating: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  postmortem: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', closed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', fail: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  pending: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', blocked: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
};
const Badge = ({ v }) => v ? <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-semibold ${BADGE[v] || 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{v}</span> : null;

const MGMT = ['admin', 'executive', 'product_manager', 'engineering_manager', 'team_lead'];
const FORMS = {
  sprints: [['name', 'Sprint name'], ['goal', 'Goal'], ['starts_on', 'Start', 'date'], ['ends_on', 'End', 'date'], ['capacity_points', 'Capacity pts', 'number'], ['status', 'Status', 'select:planned|active|done']],
  epics: [['title', 'Epic title'], ['description', 'Description'], ['owner_email', 'Owner email'], ['milestone', 'Milestone']],
  incidents: [['title', 'Incident title'], ['severity', 'Severity', 'select:SEV-1|SEV-2|SEV-3|SEV-4'], ['service', 'Service'], ['summary', 'Summary']],
  testcases: [['ticket_id', 'Ticket # (e.g. 12)', 'number'], ['title', 'Test case title'], ['steps', 'Steps'], ['expected', 'Expected result']],
  okrs: [['level', 'Level', 'select:company|department|team|sprint'], ['objective', 'Objective'], ['key_result', 'Key result'], ['progress', 'Progress %', 'number'], ['quarter', 'Quarter (Q3-2026)']],
  services: [['name', 'Service name'], ['description', 'Description'], ['owner_email', 'Owner'], ['team', 'Team'], ['repository', 'Repo URL'], ['runbook', 'Runbook URL'], ['sla', 'SLA'], ['dependencies', 'Depends on (csv)']],
  announcements: [['kind', 'Type', 'select:company|release|maintenance|team'], ['title', 'Title'], ['body', 'Body']]
};
const WRITE = {
  sprints: MGMT, epics: MGMT, okrs: MGMT,
  incidents: 'all', testcases: 'all',
  announcements: MGMT, services: MGMT
};
const TITLE = (x) => x.title || x.name || x.objective || '—';
const canWrite = (resource, role) => WRITE[resource] === 'all' || WRITE[resource].includes(role);

function Resource({ name, title, myRole, actions }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({});
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const load = () => fetchJson(`/api/peos?resource=${name}`).then((d) => setItems(d.items || [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, [name]);
  const call = async (method, body) => {
    try { await fetchJson(`/api/peos?resource=${name}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setErr(''); load(); }
    catch (e) { setErr(e.message); }
  };
  const writable = canWrite(name, myRole);
  const canDelete = MGMT.includes(myRole);
  return (
    <div className={box}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
        {writable && <button className={tb2} onClick={() => setShow((v) => !v)}>{show ? 'Close' : '+ New'}</button>}
      </div>
      {err && <p className="text-red-500 text-xs mb-2">{err}</p>}
      {show && (
        <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 bg-slate-50 dark:bg-slate-800/50">
          {FORMS[name].map(([k, label, type = 'text']) => type.startsWith('select:') ? (
            <select key={k} value={draft[k] || ''} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className={selCls}>
              <option value="">{label}</option>
              {type.slice(7).split('|').map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input key={k} type={type} placeholder={label} title={label} value={draft[k] || ''}
              onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className={inp} />
          ))}
          <button className={`${tb} col-span-2`} onClick={() => { call('POST', draft); setDraft({}); setShow(false); }}>Create</button>
        </div>
      )}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {!items.length && <p className="text-xs text-slate-400 text-center py-4">Nothing yet.</p>}
        {items.map((x) => (
          <div key={x.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 py-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0 text-sm">
              <p className="text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                <span className="truncate font-medium">{TITLE(x)}</span>
                <Badge v={x.severity} /><Badge v={x.status} /><Badge v={x.last_result} />
                {name === 'okrs' && (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 inline-block"><span className="block h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, x.progress || 0)}%` }} /></span>
                    <span className="text-indigo-600 dark:text-indigo-300 text-[11px]">{x.progress || 0}%</span>
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {[x.ticket_id ? `PA-${x.ticket_id}` : (name !== 'testcases' ? `#${x.id}` : null), x.level, x.owner_email, x.goal, x.key_result, x.service, x.kind, x.milestone, x.quarter,
                  x.starts_on && `${fmt(x.starts_on)} → ${fmt(x.ends_on)}`, x.capacity_points && `${x.capacity_points} pts`].filter(Boolean).join(' · ')}
              </p>
              {(x.body || x.summary) && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{x.body || x.summary}</p>}
            </div>
            <div className="flex flex-wrap gap-1 shrink-0 justify-end">
              {writable && actions?.(x, { patch: (id, b) => call('PATCH', { id, ...b }) })}
              {canDelete && (
                <button className="text-[11px] px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => window.confirm('Delete this item?') && call('DELETE', { id: x.id })}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STAGE_COLS = [['pm_review', 'PM review'], ['em_review', 'EM review'], ['lead_triage', 'Lead triage'], ['dev', 'Development'], ['qa', 'QA'], ['done', 'Done']];

export default function TeamEngineering({ myRole, onOpenTicket }) {
  const [pipe, setPipe] = useState(null);
  const [dash, setDash] = useState(null);
  const load = () => {
    fetchJson('/api/dev-workflow').then(setPipe).catch(() => {});
    fetchJson('/api/peos?dashboard=1&resource=epics').then(setDash).catch(() => {});
  };
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  const t = dash?.tickets || {};
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[['Health', dash?.health], ['Open', t.open], ['Overdue', t.overdue], ['Breaches', t.breaches], ['Closed 7d', t.closed_week], ['Velocity', dash?.velocity]].map(([l, v]) => (
          <div key={l} className={`${box} !p-3 text-center`}>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-300">{v ?? 0}</p>
            <p className="text-[10px] text-slate-400">{l}</p>
          </div>
        ))}
      </div>

      {/* Pipeline board */}
      <div className={box}>
        <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">Engineering pipeline <span className="text-[11px] font-normal text-slate-400">— your role: {(myRole || 'member').replace(/_/g, ' ')}</span></p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {STAGE_COLS.map(([stage, label]) => (
            <div key={stage} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2 min-h-[90px]">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">{label} ({(pipe?.pipeline?.[stage] || []).length})</p>
              <div className="space-y-1.5">
                {(pipe?.pipeline?.[stage] || []).map((tk) => (
                  <button key={tk.id} onClick={() => onOpenTicket?.(tk.id)}
                    className="w-full text-left rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1.5 hover:border-indigo-400 transition-colors">
                    <p className="text-[10px] font-mono text-slate-400">{tk.key} · {tk.priority}</p>
                    <p className="text-[11px] text-slate-800 dark:text-slate-100 truncate">{tk.subject}</p>
                    <p className="text-[10px] text-slate-400 truncate">{tk.assignee_name || tk.assignee_email}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Tickets assigned to you appear in “My tickets” — act on them there (approve, assign, complete, QA).</p>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Resource name="sprints" title="Sprints" myRole={myRole}
          actions={(x, r) => (
            <>
              {x.status === 'planned' && <button className={tb2} onClick={() => r.patch(x.id, { status: 'active' })}>Start</button>}
              {x.status === 'active' && <button className={tb2} onClick={() => r.patch(x.id, { status: 'done' })}>Finish</button>}
            </>
          )} />
        <Resource name="epics" title="Epics & milestones" myRole={myRole}
          actions={(x, r) => x.status !== 'done' && <button className={tb2} onClick={() => r.patch(x.id, { status: 'done' })}>Done</button>} />
        <Resource name="incidents" title="Incidents" myRole={myRole}
          actions={(x, r) => x.status !== 'closed' && (
            <button className={tb2} onClick={() => r.patch(x.id, { status: x.status === 'investigating' ? 'resolved' : x.status === 'resolved' ? 'postmortem' : 'closed' })}>
              {x.status === 'investigating' ? 'Resolve' : x.status === 'resolved' ? 'Postmortem' : 'Close'}
            </button>
          )} />
        <Resource name="testcases" title="QA test cases" myRole={myRole}
          actions={(x, r) => (
            <>
              <button className={tb2} onClick={() => r.patch(x.id, { last_result: 'pass', run_at: new Date().toISOString(), run_by: 'QA' })}>Pass</button>
              <button className={tb2} onClick={() => r.patch(x.id, { last_result: 'fail', run_at: new Date().toISOString(), run_by: 'QA' })}>Fail</button>
            </>
          )} />
        <Resource name="okrs" title="OKRs" myRole={myRole}
          actions={(x, r) => <button className={tb2} onClick={() => r.patch(x.id, { progress: Math.min(100, (Number(x.progress) || 0) + 10) })}>+10%</button>} />
        <Resource name="services" title="Service catalog" myRole={myRole} />
        <Resource name="announcements" title="Announcements" myRole={myRole} />
      </div>
    </div>
  );
}
