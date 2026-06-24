# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

The marketing website for **Vynatix** — a premium Nordic IT consultancy
(a division of Ultra Group, Gothenburg). It is a **single-page static
site**: hand-written HTML, CSS, and a small amount of vanilla JavaScript.
There is **no build step, no framework, no package manager, and no
dependencies**. What is in the repo is exactly what ships.

The site is served by **GitHub Pages** from the repository root on the
`main` branch. The custom domain `vynatix.com` is set via the `CNAME`
file — do not delete or rename it.

## Layout

```
index.html            Entire page markup (single page, hash-anchored sections)
colors_and_type.css   Design system: CSS custom properties (tokens) + type roles
styles.css            Page chrome and components built on top of the tokens
app.js                Vanilla JS: theme toggle + case-reel carousel controls
assets/               Brand SVGs (wordmarks + logo marks, four color variants)
CNAME                 Custom domain for GitHub Pages (vynatix.com)
.gitignore            OS/editor cruft only
```

There is intentionally no `package.json`, `node_modules`, bundler config,
or CI/build directory. Do not introduce a toolchain unless explicitly asked.

## Architecture & conventions

### Two-layer CSS

1. **`colors_and_type.css` — the design system.** Defines all primitive
   and semantic tokens as CSS custom properties on `:root` (light theme)
   and `[data-theme="dark"]` (dark theme), plus semantic type-role
   classes (`.display-*`, `.headline-*`, `.body-*`, `.label-*`, etc.).
   This is the source of truth for color, typography, spacing, radii,
   elevation, and motion.
2. **`styles.css` — page chrome and components.** Consumes the tokens via
   `var(--token)`. Never hard-codes a color, size, or duration that a
   token already exists for.

**Always reach for an existing token** (e.g. `var(--primary)`,
`var(--sp-16)`, `var(--radius-lg)`, `var(--d-short)`) instead of a raw
value. If a needed value has no token, prefer adding one to
`colors_and_type.css` over hard-coding.

### Theming

- Light is the default (`<html data-theme="light">`); dark is
  `[data-theme="dark"]`.
- Theme is toggled in `app.js`, persisted to `localStorage` under
  `vynatix-theme`, and falls back to the OS `prefers-color-scheme`.
- The two themes are kept in sync by overriding the **same semantic
  tokens** — write component CSS against semantic tokens (`--fg-1`,
  `--surface-1`, `--primary`) so both themes work for free. Only add a
  `[data-theme="dark"] .selector { ... }` override for genuinely
  theme-specific tweaks (a few exist, e.g. focus-ring contrast).

### Naming

- CSS uses **BEM**: `.block`, `.block__element`, `.block--modifier`
  (e.g. `.site-header__link`, `.reel__card`, `.section--ink`).
- Sections within `styles.css` are separated by banner comments
  (`/* ----- */`); keep new component styles grouped under a labeled
  banner in the same style.

### HTML

- One file, semantic landmarks (`<header>`, `<main>`, `<footer>`), and
  in-page navigation via `#hash` anchors (`#home`, `#services`, `#work`,
  `#about`, `#contact`). Sticky-header scroll offset is handled in CSS.
- **Accessibility is a first-class requirement** (the site advertises
  WCAG 2.2 AA). Preserve `aria-*` attributes, `alt` text, `role`s, and
  `:focus-visible` rings. Decorative elements use `aria-hidden="true"`.
- Images: the first hero image uses `fetchpriority="high"`; below-the-fold
  images use `loading="lazy" decoding="async"`. Match this pattern.
- Some inline `style="..."` attributes exist for one-off layout; prefer a
  class in `styles.css` for anything reusable.

### JavaScript

- `app.js` is plain ES5-ish vanilla JS wrapped in IIFEs, no dependencies,
  loaded with `defer`. Two independent modules: theme toggle and the
  case-reel carousel. Keep it dependency-free and progressive-enhancement
  friendly (the page must work if JS fails).
- Note: `styles.css` contains styles for more components (forms, values
  grid, menu popover, etc.) than `index.html` currently renders — it's a
  small component library. Reuse those before authoring new CSS.

### Brand

- Fonts are loaded via `<link>` in the `<head>` (Google Fonts: Instrument
  Serif for display, Geist + Geist Mono for body/mono) — not `@import`.
- Display/editorial type is **Instrument Serif**; body/UI is **Geist**.
- Palette is "Transformative Teal": deep teal primary, Cloud Dancer
  surfaces, champagne reserved strictly as a <1% accent (and the focus
  ring). Do not introduce new brand colors.
- Brand SVGs in `assets/` come in four color variants: `teal`, `ink`,
  `cloud`, `champagne`. Pick the variant that contrasts with its
  background (e.g. `wordmark-teal.svg` on light header, `wordmark-cloud.svg`
  on the dark footer).

## Development workflow

There is nothing to install or build. To preview:

```bash
# from the repo root — any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

Or simply open `index.html` in a browser (note: `localStorage` and some
features behave best over `http://`, not `file://`).

**Verify changes by eye in both light and dark themes**, and check the
responsive breakpoints (the CSS has `max-width` media queries at ~900px,
~760px, ~520px). There is no automated test suite or linter.

## Git & branch conventions

- Work happens on a feature branch, not directly on `main`. The currently
  assigned branch for this work is **`claude/claude-md-docs-dr5jt9`** —
  develop, commit, and push there.
- Push with `git push -u origin <branch-name>`.
- Production (`vynatix.com` via GitHub Pages) deploys from `main`, so
  changes reach `main` through a reviewed pull request — **do not create a
  PR or push to `main` unless explicitly asked.**
- Commit messages in history are short, imperative, and descriptive
  (e.g. "Wire up the dark/light theme toggle"). Match that style.
