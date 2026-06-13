process.loadEnvFile('.env');
const { queryDb } = await import('./api/_db.js');
const sec = await import('./api/_security.js');
const tok = sec.createMemberSessionToken({ email: 'manini@providerpassport.co', name: 'Manini' });
const handler = (await import('./api/business.js')).default;
const call = (m, p, b) => new Promise((res) => {
  const req = { method: m, url: p, path: p.split('?')[0], query: Object.fromEntries(new URLSearchParams(p.split('?')[1]||'')), headers: { cookie: `pa_member_session=${tok}` }, body: b };
  const r = { statusCode: 200, status(c){this.statusCode=c;return this;}, json(o){res({code:this.statusCode,body:o});} };
  handler(req, r).catch((e) => res({ code: 500, body: { error: e.message } }));
});
const log = (...a) => console.log(...a);
try {
  const t0 = Date.now();
  log('1) DB CONNECT  ->', JSON.stringify((await queryDb('select 1 ok'))[0]), `(${Date.now()-t0}ms)`);
  log('2) SEED        ->', JSON.stringify((await call('POST','/api/business/seed')).body));
  const m = (await call('GET','/api/business/metrics')).body;
  log('3) METRICS     -> revenue', m.headline.revenue, '| pipeline', m.headline.pipelineValue, '| winRate', m.headline.winRate+'%', '| customers', m.headline.customers, '| atRisk', m.headline.atRisk, '| ROAS', m.headline.roas, '| health', m.headline.healthScore);
  log('   funnel      ->', JSON.stringify(m.funnel));
  log('   channels    ->', m.byChannel.length, 'channels; forecast', JSON.stringify(m.forecast.map(f=>f.revenue)));
  const ct = (await call('GET','/api/business/contacts')).body.contacts;
  log('4) CONTACTS    ->', ct.length, 'rows; e.g.', ct[0]?.name, '/', ct[0]?.type);
  const nd = (await call('POST','/api/business/deals', { title:'E2E deal', value:75000, stage:'proposal', probability:55 })).body.deal;
  const won = (await call('PATCH','/api/business/deals', { id: nd.id, stage:'won' })).body.deal;
  log('5) DEAL CRUD   -> created#'+nd.id, nd.stage, '-> won:', won.stage, won.status, won.probability+'%');
  await call('DELETE', `/api/business/deals?id=${nd.id}`);
  const camp = (await call('GET','/api/business/campaigns')).body.campaigns;
  log('6) CAMPAIGNS   ->', camp.length, 'rows');
  const ai = (await call('POST','/api/business/ai', { question:'What should leadership focus on this week?' })).body;
  log('7) AI COPILOT  ->', (ai.answer||ai.error||'').slice(0,260).replace(/\n/g,' '));
  log('=== ALL CHECKS PASSED ===');
} catch (e) { log('FAIL:', e.message); }
process.exit(0);
