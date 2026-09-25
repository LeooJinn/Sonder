/**
 * Applies every migration to a throwaway local Postgres and runs the policy
 * checks in policies.sql against it, as the anon and authenticated roles.
 *
 *   npm install --no-save embedded-postgres pg
 *   node supabase/tests/run.mjs
 *
 * Not a dev dependency on purpose: embedded-postgres downloads a Postgres
 * build, and every Vercel deploy would pay for it.
 *
 * supabase-stub.sql recreates just enough of what Supabase provides — the
 * anon and authenticated roles, auth.uid(), the storage tables — for the
 * migrations to run unmodified.
 */
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'fs';
import os from 'os';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const migrations = path.join(here, '../migrations');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonder-pg-'));
const port = 54300 + Math.floor(Math.random() * 90);

const db = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: false,
  onLog: () => {},
});

let failed = false;
await db.initialise();
await db.start();
const client = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'postgres' });
await client.connect();
client.on('notice', (n) => console.log(n.message));

try {
  await client.query(fs.readFileSync(path.join(here, 'supabase-stub.sql'), 'utf8'));
  for (const file of fs.readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(fs.readFileSync(path.join(migrations, file), 'utf8'));
    console.log(`applied ${file}`);
  }
  await client.query(fs.readFileSync(path.join(here, 'policies.sql'), 'utf8'));
  console.log('\nAll policy checks passed.');
} catch (error) {
  failed = true;
  console.error(`\n${error.message}`);
} finally {
  await client.end();
  await db.stop();
  fs.rmSync(dir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
