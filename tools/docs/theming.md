# Theming

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Theming.** The design system has three brand directions, each with a light
and a dark theme, over one set of roles: Forest Heritage (`light`, `dark`),
Transformative Teal (`teal-light`, `teal-dark`) and Stockholm Monochrome
(`mono-light`, `mono-dark`). **The site shows Monochrome only** (an owner
decision of 17 November 2026; until then it drew one direction at random per
visit). The Forest and Teal blocks stay in `tokens.css`, which is read-only here,
but no page uses them. `app.js` is loaded in the `<head>`, without `defer`, so its
first block runs before the body exists and sets `data-theme` (and `theme-color`)
before anything paints; the CSP rules out an inline script, so a small blocking
first-party file is the way to avoid a flash of the wrong theme. The rules:

- Light or dark follows the visitor's toggle choice (`localStorage`,
  `vynatix-theme`, which stores `mono-light` or `mono-dark`) and, without one,
  `prefers-color-scheme`. Only the light/dark half of the stored id is read, and
  every id the toggle has ever stored is accepted, so a visitor who chose `dark`
  or `teal-dark` before the change keeps dark.
- If storage is blocked the page follows the system. Without JavaScript the
  markup's own `<html data-theme="mono-light">` is what shows, and the markup's
  `theme-color` is the Monochrome light canvas.
- The retired draw's `sessionStorage` key, `vynatix-look`, is never written;
  `publish.js` fails if a script uses it again or a notice still names it, and
  `theme.js` checks every visit.

The theme and the consent choice write two keys in the visitor's own browser,
and neither is sent anywhere: `vynatix-theme` (`localStorage`, light or dark,
written when the toggle is pressed) and `vynatix-consent` (`localStorage`, the
analytics choice, written when Decline or Accept is pressed; see *Analytics*).
Both notices name both keys and call the first a display preference; whether
that description is right, and whether the bar has to mention it, is for counsel
to confirm (`tools/PRE-FLIP-CHECKLIST.md`, 4.2). Nothing is written to
`sessionStorage`: the hero background draw that used it is retired (see *Hero
background*).
- On the home page `app.js` also preloads the two headline faces
  (`DISPLAY_FACES`: Geist and the Fraunces italic), so the hero is not blocked on
  a late font fetch. Other pages add no preloads.

What is Forest-only stays Forest: the logo files in `assets/`, the favicon and
app icons and the manifest colours (a follow-up for the owner if the brand marks
should go Monochrome too). The inline wordmark and every page colour follow the
theme. The dark theme is a parallel environment, not an inverted light one: the
inverse bands (`.inverse`: the CTA band, the editorial band, the footer) sit on
`md-sys-color-inverse-surface`, which is light in the dark theme.
