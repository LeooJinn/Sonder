-- Reports and blocks: what members can do about spam, scams and people
-- they'd rather not see.
--
-- Anyone signed in can post a meet or list a car, so there has to be a way to
-- flag the bad ones that doesn't depend on someone watching the dashboard.
-- A report is private: only the database and the project's owners (through
-- the Supabase dashboard, which bypasses row-level security) can read them.
-- Three reports from different members act on their own -- the meet is
-- hidden, the listing comes off the market and stays off -- and whoever
-- looks at the reports afterwards can undo that if it was wrong.
--
-- A block is a member's own filter. It hides the other person's meets and
-- listings from them in the app; it isn't a sanction, so it has no effect on
-- anyone else.

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  -- A meet's id, or for a listing, the id of the ownership that's listed.
  target_kind text not null check (target_kind in ('meet', 'listing')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'scam', 'unsafe', 'other')),
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),

  -- One report per member per thing, so one angry person can't reach the
  -- threshold alone.
  unique (reporter_id, target_kind, target_id)
);

create index reports_by_target on reports (target_kind, target_id);

alter table reports enable row level security;

create policy "members file reports as themselves"
  on reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- No select policy: members can't read reports, including their own, so a
-- report can't be used to find out who else has complained.

/* How many different members have reported this. Security definer because
   nobody can read the reports table directly. */
create function public.report_count(kind text, target uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(distinct reporter_id)::integer
  from reports
  where target_kind = kind and target_id = target;
$$;

revoke all on function public.report_count(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Acting on reports
-- ---------------------------------------------------------------------------

alter table meets add column hidden_at timestamptz;

create function public.act_on_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.report_count(new.target_kind, new.target_id) >= 3 then
    if new.target_kind = 'meet' then
      update meets set hidden_at = coalesce(hidden_at, now()) where id = new.target_id;
    else
      update ownerships set for_sale = false where id = new.target_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_act_at_threshold
  after insert on reports
  for each row execute function public.act_on_reports();

-- A hidden meet is gone for everyone but its host, who can still see it and
-- why. Replaces the open policy from 0009.
drop policy "members read meets" on meets;

create policy "members read meets that are not hidden"
  on meets for select to authenticated
  using (hidden_at is null or host_id = (select auth.uid()));

-- A listing taken down by reports stays down: the trigger from 0008 now also
-- refuses to put it back on the market. Clearing the reports in the
-- dashboard is how it's reinstated.
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
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

create table blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint cannot_block_yourself check (blocker_id <> blocked_id)
);

alter table blocks enable row level security;

create policy "members see who they've blocked"
  on blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "members block for themselves"
  on blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "members unblock"
  on blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));
