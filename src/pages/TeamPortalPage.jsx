import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiEye, FiEyeOff, FiLogOut, FiMoon, FiSun, FiSend, FiRefreshCw, FiSearch,
  FiLock, FiX, FiTag, FiUser, FiMail, FiClock, FiMessageSquare, FiSettings,
  FiBell, FiBellOff, FiUploadCloud, FiFileText, FiMaximize2,
  FiHome, FiCopy, FiUsers, FiGithub, FiExternalLink, FiTrash2, FiPlus, FiCode, FiCheck, FiShield, FiVideo, FiBookOpen
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import NetworkDot from '../common/NetworkDot';
import { NotificationBell, SlaBadge, AttachmentList, uploadFiles } from '../components/TicketCenter';
import TeamEngineering, { Modal } from '../components/TeamEngineering';
import DevTickets from '../components/DevTickets';
import { NotesTab, MeetingsTab } from '../components/TeamNotes';
import Colleagues, { enablePushNotifications, disablePushNotifications } from '../components/Colleagues';
import { FiPaperclip, FiAlertTriangle } from 'react-icons/fi';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const statusLabel = (s) => (s || '').replace('_', ' ');
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';

const PRIORITY_BADGE = {
  low: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  medium: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  urgent: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
};
const STATUS_BADGE = {
  open: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  closed: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
};

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-white/20';
const cardCls = 'bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800';

/* ── Activate (set password from invite) ─────────────────────────────────── */
function ActivateForm({ token, onActivated }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setErr('Passwords do not match'); return; }
    setLoading(true); setErr('');
    try {
      await fetchJson('/api/team-members/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      onActivated();
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl p-8 shadow-sm ${cardCls}`}>
        <p className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2 font-medium">Activate account</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Set your password</h1>
        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              required placeholder="New password (min 8 chars)" className={`${inputCls} pr-12`} />
            <button type="button" onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            required placeholder="Confirm password" className={inputCls} />
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white font-semibold py-3 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Activating…' : 'Activate & sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Login ───────────────────────────────────────────────────────────────── */
function LoginForm({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const data = await fetchJson('/api/team-members/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      onLogin(data.member);
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl p-8 shadow-sm ${cardCls}`}>
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 font-medium">Patience AI · Team</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Sign in</h1>
        <form onSubmit={submit} className="space-y-4">
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required placeholder="you@patienceai.in" className={inputCls} />
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required placeholder="Password" className={`${inputCls} pr-12`} />
            <button type="button" onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white font-semibold py-3 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-5">Access is invite-only. Ask your admin for an invitation email.</p>
      </div>
    </div>
  );
}

/* ── Settings modal: notifications toggle + change password ──────────────── */
function SettingsModal({ open, onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifOn, setNotifOn] = useState(true);
  const [notifMsg, setNotifMsg] = useState('');
  const [notifBusy, setNotifBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ currentPassword: '', newPassword: '', confirm: '' }); setErr(''); setDone(false); setNotifMsg('');
      fetchJson('/api/team-members/me').then((d) => setNotifOn(d.member?.notificationsEnabled !== false)).catch(() => {});
    }
  }, [open]);

  const toggleNotifications = async () => {
    setNotifBusy(true); setNotifMsg('');
    const next = !notifOn;
    try {
      if (next) await enablePushNotifications();
      else await disablePushNotifications();
      await fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settings', notificationsEnabled: next }) });
      setNotifOn(next);
      setNotifMsg(next ? 'Notifications enabled — you’ll get pushes for messages and calls.' : 'Notifications disabled.');
    } catch (ex) { setNotifMsg(ex.message); }
    finally { setNotifBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { setErr('New passwords do not match'); return; }
    setLoading(true); setErr('');
    try {
      await fetchJson('/api/team-members/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      });
      setDone(true);
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div initial={{ scale: 0.93, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 18 }}
            className={`rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ${cardCls}`}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <p className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2"><FiSettings size={14} /> Settings</p>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiX size={16} /></button>
            </div>
            {/* Notifications */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    {notifOn ? <FiBell size={13} /> : <FiBellOff size={13} />} Notifications
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Browser pushes for new messages and incoming calls.</p>
                </div>
                <button onClick={toggleNotifications} disabled={notifBusy} aria-label="Toggle notifications"
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${notifOn ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${notifOn ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              {notifMsg && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">{notifMsg}</p>}
            </div>
            <p className="px-5 pt-4 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><FiLock size={11} /> Change password</p>
            {done ? (
              <div className="p-5 space-y-4">
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Password updated successfully.</p>
                <button onClick={onClose} className="w-full rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-semibold py-2.5 text-sm">Done</button>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 space-y-3">
                <input type="password" value={form.currentPassword} onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  required placeholder="Current password" className={inputCls} />
                <input type="password" value={form.newPassword} onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  required placeholder="New password (min 8 chars)" className={inputCls} />
                <input type="password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                  required placeholder="Confirm new password" className={inputCls} />
                {err && <p className="text-red-500 text-xs">{err}</p>}
                <button type="submit" disabled={loading}
                  className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white font-semibold py-2.5 disabled:opacity-50 text-sm">
                  {loading ? 'Saving…' : 'Update password'}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Jira-like workflow actions (role-gated, stage-aware) ────────────────── */
const STAGE_LABEL = { pm_review: 'PM review', em_review: 'EM review', lead_triage: 'Lead triage', dev: 'Development', qa: 'QA', done: 'Done' };
function WorkflowActions({ ticket, myRole, onChanged }) {
  const [assign, setAssign] = useState('');
  const [err, setErr] = useState('');
  const act = async (action, comment = '', assigneeEmail = '') => {
    setErr('');
    try {
      await fetchJson('/api/dev-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id, action, comment, assigneeEmail }) });
      onChanged?.();
    } catch (e) { setErr(e.message); }
  };
  const ask = (action, label) => { const c = window.prompt(label); if (c) act(action, c); };
  const stage = ticket.stage;
  const b = 'text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium';
  const b2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
  if (!stage || stage === 'support' || stage === 'done') return null;
  return (
    <div className="mt-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 p-3">
      <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
        Engineering pipeline · stage: {STAGE_LABEL[stage] || stage}
      </p>
      <div className="flex flex-wrap gap-2">
        {stage === 'pm_review' && ['product_manager','admin','executive'].includes(myRole) && (<>
          <button className={b} onClick={() => act('pm_approve')}>Approve → EM</button>
          <button className={b2} onClick={() => ask('pm_reject', 'Reason for rejection (sent back to support):')}>Reject</button>
        </>)}
        {stage === 'em_review' && ['engineering_manager','admin','executive'].includes(myRole) && (<>
          <button className={b} onClick={() => act('em_approve')}>Approve → Team Lead</button>
          <button className={b2} onClick={() => ask('em_reject', 'Reason for rejection:')}>Reject</button>
        </>)}
        {stage === 'lead_triage' && ['team_lead','engineering_manager','admin','executive'].includes(myRole) && (<>
          <input value={assign} onChange={(e) => setAssign(e.target.value)} placeholder="dev@patienceai.in"
            className="text-[11px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 dark:text-slate-100" />
          <button className={b} onClick={() => assign && act('lead_assign', '', assign)}>Assign to dev</button>
        </>)}
        {stage === 'dev' && ['software_dev','admin','executive','team_lead'].includes(myRole) && (
          <button className={b} onClick={() => act('dev_complete')}>Complete → QA</button>
        )}
        {stage === 'qa' && ['qa','admin','executive'].includes(myRole) && (<>
          <button className={b} onClick={() => act('qa_approve')}>QA approve ✓</button>
          <button className={b2} onClick={() => ask('qa_reject', 'What needs improvement? (returned to the developer)')}>Send back</button>
        </>)}
      </div>
      {err && <p className="text-red-500 text-xs mt-2">{err}</p>}
    </div>
  );
}

/* ── Ticket detail with comment chat ─────────────────────────────────────── */
function MemberTicketDetail({ ticket, myRole, onChanged, onClose }) {
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [input, setInput] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef(null);

  const load = async () => {
    try {
      const d = await fetchJson(`/api/tickets?id=${ticket.id}`);
      setComments(d.comments || []);
      setAttachments(d.attachments || []);
    } catch { /* ignore */ }
  };

  const onUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    const errors = await uploadFiles(ticket.id, files);
    if (errors.length) setErr(errors.join('; '));
    await load();
    setUploading(false);
  };

  useEffect(() => {
    setComments([]);
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);

  }, [ticket.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments.length]);

  const update = async (patch) => {
    setErr('');
    try {
      await fetchJson('/api/tickets', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticket.id, ...patch })
      });
      onChanged?.();
    } catch (ex) { setErr(ex.message); }
  };

  const sendComment = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    try {
      await fetchJson('/api/tickets/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id, message: text, isInternal })
      });
      await load();
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-y-auto max-h-[40%] space-y-1.5">
        {/* Row 1: close · key · subject · priority/SLA */}
        <div className="flex items-center gap-2">
          <button onClick={onClose} title="Close chat"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
            <FiX size={14} />
          </button>
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">{ticket.key}</span>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate flex-1">{ticket.subject}</h3>
          <SlaBadge ticket={ticket} />
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold capitalize shrink-0 ${PRIORITY_BADGE[ticket.priority]}`}>
            {ticket.priority}
          </span>
        </div>
        {/* Row 2: description + meta, one compact line each */}
        {ticket.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap line-clamp-2 pl-7">{ticket.description}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400 dark:text-slate-500 pl-7">
          <span className="flex items-center gap-1"><FiUser size={10} /> {ticket.created_by_name || 'Support team'}</span>
          {ticket.customer_email && <span className="flex items-center gap-1"><FiMail size={10} /> {ticket.customer_email}</span>}
          <span className="flex items-center gap-1"><FiClock size={10} /> {fmt(ticket.created_at)}</span>
          {Number(ticket.escalation_level) > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"><FiAlertTriangle size={10} /> Escalation L{ticket.escalation_level}</span>
          )}
        </div>
        <WorkflowActions ticket={ticket} myRole={myRole} onChanged={onChanged} />
        {/* Row 3: attachments · status dropdown · priority dropdown — one wrapping row */}
        <div className="flex flex-wrap items-center gap-1.5 pl-7">
          {attachments.length > 0 && <AttachmentList attachments={attachments} />}
          {/* deliberate dropdown (not tap-pills) so a stray tap can't move the workflow */}
          <select value={ticket.status} onChange={(e) => update({ status: e.target.value })}
            className={`text-[10px] rounded-full border px-1.5 py-0.5 font-medium capitalize focus:outline-none ${STATUS_BADGE[ticket.status]}`}>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select value={ticket.priority} onChange={(e) => update({ priority: e.target.value })}
            className="text-[10px] rounded-full border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 capitalize focus:outline-none">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p} priority</option>)}
          </select>
        </div>
        {err && <p className="text-red-500 text-xs">{err}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 dark:bg-slate-950 min-h-0">
        {comments.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-xs text-center py-6">No activity yet.</p>}
        {comments.map((c) => (
          c.author_role === 'system' ? (
            <p key={c.id} className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-1">{c.message} · {fmt(c.created_at)}</p>
          ) : (
            <div key={c.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${c.is_internal
              ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200'
              : c.author_role === 'member'
                ? 'ml-auto bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100'}`}>
              <p className={`text-[10px] uppercase tracking-wider mb-1 ${c.is_internal ? 'text-amber-600 dark:text-amber-400' : c.author_role === 'member' ? 'text-white/40 dark:text-slate-500' : 'text-slate-400'}`}>
                {c.author_name || c.author_role}{c.author_role === 'client' ? ' (client)' : ''} · {fmt(c.created_at)}{c.is_internal ? ' · internal note' : ''}
              </p>
              <p className="whitespace-pre-wrap leading-snug">{c.message}</p>
            </div>
          )
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-end gap-2">
          <label className={`h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${uploading ? 'opacity-40 pointer-events-none' : ''}`} title="Attach file">
            <FiPaperclip size={15} className="text-slate-500 dark:text-slate-300" />
            <input type="file" multiple className="hidden"
              onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }} />
          </label>
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
            rows={2} placeholder={isInternal ? 'Internal note (hidden from the client)…' : 'Message the support executive… (Enter to send)'}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-none ${isInternal
              ? 'border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-400/40 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
              : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-slate-900/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500'}`} />
          <button onClick={sendComment} disabled={!input.trim()}
            className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 flex items-center justify-center disabled:opacity-40 transition-colors">
            <FiSend size={15} className="text-white dark:text-slate-900" />
          </button>
        </div>
        <label className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer select-none w-fit">
          <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="accent-amber-500" />
          <FiLock size={10} /> Internal note — visible to staff only, never to the client
        </label>
      </div>
    </div>
  );
}

/* ── GitHub workspace for software team members ──────────────────────────── */
/* ── Branch explorer: browse files (read/write per permission), view commit
   history and per-commit diffs in a popup — GitHub-style, in-portal. ──────── */
function DiffView({ patch }) {
  if (!patch) return <p className="text-[11px] text-slate-400">No textual diff (binary or empty).</p>;
  return (
    <pre className="text-[11px] font-mono overflow-x-auto rounded-lg bg-slate-950 p-3 leading-relaxed">
      {patch.split('\n').map((ln, i) => {
        const c = ln.startsWith('+') && !ln.startsWith('+++') ? 'text-emerald-400'
          : ln.startsWith('-') && !ln.startsWith('---') ? 'text-red-400'
          : ln.startsWith('@@') ? 'text-indigo-400' : 'text-slate-300';
        return <div key={i} className={c}>{ln || ' '}</div>;
      })}
    </pre>
  );
}

function BranchExplorer({ repo, branch, canWrite, cloneUrl, htmlUrl, onClose }) {
  const [o, n] = repo.split('/');
  const [tab, setTab] = useState('files');
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(null); // {path, content, sha, canWrite}
  const [bigEdit, setBigEdit] = useState(false); // enlarged editor modal
  const [edited, setEdited] = useState('');
  const [commits, setCommits] = useState([]);
  const [commit, setCommit] = useState(null); // {sha,message,files:[...]}
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const q = `owner=${o}&repo=${n}&ref=${encodeURIComponent(branch)}`;

  useEffect(() => {
    fetchJson(`/api/github?tree=1&${q}`).then((d) => setFiles(d.files || [])).catch((e) => setMsg(e.message));
    fetchJson(`/api/github?commits=1&${q}`).then((d) => setCommits(d.commits || [])).catch(() => {});
  }, [branch]);

  const openFile = async (path) => {
    setMsg(''); setActive({ path, content: '…', loading: true });
    try {
      const d = await fetchJson(`/api/github?file=${encodeURIComponent(path)}&${q}`);
      setActive(d); setEdited(d.content);
    } catch (e) { setMsg(e.message); setActive(null); }
  };
  const save = async () => {
    if (!active) return;
    setBusy(true); setMsg('');
    try {
      await fetchJson(`/api/github?owner=${o}&repo=${n}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'put_file', path: active.path, content: edited, sha: active.sha, branch, message: `Update ${active.path} via portal` }) });
      setMsg('Committed ✓');
      fetchJson(`/api/github?commits=1&${q}`).then((d) => setCommits(d.commits || [])).catch(() => {});
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };
  const openCommit = async (c) => {
    setMsg('');
    try { setCommit(await fetchJson(`/api/github?commit=${c.fullSha}&owner=${o}&repo=${n}`)); }
    catch (e) { setMsg(e.message); }
  };

  const shown = files.filter((f) => !filter || f.path.toLowerCase().includes(filter.toLowerCase())).slice(0, 500);
  const tb2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
  return (
    <Modal title={`${repo} · ${branch}`} onClose={onClose} wide>
      <div className="flex gap-2 mb-3">
        <button className={`${tb2} ${tab === 'files' ? '!bg-slate-900 !text-white dark:!bg-white dark:!text-slate-900' : ''}`} onClick={() => { setTab('files'); setCommit(null); }}>Files ({files.length})</button>
        <button className={`${tb2} ${tab === 'commits' ? '!bg-slate-900 !text-white dark:!bg-white dark:!text-slate-900' : ''}`} onClick={() => { setTab('commits'); setActive(null); }}>Commits</button>
        <span className="ml-auto flex items-center gap-2 self-center">
          <span className="text-[11px] text-slate-400">{canWrite ? 'read & write' : 'read only'}</span>
          <CopyBtn text={cloneUrl} label="Clone URL" />
          <OpenInMenu cloneUrl={cloneUrl} htmlUrl={htmlUrl} repo={repo} />
        </span>
      </div>
      {msg && <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">{msg}</p>}

      {tab === 'files' ? (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 h-[60vh]">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files…"
              className="px-2.5 py-2 text-xs border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none" />
            <div className="overflow-y-auto flex-1">
              {shown.map((f) => (
                <button key={f.path} onClick={() => openFile(f.path)}
                  className={`block w-full text-left px-2.5 py-1.5 text-[11px] font-mono truncate hover:bg-slate-100 dark:hover:bg-slate-800 ${active?.path === f.path ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                  {f.path}
                </button>
              ))}
              {!shown.length && <p className="text-[11px] text-slate-400 p-3">No files.</p>}
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            {!active ? <p className="text-xs text-slate-400 m-auto">Select a file to view{canWrite ? ' or edit' : ''}.</p> : (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-mono text-slate-500 truncate">{active.path}{canWrite && active.canWrite ? '' : ' · read-only'}</p>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {canWrite && active.canWrite && <button className={tb2} disabled={busy || edited === active.content} onClick={save}>{busy ? 'Committing…' : 'Commit changes'}</button>}
                    <button className={tb2} title={canWrite && active.canWrite ? 'Open larger to edit' : 'Open larger'} onClick={() => setBigEdit(true)}><FiMaximize2 size={13} /></button>
                  </span>
                </div>
                <textarea value={edited} onChange={(e) => setEdited(e.target.value)} readOnly={!canWrite || !active.canWrite} spellCheck={false}
                  className="flex-1 w-full font-mono text-[11px] leading-relaxed rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-950 text-slate-100 p-3 focus:outline-none resize-none" />
              </>
            )}
          </div>
        </div>
      ) : commit ? (
        <div className="h-[60vh] overflow-y-auto">
          <button className={`${tb2} mb-2`} onClick={() => setCommit(null)}>‹ Back to commits</button>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{commit.message}</p>
          <p className="text-[11px] text-slate-400 mb-3">{commit.author} · {commit.sha}</p>
          {commit.files.map((f) => (
            <div key={f.filename} className="mb-3">
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mb-1">{f.filename} <span className="text-emerald-500">+{f.additions}</span> <span className="text-red-500">−{f.deletions}</span> <span className="text-slate-400">({f.status})</span></p>
              <DiffView patch={f.patch} />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[60vh] overflow-y-auto space-y-1">
          {commits.map((c) => (
            <button key={c.fullSha} onClick={() => openCommit(c)}
              className="block w-full text-left rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 hover:border-indigo-300 dark:hover:border-indigo-700">
              <p className="text-xs text-slate-800 dark:text-slate-100 truncate">{c.message}</p>
              <p className="text-[10px] text-slate-400 font-mono">{c.sha} · {c.author} · {c.date ? new Date(c.date).toLocaleString() : ''}</p>
            </button>
          ))}
          {!commits.length && <p className="text-xs text-slate-400 p-3 text-center">No commits.</p>}
        </div>
      )}

      {/* Enlarged editor — edit + commit if write permission, else read-only. */}
      {bigEdit && active && (
        <div className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={(e) => { if (e.target === e.currentTarget) setBigEdit(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-700">
              <p className="text-sm font-mono text-slate-200 truncate">{active.path} <span className="text-slate-500">· {branch}{canWrite && active.canWrite ? '' : ' · read-only'}</span></p>
              <span className="flex items-center gap-2 shrink-0">
                {canWrite && active.canWrite && (
                  <button className={tb2} disabled={busy || edited === active.content} onClick={async () => { await save(); }}>{busy ? 'Committing…' : 'Commit changes'}</button>
                )}
                <button className={tb2} onClick={() => setBigEdit(false)}><FiX size={14} /></button>
              </span>
            </div>
            <textarea value={edited} onChange={(e) => setEdited(e.target.value)} readOnly={!canWrite || !active.canWrite} spellCheck={false}
              className="flex-1 w-full font-mono text-[13px] leading-relaxed bg-slate-950 text-slate-100 p-4 focus:outline-none resize-none rounded-b-2xl" />
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── Overview (home) — profile, permissions and summary cards that open each
   feature's CRUD workspace. ──────────────────────────────────────────────── */
const PERM_LABELS = {
  github_read: 'GitHub · read',
  github_write: 'GitHub · write',
  roster_manage: 'Manage roster & groups',
  collaborator_manage: 'Add GitHub collaborators',
};
const ALL_PERM_KEYS = ['github_read', 'github_write', 'roster_manage', 'collaborator_manage'];

function OverviewTab({ member, myPerms, myRepos, myRole, myStatus, counts, setView }) {
  const [sum, setSum] = useState({ meetings: null, notes: null, repos: null });
  const hasGithub = myPerms.includes('github_read') || myPerms.includes('github_write') || (myRepos?.length > 0);
  useEffect(() => {
    fetchJson('/api/meetings').then((d) => setSum((s) => ({ ...s, meetings: (d.meetings || []).length }))).catch(() => {});
    fetchJson('/api/notes').then((d) => setSum((s) => ({ ...s, notes: (d.notes || []).length }))).catch(() => {});
    if (hasGithub) fetchJson('/api/github?repos=1').then((d) => setSum((s) => ({ ...s, repos: (d.repos || []).length }))).catch(() => {});
  }, []); // eslint-disable-line

  const cards = [
    { key: 'dev-tickets', icon: FiCode, title: 'Dev Tickets', desc: 'JIRA-style board — create, edit, comment & attach.', tint: 'bg-indigo-500' },
    { key: 'tickets', icon: FiTag, title: 'My Tickets', value: counts.all, desc: 'Support tickets assigned to you.', tint: 'bg-sky-500' },
    { key: 'engineering', icon: FiBookOpen, title: 'Engineering', desc: 'Pipeline, sprints, epics, QA & OKRs.', tint: 'bg-violet-500' },
    ...(hasGithub ? [{ key: 'github', icon: FiGithub, title: 'GitHub', value: sum.repos, desc: 'Repos, branches, PRs · clone & open in IDE.', tint: 'bg-slate-700' }] : []),
    { key: 'notes', icon: FiFileText, title: 'Notes', value: sum.notes, desc: 'Personal & meeting notes (MoM).', tint: 'bg-amber-500' },
    { key: 'meetings', icon: FiVideo, title: 'Meetings', value: sum.meetings, desc: 'Schedule & join video meetings.', tint: 'bg-emerald-500' },
    { key: 'colleagues', icon: FiUsers, title: 'Colleagues', desc: 'Chat, voice & video with team + support.', tint: 'bg-rose-500' },
  ];
  const card = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4';
  const statusColor = myStatus === 'online' ? 'bg-emerald-500' : myStatus === 'away' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back, {member.name?.split(' ')[0] || 'there'} 👋</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Your workspace at a glance — click any card to jump in.</p>
        </div>

        {/* Profile + permissions */}
        <div className={card}>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className="h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold">{(member.name || '?').slice(0, 1).toUpperCase()}</div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">{member.name}
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"><span className={`w-2 h-2 rounded-full ${statusColor}`} />{myStatus || 'online'}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><FiMail size={11} /> {member.email}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 capitalize"><FiUser size={11} /> {(myRole || 'member').replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="flex-1 min-w-[240px]">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2 flex items-center gap-1"><FiShield size={12} /> Permissions granted to you</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_PERM_KEYS.map((p) => {
                  const on = myPerms.includes(p);
                  return <span key={p} className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${on ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600'}`}>{on ? <FiCheck size={10} /> : <FiX size={10} />}{PERM_LABELS[p]}</span>;
                })}
              </div>
              {hasGithub && <p className="text-[11px] text-slate-400 mt-2">Repos granted: <span className="text-slate-600 dark:text-slate-300 font-medium">{myRepos?.length || 0}</span>{myRepos?.length ? ` · ${myRepos.slice(0, 3).join(', ')}${myRepos.length > 3 ? '…' : ''}` : ''}</p>}
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((c) => (
            <button key={c.key} onClick={() => setView(c.key)}
              className={`${card} text-left hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all group`}>
              <div className="flex items-center justify-between">
                <span className={`h-9 w-9 rounded-xl ${c.tint} text-white flex items-center justify-center`}><c.icon size={17} /></span>
                {c.value !== undefined && c.value !== null && <span className="text-2xl font-bold text-slate-900 dark:text-white">{c.value}</span>}
              </div>
              <p className="font-semibold text-slate-900 dark:text-white mt-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{c.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GitHubWorkspace({ canWrite, canCollab }) {
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState('');
  const [data, setData] = useState({ branches: [], prs: [] });
  const [forms, setForms] = useState({ branch: '', prTitle: '', prHead: '' });
  const [explore, setExplore] = useState(null); // branch name being explored
  const [collabOpen, setCollabOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const repoObj = repos.find((r) => r.full_name === repo) || null;
  const cloneUrl = repoObj?.clone_url || (repo ? `https://github.com/${repo}.git` : '');
  const box = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4';
  const tin = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400';
  const tb = 'text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:opacity-90';
  const tb2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';

  useEffect(() => {
    const load = () => fetchJson('/api/github?repos=1')
      .then((d) => {
        const list = d.repos || [];
        setRepos(list); setMsg('');
        // a repo whose grant was revoked must vanish even if it was open
        setRepo((cur) => cur && !list.some((r) => r.full_name === cur) ? '' : cur);
      })
      .catch((e) => { setRepos([]); setRepo(''); setMsg(e.message); });
    load();
    window.addEventListener('pa-perms-updated', load); // grants/revokes apply live
    const id = setInterval(load, 8000);                // self-heals if WS push is missed
    return () => { window.removeEventListener('pa-perms-updated', load); clearInterval(id); };
  }, []);

  const open = async (full) => {
    setRepo(full); setMsg('');
    const [o, n] = full.split('/');
    const [b, p] = await Promise.all([
      fetchJson(`/api/github?branches=1&owner=${o}&repo=${n}`).catch(() => ({ branches: [] })),
      fetchJson(`/api/github?prs=1&owner=${o}&repo=${n}`).catch(() => ({ prs: [] }))
    ]);
    setData({ branches: b.branches, prs: p.prs });
  };

  const act = async (body) => {
    if (!repo) return;
    const [o, n] = repo.split('/');
    setMsg('Working…');
    try {
      const d = await fetchJson(`/api/github?owner=${o}&repo=${n}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setMsg(d.url ? `Done ✓ ${d.url}` : 'Done ✓');
      open(repo);
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
      <div className={box}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><FiGithub size={15} /> GitHub</p>
          <select value={repo} onChange={(e) => open(e.target.value)} className={`${tin} flex-1 min-w-[180px]`}>
            <option value="">Select repository…</option>
            {repos.map((r) => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
          </select>
          {repo && canCollab && (
            <button className={tb2} onClick={() => setCollabOpen(true)} title="Manage repository collaborators"><FiUsers size={12} className="inline mr-1" />Collaborators</button>
          )}
          {msg && <p className="text-[11px] text-amber-600 dark:text-amber-400 w-full truncate">{msg}</p>}
        </div>
        {!repos.length && !msg && (
          <p className="text-xs text-slate-400 mt-2">No repositories granted to you yet — an admin can grant specific repos from the admin panel (Team → repos).</p>
        )}
        {repo && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-[11px] text-slate-400 font-medium">Clone</span>
            <code className="flex-1 min-w-[200px] text-[11px] font-mono bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 truncate">{cloneUrl}</code>
            <CopyBtn text={cloneUrl} label="Copy URL" />
            <OpenInMenu cloneUrl={cloneUrl} htmlUrl={repoObj?.url} repo={repo} />
          </div>
        )}
      </div>
      {repo && (
        <>
          <div className={box}>
            <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">Pull requests ({data.prs.length})</p>
            {canWrite && (
              <div className="flex flex-wrap gap-2 mb-3">
                <input value={forms.prTitle} onChange={(e) => setForms((f) => ({ ...f, prTitle: e.target.value }))} placeholder="PR title (PA-12 …)" className={`${tin} flex-1 min-w-[160px]`} />
                <input value={forms.prHead} onChange={(e) => setForms((f) => ({ ...f, prHead: e.target.value }))} placeholder="from branch" className={`${tin} w-36`} />
                <button className={tb} onClick={() => forms.prTitle && forms.prHead && act({ action: 'create_pr', title: forms.prTitle, head: forms.prHead })}>Create PR</button>
              </div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.prs.map((p) => (
                <div key={p.number} className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-slate-800 dark:text-slate-100 hover:text-indigo-600">
                    #{p.number} {p.title} <span className="text-xs text-slate-400">{p.author} · {p.branch}→{p.base}</span>
                  </a>
                  {canWrite && (
                    <span className="flex gap-1.5 shrink-0">
                      <button className={tb} onClick={() => act({ action: 'merge_pr', number: p.number })}>Merge</button>
                      <button className={tb2} onClick={() => act({ action: 'close_pr', number: p.number })}>Close</button>
                    </span>
                  )}
                </div>
              ))}
              {!data.prs.length && <p className="text-xs text-slate-400 py-3 text-center">No open pull requests.</p>}
            </div>
          </div>
          <div className={box}>
            <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">Branches ({data.branches.length})</p>
            {canWrite && (
              <div className="flex gap-2 mb-3">
                <input value={forms.branch} onChange={(e) => setForms((f) => ({ ...f, branch: e.target.value }))} placeholder="PA-12-fix-login" className={`${tin} flex-1`} />
                <button className={tb} onClick={() => forms.branch && act({ action: 'create_branch', branch: forms.branch })}>Create</button>
              </div>
            )}
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {data.branches.map((b) => (
                <div key={b.name} className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                  <button onClick={() => setExplore(b.name)} title="Browse files & commits" className="truncate text-left hover:text-indigo-600 dark:hover:text-indigo-400">
                    <span className="underline underline-offset-2">{b.name}</span> <span className="text-xs text-slate-400 font-mono">{b.sha}</span>{b.protected && <span className="text-[10px] text-amber-600 ml-1">protected</span>}
                  </button>
                  <span className="flex gap-1.5 shrink-0">
                    <button className={tb2} onClick={() => setExplore(b.name)}>Open</button>
                    {canWrite && !b.protected && (
                      <button className={tb2} onClick={() => window.confirm(`Delete branch ${b.name}?`) && act({ action: 'delete_branch', branch: b.name })}>Delete</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {explore && <BranchExplorer repo={repo} branch={explore} canWrite={canWrite} cloneUrl={cloneUrl} htmlUrl={repoObj?.url} onClose={() => setExplore(null)} />}
      {collabOpen && <CollaboratorsModal repo={repo} onClose={() => setCollabOpen(false)} />}
    </div>
  );
}

/* ── Copy-to-clipboard button with momentary confirmation ─────────────────── */
function CopyBtn({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const tb2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
  return (
    <button className={tb2} onClick={() => { try { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* blocked */ } }}>
      {done ? <><FiCheck size={11} className="inline mr-1 text-emerald-500" />Copied</> : <><FiCopy size={11} className="inline mr-1" />{label}</>}
    </button>
  );
}

/* ── "Open in" — deep-links that auto-clone the repo into the user's local IDE
   (VS Code, JetBrains, GitHub Desktop) or copy a ready git-clone command. ─── */
function OpenInMenu({ cloneUrl, htmlUrl, repo }) {
  const [open, setOpen] = useState(false);
  const tb2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
  const go = (url) => { try { window.location.href = url; } catch { /* no handler */ } };
  const items = [
    { label: 'VS Code', sub: 'clone & open', onClick: () => go(`vscode://vscode.git/clone?url=${encodeURIComponent(cloneUrl)}`) },
    { label: 'Cursor', sub: 'clone & open', onClick: () => go(`cursor://vscode.git/clone?url=${encodeURIComponent(cloneUrl)}`) },
    { label: 'JetBrains (IDEA/WebStorm)', sub: 'check out', onClick: () => go(`jetbrains://idea/checkout/git?idea.required.plugins.id=Git4Idea&checkout.repo=${encodeURIComponent(cloneUrl)}`) },
    { label: 'GitHub Desktop', sub: 'open repo', onClick: () => go(`x-github-client://openRepo/${htmlUrl || ''}`) },
  ];
  return (
    <div className="relative">
      <button className={tb2} onClick={() => setOpen((o) => !o)} title="Open this repo in your local editor"><FiExternalLink size={11} className="inline mr-1" />Open in…</button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-[91] w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5">
            {items.map((it) => (
              <button key={it.label} onClick={() => { it.onClick(); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-700 dark:text-slate-200">{it.label}</span>
                <span className="text-[10px] text-slate-400">{it.sub}</span>
              </button>
            ))}
            <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1.5 px-1.5 pb-0.5">
              <p className="text-[10px] text-slate-400 mb-1">Or run in a terminal:</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 truncate text-slate-600 dark:text-slate-300">git clone {cloneUrl}</code>
                <CopyBtn text={`git clone ${cloneUrl}`} label="Copy" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Tip: editors prompt to allow the clone on first use.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Collaborators CRUD (visible only to collaborator_manage holders) ─────── */
function CollaboratorsModal({ repo, onClose }) {
  const [o, n] = repo.split('/');
  const [list, setList] = useState(null);
  const [username, setUsername] = useState('');
  const [perm, setPerm] = useState('push');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const tb = 'text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:opacity-90 disabled:opacity-50';
  const tb2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
  const tin = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400';
  const load = () => fetchJson(`/api/github?collaborators=1&owner=${o}&repo=${n}`).then((d) => setList(d.collaborators || [])).catch((e) => { setList([]); setMsg(e.message); });
  useEffect(() => { load(); }, [repo]); // eslint-disable-line
  const add = async () => {
    if (!username.trim()) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetchJson(`/api/github?owner=${o}&repo=${n}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_collaborator', username: username.trim(), permission: perm }) });
      setMsg(r.invited ? `Invitation sent to ${username.trim()} ✓` : `${username.trim()} added ✓`); setUsername(''); load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const remove = async (login) => {
    if (!window.confirm(`Remove ${login} from ${repo}?`)) return;
    setMsg('');
    try { await fetchJson(`/api/github?owner=${o}&repo=${n}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove_collaborator', username: login }) }); load(); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <Modal title={`Collaborators · ${repo}`} onClose={onClose}>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="GitHub username" className={`${tin} flex-1 min-w-[150px]`} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <select value={perm} onChange={(e) => setPerm(e.target.value)} className={tin}>
          <option value="pull">Read</option>
          <option value="triage">Triage</option>
          <option value="push">Write</option>
          <option value="maintain">Maintain</option>
          <option value="admin">Admin</option>
        </select>
        <button className={tb} disabled={busy || !username.trim()} onClick={add}><FiPlus size={12} className="inline mr-1" />Add</button>
      </div>
      {msg && <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">{msg}</p>}
      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
        {list === null && <p className="text-xs text-slate-400 text-center py-4">Loading…</p>}
        {list?.map((c) => (
          <div key={c.login} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2">
            <span className="flex items-center gap-2 min-w-0">
              {c.avatar && <img src={c.avatar} alt="" className="h-6 w-6 rounded-full" />}
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-800 dark:text-slate-100 hover:text-indigo-600 truncate">{c.login}</a>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 capitalize">{c.role}</span>
            </span>
            <button className={tb2} onClick={() => remove(c.login)} title="Remove collaborator"><FiTrash2 size={12} /></button>
          </div>
        ))}
        {list?.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No collaborators yet.</p>}
      </div>
    </Modal>
  );
}

/* ── First-login tour (shown once per user, tracked in localStorage) ─────── */
const TOUR_STEPS = [
  { icon: '🎫', title: 'Your ticket bucket', body: 'Everything assigned to you lives in "tickets" — statuses, SLA countdowns, file attachments and a chat thread with the support executive on every ticket.' },
  { icon: '⚙️', title: 'Engineering workspace', body: 'The "engineering" view shows the live pipeline board (PM → Lead → Dev → QA), sprints, epics, incidents, QA test cases, OKRs and announcements. Click any card to open it in a popup — actions for your role appear automatically.' },
  { icon: '🔀', title: 'Workflow actions', body: 'When a ticket reaches your stage, action buttons appear on it: approve, assign a developer, complete to QA, or QA approve/send-back. Rejections always ask for a comment.' },
  { icon: '🐙', title: 'GitHub', body: 'If your admin granted GitHub access, a "github" view appears: browse repos, create branches named PA-<ticket> and open/merge pull requests. PA-named work auto-updates the ticket.' },
  { icon: '🔔', title: 'Stay in the loop', body: 'The bell shows assignments, @mentions, SLA warnings and escalations. You also get emails for new assignments. Toggle dark mode and change your password from the header. That\u2019s it — welcome aboard!' }
];
function TourGuide({ member, onDone }) {
  const [step, setStep] = useState(0);
  const s2 = TOUR_STEPS[step];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
        <p className="text-3xl mb-3">{s2.icon}</p>
        <p className="text-xs uppercase tracking-widest text-indigo-500 font-semibold mb-1">Step {step + 1} of {TOUR_STEPS.length}</p>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{s2.title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{s2.body}</p>
        <div className="flex items-center justify-center gap-1.5 my-4">
          {TOUR_STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onDone} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 text-sm font-medium py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800">Skip tour</button>
          {step < TOUR_STEPS.length - 1 ? (
            <button onClick={() => setStep((v) => v + 1)} className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5">Next →</button>
          ) : (
            <button onClick={onDone} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5">Get started 🚀</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main portal ─────────────────────────────────────────────────────────── */
/* ── Deploy control: trigger a Render deploy now or schedule one for later.
   Hidden for QA and Software Developers (server enforces the same rule). ─── */
const DEPLOY_DONE = ['live', 'failed', 'build_failed', 'update_failed', 'canceled', 'cancelled', 'deactivated'];
function DeployControl() {
  const [open, setOpen]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState('');
  const [when, setWhen]     = useState('');
  const [pwd, setPwd]       = useState('');
  const [data, setData]     = useState({ scheduled: [], recent: [], canDeploy: null });
  const [activeId, setActive] = useState(null);          // deploy currently in progress
  const [logs, setLogs]     = useState({ status: null, lines: [], note: '' });
  const [logsBig, setLogsBig] = useState(false);
  const logRef = useRef(null);

  const shownRef = useRef(null); // last deploy id we already auto-surfaced
  const load = async () => {
    try {
      const d = await fetchJson('/api/deploy');
      setData(d);
      // Only a recently-triggered deploy (last 15 min) counts as "in progress".
      const running = (d.recent || []).find((r) => r.status === 'triggered' && (Date.now() - new Date(r.created_at).getTime()) < 15 * 60 * 1000);
      // A brand-new deploy (any source — manual, scheduled, git push) auto-opens
      // the modal live and clears the previous deploy's logs.
      if (running && running.id !== shownRef.current) {
        shownRef.current = running.id;
        setActive(running.id);
        setLogs({ status: null, lines: [], note: '' });
        if (d.canDeploy) setOpen(true);
      }
    } catch { /* ignore */ }
  };
  // Keep watching even while closed so an in-progress deploy surfaces on its own.
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  // Poll live logs/status for the active deploy.
  useEffect(() => {
    if (!open || !activeId) return;
    let alive = true;
    const tick = async () => {
      try {
        const d = await fetchJson(`/api/deploy/logs?id=${activeId}`);
        if (!alive) return;
        setLogs(d);
        if (d.status && DEPLOY_DONE.includes(d.status)) { setActive(null); load(); }
      } catch { /* ignore */ }
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(t); };
    /* eslint-disable-next-line */
  }, [open, activeId]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  // Hidden entirely unless an admin has granted this user deploy access.
  if (!data.canDeploy) return null;

  const pwBody = (extra) => ({ ...(data.passwordSet ? { password: pwd } : {}), ...extra });
  const needPw = () => { if (data.passwordSet && !pwd) { setMsg('Enter the deploy password.'); return true; } return false; };

  const deployNow = async () => {
    if (needPw()) return;
    setBusy(true); setMsg(''); setLogs({ status: null, lines: [], note: '' });
    try { const r = await fetchJson('/api/deploy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pwBody()) }); setMsg(r.message || 'Deploy triggered.'); shownRef.current = r.id; setActive(r.id); setPwd(''); load(); }
    catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };
  const cancelActive = async () => {
    if (!activeId) return;
    const id = activeId;
    setActive(null); setMsg('Cancelling…');        // revert the button immediately
    setBusy(true);
    try { const r = await fetchJson('/api/deploy/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pwBody({ id })) }); setMsg(r.message || 'Cancelled.'); load(); }
    catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };
  const schedule = async () => {
    if (!when) { setMsg('Pick a date & time first.'); return; }
    if (needPw()) return;
    setBusy(true); setMsg('');
    try {
      await fetchJson('/api/deploy/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pwBody({ runAt: new Date(when).toISOString() })) });
      setMsg('Deploy scheduled.'); setWhen(''); load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };
  const cancelScheduled = async (id) => {
    try { await fetchJson('/api/deploy/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load(); } catch { /* ignore */ }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} title="Deploy"
        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
        <FiUploadCloud size={15} /> Deploy
      </button>
      {/* Enlarged live-logs modal */}
      {logsBig && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={(e) => { if (e.target === e.currentTarget) setLogsBig(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-700">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <FiFileText size={15} /> Live deployment logs
                {logs.status && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${DEPLOY_DONE.includes(logs.status) && logs.status !== 'live' ? 'bg-red-900/40 text-red-300' : logs.status === 'live' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}>{logs.status}</span>}
              </p>
              <button onClick={() => setLogsBig(false)} className="text-slate-400 hover:text-white"><FiX size={18} /></button>
            </div>
            <pre className="flex-1 overflow-auto bg-slate-950 text-slate-100 text-xs leading-relaxed p-4 font-mono whitespace-pre-wrap rounded-b-2xl">
{logs.lines?.length ? logs.lines.join('\n') : (logs.note || (activeId ? 'Waiting for Render…' : 'No active deploy. Trigger one to stream logs.'))}
            </pre>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5 text-left">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"><FiUploadCloud size={17} /> Deploy</p>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiX size={17} /></button>
            </div>

            {/* Deploy password (when an admin has set one) */}
            {data.passwordSet && !activeId && (
              <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Deploy password"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 mb-2" />
            )}

            {/* Primary action: Deploy now → swaps to Cancel while a deploy is running */}
            {activeId ? (
              <button onClick={cancelActive} disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg mb-4">
                <FiX size={15} /> Cancel deploy
              </button>
            ) : (
              <button onClick={deployNow} disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg mb-4">
                <FiUploadCloud size={15} /> Deploy now
              </button>
            )}

            {/* Live log / status preview */}
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <FiFileText size={11} /> Live logs
                {logs.status && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${DEPLOY_DONE.includes(logs.status) && logs.status !== 'live' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' : logs.status === 'live' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'}`}>{logs.status}</span>}
                <button onClick={() => setLogsBig(true)} title="Enlarge logs" className="ml-auto text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiMaximize2 size={13} /></button>
              </p>
              <pre ref={logRef} className="h-40 overflow-auto rounded-lg bg-slate-950 text-slate-100 text-[11px] leading-relaxed p-3 font-mono whitespace-pre-wrap">
{logs.lines?.length ? logs.lines.join('\n') : (logs.note || (activeId ? 'Waiting for Render…' : 'No active deploy. Trigger one to stream logs.'))}
              </pre>
            </div>

            {/* Schedule for later */}
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5 flex items-center gap-1"><FiClock size={10} /> Schedule for later</p>
            <div className="flex gap-2 mb-3">
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-200" />
              <button onClick={schedule} disabled={busy}
                className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-medium px-4 rounded-lg disabled:opacity-50">Schedule</button>
            </div>
            {msg && <p className="text-[11px] mb-2 text-slate-500 dark:text-slate-400">{msg}</p>}

            {data.scheduled?.length > 0 && (
              <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Scheduled</p>
                {data.scheduled.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 py-1">
                    <span className="truncate">{new Date(s.run_at).toLocaleString()}</span>
                    <button onClick={() => cancelScheduled(s.id)} className="text-red-500 hover:text-red-600 shrink-0">Cancel</button>
                  </div>
                ))}
              </div>
            )}
            {data.recent?.length > 0 && (
              <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Recent</p>
                {data.recent.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 py-0.5">
                    <span className="truncate">{new Date(r.created_at).toLocaleString()} · {r.triggered_by}{r.commit_sha ? ` · ${r.commit_sha}` : ''}{r.pr ? ` ${r.pr}` : ''}</span>
                    <span className={`shrink-0 ${['failed', 'build_failed', 'cancelled', 'canceled'].includes(r.status) ? 'text-red-500' : 'text-emerald-500'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function TeamPortalPage() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const inviteToken = urlParams.get('invite');

  const [member, setMember] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activated, setActivated] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [dark, setDark] = useState(() => {
    try { return window.localStorage.getItem('pa_team_theme') === 'dark'; } catch { return false; }
  });
  const [pwdModal, setPwdModal] = useState(false);
  const [myRole, setMyRole] = useState('member');
  const [myPerms, setMyPerms] = useState([]);
  const [myRepos, setMyRepos] = useState([]);

  // Instant permission propagation: admin grants/revokes → server pushes
  // perms_updated over the WS → refetch role + perms + repo grants live.
  useEffect(() => {
    if (!member) return;
    const refresh = () => {
      fetchJson('/api/team-members/me').then((d) => {
        setMyPerms(d.member?.permissions || []);
        setMyRepos(d.member?.allowedRepos || []);
      }).catch(() => {});
      fetchJson('/api/dev-workflow?bucket=1').then((d) => setMyRole(d.myRole || 'member')).catch(() => {});
    };
    window.addEventListener('pa-perms-updated', refresh);
    return () => window.removeEventListener('pa-perms-updated', refresh);
  }, [member]);
  const [view, setView] = useState('overview');
  const [colUnread, setColUnread] = useState(0);
  const [myStatus, setMyStatus] = useState('online'); // manual presence override
  const setStatus = (s) => { setMyStatus(s); window.dispatchEvent(new CustomEvent('pa-set-status', { detail: s })); };
  const [showTour, setShowTour] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem('pa_team_theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  // Instant teardown when an admin revokes this account mid-session.
  useEffect(() => {
    const onRevoked = () => setMember(null);
    window.addEventListener('pa-session-revoked', onRevoked);
    return () => window.removeEventListener('pa-session-revoked', onRevoked);
  }, []);

  useEffect(() => {
    if (inviteToken && !activated) { setAuthLoading(false); return; }
    fetchJson('/api/team-members/me')
      .then((d) => setMember(d.member))
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, [inviteToken, activated]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const d = await fetchJson(`/api/tickets?${params.toString()}`);
      setTickets(d.tickets || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!member) return;
    fetchJson('/api/dev-workflow?bucket=1').then((d) => setMyRole(d.myRole || 'member')).catch(() => {});
    fetchJson('/api/team-members/me').then((d) => { setMyPerms(d.member?.permissions || []); setMyRepos(d.member?.allowedRepos || []); }).catch(() => {});
    try { if (!window.localStorage.getItem(`pa_tour_done_${member.email}`)) setShowTour(true); } catch { /* ignore */ }
    loadTickets();
    // perms/repo grants also refresh on this poll — belt-and-suspenders next
    // to the instant WS push, so tab visibility can never go stale
    const id = setInterval(() => {
      loadTickets();
      fetchJson('/api/team-members/me').then((d) => { setMyPerms(d.member?.permissions || []); setMyRepos(d.member?.allowedRepos || []); }).catch(() => {});
    }, 8000);
    return () => clearInterval(id);

  }, [member, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { all: tickets.length };
    for (const s of STATUSES) c[s] = tickets.filter((t) => t.status === s).length;
    return c;
  }, [tickets]);

  const logout = async () => {
    await fetchJson('/api/team-members/logout', { method: 'DELETE' }).catch(() => {});
    setMember(null);
    setLogoutConfirm(false);
  };

  const selected = tickets.find((t) => t.id === selectedId) || null;

  const shell = (children) => <div className={dark ? 'dark' : ''}>{children}</div>;

  if (authLoading) {
    return shell(<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Loading…</div>);
  }
  if (inviteToken && !activated && !member) {
    return shell(<ActivateForm token={inviteToken} onActivated={() => setActivated(true)} />);
  }
  if (!member) {
    return shell(<LoginForm onLogin={(m) => { setMember(m); setActivated(false); }} />);
  }

  return shell(
    <div className="min-h-screen h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-medium">Patience AI · Team</p>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">{member.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {['overview', 'dev-tickets', 'tickets', 'engineering', ...((myPerms.includes('github_read') || myPerms.includes('github_write') || myRepos.length > 0) ? ['github'] : []), 'notes', 'meetings', 'colleagues'].map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors flex items-center gap-1 ${view === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
                  {v === 'overview' ? <><FiHome size={12} /> Overview</> : v === 'dev-tickets' ? 'Dev Tickets' : v}
                  {v === 'colleagues' && colUnread > 0 && view !== 'colleagues' && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">{colUnread > 9 ? '9+' : colUnread}</span>
                  )}
                </button>
              ))}
            </div>
          <NetworkDot className="mr-1" />
          {/* Manual presence: online / away / appear offline */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {['online', 'away', 'offline'].map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${myStatus === s
                  ? (s === 'online' ? 'bg-emerald-500 text-white' : s === 'away' ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white')
                  : 'text-slate-500 dark:text-slate-400'}`}>
                {s}
              </button>
            ))}
          </div>
          <DeployControl />
          <NotificationBell dark={dark} />
          <button onClick={() => setDark((d) => !d)} title="Toggle theme"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {dark ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          <button onClick={loadTickets}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setPwdModal(true)} title="Settings"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <FiSettings size={15} />
          </button>
          <button onClick={() => setLogoutConfirm(true)}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <FiLogOut size={15} /> Logout
          </button>
        </div>
      </header>

      {view === 'overview' && <OverviewTab member={member} myPerms={myPerms} myRepos={myRepos} myRole={myRole} myStatus={myStatus} counts={counts} setView={setView} />}
      {view === 'github' && <GitHubWorkspace canWrite={myPerms.includes('github_write')} canCollab={myPerms.includes('collaborator_manage')} />}
      {view === 'dev-tickets' && <DevTickets member={member} />}
      {view === 'notes' && <NotesTab />}
      {view === 'meetings' && <MeetingsTab />}
      {view === 'engineering' && <TeamEngineering myRole={myRole} />}
      {/* Colleagues stays mounted so presence, pushes and incoming calls work on every tab */}
      <Colleagues member={member} visible={view === 'colleagues'} onUnread={setColUnread} canManageRoster={myPerms.includes('roster_manage')} />
      {view === 'tickets' && (
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Ticket list */}
        <aside className="w-full md:w-80 max-h-[45vh] md:max-h-none border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="relative">
              <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search my tickets…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500" />
            </div>
            <div className="flex flex-wrap gap-1">
              {['all', ...STATUSES].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`text-[10px] px-2 py-1 rounded-full border font-medium capitalize ${statusFilter === s
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                  {s === 'all' ? `all (${counts.all ?? 0})` : `${statusLabel(s)} (${counts[s] ?? 0})`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!loading && tickets.length === 0 && (
              <div className="text-center p-6">
                <FiTag size={22} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-slate-400 dark:text-slate-500 text-xs">No tickets assigned to you yet.</p>
              </div>
            )}
            {tickets.map((t) => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-3 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors ${selectedId === t.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'hover:bg-slate-50 text-slate-800 dark:hover:bg-slate-800 dark:text-slate-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-mono opacity-60">{t.key}</span>
                  <span className="flex items-center gap-1">
                    <SlaBadge ticket={t} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold capitalize ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                  </span>
                </div>
                <p className="text-xs font-semibold truncate">{t.subject}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[10px] opacity-60">{t.stage && t.stage !== 'support' ? `⚙ ${(t.stage || '').replace('_', ' ')} · ` : ''}{fmt(t.updated_at)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize shrink-0 ${STATUS_BADGE[t.status]}`}>{statusLabel(t.status)}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Detail */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          {selected ? (
            <MemberTicketDetail ticket={selected} myRole={myRole} onChanged={loadTickets} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm gap-2">
              <FiMessageSquare size={26} className="text-slate-300 dark:text-slate-600" />
              Select a ticket to see details and chat with the support executive
            </div>
          )}
        </main>
      </div>
      )}

      {showTour && (
        <TourGuide member={member} onDone={() => {
          setShowTour(false);
          try { window.localStorage.setItem(`pa_tour_done_${member.email}`, '1'); } catch { /* ignore */ }
        }} />
      )}

      <SettingsModal open={pwdModal} onClose={() => setPwdModal(false)} />

      {/* Logout confirmation dialog */}
      <AnimatePresence>
        {logoutConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setLogoutConfirm(false); }}>
            <motion.div initial={{ scale: 0.93, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 18 }}
              className={`rounded-2xl shadow-2xl w-full max-w-xs p-6 ${cardCls}`}>
              <p className="font-bold text-slate-900 dark:text-white text-sm mb-1">Log out?</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">You'll need your password to sign back in.</p>
              <div className="flex gap-2">
                <button onClick={logout}
                  className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 transition-colors">
                  Logout
                </button>
                <button onClick={() => setLogoutConfirm(false)}
                  className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-sm font-semibold py-2.5 transition-colors">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
