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
  },
  '/products': {
    title: 'PATIENCE AI Products — Enterprise AI Suite | patienceai.in',
    description: 'Explore PATIENCE AI\'s suite of enterprise AI products. Built for governance, measurable impact, and reliable delivery at scale.',
    keywords: 'PATIENCE AI products, PatienceAI products, Patience AI products, enterprise AI tools, AI automation products, AI governance tools',
  },
  '/platform': {
    title: 'PATIENCE AI Platform & Services — Enterprise AI Infrastructure',
    description: 'PATIENCE AI platform delivers enterprise AI services with clear ownership, clean architecture, and reliable delivery pipelines.',
    keywords: 'PATIENCE AI platform, PatienceAI platform, Patience AI services, enterprise AI infrastructure, AI delivery platform',
  },
  '/company/blog': {
    title: 'PATIENCE AI Case Studies & Blog — AI Insights | patienceai.in',
    description: 'Real-world case studies and insights from PATIENCE AI on enterprise AI governance, measurable impact, and product delivery.',
    keywords: 'PATIENCE AI blog, PatienceAI blog, Patience AI case studies, enterprise AI insights, AI governance articles',
  },
  '/company/careers': {
    title: 'PATIENCE AI Careers — Join Our Team | patienceai.in',
    description: 'Join the PATIENCE AI team. We\'re building product-first AI platforms for enterprise delivery. See open roles and opportunities.',
    keywords: 'PATIENCE AI careers, PatienceAI careers, Patience AI jobs, enterprise AI company jobs, work at PATIENCE AI',
  },
};

const injectMeta = (html, route) => {
  const meta = ROUTE_META[route] || ROUTE_META['/'];
  const canonical = `${DOMAIN}${route === '/' ? '' : route}/`.replace(/\/\/$/, '/');

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta name="keywords" content=")[^"]*(")/,     `$1${meta.keywords}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/,        `$1${canonical}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${meta.description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/,          `$1${canonical}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${meta.title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/,  `$1${meta.description}$2`);
};

// Cache the HTML template at startup
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

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

app.disable('x-powered-by');

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
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
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

app.use(express.json({ limit: '1mb' }));
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
