// The random colour scheme. The site draws one of three brand directions
// (Forest, Teal, Monochrome) at random for each visit and keeps it until the
// tab closes; light or dark follows the visitor's choice or their system. This
// proves the draw is random, the visit is stable, the toggle works inside it,
// nothing flashes, bad or blocked storage is survived, and the headline faces
// the home page preloads are the ones it uses.
//
// Every context is armed (armGa): the consent module is live with the dummy ID and Google is stubbed, so each
// test runs with the consent bar in the page, as a first-time visitor sees it. That is what proves the bar
// neither flashes the wrong theme, nor adds a preload, nor trips over blocked or poisoned storage.
const { BASE, ALL_THEMES, armGa, launch } = require('./_common');

const PAGES = ['index', 'about', 'services', 'work', 'membership', 'contact', 'privacy', 'terms', 'accessibility'];
const LOOKS = ['forest', 'teal', 'mono'];
const lookOf = (theme) => (theme.startsWith('teal') ? 'teal' : theme.startsWith('mono') ? 'mono' : 'forest');
const isDark = (theme) => /dark$/.test(theme);

(async () => {
  const browser = await launch();
  const armed = async (opts) => { const ctx = await browser.newContext(opts); await armGa(ctx); return ctx; };
  let problems = 0;
  const check = (ok, name, detail) => {
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };
  const url = (p) => `${BASE}${p}.html`;
  const state = (page) => page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    look: (() => { try { return sessionStorage.getItem('vynatix-look'); } catch (e) { return 'blocked'; } })(),
    stored: (() => { try { return localStorage.getItem('vynatix-theme'); } catch (e) { return 'blocked'; } })(),
    pressed: document.querySelector('.theme-toggle') && document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
  }));

  // 0. The armed module is really up: a first visit shows exactly one consent bar. Without this, a module that
  // died on load (a syntax error, a wrong ID rewrite) would leave every test below passing on a page with no bar.
  {
    const ctx = await armed();
    const page = await ctx.newPage();
    await page.goto(url('index'), { waitUntil: 'load' });
    const bars = await page.evaluate(() => ({ bar: document.querySelectorAll('#consent-bar').length, cls: document.documentElement.className }));
    check(bars.bar === 1 && /js-consent/.test(bars.cls), 'the armed consent module is up: a first visit shows one #consent-bar, so the tests below run with the bar in the page', `bars ${bars.bar}, html class "${bars.cls}"`);
    await ctx.close();
  }

  // 1. Every fresh visit draws a direction; across many visits all three appear.
  {
    const ctx = await armed();
    const tally = { forest: 0, teal: 0, mono: 0 };
    let bad = 0;
    for (let i = 0; i < 36; i++) {
      const page = await ctx.newPage();                  // a new tab is a new visit
      await page.goto(url('index'), { waitUntil: 'domcontentloaded' });
      const s = await state(page);
      if (!ALL_THEMES.includes(s.theme) || !LOOKS.includes(s.look) || lookOf(s.theme) !== s.look) bad++;
      else tally[s.look]++;
      await page.close();
    }
    check(bad === 0 && LOOKS.every((l) => tally[l] > 0), 'a fresh visit draws a colour scheme, and across 36 visits all three appear', JSON.stringify(tally));
    await ctx.close();
  }

  // 2. Within one visit the scheme never changes: ten page loads and a reload.
  {
    const ctx = await armed();
    let allStable = true, detail = [];
    for (let visit = 0; visit < 6; visit++) {
      const page = await ctx.newPage();
      await page.goto(url('index'), { waitUntil: 'domcontentloaded' });
      const first = (await state(page)).theme;
      const seen = new Set([first]);
      for (const p of PAGES.concat(['index'])) {
        await page.goto(url(p), { waitUntil: 'domcontentloaded' });
        seen.add((await state(page)).theme);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      seen.add((await state(page)).theme);
      if (seen.size !== 1) allStable = false;
      detail.push(first);
      await page.close();
    }
    check(allStable, 'the scheme is stable across all nine pages and a reload within a visit', `six visits drew ${detail.join(', ')}`);
    await ctx.close();
  }

  // 3. The toggle flips light and dark inside the drawn scheme, and the choice carries on.
  {
    const ctx = await armed();
    const page = await ctx.newPage();
    await page.goto(url('about'), { waitUntil: 'domcontentloaded' });
    const a = await state(page);
    await page.click('.theme-toggle');
    const b = await state(page);
    await page.goto(url('work'), { waitUntil: 'domcontentloaded' });
    const c = await state(page);
    const flipped = isDark(a.theme) !== isDark(b.theme) && lookOf(a.theme) === lookOf(b.theme);
    check(flipped && b.pressed === String(isDark(b.theme)) && c.theme === b.theme,
      'the toggle flips light/dark inside the drawn scheme and survives navigation', `${a.theme} -> ${b.theme} -> ${c.theme}`);
    // a later visit (a new tab) keeps the light/dark choice but draws the scheme again
    const darks = [];
    for (let i = 0; i < 8; i++) {
      const p2 = await ctx.newPage();
      await p2.goto(url('index'), { waitUntil: 'domcontentloaded' });
      darks.push(isDark((await state(p2)).theme));
      await p2.close();
    }
    check(darks.every((d) => d === isDark(b.theme)), 'a later visit keeps the visitor\'s light/dark choice', `choice ${isDark(b.theme) ? 'dark' : 'light'}, eight visits ${darks.map((d) => (d ? 'dark' : 'light')).join(',')}`);
    await ctx.close();
  }

  // 4. Nothing flashes: the theme on the page when the <body> is created is the final one.
  {
    const ctx = await armed();
    let flashes = 0, n = 12;
    for (let i = 0; i < n; i++) {
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        new MutationObserver((_, obs) => {
          if (document.body) { window.__atBody = document.documentElement.dataset.theme; obs.disconnect(); }
        }).observe(document, { childList: true, subtree: true });
      });
      await page.goto(url(PAGES[i % PAGES.length]), { waitUntil: 'load' });
      const r = await page.evaluate(() => ({ at: window.__atBody, final: document.documentElement.dataset.theme }));
      if (r.at !== r.final) flashes++;
      await page.close();
    }
    check(flashes === 0, 'the theme is set before the body exists, so first paint never shows the wrong one', `${n} loads, ${flashes} flashes`);
    await ctx.close();
  }

  // 5. Storage that cannot hold the draw leaves the site on Forest, not re-rolling per page.
  {
    const ctx = await armed();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const block = { get() { throw new DOMException('blocked', 'SecurityError'); } };
      Object.defineProperty(window, 'sessionStorage', block);
      Object.defineProperty(window, 'localStorage', block);
    });
    const seen = new Set();
    for (const p of ['index', 'about', 'contact', 'index']) {
      await page.goto(url(p), { waitUntil: 'domcontentloaded' });
      seen.add((await page.evaluate(() => document.documentElement.dataset.theme)));
    }
    const ok = [...seen].every((t) => lookOf(t) === 'forest') && seen.size <= 2 && errors.length === 0;
    check(ok, 'blocked storage: the site stays on Forest and throws nothing', `themes ${[...seen].join(', ')}${errors.length ? '; errors ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // 6. A stored value that is not a known scheme is discarded, never used.
  {
    const ctx = await armed();
    const bad = [];
    for (const poison of ['teal-light', '__proto__', '"><img src=x>', '', 'constructor']) {
      const page = await ctx.newPage();
      await page.addInitScript((v) => { try { sessionStorage.setItem('vynatix-look', v); } catch (e) {} }, poison);
      await page.goto(url('index'), { waitUntil: 'domcontentloaded' });
      const s = await state(page);
      if (!LOOKS.includes(s.look) || !ALL_THEMES.includes(s.theme) || lookOf(s.theme) !== s.look) bad.push(poison);
      await page.close();
    }
    check(bad.length === 0, 'an unknown stored scheme is replaced by a valid draw', bad.length ? 'accepted: ' + bad.join(' | ') : '5 bad values');
    await ctx.close();
  }

  // 7. With no stored choice, light or dark follows the system preference.
  for (const scheme of ['dark', 'light']) {
    const ctx = await armed({ colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(url('index'), { waitUntil: 'domcontentloaded' });
    const s = await state(page);
    check(isDark(s.theme) === (scheme === 'dark'), `no stored choice: a ${scheme}-mode system gets a ${scheme} theme`, s.theme);
    await ctx.close();
  }

  // 8. Without JavaScript the page keeps the Forest light theme its markup names.
  {
    const ctx = await armed({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(url('index'), { waitUntil: 'domcontentloaded' });
    const t = await page.evaluate(() => document.documentElement.getAttribute('data-theme')).catch(() => null);
    const attr = t || await page.$eval('html', (el) => el.getAttribute('data-theme'));
    check(attr === 'light', 'no JavaScript: the Forest light theme', attr);
    await ctx.close();
  }

  // 9. The home page preloads the headline faces of the drawn scheme, and uses them.
  for (const [look, theme, files] of [
    ['forest', 'light', ['fraunces-variable-latin', 'fraunces-italic-variable-latin']],
    ['teal', 'teal-light', ['instrument-serif-400-latin', 'instrument-serif-400-italic-latin']],
    ['mono', 'mono-dark', ['geist-variable-latin', 'fraunces-italic-variable-latin']],
  ]) {
    const ctx = await armed();
    const page = await ctx.newPage();
    const warnings = [];
    page.on('console', (m) => { if (/preload/i.test(m.text())) warnings.push(m.text().slice(0, 140)); });
    await page.addInitScript((t) => {
      try { sessionStorage.setItem('vynatix-look', t.look); localStorage.setItem('vynatix-theme', t.theme); } catch (e) {}
    }, { look, theme });
    await page.goto(url('index'), { waitUntil: 'load' });
    await page.waitForTimeout(4500);                      // the browser reports unused preloads a few seconds after load
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => l.getAttribute('href')));
    const want = files.map((f) => `fonts/${f}.woff2`);
    const ok = want.every((w) => hrefs.includes(w)) && hrefs.length === want.length && warnings.length === 0;
    check(ok, `${look}: preloads ${files.join(' + ')} and uses them`, `${hrefs.join(', ')}${warnings.length ? '; ' + warnings.join(' | ') : ''}`);
    await ctx.close();
  }

  // 10. Other pages preload nothing (the draw only matters for the home headline).
  {
    const ctx = await armed();
    const page = await ctx.newPage();
    await page.goto(url('services'), { waitUntil: 'domcontentloaded' });
    const n = await page.evaluate(() => document.querySelectorAll('link[rel="preload"]').length);
    check(n === 0, 'pages other than the home page add no preloads', `${n}`);
    await ctx.close();
  }

  console.log(problems === 0 ? '\nPASS — the random colour scheme behaves' : `\nFAIL — ${problems} problem(s)`);
  await browser.close();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
