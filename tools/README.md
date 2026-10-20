# Verification tools

Local-only checks for the site, plus `stamp.js`, which writes the version stamps
into the pages (run it after changing `tokens.css`, `colors_and_type.css`,
`styles.css` or `app.js`), and `seo-head.py`, which rewrites the search block in
every head, the footer and `sitemap.xml` from one registry (see the table below).
Two small generators, `dial-masks.py` and `sheet-art.js`, write the masks of the dial and
sheet hero backgrounds into `assets/`. **None of this is part of the site build** — the site
itself is hand-written static files with no build step, nothing here runs at
deploy time, and everything in this directory is excluded from the published
output via `_config.yml`.

## Setup

Requires Node and Playwright's browser bindings:

```sh
cd tools
npm install
```

`package.json` lists all four dependencies (playwright, axe-core, pixelmatch,
pngjs); installing only playwright leaves `a11y.js` and the pixel diff broken.

`seo-head.py` needs Python 3 (standard library only, nothing to install).

Chromium is expected at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.
Override with `CHROME=/path/to/chrome`. Nothing here is committed except the
scripts — `node_modules/` and generated screenshots are gitignored.

## Running

Serve the site from the repo root first:

```sh
python3 -m http.server 8000
```

Then, from `tools/`:

| Command | Checks |
|---|---|
| `node verify/adversarial.js` | CSP actually **blocks** injected scripts/styles/images/handlers; localStorage poisoning; URL reflection |
| `node verify/requests.js` | **Zero** off-origin requests; self-hosted fonts resolve; no CSP violations |
| `node verify/a11y.js` | axe-core (WCAG 2.0/2.1/2.2 A+AA) on every page in every theme under test (the home page once for each background under test), plus skip link, the still client list, the no-JS fallback, and reduced motion in all four backgrounds: art drawn, no CSS animation and no Web Animation (`document.getAnimations()`, which the dial and iris use) after pointer moves, a theme toggle and the iris's silence cut short, and the iris not even armed |
| `node verify/theme.js` | The per-visit random colour scheme: the draw is random, stable across pages, the toggle works inside it, no flash, blocked or poisoned storage survived, preloads are used |
| `node verify/bg-draw.js` | The hero background draw and what keeps the four backgrounds apart (the draw checks leave the draw alone, the isolation checks pin or force one background at a time): odds over fresh visits (`VISITS`, default 100) with each of the four inside sane bounds; one visit stays on one background across ten pages including `sv.html` and a reload; a bad stored value is replaced; blocked storage gives the sheet and throws nothing; no JavaScript gives no `data-bg` and the sheet's pixels; `data-bg` is set before the body exists. Isolation: each background's files are requested only by it and only at the widths it applies to (and none on other pages, at 1000, 1199, 1200 and 1440), the calls each background's script makes (listeners, timers, frames, idle callbacks, observers, Web Animations, storage writes) compared with the sheet's, and the same on `sv.html` and `about.html`, nothing running at rest, `sv.html` and `about.html` pixel-identical in all four draws. Storage: the home page writes only the documented keys, `privacy.html` lists exactly them. The iris test hook (see below) is read-only and range-checked. Source: four fenced blocks in `styles.css` and `app.js` in order before the utilities, every rule scoped to its own draw, role tokens only, the iris markup fenced and only in `index.html` |
| `node verify/bg-weave.js` | The weave background (pinned, with a fixed seed): the cloth is never nearer than 24px to text, buttons, the header or the clients row (with text-only zoom 1.25, 1.5, 2), the contrast behind every hero text box with the text hidden equals the page without the cloth, and the field's geometry equals the layout it is derived from (G). `WIDTHS`, `ZOOMS`, `SEED`, `SCROLLS` |
| `node verify/bg-sheet.js` | The sheet background: clearance of the art, contrast (the headline measured against its own floor, because the rules run under it), and registration of the headline's guides to the real baseline and cap line, in each wrapped state. `WIDTHS`, `ZOOMS`, `SCROLLS`, `CLEAR`, `SLACK` |
| `node verify/bg-dial.js` | The dial background: shape (nothing below 1200px, nothing for another draw or without JavaScript), geometry, clearance and contrast with the pointer at rest and at either edge, and motion (still at idle, the turn limited to 6px at the bezel, left alone under the header, one sweep on the theme toggle, still under reduced motion, touch and print). `WIDTHS`, `ZOOMS`, `STATES`, `SCROLLS` |
| `node verify/bg-iris.js` | The iris background: clearance at each width and zoom, contrast (waiting, settled and four event frames), and placement (the art on the clients rule, 24px from the lede box, the bleed between 25 and 65 percent, the index mark's aim at the end of the italic line). `CHECKS` (letters B, C, P), `WIDTHS`, `ZOOMS`, `FRAMES`, `SCROLLS` |
| `node verify/links.js` | Every internal link, script, style and image resolves |
| `node verify/seo.js` | Search, sharing and copy: one canonical per page matching the sitemap, Open Graph matching the title and description, every JSON-LD block parses, the page node's datePublished and dateModified equal the article:* date metas and the sitemap lastmod, the FAQPage is a graph node linked from the page by hasPart/isPartOf with a resolving @id and matches the visible FAQ (p and li, flat), hreflang pairs are reciprocal, robots.txt names the sitemap, llms.txt links only real pages, and no em dash, exclamation mark or ellipsis in visible text |
| `node stamp.js --check` | Every page loads `tokens.css`, `colors_and_type.css`, `styles.css` and `app.js` with the `?v=` stamp of the file on disk. `node stamp.js` (or `npm run stamp`) rewrites the stamps; run it after changing any of those four files |
| `python3 dial-masks.py`, `node sheet-art.js` | Not checks: write the two masks of the dial and of the sheet background into `assets/` (see `assets/AGENTS.md`; with their defaults they reproduce the shipped files byte for byte, and a regenerated mask needs a new file name) |
| `python3 seo-head.py [page.html …]` | Not a check: rewrites the generated parts of every page (or only the pages named) from one registry. The search block in the head (canonical, hreflang, Open Graph with the article:* dates, the JSON-LD graph), the footer, the header `lang` and `sitemap.xml`; nothing inside `<main>`. Python 3, standard library. A page's `pub` and `mod` dates live in its `PAGES` entry; `tools/seo/<page>.json` holds a page's extra JSON-LD nodes. Run it after editing a FAQ, moving a `mod` date or changing the footer, and run `npm run stamp` afterwards if styles or scripts changed |
| `node verify/stale-cache.js` | Self-contained: a browser holding OLD copies of the four shared files at the plain URLs is not paired with the new pages (a control without stamps must break for the intended reason, the stamped pages must fetch every file under its stamp and show nothing of the old build). `ENGINE=webkit node verify/stale-cache.js` runs it in WebKit, the engine iOS Chrome uses (needs `npx playwright install webkit`) |
| `node verify/headers.js` | Security response headers (see `EDGE-SETUP.md`) |
| `node verify/screenshot.js baseline` | Capture every page in PAGES x each theme under test into `baseline/` (the home page once for each background under test, as `index-<theme>-<bg>.png`) |
| `node verify/screenshot.js current` | Capture into `current/` |
| `node verify/screenshot.js compare` | Pixel-diff `current/` against `baseline/` |

`indexnow.js` is not a check: after a change is live on vynatix.com, `node indexnow.js`
tells Bing and the other IndexNow engines which URLs changed (all of `sitemap.xml`, or the
pages you name). It proves ownership with the key file at the site root, so it only works once
that file is published.

`screenshot.js compare` is the gate for any visual refactor: capture a baseline
before the change, then compare after. Captures force images to decode first, so
a lazy-loaded cover cannot race the screenshot and produce a false diff.

`headers.js` fails against a plain GitHub Pages origin by design — those headers
are exactly what the edge layer in `EDGE-SETUP.md` adds. Point it at the live
site with `BASE=https://vynatix.com/ node verify/headers.js`.

`a11y.js` bypasses CSP only to inject the scanner; `script-src 'self'` correctly
refuses it otherwise. CSP enforcement is proven separately by `adversarial.js`.
It also runs an independent contrast sweep over every visible text node, because
axe silently skips nodes whose background it cannot resolve — it missed a 66px
accent at 1.75:1 that the sweep catches.

Framing is deliberately **not** tested by `adversarial.js`: `frame-ancestors`
cannot be carried in a meta CSP at all, so framing protection is an edge-layer
concern and `headers.js` is where it is asserted.

Other useful env vars: `VW`/`VH` set the screenshot viewport (e.g. `VW=390
VH=844` for mobile) and `SUFFIX` writes to a separate directory set.

The site draws one of three colour schemes and one of four hero backgrounds at random for
each visit, so any check that needs a particular look sets it before the page loads with
`pinTheme` from `verify/_common.js`; pass it to `page.addInitScript(pinTheme, arg)`, where
`arg` is a theme id or `{ theme, bg, seed }`. It writes `sessionStorage` `vynatix-look` for
the scheme, `localStorage` `vynatix-theme` for light or dark and `sessionStorage`
`vynatix-bg` for the background, and **always pins the background**: without a `bg` it is
`sheet` (what the page shows without script), so a caller that forgets still gets the same
page every run. A pinned weave also gets a fixed seed (`vynatix-bg-seed`, 7). `pinBg(bg)` pins
the background alone, for the checks that must leave the colour draw alone (`theme.js`) or
that set their own storage. Only the draw checks of `bg-draw.js` leave the draw random, because
the draw is what they test. The scripts that load pages without measuring the hero (`links.js`, `seo.js`, `headers.js`,
`stale-cache.js`, `theme.js`) pin it with `pinBg` so that no run is random; `adversarial.js`
pins the sheet unless one of its own checks has planted something else in `vynatix-bg`.

`THEMES` picks the design-system themes the checks run in. The default is the
Forest pair the site ships (`light,dark`); the role tokens have to hold in all
six, so sweep them all before changing a component:

```sh
THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark node verify/a11y.js
```

`BGS` does the same for the four hero backgrounds in the checks that visit the home page
(`a11y.js`, `requests.js` and `screenshot.js` run the home page once for each background
under test; every other page runs once). The default is **all four**, unlike `THEMES`, because
every one of them ships and the setting only multiplies loads of the home page, never the
other nineteen. `BGS=sheet` narrows a run to the background the page shows without script. The
guards `bg-weave.js`, `bg-sheet.js`, `bg-dial.js` and `bg-iris.js` skip themselves (exit 0, one
line) unless `BGS` includes their background, and always pin their own. An unknown theme or
background exits 2.

The full sweep, every theme with every background, is:

```sh
THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark BGS=weave,sheet,dial,iris npm run check:bg
THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark BGS=weave,sheet,dial,iris node verify/a11y.js
```

`npm run check:bg` runs the five background scripts alone (`bg-draw.js` and the four guards);
`npm run check` runs them in the middle of the rest. The guards drive Chromium through many
frames (widths, text-only zoom emulated through the CSSOM, pointer states, scroll offsets) and
take minutes: `npm run check` as a whole took about ten minutes (629 s) on a four-core machine in
the default configuration (the Forest pair of themes, all four backgrounds), and `bg-draw.js` about
two minutes of that; with all six themes, the four guards run side by side on four cores took 175 s
(weave), 295 s (sheet), 613 s (dial) and 431 s (iris). Narrow a guard with its own variables
(`ZOOMS=1,1.5 WIDTHS=1440 node verify/bg-sheet.js`) while iterating; the defaults are the ones
to pass before committing.

**The iris test hook.** `sessionStorage` `vynatix-bg-iris-idle` replaces the iris's 20 seconds
of silence with a number of milliseconds from 200 to 600000, so the checks need not wait; anything
else is ignored. It is a **test hook**, not a setting: the site only ever reads it (never writes or
removes it, never lists it in `privacy.html`), and `bg-draw.js` fails if that changes (one constant,
one read, no write, not in `privacy.html`, the range and the ignored values tested at run time).
A script that wants the iris's opening quickly sets it in an init script before the page loads and
sets `vynatix-bg-iris` itself to start from the settled state. `vynatix-bg-iris` (the flag the site
writes when the opening starts) and `vynatix-bg-seed` (the weave's seed) are real, documented
storage and are listed in `privacy.html`.
