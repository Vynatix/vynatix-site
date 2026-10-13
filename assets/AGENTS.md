# AGENTS.md — assets/

Brand files for the Vynatix site. Static files only — no code here. See the root
[AGENTS.md](../AGENTS.md) for the project as a whole.

## Logo files

The design system's logo artwork, one solid ink per file, in the Forest inks the
site ships:

- `vynatix-wordmark-<ink>.svg` — the V mark followed by "natix"
- `vynatix-mark-<ink>.svg` — the V mark alone

Inks: `forest` (Cream and light surfaces), `cream` (reversed, on Forest and the
dark canvas), `bronze` (print foil only, never small; 3.8:1 on Cream).

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
