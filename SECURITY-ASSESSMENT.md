# Penetration Test / Security Assessment — vynatix.com

**Target:** the Vynatix marketing site (`vynatix/vynatix-site`), a hand-written
static site served via GitHub Pages at `vynatix.com`.
**Scope:** the code we control — all `*.html`, `styles.css`,
`colors_and_type.css`, `app.js`, and `assets/`. Client-side behaviour and
resource-loading only; no live-infra or third-party account testing.
**Method:** source review of every file, targeted pattern sweeps for injection
sinks and secrets, and an empirical Content-Security-Policy validation driving
headless Chromium against every page in both light and dark themes.
**Date:** 2026-08-16.

## Summary

The site is small and, for the class of bugs that usually bite static sites, in
good shape: `app.js` has **no dangerous DOM sinks** (no `innerHTML`,
`document.write`, `eval`, `new Function`, `javascript:` handlers), the one piece
of persisted state (`localStorage` theme) is **strictly validated** to
`light`/`dark` before use, there are **no forms, iframes, embeds, or
`target="_blank"` links** (so no reverse-tabnabbing), **no inline event
handlers**, **no scripts embedded in the SVG assets**, and **no secrets** in the
working tree.

The meaningful findings are about **third-party dependencies and missing
defence-in-depth**, not code-execution bugs. The highest-value one is a privacy
/ data-protection exposure that also contradicts the project's own documented
policy.

| # | Severity | Finding |
|---|----------|---------|
| 1 | High (privacy/compliance) | Every page loads fonts from Google's CDN; the "self-hosted fonts" the docs promise do not exist — **✅ RESOLVED in Round 3** (fonts recovered from git history and self-hosted; Google links removed; CSP tightened) |
| 2 | Medium | No Content-Security-Policy or other defence-in-depth headers/metas *(remediated in this branch)* |
| 3 | Low | Homepage hotlinks images directly from `images.unsplash.com` — **✅ RESOLVED in Round 4** (self-hosted; `img-src` no longer names any third party) |
| 4 | Low / accepted | Clickjacking cannot be fully mitigated on GitHub Pages (no `frame-ancestors` header) — **runbook delivered in Round 4** (`EDGE-SETUP.md`); still open until the edge is live |
| 5 | Info | No Subresource Integrity — not fixable for Google's dynamic CSS; self-hosting removes the need — **✅ moot since Round 3** |

---

## Findings

### 1. Third-party font CDN leaks every visitor to Google — High (privacy/compliance)

Every page's `<head>` contains:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif…">
```

There is **no `fonts/` directory and no `@font-face` rule anywhere in the CSS** —
the site depends entirely on Google's CDN for its typefaces. This directly
contradicts `AGENTS.md` ("Fonts are self-hosted woff2… Don't add third-party
font/CDN requests for fonts") and `CLAUDE.md`.

**Impact.** Each page load sends every visitor's IP address, User-Agent, and
`Referer` to Google (US). For a Gothenburg-based EU company this is a real data-
protection exposure: dynamically loading Google Fonts this way was ruled an
unlawful transfer of personal data by a German court (LG München I, 3 O
17493/20, 2022) precisely because the visitor's IP is disclosed without consent.
It is also a **supply-chain and availability dependency** — the site's fonts (and
paint timing) are at the mercy of a third party, and our sandboxed test showed the
pages fall back to system fonts the moment that host is unreachable.

**Remediation (recommended, not applied here — needs the binary font files):**
self-host the three families as `woff2` under `fonts/` and declare them with
`@font-face` in `colors_and_type.css`, then delete the three Google `<link>`s
from all six pages. This removes the privacy exposure, the third-party
dependency, and the render-blocking cross-origin request in one move, and makes
reality match the documented policy. (The CSP added in finding 2 still permits
the Google host so nothing breaks in the interim; tighten it to `'self'` once the
fonts are local.)

### 2. No Content-Security-Policy / defence-in-depth — Medium — *remediated in this branch*

The pages shipped with no CSP and no `Referrer-Policy`. GitHub Pages cannot set
HTTP response headers, but most CSP directives are honoured via
`<meta http-equiv>`. Without one, any future HTML-injection bug (e.g. a careless
`innerHTML` added later, or a compromised CDN) would run with no restraint.

**Applied fix.** A `<meta>` CSP was added to every page that allow-lists exactly
the origins the site actually uses, plus an explicit `Referrer-Policy`:

```
default-src 'self'; base-uri 'self'; object-src 'none';
img-src 'self' data: https://images.unsplash.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
script-src 'self'; form-action 'self'; upgrade-insecure-requests
```

`'unsafe-inline'` is required for `style-src` only, because the pages use inline
`style="…"` attributes (no inline `<script>` exists, so `script-src` stays a
strict `'self'`). This policy also **enforces the project's own conventions** —
no new CDNs, no inline scripts — at the browser level.

**Verification.** Driven headless against all six pages in both themes: **0 CSP
violations, 0 blocked self-resources**. (The only network errors observed were
`ERR_CONNECTION_RESET` on the external font/image hosts, caused by this test
sandbox's egress policy — not by the CSP.)

**Maintenance note.** Because the site is hand-edited with no build step, anyone
adding a new external resource or an inline `<script>` later must widen this
policy in all six files or the browser will block it.

### 3. Homepage hotlinks Unsplash images — Low

`index.html` loads its case-reel covers straight from
`https://images.unsplash.com/…`. Whatever Unsplash serves at those URLs is what
renders on the homepage; it is an availability and (minor) content-integrity
dependency on a third party. Consider downloading the approved images into
`assets/` and serving them first-party (also lets `img-src` drop the Unsplash
host from the CSP).

### 4. Clickjacking not fully mitigable on GitHub Pages — Low / accepted

Framing protection lives in the `frame-ancestors` CSP directive (or
`X-Frame-Options`), and **both require an HTTP response header** — neither is
honoured from a `<meta>` tag, and GitHub Pages does not let us set headers. For a
brochure site with no authenticated actions the clickjacking risk is low, so this
is documented as an accepted limitation. If it ever matters, front the site with
a CDN/proxy (e.g. Cloudflare) that can inject the header.

### 5. No Subresource Integrity — Informational

SRI would let us pin the third-party stylesheet, but Google Fonts' CSS is
generated per-request (varies by browser), so a fixed hash is impractical.
Self-hosting the fonts (finding 1) removes the third-party script/style entirely
and makes SRI moot.

---

## What was checked and found clean

- **`app.js`** — no `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`,
  no `eval`/`new Function`, no string-argument `setTimeout`/`setInterval`, no
  `postMessage`/message listeners. Theme value from `localStorage` is validated
  against an allow-list before it is applied.
- **Injection surface** — no forms, `action=`, `formaction`, `<iframe>`,
  `<embed>`, `<object>`, or `http-equiv="refresh"` anywhere.
- **Links** — no `target="_blank"`, so no reverse-tabnabbing; all outbound links
  are `mailto:` to a single first-party address.
- **Markup** — no inline `on*=` event handlers, no `javascript:` URIs.
- **SVG assets** — no `<script>`, `onload`, or event handlers inside the logo
  SVGs (they are referenced via `<img>`, so embedded script would not execute
  anyway).
- **Secrets** — no API keys, tokens, private keys, or credential-shaped strings
  in the tree; `.gitignore` covers the usual local-tooling noise.
- **Mixed content** — no `http://` sub-resources; everything is HTTPS or
  first-party relative.

## Recommended next steps, in priority order

1. **Self-host the fonts** (finding 1) — closes the privacy exposure and the
   biggest third-party dependency, and realigns the site with its own docs.
2. **First-party the Unsplash images** (finding 3).
3. Keep the CSP in sync as the pages evolve (finding 2 maintenance note).
4. If framing protection is ever required, move to a host that can send headers
   (finding 4).

---

# Deep dive (round 2)

A second, more adversarial pass: dynamic black-box testing with headless
Chromium (proving controls *block* attacks, not just that they permit legit
resources), a structural non-exploitability argument, a CSP grading, and a
posture note on the execution environment.

## Dynamic adversarial tests

Each attack was executed in a real browser against the live-served pages. Six
controls were positively proven; clickjacking was confirmed exploitable (an
expected, header-only limitation of GitHub Pages).

| Attack attempted | Result | Meaning |
|---|---|---|
| Inject inline `<script>` into the DOM | **Blocked** (did not execute) | `script-src 'self'` with no `'unsafe-inline'` holds |
| Load external script from `evil.example` | **Blocked** (error) | Off-origin script refused |
| Load image from a non-allow-listed host | **Blocked** (error) | `img-src` allow-list holds |
| Inject an inline `onclick` handler and fire it | **Blocked** (did not run) | Inline event handlers refused |
| Poison `localStorage['vynatix-theme']` with an XSS payload, reload | **Rejected** — theme stayed `light`, no node injected | Value is allow-list-validated before use |
| Reflected XSS via URL `#fragment` and `?query` | **No effect** — payload never became a DOM node | Nothing reads/echoes URL input |
| Frame the site from an attacker page | **Framed successfully** | No clickjacking protection (see finding 4) |

## Structural non-exploitability of XSS

Beyond the CSP, the app is XSS-resistant *by construction*: a full sweep found
**no code path that reads any attacker-controllable input** — no
`location.hash`/`search`/`href`, no `document.referrer`, no `window.name`, no
`URLSearchParams`, no `postMessage`/`message` listener — and **no HTML-writing
sink** (`innerHTML`, `insertAdjacentHTML`, `document.write`, `eval`,
`new Function`). With no source and no sink, there is no DOM-XSS path even before
the CSP is considered. The CSP is therefore genuine defence-in-depth, not the
only line of defence.

## CSP grading and residual weaknesses

The applied policy is strong for a static brochure site (`default-src 'self'`,
strict `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`), but note the
residual items — all currently low-impact:

- **`style-src 'unsafe-inline'`** is required by the site's inline `style="…"`
  attributes. It would let an attacker inject styling *if* an HTML-injection
  point existed (enabling CSS-based data exfiltration) — but none does. Removing
  it would mean moving every inline style into `styles.css`.
- **No `require-trusted-types-for 'script'`** — would harden against future DOM-
  sink mistakes, but there are no dynamic sinks today, so the value is low.
- **`frame-ancestors` / `X-Frame-Options` absent** — these are header-only and
  cannot be delivered from GitHub Pages (see finding 4).

## Static deep checks (all clean)

- **SVG assets** — no `<script>`, `<use>`, `<image>`, `xlink:href`, or remote
  `url()` references; the logos are self-contained vector art.
- **CSS** — no `@import`, no legacy `expression()`, no `url(javascript:)`, no
  remote `url()`; the only external styling dependency is the Google Fonts
  `<link>` (finding 1). The one data-URI `url()` is the first-party SVG noise
  texture, permitted by `img-src data:`.
- **Jekyll** — no `.nojekyll` marker and no `_config.yml`, so GitHub Pages runs
  default Jekyll over the content. There is no Liquid (`{{ }}` / `{% %}`) syntax
  in any page, so nothing is silently transformed, but adding an empty
  `.nojekyll` is worthwhile hardening: it serves the files verbatim, avoids any
  future surprise from a stray Liquid-looking string, and speeds Pages builds.
  *(Informational.)*

  > **Superseded in Round 3.** `.nojekyll` was added, then removed again: serving
  > every file verbatim would also serve the developer docs. `_config.yml` is used
  > instead, because it is the only mechanism that can exclude them. Do not
  > re-add `.nojekyll` — it would defeat every exclusion.

## Execution-environment posture (the container this runs in)

The build/agent runs in an **ephemeral, isolated container**; the repo is cloned
fresh per session and the container is reclaimed on idle. Egress is forced
through an **authenticated proxy with a pinned CA bundle** (deny-by-default
network policy), and repository access for the session is **scoped to the single
`vynatix/vynatix-site` repo**. Pushing to the default branch publishes straight
to production, so branch discipline is the main operational control.

Active enumeration of environment credentials, privilege, and cloud-metadata
reachability was **intentionally not performed** — harvesting live secrets is out
of scope for a posture review, and the harness's command classifier
independently blocks that class of recon (a working defence-in-depth control
observed during this assessment). No secret material was read or exfiltrated at
any point.

## Round-2 verdict

The web application has **no reachable injection, XSS, redirect, or
data-exfiltration path** in its current form. The applied CSP is validated to
block the obvious injection classes while breaking nothing. The remaining work is
the third-party-dependency hygiene already captured in findings 1 and 3, plus the
optional `.nojekyll` and inline-style-removal hardening — none of it a live
exploit, all of it defence-in-depth and privacy/compliance posture.

---

# Round 3 — deep dive, git-history forensics, and remediations

A third pass driven two ways: a **7-dimension multi-agent audit** (40 agents:
one analyst per dimension over HTML content, CSS, SVG/asset forensics, GitHub
Pages platform posture, CSP, supply chain, and privacy/GDPR — each finding then
re-checked by an independent adversarial verifier that rejected or down-rated
weak claims), plus **manual git-history forensics** and a read of the execution
environment's egress model. 25 findings survived verification; 8 were rejected
as false positives or over-ratings. The most important discovery turned the
round-1 #1 finding from a recommendation into a **completed fix**.

## Git-history forensics

- **Root cause of the Google-Fonts dependency found — and the fix recovered.**
  History shows the site *used* to self-host its fonts: commit `8f3f768`
  (PR #17, "cta-settle") added six WOFF2 files, the `@font-face` block, and the
  headline preload. Commit `55881a2` then **reverted that entire PR** to drop the
  GSAP CTA animation — and took the self-hosted fonts with it as collateral,
  silently falling back to Google's CDN. The revert's intent was the animation,
  not the fonts. The six WOFF2 binaries were recovered from `8f3f768`, validated
  as genuine WOFF2, and restored (see remediation 1).
- **No secrets in 55 commits of history** — a full scan of every historical diff
  for keys/tokens/private-key blocks found nothing. Positive result.
- **PII:** a personal Gmail address (`osama.s.raddad@gmail.com`) is baked into 26
  public commits alongside the company addresses. Git author emails are public on
  GitHub; using a consistent company or `noreply` address (and GitHub's email-
  privacy setting) avoids leaking the personal one. *(Low / cannot be undone
  without history rewriting.)*
- **No unexpected historical blobs** — the only large objects ever committed are
  the two Geist WOFF2 fonts.

## Remediations applied this round

1. **Self-hosted fonts restored — closes the Round-1 #1 privacy/GDPR finding and
   the supply-chain font finding.** The six WOFF2 files were recovered from git
   `8f3f768` into `fonts/`, the exact `@font-face` block (Instrument Serif ×4
   faces with `unicode-range`, Geist variable, Geist Mono variable, all
   `font-display: swap`) was restored to `colors_and_type.css`, the headline
   preload was re-added to `index.html`, and the two Google `preconnect`s plus the
   `fonts.googleapis.com` stylesheet were removed from **all six** pages. **No
   visitor IP is disclosed to Google (or anyone) any more.** The CSP was tightened
   accordingly to `style-src 'self' 'unsafe-inline'; font-src 'self'`.
   *Verified headless across all six pages, both themes: **0 requests to any
   Google host, self-hosted WOFF2 load and resolve (Instrument Serif / Geist /
   Geist Mono all `loaded`), 0 CSP violations, 0 first-party failures.***

2. **Developer/agent docs no longer served at the marketing domain.** A public
   marketing site should not serve its own security notes or agent instructions.
   Under GitHub Pages these markdown files were fetchable verbatim (and the
   Round-2 `.nojekyll` made that certain). Fix: `.nojekyll` was removed and
   replaced with a `_config.yml` that (a) `exclude`s `SECURITY-ASSESSMENT.md`,
   `AGENTS.md`, `CLAUDE.md`, and `assets/AGENTS.md` from the published output
   while keeping them in the repo, and (b) `include`s the `.well-known/`
   dotfolder Jekyll drops by default. The site HTML carries no YAML front matter,
   so Jekyll copies every page through verbatim — no templating risk.

3. **Added `/.well-known/security.txt` (RFC 9116)** — a vulnerability-disclosure
   contact (`front.disk@vynatix.com`) with `Expires`, `Preferred-Languages`, and
   `Canonical`, published via the `_config.yml` include above.

4. **Documentation drift corrected.** `AGENTS.md` and `CLAUDE.md` described a
   GSAP + ScrollTrigger + SplitText + Lenis CTA animation and JS-mirrored motion
   tokens that **do not exist** in the shipped code (reverted with PR #21). Left
   uncorrected, the docs would steer a future agent to add third-party CDN
   `<script>` tags that the `script-src 'self'` CSP blocks — whose natural "fix"
   is widening the CSP on production. Both files now describe reality (three
   `app.js` features, no CDN/animation stack, `script-src 'self'` by design) and
   state that adding any third-party script requires a deliberate CSP change in
   all six pages. Restoring the fonts also re-aligned the docs' (previously false)
   self-hosted-fonts claims.

5. **Dead "trap" CSS removed.** The `[data-reveal]` / `.page-enter` blocks in
   `styles.css` (opacity:0 with no JS to reveal, left over from the reverted
   animation) matched no elements and would have hidden any element given
   `data-reveal` per the stale docs. Removed. The misleading `cdnfonts` comment in
   `colors_and_type.css` was replaced with an accurate "self-hosted, do not add a
   CDN" note.

6. **Accessibility: `aria-pressed="false"` added to the theme-toggle** markup on
   all six pages, so the control has a correct pressed state for assistive tech
   and no-JS users (previously only set by JS after load).

## Confirmed findings NOT auto-fixed (reported for decision)

These are real but were left for the team because they need a network fetch, a
legal/product decision, or a platform change that GitHub Pages can't do:

- **Unsplash hero images still hotlinked** (`index.html`, low): discloses visitor
  IP to Unsplash/Getty (US) and is an availability/integrity dependency. Fix is to
  download the three photos into `assets/` and drop `images.unsplash.com` from
  `img-src` — not done here because the sandbox blocks the egress needed to fetch
  them. Left in the CSP allow-list until they are self-hosted.
- **Dead footer "Legal" links + no privacy policy** (medium/compliance): the
  `Privacy` / `Terms` / `Accessibility` footer links all point at a non-existent
  `#legal` anchor, and no privacy notice exists (a GDPR Art. 13 transparency gap
  for an EU firm). Authoring legal pages and changing shared footer nav is a
  legal/product decision, not a security edit — flagged for the team.
- **Client marquee accessibility** (`index.html`, low): the logo marquee is
  `aria-hidden` (content lost to screen readers) and auto-scrolls with no
  pause/stop control (WCAG 2.2.2). Needs a visually-hidden client list and a
  pause-on-hover/focus control.
- **Platform header gaps** (info, unfixable on Pages): no HSTS, no
  `X-Content-Type-Options: nosniff`, no `Permissions-Policy` / COOP / CORP / COEP,
  no CSP violation reporting, and no `frame-ancestors` (clickjacking) — all are
  HTTP-header-only and cannot be delivered from GitHub Pages via `<meta>`.
  Confirm **"Enforce HTTPS"** is enabled in the repo's Pages settings; the rest
  would require fronting the site with a header-capable CDN/proxy.
- **`style-src 'unsafe-inline'`** (info): required by 68 inline `style=""`
  attributes; removing it means moving those to `styles.css`. Low value while no
  injection point exists.
- **Optional hardening:** `require-trusted-types-for 'script'` (cheap future-
  proofing), stripping Vectornator editor metadata from the wordmark SVGs, a
  favicon (currently a `/favicon.ico` 404), and adding the VAT number to the
  footer for Swedish e-handelslag identification.

## Rejected findings (verifier filtered these out)

The adversarial verifier rejected 8 weaker claims, including: plaintext email as a
"harvesting" issue (best-practice, not a compliance breach), unused
`logo-mark-*.svg` assets (not security), the missing favicon / custom `404.html` /
`robots.txt` / `sitemap.xml` (SEO/cosmetic, not security), and a duplicate of the
clickjacking gap. Keeping these out is the point of the verify pass.

## Updated CSP grade

Post-remediation the policy is **A / strong for a static brochure site**:
`default-src 'self'`, `script-src 'self'` (no `'unsafe-inline'`),
`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and — now that
fonts are first-party — `font-src 'self'` with `style-src 'self' 'unsafe-inline'`.
The only remaining third-party origin in the whole policy is
`img-src … https://images.unsplash.com`, which disappears once the hero images
are self-hosted. The residual `'unsafe-inline'` on `style-src` and the
header-only directives (`frame-ancestors`, reporting) are the only things between
this and a maximal policy, and both are documented platform limitations.

> **Historical.** This grade describes the Round 3 policy, which Round 4
> tightened and Round 6 has since widened for Google Analytics. The current
> policy is graded in Round 6.

## Environment posture (the container this assessment ran in)

Read-only review of the execution sandbox's egress model (not the marketing
site): outbound HTTPS is forced through a local proxy that tunnels to a
**policy-enforcing egress proxy with re-terminated TLS and a pinned CA bundle**;
disallowed hosts return 403/407 (deny-by-default), and WebSocket/gRPC/mTLS/raw-TCP
are not tunnelled. Combined with the ephemeral, single-repo-scoped container, this
is a solid defence-in-depth posture. As in Round 2, no environment credential,
privilege, or cloud-metadata enumeration was performed — and the harness command
classifier independently blocks that class of recon.

## Round-3 verdict

The site's **top real-world exposure — the Google-Fonts privacy/GDPR dependency —
is now closed**, verified end-to-end. The web app remains free of any reachable
injection/XSS/redirect/exfiltration path, the CSP is strong and now nearly
third-party-free, the developer docs no longer leak from the marketing domain,
and the code/docs are internally consistent again. What remains is genuinely
second-order: self-hosting the Unsplash images (needs network), the
legal/privacy-page and marquee-accessibility gaps (team decisions), and the
header-only controls that GitHub Pages structurally cannot provide.

---

# Round 4 — full fortification

Rounds 1–3 were assessment with targeted fixes. Round 4 executed an approved
plan to close everything that could be closed in the repository, and to write a
runbook for the one class of control that a repository cannot deliver.

Four decisions were taken by the site owner before work started: put a
header-capable edge in front of the origin, draft real legal content for counsel
to review, refactor away the inline styles so the CSP could be tightened, and
include the image, icon, accessibility and hygiene work.

## The verification harness came first

Nothing was changed until there was a way to prove the change was safe.
`tools/` now holds six checks, excluded from the published site and with its
`node_modules/` gitignored, so the site itself still has no build step:

| Check | What it proves |
|---|---|
| `screenshot.js` | 9 pages × light/dark, pixel-diffed against a baseline |
| `adversarial.js` | 7 concrete attacks all fail — 5 blocked by the CSP, 2 because `app.js` has no reflective sink |
| `requests.js` | **zero** off-origin requests; fonts resolve |
| `a11y.js` | axe-core WCAG 2.0/2.1/2.2 A+AA **and an independent contrast sweep**, plus skip link, marquee, no-JS and reduced-motion behaviour |
| `links.js` | every internal link, script, style and image resolves |
| `headers.js` | the response headers from `EDGE-SETUP.md` |

The screenshot gate needed two fixes before it could be trusted. `pixelmatch` v7
ships as ESM, so `require()` returned a namespace object rather than the
function — a latent crash that had never fired because every comparison until
then matched by hash. And once real images existed, lazy-loaded covers raced the
capture, because `fullPage` grows the viewport *after* the wait: two runs of an
unchanged page disagreed by 4%. Captures now force eager loading and await
`img.decode()`, which is stable across repeated runs. A gate that lies is worse
than no gate.

## What was fixed

**The CSP is now `'self'`-only, with no third-party origin at all.**

```
default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data:;
style-src 'self'; font-src 'self'; script-src 'self'; form-action 'self';
upgrade-insecure-requests
```

> **Historical since Round 6.** This was the policy at the end of Round 4, and
> "no third-party origin at all" stopped being true when Round 6 added Google's
> analytics hosts to `script-src` and `connect-src`. The current policy is in
> `EDGE-SETUP.md`; the cost of the change is set out in Round 6.

- **All 68 inline `style=""` attributes removed**, which is what `style-src
  'unsafe-inline'` existed for. They held only 30 distinct values, so most
  became shared classes: named components where there was type, colour or
  background (`.stat-panel*`, `.contact-option*`, `.hero__meta*`,
  `.panel-label`), `--modifier` classes where the element already had one, and
  nine `.u-*` utilities for pure spacing. Verified pixel-identical at 1440×900
  **and** 390×844, in both themes, before the policy was tightened.
  - One trap worth recording: `.panel-label` and `.eyebrow--accent` are
    deliberately *not* plain `.eyebrow` modifiers, because
    `[data-theme="dark"] .eyebrow` re-asserts the primary colour at a higher
    specificity and would have silently overridden them in dark mode.
- **The three Unsplash covers are self-hosted.** They had been hotlinked,
  disclosing every homepage visitor's IP to Getty. `img-src` no longer names any
  external host. (`assets/CREDITS.md` records the sources; the photographer
  names still need filling in by hand, since the Unsplash pages render
  client-side.)

**Accessibility now matches the claim the footer makes.** axe-core reports zero
violations across all nine pages in both themes, where it previously found 23 —
but see Round 5: axe alone was not sufficient, and an independent contrast sweep
later found a node it silently skips.

- A **skip link** (there was none) and an `sr-only` utility; `<main>` had no
  `id` on any page and now has one as the target.
- The **client marquee** was entirely `aria-hidden`, so screen-reader users lost
  the client list. The looping track stays hidden — it repeats the names twice —
  and a plain `sr-only` list now carries them once. A **pause control** satisfies
  WCAG 2.2.2; it is hidden until JS wires it up, so it is never a dead control,
  and hidden entirely under reduced motion where nothing moves.
- A **genuine defect** axe surfaced: `.section--ink` inverts the reel's eyebrow,
  description, metric, card and buttons but had **missed `.reel__link`**, so
  "Read the case" rendered ink-on-ink at **1.21:1** — effectively invisible —
  while the identical link one section above read fine.
- The brand champagne accent used as small text on light surfaces measured
  1.75–1.97:1 against a 4.5:1 threshold. Deepened within the same family
  (champagne-700, and -800 on the dimmer surface), **scoped to the light theme**
  — an unscoped rule would have created new dark-on-dark failures in dark mode.

**The site now keeps its legal promises.** The footer's Privacy, Terms and
Accessibility links pointed at a non-existent `#legal` anchor on all six pages,
and no privacy notice existed at all — a GDPR Art. 13 gap for an EU company.
Three pages were written; the 18 dead links across the six existing footers
were repointed, and all nine footers now carry the same three real targets. The privacy notice
states only what the site verifiably does, and names GitHub Pages and the
planned Cloudflare layer as processors with the third-country transfer called
out. The accessibility statement is deliberately unflattering: it says what has
**not** been verified — no external audit, no testing with screen-reader users,
and that automated tools cover only about half the WCAG criteria.

**Smaller items.** A favicon set and manifest (the four `logo-mark-*.svg` files
were already in the repo, referenced nowhere), rendered offline from the SVG
through the Chromium already present; the theme-aware `favicon.svg` switches to
Cloud Dancer on dark browser chrome. Vectornator editor fingerprints stripped
from the four wordmark SVGs, verified pixel-identical. `SECURITY.md` and
`CODEOWNERS` added, both excluded from publication.

## What is deliberately not done

- **The edge layer itself.** `EDGE-SETUP.md` is a complete runbook, but it
  changes production DNS and is the owner's to run. It records the two things
  that actually bite: GitHub validates its certificate over unproxied DNS, so
  proxying too early leaves *Enforce HTTPS* greyed out; and the SSL mode must be
  **Full (strict)**, since Flexible leaves the edge-to-origin hop in plaintext.
  Until it is live, HSTS, `nosniff`, clickjacking protection,
  `Permissions-Policy`, COOP/CORP and CSP reporting remain missing —
  `headers.js` reports exactly that, which is a record of the gap rather than a
  failure.
- **The footer VAT number.** A legal identifier that must be confirmed, not
  derived from the org.nr.
- **Photographer attribution** for the three photos.
- **Rewriting git history** to remove a personal email from 26 commits. The
  address is already public; rewriting would break the merged pull-request
  record for no real gain. Going-forward settings are documented instead.
- **Branch protection.** Cannot be committed — it is a GitHub setting, and the
  single most valuable one here, since a push publishes straight to production.

## Round-4 verdict

The repository-side work is complete. The site has no reachable
injection/XSS/redirect/exfiltration path, a CSP with no third-party origin under
which seven concrete attacks all fail, zero off-origin requests, no broken links,
and legal and accessibility pages that describe reality rather than aspiration —
including where it falls short. (Round 5 below revisits the accessibility claim,
which was accurate about axe but overstated about conformance.)

What remains is one infrastructure change and a handful of facts only the
company can supply.

> **Historical since Round 6.** "A CSP with no third-party origin" and "zero
> off-origin requests" describe the site as it stood at the end of Round 4. Both
> now hold only until a visitor accepts analytics, and only once a real
> Measurement ID has been set in `app.js`.

---

# Round 5 — independent audit of the implementation

Rounds 1–4 were done by the same hands that wrote the code, which is exactly the
condition under which a self-assessment goes stale. Round 5 put thirteen
independent agents on the finished work: six auditors, one per area, each reading
the real files and git history against the approved plan; an adversarial verifier
per area to reject anything the auditor got wrong; and a completeness critic
asked only "what did all six miss?".

It confirmed 89 plan items genuinely done, rejected three findings as wrong, and
surfaced real defects. The important ones were not the ones anyone would have
guessed.

## What it caught that the implementation missed

**A contrast failure that automated testing reports as clean.** The single
accent cell in the homepage numbers strip is 66px champagne on the dim light
surface: **1.75:1**, which fails even the lenient 3:1 large-text threshold. axe
reports zero violations for that node. The Round-4 claim of "zero axe violations"
was therefore *true and insufficient* — a good illustration that a passing
scanner is evidence, not proof. Fixed to 7.10:1, and `a11y.js` now runs an
independent contrast sweep over every visible text node in both themes. That
sweep was validated by reverting the fix and confirming it reports the node.

**No-JS visitors on phones had no navigation at all.** Below 900px the nav was
`display: none`, revealed only by a JS-added class, so the hamburger was a dead
control and every navigation link was unreachable without JavaScript — while
`accessibility.html` claimed "nothing is hidden waiting for a script". Both the
code and the claim were wrong. The nav now stays visible and wraps by default,
and JS opts into the collapsible behaviour; the reel arrows, likewise dead
without JS, are hidden until wired.

**A performance regression introduced by a privacy fix.** Self-hosting the
Unsplash covers in Phase 1B dropped `auto=format`, so the homepage began shipping
~424KB of JPEG where browsers had been getting WebP. WebP siblings are now
encoded locally and served via `<picture>`: 424KB → 257KB, no new dependency.

**The harness asserted less than it claimed.** `headers.js` accepted looser
values than `EDGE-SETUP.md` mandates and never checked the meta/header CSP sync
the runbook calls mandatory — it would have passed a misconfigured edge. The
skip-link test ran only on `index.html`. `links.js` never followed the manifest.
`tools/.gitignore` excluded `package.json` while the README said to install
playwright alone, so a fresh clone could not run half the checks.

Plus: `theme-color` gated on `prefers-color-scheme` while the theme actually
follows the toggle; a marquee button setting both `aria-pressed` and a swapping
`aria-label`, which announce the same state twice and disagree;
`accessibility.html` pointing complainants at DIGG, which supervises
public-sector bodies rather than a private consultancy; and an unqualified "no
cookies" on the same page that announces a Cloudflare layer.

## What it correctly rejected

Three findings were thrown out by the adversarial pass: a claimed contradiction
between `.panel-label` and `.eyebrow--accent` (the two comments agree — one is a
plain modifier, the other explicitly the paired form); a claimed convention
breach by `.heading-spaced` (based on a misreading of AGENTS.md); and an
objection to `assets/CREDITS.md` being unpublished. Rejecting these matters as
much as finding the rest: an audit that confirms everything is not an audit.

## What this says about the earlier rounds

Every substantive claim in Rounds 1–4 held up except the accessibility one, and
that failed in a specific, instructive way: the tool was run correctly, reported
honestly, and still did not support the conclusion drawn from it. The corrected
position is in `accessibility.html`, which now states the target, the testing,
and what has not been independently verified.

The remaining open items are unchanged and unchanged for good reasons: the
Cloudflare edge (runbook written, needs DNS access), the footer VAT number and
photographer attribution (facts only the company can supply — automated
attribution lookup is blocked by Unsplash's bot check), and branch protection
(a GitHub setting, not a commit).

---

# Round 6: Google Analytics behind consent, a recorded downgrade

**Date:** 2026-10-19.

Rounds 1 to 5 ended with a policy that let the page load nothing from anyone but
its own host. Round 6 gives that up on purpose. The owner approved Google
Analytics 4 behind opt-in consent, in Consent Mode "basic" (nothing is requested
from Google before the visitor accepts), with a compact bar fixed to the bottom
of the viewport, shipped as one branch that is merged only when a written
pre-flip checklist is complete. The real Measurement ID was not available, so
`app.js` ships the inert placeholder `G-XXXXXXXXXX`.

This round records what that costs. It is a security downgrade, taken for a
business reason, and it is written down so that nobody later mistakes it for an
oversight or widens it further without knowing what it already spent.

Method: a design phase (repository mappers, three researchers, a designer and two
adversarial reviewers, both of whom returned "revise"), then a build, then two
independent reviews of the built module and bar, one of its logic and one of its
layout and accessibility. The reviewers' findings were fixed before this round
was written; the notable ones are listed below. Everything measured was measured
in Chromium, with Google's script replaced by a stub and every other off-origin
request aborted. No run in this round touched a real Google property.

## Earlier statements that are now historical

Nothing in Rounds 1 to 5 was rewritten. These statements were true when they were
made and are no longer true of the current site; the earlier text carries a note
at the point where it is affected.

- Round 4: the policy is `'self'`-only, "with no third-party origin at all".
- Round 4 verdict and Round 3 grade: "a CSP with no third-party origin", "nearly
  third-party-free".
- Round 4: "zero off-origin requests". Still true for a visitor who has not
  accepted, which is what `requests.js` measures. Not true after Accept.
- Round 2: the table row "`script-src 'self'` with no `'unsafe-inline'` holds".
  Still true for inline script; `script-src` now also names one Google path.
- `SECURITY.md` and the privacy notice, which said there was no analytics and no
  cookies. Both were rewritten in this round.

## What changed

- **A third feature in `app.js`**: consent and Google Analytics, a third IIFE
  after the theme and the mobile nav. It does nothing while `GA_ID` is the
  placeholder (or anything that is not a well-formed GA4 ID): no markup, no
  storage read or write, no listener, no class on `<html>`, no cookie deletion.
- **When active**: a compact, non-modal consent bar with two identical buttons,
  Decline and Accept; a "Cookie settings" link in every footer that reopens it;
  the same two buttons in place on the privacy notices; the choice kept in
  `localStorage` under `vynatix-consent` as `v1:granted:YYYY-MM-DD` or
  `v1:denied:YYYY-MM-DD`, valid for 365 days and parsed fail-closed.
- **After Accept only**: `gtag.js` is injected (one `<script>`, no preconnect,
  prefetch or preload anywhere), Consent Mode defaults and updates are sent, and
  `config` runs with Google Signals and ad personalisation off and a 365-day
  cookie lifetime. Decline and withdrawal set Google's own `ga-disable` flag,
  send `analytics_storage: denied`, and delete `_ga` and `_ga_*` for the host and
  every parent domain. The stored choice is re-read on `pageshow` (back/forward
  cache), `visibilitychange` and `storage`.
- **The CSP**, on every page and in `EDGE-SETUP.md`, and in the Cloudflare
  dashboard if the edge is live (below).
- **Documentation and records**: the privacy notice rewritten as a draft for
  counsel, with a new Swedish notice (`integritet.html`, the 21st page), both
  carrying visible markers for facts only a human can supply; `SECURITY.md`,
  `EDGE-SETUP.md`, `AGENTS.md` and `CLAUDE.md` updated; and
  `tools/PRE-FLIP-CHECKLIST.md`, the hard gate for switching analytics on.
- **Checks and helpers** (see "How it was tested").

Decisions the owner took: event data retention 2 months; Google Signals and ad
personalisation off; the `_ga` cookie lifetime 365 days, never longer than the
consent record; outbound-click and download events switched off in the property;
Consent Mode basic.

## The downgrade, host by host

Before: `script-src 'self'` and no `connect-src`, which falls back to
`default-src 'self'`. No script could load from anywhere else and nothing could
be sent anywhere else, whatever happened to the page. After:

```
default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data:;
style-src 'self'; font-src 'self';
script-src 'self' https://www.googletagmanager.com/gtag/js;
connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com;
form-action 'self'; upgrade-insecure-requests
```

The edge header is the same with `frame-ancestors 'none'` before
`upgrade-insecure-requests`.

| Directive and host | What it is for | What it costs |
|---|---|---|
| `script-src https://www.googletagmanager.com/gtag/js` | The one Google script. | Third-party code with full access to the page runs after Accept, and Google can change it without our review. Subresource Integrity is not possible for a file that changes. The path pin keeps the rest of the host out. It blocks `gtm.js`, Tag Manager's container loader, which runs whatever a container holds; the dummy-ID probe confirmed `gtm.js` was blocked while `gtag.js` worked. Google's own CSP Evaluator lists this host among its known allow-list bypasses, though those work only where `'unsafe-eval'` is allowed, which this policy does not do. The pin is weaker than it looks in two ways: CSP matching ignores the query string, so `gtag/js?id=` with any ID is allowed, and the specification ignores a source's path for a request that was redirected. |
| `connect-src https://*.google-analytics.com` | Where the collect hits go. The probe showed it is needed. | A wildcard on a service that accepts a hit for any property. Script that ran on the page could send arbitrary data to a property the attacker owns, because the hit carries the property ID and the policy cannot tell ours from anyone else's. This is a generic exfiltration channel, and no CSP control narrows it. |
| `connect-src https://www.googletagmanager.com` | Named in Google's CSP guidance. | Same class of channel, narrower. The probe did not show it is needed; it stays on Google's word until the real-ID run says otherwise. |
| `connect-src https://*.analytics.google.com` | Named in Google's EU help page, not in its CSP guide. | As above. The probe did not need it. |

Unchanged: `img-src 'self' data:`, `style-src 'self'`, `font-src 'self'`,
`default-src 'self'`. Refused: `https://*.google.com`, any advertising or
doubleclick host, `'unsafe-inline'`, `'unsafe-eval'`. Google's two documents
disagree about the host list, so the set is the union of what the probe needed and
what each document names; the real-ID test decides which can go, and a host that
turns out to be missing is added by name.

Two properties of this downgrade are worth stating plainly.

- **The policy reaches every visitor, consenting or not.** A `<meta>` CSP is
  static and cannot depend on consent, so the channel above exists in every
  visitor's browser from the day it ships. Only JavaScript decides whether
  anything is sent. The protection against abuse is therefore the same as it was
  in Round 2: there is no known way to run an attacker's script on these pages.
  Round 6 keeps that true (the module has no HTML sink, builds its markup with
  `createElement` and `textContent`, and takes the script URL from a constant
  that is validated and URL-encoded), but it no longer has a second line behind it
  for data leaving the page.
- **The policy now lives in three places** that must change together: the meta
  tag in each of the 21 pages, `EDGE-SETUP.md`, and the Transform Rule in the
  Cloudflare dashboard. `csp.js` guards the first two against each other. The
  third is guarded only by `headers.js` against the live origin, and only once
  the edge exists. The order that matters when the edge is live is to widen the
  dashboard rule first, because the meta and the header are intersected: a
  narrower header blocks Google silently, while a wider one is bounded by the meta.

Cloudflare was not live on 2026-10-19 (`server: GitHub.com`, `cache-control:
max-age=600`, no `content-security-policy` header), so the meta tag is the only
policy in force. Zaraz, Workers and server-side tagging are not available routes
today, so the consent gate has to live in `app.js`.

## How it was tested

Core build and its two reviews (Chromium, stubbed `gtag.js`, every non-local
origin aborted):

- **Nothing before consent.** On an undecided visit, and on a denied one: zero
  requests off the origin, no `<script>` for Google, no preconnect, prefetch or
  preload, no cookies, no `dataLayer`, and no write to the consent key.
- **Inert placeholder.** Eighteen malformed or placeholder-shaped IDs, each
  footprint-identical to a build with the whole block stripped out. One review
  finding led to a fix: a placeholder with a different number of X characters had
  passed the ID pattern, so any run of X characters after `G-` is now treated as
  the placeholder.
- **Stored choice.** 63 parse cases (wrong version, impossible and future dates,
  expired, `__proto__`, markup, a 2 MB value) all fail closed.
- **Accept, decline, re-accept, withdrawal**; cross-tab changes; a real
  back/forward-cache restore; blocked, throwing and read-only storage; Swedish.
- **Layout and accessibility**: bar size at 320, 360, 390, 412, 768 and 1440 wide;
  the open mobile menu over the bar (1,344 of 1,344 hit tests pass); keyboard
  focus never fully behind the bar (18,216 Tab stops); axe-core with the bar
  visible (108 runs, no violations); contrast from rendered colours in all six
  themes; forced colours; reduced motion; no-JS.
- **Fixed after review**: a stale tab closing could delete the cookies a granted
  tab was using; holding Enter on "Cookie settings" could press Decline; pressing
  "Cookie settings" while the first-visit bar was already up gave Escape and focus
  return nothing to act on, and a reopened bar after a failed save had no status
  line; a failed save could leave a dead Accept; the bottom reserve for WCAG 2.4.11
  was a fixed length that did not grow with text size (now in `rem`).
- **Accepted, with the reason**: the reopened bar (first-visit text plus a status
  line) is 183px tall at 320px wide, above the 160px aimed for, because no copy
  that keeps Google, cookies, who counts and how to change it fits in less. The
  first-visit bar is 158px. Both are under half the viewport.

New checks in `tools/verify/` and helpers in `_common.js`. The names and one-line
purposes below come from the build contract:

| Name | Purpose |
|---|---|
| `csp.js` | Static: the meta CSP is identical on all 21 pages, matches `EDGE-SETUP.md`, and names only the allow-listed Google hosts. |
| `consent.js` | Behaviour: nothing before consent, accept, decline, withdrawal, poisoned storage, no-JS, blocked storage, Swedish. |
| `consent-layout.js` | Bar size, the open menu over the bar, focus never hidden behind the bar, in six themes. |
| `release-gate.js` | Fails while `GA_ID` is the placeholder, or while any claim, marker or placeholder text would contradict going live. Not part of `npm run check`. |
| `consent-live.js` | Opt-in. Real network, the dummy ID `G-TEST000000`, never a real property. |
| `pinConsent`, `armGa`, `rewriteGaId` | Helpers: pin a stored choice, arm a page so the module is active under test, and rewrite the `GA_ID` line by pattern, failing loudly on no match or more than one. |

The placeholder is inert, so the existing browser checks (axe, contrast, theme,
screenshots) would audit a page with no bar in it. `armGa` exists so that they can
run with the module active, and one unarmed run proves the inert state.

## What remains unverified

- **A real property.** Nothing in this round ran against a real Measurement ID.
  Which Google hosts a real property needs, whether `img-src` must widen, and
  whether Google's release note of 2026-09-21 affects this property are all
  open. The note says hostname Include filters block events with an empty
  hostname, "such as gtag.js traffic", and its effect on web streams is unclear.
  The pre-flip checklist makes the real-ID run a hard gate, and says a dummy-ID
  pass is not a substitute.
- **Real `gtag.js` on withdrawal.** The stub emulates Google's documented
  behaviour only. Whether the real script re-reads `ga-disable-<ID>` at hit time,
  writes a cookie after `analytics_storage: denied`, or sends cookieless pings
  under denial is unproven. The cookie names, domain and lifetime come from
  Google's help page, not from observation.
- **Firefox and WebKit.** Layout, CSP, storage and back/forward-cache behaviour
  were exercised in Chromium only. Safari's Intelligent Tracking Prevention can
  cap script-written storage at seven days, which would make the stored choice
  lapse early and fail closed (the bar returns); that was not observed.
- **People and devices.** A screen reader pass, a keyboard-only walk by a person,
  real key auto-repeat timing, Firefox's text-only zoom, real phones with their
  toolbars and keyboards.
- **Cloudflare.** Not live, so its defaults, the cookies it would set and the
  optimisations that would rewrite the pages are unobserved; `EDGE-SETUP.md`
  lists what to check.
- **The law.** The legal sources behind the privacy drafts were read through
  summarising tools, not primary texts: the state of the EU-US Data Privacy
  Framework listing and of the pending appeal in C-703/25 P, the Swedish
  regulator's cookie guidance, and the text of the Swedish electronic
  communications act. The notices are drafts for counsel and say so.
- **The new checks themselves.** A check that has only ever passed proves little
  (Round 5's lesson). Each of the checks above should be shown to fail when the
  behaviour it guards is broken: request `gtag.js` before consent, add a Google
  host to one page's meta, change the footer link. Record the result here when
  it has been done.

Known limits of the module, none of them a privacy failure but all of them
worth knowing: with read-only storage a Decline cannot be saved, so an earlier
grant survives to the next load (the page says so); a click dispatched by a script
on the page, or by an auto-dismiss extension, records a choice; the stored choice
is per origin, so `www.vynatix.com` and `vynatix.com` do not share it; the
cookie purge covers every parent domain by design, so another Google property on
a sibling subdomain would lose its `_ga` cookies on a visit that has not accepted;
a visitor who accepts and never returns keeps a `_ga` cookie that gtag renews on
each hit, up to a year past the consent record, and the next visit deletes it;
and a bare revert of `GA_ID` cannot reach a tab that already loaded `gtag.js`,
which keeps measuring until it is reloaded or until a purge-mode build clears the
stored choice (the re-read of the stored choice covers a visitor's own withdrawal,
and a cleared choice, not a change on the server).

## Round-6 verdict

The site's exposure changed from "no allowed outbound host" to "no known way to
run script, and one family of outbound hosts that is a generic channel if a way is
ever found". That is a real downgrade. It was taken knowingly, for a stated
purpose, with the script pinned to one path, the two connect hosts the probe did
not need kept only on Google's guidance until the real-ID run, and the moves that
would widen it further refused in writing. It takes
effect when the branch is merged, and the merge is gated on the pre-flip
checklist, so a policy that is wider than its unproven parts need is not meant
to ship ahead of the evidence.

What remains is the checklist: the facts only the company can supply, the real
property and the other two engines, the people who have to look at it, and the
edge, if it is live by then. The exit is rehearsed in the same document: the first
action is the one-line revert of `GA_ID`, and the realistic tail is 10 to 20
minutes on GitHub Pages and longer behind Cloudflare unless Browser Cache TTL
respects the origin's headers.
