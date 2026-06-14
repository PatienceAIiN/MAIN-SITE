// Growth → Mail. Full Gmail integration: connect a Google account, then read
// (Inbox / Sent / Drafts / Starred / Trash), search, open, reply, compose, save
// drafts, trash and mark read/unread — all via /api/gmail. Email HTML is
// rendered in a sandboxed iframe (no scripts) to stay XSS-safe.
import React, { useCallback, useEffect, useState } from 'react';
import {
  FiMail, FiInbox, FiSend, FiFileText, FiStar, FiTrash2, FiEdit, FiSearch,
  FiRefreshCw, FiX, FiCornerUpLeft, FiPaperclip, FiLink2,
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import { Spinner, confirmDialog } from '../common/confirm';

const card = 'rounded-2xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800';
const input = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const btn = 'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50';
const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-500`;
const btnGhost = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const gApi = (path, opts = {}) => fetchJson(`/api/gmail${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
const fromName = (s) => { const m = String(s || '').match(/^\s*"?([^"<]*?)"?\s*<.*>$/); return (m && m[1].trim()) || s || ''; };
const fmt = (v) => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); };

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: FiInbox },
  { key: 'SENT', label: 'Sent', icon: FiSend },
  { key: 'DRAFT', label: 'Drafts', icon: FiFileText },
  { key: 'STARRED', label: 'Starred', icon: FiStar },
  { key: 'TRASH', label: 'Trash', icon: FiTrash2 },
];

/* ── Compose / reply / edit-draft ─────────────────────────────────────────── */
function Compose({ initial, onClose, onDone }) {
  const [f, setF] = useState({ to: '', cc: '', subject: '', body: '', threadId: undefined, draftId: undefined, id: undefined, ...initial });
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const act = async (kind) => {
    setErr('');
    if (kind === 'send' && !f.to.trim()) { setErr('Add at least one recipient.'); return; }
    setBusy(kind);
    try {
      if (kind === 'send') await gApi('', { method: 'POST', body: JSON.stringify({ action: 'send', to: f.to, cc: f.cc, subject: f.subject, body: (f.body || '').replace(/\n/g, '<br>'), threadId: f.threadId, draftId: f.draftId }) });
      else await gApi('', { method: 'POST', body: JSON.stringify({ action: 'draft', id: f.id, to: f.to, cc: f.cc, subject: f.subject, body: (f.body || '').replace(/\n/g, '<br>'), threadId: f.threadId }) });
      onDone(kind);
    } catch (ex) { setErr(ex.message); } finally { setBusy(''); }
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${card} w-full max-w-2xl p-5`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-bold text-slate-900 dark:text-white">{f.draftId || f.id ? 'Edit draft' : initial?.threadId ? 'Reply' : 'New message'}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX /></button></div>
        <div className="space-y-2">
          <input className={input} placeholder="To (comma-separated)" value={f.to} onChange={set('to')} />
          <input className={input} placeholder="Cc" value={f.cc} onChange={set('cc')} />
          <input className={input} placeholder="Subject" value={f.subject} onChange={set('subject')} />
          <textarea className={`${input} min-h-[200px]`} placeholder="Write your message…" value={f.body} onChange={set('body')} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className={btnGhost} onClick={() => act('draft')} disabled={busy}>{busy === 'draft' ? <Spinner /> : 'Save draft'}</button>
            <button className={btnPrimary} onClick={() => act('send')} disabled={busy}>{busy === 'send' ? <Spinner /> : <><FiSend size={14} /> Send</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reader ───────────────────────────────────────────────────────────────── */
function Reader({ id, onClose, onChanged, onReply }) {
  const [m, setM] = useState(null);
  useEffect(() => {
    gApi(`?msg=${id}`).then((d) => { setM(d); if (d.unread) gApi('', { method: 'POST', body: JSON.stringify({ action: 'markRead', id }) }).then(() => onChanged?.()).catch(() => {}); }).catch(() => setM({ error: true }));
  }, [id]); // eslint-disable-line
  if (!m) return <div className="grid place-items-center h-full"><Spinner /></div>;
  if (m.error) return <div className="grid place-items-center h-full text-slate-400">Could not load this message.</div>;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-slate-900 dark:text-white">{m.subject || '(no subject)'}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <button title="Reply" onClick={() => onReply(m)} className="p-2 text-slate-400 hover:text-indigo-600"><FiCornerUpLeft /></button>
            <button title="Trash" onClick={async () => { await gApi('', { method: 'POST', body: JSON.stringify({ action: 'trash', id: m.id }) }); onChanged?.(true); }} className="p-2 text-slate-400 hover:text-red-500"><FiTrash2 /></button>
            <button title="Close" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700"><FiX /></button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1"><b className="text-slate-700 dark:text-slate-200">{fromName(m.from)}</b> &lt;{(m.from || '').replace(/^.*</, '').replace(/>.*$/, '')}&gt;</p>
        <p className="text-[11px] text-slate-400">to {m.to} · {fmt(m.date)}</p>
        {m.attachments?.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{m.attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5 text-slate-500"><FiPaperclip size={11} /> {a.filename}</span>)}</div>}
      </div>
      <div className="flex-1 overflow-hidden bg-white">
        {m.html
          ? <iframe title="email" sandbox="allow-same-origin" srcDoc={m.html} className="w-full h-full border-0" />
          : <pre className="p-4 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans">{m.text || '(empty)'}</pre>}
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function GrowthMail() {
  const [status, setStatus] = useState(null); // {configured, connected, email}
  const [folder, setFolder] = useState('INBOX');
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [compose, setCompose] = useState(null);

  const loadStatus = useCallback(() => gApi('?status=1').then(setStatus).catch(() => setStatus({ configured: false, connected: false })), []);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  // Clean the ?mail=connected flag the OAuth callback adds.
  useEffect(() => { if (new URLSearchParams(window.location.search).get('mail')) { window.history.replaceState({}, '', '/growth'); loadStatus(); } }, [loadStatus]);

  const load = useCallback(() => {
    if (!status?.connected) return;
    setLoading(true); setOpenId(null);
    gApi(`?list=1&label=${folder}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then((d) => setMsgs(d.messages || [])).catch(() => setMsgs([])).finally(() => setLoading(false));
  }, [status, folder, q]);
  useEffect(() => { load(); }, [folder, status]); // eslint-disable-line

  const connect = async () => { try { const { url } = await gApi('?authurl=1'); window.location.href = url; } catch (e) { window.alert(e.message); } };
  const disconnect = async () => { if (!(await confirmDialog({ title: 'Disconnect Gmail', message: 'Disconnect this Google account from Growth?', confirmText: 'Disconnect' }))) return; await gApi('', { method: 'POST', body: JSON.stringify({ action: 'disconnect' }) }); loadStatus(); setMsgs([]); };

  const replyTo = (m) => setCompose({ to: (m.from || '').replace(/^.*</, '').replace(/>.*$/, '') || m.from, subject: /^re:/i.test(m.subject || '') ? m.subject : `Re: ${m.subject || ''}`, threadId: m.threadId, body: `\n\n----- On ${fmt(m.date)}, ${fromName(m.from)} wrote -----\n` });
  const openDraft = (d) => setCompose({ id: d.draftId, to: d.to, subject: d.subject, threadId: d.threadId });

  if (!status) return <div className="grid place-items-center py-32"><Spinner size={26} /></div>;

  if (!status.configured) {
    return <div className={`${card} p-8 text-center max-w-lg mx-auto`}>
      <FiMail size={30} className="mx-auto text-slate-300 mb-3" />
      <h3 className="font-bold text-slate-800 dark:text-white">Gmail isn't configured yet</h3>
      <p className="text-sm text-slate-500 mt-2">An admin needs to set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> (and add the OAuth redirect URI) before Gmail can be connected.</p>
    </div>;
  }
  if (!status.connected) {
    return <div className={`${card} p-8 text-center max-w-lg mx-auto`}>
      <FiMail size={30} className="mx-auto text-indigo-400 mb-3" />
      <h3 className="font-bold text-slate-800 dark:text-white">Connect your Gmail</h3>
      <p className="text-sm text-slate-500 mt-2 mb-5">Send, receive and manage email right inside Growth. Your account stays private to you.</p>
      <button className={`${btnPrimary} mx-auto`} onClick={connect}><FiLink2 /> Connect Google account</button>
    </div>;
  }

  return (
    <div className="grid lg:grid-cols-[200px_360px_1fr] gap-4" style={{ height: 'calc(100vh - 170px)' }}>
      {/* Folders */}
      <div className={`${card} p-2 flex flex-col`}>
        <button className={`${btnPrimary} w-full justify-center mb-2`} onClick={() => setCompose({})}><FiEdit size={14} /> Compose</button>
        {FOLDERS.map((fo) => (
          <button key={fo.key} onClick={() => setFolder(fo.key)} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium ${folder === fo.key ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <fo.icon size={15} /> {fo.label}
          </button>
        ))}
        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 px-1">
          <p className="truncate" title={status.email}>{status.email}</p>
          <button onClick={disconnect} className="text-red-400 hover:text-red-500 mt-1">Disconnect</button>
        </div>
      </div>

      {/* Message list */}
      <div className={`${card} flex flex-col`}>
        <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 flex gap-2">
          <div className="relative flex-1"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input className={`${input} pl-9`} placeholder="Search mail…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></div>
          <button className={btnGhost} onClick={load} title="Refresh"><FiRefreshCw className={loading ? 'animate-spin' : ''} size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && !msgs.length && <div className="grid place-items-center py-16"><Spinner /></div>}
          {!loading && !msgs.length && <p className="text-sm text-slate-400 text-center py-16">No messages.</p>}
          {msgs.map((m) => (
            <button key={m.id || m.draftId} onClick={() => folder === 'DRAFT' ? openDraft(m) : setOpenId(m.id)}
              className={`w-full text-left px-3.5 py-3 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${openId === m.id ? 'bg-slate-100 dark:bg-slate-800' : ''} ${m.unread ? 'font-semibold' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-800 dark:text-slate-100 truncate">{folder === 'SENT' || folder === 'DRAFT' ? `To: ${fromName(m.to)}` : fromName(m.from)}</span>
                <span className="text-[10px] text-slate-400 shrink-0">{fmt(m.date).split(',')[0]}</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{m.subject || '(no subject)'}</div>
              <div className="text-[11px] text-slate-400 truncate">{m.snippet}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Reader */}
      <div className={`${card} overflow-hidden`}>
        {openId ? <Reader id={openId} onClose={() => setOpenId(null)} onChanged={(reload) => { if (reload) { setOpenId(null); load(); } else load(); }} onReply={replyTo} />
          : <div className="h-full grid place-items-center text-slate-400 text-sm"><div className="text-center"><FiMail size={28} className="mx-auto mb-2 text-slate-300" />Select a message to read</div></div>}
      </div>

      {compose && <Compose initial={compose} onClose={() => setCompose(null)} onDone={(kind) => { setCompose(null); if (kind === 'send' || folder === 'DRAFT') load(); }} />}
    </div>
  );
}
