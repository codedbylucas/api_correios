import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const applied = new Set(
      (await client.query('SELECT name FROM _migrations')).rows.map((row: any) => row.name)
    );

    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skipping ${file} (already applied)`);
        continue;
      }

      console.log(`[migrate] applying ${file}`);
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      const statements = content
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await client.query(statement);
      }

      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`[migrate] applied ${file}`);
    }

    console.log('[migrate] done');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[migrate] failed:', error);
  process.exit(1);
});
