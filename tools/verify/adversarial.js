// Proves the CSP BLOCKS attacks, rather than merely permitting legitimate traffic.
// Every check here is an attack that must fail.
//
// Framing/clickjacking is deliberately absent: `frame-ancestors` cannot be
// expressed in a meta CSP at all, so it is an edge-layer control and is
// asserted by headers.js instead. Two of the checks below (storage
// poisoning and URL reflection) pass because app.js has no reflective sink,
// not because the CSP blocks them — they guard against a future regression.
const { BASE, ALL_THEMES, ALL_BGS, launch } = require('./_common');

(async () => {
  const browser = await launch();
  const results = [];
  const record = (name, passed, detail) =>
    results.push(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);

  const page = await browser.newPage();
  // The hero background is drawn at random; pin it to the sheet unless a check below has put
  // something else in its place (pinBg would overwrite the poison the checks plant).
  await page.addInitScript(() => {
    try { if (sessionStorage.getItem('vynatix-bg') === null) sessionStorage.setItem('vynatix-bg', 'sheet'); } catch (e) { /* blocked */ }
  });
  await page.addInitScript(() => {
    window.__v = [];
    document.addEventListener('securitypolicyviolation',
      (e) => window.__v.push(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'}`));
  });
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });

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

  // 2. External script from a non-allowed host must not load.
  const ext = await page.evaluate(() => new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'https://evil.example/x.js';
    s.onload = () => res('LOADED');
    s.onerror = () => res('blocked');
    document.body.appendChild(s);
    setTimeout(() => res('timeout'), 1500);
  }));
  record('CSP blocks external script', ext !== 'LOADED', `result=${ext}`);

  // 3. Image from a non-allow-listed host must not load.
  const img = await page.evaluate(() => new Promise((res) => {
    const i = new Image();
    i.onload = () => res('LOADED');
    i.onerror = () => res('blocked');
    i.src = 'https://evil.example/x.png';
    setTimeout(() => res('timeout'), 1500);
  }));
  record('CSP blocks off-allowlist image', img !== 'LOADED', `result=${img}`);

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

  // 6. Poisoned stored values (the light/dark choice, the drawn colour scheme, the drawn
  //    hero background and the weave's seed) must be rejected, not reflected into the DOM
  //    or into a style. (The iris's test hook, vynatix-bg-iris-idle, is read as a number.)
  await page.evaluate(() => {
    const p = (n) => '"><img src=x onerror=window.__xss=' + n + '>';
    localStorage.setItem('vynatix-theme', p(1));
    sessionStorage.setItem('vynatix-look', p(2));
    sessionStorage.setItem('vynatix-bg', p(3));
    sessionStorage.setItem('vynatix-bg-seed', p(4));
    sessionStorage.setItem('vynatix-bg-iris-idle', p(5));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const poison = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    look: sessionStorage.getItem('vynatix-look'),
    bg: document.documentElement.getAttribute('data-bg'),
    bgStored: sessionStorage.getItem('vynatix-bg'),
    xss: window.__xss || false,
    node: !!document.querySelector('img[src="x"]'),
  }));
  record('storage poisoning rejected',
    ALL_THEMES.includes(poison.theme) && ['forest', 'teal', 'mono'].includes(poison.look) &&
    ALL_BGS.includes(poison.bg) && poison.bg === poison.bgStored && !poison.xss && !poison.node,
    JSON.stringify(poison));
  // The weave's seed: a poisoned value must not reach the generated tile, only a plain number is used.
  await page.evaluate(() => { sessionStorage.setItem('vynatix-bg', 'weave'); sessionStorage.setItem('vynatix-bg-seed', '"><img src=x onerror=window.__xss=6>'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const seeded = await page.evaluate(() => ({
    seed: sessionStorage.getItem('vynatix-bg-seed'),
    tile: document.documentElement.style.getPropertyValue('--weave-tile').slice(0, 24),
    xss: window.__xss || false,
    node: !!document.querySelector('img[src="x"]'),
  }));
  record('weave seed poisoning rejected',
    /^\d{1,10}$/.test(seeded.seed) && seeded.tile.startsWith('url("data:image/svg+xml') && !seeded.xss && !seeded.node,
    JSON.stringify(seeded));
  await page.evaluate(() => {
    localStorage.removeItem('vynatix-theme');
    ['vynatix-look', 'vynatix-bg', 'vynatix-bg-seed', 'vynatix-bg-iris-idle'].forEach((k) => sessionStorage.removeItem(k));
  });

  // 7. URL fragment/query payloads must never become DOM nodes.
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
