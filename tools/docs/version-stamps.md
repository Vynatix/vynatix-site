# Version stamps on the four shared files

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Version stamps on the four shared files.** Every page loads `tokens.css`,
`colors_and_type.css`, `styles.css` and `app.js` with a content hash in the URL
(`styles.css?v=1a2b3c4d`). GitHub Pages serves each file at one fixed URL with
`Cache-Control: max-age=600`, and nothing makes a browser refetch a stylesheet
when the page that uses it changes, so after a redesign a phone can hold the new
HTML beside the old stylesheet (iOS Chrome did exactly that after the
design-system migration: icons at full width in black, default list bullets, an
unstyled header). A changed file gets a URL the visitor's browser has never
cached, so the HTML names the exact stylesheet it was written for. **After you
change any of the five files, run `cd tools && npm run stamp` and commit the
updated pages with the change.** `npm run check` (`node stamp.js --check`) fails
until you do, and `verify/stale-cache.js` proves, in a browser holding an old
copy of all five files under the plain URLs, that the stamped pages still come
out right (`ENGINE=webkit node verify/stale-cache.js` runs it in WebKit, the
engine iOS Chrome uses). A new page must load all four files; the stamp check
fails if it does not. One more file carries a stamp and is not shared: `hero-bg.css`,
the hero background, which only `index.html` loads (`stamp.js` and
`stale-cache.js` handle it, and the stamp check fails if any other page links it).

**Bringing `main` into a branch.** Two branches that both touch a stamped file
conflict in every page. Run `cd tools && npm run sync` (`node tools/sync.js`)
instead of settling them by hand. It fetches `origin/main`, starts
`git merge --no-commit --no-ff origin/main` if no merge is in progress, and
settles what needs no judgement. The files a tool writes whole (the generated
language folders, `sitemap.xml`, `tools/i18n/messages.json`) come from the
branch. Each root page is merged again from its three stages with every `?v=`
value masked, so a stamp cannot conflict. `tools/urls.lock` keeps every row of
`main` as it stands, and the generator appends the branch's own.
`tools/urls.retired` keeps every line of `main`, with the branch's own after
them. Every other conflict, `llms.txt` and `_config.yml` included, and any real
conflict in a page is named for a person, and nothing is regenerated: settle
each, `git add` it and run the command again. When nothing is left it runs
`seo-head.py`, `stamp.js`, both `--check`s and `permanence.js` and stages the
merge; the commit is yours. **Never settle a root page by taking one side of the
whole file:** the other side's hand-written edits are lost and every check still
passes. Run the command before you edit a conflicted page. A page you settled by
hand is never overwritten, but one that still holds git's own markers is merged
again.

**A branch opened before the registry became data** (step 2.1 of
`tools/REFACTORING-PLAN.md`: the rows moved from the two tables of
`tools/seo-head.py` to `tools/site/`) brings `main` in four steps, which the
docstring of `tools/migrate/registry.py` gives as commands: merge the commit the
move started from (the parent of the commit that added that script); take the
script from the move commit, run it and `python3 tools/seo-head.py`, and commit;
merge the move commit; then merge the rest of `main`. `tools/seo-head.py` then
merges without a conflict. A row the branch itself edited is an add/add
conflict, confined to the lines it changed: there, and only there, keep the
branch's line, then run `seo-head.py` and its `--check`. Without the first step
every row `main` changed since the branch was opened conflicts too, and the
branch's side of those is the stale one. The script refuses a `seo-head.py` that
holds conflict markers and data files that are newer than the table, and changes
nothing then.

What the stamps do not cover: GitHub's CDN ignores the query string, so it can
answer a new stamp with the previous bytes until a deploy replaces its copy (the
stamps protect the visitor's browser, not the CDN); and an old HTML page cached
next to the new stylesheet cannot be helped on a host that keeps one file per
path. Fonts and images are not stamped. They are replaced in place under fixed
names, and `app.js` preloads fonts by the plain URL the `@font-face` rule uses,
which the two must keep identical to be reused. If a font or image changes in a
way a stale copy would make visible (glyph coverage, metrics, a different
picture), give it a new file name and change it in `tokens.css` and in
`DISPLAY_FACES` in `app.js` together. (The redesign changed Instrument Serif, the
app icons, the favicon and the manifest in place; that was checked and is
harmless.)
