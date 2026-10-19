// The one check that talks to Google for real. Everything else stubs Google; this proves what the stubs only
// imitate, with the dummy Measurement ID G-TEST000000 and nothing else.
//   LIVE=1 node verify/consent-live.js            (npm run consent-live)
//   ENGINES=chromium,firefox,webkit               which browsers (default all three; one that is not installed or
//                                                 cannot start in this environment is reported and skipped)
// Without LIVE=1 it prints this and exits 0: it is not part of `npm run check`, which must never need the network.
//
// The pages are served from the local server (BASE, localhost only) with app.js rewritten to the dummy ID (the
// same rewriteGaId armGa uses), and the policy and footer link added if the tree does not carry them yet. Google
// is NOT stubbed: the CSP's own hosts (GOOGLE_HOSTS) get the real network, and any other request is aborted and
// counted. The script refuses to run unless the rewritten ID is exactly G-TEST000000, and it never reads out or
// prints the ID in app.js: URLs are redacted before they are printed.
//
// Per browser it
//  - accepts by a real click and waits for a collect hit that Google answers with 2xx;
//  - records every host contacted and every securitypolicyviolation, so the CSP can be checked against what
//    gtag really needs, and prints the cookies it set: name, domain, path, SameSite, expiry, for the pre-flip
//    checklist and the cookie table in the privacy notice;
//  - declines from the footer link, waits ten seconds, and asserts no further collect hit, no _ga cookie and no
//    violation; accepts again, and declines again;
//  - repeats the decline across a back/forward cache round trip, where the engine restores from the cache.
// Cookies are set for localhost here, so the parent-domain deletion of the real site is not exercised: see the
// checklist for the run on vynatix.com with the real ID.
const {
  BASE, ROOT, TEST_ID, GOOGLE_HOSTS, GTAG_SCRIPT, isAllowedGoogleHost, readApp, rewriteGaIdSource, redact, launch, todayUtc,
} = require('./_common');
const C = require('./_consent');

if (process.env.LIVE !== '1') {
  console.log(`consent-live.js uses the real network: it loads gtag.js and sends collect hits to Google with the dummy ID ${TEST_ID}.
It only runs when asked:

  LIVE=1 node verify/consent-live.js        (or: cd tools && npm run consent-live)
  LIVE=1 ENGINES=chromium node verify/consent-live.js

Serve the repo first (python3 -m http.server 8000). Firefox and WebKit need: npx playwright install firefox webkit
It is not part of npm run check. Nothing was run.`);
  process.exit(0);
}

const { sleep, armedContext, open, barButton: btn } = C;
const rep = C.reporter();
const ck = rep.check;
const ENGINES = (process.env.ENGINES || 'chromium,firefox,webkit').split(',').map((e) => e.trim()).filter(Boolean);
const isCollect = (u) => { try { const h = new URL(u).hostname; return (/(^|\.)google-analytics\.com$/.test(h) || /(^|\.)analytics\.google\.com$/.test(h)) && /collect/.test(new URL(u).pathname); } catch (e) { return false; } };

// Browsers do not read HTTPS_PROXY by themselves. Only the host and port are ever printed.
function proxyOption() {
  const raw = process.env.PW_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!raw) return undefined;
  const u = new URL(raw);
  const opt = { server: `${u.protocol}//${u.host}`, bypass: 'localhost,127.0.0.1' };
  if (u.username) { opt.username = decodeURIComponent(u.username); opt.password = decodeURIComponent(u.password); }
  return opt;
}

async function launchEngine(name, opts) {
  const pw = require('playwright');
  if (name === 'chromium') return launch(opts);
  const { ignoreDefaultArgs, args, ...rest } = opts;       // eslint-disable-line no-unused-vars
  return pw[name].launch(rest);
}

// What the page did on the network, from the context: every request that left the site and how it ended.
function watchNetwork(ctx) {
  const net = new Map();
  const t0 = Date.now();
  const key = (r) => r;
  ctx.on('request', (r) => {
    let u;
    try { u = new URL(r.url()); } catch (e) { return; }
    if (BASE.startsWith(u.origin) || u.protocol === 'data:' || u.protocol === 'blob:') return;
    net.set(key(r), { url: redact(r.url()), host: u.hostname, path: u.pathname, type: r.resourceType(), method: r.method(), t: Date.now() - t0, status: null, failure: null, collect: isCollect(r.url()) });
  });
  ctx.on('response', (r) => { const e = net.get(key(r.request())); if (e) e.status = r.status(); });
  ctx.on('requestfailed', (r) => { const e = net.get(key(r)); if (e) e.failure = (r.failure() || {}).errorText || 'failed'; });
  return { all: () => [...net.values()], t0, now: () => Date.now() - t0 };
}

function cookieTable(cookies) {
  const now = Date.now() / 1000;
  return cookies.map((c) => {
    const life = c.expires > 0 ? (c.expires - now) / 86400 : null;
    return `  ${c.name} | domain ${c.domain} | path ${c.path} | SameSite ${c.sameSite} | ${c.secure ? 'Secure' : 'not Secure'} | ${c.httpOnly ? 'HttpOnly' : 'script-readable'} | expires ${c.expires > 0 ? new Date(c.expires * 1000).toISOString().slice(0, 10) : 'with the session'}${life !== null ? ` (${life.toFixed(0)} days from now)` : ''}`;
  });
}
const gaCookieObjects = async (ctx) => (await ctx.cookies()).filter((c) => c.name === '_ga' || c.name.startsWith('_ga_'));

async function runEngine(name, browser) {
  console.log(`\n== ${name} ${browser.version()}`);
  const env = await armedContext(browser, { arm: { live: true, stripUpgrade: name === 'webkit' }, viewport: { width: 1280, height: 800 }, theme: 'light' });
  const net = watchNetwork(env.ctx);
  const page = await open(env.ctx, 'index.html');
  await sleep(1500);
  ck(net.all().length === 0 && (await env.ctx.cookies()).length === 0, 'before a choice: nothing contacted outside the site, no cookie', net.all().map((e) => e.url).join(', '));

  // --- Accept
  const answered = page.waitForResponse((r) => isCollect(r.url()) && r.status() >= 200 && r.status() < 300, { timeout: 25000 }).then((r) => r.status(), () => null);
  await page.click(btn('granted'));
  const status = await answered;
  ck(status !== null, 'Accept: a collect hit is sent and Google answers 2xx', status === null ? `none within 25 s; seen: ${net.all().filter((e) => e.collect).map((e) => `${e.method} ${e.host} ${e.status || e.failure}`).join(' | ') || 'no collect request'}` : `status ${status}`);
  const gtag = net.all().find((e) => e.host === 'www.googletagmanager.com' && e.path === '/gtag/js');
  ck(!!gtag && gtag.status === 200, 'Accept: gtag.js is loaded from the path-pinned URL', gtag ? `status ${gtag.status}` : 'not requested');
  await sleep(3000);
  const hosts = {};
  for (const e of net.all()) (hosts[e.host] = hosts[e.host] || { n: 0, types: new Set(), statuses: new Set() }, hosts[e.host].n++, hosts[e.host].types.add(e.type), hosts[e.host].statuses.add(e.status || e.failure || '?'));
  console.log('hosts contacted after Accept (the CSP allows: ' + GOOGLE_HOSTS.join(' ') + '; script path ' + GTAG_SCRIPT + '):');
  for (const [h, v] of Object.entries(hosts).sort()) console.log(`  ${h} | ${v.n} request(s) | ${[...v.types].join(',')} | status ${[...v.statuses].join(',')} | ${isAllowedGoogleHost(h) ? 'allowed by the CSP' : 'NOT in the CSP'}`);
  const outside = Object.keys(hosts).filter((h) => !isAllowedGoogleHost(h));
  ck(outside.length === 0, 'Accept: every host contacted is one the CSP allows', outside.join(', '));
  ck(env.ga.blocked.length === 0, 'Accept: nothing was refused by the request filter', env.ga.blocked.map(redact).join(', '));
  ck(env.violations.length === 0 && env.refused.length === 0, 'Accept: no securitypolicyviolation and no "Refused to" message', env.violations.concat(env.refused).map(redact).join(' | '));
  const cookies = await gaCookieObjects(env.ctx);
  console.log('cookies after Accept (for the pre-flip checklist and the cookie table in the notice):');
  cookieTable(cookies).forEach((l) => console.log(l));
  console.log('  all cookie names: ' + ((await env.ctx.cookies()).map((c) => c.name).join(', ') || 'none'));
  ck(cookies.some((c) => c.name === '_ga'), 'Accept: the _ga cookie is set', cookies.map((c) => c.name).join(', '));
  const longest = Math.max(0, ...cookies.map((c) => (c.expires > 0 ? (c.expires - Date.now() / 1000) / 86400 : 0)));
  ck(longest <= 365.05, 'Accept: no _ga cookie outlives the 365-day consent record', `longest ${longest.toFixed(1)} days`);
  const extra = (await env.ctx.cookies()).filter((c) => !(c.name === '_ga' || c.name.startsWith('_ga_')));
  ck(extra.length === 0, 'Accept: no cookie other than _ga and _ga_<id> is set', extra.map((c) => c.name).join(', '));

  // --- Decline from the footer link, then ten seconds of silence
  await page.click('[data-consent-open]');
  const tDecline = net.now();
  const before = net.all().filter((e) => e.collect).length;
  await page.click(btn('denied'));
  await sleep(1200);
  ck((await gaCookieObjects(env.ctx)).length === 0, 'Decline: the _ga cookies are removed');
  await sleep(10000);
  const after = net.all().filter((e) => e.collect && e.t > tDecline);
  ck(after.length === 0, 'Decline: no collect hit in the ten seconds after', after.map((e) => `${e.method} ${e.host} +${e.t - tDecline}ms`).join(' | ') || `${before} before`);
  const sinceDecline = net.all().filter((e) => e.t > tDecline);
  if (sinceDecline.length) console.log('  requests after Decline (not collect hits): ' + sinceDecline.map((e) => `${e.method} ${e.host}${e.path} ${e.status || e.failure}`).join(' | '));
  ck((await gaCookieObjects(env.ctx)).length === 0, 'Decline: still no _ga cookie after ten seconds', (await gaCookieObjects(env.ctx)).map((c) => c.name).join(', '));
  ck(env.violations.length === 0 && env.refused.length === 0, 'Decline: no securitypolicyviolation', env.violations.concat(env.refused).join(' | '));

  // --- Accept again, then decline again: measuring resumes and stops again
  const again = page.waitForResponse((r) => isCollect(r.url()) && r.status() >= 200 && r.status() < 300, { timeout: 25000 }).then((r) => r.status(), () => null);
  await page.click('[data-consent-open]');
  await page.click(btn('granted'));
  ck((await again) !== null, 'Accept again: measuring resumes (a new collect hit, 2xx)');
  await sleep(1500);
  await page.click('[data-consent-open]');
  const tSecond = net.now();
  await page.click(btn('denied'));
  await sleep(6000);
  const late = net.all().filter((e) => e.collect && e.t > tSecond);
  ck(late.length === 0 && (await gaCookieObjects(env.ctx)).length === 0, 'Decline again: no collect hit and no _ga cookie afterwards', late.map((e) => e.host).join(', '));
  // The whole run must have used only the dummy ID.
  ck(!net.all().some((e) => /G-[A-Z0-9]{6,12}/.test(e.url) && !e.url.includes(TEST_ID)), 'only the dummy Measurement ID appeared in any request');
  await env.close();
}

// Decline in another tab while this one sits in the back/forward cache, then restore it.
async function runBfcache(name) {
  const opts = { proxy: proxyOption() };
  if (name === 'chromium') Object.assign(opts, { ignoreDefaultArgs: ['--disable-back-forward-cache'], args: ['--enable-features=BackForwardCache'] });
  const browser = await launchEngine(name, opts);
  const env = await armedContext(browser, { arm: { live: true, stripUpgrade: name === 'webkit' }, theme: 'light' });
  const net = watchNetwork(env.ctx);
  const A = await env.ctx.newPage();
  await A.addInitScript(() => { window.addEventListener('pageshow', (e) => { (window.__ps = window.__ps || []).push(e.persisted); }); });
  await A.goto(BASE + 'index.html', { waitUntil: 'load' });
  const answered = A.waitForResponse((r) => isCollect(r.url()) && r.status() >= 200 && r.status() < 300, { timeout: 25000 }).then(() => true, () => false);
  await A.click(btn('granted'));
  const measured = await answered;
  await A.evaluate(() => { window.__marker = 'alive'; });
  await A.goto(BASE + 'about.html', { waitUntil: 'load' });
  await sleep(1000);
  const B = await open(env.ctx, 'privacy.html');
  await B.click('[data-consent-panel] [data-consent-choice=denied]');
  await sleep(800);
  await B.close();
  const tRestore = net.now();
  await A.goBack({ waitUntil: 'commit' }).catch(() => {});
  await sleep(1500);
  const restored = await A.evaluate(() => window.__marker === 'alive').catch(() => false);
  if (!measured) ck(false, `${name} back/forward cache: the page never measured, so the round trip proves nothing`);
  else if (!restored) console.log(`note  ${name}: the page was not restored from the back/forward cache here (the engine or gtag.js kept it out), so that round trip is not exercised`);
  else {
    await sleep(8000);
    const hits = net.all().filter((e) => e.collect && e.t > tRestore);
    ck(hits.length === 0 && (await gaCookieObjects(env.ctx)).length === 0, `${name} back/forward cache: a restored page that was declined elsewhere sends nothing and sets no cookie (ten seconds)`, hits.map((e) => `${e.host} +${e.t - tRestore}ms`).join(', '));
  }
  await env.close();
  await browser.close();
}

(async () => {
  // Refuse to run with anything but the dummy ID, and never print the ID in the file.
  const base = new URL(BASE);
  if (!/^(localhost|127\.0\.0\.1)$/.test(base.hostname)) { console.error(`refusing to run: BASE must be the local server, not ${base.host}`); process.exit(2); }
  const probe = readApp();
  let rewritten;
  try { rewritten = rewriteGaIdSource(probe.src, TEST_ID); } catch (e) { console.error('refusing to run: ' + e.message); process.exit(2); }
  if (readApp(ROOT, rewritten).gaId !== TEST_ID) { console.error('refusing to run: the rewritten ID is not exactly the dummy ID'); process.exit(2); }

  const proxy = proxyOption();
  console.log(`consent-live: dummy ID ${TEST_ID}, pages from ${BASE}, ${proxy ? 'browsers via the proxy at ' + proxy.server : 'no proxy configured'}, ${todayUtc()}`);
  let ran = 0;
  for (const name of ENGINES) {
    let browser;
    try { browser = await launchEngine(name, { proxy }); } catch (e) {
      console.log(`\n== ${name}\nSKIP ${name}: cannot start here — ${String(e.message).split('\n').filter((l) => l.trim()).slice(0, 3).join(' | ').replace(/[╔╗╚╝║═]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)}`);
      continue;
    }
    ran++;
    try { await runEngine(name, browser); } catch (e) { ck(false, `${name}: run crashed`, redact(String(e && e.message).split('\n')[0])); }
    await browser.close();
    try { await runBfcache(name); } catch (e) { ck(false, `${name} back/forward cache: run crashed`, redact(String(e && e.message).split('\n')[0])); }
  }
  if (!ran) { console.log('\nFAIL — no browser could be started'); process.exit(1); }
  const problems = rep.problems;
  console.log(problems === 0 ? `\nPASS — ${ran} browser(s): accept measures, decline stops it within ten seconds, no cookie survives, no violation`
                             : `\nFAIL — ${problems} problem(s)`);
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(redact(e && e.message ? e.message : String(e))); process.exit(1); });
