-- Reminders: what's due next, worked out from the log.
--
-- A reminder is an interval -- every 5,000 miles, every 24 months, or both,
-- whichever comes first -- and when it was last done. Whether it's due is
-- worked out in the app from the car's latest logged odometer and today's
-- date, rather than stored, so it can never go stale.
--
-- Reminders belong to an ownership, like entries, and are private to it.
-- They don't pass to the next owner: how often someone changes their oil is
-- their habit, not a fact about the car. What was actually done stays in the
-- log, which does pass on.

create table reminders (
  id                  uuid primary key default gen_random_uuid(),
  ownership_id        uuid not null references ownerships (id) on delete cascade,
  title               text not null check (char_length(trim(title)) between 1 and 60),
  every_miles         integer check (every_miles is null or every_miles > 0),
  every_months        integer check (every_months is null or every_months between 1 and 240),
  last_done_on        date,
  last_done_odometer  integer check (last_done_odometer is null or last_done_odometer >= 0),
  created_at          timestamptz not null default now(),

  -- A reminder that never comes due isn't one.
  constraint reminder_has_an_interval check (every_miles is not null or every_months is not null)
);

create index reminders_by_ownership on reminders (ownership_id);

alter table reminders enable row level security;

create policy "owners read their reminders"
  on reminders for select to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = reminders.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "owners add reminders"
  on reminders for insert to authenticated
  with check (exists (
    select 1 from ownerships o
    where o.id = reminders.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "owners change reminders"
  on reminders for update to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = reminders.ownership_id and o.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from ownerships o
    where o.id = reminders.ownership_id and o.owner_id = (select auth.uid())
  ));

create policy "owners delete reminders"
  on reminders for delete to authenticated
  using (exists (
    select 1 from ownerships o
    where o.id = reminders.ownership_id and o.owner_id = (select auth.uid())
  ));
