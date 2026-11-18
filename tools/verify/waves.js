// The silk background and its pause control. Every page paints two soft layers of folds behind its content
// (body::before, body::after in styles.css) and, with JavaScript and without prefers-reduced-motion, lets them
// drift until the visitor presses the footer's "Pause background motion" button. That button is what makes the
// site's one ambient loop meet WCAG 2.2.2 (pause, stop, hide), so this check holds the two together.
//
// Nothing here is pinned: pinTheme and pinBg store the pause so that the pixel checks see one pose, which means
// this is the only check that sees the site as a first-time visitor does, moving.
//
//   cd tools && BASE=http://localhost:8000/ node verify/waves.js
const { BASE, launch } = require('./_common');

const PAGES = ['index', 'services', 'work', 'contact', 'privacy', 'accessibility', 'sv', 'integritet', 'ai-engineering'];
const KEY = 'vynatix-motion';

(async () => {
  const browser = await launch();
  let problems = 0;
  const check = (ok, name, detail) => { if (!ok) problems++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
  const url = (p) => `${BASE}${p}.html`;
  const state = (page) => page.evaluate((KEY) => {
    const cs = (q) => getComputedStyle(document.body, q);
    const btn = document.querySelector('.motion-toggle');
    const item = document.querySelector('.motion-item');
    return {
      cls: document.documentElement.classList.contains('js-waves'),
      names: [cs('::before').animationName, cs('::after').animationName],
      layers: [cs('::before').content !== 'none', cs('::after').content !== 'none'],
      transforms: [cs('::before').transform, cs('::after').transform],
      running: document.getAnimations().filter((a) => a.effect && a.effect.target === document.body && a.playState === 'running').length,
      properties: [...new Set(document.getAnimations().filter((a) => a.effect && a.effect.target === document.body).flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k))))].filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)),
      buttons: document.querySelectorAll('.motion-toggle').length,
      shown: !!btn && getComputedStyle(item).display !== 'none' && btn.getBoundingClientRect().height > 0,
      label: btn ? btn.textContent.trim() : null,
      tag: btn ? btn.tagName + ':' + btn.type : null,
      stored: (() => { try { return localStorage.getItem(KEY); } catch (e) { return 'blocked'; } })(),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  }, KEY);
  const moving = (s) => s.cls && s.names[0] === 'silk-light' && s.names[1] === 'silk-shade' && s.running === 2;
  const still = (s) => s.names[0] === 'none' && s.names[1] === 'none' && s.running === 0 && s.transforms.every((t) => t === 'none');

  // 1. A first visit: every page has the two layers, they drift, and the button is there to stop them.
  {
    const ctx = await browser.newContext();
    const bad = [];
    for (const p of PAGES) {
      const page = await ctx.newPage();
      await page.goto(url(p), { waitUntil: 'load' });
      const s = await state(page);
      if (!(moving(s) && s.layers.every(Boolean) && s.buttons === 1 && s.shown && s.label === 'Pause background motion' && s.tag === 'BUTTON:button' && s.stored === null && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.bodyBg))) bad.push(`${p}: ${JSON.stringify(s)}`);
      await page.close();
    }
    check(bad.length === 0, `first visit, ${PAGES.length} pages: both silk layers drift, one visible "Pause background motion" button, nothing stored, the canvas colour still on <body>`, bad.join(' | '));
    await ctx.close();
  }

  // 2. Only transform is animated, and the layers really move.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url('services'), { waitUntil: 'load' });
    const s = await state(page);
    const t0 = s.transforms;
    await page.waitForTimeout(1500);
    const t1 = (await state(page)).transforms;
    check(s.properties.length === 1 && s.properties[0] === 'transform', 'the drift animates transform and nothing else', s.properties.join(', '));
    check(t0[0] !== t1[0] && t0[1] !== t1[1], 'both layers have moved after 1.5 s', `${t0[0]} -> ${t1[0]}`);
    await ctx.close();
  }

  // 3. The button stops the drift at once, in the rest pose, says so, and can be worked from the keyboard; the
  //    choice is stored and holds on the next page and after a reload; pressing again resumes.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url('about'), { waitUntil: 'load' });
    await page.focus('.motion-toggle');
    await page.keyboard.press('Enter');
    const a = await state(page);
    check(still(a) && !a.cls && a.label === 'Play background motion' && a.stored === 'off' && a.shown, 'pressing the button (keyboard) stops both layers in the rest pose, relabels it "Play background motion" and stores off', JSON.stringify(a));
    await page.goto(url('work'), { waitUntil: 'load' });
    const b = await state(page);
    await page.reload({ waitUntil: 'load' });
    const c = await state(page);
    check(still(b) && still(c) && b.label === 'Play background motion' && c.shown, 'the pause holds on the next page and after a reload', `${b.names} / ${c.names}`);
    await page.click('.motion-toggle');
    const d = await state(page);
    await page.goto(url('contact'), { waitUntil: 'load' });
    const e = await state(page);
    check(moving(d) && d.label === 'Pause background motion' && d.stored === 'on' && moving(e), 'pressing again resumes the drift, stores on, and the next page drifts', JSON.stringify(d));
    await ctx.close();
  }

  // 4. Reduced motion, with no stored choice: nothing animates and there is no button to press.
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const bad = [];
    for (const p of PAGES) {
      const page = await ctx.newPage();
      await page.goto(url(p), { waitUntil: 'load' });
      await page.waitForTimeout(150);
      const s = await state(page);
      if (!(still(s) && !s.shown && s.layers.every(Boolean))) bad.push(`${p}: ${JSON.stringify(s)}`);
      await page.close();
    }
    check(bad.length === 0, `reduced motion, no stored choice, ${PAGES.length} pages: the silk is drawn and still, and the button is not shown`, bad.join(' | '));
    await ctx.close();
  }

  // 5. Without JavaScript: the silk is drawn and still, and the button that could not work is not shown.
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(url('services'), { waitUntil: 'load' });
    const shown = await page.$eval('.motion-item', (el) => getComputedStyle(el).display !== 'none');
    const names = await page.$eval('body', (el) => [getComputedStyle(el, '::before').animationName, getComputedStyle(el, '::after').animationName, getComputedStyle(el, '::before').content !== 'none']);
    check(!shown && names[0] === 'none' && names[1] === 'none' && names[2] === true, 'no JavaScript: the silk is drawn and still, the button is hidden', `${names}`);
    await ctx.close();
  }

  // 6. One rest pose: paused, reduced motion and no JavaScript paint the same pixels.
  {
    const shot = async (opts, pause) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light', ...opts });
      const page = await ctx.newPage();
      if (pause) await page.addInitScript((KEY) => { try { localStorage.setItem(KEY, 'off'); } catch (e) {} }, KEY);
      await page.goto(url('terms'), { waitUntil: 'load' });
      await page.waitForTimeout(200);
      const buf = await page.screenshot({ clip: { x: 0, y: 120, width: 1280, height: 600 } });
      await ctx.close();
      return buf;
    };
    const paused = await shot({}, true), reduced = await shot({ reducedMotion: 'reduce' }, false), nojs = await shot({ javaScriptEnabled: false }, false);
    check(paused.equals(reduced) && paused.equals(nojs), 'one rest pose: a stored pause, reduced motion and no JavaScript paint identical pixels (terms.html, 1280x600 below the header)', `paused=reduced ${paused.equals(reduced)}, paused=nojs ${paused.equals(nojs)}`);
  }

  // 7. Blocked or poisoned storage: the page drifts, throws nothing, and the button still works for the page.
  {
    const bad = [];
    for (const poison of ['"><img src=x onerror=window.__xss=1>', '__proto__', '', 'OFF', 'paused']) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.addInitScript(([KEY, v]) => { try { localStorage.setItem(KEY, v); } catch (e) {} }, [KEY, poison]);
      await page.goto(url('index'), { waitUntil: 'load' });
      const s = await state(page);
      const xss = await page.evaluate(() => !!window.__xss || !!document.querySelector('img[src="x"]'));
      if (!moving(s) || xss) bad.push(JSON.stringify(poison));
      await ctx.close();
    }
    check(bad.length === 0, 'a stored value that is not exactly "off" means moving, and never reaches the page', bad.join(' | ') || '5 values');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const block = { get() { throw new DOMException('blocked', 'SecurityError'); } };
      Object.defineProperty(window, 'sessionStorage', block);
      Object.defineProperty(window, 'localStorage', block);
    });
    await page.goto(url('about'), { waitUntil: 'load' });
    const a = await state(page);
    await page.click('.motion-toggle');
    const b = await state(page);
    check(moving(a) && still(b) && b.label === 'Play background motion' && errors.length === 0, 'blocked storage: the page drifts, the button still stops it for this page, nothing is thrown', errors.join(' | '));
    await ctx.close();
  }

  console.log(problems === 0 ? '\nPASS — the silk background drifts, and the visitor can stop it' : `\nFAIL — ${problems} problem(s)`);
  await browser.close();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
