-- Account deletion.
--
-- Deleting an account must not destroy history that other people now depend
-- on. Someone who sold a car and then deleted their account would otherwise
-- gut the buyer's passport -- the exact thing Sonder promises is permanent --
-- and would hand every seller a way to wipe a buyer's records out of spite.
--
-- So: identity is erased, history is kept and anonymised. Under GDPR, data
-- with no link back to a person is no longer personal data, which is why
-- anonymising is an accepted alternative to deletion.

-- ---------------------------------------------------------------------------
-- Ownerships must be able to outlive their owner
-- ---------------------------------------------------------------------------

alter table ownerships alter column owner_id drop not null;

alter table ownerships drop constraint ownerships_owner_id_fkey;

alter table ownerships
  add constraint ownerships_owner_id_fkey
  foreign key (owner_id) references profiles (id) on delete set null;

-- Existing RLS policies compare owner_id to auth.uid(). A null never matches,
-- so an orphaned period belongs to nobody and is editable by nobody. It stays
-- readable through the inherited-history policies in 0004, which key off the
-- vehicle rather than the owner.

-- ---------------------------------------------------------------------------
-- The deletion itself
--
-- auth.users cannot be deleted with the anon key, so this runs as security
-- definer. It only ever acts on auth.uid(), so a caller can delete themselves
-- and nobody else.
-- ---------------------------------------------------------------------------

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  -- Cars still owned leave with the account. Their entries, parts and photo
  -- rows cascade; the image files are removed by the client beforehand,
  -- because Postgres cannot reach storage.
  delete from ownerships
   where owner_id = uid and ended_on is null;

  -- Past periods survive so the current owner keeps the car's history, but
  -- stripped of identity. Unpublished too: publishing was a choice tied to a
  -- person, and it should not outlive the account that made it.
  update ownerships
     set owner_id = null,
         is_public = false
   where owner_id = uid;

  -- Cascades to profiles, and from there to nothing else, since no ownership
  -- references this profile any more.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
