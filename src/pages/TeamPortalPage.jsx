import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiEye, FiEyeOff, FiLogOut, FiMoon, FiSun, FiSend, FiRefreshCw, FiSearch,
  FiLock, FiX, FiTag, FiUser, FiMail, FiClock, FiMessageSquare
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import { NotificationBell, SlaBadge, AttachmentList, uploadFiles } from '../components/TicketCenter';
import TeamEngineering from '../components/TeamEngineering';
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
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 font-medium">Patience AI · Ticket portal</p>
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

/* ── Change password modal ───────────────────────────────────────────────── */
function ChangePasswordModal({ open, onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setForm({ currentPassword: '', newPassword: '', confirm: '' }); setErr(''); setDone(false); }
  }, [open]);

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
              <p className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2"><FiLock size={14} /> Change password</p>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiX size={16} /></button>
            </div>
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
function MemberTicketDetail({ ticket, myRole, onChanged }) {
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
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-y-auto max-h-[45%]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500">{ticket.key}</p>
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">{ticket.subject}</h3>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold capitalize ${PRIORITY_BADGE[ticket.priority]}`}>
              {ticket.priority}
            </span>
            <SlaBadge ticket={ticket} />
          </div>
        </div>
        {ticket.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 whitespace-pre-wrap">{ticket.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><FiUser size={11} /> Raised by {ticket.created_by_name || 'Support team'}</span>
          {ticket.customer_email && <span className="flex items-center gap-1"><FiMail size={11} /> Client: {ticket.customer_email}</span>}
          <span className="flex items-center gap-1"><FiClock size={11} /> {fmt(ticket.created_at)}</span>
          {Number(ticket.escalation_level) > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"><FiAlertTriangle size={11} /> Escalation level {ticket.escalation_level}</span>
          )}
        </div>
        <WorkflowActions ticket={ticket} myRole={myRole} onChanged={onChanged} />
        {attachments.length > 0 && <div className="mt-3"><AttachmentList attachments={attachments} /></div>}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => update({ status: s })}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium capitalize transition-colors ${ticket.status === s ? STATUS_BADGE[s] + ' ring-2 ring-slate-900/10 dark:ring-white/20' : 'border-slate-200 text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
              {statusLabel(s)}
            </button>
          ))}
          <select value={ticket.priority} onChange={(e) => update({ priority: e.target.value })}
            className="text-[11px] rounded-full border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 capitalize focus:outline-none">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p} priority</option>)}
          </select>
        </div>
        {err && <p className="text-red-500 text-xs mt-2">{err}</p>}
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
function GitHubWorkspace({ canWrite }) {
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState('');
  const [data, setData] = useState({ branches: [], prs: [] });
  const [forms, setForms] = useState({ branch: '', prTitle: '', prHead: '' });
  const [msg, setMsg] = useState('');
  const box = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4';
  const tin = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400';
  const tb = 'text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:opacity-90';
  const tb2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';

  useEffect(() => {
    fetchJson('/api/github?repos=1').then((d) => setRepos(d.repos || [])).catch((e) => setMsg(e.message));
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
          <p className="text-sm font-bold text-slate-900 dark:text-white">GitHub</p>
          <select value={repo} onChange={(e) => open(e.target.value)} className={`${tin} flex-1 min-w-[180px]`}>
            <option value="">Select repository…</option>
            {repos.map((r) => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
          </select>
          {msg && <p className="text-[11px] text-amber-600 dark:text-amber-400 w-full truncate">{msg}</p>}
        </div>
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
                  <span className="truncate">{b.name} <span className="text-xs text-slate-400 font-mono">{b.sha}</span>{b.protected && <span className="text-[10px] text-amber-600 ml-1">protected</span>}</span>
                  {canWrite && !b.protected && (
                    <button className={tb2} onClick={() => window.confirm(`Delete branch ${b.name}?`) && act({ action: 'delete_branch', branch: b.name })}>Delete</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
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
  const [view, setView] = useState('tickets');
  const [showTour, setShowTour] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem('pa_team_theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

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
    fetchJson('/api/team-members/me').then((d) => setMyPerms(d.member?.permissions || [])).catch(() => {});
    try { if (!window.localStorage.getItem(`pa_tour_done_${member.email}`)) setShowTour(true); } catch { /* ignore */ }
    loadTickets();
    const id = setInterval(loadTickets, 8000);
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
          <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-medium">Patience AI · Ticket portal</p>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">{member.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {['tickets', 'engineering', ...((myPerms.includes('github_read') || myPerms.includes('github_write')) ? ['github'] : [])].map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${view === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
                  {v}
                </button>
              ))}
            </div>
          <NotificationBell dark={dark} />
          <button onClick={() => setDark((d) => !d)} title="Toggle theme"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {dark ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          <button onClick={() => setPwdModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <FiLock size={13} /> Change password
          </button>
          <button onClick={loadTickets}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setLogoutConfirm(true)}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <FiLogOut size={15} /> Logout
          </button>
        </div>
      </header>

      {view === 'github' ? (
        <GitHubWorkspace canWrite={myPerms.includes('github_write')} />
      ) : view === 'engineering' ? (
        <TeamEngineering myRole={myRole} />
      ) : (
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
            <MemberTicketDetail ticket={selected} myRole={myRole} onChanged={loadTickets} />
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

      <ChangePasswordModal open={pwdModal} onClose={() => setPwdModal(false)} />

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
