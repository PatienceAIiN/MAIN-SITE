import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const main = async () => {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  try {
    const env = readFileSync(envPath, 'utf8');
    for (const line of env.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  } catch {
    // .env not required at runtime; env vars may already be set
  }

  const { queryDb } = await import('../api/_db.js');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(__dirname, '..', 'src', 'data', 'siteContent.json');
  const content = JSON.parse(readFileSync(filePath, 'utf8'));

  await queryDb(
    `INSERT INTO site_content (slug, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    ['default', JSON.stringify(content)]
  );

  console.log('site_content row updated from local siteContent.json');
  process.exit(0);
};

main();
