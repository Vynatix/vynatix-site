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

- Python 3, `npm install` in `tools/` (once), Chromium, and `python3 -m http.server 8000` in the repository root
  (`CHROME=<path>` if Playwright's browser is elsewhere). `links.js` and `seo.js` open pages in the browser;
  the rest are browser-free. If you cannot run a browser, the browser-free minimum is `csp.js`, `publish.js`,
  `permanence.js`, `mailto.js`, `stamp.js --check` and `release-gate.js --self-test`.
- Someone who can merge. `CODEOWNERS` asks for Code Owner review on every change; name a deputy in advance. The
  owner authorises the takedown; write the time you started in the pull request.

## Steps

1. **Branch from main.** `git checkout -b takedown/<slug> origin/main`. Do not push the old text anywhere new.
2. **Withdraw the page.** In `tools/seo-head.py`, on the page's entry (and on its twin's, if it has one), add
   `status='withdrawn'` and set `mod` to today (the stub says "removed on" that date). Do not touch `pub`: it
   never moves, and `tools/urls.lock` enforces it.
3. **Regenerate.** `python3 tools/seo-head.py`. Open the page: it must be the stub and nothing else.
4. **Remove everything that points at it.** `permanence.js` names each one: the `llms.txt` line, the Blog page
   entry, the `index.html` Further reading or `sv.html` guider item, cross-links on other pages, and, if the
   post has them, its assets (`git rm` them; images and fonts are not stamped and not covered by the lock).
5. **Check.** `node verify/permanence.js` (the withdrawn page is the stub, noindex and unlisted; every locked URL
   still has a file), then `csp.js`, `publish.js`, `mailto.js`, `stamp.js --check`, `release-gate.js --self-test`,
   `links.js` and `seo.js`.
6. **Merge.** The Pages deployment takes about 40 to 70 seconds (three runs measured on 21 to 24 October 2026:
   68, 41 and 40 seconds).
7. **Verify live.** `curl -sI https://vynatix.com/<file>.html` and fetch the body: the stub, `noindex`. Compare
   `etag` or `last-modified` against before; GitHub's CDN ignores query strings, so a cache-busting parameter
   proves nothing.
8. **Tell the engines that take a ping.** `node tools/indexnow.js <file>.html` for the withdrawn page and for
   each page that listed it (the script's default list is the sitemap, which no longer holds the withdrawn
   page). IndexNow reaches Bing, Yandex, Naver and Seznam.
9. **Ask for removal where you can.** Google Search Console URL Inspection and the Removals tool; Bing
   Webmaster Tools URL block. Both need a verified property (Phase 0 of the blog plan). Re-scrape link
   previews if the page was shared. Request exclusion from the Internet Archive if it was captured.
10. **Git history.** For a breach, decide with counsel whether to rewrite history and ask GitHub Support to
    purge cached views and pull-request diffs. `AGENTS.md` says never to rewrite this repository's history;
    for a breach the owner may authorise an exception, in writing, in the pull request. Never `git revert` the
    takedown commit: it republishes the text, and `permanence.js` cannot tell.
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

- The URL stays registered and locked for good. Do not delete the file, do not remove the registry entry, do not
  reuse the slug. `permanence.js` fails if you do.
- If the page was one of a pair, the live twin must lose its `alt` (the script refuses to generate otherwise).
- If the reason was a wrong fact rather than a confidentiality breach, a corrected page can replace the stub
  later: remove `status='withdrawn'`, write the page, move `mod`. `pub` stays as it was.
- Practise once a year on a scratch copy (copy the repository, withdraw a stand-in page, run the steps, time
  them). Steps 2 to 5 (the mechanism, not the live steps) were rehearsed that way on 4 November 2026 with a
  stand-in page: the old text was gone from the file, the page was noindex and out of the sitemap, and
  `permanence.js` failed on a page that kept its old body, on one that was still linked, and on a clean delete.

## Other ways to retire a page (not built)

- Delete with a root `404.html`: needs carve-outs in `publish.js` and `seo.js`, and `stamp.js` fails on
  absolute stylesheet hrefs. Only for pages that were never meant to be found.
- An instant meta refresh to a successor: Google reads a 0-second refresh as a permanent redirect. Untested here
  against `publish.js`, `seo.js` and `links.js`.
