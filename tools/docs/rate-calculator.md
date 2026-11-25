# Rate calculator

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Rate calculator.** Asked for on 20 November 2026, and an exception to two rules above (nothing
about how Vynatix runs inside; no terms or pay on Career): `membership.html#rate-calculator`, between
"How it works" and the closing band. The visitor types an hourly rate, the hours billed in a month,
monthly costs, a savings
target and, behind a checkbox, a company car; the card beside the form shows the share of the
month's invoicing, the highest gross salary it carries (a whole hundred, never under 1,000), what
that salary costs line by line, the fixed and total costs, and what is left on the balance.

- **Where it lives.** Markup in `membership.html` (`[data-calc]`, inputs named by `data-calc-in`,
  figures by `data-calc-out`), the fourth block of `app.js`, the "Rate calculator" block of `styles.css`
  (`.calc`). No form element (Enter must not submit anything), no storage, no request: what is
  typed never leaves the page, so the notices do not mention it.
- **The share is 70 per cent and its slider is out of sight** (asked for on 20 November 2026). The
  slider (70 to 80) is in the markup with `hidden` on its field (`[data-calc-share]`); five clicks on
  the "Your assignment" title (`[data-calc-reveal]`), each within two seconds of the last, show it
  for the rest of the visit, and nothing is stored. The page gives no hint on purpose: no tooltip,
  no pointer cursor, no tab stop, no word about it, so do not add one (and it has no keyboard
  route, which is the accepted cost of that). While hidden, the share is held at the slider's
  starting value even if a restored form or a script moves it. This keeps the control out of
  sight, not secret: the range is readable in `app.js` and the markup, and the first figure on the
  card (the share of the month's invoicing) is 70 per cent of rate times hours.
- **The model** is in the comment above the block. `SALARY_COST` (1.57) is the whole cost of one
  krona of gross salary and decides the salary. The lines the card itemises (employer
  contributions 31.42%, five weeks of holiday, pension 4.5%, payroll tax of 24.26% on the pension)
  come to 1.4663; the difference is shown as "Other salary costs", taken from the rounded figures
  so the list adds up to the total to the krona.
- **The numbers are the owner's.** They were copied from the calculator this one was modelled on
  (consulting-salary-calculator.netlify.app), not supplied in writing: the share's range, the
  pension, the 1.57 and what "Other salary costs" stands for are to be confirmed before the page
  is published, and the two tax rates are the 2026 ones and change with the law. A change is made
  in three places together: the constants in `app.js`, the percentages printed in the page's
  labels, and the same constants in `tools/verify/calc.js`. `tools/verify/copies.js` fails when a printed percentage is not its `app.js` constant times 100, rounded to two decimals.
- **Without JavaScript** the calculator is not displayed and a paragraph (`.calc-nojs`) says it
  needs JavaScript and links to `contact.html`; `app.js` sets `js-calc` on `<html>` once it has
  wired the fields. The car fields are `hidden` until the box is ticked and count only then.
- **Accessibility.** Every field has a label, hints are tied with `aria-describedby`, the slider
  carries `aria-valuetext`, and the result is announced through one `role="status"` line 0.8s
  after the last keystroke (eleven live figures would talk over the typing). Controls are 44px or
  taller. Nothing moves.
- **Copy.** The section says what the tool does and that it is an estimate, not an offer. It adds
  no sentence about how engineers join or what the terms are: that text is still the owner's.
- `tools/verify/calc.js` (in `npm run check`) types into the page and compares every figure with
  the model written a second time, and covers the list adding up, the car, bad input, storage,
  the announcement, the layout at three widths and the no-JavaScript state.

What the plan left open, so the pages do not have it: the two sentences about Ultra Group and
the people section on About; the open roles, the line on how engineers join and the line on
knowledge sharing on Career; a case outside automotive on Industries; the challenge line of the
Volvo Trucks case. None of these is to be written without the owner's text.
