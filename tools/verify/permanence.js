// Permanence and editorial-safety checks. Static, no browser, no server: reads the tree as GitHub Pages
// will publish it. GitHub Pages cannot redirect and a push to main is live, so a page that has been public
// has to keep answering for good, and a page that must come down has to actually stop serving its text.
//   node verify/permanence.js
//   node verify/permanence.js --self-test     proves the checks fail for the right reasons (in `npm run check`)
//
//  A  the PAGES registry of tools/seo-head.py can be read, and it and PAGES in _common.js name the same files,
//     each of which exists
//  W  every withdrawn page (registry status 'withdrawn', see tools/TAKEDOWN.md) is exactly the stub: its title,
//     description, og/twitter copies and <main> are the stub's own strings for its language and the date in
//     `mod`, it carries noindex and no Article or FAQPage data; and it is in no sitemap.xml, llms.txt or feed,
//     named by no robots.txt Disallow, and linked by no other page (any href, src or link element that resolves
//     to it, however it is written), so nothing of the old text is served and nothing points at the stub
//  L  tools/urls.lock lists every URL ever registered, one row per URL as "<url> <YYYY-MM-DD>": each locked URL
//     still has a file (the live page or the stub), every registered URL is locked, no pub date moved
//  C  no [[CONFIRM: ...]] marker on any page that is not one of the two notices, nor in llms.txt, robots.txt,
//     sitemap.xml, the manifest or a feed (release-gate.js reads only the notices, and only at the analytics
//     flip, so a marker in a post would ship)
//  D  for registry kind 'post': the Published (and Last updated) <time> of the byline equals pub and mod in
//     the registry, both the datetime and the text shown
//  H  the hub: every live kind 'post' page is listed on blog.html, in the ItemList of tools/seo/blog.json and on
//     the home page of its language; the ItemList and the visible list on blog.html name the same pages, with
//     numberOfItems and positions that add up
// Exports run() for the self-test. See AGENTS.md, "Posts, permanence and withdrawal".
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, PAGES, NOTICE_PAGES, readRegistry, parseTags, htmlToText, stripComments, decodeEntities } = require('./_common');

const SITE = 'https://vynatix.com/';
const urlOf = (f) => (f === 'index.html' ? SITE : SITE + f);
const fileOf = (u) => (u === SITE ? 'index.html' : u.startsWith(SITE) ? u.slice(SITE.length) : null);
const FEEDS = ['feed.xml', 'atom.xml', 'rss.xml'];
const PUBLISHED_TEXT = ['llms.txt', 'robots.txt', 'sitemap.xml', 'site.webmanifest', ...FEEDS];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The stub (tools/seo-head.py, STUB and stub_main). The strings are repeated here on purpose, so that the check
// does not trust the generator; a test below proves they still equal the generator's.
const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  sv: ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'],
};
const day = (iso, lang) => `${+iso.slice(8, 10)} ${MONTHS[lang][+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const STUB = {
  en: { title: 'Page withdrawn, Vynatix', desc: 'Vynatix has withdrawn this page.', eyebrow: 'Withdrawn', h1: 'This page has been withdrawn',
        lede: (iso) => `Vynatix removed this page on ${day(iso, 'en')}. Go to the home page.`, home: 'index.html' },
  sv: { title: 'Sidan är återkallad, Vynatix', desc: 'Vynatix har tagit bort den här sidan.', eyebrow: 'Återkallad', h1: 'Den här sidan är återkallad',
        lede: (iso) => `Vynatix tog bort sidan den ${day(iso, 'sv')}. Gå till startsidan.`, home: 'sv.html' },
};

function run(root = ROOT, pages = PAGES) {
  const out = [];
  const add = (ok, name, detail) => out.push({ ok, name, detail: ok ? '' : detail });
  const tryRead = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { return null; } };

  // A. one registry, and it can be read
  let reg;
  try { reg = readRegistry(root); } catch (e) {
    add(false, 'the PAGES registry in tools/seo-head.py can be read', e.message);
    return out;
  }
  const files = Object.keys(reg);
  const onlyPy = files.filter((f) => !pages.includes(f));
  const onlyJs = pages.filter((f) => !reg[f]);
  const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
  add(!onlyPy.length && !onlyJs.length && !missing.length,
    `PAGES in tools/seo-head.py and in _common.js name the same ${files.length} files, and each exists`,
    [onlyPy.length ? `only in seo-head.py: ${onlyPy.join(', ')}` : '', onlyJs.length ? `only in _common.js: ${onlyJs.join(', ')}` : '',
      missing.length ? `no file: ${missing.join(', ')}` : ''].filter(Boolean).join('; '));

  // W. withdrawn pages
  const withdrawn = files.filter((f) => reg[f].status === 'withdrawn');
  const sitemap = tryRead('sitemap.xml') || '';
  const llms = tryRead('llms.txt') || '';
  const robots = tryRead('robots.txt') || '';
  const feeds = FEEDS.map((f) => tryRead(f)).filter((t) => t !== null).join('\n');
  const htmlFiles = fs.readdirSync(root).filter((f) => /\.html$/.test(f));
  const pyText = tryRead(path.join('tools', 'seo-head.py')) || '';
  for (const lang of Object.keys(STUB)) {
    const t = STUB[lang];
    const gone = [t.title, t.desc, t.eyebrow, t.h1].filter((x) => !pyText.includes(x));
    add(!gone.length, `the ${lang} stub strings in permanence.js are the ones tools/seo-head.py writes`, `not in seo-head.py: ${gone.join(' | ')}`);
  }
  const host = /^(www\.)?vynatix\.com$/i;
  for (const w of withdrawn) {
    const problems = [];
    const u = urlOf(w);
    const page = tryRead(w) || '';
    const lang = reg[w].lang;
    const stub = STUB[lang];
    if (!stub) problems.push(`no stub for language ${lang}`);
    else {
      const title = decodeEntities((/<title>([\s\S]*?)<\/title>/i.exec(page) || [])[1] || '').trim();
      const meta = (name, attr = 'name') => parseTags(page, 'meta').filter((t) => (t.attrs[attr] || '').toLowerCase() === name).map((t) => t.attrs.content);
      if (title !== stub.title) problems.push(`title is "${title}" (the stub's is "${stub.title}")`);
      if (meta('description').join('|') !== stub.desc) problems.push(`meta description is not the stub's ("${stub.desc}")`);
      if (meta('og:title', 'property').join('|') !== stub.title || meta('twitter:title').join('|') !== stub.title) problems.push('og:title or twitter:title is not the stub title');
      if (meta('og:description', 'property').join('|') !== stub.desc || meta('twitter:description').join('|') !== stub.desc) problems.push('og:description or twitter:description is not the stub description');
      const main = (/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(stripComments(page)) || [])[1];
      if (main === undefined) problems.push('no <main>');
      else {
        const text = htmlToText(main).replace(/\s+/g, ' ').trim();
        const want = `${stub.eyebrow} ${stub.h1} ${stub.lede(reg[w].mod)}`;
        if (text !== want) problems.push(`<main> is "${text.slice(0, 120)}${text.length > 120 ? '...' : ''}" (the stub's is "${want}"); the old text may still be served`);
        if (!parseTags(main, 'a').some((a) => a.attrs.href === stub.home)) problems.push(`the stub does not link ${stub.home}`);
      }
    }
    const robotsMeta = parseTags(page, 'meta').filter((t) => (t.attrs.name || '').toLowerCase() === 'robots').map((t) => t.attrs.content);
    if (robotsMeta.length !== 1 || robotsMeta[0] !== 'noindex') problems.push(`robots meta ${JSON.stringify(robotsMeta)} (want "noindex")`);
    const ld = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    if (/"@type":\s*"(Article|FAQPage)"/.test(ld)) problems.push('structured data still has an Article or FAQPage node');
    if (sitemap.includes(`<loc>${u}</loc>`)) problems.push('still in sitemap.xml');
    if (llms.includes(u)) problems.push('still in llms.txt');
    if (feeds.includes(u)) problems.push('still in a feed');
    if (new RegExp('^\\s*Disallow:\\s*/' + esc(w) + '\\s*$', 'm').test(robots)) problems.push('robots.txt disallows it (a blocked page cannot be recrawled to see noindex)');
    for (const other of htmlFiles) {
      if (other === w) continue;
      const src = tryRead(other) || '';
      const base = SITE + other;
      const linked = ['a', 'link', 'area'].some((tag) => parseTags(src, tag).some((t) => {
        try { const r = new URL(decodeEntities(String(t.attrs.href || '')).replace(/[\t\n\r]/g, '').trim(), base); return host.test(r.hostname) && r.pathname === '/' + w; } catch (e) { return false; }
      })) || src.includes(u);
      if (linked) problems.push(`linked from ${other}${other === 'blog.html' ? ' (the visible list, or the ItemList in tools/seo/blog.json)' : ''}`);
    }
    for (const [other, e] of Object.entries(reg)) if (e.status === 'live' && Object.values(e.alt).includes(w)) problems.push(`${other} names it as its hreflang twin`);
    add(!problems.length, `withdrawn page ${w} is exactly the stub, noindex and unlisted`, problems.join('; '));
  }
  if (!withdrawn.length) add(true, 'no withdrawn pages (nothing to check)', '');

  // L. the URL lock
  const lockText = tryRead(path.join('tools', 'urls.lock'));
  if (lockText === null) add(false, 'tools/urls.lock exists', 'missing; run python3 tools/seo-head.py');
  else {
    const problems = [];
    const locked = {};
    let n = 0;
    for (const raw of lockText.split(/\r?\n/)) {
      const l = raw.trim();
      if (!l || l.startsWith('#')) continue;
      n++;
      const m = /^(https:\/\/vynatix\.com\/\S*) (\d{4}-\d{2}-\d{2})$/.exec(l);
      if (!m) { problems.push(`not a row "<url> <YYYY-MM-DD>": ${l.slice(0, 80)}`); continue; }
      if (m[1] in locked) problems.push(`duplicate row for ${m[1]}; the lock is append-only, one row per URL`);
      locked[m[1]] = m[2];
    }
    for (const u of Object.keys(locked)) {
      const f = fileOf(u);
      if (!f || !fs.existsSync(path.join(root, f))) problems.push(`gone: ${u} was public and has no file. Restore it and register it with status='withdrawn' (tools/TAKEDOWN.md)`);
    }
    for (const f of files) {
      if (!(urlOf(f) in locked)) problems.push(`not locked: ${urlOf(f)} (run python3 tools/seo-head.py)`);
      else if (locked[urlOf(f)] !== reg[f].pub) problems.push(`pub moved: ${urlOf(f)} locked ${locked[urlOf(f)]}, registry ${reg[f].pub} (pub never moves)`);
    }
    add(!problems.length, `tools/urls.lock: ${n} URLs, each still has a file, none unregistered, no pub date moved`, problems.join('; '));
  }

  // C. unresolved owner-fact markers
  const noticeFiles = Object.values(NOTICE_PAGES);
  const scanned = [...htmlFiles.filter((f) => !noticeFiles.includes(f)), ...PUBLISHED_TEXT.filter((f) => tryRead(f) !== null)];
  const marked = scanned.filter((f) => /\[\[\s*CONFIRM/i.test(tryRead(f) || ''));
  add(!marked.length, 'no [[CONFIRM marker on a page or published file that is not a privacy notice', `found in ${marked.join(', ')}. Resolve it from evidence; never fill it in from memory`);

  // D. the byline dates of the posts
  const posts = files.filter((f) => reg[f].kind === 'post' && reg[f].status === 'live');
  for (const f of posts) {
    const src = tryRead(f) || '';
    const para = [...src.matchAll(/<p\b[^>]*\bclass="[^"]*\bprose__meta\b[^"]*"[^>]*>([\s\S]*?)<\/p>/g)][0];
    const times = para ? [...para[1].matchAll(/<time\b[^>]*\bdatetime="([^"]*)"[^>]*>([^<]*)<\/time>/g)].map((m) => ({ iso: m[1], text: m[2].trim() })) : [];
    const problems = [];
    const lang = reg[f].lang;
    const check = (t, want, label) => {
      if (!t) problems.push(`${label} date missing; the registry says ${want}`);
      else {
        if (t.iso !== want) problems.push(`${label} datetime is ${t.iso} but the registry says ${want}`);
        if (t.text !== day(want, lang)) problems.push(`${label} shows "${t.text}" (want "${day(want, lang)}")`);
      }
    };
    if (!para) problems.push('no prose__meta byline');
    else {
      check(times[0], reg[f].pub, 'Published');
      if (reg[f].mod !== reg[f].pub || times.length > 1) check(times[1], reg[f].mod, 'Last updated');
    }
    add(!problems.length, `${f}: Published and Last updated dates (datetime and text) match pub and mod`, problems.join('; '));
  }
  if (!posts.length) add(true, 'no kind=post pages (nothing to check)', '');

  // H. the hub lists the posts
  if (reg['blog.html']) {
    const problems = [];
    const blog = tryRead('blog.html') || '';
    const liLinks = (html) => [...html.matchAll(/<li\b[^>]*>\s*<a\b[^>]*\bhref="([^"#]+\.html)"/g)].map((m) => m[1]);
    const visible = liLinks((/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(stripComments(blog)) || [])[1] || '').filter((f) => f !== 'index.html' && f !== 'sv.html');
    let item = null;
    try {
      const j = JSON.parse(tryRead(path.join('tools', 'seo', 'blog.json')) || 'null');
      item = j && j.extra_nodes && j.extra_nodes.find((n) => n['@type'] === 'ItemList');
    } catch (e) { problems.push(`tools/seo/blog.json does not parse: ${e.message}`); }
    if (!item) problems.push('tools/seo/blog.json has no ItemList');
    else {
      const els = item.itemListElement || [];
      if (item.numberOfItems !== els.length) problems.push(`ItemList numberOfItems ${item.numberOfItems} but ${els.length} items`);
      if (!els.every((e, i) => e.position === i + 1)) problems.push('ItemList positions are not 1..n in order');
      const listed = els.map((e) => fileOf((e.item || {}).url || ''));
      const a = [...new Set(listed)].sort().join(', ');
      const b = [...new Set(visible)].sort().join(', ');
      if (a !== b) problems.push(`the ItemList (${a}) and the visible list on blog.html (${b}) differ`);
      for (const f of listed) if (!f || !reg[f] || reg[f].status !== 'live') problems.push(`the ItemList names ${f}, which is not a live page`);
    }
    for (const f of posts) {
      if (!visible.includes(f)) problems.push(`${f} is not listed on blog.html`);
      const home = reg[f].lang === 'sv' ? 'sv.html' : 'index.html';
      if (!parseTags(tryRead(home) || '', 'a').some((t) => (t.attrs.href || '').replace(/#.*$/, '') === f)) problems.push(`${f} is not listed on ${home}`);
    }
    add(!problems.length, 'blog.html, its ItemList and the home pages list the posts', problems.join('; '));
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ self-test
// Builds scratch copies of the tree, damages each in one way, and requires run() to fail (or, for the control, to
// pass). Without it nothing would notice if one of the checks above were silently disabled.
function selfTest() {
  const copy = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vynatix-perm-'));
    for (const f of fs.readdirSync(ROOT)) if (/\.html$/.test(f) || PUBLISHED_TEXT.includes(f)) { if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f)); }
    fs.mkdirSync(path.join(dir, 'tools', 'seo'), { recursive: true });
    for (const f of ['seo-head.py', 'urls.lock']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(dir, 'tools', f));
    for (const f of fs.readdirSync(path.join(ROOT, 'tools', 'seo'))) fs.copyFileSync(path.join(ROOT, 'tools', 'seo', f), path.join(dir, 'tools', 'seo', f));
    return dir;
  };
  const edit = (dir, rel, fn) => { const p = path.join(dir, rel); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
  const PY = path.join('tools', 'seo-head.py');
  // A correct stub for page `name` (lang en), as the generator writes it, registered as withdrawn and locked.
  const withStub = (dir, extra = {}) => {
    const t = STUB.en;
    const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n'
      + `<title>${extra.title || t.title}</title>\n<meta name="description" content="${t.desc}">\n`
      + `<meta name="robots" content="noindex">\n<meta property="og:title" content="${t.title}">\n<meta property="og:description" content="${t.desc}">\n`
      + `<meta name="twitter:title" content="${t.title}">\n<meta name="twitter:description" content="${t.desc}">\n`
      + '<script type="application/ld+json">{"@graph":[{"@type":"WebPage"}]}</script></head><body>\n'
      + `  <main id="main">\n    <section class="page-hero"><div class="container"><p class="eyebrow">${t.eyebrow}</p><h1 class="page-hero__h1">${t.h1}</h1>\n`
      + `<p class="page-hero__lede">${extra.lede || t.lede('2026-11-05').replace('Go to the home page.', '<a href="index.html">Go to the home page</a>.')}</p></div></section>\n  </main>\n</body></html>\n`;
    fs.writeFileSync(path.join(dir, 'standin.html'), extra.main ? html.replace(/<main[\s\S]*<\/main>/, extra.main) : html);
    edit(dir, PY, (s) => s.replace("  'integritet.html': ", `  'standin.html': dict(lang='en', type='WebPage', og='website', pub='2026-11-04', mod='2026-11-05', status=${extra.q || "'"}withdrawn${extra.q || "'"}),\n  'integritet.html': `));
    edit(dir, path.join('tools', 'urls.lock'), (s) => s.replace(/\n?$/, '\n') + 'https://vynatix.com/standin.html 2026-11-04\n');
    return [...PAGES, 'standin.html'];
  };
  const cases = [
    ['control: the real tree passes', (d) => PAGES, true],
    ['control: a correct, unlinked stub passes', (d) => withStub(d), true],
    ['control: the same with a double-quoted status passes', (d) => withStub(d, { q: '"' }), true],
    ['an old title on a withdrawn page', (d) => withStub(d, { title: 'Så väljer ni konsultbolag, Vynatix' }), /title is/],
    ['a short wrong <main> on a withdrawn page', (d) => withStub(d, { main: '<main id="main"><p>Volvo Trucks paid us under NDA clause 7</p></main>' }), /<main> is/],
    ['a withdrawn page linked as ./standin.html', (d) => { const p = withStub(d); edit(d, 'about.html', (s) => s.replace('</main>', '<a href="./standin.html">x</a></main>')); return p; }, /linked from about\.html/],
    ['a withdrawn page linked by a <link rel=alternate href="/standin.html">', (d) => { const p = withStub(d); edit(d, 'about.html', (s) => s.replace('</head>', '<link rel="alternate" href="/standin.html"></head>')); return p; }, /linked from about\.html/],
    ['a withdrawn page linked as http://www.vynatix.com/standin.html', (d) => { const p = withStub(d); edit(d, 'about.html', (s) => s.replace('</main>', '<a href="http://www.vynatix.com/standin.html?x=1">x</a></main>')); return p; }, /linked from about\.html/],
    ['a withdrawn page still in llms.txt', (d) => { const p = withStub(d); edit(d, 'llms.txt', (s) => s + '- [x](https://vynatix.com/standin.html)\n'); return p; }, /still in llms\.txt/],
    ['a double-quoted status and a link (must not read as live)', (d) => { const p = withStub(d, { q: '"' }); edit(d, 'about.html', (s) => s.replace('</main>', '<a href="standin.html">x</a></main>')); return p; }, /linked from about\.html/],
    ['two registry entries on one line', (d) => { edit(d, PY, (s) => s.replace("  'terms.html':", "  'privacy2.html': dict(lang='en', type='WebPage', og='website', pub='2026-08-19', mod='2026-08-19'), 'terms.html':")); return PAGES; }, /cannot read|look like registry entries/],
    ['an unknown registry key', (d) => { edit(d, PY, (s) => s.replace("'terms.html':        dict(lang='en',", "'terms.html':        dict(staus='withdrawn', lang='en',")); return PAGES; }, /unknown registry key/],
    ['a duplicate row in the lock', (d) => { edit(d, path.join('tools', 'urls.lock'), (s) => s + 'https://vynatix.com/about.html 2026-07-01\n'); return PAGES; }, /duplicate row/],
    ['a locked URL with no file', (d) => { edit(d, path.join('tools', 'urls.lock'), (s) => s + 'https://vynatix.com/ghost.html 2026-07-01\n'); return PAGES; }, /gone: https:\/\/vynatix\.com\/ghost\.html/],
    ['a moved pub date', (d) => { edit(d, PY, (s) => s.replace("pub='2026-06-27', mod='2026-10-20'", "pub='2026-07-01', mod='2026-10-20'")); return PAGES; }, /pub moved/],
    ['a [[CONFIRM marker in llms.txt', (d) => { edit(d, 'llms.txt', (s) => s + '[[CONFIRM: a figure]]\n'); return PAGES; }, /found in llms\.txt/],
    ['a [[CONFIRM marker in a post', (d) => { edit(d, 'choose-a-software-consultancy.html', (s) => s.replace('<h1', '[[CONFIRM: x]]<h1')); return PAGES; }, /found in choose-a-software-consultancy\.html/],
    ['a post whose shown date differs from its datetime', (d) => { edit(d, 'choose-a-software-consultancy.html', (s) => s.replace('>4 November 2026</time> · Last', '>1 January 2020</time> · Last')); return PAGES; }, /shows \"1 January 2020\"/],
    ['a post missing from blog.html', (d) => { edit(d, 'blog.html', (s) => s.replace(/<li><a href="choose-a-software-consultancy\.html">[\s\S]*?<\/li>\n/, '')); return PAGES; }, /is not listed on blog\.html|differ/],
    ['an ItemList whose numberOfItems is wrong', (d) => { edit(d, path.join('tools', 'seo', 'blog.json'), (s) => s.replace('"numberOfItems": 5', '"numberOfItems": 9')); return PAGES; }, /numberOfItems/],
  ];
  let bad = 0;
  for (const [name, setup, expectPass] of cases) {
    const dir = copy();
    let results;
    try { results = run(dir, setup(dir)); } catch (e) { results = [{ ok: false, name: 'threw', detail: e.message }]; }
    fs.rmSync(dir, { recursive: true, force: true });
    const failed = results.filter((r) => !r.ok);
    const text = failed.map((f) => f.name + ' ' + f.detail).join(' / ');
    const good = expectPass === true ? failed.length === 0 : expectPass.test(text);
    if (!good) { bad++; console.log(`FAIL self-test: ${name}: ${expectPass === true ? 'failed: ' + text : failed.length ? 'failed, but not for the expected reason ' + expectPass + ': ' + text.slice(0, 300) : 'passed but should fail'}`); }
  }
  if (!bad) console.log(`ok   self-test: ${cases.length} cases, the checks fail for the right reasons`);
  return bad;
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) {
    const bad = selfTest();
    console.log(bad ? `\nFAIL — ${bad} self-test problem(s)` : '\nPASS — the permanence checks fail for the right reasons');
    process.exit(bad ? 1 : 0);
  }
  let bad = 0;
  for (const r of run()) {
    if (r.ok) console.log('ok   ' + r.name);
    else { bad++; console.log('FAIL ' + r.name + (r.detail ? '\n       ' + r.detail : '')); }
  }
  console.log(bad ? `\nFAIL — ${bad} problem(s)` : '\nPASS — permanence checks');
  process.exit(bad ? 1 : 0);
}
module.exports = { run, selfTest };
