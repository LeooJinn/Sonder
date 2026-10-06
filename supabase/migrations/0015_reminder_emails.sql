-- Email when a maintenance reminder comes due.
--
-- A reminder comes due the way the app already decides it: whichever of its
-- mileage or its months runs out first (lib/reminders.ts, reminderStatus).
-- Once a day pg_cron runs send_reminder_emails(), which mails each member one
-- digest of the reminders that have newly come due on their cars. Same
-- machinery as 0014: Postgres posts to Resend through pg_net, with the key
-- and sender in Vault, and every email carries a one-click unsubscribe link.
-- Neither extension nor the schedule is created here; with no key in Vault
-- the sender does nothing at all, so this migration is safe to apply first.
--
-- What an email says: how many reminders are due, the car's name, and the
-- titles the member wrote. Never a VIN, a mileage, a date, an entry or a
-- cost, and the subject names neither the car nor a title.
--
-- reminder_is_due() and known_mileage() are the same rules as reminderStatus()
-- and knownMileage() in lib/reminderStatus.ts. They are kept equal by
-- supabase/tests/run.mjs, which compares them over thousands of generated
-- cases. Change one side and that test goes red; change both together.
--
-- Migrations are immutable once applied. To change claim_reminder_emails() or
-- send_reminder_emails() later, use `create or replace` with the IDENTICAL
-- argument list. A different list creates an overload, and the sender's call
-- (which relies on defaults) becomes ambiguous. To change the arguments, drop
-- the function first.

-- ---------------------------------------------------------------------------
-- Keep last-done dates sane
-- ---------------------------------------------------------------------------

-- 0010 put no bounds on last_done_on, and any member can write any date. A
-- date near the year 5,000,000 makes date arithmetic raise, which would stop
-- the nightly job for everyone. NOT VALID so applying this can never fail on
-- a row that is already there; the sender below ignores such rows anyway.
alter table reminders
  add constraint reminders_last_done_on_sane
  check (last_done_on is null or last_done_on between date '1900-01-01' and date '2100-12-31')
  not valid;

-- ---------------------------------------------------------------------------
-- A member's choice, and the token that lets an email act on it
-- ---------------------------------------------------------------------------

-- Separate from message_email_settings, so turning off one kind of email, or
-- leaking one kind of token, never touches the other.
create table reminder_email_settings (
  profile_id        uuid primary key references profiles (id) on delete cascade,
  enabled           boolean not null default true,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  -- A calendar day (UTC), not a timestamp, so the weekly limit does not
  -- wobble with when the job happened to start.
  last_emailed_on   date
);

insert into reminder_email_settings (profile_id) select id from profiles;

create function public.create_reminder_email_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into reminder_email_settings (profile_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_reminder_email_settings
  after insert on profiles
  for each row execute function public.create_reminder_email_settings();

alter table reminder_email_settings enable row level security;

create policy "members read their own reminder email setting"
  on reminder_email_settings for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "members change their own reminder email setting"
  on reminder_email_settings for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- The switch is the only thing a member can change.
revoke all on reminder_email_settings from anon;
revoke insert, update, delete on reminder_email_settings from authenticated;
grant update (enabled) on reminder_email_settings to authenticated;

/* Turn off reminder emails for the member a token belongs to. True if the
   token matched. Callable without signing in, because the link in an email is
   opened by someone who may not be. */
create function public.unsubscribe_reminder_emails(token uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with matched as (
    update reminder_email_settings set enabled = false
     where unsubscribe_token = token
    returning 1
  )
  select exists (select 1 from matched);
$$;

revoke all on function public.unsubscribe_reminder_emails(uuid) from public;
grant execute on function public.unsubscribe_reminder_emails(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- What counts as due
-- ---------------------------------------------------------------------------

/* The same rule as reminderStatus() in lib/reminderStatus.ts: due when the
   miles are used up, or the months are, whichever comes first. A half that
   lacks its inputs is ignored; with neither, a reminder is never due.

   The bigint keeps two large intervals from raising "integer out of range".
   The case keeps a date outside 1900-2100 (see the constraint above) from
   raising in the date arithmetic: such a row is treated as having no date. */
create function public.reminder_is_due(
  every_miles        integer,
  every_months       integer,
  last_done_on       date,
  last_done_odometer integer,
  mileage            integer,
  on_date            date
)
returns boolean
language sql
immutable
as $$
  select coalesce(last_done_odometer::bigint + every_miles - mileage <= 0, false)
      or coalesce(
           case when last_done_on between date '1900-01-01' and date '2100-12-31'
                then (last_done_on + every_months * interval '1 month')::date <= on_date
           end,
           false);
$$;

/* A car's mileage as far as Sonder knows: the highest odometer in its log or
   in any of its reminders' last-done readings (knownMileage in
   lib/reminderStatus.ts). Null when there is no reading at all. */
create function public.known_mileage(ownership uuid)
returns integer
language sql
stable
as $$
  select greatest(
    (select max(odometer) from entries where ownership_id = ownership),
    (select max(last_done_odometer) from reminders where ownership_id = ownership)
  );
$$;

/* Text that came from a member, made safe to print: runs of whitespace and
   control characters become one space, and it is cut short. */
create function public.email_text(value text, max_length integer)
returns text
language sql
immutable
as $$
  select left(btrim(regexp_replace(value, '[[:space:][:cntrl:]]+', ' ', 'g')), max_length);
$$;

/* "2020 Ford Escape". The year, make and model come from a vehicles row, and
   any member can create one with any text, so only letters, digits, spaces,
   and & ' + - survive, cut to 40. */
create function public.email_car(year text, make text, model text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(left(btrim(regexp_replace(
           regexp_replace(concat_ws(' ', year, make, model), '[[:space:][:cntrl:]]+', ' ', 'g'),
           '[^[:alnum:] &''+-]', '', 'g')), 40), ''), 'car');
$$;

revoke all on function public.reminder_is_due(integer, integer, date, integer, integer, date) from public, anon, authenticated;
revoke all on function public.known_mileage(uuid) from public, anon, authenticated;
revoke all on function public.email_text(text, integer) from public, anon, authenticated;
revoke all on function public.email_car(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What has been emailed
-- ---------------------------------------------------------------------------

/* One row per reminder that has been emailed in its current "episode": from
   when it comes due until it is done, edited, or stops being due. It holds a
   copy of the reminder's last-done values at the time, so ticking the
   reminder off in a log entry (which changes them) starts a new episode with
   no trigger and no change to reminders.

   Server only: no policy, no grant. Cascades with the reminder, so deleting a
   reminder, a car or an account removes it. */
create table reminder_emails (
  reminder_id        uuid primary key references reminders (id) on delete cascade,
  first_sent_on      date not null,
  last_sent_on       date not null,
  sent_count         smallint not null check (sent_count >= 1),
  last_done_on       date,
  last_done_odometer integer
);

alter table reminder_emails enable row level security;
revoke all on reminder_emails from anon, authenticated;

/* One row per email handed to pg_net, so a failure at Resend can be seen and
   undone. pg_net posts after this transaction commits and keeps the answer
   for about six hours in net._http_response; settle_reminder_email_sends()
   reads it on the job's later runs the same morning. `undo` is what to put
   back if Resend refused the email: the member's last_emailed_on, and each
   reminder's reminder_emails row as it was (null for none). */
create table reminder_email_sends (
  request_id bigint primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  sent_on    date not null,
  sent_at    timestamptz not null default now(),
  status     text not null default 'pending'
             check (status in ('pending', 'delivered', 'released', 'rejected')),
  undo       jsonb not null
);

alter table reminder_email_sends enable row level security;
revoke all on reminder_email_sends from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Which emails are due
-- ---------------------------------------------------------------------------

/* Pick the emails that are due and mark them sent in the same statement, so
   two runs can never pick the same one. A reminder is due as of `on_date`
   when reminder_is_due() says so, on a car the member owns now. It is
   emailed when:
     - it has existed for `settle_days`, so one just created or edited in the
       app, which the member has already seen there, waits;
     - this episode has not been emailed yet, or it is still due
       `follow_up_days` after the first email and has had fewer than
       `max_per_episode` (the one gentle follow-up, then silence);
     - the member has emails on, a confirmed address, is not suspended, and
       was last emailed at least `member_gap_days` ago. Everything eligible at
       that moment goes in one digest.
   At most `max_emails` members per call, the longest-waiting first.

   First it forgets reminders that are no longer due or whose car was sold:
   fixing a mistyped odometer or lengthening an interval starts the reminder
   afresh. Returns `undo` for settle_reminder_email_sends(). */
create function public.claim_reminder_emails(
  follow_up_days  integer default 14,
  max_per_episode integer default 2,
  member_gap_days integer default 7,
  settle_days     integer default 2,
  max_emails      integer default 2,
  on_date         date    default (now() at time zone 'utc')::date
)
returns table (
  recipient_id      uuid,
  email             text,
  cars              jsonb,
  total             integer,
  follow_up         boolean,
  unsubscribe_token uuid,
  undo              jsonb
)
language sql
security definer
set search_path = public
as $$
  delete from reminder_emails re
   using reminders r, ownerships o
   where r.id = re.reminder_id
     and o.id = r.ownership_id
     and (o.ended_on is not null
          or o.owner_id is null
          or not public.reminder_is_due(r.every_miles, r.every_months, r.last_done_on,
                                        r.last_done_odometer, public.known_mileage(r.ownership_id), on_date));

  with due as (
    select r.id as reminder_id,
           r.ownership_id,
           o.owner_id as recipient_id,
           r.created_at,
           r.last_done_on,
           r.last_done_odometer,
           public.email_text(r.title, 60) as title,
           public.email_car(v.year, v.make, v.model) as car,
           (re.reminder_id is not null
            and re.last_done_on is not distinct from r.last_done_on
            and re.last_done_odometer is not distinct from r.last_done_odometer) as seen,
           re.sent_count,
           re.first_sent_on,
           case when re.reminder_id is null then null else to_jsonb(re) end as prev
    from reminders r
    join ownerships o on o.id = r.ownership_id and o.ended_on is null and o.owner_id is not null
    join vehicles v on v.id = o.vehicle_id
    left join reminder_emails re on re.reminder_id = r.id
    where public.reminder_is_due(r.every_miles, r.every_months, r.last_done_on,
                                 r.last_done_odometer, public.known_mileage(r.ownership_id), on_date)
      and (r.created_at at time zone 'utc')::date <= on_date - settle_days
  ),
  fresh as (
    select * from due d
    where not d.seen
       or (d.sent_count < max_per_episode and d.first_sent_on <= on_date - follow_up_days)
  ),
  members as (
    select s.profile_id, s.unsubscribe_token, s.last_emailed_on, u.email::text as email
    from reminder_email_settings s
    join auth.users u on u.id = s.profile_id
    where s.enabled
      and u.email is not null
      and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
      and (s.last_emailed_on is null or s.last_emailed_on <= on_date - member_gap_days)
      and exists (select 1 from fresh f where f.recipient_id = s.profile_id)
    order by s.last_emailed_on nulls first, s.profile_id
    limit max_emails
  ),
  picked as (
    select f.*, m.email, m.unsubscribe_token, m.last_emailed_on
    from fresh f
    join members m on m.profile_id = f.recipient_id
  ),
  marked as (
    insert into reminder_emails as t (reminder_id, first_sent_on, last_sent_on, sent_count, last_done_on, last_done_odometer)
    select reminder_id, on_date, on_date, 1, last_done_on, last_done_odometer from picked
    on conflict (reminder_id) do update set
      sent_count    = case when t.last_done_on is not distinct from excluded.last_done_on
                            and t.last_done_odometer is not distinct from excluded.last_done_odometer
                           then t.sent_count + 1 else 1 end,
      first_sent_on = case when t.last_done_on is not distinct from excluded.last_done_on
                            and t.last_done_odometer is not distinct from excluded.last_done_odometer
                           then t.first_sent_on else excluded.first_sent_on end,
      last_sent_on  = excluded.last_sent_on,
      last_done_on  = excluded.last_done_on,
      last_done_odometer = excluded.last_done_odometer
    returning t.reminder_id
  ),
  touched as (
    update reminder_email_settings s set last_emailed_on = on_date
     where s.profile_id in (select recipient_id from picked)
    returning s.profile_id
  ),
  per_car as (
    select p.recipient_id, p.email, p.unsubscribe_token, p.ownership_id, p.car,
           count(*)::integer as n,
           jsonb_agg(p.title order by p.created_at, p.reminder_id) as titles,
           bool_and(p.seen) as all_seen
    from picked p
    join marked m on m.reminder_id = p.reminder_id
    group by p.recipient_id, p.email, p.unsubscribe_token, p.ownership_id, p.car
  )
  select pc.recipient_id,
         pc.email,
         jsonb_agg(jsonb_build_object('car', pc.car, 'titles', pc.titles) order by pc.car, pc.ownership_id),
         sum(pc.n)::integer,
         bool_and(pc.all_seen),
         pc.unsubscribe_token,
         (select jsonb_build_object(
                   'last_emailed_on', min(pk.last_emailed_on),
                   'items', jsonb_agg(jsonb_build_object('id', pk.reminder_id, 'prev', pk.prev)))
            from picked pk
            join marked mk on mk.reminder_id = pk.reminder_id
           where pk.recipient_id = pc.recipient_id)
  from per_car pc
  group by pc.recipient_id, pc.email, pc.unsubscribe_token;
$$;

revoke all on function public.claim_reminder_emails(integer, integer, integer, integer, integer, date) from public, anon, authenticated;

/* Read what Resend said about the emails sent earlier and undo the ones it
   refused for a reason that may pass (a rate limit, an outage, a key not yet
   set up), so the next run sends them again. 2xx is delivered. 400 and 422
   mean this one email is wrong (a bad address), so it is left as sent.
   Returns how many it undid. */
create function public.settle_reminder_email_sends()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s        record;
  undone   integer := 0;
begin
  for s in
    select e.request_id, e.profile_id, e.undo,
           case when r.status_code between 200 and 299 then 'delivered'
                when r.status_code in (400, 422) then 'rejected'
                else 'released' end as outcome
    from reminder_email_sends e
    join net._http_response r on r.id = e.request_id
    where e.status = 'pending'
  loop
    if s.outcome = 'released' then
      update reminder_email_settings
         set last_emailed_on = (s.undo ->> 'last_emailed_on')::date
       where profile_id = s.profile_id;

      -- A reminder that had no row goes back to having none.
      delete from reminder_emails
       where reminder_id in (
         select (i ->> 'id')::uuid
           from jsonb_array_elements(s.undo -> 'items') i
          where jsonb_typeof(i -> 'prev') = 'null');

      -- One that had a row gets it back. Skips reminders deleted since.
      insert into reminder_emails as t
      select p.*
        from jsonb_array_elements(s.undo -> 'items') i
        cross join lateral jsonb_populate_record(null::reminder_emails, i -> 'prev') p
        join reminders r on r.id = p.reminder_id
       where jsonb_typeof(i -> 'prev') = 'object'
      on conflict (reminder_id) do update set
        first_sent_on = excluded.first_sent_on,
        last_sent_on = excluded.last_sent_on,
        sent_count = excluded.sent_count,
        last_done_on = excluded.last_done_on,
        last_done_odometer = excluded.last_done_odometer;

      undone := undone + 1;
    end if;
    update reminder_email_sends set status = s.outcome where request_id = s.request_id;
  end loop;

  delete from reminder_email_sends where sent_at < now() - interval '7 days';
  return undone;
end;
$$;

revoke all on function public.settle_reminder_email_sends() from public, anon, authenticated;

/* Mark every reminder that is due right now as already told, so those stay
   quiet until they start over. Called once at the end of this migration, and
   again by hand just before the job is first scheduled, so turning the emails
   on does not announce things that were overdue long before. */
create function public.silence_current_reminder_emails(
  on_date date default (now() at time zone 'utc')::date
)
returns integer
language sql
security definer
set search_path = public
as $$
  with silenced as (
    insert into reminder_emails (reminder_id, first_sent_on, last_sent_on, sent_count, last_done_on, last_done_odometer)
    select r.id, on_date, on_date, 2, r.last_done_on, r.last_done_odometer
    from reminders r
    join ownerships o on o.id = r.ownership_id and o.ended_on is null and o.owner_id is not null
    where public.reminder_is_due(r.every_miles, r.every_months, r.last_done_on,
                                 r.last_done_odometer, public.known_mileage(r.ownership_id), on_date)
    on conflict (reminder_id) do nothing
    returning 1
  )
  select count(*)::integer from silenced;
$$;

revoke all on function public.silence_current_reminder_emails(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------------

/* Send the digests that are due. Returns how many it sent. Does nothing, and
   claims nothing, until the Resend key and a sender address are in Vault under
   `resend_api_key` and `reminder_email_from` (or `message_email_from`).

   Meant to run every five minutes for two hours each morning: at most two
   emails per run (Resend allows about two requests a second) and forty a day,
   leaving room for sign-in and message emails on the same account. Each run
   first reads what Resend said about the earlier ones and undoes any it
   turned away, so the next run tries again. */
create function public.send_reminder_emails(
  on_date     date    default (now() at time zone 'utc')::date,
  settle_days integer default 2
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  site     constant text := 'https://www.imsonder.com';
  per_run  constant integer := 2;
  per_day  constant integer := 40;
  api_key  text;
  sender   text;
  room     integer;
  due      record;
  car      jsonb;
  title    jsonb;
  shown    integer;
  sent     integer := 0;
  request  bigint;
  heading  text;
  stop     text;
  blocks   text;
  plain    text;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select coalesce(
           (select nullif(decrypted_secret, '') from vault.decrypted_secrets where name = 'reminder_email_from'),
           (select nullif(decrypted_secret, '') from vault.decrypted_secrets where name = 'message_email_from')
         ) into sender;
  if coalesce(api_key, '') = '' or coalesce(sender, '') = '' then
    return 0;
  end if;

  -- Two overlapping runs (the schedule and a manual one) must not both send.
  if not pg_try_advisory_xact_lock(hashtext('send_reminder_emails')) then
    return 0;
  end if;

  -- Reading Resend's answers depends on pg_net's own table. If that is not as
  -- expected, losing the retry must not lose the emails.
  begin
    perform public.settle_reminder_email_sends();
  exception when others then
    raise warning 'settle_reminder_email_sends failed: %', sqlerrm;
  end;

  select per_day - count(*) into room
    from reminder_email_sends where sent_on = on_date and status <> 'released';
  if room <= 0 then
    return 0;
  end if;

  for due in
    select * from public.claim_reminder_emails(
      settle_days => settle_days,
      max_emails => least(per_run, room),
      on_date => on_date)
  loop
    heading := case when due.follow_up then 'Still due: ' else '' end
            || case when due.total = 1 then 'A reminder is due'
                    else due.total || ' reminders are due' end;
    stop := site || '/api/unsubscribe?for=reminders&t=' || due.unsubscribe_token;

    blocks := '';
    plain := '';
    for car in select * from jsonb_array_elements(due.cars) loop
      blocks := blocks
        || '<p style="margin:18px 0 2px;font-size:13px;line-height:20px;color:#526159;">'
        || public.html_escape(car ->> 'car') || '</p>';
      plain := plain || E'\n' || (car ->> 'car') || E'\n';
      shown := 0;
      for title in select * from jsonb_array_elements(car -> 'titles') loop
        shown := shown + 1;
        exit when shown > 8;
        blocks := blocks
          || '<p style="margin:0;padding:9px 0;border-top:1px solid #C5CFC3;font-size:17px;'
          || 'line-height:24px;font-weight:600;">' || public.html_escape(title #>> '{}') || '</p>';
        plain := plain || '  ' || (title #>> '{}') || E'\n';
      end loop;
      if jsonb_array_length(car -> 'titles') > 8 then
        blocks := blocks
          || '<p style="margin:0;padding:9px 0;border-top:1px solid #C5CFC3;font-size:15px;'
          || 'line-height:22px;color:#526159;">and ' || (jsonb_array_length(car -> 'titles') - 8) || ' more</p>';
        plain := plain || '  and ' || (jsonb_array_length(car -> 'titles') - 8) || E' more\n';
      end if;
    end loop;

    select net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', sender,
        'to', jsonb_build_array(due.email),
        'subject', heading || ' on Sonder',
        'html',
          '<!doctype html><html><body style="margin:0;padding:24px 12px;background:#16302A;'
          || 'font-family:-apple-system,''Segoe UI'',Helvetica,Arial,sans-serif;">'
          || '<div style="max-width:480px;margin:0 auto;">'
          || '<div style="font-family:''Arial Narrow'',Arial,sans-serif;font-size:28px;font-weight:700;'
          || 'color:#D4B46E;padding:0 4px 16px;">Sonder</div>'
          || '<div style="background:#E3E9DF;border-radius:14px;padding:26px 24px;color:#14201C;">'
          || '<p style="margin:0 0 4px;font-size:21px;line-height:27px;font-weight:700;">'
          || public.html_escape(heading) || '</p>'
          || blocks
          || '<p style="margin:20px 0 22px;font-size:16px;line-height:24px;color:#526159;">'
          || 'Open Sonder to see where each one stands. When the work is done, tick it off in the '
          || 'log entry and the reminder starts over.</p>'
          || '<a href="' || site || '/" style="display:inline-block;background:#D4B46E;color:#16302A;'
          || 'font-size:16px;font-weight:600;text-decoration:none;padding:14px 22px;border-radius:10px;">'
          || 'Open your garage</a>'
          || '</div>'
          || '<p style="margin:18px 4px 0;font-size:13px;line-height:20px;color:#A7B9B1;">'
          || 'You get at most one of these a week, and only when a reminder has come due. '
          || '<a href="' || replace(stop, '&', '&amp;') || '" style="color:#D4B46E;">Stop these emails</a></p>'
          || '</div></body></html>',
        'text',
          heading || E'.\n' || plain
          || E'\nOpen Sonder to see where each one stands. When the work is done, tick it off in the '
          || E'log entry and the reminder starts over.\nOpen your garage: ' || site || E'/\n\n'
          || E'You get at most one of these a week, and only when a reminder has come due.\n'
          || 'Stop these emails: ' || stop,
        'headers', jsonb_build_object(
          'List-Unsubscribe', '<' || stop || '>',
          'List-Unsubscribe-Post', 'List-Unsubscribe=One-Click'
        )
      )
    ) into request;

    insert into reminder_email_sends (request_id, profile_id, sent_on, undo)
    values (request, due.recipient_id, on_date, due.undo);
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

revoke all on function public.send_reminder_emails(date, integer) from public, anon, authenticated;

-- Reminders that are already due when this is applied are not news.
select public.silence_current_reminder_emails();
