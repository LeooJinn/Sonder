/**
 * Behaviour checks for the reminder emails (migration 0015), run by run.mjs.
 *
 * They get a database of their own on the same server, built from the stub
 * and migrations 0001-0014, with a member and an overdue reminder already in
 * it, and then 0015 applied on top: so what 0015 does to existing rows (a
 * setting for every profile, what is already due being silenced) is tested
 * as it will happen in production, and nothing here can collide with the
 * fixtures in policies.sql.
 *
 * Dates are passed in (`on_date`) rather than waited for, so no check depends
 * on the clock except the one about a reminder created today.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const migrations = path.join(here, '../migrations');

export async function reminderEmailChecks({ port, admin }) {
  const files = fs.readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort();
  const name = 'reminder_emails_test';
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  const c = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: name });
  await c.connect();
  c.on('notice', (n) => { if (/warning|settle/i.test(n.message)) console.log('  notice:', n.message); });
  let n = 0;
  const q = async (s, p) => (await c.query(s, p)).rows;
  const one = async (s, p) => (await q(s, p))[0];
  const ok = (cond, what) => { n++; if (!cond) throw new Error('FAIL: ' + what); console.log('ok:', what); };
  const raises = async (sql, code, what) => { try { await c.query(sql); } catch (e) { ok(!code || e.code === code, what + ` (${e.code}: ${e.message.slice(0,60)})`); return; } throw new Error('FAIL (no error): ' + what); };
  const U = (k) => `00000000-0000-0000-0000-0000000000${k}`;
  try {
    await c.query(fs.readFileSync(path.join(here, 'supabase-stub.sql'), 'utf8'));
    // Everything up to 0014, so there is a member and a reminder in the
    // database before 0015 arrives, as there is in production.
    for (const f of files.filter((f) => f < '0015')) await c.query(fs.readFileSync(path.join(migrations, f), 'utf8'));
    // a member and a reminder that exist BEFORE 0015: backfill + silence
    await c.query(`insert into auth.users (id, email) values ('${U(30)}', 'old@x')`);
    await c.query(`insert into vehicles (id, vin, year, make, model) values ('10000000-0000-0000-0000-000000000030','OLDVIN00000000030','2015','Mazda','MX-5')`);
    await c.query(`insert into ownerships (id, vehicle_id, owner_id) values ('20000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000030','${U(30)}')`);
    await c.query(`insert into reminders (id, ownership_id, title, every_months, last_done_on, created_at) values ('60000000-0000-0000-0000-000000000030','20000000-0000-0000-0000-000000000030','Old overdue',6,'2025-01-01','2020-01-01')`);
    await c.query(fs.readFileSync(path.join(migrations, files.find((f) => f.startsWith('0015'))), 'utf8'));

    ok((await one(`select count(*)::int c from reminder_email_settings`)).c === (await one(`select count(*)::int c from profiles`)).c, 'backfill: every profile has a setting');
    ok((await one(`select count(*)::int c from reminder_emails where reminder_id = '60000000-0000-0000-0000-000000000030'`)).c === 1, 'migration silenced the reminder that was already overdue');
    await c.query(`insert into auth.users (id, email) values ('${U(31)}', 'ann@x'), ('${U(32)}', 'ben@x'), ('${U(33)}', 'cat@x')`);
    ok((await one(`select enabled, unsubscribe_token is not null t from reminder_email_settings where profile_id='${U(31)}'`)).enabled, 'trigger: new profile gets an enabled setting with a token');
    await c.query(`update reminder_email_settings set enabled = false where profile_id = '${U(30)}'`);

    await c.query(`insert into vehicles (id, vin, year, make, model) values
      ('10000000-0000-0000-0000-000000000031','VIN00000000000031','2020','Ford','Escape'),
      ('10000000-0000-0000-0000-000000000032','VIN00000000000032','2018','Honda','Civic'),
      ('10000000-0000-0000-0000-000000000033','VIN00000000000033','2019','Evil <script>http://x.co/a?b=1',E'Click\\nnow'),
      ('10000000-0000-0000-0000-000000000034','VIN00000000000034','2021','Kia','Soul')`);
    await c.query(`insert into ownerships (id, vehicle_id, owner_id) values
      ('20000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000031','${U(31)}'),
      ('20000000-0000-0000-0000-000000000032','10000000-0000-0000-0000-000000000032','${U(31)}'),
      ('20000000-0000-0000-0000-000000000033','10000000-0000-0000-0000-000000000033','${U(32)}'),
      ('20000000-0000-0000-0000-000000000034','10000000-0000-0000-0000-000000000034','${U(33)}')`);
    await c.query(`insert into entries (ownership_id, kind, title, notes, occurred_on, odometer, cost_cents) values
      ('20000000-0000-0000-0000-000000000031','service','SECRET entry title','secret notes','2026-05-01', 61234, 98765)`);
    // ann: oil (months due 2026-09-01), tires (miles: 50000+5000 <= 61234 due), coolant not due; civic: brake fluid due
    await c.query(`insert into reminders (id, ownership_id, title, every_miles, every_months, last_done_on, last_done_odometer, created_at) values
      ('60000000-0000-0000-0000-000000000031','20000000-0000-0000-0000-000000000031','Oil change',null,6,'2026-03-01',null,'2020-01-01'),
      ('60000000-0000-0000-0000-000000000032','20000000-0000-0000-0000-000000000031','Tire <b>rotation</b>',5000,null,null,50000,'2020-01-02'),
      ('60000000-0000-0000-0000-000000000033','20000000-0000-0000-0000-000000000031','Coolant',60000,60,'2026-01-01',60000,'2020-01-03'),
      ('60000000-0000-0000-0000-000000000034','20000000-0000-0000-0000-000000000032','Brake fluid',null,24,'2024-01-01',null,'2020-01-04'),
      ('60000000-0000-0000-0000-000000000035','20000000-0000-0000-0000-000000000033','Registration',null,12,'2025-01-01',null,'2020-01-05'),
      ('60000000-0000-0000-0000-000000000036','20000000-0000-0000-0000-000000000034','Untracked',null,12,null,null,'2020-01-06')`);

    const D = '2026-10-06';
    // --- no key -> nothing
    ok((await one(`select public.send_reminder_emails('${D}') r`)).r === 0, 'no key: returns 0');
    ok((await one(`select count(*)::int c from net.calls`)).c === 0 && (await one(`select count(*)::int c from reminder_emails`)).c === 1, 'no key: nothing posted or marked');
    await c.query(`insert into vault.decrypted_secrets values ('resend_api_key','re_test_key'),('message_email_from','Sonder <messages@imsonder.test>')`);

    // --- first run: per_run = 2 members, ann and ben (profile order)
    ok((await one(`select public.send_reminder_emails('${D}') r`)).r === 2, 'first run sends two digests (per-run cap)');
    const calls = await q(`select id, body from net.calls order by id`);
    const ann = calls.find(x => x.body.to[0] === 'ann@x').body, ben = calls.find(x => x.body.to[0] === 'ben@x').body;
    ok(ann.subject === '3 reminders are due on Sonder', 'subject is count only: ' + ann.subject);
    ok(ben.subject === 'A reminder is due on Sonder', 'single reminder subject: ' + ben.subject);
    ok(!/Ford|Escape|Oil|Tire|Civic/.test(ann.subject), 'subject names no car or title');
    ok(ann.html.includes('Tire &lt;b&gt;rotation&lt;/b&gt;') && !ann.html.includes('<b>rotation'), 'titles escaped in html');
    ok(ann.html.includes('2020 Ford Escape') && ann.html.includes('2018 Honda Civic'), 'both car labels, grouped');
    ok(!/VIN0000|61234|98765|SECRET|secret notes|\/vehicle\/|overdue by|2026-0|March/i.test(ann.html + ann.text), 'no VIN, mileage, cost, entry text, link to a vehicle, dates');
    ok(ann.html.includes('href="https://www.imsonder.com/"'), 'link is the garage root');
    const tok = (await one(`select unsubscribe_token t from reminder_email_settings where profile_id='${U(31)}'`)).t;
    ok(ann.headers['List-Unsubscribe'] === `<https://www.imsonder.com/api/unsubscribe?for=reminders&t=${tok}>` && ann.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click', 'one-click unsubscribe header, for= first');
    ok(ann.html.includes(`for=reminders&amp;t=${tok}`), 'html href uses &amp;');
    console.log('   ben car label:', JSON.stringify(ben.text.split('\n').slice(0,4)));
    ok(ben.text.split('\n')[2] === '2019 Evil scripthttpxcoab1 Click now', 'hostile car label is stripped of punctuation and newlines');
    ok(ann.from === 'Sonder <messages@imsonder.test>' && ann.to[0] === 'ann@x', 'from fallback and to');
    ok((await one(`select count(*)::int c from reminder_email_sends where status='pending'`)).c === 2, 'ledger has two pending sends');
    ok((await one(`select public.send_reminder_emails('${D}') r`)).r === 0, 'second run: nothing left (cat has nothing due, others in gap)');

    // --- settle by Resend's answers
    const [r1, r2] = (await q(`select request_id, profile_id from reminder_email_sends order by request_id`));
    await c.query(`insert into net._http_response (id, status_code) values (${r1.request_id}, 429)`);
    const annPending = r1.profile_id === U(31) ? r1 : r2, benPending = r1.profile_id === U(32) ? r1 : r2;
    await c.query(`delete from net._http_response`);
    await c.query(`insert into net._http_response (id, status_code) values (${annPending.request_id}, 429), (${benPending.request_id}, 422)`);
    ok((await one(`select public.send_reminder_emails('${D}') r`)).r === 1, '429 is released and ann is emailed again; 422 (ben) is not retried');
    const st = await q(`select request_id, profile_id, status from reminder_email_sends order by request_id`);
    ok(st.find(s => s.request_id === annPending.request_id).status === 'released' && st.find(s => s.request_id === benPending.request_id).status === 'rejected', 'ledger: ann released, ben rejected');
    ok(st.filter(s => s.status === 'pending').length === 1, 'one new pending send (ann again)');
    ok((await one(`select count(*)::int c from reminder_emails where reminder_id in ('60000000-0000-0000-0000-000000000031','60000000-0000-0000-0000-000000000032','60000000-0000-0000-0000-000000000034')`)).c === 3, 'ann reminders marked again after re-claim');
    // 200 delivered
    const newest = await one(`select request_id from reminder_email_sends where status='pending'`);
    await c.query(`insert into net._http_response (id, status_code) values (${newest.request_id}, 200)`);
    await c.query(`select public.send_reminder_emails('${D}')`);
    ok((await one(`select status from reminder_email_sends where request_id=${newest.request_id}`)).status === 'delivered', '200 settles as delivered');
    // timed-out / error released
    await c.query(`update reminder_email_sends set status='pending' where request_id=${newest.request_id}`);
    await c.query(`update net._http_response set status_code = null, timed_out = true where id = ${newest.request_id}`);
    ok((await one(`select public.send_reminder_emails('${D}') r`)).r === 1, 'a timed-out request is released and re-sent');
    // undo of a follow-up restores the earlier episode state (second row)
    await c.query(`update reminder_email_sends set status='delivered'`);

    // --- weekly gap, by date
    ok((await q(`select * from public.claim_reminder_emails(on_date => '2026-10-12', max_emails => 10)`)).length === 0, 'inside the 7-day gap: nothing, nothing due');
    await c.query(`insert into reminders (id, ownership_id, title, every_months, last_done_on, created_at) values ('60000000-0000-0000-0000-000000000037','20000000-0000-0000-0000-000000000031','Registration',12,'2025-10-10','2020-01-07')`);
    ok((await q(`select * from public.claim_reminder_emails(on_date => '2026-10-12', max_emails => 10)`)).length === 0, 'new reminder due 10-10 held back at day 6');
    const g = await q(`select * from public.claim_reminder_emails(on_date => '2026-10-13', max_emails => 10)`);
    ok(g.length === 1 && g[0].total === 1 && g[0].follow_up === false, 'released at day 7, alone, as a fresh email, not a follow-up');
    // --- follow-up at 14 days after first_sent_on (ann's first four were sent on D=10-06); 10-19 is 13 days
    ok((await q(`select * from public.claim_reminder_emails(on_date => '2026-10-19', max_emails => 10)`)).length === 0, 'no follow-up at 13 days');
    await c.query(`update reminder_email_settings set last_emailed_on = null`); // isolate follow-up rule from gap
    const f = await q(`select * from public.claim_reminder_emails(on_date => '2026-10-20', max_emails => 10)`);
    ok(f.length >= 1, 'follow-up at 14 days');
    const fa = f.find(x => x.email === 'ann@x');
    ok(fa && fa.follow_up === true && fa.total === 3, 'ann follow-up lists the 3 still-due reminders flagged follow_up, not the one emailed 7 days ago');
    ok(fa.cars.length === 2, 'follow-up groups by car');
    // marks went to count 2; never a third
    await c.query(`update reminder_email_settings set last_emailed_on = null`);
    ok((await q(`select * from public.claim_reminder_emails(on_date => '2026-11-30', max_emails => 10)`)).filter(x => x.email === 'ann@x').length === 1 , 'only the 10-13 reminder gets its follow-up later (the other three are at count 2)');
    ok((await q(`select * from public.claim_reminder_emails(on_date => '2027-02-01', max_emails => 10)`)).filter(x => x.email === 'ann@x').length === 0, 'never a third email in an episode');

    // --- re-arm: tick off (last_done changes) => new episode, fresh not follow-up
    await c.query(`update reminders set last_done_on = '2026-10-01' where id = '60000000-0000-0000-0000-000000000031'`); // oil: due 2027-04-01
    await c.query(`select * from public.claim_reminder_emails(on_date => '2026-10-21', max_emails => 10)`);
    ok((await one(`select count(*)::int c from reminder_emails where reminder_id='60000000-0000-0000-0000-000000000031'`)).c === 0, 'sweep: a reminder that is no longer due loses its record');
    await c.query(`update reminders set last_done_on = '2025-01-01' where id = '60000000-0000-0000-0000-000000000031'`); // due again
    await c.query(`update reminder_email_settings set last_emailed_on = null`);
    const re = (await q(`select * from public.claim_reminder_emails(on_date => '2026-10-22', max_emails => 10)`)).find(x => x.email === 'ann@x');
    ok(re && re.follow_up === false && re.total === 1, 're-armed reminder is a fresh email');
    // title-only edit does not reset
    await c.query(`update reminders set title = 'Oil and filter' where id = '60000000-0000-0000-0000-000000000031'`);
    await c.query(`update reminder_email_settings set last_emailed_on = null`);
    ok((await q(`select * from public.claim_reminder_emails(on_date => '2026-10-23', max_emails => 10)`)).filter(x => x.email === 'ann@x').length === 0, 'editing the title is not a reset');
    // interval edit clears then re-due
    await c.query(`update reminders set every_months = 240 where id = '60000000-0000-0000-0000-000000000031'`);
    await c.query(`select * from public.claim_reminder_emails(on_date => '2026-10-24', max_emails => 10)`);
    await c.query(`update reminders set every_months = 6 where id = '60000000-0000-0000-0000-000000000031'`);
    ok((await q(`select * from public.claim_reminder_emails(on_date => '2026-10-25', max_emails => 10)`)).filter(x => x.email === 'ann@x' && x.follow_up === false).length === 1, 'interval edited away then back is a fresh email');

    // --- settle: reminder created today waits
    await c.query(`insert into reminders (id, ownership_id, title, every_months, last_done_on) values ('60000000-0000-0000-0000-000000000038','20000000-0000-0000-0000-000000000034','Fresh today',1,'2020-01-01')`);
    await c.query(`update reminder_email_settings set last_emailed_on = null`);
    const today = (await one(`select (now() at time zone 'utc')::date d`)).d.toISOString().slice(0,10);
    ok((await q(`select * from public.claim_reminder_emails(on_date => '${today}', max_emails => 10)`)).filter(x => x.email === 'cat@x').length === 0, 'a reminder created today is held back (settle_days 2)');
    ok((await q(`select * from public.claim_reminder_emails(settle_days => 0, on_date => '${today}', max_emails => 10)`)).filter(x => x.email === 'cat@x').length === 1, 'settle_days => 0 releases it (the owner\'s try-it)');
    await c.query(`delete from reminder_emails`);

    // --- exclusions
    await c.query(`update reminder_email_settings set last_emailed_on = null, enabled = true where profile_id in ('${U(31)}','${U(32)}','${U(33)}')`);
    const who = async () => (await q(`select email from public.claim_reminder_emails(on_date => '2026-12-01', settle_days => 0, max_emails => 10)`)).map(x => x.email).sort().join(',');
    await c.query(`begin`); 
    await c.query(`update reminder_email_settings set enabled = false where profile_id = '${U(31)}'`);
    ok(!(await who()).includes('ann@x'), 'switch off: not emailed'); ok((await one(`select count(*)::int c from reminder_emails r join reminders m on m.id=r.reminder_id where m.ownership_id in ('20000000-0000-0000-0000-000000000031','20000000-0000-0000-0000-000000000032')`)).c === 0, 'switch off: nothing marked');
    await c.query(`rollback`);
    await c.query(`begin`);
    await c.query(`update auth.users set banned_until = now() + interval '1 day' where id = '${U(31)}'`);
    ok(!(await who()).includes('ann@x'), 'banned: not emailed'); await c.query(`rollback`);
    await c.query(`begin`); await c.query(`update auth.users set email_confirmed_at = null where id = '${U(31)}'`);
    ok(!(await who()).includes('ann@x'), 'unconfirmed: not emailed'); await c.query(`rollback`);
    await c.query(`begin`); await c.query(`update auth.users set email = null where id = '${U(31)}'`);
    ok(!(await who()).includes('ann@x'), 'no address: not emailed'); await c.query(`rollback`);
    await c.query(`begin`); await c.query(`update ownerships set ended_on = '2026-11-01' where id in ('20000000-0000-0000-0000-000000000031','20000000-0000-0000-0000-000000000032')`);
    ok(!(await who()).includes('ann@x'), 'sold cars: not emailed'); await c.query(`rollback`);
    await c.query(`begin`); await c.query(`update ownerships set owner_id = null where id in ('20000000-0000-0000-0000-000000000031','20000000-0000-0000-0000-000000000032')`);
    ok(!(await who()).includes('ann@x'), 'orphaned ownership: not emailed'); await c.query(`rollback`);
    await c.query(`delete from reminder_emails`);

    // --- poison rows
    await raises(`set role authenticated; set request.jwt.claim.sub = '${U(33)}'; insert into reminders (ownership_id, title, every_months, last_done_on) values ('20000000-0000-0000-0000-000000000034','Poison',12,'5874897-12-31')`, '23514', 'a member cannot write a date out of range');
    await c.query(`reset role`);
    await c.query(`alter table reminders drop constraint reminders_last_done_on_sane`);
    await c.query(`insert into reminders (id, ownership_id, title, every_months, last_done_on, created_at) values ('60000000-0000-0000-0000-000000000039','20000000-0000-0000-0000-000000000034','Poison',12,'5874897-12-31','2020-01-01')`);
    const pz = await q(`select * from public.claim_reminder_emails(on_date => '2026-12-01', settle_days => 0, max_emails => 10)`);
    ok(pz.length >= 2, 'a legacy out-of-range row does not stop the run for everyone');
    ok(!pz.some(x => x.email === 'cat@x' && x.total > 1), 'and is never itself due');
    await c.query(`delete from reminders where id = '60000000-0000-0000-0000-000000000039'`);
    await c.query(`alter table reminders add constraint reminders_last_done_on_sane check (last_done_on is null or last_done_on between date '1900-01-01' and date '2100-12-31') not valid`);
    await c.query(`delete from reminder_emails`);
    ok((await one(`select public.reminder_is_due(2147483647, null, null, 2147483647, 0, '2026-01-01') r`)).r === false, 'int overflow guarded');

    // --- daily cap
    await c.query(`delete from reminder_email_sends`); await c.query(`delete from net.calls`);
    for (let i = 0; i < 39; i++) await c.query(`insert into reminder_email_sends (request_id, profile_id, sent_on, status, undo) values (${9000+i}, '${U(31)}', '2026-12-05', 'delivered', '{}')`);
    await c.query(`update reminder_email_settings set last_emailed_on = null`);
    ok((await one(`select public.send_reminder_emails('2026-12-05', 0) r`)).r === 1, 'daily cap: 39 already sent leaves room for one');
    await c.query(`update reminder_email_settings set last_emailed_on = null`);
    ok((await one(`select public.send_reminder_emails('2026-12-05', 0) r`)).r === 0, 'daily cap reached: nothing more today');
    await c.query(`delete from reminder_email_sends`); await c.query(`delete from reminder_emails`);

    // --- settle table missing: sending still works
    await c.query(`alter table net._http_response rename to _http_response_x`);
    await c.query(`update reminder_email_settings set last_emailed_on = null`);
    ok((await one(`select public.send_reminder_emails('2026-12-09', 0) r`)).r >= 1, 'if pg_net\'s table is not as expected, emails still go out');
    await c.query(`alter table net._http_response_x rename to _http_response`);

    // --- advisory lock
    const c2 = new pg.Client({host:'localhost',port,user:'postgres',password:'postgres',database: name }); await c2.connect();
    await c2.query(`begin`); await c2.query(`select pg_advisory_xact_lock(hashtext('send_reminder_emails'))`);
    await c.query(`update reminder_email_settings set last_emailed_on = null`); await c.query(`delete from reminder_emails`);
    ok((await one(`select public.send_reminder_emails('2026-12-20', 0) r`)).r === 0, 'while another session holds the lock: returns 0');
    await c2.query(`rollback`); await c2.end();

    // --- privileges
    for (const fn of [`public.send_reminder_emails()`, `public.claim_reminder_emails()`, `public.settle_reminder_email_sends()`, `public.silence_current_reminder_emails()`, `public.known_mileage('20000000-0000-0000-0000-000000000031')`, `public.reminder_is_due(1,1,null,null,null,null)`, `public.email_car('a','b','c')`]) {
      for (const role of ['authenticated','anon']) { await raises(`set role ${role}; select ${fn}`, '42501', `${role} cannot run ${fn.split('(')[0]}`); await c.query('reset role'); }
    }
    for (const t of ['reminder_emails','reminder_email_sends']) { for (const role of ['authenticated','anon']) { await raises(`set role ${role}; select * from ${t}`, '42501', `${role} cannot read ${t}`); await c.query('reset role'); } }
    await c.query(`set role authenticated; set request.jwt.claim.sub = '${U(31)}'`);
    ok((await q(`select * from reminder_email_settings`)).length === 1, 'a member reads exactly their own setting');
    await c.query(`update reminder_email_settings set enabled = false`);
    ok((await q(`select enabled from reminder_email_settings`))[0].enabled === false, 'a member can flip the switch');
    await c.query(`reset role`);
    for (const col of ['unsubscribe_token = gen_random_uuid()', 'last_emailed_on = now()::date', `profile_id = '${U(32)}'`]) { await raises(`set role authenticated; set request.jwt.claim.sub = '${U(31)}'; update reminder_email_settings set ${col}`, '42501', 'member cannot change ' + col.split(' ')[0]); await c.query('reset role'); }
    await c.query(`set role anon`); await raises(`select * from reminder_email_settings`, '42501', 'anon cannot read settings'); await c.query('reset role');
    // unsubscribe
    const t2 = (await one(`select unsubscribe_token t from reminder_email_settings where profile_id='${U(32)}'`)).t;
    await c.query(`set role anon`);
    ok((await one(`select public.unsubscribe_reminder_emails(gen_random_uuid()) r`)).r === false, 'wrong token: false');
    const mtok = (await (async () => { await c.query('reset role'); return one(`select unsubscribe_token t from message_email_settings where profile_id='${U(32)}'`); })()).t;
    await c.query(`set role anon`);
    ok((await one(`select public.unsubscribe_reminder_emails('${mtok}') r`)).r === false, 'a message-email token does not unsubscribe reminders');
    ok((await one(`select public.unsubscribe_reminder_emails('${t2}') r`)).r === true, 'right token: true, callable as anon');
    await c.query('reset role');
    ok((await one(`select r.enabled r, m.enabled m from reminder_email_settings r, message_email_settings m where r.profile_id='${U(32)}' and m.profile_id='${U(32)}'`)).m === true, 'message emails untouched');

    // --- undo restores a follow-up to its earlier state
    await c.query(`delete from reminder_emails; delete from reminder_email_sends; delete from net.calls; delete from net._http_response`);
    await c.query(`update reminder_email_settings set enabled = (profile_id = '${U(33)}'), last_emailed_on = null`);
    await c.query(`select public.send_reminder_emails('2027-01-01', 0)`);
    const a = await one(`select request_id from reminder_email_sends where status = 'pending'`);
    await c.query(`insert into net._http_response (id, status_code) values (${a.request_id}, 200)`);
    ok((await one(`select public.send_reminder_emails('2027-01-15', 0) r`)).r === 1, 'follow-up sent 14 days later');
    const b = await one(`select request_id from reminder_email_sends where status = 'pending'`);
    const mid = await one(`select sent_count, first_sent_on::text f, last_sent_on::text l from reminder_emails where reminder_id = '60000000-0000-0000-0000-000000000038'`);
    ok(mid.sent_count === 2 && mid.f === '2027-01-01' && mid.l === '2027-01-15', 'follow-up marks: count 2');
    await c.query(`insert into net._http_response (id, status_code) values (${b.request_id}, 503)`);
    ok((await one(`select public.settle_reminder_email_sends() r`)).r === 1, 'a 503 on the follow-up is undone');
    const back = await one(`select sent_count, first_sent_on::text f, last_sent_on::text l from reminder_emails where reminder_id = '60000000-0000-0000-0000-000000000038'`);
    ok(back.sent_count === 1 && back.f === '2027-01-01' && back.l === '2027-01-01', 'undo restores the first email\'s record');
    ok((await one(`select last_emailed_on::text d from reminder_email_settings where profile_id = '${U(33)}'`)).d === '2027-01-01', 'undo restores last_emailed_on');
    // first email undone -> no record at all
    await c.query(`delete from reminder_emails; delete from reminder_email_sends; delete from net.calls; delete from net._http_response`);
    await c.query(`update reminder_email_settings set last_emailed_on = null`);
    await c.query(`select public.send_reminder_emails('2027-02-01', 0)`);
    const f1 = await one(`select request_id from reminder_email_sends where status = 'pending'`);
    await c.query(`insert into net._http_response (id, status_code) values (${f1.request_id}, 429)`);
    await c.query(`select public.settle_reminder_email_sends()`);
    ok((await one(`select count(*)::int c from reminder_emails`)).c === 0 && (await one(`select last_emailed_on d from reminder_email_settings where profile_id = '${U(33)}'`)).d === null, 'a refused first email leaves no trace; the next run sends it');
    // undo for a reminder deleted in between does not fail
    await c.query(`select public.send_reminder_emails('2027-02-01', 0)`);
    const f2 = await one(`select request_id from reminder_email_sends where status = 'pending'`);
    await c.query(`delete from reminders where id = '60000000-0000-0000-0000-000000000038'`);
    await c.query(`insert into net._http_response (id, status_code) values (${f2.request_id}, 429) on conflict (id) do update set status_code = 429`);
    await c.query(`select public.settle_reminder_email_sends()`);
    ok(true, 'undo after the reminder was deleted does not fail');
    await c.query(`update reminder_email_settings set enabled = true`);
    // --- silence
    await c.query(`delete from reminder_emails`);
    const sil = (await one(`select public.silence_current_reminder_emails('2026-12-21') n`)).n;
    ok(sil >= 3, 'silence marks what is due: ' + sil);
    await c.query(`update reminder_email_settings set last_emailed_on = null, enabled = true`);
    ok((await q(`select * from public.claim_reminder_emails(on_date => '2026-12-22', settle_days => 0, max_emails => 10)`)).length === 0, 'silenced reminders stay quiet');
    ok((await one(`select count(*)::int c from reminder_emails where sent_count = 2`)).c === sil, 'silenced rows are at the follow-up cap');

    // --- one car's readings never count for another's
    ok((await one(`select public.known_mileage('20000000-0000-0000-0000-000000000032') k`)).k === null, 'known_mileage ignores readings on other cars');

    // --- cascade
    await c.query(`delete from auth.users where id = '${U(31)}'`);
    ok((await one(`select count(*)::int c from reminder_email_settings where profile_id='${U(31)}'`)).c === 0, 'deleting an account removes its setting');
    await c.query(`delete from ownerships where id in ('20000000-0000-0000-0000-000000000031','20000000-0000-0000-0000-000000000032')`);
    ok((await one(`select count(*)::int c from reminder_emails where reminder_id in ('60000000-0000-0000-0000-000000000031','60000000-0000-0000-0000-000000000034')`)).c === 0, 'deleting the ownership removes the episode records');
  } finally {
    await c.end();
    await admin.query(`drop database if exists ${name}`);
  }
  console.log(`${n} reminder email checks passed.`);
}
