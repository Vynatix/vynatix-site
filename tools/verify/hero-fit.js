// The hero fit (styles.css, "Hero fit"): when the page loads, the first screen is the hero.
//
// The hero is drawn in its own unit, --hero-u, which styles.css solves from the window's height, so that
// the header and the hero's message end exactly on the fold. Nothing is measured by
// script on the site, so the numbers in that solve are facts about the current copy, like the art's
// constants. This check measures them again and fails, naming the number, when a change to the copy, a
// typeface, the header or the hero's spacing has moved them.
//
//   M  Model. With the unit forced, the hero's height is the straight line styles.css solves:
//      --hero-f1 + --hero-k1 * u while the lede scales, --hero-f2 + --hero-k2 * u once it has stopped at
//      its floor, and --hero-wf + --hero-wk * u for the whole hero (to its bottom edge), the state with the
//      client row. At 1440px these are the lines with the art's room in them (styles.css, from 1100px). Also what
//      the line assumes: the headline's and the lede's line counts, and what stands above the hero.
//   F  Fold. At a table of real windows (laptops with the browser's own bars taken off, monitors, tablets,
//      phones at their small viewport height) the page is in the state the table expects and:
//        message  the buttons end above the fold, and the clients' rule lies on it (never above it, so
//                 the row is not cut half way); on the Swedish hub the hero ends on it
//        whole    the hero ends on the fold with the client row inside it
//        natural  the unit is 1px: the plain scrolling hero, at the design size
//      and in every state: no text under its floor, no horizontal scroll, nothing clipped.
//   E  Envelope. One pixel inside and outside each edge of the envelope, and a 200% browser zoom (half
//      the CSS viewport) of a laptop and of a large monitor: zooming in ends at full-size text.
//   S  Support. Without svh the hero is the plain one (the rules sit behind @supports), and so it is
//      on paper and, without JavaScript, at 904px and narrower, where the header is not sticky and
//      lists its links, so what stands above the hero is not what the solve assumes.
//
//   node verify/hero-fit.js                      (serve the repo root first, as for the other checks)
//   REPORT=1 node verify/hero-fit.js             prints every row of the table, not only the failures
//
// The four backgrounds are not this check's: bg-weave.js, bg-sheet.js, bg-dial.js and bg-iris.js prove
// the art against the text at the design size and at a scaled one. This one runs in the first theme of
// THEMES only: the two themes share every size.
const { BASE, THEMES, launch, pinTheme } = require('./_common.js');

const REPORT = !!process.env.REPORT;
const THEME = THEMES[0];
const TOL = 2;           // px: how far the solved line may be from the fold or from the measured height

// The windows. state: what the page must be in; exact: the line is exact there, so the rule (or the hero's
// end) lies on the fold within TOL; where it is not exact (the lede wraps by the window, not by its
// measure) the message only has to be above the fold. fit: false marks a window the hero is known not
// to fit (a phone too narrow or too short for its ten lines of lede at 16px): it is listed so that the
// floor, the overflow and the absence of clipping are still checked there.
const W = (w, h, state, o) => Object.assign({ w, h, state, exact: true, fit: true }, o);
const WINDOWS = {
  'index.html': [
    W(2560, 1440, 'whole'), W(1920, 1200, 'whole'), W(1440, 1300, 'whole'), W(1440, 1092, 'whole'), W(1024, 1290, 'whole'),
    W(1920, 1080, 'whole'), W(1440, 1060, 'whole'), W(1024, 864, 'whole'), W(1440, 1059, 'message'), W(1920, 950, 'message'), W(1680, 1000, 'message'), W(1440, 900, 'message'), W(1440, 790, 'message'),
    W(1536, 730, 'message'), W(1366, 768, 'message'), W(1366, 657, 'message'), W(1280, 720, 'message'), W(1200, 800, 'message'),
    W(1100, 760, 'message'), W(1099, 760, 'message'), W(1024, 700, 'message'), W(1024, 863, 'message'), W(834, 1120, 'whole'), W(768, 1000, 'whole'), W(768, 950, 'message'),
    W(700, 800, 'message', { exact: false }), W(640, 700, 'message', { exact: false }),
    W(430, 800, 'message', { exact: false }), W(412, 760, 'message', { exact: false }), W(390, 844, 'message'), W(390, 700, 'message'),
    W(390, 664, 'message', { exact: false }),
    W(375, 667, 'message', { fit: false }), W(360, 640, 'message', { fit: false }), W(320, 568, 'message', { fit: false }),
  ],
  'sv.html': [
    W(2560, 1440, 'message'), W(1920, 1080, 'message'), W(1440, 900, 'message'), W(1440, 790, 'message'), W(1536, 730, 'message'),
    W(1366, 657, 'message'), W(1280, 720, 'message'), W(1024, 700, 'message'), W(834, 1120, 'message'), W(768, 950, 'message'),
    W(700, 800, 'message', { exact: false }), W(430, 800, 'message'), W(390, 844, 'message'),
    W(390, 664, 'message', { fit: false }), W(360, 640, 'message', { fit: false }),
  ],
};
// The envelope's edges (styles.css): fitted from 650px of height at 600px and wider, from 520px on a
// phone; and browser zoom, which halves the CSS viewport at 200%.
const EDGES = [
  W(1440, 650, 'message'), W(1440, 649, 'natural'), W(600, 650, 'message', { exact: false }), W(600, 649, 'natural'),
  W(599, 520, 'message', { fit: false }), W(599, 519, 'natural'), W(390, 519, 'natural'),
  W(720, 450, 'natural', { zoom: '1440x900 at 200%' }), W(1280, 640, 'natural', { zoom: '2560x1280 at 200%' }),
  W(640, 360, 'natural', { zoom: '2560x1440 at 400%' }), W(360, 225, 'natural', { zoom: '1440x900 at 400%' }),
];

// Serialised into the page: the hero against the fold.
function measure() {
  const q = (s) => document.querySelector(s), box = (e) => (e ? e.getBoundingClientRect() : null);
  const hero = q('.hero'), cs = getComputedStyle(hero);
  const lines = (e) => { const g = document.createRange(); g.selectNodeContents(e); return new Set([...g.getClientRects()].filter((r) => r.width > 2).map((r) => Math.round(r.bottom))).size; };
  const h = box(hero), cta = box(q('.hero .hero__ctas')), cl = box(q('.hero .clients')), msg = q('.hero__msg');
  const px = (e, p) => parseFloat(getComputedStyle(e)[p]);
  return {
    fold: window.innerHeight,
    u: parseFloat(cs.getPropertyValue('--hero-u')),
    min: parseFloat(cs.getPropertyValue('--hero-min')),
    heroTop: h.top, heroBottom: h.bottom, cta: cta.bottom, rule: cl ? cl.top : null, rowEnd: cl ? cl.bottom : null,
    h1: px(q('.hero__h1'), 'fontSize'), lede: px(q('.hero__lede'), 'fontSize'), eyebrow: px(q('.hero .eyebrow'), 'fontSize'),
    button: Math.min(...[...document.querySelectorAll('.hero .hero__ctas .btn')].map((b) => b.getBoundingClientRect().height)),
    h1Lines: lines(q('.hero__h1')), ledeLines: lines(q('.hero__lede')),
    above: box(q('.site-header')).bottom,
    aboveVar: parseFloat(cs.getPropertyValue('--hero-above')),
    hscroll: document.documentElement.scrollWidth - window.innerWidth,
    clip: [hero, msg, q('.hero > .container')].filter(Boolean).map((e) => getComputedStyle(e).overflowY).filter((v) => v !== 'visible'),
    // Nothing of the message hangs out of the hero's own box (a height, where a min-height belongs, would do that).
    spill: Math.max(0, cta.bottom - h.bottom, cl ? cl.bottom - h.bottom : 0),
  };
}

(async () => {
  const browser = await launch();
  let problems = 0, rows = 0;
  const check = (ok, name, detail) => {
    if (!ok) problems++;
    if (!ok || REPORT) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
  };
  const say = (ok, name, detail) => { if (!ok) problems++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`); };

  async function open(file, w, h, opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }, opts));
    const page = await ctx.newPage();
    const seen = [];
    page.on('console', (m) => { if (m.type() === 'error') seen.push(m.text()); });
    page.on('pageerror', (e) => seen.push(String(e)));
    await page.addInitScript(pinTheme, { theme: THEME, bg: 'sheet' });
    await page.goto(BASE + file, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { ctx, page, seen };
  }

  // --- M. The model -------------------------------------------------------------------------
  // The unit is forced through a style element (the context bypasses the CSP for it) in a window tall
  // enough that nothing but the unit sets the hero's height, in the plain block layout the line is for.
  for (const file of ['index.html', 'sv.html']) {
    const index = file === 'index.html';
    const { ctx, page } = await open(file, 1440, 600, { bypassCSP: true });
    const at = async (u) => {
      await page.evaluate((v) => {
        let s = document.getElementById('hero-fit-force');
        if (!s) { s = document.createElement('style'); s.id = 'hero-fit-force'; document.head.appendChild(s); }
        s.textContent = `.hero{--hero-u:${v}px !important;min-height:0 !important}`;
      }, u);
      return page.evaluate(measure);
    };
    const vars = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.hero'));
      const o = {}; for (const k of ['f1', 'k1', 'f2', 'k2', 'h', 'wf', 'wk']) o[k] = parseFloat(cs.getPropertyValue('--hero-' + k));
      return o;
    });
    // The window here is under the envelope, so the page is in the natural state and the forced unit is all that moves.
    const end = (m) => (index ? m.rule : m.heroBottom) - m.heroTop;
    for (const [u, f, k, name] of [[1, vars.f1, vars.k1, 'f1 + k1'], [0.9, vars.f1, vars.k1, 'f1 + k1'], [0.7, vars.f2, vars.k2, 'f2 + k2'], [0.5, vars.f2, vars.k2, 'f2 + k2']]) {
      const m = await at(u), want = f + k * u, got = end(m);
      say(Math.abs(got - want) <= TOL && got <= want + 1, `M  ${file}: at u = ${u} the ${index ? 'message (to the clients\' rule)' : 'hero'} is ${got.toFixed(1)}px, the line --hero-${name.replace(' + ', ' + --hero-')} * u gives ${want.toFixed(1)}`,
        Math.abs(got - want) <= TOL && got <= want + 1 ? '' : 'refit the two numbers in styles.css ("Hero fit") from this measurement and one at another u; the line may be under the measurement by a pixel at most');
    }
    const one = await at(1);
    say(one.h1Lines === 2 && one.ledeLines === (index ? 2 : 5), `M  ${file}: the headline is ${one.h1Lines} lines and the lede ${one.ledeLines} at 1440px (the line assumes ${index ? '2 and 2' : '2 and 5'})`);
    say(Math.abs(one.above - one.aboveVar) <= 0.5, `M  ${file}: ${one.above}px stand above the hero, --hero-above is ${one.aboveVar}px`);
    // The headline's share of the slope: two lines at the headline's leading, 1.05.
    const lh = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.hero__h1')).lineHeight) / parseFloat(getComputedStyle(document.querySelector('.hero__h1')).fontSize));
    say(Math.abs(vars.h - 2 * lh * 96) <= 0.5, `M  ${file}: --hero-h ${vars.h} is 2 headline lines of 96 at a leading of ${lh.toFixed(2)}`);
    if (index) {
      // The whole hero, for the state with the client row: --hero-wf + --hero-wk * u.
      for (const u of [1, 0.85]) {
        const m = await at(u), want = vars.wf + vars.wk * u, got = m.heroBottom - m.heroTop;
        say(Math.abs(got - want) <= TOL && got <= want + 1, `M  ${file}: at u = ${u} the whole hero is ${got.toFixed(1)}px, the line --hero-wf + --hero-wk * u gives ${want.toFixed(1)}`);
      }
    }
    await ctx.close();
  }

  // --- F. The fold, and E. the envelope --------------------------------------------------------
  async function row(file, win, tag) {
    const index = file === 'index.html';
    const { ctx, page, seen } = await open(file, win.w, win.h);
    const m = await page.evaluate(measure);
    rows++;
    const name = `${tag}  ${file} ${win.w}x${win.h}${win.zoom ? ' (' + win.zoom + ')' : ''}`;
    const fitted = Math.abs(m.u - 1) > 1e-6 || win.state !== 'natural';
    if (win.state === 'natural') {
      check(Math.abs(m.u - 1) < 1e-6, `${name}: natural, the unit is 1px`, `--hero-u is ${m.u}px`);
      check(m.h1 >= 40 && m.lede >= (index && win.w < 600 ? 18 : 22), `${name}: natural, the text is at the design size`, `headline ${m.h1}px, lede ${m.lede}px`);
    } else {
      check(m.u >= m.min - 1e-6 && m.u <= 1 + 1e-6, `${name}: the unit ${m.u.toFixed(3)}px is between its floor ${m.min}px and 1px`);
      if (win.fit) check(m.cta <= m.fold - 8, `${name}: the buttons end above the fold`, `they end ${(m.cta - m.fold).toFixed(1)}px ${m.cta > m.fold ? 'below' : 'above'} it (unit ${m.u.toFixed(3)}px)`);
      if (win.state === 'whole') {
        check(Math.abs(m.heroBottom - m.fold) <= TOL, `${name}: whole, the hero ends on the fold`, `it ends ${(m.heroBottom - m.fold).toFixed(1)}px from it`);
        check(m.rowEnd <= m.fold, `${name}: whole, the client row is on the first screen`, `it ends ${(m.rowEnd - m.fold).toFixed(1)}px below the fold`);
      } else if (index) {
        // Never above the fold: a row that starts on the first screen and ends under it is the cut the fit removes.
        check(m.rule >= m.fold - TOL, `${name}: message, the clients' rule is not above the fold`, `it is ${(m.fold - m.rule).toFixed(1)}px above it, so the row is cut`);
        if (win.fit && win.exact) check(m.rule <= m.fold + TOL, `${name}: message, the clients' rule lies on the fold`, `it is ${(m.rule - m.fold).toFixed(1)}px below it`);
      } else {
        check(m.heroBottom >= m.fold - TOL, `${name}: message, the hero reaches the fold`, `it ends ${(m.fold - m.heroBottom).toFixed(1)}px above it`);
        if (win.fit && win.exact) check(m.heroBottom <= m.fold + TOL, `${name}: message, the hero ends on the fold`, `it ends ${(m.heroBottom - m.fold).toFixed(1)}px below it`);
      }
    }
    // Floors, in every state: the lede never under 16px (18px from 600px up), the eyebrow and the buttons at their own size.
    const ledeFloor = index && win.w < 600 ? 16 : 18;
    check(m.lede >= ledeFloor - 0.01, `${name}: the lede is ${m.lede}px (floor ${ledeFloor})`);
    check(m.eyebrow >= 11 && m.button >= 44, `${name}: the eyebrow (${m.eyebrow}px) and the buttons (${m.button}px high) keep their size`);
    check(m.hscroll <= 0, `${name}: no horizontal scroll`, `${m.hscroll}px`);
    check(!m.clip.length && m.spill <= 0.5, `${name}: nothing is clipped`, m.clip.length ? 'overflow-y: ' + m.clip.join(', ') : `the content ends ${m.spill.toFixed(1)}px under the hero's box`);
    if (seen.length) check(false, `${name}: console`, seen.join(' | '));
    if (REPORT) console.log(`     ${fitted ? 'u ' + m.u.toFixed(3) : 'natural'}  headline ${m.h1.toFixed(1)}  lede ${m.lede}  buttons ${(m.cta - m.fold).toFixed(0)}  ${m.rule === null ? '' : 'rule ' + (m.rule - m.fold).toFixed(1) + '  '}hero ${(m.heroBottom - m.fold).toFixed(1)}`);
    await ctx.close();
  }
  const before = problems;
  for (const file of Object.keys(WINDOWS)) for (const win of WINDOWS[file]) await row(file, win, 'F');
  say(problems === before, `F  the fold: ${rows} windows on index.html and sv.html are in the state the table expects, with the buttons above the fold, the clients' rule on it (or the whole hero inside it), no text under its floor and nothing clipped`);
  const beforeE = problems, rowsF = rows;
  for (const file of ['index.html', 'sv.html']) for (const win of EDGES) await row(file, win, 'E');
  say(problems === beforeE, `E  the envelope: ${rows - rowsF} windows one pixel either side of its edges and under browser zoom; outside it the hero is the plain one at the design size`);

  // --- S. Support ------------------------------------------------------------------------------
  // The fit rules sit behind @supports (height: 100svh), read from the stylesheet (Chromium cannot be
  // made to forget svh): outside that block nothing may set the unit or use svh.
  {
    const { ctx, page } = await open('index.html', 1440, 900);
    const r = await page.evaluate(() => {
      const sheet = [...document.styleSheets].find((s) => /\/styles\.css/.test(s.href || ''));
      const out = { gated: 0, loose: [] };
      const walk = (rules, gated) => {
        for (const rule of rules) {
          const g = gated || (rule instanceof CSSSupportsRule && /100svh/.test(rule.conditionText));
          if (rule.cssRules && rule.cssRules.length && !(rule instanceof CSSStyleRule)) { walk(rule.cssRules, g); continue; }
          if (!(rule instanceof CSSStyleRule)) continue;
          const u = rule.style.getPropertyValue('--hero-u'), mh = rule.style.getPropertyValue('min-height');
          if (u && u.trim() !== '1px') { if (g) out.gated++; else out.loose.push(rule.selectorText + ' { --hero-u: ' + u + ' }'); }
          if (/svh/.test(mh) || /hero-room/.test(mh)) { if (!g) out.loose.push(rule.selectorText + ' { min-height: ' + mh + ' }'); }
        }
      };
      walk(sheet.cssRules, false);
      return out;
    });
    say(r.gated >= 1 && !r.loose.length, 'S  the unit is only changed, and the window\'s height only used, inside @supports (height: 100svh)', r.loose.join('; '));
    await ctx.close();
  }

  // Without JavaScript the narrow header is static and lists its links, so it is taller than --hero-above:
  // the hero is the plain one there. On paper there is no fold.
  for (const [what, w, h, opts, media] of [['without JavaScript at 390x700', 390, 700, { javaScriptEnabled: false }], ['without JavaScript at 900x800', 900, 800, { javaScriptEnabled: false }], ['on paper', 1440, 900, {}, 'print']]) {
    for (const file of ['index.html', 'sv.html']) {
      const { ctx, page } = await open(file, w, h, opts);
      if (media) await page.emulateMedia({ media });
      const m = await page.evaluate(() => {
        const hero = document.querySelector('.hero'), msg = document.querySelector('.hero__msg');
        return { u: parseFloat(getComputedStyle(hero).getPropertyValue('--hero-u')), min: [hero, msg].filter(Boolean).map((e) => getComputedStyle(e).minHeight) };
      });
      say(Math.abs(m.u - 1) < 1e-6 && m.min.every((v) => v === '0px' || v === 'auto'), `S  ${file} ${what}: the plain hero (unit 1px, no minimum height)`, `--hero-u ${m.u}px, min-height ${m.min.join(' and ')}`);
      await ctx.close();
    }
  }
  // With JavaScript off and a wide window the header is the sticky one, so the fit holds without script.
  {
    const { ctx, page } = await open('index.html', 1440, 790, { javaScriptEnabled: false });
    const m = await page.evaluate(measure);
    say(m.u < 1 && Math.abs(m.rule - m.fold) <= TOL && m.cta <= m.fold - 8, 'S  index.html without JavaScript at 1440x790: fitted, the clients\' rule on the fold', `unit ${m.u}px, rule ${(m.rule - m.fold).toFixed(1)}px from the fold`);
    await ctx.close();
  }

  await browser.close();
  console.log(problems ? `hero-fit: ${problems} failing` : 'hero-fit: ok');
  process.exit(problems ? 1 : 0);
})();
