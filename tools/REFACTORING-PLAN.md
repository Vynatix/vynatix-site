# Refactoring plan: less overhead per change

Written 24 November 2026. Not published (`tools/` is excluded in `_config.yml`). A plan, not a change: nothing
here has been carried out, and nothing in it is an owner decision until the owner makes it.

**The goal** is to cut the overhead of a routine change: the files it touches, the commands it needs, the merge
conflicts it causes, the prose that has to be read or updated first, and the time the checks take.

**What does not change:** the interface, the behaviour, the copy, the structured data, every URL and the domain.
The acceptance test for every step is a byte comparison of the published files (section 3, step 0.1). Steps
that would move a published byte without moving anything a visitor or crawler can perceive are collected in
step 5 and each needs the owner's word.

How this was produced: ten readers mapped the subsystems from the code and the git history, and a second agent
tried to refute each finding (100 hazards: 75 confirmed as stated, 25 corrected in part, none refuted). Forty redesign ideas were then
generated in five isolated branches, scored by three judges and clustered; seventeen were marked as traps. The
numbers below come from that map. Projections are marked as such.

## 1. What a change costs today

Measured over the 136 commits of the visible history (a shallow clone; 128 of them since 13 October 2026).

| Routine change | What it costs today |
| --- | --- |
| A CSS or JS tweak | 115 files: the file and a `?v=` stamp in 114 pages. 64% of all page-file touches in the history change nothing but a stamp. |
| Two branches open at once | 11 of 12 branch-sync merges conflicted; every conflict hunk checked was a stamp line. Reverting an older merge conflicts in 114 files. |
| One English sentence on a translated page | About 9 manual steps and 14 to 89 files; 89 when the language's `mod` date moves, because that re-dates all 80 generated pages. |
| A nav, footer or CSP change | 114 files. The CSP meta, the asset links, the skip link and the 8.5 KB SVG block (11.2 KB per page) are pasted by hand into 34 pages. |
| A new guide | Hand edits in about 14 files; the title and description are retyped in four places and one copy has already drifted on a live page. |
| A rule or decision changes | Prose in `AGENTS.md`, again in `CLAUDE.md`, often in `tools/README.md`. `AGENTS.md` changed in 49% of commits and grew from 275 to 1,641 lines. |
| Reading before a safe edit | About 24,000 words, with no task index. |
| Running the checks | By hand only. 22 commands in series, about 1,500 page loads, an estimated 15 to 30 minutes, a hand-started server, and only the first failure reported. |

Since the generated languages landed (20 November) the median commit went from 21 files to 85. 56% of all diff
lines in the history are tool-written output (83% since 20 November, 94% counting the catalogues).

## 2. Why: five causes, in order of measured cost

1. **Derived values are committed into every page.** The stamp is a function of four files, written into 114.
   It is the largest single source of touched files and the cause of almost every merge conflict.
2. **Generator output lives beside its source.** A root page has four writers (a person, `seo-head.py`,
   `stamp.js`, `redate.py`); by bytes 39.7% of it is tool-written, 28.1% is hand-copied shell and 32.2% is the
   page's own content. The 80 generated pages are committed too.
3. **Facts have several homes.** The page registry is a Python dict literal, read by four regex parsers and
   copied by hand into a JavaScript array. A date sits in seven or more places. Guide titles and descriptions
   are retyped into lists. Header, footer and company facts are Python string literals.
4. **Prose is a second implementation.** 65% of `AGENTS.md` is one section with no headings. Owner decisions
   are dated sentences in 28 topic blocks with no register. Page counts appear as literals with six values.
   The check chain is described in four places that disagree.
5. **Nothing runs the checks.** No workflow, no hook, `main` unprotected, and a merge is live in 45 seconds.
   Twelve checks iterate a hand-kept list of 34 pages, so the 80 generated pages get a reduced set, and the
   screenshot diff is manual with an untracked baseline.

Secondary: `styles.css` relies on source order between its later blocks (five different blocks are called
"the last" in the docs; one is); checks read `app.js` by exact source shape; 18 font files are unreachable;
the Japanese and Arabic font cuts are not byte-reproducible.

**What works and stays:** permanent URLs with the append-only lock and its self-test; the byte-exact generator
check (`seo-head.py --check`, 2 seconds over 114 pages); static checks first; checks that prove they can fail;
parsers that fail closed; the strict CSP; progressive enhancement; honest status statements; decisions that are
already data (`waived` in `LANGS`, `urls.retired`).

## 3. The target, and the steps to it

Five principles. Each step below serves one of them.

- **P1. A work branch carries what a person or agent wrote.** Derived values are written as late as possible.
- **P2. One home per fact.** Every other copy is written by a tool, never retyped.
- **P3. Checks run by themselves,** report every failure, and treat all 114 pages alike.
- **P4. Rules are addressed records.** A decision is one dated file with the paths it governs and, where one
  exists, a guard. Reading is scoped to the change.
- **P5. Every step is proven** by the byte comparison before it merges.

Target layout (new or changed parts only):

```
*.html                      a person writes <title>, the description and <main>; a tool writes the rest
_data/stamps/<name>.json    the five stamps (step 1, option A)
.github/workflows/check.yml the checks on every pull request
.gitattributes              generated files collapsed in review
AGENTS.md                   a router: the index and the always-on rules
CLAUDE.md                   one import line and the always-on rules
tools/site/pages/<slug>.json  one registry row per page
tools/site/langs.json, company.json
tools/templates/            header, footer, shell and stub as HTML files
tools/gen/                  the generator in modules (seo-head.py stays the entry point)
tools/decisions/            one file per owner decision
tools/docs/                 topic reference: today's AGENTS.md blocks, verbatim
tools/verify/               check.js (runner), shipped.js, decisions.js
```

Suggested order: 0, then 1 as soon as the owner has decided, then 2, 3 and 4, which do not depend on each
other. Step 1 is the largest cut and needs only step 0.

### Step 0. The safety net (no published byte moves)

| | What | Why |
| --- | --- | --- |
| 0.1 | `tools/verify/shipped.js`: derive the published set from the tree and `_config.yml` (245 files today) and compare it with another revision. `--against origin/main` must list nothing for a refactoring pull request. | The acceptance test of this whole plan. Git blob ids make it exact and instant. |
| 0.2 | `.github/workflows/check.yml`: on every pull request run the static tier (CSP, what ships, permanence and its self-test, mailto, release-gate self-test, stamp check, `seo-head.py --check`, `i18n.js --static`, `shipped.js`). Read-only permissions, actions pinned by commit, full fetch so `origin/main` is visible. | The static tier needs only Node built-ins and Python: seconds, no install, no browser. Today nothing runs. `.github/` is a dot folder, so it is not published and `publish.js` already skips it. |
| 0.3 | Owner settings, which cannot be committed: branch protection on `main` requiring that check, and a real team in `CODEOWNERS`. | Both are already listed as open in `AGENTS.md`. Without them the workflow informs but does not stop a merge. |
| 0.4 | Pin the tools: commit `tools/package-lock.json`, add `engines`, and either state Python 3.12 or remove the one construct that needs it (`seo-head.py` fails with a syntax error on 3.11 and earlier). | A fresh container or a CI runner must give the same verdicts. |
| 0.5 | `.gitattributes`: mark `es/ fr/ de/ ja/ ar/`, `sitemap.xml` and `tools/i18n/messages.json` as `linguist-generated`. | GitHub then collapses them in review. It removes noise, not conflicts. |
| 0.6 | `tools/sync`: one command for a stamp conflict (take either side of every tool-written file, run `seo-head.py` and `stamp.js`, run both `--check`s). | A bridge until step 1. Today each agent resolves 114 files its own way. |
| 0.7 | Close the fail-open holes found: `permanence.js` skips its comparison silently when `origin/main` is absent; `stamp.js` stamps 34 pages and exits 0 when `messages.json` is unreadable; no check compares `url()` targets in the stylesheets with the files on disk. | Each is a green result that proves nothing. |

### Step 1. Stamps out of the pages (the owner decides how)

The stamp guarantee stays: every page names the exact stylesheet and script it was written for. What changes is
where the value is written. All four options were weighed; three were tested.

| Option | A CSS edit touches | Stamp conflicts | New machinery | Recorded principle |
| --- | --- | --- | --- | --- |
| **A. GitHub's Jekyll prints the stamp** (recommended) | 2 files | Only when two branches change the same asset, in one one-line file | A nine-line render function for local preview and checks | Amended: nothing of ours runs at deploy; the Jekyll that already builds every push substitutes five values |
| A2. As A, but the stamp is the build revision | 1 file | None, ever | The same, and `stamp.js` is deleted | As A. The 457 stamp values change on every deploy, so returning visitors fetch the four files again after each deploy |
| B. `main` holds source, a `live` branch holds the shipped bytes, written by an Action on merge | 1 file | None | An Action with write access, Pages repointed to `live`, a build-to-directory mode, checks on the build | Restated: what is on `live` is exactly what ships. Also takes the 80 generated pages, the sitemap and the tool-written regions out of every work branch |
| C. Stay as today | 115 files | As today, resolved by `tools/sync` | None | Unchanged |

**Why A.** It was verified on the real carrier: with two lines of front matter on the 114 pages and the 457
references written as `styles.css?v={{ site.data.stamps.styles }}`, a build with GitHub's own versions
(github-pages 232, Jekyll 3.10.0) is byte-identical to GitHub's artifact for the same commit, and
`seo-head.py --check` passes unchanged on the converted tree. It needs no new service and no owner setting.

What A consists of:

- Front matter (`---`, `---`) on every page; the generated pages inherit it from their English source.
- `_data/stamps/styles.json` and four siblings, each holding one quoted hash. One file per asset, because
  adjacent lines in one file conflict even when two branches changed different assets (tested).
- `_config.yml` gains `liquid: strict_variables: true` and `error_mode: strict`, so a mistyped key fails the
  build instead of publishing an empty `?v=`.
- `stamp.js` writes five small files. Its `--check` also holds the page shape: exactly that front matter,
  exactly the expected tags, and no other `{{` or `{%` anywhere in a page.
- `tools/serve.js` and `readPage()` in `_common.js` apply the same substitution, so preview and all checks see
  the shipped bytes. A raw page no longer opens correctly straight from disk.
- `stale-cache.js` and `publish.js` read the new stamp syntax.

**The cost of A, stated plainly.** Source stops being output, so the suite rests on one equality: the local
render equals what GitHub publishes. And a deploy can fail for the first time (a Liquid error stops the build),
which would also hold up an urgent takedown until it is fixed. Both are covered only if step 0 is in place: the
page-shape check runs on every pull request, and `shipped.js` gains a mode that compares GitHub's build
artifact with the local render after a push. Not verified: that a failed build leaves the previous deployment
live (inferred from the job order).

**When to move on to B.** If, after steps 1 and 2, generated pages still make up most of a typical diff or
still cause conflicts. B is the larger cut and the larger change; A does not block it.

**Proof for the conversion commit:** build the tree before and after with the pinned gem and `diff -r` the two
outputs; `shipped.js` in its render mode must list nothing.

### Step 2. One home per fact (tools and tool-written regions only; no published byte moves)

| | What | What it removes |
| --- | --- | --- |
| 2.1 | **The registry becomes data.** `tools/site/pages/<slug>.json` holds a page's row (`lang`, `type`, `og`, `pub`, `mod`, `alt`, `article`, `original`, `kind`, `status`, and an explicit `order`, because the dict order is the sitemap order today). `tools/site/langs.json` holds `LANGS`. Python and Node read them natively. | The hand-kept `PAGES` array, `REGISTRY_KEYS`, four regex readers and the self-test that edits Python source by string replacement. Two branches that add guides or move a `mod` date no longer share a line. The comments that sit beside rows today move into a `note` field or a decision record. |
| 2.2 | **Chrome and company facts leave the Python literals:** `tools/templates/header.html`, `footer.html`, `stub.html`; `tools/site/company.json`. | A phone number or nav label is edited as HTML or data, not as a Python string, and the footer's shortened company sentence stops being a second wording kept by hand. |
| 2.3 | **The shell becomes tool-written.** The three hand-copied regions (the head before the title, the asset block after `<!-- /seo -->`, the body preamble with the skip link and the SVG block) join the regions the generator owns, anchored on markup that exists today, with the variants as parameters (language; the home page's extra link and symbol). No new marker comment, so no byte moves. | 34 hand edits for a CSP host, a glass filter or the wordmark become one template edit. A page's hand-written part is then exactly its title, its description and its `<main>`. |
| 2.4 | **Lists are derived.** The guide lists on `blog.html`, `index.html` and `sv.html`, the page lines of `llms.txt` and the `ItemList` in `tools/seo/blog.json` are written from each guide's own heading, description and `pub` (checked: an entry is the guide's `h1` and its meta description, word for word). Where a copy differs today, an explicit `override` keeps the bytes and the difference goes to the owner as a content question. | A new guide falls from about 14 hand-edited files to the page, its registry file and its translations. A list can no longer drift. |
| 2.5 | **Dates.** The six byline messages become a pattern (`Published <1>{date}</1>`) filled per language from the month names the catalogues already hold (all 30 current translations are reproduced exactly). The lock rows of generated pages get an owner and a check. | The only translation re-key that has recurred in the history, and the hand fix in five catalogues after every re-date. |
| 2.6 | **Translation upkeep.** `i18n.py missing` prints the old English and the old translation beside a changed sentence; catalogues are split per page with one shared file (851 of 999 messages are on one page); the font cut gets a fixed timestamp so a re-cut that adds nothing changes nothing. | Retranslation starts from the previous sentence, not from nothing. Two branches adding guides stop colliding at the catalogue tail. A font diff means a real change. |
| 2.7 | **The generator in modules:** `tools/gen/` (registry, head, chrome, shell, lists, languages, sitemap, lock, llms, stub), with `seo-head.py` kept as the entry point: about 150 lines name it, among them comments in published files (`styles.css`, `index.html`, `contact.html`, `sv.html`), so a rename would move published bytes. Validation by explicit errors, no work at import time, unit tests beside the byte check. | Sixteen responsibilities in one 874-line file with no test of its own. Lowest urgency in this step: do it when 2.1 to 2.4 are being written anyway. |

Proof for every item: `python3 tools/seo-head.py --check` passes and `shipped.js --against origin/main` lists
nothing.

### Step 3. Checks that run themselves

| | What | What it removes |
| --- | --- | --- |
| 3.1 | `tools/check.js`, a runner: starts its own server, runs the static tier, then the browser checks in parallel as child processes, and prints every failure in one summary. The existing scripts are not rewritten. | The hand-started server, the serial chain, and one-failure-per-run. |
| 3.2 | One page universe: every check takes its pages from the registry and declares its scope (root, generated or all). The private sample lists go. | The 80 generated pages getting a reduced set by accident. Three checks say "every page" and visit 9 to 11. |
| 3.3 | A standing visual net: `screenshot.js` renders `origin/main` in a worktree in the same run and compares, over root and generated pages at two widths. No stored baseline. | The manual, untracked baseline that covers 34 of 114 pages. This is the proof step 5 needs. |
| 3.4 | `check.js --list` prints what each check proves, from the scripts' own headers. `tools/README.md` keeps only how to run them. | Four descriptions of the chain, which disagree today. |
| 3.5 | The browser tier joins the pull-request workflow and becomes required once it runs in about ten minutes. | The last "runs only when someone remembers". |

Not adopted: skipping checks by cached verdicts (cold in every new agent container, or a new committed file to
conflict on), and testing one page per "identical shell" class (there are 111 distinct footers and 48 headers).

### Step 4. Rules as addressed records

| | What | What it removes |
| --- | --- | --- |
| 4.1 | **A decision register.** `tools/decisions/<date>-<slug>.md`, one per owner decision: the date, the recorded words, the paths it governs, and one guard of a declared kind: a pattern that must never or always match, a count, a named existing check, or none with the reason. | Decisions scattered over 28 topic blocks. A new decision is a new file, not an edit to a 1,641-line document that half of all commits touch. |
| 4.2 | `tools/verify/decisions.js`, static and first in the chain. A failure quotes the decision. `--self-test` replays each pattern against the commit before the decision, so a pattern that matches nothing cannot pose as protection. The summary counts enforced, delegated and unenforced decisions apart, and an unenforced one never prints as passed. A decision that is on `main` is superseded by a new file, never edited. | Rules that bind only those who read them. Thirteen such patterns were tried on all 114 pages in 0.6 seconds; six of them protect decisions that have no check today. |
| 4.3 | `decisions.js --for <paths>` prints the decisions and topic notes for the files in hand. `AGENTS.md` becomes the index, keeping today's block names as headings because published bytes and tool messages cite them by name; the block bodies move word for word to `tools/docs/<topic>.md`. `CLAUDE.md` becomes an import of `AGENTS.md` plus the rules that have no path (never fill in a `[[CONFIRM]]` marker, one ambient motion, the branch rules). | About 24,000 words of required reading, and the paraphrased second copy. A rate-calculator change would read about 1,700. |
| 4.4 | Counts and lists are printed, not typed: `decisions.js --facts` gives the page counts, the chain and the storage keys, and a guard fails on a page-count literal in the docs. | Six different page counts in prose. |

The limit, stated in the register itself: roughly a third of the decisions have a check today, a third can take
a pattern, and a third cannot (brand voice, "never fill this in", "must not be loosened"). Those stay prose,
are always delivered by `--for`, and are never shown as enforced. The three documents that scripts parse
(`EDGE-SETUP.md`, `tools/PRE-FLIP-CHECKLIST.md`, the marker line in `_config.yml`) keep their paths and formats.

### Step 5. Invisible, but not byte-identical (each needs the owner's word)

Nothing a visitor or crawler perceives changes, but published bytes do, so the byte comparison cannot be the
proof. The proof is step 3.3 plus a comparison of computed styles.

- Remove the 18 unreachable font files and their `@font-face` rules (Aptos and Instrument Serif, 365 KB; the
  Aptos web licence is recorded as unconfirmed).
- Remove the 66 dead rules in `styles.css`.
- Correct the comment that is uniformly stale in all 114 pages ("the visit's drawn scheme").
- Assert the order of the `styles.css` blocks in a check, and make the docs name blocks instead of positions.
- Let `hero-fit.js --write` write the 26 measured constants it already prints.

Deliberately not planned: splitting `styles.css` or `app.js`. No incident in the history would have been
prevented by a split, a split is not atomic for a visitor holding cached HTML, and it touches every page and
every reader of those files.

## 4. What a change costs afterwards (projection)

| Routine change | Today | After steps 0, 2, 3, 4 | With step 1, option A |
| --- | --- | --- | --- |
| A CSS or JS tweak | 115 files | 115, collapsed in review, one command to sync | 2 files |
| Two branches open at once | conflicts in every page | one command | a one-line conflict only when both changed the same asset |
| One English sentence on a translated page | 14 to 89 files, about 9 steps | the page, its registry file, 5 generated pages, catalogues | the same |
| A nav, footer or CSP change | 114 files, 34 by hand for the shell | one template, 114 regenerated | the same (option B: 1 file) |
| A new guide | about 14 hand-edited files | the page, one registry file, the translations | the same |
| A rule or decision changes | 2 to 3 prose files | one decision file | the same |
| Reading before a safe edit | about 24,000 words | the index, one topic, the decisions for the paths | the same |
| Running the checks | by hand, serial, first failure only | automatic, parallel, every failure | the same |

## 5. Decisions for the owner

1. **Step 1:** option A, A2, B or C. This amends, or keeps, the recorded principle that the repository is
   exactly what ships.
2. **Step 0.3:** branch protection and the `CODEOWNERS` team.
3. **Step 2.4:** the copies that have drifted. Keep the bytes, or correct them: the description of
   `valja-konsultbolag.html` on `blog.html` is the one the guide dropped on 20 November; the `llms.txt` line
   for the home page lacks the Common questions block; the `sv.html` line still lists a block that is gone.
4. **Dates of generated pages.** Moving a language's `mod` re-dates all 80 pages, and a generated guide's
   structured data can carry a later date than its visible byline. Dating each generated page by its own
   content would end both, and would change which dates future edits publish.
5. **Step 5,** item by item.

## 6. Found on the way, outside this plan

- GitHub publishes a 246th file that the repository does not hold: `/assets/css/style.css`, the default
  theme's stylesheet, live on `vynatix.com`.
- 25 rows of `tools/urls.lock` for generated guides carry 23 November while the pages say 24 November. Rows
  that are on `main` are never edited, so this needs the owner's ruling.
- The hero fit is measured on two home pages and applied to seven; the five generated home pages already miss
  the fold. Fixing that is a visible change and is not part of this plan.
- Box 6.2 of the analytics checklist orders a command that exits with an error, and the checklist's page
  counts are stale. The gate cannot pass as written.
- `.well-known/security.txt` expires on 16 August 2027 and no check reads it.

## 7. Ideas weighed and set aside

| Idea | Why not |
| --- | --- |
| A stamp that ignores comment-only edits | 5 of 90 CSS and JS commits were comment-only. It trades an exact hash for a comment stripper that must never be wrong. |
| Header, footer and shell as Jekyll includes | 48 header and 111 footer variants: a second generator in a second template language. Only the CSP block is identical everywhere. |
| The languages in their own repositories or submodules | Six deploys are not atomic, which breaks the pairing the stamp protects. |
| Regenerate everything in a "land" step at merge | 48 of 61 merges went through GitHub's button, which would skip it and ship new CSS under old stamps. |
| Each page as its own registry row, read from its head | The head block is written by the tool from the registry, so the tool would read its own output. |
| Translations keyed by position, or carried over automatically | An inserted paragraph attaches every later translation to the wrong sentence; a removed claim stays live in five languages nobody has checked. |
| An alias ledger for typo fixes | Tested and it works, but no edit in the history would have qualified: all five near-duplicates were real changes of meaning. Its side products are in step 2.5 and 2.6. |
| Checks that write their own expected values | Right for measured numbers, wrong for the owner's terms: a check that rewrites what it guards cannot fail. |
| A watchdog that rolls production back | It would read the CDN's ten-minute lag as a fault and could republish a page that was taken down. |

## 8. How to run the refactoring

- One item per pull request, each with the `shipped.js` result in its description.
- The three commits that touch every page (the step 1 conversion, step 2.3, and any item of step 5) are made
  by a script that is committed with them. An open branch re-runs the script after syncing rather than
  merging 114 files by hand. Make them when as few branches as possible are open.
- Docs move in the same commit as the code they describe, as today.
- No step fills in a `[[CONFIRM]]` marker, a `checked` or `by` field, or anything else the owner supplies.
