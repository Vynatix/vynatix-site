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
index.html          Home — hero (with its drafting-sheet background), still client list, contents row,
                    services, three case cards, the partnership band, people,
                    insights, CTA band
about.html          About: what we stand for, people
services.html       AI engineering, cloud platforms, application development
industries.html     Four industries, mobility last
work.html           The three cases ("Cases" in the menu), team projects and libraries
membership.html     Career ("Career" in the menu; the file name stays): the page for senior
                    engineers and designers, in the recruit voice, with the rate calculator
contact.html        Two-inbox contact page (no form — mailto links), how we start, and the
                    common questions (the site's English FAQ)
blog.html           Insights ("Insights" in the menu; the file name stays): a hand-written list of
                    the guides, in English and in Swedish
privacy.html        Privacy notice (GDPR Art. 13), with the analytics and cookies
                    section (#cookies) and the in-page consent buttons
terms.html          Website terms of use
accessibility.html  Accessibility statement
android-automotive-development.html   Android Automotive in Gothenburg (English twin of
                    android-automotive-utveckling.html)
ai-engineering.html AI engineering in Gothenburg (English twin of ai-utveckling.html)
choose-a-software-consultancy.html   How to choose a software consultancy: the English twin of
                    valja-konsultbolag.html, and the first post (kind='post')
android-automotive-consultancies-gothenburg.html  Withdrawn on 20 November 2026 (a stub; it was
                    a list of Gothenburg consultancies working on Android Automotive)
sv.html             Swedish home and hub for the Swedish pages (twin of index.html)
android-automotive-utveckling.html, ai-utveckling.html   Swedish twins of the two deep pages
valja-konsultbolag.html, platform-engineering.html, ai-assistent-interna-dokument.html   Swedish guides
konsultbolag-android-automotive-goteborg.html, ai-konsultbolag-sverige.html   Withdrawn on
                    20 November 2026 (stubs)
integritet.html     Swedish privacy notice, the twin of privacy.html (one of five
                    English/Swedish pairs); the Swedish consent bar links to it.
                    Twenty-four pages in total, three of them withdrawn stubs
robots.txt          Allows every crawler, names the AI search agents, points at the sitemap
sitemap.xml         Every page, its lastmod and its hreflang pair (written by
                    tools/seo-head.py from PAGES)
llms.txt            A plain-text summary of the company and every page, in both languages
es/ zh/ hi/ ar/     The generated languages (Spanish, Chinese, Hindi, Arabic): the English pages rebuilt by
                    tools/seo-head.py from the catalogues in tools/i18n/. Never edited by hand. Drafts: named
                    in _config.yml exclude until a language is set live (see Languages)
<32 hex>.txt        The IndexNow key file (tools/indexnow.js proves ownership with it)
tokens.css          Design system layer 1: the tokens, generated from the system's
                    tokens.json (colour roles for six themes, spacing, radii, type
                    scale, @font-face). Only the @font-face src lines are the site's.
colors_and_type.css Design system layer 2, verbatim: reset, semantic helpers,
                    .eyebrow, .btn, .card, .glass, .container, per-theme typefaces
styles.css          Layer 3, the site's own: page chrome and components on the roles
app.js              All client behaviour (vanilla JS, IIFEs, no modules): the theme,
                    the mobile nav, the silk background, the Career page's rate
                    calculator and analytics consent (see Analytics)
hero-bg.css         The hero background, the drafting sheet (only index.html links it), in the hero's unit
assets/             Logo files in Forest inks, inline-icon SVGs, self-hosted
                    photographs (jpg + webp), generated pictures (webp, light and dark), app icons, the masks of the
                    hero's drafting sheet (bg-sheet-*.svg) and of its four stages (stage-*.svg)
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
                    and the hero background guard), stamp.js (writes the ?v=
                    version stamps into the pages), seo-head.py (rewrites the search
                    block, header, footer, sitemap and URL lock, and builds the generated languages),
                    i18n.py (the translation engine) with the catalogues in tools/i18n/, and the sheet's
                    mask generator, sheet-art.js; NOT published, not part of the site
tools/PRE-FLIP-CHECKLIST.md   The hard gate for switching analytics on (not published)
tools/TAKEDOWN.md   Runbook for taking a page down; tools/urls.lock the append-only list of every URL ever
                    registered (written by seo-head.py); tools/CITATION-LOG.md the pilot's measurement
                    protocol and decision rule; none published
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
change any of the five files, run `cd tools && npm run stamp` and commit the
updated pages with the change.** `npm run check` (`node stamp.js --check`) fails
until you do, and `verify/stale-cache.js` proves, in a browser holding an old
copy of all five files under the plain URLs, that the stamped pages still come
out right (`ENGINE=webkit node verify/stale-cache.js` runs it in WebKit, the
engine iOS Chrome uses). A new page must load all four files; the stamp check
fails if it does not. One more file carries a stamp and is not shared: `hero-bg.css`,
the hero background, which only `index.html` loads (`stamp.js` and
`stale-cache.js` handle it, and the stamp check fails if any other page links it).

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
(`mono-light`, `mono-dark`). **The site shows Monochrome only** (an owner
decision of 17 November 2026; until then it drew one direction at random per
visit). The Forest and Teal blocks stay in `tokens.css`, which is read-only here,
but no page uses them. `app.js` is loaded in the `<head>`, without `defer`, so its
first block runs before the body exists and sets `data-theme` (and `theme-color`)
before anything paints; the CSP rules out an inline script, so a small blocking
first-party file is the way to avoid a flash of the wrong theme. The rules:

- Light or dark follows the visitor's toggle choice (`localStorage`,
  `vynatix-theme`, which stores `mono-light` or `mono-dark`) and, without one,
  `prefers-color-scheme`. Only the light/dark half of the stored id is read, and
  every id the toggle has ever stored is accepted, so a visitor who chose `dark`
  or `teal-dark` before the change keeps dark.
- If storage is blocked the page follows the system. Without JavaScript the
  markup's own `<html data-theme="mono-light">` is what shows, and the markup's
  `theme-color` is the Monochrome light canvas.
- The retired draw's `sessionStorage` key, `vynatix-look`, is never written;
  `publish.js` fails if a script uses it again or a notice still names it, and
  `theme.js` checks every visit.

The theme and the consent choice write two keys in the visitor's own browser,
and neither is sent anywhere: `vynatix-theme` (`localStorage`, light or dark,
written when the toggle is pressed) and `vynatix-consent` (`localStorage`, the
analytics choice, written when Decline or Accept is pressed; see *Analytics*).
Both notices name both keys and call the first a display preference; whether
that description is right, and whether the bar has to mention it, is for counsel
to confirm (`tools/PRE-FLIP-CHECKLIST.md`, 4.2). Nothing is written to
`sessionStorage`: the hero background draw that used it is retired (see *Hero
background*).
- On the home page `app.js` also preloads the two headline faces
  (`DISPLAY_FACES`: Geist and the Fraunces italic), so the hero is not blocked on
  a late font fetch. Other pages add no preloads.

What is Forest-only stays Forest: the logo files in `assets/`, the favicon and
app icons and the manifest colours (a follow-up for the owner if the brand marks
should go Monochrome too). The inline wordmark and every page colour follow the
theme. The dark theme is a parallel environment, not an inverted light one: the
inverse bands (`.inverse`: the CTA band, the editorial band, the footer) sit on
`md-sys-color-inverse-surface`, which is light in the dark theme.

**Liquid Glass.** The site follows Apple's Liquid Glass as far as the web allows (an
owner decision of 18 November 2026; a first pass on the 17th put frosted glass on the
content cards over a tinted backdrop, which Apple's own rules exclude, and was
replaced). One fenced block at the end of `styles.css`. The rules it follows:

- **Glass is the controls layer; content is never glass.** Pages, cards (`.panel`,
  `.metric`, `.case`) and the consent bar keep the system's solid surfaces.
  Only the header, its open menu and the outlined button are glass. The glass
  refracts the content that scrolls beneath it and the silk behind (*Silk waves*).
- **The header is a floating capsule in two layers**, both pseudo-elements under its
  content. `::before` is the lens: `backdrop-filter: url(#vx-lens)` bends the page at
  the capsule's rim through an SVG displacement map (`assets/glass-lens-wide.svg`,
  and `glass-lens-narrow.svg` with `#vx-lens-narrow` under 600px; red moves the
  sample along x, green along y, 128 is rest, and the filter stretches the map to the
  bar with `primitiveUnits="objectBoundingBox"`). `::after` is the body: a 10px blur,
  the system tint thinned to about 64%, a sheen and a lit rim. Only Chromium renders
  an SVG filter in `backdrop-filter`; Safari and Firefox paint nothing for the lens
  layer and still get the blurred, tinted capsule from the other, which is why the
  two are separate layers rather than one declaration.
- **The two `<filter>` elements are in the `.svg-defs` block of every page**, beside
  the wordmark `<symbol>` (copy-pasted, like it: change all 24 together). A
  fragment-only `url(#id)` in an external stylesheet resolves against the page, and
  the CSP allows the map as a same-origin image.
- **The header is not a backdrop root.** A stacking context alone is not one; only
  `filter`, `opacity`, `mask`, `clip-path`, `mix-blend-mode` or `backdrop-filter` on
  the element itself make one. Keeping the glass on pseudo-elements lets the open
  mobile menu, inside the header, blur the page as its own glass sheet (the regular
  blur and a tint about nine tenths opaque, so its links stay readable even where a
  browser fails to blur).
- **Controls are capsules** (`radius-full`): the header and every `.btn`. The filled
  button keeps its solid fill with a lit upper edge; `.btn--secondary` is clear
  glass. Without JavaScript under 905px the header is two rows tall and takes
  `radius-2xl` instead.
- **The glass does not move.** Apple's glass has travelling highlights and a tint that
  adapts to what is beneath it; here the rim and tint are still. (The silk behind the
  page drifts; that is its own decision, with its own pause control.)
- **Reduced transparency and print**: the lens layer goes, the body turns into solid
  `surface-container`, the menu and outlined button lose their blur. These are
  explicit overrides, because literal blur values and a tint thinned with
  `color-mix()` are not covered by the system's token swap.
- **Contrast**: `a11y.js` resolves header text against the canvas, not the glass. A
  composited measurement (labels made transparent, 5th-percentile pixel behind each
  label, every 37px of scroll down five pages, both themes, 1440 and 390px) gave a
  worst case of 5.2:1 for header labels and 11:1 for menu links when the block was
  added. `bg-*.js` hold the header over the hero art. Re-measure by hand when the
  tint, the blur or the map changes.
- **Known limits**: no refraction outside Chromium; headless Chromium at device
  scale 2 leaves part of a large backdrop blur unblurred in screenshots (scale 1 is
  correct), so judge blur on a real device.

**Silk waves.** Behind every page is a silk background whose folds are drawn live
(owner decisions of 18 November 2026: an ambient background, then "dynamic, not an
animated static image"). It is the site's one ambient loop. Two parts:

- **The still silk** (`styles.css`, after the Liquid Glass block): two fixed layers,
  `body::before` (lit folds, `surface-bright`) and `body::after` (shaded folds,
  `surface-container-highest` with 8% of `on-surface`), each shaped by a small image
  mask (`assets/silk-light.png`, `assets/silk-shade.png`, 480x300, written by
  `tools/silk-masks.js`; only the alpha is used) plus a 128px grain mask
  (`assets/silk-grain.png`) that dithers away colour banding. The canvas colour stays
  on `<body>`, so `a11y.js` still resolves the background behind text.
  `.section--surface` is 55% opaque so the silk runs through the tonal bands; cards,
  inverse bands and the footer are solid. **This is every state but one**: no
  JavaScript, reduced motion, forced colours, a stored pause, no WebGL, a lost WebGL
  context. They all paint the same pixels.
- **The live silk** (the fourth IIFE of `app.js`): when motion is wanted, a
  `<canvas class="silk-canvas" aria-hidden="true">` is inserted as the first child of
  `<body>` and a small WebGL fragment shader draws the folds on every frame the display
  offers (the owner asked for motion "fluent as liquid"; an earlier 30 fps cap read as
  stutter): two sine fields, lit where their sum is high and shaded where it is low,
  drawn in a space bent by three passes of warping, each finer and on its own slow
  beat, so the cloth swirls and pours instead of sliding past. Its three
  colours are read from the page (the body's background and the two still layers'
  own, parsed from `rgb()` or `color(srgb …)`) and re-read when `data-theme` changes,
  so it has no colour of its own. The last lines of the shader add up to one level of
  noise per pixel, which is its dither. Every time term is a whole multiple of one
  angle taken from the clock (a four-minute loop), so the pattern has no seam and
  carries on across pages instead of restarting. The drawing buffer is capped at 1.3
  million pixels and never uses the device pixel ratio. **It answers the visitor**
  (owner request): the cloth gives way softly around the pointer (a Gaussian press
  about a third of the view across, which also lifts the cloth into the light, so it
  shows on a flat stretch too) and rides with the scroll at about a
  fifth of its speed. Both are eased in the frame loop by elapsed time, so they feel
  the same at 60 and 120 Hz and nothing jumps; the
  listeners (`pointermove`, `scroll`, `pointerleave`, `blur`, all passive) exist only
  while the canvas does. Phone tilt is not used: it needs a permission prompt. The still layers are hidden
  (`.js-waves-live`), not removed, because the colours are read from them. Drawing
  starts after the page is up, never in the blocking head.
- **The pause control** is a `<button class="motion-toggle">` in the footer's Legal
  list (the `FOOTER` template in `tools/seo-head.py`), labelled "Pause background
  motion" or "Play background motion", hidden until `.js-motion` and absent under
  reduced motion and forced colours. Pressing it stops the frame loop, removes the
  canvas and shows the still silk. The choice is `localStorage` `vynatix-motion` (`off`
  or `on`; any other value means moving), named in both notices. **The loop and the
  button go together**: WCAG 2.2.2 requires a way to stop motion that starts by itself
  and lasts more than five seconds, and `accessibility.html` says where the button is.
  Where WebGL is refused the button is hidden too (no dead control); after a lost
  context it reads "Play" and starts a fresh canvas. A header placement would need
  pause and play icons from the design system's set, which has none today.
- **Checks.** Every check opens its pages with the pause stored (`stillSilk` in
  `_common.js` wraps `launch()`, and `pinTheme` stores it too): software WebGL
  is heavy enough to disturb timing tests, and a frame loop is what the at-rest tests
  forbid. `tools/verify/waves.js` alone asks for the live silk
  (`launch({ liveSilk: true })`) and covers: a first visit draws on every page; frames
  2 s apart differ visibly; no colour banding, live or still; the colours are the
  page's own in both themes and follow a toggle mid-run; with the clock frozen the
  picture holds, changes near the pointer and not at the far edge, and changes on
  scroll; the button stops and resumes
  by keyboard and the choice persists; reduced motion and a stored pause ask for not
  one frame; no JavaScript; the four still states are pixel-identical; poisoned and
  blocked storage; WebGL refused; a lost context. Text contrast was measured against
  composited pixels over the live silk (twelve pages, both themes, 1440 and 390 px):
  all at AA. The shader's tones are bounded by the same three colours as the still
  silk. Re-measure when a tone or the shader's mix changes.
- **Cost.** One full-screen fragment shader at the display's frame rate, plus the header's lens
  and blur re-running over it. Not measured on real devices; rAF stops in a hidden
  tab.
- **The home hero.** The silk runs behind the English home hero and its drafting
  sheet (owner decision). The sheet's guides are faint by design, and where a
  fold passes behind one it fades, in places entirely; that unevenness is accepted.
  `bg-sheet.js` therefore measures registration (R) with the still silk hidden
  (`hideSilk`); its clearance and contrast checks run with the still silk in the
  page. It never sees the live silk.
- **The hero buttons have their own layer** (`.hero__ctas .btn { will-change:
  transform; }`). Over a backdrop that is not flat, Chromium anti-aliases a capsule's
  edge against the true backdrop in one compositing path and against the flat canvas
  colour in another, and the path depends on what else is composited. The edge
  pixels then differ by 6 to 12 levels, a faint halo for a visitor (first caught by
  the guard of the iris background, since removed). A layer of their own makes it
  one path.
- **History.** First the still layers themselves were animated with `transform`: too
  slow to see at 84px in 38 s, then a visible circular drift, which the owner rejected
  as "an animated static image"; the shader replaced it. A tinted radial backdrop was
  tried on the 17th and failed the iris background's guard (the capsule-edge effect above). The masks
  were first SVGs, whose blur stalled a theme toggle for a third of a second.

**Hero background.** The English home page's hero carries one decorative background,
the headline's drafting sheet. It is art, not content: no text, role or focus,
`pointer-events: none`, an empty `content`, behind or clear of every text box, and off
under forced colours, more contrast and print. Until 20 November 2026 it was one of
four, drawn at random for each visit (a woven cloth, a vernier dial and an iris were the
others). The owner kept the sheet, and the other three went with everything the draw
needed: `data-bg` on `<html>`, the `vynatix-bg`, `vynatix-bg-seed` and `vynatix-bg-iris`
keys in `sessionStorage`, `hero-bg.js`, the iris's markup in `index.html`, the dial's
masks and the guards of each. `publish.js` fails if `hero-bg.js`, `data-bg` or a
`vynatix-bg` key comes back.

- **Where it lives.** `hero-bg.css`, which only `index.html` links, after `styles.css`, so
  the other twenty-three pages never download it. It carries a version stamp (`stamp.js`).
  There is no script, no storage and no markup for it, so the page is the same with and
  without JavaScript (`bg-sheet.js` compares the two pixel for pixel).
- **The rules.** Every rule on the hero carries `:lang(en)`, so the Swedish hub would be
  untouched even if it linked the file. Colours are role tokens and `color-mix()` on them
  only (no hex, no palette token, no `!important`, no `[data-theme]`, no inline
  `style=""`), custom properties are `--sheet-*`, there is no animation, transition or
  keyframe, and the two assets are `assets/bg-sheet-*.svg`, named by `url()` behind the
  75rem media query, so they are requested only at the widths that draw them.
  `publish.js` enforces all of this from the source.

*The sheet* (two assets, 75rem and up). Pure CSS: no script, no storage, no
motion. Row guides: `.hero__h1::before` and
`.hero__h1 em::before` are zero-net-width inline-blocks whose bottom edge is the
row's baseline (`1cap` is the face's cap height), at `z-index: -2` in opaque colours;
each carries one set of guides, because the roman row is one word ("Engineering") and one
line, and the second is the italic line's own set, with the bronze baseline. A roman row
that can wrap needs a second set at `+1lh` again (the headline before this one had it; in
Monochrome the roman and italic faces have different cap heights, so two sets that land on
one line draw it twice, and `bg-sheet.js` fails on the weight). Art: `.hero::before` (neutral: the tick scale under the
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
(it reproduces the shipped pair); its numbers also live in `hero-bg.css` and in the
sheet's guard, `bg-sheet.js`.

**The headline copy drives the geometry, and the guard says when it moves.** The art is
not placed with pixels from the page's corner: it hangs on the layout of the hero as it
is (the headline's baselines, the end of its first line, the container's edges). The
headline is "Engineering" with the italic "that compounds." on its own line, 96px from
about 1200px up: two lines, with two lines of lede under them. The constants listed above
were fitted to the headline before this one ("Your in-house software team." / "Without the
hiring.", three lines over six of lede), which made a taller message. They were not
refitted: the art keeps the room it was drawn for, because from 1100px the clients' rule
stands 336 units under the buttons instead of 96 (`--hero-gap`, see *Hero fit*), which puts
the rule where the longer message put it. So the art is still 24px or more from the text,
the contrast behind the text equals the plain page's and the sheet's rules register to the
glyphs; the cost is open space under the buttons. Refitting the art to the short message
(and taking the 336 back to 96) was the alternative; the owner chose to keep the art as it
is (20 November 2026).
**A change to the headline, the lede (its words or its measure), the hero's spacing, the
clients row or a typeface can move the art into the text.** Run `npm run check:bg` after
any such change: the guard fails and names the rule (clearance, contrast or
registration), and the sheet's constants are the ones to refit. The constants are
written in the hero's unit (`calc(N * var(--hero-u))`, see *Hero fit*): the numbers in
this section are their values at the design size, which a window 1248px high or taller
shows.

**Guards.** `tools/verify/bg-sheet.js` proves clearance (the nearest art ink is 24px or
more from any text line box, button, header link or the clients row, with text-only zoom
emulated), contrast (the pixels behind every hero text box with the text hidden: 4.5:1,
3:1 for the headline, no lower than the plain page's own by more than 0.1 except where
the art is meant to sit under text), registration (the guides on the glyphs), removal
under forced colours and more contrast, and assets (the two masks requested from 1200px
up only and by the home page only, the hero pixel-identical with and without
JavaScript, no `data-bg`). It runs in a 1248px-high window, the design size; `bg-fit.js`
runs it again on a scaled hero (see *Hero fit*), and a distance it compares (the 24px)
is multiplied by the hero's unit first. `npm run check:bg` runs the two alone, and both
are in `npm run check`. `publish.js` adds the static rules above, and `a11y.js` the
reduced-motion proof on the home page (nothing animates, by CSS or by the Web
Animations API, with the sheet drawn). The clearance captures leave the client marks out: a mask's edge
rasterizes a few levels differently with and without the sheet's layers in the hero, which
is not art.

**Hero fit.** When a home page loads, the first screen is the hero: the header and the hero's
message (eyebrow, headline, lede, buttons) fill the window, whatever its size, and the hero
scales with the window's height to do it. An owner decision ("the hero
should always scale to fit the browser screen when it loads"). Both home pages, `styles.css`,
"Hero fit". No script, no new motion, nothing stored.

- **One unit.** The hero is drawn in `--hero-u`, one design pixel: a registered length, `1px`
  at the design size. Its padding, its gaps and the headline and lede sizes are
  `calc(N * var(--hero-u))`, where N is the token the comment beside it names (a length cannot
  multiply a length, so these are numbers, not `var(--space-*)`). The eyebrow and the buttons
  keep their size at every scale and the lede never goes under `--text-body-lg` (18px; 16px
  on a phone). `hero-bg.css` multiplies the sheet's constants by the same unit (the
  24px gaps, its rulers and its em through `--hero-em`), so the art keeps its place against the text as the hero scales.
  The sheet's art hangs from the content's right edge and grows from its left when the text
  alone is enlarged (`--hero-em0`), and `--sheet-drop` keeps its apex on the headline's second
  baseline, because the eyebrow's line does not scale.
- **The solve.** With every vertical size a multiple of the unit, the hero's height is a
  straight line in it, so `u = (100svh - what stands above the hero - fixed) / slope`.
  `--hero-above` is the header's bottom edge (78px). There are
  two lines per page (`--hero-f1`/`k1` while the lede scales, `f2`/`k2` once it has stopped at
  its floor; `min()` picks) and, under 1200px, a second pair for a headline that is as wide as
  the window allows (`--hero-h`, `--hero-hw`; `max()` picks). The English hero has a third line,
  `--hero-wf`/`--hero-wk`, for the whole hero with its client row. The numbers are measured facts
  about the current copy: two headline lines and two lede lines in English, two and five in
  Swedish. From 1100px, where a background's art may be drawn, the English hero's `--hero-gap`
  is 336 units instead of 96 (the art's room, see *The headline copy drives the geometry*), and
  the three slopes carry the extra 240. The gap also grows by ten pixels for each pixel of the
  hero's em over 16 (`--hero-em0`): the art is drawn in em and this message has few lines to
  grow, so with the text alone enlarged the sheet's A-frame would otherwise pass the clients'
  rule at 150 percent. At the default text size the term is zero and the lines are untouched. **A change to the headline, the lede, a typeface, the header's height or the hero's
  spacing moves them**: `tools/verify/hero-fit.js` (check M) fails, prints the measured height
  and names the pair to refit.
- **Three states, by the window's height.** *Message*: the message is fitted and the clients'
  rule lies on the fold, so the client row starts the scroll and is never cut half way
  (`.hero__msg`, the wrapper round the message in `index.html`, takes the first screen's
  height; the Swedish hub has no client row, so its hero ends on the fold with the message
  centred). The English message is short, so where the window is taller than it needs the
  spare room is under the buttons. With the art's room (1100px and wider): 96px headline from
  about 950px of window height, 90px at 1440 by 900, 77px at 790, 58px at the envelope's lower
  edge. *Whole*: from 1060px of height at 1100px and wider (864px between 1024 and 1099px, where
  no art is drawn, and 1000px on a tablet held upright, at the design size)
  the unit is solved for the whole hero (never under 0.82) and the client row is pinned to the
  bottom of the window, the spare room above its rule; from 1215px that is the design size with
  more air. *Natural*: outside the envelope the hero is the plain scrolling hero at the design
  size.
- **The envelope.** The fit applies from 650px of window height at 600px and wider and from
  520px on a phone, inside `@supports (height: 100svh) and (transition-behavior:
  allow-discrete)` (the second stands for registered custom properties, as in `hero-bg.css`).
  It is for screens only (paper has no fold), and without JavaScript at 904px and narrower the
  hero is the plain one, because the header there is not sticky and lists its links, so it is
  taller than `--hero-above`.
  A lower window is where browser zoom lands (a 1440 by 900 window at 200 percent is 720 by
  450), so zooming in always ends at full-size text. `min-height` only, never `height` or
  `overflow`: enlarged text, a longer translation or a fallback font make the hero taller
  than the window and it scrolls; nothing is clipped.
- **Known limits.** A short phone window (the small viewport of a 375 by 667 phone and under) has more
  message than fits: the hero is as compact as its floors allow (headline 31px) and the buttons
  can sit under the fold. Between 600 and 799px the English lede wraps by the window (767px on
  the Swedish hub), so the unit comes out a little small and the message fits with room to spare.
  From 1100px the English hero keeps open space under its buttons at every height (the art's
  room). Inside the envelope the
  headline is sized by the window, so browser zoom between 100 percent and the envelope's edge
  enlarges the lede but not the headline (a 2560 by 1440 window leaves the envelope at about
  220 percent).
- **Checks.** `hero-fit.js` proves the lines against measurement (M), the fold at a table of
  real windows on both home pages (F), the envelope's edges and browser zoom (E) and the
  `@supports` gate (S). The sheet's guard runs its full sweep in a 1248px-high
  window (the design size, client row included) and `bg-fit.js` runs each again at 900, 790,
  660 and 1100px, where they multiply their own distances by the unit they read from the page
  (`heroUnit` in `_common.js`). Both are in `npm run check`.

**Audience switch (retired, November 2026).** The English home page used to open with a bar of two
links, "Hire a team" and "Join the team", and held a second view for senior engineers at
`index.html#join`, lifted from `membership.html`. The owner's website content plan takes the
membership pitch off the home page, so the bar, the joiner view, its skip link, the
`js-view-join` block of `app.js`, the `view-hire` / `view-join` classes and
`tools/verify/audience.js` are gone. What is left of it:

- **`#join` still answers.** It was a public address, so the People section carries
  `id="join"`: an old link lands on "Great software comes from great people" and its "Join us"
  link, which goes to `membership.html`, the Career page. `#hire` has no element
  now and lands at the top of the page, which is what it showed.
- **`main.home`** is the scope the home page's own layout rules hang on (`styles.css`, "Home
  page"), where they used to hang on the two view classes; `.hero--clients` marks the English
  hero, the one with a client row, where the fit rules used to read `.audience ~ .hero`.

**Bronze budget.** The hero already spends Bronze (the accent text colour) on the italic
line of the headline. The sheet adds a bronze second baseline under it, a measured edge and
an apex mark. The owner accepted this.

**Measured costs and known limits** (Chromium only, no Safari, Firefox or real devices).
`hero-bg.css` is about 3.1 KB gzip, paid by the home page only; no other page carries
anything for the hero background. The backgrounds were first built into `styles.css` and
`app.js`, and that cost every page 14.5 KB gzip: on a cold cache over slow 4G with the CPU
throttled 4x, the first and largest paint of a page other than the home page rose by 64 to
100 ms, which is why the hero background has its own file. Fetching the two masks costs the
home page 50 to 95 ms on a desktop at 4x CPU. The sheet's headline guides come within about
30px of the lede at the nearest row guide, and its art within 41.5px of any text.

**Changing it.** New art for the sheet comes from `tools/sheet-art.js` (new file names,
never reused; the numbers change in `hero-bg.css` and `bg-sheet.js` with it), then
`npm run stamp` and `npm run check:bg`. A second background, a draw between several or
anything that moves is a new owner decision, not a refactor: the draw stored keys the
notices had to list, and the site's one ambient motion is the silk (see *JavaScript*).
Without `hero-bg.css` the hero has no background at all, on a page with or without
script.

**Shared chrome: the header and the footer are templates, the rest is duplicated.** The `<header>` and `<footer>`
are written into every page by `tools/seo-head.py` from the `HEADER` and `FOOTER` templates in it: a nav
change (the `NAV` list), a change to the footer's links or contact details, or an `aria-current="page"` on the
current page's nav link is made there, once, and the script run, not by hand in every file. The skip link and
the inline `<svg class="svg-defs">` that defines the wordmark `<symbol>` (both header and footer place it with
`<use>`) are still copy-pasted into every page: a change to either must be applied to all `*.html` files
The
header's logo and contact-detail markup is part of the `HEADER` template. The Legal list in the footer
carries the "Cookie settings" link (`data-consent-open`), which reopens the consent bar. The header is the system's TopAppBar: a floating Liquid
Glass bar (`.site-header`) whose links take the 2px `--indicator` underline
when current, one small primary button and two icon buttons. On a phone the links fold into
the menu, but the "Get in touch" button stays in the bar from 375px (enhanced header only:
without JavaScript the wrapped nav shows the link, and under 375px it sits in the menu; with
enlarged text its label wraps rather than leaving the bar), so a reader can act from any depth
of a long page. The menu button's listeners are delegated from the document in the blocking
head, so it works from the moment it is painted. On a phone the footer's link groups sit two-up
where two columns fit, one column where they do not. The print layer at the end of `styles.css`
prints the header once, without its controls, and keeps the inverse bands, the filled buttons
and the client marks in colour; tonal surfaces, cards and outlined buttons print the browser's
economical way, so a dark theme does not print as black slabs.

**JavaScript** is plain ES5-flavoured vanilla JS in self-contained IIFEs, each
guarded so a missing element is a no-op. Every page loads `app.js` from the
`<head>`, and `app.js` is the only script on every page: there is no CDN or animation
stack. `app.js`
has five features: the theme (light or dark, and the toggle), the mobile nav,
the silk background's drift and pause button (see *Silk
waves*), the rate calculator on the Career page (see *Rate calculator*), and consent for Google Analytics (see *Analytics*), which stays the last block
because `consent.js` cuts the file there to build its baseline. The hero background has
no script (see *Hero background*).
The only third-party script that can ever run is Google's `gtag.js`, which the consent feature
injects itself, only once a real Measurement ID has been set and only for a visitor
whose answer is Accept: on the press, or on a later page load while a stored `granted`
answer is still valid. **One thing on the site moves
on its own, and no second may be added:** the silk background, drawn live until the
visitor pauses it (see *Silk waves*). What else moves answers the visitor: short
transitions on hover and focus.
The design system forbids auto-advancing strips and ambient loops on content
surfaces, so the former client marquee is a still list (`.clients__list`) and
the former case reel is a grid of cards; the silk has a pause control and is
an owner decision whose limits must not be loosened. Reduced motion removes all of it.

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
all 24 pages, the string in `EDGE-SETUP.md`, and the Transform Rule in the
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
  and wraps under the bar; `app.js` sets it in the blocking head, so a phone never paints the
  wrapped nav and then jumps, and takes it back off at `DOMContentLoaded` if the page has no
  menu button or nav) and `.js-theme` for the theme toggle (it keeps its
  place but is invisible until it can work). The consent module follows the same
  rule by building its markup only when it can work: the bar and the in-page
  panel do not exist without JavaScript, with blocked storage, or while the ID is
  the placeholder, and the footer's "Cookie settings" link is then a plain link to
  the notice. It adds `js-consent` to `<html>` once active (a test hook and a
  guard against a second copy of the script; no CSS depends on it) and
  `consent-open` while the bar is on screen (the bottom reserve in `styles.css`
  depends on that one).
- Motion is short transitions on hover and focus, and the silk background (see
  *JavaScript* and *Silk waves*). The system's `prefers-reduced-motion` rule cuts the
  transitions to 0.01ms, and the silk is still.
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
  ItemList, Article).
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
and in the JSON-LD description, so every source an engine reads agrees: "Vynatix is
the senior software consultancy for scale-ups. Our engineers join your team, raise the
pace and make your software stronger as you grow. Based in Gothenburg, part of Ultra
Group." (Swedish: "Vynatix är mjukvarukonsultbolaget för scaleups. Våra seniora
utvecklare blir en del av ert team, höjer tempot och gör er mjukvara starkare i takt
med att ni växer. Vi finns i Göteborg och är en del av Ultra Group.") These are the
brand voice's standard descriptions, in the JSON-LD (`COMPANY_SENTENCE` in
`tools/seo-head.py`), the footer, `llms.txt` and the guides' "About Vynatix". The
slogan in the structured data is the brand line, "Engineering that compounds". If a
fact in it changes, change it everywhere, including LinkedIn and the registries, which
are outside this repository and still carry the earlier sentence until the owner
changes them.

**The English home page** follows the owner's website content plan of November 2026: eight blocks
(nine until the owner took In numbers out on 20 November 2026),
each opening with a promise and backed by a fact, in the order a leading consultancy's home page
uses. `<main>` carries the class `home`, which scopes the page's own layout rules. After the hero
(the brand line "Engineering that compounds." as the headline, two buttons, and the client row
under the label "Trusted by companies that set the standard", the companies outside automotive
first) comes a contents row (`.toc`, a `<nav>` of plain anchor links, one per section, in page
order: add, rename or move a section and this row changes with it). The row stays in the page:
the header is the only thing that pins. (Until 20 November 2026 it pinned under the header on
wide screens, which put a second bar over a fifth of a laptop window; that block is gone from
`styles.css`.) Then, in this order:

- `#services`, "Where we make the difference": three `.cap` columns, AI engineering first, then
  cloud platforms and application development, each one promise and one link to its section of
  `services.html`. One generated still life lies across the three columns, a third over each
  (the empty, `aria-hidden` `.cap__art` spans): a card-index drawer, five brass weights stepping
  up, a compass over a pencilled triangle, on one sheet with one pencil line through all three.
  The slices are one file, positioned left, centre and right, so the line carries across.
- There is no In numbers block. The plan had one after Services ("The numbers behind the
  promise": minutes per build, clients, reply time, the first drawn on a ruler), and the owner
  removed it from both home pages on 20 November 2026: do not bring it back, and do not move its
  figures into another block of the home page. The facts stay where they already were (the build
  time in the Volvo Cars case, the fourteen marks in the hero, the reply time in the closing
  band). The plan also had "7 years or more" of experience in every consultant; the owner took
  that out the same day (it would stop being true with a hire of fewer years), so no page states
  an experience figure for the whole team. One lesson from the block stays: the Geoptie audit
  read its `dl` and its `aria-hidden` ruler figure as "Minutes per build476Down from 47", so
  **a decorative figure is never text in the page** (draw it from the stylesheet), and a label,
  a figure and its sentence go in separate `<p>` elements, as on `work.html`.
- `#cases`, "Real results, in production": the three published cases as `.case` cards
  (`.cases--lead`), the regulated client first as the tall card and the other two as compact
  rows beside it from 905px, each one link to its section of `work.html`. Their pictures are
  generated still lifes from the same set as the Services picture (bound documents with brass
  page markers, a stopwatch over a long and a short pencil line, a radio tuning dial), set as
  decorative CSS backgrounds on `.case__img--*`. Under the cards: the link to all cases and the
  line that says the images are generated and show no client system. A fourth published case
  needs a decision first: the block holds three.
- `#partnership` (`.section--band`), "A partner that grows with you", on the inverse band, and
  under the heading the hero's drawing at four stages on one datum line (`.grow`, four
  `aria-hidden` `.fig` spans, each a mask over a role colour; the last carries the bronze edge).
  The owner preferred these drawn frames to a film of the drawing being made (20 November
  2026): do not replace them with video. The
  plan's closing sentence, "Start with one engineer and add more as you grow.", is left out on the
  owner's decision of 20 November 2026: do not add it.
- `#join`, "Great software comes from great people", with the "Join us" link (see *Audience
  switch (retired)* for why the id is `join`).
- `#insights` (`.reads`, `.section--surface`), "Ideas that move software forward": three entries
  as ruled rows from 905px (title on the heading's column line, description on the lead's), not
  a second grid of three, and a link to `blog.html`. Every post (`kind='post'`) must be among them (`permanence.js`
  fails otherwise), and each entry repeats the linked page's `<title>` (without the brand suffix)
  and meta description word for word; a Swedish page's entry carries `lang="sv"`.
- The call-to-action band (`#contact`), "Let's build what comes next."

**The page's pictures** (`styles.css`, "The English home page: its pictures", the last block of
the file) are the owner's decisions of 20 November 2026. On this page `.section--surface` has no
tint and no rules, so the silk runs unbroken from the client row to the closing band; from
1280px the hero drawing's dash-dot centre line runs down the left margin, 40px outside the text
edge, with a tick at each block's label (pseudo-elements, decoration only). **The generated
pictures come in two sets, daylight and night**: the night version of each was made by editing
the daylight one, so the objects and the composition match. `light-dark()` chooses the file from
the page's own `color-scheme` (which `colors_and_type.css` sets with the theme), so there is no
`[data-theme]` selector and a browser fetches only the set it shows; the theme toggle swaps
them in place. A browser without `light-dark()` for images keeps the daylight set in both
themes. Add a picture and it needs both versions and both lines of that block. None of this
moves: the rule that the silk is the site's one ambient motion is untouched. `sv.html` keeps the
older layout and the three photographs.

What the plan took off the page: the service chapters with their "What we build" panels, the
company sentence and the Gothenburg photograph, the four steps of How we work, the comparison
with a typical consultancy, the pull quote, the questions (and with them the page's FAQPage
data) and the joiner view. The questions live on `contact.html` now, rewritten in the
new voice (the owner's decision of 20 November 2026). The lines the plan removes from the whole site (declining work, sending a
reader to another firm, "no pitch, no pressure", what a model cannot do as a headline,
automotive as the headline) do not come back on any page.

From 905px the home page keeps one column line: every section head and the closing band split
in halves, so their right-hand columns start on one line, and section titles take token ends (40
to 56px). The three insights sit in one row there, two-up between 600 and 904px. These rules are
scoped to the home page (`.home`, `#contact`): `.section__head`, `.section__h2` and the
`.cta-band` classes are shared with other pages, which keep the thirds.

On a phone the hero's lede is one type step smaller and its buttons a step closer. The onward links (the contents row, read-more links, the insight titles and the closing
band's contact lines) are 44px or more tall under 905px. Nothing here needs JavaScript and
nothing moves.

**The other pages.** The whole site follows the content plan since 20 November 2026.
`services.html` sells the offer with AI engineering first: a promise as each section's heading,
one paragraph, and a "What we deliver" list; the Service nodes in `tools/seo/services.json` repeat
each paragraph. `industries.html` is new: four industries, each naming only clients on the hero's
row, mobility last and short. `work.html` is "Cases" in the menu and the footer (the file name
stays: a URL never changes): the three cases, the regulated client first, each told as
challenge, work and result; the Volvo Trucks case has no challenge line until Volvo Trucks
supplies one in its own words. The team projects and the libraries under them are unchanged.
`blog.html` is "Insights", with the plan's heading and lede. `membership.html` is "Career", in
the recruit voice (one engineer to another: the work, the people, the craft; no terms, pay or
anything about leaving in the copy; the one place pay appears is the rate calculator, next
paragraph). `about.html` has the plan's headline, four principles
and the people block. `contact.html` has the two routes, the three steps of "How we start" and
the English questions (`#faq`, with the page's FAQPage data). The two deep pages
(`ai-engineering.html`, `android-automotive-development.html`) and the guide on choosing a
consultancy keep their structure and facts and lost the lines the plan removes; the Android
Automotive pages stay for search, off the menu, the footer and the home pages, linked from the
Volvo Trucks case.

**Rate calculator.** Asked for on 20 November 2026, and an exception to two rules above (nothing
about how Vynatix runs inside; no terms or pay on Career): `membership.html#rate-calculator`, between
"How it works" and the closing band. The visitor types an hourly rate, the hours billed in a month,
monthly costs, a savings
target and, behind a checkbox, a company car; the card beside the form shows the share of the
month's invoicing, the highest gross salary it carries (a whole hundred, never under 1,000), what
that salary costs line by line, the fixed and total costs, and what is left on the balance.

- **Where it lives.** Markup in `membership.html` (`[data-calc]`, inputs named by `data-calc-in`,
  figures by `data-calc-out`), the fourth block of `app.js`, the last section of `styles.css`
  (`.calc`). No form element (Enter must not submit anything), no storage, no request: what is
  typed never leaves the page, so the notices do not mention it.
- **The share is 70 per cent and its slider is out of sight** (asked for on 20 November 2026). The
  slider (70 to 80) is in the markup with `hidden` on its field (`[data-calc-share]`); five clicks on
  the "Your assignment" title (`[data-calc-reveal]`), each within two seconds of the last, show it
  for the rest of the visit, and nothing is stored. The page gives no hint on purpose: no tooltip,
  no pointer cursor, no tab stop, no word about it, so do not add one (and it has no keyboard
  route, which is the accepted cost of that). While hidden, the share is held at the slider's
  starting value even if a restored form or a script moves it. This keeps the control out of
  sight, not secret: the range is readable in `app.js` and the markup, and the first figure on the
  card (the share of the month's invoicing) is 70 per cent of rate times hours.
- **The model** is in the comment above the block. `SALARY_COST` (1.57) is the whole cost of one
  krona of gross salary and decides the salary. The lines the card itemises (employer
  contributions 31.42%, five weeks of holiday, pension 4.5%, payroll tax of 24.26% on the pension)
  come to 1.4663; the difference is shown as "Other salary costs", taken from the rounded figures
  so the list adds up to the total to the krona.
- **The numbers are the owner's.** They were copied from the calculator this one was modelled on
  (consulting-salary-calculator.netlify.app), not supplied in writing: the share's range, the
  pension, the 1.57 and what "Other salary costs" stands for are to be confirmed before the page
  is published, and the two tax rates are the 2026 ones and change with the law. A change is made
  in three places together: the constants in `app.js`, the percentages printed in the page's
  labels, and the same constants in `tools/verify/calc.js`.
- **Without JavaScript** the calculator is not displayed and a paragraph (`.calc-nojs`) says it
  needs JavaScript and links to `contact.html`; `app.js` sets `js-calc` on `<html>` once it has
  wired the fields. The car fields are `hidden` until the box is ticked and count only then.
- **Accessibility.** Every field has a label, hints are tied with `aria-describedby`, the slider
  carries `aria-valuetext`, and the result is announced through one `role="status"` line 0.8s
  after the last keystroke (eleven live figures would talk over the typing). Controls are 44px or
  taller. Nothing moves.
- **Copy.** The section says what the tool does and that it is an estimate, not an offer. It adds
  no sentence about how engineers join or what the terms are: that text is still the owner's.
- `tools/verify/calc.js` (in `npm run check`) types into the page and compares every figure with
  the model written a second time, and covers the list adding up, the car, bad input, storage,
  the announcement, the layout at three widths and the no-JavaScript state.

What the plan left open, so the pages do not have it: the two sentences about Ultra Group and
the people section on About; the open roles, the line on how engineers join and the line on
knowledge sharing on Career; a case outside automotive on Industries; the challenge line of the
Volvo Trucks case. None of these is to be written without the owner's text.

**Swedish pages** set `<html lang="sv">` and keep the shared English header and
footer, which carry `lang="en"` so screen readers switch voice; only the skip link
is translated, and, while the consent module is active, the footer's "Cookie
settings" link, which it relabels "Cookie-inställningar" (with `lang="sv"` and a
link to `integritet.html#cookies`) on any page whose `<html lang>` starts with
`sv`. Without JavaScript, or while the module is inert, the English link to
`privacy.html#cookies` stays. `integritet.html` is the Swedish twin of
`privacy.html`, one of five English/Swedish pairs, and the Swedish consent bar links
to it. The footer's "På svenska" column (`lang="sv"`) links the Swedish
hub (`sv.html`), which links every Swedish guide in its `#guider` section, and
`integritet.html`, which is a notice and not a guide and so is linked from that
footer column (and by the Swedish consent bar), not from `#guider`. On a Swedish
page the footer's Legal column therefore deliberately holds one Swedish item, the
relabelled "Cookie-inställningar" link, among English ones ("Privacy", "Terms",
"Accessibility"); the shared footer is English by design, and the link has to match
the Swedish bar and notice. Without JavaScript it reverts to English. The
two home pages follow the same plan and are not mirror images: the Swedish hub (`main.home`, as the
English page) has the same blocks in Swedish under the English brand line (`lang="en"` on its
`h1`), no client row and no contents row, its insights in `#guider` (the three Swedish guides)
and, where the English questions live on `contact.html`, its own questions in `#faq`. Its case
cards and several links lead to English pages and say so. The Swedish was written with the
English rewrite on 20 November 2026 and **has not been checked by a native reader**, which the
brand voice requires before it goes out. The Insights entries on both home pages repeat the
linked pages' `<title>` (without the brand suffix) and meta description
word for word; when one of those changes, change the home page item with it. Write
Swedish as Swedish (the reader is "ni"), not a translation of the English page.

**Languages.** The site is in six languages under one table, `LANGS` in `tools/seo-head.py`: English and
Swedish are *written* (the pages in `PAGES`, by hand, as above), and Spanish, Simplified Chinese, Hindi and
Arabic are *generated*. A generated language is every English page except the three notices, rebuilt in a
folder named by its code (`es/services.html`, home page `es/index.html` at `https://vynatix.com/es/`). The
English page is the only source: nobody edits a file in `es/`, `zh/`, `hi/` or `ar/`, and a run of
`python3 tools/seo-head.py` rewrites all of them. How it works:

- *Messages.* `tools/i18n.py` reads the rendered English page and takes out every message: the inner HTML of
  the outermost element that holds text of its own (a paragraph, a heading, a link label), and the
  translatable attributes (`alt`, `aria-label`, `aria-valuetext`, `title`, `placeholder`, any `data-i18n-*`,
  the meta description). Inline markup inside a message becomes numbered placeholders (`Read <1>the
  guide</1> <2/>`), so a translator never sees an attribute. Scripts, styles, inline SVG, `<code>`, anything
  with `translate="no"` and anything with a `lang` of its own are carried over as they are. The home page's
  brand line is `translate="no"` and stays English with `lang="en"`, as on the Swedish hub.
- *Catalogues.* `tools/i18n/<code>.json` maps each English message to its translation, the way gettext does.
  `tools/i18n/messages.json` (written by the script, never by hand) lists every message and the pages it is
  on, plus the few that are on no page: the label of the language list and the withdrawn stub with its date.
  The page's own JSON-LD nodes (`tools/seo/<page>.json`) are translated from the same catalogue; the
  Organization node stays the one English node every page carries.
- *Drift is a failed check.* When an English sentence changes, its message is no longer in the catalogues.
  The generated pages then show that sentence in English, marked `lang="en"`, and `python3 tools/i18n.py`
  and `tools/verify/i18n.js` fail until all four catalogues have it again. So **an edit to an English page
  is not finished until the four catalogues are**: run `python3 tools/seo-head.py`, then
  `python3 tools/i18n.py missing es` (and `zh`, `hi`, `ar`) for the list, add the translations, run the script
  again and move the language's `mod` in `LANGS`. `python3 tools/i18n.py prune` drops entries no page uses.
- *Links.* A link to a page the language has keeps its name; everything else gains `../` (stylesheets,
  images, the notices, the Swedish pages) and a link to a page in another language gets `hreflang`, which
  `styles.css` shows as "(EN)" or "(SV)" after the link. A mailto subject gains the language in brackets
  (`subject=Project%20%5Bes%5D`), so the inbox shows which language an enquiry came from: the only measure of
  demand there is while analytics is off.
- *The notices are not translated.* `privacy.html`, `terms.html` and `accessibility.html` are legal text
  (`UNTRANSLATED`): the English governs, and a generated page links to it. The consent bar is English on a
  generated page for the same reason (`COPY` in `app.js` has English and Swedish only). **Before analytics is
  switched on with a generated language live, counsel has to decide whether the bar and the notice need that
  language**; that is a line for `tools/PRE-FLIP-CHECKLIST.md`, not something to translate ad hoc.
- *Header and footer.* Built from the same `HEADER`, `NAV` and `FOOTER` templates and then translated with the
  page, so they carry no `lang="en"`. The footer has no Swedish column (`site-footer__grid--four`) and, in its
  last row, the language list (`languages_for`): every language in its own name, linked to this page in that
  language or, where it has none, to that language's home page.
- *What app.js says.* Nothing in `app.js` is translated: the two sentences it writes are carried by the page
  (`data-i18n-play` on the background motion button, `data-i18n-percent` and `data-i18n-status` on the rate
  calculator) and the English is only the fallback. A new sentence written by script goes the same way. On a
  page in a language folder `app.js` finds the site's root from its own `src` (`UP`).
- *Type and direction.* The last block of `styles.css` ("Languages") is all the CSS there is: no tracking,
  taller display leading and upright emphasis for Chinese, Hindi and Arabic; the system faces of each script
  appended to the family lists (**no font is self-hosted for them yet**, an open decision for the owner:
  system faces cost nothing and differ by device); and the few physical sides that right-to-left mirrors,
  most of them in the design system's own sheet. The layout itself is flex, grid and logical properties and
  mirrors with `dir="rtl"`. A phone number, an address, the brand line and any message that stays in Latin
  script get `dir="ltr"` on an Arabic page. `hero-bg.css` is not linked: the hero background is the English
  home page's alone, and the hero fit's constants were measured on English and Swedish copy, so a longer
  translation simply scrolls (`min-height`, never `height`).

**A generated language is a draft until a native reader has checked it**, which the brand voice requires
before anything goes out. `status='draft'` in `LANGS` means: built and checked, but its folder is named in
`_config.yml` `exclude` (the script keeps that list between two marker lines), its pages carry `noindex` and
no hreflang, no page outside the folder links to it, and it has no row in `sitemap.xml`, `llms.txt` or
`tools/urls.lock`. A draft page lists the other drafts in its language list so a reviewer can move between
them; serve the repo and open `/es/`. **All four are drafts today: the translations were written by a
model on 20 November 2026 and no native reader has seen them.** To publish one: set `status='live'`,
`checked` (the date of the reader's check) and `by` (who), set `pub` to that day, run
`python3 tools/seo-head.py` and `cd tools && npm run check`. From then on every English and Swedish page
lists the language in its footer and carries hreflang to it, the pages are in the sitemap, `llms.txt` (a
block the script writes before "Optional") and the lock, and **its URLs are permanent like every other**: a
live language never goes back to draft (the script refuses), and a translated page is withdrawn with its
English source, as the stub in its own language. Going live also needs two things only the owner can
give: a sentence in `accessibility.html` about the new language (and, for Arabic, right to left), and the
decision above about the consent bar. Adding a language is one line in `LANGS`, a catalogue, and for a new
script a family list in the "Languages" block; removing a draft is deleting its line, its catalogue and
its folder.

**The list pages are withdrawn.** `android-automotive-consultancies-gothenburg.html`, its
Swedish twin `konsultbolag-android-automotive-goteborg.html` and
`ai-konsultbolag-sverige.html` named other firms; the content plan retires them, and since
20 November 2026 each is the withdrawn stub (`status='withdrawn'` in the registry: `noindex`,
out of the sitemap and `llms.txt`, linked from nowhere). GitHub Pages cannot redirect, so
the plan's "redirects to the matching service page" is this stub, which points at the home
page. The rule they were written under still holds for anything that names another firm:
quote only its own site, alphabetical, dated, with the disclosure, never ranked.

**Copy** follows the system's content fundamentals: sentence case, no em
dashes (use a comma, a colon, parentheses or a new sentence), no exclamation
marks or ellipses, the middle dot (·) as the metadata separator, no Unicode
arrows or emoji as icons. The voice is the owner's brand voice of November 2026:
to clients, a promise first and the proof right behind it ("you" before "we",
strong verbs, one clear invitation, "Start the conversation"); one name for the
firm, consultancy, never agency or collective; every number real and every client
named only with its approval; nothing about how Vynatix runs inside; automotive
only inside a named case, never in a headline or a description of Vynatix. The
whole site is written in it (the notices and the terms are legal text and keep their own
register).

**Icons** are Material Symbols Outlined, the system's one library, inlined as
SVG (`<svg class="icon [icon--sm|icon--md]" viewBox="0 -960 960 960">`) from
the glyph files in `assets/icons/`, which are copies of the system's
`assets/Icons/`. The icon font itself is not served. `dark_mode` and
`light_mode` (the theme toggle) are not in the system's approved catalogue;
they were drawn from the same package at the same settings and should be added
to the catalogue. Never draw an icon by hand, and never use `.ms`.

## Posts, permanence and withdrawal

The site's blog format is the **Guide**: a dated page that answers one buyer question, in the house pattern
of the four Swedish guides. A page written to this pattern after the blog was added is a **post**, marked
`kind='post'` in its `PAGES` entry in `tools/seo-head.py` (the older guides are not marked). The full plan,
its measurements and the reasons for every choice below are in the blog extension plan the owner holds; this
section is the working rules.

**Where a post lives.** At the flat root, as `<slug>.html`, with a slug that is undated, descriptive and
permanent (a-z, 0-9, hyphens; it must not contain the words `project` or `membership`). Never in a directory:
a `blog/` directory breaks `stamp.js` (non-recursive, and its regex needs `href="styles.css`), the exact-match
footer checks, the font preloads in `app.js` (any path ending `/` is treated as the home page), `links.js`
(it resolves against the base URL, not the page) and `publish.js`. Never `_posts/*.md`: Jekyll publishes a
markdown file without front matter at `/YYYY/MM/DD/name.html` and `publish.js` lets it pass. A slug is never
reused and a URL never removed.

**The pattern.** Eyebrow "Guide"; a question as each H2, with the answer in its first sentence; the lede
says that Vynatix wrote the guide; a `data-faq` block (flat, as in the SEO
section); the company sentence verbatim under "About Vynatix"; a call-to-action band. (Until November 2026
the pattern also asked for an interest disclosure and a "when we are the wrong choice" section; the content
plan removed both, with the argument for other firms.) The byline is
`<p class="prose__meta">Published <time datetime="YYYY-MM-DD">…</time> · Last updated <time datetime="YYYY-MM-DD">…</time> · Vynatix</p>`
(Swedish: "Publicerad" and "Senast uppdaterad"); the two dates are `pub` and `mod` in the registry, and
`permanence.js` fails if they differ. No cadence promise anywhere. **Section ids must not be `article`**: the
Article node's `@id` is the page URL plus `#article`, and a FAQ container with that id collides with it
(`seo.js` then reports a misleading date error). Use `intro`, `questions`, `faq` and the like. The
byline author is "Vynatix" and the Article's author is the Organization; no named person appears anywhere on the
site, and naming one is an owner decision.

**Registering a post.** Add its entry to `PAGES` in `tools/seo-head.py` (with `kind='post'`) and its file name to
`PAGES` in `tools/verify/_common.js`; add a line for it in `llms.txt`; list it on the Blog page (`blog.html`, under
its language, with the page's title without the brand suffix and its meta description word for word, and
in the ItemList of `tools/seo/blog.json`) and on the home page that matches its language (`index.html` Further
reading repeats the title and description the same way; `sv.html` guider); run `python3 tools/seo-head.py`, which writes the head, the
footer, the header, the sitemap and `tools/urls.lock`; run `node tools/indexnow.js <slug>.html` after the
deploy. `publish.js` names an omission of the registries or `llms.txt` precisely, and `permanence.js` fails if
a `kind='post'` page is missing from `blog.html`, from the ItemList in `tools/seo/blog.json` (keep
`numberOfItems` and the positions right) or from the home page of its language. Nothing checks the other
hand-kept lists: when you edit `blog.html`, `index.html` or `sv.html`, move that page's `mod` and run the
generator. Swedish items on the Blog page carry `lang="sv"` (and `hreflang="sv"` on the link). Adding a Swedish
post makes the `sv.html` guider lead ("Publicerade den 18 oktober 2026") false: fix it then. After the deploy,
ping IndexNow for the post, its twin and the pages that now list it (`node tools/indexnow.js <slug>.html
blog.html index.html`). Run `node verify/a11y.js` (both themes by default)
on the new page, because `accessibility.html` says every page is scanned in both themes. A post adds no
CSS, so no `npm run stamp`. An English post with a Swedish twin (or the reverse) is a pair: `alt` on both pages and
`original=True` on the original, `original=False` on the translation (the English page is the original unless
the registry says otherwise; `seo-head.py` refuses a pair with zero or two originals, and `seo.js` checks the
`workTranslation` / `translationOfWork` direction). Pair a page only with a full counterpart that has the same
question and the same answers.

**The call to action carries the post's slug.** The primary button is
`mailto:front.disk@vynatix.com?subject=Project:%20<slug>`, with the plain address under it and one sentence
saying the subject line names the guide and can be changed, linking to the notice's email section
(`privacy.html#email`, or `integritet.html#email` on a Swedish page), written in the page's language;
`mailto.js` fails a page whose button carries its slug without that link. The routing word
stays first because `contact.html` asks senders to start the subject with Project or Membership; nothing in the
repository says how the inbox is routed. `tools/verify/mailto.js` enforces the form. Only mail sent from that
button with the subject unedited is tagged; analytics are off, so this is a floor, not a count.

**Drafts.** The repository is public, and a draft pushed to any branch is public on github.com even though
only the production branch is served. A post that introduces a fact not already on a published page is drafted
outside the repository and committed only after the owner has approved the text; a twin of a page that is
already published may be drafted on a branch. A `[[CONFIRM: what is needed]]` marker is a fact only a human
supplies: never fill one in; `permanence.js` fails on one in any page or published text file that is not a
privacy notice.

**The tagged subject is disclosed.** Both notices say, in their email section (`#email`), that a guide's
email button names the guide in the subject line, that the visitor can change or delete it, that it is used to
know what they read and that messages are counted per guide without names, on the basis of legitimate
interest; the summary list says "no other website analytics" and points there. The guide's call-to-action
sentence links to that section. Keep the three in step: a post whose button carries its slug relies on them,
and any other use of the subject (beyond answering and counting per guide) needs the notices changed first.
The notices as a whole remain drafts pending counsel.

**Dates when a branch sits.** A page's `pub` is the day it first goes live, not the day it was written, so a
branch merged on a later day than the dates it carries is re-dated on the day of the merge, in its own commit:
`python3 tools/redate.py` (or `npm run redate` in `tools/`; `--dry-run` shows the plan and exits 1 if anything
would change, so it can stand in a merge checklist). Against `origin/main` it finds the **new** pages (the file
is not on `main`) and the **changed** ones (the branch moved `mod` in `PAGES`; a change to the generated header
or footer alone moves no date, so `git diff --stat` is not the list). It moves `pub` and `mod` of the new pages
and `mod` of the changed ones to the merge day, with the byline's Published / Publicerad and Last updated /
Senast uppdaterad `<time>` and the `legal__meta` line that repeat them, and the `tools/urls.lock` rows of the
new pages, then runs `seo-head.py`. It never touches a lock row whose URL is on `main` (a row is never edited
once its URL has been on the live site), event dates (the list pages' Checked / Kontrollerad lines, the
`sv.html` guider lead, `tools/TAKEDOWN.md`, `tools/CITATION-LOG.md`), a date in the future or one earlier than
the date it replaces, and it refuses a page whose visible date already disagrees with the registry.
`permanence.js` checks the visible dates of every page (D for posts, V for the rest) and, once `main` has a
lock, that no row on `main` changed. Then run `npm run check`.

**Owner-approved wordings.** A post reuses these or leaves them alone; it does not restate them in new words.
Cited by file and phrase, not by line (lines move). The owner must confirm this list is complete.
- The company sentence, verbatim: "One sentence about the company", above.
- The three cases that can be discussed and the non-disclosure line. Since the content plan of
  November 2026 the `work.html` hero says "Three stories we can tell in full. More of our work is trusted to us
  in confidence." (the owner's wording), and the home pages no longer carry a non-disclosure sentence.
  **The scope of the non-disclosure line differs between the pages that still have one.**
  Limited to Volvo Trucks and Volvo Cars: `android-automotive-development.html`
  and `android-automotive-utveckling.html`. Unscoped: `terms.html` ("Clients named on this site appear with their knowledge; the remainder of our
  work is under non-disclosure and is not described here"). Read as "beyond the published cases", an
  unscoped sentence implies the Volvo-limited one, so no two sentences contradict each other. Only the
  `terms.html` sentence was committed by the owner (e413cb9); the others come from agent commits, and all stay
  until the owner answers one question: **is all work not described on this site, for every client, under
  non-disclosure?** **New content uses the Volvo-limited form, word for word**, because it is true either way: in
  English "Beyond what we have published, our work with Volvo Trucks and Volvo Cars is under non-disclosure."
  (`android-automotive-development.html`, "Non-disclosure is normal"), in Swedish "Utöver det vi har publicerat
  omfattas vårt arbete med Volvo Trucks och Volvo Cars av sekretess." (`android-automotive-utveckling.html`, the
  same section). Where it follows a list of all three cases, label it with its scope ("Volvo Trucks and Volvo
  Cars:"), so it is not read as the whole remainder or as a claim that the regulated client's other work is
  public. Do not reuse "That is what we can publish. The rest of our work with Volvo Trucks and Volvo Cars is under
  non-disclosure." outside the Volvo Trucks case it follows: read alone it takes in the published Volvo Cars case.
- Client names in prose are the ones the content plan names, all of them on the hero's row: Saab, Sony,
  Tele2, Swisslog, Volvo Penta, Scania, Magna, Volvo Cars and Volvo Trucks (`industries.html`, the questions on
  `contact.html` and `sv.html`). A case is told only for Volvo Trucks, Volvo Cars and the
  regulated client; never a broader Volvo claim, and Volvo Buses appears in the logo strip only
  (`assets/CREDITS.md`). The content plan asks for each client's written approval before its name or logo is
  shown, and the owner confirmed on 20 November 2026 that the approvals for the fourteen are collected. A
  fifteenth name still needs its own.
- The Volvo Trucks case and the Volvo Cars case (`work.html`, `index.html`) and the figures in them.
- The regulated client stays anonymous (`work.html`, the closed-domain assistant case;
  `ai-assistent-interna-dokument.html`).
- Team projects: no client names, dates or figures (the comment above `#team-projects` in `work.html`); library
  names are allowed.
- No headcount, and no figure the owner has not confirmed (the history of `index.html`: commits 1c9c765,
  2b39a53, d03ea15).
- Other firms: their own words, alphabetical, dated, sourced, with the disclosure, never ranked (see "The list
  pages" above).

**Withdrawing a page.** `status='withdrawn'` in the registry replaces the page with a stub, adds `noindex`,
drops hreflang, FAQ and Article data, and removes it from `sitemap.xml`; `tools/urls.lock` (append-only,
written by `seo-head.py`) remembers every URL ever registered, and `tools/verify/permanence.js` fails if a
locked URL has no file, if a withdrawn page is still linked, listed in `llms.txt` or a feed, or disallowed in
`robots.txt`, or if its title, description or `<main>` is anything but the stub's own text. Its `--self-test`
(in the chain) proves those failures still fail. The lock is append-only by convention and review (check that
`git diff tools/urls.lock` shows only added lines); a deliberate deletion of the file, the registry entries and
the lock row together is not caught. The runbook, with the timeline and what a stub
cannot do, is `tools/TAKEDOWN.md`. A withdrawn page is the one case where `seo-head.py` rewrites `<main>`, the
title and the description.

**Checks.** `permanence.js` and `mailto.js` are in `npm run check` (static, third and fourth).
`python3 tools/seo-head.py --check` (`npm run check:gen`) reports any generated part that differs from what a
run would write; it needs Python and is not in the chain. `seo-head.py` exits with an error on a page that
lacks its footer marker (it used to skip it silently).

## Analytics

Google Analytics 4 is built into the site, off by default and behind consent.
This section holds the working rules. The reasoning and the cost are in
`SECURITY-ASSESSMENT.md` (Round 6); the hard gate for switching it on is
`tools/PRE-FLIP-CHECKLIST.md`.

**What exists.** The last IIFE in `app.js`, after the theme, the hero background
draw, the mobile nav and the silk background.
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

**The stored choice.** `vynatix-consent` in `localStorage`, beside `vynatix-theme`,
holds one plain string, `v1:granted:YYYY-MM-DD` or
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

**Checks.** `csp.js` (the CSP is identical on all 24 pages, matches
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

The English home page's pictures are generated still lifes (`services-drafting-sheet*.webp` and
three `case-*.webp`, each with a `-dark` twin; see `assets/CREDITS.md`), shown in full colour
with no filter or overlay. They illustrate the work and show no client system, and the page
says so in the line under the case cards. The Swedish hub still carries the three stock
photographs (`case-*.jpg`, each with a `.webp` sibling), under the line naming their
photographers. No text is set on a picture, and none is used as an uncaptioned band. The client mark in
the home-page list is an inline SVG `<symbol>` in `index.html`, referenced with
`<use>` and filled with `currentColor` (provenance in `assets/CREDITS.md`).

The hero's drafting sheet draws from two alpha-only SVG masks,
`assets/bg-sheet-art.svg` and `bg-sheet-edge.svg` (generator in `tools/`, see
`assets/AGENTS.md`); they are requested only from 1200px up, on the home page. The same
generator writes the five `assets/stage-*.svg` masks of the Partnership band from the same
constants, so the hero's drawing and its four stages cannot drift apart.

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
  to any of the five stamped files, `seo-head.py` (Python 3, standard library),
  which rewrites the search block in every head, the header, the footer, `sitemap.xml`
  and `tools/urls.lock` from one registry, the mask generator of the hero's drafting sheet
  (`sheet-art.js` in plain Node, no dependencies), and `indexnow.js`, which tells Bing and the
  other IndexNow engines which pages changed once a change is live. It is developer tooling only: excluded from
  the published output in `_config.yml`, with its `node_modules/` gitignored, and
  nothing in it runs at deploy time. The site itself stays hand-written.
- **"Passing" means:** the pages render correctly in light and dark, nav/footer
  are consistent across pages, behaviour degrades gracefully with JS off and
  reduced motion on, and there are no console errors. Check changes visually in
  both themes. `tools/README.md` documents the repeatable checks — a visual
  regression gate (`screenshot.js`), an adversarial CSP test (`adversarial.js`),
  an off-origin request check (`requests.js`), the random-scheme check
  (`theme.js`), the version-stamp
  check (`stamp.js --check`) and its stale-cache proof (`stale-cache.js`), the search, structured-data and copy check
  (`seo.js`), the hero fit (`hero-fit.js`: the first screen is the hero at every window size),
  the hero background's guard (`bg-sheet.js`) and its
  run on a scaled hero (`bg-fit.js`),
  the accessibility suite with its contrast sweep (`a11y.js`), the static CSP sync
  (`csp.js`), the "what ships" check (`publish.js`) and the consent behaviour and
  layout checks (`consent.js`, `consent-layout.js`). Two more run outside
  `npm run check`: the release gate (`release-gate.js`, which must fail
  until analytics is switched on for real; only its `--self-test` is in the chain)
  and the opt-in live test (`consent-live.js`); see *Analytics*.
  The generated languages have their own check, `i18n.js` (catalogues complete, every generated page
  well-formed and linked right, the draft gate, a load of every page at three widths, axe on three pages of
  each language), and `seo.js` takes in a generated language once it is live; see *Languages*.
  A new page also goes into `PAGES` in `tools/verify/_common.js` and into
  `sitemap.xml`; `publish.js` fails if a root `*.html` is missing from `PAGES`.
  Because light or dark follows the system, the checks that need a particular theme pin
  it first (`pinTheme` in `tools/verify/_common.js` sets the storage key for the theme;
  `pinConsent` pins the analytics choice, and `armGa` arms
  the consent module for checks that audit the bar). The checks run in both
  themes (`mono-light,mono-dark`) by default; `THEMES` narrows a run. Before changing the
  home hero, its copy, the header's
  height, or the hero rules, run `node verify/hero-fit.js` (the fit's numbers) and
  `npm run check:bg`.
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
  public. (One exception, and only the owner can authorise it, in writing, in the pull request: text that
  must not stay public, such as a client name under NDA or personal data, published by mistake; see
  `tools/TAKEDOWN.md`.)
- **Footer VAT number.** Swedish e-handelslag expects the
  `momsregistreringsnummer` alongside the company identification already in the
  footer. It is not added here because it is a legal identifier that must be
  confirmed rather than derived; add it to the footer on every page once
  known.
