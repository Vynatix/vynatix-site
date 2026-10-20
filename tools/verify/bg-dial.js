// The dial hero background (data-bg="dial"): it keeps clear of the text, the text keeps its contrast, and
// it moves only as far as it should.
//
// The arc is two pseudo-elements of the home headline, placed by the layout, not by pixel positions: the
// top is the end of the headline's first line (the registered --dial-lh), the left is the right edge of the
// lede box plus 24px or, further right, the container's right edge less the arc's width, and the height is a
// fixed 447px that ends above the clients row. That only holds while the headline, the lede and the clients
// row keep the shape those rules assume, so this check fails, and says which rule, when a copy or layout
// change breaks the fit. (See the comment at the top of the dial block in hero-bg.css.)
//
//   S  Shape. Nothing below 1200px: no box, no mask request. Not drawn for another draw or without JavaScript.
//   G  Geometry. The arc's used box against the layout it is derived from.
//   B  Clearance. Pixels the arc changes (a screenshot with it against one with it switched off through the
//      CSSOM) are never nearer than 24px to a line of text, a button, or the clients row, at each width, with
//      the pointer at rest and at either edge (B at both ends of its travel), and with text-only zoom at
//      1.25, 1.5 and 2.
//   C  Contrast. With the text hidden, every pixel behind every hero text line keeps 4.5:1 (3:1 for the large
//      headline) and is no more than 0.1 below the same page without the arc, in the same three pointer
//      states. The header, which the arc passes under once the page has scrolled, keeps 4.5:1 and either
//      its own contrast without the arc (within 0.1) or 7:1, at four scroll positions and five angles of B.
//   M  Motion. Still at idle; the pointer turns B by -GAIN to +GAIN and no further (6px at the bezel); it is
//      left alone under the header; the theme toggle fires one sweep that ends where it began, at the pointer's speed limit, not for touch or under the header; the angle
//      survives a resize and print; reduced motion, touch, forced colours, more contrast, reduced
//      transparency and print leave a still or absent dial.
//
//   node verify/bg-dial.js                      (serve the repo root first, as for the other checks)
//   THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark node verify/bg-dial.js
//   WIDTHS=1200,1440,1920  ZOOMS=1,1.25,1.5,2  STATES=rest,left,right  SCROLLS=300,450,600,760  node verify/bg-dial.js
const { BASE, THEMES, launch, pinTheme, BGS } = require('./_common.js');
// BGS (like THEMES) narrows a run: this guard is for the "dial" background only.
if (!BGS.includes('dial')) { console.log('bg-dial: skipped, BGS={} does not include dial'.replace('{}', BGS.join(','))); process.exit(0); }
const { PNG } = require('pngjs');

const WIDTHS = (process.env.WIDTHS || '1200,1440,1920').split(',').map(Number);
const ZOOMS = (process.env.ZOOMS || '1,1.25,1.5,2').split(',').map(Number);
const STATES = (process.env.STATES || 'rest,left,right').split(',');
const SCROLLS = (process.env.SCROLLS || '300,450,600,760').split(',').map(Number);
const HDR_K = (process.env.HDR_K || '-1,-0.5,0,0.5,1').split(',').map(Number);
const HEIGHT = 900;
const CLEAR = 24;            // px between the arc and any text, button or the clients row
const INK = 1;               // a pixel the arc changes by at least this much in one channel is ink
const SEARCH = 120;          // how far to look for the nearest ink, for the report
const BEZEL = 252;           // the bezel radius in px (assets/bg-dial-*.svg, tools/dial-masks.py --radius)
const GAIN = 6 / BEZEL * 180 / Math.PI;   // degrees at k = 1: 6px at the bezel
const BOX_W = 186, BOX_H = 447, OVERHANG = 4;   // the box in hero-bg.css

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseColor = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
const kToX = (k, w) => Math.min(w - 1, Math.max(0, Math.round((k + 1) / 2 * w)));
const MASK = /bg-dial-[ab]\.svg/;

// Serialised into the page. Every line of text (a rectangle per text node per line), in page pixels, plus the
// boxes that count as text for clearance: buttons, the header and the clients row.
function collect() {
  const out = [];
  ['.site-header', '.hero'].forEach((sel) => {
    const root = document.querySelector(sel); if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement, cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      [...rg.getClientRects()].filter((r) => r.width > 1 && r.height > 1).forEach((r) => {
        const cat = el.closest('.site-header') ? 'header' : el.closest('.hero__h1') ? 'headline' : el.closest('.hero__lede') ? 'lede'
          : el.closest('.eyebrow') ? 'eyebrow' : el.closest('.btn') ? 'button' : el.closest('.clients') ? 'clients' : 'other';
        out.push({ kind: 'text', cat, t: n.nodeValue.trim().slice(0, 24), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, color: cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight });
      });
    }
  });
  [['.hero .btn', 'button'], ['.hero .clients', 'clients'], ['.site-header', 'header']].forEach(([sel, cat]) => {
    document.querySelectorAll(sel).forEach((e) => { const r = e.getBoundingClientRect(); out.push({ kind: 'box', cat, t: sel, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }); });
  });
  return out;
}

// Hide every line of text through element.style, so the pixels behind it can be read. The arc is a
// pseudo-element of the headline and would inherit visibility: hidden, so the headline's text is made
// transparent instead.
function hideText() {
  ['.site-header', '.hero'].forEach((sel) => {
    const root = document.querySelector(sel); if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement, cs = getComputedStyle(el);
      const own = cs.backgroundImage !== 'none' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
      if (own || el.closest('.hero__h1')) { el.style.setProperty('color', 'transparent'); el.style.setProperty('-webkit-text-fill-color', 'transparent'); el.style.setProperty('transition', 'none'); }
      else el.style.setProperty('visibility', 'hidden');
      el.style.setProperty('text-decoration', 'none');
    }
  });
  document.querySelectorAll('.site-header svg, .hero__ctas svg').forEach((s) => s.style.setProperty('visibility', 'hidden'));
}

// Text-only zoom (Firefox "zoom text only", Android font scale), emulated: every hero font size is scaled, and
// so is the lede token that the arc takes its ch and em from.
function zoomText(s) {
  const els = [...document.querySelectorAll('.hero, .hero *')];
  const sizes = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
  els.forEach((e, i) => e.style.setProperty('font-size', (sizes[i] * s) + 'px'));
  document.documentElement.style.setProperty('--text-type-lede', '350 ' + (22 * s) + 'px/1.5 var(--font-body)');
}

// The arc's used box and the layout it is derived from, in page pixels.
function geometry() {
  const h1 = document.querySelector('.hero__h1'), hero = document.querySelector('.hero');
  const cs = getComputedStyle(h1, '::after'), h1r = h1.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(h1);
  const lines = [...rg.getClientRects()].filter((r) => r.width > 2);
  const lede = document.querySelector('.hero__lede').getBoundingClientRect();
  const ctas = document.querySelector('.hero__ctas').getBoundingClientRect();
  const clients = document.querySelector('.hero .clients').getBoundingClientRect();
  const line1 = lines.filter((r) => Math.abs(r.top - lines[0].top) < 4);
  const left = h1r.left + parseFloat(cs.left), top = h1r.top + scrollY + parseFloat(cs.top);
  return {
    content: cs.content, display: cs.display, pe: cs.pointerEvents, left, top, width: parseFloat(cs.width), height: parseFloat(cs.height),
    right: left + parseFloat(cs.width), bottom: top + parseFloat(cs.height),
    lh: parseFloat(getComputedStyle(h1).getPropertyValue('--dial-lh')), h1LineHeight: parseFloat(getComputedStyle(h1).lineHeight),
    line1Bottom: Math.max(...line1.map((r) => r.bottom)) + scrollY, ledeRight: lede.right, contentRight: ctas.right,
    clientsTop: clients.top + scrollY, vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth,
    heroTop: hero.getBoundingClientRect().top + scrollY,
  };
}

const toPng = (buf) => PNG.sync.read(buf);

// Nearest ink to a rectangle, and where. ink is a Uint8Array of width*height flags.
function nearest(ink, W, H, r, limit) {
  const x0 = Math.max(0, Math.floor(r.x - limit)), x1 = Math.min(W - 1, Math.ceil(r.x + r.w + limit));
  const y0 = Math.max(0, Math.floor(r.y - limit)), y1 = Math.min(H - 1, Math.ceil(r.y + r.h + limit));
  let best = Infinity, at = null;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!ink[y * W + x]) continue;
    const dx = Math.max(r.x - (x + 1), 0, x - (r.x + r.w)), dy = Math.max(r.y - (y + 1), 0, y - (r.y + r.h));
    const d = Math.hypot(dx, dy);
    if (d < best) { best = d; at = [x, y]; }
  }
  return { d: best, at };
}

function inkMap(a, b) {
  const ink = new Uint8Array(a.width * a.height); let n = 0;
  for (let i = 0, p = 0; i < ink.length; i++, p += 4) {
    if (Math.max(Math.abs(a.data[p] - b.data[p]), Math.abs(a.data[p + 1] - b.data[p + 1]), Math.abs(a.data[p + 2] - b.data[p + 2])) >= INK) { ink[i] = 1; n++; }
  }
  return { ink, n };
}

// Worst contrast behind a text rectangle, per pixel, against the text's own colour.
function behind(png, t, dy) {   // dy: how far the page has scrolled when t is page text
  const c = parseColor(t.color);
  const x0 = Math.max(0, Math.floor(t.x)), x1 = Math.min(png.width, Math.ceil(t.x + t.w));
  const y0 = Math.max(0, Math.floor(t.y - dy)), y1 = Math.min(png.height, Math.ceil(t.y - dy + t.h));
  let worst = Infinity;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    const q = ratio(lum(c.r * c.a + r * (1 - c.a), c.g * c.a + g * (1 - c.a), c.b * c.a + b * (1 - c.a)), lum(r, g, b));
    if (q < worst) worst = q;
  }
  return worst;
}

(async () => {
  const browser = await launch();
  let problems = 0, frames = 0, checks = 0;
  const check = (ok, name, detail) => {
    checks++;
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
  };
  const url = BASE + 'index.html';

  async function open(theme, width, o = {}) {
    const ctx = await browser.newContext({
      viewport: { width, height: o.height || HEIGHT }, deviceScaleFactor: 1,
      reducedMotion: o.reduced ? 'reduce' : 'no-preference', forcedColors: o.forced ? 'active' : 'none', contrast: o.contrast || 'no-preference',
      hasTouch: !!o.touch, isMobile: !!o.touch, javaScriptEnabled: o.js !== false,
      colorScheme: /dark/.test(theme || '') ? 'dark' : 'light',
    });
    const page = await ctx.newPage();
    const seen = [], requests = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') seen.push(m.text()); });
    page.on('pageerror', (e) => seen.push(String(e)));
    await page.addInitScript(() => {            // count every animation frame the page asks for
      window.__raf = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); };
    });
    if (o.js !== false) await page.addInitScript(pinTheme, { theme, bg: o.bg || 'dial' });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    return { page, ctx, seen, requests };
  }
  // The arc switched off through the CSSOM (the page's CSP allows this, and forbids a <style> tag).
  const off = (page) => page.evaluate(() => {
    const sheet = [...document.styleSheets].find((s) => /hero-bg\.css/.test(s.href || ''));
    sheet.insertRule(':root[data-bg="dial"]:lang(en) .hero__h1::before, :root[data-bg="dial"]:lang(en) .hero__h1::after { display: none; }', sheet.cssRules.length);
    return sheet.cssRules.length - 1;
  });
  const on = (page, idx) => page.evaluate((i) => {
    const sheet = [...document.styleSheets].find((s) => /hero-bg\.css/.test(s.href || ''));
    sheet.deleteRule(i);
  }, idx);
  const shot = async (page) => toPng(await page.screenshot());
  const settle = (page, ms = 600) => page.waitForTimeout(ms);
  const toK = async (page, w, k) => { await page.mouse.move(kToX(k, w), 5, { steps: 6 }); await settle(page); };
  const pseudo = (page, which = '::after') => page.evaluate((w) => {
    const cs = getComputedStyle(document.querySelector('.hero__h1'), w);
    return { content: cs.content, display: cs.display, rotate: cs.rotate, pointerEvents: cs.pointerEvents, animation: cs.animationName, left: parseFloat(cs.left), width: parseFloat(cs.width) };
  }, which);
  const angle = async (page) => parseFloat((await pseudo(page)).rotate) || 0;
  const stateK = { rest: null, left: -1, right: 1 };

  // ---- S. shape: nothing below 1200px, nothing for another draw or without JavaScript --------------------
  for (const w of [1199, 768, 390]) {
    const { ctx, page, requests } = await open(THEMES[0], w, { height: 844 });
    const a = await pseudo(page, '::after'), b = await pseudo(page, '::before');
    const asked = requests.filter((u) => MASK.test(u)).length;
    check(a.content === 'none' && b.content === 'none' && asked === 0, `S  ${w}px: no dial box and no mask requested`, `content ${a.content}/${b.content}, mask requests ${asked}`);
    await ctx.close();
  }
  for (const bg of ['weave', 'sheet', 'iris']) {
    const { ctx, page, requests } = await open(THEMES[0], 1440, { bg });
    await page.mouse.move(5, 5, { steps: 4 }); await settle(page, 300);
    const asked = requests.filter((u) => MASK.test(u)).length;
    const anims = await page.evaluate(() => document.getAnimations().filter((x) => x.effect && x.effect.pseudoElement).length);
    check(asked === 0 && anims === 0, `S  ${bg} drawn: no dial mask requested, no animation on a pseudo-element after pointer moves`, `mask requests ${asked}, pseudo animations ${anims}`);
    await ctx.close();
  }
  {
    const { ctx, page, requests } = await open(THEMES[0], 1440, { js: false });
    // Without script there is no data-bg and the page shows the sheet, whose headline has a ::before of its own
    // (an empty content string, no mask): in the integrated page the test for "no dial" is the dial's own marks,
    // its ::after box and a mask image on either headline pseudo-element, and no request for its masks.
    const a = await pseudo(page, '::after'), b = await pseudo(page, '::before');
    const masks = await page.evaluate(() => ['::before', '::after'].map((q) => { const cs = getComputedStyle(document.querySelector('.hero__h1'), q); return cs.maskImage + ' ' + cs.webkitMaskImage; }).join(' '));
    const asked = requests.filter((u) => MASK.test(u)).length;
    check(a.content === 'none' && !/dial/.test(masks) && asked === 0, 'S  no JavaScript: no data-bg, so no dial (the page shows the sheet) and no mask request', `::after ${a.content}, masks ${masks.trim()}, mask requests ${asked}`);
    await ctx.close();
  }

  // ---- G, B, C: geometry, clearance, contrast --------------------------------------------------------------
  const worstGap = {};
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const wide = width >= 1200;
      for (const zoom of wide ? ZOOMS : [1]) {
        for (const state of (zoom === 1 ? STATES : ['rest', 'right'])) {
          const { page, ctx, seen, requests } = await open(theme, width);
          if (zoom !== 1) { await page.evaluate(zoomText, zoom); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
          if (stateK[state] != null) await toK(page, width, stateK[state]);
          const tag = `${theme} ${width}px${zoom !== 1 ? ' text x' + zoom : ''}, pointer ${state}`;
          const geo = await page.evaluate(geometry);
          const rects = await page.evaluate(collect);
          const withArc = await shot(page);
          const idx = await off(page);
          const without = await shot(page);
          const { ink, n } = inkMap(withArc, without);

          // B. clearance
          let min = { d: Infinity, t: '', at: null };
          for (const r of rects) {
            const q = nearest(ink, withArc.width, withArc.height, r, SEARCH);
            if (q.d < min.d) min = { d: q.d, t: r.t, at: q.at };
          }
          if (n === 0 && zoom === 1) check(false, `B  ${tag}: the dial is not drawn`, 'a page with the dial drawn must show it (broken mask, renamed token or unsupported feature?)');
          else if (n === 0) check(true, `B  ${tag}: no ink in view`, 'the arc is pushed off the page by the lede at this text size, as designed');
          else {
            check(min.d >= CLEAR, `B  ${tag}: nearest ink ${min.d === Infinity ? '>' + SEARCH : min.d.toFixed(1)}px (need ${CLEAR})`, min.d < CLEAR ? `to "${min.t}" at ${min.at}` : `${n} ink px`);
            if (!(theme in worstGap) || min.d < worstGap[theme]) worstGap[theme] = min.d;
          }
          frames++;

          // G. geometry (unzoomed, at rest, once per theme and width)
          if (zoom === 1 && state === 'rest') {
            const g = geo;
            const want = Math.max(g.ledeRight + CLEAR, g.contentRight - BOX_W + OVERHANG);
            check(g.content !== 'none' && g.display === 'block' && g.pe === 'none', `G  ${tag}: both gratings drawn, display block, pointer-events none`, `${g.content} ${g.display} ${g.pe}`);
            check(Math.abs(g.left - want) < 1.5, `G  ${tag}: left ${g.left.toFixed(1)} is the larger of the lede box right ${g.ledeRight.toFixed(1)} + ${CLEAR} and the container's right ${g.contentRight.toFixed(1)} less ${BOX_W} plus ${OVERHANG} (${want.toFixed(1)})`);
            check(g.top >= g.line1Bottom + CLEAR - 1, `G  ${tag}: top ${g.top.toFixed(1)} is at least ${CLEAR}px below the headline's first line (${g.line1Bottom.toFixed(1)})`);
            check(g.bottom <= g.clientsTop - CLEAR + 1, `G  ${tag}: bottom ${g.bottom.toFixed(1)} is at least ${CLEAR}px above the clients row (${g.clientsTop.toFixed(1)})`);
            check(Math.abs(g.lh - g.h1LineHeight) < 0.6, `G  ${tag}: --dial-lh ${g.lh} is the headline's line height ${g.h1LineHeight}`);
            check(g.width === BOX_W && g.height === BOX_H, `G  ${tag}: box ${g.width} by ${g.height} is the mask's (${BOX_W} by ${BOX_H})`);
            check(g.right <= g.vw && g.sw === g.vw, `G  ${tag}: the box ends inside the page (${g.right.toFixed(1)} of ${g.vw}) and the page does not scroll sideways`, `scrollWidth ${g.sw}`);
            check(requests.filter((u) => MASK.test(u)).length === 2, `G  ${tag}: both masks requested`, String(requests.filter((u) => MASK.test(u)).length));
          }

          // C. contrast: text hidden, with the arc and without
          if (zoom === 1) {
            await page.evaluate(hideText);
            const offHidden = await shot(page);
            await on(page, idx);
            const onHidden = await shot(page);
            const worst = {}, base = {};
            for (const t of rects.filter((r) => r.kind === 'text' && r.cat !== 'header')) {
              const need = (t.size >= 24 || (t.size >= 18.66 && t.weight >= 700)) ? 3 : 4.5;
              const a = behind(onHidden, t, 0), b = behind(offHidden, t, 0);
              if (a === Infinity) continue;       // below the fold: nothing to read
              if (!worst[t.cat] || a < worst[t.cat].v) worst[t.cat] = { v: a, need, t: t.t };
              if (!(t.cat in base) || b < base[t.cat]) base[t.cat] = b;
            }
            for (const cat of Object.keys(worst)) {
              const w = worst[cat], ok = w.v >= w.need && w.v >= base[cat] - 0.1;
              check(ok, `C  ${tag}: ${cat} ${w.v.toFixed(2)} (need ${w.need}, no dial ${base[cat].toFixed(2)})`, ok ? '' : `"${w.t}"`);
            }
            // The header over the arc, scrolled: the arc passes under the sticky glass bar, which is only partly
            // opaque. Once per theme and width, at rest and for five angles of B (it is left where the pointer
            // last put it while the arc is under the header).
            if (state === 'rest') {
              const hdr = rects.filter((r) => r.kind === 'text' && r.cat === 'header');
              for (const sy of SCROLLS) {
                await page.evaluate((y) => { document.documentElement.style.setProperty('scroll-behavior', 'auto'); window.scrollTo(0, y); }, sy);
                await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 1, sy);
                await settle(page, 150);
                const k0 = await off(page);
                const noArc = await shot(page);
                await on(page, k0);
                let lowest = { v: Infinity }, drop = { d: -Infinity };
                for (const hk of HDR_K) {
                  // Put B at the angle while the page is at scroll 0, where it listens, then scroll.
                  await page.evaluate(() => { document.documentElement.style.setProperty('scroll-behavior', 'auto'); window.scrollTo(0, 0); });
                  await page.waitForFunction(() => window.scrollY < 1);
                  await toK(page, width, hk);
                  await page.evaluate((y) => window.scrollTo(0, y), sy);
                  await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 1, sy);
                  await settle(page, 150);
                  const withArcHdr = await shot(page);
                  for (const t of hdr) {
                    const a = behind(withArcHdr, t, 0), b = behind(noArc, t, 0);   // the bar sits at the same viewport position at every scroll
                    if (a < lowest.v) lowest = { v: a, t: t.t, k: hk, off: b };
                    if (b - a > drop.d) drop = { d: b - a, t: t.t, k: hk, on: a, off: b };
                  }
                }
                const ok = lowest.v >= 4.5 && (drop.d <= 0.1 || lowest.v >= 7);
                check(ok, `C  ${tag}: header at scroll ${sy}: lowest ${lowest.v.toFixed(2)} ("${lowest.t}", B at k ${lowest.k})`,
                  `largest drop "${drop.t}" ${drop.off.toFixed(2)} to ${drop.on.toFixed(2)} at k ${drop.k}`);
              }
            }
          }
          if (seen.length) check(false, `console ${tag}`, seen.join(' | '));
          await ctx.close();
        }
      }
    }
  }
  for (const t of Object.keys(worstGap)) console.log(`    nearest ink to any text, ${t}: ${worstGap[t].toFixed(1)}px`);

  // ---- M. motion and fallbacks ---------------------------------------------------------------------------------
  const T = THEMES[0];
  {
    const { ctx, page } = await open(T, 1440);
    const r0 = await page.evaluate(() => window.__raf), a0 = await angle(page);
    const playing = await page.evaluate(() => document.getAnimations().filter((x) => x.playState === 'running').length);
    await page.waitForTimeout(2500);
    const r1 = await page.evaluate(() => window.__raf), a1 = await angle(page);
    check(playing === 0 && r1 === r0 && a1 === a0, 'M  idle: no animation running, no frame requested in 2.5s, the angle does not change', `running ${playing}, frames ${r1 - r0}, angle ${a0} to ${a1}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(T, 1440);
    await toK(page, 1440, -1); const left = await angle(page);
    await toK(page, 1440, 1); const right = await angle(page);
    await toK(page, 1440, 0); const mid = await angle(page);
    const f0 = await page.evaluate(() => window.__raf); await page.waitForTimeout(700); const f1 = await page.evaluate(() => window.__raf);
    const rim = (d) => Math.abs(d) * Math.PI / 180 * BEZEL;
    check(Math.abs(left + GAIN) < 0.02 && Math.abs(right - GAIN) < 0.02 && Math.abs(mid) < 0.02 && f1 === f0 && rim(left) <= 6.05 && rim(right) <= 6.05,
      `M  pointer: far left, far right and middle turn B by -${GAIN.toFixed(3)}, +${GAIN.toFixed(3)} and 0 degrees (6px at the ${BEZEL}px bezel); nothing is scheduled once it stops`,
      `${left}, ${right}, ${mid}; rim travel ${rim(left).toFixed(2)}px and ${rim(right).toFixed(2)}px; frames after stop ${f1 - f0}`);
    // under the header: left alone
    const before = await angle(page);
    await page.evaluate(() => scrollTo(0, 500)); await settle(page, 250);
    await page.mouse.move(1438, 400, { steps: 4 }); await settle(page, 450);
    const scrolled = await angle(page);
    check(scrolled === before, 'M  past the point where the arc is under the header, B is left alone', `${before} to ${scrolled}`);
    await ctx.close();
  }
  {
    // the slew limit: a jump from one edge to the other is taken in steps of at most 0.35 of the travel
    const { ctx, page } = await open(T, 1440);
    await toK(page, 1440, -1);
    const frames = await page.evaluate(() => new Promise((resolve) => {
      const out = []; let n = 0;
      const el = document.querySelector('.hero__h1');
      const read = () => parseFloat(getComputedStyle(el, '::after').rotate) || 0;
      out.push(read());
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth - 1, clientY: 5, pointerType: 'mouse' }));
      const tick = () => { out.push(read()); if (++n < 14) requestAnimationFrame(tick); else resolve(out); };
      requestAnimationFrame(tick);
    }));
    let maxStep = 0; for (let i = 1; i < frames.length; i++) maxStep = Math.max(maxStep, Math.abs(frames[i] - frames[i - 1]));
    const limit = 0.35 * GAIN + 0.01;
    check(maxStep <= limit, `M  slew: a jump across the whole range moves B by at most 0.35 of its travel a frame (${(0.35 * GAIN).toFixed(3)} degrees, ${(0.35 * GAIN * Math.PI / 180 * BEZEL).toFixed(2)}px at the bezel)`, `largest step ${maxStep.toFixed(3)} degrees`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(T, 1440);
    await toK(page, 1440, 0.4);
    const before = await angle(page);
    await page.evaluate(() => document.querySelector('.theme-toggle').click());   // not page.click: that would move the pointer to the button
    await page.waitForTimeout(120);
    const dialAnims = () => document.getAnimations().filter((a) => a.effect && a.effect.pseudoElement === '::after' && a.playState === 'running').length;
    const during = await page.evaluate(dialAnims);
    const midAngle = await angle(page);
    await page.waitForTimeout(700);
    const after = await angle(page);
    const left = await page.evaluate(dialAnims);
    check(during === 1 && Math.abs(midAngle - before) > 0.05 && Math.abs(after - before) < 0.005 && left === 0, 'M  toggle: one sweep on ::after, away from the resting angle, back to it after 500ms, nothing left running', `running ${during}, angle ${before} then ${midAngle} then ${after}, still running ${left}`);
    await ctx.close();
  }
  {
    // The sweep keeps the pointer's speed limit, from an edge too (the longest swing), per 60 Hz frame.
    const { ctx, page } = await open(T, 1440);
    await toK(page, 1440, -1);
    const samples = await page.evaluate(() => new Promise((resolve) => {
      const el = document.querySelector('.hero__h1');
      const read = () => parseFloat(getComputedStyle(el, '::after').rotate) || 0;
      const out = [[performance.now(), read()]]; let n = 0;
      document.querySelector('.theme-toggle').click();
      const tick = () => { out.push([performance.now(), read()]); if (++n < 45) requestAnimationFrame(tick); else resolve(out); };
      requestAnimationFrame(tick);
    }));
    let step = 0;
    for (let i = 1; i < samples.length; i++) { const dt = samples[i][0] - samples[i - 1][0]; if (dt > 0) step = Math.max(step, Math.abs(samples[i][1] - samples[i - 1][1]) * 16.667 / dt); }
    check(step <= 0.35 * GAIN + 0.01, 'M  toggle: the sweep moves B by at most 0.35 of its travel per 60 Hz frame, from an edge too', `largest step ${step.toFixed(3)} degrees (${(step * Math.PI / 180 * BEZEL).toFixed(2)}px at the bezel), limit ${(0.35 * GAIN).toFixed(3)}`);
    await ctx.close();
  }
  {
    // Like the pointer, the toggle does nothing for touch (a mobile-emulated context: hover none, pointer coarse).
    const { ctx, page } = await open(T, 1366, { height: 1024, touch: true });
    const fine = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
    await page.tap('.theme-toggle'); await page.waitForTimeout(120);
    const anims = await page.evaluate(() => document.getAnimations().filter((x) => x.effect && x.effect.pseudoElement && x.playState === 'running').length);
    check(fine === false && anims === 0, 'M  touch: tapping the theme toggle does not turn the dial', `fine pointer ${fine}, animations ${anims}`);
    await ctx.close();
  }
  {
    // ... nor while the arc is under the glass header.
    const { ctx, page } = await open(T, 1440);
    await page.evaluate(() => scrollTo(0, 500)); await settle(page, 250);
    await page.evaluate(() => document.querySelector('.theme-toggle').click()); await page.waitForTimeout(120);
    const anims = await page.evaluate(() => document.getAnimations().filter((x) => x.effect && x.effect.pseudoElement && x.playState === 'running').length);
    check(anims === 0, 'M  toggle while the arc is under the header: B is left alone', `animations ${anims}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(T, 1440);
    await toK(page, 1440, -1);
    const before = await angle(page);
    await page.setViewportSize({ width: 1000, height: 900 }); await settle(page, 250);
    const narrow = (await pseudo(page)).content;
    await page.setViewportSize({ width: 1440, height: 900 }); await settle(page, 350);
    const back = await angle(page);
    await page.emulateMedia({ media: 'print' }); await settle(page, 150);
    await page.emulateMedia({ media: 'screen' }); await settle(page, 350);
    const printed = await angle(page);
    await toK(page, 1440, 1);
    const moved = await angle(page);
    check(narrow === 'none' && Math.abs(back - before) < 0.005 && Math.abs(printed - before) < 0.005 && Math.abs(moved - GAIN) < 0.02, 'M  resize below 1200px and back, and print and back: the arc keeps its angle and still follows the pointer', `${before}, narrow ${narrow}, back ${back}, after print ${printed}, then ${moved}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(T, 1440, { reduced: true });
    const frames0 = await page.evaluate(() => window.__raf);
    await page.mouse.move(1, 5, { steps: 4 }); await settle(page, 400);
    await page.evaluate(() => document.querySelector('.theme-toggle').click()); await page.waitForTimeout(150);
    const a = await pseudo(page, '::after'), b = await pseudo(page, '::before');
    const dialAnims = await page.evaluate(() => document.getAnimations().filter((x) => x.effect && x.effect.pseudoElement).length);
    const frames = (await page.evaluate(() => window.__raf)) - frames0;
    check(parseFloat(a.rotate) === 0 && dialAnims === 0 && frames === 0 && a.animation === 'none' && b.animation === 'none' && a.content !== 'none', 'M  reduced motion: the dial is drawn and still; the pointer and the toggle start no animation and no frame', `angle ${a.rotate}, dial animations ${dialAnims}, frames ${frames}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(T, 1366, { height: 1024, touch: true });
    const a = await pseudo(page);
    await page.touchscreen.tap(1300, 300); await settle(page, 300);
    const anims = await page.evaluate(() => document.getAnimations().filter((x) => x.effect && x.effect.pseudoElement).length);
    check(a.content !== 'none' && parseFloat(a.rotate) === 0 && anims === 0, 'M  touch at 1366px: the dial is drawn and still', `angle ${a.rotate}, animations ${anims}`);
    await ctx.close();
  }
  for (const [name, o] of [['forced colours', { forced: true }], ['higher contrast', { contrast: 'more' }]]) {
    const { ctx, page, requests } = await open(T, 1440, o);
    const a = await pseudo(page), b = await pseudo(page, '::before');
    const asked = requests.filter((u) => MASK.test(u)).length;
    check(a.display === 'none' && b.display === 'none' && asked === 0, `M  ${name}: the dial is not drawn and its masks are not requested`, `${a.display}/${b.display}, requests ${asked}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(T, 1440);
    await page.emulateMedia({ media: 'print' });
    const a = await pseudo(page), b = await pseudo(page, '::before');
    check(a.display === 'none' && b.display === 'none', 'M  print: the dial is not drawn', `${a.display}/${b.display}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(T, 1440);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    await settle(page, 200);
    const a = await pseudo(page), b = await pseudo(page, '::before');
    check(a.display === 'none' && b.display === 'none', 'M  reduced transparency: the dial is not drawn', `${a.display}/${b.display}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`${frames} frames, ${checks} checks, ${problems} failing`);
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
