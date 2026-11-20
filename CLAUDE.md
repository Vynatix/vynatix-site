# CLAUDE.md

This file orients Claude Code when working in this repository.

**Read [AGENTS.md](./AGENTS.md) first** — it is the primary, comprehensive guide
to this project (what it is, the layout, architecture, conventions, and how to
run and ship it). Everything there applies to Claude too. This file only
highlights the things most worth keeping front-of-mind.

## The short version

- **Static, hand-written marketing site** for Vynatix (a Nordic software
  consultancy). Twenty-four pages: eleven core English pages (`blog.html`, "Insights" in the menu, lists the guides;
  `membership.html` is "Career"; `work.html` is "Cases"), four English
  deep pages and nine Swedish pages (`sv.html` is the Swedish hub; `integritet.html` is the
  Swedish privacy notice). Three of them are withdrawn stubs (the two lists of consultancies and the Swedish
  comparison of AI consultancies). No framework, no build step, no package manager for
  the site: what's in the repo is what ships, served via GitHub Pages at
  `vynatix.com` (`CNAME`). `_config.yml` decides what is published; developer
  docs and `tools/` are excluded. `tools/` is the one npm-using exception: local
  verification tooling plus `stamp.js` (see the stamps bullet) and `seo-head.py`
  (Python 3; rewrites the search block, header, footer, sitemap and URL lock), and the mask generator
  `sheet-art.js` for the hero background, never site content and
  never run at deploy time.
- **Built on the Vynatix Design System, three-layer CSS:** `tokens.css` (the
  system's generated tokens, read-only here except its `@font-face` block) and
  `colors_and_type.css` (the system's helpers and components, verbatim), then
  `styles.css` (the site's own layer). In `styles.css` use **role tokens only**
  (`var(--md-sys-color-primary)`, `var(--text-muted)`, `var(--space-6)`): no raw
  hex, no palette tokens, no `[data-theme]` selectors, so every rule holds in
  both themes. **No inline `style=""`** — the CSP pins `style-src 'self'`.
- **One colour scheme, Monochrome, in Liquid Glass.** The site shows only the
  system's Monochrome direction (`mono-light`, `mono-dark`); the Forest and Teal
  blocks stay in `tokens.css` (read-only) but no page uses them, and the random
  draw and its `vynatix-look` key are retired (`publish.js` fails if either comes
  back). `app.js` loads in the `<head>` (no `defer`, so there is no flash); light or
  dark follows the toggle (`localStorage`, `vynatix-theme`, of which only the
  light/dark half is read, so older ids such as `dark` still count; the analytics
  choice is the second key, `vynatix-consent`) or the system preference. The
  markup's `<html data-theme="mono-light">` is the no-JS default. The controls
  layer is Apple-style Liquid Glass and the content is never glass: the header is a
  floating capsule whose rim refracts the page (two `<filter>`s in every page's
  `.svg-defs` block, maps in `assets/glass-lens-*.svg`, Chromium only, blur
  elsewhere), its open menu is a glass sheet, buttons are capsules; cards
  and the consent bar stay solid, and the glass itself never moves. See AGENTS.md, *Liquid Glass*.
  Behind every page is a **silk background drawn live**: `styles.css` paints a still
  silk (two masked layers on `body::before`/`::after`, masks in `assets/silk-*.png`),
  and `app.js` lays a `<canvas class="silk-canvas">` over it and draws moving folds in
  a small WebGL shader, in colours read from the page; the cloth also gives way around
  the pointer and rides with the scroll. An owner decision and the
  site's one ambient loop. The canvas exists only while drawing: no JavaScript,
  reduced motion, a stored pause, no WebGL or a lost context all show the same still
  silk. The footer's "Pause background motion" button (`localStorage`,
  `vynatix-motion`) is what makes it meet WCAG 2.2.2, so never ship one without the
  other. Every check runs with the pause stored (`stillSilk` in `_common.js`);
  `tools/verify/waves.js` alone tests the live silk. See AGENTS.md, *Silk waves*.
  The inverse bands (CTA band, editorial band, footer) are light in the dark theme
  by design. Checks pin a theme
  with `pinTheme` (`tools/verify/_common.js`),
  and a component change has to hold in both (`THEMES=…` narrows a run). Logo
  files, favicon, app icons and manifest colours are still Forest.
- **One hero background, the drafting sheet.** The English home hero carries one piece of
  decorative art: ruled guides behind the headline, a scale under the header and, from
  75rem, an A-frame drawing. It is pure CSS in `hero-bg.css`, which **only `index.html`
  links** (so the other twenty-three pages never download it): no script, no storage, no
  motion, the same with and without JavaScript, every rule on the hero carrying
  `:lang(en)`, custom properties named `--sheet-*`, role tokens only. Its two masks are
  `assets/bg-sheet-*.svg` (from `tools/sheet-art.js`, new names whenever regenerated).
  It was one of four drawn at random until 20 November 2026; the owner kept the sheet,
  and the weave, the dial, the iris, the draw (`data-bg`, the `vynatix-bg*` keys in
  `sessionStorage`) and `hero-bg.js` are gone. `publish.js` fails if `hero-bg.js`,
  `data-bg` or a `vynatix-bg` key comes back. The art is placed from the layout and was fitted by hand
  to a three-line headline over six lines of lede; the current headline ("Engineering" / "that compounds.")
  is two lines over two, and the hero keeps the art's room instead (next bullet): **a change to the headline, the lede, the hero spacing or the clients row
  can move art into text, and `npm run check:bg` (`tools/verify/bg-sheet.js`, at the
  design size and, through `bg-fit.js`, on a scaled hero) fails and says which rule.**
  Constants, the bronze budget and how to change it are in AGENTS.md, *Hero background*.
- **The home hero is fitted to the window, and its numbers are measured.** On both home pages the first
  screen is the hero: `styles.css` ("Hero fit") draws the hero in one unit, `--hero-u` (1px at the design
  size), and solves it from the window's height (`100svh`) so that the header and the
  message end on the fold, with the clients' rule lying on it; from 1060px of height (at 1100px and wider) the client row is on the
  first screen too, pinned to its bottom edge. From 1100px the English hero keeps 336 units, not 96, between its buttons and that
  rule: the room the art was fitted to under the longer headline it replaced. Every vertical size in the hero is `calc(N * var(--hero-u))`
  (N is the token the comment names), `hero-bg.css` multiplies the art's constants by the same unit, the
  eyebrow and buttons keep their size and the lede stops at 18px (16px on a phone). Outside the envelope (a
  window under 650px high, 520px on a phone, which is where browser zoom lands, or no `svh`) the hero is the
  plain scrolling one. An owner decision. **The solve's constants (`--hero-f1`, `--hero-k1`, `--hero-above`
  and the rest) are facts about the current copy, the header and the hero's spacing: after changing any of
  those, run `node tools/verify/hero-fit.js`, which prints the measurement and names the pair to refit.**
  `min-height` only, never `height` or `overflow` on the hero. See AGENTS.md, *Hero fit*.
- **The English home page tells its story in pictures, and its generated pictures come in two sets.** The
  last block of `styles.css` ("The English home page: its pictures") holds it: a tall lead case beside two compact ones, the hero's
  drawing at four stages in the Partnership band (masks `assets/stage-*.svg`, written by `tools/sheet-art.js`
  from the hero's own constants), no tinted strips, the drawing's centre line down the left margin, and
  Insights as ruled rows. The Services picture and the three case pictures are generated still lifes with a
  daylight and a night version each; `light-dark()` picks the file from the page's `color-scheme`, so there is
  no theme selector and only one set is fetched. **A new picture ships as a pair, the night one made by
  editing the daylight one.** The contents row no longer pins: the header is the only bar. The owner chose the
  drawn frames over a film (20 November 2026): no video. `sv.html` keeps the older layout and the stock
  photographs. See AGENTS.md, *The English home page*.
- **Header and footer are templates; the skip link and the inline wordmark `<symbol>` are duplicated.** The
  sources are the `HEADER` (with its `NAV` list, which sets `aria-current="page"` itself) and `FOOTER`
  templates in `tools/seo-head.py`: a nav, logo or contact-detail change is made there and the script run,
  which writes it into every page. The skip link and the `.svg-defs` block (the `<symbol>` and the two glass `<filter>`s) are copy-pasted into every
  `*.html` file — there is no include system — so a change to either is made in **all** pages.
- **The four shared files carry version stamps in every page** (`styles.css?v=1a2b3c4d`
  on `tokens.css`, `colors_and_type.css`, `styles.css`, `app.js`; `hero-bg.css`
  carries one too, in `index.html` only), because GitHub Pages
  serves fixed URLs and a browser can otherwise pair new HTML with an old, cached
  stylesheet (that is what broke iOS Chrome after the design-system migration). The stamps
  protect the visitor's browser cache; GitHub's CDN ignores the query string. After
  editing any of the five, run `cd tools && npm run stamp` and commit the pages with
  the change; `npm run check` fails until you do. Fonts and images are not stamped
  (rename one if a stale copy would show).
- **`app.js`** is vanilla, IIFE-per-feature, element-guarded: five features
  (theme toggle, mobile nav, the silk background's `js-waves` and pause
  button, the Career page's rate calculator, and last, where `consent.js`
  expects it, analytics consent) and no CDN/animation stack. **One thing on
  the site moves on its own, and no second may be added: the silk background is drawn
  live until the visitor pauses it (above).** Everything else that moves is a short
  transition on hover or focus; reduced motion removes all of it. The system
  forbids auto-advancing strips and ambient loops, so the client list is still,
  the hero's drafting sheet is still and the silk has a pause control: an owner decision whose limits must not be loosened.
  `app.js` is the only script any page loads.
  The CSP pins `script-src` to `'self'` plus one Google path, so adding any other
  third-party script means widening the CSP in **every page** first (see the
  analytics bullet).
- **Analytics is Google Analytics 4 behind opt-in consent, and it is off.**
  `var GA_ID = 'G-XXXXXXXXXX';` in the last IIFE of `app.js` is an inert
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
  downgrade** from the `'self'`-only policy: the meta on all 24
  pages, `EDGE-SETUP.md` and the Cloudflare dashboard rule change together
  (dashboard first if the edge is live), and a missing host is added by name,
  never `https://*.google.com`. Details in AGENTS.md, *Analytics*.
  `[[CONFIRM: what is needed]]` markers in the notices are facts only a human
  supplies; never fill one in.
- **The whole site follows the owner's website content plan and brand voice of November 2026.** Every block
  opens with a promise and backs it with a fact; "you" before "we"; one name for the firm (consultancy, never
  agency or collective); automotive only inside a named case, never in a headline or a description of Vynatix;
  nothing about how Vynatix runs inside; every number real and every client named only with its approval. The
  home page is eight blocks under the brand line "Engineering that compounds." (the Swedish hub has the same
  blocks in Swedish); the plan's In numbers block was removed from both on the owner's word of 20 November
  2026 and does not come back. The menu is Services, Industries, Cases (`work.html`), Insights (`blog.html`), Career
  (`membership.html`, in the recruit voice), About, Contact; file names never change. The lines the plan
  removed do not come back on any page: declining work or sending a reader to another firm, comparisons with
  other consultancies, "no pitch, no pressure", what a model cannot do as a headline, talk of size, the
  membership pitch. **One exception, asked for on 20 November 2026: the rate calculator on the Career page**
  (`membership.html#rate-calculator`), which works from a share of the invoiced amount and shows what a
  salary costs. The share is 70 per cent; its slider (70 to 80) is hidden, and five clicks on the "Your
  assignment" title show it, with no hint on the page, on purpose: never add one. It is worked out in the browser by `app.js`, stores and sends nothing, and is not shown without
  JavaScript (`js-calc`). Its terms (the share, the 4.5% pension, 1.57 as the cost of a krona of salary) were
  taken from the calculator it was modelled on and are the owner's: change one in `app.js`, in the page's labels
  and in `tools/verify/calc.js` together, and add no sentence about terms around it. See AGENTS.md, *Rate
  calculator*. Owner decisions of 20 November 2026: no experience figure for the team, no "start with one
  engineer" sentence, the English questions live on `contact.html`. **Never fill in what the plan leaves to the
  owner** (the Ultra Group sentences, people by name, open roles, how engineers join, a case outside
  automotive, the Volvo Trucks challenge line), and the Swedish still needs a native reader's check. See
  AGENTS.md, *The English home page*, *The other pages* and *Swedish pages*.
- **Posts are guides at the flat root, and a page can be withdrawn but never deleted.** A new guide is a
  `kind='post'` entry in `PAGES` of `tools/seo-head.py` (and in `tools/verify/_common.js`), written to the
  Guide pattern in AGENTS.md, *Posts, permanence and withdrawal*: undated permanent slug, no directory, no
  `_posts/`, a call to action whose mailto subject carries the slug, section ids that are not `article`. A fact
  not already on a published page is drafted outside the public repo until the owner approves it, and a
  `[[CONFIRM]]` marker is never filled in. `status='withdrawn'` replaces a page with a stub; `tools/urls.lock`
  and `tools/verify/permanence.js` stop a URL from disappearing; `tools/TAKEDOWN.md` is the runbook.
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
  `.js-theme` for the theme toggle, `.js-motion` for the background motion button, `.js-calc` for the rate calculator, `.js-consent` once the consent module is
  active). Copy follows the system's content rules: no
  em dashes, no exclamation marks, sentence case. Don't regress any of this.

## Verifying work

There is no lint step, but there *is* a check suite: see `tools/README.md`
(`cd tools && npm install`, then `npm run check`). It covers broken links,
off-origin requests, CSP enforcement and sync (`csp.js`), the consent behaviour
and layout (`consent.js`, `consent-layout.js`), what ships (`publish.js`: pages
registered, new root files excluded, footer link, storage keys named, the site's
style rules, the hero background's rules and the retired draws), the hero background's guard, the rate
calculator's arithmetic and no-JavaScript state (`calc.js`), accessibility
including a contrast sweep, and a screenshot diff.
`release-gate.js` (only its `--self-test` is in the chain) and the opt-in
`consent-live.js` are outside `npm run check`. Serve the repo root first
(`python3 -m http.server 8000`). `THEMES` narrows the themes a run covers (see `tools/README.md`).

Also verify visually: render in light and dark, confirm header/footer match the
other pages, and check it degrades gracefully with JS disabled and reduced
motion on, with no console errors.

## Pushing

Pushing to the production branch publishes live to `vynatix.com`. Work only on
the assigned branch, and don't open a PR unless asked.
