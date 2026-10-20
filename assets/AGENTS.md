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

`bg-sheet-art.svg`, `bg-sheet-edge.svg`, `bg-dial-a.svg` and `bg-dial-b.svg` are
alpha-only masks for two of the four home hero backgrounds (the sheet's A-frame, arcs
and grid, and its bronze edge; the dial's two gratings of scale marks). `styles.css`
uses each as a CSS `mask-image` over a role-token colour, so one file recolours itself in
all six themes; the dial's strokes are `#000` and the sheet's use `currentColor` and
gradients, because only alpha counts in a mask, which is why none of them is a colour in
the sense the root rules ban. They are requested only when their
background is drawn (the sheet from 75rem, the dial from 1200px), and the weave and the
iris have no file here at all (the weave's tile is generated in `app.js`, the iris is
inline SVG in `index.html`).

**Do not edit them by hand; regenerate them, and give the new files new names.** Assets are
cached under fixed URLs and are not version-stamped (only `tokens.css`,
`colors_and_type.css`, `styles.css` and `app.js` are), so a changed file under an old name
would reach a visitor beside a stylesheet written for the old one, or the reverse. Rename,
change the `url()` in the block of `styles.css` and delete the old file.

- Sheet: `node tools/sheet-art.js` writes both files (plain Node; with its defaults it
  reproduces the shipped pair byte for byte). Override fields as JSON in `ART` to retune,
  and change the numbers the script's header names in `styles.css` and
  `tools/verify/bg-sheet.js`.
- Dial: `python3 tools/dial-masks.py` writes both files (standard library; same, it
  reproduces the shipped pair) and prints the box, the circle's centre and the gain. The
  radius, the box and the centre live in three places that must change together: the
  script's output, the dial block of `styles.css` (`--dial-w`, `height`, `--dial-ox`,
  `--dial-oy`) and `BEZEL` (with `BOX_W`, `BOX_H`, `OVERHANG`) in `app.js` and in
  `tools/verify/bg-dial.js`.

Then run `npm run check:bg` in `tools/`: the guards measure the art against the text and
fail if it has moved into it. The art is fitted to the current headline copy; see the
root [AGENTS.md](../AGENTS.md), *Hero backgrounds*.

## Photography

`case-volvo-trucks`, `case-volvo-cars` and `case-regulated-ai` are the three
case covers on the home page, self-hosted rather than hotlinked so no visitor IP
is disclosed to a third party. Each ships as a `.jpg` plus a `.webp` sibling
encoded from it; `index.html` offers the WebP first through `<picture>` and
keeps the JPEG as the fallback. **Replace both files together** — a stale
`.webp` will be served in preference to a fresh `.jpg`. They are shown in full
colour with no filter, tint or overlay, as the system's photography rules
require for case-study imagery.

Sources and the outstanding photographer attribution are in `CREDITS.md`
(excluded from the published site, like this file).

## App icons

`icon-192.png` and `icon-512.png` are referenced by `/site.webmanifest`: the
Cream V mark on a Forest field. `/favicon.ico` (Forest mark on transparent,
16/32/48), `/favicon.svg` (theme-aware) and `/apple-touch-icon.png` sit at the
repo root. All were rendered offline from the mark files through Chromium. If
the mark or the direction changes, regenerate all five — nothing rebuilds them
automatically.
