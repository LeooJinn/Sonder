/**
 * Applies every migration to a throwaway local Postgres and runs the policy
 * checks in policies.sql against it, as the anon and authenticated roles.
 *
 *   npm install --no-save embedded-postgres pg
 *   node supabase/tests/run.mjs
 *
 * After the policy checks it compares the database's idea of a due reminder
 * with the app's (lib/reminderStatus.ts), then runs the reminder-email checks
 * (reminder-emails.mjs) in a database of their own.
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
import ts from 'typescript';
import { reminderEmailChecks } from './reminder-emails.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.join(here, '../..');
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

/**
 * The app decides a reminder is due in lib/reminderStatus.ts; the database
 * decides it again, for the emails, in reminder_is_due() and known_mileage()
 * (0015). They must never disagree, so this runs both over a grid of reminders
 * and compares. Extend the grid when a field is added to Reminder.
 */
async function sameDecisionAsTheApp() {
  // Transpile the TypeScript on its own (it has no imports) and load it.
  const source = fs.readFileSync(path.join(repo, 'lib/reminderStatus.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { reminderStatus, knownMileage } = await import(
    'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
  );

  const shift = (iso, days) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const addMonthsIso = (iso, months) => {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + months, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d, last));
    return t.toISOString().slice(0, 10);
  };

  const lastDone = [null, '1900-01-31', '1999-12-31', '2023-01-31', '2024-02-29', '2024-08-31', '2025-03-31', '2025-12-31', '2026-01-30', '2026-06-15', '2026-08-31', '2100-12-31'];
  const months = [null, 1, 2, 6, 12, 24, 60, 240];
  const everyMiles = [null, 1, 5000, 60000, 2147483647];
  const lastOdometer = [null, 0, 50000, 2147483647];
  const mileages = [null, 0, 49999, 50000, 50001, 54999, 55000, 55001, 110000];
  const cases = [];
  for (const lastDoneOn of lastDone)
    for (const everyMonths of months)
      for (const miles of everyMiles) {
        if (everyMonths === null && miles === null) continue; // the table forbids it
        for (const lastDoneOdometer of lastOdometer)
          for (const mileage of mileages) {
            // The day before, the day of, and the day after the due date.
            const dueDay = lastDoneOn && everyMonths ? addMonthsIso(lastDoneOn, everyMonths) : '2026-10-06';
            for (const offset of [-1, 0, 1]) {
              cases.push({ everyMonths, everyMiles: miles, lastDoneOn, lastDoneOdometer, mileage, onDate: shift(dueDay, offset) });
            }
          }
      }

  const { rows } = await client.query(
    `select public.reminder_is_due((c->>'everyMiles')::int, (c->>'everyMonths')::int, (c->>'lastDoneOn')::date,
            (c->>'lastDoneOdometer')::int, (c->>'mileage')::int, (c->>'onDate')::date) as due
       from jsonb_array_elements($1::jsonb) with ordinality as t(c, ord)
      order by ord`,
    [JSON.stringify(cases)]
  );
  const mismatches = [];
  rows.forEach((row, i) => {
    const k = cases[i];
    const app = reminderStatus(
      {
        id: 'x',
        title: 't',
        everyMiles: k.everyMiles ?? undefined,
        everyMonths: k.everyMonths ?? undefined,
        lastDoneOn: k.lastDoneOn ?? undefined,
        lastDoneOdometer: k.lastDoneOdometer ?? undefined,
      },
      k.mileage ?? undefined,
      k.onDate
    ).due;
    if (app !== row.due) mismatches.push({ ...k, app, database: row.due });
  });
  if (mismatches.length) {
    throw new Error(
      `reminder_is_due() and reminderStatus() disagree on ${mismatches.length} of ${cases.length} cases, e.g.\n` +
        mismatches.slice(0, 5).map((m) => JSON.stringify(m)).join('\n')
    );
  }
  console.log(`ok: reminder_is_due() agrees with reminderStatus() on ${cases.length} cases`);

  // The mileage both sides use: the highest reading on the car's log or its reminders.
  const car = '20000000-0000-0000-0000-000000000099';
  await client.query('begin');
  try {
    await client.query(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000099', 'k@x')`);
    await client.query(`insert into vehicles (id, vin) values ('10000000-0000-0000-0000-000000000099', 'KMVIN000000000099')`);
    await client.query(`insert into ownerships (id, vehicle_id, owner_id) values ('${car}', '10000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000099')`);
    const scenarios = [
      { entries: [], reminders: [] },
      { entries: [0], reminders: [] },
      { entries: [100, 250], reminders: [] },
      { entries: [100], reminders: [900] },
      { entries: [1000], reminders: [900, null] },
      { entries: [], reminders: [40000] },
      { entries: [null], reminders: [null] },
    ];
    for (const sc of scenarios) {
      await client.query(`delete from entries where ownership_id = '${car}'`);
      await client.query(`delete from reminders where ownership_id = '${car}'`);
      for (const odometer of sc.entries) {
        await client.query(
          `insert into entries (ownership_id, kind, title, occurred_on, odometer) values ('${car}', 'service', 'x', '2026-01-01', $1)`,
          [odometer]
        );
      }
      for (const odometer of sc.reminders) {
        await client.query(
          `insert into reminders (ownership_id, title, every_months, last_done_odometer) values ('${car}', 'r', 1, $1)`,
          [odometer]
        );
      }
      const database = (await client.query(`select public.known_mileage('${car}') as k`)).rows[0].k ?? undefined;
      const app = knownMileage(
        sc.entries.map((odometer) => ({ odometer: odometer ?? undefined })),
        sc.reminders.map((odometer) => ({ id: 'x', title: 'r', lastDoneOdometer: odometer ?? undefined }))
      );
      if (database !== app) {
        throw new Error(`known_mileage() says ${database}, knownMileage() says ${app} for ${JSON.stringify(sc)}`);
      }
    }
    console.log(`ok: known_mileage() agrees with knownMileage() on ${scenarios.length} scenarios`);
  } finally {
    await client.query('rollback');
  }
}

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
  await sameDecisionAsTheApp();
  await reminderEmailChecks({ port, admin: client });
} catch (error) {
  failed = true;
  console.error(`\n${error.message}`);
} finally {
  await client.end();
  await db.stop();
  fs.rmSync(dir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
