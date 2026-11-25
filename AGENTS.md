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
index.html          Home — hero (with its drafting-sheet background), still client list, contents row,
                    services, three case cards, the partnership band, people,
                    insights, CTA band
about.html          About: what we stand for, people
services.html       AI engineering, cloud platforms, application development
industries.html     Four industries, mobility last
work.html           The three cases ("Cases" in the menu), team projects and libraries
membership.html     Career ("Career" in the menu; the file name stays): the page for senior
                    engineers and designers, in the recruit voice, with the rate calculator
contact.html        Two-inbox contact page (no form — mailto links), how we start, and the
                    common questions (the site's English FAQ)
blog.html           Insights ("Insights" in the menu; the file name stays): a hand-written list of
                    the guides, in English and in Swedish
privacy.html        Privacy notice (GDPR Art. 13), with the analytics and cookies
                    section (#cookies) and the in-page consent buttons
terms.html          Website terms of use
accessibility.html  Accessibility statement
android-automotive-development.html   Android Automotive in Gothenburg (English twin of
                    android-automotive-utveckling.html)
ai-engineering.html AI engineering in Gothenburg (English twin of ai-utveckling.html)
choose-a-software-consultancy.html   How to choose a software consultancy: the English twin of
                    valja-konsultbolag.html, and the first post (kind='post')
android-automotive-consultancies-gothenburg.html  Withdrawn on 20 November 2026 (a stub; it was
                    a list of Gothenburg consultancies working on Android Automotive)
sv.html             Swedish home and hub for the Swedish pages (twin of index.html)
android-automotive-utveckling.html, ai-utveckling.html   Swedish twins of the two deep pages
valja-konsultbolag.html, platform-engineering.html, ai-assistent-interna-dokument.html   Swedish guides
testautomatisering.html, systemutveckling.html, systemintegration-och-forvaltning.html,
ai-i-befintlig-produkt.html, fordonsmjukvara.html   Swedish posts (kind='post', original=True),
                    23 November 2026, each answering buyer questions AI assistants are asked
test-automation.html, custom-software-development.html, system-integration-and-maintenance.html,
ai-in-your-existing-product.html, automotive-software.html   Their English twins (kind='post'),
                    and through them the five generated languages
konsultbolag-android-automotive-goteborg.html, ai-konsultbolag-sverige.html   Withdrawn on
                    20 November 2026 (stubs)
integritet.html     Swedish privacy notice, the twin of privacy.html (one of the
                    English/Swedish pairs); the Swedish consent bar links to it.
                    Thirty-four pages in total, three of them withdrawn stubs
robots.txt          Allows every crawler, names the AI search agents, points at the sitemap
sitemap.xml         Every page, its lastmod and its hreflang pair (written by
                    tools/seo-head.py from PAGES)
llms.txt            A plain-text summary of the company and every page, in both languages
es/ fr/ de/ ja/ ar/ The generated languages (Spanish, French, German, Japanese, Arabic): the English pages
                    rebuilt by tools/seo-head.py from the catalogues in tools/i18n/. Never edited by hand. Live
                    since 20 November 2026 (es, ar) and 21 November 2026 (fr, de, ja), on the owner's decision,
                    before a native reader's check (see Languages)
<32 hex>.txt        The IndexNow key file (tools/indexnow.js proves ownership with it)
tokens.css          Design system layer 1: the tokens, generated from the system's
                    tokens.json (colour roles for six themes, spacing, radii, type
                    scale, @font-face). Only the @font-face src lines are the site's.
colors_and_type.css Design system layer 2, verbatim: reset, semantic helpers,
                    .eyebrow, .btn, .card, .glass, .container, per-theme typefaces
styles.css          Layer 3, the site's own: page chrome and components on the roles
app.js              All client behaviour (vanilla JS, IIFEs, no modules): the theme,
                    the mobile nav, the silk background, the Career page's rate
                    calculator and analytics consent (see Analytics)
hero-bg.css         The hero background, the drafting sheet (only index.html links it), in the hero's unit
assets/             Logo files in Forest inks, inline-icon SVGs, self-hosted
                    photographs (jpg + webp), generated pictures (webp, light and dark), app icons, the masks of the
                    hero's drafting sheet (bg-sheet-*.svg) and of its four stages (stage-*.svg)
fonts/              Self-hosted woff2 subsets of the system's faces and of the four Japanese and Arabic
                    faces (*-ja.woff2, *-ar.woff2), plus licences
favicon.svg/.ico    Theme-aware SVG icon (Forest / Cream) + 16/32/48 ICO fallback
apple-touch-icon.png
site.webmanifest    Name, colours and icons for installed/Android use
CNAME               GitHub Pages custom domain
_config.yml         Controls what GitHub Pages publishes (excludes dev docs)
.well-known/        security.txt (RFC 9116 disclosure contact)
SECURITY.md         Disclosure policy (GitHub surfaces it) — not published
CODEOWNERS          Review ownership — not published
.gitattributes      Marks the files a tool writes whole as generated, so GitHub collapses them in review
.github/workflows/check.yml  The checks on every pull request and every push to main (static, build,
                    browser); a dot folder, so never published, and it deploys nothing
EDGE-SETUP.md       Cloudflare runbook for the header-only controls — not published
tools/              Local verification scripts (verify/, including the consent checks
                    and the hero background guard), stamp.js (writes the ?v=
                    version stamps into the pages), seo-head.py (rewrites the search
                    block, header, footer, sitemap, URL lock and the guide lines of llms.txt, and builds the generated languages),
                    i18n.py (the translation engine) with the catalogues in tools/i18n/, the registry in
                    tools/site/ (pages/<slug>.json, one row per page written by hand, and langs.json, the
                    language table), migrate/registry.py (moved the registry there), and the sheet's
                    mask generator, sheet-art.js; package-lock.json, requirements.txt and pages-build.txt
                    pin the Node packages, the font cutter's Python packages and the GitHub Pages gem;
                    NOT published, not part of the site
tools/PRE-FLIP-CHECKLIST.md   The hard gate for switching analytics on (not published)
tools/TAKEDOWN.md   Runbook for taking a page down; tools/urls.lock the append-only list of every URL ever
                    registered (written by seo-head.py); tools/CITATION-LOG.md the pilot's measurement
                    protocol and decision rule; none published
tools/DECISION-TABLE.md   Every owner decision the docs record, classed by what holds it, with the proposed
                    patterns and their samples (step 4.0 of the refactoring plan); not published
tools/templates/    The header, the footer and the stub of a withdrawn page as HTML (header.html, footer.html,
                    stub.html), and tools/site/company.json the company's facts: seo-head.py writes them
                    into every page; tools/migrate/chrome.py moved them there from seo-head.py's literals and
                    converts a branch opened before the move; not published
```

There is no `assets/`-level JS or CSS — those folders are static files only.

## Topics

The working rules for each part of the site are in `tools/docs/`, one file per topic, moved there word
for word from this file on 25 November 2026. Open the topic your change touches; a heading below is the name
the pages, the tools and `CLAUDE.md` cite ("AGENTS.md, Hero background"), and "Also here" names the
paragraphs inside it that are cited by their own name.

### Three-layer CSS

`tools/docs/three-layer-css.md`.

### Version stamps on the four shared files

`tools/docs/version-stamps.md`. Also here: *Bringing `main` into a branch*; *A branch opened before the registry became data*.

### Theming

`tools/docs/theming.md`.

### Liquid Glass

`tools/docs/liquid-glass.md`.

### Silk waves

`tools/docs/silk-waves.md`.

### The home hero

`tools/docs/home-hero.md`.

### Hero background

`tools/docs/hero-background.md`. Also here: *The headline copy drives the geometry, and the guard says when it moves*; *Guards*; *Bronze budget*; *Measured costs and known limits*; *Changing it*.

### Hero fit

`tools/docs/hero-fit.md`.

### Audience switch (retired, November 2026)

`tools/docs/audience-switch.md`.

### Shared chrome: the header and the footer are templates, the rest is duplicated

`tools/docs/shared-chrome.md`.

### JavaScript

`tools/docs/javascript.md`. Also here: *The Google entries are a recorded security downgrade*; *The policy lives in three places that change together*.

### Progressive enhancement / accessibility

`tools/docs/progressive-enhancement.md`.

### Largest contentful paint

`tools/docs/largest-contentful-paint.md`.

### Search, AI engines and structured data

`tools/docs/search.md`. Also here: *One sentence about the company*.

### The English home page

`tools/docs/english-home-page.md`. Also here: *What the Geoptie audit of 23 November 2026 changed*; *The second report of 23 November 2026*; *The page's pictures*.

### The other pages

`tools/docs/other-pages.md`.

### Rate calculator

`tools/docs/rate-calculator.md`.

### Swedish pages

`tools/docs/swedish-pages.md`.

### Languages

`tools/docs/languages.md`. Also here: *The one exception: Chinese and Hindi, deleted on 21 November 2026*.

### The list pages are withdrawn

`tools/docs/list-pages-withdrawn.md`.

### Copy

`tools/docs/copy.md`.

### Icons

`tools/docs/icons.md`.

### Posts, permanence and withdrawal

`tools/docs/posts-permanence-withdrawal.md`. Also here: *Where a post lives*; *The pattern*; *Registering a post*; *The call to action carries the post's slug*; *Drafts*; *The tagged subject is disclosed*; *Dates when a branch sits*; *Owner-approved wordings*; *Withdrawing a page*; *Checks*.

### Analytics

`tools/docs/analytics.md`. Also here: *What exists*; *Two switches: `GA_ID` and `PURGE_ONLY`*; *Flipping it on*; *The release gate*; *Switching it off again*; *Google is never requested before consent*; *The stored choice*; *Cookies and withdrawal*; *Property settings that live outside the repo*; *Facts only a human can supply*; *Checks*.

### Assets

`tools/docs/assets.md`. Also here: *Fonts*.

## Working in this repo

- **Run it** by opening `index.html` in a browser, or serve the folder
  (`python3 -m http.server`) so relative paths and `fetch` behave. There is no
  dev server, hot reload, or watch task.
- **The site has no build step** — no framework, bundler, or package manager,
  and what is in the repo ships verbatim. The one exception is `tools/`: the
  optional local verification scripts (Playwright) and `stamp.js`, which writes
  the version stamps into the pages and which you run before committing a change
  to any of the five stamped files, `seo-head.py` (Python 3, standard library),
  which rewrites the search block in every head, the header, the footer, `sitemap.xml`
  and `tools/urls.lock` from one registry, the mask generator of the hero's drafting sheet
  (`sheet-art.js` in plain Node, no dependencies), and `indexnow.js`, which tells Bing and the
  other IndexNow engines which pages changed once a change is live. It is developer tooling only: excluded from
  the published output in `_config.yml`, with its `node_modules/` gitignored, and
  nothing in it runs at deploy time. The site itself stays hand-written.
- **"Passing" means:** the pages render correctly in light and dark, nav/footer
  are consistent across pages, behaviour degrades gracefully with JS off and
  reduced motion on, and there are no console errors. Check changes visually in
  both themes. `tools/README.md` documents the repeatable checks — a visual
  regression gate (`screenshot.js`, whose `against` mode compares a branch with `origin/main`
  in one run), an adversarial CSP test (`adversarial.js`),
  an off-origin request check (`requests.js`), the random-scheme check
  (`theme.js`), the version-stamp
  check (`stamp.js --check`) and its stale-cache proof (`stale-cache.js`), the search, structured-data and copy check
  (`seo.js`), the hero fit (`hero-fit.js`: the first screen is the hero at every window size),
  the hero background's guard (`bg-sheet.js`) and its
  run on a scaled hero (`bg-fit.js`),
  the accessibility suite with its contrast sweep (`a11y.js`), the static CSP sync
  (`csp.js`), the "what ships" check (`publish.js`), the page counts the docs state and the order of
  the `styles.css` blocks (`docs.js`) and the consent behaviour and
  layout checks (`consent.js`, `consent-layout.js`). Two more run outside
  `npm run check`: the release gate (`release-gate.js`, which must fail
  until analytics is switched on for real; only its `--self-test` is in the chain)
  and the opt-in live test (`consent-live.js`); see *Analytics*.
  `node tools/check.js` runs every step of `npm run check` with a server of its own and the browser checks side by
  side, and prints one summary: every step with its verdict and its time, and the tail of each failure. `--list`
  prints what each step proves, from its script's own header; `--static`, `--only` and `--since <rev>` are in
  `tools/README.md`.
  The generated languages have their own check, `i18n.js` (catalogues complete, every generated page
  well-formed and linked right, the draft gate, a load of every page at three widths, axe on a sample of
  each language), and `seo.js` takes in a generated language once it is live; see *Languages*. The other checks of
  every page take the generated pages too (`links.js`, `requests.js`, `theme.js`, `csp.js`, `mailto.js` and the page
  rules of `publish.js`); `a11y.js` scans every root page and the home page of each generated language, a sample
  that keeps the run inside its time.
  A new page also needs its registry row, `tools/site/pages/<slug>.json`, which puts
  it in `PAGES` for every check and in `sitemap.xml` once `seo-head.py` runs;
  `publish.js` fails if a root `*.html` has no row. No check keeps a list of its own: each takes its
  pages from the registry and the generated folders (`pagesIn()` in `tools/verify/_common.js`) and states
  its scope, root, generated or all, in the first paragraph of its header and in the first line it prints;
  one that walks fewer pages to stay inside its time takes `samplePages()` and says it is a sample, and
  `docs.js` fails on a check that states no scope.
  Because light or dark follows the system, the checks that need a particular theme pin
  it first (`pinTheme` in `tools/verify/_common.js` sets the storage key for the theme;
  `pinConsent` pins the analytics choice, and `armGa` arms
  the consent module for checks that audit the bar). The checks run in both
  themes (`mono-light,mono-dark`) by default; `THEMES` narrows a run. Before changing the
  home hero, its copy, the header's
  height, or the hero rules, run `node verify/hero-fit.js` (the fit's numbers) and
  `npm run check:bg`.
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
  small `.u-*` utilities of the "Utilities" block (values from the spacing scale
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
  must be added to that exclude list**, and `publish.js` fails when it is not. (The
  font and icon licence texts are published on purpose: they have to travel with the
  files.)
- **A change that must move nothing on the site** (a tool, a document, a refactoring) is
  proven with `node tools/verify/shipped.js`: it lists every published file, and `_config.yml` or
  `_data/` change, against the merge base with `origin/main`. Put the line `Byte-neutral: yes` alone
  in such a pull request's description, and run it with `--neutral` before pushing; an empty list
  is the proof.

- **The checks run on GitHub** for every pull request and every push to `main`
  (`.github/workflows/check.yml`, read-only, every action pinned by commit). `static`
  runs the static tier and `shipped.js` (seconds, no install); `build` builds the same
  commit with GitHub's own Pages action and requires the output to be, byte for byte,
  what the repository says it publishes, and the recorded carrier version to be GitHub's;
  `browser` runs `node tools/check.js`. A push to `main` is compared with the commit
  before it. The workflow informs; it stops a merge only once a job is a required status
  check (below).

### Repository hardening (set once, in GitHub settings)

These are not code changes, so they cannot be committed — they need someone with
admin rights on the repository:

- **Branch protection on the default branch.** Because a push publishes to
  production, require a pull request and a Code Owner review before merging, and
  disallow bypassing it. `CODEOWNERS` is in place; replace the placeholder team
  with the real one. The job to require is `static` of `.github/workflows/check.yml`
  (`tools/REFACTORING-PLAN.md`, step 0.3, weighs the review rule and the bypass against a
  single account that opens and merges every pull request).
- **Commit email privacy.** The history contains a personal address on 26
  commits. Git author emails are public on GitHub. Enable *Keep my email
  addresses private* and *Block command line pushes that expose my email* in
  personal account settings, and use the `@users.noreply.github.com` address
  going forward. **Do not rewrite the existing history** — it would break the
  merged pull-request record for no real gain, since the address is already
  public. (One exception, and only the owner can authorise it, in writing, in the pull request: text that
  must not stay public, such as a client name under NDA or personal data, published by mistake; see
  `tools/TAKEDOWN.md`.)
- **Footer VAT number.** Swedish e-handelslag expects the
  `momsregistreringsnummer` alongside the company identification already in the
  footer. It is not added here because it is a legal identifier that must be
  confirmed rather than derived; add it to the footer on every page once
  known.
