// Asserts the site makes ZERO off-origin requests, that the self-hosted fonts
// actually resolve, and that no CSP violation fires — on every page, in both themes.
const { PAGES, BASE, launch } = require('./_common');

(async () => {
  const browser = await launch();
  let failures = 0;

  for (const p of PAGES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const offOrigin = [], cspViolations = [], failed = [];

    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u);
    });
    page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${(r.failure() || {}).errorText}`));
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text());
    });
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation',
        (e) => window.__csp.push(`${e.effectiveDirective} -> ${e.blockedURI}`));
    });

    await page.goto(BASE + p, { waitUntil: 'load', timeout: 20000 }).catch((e) => failed.push('goto: ' + e.message));

    const fonts = await page.evaluate(async () => {
      try { await document.fonts.ready; } catch (e) { /* no-op */ }
      return {
        serif: document.fonts.check('16px "Instrument Serif"'),
        sans: document.fonts.check('16px "Geist"'),
      };
    });

    // Flip to dark and let it settle, so theme-specific resources are exercised too.
    await page.evaluate(() => { const b = document.querySelector('.theme-toggle'); if (b) b.click(); });
    await page.waitForTimeout(250);
    cspViolations.push(...(await page.evaluate(() => window.__csp || [])));

    const bad = offOrigin.length || cspViolations.length || failed.length || !fonts.serif || !fonts.sans;
    if (bad) failures++;
    console.log(`${bad ? 'FAIL' : 'ok  '}  ${p}`);
    if (offOrigin.length) console.log(`        off-origin requests: ${[...new Set(offOrigin)].join(', ')}`);
    if (cspViolations.length) console.log(`        CSP violations: ${cspViolations.join(' | ')}`);
    if (failed.length) console.log(`        failed requests: ${failed.join(' | ')}`);
    if (!fonts.serif || !fonts.sans) console.log(`        fonts unresolved: serif=${fonts.serif} sans=${fonts.sans}`);
    await ctx.close();
  }

  console.log(failures === 0
    ? '\nPASS — no off-origin requests, fonts resolve, no CSP violations'
    : `\nFAIL — ${failures} page(s) with problems`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
