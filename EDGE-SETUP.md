# Edge setup: security headers for vynatix.com

## Why

The site's Content-Security-Policy is delivered as a `<meta>` tag, which is all
GitHub Pages allows. Several controls are **HTTP response headers only** and
cannot be expressed in markup at all, so they are missing today:

| Control | Why it can't ship from the repo |
|---|---|
| `Strict-Transport-Security` | header-only |
| `X-Content-Type-Options: nosniff` | header-only, no meta equivalent |
| `X-Frame-Options` / CSP `frame-ancestors` | **ignored** in a meta CSP by spec — the site can currently be framed |
| `Permissions-Policy` | header-only |
| `Cross-Origin-Opener-Policy` / `-Resource-Policy` | header-only |
| CSP `report-to` / `Reporting-Endpoints` | ignored in a meta CSP |

Putting Cloudflare in front of GitHub Pages closes all of them without moving
the hosting. The free plan is sufficient; none of this needs a Worker.

## Before you start

- Admin access to the `vynatix.com` DNS and a Cloudflare account.
- Confirm **Settings → Pages → Enforce HTTPS** is already ticked on the
  repository, and that `https://vynatix.com` loads correctly *before* you
  proxy anything.

> **Ordering gotcha.** GitHub issues the Let's Encrypt certificate for the custom
> domain by validating over HTTP against DNS that points at GitHub directly. If
> the Cloudflare proxy is enabled first, that validation fails and *Enforce
> HTTPS* stays greyed out. Always: DNS unproxied → certificate issued → Enforce
> HTTPS on → then switch the proxy on.

## 1. DNS

Add the domain to Cloudflare and recreate the existing records. For an apex
domain on GitHub Pages that means A records (Cloudflare flattens the apex):

```
A     vynatix.com    185.199.108.153
A     vynatix.com    185.199.109.153
A     vynatix.com    185.199.110.153
A     vynatix.com    185.199.111.153
CNAME www            vynatix.github.io
```

Verify the current addresses against GitHub's own documentation before you
paste them — GitHub has changed them before. Keep the `CNAME` file in this repo
exactly as it is; Pages still needs it.

Leave every record **DNS-only (grey cloud)** for now.

## 2. Certificate, then proxy

1. Confirm `https://vynatix.com` still serves and *Enforce HTTPS* is ticked.
2. In Cloudflare, set **SSL/TLS → Overview → Full (strict)**.
   **Not Flexible.** Flexible would leave the Cloudflare→GitHub hop in
   plaintext, which is a real downgrade dressed up as a padlock.
3. Turn on **SSL/TLS → Edge Certificates → Always Use HTTPS**.
4. Now switch the `vynatix.com` and `www` records to **Proxied (orange cloud)**.
5. Reload the site and confirm it still works before continuing.

## 3. Response headers

**Rules → Transform Rules → Modify Response Header → Create rule**, applied to
all incoming requests. Add each as a *Set static* header:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Content-Security-Policy` | see below |

The CSP header is the same policy the pages already carry, plus the one
directive a meta tag cannot express:

```
default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'self' https://www.googletagmanager.com/gtag/js; connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

This is no longer a `'self'`-only policy. It names Google's analytics hosts for the
consent-gated Google Analytics feature in `app.js` (section 6), and that is a
recorded security downgrade (`SECURITY-ASSESSMENT.md`, Round 6). `script-src` is
pinned to the path `/gtag/js`, so Tag Manager's `gtm.js` is not allowed, and
`img-src` is unchanged. There is no `https://*.google.com`, no `'unsafe-inline'`
and no `'unsafe-eval'`, and none may be added to make a measurement work: a
violation names the one host that is missing, and that one host is added.

### On HSTS

Start **without** `preload`. `max-age=31536000` tells browsers that have already
visited to use HTTPS for a year; that is reversible by lowering the max-age.
Submitting to the preload list is not practically reversible and applies to
every subdomain, so only add `preload` once you are certain every current and
future subdomain will always serve HTTPS.

### Keep the meta CSP

Do **not** delete the `<meta>` CSP from the pages once the header exists. Both
are enforced independently and a resource must satisfy both, so the meta tag is
a free fallback if the edge is ever bypassed or misconfigured.

The consequence is that the policy now lives in three places that must change
together: the `<meta>` tag in each of the 21 pages, the header value above, and
the Transform Rule in the Cloudflare dashboard. The header carries exactly one
directive more than the meta (`frame-ancestors 'none'`); if you change one,
change the others in the same piece of work.

Order matters once the edge is live. A resource has to pass the meta and the
header independently, so a header narrower than the meta silently blocks Google
Analytics and nothing reports it, while a header wider than the meta is simply
bounded by the meta. **Widen the dashboard rule first, then the pages.**
`verify/csp.js` checks the 21 pages against this file; `verify/headers.js` checks
the live header against the live meta.

### Optional: violation reporting

CSP reporting needs `Reporting-Endpoints` plus `report-to` in the policy.
Note that pointing reports at a third-party collector creates a new data flow
involving visitor requests — it belongs in the privacy notice, and a
first-party Cloudflare Worker endpoint avoids that entirely. Left out of the
baseline for that reason. One cost of leaving it out: a meta CSP reports
nothing, so a policy that is too tight for Google Analytics loses hits without
any signal. That is why the real-property test in `tools/PRE-FLIP-CHECKLIST.md`
listens for `securitypolicyviolation` events before the flip.

### Caching

Know what the proxy does to cache lifetimes before enabling it. GitHub Pages sends
`Cache-Control: max-age=600` on every file. For the file types Cloudflare caches
by default (stylesheets, scripts, images, fonts), its Browser Cache TTL defaults
to 4 hours and raises a shorter origin value, while the HTML pages are not cached
by default and keep the 600 seconds. That is the same gap that mixed new pages with
old stylesheets for a visitor: assets outlive the page that uses them.

The four shared files (`tokens.css`, `colors_and_type.css`, `styles.css`,
`app.js`) are referenced with a content stamp (`?v=1a2b3c4d`, see `tools/stamp.js`),
so a long lifetime is safe for them in browsers. Fonts and images are not stamped,
so a replaced font or photo can stay stale in a browser for up to 4 hours unless
**Caching → Configuration → Browser Cache TTL** is set to *Respect Existing
Headers*. Set it before analytics is switched on (section 6): it also decides how
long a reverted `app.js` can be held. Either way, do not add a rule that
lengthens the lifetime of the HTML pages, and purge the zone after a deploy if
any caching rule is added.
Check what a visitor receives with
`curl -sSI https://vynatix.com/styles.css | grep -i cache-control`.

## 4. Verify

From any machine, once the proxy is live:

```sh
curl -sSI https://vynatix.com | grep -iE 'strict-transport|content-security|x-content-type|x-frame|referrer-policy|permissions-policy|cross-origin'
```

Or run the scripted check in this repo, which asserts every header above and
fails loudly on anything missing or wrong:

```sh
cd tools && BASE=https://vynatix.com/ node verify/headers.js
```

Then re-run the content checks against the live origin:

```sh
cd tools
BASE=https://vynatix.com/ node verify/requests.js      # zero off-origin requests, before any consent
BASE=https://vynatix.com/ node verify/links.js         # no broken links
```

`requests.js` never presses Accept, so it must see zero Google traffic whether or
not analytics has been switched on. That makes it the check that catches anything
the edge adds on its own (a beacon, an injected script).

And confirm the publish exclusions still hold — these must 404, because the
marketing domain should not serve its own developer documentation:

```sh
for f in SECURITY-ASSESSMENT.md AGENTS.md CLAUDE.md SECURITY.md EDGE-SETUP.md tools/PRE-FLIP-CHECKLIST.md; do
  echo "$f -> $(curl -s -o /dev/null -w '%{http_code}' https://vynatix.com/$f)"
done
curl -s -o /dev/null -w 'security.txt -> %{http_code}\n' https://vynatix.com/.well-known/security.txt
```

Expected: `404` for every document, `200` for `security.txt`.

## 5. Rollback

Every step is reversible. Switch the DNS records back to **DNS-only (grey
cloud)** and the site serves straight from GitHub Pages again, exactly as it
does today — the meta CSP still applies, and only the header-only controls go
away. The Transform Rules can be left in place; they simply stop applying.

The one thing that lingers is HSTS: browsers that already saw the header will
insist on HTTPS for the remainder of `max-age`. That is harmless here, since the
site is HTTPS-only regardless, but it is the reason not to add `preload` early.

Going back to DNS-only does not take Google out of the policy, because the pages'
meta tag names the same hosts, and it does not switch analytics off. Analytics is
switched off by the `GA_ID` line in `app.js` (section 6).

## 6. Google Analytics

`app.js` can load Google Analytics 4, but only once `GA_ID` holds a real
Measurement ID and only after a visitor presses Accept on the consent bar. The
site ships with the inert placeholder, so none of this applies until someone
flips it. The flip itself, and everything that has to be true before it, is in
`tools/PRE-FLIP-CHECKLIST.md`. This section is what the edge adds to that.

Is the edge live? On 2026-10-19 the answer was no: `server: GitHub.com` and no
`content-security-policy` header, so the meta tag was the only policy in force.

```sh
curl -sSI https://vynatix.com/ | grep -iE '^(server|content-security-policy)'
```

If it is live, or going live around the flip, work through the steps below in
order. If it is not, the only edge-side work is keeping the string in section 3
correct, so that it is right on the day the edge does go live.

### Widen the dashboard rule first

Edit the `Content-Security-Policy` value of the Transform Rule to the string in
section 3 **before** any page carries the widened meta. That order is safe: the
meta still bounds what the wider header allows. The reverse order is not. A
header narrower than the meta blocks the Google script and the beacons for every
visitor, with no violation report to tell you, and the failure looks like a
property that receives no data.

### Browser Cache TTL: Respect Existing Headers

Set **Caching → Configuration → Browser Cache TTL** to *Respect Existing Headers*
before the flip, and do not add a Cache Rule that lengthens the browser or edge
lifetime of scripts. Cloudflare's default raises the 600 seconds GitHub Pages
sends to 4 hours for scripts, and a revert of analytics should not be held for
hours by a lifetime the edge lengthened. With the setting in place the tail of a
revert is the origin's own 10 minutes plus propagation (the exit runbook in the
checklist gives the figures).

### Pre-flight: what must stay off

These Cloudflare features rewrite the HTML, inject a script, or make a request of
their own. Each one breaks a claim the site makes, so check that each is off
before the flip. The dashboard moves things around, so look for them by name.

- [ ] **Rocket Loader.** Rewrites and defers script tags. `app.js` is loaded
  blocking in the head on purpose, so that the theme is set before the page paints.
- [ ] **Email Address Obfuscation** (Scrape Shield). Rewrites the `mailto:` links
  in the HTML it serves, which includes the footer of every page and
  `contact.html`, into links that are decoded by a Cloudflare script.
- [ ] **Web Analytics automatic setup.** Injects Cloudflare's beacon into every
  page: a third-party analytics request made before any consent.
- [ ] **Zaraz automatic injection.** Injects its own script and loads tools from
  its own configuration. Not part of this design.
- [ ] **Google tag gateway.** Serves the Google tag through a first-party path.
  The policy above and the consent gate assume `app.js` loads
  `https://www.googletagmanager.com/gtag/js` only after Accept; the gateway has
  not been evaluated for this site and is not wanted yet.

Then prove the edge adds nothing. GitHub Pages serves the files verbatim, so the
edge should return exactly what the repository holds:

```sh
curl -s https://vynatix.com/ | diff - index.html && echo identical
curl -s https://vynatix.com/contact.html | diff - contact.html && echo identical
```

Any difference is an optimisation to switch off. `requests.js` (below) is the
second proof.

### Cookies Cloudflare may set

Depending on the features switched on, Cloudflare can set cookies of its own (bot
and challenge features are the usual source). They are not analytics cookies and
they are not covered by the analytics choice, but the privacy notices must not
deny them. `privacy.html` already says the Cloudflare layer may set a cookie and
will be named, and the Swedish notice, `integritet.html`, needs the same update.
When the edge goes live, open the site in a clean browser profile, read the cookies
`vynatix.com` receives (DevTools → Application → Cookies), and write exactly
those names and lifetimes into both notices. Do not copy names from a list.

### Run the live checks before and after the flip

```sh
cd tools
BASE=https://vynatix.com/ node verify/headers.js
BASE=https://vynatix.com/ node verify/requests.js
```

Run both against the live origin once the widened pages are deployed (before the
flip) and again after the flip, and keep the output. `headers.js` fails if the
header and the meta differ by anything other than `frame-ancestors 'none'`, which
is how a half-done widening shows up; it will also say so in the short window
after the dashboard rule is widened and before the pages are. Both checks run in the undecided state (nobody presses Accept), so a
pass after the flip shows that the edge and the consent gate hold, not that
analytics works. That is the real-ID test in the checklist.

### Switching it off again

The first action is always the repository: `GA_ID` back to the placeholder, then
`npm run stamp` (exit runbook in the checklist). If the edge is live there is a
faster stopgap for new page loads: narrow the dashboard rule to the previous
`'self'`-only value. That should stop a freshly loaded page from reaching Google
much sooner than a deploy can (confirm with `headers.js`), but a page that is
already open keeps the policy it loaded with. It leaves cookies already set, and
it leaves the header out of step with the meta until the repository change lands,
so `headers.js` will say so. Treat it as a stopgap in addition to the revert,
never instead of it.
