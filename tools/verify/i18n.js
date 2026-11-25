// The generated languages (es/, fr/, de/, ja/, ar/: LANGS in tools/seo-head.py): what only they have, the catalogues
// in tools/i18n/, the pages tools/seo-head.py builds from the root pages and from them, the language gate and the
// faces of their scripts. The checks of every page (links, requests, theme, csp, mailto and publish among them)
// take the generated pages as well. Scope: generated, every generated page (pagesIn('generated') in _common.js),
// a sample of them for axe, and the root pages where the gate looks for a link to a draft language. Serve the repo
// root first, as for the others.
//   node verify/i18n.js            every check below
//   node verify/i18n.js --static   the checks that need no browser
//
// Static:
//  - the catalogues: every message of tools/i18n/messages.json has a usable translation in every language (the
//    same numbered placeholders and {tokens}, no other markup), so no sentence falls back to English; an
//    optional message (the brand line, held in English by translate="no") is checked only where a catalogue
//    carries it, which is what sets it in that language (Japanese and Arabic);
//  - every generated page declares its language and direction, has its own canonical address, carries the same
//    Content-Security-Policy as the English pages, links no hero-bg.css, and every relative link, script, style
//    and image in it resolves to a file (and a #fragment to an id);
//  - the gate: a draft language is noindex, is in no sitemap, lock or llms.txt row, and no page outside its folder
//    links to it; a live language has reciprocal hreflang with its English page and a row in the sitemap and lock.
// Browser (the first theme under test for the sweep, every theme for axe):
//  - every generated page loads without a console error, a failed request or an off-origin request, at 360, 768
//    and 1280 pixels wide, and nothing runs past the edge of the window (the test for right-to-left and for long
//    words); the home hero's headline stays on its two lines;
//  - the page's direction is the language's; the strings app.js writes come from the page (the background motion
//    button, the rate calculator's announcement);
//  - axe finds nothing on a sample of each language: the copies of the English pages of the root sample
//    (samplePages('root') in _common.js, the first page of each kind of row), so each kind of page is scanned in
//    every language (a11y.js scans each generated home page with the consent bar up and after a decline);
//  - on the pages of a script Geist does not draw (Japanese, Arabic), the browser is asked which font drew each
//    run of text (the DevTools protocol's platform fonts): the script's text face where Geist stands, its accent
//    face where Fraunces italic stands, and never a device font, which is what a character missing from the
//    subsets in fonts/ falls back to. `python3 tools/lang-fonts.py` cuts them again.
const fs = require('fs');
const path = require('path');
const { ROOT, BASE, THEMES, readLangs, readRegistry, pagesIn, samplePages, scopeLine, pinTheme, launch, pool } = require('./_common');

const SITE = 'https://vynatix.com/';
const results = [];
const add = (ok, name, detail) => { results.push({ ok, name }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const few = (list, n = 4) => list.slice(0, n).join(' | ') + (list.length > n ? ` ... (${list.length})` : '');

const langs = readLangs();
const generated = Object.entries(langs).filter(([, l]) => l.kind === 'generated');
const pages = pagesIn('generated');
const registry = readRegistry();
// The axe sample: in each generated language, its copies of the English pages of the root sample.
const AXE_PAGES = samplePages('root').filter((f) => registry[f].lang === 'en');
const axeJobs = [];
for (const [code] of generated) for (const f of AXE_PAGES) if (pages.includes(code + '/' + f)) axeJobs.push(code + '/' + f);
console.log(scopeLine('generated', pages, { note: `axe on a sample of ${axeJobs.length}, the copies of ${AXE_PAGES.filter((f) => axeJobs.some((j) => j.endsWith('/' + f))).join(', ')}; the root pages where the gate looks for a link to a draft language` }));
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
  // An optional message (what translate="no" holds: the brand line) is owed by no language; a catalogue that
  // carries one releases the element for its language, so what it carries has to be usable like any other.
  for (const id of messages.optional || []) if (id in cat && unusable(id, cat[id])) bad.push(`${unusable(id, cat[id])}: "${id.slice(0, 40)}"`);
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
    for (const p of pagesIn('root')) {
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
      // The home hero's headline is two lines by its markup (a <br>): a third means a line of it wrapped.
      h1Lines: (() => {
        const h1 = document.querySelector('.hero__h1');
        if (!h1) return 0;
        const range = document.createRange(); range.selectNodeContents(h1);
        return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
      })(),
      wide: [...document.querySelectorAll('main *, .site-footer *, .site-header *')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('.sr-only, .svg-defs, [hidden], .site-header__nav');
      }).slice(0, 2).map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')),
    }));
    const code = p.split('/')[0];
    if (state.over > 1) problems.push(`${p} at ${w}px: the page is ${state.over}px wider than the window (${state.wide.join(', ') || 'no element found'})`);
    if (state.dir !== langs[code].dir) problems.push(`${p}: direction is ${state.dir}, the language is ${langs[code].dir}`);
    if (state.h1Lines > 2) problems.push(`${p} at ${w}px: the hero headline takes ${state.h1Lines} lines, not two (a line of it wrapped: styles.css, "Languages", sizes the Japanese one from its first line)`);
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
  for (const p of axeJobs) for (const theme of THEMES) jobs.push([p, theme]);
  await pool(jobs, 4, async ([p, theme]) => {
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
  add(axeJobs.length > 0 && !problems.length, `axe finds nothing on the sample of each language, ${axeJobs.length} pages (${jobs.length} scans)`, few(problems, 6));
}

// The faces of the scripts Geist does not draw: tokens.css declares them (the end of its @font-face block),
// styles.css lists them after the Latin faces ("Languages"), tools/lang-fonts.py cuts the files. `own` is what the
// script's faces are asked to draw, the unicode-range of their @font-face rules.
const SCRIPT_FACES = {
  ja: { text: ['Geist', 'M PLUS 2'], accent: ['Fraunces', 'Shippori Mincho'], own: [[0x2E80, 0x2FDF], [0x3000, 0x30FF], [0x31F0, 0x31FF], [0x3400, 0x4DBF], [0x4E00, 0x9FFF], [0xF900, 0xFAFF], [0xFF00, 0xFFEF]] },
  ar: { text: ['Geist', 'Noto Sans Arabic'], accent: ['Fraunces', 'Amiri'], own: [[0x0600, 0x06FF], [0x0750, 0x077F], [0xFB50, 0xFDFF], [0xFE70, 0xFEFF]] },
};

async function faces(browser) {
  const problems = [];
  let runs = 0;
  const jobs = pages.filter((p) => SCRIPT_FACES[p.split('/')[0]]);
  await pool(jobs, 4, async (p) => {
    const want = SCRIPT_FACES[p.split('/')[0]];
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(pinTheme, THEMES[0]);
    const page = await ctx.newPage();
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // Every element that sets characters of the script in the page's own language (an English island and the
    // other languages' names in the footer list are not this script's faces' business), and the role its
    // family list gives it: the accent wherever the list opens with Fraunces.
    const probes = await page.evaluate((own) => {
      const mine = (c) => own.some(([a, b]) => c >= a && c <= b);
      const out = [];
      const seen = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || seen.has(el) || el.closest('script, style, noscript, .svg-defs')) continue;
        seen.add(el);
        const said = el.closest('[lang]');
        if (!said || said.lang !== document.documentElement.lang) continue;
        const text = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join('');
        const chars = [...text].filter((c) => mine(c.codePointAt(0)));
        if (!chars.length) continue;
        el.setAttribute('data-face-probe', String(out.length));
        // The protocol reports the fonts of everything inside the element, so a headline answers for its accent
        // too (the <em> is asked again on its own, where only the accent face will do).
        const role = (e) => (/^["']?Fraunces/.test(getComputedStyle(e).fontFamily) ? 'accent' : 'text');
        out.push({
          role: role(el),
          roles: [...new Set([el, ...el.querySelectorAll('*')].map(role))],
          where: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''),
          sample: chars.slice(0, 10).join(''),
        });
      }
      return out;
    }, want.own);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-face-probe]' });
    for (const nodeId of nodeIds) {
      const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
      const probe = probes[Number(attributes[attributes.indexOf('data-face-probe') + 1])];
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      if (!fonts.length) continue;                        // not rendered (a hidden panel)
      runs += 1;
      // A variable file reports the name of its default instance ("M PLUS 2 Thin"): compare the opening.
      const allowed = probe.roles.flatMap((r) => want[r]);
      const stray = fonts.filter((f) => !f.isCustomFont || !allowed.some((name) => f.familyName.startsWith(name)));
      if (stray.length) problems.push(`${p}: "${probe.sample}" in ${probe.where} is drawn in ${stray.map((f) => f.familyName + (f.isCustomFont ? '' : ' (a device font)')).join(', ')}, not ${want[probe.role][1]} (the ${probe.role} face)`);
    }
    await ctx.close();
  });
  add(!problems.length && runs > 0, `Japanese and Arabic are drawn by their own faces and no device font (${runs} runs of text on ${jobs.length} pages; python3 tools/lang-fonts.py cuts the fonts again)`, few(problems, 6));
}

(async () => {
  if (!process.argv.includes('--static')) {
    const browser = await launch();
    await sweep(browser);
    await strings(browser);
    await axe(browser);
    await faces(browser);
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\nFAIL: ${failed} of ${results.length} checks on the generated languages` : `\nPASS: the generated languages (${generated.map(([c, l]) => `${c} ${l.status}`).join(', ')})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
