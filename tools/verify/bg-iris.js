// Hero background "iris": clearance, contrast and placement guard for the home hero.
//
//   cd tools && BASE=http://localhost:8000/ THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark node verify/bg-iris.js
//
// What it proves, per theme, with the page drawn as the iris (the script pins { theme, bg: 'iris' }):
//   B  clearance   The art (the disc, its scales, the lit arc, the inner dial, everything .iris draws) keeps CLEAR px (24)
//                  away from every text line box in the header and the hero, and from the clients marks. The art is found by
//                  pixel difference: the page with .iris shown against the page with it hidden. Run at every width in WIDTHS
//                  at zoom 1 (from 1200 up, so the gate at 1280 is covered from both sides) and, at ZOOM_WIDTHS, at the
//                  text-only zooms in ZOOMS, emulated by scaling every hero font size (and the lede token) through CSSOM.
//                  Also at the event frames (the inner dial seeked to 0.3, 0.9, 1.8 and 2.8 s), where no ink may come nearer.
//   C  contrast    With the text hidden through element.style.visibility, the pixels behind every hero text box give at
//                  least 4.5:1 against the text colour (3:1 for the headline), and never more than SLACK (0.1) below the same
//                  page with .iris hidden. The header links and buttons are measured at five scroll offsets, because the art
//                  passes under the translucent glass bar when the page scrolls, held to the same two tests as the hero text on
//                  the group minimum (the lowest value any link has at any offset), with the largest drop of a single link printed.
//                  Waiting, settled and event frames.
//   P  placement   The numbers fitted by hand still hold: the art hangs on the clients rule (its bottom edge is the rule's
//                  top edge), its left edge is at least a page margin right of the lede box, the disc runs off the right edge
//                  of the window by between BLEED_MIN and BLEED_MAX of its width (so it never kisses the edge or floats
//                  free), and the index mark's radial line passes within AIM px of the end of the italic line at the widths
//                  where the disc hangs on the column (AIM_WIDTHS).
// Exits non-zero on any failure. Needs Playwright and pngjs (tools/package.json has both). Environment: BASE, THEMES (as the
// other checks), CHECKS (any of B, C, P; default BCP, C is the slowest), WIDTHS, ZOOM_WIDTHS, ZOOMS, FRAMES, SCROLLS, CLEAR, SLACK,
// INK_MIN, AIM, BLEED_MIN, BLEED_MAX. It needs _common.pinTheme to accept { theme, bg, seed }.
const { BASE, THEMES, ALL_THEMES, pinTheme, launch, BGS } = require('./_common.js');
// BGS (like THEMES) narrows a run: this guard is for the "iris" background only.
if (!BGS.includes('iris')) { console.log('bg-iris: skipped, BGS={} does not include iris'.replace('{}', BGS.join(','))); process.exit(0); }
const { PNG } = require('pngjs');

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const list = (v, d) => (v || d).split(',').map(Number);
const WIDTHS = list(process.env.WIDTHS, '1200,1280,1366,1440,1536,1680,1920,2560');
const ZOOM_WIDTHS = list(process.env.ZOOM_WIDTHS, '1280,1440,1920');
const ZOOMS = list(process.env.ZOOMS, '1.1,1.15,1.25,1.5,2');
const AIM_WIDTHS = list(process.env.AIM_WIDTHS, '1280,1366,1440');
const FRAMES = list(process.env.FRAMES, '300,900,1800,2800');
const SCROLLS = list(process.env.SCROLLS, '0,150,300,450,600');
const CLEAR = num(process.env.CLEAR, 24);
const SLACK = num(process.env.SLACK, 0.1);
const INK_MIN = num(process.env.INK_MIN, 3);          // channel difference (of 255) that counts as ink
const AIM = num(process.env.AIM, 90);                 // px, a little under one line of the headline
const BLEED_MIN = num(process.env.BLEED_MIN, 0.25);
const BLEED_MAX = num(process.env.BLEED_MAX, 0.65);
const HEIGHT = num(process.env.HEIGHT, 900);
const GATE = 1280;
const CHECKS = process.env.CHECKS || 'BCP';        // letters to run: B and P at zoom 1 and under zoom, C contrast (slowest)

const failures = [];
const fail = (msg) => { failures.push(msg); console.log('  FAIL ' + msg); };
const chan = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// ---- page-side helpers (serialised, so they stay self-contained) ---------------------------------------------------
// Text line boxes (for clearance and contrast) and keep-clear boxes, in page coordinates.
function collect() {
  const out = { groups: [], clear: [] };
  const rectsOf = (root, label, large, toClear) => {
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
      if (toClear) rects.forEach((q) => out.clear.push(q));
    }
  };
  rectsOf(document.querySelector('.hero .eyebrow:not(.eyebrow--muted)'), 'eyebrow', false, true);
  rectsOf(document.querySelector('.hero__h1'), 'headline', true, true);
  rectsOf(document.querySelector('.hero__lede'), 'lede', false, true);
  document.querySelectorAll('.hero__ctas .btn').forEach((b) => rectsOf(b, 'buttons', false, true));
  rectsOf(document.querySelector('.clients .eyebrow'), 'clients-label', false, true);
  document.querySelectorAll('.clients__item span:not(.sr-only):not(.clients__mark)').forEach((s) => rectsOf(s, 'client-names', false, true));
  document.querySelectorAll('.site-header a, .site-header button').forEach((a) => rectsOf(a, 'header', false, true));
  document.querySelectorAll('.hero__ctas .btn, .site-header .btn, .site-header button, .clients__logo, .clients__mark').forEach((e) => {
    const r = e.getBoundingClientRect(); if (r.width > 0) out.clear.push([r.left + scrollX, r.top + scrollY, r.right + scrollX, r.bottom + scrollY]);
  });
  const h = document.querySelector('.hero').getBoundingClientRect();
  out.hero = [0, h.top + scrollY, innerWidth, h.bottom + scrollY];
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

// Placement facts the P checks read.
function placement() {
  const q = (s) => document.querySelector(s);
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY, w: r.width, h: r.height }; };
  const art = q('.iris'); if (!art) return null;
  const cs = getComputedStyle(art);
  if (cs.display === 'none') return { off: true };
  const still = R(q('.iris__still')); const em = q('.hero__h1 em');
  const rg = document.createRange(); rg.selectNodeContents(em);
  const lines = [...rg.getClientRects()].filter((x) => x.width > 1);
  const last = lines[lines.length - 1];
  // the index mark: its outer end, in frame units, gives the compass angle
  const d = q('.iris__index').getAttribute('d').match(/-?[\d.]+/g).map(Number);
  const angle = (Math.atan2(d[2], -d[3]) * 180 / Math.PI + 360) % 360;
  return {
    art: R(art), still, clients: R(q('.clients')), lede: R(q('.hero__lede')), vw: innerWidth,
    cx: still.l + still.w / 2, cy: still.t + still.h / 2, r: still.w / 2,
    italicEnd: [last.right + scrollX, (last.top + last.bottom) / 2 + scrollY], lh: parseFloat(getComputedStyle(q('.hero__h1')).lineHeight) * (parseFloat(getComputedStyle(em).fontSize) / parseFloat(getComputedStyle(q('.hero__h1')).fontSize)),
    angle, borderTop: parseFloat(getComputedStyle(q('.clients')).borderTopWidth),
  };
}

// ---- node side ----------------------------------------------------------------------------------------------------
async function open(browser, theme, w, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT }, colorScheme: /dark/.test(theme) ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(pinTheme, { theme, bg: 'iris' });
  await page.addInitScript((o) => {
    try {
      if (o.settled) sessionStorage.setItem('vynatix-bg-iris', '1');
      if (o.idle) sessionStorage.setItem('vynatix-bg-iris-idle', String(o.idle));
    } catch (e) { /* storage blocked */ }
  }, { settled: !!opts.settled, idle: opts.idle || 0 });
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  if (opts.zoom && opts.zoom !== 1) await page.evaluate(applyZoom, opts.zoom);
  if (opts.frame != null) {
    await page.waitForFunction(() => document.documentElement.classList.contains('iris-play'), null, { timeout: 8000 });
    await page.evaluate((t) => document.getAnimations().forEach((a) => { if (a.animationName === 'iris-open') { a.pause(); a.currentTime = t; } }), opts.frame);
  }
  await page.waitForTimeout(120);
  return { page, ctx };
}

const decode = (buf) => PNG.sync.read(buf);
async function heroShot(page, box) {
  return decode(await page.screenshot({ clip: { x: 0, y: Math.round(box[1]), width: box[2], height: Math.round(box[3] - box[1]) }, fullPage: true }));
}
const art = (page, on) => page.evaluate((on) => { const a = document.querySelector('.iris'); if (on) a.style.removeProperty('display'); else a.style.setProperty('display', 'none'); }, on);

// Minimum distance from any ink pixel (where the two shots differ) to any box, and the count of ink pixels inside boxes.
function nearest(on, off, boxes, oy) {
  let min = Infinity, inside = 0, at = null, n = 0;
  const bx = boxes.map(([a, b, c, d]) => [a, b - oy, c, d - oy]);
  const W = on.width, H = on.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (Math.abs(on.data[i] - off.data[i]) < INK_MIN && Math.abs(on.data[i + 1] - off.data[i + 1]) < INK_MIN && Math.abs(on.data[i + 2] - off.data[i + 2]) < INK_MIN) continue;
    n++;
    for (const [x0, y0, x1, y1] of bx) {
      const dx = Math.max(x0 - x, 0, x - x1); const dy = Math.max(y0 - y, 0, y - y1);
      if (dx > min || dy > min) continue;
      const d = Math.hypot(dx, dy);
      if (d < min) { min = d; at = [x, y]; }
      if (d === 0) { inside++; break; }
    }
  }
  return { min, inside, at, n };
}

// Worst contrast per label, text hidden through visibility (the buttons through a transparent colour, so their fill stays).
async function contrast(page, groups, heroBox) {
  await page.evaluate(() => {
    document.querySelectorAll('.hero .eyebrow, .hero__h1, .hero__lede, .clients__item, .clients .eyebrow').forEach((e) => { e.style.visibility = 'hidden'; });
    document.querySelectorAll('.hero__ctas .btn').forEach((e) => { e.style.setProperty('color', 'transparent'); e.style.setProperty('-webkit-text-fill-color', 'transparent'); e.querySelectorAll('svg').forEach((s) => { s.style.visibility = 'hidden'; }); });
  });
  const png = await heroShot(page, heroBox);
  const worst = {};
  for (const g of groups) {
    if (g.label === 'header') continue;
    const t = g.color.match(/[\d.]+/g).map(Number); const lt = lum(t[0], t[1], t[2]);
    for (const [x0, y0, x1, y1] of g.rects) {
      for (let y = Math.max(0, Math.floor(y0 - heroBox[1])); y < Math.min(png.height, Math.ceil(y1 - heroBox[1])); y++) {
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(png.width, Math.ceil(x1)); x++) {
          const i = (y * png.width + x) * 4; const r = ratio(lum(png.data[i], png.data[i + 1], png.data[i + 2]), lt);
          const w = worst[g.label] = worst[g.label] || { min: 99, need: g.large ? 3 : 4.5 };
          if (r < w.min) w.min = r;
        }
      }
    }
  }
  return worst;
}

// Header links and buttons over the art at scroll offsets (the glass is translucent, so the art shows through it).
async function headerContrast(page, on) {
  await art(page, on);
  const worst = {}; const perBox = [];
  for (const s of SCROLLS) {
    await page.evaluate((y) => window.scrollTo(0, y), s); await page.waitForTimeout(80);
    const hb = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.site-header a, .site-header button').forEach((a) => {
        const tw = document.createTreeWalker(a, NodeFilter.SHOW_TEXT); let n; const cs = getComputedStyle(a);
        const rects = [];
        while ((n = tw.nextNode())) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); [...r.getClientRects()].forEach((q) => { if (q.width > 1) rects.push([q.left, q.top, q.right, q.bottom]); }); }
        const svg = a.querySelector('svg'); if (svg && !rects.length) { const q = a.getBoundingClientRect(); rects.push([q.left, q.top, q.right, q.bottom]); }
        if (rects.length) out.push({ color: cs.color, btn: a.classList.contains('btn'), rects });
      });
      return out;
    });
    await page.evaluate(() => document.querySelectorAll('.site-header *').forEach((e) => { e.style.setProperty('color', 'transparent'); e.style.setProperty('-webkit-text-fill-color', 'transparent'); e.style.setProperty('fill', 'transparent'); }));
    const png = decode(await page.screenshot());
    for (const b of hb) {
      const t = b.color.match(/[\d.]+/g).map(Number); const lt = lum(t[0], t[1], t[2]); let boxMin = 99;
      for (const [x0, y0, x1, y1] of b.rects) for (let y = Math.max(0, Math.floor(y0)); y < Math.min(png.height, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(png.width, Math.ceil(x1)); x++) {
        const i = (y * png.width + x) * 4; const r = ratio(lum(png.data[i], png.data[i + 1], png.data[i + 2]), lt);
        const k = b.btn ? 'header-button' : 'header-links'; const w = worst[k] = worst[k] || { min: 99, need: 4.5 };
        if (r < w.min) w.min = r;
        if (r < boxMin) boxMin = r;
      }
      perBox.push(boxMin);
    }
    await page.evaluate(() => document.querySelectorAll('.site-header *').forEach((e) => { e.style.removeProperty('color'); e.style.removeProperty('-webkit-text-fill-color'); e.style.removeProperty('fill'); }));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  worst.perBox = perBox;
  return worst;
}

// One frame: clearance (art on against art off), and the placement facts.
async function frame(browser, theme, w, opts, label) {
  const { page, ctx } = await open(browser, theme, w, opts);
  try {
    const place = await page.evaluate(placement);
    if (!place) { fail(`${label}: no .iris block in the page`); return { place: null }; }
    if (place.off) {
      // Under the gate the art is not drawn at all: the page must hold no art box.
      if (w >= GATE) fail(`${label}: the art is not drawn at ${w}px, which is at or above the ${GATE}px gate`);
      return { place };
    }
    if (w < GATE) { fail(`${label}: the art is drawn at ${w}px, below the ${GATE}px gate`); }
    const c = await page.evaluate(collect);
    const on = await heroShot(page, c.hero);
    await art(page, false); await page.waitForTimeout(60);
    const off = await heroShot(page, c.hero);
    await art(page, true);
    const near = nearest(on, off, c.clear, c.hero[1]);
    return { place, near, c, page, ctx, on, off };
  } catch (e) { await ctx.close(); throw e; }
}

(async () => {
  const browser = await launch();
  const t0 = Date.now();
  for (const theme of THEMES) {
    console.log(`\n${theme}`);
    // B and P at zoom 1, every width
    for (const w of (CHECKS.includes('B') || CHECKS.includes('P') ? WIDTHS : [])) {
      const label = `${theme} ${w}px`;
      const f = await frame(browser, theme, w, { settled: true }, label);
      if (!f.place || f.place.off) { if (f.ctx) await f.ctx.close(); console.log(`  ${w}px  art not drawn (gate ${GATE}px)`); continue; }
      const p = f.place;
      const bleed = (p.cx + p.r - p.vw) / (2 * p.r);
      const heroText = f.near;
      const msgs = [`clear ${heroText.min.toFixed(1)}px`, `inside ${heroText.inside}`, `bleed ${(bleed * 100).toFixed(0)}%`];
      if (heroText.inside > 0 || heroText.min < CLEAR) fail(`${label}: nearest art ink to text is ${heroText.min.toFixed(1)}px (${heroText.inside} ink pixels inside text boxes), the floor is ${CLEAR}px, at ${heroText.at}`);
      if (Math.abs(p.art.b - (p.clients.t + p.borderTop)) > 1.5 && Math.abs(p.art.b - p.clients.t) > 1.5) fail(`${label}: the art's bottom edge (${p.art.b.toFixed(1)}) is not on the clients rule (${p.clients.t.toFixed(1)})`);
      if (p.art.l < p.lede.r + 24 - 0.5) fail(`${label}: the art's left edge (${p.art.l.toFixed(1)}) is nearer than 24px to the lede box (right edge ${p.lede.r.toFixed(1)})`);
      if (bleed < BLEED_MIN || bleed > BLEED_MAX) fail(`${label}: the disc runs ${(bleed * 100).toFixed(0)}% off the right edge, outside ${BLEED_MIN * 100} to ${BLEED_MAX * 100}%`);
      if (AIM_WIDTHS.includes(w)) {
        const t = Math.sin(p.angle * Math.PI / 180);                 // compass angle: left and up for 180..360
        const dxdt = Math.sin(p.angle * Math.PI / 180), dydt = -Math.cos(p.angle * Math.PI / 180);
        const tt = (p.italicEnd[0] - p.cx) / dxdt; const y = p.cy + tt * dydt;
        const miss = Math.abs(y - p.italicEnd[1]);
        msgs.push(`aim ${miss.toFixed(0)}px`);
        if (!(tt > 0) || miss > AIM) fail(`${label}: the index mark's radial line passes ${miss.toFixed(0)}px from the end of the italic line (limit ${AIM}px, angle ${p.angle.toFixed(1)})`);
      }
      console.log(`  ${w}px  ${msgs.join('  ')}`);
      await f.ctx.close();
    }
    // B at text-only zoom
    for (const w of (CHECKS.includes('B') ? ZOOM_WIDTHS : [])) for (const z of ZOOMS) {
      const label = `${theme} ${w}px x${z}`;
      const f = await frame(browser, theme, w, { settled: true, zoom: z }, label);
      if (!f.place || f.place.off) { if (f.ctx) await f.ctx.close(); console.log(`  ${w}px x${z}  art not drawn`); continue; }
      const p = f.place; const n = f.near;
      console.log(`  ${w}px x${z}  clear ${n.min === Infinity ? 'no art in the hero' : n.min.toFixed(1) + 'px'}  inside ${n.inside}  art px ${n.n}`);
      if (n.inside > 0 || n.min < CLEAR) fail(`${label}: nearest art ink to text is ${n.min.toFixed(1)}px (${n.inside} inside), at ${n.at}`);
      if (p.art.l < p.lede.r + 24 - 0.5) fail(`${label}: the art's left edge (${p.art.l.toFixed(1)}) is nearer than 24px to the lede box (${p.lede.r.toFixed(1)})`);
      await f.ctx.close();
    }
    // C: contrast in the waiting, settled and event states at the laptop and the wide width
    for (const w of (CHECKS.includes('C') ? [1440, 1920] : [])) {
      const states = ['waiting', 'settled', ...FRAMES.map((t) => 't' + t)];
      for (const st of states) {
        const opts = st === 'waiting' ? {} : st === 'settled' ? { settled: true } : { idle: 300, frame: Number(st.slice(1)) };
        const { page, ctx } = await open(browser, theme, w, opts);
        const c = await page.evaluate(collect);
        // text boxes against the art, in this state
        const on = await heroShot(page, c.hero); await art(page, false); await page.waitForTimeout(60); const off = await heroShot(page, c.hero); await art(page, true);
        const near = nearest(on, off, c.clear, c.hero[1]);
        const withArt = await contrast(page, c.groups, c.hero);
        await ctx.close();
        const b = await open(browser, theme, w, opts);
        await art(b.page, false);
        const base = await contrast(b.page, c.groups, c.hero);
        await b.ctx.close();
        const parts = [];
        for (const k of Object.keys(withArt)) {
          const a = withArt[k], z = base[k];
          parts.push(`${k} ${a.min.toFixed(2)}${z ? `(${z.min.toFixed(2)})` : ''}`);
          if (a.min < a.need) fail(`${theme} ${w}px ${st}: ${k} contrast ${a.min.toFixed(2)} is under ${a.need}`);
          if (z && a.min < z.min - SLACK) fail(`${theme} ${w}px ${st}: ${k} contrast ${a.min.toFixed(2)} is more than ${SLACK} under the plain page's ${z.min.toFixed(2)}`);
        }
        if (near.inside > 0) fail(`${theme} ${w}px ${st}: ${near.inside} art pixels inside text boxes`);
        if (st.startsWith('t') && near.min < CLEAR) fail(`${theme} ${w}px ${st}: event frame ink is ${near.min.toFixed(1)}px from text`);
        console.log(`  C ${w}px ${st.padEnd(8)} ${parts.join('  ')}  | art in text ${near.inside}, nearest ${near.min.toFixed(1)}px`);
      }
      // the header links and buttons at scroll offsets: art on, then art off
      const settled = await open(browser, theme, w, { settled: true });
      const hOn = await headerContrast(settled.page, true); await settled.ctx.close();
      const plain = await open(browser, theme, w, { settled: true });
      const hOff = await headerContrast(plain.page, false); await plain.ctx.close();
      const hp = [];
      let drop = 0, dropPair = ''; hOn.perBox.forEach((v, i) => { if (hOff.perBox[i] - v > drop) { drop = hOff.perBox[i] - v; dropPair = `${hOff.perBox[i].toFixed(2)} to ${v.toFixed(2)}`; } });
      for (const k of Object.keys(hOn).filter((k) => k !== 'perBox')) {
        hp.push(`${k} ${hOn[k].min.toFixed(2)}(${hOff[k].min.toFixed(2)})`);
        if (hOn[k].min < hOn[k].need) fail(`${theme} ${w}px header: ${k} contrast ${hOn[k].min.toFixed(2)} is under ${hOn[k].need} at some scroll offset`);
        if (hOn[k].min < hOff[k].min - SLACK) fail(`${theme} ${w}px header: ${k} contrast ${hOn[k].min.toFixed(2)} is more than ${SLACK} under the plain page's own ${hOff[k].min.toFixed(2)}`);
      }
      console.log(`  C ${w}px header over the art, scroll ${SCROLLS.join('/')}: ${hp.join('  ')}  | the art lowers one link or button at one offset by at most ${drop.toFixed(2)} (${dropPair}); the floor above is what is held`);
    }
  }
  await browser.close();
  console.log(`\n${failures.length ? failures.length + ' FAILURE(S)' : 'all checks passed'}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
