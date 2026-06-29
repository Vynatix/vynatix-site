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
