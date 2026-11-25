# Analytics

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

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
set their `mod` in their registry rows (`tools/site/pages/privacy.json`,
`integritet.json`) to the same day, and
run `python3 tools/seo-head.py`. Then edit the `GA_ID` line (a re-flip after an
exit also sets `PURGE_ONLY` back to `false` in the same commit), run
`cd tools && npm run stamp` (`app.js` changed, so every page's stamp moves), then
`node verify/release-gate.js`, then `npm run check`. The flip is the last commit of
the one PR. It changes the `GA_ID` line (and, on a re-flip, `PURGE_ONLY`), those two
dates (the visible lines and `mod` in the two rows), the files `seo-head.py`
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
visible "Last updated" date must equal `mod` in the page's registry row, and that date
must be at most 14 days old); a page without the Cookie settings link in its
footer; a CSP that differs between pages or from `EDGE-SETUP.md`; and any sentence
that still says the site has no analytics or no cookies. When every scripted gate
holds it prints `scripted gates pass, N human gates open` and exits 0, never a bare
PASS: N is the number of gates it lists that only a person can pass, which the
checklist's boxes cover with evidence. It is deliberately **not** part of
`npm run check` (which stays green with the placeholder, and in the exit state),
but its `--self-test` is, and so is `publish.js`.
The gate, `consent.js`, `publish.js` and `copies.js` read the constants of `app.js` with `appConst`
in `tools/verify/_common.js`, the one reader: a lifetime written as a product is read
as its value, and a value it cannot prove fails the check with the name and the
line instead of being read wrong.

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

**Checks.** `csp.js` (the CSP is identical on all 114 pages, root and generated, matches
`EDGE-SETUP.md`, and names only the allow-listed Google hosts; a Google host in any
`<link>` or `<script>` on any page is found whatever the quoting or attribute
order), `publish.js` ("what ships": every root `*.html` has its registry row in
`tools/site/pages` and every row its page; every other root file that is not a page or a listed asset
type, and every directory other than the known ones, is named in `_config.yml`'s
`exclude` or flagged; every footer carries the Cookie settings link with
`data-consent-open` and `href="privacy.html#cookies"` (`../privacy.html#cookies` on a generated page); the notice link in `COPY`
points at the right notice page; both notices name the three storage keys in
`<code>`; the site's style rules are linted (role tokens only: no colour literal in
`styles.css` outside the token files, and no inline style in a page or from
`app.js`); no `.nojekyll` in the published tree and no published file that begins with `---`; every
`url()` of every published stylesheet names a published file; and `llms.txt` links every URL in `sitemap.xml`),
`consent.js`
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
