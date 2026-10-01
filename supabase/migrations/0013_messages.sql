-- Messaging: two members who follow each other can talk.
--
-- The rule is deliberately narrow. Sonder has no inbox for strangers: a
-- message needs a follow in both directions (0012), so nobody can be written
-- to by someone they haven't chosen to hear from, and a block (0011) ends a
-- conversation on the spot. A message is text, optionally with a "car card":
-- a link to a car whose passport is published, which anyone can read anyway.
-- No photos, no files.
--
-- Each pair has one conversation. When the mutual follow ends, or either
-- side blocks the other, the conversation stays readable but nobody can add
-- to it. Deleting a conversation clears it for the one who deleted it and
-- leaves the other side's copy alone; a new message brings back only what
-- was sent after the clearing.
--
-- Three reports from different members against one sender's messages pause
-- that sender's messaging. The pause isn't stored: it's counted from the
-- reports whenever it's asked about, so it can't be edited away (a member
-- can update their own profile row) and clearing the reports in the
-- dashboard lifts it.
--
-- The tables are read through row-level security and written only through
-- the functions below, which take their identity from auth.uid(). Members
-- can't create conversations, join someone else's, or change what a
-- membership row says.

-- ---------------------------------------------------------------------------
-- Reports can name a message
-- ---------------------------------------------------------------------------

alter table reports drop constraint reports_target_kind_check;
alter table reports
  add constraint reports_target_kind_check check (target_kind in ('meet', 'listing', 'message'));

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  -- The pair, smaller id first, so a pair can have only one conversation.
  -- Null once that member deletes their account; the other keeps what they
  -- sent and received.
  member_low      uuid references profiles (id) on delete set null,
  member_high     uuid references profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  constraint conversation_pair_ordered check (member_low < member_high),
  unique (member_low, member_high)
);

-- One row per member per conversation: where they've read up to, and the
-- moment they deleted it, if they did.
create table conversation_members (
  conversation_id uuid not null references conversations (id) on delete cascade,
  profile_id      uuid not null references profiles (id) on delete cascade,
  read_at         timestamptz,
  cleared_at      timestamptz,
  primary key (conversation_id, profile_id)
);

create index conversation_members_by_profile on conversation_members (profile_id);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  -- Deleting an account deletes what it sent.
  sender_id       uuid not null references profiles (id) on delete cascade,
  body            text not null check (char_length(body) <= 2000 and btrim(body) <> ''),
  -- The car card. A car can leave Sonder; the message stays.
  vehicle_id      uuid references vehicles (id) on delete set null,
  -- The wall clock rather than the transaction's start, so "since I last read"
  -- and "since I cleared" compare correctly against messages sent a moment later.
  created_at      timestamptz not null default clock_timestamp()
);

create index messages_by_conversation on messages (conversation_id, created_at desc);
create index messages_by_sender on messages (sender_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer: each answers one question about the caller)
-- ---------------------------------------------------------------------------

/* The caller's messaging is paused: three different members have reported
   what they sent. */
create function public.messaging_paused()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select count(distinct r.reporter_id) >= 3
  from reports r
  join messages m on m.id = r.target_id
  where r.target_kind = 'message' and m.sender_id = auth.uid();
$$;

/* The caller may send to this member: they follow each other, neither has
   blocked the other, and the caller isn't paused. Always asked from the
   caller's side, so it can't be used to look into other people's follows. */
create function public.can_message(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null
     and other is not null
     and other <> auth.uid()
     and exists (select 1 from member_follows where follower_id = auth.uid() and followed_id = other)
     and exists (select 1 from member_follows where follower_id = other and followed_id = auth.uid())
     and not public.blocked_between(auth.uid(), other)
     and not public.messaging_paused();
$$;

/* The other member of a conversation the caller is in; null if the caller
   isn't in it, or the other member has deleted their account. */
create function public.other_member(conversation uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select case when c.member_low = auth.uid() then c.member_high else c.member_low end
  from conversations c
  join conversation_members cm on cm.conversation_id = c.id and cm.profile_id = auth.uid()
  where c.id = conversation;
$$;

/* The caller is in the conversation this message belongs to, and didn't
   write it. Reports are the only reason to ask. */
create function public.can_report_message(message uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from messages m
    join conversation_members cm on cm.conversation_id = m.conversation_id and cm.profile_id = auth.uid()
    where m.id = message and m.sender_id <> auth.uid()
  );
$$;

revoke all on function public.messaging_paused() from public, anon;
revoke all on function public.can_message(uuid) from public, anon;
revoke all on function public.other_member(uuid) from public, anon;
revoke all on function public.can_report_message(uuid) from public, anon;
grant execute on function public.messaging_paused() to authenticated;
grant execute on function public.can_message(uuid) to authenticated;
grant execute on function public.other_member(uuid) to authenticated;
grant execute on function public.can_report_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table conversations        enable row level security;
alter table conversation_members enable row level security;
alter table messages             enable row level security;

-- Members read only their own membership rows. Who the other person is comes
-- from the conversation itself.
create policy "members read their own memberships"
  on conversation_members for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "members read their conversations"
  on conversations for select to authenticated
  using (exists (
    select 1 from conversation_members cm
    where cm.conversation_id = conversations.id and cm.profile_id = (select auth.uid())
  ));

-- What was sent before the reader deleted the conversation is gone for them.
create policy "members read messages since they last cleared"
  on messages for select to authenticated
  using (exists (
    select 1 from conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.profile_id = (select auth.uid())
      and (cm.cleared_at is null or messages.created_at > cm.cleared_at)
  ));

-- Sending needs a conversation you're in, a mutual follow with the other
-- member, and a car card that points at a published car.
create policy "members send to people they follow mutually"
  on messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_message(public.other_member(conversation_id))
    and (vehicle_id is null or public.vehicle_is_published(vehicle_id))
  );

-- No insert, update or delete on the conversation tables, and no update or
-- delete on messages: a sent message can't be edited or unsent, which keeps
-- a report pointing at what was actually said.
revoke all on conversations, conversation_members, messages from anon;
revoke insert, update, delete on conversations, conversation_members from authenticated;
revoke update, delete on messages from authenticated;

-- Reporting a message needs to be in its conversation. Replaces the policy
-- from 0011.
drop policy "members file reports as themselves" on reports;

create policy "members file reports as themselves"
  on reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (target_kind <> 'message' or public.can_report_message(target_id))
  );

-- A message report acts through messaging_paused(), not here.
create or replace function public.act_on_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.report_count(new.target_kind, new.target_id) >= 3 then
    if new.target_kind = 'meet' then
      update meets set hidden_at = coalesce(hidden_at, now()) where id = new.target_id;
    elsif new.target_kind = 'listing' then
      update ownerships set for_sale = false where id = new.target_id;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Keeping a conversation's bookkeeping straight
-- ---------------------------------------------------------------------------

create function public.after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  -- You've read what you just wrote.
  update conversation_members set read_at = new.created_at
   where conversation_id = new.conversation_id and profile_id = new.sender_id;
  return new;
end;
$$;

create trigger messages_after_insert
  after insert on messages
  for each row execute function public.after_message();

-- When the last member of a conversation deletes their account, nothing is
-- left to keep.
create function public.drop_empty_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from conversations c
   where c.id = old.conversation_id
     and not exists (select 1 from conversation_members cm where cm.conversation_id = c.id);
  return old;
end;
$$;

create trigger conversation_members_after_delete
  after delete on conversation_members
  for each row execute function public.drop_empty_conversation();

-- ---------------------------------------------------------------------------
-- What the app calls
-- ---------------------------------------------------------------------------

/* Open the conversation with another member, creating it if the two of them
   are allowed to talk. An existing conversation is returned even when it's
   closed, so it can still be read. */
create function public.start_conversation(other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  lo  uuid;
  hi  uuid;
  cid uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if other is null or other = me then
    raise exception 'Pick someone else to message' using errcode = '22023';
  end if;

  lo := least(me, other);
  hi := greatest(me, other);

  select id into cid from conversations where member_low = lo and member_high = hi;
  if cid is not null then
    return cid;
  end if;

  if not public.can_message(other) then
    raise exception 'You can message members you follow and who follow you back'
      using errcode = '42501';
  end if;

  insert into conversations (member_low, member_high) values (lo, hi)
  on conflict (member_low, member_high) do nothing
  returning id into cid;

  if cid is null then
    select id into cid from conversations where member_low = lo and member_high = hi;
  end if;

  insert into conversation_members (conversation_id, profile_id)
  values (cid, me), (cid, other)
  on conflict do nothing;

  return cid;
end;
$$;

/* The caller has read everything in this conversation up to now. */
create function public.mark_conversation_read(conversation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update conversation_members set read_at = clock_timestamp()
   where conversation_id = conversation and profile_id = auth.uid();
$$;

/* Delete the conversation for the caller only. */
create function public.clear_conversation(conversation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update conversation_members set cleared_at = clock_timestamp(), read_at = clock_timestamp()
   where conversation_id = conversation and profile_id = auth.uid();
$$;

/* The caller's inbox, newest first. Security invoker: messages are filtered
   by the caller's own policies, so a conversation the caller has cleared
   (nothing left to show) isn't listed until something new arrives. Unread
   counts leave out anyone the caller has blocked or who blocked them, so
   the badge never nags about a conversation that's been shut. */
create function public.my_inbox()
returns table (
  conversation_id uuid,
  other_id        uuid,
  last_body       text,
  last_vehicle_id uuid,
  last_sender_id  uuid,
  last_at         timestamptz,
  unread          integer,
  can_reply       boolean
)
language sql
security invoker
stable
set search_path = public
as $$
  select c.id,
         o.other_id,
         lm.body,
         lm.vehicle_id,
         lm.sender_id,
         lm.created_at,
         (select count(*)::integer
            from messages m
           where m.conversation_id = c.id
             and m.sender_id <> (select auth.uid())
             and (cm.read_at is null or m.created_at > cm.read_at)
             and not public.blocked_between((select auth.uid()), m.sender_id)),
         public.can_message(o.other_id)
  from conversation_members cm
  join conversations c on c.id = cm.conversation_id
  cross join lateral (
    select case when c.member_low = (select auth.uid()) then c.member_high else c.member_low end as other_id
  ) o
  cross join lateral (
    select m.body, m.vehicle_id, m.sender_id, m.created_at
      from messages m
     where m.conversation_id = c.id
     order by m.created_at desc
     limit 1
  ) lm
  where cm.profile_id = (select auth.uid())
  order by lm.created_at desc;
$$;

/* Unread messages across every conversation: the badge. */
create function public.unread_message_count()
returns integer
language sql
security invoker
stable
set search_path = public
as $$
  select count(*)::integer
  from messages m
  join conversation_members cm
    on cm.conversation_id = m.conversation_id and cm.profile_id = (select auth.uid())
  where m.sender_id <> (select auth.uid())
    and (cm.read_at is null or m.created_at > cm.read_at)
    and not public.blocked_between((select auth.uid()), m.sender_id);
$$;

revoke all on function public.start_conversation(uuid) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.clear_conversation(uuid) from public, anon;
revoke all on function public.my_inbox() from public, anon;
revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.clear_conversation(uuid) to authenticated;
grant execute on function public.my_inbox() to authenticated;
grant execute on function public.unread_message_count() to authenticated;
