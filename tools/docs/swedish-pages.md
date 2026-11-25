# Swedish pages

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Swedish pages** set `<html lang="sv">` and keep the shared English header and
footer, which carry `lang="en"` so screen readers switch voice; only the skip link
is translated, and, while the consent module is active, the footer's "Cookie
settings" link, which it relabels "Cookie-inställningar" (with `lang="sv"` and a
link to `integritet.html#cookies`) on any page whose `<html lang>` starts with
`sv`. Without JavaScript, or while the module is inert, the English link to
`privacy.html#cookies` stays. `integritet.html` is the Swedish twin of
`privacy.html`, one of the English/Swedish pairs, and the Swedish consent bar links
to it. The footer's "På svenska" column (`lang="sv"`) links the Swedish
hub (`sv.html`), which links every Swedish guide in its `#guider` section, and
`integritet.html`, which is a notice and not a guide and so is linked from that
footer column (and by the Swedish consent bar), not from `#guider`. On a Swedish
page the footer's Legal column therefore deliberately holds one Swedish item, the
relabelled "Cookie-inställningar" link, among English ones ("Privacy", "Terms",
"Accessibility"); the shared footer is English by design, and the link has to match
the Swedish bar and notice. Without JavaScript it reverts to English. The
two home pages follow the same plan and are not mirror images: the Swedish hub (`main.home`, as the
English page) has the same blocks in Swedish under the English brand line (`lang="en"` on its
`h1`), no client row and no contents row, its insights in `#guider` (the three Swedish guides)
and, where the English questions live on `contact.html`, its own questions in `#faq`. Its case
cards and several links lead to English pages and say so. The Swedish was written with the
English rewrite on 20 November 2026 and **has not been checked by a native reader**, which the
brand voice requires before it goes out. The Insights entries on both home pages repeat the
linked pages' `<title>` (without the brand suffix) and meta description
word for word; when one of those changes, change the home page item with it. Write
Swedish as Swedish (the reader is "ni"), not a translation of the English page.
