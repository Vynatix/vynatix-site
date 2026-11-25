# Progressive enhancement / accessibility

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Progressive enhancement / accessibility** is a real constraint here, not an
afterthought — preserve it:
- No-JS users get the fully visible final state; nothing is hidden pending JS.
- **Controls that need JS must not sit dead without it.** The pattern is to
  hide them in CSS and let `app.js` opt in by adding a class to `<html>`:
  `.js-nav` for the collapsible mobile nav (without it the nav stays visible
  and wraps under the bar; `app.js` sets it in the blocking head, so a phone never paints the
  wrapped nav and then jumps, and takes it back off at `DOMContentLoaded` if the page has no
  menu button or nav) and `.js-theme` for the theme toggle (it keeps its
  place but is invisible until it can work). The consent module follows the same
  rule by building its markup only when it can work: the bar and the in-page
  panel do not exist without JavaScript, with blocked storage, or while the ID is
  the placeholder, and the footer's "Cookie settings" link is then a plain link to
  the notice. It adds `js-consent` to `<html>` once active (a test hook and a
  guard against a second copy of the script; no CSS depends on it) and
  `consent-open` while the bar is on screen (the bottom reserve in `styles.css`
  depends on that one).
- Motion is short transitions on hover and focus, and the silk background (see
  *JavaScript* and *Silk waves*). The system's `prefers-reduced-motion` rule cuts the
  transitions to 0.01ms, and the silk is still.
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
