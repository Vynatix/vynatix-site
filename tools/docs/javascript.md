# JavaScript

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

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
all 34 pages, the string in `EDGE-SETUP.md`, and the Transform Rule in the
Cloudflare dashboard if the edge is live. If it is live, widen the dashboard rule
**first**: the browser enforces the meta and the header independently, so a
narrower header silently blocks Google Analytics, while a wider one is bounded
by the meta. `tools/verify/csp.js` keeps the pages and `EDGE-SETUP.md` in step
(and allows Google hosts only from its list); `headers.js` checks the live
header. Any new third-party script, or any other host, still means widening the
CSP deliberately on **every page** and in `EDGE-SETUP.md`, and updating this file.
