# AGENTS.md — assets/

Brand files for the Vynatix site. Static files only — no code here. See the root
[AGENTS.md](../AGENTS.md) for the project as a whole.

## Logo files

The design system's logo artwork, one solid ink per file, in the Forest inks the
site ships:

- `vynatix-wordmark-<ink>.svg` — the V mark followed by "natix"
- `vynatix-mark-<ink>.svg` — the V mark alone

Inks: `forest` (Cream and light surfaces), `cream` (reversed, on Forest and the
dark canvas), `bronze` (print foil only, never small; 3.9:1 on Cream).

**The pages do not use these files.** Every page inlines the wordmark once as a
`<symbol id="vx-wordmark">` filled with `currentColor` and places it with `<use>`
in the header and the footer, so the logo takes a role colour and follows the
theme. Use the files where inline SVG cannot go (email, documents), and to
regenerate the icons below. The other inks (teal, ink, cloud, champagne,
charcoal, paper) live in the design system; copy them in if the site moves to
that direction. Never redraw, retype, recolour beyond the inks, or box the logo.

## Icons

`icons/` holds the Material Symbols Outlined glyphs the pages inline (weight 300,
`viewBox="0 -960 960 960"`, `fill="currentColor"`), copied from the design
system's `assets/Icons/`, with the Apache 2.0 licence text. To add one, copy it
from the system (or `@material-symbols/svg-300@0.47.5`, `outlined/`) rather than
drawing it. `dark_mode.svg` and `light_mode.svg` are not yet in the system's
approved catalogue.

## Hero background masks

`bg-sheet-art.svg` and `bg-sheet-edge.svg` are alpha-only masks for the home hero's
background, the drafting sheet (its A-frame, arcs and grid, and its bronze edge).
`hero-bg.css` uses each as a CSS `mask-image` over a role-token colour, so one file
recolours itself in every theme; they use `currentColor` and gradients, because only
alpha counts in a mask, which is why neither is a colour in the sense the root rules ban.
They are requested only from 75rem up, on the home page.

**Do not edit them by hand; regenerate them, and give the new files new names.** Assets are
cached under fixed URLs and are not version-stamped (only `tokens.css`,
`colors_and_type.css`, `styles.css`, `app.js` and `hero-bg.css` are), so a changed file under an old name
would reach a visitor beside a stylesheet written for the old one, or the reverse. Rename,
change the `url()` in `hero-bg.css` and delete the old file.

`node tools/sheet-art.js` writes both files (plain Node; with its defaults it
reproduces the shipped pair byte for byte). Override fields as JSON in `ART` to retune,
and change the numbers the script's header names in `hero-bg.css` and
`tools/verify/bg-sheet.js`.

Then run `npm run check:bg` in `tools/`: the guard measures the art against the text and
fails if it has moved into it. The art is fitted to the current headline copy; see the
root [AGENTS.md](../AGENTS.md), *Hero background*.

## Stage masks

`stage-1.svg` to `stage-4.svg` and `stage-edge.svg` are the hero's A-frame at four build stages
(set out, joined, dimensioned, sectioned) and the bronze layer of the last. `styles.css` uses
them as masks over role colours in the home page's Partnership band, four frames side by side on
one datum line. `node tools/sheet-art.js` writes them after the two hero masks, from the same
constants. The same rules apply: never edit one by hand, and a retuned file takes a new name.

## Generated pictures

The English home page carries four generated still lifes, each in a daylight and a night
version (`-dark`): `services-drafting-sheet` (one wide picture, sliced across the three service
columns) and the case covers `case-ai-bound-documents`, `case-cars-stopwatch` and
`case-trucks-radio-dial`. They are WebP only and are set as CSS backgrounds, because
`light-dark()` in `styles.css` chooses the version from the page's colour scheme. **A picture
always ships as a pair**: make the night version by editing the daylight one, so the objects and
the framing match, and name both in the "Two sets of pictures" block. They illustrate the work
and show no client system; the line under the case cards says they are generated. How they were
made is in `CREDITS.md`. Replace one under a new name, as with every asset.

## Photography

The Swedish hub (`sv.html`) carries three photographs, self-hosted rather than hotlinked so no
visitor IP is disclosed to a third party: the three case covers
(`case-trucks-forest-road`, `case-ai-archive-volumes`,
`case-cars-marshalling-yard`). Each ships as a 1200px `.jpg` plus a `.webp` sibling; `sv.html`
offers the WebP first through `<picture>` and keeps the JPEG as the fallback.
**Replace both files together, under a new name** — a stale `.webp` will be served
in preference to a fresh `.jpg`, and images are not version-stamped, so a changed
picture under an old name reaches returning visitors late or never. They are shown
in full colour with no filter, tint or overlay, as the system's photography rules
require for case-study imagery, and no text is set on top of one.

They are stock photographs that illustrate the work; none shows a client system.
The page says so (the line under the case cards), and a new
photograph keeps to that: a caption or alt text says what the camera saw, never
that it is the client's product. Check a candidate at full size for third-party
names, badges and number plates before it ships (the truck photograph was
retouched for that reason; see `CREDITS.md`).

Sources, photographers and what was changed are in `CREDITS.md` (excluded from the
published site, like this file).

## App icons

`icon-192.png` and `icon-512.png` are referenced by `/site.webmanifest`: the
Cream V mark on a Forest field. `/favicon.ico` (Forest mark on transparent,
16/32/48), `/favicon.svg` (theme-aware) and `/apple-touch-icon.png` sit at the
repo root. All were rendered offline from the mark files through Chromium. If
the mark or the direction changes, regenerate all five — nothing rebuilds them
automatically.
