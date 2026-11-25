# Silk waves

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Silk waves.** Behind every page is a silk background whose folds are drawn live
(owner decisions of 18 November 2026: an ambient background, then "dynamic, not an
animated static image"). It is the site's one ambient loop. Two parts:

- **The still silk** (`styles.css`, after the Liquid Glass block): two fixed layers,
  `body::before` (lit folds, `surface-bright`) and `body::after` (shaded folds,
  `surface-container-highest` with 8% of `on-surface`), each shaped by a small image
  mask (`assets/silk-light.png`, `assets/silk-shade.png`, 480x300, written by
  `tools/silk-masks.js`; only the alpha is used) plus a 128px grain mask
  (`assets/silk-grain.png`) that dithers away colour banding. The canvas colour stays
  on `<body>`, so `a11y.js` still resolves the background behind text.
  `.section--surface` is 55% opaque so the silk runs through the tonal bands; cards,
  inverse bands and the footer are solid. **This is every state but one**: no
  JavaScript, reduced motion, forced colours, a stored pause, no WebGL, a lost WebGL
  context. They all paint the same pixels.
- **The live silk** (the fourth IIFE of `app.js`): when motion is wanted, a
  `<canvas class="silk-canvas" aria-hidden="true">` is inserted as the first child of
  `<body>` and a small WebGL fragment shader draws the folds on every frame the display
  offers (the owner asked for motion "fluent as liquid"; an earlier 30 fps cap read as
  stutter): two sine fields, lit where their sum is high and shaded where it is low,
  drawn in a space bent by three passes of warping, each finer and on its own slow
  beat, so the cloth swirls and pours instead of sliding past. Its three
  colours are read from the page (the body's background and the two still layers'
  own, parsed from `rgb()` or `color(srgb …)`) and re-read when `data-theme` changes,
  so it has no colour of its own. The last lines of the shader add up to one level of
  noise per pixel, which is its dither. Every time term is a whole multiple of one
  angle taken from the clock (a four-minute loop), so the pattern has no seam and
  carries on across pages instead of restarting. The drawing buffer is capped at 1.3
  million pixels and never uses the device pixel ratio. **It answers the visitor**
  (owner request): the cloth gives way softly around the pointer (a Gaussian press
  about a third of the view across, which also lifts the cloth into the light, so it
  shows on a flat stretch too) and rides with the scroll at about a
  fifth of its speed. Both are eased in the frame loop by elapsed time, so they feel
  the same at 60 and 120 Hz and nothing jumps; the
  listeners (`pointermove`, `scroll`, `pointerleave`, `blur`, all passive) exist only
  while the canvas does. Phone tilt is not used: it needs a permission prompt. The still layers are hidden
  (`.js-waves-live`), not removed, because the colours are read from them. Drawing
  starts after the page is up, never in the blocking head.
- **The pause control** is a `<button class="motion-toggle">` in the footer's Legal
  list (`tools/templates/footer.html`), labelled "Pause background
  motion" or "Play background motion", hidden until `.js-motion` and absent under
  reduced motion and forced colours. Pressing it stops the frame loop, removes the
  canvas and shows the still silk. The choice is `localStorage` `vynatix-motion` (`off`
  or `on`; any other value means moving), named in both notices. **The loop and the
  button go together**: WCAG 2.2.2 requires a way to stop motion that starts by itself
  and lasts more than five seconds, and `accessibility.html` says where the button is.
  Where WebGL is refused the button is hidden too (no dead control); after a lost
  context it reads "Play" and starts a fresh canvas. A header placement would need
  pause and play icons from the design system's set, which has none today.
- **Checks.** Every check opens its pages with the pause stored (`stillSilk` in
  `_common.js` wraps `launch()`, and `pinTheme` stores it too): software WebGL
  is heavy enough to disturb timing tests, and a frame loop is what the at-rest tests
  forbid. `tools/verify/waves.js` alone asks for the live silk
  (`launch({ liveSilk: true })`) and covers: a first visit draws on every page; frames
  2 s apart differ visibly; no colour banding, live or still; the colours are the
  page's own in both themes and follow a toggle mid-run; with the clock frozen the
  picture holds, changes near the pointer and not at the far edge, and changes on
  scroll; the button stops and resumes
  by keyboard and the choice persists; reduced motion and a stored pause ask for not
  one frame; no JavaScript; the four still states are pixel-identical; poisoned and
  blocked storage; WebGL refused; a lost context. Text contrast was measured against
  composited pixels over the live silk (twelve pages, both themes, 1440 and 390 px):
  all at AA. The shader's tones are bounded by the same three colours as the still
  silk. Re-measure when a tone or the shader's mix changes.
- **Cost.** One full-screen fragment shader at the display's frame rate, plus the header's lens
  and blur re-running over it. Not measured on real devices; rAF stops in a hidden
  tab.
- **The home hero.** The silk runs behind the English home hero and its drafting
  sheet (owner decision). The sheet's guides are faint by design, and where a
  fold passes behind one it fades, in places entirely; that unevenness is accepted.
  `bg-sheet.js` therefore measures registration (R) with the still silk hidden
  (`hideSilk`); its clearance and contrast checks run with the still silk in the
  page. It never sees the live silk.
- **The hero buttons have their own layer** (`.hero__ctas .btn { will-change:
  transform; }`). Over a backdrop that is not flat, Chromium anti-aliases a capsule's
  edge against the true backdrop in one compositing path and against the flat canvas
  colour in another, and the path depends on what else is composited. The edge
  pixels then differ by 6 to 12 levels, a faint halo for a visitor (first caught by
  the guard of the iris background, since removed). A layer of their own makes it
  one path.
- **History.** First the still layers themselves were animated with `transform`: too
  slow to see at 84px in 38 s, then a visible circular drift, which the owner rejected
  as "an animated static image"; the shader replaced it. A tinted radial backdrop was
  tried on the 17th and failed the iris background's guard (the capsule-edge effect above). The masks
  were first SVGs, whose blur stalled a theme toggle for a third of a second.
