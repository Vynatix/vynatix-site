# Verification tools

Local-only checks for the site, plus `stamp.js`, which writes the version stamps
into the pages (run it after changing `tokens.css`, `colors_and_type.css`,
`styles.css` or `app.js`), and `seo-head.py`, which rewrites the search block in
every head, the footer and `sitemap.xml` from one registry (see the table below).
**None of this is part of the site build** — the site
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
Override with `CHROME=/path/to/chrome`. Firefox and WebKit are optional
(`npx playwright install firefox webkit`): `consent-live.js` uses them, and
`ENGINE=firefox node verify/consent.js` (or `ENGINE=webkit`) runs the behaviour check in that engine. WebKit
also needs the system libraries Playwright lists when it fails to start
(`npx playwright install-deps webkit`, which uses apt). Nothing here is committed except the
scripts — `node_modules/` and generated screenshots are gitignored.

## Running

Serve the site from the repo root first:

```sh
python3 -m http.server 8000
```

Then, from `tools/`:

| Command | Checks |
|---|---|
| `node verify/csp.js` | Static, no browser, first in `npm run check`. The Content-Security-Policy meta of every page is identical, equals the `EDGE-SETUP.md` header value minus `frame-ancestors` (per directive, source order kept), names only `GOOGLE_HOSTS`, has `script-src` exactly `'self'` plus the path-pinned `https://www.googletagmanager.com/gtag/js`, no `'unsafe-*'`, bare `*`, `https:` or `data:` in `script-src` or `connect-src`, the other directives unchanged from before Google Analytics, a comment above it that is not stale, and no preconnect, dns-prefetch, preload, prefetch or prerender to a Google host in any page |
| `node verify/consent.js` | Behaviour of the consent module, armed (see below), about a minute and a half. The module is inert for the placeholder and malformed IDs (compared with `app.js` cut before the module); undecided on all 21 pages sends nothing, sets no cookie, stores nothing and puts up a bar in the page's language (the live DOM scanned at DOMContentLoaded and after 3 s for any Google link, script or image); Accept by a real click (one gtag request, the collect hit, no violation, cookies only now, the answer kept on the next page); Decline; withdrawal from the footer link and from the privacy page panel, Escape and focus return, a storage event in a second tab, a back/forward cache restore, a stale tab closing, Accept-Decline-Accept counted by collect hits; Decline and Accept are identical `<button>`s in one row and the bar is not a dialog; no JavaScript, blocked storage, damaged stored answers (`FULL=1` for the whole table); Swedish; copy rules in every state; cookie deletion across parent domains on a made-up host; and the consent-text snapshot. `node verify/consent.js --update` re-takes the snapshot, `ENGINE=firefox` runs it in Firefox |
| `node verify/consent-layout.js` | Layout and accessibility of the bar, armed, about a minute and a half: height (at most 160px at 320 wide on a first visit, at most half the viewport at 320x568 and 360x640 and for the reopened bar), static in flow at 520px of height or less, no horizontal scroll added by the bar; the open mobile menu overlays the bar and every link passes `elementFromPoint`; WCAG 2.4.11 by a Tab sweep against the bar's real rectangle and a scroll to the end of the page, at 1x and with all text scaled 1.5x; 44px targets; label in name; contrast of text, link, buttons, hover and focus ring from rendered colours in `light,dark,teal-light,teal-dark` (`THEMES=` for all six); forced colours; reduced motion; axe with the bar up |
| `node verify/release-gate.js` | NOT in `npm run check`; `npm run release-gate`. Fails unless every scripted gate for setting a real `GA_ID` holds: a valid ID, not the placeholder; both notice pages carry `id="cookies"` and one empty panel; no `[[CONFIRM` marker left; none of the old "no analytics, no cookies" sentences (taken from the git history of `privacy.html`, with a fixed list as fallback) anywhere a visitor or crawler reads; the footer link on every page; the CSP identical and equal to `EDGE-SETUP.md`; the accessibility statement mentions the bar; `tools/PRE-FLIP-CHECKLIST.md` exists; the consent-text snapshot is current. Prints the gates a script cannot check (counsel, Google terms, the DPF check, a real-ID run in three browsers) as WARN lines for the owner, and a WARN for each notice page whose draft banner (English or Swedish) is still there. `--self-test` proves it refuses for the right reasons |
| `LIVE=1 node verify/consent-live.js` | NOT in `npm run check`; `npm run consent-live`. The only check that talks to Google: real network, the dummy ID `G-TEST000000` only (it refuses to run otherwise and never prints a real ID), the pages from localhost, Google not stubbed. In Chromium, Firefox and WebKit (each skipped with the reason if it cannot start): Accept and a collect hit answered 2xx, every host contacted and every violation, the cookies set (name, domain, path, SameSite, expiry), Decline, ten seconds with no hit and no cookie, Accept again, and a back/forward cache round trip. Without `LIVE=1` it only prints how to run it. Browsers do not read `HTTPS_PROXY`: it is passed as the proxy (`PW_PROXY=` to override) |
| `node verify/adversarial.js` | CSP actually **blocks** injected scripts/styles/images/handlers, with the attacker's host routed to a working 200 so only the policy can stop it (and the matching `securitypolicyviolation` asserted, with a bypass control that must succeed); a `connect-src` block; the Google hosts reachable and nothing near them; Tag Manager's `gtm.js` **blocked** by the path-pinned `script-src` while `/gtag/js` loads; localStorage poisoning including `vynatix-consent`; URL reflection |
| `node verify/requests.js` | **Zero** off-origin requests; self-hosted fonts resolve; no CSP violations. The "nothing leaves before a choice" proof: as shipped, then armed and undecided, then armed with the answer denied. `CONSENT=undecided\|denied` runs one armed state. `CONSENT=granted BASE=https://vynatix.com/` is the live-only mode for after the flip: it allows only `GOOGLE_HOSTS` and tolerates `ERR_ABORTED` on a collect hit cut off by the page unloading |
| `node verify/a11y.js` | axe-core (WCAG 2.0/2.1/2.2 A+AA) on every page in every theme under test, first with the consent bar up (armed, no answer) and again with the answer pinned to denied, plus skip link, the still client list, no-JS and reduced-motion fallbacks, and the contrast sweep, which reports a node in the bar it cannot resolve instead of skipping it |
| `node verify/theme.js` | The per-visit random colour scheme, with the consent bar in the page: the draw is random, stable across pages, the toggle works inside it, no flash, blocked or poisoned storage survived, preloads are used and the module adds none |
| `node verify/links.js` | Every internal link, script, style and image resolves; every `#fragment` names an element that exists (the footer's `privacy.html#cookies` on every page), and so does every notice link in the `COPY` of `app.js` |
| `node verify/seo.js` | Search, sharing and copy: one canonical per page matching the sitemap, Open Graph matching the title and description, every JSON-LD block parses, the page node's datePublished and dateModified equal the article:* date metas and the sitemap lastmod, the FAQPage is a graph node linked from the page by hasPart/isPartOf with a resolving @id and matches the visible FAQ (p and li, flat), hreflang pairs are reciprocal, robots.txt names the sitemap, llms.txt links only real pages, and no em dash, exclamation mark or ellipsis in visible text |
| `node stamp.js --check` | Every page loads `tokens.css`, `colors_and_type.css`, `styles.css` and `app.js` with the `?v=` stamp of the file on disk. `node stamp.js` (or `npm run stamp`) rewrites the stamps; run it after changing any of those four files |
| `python3 seo-head.py [page.html …]` | Not a check: rewrites the generated parts of every page (or only the pages named) from one registry. The search block in the head (canonical, hreflang, Open Graph with the article:* dates, the JSON-LD graph), the footer, the header `lang` and `sitemap.xml`; nothing inside `<main>`. Python 3, standard library. A page's `pub` and `mod` dates live in its `PAGES` entry; `tools/seo/<page>.json` holds a page's extra JSON-LD nodes. Run it after editing a FAQ, moving a `mod` date or changing the footer, and run `npm run stamp` afterwards if styles or scripts changed |
| `node verify/stale-cache.js` | Self-contained: a browser holding OLD copies of the four shared files at the plain URLs is not paired with the new pages (a control without stamps must break for the intended reason, the stamped pages must fetch every file under its stamp and show nothing of the old build). `ENGINE=webkit node verify/stale-cache.js` runs it in WebKit, the engine iOS Chrome uses (needs `npx playwright install webkit`) |
| `node verify/headers.js` | Security response headers (see `EDGE-SETUP.md`) |
| `node verify/screenshot.js baseline` | Capture every page in PAGES x each theme under test into `baseline/`, armed with the consent answer pinned to denied so the bar never enters the baseline |
| `node verify/screenshot.js current` | Capture into `current/` |
| `node verify/screenshot.js compare` | Pixel-diff `current/` against `baseline/` |
| `node verify/screenshot.js bar` | Viewport-only captures of the consent bar itself in each theme under test (index and Swedish hub, 390x844 and 1440x900 or `VW`x`VH`): first visit, reopened from the footer, and scrolled to the end of the page. Into `current-bar/`, for review by eye; not part of `compare` |

`indexnow.js` is not a check: after a change is live on vynatix.com, `node indexnow.js`
tells Bing and the other IndexNow engines which URLs changed (all of `sitemap.xml`, or the
pages you name). It proves ownership with the key file at the site root, so it only works once
that file is published.

`screenshot.js compare` is the gate for any visual refactor: capture a baseline
before the change, then compare after. Captures force images to decode first, so
a lazy-loaded cover cannot race the screenshot and produce a false diff.

`consent.js` and `consent-layout.js` are in `npm run check` (before `a11y.js`),
`csp.js` first. Against a tree that does not carry the widened policy, the footer
link or the Swedish notice yet they still run (armGa supplies the first two) and
print how many pages needed it; `csp.js` and `release-gate.js` are what refuse such
a tree.

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

The site draws one of three colour schemes at random for each visit, so any
check that needs a particular theme sets it before the page loads with
`pinTheme` from `verify/_common.js` (it writes both storage keys:
`sessionStorage` `vynatix-look` for the scheme and `localStorage`
`vynatix-theme` for light or dark); pass it to `page.addInitScript`.

The consent answer is pinned the same way: `pinConsent` from `verify/_common.js`
(`page.addInitScript(pinConsent, 'granted' | 'denied' | 'undecided')`) writes
`vynatix-consent` in exactly the format `app.js` writes, with today's UTC date
(`undecided` removes the key). It writes on every navigation, so a check that
clicks Accept and then loads another page must not pin.

The consent module is inert while `GA_ID` in `app.js` is the placeholder, so a check
would audit nothing, and a check that ran with the real ID would send real
traffic. Every browser check therefore calls `armGa(context)` from
`verify/_common.js` (several scripts do it for you). It serves `app.js` with
the one `var GA_ID = '...';` line replaced by the dummy `G-TEST000000` (and fails
loudly if that line is not there exactly once), so the consent bar is up and the
module really runs; rewrites the page's CSP meta to the one in `EDGE-SETUP.md`
and inserts the footer "Cookie settings" link, each only if the served page does
not already carry it; answers `www.googletagmanager.com/gtag/js` with a stand-in
that behaves as Google documents gtag (reads the dataLayer commands, honours
`ga-disable-<id>` and the consent state, writes the `_ga` and `_ga_<id>` cookies,
sends a collect hit) and collect hits with 204; and aborts and logs every other
request that is not the site's own, so a test can fail on it (`ga.blocked`; a
request that reaches a Google host it should not is also `ga.leaks`, and
`assertArmClean(ga)` throws on one; whichever script armed the context, a leak
also fails the whole run at exit). Contexts that are deliberately not armed
use `abortGoogle`. `armGa` is the reason a green run proves the code path the
visitors get; it is also the reason none of it proves what real gtag does.

**Real gtag cookie and network behaviour (the names, lifetimes and domains it
really writes, whether it honours the off switch, which hosts it contacts) is
covered only by `consent-live.js` and the pre-flip checklist
(`PRE-FLIP-CHECKLIST.md`).** Every other consent check runs against the
stand-in.

`THEMES` picks the design-system themes the checks run in. The default is the
Forest pair the site ships (`light,dark`); the role tokens have to hold in all
six, so sweep them all before changing a component:

```sh
THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark node verify/a11y.js
```
