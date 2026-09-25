-- Ownership chain: a published passport shows the car's whole life.
--
-- Until now a shared link showed only the current owner's period. That
-- undersold the point of Sonder: the history a buyer most wants to read is
-- the part from before the person selling to them.
--
-- The rule is that the CURRENT owner's decision to publish opens the car's
-- full history to anyone with the link. That is the promise the app makes at
-- the moment of sale -- "the history stays with the vehicle" -- and the
-- current owner already reads all of it through 0004. Identity is a separate
-- matter: a previous owner is only named if they published their own period.
-- The app enforces that when rendering, and profiles of people who never
-- published stay unreadable to anonymous visitors through the existing 0003
-- policy, so the name can't be fetched around the app either.
--
-- As in 0004, a policy on ownerships can't query ownerships without
-- recursing, so each question is answered by a narrow security definer
-- helper that returns only a boolean.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

/* The vehicle's current ownership exists and is published. */
create function public.vehicle_is_published(vehicle uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from ownerships
    where vehicle_id = vehicle
      and ended_on is null
      and is_public
  );
$$;

/* This ownership, current or past, is of a car whose current owner published. */
create function public.ownership_on_published_vehicle(ownership uuid)
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
  );
$$;

/* This entry belongs to a car whose current owner published. */
create function public.entry_on_published_vehicle(entry uuid)
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
  );
$$;

-- ---------------------------------------------------------------------------
-- Read access to the whole chain of a published car
--
-- Additive, read only, and scoped to one car at a time: nothing here makes an
-- unpublished car, or any row of one, readable by anybody new.
-- ---------------------------------------------------------------------------

create policy "every period of a published car is readable"
  on ownerships for select to anon, authenticated
  using (public.vehicle_is_published(vehicle_id));

create policy "entries across a published car's life are readable"
  on entries for select to anon, authenticated
  using (public.ownership_on_published_vehicle(ownership_id));

create policy "parts across a published car's life are readable"
  on parts for select to anon, authenticated
  using (public.entry_on_published_vehicle(entry_id));

create policy "photos across a published car's life are readable"
  on photos for select to anon, authenticated
  using (
    (entry_id is not null and public.entry_on_published_vehicle(entry_id))
    or
    (ownership_id is not null and public.ownership_on_published_vehicle(ownership_id))
  );

revoke all on function public.vehicle_is_published(uuid) from public;
revoke all on function public.ownership_on_published_vehicle(uuid) from public;
revoke all on function public.entry_on_published_vehicle(uuid) from public;
grant execute on function public.vehicle_is_published(uuid) to anon, authenticated;
grant execute on function public.ownership_on_published_vehicle(uuid) to anon, authenticated;
grant execute on function public.entry_on_published_vehicle(uuid) to anon, authenticated;
