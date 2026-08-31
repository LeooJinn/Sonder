-- Transfer: a car changes hands and its history goes with it.
--
-- Selling ends an ownership rather than deleting it. The seller's entries stay
-- attached to the seller's period, so they keep credit for their work; the
-- buyer opens a new period and inherits a readable history of everything that
-- came before. This is the whole reason entries hang off ownerships.
--
-- The obvious policy -- "I may read a past ownership if I hold a current one
-- of the same vehicle" -- cannot be written directly: a policy ON ownerships
-- that queries ownerships recurses, and Postgres rejects it. These helpers are
-- security definer, so they run as the function owner and bypass RLS, which
-- breaks the cycle. They are deliberately narrow: each answers exactly one
-- question and leaks nothing beyond a boolean.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.currently_owns(vehicle uuid)
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
  );
$$;

/* True when the caller currently owns the vehicle this entry belongs to,
   whoever originally wrote the entry. */
create function public.can_see_entry(entry uuid)
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
  );
$$;

-- ---------------------------------------------------------------------------
-- Inherited read access
--
-- Additive: these sit alongside the existing "it's mine" policies, which are
-- unchanged. Read only -- a buyer can see what a previous owner did but can
-- never edit or delete it, because history that can be rewritten is worthless.
-- ---------------------------------------------------------------------------

create policy "current owner reads prior ownerships of the vehicle"
  on ownerships for select to authenticated
  using (public.currently_owns(vehicle_id));

create policy "current owner reads prior entries on the vehicle"
  on entries for select to authenticated
  using (public.currently_owns(
    (select o.vehicle_id from ownerships o where o.id = entries.ownership_id)
  ));

create policy "current owner reads prior parts on the vehicle"
  on parts for select to authenticated
  using (public.can_see_entry(entry_id));

create policy "current owner reads prior photos on the vehicle"
  on photos for select to authenticated
  using (public.can_see_entry(entry_id));

-- Profiles are already readable by any authenticated user (migration 0001),
-- so a previous owner can be named without a further policy.

-- ---------------------------------------------------------------------------
-- Index
--
-- Prior history is looked up as "every ownership of this vehicle, oldest
-- first", which the existing indexes do not serve.
-- ---------------------------------------------------------------------------

create index ownerships_by_vehicle on ownerships (vehicle_id, started_on);
