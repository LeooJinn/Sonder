/**
 * Shared design tokens. Every colour and typeface in the app comes from here
 * so that changing the look is a one-file edit rather than a search-and-replace.
 *
 * The look borrows from the documents a car actually accumulates. Screens are
 * the passport cover, a deep green. A vehicle's identity is printed on a pale
 * security-paper page in dark ink. Gold foil is kept for the wordmark and the
 * one primary action on a screen, so it always means "this is the way on".
 */

import type { EntryKind } from './log';

export const colors = {
  // The cover: every screen's ground.
  background: '#16302A',
  surface: '#1E3B34',
  border: '#31514A',
  text: '#E8EDE5',
  textMuted: '#A7B9B1',
  // Tinted from the cover's hue, never gray. 5.4:1 on the cover and 4.7:1 on
  // surfaces, so captions and placeholders pass AA wherever they sit.
  textFaint: '#8DA69D',
  disabled: '#3C5A53',

  // Foil. Wordmark, primary buttons, focus.
  accent: '#D4B46E',
  onAccent: '#16302A',

  // The data page.
  paper: '#E3E9DF',
  paperShade: '#D5DDD0',
  paperLine: '#BFCBBB',
  ink: '#14201C',
  inkMuted: '#526159',
  // Inputs printed on paper: a shade lighter than the page.
  paperField: '#F3F6F1',
  // Red that reads as red on paper; `danger` is tuned for the dark cover.
  stamp: '#A8322C',
  stampWash: '#F4D9D5',
  stampInk: '#8E2A24',

  danger: '#F0706A',
  dangerLine: '#F0706A66',
  dangerWash: '#F0706A14',
  success: '#9CD3A4',
  successLine: '#9CD3A455',
  successWash: '#9CD3A412',

  // What sits behind a dialog or sheet: the cover, darkened, not black.
  scrim: '#0A1512D9',
  scrimLight: '#0A1512B3',
  scrimPhoto: '#0A1512F2',
} as const;

/**
 * Each kind of log entry is stamped in its own ink so a long history can be
 * scanned by colour before it's read.
 */
export const KIND_COLORS: Record<EntryKind, string> = {
  mod: '#F2A65A',
  service: '#8EC5EB',
  repair: '#EF7F7A',
  milestone: '#BCA9F4',
};

/**
 * Barlow is drawn from California plates and highway signage; the condensed
 * cut carries car names the way a badge or a window sticker would. B612 Mono
 * was made for cockpit displays and is used only for machine data: VINs,
 * odometer readings, part numbers.
 */
export const fonts = {
  display: 'BarlowCondensed_600SemiBold',
  displayBold: 'BarlowCondensed_700Bold',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemi: 'Barlow_600SemiBold',
  mono: 'B612Mono_400Regular',
  monoBold: 'B612Mono_700Bold',
} as const;

export const mono = fonts.mono;

/** A modular scale (about 1.25), so sizes relate to each other. */
export const type = {
  // The front page's headline at wide widths; nothing in the app goes this big.
  poster: { fontFamily: fonts.displayBold, fontSize: 84, lineHeight: 80, letterSpacing: -1.2 },
  hero: { fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 54, letterSpacing: -0.5 },
  display: { fontFamily: fonts.displayBold, fontSize: 38, lineHeight: 38, letterSpacing: -0.3 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30 },
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  // List-item titles and tab labels: a step between lead and heading.
  item: { fontFamily: fonts.bodySemi, fontSize: 18, lineHeight: 24 },
  lead: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  // Between small and body: button labels, secondary copy on dense screens.
  compact: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
} as const;

/**
 * Radii follow hierarchy rather than one value everywhere: documents are the
 * roundest, controls less so, photos least.
 */
export const radius = { page: 14, control: 10, input: 8, photo: 6, tag: 4, pill: 999 } as const;

/**
 * The reading column.
 *
 * Sonder is a phone app; on a desktop browser a full-width column stretches
 * every line across the monitor. Applied to each screen's content container
 * rather than to the screen itself, so the background still paints edge to
 * edge and only the content is constrained.
 */
export const column = {
  width: '100%',
  maxWidth: 640,
  alignSelf: 'center',
} as const;

/**
 * The front page's wider column: persuasion wants two columns on a desktop,
 * where the app itself stays a single reading column.
 */
export const wideColumn = {
  width: '100%',
  maxWidth: 1040,
  alignSelf: 'center',
  paddingHorizontal: 20,
} as const;
