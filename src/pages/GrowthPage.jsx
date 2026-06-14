// ─────────────────────────────────────────────────────────────────────────────
// Business Growth OS — the AI-powered command center that replaces the legacy
// Marketing Automation module. A single cohesive portal at /growth covering the
// Executive Command Center, CRM (360° contacts), Sales Pipeline, Marketing
// Campaigns, an embedded AI Business Copilot, Tasks and exportable Reports.
// Auth + data reuse the existing team-member session and the /api/business API.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import {
  FiGrid, FiUsers, FiTrendingUp, FiTarget, FiCpu, FiCheckSquare, FiFileText,
  FiLogOut, FiMoon, FiSun, FiPlus, FiX, FiSearch, FiRefreshCw, FiSend, FiTrash2,
  FiDollarSign, FiActivity, FiAlertTriangle, FiArrowRight, FiDownload, FiZap,
  FiEye, FiEyeOff, FiHeart, FiPieChart, FiChevronRight,
  FiCreditCard, FiBriefcase, FiUserCheck, FiEdit2, FiSettings, FiLock,
} from 'react-icons/fi';
import { TbCurrencyRupee, TbCurrencyDollar, TbCurrencyEuro, TbCurrencyPound } from 'react-icons/tb';
import { FiMessageCircle, FiMail, FiMenu, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import GrowthConnect from '../components/GrowthConnect';
import GrowthMail from '../components/GrowthMail';
import { GrowthHubProvider } from '../common/growthHub';
import { PresenceControl, NotificationCenter, enablePush, disablePush } from '../common/growthNotify';
import { FiBell } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import { confirmDialog, Spinner } from '../common/confirm';

/* ── currency (selectable; symbol-aware formatter) ───────────────────────── */
const CURRENCIES = {
  INR: { symbol: '₹', icon: TbCurrencyRupee, locale: 'en-IN' },
  USD: { symbol: '$', icon: TbCurrencyDollar, locale: 'en-US' },
  EUR: { symbol: '€', icon: TbCurrencyEuro, locale: 'en-IE' },
  GBP: { symbol: '£', icon: TbCurrencyPound, locale: 'en-GB' },
};
// Module-level so the formatter is callable without prop-drilling; the shell
// mirrors it into state + remounts content on change so all values reformat.
let CUR = (() => { try { return CURRENCIES[localStorage.getItem('growth-cur')] ? localStorage.getItem('growth-cur') : 'INR'; } catch { return 'INR'; } })();

/* ── helpers ──────────────────────────────────────────────────────────────── */
const inr = (n) => {
  const v = Number(n) || 0;
  const c = CURRENCIES[CUR] || CURRENCIES.INR;
  const s = c.symbol;
  const a = Math.abs(v);
  if (CUR === 'INR') {
    if (a >= 1e7) return `${s}${(v / 1e7).toFixed(2)}Cr`;
    if (a >= 1e5) return `${s}${(v / 1e5).toFixed(2)}L`;
    if (a >= 1e3) return `${s}${(v / 1e3).toFixed(1)}k`;
    return `${s}${v.toLocaleString('en-IN')}`;
  }
  if (a >= 1e9) return `${s}${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}${(v / 1e3).toFixed(1)}K`;
  return `${s}${v.toLocaleString(c.locale)}`;
};
const pct = (n) => `${Math.round(Number(n) || 0)}%`;
const api = (path, opts = {}) => fetchJson(`/api/business${path}`, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  ...opts,
});

const CONTACT_TYPES = ['lead', 'prospect', 'customer', 'partner', 'vendor'];
const CONTACT_STAGES = ['new', 'engaged', 'qualified', 'active', 'at_risk', 'churned'];
const DEAL_STAGES = ['discovery', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const OPEN_STAGES = ['discovery', 'qualified', 'proposal', 'negotiation'];
const CAMPAIGN_CHANNELS = ['email', 'social', 'paid_ads', 'content', 'events', 'referral', 'webinar'];
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'void'];
const EXPENSE_STATUSES = ['pending', 'approved', 'paid', 'rejected'];
const EXPENSE_CATEGORIES = ['marketing', 'salaries', 'software', 'travel', 'office', 'infra', 'other'];
const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Customer Success', 'Finance', 'HR', 'Operations', 'Product'];
const EMP_STATUSES = ['active', 'on_leave', 'probation', 'offboarding', 'terminated'];
const EMP_TYPES = ['full_time', 'part_time', 'contract', 'intern'];

const STATUS_BADGE = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  sent: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  void: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  probation: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  offboarding: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  terminated: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
};

const TYPE_BADGE = {
  lead: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  prospect: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  customer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  partner: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  vendor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};
const healthColor = (h) => (h >= 70 ? 'text-emerald-500' : h >= 45 ? 'text-amber-500' : 'text-red-500');

const card = 'rounded-2xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800';
const input = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const btn = 'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50';
const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-500`;
const btnGhost = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;

/* ── Login gate ───────────────────────────────────────────────────────────── */
function Login({ onAuthed }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      await fetchJson('/api/team-members/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      onAuthed();
    } catch (ex) { setErr(ex.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4">
      <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="grid place-items-center h-11 w-11 rounded-2xl bg-indigo-600 text-white"><FiTrendingUp size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Growth</h1>
            <p className="text-xs text-slate-500">Patience AI · growth command center</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-4 mb-5">Sign in with your Patience AI team account.</p>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Work email</label>
        <input className={`${input} mb-3`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@patienceai.in" required />
        <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
        <div className="relative mb-4">
          <input className={input} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {show ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <button className={`${btnPrimary} w-full justify-center py-2.5`} disabled={loading}>
          {loading ? <Spinner /> : 'Sign in'}
        </button>
      </motion.form>
    </div>
  );
}

/* ── Activate (set password from invite link) ────────────────────────────── */
function Activate({ token, onActivated }) {
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
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      onActivated();
    } catch (ex) { setErr(ex.message); } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4">
      <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="grid place-items-center h-11 w-11 rounded-2xl bg-indigo-600 text-white"><FiTrendingUp size={22} /></div>
          <div><h1 className="text-xl font-bold text-slate-900">Activate your account</h1><p className="text-xs text-slate-500">Set a password to access Growth</p></div>
        </div>
        <p className="text-sm text-slate-500 mt-4 mb-5">Welcome to the Patience AI Business Growth OS. Choose a strong password (min 8 chars, with a letter and a number).</p>
        <label className="block text-xs font-semibold text-slate-600 mb-1">New password</label>
        <div className="relative mb-3">
          <input className={input} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="••••••••" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <FiEyeOff /> : <FiEye />}</button>
        </div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm password</label>
        <input className={`${input} mb-4`} type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" />
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <button className={`${btnPrimary} w-full justify-center py-2.5`} disabled={loading}>{loading ? <Spinner /> : 'Activate & sign in'}</button>
      </motion.form>
    </div>
  );
}

/* ── Settings (change password) ───────────────────────────────────────────── */
function SettingsModal({ onClose, currency, setCurrency }) {
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mail, setMail] = useState(null); // { provider, email } | false
  const [notif, setNotif] = useState({ enabled: true, email: '' });
  const [notifBusy, setNotifBusy] = useState(false);
  useEffect(() => { fetchJson('/api/colleagues?getsettings=1', { credentials: 'include' }).then((d) => setNotif({ enabled: d.notificationsEnabled !== false, email: d.notifyEmail || '' })).catch(() => {}); }, []);
  const togglePush = async () => {
    setNotifBusy(true);
    const next = !notif.enabled;
    try {
      if (next) await enablePush(); else await disablePush();
      await fetchJson('/api/colleagues', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settings', notificationsEnabled: next }) });
      setNotif((n) => ({ ...n, enabled: next }));
    } catch (ex) { window.alert(ex.message); } finally { setNotifBusy(false); }
  };
  const saveNotifyEmail = async () => { await fetchJson('/api/colleagues', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settings', notifyEmail: notif.email }) }).catch(() => {}); };
  const loadMail = () => Promise.all([
    fetchJson('/api/gmail?status=1', { credentials: 'include' }).catch(() => ({})),
    fetchJson('/api/titan?status=1', { credentials: 'include' }).catch(() => ({})),
  ]).then(([g, t]) => setMail(g.connected ? { provider: 'gmail', email: g.email } : t.connected ? { provider: 'titan', email: t.email } : false));
  useEffect(() => { loadMail(); }, []);
  const disconnectMail = async () => {
    if (!mail || !(await confirmDialog({ title: 'Disconnect mailbox', message: `Disconnect ${mail.email} from Growth?`, confirmText: 'Disconnect' }))) return;
    await fetchJson(`/api/${mail.provider}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) }).catch(() => {});
    loadMail();
  };
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.newPassword !== f.confirm) { setErr('New passwords do not match'); return; }
    setSaving(true);
    try {
      await fetchJson('/api/team-members/change-password', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: f.currentPassword, newPassword: f.newPassword }),
      });
      setDone(true); setF({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><FiCreditCard size={15} /> Display currency</h4>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <button key={code} onClick={() => setCurrency(code)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border ${currency === code ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <c.icon size={16} /> {code}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><FiBell size={15} /> Notifications</h4>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-300">Push notifications (new mail, messages &amp; calls)</span>
            <button onClick={togglePush} disabled={notifBusy} className={`relative h-6 w-11 rounded-full transition ${notif.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${notif.enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          <label className="text-xs text-slate-500">Email for away/offline alerts
            <input className={`${input} mt-1`} type="email" placeholder="you@company.com (defaults to login email)" value={notif.email} onChange={(e) => setNotif((n) => ({ ...n, email: e.target.value }))} onBlur={saveNotifyEmail} />
          </label>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><FiMail size={15} /> Connected mailbox</h4>
          {mail === null ? <p className="text-sm text-slate-400">Checking…</p>
            : mail ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
                <div className="min-w-0"><p className="text-sm text-slate-700 dark:text-slate-200 truncate">{mail.email}</p><p className="text-[11px] text-slate-400 capitalize">{mail.provider} Mail</p></div>
                <button onClick={disconnectMail} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 font-medium shrink-0">Disconnect</button>
              </div>
            ) : <p className="text-sm text-slate-400">No mailbox connected. Connect one from the Mail tab.</p>}
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><FiLock size={15} /> Change password</h4>
          {done ? (
            <p className="text-sm text-emerald-600">Password updated successfully.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <input className={input} type={show ? 'text' : 'password'} placeholder="Current password" value={f.currentPassword} onChange={set('currentPassword')} required />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <FiEyeOff /> : <FiEye />}</button>
              </div>
              <input className={input} type={show ? 'text' : 'password'} placeholder="New password (min 8 chars)" value={f.newPassword} onChange={set('newPassword')} required minLength={8} />
              <input className={input} type={show ? 'text' : 'password'} placeholder="Confirm new password" value={f.confirm} onChange={set('confirm')} required />
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div className="flex justify-end"><button className={btnPrimary} disabled={saving}>{saving ? <Spinner /> : 'Update password'}</button></div>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── Reusable bits ─────────────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, tint = 'bg-indigo-500', delta, onClick }) {
  return (
    <div onClick={onClick}
      className={`${card} p-4 ${onClick ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`grid place-items-center h-8 w-8 rounded-lg text-white ${tint}`}><Icon size={16} /></span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      {delta != null && <div className={`mt-1 text-xs font-semibold ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</div>}
      {onClick && <div className="mt-1 text-[10px] text-indigo-400">Click for details →</div>}
    </div>
  );
}

// Metric detail modal: big value + an (i) info toggle that reveals the exact
// calculation rule and validation checks, plus an optional breakdown / CRUD body.
function MetricModal({ title, value, sub, rule, validations, onClose, children }) {
  const [info, setInfo] = useState(false);
  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="flex items-start gap-3 -mt-2 mb-4">
        <div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
        {(rule || validations) && (
          <button title="How is this calculated?" onClick={() => setInfo((v) => !v)}
            className={`ml-auto grid place-items-center h-9 w-9 rounded-full border text-sm font-bold ${info ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            i
          </button>
        )}
      </div>
      {info && (rule || validations) && (
        <div className="mb-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 p-3.5 text-sm">
          {rule && <div className="mb-2"><div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500 mb-1">Calculation</div><p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-mono text-xs leading-relaxed">{rule}</p></div>}
          {validations?.length > 0 && (
            <div><div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500 mb-1">Validation checks</div>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300 text-xs">{validations.map((v, i) => <li key={i}>{v}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {children}
    </Modal>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()} className={`${card} w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] overflow-y-auto p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX /></button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Read-only detail modal with explicit CRUD icon buttons (read shown, update +
// delete actions). Reused by cards & chips across the portal.
function DetailModal({ title, subtitle, fields, onClose, onEdit, onDelete, wide }) {
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <div className="flex items-center gap-2 mb-4 -mt-2">
        {subtitle && <span className="text-sm text-slate-400">{subtitle}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {onEdit && <button title="Edit" onClick={onEdit} className="grid place-items-center h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"><FiEdit2 size={16} /></button>}
          {onDelete && <button title="Delete" onClick={onDelete} className="grid place-items-center h-9 w-9 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"><FiTrash2 size={16} /></button>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        {fields.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => (
          <div key={k} className="min-w-0"><dt className="text-xs text-slate-400">{k}</dt><dd className="text-slate-800 dark:text-slate-100 font-medium break-words">{v}</dd></div>
        ))}
      </dl>
    </Modal>
  );
}

const chartTheme = (dark) => ({
  textStyle: { color: dark ? '#cbd5e1' : '#475569', fontFamily: 'inherit' },
  grid: { left: 50, right: 20, top: 30, bottom: 30 },
});

/* ── Command Center ───────────────────────────────────────────────────────── */
function CommandCenter({ dark }) {
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState(null);
  const load = useCallback(() => { setLoading(true); api('/metrics').then(setM).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);

  if (loading && !m) return <div className="grid place-items-center py-32"><Spinner size={28} /></div>;
  if (!m) return null;
  const h = m.headline;
  const empty = m.counts.contacts === 0 && m.counts.deals === 0;

  const revenueOpt = {
    ...chartTheme(dark), tooltip: { trigger: 'axis' }, legend: { data: ['Revenue', 'Forecast'], top: 0, textStyle: { color: dark ? '#94a3b8' : '#64748b' } },
    xAxis: { type: 'category', data: [...m.revenueTrend, ...m.forecast].map((r) => r.month.slice(2)), axisLine: { lineStyle: { color: dark ? '#334155' : '#e2e8f0' } } },
    yAxis: { type: 'value', axisLabel: { formatter: (v) => inr(v) }, splitLine: { lineStyle: { color: dark ? '#1e293b' : '#f1f5f9' } } },
    series: [
      { name: 'Revenue', type: 'line', smooth: true, data: [...m.revenueTrend.map((r) => r.revenue), ...m.forecast.map(() => null)], areaStyle: { opacity: 0.15 }, itemStyle: { color: '#6366f1' }, lineStyle: { width: 3 } },
      { name: 'Forecast', type: 'line', smooth: true, lineStyle: { type: 'dashed', color: '#f59e0b', width: 3 }, itemStyle: { color: '#f59e0b' },
        data: [...m.revenueTrend.map(() => null).slice(0, -1), m.revenueTrend.at(-1)?.revenue, ...m.forecast.map((r) => r.revenue)] },
    ],
  };
  const funnelOpt = {
    ...chartTheme(dark), tooltip: { trigger: 'item', formatter: (p) => `${p.name}<br/>${p.value} deals` },
    series: [{ type: 'funnel', left: '5%', right: '5%', top: 10, bottom: 10, minSize: '20%', label: { color: dark ? '#cbd5e1' : '#475569' },
      data: m.funnel.map((f, i) => ({ name: `${f.stage} (${inr(f.value)})`, value: f.count || 0.1, itemStyle: { color: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef'][i] } })) }],
  };
  const channelOpt = {
    ...chartTheme(dark), tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, legend: { top: 0, textStyle: { color: dark ? '#94a3b8' : '#64748b' } },
    xAxis: { type: 'category', data: m.byChannel.map((c) => c.channel), axisLabel: { interval: 0, rotate: 20 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v) => inr(v) } },
    series: [
      { name: 'Spend', type: 'bar', data: m.byChannel.map((c) => c.spend), itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] } },
      { name: 'Revenue', type: 'bar', data: m.byChannel.map((c) => c.revenue), itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } },
    ],
  };
  const gaugeOpt = {
    series: [{ type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: 100, progress: { show: true, width: 14, itemStyle: { color: h.healthScore >= 70 ? '#10b981' : h.healthScore >= 45 ? '#f59e0b' : '#ef4444' } },
      axisLine: { lineStyle: { width: 14, color: [[1, dark ? '#1e293b' : '#f1f5f9']] } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
      anchor: { show: false }, detail: { valueAnimation: true, fontSize: 30, fontWeight: 'bold', offsetCenter: [0, 0], color: dark ? '#f8fafc' : '#0f172a', formatter: '{value}' },
      data: [{ value: h.healthScore }] }],
  };

  return (
    <div className="space-y-5">
      {empty && (
        <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-800 p-5">
          <p className="font-semibold text-slate-900 dark:text-white">Your Growth workspace is empty.</p>
          <p className="text-sm text-slate-500">Add your first contacts, deals, campaigns, invoices or employees from each tab to populate the dashboards and AI copilot.</p>
        </div>
      )}

      <div className="flex items-stretch gap-4 flex-wrap">
        <div className={`${card} p-5 flex items-center gap-5 flex-1 min-w-[260px]`}>
          <div className="w-28 h-28 shrink-0"><ReactECharts option={gaugeOpt} style={{ height: 112, width: 112 }} notMerge /></div>
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-sm"><FiHeart /> Business Health Score</div>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">Composite of pipeline strength, retention, marketing efficiency & win rate.</p>
            <div className="flex gap-3 mt-2 text-xs">
              <span>Pipeline <b className="text-slate-700 dark:text-slate-200">{m.signals.pipelineHealth}</b></span>
              <span>Retention <b className="text-slate-700 dark:text-slate-200">{m.signals.retentionHealth}</b></span>
              <span>Efficiency <b className="text-slate-700 dark:text-slate-200">{m.signals.efficiency}</b></span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={FiDollarSign} label="Revenue (6mo)" value={inr(h.revenue)} tint="bg-emerald-500" onClick={() => setMetric('revenue')} />
        <KpiCard icon={FiTarget} label="Open pipeline" value={inr(h.pipelineValue)} sub={`weighted ${inr(h.weightedPipeline)}`} tint="bg-indigo-500" onClick={() => setMetric('pipeline')} />
        <KpiCard icon={FiActivity} label="Win rate" value={pct(h.winRate)} sub={`${h.openDeals} open deals`} tint="bg-violet-500" onClick={() => setMetric('winRate')} />
        <KpiCard icon={FiUsers} label="Customers" value={h.customers} sub={`${h.leads} leads`} tint="bg-sky-500" onClick={() => setMetric('customers')} />
        <KpiCard icon={FiAlertTriangle} label="At-risk" value={h.atRisk} sub={`retention ${pct(h.retention)}`} tint="bg-red-500" onClick={() => setMetric('atRisk')} />
        <KpiCard icon={FiPieChart} label="ROAS / CAC" value={`${h.roas}x`} sub={`CAC ${inr(h.cac)}`} tint="bg-amber-500" onClick={() => setMetric('roas')} />
      </div>
      {metric && (() => {
        const cfg = {
          revenue: { title: 'Revenue (6 months)', value: inr(h.revenue), rule: "revenue = Σ(deal.value WHERE status='won') over last 6 months",
            validations: ['Only won deals are counted.', 'Attributed to the close month (or last-updated month if no close date set).'],
            body: <ul className="space-y-1 text-sm">{m.revenueTrend.map((r) => <li key={r.month} className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40"><span>{r.month}</span><span className="font-medium">{inr(r.revenue)}</span></li>)}</ul> },
          pipeline: { title: 'Open pipeline', value: inr(h.pipelineValue), sub: `weighted ${inr(h.weightedPipeline)}`, rule: 'open_pipeline = Σ(value of open deals)\nweighted = Σ(value × probability ÷ 100)',
            validations: ['Open = stage in discovery/qualified/proposal/negotiation.', 'Probability must be 0–100%.', 'Won/lost deals are excluded.'],
            body: <ul className="space-y-1 text-sm">{m.funnel.map((s) => <li key={s.stage} className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 capitalize"><span>{s.stage} ({s.count})</span><span className="font-medium">{inr(s.value)}</span></li>)}</ul> },
          winRate: { title: 'Win rate', value: pct(h.winRate), sub: `${m.counts.won} won · ${m.counts.lost} lost`, rule: 'win_rate = won ÷ (won + lost) × 100',
            validations: ['Still-open deals are excluded from the ratio.', 'A deal moved to "won"/"lost" sets status automatically.'] },
          customers: { title: 'Customers', value: h.customers, sub: `${h.leads} leads/prospects`, rule: "customers = COUNT(contacts WHERE type='customer')",
            validations: ['Type ∈ lead, prospect, customer, partner, vendor.', 'Leads & prospects are tracked separately.'] },
          atRisk: { title: 'At-risk customers', value: h.atRisk, sub: `retention ${pct(h.retention)}`, rule: "at_risk = contacts WHERE stage='at_risk' OR (type='customer' AND health < 50)",
            validations: ['Health is 0–100; below 50 flags risk.', 'Retention = (customers − churned) ÷ (customers + churned) × 100.'] },
          roas: { title: 'ROAS / CAC', value: `${h.roas}x`, sub: `CAC ${inr(h.cac)}`, rule: 'ROAS = campaign_revenue ÷ campaign_spend\nCAC = total_spend ÷ conversions',
            validations: ['Spend must be > 0 to compute ROAS.', 'Conversions must be > 0 to compute CAC.', 'Aggregated across all campaigns.'],
            body: <ul className="space-y-1 text-sm">{m.byChannel.map((c) => <li key={c.channel} className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 capitalize"><span>{c.channel}</span><span className="font-medium">{inr(c.revenue)} / {inr(c.spend)}</span></li>)}{!m.byChannel.length && <li className="text-slate-400 text-center py-3">No campaign data.</li>}</ul> },
        }[metric];
        return <MetricModal title={cfg.title} value={cfg.value} sub={cfg.sub} rule={cfg.rule} validations={cfg.validations} onClose={() => setMetric(null)}>{cfg.body}</MetricModal>;
      })()}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className={`${card} p-4 lg:col-span-2`}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2"><FiTrendingUp /> Revenue trend & forecast</h3>
          <ReactECharts option={revenueOpt} style={{ height: 280 }} notMerge />
        </div>
        <div className={`${card} p-4`}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2"><FiTarget /> Pipeline funnel</h3>
          <ReactECharts option={funnelOpt} style={{ height: 280 }} notMerge />
        </div>
      </div>

      {m.byChannel.length > 0 && (
        <div className={`${card} p-4`}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2"><FiPieChart /> Marketing spend vs revenue by channel</h3>
          <ReactECharts option={channelOpt} style={{ height: 260 }} notMerge />
        </div>
      )}

      <AiInsightStrip />
    </div>
  );
}

/* ── AI executive summary strip (reused on dashboard) ─────────────────────── */
function AiInsightStrip() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const run = useCallback(() => {
    setLoading(true);
    api('/ai', { method: 'POST', body: JSON.stringify({ question: 'Give a crisp executive summary and the single most important action this week.' }) })
      .then((r) => setText(r.answer)).catch(() => setText('AI summary unavailable.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { run(); }, [run]);
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2"><FiZap /> AI Executive Brief</h3>
        <button onClick={run} className="text-white/80 hover:text-white"><FiRefreshCw className={loading ? 'animate-spin' : ''} /></button>
      </div>
      <p className="text-sm leading-relaxed text-indigo-50 whitespace-pre-wrap min-h-[40px]">{loading ? 'Analysing your live business data…' : text}</p>
    </div>
  );
}

/* ── CRM ──────────────────────────────────────────────────────────────────── */
function Crm({ reload }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => { setLoading(true); api('/contacts').then((r) => setRows(r.contacts || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) =>
    (filter === 'all' || r.type === filter) &&
    (`${r.name} ${r.company || ''} ${r.email || ''}`.toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, filter]);

  const save = async (data) => {
    if (data.id) await api('/contacts', { method: 'PATCH', body: JSON.stringify(data) });
    else await api('/contacts', { method: 'POST', body: JSON.stringify(data) });
    setEditing(null); load(); reload?.();
  };
  const remove = async (id) => {
    if (!(await confirmDialog({ title: 'Delete contact', message: 'Remove this contact and its activity history?', confirmText: 'Delete' }))) return;
    await api(`/contacts?id=${id}`, { method: 'DELETE' }); load(); reload?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${input} pl-9`} placeholder="Search name, company, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${input} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All types</option>
          {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className={btnPrimary} onClick={() => setEditing({})}><FiPlus /> Add contact</button>
      </div>

      <div className={`${card} overflow-hidden`}>
        {loading ? <div className="grid place-items-center py-20"><Spinner size={24} /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Stage</th><th className="text-right px-4 py-3">Value</th><th className="text-center px-4 py-3">Health</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setView(r)}>
                  <td className="px-4 py-3"><div className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</div><div className="text-xs text-slate-400">{r.company || r.email}</div></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[r.type]}`}>{r.type}</span></td>
                  <td className="px-4 py-3 text-slate-500">{(r.stage || '').replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-200">{inr(r.value)}</td>
                  <td className={`px-4 py-3 text-center font-bold ${healthColor(r.health)}`}>{r.health}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button className="text-slate-400 hover:text-red-500" onClick={() => remove(r.id)}><FiTrash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan="6" className="text-center py-12 text-slate-400">No contacts.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {editing && <ContactForm initial={editing} onClose={() => setEditing(null)} onSave={save} />}
      {view && <ContactDrawer contact={view} onClose={() => setView(null)} onEdit={() => { setEditing(view); setView(null); }} />}
    </div>
  );
}

function ContactForm({ initial, onClose, onSave }) {
  const [f, setF] = useState({ name: '', email: '', company: '', phone: '', type: 'lead', stage: 'new', value: 0, health: 70, notes: '', ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setSaving(true); try { await onSave(f); } finally { setSaving(false); } };
  return (
    <Modal title={initial.id ? 'Edit contact' : 'New contact'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="Full name" value={f.name} onChange={set('name')} required />
          <input className={input} placeholder="Company" value={f.company || ''} onChange={set('company')} />
          <input className={input} placeholder="Email" type="email" value={f.email || ''} onChange={set('email')} />
          <input className={input} placeholder="Phone" value={f.phone || ''} onChange={set('phone')} />
          <select className={input} value={f.type} onChange={set('type')}>{CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <select className={input} value={f.stage} onChange={set('stage')}>{CONTACT_STAGES.map((t) => <option key={t}>{t}</option>)}</select>
          <label className="text-xs text-slate-500">Annual value (₹)<input className={input} type="number" value={f.value} onChange={set('value')} /></label>
          <label className="text-xs text-slate-500">Health (0-100)<input className={input} type="number" min="0" max="100" value={f.health} onChange={set('health')} /></label>
        </div>
        <textarea className={input} rows="3" placeholder="Notes…" value={f.notes || ''} onChange={set('notes')} />
        <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={saving}>{saving ? <Spinner /> : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

function ContactDrawer({ contact, onClose, onEdit }) {
  const [acts, setActs] = useState([]);
  const [note, setNote] = useState('');
  const load = useCallback(() => api(`/activities?contact_id=${contact.id}`).then((r) => setActs(r.activities || [])).catch(() => {}), [contact.id]);
  useEffect(() => { load(); }, [load]);
  const addNote = async () => {
    if (!note.trim()) return;
    await api('/activities', { method: 'POST', body: JSON.stringify({ contact_id: contact.id, type: 'note', subject: note.slice(0, 80), body: note }) });
    setNote(''); load();
  };
  return (
    <Modal title={contact.name} onClose={onClose} wide>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[contact.type]}`}>{contact.type}</span>
            <span className="text-xs text-slate-400">{(contact.stage || '').replace('_', ' ')}</span>
            <span className={`ml-auto font-bold ${healthColor(contact.health)}`}>♥ {contact.health}</span>
          </div>
          <dl className="text-sm space-y-1.5 text-slate-600 dark:text-slate-300">
            <div className="flex justify-between"><dt className="text-slate-400">Company</dt><dd>{contact.company || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Email</dt><dd>{contact.email || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Phone</dt><dd>{contact.phone || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Annual value</dt><dd className="font-semibold">{inr(contact.value)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Lead score</dt><dd>{contact.score}</dd></div>
          </dl>
          {contact.notes && <p className="mt-3 text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 whitespace-pre-wrap">{contact.notes}</p>}
          <button className={`${btnGhost} mt-4`} onClick={onEdit}>Edit contact</button>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Activity timeline</h4>
          <div className="flex gap-2 mb-3">
            <input className={input} placeholder="Log a note / call / email…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
            <button className={btnPrimary} onClick={addNote}><FiSend /></button>
          </div>
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {acts.map((a) => (
              <li key={a.id} className="text-sm border-l-2 border-indigo-400 pl-3">
                <div className="font-medium text-slate-700 dark:text-slate-200">{a.subject || a.type}</div>
                {a.body && a.body !== a.subject && <div className="text-slate-500">{a.body}</div>}
                <div className="text-xs text-slate-400">{a.type} · {new Date(a.created_at).toLocaleString('en-IN')}</div>
              </li>
            ))}
            {!acts.length && <li className="text-sm text-slate-400">No activity yet.</li>}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

/* ── Pipeline (kanban) ────────────────────────────────────────────────────── */
function Pipeline({ reload }) {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const load = useCallback(() => {
    api('/deals').then((r) => setDeals(r.deals || [])).catch(() => {});
    api('/contacts').then((r) => setContacts(r.contacts || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const move = async (deal, stage) => { await api('/deals', { method: 'PATCH', body: JSON.stringify({ id: deal.id, stage }) }); load(); reload?.(); };
  const save = async (data) => {
    if (data.id) await api('/deals', { method: 'PATCH', body: JSON.stringify(data) });
    else await api('/deals', { method: 'POST', body: JSON.stringify(data) });
    setEditing(null); load(); reload?.();
  };
  const remove = async (id) => {
    if (!(await confirmDialog({ title: 'Delete deal', message: 'Delete this opportunity?', confirmText: 'Delete' }))) return;
    await api(`/deals?id=${id}`, { method: 'DELETE' }); load(); reload?.();
  };

  const open = deals.filter((d) => d.status === 'open');
  const stageTotal = (st) => inr(open.filter((d) => d.stage === st).reduce((s, d) => s + Number(d.value || 0), 0));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{open.length} open · {deals.filter((d) => d.status === 'won').length} won · {deals.filter((d) => d.status === 'lost').length} lost</p>
        <button className={btnPrimary} onClick={() => setEditing({})}><FiPlus /> New deal</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {OPEN_STAGES.map((st) => (
          <div key={st} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-3 min-h-[200px]">
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold uppercase text-slate-500">{st}</span><span className="text-xs text-slate-400">{stageTotal(st)}</span></div>
            <div className="space-y-2">
              {open.filter((d) => d.stage === st).map((d) => (
                <div key={d.id} className={`${card} p-3`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 cursor-pointer hover:text-indigo-600" onClick={() => setViewing(d)}>{d.title}</div>
                    <button className="text-slate-300 hover:text-red-500" onClick={() => remove(d.id)}><FiTrash2 size={13} /></button>
                  </div>
                  <div className="text-xs text-slate-400 cursor-pointer" onClick={() => setViewing(d)}>{d.contact_company || d.contact_name || '—'}</div>
                  <div className="flex items-center justify-between mt-2 cursor-pointer" onClick={() => setViewing(d)}>
                    <span className="font-bold text-sm text-emerald-600">{inr(d.value)}</span>
                    <span className="text-xs text-slate-400">{d.probability}%</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {st !== 'discovery' && <button className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700" onClick={() => move(d, OPEN_STAGES[OPEN_STAGES.indexOf(st) - 1])}>←</button>}
                    {st !== 'negotiation' && <button className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700" onClick={() => move(d, OPEN_STAGES[OPEN_STAGES.indexOf(st) + 1])}>→</button>}
                    <button className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 ml-auto" onClick={() => move(d, 'won')}>Win</button>
                    <button className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700" onClick={() => move(d, 'lost')}>Lost</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {viewing && (
        <DetailModal title={viewing.title} subtitle={(viewing.stage || '').replace('_', ' ')} onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onDelete={async () => { await remove(viewing.id); setViewing(null); }}
          fields={[['Contact', viewing.contact_name || '—'], ['Company', viewing.contact_company || '—'], ['Stage', viewing.stage],
            ['Status', viewing.status], ['Value', inr(viewing.value)], ['Probability', `${viewing.probability}%`],
            ['Close date', viewing.close_date ? new Date(viewing.close_date).toLocaleDateString('en-IN') : ''], ['Owner', viewing.owner_email]]} />
      )}
      {editing && <DealForm initial={editing} contacts={contacts} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function DealForm({ initial, contacts, onClose, onSave }) {
  const [f, setF] = useState({ title: '', stage: 'discovery', value: 0, probability: 20, contact_id: '', ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ ...f, contact_id: f.contact_id || null }); } finally { setSaving(false); } };
  return (
    <Modal title={initial.id ? 'Edit deal' : 'New deal'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className={input} placeholder="Deal title" value={f.title} onChange={set('title')} required />
        <select className={input} value={f.contact_id || ''} onChange={set('contact_id')}>
          <option value="">— Link a contact —</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <select className={input} value={f.stage} onChange={set('stage')}>{DEAL_STAGES.map((t) => <option key={t}>{t}</option>)}</select>
          <label className="text-xs text-slate-500">Value (₹)<input className={input} type="number" value={f.value} onChange={set('value')} /></label>
          <label className="text-xs text-slate-500">Prob %<input className={input} type="number" min="0" max="100" value={f.probability} onChange={set('probability')} /></label>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={saving}>{saving ? <Spinner /> : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

/* ── Campaigns ────────────────────────────────────────────────────────────── */
function Campaigns() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const load = useCallback(() => api('/campaigns').then((r) => setRows(r.campaigns || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const save = async (data) => {
    if (data.id) await api('/campaigns', { method: 'PATCH', body: JSON.stringify(data) });
    else await api('/campaigns', { method: 'POST', body: JSON.stringify(data) });
    setEditing(null); load();
  };
  const remove = async (id) => {
    if (!(await confirmDialog({ title: 'Delete campaign', message: 'Delete this campaign?', confirmText: 'Delete' }))) return;
    await api(`/campaigns?id=${id}`, { method: 'DELETE' }); load();
  };
  const roas = (c) => (Number(c.spend) ? (Number(c.revenue) / Number(c.spend)).toFixed(1) : '—');
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className={btnPrimary} onClick={() => setEditing({})}><FiPlus /> New campaign</button></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((c) => (
          <div key={c.id} className={`${card} p-4 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition`} onClick={() => setViewing(c)}>
            <div className="flex justify-between items-start">
              <div><div className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</div><div className="text-xs text-slate-400">{c.channel} · {c.status}</div></div>
              <button className="text-slate-300 hover:text-red-500" onClick={(e) => { e.stopPropagation(); remove(c.id); }}><FiTrash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div><div className="text-xs text-slate-400">Spend</div><div className="font-medium">{inr(c.spend)}</div></div>
              <div><div className="text-xs text-slate-400">Revenue</div><div className="font-medium text-emerald-600">{inr(c.revenue)}</div></div>
              <div><div className="text-xs text-slate-400">Leads</div><div className="font-medium">{c.leads}</div></div>
              <div><div className="text-xs text-slate-400">ROAS</div><div className="font-bold text-indigo-600">{roas(c)}x</div></div>
            </div>
            <p className="text-xs text-slate-400 mt-3">Click for details &amp; actions →</p>
          </div>
        ))}
        {!rows.length && <p className="text-slate-400 text-sm col-span-full text-center py-12">No campaigns yet.</p>}
      </div>
      {viewing && (
        <DetailModal title={viewing.name} subtitle={`${viewing.channel} · ${viewing.status}`} onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
          onDelete={async () => { await remove(viewing.id); setViewing(null); }}
          fields={[['Channel', viewing.channel], ['Status', viewing.status], ['Budget', inr(viewing.budget)], ['Spend', inr(viewing.spend)],
            ['Revenue', inr(viewing.revenue)], ['Leads', viewing.leads], ['Conversions', viewing.conversions], ['ROAS', `${roas(viewing)}x`],
            ['Start', viewing.start_date ? new Date(viewing.start_date).toLocaleDateString('en-IN') : ''], ['End', viewing.end_date ? new Date(viewing.end_date).toLocaleDateString('en-IN') : '']]} />
      )}
      {editing && <CampaignForm initial={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function CampaignForm({ initial, onClose, onSave }) {
  const [f, setF] = useState({ name: '', channel: 'email', status: 'draft', budget: 0, spend: 0, leads: 0, conversions: 0, revenue: 0, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setSaving(true); try { await onSave(f); } finally { setSaving(false); } };
  return (
    <Modal title={initial.id ? 'Edit campaign' : 'New campaign'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className={input} placeholder="Campaign name" value={f.name} onChange={set('name')} required />
        <div className="grid grid-cols-2 gap-3">
          <select className={input} value={f.channel} onChange={set('channel')}>{CAMPAIGN_CHANNELS.map((t) => <option key={t}>{t}</option>)}</select>
          <select className={input} value={f.status} onChange={set('status')}>{['draft', 'scheduled', 'active', 'paused', 'completed'].map((t) => <option key={t}>{t}</option>)}</select>
          {['budget', 'spend', 'leads', 'conversions', 'revenue'].map((k) => (
            <label key={k} className="text-xs text-slate-500 capitalize">{k}<input className={input} type="number" value={f[k]} onChange={set(k)} /></label>
          ))}
        </div>
        <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={saving}>{saving ? <Spinner /> : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

/* ── AI Copilot ───────────────────────────────────────────────────────────── */
const SUGGESTED = [
  'Why might revenue change next quarter?',
  'Which customers are at risk and why?',
  'Which campaigns perform best?',
  'What should we focus on this week?',
  'Where is my pipeline leaking?',
];
function Copilot() {
  const [msgs, setMsgs] = useState([{ role: 'ai', text: 'Hi — I\'m your AI business copilot. Ask me anything about revenue, pipeline, customers or campaigns. I answer from your live data.' }]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  const ask = async (question) => {
    const text = (question || q).trim();
    if (!text || loading) return;
    setMsgs((m) => [...m, { role: 'user', text }]); setQ(''); setLoading(true);
    try {
      const r = await api('/ai', { method: 'POST', body: JSON.stringify({ question: text }) });
      setMsgs((m) => [...m, { role: 'ai', text: r.answer }]);
    } catch (e) { setMsgs((m) => [...m, { role: 'ai', text: `Error: ${e.message}` }]); } finally { setLoading(false); }
  };

  return (
    <div className={`${card} flex flex-col h-[calc(100vh-180px)]`}>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="flex gap-2 text-slate-400 text-sm items-center"><Spinner /> Thinking…</div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 p-4">
        <div className="flex gap-2 flex-wrap mb-3">{SUGGESTED.map((s) => <button key={s} onClick={() => ask(s)} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-500">{s}</button>)}</div>
        <div className="flex gap-2">
          <input className={input} placeholder="Ask your business anything…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <button className={btnPrimary} onClick={() => ask()} disabled={loading}><FiSend /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Tasks ────────────────────────────────────────────────────────────────── */
function Tasks() {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState('');
  const load = useCallback(() => api('/tasks').then((r) => setRows(r.tasks || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!title.trim()) return; await api('/tasks', { method: 'POST', body: JSON.stringify({ title }) }); setTitle(''); load(); };
  const toggle = async (t) => { await api('/tasks', { method: 'PATCH', body: JSON.stringify({ id: t.id, status: t.status === 'done' ? 'open' : 'done' }) }); load(); };
  const remove = async (id) => { if (!(await confirmDialog({ title: 'Delete task', message: 'Delete this task?', confirmText: 'Delete' }))) return; await api(`/tasks?id=${id}`, { method: 'DELETE' }); load(); };
  return (
    <div className={`${card} p-5 max-w-2xl`}>
      <div className="flex gap-2 mb-4">
        <input className={input} placeholder="Add a follow-up / task…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className={btnPrimary} onClick={add}><FiPlus /></button>
      </div>
      <ul className="space-y-2">
        {rows.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <input type="checkbox" checked={t.status === 'done'} onChange={() => toggle(t)} className="h-4 w-4 accent-indigo-600" />
            <span className={`flex-1 text-sm ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{t.title}</span>
            {t.due_date && <span className="text-xs text-slate-400">{new Date(t.due_date).toLocaleDateString('en-IN')}</span>}
            <button className="text-slate-300 hover:text-red-500" onClick={() => remove(t.id)}><FiTrash2 size={14} /></button>
          </li>
        ))}
        {!rows.length && <li className="text-sm text-slate-400 text-center py-8">No tasks. Add a follow-up above.</li>}
      </ul>
    </div>
  );
}

/* ── Reports ──────────────────────────────────────────────────────────────── */
function Reports() {
  const [m, setM] = useState(null);
  useEffect(() => { api('/metrics').then(setM).catch(() => {}); }, []);
  const exportCsv = (name, rows) => {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const dl = async (resource) => { const r = await api(`/${resource}`); exportCsv(resource, r[resource] || []); };
  if (!m) return <div className="grid place-items-center py-32"><Spinner size={24} /></div>;
  const h = m.headline;
  const reports = [
    { key: 'contacts', label: 'Customer & lead report', desc: 'Full CRM export with health & value' },
    { key: 'deals', label: 'Sales pipeline report', desc: 'All opportunities, stages & probability' },
    { key: 'campaigns', label: 'Marketing performance report', desc: 'Spend, leads, conversions & ROAS' },
    { key: 'invoices', label: 'Invoices / receivables report', desc: 'All invoices with amount, tax & status' },
    { key: 'expenses', label: 'Expenses / payables report', desc: 'All expenses by category & status' },
    { key: 'employees', label: 'HR headcount report', desc: 'Full employee directory & payroll' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-3">
        {reports.map((r) => (
          <div key={r.key} className={`${card} p-5`}>
            <FiFileText className="text-indigo-500 mb-2" size={22} />
            <div className="font-semibold text-slate-800 dark:text-slate-100">{r.label}</div>
            <div className="text-xs text-slate-400 mb-3">{r.desc}</div>
            <button className={btnGhost} onClick={() => dl(r.key)}><FiDownload /> Export CSV</button>
          </div>
        ))}
      </div>
      <div className={`${card} p-5`}>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Executive summary snapshot</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[['Revenue (6mo)', inr(h.revenue)], ['Open pipeline', inr(h.pipelineValue)], ['Win rate', pct(h.winRate)], ['Customers', h.customers],
            ['Conversion', pct(h.conversionRate)], ['Retention', pct(h.retention)], ['LTV', inr(h.ltv)], ['Health score', `${h.healthScore}/100`]].map(([k, v]) => (
            <div key={k}><div className="text-xs text-slate-400">{k}</div><div className="text-lg font-bold text-slate-800 dark:text-white">{v}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Accounts (finance: invoices + expenses) ──────────────────────────────── */
function Accounts({ reload }) {
  const [invoicesData, setInvoices] = useState([]);
  const [expensesData, setExpenses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [m, setM] = useState(null);
  const [editInv, setEditInv] = useState(null);
  const [editExp, setEditExp] = useState(null);
  const [metric, setMetric] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api('/invoices').then((r) => setInvoices(r.invoices || [])),
      api('/expenses').then((r) => setExpenses(r.expenses || [])),
      api('/contacts').then((r) => setContacts(r.contacts || [])),
      api('/metrics').then(setM),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveInv = async (d) => { await api('/invoices', { method: d.id ? 'PATCH' : 'POST', body: JSON.stringify(d) }); setEditInv(null); load(); reload?.(); };
  const saveExp = async (d) => { await api('/expenses', { method: d.id ? 'PATCH' : 'POST', body: JSON.stringify(d) }); setEditExp(null); load(); reload?.(); };
  const delInv = async (id) => { if (!(await confirmDialog({ title: 'Delete invoice', message: 'Delete this invoice?', confirmText: 'Delete' }))) return; await api(`/invoices?id=${id}`, { method: 'DELETE' }); load(); reload?.(); };
  const delExp = async (id) => { if (!(await confirmDialog({ title: 'Delete expense', message: 'Delete this expense?', confirmText: 'Delete' }))) return; await api(`/expenses?id=${id}`, { method: 'DELETE' }); load(); reload?.(); };

  const f = m?.finance;
  if (loading && !f) return <div className="grid place-items-center py-32"><Spinner size={24} /></div>;
  return (
    <div className="space-y-5">
      {f && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={CURRENCIES[CUR]?.icon || FiDollarSign} label="Collected" value={inr(f.collected)} tint="bg-emerald-500" onClick={() => setMetric('collected')} />
          <KpiCard icon={FiFileText} label="Outstanding AR" value={inr(f.outstanding)} sub={`overdue ${inr(f.overdueAr)}`} tint="bg-amber-500" onClick={() => setMetric('outstanding')} />
          <KpiCard icon={FiCreditCard} label="Expenses paid" value={inr(f.expensesPaid)} sub={`pending ${inr(f.expensePending)}`} tint="bg-slate-500" onClick={() => setMetric('expenses')} />
          <KpiCard icon={FiTrendingUp} label="Net cashflow" value={inr(f.netCashflow)} tint={f.netCashflow >= 0 ? 'bg-emerald-500' : 'bg-red-500'} onClick={() => setMetric('net')} />
          <KpiCard icon={FiActivity} label="Invoices" value={invoicesData.length} tint="bg-indigo-500" onClick={() => setMetric('collected')} />
          <KpiCard icon={FiPieChart} label="Expense items" value={expensesData.length} tint="bg-violet-500" onClick={() => setMetric('expenses')} />
        </div>
      )}
      {metric && f && (() => {
        const cfg = {
          collected: { title: 'Collected revenue', value: inr(f.collected), rule: "collected = Σ(amount + tax) of invoices WHERE status='paid'",
            validations: ['Only paid invoices count toward collected.', 'Amount and tax must be ≥ 0.', 'Marking an invoice paid stamps its paid date.'] },
          outstanding: { title: 'Outstanding receivables', value: inr(f.outstanding), sub: `overdue ${inr(f.overdueAr)}`, rule: "outstanding = Σ(amount + tax) WHERE status IN ('sent','overdue')\noverdue = the subset past its due date",
            validations: ['Draft & void invoices are excluded.', 'An invoice is overdue if status=overdue or due date has passed.'] },
          expenses: { title: 'Expenses', value: inr(f.expensesPaid), sub: `pending ${inr(f.expensePending)}`, rule: "expenses_paid = Σ(amount) WHERE status IN ('paid','approved')",
            validations: ['Category ∈ marketing, salaries, software, travel, office, infra, other.', 'Rejected expenses are excluded.', 'Amount must be ≥ 0.'],
            body: <ul className="space-y-1 text-sm">{f.expenseByCategory.map((e) => <li key={e.category} className="flex justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 capitalize"><span>{e.category}</span><span className="font-medium">{inr(e.amount)}</span></li>)}</ul> },
          net: { title: 'Net cashflow', value: inr(f.netCashflow), rule: 'net_cashflow = collected − expenses_paid',
            validations: ['Collected = paid invoices (amount + tax).', 'Expenses = paid/approved expenses.', 'A negative value means outflow exceeds collection.'] },
        }[metric];
        return <MetricModal title={cfg.title} value={cfg.value} sub={cfg.sub} rule={cfg.rule} validations={cfg.validations} onClose={() => setMetric(null)}>{cfg.body}</MetricModal>;
      })()}

      {/* Invoices */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><FiFileText /> Invoices (receivables)</h3>
          <button className={btnPrimary} onClick={() => setEditInv({})}><FiPlus /> New invoice</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
            <tr><th className="text-left px-4 py-3">Invoice</th><th className="text-left px-4 py-3">Client</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Due</th><th className="text-center px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {invoicesData.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setEditInv(r)}>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.number}</td>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.client_name}</td>
                <td className="px-4 py-3 text-right font-medium">{inr(Number(r.amount) + Number(r.tax || 0))}</td>
                <td className="px-4 py-3 text-slate-500">{r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '—'}</td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}><button className="text-slate-400 hover:text-red-500" onClick={() => delInv(r.id)}><FiTrash2 size={15} /></button></td>
              </tr>
            ))}
            {!invoicesData.length && <tr><td colSpan="6" className="text-center py-10 text-slate-400">No invoices.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Expenses */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><FiCreditCard /> Expenses (payables)</h3>
          <button className={btnPrimary} onClick={() => setEditExp({})}><FiPlus /> New expense</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
            <tr><th className="text-left px-4 py-3">Vendor</th><th className="text-left px-4 py-3">Category</th><th className="text-right px-4 py-3">Amount</th><th className="text-center px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {expensesData.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setEditExp(r)}>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.vendor}</td>
                <td className="px-4 py-3 text-slate-500 capitalize">{r.category}</td>
                <td className="px-4 py-3 text-right font-medium">{inr(r.amount)}</td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}><button className="text-slate-400 hover:text-red-500" onClick={() => delExp(r.id)}><FiTrash2 size={15} /></button></td>
              </tr>
            ))}
            {!expensesData.length && <tr><td colSpan="5" className="text-center py-10 text-slate-400">No expenses.</td></tr>}
          </tbody>
        </table>
      </div>

      {editInv && <InvoiceForm initial={editInv} contacts={contacts} onClose={() => setEditInv(null)} onSave={saveInv} />}
      {editExp && <ExpenseForm initial={editExp} onClose={() => setEditExp(null)} onSave={saveExp} />}
    </div>
  );
}

function InvoiceForm({ initial, contacts, onClose, onSave }) {
  const [f, setF] = useState({ number: '', client_name: '', contact_id: '', amount: 0, tax: 0, status: 'draft', issue_date: '', due_date: '', notes: '', ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setSaving(true); try { await onSave({ ...f, contact_id: f.contact_id || null }); } finally { setSaving(false); } };
  return (
    <Modal title={initial.id ? `Edit invoice ${initial.number || ''}` : 'New invoice'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="Invoice number" value={f.number || ''} onChange={set('number')} />
          <input className={input} placeholder="Client name" value={f.client_name} onChange={set('client_name')} required />
        </div>
        <select className={input} value={f.contact_id || ''} onChange={set('contact_id')}>
          <option value="">— Link a CRM contact (optional) —</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-slate-500">Amount (₹)<input className={input} type="number" value={f.amount} onChange={set('amount')} /></label>
          <label className="text-xs text-slate-500">Tax (₹)<input className={input} type="number" value={f.tax} onChange={set('tax')} /></label>
          <select className={input} value={f.status} onChange={set('status')}>{INVOICE_STATUSES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-500">Issue date<input className={input} type="date" value={f.issue_date ? f.issue_date.slice(0, 10) : ''} onChange={set('issue_date')} /></label>
          <label className="text-xs text-slate-500">Due date<input className={input} type="date" value={f.due_date ? f.due_date.slice(0, 10) : ''} onChange={set('due_date')} /></label>
        </div>
        <textarea className={input} rows="2" placeholder="Notes…" value={f.notes || ''} onChange={set('notes')} />
        <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={saving}>{saving ? <Spinner /> : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

function ExpenseForm({ initial, onClose, onSave }) {
  const [f, setF] = useState({ vendor: '', category: 'other', amount: 0, status: 'pending', spend_date: '', notes: '', ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setSaving(true); try { await onSave(f); } finally { setSaving(false); } };
  return (
    <Modal title={initial.id ? 'Edit expense' : 'New expense'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className={input} placeholder="Vendor / description" value={f.vendor} onChange={set('vendor')} required />
        <div className="grid grid-cols-3 gap-3">
          <select className={input} value={f.category} onChange={set('category')}>{EXPENSE_CATEGORIES.map((t) => <option key={t}>{t}</option>)}</select>
          <label className="text-xs text-slate-500">Amount (₹)<input className={input} type="number" value={f.amount} onChange={set('amount')} /></label>
          <select className={input} value={f.status} onChange={set('status')}>{EXPENSE_STATUSES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <label className="text-xs text-slate-500">Spend date<input className={input} type="date" value={f.spend_date ? f.spend_date.slice(0, 10) : ''} onChange={set('spend_date')} /></label>
        <textarea className={input} rows="2" placeholder="Notes…" value={f.notes || ''} onChange={set('notes')} />
        <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={saving}>{saving ? <Spinner /> : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

/* ── HR (employee directory) ──────────────────────────────────────────────── */
function Hr({ reload }) {
  const [rows, setRows] = useState([]);
  const [m, setM] = useState(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [editing, setEditing] = useState(null);
  const [chipDept, setChipDept] = useState(null);
  const [metric, setMetric] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api('/employees').then((r) => setRows(r.employees || [])),
      api('/metrics').then(setM),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) =>
    (dept === 'all' || r.department === dept) &&
    `${r.name} ${r.title || ''} ${r.email || ''}`.toLowerCase().includes(q.toLowerCase())
  ), [rows, q, dept]);

  const save = async (d) => { await api('/employees', { method: d.id ? 'PATCH' : 'POST', body: JSON.stringify(d) }); setEditing(null); load(); reload?.(); };
  const remove = async (id) => { if (!(await confirmDialog({ title: 'Remove employee', message: 'Remove this employee record?', confirmText: 'Remove' }))) return; await api(`/employees?id=${id}`, { method: 'DELETE' }); load(); reload?.(); };

  const hr = m?.hr;
  if (loading && !hr) return <div className="grid place-items-center py-32"><Spinner size={24} /></div>;
  return (
    <div className="space-y-5">
      {hr && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={FiUsers} label="Headcount" value={hr.headcount} tint="bg-indigo-500" onClick={() => setMetric('headcount')} />
          <KpiCard icon={FiUserCheck} label="Active" value={hr.active} sub={`${hr.onLeave} on leave`} tint="bg-emerald-500" onClick={() => setMetric('active')} />
          <KpiCard icon={CURRENCIES[CUR]?.icon || FiDollarSign} label="Monthly payroll" value={inr(hr.monthlyPayroll)} tint="bg-amber-500" onClick={() => setMetric('payroll')} />
          <KpiCard icon={FiBriefcase} label="Departments" value={hr.headcountByDept.length} tint="bg-violet-500" onClick={() => setMetric('departments')} />
        </div>
      )}
      {metric && hr && (() => {
        const empRow = (r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2.5">
            <div className="min-w-0"><div className="font-medium text-slate-800 dark:text-slate-100 truncate">{r.name}</div><div className="text-xs text-slate-400">{r.title || r.email} · {r.department} · {(r.status || '').replace('_', ' ')}</div></div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{inr(r.salary)}</span>
              <button title="Edit" onClick={() => { setEditing(r); setMetric(null); }} className="grid place-items-center h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"><FiEdit2 size={14} /></button>
              <button title="Remove" onClick={() => remove(r.id)} className="grid place-items-center h-8 w-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"><FiTrash2 size={14} /></button>
            </div>
          </li>
        );
        const active = rows.filter((r) => ['active', 'probation', 'on_leave'].includes(r.status));
        const cfg = {
          headcount: {
            title: 'Headcount', value: hr.headcount, sub: 'employees (excludes terminated)',
            rule: "headcount = COUNT(employees WHERE status ≠ 'terminated')",
            validations: ['Name and department are required for every employee.', 'Annual salary must be a non-negative number.', "Terminated employees are excluded; offboarding still counts."],
            list: rows.filter((r) => r.status !== 'terminated'),
          },
          active: {
            title: 'Active staff', value: hr.active, sub: `${hr.onLeave} on leave`,
            rule: 'active = COUNT(status ∈ {active, probation, on_leave})',
            validations: ['Status ∈ active, on_leave, probation, offboarding, terminated.', 'On-leave staff still count as active headcount.', 'Offboarding & terminated are NOT counted as active.'],
            list: active,
          },
          payroll: {
            title: 'Monthly payroll', value: inr(hr.monthlyPayroll), sub: 'gross, active staff',
            rule: 'monthly_payroll = Σ(annual_salary of active/probation/on_leave) ÷ 12',
            validations: ['Salaries are annual gross in the selected display currency.', 'Only active, probation and on-leave staff are included.', 'Each salary must be ≥ 0.'],
            list: null,
          },
          departments: {
            title: 'Departments', value: hr.headcountByDept.length, sub: 'with active members',
            rule: "departments = COUNT(DISTINCT department WHERE status ≠ 'terminated')",
            validations: ['Department must be one of the configured list.', 'Empty departments are not shown.'],
            list: null,
          },
        }[metric];
        return (
          <MetricModal title={cfg.title} value={cfg.value} sub={cfg.sub} rule={cfg.rule} validations={cfg.validations} onClose={() => setMetric(null)}>
            <div className="flex justify-end mb-2"><button className={btnPrimary} onClick={() => { setEditing({}); setMetric(null); }}><FiPlus /> Add employee</button></div>
            {metric === 'payroll' && (
              <ul className="space-y-1.5 max-h-80 overflow-y-auto">
                {active.slice().sort((a, b) => Number(b.salary) - Number(a.salary)).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                    <span className="truncate text-slate-700 dark:text-slate-200">{r.name} <span className="text-xs text-slate-400">· {r.department}</span></span>
                    <span className="font-medium shrink-0">{inr(Number(r.salary) / 12)}/mo</span>
                  </li>
                ))}
                {!active.length && <li className="text-sm text-slate-400 text-center py-6">No active staff.</li>}
              </ul>
            )}
            {metric === 'departments' && (
              <ul className="space-y-1.5">
                {hr.headcountByDept.map((d) => (
                  <li key={d.department}><button onClick={() => { setChipDept(d.department); setMetric(null); }} className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"><span>{d.department}</span><span className="font-medium">{d.count}</span></button></li>
                ))}
              </ul>
            )}
            {cfg.list && <ul className="space-y-2 max-h-80 overflow-y-auto">{cfg.list.map(empRow)}{!cfg.list.length && <li className="text-sm text-slate-400 text-center py-6">None.</li>}</ul>}
          </MetricModal>
        );
      })()}
      {hr?.headcountByDept?.length > 0 && (
        <div className={`${card} p-4 flex flex-wrap gap-2`}>
          {hr.headcountByDept.map((d) => (
            <button key={d.department} onClick={() => setChipDept(d.department)}
              className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 transition">{d.department}: <b>{d.count}</b></button>
          ))}
        </div>
      )}
      {chipDept && (
        <Modal title={`${chipDept} team`} onClose={() => setChipDept(null)} wide>
          <div className="flex justify-end mb-3"><button className={btnPrimary} onClick={() => { setEditing({ department: chipDept }); setChipDept(null); }}><FiPlus /> Add to {chipDept}</button></div>
          <ul className="space-y-2">
            {rows.filter((r) => r.department === chipDept).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2.5">
                <div className="min-w-0"><div className="font-medium text-slate-800 dark:text-slate-100 truncate">{r.name}</div><div className="text-xs text-slate-400">{r.title || r.email} · {(r.status || '').replace('_', ' ')}</div></div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{inr(r.salary)}</span>
                  <button title="Edit" onClick={() => { setEditing(r); setChipDept(null); }} className="grid place-items-center h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"><FiEdit2 size={14} /></button>
                  <button title="Remove" onClick={() => remove(r.id)} className="grid place-items-center h-8 w-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"><FiTrash2 size={14} /></button>
                </div>
              </li>
            ))}
            {!rows.filter((r) => r.department === chipDept).length && <li className="text-sm text-slate-400 text-center py-6">No one in {chipDept} yet.</li>}
          </ul>
        </Modal>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${input} pl-9`} placeholder="Search name, title, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${input} w-auto`} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className={btnPrimary} onClick={() => setEditing({})}><FiPlus /> Add employee</button>
      </div>

      <div className={`${card} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
            <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Department</th><th className="text-left px-4 py-3">Type</th><th className="text-right px-4 py-3">Salary</th><th className="text-center px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setEditing(r)}>
                <td className="px-4 py-3"><div className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</div><div className="text-xs text-slate-400">{r.title || r.email}</div></td>
                <td className="px-4 py-3 text-slate-500">{r.department}</td>
                <td className="px-4 py-3 text-slate-500">{(r.employment_type || '').replace('_', ' ')}</td>
                <td className="px-4 py-3 text-right font-medium">{inr(r.salary)}</td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{(r.status || '').replace('_', ' ')}</span></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}><button className="text-slate-400 hover:text-red-500" onClick={() => remove(r.id)}><FiTrash2 size={15} /></button></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan="6" className="text-center py-12 text-slate-400">No employees.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <EmployeeForm initial={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function EmployeeForm({ initial, onClose, onSave }) {
  const [f, setF] = useState({ name: '', email: '', title: '', department: 'Operations', status: 'active', employment_type: 'full_time', salary: 0, location: '', manager_email: '', start_date: '', notes: '', ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setSaving(true); try { await onSave(f); } finally { setSaving(false); } };
  return (
    <Modal title={initial.id ? 'Edit employee' : 'New employee'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="Full name" value={f.name} onChange={set('name')} required />
          <input className={input} placeholder="Job title" value={f.title || ''} onChange={set('title')} />
          <input className={input} placeholder="Email" type="email" value={f.email || ''} onChange={set('email')} />
          <input className={input} placeholder="Location" value={f.location || ''} onChange={set('location')} />
          <select className={input} value={f.department} onChange={set('department')}>{DEPARTMENTS.map((t) => <option key={t}>{t}</option>)}</select>
          <select className={input} value={f.employment_type} onChange={set('employment_type')}>{EMP_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select>
          <select className={input} value={f.status} onChange={set('status')}>{EMP_STATUSES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select>
          <label className="text-xs text-slate-500">Annual salary (₹)<input className={input} type="number" value={f.salary} onChange={set('salary')} /></label>
          <input className={input} placeholder="Manager email" value={f.manager_email || ''} onChange={set('manager_email')} />
          <label className="text-xs text-slate-500">Start date<input className={input} type="date" value={f.start_date ? f.start_date.slice(0, 10) : ''} onChange={set('start_date')} /></label>
        </div>
        <textarea className={input} rows="2" placeholder="Notes…" value={f.notes || ''} onChange={set('notes')} />
        <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={saving}>{saving ? <Spinner /> : 'Save'}</button></div>
      </form>
    </Modal>
  );
}

/* ── Shell ────────────────────────────────────────────────────────────────── */
const NAV = [
  { key: 'command', label: 'Command Center', icon: FiGrid },
  { key: 'crm', label: 'CRM', icon: FiUsers },
  { key: 'pipeline', label: 'Pipeline', icon: FiTarget },
  { key: 'campaigns', label: 'Campaigns', icon: FiTrendingUp },
  { key: 'connect', label: 'Connect', icon: FiMessageCircle },
  { key: 'mail', label: 'Mail', icon: FiMail },
  { key: 'accounts', label: 'Accounts', icon: FiCreditCard },
  { key: 'hr', label: 'People / HR', icon: FiBriefcase },
  { key: 'copilot', label: 'AI Copilot', icon: FiCpu },
  { key: 'tasks', label: 'Tasks', icon: FiCheckSquare },
  { key: 'reports', label: 'Reports', icon: FiFileText },
];

export default function GrowthPage() {
  const inviteToken = (() => { try { return new URLSearchParams(window.location.search).get('invite'); } catch { return null; } })();
  const [authed, setAuthed] = useState(null); // null=checking
  const [activated, setActivated] = useState(false);
  const [tab, setTab] = useState('command');
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('growth-dark') === '1'; } catch { return false; } });
  const [cur, setCur] = useState(CUR);
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('growth-collapsed') === '1'; } catch { return false; } });
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { try { localStorage.setItem('growth-collapsed', collapsed ? '1' : '0'); } catch { /* ignore */ } }, [collapsed]);
  const [nonce, setNonce] = useState(0); // forces metric reloads after mutations
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // authed: null (checking) | false (not signed in) | 'denied' (signed in, no
  // Growth access) | true (signed in with Growth access).
  const verify = useCallback(() => fetchJson('/api/team-members/me', { credentials: 'include' })
    .then((d) => setAuthed(d?.member?.growthAccess ? true : 'denied'))
    .catch(() => setAuthed(false)), []);
  useEffect(() => {
    if (inviteToken && !activated) { setAuthed(false); return; }
    verify();
  }, [inviteToken, activated, verify]);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); try { localStorage.setItem('growth-dark', dark ? '1' : '0'); } catch { /* ignore */ } }, [dark]);

  const changeCurrency = (code) => { CUR = code; setCur(code); try { localStorage.setItem('growth-cur', code); } catch { /* ignore */ } reload(); };
  const logout = async () => {
    if (!(await confirmDialog({ title: 'Sign out', message: 'Sign out of the Growth OS?', confirmText: 'Sign out' }))) return;
    await fetchJson('/api/team-members/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setAuthed(false);
  };

  const signOut = async () => { await fetchJson('/api/team-members/logout', { method: 'POST', credentials: 'include' }).catch(() => {}); setAuthed(false); };

  if (inviteToken && !activated && authed !== true && authed !== 'denied') {
    return <Activate token={inviteToken} onActivated={() => { setActivated(true); verify(); }} />;
  }
  if (authed === null) return <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950"><Spinner size={28} /></div>;
  if (authed === 'denied') {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur p-8 shadow-2xl text-center">
          <div className="grid place-items-center h-12 w-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto mb-4"><FiLock size={22} /></div>
          <h1 className="text-xl font-bold text-slate-900">No Growth access</h1>
          <p className="text-sm text-slate-500 mt-2">Your account isn't enabled for the Business Growth OS. Ask an admin to invite you from <strong>Admin → Growth</strong>.</p>
          <button onClick={signOut} className={`${btnGhost} mt-6 w-full justify-center`}><FiLogOut /> Sign out</button>
        </div>
      </div>
    );
  }
  if (!authed) return <Login onAuthed={() => verify()} />;

  return (
    <GrowthHubProvider>
    <div className={`${dark ? 'dark' : ''}`}>
      <NotificationCenter />
      <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {/* Mobile drawer backdrop */}
        {mobileNav && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileNav(false)} />}
        {/* Sidebar — collapsible on desktop, slide-in drawer on mobile */}
        <aside className={`fixed md:sticky top-0 left-0 z-50 h-screen shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all duration-200 ${mobileNav ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${collapsed ? 'w-16' : 'w-60'}`}>
          <div className={`p-3 flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
            {!collapsed && (<>
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-indigo-600 text-white shrink-0"><FiTrendingUp size={18} /></div>
              <div className="min-w-0"><div className="font-bold leading-tight text-base">Growth</div><div className="text-[10px] text-slate-400">Patience AI</div></div>
            </>)}
            <button onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand' : 'Collapse'}
              className={`hidden md:grid place-items-center h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 ${collapsed ? '' : 'ml-auto'}`}>
              {collapsed ? <FiChevronsRight size={16} /> : <FiChevronsLeft size={16} />}
            </button>
            <button onClick={() => setMobileNav(false)} className="md:hidden ml-auto h-7 w-7 grid place-items-center text-slate-400"><FiX size={18} /></button>
          </div>
          <nav className="px-2 space-y-1 flex-1 overflow-y-auto">
            {NAV.map((n) => (
              <button key={n.key} onClick={() => { setTab(n.key); setMobileNav(false); }} title={n.label}
                className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-xl text-sm font-medium transition ${tab === n.key ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <n.icon size={18} className="shrink-0" />
                {!collapsed && <>{n.label}{tab === n.key && <FiChevronRight className="ml-auto" size={14} />}</>}
              </button>
            ))}
          </nav>
          <div className="p-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={logout} title="Sign out" className={`w-full flex items-center gap-3 ${collapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-500`}><FiLogOut size={17} className="shrink-0" /> {!collapsed && 'Sign out'}</button>
          </div>
        </aside>

        {/* Main — the only scrollable column */}
        <main className="flex-1 min-w-0 h-screen overflow-y-auto">
          <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <button className="md:hidden grid place-items-center h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 shrink-0" onClick={() => setMobileNav(true)} title="Menu"><FiMenu size={18} /></button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-tight">Growth</h1>
                <p className="text-xs text-slate-400 truncate">{NAV.find((n) => n.key === tab)?.label} · Patience AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PresenceControl />
              {/* animated theme toggle */}
              <button onClick={() => setDark((d) => !d)} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="grid place-items-center h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={dark ? 'sun' : 'moon'} initial={{ y: 14, rotate: -90, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} exit={{ y: -14, rotate: 90, opacity: 0 }} transition={{ duration: 0.22 }}>
                    {dark ? <FiSun size={17} className="text-amber-400" /> : <FiMoon size={17} />}
                  </motion.span>
                </AnimatePresence>
              </button>
              <button className={btnGhost} onClick={() => setShowSettings(true)} title="Settings"><FiSettings /></button>
            </div>
          </header>
          <div className="p-5" key={`${cur}-${tab === 'command' ? nonce : ''}`}>
            {tab === 'command' && <CommandCenter key={nonce} dark={dark} />}
            {tab === 'crm' && <Crm reload={reload} />}
            {tab === 'pipeline' && <Pipeline reload={reload} />}
            {tab === 'campaigns' && <Campaigns />}
            {tab === 'connect' && <GrowthConnect />}
            {tab === 'mail' && <GrowthMail />}
            {tab === 'accounts' && <Accounts reload={reload} />}
            {tab === 'hr' && <Hr reload={reload} />}
            {tab === 'copilot' && <Copilot />}
            {tab === 'tasks' && <Tasks />}
            {tab === 'reports' && <Reports />}
          </div>
          {showSettings && <SettingsModal currency={cur} setCurrency={changeCurrency} onClose={() => setShowSettings(false)} />}
        </main>
      </div>
    </div>
    </GrowthHubProvider>
  );
}
