# Taking a page down

For a page that must stop being served: a wrong claim, a client name under NDA, personal data. Not published
(`tools/` is excluded in `_config.yml`). Read it once before you need it.

GitHub Pages has no server-side redirects, a push to the production branch is live within about a minute, and
the repository is public. So a page that has been public never gets a 404 by accident: it keeps its URL and
answers with a short stub. The registry in `tools/seo-head.py` drives it: set `status='withdrawn'` on the page
and run the script, and the page's title, description and whole `<main>` are replaced by the stub (about a
hundred characters, no reason given, built from the existing `.page-hero` markup), the robots meta becomes
`noindex`, hreflang, FAQ and Article data disappear, and the page leaves `sitemap.xml`.

**What a stub does not do.** It controls only what vynatix.com serves. The old text stays in git history, in
every pull request diff and branch that carried it, in forks, in search-engine caches and in copies AI crawlers
already fetched. For an NDA or personal-data breach the real control is not publishing before the owner has
approved the text (`AGENTS.md`, "Posts, permanence and withdrawal"). This runbook is damage limitation.

## Before you start

- Python 3, Node, `npm install` in `tools/` (once), Chromium, and a server for the repository root
  (`python3 -m http.server 8000` from the root; `CHROME=<path>` if Playwright's browser is elsewhere).
  `links.js` and `seo.js` open pages in the browser; the rest are browser-free. If you cannot run a browser, the
  browser-free minimum is `csp.js`, `publish.js`, `permanence.js`, `mailto.js`, `stamp.js --check` and
  `release-gate.js --self-test`.
- Someone who can merge. `CODEOWNERS` asks for Code Owner review on every change; name a deputy in advance. The
  owner authorises the takedown; write the time you started in the pull request.
- Commands: the generator and the git commands run from the repository root, the `verify/` scripts and
  `stamp.js` from `tools/`. Each step below says which.

## Steps

1. **Branch from main** (root). `git checkout -b takedown/<slug> origin/main`. Do not push the old text anywhere new.
2. **Withdraw the page.** In `tools/seo-head.py`, on the page's entry, add `status='withdrawn'` and set `mod` to
   today (the stub says "removed on" that date). Do not touch `pub`: it never moves.
   *If the page has a twin* (an hreflang pair), withdraw the twin as well only if it is also at fault. Otherwise
   the live twin must stop pointing at the withdrawn page: remove its `alt` (and `original` if it has one) from
   its registry entry, remove its in-body link to the withdrawn page, and move its `mod`. The generator refuses to
   run until the live twin's `alt` is gone ("remove the alt from ... first"): that message is the expected prompt,
   not a bug.
3. **Remove everything that points at it.** `node verify/permanence.js` (from `tools/`) names each page that still
   links to it. Remove: the `llms.txt` line; the entry on `blog.html`; **the item in the ItemList in
   `tools/seo/blog.json`** (and fix `numberOfItems` and the positions); the `index.html` Further reading or
   `sv.html` guider item; any other cross-link in a page body; and, if the post has them, its assets (`git rm`;
   images and fonts are not stamped and not covered by the lock). **Move `mod` to today on every page you edited**
   (the Blog page, the home page, the twin): the sitemap `lastmod` and your IndexNow ping depend on it, and no
   check enforces it.
4. **Regenerate** (root). `python3 tools/seo-head.py`. Open the withdrawn page: it must be the stub and nothing else.
5. **Check** (`tools/`). `node verify/permanence.js` (the withdrawn page is exactly the stub, noindex and
   unlisted; every locked URL still has a file), `python3 seo-head.py --check` (or `npm run check:gen`),
   then `csp.js`, `publish.js`, `mailto.js`, `stamp.js --check`, `release-gate.js --self-test`, `links.js` and
   `seo.js`.
6. **Merge.** The Pages deployment takes about 40 to 70 seconds (three runs measured on 21 to 24 October 2026:
   68, 41 and 40 seconds).
7. **Verify live.** `curl -sI https://vynatix.com/<file>.html` and fetch the body: the stub, `noindex`. Compare
   `etag` or `last-modified` against before; GitHub's CDN ignores query strings, so a cache-busting parameter
   proves nothing.
8. **Tell the engines that take a ping** (root). `node tools/indexnow.js <file>.html` for the withdrawn page and
   for each page you edited in step 3 (the script's default list is the sitemap, which no longer holds the
   withdrawn page). IndexNow reaches the engines that take part in it: Bing, Yandex, Naver, Seznam and others.
9. **Ask for removal where you can.** Google Search Console URL Inspection and the Removals tool; Bing
   Webmaster Tools URL block. Both need a verified property of `vynatix.com` (Google: a DNS record, TXT or
   CNAME; Bing: CNAME, an XML file, a meta tag, or import from Search Console), so verify them before you need
   them; `tools/CITATION-LOG.md` lists the options. Re-scrape link previews if the page was shared. Request
   exclusion from the Internet Archive if it was captured.
10. **Git history.** For a breach, decide with counsel whether to rewrite history and ask GitHub Support to
    purge cached views and pull-request diffs. `AGENTS.md` (Git and deploys) says not to rewrite the existing
    history and makes one exception, for text that must not stay public; the owner authorises it in writing in the
    pull request. Never `git revert` the takedown commit: it republishes the text, and nothing in the repository
    notices.
11. **Record** the times and the evidence (start, merge, live check, pings, tool requests).

## How long it takes

- GitHub Pages deploys in about a minute; then browsers and Fastly/Varnish may serve the old page for up to
  `max-age=600` seconds. About 11 to 12 minutes in the worst case for a visitor who does not already hold the
  page; an open tab or a back/forward-cache page keeps the old text until it reloads. Cloudflare is not in
  front today (`server: GitHub.com`), so the longer edge TTL in `EDGE-SETUP.md` does not apply yet.
- Bing and the other IndexNow engines: documented as hours.
- ChatGPT search, Claude and Perplexity: not documented. Their vendors document robots.txt only, not whether a
  meta noindex is honoured, so the stub works only by being re-fetched. Copies already fetched cannot be recalled.
- Google: a recrawl of a noindex page "may take months" (Google's block-indexing documentation) and Google does
  not use IndexNow. The Removals tool works within about a day but is temporary (about six months), so the
  stub and its noindex must stay. A withdrawn page must never be disallowed in `robots.txt` (a blocked page
  cannot be recrawled to see noindex); `permanence.js` fails on that.

## Afterwards

- The URL stays registered and locked for good: keep the file, keep the registry entry, never reuse the slug.
  `permanence.js` fails if a locked URL has no file or a locked `pub` moves, and `publish.js` fails on a file that
  is not registered. The lock itself is append-only by convention and review: in review, check that
  `git diff tools/urls.lock` shows only added lines. Deleting the file, its registry entries and its lock row
  together is not caught by any script.
- If the reason was a wrong fact rather than a confidentiality breach, a corrected page can replace the stub
  later: remove `status='withdrawn'`, write the page, move `mod`. `pub` stays as it was.
- Practise once a year on a scratch copy (copy the repository, withdraw a stand-in page, run the steps, time
  them). The mechanism (steps 2 to 5) was rehearsed that way on 4 November 2026 with stand-in pages, including a
  pair: the old text was gone from the file, the page was noindex and out of the sitemap, and `permanence.js`
  failed on a page that kept its old body or title, on one that was still linked, and on a clean delete.
  `node verify/permanence.js --self-test` repeats the failures that can be repeated without a browser.

## Other ways to retire a page (not built)

- Delete with a root `404.html`: needs carve-outs in `publish.js` and `seo.js`, and `stamp.js` fails on
  absolute stylesheet hrefs. Only for pages that were never meant to be found.
- An instant meta refresh to a successor: Google reads a 0-second refresh as a permanent redirect. Untested here
  against `publish.js`, `seo.js` and `links.js`.
