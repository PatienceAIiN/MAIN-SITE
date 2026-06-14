// Growth → Worklog. Work hours (from live presence logs) + leave records for
// every employee. Click an employee to see their per-day hours, recent work
// sessions and leave history, and to log a leave.
import React, { useCallback, useEffect, useState } from 'react';
import { FiClock, FiCalendar, FiPlus, FiTrash2, FiX, FiSearch } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import { Spinner, confirmDialog } from '../common/confirm';

const card = 'rounded-2xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800';
const input = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const btnPrimary = 'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50';
const bApi = (p, opts = {}) => fetchJson(`/api/business${p}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
const fmtD = (v) => v ? new Date(v).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid', 'wfh'];
const STATUS_BADGE = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  probation: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

function EmployeeWorklog({ emp, onClose }) {
  const [d, setD] = useState(null);
  const [leaveForm, setLeaveForm] = useState(null); // {type, start_date, end_date, reason}
  const load = useCallback(() => bApi(`/worklog?email=${encodeURIComponent(emp.email)}`).then(setD).catch(() => setD({ error: true })), [emp.email]);
  useEffect(() => { load(); }, [load]);
  const addLeave = async () => {
    const f = leaveForm; if (!f?.start_date) return;
    await bApi('/leaves', { method: 'POST', body: JSON.stringify({ employee_id: emp.id, employee_email: emp.email, ...f }) }).catch(() => {});
    setLeaveForm(null); load();
  };
  const delLeave = async (id) => { if (!(await confirmDialog({ title: 'Delete leave', message: 'Remove this leave record?', confirmText: 'Delete' }))) return; await bApi(`/leaves?id=${id}`, { method: 'DELETE' }).catch(() => {}); load(); };
  const days = d?.byDay ? Object.entries(d.byDay).sort().slice(-14) : [];
  const maxMin = Math.max(60, ...days.map(([, m]) => m));
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${card} w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h3 className="text-lg font-bold text-slate-900 dark:text-white">{emp.name}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX /></button></div>
        <p className="text-xs text-slate-400 mb-4">{emp.title || emp.email} · {emp.department}</p>
        {!d ? <div className="grid place-items-center py-12"><Spinner /></div> : d.error ? <p className="text-sm text-slate-400">Could not load.</p> : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className={`${card} p-3 text-center`}><div className="text-xl font-bold text-indigo-600">{d.totalHours}h</div><div className="text-[10px] text-slate-400">last 30 days</div></div>
              <div className={`${card} p-3 text-center`}><div className="text-xl font-bold text-emerald-600">{emp.hoursWeek}h</div><div className="text-[10px] text-slate-400">this week</div></div>
              <div className={`${card} p-3 text-center`}><div className="text-xl font-bold text-amber-600">{(d.leaves || []).reduce((s, l) => s + Number(l.days || 0), 0)}</div><div className="text-[10px] text-slate-400">leave days</div></div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><FiClock size={14} /> Daily work hours (last 14 days)</h4>
              {days.length ? (
                <div className="flex items-end gap-1 h-28">
                  {days.map(([day, mins]) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1" title={`${day}: ${(mins / 60).toFixed(1)}h`}>
                      <div className="w-full rounded-t bg-indigo-500" style={{ height: `${Math.max(4, (mins / maxMin) * 96)}px` }} />
                      <span className="text-[8px] text-slate-400">{day.slice(8)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">No tracked work hours yet (built from live presence logs).</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><FiCalendar size={14} /> Leave history</h4>
                <button className="text-xs text-indigo-600 font-medium" onClick={() => setLeaveForm({ type: 'casual', start_date: '', end_date: '', reason: '' })}><FiPlus className="inline -mt-0.5" size={12} /> Add leave</button>
              </div>
              {leaveForm && (
                <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <select className={input} value={leaveForm.type} onChange={(e) => setLeaveForm((s) => ({ ...s, type: e.target.value }))}>{LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                  <input className={input} placeholder="Reason" value={leaveForm.reason} onChange={(e) => setLeaveForm((s) => ({ ...s, reason: e.target.value }))} />
                  <label className="text-xs text-slate-500">From<input type="date" className={input} value={leaveForm.start_date} onChange={(e) => setLeaveForm((s) => ({ ...s, start_date: e.target.value }))} /></label>
                  <label className="text-xs text-slate-500">To<input type="date" className={input} value={leaveForm.end_date} onChange={(e) => setLeaveForm((s) => ({ ...s, end_date: e.target.value }))} /></label>
                  <button className={`${btnPrimary} col-span-2 justify-center`} onClick={addLeave}>Save leave</button>
                </div>
              )}
              <ul className="space-y-1.5">
                {(d.leaves || []).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm">
                    <div><span className="font-medium capitalize text-slate-800 dark:text-slate-100">{l.type}</span> <span className="text-slate-400">· {fmtD(l.start_date)}{l.end_date && l.end_date !== l.start_date ? ` → ${fmtD(l.end_date)}` : ''} · {l.days}d</span>{l.reason && <span className="text-slate-400"> · {l.reason}</span>}</div>
                    <div className="flex items-center gap-2 shrink-0"><span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[l.status] || ''}`}>{l.status}</span><button onClick={() => delLeave(l.id)} className="text-slate-300 hover:text-red-500"><FiTrash2 size={13} /></button></div>
                  </li>
                ))}
                {!(d.leaves || []).length && <li className="text-xs text-slate-400 text-center py-3">No leave recorded.</li>}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Recent work sessions</h4>
              <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
                {(d.sessions || []).map((s, i) => <li key={i} className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40"><span>{new Date(s.start).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span><span className="text-slate-400">{(s.mins / 60).toFixed(1)}h</span></li>)}
                {!(d.sessions || []).length && <li className="text-slate-400 text-center py-3">No sessions yet.</li>}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GrowthWorklog() {
  const [emps, setEmps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  useEffect(() => { setLoading(true); bApi('/worklog').then((d) => setEmps(d.employees || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  const ql = q.toLowerCase();
  const list = emps.filter((e) => `${e.name} ${e.email} ${e.department}`.toLowerCase().includes(ql));
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input className={`${input} pl-9`} placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className={`${card} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
            <tr><th className="text-left px-4 py-3">Employee</th><th className="text-left px-4 py-3">Department</th><th className="text-right px-4 py-3">Hours / week</th><th className="text-right px-4 py-3">Leave days</th><th className="text-center px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" className="text-center py-12"><Spinner /></td></tr> : list.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setSel(e)}>
                <td className="px-4 py-3"><div className="font-semibold text-slate-800 dark:text-slate-100">{e.name}</div><div className="text-xs text-slate-400">{e.title || e.email}</div></td>
                <td className="px-4 py-3 text-slate-500">{e.department}</td>
                <td className="px-4 py-3 text-right font-medium">{e.hoursWeek}h</td>
                <td className="px-4 py-3 text-right">{e.leaveDays}{e.leaveCount ? ` (${e.leaveCount})` : ''}</td>
                <td className="px-4 py-3 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[e.status] || 'bg-slate-100 text-slate-500'}`}>{(e.status || '').replace('_', ' ')}</span></td>
              </tr>
            ))}
            {!loading && !list.length && <tr><td colSpan="5" className="text-center py-12 text-slate-400">No employees. Add them in People / HR.</td></tr>}
          </tbody>
        </table>
      </div>
      {sel && <EmployeeWorklog emp={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
