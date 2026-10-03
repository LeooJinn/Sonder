---
name: Sonder
description: A car's history kept with the car, printed like the passport it travels on.
colors:
  background: "#16302A"
  surface: "#1E3B34"
  border: "#31514A"
  text: "#E8EDE5"
  text-muted: "#A7B9B1"
  text-faint: "#8DA69D"
  disabled: "#3C5A53"
  accent: "#D4B46E"
  on-accent: "#16302A"
  paper: "#E3E9DF"
  paper-shade: "#D5DDD0"
  paper-line: "#BFCBBB"
  paper-field: "#F3F6F1"
  ink: "#14201C"
  ink-muted: "#526159"
  stamp: "#A8322C"
  stamp-wash: "#F4D9D5"
  stamp-ink: "#8E2A24"
  danger: "#F0706A"
  success: "#9CD3A4"
  scrim: "#0A1512D9"
  scrim-light: "#0A1512B3"
  scrim-photo: "#0A1512F2"
  kind-mod: "#F2A65A"
  kind-service: "#8EC5EB"
  kind-repair: "#EF7F7A"
  kind-milestone: "#BCA9F4"
typography:
  poster:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "84px"
    fontWeight: 700
    lineHeight: "80px"
    letterSpacing: "-1.2px"
  hero:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: "54px"
    letterSpacing: "-0.5px"
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: "38px"
    letterSpacing: "-0.3px"
  title:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "30px"
  heading:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "26px"
  item:
    fontFamily: "Barlow, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  lead:
    fontFamily: "Barlow, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "26px"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  body-strong:
    fontFamily: "Barlow, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  compact:
    fontFamily: "Barlow, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  small:
    fontFamily: "Barlow, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Barlow, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "18px"
  caption:
    fontFamily: "Barlow, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  mono:
    fontFamily: "B612 Mono, monospace"
    fontSize: "15px"
    fontWeight: 400
    letterSpacing: "0.5px"
rounded:
  page: "14px"
  control: "10px"
  input: "8px"
  photo: "6px"
  tag: "4px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    height: "52px"
    padding: "0 20px"
  button-primary-disabled:
    backgroundColor: "{colors.disabled}"
    textColor: "{colors.text-faint}"
    rounded: "{rounded.control}"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    height: "52px"
    padding: "0 20px"
  button-quiet:
    textColor: "{colors.accent}"
    height: "44px"
    padding: "0 8px"
  button-subtle:
    textColor: "{colors.text-muted}"
    height: "44px"
    padding: "0 8px"
  button-danger:
    backgroundColor: "{colors.background}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    height: "52px"
    padding: "0 20px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    padding: "13px 14px"
  input-field-mono:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.mono}"
    rounded: "{rounded.input}"
    padding: "13px 14px"
  data-page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.page}"
    padding: "18px 20px 20px"
  data-page-mrz:
    backgroundColor: "{colors.paper-shade}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.mono}"
    padding: "14px 20px"
  odometer-drum:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.mono}"
    rounded: "{rounded.tag}"
  odometer-drum-last:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.tag}"
  tab:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-faint}"
    height: "48px"
  tab-selected:
    textColor: "{colors.text}"
  dialog:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.page}"
    padding: "22px"
    width: "440px"
---

# Design System: Sonder

## Overview

**Creative North Star: "The Car's Own Papers"**

Sonder looks like the documents a car accumulates over its life. Every screen is the passport cover: a deep, tinted green that paints edge to edge. Anything that is about one specific car is printed on a pale security-paper page in dark ink, so it reads as a document rather than a card. Gold foil is reserved for the wordmark and for the way on: the one primary action, keyboard focus, and the place you currently are. The odometer, the machine-readable strip and the rubber stamp are the world's own devices, borrowed from real passports and real instrument clusters rather than from a UI kit.

The system is flat and quiet. Depth comes from the contrast between cover and paper and from clipping (an odometer drum's digits disappear at the edge of its window), never from shadows. Type is drawn from California plates and highway signage: Barlow Condensed carries car names and headings the way a badge would, Barlow carries reading, and B612 Mono, made for cockpit displays, is kept strictly for machine data. Navigation is a drawn pictogram over a word. Every mark in the app (the five tab icons, close, tick) is drawn as strokes in one weight rather than typed as glyphs or borrowed from an icon set. Things move the way the objects they imitate move: an odometer's drums roll and catch, a rubber stamp comes down hard and stays, foil glints once as it turns. The paper is engraved, the way security paper is, so it reads as printed.

The app is a phone app first. On a desktop browser the content sits in a centred reading column while the cover still fills the window.

**Key Characteristics:**
- Passport-cover green ground; paper data pages in ink for anything about a specific car.
- Foil (gold) means the way on: wordmark, one primary action, focus, current selection.
- Flat: no shadows anywhere; depth is cover against paper.
- Drawn pictograms in one stroke weight (1.75, round ends), each with a single small motion that says what the thing is.
- Engraved paper: a fine guilloché interlace in the paper's own rule colour behind the ink, and a ghost of the cover's rosette in the corner of each tab screen.
- Motion is mechanical, never springy: it decelerates into place, and only things physically struck or swung overshoot.
- Barlow Condensed display, Barlow body, B612 Mono only for VINs, odometers, part numbers and the MRZ strip.
- Each log-entry kind stamped in its own ink so a history can be scanned by colour.
- Radii follow hierarchy: documents roundest, photos least.

## Colors

A tinted green cover, a pale green-grey paper, one gold foil, and a set of stamp inks; no pure grays and no pure black anywhere.

### Primary
- **Passport Foil** (accent): the wordmark, the primary button fill, the focus ring, the text caret and text selection, and the marker of the current choice (selected tab rule, selected chip border, checkmarks, switch track). Text on foil is always the cover green (on-accent).

### Neutral (the cover)
- **Passport Cover Green** (background): every screen's ground, the browser's html/body, and the fill behind timeline dots.
- **Cover Surface** (surface): a step lighter than the cover; inputs, segmented tabs, part rows, the pressed state of the back button, the active timeline entry.
- **Cover Rule** (border): hairline dividers, input and secondary-button strokes, the timeline rail, the scrollbar thumb.
- **Cover Text** (text): primary reading text and headings on the cover.
- **Muted Cover Text** (text-muted): lead and secondary paragraphs, field labels.
- **Faint Cover Text** (text-faint): captions, hints, placeholders, unselected tab labels. Tinted from the cover's hue and tuned to pass AA on both cover and surface.
- **Spent Foil** (disabled): the fill of a disabled primary button.
- **Cover Scrims** (scrim, scrim-light, scrim-photo): the cover darkened at three opacities, behind dialogs, sheets and the photo viewer. Never black.

### Neutral (the data page)
- **Security Paper** (paper): the ground of every document: the data page, garage and market cards, confirm dialogs, the odometer instrument band. Also the digit colour on an ink drum.
- **Paper Shade** (paper-shade): the MRZ strip along a page's foot, photo placeholders, the due-reminder tag on a card.
- **Paper Rule** (paper-line): hairlines printed on paper, borders of fields on paper.
- **Paper Field** (paper-field): an input printed on paper, a shade lighter than the page.
- **Ink** (ink): text on paper; the odometer's drum windows.
- **Faded Ink** (ink-muted): secondary text on paper: make, year, spec labels, the holder line, the MRZ characters.

### Tertiary (stamp inks)
- **Log kind inks** (kind-mod amber, kind-service sky, kind-repair coral, kind-milestone lilac): each kind of log entry is stamped in its own ink: the ring of its timeline dot, its kind label, its picker dot. Milestone lilac also marks a sale (the diamond on the rail and the rotated Sold stamp).
- **Stamp Red** (stamp, stamp-wash, stamp-ink): red that reads as red on paper. Destructive confirmations and errors inside paper dialogs; the overdue reminder tag (wash ground, stamp-ink text).
- **Danger / Success** (danger, success): status on the dark cover: field errors, the danger button, notices. Their tinted notice grounds are the same colour at low alpha.

### Named Rules
**The Foil Rule.** Foil means "this is the way on". It marks the wordmark, the one primary action on a screen, focus, and where you currently are. A stamp, a status or an ornament in foil reads as a second call to action; use a kind ink or a neutral instead.

**The Cover and Page Rule.** The cover is the app; paper is a specific car's document. Cover colours (text, text-muted, danger) belong on the green; ink colours (ink, ink-muted, stamp) belong on paper. Never set cover text on paper or ink on the cover.

**The No-Gray Rule.** Every neutral is tinted from the cover's green hue, including scrims. There is no gray and no black in the palette.

## Typography

**Display Font:** Barlow Condensed, SemiBold 600 and Bold 700 (with sans-serif)
**Body Font:** Barlow, Regular 400, Medium 500, SemiBold 600 (with sans-serif)
**Label/Mono Font:** B612 Mono, Regular 400 and Bold 700 (with monospace)

**Character:** Plate-and-signage type. The condensed cut names a car the way a badge or a window sticker does; plain Barlow reads calmly underneath; the cockpit mono is the voice of the machine.

### Hierarchy
- **Hero** (700, 56/54, -0.5 tracking): tab-screen titles (Garage, For sale, Meets) and the asking price on a listing.
- **Display** (700, 38/38, -0.3 tracking): a car's model name on its data page and cards (cards tighten it to 30–32); a meet's title.
- **Poster** (Condensed 700, 84/80, -1.2 tracking): the front page's headline at wide widths only.
- **Title** (600, 28/30): section headers, chapter titles in the timeline, dialog titles, error-state titles.
- **Heading** (600, 22/26): subsection titles in forms, the stacked-screen header title, passport footer line.
- **Item** (SemiBold 600, 18/24): list-item and log-entry titles; the tab bar sets it in Condensed.
- **Lead** (400, 17/26): the opening paragraph under a headline, empty-state bodies. Capped at 520–560px.
- **Body** (400, 16/24): reading text and input text.
- **Body Strong** (600, 16/22): button labels and emphasised values.
- **Compact** (400, 15/22): button labels, quiet and subtle links, notes on dense screens.
- **Small** (400, 14/20): secondary lines, notes, the holder line, disclosures.
- **Label** (500, 14/18): field labels above inputs.
- **Caption** (400, 12/16): hints, dates, spec labels on the data page.
- **Mono** (B612 Mono 400, 15, +0.5 tracking): VINs, the MRZ strip, odometer drums, part numbers, confirm phrases.

The ramp is a modular scale of about 1.25. Display type is always sentence case; there are no uppercase eyebrows or kickers in the system.

### Named Rules
**The Machine Data Rule.** B612 Mono is only for data a machine wrote: VINs, the MRZ strip, odometer drums, part numbers, typed confirm phrases. A mileage written in a sentence ("logged at 31,400 mi") is set in Barlow with tabular figures, because the mono's full-width comma splits "58,210" into two numbers. A placeholder is words, so it is set in Barlow even inside a mono field.

**The Badge Rule.** Barlow Condensed carries names and headings only (a car's model, screen titles, tab labels, the wordmark). Paragraphs are never condensed.

## Layout

Sonder is a phone app first. App screens lay out in a single reading column (640px max, centred, full width below that) with a 20px side gutter; the cover still paints edge to edge and only the content is constrained. The stacked-screen header and the bottom tab bar share the same column, so titles and tabs line up with content on a desktop browser. Narrow forms and dialogs (sign-in, confirm, report sheet, error state) use a 440px column.

The signed-out front page is the one exception: it lays out in a wider 1040px column (the `wideColumn` token) and switches to a two-column hero at 860px and up, where the odometer sits on its own paper panel beside the headline. Below 860px the odometer band sticks to the top of the scroll; above it, the band floats in and docks once the hero's own instrument has scrolled away.

Rhythm is set per screen rather than from a spacing scale: 8, 12, 14, 16, 20, 24 inside components; 36–56 between major sections, separated on the cover by a 1px border rule. Touch targets are at least 44px; buttons are 52px tall; tabs are 48px.

## Elevation & Depth

The system is flat. There are no shadows anywhere in the code. Depth is conveyed by tone: paper pages sit on the green cover, a surface step sits one shade above the cover, and scrims darken the cover behind a dialog. The odometer gets its depth from its window: digits are clipped at the drum's edges as they roll through, the way a real drum's numerals disappear round it.

### Named Rules
**The Flat Paper Rule.** Documents lie flat on the cover. Separation comes from paper against green, a hairline rule, or a shade step, never from a drop shadow.

## Shapes

Radii follow hierarchy rather than one value everywhere: documents are the roundest (page, 14px: data pages, cards, dialogs, the listing panel, the hero instrument), controls less so (control, 10px: buttons, kind pickers, segmented tabs), inputs less again (input, 8px: text fields, the front page's VIN lookup, notices), and photos least (photo, 6px: thumbnails, VIN cells). Small printed parts are near-square (tag, 4px: odometer drum windows, photo badges). Pressed states on round controls use the pill radius. Status dots and radio marks are full circles; a change of owner is marked by a 45-degree diamond. The Sold stamp is the one rotated shape: a 2px lilac outline tilted -4 degrees.

Close and tick marks are drawn from strokes (two crossed bars; a turned L) so their weight and baseline match the type, rather than typed as "×" or "✓".

## Components

### Buttons
The app's one button, in four variants. Tactile, plain, and never more than one foil button in view.
- **Shape:** gently rounded (control, 10px), 52px tall, 20px side padding (28px on the front page's hero and closing actions).
- **Primary:** foil fill, cover-green Barlow SemiBold 16 label. At most one in any viewport; a long page may repeat its one action at the close. Disabled: spent-foil fill with faint text.
- **Secondary:** transparent with a 1px cover-rule outline and cover text; the other reasonable choice.
- **Quiet:** inline foil text (Compact, 15px), padded to a 44px hit area but laid out like plain text. Only for links that take you forward: Sign in, Post a meet, Add photos, Manage, and text links such as "Read its passport".
- **Subtle:** the same inline shape in muted text, for every inline action that is not a way on: Cancel, Remove, Back, Show/Hide, Unblock, Report, Block, I can't make it.
- **Danger:** a thin danger-red outline and danger text. Never the most prominent thing on a screen.
- **Pressed / Focus:** pressed drops opacity to 0.75 and gives under the thumb (scale 0.98) on the filled variants. The primary button's foil catches the light once, a soft diagonal glint that crosses it on hover and when a screen's one primary action first appears; it never loops. Keyboard focus draws a 2px solid foil outline offset 2px (web only). Busy shows a spinner in the label's colour.

### Chips (kind picker and choice rows)
- **Style:** 1px cover-rule outline, control radius, 44–48px tall, Barlow Medium 15 in muted text. Kind chips carry a 12px ring in the kind's ink.
- **State:** selected turns the border foil, the fill surface, and the label to SemiBold cover text; a drawn foil tick may confirm the choice.

### Cards / Containers
- **Corner Style:** page radius (14px), clipped so photos run to the edge.
- **Background:** security paper; photo placeholders in paper shade.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none; the paper against the cover is the edge.
- **Internal Padding:** 18–20px sides. A car's model is set in Display ink; make, year, trim and dates in faded ink; the VIN in mono. A due reminder is a paper-shade tag along the card's foot, turning stamp-wash with stamp-ink text when overdue.

### Inputs / Fields
- **Style:** cover-surface fill, 1px cover-rule stroke, input radius (8px), 13/14px padding, Body text. Label above in Label muted text; hint or error below in Caption.
- **Focus:** the stroke turns foil; the browser's own outline is suppressed so there is only one ring. The caret is foil.
- **Error / Disabled:** the stroke turns danger and the hint line is replaced by the error in danger.
- **Mono variant:** VINs and part numbers switch to B612 Mono 15 with +0.5 tracking.
- **On paper:** inside a paper dialog, fields use paper-field with a paper-line stroke and ink text; active stroke is ink.
- **VIN entry:** seventeen 48px cells in three groups (maker, description, serial), each cell photo-radius on surface; the cursor cell's border is foil.

### Navigation
- **Tab bar:** five tabs (Garage, Following, For sale, Meets, Messages), each a 26px drawn pictogram over its name in Barlow Condensed (14px). Unselected is faint; the selected tab turns foil and its icon plays its motion once: the car draws and rolls in, the signal radiates from its dot, the price tag swings on its hole, the pin drops and ripples, the reply types. One 28×2px foil rule travels between tabs rather than vanishing from one and appearing on the next. Messages carries its unread count as a small danger-red badge; Following carries a dot, because news is not a to-do. Cover ground with a 1px top rule, sharing the 640px column. Pressing a tab squeezes it to 0.9.
- **Stacked header:** 56px, in the column; a drawn chevron back button (44px, pill-pressed state on surface) and the screen title in Barlow Condensed 22. With no history it reads "Garage" and goes home.

### Data Page (signature)
A car's identity page, used for the add preview, the vehicle screen, the public passport and the front page's proof. Paper, page radius, clipped: a 3:2 photo, then make and year (mono) in faded ink, the model in Display ink, trim, a paper-line rule, a two-column spec grid (VIN in grouped mono, full width), the holder line, and along the foot the machine-readable strip: two lines of B612 Mono on paper shade, filled with "<" and sized to fill the page's width exactly.

### Odometer (signature)
A row of mechanical drums in B612 Mono: ink windows with paper digits, 4px gap, 4px radius, the last (ones) drum in foil with ink digits. Drums roll like a real odometer: only the ones drum turns continuously, and each other drum turns only while the one to its right rolls 9 to 0. On the front page it sits on a paper instrument band captioned with the owner line ("miles, first owner") in Barlow SemiBold and the current life event in Barlow Condensed; scrolling drives the reading. Under reduced motion the reading steps between mileages instead of rolling.

### Timeline and stamps (signature)
A 1px cover-rule rail with a ring for each entry, the ring stroked in the entry kind's ink over the cover. The kind label above an entry is SemiBold in its kind's ink; mileages sit in a column of Barlow tabular figures. A change of hands (the start of an owner's chapter) is marked on the rail by a 12px diamond in milestone lilac, in the app and on the front page alike; on the front page it is also stamped: "Sold" in Barlow Condensed with the mileage beneath, in a 2px milestone-lilac outline turned -4 degrees.

### Dialogs
A paper page (page radius, 22px padding, 440px max) over the cover scrim. Title in ink, body in faded ink. Destructive consequences are listed against a 2px stamp-red rule; the confirm button is a stamp-red outline, the cancel button a solid ink fill with paper text.


### Stamp
A rubber stamp: a 3px outer rule and a 1px inner rule in one ink, the label set in Barlow Condensed Bold with wide tracking (30px, or 22px compact) and a small line of B612 Mono beneath, tilted a few degrees. It is a milestone mark, not a status badge.

### Parking bay
The "Add a car" action at the end of the garage: a 2px dashed outline in the cover rule colour, the size of a card, a foil plus on the left and "Bay N / Add a car" beside it. The outline turns foil and the plus turns a quarter on hover or focus. It reads as a place you are about to park something, not as a button.

### Monogram seal
A person is shown as a round of paper with their initials in Barlow Condensed Bold ink, inside a 1px paper-rule ring. Everything about a person on Sonder is drawn from words, so there is no photo to fall back on.

### Logo mark
A foil Barlow Condensed S on a cover-green tile, over the cover's own engraved rosette: the app icon at small size (`components/LogoMark.tsx`). It appears beside the wordmark on the front page and above it on the sign-in cover, and nowhere else: foil means the wordmark, and the mark is part of the wordmark. It is flat (a hairline cover-rule border, no shadow), takes the control radius, or the page radius from 56px up, and is hidden from screen readers because the word "Sonder" always sits next to it. The same S is the app icon, the browser-tab icon (a plainer version without the rosette, which turns to mush at 16px), the home-screen icon (`public/apple-touch-icon.png`) and the link-preview card (`public/og-image.png`).

## Motion

Motion in Sonder is modelled on the two kinds of object the app imitates: instruments and paperwork. Instruments move mechanically: a drum rolls and catches in its detent. Paperwork is acted on: a stamp comes down, a page is dealt onto the desk. Neither wobbles, so the curve is a confident ease-out (a long settle), 140ms for feedback, 240ms for state, 420-720ms for arrivals and the one authored moment on a surface.

### Signature moments
- **The odometer on a garage card.** The car's last logged mileage rolls up from zero on a small odometer when the card arrives, behind its entrance, using the same drums as the front page. The ones drum turns continuously and each other drum only while the one to its right carries.
- **The stamp.** "ENTERED" comes down on a car's data page when it is added to the garage, a large, faint, tilted impression that drops to size, rings once on impact and stays; the app holds a beat and then moves to the new car. "ISSUED" stamps the passport panel when a car is made public. Stamps are for milestones only. On paper the ink is stamp red; on the cover it is the sky ink, because red ink is dark on green.
- **The tab icons.** Each plays one motion when its tab becomes current.
- **The empty garage** draws a car in one line, then turns its wheels once as it comes to rest.

### Supporting motion
- **Arrival.** Lists deal in: a short rise and fade, each item a little after the last, capped at six so a long list never makes anyone wait for its tail. Only on first mount.
- **Lift.** On a pointer, a card rises 3-4px; a garage card's photo also leans in. Under a thumb a card gives (0.985). No shadow appears, so the movement alone says it is alive.
- **Loading** is a page-shaped placeholder (photo, name, a small line) with a light passing across, so the layout does not jump when the real thing arrives. It is the only motion that loops, and it stops when loading does.
- **New messages** in an open conversation come in with the same short rise; the history you opened to does not.

### Named Rules
**The Reduced Motion Rule.** Every animation reads the device's reduced-motion setting. When it is on, travel, drawing and sweeping land in their final state at once; colour and state changes remain.

**The Detent Rule.** Nothing overshoots unless it is physically struck or swung (a stamp, a hanging tag). A drum catches; it does not bounce.

## Engraved Paper

Anything printed on paper carries a faint guilloché: two interlaced families of fine sine waves in the paper's own rule colour at about a third strength, behind the ink, filling the body of the data page and each garage card. It is what makes paper look printed rather than flat, and it never competes with the ink on top. The cover carries the matching ghost: thirty-six thin ellipses turned about one point, in the cover's rule colour, off the top corner of each tab screen. Neither adds depth; the system stays flat.

## Do's and Don'ts

### Do:
- **Do** paint every screen on the cover green and put anything about a specific car on paper in ink.
- **Do** keep foil for the wordmark, one primary button per viewport, the focus ring, the current selection, and quiet links that go forward. Statuses, stamps, markers, borders and non-forward inline actions never take foil.
- **Do** draw keyboard focus as a 2px foil outline offset 2px on every pressable element on the web.
- **Do** set VINs, drums, part numbers and the MRZ strip in B612 Mono, and prose mileages in Barlow tabular figures.
- **Do** stamp each log entry in its kind's ink (mod amber, service sky, repair coral, milestone lilac).
- **Do** follow the radius hierarchy: page 14, control 10, input 8, photo 6, tag 4. Circles and pills are shapes, not steps.
- **Do** set every size from the type ramp, including Compact (15) and Item (18); the front page's headline alone uses Poster (84).
- **Do** use the red that fits the ground: danger on the cover, stamp on paper.
- **Do** darken the cover for scrims; respect reduced motion by stepping instead of rolling.

### Don't:
- **Don't** put a stamp, status or ornament in foil; it reads as a second call to action.
- **Don't** add drop shadows; separate with paper, a hairline or a shade step.
- **Don't** introduce gray or black; every neutral is tinted from the cover green.
- **Don't** type "×"/"✓" glyphs, use an emoji, or borrow an icon from a set; draw marks in the house stroke (1.75, round caps and joins, on a 24-unit grid) and pair every navigation icon with its word.
- **Don't** add spring or bounce motion by reflex, loop anything that is not loading, or animate without a reduced-motion path. Reduced motion lands every animation in its final state at once; colour and state changes stay.
- **Don't** set paragraphs in Barlow Condensed, or prose numbers in the mono.
- **Don't** put cover text colours on paper or ink colours on the cover.
