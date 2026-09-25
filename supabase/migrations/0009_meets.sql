-- Meets: people with cars, in one place, at one time.
--
-- A meet is posted to a region, not a map pin. Regions are the same coarse
-- areas profiles use, and the place is free text the host writes -- a
-- car park, a coffee shop -- because the app should never be the thing that
-- teaches someone to publish where their car sleeps at night.
--
-- Meets and who's going are visible to any signed-in member, never to the
-- public: a list of which cars will be where, and when, is a gift to thieves
-- if it's indexed by a search engine.

create table meets (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references profiles (id) on delete cascade,
  title      text not null check (char_length(trim(title)) between 1 and 80),
  details    text check (details is null or char_length(details) <= 2000),
  region     text not null,
  place      text not null check (char_length(trim(place)) between 1 and 120),
  starts_at  timestamptz not null,
  created_at timestamptz not null default now()
);

create index meets_upcoming on meets (region, starts_at);
create index meets_by_host on meets (host_id);

-- One row per person per meet. The car is optional -- plenty of people turn
-- up in whatever they drove -- and when given it must be one they own now,
-- enforced below, so nobody can claim to be bringing someone else's car.
create table meet_rsvps (
  meet_id    uuid not null references meets (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  vehicle_id uuid references vehicles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meet_id, profile_id)
);

create index meet_rsvps_by_profile on meet_rsvps (profile_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table meets      enable row level security;
alter table meet_rsvps enable row level security;

create policy "members read meets"
  on meets for select to authenticated
  using (true);

create policy "members host meets as themselves"
  on meets for insert to authenticated
  with check (host_id = (select auth.uid()));

create policy "hosts edit their meets"
  on meets for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "hosts cancel their meets"
  on meets for delete to authenticated
  using (host_id = (select auth.uid()));

create policy "members read who is going"
  on meet_rsvps for select to authenticated
  using (true);

create policy "members say they are going"
  on meet_rsvps for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (vehicle_id is null or public.currently_owns(vehicle_id))
  );

create policy "members change which car they bring"
  on meet_rsvps for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and (vehicle_id is null or public.currently_owns(vehicle_id))
  );

create policy "members change their mind"
  on meet_rsvps for delete to authenticated
  using (profile_id = (select auth.uid()));
