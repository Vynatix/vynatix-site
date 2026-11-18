// The silk background and its pause control. styles.css paints a still silk behind every page (body::before and
// body::after). With JavaScript, WebGL and no prefers-reduced-motion, app.js lays a <canvas class="silk-canvas"> over
// it and draws the folds live in a shader, so they form and dissolve, until the visitor presses the footer's "Pause
// background motion" button. That button is what makes the site's one ambient loop meet WCAG 2.2.2 (pause, stop,
// hide), so this check holds the two together.
//
// Every other check opens its pages with the pause stored (_common.js, stillSilk). This one asks for the live silk,
// so it is the only check that sees the site as a first-time visitor does, moving.
//
//   cd tools && BASE=http://localhost:8000/ node verify/waves.js
const { PNG } = require('pngjs');
const { BASE, launch } = require('./_common');

const PAGES = ['index', 'services', 'work', 'contact', 'privacy', 'accessibility', 'sv', 'integritet', 'ai-engineering'];
const KEY = 'vynatix-motion';

(async () => {
  const browser = await launch({ liveSilk: true });
  let problems = 0;
  const check = (ok, name, detail) => { if (!ok) problems++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
  const url = (p) => `${BASE}${p}.html`;
  // Counts the frames the page asks for, so "nothing is drawing" can be told from "drawing the same thing".
  const countFrames = () => { window.__frames = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => { window.__frames++; return raf(cb); }; };
  const open = async (opts = {}, init) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(countFrames);
    if (init) await page.addInitScript(init.fn, init.arg);
    return { ctx, page, errors };
  };
  const go = async (page, p) => { await page.goto(url(p), { waitUntil: 'load' }); await page.waitForTimeout(350); };
  const state = (page) => page.evaluate((KEY) => {
    const btn = document.querySelector('.motion-toggle'), item = document.querySelector('.motion-item');
    const canvases = [...document.querySelectorAll('canvas.silk-canvas')];
    const cs = (q) => getComputedStyle(document.body, q);
    return {
      wanted: document.documentElement.classList.contains('js-waves'),
      live: document.documentElement.classList.contains('js-waves-live'),
      canvases: canvases.length,
      canvas: canvases[0] ? { hidden: canvases[0].getAttribute('aria-hidden'), first: document.body.firstElementChild === canvases[0], w: canvases[0].width, h: canvases[0].height, events: getComputedStyle(canvases[0]).pointerEvents, z: getComputedStyle(canvases[0]).zIndex } : null,
      still: [cs('::before').content !== 'none' && cs('::before').visibility === 'visible', cs('::after').content !== 'none' && cs('::after').visibility === 'visible'],
      animations: document.getAnimations().length,
      frames: window.__frames,
      buttons: document.querySelectorAll('.motion-toggle').length,
      shown: !!btn && getComputedStyle(item).display !== 'none' && btn.getBoundingClientRect().height > 0,
      label: btn ? btn.textContent.trim() : null,
      tag: btn ? btn.tagName + ':' + btn.type : null,
      stored: (() => { try { return localStorage.getItem(KEY); } catch (e) { return 'blocked'; } })(),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  }, KEY);
  // Is the page asking for frames right now?
  const drawing = async (page) => { const a = await page.evaluate(() => window.__frames); await page.waitForTimeout(400); return (await page.evaluate(() => window.__frames)) - a; };
  const moving = (s) => s.wanted && s.live && s.canvases === 1 && s.canvas.hidden === 'true' && s.canvas.first && s.canvas.events === 'none' && s.canvas.z === '-1' && !s.still[0] && !s.still[1];
  const still = (s) => !s.live && s.canvases === 0 && s.still[0] && s.still[1] && s.animations === 0;

  // 1. A first visit: every page draws the live silk over the still one, and the button is there to stop it.
  {
    const { ctx, page, errors } = await open();
    const bad = [];
    for (const p of PAGES) {
      await go(page, p);
      const s = await state(page), d = await drawing(page);
      if (!(moving(s) && d > 0 && s.buttons === 1 && s.shown && s.label === 'Pause background motion' && s.tag === 'BUTTON:button' && s.stored === null && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.bodyBg))) bad.push(`${p}: frames ${d}, ${JSON.stringify(s)}`);
    }
    check(bad.length === 0 && errors.length === 0, `first visit, ${PAGES.length} pages: one live canvas behind the content (aria-hidden, no pointer events), frames being drawn, one visible "Pause background motion" button, nothing stored, the canvas colour still on <body>`, bad.concat(errors).join(' | '));
    await ctx.close();
  }

  // 2. The folds are drawn, not slid: the picture changes, it is seen to change, it has no colour banding, its
  //    colours are the page's own in both themes, and they follow a theme toggle made while it runs.
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
    await go(page, 'terms');
    const shot = async () => PNG.sync.read(await page.screenshot());
    const A = await shot(); await page.waitForTimeout(2000); const B = await shot();
    let changed = 0;
    for (let i = 0; i < A.data.length; i += 4) if (Math.abs(A.data[i] - B.data[i]) >= 2) changed++;
    const share = changed / (A.data.length / 4);
    check(share >= 0.15, `the motion is visible (${scheme}): 2 s apart, at least 15% of the page's pixels change by 2 levels or more`, `${(share * 100).toFixed(1)}%`);
    // Banding: in the text-free left margin, how many pixels sit in vertical runs of 12 or more identical pixels?
    const flatShare = (g) => {
      let px = 0, flat = 0;
      for (let x = 4; x < 36; x += 3) {
        let run = 1;
        for (let y = 141; y <= g.height; y++) {
          const i = (y * g.width + x) * 4, j = i - g.width * 4;
          if (y < g.height && g.data[i] === g.data[j] && g.data[i + 1] === g.data[j + 1] && g.data[i + 2] === g.data[j + 2]) run++;
          else { px += run; if (run >= 12) flat += run; run = 1; }
        }
      }
      return flat / px;
    };
    check(flatShare(A) < 0.03, `no colour banding in the live silk (${scheme}): under 3% of the left margin's pixels sit in runs of 12 or more identical pixels`, `${(100 * flatShare(A)).toFixed(1)}%`);
    // Colours: every pixel of the margin lies between the darkest and the lightest of the three tones the page gives.
    const tones = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body, '::before').backgroundColor, getComputedStyle(document.body, '::after').backgroundColor]
      .map((t) => { const n = t.match(/-?\d*\.?\d+(?:e-?\d+)?/g).slice(0, 3).map(Number); return /^color\(/.test(t) ? n.map((v) => v * 255) : n; }));
    const range = (g) => { let lo = 255, hi = 0; for (let x = 4; x < 36; x += 3) for (let y = 141; y < g.height; y += 2) { const v = g.data[(y * g.width + x) * 4]; if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
    const within = (g, t) => { const [lo, hi] = range(g); const min = Math.min(...t.map((c) => c[0])) - 3, max = Math.max(...t.map((c) => c[0])) + 3; return { ok: lo >= min && hi <= max && hi - lo >= 4, text: `pixels ${lo}..${hi}, tones ${min.toFixed(0)}..${max.toFixed(0)}` }; };
    const w1 = within(A, tones);
    check(w1.ok, `the live silk is drawn in the page's own three tones (${scheme})`, w1.text);
    await page.evaluate(() => document.querySelector('.theme-toggle').click());
    await page.waitForTimeout(500);
    const tones2 = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body, '::before').backgroundColor, getComputedStyle(document.body, '::after').backgroundColor]
      .map((t) => { const n = t.match(/-?\d*\.?\d+(?:e-?\d+)?/g).slice(0, 3).map(Number); return /^color\(/.test(t) ? n.map((v) => v * 255) : n; }));
    const w2 = within(await shot(), tones2);
    check(w2.ok && Math.abs(tones2[0][0] - tones[0][0]) > 100, `after a theme toggle the running silk takes the other theme's tones (from ${scheme})`, w2.text);
    await ctx.close();
  }

  // 3. The button stops the drawing at once, removes the canvas, shows the still silk, says so, and can be worked
  //    from the keyboard; the choice is stored and holds on the next page and after a reload; pressing again resumes.
  {
    const { ctx, page } = await open();
    await go(page, 'about');
    await page.focus('.motion-toggle');
    await page.keyboard.press('Enter');
    const a = await state(page), da = await drawing(page);
    check(still(a) && da === 0 && !a.wanted && a.label === 'Play background motion' && a.stored === 'off' && a.shown, 'pressing the button (keyboard) stops the drawing, removes the canvas, shows the still silk, relabels it "Play background motion" and stores off', `frames ${da}, ${JSON.stringify(a)}`);
    await go(page, 'work');
    const b = await state(page), db = await drawing(page);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(350);
    const c = await state(page), dc = await drawing(page);
    check(still(b) && still(c) && db === 0 && dc === 0 && b.frames === 0 && c.frames === 0 && b.label === 'Play background motion' && c.shown, 'the pause holds on the next page and after a reload: no canvas, and not one frame asked for', `frames ${b.frames}/${c.frames}`);
    await page.click('.motion-toggle');
    await page.waitForTimeout(200);
    const d = await state(page), dd = await drawing(page);
    await go(page, 'contact');
    const e = await state(page);
    check(moving(d) && dd > 0 && d.label === 'Pause background motion' && d.stored === 'on' && moving(e), 'pressing again starts the live silk, stores on, and the next page draws it', JSON.stringify(d));
    await ctx.close();
  }

  // 4. Reduced motion, with no stored choice: no canvas, no frame, no animation, and no button to press.
  {
    const { ctx, page } = await open({ reducedMotion: 'reduce' });
    const bad = [];
    for (const p of PAGES) {
      await go(page, p);
      const s = await state(page);
      if (!(still(s) && s.frames === 0 && !s.shown)) bad.push(`${p}: ${JSON.stringify(s)}`);
    }
    check(bad.length === 0, `reduced motion, no stored choice, ${PAGES.length} pages: the still silk, no canvas, no frame asked for, and the button is not shown`, bad.join(' | '));
    await ctx.close();
  }

  // 5. Without JavaScript: the still silk, and the button that could not work is not shown.
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(url('services'), { waitUntil: 'load' });
    const shown = await page.$eval('.motion-item', (el) => getComputedStyle(el).display !== 'none');
    const r = await page.$eval('body', (el) => [document.querySelectorAll('canvas').length, getComputedStyle(el, '::before').content !== 'none', getComputedStyle(el, '::after').content !== 'none']);
    check(!shown && r[0] === 0 && r[1] && r[2], 'no JavaScript: the still silk is drawn, there is no canvas, the button is hidden', `${r}`);
    await ctx.close();
  }

  // 6. One still pose: a stored pause, reduced motion, no JavaScript and a pause pressed on the page all paint the
  //    same pixels.
  {
    const shot = async (opts, how) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light', ...opts });
      const page = await ctx.newPage();
      if (how === 'stored') await page.addInitScript((KEY) => { try { localStorage.setItem(KEY, 'off'); } catch (e) {} }, KEY);
      await page.goto(url('terms'), { waitUntil: 'load' });
      await page.waitForTimeout(350);
      if (how === 'pressed') { await page.evaluate(() => document.querySelector('.motion-toggle').click()); await page.waitForTimeout(150); }
      const buf = await page.screenshot({ clip: { x: 0, y: 120, width: 1280, height: 600 } });
      await ctx.close();
      return buf;
    };
    const stored = await shot({}, 'stored'), reduced = await shot({ reducedMotion: 'reduce' }), nojs = await shot({ javaScriptEnabled: false }), pressed = await shot({}, 'pressed');
    check(stored.equals(reduced) && stored.equals(nojs) && stored.equals(pressed), 'one still pose: a stored pause, reduced motion, no JavaScript and a pause pressed on the page paint identical pixels (terms.html, 1280x600 below the header)', `reduced ${stored.equals(reduced)}, nojs ${stored.equals(nojs)}, pressed ${stored.equals(pressed)}`);
  }

  // 7. Poisoned storage means moving and never reaches the page; blocked storage still works for the page.
  {
    const bad = [];
    for (const poison of ['"><img src=x onerror=window.__xss=1>', '__proto__', '', 'OFF', 'paused']) {
      const { ctx, page } = await open({}, { fn: ([KEY, v]) => { try { localStorage.setItem(KEY, v); } catch (e) {} }, arg: [KEY, poison] });
      await go(page, 'index');
      const s = await state(page);
      const xss = await page.evaluate(() => !!window.__xss || !!document.querySelector('img[src="x"]'));
      if (!moving(s) || xss) bad.push(JSON.stringify(poison));
      await ctx.close();
    }
    check(bad.length === 0, 'a stored value that is not exactly "off" means moving, and never reaches the page', bad.join(' | ') || '5 values');
    const { ctx, page, errors } = await open({}, { fn: () => {
      const block = { get() { throw new DOMException('blocked', 'SecurityError'); } };
      Object.defineProperty(window, 'sessionStorage', block);
      Object.defineProperty(window, 'localStorage', block);
    } });
    await go(page, 'about');
    const a = await state(page);
    await page.click('.motion-toggle');
    const b = await state(page);
    check(moving(a) && still(b) && b.label === 'Play background motion' && errors.length === 0, 'blocked storage: the live silk runs, the button still stops it for this page, nothing is thrown', errors.join(' | '));
    await ctx.close();
  }

  // 8. No WebGL: the still silk, nothing thrown, and no button that could do nothing.
  {
    const { ctx, page, errors } = await open({}, { fn: () => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type) { return /webgl/.test(type) ? null : get.apply(this, arguments); }; } });
    await go(page, 'services');
    const s = await state(page);
    check(still(s) && !s.shown && errors.length === 0, 'a browser that refuses WebGL: the still silk, no canvas left behind, the button hidden, nothing thrown', `${JSON.stringify(s)} ${errors.join(' | ')}`);
    await ctx.close();
  }

  // 9. A lost WebGL context (phones drop them freely): back to the still silk, and the button offers to start again.
  {
    const { ctx, page, errors } = await open({}, { fn: () => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function () { const g = get.apply(this, arguments); if (g && this.className === 'silk-canvas') window.__gl = g; return g; }; } });
    await go(page, 'work');
    const before = await state(page);
    await page.evaluate(() => window.__gl.getExtension('WEBGL_lose_context').loseContext());
    await page.waitForTimeout(300);
    const lost = await state(page), dl = await drawing(page);
    await page.click('.motion-toggle');
    await page.waitForTimeout(300);
    const again = await state(page);
    check(moving(before) && still(lost) && dl === 0 && lost.shown && lost.label === 'Play background motion' && moving(again) && errors.length === 0,
      'a lost WebGL context: the canvas goes, the still silk shows, drawing stops, and the button starts the live silk again', `lost ${JSON.stringify(lost)} ${errors.join(' | ')}`);
    await ctx.close();
  }

  // 10. The still silk itself has no colour banding (its grain mask, assets/silk-grain.png).
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.addInitScript((KEY) => { try { localStorage.setItem(KEY, 'off'); } catch (e) {} }, KEY);
    await page.goto(url('terms'), { waitUntil: 'load' });
    const g = PNG.sync.read(await page.screenshot());
    let px = 0, flat = 0;
    for (let x = 4; x < 36; x += 3) {
      let run = 1;
      for (let y = 141; y <= g.height; y++) {
        const i = (y * g.width + x) * 4, j = i - g.width * 4;
        if (y < g.height && g.data[i] === g.data[j] && g.data[i + 1] === g.data[j + 1] && g.data[i + 2] === g.data[j + 2]) run++;
        else { px += run; if (run >= 12) flat += run; run = 1; }
      }
    }
    check(flat / px < 0.03, `no colour banding in the still silk (${scheme}): under 3% of the left margin's pixels sit in runs of 12 or more identical pixels`, `${(100 * flat / px).toFixed(1)}%`);
    await ctx.close();
  }

  console.log(problems === 0 ? '\nPASS — the silk background is drawn live, and the visitor can stop it' : `\nFAIL — ${problems} problem(s)`);
  await browser.close();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
