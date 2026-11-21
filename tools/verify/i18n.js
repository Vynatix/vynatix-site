// The generated languages (es/, fr/, de/, ja/, ar/: LANGS in tools/seo-head.py). The other checks iterate PAGES, the
// pages written by hand at the root; this one is for the pages tools/seo-head.py builds from them and from the
// catalogues in tools/i18n/. Serve the repo root first, as for the others.
//   node verify/i18n.js            every check below
//   node verify/i18n.js --static   the checks that need no browser
//
// Static:
//  - the catalogues: every message of tools/i18n/messages.json has a usable translation in every language (the
//    same numbered placeholders and {tokens}, no other markup), so no sentence falls back to English;
//  - every generated page declares its language and direction, has its own canonical address, carries the same
//    Content-Security-Policy as the English pages, links no hero-bg.css, and every relative link, script, style
//    and image in it resolves to a file (and a #fragment to an id);
//  - the gate: a draft language is noindex, is in no sitemap, lock or llms.txt row, and no page outside its folder
//    links to it; a live language has reciprocal hreflang with its English page and a row in the sitemap and lock.
// Browser (the first theme under test for the sweep, every theme for axe):
//  - every generated page loads without a console error, a failed request or an off-origin request, at 360, 768
//    and 1280 pixels wide, and nothing runs past the edge of the window (the test for right-to-left and for long
//    words);
//  - the page's direction is the language's; the strings app.js writes come from the page (the background motion
//    button, the rate calculator's announcement);
//  - axe finds nothing on each language's home page, Career page and one long page.
const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, BASE, THEMES, readLangs, readRegistry, generatedPages, pinTheme, launch, pool } = require('./_common');

const SITE = 'https://vynatix.com/';
const results = [];
const add = (ok, name, detail) => { results.push({ ok, name }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const few = (list, n = 4) => list.slice(0, n).join(' | ') + (list.length > n ? ` ... (${list.length})` : '');

const langs = readLangs();
const generated = Object.entries(langs).filter(([, l]) => l.kind === 'generated');
const pages = generatedPages();
const registry = readRegistry();
const urlOf = (f) => (f === 'index.html' ? SITE : SITE + f.replace(/(^|\/)index\.html$/, '$1'));

// ---------------------------------------------------------------- catalogues
const PLACEHOLDER = /<\/?\d+\/?>/g;
const TOKEN = /\{[a-z]+\}/g;
const sorted = (m) => (m || []).slice().sort().join(' ');
function unusable(id, t) {
  if (typeof t !== 'string' || !t.trim()) return 'empty';
  if (sorted(id.match(PLACEHOLDER)) !== sorted(t.match(PLACEHOLDER))) return 'the numbered placeholders differ';
  const rest = t.replace(PLACEHOLDER, '');
  if (/[<>]/.test(rest)) return 'markup other than the numbered placeholders';
  if (/&(?![#\w]+;)/.test(rest)) return 'a bare & (write &amp;)';
  const want = id.match(TOKEN) || [];
  // The date pattern may swap {month} for {m}; every other token has to survive as written.
  if (id !== '{d} {month} {y}' && sorted(want) !== sorted(t.match(TOKEN))) return 'a {token} is missing or changed';
  if (/[—!]|\.\.\./.test(rest) && !/[—!]|\.\.\./.test(id)) return 'an em dash, an exclamation mark or an ellipsis (the content rules)';
  return null;
}
const messages = JSON.parse(read('tools/i18n/messages.json'));
add(sorted(messages.languages) === sorted(generated.map(([c]) => c)), 'tools/i18n/messages.json lists the generated languages of LANGS', `${messages.languages.join(', ')} against ${generated.map(([c]) => c).join(', ')}`);
for (const [code] of generated) {
  let cat = {};
  try { cat = JSON.parse(read(`tools/i18n/${code}.json`)); } catch (e) { /* reported as missing below */ }
  const missing = messages.messages.filter((m) => !(m.id in cat)).map((m) => m.id.slice(0, 50));
  const bad = messages.messages.filter((m) => m.id in cat && unusable(m.id, cat[m.id])).map((m) => `${unusable(m.id, cat[m.id])}: "${m.id.slice(0, 40)}"`);
  add(!missing.length && !bad.length, `${code}: all ${messages.messages.length} messages are translated and usable`,
    [missing.length ? `${missing.length} missing (python3 tools/i18n.py missing ${code}): ${few(missing, 3)}` : '', bad.length ? few(bad, 3) : ''].filter(Boolean).join('; '));
}

// ---------------------------------------------------------------- the pages, as files
const cspOf = (html) => (/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html) || [])[1];
const englishCsp = cspOf(read('index.html'));
const idsCache = new Map();
function idsOf(rel) {
  if (!idsCache.has(rel)) {
    let ids = null;
    try { ids = new Set([...read(rel).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])); } catch (e) { /* no such file */ }
    idsCache.set(rel, ids);
  }
  return idsCache.get(rel);
}
const perPage = { head: [], csp: [], links: [], hero: [], marks: [] };
for (const p of pages) {
  const [code, file] = p.split('/');
  const l = langs[code];
  const html = read(p);
  const tag = /<html\b[^>]*>/.exec(html)[0];
  if (!tag.includes(` lang="${l.tag}"`) || !tag.includes(` dir="${l.dir}"`)) perPage.head.push(`${p}: <html> is not lang="${l.tag}" dir="${l.dir}"`);
  const canonical = (/<link rel="canonical" href="([^"]*)"/.exec(html) || [])[1];
  if (canonical !== urlOf(p)) perPage.head.push(`${p}: canonical is ${canonical}, expected ${urlOf(p)}`);
  const robots = (/<meta name="robots" content="([^"]*)"/.exec(html) || [])[1] || '';
  const source = registry[file];
  const shouldIndex = l.status === 'live' && source && source.status === 'live';
  if (shouldIndex === /noindex/.test(robots)) perPage.head.push(`${p}: robots is "${robots}" for a ${l.status} language`);
  if (l.status === 'draft' && /rel="alternate" hreflang=/.test(html)) perPage.head.push(`${p}: a draft page carries hreflang`);
  if (cspOf(html) !== englishCsp) perPage.csp.push(p);
  if (/hero-bg\.css/.test(html)) perPage.hero.push(p);
  // A sentence that fell back to English is marked lang="en" dir="ltr"; the brand line (translate="no") is the one expected.
  const fallbacks = (html.match(/ lang="en" dir="ltr"/g) || []).length - (html.match(/translate="no"/g) || []).length;
  if (fallbacks > 0) perPage.marks.push(`${p} (${fallbacks})`);
  const refs = new Set();
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) refs.add(m[1].replace(/&amp;/g, '&'));
  for (const ref of refs) {
    if (!ref || /^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    const [target, frag] = ref.split('#');
    const rel = target ? path.posix.normalize(path.posix.join(code, target.split('?')[0])) : p;
    if (rel.startsWith('..')) { perPage.links.push(`${p}: ${ref} leaves the site`); continue; }
    if (!fs.existsSync(path.join(ROOT, rel))) { perPage.links.push(`${p}: ${ref} -> ${rel} does not exist`); continue; }
    if (frag && /\.html$/.test(rel)) {
      const ids = idsOf(rel);
      if (ids && !ids.has(decodeURIComponent(frag))) perPage.links.push(`${p}: ${ref} -> no id="${frag}" in ${rel}`);
    }
  }
}
add(pages.length > 0 && pages.length % generated.length === 0, `${pages.length} generated pages on disk, the same number in each of the ${generated.length} languages`);
add(!perPage.head.length, 'every generated page declares its language and direction, its own canonical address and the right robots value', few(perPage.head));
add(!perPage.csp.length, 'every generated page carries the Content-Security-Policy of the English pages', few(perPage.csp));
add(!perPage.hero.length, 'no generated page links hero-bg.css (the hero background is the English home page\'s alone)', few(perPage.hero));
add(!perPage.links.length, 'every relative link, script, style and image of a generated page resolves, fragments included', few(perPage.links));
add(!perPage.marks.length, 'no sentence of a generated page fell back to English', few(perPage.marks));

// ---------------------------------------------------------------- the gate
const sitemap = read('sitemap.xml');
const lock = read('tools/urls.lock');
const llms = read('llms.txt');
const gate = [];
for (const [code, l] of generated) {
  const prefix = SITE + code + '/';
  const own = pages.filter((p) => p.startsWith(code + '/'));
  if (l.status === 'draft') {
    for (const [name, text] of [['sitemap.xml', sitemap], ['tools/urls.lock', lock], ['llms.txt', llms]]) {
      if (text.includes(prefix)) gate.push(`${name} names the draft language ${code}`);
    }
    for (const p of PAGES) {
      if (new RegExp(`(?:href|src)="${code}/`).test(read(p)) || read(p).includes(prefix)) gate.push(`${p} links to the draft language ${code}`);
    }
  } else {
    for (const p of own) {
      const file = p.split('/')[1];
      if (!registry[file] || registry[file].status !== 'live') continue;
      if (!sitemap.includes(`<loc>${urlOf(p)}</loc>`)) gate.push(`sitemap.xml has no row for ${p}`);
      if (!lock.split('\n').some((row) => row.split(' ')[0] === urlOf(p))) gate.push(`tools/urls.lock has no row for ${p}`);
      if (!llms.includes(`(${urlOf(p)})`)) gate.push(`llms.txt does not link ${p}`);
      const english = read(file);
      if (!english.includes(`<link rel="alternate" hreflang="${l.tag}" href="${urlOf(p)}">`)) gate.push(`${file} has no hreflang to ${p}`);
      if (!read(p).includes(`<link rel="alternate" hreflang="en" href="${urlOf(file)}">`)) gate.push(`${p} has no hreflang back to ${file}`);
    }
  }
}
add(!gate.length, 'a draft language is linked from nowhere and listed nowhere; a live one is in the sitemap, the lock, llms.txt and hreflang both ways', few(gate));

// ---------------------------------------------------------------- in the browser
const WIDTHS = [360, 768, 1280];
const AXE_PAGES = ['index.html', 'membership.html', 'ai-engineering.html'];

async function sweep(browser) {
  const theme = THEMES[0];
  const problems = [];
  const jobs = [];
  for (const p of pages) for (const w of WIDTHS) jobs.push([p, w]);
  await pool(jobs, 4, async ([p, w]) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addInitScript(pinTheme, theme);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('request', (r) => { if (!r.url().startsWith(BASE) && !/^(data|blob|about):/.test(r.url())) errors.push(`off-origin request ${r.url()}`); });
    await page.goto(BASE + p, { waitUntil: 'load' });
    const state = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - window.innerWidth,
      dir: getComputedStyle(document.documentElement).direction,
      wide: [...document.querySelectorAll('main *, .site-footer *, .site-header *')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('.sr-only, .svg-defs, [hidden], .site-header__nav');
      }).slice(0, 2).map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')),
    }));
    const code = p.split('/')[0];
    if (state.over > 1) problems.push(`${p} at ${w}px: the page is ${state.over}px wider than the window (${state.wide.join(', ') || 'no element found'})`);
    if (state.dir !== langs[code].dir) problems.push(`${p}: direction is ${state.dir}, the language is ${langs[code].dir}`);
    for (const e of errors) problems.push(`${p} at ${w}px: ${e}`);
    await ctx.close();
  });
  add(!problems.length, `every generated page loads clean and fits the window at ${WIDTHS.join(', ')}px (${jobs.length} loads, ${theme})`, few(problems, 6));
}

async function strings(browser) {
  const problems = [];
  for (const [code] of generated) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + code + '/index.html', { waitUntil: 'load' });
    const motion = await page.evaluate(() => {
      const b = document.querySelector('.motion-toggle');
      if (!b) return null;
      const before = b.textContent; b.click(); const after = b.textContent; b.click();
      return { before, after, play: b.getAttribute('data-i18n-play'), again: b.textContent };
    });
    // The two names of the button are the text the page is written with and its data-i18n-play (the checks run
    // with the motion paused, so the button starts on the second).
    const written = (/<button class="motion-toggle"[^>]*>([^<]*)<\/button>/.exec(read(code + '/index.html')) || [])[1];
    if (!motion) problems.push(`${code}/index.html has no background motion button`);
    else if (sorted([motion.before, motion.after]) !== sorted([written, motion.play]) || motion.again !== motion.before || motion.before === motion.after) problems.push(`${code}: the motion button reads "${motion.before}" then "${motion.after}" (the page has "${written}" and "${motion.play}")`);
    await page.goto(BASE + code + '/membership.html', { waitUntil: 'load' });
    const calc = await page.evaluate(async () => {
      const root = document.querySelector('[data-calc]');
      const rate = document.querySelector('[data-calc-in="rate"]'); const hours = document.querySelector('[data-calc-in="hours"]');
      if (!root || !rate || !hours) return null;
      rate.value = '1000'; hours.value = '160'; rate.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1500));
      return { status: document.querySelector('[data-calc-out="status"]').textContent, pattern: root.getAttribute('data-i18n-status'), salary: document.querySelector('[data-calc-out="salary"]').textContent };
    });
    if (!calc) problems.push(`${code}/membership.html has no rate calculator`);
    else {
      const lead = calc.pattern.split('{salary}')[0];
      if (!lead.trim() || !calc.status.startsWith(lead) || !calc.status.includes(calc.salary)) problems.push(`${code}: the calculator announces "${calc.status}" (pattern "${calc.pattern}", salary ${calc.salary})`);
    }
    await ctx.close();
  }
  add(!problems.length, 'the sentences app.js writes come from the page, in its language (the motion button, the calculator\'s announcement)', few(problems));
}

async function axe(browser) {
  const src = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  const problems = [];
  const jobs = [];
  for (const [code] of generated) for (const f of AXE_PAGES) for (const theme of THEMES) jobs.push([code + '/' + f, theme]);
  await pool(jobs, 4, async ([p, theme]) => {
    if (!pages.includes(p)) { problems.push(`${p} is not generated`); return; }
    // bypassCSP for the scan only, as in a11y.js: script-src 'self' refuses the injected axe source.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });
    await ctx.addInitScript(pinTheme, theme);
    const page = await ctx.newPage();
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.addScriptTag({ content: src });
    const res = await page.evaluate(async () => await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    }));
    for (const v of res.violations) problems.push(`${p} (${theme}): ${v.id} on ${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}, first ${v.nodes[0].target.join(' ')}`);
    await ctx.close();
  });
  add(!problems.length, `axe finds nothing on ${AXE_PAGES.join(', ')} of each language (${jobs.length} scans)`, few(problems, 6));
}

(async () => {
  if (!process.argv.includes('--static')) {
    const browser = await launch();
    await sweep(browser);
    await strings(browser);
    await axe(browser);
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\nFAIL: ${failed} of ${results.length} checks on the generated languages` : `\nPASS: the generated languages (${generated.map(([c, l]) => `${c} ${l.status}`).join(', ')})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
