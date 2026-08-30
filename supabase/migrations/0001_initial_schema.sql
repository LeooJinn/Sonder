-- Sonder: initial schema
--
-- The shape of this is driven by one requirement: a car's history must
-- survive being sold. That rules out hanging entries off a user (history
-- dies with the sale) and off a vehicle alone (the buyer inherits authorship
-- of the seller's work). Entries therefore belong to an OWNERSHIP PERIOD —
-- a span of time during which one person owned one car.

-- ---------------------------------------------------------------------------
-- profiles
--
-- auth.users is managed by Supabase and shouldn't be modified directly, so
-- application-level user data lives here, keyed by the same id.
-- ---------------------------------------------------------------------------

create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text unique,
  display_name text,
  region       text,
  created_at   timestamptz not null default now()
);

-- Create a profile automatically whenever someone signs up, so application
-- code never has to cope with a signed-in user who has no profile row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- vehicles
--
-- One row per physical car in the world, not per user. A VIN identifies
-- exactly one vehicle, so two people cannot each hold their own copy of the
-- same car — which is precisely what makes a passport transferable.
--
-- Every column here comes from the VIN decode, so it is the same for everyone
-- and nobody "owns" the record itself.
-- ---------------------------------------------------------------------------

create table vehicles (
  id           uuid primary key default gen_random_uuid(),
  vin          text unique not null check (char_length(vin) = 17),
  year         text,
  make         text,
  model        text,
  trim         text,
  body_class   text,
  drive_type   text,
  cylinders    text,
  displacement text,
  fuel_type    text,
  transmission text,
  plant        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ownerships
--
-- The hinge of the entire model. A garage is "vehicles where I have an
-- ownership that hasn't ended".
-- ---------------------------------------------------------------------------

create table ownerships (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete cascade,
  owner_id   uuid not null references profiles (id) on delete cascade,
  started_on date not null default current_date,
  -- NULL means "still owns it". A sale sets this date rather than deleting
  -- the row, because the history attached to it must survive.
  ended_on   date,
  created_at timestamptz not null default now(),

  constraint ownership_dates_ordered check (ended_on is null or ended_on >= started_on)
);

-- A car can have many past owners but only one current one. A partial unique
-- index enforces that: unique across vehicle_id, but only for rows where
-- ended_on is null. Past ownerships are exempt, so a car can be sold
-- repeatedly without ever violating it.
create unique index one_current_owner_per_vehicle
  on ownerships (vehicle_id)
  where ended_on is null;

create index ownerships_by_owner on ownerships (owner_id);

-- ---------------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------------

create table entries (
  id           uuid primary key default gen_random_uuid(),
  ownership_id uuid not null references ownerships (id) on delete cascade,
  kind         text not null check (kind in ('mod', 'service', 'repair', 'milestone')),
  title        text not null check (char_length(trim(title)) > 0),
  notes        text,
  -- A calendar date: the day the work happened, not the moment it was typed.
  occurred_on  date not null,
  odometer     integer check (odometer is null or odometer >= 0),
  -- Integer cents. Floating point cannot represent decimals exactly.
  cost_cents   integer check (cost_cents is null or cost_cents >= 0),
  created_at   timestamptz not null default now()
);

create index entries_by_ownership on entries (ownership_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- parts
-- ---------------------------------------------------------------------------

create table parts (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references entries (id) on delete cascade,
  brand       text not null,
  name        text not null,
  part_number text,
  cost_cents  integer check (cost_cents is null or cost_cents >= 0),
  -- Preserves the order the user entered them; rows are otherwise unordered.
  position    integer not null default 0
);

create index parts_by_entry on parts (entry_id, position);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Without these policies the anon key — which ships inside the app and can be
-- read out of any installed copy — would grant access to every row in every
-- table. RLS is what makes a public key safe.
--
-- Default is deny: with RLS enabled and no matching policy, a query returns
-- nothing rather than erroring.
-- ---------------------------------------------------------------------------

alter table profiles   enable row level security;
alter table vehicles   enable row level security;
alter table ownerships enable row level security;
alter table entries    enable row level security;
alter table parts      enable row level security;

-- profiles: readable by any signed-in user (needed for public passports
-- later); writable only by yourself.
create policy "profiles are readable by authenticated users"
  on profiles for select to authenticated
  using (true);

create policy "users update their own profile"
  on profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- vehicles: decoded facts, identical for everyone. Any signed-in user may
-- read one and create one (looking up a VIN nobody has saved yet). Nobody
-- may change or delete them — the VIN decode is canonical, and edits would
-- affect every owner past and present.
create policy "vehicles are readable by authenticated users"
  on vehicles for select to authenticated
  using (true);

create policy "authenticated users may add a vehicle"
  on vehicles for insert to authenticated
  with check (true);

-- ownerships: you can see and manage your own.
create policy "users read their own ownerships"
  on ownerships for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "users claim ownership for themselves"
  on ownerships for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "users update their own ownerships"
  on ownerships for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "users delete their own ownerships"
  on ownerships for delete to authenticated
  using (owner_id = (select auth.uid()));

-- entries: reachable only through an ownership you hold. The EXISTS subquery
-- is the join RLS can't express directly.
create policy "users read entries on their ownerships"
  on entries for select to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = entries.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "users write entries on their ownerships"
  on entries for insert to authenticated
  with check (exists (
    select 1 from ownerships o
    where o.id = entries.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "users update entries on their ownerships"
  on entries for update to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = entries.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "users delete entries on their ownerships"
  on entries for delete to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = entries.ownership_id and o.owner_id = (select auth.uid())
  ));

-- parts: same reachability, one join further out.
create policy "users read parts on their entries"
  on parts for select to authenticated
  using (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = parts.entry_id and o.owner_id = (select auth.uid())
  ));

create policy "users write parts on their entries"
  on parts for insert to authenticated
  with check (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = parts.entry_id and o.owner_id = (select auth.uid())
  ));

create policy "users update parts on their entries"
  on parts for update to authenticated
  using (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = parts.entry_id and o.owner_id = (select auth.uid())
  ));

create policy "users delete parts on their entries"
  on parts for delete to authenticated
  using (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = parts.entry_id and o.owner_id = (select auth.uid())
  ));
