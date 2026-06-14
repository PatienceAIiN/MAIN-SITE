// Growth → Mail. Unified email client over Gmail (OAuth) OR Titan Mail/GoDaddy
// (IMAP+SMTP credential sign-in). Read folders, search, threaded/single read,
// send, reply, compose (rich text + attachments), drafts, star, labels (Gmail),
// mark read/unread, single + bulk multi-select delete. Disconnect lives in
// Settings. Email HTML renders in a sandboxed (no-script) iframe.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiMail, FiInbox, FiSend, FiFileText, FiStar, FiTrash2, FiEdit, FiSearch,
  FiRefreshCw, FiX, FiCornerUpLeft, FiPaperclip, FiLink2, FiAlertCircle,
  FiTag, FiPlus, FiBold, FiItalic, FiUnderline, FiList, FiCheckSquare, FiSquare,
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import { Spinner } from '../common/confirm';

const card = 'rounded-2xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800';
const input = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const btn = 'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50';
const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-500`;
const btnGhost = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const fromName = (s) => { const m = String(s || '').match(/^\s*"?([^"<]*?)"?\s*<.*>$/); return (m && m[1].trim()) || s || ''; };
const fmt = (v) => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); };
const mApi = (provider, path, opts = {}) => fetchJson(`/api/${provider}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });

const GMAIL_FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: FiInbox }, { key: 'SENT', label: 'Sent', icon: FiSend },
  { key: 'DRAFT', label: 'Drafts', icon: FiFileText }, { key: 'STARRED', label: 'Starred', icon: FiStar },
  { key: 'TRASH', label: 'Trash', icon: FiTrash2 },
];
const TITAN_FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: FiInbox }, { key: 'Sent', label: 'Sent', icon: FiSend },
  { key: 'Drafts', label: 'Drafts', icon: FiFileText }, { key: 'Junk', label: 'Junk', icon: FiAlertCircle },
  { key: 'Trash', label: 'Trash', icon: FiTrash2 },
];

/* ── Titan sign-in ────────────────────────────────────────────────────────── */
function TitanLogin({ onClose, onDone }) {
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await mApi('titan', '', { method: 'POST', body: JSON.stringify({ action: 'connect', email: f.email, password: f.password }) }); onDone(); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <form onSubmit={submit} className={`${card} w-full max-w-sm p-6`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Sign in with Titan Mail</h3>
        <p className="text-xs text-slate-500 mb-4">Use your Titan / GoDaddy email and password. Stored encrypted; used only to sync your mailbox.</p>
        <input className={`${input} mb-2`} type="email" placeholder="you@yourdomain.com" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} required />
        <input className={`${input} mb-3`} type="password" placeholder="Mailbox password" value={f.password} onChange={(e) => setF((s) => ({ ...s, password: e.target.value }))} required />
        {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
        <button className={`${btnPrimary} w-full justify-center`} disabled={busy}>{busy ? <Spinner /> : 'Connect Titan Mail'}</button>
      </form>
    </div>
  );
}

/* ── Compose (rich text + attachments) ────────────────────────────────────── */
const MAX_ATTACH = 10 * 1024 * 1024;
const readAsBase64 = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(file); });
function Compose({ api, initial, onClose, onDone }) {
  const [f, setF] = useState({ to: '', cc: '', subject: '', body: '', threadId: undefined, draftId: undefined, id: undefined, ...initial });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const editorRef = useRef(null);
  const initialHtml = (f.body || '').replace(/\n/g, '<br>');
  const exec = (cmd, val) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); };
  const link = () => { const u = window.prompt('Link URL:'); if (u) exec('createLink', u); };
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const tbBtn = 'h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800';
  const addFiles = async (list) => {
    setErr(''); let total = files.reduce((s, x) => s + x.size, 0); const next = [...files];
    for (const file of Array.from(list || [])) { if (total + file.size > MAX_ATTACH) { setErr('Attachments exceed 10 MB.'); break; } total += file.size; next.push({ filename: file.name, mimeType: file.type || 'application/octet-stream', dataBase64: await readAsBase64(file), size: file.size }); }
    setFiles(next);
  };
  const act = async (kind) => {
    setErr(''); if (kind === 'send' && !f.to.trim()) { setErr('Add at least one recipient.'); return; }
    setBusy(kind);
    const attachments = files.map(({ filename, mimeType, dataBase64 }) => ({ filename, mimeType, dataBase64 }));
    try {
      const common = { to: f.to, cc: f.cc, subject: f.subject, body: editorRef.current?.innerHTML || '', threadId: f.threadId, attachments };
      await api('', { method: 'POST', body: JSON.stringify(kind === 'send' ? { action: 'send', draftId: f.draftId, ...common } : { action: 'draft', id: f.id, ...common }) });
      onDone(kind);
    } catch (ex) { setErr(ex.message); } finally { setBusy(''); }
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${card} w-full max-w-2xl p-5 max-h-[92vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-bold text-slate-900 dark:text-white">{f.draftId || f.id ? 'Edit draft' : initial?.threadId ? 'Reply' : 'New message'}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX /></button></div>
        <div className="space-y-2">
          <input className={input} placeholder="To (comma-separated)" value={f.to} onChange={set('to')} />
          <input className={input} placeholder="Cc" value={f.cc} onChange={set('cc')} />
          <input className={input} placeholder="Subject" value={f.subject} onChange={set('subject')} />
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-0.5 px-2 py-1 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <button type="button" title="Bold" className={tbBtn} onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><FiBold size={14} /></button>
              <button type="button" title="Italic" className={tbBtn} onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><FiItalic size={14} /></button>
              <button type="button" title="Underline" className={tbBtn} onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}><FiUnderline size={14} /></button>
              <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button type="button" title="Bulleted list" className={tbBtn} onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}><FiList size={14} /></button>
              <button type="button" title="Numbered list" className={`${tbBtn} text-[11px] font-bold`} onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }}>1.</button>
              <button type="button" title="Insert link" className={tbBtn} onMouseDown={(e) => { e.preventDefault(); link(); }}><FiLink2 size={14} /></button>
              <button type="button" title="Clear formatting" className={`${tbBtn} text-[11px]`} onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }}>Tx</button>
            </div>
            <div ref={editorRef} contentEditable suppressContentEditableWarning className="min-h-[180px] max-h-[40vh] overflow-y-auto px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none" dangerouslySetInnerHTML={{ __html: initialHtml }} />
          </div>
          {files.length > 0 && <div className="flex flex-wrap gap-1.5">{files.map((a, i) => <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5 text-slate-600 dark:text-slate-300"><FiPaperclip size={11} /> {a.filename} <button onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><FiX size={11} /></button></span>)}</div>}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-between items-center gap-2 pt-1">
            <label className={`${btnGhost} cursor-pointer`}><FiPaperclip size={14} /> Attach<input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} /></label>
            <div className="flex gap-2"><button className={btnGhost} onClick={() => act('draft')} disabled={busy}>{busy === 'draft' ? <Spinner /> : 'Save draft'}</button><button className={btnPrimary} onClick={() => act('send')} disabled={busy}>{busy === 'send' ? <Spinner /> : <><FiSend size={14} /> Send</>}</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reader ───────────────────────────────────────────────────────────────── */
function MessageBlock({ api, m, folder, std, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const dl = async (att) => {
    try {
      const qp = att.attachmentId ? `?attach=${m.id}&att=${att.attachmentId}` : `?attach=${m.id}&idx=${att.idx}&label=${folder}`;
      const r = await api(qp);
      const raw = r.std ? r.data : String(r.data || '').replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(raw); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: att.mimeType || 'application/octet-stream' }));
      const a = document.createElement('a'); a.href = url; a.download = att.filename || 'attachment'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { window.alert(`Download failed: ${e.message}`); }
  };
  return (
    <div className="border-b border-slate-100 dark:border-slate-800">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{fromName(m.from)}</span><span className="text-[11px] text-slate-400 shrink-0">{fmt(m.date)}</span></div>
        {!open && <div className="text-xs text-slate-400 truncate">{m.text ? m.text.slice(0, 120) : 'Open message'}</div>}
      </button>
      {open && (
        <div className="px-2 pb-3">
          <p className="text-[11px] text-slate-400 px-2 mb-1">to {m.to}{m.cc ? ` · cc ${m.cc}` : ''}</p>
          {m.attachments?.length > 0 && <div className="flex flex-wrap gap-1.5 px-2 mb-2">{m.attachments.map((a, i) => <button key={i} onClick={() => dl(a)} className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600"><FiPaperclip size={11} /> {a.filename}</button>)}</div>}
          <div className="bg-white rounded-lg overflow-hidden" style={{ height: 360 }}>
            {m.html ? <iframe title={`email-${m.id}`} sandbox="allow-same-origin" srcDoc={m.html} className="w-full h-full border-0" /> : <pre className="p-3 whitespace-pre-wrap text-sm text-slate-700 font-sans">{m.text || '(empty)'}</pre>}
          </div>
        </div>
      )}
    </div>
  );
}

function Reader({ api, provider, folder, labels = [], open, onClose, onChanged, onReply }) {
  const [thread, setThread] = useState(null);
  const [star, setStar] = useState(false);
  const [applied, setApplied] = useState([]);
  const [labelMenu, setLabelMenu] = useState(false);
  useEffect(() => {
    const url = (provider === 'gmail' && open.threadId) ? `?thread=${open.threadId}` : `?msg=${open.id}&label=${folder}`;
    api(url).then((d) => {
      const msgs = d.messages || [d]; setThread(msgs);
      const l = msgs[msgs.length - 1]; setStar(Boolean(l?.starred)); setApplied(l?.labelIds || []);
      const unread = msgs.find((x) => x.unread);
      if (unread) api('', { method: 'POST', body: JSON.stringify({ action: 'markRead', id: unread.id, ids: [unread.id], label: folder }) }).then(() => onChanged?.()).catch(() => {});
    }).catch(() => setThread('error'));
  }, [open.id, open.threadId]); // eslint-disable-line
  if (!thread) return <div className="grid place-items-center h-full"><Spinner /></div>;
  if (thread === 'error') return <div className="grid place-items-center h-full text-slate-400">Could not load this message.</div>;
  const last = thread[thread.length - 1];
  const toggleStar = async () => {
    const on = !star; setStar(on);
    if (provider === 'gmail') await api('', { method: 'POST', body: JSON.stringify({ action: 'modifyLabels', id: last.id, add: on ? ['STARRED'] : [], remove: on ? [] : ['STARRED'] }) }).catch(() => {});
    else await api('', { method: 'POST', body: JSON.stringify({ action: on ? 'star' : 'unstar', ids: [last.id], label: folder }) }).catch(() => {});
    onChanged?.();
  };
  const toggleLabel = async (lid) => { const has = applied.includes(lid); setApplied((a) => has ? a.filter((x) => x !== lid) : [...a, lid]); await api('', { method: 'POST', body: JSON.stringify({ action: 'modifyLabels', id: last.id, add: has ? [] : [lid], remove: has ? [lid] : [] }) }).catch(() => {}); };
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="font-bold text-slate-900 dark:text-white truncate">{thread[0].subject || '(no subject)'}</h3><p className="text-[11px] text-slate-400">{thread.length} message{thread.length > 1 ? 's' : ''}</p></div>
        <div className="flex items-center gap-1 shrink-0">
          <button title={star ? 'Unstar' : 'Star'} onClick={toggleStar} className={`p-2 ${star ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}><FiStar fill={star ? 'currentColor' : 'none'} /></button>
          {provider === 'gmail' && (
            <div className="relative">
              <button title="Labels" onClick={() => setLabelMenu((v) => !v)} className="p-2 text-slate-400 hover:text-indigo-600"><FiTag /></button>
              {labelMenu && (
                <div className="absolute right-0 mt-1 w-52 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 p-1.5" onMouseLeave={() => setLabelMenu(false)}>
                  {!labels.length && <p className="text-xs text-slate-400 px-2 py-1.5">No labels yet.</p>}
                  {labels.map((l) => <button key={l.id} onClick={() => toggleLabel(l.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"><span className={`w-4 h-4 rounded grid place-items-center border ${applied.includes(l.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{applied.includes(l.id) ? '✓' : ''}</span><span className="truncate">{l.name}</span></button>)}
                </div>
              )}
            </div>
          )}
          <button title="Reply" onClick={() => onReply(last)} className="p-2 text-slate-400 hover:text-indigo-600"><FiCornerUpLeft /></button>
          <button title="Trash" onClick={async () => { await api('', { method: 'POST', body: JSON.stringify({ action: 'trash', id: last.id, ids: [last.id], label: folder }) }); onChanged?.(true); }} className="p-2 text-slate-400 hover:text-red-500"><FiTrash2 /></button>
          <button title="Close" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700"><FiX /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{thread.map((m, i) => <MessageBlock key={m.id || i} api={api} m={m} folder={folder} defaultOpen={i === thread.length - 1} />)}</div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function GrowthMail() {
  const [status, setStatus] = useState(null); // { provider, configured, connected, email, gmailConfigured }
  const [folder, setFolder] = useState('INBOX');
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextToken, setNextToken] = useState(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [compose, setCompose] = useState(null);
  const [labels, setLabels] = useState([]);
  const [titanLogin, setTitanLogin] = useState(false);
  const [sel, setSel] = useState(() => new Set());

  const provider = status?.provider || null;
  const api = useCallback((path, opts) => mApi(provider, path, opts), [provider]);

  const loadStatus = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([mApi('gmail', '?status=1').catch(() => ({})), mApi('titan', '?status=1').catch(() => ({}))]);
      if (g.connected) setStatus({ provider: 'gmail', connected: true, configured: true, email: g.email, gmailConfigured: g.configured });
      else if (t.connected) setStatus({ provider: 'titan', connected: true, configured: true, email: t.email, gmailConfigured: g.configured });
      else setStatus({ provider: null, connected: false, gmailConfigured: g.configured });
    } catch { setStatus({ provider: null, connected: false, gmailConfigured: false }); }
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('mail')) { window.history.replaceState({}, '', '/growth'); loadStatus(); } }, [loadStatus]);
  useEffect(() => { if (provider === 'gmail') api('?labels=1').then((d) => setLabels(d.labels || [])).catch(() => {}); }, [provider, api]);

  const folders = provider === 'titan' ? TITAN_FOLDERS : GMAIL_FOLDERS;
  const load = useCallback(() => {
    if (!provider) return;
    setLoading(true); setOpen(null); setNextToken(null); setSel(new Set());
    api(`?list=1&label=${folder}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then((d) => { setMsgs(d.messages || []); setNextToken(d.nextPageToken || null); }).catch(() => setMsgs([])).finally(() => setLoading(false));
  }, [provider, folder, q, api]);
  useEffect(() => { load(); }, [folder, provider]); // eslint-disable-line
  const loadMore = () => {
    if (!nextToken) return; setLoadingMore(true);
    const param = provider === 'titan' ? `offset=${nextToken}` : `pageToken=${nextToken}`;
    api(`?list=1&label=${folder}${q ? `&q=${encodeURIComponent(q)}` : ''}&${param}`).then((d) => { setMsgs((c) => [...c, ...(d.messages || [])]); setNextToken(d.nextPageToken || null); }).catch(() => {}).finally(() => setLoadingMore(false));
  };

  const connectGmail = async () => { try { const { url } = await mApi('gmail', '?authurl=1'); window.location.href = url; } catch (e) { window.alert(e.message); } };
  const newLabel = async () => { const name = window.prompt('New label name:'); if (!name?.trim()) return; await api('', { method: 'POST', body: JSON.stringify({ action: 'createLabel', name: name.trim() }) }).catch((e) => window.alert(e.message)); api('?labels=1').then((d) => setLabels(d.labels || [])).catch(() => {}); };
  const replyTo = (m) => setCompose({ to: (m.from || '').replace(/^.*</, '').replace(/>.*$/, '') || m.from, subject: /^re:/i.test(m.subject || '') ? m.subject : `Re: ${m.subject || ''}`, threadId: m.threadId, body: `\n\n----- On ${fmt(m.date)}, ${fromName(m.from)} wrote -----\n` });
  const openDraft = (d) => provider === 'gmail' ? setCompose({ id: d.draftId, to: d.to, subject: d.subject, threadId: d.threadId }) : setOpen({ id: d.id });

  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = msgs.length > 0 && msgs.every((m) => sel.has(m.id || m.draftId));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(msgs.map((m) => m.id || m.draftId)));
  const deleteSelected = async () => {
    const ids = [...sel]; if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} message${ids.length > 1 ? 's' : ''}?`)) return;
    await api('', { method: 'POST', body: JSON.stringify({ action: 'trash', ids, label: folder }) }).catch((e) => window.alert(e.message));
    setSel(new Set()); load();
  };

  if (!status) return <div className="grid place-items-center py-32"><Spinner size={26} /></div>;

  if (!status.connected) {
    return (
      <div className={`${card} p-8 max-w-lg mx-auto text-center`}>
        <FiMail size={30} className="mx-auto text-indigo-400 mb-3" />
        <h3 className="font-bold text-slate-800 dark:text-white">Connect your mailbox</h3>
        <p className="text-sm text-slate-500 mt-2 mb-5">Choose your email provider to send and receive mail inside Growth.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className={btnPrimary} onClick={connectGmail} disabled={!status.gmailConfigured} title={status.gmailConfigured ? '' : 'Gmail not configured by admin'}><FiMail /> Continue with Gmail</button>
          <button className={btnGhost} onClick={() => setTitanLogin(true)}><FiMail /> Sign in with Titan Mail</button>
        </div>
        {!status.gmailConfigured && <p className="text-[11px] text-slate-400 mt-3">Gmail needs admin setup (GOOGLE_CLIENT_ID/SECRET). Titan works with your mailbox login.</p>}
        {titanLogin && <TitanLogin onClose={() => setTitanLogin(false)} onDone={() => { setTitanLogin(false); loadStatus(); }} />}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[200px_360px_1fr] gap-4" style={{ height: 'calc(100vh - 170px)' }}>
      {/* Folders */}
      <div className={`${card} p-2 flex flex-col`}>
        <button className={`${btnPrimary} w-full justify-center mb-2`} onClick={() => setCompose({})}><FiEdit size={14} /> Compose</button>
        {folders.map((fo) => <button key={fo.key} onClick={() => setFolder(fo.key)} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium ${folder === fo.key ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><fo.icon size={15} /> {fo.label}</button>)}
        {provider === 'gmail' && (<>
          <div className="flex items-center justify-between px-3 pt-3 pb-1"><span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Labels</span><button title="New label" onClick={newLabel} className="text-slate-400 hover:text-indigo-600"><FiPlus size={14} /></button></div>
          <div className="overflow-y-auto max-h-44">{labels.map((l) => <button key={l.id} onClick={() => setFolder(l.id)} className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm ${folder === l.id ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><FiTag size={14} /> <span className="truncate">{l.name}</span></button>)}{!labels.length && <p className="px-3 text-[11px] text-slate-400">No labels yet.</p>}</div>
        </>)}
        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 px-1">
          <p className="truncate" title={status.email}>{provider === 'titan' ? 'Titan' : 'Gmail'}: {status.email}</p>
          <p className="text-slate-300 dark:text-slate-600">Disconnect in Settings ⚙</p>
        </div>
      </div>

      {/* List */}
      <div className={`${card} flex flex-col`}>
        <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 flex gap-2 items-center">
          <button title={allSelected ? 'Deselect all' : 'Select all'} onClick={toggleAll} className="p-2 text-slate-400 hover:text-indigo-600">{allSelected ? <FiCheckSquare size={16} /> : <FiSquare size={16} />}</button>
          {sel.size > 0
            ? <><span className="text-xs text-slate-500">{sel.size} selected</span><button className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 font-medium" onClick={deleteSelected}><FiTrash2 className="inline -mt-0.5" size={13} /> Delete</button></>
            : <><div className="relative flex-1"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input className={`${input} pl-9`} placeholder="Search mail…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></div><button className={btnGhost} onClick={load} title="Refresh"><FiRefreshCw className={loading ? 'animate-spin' : ''} size={15} /></button></>}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && !msgs.length && <div className="grid place-items-center py-16"><Spinner /></div>}
          {!loading && !msgs.length && <p className="text-sm text-slate-400 text-center py-16">No messages.</p>}
          {msgs.map((m) => {
            const id = m.id || m.draftId;
            return (
              <div key={id} className={`flex items-start gap-2 px-2.5 py-3 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${open?.id === m.id ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                <button onClick={() => toggleSel(id)} className="mt-0.5 text-slate-400 hover:text-indigo-600 shrink-0">{sel.has(id) ? <FiCheckSquare size={15} /> : <FiSquare size={15} />}</button>
                <button onClick={() => folder === 'DRAFT' || (provider === 'titan' && folder === 'Drafts') ? openDraft(m) : setOpen({ id: m.id, threadId: m.threadId })} className={`flex-1 min-w-0 text-left ${m.unread ? 'font-semibold' : ''}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm text-slate-800 dark:text-slate-100 truncate">{(folder === 'SENT' || folder === 'Sent' || folder === 'DRAFT' || folder === 'Drafts') ? `To: ${fromName(m.to)}` : fromName(m.from)}</span><span className="text-[10px] text-slate-400 shrink-0">{fmt(m.date).split(',')[0]}</span></div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{m.subject || '(no subject)'}</div>
                  {m.snippet && <div className="text-[11px] text-slate-400 truncate">{m.snippet}</div>}
                </button>
              </div>
            );
          })}
          {nextToken && <button onClick={loadMore} disabled={loadingMore} className="w-full py-3 text-sm text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/50">{loadingMore ? 'Loading…' : 'Load more'}</button>}
        </div>
      </div>

      {/* Reader */}
      <div className={`${card} overflow-hidden`}>
        {open ? <Reader api={api} provider={provider} folder={folder} labels={labels} open={open} onClose={() => setOpen(null)} onChanged={(reload) => { if (reload) { setOpen(null); load(); } else load(); }} onReply={replyTo} />
          : <div className="h-full grid place-items-center text-slate-400 text-sm"><div className="text-center"><FiMail size={28} className="mx-auto mb-2 text-slate-300" />Select a message to read</div></div>}
      </div>

      {compose && <Compose api={api} initial={compose} onClose={() => setCompose(null)} onDone={(kind) => { setCompose(null); if (kind === 'send' || folder === 'DRAFT' || folder === 'Drafts') load(); }} />}
    </div>
  );
}
