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

/* ── Sprint burndown chart (SVG, no chart library) ───────────────────────── */
function BurndownModal({ sprintId, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { fetchJson(`/api/peos?sprintBoard=${sprintId}&resource=epics`).then(setD).catch(() => setD({ tickets: [] })); }, [sprintId]);
  if (!d) return null;
  const sp = d.sprint || {};
  const tickets = d.tickets || [];
  const total = tickets.reduce((a, t) => a + (Number(t.story_points) || 0), 0);
  const start = sp.starts_on ? new Date(sp.starts_on) : new Date(Math.min(...tickets.map((t) => new Date(t.created_at).getTime()), Date.now()));
  const end = sp.ends_on ? new Date(sp.ends_on) : new Date();
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const series = [];
  for (let i = 0; i <= days; i += 1) {
    const day = new Date(start.getTime() + i * 86400000);
    const donePts = tickets.filter((t) => t.resolved_at && new Date(t.resolved_at) <= day).reduce((a, t) => a + (Number(t.story_points) || 0), 0);
    series.push(total - donePts);
  }
  const W = 460, H = 200, px = (i) => 30 + (i / days) * (W - 50), py = (v) => 10 + (total ? (1 - v / total) * (H - 40) : 0);
  return (
    <Modal title={`Burndown — ${sp.name || `sprint #${sprintId}`}`} onClose={onClose} wide>
      {total === 0 ? <p className="text-xs text-slate-400">No story points planned in this sprint yet — plan tickets with points to see the burndown.</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <line x1={px(0)} y1={py(total)} x2={px(days)} y2={py(0)} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="1.5" />
            <polyline fill="none" stroke="#6366f1" strokeWidth="2.5" points={series.map((v, i) => `${px(i)},${py(v)}`).join(' ')} />
            <text x={px(0)} y={py(total) - 4} fontSize="10" fill="#64748b">{total} pts</text>
            <text x={px(0)} y={H - 6} fontSize="10" fill="#64748b">{sp.starts_on || 'start'}</text>
            <text x={px(days) - 50} y={H - 6} fontSize="10" fill="#64748b">{sp.ends_on || 'today'}</text>
          </svg>
          <p className="text-[11px] text-slate-400 mt-1">Solid = actual remaining points · dashed = ideal pace · remaining now: <b className="text-indigo-500">{series[series.length - 1]} / {total} pts</b></p>
        </>
      )}
    </Modal>
  );
}

/* ── Generic popup modal ─────────────────────────────────────────────────── */
export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[88vh] overflow-y-auto`}>
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{title}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Ticket peek modal (pipeline click) — timeline + workflow actions ────── */
function TicketPeek({ id, myRole, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = () => fetchJson(`/api/tickets?id=${id}`).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [id]);
  const act = async (action, comment = '', assigneeEmail = '') => {
    setErr('');
    try {
      await fetchJson('/api/dev-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: id, action, comment, assigneeEmail }) });
      load();
    } catch (e) { setErr(e.message); }
  };
  const ask = (action, label) => { const c = window.prompt(label); if (c) act(action, c); };
  const t = d?.ticket;
  const stage = t?.stage;
  const ACTIONS = {
    pm_review: [['pm_approve', 'Approve → next', () => act('pm_approve'), ['product_manager']], ['pm_reject', 'Reject', () => ask('pm_reject', 'Reason for rejection:'), ['product_manager']]],
    em_review: [['em_approve', 'Approve → Lead', () => act('em_approve'), ['engineering_manager']], ['em_reject', 'Reject', () => ask('em_reject', 'Reason:'), ['engineering_manager']]],
    lead_triage: [['lead_assign', 'Assign to dev…', () => { const e = window.prompt('Developer email (@patienceai.in):'); if (e) act('lead_assign', '', e); }, ['team_lead', 'engineering_manager']]],
    dev: [['dev_complete', 'Complete → QA', () => act('dev_complete'), ['software_dev', 'team_lead']]],
    qa: [['qa_approve', 'QA approve ✓', () => act('qa_approve'), ['qa']], ['qa_reject', 'Send back', () => ask('qa_reject', 'What needs improvement?'), ['qa']]]
  };
  const allowed = (roles) => ['admin', 'executive'].includes(myRole) || roles.includes(myRole);
  return (
    <Modal title={t ? `${t.key} — ${t.subject}` : `PA-${id}`} onClose={onClose} wide>
      {err && <p className="text-red-500 text-xs mb-2">{err}</p>}
      {!t ? <p className="text-xs text-slate-400">Loading…</p> : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge v={t.status} /><Badge v={t.priority} />{stage && stage !== 'support' && <Badge v={stage} />}
          </div>
          {t.description && <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{t.description}</p>}
          <p className="text-[11px] text-slate-400">
            Assignee: {t.assignee_name} ({t.assignee_email}) · By {t.created_by_name || 'Support'} · {fmt(t.created_at)}
            {t.customer_email && <> · Client: {t.customer_email}</>}
          </p>
          {stage && ACTIONS[stage] && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 p-2.5">
              {ACTIONS[stage].filter(([, , , roles]) => allowed(roles)).map(([k, label, fn]) => (
                <button key={k} className={tb} onClick={fn}>{label}</button>
              ))}
              {!ACTIONS[stage].some(([, , , roles]) => allowed(roles)) && (
                <p className="text-[11px] text-slate-400">Waiting on {stage.replace('_', ' ')} — not your step.</p>
              )}
            </div>
          )}
          <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 bg-slate-50 dark:bg-slate-800/40">
            {(d.comments || []).map((c) => (
              <p key={c.id} className="text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{c.author_name || c.author_role}</span>
                {c.is_internal && <span className="text-amber-600"> [internal]</span>}: {c.message}
                <span className="text-slate-400"> · {fmt(c.created_at)}</span>
              </p>
            ))}
            {!(d.comments || []).length && <p className="text-[11px] text-slate-400">No activity yet.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
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
  incidents: 'all', testcases: [...MGMT, 'qa'],
  announcements: MGMT, services: MGMT
};
const TITLE = (x) => x.title || x.name || x.objective || '—';
const canWrite = (resource, role) => WRITE[resource] === 'all' || WRITE[resource].includes(role);

const PER_PAGE = 5;

function Resource({ name, title, myRole, actions }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({});
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(0);
  const load = () => fetchJson(`/api/peos?resource=${name}`).then((d) => setItems(d.items || [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, [name]);
  const call = async (method, body) => {
    try { await fetchJson(`/api/peos?resource=${name}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setErr(''); load(); }
    catch (e) { setErr(e.message); }
  };
  const writable = canWrite(name, myRole);
  const canDelete = MGMT.includes(myRole);
  const [peek, setPeek] = useState(null);
  const [edit, setEdit] = useState({});
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const paged = items.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);
  return (
    <div className={box}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{title} <span className="text-[11px] font-normal text-slate-400">({items.length})</span></p>
        {writable && <button className={tb2} onClick={() => setShow(true)}>+ New</button>}
      </div>
      {err && <p className="text-red-500 text-xs mb-2">{err}</p>}
      {show && (
        <Modal title={`New — ${title}`} onClose={() => setShow(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {FORMS[name].map(([k, label, type = 'text']) => (
              <div key={k}>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                {type.startsWith('select:') ? (
                  <select value={draft[k] || ''} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className={`${selCls} w-full`}>
                    <option value="">{label}</option>
                    {type.slice(7).split('|').map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={type} placeholder={label} value={draft[k] || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} className={`${inp} w-full`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button className={tb} onClick={() => { call('POST', draft); setDraft({}); setShow(false); setPage(0); }}>Create</button>
            <button className={tb2} onClick={() => setShow(false)}>Cancel</button>
          </div>
        </Modal>
      )}
      <div className="space-y-2 pr-1">
        {!items.length && <p className="text-xs text-slate-400 text-center py-4">Nothing yet.</p>}
        {paged.map((x) => (
          <div key={x.id} onClick={() => { setPeek(x); setEdit(x); }}
            className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 py-2.5 flex items-start justify-between gap-2 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
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
            <div className="flex flex-wrap gap-1 shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
              {writable && actions?.(x, { patch: (id, b) => call('PATCH', { id, ...b }) })}
              {canDelete && (
                <button className="text-[11px] px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this item?')) call('DELETE', { id: x.id }); }}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <button className={tb2} disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹ Prev</button>
          <span className="text-[11px] text-slate-400">Page {safePage + 1} / {pages}</span>
          <button className={tb2} disabled={safePage >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next ›</button>
        </div>
      )}
      {peek && (
        <Modal title={`${title}: ${TITLE(peek)}`} onClose={() => setPeek(null)} wide>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {FORMS[name].map(([k, label, type = 'text']) => (
              <div key={k} className={type === 'textarea' ? 'md:col-span-2' : ''}>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                {writable ? (
                  type.startsWith('select:') ? (
                    <select value={edit[k] ?? ''} onChange={(e) => setEdit((d) => ({ ...d, [k]: e.target.value }))} className={`${selCls} w-full`}>
                      <option value="">—</option>
                      {type.slice(7).split('|').map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} value={edit[k] ?? ''}
                      onChange={(e) => setEdit((d) => ({ ...d, [k]: e.target.value }))} className={`${inp} w-full`} />
                  )
                ) : (
                  <p className="text-sm text-slate-800 dark:text-slate-100">{String(peek[k] ?? '—')}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Created {fmt(peek.created_at)}{peek.run_by ? ` · last run by ${peek.run_by} ${fmt(peek.run_at)}` : ''}</p>
          {writable && (
            <div className="flex gap-2 mt-4">
              <button className={tb} onClick={() => {
                const body = {};
                for (const [k] of FORMS[name]) if (edit[k] !== undefined && edit[k] !== peek[k]) body[k] = edit[k];
                call('PATCH', { id: peek.id, ...body }); setPeek(null);
              }}>Save changes</button>
              <button className={tb2} onClick={() => setPeek(null)}>Cancel</button>
              {canDelete && (
                <button className="text-[11px] px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 ml-auto"
                  onClick={() => { if (window.confirm('Delete this item?')) { call('DELETE', { id: peek.id }); setPeek(null); } }}>
                  Delete
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

const STAGE_COLS = [['pm_review', 'PM review'], ['em_review', 'EM review'], ['lead_triage', 'Lead triage'], ['dev', 'Development'], ['qa', 'QA'], ['done', 'Done']];

export default function TeamEngineering({ myRole }) {
  const [peekTicket, setPeekTicket] = useState(null);
  const [burndown, setBurndown] = useState(null);
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
                  <button key={tk.id} onClick={() => setPeekTicket(tk.id)}
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
        <p className="text-[10px] text-slate-400 mt-2">Click any card to open it — actions for your role appear inside.</p>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Resource name="sprints" title="Sprints" myRole={myRole}
          actions={(x, r) => (
            <>
              <button className={tb2} onClick={() => setBurndown(x.id)}>Burndown</button>
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
      {peekTicket && <TicketPeek id={peekTicket} myRole={myRole} onClose={() => setPeekTicket(null)} />}
      {burndown && <BurndownModal sprintId={burndown} onClose={() => setBurndown(null)} />}
    </div>
  );
}
