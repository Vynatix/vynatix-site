# AGENTS.md — assets/

Brand SVGs for the Vynatix site. Static files only — no code here. See the root
[AGENTS.md](../AGENTS.md) for the project as a whole.

## Files

Two logo lockups, each in four colour variants:

- `wordmark-<variant>.svg` — full "Vynatix" wordmark (used in header & footer)
- `logo-mark-<variant>.svg` — the mark/glyph alone

Variants: `teal`, `ink`, `cloud`, `champagne` — matching the design-system
palette in `../colors_and_type.css`.

## Choosing a variant

Pick the variant that reads against its background, not by preference:

- On **light** surfaces (e.g. the header, light theme) use `teal` or `ink`.
- On **dark** surfaces (e.g. the footer, dark theme) use `cloud`.
- `champagne` is the reserved accent — use sparingly, in line with the
  "guest, not resident" rule for champagne in the design system.

Current usage: header → `wordmark-teal.svg`, footer → `wordmark-cloud.svg`,
on every page.

## When editing

- Keep all four colour variants of a lockup in sync — if the artwork changes,
  regenerate every variant so they stay identical apart from colour.
- `<img>` tags reference these with explicit `width`/`height`; preserve the
  SVG's aspect ratio so those stay correct.

## Photography

`case-volvo-trucks`, `case-volvo-cars` and `case-regulated-ai` are the three
homepage case covers, self-hosted rather than hotlinked so no visitor IP is
disclosed to a third party. Each ships as a `.jpg` plus a `.webp` sibling
encoded from it; `index.html` offers the WebP first through `<picture>` and
keeps the JPEG as the fallback. **Replace both files together** — a stale
`.webp` will be served in preference to a fresh `.jpg`.

Sources and the outstanding photographer attribution are in `CREDITS.md`
(excluded from the published site, like this file).

## App icons

`icon-192.png` and `icon-512.png` are referenced by `/site.webmanifest`. They
were rendered offline from the logo mark through Chromium, as were `/favicon.svg`,
`/favicon.ico` and `/apple-touch-icon.png` at the repo root. If the mark changes,
regenerate all five — nothing rebuilds them automatically.
