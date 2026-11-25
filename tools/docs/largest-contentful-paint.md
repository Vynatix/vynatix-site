# Largest contentful paint

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Largest contentful paint.** On every page the LCP element is the opening
paragraph (the hero lede, or the page hero's). It paints in the fallback face as
soon as the stylesheets arrive, so `font-display: swap` keeps fonts out of the real
LCP: measured on a throttled phone, LCP equalled first paint on each of the 20 pages the site
had when this was written (19 October 2026). What is
left is render work and, in Lighthouse's simulated score, font bytes.

- On the two home pages `.hero ~ section` carries `content-visibility: auto`
  (`styles.css`, *Sections*), which takes about 100 ms off a throttled phone. Do not
  widen it to the inner pages without checking: axe-core misreads the background
  behind text in a skipped section, and Lighthouse accessibility fell from 100 to
  92-96 on those pages. `screenshot.js` shows every section before it captures, so
  the visual gate compares the design and not the browser's remembered heights.
- Lighthouse's simulated LCP counts the fonts that finish before first paint.
  Forest and Monochrome fetch about 280 KB of Fraunces for the hero headline (Teal
  about 45 KB of Instrument Serif), so PageSpeed Insights shows a worse LCP when
  they draw: in single live runs about 3.0 s (Forest) and 2.1 s (Monochrome)
  against 1.6 s (Teal). Closing the gap means re-cutting the Fraunces files, which
  is a typography decision (see *Assets*). Dropping the preloads and moving `app.js`
  above the stylesheets were both measured and gained nothing.
- Inline critical CSS is not an option: `style-src 'self'` forbids it.
