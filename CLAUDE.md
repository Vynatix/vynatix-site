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
  (Python 3; rewrites the search block, footer and sitemap), never site content and
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
  `pinTheme` (`tools/verify/_common.js`), and a component change has to hold in
  all six (`THEMES=…` on the check scripts). Logo files, favicon, app icons and
  manifest colours stay Forest.
- **Header and footer (and the inline wordmark `<symbol>`) are duplicated
  across every `*.html` file** — there is no include system. Any nav, logo or
  header contact-detail change must be made in **all** pages, and
  `aria-current="page"` set on the active link. The footer is the one exception:
  its source is the `FOOTER` template in `tools/seo-head.py`, so a footer change
  is made there and the script run, which writes it into every page.
- **The four shared files carry version stamps in every page** (`styles.css?v=1a2b3c4d`
  on `tokens.css`, `colors_and_type.css`, `styles.css`, `app.js`), because GitHub Pages
  serves fixed URLs and a browser can otherwise pair new HTML with an old, cached
  stylesheet (that is what broke iOS Chrome after the design-system migration). The stamps
  protect the visitor's browser cache; GitHub's CDN ignores the query string. After
  editing any of the four, run `cd tools && npm run stamp` and commit the pages with
  the change; `npm run check` fails until you do. Fonts and images are not stamped
  (rename one if a stale copy would show).
- **`app.js`** is vanilla, IIFE-per-feature, element-guarded: three features
  (theme draw and toggle, mobile nav, analytics consent) and no CDN/animation
  stack. Nothing on the site moves on its own: the system forbids auto-advancing
  strips and ambient loops. It is still the only script the pages load. The CSP
  pins `script-src` to `'self'` plus one Google path, so adding any other
  third-party script means widening the CSP first (see the analytics bullet).
- **Analytics is Google Analytics 4 behind opt-in consent, and it is off.**
  `var GA_ID = 'G-XXXXXXXXXX';` in the third IIFE of `app.js` is the one constant
  and an inert placeholder: no bar, no storage, no request. Google is never
  requested, and no cookie set, before the visitor presses Accept. To switch it
  on, edit only that line (the last commit of the one PR), run
  `cd tools && npm run stamp` and `node verify/release-gate.js`, and only when
  `tools/PRE-FLIP-CHECKLIST.md` is complete. The CSP names Google's hosts, **a
  recorded security downgrade** from the `'self'`-only policy: the meta on all 21
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
and layout (`consent.js`, `consent-layout.js`), accessibility including a
contrast sweep, and a screenshot diff. `release-gate.js` and the opt-in
`consent-live.js` are outside `npm run check`. Serve the repo root first
(`python3 -m http.server 8000`).

Also verify visually: render in light and dark, confirm header/footer match the
other pages, and check it degrades gracefully with JS disabled and reduced
motion on, with no console errors.

## Pushing

Pushing to the production branch publishes live to `vynatix.com`. Work only on
the assigned branch, and don't open a PR unless asked.
