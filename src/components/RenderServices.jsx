import React, { useEffect, useState } from 'react';
import { fetchJson } from '../common/fetchJson';

// Render-style services dashboard: lists every service (grouped by project/owner),
// opens a service to its settings, editable env vars, and deploy history.
// Backed by admin-only /api/deploy/services (RENDER_API_KEY required).
export default function RenderServices({ dark = true }) {
  const [services, setServices] = useState(null);
  const [note, setNote] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    fetchJson('/api/deploy/services')
      .then((d) => { setServices(d.services || []); setNote(d.note || ''); })
      .catch((e) => { setServices([]); setNote(e.message); });
  }, []);

  // theme tokens (admin panel is dark; team modal is light/dark via tailwind)
  const t = dark
    ? { card: 'border-white/10 bg-white/5', sub: 'text-white/50', head: 'text-white', chip: 'bg-white/10 text-white/70', input: 'border-white/10 bg-white/5 text-white placeholder:text-white/35', btn: 'bg-white text-slate-950 hover:bg-white/90', btn2: 'border border-white/15 text-white/80 hover:bg-white/5', row: 'hover:bg-white/5 border-white/10' }
    : { card: 'border-slate-200 bg-white', sub: 'text-slate-500', head: 'text-slate-900', chip: 'bg-slate-100 text-slate-600', input: 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400', btn: 'bg-slate-900 text-white hover:bg-slate-800', btn2: 'border border-slate-200 text-slate-600 hover:bg-slate-100', row: 'hover:bg-slate-50 border-slate-200' };

  if (services === null) return <p className={`text-sm ${t.sub}`}>Loading services…</p>;
  if (note && !services.length) return <p className={`text-sm ${t.sub}`}>{note}</p>;

  // Group services by ownerId (a Render "project"/team owns its services).
  const groups = {};
  for (const s of services) { const k = s.ownerId || 'project'; (groups[k] = groups[k] || []).push(s); }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([owner, list]) => (
        <div key={owner}>
          <p className={`text-[11px] uppercase tracking-wider ${t.sub} font-semibold mb-1.5`}>Project · {owner} · {list.length} service{list.length > 1 ? 's' : ''}</p>
          <div className={`rounded-2xl border ${t.card} divide-y ${dark ? 'divide-white/10' : 'divide-slate-200'} overflow-hidden`}>
            {list.map((s) => (
              <div key={s.id}>
                <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 ${t.row}`}>
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${t.head} truncate`}>{s.name} {s.suspended === 'suspended' && <span className="text-amber-400 text-[10px]">· suspended</span>}</span>
                    <span className={`block text-[11px] ${t.sub} truncate font-mono`}>{s.id} · {s.type}{s.branch ? ` · ${s.branch}` : ''}</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${t.chip} shrink-0`}>{openId === s.id ? 'Hide' : 'Manage'}</span>
                </button>
                {openId === s.id && <ServiceDetail id={s.id} t={t} dark={dark} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ServiceDetail({ id, t, dark = true }) {
  // Allow standalone use (per deploy-target card) — supply default theme tokens.
  t = t || (dark
    ? { card: 'border-white/10 bg-white/5', sub: 'text-white/50', head: 'text-white', chip: 'bg-white/10 text-white/70', input: 'border-white/10 bg-white/5 text-white placeholder:text-white/35', btn: 'bg-white text-slate-950 hover:bg-white/90', btn2: 'border border-white/15 text-white/80 hover:bg-white/5', row: 'hover:bg-white/5 border-white/10' }
    : { card: 'border-slate-200 bg-white', sub: 'text-slate-500', head: 'text-slate-900', chip: 'bg-slate-100 text-slate-600', input: 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400', btn: 'bg-slate-900 text-white hover:bg-slate-800', btn2: 'border border-slate-200 text-slate-600 hover:bg-slate-100', row: 'hover:bg-slate-50 border-slate-200' });
  return <ServiceDetailInner id={id} t={t} dark={dark} />;
}

function ServiceDetailInner({ id, t, dark }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('env');
  const [env, setEnv] = useState([]);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [autoDeploy, setAutoDeploy] = useState('yes');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => fetchJson(`/api/deploy/services?id=${id}`).then((d) => {
    setData(d); setEnv(d.envVars || []);
    setName(d.service?.name || ''); setBranch(d.service?.branch || ''); setAutoDeploy(d.service?.autoDeploy || 'yes');
  }).catch((e) => setMsg(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const saveEnv = async () => {
    setBusy(true); setMsg('');
    try { const r = await fetchJson(`/api/deploy/services?id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ envVars: env.filter((v) => v.key.trim()) }) }); setMsg(`Saved ${r.count} env vars ✓`); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const saveSettings = async () => {
    setBusy(true); setMsg('');
    try { await fetchJson(`/api/deploy/services?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, branch, autoDeploy }) }); setMsg('Settings saved ✓'); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const setRow = (i, k, v) => setEnv((e) => e.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  if (!data) return <p className={`px-4 py-3 text-xs ${t.sub}`}>Loading…</p>;
  if (data.note && !data.service) return <p className={`px-4 py-3 text-xs ${t.sub}`}>{data.note}</p>;
  const tabBtn = (k, label) => <button onClick={() => setTab(k)} className={`text-xs px-3 py-1.5 rounded-lg ${tab === k ? t.btn : t.btn2}`}>{label}</button>;
  const inp = `w-full rounded-lg border ${t.input} px-2.5 py-1.5 text-xs focus:outline-none`;

  return (
    <div className={`px-4 py-3 border-t ${dark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex flex-wrap gap-2 mb-3">{tabBtn('env', `Env vars (${env.length})`)}{tabBtn('settings', 'Settings')}{tabBtn('history', `History (${data.deploys?.length || 0})`)}
        <span className={`ml-auto text-[10px] ${t.sub} self-center font-mono`}>{data.service?.id}</span>
      </div>

      {tab === 'env' && (
        <div className="space-y-1.5">
          {env.map((v, i) => (
            <div key={i} className="flex gap-1.5">
              <input className={`${inp} w-40 font-mono`} value={v.key} onChange={(e) => setRow(i, 'key', e.target.value)} placeholder="KEY" />
              <input className={`${inp} flex-1 font-mono`} value={v.value} onChange={(e) => setRow(i, 'value', e.target.value)} placeholder="value" />
              <button onClick={() => setEnv((e) => e.filter((_, j) => j !== i))} className={`text-xs px-2 rounded-lg ${t.btn2}`}>✕</button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEnv((e) => [...e, { key: '', value: '' }])} className={`text-xs px-3 py-1.5 rounded-lg ${t.btn2}`}>+ Add variable</button>
            <button onClick={saveEnv} disabled={busy} className={`text-xs px-4 py-1.5 rounded-lg font-semibold ${t.btn} disabled:opacity-50`}>Save env vars</button>
          </div>
          <p className={`text-[10px] ${t.sub}`}>Saving replaces the full env set and triggers a Render restart/redeploy.</p>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-2 max-w-md">
          <label className={`block text-[11px] ${t.sub}`}>Service name<input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className={`block text-[11px] ${t.sub}`}>Branch<input className={inp} value={branch} onChange={(e) => setBranch(e.target.value)} /></label>
          <label className={`block text-[11px] ${t.sub}`}>Auto-deploy
            <select className={inp} value={autoDeploy} onChange={(e) => setAutoDeploy(e.target.value)}><option value="yes">On</option><option value="no">Off</option></select>
          </label>
          <div className={`text-[11px] ${t.sub} space-y-0.5 pt-1`}>
            <p>Repo: <span className="font-mono">{data.service?.repo || '—'}</span></p>
            <p>Region: {data.service?.region || '—'} · Plan: {data.service?.plan || '—'}</p>
            {data.service?.url && <p>URL: <a href={data.service.url} target="_blank" rel="noreferrer" className="underline">{data.service.url}</a></p>}
          </div>
          <button onClick={saveSettings} disabled={busy} className={`text-xs px-4 py-1.5 rounded-lg font-semibold ${t.btn} disabled:opacity-50`}>Save settings</button>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {(data.deploys || []).map((d) => (
            <div key={d.id} className={`flex items-center justify-between gap-2 text-[11px] ${t.sub} border-b ${dark ? 'border-white/5' : 'border-slate-100'} py-1.5`}>
              <span className="font-mono shrink-0">{d.commitId || '—'}</span>
              <span className="flex-1 truncate">{d.commitMsg || d.trigger || ''}</span>
              <span className="shrink-0">{d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}</span>
              <span className={`shrink-0 ${['live', 'succeeded'].includes(d.status) ? 'text-emerald-400' : /fail|cancel/.test(d.status || '') ? 'text-red-400' : 'text-amber-400'}`}>{d.status}</span>
            </div>
          ))}
          {!(data.deploys || []).length && <p className={`text-xs ${t.sub}`}>No deploys.</p>}
        </div>
      )}
      {msg && <p className={`text-[11px] mt-2 ${t.sub}`}>{msg}</p>}
    </div>
  );
}
