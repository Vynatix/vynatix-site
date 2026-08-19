// Verifies every internal link, script, style, image, and web-app-manifest icon
// resolves (no 404s).
//
// It does NOT check that the _config.yml exclusions hold — those are applied by
// Jekyll at publish time, and the local server serves every file raw. Verify
// them against the live origin instead; EDGE-SETUP.md section 4 has the loop.
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
      if (r.status() >= 400) { bad++; console.log(`FAIL ${h} -> ${r.status()} (linked from ${p})`); continue; }

      // The manifest names icons of its own; follow them too.
      if (/\.webmanifest$|manifest\.json$/.test(h)) {
        let manifest = null;
        try { manifest = JSON.parse(await r.text()); }
        catch (e) { bad++; console.log(`FAIL ${h} is not valid JSON (${e.message})`); continue; }
        const targets = [...(manifest.icons || []).map((i) => i.src), manifest.start_url].filter(Boolean);
        for (const t of targets) {
          const rel = t.replace(/^\//, '');
          if (seen.has(rel)) continue;
          const ir = await page.request.get(BASE + rel);
          seen.set(rel, ir.status());
          if (ir.status() >= 400) { bad++; console.log(`FAIL ${t} -> ${ir.status()} (from ${h})`); }
        }
      }
    }
  }
  console.log(`checked ${seen.size} unique internal targets across ${PAGES.length} pages, ${bad} broken`);
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
