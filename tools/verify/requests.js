// Asserts the site makes ZERO off-origin requests, that the self-hosted fonts
// actually resolve, and that no CSP violation fires — on every page, in every
// theme under test (THEMES, default light,dark).
const { PAGES, BASE, THEMES, launch } = require('./_common');

// The faces the design system sets per direction: Forest renders in Fraunces
// and Aptos with Geist eyebrows, Teal in Instrument Serif and Geist,
// Monochrome in Geist (Fraunces only for editorial type).
function requiredFaces(theme) {
  if (theme.startsWith('teal')) return ['Instrument Serif', 'Geist'];
  if (theme.startsWith('mono')) return ['Geist'];
  return ['Fraunces', 'Aptos', 'Geist'];
}

(async () => {
  const browser = await launch();
  let failures = 0;

  for (const p of PAGES) for (const theme of THEMES) {
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
    await page.addInitScript((t) => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation',
        (e) => window.__csp.push(`${e.effectiveDirective} -> ${e.blockedURI}`));
      try { localStorage.setItem('vynatix-theme', t); } catch (e) { /* no-op */ }
    }, theme);

    await page.goto(BASE + p, { waitUntil: 'load', timeout: 20000 }).catch((e) => failed.push('goto: ' + e.message));

    // document.fonts.check() answers true for a family that has no @font-face
    // at all, so look at the faces that actually loaded instead.
    const loaded = await page.evaluate(async () => {
      try { await document.fonts.ready; } catch (e) { /* no-op */ }
      const out = new Set();
      document.fonts.forEach((f) => { if (f.status === 'loaded') out.add(f.family.replace(/^["']|["']$/g, '')); });
      return [...out];
    });
    const missingFaces = requiredFaces(theme).filter((f) => !loaded.includes(f));

    // Flip the theme and let it settle, so the other theme's resources are exercised too.
    await page.evaluate(() => { const b = document.querySelector('.theme-toggle'); if (b) b.click(); });
    await page.waitForTimeout(250);
    cspViolations.push(...(await page.evaluate(() => window.__csp || [])));

    const bad = offOrigin.length || cspViolations.length || failed.length || missingFaces.length;
    if (bad) failures++;
    console.log(`${bad ? 'FAIL' : 'ok  '}  ${p} [${theme}]`);
    if (offOrigin.length) console.log(`        off-origin requests: ${[...new Set(offOrigin)].join(', ')}`);
    if (cspViolations.length) console.log(`        CSP violations: ${cspViolations.join(' | ')}`);
    if (failed.length) console.log(`        failed requests: ${failed.join(' | ')}`);
    if (missingFaces.length) console.log(`        fonts unresolved: ${missingFaces.join(', ')} (loaded: ${loaded.join(', ')})`);
    await ctx.close();
  }

  console.log(failures === 0
    ? '\nPASS — no off-origin requests, fonts resolve, no CSP violations'
    : `\nFAIL — ${failures} page(s) with problems`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
