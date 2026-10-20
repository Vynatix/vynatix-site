// The weave hero background (data-bg="weave"): it keeps clear of the text, and the text keeps its contrast.
//
// The cloth is placed by the layout, not by pixel positions: its top is the headline's first line, its
// left edge the lede's right edge (56ch in the lede's font), its right edge the header's right edge and
// its height a multiple of the headline's line height (see the comment at the top of the weave block in
// styles.css). That only holds while the headline and the lede keep the shape those rules assume, so
// this check fails, and says which rule, when a copy or layout change breaks the fit.
//
//   B  Clearance. Pixels the cloth changes (a screenshot with it against one with it switched off through
//      the CSSOM) are never nearer than 24px to a line of text, a button, the clients row or the header,
//      at each width and with text-only zoom at 1.25, 1.5 and 2.
//   C  Contrast. With the text hidden, every pixel behind every text line keeps 4.5:1 (3:1 for the large
//      headline) and is no more than 0.1 below the same page without the cloth. The worst case is
//      forced: the tile is replaced by a solid one, so every pixel of the cloth is at full strength,
//      which bounds every seed. The header is checked over the cloth too, at four scroll positions.
//   G  Geometry. The field's used box against the layout it is derived from.
//
//   node verify/bg-weave.js                      (serve the repo root first, as for the other checks)
//   THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark node verify/bg-weave.js
//   WIDTHS=1100,1200,1440,1920  ZOOMS=1,1.25,1.5,2  SEED=7  SCROLLS=300,450,600,760  node verify/bg-weave.js
const { BASE, THEMES, launch, pinTheme, BGS } = require('./_common.js');
// BGS (like THEMES) narrows a run: this guard is for the "weave" background only.
if (!BGS.includes('weave')) { console.log('bg-weave: skipped, BGS={} does not include weave'.replace('{}', BGS.join(','))); process.exit(0); }
const { PNG } = require('pngjs');

const WIDTHS = (process.env.WIDTHS || '1000,1100,1200,1440,1920').split(',').map(Number);
const ZOOMS = (process.env.ZOOMS || '1,1.25,1.5,2').split(',').map(Number);
const SCROLLS = (process.env.SCROLLS || '300,450,600,760').split(',').map(Number);
const SEED = +(process.env.SEED || 7);
const HEIGHT = 900;
const CLEAR = 24;        // px between the cloth and any text, button or the clients row
const INK = 3;           // a pixel the cloth changes by at least this much in one channel is ink
const SEARCH = 120;      // how far to look for the nearest ink, for the report

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseColor = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
const SOLID = 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271%27 height=%271%27%3E%3Crect width=%271%27 height=%271%27/%3E%3C/svg%3E")';

// Serialised into the page. Every line of text (a rectangle per text node per line), in viewport pixels,
// plus the boxes that count as text for clearance: buttons, the header and the clients row.
function collect() {
  const out = [], seen = new Set();
  ['.site-header', '.hero'].forEach((sel) => {
    const root = document.querySelector(sel); if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement, cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      [...rg.getClientRects()].filter((r) => r.width > 1 && r.height > 1).forEach((r) => {
        const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '');
        const cat = el.closest('.site-header') ? 'header' : el.closest('.hero__h1') ? 'headline' : el.closest('.hero__lede') ? 'lede'
          : el.closest('.eyebrow') ? 'eyebrow' : el.closest('.btn') ? 'button' : el.closest('.clients') ? 'clients' : 'other';
        out.push({ kind: 'text', cat, t: n.nodeValue.trim().slice(0, 24), x: r.left, y: r.top, w: r.width, h: r.height, color: cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight, cls });
      });
      seen.add(el);
    }
  });
  [['.hero .btn', 'button'], ['.hero .clients', 'clients'], ['.site-header', 'header']].forEach(([sel, cat]) => {
    document.querySelectorAll(sel).forEach((e) => { const r = e.getBoundingClientRect(); out.push({ kind: 'box', cat, t: sel, x: r.left, y: r.top, w: r.width, h: r.height }); });
  });
  return { rects: out, els: seen.size };
}

// Hide every line of text through element.style, so the pixels behind it can be read.
function hideText() {
  ['.site-header', '.hero'].forEach((sel) => {
    const root = document.querySelector(sel); if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement, cs = getComputedStyle(el);
      const own = cs.backgroundImage !== 'none' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
      // The cloth is a pseudo-element of the headline and inherits visibility from it, so the headline's
      // text is made transparent instead: hiding the headline would hide the cloth with it.
      if (own || el.closest('.hero__h1')) { el.style.setProperty('color', 'transparent'); el.style.setProperty('-webkit-text-fill-color', 'transparent'); }
      else el.style.setProperty('visibility', 'hidden');
      el.style.setProperty('text-decoration', 'none');
    }
  });
  document.querySelectorAll('.site-header svg, .hero__ctas svg').forEach((s) => s.style.setProperty('visibility', 'hidden'));
}

// Text-only zoom (Firefox "zoom text only", Android font scale), emulated: every hero font size is scaled,
// and so is the lede token that the cloth takes its ch from.
function zoomText(s) {
  const els = [...document.querySelectorAll('.hero, .hero *')];
  const sizes = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
  els.forEach((e, i) => e.style.setProperty('font-size', (sizes[i] * s) + 'px'));
  document.documentElement.style.setProperty('--text-type-lede', '350 ' + (22 * s) + 'px/1.5 var(--font-body)');
}

// The field's used box and the layout it is derived from, in viewport pixels at scroll 0.
function geometry() {
  const h1 = document.querySelector('.hero__h1'), hero = document.querySelector('.hero');
  const cs = getComputedStyle(h1, '::before'), hr = hero.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(h1);
  const lines = [...rg.getClientRects()].filter((r) => r.width > 2);
  const lede = document.querySelector('.hero__lede').getBoundingClientRect();
  const header = document.querySelector('.site-header').getBoundingClientRect();
  const clients = document.querySelector('.hero .clients').getBoundingClientRect();
  const top = h1.getBoundingClientRect().top;
  return {
    display: cs.display, content: cs.content,
    left: hr.left + parseFloat(cs.left), right: hr.left + parseFloat(cs.left) + parseFloat(cs.width),
    width: parseFloat(cs.width), height: parseFloat(cs.height), marginTop: parseFloat(cs.marginTop),
    lh: parseFloat(getComputedStyle(h1).getPropertyValue('--weave-lh')), h1Top: top,
    line1Bottom: Math.max(...lines.filter((r) => Math.abs(r.top - lines[0].top) < 4).map((r) => r.bottom)),
    ledeRight: lede.right, headerRight: header.right, clientsTop: clients.top, h1LineHeight: parseFloat(getComputedStyle(h1).lineHeight),
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
function behind(png, t) {
  const c = parseColor(t.color);
  const x0 = Math.max(0, Math.floor(t.x)), x1 = Math.min(png.width, Math.ceil(t.x + t.w));
  const y0 = Math.max(0, Math.floor(t.y)), y1 = Math.min(png.height, Math.ceil(t.y + t.h));
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
  let problems = 0, frames = 0;
  const check = (ok, name, detail) => {
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
  };
  const url = BASE + 'index.html';

  async function open(theme, width) {
    const ctx = await browser.newContext({
      viewport: { width, height: HEIGHT }, deviceScaleFactor: 1, reducedMotion: 'no-preference',
      colorScheme: /dark/.test(theme) ? 'dark' : 'light',
    });
    const page = await ctx.newPage();
    const problemsSeen = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problemsSeen.push(m.text()); });
    page.on('pageerror', (e) => problemsSeen.push(String(e)));
    await page.addInitScript(pinTheme, { theme, bg: 'weave', seed: SEED });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    return { page, ctx, problemsSeen };
  }
  // The cloth switched off through the CSSOM (the page's CSP allows this, and forbids a <style> tag).
  const off = (page) => page.evaluate(() => {
    const sheet = [...document.styleSheets].find((s) => /styles\.css/.test(s.href || ''));
    sheet.insertRule(':root[data-bg="weave"]:lang(en) .hero__h1::before { display: none; }', sheet.cssRules.length);
    return sheet.cssRules.length - 1;
  });
  const on = (page, idx) => page.evaluate((i) => {
    const sheet = [...document.styleSheets].find((s) => /styles\.css/.test(s.href || ''));
    sheet.deleteRule(i);
  }, idx);
  const shot = async (page) => toPng(await page.screenshot());

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const wide = width >= 1100;
      for (const zoom of wide ? ZOOMS : [1]) {
        const { page, ctx, problemsSeen } = await open(theme, width);
        if (zoom !== 1) { await page.evaluate(zoomText, zoom); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
        const tag = `${theme} ${width}px${zoom !== 1 ? ' text x' + zoom : ''}`;
        const geo = await page.evaluate(geometry);
        const { rects } = await page.evaluate(collect);
        const withCloth = await shot(page);
        const idx = await off(page);
        const without = await shot(page);
        const { ink, n } = inkMap(withCloth, without);

        // B. clearance
        let min = { d: Infinity, t: '', at: null };
        for (const r of rects) {
          const q = nearest(ink, withCloth.width, withCloth.height, r, SEARCH);
          if (q.d < min.d) min = { d: q.d, t: `${r.kind === 'box' ? r.t : r.t}`, at: q.at };
        }
        if (n === 0 && zoom === 1 && wide) check(false, `B  ${tag}: the cloth is not drawn`, 'a wide page with the weave drawn must show it (broken mask, renamed token or unsupported feature?)');
        else if (n === 0) check(true, `B  ${tag}: no cloth drawn here`, 'the field has no room at this text size, as designed');
        else check(min.d >= CLEAR, `B  ${tag}: nearest ink ${min.d === Infinity ? '>' + SEARCH : min.d.toFixed(1)}px (need ${CLEAR})`, min.d < CLEAR ? `to "${min.t}" at ${min.at}` : `${n} ink px`);
        frames++;

        // G. geometry, at the unzoomed frames
        if (zoom === 1) {
          const g = geo, fieldOn = wide && g.display !== 'none';
          if (!wide) check(g.display === 'none', `G  ${tag}: the field is off below 1100px`, `display ${g.display}`);
          else {
            check(Math.abs(g.right - g.headerRight) < 1.5, `G  ${tag}: field right edge ${g.right.toFixed(1)} is the header's right edge ${g.headerRight.toFixed(1)}`);
            check(Math.abs(g.left - (g.ledeRight + CLEAR)) < 1.5 || g.width === 0, `G  ${tag}: field left ${g.left.toFixed(1)} is the lede box right ${g.ledeRight.toFixed(1)} + ${CLEAR}`);
            const top = g.h1Top + g.marginTop; // static top is the h1's top edge
            check(top >= g.line1Bottom + CLEAR - 1, `G  ${tag}: field top ${top.toFixed(1)} is at least ${CLEAR}px below the headline's first line (${g.line1Bottom.toFixed(1)})`);
            check(Math.abs(g.lh - g.h1LineHeight) < 0.6, `G  ${tag}: --weave-lh ${g.lh} is the headline's line height ${g.h1LineHeight}`);
            check(top + g.height <= g.clientsTop - CLEAR + 1, `G  ${tag}: field bottom ${(top + g.height).toFixed(1)} is at least ${CLEAR}px above the clients row (${g.clientsTop.toFixed(1)})`);
          }
        }

        // C. contrast: text hidden, the worst-case solid cloth against none
        if (zoom === 1 && wide) {
          await page.evaluate(hideText);
          const offHidden = await shot(page);
          await on(page, idx);
          const realTile = await page.evaluate(() => document.documentElement.style.getPropertyValue('--weave-tile'));
          await page.evaluate((s) => document.documentElement.style.setProperty('--weave-tile', s), SOLID);
          const onHidden = await shot(page);
          const worst = {}, base = {};
          for (const t of rects.filter((r) => r.kind === 'text')) {
            const need = (t.size >= 24 || (t.size >= 18.66 && t.weight >= 700)) ? 3 : 4.5;
            const a = behind(onHidden, t), b = behind(offHidden, t);
            if (a === Infinity) continue;       // below the fold: nothing to read
            if (!worst[t.cat] || a < worst[t.cat].v) worst[t.cat] = { v: a, need, t: t.t };
            if (!(t.cat in base) || b < base[t.cat]) base[t.cat] = b;
          }
          for (const cat of Object.keys(worst)) {
            const w = worst[cat], ok = w.v >= w.need && w.v >= base[cat] - 0.1;
            check(ok, `C  ${tag}: ${cat} ${w.v.toFixed(2)} (need ${w.need}, no cloth ${base[cat].toFixed(2)})`, ok ? '' : `"${w.t}"`);
          }
          // The header over the cloth, scrolled: the field passes under the sticky glass bar, which is only
          // partly opaque. Its text is hidden already; the bar sits at the same viewport position at every
          // scroll. Each header item either keeps its contrast without the cloth (within 0.1: the filled
          // button, and every link the cloth does not reach) or, where the cloth does reach it, stays at
          // 7:1 (AAA) over the worst-case cloth. The real cloth of this visit is measured too and reported.
          const hdr = rects.filter((r) => r.kind === 'text' && r.cat === 'header');
          const rows = (a, b) => hdr.map((t) => ({ t: t.t, on: behind(a, t), off: behind(b, t) }));
          const worstDrop = (rs) => rs.reduce((m, r) => (r.off - r.on > m.off - m.on ? r : m), rs[0]);
          for (const sy of SCROLLS) {
            // The page may scroll smoothly: jump, then wait until it is there.
            await page.evaluate((y) => { document.documentElement.style.setProperty('scroll-behavior', 'auto'); window.scrollTo(0, y); }, sy);
            await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 1, sy);
            await page.waitForTimeout(120);
            const solidOn = await shot(page);
            const k = await off(page);
            const noCloth = await shot(page);
            await on(page, k);
            await page.evaluate((t) => document.documentElement.style.setProperty('--weave-tile', t), realTile);
            const realOn = await shot(page);
            await page.evaluate((s) => document.documentElement.style.setProperty('--weave-tile', s), SOLID);
            const bound = rows(solidOn, noCloth), real = rows(realOn, noCloth);
            const d = worstDrop(bound), dr = worstDrop(real);
            const bad = bound.filter((r) => !(r.on >= 4.5 && (r.on >= r.off - 0.1 || r.on >= 7)));
            check(!bad.length, `C  ${tag}: header at scroll ${sy}: lowest where the cloth reaches ${d.on.toFixed(2)} (need 7 or no drop)`,
              bad.length ? bad.map((r) => `"${r.t}" ${r.off.toFixed(2)} to ${r.on.toFixed(2)}`).join(', ') : `largest drop "${d.t}" ${d.off.toFixed(2)} to ${d.on.toFixed(2)}; this visit's cloth: "${dr.t}" ${dr.off.toFixed(2)} to ${dr.on.toFixed(2)}`);
          }
        }
        if (problemsSeen.length) check(false, `console ${tag}`, problemsSeen.join(' | '));
        await ctx.close();
      }
    }
  }
  await browser.close();
  console.log(`${frames} frames, ${problems} failing checks`);
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
