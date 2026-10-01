# Sonder

**Every car has a life of its own.**

*Sonder* — the realization that each passer-by has a life as vivid and complex as your own.

Cars are the same. A car gets built, modified, broken, fixed, and loved across years and
owners — and then it gets sold, and all of that history evaporates. The next owner starts
from zero, asking the same questions in the same forums, with no idea what the car has
already been through.

Sonder gives the car its own profile, keyed to its VIN. Mods, service, repairs, milestones,
photos — a build history that belongs to the vehicle and **transfers when the car sells**.
Your work stays credited to you. The car keeps its story.

**Live at [imsonder.com](https://www.imsonder.com)** — and every published passport has
its own link, openable by anyone, no account needed:

```
https://www.imsonder.com/p/<VIN>
```

---

## Status

Early, but real: deployed, with accounts and a database behind it. Built in public,
one working slice at a time.

**What works today**

- Enter a 17-character VIN and decode it against the [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) database
- See year, make, model, trim, engine, drivetrain, body class, and assembly plant
- Save vehicles to a garage that persists on the device
- Browse the garage, open a vehicle, remove it
- Log mods, service, repairs and milestones against a vehicle, with dates,
  odometer readings, costs and the parts fitted
- Edit and delete entries
- Attach photos to entries, resized and compressed on the way up
- A gallery of the car itself, separate from the maintenance record
- Accounts, with a handle, display name and region, and account deletion that
  erases identity without destroying history other people rely on
- **Publish a passport** at a link anyone can open without an account
- **Sell a car** — the history stays with the vehicle. The next owner inherits
  a readable record of everything before them, and the previous owner keeps
  credit for their own work
- **The full ownership chain** on a published passport: every owner's time with
  the car, as one timeline along the odometer. Previous owners are named only
  if they published their own period
- **List a car for sale** with an asking price and a contact line. Listings
  appear under For sale, filterable by region, and every one is a published
  passport — a buyer reads the history before they get in touch
- **Meets**: post one to a region, say you're going, and pick which car you're
  bringing. Members only, and never on a public page
- **Reminders** for oil changes, brake fluid, registration and the rest, by
  miles, months or both. Due dates come from the log's own mileage and dates,
  and ticking a reminder off in a log entry resets it
- **Reporting and blocking** for meets, listings and messages. Three reports
  from different members take a meet or listing down automatically, or pause
  a sender's messaging; reports are read in the Supabase dashboard
- **Following** cars and members. A Following tab shows new log entries, cars
  going up for sale, newly published passports, sales and meets, newest first,
  with a dot when something is new. Following grants no new access: the feed
  only holds what was already public. Counts are public; who follows whom is
  visible only to the person followed. Blocking removes follows both ways
- **Messages** between members who follow each other: text, plus a car card
  that links to a published passport. Opened from Messages in the garage's top
  bar (with an unread mark) or the Message button on a member's page. When the
  mutual follow ends, or either side blocks, the conversation stays readable
  but closed. Deleting a conversation clears it for you only
- **An email for messages you haven't read**: at most one per conversation every
  four hours, sent only once the oldest unread message is fifteen minutes old,
  saying who wrote and how many, never what they said. On by default, with a
  switch in Profile and an unsubscribe link in every email. Needs the one-time
  setup under "Turning on message emails" below; until then nothing is sent
- **Member pages** at `imsonder.com/u/<handle>`: a member's name, region and
  published cars, openable by anyone
- A **front page** for people who aren't members yet: a car's life told along
  its odometer, a VIN lookup, and a real published passport as the example
- Shared passport links **preview** with the car's photo, name and history in
  iMessage, Instagram, Discord and anywhere else that unfurls links
- Everything stored in Postgres, so a garage follows the account to any
  device and survives reinstalling the app

**What's next**

- Reminders that reach you outside the app: a push notification or an email
  when something comes due

---

## Running it locally

You'll need [Node.js](https://nodejs.org) and the [Expo Go](https://expo.dev/go) app on
your phone.

```bash
git clone https://github.com/LeooJinn/Sonder.git
cd Sonder
npm install
cp .env.example .env
npm start
```

Accounts need a [Supabase](https://supabase.com) project. Create a free one, then
put its Project URL and anon key into `.env` — both are under Project Settings → API.
Environment variables are read at build time, so restart with `npx expo start -c`
after changing them.

Apply the migrations in `supabase/migrations/` in filename order, via the SQL Editor.
They are meant to run once each, in sequence — re-running one fails on objects that
already exist.

The production project is connected to this repository through Supabase's GitHub
integration: a new migration file pushed to `main` is applied to production
automatically, and the "Supabase Preview" check on the commit reports how it went.
Migrations 0001–0011 were applied by hand before the integration was connected and
are recorded as applied in `supabase_migrations.schema_migrations`, so the
integration skips them. Name new files with the next number, `0015_…sql` and on.

The row-level security policies have tests. They apply every migration to a
throwaway local Postgres and check, as an anonymous visitor and as signed-in
members, what each can read and write:

```bash
npm install --no-save embedded-postgres pg
node supabase/tests/run.mjs
```

### Sign-in email

Sign-in confirmations go out through Resend (Supabase Auth, Authentication → Emails →
SMTP Settings: `smtp.resend.com`, port 465, user `resend`, the sending-only API key as the
password, sender `Sonder <noreply@imsonder.com>`). The email itself is
`supabase/email-templates/confirm-signup.html`. Supabase doesn't read it from the repo, so a
change here means pasting the body into Authentication → Emails → Templates → Confirm sign up.

### Turning on message emails

Migration 0014 holds everything except what only the hosted project can do, so
until these steps are done `send_message_emails()` finds no key and sends
nothing. Once, in the Supabase SQL Editor:

```sql
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Resend: an API key, and an address on a domain verified there (the one the
-- auth emails already send from works).
select vault.create_secret('re_...', 'resend_api_key');
select vault.create_secret('Sonder <messages@imsonder.com>', 'message_email_from');

select cron.schedule('send-message-emails', '*/5 * * * *', 'select public.send_message_emails()');
```

`select cron.unschedule('send-message-emails')` stops it. Emails are sent by
Postgres through pg_net, which is asynchronous: a failure at Resend shows up in
`net._http_response`, not as an error, and that email waits for its next window.
The unsubscribe link goes to `api/unsubscribe.ts`, deployed with the rest of the
site.

Then either scan the QR code with Expo Go (Android: scan from inside the app — iOS: use the
stock Camera app), or enter the `exp://` URL from the terminal manually. Your phone and
computer need to be on the same network.

Press `w` in the terminal to run it in a browser instead.

No API keys required — vPIC is a free public service.

---

## Stack

| | |
|---|---|
| **App** | React Native + Expo, TypeScript |
| **VIN data** | NHTSA vPIC API |
| **Backend** | Supabase — Postgres, auth, storage, row-level security |
| **Web** | Vercel, deployed from `main` |

Deliberately boring choices. The interesting problem here is the community, not the
infrastructure.

One consequence worth naming: the anon key ships inside the client, as it is designed to.
Access is governed entirely by row-level security policies in the migrations, not by that
key being secret.

---

## Project layout

```
app/                          screens — a file's path is its route
  _layout.tsx                 wraps every screen, guards the signed-out ones
  welcome.tsx    /welcome     the front page for visitors: the odometer story and a VIN lookup
  sign-in.tsx    /sign-in     sign in or create an account
  (tabs)/                     the four tabs; the group adds nothing to URLs
    index.tsx    /            the garage
    following.tsx /following  what followed cars and people have been doing
    market.tsx   /market      cars for sale
    meets.tsx    /meets       upcoming meets
  messages/      /messages    the inbox; /messages/:id is one conversation
  add.tsx        /add         VIN entry
  profile.tsx    /profile     handle, display name, region
  vehicle/[vin]/              one car: passport, log, reminders, gallery, listing, sale
  meet/          /meet/new    post a meet; /meet/:id to see one and say you're going
api/passport-page.ts          /p/:vin's HTML, with the car in it for link previews
api/unsubscribe.ts            /api/unsubscribe: the link in message emails
  p/[vin].tsx    /p/:vin      a published passport, public
  u/[handle].tsx /u/:handle   a member's page, public
components/                   shared UI
lib/
  vin.ts                      VIN validation and vPIC decoding
  garage.ts                   vehicles and ownerships
  log.ts                      build log entries and parts
  photos.ts                   uploads, resizing, storage cleanup
  passport.ts                 published passports, with every owner's chapter
  history.ts                  inherited history from previous owners
  market.ts                   listing a car, and browsing listings
  meets.ts                    meets and who's going
  reminders.ts                what's due next, worked out from the log
  moderation.ts               reports and blocks
  follows.ts / feed.ts        following, and the Following feed
  messages.ts                 conversations, sending, and who can message whom
  members.ts                  member pages
  profile.ts / account.ts     identity, and deleting it
  auth.tsx                    session state
  supabase.ts                 database client
  regions.ts / dates.ts       shared value types
  errors.ts                   failures as sentences a person can act on
  theme.ts                    colours, type and radii in one place
supabase/migrations/          database schema, applied in order
supabase/tests/               row-level security checks against a local Postgres
assets/                       icons and splash
```

The data model turns on one table. Entries belong to an **ownership period**
rather than to a vehicle or a person, which is how a car's history survives
being sold while each owner keeps credit for their own work.

The rule: `lib/` knows nothing about the UI, and the UI knows nothing about HTTP. Keeping
that line intact is what will make this maintainable as it grows.

---

## On safe driving

Sonder is for legal car culture — meets, builds, track days, and the people who care about
them. Street racing, takeovers, and reckless driving have no place here and won't be
supported on the platform.

---

## Copyright

© 2026 Jiaxiang Jin. All rights reserved.

This source is published for reference. It is not licensed for reuse, redistribution, or
commercial use.
