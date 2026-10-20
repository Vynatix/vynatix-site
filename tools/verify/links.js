// Verifies every internal link, script, style, image, and web-app-manifest icon
// resolves (no 404s).
//
// It does NOT check that the _config.yml exclusions hold — those are applied by
// Jekyll at publish time, and the local server serves every file raw. Verify
// them against the live origin instead; EDGE-SETUP.md section 4 has the loop.
const { PAGES, BASE, NOTICE_PAGES, readApp, pinBg, launch } = require('./_common');

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.addInitScript(pinBg);     // the hero background is drawn at random per visit; the links do not depend on it
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
      // <source srcset> inside <picture> — the modern-format siblings.
      document.querySelectorAll('source[srcset]').forEach((el) => {
        el.getAttribute('srcset').split(',').forEach((cand) => {
          const h = cand.trim().split(/\s+/)[0];
          if (h && !/^(data:|https?:)/.test(h)) out.add(h);
        });
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
  // Fragments. The loop above checks the page a link names; this checks that a #fragment names an element that
  // exists: every cross-page link on every page (the footer's privacy.html#cookies on all of them), same-page
  // anchors, and the notice links the consent module writes into the page from its COPY strings in app.js.
  const idsOf = new Map();
  const ids = async (file) => {
    if (!idsOf.has(file)) {
      const r = await page.request.get(BASE + file);
      idsOf.set(file, r.status() < 400 ? new Set([...(await r.text()).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])) : null);
    }
    return idsOf.get(file);
  };
  const fragmentsChecked = new Set();
  const checkFragment = async (from, href, always) => {
    const [file, frag] = href.split('#');
    const target = file || from;
    const key = `${target}#${frag}`;
    if (fragmentsChecked.has(key) && !always) return;
    fragmentsChecked.add(key);
    const have = await ids(target);
    if (!have) { bad++; console.log(`FAIL ${href} -> ${target} not found (linked from ${from})`); }
    else if (!have.has(decodeURIComponent(frag))) { bad++; console.log(`FAIL ${href} -> no element with id="${frag}" in ${target} (linked from ${from})`); }
  };
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'load' });
    const frags = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && h.includes('#') && !/^(mailto:|tel:|https?:)/.test(h) && h !== '#'));
    for (const h of [...new Set(frags)]) await checkFragment(p, h);
  }
  const app = readApp();
  const copyHrefs = [];
  for (const lang of Object.keys(app.copy || {})) for (const [k, v] of Object.entries(app.copy[lang])) if (/Href$/.test(k)) copyHrefs.push([`app.js COPY.${lang}.${k}`, v]);
  if (!copyHrefs.length) { bad++; console.log('FAIL app.js COPY has no notice link to check'); }
  for (const [where, href] of copyHrefs) {
    const file = href.split('#')[0];
    if (!PAGES.includes(file)) { bad++; console.log(`FAIL ${where} -> ${href}: ${file} is not a page in PAGES`); continue; }
    if (!href.includes('#')) continue;
    await checkFragment(where, href, true);
  }
  for (const [lang, file] of Object.entries(NOTICE_PAGES)) {
    const have = await ids(file);
    if (!have || !have.has('cookies')) { bad++; console.log(`FAIL ${file} (${lang} notice) has no element with id="cookies"`); }
  }
  console.log(`checked ${fragmentsChecked.size} unique fragment targets, ${copyHrefs.length} notice links in app.js COPY`);
  console.log(`checked ${seen.size} unique internal targets across ${PAGES.length} pages, ${bad} broken`);
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
