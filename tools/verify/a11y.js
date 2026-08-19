// Accessibility checks: axe-core scan on every page in both themes, plus
// functional tests for the skip link and the marquee pause control, including
// the no-JS and reduced-motion fallbacks.
const fs = require('fs');
const { PAGES, BASE, launch } = require('./_common');
const AXE = require.resolve('axe-core/axe.min.js');

(async () => {
  const browser = await launch();
  const axeSrc = fs.readFileSync(AXE, 'utf8');
  let problems = 0;

  // --- axe scan -----------------------------------------------------------
  for (const p of PAGES) {
    for (const theme of ['light', 'dark']) {
      // bypassCSP only for the axe scan: script-src 'self' correctly refuses the
      // injected scanner. CSP enforcement is proven separately by adversarial.js.
      const ctx = await browser.newContext({ bypassCSP: true });
      const page = await ctx.newPage();
      await page.addInitScript((t) => { try { localStorage.setItem('vynatix-theme', t); } catch (e) {} }, theme);
      await page.goto(BASE + p, { waitUntil: 'load' });
      await page.addScriptTag({ content: axeSrc });
      const res = await page.evaluate(async () => await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      }));
      const v = res.violations;
      if (v.length) {
        problems += v.length;
        console.log(`FAIL ${p} [${theme}] — ${v.length} violation(s)`);
        v.forEach((x) => console.log(`       ${x.impact}: ${x.id} — ${x.help} (${x.nodes.length} node(s))\n         e.g. ${x.nodes[0].target.join(' ')}`));
      } else {
        console.log(`ok   ${p} [${theme}] — 0 axe violations`);
      }
      await ctx.close();
    }
  }

  // --- skip link ----------------------------------------------------------
  {
    const page = await browser.newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);            // let the reveal transition finish
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      const box = el.getBoundingClientRect();
      return { cls: el.className, href: el.getAttribute('href'),
               onScreen: box.top >= 0 && box.top < window.innerHeight,
               target: !!document.querySelector('#main') };
    });
    const ok = r.cls.includes('skip-link') && r.href === '#main' && r.onScreen && r.target;
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} skip link is first Tab stop, visible on focus, target exists — ${JSON.stringify(r)}`);
    await page.close();
  }

  // --- marquee toggle -----------------------------------------------------
  {
    const page = await browser.newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const before = await page.evaluate(() => {
      const t = document.querySelector('.marquee__toggle');
      return { visible: getComputedStyle(t).display !== 'none',
               pressed: t.getAttribute('aria-pressed'),
               label: t.getAttribute('aria-label'),
               play: getComputedStyle(document.querySelector('.marquee__track')).animationPlayState };
    });
    await page.click('.marquee__toggle');
    const after = await page.evaluate(() => {
      const t = document.querySelector('.marquee__toggle');
      return { pressed: t.getAttribute('aria-pressed'), label: t.getAttribute('aria-label'),
               play: getComputedStyle(document.querySelector('.marquee__track')).animationPlayState };
    });
    const srList = await page.evaluate(() => {
      const ul = document.querySelector('.marquee .sr-only');
      return ul ? { items: ul.querySelectorAll('li').length, label: ul.getAttribute('aria-label') } : null;
    });
    // aria-pressed carries the state and the label stays constant, so the two
    // can never contradict each other in an announcement.
    const ok = before.visible && before.play === 'running' && after.play === 'paused'
      && after.pressed === 'true' && after.label === before.label
      && srList && srList.items === 7;
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} marquee pause control + sr-only client list`);
    console.log(`       before=${JSON.stringify(before)}\n       after=${JSON.stringify(after)}\n       srList=${JSON.stringify(srList)}`);
    await page.close();
  }

  // --- no-JS: the control must not be visible ------------------------------
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const r = await page.evaluate(() => 'unused').catch(() => null);   // JS off: evaluate unavailable
    const hidden = await page.$eval('.marquee__toggle', (el) => getComputedStyle(el).display).catch(() => 'missing');
    // With JS disabled Playwright can still read computed style via the protocol.
    const ok = hidden === 'none';
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} no-JS: pause control hidden (display=${hidden})`);
    await ctx.close();
  }

  // --- reduced motion ------------------------------------------------------
  {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const r = await page.evaluate(() => ({
      anim: getComputedStyle(document.querySelector('.marquee__track')).animationName,
      toggle: getComputedStyle(document.querySelector('.marquee__toggle')).display,
    }));
    const ok = r.anim === 'none' && r.toggle === 'none';
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} reduced motion: marquee static and control hidden — ${JSON.stringify(r)}`);
    await ctx.close();
  }

  console.log(problems === 0 ? '\nPASS — no accessibility problems found'
                             : `\nFAIL — ${problems} problem(s)`);
  await browser.close();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
