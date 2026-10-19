// Layout and accessibility of the consent bar, measured in a real browser with the module armed
// (armGa in _common.js: the dummy ID, Google stubbed, any other off-origin request aborted).
//   node verify/consent-layout.js                 about a minute and a half, themes light,dark,teal-light,teal-dark
//   THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark node verify/consent-layout.js   every theme
//   FULL=1 node verify/consent-layout.js          more viewports, pages and Tab sweeps
//
// The bar is fixed to the bottom of the viewport, so the numbers that matter are measured, never assumed:
//  - size: at most 160px high on a first visit at 320px wide, at most half the viewport at 320x568 and 360x640
//    (the reopened bar, which adds a status line, is held to half the viewport), static in flow at 520px of
//    height or less, and it adds no horizontal scroll (compared with the same page and theme, module inert);
//  - the open mobile menu overlays the bar and every menu link can be hit;
//  - WCAG 2.4.11 (focus not obscured): a Tab sweep compares each focused element with the bar's real
//    getBoundingClientRect, and the footer's Legal links and the Cookie settings link must scroll clear of the
//    bar, at 1x and with every font scaled 1.5x (html included, so rem follows);
//  - both buttons are at least 44px, their accessible name starts with their visible label, and the text,
//    link, buttons, hover state and focus ring meet contrast from rendered colours in each theme under test;
//  - forced colours keep the borders, reduced motion stops everything, and axe finds nothing with the bar up.
const fs = require('fs');
const { PNG } = require('pngjs');
const {
  PLACEHOLDER_ID, THEMES: ENV_THEMES, launch, pool,
} = require('./_common');
const C = require('./_consent');

const { sleep, snap, armedContext, open, barButton: btn } = C;
const FULL = !!process.env.FULL;
const THEMES = process.env.THEMES ? ENV_THEMES : ['light', 'dark', 'teal-light', 'teal-dark'];
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PAGES_L = FULL ? ['index.html', 'sv.html', 'android-automotive-consultancies-gothenburg.html'] : ['index.html', 'sv.html'];
const VIEWPORTS = [[320, 568], [360, 640], [390, 844], [768, 1024], [1440, 900], [320, 256]];
const PHONES = [[320, 568], [360, 640], [390, 844]];
const rep = C.reporter();
const ck = rep.check;
const langOf = (p) => (p === 'sv.html' ? 'sv' : 'en');
const copy = require('./_common').readApp().copy;

// --- measuring helpers (serialised into the page) --------------------------------------------------
const BAR_FACTS = () => {
  const bar = document.getElementById('consent-bar');
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  const btns = [...bar.querySelectorAll('button')].map((b) => { const q = b.getBoundingClientRect(); return { w: q.width, h: q.height }; });
  const kids = [...bar.querySelectorAll('p, a, button, div')];
  const spill = kids.filter((k) => { const q = k.getBoundingClientRect(); return q.right > r.right + 0.5 || q.left < r.left - 0.5 || q.bottom > r.bottom + 0.5 || q.top < r.top - 0.5; }).length;
  return {
    pos: getComputedStyle(bar).position, top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height, w: r.width,
    vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, btns, spill,
  };
};

// Scales every font on the page by f: html too, so rem follows, as the text-size setting of a browser or phone does.
const TEXT_SCALE = (f) => {
  const all = [document.documentElement, ...document.querySelectorAll('body *')];
  const sizes = all.map((e) => parseFloat(getComputedStyle(e).fontSize));
  const lhs = all.map((e) => getComputedStyle(e).lineHeight);
  all.forEach((e, i) => {
    e.style.setProperty('font-size', (sizes[i] * f) + 'px', 'important');
    if (/px$/.test(lhs[i])) e.style.setProperty('line-height', (parseFloat(lhs[i]) * f) + 'px', 'important');
  });
};

// The focused element against the bar's rectangle, read now (the bar's real size, never a constant).
const FOCUS_VS_BAR = () => {
  const el = document.activeElement;
  const bar = document.getElementById('consent-bar');
  if (!el || el === document.body || !bar) return null;
  const r = el.getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  const inBar = bar.contains(el);
  const ix = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left));
  const iy = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight ? document.elementFromPoint(cx, cy) : null;
  return {
    desc: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') + ':' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20),
    inBar, visible: r.width > 0 && r.height > 0,
    fullyUnder: !inBar && r.width > 0 && iy >= r.height - 0.5 && ix >= r.width - 0.5,
    overlap: !inBar && r.width > 0 && ix > 0.5 && iy > 0.5,
    centreCovered: !inBar && !!hit && bar.contains(hit),
    skip: el.classList.contains('skip-link'),
  };
};

// The footer's links against the bar, after scrolling to the end of the page. The fine print (copyright line) is
// not a control, so it is reported but does not fail the check.
const BOTTOM_CLEARANCE = () => {
  const bar = document.getElementById('consent-bar');
  scrollTo(0, document.documentElement.scrollHeight);
  const b = bar.getBoundingClientRect();
  const fixed = getComputedStyle(bar).position === 'fixed';
  const under = (e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    return fixed && Math.min(r.right, b.right) - Math.max(r.left, b.left) > 0 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 0;
  };
  const covered = [...document.querySelectorAll('.site-footer a')].filter(under).map((e) => (e.textContent || '').trim().slice(0, 24));
  const fine = [...document.querySelectorAll('.site-footer__fine span, .site-footer__fine p')].filter(under).length;
  let legalMin = Infinity;
  for (const e of document.querySelectorAll('.site-footer__links a')) {
    const r = e.getBoundingClientRect();
    if (fixed && Math.min(r.right, b.right) - Math.max(r.left, b.left) > 0) legalMin = Math.min(legalMin, b.top - r.bottom);
  }
  const cookie = document.querySelector('[data-consent-open]').getBoundingClientRect();
  return {
    fixed, covered, fine, legalMin: legalMin === Infinity ? null : legalMin,
    cookieClear: !fixed || cookie.bottom <= b.top || cookie.right <= b.left || cookie.left >= b.right,
    atBottom: Math.abs(innerHeight + scrollY - document.documentElement.scrollHeight) < 2,
  };
};

async function reopen(page) {
  await page.click(btn('denied'));
  await page.evaluate(() => document.querySelector('[data-consent-open]').scrollIntoView({ block: 'center' }));
  await page.click('[data-consent-open]');
  await page.evaluate(() => scrollTo(0, 0));
}

(async () => {
  const t0 = Date.now();
  const browser = await launch();
  const timings = [];
  const scenario = async (title, fn) => {
    const t = Date.now();
    console.log(`\n== ${title}`);
    try { await fn(); } catch (e) { ck(false, `${title}: scenario crashed`, e && e.message ? e.message.split('\n')[0] : String(e)); }
    timings.push([title.split(':')[0], (Date.now() - t) / 1000]);
  };
  const clean = (env, name) => {
    const bad = [];
    if (env.ga.blocked.length) bad.push('requests outside the stubs: ' + env.ga.blocked.join(', '));
    if (env.violations.length || env.refused.length) bad.push('CSP: ' + env.violations.concat(env.refused).join(' | '));
    if (env.pageErrors.length) bad.push('page errors: ' + env.pageErrors.join(' | '));
    ck(bad.length === 0, `${name}: no CSP violation, page error or request outside the stubs`, bad.join('; '));
  };

  const fail = (list, n = 5) => list.slice(0, n).join(' | ') + (list.length > n ? ` (+${list.length - n} more)` : '');

  // -------------------------------------------------------------------------------------------------
  await scenario('SIZE: height, share of the viewport, position, horizontal scroll, target size', async () => {
    const jobs = [];
    for (const theme of THEMES) for (const [w, h] of VIEWPORTS) for (const p of PAGES_L) for (const state of ['first', 'reopen']) jobs.push({ theme, w, h, p, state });
    for (const h of [520, 521]) jobs.push({ theme: THEMES[0], w: 320, h, p: 'index.html', state: 'first', edge: true });
    const rows = await pool(jobs, 4, async (j) => {
      const vp = { width: j.w, height: j.h };
      const env = await armedContext(browser, { viewport: vp, theme: j.theme, reducedMotion: 'reduce' });
      const base = await armedContext(browser, { viewport: vp, theme: j.theme, arm: { id: PLACEHOLDER_ID } });
      const page = await open(env.ctx, j.p);
      if (j.state === 'reopen') await reopen(page);
      const f = await page.evaluate(BAR_FACTS);
      const bp = await open(base.ctx, j.p);
      const inert = await bp.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      await env.close(); await base.close();
      return { ...j, f, inert, errors: env.pageErrors.length };
    });
    const bad = { height: [], share: [], pos: [], hscroll: [], target: [], inside: [], spill: [], none: [] };
    let maxFirst320 = 0, maxShare = 0;
    for (const r of rows) {
      const tag = `${r.theme} ${r.w}x${r.h} ${r.p.slice(0, 5)} ${r.state}`;
      if (!r.f) { bad.none.push(tag + ': no bar'); continue; }
      const share = r.f.h / r.h;
      if (r.state === 'first' && r.w === 320 && !r.edge) maxFirst320 = Math.max(maxFirst320, r.f.h);
      if (r.state === 'first' && r.w === 320 && r.f.h > 160) bad.height.push(`${tag}: ${Math.round(r.f.h)}px`);
      if (r.f.pos === 'fixed' && share > 0.5) bad.share.push(`${tag}: ${Math.round(share * 100)}% of the viewport`);
      if (r.f.pos === 'fixed') maxShare = Math.max(maxShare, share);
      const wantPos = r.h <= 520 ? 'static' : 'fixed';
      if (r.f.pos !== wantPos) bad.pos.push(`${tag}: ${r.f.pos}, want ${wantPos}`);
      if (r.f.scrollW > Math.max(r.f.clientW, r.inert.s)) bad.hscroll.push(`${tag}: scrollWidth ${r.f.scrollW} vs inert ${r.inert.s}`);
      if (r.f.btns.some((b) => b.h < 44 || b.w < 44)) bad.target.push(`${tag}: ${r.f.btns.map((b) => Math.round(b.w) + 'x' + Math.round(b.h)).join(' ')}`);
      if (r.f.left < -0.5 || r.f.right > r.f.vw + 0.5 || (r.f.pos === 'fixed' && (r.f.bottom > r.f.vh + 0.5 || r.f.top < -0.5))) bad.inside.push(`${tag}: rect ${Math.round(r.f.left)},${Math.round(r.f.top)} to ${Math.round(r.f.right)},${Math.round(r.f.bottom)}`);
      if (r.f.spill) bad.spill.push(`${tag}: ${r.f.spill} child(ren) outside the bar`);
    }
    ck(!bad.none.length, `a bar is present in all ${rows.length} runs`, fail(bad.none));
    ck(!bad.height.length, `first-visit bar is at most 160px high at 320px wide (max ${Math.round(maxFirst320)}px)`, fail(bad.height));
    ck(!bad.share.length, `the bar is at most half the viewport (first visit and reopened; max ${Math.round(maxShare * 100)}%)`, fail(bad.share));
    ck(!bad.pos.length, 'fixed above 520px of viewport height, static in flow at 520px and below (boundary 520 and 521 included)', fail(bad.pos));
    ck(!bad.hscroll.length, 'the bar adds no horizontal scroll (compared with the same page, theme and size with the module inert)', fail(bad.hscroll));
    ck(!bad.inside.length && !bad.spill.length, 'the bar stays inside the viewport and holds its children', fail(bad.inside.concat(bad.spill)));
    ck(!bad.target.length, 'Decline and Accept are at least 44px by 44px', fail(bad.target));
    // The static fallback at 320x256 stays usable.
    const env = await armedContext(browser, { viewport: { width: 320, height: 256 }, theme: THEMES[0], reducedMotion: 'reduce' });
    const page = await open(env.ctx, 'index.html');
    await page.evaluate(() => scrollTo(0, 400));
    const st = await page.evaluate(() => {
      const b = document.getElementById('consent-bar').getBoundingClientRect();
      const h = document.querySelector('.site-header').getBoundingClientRect();
      return { barBottom: b.bottom, headerTop: h.top, headerH: h.height };
    });
    ck(st.barBottom < 0 && st.headerTop >= -0.5, 'at 320x256 the bar scrolls away with the page and the header stays visible', JSON.stringify(st));
    await page.evaluate(() => scrollTo(0, 0));
    await page.click(btn('denied'));
    ck(!(await snap(page)).bar, 'at 320x256 a choice still works and removes the bar');
    clean(env, 'static bar');
    await env.close();
  });

  // -------------------------------------------------------------------------------------------------
  await scenario('MENU: the open mobile menu overlays the bar and every link can be hit', async () => {
    const jobs = [];
    for (const [w, h] of PHONES) for (const p of PAGES_L) for (const state of ['first', 'reopen']) jobs.push({ w, h, p, state });
    for (const [w, h] of [[320, 525], [360, 560]]) jobs.push({ w, h, p: 'index.html', state: 'first', tight: true });   // menu and bar meet
    const rows = await pool(jobs, 4, async (j) => {
      const env = await armedContext(browser, { viewport: { width: j.w, height: j.h }, theme: THEMES[0], reducedMotion: 'reduce' });
      const page = await open(env.ctx, j.p);
      if (j.state === 'reopen') await reopen(page);
      await page.click('.mobile-toggle');
      await sleep(60);
      const res = await page.evaluate(() => {
        const nav = document.querySelector('.site-header__nav');
        const bar = document.getElementById('consent-bar');
        const br = bar.getBoundingClientRect();
        const hit = (el, x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
        const links = [...nav.querySelectorAll('a')].filter((a) => a.getBoundingClientRect().width > 0);
        const bad = [];
        for (const a of links) {
          const r = a.getBoundingClientRect();
          const my = r.top + r.height / 2;
          const pts = [[r.left + r.width / 2, my], [r.left + 14, my], [r.right - 14, my], [r.left + r.width / 2, r.top + 5], [r.left + r.width / 2, r.bottom - 5]];
          if (pts.some(([x, y]) => x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight && !hit(a, x, y)) || r.bottom > innerHeight) bad.push(a.textContent.trim());
        }
        const nr = nav.getBoundingClientRect();
        const overlap = nr.bottom > br.top && nr.top < br.bottom;
        let menuOnTop = true;
        if (overlap) {                                         // a point in both rectangles must resolve to the menu
          const x = Math.max(nr.left, br.left) + 4, y = (Math.max(nr.top, br.top) + Math.min(nr.bottom, br.bottom)) / 2;
          menuOnTop = !bar.contains(document.elementFromPoint(x, y));
        }
        return { links: links.length, bad, overlap, menuOnTop, expanded: document.querySelector('.mobile-toggle').getAttribute('aria-expanded'),
          zHeader: getComputedStyle(document.querySelector('.site-header')).zIndex, zBar: getComputedStyle(bar).zIndex };
      });
      await env.close();
      return { ...j, res };
    });
    const bad = rows.filter((r) => r.res.bad.length || r.res.expanded !== 'true' || !r.res.menuOnTop || r.res.links < 5).map((r) => `${r.w}x${r.h} ${r.p.slice(0, 5)} ${r.state}: ${r.res.links} links, unreachable ${r.res.bad.join('/') || 'none'}, menu on top ${r.res.menuOnTop}`);
    ck(!bad.length, `with the menu open every nav link and Get in touch pass elementFromPoint at 320x568, 360x640 and 390x844 (${rows.length} runs, first visit and reopened)`, fail(bad));
    ck(rows.every((r) => Number(r.res.zHeader) > Number(r.res.zBar)), 'the header sits above the bar in the stacking order', `${rows[0].res.zHeader} over ${rows[0].res.zBar}`);
  });

  // -------------------------------------------------------------------------------------------------
  await scenario('FOCUS NOT OBSCURED (SC 2.4.11): Tab sweep and the end of the page', async () => {
    const jobs = [];
    const vps = FULL ? PHONES.concat([[1440, 900]]) : [[320, 568], [390, 844]];
    for (const [w, h] of vps) for (const p of PAGES_L) for (const scale of [1, 1.5]) for (const dir of FULL ? ['Tab', 'Shift+Tab'] : ['Tab']) jobs.push({ w, h, p, scale, dir });
    const rows = await pool(jobs, 4, async (j) => {
      const env = await armedContext(browser, { viewport: { width: j.w, height: j.h }, theme: THEMES[0], reducedMotion: 'reduce' });
      const page = await open(env.ctx, j.p);
      if (j.scale !== 1) await page.evaluate(TEXT_SCALE, j.scale);
      await page.evaluate(() => { document.body.setAttribute('tabindex', '-1'); document.body.focus(); document.body.blur(); document.body.removeAttribute('tabindex'); scrollTo(0, 0); });
      if (j.dir === 'Shift+Tab') await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      let first = null, stops = 0, firstIsSkip = null;
      const bad = [];
      for (let i = 0; i < 600; i++) {
        await page.keyboard.press(j.dir);
        const m = await page.evaluate(FOCUS_VS_BAR);
        if (!m) { if (i > 3) break; continue; }
        if (i === 0 && j.dir === 'Tab') firstIsSkip = m.skip;
        if (first === null) first = m.desc; else if (m.desc === first && i > 1) break;
        stops++;
        if (!m.inBar && m.visible && (m.fullyUnder || m.centreCovered || m.overlap)) bad.push(`${m.desc} (${m.fullyUnder ? 'fully under' : m.centreCovered ? 'centre covered' : 'overlaps'})`);
      }
      env.pageErrors.length && bad.push('page errors');
      await env.close();
      return { ...j, stops, bad, firstIsSkip };
    });
    const bad = rows.filter((r) => r.bad.length).map((r) => `${r.w}x${r.h} ${r.p.slice(0, 5)} x${r.scale} ${r.dir}: ${r.bad.slice(0, 3).join(', ')}`);
    ck(!bad.length, `no focused element is covered by the bar (${rows.reduce((a, r) => a + r.stops, 0)} Tab stops in ${rows.length} sweeps, 1x and 1.5x text)`, fail(bad));
    ck(rows.filter((r) => r.dir === 'Tab').every((r) => r.firstIsSkip), 'the skip link is still the first Tab stop with the bar up');
    ck(rows.every((r) => r.stops > 20), 'each sweep reached the end of the page', rows.map((r) => r.stops).join(','));

    const jobs2 = [];
    for (const [w, h] of VIEWPORTS.filter(([, hh]) => hh > 520)) for (const p of PAGES_L) for (const scale of [1, 1.5]) for (const state of ['first', 'reopen']) jobs2.push({ w, h, p, scale, state });
    const rows2 = await pool(jobs2, 4, async (j) => {
      const env = await armedContext(browser, { viewport: { width: j.w, height: j.h }, theme: THEMES[0], reducedMotion: 'reduce' });
      const page = await open(env.ctx, j.p);
      if (j.state === 'reopen') await reopen(page);
      if (j.scale !== 1) await page.evaluate(TEXT_SCALE, j.scale);
      await sleep(60);
      const r = await page.evaluate(BOTTOM_CLEARANCE);
      await env.close();
      return { ...j, r };
    });
    const bad2 = rows2.filter((x) => x.r.covered.length || !x.r.cookieClear || !x.r.atBottom).map((x) => `${x.w}x${x.h} ${x.p.slice(0, 5)} x${x.scale} ${x.state}: links under the bar ${x.r.covered.join('/') || 'none'}, Cookie settings clear ${x.r.cookieClear}`);
    const gaps = rows2.map((x) => x.r.legalMin).filter((g) => g !== null);
    ck(!bad2.length, `at the end of the page every footer link, the Legal list and Cookie settings are clear of the bar (${rows2.length} runs; smallest gap above the bar ${gaps.length ? Math.round(Math.min(...gaps)) : 'n/a'}px)`, fail(bad2));
    const fine = rows2.filter((x) => x.r.fine).map((x) => `${x.w}x${x.h} ${x.p.slice(0, 5)} x${x.scale} ${x.state}`);
    if (fine.length) console.log(`note  the copyright line (not a control) ends under the bar in ${fine.length} run(s): ${fail(fine, 3)}`);
  });

  // -------------------------------------------------------------------------------------------------
  await scenario('NAME AND LANDMARK: label in name', async () => {
    for (const [p, lang] of [['index.html', 'en'], ['sv.html', 'sv']]) {
      const L = copy[lang];
      const env = await armedContext(browser, { viewport: { width: 390, height: 844 }, theme: THEMES[0] });
      const page = await open(env.ctx, p);
      const cdp = await env.ctx.newCDPSession(page);
      const ax = (await cdp.send('Accessibility.getFullAXTree')).nodes.filter((n) => !n.ignored);
      const buttons = ax.filter((n) => (n.role || {}).value === 'button').map((n) => (n.name || {}).value || '');
      const region = ax.filter((n) => (n.role || {}).value === 'region').map((n) => (n.name || {}).value);
      const dialog = ax.filter((n) => ['dialog', 'alertdialog'].includes((n.role || {}).value)).length;
      for (const [visible, name] of [[L.decline, L.declineLabel], [L.accept, L.acceptLabel]]) {
        const got = buttons.find((b) => b.toLowerCase().startsWith(visible.toLowerCase()));
        ck(!!got && got === name, `${p}: the "${visible}" button's accessible name starts with its visible label`, `names ${buttons.filter((b) => /dec|acc|avb|godk/i.test(b)).join(' | ')}`);
      }
      ck(region.includes(L.label) && dialog === 0, `${p}: the bar is a named region "${L.label}", not a dialog`, region.join(','));
      await env.close();
    }
  });

  // -------------------------------------------------------------------------------------------------
  await scenario('CONTRAST: text, link, buttons, hover and focus ring, from rendered colours', async () => {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const px = (png, x, y) => { const i = (png.width * Math.round(y) + Math.round(x)) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
    const modeOf = (png, x0, y0, x1, y1) => {
      const m = {};
      for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) { const k = px(png, x, y).join(','); m[k] = (m[k] || 0) + 1; }
      return Object.entries(m).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
    };
    const farthest = (png, x0, y0, x1, y1, bg) => {
      let best = null, bd = -1;
      for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) { const c = px(png, x, y); const d = ratio(c, bg); if (d > bd) { bd = d; best = c; } }
      return best;
    };
    const shot = async (page, clip) => PNG.sync.read(await page.screenshot({ clip, animations: 'disabled' }));
    const NORM = (css) => { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3]]; };

    const jobs = [];
    for (const theme of THEMES) for (const p of PAGES_L) jobs.push({ theme, p });
    const rows = await pool(jobs, 3, async (j) => {
      const env = await armedContext(browser, { viewport: { width: 390, height: 844 }, theme: j.theme, reducedMotion: 'reduce' });
      const page = await open(env.ctx, j.p);
      const g = await page.evaluate((normSrc) => {
        const norm = eval(normSrc);
        const q = (s) => document.querySelector(s);
        const cs = (e) => getComputedStyle(e);
        const bar = q('#consent-bar'), txt = q('.consent__text'), link = q('.consent__link');
        const bs = [...bar.querySelectorAll('button')];
        const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
        return {
          bar: rect(bar), link: rect(link), btns: bs.map(rect), barBg: norm(cs(bar).backgroundColor), text: norm(cs(txt).color), linkColor: norm(cs(link).color),
          linkLine: cs(link).textDecorationLine, border: norm(cs(bar).borderTopColor), borderW: cs(bar).borderTopWidth,
          btnBg: bs.map((b) => norm(cs(b).backgroundColor)), btnFg: bs.map((b) => norm(cs(b).color)), ring: norm(getComputedStyle(document.documentElement).getPropertyValue('--focus-ring').trim()),
        };
      }, NORM.toString());
      const bar = g.bar;
      const barBgPx = modeOf(await shot(page, { x: bar.x + 6, y: bar.y + 6, width: 20, height: 4 }), 0, 0, 20, 4);
      const issues = [];
      const need = (name, got, min) => { if (!(got >= min)) issues.push(`${name} ${got.toFixed(2)}:1 (< ${min})`); return got; };
      const res = { text: need('text', ratio(g.text, barBgPx), 4.5), link: need('link', ratio(g.linkColor, barBgPx), 4.5) };
      if (!/underline/.test(g.linkLine)) need('link vs body text (no underline)', ratio(g.linkColor, g.text), 3);
      for (let i = 0; i < 2; i++) {
        const b = g.btns[i];
        const rest = await shot(page, { x: b.x, y: b.y, width: b.w, height: b.h });
        const fill = modeOf(rest, 4, 4, 10, rest.height - 4);
        need(`button ${i} label`, ratio(farthest(rest, 8, 8, rest.width - 8, rest.height - 8, fill), fill), 4.5);
        need(`button ${i} fill vs bar`, ratio(fill, barBgPx), 3);
        await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
        await sleep(80);
        const hov = await shot(page, { x: b.x, y: b.y, width: b.w, height: b.h });
        const hfill = modeOf(hov, 4, 4, 10, hov.height - 4);
        need(`button ${i} label on hover`, ratio(farthest(hov, 8, 8, hov.width - 8, hov.height - 8, hfill), hfill), 4.5);
        need(`button ${i} fill vs bar on hover`, ratio(hfill, barBgPx), 3);
        await page.mouse.move(2, 2);
      }
      // Focus ring: Tab to each control, sample the ring above its top edge, compare it with both neighbours.
      for (const [name, pred] of [['link', () => document.activeElement.classList.contains('consent__link')], ['Decline', () => document.activeElement.getAttribute('data-consent-choice') === 'denied'], ['Accept', () => document.activeElement.getAttribute('data-consent-choice') === 'granted']]) {
        await page.evaluate(() => { document.activeElement && document.activeElement.blur(); document.body.setAttribute('tabindex', '-1'); document.body.focus(); document.body.blur(); document.body.removeAttribute('tabindex'); });
        for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(pred)) break; }
        await sleep(60);
        const rr = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
        const clip = { x: Math.max(0, Math.floor(rr.x - 10)), y: Math.max(0, Math.floor(rr.y - 14)), width: Math.ceil(rr.w + 20), height: Math.ceil(rr.h + 28) };
        const png = await shot(page, clip);
        let worst = null;
        for (const fx of [0.25, 0.5, 0.75]) {
          const cx = Math.round(rr.x - clip.x + rr.w * fx), top = Math.round(rr.y - clip.y);
          const col = [];
          for (let d = 9; d >= -1; d--) col.push(px(png, cx, top - d));
          let ri = col.findIndex((c) => Math.abs(c[0] - g.ring[0]) + Math.abs(c[1] - g.ring[1]) + Math.abs(c[2] - g.ring[2]) <= 6);
          if (ri < 1) continue;
          let rj = ri;
          while (rj + 1 < col.length && ratio(col[rj + 1], col[ri]) < 1.02) rj++;
          const both = Math.min(ratio(col[ri], col[ri - 1]), ratio(col[ri], col[rj + 1]));
          if (worst === null || both < worst) worst = both;
        }
        if (worst === null) issues.push(`focus ring on ${name} not found in the rendered pixels`);
        else need(`focus ring on ${name}`, worst, 3);
      }
      await env.close();
      return { ...j, issues, res };
    });
    const bad = rows.filter((r) => r.issues.length).map((r) => `${r.theme} ${r.p.slice(0, 5)}: ${r.issues.join(', ')}`);
    const min = (k) => Math.min(...rows.map((r) => r.res[k])).toFixed(1);
    ck(!bad.length, `contrast holds in ${THEMES.join(', ')} (${rows.length} bar renders; lowest text ${min('text')}:1, link ${min('link')}:1)`, fail(bad, 8));
  });

  // -------------------------------------------------------------------------------------------------
  await scenario('FORCED COLOURS and REDUCED MOTION', async () => {
    for (const scheme of ['light', 'dark']) {
      const env = await armedContext(browser, { viewport: { width: 390, height: 844 }, forcedColors: 'active', colorScheme: scheme });
      const page = await open(env.ctx, 'index.html');
      const r = await page.evaluate(() => {
        const bar = document.getElementById('consent-bar');
        const bs = [...bar.querySelectorAll('button')];
        const cs = (e) => getComputedStyle(e);
        const solid = (e) => parseFloat(cs(e).borderTopWidth) >= 1 && cs(e).borderTopStyle !== 'none' && !/rgba\(.*, 0\)$/.test(cs(e).borderTopColor);
        return {
          forced: matchMedia('(forced-colors: active)').matches, bar: solid(bar), barColour: cs(bar).borderTopColor, barBg: cs(bar).backgroundColor,
          btns: bs.map((b) => ({ solid: solid(b), border: cs(b).borderTopColor, bg: cs(b).backgroundColor, fg: cs(b).color })),
        };
      });
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { el: document.activeElement.textContent.trim().slice(0, 10), style: s.outlineStyle, w: parseFloat(s.outlineWidth) }; });
      ck(r.forced && r.bar && r.barColour !== r.barBg && r.btns.every((b) => b.solid && b.border !== b.bg && b.fg !== b.bg), `forced colours (${scheme}): the bar and both buttons keep a visible border and text`, JSON.stringify(r));
      ck(focus.style !== 'none' && focus.w >= 1, `forced colours (${scheme}): the focused button keeps an outline`, JSON.stringify(focus));
      await env.close();
    }
    for (const rm of ['reduce', 'no-preference']) {
      const env = await armedContext(browser, { viewport: { width: 390, height: 844 }, theme: THEMES[0], reducedMotion: rm });
      const page = await open(env.ctx, 'index.html');
      const a0 = await page.evaluate(() => document.getAnimations().length);
      const bb = await (await page.$(btn('granted'))).boundingBox();
      await page.mouse.move(bb.x + 5, bb.y + 5);
      const a1 = await page.evaluate(() => document.getAnimations().length);
      const d = await page.evaluate(() => {
        const bar = getComputedStyle(document.getElementById('consent-bar'));
        const b = getComputedStyle(document.querySelector('#consent-bar button'));
        return { barAnim: bar.animationName, barTransition: bar.transitionDuration, btnTransition: b.transitionDuration };
      });
      const cut = d.btnTransition.split(',').every((x) => parseFloat(x) < 0.001);
      if (rm === 'reduce') ck(a0 === 0 && a1 === 0 && d.barAnim === 'none' && cut, 'reduced motion: nothing animates, button transitions are cut', JSON.stringify({ a0, a1, ...d }));
      else ck(a0 === 0 && d.barAnim === 'none' && d.barTransition.split(',').every((x) => parseFloat(x) === 0), 'no preference: the bar itself does not animate in', JSON.stringify({ a0, ...d }));
      await env.close();
    }
  });

  // -------------------------------------------------------------------------------------------------
  await scenario('AXE with the bar visible (WCAG 2.0 to 2.2 A and AA)', async () => {
    const jobs = [];
    const vps = [[320, 568], [390, 844], [1440, 900]];
    for (const theme of THEMES) for (const [w, h] of vps) for (const p of PAGES_L) jobs.push({ theme, w, h, p, state: 'first' });
    for (const p of ['privacy.html', 'integritet.html']) jobs.push({ theme: THEMES[0], w: 390, h: 844, p, state: 'first' });
    for (const p of PAGES_L) jobs.push({ theme: THEMES[0], w: 390, h: 844, p, state: 'reopen' });
    const rows = await pool(jobs, 3, async (j) => {
      // bypassCSP only to inject axe, as a11y.js does; the policy itself is proven by csp.js and consent.js
      const env = await armedContext(browser, { viewport: { width: j.w, height: j.h }, theme: j.theme, bypassCSP: true });
      const page = await open(env.ctx, j.p);
      if (j.state === 'reopen') await reopen(page);
      const has = await page.evaluate(() => !!document.getElementById('consent-bar'));
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, node: v.nodes[0].target.join(' '), n: v.nodes.length }));
      });
      await env.close();
      return { ...j, has, res };
    });
    const bad = rows.filter((r) => r.res.length || !r.has).map((r) => `${r.theme} ${r.w}x${r.h} ${r.p.slice(0, 8)} ${r.state}: ${r.has ? r.res.map((v) => `${v.id} (${v.node})`).join(', ') : 'no bar'}`);
    ck(!bad.length, `axe finds no violation with the bar up (${rows.length} runs: ${THEMES.length} themes, 320, 390 and 1440 wide, en and sv, the notice pages with their panel, and the reopened bar)`, fail(bad, 6));
  });

  await browser.close();
  console.log('\ntimings: ' + timings.map(([n, s]) => `${n} ${s.toFixed(0)}s`).join(', ') + `; total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const problems = rep.problems;
  console.log(problems === 0 ? '\nPASS — the consent bar fits, never covers focus or the menu, and meets contrast and axe'
                             : `\nFAIL — ${problems} problem(s)`);
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
