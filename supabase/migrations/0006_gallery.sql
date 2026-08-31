-- Gallery: photos of the car that aren't attached to any log entry.
--
-- A shot of the car parked in good light isn't a modification, a service or a
-- repair, and forcing it to be one would corrupt the build log -- the thing a
-- future buyer is meant to trust as a maintenance record.
--
-- Rather than a second photos table with its own storage paths and cleanup
-- rules, a photo now hangs off EITHER an entry OR an ownership. A check
-- constraint makes that exclusive, so a photo can never belong to both or to
-- neither and end up unreachable.

alter table photos
  add column ownership_id uuid references ownerships (id) on delete cascade,
  add column caption text;

alter table photos
  alter column entry_id drop not null;

alter table photos
  add constraint photo_has_exactly_one_parent check (
    (entry_id is not null and ownership_id is null)
    or
    (entry_id is null and ownership_id is not null)
  );

create index photos_by_ownership on photos (ownership_id, position);

-- ---------------------------------------------------------------------------
-- Policies for the ownership-attached half
--
-- The existing entry-based policies still cover entry photos. These are the
-- parallel set for gallery photos, following exactly the same reachability
-- rules: your own, inherited by the current owner, and visible on a published
-- passport.
-- ---------------------------------------------------------------------------

create policy "users read gallery photos on their ownerships"
  on photos for select to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = photos.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "users add gallery photos to their ownerships"
  on photos for insert to authenticated
  with check (exists (
    select 1 from ownerships o
    where o.id = photos.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "users update gallery photos on their ownerships"
  on photos for update to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = photos.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "users delete gallery photos on their ownerships"
  on photos for delete to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = photos.ownership_id and o.owner_id = (select auth.uid())
  ));

-- Inherited by whoever currently owns the car, read only.
create policy "current owner reads prior gallery photos"
  on photos for select to authenticated
  using (
    photos.ownership_id is not null
    and public.currently_owns(
      (select o.vehicle_id from ownerships o where o.id = photos.ownership_id)
    )
  );

-- Visible on a published passport, to anyone.
create policy "gallery photos on published passports are readable"
  on photos for select to anon, authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = photos.ownership_id and o.is_public
  ));
