# Posts, permanence and withdrawal

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

The site's blog format is the **Guide**: a dated page that answers one buyer question, in the house pattern
of the four Swedish guides. A page written to this pattern after the blog was added is a **post**, marked
`"kind": "post"` in its registry row, `tools/site/pages/<slug>.json` (the older guides are not marked). The full plan,
its measurements and the reasons for every choice below are in the blog extension plan the owner holds; this
section is the working rules.

**Where a post lives.** At the flat root, as `<slug>.html`, with a slug that is undated, descriptive and
permanent (a-z, 0-9, hyphens; it must not contain the words `project` or `membership`). Never in a directory:
a `blog/` directory breaks `stamp.js` (non-recursive, and its regex needs `href="styles.css`), the exact-match
footer checks, the font preloads in `app.js` (any path ending `/` is treated as the home page)
and `publish.js`. Never `_posts/*.md`: Jekyll publishes a
markdown file without front matter at `/YYYY/MM/DD/name.html` and `publish.js` lets it pass. A slug is never
reused and a URL never removed.

**The pattern.** Eyebrow "Guide"; a question as each H2, with the answer in its first sentence; the lede
says that Vynatix wrote the guide; a `data-faq` block (flat, as in the SEO
section); the company sentence verbatim under "About Vynatix"; a call-to-action band. (Until November 2026
the pattern also asked for an interest disclosure and a "when we are the wrong choice" section; the content
plan removed both, with the argument for other firms.) The byline is
`<p class="prose__meta">Published <time datetime="YYYY-MM-DD">…</time> · Last updated <time datetime="YYYY-MM-DD">…</time> · Vynatix</p>`
(Swedish: "Publicerad" and "Senast uppdaterad"); the two dates are `pub` and `mod` in the registry, and
`permanence.js` fails if they differ. The generated languages translate a byline once per wording, not once
per date (*Languages*), so a new guide that keeps this byline adds no catalogue entry for it. No cadence
promise anywhere. **Section ids must not be `article`**: the
Article node's `@id` is the page URL plus `#article`, and a FAQ container with that id collides with it
(`seo.js` then reports a misleading date error). Use `intro`, `questions`, `faq` and the like. The
byline author is "Vynatix" and the Article's author is the Organization; no named person appears anywhere on the
site, and naming one is an owner decision.

**Registering a post.** Add its row, `tools/site/pages/<slug>.json`, with `"kind": "post"` and no `order` (a new
page sorts after the others by `pub`, then by slug), which `tools/seo-head.py` and `tools/verify/_common.js` both
read; add its slug to each list of `tools/site/lists.json` it belongs in (the Blog page's section of its language, the home page of its language, the ItemList `blog.html#guides` and `llms.txt`; `seo-head.py` writes its line in `llms.txt` and its item in the ItemList of `blog.html` from there); list it on the Blog page (`blog.html`, under
its language, with the page's title without the brand suffix and its meta description word for word) and on the home page that matches its language (`index.html` Further
reading repeats the title and description the same way; `sv.html` guider); run `python3 tools/seo-head.py`, which writes the head, the
footer, the header, the sitemap, `tools/urls.lock`, the guide's line in `llms.txt` and its item in the ItemList; run `node tools/indexnow.js <slug>.html` after the
deploy. `publish.js` names an omission of the registries or `llms.txt` precisely, and `permanence.js` fails if
a `kind='post'` page is missing from `blog.html`, from its ItemList (read in the page's structured data) or from the home page of its language. `tools/verify/copies.js` fails if an entry on those lists, a guide line of `llms.txt` or an ItemList name stops repeating its page's title (without the brand suffix), meta description or `pub`, apart from the differences it records, with their text, in `EXCEPTIONS`. It also fails if a list holds other pages, or holds them in another order, than `tools/site/lists.json` gives it, or if an `override` there is not one of those exceptions with the same text: the hub lists are written by hand until the owner allows `seo-head.py` to write them (`tools/REFACTORING-PLAN.md`, step 2.4, part c), and the file holds their order meanwhile. A list that names a withdrawn page stops `seo-head.py` (`tools/TAKEDOWN.md`, step 3). Nothing checks the other
hand-kept lists: when you edit `blog.html`, `index.html` or `sv.html`, move that page's `mod` and run the
generator. Swedish items on the Blog page carry `lang="sv"` (and `hreflang="sv"` on the link). Adding a Swedish
post makes the `sv.html` guider lead ("Publicerade den 18 oktober 2026") false: fix it then. After the deploy,
ping IndexNow for the post, its twin and the pages that now list it (`node tools/indexnow.js <slug>.html
blog.html index.html`). Run `node verify/a11y.js` (both themes by default)
on the new page, because `accessibility.html` says every page is scanned in both themes. A post adds no
CSS, so no `npm run stamp`. An English post with a Swedish twin (or the reverse) is a pair: `alt` on both pages and
`"original": true` on the original, `"original": false` on the translation (the English page is the original unless
the registry says otherwise; `seo-head.py` refuses a pair with zero or two originals, and `seo.js` checks the
`workTranslation` / `translationOfWork` direction). Pair a page only with a full counterpart that has the same
question and the same answers.

**The call to action carries the post's slug.** The primary button is
`mailto:front.disk@vynatix.com?subject=Project:%20<slug>`, with the plain address under it and one sentence
saying the subject line names the guide and can be changed, linking to the notice's email section
(`privacy.html#email`, or `integritet.html#email` on a Swedish page), written in the page's language;
`mailto.js` fails a page whose button carries its slug without that link. The routing word
stays first because `contact.html` asks senders to start the subject with Project or Membership; nothing in the
repository says how the inbox is routed. `tools/verify/mailto.js` enforces the form. Only mail sent from that
button with the subject unedited is tagged; analytics are off, so this is a floor, not a count.

**Drafts.** The repository is public, and a draft pushed to any branch is public on github.com even though
only the production branch is served. A post that introduces a fact not already on a published page is drafted
outside the repository and committed only after the owner has approved the text; a twin of a page that is
already published may be drafted on a branch. A `[[CONFIRM: what is needed]]` marker is a fact only a human
supplies: never fill one in; `permanence.js` fails on one in any page or published text file that is not a
privacy notice.

**The tagged subject is disclosed.** Both notices say, in their email section (`#email`), that a guide's
email button names the guide in the subject line, that the visitor can change or delete it, that it is used to
know what they read and that messages are counted per guide without names, on the basis of legitimate
interest; the summary list says "no other website analytics" and points there. The guide's call-to-action
sentence links to that section. Keep the three in step: a post whose button carries its slug relies on them,
and any other use of the subject (beyond answering and counting per guide) needs the notices changed first.
The notices as a whole remain drafts pending counsel.

**Dates when a branch sits.** A page's `pub` is the day it first goes live, not the day it was written, so a
branch merged on a later day than the dates it carries is re-dated on the day of the merge, in its own commit:
`python3 tools/redate.py` (or `npm run redate` in `tools/`; `--dry-run` shows the plan and exits 1 if anything
would change, so it can stand in a merge checklist). Against `origin/main` it finds the **new** pages (the file
is not on `main`) and the **changed** ones (the branch moved `mod` in the page's row; a change to the generated header
or footer alone moves no date, so `git diff --stat` is not the list). It moves `pub` and `mod` of the new pages
and `mod` of the changed ones to the merge day, with the byline's Published / Publicerad and Last updated /
Senast uppdaterad `<time>` and the `legal__meta` line that repeat them, and the `tools/urls.lock` rows of the
new pages, then runs `seo-head.py`. The generated pages follow with no catalogue edit, because a byline's
date is not part of its message (*Languages*). It never touches a lock row whose URL is on `main` (a row is
never edited
once its URL has been on the live site), event dates (the list pages' Checked / Kontrollerad lines, the
`sv.html` guider lead, `tools/TAKEDOWN.md`, `tools/CITATION-LOG.md`), a date in the future or one earlier than
the date it replaces, and it refuses a page whose visible date already disagrees with the registry and a
`--base` whose registry it cannot read (read as empty, every page would look unchanged).
`permanence.js` checks the visible dates of every page (D for posts, V for the rest) and that no row of
the lock on `origin/main` changed: it prints the commit it compared with and fails in a checkout without
`origin/main`, so fetch it first. Then run `npm run check`.

**Owner-approved wordings.** A post reuses these or leaves them alone; it does not restate them in new words.
Cited by file and phrase, not by line (lines move). The owner must confirm this list is complete.
- The company sentence, verbatim: "One sentence about the company", above.
- The three cases that can be discussed and the non-disclosure line. Since the content plan of
  November 2026 the `work.html` hero says "Three stories we can tell in full. More of our work is trusted to us
  in confidence." (the owner's wording), and the home pages no longer carry a non-disclosure sentence.
  **The scope of the non-disclosure line differs between the pages that still have one.**
  Limited to Volvo Trucks and Volvo Cars: `android-automotive-development.html`
  and `android-automotive-utveckling.html`. Unscoped: `terms.html` ("Clients named on this site appear with their knowledge; the remainder of our
  work is under non-disclosure and is not described here"). Read as "beyond the published cases", an
  unscoped sentence implies the Volvo-limited one, so no two sentences contradict each other. Only the
  `terms.html` sentence was committed by the owner (e413cb9); the others come from agent commits, and all stay
  until the owner answers one question: **is all work not described on this site, for every client, under
  non-disclosure?** **New content uses the Volvo-limited form, word for word**, because it is true either way: in
  English "Beyond what we have published, our work with Volvo Trucks and Volvo Cars is under non-disclosure."
  (`android-automotive-development.html`, "Non-disclosure is normal"), in Swedish "Utöver det vi har publicerat
  omfattas vårt arbete med Volvo Trucks och Volvo Cars av sekretess." (`android-automotive-utveckling.html`, the
  same section). Where it follows a list of all three cases, label it with its scope ("Volvo Trucks and Volvo
  Cars:"), so it is not read as the whole remainder or as a claim that the regulated client's other work is
  public. Do not reuse "That is what we can publish. The rest of our work with Volvo Trucks and Volvo Cars is under
  non-disclosure." outside the Volvo Trucks case it follows: read alone it takes in the published Volvo Cars case.
- Client names in prose are the ones the content plan names, all of them on the hero's row: Saab, Sony,
  Tele2, Swisslog, Volvo Penta, Scania, Magna, Volvo Cars and Volvo Trucks (`industries.html`, the questions on
  `contact.html` and `sv.html`). A case is told only for Volvo Trucks, Volvo Cars and the
  regulated client; never a broader Volvo claim, and Volvo Buses appears in the logo strip only
  (`assets/CREDITS.md`). The content plan asks for each client's written approval before its name or logo is
  shown, and the owner confirmed on 20 November 2026 that the approvals for the fourteen are collected. A
  fifteenth name still needs its own.
- The Volvo Trucks case and the Volvo Cars case (`work.html`, `index.html`) and the figures in them.
- The regulated client stays anonymous (`work.html`, the closed-domain assistant case;
  `ai-assistent-interna-dokument.html`).
- Team projects: no client names, dates or figures (the comment above `#team-projects` in `work.html`); library
  names are allowed.
- No headcount, and no figure the owner has not confirmed (the history of `index.html`: commits 1c9c765,
  2b39a53, d03ea15).
- Other firms: their own words, alphabetical, dated, sourced, with the disclosure, never ranked (see "The list
  pages" above).

**Withdrawing a page.** `"status": "withdrawn"` in the page's registry row replaces the page with a stub, adds `noindex`,
drops hreflang, FAQ and Article data, and removes it from `sitemap.xml`; `tools/urls.lock` (append-only,
written by `seo-head.py`) remembers every URL ever registered, and `tools/verify/permanence.js` fails if a
locked URL has no file, if a withdrawn page is still linked, listed in `llms.txt` or a feed, or disallowed in
`robots.txt`, or if its title, description or `<main>` is anything but the stub's own text. Its `--self-test`
(in the chain) proves those failures still fail. The lock is append-only by convention and review (check that
`git diff tools/urls.lock` shows only added lines); a deliberate deletion of the file, the registry entries and
the lock row together is not caught. The runbook, with the timeline and what a stub
cannot do, is `tools/TAKEDOWN.md`. A withdrawn page is the one case where `seo-head.py` rewrites `<main>`, the
title and the description (apart from a link to a home page, which it writes as the folder anywhere in a page).

**Checks.** `permanence.js`, `mailto.js` and `copies.js` are in `npm run check` (static, third, fourth and fifth).
`python3 tools/seo-head.py --check` (`npm run check:gen`) reports any generated part that differs from what a
run would write; it needs Python and is not in the chain. `seo-head.py` exits with an error on a page that
lacks its footer marker (it used to skip it silently).
