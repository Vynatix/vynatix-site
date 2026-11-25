# Owner decisions: the classification table (step 4.0)

Written 24 November 2026 for item 4.0 of `tools/REFACTORING-PLAN.md`. Not published (`tools/` is excluded in
`_config.yml`). A record for the owner to read: it lists every owner decision that `AGENTS.md` and `CLAUDE.md`
record (as of commit 5784a9c), classes each one, and proposes a pattern where one can hold it. It makes no
decision, changes nothing the docs say, and nothing in it is the owner's word unless a quote says so.

**Since this table was made.** It is a record of commit 5784a9c and is not rewritten. Steps 2.1 and 2.2 of the
plan then moved the registry into `tools/site/pages/<slug>.json` and `tools/site/langs.json`, and the header,
footer, stub and company facts into `tools/templates/` and `tools/site/company.json`. Four patterns name
`tools/seo-head.py` and must be pointed at the new homes before they become guards: P16 (the company sentence,
now in `tools/site/company.json`), P21 (no `zh` or `hi` language, now `tools/site/langs.json`), P22 (three
withdrawn rows, now `"status": "withdrawn"` in `tools/site/pages/`) and P33 (the menu, now
`tools/templates/header.html`). Line numbers below are those of 5784a9c (`git show 5784a9c:AGENTS.md`).

## How it was made

**What counts.** A sentence is counted when it records a choice, a request, an acceptance or a rule and names the
owner as its source: the owner decided, asked for, chose, preferred, accepted, kept, removed, confirmed or
declined it, it is "the owner's word", or it belongs to the owner's website content plan or brand voice of
November 2026, or to the list the record calls owner-approved. One rule recorded in several places is one
decision, cited in each. A sentence that leaves a decision or a text to the owner is counted in its own group,
"reserved to the owner". A decision that a later one replaced is listed apart and not counted. Every line of the
two files that holds a search term (owner, chose, asked for on, decided, accepted, preferred, declined, not
chosen, must not be loosened, does not come back, never, do not, or a date in 2026) is either cited below or
named under "Not counted" with the reason; the scratch script that wrote this file (not committed) stops
otherwise.

**The words.** Each quote is copied by a script from the file and the lines it names (a line break becomes a
space), from its first word to its last, with nothing left out inside it. Where a record says more than one
thing, it is quoted twice. The owner's own words are only what the record puts in quotation marks.

**Decided** is a day only where the quoted sentence, or a second one quoted beside it, states it; a month alone
is "unrecorded". "Asked for on" names no one, and the entries say so.

**First recorded** is the oldest commit in which `git log -S` finds a short phrase of the record in the file that
holds it, checked against a second phrase where one was distinct. The clone is shallow: the visible history
starts on 29 June 2026 (55881a2 and e15c8ef), and an oldest hit on either would read "before the visible
history"; none does. Where the record was reworded later, the entry names both commits. Every first-recorded
commit falls on or after the day the decision was made.

**The classes,** by one test: would undoing the decision make the check or the pattern fail?

1. Held by a named existing check: the script and the line that asserts it, read from the script itself.
2. No existing check holds it, and a pattern can: a regular expression that must never match, must always
   match, or must match a number of times, over named files.
3. Neither: a judgement, a permission, a fact outside the tree, or a text that does not exist yet.

In classes 1 and 2, "all" means every way of undoing the decision that the record describes fails the guard, and
"part" means some do not; the entry says what is not held. A guard that trips only on a side effect of undoing a
decision does not put it in class 1 or 2. Where a class 1 decision is held in part, a pattern for the rest is
proposed beside it.

**The patterns** are the `pattern` blocks under "The patterns", each with its samples in `sample` blocks. The
script in the appendix reads both from this file: each pattern must pass on today's tree over every file it names,
and fail on each of its samples. A history sample is the lines the decision removed, copied from the revision
before the commit that removed them (`<rev>^:<path>:<lines>`), and the script checks the copy against that
revision. For a pattern that must always match, or a count, the sample is the whole revision before the decision
(marked `file`), because any short text would fail it trivially. Where the history has nothing, the sample is
constructed, or composed of today's markup and a removed line, and says so.

## The table

| | Decision | Decided | First recorded | Class |
| --- | --- | --- | --- | --- |
| A01 | `monochrome-only` | 17 November 2026 | 7b4a849, 17 November 2026 | 1, all |
| A02 | `liquid-glass` | 18 November 2026 | 53f87bd, 18 November 2026 | 2, part |
| A03 | `silk-drawn-live` | 18 November 2026 | 186c9d5, 18 November 2026 | 1, all |
| A04 | `silk-fluent` | unrecorded | d645180, 18 November 2026 | 2, part |
| A05 | `silk-answers-visitor` | unrecorded | 92f1b84, 18 November 2026 | 1, all |
| A06 | `one-ambient-motion` | unrecorded | 07372bc, 20 November 2026 | 1, part |
| A07 | `silk-behind-hero` | unrecorded | e25e466, 18 November 2026 | 1, part |
| A08 | `one-hero-background` | 20 November 2026 | 07372bc, 20 November 2026 | 1, all |
| A09 | `hero-art-lifted` | 24 November 2026 | c36ead7, 24 November 2026 | 1, all |
| A10 | `hero-gap-96` | 24 November 2026 | a0e2360, 24 November 2026 | 2, part |
| A11 | `hero-fit` | unrecorded | b0175e1, 18 November 2026 | 1, all |
| A12 | `bronze-budget` | unrecorded | 052d75e, 20 October 2026 | 3 |
| A13 | `audience-switch-retired` | unrecorded | 08e933c, 19 November 2026 | 2, part |
| A14 | `home-plan-blocks` | unrecorded | 08e933c, 19 November 2026 | 2, part |
| A15 | `no-in-numbers` | 20 November 2026 | 774238d, 20 November 2026 | 2, part |
| A16 | `no-experience-figure` | 20 November 2026 | 1aebcc5, 20 November 2026 | 2, part |
| A17 | `partnership-drawn-frames` | 20 November 2026 | 24162df, 20 November 2026 | 2, part |
| A18 | `no-start-with-one-engineer` | 20 November 2026 | 1aebcc5, 20 November 2026 | 2, part |
| A19 | `questions-on-contact` | 20 November 2026 | b871a56, 20 November 2026 | 2, part |
| A20 | `home-questions-back` | 23 November 2026 | 3e0258c, 23 November 2026 | 2, part |
| A21 | `home-service-deliverables` | 23 November 2026 | 3e0258c, 23 November 2026 | 2, part |
| A22 | `home-hero-sentence` | 23 November 2026 | 3e0258c, 23 November 2026 | 2, part |
| A23 | `no-visible-update-date` | 23 November 2026 | 3e0258c, 23 November 2026 | 2, part |
| A24 | `brand-line-ja-ar` | 23 November 2026 | 7896bd8, 23 November 2026 | 2, all |
| A25 | `script-faces` | 22 November 2026 | 2354573, 22 November 2026 | 1, all |
| A26 | `languages-live-waived` | 20 November 2026 and 21 November 2026 | b44c5e2, 20 November 2026 | 1, part |
| A27 | `zh-hi-deleted` | 21 November 2026 | d0ef8ea, 21 November 2026 | 1, part |
| A28 | `list-pages-withdrawn` | 20 November 2026 | b871a56, 20 November 2026 | 2, all |
| A29 | `voice-promise-first` | unrecorded | 08e933c, 19 November 2026 | 3 |
| A30 | `firm-is-a-consultancy` | unrecorded | 08e933c, 19 November 2026 | 2, part |
| A31 | `every-number-real` | unrecorded | 08e933c, 19 November 2026 | 3 |
| A32 | `nothing-about-inside` | unrecorded | 08e933c, 19 November 2026 | 3 |
| A33 | `automotive-not-headline` | unrecorded | 08e933c, 19 November 2026 | 2, part |
| A34 | `plan-removed-lines` | unrecorded | 08e933c, 19 November 2026 | 2, part |
| A35 | `rate-calculator` | 20 November 2026 | 47c8957, 20 November 2026 | 1, all |
| A36 | `calc-hidden-slider` | 20 November 2026 | 1f7e539, 20 November 2026 | 1, part |
| A37 | `calc-terms-are-the-owners` | unrecorded | 47c8957, 20 November 2026 | 1, part |
| A38 | `calc-no-terms-sentence` | unrecorded | 47c8957, 20 November 2026 | 3 |
| A39 | `client-approvals` | 20 November 2026 | 1aebcc5, 20 November 2026 | 2, part |
| A40 | `cases-confidence-line` | unrecorded | 08e933c, 19 November 2026 | 2, all |
| A41 | `terms-nda-sentence` | unrecorded | acf1d4d, 5 November 2026 | 2, all |
| A42 | `case-wordings` | unrecorded | 47e549d, 4 November 2026 | 3 |
| A43 | `regulated-client-anonymous` | unrecorded | 47e549d, 4 November 2026 | 3 |
| A44 | `team-projects-no-names` | unrecorded | 47e549d, 4 November 2026 | 2, part |
| A45 | `no-headcount` | unrecorded | 47e549d, 4 November 2026 | 2, part |
| A46 | `other-firms-rule` | unrecorded | 47e549d, 4 November 2026 | 3 |
| A47 | `company-sentence` | unrecorded | 47e549d, 4 November 2026 | 1, part |
| A48a | `delivers-23-november` | 23 November 2026 | ad42d85, 23 November 2026 | 3 |
| A48b | `automotive-guide-exception` | 23 November 2026 | 603a3a5, 23 November 2026 | 3 |
| A49 | `content-plan-pages` | 20 November 2026 | b871a56, 20 November 2026 | 2, part |
| A50 | `native-reader-check` | unrecorded | b871a56, 20 November 2026 | 1, part |
| A51 | `csp-google-downgrade` | unrecorded | a835c3a, 19 October 2026 | 1, all |
| A52 | `home-pictures` | 20 November 2026 | 24162df, 20 November 2026 | 2, part |
| B01 | `owner-text-pending` | unrecorded | 08e933c, 19 November 2026 | 2, part |
| B02 | `no-named-person` | unrecorded | 47e549d, 4 November 2026 | 2, part |
| B03 | `fourth-case` | unrecorded | 24162df, 20 November 2026 | 2, part |
| B04 | `new-background-reserved` | unrecorded | 07372bc, 20 November 2026 | 1, part |
| B05 | `owner-approves-new-facts` | unrecorded | 47e549d, 4 November 2026 | 3 |
| B06 | `nda-question` | unrecorded | acf1d4d, 5 November 2026 | 2, part |
| B07 | `history-rewrite-owner-only` | unrecorded | d586d81, 4 November 2026 | 3 |
| B08 | `accessibility-languages-sentence` | unrecorded | b44c5e2, 20 November 2026 | 3 |
| B09 | `brand-marks-monochrome` | unrecorded | 7b4a849, 17 November 2026 | 3 |
| B10 | `geoptie-owner-facts` | unrecorded | a03467e, 23 November 2026 | 3 |
| B11 | `approved-list-complete` | unrecorded | 47e549d, 4 November 2026 | 3 |
| C01 | `hero-room-336` | 20 November 2026 | a0e2360, 24 November 2026 | superseded |
| C02 | `home-without-questions-deliverables` | 20 November 2026 | 3e0258c, 23 November 2026 | superseded |

A is made by the owner, B reserved to the owner, C superseded. Classes are explained above; the counts are
under "Counts and the gate".

## The records

### Made by the owner

#### A01 `monochrome-only`

AGENTS.md:177-179:
> **The site shows Monochrome only** (an owner decision of 17 November 2026; until then it drew one direction at random per visit).

CLAUDE.md:55-59:
> The site shows only the system's Monochrome direction (`mono-light`, `mono-dark`); the Forest and Teal blocks stay in `tokens.css` (read-only) but no page uses them, and the random draw and its `vynatix-look` key are retired (`publish.js` fails if either comes back).

- Decided: 17 November 2026.
- First recorded: 7b4a849, 17 November 2026.
- Governs: `app.js` (the theme block), the `<html data-theme>` of every page, `tokens.css`, the two notices.
- Class 1, holds all. `tools/verify/theme.js:70` (a first visit to every page shows a Monochrome theme and writes no `vynatix-look`), `:87` and `:111` (the toggle and the older stored ids stay within Monochrome); `tools/verify/publish.js:170-171` (`vynatix-look` in `app.js` or a notice fails). Bringing back the draw fails both.

#### A02 `liquid-glass`

AGENTS.md:217-220:
> The site follows Apple's Liquid Glass as far as the web allows (an owner decision of 18 November 2026; a first pass on the 17th put frosted glass on the content cards over a tinted backdrop, which Apple's own rules exclude, and was replaced).

AGENTS.md:222:
> **Glass is the controls layer; content is never glass.**

AGENTS.md:250:
> **The glass does not move.**

- Decided: 18 November 2026.
- First recorded: 53f87bd, 18 November 2026.
- Governs: `styles.css` (the Liquid Glass block), the `.svg-defs` block of every page, `assets/glass-lens-*.svg`.
- Class 2, holds part. No check holds it: `bg-sheet.js` and `a11y.js` measure contrast through the glass, not where the glass is. P01 fails if a content card or the consent panel takes a backdrop filter again, which is what the first pass of 17 November did. Not held: that the glass does not move.
- Patterns: P01.

#### A03 `silk-drawn-live`

AGENTS.md:267-269:
> Behind every page is a silk background whose folds are drawn live (owner decisions of 18 November 2026: an ambient background, then "dynamic, not an animated static image"). It is the site's one ambient loop.

AGENTS.md:347-349:
> First the still layers themselves were animated with `transform`: too slow to see at 84px in 38 s, then a visible circular drift, which the owner rejected as "an animated static image"; the shader replaced it.

CLAUDE.md:73-74:
> An owner decision and the site's one ambient loop.

- Decided: 18 November 2026.
- First recorded: 186c9d5, 18 November 2026.
- Governs: `app.js` (the silk block), `styles.css` (the still silk), `assets/silk-*.png`, `tools/silk-masks.js`.
- Class 1, holds all. `tools/verify/waves.js:80` (on a first visit each page of the sample has one live canvas drawing frames) and `:94` (two frames 2 s apart differ in at least 15% of the pixels). A still or slid silk fails them. P02 is a side guard: it fails on the keyframe drift the owner rejected, which `waves.js` would not see while a canvas also draws.
- Patterns: P02.

#### A04 `silk-fluent`

AGENTS.md:284-286:
> draws the folds on every frame the display offers (the owner asked for motion "fluent as liquid"; an earlier 30 fps cap read as stutter)

- Decided: unrecorded (the sentence gives no day; the commit that wrote it is of 18 November).
- First recorded: d645180, 18 November 2026.
- Governs: `app.js` (the silk block).
- Class 2, holds part. No check holds it: `waves.js:94` passes at thirty frames a second too. P03 fails on the frame cap that was removed. Not held: any other way of dropping frames, and "fluent" itself, which is a judgement.
- Patterns: P03.

#### A05 `silk-answers-visitor`

AGENTS.md:295-299:
> **It answers the visitor** (owner request): the cloth gives way softly around the pointer (a Gaussian press about a third of the view across, which also lifts the cloth into the light, so it shows on a flat stretch too) and rides with the scroll at about a fifth of its speed.

- Decided: unrecorded.
- First recorded: 92f1b84, 18 November 2026.
- Governs: `app.js` (the silk block).
- Class 1, holds all. `tools/verify/waves.js:140` (with the clock frozen the picture changes near the pointer and not at the far edge) and `:145` (it changes after a scroll).

#### A06 `one-ambient-motion`

AGENTS.md:597-599:
> **One thing on the site moves on its own, and no second may be added:** the silk background, drawn live until the visitor pauses it (see *Silk waves*).

AGENTS.md:603-604:
> the silk has a pause control and is an owner decision whose limits must not be loosened.

CLAUDE.md:146-148:
> The system forbids auto-advancing strips and ambient loops, so the client list is still, the hero's drafting sheet is still and the silk has a pause control: an owner decision whose limits must not be loosened.

- Decided: unrecorded.
- First recorded: 07372bc, 20 November 2026 (as worded today; the words "an owner decision whose limits must not be loosened" were first written in CLAUDE.md by 052d75e (20 October 2026) about the iris background, since removed).
- Governs: `styles.css`, `hero-bg.css`, `app.js`, `index.html` (the client list), every page (the pause button).
- Class 1, holds part. `tools/verify/a11y.js:136` (the client list is one still list: no hidden copy, no animation, no marquee pause control), `a11y.js:203` (with reduced motion nothing animates, by CSS or by the Web Animations API), `publish.js:201-202` (no keyframes, animation or transition in `hero-bg.css`), `waves.js:162-173` (the pause button stops and resumes the loop). Not held: a second moving thing for a visitor without reduced motion. P02 holds that for `styles.css`, `hero-bg.css` and the Web Animations call in `app.js`; a loop written with `requestAnimationFrame` is not held.
- Patterns: P02.

#### A07 `silk-behind-hero`

AGENTS.md:334-335:
> The silk runs behind the English home hero and its drafting sheet (owner decision).

- Decided: unrecorded.
- First recorded: e25e466, 18 November 2026 (then "behind the English home hero and its four backgrounds"; worded as today since 07372bc (20 November 2026)).
- Governs: `app.js` (the silk block), `styles.css` (the hero), `index.html`.
- Class 1, holds part. `tools/verify/waves.js:80` (a live canvas on each page of the sample, `index.html` included). Not held: a hero painted opaque over the canvas.

#### A08 `one-hero-background`

AGENTS.md:356-361:
> Until 20 November 2026 it was one of four, drawn at random for each visit (a woven cloth, a vernier dial and an iris were the others). The owner kept the sheet, and the other three went with everything the draw needed: `data-bg` on `<html>`, the `vynatix-bg`, `vynatix-bg-seed` and `vynatix-bg-iris` keys in `sessionStorage`, `hero-bg.js`, the iris's markup in `index.html`, the dial's masks and the guards of each.

CLAUDE.md:92-94:
> It was one of four drawn at random until 20 November 2026; the owner kept the sheet, and the weave, the dial, the iris, the draw (`data-bg`, the `vynatix-bg*` keys in `sessionStorage`) and `hero-bg.js` are gone.

- Decided: 20 November 2026.
- First recorded: 07372bc, 20 November 2026.
- Governs: `hero-bg.css`, `index.html`, `app.js`, `styles.css`, `assets/bg-sheet-*.svg`, the two notices.
- Class 1, holds all. `tools/verify/publish.js:174-210`, one assertion: no `hero-bg.js`; `hero-bg.css` linked by `index.html` only; no `data-bg` or `vynatix-bg` key in any page, stylesheet or `app.js`; the art files in `assets/` are exactly the ones `hero-bg.css` names. Bringing back the draw, or a second set of art, fails it.

#### A09 `hero-art-lifted`

AGENTS.md:411-415:
> which the owner saw on 24 November as the art having slipped down. It is now lifted 168 units (`lift` in `tools/sheet-art.js`; the art files were renamed `bg-sheet-art-2.svg` and `bg-sheet-edge-2.svg`): the drawing itself is unchanged, its apex mark sits on the first line's cap line, its datum is level with the foot of the buttons, and the italic line's bronze baseline crosses it like the bar of an A.

- Decided: 24 November 2026.
- First recorded: c36ead7, 24 November 2026.
- Governs: `tools/sheet-art.js` (`lift`), `assets/bg-sheet-art-2.svg`, `assets/bg-sheet-edge-2.svg`, `hero-bg.css`.
- Class 1, holds all. `tools/verify/bg-sheet.js:363-364` (the A-frame's apex within 1.25px of the first headline line's cap line, its datum within 24 units of the foot of the buttons), run again on a scaled hero by `bg-fit.js`.

#### A10 `hero-gap-96`

AGENTS.md:415-419:
> The room the art used to hang into (from 1100px the clients' rule stood 336 units under the buttons instead of 96, kept by the owner on 20 November 2026 when the art was left where it was) went with it, on the owner's word of 24 November 2026: the English hero has the plain hero's 96 under its buttons at every width (`--hero-gap`, see *Hero fit*)

CLAUDE.md:107-108:
> The English hero has the plain 96 units between its buttons and that rule at every width: the 336 it kept from 1100px, the room the art hung into, went on the owner's word of 24 November 2026, once the art was lifted.

- Decided: 24 November 2026.
- First recorded: a0e2360, 24 November 2026.
- Governs: `styles.css` (Hero fit), `tools/verify/hero-fit.js`.
- Class 2, holds part. No check asserts the 96: in `hero-fit.js` it is a comment (line 12), and its fold table (F, line 199) expects the client row on the first screen from 864px, which a gap of 336 would probably break, but that is a side effect of the table and was not tried. P04 fails if `--hero-gap` takes any length but the 96 units or the spacing token, as the 336 did. Not held: room put back through another property.
- Patterns: P04.

#### A11 `hero-fit`

AGENTS.md:454-457:
> When a home page loads, the first screen is the hero: the header and the hero's message (eyebrow, headline, lede, buttons) fill the window, whatever its size, and the hero scales with the window's height to do it. An owner decision ("the hero should always scale to fit the browser screen when it loads").

CLAUDE.md:112:
> An owner decision.

- Decided: unrecorded.
- First recorded: b0175e1, 18 November 2026.
- Governs: `styles.css` (Hero fit), `hero-bg.css`, `index.html`, `sv.html`.
- Class 1, holds all. `tools/verify/hero-fit.js:202` (F: at a table of real windows on both home pages the buttons end above the fold and the clients' rule lies on it) and `:205` (E: the envelope's edges and browser zoom).

#### A12 `bronze-budget`

AGENTS.md:542-544:
> **Bronze budget.** The hero already spends Bronze (the accent text colour) on the italic line of the headline. The sheet adds a bronze second baseline under it, a measured edge and an apex mark. The owner accepted this.

- Decided: unrecorded.
- First recorded: 052d75e, 20 October 2026 (worded as today since 07372bc (20 November 2026)).
- Governs: `hero-bg.css`, `assets/bg-sheet-edge-2.svg`.
- Class 3. An acceptance of what the sheet spends, not a rule for later changes: undoing it (less bronze) breaks nothing the record forbids, and no pattern can tell an accepted spend from a new one.

#### A13 `audience-switch-retired`

AGENTS.md:529-532:
> The owner's website content plan takes the membership pitch off the home page, so the bar, the joiner view, its skip link, the `js-view-join` block of `app.js`, the `view-hire` / `view-join` classes and `tools/verify/audience.js` are gone.

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: `index.html`, `app.js`, `styles.css`, the generated home pages.
- Class 2, holds part. No check holds it (`audience.js` was retired with the switch). P05 fails on the bar, its two links and the view classes. Not held: the membership pitch written back in other words.
- Patterns: P05.

#### A14 `home-plan-blocks`

AGENTS.md:749-752:
> **The English home page** follows the owner's website content plan of November 2026: eight blocks (nine until the owner took In numbers out on 20 November 2026), each opening with a promise and backed by a fact, in the order a leading consultancy's home page uses.

CLAUDE.md:183-185:
> The home page is eight blocks under the brand line "Engineering that compounds." (the Swedish hub has the same blocks in Swedish)

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: `index.html`, the generated home pages, `sv.html`.
- Class 2, holds part. No check holds the blocks or their order. P06 fails unless the English home page has its sections in the plan's order. Not held: that each block opens with a promise backed by a fact, and the Swedish hub's blocks.
- Patterns: P06.

#### A15 `no-in-numbers`

AGENTS.md:770-773:
> There is no In numbers block. The plan had one after Services ("The numbers behind the promise": minutes per build, clients, reply time, the first drawn on a ruler), and the owner removed it from both home pages on 20 November 2026: do not bring it back, and do not move its figures into another block of the home page.

CLAUDE.md:194-195:
> the plan's In numbers block was removed from both on the owner's word of 20 November 2026 and does not come back.

- Decided: 20 November 2026.
- First recorded: 774238d, 20 November 2026.
- Governs: `index.html`, `sv.html`, the generated home pages.
- Class 2, holds part. No check holds it. P07 fails on the block's ids and headings in either language. Not held: its figures moved into another block.
- Patterns: P07.

#### A16 `no-experience-figure`

AGENTS.md:775-777:
> The plan also had "7 years or more" of experience in every consultant; the owner took that out the same day (it would stop being true with a hire of fewer years), so no page states an experience figure for the whole team.

CLAUDE.md:206:
> Owner decisions of 20 November 2026: no experience figure for the team

- Decided: 20 November 2026.
- First recorded: 1aebcc5, 20 November 2026.
- Governs: every page.
- Class 2, holds part. No check holds it. P08 fails on a sentence that gives every, each or all of the consultants or engineers a number of years. Not held: other phrasings. The requirement on the Career page ("five years or more of delivery", `membership.html:299`) is for who may join, not a figure for the team, and P08 does not match it.
- Patterns: P08.

#### A17 `partnership-drawn-frames`

AGENTS.md:799-800:
> The owner preferred these drawn frames to a film of the drawing being made (20 November 2026): do not replace them with video.

CLAUDE.md:123-124:
> The owner chose the drawn frames over a film (20 November 2026): no video.

- Decided: 20 November 2026.
- First recorded: 24162df, 20 November 2026.
- Governs: `index.html` (`#partnership`), `styles.css`, `assets/stage-*.svg`, the generated home pages.
- Class 2, holds part. No check holds it. P09 fails on a video element or the film's markup; P10 fails unless the band has its four frames. Not held: a film beside the frames under another name.
- Patterns: P09, P10.

#### A18 `no-start-with-one-engineer`

AGENTS.md:803-805:
> The plan's closing sentence, "Start with one engineer and add more as you grow.", is left out on the owner's decision of 20 November 2026: do not add it.

CLAUDE.md:206-207:
> no "start with one engineer" sentence

- Decided: 20 November 2026.
- First recorded: 1aebcc5, 20 November 2026.
- Governs: every English page.
- Class 2, holds part. No check holds it. P11 fails on the sentence. Not held: the same promise reworded.
- Patterns: P11.

#### A19 `questions-on-contact`

AGENTS.md:876-877:
> The questions were rewritten in the new voice on `contact.html` (the owner's decision of 20 November 2026)

CLAUDE.md:207:
> the English questions live on `contact.html`

- Decided: 20 November 2026.
- First recorded: b871a56, 20 November 2026 (in CLAUDE.md; the AGENTS.md sentence as worded today is 3e0258c (23 November 2026)).
- Governs: `contact.html`.
- Class 2, holds part. `seo.js` holds the page's FAQPage equal to its visible questions, not that the questions are there. P12 fails if `contact.html` has no question. Not held: "in the new voice".
- Patterns: P12.

#### A20 `home-questions-back`

AGENTS.md:836-839:
> Four of its comments ran against decisions of 20 November 2026, so they were put to the owner, who decided on 23 November 2026: the questions are back on the home page (`#faq`, and still on `contact.html`)

AGENTS.md:818:
> `#faq`, "Common questions": six of the questions on `contact.html`, word for word

- Decided: 23 November 2026.
- First recorded: 3e0258c, 23 November 2026.
- Governs: `index.html` (`#faq`), `contact.html`.
- Class 2, holds part. No check holds it (`seo.js` holds the FAQPage equal to the visible questions, whatever they are). P13 fails unless the home page has six questions. Not held: that they are those of `contact.html`, word for word.
- Patterns: P13.

#### A21 `home-service-deliverables`

AGENTS.md:837-838:
> they were put to the owner, who decided on 23 November 2026

AGENTS.md:839:
> each service carries a line of deliverables

AGENTS.md:763-766:
> the list of what is delivered (the label `cap__scope` and the list `cap__list`: the items of that service's "What we deliver" list on `services.html`, word for word and in its order; change the list there and here together)

- Decided: 23 November 2026.
- First recorded: 3e0258c, 23 November 2026.
- Governs: `index.html` (`#services`), `services.html`.
- Class 2, holds part. No check holds it. P14 fails unless each of the three services carries its deliverables label. Not held: that the items are those of `services.html`, word for word and in order.
- Patterns: P14.

#### A22 `home-hero-sentence`

AGENTS.md:837-838:
> they were put to the owner, who decided on 23 November 2026

AGENTS.md:839-843:
> the hero's sentence says what the engineers build instead of "raise the pace and make your software stronger" ("Vynatix is the senior software consultancy for scale-ups. Its engineers join your team and build AI systems, cloud platforms and applications."). That sentence is the hero's alone: the company sentence below is unchanged everywhere else.

- Decided: 23 November 2026.
- First recorded: 3e0258c, 23 November 2026.
- Governs: `index.html` (the hero lede), `tools/seo-head.py` (`COMPANY_SENTENCE`).
- Class 2, holds part. No check holds it. P15 fails unless the hero says the sentence; P16 (shared with A47) fails if `COMPANY_SENTENCE` takes the hero's words or any other. Not held: the hand-written copies of the company sentence in `llms.txt` and the guides.
- Patterns: P15, P16.

#### A23 `no-visible-update-date`

AGENTS.md:843-844:
> A visible "Last updated" line on the home page was offered and not chosen: do not add one.

AGENTS.md:853-854:
> a review date on anything (the owner declined visible update dates)

CLAUDE.md:188-189:
> A visible "Last updated" line was offered then and not chosen.

CLAUDE.md:185:
> on the owner's word of 23 November 2026 after that day's Geoptie report

- Decided: 23 November 2026 (CLAUDE.md:188-189 says "then", which points back to the owner's word of 23 November 2026 at CLAUDE.md:185; AGENTS.md:843-844 stands in the paragraph of the decision dated at AGENTS.md:838).
- First recorded: 3e0258c, 23 November 2026.
- Governs: `index.html`, `sv.html`.
- Class 2, holds part. No check holds it. P17 fails on an update or review line on either home page. Not held: "a review date on anything" on the other pages (the guides' bylines carry Last updated by their own pattern, which predates this).
- Patterns: P17.

#### A24 `brand-line-ja-ar`

AGENTS.md:1003-1005:
> **On the Japanese and Arabic home pages it is set in the page's language, the owner's decision of 23 November 2026** (it was the largest type on those pages and the one line their own faces never drew)

CLAUDE.md:189-191:
> The brand line is English on every page but two: on the owner's word of 23 November 2026 the Japanese and Arabic home pages set it in their own language (エンジニアリングは、複利で効く。 and هندسة يتراكم أثرها., the second line in the accent face).

- Decided: 23 November 2026.
- First recorded: 7896bd8, 23 November 2026.
- Governs: `tools/i18n/ja.json`, `tools/i18n/ar.json`, `ja/index.html`, `ar/index.html`, the other home pages.
- Class 2, holds all. No check holds it: `i18n.js` checks an optional message only where a catalogue carries one, so deleting the entry passes. P18 and P19 fail unless the two home pages carry the brand line in their language; P20 fails unless the other five home pages carry it in English.
- Patterns: P18, P19, P20.

#### A25 `script-faces`

AGENTS.md:1069-1070:
> *The faces of the other scripts* (the owner asked for them on 22 November 2026: faces in the spirit of the English type).

AGENTS.md:1105-1106:
> **No native reader has judged these faces**, as none has checked the translations: the choice is the owner's

- Decided: 22 November 2026.
- First recorded: 2354573, 22 November 2026.
- Governs: `tokens.css` (the `@font-face` block), `styles.css` (Languages), `fonts/*-ja.woff2`, `fonts/*-ar.woff2`, `tools/lang-fonts.py`.
- Class 1, holds all. `tools/verify/i18n.js:333` (on the Japanese and Arabic pages every run of text is drawn by the script's own text or accent face and never a device font).

#### A26 `languages-live-waived`

AGENTS.md:1121-1123:
> **All five are live on the owner's decision (`waived`): Spanish and Arabic since 20 November 2026, French, German and Japanese since 21 November. No native reader has checked them: the translations were written by a model on those days.**

AGENTS.md:1118-1119:
> or `waived` (the date the owner decided to publish without one).

AGENTS.md:1123-1124:
> never put a date in `checked` for a check nobody made.

- Decided: 20 November 2026 (Spanish, Arabic) and 21 November 2026 (French, German, Japanese).
- First recorded: b44c5e2, 20 November 2026.
- Governs: `LANGS` in `tools/seo-head.py`, `_config.yml`, the folders `es/`, `fr/`, `de/`, `ja/`, `ar/`.
- Class 1, holds part. `tools/seo-head.py:166-168` (a live language needs `checked` and `by`, or a `waived` date) and `tools/verify/publish.js:105-107` (the same gate), with the note of `publish.js:111`. Not held: "never put a date in `checked` for a check nobody made"; no check can know whether a reader was there.

#### A27 `zh-hi-deleted`

AGENTS.md:1132-1135:
> **The one exception: Chinese and Hindi, deleted on 21 November 2026.** Simplified Chinese (`zh/`) and Hindi (`hi/`) went live with the others on 20 November and were removed the next day on the owner's decision, when French, German and Japanese replaced them. The owner chose deletion over the withdrawn stub, so their 22 URLs answer 404.

AGENTS.md:1138-1139:
> A retired URL is never reused, and a retired language code is not brought back without the owner.

- Decided: 21 November 2026.
- First recorded: d0ef8ea, 21 November 2026.
- Governs: `tools/urls.retired`, `tools/urls.lock`, `LANGS` in `tools/seo-head.py`, `sitemap.xml`, `llms.txt`.
- Class 1, holds part. `tools/verify/permanence.js:175-188` (every URL in `tools/urls.retired` is locked, has no file, is in neither `sitemap.xml` nor `llms.txt`, and no page links it). Not held: the language codes brought back under new URLs. P21 fails if `zh` or `hi` is a row of `LANGS` again.
- Patterns: P21.

#### A28 `list-pages-withdrawn`

AGENTS.md:1143-1146:
> **The list pages are withdrawn.** `android-automotive-consultancies-gothenburg.html`, its Swedish twin `konsultbolag-android-automotive-goteborg.html` and `ai-konsultbolag-sverige.html` named other firms; the content plan retires them, and since 20 November 2026 each is the withdrawn stub

- Decided: 20 November 2026.
- First recorded: b871a56, 20 November 2026.
- Governs: the three pages, their rows in `PAGES` of `tools/seo-head.py`.
- Class 2, holds all. `permanence.js` W (lines 99-134) holds a withdrawn page to the stub, but it reads only the pages marked withdrawn, so setting one back to live passes it. P22 fails unless all three rows say `status='withdrawn'`.
- Patterns: P22.

#### A29 `voice-promise-first`

AGENTS.md:1155-1157:
> The voice is the owner's brand voice of November 2026: to clients, a promise first and the proof right behind it ("you" before "we", strong verbs, one clear invitation, "Start the conversation");

CLAUDE.md:180-181:
> Every block opens with a promise and backs it with a fact; "you" before "we";

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: every page.
- Class 3. A judgement of writing; no check or pattern can tell a promise backed by a fact.

#### A30 `firm-is-a-consultancy`

AGENTS.md:1157-1158:
> one name for the firm, consultancy, never agency or collective;

CLAUDE.md:181-182:
> one name for the firm (consultancy, never agency or collective);

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: every page.
- Class 2, holds part. No check holds it. P23 fails on agency or collective, in English or Swedish. Not held: any other noun for the firm.
- Patterns: P23.

#### A31 `every-number-real`

AGENTS.md:1158-1159:
> every number real and every client named only with its approval;

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: every page.
- Class 3. No pattern can know whether a number is real. The client half is A39.

#### A32 `nothing-about-inside`

AGENTS.md:1159:
> nothing about how Vynatix runs inside;

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: every page.
- Class 3. A matter of meaning: no pattern can tell a sentence about how the firm runs from any other. The one recorded exception is the rate calculator (A35).

#### A33 `automotive-not-headline`

AGENTS.md:1159-1160:
> automotive only inside a named case, never in a headline or a description of Vynatix.

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: every page; exempt: the two Android Automotive pages and the two automotive guides (A48b).
- Class 2, holds part. No check holds it. P24 fails on automotive in an `h1` or `h2` of any page but the four exempt ones. The exemption of the two Android Automotive pages is read from AGENTS.md:907-910, which keeps them for search with their structure; the record does not name them as an exception in so many words. Not held: "a description of Vynatix" outside the company sentence (P16).
- Patterns: P24.

#### A34 `plan-removed-lines`

AGENTS.md:879-881:
> The lines the plan removes from the whole site (declining work, sending a reader to another firm, "no pitch, no pressure", what a model cannot do as a headline, automotive as the headline) do not come back on any page.

CLAUDE.md:196-199:
> The lines the plan removed do not come back on any page: declining work or sending a reader to another firm, comparisons with other consultancies, "no pitch, no pressure", what a model cannot do as a headline, talk of size, the membership pitch.

AGENTS.md:1190-1192:
> (Until November 2026 the pattern also asked for an interest disclosure and a "when we are the wrong choice" section; the content plan removed both, with the argument for other firms.)

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: every page.
- Class 2, holds part. No check holds it. P25 fails on the removed lines themselves, in English and Swedish: the comparison with a typical consultancy, declining work and pointing to someone better, "no pitch, no pressure", the wrong choice and the wrong tool, and talk of a small firm. Not held: the same ideas in new words, and the membership pitch outside the home page.
- Patterns: P25.

#### A35 `rate-calculator`

AGENTS.md:912-913:
> **Rate calculator.** Asked for on 20 November 2026, and an exception to two rules above (nothing about how Vynatix runs inside; no terms or pay on Career)

CLAUDE.md:199:
> **One exception, asked for on 20 November 2026: the rate calculator on the Career page**

- Decided: 20 November 2026 (the record says "asked for" and does not name who asked; it stands under the owner's content plan in CLAUDE.md:180).
- First recorded: 47c8957, 20 November 2026.
- Governs: `membership.html` (`#rate-calculator`), `app.js` (the calculator block), `styles.css` (`.calc`).
- Class 1, holds all. `tools/verify/calc.js` (every figure on the card against its own copy of the model, the lines adding up, bad input, no storage, the no-JavaScript state). Removing the calculator fails it.

#### A36 `calc-hidden-slider`

AGENTS.md:924:
> **The share is 70 per cent and its slider is out of sight** (asked for on 20 November 2026).

AGENTS.md:927-928:
> The page gives no hint on purpose: no tooltip, no pointer cursor, no tab stop, no word about it, so do not add one

CLAUDE.md:201-202:
> The share is 70 per cent; its slider (70 to 80) is hidden, and five clicks on the "Your assignment" title show it, with no hint on the page, on purpose: never add one.

- Decided: 20 November 2026 (asked for; the record does not name who asked).
- First recorded: 1f7e539, 20 November 2026.
- Governs: `membership.html` (`[data-calc-share]`, `[data-calc-reveal]`), `app.js`.
- Class 1, holds part. `tools/verify/calc.js:117-118` (on arrival the slider is hidden and the share is 70 per cent), `:122` (held at 70 while hidden), `:129` (the title has no attribute but its class and hook, no pointer cursor, no tab stop, and the section's text has none of click, clicks, tap, press, times, hidden, secret, unlock), `:138` (five quick clicks show it). Not held: a hint outside the calculator's section or in other words.

#### A37 `calc-terms-are-the-owners`

AGENTS.md:938-943:
> **The numbers are the owner's.** They were copied from the calculator this one was modelled on (consulting-salary-calculator.netlify.app), not supplied in writing: the share's range, the pension, the 1.57 and what "Other salary costs" stands for are to be confirmed before the page is published, and the two tax rates are the 2026 ones and change with the law. A change is made in three places together: the constants in `app.js`, the percentages printed in the page's labels, and the same constants in `tools/verify/calc.js`.

CLAUDE.md:203-205:
> Its terms (the share, the 4.5% pension, 1.57 as the cost of a krona of salary) were taken from the calculator it was modelled on and are the owner's: change one in `app.js`, in the page's labels and in `tools/verify/calc.js` together

- Decided: unrecorded.
- First recorded: 47c8957, 20 November 2026.
- Governs: `app.js` (the calculator's constants), `membership.html` (the labels), `tools/verify/calc.js`.
- Class 1, holds part. `tools/verify/calc.js:20-22` with its model: a term changed in `app.js` alone fails. Not held: a term changed in all three places together, which the record still leaves to the owner.

#### A38 `calc-no-terms-sentence`

AGENTS.md:951-952:
> It adds no sentence about how engineers join or what the terms are: that text is still the owner's.

CLAUDE.md:205:
> add no sentence about terms around it

- Decided: unrecorded.
- First recorded: 47c8957, 20 November 2026.
- Governs: `membership.html` (`#rate-calculator` and around it).
- Class 3. No pattern can recognise a sentence about terms; `calc.js` reads the section for hints at the slider, not for terms.

#### A39 `client-approvals`

AGENTS.md:1284-1286:
> A case is told only for Volvo Trucks, Volvo Cars and the regulated client; never a broader Volvo claim, and Volvo Buses appears in the logo strip only (`assets/CREDITS.md`).

AGENTS.md:1286-1288:
> The content plan asks for each client's written approval before its name or logo is shown, and the owner confirmed on 20 November 2026 that the approvals for the fourteen are collected. A fifteenth name still needs its own.

- Decided: 20 November 2026 (the confirmation that the approvals are collected).
- First recorded: 1aebcc5, 20 November 2026.
- Governs: `index.html` (the client row), the generated home pages, every page that names a client.
- Class 2, holds part. No check holds it. P26 fails on a fifteenth client on the row; P27 fails on Volvo Buses anywhere but its mark's label in the row. Not held: a client named in prose who is not on the row, and a broader Volvo claim.
- Patterns: P26, P27.

#### A40 `cases-confidence-line`

AGENTS.md:1264-1266:
> Since the content plan of November 2026 the `work.html` hero says "Three stories we can tell in full. More of our work is trusted to us in confidence." (the owner's wording), and the home pages no longer carry a non-disclosure sentence.

- Decided: unrecorded (the record gives November 2026, no day).
- First recorded: 08e933c, 19 November 2026.
- Governs: `work.html` (the hero), `index.html`, `sv.html`.
- Class 2, holds all. No check holds it. P28 fails unless the Cases hero says the owner's wording; P29 fails on a non-disclosure sentence on either home page.
- Patterns: P28, P29.

#### A41 `terms-nda-sentence`

AGENTS.md:1269-1270:
> Unscoped: `terms.html` ("Clients named on this site appear with their knowledge; the remainder of our work is under non-disclosure and is not described here").

AGENTS.md:1271-1272:
> Only the `terms.html` sentence was committed by the owner (e413cb9)

- Decided: unrecorded (e413cb9 is before the visible history).
- First recorded: acf1d4d, 5 November 2026.
- Governs: `terms.html`.
- Class 2, holds all. No check holds it. P30 fails unless `terms.html` carries the sentence word for word.
- Patterns: P30.

#### A42 `case-wordings`

AGENTS.md:1261:
> **Owner-approved wordings.** A post reuses these or leaves them alone; it does not restate them in new words.

AGENTS.md:1289:
> The Volvo Trucks case and the Volvo Cars case (`work.html`, `index.html`) and the figures in them.

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: `work.html`, `index.html`, every post.
- Class 3. The rule is about how other pages reuse the wording; no pattern can tell a restatement in new words from new text.

#### A43 `regulated-client-anonymous`

AGENTS.md:1290-1291:
> The regulated client stays anonymous (`work.html`, the closed-domain assistant case; `ai-assistent-interna-dokument.html`).

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: `work.html`, `ai-assistent-interna-dokument.html`, every page.
- Class 3. The name is not in the repository, and a pattern that guarded it would have to write it down.

#### A44 `team-projects-no-names`

AGENTS.md:1292-1293:
> Team projects: no client names, dates or figures (the comment above `#team-projects` in `work.html`); library names are allowed.

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: `work.html` (`#team-projects`).
- Class 2, holds part. No check holds it (the rule is a comment in `work.html`). P31 fails on a client of the row or a year inside the section. Not held: other figures, and clients not on the row.
- Patterns: P31.

#### A45 `no-headcount`

AGENTS.md:1294-1295:
> No headcount, and no figure the owner has not confirmed (the history of `index.html`: commits 1c9c765, 2b39a53, d03ea15).

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: every page.
- Class 2, holds part. No check holds it. P32 fails on a number of engineers, consultants, developers, employees or staff, in digits or English words, and on a number of Swedish ones in digits. Not held: "no figure the owner has not confirmed".
- Patterns: P32.

#### A46 `other-firms-rule`

AGENTS.md:1296-1297:
> Other firms: their own words, alphabetical, dated, sourced, with the disclosure, never ranked (see "The list pages" above).

AGENTS.md:1149-1150:
> The rule they were written under still holds for anything that names another firm: quote only its own site, alphabetical, dated, with the disclosure, never ranked.

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: any page that names another firm.
- Class 3. No page names another firm today (the three list pages are stubs, A28). No pattern can tell a dated, sourced quote from any other mention of a firm.

#### A47 `company-sentence`

AGENTS.md:1263:
> The company sentence, verbatim: "One sentence about the company", above.

AGENTS.md:735-736:
> **One sentence about the company**, used verbatim wherever a page introduces it and in the JSON-LD description

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: `COMPANY_SENTENCE` in `tools/seo-head.py`, the footer, `llms.txt`, the guides' "About Vynatix".
- Class 1, holds part. `tools/seo-head.py:238` writes `COMPANY_SENTENCE` into the Organization node of every page, and `python3 tools/seo-head.py --check` fails on a page whose node differs from it. Not held: a new sentence in `COMPANY_SENTENCE` itself, which regenerates cleanly, and the hand-written copies. P16 holds the first.
- Patterns: P16.

#### A48a `delivers-23-november`

CLAUDE.md:207-210:
> Owner decisions of 23 November 2026: Vynatix delivers, and the site may say so, HIL testing, software to ISO 26262, embedded Linux for vehicles, web apps with BankID login, senior C++ and frontend consultants, test automation, ongoing maintenance (förvaltning) of custom systems, independent code review, architects for longer engagements and complete senior teams;

CLAUDE.md:213:
> (no past project in those areas is claimed anywhere)

- Decided: 23 November 2026.
- First recorded: ad42d85, 23 November 2026 (CLAUDE.md only; AGENTS.md does not carry it).
- Governs: the five Swedish posts of 23 November and their English twins, the generated languages.
- Class 3. A permission ("the site may say so"): nothing breaks it by being absent. Its limit, that no past project in those areas is claimed, is a matter of meaning.

#### A48b `automotive-guide-exception`

CLAUDE.md:207:
> Owner decisions of 23 November 2026

CLAUDE.md:212-213:
> and `fordonsmjukvara.html` with its twin `automotive-software.html` is the one guide where automotive stands in a headline

- Decided: 23 November 2026.
- First recorded: 603a3a5, 23 November 2026 (CLAUDE.md only).
- Governs: `fordonsmjukvara.html`, `automotive-software.html`, every other page.
- Class 3. An exception, so a permission like A48a: nothing breaks it by being absent. Its bound ("the one guide") is the rule of A33, and P24 holds it there by exempting exactly these two guides and the two Android Automotive pages.

#### A49 `content-plan-pages`

AGENTS.md:893:
> **The other pages.** The whole site follows the content plan since 20 November 2026.

AGENTS.md:901-904:
> `membership.html` is "Career", in the recruit voice (one engineer to another: the work, the people, the craft; no terms, pay or anything about leaving in the copy; the one place pay appears is the rate calculator, next paragraph).

AGENTS.md:908-910:
> the Android Automotive pages stay for search, off the menu, the footer and the home pages, linked from the Volvo Trucks case.

CLAUDE.md:195-196:
> The menu is Services, Industries, Cases (`work.html`), Insights (`blog.html`), Career (`membership.html`, in the recruit voice), About, Contact;

- Decided: 20 November 2026 ("since"; the menu sentence gives no day).
- First recorded: b871a56, 20 November 2026.
- Governs: `NAV` in `tools/seo-head.py`, the header and footer of every page, `index.html`, `membership.html`.
- Class 2, holds part. `seo-head.py --check` holds every page's header to `NAV`, not `NAV` to the plan. P33 fails unless `NAV` is the plan's menu in its order; P34 fails on a link to an Android Automotive page in the header or footer of any other page (on those two pages the footer's language list links the page and its twin, as on every page); P35 on one in `index.html`. `sv.html:413` links `android-automotive-utveckling.html` from its Volvo Trucks case card, so P35 leaves `sv.html` out (see "Found on the way"). Not held: the recruit voice and "no terms, pay or anything about leaving".
- Patterns: P33, P34, P35.

#### A50 `native-reader-check`

AGENTS.md:1109-1110:
> **A generated language is a draft until it is set live, and the brand voice asks for a native reader's check first.**

AGENTS.md:982-984:
> The Swedish was written with the English rewrite on 20 November 2026 and **has not been checked by a native reader**, which the brand voice requires before it goes out.

CLAUDE.md:215:
> the Swedish still needs a native reader's check

- Decided: unrecorded (a requirement of the brand voice of November 2026).
- First recorded: b871a56, 20 November 2026.
- Governs: `LANGS` in `tools/seo-head.py`, the Swedish pages, the generated languages.
- Class 1, holds part. For the generated languages `tools/seo-head.py:166-168` and `publish.js:105-107` hold it (live needs a check or the owner's waiver, A26). For Swedish nothing holds it, and no waiver is recorded (see "Found on the way").

#### A51 `csp-google-downgrade`

AGENTS.md:613-614:
> **The Google entries are a recorded security downgrade** from the earlier `'self'`-only policy. The owner accepted it for Google Analytics behind consent

AGENTS.md:618-620:
> Do not widen it further to make a measurement work. A violation names the one host that is missing; add that host by name, never `https://*.google.com`, `'unsafe-inline'` or `'unsafe-eval'`.

CLAUDE.md:173-177:
> The CSP names Google's hosts, **a recorded security downgrade** from the `'self'`-only policy: the meta on all 34 pages, `EDGE-SETUP.md` and the Cloudflare dashboard rule change together (dashboard first if the edge is live), and a missing host is added by name, never `https://*.google.com`.

- Decided: unrecorded.
- First recorded: a835c3a, 19 October 2026.
- Governs: the CSP meta of every page, `EDGE-SETUP.md` (section 3), `GOOGLE_HOSTS` in `tools/verify/_common.js`.
- Class 1, holds all. `tools/verify/csp.js:153` (`script-src` is exactly `'self'` and the pinned gtag path), `:157` (`connect-src` is exactly `'self'` and `GOOGLE_HOSTS`), `:161` (no `'unsafe-*'`, bare `*` or scheme), `:174` (every Google source is on the list), `:120` and `:140` (one policy on every page, equal to `EDGE-SETUP.md`). Widening it, and taking the accepted hosts out of one copy, both fail.

#### A52 `home-pictures`

AGENTS.md:859-860:
> **The page's pictures** (`styles.css`, "The English home page: its pictures", the last block of the file) are the owner's decisions of 20 November 2026.

AGENTS.md:863-865:
> **The generated pictures come in two sets, daylight and night**: the night version of each was made by editing the daylight one, so the objects and the composition match.

AGENTS.md:869:
> Add a picture and it needs both versions and both lines of that block.

CLAUDE.md:122-123:
> **A new picture ships as a pair, the night one made by editing the daylight one.**

- Decided: 20 November 2026.
- First recorded: 24162df, 20 November 2026.
- Governs: `styles.css` ("The English home page: its pictures"), `assets/services-drafting-sheet*.webp`, `assets/case-*.webp`, `index.html`.
- Class 2, holds part. No check holds it (the screenshot diff is run by hand against an untracked baseline). P41 fails on a pair whose night file is not the daylight file's own `-dark` twin. Not held: a picture added with no pair at all, that the night version was made by editing the daylight one, and the rest of the block (no tinted strips, the centre line).
- Patterns: P41.

### Reserved to the owner

#### B01 `owner-text-pending`

AGENTS.md:957-960:
> What the plan left open, so the pages do not have it: the two sentences about Ultra Group and the people section on About; the open roles, the line on how engineers join and the line on knowledge sharing on Career; a case outside automotive on Industries; the challenge line of the Volvo Trucks case. None of these is to be written without the owner's text.

AGENTS.md:899-900:
> the Volvo Trucks case has no challenge line until Volvo Trucks supplies one in its own words.

CLAUDE.md:213-215:
> **Never fill in what the plan leaves to the owner** (the Ultra Group sentences, people by name, open roles, how engineers join, a case outside automotive, the Volvo Trucks challenge line)

- Decided: unrecorded.
- First recorded: 08e933c, 19 November 2026 (the Volvo Trucks line; the list as worded today is b871a56 (20 November 2026)).
- Governs: `about.html`, `membership.html`, `industries.html`, `work.html` (`#volvo-trucks`).
- Class 2, holds part. No check holds it. P36 fails on a challenge line in the Volvo Trucks case. Not held: the other five texts, which no pattern can recognise before they exist.
- Patterns: P36.

#### B02 `no-named-person`

AGENTS.md:1198-1199:
> no named person appears anywhere on the site, and naming one is an owner decision.

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: every page, `tools/seo/*.json`.
- Class 2, holds part. No check holds it. P37 fails on a Person node in the structured data. Not held: a name in prose.
- Patterns: P37.

#### B03 `fourth-case`

AGENTS.md:794-795:
> A fourth published case needs a decision first: the block holds three.

- Decided: unrecorded.
- First recorded: 24162df, 20 November 2026.
- Governs: `index.html` (`#cases`), `work.html`.
- Class 2, holds part. No check holds it. P38 fails on a fourth case card on the home page. Not held: a fourth case on `work.html`.
- Patterns: P38.

#### B04 `new-background-reserved`

AGENTS.md:558-559:
> A second background, a draw between several or anything that moves is a new owner decision, not a refactor

- Decided: unrecorded.
- First recorded: 07372bc, 20 November 2026.
- Governs: `hero-bg.css`, `index.html`, `assets/bg-*.svg`, `styles.css`.
- Class 1, holds part. `tools/verify/publish.js:174-210` (no `hero-bg.js`; `hero-bg.css` still and on `index.html` only; its art files exactly the ones it names). Not held: a second background drawn from `styles.css`.

#### B05 `owner-approves-new-facts`

AGENTS.md:1232-1233:
> A post that introduces a fact not already on a published page is drafted outside the repository and committed only after the owner has approved the text

CLAUDE.md:220-221:
> A fact not already on a published page is drafted outside the public repo until the owner approves it

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: every new post, any branch.
- Class 3. Whether a fact is new and whether the owner approved it is not in the tree.

#### B06 `nda-question`

AGENTS.md:1272-1274:
> and all stay until the owner answers one question: **is all work not described on this site, for every client, under non-disclosure?**

- Decided: unrecorded.
- First recorded: acf1d4d, 5 November 2026.
- Governs: `terms.html`, `android-automotive-development.html`, `android-automotive-utveckling.html`.
- Class 2, holds part. No check holds it. P30, P39 and P40 fail unless the three sentences stay as they are. Not held: the answer itself, which is the owner's.
- Patterns: P30, P39, P40.

#### B07 `history-rewrite-owner-only`

AGENTS.md:1642-1644:
> (One exception, and only the owner can authorise it, in writing, in the pull request: text that must not stay public, such as a client name under NDA or personal data, published by mistake; see `tools/TAKEDOWN.md`.)

- Decided: unrecorded.
- First recorded: d586d81, 4 November 2026.
- Governs: the git history.
- Class 3. A rewrite of history is not in the tree, so no check of the tree can see it.

#### B08 `accessibility-languages-sentence`

AGENTS.md:1126-1128:
> Still open, and the owner's to give: a sentence in `accessibility.html` about the five languages (and, for Arabic, right to left), and the decision above about the consent bar and the notices before analytics is switched on.

- Decided: unrecorded.
- First recorded: b44c5e2, 20 November 2026.
- Governs: `accessibility.html`, `tools/PRE-FLIP-CHECKLIST.md`.
- Class 3. A text and a decision that do not exist yet; nothing can be held until the owner gives them.

#### B09 `brand-marks-monochrome`

AGENTS.md:210-212:
> What is Forest-only stays Forest: the logo files in `assets/`, the favicon and app icons and the manifest colours (a follow-up for the owner if the brand marks should go Monochrome too).

- Decided: unrecorded.
- First recorded: 7b4a849, 17 November 2026.
- Governs: `assets/vynatix-*.svg`, `favicon.*`, the app icons, `site.webmanifest`.
- Class 3. An open question; nothing is decided that a check could hold.

#### B10 `geoptie-owner-facts`

AGENTS.md:831-836:
> What it asked for that only the owner can supply is not on the page: the regulated client's name and how its answers were tested, what was done for each company on the client row (and whether each is a client: the questions on `contact.html` name six as clients, the row shows fourteen), how and when the 47 and the 6 minutes were measured, whether each case still stands as told, and how the model differs from hiring or from another kind of firm (which the plan keeps off every page).

AGENTS.md:855-857:
> everything on the owner's list above, to which the report added: which changes cut the build time, how hours are estimated and whether an engagement can change, and any certification.

- Decided: unrecorded.
- First recorded: a03467e, 23 November 2026.
- Governs: `index.html`, `work.html`, `contact.html`.
- Class 3. Facts only the owner can supply; no pattern can recognise them, or their absence, before they are written.

#### B11 `approved-list-complete`

AGENTS.md:1262:
> The owner must confirm this list is complete.

- Decided: unrecorded.
- First recorded: 47e549d, 4 November 2026.
- Governs: AGENTS.md, "Owner-approved wordings".
- Class 3. A confirmation the owner owes; nothing in the tree can hold it.

### Superseded (not counted)

#### C01 `hero-room-336`

AGENTS.md:416-417:
> kept by the owner on 20 November 2026 when the art was left where it was

- Decided: 20 November 2026.
- First recorded: a0e2360, 24 November 2026 (written on the day it was superseded).
- Superseded by A10.

#### C02 `home-without-questions-deliverables`

AGENTS.md:836-837:
> Four of its comments ran against decisions of 20 November 2026

- Decided: 20 November 2026.
- First recorded: 3e0258c, 23 November 2026.
- Superseded by A20, A21 and A22 (three of the four comments; the fourth, a visible update line, was declined: A23).

## The patterns

### P01, for A02 `liquid-glass`

```pattern
id: P01
for: A02
kind: never
flags: 
paths: styles.css
regex: (?:^|[{},])[^{}]*(?:\.(?:panel|metric|case|consent-panel)\b|#consent-bar\b)[^{}]*\{[^}]*backdrop-filter
```

From the history: the glass cards of 17 November, which the decision of 18 November replaced.

```sample P01 53f87bd^:styles.css:2320-2334
/* Glass cards. The thin blur: there can be a dozen on a page. */
.panel,
.metric,
.case,
.consent-panel,
.section--surface .panel,
.section--surface .metric,
.section--surface .case {
  position: relative;
  isolation: isolate;
  /* A step lighter than the canvas in both themes, so the glass reads as a
     pane rather than a hole; still about 80% opaque over the backdrop. */
  background: color-mix(in srgb, var(--glass-tint-surface), var(--md-sys-color-surface-bright) 40%);
  -webkit-backdrop-filter: var(--glass-blur-thin);
  backdrop-filter: var(--glass-blur-thin);
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must (the excerpt equals the revision).

### P02, for A03 `silk-drawn-live`, A06 `one-ambient-motion`

```pattern
id: P02
for: A03 A06
kind: never
flags: 
paths: styles.css hero-bg.css app.js
regex: @keyframes\b|\banimation(?:-name)?\s*:|\.animate\(
```

From the history: the keyframe drift of the still layers, which the owner rejected as "an animated static image".

```sample P02 186c9d5^:styles.css:2433-2443
@keyframes silk-light {
  from { transform: rotate(0deg) translate3d(110px, 0, 0) rotate(0deg); }
  to { transform: rotate(360deg) translate3d(110px, 0, 0) rotate(-360deg); }
}
@keyframes silk-shade {
  from { transform: rotate(0deg) translate3d(-95px, 0, 0) rotate(0deg); }
  to { transform: rotate(-360deg) translate3d(-95px, 0, 0) rotate(360deg); }
}
@media (prefers-reduced-motion: no-preference) {
  .js-waves body::before { animation: silk-light 40s linear infinite; }
  .js-waves body::after { animation: silk-shade 34s linear infinite; }
```

Result: on today's tree it passes over 3 files; sample 1 fails, as it must (the excerpt equals the revision).

### P03, for A04 `silk-fluent`

```pattern
id: P03
for: A04
kind: never
flags: 
paths: app.js
regex: if\s*\(\s*\w+\s*-\s*\w+\s*<\s*\d+\s*\)\s*return\b
```

From the history: the cap of about thirty frames a second, which "read as stutter".

```sample P03 d645180^:app.js:431-431
    if (now - lastDraw < 30) return;      // about thirty frames a second is plenty for something this slow
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must (the excerpt equals the revision).

### P04, for A10 `hero-gap-96`

```pattern
id: P04
for: A10
kind: never
flags: 
paths: styles.css hero-bg.css
regex: --hero-gap:(?!\s*(?:calc\(96\s*\*|var\(--space-))
```

From the history: the 336 units the decision of 24 November removed.

```sample P04 a0e2360^:styles.css:579-579
  .hero.hero--clients { --hero-gap: calc(336 * var(--hero-u) + 10 * (var(--hero-em0) - 16px)); --hero-k1: 806; --hero-k2: 730; --hero-wk: 860; }
```

Result: on today's tree it passes over 2 files; sample 1 fails, as it must (the excerpt equals the revision).

### P05, for A13 `audience-switch-retired`

```pattern
id: P05
for: A13
kind: never
flags: 
paths: index.html sv.html app.js styles.css es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: class="audience\b|\bview-(?:hire|join)\b|js-view-join|>\s*(?:Hire a team|Join the team)\s*<
```

From the history: the audience bar the content plan took off the home page.

```sample P05 08e933c^:index.html:355-358
    <nav class="audience" aria-label="Hire or join">
      <div class="container audience__bar">
        <a class="audience__link audience__link--hire" href="#hire">Hire a team</a>
        <a class="audience__link audience__link--join" href="#join">Join the team</a>
```

Result: on today's tree it passes over 9 files; sample 1 fails, as it must (the excerpt equals the revision).

### P06, for A14 `home-plan-blocks`

```pattern
id: P06
for: A14
kind: always
flags: 
paths: index.html es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: id="services"[\s\S]*id="cases"[\s\S]*id="partnership"[\s\S]*id="join"[\s\S]*id="insights"[\s\S]*id="contact"
```

From the history: the home page before the content plan (its whole file is the sample; shown: the head of its body).

```sample P06 08e933c^:index.html:350-358 file
    <!-- ============================================================ Audience switch
         Two plain links; the fragment is the state (styles.css, "Audience switch"). #join shows the joiner
         view, anything else the client view. Nothing is stored. -->
    <span class="view-anchor" id="hire"></span>
    <span class="view-anchor" id="join"></span>
    <nav class="audience" aria-label="Hire or join">
      <div class="container audience__bar">
        <a class="audience__link audience__link--hire" href="#hire">Hire a team</a>
        <a class="audience__link audience__link--join" href="#join">Join the team</a>
```

Result: on today's tree it passes over 6 files; sample 1 fails, as it must (the excerpt equals the revision).

### P07, for A15 `no-in-numbers`

```pattern
id: P07
for: A15
kind: never
flags: 
paths: index.html sv.html es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: id="(?:numbers|siffror)"|The numbers behind the promise|Siffrorna bakom löftet
```

From the history: the English block the decision removed.

```sample P07 774238d^:index.html:424-429
    <section class="section section--surface" id="numbers" aria-labelledby="numbers-title">
      <div class="container">
        <div class="section__head">
          <div>
            <p class="eyebrow">In numbers</p>
            <h2 class="section__h2" id="numbers-title">The numbers behind the promise</h2>
```

From the history: the Swedish block the decision removed.

```sample P07 774238d^:sv.html:343-348
    <section class="section section--surface" id="siffror" aria-labelledby="siffror-title">
      <div class="container">
        <div class="section__head">
          <div>
            <p class="eyebrow">I siffror</p>
            <h2 class="section__h2" id="siffror-title">Siffrorna bakom löftet</h2>
```

Result: on today's tree it passes over 7 files; sample 1 fails, as it must (the excerpt equals the revision); sample 2 fails, as it must (the excerpt equals the revision).

### P08, for A16 `no-experience-figure`

```pattern
id: P08
for: A16
kind: never
flags: iu
paths: *.html
regex: \b(?:every|each|all(?:\s+of)?(?:\s+our)?)\s+(?:senior\s+)?(?:consultants?|engineers?)\b[^.<]{0,80}?\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\+?\s+years\b|(?<![\p{L}])(?:alla|varje)\s+(?:våra\s+)?(?:seniora\s+)?(?:konsulter|konsult|utvecklare)(?![\p{L}])[^.<]{0,80}?\b\d+\s+år(?![\p{L}])
```

Constructed: the figure the record quotes; it never stood on a page in the visible history.

```sample P08 constructed
<p>Every consultant has 7 years or more of experience.</p>
```

Result: on today's tree it passes over 34 files; sample 1 fails, as it must.

### P09, for A17 `partnership-drawn-frames`

```pattern
id: P09
for: A17
kind: never
flags: 
paths: index.html styles.css es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: <video\b|class="film\b|film__reel
```

From the history: the film in the draft of the home page, where it stood before the owner chose the frames (it never reached index.html).

```sample P09 2c4cea5^:tools/drafts/home/index.html:344-344
        <div class="film" aria-hidden="true"><span class="film__reel"></span></div>
```

Result: on today's tree it passes over 7 files; sample 1 fails, as it must (the excerpt equals the revision).

### P10, for A17 `partnership-drawn-frames`

```pattern
id: P10
for: A17
kind: count-eq
n: 4
flags: 
paths: index.html es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: class="fig fig--[1-4]\b
```

From the history: the same draft, with the film in place of the frames (whole file).

```sample P10 2c4cea5^:tools/drafts/home/index.html:344-344 file
        <div class="film" aria-hidden="true"><span class="film__reel"></span></div>
```

Result: on today's tree it passes over 6 files; sample 1 fails, as it must (the excerpt equals the revision).

### P11, for A18 `no-start-with-one-engineer`

```pattern
id: P11
for: A18
kind: never
flags: i
paths: *.html
regex: start with one engineer
```

Constructed: the sentence as AGENTS.md:804 quotes it; it never stood on a page in the visible history.

```sample P11 constructed
<p>Start with one engineer and add more as you grow.</p>
```

Result: on today's tree it passes over 34 files; sample 1 fails, as it must.

### P12, for A19 `questions-on-contact`

```pattern
id: P12
for: A19
kind: always
flags: 
paths: contact.html
regex: data-faq-item
```

From the history: the Contact page before the questions moved there (whole file).

```sample P12 b871a56^:contact.html file
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

### P13, for A20 `home-questions-back`

```pattern
id: P13
for: A20
kind: count-eq
n: 6
flags: 
paths: index.html es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: data-faq-item
```

From the history: the home page before the decision of 23 November (whole file).

```sample P13 3e0258c^:index.html file
```

Result: on today's tree it passes over 6 files; sample 1 fails, as it must.

### P14, for A21 `home-service-deliverables`

```pattern
id: P14
for: A21
kind: count-eq
n: 3
flags: 
paths: index.html es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: class="cap__scope"
```

From the history: the home page before the decision of 23 November (whole file).

```sample P14 3e0258c^:index.html file
```

Result: on today's tree it passes over 6 files; sample 1 fails, as it must.

### P15, for A22 `home-hero-sentence`

```pattern
id: P15
for: A22
kind: always
flags: 
paths: index.html
regex: <p class="hero__lede">Vynatix is the senior software consultancy for scale-ups\. Its engineers join your team and build AI systems, cloud platforms and applications\.</p>
```

From the history: the home page before the decision of 23 November (whole file; shown: the hero sentence it had).

```sample P15 3e0258c^:index.html:301-301 file
        <p class="hero__lede">We are the senior software consultancy for scale-ups. Our engineers join your team, raise the pace and make your software stronger as you grow.</p>
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must (the excerpt equals the revision).

### P16, for A22 `home-hero-sentence`, A47 `company-sentence`

```pattern
id: P16
for: A22 A47
kind: always
flags: 
paths: tools/seo-head.py
regex: COMPANY_SENTENCE = \("Vynatix is the senior software consultancy for scale-ups\. Our engineers join your team, raise "\s*"the pace and make your software stronger as you grow\. Based in Gothenburg, part of Ultra Group\."\)
```

From the history: the registry before the brand voice, with the earlier sentence (whole file; shown: its first two lines).

```sample P16 08e933c^:tools/seo-head.py:115-116 file
COMPANY_SENTENCE = ("Vynatix AB is a software consultancy in Gothenburg, Sweden, founded in 2023 and part of "
    "Ultra Group. Our senior engineers work as part of client organisations on Android Automotive, AI engineering "
```

Constructed: the hero's words carried into the company sentence, which A22 forbids.

```sample P16 constructed
COMPANY_SENTENCE = ("Vynatix is the senior software consultancy for scale-ups. Its engineers join your team and "
    "build AI systems, cloud platforms and applications. Based in Gothenburg, part of Ultra Group.")
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must (the excerpt equals the revision); sample 2 fails, as it must.

### P17, for A23 `no-visible-update-date`

```pattern
id: P17
for: A23
kind: never
flags: i
paths: index.html sv.html
regex: Last updated|Senast uppdaterad|Reviewed on|Granskad
```

Constructed: the line was offered and never committed.

```sample P17 constructed
<p class="hero__meta">Last updated <time datetime="2026-11-24">24 November 2026</time></p>
```

Result: on today's tree it passes over 2 files; sample 1 fails, as it must.

### P18, for A24 `brand-line-ja-ar`

```pattern
id: P18
for: A24
kind: always
flags: 
paths: ja/index.html
regex: <h1 class="hero__h1">エンジニアリングは、<br><em>複利で効く。</em></h1>
```

From the history: the Japanese home page with the English brand line (whole file).

```sample P18 7896bd8^:ja/index.html file
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

### P19, for A24 `brand-line-ja-ar`

```pattern
id: P19
for: A24
kind: always
flags: 
paths: ar/index.html
regex: <h1 class="hero__h1">هندسة<br><em>يتراكم أثرها\.</em></h1>
```

From the history: the Arabic home page with the English brand line (whole file).

```sample P19 7896bd8^:ar/index.html file
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

### P20, for A24 `brand-line-ja-ar`

```pattern
id: P20
for: A24
kind: always
flags: 
paths: index.html sv.html es/index.html fr/index.html de/index.html
regex: >Engineering<br><em>that compounds\.</em></h1>
```

Constructed: a third language set in its own words; every earlier revision is English, so none can fail this.

```sample P20 constructed
<h1 class="hero__h1">Ingeniería<br><em>que se acumula.</em></h1>
```

Result: on today's tree it passes over 5 files; sample 1 fails, as it must.

### P21, for A27 `zh-hi-deleted`

```pattern
id: P21
for: A27
kind: never
flags: m
paths: tools/seo-head.py
regex: ^\s*'(?:zh|hi)':\s*dict\(
```

From the history: the two rows the decision of 21 November removed.

```sample P21 d0ef8ea^:tools/seo-head.py:141-142
  'zh': dict(name='中文', tag='zh-Hans', locale='zh_CN', dir='ltr', kind='generated', status='live', pub='2026-11-20', mod='2026-11-20', checked='', by='', waived='2026-11-20'),
  'hi': dict(name='हिन्दी', tag='hi', locale='hi_IN', dir='ltr', kind='generated', status='live', pub='2026-11-20', mod='2026-11-20', checked='', by='', waived='2026-11-20'),
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must (the excerpt equals the revision).

### P22, for A28 `list-pages-withdrawn`

```pattern
id: P22
for: A28
kind: count-eq
n: 3
flags: m
paths: tools/seo-head.py
regex: ^\s*'(?:android-automotive-consultancies-gothenburg|konsultbolag-android-automotive-goteborg|ai-konsultbolag-sverige)\.html':[^\n]*status='withdrawn'
```

From the history: the registry before the withdrawal (whole file; shown: two of the rows).

```sample P22 b871a56^:tools/seo-head.py:78-79 file
  'android-automotive-consultancies-gothenburg.html': dict(lang='en', type='CollectionPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True, alt={'sv': 'konsultbolag-android-automotive-goteborg.html'}),
  'konsultbolag-android-automotive-goteborg.html':    dict(lang='sv', type='CollectionPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True, alt={'en': 'android-automotive-consultancies-gothenburg.html'}),
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must (the excerpt equals the revision).

### P23, for A30 `firm-is-a-consultancy`

```pattern
id: P23
for: A30
kind: never
flags: iu
paths: *.html
regex: \b(?:agency|agencies|collective)\b|(?<![\p{L}])(?:byrå|byrån|byråer|kollektiv|kollektivet)(?![\p{L}])
```

From the history: the home page heading the content plan removed.

```sample P23 08e933c^:index.html:656-656
            <h2 class="section__h2" id="who-title">An agency that works from the inside</h2>
```

Result: on today's tree it passes over 34 files; sample 1 fails, as it must (the excerpt equals the revision).

### P24, for A33 `automotive-not-headline`

```pattern
id: P24
for: A33
kind: never
flags: i
paths: *.html !android-automotive-development.html !android-automotive-utveckling.html !automotive-software.html !fordonsmjukvara.html
regex: <h[12]\b[^>]*>[^<]*(?:automotive|fordon)
```

From the history: the Cases heading the content plan rewrote.

```sample P24 08e933c^:work.html:287-287
        <h2 class="section__h2 section__h2--wide">An in-cab radio, rebuilt for Android Automotive.</h2>
```

Result: on today's tree it passes over 30 files; sample 1 fails, as it must (the excerpt equals the revision).

### P25, for A34 `plan-removed-lines`

```pattern
id: P25
for: A34
kind: never
flags: i
paths: *.html
regex: no pitch, no pressure|typical consultancy|wrong choice|wrong tool|someone better|\bwe decline\b|\bdecline work\b|någon annan passar|\bsmall (?:software )?consultancy\b|keep the team small
```

From the history: the comparison with a typical consultancy.

```sample P25 08e933c^:index.html:774-774
              <caption id="compare-caption">How a typical consultancy works, next to Vynatix</caption>
```

From the history: declining work and pointing to someone better.

```sample P25 08e933c^:index.html:826-826
            <p>Anything outside those three we decline, and we point you to someone better. We take on new work only when we have the capacity to do it well.</p>
```

From the history: what a model cannot do, as a headline.

```sample P25 08e933c^:ai-engineering.html:429-429
            <h2 class="section__h2 two-up__h2">When is a language model the wrong tool?</h2>
```

From the history: the "wrong choice" section of the guide pattern.

```sample P25 b871a56^:choose-a-software-consultancy.html:403-403
          <h2>When is Vynatix the wrong choice?</h2>
```

From the history: "no pitch, no pressure".

```sample P25 b871a56^:membership.html:408-408
          <h2 class="cta-band__h2" id="cta-title">A thirty-minute conversation, <em>no pitch, no pressure.</em></h2>
```

From the history: declining work.

```sample P25 b871a56^:about.html:280-280
            <h3>We decline work we cannot do well</h3>
```

From the history: sending a reader to another firm, in Swedish.

```sample P25 b871a56^:android-automotive-utveckling.html:454-454
              <p>Det finns flera, och vi har sammanställt en lista över konsultbolag i Göteborg som arbetar med Android Automotive: <a href="konsultbolag-android-automotive-goteborg.html">Konsultbolag inom Android Automotive i Göteborg</a>. Om någon annan passar ert uppdrag bättre än vi, säger vi det och berättar vem.</p>
```

From the history: talk of size (removed earlier, on 28 September 2026, by 1c9c765).

```sample P25 1c9c765^:index.html:440-440
          <p class="section__lead">Vynatix is a small software consultancy in Gothenburg, working since 2023 and part of Ultra Group. We keep the team small on purpose, never more than fifteen senior engineers at once, so the people you meet are the people doing the work.</p>
```

Result: on today's tree it passes over 34 files; sample 1 fails, as it must (the excerpt equals the revision); sample 2 fails, as it must (the excerpt equals the revision); sample 3 fails, as it must (the excerpt equals the revision); sample 4 fails, as it must (the excerpt equals the revision); sample 5 fails, as it must (the excerpt equals the revision); sample 6 fails, as it must (the excerpt equals the revision); sample 7 fails, as it must (the excerpt equals the revision); sample 8 fails, as it must (the excerpt equals the revision).

### P26, for A39 `client-approvals`

```pattern
id: P26
for: A39
kind: count-max
n: 14
flags: 
paths: index.html es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: class="clients__item"
```

Constructed: a row of fifteen; the row has never held more than fourteen.

```sample P26 constructed
<li><a class="clients__item" href="#">Client 1</a></li>
<li><a class="clients__item" href="#">Client 2</a></li>
<li><a class="clients__item" href="#">Client 3</a></li>
<li><a class="clients__item" href="#">Client 4</a></li>
<li><a class="clients__item" href="#">Client 5</a></li>
<li><a class="clients__item" href="#">Client 6</a></li>
<li><a class="clients__item" href="#">Client 7</a></li>
<li><a class="clients__item" href="#">Client 8</a></li>
<li><a class="clients__item" href="#">Client 9</a></li>
<li><a class="clients__item" href="#">Client 10</a></li>
<li><a class="clients__item" href="#">Client 11</a></li>
<li><a class="clients__item" href="#">Client 12</a></li>
<li><a class="clients__item" href="#">Client 13</a></li>
<li><a class="clients__item" href="#">Client 14</a></li>
<li><a class="clients__item" href="#">Client 15</a></li>
```

Result: on today's tree it passes over 6 files; sample 1 fails, as it must.

### P27, for A39 `client-approvals`

```pattern
id: P27
for: A39
kind: never
flags: 
paths: *.html
regex: Volvo Buses(?! \(opens in a new tab\)</span>)
```

Constructed: no such line is in the visible history.

```sample P27 constructed
<p>For Volvo Buses we built the driver display.</p>
```

Result: on today's tree it passes over 34 files; sample 1 fails, as it must.

### P28, for A40 `cases-confidence-line`

```pattern
id: P28
for: A40
kind: always
flags: 
paths: work.html
regex: <p class="page-hero__lede">Three stories we can tell in full\. More of our work is trusted to us in confidence\.</p>
```

From the history: the Cases page before the content plan (whole file; shown: its hero line).

```sample P28 08e933c^:work.html:279-279 file
        <p class="page-hero__lede">Vynatix, a software consultancy in Gothenburg, has shipped Android Automotive, build pipeline and AI engineering work for Volvo Trucks, Volvo Cars and a regulated client since 2024. Each case is written by an engineer who worked on it, and is honest about what was in scope and what was not. The rest of our work is under non-disclosure. Further down: more projects our engineers have shipped, and the libraries they maintain.</p>
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must (the excerpt equals the revision).

### P29, for A40 `cases-confidence-line`

```pattern
id: P29
for: A40
kind: never
flags: i
paths: index.html sv.html
regex: non-disclosure|sekretess
```

From the history: the home page's non-disclosure line the content plan removed.

```sample P29 08e933c^:index.html:520-520
            <p class="work-index__lead">As of October 2026, these are the three projects we can talk about. The rest of our work with Volvo Trucks and Volvo Cars is under non-disclosure.</p>
```

Result: on today's tree it passes over 2 files; sample 1 fails, as it must (the excerpt equals the revision).

### P30, for A41 `terms-nda-sentence`, B06 `nda-question`

```pattern
id: P30
for: A41 B06
kind: always
flags: 
paths: terms.html
regex: Clients named on this site appear with their knowledge; the remainder of our work is under non-disclosure and is not described here
```

Constructed: the owner's commit e413cb9 is before the visible history, so no earlier revision is at hand.

```sample P30 constructed
<p>Clients named on this site appear with their knowledge.</p>
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

### P31, for A44 `team-projects-no-names`

```pattern
id: P31
for: A44
kind: never
flags: 
paths: work.html
regex: id="team-projects"(?:(?!</section>)[\s\S])*?(?:Saab|Sony|Tele2|Swisslog|Volvo|Scania|Magna|Aurobay|CEVT|Veoneer|Agnhaga|\b(?:19|20)\d\d\b)
```

Composed: the section's opening tag of today with a line f0f5e23 removed from it (f0f5e23^:work.html:361, when the section was still called before-vynatix).

```sample P31 composed
    <section class="section section--surface" id="team-projects">
            <p class="cap__num">Volvo Trucks · 2019 to 2021</p>
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

### P32, for A45 `no-headcount`

```pattern
id: P32
for: A45
kind: never
flags: iu
paths: *.html
regex: \b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty)\s+(?:senior\s+)?(?:engineers|consultants|developers|employees|staff)\b|\b\d+\s+(?:seniora\s+)?(?:utvecklare|konsulter|ingenjörer|medarbetare|anställda)(?![\p{L}])
```

From the history: a headcount removed by 1c9c765 (28 September 2026).

```sample P32 1c9c765^:index.html:440-440
          <p class="section__lead">Vynatix is a small software consultancy in Gothenburg, working since 2023 and part of Ultra Group. We keep the team small on purpose, never more than fifteen senior engineers at once, so the people you meet are the people doing the work.</p>
```

From the history: a headcount removed by 2b39a53 (19 October 2026).

```sample P32 2b39a53^:index.html:572-572
          <p class="section__lead">Vynatix AB is a software consultancy in Gothenburg, Sweden, founded in 2023 and part of Ultra Group. Three senior engineers work embedded in client teams on Android Automotive, AI engineering and cloud platforms, with Volvo Trucks and Volvo Cars among our clients. We keep the team small on purpose, so the people you meet are the people doing the work.</p>
```

Result: on today's tree it passes over 34 files; sample 1 fails, as it must (the excerpt equals the revision); sample 2 fails, as it must (the excerpt equals the revision).

### P33, for A49 `content-plan-pages`

```pattern
id: P33
for: A49
kind: always
flags: m
paths: tools/seo-head.py
regex: ^NAV = \[\('services\.html', 'Services'\), \('industries\.html', 'Industries'\), \('work\.html', 'Cases'\), \('blog\.html', 'Insights'\), \('membership\.html', 'Career'\), \('about\.html', 'About'\), \('contact\.html', 'Contact'\)\]$
```

From the history: the menu before the plan's names (whole file; shown: its NAV line).

```sample P33 1aebcc5^:tools/seo-head.py:345-345 file
NAV = [('services.html', 'Services'), ('work.html', 'Cases'), ('blog.html', 'Blog'), ('about.html', 'About'), ('contact.html', 'Contact')]
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must (the excerpt equals the revision).

### P34, for A49 `content-plan-pages`

```pattern
id: P34
for: A49
kind: never
flags: 
paths: *.html !android-automotive-development.html !android-automotive-utveckling.html
regex: <(header|footer)\b(?:(?!</\1>)[\s\S])*?android-automotive-(?:development|utveckling)\.html
```

Constructed: no header or footer in the visible history links them.

```sample P34 constructed
<footer class="site-footer inverse">
  <a href="android-automotive-development.html">Android Automotive</a>
</footer>
```

Result: on today's tree it passes over 32 files; sample 1 fails, as it must.

### P35, for A49 `content-plan-pages`

```pattern
id: P35
for: A49
kind: never
flags: 
paths: index.html es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: href="(?:\.\./)?android-automotive-(?:development|utveckling)\.html
```

From the history: the home page's link the content plan removed.

```sample P35 08e933c^:index.html:535-535
            <a class="more" href="android-automotive-development.html"><span>Android Automotive development in Gothenburg</span><svg class="icon icon--sm" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="m212-180-32-32 482.62-482.61H362.85V-740H740v377.15h-45.39v-299.77L212-180Z"/></svg></a>
```

Result: on today's tree it passes over 6 files; sample 1 fails, as it must (the excerpt equals the revision).

### P36, for B01 `owner-text-pending`

```pattern
id: P36
for: B01
kind: never
flags: 
paths: work.html
regex: id="volvo-trucks"(?:(?!</section>)[\s\S])*?>The challenge\.<
```

Composed: the case's opening tag of today with a challenge line in the form the other two cases use; no such line was ever written.

```sample P36 composed
    <section class="section" id="volvo-trucks">
            <p class="two-up__body"><strong class="lead-in">The challenge.</strong> A line Volvo Trucks has not supplied.</p>
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

### P37, for B02 `no-named-person`

```pattern
id: P37
for: B02
kind: never
flags: 
paths: *.html tools/seo/*.json
regex: "@type":\s*"Person"
```

Constructed: no Person node is in the visible history.

```sample P37 constructed
"author": { "@type": "Person", "name": "A. Writer" }
```

Result: on today's tree it passes over 44 files; sample 1 fails, as it must.

### P38, for B03 `fourth-case`

```pattern
id: P38
for: B03
kind: count-max
n: 3
flags: 
paths: index.html es/index.html fr/index.html de/index.html ja/index.html ar/index.html
regex: <article class="case"
```

Constructed: four cards; the block has never held more than three.

```sample P38 constructed
<article class="case">
<article class="case">
<article class="case">
<article class="case">
```

Result: on today's tree it passes over 6 files; sample 1 fails, as it must.

### P39, for B06 `nda-question`

```pattern
id: P39
for: B06
kind: always
flags: 
paths: android-automotive-development.html
regex: Beyond what we have published, our work with Volvo Trucks and Volvo Cars is under non-disclosure\.
```

From the history: the page before the sentence was written (whole file).

```sample P39 7532795^:android-automotive-development.html file
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

### P40, for B06 `nda-question`

```pattern
id: P40
for: B06
kind: always
flags: 
paths: android-automotive-utveckling.html
regex: Utöver det vi har publicerat omfattas vårt arbete med Volvo Trucks och Volvo Cars av sekretess\.
```

Constructed: the page was created with the sentence (05bb2f3), so no revision without it exists.

```sample P40 constructed
<p>Vårt arbete med Volvo Trucks omfattas av sekretess.</p>
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

### P41, for A52 `home-pictures`

```pattern
id: P41
for: A52
kind: never
flags: 
paths: styles.css
regex: light-dark\(\s*url\(assets/([a-z0-9-]+)\.webp\)\s*,\s*url\(assets/(?!\1-dark\.webp\))
```

Constructed: the night slot holding a different picture; every pair in the history is right.

```sample P41 constructed
  .case__img--dial { background-image: light-dark(url(assets/case-trucks-radio-dial.webp), url(assets/case-trucks-forest-road.webp)); }
```

Result: on today's tree it passes over 1 file; sample 1 fails, as it must.

## Found on the way

Points the table turned up that are the owner's to settle. Nothing was changed for them.

1. `sv.html:413` links `android-automotive-utveckling.html` from the Volvo Trucks case card on the Swedish hub,
   while AGENTS.md:908-910 keeps the Android Automotive pages "off the menu, the footer and the home pages, linked
   from the Volvo Trucks case". Either that card is the case the sentence means, or the hub breaks the rule. P35
   leaves `sv.html` out until the owner says which.
2. AGENTS.md:940-941 says the calculator's numbers "are to be confirmed before the page is published", and
   `membership.html` is live with the calculator. Either the confirmation was given and is not recorded, or it is
   still owed.
3. The brand voice asks for a native reader's check before a language goes out (AGENTS.md:982-984). The generated
   languages carry the owner's waiver (`waived` in `LANGS`); the Swedish pages are live with neither a check nor
   a recorded waiver.
4. The words "an owner decision whose limits must not be loosened" were first written about the iris background
   (052d75e, 20 October 2026) and carried over to the silk on 20 November (07372bc). The decision they now name
   is the silk's; its own date is not recorded.
5. AGENTS.md:749-750 says the English home page has eight blocks; since 23 November it has a ninth, "Common
   questions", which CLAUDE.md:185-186 and AGENTS.md:818 record.
6. `hero-fit.js` names the 96 under the buttons only in a comment (line 12). Its fold table would probably fail
   if the 336 came back, but that was not tried; P04 holds the value without a browser.
7. `permanence.js` W holds a withdrawn page to the stub but reads only the pages marked withdrawn, so a page set
   back to live is not seen; that is why A28 is class 2 (P22) and not class 1.
8. "Asked for on 20 November 2026" (A35, A36) does not say who asked. Both stand under the owner's content plan in
   CLAUDE.md:180-199, and AGENTS.md:938 calls the calculator's numbers the owner's.
9. The only sentence the record says the owner committed (A41, e413cb9) is before the visible history, so its
   pattern has a constructed sample.

## Not counted

Lines of the two files that hold a search term and are not cited above, with the reason.

| Line | Reason |
| --- | --- |
| AGENTS.md:46, 58 | repeats A28 |
| AGENTS.md:53, 728, 729, 824, 846, 1212, 1440 | the date of an event or a source, not a decision |
| AGENTS.md:67, 149, 161, 304, 339, 365, 390, 464, 489, 496, 507, 556, 580, 638, 643, 670, 699, 707, 710, 779, 817, 898, 917, 923, 1000, 1033, 1068, 1089, 1116, 1130, 1181, 1184, 1185, 1186, 1254, 1370, 1376, 1387, 1397, 1398, 1406, 1416, 1430, 1435, 1438, 1469, 1471, 1541, 1595, 1599, 1616, 1640 | a technical or editorial rule that names no owner |
| AGENTS.md:68 | repeats A26 |
| AGENTS.md:70, 93, 1615 | the word in another sense (ownership, `CODEOWNERS`) |
| AGENTS.md:188 | a visitor's choice, not the owner's |
| AGENTS.md:193 | repeats A01 (its mechanism, held by the same checks) |
| AGENTS.md:336 | an acceptance the record attributes to no one |
| AGENTS.md:410 | repeats A09 (the state before the lift) |
| AGENTS.md:479 | repeats A10 |
| AGENTS.md:527 | repeats A13 (its heading) |
| AGENTS.md:746, 1140, 1633, 1634 | an action for the owner or an administrator outside the repository, not a decision about the tree |
| AGENTS.md:758, 814 | a dated change whose record names no owner |
| AGENTS.md:878 | repeats A20 |
| AGENTS.md:929 | repeats A36 (its accepted cost; the record does not say who accepted it) |
| AGENTS.md:1020, 1078 | a choice the record says agents or reviews made |
| AGENTS.md:1170, 1484 | a rule of the design system or its content rules, not the owner's |
| AGENTS.md:1177 | the blog extension plan the owner holds: the section's working rules are not recorded as the owner's decisions |
| AGENTS.md:1235, 1450 | a fact for a person or counsel to supply (a `[[CONFIRM]]` marker), not recorded as the owner's decision |
| AGENTS.md:1280 | repeats B06 (an agent rule for reusing the agent-written sentences until the owner answers) |
| AGENTS.md:1611, 1613 | a branch or pull-request rule for agents |
| CLAUDE.md:23, 24, 29, 39, 40, 88, 115, 157, 217 | a technical or editorial rule that names no owner |
| CLAUDE.md:32, 33, 34 | repeats A26 |
| CLAUDE.md:36 | repeats A27 |
| CLAUDE.md:64, 68 | repeats A02 |
| CLAUDE.md:77 | a WCAG requirement (AGENTS.md:310-312), held by `waves.js:162-173` |
| CLAUDE.md:97 | repeats A09 |
| CLAUDE.md:158 | a visitor's choice, not the owner's |
| CLAUDE.md:179, 222 | a fact for a person or counsel to supply (a `[[CONFIRM]]` marker), not recorded as the owner's decision |
| CLAUDE.md:226, 244 | a rule of the design system or its content rules, not the owner's |
| CLAUDE.md:269 | a branch or pull-request rule for agents |

## Verification

The appendix script, run over this file on the tree of commit 5784a9c: all 41 patterns pass on today's tree, and each fails on every one of its samples (51 in all); every history excerpt equals its revision.
The quotes were copied and checked by the scratch script that wrote this file (not committed: it and its data
live outside the repository), which also stops when a line with a search term is neither cited nor named under
"Not counted".

## Appendix: the test script

Not committed as a file: this item commits the table alone. To run it, extract each history revision it names
into one folder as `<rev>_<path with / as _>` (for example `git show 774238d^:index.html >
"rev/774238d^_index.html"`), save the script below as `test.js` and run
`node test.js tools/DECISION-TABLE.md . rev` from the repository root. The revisions it reads:

- `08e933c^:ai-engineering.html`
- `08e933c^:index.html`
- `08e933c^:tools/seo-head.py`
- `08e933c^:work.html`
- `186c9d5^:styles.css`
- `1aebcc5^:tools/seo-head.py`
- `1c9c765^:index.html`
- `2b39a53^:index.html`
- `2c4cea5^:tools/drafts/home/index.html`
- `3e0258c^:index.html`
- `53f87bd^:styles.css`
- `7532795^:android-automotive-development.html`
- `774238d^:index.html`
- `774238d^:sv.html`
- `7896bd8^:ar/index.html`
- `7896bd8^:ja/index.html`
- `a0e2360^:styles.css`
- `b871a56^:about.html`
- `b871a56^:android-automotive-utveckling.html`
- `b871a56^:choose-a-software-consultancy.html`
- `b871a56^:contact.html`
- `b871a56^:membership.html`
- `b871a56^:tools/seo-head.py`
- `d0ef8ea^:tools/seo-head.py`
- `d645180^:app.js`

~~~js
// Tests every pattern recorded in tools/DECISION-TABLE.md, reading the pattern and sample blocks from the table
// itself: on today's tree each must pass, and on each of its samples it must fail. A history sample must equal
// the lines of the revision it names (extracted beforehand into rev/ with `git show <rev>:<path>`).
//   node test.js <table.md> <repo root> <rev dir>
const fs = require('fs');
const path = require('path');

function parse(md) {
  const lines = md.split('\n');
  const pats = {}, samples = [];
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(/^```(pattern|sample)(?: (.*))?$/);
    if (!head) continue;
    const body = [];
    let j = i + 1;
    while (j < lines.length && lines[j] !== '```') body.push(lines[j++]);
    if (j >= lines.length) throw new Error(`unclosed block at line ${i + 1}`);
    if (head[1] === 'pattern') {
      const p = {};
      for (const l of body) { const m = l.match(/^(\w[\w-]*): ?(.*)$/); if (!m) throw new Error(`bad pattern line ${l}`); p[m[1]] = m[2]; }
      if (pats[p.id]) throw new Error(`duplicate ${p.id}`);
      pats[p.id] = p;
    } else {
      const [pid, src, mode] = head[2].split(' ');
      samples.push({ pid, src, file: mode === 'file', text: body.join('\n'), line: i + 1 });
    }
    i = j;
  }
  return { pats, samples };
}

function expand(root, globs) {
  const out = new Set();
  for (const g of globs.filter((x) => !x.startsWith('!'))) {
    if (g.includes('*')) {
      const dir = path.dirname(g), base = path.basename(g);
      const re = new RegExp('^' + base.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$');
      for (const f of fs.readdirSync(path.join(root, dir))) if (re.test(f) && fs.statSync(path.join(root, dir, f)).isFile()) out.add(dir === '.' ? f : `${dir}/${f}`);
    } else {
      if (!fs.existsSync(path.join(root, g))) throw new Error(`listed path missing: ${g}`);
      out.add(g);
    }
  }
  for (const g of globs.filter((x) => x.startsWith('!'))) out.delete(g.slice(1));
  return [...out].sort();
}

// Does a text meet the pattern (true) or break it (false)?
function meets(p, text) {
  const flags = p.flags || '';
  const re = new RegExp(p.regex, flags);
  const count = (text.match(new RegExp(p.regex, flags.includes('g') ? flags : flags + 'g')) || []).length;
  switch (p.kind) {
    case 'never': return { ok: !re.test(text), count };
    case 'always': return { ok: re.test(text), count };
    case 'count-eq': return { ok: count === Number(p.n), count };
    case 'count-max': return { ok: count <= Number(p.n), count };
    default: throw new Error(`unknown kind ${p.kind}`);
  }
}

function revFile(revDir, rev, file) { return path.join(revDir, `${rev}_${file.replace(/\//g, '_')}`); }

function run(md, root, revDir) {
  const { pats, samples } = parse(md);
  const results = {};
  for (const [id, p] of Object.entries(pats)) {
    const files = expand(root, p.paths.split(' '));
    const bad = [];
    for (const f of files) { const r = meets(p, fs.readFileSync(path.join(root, f), 'utf8')); if (!r.ok) bad.push(`${f} (${r.count})`); }
    results[id] = { files: files.length, tree: bad.length === 0, bad, samples: [] };
  }
  for (const s of samples) {
    const p = pats[s.pid];
    if (!p) throw new Error(`sample for unknown pattern ${s.pid} at line ${s.line}`);
    let text = s.text, copied = null;
    const m = s.src.match(/^([0-9a-f]{7,}\^?):(.+?)(?::(\d+)-(\d+))?$/);
    if (m) {
      const whole = fs.readFileSync(revFile(revDir, m[1], m[2]), 'utf8');
      if (m[3]) copied = whole.split('\n').slice(Number(m[3]) - 1, Number(m[4])).join('\n') === s.text;
      if (s.file) text = whole;
    } else if (!['constructed', 'composed'].includes(s.src)) throw new Error(`bad sample source ${s.src}`);
    const r = meets(p, text);
    results[s.pid].samples.push({ src: s.src, file: s.file, failsAsItMust: !r.ok, copied, count: r.count });
  }
  return results;
}

module.exports = { parse, run, expand, meets };

if (require.main === module) {
  const [md, root, revDir] = process.argv.slice(2);
  const res = run(fs.readFileSync(md, 'utf8'), root, revDir);
  let bad = 0, n = 0, s = 0;
  for (const [id, r] of Object.entries(res)) {
    n++;
    const sOk = r.samples.length > 0 && r.samples.every((x) => x.failsAsItMust && x.copied !== false);
    s += r.samples.length;
    if (!r.tree || !sOk) bad++;
    console.log(`${r.tree && sOk ? 'ok  ' : 'FAIL'} ${id}: today ${r.tree ? 'passes' : 'FAILS on ' + r.bad.join(', ')} (${r.files} files); ` +
      r.samples.map((x) => `${x.src}${x.file ? ' (whole file)' : ''} ${x.failsAsItMust ? 'fails' : 'PASSES'}${x.copied === false ? ' EXCERPT DIFFERS' : x.copied ? ', excerpt equal' : ''}`).join('; '));
  }
  console.log(bad ? `\nFAIL: ${bad} of ${n} patterns` : `\nPASS: ${n} patterns pass on today's tree and fail on all ${s} samples`);
  process.exit(bad ? 1 : 0);
}
~~~

## Counts and the gate

| | Decisions | 1, all | 1, part | 2, all | 2, part | 3 | Classes 1 and 2 | Of which all |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Made by the owner (A) | 53 | 9 | 8 | 4 | 22 | 10 | 43 of 53 (81%) | 13 of 53 (25%) |
| Reserved to the owner (B) | 11 | 0 | 1 | 0 | 4 | 6 | 5 of 11 (45%) | 0 of 11 (0%) |
| Both | 64 | 9 | 9 | 4 | 26 | 16 | 48 of 64 (75%) | 13 of 64 (20%) |

Superseded and not counted: 2.

**The gate** (plan, step 4.0): "Go ahead with 4.1, 4.2 and 4.5 only if at least half the decisions fall in the
first two classes." Counted as the plan words it, classes 1 and 2 hold 48 of the 64 decisions
(43 of the 53 made by the owner), so **the gate passes**. Counted strictly, with only the decisions a
guard holds all of, it is 13 of 64 (13 of 53), and on that count the gate would not pass:
35 of the 48 decisions in classes 1 and 2 are held in part, so the register would enforce some of
most of what it records, and the always-on list of step 4.3 keeps each of those (the plan: "A rule leaves the list
only when a guard holds all of it").

The plan's estimate was about 38 dated decisions, roughly a third in each class, and about as many undated. The table
counts 64 (53 made by the owner and 11 reserved to the owner), 27 of them with a day, and the split is
18 in class 1, 30 in class 2 and 16 in class 3.

The totals depend on where one decision ends and the next begins (A29 to A33 could be read as one brand-voice
decision, A35 to A38 as one calculator decision). The margin covers that: counted as the plan words it, the gate
would flip only with 33 more decisions in class 3.

## Never-patterns for decisions no check holds today

Of the 41 patterns, 23 must never match. These 21 protect a decision that no existing check holds
any of; they are the ones step 4.0 asks to be named (and, if the register is not built, the ones to put in
`publish.js`):

- P01, for A02 `liquid-glass`.
- P03, for A04 `silk-fluent`.
- P04, for A10 `hero-gap-96`.
- P05, for A13 `audience-switch-retired`.
- P07, for A15 `no-in-numbers`.
- P08, for A16 `no-experience-figure`.
- P09, for A17 `partnership-drawn-frames`.
- P11, for A18 `no-start-with-one-engineer`.
- P17, for A23 `no-visible-update-date`.
- P23, for A30 `firm-is-a-consultancy`.
- P24, for A33 `automotive-not-headline`.
- P25, for A34 `plan-removed-lines`.
- P27, for A39 `client-approvals`.
- P29, for A40 `cases-confidence-line`.
- P31, for A44 `team-projects-no-names`.
- P32, for A45 `no-headcount`.
- P34, for A49 `content-plan-pages`.
- P35, for A49 `content-plan-pages`.
- P36, for B01 `owner-text-pending`.
- P37, for B02 `no-named-person`.
- P41, for A52 `home-pictures`.

These 2 extend a decision that a check already holds, in full or in part, as side guards:

- P02, for A03 `silk-drawn-live` (class 1, all) and A06 `one-ambient-motion` (class 1, part).
- P21, for A27 `zh-hi-deleted` (class 1, part).
