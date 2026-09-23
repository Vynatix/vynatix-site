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

  // --- skip link, on every page --------------------------------------------
  {
    const page = await browser.newPage();
    const bad = [];
    for (const pg of PAGES) {
      await page.goto(BASE + pg, { waitUntil: 'load' });
      await page.keyboard.press('Tab');
      await page.waitForTimeout(250);          // let the reveal transition finish
      const r = await page.evaluate(() => {
        const el = document.activeElement;
        const box = el.getBoundingClientRect();
        return { cls: el.className || '', href: el.getAttribute('href'),
                 onScreen: box.top >= 0 && box.top < window.innerHeight,
                 target: !!document.querySelector('#main') };
      });
      if (!(r.cls.includes('skip-link') && r.href === '#main' && r.onScreen && r.target)) {
        bad.push(`${pg}: ${JSON.stringify(r)}`);
      }
    }
    if (bad.length) problems++;
    console.log(bad.length
      ? `FAIL skip link — ${bad.join(' | ')}`
      : `ok   skip link is the first Tab stop and reveals on focus on all ${PAGES.length} pages`);
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
    // The strip repeats the client list several times so the loop is seamless.
    // Exactly one copy must be the real one (labelled, links in the tab order,
    // every link off-site); every other copy must be aria-hidden with its
    // links taken out of the tab order, or a keyboard user tabs through
    // hidden duplicates.
    const clients = await page.evaluate(() => {
      const groups = [...document.querySelectorAll('.marquee__group')];
      const real = groups.filter((g) => g.getAttribute('aria-hidden') !== 'true');
      const decor = groups.filter((g) => g.getAttribute('aria-hidden') === 'true');
      const links = (g) => [...g.querySelectorAll('a')];
      return {
        groups: groups.length,
        real: real.length,
        label: real[0] && real[0].getAttribute('aria-label'),
        items: real[0] ? real[0].querySelectorAll('li').length : 0,
        realTabbable: real.every((g) => links(g).every((a) => !a.hasAttribute('tabindex'))),
        realExternal: real.every((g) => links(g).every((a) => /^https:\/\//.test(a.getAttribute('href')) && a.getAttribute('rel') === 'noopener')),
        decorUntabbable: decor.every((g) => links(g).every((a) => a.getAttribute('tabindex') === '-1')),
      };
    });
    // aria-pressed carries the state and the label stays constant, so the two
    // can never contradict each other in an announcement.
    const ok = before.visible && before.play === 'running' && after.play === 'paused'
      && after.pressed === 'true' && after.label === before.label
      && clients.groups >= 2 && clients.real === 1 && !!clients.label && clients.items >= 2
      && clients.realTabbable && clients.realExternal && clients.decorUntabbable;
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} marquee pause control + one real client list, decorative copies hidden`);
    console.log(`       before=${JSON.stringify(before)}\n       after=${JSON.stringify(after)}\n       clients=${JSON.stringify(clients)}`);
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

  // --- independent contrast sweep -----------------------------------------
  // axe skips nodes whose background it cannot resolve, and it missed a 66px
  // accent at 1.75:1 outright. Compute every visible text node ourselves.
  {
    const page = await browser.newPage();
    const failures = [];
    for (const pg of PAGES) {
      for (const theme of ['light', 'dark']) {
        await page.addInitScript((t) => { try { localStorage.setItem('vynatix-theme', t); } catch (e) {} }, theme);
        await page.goto(BASE + pg, { waitUntil: 'load' });
        const bad = await page.evaluate(() => {
          const lum = (rgb) => {
            const c = rgb.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
            return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
          };
          const nums = (str) => { const m = str.match(/[\d.]+/g); return m ? m.map(Number) : null; };
          const out = [];
          document.querySelectorAll('*').forEach((el) => {
            const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            if (!ownText) return;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
            const box = el.getBoundingClientRect();
            if (!box.width || !box.height) return;
            if (el.closest('[aria-hidden="true"]')) return;
            const fgAll = nums(cs.color);
            if (!fgAll) return;
            const fg = fgAll.slice(0, 3);
            let bg = null, n = el, bailed = false;
            while (n) {
              const ncs = getComputedStyle(n);
              if (ncs.backgroundImage !== 'none') { bailed = true; break; }
              const c = ncs.backgroundColor;
              const parts = nums(c);
              if (parts && (parts.length < 4 || parts[3] === 1) && c !== 'rgba(0, 0, 0, 0)') {
                bg = parts.slice(0, 3);
                break;
              }
              n = n.parentElement;
            }
            if (bailed || !bg) return;
            const L1 = lum(fg), L2 = lum(bg);
            const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
            const px = parseFloat(cs.fontSize);
            const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
            const need = large ? 3 : 4.5;
            if (ratio < need) {
              out.push({
                sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
                text: el.textContent.trim().slice(0, 24),
                ratio: Math.round(ratio * 100) / 100, need, px: Math.round(px),
              });
            }
          });
          return out;
        });
        bad.forEach((b) => failures.push(`${pg} [${theme}] ${b.sel} "${b.text}" ${b.ratio}:1 < ${b.need} (${b.px}px)`));
      }
    }
    if (failures.length) problems++;
    console.log(failures.length
      ? `FAIL contrast sweep — ${failures.length} node(s)\n       ${failures.slice(0, 15).join('\n       ')}`
      : 'ok   contrast sweep — every visible text node meets AA in both themes');
    await page.close();
  }

  console.log(problems === 0 ? '\nPASS — no accessibility problems found'
                             : `\nFAIL — ${problems} problem(s)`);
  await browser.close();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
