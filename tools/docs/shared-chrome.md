# Shared chrome: the header and the footer are templates, the rest is duplicated

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Shared chrome: the header and the footer are templates, the rest is duplicated.** The `<header>` and `<footer>`
are written into every page by `tools/seo-head.py` from the templates `tools/templates/header.html` and
`footer.html`, with the company's facts from `tools/site/company.json`: a nav
change (the menu's links in `header.html`), a change to the footer's links (`footer.html`) or to its contact
details (`company.json`, which the Organization node reads too), or an `aria-current="page"` on the
current page's nav link is made there, once, and the script run, not by hand in every file. The skip link and
the inline `<svg class="svg-defs">` that defines the wordmark `<symbol>` (both header and footer place it with
`<use>`) are still copy-pasted into every page: a change to either must be applied to all `*.html` files
The
header's logo markup is part of `header.html`; the contact details the footer shows are `${name}`s in
`footer.html` whose values are in `company.json`. The Legal list in the footer
carries the "Cookie settings" link (`data-consent-open`), which reopens the consent bar. The header is the system's TopAppBar: a floating Liquid
Glass bar (`.site-header`) whose links take the 2px `--indicator` underline
when current, one small primary button and two icon buttons. On a phone the links fold into
the menu, but the "Get in touch" button stays in the bar from 375px (enhanced header only:
without JavaScript the wrapped nav shows the link, and under 375px it sits in the menu; with
enlarged text its label wraps rather than leaving the bar), so a reader can act from any depth
of a long page. The menu button's listeners are delegated from the document in the blocking
head, so it works from the moment it is painted. On a phone the footer's link groups sit two-up
where two columns fit, one column where they do not. The print layer (`styles.css`, "Print")
prints the header once, without its controls, and keeps the inverse bands, the filled buttons
and the client marks in colour; tonal surfaces, cards and outlined buttons print the browser's
economical way, so a dark theme does not print as black slabs.
