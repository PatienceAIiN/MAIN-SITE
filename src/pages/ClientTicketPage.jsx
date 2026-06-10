import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiPaperclip, FiRefreshCw, FiCheckCircle, FiTag, FiDownload, FiClock } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';
const statusLabel = (s) => (s || '').replace('_', ' ');

const STATUS_STYLE = {
  open: 'bg-sky-50 text-sky-700 border-sky-200',
  in_progress: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200'
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — enforced server-side too

export default function ClientTicketPage() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [form, setForm] = useState({ key: urlParams.get('key') || '', email: urlParams.get('email') || '' });
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);

  const load = async (key = form.key, email = form.email, { silent = false } = {}) => {
    if (!key.trim() || !email.trim()) return;
    if (!silent) { setLoading(true); setErr(''); }
    try {
      const d = await fetchJson(`/api/client-tickets?key=${encodeURIComponent(key.trim())}&email=${encodeURIComponent(email.trim())}`);
      setData(d);
    } catch (ex) { if (!silent) { setErr(ex.message); setData(null); } }
    finally { if (!silent) setLoading(false); }
  };

  // Auto-open when arriving from the email link, then keep the thread fresh.
  useEffect(() => {
    if (form.key && form.email) load();

  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!data) return;
    pollRef.current = setInterval(() => load(form.key, form.email, { silent: true }), 6000);
    return () => clearInterval(pollRef.current);

  }, [data?.ticket?.key]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data?.comments?.length]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    const text = reply.trim();
    setReply(''); setErr('');
    try {
      await fetchJson('/api/client-tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: form.key, email: form.email, message: text })
      });
      await load(form.key, form.email, { silent: true });
    } catch (ex) { setErr(ex.message); }
  };

  const closeTicket = async () => {
    setCloseConfirm(false); setErr('');
    try {
      await fetchJson('/api/client-tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: form.key, email: form.email, action: 'close' })
      });
      await load(form.key, form.email, { silent: true });
    } catch (ex) { setErr(ex.message); }
  };

  const onUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true); setErr('');
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) { setErr(`${file.name}: too large (max 10 MB)`); continue; }
      try {
        const params = new URLSearchParams({ ticketId: form.key, fileName: file.name, clientEmail: form.email });
        await fetchJson(`/api/attachments/upload?${params.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file
        });
      } catch (ex) { setErr(`${file.name}: ${ex.message}`); }
    }
    await load(form.key, form.email, { silent: true });
    setUploading(false);
  };

  const ticket = data?.ticket;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-medium mb-1">Patience AI Support</p>
          <h1 className="text-2xl font-bold">Track your ticket</h1>
          <p className="text-sm text-slate-500 mt-1">Enter your ticket ID (from your confirmation email) and the email you used in chat.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); load(); }}
          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-2 mb-6">
          <input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            required placeholder="Ticket ID (e.g. PA-12)"
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required placeholder="Your email"
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
          <button type="submit" disabled={loading}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50 transition-colors">
            {loading ? 'Loading…' : 'View ticket'}
          </button>
        </form>

        {err && <p className="text-red-500 text-sm text-center mb-4">{err}</p>}

        {ticket && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Ticket header */}
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-slate-400 flex items-center gap-1"><FiTag size={11} /> {ticket.key} · {ticket.category}</p>
                  <h2 className="font-bold text-lg leading-snug">{ticket.subject}</h2>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold capitalize shrink-0 ${STATUS_STYLE[ticket.status]}`}>
                  {statusLabel(ticket.status)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <FiClock size={10} /> Created {fmt(ticket.created_at)} · Last update {fmt(ticket.updated_at)}
              </p>
              {data.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {data.attachments.map((a) => (
                    <a key={a.id} href={`/api/attachments?id=${a.id}&email=${encodeURIComponent(form.email)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                      <FiPaperclip size={10} /> <span className="max-w-[140px] truncate">{a.file_name}</span> <FiDownload size={10} />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="max-h-[45vh] overflow-y-auto p-4 space-y-2 bg-slate-50">
              {(data.comments || []).map((c) => (
                c.author_role === 'system' ? (
                  <p key={c.id} className="text-center text-[11px] text-slate-400 py-1">{c.message} · {fmt(c.created_at)}</p>
                ) : (
                  <div key={c.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${c.author_role === 'client'
                    ? 'ml-auto bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                    <p className={`text-[10px] uppercase tracking-wider mb-1 ${c.author_role === 'client' ? 'text-white/40' : 'text-slate-400'}`}>
                      {c.author_name} · {fmt(c.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap leading-snug">{c.message}</p>
                  </div>
                )
              ))}
              <div ref={endRef} />
            </div>

            {/* Actions */}
            {ticket.status !== 'closed' ? (
              <div className="p-3 border-t border-slate-200 bg-white">
                <div className="flex items-end gap-2">
                  <label className={`h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 ${uploading ? 'opacity-40 pointer-events-none' : ''}`} title="Attach file">
                    <FiPaperclip size={15} className="text-slate-500" />
                    <input type="file" multiple className="hidden"
                      onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }} />
                  </label>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    rows={2} placeholder="Reply to the support team… (Enter to send)"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900/20 resize-none" />
                  <button onClick={sendReply} disabled={!reply.trim()}
                    className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 flex items-center justify-center disabled:opacity-40 transition-colors">
                    <FiSend size={15} className="text-white" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => load(form.key, form.email, { silent: true })} className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1">
                    <FiRefreshCw size={10} /> Refresh
                  </button>
                  <button onClick={() => setCloseConfirm(true)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-medium">
                    <FiCheckCircle size={11} /> My issue is resolved — close this ticket
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-t border-slate-200 bg-emerald-50 text-center text-sm text-emerald-700 flex items-center justify-center gap-2">
                <FiCheckCircle size={15} /> This ticket is closed. Need more help? Start a new chat on our website.
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Close confirmation */}
      <AnimatePresence>
        {closeConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setCloseConfirm(false); }}>
            <motion.div initial={{ scale: 0.93, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 18 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
              <p className="font-bold text-sm mb-1">Close this ticket?</p>
              <p className="text-xs text-slate-500 mb-5">Please confirm your issue is fully resolved. You won't be able to reply after closing.</p>
              <div className="flex gap-2">
                <button onClick={closeTicket}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 transition-colors">
                  Yes, close it
                </button>
                <button onClick={() => setCloseConfirm(false)}
                  className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 transition-colors">
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
