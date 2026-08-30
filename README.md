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

---

## Status

Very early. This is being built in public, one working slice at a time.

**What works today**

- Enter a 17-character VIN and decode it against the [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) database
- See year, make, model, trim, engine, drivetrain, body class, and assembly plant
- Save vehicles to a garage that persists on the device
- Browse the garage, open a vehicle, remove it
- Log mods, service, repairs and milestones against a vehicle, with dates,
  odometer readings, costs and the parts fitted
- Edit and delete entries
- Accounts — sign up and sign in with email and password

**What's next**

- Move the garage and build log to Postgres so data follows the account
- Ownership periods, so a passport transfers when the car sells
- Photos

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
| **Auth** | Supabase |
| **Storage** | On-device for now; Postgres next |

Deliberately boring choices. The interesting problem here is the community, not the
infrastructure.

---

## Project layout

```
app/                    screens — a file's path is its route
  _layout.tsx           wraps every screen
  index.tsx             /              the garage
  add.tsx               /add           VIN entry
  vehicle/[vin].tsx     /vehicle/:vin  one car
components/             shared UI
lib/
  vin.ts                VIN validation and vPIC decoding
  garage.ts             on-device storage
  theme.ts              colours in one place
assets/                 icons and splash
```

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
