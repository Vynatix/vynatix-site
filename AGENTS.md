# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

The marketing website for **Vynatix**, a Nordic software consultancy in
Gothenburg. It is a small, **hand-written static site** — no framework, no build
step, no package manager, no bundler. What is in the repo is exactly what ships.

It is served as a flat set of HTML files at the domain in `CNAME`
(`vynatix.com`) via **GitHub Pages**. Editing a file and pushing to the default
branch publishes it; there is nothing to compile.

The site is built on the **Vynatix Design System**, which lives outside this
repo as a Design System artifact (the brand book, `tokens.json`, the component
cards, the logo artwork, the icon set and the fonts). Two of its files are
copied in verbatim (see *Three-layer CSS*); everything else here is written
against the roles and components the system defines.

## Layout

```
index.html          Home — hero, still client list, services, work cards, metrics, CTA band
about.html          Company / team
services.html       Application dev, AI engineering, cloud platforms
work.html           Selected case studies
membership.html     "Collective" / careers for senior engineers
contact.html        Two-inbox contact page (no form — mailto links)
privacy.html        Privacy notice (GDPR Art. 13), with the analytics and cookies
                    section (#cookies) and the in-page consent buttons
terms.html          Website terms of use
accessibility.html  Accessibility statement
android-automotive-development.html   Android Automotive in Gothenburg (English twin of
                    android-automotive-utveckling.html)
ai-engineering.html AI engineering in Gothenburg (English twin of ai-utveckling.html)
android-automotive-consultancies-gothenburg.html  Alphabetical, sourced list of Gothenburg
                    consultancies working on Android Automotive (English twin)
sv.html             Swedish home and hub for the Swedish pages (twin of index.html)
android-automotive-utveckling.html, ai-utveckling.html,
konsultbolag-android-automotive-goteborg.html   Swedish twins of the three pages above
valja-konsultbolag.html, platform-engineering.html, ai-assistent-interna-dokument.html,
ai-konsultbolag-sverige.html   Swedish guides
integritet.html     Swedish privacy notice, the twin of privacy.html (the fifth
                    English/Swedish pair); the Swedish consent bar links to it.
                    Twenty-one pages in total
robots.txt          Allows every crawler, names the AI search agents, points at the sitemap
sitemap.xml         Every page, its lastmod and its hreflang pair (hand-maintained)
llms.txt            A plain-text summary of the company and every page, in both languages
<32 hex>.txt        The IndexNow key file (tools/indexnow.js proves ownership with it)
tokens.css          Design system layer 1: the tokens, generated from the system's
                    tokens.json (colour roles for six themes, spacing, radii, type
                    scale, @font-face). Only the @font-face src lines are the site's.
colors_and_type.css Design system layer 2, verbatim: reset, semantic helpers,
                    .eyebrow, .btn, .card, .glass, .container, per-theme typefaces
styles.css          Layer 3, the site's own: page chrome and components on the roles
app.js              All client behaviour (vanilla JS, IIFEs, no modules): the theme,
                    the mobile nav, and analytics consent (see Analytics)
assets/             Logo files in Forest inks, inline-icon SVGs, self-hosted case
                    photos (jpg + webp), app icons
fonts/              Self-hosted woff2 subsets of the system's faces, plus licences
favicon.svg/.ico    Theme-aware SVG icon (Forest / Cream) + 16/32/48 ICO fallback
apple-touch-icon.png
site.webmanifest    Name, colours and icons for installed/Android use
CNAME               GitHub Pages custom domain
_config.yml         Controls what GitHub Pages publishes (excludes dev docs)
.well-known/        security.txt (RFC 9116 disclosure contact)
SECURITY.md         Disclosure policy (GitHub surfaces it) — not published
CODEOWNERS          Review ownership — not published
EDGE-SETUP.md       Cloudflare runbook for the header-only controls — not published
tools/              Local verification scripts, stamp.js (writes the ?v= version
                    stamps into the pages) and seo-head.py (rewrites the search
                    block, footer and sitemap) — NOT published, not part of the site
tools/PRE-FLIP-CHECKLIST.md   The hard gate for switching analytics on (not published)
```

There is no `assets/`-level JS or CSS — those folders are static files only.

## Architecture & conventions

**Three-layer CSS.** Every page links the three files in this order:

- `tokens.css` is the design system's generated token sheet. It declares the
  Material 3 colour roles (`--md-sys-color-*`) and their aliases (`--bg`, `--fg`,
  `--text-body`, `--text-muted`, `--text-display`, `--text-accent`,
  `--primary-hover`, `--focus-ring`, `--indicator`,
  `--inverse-on-surface-variant`, the `--success`/`--warning`/`--info` roles,
  the glass tints, `--shadow-l1`…`l5`) for all six themes, plus `--space-*`,
  `--radius-*`, `--text-*` sizes, `--leading-*`, `--tracking-*`, `--icon-*`,
  `--font-*` and the `@font-face` rules. Treat it as read-only: it is the
  system's file. The one site-specific edit is the `@font-face` block, which
  points at the woff2 subsets in `fonts/` instead of the system's TTFs and
  leaves out the 4 MB icon font (the block says so at the top).
- `colors_and_type.css` is the system's hand-written layer, copied verbatim:
  motion, the glass blurs, the reduced-motion and reduced-transparency
  overrides, the per-theme typefaces (`--font-display`, `--font-body`,
  `--font-editorial`, `--font-subhead`), the reset, the semantic helpers
  (`h1`–`h6`, `p`, `p.lede`, `a`, `ul` with the indicator dash, `blockquote`,
  `code`, tables, forms), `.eyebrow`, the `.btn` family, `.card`, `.glass`,
  `.container` and the `.ms` icon classes (unused here, see *Icons*).
- `styles.css` is the site's own layer and the only one you normally edit. It
  consumes **role tokens only**: no raw hex, no palette tokens (`--forest-*`,
  `--teal-*`, `--mono-*` and friends), no `[data-theme]` selectors. A rule
  written that way holds in all six themes automatically. Sizes come from the
  scales. New components follow the system's cards (TopAppBar, Button, Card,
  EditorialCard, MetricCard, Banner, FocusRing, Logo); the file's comments
  name which pattern each block implements.

**Version stamps on the four shared files.** Every page loads `tokens.css`,
`colors_and_type.css`, `styles.css` and `app.js` with a content hash in the URL
(`styles.css?v=1a2b3c4d`). GitHub Pages serves each file at one fixed URL with
`Cache-Control: max-age=600`, and nothing makes a browser refetch a stylesheet
when the page that uses it changes, so after a redesign a phone can hold the new
HTML beside the old stylesheet (iOS Chrome did exactly that after the
design-system migration: icons at full width in black, default list bullets, an
unstyled header). A changed file gets a URL the visitor's browser has never
cached, so the HTML names the exact stylesheet it was written for. **After you
change any of the four files, run `cd tools && npm run stamp` and commit the
updated pages with the change.** `npm run check` (`node stamp.js --check`) fails
until you do, and `verify/stale-cache.js` proves, in a browser holding an old
copy of all four files under the plain URLs, that the stamped pages still come
out right (`ENGINE=webkit node verify/stale-cache.js` runs it in WebKit, the
engine iOS Chrome uses). A new page must load all four files; the stamp check
fails if it does not.

What the stamps do not cover: GitHub's CDN ignores the query string, so it can
answer a new stamp with the previous bytes until a deploy replaces its copy (the
stamps protect the visitor's browser, not the CDN); and an old HTML page cached
next to the new stylesheet cannot be helped on a host that keeps one file per
path. Fonts and images are not stamped. They are replaced in place under fixed
names, and `app.js` preloads fonts by the plain URL the `@font-face` rule uses,
which the two must keep identical to be reused. If a font or image changes in a
way a stale copy would make visible (glyph coverage, metrics, a different
picture), give it a new file name and change it in `tokens.css` and in
`DISPLAY_FACES` in `app.js` together. (The redesign changed Instrument Serif, the
app icons, the favicon and the manifest in place; that was checked and is
harmless.)

**Theming.** The design system has three brand directions, each with a light
and a dark theme, over one set of roles: Forest Heritage (`light`, `dark`),
Transformative Teal (`teal-light`, `teal-dark`) and Stockholm Monochrome
(`mono-light`, `mono-dark`). **The site draws one direction at random for each
visit.** `app.js` is loaded in the `<head>`, without `defer`, so its first
block runs before the body exists and sets `data-theme` (and `theme-color`)
before anything paints; the CSP rules out an inline script, so a small blocking
first-party file is the way to avoid a flash of the wrong theme. The rules:

- The draw (`forest`, `teal` or `mono`, equal odds) is kept in `sessionStorage`
  under `vynatix-look`, so every page of the visit matches; a new tab or a
  later visit draws again. A stored value that is not one of the three is
  discarded.
- Light or dark is not random. It follows the visitor's toggle choice
  (`localStorage`, `vynatix-theme`, whose full theme id is stored but only its
  light/dark half is read) and, without one, `prefers-color-scheme`.
- The toggle flips light and dark inside the direction the visit drew.
- If storage is blocked the draw cannot be kept, so the page stays on Forest
  rather than re-drawing on every navigation. Without JavaScript the markup's
  own `<html data-theme="light">` (Forest light) is what shows.

The site writes three keys in the visitor's own browser, and none is sent
anywhere: `vynatix-look` (`sessionStorage`, the direction drawn for the visit,
written without any click), `vynatix-theme` (`localStorage`, light or dark,
written when the toggle is pressed) and `vynatix-consent` (`localStorage`, the
analytics choice, written when Decline or Accept is pressed; see *Analytics*).
Whether the first two need mention in the bar or the notices is a decision for
counsel, listed in `tools/PRE-FLIP-CHECKLIST.md`. The one-line fallback, if the
random draw has to go, is to pin `pickLook()` as described below.
- On the home page `app.js` also preloads the headline faces of the drawn
  direction (`DISPLAY_FACES`), so the hero is not blocked on a late font fetch.
  Other pages add no preloads.

To pin the site to one direction, replace `pickLook()`'s body with
`return 'forest';` (or `'teal'`, `'mono'`); to draw on every page load instead
of every visit, skip the `sessionStorage` read there. Everything that is
Forest-only stays Forest whatever is drawn: the logo files in `assets/`, the
favicon and app icons, the manifest colours and the markup's default
`theme-color`. The inline wordmark and every page colour follow the theme.
Each dark theme is a parallel environment, not an inverted light one: the
inverse bands (`.inverse`: the CTA band, the editorial band, the footer) sit
on `md-sys-color-inverse-surface`, which is light in the dark themes.

**Shared chrome is duplicated, not templated.** The `<header>` and `<footer>`
(and the inline `<svg class="svg-defs">` that defines the wordmark `<symbol>`
both of them place with `<use>`) are copy-pasted into every page. **A change
to nav links, the logo, or the header's contact details or addresses must be
applied to all `*.html` files.** The footer's source is the `FOOTER` template
in `tools/seo-head.py`: a footer change is made there and the script run, which
writes it into every page, not made by hand in twenty-one files. The Legal list
in it carries the "Cookie settings" link (`data-consent-open`), which reopens the
consent bar. Set `aria-current="page"` on the current page's nav link. The header is the system's TopAppBar: a floating Liquid
Glass bar (`.site-header`) whose links take the 2px `--indicator` underline
when current, one small primary button and two icon buttons.

**JavaScript** is plain ES5-flavoured vanilla JS in self-contained IIFEs, each
guarded so a missing element is a no-op. Every page loads `app.js` from the
`<head>`, and `app.js` is the **only** script the pages load: there is no CDN or
animation stack. It has three features: the theme (the per-visit draw and the
toggle), the mobile nav, and consent for Google Analytics (see *Analytics*). The
one other script that can ever run is Google's `gtag.js`, which the third feature
injects itself, only after a visitor presses Accept and only once a real
Measurement ID has been set. Nothing on the site
moves on its own: the design system forbids auto-advancing strips and
ambient loops on content surfaces, so the former client marquee is now a
still list (`.clients__list`) and the former case reel is a grid of cards.

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
all 21 pages, the string in `EDGE-SETUP.md`, and the Transform Rule in the
Cloudflare dashboard if the edge is live. If it is live, widen the dashboard rule
**first**: the browser enforces the meta and the header independently, so a
narrower header silently blocks Google Analytics, while a wider one is bounded
by the meta. `tools/verify/csp.js` keeps the pages and `EDGE-SETUP.md` in step
(and allows Google hosts only from its list); `headers.js` checks the live
header. Any new third-party script, or any other host, still means widening the
CSP deliberately on **every page** and in `EDGE-SETUP.md`, and updating this file.

**Progressive enhancement / accessibility** is a real constraint here, not an
afterthought — preserve it:
- No-JS users get the fully visible final state; nothing is hidden pending JS.
- **Controls that need JS must not sit dead without it.** The pattern is to
  hide them in CSS and let `app.js` opt in by adding a class to `<html>`:
  `.js-nav` for the collapsible mobile nav (without it the nav stays visible
  and wraps under the bar) and `.js-theme` for the theme toggle (it keeps its
  place but is invisible until it can work). The consent module follows the same
  rule by building its markup only when it can work: the bar and the in-page
  panel do not exist without JavaScript, with blocked storage, or while the ID is
  the placeholder, and the footer's "Cookie settings" link is then a plain link to
  the notice. It adds `js-consent` to `<html>` once active (a test hook and a
  guard against a second copy of the script; no CSS depends on it) and
  `consent-open` while the bar is on screen (the bottom reserve in `styles.css`
  depends on that one).
- The only motion is short transitions on hover and focus; the system's
  `prefers-reduced-motion` rule cuts them to 0.01ms.
- Keep `aria-label` / `aria-expanded` / `aria-pressed` / `aria-current` and
  decorative `aria-hidden` attributes correct when editing markup. Every inline
  icon is `aria-hidden="true"` next to visible words, or inside a button that
  carries an `aria-label`.
- Every text pair has to clear 4.5:1 (3:1 for large text, borders, rings and
  icons) in every theme; the system's roles are measured for that, which is
  why this file bans raw colours.
- `accessibility.html` states the target as "we aim to meet WCAG 2.2 Level AA"
  and lists what has not been independently verified — keep that page honest
  rather than upgrading the claim.

**Search, AI engines and structured data.** The site is written to be found and
quoted by search engines and AI assistants (ChatGPT, Perplexity, Claude, Google AI
Overviews and AI Mode, Microsoft Copilot), and every page carries the same
machinery in its `<head>`, between `<!-- seo -->` and `<!-- /seo -->`:

- one `<link rel="canonical">` (`https://vynatix.com/` for the home page, otherwise
  `https://vynatix.com/<file>.html`, the form the internal links use), and Open
  Graph and `twitter:card` tags whose title, description and URL repeat the page's
  own `<title>`, meta description and canonical;
- for a page with a twin in the other language, `hreflang` links to both versions
  and `x-default` to the English one, reciprocal on both pages and mirrored in
  `sitemap.xml`;
- one JSON-LD block (`<script type="application/ld+json">`: a data block, never
  executed, so `script-src 'self'` does not apply and the CSP needs no change)
  holding a `@graph` with the full Organization node (`@id`
  `https://vynatix.com/#organization`), the WebSite node, the page itself with its
  `datePublished` and `dateModified`, and page-specific nodes (FAQPage, Service,
  ItemList, Article).
  **Keep the Organization node identical on every page** and true to the site:
  the relationship to Ultra Group is `memberOf`, matching the footer's "Part of
  Ultra Group"; do not change it to `parentOrganization` unless Bolagsverket shows
  Vynatix AB in an Ultra Group koncern.
- Every page node carries `datePublished` (the date the page first went live;
  it never moves) and `dateModified`, repeated as
  `<meta property="article:published_time">` and
  `<meta property="article:modified_time">` (date-only ISO) and, for
  dateModified, as the sitemap `<lastmod>`. Both dates live in the page's entry
  in the `PAGES` registry of `tools/seo-head.py` (`pub` and `mod`), and the
  script writes all three places from that one value. **When you change a
  page's content, move `mod` there, run `python3 tools/seo-head.py`, and run
  `npm run stamp` if styles or scripts changed too.** Guides also carry a visible
  "Publicerad"/"Senast uppdaterad" line; keep it in step.
- A visible FAQ is marked up with `data-faq` on its container, which (or an
  ancestor) carries an `id`, and `data-faq-item` on each question: one `<h3>`,
  then the answer in `<p>` and `<li>` elements, flat (no `<p>` inside an `<li>`,
  no nested list); items of an `<ol>` are numbered "1. " in the data. The FAQPage
  is its own node in the graph (`@type` the plain string, `@id` the page URL plus
  the container's fragment, `isPartOf` the page, which names it in `hasPart`) and
  repeats the questions and answers word for word. The node is for AI auditors
  and extraction pipelines, which walk the graph and string-compare `@type`;
  Google restricted FAQ rich results to government and health sites in 2023 and
  stopped showing them altogether on 7 May 2026 (Search Central changelog,
  entries of 8 May and 15 June 2026), and FAQPage remains valid schema.org. Edit
  markup and data together: the head is regenerated by `tools/seo-head.py`, not
  hand-edited (run it after editing a FAQ).
- `tools/verify/seo.js` (part of `npm run check`) enforces all of the above, plus
  the copy rules below on visible text.

**One sentence about the company**, used verbatim wherever a page introduces it and
in the JSON-LD description, so every source an engine reads agrees: "Vynatix AB is
a software consultancy in Gothenburg, Sweden, founded in 2023 and part of Ultra
Group. Three senior engineers work embedded in client teams on Android Automotive,
AI engineering and cloud platforms, with Volvo Trucks and Volvo Cars among our
clients." (Swedish: "Vynatix AB är ett mjukvarukonsultbolag i Göteborg, grundat
2023 och en del av Ultra Group. Tre seniora utvecklare arbetar inbäddade i
kundernas team inom Android Automotive, AI och molnplattformar, med Volvo Trucks
och Volvo Cars bland kunderna.") If a fact in it changes, change it everywhere,
including LinkedIn, the registries and `llms.txt`.

**Swedish pages** set `<html lang="sv">` and keep the shared English header and
footer, which carry `lang="en"` so screen readers switch voice; only the skip link
is translated, and, while the consent module is active, the footer's "Cookie
settings" link, which it relabels "Cookie-inställningar" (with `lang="sv"` and a
link to `integritet.html#cookies`) on any page whose `<html lang>` starts with
`sv`. Without JavaScript, or while the module is inert, the English link to
`privacy.html#cookies` stays. `integritet.html` is the Swedish twin of
`privacy.html`, the fifth English/Swedish pair, and the Swedish consent bar links
to it. The footer's "På svenska" column (`lang="sv"`) links the Swedish
hub (`sv.html`), which links every Swedish page in its `#guider` section. The
two home pages are not mirror images: the "three ways" list in Who we are and
the Further reading section exist only on the English home page (sv.html has the
Guider section instead). The Further reading items on index.html repeat the
linked pages' `<title>` (without the brand suffix) and meta description word for
word; when one of those changes, change the home page item with it. Write
Swedish as Swedish (the reader is "ni"), not a translation of the English page.

**The list pages** (`konsultbolag-android-automotive-goteborg.html` and its English
twin) name other companies. Every entry quotes the firm's own website or a job ad
it posted, with the source linked and the date it was checked; the order is
alphabetical; a disclosure says Vynatix compiled the list and is on it. Re-check
every entry at least twice a year, update the "Kontrollerad" dates and
`dateModified`, and act on corrections sent to front.disk@vynatix.com. Never rank,
rate or describe a competitor beyond what its own site says.

**Copy** follows the system's content fundamentals: sentence case, no em
dashes (use a comma, a colon, parentheses or a new sentence), no exclamation
marks or ellipses, the middle dot (·) as the metadata separator, no Unicode
arrows or emoji as icons. Keep the brand voice: plain, direct,
Nordic-understated.

**Icons** are Material Symbols Outlined, the system's one library, inlined as
SVG (`<svg class="icon [icon--sm|icon--md]" viewBox="0 -960 960 960">`) from
the glyph files in `assets/icons/`, which are copies of the system's
`assets/Icons/`. The icon font itself is not served. `dark_mode` and
`light_mode` (the theme toggle) are not in the system's approved catalogue;
they were drawn from the same package at the same settings and should be added
to the catalogue. Never draw an icon by hand, and never use `.ms`.

## Analytics

Google Analytics 4 is built into the site, off by default and behind consent.
This section holds the working rules. The reasoning and the cost are in
`SECURITY-ASSESSMENT.md` (Round 6); the hard gate for switching it on is
`tools/PRE-FLIP-CHECKLIST.md`.

**What exists.** The third IIFE in `app.js`, after the theme and the mobile nav.
When active it shows a compact, non-modal bar fixed to the bottom of the viewport
on a first visit (`#consent-bar`: two buttons with the identical class string,
Decline then Accept, so neither is favoured); reopens it from the footer's
"Cookie settings" link (`data-consent-open`); and fills the in-page panel on the
two privacy notices (`[data-consent-panel]` inside `#cookies`) with the same two
buttons. The wording is the `COPY` object in `app.js`, in English and Swedish,
and has to stand on its own (a cached notice can sit beside a newer bar for
minutes) while still naming Google, the cookies, who is counted and how to change
the choice. The styles are the *Consent* section of `styles.css`; its bottom
reserve is in `rem` so it grows with the text size, the one length there that is
not on the spacing scale.

**One constant: `GA_ID`.** `var GA_ID = 'G-XXXXXXXXXX';` is the first line of that
IIFE and the only place the Measurement ID exists (it must stay a single match in
`app.js`; the tests rewrite it by pattern and fail on none or on two). While it
is the placeholder, any run of X characters after `G-`, or anything that is not
`G-` plus 6 to 12 capitals or digits, the block returns before doing anything: no
markup, no storage read or write, no listener, no class on `<html>`, no cookie
deletion, and the footer link stays a plain link. Shipping with the placeholder
is the normal state of the branch. The ID is public by construction, so it may be
committed.

**Flipping it on.** Edit only that line, then `cd tools && npm run stamp` (`app.js`
changed, so every page's stamp moves), then `node verify/release-gate.js`, then
`npm run check`. The flip is the last commit of the one PR and changes nothing but
that line and the stamps. It is made only when `tools/PRE-FLIP-CHECKLIST.md` is
complete. `release-gate.js` fails while `GA_ID` is the placeholder, or while any
claim, marker or placeholder text on the pages would contradict going live. It is
deliberately **not** part of `npm run check`, which stays green with the
placeholder. Switching it off again is the same line the other way and the same
stamp; the exit runbook is in the checklist.

**Google is never requested before consent.** No script, `preconnect`,
`dns-prefetch`, `preload`, `prefetch`, image, font or beacon to a Google host, in
markup or from script, until the stored choice is `granted` or the visitor has
just pressed Accept. This is Consent Mode "basic": nothing is sent before the
choice, not even a default consent state. After Accept the module sends the
consent default (all four consent parameters denied), injects the one
`gtag.js?id=<GA_ID>` element, sends `js`, updates `analytics_storage` to granted
and runs `config` with Google Signals and ad personalisation off and
`cookie_expires` of 365 days. Do not add a Google host to any `<link>` anywhere
in the pages, and do not set `anonymize_ip` or `client_storage`.

**The stored choice.** `vynatix-consent` in `localStorage`, beside `vynatix-theme`
and `vynatix-look`, holds one plain string, `v1:granted:YYYY-MM-DD` or
`v1:denied:YYYY-MM-DD` (the UTC date of the click). It is valid for 365 days, then
the bar asks again. It is parsed with an exact pattern and must be a real date,
not in the future and not expired; anything else (a wrong version, an impossible
date, `__proto__`, markup) counts as no choice, which fails closed. Nothing writes
the key except a click on Decline or Accept, and browsing is never consent. If
storage cannot be read there is no bar and no analytics, and if a write does not
stick the choice is treated as denied. Bump `POLICY_VERSION` when the wording of
the choice changes in a way that should lapse old answers.

**Cookies and withdrawal.** Google sets `_ga` and `_ga_<id>`. `cookie_expires` is
365 days (`COOKIE_MAX_AGE`) and must never be longer than `CONSENT_MAX_DAYS`.
Decline and withdrawal set Google's own `ga-disable-<ID>` flag, send
`analytics_storage: denied`, and delete every cookie named `_ga` or starting
`_ga_` for the host and every parent domain, at once, a second later and on
`pagehide`. A load with no choice or a denied one deletes them too. No other
cookie is touched. The stored choice is read again on `pageshow` after a
back/forward-cache restore, on `visibilitychange` and on `storage`, so a restored
page or another tab follows a withdrawal. A bare revert on the server cannot reach a
tab that has already loaded `gtag.js`; it measures until it is reloaded or until
`PURGE_ONLY` is set to `true`, which measures nothing for anyone, deletes the `_ga`
cookies on every load and removes the stored choice, so the `storage` event stops
open tabs too (the exit runbook in `tools/PRE-FLIP-CHECKLIST.md`). Reverting `GA_ID`
to the placeholder only makes the block inert; it does not clean up.

**Property settings that live outside the repo.** Nothing in the repo can see
these, they can drift, and each is evidenced in the checklist and re-checked every
quarter: Google Signals off; ad personalisation and Google data sharing off; event
data retention 2 months; Enhanced Measurement decided, with outbound clicks and
file downloads off (the list pages name other firms, and an outbound-click event
would record which one a visitor followed); an internal-traffic or Exclude
hostname filter so local and developer visits do not count, and **no** Include
hostname filter until it has been tested in DebugView (Google's release note of
2026-09-21 says Include filters block events with an empty hostname, and the
effect on web streams is unclear).

**Facts only a human can supply.** The notices carry visible `[[CONFIRM: what is
needed]]` markers: Google's contracting entity, the observed cookie names and
lifetimes, which Enhanced Measurement events remain, the Data Privacy Framework
listing check. Never fill one in from memory or from this file. Resolve it from
evidence; the release gate refuses to pass while any remains. The legal text is a
draft for counsel and says so on the page.

**Checks.** `csp.js` (the CSP is identical on all 21 pages, matches
`EDGE-SETUP.md`, and names only the allow-listed Google hosts), `consent.js`
(behaviour: nothing before consent, accept, decline, withdrawal, poisoned and
blocked storage, no-JS, Swedish), `consent-layout.js` (bar size, the open menu
over the bar, focus never hidden behind the bar, six themes), `release-gate.js`
(above) and `consent-live.js` (opt-in; real network; the dummy ID `G-TEST000000`,
never a real property). In `tools/verify/_common.js`: `pinConsent` pins a stored
choice the way `pinTheme` pins a theme, `armGa` arms a page so the module is
active under test (the placeholder is inert, so without it the axe, contrast,
theme and screenshot checks would audit a page with no bar), and `rewriteGaId`
rewrites the `GA_ID` line by pattern and fails loudly on no match or more than
one. A pass with the dummy ID is not a pass with the real one; see the checklist.

## Assets

`assets/` holds the logo as the system's ink files, `vynatix-wordmark-<ink>.svg`
and `vynatix-mark-<ink>.svg`, in the three Forest inks: `forest` (on Cream and
light surfaces), `cream` (reversed, on Forest and the dark canvas) and `bronze`
(print foil only, never small). The pages do not reference them: the wordmark
is inlined once per page as a `<symbol>` filled with `currentColor` and placed
with `<use>` in the header (`md-sys-color-primary`) and footer
(`md-sys-color-inverse-on-surface`), so it follows the theme. The files are for
places where inline SVG cannot go (email, documents) and for regenerating the
icons. The system holds the other inks (teal, ink, cloud, champagne, charcoal,
paper) for the other directions.

The three case photos (`case-*.jpg` with `.webp` siblings, see
`assets/CREDITS.md`) are shown in full colour with no filter or overlay, as the
system's photography rules require for case-study imagery. The client mark in
the home-page list is an inline SVG `<symbol>` in `index.html`, referenced with
`<use>` and filled with `currentColor` (provenance in `assets/CREDITS.md`).

The app icons (`icon-192/512.png`, `apple-touch-icon.png`) are the Cream V mark
on a Forest field; `favicon.ico` is the Forest mark on transparent;
`favicon.svg` switches between the two with `prefers-color-scheme`. All five
were rendered offline through Chromium from the mark files. If the mark or the
direction changes, regenerate all five.

**Fonts** are self-hosted woff2 subsets made from the design system's TTF
files with fontTools, every OpenType feature and variable axis kept. Each face
is split into a Latin file (Swedish included) and a Latin Extended file,
declared with `unicode-range` in `tokens.css`, so a page fetches the second only
when its text needs it:

```sh
pyftsubset Fraunces-VariableFont_SOFT_WONK_opsz_wght.ttf --layout-features='*' --flavor=woff2 \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --output-file=fraunces-variable-latin.woff2
pyftsubset Fraunces-VariableFont_SOFT_WONK_opsz_wght.ttf --layout-features='*' --flavor=woff2 \
  --unicodes="U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" \
  --output-file=fraunces-variable-latin-ext.woff2
```

Forest renders in Fraunces (display, editorial), Aptos (body) and Geist
(eyebrows, the system voice); Teal would use Instrument Serif and Geist,
Monochrome Geist, and `code` is JetBrains Mono in every theme, so all of those
faces ship (a browser fetches only the ones a page uses). The home page
preloads the drawn direction's display face and its italic (Fraunces for
Forest, Instrument Serif for Teal, Geist and Fraunces italic for Monochrome),
one for each line of the hero headline. Instrument Serif and JetBrains
Mono are SIL Open Font License fonts (`fonts/licences/`), Fraunces and Geist
too. **Aptos is Microsoft's typeface**: the design system itself says to check
its terms before shipping it outside Vynatix's own documents, and that check
has not been recorded here. If it fails, delete the seven `aptos-*.woff2`
files and their `@font-face` rules; `--font-body` falls back to Geist. Don't
add third-party font/CDN requests for fonts.

## Working in this repo

- **Run it** by opening `index.html` in a browser, or serve the folder
  (`python3 -m http.server`) so relative paths and `fetch` behave. There is no
  dev server, hot reload, or watch task.
- **The site has no build step** — no framework, bundler, or package manager,
  and what is in the repo ships verbatim. The one exception is `tools/`: the
  optional local verification scripts (Playwright) and `stamp.js`, which writes
  the version stamps into the pages and which you run before committing a change
  to any of the four shared files, `seo-head.py` (Python 3, standard library),
  which rewrites the search block in every head, the footer and `sitemap.xml`
  from one registry, and `indexnow.js`, which tells Bing and the
  other IndexNow engines which pages changed once a change is live. It is developer tooling only: excluded from
  the published output in `_config.yml`, with its `node_modules/` gitignored, and
  nothing in it runs at deploy time. The site itself stays hand-written.
- **"Passing" means:** the pages render correctly in light and dark, nav/footer
  are consistent across pages, behaviour degrades gracefully with JS off and
  reduced motion on, and there are no console errors. Check changes visually in
  both themes. `tools/README.md` documents the repeatable checks — a visual
  regression gate (`screenshot.js`), an adversarial CSP test (`adversarial.js`),
  an off-origin request check (`requests.js`), the random-scheme check
  (`theme.js`), the version-stamp check (`stamp.js --check`) and its stale-cache
  proof (`stale-cache.js`), the search, structured-data and copy check
  (`seo.js`), the accessibility suite with its contrast sweep (`a11y.js`), the
  static CSP sync (`csp.js`) and the consent behaviour and layout checks
  (`consent.js`, `consent-layout.js`). Two more sit outside `npm run check`: the
  release gate (`release-gate.js`, which must fail until analytics is switched on
  for real) and the opt-in live test (`consent-live.js`); see *Analytics*.
  A new page also goes into `PAGES` in `tools/verify/_common.js` and into
  `sitemap.xml`. Because every visit draws its own scheme, the checks that need a
  particular theme pin it first (`pinTheme` in `tools/verify/_common.js` sets
  both storage keys; `pinConsent` pins the analytics choice, and `armGa` arms the
  consent module for checks that audit the bar). Before changing a component,
  sweep all six themes:
  `THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark`.
- **Re-syncing the design system.** When the system changes, copy its
  `project/colors_and_type.css` over the local one as is, and its
  `project/tokens.css` over the local one keeping the local `@font-face`
  block; then regenerate any font, icon or logo files that changed, run
  `npm run stamp` in `tools/` (the pages' version stamps follow the files) and
  run the checks. Never edit those two files for a site-specific need: that belongs in
  `styles.css`.
- Match the surrounding style: 2-space indentation, the existing comment voice
  (explanatory, full sentences), and the token-first approach.
- **Do not add inline `style=""` attributes.** The CSP pins `style-src 'self'`,
  so the browser blocks them outright. One-off layout goes in `styles.css` as a
  component modifier (`.section__h2--wide`) or, for pure spacing, one of the
  small `.u-*` utilities at the end of the file (values from the spacing scale
  only). Those utilities are single-class rules, so anything you append later
  with equal specificity will outrank them — put new component rules before
  that block, not after it.

## Git & deploys

- Pushing HTML/CSS/asset changes to the production branch **publishes them
  live** on `vynatix.com`. Treat the default branch as production.
- Do all work on the branch you were assigned; never push to another branch
  without explicit permission.
- Do not open a pull request unless explicitly asked.
- `_config.yml` decides what is actually published. Developer docs (`AGENTS.md`,
  `CLAUDE.md`, `SECURITY.md`, `CODEOWNERS`, the security assessment) and
  `tools/` are excluded, so they stay in the repo but are never served from
  `vynatix.com`. **Anything new that is documentation rather than site content
  must be added to that exclude list.** (The font and icon licence texts are
  published on purpose: they have to travel with the files.)

### Repository hardening (set once, in GitHub settings)

These are not code changes, so they cannot be committed — they need someone with
admin rights on the repository:

- **Branch protection on the default branch.** Because a push publishes to
  production, require a pull request and a Code Owner review before merging, and
  disallow bypassing it. `CODEOWNERS` is in place; replace the placeholder team
  with the real one.
- **Commit email privacy.** The history contains a personal address on 26
  commits. Git author emails are public on GitHub. Enable *Keep my email
  addresses private* and *Block command line pushes that expose my email* in
  personal account settings, and use the `@users.noreply.github.com` address
  going forward. **Do not rewrite the existing history** — it would break the
  merged pull-request record for no real gain, since the address is already
  public.
- **Footer VAT number.** Swedish e-handelslag expects the
  `momsregistreringsnummer` alongside the company identification already in the
  footer. It is not added here because it is a legal identifier that must be
  confirmed rather than derived; add it to the footer on every page once
  known.
