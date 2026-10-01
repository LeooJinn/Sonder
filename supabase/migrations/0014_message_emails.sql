-- Email for messages nobody has read.
--
-- A message that sits unread for a while is worth a nudge; one that was read
-- in the app within minutes is not. So an email goes out only when the oldest
-- message you haven't read is at least fifteen minutes old, and at most once
-- per conversation every four hours. It says who wrote and how many messages,
-- never what they said: an inbox is not as private as this app is.
--
-- It's on for everyone and a member can turn it off in Profile. Every email
-- carries a link that turns it off without signing in; the link holds a
-- random token that belongs to one member and does nothing but that.
--
-- Everything happens inside Postgres. pg_cron calls send_message_emails()
-- every few minutes and it posts to Resend through pg_net, with the API key
-- and sender address read from Supabase Vault. Neither extension nor the
-- schedule is created here, because the local test database has neither;
-- turning them on is a one-time step in the dashboard. With no key in Vault
-- the function does nothing at all, so this migration is safe to apply first.

-- ---------------------------------------------------------------------------
-- A member's choice, and the token that lets an email act on it
-- ---------------------------------------------------------------------------

create table message_email_settings (
  profile_id        uuid primary key references profiles (id) on delete cascade,
  enabled           boolean not null default true,
  -- In every email's unsubscribe link. Kept out of profiles because any
  -- signed-in member can read a profile row.
  unsubscribe_token uuid not null unique default gen_random_uuid()
);

insert into message_email_settings (profile_id) select id from profiles;

create function public.create_message_email_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into message_email_settings (profile_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_message_email_settings
  after insert on profiles
  for each row execute function public.create_message_email_settings();

alter table message_email_settings enable row level security;

create policy "members read their own email setting"
  on message_email_settings for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "members change their own email setting"
  on message_email_settings for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- The switch is the only thing a member can change: not the token, not whose
-- row it is.
revoke all on message_email_settings from anon;
revoke insert, update, delete on message_email_settings from authenticated;
grant update (enabled) on message_email_settings to authenticated;

/* Turn off message emails for the member a token belongs to. True if the
   token matched. Callable without signing in, because the link in an email is
   opened by someone who may not be. */
create function public.unsubscribe_message_emails(token uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with matched as (
    update message_email_settings set enabled = false
     where unsubscribe_token = token
    returning 1
  )
  select exists (select 1 from matched);
$$;

revoke all on function public.unsubscribe_message_emails(uuid) from public;
grant execute on function public.unsubscribe_message_emails(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Which emails are due
-- ---------------------------------------------------------------------------

-- When this member was last emailed about this conversation.
alter table conversation_members add column emailed_at timestamptz;

/* Pick the emails that are due and mark them sent in the same statement, so
   two runs can never pick the same one. A row is due when:
     - the recipient has emails on and an address;
     - they have messages from the other member that they haven't read, haven't
       cleared, and that no earlier email already mentioned;
     - the oldest of those is at least `min_age` old, so reading in the app
       first means no email;
     - they weren't emailed about this conversation in the last `cooldown`;
     - neither has blocked the other. */
create function public.claim_message_emails(
  min_age  interval default '15 minutes',
  cooldown interval default '4 hours'
)
returns table (
  conversation_id   uuid,
  recipient_id      uuid,
  email             text,
  sender_name       text,
  unread            integer,
  unsubscribe_token uuid
)
language sql
security definer
set search_path = public
as $$
  with due as (
    select cm.conversation_id,
           cm.profile_id as recipient_id,
           m.sender_id,
           count(*)::integer as unread
    from conversation_members cm
    join messages m
      on m.conversation_id = cm.conversation_id
     and m.sender_id <> cm.profile_id
     and (cm.read_at is null or m.created_at > cm.read_at)
     and (cm.cleared_at is null or m.created_at > cm.cleared_at)
     and (cm.emailed_at is null or m.created_at > cm.emailed_at)
    where cm.emailed_at is null or cm.emailed_at <= now() - cooldown
    group by cm.conversation_id, cm.profile_id, m.sender_id
    having min(m.created_at) <= now() - min_age
  ),
  claimed as (
    update conversation_members cm
       set emailed_at = now()
      from due
     where cm.conversation_id = due.conversation_id
       and cm.profile_id = due.recipient_id
       and exists (
         select 1 from message_email_settings s
          where s.profile_id = due.recipient_id and s.enabled
       )
       and exists (select 1 from auth.users u where u.id = due.recipient_id and u.email is not null)
       and not public.blocked_between(due.recipient_id, due.sender_id)
    returning cm.conversation_id, cm.profile_id
  )
  select due.conversation_id,
         due.recipient_id,
         u.email::text,
         left(coalesce(nullif(p.display_name, ''), '@' || p.handle, 'A Sonder member'), 60),
         due.unread,
         s.unsubscribe_token
  from due
  join claimed on claimed.conversation_id = due.conversation_id and claimed.profile_id = due.recipient_id
  join auth.users u on u.id = due.recipient_id
  join message_email_settings s on s.profile_id = due.recipient_id
  join profiles p on p.id = due.sender_id;
$$;

revoke all on function public.claim_message_emails(interval, interval) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------------

create function public.html_escape(value text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(replace(value, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

/* Send every email that's due. Returns how many it sent. Does nothing, and
   claims nothing, until the Resend key and sender address are in Vault under
   `resend_api_key` and `message_email_from`.

   pg_net posts asynchronously: a failure at Resend isn't seen here, and that
   email waits for the next window. */
create function public.send_message_emails()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  site    constant text := 'https://www.imsonder.com';
  api_key text;
  sender  text;
  due     record;
  sent    integer := 0;
  heading text;
  link    text;
  stop    text;
  noun    text;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into sender from vault.decrypted_secrets where name = 'message_email_from';
  if coalesce(api_key, '') = '' or coalesce(sender, '') = '' then
    return 0;
  end if;

  for due in select * from public.claim_message_emails() loop
    noun := case when due.unread = 1 then 'a message' else due.unread || ' messages' end;
    heading := due.sender_name || ' sent you ' || noun;
    link := site || '/messages/' || due.conversation_id;
    stop := site || '/api/unsubscribe?t=' || due.unsubscribe_token;

    perform net.http_post(
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
          || '<p style="margin:0 0 8px;font-size:21px;line-height:27px;font-weight:700;">'
          || public.html_escape(heading) || '</p>'
          || '<p style="margin:0 0 22px;font-size:16px;line-height:24px;color:#526159;">'
          || 'Open Sonder to read and reply. What they said stays in the app.</p>'
          || '<a href="' || link || '" style="display:inline-block;background:#D4B46E;color:#16302A;'
          || 'font-size:16px;font-weight:600;text-decoration:none;padding:14px 22px;border-radius:10px;">'
          || case when due.unread = 1 then 'Read the message' else 'Read the messages' end || '</a>'
          || '</div>'
          || '<p style="margin:18px 4px 0;font-size:13px;line-height:20px;color:#A7B9B1;">'
          || 'You get at most one of these per conversation every few hours, and only when you '
          || 'haven''t read the messages yet. <a href="' || stop || '" style="color:#D4B46E;">'
          || 'Stop these emails</a></p>'
          || '</div></body></html>',
        'text',
          heading || E'.\n\nOpen Sonder to read and reply: ' || link
          || E'\n\nWhat they said stays in the app. You get at most one of these per conversation '
          || E'every few hours, and only when you haven''t read the messages yet.'
          || E'\nStop these emails: ' || stop,
        'headers', jsonb_build_object(
          'List-Unsubscribe', '<' || stop || '>',
          'List-Unsubscribe-Post', 'List-Unsubscribe=One-Click'
        )
      )
    );
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

revoke all on function public.send_message_emails() from public, anon, authenticated;
