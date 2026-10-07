-- A minimal stand-in for what a Supabase project provides before any of
-- Sonder's migrations run. Only for local tests; never apply this to Supabase.
-- Roles belong to the whole server, not one database, so a second test
-- database built from this file must not fail on them.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

create schema auth;
grant usage on schema auth to anon, authenticated;
-- email_confirmed_at, banned_until and created_at are what the reminder
-- emails check; the default keeps every fixture user confirmed.
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz default now(),
  banned_until timestamptz,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  -- Same fallback order as Supabase's own definition.
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
grant usage on schema storage to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
-- Supabase grants these; what a role may actually see is up to the policies.
grant select, insert, update, delete on storage.objects to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;

-- Supabase Vault and pg_net, reduced to what the email senders touch:
-- a table of secrets, and a http_post that records the request instead of
-- sending it. Same argument names as the real one, which is called with them.
create schema vault;
create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
create schema net;
create table net.calls (id bigserial primary key, url text, headers jsonb, body jsonb);
create function net.http_post(
  url text,
  body jsonb default '{}',
  params jsonb default '{}',
  headers jsonb default '{"Content-Type": "application/json"}',
  timeout_milliseconds integer default 5000
) returns bigint language sql as $$
  insert into net.calls (url, headers, body) values (url, headers, body) returning id
$$;

-- pg_net's record of what each request got back. send_reminder_emails() reads
-- id and status_code (null when the request timed out).
create table net._http_response (
  id bigint primary key,
  status_code integer,
  content text,
  timed_out boolean,
  error_msg text,
  created timestamptz default now()
);
