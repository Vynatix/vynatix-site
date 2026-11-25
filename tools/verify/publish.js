// What ships: the checks on the repository as GitHub Pages will publish it. Static, no browser, no server; second in
// `npm run check`, after csp.js, because every other script takes its list of pages from PAGES in _common.js and
// trusts that nothing else is published.
//   node verify/publish.js
//
//  - every *.html at the root is in PAGES, and every PAGES entry exists (a page that is not in the list escapes the
//    CSP, link, SEO and consent checks, which all iterate PAGES);
//  - every other file at the root is a page, an asset the site uses (css, js, xml, ico, png, svg, webmanifest,
//    CNAME, robots.txt, llms.txt or the IndexNow <32 hex>.txt key) or is named in _config.yml `exclude`; a directory
//    is assets, fonts, .well-known, tools (excluded), .git or the folder of a live generated language, or is
//    excluded, and the folder of a draft language is always excluded; no .md document sits in assets,
//    fonts or .well-known unless it is excluded (otherwise GitHub Pages serves it);
//  - Jekyll copies every published file through unchanged: there is no .nojekyll in the published tree (one at the
//    root turns Jekyll off, and `exclude` with it, so every file would be served), and no published file begins with
//    --- (front matter: Jekyll renders the file and strips the block);
//  - every url() in every published stylesheet (tokens.css, colors_and_type.css, styles.css, hero-bg.css) names a
//    published file, resolved against the stylesheet; data: URIs, fragment-only references and @supports conditions
//    are not fetched and are not compared;
//  - the footer of every page carries the Cookie settings link: data-consent-open and href privacy.html#cookies;
//  - the notice link in each language of COPY in app.js points at that language's notice page (NOTICE_PAGES);
//  - both notice pages name every storage key the site's script uses (app.js), each in <code>;
//  - the hero background is the drafting sheet alone: hero-bg.css is linked by index.html only, holds still, role-token
//    rules and names both art files; the draw between backgrounds stays retired (no hero-bg.js, no data-bg, no
//    vynatix-bg key in a script, a stylesheet or a notice);
//  - the site rules of CLAUDE.md that nothing else reads: no raw hex colour in styles.css, no style="" attribute in
//    any page, no .style, cssText or setAttribute('style' in app.js (comments excluded);
//  - llms.txt links every URL in sitemap.xml (seo.js checks the other direction).
// Exports run(), the helpers release-gate.js shares, and publishedOnDisk() and cssUrlProblems() for other checks.
const fs = require('fs');
const path = require('path');
const {
  ROOT, PAGES, NOTICE_PAGES, readLangs, CONSENT_KEY, THEME_KEY, LOOK_KEY, BG_KEY_PREFIX, BG_ATTR, readApp, appConst, parseTags, stripJsComments, stripComments, stripElements,
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

// The files GitHub Pages' Jekyll would publish from the tree on disk, by the rules shipped.js applies to a git
// listing: not _config.yml, no path named in `exclude` or under one, and no path with a part that begins with . _ #
// or ~ or ends with ~ unless `include` names it (.well-known). It also returns every .nojekyll it meets in a
// directory it walks, looked at before the dot rule and `exclude` would pass over it: GitHub reads that file before
// Jekyll runs, and with one at the root it skips Jekyll and serves every file of the branch, tools/ and the
// developer documents included. Excluded directories are not walked, so tools/node_modules is never read.
function publishedOnDisk(root, exclude, include) {
  const files = [];
  const nojekyll = [];
  const under = (list, r) => [...list].some((e) => r === e || r.startsWith(e + '/'));
  const special = (name) => /^[._#~]/.test(name) || /~$/.test(name);
  const visit = (rel) => {
    let list;
    try { list = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch (e) { return; }
    for (const e of list) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (r === '.git') continue;
      if (e.name === '.nojekyll') { nojekyll.push(r); continue; }
      if (under(exclude, r) || (special(e.name) && !under(include, r))) continue;
      if (e.isDirectory()) visit(r);
      else if (r !== '_config.yml') files.push(r);
    }
  };
  visit('');
  return { files: files.sort(), nojekyll: nojekyll.sort() };
}

// The first three bytes of a file, or null when it cannot be read.
function firstBytes(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(3);
    return b.subarray(0, fs.readSync(fd, b, 0, 3, 0)).toString('latin1');
  } catch (e) { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
}

// The url() references of one stylesheet (its path from the root, as served) that do not name a published file:
// { refs, problems }. Each target is resolved against the stylesheet's own URL, as a browser does, and its query
// and fragment are dropped. Not fetched, so not compared: a data: URI, a reference to a fragment alone (the glass
// filters' url(#vx-lens)), and anything in the condition of an @supports rule, which only asks whether the browser
// understands the syntax (light-dark(url(a.webp), url(b.webp)) in styles.css). Comments are read as blank. A url(
// that the pattern cannot read is a problem too, so that an unusual spelling is reported and not skipped.
const SITE = 'https://vynatix.com/';
function cssUrlProblems(text, sheet, isPublished, onDisk) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const code = String(text).replace(/\/\*[\s\S]*?\*\//g, blank).replace(/@supports\b[^{]*/g, blank);
  const lineOf = (i) => code.slice(0, i).split('\n').length;
  const problems = [];
  let refs = 0;
  const targets = [];
  const opened = [...code.matchAll(/\burl\(/gi)].length;
  for (const m of code.matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi)) targets.push([m[1] ?? m[2] ?? m[3], m.index]);
  if (targets.length !== opened) problems.push(`${sheet}: ${opened} url( but only ${targets.length} that this check can read; write each as url("path")`);
  for (const m of code.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) targets.push([m[1] ?? m[2], m.index]);
  for (const [raw, at] of targets) {
    const t = raw.trim();
    const where = `${sheet} line ${lineOf(at)}`;
    if (/^data:/i.test(t) || t.startsWith('#')) continue;
    refs++;
    if (!t) { problems.push(`${where}: an empty url()`); continue; }
    let u;
    try { u = new URL(t, SITE + sheet); } catch (e) { problems.push(`${where}: ${t} is not a URL`); continue; }
    if (u.origin !== new URL(SITE).origin) { problems.push(`${where}: ${t} is off the site (not a file this repository publishes)`); continue; }
    let rel;
    try { rel = decodeURIComponent(u.pathname.slice(1)); } catch (e) { rel = u.pathname.slice(1); }
    if (isPublished(rel)) continue;
    problems.push(`${where}: ${t} names ${rel || '/'}, ${onDisk(rel) ? 'which is on disk but not published (excluded, or a dot path)' : 'which is not on disk'}`);
  }
  return { refs, problems };
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
  // The folder of a generated language (LANGS in tools/seo-head.py): published once the language is live, and
  // named in `exclude` for as long as it is a draft (seo-head.py keeps that list).
  let langs = {};
  try { langs = readLangs(root); } catch (e) { add(false, 'the LANGS table of tools/seo-head.py can be read', e.message); }
  const generated = Object.entries(langs).filter(([, l]) => l.kind === 'generated');
  const gateProblems = [];
  for (const [code, l] of generated) {
    if (l.status === 'draft' && !exclude.has(code)) gateProblems.push(`${code}/ is a draft but is not in _config.yml exclude (it would be published; run python3 tools/seo-head.py)`);
    if (l.status === 'live' && exclude.has(code)) gateProblems.push(`${code}/ is live but still in _config.yml exclude (run python3 tools/seo-head.py)`);
    const checked = /^\d{4}-\d{2}-\d{2}$/.test(l.checked || '') && (l.by || '').trim();
    const waived = /^\d{4}-\d{2}-\d{2}$/.test(l.waived || '');
    if (l.status === 'live' && !checked && !waived) gateProblems.push(`${code} is live with neither a native reader's check on record (checked, by) nor the owner's decision to publish without one (waived)`);
  }
  add(gateProblems.length === 0, `the ${generated.length} generated languages are published only when live: a draft's folder is in _config.yml exclude`, gateProblems.join(' | '));
  const unread = generated.filter(([, l]) => l.status === 'live' && !(/^\d{4}-\d{2}-\d{2}$/.test(l.checked || '') && (l.by || '').trim())).map(([code]) => code);
  if (unread.length) console.log(`note the native reader's check is still owed for ${unread.join(', ')}: published on the owner's decision (waived in LANGS, tools/seo-head.py)`);
  for (const e of entries) {
    const n = e.name;
    if (e.isDirectory()) {
      if (n === '.git' || ALWAYS_DIRS.includes(n) || exclude.has(n)) continue;
      if (langs[n] && langs[n].kind === 'generated' && langs[n].status === 'live') continue;
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

  // --- Jekyll copies every published file through unchanged: no .nojekyll, no front matter
  const pub = publishedOnDisk(root, exclude, include);
  const published = new Set(pub.files);
  add(pub.nojekyll.length === 0, 'no .nojekyll in the published tree (with one at the root GitHub skips Jekyll, and _config.yml exclude with it: every file would be served)',
    pub.nojekyll.length ? `found: ${pub.nojekyll.join(', ')}` : '');
  // Every published file and not only the text ones: Jekyll reads the first line of each file it meets, binary or
  // not, to decide whether it is a page. No image or font format begins with these bytes.
  const matter = [];
  for (const f of pub.files) {
    const b = firstBytes(path.join(root, f));
    if (b === null) matter.push(`${f} cannot be read`);
    else if (b === '---') matter.push(`${f} begins with --- (front matter: Jekyll would render it and strip the block instead of copying the file)`);
  }
  add(pub.files.length > 0 && matter.length === 0, `none of the ${pub.files.length} published files begins with --- (front matter, which Jekyll renders instead of copying)`,
    pub.files.length ? matter.slice(0, 8).join(' | ') + (matter.length > 8 ? ` | and ${matter.length - 8} more` : '') : 'no published file found');

  // --- every url() of every published stylesheet names a published file
  {
    const sheets = pub.files.filter((f) => /\.css$/i.test(f));
    const bad = [];
    let refs = 0;
    for (const want of ['tokens.css', 'colors_and_type.css', 'styles.css']) if (!published.has(want)) bad.push(`${want} is not published`);
    for (const s of sheets) {
      const text = tryRead(s);
      if (text === null) { bad.push(`${s} cannot be read`); continue; }
      const r = cssUrlProblems(text, s, (f) => published.has(f), (f) => fs.existsSync(path.join(root, f)));
      refs += r.refs;
      bad.push(...r.problems);
    }
    if (!refs) bad.push('no url() reference found in any published stylesheet (tokens.css alone names every font of the site)');
    add(bad.length === 0, `every url() in the ${sheets.length} published stylesheets (${sheets.join(', ')}) names a published file (${refs} references; data: URIs, fragment-only references and @supports conditions are not fetched)`,
      bad.slice(0, 8).join(' | ') + (bad.length > 8 ? ` | and ${bad.length - 8} more` : ''));
  }

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
  const scriptKeys = new Set([(app && app.consentKey) || CONSENT_KEY, THEME_KEY]);
  if (app) for (const m of stripJsComments(app.src).matchAll(/['"](vynatix-[a-z-]+)['"]/g)) scriptKeys.add(m[1]);
  const keys = [...scriptKeys].sort();
  const keyBad = [];
  for (const page of Object.values(NOTICE_PAGES)) {
    const html = tryRead(page);
    if (html === null) { keyBad.push(`${page}: file missing`); continue; }
    const lost = storageKeyProblems(html, keys);
    if (lost.length) keyBad.push(`${page} does not name ${lost.map((k) => '<code>' + k + '</code>').join(', ')}`);
  }
  // The theme key the notices and _common.js name is the value of THEME_KEY in app.js, read by appConst. (The scan
  // above stays a scan on purpose: it collects every key the code writes, wherever it is written.)
  if (app) {
    let k = null;
    try { k = appConst('THEME_KEY', app.src, 'string'); } catch (e) { keyBad.push(e.message); }
    if (k !== null && k !== THEME_KEY) keyBad.push(`app.js THEME_KEY is ${k}, no longer ${THEME_KEY} (rename it in the notices and in _common.js too)`);
  }
  // The retired colour-scheme draw: no script may write its key again, and no notice may still describe it.
  if (app && stripJsComments(app.src).includes(LOOK_KEY)) keyBad.push(`app.js uses ${LOOK_KEY}, the retired colour-scheme draw`);
  for (const page of Object.values(NOTICE_PAGES)) { const html = tryRead(page); if (html && html.includes(LOOK_KEY)) keyBad.push(`${page} still names ${LOOK_KEY}, which nothing writes now`); }
  add(keyBad.length === 0, `both notices name every storage key the scripts use (${keys.join(', ')}), each in <code>`, keyBad.join(' | '));

  // --- the hero background: the drafting sheet alone, and the retired draw stays retired
  {
    const bad = [];
    const noCss = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
    const hero = tryRead('hero-bg.css');
    if (hero === null) bad.push('hero-bg.css is missing');
    if (tryRead('hero-bg.js') !== null) bad.push('hero-bg.js is back (the sheet has no script; the other backgrounds were removed)');
    for (const pg of pages) {
      const html = tryRead(pg);
      if (html === null) continue;
      const linksCss = /href="hero-bg\.css(\?v=[0-9a-f]*)?"/.test(html);
      if (pg === 'index.html' && !linksCss) bad.push('index.html does not link hero-bg.css');
      if (pg !== 'index.html' && linksCss) bad.push(`${pg} links hero-bg.css, which only index.html may`);
      if (/hero-bg\.js/.test(html)) bad.push(`${pg} links hero-bg.js`);
      if (new RegExp('\\s' + BG_ATTR + '\\s*=').test(stripComments(html))) bad.push(`${pg} carries ${BG_ATTR}`);
      if (html.includes(BG_KEY_PREFIX)) bad.push(`${pg} names ${BG_KEY_PREFIX}, which nothing writes now`);
    }
    const sources = { 'styles.css': noCss(tryRead('styles.css') || ''), 'hero-bg.css': noCss(hero || '') };
    if (app) sources['app.js'] = stripJsComments(app.src);
    for (const [f, code] of Object.entries(sources)) {
      if (code.includes(BG_KEY_PREFIX)) bad.push(`${f} uses ${BG_KEY_PREFIX}, the retired hero-background draw`);
      if (code.includes(BG_ATTR)) bad.push(`${f} uses ${BG_ATTR}, the retired hero-background draw`);
    }
    if (hero !== null) {
      const code = sources['hero-bg.css'];
      const raw = code.match(/!important|\[data-theme|#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|var\(--(?:forest|teal|mono|cream|bronze|champagne|cloud|neutral|grey)-/);
      if (raw) bad.push(`hero-bg.css: ${raw[0]} (role tokens only, no !important, no theme selectors)`);
      const moving = code.match(/@keyframes|\banimation(?:-[a-z-]+)?\s*:|\btransition(?:-[a-z-]+)?\s*:/);
      if (moving) bad.push(`hero-bg.css: ${moving[0].trim()} (the sheet is still, and nothing that moves may be added here)`);
      const foreign = [...new Set([...code.matchAll(/(?:^|[;{\s])(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]).filter((v) => !v.startsWith('--sheet-')))];
      if (foreign.length) bad.push(`hero-bg.css: custom properties without the --sheet- prefix: ${foreign.slice(0, 4).join(', ')}`);
      const named = [...new Set([...code.matchAll(/url\(\s*["']?assets\/(bg-[a-z0-9-]+\.svg)["']?\s*\)/g)].map((m) => m[1]))].sort();
      let onDisk = [];
      try { onDisk = fs.readdirSync(path.join(root, 'assets')).filter((f) => /^bg-.*\.svg$/.test(f)).sort(); } catch (e) { /* reported as missing below */ }
      if (named.join() !== onDisk.join()) bad.push(`hero-bg.css names [${named.join(', ')}] but assets/ holds [${onDisk.join(', ')}]`);
    }
    add(bad.length === 0, 'the hero background is the drafting sheet alone: hero-bg.css on index.html only, still, role tokens, its art files on disk; no hero-bg.js, data-bg or vynatix-bg anywhere', bad.join(' | '));
  }

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

module.exports = { run, yamlList, footerLinkProblems, storageKeyProblems, publishedOnDisk, cssUrlProblems, ALLOWED_HEX };

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
