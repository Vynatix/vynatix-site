// What ships: the checks on the repository as GitHub Pages will publish it. Static, no browser, no server; second in
// `npm run check`, after csp.js, because every other script takes its list of pages from PAGES in _common.js and
// trusts that nothing else is published.
//   node verify/publish.js
//
//  - every *.html at the root is in PAGES, and every PAGES entry exists (a page that is not in the list escapes the
//    CSP, link, SEO and consent checks, which all iterate PAGES);
//  - every other file at the root is a page, an asset the site uses (css, js, xml, ico, png, svg, webmanifest,
//    CNAME, robots.txt, llms.txt or the IndexNow <32 hex>.txt key) or is named in _config.yml `exclude`; a directory
//    is assets, fonts, .well-known, tools (excluded) or .git, or is excluded; no .md document sits in assets,
//    fonts or .well-known unless it is excluded (otherwise GitHub Pages serves it);
//  - the footer of every page carries the Cookie settings link: data-consent-open and href privacy.html#cookies;
//  - the notice link in each language of COPY in app.js points at that language's notice page (NOTICE_PAGES);
//  - both notice pages name every storage key the site's scripts use (app.js and hero-bg.js), each in <code>;
//  - the site rules of CLAUDE.md that nothing else reads: no raw hex colour in styles.css, no style="" attribute in
//    any page, no .style, cssText or setAttribute('style' in app.js (comments excluded);
//  - llms.txt links every URL in sitemap.xml (seo.js checks the other direction).
// Exports run() and the helpers release-gate.js shares.
const fs = require('fs');
const path = require('path');
const {
  ROOT, PAGES, NOTICE_PAGES, CONSENT_KEY, THEME_KEY, LOOK_KEY, readApp, parseTags, stripJsComments, stripComments, stripElements,
} = require('./_common');

// Raw hex colours styles.css may contain. Today it contains none: the site layer uses role tokens only. A new entry
// needs a reason, written next to it.
const ALLOWED_HEX = [];

const ASSET_EXT = /\.(css|js|xml|ico|png|svg|webmanifest)$/i;
const ROOT_TXT = /^(robots\.txt|llms\.txt|[0-9a-f]{32}\.txt)$/;       // robots, llms and the IndexNow key
const ALWAYS_DIRS = ['assets', 'fonts', '.well-known'];                 // published on purpose (.well-known via `include`)

// The entries under a top-level key of _config.yml (`exclude:` or `include:`), without quotes or a trailing slash.
function yamlList(text, key) {
  const out = [];
  let on = false;
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\r$/, '').replace(/\s+#.*$/, '');
    if (/^[A-Za-z_][\w-]*\s*:/.test(line)) { on = new RegExp('^' + key + '\\s*:\\s*$').test(line); continue; }
    const m = on ? /^\s*-\s*(.+?)\s*$/.exec(line) : null;
    if (m) out.push(m[1].replace(/^['"]|['"]$/g, '').replace(/\/$/, ''));
  }
  return out;
}

// The footer's Cookie settings link problems of one page, or [] when it is there.
function footerLinkProblems(html) {
  const footer = (/<footer\b[\s\S]*<\/footer>/i.exec(html) || [''])[0];
  const links = parseTags(footer, 'a').filter((t) => 'data-consent-open' in t.attrs);
  if (!links.length) return ['no link with data-consent-open in the footer'];
  if (!links.some((t) => t.attrs.href === 'privacy.html#cookies')) return ['the data-consent-open link does not point at privacy.html#cookies'];
  return [];
}

// The storage keys a notice must name in <code>, and the ones it does not.
function storageKeyProblems(html, keys) {
  return keys.filter((k) => !new RegExp('<code>\\s*' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*</code>').test(html));
}

function walk(dir, rel = '') {
  const out = [];
  let list;
  try { list = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch (e) { return out; }
  for (const e of list) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...walk(dir, r)); else out.push(r);
  }
  return out;
}

function run(root = ROOT, pages = PAGES) {
  const results = [];
  const add = (ok, name, detail) => results.push({ ok, name, detail: detail || '' });
  const tryRead = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { return null; } };

  // --- the pages on disk and PAGES
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { add(false, 'the repository root can be read', e.message); }
  const htmlOnDisk = entries.filter((e) => e.isFile() && /\.html?$/i.test(e.name)).map((e) => e.name);
  const notListed = htmlOnDisk.filter((f) => !pages.includes(f));
  const missing = pages.filter((f) => !htmlOnDisk.includes(f));
  add(!notListed.length && !missing.length, `the *.html files at the root are exactly the ${pages.length} pages in PAGES (_common.js)`,
    [notListed.length ? `not in PAGES: ${notListed.join(', ')} (csp, links, seo and consent skip it; add it to PAGES, or it should not be a page)` : '',
      missing.length ? `in PAGES but missing: ${missing.join(', ')}` : ''].filter(Boolean).join('; '));

  // --- what Pages would publish
  const config = tryRead('_config.yml');
  add(config !== null, '_config.yml exists (it decides what is published)', config === null ? 'file missing' : '');
  const exclude = new Set(yamlList(config || '', 'exclude'));
  const include = new Set(yamlList(config || '', 'include'));
  const stray = [];
  for (const e of entries) {
    const n = e.name;
    if (e.isDirectory()) {
      if (n === '.git' || ALWAYS_DIRS.includes(n) || exclude.has(n)) continue;
      if (/^[._#~]/.test(n) && !include.has(n)) continue;           // Jekyll skips these unless `include` names them
      stray.push(`${n}/ (a directory that would be published; add it to _config.yml exclude, or move it under tools/)`);
      continue;
    }
    if (!e.isFile() || exclude.has(n)) continue;
    if (/\.html?$/i.test(n)) continue;                                 // judged above
    if (n === '_config.yml' || (/^[._#~]/.test(n) && !include.has(n))) continue;   // Jekyll never publishes these
    if (n === 'CNAME' || ASSET_EXT.test(n) || (/\.txt$/i.test(n) && ROOT_TXT.test(n))) continue;
    stray.push(`${n} (a file that would be published; add it to _config.yml exclude, or it is not a site file)`);
  }
  for (const f of ['assets', 'fonts', '.well-known'].flatMap((d) => walk(root, d))) {
    if (/\.(md|markdown)$/i.test(f) && !exclude.has(f)) stray.push(`${f} (a document under a published directory; add it to _config.yml exclude)`);
  }
  if (!exclude.has('tools')) stray.push('tools/ is not named in _config.yml exclude (the verification scripts would be published)');
  add(stray.length === 0, 'every root file and directory is a page, a site asset or named in _config.yml exclude', stray.join(' | '));

  // --- the footer link on every page
  const noFooter = [];
  for (const p of pages) {
    const html = tryRead(p);
    if (html === null) { noFooter.push(`${p} (missing)`); continue; }
    const pr = footerLinkProblems(html);
    if (pr.length) noFooter.push(`${p} (${pr[0]})`);
  }
  add(noFooter.length === 0, 'the footer of every page carries the Cookie settings link (data-consent-open, href privacy.html#cookies)',
    noFooter.length ? `${noFooter.length}: ${noFooter.slice(0, 4).join(', ')}${noFooter.length > 4 ? ' ...' : ''}` : '');

  // --- the notice links in COPY
  let app = null;
  try { app = readApp(root); } catch (e) { add(false, 'app.js can be read', e.message); }
  if (app) {
    const bad = [];
    for (const [lang, page] of Object.entries(NOTICE_PAGES)) {
      const href = app.copy && app.copy[lang] && app.copy[lang].noticeHref;
      if (typeof href !== 'string') { bad.push(`COPY.${lang}.noticeHref is missing`); continue; }
      if (href.split('#')[0] !== page) bad.push(`COPY.${lang}.noticeHref is ${href}, the ${lang} notice is ${page}`);
    }
    add(bad.length === 0, 'the notice link in each language of COPY (app.js) points at that language\'s notice page', bad.join('; '));
  }

  // --- every storage key the scripts use, in both notices (the Swedish one is easy to forget when a key is added)
  const scriptKeys = new Set([(app && app.consentKey) || CONSENT_KEY, THEME_KEY, LOOK_KEY]);
  for (const f of ['app.js', 'hero-bg.js']) {
    const src = tryRead(f);
    if (src === null) continue;
    for (const m of stripJsComments(src).matchAll(/['"](vynatix-[a-z-]+)['"]/g)) scriptKeys.add(m[1]);
  }
  scriptKeys.delete('vynatix-bg-iris-idle');            // a test hook the site only reads and never stores
  const keys = [...scriptKeys].sort();
  const keyBad = [];
  for (const page of Object.values(NOTICE_PAGES)) {
    const html = tryRead(page);
    if (html === null) { keyBad.push(`${page}: file missing`); continue; }
    const lost = storageKeyProblems(html, keys);
    if (lost.length) keyBad.push(`${page} does not name ${lost.map((k) => '<code>' + k + '</code>').join(', ')}`);
  }
  if (app) for (const k of [THEME_KEY, LOOK_KEY]) if (!app.src.includes(`'${k}'`) && !app.src.includes(`"${k}"`)) keyBad.push(`app.js no longer uses ${k} (rename it in the notices and in _common.js too)`);
  add(keyBad.length === 0, `both notices name every storage key the scripts use (${keys.join(', ')}), each in <code>`, keyBad.join(' | '));

  // --- the site rules
  const css = tryRead('styles.css');
  if (css === null) add(false, 'styles.css can be read', 'file missing');
  else {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const found = [];
    code.split('\n').forEach((line, i) => { for (const m of line.matchAll(/#[0-9a-f]{3,8}\b/gi)) if (!ALLOWED_HEX.includes(m[0].toLowerCase())) found.push(`line ${i + 1}: ${m[0]}`); });
    add(found.length === 0, 'styles.css holds no raw hex colour (role tokens only: var(--md-sys-color-...), var(--text-muted), ...)',
      found.length ? `${found.slice(0, 5).join(', ')}${found.length > 5 ? ' ...' : ''}. Use a role token; if a hex is truly needed, add it to ALLOWED_HEX in verify/publish.js with the reason` : '');
  }
  const inline = [];
  for (const p of pages) {
    const html = tryRead(p);
    if (html === null) continue;
    const markup = stripElements(stripComments(html), ['script', 'style']);
    if (/<[a-zA-Z][^<>]*\sstyle\s*=/.test(markup)) inline.push(p);
  }
  add(inline.length === 0, 'no page has a style="" attribute (the CSP pins style-src \'self\')', inline.join(', '));
  if (app) {
    const code = stripJsComments(app.src);
    const hits = [];
    code.split('\n').forEach((line, i) => {
      if (/\.style\b/.test(line)) hits.push(`line ${i + 1}: .style`);
      if (/\bcssText\b/.test(line)) hits.push(`line ${i + 1}: cssText`);
      if (/setAttribute\(\s*['"]style['"]/.test(line)) hits.push(`line ${i + 1}: setAttribute('style'`);
    });
    add(hits.length === 0, 'app.js sets no inline style (.style, cssText, setAttribute(\'style\'); classes only)', hits.slice(0, 5).join(', '));
  }

  // --- llms.txt lists every page of the sitemap
  const sitemap = tryRead('sitemap.xml');
  const llms = tryRead('llms.txt');
  if (sitemap === null || llms === null) add(false, 'sitemap.xml and llms.txt can be read', sitemap === null ? 'sitemap.xml missing' : 'llms.txt missing');
  else {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    const linked = new Set([...llms.matchAll(/\((https:\/\/vynatix\.com\/[^)\s]*)\)/g)].map((m) => m[1]));
    const absent = locs.filter((u) => !linked.has(u));
    add(locs.length > 0 && absent.length === 0, `llms.txt links every URL in sitemap.xml (${locs.length})`, absent.length ? `not linked: ${absent.join(', ')}` : locs.length ? '' : 'no <loc> found in sitemap.xml');
  }
  return results;
}

module.exports = { run, yamlList, footerLinkProblems, storageKeyProblems, ALLOWED_HEX };

if (require.main === module) {
  const results = run();
  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(bad === 0 ? '\nPASS — the repository ships the pages, assets and links it should and nothing else'
                        : `\nFAIL — ${bad} problem(s) with what ships`);
  process.exit(bad === 0 ? 0 : 1);
}
