# Refactoring plan: less overhead per change

Written 24 November 2026 and revised the same day after an adversarial review. Not published (`tools/` is
excluded in `_config.yml`). A plan, not a change: nothing here has been carried out, and nothing in it is an
owner decision until the owner makes it.

**The goal** is to cut the overhead of a routine change: the files it touches, the commands it needs, the merge
conflicts it causes, the prose that has to be read or updated first, and the time the checks take.

**What does not change:** the interface, the behaviour, the copy, the structured data, every URL and the domain.
The acceptance test for every step is a byte comparison of the published files (section 3, step 0.1). Steps
that would move a published byte without moving anything a visitor or crawler can perceive are collected in
step 5 and each needs the owner's word.

How this was produced: ten readers mapped the subsystems from the code and the git history, and a second agent
tried to refute each finding (100 hazards: 75 confirmed as stated, 25 corrected in part, none refuted). Forty
redesign ideas were then generated in five isolated branches, scored by three judges and clustered; fourteen
were marked as traps by at least two judges and three more by one. Five reviewers then attacked the draft of
this plan from five sides (the constraints, the overhead arithmetic, feasibility, migration and rollback,
completeness) and raised 60 findings. The 35 rated major or blocker were each tested again by a second agent:
26 held as stated, 9 in part, none was dismissed, and all 35 are worked into this text. The 25 minor ones were
not tested again; those adopted here were first checked against the repository or are marked "not re-tested".
Numbers are measured unless marked as a projection.

## 1. What a change costs today

Measured over the 136 commits of the visible history (a shallow clone; 128 of them since 13 October 2026).

| Routine change | What it costs today |
| --- | --- |
| A CSS or JS tweak | 115 files: the file and a `?v=` stamp in 114 pages. 64% of all page-file touches in the history change nothing but a stamp. |
| Two branches open at once | 11 of 12 branch-sync merges conflicted, in 334 files. 294 of them (88%) are pages that conflict only in a `?v=` line. The other 40 sit in 7 of the 11 merges: adjacent registry rows in `tools/seo-head.py` (4 merges, the only conflict in 2 of them), the docs (3), `styles.css` (2), the tail of all five catalogues (1), and page content, `app.js`, `sitemap.xml` and check scripts. 4 merges conflicted in stamps alone. Reverting an older merge conflicts in 114 files. |
| One English sentence on a translated page | About 9 manual steps and 14 to 89 files; 89 when the language's `mod` date moves, because that re-dates all 80 generated pages. |
| A nav, footer or CSP change | 114 files. The CSP meta, the asset links, the skip link and the 8.5 KB SVG block (11.2 KB per page) are pasted by hand into 34 pages. |
| A new guide | Hand edits in about 14 files; the title and description are retyped in four places and one copy has already drifted on a live page. |
| A rule or decision changes | Prose in `AGENTS.md`, again in `CLAUDE.md`, often in `tools/README.md`. `AGENTS.md` changed in 49% of commits and grew from 275 to 1,641 lines. |
| Reading before a safe edit | About 24,000 words with no task index. 3,600 of them (`CLAUDE.md`) are loaded into every session; the rest is read by choice. |
| Running the checks | By hand only. 22 steps in series, about 1,500 page loads, a hand-started server, and only the first failure reported. Measured twice on a 4-core container, all passing: about 15 minutes (12 to 14 seconds for the static tier, 865 to 884 for the browser checks). The two guards of the one hero, `bg-sheet.js` and `bg-fit.js`, are 47% of it. |

Since the generated languages landed (20 November) the median commit went from about 12 files to about 85 (21
over the whole history). 56% of all diff lines in the history are tool-written output (83% since 20 November;
the catalogues, which are hand-written translations, are another 11%).

## 2. Why: five causes, in order of measured cost

1. **Derived values are committed into every page.** The stamp is a function of five files, written into 114
   pages (457 references). It is the largest single source of touched files and of conflicted files (88%), but
   not of conflicting merges: 7 of the 11 also conflicted somewhere else, 3 of them with no stamp conflict at
   all (causes 3 and 4).
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
"the last" in the docs; one is); four check files read constants out of `app.js` by exact source shape; 18 font
files are unreachable; the Japanese and Arabic font cuts are not byte-reproducible.

**What works and stays:** permanent URLs with the append-only lock and its self-test; the byte-exact generator
check (`seo-head.py --check`, 2 seconds over 114 pages); static checks first; checks that prove they can fail;
a check's own expected value (the stub strings in `permanence.js`, the model in `calc.js`, the tables in
`csp.js`), which is an independent oracle and not a copy to remove; parsers that fail closed; the strict CSP;
progressive enhancement; honest status statements; decisions that are already data (`waived` in `LANGS`,
`urls.retired`).

## 3. The target, and the steps to it

Five principles. Each step below serves one of them.

- **P1. A work branch carries what a person or agent wrote.** Derived values are written as late as possible.
- **P2. One home per fact.** Every other copy is written by a tool or, where it is prose inside a page's
  `<main>`, held equal by a check. The copies this plan leaves hand-kept are listed under step 2.
- **P3. Checks run by themselves,** report every failure, and treat all 114 pages alike.
- **P4. Rules are addressed records.** A decision is one file with the paths it governs and, where one
  exists, a guard. A rule that no check can hold stays in the text every session loads.
- **P5. Every step is proven** by the byte comparison before it merges.

Target layout (new or changed parts only):

```
*.html                        a person writes <title>, the description and <main>; a tool writes the rest
_data/stamps/<name>.json      the five stamps (step 1, option A)
.github/workflows/check.yml   the checks on every pull request and on every push to main
.gitattributes                generated files collapsed in review
AGENTS.md                     a router: the index and the always-on rules, their one home
CLAUDE.md                     one line: @AGENTS.md
.claude/rules/decisions/      one file per owner decision, loaded by path (a dot folder, so not published)
tools/site/pages/<slug>.json  one registry row per page
tools/site/langs.json, company.json, lists.json
tools/templates/              header, footer, shell and stub as HTML files
tools/gen/                    the generator in modules (optional; seo-head.py stays the entry point)
tools/docs/                   topic notes: today's AGENTS.md blocks
tools/check.js, tools/sync    the runner and the sync command
tools/verify/                 shipped.js, decisions.js
```

Suggested order: step 0; then the word-for-word move of 4.3, which needs no new tool and which every later
item would otherwise have to edit around (`AGENTS.md` changes in half of all commits); then step 1, once the
owner has decided and has set 0.3; then 2.1, the next cure for conflicts; then the rest of 2 with 3 and 4.
The steps are not independent: 2.3 waits for the decision on step 1, because the asset block it hands to the
generator holds the stamps; 3.2 follows 2.1, because it reads the registry that 2.1 turns into data; the
lock-row check of 2.5 waits for the owner's ruling (section 5, item 6); step 5 follows 3.3, its proof. Step 1
is the largest cut in files per change and needs all of step 0, the owner setting in 0.3 included: before the
conversion merges, GitHub must report `main` as protected (it reports `protected: false` today).

### Step 0. The safety net (no published byte moves)

| | What | Why |
| --- | --- | --- |
| 0.1 | `tools/verify/shipped.js`: derive the published set from the tree and `_config.yml` (245 files today) and list the files that differ from another revision. It fails only when the pull request declares itself byte-neutral (one fixed line in its description, which the workflow reads) and the list is not empty. In the workflow it compares the merge commit with its first parent. Run by hand it fetches `origin/main`, compares with the merge base and prints the commit it compared with. `_config.yml` and, from step 1, `_data/` are compared too, because they decide published bytes. It fails outright on a `.nojekyll` and on any published file that begins with `---`, other than a page with exactly the front matter of step 1. | The acceptance test of this whole plan. Git blob ids make it exact and instant on one condition: Jekyll copies every published file through unchanged. That holds today (no published file begins with `---` or holds `{{` or `{%`). From step 1, option A, a page blob is source, so equal blobs prove equal output only while the stamp files and `_config.yml` are equal too. The declaration is a line in the description because a branch name is not free here: agent sessions are given theirs. |
| 0.2 | `.github/workflows/check.yml`, on every pull request (opened, synchronised, reopened and edited, so the declaration cannot be added after a green run) and again on every push to `main`. Job one is the static tier: CSP, what ships, permanence and its self-test, mailto, release-gate self-test, stamp check, `seo-head.py --check`, `i18n.js --static`, `shipped.js`. Job two builds the same commit into a directory with `actions/jekyll-build-pages` (the action and image of the Pages run itself; it builds without deploying) and `shipped.js` compares that output with the local render: informative in step 0, required from step 1. On a push to `main` the workflow also compares GitHub's own Pages artifact once that run has finished. Read-only permissions, actions pinned by commit, the runner image and Python 3.12 pinned, full fetch. | The static tier needs only Node built-ins and Python: 12 to 21 seconds, no install, no browser. Today nothing runs. Job two is the proof on GitHub's own carrier before a merge, which is live with no preview. The run on `main` is there because GitHub does not repeat a pull request's run when `main` moves and starts none on a pull request that conflicts: a `main` that two green pull requests broke together is then reported within a minute. Not verified: that an agent session may push a file under `.github/workflows/` (GitHub asks a separate permission for it). If it may not, the owner commits the workflow file. |
| 0.3 | Owner settings, which cannot be committed. This plan needs one: branch protection on `main` with the static job of 0.2 as a required status check. From the step 1 conversion onwards, also "Require branches to be up to date before merging" (or a merge queue, and then the workflow also runs on `merge_group`). A review rule and a real team in `CODEOWNERS` are a separate decision. | Without the required check the workflow informs but does not stop a merge. Without the up-to-date rule two green pull requests can merge into a `main` that fails. Tested: one branch adds a page, another edits `styles.css` and restamps, both pass `stamp.js --check`, they merge without a conflict and `main` has a stale stamp. Not before step 1: until then that rule forces a 114-file sync on every merge. `AGENTS.md` and the `CODEOWNERS` header list a stricter rule as open: a pull request, a Code Owner review and no bypass. One account has opened all 69 pull requests and merged 68, none with a review, and GitHub does not let an author approve their own pull request, so that rule would stop every merge, a takedown included, until a second reviewer exists. The administrator bypass stays allowed, and `tools/TAKEDOWN.md` names it as the way to merge a takedown without waiting. |
| 0.4 | Pin the tools. Commit `tools/package-lock.json` (it is ignored today: remove its line from `tools/.gitignore`). Add `engines`. State Python 3.12, or remove the one construct that needs it (`seo-head.py` stops with a syntax error on 3.11). Pin `fonttools` and `brotli`. Record the carrier as one line, `gem install github-pages -v 232`, not a Gemfile: a root Gemfile would be flagged by `publish.js`, and bundler does not work through the agent proxy while `gem install` does. The workflow compares that number with `pages.github.com/versions.json`. | A fresh container or a runner must give the same verdicts, and a new carrier version must show as a failed check, not as a surprise. |
| 0.5 | `.gitattributes`: mark `es/**`, `fr/**`, `de/**`, `ja/**`, `ar/**`, `sitemap.xml` and `tools/i18n/messages.json` as `linguist-generated`. A pattern with a trailing slash does nothing in this file. | GitHub then collapses them in review. It removes noise there and nowhere else: `git diff` still shows them, a CSS edit still shows its 34 root-page stamp diffs, and no conflict goes away. The catalogues are not in the list and stay expanded: they are where a translation is written. |
| 0.6 | `tools/sync`: one command for a stamp conflict. It fetches `origin/main` first. Files a tool writes whole (the five language folders, `sitemap.xml`, `tools/i18n/messages.json`) are taken from either side, because the generator rewrites them. A root page is never taken whole, because part of it is written by hand: its three merge stages are merged again with every `?v=` value replaced by one constant (`git merge-file`), and the command stops and names the page if a conflict remains. `tools/urls.lock` and `tools/urls.retired` keep every row of `main`, and the generator appends the branch's own. `llms.txt` and `_config.yml` are part hand-written and are never taken whole. Then it runs `seo-head.py`, `stamp.js`, both `--check`s and `permanence.js`, and lists whatever still conflicts for a person. `--self-test` builds the two-branch case (one branch changes a sentence and a stylesheet, the other only the stylesheet) and fails if the sentence is gone. | A bridge until step 1, and the standing tool under option C. Today each agent resolves 114 files its own way. Replayed on the 12 sync merges, the stamp-masked merge settles 294 of the 298 conflicted pages and leaves the real conflicts: 4 pages and 36 other files. Taking one side of a root page is not safe: in 84 of the 188 conflicted root pages one side had changed the hand-written part, in 6 both had, and both `--check`s pass on a tree that has lost one branch's sentence (found by all five reviewers independently and reproduced each time). Lock rows that are dropped come back with the registry's date (25 rows, 24 November where `main` has 23 November), again with both `--check`s green. |
| 0.7 | Close the fail-open holes found. `permanence.js` skips its comparison silently when `origin/main` is absent, and passes against a stale one without saying so: it will print the commit it compared with, and the workflow and `tools/sync` fetch first. `stamp.js` stamps 34 pages and exits 0 when `messages.json` is unreadable. No check compares `url()` targets in the stylesheets with the files on disk. `publish.js` passes with a `.nojekyll` at the root, which would publish every tracked file, and with front matter at the top of a published text file, which Jekyll strips (both tested). `redate.py` treats an unreadable base registry as an empty one (read in the code; one reviewer's test, not repeated). | Each is a green result that proves nothing. |
| 0.8 | Static checks for copies that are meant to be exact and that nothing compares today, moving no byte: the six Common questions of `index.html` against `contact.html`; the 16 deliverable items of `index.html` against `services.html`; the four percentages printed in the calculator of `membership.html` against the constants in `app.js`; and the guide lists (step 2.4, part a). | A reworded answer, deliverable or rate that ships in one place only. All three pairs are equal today. |

### Step 1. Stamps out of the pages (the owner decides how)

The stamp guarantee stays: every page names the exact stylesheet and script it was written for. What changes is
where the value is written. All four options were weighed; three were tested.

| Option | A CSS edit touches | Stamp conflicts | New machinery | Recorded principle |
| --- | --- | --- | --- | --- |
| **A. GitHub's Jekyll prints the stamp** (recommended) | 2 files | One line in one file, whenever two branches change the same asset. Both sides had changed `styles.css` in all 8 replayed stamp merges, so the same merges conflict as today; `stamp.js` rewrites the line | A local render (`tools/serve.js` and one rendering reader for the checks), a page-shape check in `stamp.js`, changes in `publish.js` and `stale-cache.js`, two modes of `shipped.js`, a recorded gem version, a conversion script and its inverse | Amended: nothing of ours runs at deploy; the Jekyll that already builds every push substitutes five values. A recorded control is retired with it (below) |
| A2. As A, but the stamp is the build revision | 1 file | None | As A, and `stamp.js` loses its hashing | Not offered. The 457 stamp values change on every deploy, so the byte comparison of P5 can never list nothing and no later step can be proven by it; returning visitors also fetch the shared files again after every deploy |
| B. `main` holds source, a `live` branch holds the shipped bytes, written by an Action on merge | 1 file | None | An Action with write access, Pages repointed to `live`, a build-to-directory mode, checks on the build | Restated: what is on `live` is exactly what ships, and `live` becomes the golden master for the generator's byte check. Also takes the 80 generated pages, the sitemap and the tool-written regions out of every work branch |
| C. Stay as today | 115 files | As today; the stamp part is resolved by `tools/sync` | None beyond step 0 | Unchanged |

**Why A.** It was verified with GitHub's own versions run locally: with two lines of front matter on the 114
pages and the 457 references written as `styles.css?v={{ site.data.stamps.styles }}`, a build with
github-pages 232 (Jekyll 3.10.0) is byte-identical, over all 246 files, to the artifact GitHub built from the
same commit before the conversion, and `seo-head.py --check` passes unchanged on the converted tree. It needs
no new service. Its mechanism needs no owner setting, but its safety does: only the page-shape check stops the
mistakes listed under the cost below, and it stops a merge only under step 0.3.

**What A does not buy** is fewer conflicting merges. Replayed on the 12 sync merges, A and option C with the
`tools/sync` of step 0.6 leave the same 11 conflicting, and the stamp part of each costs one command either
way. On conflicts A's gain is that the stamp part needs no merge tool and cannot drop a hand edit. Its main
gain is files per change: without the stamp-only page touches the median commit since 20 November falls from
85.5 files to 17.5, and over the whole history from 21 to 7 (a replay of the history, so a projection).

What A consists of:

- Front matter (`---`, `---`) on every page; the generated pages inherit it from their English source.
- `_data/stamps/styles.json` and four siblings, each holding one quoted hash. One file per asset, because
  adjacent lines in one file conflict even when two branches changed different assets (tested). Quoted,
  because an unquoted stamp of digits with a leading zero prints as another number (tested).
- `_config.yml` gains `liquid: strict_variables: true` and `error_mode: strict`, so a mistyped key fails the
  build instead of publishing an empty `?v=`.
- `stamp.js` writes five small files. Its `--check` also holds the shape of everything Jekyll reads: every
  page begins with exactly the eight bytes of that front matter (no byte order mark, no space before it) and
  has exactly the expected tags and no other `{{` or `{%`; no other published file begins with `---`; no
  Markdown file sits in a published folder and there is no `_posts`, `_drafts`, `_layouts` or `_includes`
  folder (`publish.js` skips folders that begin with `_` today); each stamp file is, byte for byte, one
  quoted hash and a newline.
- `tools/serve.js` and one rendering reader in `_common.js` apply the same substitution, so preview and the
  browser checks see the shipped bytes. The static checks that read pages through readers of their own
  (`publish.js`, `permanence.js`, `i18n.js`, `release-gate.js`) are moved onto that reader; until then they
  inspect source. `_common.js` fetches `index.html` once and stops with "start `node tools/serve.js`" unless
  the answer begins with `<!doctype html>`, because the old server command still runs and would serve source:
  a raw page no longer opens correctly from disk or from `python3 -m http.server`. That command is written in
  five places, which change in the conversion commit.
- `stale-cache.js` and `publish.js` read the new stamp syntax.
- The records that say the opposite change in the same commit: the header of `_config.yml` ("no page carries
  YAML front matter"), `AGENTS.md` ("what is in the repo ships"), `SECURITY-ASSESSMENT.md` (round 3, "no
  templating risk", which gets a superseding note) and `EDGE-SETUP.md`, whose proof
  `curl -s https://vynatix.com/ | diff - index.html` would then always differ and becomes a comparison with
  the local render.
- `tools/TAKEDOWN.md` changes in the same commit: the server command becomes `tools/serve.js`; before
  starting, the `build` and `deploy` check runs on the head of `main` are green; if `build` is red, its log
  names the file and line and that is fixed first, because nothing publishes until the build passes.
- The conversion script and its inverse, committed with the conversion and kept until no branch from before
  it is open. The script is idempotent (section 8).

**The cost of A, stated plainly.** Source stops being output, so the suite rests on one equality: the local
render equals what GitHub publishes. A deploy can fail for the first time (a Liquid error stops the build),
which would also hold up an urgent takedown until it is fixed. And strict mode leaves four mistakes silent,
all tested on github-pages 232. A byte order mark or a space before the front matter: the build passes and the
page ships raw, beginning with `---` and with `?v={{ site.data.stamps.styles }}` in its links. A doubled front
matter: the build passes and publishes the dashes ahead of the doctype. Tags without front matter: the build
passes and publishes the literal tag, a stamp that never changes again. `{% include_relative CODEOWNERS %}` in
a page: the build passes and the text of an excluded file is in the published page. Strict mode also adds a
way to stop every deploy: a Markdown file that reaches Jekyll (`_posts/x.md`) fails the build in the default
theme's layout. So the
rule that excluded files are never published, and the pages' standards mode, rest from then on on the
page-shape check and no longer on `_config.yml` alone. That is the recorded control this option retires
(`SECURITY-ASSESSMENT.md`, round 3: no page carries front matter, so Jekyll templates nothing).

**To be tested before the conversion merges:** that a failed build leaves the previous deployment live. It is
inferred from the job order; GitHub's documentation does not say, and none of the 166 workflow runs in this
repository has failed. The test: on a throwaway Pages repository with the same `_config.yml`, push a page with
an undefined Liquid variable and record whether the last deployment keeps serving and what the `build` check
run reports. Only the owner can create that repository (section 5, item 8).

**Proof for the conversion.** Build the tree before and after with the gem version recorded in step 0.4 and
`diff -r` the two outputs; `shipped.js` in its render mode must list nothing; and job two of the workflow
proves the same on GitHub's own action before the merge.

**Two pull requests, not one.** First the tools (`stamp.js`, `serve.js`, the rendering reader, `publish.js`,
`stale-cache.js`) learn to read both page shapes, with no page changed and `shipped.js` listing nothing. Then
the pages, the data files and the two `_config.yml` lines alone. `main` then always holds tools that
understand the tree, which open branches, the rollback and the `origin/main` worktree of step 3.3 each need.
A later pull request removes the old shape from the tools.

**Rollback.** The inverse script writes the local render over the 114 sources and removes `_data/stamps` and
the two `liquid:` lines. It moves no published byte, so the same comparison proves it (tested: the build
before and after is identical over 246 files). Never `git revert` the conversion and never use GitHub's Revert
button: after one later CSS edit the revert conflicts on the stamp file and leaves all 114 pages naming a
stamp that is no longer the file's hash (tested: 114 stamp problems).

**When to move on to B.** If, after steps 1 and 2, generated pages still make up most of a typical diff or
still cause conflicts. B is the larger cut and the larger change; A does not block it.

### Step 2. One home per fact (tools and tool-written regions only; no published byte moves)

| | What | What it removes |
| --- | --- | --- |
| 2.1 | **The registry becomes data.** `tools/site/pages/<slug>.json` holds a page's row (`lang`, `type`, `og`, `pub`, `mod`, `alt`, `article`, `original`, `kind`, `status`). The 34 existing pages carry an explicit `order`, because the dict order is the sitemap order today; a new page needs none and sorts after them by `pub`, then slug, so two branches that add a guide cannot tie unseen. `tools/site/langs.json` holds `LANGS`. Python and Node read them natively, and `seo-head.py` still exposes `PAGES` and `LANGS`, loaded from the JSON, so the published comments that say a date or a language is "in `tools/seo-head.py`" stay true. `redate.py` writes the page's own file, reads the base revision's, handles the one transition where the base still has the Python table, and exits non-zero when it can read neither. The flip-day step of `tools/PRE-FLIP-CHECKLIST.md` that tells a person to set `mod` in `tools/seo-head.py` is reworded in the same commit. To weigh if option A is chosen: holding the row in the page's own front matter (tested byte-neutral under Jekyll) instead of 34 new files. Open then: what the generated pages inherit and where the sitemap order lives. | The hand-kept `PAGES` array, `REGISTRY_KEYS` and the four regex readers (two in `_common.js`, one in `release-gate.js`, one in `redate.py`). The two self-tests that edit Python source by string replacement (`permanence.js`, `release-gate.js`) stay and edit a JSON row instead. Two branches that add guides or move a `mod` date no longer share a line: adjacent registry rows conflicted in 4 of the 11 conflicting merges and were the only conflict in 2. |
| 2.2 | **Chrome and company facts leave the Python literals:** `tools/templates/header.html`, `footer.html`, `stub.html`; `tools/site/company.json`. The company sentence and the footer's shorter wording sit side by side there, with a check that the English footer is the company sentence without its first two words and its last sentence; the translated footers stay messages of their own. `permanence.js`, which looks for the stub strings in the text of `seo-head.py`, reads the template instead. | A phone number or nav label is edited as HTML or data, not as a Python string, and the footer's wording can no longer drift from the company sentence unseen. |
| 2.3 | **The shell becomes tool-written.** The three hand-copied regions (the head before the title, the asset block after `<!-- /seo -->`, the body preamble with the skip link and the SVG block) join the regions the generator owns, anchored on markup that exists today, with the variants as parameters (language; the home page's extra link and symbol). Every proposed anchor matches exactly once in all 34 root pages, with 2, 2 and 3 variants. No new marker comment, and its first run must rewrite no file. After step 1: under option A the template holds the Liquid tags; under option C the generator takes the five hashes as a parameter and `stamp.js` stops writing pages. A scaffold command writes the shell of a new page. | 34 hand edits for a CSP host, a glass filter or the wordmark become one template edit. A page's hand-written part is then exactly its title, its description and its `<main>` (less the list regions of 2.4, part c, if the owner allows them), and a new page no longer starts as a copy of another. |
| 2.4 | **List entries are checked, then derived; what a list holds, and in what order, is data.** (a) First, moving no byte: a static check that every guide entry on `blog.html`, `index.html` and `sv.html`, every guide line of `llms.txt` and every `ItemList` entry in `tools/seo/blog.json` repeats the linked page's `<title>` without the brand suffix (the rule the comment in `index.html` records; for all 14 guides it equals the `h1`), its meta description and, where a date shows, its `pub`, with today's differences in a named exception list. Measured: 100 of 104 fields in the three HTML lists and the `ItemList` match, and 10 of the 14 guide lines of `llms.txt`. This part lands with step 0.8. (b) Membership and order cannot be derived: no list is in registry or `pub` order, the `ItemList` is ordered differently from the visible list on `blog.html`, and the English home list holds eight entries, one of them a page that is not a guide and one a Swedish guide described in English on purpose. So `tools/site/lists.json` holds one ordered list of slugs per list, and that Swedish guide carries an explicit English summary. The generator then writes the guide lines of `llms.txt` and the `ItemList`, with an `override` wherever a copy differs today, so no byte moves. The other 14 page lines of `llms.txt` are hand-written summaries and stay so. (c) The three hub lists inside `<main>` are generated only on the owner's word (section 5, item 3): the generator would write inside `<main>` for the first time, which amends the rule in its own header, in regions anchored on markup that exists today (`ul.reads` on the two home pages, the lists of the `#english` and `#swedish` sections of `blog.html`). | With (a), a list can no longer drift unseen. With (b), `llms.txt` and `blog.json` leave a new guide's hand edits. With (c), so do the hub lists, and a new guide falls from about 14 hand-edited files to about 10: the page, its registry file, five catalogues, its slug in the lists file, and the `mod` of each hub whose list changed. What goes is every retyped title, description and list entry. |
| 2.5 | **Dates.** The byline messages become a pattern (`Published <1>{date}</1>`) filled per language from the month names the catalogues already hold. All 30 current translations are reproduced exactly; there are three English frames (plain, "In Swedish", and one with two dates). The lock rows of generated pages get an owner and a check, once the owner has ruled on the 25 rows that already differ (section 5, item 6). This item does not end the 89-file case. | The only translation re-key that has recurred in the history, and the hand fix in five catalogues after every re-date. |
| 2.5b | **Only if the owner takes decision 4:** a generated page takes its `mod` from its own content (its English page and its own translations), not from the language's one date. Where the date of a page's translations is kept is part of the decision. Today's dates stay as a floor, so no published byte moves on the day of the switch. The rule in `AGENTS.md` that moves the language's `mod` after every retranslation goes with it. | The 80-page re-date on the first catalogue edit of a day, the step of moving five language dates by hand, and structured dates that run ahead of the visible byline. |
| 2.6 | **Translation upkeep.** `i18n.py missing` prints the old English and the old translation beside a changed sentence. The catalogues are written in a stable key order, not appended at the tail (a design judgement, not tested). The font cut records one timestamp per face, the one its committed file carries, so a cut that adds no glyph reproduces the committed file and a regenerate-and-compare check for the fonts becomes possible (one reviewer reproduced all four files byte for byte; not re-tested). | Retranslation starts from the previous sentence, not from nothing. Two branches that add guides stop colliding at the catalogue tail (1 of the 11 conflicting merges). A font diff means a real change. |
| 2.7 | **Optional: the generator in modules,** `tools/gen/` (registry, head, chrome, shell, lists, languages, sitemap, lock, llms, stub), with `seo-head.py` kept as the entry point: about 150 lines name it, among them comments in published files (`styles.css`, `index.html`, `contact.html`, `sv.html`) and a marker line in `llms.txt`, so a rename would move published bytes. Validation by explicit errors, no work at import time, unit tests beside the byte check. | Sixteen responsibilities in one 874-line file with no test of its own. It saves nothing in files, commands or conflicts, so do it only when generator logic is being changed anyway, and merge it when no open branch changes `tools/seo-head.py`: it moves code, which no script can replay. |
| 2.8 | **One reader for the constants of `app.js`.** `_common.js` exports one function that reads a named constant, and the four check files that match `var NAME = ...` with patterns of their own (about 15 places) use it. | A reformat of `app.js` breaking four checks in four ways, and the one reader that returns a wrong number instead of failing (`consent.js`, when a lifetime is written as a product). |

Proof for every item: `python3 tools/seo-head.py --check` passes and the workflow's `shipped.js` lists nothing.

Left hand-kept by this plan, on purpose: the calculator's terms in `app.js`, `tools/verify/calc.js` and the
page's labels (the second copy of the arithmetic is deliberate, section 7; step 0.8 checks the labels); the
Swedish twins, which mirror their English pages by hand with no parity check; the 73 of 88 strings in
`tools/seo/*.json` that repeat their page; the company sentence in the pages' own text. No exact rule fits the
last three, so they stay prose rules.

### Step 3. Checks that run themselves

Budget: the browser tier ends within ten minutes on a 4-core runner, which is what GitHub gives a public
repository. Measured: 865 seconds of browser work in series and about 440 with four checks at a time. Running
in parallel gains less than two times, not four, because the checks already fill the cores. Order: 3.1, then
3.5, then 3.2 inside the budget; 3.3 stays outside the required tier.

| | What | What it removes |
| --- | --- | --- |
| 3.1 | `tools/check.js`, a runner: starts its own server, runs the static tier, then the browser checks in parallel as child processes, and prints every failure and each check's time in one summary. The existing scripts are not rewritten, and the npm script names and the paths under `tools/verify/` do not change, because published comments cite them. | The hand-started server, the serial chain, and one-failure-per-run. About 7.5 minutes against 15 for today's scope. |
| 3.2 | One page universe: every check takes its pages from the registry and from the generator's own list of generated pages, and declares its scope (root, generated or all). The private sample lists go. The scope is chosen inside the budget: `links.js`, `requests.js` and `a11y.js` on all 114 pages instead of 34 add about five minutes in series. | The 80 generated pages getting a reduced set by accident. Three checks say "every page" and visit 9 to 11. |
| 3.3 | A visual net on demand, run for step 5 and for refactoring pull requests: `screenshot.js` renders `origin/main` in a worktree in the same run and compares, over root and generated pages at two widths, with the consent bar armed as its captures are today. No stored baseline. Not in the required tier: 456 shots a theme at today's 1.5 seconds a shot are 11 minutes in series, 23 with both themes. | The manual, untracked baseline that covers 34 of 114 pages. This is the proof step 5 needs. |
| 3.4 | `check.js --list` prints what each check proves, from the scripts' own headers. It is the one printer of the chain; `tools/README.md` keeps only how to run it. | Four descriptions of the chain, which disagree today. |
| 3.5 | The browser tier joins the workflow and becomes required once it runs inside the budget on GitHub's runner. A takedown never waits for it: the bypass of step 0.3 stays, or this tier reports without being required. | The last "runs only when someone remembers". |
| 3.6 | The hero guards are the long pole: `bg-sheet.js` and `bg-fit.js` are 415 seconds, 47% of the run, for one page's hero. The runner starts the four `bg-sheet.js` sweeps of `bg-fit.js` as separate jobs, which shortens the longest job but not the work. Optional: skip both guards when no input of the hero changed against `origin/main` (the stylesheets, the fonts, the sheet's art, `index.html`). That is derived from the diff, not a cache, and applies to about 38% of past commits, so it is a saving and not the fix. | Most of the wait on a change that cannot move the hero. |
| 3.7 | `hero-fit.js --write` writes the 26 measured constants it already prints. When it is introduced it must reproduce the committed constants exactly on the pinned browser. Afterwards it writes only when the check fails, which is a copy or layout change outside this plan. | Refitting 26 numbers by hand after a hero change. The committed numbers only have to lie within 2px of a measurement today, so an unpinned run could write different ones: hence the first rule. |

Not adopted: skipping checks by cached verdicts (cold in every new agent container, or a new committed file to
conflict on), and testing one page per "identical shell" class (there are 111 distinct footers and 48 headers).

### Step 4. Rules as addressed records

| | What | What it removes |
| --- | --- | --- |
| 4.0 | **The classification table first,** before any format is built. List every dated decision in `AGENTS.md` and `CLAUDE.md` with its class (held by a named check, can take a pattern, or neither) and its proposed pattern, each pattern tried on a sample it must match. Go ahead with 4.1, 4.2 and 4.5 only if at least half the decisions fall in the first two classes. Otherwise step 4 is 4.3 and 4.4 alone, and the six never-patterns for decisions without a check go into `publish.js`, which already holds such patterns for the retired draws. | Building a register for decisions it cannot enforce. One pass found about 38 dated decisions, roughly a third in each class; that is an estimate, not an audit. |
| 4.1 | **A decision register.** One file per owner decision, named by slug: `decided` (a date only where the record states one, otherwise `unrecorded`), `first recorded` (the commit that first wrote the sentence and its date, or `before the visible history`, because the clone is shallow), the words (the owner's own only where the record quotes them, otherwise the recorded sentence, marked as the record's), the paths it governs, one guard of a declared kind (a pattern that must never or always match, a count, a named existing check, or none with the reason) and, for a pattern, the sample it must match. The file is the decision's one home: in the commit that creates it, the dated sentence leaves the topic text, which keeps a line naming the file. A file that supersedes another takes a new slug and names the one it replaces. The format is a flat header that `decisions.js` documents and tests, and a header that does not parse fails the check. | Decisions scattered over 28 topic blocks. A new decision is a new file, not an edit to a 1,641-line document that half of all commits touch. About half of the sentences that name an owner decision carry no date (the hero fit, the still client list, no named person), so `decided` is often `unrecorded` and stays so until the owner says otherwise. |
| 4.2 | `tools/verify/decisions.js`, static and first in the chain. A failure quotes the decision. `--self-test` runs each pattern on the sample kept in its file (the lines the decision removed, copied once from the history), so a pattern that matches nothing cannot pose as protection and the proof needs no history: agent containers are depth-50 clones, and the commit before a decision of 20 November is 15 deep four days later. The summary counts enforced, delegated and unenforced decisions apart, and an unenforced one never prints as passed. On `main` the date, the words and the sample of a decision are never edited, only superseded. A guard that misfires may be repaired on a branch: the repaired pattern must still match the sample, and `decisions.js` prints the old and the new pattern as changed against `main`, so the repair shows in review and no superseding decision is written in the owner's name. | Rules that bind only those who read them. Thirteen such patterns were tried on all 114 pages in 0.6 seconds; six of them protect decisions that have no check today. |
| 4.3 | **The docs split.** `AGENTS.md` becomes the router: an index whose headings are today's block names (published bytes and tool messages cite "AGENTS.md, Hero background" and "Languages" by name, and none of those names is a heading today), the branch rules, and the always-on list. The block bodies move to `tools/docs/<topic>.md` word for word, except the dated sentences that 4.1 moves into decision files. `CLAUDE.md` becomes the one line `@AGENTS.md`: Claude Code reads only `CLAUDE.md` when both files exist, and the import loads the router into every session. The always-on list has one home, the head of `AGENTS.md`: the rules that have no path (never fill in a `[[CONFIRM]]` marker or what the plan leaves to the owner, one ambient motion and its limits, the branch rules) and every rule that has no guard (`checked` and `by`, no hint for the hidden slider, no sentence about terms around the calculator). With the register, `decisions.js` writes that list from the decision files and fails when it differs; without it, the list is kept by hand in that one place. A rule leaves the list only when a guard takes it over. `decisions.js --for <paths>` prints the decisions for the files in hand and, for every path except `styles.css` and `app.js`, the topic notes; for those two it prints the index before an edit and, once there is a diff, the topics of the named blocks the changed lines sit in. | The paraphrased second copy, and reading without an index. The saving comes from the split and the index, not from path matching: the topic blocks that name `styles.css` or `app.js` hold about 60% of the words of `AGENTS.md`, and one of those files changes in 54% of commits. An agent that picks the Rate calculator topic by name reads on the order of 1,700 words (a projection, never run); a path match on the calculator's files would return more than 12,000. |
| 4.4 | Counts and lists are printed, not typed: `decisions.js --facts` gives the page counts and the storage keys, and a guard fails on a page-count literal in the docs. A check asserts the names and order of the `styles.css` blocks (moving no byte), and the docs name blocks, never positions. | Six different page counts in prose, and five blocks each called "the last". |
| 4.5 | **Delivery without a command.** The decision files live in `.claude/rules/decisions/` with a `paths:` header, so Claude Code loads a decision by itself when it reads or edits a matching file, and `decisions.js` reads the same files for every other agent. The other fields go in the body, because Claude Code drops the header before loading. The topic notes stay in `tools/docs/` and are opened from the index: they are too long to load by path. If the owner does not want a `.claude/` folder, the files live in `tools/decisions/` and `--for` is the only route. | The command an agent has to remember. Checked against the Claude Code documentation: `paths` is the only field it reads, a header that does not parse loads the file in every session (the safe direction), and a dot folder is not published. |

The limit, stated in the register itself: the decisions no check can hold (brand voice, "never fill this in",
"must not be loosened") stay prose, stay in the always-on list of `AGENTS.md`, and are never shown as
enforced. Nothing makes an agent run `--for`, and nothing else protects them.

The five documents that scripts parse (`EDGE-SETUP.md`, `tools/PRE-FLIP-CHECKLIST.md`, `SECURITY.md`, the
`## Optional` heading and marker line of `llms.txt`, the marker line in `_config.yml`) keep their paths and
formats.

### Step 5. Invisible, but not byte-identical (each needs the owner's word)

Nothing a visitor or crawler perceives changes, but published bytes do, so the byte comparison cannot be the
proof. The proof is step 3.3 plus a comparison of computed styles, both taken in every state the suite can arm
and not only on the pages as shipped: both themes, no JavaScript, consent armed, menu open, the calculator and
its slider shown, right to left. The net is Chromium only, as the whole suite is.

- Remove the 18 unreachable font files and their `@font-face` rules (14 Aptos and 4 Instrument Serif, 365 KB;
  the Aptos web licence is recorded as unconfirmed).
- Remove the rules in `styles.css` that match nothing in any of those states, listed by selector in the pull
  request and not by count. Matching selectors against the static markup of the 114 pages gives 67 at this
  commit (66 when the map was made), and at least one of them is live: `.consent-panel p` styles the status
  line `app.js` writes into the panel on `privacy.html` and `integritet.html` once analytics is on. Tested:
  without that rule the armed capture of both pages changes and the capture as shipped does not. That rule
  stays.
- Correct the comment that is uniformly stale in all 114 pages ("the visit's drawn scheme").
- Correct any published comment that names a home this plan moved, if the owner wants them exact. Step 2.1 is
  written so that none becomes false.

Deliberately not planned: splitting `styles.css` or `app.js`. No incident in the history would have been
prevented by a split, a split is not atomic for a visitor holding cached HTML, and it touches every page and
every reader of those files.

## 4. What a change costs afterwards (projection)

| Routine change | Today | After steps 0, 2, 3, 4 | With step 1, option A |
| --- | --- | --- | --- |
| A CSS or JS tweak | 115 files | 115. On GitHub the 80 generated pages are collapsed and the 34 root-page stamp diffs still show | 2 files |
| Two branches open at once | 11 of 12 syncs conflict; 88% of the conflicted files are stamp-only pages | One command for the stamp part, which stops on any other conflict. The 7 syncs that also conflicted elsewhere get rarer with 2.1 (registry rows), 2.6 (catalogue tails) and step 4 (docs); a clash in `styles.css` or in a page's content stays | The same merges conflict; the stamp part is one line per asset and needs no merge tool. By replay 4 of the 11 would have been left with that one line, and 6 with 2.1 as well |
| One English sentence on a translated page | 14 to 89 files, about 9 steps | 14 files, as today (9 when the translations stand): the page, its registry file, five catalogues, 5 generated pages, `sitemap.xml` and `messages.json`. Still 89 when the language's `mod` moves, until the owner takes decision 4 (step 2.5b). About 8 of the 9 steps remain, 7 with decision 4; a retranslation starts from the old sentence | The same (option B: the generated pages and the sitemap leave the branch) |
| A nav, footer or CSP change | 114 files, 34 by hand for the shell | One template, 114 regenerated | The same (option B: 1 file) |
| A new guide | About 14 hand-edited files, about 16 with a Swedish twin | About 10, about 13 with a twin, and no retyped title, description or list entry. The three hub lists stay hand edits unless decision 3 allows part (c) of 2.4 | The same |
| A rule or decision changes | 2 to 3 prose files | One decision file, plus each topic note whose described behaviour changes; the `CLAUDE.md` copy goes | The same |
| Reading before a safe edit | About 24,000 words, 3,600 loaded into every session | The router and the always-on list (loaded), the decisions for the paths (loaded by path in Claude Code, printed by `--for` elsewhere), one topic picked by name. A change to `styles.css` or `app.js` is not narrowed by path | The same |
| Running the checks | By hand, serial, first failure only, about 15 minutes | Automatic, parallel, every failure; about 7.5 minutes for today's scope on 4 cores | The same |

A green pull request means a green `main` only with the up-to-date rule of step 0.3 or a merge queue. Without
it, option A still removes the stamp case (a new page prints whatever stamp `main` holds) but not the others: a
page added on one branch while another changes a template or the CSP lands with the old footer or the old
policy, and only the run on `main` shows it.

**What the plan adds.** If every step is done, about 130 new tracked files, none published, against 58 under
`tools/` today: 5 stamp files, 37 registry and data files, 4 templates, about 38 decision files, about 28 topic
notes, about 10 generator modules if 2.7 is done, and a handful of scripts. New things to know: the registry
row, the decision header and its guard kinds, the lists file, the date pattern, the byte-neutral declaration.
New commands: `check.js`, `tools/sync`, `shipped.js`, `serve.js`, `decisions.js --for`. A routine change needs
no command it did not need before and loses the hand-started server; under option A a stylesheet edit still
needs `npm run stamp`.

## 5. Decisions for the owner

1. **Step 1:** option A, B or C. This amends, or keeps, the recorded principle that the repository is exactly
   what ships. Option A also retires a recorded control (`SECURITY-ASSESSMENT.md`, round 3: no page carries
   front matter, so Jekyll templates nothing) and puts the page-shape check in its place.
2. **Step 0.3:** the required status check (step 1 depends on it) and, from the conversion on, the up-to-date
   rule. Separately, whether to require a review, which needs a second reviewer. If no review is required,
   the sentence in `AGENTS.md` (Repository hardening) and the `CODEOWNERS` header are corrected in the same
   commit. Once a check is required, an urgent takedown and the analytics exit wait for it: seconds for the
   static tier, minutes more if the browser tier of step 3.5 is required too. Decide with it whether that
   tier is required for every merge, and who may bypass.
3. **Step 2.4:** two things. (a) The six guide entries that differ from their guide. Keep the bytes, or
   correct them: on `blog.html` the description of `valja-konsultbolag.html` is the one the guide dropped on
   20 November; the home page gives the Swedish guide `platform-engineering.html` an English line (recorded
   as intended); in `llms.txt` three Swedish guides have no description, `platform-engineering.html` also a
   shorter title, and `choose-a-software-consultancy.html` has its own wording. The `ItemList` in
   `tools/seo/blog.json` also lists the guides in another order than the visible list on `blog.html`.
   (b) Whether the generator may write the hub lists inside `<main>` (part c of 2.4), and whether a guide's
   new title then moves the `mod` of the hubs that list it. Two more lines of `llms.txt` have drifted and no
   derivation reaches them, because they are hand-written summaries: the home page line lacks the Common
   questions block, and the `sv.html` line still lists a block that is gone.
4. **Dates of generated pages.** Moving a language's `mod` re-dates all 80 pages, and a generated guide's
   structured data can carry a later date than its visible byline. Dating each generated page by its own
   content would end both, and would change which dates future edits publish. Step 2.5b carries it out if
   taken, and the projection for a one-sentence edit depends on it.
5. **Step 5,** item by item.
6. **Step 2.5:** the 25 rows of `tools/urls.lock` for generated guides that carry 23 November while the pages
   say 24 November. Rows that are on `main` are never edited, so either correct them once as a recorded
   exception, or keep them and name them in the check. The check is not written before this ruling, because
   it would fail on `main` as it stands.
7. **Step 4:** the register. A decision file is added or superseded only on the owner's word, as a dated
   sentence is today. The first batch copies each recorded sentence word for word and names the commit that
   first wrote it, never an invented quote, and the owner reads that batch before it merges. A `CODEOWNERS`
   line asks for the owner's review of the register's folder. And whether a `.claude/` folder is wanted
   (4.5).
8. **Before step 1, option A:** the failed-build test needs a throwaway Pages repository, which only the
   owner can create.

## 6. Found on the way, outside this plan

- GitHub publishes a 246th file that the repository does not hold: `/assets/css/style.css`, the default
  theme's stylesheet (76.6 KB), live on `vynatix.com`.
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
| Each page as its own registry row, read from its head | The head block is written by the tool from the registry, so the tool would read its own output. The front-matter variant is a different idea and is left open in 2.1. |
| Translations keyed by position, or carried over automatically | An inserted paragraph attaches every later translation to the wrong sentence; a removed claim stays live in five languages nobody has checked. |
| An alias ledger for typo fixes | Tested and it works, but no edit in the history would have qualified: all five near-duplicates were real changes of meaning. Its side products are in step 2.5 and 2.6. |
| The catalogues split into one file per page | 5 files become 85, `i18n.py` and `i18n.js` change, every message needs a home rule, and two branches that add guides still meet in the shared and list-page files. A stable key order (2.6) answers the same collision without a new file. |
| Topic notes loaded by path | The notes that name `styles.css` or `app.js` hold about 60% of the words, and one of those files changes in 54% of commits: a path match would load most of the documentation. Adopted for the short decision files only (4.5). |
| Checks that write their own expected values | Right for measured numbers (3.7), wrong for the owner's terms: a check that rewrites what it guards cannot fail. |
| A watchdog that rolls production back | It would read the CDN's ten-minute lag as a fault and could republish a page that was taken down. |

Hazards the map confirmed that this plan leaves alone, so that an omission is not read as a decision: the
suite runs one browser engine; `POLICY_VERSION` in `app.js` is not compared with the two notices; the
constants of the hero's art sit in four files and `sheet-art.js` has no regenerate-and-compare check; the bans
in `styles.css` are checked for raw hex only; the facts about the Japanese and Arabic faces sit in three to
five files; the native-reader record is per language while translations change per message; the security
headers of `EDGE-SETUP.md` are not live at the edge.

## 8. How to run the refactoring

- One item per pull request (step 1 is two, see there), each declaring itself byte-neutral in its
  description, so that the proof is the workflow's verdict and not a pasted result.
- Every commit that moves text from one file to another (the step 1 conversion, 2.1, 2.2, the reorder of 2.6
  and 4.3) and every commit that touches every page (the conversion, and the comment fix of step 5) is made
  by a script that is committed with it. Git cannot carry a branch's edit into the file the text moved to:
  the merge conflicts in the old file and the edit ends up in neither (tested for 4.3). So each script takes
  the old-shape file from any branch. Step 2.3 changes no page.
- An open branch runs such a script before it syncs, not after: it takes the script from `main`
  (`git checkout origin/main -- <script>`), runs it on its own tree and commits, then merges `main` and runs
  `node tools/stamp.js`. Tested for the conversion: in that order a branch that had restamped conflicts in one
  file, the stamp file of the asset it changed, and in no page; merging first conflicts in all 114 pages, and
  running a script that is not idempotent on the half-merged result doubles the front matter under a green
  build. So the script is idempotent (a page that already starts with the front matter gets no second one, and
  a page may hold literal and tag references side by side) and its self-test covers a half-converted page.
- Never settle a page conflict by taking one side of the whole file: the other side's edits are lost and
  every check still passes.
- Make these commits when as few branches as possible are open (one pull request is open on 24 November).
- Docs move in the same commit as the code they describe, as today. A step that changes a command or file
  named in `tools/TAKEDOWN.md`, `tools/PRE-FLIP-CHECKLIST.md` or `EDGE-SETUP.md` updates it in the same commit
  and rehearses a withdrawal on a scratch copy: withdraw one guide, regenerate, `permanence.js` passes and,
  under option A, the build succeeds.
- No step fills in a `[[CONFIRM]]` marker, a `checked` or `by` field, a decision's date or wording that the
  record does not give, or anything else the owner supplies.
