// Verifies every internal link, script, style, image, and web-app-manifest icon
// resolves (no 404s). Scope: all, every root page and every generated page
// (pagesIn('all') in _common.js).
//
// Every reference is resolved against the page it is on, the way the browser resolves it: on es/about.html,
// "services.html" is es/services.html and "../styles.css" is styles.css. A target is fetched once, by the
// address it resolves to.
//
// It does NOT check that the _config.yml exclusions hold — those are applied by
// Jekyll at publish time, and the local server serves every file raw. Verify
// them against the live origin instead; EDGE-SETUP.md section 4 has the loop.
const { BASE, NOTICE_PAGES, pagesIn, scopeLine, readApp, launch } = require('./_common');

const PAGES = pagesIn('all');
const ROOT_PAGES = pagesIn('root');
const ORIGIN = new URL(BASE).origin;
// The address a reference on a page resolves to, without its #fragment, and the same as a path from BASE for the
// messages; null for one that leaves the site.
const resolve = (ref, from) => {
  const u = new URL(ref, from);
  if (u.origin !== ORIGIN) return null;
  u.hash = '';
  return { url: u.href, rel: u.href.startsWith(BASE) ? u.href.slice(BASE.length) : u.pathname };
};

(async () => {
  console.log(scopeLine('all', PAGES));
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
      if (!h) continue;
      const target = resolve(h, BASE + p);
      if (!target || seen.has(target.url)) continue;
      const r = await page.request.get(target.url);
      seen.set(target.url, r.status());
      if (r.status() >= 400) { bad++; console.log(`FAIL ${h} -> ${target.rel} ${r.status()} (linked from ${p})`); continue; }

      // The manifest names icons of its own, resolved against the manifest; follow them too.
      if (/\.webmanifest$|manifest\.json$/.test(target.url.split('?')[0])) {
        let manifest = null;
        try { manifest = JSON.parse(await r.text()); }
        catch (e) { bad++; console.log(`FAIL ${target.rel} is not valid JSON (${e.message})`); continue; }
        const targets = [...(manifest.icons || []).map((i) => i.src), manifest.start_url].filter(Boolean);
        for (const t of targets) {
          const icon = resolve(t, target.url);
          if (!icon || seen.has(icon.url)) continue;
          const ir = await page.request.get(icon.url);
          seen.set(icon.url, ir.status());
          if (ir.status() >= 400) { bad++; console.log(`FAIL ${t} -> ${icon.rel} ${ir.status()} (from ${target.rel})`); }
        }
      }
    }
  }
  // Fragments. The loop above checks the page a link names; this checks that a #fragment names an element that
  // exists: every cross-page link on every page (the footer's privacy.html#cookies on all of them), same-page
  // anchors, and the notice links the consent module writes into the page from its COPY strings in app.js.
  const idsOf = new Map();
  const ids = async (url) => {
    if (!idsOf.has(url)) {
      const r = await page.request.get(url);
      idsOf.set(url, r.status() < 400 ? new Set([...(await r.text()).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])) : null);
    }
    return idsOf.get(url);
  };
  const fragmentsChecked = new Set();
  // `from` is the page the link is on (a path from BASE) or, for a COPY string, where it is written; `base` the page
  // it is resolved against.
  const checkFragment = async (from, href, base, always) => {
    const frag = href.slice(href.indexOf('#') + 1);
    const target = resolve(href, BASE + base);
    if (!target) return;
    const key = `${target.url}#${frag}`;
    if (fragmentsChecked.has(key) && !always) return;
    fragmentsChecked.add(key);
    const have = await ids(target.url);
    if (!have) { bad++; console.log(`FAIL ${href} -> ${target.rel} not found (linked from ${from})`); }
    else if (!have.has(decodeURIComponent(frag))) { bad++; console.log(`FAIL ${href} -> no element with id="${frag}" in ${target.rel} (linked from ${from})`); }
  };
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'load' });
    const frags = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && h.includes('#') && !/^(mailto:|tel:|https?:)/.test(h) && h !== '#'));
    for (const h of [...new Set(frags)]) await checkFragment(p, h, p);
  }
  // The notice links of COPY name a notice at the root: app.js puts "../" in front of them on a generated page.
  const app = readApp();
  const copyHrefs = [];
  for (const lang of Object.keys(app.copy || {})) for (const [k, v] of Object.entries(app.copy[lang])) if (/Href$/.test(k)) copyHrefs.push([`app.js COPY.${lang}.${k}`, v]);
  if (!copyHrefs.length) { bad++; console.log('FAIL app.js COPY has no notice link to check'); }
  for (const [where, href] of copyHrefs) {
    const file = href.split('#')[0];
    if (!ROOT_PAGES.includes(file)) { bad++; console.log(`FAIL ${where} -> ${href}: ${file} is not a root page of the registry`); continue; }
    if (!href.includes('#')) continue;
    await checkFragment(where, href, 'index.html', true);
  }
  for (const [lang, file] of Object.entries(NOTICE_PAGES)) {
    const have = await ids(BASE + file);
    if (!have || !have.has('cookies')) { bad++; console.log(`FAIL ${file} (${lang} notice) has no element with id="cookies"`); }
  }
  console.log(`checked ${fragmentsChecked.size} unique fragment targets, ${copyHrefs.length} notice links in app.js COPY`);
  console.log(`checked ${seen.size} unique internal targets across ${PAGES.length} pages, ${bad} broken`);
  await browser.close();
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
