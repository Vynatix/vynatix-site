// The one colour scheme. The site shows Monochrome only (mono-light, mono-dark); light or dark follows
// the visitor's choice from the toggle or their system. This proves every page and every visit is
// Monochrome, the toggle flips light and dark and is remembered (a choice stored before the site went
// Monochrome, such as "dark" or "teal-dark", keeps its light/dark half), nothing flashes, bad or blocked
// storage is survived, the retired colour-scheme key is never written, and the headline faces the home
// page preloads are the ones it uses.
//
// Every context is armed (armGa): the consent module is live with the dummy ID and Google is stubbed, so each
// test runs with the consent bar in the page, as a first-time visitor sees it. That is what proves the bar
// neither flashes the wrong theme, nor adds a preload, nor trips over blocked or poisoned storage.
const { BASE, ALL_THEMES, armGa, launch } = require('./_common');

const PAGES = ['index', 'about', 'services', 'work', 'membership', 'contact', 'privacy', 'terms', 'accessibility', 'sv', 'integritet'];
const isDark = (theme) => /dark$/.test(theme);

(async () => {
  const browser = await launch();
  // Armed (the consent bar is in the page), the way every context of this check is made. Nothing is pinned, so
  // the theme and the consent answer stay free.
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

  // 1. Every page, in many fresh visits, is Monochrome, and the retired colour-scheme key is never written.
  {
    const ctx = await armed();
    const bad = [];
    for (let i = 0; i < 12; i++) {
      const page = await ctx.newPage();                  // a new tab is a new visit
      await page.goto(url(PAGES[i % PAGES.length]), { waitUntil: 'domcontentloaded' });
      const s = await state(page);
      if (!ALL_THEMES.includes(s.theme) || s.look !== null) bad.push(`${PAGES[i % PAGES.length]}: ${s.theme}, look ${s.look}`);
      await page.close();
    }
    check(bad.length === 0, 'every visit to every page shows a Monochrome theme and writes no vynatix-look', bad.join(' | '));
    await ctx.close();
  }

  // 2. The toggle flips light and dark within Monochrome, and the choice carries on to later pages and visits.
  {
    const ctx = await armed();
    const page = await ctx.newPage();
    await page.goto(url('about'), { waitUntil: 'domcontentloaded' });
    const a = await state(page);
    await page.click('.theme-toggle');
    const b = await state(page);
    await page.goto(url('work'), { waitUntil: 'domcontentloaded' });
    const c = await state(page);
    const flipped = isDark(a.theme) !== isDark(b.theme) && ALL_THEMES.includes(a.theme) && ALL_THEMES.includes(b.theme);
    check(flipped && b.pressed === String(isDark(b.theme)) && c.theme === b.theme && b.stored === b.theme,
      'the toggle flips mono-light and mono-dark, stores it and survives navigation', `${a.theme} -> ${b.theme} -> ${c.theme}, stored ${b.stored}`);
    const darks = [];
    for (let i = 0; i < 4; i++) {
      const p2 = await ctx.newPage();
      await p2.goto(url('index'), { waitUntil: 'domcontentloaded' });
      darks.push(isDark((await state(p2)).theme));
      await p2.close();
    }
    check(darks.every((d) => d === isDark(b.theme)), 'a later visit keeps the visitor\'s light/dark choice', `choice ${isDark(b.theme) ? 'dark' : 'light'}, four visits ${darks.map((d) => (d ? 'dark' : 'light')).join(',')}`);
    await ctx.close();
  }

  // 3. A light/dark choice stored before the site went Monochrome keeps its light/dark half.
  {
    const bad = [];
    for (const [stored, want] of [['light', 'mono-light'], ['dark', 'mono-dark'], ['teal-light', 'mono-light'], ['teal-dark', 'mono-dark'], ['mono-dark', 'mono-dark']]) {
      const ctx = await armed({ colorScheme: isDark(want) ? 'light' : 'dark' });   // the system says the opposite
      const page = await ctx.newPage();
      await page.addInitScript((v) => { try { localStorage.setItem('vynatix-theme', v); } catch (e) {} }, stored);
      await page.goto(url('index'), { waitUntil: 'domcontentloaded' });
      const s = await state(page);
      if (s.theme !== want) bad.push(`${stored} -> ${s.theme}`);
      await ctx.close();
    }
    check(bad.length === 0, 'a stored legacy choice (light, dark, teal-light, teal-dark) keeps its light or dark half in Monochrome', bad.join(' | '));
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

  // 5. Blocked storage: the site stays Monochrome, follows the system and throws nothing.
  for (const scheme of ['light', 'dark']) {
    const ctx = await armed({ colorScheme: scheme });
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
    const ok = seen.size === 1 && seen.has(`mono-${scheme}`) && errors.length === 0;
    check(ok, `blocked storage on a ${scheme}-mode system: mono-${scheme} on every page, nothing thrown`, `themes ${[...seen].join(', ')}${errors.length ? '; errors ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // 6. A stored choice that is not a known theme is discarded, never used.
  {
    const ctx = await armed();
    const bad = [];
    for (const poison of ['forest', '__proto__', '"><img src=x>', '', 'constructor', 'mono-dark"']) {
      const page = await ctx.newPage();
      await page.addInitScript((v) => { try { localStorage.setItem('vynatix-theme', v); sessionStorage.setItem('vynatix-look', 'teal'); } catch (e) {} }, poison);
      await page.goto(url('index'), { waitUntil: 'domcontentloaded' });
      const s = await state(page);
      if (s.theme !== 'mono-light') bad.push(`${JSON.stringify(poison)} -> ${s.theme}`);
      await page.close();
    }
    check(bad.length === 0, 'an unknown stored choice (and a leftover vynatix-look) is ignored: the light system gets mono-light', bad.length ? 'accepted: ' + bad.join(' | ') : '6 bad values');
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

  // 8. Without JavaScript the page keeps the Monochrome light theme its markup names.
  {
    const ctx = await armed({ javaScriptEnabled: false });
    const bad = [];
    for (const p of PAGES) {
      const page = await ctx.newPage();
      await page.goto(url(p), { waitUntil: 'domcontentloaded' });
      const attr = await page.$eval('html', (el) => el.getAttribute('data-theme'));
      if (attr !== 'mono-light') bad.push(`${p}: ${attr}`);
      await page.close();
    }
    check(bad.length === 0, 'no JavaScript: every page names the Monochrome light theme', bad.join(' | '));
    await ctx.close();
  }

  // 9. The home page preloads the Monochrome headline faces, and uses them.
  for (const theme of ALL_THEMES) {
    const files = ['geist-variable-latin', 'fraunces-italic-variable-latin'];
    const ctx = await armed();
    const page = await ctx.newPage();
    const warnings = [];
    page.on('console', (m) => { if (/preload/i.test(m.text())) warnings.push(m.text().slice(0, 140)); });
    await page.addInitScript((t) => { try { localStorage.setItem('vynatix-theme', t); } catch (e) {} }, theme);
    await page.goto(url('index'), { waitUntil: 'load' });
    await page.waitForTimeout(4500);                      // the browser reports unused preloads a few seconds after load
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => l.getAttribute('href')));
    const want = files.map((f) => `fonts/${f}.woff2`);
    const ok = want.every((w) => hrefs.includes(w)) && hrefs.length === want.length && warnings.length === 0;
    check(ok, `${theme}: preloads ${files.join(' + ')} and uses them`, `${hrefs.join(', ')}${warnings.length ? '; ' + warnings.join(' | ') : ''}`);
    await ctx.close();
  }

  // 10. Other pages preload nothing (only the home headline needs one).
  {
    const ctx = await armed();
    const page = await ctx.newPage();
    await page.goto(url('services'), { waitUntil: 'domcontentloaded' });
    const n = await page.evaluate(() => document.querySelectorAll('link[rel="preload"]').length);
    check(n === 0, 'pages other than the home page add no preloads', `${n}`);
    await ctx.close();
  }

  console.log(problems === 0 ? '\nPASS — the one colour scheme behaves' : `\nFAIL — ${problems} problem(s)`);
  await browser.close();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
