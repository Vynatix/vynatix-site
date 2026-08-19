# CLAUDE.md

This file orients Claude Code when working in this repository.

**Read [AGENTS.md](./AGENTS.md) first** — it is the primary, comprehensive guide
to this project (what it is, the layout, architecture, conventions, and how to
run and ship it). Everything there applies to Claude too. This file only
highlights the things most worth keeping front-of-mind.

## The short version

- **Static, hand-written marketing site** for Vynatix (a Nordic software
  consultancy). Nine pages. No framework, no build step, no package manager for
  the site — what's in the repo is what ships, served via GitHub Pages at
  `vynatix.com` (`CNAME`). `_config.yml` decides what is published; developer
  docs and `tools/` are excluded. `tools/` is the one npm-using exception and is
  local verification tooling only, never site content.
- **Two-layer CSS:** design tokens in `colors_and_type.css`, components in
  `styles.css`. Use `var(--token)`; add new tokens rather than hard-coding.
  **No inline `style=""`** — the CSP pins `style-src 'self'` and blocks it.
- **Dark mode** is token overrides under `[data-theme="dark"]`; the toggle lives
  in `app.js` and persists to `localStorage`. Test changes in both themes.
- **Header and footer are duplicated across every `*.html` file** — there is no
  template/include system. Any nav, logo, footer, or contact-detail change must
  be made in **all** pages, and `aria-current="page"` set on the active link.
- **`app.js`** is vanilla, IIFE-per-feature, element-guarded — four features
  (theme toggle, mobile nav, case-reel controls, and the index-only marquee
  pause) and no CDN/animation stack. The CSP pins `script-src 'self'`, so adding
  any third-party script means widening the CSP in **all nine pages** first.
  (A GSAP/Lenis CTA animation was reverted; it is not in the shipped code.)
- **Progressive enhancement and accessibility are load-bearing:** no-JS users
  and `prefers-reduced-motion` users must get the final visible state, with
  nothing hidden pending JS, and no control left dead. JS opts in by adding a
  class (`.is-ready`, `.js-nav`) rather than the CSS assuming JS will run.
  Don't regress this.

## Verifying work

There is no lint step, but there *is* a check suite: see `tools/README.md`
(`cd tools && npm install`, then `npm run check`). It covers broken links,
off-origin requests, CSP enforcement, accessibility including a contrast sweep,
and a screenshot diff. Serve the repo root first (`python3 -m http.server 8000`).

Also verify visually: render in light and dark, confirm header/footer match the
other pages, and check it degrades gracefully with JS disabled and reduced
motion on, with no console errors.

## Pushing

Pushing to the production branch publishes live to `vynatix.com`. Work only on
the assigned branch, and don't open a PR unless asked.
