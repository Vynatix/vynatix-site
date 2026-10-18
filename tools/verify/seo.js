// Search, sharing and copy checks for every page in PAGES, run in Chromium against the local server.
// - one canonical per page, in the form the sitemap uses; og:url, og:title and og:description
//   match the canonical, <title> and meta description; html lang is en or sv and og:locale agrees
// - every JSON-LD block parses, carries the Organization node, and names this page with a
//   dateModified that matches the sitemap's lastmod
// - a page with a visible FAQ ([data-faq-item]) carries the same questions and answers as
//   FAQPage structured data, in the same order
// - hreflang alternates are reciprocal and point at pages that exist
// - sitemap.xml lists exactly the pages; robots.txt names the sitemap; llms.txt links only
//   pages in the sitemap
// - copy rules on visible text: no em dash, no en dash used as punctuation, no exclamation
//   mark, no ellipsis
const fs = require('fs');
const path = require('path');
const { PAGES, BASE, launch } = require('./_common');

const ROOT = path.join(__dirname, '..', '..');
const SITE = 'https://vynatix.com/';
const canonicalOf = (p) => (p === 'index.html' ? SITE : SITE + p);
let bad = 0;
const fail = (msg) => { bad++; console.log('FAIL ' + msg); };
const ok = (msg) => console.log('ok   ' + msg);
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

(async () => {
  // Files at the root
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>/g)]
    .map((m) => ({ loc: m[1], lastmod: m[2] }));
  const lastmod = Object.fromEntries(locs.map((l) => [l.loc, l.lastmod]));
  const expected = PAGES.map(canonicalOf);
  const missing = expected.filter((u) => !lastmod[u]);
  const extra = locs.map((l) => l.loc).filter((u) => !expected.includes(u));
  if (missing.length || extra.length) fail(`sitemap.xml: missing ${missing.join(', ') || 'none'}; not a page ${extra.join(', ') || 'none'}`);
  else ok(`sitemap.xml lists exactly the ${PAGES.length} pages`);

  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  if (!/^Sitemap: https:\/\/vynatix\.com\/sitemap\.xml$/m.test(robots)) fail('robots.txt does not name the sitemap');
  else if (/^Disallow:\s*\/\s*$/m.test(robots)) fail('robots.txt disallows the whole site for some agent');
  else ok('robots.txt names the sitemap and disallows nothing');

  const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
  const llmsLinks = [...llms.matchAll(/\((https:\/\/vynatix\.com\/[^)]*)\)/g)].map((m) => m[1]);
  const llmsBad = llmsLinks.filter((u) => !lastmod[u]);
  if (llmsBad.length) fail(`llms.txt links pages not in the sitemap: ${llmsBad.join(', ')}`);
  else ok(`llms.txt links ${llmsLinks.length} pages, all in the sitemap`);

  // Pages
  const browser = await launch();
  const page = await browser.newPage();
  const alternates = {};
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    const d = await page.evaluate(() => {
      const attr = (sel, a) => [...document.querySelectorAll(sel)].map((e) => e.getAttribute(a));
      const visible = (() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script, style, svg, code, pre').forEach((e) => e.remove());
        return clone.textContent;
      })();
      const faq = [...document.querySelectorAll('[data-faq-item]')].map((item) => ({
        q: (item.querySelector('h3') || {}).textContent || '',
        a: [...item.querySelectorAll('p')].map((x) => x.textContent).join(' '),
      }));
      return {
        lang: document.documentElement.getAttribute('lang'),
        title: document.title,
        desc: (document.querySelector('meta[name="description"]') || {}).content,
        canonical: attr('link[rel="canonical"]', 'href'),
        ogUrl: (document.querySelector('meta[property="og:url"]') || {}).content,
        ogTitle: (document.querySelector('meta[property="og:title"]') || {}).content,
        ogDesc: (document.querySelector('meta[property="og:description"]') || {}).content,
        ogLocale: (document.querySelector('meta[property="og:locale"]') || {}).content,
        twitter: !!document.querySelector('meta[name="twitter:card"]'),
        hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((e) => [e.hreflang, e.href]),
        ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((e) => e.textContent),
        h1: document.querySelectorAll('h1').length,
        faq, visible,
      };
    });
    const issues = [];
    const canon = canonicalOf(p);
    if (d.canonical.length !== 1 || d.canonical[0] !== canon) issues.push(`canonical ${JSON.stringify(d.canonical)} (want ${canon})`);
    if (d.ogUrl !== canon) issues.push(`og:url ${d.ogUrl}`);
    if (norm(d.ogTitle) !== norm(d.title)) issues.push('og:title differs from <title>');
    if (norm(d.ogDesc) !== norm(d.desc)) issues.push('og:description differs from the meta description');
    if (!d.twitter) issues.push('no twitter:card');
    if (!['en', 'sv'].includes(d.lang)) issues.push(`html lang "${d.lang}"`);
    if (d.ogLocale !== { en: 'en_GB', sv: 'sv_SE' }[d.lang]) issues.push(`og:locale ${d.ogLocale} for lang ${d.lang}`);
    if (d.h1 !== 1) issues.push(`${d.h1} h1 elements`);
    // Structured data
    let nodes = [];
    for (const raw of d.ld) {
      try { const j = JSON.parse(raw); nodes = nodes.concat(j['@graph'] || [j]); }
      catch (e) { issues.push('JSON-LD does not parse: ' + e.message); }
    }
    const types = (n) => [].concat(n['@type'] || []);
    if (!nodes.some((n) => n['@id'] === SITE + '#organization' && types(n).includes('Organization'))) issues.push('no Organization node');
    const self = nodes.find((n) => n['@id'] === canon);
    if (!self) issues.push('no structured-data node for this page');
    else if (self.dateModified !== lastmod[canon]) issues.push(`dateModified ${self.dateModified} but sitemap lastmod ${lastmod[canon]}`);
    if (d.faq.length) {
      const ldFaq = self && types(self).includes('FAQPage') ? self.mainEntity || [] : [];
      const same = ldFaq.length === d.faq.length && d.faq.every((f, i) =>
        norm(f.q) === norm(ldFaq[i].name) && norm(f.a) === norm(ldFaq[i].acceptedAnswer && ldFaq[i].acceptedAnswer.text));
      if (!same) issues.push(`visible FAQ (${d.faq.length}) and FAQPage data (${ldFaq.length}) differ`);
    }
    // Copy rules
    const copy = [];
    if (/—/.test(d.visible)) copy.push('em dash');
    if (/\s–\s/.test(d.visible)) copy.push('en dash as punctuation');
    if (/!/.test(d.visible)) copy.push('exclamation mark');
    if (/…|\.\.\./.test(d.visible)) copy.push('ellipsis');
    if (copy.length) issues.push('copy: ' + copy.join(', '));
    alternates[p] = d.hreflang;
    if (issues.length) fail(`${p}: ${issues.join('; ')}`);
    else ok(`${p} (${d.lang}${d.faq.length ? `, ${d.faq.length} FAQ` : ''}${d.hreflang.length ? ', hreflang' : ''})`);
  }
  await browser.close();

  // hreflang reciprocity
  const fileOf = (u) => (u === SITE ? 'index.html' : u.replace(SITE, ''));
  for (const [p, alts] of Object.entries(alternates)) {
    if (!alts.length) continue;
    const langs = alts.map((a) => a[0]);
    if (!langs.includes('x-default')) fail(`${p}: hreflang without x-default`);
    for (const [lang, href] of alts) {
      const target = fileOf(href);
      if (!PAGES.includes(target)) { fail(`${p}: hreflang ${lang} points at ${href}, not a page`); continue; }
      if (lang !== 'x-default' && !(alternates[target] || []).some((a) => fileOf(a[1]) === p)) fail(`${p}: ${target} does not link back`);
    }
  }
  console.log(bad ? `\nFAIL — ${bad} problem(s)` : '\nPASS — search, sharing and copy checks');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
