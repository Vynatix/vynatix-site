# CLAUDE.md

This file orients Claude Code when working in this repository.

**Read [AGENTS.md](./AGENTS.md) first** — it is the primary, comprehensive guide
to this project (what it is, the layout, architecture, conventions, and how to
run and ship it). Everything there applies to Claude too. This file only
highlights the things most worth keeping front-of-mind.

## The short version

- **Static, hand-written marketing site** for Vynatix (a Nordic software
  consultancy). Twenty-one pages: nine core English pages, three English deep pages,
  and nine Swedish pages (`sv.html` is the Swedish hub; `integritet.html` is the
  Swedish privacy notice). No framework, no build step, no package manager for
  the site: what's in the repo is what ships, served via GitHub Pages at
  `vynatix.com` (`CNAME`). `_config.yml` decides what is published; developer
  docs and `tools/` are excluded. `tools/` is the one npm-using exception: local
  verification tooling plus `stamp.js` (see the stamps bullet) and `seo-head.py`
  (Python 3; rewrites the search block, footer and sitemap), and the mask generators
  `dial-masks.py` and `sheet-art.js` for two hero backgrounds, never site content and
  never run at deploy time.
- **Built on the Vynatix Design System, three-layer CSS:** `tokens.css` (the
  system's generated tokens, read-only here except its `@font-face` block) and
  `colors_and_type.css` (the system's helpers and components, verbatim), then
  `styles.css` (the site's own layer). In `styles.css` use **role tokens only**
  (`var(--md-sys-color-primary)`, `var(--text-muted)`, `var(--space-6)`): no raw
  hex, no palette tokens, no `[data-theme]` selectors, so every rule holds in all
  six themes. **No inline `style=""`** — the CSP pins `style-src 'self'`.
- **Six themes, one drawn at random per visit.** `app.js` loads in the `<head>`
  (no `defer`, so there is no flash) and draws Forest, Teal or Monochrome once
  per visit, kept in `sessionStorage` (`vynatix-look`); light or dark follows the
  toggle (`localStorage`, `vynatix-theme`; the analytics choice is the third key,
  `vynatix-consent`) or the system preference, and the
  toggle flips within the drawn direction. Blocked storage or no JS means
  Forest. The markup's `<html data-theme="light">` is the no-JS default. The
  inverse bands (CTA band, editorial band, footer) are light in the dark themes
  by design. Because the theme is random, any check that needs one pins it with
  `pinTheme` (`tools/verify/_common.js`, which also pins the hero background), and
  a component change has to hold in all six (`THEMES=…` on the check scripts). Logo
  files, favicon, app icons and manifest colours stay Forest.
- **One of four hero backgrounds, drawn at random per visit.** `weave`, `sheet`,
  `dial` and `iris` decorate the English home hero; `app.js` keeps the pick in
  `sessionStorage` (`vynatix-bg`) and sets `data-bg` on `<html>` before first paint;
  blocked storage or no JavaScript means `sheet`. Every rule of a background starts
  from `:root[data-bg="<id>"]` (the sheet's form is
  `:root:is(:not([data-bg]), [data-bg="sheet"])`), its JS returns at once unless it
  is the drawn one, and its CSS and JS sit in `bg:<id>:begin` / `bg:<id>:end` fenced
  blocks in `hero-bg.css` and `hero-bg.js`, which **only `index.html` links** (so the other
  twenty pages never download them; the draw itself stays in `app.js`); the iris
  also has a fenced SVG block in `index.html`). Masks are `assets/bg-<id>-*.svg`,
  new names whenever regenerated. The art is placed from the layout and fitted by hand
  to the current headline copy ("Your in-house software team." / "Without the
  hiring."): **a change to the headline, the lede, the hero spacing or the clients row
  can move art into text, and `npm run check:bg` (the five `tools/verify/bg-*.js`
  guards) fails and says which rule.** Storage: `vynatix-bg`, `vynatix-bg-seed`
  (weave) and `vynatix-bg-iris` (iris), listed in `privacy.html`;
  `vynatix-bg-iris-idle` is a read-only test hook. Per-background detail, constants,
  the bronze budget and how to add or remove one are in AGENTS.md, *Hero backgrounds*.
- **Header and footer (and the inline wordmark `<symbol>`) are duplicated
  across every `*.html` file** — there is no include system. Any nav, logo or
  header contact-detail change must be made in **all** pages, and
  `aria-current="page"` set on the active link. The footer is the one exception:
  its source is the `FOOTER` template in `tools/seo-head.py`, so a footer change
  is made there and the script run, which writes it into every page.
- **The four shared files carry version stamps in every page** (`styles.css?v=1a2b3c4d`
  on `tokens.css`, `colors_and_type.css`, `styles.css`, `app.js`; `hero-bg.css` and
  `hero-bg.js` carry them too, in `index.html` only), because GitHub Pages
  serves fixed URLs and a browser can otherwise pair new HTML with an old, cached
  stylesheet (that is what broke iOS Chrome after the design-system migration). The stamps
  protect the visitor's browser cache; GitHub's CDN ignores the query string. After
  editing any of the six, run `cd tools && npm run stamp` and commit the pages with
  the change; `npm run check` fails until you do. Fonts and images are not stamped
  (rename one if a stale copy would show).
- **`app.js`** is vanilla, IIFE-per-feature, element-guarded: four features
  (theme draw and toggle, the hero background draw, mobile nav, analytics consent;
  the small scripts of the backgrounds that need one are in `hero-bg.js`, home page
  only) and no CDN/animation stack. **Nothing on
  the site moves on its own, with one exception: the iris background (a quarter of
  visits) opens its inner dial once, after 20 s of silence, in 3.6 s, and any input
  ends it.** The dial background answers the pointer (and sweeps once, for half a
  second, when the theme toggles with a mouse or trackpad); reduced motion removes all of it. The system
  forbids auto-advancing strips and ambient loops, so the client list is still and
  the iris is a single event, an owner decision whose limits must not be loosened.
  `app.js` is the only script every page loads (the home page adds `hero-bg.js`).
  The CSP pins `script-src` to `'self'` plus one Google path, so adding any other
  third-party script means widening the CSP in **every page** first (see the
  analytics bullet).
- **Analytics is Google Analytics 4 behind opt-in consent, and it is off.**
  `var GA_ID = 'G-XXXXXXXXXX';` in the fourth IIFE of `app.js` is an inert
  placeholder: no bar, no storage, no request. Beside it, `PURGE_ONLY` is the
  emergency stop, `false` except during an exit. Google is never requested, and
  no cookie set, before the visitor has accepted (a stored Accept from an earlier
  visit counts until it lapses). To switch it on, only when
  `tools/PRE-FLIP-CHECKLIST.md` is complete: set the notices' visible "Last
  updated" lines and their `mod` in `tools/seo-head.py` to the day of the flip, run
  `python3 tools/seo-head.py`, then edit the `GA_ID` line (after an exit, also set
  `PURGE_ONLY` back to `false`), run `cd tools && npm run stamp` and
  `node verify/release-gate.js`. That is the last commit of the one PR and it
  changes `GA_ID`, those dates (visible and `mod`), the files `seo-head.py` writes
  from them and the stamps, nothing else.
  The gate fails on a placeholder or malformed ID, any `[[CONFIRM` marker, a
  surviving draft banner (removed only on counsel's written sign-off), an unticked
  box in sections 1 to 9 of the checklist, `PURGE_ONLY` not `false`, a wrong policy
  constant or a stale notice date, among others (AGENTS.md, *Analytics*), and it
  prints `scripted gates pass, N human gates open` when it passes. Switching off
  again starts with `PURGE_ONLY` set to `true`; the `GA_ID` revert comes last
  (checklist, section 10). The CSP names Google's hosts, **a recorded security
  downgrade** from the `'self'`-only policy: the meta on all 21
  pages, `EDGE-SETUP.md` and the Cloudflare dashboard rule change together
  (dashboard first if the edge is live), and a missing host is added by name,
  never `https://*.google.com`. Details in AGENTS.md, *Analytics*.
  `[[CONFIRM: what is needed]]` markers in the notices are facts only a human
  supplies; never fill one in.
- **Icons are inline SVG** from the system's Material Symbols files in
  `assets/icons/` (`aria-hidden`, beside visible words or inside a labelled
  button). Never draw one, never use the `.ms` font classes.
- **Every page is written to be quoted by AI search engines.** Each `<head>` has a
  canonical link, Open Graph, hreflang for the five English/Swedish pairs, and one
  JSON-LD graph with the same Organization node everywhere (`memberOf` Ultra Group,
  matching the footer). When page content changes, move the page's `mod` date in
  the `PAGES` registry of `tools/seo-head.py` and run `python3 tools/seo-head.py`;
  it writes `dateModified`, the `article:modified_time` meta and the sitemap
  `<lastmod>` from that one value; a visible FAQ
  (`data-faq`) and its FAQPage data must match word for word (answers are flat `p`
  and `li`; the FAQPage is its own graph node). `tools/verify/seo.js` enforces this.
  The list pages name
  other firms: quote only their own sites, alphabetical, dated, with the disclosure.
  See AGENTS.md, *Search, AI engines and structured data*.
- **Progressive enhancement and accessibility are load-bearing:** no-JS users
  get the final visible state, nothing hidden pending JS, and no control left
  dead. JS opts in by adding a class to `<html>` (`.js-nav` for the menu button,
  `.js-theme` for the theme toggle, `.js-consent` once the consent module is
  active). Copy follows the system's content rules: no
  em dashes, no exclamation marks, sentence case. Don't regress any of this.

## Verifying work

There is no lint step, but there *is* a check suite: see `tools/README.md`
(`cd tools && npm install`, then `npm run check`). It covers broken links,
off-origin requests, CSP enforcement and sync (`csp.js`), the consent behaviour
and layout (`consent.js`, `consent-layout.js`), what ships (`publish.js`: pages
registered, new root files excluded, footer link, storage keys named, the site's
style rules), the hero background draw and a guard per background, accessibility
including a contrast sweep, and a screenshot diff.
`release-gate.js` (only its `--self-test` is in the chain) and the opt-in
`consent-live.js` are outside `npm run check`. Serve the repo root first
(`python3 -m http.server 8000`). `THEMES` and `BGS` widen the themes and the
backgrounds a run covers (see `tools/README.md`).

Also verify visually: render in light and dark, confirm header/footer match the
other pages, and check it degrades gracefully with JS disabled and reduced
motion on, with no console errors.

## Pushing

Pushing to the production branch publishes live to `vynatix.com`. Work only on
the assigned branch, and don't open a PR unless asked.
