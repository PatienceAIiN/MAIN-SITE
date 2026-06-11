import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiSend, FiPlus, FiRefreshCw, FiSearch, FiTag, FiMail, FiUser, FiClock,
  FiBell, FiPaperclip, FiDownload, FiLock, FiBookOpen, FiAlertTriangle, FiCheckSquare, FiSquare, FiFilter
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export const PRIORITY_BADGE = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-red-50 text-red-700 border-red-200'
};

export const STATUS_BADGE = {
  open: 'bg-sky-50 text-sky-700 border-sky-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200'
};

export const statusLabel = (s) => (s || '').replace('_', ' ');
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';

/* ── SLA helpers ─────────────────────────────────────────────────────────── */
export const slaState = (ticket) => {
  if (!ticket.due_at || ['resolved', 'closed'].includes(ticket.status)) return null;
  const ms = new Date(ticket.due_at).getTime() - Date.now();
  if (ms < 0) return { overdue: true, label: 'SLA breached' };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { overdue: false, warning: ms < 2 * 3600000, label: h > 0 ? `${h}h ${m}m left` : `${m}m left` };
};

export function SlaBadge({ ticket }) {
  const sla = slaState(ticket);
  if (!sla) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${
      sla.overdue ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
        : sla.warning ? 'bg-amber-50 text-amber-700 border-amber-300'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
      {sla.overdue ? <FiAlertTriangle size={9} /> : <FiClock size={9} />}{sla.label}
    </span>
  );
}

/* ── File helpers — raw upload to R2 via the server, any format, ≤ 10 MB ── */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const uploadFiles = async (ticketId, files, clientEmail = '') => {
  const errors = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) { errors.push(`${file.name}: too large (max 10 MB)`); continue; }
    try {
      const params = new URLSearchParams({ ticketId: String(ticketId), fileName: file.name });
      if (clientEmail) params.set('clientEmail', clientEmail);
      await fetchJson(`/api/attachments/upload?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      });
    } catch (e) { errors.push(`${file.name}: ${e.message}`); }
  }
  return errors;
};

export function AttachmentList({ attachments, dark = false }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {attachments.map((a) => (
        <a key={a.id} href={`/api/attachments?id=${a.id}`} target="_blank" rel="noopener noreferrer"
          title={`${a.uploaded_by_name || ''} · ${fmt(a.created_at)} · ${Math.round(a.size_bytes / 1024)} KB`}
          className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-colors ${dark
            ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <FiPaperclip size={10} /> <span className="max-w-[140px] truncate">{a.file_name}</span> <FiDownload size={10} />
        </a>
      ))}
    </div>
  );
}

/* ── Notification bell (exec console + team portal) ──────────────────────── */
export function NotificationBell({ dark = false }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);

  const load = () => fetchJson('/api/notifications')
    .then((d) => { setItems(d.notifications || []); setUnread(d.unread || 0); })
    .catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const markAll = async () => {
    await fetchJson('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true })
    }).catch(() => {});
    load();
  };

  const TYPE_ICON = { assignment: '🎫', status_change: '🔄', comment: '💬', mention: '@', escalation: '⚠️', sla_warning: '⏰', sla_breach: '🚨', reassignment: '↪️' };

  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => { setOpen((o) => !o); if (!open && unread) markAll(); }}
        className={`relative p-2 rounded-lg border transition-colors ${dark
          ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
          : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
        <FiBell size={15} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl shadow-xl z-40 border ${dark
          ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`px-3 py-2 text-[10px] uppercase tracking-wider font-semibold border-b ${dark ? 'text-slate-400 border-slate-800' : 'text-slate-400 border-slate-100'}`}>
            Notifications
          </p>
          {items.length === 0 && <p className={`px-3 py-4 text-xs text-center ${dark ? 'text-slate-500' : 'text-slate-400'}`}>You're all caught up 🎉</p>}
          {items.map((n) => (
            <div key={n.id} className={`px-3 py-2.5 border-b last:border-0 ${dark ? 'border-slate-800' : 'border-slate-100'} ${!n.read ? (dark ? 'bg-slate-800/60' : 'bg-sky-50/60') : ''}`}>
              <p className={`text-xs leading-snug ${dark ? 'text-slate-200' : 'text-slate-700'}`}>
                <span className="mr-1">{TYPE_ICON[n.type] || '🔔'}</span>{n.message}
              </p>
              <p className={`text-[10px] mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{fmt(n.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Assignee picker with most-used suggestions ──────────────────────────── */
export function AssigneePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [suggest, setSuggest] = useState({ mostUsed: [], members: [] });
  const boxRef = useRef(null);

  useEffect(() => {
    fetchJson('/api/tickets?suggest=1').then(setSuggest).catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const options = useMemo(() => {
    const seen = new Set();
    const merged = [];
    for (const m of suggest.mostUsed || []) {
      if (!seen.has(m.email)) { seen.add(m.email); merged.push({ ...m, top: true }); }
    }
    for (const m of suggest.members || []) {
      if (!seen.has(m.email)) { seen.add(m.email); merged.push(m); }
    }
    const q = value.trim().toLowerCase();
    return q ? merged.filter((m) => m.email.includes(q) || (m.name || '').toLowerCase().includes(q)) : merged;
  }, [suggest, value]);

  return (
    <div className="relative" ref={boxRef}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        required
        placeholder="name@patienceai.in"
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
      />
      {open && options.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1">
          {options.map((m) => (
            <button key={m.email} type="button"
              onClick={() => { onChange(m.email); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left">
              <FiUser size={13} className="text-slate-400 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-slate-800 truncate">{m.name || m.email.split('@')[0]}</span>
                <span className="block text-[11px] text-slate-400 truncate">{m.email}</span>
              </span>
              {m.top && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  most used
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Create-ticket popup with categories, KB suggestions and attachments ─── */
export function TicketModal({ open, onClose, prefill = {}, onCreated }) {
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium', category: 'General Inquiry', assigneeEmail: '' });
  const [files, setFiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [kbHits, setKbHits] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const kbTimer = useRef(null);

  useEffect(() => {
    if (open) {
      setForm({ subject: '', description: '', priority: 'medium', category: 'General Inquiry', assigneeEmail: '' });
      setErr(''); setResult(null); setFiles([]); setKbHits([]);
      fetchJson('/api/ticket-settings').then((d) => setCategories((d.categories || []).map((c) => c.name))).catch(() => {});
    }
  }, [open]);

  // Suggest related knowledge-base articles while typing the subject.
  const onSubjectChange = (subject) => {
    setForm((f) => ({ ...f, subject }));
    if (kbTimer.current) clearTimeout(kbTimer.current);
    if (subject.trim().length < 4) { setKbHits([]); return; }
    kbTimer.current = setTimeout(() => {
      fetchJson(`/api/kb?search=${encodeURIComponent(subject.trim())}`)
        .then((d) => setKbHits(d.articles || [])).catch(() => {});
    }, 450);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.assigneeEmail.trim().toLowerCase().endsWith('@patienceai.in')) {
      setErr('Assignee must be a @patienceai.in email address.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const d = await fetchJson('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          conversationId: prefill.conversationId || null,
          customerEmail: prefill.customerEmail || null,
          customerName: prefill.customerName || null
        })
      });
      if (files.length) {
        const uploadErrors = await uploadFiles(d.ticket.id, files);
        if (uploadErrors.length) setErr(`Ticket created, but some files failed: ${uploadErrors.join('; ')}`);
      }
      setResult({ ...d.ticket, similar: d.similar || [] });
      onCreated?.(d.ticket);
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div initial={{ scale: 0.93, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 18 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <FiTag size={16} />
                <p className="font-bold text-sm">{result ? 'Ticket created' : 'Create support ticket'}</p>
              </div>
              <button onClick={onClose} className="text-white/60 hover:text-white"><FiX size={18} /></button>
            </div>

            {result ? (
              <div className="p-6 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-800">{result.key} — {result.subject}</p>
                  <p className="text-xs text-emerald-700 mt-1 capitalize">{result.category} · {result.priority} priority · Assigned to {result.assignee_name} ({result.assignee_email})</p>
                  {result.due_at && <p className="text-xs text-emerald-700 mt-0.5">SLA: respond by {fmt(result.due_at)}</p>}
                </div>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 text-slate-600">
                    <FiMail size={14} className="text-slate-400" />
                    Client email:
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${result.client_email_status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : result.client_email_status === 'skipped' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {result.client_email_status === 'skipped' ? 'no client email on chat' : result.client_email_status}
                    </span>
                  </p>
                  <p className="flex items-center gap-2 text-slate-600">
                    <FiMail size={14} className="text-slate-400" />
                    Assignee email:
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${result.assignee_email_status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {result.assignee_email_status}
                    </span>
                  </p>
                </div>
                {result.similar?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Possible duplicates already open:</p>
                    {result.similar.map((sm) => (
                      <p key={sm.key} className="text-xs text-amber-700">{sm.key} — {sm.subject} ({sm.status})</p>
                    ))}
                  </div>
                )}
                {err && <p className="text-amber-600 text-xs">{err}</p>}
                <button onClick={onClose}
                  className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 text-sm transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="p-6 space-y-4">
                {(prefill.customerEmail || prefill.customerName) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
                    For client: <span className="font-semibold text-slate-800">{prefill.customerName || ''} {prefill.customerEmail ? `<${prefill.customerEmail}>` : ''}</span>
                    {prefill.conversationId && <span className="block font-mono text-[10px] text-slate-400 mt-0.5 truncate">{prefill.conversationId}</span>}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Subject *</label>
                  <input value={form.subject} onChange={(e) => onSubjectChange(e.target.value)}
                    required placeholder="Short summary of the issue"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                  {kbHits.length > 0 && (
                    <div className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold mb-1 flex items-center gap-1">
                        <FiBookOpen size={10} /> Related knowledge base — maybe this is already answered
                      </p>
                      {kbHits.slice(0, 3).map((a) => (
                        <details key={a.id} className="text-xs text-cyan-900 py-0.5">
                          <summary className="cursor-pointer font-medium">{a.title} <span className="opacity-60">({a.kind})</span></summary>
                          <p className="mt-1 opacity-80">{a.excerpt}…</p>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Category *</label>
                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20">
                      {(categories.length ? categories : ['General Inquiry']).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Attachments</label>
                    <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-500 cursor-pointer hover:bg-slate-100">
                      <FiPaperclip size={13} /> {files.length ? `${files.length} file(s)` : 'Add files'}
                      <input type="file" multiple className="hidden"
                        onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4} placeholder="Details, steps, context for the assignee…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Priority * <span className="text-slate-400 font-normal">(sets the SLA deadline)</span></label>
                  <div className="flex gap-2">
                    {PRIORITIES.map((p) => (
                      <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, priority: p }))}
                        className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold capitalize transition-colors ${form.priority === p ? PRIORITY_BADGE[p] + ' ring-2 ring-slate-900/10' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Assign to (@patienceai.in) *</label>
                  <AssigneePicker value={form.assigneeEmail} onChange={(v) => setForm((f) => ({ ...f, assigneeEmail: v }))} />
                </div>
                {err && <p className="text-red-500 text-xs">{err}</p>}
                <button type="submit" disabled={saving}
                  className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 disabled:opacity-50 transition-colors text-sm">
                  {saving ? 'Creating ticket & sending emails…' : 'Create ticket'}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Ticket detail with comments, internal notes, files, escalations ─────── */
export function TicketDetail({ ticket, onChanged, canReassign = true }) {
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [input, setInput] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [savedResponses, setSavedResponses] = useState([]);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const endRef = useRef(null);

  const load = async () => {
    try {
      const d = await fetchJson(`/api/tickets?id=${ticket.id}`);
      setComments(d.comments || []);
      setAttachments(d.attachments || []);
      setEscalations(d.escalations || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    setComments([]); setAttachments([]);
    load();
    fetchJson('/api/ticket-settings').then((d) => setSavedResponses(d.savedResponses || [])).catch(() => {});
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

  const onUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    const errors = await uploadFiles(ticket.id, files);
    if (errors.length) setErr(errors.join('; '));
    await load();
    setUploading(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 py-4 border-b border-slate-200 bg-white shrink-0 overflow-y-auto max-h-[45%]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-400">{ticket.key} · {ticket.category}</p>
            <h3 className="font-bold text-slate-900 text-base leading-snug">{ticket.subject}</h3>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold capitalize ${PRIORITY_BADGE[ticket.priority]}`}>
              {ticket.priority}
            </span>
            <SlaBadge ticket={ticket} />
          </div>
        </div>
        {ticket.description && <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{ticket.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><FiUser size={11} /> {ticket.assignee_name} ({ticket.assignee_email})</span>
          {ticket.customer_email && <span className="flex items-center gap-1"><FiMail size={11} /> Client: {ticket.customer_email}</span>}
          <span className="flex items-center gap-1"><FiClock size={11} /> {fmt(ticket.created_at)}</span>
          <span>By {ticket.created_by_name || 'Support'}</span>
          {Number(ticket.escalation_level) > 0 && (
            <span className="text-amber-600 font-semibold flex items-center gap-1"><FiAlertTriangle size={11} /> Escalation level {ticket.escalation_level}</span>
          )}
        </div>
        {escalations.length > 0 && (
          <details className="mt-2 text-[11px] text-slate-500">
            <summary className="cursor-pointer font-medium text-amber-700">Escalation history ({escalations.length})</summary>
            {escalations.map((e) => (
              <p key={e.id} className="mt-1">L{e.level} · {fmt(e.created_at)} — {e.reason}</p>
            ))}
          </details>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => update({ status: s })}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium capitalize transition-colors ${ticket.status === s ? STATUS_BADGE[s] + ' ring-2 ring-slate-900/10' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
              {statusLabel(s)}
            </button>
          ))}
          <select value={ticket.priority} onChange={(e) => update({ priority: e.target.value })}
            className="text-[11px] rounded-full border border-slate-200 px-2 py-1 text-slate-600 bg-white capitalize focus:outline-none">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p} priority</option>)}
          </select>
          {canReassign && (
            <ReassignControl ticket={ticket} onReassign={(email) => update({ assigneeEmail: email })} />
          )}
          {(!ticket.stage || ticket.stage === 'support') ? (
            <button onClick={async () => {
              try {
                await fetchJson('/api/dev-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ticketId: ticket.id, action: 'escalate' }) });
                onChanged?.();
              } catch (e) { setErr(e.message); }
            }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
              → Engineering
            </button>
          ) : (
            <span className="text-[11px] px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 font-medium capitalize">
              ⚙ {(ticket.stage || '').replace('_', ' ')}
            </span>
          )}
        </div>
        {attachments.length > 0 && <div className="mt-3"><AttachmentList attachments={attachments} /></div>}
        {err && <p className="text-red-500 text-xs mt-2">{err}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 min-h-0">
        {comments.length === 0 && <p className="text-slate-400 text-xs text-center py-6">No activity yet.</p>}
        {comments.map((c) => (
          c.author_role === 'system' ? (
            <p key={c.id} className="text-center text-[11px] text-slate-400 py-1">{c.message} · {fmt(c.created_at)}</p>
          ) : (
            <div key={c.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${c.is_internal
              ? 'border border-amber-300 bg-amber-50 text-amber-900'
              : c.author_role === 'member' || c.author_role === 'client'
                ? 'bg-white border border-slate-200 text-slate-800'
                : 'ml-auto bg-slate-900 text-white'}`}>
              <p className={`text-[10px] uppercase tracking-wider mb-1 ${c.is_internal ? 'text-amber-600' : (c.author_role === 'member' || c.author_role === 'client') ? 'text-slate-400' : 'text-white/40'}`}>
                {c.is_internal && <FiLock size={9} className="inline mr-1" />}
                {c.author_name || c.author_role}{c.author_role === 'client' ? ' (client)' : ''} · {fmt(c.created_at)}{c.is_internal ? ' · internal note' : ''}
              </p>
              <p className="whitespace-pre-wrap leading-snug">{c.message}</p>
            </div>
          )
        ))}
        <div ref={endRef} />
      </div>

      {savedResponses.length > 0 && (
        <div className="border-t border-slate-200 px-3 pt-2 bg-white flex flex-wrap gap-1.5 shrink-0">
          {savedResponses.map((r) => (
            <button key={r.id} type="button" title={r.body}
              onClick={() => setInput((v) => (v ? `${v} ${r.body}` : r.body))}
              className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors">
              {r.label}
            </button>
          ))}
        </div>
      )}
      <div className="p-3 border-t border-slate-200 bg-white shrink-0">
        <div className="flex items-end gap-2">
          <label className={`h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 ${uploading ? 'opacity-40 pointer-events-none' : ''}`} title="Attach file">
            <FiPaperclip size={15} className="text-slate-500" />
            <input type="file" multiple className="hidden"
              onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }} />
          </label>
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
            rows={2} placeholder={isInternal ? 'Internal note (hidden from the client)…' : 'Message the assignee… (Enter to send)'}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 resize-none ${isInternal ? 'border-amber-300 bg-amber-50 focus:ring-amber-400/40' : 'border-slate-200 bg-slate-50 focus:ring-slate-900/20'}`} />
          <button onClick={sendComment} disabled={!input.trim()}
            className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 flex items-center justify-center disabled:opacity-40 transition-colors">
            <FiSend size={15} className="text-white" />
          </button>
        </div>
        <label className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500 cursor-pointer select-none w-fit">
          <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="accent-amber-500" />
          <FiLock size={10} /> Internal note — visible to staff only, never to the client
        </label>
      </div>
    </div>
  );
}

function ReassignControl({ ticket, onReassign }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  if (!open) {
    return (
      <button onClick={() => { setEmail(ticket.assignee_email); setOpen(true); }}
        className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50">
        Reassign
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 w-56">
      <span className="flex-1"><AssigneePicker value={email} onChange={setEmail} /></span>
      <button onClick={() => { onReassign(email); setOpen(false); }}
        className="text-[11px] px-2 py-1.5 rounded-lg bg-slate-900 text-white">OK</button>
      <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><FiX size={13} /></button>
    </span>
  );
}

/* ── Full tickets workspace for the executive console ────────────────────── */
const EMPTY_FILTERS = { status: 'all', priority: '', category: '', assignee: '', dateFrom: '', dateTo: '' };

export function TicketsPanel({ onCreateNew }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState([]);
  const [savedFilters, setSavedFilters] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('pa_saved_filters') || '[]'); } catch { return []; }
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAssign, setBulkAssign] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  useEffect(() => {
    fetchJson('/api/ticket-settings').then((d) => setCategories((d.categories || []).map((c) => c.name))).catch(() => {});
  }, []);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.category) params.set('category', filters.category);
    if (filters.assignee) params.set('assignee', filters.assignee);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    const q = search.trim();
    if (/^pa-?\d+$/i.test(q)) params.set('ticketId', q);
    else if (q.includes('@')) params.set('clientEmail', q);
    else if (q) params.set('search', q);
    return params;
  };

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchJson(`/api/tickets?${buildParams().toString()}`);
      setTickets(d.tickets || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);

  }, [filters, search]);

  const persistSavedFilters = (next) => {
    setSavedFilters(next);
    try { window.localStorage.setItem('pa_saved_filters', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const saveCurrentFilter = () => {
    const name = window.prompt('Name this filter:');
    if (!name?.trim()) return;
    persistSavedFilters([...savedFilters.filter((f) => f.name !== name.trim()), { name: name.trim(), filters, search }]);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkUpdate = async (patch) => {
    if (!selectedIds.size) return;
    setBulkMsg('');
    try {
      const d = await fetchJson('/api/tickets', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), ...patch })
      });
      setBulkMsg(`Updated ${d.updated} ticket(s).`);
      setSelectedIds(new Set());
      setBulkAssign('');
      await load();
    } catch (ex) { setBulkMsg(ex.message); }
  };

  const exportCsv = () => {
    const params = buildParams();
    params.set('export', 'csv');
    window.open(`/api/tickets?${params.toString()}`, '_blank');
  };

  const selected = tickets.find((t) => t.id === selectedId) || null;

  return (
    <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
      <aside className="w-full md:w-96 border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col shrink-0 max-h-[45vh] md:max-h-none">
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex gap-2">
            <button onClick={onCreateNew}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 transition-colors">
              <FiPlus size={15} /> New ticket
            </button>
            <button onClick={exportCsv} title="Export filtered tickets to CSV"
              className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium">
              <FiDownload size={14} />
            </button>
            <button onClick={() => setShowFilters((s) => !s)} title="Advanced filters"
              className={`px-3 rounded-xl border text-xs font-medium ${showFilters ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              <FiFilter size={14} />
            </button>
          </div>
          <div className="relative">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject, PA-12, client email…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
          </div>
          {showFilters && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600 capitalize">
                  <option value="">Any priority</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
                  <option value="">Any category</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={filters.assignee} onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
                  placeholder="Assignee email" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600 col-span-2" />
                <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600" />
                <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600" />
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <button onClick={saveCurrentFilter} className="text-[10px] px-2 py-1 rounded-full bg-slate-900 text-white">Save filter</button>
                <button onClick={() => { setFilters(EMPTY_FILTERS); setSearch(''); }} className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-500">Clear</button>
                {savedFilters.map((f) => (
                  <span key={f.name} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700">
                    <button onClick={() => { setFilters({ ...EMPTY_FILTERS, ...f.filters }); setSearch(f.search || ''); }}>{f.name}</button>
                    <button onClick={() => persistSavedFilters(savedFilters.filter((x) => x.name !== f.name))}><FiX size={9} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {['all', ...STATUSES].map((s) => (
              <button key={s} onClick={() => setFilters((f) => ({ ...f, status: s }))}
                className={`text-[10px] px-2 py-1 rounded-full border font-medium capitalize ${filters.status === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {s === 'all' ? 'all' : statusLabel(s)}
              </button>
            ))}
            <button onClick={load} className="ml-auto p-1 text-slate-400 hover:text-slate-700">
              <FiRefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="px-3 py-2 border-b border-slate-200 bg-indigo-50 space-y-1.5">
            <p className="text-[11px] font-semibold text-indigo-800">{selectedIds.size} selected — bulk actions</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => bulkUpdate({ status: 'closed' })} className="text-[10px] px-2 py-1 rounded-full bg-slate-900 text-white">Close all</button>
              <select onChange={(e) => { if (e.target.value) { bulkUpdate({ status: e.target.value }); e.target.value = ''; } }}
                className="text-[10px] rounded-full border border-slate-300 px-1.5 py-1 bg-white text-slate-600" defaultValue="">
                <option value="" disabled>Set status…</option>
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <select onChange={(e) => { if (e.target.value) { bulkUpdate({ priority: e.target.value }); e.target.value = ''; } }}
                className="text-[10px] rounded-full border border-slate-300 px-1.5 py-1 bg-white text-slate-600 capitalize" defaultValue="">
                <option value="" disabled>Set priority…</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-1.5">
              <input value={bulkAssign} onChange={(e) => setBulkAssign(e.target.value)} placeholder="Assign all to name@patienceai.in"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700" />
              <button onClick={() => bulkAssign && bulkUpdate({ assigneeEmail: bulkAssign })} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-600 text-white">Assign</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-[10px] px-2 py-1 rounded-lg border border-slate-300 text-slate-500">Cancel</button>
            </div>
          </div>
        )}
        {bulkMsg && <p className="px-3 py-1.5 text-[11px] text-indigo-700 bg-indigo-50 border-b border-indigo-100">{bulkMsg}</p>}

        <div className="flex-1 overflow-y-auto">
          {loading && tickets.length === 0 && (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          )}
          {!loading && tickets.length === 0 && (
            <p className="text-slate-400 text-xs p-4 text-center">No tickets match. Create one from a chat or with “New ticket”.</p>
          )}
          {tickets.map((t) => (
            <div key={t.id} className={`flex items-stretch border-b border-slate-100 ${selectedId === t.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-800'}`}>
              <button onClick={() => toggleSelect(t.id)} className="pl-2.5 pr-1 flex items-center" title="Select for bulk actions">
                {selectedIds.has(t.id) ? <FiCheckSquare size={14} className="text-indigo-500" /> : <FiSquare size={14} className="opacity-30" />}
              </button>
              <button onClick={() => setSelectedId(t.id)} className="flex-1 text-left px-2 py-3 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-mono opacity-60">{t.key}</span>
                  <span className="flex items-center gap-1">
                    <SlaBadge ticket={t} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold capitalize ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                  </span>
                </div>
                <p className="text-xs font-semibold truncate">{t.subject}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className={`text-[10px] truncate ${selectedId === t.id ? 'text-white/60' : 'text-slate-400'}`}>{t.assignee_name || t.assignee_email} · {t.category}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize shrink-0 ${STATUS_BADGE[t.status]}`}>{statusLabel(t.status)}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {selected ? (
          <TicketDetail ticket={selected} onChanged={load} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-6 text-center">Select a ticket to view details, files and the conversation</div>
        )}
      </main>
    </div>
  );
}
