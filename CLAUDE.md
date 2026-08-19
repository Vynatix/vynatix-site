# CLAUDE.md

This file orients Claude Code when working in this repository.

**Read [AGENTS.md](./AGENTS.md) first** — it is the primary, comprehensive guide
to this project (what it is, the layout, architecture, conventions, and how to
run and ship it). Everything there applies to Claude too. This file only
highlights the things most worth keeping front-of-mind.

## The short version

- **Static, hand-written marketing site** for Vynatix (a Nordic software
  consultancy). No framework, no build step, no package manager — what's in the
  repo is what ships, served via GitHub Pages at `vynatix.com` (`CNAME`).
- **Two-layer CSS:** design tokens in `colors_and_type.css`, components in
  `styles.css`. Use `var(--token)`; add new tokens rather than hard-coding.
  **No inline `style=""`** — the CSP pins `style-src 'self'` and blocks it.
- **Dark mode** is token overrides under `[data-theme="dark"]`; the toggle lives
  in `app.js` and persists to `localStorage`. Test changes in both themes.
- **Header and footer are duplicated across every `*.html` file** — there is no
  template/include system. Any nav, logo, footer, or contact-detail change must
  be made in **all** pages, and `aria-current="page"` set on the active link.
- **`app.js`** is vanilla, IIFE-per-feature, element-guarded — three features
  (theme toggle, mobile nav, case-reel controls) and no CDN/animation stack. The
  CSP pins `script-src 'self'`, so adding any third-party script means widening
  the CSP in all six pages first. (A GSAP/Lenis CTA animation was reverted; it is
  not in the shipped code.)
- **Progressive enhancement and accessibility are load-bearing:** no-JS users
  and `prefers-reduced-motion` users must get the final visible state, with
  nothing hidden pending JS. Don't regress this.

## Verifying work

There is no lint or test suite. Verify visually: open/serve the page, check it
renders in light and dark, confirm header/footer match the other pages, and
that behaviour degrades gracefully with JS disabled and reduced motion on, with
no console errors.

## Pushing

Pushing to the production branch publishes live to `vynatix.com`. Work only on
the assigned branch, and don't open a PR unless asked.
