# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Building UI in Sonder

New screens and features must look like the rest of the app. Extend the design, don't redo it.
Read first: `DESIGN.md` (the rules and their reasons), `PRODUCT.md` (who it's for), `lib/theme.ts`
(colours, type, radii), `lib/motion.ts` (how things move).

## Reuse these, by name

- **Ground.** Every screen sits on the cover (`colors.background`). A tab screen has the big
  Condensed title in a `<Reveal rise={8}>` header, a `<CoverTexture />`, and the 640px `column`.
- **Paper.** Anything about a specific car, or a record someone made, is printed on paper
  (`colors.paper`, ink text, page radius) and carries a `<Guilloche>`. Cover colours never go on
  paper and ink colours never go on the cover.
- **Buttons.** Only `Button` from `components/ui.tsx`. One foil (primary) per screen, and give that
  one `glint`. Foil is only for the wordmark, the one primary action, focus and the current selection.
- **Lists.** Rows go in `<Reveal index={i}>`. Loading is `SkeletonCard` or `SkeletonRow`, never a
  spinner in the middle of content. Empty states teach the next step.
- **Pressable cards:** `LiftPressable`. **People:** `Monogram`. **Mileage:** `Odometer`.
  **Milestones:** `Stamp`, rarely (a car entered, a passport issued).
- **Icons.** No icon set, emoji or typed glyphs. Draw new ones in the style of `components/TabIcon.tsx`:
  24-unit grid, stroke 1.75, round caps and joins, one small motion, always beside a word.
- **Motion.** Only through `lib/motion.ts` (`ease`, `duration`, `useReducedMotion`). Mechanical, not
  springy; nothing loops except loading; every animation has a reduced-motion path that lands in the
  final state. SVG transforms use `lib/svgTransform.ts` strings, never `origin`/`rotation` props
  (they break on the web).
- **No** shadows, gray, black, or new colours, fonts or radii without asking. Sizes come from the type ramp.

## Before calling UI work done

1. `npx tsc --noEmit` is clean.
2. Look at it in a browser at 390px and at 1280px, and with reduced motion on.
3. If the impeccable skill is installed, run `impeccable detect --json <changed files>`.
4. If a rule really has to change, change `DESIGN.md` in the same commit and say why.
