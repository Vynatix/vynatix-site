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
index.html          Home — hero (one of four drawn backgrounds), still client list, services,
                    work cards, metrics, CTA band
about.html          Company / team
services.html       Application dev, AI engineering, cloud platforms
work.html           Selected case studies
membership.html     "Collective" / careers for senior engineers
contact.html        Two-inbox contact page (no form — mailto links)
privacy.html        Privacy notice (GDPR Art. 13), with the analytics and cookies
                    section (#cookies) and the in-page consent buttons
terms.html          Website terms of use
accessibility.html  Accessibility statement
android-automotive-development.html   Android Automotive in Gothenburg (English twin of
                    android-automotive-utveckling.html)
ai-engineering.html AI engineering in Gothenburg (English twin of ai-utveckling.html)
android-automotive-consultancies-gothenburg.html  Alphabetical, sourced list of Gothenburg
                    consultancies working on Android Automotive (English twin)
sv.html             Swedish home and hub for the Swedish pages (twin of index.html)
android-automotive-utveckling.html, ai-utveckling.html,
konsultbolag-android-automotive-goteborg.html   Swedish twins of the three pages above
valja-konsultbolag.html, platform-engineering.html, ai-assistent-interna-dokument.html,
ai-konsultbolag-sverige.html   Swedish guides
integritet.html     Swedish privacy notice, the twin of privacy.html (the fifth
                    English/Swedish pair); the Swedish consent bar links to it.
                    Twenty-one pages in total
robots.txt          Allows every crawler, names the AI search agents, points at the sitemap
sitemap.xml         Every page, its lastmod and its hreflang pair (written by
                    tools/seo-head.py from PAGES)
llms.txt            A plain-text summary of the company and every page, in both languages
<32 hex>.txt        The IndexNow key file (tools/indexnow.js proves ownership with it)
tokens.css          Design system layer 1: the tokens, generated from the system's
                    tokens.json (colour roles for six themes, spacing, radii, type
                    scale, @font-face). Only the @font-face src lines are the site's.
colors_and_type.css Design system layer 2, verbatim: reset, semantic helpers,
                    .eyebrow, .btn, .card, .glass, .container, per-theme typefaces
styles.css          Layer 3, the site's own: page chrome and components on the roles
app.js              All client behaviour (vanilla JS, IIFEs, no modules): the theme,
                    the hero background draw, the mobile nav, and analytics consent
                    (see Analytics)
hero-bg.css         The four hero backgrounds' rules (only index.html links it)
hero-bg.js          The scripts of the backgrounds that need one (only index.html links it)
assets/             Logo files in Forest inks, inline-icon SVGs, self-hosted case
                    photos (jpg + webp), app icons, the masks of the sheet and dial
                    hero backgrounds (bg-<id>-*.svg)
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
tools/              Local verification scripts (verify/, including the consent checks
                    and the four hero background guards), stamp.js (writes the ?v=
                    version stamps into the pages), seo-head.py (rewrites the search
                    block, footer and sitemap) and the two mask generators,
                    dial-masks.py and sheet-art.js; NOT published, not part of the site
tools/PRE-FLIP-CHECKLIST.md   The hard gate for switching analytics on (not published)
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

**Version stamps on the four shared files.** Every page loads `tokens.css`,
`colors_and_type.css`, `styles.css` and `app.js` with a content hash in the URL
(`styles.css?v=1a2b3c4d`). GitHub Pages serves each file at one fixed URL with
`Cache-Control: max-age=600`, and nothing makes a browser refetch a stylesheet
when the page that uses it changes, so after a redesign a phone can hold the new
HTML beside the old stylesheet (iOS Chrome did exactly that after the
design-system migration: icons at full width in black, default list bullets, an
unstyled header). A changed file gets a URL the visitor's browser has never
cached, so the HTML names the exact stylesheet it was written for. **After you
change any of the six files, run `cd tools && npm run stamp` and commit the
updated pages with the change.** `npm run check` (`node stamp.js --check`) fails
until you do, and `verify/stale-cache.js` proves, in a browser holding an old
copy of all six files under the plain URLs, that the stamped pages still come
out right (`ENGINE=webkit node verify/stale-cache.js` runs it in WebKit, the
engine iOS Chrome uses). A new page must load all four files; the stamp check
fails if it does not. Two more files carry stamps and are not shared: `hero-bg.css` and
`hero-bg.js`, the hero backgrounds, which only `index.html` loads (`stamp.js` and
`stale-cache.js` handle them, and the stamp check fails if any other page links them).

What the stamps do not cover: GitHub's CDN ignores the query string, so it can
answer a new stamp with the previous bytes until a deploy replaces its copy (the
stamps protect the visitor's browser, not the CDN); and an old HTML page cached
next to the new stylesheet cannot be helped on a host that keeps one file per
path. Fonts and images are not stamped. They are replaced in place under fixed
names, and `app.js` preloads fonts by the plain URL the `@font-face` rule uses,
which the two must keep identical to be reused. If a font or image changes in a
way a stale copy would make visible (glyph coverage, metrics, a different
picture), give it a new file name and change it in `tokens.css` and in
`DISPLAY_FACES` in `app.js` together. (The redesign changed Instrument Serif, the
app icons, the favicon and the manifest in place; that was checked and is
harmless.)

**Theming.** The design system has three brand directions, each with a light
and a dark theme, over one set of roles: Forest Heritage (`light`, `dark`),
Transformative Teal (`teal-light`, `teal-dark`) and Stockholm Monochrome
(`mono-light`, `mono-dark`). **The site draws one direction at random for each
visit.** `app.js` is loaded in the `<head>`, without `defer`, so its first
block runs before the body exists and sets `data-theme` (and `theme-color`)
before anything paints; the CSP rules out an inline script, so a small blocking
first-party file is the way to avoid a flash of the wrong theme. The rules:

- The draw (`forest`, `teal` or `mono`, equal odds) is kept in `sessionStorage`
  under `vynatix-look`, so every page of the visit matches; a new tab or a
  later visit draws again. A stored value that is not one of the three is
  discarded.
- Light or dark is not random. It follows the visitor's toggle choice
  (`localStorage`, `vynatix-theme`, whose full theme id is stored but only its
  light/dark half is read) and, without one, `prefers-color-scheme`.
- The toggle flips light and dark inside the direction the visit drew.
- If storage is blocked the draw cannot be kept, so the page stays on Forest
  rather than re-drawing on every navigation. Without JavaScript the markup's
  own `<html data-theme="light">` (Forest light) is what shows.

The theme and the consent choice write three keys in the visitor's own browser,
and none is sent anywhere: `vynatix-look` (`sessionStorage`, the direction drawn for the visit,
written without any click), `vynatix-theme` (`localStorage`, light or dark,
written when the toggle is pressed) and `vynatix-consent` (`localStorage`, the
analytics choice, written when Decline or Accept is pressed; see *Analytics*).
Both notices already name all three keys and call the first two display
preferences; whether that description is right, and whether the bar has to mention
them, is for counsel to confirm (`tools/PRE-FLIP-CHECKLIST.md`, 4.2). The hero
backgrounds write three more, `vynatix-bg`, `vynatix-bg-seed` and `vynatix-bg-iris`,
in `sessionStorage` only (see *Hero backgrounds*, *Storage*); `privacy.html` lists them
too. The one-line fallback, if the random draw has to go, is to pin `pickLook()` as
described below.
- On the home page `app.js` also preloads the headline faces of the drawn
  direction (`DISPLAY_FACES`), so the hero is not blocked on a late font fetch.
  Other pages add no preloads.

To pin the site to one direction, replace `pickLook()`'s body with
`return 'forest';` (or `'teal'`, `'mono'`); to draw on every page load instead
of every visit, skip the `sessionStorage` read there. Everything that is
Forest-only stays Forest whatever is drawn: the logo files in `assets/`, the
favicon and app icons, the manifest colours and the markup's default
`theme-color`. The inline wordmark and every page colour follow the theme.
Each dark theme is a parallel environment, not an inverted light one: the
inverse bands (`.inverse`: the CTA band, the editorial band, the footer) sit
on `md-sys-color-inverse-surface`, which is light in the dark themes.

**Hero backgrounds.** The English home page's hero carries one of four decorative
backgrounds, **drawn at random for each visit** like the colour scheme: `weave` (a
seeded woven cloth), `sheet` (the headline's drafting sheet), `dial` (a vernier
dial the pointer moves) and `iris` (a tonal dial with one opening per visit). The
owner decided to ship all four. They are art, not content: no text, role or
focus, `pointer-events: none`, `aria-hidden` or an empty `content`, behind or clear
of every text box, off wherever the visitor asks for less (see each one below).

- **The draw.** The second IIFE in `app.js`, right after the theme draw, keeps the
  pick in `sessionStorage` under `vynatix-bg` (`weave`, `sheet`, `dial` or `iris`,
  equal odds) and sets `data-bg` on `<html>` in the blocking head, before first
  paint, on every page (only the home page has rules that read it). A stored value
  that is not one of the four is discarded. Blocked storage gives `sheet`, and
  without JavaScript `<html>` has no `data-bg` at all, which `hero-bg.css` treats as
  the sheet, so the sheet is the one background that needs no script. To pin the
  site to one, replace `pickBg()`'s body with `return 'sheet';` (or another id).
- **The selector form and the scoping rules.** Every selector that styles a
  background starts from `:root[data-bg="<id>"]` (the sheet's is
  `:root:is(:not([data-bg]), [data-bg="sheet"])`), including rules on `.hero`,
  `.hero__h1` and `em`, not only pseudo-elements, and carries `:lang(en)`, so the
  Swedish hub is untouched. With another background drawn, a block changes
  nothing. A background's JS is one IIFE that returns at once unless `data-bg` is
  its id and the page is the home page: no listener, timer, observer, frame, Web
  Animation or storage write otherwise.
  Colours are role tokens and `color-mix()` on them only (no hex, no palette token, no
  `!important`, no `[data-theme]`, no inline `style=""`), custom properties and
  keyframes carry the id (`--weave-*`, `--sheet-*`, `--dial-*`, `--iris-*`,
  `iris-open`), storage keys are `vynatix-bg-<something>` in `sessionStorage` only,
  and assets are `assets/bg-<id>-*.svg` named by `url()` inside a rule scoped to the
  id and behind the media query it needs, so they are requested only when that
  background is drawn and the widths it applies to. `tools/verify/bg-draw.js`
  enforces all of this.
- **Where it lives.** In two files that only `index.html` links, after `styles.css` and
  `app.js`, so the other twenty pages never download them: `hero-bg.css` and
  `hero-bg.js`. The draw itself stays in `app.js`: it is a few lines, runs on every page and
  everything else depends on it. Each background is a block in `hero-bg.css` between
  `/* bg:<id>:begin */` and `/* bg:<id>:end */` (in the order weave, sheet, dial, iris) and
  a block in `hero-bg.js` between `// bg:<id>:begin` and `// bg:<id>:end` (the sheet's is
  a comment: it has no script). `hero-bg.js` is a blocking script in the head, after
  `app.js`, because the weave's tile and the iris's arming must be in place before the first
  paint. The iris also has inline SVG in `index.html`, the first child of `.clients`, between
  `<!-- bg-iris:begin` and `<!-- bg-iris:end -->`, `aria-hidden`, `display: none` unless it is
  drawn. Both files carry version stamps (`stamp.js`).
- **Storage** (session storage only, nothing in local storage; listed in
  `privacy.html`, and `bg-draw.js` fails if the two differ): `vynatix-bg` (the
  draw), `vynatix-bg-seed` (weave only: one whole number from 0 to 4294967295 that
  picks the cloth; anything else stored there is replaced) and `vynatix-bg-iris`
  (iris only: the string `1`, written when the opening starts, so the next view in
  the visit is still; blocked storage counts as seen). `vynatix-bg-iris-idle` is a
  **test hook**, not a setting: a number of milliseconds from 200 to 600000 that
  replaces the iris's 20 s silence so the checks need not wait. The site only
  reads it, never writes it, never lists it for visitors, and ignores anything
  else; `bg-draw.js` keeps it that way (one constant, one read, no write, not in
  `privacy.html`, the range and the ignored values tested).

*Weave* (`weave`; no asset, no request). The `bg:weave` block in `hero-bg.js` turns the
visit's seed into a 6px-pitch balanced twill tile (2/2, 3/3 or 4/4; five structures,
five cloths, a seeded phase; the motif is 96 to 192px) and sets it as `--weave-tile`
on `<html>` before first paint. The CSS draws one `.hero__h1::before`, behind
`@supports (transition-behavior: allow-discrete)` (it stands for `@property` and the
`lh` unit), from 1100px up: top is the headline's static position plus
`margin-top: 1.12lh + 24px` (`--weave-lh` is a registered `<length>` set to `1lh` on
the headline), height `4.5lh`; left is the lede box's right edge plus 24px (the
pseudo-element is set in `font: var(--text-type-lede)`, so `56ch` is the lede's
measure); right is the header's right edge, `max(24px, (100% - 1200px) / 2)`, where a
16px three-cord selvedge sits. Ink is `tertiary` 45% into `on-surface`, the ramp is
20, 48, 72 and 82% at 10, 26, 46 and 70% of the width, the ground is 24%, the
vertical fade 14% and 82%. Off under forced colours, more contrast, reduced
transparency and print. Hand-fitted: 1.12, 4.5, 56ch, the ramp, ground and fades,
the 1100px breakpoint. `bg-weave.js`.

*Sheet* (`sheet`; two assets, 75rem and up). Pure CSS: no script, no storage, no
motion, and the default without script. Row guides: `.hero__h1::before` and
`.hero__h1 em::before` are zero-net-width inline-blocks whose bottom edge is the
row's baseline (`1cap` is the face's cap height), at `z-index: -2` in opaque colours;
the first carries a second set of guides at `+1lh` because the roman row is one line
in Forest and two in Teal and Monochrome, the second is the italic line's own set,
with the bronze baseline. Art: `.hero::before` (neutral: the tick scale under the
header, the right-edge scale limited to the gutter, and from 75rem the A-frame, arcs
and grid from `assets/bg-sheet-art.svg`) and `.hero::after` (the bronze edge and apex
mark, `assets/bg-sheet-edge.svg`, not generated below 75rem) are alpha masks of
87.5em by 50em anchored at `calc(50% + 40em - 576px)`, so they follow text zoom.
Phones (under 600px) drop the dashed guides and shorten the ruler. Off under forced
colours, more contrast and print; it is never removed by width (only the A-frame is
left out below 75rem) and it has no reduced-transparency rule. Hand-fitted:
`--sheet-hold` 11em (roman) and 6.9em (italic), kept 0.25em clear of the real text
ends, `--sheet-lo` 30%, `--sheet-up` 0.04em, `--sheet-down` 0.21em, `--sheet-rise`
1.4em, the apex at (1005, 325) in container units (on the headline's second
baseline, 24px clear of line 1), the feet at 850 and 1160 and the datum at 708, the
arcs' radii 118, 215 and 312, the grid's origin. The generator is `tools/sheet-art.js`
(it reproduces the shipped pair); its numbers also live in the sheet block and in the
sheet's guard, `bg-sheet.js`.

*Dial* (`dial`; two assets, 1200px and up). Two pseudo-elements of `.hero__h1`.
Grating A (`::before`, `assets/bg-dial-a.svg` as a mask over `--text-muted` at 68% plus
a 2 degree `--text-accent` wedge for the index) is still; grating B (`::after`,
`assets/bg-dial-b.svg` over `--text-accent` at 78%) has a pitch 2 percent finer, and
the `bg:dial` block in `hero-bg.js` turns it about the circle's centre by -1.364 to +1.364
degrees (`GAIN` = 6 / 252 rad, 6px of rim travel; `SLEW` 0.35 of the travel per frame)
through one paused Web Animation scrubbed with `currentTime`, so the beat slides about
51 times as far. A pointer move schedules a frame; nothing loops, nothing runs at rest;
touch, reduced motion and the arc being under the glass header leave B alone. The
theme toggle fires one 500 ms sweep on the same terms (a mouse or trackpad, not under the
header): out to the far end in 150 ms at no more than the pointer's per-frame limit, then back. Placement comes from the layout: the registered
`--dial-lh` (`1lh` on the headline) gives `top: 1.12lh + 24px`, and
`left: max(56ch + 24px, content - 186px + 4px)` in the lede's font; no keep-out
constant. Off under forced colours, more contrast, reduced transparency and print, and
below 1200px. Hand-fitted: box 186 x 447px, circle centre (270.2, 223.5), bezel radius
252px, sweep 130 degrees, pitch 1.5 degrees, ratio 1.02 (beat 76.5 degrees, gain 51x).
They live in three places that must change together: `tools/dial-masks.py` (which
prints them and reproduces the shipped pair), the dial block in `hero-bg.css`
(`--dial-w`, `height`, `--dial-ox`, `--dial-oy`) and `BEZEL` in the `bg:dial` block of
`hero-bg.js` and in `bg-dial.js` (with `BOX_W`, `BOX_H`, `OVERHANG` there); rename the two
masks when regenerating, they are cached under fixed URLs. `bg-dial.js`.

*Iris* (`iris`; no asset: inline SVG in `index.html`, 1280px and up). Two svgs in one
2000-unit frame whose outer ring has a radius of 1000 units: the still (disc, bezel
band, 72 minor and 12 major ticks, a lit bronze arc ending in an index mark at 296
degrees) and the inner dial (pupil, tick ring, ring, sweep arc). `hero-bg.css` says what
1000 units is in pixels (`--iris-r: 400px`) and hangs the block on the clients rule
(`bottom: 100%` of `.clients`, cut by it, a 1px border in the rule's colour carrying the
rule to the window's edge). Its left edge is the furthest right of `100% - --iris-bite`
(285px), the lede box's right edge plus a page margin, and the place where it bleeds
`--iris-bleed` (330px) off the window's right edge; `--iris-lift` (135px) is the centre's
height above the rule. Those four numbers and the index angle are hand-fitted (the
tightest case is the full stop of line 1 in Forest at about 116 percent text zoom). The
`bg:iris` block in `hero-bg.js` decides in the blocking head (home page, English, no reduced
motion, 1280px and wider, no forced colours, no more contrast, no reduced transparency,
`vynatix-bg-iris` unset) whether the opening can happen and puts `iris-armed` on
`<html>`, which hides the inner dial; after 20 s without key, pointer, scroll or touch
input, with the art's top 8px clear of the header and at least half of it in view, it adds
`iris-play` (one 3.6 s transform and opacity animation of the inner dial, `will-change`
only while it plays) and writes the flag; any input, or reduced motion switched on, ends
it at once with `iris-done` and the settled dial stays; a hidden tab or an off-screen
page holds it. The settled still is what shows without script, under reduced motion and
in every later view of the visit. Off under forced colours, more contrast, reduced
transparency and print, and below 1280px. `bg-iris.js`.

**The headline copy drives the geometry, and the guards say when it moves.** None of
the four is placed with pixels from the page's corner: each hangs on the layout of the
hero as it is (the end of the headline's first line, the lede box's right edge at
`56ch` in the lede's face, the container's edges, the clients rule). The headline is
"Your in-house software team." with the italic "Without the hiring.", 96px from about
1200px up. In Forest (Fraunces) line 1 runs the container's width, so the art lives in
the column below it; in Teal and Monochrome (Instrument Serif and Geist at `18ch`;
measured, Teal wraps like Monochrome) the roman row wraps to two lines and the headline
is three lines long, so the art starts at the end of the first line's box, wherever that
is. The constants listed above were fitted to this copy in all three faces: they keep
the art 24px or more from the text, keep the contrast behind the text equal to the plain
page's, register the sheet's rules to the glyphs and place the dial and the iris.
**A change to the headline, the lede (its words or its measure), the hero's spacing, the
clients row or a typeface can move the art into the text.** Run `npm run check:bg` after
any such change: the guards fail and name the rule (clearance, contrast, registration,
geometry or placement), and the constants of that background are the ones to refit.

**Guards.** `tools/verify/bg-draw.js` proves the draw (odds over fresh visits, a stable
visit across pages including `sv.html`, a bad stored value discarded, blocked storage
gives the sheet with no error, no JavaScript gives no attribute and the sheet's pixels,
`data-bg` set before the body exists) and what keeps the four apart (each background's
files requested only by it and only at the widths it applies to, the scripts' calls
compared with the sheet's, storage keys against `privacy.html`, the iris test hook, other
pages pixel-identical in all four draws, the fenced blocks, scoping and role-token rules).
`bg-weave.js`, `bg-sheet.js`, `bg-dial.js` and `bg-iris.js` each pin their own background
and re-prove clearance (the nearest art ink is 24px or more from any text line box, button,
header link or the clients row, with text-only zoom emulated), contrast (the pixels behind
every hero text box with the text hidden: 4.5:1, 3:1 for the headline, no lower than the
plain page's own by more than 0.1 except where the art is meant to sit under text) and the
placement of that background; the dial's guard also proves its motion, the iris's its
placement against the lede, the italic line and the bleed. All are in `npm run check`
(`npm run check:bg` runs these five alone). `a11y.js` adds the reduced-motion proof for all
four (nothing animates, by CSS or by the Web Animations API, and the iris is not armed).

**Bronze budget.** The hero already spends Bronze (the accent text colour) on the italic
line of the headline. The sheet adds a bronze second baseline under it, a measured edge and
an apex mark; the dial adds the whole B grating at 78% accent and the index; the iris adds a
lit arc and an index mark; the weave's ink is `tertiary` mixed 45% into the ink, a warm tone
rather than solid Bronze. The owner accepted this. If one Bronze moment per hero is wanted
instead, the dial's fallback is B in the muted colour at another alpha with the index alone
in bronze (its bands then read by density only); then re-run the guards.

**Measured costs and known limits** (an independent verification of the four draws together;
Chromium only, no Safari, Firefox or real devices). Every draw is pixel-identical to a build
with the other three removed, and the other pages are unchanged (19 were measured;
`integritet.html` came later and links neither file). The price: `hero-bg.css`
and `hero-bg.js` are 8.6 and 7.0 KB gzip, paid by the home page only (about 17 KB with the iris
block in `index.html`); every other page carries only the draw in `app.js`, +672 B gzip
(+1.7%). They were first built into `styles.css` and `app.js`, and that cost every page 14.5 KB
gzip: on a cold cache over slow 4G with the CPU throttled 4x, the first and largest paint of a
page other than the home page rose by 64 to 100 ms, about half from the render-blocking CSS and
half from the script, which is why they are separate files. The home page also pays 50 to 95 ms
on a desktop at 4x CPU in the two draws that fetch masks (sheet and dial). Where art passes
under the glass header on scroll, a single link or button can lose up to 3.7:1 of contrast (the
weave: 13.35 to 9.64), never below 5.35:1. With web fonts delayed by 2.5 s the weave and the
iris raise cumulative layout shift by about 0.01 (0.036 to 0.050 and 0.047), because both are
placed from text metrics. The dial's and the iris's animation layers re-rasterise the unrelated
client logos by one anti-aliasing step, which cannot be seen. The sheet's headline guides come
within about 30px of the lede at the nearest row guide, and its art within 41.5px of any text.

**Adding or removing one.** To add: give it an id and copy the pattern above: a `bg:<id>`
block in `hero-bg.css` and one in `hero-bg.js`, assets named
`assets/bg-<id>-*.svg` (new names, never reused), markup (if any) fenced like the iris's,
the id in `BGS` in the draw in `app.js` (the odds become 1 in five) and in `ALL_BGS` in
`tools/verify/_common.js`, a `tools/verify/bg-<id>.js` in the style of the others (it skips
itself unless `BGS` includes the id), a row in `check:bg` in `tools/package.json`, its
paragraph here, its lines in `accessibility.html` and, if it stores anything, `privacy.html`;
then `npm run stamp` and the `mod` dates. To remove: delete the same pieces. The fenced
blocks come out mechanically:

```sh
sed -i '/^\/\* bg:iris:begin \*\/$/,/^\/\* bg:iris:end \*\/$/d' hero-bg.css
sed -i '/^\/\/ bg:iris:begin$/,/^\/\/ bg:iris:end$/d' hero-bg.js
sed -i '/<!-- bg-iris:begin/,/<!-- bg-iris:end -->/d' index.html     # the iris only
```

then take the id out of `BGS` (app.js), `ALL_BGS`, `check:bg`, the assets, the guard, the
lines in `accessibility.html` and `privacy.html`, run `npm run stamp`, and move the pages'
`mod` dates. The header comment of `hero-bg.css` and of `hero-bg.js` names no single
background and stays until the last one goes, and with it the two files, their two tags in
`index.html`, and their entries in `stamp.js` and `stale-cache.js`. Without the sheet's block
the no-script page has no background at all.

**Shared chrome is duplicated, not templated.** The `<header>` and `<footer>`
(and the inline `<svg class="svg-defs">` that defines the wordmark `<symbol>`
both of them place with `<use>`) are copy-pasted into every page. **A change
to nav links, the logo, or the header's contact details or addresses must be
applied to all `*.html` files.** The footer's source is the `FOOTER` template
in `tools/seo-head.py`: a footer change is made there and the script run, which
writes it into every page, not made by hand in twenty-one files. The Legal list
in it carries the "Cookie settings" link (`data-consent-open`), which reopens the
consent bar. Set `aria-current="page"` on the current page's nav link. The header is the system's TopAppBar: a floating Liquid
Glass bar (`.site-header`) whose links take the 2px `--indicator` underline
when current, one small primary button and two icon buttons.

**JavaScript** is plain ES5-flavoured vanilla JS in self-contained IIFEs, each
guarded so a missing element is a no-op. Every page loads `app.js` from the
`<head>`, and `app.js` is the only script on every page but the home page, which also
loads `hero-bg.js` (the hero backgrounds): there is no CDN or animation stack. `app.js`
has four features: the theme (the per-visit draw and the toggle), the hero background
draw, the mobile nav, and consent for Google Analytics (see *Analytics*). The small
script of each background that needs one is in `hero-bg.js` (see *Hero backgrounds*).
The only third-party script that can ever run is Google's `gtag.js`, which the consent feature
injects itself, only once a real Measurement ID has been set and only for a visitor
whose answer is Accept: on the press, or on a later page load while a stored `granted`
answer is still valid. **Nothing on the site moves
on its own, with one exception:** the iris background (one visit in four) opens
its inner dial once per visit, after 20 seconds without input, in 3.6 seconds,
and any input ends it at once. What else moves answers the visitor: short
transitions on hover and focus, and the dial background, which turns a few
pixels with the pointer (and once, for half a second, when the theme toggles).
The design system forbids auto-advancing strips and ambient loops on content
surfaces, so the former client marquee is a still list (`.clients__list`) and
the former case reel is a grid of cards; the iris is a single event, not a loop,
and an owner decision for the hero. Its limits (3.6 s, once per visit, any input
ends it, absent under reduced motion) are part of that decision: do not loosen
them. Reduced motion removes all of it.

The Content-Security-Policy (a `<meta>` tag in every page's `<head>`) pins
`script-src` to `'self'` plus the single path `https://www.googletagmanager.com/gtag/js`,
`connect-src` to `'self'` plus three Google analytics hosts, and `style-src`,
`font-src` and `img-src` to `'self'` (and `data:` for images), so **any other
third-party script, inline style or font CDN is still blocked by default**. The
exact string is in `EDGE-SETUP.md`, section 3.

**The Google entries are a recorded security downgrade** from the earlier
`'self'`-only policy. The owner accepted it for Google Analytics behind consent,
and `SECURITY-ASSESSMENT.md` (Round 6) records what it costs: the wildcard
`connect-src` hosts are a generic exfiltration channel to any Google Analytics
property, and, because a `<meta>` policy cannot depend on consent, the policy
reaches every visitor whether or not they accept. Do not widen it further to make
a measurement work. A violation names the one host that is missing; add that host
by name, never `https://*.google.com`, `'unsafe-inline'` or `'unsafe-eval'`.

**The policy lives in three places that change together:** the `<meta>` tag on
all 21 pages, the string in `EDGE-SETUP.md`, and the Transform Rule in the
Cloudflare dashboard if the edge is live. If it is live, widen the dashboard rule
**first**: the browser enforces the meta and the header independently, so a
narrower header silently blocks Google Analytics, while a wider one is bounded
by the meta. `tools/verify/csp.js` keeps the pages and `EDGE-SETUP.md` in step
(and allows Google hosts only from its list); `headers.js` checks the live
header. Any new third-party script, or any other host, still means widening the
CSP deliberately on **every page** and in `EDGE-SETUP.md`, and updating this file.

**Progressive enhancement / accessibility** is a real constraint here, not an
afterthought — preserve it:
- No-JS users get the fully visible final state; nothing is hidden pending JS.
- **Controls that need JS must not sit dead without it.** The pattern is to
  hide them in CSS and let `app.js` opt in by adding a class to `<html>`:
  `.js-nav` for the collapsible mobile nav (without it the nav stays visible
  and wraps under the bar) and `.js-theme` for the theme toggle (it keeps its
  place but is invisible until it can work). The consent module follows the same
  rule by building its markup only when it can work: the bar and the in-page
  panel do not exist without JavaScript, with blocked storage, or while the ID is
  the placeholder, and the footer's "Cookie settings" link is then a plain link to
  the notice. It adds `js-consent` to `<html>` once active (a test hook and a
  guard against a second copy of the script; no CSS depends on it) and
  `consent-open` while the bar is on screen (the bottom reserve in `styles.css`
  depends on that one).
- Motion is short transitions on hover and focus, the dial background's response
  to the pointer and the iris background's single opening (see *JavaScript* and
  *Hero backgrounds*). The system's `prefers-reduced-motion` rule cuts the
  transitions to 0.01ms; the dial stops responding and the iris never opens.
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

**Largest contentful paint.** On every page the LCP element is the opening
paragraph (the hero lede, or the page hero's). It paints in the fallback face as
soon as the stylesheets arrive, so `font-display: swap` keeps fonts out of the real
LCP: measured on a throttled phone, LCP equals first paint on all 20 pages. What is
left is render work and, in Lighthouse's simulated score, font bytes.

- On the two home pages `.hero ~ section` carries `content-visibility: auto`
  (`styles.css`, *Sections*), which takes about 100 ms off a throttled phone. Do not
  widen it to the inner pages without checking: axe-core misreads the background
  behind text in a skipped section, and Lighthouse accessibility fell from 100 to
  92-96 on those pages. `screenshot.js` shows every section before it captures, so
  the visual gate compares the design and not the browser's remembered heights.
- Lighthouse's simulated LCP counts the fonts that finish before first paint.
  Forest and Monochrome fetch about 280 KB of Fraunces for the hero headline (Teal
  about 45 KB of Instrument Serif), so PageSpeed Insights shows a worse LCP when
  they draw: in single live runs about 3.0 s (Forest) and 2.1 s (Monochrome)
  against 1.6 s (Teal). Closing the gap means re-cutting the Fraunces files, which
  is a typography decision (see *Assets*). Dropping the preloads and moving `app.js`
  above the stylesheets were both measured and gained nothing.
- Inline critical CSS is not an option: `style-src 'self'` forbids it.

**Search, AI engines and structured data.** The site is written to be found and
quoted by search engines and AI assistants (ChatGPT, Perplexity, Claude, Google AI
Overviews and AI Mode, Microsoft Copilot), and every page carries the same
machinery in its `<head>`, between `<!-- seo -->` and `<!-- /seo -->`:

- one `<link rel="canonical">` (`https://vynatix.com/` for the home page, otherwise
  `https://vynatix.com/<file>.html`, the form the internal links use), one
  `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">`,
  and Open Graph tags whose title, description and URL repeat the page's own
  `<title>`, meta description and canonical, plus `twitter:card`, `twitter:title`
  and `twitter:description`, the last two carrying exactly the strings `og:title`
  and `og:description` carry;
- for a page with a twin in the other language, `hreflang` links to both versions
  and `x-default` to the English one, reciprocal on both pages and mirrored in
  `sitemap.xml`;
- one JSON-LD block (`<script type="application/ld+json">`: a data block, never
  executed, so `script-src 'self'` does not apply and the CSP needs no change)
  holding a `@graph` with the full Organization node (`@id`
  `https://vynatix.com/#organization`), the WebSite node, the page itself with its
  `datePublished` and `dateModified`, and page-specific nodes (FAQPage, Service,
  ItemList, Article). The Service and ItemList nodes are written once, in
  `tools/seo/<page>.json` of the page that owns them (`extra_nodes`); a page that
  shows the same node borrows it with `extra_nodes_from`, either one file name
  plus `ids` or a list of `{"file", "ids"}` objects when the nodes come from more
  than one file (the home page takes its three Service nodes from `services.json`
  and the ItemList of the projects from `work.json`). An id the file does not have
  stops `seo-head.py`.
  **Keep the Organization node identical on every page** and true to the site:
  the relationship to Ultra Group is `memberOf`, matching the footer's "Part of
  Ultra Group"; do not change it to `parentOrganization` unless Bolagsverket shows
  Vynatix AB in an Ultra Group koncern.
- Every page node carries `datePublished` (the date the page first went live;
  it never moves) and `dateModified`, repeated as
  `<meta property="article:published_time">` and
  `<meta property="article:modified_time">` (date-only ISO) and, for
  dateModified, as the sitemap `<lastmod>`. Both dates live in the page's entry
  in the `PAGES` registry of `tools/seo-head.py` (`pub` and `mod`), and the
  script writes all three places from that one value. **When you change a
  page's content, move `mod` there, run `python3 tools/seo-head.py`, and run
  `npm run stamp` if styles or scripts changed too.** Guides also carry a visible
  "Publicerad"/"Senast uppdaterad" line; keep it in step.
- A visible FAQ is marked up with `data-faq` on its container, which (or an
  ancestor) carries an `id`, and `data-faq-item` on each question: one `<h3>`,
  then the answer in `<p>` and `<li>` elements, flat (no `<p>` inside an `<li>`,
  no nested list); items of an `<ol>` are numbered "1. " in the data. The FAQPage
  is its own node in the graph (`@type` the plain string, `@id` the page URL plus
  the container's fragment, `isPartOf` the page, which names it in `hasPart`) and
  repeats the questions and answers word for word. The node is for AI auditors
  and extraction pipelines, which walk the graph and string-compare `@type`;
  Google restricted FAQ rich results to government and health sites in 2023 and
  stopped showing them altogether on 7 May 2026 (Search Central changelog,
  entries of 8 May and 15 June 2026), and FAQPage remains valid schema.org. Edit
  markup and data together: the head is regenerated by `tools/seo-head.py`, not
  hand-edited (run it after editing a FAQ).
- `tools/verify/seo.js` (part of `npm run check`) enforces all of the above, plus
  the copy rules below on visible text.

**One sentence about the company**, used verbatim wherever a page introduces it
and in the JSON-LD description, so every source an engine reads agrees: "Vynatix
AB is a software consultancy in Gothenburg, Sweden, founded in 2023 and part of
Ultra Group. Our senior engineers work as part of client organisations on Android
Automotive, AI engineering and cloud platforms, with Volvo Trucks and Volvo Cars
among our clients." (Swedish: "Vynatix AB är ett mjukvarukonsultbolag i Göteborg,
grundat 2023 och en del av Ultra Group. Våra seniora utvecklare arbetar som en del
av kundernas organisationer inom Android Automotive, AI och molnplattformar, med
Volvo Trucks och Volvo Cars bland kunderna.") If a fact in it changes, change it
everywhere, including LinkedIn, the registries and `llms.txt`.

**Swedish pages** set `<html lang="sv">` and keep the shared English header and
footer, which carry `lang="en"` so screen readers switch voice; only the skip link
is translated, and, while the consent module is active, the footer's "Cookie
settings" link, which it relabels "Cookie-inställningar" (with `lang="sv"` and a
link to `integritet.html#cookies`) on any page whose `<html lang>` starts with
`sv`. Without JavaScript, or while the module is inert, the English link to
`privacy.html#cookies` stays. `integritet.html` is the Swedish twin of
`privacy.html`, the fifth English/Swedish pair, and the Swedish consent bar links
to it. The footer's "På svenska" column (`lang="sv"`) links the Swedish
hub (`sv.html`), which links every Swedish guide in its `#guider` section, and
`integritet.html`, which is a notice and not a guide and so is linked from that
footer column (and by the Swedish consent bar), not from `#guider`. On a Swedish
page the footer's Legal column therefore deliberately holds one Swedish item, the
relabelled "Cookie-inställningar" link, among English ones ("Privacy", "Terms",
"Accessibility"); the shared footer is English by design, and the link has to match
the Swedish bar and notice. Without JavaScript it reverts to English. The
two home pages are not mirror images: the comparison list in Who we are and
the Further reading section exist only on the English home page (sv.html has the
Guider section instead). The Further reading items on index.html repeat the
linked pages' `<title>` (without the brand suffix) and meta description word for
word; when one of those changes, change the home page item with it. Write
Swedish as Swedish (the reader is "ni"), not a translation of the English page.

**The list pages** (`konsultbolag-android-automotive-goteborg.html` and its English
twin) name other companies. Every entry quotes the firm's own website or a job ad
it posted, with the source linked and the date it was checked; the order is
alphabetical; a disclosure says Vynatix compiled the list and is on it. Re-check
every entry at least twice a year, update the "Kontrollerad" dates and
`dateModified`, and act on corrections sent to front.disk@vynatix.com. Never rank,
rate or describe a competitor beyond what its own site says.

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

## Analytics

Google Analytics 4 is built into the site, off by default and behind consent.
This section holds the working rules. The reasoning and the cost are in
`SECURITY-ASSESSMENT.md` (Round 6); the hard gate for switching it on is
`tools/PRE-FLIP-CHECKLIST.md`.

**What exists.** The fourth IIFE in `app.js`, after the theme, the hero background
draw and the mobile nav.
When active it shows a compact, non-modal bar fixed to the bottom of the viewport
on a first visit (`#consent-bar`: two buttons with the identical class string,
Decline then Accept, so neither is favoured); reopens it from the footer's
"Cookie settings" link (`data-consent-open`); and fills the in-page panel on the
two privacy notices (`[data-consent-panel]`, a later sibling of the `#cookies`
heading in the same section) with the same two buttons. The wording is the `COPY`
object in `app.js`, in English and Swedish, and has to stand on its own (a cached
notice can sit beside a newer bar for minutes) while still naming Google, the
cookies, who is counted and how to change the choice. The styles are the *Consent* section of `styles.css`; its bottom
reserve is in `rem` so it grows with the text size, and that reserve and the
buttons' `7rem` minimum width are the lengths there that are not on the spacing
scale.

**Two switches: `GA_ID` and `PURGE_ONLY`.** `var GA_ID = 'G-XXXXXXXXXX';` is the
first line of that IIFE and the only place the Measurement ID exists (it must stay
a single match in `app.js`; the tests rewrite it by pattern and fail on none or on
two). While it is the placeholder, any run of X characters after `G-`, or anything
that is not `G-` plus 6 to 12 capitals or digits, the block returns before doing
anything: no markup, no storage read or write, no listener, no class on `<html>`,
no cookie deletion, and the footer link stays a plain link. Shipping with the
placeholder is the normal state of the branch. The ID is public by construction,
so it may be committed. `var PURGE_ONLY = false;` sits beside it, the emergency
stop described under *Cookies and withdrawal*. It is `false` in every state except
an exit in progress, and it too is a single match in `app.js`: the tests normalise
it by pattern, so the suite passes in the exit state, and the release gate refuses
to pass unless it is `false`.

**Flipping it on.** On the day of the flip, set the visible "Last updated" line in
`privacy.html` and the "Senast uppdaterad" line in `integritet.html` to that day,
set their `mod` in the `PAGES` registry of `tools/seo-head.py` to the same day, and
run `python3 tools/seo-head.py`. Then edit the `GA_ID` line (a re-flip after an
exit also sets `PURGE_ONLY` back to `false` in the same commit), run
`cd tools && npm run stamp` (`app.js` changed, so every page's stamp moves), then
`node verify/release-gate.js`, then `npm run check`. The flip is the last commit of
the one PR. It changes the `GA_ID` line (and, on a re-flip, `PURGE_ONLY`), those two
dates (the visible lines and `mod` in `tools/seo-head.py`), the files `seo-head.py`
writes from them (the notices' `dateModified` and `article:modified_time`, two
sitemap `<lastmod>` lines) and the stamps, and nothing else. It is made only when
`tools/PRE-FLIP-CHECKLIST.md` is complete.

**The release gate.** `release-gate.js` fails on: a placeholder or malformed ID;
any `[[CONFIRM` marker on a notice; a draft banner that is still on a notice (it is
removed only on counsel's written sign-off); a marker on a page that no longer has
a banner; an unticked box in sections 1 to 9 of the checklist, or a blank field in
its header block or sign-off block; `PURGE_ONLY` anything but `false`; a policy
constant that is not the documented one (`COOKIE_MAX_AGE` 31536000,
`CONSENT_MAX_DAYS` 365); notices that do not say "12 months" / "12 månader" or do
not name the three storage keys in `<code>`; a notice date that is not fresh (the
visible "Last updated" date must equal `mod` in `tools/seo-head.py`, and that date
must be at most 14 days old); a page without the Cookie settings link in its
footer; a CSP that differs between pages or from `EDGE-SETUP.md`; and any sentence
that still says the site has no analytics or no cookies. When every scripted gate
holds it prints `scripted gates pass, N human gates open` and exits 0, never a bare
PASS: N is the number of gates it lists that only a person can pass, which the
checklist's boxes cover with evidence. It is deliberately **not** part of
`npm run check` (which stays green with the placeholder, and in the exit state),
but its `--self-test` is, and so is `publish.js`.

**Switching it off again** is not the reverse of the flip. The first action of an
exit is `PURGE_ONLY` set to `true`; the `GA_ID` revert comes last, once the purge
has run. The exit runbook is section 10 of `tools/PRE-FLIP-CHECKLIST.md`, and every
other document points there instead of repeating the steps.

**Google is never requested before consent.** No script, `preconnect`,
`dns-prefetch`, `preload`, `prefetch`, image, font or beacon to a Google host, in
markup or from script, until the stored choice is `granted` or the visitor has
just pressed Accept. This is Consent Mode "basic": nothing is sent before the
choice, not even a default consent state. After Accept the module sends the
consent default (all four consent parameters denied), injects the one
`gtag.js?id=<GA_ID>` element, sends `js`, updates `analytics_storage` to granted
and runs `config` with Google Signals and ad personalisation off and
`cookie_expires` of 365 days (this site's own setting, not Google's default of two
years). A returning visitor whose stored answer is still `granted` gets the same
sequence on page load, without a press. Do not add a Google host to any `<link>`
anywhere in the pages, and do not set `anonymize_ip` or `client_storage`.

**The stored choice.** `vynatix-consent` in `localStorage`, beside `vynatix-theme`
and `vynatix-look`, holds one plain string, `v1:granted:YYYY-MM-DD` or
`v1:denied:YYYY-MM-DD` (the UTC date of the click). It is valid for 365 days, then
the bar asks again. It is parsed with an exact pattern and must be a real date,
not in the future and not expired; anything else (a wrong version, an impossible
date, `__proto__`, markup) counts as no choice, which fails closed. Nothing writes
the key except a click on Decline or Accept, and browsing is never consent. If
storage cannot be read there is no bar and no analytics, and if a write does not
stick the choice is treated as denied. Bump `POLICY_VERSION` when the wording of
the choice changes in a way that should lapse old answers.

**Cookies and withdrawal.** Google sets `_ga` and `_ga_<container-id>` (the suffix
is the property's Measurement ID without `G-`). `cookie_expires` is configured to
expire the cookie at most 365 days after the last hit (`COOKIE_MAX_AGE`, which
equals `CONSENT_MAX_DAYS` in days). Whether a later hit moves the expiry is an
observed fact the checklist asks for (3.4); if it does, a visitor who accepts and
never returns can hold the cookie up to a year past the consent record, and a later
visit deletes it only while the module is active. Decline and withdrawal set
Google's own `ga-disable-<ID>` flag, send `analytics_storage: denied`, and delete
every cookie named `_ga` or starting `_ga_` for the host and every parent domain at
once and, while the page is still not granted, again a second later and on
`pagehide`. A load with no choice or a denied one deletes them too. No other
cookie is touched. The stored choice is read again on `pageshow` after a
back/forward-cache restore, on `visibilitychange` and on `storage`, so a restored
page or another tab follows a withdrawal. A bare revert on the server cannot reach a
tab that has already loaded `gtag.js`; it measures until it is reloaded or until
`PURGE_ONLY` is set to `true`, which measures nothing for anyone, deletes the `_ga`
cookies on every load and removes the stored choice, so the `storage` event stops
open tabs too (the exit runbook, section 10 of `tools/PRE-FLIP-CHECKLIST.md`).
Reverting `GA_ID` to the placeholder only makes the block inert; it does not clean
up, which is why it is the last step of an exit and never the first.

**Property settings that live outside the repo.** Nothing in the repo can see
these, they can drift, and each is evidenced in the checklist and re-checked every
quarter: Google Signals off; ad personalisation and Google data sharing off; event
data retention 2 months; Enhanced Measurement decided, with outbound clicks and
file downloads off (the list pages name other firms, and an outbound-click event
would record which one a visitor followed); an internal-traffic or Exclude
hostname filter so local and developer visits do not count, and **no** Include
hostname filter until it has been tested in DebugView (Google's release note of
2026-09-21 says Include filters block events with an empty hostname, and the
effect on web streams is unclear); and a lookup and a deletion by client ID tried
in the property with the procedure written down, because both notices promise it.

**Facts only a human can supply.** The notices carry five visible `[[CONFIRM: what
is needed]]` markers each, each wrapped in `<mark class="draft-marker">` so it
shows on screen (the literal text is unchanged, so the gate's pattern still
matches): the observed cookie names, domain and lifetime; the retention setting in
the property; which Enhanced Measurement events remain; Google's contracting
entity, the entity that receives the data in the United States and its Data Privacy
Framework listing check; and the client-ID lookup test. Never fill one in from
memory or from this file. Resolve it from evidence; the release gate refuses to
pass while any remains. The legal text is a draft for counsel and says so on the
page; the banner stays until counsel's written sign-off.

**Checks.** `csp.js` (the CSP is identical on all 21 pages, matches
`EDGE-SETUP.md`, and names only the allow-listed Google hosts; a Google host in any
`<link>` or `<script>` on any page is found whatever the quoting or attribute
order), `publish.js` ("what ships": every root `*.html` is in `PAGES` and every
`PAGES` entry exists; every other root file that is not a page or a listed asset
type, and every directory other than the known ones, is named in `_config.yml`'s
`exclude` or flagged; every footer carries the Cookie settings link with
`data-consent-open` and `href="privacy.html#cookies"`; the notice link in `COPY`
points at the right notice page; both notices name the three storage keys in
`<code>`; the site's style rules are linted (role tokens only: no colour literal in
`styles.css` outside the token files, and no inline style in a page or from
`app.js`); and `llms.txt` links every URL in `sitemap.xml`), `consent.js`
(behaviour: nothing before consent, accept, decline, withdrawal, poisoned and
blocked storage, no-JS, Swedish, and the `PURGE_ONLY` build), `consent-layout.js`
(bar size, the open menu over the bar, focus never hidden behind the bar, six
themes), `release-gate.js` (above) and `consent-live.js` (opt-in; real network;
the dummy ID `G-TEST000000`, never a real property). In
`tools/verify/_common.js`: `pinConsent` pins a stored choice the way `pinTheme` pins
a theme, `armGa` arms a page so the module is active under test (the placeholder is
inert, so without it the axe, contrast, theme and screenshot checks would audit a
page with no bar; it also normalises `PURGE_ONLY` to `false`), and `rewriteGaId`
rewrites the `GA_ID` line by pattern and fails loudly on no match or more than
one. A pass with the dummy ID is not a pass with the real one; see the checklist.

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

The sheet and dial hero backgrounds draw from four alpha-only SVG masks,
`assets/bg-sheet-art.svg`, `bg-sheet-edge.svg`, `bg-dial-a.svg` and
`bg-dial-b.svg` (generators in `tools/`, see `assets/AGENTS.md`); they are
requested only when their background is drawn.

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
preloads the drawn direction's display face and its italic (Fraunces for
Forest, Instrument Serif for Teal, Geist and Fraunces italic for Monochrome),
one for each line of the hero headline. Instrument Serif and JetBrains
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
  and what is in the repo ships verbatim. The one exception is `tools/`: the
  optional local verification scripts (Playwright) and `stamp.js`, which writes
  the version stamps into the pages and which you run before committing a change
  to any of the six stamped files, `seo-head.py` (Python 3, standard library),
  which rewrites the search block in every head, the footer and `sitemap.xml`
  from one registry, the two mask generators of the sheet and dial hero backgrounds
  (`sheet-art.js` in plain Node, `dial-masks.py` in Python 3, neither with
  dependencies), and `indexnow.js`, which tells Bing and the
  other IndexNow engines which pages changed once a change is live. It is developer tooling only: excluded from
  the published output in `_config.yml`, with its `node_modules/` gitignored, and
  nothing in it runs at deploy time. The site itself stays hand-written.
- **"Passing" means:** the pages render correctly in light and dark, nav/footer
  are consistent across pages, behaviour degrades gracefully with JS off and
  reduced motion on, and there are no console errors. Check changes visually in
  both themes. `tools/README.md` documents the repeatable checks — a visual
  regression gate (`screenshot.js`), an adversarial CSP test (`adversarial.js`),
  an off-origin request check (`requests.js`), the random-scheme check
  (`theme.js`), the version-stamp check (`stamp.js --check`) and its stale-cache
  proof (`stale-cache.js`), the search, structured-data and copy check
  (`seo.js`), the hero background draw and its isolation (`bg-draw.js`) with one
  guard per background (`bg-weave.js`, `bg-sheet.js`, `bg-dial.js`, `bg-iris.js`),
  the accessibility suite with its contrast sweep (`a11y.js`), the static CSP sync
  (`csp.js`), the "what ships" check (`publish.js`) and the consent behaviour and
  layout checks (`consent.js`, `consent-layout.js`). Two more run outside
  `npm run check`: the release gate (`release-gate.js`, which must fail
  until analytics is switched on for real; only its `--self-test` is in the chain)
  and the opt-in live test (`consent-live.js`); see *Analytics*.
  A new page also goes into `PAGES` in `tools/verify/_common.js` and into
  `sitemap.xml`; `publish.js` fails if a root `*.html` is missing from `PAGES`.
  Because every visit draws its own scheme and its own hero
  background, the checks that need a particular look pin it first (`pinTheme` in
  `tools/verify/_common.js` sets the storage keys for the theme and for the
  background; the background defaults to the sheet and a pinned weave gets a fixed
  seed, so a caller that forgets still gets the same page every run; `pinBg` pins
  the background alone, `pinConsent` pins the analytics choice, and `armGa` arms
  the consent module for checks that audit the bar). Before changing a component,
  sweep all six themes:
  `THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark`. `BGS` does the
  same for the four backgrounds in the checks that visit the home page (default
  all four). Before changing the home hero, its copy, or the hero rules, run
  `npm run check:bg` and then the full sweep:
  `THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark BGS=weave,sheet,dial,iris npm run check:bg`.
- **Re-syncing the design system.** When the system changes, copy its
  `project/colors_and_type.css` over the local one as is, and its
  `project/tokens.css` over the local one keeping the local `@font-face`
  block; then regenerate any font, icon or logo files that changed, run
  `npm run stamp` in `tools/` (the pages' version stamps follow the files) and
  run the checks. Never edit those two files for a site-specific need: that belongs in
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
  must be added to that exclude list**, and `publish.js` fails when it is not. (The
  font and icon licence texts are published on purpose: they have to travel with the
  files.)

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
  confirmed rather than derived; add it to the footer on every page once
  known.
