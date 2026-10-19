# Pre-flip checklist: switching Google Analytics on

This is the hard gate for setting `GA_ID` in `app.js` to a real Measurement ID.
It is a checklist, not advice: every box is either ticked with its evidence or the
flip does not happen. `app.js` ships with the inert placeholder `G-XXXXXXXXXX`,
and the placeholder stays until the last box below is ticked.

Nothing here is legal advice. The legal wording on the site is a draft for
counsel, and several items are counsel's to close.

## How to use it

- One branch (`claude/google-analytics`), one PR, merged only when every box is
  ticked. Pushing to the production branch publishes live, so nothing from this
  branch goes there in pieces or early. The PR is opened when the site owner asks
  for it (see AGENTS.md, *Git & deploys*), not before.
- Every line names an **Owner** (a role, defined next) and the **Evidence** to
  keep. The owner ticks the box, writes the date and their initials, and only when
  the evidence exists. A box ticked without evidence is not ticked.
- Keep the evidence in the PR thread or in the company's own records, whichever
  counsel prefers. Do not commit contracts or legal advice to this repository.
- Where a line needs a fact only a person can supply, it is left as a blank
  (`______`) here and as a visible `[[CONFIRM: what is needed]]` marker on the
  page. Never fill either in from memory.

Roles:

| Role | Who it means |
|---|---|
| Site owner | Decides go or no-go, accepts the risk, holds the Google account. |
| Counsel | The company's legal adviser. |
| Marketing | Whoever administers the Google Analytics property. |
| Engineer | Whoever works in this repository. |
| Reviewer | A person doing the keyboard and screen reader passes. |

```
Branch:              claude/google-analytics
PR:                  ______
Evidence kept in:    ______
Property:            ______
Checklist complete:  ______ (date)
Flip commit:         ______
```

Suggested order: sections 1 and 2 produce the facts that sections 3 and 5 put into
the notices, so counsel signs off (5.2) after them, and the flip commit (9.2) is
always last.

## 1. Paperwork and records

- [ ] **1.1 Google's data processing terms accepted, a copy kept, the contracting
  entity named.** The terms are accepted for this property, and the Google entity
  that is the contracting party is written into both notices in place of its
  marker.
  - Owner: Site owner, with Marketing.
  - Evidence: the accepted terms with the acceptance date; the entity name as it
    appears in them; the notices' diff.
- [ ] **1.2 Data Privacy Framework checked, and dated.** The listing for Google LLC
  on dataprivacyframework.gov is checked (active, and which data it covers), and
  the status of the pending appeal in C-703/25 P (the Latombe appeal) is checked
  on the Court's own site. If either check shows a change that affects the
  adequacy decision, stop and read the exit triggers in section 10.
  - Owner: Counsel.
  - Evidence: a dated screenshot or PDF of the listing; a dated note of the
    appeal's status and where it was read.
- [ ] **1.3 Record of processing and DPIA screening.** The analytics processing has
  an entry in the record of processing activities, and there is a written screening
  of whether a data protection impact assessment is needed.
  - Owner: Counsel, with the Site owner.
  - Evidence: the entry and the screening note, each dated and signed.

## 2. The Google property

All of this lives in the Google Analytics admin, outside the repository. Nothing
in the repo can see it and it can drift, which is why it is evidenced here and
re-checked every quarter (section 11).

- [ ] **2.1 Settings evidenced**, each with a dated screenshot of the admin screen:
  - [ ] Google Signals off.
  - [ ] Ad personalisation off.
  - [ ] Google data-sharing settings off.
  - [ ] Event data retention set to 2 months.
  - [ ] Enhanced Measurement decided, with outbound clicks and file downloads off
    (the list pages name other firms; an outbound-click event would record which
    one a visitor followed). The events that remain are written down, which
    answers the matching marker in the notices.
  - [ ] A lookup and a deletion by client ID (the value of a `_ga` cookie) has been tried in the property and the procedure written down, because both notices promise it
  - [ ] An internal-traffic filter, or an Exclude hostname filter for `localhost`,
    so developer and test visits do not count.
  - [ ] **No** Include hostname filter until it has been tested in DebugView.
    Google's release note of 2026-09-21 says Include filters block events with an
    empty hostname, "such as gtag.js traffic", and the effect on web streams is
    unclear.
  - Owner: Marketing.
  - Evidence: the screenshots; the list of Enhanced Measurement events that remain.
- [ ] **2.2 Access reviewed.** Everyone with access to the property is listed, each
  account is protected with two-step verification, and nobody unknown is present
  (a compromised property is an exit trigger).
  - Owner: Marketing.
  - Evidence: the dated user list.

## 3. The real-ID test and the observed facts

`consent-live.js` uses the dummy ID `G-TEST000000` and never a real property, so it
cannot stand in for this section.

- [ ] **3.1 The real-ID run passes in Chromium, Firefox and WebKit.** Serve a local
  copy of the site with the `GA_ID` line replaced by the real ID (the local copy
  only; it is not committed), in a clean profile for each engine, with a
  `securitypolicyviolation` listener installed and the filters from 2.1 in place.
  In each engine:
  1. First visit: no request to a Google host, no cookies.
  2. Accept: `gtag/js` loads and a collect request returns 204.
  3. Decline from the footer, then wait 10 seconds: no further collect request, no
     `_ga` or `_ga_*` cookie.
  4. Zero `securitypolicyviolation` events and no "Refused to" console messages
     throughout.
  5. Repeat steps 2 to 4 with a back/forward-cache round trip: navigate away and
     use Back after Accept, and again after Decline.
  - Owner: Engineer.
  - Evidence: per engine, the request log, the cookie list and the violation
    count, with the browser version and the date.
- [ ] **3.2 A recorded line says a dummy-ID pass is NOT a substitute.** Copy this
  into the evidence, dated: "A pass of consent-live.js with the dummy ID
  G-TEST000000 is not a substitute for the real-ID run, because the real property
  can need other hosts and can behave differently." `consent-live.js` is also run
  in the three engines first, which is useful and never sufficient.
  - Owner: Engineer.
  - Evidence: the line; the dummy-ID results for the three engines.
- [ ] **3.3 Hosts recorded.** The Google hosts the real property needed are listed
  and compared with the policy. `img-src` widens only if a violation names it. A
  host that a violation names is added **by name**, in all three places in one
  change (the 21 page metas, `EDGE-SETUP.md`, the dashboard rule), never
  `https://*.google.com` and never `'unsafe-inline'` or `'unsafe-eval'`; `csp.js`
  is re-run. A host in the policy that the run did not use (the candidates are
  `https://www.googletagmanager.com` and `https://*.analytics.google.com` in
  `connect-src`, kept on Google's guidance, not on observation) is listed for the
  site owner to keep or drop.
  - Owner: Engineer, with the Site owner for the keep or drop decision.
  - Evidence: the host list; the commit, if the policy changed.
- [ ] **3.4 Observed cookies pasted into the notices.** The cookie names, domain
  and lifetime seen after Accept (DevTools, Application, Cookies) replace Google's
  help-page values in the cookie table of `privacy.html` and `integritet.html`,
  and the matching markers.
  - Owner: Engineer, checked by Counsel.
  - Evidence: a screenshot of the cookies after Accept in each engine; the notices'
    diff.

## 4. Decisions to close

- [ ] **4.1 The Swedish notice decision is closed**, and `integritet.html` has been
  reviewed by a Swedish speaker and by counsel. Either it ships as reviewed, or the
  decision is recorded that the bar does not show on Swedish pages until it does
  (and the code is changed to say so before the flip).
  - Owner: Site owner, with Counsel.
  - Evidence: the reviewers' names and dates; the recorded decision.
- [ ] **4.2 The storage-key decision is closed.** The site writes three keys:
  `vynatix-look` (`sessionStorage`, a random draw written without any click),
  `vynatix-theme` (`localStorage`, written when the toggle is pressed) and
  `vynatix-consent` (`localStorage`, written when Decline or Accept is pressed).
  Counsel says in writing how each is to be treated (described as display
  preferences, listed as functional, or changed). If the random draw has to go,
  the one-line fallback is to pin `pickLook()` to a single direction as AGENTS.md
  describes under *Theming*; `theme.js` tests the draw and changes with it.
  - Owner: Counsel, with the Site owner.
  - Evidence: counsel's written position; the commit, if `pickLook()` is pinned.

## 5. The notices and the sign-off

- [ ] **5.1 Every `[[CONFIRM: what is needed]]` marker is resolved** in `privacy.html` and
  `integritet.html`: Google's contracting entity (1.1), the observed cookie names
  and lifetimes (3.4), which Enhanced Measurement events remain (2.1) and the Data
  Privacy Framework listing check (1.2). Each is replaced by the evidenced fact,
  not by a guess.
  - Owner: Site owner collects the facts; Engineer edits the pages.
  - Evidence: `grep -n '\[\[CONFIRM' privacy.html integritet.html` prints nothing;
    the notices' diff.
- [ ] **5.2 Counsel's sign-off is recorded**, on the notices as they will ship
  (after 5.1), including that the consent record is kept only in the visitor's
  browser and is valid for 365 days. The "Draft pending legal review" banners on
  both notices are updated or removed as counsel advises.
  - Owner: Counsel.
  - Evidence: the written sign-off, dated, naming the commit it covers; the
    banners' diff.

## 6. Repository gates before the flip commit

- [ ] **6.1 `cd tools && npm run check` is green** on the branch head, with the
  placeholder still in place.
  - Owner: Engineer.
  - Evidence: the full output, with the commit hash.
- [ ] **6.2 Six themes.** `THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark`
  with `node verify/consent-layout.js` and again with `node verify/a11y.js` are
  green.
  - Owner: Engineer.
  - Evidence: both outputs.
- [ ] **6.3 Each new check has been shown to fail** when the behaviour it guards is
  broken, for example: request `gtag.js` before consent, add a Google host to one
  page's meta, change the footer link. A check that has only ever passed proves
  little.
  - Owner: Engineer.
  - Evidence: the failing output for each deliberate break, and the revert.

## 7. People: keyboard and screen reader

- [ ] **7.1 Keyboard-only walk** in Chromium, Firefox and WebKit, at 320 px wide and
  at 400% zoom: the skip link is still the first stop; the bar on a first visit;
  reopening it from "Cookie settings" in the footer; Escape; focus returning to the
  link; the in-page buttons on both notices; the open mobile menu over the bar.
  - Owner: Reviewer.
  - Evidence: written notes per engine, with anything that failed and how it was
    resolved.
- [ ] **7.2 Screen reader pass** with VoiceOver or NVDA on the bar, the reopen path
  and the announcements: the bar is announced as a labelled region, each button's
  name starts with its visible word, and the message after Accept, Decline and
  withdrawal is read.
  - Owner: Reviewer.
  - Evidence: the reader, browser and version used, the date, and written notes.
    A failure is fixed, or accepted by the site owner in writing.

## 8. Cloudflare

Applies only if the edge is live. `EDGE-SETUP.md`, section 6, has the detail.

- [ ] **8.1 Is the edge live?** `curl -sSI https://vynatix.com/ | grep -iE '^(server|content-security-policy)'`.
  If it is not (`server: GitHub.com` and no CSP header), tick this box as not
  applicable with the date, and repeat 8.2 to 8.6 on the day the edge goes live.
  - Owner: Engineer.
  - Evidence: the output and the date.
- [ ] **8.2 The dashboard Transform Rule was widened first**, to the string in
  `EDGE-SETUP.md` section 3, before the widened pages were deployed.
  - Owner: Site owner.
  - Evidence: a dated screenshot of the rule; the order of the two changes.
- [ ] **8.3 Browser Cache TTL is "Respect Existing Headers"**, and no Cache Rule
  lengthens the lifetime of scripts or pages.
  - Owner: Site owner.
  - Evidence: a dated screenshot.
- [ ] **8.4 Rocket Loader, Email Address Obfuscation, Web Analytics automatic
  setup, Zaraz automatic injection and the Google tag gateway are all off**, and
  the edge serves the repository's HTML unchanged (the `diff` commands in
  `EDGE-SETUP.md` print "identical").
  - Owner: Site owner, with Engineer.
  - Evidence: a dated screenshot of each setting; the diff output.
- [ ] **8.5 Cloudflare's own cookies are observed and named** in both notices, from
  a clean browser profile, not from a list.
  - Owner: Engineer, checked by Counsel.
  - Evidence: a screenshot of the cookies; the notices' diff.
- [ ] **8.6 `headers.js` and `requests.js` pass against the live origin**, once
  after the widened pages are deployed and again after the flip.
  - Owner: Engineer.
  - Evidence: `BASE=https://vynatix.com/ node verify/headers.js` and
    `BASE=https://vynatix.com/ node verify/requests.js` output, both times.

## 9. The merge

- [ ] **9.1 Every box above is ticked** and the PR description says so, with the
  link to the evidence. The PR is one PR from `claude/google-analytics`, merged
  whole.
  - Owner: Site owner.
  - Evidence: the PR description.
- [ ] **9.2 The flip is the last commit, and changes only the `GA_ID` line and the
  stamps.** Edit the line, then:
  ```sh
  cd tools && npm run stamp && cd ..
  git add -A && git commit -m "Switch analytics on"
  # run from the repository root. The commit touches app.js and the pages only:
  git diff HEAD~1 --name-only
  # exactly 2 changed lines in app.js (one removed, one added):
  git diff HEAD~1 -U0 -- app.js | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | wc -l
  # in the pages, nothing but the app.js stamp (expect 0):
  git diff HEAD~1 -U0 -- '*.html' | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vc 'app.js?v='
  cd tools
  node verify/release-gate.js    # must exit 0 now, and not before
  npm run check
  ```
  - Owner: Engineer.
  - Evidence: the commit hash and the output of the commands above.
- [ ] **9.3 After the merge deploys**, in a clean profile: a first visit sends
  nothing to Google and sets no cookie; Decline sends nothing; Accept sends a
  collect request (204) and a hit appears in Realtime; withdrawing from the footer
  stops the hits and removes the cookies. `BASE=https://vynatix.com/ node verify/requests.js`
  passes. Write down the time the merge deployed: it starts the exit clock.
  - Owner: Engineer, with Marketing.
  - Evidence: dated notes and screenshots.

## 10. Exit runbook

Rehearsed here so that nobody improvises it. Fill in the names when the list is
signed: Site owner ______, deputy ______; Engineer ______, deputy ______; Counsel
______; Marketing ______.

**Triggers.** Any one of these starts the runbook:

- A ruling of the Court of Justice of the European Union, or a decision of the
  European Commission to suspend or repeal, that affects the EU-US Data Privacy
  Framework (the adequacy decision the notices rely on).
- A statement or decision by a regulator that covers this use of Google Analytics
  or this consent design.
- A compromise of the property, or of an account with access to it.
- Any evidence that a request went to Google, or a cookie was set, before the
  visitor accepted.
- Counsel's instruction.

**Who acts.** The Site owner decides. The Engineer acts. Counsel advises on the
notices. Marketing secures the property.

**Prepared before the flip:**

- [ ] **10.1 The names above are filled in**, with a deputy for the Site owner and
  the Engineer, so the runbook can start when one of them is away.
  - Owner: Site owner.
  - Evidence: this file, committed with the names, or the PR description.
- [ ] **10.2 Purge mode is tested.** `app.js` has a `PURGE_ONLY` switch beside
  `GA_ID`. When it is `true` (with the real ID still in place) the block measures
  nothing for anyone, shows no bar, deletes the cookies named `_ga` or starting `_ga_`
  on every page load (as `purgeCookies()` does) and removes `vynatix-consent`, which
  also stops tabs that are already open through the `storage` event. Setting `GA_ID`
  back to the placeholder does not do this: the block then returns before deleting
  anything, so browsers that accepted keep their `_ga` cookies. Test it with the
  `PURGE_ONLY` scenario in `consent.js`.
  - Owner: Engineer.
  - Evidence: the test output.
- [ ] **10.3 The revert is rehearsed once** on a local copy: flip, `npm run stamp`,
  revert, `npm run stamp`, and the stamps return to their earlier values.
  - Owner: Engineer.
  - Evidence: the before and after stamps.

**When it starts, in this order:**

1. [ ] **The first action: set `var PURGE_ONLY = true;` in `app.js` and re-stamp.**
   `cd tools && npm run stamp`, commit, and deploy. The real `GA_ID` stays in place
   so the purge can run; only that one line changes, and the policy is not edited in
   the same commit. Write down the time it deploys.
2. [ ] If the edge is live, narrow the dashboard rule as a stopgap and purge the
   zone (`EDGE-SETUP.md`, section 6). It is in addition to step 1, never instead.
3. [ ] **Later, once the purge has run for as long as the longest cookie lives (365
   days) or counsel says it is enough:** set `GA_ID` back to `'G-XXXXXXXXXX'` and
   leave `PURGE_ONLY` as it is, re-stamp, and deploy.
4. [ ] Marketing stops collection at the property and secures it (access, sign-in).
   Counsel decides whether the data already collected has to be deleted, and
   requests it if so.
5. [ ] Counsel decides whether the notices need a dated note. They describe
   analytics as conditional on Accept, which stays accurate when nobody can accept.
6. [ ] Record what triggered it, the times, who acted and the evidence.

**How long it takes.** The realistic tail after a revert is **10 to 20 minutes** on
GitHub Pages (it sends `max-age=600`, and propagation adds to that), and longer
behind Cloudflare unless Browser Cache TTL is set to Respect Existing Headers.
Open tabs and cached pages keep a loaded `gtag.js` after a bare revert to the
placeholder, because that build touches nothing: it does not delete cookies and does
not clear the stored choice. That is why `app.js` re-reads the stored choice on `pageshow`
(back/forward cache), `visibilitychange` and `storage`: once a purge-mode build
(step 1) removes `vynatix-consent` on the visitor's next page load, a `storage` event
reaches every other open tab of the site, each finds no grant and revokes, and a tab
restored from the back/forward cache or brought back to the foreground does the same
on `pageshow` or `visibilitychange`. So a tab that already loaded `gtag.js` keeps
measuring until the visitor loads one page of the purge build or reloads that tab,
not until some fixed time. The exit is not instant, and nobody should promise that
it is.

## 11. Quarterly review

Repeat every quarter after the flip. Set the next date each time.

- [ ] **Data Privacy Framework.** Google LLC's listing and the appeal in C-703/25 P
  re-checked and dated.
- [ ] **Google's CSP guidance** for the tag (developers.google.com/tag-platform,
  security guides, CSP) compared with the hosts in the policy; a host Google no
  longer lists is considered for removal.
- [ ] **Property settings drift.** Every item in 2.1 re-checked in the admin
  (Signals, ad personalisation, data sharing, retention, Enhanced Measurement
  events, the filters), and the list of users with access.
- [ ] **The hostname-filter behaviour** in Google's release note of 2026-09-21
  re-read, and the filters in place re-tested in DebugView.
- [ ] **Observed cookies** compared again with the notices (names, domain,
  lifetime), and Cloudflare's cookies too if the edge is live.
- [ ] **The checks** `csp.js`, `consent.js` and `release-gate.js` run and green;
  `consent-live.js` (dummy ID) run in the three engines.
- [ ] **Outcome recorded:** no change, changed (what), or exit (section 10).
  Next review: ______.

## Sign-off

```
All boxes ticked on ______ (date) by ______ (site owner).
Counsel sign-off (5.2) dated ______.
Flip commit ______ merged at ______ (time, for the exit clock).
```
