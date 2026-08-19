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
`tools/` now holds five checks, excluded from the published site and with their
`node_modules/` gitignored, so the site itself still has no build step:

| Check | What it proves |
|---|---|
| `screenshot.js` | 9 pages × light/dark, pixel-diffed against a baseline |
| `adversarial.js` | the CSP **blocks** 7 concrete attacks |
| `requests.js` | **zero** off-origin requests; fonts resolve |
| `a11y.js` | axe-core WCAG 2.0/2.1/2.2 A+AA, plus skip link, marquee, no-JS and reduced-motion behaviour |
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
violations across all nine pages in both themes, where it previously found 23.

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
Three pages were written and all 27 footer links repointed. The privacy notice
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
injection/XSS/redirect/exfiltration path, a CSP with no third-party origin that
is *proven* to block seven concrete attacks, zero off-origin requests, zero axe
violations across nine pages in both themes, no broken links, and legal and
accessibility pages that describe reality rather than aspiration — including
where it falls short.

What remains is one infrastructure change and a handful of facts only the
company can supply.
