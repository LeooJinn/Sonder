# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

For everyone who owns a car, but enthusiast-focused first: people who modify, track and maintain their cars and want the work recorded and credited. Buyers of used cars are the second audience — they arrive through a shared passport link and want to know what a car has been through before they buy it.

## Product Purpose

Sonder gives every car its own history, keyed to its VIN: mods, service, repairs, milestones, photos and parts. When the car sells, the history goes with it; the next owner inherits a readable record and each previous owner keeps credit for their own work. Success is a used car that arrives with its whole life written down, and owners who log work because it makes their car worth more to the next person.

## Positioning

History belongs to the car, not to the app user. Entries hang off an ownership period, so a car's record survives every sale while authorship stays with whoever did the work. No logbook or listing site that stores data per user can make that claim.

## Operating Context

- Owners log work in the app after it happens, often from the garage or a car park, on a phone.
- A published passport lives at `imsonder.com/p/<VIN>` and is opened by people who know nothing about Sonder — from iMessage, Instagram, Discord or a forum link, with a link preview.
- Buyers read a passport before contacting a seller; listed cars link from the For sale tab to their passport.
- Meets are coordinated by region between signed-in members.

## Capabilities and Constraints

- Garage of cars added by VIN, decoded against NHTSA vPIC.
- Build log (mods, service, repairs, milestones) with dates, odometer, cost, parts and photos; per-car gallery.
- Public passports at a shareable link, showing every owner's chapter; previous owners are named only if they published.
- Selling a car transfers it: the seller gets a transfer code, and the buyer who enters it inherits a readable, read-only history. Adding a car without the code starts a fresh log. A garage holds up to 25 cars, and a VIN someone else has claimed can be reported.
- For sale listings (price, seller-written contact line) on published passports; Meets by region; reminders by miles/months, emailed when they come due; reporting and blocking.
- Expo (SDK 57) and React Native, shipped as a web app on Vercel from `main`; the same codebase runs on iOS/Android through Expo Go. No App Store release yet — the owner will decide when.
- Supabase (Postgres, auth, storage, row-level security). Free plan: no on-the-fly image transformation.
- Region only, never a precise location, for people and meets.

## Brand Commitments

- Name: Sonder. Tagline in use: "Every car has a life of its own."
- The passport is the product's central metaphor: a car's identity page, and a history that travels with it.

## Evidence on Hand

- The owner's real published passport, a 2020 Ford Escape SE at `imsonder.com/p/1FMCU0G65LUA35573` (two ownership periods, gallery and entry photos), approved for use as the live example.
- No user counts, testimonials, press or benchmarks exist. None may be invented.

## Product Principles

- The car is the subject. Every screen should make a specific car and its history the thing you look at.
- History is permanent and credited. Nothing the product does may let a record be rewritten or its authorship lost.
- Privacy by default, publicity by choice. Nothing about a person or car is public until its owner publishes it.
- Enthusiast depth, everyone's clarity. Detail like part numbers and odometer readings is welcome, but never required to understand a car's story.

## Accessibility & Inclusion

WCAG AA contrast and keyboard access on the web; visible focus everywhere; reduced motion respected.
