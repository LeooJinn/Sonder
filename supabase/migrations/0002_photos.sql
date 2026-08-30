-- Photos on build log entries.
--
-- Two halves that Postgres does not connect for you: rows in public.photos,
-- and the actual image files in Supabase Storage. Deleting a row cascades;
-- deleting the file does not. Application code has to remove the object.

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------

create table photos (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references entries (id) on delete cascade,
  -- Path within the bucket, always "<user_id>/<entry_id>/<uuid>.jpg".
  -- The leading folder is what the storage policies below check against.
  storage_path text not null unique,
  width        integer,
  height       integer,
  -- Preserves the order photos were added; rows are otherwise unordered.
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create index photos_by_entry on photos (entry_id, position);

alter table photos enable row level security;

-- Reachable only through an entry on an ownership the caller holds — the same
-- two-join reachability rule used for parts.
create policy "users read photos on their entries"
  on photos for select to authenticated
  using (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = photos.entry_id and o.owner_id = (select auth.uid())
  ));

create policy "users add photos to their entries"
  on photos for insert to authenticated
  with check (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = photos.entry_id and o.owner_id = (select auth.uid())
  ));

create policy "users update photos on their entries"
  on photos for update to authenticated
  using (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = photos.entry_id and o.owner_id = (select auth.uid())
  ));

create policy "users delete photos on their entries"
  on photos for delete to authenticated
  using (exists (
    select 1 from entries e
    join ownerships o on o.id = e.ownership_id
    where e.id = photos.entry_id and o.owner_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Storage
--
-- A public bucket: anyone with the URL can view an image. That is deliberate.
-- Signed URLs expire and need refreshing, build photos are not sensitive, and
-- passports are meant to be shareable. Security here is about who can WRITE.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  5242880,                                   -- 5 MB ceiling, enforced server-side
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'photos');

-- storage.foldername(name) splits the path on "/", so [1] is the first folder.
-- Requiring it to equal the caller's id means nobody can write into anyone
-- else's folder, or overwrite their images.
create policy "users upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users update their own images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete their own images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
