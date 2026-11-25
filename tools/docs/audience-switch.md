# Audience switch (retired, November 2026)

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Audience switch (retired, November 2026).** The English home page used to open with a bar of two
links, "Hire a team" and "Join the team", and held a second view for senior engineers at
`index.html#join`, lifted from `membership.html`. The owner's website content plan takes the
membership pitch off the home page, so the bar, the joiner view, its skip link, the
`js-view-join` block of `app.js`, the `view-hire` / `view-join` classes and
`tools/verify/audience.js` are gone. What is left of it:

- **`#join` still answers.** It was a public address, so the People section carries
  `id="join"`: an old link lands on "Great software comes from great people" and its "Join us"
  link, which goes to `membership.html`, the Career page. `#hire` has no element
  now and lands at the top of the page, which is what it showed.
- **`main.home`** is the scope the home page's own layout rules hang on (`styles.css`, "Home
  page"), where they used to hang on the two view classes; `.hero--clients` marks the English
  hero, the one with a client row, where the fit rules used to read `.audience ~ .hero`.
