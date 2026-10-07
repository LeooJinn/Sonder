-- Ownership protection: who may claim a car, and who may read its past.
--
-- Until now any member could add any VIN that nobody currently owned, and
-- doing so opened the whole earlier history to them (0004), and to the world
-- if they then published (0007). A VIN is printed on the windshield, so that
-- meant a stranger could claim a car the moment it was sold, read what the
-- seller had logged, and publish it. Two other holes sat beside it: a member
-- could insert a finished "past owner" period on someone else's car and write
-- entries into it, and the photo bucket could be listed by anyone.
--
-- What changes:
--   * History follows a hand-over the seller makes. Selling gives the seller a
--     transfer code; whoever claims the car with it inherits the earlier
--     history. Anyone else who adds the car starts a fresh log (and the car's
--     earlier periods stay private to the people who wrote them, and public
--     only to the extent they themselves published).
--   * An ownership can only be created as a current one, can't be moved to
--     another car, and a finished one can't be deleted (which would wipe the
--     next owner's inherited history).
--   * A garage holds up to 25 cars.
--   * Vehicle rows have to look like vehicles.
--   * A claimed VIN can be reported, for the dashboard.
--   * Smaller fixes found on the way: photo paths can't be listed by anyone,
--     a listing's price and contact line are cleared when it ends, a host
--     can't un-hide a meet that reports hid, and profile fields are checked.
--
-- Existing ownerships keep what they have today: they are marked as
-- inheriting, so nobody loses history they can read now.

-- ---------------------------------------------------------------------------
-- Ownerships: inheriting history, and what a member may change
-- ---------------------------------------------------------------------------

-- Whether this owner may read what came before them. True for everything that
-- exists now; false for a car added from here on, unless it was claimed with a
-- transfer code. Only the functions below set it.
alter table ownerships add column inherits_history boolean not null default true;
alter table ownerships alter column inherits_history set default false;

create function public.guard_ownership()
returns trigger
language plpgsql
as $$
begin
  -- Members, through the API. The functions below run as their owner and are
  -- let through, which is how a claim sets inherits_history.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.inherits_history := false;
    else
      if new.vehicle_id is distinct from old.vehicle_id then
        raise exception 'An ownership cannot be moved to another car.';
      end if;
      if new.started_on is distinct from old.started_on then
        raise exception 'When an ownership started cannot be changed.';
      end if;
      new.inherits_history := old.inherits_history;
    end if;
  end if;
  return new;
end;
$$;

create trigger ownerships_guard
  before insert or update on ownerships
  for each row execute function public.guard_ownership();

-- A new ownership is a current one. A finished period is made by selling.
drop policy "users claim ownership for themselves" on ownerships;
create policy "users claim ownership for themselves"
  on ownerships for insert to authenticated
  with check (owner_id = (select auth.uid()) and ended_on is null);

-- Deleting a finished period would delete its entries, and with them the
-- history the next owner inherited. Only a current ownership can be removed.
drop policy "users delete their own ownerships" on ownerships;
create policy "users delete their own ownerships"
  on ownerships for delete to authenticated
  using (owner_id = (select auth.uid()) and ended_on is null);

-- A garage holds up to 25 cars. Anyone can add a car without proving it is
-- theirs, so this is what stops one account sitting on hundreds of VINs.
create function public.limit_garage()
returns trigger
language plpgsql
as $$
begin
  if new.ended_on is null
     and (select count(*) from ownerships where owner_id = new.owner_id and ended_on is null) >= 25 then
    raise exception 'A garage holds up to 25 cars.';
  end if;
  return new;
end;
$$;

create trigger ownerships_limit_garage
  before insert on ownerships
  for each row execute function public.limit_garage();

-- ---------------------------------------------------------------------------
-- Who may read the past of a car
-- ---------------------------------------------------------------------------

/* The caller currently owns this car and inherits its history. */
create function public.inherits_history_of(vehicle uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from ownerships
    where vehicle_id = vehicle
      and owner_id = auth.uid()
      and ended_on is null
      and inherits_history
  );
$$;

revoke all on function public.inherits_history_of(uuid) from public;
grant execute on function public.inherits_history_of(uuid) to authenticated;

/* True when the caller currently owns the car this entry belongs to and
   inherits its history, whoever originally wrote the entry. Replaces 0004's. */
create or replace function public.can_see_entry(entry uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from entries e
    join ownerships past on past.id = e.ownership_id
    join ownerships mine on mine.vehicle_id = past.vehicle_id
    where e.id = entry
      and mine.owner_id = auth.uid()
      and mine.ended_on is null
      and mine.inherits_history
  );
$$;

drop policy "current owner reads prior ownerships of the vehicle" on ownerships;
create policy "current owner reads prior ownerships of the vehicle"
  on ownerships for select to authenticated
  using (public.inherits_history_of(vehicle_id));

drop policy "current owner reads prior entries on the vehicle" on entries;
create policy "current owner reads prior entries on the vehicle"
  on entries for select to authenticated
  using (public.inherits_history_of(
    (select o.vehicle_id from ownerships o where o.id = entries.ownership_id)
  ));

drop policy "current owner reads prior gallery photos" on photos;
create policy "current owner reads prior gallery photos"
  on photos for select to authenticated
  using (
    photos.ownership_id is not null
    and public.inherits_history_of(
      (select o.vehicle_id from ownerships o where o.id = photos.ownership_id)
    )
  );

-- A published passport shows the periods before the publisher's only when the
-- publisher inherited them. Otherwise "publish" would hand a stranger's
-- private log to the world. The current period is always theirs to publish.
create or replace function public.ownership_on_published_vehicle(ownership uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from ownerships o
    join ownerships current_owner on current_owner.vehicle_id = o.vehicle_id
    where o.id = ownership
      and current_owner.ended_on is null
      and current_owner.is_public
      and (o.id = current_owner.id or current_owner.inherits_history)
  );
$$;

create or replace function public.entry_on_published_vehicle(entry uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from entries e
    join ownerships o on o.id = e.ownership_id
    join ownerships current_owner on current_owner.vehicle_id = o.vehicle_id
    where e.id = entry
      and current_owner.ended_on is null
      and current_owner.is_public
      and (o.id = current_owner.id or current_owner.inherits_history)
  );
$$;

-- 0007 let every period of a published car be read by looking only at the car;
-- it now asks about the period itself.
drop policy "every period of a published car is readable" on ownerships;
create policy "every period of a published car is readable"
  on ownerships for select to anon, authenticated
  using (public.ownership_on_published_vehicle(id));

-- ---------------------------------------------------------------------------
-- Transfer codes
-- ---------------------------------------------------------------------------

-- One row per code a seller has been given. Only the hash is kept, and only
-- the functions below touch the table.
create table ownership_transfers (
  id           uuid primary key default gen_random_uuid(),
  -- The seller's finished period: what is being handed over.
  ownership_id uuid not null references ownerships (id) on delete cascade,
  code_hash    text not null,
  expires_at   timestamptz not null,
  -- Wrong guesses against this code. Ten and it is dead; the seller can ask
  -- for another.
  attempts     integer not null default 0,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index ownership_transfers_by_ownership on ownership_transfers (ownership_id);

alter table ownership_transfers enable row level security;
revoke all on ownership_transfers from anon, authenticated;

/* "ABCD-1234-EF56" -> "ABCD1234EF56", whatever a person typed. */
create function public.normalize_transfer_code(code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(code, ''), '[^0-9A-Za-z]', '', 'g'));
$$;

create function public.hash_transfer_code(code text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(public.normalize_transfer_code(code), 'utf8')), 'hex');
$$;

/* A new code for a finished ownership, replacing any earlier one. 48 random
   bits, shown as three groups of four. Lasts fourteen days. */
create function public.issue_transfer_code(ownership uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  update ownership_transfers set expires_at = now()
   where ownership_id = ownership and used_at is null and expires_at > now();

  insert into ownership_transfers (ownership_id, code_hash, expires_at)
  values (ownership, public.hash_transfer_code(raw), now() + interval '14 days');

  return substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
end;
$$;

revoke all on function public.issue_transfer_code(uuid) from public, anon, authenticated;
revoke all on function public.normalize_transfer_code(text) from public, anon, authenticated;
revoke all on function public.hash_transfer_code(text) from public, anon, authenticated;

/* Sell the caller's car: end the ownership and return the code to give the
   buyer. The code is shown once; see new_transfer_code for another. */
create function public.sell_vehicle(vin text, sold_on date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  mine ownerships%rowtype;
begin
  if auth.uid() is null then raise exception 'You need to be signed in.'; end if;

  select o.* into mine
    from ownerships o join vehicles v on v.id = o.vehicle_id
   where v.vin = sell_vehicle.vin and o.owner_id = auth.uid() and o.ended_on is null
   for update of o;
  if not found then raise exception 'That vehicle is not in your garage.'; end if;

  update ownerships set ended_on = greatest(sold_on, started_on) where id = mine.id;
  return public.issue_transfer_code(mine.id);
end;
$$;

/* Another code for a car the caller sold and nobody has claimed since. */
create function public.new_transfer_code(vin text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sold uuid;
begin
  if auth.uid() is null then raise exception 'You need to be signed in.'; end if;

  select o.id into sold
    from ownerships o join vehicles v on v.id = o.vehicle_id
   where v.vin = new_transfer_code.vin
     and o.owner_id = auth.uid()
     and o.ended_on is not null
     and not exists (
       select 1 from ownerships c where c.vehicle_id = o.vehicle_id and c.ended_on is null)
   order by o.ended_on desc, o.created_at desc
   limit 1;
  if not found then raise exception 'There is no sale of that car waiting to be handed over.'; end if;

  return public.issue_transfer_code(sold);
end;
$$;

/* Claim a car with the seller's code and inherit its history. Returns 'ok',
   'taken' (someone has the car now) or 'invalid' (wrong, expired or used up:
   deliberately not told apart). A wrong code is counted rather than raised,
   so the count survives. */
create function public.claim_vehicle_with_code(vin text, code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  car uuid;
  active ownership_transfers%rowtype;
begin
  if auth.uid() is null then raise exception 'You need to be signed in.'; end if;

  select id into car from vehicles where vehicles.vin = claim_vehicle_with_code.vin;
  if not found then return 'invalid'; end if;

  select t.* into active
    from ownership_transfers t join ownerships o on o.id = t.ownership_id
   where o.vehicle_id = car and t.used_at is null and t.expires_at > now() and t.attempts < 10
   order by t.created_at desc
   limit 1
   for update of t;
  if not found then return 'invalid'; end if;

  if active.code_hash <> public.hash_transfer_code(claim_vehicle_with_code.code) then
    update ownership_transfers set attempts = attempts + 1 where id = active.id;
    return 'invalid';
  end if;

  if exists (select 1 from ownerships where vehicle_id = car and ended_on is null) then
    return 'taken';
  end if;

  insert into ownerships (vehicle_id, owner_id, inherits_history)
  values (car, auth.uid(), true);
  update ownership_transfers set used_at = now() where id = active.id;
  return 'ok';
end;
$$;

revoke all on function public.sell_vehicle(text, date) from public, anon;
revoke all on function public.new_transfer_code(text) from public, anon;
revoke all on function public.claim_vehicle_with_code(text, text) from public, anon;
grant execute on function public.sell_vehicle(text, date) to authenticated;
grant execute on function public.new_transfer_code(text) to authenticated;
grant execute on function public.claim_vehicle_with_code(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Vehicles have to look like vehicles
-- ---------------------------------------------------------------------------

-- Any member can add a vehicle row and nobody can change it afterwards, so
-- what goes in has to be sane. NOT VALID: applies to every new or changed row
-- without risking this migration on a row that is already there.
alter table vehicles
  add constraint vehicles_vin_format check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$') not valid,
  add constraint vehicles_year_format check (year is null or year = '' or year ~ '^[0-9]{4}$') not valid,
  add constraint vehicles_text_lengths check (
    char_length(coalesce(make, '')) <= 60 and char_length(coalesce(model, '')) <= 60
    and char_length(coalesce(trim, '')) <= 60 and char_length(coalesce(body_class, '')) <= 60
    and char_length(coalesce(drive_type, '')) <= 60 and char_length(coalesce(cylinders, '')) <= 60
    and char_length(coalesce(displacement, '')) <= 60 and char_length(coalesce(fuel_type, '')) <= 60
    and char_length(coalesce(transmission, '')) <= 60 and char_length(coalesce(plant, '')) <= 100
  ) not valid;

-- ---------------------------------------------------------------------------
-- Reporting a claimed VIN
-- ---------------------------------------------------------------------------

-- "This is my car and someone else has it in their garage." Reports are read
-- in the dashboard; nothing acts on them by itself.
alter table reports drop constraint reports_target_kind_check;
alter table reports
  add constraint reports_target_kind_check check (target_kind in ('meet', 'listing', 'message', 'vehicle'));

-- Nothing acts on a 'vehicle' report by itself: act_on_reports (0013) only
-- knows meets, listings and messages.

-- ---------------------------------------------------------------------------
-- Smaller fixes
-- ---------------------------------------------------------------------------

-- The photo bucket is public, so a photo is fetched by its URL without any
-- policy. The policy that let anyone LIST the bucket only leaked the paths of
-- private photos. Members may still see and manage their own folder.
drop policy "photos are publicly readable" on storage.objects;
create policy "members read their own photo files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- A listing's price and contact line are public while it is listed. When it
-- ends (sold, unpublished, account deleted, reported down) they go too, so a
-- phone number does not outlive the sale in a public passport.
create or replace function public.keep_listing_consistent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ended_on is not null or not new.is_public then
    new.for_sale := false;
  end if;

  if new.for_sale and public.report_count('listing', new.id) >= 3 then
    new.for_sale := false;
  end if;

  if new.for_sale and not coalesce(old.for_sale, false) then
    new.listed_at := now();
  elsif not new.for_sale then
    new.listed_at := null;
    new.asking_price_cents := null;
    new.sale_contact := null;
  end if;

  return new;
end;
$$;

update ownerships set asking_price_cents = null, sale_contact = null
 where not for_sale and (asking_price_cents is not null or sale_contact is not null);

-- Reports hide a meet; its host cannot undo that from the API.
create function public.guard_meet_hiding()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.hidden_at := old.hidden_at;
  end if;
  return new;
end;
$$;

create trigger meets_guard_hiding
  before update on meets
  for each row execute function public.guard_meet_hiding();

-- Profile fields were only checked in the app.
alter table profiles
  add constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9_]{3,20}$') not valid,
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 60) not valid,
  add constraint profiles_region_length check (region is null or char_length(region) <= 60) not valid;
