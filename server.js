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
    title: 'Patience AI — Product-First AI for Governance & Enterprise Delivery',
    description: 'Patience AI builds governed product experiences for teams that need clean requests, clear ownership, and reliable delivery. Enterprise AI done right.',
    keywords: 'Patience AI, patienceai, enterprise AI platform, AI governance, product-first AI, AI delivery',
  },
  '/products': {
    title: 'Products — Patience AI | Enterprise AI Suite',
    description: 'Explore Patience AI\'s suite of enterprise AI products. Built for governance, measurable impact, and reliable delivery at scale.',
    keywords: 'Patience AI products, enterprise AI tools, AI automation products, AI governance tools',
  },
  '/platform': {
    title: 'Platform & Services — Patience AI | AI Infrastructure',
    description: 'Patience AI\'s platform delivers enterprise AI services with clear ownership, clean architecture, and reliable delivery pipelines.',
    keywords: 'Patience AI platform, AI services, enterprise AI infrastructure, AI delivery platform',
  },
  '/company/blog': {
    title: 'Case Studies & Blog — Patience AI | AI Insights',
    description: 'Real-world case studies and insights from Patience AI on enterprise AI governance, measurable impact, and product delivery.',
    keywords: 'Patience AI blog, AI case studies, enterprise AI insights, AI governance articles',
  },
  '/company/careers': {
    title: 'Careers — Patience AI | Join Our Team',
    description: 'Join the Patience AI team. We\'re building product-first AI platforms for enterprise delivery. See open roles and opportunities.',
    keywords: 'Patience AI careers, AI jobs, enterprise AI company jobs, work at Patience AI',
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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.all('/api/admin', wrap(adminHandler));
app.all('/api/analytics', wrap(analyticsHandler));
app.all('/api/auth', wrap(authHandler));
app.all('/api/chat-admin', wrap(chatAdminHandler));
app.all('/api/chat', wrap(chatHandler));
app.all('/api/contact', wrap(contactHandler));
app.all('/api/site-content', wrap(siteContentHandler));

// Dynamic sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const domain = process.env.SITE_URL || 'https://patienceai.in';
  const now = new Date().toISOString().split('T')[0];
  const routes = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/products', priority: '0.9', changefreq: 'weekly' },
    { path: '/platform', priority: '0.9', changefreq: 'weekly' },
    { path: '/company/blog', priority: '0.8', changefreq: 'daily' },
    { path: '/company/careers', priority: '0.7', changefreq: 'weekly' },
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
