-- Public passports: an owner can publish a car's history at a shareable link.
--
-- Publishing is a property of an OWNERSHIP, not of a vehicle or a person.
-- One owner may share their period with the world while a previous owner
-- keeps theirs private, and selling the car does not publish the buyer's
-- history on the seller's decision.
--
-- Every policy below is additive. RLS policies are OR'd together, so these
-- widen access to explicitly published rows and change nothing about private
-- ones. Each is scoped through a public ownership rather than granting blanket
-- read on a table -- otherwise anonymous callers could enumerate every VIN,
-- profile and photo in the system.

alter table ownerships
  add column is_public boolean not null default false;

-- Passports are looked up by VIN, and only published ones are ever fetched.
create index ownerships_public on ownerships (vehicle_id) where is_public;

-- ---------------------------------------------------------------------------
-- Anonymous read access, scoped to published passports
-- ---------------------------------------------------------------------------

create policy "published passports are readable by anyone"
  on ownerships for select to anon, authenticated
  using (is_public);

-- A vehicle becomes visible only because some ownership of it is published.
create policy "vehicles behind a published passport are readable"
  on vehicles for select to anon
  using (exists (
    select 1 from ownerships o
    where o.vehicle_id = vehicles.id and o.is_public
  ));

create policy "entries on published passports are readable"
  on entries for select to anon, authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = entries.ownership_id and o.is_public
  ));

create policy "parts on published passports are readable"
  on parts for select to anon, authenticated
  using (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = parts.entry_id and o.is_public
  ));

create policy "photos on published passports are readable"
  on photos for select to anon, authenticated
  using (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = photos.entry_id and o.is_public
  ));

-- Only profiles that have actually published something become visible, so
-- publishing is what exposes a handle rather than merely signing up.
create policy "profiles behind a published passport are readable"
  on profiles for select to anon
  using (exists (
    select 1 from ownerships o
    where o.owner_id = profiles.id and o.is_public
  ));
