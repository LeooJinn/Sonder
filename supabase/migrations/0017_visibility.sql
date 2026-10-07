-- Visibility: who can see whom, and what history can still be changed.
--
-- PRODUCT.md: privacy by default, publicity by choice; history is permanent.
-- Four places did not keep that promise:
--
--   * Every signed-in member could read every profile. A published passport
--     shows the car's whole chain, and reading the owner ids of the periods
--     plus the profiles behind them named previous owners who never published.
--   * Every signed-in member could list every VIN in the system, and anyone
--     could add a vehicle row with any text, once, for good.
--   * Three brand-new accounts could take down any listing, meet or sender by
--     reporting it, and a report could name a target that did not exist.
--   * A seller kept the power to change or delete entries in a period after it
--     had ended, and photo paths were never checked against their owner.
--
-- What changes:
--   * A profile is readable by a signed-in member when it is their own, when
--     its owner has published a car (the same test that already applies to
--     visitors), or when there is a real connection: they follow each other in
--     either direction, share a conversation, the reader blocked them, or one
--     hosts or is going to a meet the reader can see. Everyone else stays
--     private, which includes a previous owner who never published.
--   * A vehicle is readable when the reader has owned it, when it is published
--     (the test that already applies to visitors), or when it is going to a
--     meet the reader can see. Vehicle rows are created by ensure_vehicle()
--     only; members no longer insert them directly, so what a car's row says
--     can be checked in one place.
--   * Only reports from accounts at least a week old count towards taking
--     something down, and a report has to name something that exists.
--   * Entries, parts and photos in a finished period cannot be changed or
--     deleted by anyone through the API. A photo's path must start with its
--     owner's id.
--   * A meet RSVP drops the car when it is sold, and cannot be made for a meet
--     reports have hidden.

-- ---------------------------------------------------------------------------
-- Who can see which profile
-- ---------------------------------------------------------------------------

/* True when the caller may read this profile. Security definer, because the
   tables it asks about are not the caller's to read. Returns a boolean only. */
create function public.can_see_profile(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null and (
    target = auth.uid()
    -- Published a car: the test visitors already pass (0003).
    or exists (select 1 from ownerships o where o.owner_id = target and o.is_public)
    -- Follows, either way.
    or exists (
      select 1 from member_follows f
      where (f.follower_id = auth.uid() and f.followed_id = target)
         or (f.followed_id = auth.uid() and f.follower_id = target)
    )
    -- A conversation they are both in.
    or exists (
      select 1 from conversation_members mine
      join conversation_members theirs on theirs.conversation_id = mine.conversation_id
      where mine.profile_id = auth.uid() and theirs.profile_id = target
    )
    -- Someone the reader blocked, so the list of blocks can name them.
    or exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = target)
    -- Hosts a meet the reader can see.
    or exists (
      select 1 from meets m
      where m.host_id = target and (m.hidden_at is null or m.host_id = auth.uid())
    )
    -- Is going to a meet the reader can see.
    or exists (
      select 1 from meet_rsvps r join meets m on m.id = r.meet_id
      where r.profile_id = target and m.hidden_at is null
    )
  );
$$;

revoke all on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.can_see_profile(uuid) to authenticated;

drop policy "profiles are readable by authenticated users" on profiles;
create policy "profiles are readable when published or connected"
  on profiles for select to authenticated
  using (public.can_see_profile(id));

-- ---------------------------------------------------------------------------
-- Who can see which vehicle, and how a vehicle row is made
-- ---------------------------------------------------------------------------

/* True when the caller may read this vehicle. */
create function public.can_see_vehicle(vehicle uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null and (
    -- Owned by the reader at some point, or published (0003).
    exists (
      select 1 from ownerships o
      where o.vehicle_id = vehicle and (o.owner_id = auth.uid() or o.is_public)
    )
    -- Going to a meet the reader can see.
    or exists (
      select 1 from meet_rsvps r join meets m on m.id = r.meet_id
      where r.vehicle_id = vehicle and m.hidden_at is null
    )
  );
$$;

revoke all on function public.can_see_vehicle(uuid) from public, anon;
grant execute on function public.can_see_vehicle(uuid) to authenticated;

drop policy "vehicles are readable by authenticated users" on vehicles;
create policy "vehicles are readable when owned, published or at a meet"
  on vehicles for select to authenticated
  using (public.can_see_vehicle(id));

-- Members no longer write vehicle rows themselves.
drop policy "authenticated users may add a vehicle" on vehicles;

/* The vehicle row for a VIN, created from the decoded details if there is none
   yet, and left exactly as it is if there is: the first decode stays. Returns
   its id. The row is constrained by 0016, so what goes in has to look like a
   vehicle. */
create function public.ensure_vehicle(
  p_vin          text,
  p_year         text,
  p_make         text,
  p_model        text,
  p_trim         text,
  p_body_class   text,
  p_drive_type   text,
  p_cylinders    text,
  p_displacement text,
  p_fuel_type    text,
  p_transmission text,
  p_plant        text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle_id uuid;
begin
  if auth.uid() is null then raise exception 'You need to be signed in.'; end if;

  insert into vehicles (vin, year, make, model, trim, body_class, drive_type, cylinders, displacement, fuel_type, transmission, plant)
  values (p_vin, p_year, p_make, p_model, p_trim, p_body_class, p_drive_type, p_cylinders, p_displacement, p_fuel_type, p_transmission, p_plant)
  on conflict (vin) do nothing;

  select v.id into vehicle_id from vehicles v where v.vin = p_vin;
  return vehicle_id;
end;
$$;

revoke all on function public.ensure_vehicle(text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.ensure_vehicle(text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

/* "This is my car and someone else has it in their garage." The reporter
   cannot read the vehicle row, so this finds it for them. */
create function public.report_claimed_vin(p_vin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle_id uuid;
begin
  if auth.uid() is null then raise exception 'You need to be signed in.'; end if;
  select v.id into vehicle_id from vehicles v where v.vin = p_vin;
  if vehicle_id is null then raise exception 'That car is not in Sonder yet.'; end if;

  insert into reports (reporter_id, target_kind, target_id, reason, note)
  values (auth.uid(), 'vehicle', vehicle_id, 'other', left('Says this is their car: ' || p_vin, 500))
  on conflict (reporter_id, target_kind, target_id) do nothing;
end;
$$;

revoke all on function public.report_claimed_vin(text) from public, anon;
grant execute on function public.report_claimed_vin(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reports: who counts, and what they can name
-- ---------------------------------------------------------------------------

-- Three reports act on their own (0011), so three throwaway accounts could
-- take down anything. Only accounts a week old count.
create or replace function public.report_count(kind text, target uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(distinct r.reporter_id)::integer
  from reports r
  join profiles p on p.id = r.reporter_id
  where r.target_kind = kind
    and r.target_id = target
    and p.created_at <= now() - interval '7 days';
$$;

/* A report has to name something that exists. (A message is checked by its own
   policy, 0013.) */
create function public.check_report_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_kind = 'meet' and not exists (select 1 from meets where id = new.target_id) then
    raise exception 'That meet is not there.';
  elsif new.target_kind = 'listing' and not exists (select 1 from ownerships where id = new.target_id and for_sale) then
    raise exception 'That listing is not there.';
  elsif new.target_kind = 'vehicle' and not exists (select 1 from vehicles where id = new.target_id) then
    raise exception 'That car is not there.';
  end if;
  return new;
end;
$$;

create trigger reports_check_target
  before insert on reports
  for each row execute function public.check_report_target();

-- ---------------------------------------------------------------------------
-- A finished period is history
-- ---------------------------------------------------------------------------

/* Entries, parts and photos in an ownership that has ended cannot be changed
   or deleted through the API: history that can be rewritten is worthless
   (PRODUCT.md), and a seller could otherwise reach into what the buyer
   inherited. Members only; the account-deletion function runs as its owner and
   is let through. */
create function public.guard_finished_history()
returns trigger
language plpgsql
as $$
declare
  finished boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'entries' then
    select o.ended_on is not null into finished
      from ownerships o where o.id = coalesce(new.ownership_id, old.ownership_id);
  elsif tg_table_name = 'parts' then
    select o.ended_on is not null into finished
      from entries e join ownerships o on o.id = e.ownership_id
     where e.id = coalesce(new.entry_id, old.entry_id);
  else
    select o.ended_on is not null into finished
      from ownerships o
     where o.id = coalesce(
       new.ownership_id, old.ownership_id,
       (select e.ownership_id from entries e where e.id = coalesce(new.entry_id, old.entry_id)));
  end if;

  if finished then
    raise exception 'History from a finished period cannot be changed.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger entries_guard_finished before insert or update or delete on entries
  for each row execute function public.guard_finished_history();
create trigger parts_guard_finished before insert or update or delete on parts
  for each row execute function public.guard_finished_history();
create trigger photos_guard_finished before insert or update or delete on photos
  for each row execute function public.guard_finished_history();

/* A photo's path starts with its owner's id (the storage policies already
   require it for the file). Nothing checked the row, so a path found elsewhere
   could be attached to someone's own entry. */
create function public.guard_photo_path()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
     and split_part(new.storage_path, '/', 1) is distinct from auth.uid()::text then
    raise exception 'A photo has to be in your own folder.';
  end if;
  return new;
end;
$$;

create trigger photos_guard_path before insert or update of storage_path on photos
  for each row execute function public.guard_photo_path();

-- ---------------------------------------------------------------------------
-- Meets
-- ---------------------------------------------------------------------------

-- Going to a meet that reports have hidden is not possible, and the car a
-- member brings has to be one they own now.
drop policy "members say they are going" on meet_rsvps;
create policy "members say they are going"
  on meet_rsvps for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (vehicle_id is null or public.currently_owns(vehicle_id))
    and exists (
      select 1 from meets m
      where m.id = meet_id and (m.hidden_at is null or m.host_id = (select auth.uid()))
    )
  );

/* A car that is sold or removed stops being the car someone is bringing: until
   now their RSVP kept showing it, and its VIN, to every member. */
create function public.drop_rsvp_car_when_gone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or (new.ended_on is not null and old.ended_on is null) then
    update meet_rsvps set vehicle_id = null
     where profile_id = old.owner_id and vehicle_id = old.vehicle_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger ownerships_drop_rsvp_car
  after update of ended_on or delete on ownerships
  for each row execute function public.drop_rsvp_car_when_gone();
