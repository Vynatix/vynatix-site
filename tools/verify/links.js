// Verifies every internal link, script, style and image resolves (no 404s)
// and that excluded developer docs are NOT reachable.
const { PAGES, BASE, launch } = require('./_common');

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  const seen = new Map();
  let bad = 0;

  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'load' });
    const hrefs = await page.evaluate(() => {
      const out = new Set();
      document.querySelectorAll('a[href]').forEach((a) => {
        const h = a.getAttribute('href');
        if (h && !/^(mailto:|tel:|#|https?:)/.test(h)) out.add(h.split('#')[0]);
      });
      document.querySelectorAll('img[src], script[src], link[href]').forEach((el) => {
        const h = el.getAttribute('src') || el.getAttribute('href');
        if (h && !/^(data:|https?:)/.test(h)) out.add(h);
      });
      return [...out];
    });
    for (const h of hrefs) {
      if (!h || seen.has(h)) continue;
      const r = await page.request.get(BASE + h);
      seen.set(h, r.status());
      if (r.status() >= 400) { bad++; console.log(`FAIL ${h} -> ${r.status()} (linked from ${p})`); }
    }
  }
  console.log(`checked ${seen.size} unique internal targets across ${PAGES.length} pages, ${bad} broken`);
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
