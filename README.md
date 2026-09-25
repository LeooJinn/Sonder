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
- Everything stored in Postgres, so a garage follows the account to any
  device and survives reinstalling the app

**What's next**

- Following a car or a member, so a meet or a listing nearby finds you
- Service reminders from the log: when the next oil change is due, by miles
  or months

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

The row-level security policies have tests. They apply every migration to a
throwaway local Postgres and check, as an anonymous visitor and as signed-in
members, what each can read and write:

```bash
npm install --no-save embedded-postgres pg
node supabase/tests/run.mjs
```

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
  sign-in.tsx    /sign-in     sign in or create an account
  (tabs)/                     the three tabs; the group adds nothing to URLs
    index.tsx    /            the garage
    market.tsx   /market      cars for sale
    meets.tsx    /meets       upcoming meets
  add.tsx        /add         VIN entry
  profile.tsx    /profile     handle, display name, region
  vehicle/[vin]/              one car: passport, log, gallery, listing, sale
  meet/          /meet/new    post a meet; /meet/:id to see one and say you're going
  p/[vin].tsx    /p/:vin      a published passport — the only public screen
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
