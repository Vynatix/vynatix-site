// The hero background draw, and what keeps the four backgrounds apart. The home hero carries one of four
// decorative backgrounds (weave, sheet, dial, iris), drawn at random for each visit like the colour scheme:
// app.js keeps the pick in sessionStorage ("vynatix-bg"), sets data-bg on <html> before first paint, and every
// background rule and feature is scoped to its own value. This proves the draw (odds, a stable visit, bad and
// blocked storage, no JavaScript), that only the drawn background has any effect (asset requests, script
// calls, storage keys, other pages), that what the site stores is exactly what privacy.html lists, that the
// iris's test hook stays a read-only test hook, and that the source keeps its structure (fenced blocks, every
// rule scoped). The checks of the draw itself leave it alone, because the draw is what is under test; the
// isolation checks pin one background (or force it through the site's own draw) to look at it by itself. The
// clearance, contrast and motion of each background are proved by bg-weave.js, bg-sheet.js, bg-dial.js and
// bg-iris.js.
//
//   node verify/bg-draw.js              (serve the repo root first, as for the other checks)
//   VISITS=200 node verify/bg-draw.js   more fresh visits for the odds
const { BASE, ALL_BGS, pinTheme, launch, PAGES } = require('./_common');
const { PNG } = require('pngjs');

const VISITS = Number(process.env.VISITS || 100);
const ids = ALL_BGS;
const url = (p) => `${BASE}${p}.html`;
const HOME = url('index');

let problems = 0;
const check = (ok, name, detail) => {
  if (!ok) problems++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const dataBg = (page) => page.evaluate(() => document.documentElement.getAttribute('data-bg'));
const stored = (page) => page.evaluate(() => { try { return sessionStorage.getItem('vynatix-bg'); } catch (e) { return 'blocked'; } });

// Records, before any page script runs, every call that could start something: listeners, timers, frames,
// idle callbacks, observers, Web Animations and storage writes. Serialised into the page.
function instrument() {
  var log = window.__calls = [];
  function wrap(obj, name, key) {
    var orig = obj[name];
    if (!orig) return;
    obj[name] = function () { try { log.push(key(arguments, this)); } catch (e) { /* never break the page */ } return orig.apply(this, arguments); };
  }
  function who(t) { return t === window ? 'window' : t === document ? 'document' : t && t.nodeType ? 'element' : 'other'; }
  wrap(EventTarget.prototype, 'addEventListener', function (a, t) { return 'listener ' + a[0] + ' ' + who(t); });
  wrap(window, 'setTimeout', function () { return 'timer'; });
  wrap(window, 'setInterval', function () { return 'interval'; });
  wrap(window, 'requestAnimationFrame', function () { return 'frame'; });
  wrap(window, 'requestIdleCallback', function () { return 'idle'; });
  wrap(Element.prototype, 'animate', function () { return 'animate'; });
  ['IntersectionObserver', 'MutationObserver', 'ResizeObserver'].forEach(function (n) {
    var Orig = window[n];
    if (!Orig) return;
    window[n] = class extends Orig { constructor() { log.push('observer ' + n); super(...arguments); } };
  });
  wrap(Storage.prototype, 'setItem', function (a, t) { return 'store ' + (t === window.localStorage ? 'local' : 'session') + ' ' + a[0]; });
  wrap(Storage.prototype, 'removeItem', function (a, t) { return 'remove ' + (t === window.localStorage ? 'local' : 'session') + ' ' + a[0]; });
}
// Reaches one background through the site's own draw (app.js picks it and writes the keys), by making Math.random
// return a fixed value before any page script runs: 0.1 is the weave, 0.3 the sheet, 0.6 the dial, 0.9 the iris
// (the draw is floor(random * 4) over weave, sheet, dial, iris). The colour draw takes the same value, so these
// also give Forest, Forest, Teal and Monochrome; nothing here depends on it.
const R = { weave: 0.1, sheet: 0.3, dial: 0.6, iris: 0.9 };
const forceDraw = (page, bg) => page.addInitScript((r) => { Math.random = () => r; }, R[bg]);
const tally = (calls) => calls.reduce((m, c) => { m[c] = (m[c] || 0) + 1; return m; }, {});
const diff = (a, b) => Object.keys(Object.assign({}, a, b)).filter((k) => (a[k] || 0) !== (b[k] || 0))
  .map((k) => `${k} ${(a[k] || 0)}->${(b[k] || 0)}`);

(async () => {
  const browser = await launch();

  // ---- 1. Odds: a fresh visit (a new tab, so new session storage) draws one of four; all four turn up. -----
  {
    const ctx = await browser.newContext();
    const t = Object.fromEntries(ids.map((i) => [i, 0]));
    let bad = 0;
    for (let i = 0; i < VISITS; i++) {
      const page = await ctx.newPage();
      await page.goto(HOME, { waitUntil: 'domcontentloaded' });
      const v = await dataBg(page), s = await stored(page);
      if (ids.includes(v) && v === s) t[v]++; else bad++;
      await page.close();
    }
    // Equal odds of 1 in 4: over 100 visits a count outside 7 to 48 is a one in twenty thousand event or rarer.
    // Scaled to VISITS, so a longer run keeps the same false-alarm rate.
    const lo = Math.max(1, Math.floor(VISITS * 0.07)), hi = Math.ceil(VISITS * 0.48);
    check(bad === 0 && ids.every((i) => t[i] >= lo && t[i] <= hi),
      `a fresh visit draws one background, and over ${VISITS} visits each of the four turns up between ${lo} and ${hi} times`, JSON.stringify(t) + (bad ? `; ${bad} visits with a missing or mismatched draw` : ''));
    await ctx.close();
  }

  // ---- 2. One visit stays on one background: every page of the site, Swedish hub included, and a reload. ----
  {
    const ctx = await browser.newContext();
    const pages = ['index', 'about', 'services', 'work', 'membership', 'contact', 'privacy', 'terms', 'accessibility', 'sv', 'index'];
    let stable = true; const drew = [];
    for (let visit = 0; visit < 6; visit++) {
      const page = await ctx.newPage();
      const seen = new Set();
      for (const p of pages) { await page.goto(url(p), { waitUntil: 'domcontentloaded' }); seen.add(await dataBg(page)); }
      await page.reload({ waitUntil: 'domcontentloaded' });
      seen.add(await dataBg(page));
      if (seen.size !== 1 || ![...seen].every((v) => ids.includes(v))) stable = false;
      drew.push([...seen].join('+'));
      await page.close();
    }
    check(stable, 'the draw is stable across ten pages (sv.html included) and a reload within a visit', `six visits drew ${drew.join(', ')}`);
    await ctx.close();
  }

  // ---- 3. A stored value that is not one of the four is discarded, never used. ----------------------------
  {
    const ctx = await browser.newContext();
    const bad = [];
    const poison = ['<img src=x onerror=1>', '__proto__', 'constructor', 'toString', '', 'Sheet', 'weave ', 'iris,dial', 'null'];
    for (const v of poison) {
      const page = await ctx.newPage();
      await page.addInitScript((x) => { try { sessionStorage.setItem('vynatix-bg', x); } catch (e) { /* blocked */ } }, v);
      await page.goto(HOME, { waitUntil: 'domcontentloaded' });
      const got = await dataBg(page), s = await stored(page);
      if (!ids.includes(got) || got !== s) bad.push(JSON.stringify(v));
      await page.close();
    }
    check(bad.length === 0, 'an unknown stored background is replaced by a valid draw', bad.length ? 'accepted: ' + bad.join(' | ') : `${poison.length} bad values`);
    await ctx.close();
  }

  // ---- 4. Blocked storage: the sheet on every page, nothing thrown. -------------------------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const block = { get() { throw new DOMException('blocked', 'SecurityError'); } };
      Object.defineProperty(window, 'sessionStorage', block);
      Object.defineProperty(window, 'localStorage', block);
    });
    const seen = [];
    for (const p of ['index', 'about', 'sv', 'index']) {
      await page.goto(url(p), { waitUntil: 'load' });
      seen.push(await dataBg(page));
    }
    check(seen.every((v) => v === 'sheet') && errors.length === 0, 'blocked storage: every page gets the sheet and nothing throws', `${seen.join(',')}${errors.length ? '; errors ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ---- 5. No JavaScript: no attribute at all, and the hero renders as the sheet. ------------------------------
  {
    const shot = async (opts, pin) => {
      const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, opts));
      const page = await ctx.newPage();
      if (pin) await page.addInitScript(pinTheme, { theme: 'light', bg: 'sheet' });
      await page.goto(HOME, { waitUntil: 'load' });
      await page.waitForTimeout(600);
      const attr = await page.$eval('html', (el) => el.hasAttribute('data-bg'));
      // Below the header: without script the header's two script-only controls are not there.
      const png = await page.screenshot({ clip: { x: 0, y: 96, width: 1440, height: 804 }, animations: 'disabled' });
      await ctx.close();
      return { attr, png: PNG.sync.read(png) };
    };
    const off = await shot({ javaScriptEnabled: false }, false);
    const sheet = await shot({}, true);
    let n = 0;
    if (off.png.width === sheet.png.width && off.png.height === sheet.png.height) {
      for (let i = 0; i < off.png.data.length; i += 4) {
        if (off.png.data[i] !== sheet.png.data[i] || off.png.data[i + 1] !== sheet.png.data[i + 1] || off.png.data[i + 2] !== sheet.png.data[i + 2]) n++;
      }
    } else n = -1;
    check(off.attr === false, 'no JavaScript: <html> has no data-bg attribute', `has attribute: ${off.attr}`);
    check(n === 0, 'no JavaScript: the hero below the header is pixel-identical to the sheet drawn on purpose (Forest light, 1440x900)', n < 0 ? 'sizes differ' : `${n} differing pixels`);
  }

  // ---- 6. First paint: data-bg is set before the body exists, so the art is never added after the page shows. --
  {
    const ctx = await browser.newContext();
    let late = 0; const n = 12;
    for (let i = 0; i < n; i++) {
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        new MutationObserver((_, obs) => {
          if (document.body) { window.__atBody = document.documentElement.getAttribute('data-bg'); obs.disconnect(); }
        }).observe(document, { childList: true, subtree: true });
      });
      await page.goto(HOME, { waitUntil: 'load' });
      const r = await page.evaluate(() => ({ at: window.__atBody, final: document.documentElement.getAttribute('data-bg') }));
      if (!r.at || r.at !== r.final) late++;
      await page.close();
    }
    check(late === 0, 'data-bg is set before the body exists, so first paint never shows the wrong background', `${n} loads, ${late} late`);
    await ctx.close();
  }

  // ---- 7. Assets: each background asks for its own files, at the widths it applies to, and for nothing else. ---
  // sheet: its two masks from 75rem (1200px) up, also with no script and with blocked storage; dial: its two
  // masks from 1200px; weave and iris draw from CSS and inline markup, so they request none. Every request
  // must succeed, none may leave the origin, and the CSP must not fire.
  {
    const SHEET = ['bg-sheet-art.svg', 'bg-sheet-edge.svg'], DIAL = ['bg-dial-a.svg', 'bg-dial-b.svg'];
    const want = (mode, w) => (mode === 'dial' ? (w >= 1200 ? DIAL : []) : mode === 'weave' || mode === 'iris' ? [] : (w >= 1200 ? SHEET : []));
    const modes = ids.concat(['no JavaScript', 'blocked storage']);
    const bad = [];
    let runs = 0;
    for (const mode of modes) for (const w of [1000, 1199, 1200, 1440]) {
      const opts = { viewport: { width: w, height: 900 } };
      if (mode === 'no JavaScript') opts.javaScriptEnabled = false;
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const got = new Set(), failed = [], off = [], csp = [], errs = [];
      page.on('request', (r) => {
        const u = r.url();
        const m = /\/assets\/(bg-[a-z0-9-]+\.svg)/.exec(u);
        if (m) got.add(m[1]);
        if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) off.push(u);
      });
      page.on('requestfailed', (r) => failed.push(r.url()));
      page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 120)); });
      if (ids.includes(mode)) await page.addInitScript(pinTheme, { theme: 'light', bg: mode });
      if (mode === 'blocked storage') await page.addInitScript(() => {
        const block = { get() { throw new DOMException('blocked', 'SecurityError'); } };
        Object.defineProperty(window, 'sessionStorage', block); Object.defineProperty(window, 'localStorage', block);
      });
      await page.goto(HOME, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const exp = want(mode, w);
      const same = exp.length === got.size && exp.every((f) => got.has(f));
      if (!same || failed.length || off.length || csp.length || errs.length) {
        bad.push(`${mode} ${w}px: asked for [${[...got].join(', ')}] want [${exp.join(', ')}]${failed.length ? '; failed ' + failed.join(', ') : ''}${off.length ? '; off-origin ' + off.join(', ') : ''}${csp.length ? '; CSP ' + csp.join(' | ') : ''}${errs.length ? '; errors ' + errs.join(' | ') : ''}`);
      }
      runs++;
      await ctx.close();
    }
    check(bad.length === 0, `assets: only the drawn background's files are requested, from the widths it applies to (${plural(runs, 'load')}: four draws, no JavaScript, blocked storage at 1000, 1199, 1200 and 1440)`, bad.join(' | '));
  }
  {
    // Other pages: no background file, whatever is drawn.
    const bad = [];
    for (const bg of ids) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const got = new Set();
      page.on('request', (r) => { const m = /\/assets\/(bg-[a-z0-9-]+\.svg)/.exec(r.url()); if (m) got.add(m[1]); });
      await page.addInitScript(pinTheme, { theme: 'light', bg });
      for (const p of ['sv', 'about', 'services', 'work', 'contact']) await page.goto(url(p), { waitUntil: 'load' });
      if (got.size) bad.push(`${bg}: ${[...got].join(', ')}`);
      await ctx.close();
    }
    check(bad.length === 0, 'assets: sv.html and four other pages request no background file in any draw', bad.join(' | '));
  }

  // ---- 8. Calls: a background that is not drawn starts nothing; nothing runs at rest; other pages are alike. ---
  // Each draw is reached through the site's own draw (forceDraw), then every listener, timer, frame request, idle
  // callback, observer, Web Animation and storage write the page makes is recorded and compared with the sheet,
  // which has no script of its own.
  {
    const run = async (bg, page, w, at) => {
      const ctx = await browser.newContext({ viewport: { width: w || 1440, height: 900 } });
      const p = await ctx.newPage();
      await forceDraw(p, bg);
      await p.addInitScript(instrument);
      await p.goto(at || url(page), { waitUntil: 'load' });
      await p.waitForTimeout(1500);        // at rest: no pointer, no key, no scroll
      const r = await p.evaluate(() => ({ calls: window.__calls, animations: document.getAnimations().length, bg: document.documentElement.getAttribute('data-bg') }));
      await ctx.close();
      if (r.bg !== bg) throw new Error(`forced draw gave ${r.bg}, wanted ${bg}`);
      return { calls: tally(r.calls), animations: r.animations };
    };
    const home = {};
    for (const bg of ids) home[bg] = await run(bg, 'index');
    // The weave's script writes its seed and sets one custom property: no listener, timer, frame, observer or animation.
    const dw = diff(home.sheet.calls, home.weave.calls);
    check(dw.length === 1 && dw[0] === 'store session vynatix-bg-seed 0->1', 'weave: its script adds one storage write (the seed) and no listener, timer, frame, observer or animation', dw.join('; ') || 'no difference');
    // The dial adds listeners and nothing that runs by itself.
    const dd = diff(home.sheet.calls, home.dial.calls);
    check(dd.length > 0 && dd.every((d) => /^listener (DOMContentLoaded|resize|pointermove|change|click) /.test(d)),
      'dial: its script adds listeners only (DOMContentLoaded, resize, pointermove, media query changes, the theme toggle), no timer, frame, observer, animation or write', dd.join('; '));
    // The iris adds its input listeners, one idle callback, one observer and the 20 s timer, and writes nothing until it opens.
    const di = diff(home.sheet.calls, home.iris.calls);
    check(di.length > 0 && di.every((d) => /^(listener|timer|idle|observer) /.test(d)),
      'iris: its script adds listeners, an idle callback, one observer and the 20 s timer, and writes nothing until the opening starts', di.join('; '));
    // The sheet has no script at all.
    check(!Object.keys(home.sheet.calls).some((k) => /^(frame|idle|animate|observer|timer)/.test(k)),
      'sheet: no script of its own, so no timer, frame, idle callback, observer or animation on the home page', JSON.stringify(home.sheet.calls));
    check(ids.every((bg) => home[bg].animations === 0 && !home[bg].calls.frame && !home[bg].calls.interval && !home[bg].calls.animate),
      'at rest (1.5 s, no input) no draw has an animation, an interval, a frame request or a Web Animation', ids.map((bg) => `${bg} ${home[bg].animations}`).join(', '));
    // Other pages: the same calls whichever background is drawn, so the scripts' own page tests hold.
    for (const page of ['sv', 'about']) {
      const calls = {};
      for (const bg of ids) calls[bg] = (await run(bg, page)).calls;
      const bad = ids.filter((bg) => diff(calls.sheet, calls[bg]).length);
      check(bad.length === 0, `${page}.html: the same calls in all four draws, so no background starts anything off the home page`, bad.map((bg) => `${bg}: ${diff(calls.sheet, calls[bg]).join('; ')}`).join(' | '));
    }
    // The site's address is the folder, not index.html: the weave and the iris must find the home page there too.
    const root = {};
    for (const bg of ['weave', 'iris']) root[bg] = (await run(bg, 'index', 1440, BASE)).calls;
    check(root.weave['store session vynatix-bg-seed'] === 1 && root.iris['observer IntersectionObserver'] === 1,
      'the home page at the bare address (/, no index.html): the weave draws its cloth and the iris arms its opening', `weave seed writes ${root.weave['store session vynatix-bg-seed'] || 0}, iris observers ${root.iris['observer IntersectionObserver'] || 0}`);
  }

  // ---- 9. Other pages are pixel-identical in all four draws (the backgrounds do not leak). -------------------
  {
    const bad = [];
    let shots = 0;
    for (const page of ['sv', 'about']) for (const w of [1440, 390]) {
      const pngs = {};
      for (const bg of ids) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
        const p = await ctx.newPage();
        await p.addInitScript(pinTheme, { theme: 'teal-dark', bg });
        await p.goto(url(page), { waitUntil: 'load' });
        await p.evaluate(async () => { try { await document.fonts.ready; } catch (e) { /* no-op */ } });
        await p.waitForTimeout(250);
        // styles.css lets the browser skip the sections below the hero until they are near the viewport
        // (content-visibility: auto), so a full-page capture of a long page at phone width is 12789 or 13165px
        // tall depending on timing, on a build with no background code at all. Show every section, as
        // screenshot.js does: this compares the backgrounds, not the browser's bookkeeping.
        await p.evaluate(() => { document.querySelectorAll('main > section').forEach((s) => s.style.setProperty('content-visibility', 'visible')); });
        pngs[bg] = PNG.sync.read(await p.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }));
        shots++;
        await ctx.close();
      }
      for (const bg of ids) {
        const a = pngs.sheet, b = pngs[bg];
        let n = 0;
        if (a.width !== b.width || a.height !== b.height) n = -1;
        else for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
        if (n !== 0) bad.push(`${page}.html ${w}px ${bg} against sheet: ${n < 0 ? 'size differs' : n + ' px'}`);
      }
    }
    check(bad.length === 0, `other pages: sv.html and about.html are pixel-identical in all four draws (${plural(shots, 'full-page capture')}, Teal dark, 1440 and 390 wide)`, bad.join(' | '));
  }

  // ---- 10. Storage: the site writes exactly the keys privacy.html lists, and never the iris's test hook. -----
  // Each draw is reached through the site's own draw, the home page is used for a moment (and, for the iris, left
  // alone long enough to open: the hook shortens the silence to 300 ms), the theme toggle is pressed, and every
  // write and removal is compared with the keys the site is allowed to write.
  {
    const KEYS = { 'session vynatix-look': 'always', 'session vynatix-bg': 'always', 'session vynatix-bg-seed': 'weave', 'session vynatix-bg-iris': 'iris', 'local vynatix-theme': 'toggle' };
    const bad = [], writes = {};
    for (const bg of ids) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await forceDraw(page, bg);
      if (bg === 'iris') await page.addInitScript(() => { try { sessionStorage.setItem('vynatix-bg-iris-idle', '300'); } catch (e) { /* blocked */ } });
      await page.addInitScript(instrument);
      await page.goto(HOME, { waitUntil: 'load' });
      await page.waitForTimeout(bg === 'iris' ? 3200 : 800);
      await page.click('.theme-toggle');
      await page.waitForTimeout(150);
      const calls = await page.evaluate(() => window.__calls || []);
      const wrote = [...new Set(calls.filter((c) => /^store /.test(c)))].map((c) => c.replace(/^store /, ''));
      const removed = calls.filter((c) => /^remove /.test(c));
      const allowed = Object.entries(KEYS).filter(([, when]) => when === 'always' || when === 'toggle' || when === bg).map(([k]) => k);
      const extra = wrote.filter((k) => !allowed.includes(k));
      const missing = allowed.filter((k) => !wrote.includes(k));
      if (extra.length || removed.length || missing.length) bad.push(`${bg}: wrote [${wrote.join(', ')}]${extra.length ? ', not allowed: ' + extra.join(', ') : ''}${missing.length ? ', missing: ' + missing.join(', ') : ''}${removed.length ? ', removed: ' + removed.join(', ') : ''}`);
      writes[bg] = wrote;
      await ctx.close();
    }
    check(bad.length === 0, 'storage: the home page writes only vynatix-look and vynatix-bg, the weave\'s vynatix-bg-seed, the iris\'s vynatix-bg-iris (once its opening has begun) and the toggle\'s vynatix-theme (local), and removes nothing',
      bad.join(' | ') || ids.map((bg) => `${bg}: ${writes[bg].map((k) => k.replace('vynatix-', '')).join(' ')}`).join('; '));

    // What the site writes is what privacy.html says it writes; the iris's test hook is not stored data.
    const ctx = await browser.newContext();
    const privacy = await (await ctx.request.get(BASE + 'privacy.html')).text();
    const appjs = (await (await ctx.request.get(BASE + 'app.js')).text()) + '\n' + (await (await ctx.request.get(BASE + 'hero-bg.js')).text());   // the draw is in app.js, the backgrounds' scripts in hero-bg.js
    await ctx.close();
    const documented = [...new Set([...privacy.matchAll(/<code>(vynatix-[a-z-]+)<\/code>/g)].map((m) => m[1]))].sort();
    const written = Object.keys(KEYS).map((k) => k.split(' ')[1]).sort();
    check(JSON.stringify(documented) === JSON.stringify(written), 'privacy.html lists exactly the keys the site writes', `listed [${documented.join(', ')}]; written [${written.join(', ')}]`);
    // The code, not its comments (a comment may name a key in quotes).
    const code = appjs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[ \t])\/\/ .*$/gm, '$1');
    const inJs = [...new Set([...code.matchAll(/'(vynatix-[a-z-]+)'/g)].map((m) => m[1]))].sort();
    const known = written.concat(['vynatix-bg-iris-idle']).sort();
    check(JSON.stringify(inJs) === JSON.stringify(known), 'app.js and hero-bg.js name exactly those keys and the iris test hook, and no other', `in the scripts [${inJs.join(', ')}]`);

    // The hook (vynatix-bg-iris-idle) is read-only: one literal, one read, no write, no removal, not listed for visitors.
    const uses = [...code.matchAll(/IDLE_KEY/g)].length;
    const reads = [...code.matchAll(/sessionStorage\.getItem\(IDLE_KEY\)/g)].length;
    const writesJs = [...code.matchAll(/(setItem|removeItem|clear)\(\s*IDLE_KEY/g)].length;
    const literal = [...code.matchAll(/vynatix-bg-iris-idle/g)].length;
    check(literal === 1 && reads === 1 && writesJs === 0 && uses === 2,
      'iris test hook: vynatix-bg-iris-idle is one constant, read once from sessionStorage and never written or removed by the site', `literals ${literal}, uses of the constant ${uses} (declaration and one read), reads ${reads}, writes ${writesJs}`);
    check(!/vynatix-bg-iris-idle/.test(privacy), 'iris test hook: it is not listed in privacy.html (the site never stores it; it is a test hook, see tools/README.md)');
  }

  // ---- 11. The test hook only ever shortens the silence, inside 200 ms to 600 s, and anything else is ignored. -----
  {
    const trial = async (value) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.addInitScript(pinTheme, { theme: 'light', bg: 'iris' });
      if (value !== null) await page.addInitScript((v) => { try { sessionStorage.setItem('vynatix-bg-iris-idle', v); } catch (e) { /* blocked */ } }, value);
      await page.goto(HOME, { waitUntil: 'load' });
      await page.waitForTimeout(3200);
      const r = await page.evaluate(() => {
        const c = document.documentElement.classList;
        const dial = document.querySelector('.iris__dial');
        return { armed: c.contains('iris-armed'), started: c.contains('iris-play') || c.contains('iris-done'), flag: sessionStorage.getItem('vynatix-bg-iris'), dialOpacity: dial ? getComputedStyle(dial).opacity : null };
      });
      await ctx.close();
      return r;
    };
    const accepted = ['300', '200'], ignored = [null, '199', '0', '-5', '600001', '1e9', 'abc', '', '<img src=x>'];
    const results = await Promise.all(accepted.concat(ignored).map(async (v) => [v, await trial(v)]));
    const bad = [];
    for (const [v, r] of results) {
      if (accepted.includes(v) && !(r.armed && r.started && r.flag === '1')) bad.push(`${JSON.stringify(v)} should start the opening within 3.2 s: ${JSON.stringify(r)}`);
      if (ignored.includes(v) && !(r.armed && !r.started && r.flag === null && r.dialOpacity === '0')) bad.push(`${v === null ? 'no override' : JSON.stringify(v)} should leave the 20 s silence in place (armed, not started, dial not drawn yet): ${JSON.stringify(r)}`);
    }
    check(bad.length === 0, 'iris test hook: 200 and 300 start the opening within 3.2 s; no override, 199, 0, -5, 600001, 1e9, text, empty and markup are ignored and the 20 s silence stands', bad.join(' | '));
  }

  // ---- 12. Structure: the four blocks are fenced and ordered in the two home-only files, every rule in them is scoped to its own draw, and no other page or shared file carries them. ---
  {
    const ctx = await browser.newContext();
    const get = async (f) => (await ctx.request.get(BASE + f)).text();
    const css = await get('hero-bg.css'), js = await get('hero-bg.js'), index = await get('index.html');
    const shared = { 'styles.css': await get('styles.css'), 'app.js': await get('app.js') };
    const otherPages = PAGES.filter((p) => p !== 'index.html');
    const others = await Promise.all(otherPages.map((p) => get(p)));
    await ctx.close();
    const problemsHere = [];
    const fenced = (text, open, close, label) => {
      let last = -1;
      const blocks = {};
      for (const id of ids) {
        const o = [...text.matchAll(new RegExp(`^${open(id)}$`, 'gm'))], c = [...text.matchAll(new RegExp(`^${close(id)}$`, 'gm'))];
        if (o.length !== 1 || c.length !== 1) { problemsHere.push(`${label}: ${id} has ${o.length} begin and ${c.length} end markers`); continue; }
        if (!(o[0].index > last && c[0].index > o[0].index)) problemsHere.push(`${label}: ${id} is out of order`);
        last = c[0].index;
        blocks[id] = text.slice(o[0].index + o[0][0].length, c[0].index);
      }
      return { blocks, last };
    };
    const cssF = fenced(css, (id) => `/\\* bg:${id}:begin \\*/`, (id) => `/\\* bg:${id}:end \\*/`, 'hero-bg.css');
    fenced(js, (id) => `// bg:${id}:begin`, (id) => `// bg:${id}:end`, 'hero-bg.js');
    // The shared files carry none of it, and only the home page links the two files that do.
    for (const [name, text] of Object.entries(shared)) if (/bg:[a-z]+:(begin|end)/.test(text)) problemsHere.push(`${name} still carries a background block (they live in hero-bg.css and hero-bg.js)`);
    const linkers = otherPages.filter((p, i) => /hero-bg\.(css|js)/.test(others[i]));
    if (linkers.length) problemsHere.push(`pages that link a home-only file: ${linkers.join(', ')}`);
    if (!/href="hero-bg\.css\?v=[0-9a-f]{8}"/.test(index) || !/src="hero-bg\.js\?v=[0-9a-f]{8}"/.test(index)) problemsHere.push('index.html does not link hero-bg.css and hero-bg.js with stamps');
    if (index.indexOf('src="app.js') > index.indexOf('src="hero-bg.js')) problemsHere.push('index.html links hero-bg.js before app.js, which draws the background');

    // Every rule starts from its own scope; custom properties and keyframes carry the id; no raw colour, no !important.
    const SCOPE = { weave: ':root[data-bg="weave"]', sheet: ':root:is(:not([data-bg]), [data-bg="sheet"])', dial: ':root[data-bg="dial"]', iris: ':root[data-bg="iris"]' };
    const ALLOWED_UNSCOPED = { iris: ['.iris'] };       // the markup is only in index.html, hidden until the iris is drawn
    const split = (s) => { const out = []; let d = 0, cur = ''; for (const ch of s) { if ('([' .includes(ch)) d++; if (')]'.includes(ch)) d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out.filter(Boolean); };
    const walk = (src, id, sink) => {
      let i = 0;
      while (i < src.length) {
        const open = src.indexOf('{', i);
        if (open < 0) break;
        let depth = 1, j = open + 1;
        while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
        const prelude = src.slice(i, open).trim(), body = src.slice(open + 1, j - 1);
        i = j;
        if (/^@(media|supports)\b/.test(prelude)) walk(body, id, sink);
        else if (/^@property\b/.test(prelude)) sink.props.push(prelude.replace(/^@property\s+/, ''));
        else if (/^@keyframes\b/.test(prelude)) sink.keyframes.push(prelude.replace(/^@keyframes\s+/, ''));
        else if (prelude.startsWith('@')) sink.other.push(prelude);
        else {
          split(prelude).forEach((sel) => sink.selectors.push(sel));
          [...body.matchAll(/(?:^|[;{\s])(--[a-zA-Z0-9-]+)\s*:/g)].forEach((m) => sink.vars.push(m[1]));
        }
      }
    };
    for (const id of ids) {
      const text = (cssF.blocks[id] || '').replace(/\/\*[\s\S]*?\*\//g, '');
      const sink = { selectors: [], props: [], keyframes: [], vars: [], other: [] };
      walk(text, id, sink);
      const unscoped = sink.selectors.filter((s) => !s.startsWith(SCOPE[id]) && !(ALLOWED_UNSCOPED[id] || []).includes(s));
      if (!sink.selectors.length) problemsHere.push(`hero-bg.css ${id}: no rules found`);
      if (unscoped.length) problemsHere.push(`hero-bg.css ${id}: ${plural(unscoped.length, 'selector')} not scoped to ${SCOPE[id]}, e.g. ${unscoped[0].slice(0, 80)}`);
      const foreign = sink.vars.concat(sink.props).filter((v) => !v.startsWith(`--${id}-`));
      if (foreign.length) problemsHere.push(`hero-bg.css ${id}: custom properties without the --${id}- prefix: ${[...new Set(foreign)].slice(0, 4).join(', ')}`);
      const badKf = sink.keyframes.filter((k) => !k.startsWith(`${id}-`));
      if (badKf.length) problemsHere.push(`hero-bg.css ${id}: keyframes without the ${id}- prefix: ${badKf.join(', ')}`);
      if (sink.other.length) problemsHere.push(`hero-bg.css ${id}: at-rules the lint does not know: ${sink.other.join(', ')}`);
      const raw = text.match(/!important|\[data-theme|#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|var\(--(?:forest|teal|mono|cream|bronze|champagne|cloud|neutral|grey)-/);
      if (raw) problemsHere.push(`hero-bg.css ${id}: ${raw[0]} (role tokens only, no !important, no theme selectors)`);
    }
    // The iris markup: one fenced block in the English home page, decorative, and nowhere else.
    const markers = [...index.matchAll(/<!-- bg-iris:(begin|end)\b/g)].map((m) => m[1]);
    const block = (index.match(/<!-- bg-iris:begin[\s\S]*?<!-- bg-iris:end -->/) || [''])[0];
    if (markers.join() !== 'begin,end') problemsHere.push(`index.html: iris markers ${markers.join(',') || 'missing'}`);
    if (!/<div class="iris" aria-hidden="true">/.test(block) || /\sstyle=|\sonclick=|<a\s|<button|tabindex/.test(block)) problemsHere.push('index.html: the iris block is not a plain aria-hidden div without style, handler, link or focusable element');
    if (others.some((h) => /<!-- bg-iris|class="iris"/.test(h))) problemsHere.push('another page carries iris markup');
    check(problemsHere.length === 0, 'source: four fenced blocks in hero-bg.css and hero-bg.js, in order, every rule scoped to its own draw, role tokens only; the shared files carry none, only index.html links the two files; the iris markup fenced in index.html and nowhere else', problemsHere.join(' | '));
  }

  console.log(problems === 0 ? '\nPASS — the hero background draw and its isolation hold' : `\nFAIL — ${problems} problem(s)`);
  await browser.close();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
