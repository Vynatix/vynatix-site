// The hero fit (styles.css, "Hero fit"): when the page loads, the first screen is the hero. Scope: root, the home
// page of each written language, the two pages the Hero fit block solves for (a generated home page's headline is
// held to its two lines by i18n.js).
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
//      client row. At 1440px these are the English hero's own lines, with the 96 of the plain hero under its
//      buttons (the art's room of 336 is gone since 24 November 2026). Also what
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
//   W  Write, with --write only, before everything above. Each line that M proves is solved from the same
//      two measurements M takes of it (LINES): the slope is the rise between them per unit, rounded to a
//      whole number, and the fixed part is the mean of what that slope leaves at the two, rounded to a
//      whole pixel. On the pinned browser (tools/package.json) that rule gives back every committed number
//      exactly, which is the condition it was introduced on. A line is written only when M fails for it
//      with the committed numbers: two of today's slopes come out at 489.53 and 457.58, so a sixty-fourth
//      of a pixel or two in one measurement rounds them the other way, another build of the browser could
//      solve a different number for a line that still passes, and a passing line is never rewritten. The
//      solved and the committed numbers are printed for every line either way, and then the check runs
//      as usual on the file as written, so its verdict is the verdict on the new numbers.
//      It writes the ten numbers of the three lines measured at 1440px (--hero-f1, --hero-k1, --hero-f2
//      and --hero-k2 on both home pages, --hero-wf and --hero-wk on the English one) and nothing else.
//      The phone lines are not measured (under 600px the lede wraps by the window, so its line count
//      moves with the unit and there is no straight line to measure), and the floors (--hero-min),
//      --hero-above, --hero-h, --hero-hw and the heights of the states in the media queries are not
//      lines: they stay numbers a person sets. It writes nothing at all when BASE does not serve this
//      tree's two home pages and stylesheets (SOURCES) or a pair is not on a line of its own in its rule,
//      and nothing for a page whose headline or lede is not the two lines that the lines and --hero-h
//      assume, because that is a new model, not a refit.
//
//   node verify/hero-fit.js                      (serve the repo root first, as for the other checks)
//   REPORT=1 node verify/hero-fit.js             prints every row of the table, not only the failures
//   node verify/hero-fit.js --write              refits the lines that fail (W), then runs the check;
//                                                after a write, run npm run stamp and npm run check:bg
//
// The hero's background is not this check's: bg-sheet.js proves the art against the text at the design
// size and, through bg-fit.js, at a scaled one. This one runs in the first theme of
// THEMES only: the two themes share every size.
const fs = require('fs');
const path = require('path');
const { ROOT, BASE, THEMES, launch, pinTheme, scopeLine } = require('./_common.js');

const REPORT = !!process.env.REPORT;
const WRITE = process.argv.includes('--write');
const THEME = THEMES[0];
const TOL = 2;           // px: how far the solved line may be from the fold or from the measured height

// The lines of the model and the two units each one is measured at. M holds a line to its two
// measurements and W fits the line through the same two, so the check and the refit cannot disagree
// about the points. The units matter: the hero's height is not exactly straight between them (while
// the lede scales it grows by 576px per unit between 1 and 0.95 and by 556px between 0.95 and 0.9),
// so a line through other units would come out with other numbers. The whole hero's line is the
// English page's only.
const LINES = [
  { f: 'f1', k: 'k1', us: [1, 0.9] },
  { f: 'f2', k: 'k2', us: [0.7, 0.5] },
  { f: 'wf', k: 'wk', us: [1, 0.85], whole: true },
];
// The rule in the Hero fit block of styles.css that holds each page's lines: the Swedish hub's hero is
// the plain .hero, the English one is the hero with the client row.
const RULES = { 'index.html': '.hero.hero--clients', 'sv.html': '.hero' };
// How M accepts a line at one measurement: within TOL of it, and under it by a pixel at most.
const fits = (got, want) => Math.abs(got - want) <= TOL && got <= want + 1;
const REFIT = 'node verify/hero-fit.js --write refits the two numbers in styles.css ("Hero fit") from this measurement and the line\'s other one; by hand, the line may be under the measurement by a pixel at most';

// The windows. state: what the page must be in; exact: the line is exact there, so the rule (or the hero's
// end) lies on the fold within TOL; where it is not exact (the lede wraps by the window, not by its
// measure) the message only has to be above the fold. fit: false marks a window the hero is known not
// to fit (a phone too narrow or too short for its ten lines of lede at 16px): it is listed so that the
// floor, the overflow and the absence of clipping are still checked there.
const W = (w, h, state, o) => Object.assign({ w, h, state, exact: true, fit: true }, o);
const WINDOWS = {
  'index.html': [
    W(2560, 1440, 'whole'), W(1920, 1200, 'whole'), W(1440, 1300, 'whole'), W(1440, 1092, 'whole'), W(1024, 1290, 'whole'),
    W(1920, 1080, 'whole'), W(1440, 1060, 'whole'), W(1024, 864, 'whole'), W(1920, 950, 'whole'), W(1680, 1000, 'whole'), W(1440, 900, 'whole'),
    W(1440, 864, 'whole'), W(1440, 863, 'message'), W(1440, 790, 'message'), W(1440, 700, 'message'),
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
  console.log(scopeLine('root', Object.keys(RULES), { feature: 'the home page of each written language, the pages the Hero fit block solves for' }));
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
    await page.addInitScript(pinTheme, THEME);
    await page.goto(BASE + file, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { ctx, page, seen };
  }

  // --- M. The model -------------------------------------------------------------------------
  // The unit is forced through a style element (the context bypasses the CSP for it) in a window tall
  // enough that nothing but the unit sets the hero's height, in the plain block layout the line is for.
  // model() measures a page and prove() holds the numbers in force to the measurements; W uses the
  // same measurements to solve the numbers.
  async function model(file) {
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
    // A line of the message ends at the clients' rule on the English page and at the hero's bottom edge on the
    // Swedish hub; the whole hero's line ends at the hero's bottom edge.
    const end = (m, whole) => (index && !whole ? m.rule : m.heroBottom) - m.heroTop;
    const points = {};
    for (const line of LINES) {
      if (line.whole && !index) continue;
      points[line.f] = [];
      for (const u of line.us) points[line.f].push({ u, got: end(await at(u), line.whole) });
    }
    const one = await at(1);
    // The headline's share of the slope: two lines at the headline's leading, 1.05.
    const lh = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.hero__h1')).lineHeight) / parseFloat(getComputedStyle(document.querySelector('.hero__h1')).fontSize));
    await ctx.close();
    return { file, index, vars, points, one, lh };
  }
  function prove({ file, index, vars, points, one, lh }) {
    const hold = (line, what) => {
      for (const { u, got } of points[line.f]) {
        const want = vars[line.f] + vars[line.k] * u, ok = fits(got, want);
        say(ok, `M  ${file}: at u = ${u} the ${what} is ${got.toFixed(1)}px, the line --hero-${line.f} + --hero-${line.k} * u gives ${want.toFixed(1)}`, ok ? '' : REFIT);
      }
    };
    for (const line of LINES) if (!line.whole) hold(line, index ? 'message (to the clients\' rule)' : 'hero');
    say(one.h1Lines === 2 && one.ledeLines === 2, `M  ${file}: the headline is ${one.h1Lines} lines and the lede ${one.ledeLines} at 1440px (the line assumes 2 and 2)`);
    say(Math.abs(one.above - one.aboveVar) <= 0.5, `M  ${file}: ${one.above}px stand above the hero, --hero-above is ${one.aboveVar}px`);
    say(Math.abs(vars.h - 2 * lh * 96) <= 0.5, `M  ${file}: --hero-h ${vars.h} is 2 headline lines of 96 at a leading of ${lh.toFixed(2)}`);
    // The whole hero, for the state with the client row: --hero-wf + --hero-wk * u.
    if (index) for (const line of LINES) if (line.whole) hold(line, 'whole hero');
  }

  // --- W. The refit (--write) ------------------------------------------------------------------
  // The line through two measurements, in whole numbers: the slope rounded first, then the fixed part
  // that the rounded slope leaves at the two, averaged and rounded. (The fixed part is not taken from the
  // unrounded slope: the English message's first line meets the axis at 65.5px exactly, so the last bit
  // of a division would decide between 65 and 66.)
  const solve = (pts) => {
    const k = Math.round((pts[0].got - pts[1].got) / (pts[0].u - pts[1].u));
    return { f: Math.round(pts.reduce((s, p) => s + p.got - k * p.u, 0) / pts.length), k };
  };
  // Finds the one declaration line of a pair in a page's rule of the Hero fit block, where every pair
  // stands on a line of its own, "  --hero-f1: 66px;  --hero-k1: 566;". The phone lines repeat the same
  // names on one-line rules inside a media query, and are not matched: the rule has to start a line.
  const FIT = /\/\* -{10,}\n\s*Hero fit: /;
  function pairLine(css, selector, line) {
    const head = FIT.exec(css);
    if (!head) throw new Error('styles.css has no "Hero fit" block');
    const next = css.indexOf('\n/* ---', head.index + head[0].length);
    const block = [head.index, next < 0 ? css.length : next];
    const open = `\n${selector} {\n`;
    const starts = [];
    for (let i = css.indexOf(open, block[0]); i >= 0 && i < block[1]; i = css.indexOf(open, i + 1)) starts.push(i);
    if (starts.length !== 1) throw new Error(`the Hero fit block of styles.css has ${starts.length} rules "${selector} {" that start a line, not one`);
    const body = [starts[0] + open.length, css.indexOf('\n}', starts[0] + open.length)];
    const re = new RegExp(String.raw`^  --hero-${line.f}: (-?\d+(?:\.\d+)?)px; +--hero-${line.k}: (-?\d+(?:\.\d+)?);$`, 'gm');
    const found = [...css.slice(body[0], body[1]).matchAll(re)];
    if (found.length !== 1) throw new Error(`the rule "${selector}" of the Hero fit block has ${found.length} lines "  --hero-${line.f}: Npx; --hero-${line.k}: N;", not one`);
    const from = body[0] + found[0].index;
    return { from, to: from + found[0][0].length, f: Number(found[0][1]), k: Number(found[0][2]) };
  }
  // The pair as it is written, the second declaration in the column the block uses.
  const pairText = (line, n) => `  ${`--hero-${line.f}: ${n.f}px;`.padEnd(17)} --hero-${line.k}: ${n.k};`;

  // The files the lines are facts about: the two pages' copy and the stylesheets that lay out their heroes.
  const SOURCES = ['styles.css', 'tokens.css', 'colors_and_type.css', 'hero-bg.css', ...Object.keys(RULES)];
  async function refit() {
    const file = path.join(ROOT, 'styles.css');
    const css = fs.readFileSync(file, 'utf8');
    // What is measured is what BASE serves and what is written is this tree: they have to be the same files.
    for (const name of SOURCES) {
      let served = null;
      try { const res = await fetch(new URL(name, BASE)); if (res.ok) served = await res.text(); } catch (e) { /* not served */ }
      if (served !== fs.readFileSync(path.join(ROOT, name), 'utf8')) {
        say(false, `W  ${new URL(name, BASE)} is not this tree's ${name} (${path.join(ROOT, name)}): serve the repository root this script sits in, so that what is measured is what is written; nothing written`);
        return;
      }
    }
    const edits = [];
    try {
      for (const page of Object.keys(RULES)) {
        const r = await model(page);
        if (r.one.h1Lines !== 2 || r.one.ledeLines !== 2) {
          say(false, `W  ${page}: the headline is ${r.one.h1Lines} lines and the lede ${r.one.ledeLines} at 1440px, and the lines and --hero-h assume 2 and 2: that is a new model, not a refit, so nothing is written for this page (AGENTS.md, Hero fit)`);
          continue;
        }
        for (const line of LINES) {
          const pts = r.points[line.f];
          if (!pts) continue;
          const at = pairLine(css, RULES[page], line), was = { f: r.vars[line.f], k: r.vars[line.k] }, s = solve(pts);
          // The numbers in force at 1440px must be the ones in the rule written here, or the write would miss.
          if (at.f !== was.f || at.k !== was.k) throw new Error(`${page}: --hero-${line.f} and --hero-${line.k} are ${was.f}px and ${was.k} at 1440px but ${at.f}px and ${at.k} in "${RULES[page]}" of the Hero fit block`);
          // Through two measurements the solved line always holds: rounding the fixed part moves it half a
          // pixel at most and rounding the slope tilts it a quarter of a pixel at most at either measurement,
          // so it is never more than 0.75px from either, inside what M accepts. The test stays for a change to solve()
          // or to LINES (a third unit, say) after which that is no longer so.
          const holds = (n) => pts.every(({ u, got }) => fits(got, n.f + n.k * u));
          const said = `W  ${page}: --hero-${line.f} and --hero-${line.k} through ${pts.map(({ u, got }) => `${got.toFixed(3)}px at u = ${u}`).join(' and ')}: solved ${s.f}px and ${s.k}, committed ${was.f}px and ${was.k}`;
          if (holds(was)) say(true, `${said}, ${s.f === was.f && s.k === was.k ? 'the same' : 'and the committed ones still pass, so they are left as they are'}`);
          else if (!holds(s)) say(false, `${said}: the solved line does not hold at both measurements either, so nothing is written for it; refit it by hand`);
          else { say(true, `${said}: the committed ones fail, so the solved ones are to be written`); edits.push({ at, text: pairText(line, s) }); }
        }
      }
    } catch (e) {
      say(false, `W  ${e.message}; nothing written`);
      return;
    }
    if (!edits.length) { console.log('     W  nothing to write: styles.css is unchanged'); return; }
    let out = css;
    for (const { at, text } of edits.sort((a, b) => b.at.from - a.at.from)) out = out.slice(0, at.from) + text + out.slice(at.to);
    fs.writeFileSync(file, out);
    console.log(`     W  wrote ${edits.length * 2} numbers into styles.css ("Hero fit"); the check below runs on them. Then run npm run stamp (styles.css changed) and npm run check:bg (the sheet is placed from the same boxes)`);
  }
  if (WRITE) await refit();

  for (const file of Object.keys(RULES)) prove(await model(file));

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
  // With JavaScript off and a wide window the header is the sticky one, so the fit holds without script. (At 1440 wide
  // the English hero is at the design size from 710px of height, so the window is one where the unit is solved below 1.)
  {
    const { ctx, page } = await open('index.html', 1440, 700, { javaScriptEnabled: false });
    const m = await page.evaluate(measure);
    say(m.u < 1 && Math.abs(m.rule - m.fold) <= TOL && m.cta <= m.fold - 8, 'S  index.html without JavaScript at 1440x700: fitted, the clients\' rule on the fold', `unit ${m.u}px, rule ${(m.rule - m.fold).toFixed(1)}px from the fold`);
    await ctx.close();
  }

  await browser.close();
  console.log(problems ? `hero-fit: ${problems} failing` : 'hero-fit: ok');
  process.exit(problems ? 1 : 0);
})();
