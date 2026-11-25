# The English home page

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**The English home page** follows the owner's website content plan of November 2026: eight blocks
(nine until the owner took In numbers out on 20 November 2026),
each opening with a promise and backed by a fact, in the order a leading consultancy's home page
uses. `<main>` carries the class `home`, which scopes the page's own layout rules. After the hero
(the brand line "Engineering that compounds." as the headline, two buttons, and the client row
under the label "Trusted by companies that set the standard", the companies outside automotive
first, its one line ending in a link to `industries.html`, the page that says what was built
for which of them) comes a contents row (`.toc`, a `<nav>` of plain anchor links, one per section, in page
order: add, rename or move a section and this row changes with it). The row stays in the page:
the header is the only thing that pins. (Until 20 November 2026 it pinned under the header on
wide screens, which put a second bar over a fifth of a laptop window; that block is gone from
`styles.css`.) Then, in this order:

- `#services`, "Where we make the difference": three `.cap` columns, AI engineering first, then
  cloud platforms and application development, each one promise, the list of what is delivered
  (the label `cap__scope` and the list `cap__list`: the items of that service's "What we
  deliver" list on `services.html`, word for word and in its order; change the list there and
  here together; `copies.js` compares them) and one link to its section of `services.html`. One generated photograph lies across the three columns
  (the empty, `aria-hidden` `.cap__art` spans): one long oak workbench with a laptop and a GPU
  board, a small server rack, and a phone, tablet and watch, so each column shows the tools of its
  service. The slices are one file, drawn at 280% of a column and placed so that each column
  shows its own group whole, on the same bench at the same height (the positions are measured on
  the file; `styles.css` names them).
- There is no In numbers block. The plan had one after Services ("The numbers behind the
  promise": minutes per build, clients, reply time, the first drawn on a ruler), and the owner
  removed it from both home pages on 20 November 2026: do not bring it back, and do not move its
  figures into another block of the home page. The facts stay where they already were (the build
  time in the Volvo Cars case, the fourteen marks in the hero, the reply time in the closing
  band). The plan also had "7 years or more" of experience in every consultant; the owner took
  that out the same day (it would stop being true with a hire of fewer years), so no page states
  an experience figure for the whole team. One lesson from the block stays: the Geoptie audit
  read its `dl` and its `aria-hidden` ruler figure as "Minutes per build476Down from 47", so
  **a decorative figure is never text in the page** (draw it from the stylesheet), and a label,
  a figure and its sentence go in separate `<p>` elements, as on `work.html`.
- `#cases`, "Real results, in production": the three published cases as `.case` cards
  (`.cases--lead`), the regulated client first as the tall card and the other two as compact
  rows beside it from 905px, each one link to its section of `work.html`: the heading is the
  link and covers the card, and the "Read the case" line under the figure repeats it for the
  eye and for a reader of plain text (`tabindex="-1"` and `aria-hidden`, so a keyboard and a
  screen reader meet one link per card, the heading). Two `sr-only` labels name the card's
  fields, "Client and year:" before the meta line and "Result:" before the figure; the second
  is a paragraph of its own, because inside the figure it would be set in the accent face, which
  in Japanese holds only the characters the visible accents use. Each card says what the system is or what
  was measured, in sentences taken from `work.html`: change a case there first. Their pictures are
  generated photographs from the same set as the Services picture (binders and a highlighted
  report beside a laptop whose assistant answers with two numbered sources, a harbour crane in the
  window; a portrait monitor reading "Build passed" and "6 min" over ten stages with green checks,
  a car body on a lift beyond the glass; a truck cab on a forest road with a media player on its
  centre screen), set as
  decorative CSS backgrounds on `.case__img--*`. Under the cards: the link to all cases and the
  line that says the images are generated and show no client system. A fourth published case
  needs a decision first: the block holds three.
- `#partnership` (`.section--band`), "A partner that grows with you", on the inverse band, and
  under the heading the hero's drawing at four stages on one datum line (`.grow`, four
  `aria-hidden` `.fig` spans, each a mask over a role colour; the last carries the bronze edge).
  The owner preferred these drawn frames to a film of the drawing being made (20 November
  2026): do not replace them with video. Under the lead, the sentence that says what "every
  week" holds (the hours worked, which are what is billed; the words of the questions on
  `contact.html`) and one link to `contact.html#faq`, where the questions say how the work
  starts, how it is billed and reported, and whose the code is. The
  plan's closing sentence, "Start with one engineer and add more as you grow.", is left out on the
  owner's decision of 20 November 2026: do not add it.
- `#join`, "Great software comes from great people", with a link to the open-source libraries
  on `work.html#libraries` (the proof of the block's "in open source") and the "Join us" link
  (see *Audience switch (retired)* for why the id is `join`).
- `#insights` (`.reads`, `.section--surface`), "Ideas that move software forward": three entries
  as ruled rows from 905px (title on the heading's column line, description on the lead's), not
  a second grid of three, and a link to `blog.html`. Every post (`kind='post'`) must be among them (`permanence.js`
  fails otherwise), and each entry repeats the linked page's `<title>` (without the brand suffix)
  and meta description word for word. A Swedish page's entry is the exception since 23 November
  2026: its title stays Swedish (`lang="sv"` on the link) and its description is that page's meta
  description in English, with "In Swedish" on the date line, so the page reads in one language
  and the generated languages can translate it. Each entry shows the day its page was published
  (`read__date`): the page's `pub` in `tools/seo-head.py`, which never moves. `copies.js` holds each entry to its page's title, description and `pub`; the English line of the Swedish guide is one of its recorded exceptions.
- `#faq`, "Common questions": six of the questions on `contact.html`, word for word, as
  `.caps--2` columns (the markup of the Swedish hub's questions), with the page's FAQPage data.
  Change an answer on `contact.html` and here together; `copies.js` fails while the two differ.
- The call-to-action band (`#contact`), "Let's build what comes next." Its contact lines carry
  "Part of Ultra Group" with the footer's link, and no sentence about the group beyond that.

**What the Geoptie audit of 23 November 2026 changed** (76 of 100 on the live page; its reader
drops a link inside a heading and the footer, and it judges only what the page itself says).
Each of its comments was answered with a fact a published page already carried, and with a link
to that page: the case cards (above; "87% shorter build time" says what the figure measures),
the client row's link to `industries.html`, the Partnership sentence and link to the questions
on `contact.html`, the People link to the libraries, the dates and the English description in
Insights, the Ultra Group line in the closing band, and the meta description, which is now the first two sentences of the company sentence (147
characters, so a result shows it whole; the JSON-LD keeps all three). What it asked for that
only the owner can supply is not on the page: the regulated client's name and how its answers
were tested, what was done for each company on the client row (and whether each is a client:
the questions on `contact.html` name six as clients, the row shows fourteen), how and when the
47 and the 6 minutes were measured, whether each case still stands as told, and how the model
differs from hiring or from another kind of firm (which the plan keeps off every page). Four
of its comments ran against decisions of 20 November 2026, so they were put to the owner, who
decided on 23 November 2026: the questions are back on the home page (`#faq`, and still on
`contact.html`), each service carries a line of deliverables, and the hero's sentence says
what the engineers build instead of "raise the pace and make your software stronger"
("Vynatix is the senior software consultancy for scale-ups. Its engineers join your team and
build AI systems, cloud platforms and applications."). That sentence is the hero's alone: the
company sentence below is unchanged everywhere else. A visible "Last updated" line on the
home page was offered and not chosen: do not add one.

**The second report of 23 November 2026** (85 of 100, read after that merge) changed form and
wording, no decision: the deliverables became lists, with "Retrieval-augmented generation
(RAG)" and "Model Context Protocol (MCP)" spelled out on `services.html` and here; the case
cards got their two labels; and four answers of the questions, on `contact.html` and here
together, say more plainly what they said (the hero's sentence as the answer to "What does
Vynatix do?", Google Cloud, Amazon Web Services and "your own servers" for GCP, AWS and
on-prem, the 30 minutes in the first sentence of how the work starts, and what a sovereign
cloud is). Left alone, each for a reason: a review date on anything (the owner declined visible
update dates), "In English" on the English insights (the generated languages link their own
version of those pages, so the label would be false there), and everything on the owner's list
above, to which the report added: which changes cut the build time, how hours are estimated
and whether an engagement can change, and any certification.

**The page's pictures** (`styles.css`, "The English home page: its pictures")
are the owner's decisions of 20 November 2026. On this page `.section--surface` has no
tint and no rules, so the silk runs unbroken from the client row to the closing band; from
1280px the hero drawing's dash-dot centre line runs down the left margin, 40px outside the text
edge, with a tick at each block's label (pseudo-elements, decoration only). **The generated
pictures come in two sets, daylight and night**: the night version of each was made by editing
the daylight one, so the objects and the composition match. The current set is the owner's word
of 24 and 25 November 2026: the first set (still lifes of brass instruments on a drafting sheet)
"looks AI generated and out of context", and its replacement was to be made with ElevenLabs. So
**a picture here shows the work its text names, as a plain photograph would** (a desk, a screen,
a cab: natural light, no styling, no person, no logo or client mark), and each compact case
picture keeps its subject in the middle of the frame, because beside the card only a narrow strip
of it shows. Text in a picture is either too small to read or true: the one readable screen is
the Volvo Cars monitor, whose "6 min" is the case's own figure (change it with the case). The
owner asked on 25 November 2026 for the best the tools could make ("don't cheap out"): the
current set was generated at 4K and is shipped at twice its largest size on the page. `light-dark()` chooses the file from
the page's own `color-scheme` (which `colors_and_type.css` sets with the theme), so there is no
`[data-theme]` selector and a browser fetches only the set it shows; the theme toggle swaps
them in place. A browser without `light-dark()` for images keeps the daylight set in both
themes. Add a picture and it needs both versions and both lines of that block. None of this
moves: the rule that the silk is the site's one ambient motion is untouched. `sv.html` keeps the
older layout and the three photographs.

What the plan took off the page: the service chapters with their "What we build" panels, the
company sentence and the Gothenburg photograph, the four steps of How we work, the comparison
with a typical consultancy, the pull quote, the questions (and with them the page's FAQPage
data) and the joiner view. The questions were rewritten in the new voice on `contact.html`
(the owner's decision of 20 November 2026), and six of them came back to the home page on the
owner's word of 23 November 2026 (`#faq`, above). The service panels did not come back: the
one line under each service is all the home page says about deliverables. The lines the plan removes from the whole site (declining work, sending a
reader to another firm, "no pitch, no pressure", what a model cannot do as a headline,
automotive as the headline) do not come back on any page.

From 905px the home page keeps one column line: every section head and the closing band split
in halves, so their right-hand columns start on one line, and section titles take token ends (40
to 56px). The three insights sit in one row there, two-up between 600 and 904px. These rules are
scoped to the home page (`.home`, `#contact`): `.section__head`, `.section__h2` and the
`.cta-band` classes are shared with other pages, which keep the thirds.

On a phone the hero's lede is one type step smaller and its buttons a step closer. The onward links (the contents row, read-more links, the insight titles and the closing
band's contact lines) are 44px or more tall under 905px. Nothing here needs JavaScript and
nothing moves.
