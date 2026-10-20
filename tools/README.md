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
| `node verify/csp.js` | Static, no browser, first in `npm run check`. The Content-Security-Policy meta of every page is identical, equals the `EDGE-SETUP.md` header value minus `frame-ancestors` (per directive, source order kept), names only `GOOGLE_HOSTS`, has `script-src` exactly `'self'` plus the path-pinned `https://www.googletagmanager.com/gtag/js`, no `'unsafe-*'`, bare `*`, `https:` or `data:` in `script-src` or `connect-src`, the other directives unchanged from before Google Analytics, a comment above it that is not stale, and no page that hints at a Google host (preconnect, dns-prefetch, preload, prefetch, prerender), loads a script from one, or names one anywhere in its markup outside the policy meta. `<link>` and `<script>` tags are read with a quote-agnostic attribute parser (double, single or no quotes, any attribute order), so a pasted Google snippet cannot hide in the way it is written |
| `node verify/publish.js` | Static, no browser, second in `npm run check` ("what ships"). The `*.html` files at the root are exactly `PAGES` in `_common.js` (a page missing from the list escapes the CSP, link, SEO and consent checks, which all iterate it); every other root file is a page, a site asset (css, js, xml, ico, png, svg, webmanifest, `CNAME`, `robots.txt`, `llms.txt`, the IndexNow `<32 hex>.txt` key) or named in `_config.yml` `exclude`, every root directory is `assets`, `fonts`, `.well-known`, `tools` (excluded) or excluded, and no `.md` sits under `assets`, `fonts` or `.well-known` unless excluded; the footer of every page carries the Cookie settings link (`data-consent-open`, `href="privacy.html#cookies"`); the notice link of each language in `COPY` (`app.js`) leads to that language's page in `NOTICE_PAGES`; both notices name the three storage keys (`vynatix-consent`, `vynatix-theme`, `vynatix-look`) in `<code>`; the site rules of `CLAUDE.md` that nothing else reads: no raw hex colour in `styles.css` (the script's `ALLOWED_HEX` is empty), no `style=""` in any page, no `.style`, `cssText` or `setAttribute('style'` in `app.js` (comments excluded); `llms.txt` links every URL in `sitemap.xml` |
| `node verify/consent.js` | Behaviour of the consent module, armed (see below), about two minutes. The module is inert for the placeholder and malformed IDs (compared with `app.js` cut before the module); undecided on all 21 pages sends nothing, sets no cookie, stores nothing and puts up a bar in the page's language (the live DOM scanned at DOMContentLoaded and after 3 s for any Google link, script or image); Accept by a real click (one gtag request, the collect hit, no violation, cookies only now, the answer kept on the next page); Decline; withdrawal from the footer link and from the privacy page panel, Escape and focus return, a storage event in a second tab, a back/forward cache restore, a stale tab closing, Accept-Decline-Accept counted by collect hits; Decline and Accept are identical `<button>`s in one row and the bar is not a dialog; no JavaScript, blocked storage, damaged stored answers (`FULL=1` for the whole table); Swedish; copy rules in every state; cookie deletion across parent domains on a made-up host; and the consent-text snapshot. Three things to know: the armed run fails if any page needed the harness to insert the footer link or rewrite the policy (the shipped tree must carry both); the notice link of each language is checked against `NOTICE_PAGES` before the snapshot is compared; the module is always run with `PURGE_ONLY` false (the PURGE_ONLY scenario builds the stop from that), so the suite also passes in the exit state where the file ships `PURGE_ONLY = true`, and that scenario opens `privacy.html` and asserts the panel stays empty (with a control that the normal build fills it). A back/forward cache restore that fell back to a synthetic `pageshow` (the cache did not engage under route interception) is reported in a note and in the summary. `node verify/consent.js --update` re-takes the snapshot and **refuses (exit 2)** when the consent text changed and `POLICY_VERSION` did not: review the diff, bump `POLICY_VERSION` if the change alters what a visitor agrees to, or add `--same-version` to say the wording changed and the version stays. `ENGINE=firefox` runs it in Firefox |
| `node verify/consent-layout.js` | Layout and accessibility of the bar, armed, in all six themes by default (`THEMES=` narrows it; about two minutes): height (at most 160px at 320 wide on a first visit, at most half the viewport at 320x568 and 360x640 and for the reopened bar), static in flow at 520px of height or less, no horizontal scroll added by the bar; the open mobile menu overlays the bar and every link passes `elementFromPoint`; WCAG 2.4.11 by a Tab sweep against the bar's real rectangle and a scroll to the end of the page, at 1x and with all text scaled 1.5x; 44px targets; label in name; contrast of text, link, buttons, hover and focus ring from rendered colours; forced colours; reduced motion; axe with the bar up. The informational line about the copyright line ending under the bar is a note, not a check, and its count is not the same on every run |
| `node verify/release-gate.js` | The flip gate; `npm run release-gate`. Only `--self-test` is in `npm run check` (a pass says the gate refuses for the right reasons, no browser, no server); the gate itself is the reverse of `check` and **fails (exit 1) on the shipped tree by design**. Each line is `ok` or `FAIL`. It fails on: the placeholder, a malformed or doubled `GA_ID`; `PURGE_ONLY` not `false` (exactly one `var PURGE_ONLY = false;` in code, comments excluded; a re-flip after an exit must set it back); `COOKIE_MAX_AGE` not `31536000` or `CONSENT_MAX_DAYS` not `365`; a notice that does not say "12 months" / "12 månader" or does not name `<code>vynatix-consent</code>` (read from `CONSENT_KEY`), `<code>vynatix-theme</code>` and `<code>vynatix-look</code>`; a draft banner still on either notice (English or Swedish, any `banner--warning` note); any `[[CONFIRM` marker (matched loosely: spacing, case, a `]` inside); a marker on a page that no longer has its banner; an unticked `- [ ]` box in sections 1 to 9 of `tools/PRE-FLIP-CHECKLIST.md` (sections 10 and 11, the exit runbook and the quarterly review, are not read) or a blank `______` in its header block or Sign-off block; a notice whose visible "Last updated" / "Senast uppdaterad" date is not the `mod` of the page in the `PAGES` registry of `tools/seo-head.py` (read as text) or is more than 14 days old or in the future, and a `mod` whose generated copies (`article:modified_time`, the sitemap `lastmod`) do not follow; any of the old "no analytics, no cookies" sentences (from the git history of `privacy.html`, with a fixed list as fallback); the footer link missing on a page; the CSP not identical and equal to `EDGE-SETUP.md`; the accessibility statement not mentioning the bar; the consent-text snapshot not current. **It never prints a bare PASS**: when every scripted gate holds it prints `scripted gates pass, N human gates open` and exits 0, and the gates a script cannot check (counsel, Google's terms, the Data Privacy Framework listings, the real-ID run in three browsers, the property settings, the records, the keyboard and screen reader passes) are printed above it as WARN lines. WARN lines also list sentences that still say "no analytics" or "no cookies" in some form and that nobody has read: the true ones are listed per file in `READ_BY_EYE_OK` in the script and counted in a note, so a new one stands out, and a list longer than 12 says how many were cut. A draft banner comes off only on counsel's written sign-off (checklist 5.2) |
| `node verify/consent-live.js --live` | NOT in `npm run check`; `npm run consent-live`. The only check that talks to Google: real network, the dummy ID `G-TEST000000` only (it refuses to run otherwise and never prints a real ID), the pages from localhost, Google not stubbed. In Chromium, Firefox and WebKit (each skipped with the reason if it cannot start): Accept and a collect hit answered 2xx, every host contacted and every violation, the cookies set (name, domain, path, SameSite, expiry), Decline, ten seconds with no hit and no cookie, Accept again, and a back/forward cache round trip. Without `--live` (or `LIVE=1`, which does the same where the shell allows that syntax) it only prints how to run it; `npm run consent-live` passes the flag, so it works in any shell. Unlike the other checks it does not ignore certificate errors: behind a proxy that re-signs HTTPS, the proxy's CA has to be trusted by the browser or the run fails on the first Google request. Browsers do not read `HTTPS_PROXY`: it is passed as the proxy (`PW_PROXY=` to override) |
| `node verify/adversarial.js` | CSP actually **blocks** injected scripts/styles/images/handlers, with the attacker's host routed to a working 200 so only the policy can stop it (and the matching `securitypolicyviolation` asserted, with a bypass control that must succeed); a `connect-src` block; the Google hosts reachable and nothing near them; Tag Manager's `gtm.js` **blocked** by the path-pinned `script-src` while `/gtag/js` loads; an image from `www.google-analytics.com` **blocked** (`img-src` was not widened; the host serves a real pixel, with a bypass control that must load it); the injected inline `<style>` on `index.html` and on `privacy.html` (its own policy), each with a bypass control; localStorage poisoning including `vynatix-consent`; URL reflection |
| `node verify/requests.js` | **Zero** off-origin requests; self-hosted fonts resolve; no CSP violations. The "nothing leaves before a choice" proof: as shipped, then armed and undecided, then armed with the answer denied. In the armed states it also asserts the module is really up (undecided: exactly one `#consent-bar`; denied: `js-consent` on `<html>` and no bar), so a module that died on load cannot pass as "nothing leaves". `CONSENT=undecided\|denied` runs one armed state. `CONSENT=granted BASE=https://vynatix.com/` is the live-only mode for after the flip: it allows only `GOOGLE_HOSTS` and tolerates `ERR_ABORTED` on a collect hit cut off by the page unloading |
| `node verify/a11y.js` | axe-core (WCAG 2.0/2.1/2.2 A+AA) on every page in every theme under test, first with the consent bar up (armed, no answer) and again with the answer pinned to denied, plus skip link, the still client list, no-JS and reduced-motion fallbacks, and the contrast sweep, which reports a node in the bar it cannot resolve instead of skipping it |
| `node verify/theme.js` | The per-visit random colour scheme, with the consent bar in the page (its first check is that the armed module is up and a first visit shows one `#consent-bar`): the draw is random, stable across pages, the toggle works inside it, no flash, blocked or poisoned storage survived, preloads are used and the module adds none |
| `node verify/links.js` | Every internal link, script, style and image resolves; every `#fragment` names an element that exists (the footer's `privacy.html#cookies` on every page), and so does every notice link in the `COPY` of `app.js` |
| `node verify/seo.js` | Search, sharing and copy: one canonical per page matching the sitemap, Open Graph matching the title and description, every JSON-LD block parses, the page node's datePublished and dateModified equal the article:* date metas and the sitemap lastmod, the FAQPage is a graph node linked from the page by hasPart/isPartOf with a resolving @id and matches the visible FAQ (p and li, flat), hreflang pairs are reciprocal (the page a language entry points at must link back with an entry in the linking page's own language; an `x-default` entry is not a way back), robots.txt names the sitemap, llms.txt links only real pages, and no em dash, exclamation mark or ellipsis in visible text |
| `node stamp.js --check` | Every page loads `tokens.css`, `colors_and_type.css`, `styles.css` and `app.js` with the `?v=` stamp of the file on disk. `node stamp.js` (or `npm run stamp`) rewrites the stamps; run it after changing any of those four files |
| `python3 seo-head.py [page.html …]` | Not a check: rewrites the generated parts of every page (or only the pages named) from one registry. The search block in the head (canonical, hreflang, Open Graph with the article:* dates, the JSON-LD graph), the footer, the header `lang` and `sitemap.xml`; nothing inside `<main>`. Python 3, standard library. A page's `pub` and `mod` dates live in its `PAGES` entry; `tools/seo/<page>.json` holds a page's extra JSON-LD nodes. Run it after editing a FAQ, moving a `mod` date or changing the footer, and run `npm run stamp` afterwards if styles or scripts changed |
| `node verify/stale-cache.js` | Self-contained: a browser holding OLD copies of the four shared files at the plain URLs is not paired with the new pages (a control without stamps must break for the intended reason, the stamped pages must fetch every file under its stamp and show nothing of the old build). `ENGINE=webkit node verify/stale-cache.js` runs it in WebKit, the engine iOS Chrome uses (needs `npx playwright install webkit`) |
| `node verify/headers.js` | Security response headers (see `EDGE-SETUP.md`) |
| `node verify/screenshot.js baseline` | Capture every page in PAGES x each theme under test into `baseline/`, armed with the consent answer pinned to denied so the bar never enters the baseline. Every capture is armed, so `app.js` must carry the one `var GA_ID` line and the one `var PURGE_ONLY` line: **a baseline cannot be captured on a tree from before the consent module** (take it with that tree's own tools, or compare only the pages the module did not touch). `compare` walks `baseline/` only, so a page that has a capture but no baseline (a page added since) is not compared |
| `node verify/screenshot.js current` | Capture into `current/` |
| `node verify/screenshot.js compare` | Pixel-diff `current/` against `baseline/` |
| `node verify/screenshot.js bar` | Viewport-only captures of the consent bar itself in each theme under test (index and Swedish hub, 390x844 and 1440x900 or `VW`x`VH`): first visit, reopened from the footer, and scrolled to the end of the page. Into `current-bar/`, for review by eye; not part of `compare` |

`indexnow.js` is not a check: after a change is live on vynatix.com, `node indexnow.js`
tells Bing and the other IndexNow engines which URLs changed (all of `sitemap.xml`, or the
pages you name). It proves ownership with the key file at the site root, so it only works once
that file is published.

`screenshot.js compare` is the gate for any visual refactor: capture a baseline
before the change, then compare after. Captures force images to decode first, so
a lazy-loaded cover cannot race the screenshot and produce a false diff. They also
set `content-visibility: visible` on every `main` section, so the home-page sections
that `styles.css` lets the browser skip are compared as designed, not at a placeholder
or remembered height.

`csp.js` and `publish.js` are first in `npm run check`, then `release-gate.js --self-test`;
`consent.js` and `consent-layout.js` come before `a11y.js`. The consent checks arm a page that
lacks the widened policy or the footer link (armGa supplies both), so that every scenario still
runs on a tree that is not integrated yet; but `consent.js` then fails and says how many pages it
had to repair, because the shipped tree carries both on every page. `csp.js` and `publish.js`
refuse such a tree too.

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

`rewriteGaId` (and so every armed check) also serves the module with `PURGE_ONLY` normalised to `false`
and fails loudly unless `app.js` has exactly one `var GA_ID = '...';` line and exactly one
`var PURGE_ONLY = true|false;` line, so the whole suite passes in the exit state where the
file ships `PURGE_ONLY = true`; `release-gate.js` owns the value that ships.

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
Forest pair the site ships (`light,dark`), except `consent-layout.js`, which
defaults to all six; the role tokens have to hold in all six, so sweep them all
before changing a component:

```sh
THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark node verify/a11y.js
```
