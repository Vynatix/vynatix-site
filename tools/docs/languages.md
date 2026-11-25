# Languages

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Languages.** The site is in seven languages under one table, `tools/site/langs.json` (`LANGS` in
`tools/seo-head.py`): English and Swedish are *written* (the pages in `PAGES`, by hand, as above), and Spanish, French, German, Japanese and
Arabic are *generated*. A generated language is every English page except the three notices, rebuilt in a
folder named by its code (`es/services.html`, home page `es/index.html` at `https://vynatix.com/es/`). The
English page is the only source: nobody edits a file in `es/`, `fr/`, `de/`, `ja/` or `ar/`, and a run of
`python3 tools/seo-head.py` rewrites all of them. How it works:

- *Messages.* `tools/i18n.py` reads the rendered English page and takes out every message: the inner HTML of
  the outermost element that holds text of its own (a paragraph, a heading, a link label), and the
  translatable attributes (`alt`, `aria-label`, `aria-valuetext`, `title`, `placeholder`, any `data-i18n-*`,
  the meta description). Inline markup inside a message becomes numbered placeholders (`Read <1>the
  guide</1> <2/>`), so a translator never sees an attribute. Scripts, styles, inline SVG, `<code>`, anything
  with `translate="no"` and anything with a `lang` of its own are carried over as they are.
  A date that is the whole text of an inline element (the `<time>` of a byline: a day, an English month name
  and a year) is not part of the message. It stands as `{date}`, so the bylines are three messages
  (`Published <1>{date}</1>`, the same with ` · In Swedish`, and `Published <1>{date}</1> · Last updated
  <2>{date}</2> · Vynatix`), and each date is written in the language's own form from the catalogue's date
  pattern (`{d} {month} {y}`) and month names. A re-dated guide, or a new one with that byline, needs no
  catalogue entry for it. A translation keeps each `{date}` inside its own pair, or `i18n.py` and
  `verify/i18n.js` call it unusable.
- *The brand line.* "Engineering that compounds." in the home hero is `translate="no"` and stays English
  with `lang="en"` in Spanish, French and German, as on the Swedish hub. **On the Japanese and Arabic home
  pages it is set in the page's language, the owner's decision of 23 November 2026** (it was the largest
  type on those pages and the one line their own faces never drew):

  | | line 1, the text face | line 2, the accent face | word for word |
  |---|---|---|---|
  | Japanese | エンジニアリングは、 | 複利で効く。 | "Engineering / pays off at compound interest." |
  | Arabic | هندسة | يتراكم أثرها. | "Engineering / whose effect accumulates." |

  The mechanism is one rule in `tools/i18n.py`: an element held by `translate="no"` that has words of its
  own is an *optional message*. No language owes it a translation and none is reported as missing; a
  catalogue that carries one releases the element for that language, and it is then set like any other
  message (no `lang="en"`, no `translate="no"`). `tools/i18n/messages.json` lists these under `optional`,
  apart from `messages`, and `prune` keeps them. To change a rendering, edit the entry
  `Engineering<1/><2>that compounds.</2>` in `tools/i18n/ja.json` or `ar.json`, run
  `python3 tools/seo-head.py`, then `python3 tools/lang-fonts.py` (a new kanji in line 2 has to be in the
  accent face) and `npm run stamp`; to go back to English in a language, delete its entry.
  The wording was chosen from twenty candidates and three reviews of register, none of them by a native
  reader, and **it is the first thing to put before one**. What the reviews settled: Japanese engineers say
  複利で効く of tests, tooling and documentation, so the idiom is the reader's own; a bare 積み上がる or
  積み重なる ("piles up") was rejected because with no object it is what debt, backlog and billable hours
  do. In Arabic the finance words (عائد, "return"; the literal term for compound interest, which touches
  on riba) were avoided because they make a consultancy sound like an investment product; يتراكم أثرها
  names the mechanism ("cumulative effect" is أثر تراكمي) where يتضاعف ("doubles") would claim an amount,
  and تقوى ("grows stronger") was rejected because it reads first as the word for piety. The Arabic carries
  no vowel marks, as display type does. The slogan in the structured data stays English everywhere.
  The Japanese line 1 is ten full squares where "Engineering" is eleven narrow letters, so
  `.hero__h1:lang(ja)` (styles.css, "Languages") sizes the headline from that line; `verify/i18n.js` fails
  if the headline of a generated home page takes more than its two lines.
- *Catalogues.* `tools/i18n/<code>.json` maps each English message to its translation, the way gettext does.
  `tools/i18n/messages.json` (written by the script, never by hand) lists every message and the pages it is
  on, plus the few that are on no page: the label of the language list, and the withdrawn stub with the date
  pattern and the month names, which write the dates of the bylines too (*Messages*).
  The page's own JSON-LD nodes (`tools/seo/<page>.json`) are translated from the same catalogue; the
  Organization node stays the one English node every page carries.
- *Drift is a failed check.* When an English sentence changes, its message is no longer in the catalogues.
  The generated pages then show that sentence in English, marked `lang="en"`, and `python3 tools/i18n.py`
  and `tools/verify/i18n.js` fail until all five catalogues have it again. So **an edit to an English page
  is not finished until the five catalogues are**: run `python3 tools/seo-head.py`, then
  `python3 tools/i18n.py missing es` (and `fr`, `de`, `ja`, `ar`) for the list, add the translations, run the script
  again and move the language's `mod` in `tools/site/langs.json`. Beside a message that replaces a sentence, `missing` prints the
  previous wording on stderr: the old English and its translation, from the catalogue's closest stale entry
  (difflib, an entry of the same page first), so a retranslation starts from the sentence before.
  `python3 tools/i18n.py prune` drops entries no page uses, those stale entries among them, so it runs after
  the retranslation. It first does what `python3 tools/i18n.py dates` does alone, dropping nothing: an entry
  from before dates were patterns (`Published <1>6 November 2026</1>`) is carried into its pattern. A branch
  opened before that change runs `dates` before it merges it; the steps are at the head of `tools/i18n.py`.
- *Links.* A link to a page the language has keeps its name; everything else gains `../` (stylesheets,
  images, the notices, the Swedish pages) and a link to a page in another language gets `hreflang`, which
  `styles.css` shows as "(EN)" or "(SV)" after the link. A mailto subject gains the language in brackets
  (`subject=Project%20%5Bes%5D`), so the inbox shows which language an enquiry came from: the only measure of
  demand there is while analytics is off.
- *The notices are not translated.* `privacy.html`, `terms.html` and `accessibility.html` are legal text
  (`UNTRANSLATED`): the English governs, and a generated page links to it. The consent bar is English on a
  generated page for the same reason (`COPY` in `app.js` has English and Swedish only). **Before analytics is
  switched on with a generated language live, counsel has to decide whether the bar and the notice need that
  language**; that is a line for `tools/PRE-FLIP-CHECKLIST.md`, not something to translate ad hoc.
- *Header and footer.* Built from the same templates, `tools/templates/header.html` and `footer.html`, and then
  translated with the
  page, so they carry no `lang="en"`. The footer has no Swedish column (`site-footer__grid--four`) and, in its
  last row, the language list (`languages_for`): every language in its own name, linked to this page in that
  language or, where it has none, to that language's home page.
- *What app.js says.* Nothing in `app.js` is translated: the two sentences it writes are carried by the page
  (`data-i18n-play` on the background motion button, `data-i18n-percent` and `data-i18n-status` on the rate
  calculator) and the English is only the fallback. A new sentence written by script goes the same way. On a
  page in a language folder `app.js` finds the site's root from its own `src` (`UP`).
- *Type and direction.* The "Languages" block of `styles.css` is all the CSS there is: no tracking,
  taller display leading and upright emphasis for Japanese and Arabic (French and German need nothing); the
  script's own faces appended to the family lists (next point); and the few physical sides that right-to-left
  mirrors, most of them in the design system's own sheet. The layout itself is flex, grid and logical properties and
  mirrors with `dir="rtl"`. A phone number, an address and any message that stays in Latin
  script get `dir="ltr"` on an Arabic page. `hero-bg.css` is not linked: the hero background is the English
  home page's alone, and the hero fit's constants were measured on English and Swedish copy, so a longer
  translation simply scrolls (`min-height`, never `height`).
- *The faces of the other scripts* (the owner asked for them on 22 November 2026: faces in the spirit of the
  English type). Spanish, French, German and Swedish are Latin and are set in Geist and Fraunces like English.
  Japanese and Arabic get two faces each, **for the two roles the Latin type has**, self-hosted like the rest:

  | | where Geist stands (text, headlines, the interface) | where Fraunces italic stands (the accent) |
  |---|---|---|
  | Japanese | M PLUS 2, variable (`fonts/mplus2-variable-ja.woff2`) | Shippori Mincho Medium (`fonts/shippori-mincho-500-ja.woff2`) |
  | Arabic | Noto Sans Arabic, variable (`fonts/noto-sans-arabic-variable-ar.woff2`) | Amiri Regular (`fonts/amiri-400-ar.woff2`) |

  The text faces were chosen by measurement and then by eye on the real pages: both are drawn in one even
  stroke, and their stems are within a few per cent of Geist's at each weight the site uses (M PLUS 2 between
  0.95 and 1.07 of Geist's stem from 400 to 700, Noto Sans Arabic 0.91 to 0.94), so a page has the same colour
  in every language. The accent is a translation of the role, not of the shape: these scripts have no italic
  (a slanted copy is what a browser draws, and the Languages block forbids it), and what they have in its
  place is a second genre, a Mincho against the gothic and a Naskh against the sans. Before this the accent
  was simply lost on those pages. Shippori Mincho ships as its Medium, declared at weight 400: a Mincho reads
  lighter than a gothic at the same number. None of the four declares a Reserved Font Name, so a subset may
  keep its name (IBM Plex, Readex Pro and Aref Ruqaa, which were also considered, reserve theirs).
  **Geist and Fraunces still draw every Latin letter, digit and the brand name on those pages**: the script
  faces hold no Latin and their `@font-face` rules (the end of the block in `tokens.css`) carry a
  `unicode-range` of their own script, so a page in another language never fetches one either. After each
  face the family list names the device's faces of the same genre, for the moment before the file arrives
  (`font-display: swap`). Japanese gothic headlines set kana to their own widths (`palt`); the Mincho
  accent is set solid, every character on its square, because its proportional widths leave a gap after
  some kana; both break lines between phrases where the browser can (`word-break: auto-phrase`).
  **The files are cut from the pages.** A Japanese family is 4 to 9 MB; the pages use about 650 of its
  characters, so `python3 tools/lang-fonts.py` reads the generated pages and subsets each source to what they
  set (196 KB for M PLUS 2 with its weight axis, 30 to 40 KB for each of the other three). Kana and the Arabic
  language's whole repertoire are always in the cut, so only a new kanji asks for a new one: **after a
  translation adds a kanji, or puts a new one in an accent, `node tools/verify/i18n.js` fails, names the
  characters and says which face should have drawn them; run `python3 tools/lang-fonts.py` and commit the
  fonts with the catalogues.** That check asks the browser which font drew each run of text (the DevTools
  protocol's platform fonts), so it also fails on a wrong `unicode-range`, a family list that drops a face or
  a file that does not load. **A cut is reproducible**: each face is written with the fixed `modified` timestamp
  in `FACES` (the one its committed file carried), and fontTools and brotli are pinned in `tools/requirements.txt`,
  so a cut that changes no character writes the committed files byte for byte and a font in a diff is a real
  change. `python3 tools/lang-fonts.py --check` also cuts into a temporary folder and fails if the bytes differ
  (that part needs the sources), so it fails as well when a translation drops the last use of a kanji, which the
  browser check cannot see: cut again and commit the fonts. The sources are fetched from google/fonts and pinned
  by SHA-256 in the script's
  `FACES` table, which is also where a face is swapped: change the source and the file name there, the family
  name in `tokens.css`, the list in the Languages block and `SCRIPT_FACES` in `verify/i18n.js`, and look at
  the pages in both themes. **No native reader has judged these faces**, as none has checked the translations:
  the choice is the owner's, and a reader's verdict on register (above all on Amiri as the accent) is welcome.
  The other languages' names in the footer list (日本語 on an English page) are left to the device's fonts.

**A generated language is a draft until it is set live, and the brand voice asks for a native reader's check
first.** `"status": "draft"` in `tools/site/langs.json` means: built and checked, but its folder is named in `_config.yml`
`exclude` (the script keeps that list between two marker lines), its pages carry `noindex` and no hreflang, no
page outside the folder links to it, and it has no row in `sitemap.xml`, `llms.txt` or `tools/urls.lock`. A
draft page lists the other drafts in its language list so a reviewer can move between them. `status='live'`
publishes it: every English and Swedish page lists the language in its footer and carries hreflang to it, its
pages are in the sitemap, in `llms.txt` (a block the script writes before "Optional") and in the lock, and
**its URLs are permanent like every other**: a live language never goes back to draft (the script refuses), and
a translated page is withdrawn with its English source, as the stub in its own language. `live` needs one of
two records in its entry of `tools/site/langs.json`: `checked` and `by` (the date of a native reader's check and who made it), or `waived`
(the date the owner decided to publish without one).

**All five are live on the owner's decision (`waived`): Spanish and Arabic since 20 November 2026, French,
German and Japanese since 21 November. No native reader has checked them: the translations were written by a
model on those days.** `waived` says exactly that; never put a
date in `checked` for a check nobody made. The check is still owed, and `publish.js` prints a note naming the
languages that lack it on every run. When a reader has been through a language, correct its catalogue, move
its `mod`, and fill in `checked` and `by`. Still open, and the owner's to give: a sentence in
`accessibility.html` about the five languages (and, for Arabic, right to left), and the decision above about
the consent bar and the notices before analytics is switched on. Adding a language is one entry in
`tools/site/langs.json` (as a draft first), a catalogue, and for a new script a family list in the "Languages" block; a draft is
removed by deleting its entry, its catalogue and its folder, a live one never.

**The one exception: Chinese and Hindi, deleted on 21 November 2026.** Simplified Chinese (`zh/`) and Hindi
(`hi/`) went live with the others on 20 November and were removed the next day on the owner's decision, when
French, German and Japanese replaced them. The owner chose deletion over the withdrawn stub, so their 22 URLs
answer 404. Their rows stay in `tools/urls.lock` (append-only, and checked against main), and
`tools/urls.retired` lists each with the date of the removal: `permanence.js` accepts a locked URL that has no
file only when it is listed there, and fails if a listed URL has a file again, is in `sitemap.xml` or
`llms.txt`, or is linked from any page. A retired URL is never reused, and a retired language code is not
brought back without the owner. Asking search engines to drop the URLs (Search Console, Bing Webmaster Tools)
is the owner's to do. This is not a precedent: any other page or language that has been public is withdrawn as
the stub (`tools/TAKEDOWN.md`).
