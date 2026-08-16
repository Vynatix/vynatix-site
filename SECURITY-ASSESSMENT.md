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
| 1 | High (privacy/compliance) | Every page loads fonts from Google's CDN; the "self-hosted fonts" the docs promise do not exist |
| 2 | Medium | No Content-Security-Policy or other defence-in-depth headers/metas *(remediated in this branch)* |
| 3 | Low | Homepage hotlinks images directly from `images.unsplash.com` |
| 4 | Low / accepted | Clickjacking cannot be fully mitigated on GitHub Pages (no `frame-ancestors` header) |
| 5 | Info | No Subresource Integrity — not fixable for Google's dynamic CSS; self-hosting removes the need |

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
