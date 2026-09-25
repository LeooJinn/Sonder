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

