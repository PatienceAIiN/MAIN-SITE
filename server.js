import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const loadLocalEnv = () => {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
    return;
  }

  const envPath = path.resolve(process.cwd(),'.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadLocalEnv();

import adminHandler from './api/admin.js';
import analyticsHandler from './api/analytics.js';
import authHandler from './api/auth.js';
import { rateLimit } from './api/_ratelimit.js';
import chatAdminHandler from './api/chat-admin.js';
import chatHandler from './api/chat.js';
import contactHandler from './api/contact.js';
import siteContentHandler from './api/site-content.js';
import supportAuthHandler from './api/support-auth.js';
import supportChatHandler from './api/support-chat.js';
import supportExecutivesHandler, { seedExecutive } from './api/support-executives.js';
import voiceRoomHandler from './api/voice-room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const indexHtml = path.join(distDir, 'index.html');
const app = express();
const port = process.env.PORT || 3000;
const DOMAIN = process.env.SITE_URL || 'https://patienceai.in';

// Per-route SEO meta — injected server-side so crawlers see real content without JS
const ROUTE_META = {
  '/': {
    title: 'PATIENCE AI — Product-First AI for Governance & Enterprise Delivery',
    description: 'PATIENCE AI (patienceai.in) builds governed product experiences for enterprise teams — clean requests, clear ownership, and reliable AI delivery at scale.',
    keywords: 'PATIENCE AI, PatienceAI, Patience AI, patienceai.in, enterprise AI platform, AI governance, product-first AI, AI delivery',
    faq: [
      { q: 'What is PATIENCE AI?', a: 'PATIENCE AI (patienceai.in) is a product-first AI company that builds governed product experiences for enterprise teams. We deliver clean request handling, clear ownership, and reliable AI delivery at scale.' },
      { q: 'What does PATIENCE AI do?', a: 'PATIENCE AI provides enterprise AI services including AI strategy, AI automation, and AI support. We build auditable, policy-safe AI systems for teams that need measurable outcomes and governance.' },
      { q: 'Where is PATIENCE AI based?', a: 'PATIENCE AI is based in Pune, Maharashtra, India and serves enterprise clients globally.' },
      { q: 'How can I contact PATIENCE AI?', a: 'You can contact PATIENCE AI through the contact form at patienceai.in or by requesting a product demo directly on the website.' },
      { q: 'What industries does PATIENCE AI serve?', a: 'PATIENCE AI serves enterprise teams across industries that require governed AI delivery — including operations, support automation, product management, and enterprise software.' },
    ],
  },
  '/products': {
    title: 'PATIENCE AI Products — Enterprise AI Suite | patienceai.in',
    description: 'Explore PATIENCE AI\'s suite of enterprise AI products. Built for governance, measurable impact, and reliable delivery at scale.',
    keywords: 'PATIENCE AI products, PatienceAI products, Patience AI products, enterprise AI tools, AI automation products, AI governance tools',
    faq: [
      { q: 'What products does PATIENCE AI offer?', a: 'PATIENCE AI offers an enterprise AI suite including AI strategy planning tools, AI automation pipelines, and AI support systems — all built for auditable, governed delivery.' },
      { q: 'Are PATIENCE AI products ready for production use?', a: 'Yes. PATIENCE AI products are production-ready with auditable request handling, controlled publishing, and enterprise-grade delivery pipelines.' },
    ],
  },
  '/platform': {
    title: 'PATIENCE AI Platform & Services — Enterprise AI Infrastructure',
    description: 'PATIENCE AI platform delivers enterprise AI services with clear ownership, clean architecture, and reliable delivery pipelines.',
    keywords: 'PATIENCE AI platform, PatienceAI platform, Patience AI services, enterprise AI infrastructure, AI delivery platform',
    faq: [
      { q: 'What services does PATIENCE AI provide?', a: 'PATIENCE AI provides three core services: AI Strategy (planning and safe rollout), AI Automation (policy-safe workflow automation), and AI Support (intelligent support operations).' },
      { q: 'How does PATIENCE AI ensure AI governance?', a: 'PATIENCE AI builds auditable dashboards, controlled publishing workflows, and policy-safe automation — giving enterprise teams full visibility and control over their AI systems.' },
    ],
  },
  '/company/blog': {
    title: 'PATIENCE AI Case Studies & Blog — AI Insights | patienceai.in',
    description: 'Real-world case studies and insights from PATIENCE AI on enterprise AI governance, measurable impact, and product delivery.',
    keywords: 'PATIENCE AI blog, PatienceAI blog, Patience AI case studies, enterprise AI insights, AI governance articles',
    faq: [
      { q: 'Where can I read PATIENCE AI case studies?', a: 'PATIENCE AI publishes real-world case studies and insights at patienceai.in/company/blog — covering enterprise AI governance, measurable outcomes, and product delivery.' },
    ],
  },
  '/company/careers': {
    title: 'PATIENCE AI Careers — Join Our Team | patienceai.in',
    description: 'Join the PATIENCE AI team. We\'re building product-first AI platforms for enterprise delivery. See open roles and opportunities.',
    keywords: 'PATIENCE AI careers, PatienceAI careers, Patience AI jobs, enterprise AI company jobs, work at PATIENCE AI',
    faq: [
      { q: 'Is PATIENCE AI hiring?', a: 'PATIENCE AI is building a team focused on product-first AI for enterprise delivery. Current openings and opportunities are listed at patienceai.in/company/careers.' },
      { q: 'Where is the PATIENCE AI team located?', a: 'PATIENCE AI is headquartered in Pune, Maharashtra, India. We are building AI products for global enterprise clients.' },
    ],
  },
};

const buildRouteSchemas = (route, canonical) => {
  const meta = ROUTE_META[route] || ROUTE_META['/'];
  const schemas = [];

  // BreadcrumbList — helps Google understand site structure for AI mode
  if (route !== '/') {
    const crumbs = [{ name: 'Home', url: 'https://patienceai.in/' }];
    if (route.startsWith('/company/')) {
      crumbs.push({ name: 'Company', url: 'https://patienceai.in/company/' });
    }
    const labels = { '/products': 'Products', '/platform': 'Platform & Services', '/company/blog': 'Case Studies', '/company/careers': 'Careers' };
    if (labels[route]) crumbs.push({ name: labels[route], url: canonical });
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
    });
  }

  // FAQPage — directly feeds Google AI Overviews
  if (meta.faq?.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: meta.faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  // Speakable — marks content Google Assistant / AI can read aloud
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: meta.title,
    description: meta.description,
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'h2', '.hero-description'] },
  });

  return schemas.map(s => `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`).join('\n');
};

const injectMeta = (html, route) => {
  const meta = ROUTE_META[route] || ROUTE_META['/'];
  // Always hardcode https://patienceai.in — never rely on SITE_URL env var for canonical
  const base = 'https://patienceai.in';
  const canonical = `${base}${route === '/' ? '' : route}/`.replace(/\/\/$/, '/');
  const routeSchemas = buildRouteSchemas(route, canonical);

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta name="keywords" content=")[^"]*(")/,     `$1${meta.keywords}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/,        `$1${canonical}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/,          `$1${canonical}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace('</head>', `${routeSchemas}\n</head>`);
};

// Cache the HTML template once at startup (Render always restarts on deploy)
let htmlTemplate = '';
const getHtmlTemplate = () => {
  if (!htmlTemplate && fs.existsSync(indexHtml)) {
    htmlTemplate = fs.readFileSync(indexHtml, 'utf8');
  }
  return htmlTemplate;
};

// Submit all URLs to IndexNow (Bing, Yandex — instant indexing, free)
const submitIndexNow = async () => {
  const key = 'patienceai2024indexnow';
  const host = 'patienceai.in';
  const base = 'https://patienceai.in';
  const urls = [
    `${base}/`,
    `${base}/products`,
    `${base}/platform`,
    `${base}/company/blog`,
    `${base}/company/careers`,
  ];
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, urlList: urls }),
    });
    const text = await res.text();
    console.log(`[IndexNow] Submitted ${urls.length} URLs — HTTP ${res.status} — ${text || 'ok'}`);
  } catch (e) {
    console.log('[IndexNow] Submission failed:', e.message);
  }
};

// Submit on startup (runs once per deploy — notifies Bing + Yandex immediately)
setTimeout(submitIndexNow, 5000);
// Seed default support executive
setTimeout(seedExecutive, 6000);

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

app.disable('x-powered-by');

// ── HTTP → HTTPS redirect ─────────────────────────────────────────────────────
// Render sets x-forwarded-proto when terminating TLS; redirect plain HTTP
app.use((req, res, next) => {
  const proto = req.headers['x-forwarded-proto'];
  if (proto && proto !== 'https') {
    return res.redirect(301, `https://patienceai.in${req.url}`);
  }
  next();
});

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Force HTTPS for 1 year (only sent over HTTPS so safe to always set)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // Control referrer info sent to third parties
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Disable browser features not needed
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  // Basic XSS protection for older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Content Security Policy
  // default-src * allows all resources so React, Framer Motion, Quest SDK and
  // third-party scripts work without breakage. The three directives below are
  // the ones that provide real protection for an app that requires unsafe-inline
  // and unsafe-eval (React/Vite builds):
  //   frame-ancestors 'none'  — blocks clickjacking (stronger than X-Frame-Options)
  //   base-uri 'self'         — blocks <base> tag injection attacks
  //   form-action 'self'      — blocks forms being hijacked to external URLs
  res.setHeader(
    'Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  // CORS — only allow same origin for API calls
  const origin = req.headers.origin;
  if (origin === 'https://patienceai.in' || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiters ──────────────────────────────────────────────────────────────
const authLimiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  message: 'Too many login attempts. Try again in 15 minutes.' });
const contactLimiter  = rateLimit({ windowMs: 60 * 60 * 1000, max: 5,   message: 'Too many contact submissions. Try again in 1 hour.' });
const analyticsLimiter = rateLimit({ windowMs: 60 * 1000,     max: 120, message: 'Rate limit exceeded.' });

app.all('/api/admin', wrap(adminHandler));
app.all('/api/analytics', analyticsLimiter, wrap(analyticsHandler));
app.all('/api/auth', authLimiter, wrap(authHandler));
app.all('/api/chat-admin', wrap(chatAdminHandler));
app.all('/api/chat', wrap(chatHandler));
app.all('/api/contact', contactLimiter, wrap(contactHandler));
app.all('/api/site-content', wrap(siteContentHandler));
app.all('/api/support-auth', authLimiter, wrap(supportAuthHandler));
app.all('/api/support-chat', wrap(supportChatHandler));
app.all('/api/support-executives/login',    wrap(supportExecutivesHandler));
app.all('/api/support-executives/activate', wrap(supportExecutivesHandler));
app.all('/api/support-executives/me',       wrap(supportExecutivesHandler));
app.all('/api/support-executives/logout',   wrap(supportExecutivesHandler));
app.all('/api/support-executives',          wrap(supportExecutivesHandler));
app.all('/api/voice-room/ice-servers',      wrap(voiceRoomHandler));
app.all('/api/voice-room',                  wrap(voiceRoomHandler));

// Dynamic sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const domain = 'https://patienceai.in';
  const now = new Date().toISOString().split('T')[0];
  const routes = [
    { path: '/', priority: '1.0', changefreq: 'hourly' },
    { path: '/products', priority: '0.9', changefreq: 'hourly' },
    { path: '/platform', priority: '0.9', changefreq: 'hourly' },
    { path: '/company/blog', priority: '0.8', changefreq: 'hourly' },
    { path: '/company/careers', priority: '0.7', changefreq: 'hourly' },
  ];
  const urls = routes.map(r =>
    `  <url>\n    <loc>${domain}${r.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(xml);
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
}

// Serve favicon.ico — Google looks here first before checking <link> tags
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(distDir, 'favicon-32.png');
  if (fs.existsSync(faviconPath)) {
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(faviconPath);
  }
  res.status(404).end();
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  const template = getHtmlTemplate();
  if (!template) {
    return res.status(404).send('Build output not found');
  }

  // Strip query params for route matching
  const route = req.path.replace(/\/$/, '') || '/';
  const html = injectMeta(template, route);
  res.set('Content-Type', 'text/html');
  res.send(html);
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
