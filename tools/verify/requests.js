// Asserts the site makes ZERO off-origin requests, that the self-hosted fonts
// actually resolve, and that no CSP violation fires — on every page, in every
// theme under test (THEMES, default light,dark), and on the home page in every
// hero background under test too (BGS, default all four: the woven cloth is a
// data: URI and the iris an inline SVG, so the CSP has to allow both).
//
// This is the "nothing leaves before a choice" proof for Google Analytics. It runs three ways:
//   - as shipped, a plain browser, no routes: whatever app.js does on a first visit (nothing, while GA_ID is the
//     placeholder; the undecided bar once it is set). Any Google request is aborted so a regression cannot
//     leak a real-ID hit, but the attempt is still seen and fails the run;
//   - armed (armGa) and undecided: the consent module active with the dummy ID, no answer stored;
//   - armed and with the answer pinned to denied.
// In the armed runs the Google stand-ins are in place, but a request to them still counts as off-origin here:
// before an answer, the page must not even try. The single exception to "zero" is the live mode below.
// The armed runs also assert that the consent module is really up (undecided: one #consent-bar; denied: js-consent
// on <html> and no bar), so that a module which died on load cannot pass as "nothing leaves".
//
//   CONSENT=undecided|denied  run only that armed state
//   CONSENT=granted BASE=https://vynatix.com/ node verify/requests.js
//       live only, after the real ID is set: the answer is pinned to granted on the real site, and the only
//       off-origin requests allowed are to the CSP's own Google hosts (GOOGLE_HOSTS). A collect hit the page
//       aborts while it unloads (ERR_ABORTED) is tolerated; any other failure is not.
const {
  PAGES, BASE, THEMES, bgsFor, GOOGLE_HOSTS, GTAG_SCRIPT, pinTheme, pinConsent, armGa, abortGoogle, launch, pool, redact,
  isAllowedGoogleHost,
} = require('./_common');

const LIVE = process.env.CONSENT === 'granted';
const ONLY = ['undecided', 'denied'].includes(process.env.CONSENT) ? process.env.CONSENT : null;
const STATES = LIVE ? ['granted'] : ONLY ? [ONLY] : ['plain', 'undecided', 'denied'];

if (LIVE && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) {
  console.error('CONSENT=granted is the live-only mode: run it with BASE=https://vynatix.com/ (it must not run against a local server with a real ID)');
  process.exit(2);
}

// The faces the design system sets per direction: Forest renders in Fraunces
// and Aptos with Geist eyebrows, Teal in Instrument Serif and Geist,
// Monochrome in Geist (Fraunces only for editorial type).
function requiredFaces(theme) {
  if (theme.startsWith('teal')) return ['Instrument Serif', 'Geist'];
  if (theme.startsWith('mono')) return ['Geist'];
  return ['Fraunces', 'Aptos', 'Geist'];
}

// A request the live mode allows: Google's own hosts from the CSP, a script from Tag Manager only on its pinned path.
function allowedLive(r) {
  let url;
  try { url = new URL(r.url()); } catch (e) { return false; }
  if (!isAllowedGoogleHost(url.hostname)) return false;
  return !(url.hostname === 'www.googletagmanager.com' && r.resourceType() === 'script' && url.pathname !== '/gtag/js');
}
const isCollect = (u) => { try { const h = new URL(u).hostname; return /(^|\.)google-analytics\.com$/.test(h) || /(^|\.)analytics\.google\.com$/.test(h); } catch (e) { return false; } };

async function visit(browser, p, theme, bg, state) {
  const ctx = await browser.newContext();
  if (state === 'plain') await abortGoogle(ctx);
  else if (state === 'granted') { /* the real site, real network */ } else await armGa(ctx);
  const page = await ctx.newPage();
  const offOrigin = [], cspViolations = [], failed = [], contacted = new Set();

  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return;
    if (state === 'granted' && allowedLive(r)) { try { contacted.add(new URL(u).hostname); } catch (e) { /* not a URL */ } return; }
    offOrigin.push(u);
  });
  page.on('requestfailed', (r) => {
    const reason = (r.failure() || {}).errorText || '';
    if (state === 'granted' && isCollect(r.url()) && /ERR_ABORTED/.test(reason)) return;     // a hit cut off by the page unloading
    failed.push(`${r.url()} :: ${reason}`);
  });
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text());
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation',
      (e) => window.__csp.push(`${e.effectiveDirective} -> ${e.blockedURI}`));
  });
  await page.addInitScript(pinTheme, { theme, bg });
  if (state === 'undecided' || state === 'denied' || state === 'granted') await page.addInitScript(pinConsent, state);

  await page.goto(BASE + p, { waitUntil: 'load', timeout: 20000 }).catch((e) => failed.push('goto: ' + e.message));
  if (state === 'granted') await page.waitForTimeout(3000);       // let gtag.js load and send its first hit

  // In the armed runs the module must really be up, or "nothing leaves" is proved of a page that never asked: a first
  // visit (undecided) shows the bar; a stored denial shows none but leaves the module's class on <html>.
  let moduleProblem = '';
  if (state === 'undecided' || state === 'denied') {
    const m = await page.evaluate(() => ({ bar: document.querySelectorAll('#consent-bar').length, on: document.documentElement.classList.contains('js-consent') }));
    if (!m.on) moduleProblem = 'the consent module is not running (no js-consent class on <html>)';
    else if (state === 'undecided' && m.bar !== 1) moduleProblem = `a first visit shows ${m.bar} #consent-bar elements (want 1)`;
    else if (state === 'denied' && m.bar !== 0) moduleProblem = `a stored denial still shows ${m.bar} #consent-bar element(s)`;
  }

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
  if (ctx.__ga && ctx.__ga.errors.length) failed.push(...ctx.__ga.errors);
  await ctx.close();
  return { p, theme, bg, state, offOrigin, cspViolations, failed, missingFaces, loaded, contacted: [...contacted], moduleProblem };
}

(async () => {
  const browser = await launch();
  let failures = 0;
  const jobs = [];
  for (const state of STATES) for (const p of PAGES) for (const theme of THEMES) for (const bg of bgsFor(p)) jobs.push({ p, theme, bg, state });
  const results = await pool(jobs, 3, (j) => visit(browser, j.p, j.theme, j.bg, j.state));
  const hosts = new Set();

  for (const r of results) {
    const bad = r.offOrigin.length || r.cspViolations.length || r.failed.length || r.missingFaces.length || r.moduleProblem;
    if (bad) failures++;
    r.contacted.forEach((h) => hosts.add(h));
    const label = r.state === 'plain' ? '' : r.state === 'granted' ? ' (live, answer granted)' : ` (armed, ${r.state})`;
    console.log(`${bad ? 'FAIL' : 'ok  '}  ${r.p} [${r.theme}${r.bg ? ' ' + r.bg : ''}]${label}`);
    if (r.offOrigin.length) console.log(`        off-origin requests: ${[...new Set(r.offOrigin)].map(redact).join(', ')}`);
    if (r.cspViolations.length) console.log(`        CSP violations: ${r.cspViolations.map(redact).join(' | ')}`);
    if (r.failed.length) console.log(`        failed requests: ${r.failed.map(redact).join(' | ')}`);
    if (r.moduleProblem) console.log(`        module: ${r.moduleProblem}`);
    if (r.missingFaces.length) console.log(`        fonts unresolved: ${r.missingFaces.join(', ')} (loaded: ${r.loaded.join(', ')})`);
  }
  if (LIVE) console.log(`Google hosts contacted (all in the CSP: ${GOOGLE_HOSTS.join(' ')}, script ${GTAG_SCRIPT}): ${[...hosts].sort().join(', ') || 'none'}`);

  console.log(failures === 0
    ? (LIVE ? '\nPASS — with the answer granted, only the CSP\'s Google hosts are contacted, fonts resolve, no CSP violations'
            : '\nPASS — no off-origin requests, fonts resolve, no CSP violations')
    : `\nFAIL — ${failures} page(s) with problems`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
