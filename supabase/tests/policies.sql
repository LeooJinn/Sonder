-- Policy checks, run by run.mjs after every migration has been applied.
--
-- Each check raises on failure, so the file stops at the first broken rule.
-- The fixture: Sam owned an MX-5 privately and sold it to Bea, who published
-- it; Sam also owns a Civic he never published; a third member is a stranger
-- to both.

-- Fixture, as superuser.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'seller@x'),
  ('00000000-0000-0000-0000-00000000000b', 'buyer@x'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@x');
update profiles set handle = 'seller', display_name = 'Sam' where id = '00000000-0000-0000-0000-00000000000a';
update profiles set handle = 'buyer', display_name = 'Bea', region = 'us-ca-los-angeles' where id = '00000000-0000-0000-0000-00000000000b';

insert into vehicles (id, vin, make, model) values
  ('10000000-0000-0000-0000-000000000001', 'JM1NA3510T0712233', 'Mazda', 'MX-5'),
  ('10000000-0000-0000-0000-000000000002', 'SHHFK8G72KU201847', 'Honda', 'Civic');

-- Car 1: Sam owned it privately, sold to Bea, Bea published.
insert into ownerships (id, vehicle_id, owner_id, started_on, ended_on, is_public) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '2008-01-01', '2025-06-01', false),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '2025-06-01', null, true);
-- Car 2: Sam's, private.
insert into ownerships (id, vehicle_id, owner_id, is_public) values
  ('20000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', false);

insert into entries (id, ownership_id, kind, title, occurred_on) values
  ('30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'repair', 'Timing belt', '2023-09-02'),
  ('30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'service', 'Fluids', '2025-06-09'),
  ('30000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000c', 'mod', 'Private mod', '2025-01-01');
insert into parts (entry_id, brand, name) values ('30000000-0000-0000-0000-00000000000a', 'Gates', 'Belt kit');
insert into photos (id, entry_id, storage_path, position) values
  ('40000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a', 'a/1.jpg', 0);
insert into photos (id, ownership_id, storage_path, position) values
  ('40000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000a', 'a/2.jpg', 0),
  ('40000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000c', 'a/3.jpg', 0);

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', what; end if;
  raise notice 'ok: %', what;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

-- ---------------- 0007: anonymous visitor ----------------
set role anon;
select pg_temp.check((select count(*) from ownerships where vehicle_id = '10000000-0000-0000-0000-000000000001') = 2, 'anon sees both periods of the published car');
select pg_temp.check((select count(*) from entries) = 2, 'anon sees entries from both periods, none from the private car');
select pg_temp.check((select count(*) from parts) = 1, 'anon sees parts on the previous owner''s entry');
select pg_temp.check((select count(*) from photos) = 2, 'anon sees prior entry + gallery photos, not the private car''s');
select pg_temp.check((select count(*) from ownerships where vehicle_id = '10000000-0000-0000-0000-000000000002') = 0, 'anon sees nothing of the private car');
select pg_temp.check((select count(*) from profiles where id = '00000000-0000-0000-0000-00000000000a') = 0, 'anon cannot read the unpublished previous owner''s profile');
select pg_temp.check((select count(*) from profiles where id = '00000000-0000-0000-0000-00000000000b') = 1, 'anon can read the publishing owner''s profile');
select pg_temp.check((select count(*) from meets) = 0, 'anon reads no meets');
reset role;

-- Unpublishing closes the whole chain again.
update ownerships set is_public = false where id = '20000000-0000-0000-0000-00000000000b';
set role anon;
select pg_temp.check((select count(*) from entries) = 0, 'unpublishing hides every period');
reset role;
update ownerships set is_public = true where id = '20000000-0000-0000-0000-00000000000b';

-- Anonymous writes are still impossible.
set role anon;
do $$ begin
  update entries set title = 'vandalised';
  if exists (select 1 from entries where title = 'vandalised') then raise exception 'FAIL: anon updated an entry'; end if;
  raise notice 'ok: anon cannot edit published history';
end $$;
reset role;

-- ---------------- 0008: for sale ----------------
update ownerships set for_sale = true, asking_price_cents = 900000, sale_contact = 'DM @buyer' where id = '20000000-0000-0000-0000-00000000000b';
select pg_temp.check((select listed_at is not null from ownerships where id = '20000000-0000-0000-0000-00000000000b'), 'listing stamps listed_at');
update ownerships set for_sale = true where id = '20000000-0000-0000-0000-00000000000c';
select pg_temp.check((select not for_sale from ownerships where id = '20000000-0000-0000-0000-00000000000c'), 'a private car cannot be listed');
set role anon;
select pg_temp.check((select count(*) from ownerships where for_sale) = 1, 'anon sees the listing');
reset role;
update ownerships set is_public = false where id = '20000000-0000-0000-0000-00000000000b';
select pg_temp.check((select not for_sale and listed_at is null from ownerships where id = '20000000-0000-0000-0000-00000000000b'), 'unpublishing delists');
update ownerships set is_public = true, for_sale = true where id = '20000000-0000-0000-0000-00000000000b';
update ownerships set ended_on = current_date where id = '20000000-0000-0000-0000-00000000000b';
select pg_temp.check((select not for_sale from ownerships where id = '20000000-0000-0000-0000-00000000000b'), 'selling delists');
update ownerships set ended_on = null where id = '20000000-0000-0000-0000-00000000000b';

-- ---------------- 0009: meets ----------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into meets (id, host_id, title, region, place, starts_at) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Sunday coffee', 'us-ca-los-angeles', 'Griffith Observatory lot', now() + interval '3 days');
insert into meet_rsvps (meet_id, profile_id, vehicle_id) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001');
select pg_temp.check(true, 'owner RSVPs with a car they own');
do $$ begin
  insert into meets (host_id, title, region, place, starts_at) values ('00000000-0000-0000-0000-00000000000a', 'Fake', 'x', 'y', now());
  raise exception 'FAIL: hosted a meet as someone else';
exception when insufficient_privilege then raise notice 'ok: cannot host as someone else';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from meets) = 1, 'another member reads the meet');
select pg_temp.check((select count(*) from meet_rsvps) = 1, 'another member reads who is going');
do $$ begin
  insert into meet_rsvps (meet_id, profile_id, vehicle_id) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001');
  raise exception 'FAIL: RSVPd with a car they do not own';
exception when insufficient_privilege then raise notice 'ok: cannot bring a car you do not own';
end $$;
insert into meet_rsvps (meet_id, profile_id) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c');
select pg_temp.check(true, 'member RSVPs without a car');
delete from meets where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) from meets) = 1, 'a non-host cannot cancel the meet');
reset role;

-- Account deletion still works with the new tables in place.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.delete_my_account();
reset role;
select pg_temp.check((select count(*) from meets) = 0, 'deleting the host removes their meets');
select pg_temp.check((select count(*) from ownerships where id = '20000000-0000-0000-0000-00000000000a') = 1, 'the previous owner''s period survives the buyer deleting their account');


-- ---------------- 0010: reminders ----------------
-- Sam still owns the private Civic (ownership ...0c). The stranger owns nothing.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into reminders (id, ownership_id, title, every_miles, every_months, last_done_on, last_done_odometer)
  values ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000c', 'Oil change', 5000, 6, '2026-03-01', 50000);
select pg_temp.check(true, 'owner adds a reminder to their car');
do $$ begin
  insert into reminders (ownership_id, title) values ('20000000-0000-0000-0000-00000000000c', 'Never due');
  raise exception 'FAIL: reminder without an interval';
exception when check_violation then raise notice 'ok: a reminder needs an interval';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from reminders) = 0, 'nobody else reads your reminders');
do $$ begin
  insert into reminders (ownership_id, title, every_months) values ('20000000-0000-0000-0000-00000000000c', 'Sneaky', 1);
  raise exception 'FAIL: added a reminder to someone else''s car';
exception when insufficient_privilege then raise notice 'ok: cannot add reminders to someone else''s car';
end $$;
reset role;

-- ---------------- 0011: reports and blocks ----------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'd@x'),
  ('00000000-0000-0000-0000-00000000000e', 'e@x'),
  ('00000000-0000-0000-0000-00000000000f', 'f@x');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into meets (id, host_id, title, region, place, starts_at) values
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'Free crypto giveaway', 'us-ca-los-angeles', 'DM me', now() + interval '1 day');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000d', 'meet', '50000000-0000-0000-0000-000000000002', 'spam');
select pg_temp.check((select count(*) from reports) = 0, 'reporters cannot read reports, even their own');
do $$ begin
  insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000d', 'meet', '50000000-0000-0000-0000-000000000002', 'spam');
  raise exception 'FAIL: reported the same meet twice';
exception when unique_violation then raise notice 'ok: one report per member per meet';
end $$;
do $$ begin
  insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000e', 'meet', '50000000-0000-0000-0000-000000000002', 'spam');
  raise exception 'FAIL: reported as someone else';
exception when insufficient_privilege then raise notice 'ok: cannot report as someone else';
end $$;
select pg_temp.check((select count(*) from meets where id = '50000000-0000-0000-0000-000000000002') = 1, 'one report does not hide a meet');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000e', 'meet', '50000000-0000-0000-0000-000000000002', 'scam');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000f', 'meet', '50000000-0000-0000-0000-000000000002', 'spam');
select pg_temp.check((select count(*) from meets where id = '50000000-0000-0000-0000-000000000002') = 0, 'three reports hide the meet from members');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select hidden_at is not null from meets where id = '50000000-0000-0000-0000-000000000002'), 'the host still sees their hidden meet, marked hidden');
reset role;

-- Sam publishes and lists the Civic; three members report the listing.
update ownerships set is_public = true, for_sale = true, asking_price_cents = 100 where id = '20000000-0000-0000-0000-00000000000c';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000d', 'listing', '20000000-0000-0000-0000-00000000000c', 'scam');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000e', 'listing', '20000000-0000-0000-0000-00000000000c', 'scam');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000f', 'listing', '20000000-0000-0000-0000-00000000000c', 'scam');
reset role;
select pg_temp.check((select not for_sale from ownerships where id = '20000000-0000-0000-0000-00000000000c'), 'three reports take a listing off the market');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update ownerships set for_sale = true where id = '20000000-0000-0000-0000-00000000000c';
select pg_temp.check((select not for_sale from ownerships where id = '20000000-0000-0000-0000-00000000000c'), 'a reported listing cannot simply be relisted');
update ownerships set is_public = true where id = '20000000-0000-0000-0000-00000000000c';
select pg_temp.check((select is_public from ownerships where id = '20000000-0000-0000-0000-00000000000c'), 'the owner can still use their car normally');

-- Blocks are private to the blocker.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from blocks) = 1, 'a member sees who they blocked');
do $$ begin
  insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d');
  raise exception 'FAIL: blocked themselves';
exception when check_violation then raise notice 'ok: cannot block yourself';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select pg_temp.check((select count(*) from blocks) = 0, 'nobody else sees a member''s blocks');
reset role;

set role anon;
do $$ begin
  insert into reports (reporter_id, target_kind, target_id, reason) values ('00000000-0000-0000-0000-00000000000d', 'meet', '50000000-0000-0000-0000-000000000002', 'spam');
  raise exception 'FAIL: anonymous report';
exception when insufficient_privilege then raise notice 'ok: visitors cannot file reports';
end $$;
reset role;

-- ---------------- 0012: following ----------------
-- Where things stand: Sam ('seller') owns the Civic, now published. The MX-5
-- has no current owner since Bea deleted her account; Sam's old period of it
-- is private. Dee buys the MX-5 and publishes it. Eve follows things.
update profiles set handle = 'eve' where id = '00000000-0000-0000-0000-00000000000e';
insert into ownerships (id, vehicle_id, owner_id, started_on, is_public) values
  ('20000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', '2026-01-01', true);
select pg_temp.check((select published_at is not null from ownerships where id = '20000000-0000-0000-0000-00000000000d'), 'publishing stamps published_at');
update ownerships set is_public = false where id = '20000000-0000-0000-0000-00000000000d';
select pg_temp.check((select published_at is not null from ownerships where id = '20000000-0000-0000-0000-00000000000d'), 'unpublishing keeps the old stamp');
update ownerships set is_public = true where id = '20000000-0000-0000-0000-00000000000d';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
insert into car_follows (follower_id, vehicle_id) values ('00000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000002');
select pg_temp.check(true, 'a member follows a published car');
insert into member_follows (follower_id, followed_id) values ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000a');
select pg_temp.check(true, 'a member follows a person with a handle');
do $$ begin
  insert into member_follows (follower_id, followed_id) values ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000f');
  raise exception 'FAIL: followed someone with no handle';
exception when insufficient_privilege then raise notice 'ok: cannot follow someone with no page';
end $$;
do $$ begin
  insert into member_follows (follower_id, followed_id) values ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000e');
  raise exception 'FAIL: followed themselves';
exception when check_violation then raise notice 'ok: cannot follow yourself';
end $$;
do $$ begin
  insert into car_follows (follower_id, vehicle_id) values ('00000000-0000-0000-0000-00000000000f', '10000000-0000-0000-0000-000000000002');
  raise exception 'FAIL: followed as someone else';
exception when insufficient_privilege then raise notice 'ok: cannot follow as someone else';
end $$;

-- Following Sam must not attribute his private MX-5 period to him, even
-- though Dee's publishing makes that period readable, unnamed.
select pg_temp.check((select count(*) from entries where id = '30000000-0000-0000-0000-00000000000a') = 1, 'Sam''s old MX-5 entry is readable through Dee''s passport');
select pg_temp.check((select count(*) from public.my_feed() where entry_id = '30000000-0000-0000-0000-00000000000a') = 0, 'following a person skips periods they never published');
select pg_temp.check((select count(*) from public.my_feed() where kind = 'entry' and entry_id = '30000000-0000-0000-0000-00000000000c' and actor_id = '00000000-0000-0000-0000-00000000000a') = 1, 'the feed shows the Civic''s entry, credited to Sam');
select pg_temp.check((select count(*) from public.my_feed() where kind = 'published' and ownership_id = '20000000-0000-0000-0000-00000000000c') = 1, 'the feed shows the Civic being published, once despite two follows');

insert into car_follows (follower_id, vehicle_id) values ('00000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.my_feed() where entry_id = '30000000-0000-0000-0000-00000000000a' and actor_id is null) = 1, 'following the car shows its earlier history, unattributed');
select pg_temp.check((select count(*) from public.my_feed() where kind = 'sold') = 0, 'a sale shows only if the seller published');
select pg_temp.check((select count(*) from public.my_feed(max_items => 1)) = 1, 'the feed pages');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
do $$ begin
  insert into car_follows (follower_id, vehicle_id) values ('00000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000001');
  raise exception 'FAIL: followed their own car';
exception when insufficient_privilege then raise notice 'ok: cannot follow your own car';
end $$;
select pg_temp.check((select count(*) from car_follows) = 1, 'the owner sees who follows their car');
select pg_temp.check((select count(*) from member_follows) = 0, 'nobody else sees who follows a person');
reset role;

set role anon;
select pg_temp.check(public.car_follower_count('10000000-0000-0000-0000-000000000002') = 1, 'follower counts are public');
select pg_temp.check(public.member_follower_count('00000000-0000-0000-0000-00000000000a') = 1, 'person follower counts are public');
select pg_temp.check((select count(*) from car_follows) = 0, 'visitors cannot list followers');
do $$ begin
  perform public.my_feed();
  raise exception 'FAIL: a visitor read a feed';
exception when insufficient_privilege then raise notice 'ok: visitors have no feed';
end $$;
reset role;

-- A meet hosted by someone followed arrives in the feed.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into meets (id, host_id, title, region, place, starts_at) values
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'Civic night', 'us-ca-los-angeles', 'Lot', now() + interval '2 days');
select pg_temp.check((select count(*) from member_follows) = 1, 'the followed person sees their follower');
update profiles set feed_seen_at = now() where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check(true, 'a member marks their feed seen');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select pg_temp.check((select count(*) from public.my_feed() where kind = 'meet') = 1, 'a followed person''s meet reaches the feed');

-- Sam blocks Eve: every follow between them goes, and can't come back.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000e');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select pg_temp.check((select count(*) from member_follows) = 0, 'blocking removes the person follow');
select pg_temp.check((select count(*) from car_follows where vehicle_id = '10000000-0000-0000-0000-000000000002') = 0, 'blocking removes follows of the blocker''s cars');
select pg_temp.check((select count(*) from car_follows where vehicle_id = '10000000-0000-0000-0000-000000000001') = 1, 'follows of other people''s cars survive a block');
select pg_temp.check((select count(*) from public.my_feed() where actor_id = '00000000-0000-0000-0000-00000000000a') = 0, 'the blocker vanishes from the feed');
do $$ begin
  insert into car_follows (follower_id, vehicle_id) values ('00000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000002');
  raise exception 'FAIL: followed a blocker''s car';
exception when insufficient_privilege then raise notice 'ok: cannot follow the car of someone who blocked you';
end $$;
do $$ begin
  insert into member_follows (follower_id, followed_id) values ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL: followed a blocker';
exception when insufficient_privilege then raise notice 'ok: cannot follow someone who blocked you';
end $$;
reset role;

-- ---------------- 0013: messages ----------------
-- Gia follows Hal, Jo and Kit and they follow her back. Ivy follows Gia but
-- isn't followed back, so she is a stranger as far as messaging goes.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000011', 'gia@x'),
  ('00000000-0000-0000-0000-000000000012', 'hal@x'),
  ('00000000-0000-0000-0000-000000000013', 'ivy@x'),
  ('00000000-0000-0000-0000-000000000014', 'jo@x'),
  ('00000000-0000-0000-0000-000000000015', 'kit@x');
update profiles set handle = 'gia' where id = '00000000-0000-0000-0000-000000000011';
update profiles set handle = 'hal' where id = '00000000-0000-0000-0000-000000000012';
update profiles set handle = 'ivy' where id = '00000000-0000-0000-0000-000000000013';
update profiles set handle = 'jo'  where id = '00000000-0000-0000-0000-000000000014';
update profiles set handle = 'kit' where id = '00000000-0000-0000-0000-000000000015';
insert into member_follows (follower_id, followed_id) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000014'),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000015'),
  ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000011');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
do $$ begin
  perform public.start_conversation('00000000-0000-0000-0000-000000000013');
  raise exception 'FAIL: started a conversation without a mutual follow';
exception when insufficient_privilege then raise notice 'ok: a one-way follow is not enough to message';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000013';
do $$ begin
  perform public.start_conversation('00000000-0000-0000-0000-000000000011');
  raise exception 'FAIL: the follower started a conversation';
exception when insufficient_privilege then raise notice 'ok: the follower cannot start it either';
end $$;
do $$ begin
  perform public.start_conversation('00000000-0000-0000-0000-000000000013');
  raise exception 'FAIL: messaged themselves';
exception when invalid_parameter_value then raise notice 'ok: cannot message yourself';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select set_config('t.gh', public.start_conversation('00000000-0000-0000-0000-000000000012')::text, false);
select pg_temp.check(public.start_conversation('00000000-0000-0000-0000-000000000012') = current_setting('t.gh')::uuid, 'asking again returns the same conversation');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
select pg_temp.check(public.start_conversation('00000000-0000-0000-0000-000000000011') = current_setting('t.gh')::uuid, 'the other side finds the same conversation');
select pg_temp.check((select count(*) from public.my_inbox()) = 0, 'a conversation with nothing said is not in the inbox');

-- Sending.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
insert into messages (id, conversation_id, sender_id, body)
  values ('70000000-0000-0000-0000-000000000001', current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', 'Saw your MX-5 on the feed. Gorgeous.');
select pg_temp.check(true, 'a member messages someone they follow mutually');
select pg_temp.check((select count(*) from public.my_inbox() where unread = 0) = 1, 'you have read what you wrote');
select pg_temp.check(public.unread_message_count() = 0, 'your own messages do not badge you');
do $$ begin
  insert into messages (conversation_id, sender_id, body) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000012', 'Pretend');
  raise exception 'FAIL: sent as someone else';
exception when insufficient_privilege then raise notice 'ok: cannot send as someone else';
end $$;
do $$ begin
  insert into messages (conversation_id, sender_id, body) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', '   ');
  raise exception 'FAIL: sent a blank message';
exception when check_violation then raise notice 'ok: a blank message is refused';
end $$;
do $$ begin
  insert into messages (conversation_id, sender_id, body) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', repeat('x', 2001));
  raise exception 'FAIL: sent a 2001-character message';
exception when check_violation then raise notice 'ok: a message is capped at 2000 characters';
end $$;
do $$ begin
  update messages set body = 'edited';
  raise exception 'FAIL: edited a message';
exception when insufficient_privilege then raise notice 'ok: a sent message cannot be edited';
end $$;
do $$ begin
  delete from messages;
  raise exception 'FAIL: unsent a message';
exception when insufficient_privilege then raise notice 'ok: a sent message cannot be unsent';
end $$;
do $$ begin
  update conversation_members set profile_id = '00000000-0000-0000-0000-000000000013';
  raise exception 'FAIL: changed a membership';
exception when insufficient_privilege then raise notice 'ok: memberships cannot be edited';
end $$;
do $$ begin
  insert into conversation_members (conversation_id, profile_id) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000013');
  raise exception 'FAIL: added someone to a conversation';
exception when insufficient_privilege then raise notice 'ok: nobody can be added to a conversation';
end $$;

-- Car cards: published cars only. Sam's Civic is published at this point.
insert into messages (id, conversation_id, sender_id, body, vehicle_id)
  values ('70000000-0000-0000-0000-000000000002', current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', 'Like this Civic?', '10000000-0000-0000-0000-000000000002');
select pg_temp.check(true, 'a message can carry a published car');
reset role;
update ownerships set is_public = false where id = '20000000-0000-0000-0000-00000000000c';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
do $$ begin
  insert into messages (conversation_id, sender_id, body, vehicle_id)
    values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', 'Now private', '10000000-0000-0000-0000-000000000002');
  raise exception 'FAIL: attached an unpublished car';
exception when insufficient_privilege then raise notice 'ok: a car card needs a published car';
end $$;
reset role;
update ownerships set is_public = true where id = '20000000-0000-0000-0000-00000000000c';

-- Reading and the unread badge.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
select pg_temp.check((select count(*) from messages) = 2, 'the recipient reads the conversation');
select pg_temp.check(public.unread_message_count() = 2, 'two unread messages');
select pg_temp.check((select unread = 2 and can_reply and last_vehicle_id is not null from public.my_inbox()), 'the inbox shows the count, and that Hal can reply');
select public.mark_conversation_read(current_setting('t.gh')::uuid);
select pg_temp.check(public.unread_message_count() = 0, 'reading clears the badge');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000013';
select pg_temp.check((select count(*) from messages) = 0, 'a stranger reads nothing');
select pg_temp.check((select count(*) from conversations) = 0, 'a stranger sees no conversations');
select pg_temp.check((select count(*) from conversation_members) = 0, 'a stranger sees no memberships');
do $$ begin
  insert into messages (conversation_id, sender_id, body) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000013', 'Hello?');
  raise exception 'FAIL: wrote into someone else''s conversation';
exception when insufficient_privilege then raise notice 'ok: cannot write into a conversation you are not in';
end $$;
reset role;

set role anon;
do $$ begin
  perform count(*) from messages;
  raise exception 'FAIL: a visitor queried messages';
exception when insufficient_privilege then raise notice 'ok: visitors cannot read messages';
end $$;
reset role;

-- Deleting a conversation is private to whoever deletes it.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
select public.clear_conversation(current_setting('t.gh')::uuid);
select pg_temp.check((select count(*) from messages) = 0 and (select count(*) from public.my_inbox()) = 0, 'a cleared conversation is empty for the one who cleared it');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select pg_temp.check((select count(*) from messages) = 2, 'the other side keeps their copy');
insert into messages (id, conversation_id, sender_id, body)
  values ('70000000-0000-0000-0000-000000000003', current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', 'Still there?');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
select pg_temp.check((select count(*) from messages) = 1 and (select count(*) from public.my_inbox()) = 1, 'a new message brings back only what came after');

-- Hal answers, then the follow ends: readable, but closed.
insert into messages (id, conversation_id, sender_id, body)
  values ('70000000-0000-0000-0000-000000000004', current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000012', 'Thanks! Come by Sunday.');
reset role;
delete from member_follows where follower_id = '00000000-0000-0000-0000-000000000012' and followed_id = '00000000-0000-0000-0000-000000000011';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
do $$ begin
  insert into messages (conversation_id, sender_id, body) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', 'Hello?');
  raise exception 'FAIL: wrote after the follow ended';
exception when insufficient_privilege then raise notice 'ok: a conversation closes when the mutual follow ends';
end $$;
select pg_temp.check((select count(*) from messages) = 4 and (select not can_reply from public.my_inbox()), 'a closed conversation stays readable');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
do $$ begin
  insert into messages (conversation_id, sender_id, body) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000012', 'Hello?');
  raise exception 'FAIL: the unfollower wrote after the follow ended';
exception when insufficient_privilege then raise notice 'ok: closed for both sides';
end $$;
reset role;
insert into member_follows (follower_id, followed_id) values ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000011');

-- Blocking closes a conversation even if the follows are put back.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000011');
select pg_temp.check((select count(*) from member_follows) = 0, 'blocking removes the follows between the two');
reset role;
select pg_temp.check((select count(*) from member_follows where followed_id = '00000000-0000-0000-0000-000000000011') = 3, 'and nobody else''s follows');
insert into member_follows (follower_id, followed_id) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000011');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
do $$ begin
  insert into messages (conversation_id, sender_id, body) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', 'Why did you block me?');
  raise exception 'FAIL: wrote to someone who blocked them';
exception when insufficient_privilege then raise notice 'ok: a block closes the conversation';
end $$;
select pg_temp.check(public.unread_message_count() = 0, 'a blocked sender''s unread message no longer badges');
reset role;

-- Hal unblocks; the pair can talk again once they follow each other again.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
delete from blocks where blocker_id = '00000000-0000-0000-0000-000000000012';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select pg_temp.check(public.unread_message_count() = 1, 'unblocking brings the unread message back');
insert into messages (id, conversation_id, sender_id, body)
  values ('70000000-0000-0000-0000-000000000005', current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', 'Friends again?');
select pg_temp.check(true, 'after an unblock and a refollow, they can talk again');

-- Reports. Hal reports Gia's first message; Gia cannot be reported by someone
-- outside the conversation, and nobody reports their own words.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
insert into reports (reporter_id, target_kind, target_id, reason)
  values ('00000000-0000-0000-0000-000000000012', 'message', '70000000-0000-0000-0000-000000000001', 'spam');
select pg_temp.check(true, 'a participant reports a message');
do $$ begin
  insert into reports (reporter_id, target_kind, target_id, reason)
    values ('00000000-0000-0000-0000-000000000012', 'message', '70000000-0000-0000-0000-000000000004', 'spam');
  raise exception 'FAIL: reported their own message';
exception when insufficient_privilege then raise notice 'ok: cannot report your own message';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000013';
do $$ begin
  insert into reports (reporter_id, target_kind, target_id, reason)
    values ('00000000-0000-0000-0000-000000000013', 'message', '70000000-0000-0000-0000-000000000001', 'spam');
  raise exception 'FAIL: reported a message they cannot see';
exception when insufficient_privilege then raise notice 'ok: only the conversation can report its messages';
end $$;

-- Hal reporting a second message from Gia is still one reporter.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
insert into reports (reporter_id, target_kind, target_id, reason)
  values ('00000000-0000-0000-0000-000000000012', 'message', '70000000-0000-0000-0000-000000000005', 'spam');
select pg_temp.check(not public.messaging_paused(), 'a pause needs three different reporters');

-- Gia writes to Jo and Kit; each reports her.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select set_config('t.gj', public.start_conversation('00000000-0000-0000-0000-000000000014')::text, false);
select set_config('t.gk', public.start_conversation('00000000-0000-0000-0000-000000000015')::text, false);
insert into messages (id, conversation_id, sender_id, body) values
  ('70000000-0000-0000-0000-000000000006', current_setting('t.gj')::uuid, '00000000-0000-0000-0000-000000000011', 'Buy my parts, DM for prices'),
  ('70000000-0000-0000-0000-000000000007', current_setting('t.gk')::uuid, '00000000-0000-0000-0000-000000000011', 'Buy my parts, DM for prices');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000014';
insert into reports (reporter_id, target_kind, target_id, reason)
  values ('00000000-0000-0000-0000-000000000014', 'message', '70000000-0000-0000-0000-000000000006', 'spam');
select pg_temp.check((select count(*) from reports) = 0, 'reporters cannot read message reports either');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select pg_temp.check(not public.messaging_paused(), 'two reporters do not pause anyone');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000015';
insert into reports (reporter_id, target_kind, target_id, reason)
  values ('00000000-0000-0000-0000-000000000015', 'message', '70000000-0000-0000-0000-000000000007', 'scam');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select pg_temp.check(public.messaging_paused(), 'three reporters pause the sender');
do $$ begin
  insert into messages (conversation_id, sender_id, body) values (current_setting('t.gh')::uuid, '00000000-0000-0000-0000-000000000011', 'One more');
  raise exception 'FAIL: a paused sender sent a message';
exception when insufficient_privilege then raise notice 'ok: a paused sender cannot send';
end $$;
select pg_temp.check((select count(*) from messages) >= 5, 'a paused sender can still read');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000014';
select pg_temp.check(not public.messaging_paused(), 'the reporters are not paused');
insert into messages (conversation_id, sender_id, body) values (current_setting('t.gj')::uuid, '00000000-0000-0000-0000-000000000014', 'Please stop');
select pg_temp.check(true, 'a pause on one member leaves the others free to answer');
reset role;

-- Clearing the reports lifts the pause.
delete from reports where target_kind = 'message' and reporter_id = '00000000-0000-0000-0000-000000000015';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select pg_temp.check(not public.messaging_paused(), 'removing a report lifts the pause');
reset role;

-- Deleting an account deletes what it sent; the other side keeps their own.
delete from auth.users where id = '00000000-0000-0000-0000-000000000011';
select pg_temp.check((select count(*) from messages where sender_id is not null and id in (
  '70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003',
  '70000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000007')) = 0, 'deleting an account deletes its messages');
select pg_temp.check((select count(*) from messages where id in ('70000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000006')) = 1, 'the other side keeps what they wrote');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
select pg_temp.check((select count(*) from public.my_inbox() where other_id is null) = 1, 'the survivor''s conversation stays, with nobody on the other end');
select pg_temp.check((select not can_reply from public.my_inbox()), 'and it is closed');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-000000000012';
select pg_temp.check((select count(*) from conversations where id = current_setting('t.gh')::uuid) = 0, 'a conversation with nobody left is removed');
select pg_temp.check((select count(*) from messages where conversation_id = current_setting('t.gh')::uuid) = 0, 'and its messages go with it');

-- ---------------- 0014: message emails ----------------
-- Ann writes to Ben and Cy, who each follow her back.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000021', 'ann@x'),
  ('00000000-0000-0000-0000-000000000022', 'ben@x'),
  ('00000000-0000-0000-0000-000000000023', 'cy@x');
update profiles set handle = 'ann', display_name = 'Ann <b>Bold</b>' where id = '00000000-0000-0000-0000-000000000021';
update profiles set handle = 'ben', display_name = 'Ben' where id = '00000000-0000-0000-0000-000000000022';
update profiles set handle = 'cy' where id = '00000000-0000-0000-0000-000000000023';
select pg_temp.check(
  (select count(*) from message_email_settings where profile_id in
    ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000023') and enabled) = 3,
  'every new profile starts with message emails on');
insert into member_follows (follower_id, followed_id) values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000023'),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000021');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
select set_config('t.ab', public.start_conversation('00000000-0000-0000-0000-000000000022')::text, false);
select set_config('t.ac', public.start_conversation('00000000-0000-0000-0000-000000000023')::text, false);
reset role;

-- The words in the first message must never reach the email.
insert into messages (id, conversation_id, sender_id, body, created_at) values
  ('70000000-0000-0000-0000-0000000000a1', current_setting('t.ab')::uuid, '00000000-0000-0000-0000-000000000021', 'secret plans for saturday', now() - interval '5 minutes');
select pg_temp.check((select count(*) from public.claim_message_emails()) = 0, 'a message five minutes old is too fresh to email about');

update messages set created_at = now() - interval '20 minutes' where id = '70000000-0000-0000-0000-0000000000a1';
create temp table first_claim as select * from public.claim_message_emails();
select pg_temp.check(
  (select count(*) from first_claim) = 1
  and (select email from first_claim) = 'ben@x'
  and (select unread from first_claim) = 1
  and (select sender_name from first_claim) = 'Ann <b>Bold</b>',
  'twenty minutes unread is due: one email, to Ben, about Ann');
select pg_temp.check((select count(*) from public.claim_message_emails()) = 0, 'a claimed email is not claimed twice');

-- Within four hours of the last one, more messages wait.
update conversation_members set emailed_at = now() - interval '2 hours'
 where conversation_id = current_setting('t.ab')::uuid and profile_id = '00000000-0000-0000-0000-000000000022';
insert into messages (id, conversation_id, sender_id, body, created_at) values
  ('70000000-0000-0000-0000-0000000000a2', current_setting('t.ab')::uuid, '00000000-0000-0000-0000-000000000021', 'also this', now() - interval '30 minutes');
select pg_temp.check((select count(*) from public.claim_message_emails()) = 0, 'at most one email per conversation per window');

-- After the window, only what no earlier email mentioned is counted.
update conversation_members set emailed_at = now() - interval '10 minutes'
 where conversation_id = current_setting('t.ab')::uuid and profile_id = '00000000-0000-0000-0000-000000000022';
select pg_temp.check((select count(*) from public.claim_message_emails(cooldown => interval '5 minutes')) = 0, 'messages an earlier email already mentioned are not counted again');
update conversation_members set emailed_at = now() - interval '5 hours'
 where conversation_id = current_setting('t.ab')::uuid and profile_id = '00000000-0000-0000-0000-000000000022';
create temp table second_claim as select * from public.claim_message_emails();
select pg_temp.check((select count(*) from second_claim) = 1 and (select unread from second_claim) = 2, 'after the window the new messages are due');

-- Reading in the app first means no email.
update conversation_members set emailed_at = now() - interval '5 hours', read_at = now()
 where conversation_id = current_setting('t.ab')::uuid and profile_id = '00000000-0000-0000-0000-000000000022';
select pg_temp.check((select count(*) from public.claim_message_emails()) = 0, 'a conversation read in the app gets no email');
update conversation_members set read_at = null
 where conversation_id = current_setting('t.ab')::uuid and profile_id = '00000000-0000-0000-0000-000000000022';

-- Ben's switch.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';
select pg_temp.check((select count(*) from message_email_settings) = 1, 'a member sees only their own email setting');
update message_email_settings set enabled = false;
select pg_temp.check((select not enabled from message_email_settings), 'a member turns message emails off');
do $$ begin
  update message_email_settings set unsubscribe_token = gen_random_uuid();
  raise exception 'FAIL: changed the unsubscribe token';
exception when insufficient_privilege then raise notice 'ok: the token cannot be changed';
end $$;
reset role;
update conversation_members set emailed_at = null
 where conversation_id = current_setting('t.ab')::uuid and profile_id = '00000000-0000-0000-0000-000000000022';
select pg_temp.check((select count(*) from public.claim_message_emails()) = 0, 'no email for someone who turned them off');

-- The link in an email, opened by someone who may not be signed in.
select set_config('t.token', (select unsubscribe_token::text from message_email_settings where profile_id = '00000000-0000-0000-0000-000000000022'), false);
update message_email_settings set enabled = true where profile_id = '00000000-0000-0000-0000-000000000022';
set role anon;
select pg_temp.check(not public.unsubscribe_message_emails(gen_random_uuid()), 'a wrong token does nothing');
select pg_temp.check(public.unsubscribe_message_emails(current_setting('t.token')::uuid), 'a right token unsubscribes');
do $$ begin
  perform count(*) from message_email_settings;
  raise exception 'FAIL: a visitor read the settings';
exception when insufficient_privilege then raise notice 'ok: visitors cannot read the settings';
end $$;
reset role;
select pg_temp.check((select not enabled from message_email_settings where profile_id = '00000000-0000-0000-0000-000000000022'), 'and Ben is now off');
update message_email_settings set enabled = true where profile_id = '00000000-0000-0000-0000-000000000022';

-- Blocking ends it too: Cy blocks Ann with a message waiting.
insert into messages (id, conversation_id, sender_id, body, created_at) values
  ('70000000-0000-0000-0000-0000000000a3', current_setting('t.ac')::uuid, '00000000-0000-0000-0000-000000000021', 'hi cy', now() - interval '40 minutes');
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000021');
select pg_temp.check(not exists (select 1 from public.claim_message_emails() where recipient_id = '00000000-0000-0000-0000-000000000023'), 'no email about someone you blocked');

-- The sending itself, with Vault and pg_net stubbed.
update conversation_members set emailed_at = now() - interval '5 hours'
 where conversation_id = current_setting('t.ab')::uuid and profile_id = '00000000-0000-0000-0000-000000000022';
select pg_temp.check(public.send_message_emails() = 0 and (select count(*) from net.calls) = 0, 'without a key in Vault nothing is sent');
select pg_temp.check((select emailed_at from conversation_members where conversation_id = current_setting('t.ab')::uuid and profile_id = '00000000-0000-0000-0000-000000000022') < now() - interval '4 hours', 'and nothing is marked as sent');

insert into vault.decrypted_secrets values ('resend_api_key', 're_test_key'), ('message_email_from', 'Sonder <messages@imsonder.test>');
select pg_temp.check(public.send_message_emails() = 1, 'with a key, the due email is sent');
select pg_temp.check((select count(*) from net.calls) = 1 and (select url from net.calls) = 'https://api.resend.com/emails', 'it goes to Resend');
select pg_temp.check((select headers ->> 'Authorization' from net.calls) = 'Bearer re_test_key', 'with the key from Vault');
select pg_temp.check(
  (select body ->> 'from' from net.calls) = 'Sonder <messages@imsonder.test>'
  and (select body -> 'to' ->> 0 from net.calls) = 'ben@x'
  and (select body ->> 'subject' from net.calls) = 'Ann <b>Bold</b> sent you 2 messages on Sonder',
  'from the configured address, to Ben, naming Ann and the count');
select pg_temp.check(
  (select body ->> 'html' from net.calls) like '%Ann &lt;b&gt;Bold&lt;/b&gt; sent you 2 messages%'
  and (select body ->> 'html' from net.calls) not like '%<b>Bold</b>%',
  'names are escaped in the HTML');
select pg_temp.check(
  (select body ->> 'html' from net.calls) not like '%secret plans%'
  and (select body ->> 'html' from net.calls) not like '%also this%'
  and (select body ->> 'text' from net.calls) not like '%secret plans%',
  'what was said never reaches the email');
select pg_temp.check(
  (select body ->> 'html' from net.calls) like ('%https://www.imsonder.com/messages/' || current_setting('t.ab') || '%')
  and (select body #>> '{headers,List-Unsubscribe}' from net.calls) = ('<https://www.imsonder.com/api/unsubscribe?t=' || current_setting('t.token') || '>')
  and (select body #>> '{headers,List-Unsubscribe-Post}' from net.calls) = 'List-Unsubscribe=One-Click',
  'it links to the conversation and carries a one-click unsubscribe');
select pg_temp.check(public.send_message_emails() = 0, 'and is not sent again');

-- The functions that send are not for members to call.
set role authenticated;
do $$ begin
  perform public.send_message_emails();
  raise exception 'FAIL: a member ran the sender';
exception when insufficient_privilege then raise notice 'ok: members cannot run the sender';
end $$;
do $$ begin
  perform public.claim_message_emails();
  raise exception 'FAIL: a member claimed emails';
exception when insufficient_privilege then raise notice 'ok: members cannot claim emails';
end $$;
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-000000000022';
select pg_temp.check((select count(*) from message_email_settings where profile_id = '00000000-0000-0000-0000-000000000022') = 0, 'deleting an account removes its email setting');
