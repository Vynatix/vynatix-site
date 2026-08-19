# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

The marketing website for **Vynatix**, a Nordic software consultancy in
Gothenburg. It is a small, **hand-written static site** — no framework, no build
step, no package manager, no bundler. What is in the repo is exactly what ships.

It is served as a flat set of HTML files at the domain in `CNAME`
(`vynatix.com`) via **GitHub Pages**. Editing a file and pushing to the default
branch publishes it; there is nothing to compile.

## Layout

```
index.html          Home — hero, case reel, CTA band (no animation stack)
about.html          Company / team
services.html       Application dev, AI engineering, cloud platforms
work.html           Selected case studies
membership.html     "Collective" / careers for senior engineers
contact.html        Two-inbox contact page (no form — mailto links)
colors_and_type.css Design system: CSS custom properties (tokens) only
styles.css          Page chrome and component styles built on the tokens
app.js              All client behaviour (vanilla JS, IIFEs, no modules)
assets/             SVG logos — wordmark + logo-mark in 4 colour variants
fonts/              Self-hosted woff2 (Instrument Serif, Geist, Geist Mono)
CNAME               GitHub Pages custom domain
_config.yml         Controls what GitHub Pages publishes (excludes dev docs)
.well-known/        security.txt (RFC 9116 disclosure contact)
tools/              Local verification scripts — NOT published, not part of the site
```

There is no `assets/`-level JS or CSS — those folders are static files only.

## Architecture & conventions

**Two-layer CSS.** Keep the split intentional:
- `colors_and_type.css` defines **design tokens** as CSS custom properties:
  colour primitives + semantic aliases, type families/scale, spacing, radii,
  shadows, and motion (durations/easings). It also defines the **dark theme**
  under `[data-theme="dark"]`, which overrides the semantic variables only.
- `styles.css` consumes those tokens to style components. Prefer
  `var(--token)` over hard-coded values. Add new colours/sizes/easings as
  tokens in `colors_and_type.css`, then reference them.

**Theming.** Light is the default (`<html data-theme="light">`). `app.js`
applies the persisted/OS-preferred theme on load and the `.theme-toggle` button
flips `data-theme` on `<html>`, persisting to `localStorage` (`vynatix-theme`).
Style dark mode by overriding semantic tokens, not by writing parallel rules.

**Shared chrome is duplicated, not templated.** The `<header>` and `<footer>`
are copy-pasted into every page (there is no include system). **A change to nav
links, the logo, the footer, contact details, or addresses must be applied to
all `*.html` files.** Set `aria-current="page"` on the current page's nav link.

**JavaScript** is plain ES5-flavoured vanilla JS in self-contained IIFEs, each
guarded so a missing element is a no-op. Every page loads `app.js` (deferred),
and `app.js` is the **only** script — there is no CDN or animation stack. It has
exactly three features, all running on every page: the theme toggle, the mobile
nav, and the case-reel Previous/Next controls.

The Content-Security-Policy (a `<meta>` tag in every page's `<head>`) pins
`script-src 'self'`, so **any third-party script is blocked by default**. A
GSAP + ScrollTrigger + SplitText + Lenis CTA "settle" animation once lived on
`index.html` but was reverted (PR #21); it is not in the shipped code. If it is
ever restored, adding those CDN `<script>` tags means deliberately widening
`script-src` in the CSP on all six pages — and updating this file.

**Progressive enhancement / accessibility** is a real constraint here, not an
afterthought — preserve it:
- No-JS users get the fully visible final state; nothing is hidden pending JS.
- All decorative motion (e.g. the client marquee, the smooth reel scroll) must
  be gated on `prefers-reduced-motion` and fall back to the static final state.
- Keep `aria-label` / `aria-expanded` / `aria-pressed` / `aria-current` and
  decorative `aria-hidden` attributes correct when editing markup. The footer
  claims WCAG 2.2 AA.

## Assets

Logos live in `assets/` as SVGs in four colour variants — `teal`, `ink`,
`cloud`, `champagne` — for both `wordmark-*` and `logo-mark-*`. Match the
variant to the background: the `teal` wordmark sits in the (light) header, the
`cloud` wordmark in the (dark) footer. Fonts are self-hosted woff2; the home
page preloads the headline serif weight. Don't add third-party font/CDN
requests for fonts.

## Working in this repo

- **Run it** by opening `index.html` in a browser, or serve the folder
  (`python3 -m http.server`) so relative paths and `fetch` behave. There is no
  dev server, hot reload, or watch task.
- **The site has no build step** — no framework, bundler, or package manager,
  and what is in the repo ships verbatim. The one exception is `tools/`, which
  holds optional local verification scripts (Playwright). They are developer
  tooling only: excluded from the published output in `_config.yml`, with their
  `node_modules/` gitignored. The site itself stays hand-written.
- **"Passing" means:** the pages render correctly in light and dark, nav/footer
  are consistent across pages, behaviour degrades gracefully with JS off and
  reduced motion on, and there are no console errors. Check changes visually in
  both themes. `tools/README.md` documents the repeatable checks — a visual
  regression gate (`screenshot.js`), an adversarial CSP test (`adversarial.js`),
  and an off-origin request check (`requests.js`).
- Match the surrounding style: 2-space indentation, the existing comment voice
  (explanatory, full sentences), and the token-first approach. Inline `style="
  "` attributes are used in places for one-off layout — follow the local
  pattern of the file you're editing.
- Keep the brand copy voice intact: plain, direct, Nordic-understated.

## Git & deploys

- Pushing HTML/CSS/asset changes to the production branch **publishes them
  live** on `vynatix.com`. Treat the default branch as production.
- Do all work on the branch you were assigned; never push to another branch
  without explicit permission.
- Do not open a pull request unless explicitly asked.
