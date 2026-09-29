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
