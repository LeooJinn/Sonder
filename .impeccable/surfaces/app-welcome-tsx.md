---
version: 1
slug: "app-welcome-tsx"
primary_target: "app/welcome.tsx"
related_targets: []
---

# Front page (/welcome)

Scope: the public front page a signed-out visitor lands on. Mode: Persuade.
Audience: enthusiasts first, everyone welcome; used-car buyers arriving to look a car up.
Action: start a passport (primary); look up a VIN (secondary); sign in (quiet).
Proof: the owner's real published 2020 Ford Escape SE passport, loaded live. Story mileages and entries are examples and are labelled as such.
Constraints: inherit the app's world (lib/theme.ts); React Native Web; reduced motion respected; no invented users, counts or testimonials.

## Direction contract

THESIS: A car's life told on its own clock. The owner changes; the odometer doesn't. Refuses the category default of a feature grid under a phone mockup.

OWN-WORLD: Passport-cover green ground, paper data pages in ink, foil for the wordmark and the one primary action. B612 Mono odometer drums in ink on a paper instrument band, the last drum in foil. Barlow Condensed display, Barlow body, kind-coloured stamp inks.

STORY: The visitor learns that Sonder keeps a car's history with the car, sees it survive a sale, looks at a real passport, then starts one or looks a VIN up.

FIRST VIEWPORT: Top bar: foil wordmark left, Sign in right. Headline "Every car has a life of its own." at display scale, one lead sentence, then Start a passport (foil) and a VIN field with Look it up. Directly beneath, a full-width paper instrument band: six odometer drums at display scale reading 000012, captioned with the current life event. The band sticks to the top on scroll.

FORM: The odometer, position 7 of 7 on the ranked list, seed key acd9c1f3 (roll output reproduced from the key in app-welcome-tsx.roll.txt). Signature interaction: scrolling rolls the drums continuously between each life event's mileage; at the sale the owner line changes and the drums keep counting.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
