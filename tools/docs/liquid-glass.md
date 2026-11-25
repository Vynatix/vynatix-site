# Liquid Glass

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Liquid Glass.** The site follows Apple's Liquid Glass as far as the web allows (an
owner decision of 18 November 2026; a first pass on the 17th put frosted glass on the
content cards over a tinted backdrop, which Apple's own rules exclude, and was
replaced). One fenced block of `styles.css`, "Liquid Glass". The rules it follows:

- **Glass is the controls layer; content is never glass.** Pages, cards (`.panel`,
  `.metric`, `.case`) and the consent bar keep the system's solid surfaces.
  Only the header, its open menu and the outlined button are glass. The glass
  refracts the content that scrolls beneath it and the silk behind (*Silk waves*).
- **The header is a floating capsule in two layers**, both pseudo-elements under its
  content. `::before` is the lens: `backdrop-filter: url(#vx-lens)` bends the page at
  the capsule's rim through an SVG displacement map (`assets/glass-lens-wide.svg`,
  and `glass-lens-narrow.svg` with `#vx-lens-narrow` under 600px; red moves the
  sample along x, green along y, 128 is rest, and the filter stretches the map to the
  bar with `primitiveUnits="objectBoundingBox"`). `::after` is the body: a 10px blur,
  the system tint thinned to about 64%, a sheen and a lit rim. Only Chromium renders
  an SVG filter in `backdrop-filter`; Safari and Firefox paint nothing for the lens
  layer and still get the blurred, tinted capsule from the other, which is why the
  two are separate layers rather than one declaration.
- **The two `<filter>` elements are in the `.svg-defs` block of every page**, beside
  the wordmark `<symbol>` (copy-pasted, like it: change all 34 together). A
  fragment-only `url(#id)` in an external stylesheet resolves against the page, and
  the CSP allows the map as a same-origin image.
- **The header is not a backdrop root.** A stacking context alone is not one; only
  `filter`, `opacity`, `mask`, `clip-path`, `mix-blend-mode` or `backdrop-filter` on
  the element itself make one. Keeping the glass on pseudo-elements lets the open
  mobile menu, inside the header, blur the page as its own glass sheet (the regular
  blur and a tint about nine tenths opaque, so its links stay readable even where a
  browser fails to blur).
- **Controls are capsules** (`radius-full`): the header and every `.btn`. The filled
  button keeps its solid fill with a lit upper edge; `.btn--secondary` is clear
  glass. Without JavaScript under 905px the header is two rows tall and takes
  `radius-2xl` instead.
- **The glass does not move.** Apple's glass has travelling highlights and a tint that
  adapts to what is beneath it; here the rim and tint are still. (The silk behind the
  page drifts; that is its own decision, with its own pause control.)
- **Reduced transparency and print**: the lens layer goes, the body turns into solid
  `surface-container`, the menu and outlined button lose their blur. These are
  explicit overrides, because literal blur values and a tint thinned with
  `color-mix()` are not covered by the system's token swap.
- **Contrast**: `a11y.js` resolves header text against the canvas, not the glass. A
  composited measurement (labels made transparent, 5th-percentile pixel behind each
  label, every 37px of scroll down five pages, both themes, 1440 and 390px) gave a
  worst case of 5.2:1 for header labels and 11:1 for menu links when the block was
  added. `bg-*.js` hold the header over the hero art. Re-measure by hand when the
  tint, the blur or the map changes.
- **Known limits**: no refraction outside Chromium; headless Chromium at device
  scale 2 leaves part of a large backdrop blur unblurred in screenshots (scale 1 is
  correct), so judge blur on a real device.
