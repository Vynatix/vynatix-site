// Hero background "sheet": clearance, contrast and registration guard for the home hero.
//
//   cd tools && BASE=http://localhost:8000/ THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark node verify/bg-sheet.js
//
// What it proves, per theme, at 390, 768, 1000, 1200, 1440 and 1920 wide (WIDTHS; from 1200 up also at text-only zoom
// 1, 1.25, 1.5 and 2, ZOOMS; below that at zoom 1, because the A-frame is only drawn from 75rem):
//   B  clearance   The art (A-frame, arcs, grid, rulers: everything the sheet draws except the headline's own row
//                  guides) keeps CLEAR px (24) away from every text line box in the header and the hero, and from the
//                  clients row. The art is found by pixel difference: the page with the sheet's headline guides hidden
//                  against the page with every sheet pseudo-element hidden, both through CSSOM rules inserted at run time.
//   C  contrast    With the text hidden, the pixels behind every hero text box (and, at five scroll offsets, behind the
//                  header links, where the art passes under the glass) give at least 4.5:1 against the text colour (3:1
//                  for the headline, held to HEADLINE_MIN = 3.5 here), and never more than SLACK (0.1) below the same
//                  page with the sheet hidden. Two groups are measured against their floor only, because the sheet is
//                  meant to be there: the headline (its guides run under the letters) and the header links at scroll
//                  offsets (the glass bar is translucent, so the art shows through it); the drop is still printed.
//   R  registration  The headline guides sit on the glyphs: the baseline and cap rules of every visual line of the h1
//                  (one or two roman lines, then the italic line) lie within TOL (1.25) px of the line's real baseline and cap
//                  height, the second roman line is exactly one line height below the first, the italic line is one
//                  line, and the rule is not drawn twice where the two sets coincide (Forest). Also that the hold
//                  distances in styles.css clear the real text ends by 24px.
// Exits non-zero on any failure. The page must be drawn as the sheet: the script pins { theme, bg: 'sheet' }.
// Needs Playwright and pngjs (tools/package.json has both).
const { BASE, THEMES, ALL_THEMES, pinTheme, launch, BGS } = require('./_common.js');
// BGS (like THEMES) narrows a run: this guard is for the "sheet" background only.
if (!BGS.includes('sheet')) { console.log('bg-sheet: skipped, BGS={} does not include sheet'.replace('{}', BGS.join(','))); process.exit(0); }
const { PNG } = require('pngjs');

const WIDTHS = (process.env.WIDTHS || '390,768,1000,1200,1440,1920').split(',').map(Number);
const ZOOMS = (process.env.ZOOMS || '1,1.25,1.5,2').split(',').map(Number);
const CLEAR = Number(process.env.CLEAR || 24);
const SLACK = Number(process.env.SLACK || 0.1);
const HEADLINE_MIN = Number(process.env.HEADLINE_MIN || 3.5);
const INK_MIN = Number(process.env.INK_MIN || 3);       // channel difference (of 255) that counts as ink
const SCROLLS = (process.env.SCROLLS || '0,150,300,450,600').split(',').map(Number);
const TOL = Number(process.env.TOL || 1.25);   // registration tolerance in px: a 2px rule snapped to the pixel grid is centred within 0.5px of its line, and the line itself may sit at a half pixel
const HEIGHT = 900;

const failures = [];
const fail = (msg) => { failures.push(msg); console.log('  FAIL ' + msg); };

// ---- page-side helpers (serialised, so they stay self-contained) -------------------------------------------------
// Text line boxes and keep-clear boxes, in page coordinates.
function collectBoxes() {
  const out = { header: [], hero: [], clients: null, groups: [] };
  const rectsOf = (root, label, large) => {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('.sr-only')) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter((q) => q.width > 1 && q.height > 1)
        .map((q) => [q.left + scrollX, q.top + scrollY, q.right + scrollX, q.bottom + scrollY]);
      if (!rects.length) continue;
      const size = parseFloat(cs.fontSize);
      out.groups.push({ label, color: cs.color, large: large || size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700), rects });
    }
  };
  const hero = document.querySelector('.hero');
  rectsOf(document.querySelector('.hero .eyebrow:not(.eyebrow--muted)'), 'eyebrow');
  rectsOf(document.querySelector('.hero__h1'), 'headline', true);
  rectsOf(document.querySelector('.hero__lede'), 'lede');
  document.querySelectorAll('.hero__ctas .btn').forEach((b) => rectsOf(b, 'buttons'));
  rectsOf(document.querySelector('.clients .eyebrow'), 'clients-label');
  document.querySelectorAll('.clients__item span:not(.sr-only):not(.clients__mark)').forEach((s) => rectsOf(s, 'client-names'));
  document.querySelectorAll('.site-header a, .site-header button').forEach((a) => { rectsOf(a, 'header-text'); });
  document.querySelectorAll('.hero__ctas .btn, .site-header .btn, .site-header button').forEach((b) => {
    const r = b.getBoundingClientRect(); out.hero.push([r.left + scrollX, r.top + scrollY, r.right + scrollX, r.bottom + scrollY]);
  });
  const c = document.querySelector('.clients').getBoundingClientRect();
  out.clients = [c.left + scrollX, c.top + scrollY, c.right + scrollX, c.bottom + scrollY];
  const h = hero.getBoundingClientRect(); out.heroBox = [0, h.top + scrollY, innerWidth, h.bottom + scrollY];
  return out;
}

// Text-only zoom, emulated through CSSOM: every hero font size is scaled, and so is the lede token.
function applyZoom(s) {
  const els = [...document.querySelectorAll('.hero, .hero *')];
  const sizes = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
  els.forEach((e, i) => e.style.setProperty('font-size', (sizes[i] * s) + 'px', 'important'));
  const lede = getComputedStyle(document.documentElement).getPropertyValue('--text-type-lede');
  document.documentElement.style.setProperty('--text-type-lede', lede.replace(/(\d+(?:\.\d+)?)px/, (m, v) => (parseFloat(v) * s) + 'px'));
}

// Insert (and later remove) a CSSOM rule that switches parts of the sheet off. Returns a function that undoes it.
function hideSheet(which) {
  const sheet = [...document.styleSheets].find((s) => /styles\.css/.test(s.href || ''));
  const sel = {
    all: '.hero::before, .hero::after, .hero__h1::before, .hero__h1 em::before',
    art: '.hero::before, .hero::after',
    guides: '.hero__h1::before, .hero__h1 em::before',
    text: '',
  }[which];
  const i = sheet.insertRule(`${sel} { content: none !important; }`, sheet.cssRules.length);
  return i;
}
function unhide(i) { const sheet = [...document.styleSheets].find((s) => /styles\.css/.test(s.href || '')); sheet.deleteRule(i); }
function hideText() {
  document.querySelectorAll('.hero, .hero *, .site-header, .site-header *').forEach((e) => {
    e.style.setProperty('color', 'transparent', 'important');
    e.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
    e.style.setProperty('text-decoration-color', 'transparent', 'important');
    e.style.setProperty('text-shadow', 'none', 'important');
  });
}

// Baselines and cap height of every visual line of the h1, and the sheet's own constants.
function headlineLines() {
  const h1 = document.querySelector('.hero__h1'); const em = h1.querySelector('em');
  const mk = () => { const i = document.createElement('i'); i.style.display = 'inline-block'; i.style.width = '0'; i.style.height = '0'; i.style.verticalAlign = 'baseline'; return i; };
  const p1 = mk(); h1.insertBefore(p1, h1.firstChild); const p2 = mk(); em.insertBefore(p2, em.firstChild);
  const baseR = p1.getBoundingClientRect().bottom + scrollY, baseI = p2.getBoundingClientRect().bottom + scrollY;
  const capOf = (el) => { const t = document.createElement('i'); t.style.display = 'block'; t.style.height = '1cap'; t.style.width = '1px'; el.appendChild(t); const v = t.getBoundingClientRect().height; t.remove(); return v; };
  const capR = capOf(h1), capI = capOf(em);
  const lines = [];
  const tn = []; const w = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT); while (w.nextNode()) tn.push(w.currentNode);
  tn.forEach((t) => {
    const inEm = !!t.parentElement.closest('em');
    for (let k = 0; k < t.length; k++) {
      const r = document.createRange(); r.setStart(t, k); r.setEnd(t, k + 1); const cr = r.getClientRects()[0]; if (!cr || !cr.width) continue;
      const top = cr.top + scrollY;
      let ln = lines.find((x) => x.em === inEm && Math.abs(x.top - top) < 3);
      if (!ln) { ln = { em: inEm, top, left: cr.left, right: cr.right }; lines.push(ln); }
      ln.left = Math.min(ln.left, cr.left); ln.right = Math.max(ln.right, cr.right);
    }
  });
  p1.remove(); p2.remove();
  const roman = lines.filter((l) => !l.em), ital = lines.filter((l) => l.em);
  const aR = baseR - roman[0].top, aI = baseI - ital[0].top;
  const cs = getComputedStyle(h1);
  const fs = parseFloat(cs.fontSize);
  const lh = parseFloat(getComputedStyle(h1, '::before').lineHeight) || parseFloat(cs.lineHeight);
  const holdR = getComputedStyle(h1, '::before').getPropertyValue('--sheet-hold').trim();
  const holdI = getComputedStyle(em, '::before').getPropertyValue('--sheet-hold').trim();
  return {
    fs, lh, capR, capI, holdR, holdI,
    roman: roman.map((l) => ({ base: l.top + aR, left: l.left, right: l.right })),
    ital: ital.map((l) => ({ base: l.top + aI, left: l.left, right: l.right })),
    h1Left: h1.getBoundingClientRect().left + scrollX,
  };
}

// ---- node-side helpers ------------------------------------------------------------------------------------------
const chan = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const rgb = (c) => c.match(/[\d.]+/g).map(Number);

function minContrast(png, groups) {
  const res = {};
  for (const g of groups) {
    const t = rgb(g.color); const lt = lum(t[0], t[1], t[2]);
    let worst = 99;
    for (const [x0, y0, x1, y1] of g.rects) {
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(png.height, Math.ceil(y1)); y++) {
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(png.width, Math.ceil(x1)); x++) {
          const i = (y * png.width + x) * 4; const c = ratio(lum(png.data[i], png.data[i + 1], png.data[i + 2]), lt); if (c < worst) worst = c;
        }
      }
    }
    const r = res[g.label] || (res[g.label] = { min: 99, need: g.large ? 3 : 4.5 });
    if (worst < r.min) r.min = worst;
  }
  return res;
}

function inkDistance(art, none, rects, w, h, limit) {
  // smallest distance from any ink pixel to any of the rects, searched only within `limit` px of each rect
  let best = Infinity, at = null;
  for (const [x0, y0, x1, y1] of rects) {
    const ya = Math.max(0, Math.floor(y0 - limit)), yb = Math.min(h, Math.ceil(y1 + limit));
    const xa = Math.max(0, Math.floor(x0 - limit)), xb = Math.min(w, Math.ceil(x1 + limit));
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
      const i = (y * w + x) * 4;
      if (Math.max(Math.abs(art.data[i] - none.data[i]), Math.abs(art.data[i + 1] - none.data[i + 1]), Math.abs(art.data[i + 2] - none.data[i + 2])) < INK_MIN) continue;
      const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1); const d = Math.hypot(dx, dy);
      if (d < best) { best = d; at = [x, y]; }
    }
  }
  return { best, at };
}

const shot = async (page, clip) => PNG.sync.read(await page.screenshot({ fullPage: true, clip }));

async function open(browser, theme, width, zoom) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT } });
  const page = await ctx.newPage();
  await page.addInitScript(pinTheme, { theme, bg: 'sheet' });
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const pinned = await page.evaluate(() => [document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-bg')]);
  if (pinned[0] !== theme || (pinned[1] !== 'sheet' && pinned[1] !== null)) throw new Error(`pinTheme did not take { theme, bg }: got data-theme=${pinned[0]} data-bg=${pinned[1]}`);
  if (zoom !== 1) await page.evaluate(applyZoom, zoom);
  await page.waitForTimeout(120);
  return { ctx, page };
}

(async () => {
  const browser = await launch();
  for (const theme of THEMES) for (const width of WIDTHS) {
    // ---- B and C, hero text, at every zoom ----
    for (const zoom of (width >= 1200 ? ZOOMS : [1])) {
      const { ctx, page } = await open(browser, theme, width, zoom);
      const boxes = await page.evaluate(collectBoxes);
      const clip = { x: 0, y: 0, width, height: Math.ceil(boxes.heroBox[3]) };
      const iAll = await page.evaluate(hideSheet, 'all'); const none = await shot(page, clip); await page.evaluate(unhide, iAll);
      const iGuides = await page.evaluate(hideSheet, 'guides'); const art = await shot(page, clip); await page.evaluate(unhide, iGuides);
      // B: clearance of the art from every text line box, every button and the clients row
      const textRects = boxes.groups.flatMap((g) => g.rects).concat(boxes.hero);
      const SEARCH = CLEAR + 100;
      const d = inkDistance(art, none, textRects, art.width, art.height, SEARCH);
      const dc = inkDistance(art, none, [boxes.clients], art.width, art.height, SEARCH);
      const tag = `${theme} ${width}px zoom ${zoom}`;
      if (d.best < CLEAR) fail(`${tag}: art ink ${d.best.toFixed(1)}px from a text line box at (${d.at})`);
      if (dc.best < CLEAR) fail(`${tag}: art ink ${dc.best.toFixed(1)}px from the clients row at (${dc.at})`);
      // C: contrast behind the hero text
      await page.evaluate(hideText);
      const withSheet = await shot(page, clip);
      const iAll2 = await page.evaluate(hideSheet, 'all'); const without = await shot(page, clip); await page.evaluate(unhide, iAll2);
      const heroGroups = boxes.groups.filter((g) => g.label !== 'header-text');
      const a = minContrast(withSheet, heroGroups), b = minContrast(without, heroGroups);
      const parts = [];
      for (const k of Object.keys(a)) {
        const waived = k === 'headline';
        const need = waived ? HEADLINE_MIN : a[k].need; const relOk = waived || a[k].min >= b[k].min - SLACK; const needOk = a[k].min >= need || b[k].min < need;
        parts.push(`${k} ${a[k].min.toFixed(2)}/${b[k].min.toFixed(2)}`);
        if (!relOk) fail(`${tag}: ${k} contrast ${a[k].min.toFixed(2)} is more than ${SLACK} below the plain page's ${b[k].min.toFixed(2)}`);
        if (!needOk) fail(`${tag}: ${k} contrast ${a[k].min.toFixed(2)} is below ${need} (plain page ${b[k].min.toFixed(2)})`);
      }
      console.log(`${tag}: nearest art ${d.best === Infinity ? '>' + SEARCH : d.best.toFixed(1)}px, clients ${dc.best === Infinity ? '>' + SEARCH : dc.best.toFixed(1)}px | contrast sheet/plain ${parts.join(', ')}`);
      await ctx.close();
    }
    // ---- header links under the glass, at several scroll offsets (zoom 1) ----
    {
      const { ctx, page } = await open(browser, theme, width, 1);
      const worst = { sheet: 99, plain: 99 };
      for (const s of SCROLLS) {
        await page.evaluate((y) => window.scrollTo(0, y), s); await page.waitForTimeout(60);
        const boxes = await page.evaluate(`(${collectBoxes.toString()})()`);
        const hdr = boxes.groups.filter((g) => g.label === 'header-text').map((g) => ({ ...g, rects: g.rects.map(([x0, y0, x1, y1]) => [x0 - 0, y0 - s, x1, y1 - s]) }));
        await page.evaluate(hideText);
        const vp = async () => PNG.sync.read(await page.screenshot());
        const withSheet = await vp();
        const i = await page.evaluate(hideSheet, 'all'); const without = await vp(); await page.evaluate(unhide, i);
        const a = minContrast(withSheet, hdr), b = minContrast(without, hdr);
        if (!a['header-text']) continue;   // phones: the header is a wordmark and icon buttons, there is no header text
        const am = a['header-text'].min, bm = b['header-text'].min;
        worst.sheet = Math.min(worst.sheet, am); worst.plain = Math.min(worst.plain, bm);
        if (am < 4.5 && am < bm) fail(`${theme} ${width}px scroll ${s}: header text contrast ${am.toFixed(2)} is below 4.5 (plain ${bm.toFixed(2)})`);
        await page.evaluate(() => document.querySelectorAll('.hero, .hero *, .site-header, .site-header *').forEach((e) => { e.style.removeProperty('color'); e.style.removeProperty('-webkit-text-fill-color'); e.style.removeProperty('text-decoration-color'); e.style.removeProperty('text-shadow'); }));
      }
      console.log(`${theme} ${width}px header text: ` + (worst.sheet === 99 ? 'none (icon buttons only)' : `worst contrast ${worst.sheet.toFixed(2)} (plain ${worst.plain.toFixed(2)}) over scrolls ${SCROLLS.join(',')}`));
      await ctx.close();
    }
    // ---- R: registration of the headline guides (zoom 1) ----
    {
      const { ctx, page } = await open(browser, theme, width, 1);
      const L = await page.evaluate(headlineLines);
      const tag = `${theme} ${width}px`;
      if (L.ital.length !== 1) fail(`${tag}: the italic line wraps into ${L.ital.length} lines; its guides assume one`);
      if (L.roman.length > 2) fail(`${tag}: the roman row wraps into ${L.roman.length} lines; the guides cover two`);
      if (L.roman.length === 2 && Math.abs(L.roman[1].base - L.roman[0].base - L.lh) > 0.6) fail(`${tag}: second roman line is ${(L.roman[1].base - L.roman[0].base).toFixed(2)}px below the first, line height is ${L.lh}`);
      const em = (v) => parseFloat(v) * L.fs;
      const originR = L.h1Left - 0.25 * L.fs;
      const gap = Math.min(CLEAR, 0.25 * L.fs);   // 24px at the 96px headline, in em below that
      for (const l of L.roman) if (l.right + gap > originR + em(L.holdR)) fail(`${tag}: roman text ends at ${l.right.toFixed(0)}px, the guide hold (${L.holdR}) ends at ${(originR + em(L.holdR)).toFixed(0)}px`);
      for (const l of L.ital) if (l.right + gap > originR + em(L.holdI)) fail(`${tag}: italic text ends at ${l.right.toFixed(0)}px, the guide hold (${L.holdI}) ends at ${(originR + em(L.holdI)).toFixed(0)}px`);
      // pixels: the guides alone, a few px right of each line's end (inside the hold, where no glyph is)
      const boxes = await page.evaluate(collectBoxes);
      const clip = { x: 0, y: 0, width, height: Math.ceil(boxes.heroBox[3]) };
      const i1 = await page.evaluate(hideSheet, 'all'); const none = await shot(page, clip); await page.evaluate(unhide, i1);
      const i2 = await page.evaluate(hideSheet, 'art'); const guides = await shot(page, clip); await page.evaluate(unhide, i2);
      const band = (x, y0, y1) => { // rows of ink at column x, as { rows, mass, centre }
        let rows = 0, mass = 0, wsum = 0;
        for (let y = Math.max(0, Math.floor(y0)); y < Math.min(none.height, Math.ceil(y1)); y++) {
          const i = (y * none.width + x) * 4; const dv = Math.max(Math.abs(guides.data[i] - none.data[i]), Math.abs(guides.data[i + 1] - none.data[i + 1]), Math.abs(guides.data[i + 2] - none.data[i + 2]));
          if (dv >= INK_MIN) { rows++; mass += dv; wsum += dv * (y + 0.5); }
        }
        return { rows, mass, centre: mass ? wsum / mass : NaN };
      };
      const masses = {};
      const all = L.roman.map((l, k) => ({ ...l, cap: L.capR, name: 'roman ' + (k + 1) })).concat(L.ital.map((l) => ({ ...l, cap: L.capI, name: 'italic' })));
      for (const l of all) {
        const x = Math.min(width - 2, Math.round(l.right + 14));
        const baseBand = band(x, l.base - 4, l.base + 4);
        const capBand = band(x, l.base - l.cap - 2.2, l.base - l.cap + 3);
        const dBase = Math.abs(baseBand.centre - l.base), dCap = Math.abs(capBand.centre - (l.base - l.cap));
        masses[l.name] = baseBand.mass;
        if (!(dBase <= TOL)) fail(`${tag}: ${l.name} baseline rule centre is ${baseBand.centre.toFixed(2)}, the baseline is ${l.base.toFixed(2)}`);
        if (!(dCap <= TOL)) fail(`${tag}: ${l.name} cap rule centre is ${capBand.centre.toFixed(2)}, the cap line is ${(l.base - l.cap).toFixed(2)}`);
        if (baseBand.rows > 3) fail(`${tag}: ${l.name} baseline rule is ${baseBand.rows} rows thick (drawn twice?)`);
      }
      if (masses['italic'] && masses['roman 1'] && (masses['italic'] / masses['roman 1'] > 1.2 || masses['italic'] / masses['roman 1'] < 0.8)) fail(`${tag}: italic baseline rule weighs ${(masses['italic'] / masses['roman 1']).toFixed(2)}x the first roman one`);
      console.log(`${tag}: ${L.roman.length} roman line(s) + italic; guides registered to the glyphs within ${TOL}px`);
      await ctx.close();
    }
  }
  await browser.close();
  if (failures.length) { console.log(`\nbg-sheet: ${failures.length} failure(s)`); process.exit(1); }
  console.log('\nbg-sheet: ok');
})().catch((e) => { console.error(e); process.exit(2); });
