// Permanence and editorial-safety checks. Static, no browser, no server: reads the tree as GitHub Pages
// will publish it. GitHub Pages cannot redirect and a push to main is live, so a page that has been public
// has to keep answering for good, and a page that must come down has to actually stop serving its text.
//   node verify/permanence.js
//
//  A  the PAGES registry of tools/seo-head.py and PAGES in _common.js name the same files, and each exists
//  W  every withdrawn page (registry status 'withdrawn', see tools/TAKEDOWN.md): is in no sitemap.xml, llms.txt or
//     feed, no robots.txt Disallow names it and no other page links to it; carries noindex; and its <main> is the
//     short stub (under 400 characters, no FAQ, no headings below the h1), so nothing of the old text is served
//  L  tools/urls.lock lists every URL ever registered: each locked URL still has a file (the live page or the
//     stub), every registered URL is locked, and a locked pub date never moves
//  C  no [[CONFIRM: ...]] marker on any page that is not one of the two notices (release-gate.js reads only the
//     notices, and only at the analytics flip, so a marker in a post would ship)
//  D  for registry kind 'post': the visible Published (and Last updated) <time datetime> in the byline equals pub
//     and mod in the registry
// Exports run() for tests. See AGENTS.md, "Posts, permanence and withdrawal".
const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, NOTICE_PAGES, readRegistry, parseTags, htmlToText, stripComments } = require('./_common');

const SITE = 'https://vynatix.com/';
const urlOf = (f) => (f === 'index.html' ? SITE : SITE + f);
const fileOf = (u) => (u === SITE ? 'index.html' : u.startsWith(SITE) ? u.slice(SITE.length) : null);
const FEEDS = ['feed.xml', 'atom.xml', 'rss.xml'];
const STUB_MAX = 400;

function run(root = ROOT) {
  const out = [];
  const add = (ok, name, detail) => out.push({ ok, name, detail: ok ? '' : detail });
  const tryRead = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { return null; } };
  const reg = readRegistry(root);
  const files = Object.keys(reg);

  // A. one registry
  const onlyPy = files.filter((f) => !PAGES.includes(f));
  const onlyJs = PAGES.filter((f) => !reg[f]);
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
  for (const w of withdrawn) {
    const problems = [];
    const u = urlOf(w);
    if (sitemap.includes(`<loc>${u}</loc>`)) problems.push('still in sitemap.xml');
    if (llms.includes(u)) problems.push('still in llms.txt');
    if (feeds.includes(u)) problems.push('still in a feed');
    if (new RegExp('^\\s*Disallow:\\s*/' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm').test(robots)) problems.push('robots.txt disallows it (a blocked page cannot be recrawled to see noindex)');
    for (const other of htmlFiles) {
      if (other === w) continue;
      const src = tryRead(other) || '';
      const linked = parseTags(src, 'a').some((t) => (t.attrs.href || '').replace(/#.*$/, '') === w) || src.includes(u);
      if (linked) problems.push(`linked from ${other}`);
    }
    for (const [other, e] of Object.entries(reg)) if (e.status === 'live' && Object.values(e.alt).includes(w)) problems.push(`${other} names it as its hreflang twin`);
    const page = tryRead(w) || '';
    const robotsMeta = parseTags(page, 'meta').filter((t) => (t.attrs.name || '').toLowerCase() === 'robots').map((t) => t.attrs.content);
    if (robotsMeta.length !== 1 || robotsMeta[0] !== 'noindex') problems.push(`robots meta ${JSON.stringify(robotsMeta)} (want "noindex")`);
    const main = (/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(stripComments(page)) || [])[1] || '';
    const text = htmlToText(main).replace(/\s+/g, ' ').trim();
    if (!main) problems.push('no <main>');
    if (text.length >= STUB_MAX) problems.push(`<main> is ${text.length} characters (the stub is under ${STUB_MAX}); the old text is still served`);
    if (/data-faq/.test(main)) problems.push('<main> still has a FAQ');
    if (/<h[2-6]\b/i.test(main)) problems.push('<main> still has headings below the h1');
    add(!problems.length, `withdrawn page ${w} is the stub, noindex and unlisted`, problems.join('; '));
  }
  if (!withdrawn.length) add(true, 'no withdrawn pages (nothing to check)', '');

  // L. the URL lock
  const lockText = tryRead(path.join('tools', 'urls.lock'));
  if (lockText === null) add(false, 'tools/urls.lock exists', 'missing; run python3 tools/seo-head.py');
  else {
    const rows = lockText.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.trim().split(/\s+/));
    const locked = Object.fromEntries(rows.map((r) => [r[0], r[1]]));
    const problems = [];
    for (const u of Object.keys(locked)) {
      const f = fileOf(u);
      if (!f || !fs.existsSync(path.join(root, f))) problems.push(`gone: ${u} was public and has no file. Restore it and register it with status='withdrawn' (tools/TAKEDOWN.md)`);
    }
    for (const f of files) {
      if (!(urlOf(f) in locked)) problems.push(`not locked: ${urlOf(f)} (run python3 tools/seo-head.py)`);
      else if (locked[urlOf(f)] !== reg[f].pub) problems.push(`pub moved: ${urlOf(f)} locked ${locked[urlOf(f)]}, registry ${reg[f].pub} (pub never moves)`);
    }
    add(!problems.length, `tools/urls.lock: ${rows.length} URLs, each still has a file, none unregistered, no pub date moved`, problems.join('; '));
  }

  // C. unresolved owner-fact markers
  const marked = htmlFiles.filter((f) => !Object.values(NOTICE_PAGES).includes(f) && /\[\[\s*CONFIRM/i.test(tryRead(f) || ''));
  add(!marked.length, 'no [[CONFIRM marker on a page that is not a privacy notice', `found in ${marked.join(', ')}. Resolve it from evidence; never fill it in from memory`);

  // D. visible dates of the posts
  const posts = files.filter((f) => reg[f].kind === 'post' && reg[f].status === 'live');
  for (const f of posts) {
    const src = tryRead(f) || '';
    const meta = /<p class="prose__meta">([\s\S]*?)<\/p>/.exec(src);
    const times = meta ? [...meta[1].matchAll(/<time datetime="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]) : [];
    const problems = [];
    if (!meta) problems.push('no <p class="prose__meta"> byline');
    else {
      if (times[0] !== reg[f].pub) problems.push(`Published shows ${times[0]} but pub is ${reg[f].pub}`);
      if (reg[f].mod !== reg[f].pub && times[1] !== reg[f].mod) problems.push(`Last updated shows ${times[1] || 'nothing'} but mod is ${reg[f].mod}`);
      if (reg[f].mod === reg[f].pub && times.length > 1 && times[1] !== reg[f].mod) problems.push(`Last updated shows ${times[1]} but mod is ${reg[f].mod}`);
    }
    add(!problems.length, `${f}: visible Published and Last updated dates match pub and mod`, problems.join('; '));
  }
  if (!posts.length) add(true, 'no kind=post pages (nothing to check)', '');
  return out;
}

if (require.main === module) {
  let bad = 0;
  for (const r of run()) {
    if (r.ok) console.log('ok   ' + r.name);
    else { bad++; console.log('FAIL ' + r.name + (r.detail ? '\n       ' + r.detail : '')); }
  }
  console.log(bad ? `\nFAIL — ${bad} problem(s)` : '\nPASS — permanence checks');
  process.exit(bad ? 1 : 0);
}
module.exports = { run };
