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
default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

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

The consequence is that the two must be changed together. The header carries
exactly one directive more than the meta (`frame-ancestors 'none'`); if you
change one, change the other in the same commit.

### Optional: violation reporting

CSP reporting needs `Reporting-Endpoints` plus `report-to` in the policy.
Note that pointing reports at a third-party collector creates a new data flow
involving visitor requests — it belongs in the privacy notice, and a
first-party Cloudflare Worker endpoint avoids that entirely. Left out of the
baseline for that reason.

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
BASE=https://vynatix.com/ node verify/requests.js      # zero off-origin requests
BASE=https://vynatix.com/ node verify/links.js         # no broken links
```

And confirm the publish exclusions still hold — these must 404, because the
marketing domain should not serve its own developer documentation:

```sh
for f in SECURITY-ASSESSMENT.md AGENTS.md CLAUDE.md SECURITY.md EDGE-SETUP.md; do
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
