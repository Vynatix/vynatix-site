# Hero background

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Hero background.** The English home page's hero carries one decorative background,
the headline's drafting sheet. It is art, not content: no text, role or focus,
`pointer-events: none`, an empty `content`, behind or clear of every text box, and off
under forced colours, more contrast and print. Until 20 November 2026 it was one of
four, drawn at random for each visit (a woven cloth, a vernier dial and an iris were the
others). The owner kept the sheet, and the other three went with everything the draw
needed: `data-bg` on `<html>`, the `vynatix-bg`, `vynatix-bg-seed` and `vynatix-bg-iris`
keys in `sessionStorage`, `hero-bg.js`, the iris's markup in `index.html`, the dial's
masks and the guards of each. `publish.js` fails if `hero-bg.js`, `data-bg` or a
`vynatix-bg` key comes back.

- **Where it lives.** `hero-bg.css`, which only `index.html` links, after `styles.css`, so
  no other page downloads it. It carries a version stamp (`stamp.js`).
  There is no script, no storage and no markup for it, so the page is the same with and
  without JavaScript (`bg-sheet.js` compares the two pixel for pixel).
- **The rules.** Every rule on the hero carries `:lang(en)`, so the Swedish hub would be
  untouched even if it linked the file. Colours are role tokens and `color-mix()` on them
  only (no hex, no palette token, no `!important`, no `[data-theme]`, no inline
  `style=""`), custom properties are `--sheet-*`, there is no animation, transition or
  keyframe, and the two assets are `assets/bg-sheet-*.svg`, named by `url()` behind the
  75rem media query, so they are requested only at the widths that draw them.
  `publish.js` enforces all of this from the source.

*The sheet* (two assets, 75rem and up). Pure CSS: no script, no storage, no
motion. Row guides: `.hero__h1::before` and
`.hero__h1 em::before` are zero-net-width inline-blocks whose bottom edge is the
row's baseline (`1cap` is the face's cap height), at `z-index: -2` in opaque colours;
each carries one set of guides, because the roman row is one word ("Engineering") and one
line, and the second is the italic line's own set, with the bronze baseline. A roman row
that can wrap needs a second set at `+1lh` again (the headline before this one had it; in
Monochrome the roman and italic faces have different cap heights, so two sets that land on
one line draw it twice, and `bg-sheet.js` fails on the weight). Art: `.hero::before` (neutral: the tick scale under the
header, the right-edge scale limited to the gutter, and from 75rem the A-frame, arcs
and grid from `assets/bg-sheet-art-2.svg`) and `.hero::after` (the bronze edge and apex
mark, `assets/bg-sheet-edge-2.svg`, not generated below 75rem) are alpha masks of
87.5em by 50em anchored at `calc(50% + 40em - 576px)`, so they follow text zoom.
Phones (under 600px) drop the dashed guides and shorten the ruler. Off under forced
colours, more contrast and print; it is never removed by width (only the A-frame is
left out below 75rem) and it has no reduced-transparency rule. Hand-fitted:
`--sheet-hold` 11em (roman) and 6.9em (italic), kept 0.25em clear of the real text
ends, `--sheet-lo` 30%, `--sheet-up` 0.04em, `--sheet-down` 0.21em, `--sheet-rise`
1.4em, the A-frame drawn with its apex at (1005, 325), its feet at 850 and 1160 and its
datum at 708 in container units of its own frame, and shown 168 units higher (`lift`), so
that in the hero the apex is at 157, on the first headline line's cap line, and the datum
at 540, level with the foot of the buttons (the buttons keep their size, so on a scaled hero
the feet stand up to 5px higher); the arcs' radii 118, 215 and 312, the grid's
origin. The generator is `tools/sheet-art.js` (it reproduces the shipped files); its
numbers also live in `hero-bg.css`, and the sheet's guard, `bg-sheet.js`, reads the
apex and datum from the shipped art file.

**The headline copy drives the geometry, and the guard says when it moves.** The art is
not placed with pixels from the page's corner: it hangs on the layout of the hero as it
is (the headline's lines, the end of its first line, the container's edges). The
headline is "Engineering" with the italic "that compounds." on its own line, 96px from
about 1200px up: two lines, with two lines of lede under them. The A-frame was drawn for
the headline before this one ("Your in-house software team." / "Without the hiring.",
three lines over six of lede), with its apex on that message's second baseline. When the
headline changed it kept that place, and from 20 November 2026 it hung about 170 units
below the shorter message's buttons, which the owner saw on 24 November as the art having
slipped down. It is now lifted 168 units (`lift` in `tools/sheet-art.js`; the art files
were renamed `bg-sheet-art-2.svg` and `bg-sheet-edge-2.svg`): the drawing itself is unchanged, its apex mark sits on the first
line's cap line, its datum is level with the foot of the buttons, and the italic line's
bronze baseline crosses it like the bar of an A. The room the art used to hang into (from
1100px the clients' rule stood 336 units under the buttons instead of 96, kept by the owner
on 20 November 2026 when the art was left where it was) went with it, on the owner's word of
24 November 2026: the English hero has the plain hero's 96 under its buttons at every width
(`--hero-gap`, see *Hero fit*), so the message is larger in a short window and the client row
joins the first screen from 864px of height. Only enlarged text still needs room: the art is
drawn in em and grows from the text column's left edge, so from 75rem the room under the
buttons grows by 14px for each pixel of the hero's em over 16 (nothing at the default size);
without it the A-frame's feet reach the clients' rule at 125 percent in a 790px window.
**A change to the headline, the lede (its words or its measure), the hero's spacing, the
clients row or a typeface can move the art into the text, or leave it hanging away from
it.** Run `npm run check:bg` after any such change: the guard fails and names the rule
(clearance, contrast or registration, which includes the A-frame's apex on the first cap
line and its datum within 24 units of the foot of the buttons), and the sheet's constants
(`lift` first) are the ones to refit. The constants are
written in the hero's unit (`calc(N * var(--hero-u))`, see *Hero fit*): the numbers in
this section are their values at the design size, which a window 1248px high or taller
shows.

**Guards.** `tools/verify/bg-sheet.js` proves clearance (the nearest art ink is 24px or
more from any text line box, button, header link or the clients row, with text-only zoom
emulated), contrast (the pixels behind every hero text box with the text hidden: 4.5:1,
3:1 for the headline, no lower than the plain page's own by more than 0.1 except where
the art is meant to sit under text), registration (the guides on the glyphs, and from
1200px the A-frame beside the message: its apex, read from the art file, on the first
line's cap line within 1.25px, its datum within 24 units of the foot of the buttons; at the
default text size, because with the text alone enlarged the art grows from the hero's top
and stands lower, where clearance is what is required), removal
under forced colours and more contrast, and assets (the two masks requested from 1200px
up only and by the home page only, the hero pixel-identical with and without
JavaScript, no `data-bg`). It runs in a 1248px-high window, the design size; `bg-fit.js`
runs it again on a scaled hero (see *Hero fit*), and a distance it compares (the 24px)
is multiplied by the hero's unit first. `npm run check:bg` runs the two alone, and both
are in `npm run check`. `publish.js` adds the static rules above, and `a11y.js` the
reduced-motion proof on the home page (nothing animates, by CSS or by the Web
Animations API, with the sheet drawn). The clearance captures leave the client marks out: a mask's edge
rasterizes a few levels differently with and without the sheet's layers in the hero, which
is not art.

**Bronze budget.** The hero already spends Bronze (the accent text colour) on the italic
line of the headline. The sheet adds a bronze second baseline under it, a measured edge and
an apex mark. The owner accepted this.

**Measured costs and known limits** (Chromium only, no Safari, Firefox or real devices).
`hero-bg.css` is about 3.1 KB gzip, paid by the home page only; no other page carries
anything for the hero background. The backgrounds were first built into `styles.css` and
`app.js`, and that cost every page 14.5 KB gzip: on a cold cache over slow 4G with the CPU
throttled 4x, the first and largest paint of a page other than the home page rose by 64 to
100 ms, which is why the hero background has its own file. Fetching the two masks costs the
home page 50 to 95 ms on a desktop at 4x CPU. The sheet's headline guides come within about
30px of the lede at the nearest row guide, and its art within 41.5px of any text.

**Changing it.** New art for the sheet comes from `tools/sheet-art.js` (new file names,
never reused: the two names in the script, the `url()` in `hero-bg.css` and the `ART` list in
`bg-sheet.js` change with it; the guard reads the apex and datum from the art file), then
`npm run stamp` and `npm run check:bg`. A second background, a draw between several or
anything that moves is a new owner decision, not a refactor: the draw stored keys the
notices had to list, and the site's one ambient motion is the silk (see *JavaScript*).
Without `hero-bg.css` the hero has no background at all, on a page with or without
script.
