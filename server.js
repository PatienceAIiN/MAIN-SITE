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
app.all('/api/auth', wrap(authHandler));
app.all('/api/chat-admin', wrap(chatAdminHandler));
app.all('/api/chat', wrap(chatHandler));
app.all('/api/contact', wrap(contactHandler));
app.all('/api/site-content', wrap(siteContentHandler));

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
}

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }

  return res.status(404).send('Build output not found');
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
