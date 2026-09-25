-- For sale: an owner can list a published car, with its history as the proof.
--
-- A listing is not a separate object. It is three facts about the current
-- ownership -- that it's for sale, for how much, and how to get in touch --
-- because the thing being sold is the car and its passport, and a listing
-- that could drift out of step with either would be worse than none.
--
-- Listing requires publishing: a buyer who can't read the history has no
-- reason to prefer this listing over any other. That is enforced by a
-- trigger rather than a check constraint, so that unpublishing, selling or
-- deleting an account simply takes the car off the market instead of
-- failing with a constraint error the app would have to anticipate.

alter table ownerships
  add column for_sale            boolean not null default false,
  add column asking_price_cents  integer check (asking_price_cents is null or asking_price_cents >= 0),
  -- Chosen and written by the seller, and shown publicly: "Text 555-0100",
  -- "DM @handle". Sonder has no messaging, and a contact line the seller
  -- controls is better than exposing an email address they never chose to.
  add column sale_contact        text check (sale_contact is null or char_length(sale_contact) <= 200),
  add column listed_at           timestamptz;

create function public.keep_listing_consistent()
returns trigger
language plpgsql
as $$
begin
  if new.ended_on is not null or not new.is_public then
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

create trigger listing_follows_ownership
  before insert or update on ownerships
  for each row execute function public.keep_listing_consistent();

-- The market is read newest first, and only ever reads listed cars.
create index ownerships_for_sale on ownerships (listed_at desc) where for_sale;

-- No new read policy is needed: a listed ownership is always a published
-- one, and published ownerships, their vehicles and their owners' profiles
-- are already readable by anyone through 0003.
