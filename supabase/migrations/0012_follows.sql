-- Following: members follow cars and people, and read what they do.
--
-- Following grants no new access. Everything a follower sees is already
-- readable to them -- a published passport's entries, a listed car, a meet
-- any member can read -- and the feed below runs with the caller's own
-- row-level security, so it cannot show more than the caller could fetch by
-- hand.
--
-- A car follow belongs to the vehicle, not to whoever owns it, so it survives
-- a sale: the follower keeps reading the car's life under its next owner,
-- whenever that owner publishes. A person follow covers only the periods that
-- person published themselves. A published car shows every earlier period
-- (0007), but earlier owners stay anonymous unless they published their own;
-- a person follow that swept those in would put a name back on them.
--
-- Follower counts are public; who follows whom is visible only to the one
-- being followed. A list of which people watch which cars is exactly what a
-- car thief would want, and nothing about following needs it to be public.

-- ---------------------------------------------------------------------------
-- When a passport was published: the "newly published" feed item
-- ---------------------------------------------------------------------------

alter table ownerships add column published_at timestamptz;

-- Passports public before this migration: their publishing moment is lost, so
-- use when the ownership began rather than inventing a date.
update ownerships set published_at = created_at where is_public and published_at is null;

create function public.stamp_published()
returns trigger
language plpgsql
as $$
begin
  if new.is_public and (tg_op = 'INSERT' or not old.is_public) then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger ownership_published_at
  before insert or update of is_public on ownerships
  for each row execute function public.stamp_published();

-- ---------------------------------------------------------------------------
-- When a member last looked at their feed: the dot on the Following tab
-- ---------------------------------------------------------------------------

alter table profiles add column feed_seen_at timestamptz;

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------

create table car_follows (
  follower_id uuid not null references profiles (id) on delete cascade,
  vehicle_id  uuid not null references vehicles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, vehicle_id)
);

create index car_follows_by_vehicle on car_follows (vehicle_id);

create table member_follows (
  follower_id uuid not null references profiles (id) on delete cascade,
  followed_id uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint cannot_follow_yourself check (follower_id <> followed_id)
);

create index member_follows_by_followed on member_follows (followed_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer: each answers one question, leaks only a value)
-- ---------------------------------------------------------------------------

/* Either person has blocked the other. blocks is only readable by the
   blocker, so a follow policy can't check it directly. */
create function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

/* Who owns the vehicle now, if anyone. */
create function public.current_owner(vehicle uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select owner_id from ownerships where vehicle_id = vehicle and ended_on is null;
$$;

/* Public counts. Anyone may read a number; nobody but the followed may read
   the list behind it. */
create function public.car_follower_count(vehicle uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer from car_follows where vehicle_id = vehicle;
$$;

create function public.member_follower_count(member uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer from member_follows where followed_id = member;
$$;

revoke all on function public.blocked_between(uuid, uuid) from public, anon;
revoke all on function public.current_owner(uuid) from public, anon;
grant execute on function public.blocked_between(uuid, uuid) to authenticated;
grant execute on function public.current_owner(uuid) to authenticated;
grant execute on function public.car_follower_count(uuid) to anon, authenticated;
grant execute on function public.member_follower_count(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table car_follows    enable row level security;
alter table member_follows enable row level security;

create policy "followers and current owners read car follows"
  on car_follows for select to authenticated
  using (follower_id = (select auth.uid()) or public.currently_owns(vehicle_id));

create policy "members follow published cars that aren't theirs"
  on car_follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and public.vehicle_is_published(vehicle_id)
    and not public.currently_owns(vehicle_id)
    and not public.blocked_between((select auth.uid()), public.current_owner(vehicle_id))
  );

create policy "members unfollow cars"
  on car_follows for delete to authenticated
  using (follower_id = (select auth.uid()));

create policy "both sides read a person follow"
  on member_follows for select to authenticated
  using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));

-- Only members with a handle can be followed as a person: they have a page
-- at /u/handle, and a follow of someone with no page leads nowhere.
create policy "members follow people with a handle"
  on member_follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and exists (select 1 from profiles p where p.id = followed_id and p.handle is not null)
    and not public.blocked_between((select auth.uid()), followed_id)
  );

create policy "members unfollow people"
  on member_follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Blocking removes follows both ways
-- ---------------------------------------------------------------------------

create function public.unfollow_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from member_follows
   where (follower_id = new.blocker_id and followed_id = new.blocked_id)
      or (follower_id = new.blocked_id and followed_id = new.blocker_id);

  delete from car_follows cf
   where (cf.follower_id = new.blocked_id and public.current_owner(cf.vehicle_id) = new.blocker_id)
      or (cf.follower_id = new.blocker_id and public.current_owner(cf.vehicle_id) = new.blocked_id);

  return new;
end;
$$;

create trigger blocks_remove_follows
  after insert on blocks
  for each row execute function public.unfollow_on_block();

-- ---------------------------------------------------------------------------
-- The feed
--
-- One ordered stream of what the caller follows, newest first. Security
-- invoker: every table read here is filtered by the caller's own policies,
-- so an item appears only if the caller could already read its row.
--
-- The periods in scope are every period of a followed car, plus the
-- published periods of a followed person. From those come five kinds of
-- item: log entries, listings, publishing, sales (the seller's side, and
-- only if the seller published), and meets hosted by followed people.
--
-- actor_id names whose period an item belongs to, and is null when that
-- period isn't published: the passport shows such history unattributed, and
-- the feed must not attribute it either.
--
-- Entries logged before the follow are capped at the newest ten per car, so
-- following a well-documented car shows its recent story without flooding
-- the feed with years of it. Everything after the follow comes through.
-- ---------------------------------------------------------------------------

create function public.my_feed(before timestamptz default null, max_items integer default 30)
returns table (
  kind          text,
  at            timestamptz,
  ownership_id  uuid,
  vehicle_id    uuid,
  entry_id      uuid,
  meet_id       uuid,
  actor_id      uuid
)
language sql
security invoker
stable
set search_path = public
as $$
  with scope as (
    select o.id, o.vehicle_id, o.is_public, o.for_sale, o.listed_at, o.published_at, o.ended_on,
           case when o.is_public then o.owner_id end as actor_id,
           min(s.since) as since
    from ownerships o
    join (
      select o2.id, cf.created_at as since
        from car_follows cf join ownerships o2 on o2.vehicle_id = cf.vehicle_id
       where cf.follower_id = (select auth.uid())
      union all
      select o3.id, mf.created_at
        from member_follows mf join ownerships o3 on o3.owner_id = mf.followed_id and o3.is_public
       where mf.follower_id = (select auth.uid())
    ) s on s.id = o.id
    group by o.id
  ),
  entry_items as (
    select e.created_at as at, sc.id as ownership_id, sc.vehicle_id, e.id as entry_id, sc.actor_id,
           e.created_at >= sc.since as after_follow,
           row_number() over (partition by sc.vehicle_id order by e.created_at desc) as recency
    from entries e join scope sc on sc.id = e.ownership_id
  ),
  items as (
    select 'entry'::text as kind, at, ownership_id, vehicle_id, entry_id, null::uuid as meet_id, actor_id
      from entry_items where after_follow or recency <= 10
    union all
    select 'listed', sc.listed_at, sc.id, sc.vehicle_id, null, null, sc.actor_id
      from scope sc where sc.for_sale and sc.listed_at is not null
    union all
    select 'published', sc.published_at, sc.id, sc.vehicle_id, null, null, sc.actor_id
      from scope sc where sc.is_public and sc.published_at is not null
    union all
    select 'sold', sc.ended_on::timestamptz, sc.id, sc.vehicle_id, null, null, sc.actor_id
      from scope sc where sc.ended_on is not null and sc.is_public
    union all
    select 'meet', m.created_at, null, null, null, m.id, m.host_id
      from meets m join member_follows mf on mf.followed_id = m.host_id
     where mf.follower_id = (select auth.uid())
  )
  select * from items i
  where (before is null or i.at < before)
    and not (i.actor_id is not null and public.blocked_between((select auth.uid()), i.actor_id))
  order by i.at desc
  limit least(greatest(max_items, 1), 100);
$$;

revoke all on function public.my_feed(timestamptz, integer) from public, anon;
grant execute on function public.my_feed(timestamptz, integer) to authenticated;
