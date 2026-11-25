# Hero fit

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Hero fit.** When a home page loads, the first screen is the hero: the header and the hero's
message (eyebrow, headline, lede, buttons) fill the window, whatever its size, and the hero
scales with the window's height to do it. An owner decision ("the hero
should always scale to fit the browser screen when it loads"). Both home pages, `styles.css`,
"Hero fit". No script, no new motion, nothing stored.

- **One unit.** The hero is drawn in `--hero-u`, one design pixel: a registered length, `1px`
  at the design size. Its padding, its gaps and the headline and lede sizes are
  `calc(N * var(--hero-u))`, where N is the token the comment beside it names (a length cannot
  multiply a length, so these are numbers, not `var(--space-*)`). The eyebrow and the buttons
  keep their size at every scale and the lede never goes under `--text-body-lg` (18px; 16px
  on a phone). `hero-bg.css` multiplies the sheet's constants by the same unit (the
  24px gaps, its rulers and its em through `--hero-em`), so the art keeps its place against the text as the hero scales.
  The sheet's art hangs from the content's right edge and grows from its left when the text
  alone is enlarged (`--hero-em0`), and `--sheet-drop` keeps its apex on the first headline line's cap
  line, because the eyebrow's line does not scale.
- **The solve.** With every vertical size a multiple of the unit, the hero's height is a
  straight line in it, so `u = (100svh - what stands above the hero - fixed) / slope`.
  `--hero-above` is the header's bottom edge (78px). There are
  two lines per page (`--hero-f1`/`k1` while the lede scales, `f2`/`k2` once it has stopped at
  its floor; `min()` picks) and, under 1200px, a second pair for a headline that is as wide as
  the window allows (`--hero-h`, `--hero-hw`; `max()` picks). The English hero has a third line,
  `--hero-wf`/`--hero-wk`, for the whole hero with its client row. The numbers are measured facts
  about the current copy: two headline lines and two lede lines in English, two and five in
  Swedish. The English hero's `--hero-gap` is the plain hero's 96 at every width: until 24
  November 2026 it was 336 from 1100px, the room the sheet's A-frame hung into, and the slopes
  carried the extra 240; the art now stands beside the message and the room is gone (see *The
  headline copy drives the geometry*). From 75rem the gap still grows by 14px for each pixel of
  the hero's em over 16 (`--hero-em0`): the art is drawn in em and this message has few lines to
  grow, so with the text alone enlarged the A-frame's feet would otherwise reach the clients' rule
  (at 125 percent in a 790px window). At the default text size the term is zero and the lines are
  untouched. **A change to the headline, the lede, a typeface, the header's height or the hero's
  spacing moves them**: `tools/verify/hero-fit.js` (check M) fails, prints the measured height
  and names the pair to refit; `node tools/verify/hero-fit.js --write` refits the ten numbers
  it measures (see *Refitting* below).
- **Three states, by the window's height.** *Message*: the message is fitted and the clients'
  rule lies on the fold, so the client row starts the scroll and is never cut half way
  (`.hero__msg`, the wrapper round the message in `index.html`, takes the first screen's
  height; the Swedish hub has no client row, so its hero ends on the fold with the message
  centred). The English message is short, so where the window is taller than it needs the
  spare room is under the buttons. At 1440px wide: 96px headline from about 710px of window
  height (at 790 that leaves 80px spare above the plain 96), 86px at the envelope's lower edge.
  *Whole*: from 864px of height at 1024px and wider (1000px on a tablet held upright, at the
  design size) the unit is solved for the whole hero (never under 0.82: 79px headline at 864,
  84px at 1440 by 900), so the hero ends on the fold; from 975px that is the design size and the
  row is not pinned: it follows the buttons at the plain 96 and the next section starts on the
  first screen, never an empty band above the rule (the owner's word of 25 November 2026). *Natural*: outside the envelope the hero is the plain scrolling hero at the design
  size.
- **The envelope.** The fit applies from 650px of window height at 600px and wider and from
  520px on a phone, inside `@supports (height: 100svh) and (transition-behavior:
  allow-discrete)` (the second stands for registered custom properties, as in `hero-bg.css`).
  It is for screens only (paper has no fold), and without JavaScript at 904px and narrower the
  hero is the plain one, because the header there is not sticky and lists its links, so it is
  taller than `--hero-above`.
  A lower window is where browser zoom lands (a 1440 by 900 window at 200 percent is 720 by
  450), so zooming in always ends at full-size text. `min-height` only, never `height` or
  `overflow`: enlarged text, a longer translation or a fallback font make the hero taller
  than the window and it scrolls; nothing is clipped.
- **Known limits.** A short phone window (the small viewport of a 375 by 667 phone and under) has more
  message than fits: the hero is as compact as its floors allow (headline 31px) and the buttons
  can sit under the fold. Between 600 and 799px the English lede wraps by the window (767px on
  the Swedish hub), so the unit comes out a little small and the message fits with room to spare.
  Between about 710 and 863px of height (1024px and wider) the English message is at the design
  size and shorter than the window, so up to about 150px spare stands under its buttons, above the
  plain 96, until the client row joins the first screen at 864px. Inside the envelope the
  headline is sized by the window, so browser zoom between 100 percent and the envelope's edge
  enlarges the lede but not the headline (a 2560 by 1440 window leaves the envelope at about
  220 percent).
- **Checks.** `hero-fit.js` proves the lines against measurement (M), the fold at a table of
  real windows on both home pages (F), the envelope's edges and browser zoom (E) and the
  `@supports` gate (S). The sheet's guard runs its full sweep in a 1248px-high
  window (the design size, client row included) and `bg-fit.js` runs each again at 650, 790,
  864 and 900px, where they multiply their own distances by the unit they read from the page
  (`heroUnit` in `_common.js`). Both are in `npm run check`.
- **Refitting.** `node tools/verify/hero-fit.js --write`, run by hand and never in `npm run check`,
  solves each line M proves from the same two measurements M holds it to (`LINES` in the
  script): the slope per unit rounded to a whole number, then the fixed part that slope leaves,
  averaged over the two and rounded to a whole pixel. On the pinned browser that gives back every
  committed number exactly, which is the condition it was introduced on. It writes a line only
  when M fails for it with the committed numbers (two of today's slopes, 489.53 and 457.58, are a
  sixty-fourth of a pixel or two from rounding the other way, so another browser build could
  solve a different number for a line that still passes), prints the solved and the committed
  numbers for every line, then runs the whole check on the file as written. It writes the ten
  numbers of the three lines measured at 1440px: `--hero-f1`/`k1` and `f2`/`k2` on both home
  pages and `--hero-wf`/`wk` on the English one. The other sixteen numbers of the block stay a
  person's: the eight of the two phone lines (under 600px the lede wraps by the window, so its
  line count moves with the unit and there is no straight line to measure), the three floors
  (`--hero-min`), `--hero-above`, and `--hero-h` and `--hero-hw` on both rules; so do the
  heights of the states in the media queries. M has no row for the phone lines, and F and E
  cannot see a line that makes the hero too short (`min-height` stretches it to the fold, so the
  hero only comes out smaller than it could be): "hero-fit: ok" after a write vouches for the
  ten numbers written, not for those sixteen. It writes nothing when `BASE` does not serve this
  tree's two home pages and stylesheets, when a pair is not on a line of its own in its rule or
  when the numbers in force at 1440px are not the ones in that rule, and nothing for a page whose
  headline or lede is not two lines, which is a new model and not a refit. After a write, run
  `npm run stamp` (`styles.css` changed) and `npm run check:bg`.
