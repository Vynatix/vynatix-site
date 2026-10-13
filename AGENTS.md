# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

The marketing website for **Vynatix**, a Nordic software consultancy in
Gothenburg. It is a small, **hand-written static site** — no framework, no build
step, no package manager, no bundler. What is in the repo is exactly what ships.

It is served as a flat set of HTML files at the domain in `CNAME`
(`vynatix.com`) via **GitHub Pages**. Editing a file and pushing to the default
branch publishes it; there is nothing to compile.

The site is built on the **Vynatix Design System**, which lives outside this
repo as a Design System artifact (the brand book, `tokens.json`, the component
cards, the logo artwork, the icon set and the fonts). Two of its files are
copied in verbatim (see *Three-layer CSS*); everything else here is written
against the roles and components the system defines.

## Layout

```
index.html          Home — hero, still client list, services, work cards, metrics, CTA band
about.html          Company / team
services.html       Application dev, AI engineering, cloud platforms
work.html           Selected case studies
membership.html     "Collective" / careers for senior engineers
contact.html        Two-inbox contact page (no form — mailto links)
privacy.html        Privacy notice (GDPR Art. 13)
terms.html          Website terms of use
accessibility.html  Accessibility statement — nine pages in total
tokens.css          Design system layer 1: the tokens, generated from the system's
                    tokens.json (colour roles for six themes, spacing, radii, type
                    scale, @font-face). Only the @font-face src lines are the site's.
colors_and_type.css Design system layer 2, verbatim: reset, semantic helpers,
                    .eyebrow, .btn, .card, .glass, .container, per-theme typefaces
styles.css          Layer 3, the site's own: page chrome and components on the roles
app.js              All client behaviour (vanilla JS, IIFEs, no modules)
assets/             Logo files in Forest inks, inline-icon SVGs, self-hosted case
                    photos (jpg + webp), app icons
fonts/              Self-hosted woff2 subsets of the system's faces, plus licences
favicon.svg/.ico    Theme-aware SVG icon (Forest / Cream) + 16/32/48 ICO fallback
apple-touch-icon.png
site.webmanifest    Name, colours and icons for installed/Android use
CNAME               GitHub Pages custom domain
_config.yml         Controls what GitHub Pages publishes (excludes dev docs)
.well-known/        security.txt (RFC 9116 disclosure contact)
SECURITY.md         Disclosure policy (GitHub surfaces it) — not published
CODEOWNERS          Review ownership — not published
EDGE-SETUP.md       Cloudflare runbook for the header-only controls — not published
tools/              Local verification scripts — NOT published, not part of the site
```

There is no `assets/`-level JS or CSS — those folders are static files only.

## Architecture & conventions

**Three-layer CSS.** Every page links the three files in this order:

- `tokens.css` is the design system's generated token sheet. It declares the
  Material 3 colour roles (`--md-sys-color-*`) and their aliases (`--bg`, `--fg`,
  `--text-body`, `--text-muted`, `--text-display`, `--text-accent`,
  `--primary-hover`, `--focus-ring`, `--indicator`,
  `--inverse-on-surface-variant`, the `--success`/`--warning`/`--info` roles,
  the glass tints, `--shadow-l1`…`l5`) for all six themes, plus `--space-*`,
  `--radius-*`, `--text-*` sizes, `--leading-*`, `--tracking-*`, `--icon-*`,
  `--font-*` and the `@font-face` rules. Treat it as read-only: it is the
  system's file. The one site-specific edit is the `@font-face` block, which
  points at the woff2 subsets in `fonts/` instead of the system's TTFs and
  leaves out the 4 MB icon font (the block says so at the top).
- `colors_and_type.css` is the system's hand-written layer, copied verbatim:
  motion, the glass blurs, the reduced-motion and reduced-transparency
  overrides, the per-theme typefaces (`--font-display`, `--font-body`,
  `--font-editorial`, `--font-subhead`), the reset, the semantic helpers
  (`h1`–`h6`, `p`, `p.lede`, `a`, `ul` with the indicator dash, `blockquote`,
  `code`, tables, forms), `.eyebrow`, the `.btn` family, `.card`, `.glass`,
  `.container` and the `.ms` icon classes (unused here, see *Icons*).
- `styles.css` is the site's own layer and the only one you normally edit. It
  consumes **role tokens only**: no raw hex, no palette tokens (`--forest-*`,
  `--teal-*`, `--mono-*` and friends), no `[data-theme]` selectors. A rule
  written that way holds in all six themes automatically. Sizes come from the
  scales. New components follow the system's cards (TopAppBar, Button, Card,
  EditorialCard, MetricCard, Banner, FocusRing, Logo); the file's comments
  name which pattern each block implements.

**Theming.** The design system has three brand directions, each with a light
and a dark theme, over one set of roles: Forest Heritage (`light`, `dark`,
the default), Transformative Teal (`teal-light`, `teal-dark`) and Stockholm
Monochrome (`mono-light`, `mono-dark`). The site ships Forest:
`<html data-theme="light">` on every page. `app.js` flips between the light
and dark theme of the page's direction and persists the full theme id to
`localStorage` (`vynatix-theme`), reading back only its light/dark half. To
move the site to another direction, change `data-theme` on `<html>` in all
nine pages (the toggle follows), then update the static
`<meta name="theme-color">`, `site.webmanifest` colours, the favicon and app
icon inks, and the logo files in `assets/`, which are all Forest today.
Each dark theme is a parallel environment, not an inverted light one: the
inverse bands (`.inverse`: the CTA band, the editorial band, the footer) sit
on `md-sys-color-inverse-surface`, which is light in the dark themes.

**Shared chrome is duplicated, not templated.** The `<header>` and `<footer>`
(and the inline `<svg class="svg-defs">` that defines the wordmark `<symbol>`
both of them place with `<use>`) are copy-pasted into every page. **A change
to nav links, the logo, the footer, contact details, or addresses must be
applied to all `*.html` files.** Set `aria-current="page"` on the current
page's nav link. The header is the system's TopAppBar: a floating Liquid
Glass bar (`.site-header`) whose links take the 2px `--indicator` underline
when current, one small primary button and two icon buttons.

**JavaScript** is plain ES5-flavoured vanilla JS in self-contained IIFEs, each
guarded so a missing element is a no-op. Every page loads `app.js` (deferred),
and `app.js` is the **only** script — there is no CDN or animation stack. It
has two features: the theme toggle and the mobile nav. Nothing on the site
moves on its own: the design system forbids auto-advancing strips and
ambient loops on content surfaces, so the former client marquee is now a
still list (`.clients__list`) and the former case reel is a grid of cards.

The Content-Security-Policy (a `<meta>` tag in every page's `<head>`) pins
`script-src 'self'`, `style-src 'self'` and `font-src 'self'`, so **any
third-party script, inline style or font CDN is blocked by default**. Adding
one means deliberately widening the CSP on **all nine pages** (and the header
copy in `EDGE-SETUP.md`), and updating this file.

**Progressive enhancement / accessibility** is a real constraint here, not an
afterthought — preserve it:
- No-JS users get the fully visible final state; nothing is hidden pending JS.
- **Controls that need JS must not sit dead without it.** The pattern is to
  hide them in CSS and let `app.js` opt in by adding a class to `<html>`:
  `.js-nav` for the collapsible mobile nav (without it the nav stays visible
  and wraps under the bar) and `.js-theme` for the theme toggle (it keeps its
  place but is invisible until it can work).
- The only motion is short transitions on hover and focus; the system's
  `prefers-reduced-motion` rule cuts them to 0.01ms.
- Keep `aria-label` / `aria-expanded` / `aria-pressed` / `aria-current` and
  decorative `aria-hidden` attributes correct when editing markup. Every inline
  icon is `aria-hidden="true"` next to visible words, or inside a button that
  carries an `aria-label`.
- Every text pair has to clear 4.5:1 (3:1 for large text, borders, rings and
  icons) in every theme; the system's roles are measured for that, which is
  why this file bans raw colours.
- `accessibility.html` states the target as "we aim to meet WCAG 2.2 Level AA"
  and lists what has not been independently verified — keep that page honest
  rather than upgrading the claim.

**Copy** follows the system's content fundamentals: sentence case, no em
dashes (use a comma, a colon, parentheses or a new sentence), no exclamation
marks or ellipses, the middle dot (·) as the metadata separator, no Unicode
arrows or emoji as icons. Keep the brand voice: plain, direct,
Nordic-understated.

**Icons** are Material Symbols Outlined, the system's one library, inlined as
SVG (`<svg class="icon [icon--sm|icon--md]" viewBox="0 -960 960 960">`) from
the glyph files in `assets/icons/`, which are copies of the system's
`assets/Icons/`. The icon font itself is not served. `dark_mode` and
`light_mode` (the theme toggle) are not in the system's approved catalogue;
they were drawn from the same package at the same settings and should be added
to the catalogue. Never draw an icon by hand, and never use `.ms`.

## Assets

`assets/` holds the logo as the system's ink files, `vynatix-wordmark-<ink>.svg`
and `vynatix-mark-<ink>.svg`, in the three Forest inks: `forest` (on Cream and
light surfaces), `cream` (reversed, on Forest and the dark canvas) and `bronze`
(print foil only, never small). The pages do not reference them: the wordmark
is inlined once per page as a `<symbol>` filled with `currentColor` and placed
with `<use>` in the header (`md-sys-color-primary`) and footer
(`md-sys-color-inverse-on-surface`), so it follows the theme. The files are for
places where inline SVG cannot go (email, documents) and for regenerating the
icons. The system holds the other inks (teal, ink, cloud, champagne, charcoal,
paper) for the other directions.

The three case photos (`case-*.jpg` with `.webp` siblings, see
`assets/CREDITS.md`) are shown in full colour with no filter or overlay, as the
system's photography rules require for case-study imagery. The client mark in
the home-page list is an inline SVG `<symbol>` in `index.html`, referenced with
`<use>` and filled with `currentColor` (provenance in `assets/CREDITS.md`).

The app icons (`icon-192/512.png`, `apple-touch-icon.png`) are the Cream V mark
on a Forest field; `favicon.ico` is the Forest mark on transparent;
`favicon.svg` switches between the two with `prefers-color-scheme`. All five
were rendered offline through Chromium from the mark files. If the mark or the
direction changes, regenerate all five.

**Fonts** are self-hosted woff2 subsets made from the design system's TTF
files with fontTools, every OpenType feature and variable axis kept. Each face
is split into a Latin file (Swedish included) and a Latin Extended file,
declared with `unicode-range` in `tokens.css`, so a page fetches the second only
when its text needs it:

```sh
pyftsubset Fraunces-VariableFont_SOFT_WONK_opsz_wght.ttf --layout-features='*' --flavor=woff2 \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --output-file=fraunces-variable-latin.woff2
pyftsubset Fraunces-VariableFont_SOFT_WONK_opsz_wght.ttf --layout-features='*' --flavor=woff2 \
  --unicodes="U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" \
  --output-file=fraunces-variable-latin-ext.woff2
```

Forest renders in Fraunces (display, editorial), Aptos (body) and Geist
(eyebrows, the system voice); Teal would use Instrument Serif and Geist,
Monochrome Geist, and `code` is JetBrains Mono in every theme, so all of those
faces ship (a browser fetches only the ones a page uses). The home page
preloads the Fraunces upright and italic Latin files, one for each line of
the hero headline. Instrument Serif and JetBrains
Mono are SIL Open Font License fonts (`fonts/licences/`), Fraunces and Geist
too. **Aptos is Microsoft's typeface**: the design system itself says to check
its terms before shipping it outside Vynatix's own documents, and that check
has not been recorded here. If it fails, delete the seven `aptos-*.woff2`
files and their `@font-face` rules; `--font-body` falls back to Geist. Don't
add third-party font/CDN requests for fonts.

## Working in this repo

- **Run it** by opening `index.html` in a browser, or serve the folder
  (`python3 -m http.server`) so relative paths and `fetch` behave. There is no
  dev server, hot reload, or watch task.
- **The site has no build step** — no framework, bundler, or package manager,
  and what is in the repo ships verbatim. The one exception is `tools/`, which
  holds optional local verification scripts (Playwright). They are developer
  tooling only: excluded from the published output in `_config.yml`, with their
  `node_modules/` gitignored. The site itself stays hand-written.
- **"Passing" means:** the pages render correctly in light and dark, nav/footer
  are consistent across pages, behaviour degrades gracefully with JS off and
  reduced motion on, and there are no console errors. Check changes visually in
  both themes. `tools/README.md` documents the repeatable checks — a visual
  regression gate (`screenshot.js`), an adversarial CSP test (`adversarial.js`),
  an off-origin request check (`requests.js`) and the accessibility suite with
  its contrast sweep (`a11y.js`). Before changing a component, sweep all six
  themes: `THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark`.
- **Re-syncing the design system.** When the system changes, copy its
  `project/colors_and_type.css` over the local one as is, and its
  `project/tokens.css` over the local one keeping the local `@font-face`
  block; then regenerate any font, icon or logo files that changed and run the
  checks. Never edit those two files for a site-specific need: that belongs in
  `styles.css`.
- Match the surrounding style: 2-space indentation, the existing comment voice
  (explanatory, full sentences), and the token-first approach.
- **Do not add inline `style=""` attributes.** The CSP pins `style-src 'self'`,
  so the browser blocks them outright. One-off layout goes in `styles.css` as a
  component modifier (`.section__h2--wide`) or, for pure spacing, one of the
  small `.u-*` utilities at the end of the file (values from the spacing scale
  only). Those utilities are single-class rules, so anything you append later
  with equal specificity will outrank them — put new component rules before
  that block, not after it.

## Git & deploys

- Pushing HTML/CSS/asset changes to the production branch **publishes them
  live** on `vynatix.com`. Treat the default branch as production.
- Do all work on the branch you were assigned; never push to another branch
  without explicit permission.
- Do not open a pull request unless explicitly asked.
- `_config.yml` decides what is actually published. Developer docs (`AGENTS.md`,
  `CLAUDE.md`, `SECURITY.md`, `CODEOWNERS`, the security assessment) and
  `tools/` are excluded, so they stay in the repo but are never served from
  `vynatix.com`. **Anything new that is documentation rather than site content
  must be added to that exclude list.** (The font and icon licence texts are
  published on purpose: they have to travel with the files.)

### Repository hardening (set once, in GitHub settings)

These are not code changes, so they cannot be committed — they need someone with
admin rights on the repository:

- **Branch protection on the default branch.** Because a push publishes to
  production, require a pull request and a Code Owner review before merging, and
  disallow bypassing it. `CODEOWNERS` is in place; replace the placeholder team
  with the real one.
- **Commit email privacy.** The history contains a personal address on 26
  commits. Git author emails are public on GitHub. Enable *Keep my email
  addresses private* and *Block command line pushes that expose my email* in
  personal account settings, and use the `@users.noreply.github.com` address
  going forward. **Do not rewrite the existing history** — it would break the
  merged pull-request record for no real gain, since the address is already
  public.
- **Footer VAT number.** Swedish e-handelslag expects the
  `momsregistreringsnummer` alongside the company identification already in the
  footer. It is not added here because it is a legal identifier that must be
  confirmed rather than derived; add it to the footer on all nine pages once
  known.
