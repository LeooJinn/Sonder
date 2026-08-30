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

- Enter a 17-character VIN
- Decode it against the [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) database
- See year, make, model, trim, engine, drivetrain, body class, and assembly plant

**What's next**

- The garage — save decoded vehicles, browse them, open one
- Build log — mods, service, repairs and milestones against a vehicle
- Photos
- Accounts, and ownership transfer between them

---

## Running it locally

You'll need [Node.js](https://nodejs.org) and the [Expo Go](https://expo.dev/go) app on
your phone.

```bash
git clone https://github.com/LeooJinn/Sonder.git
cd Sonder
npm install
npm start
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
| **Planned backend** | Supabase (Postgres, auth, storage) |

Deliberately boring choices. The interesting problem here is the community, not the
infrastructure.

---

## Project layout

```
App.tsx        UI — screens and components
lib/vin.ts     VIN validation and vPIC decoding
assets/        icons and splash
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
