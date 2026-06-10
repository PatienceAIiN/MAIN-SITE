import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env (same minimal loader server.js uses)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (process.env[k] !== undefined) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

const { queryDb } = await import('../api/_db.js');

const data = fs.readFileSync(path.join(rootDir, 'src', 'data', 'siteContent.json'), 'utf8');
JSON.parse(data); // validate

for (const slug of ['default', 'site']) {
  await queryDb(
    `INSERT INTO site_content (slug, data, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [slug, data]
  );
  console.log(`Updated site_content slug="${slug}"`);
}
console.log('Done.');
process.exit(0);
