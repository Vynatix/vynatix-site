// Proves a browser holding an OLD copy of the site's shared files cannot be paired
// with the NEW page: the failure iOS Chrome showed after the design-system
// migration (new html, old styles.css: icons at full width in black, default
// list bullets, an unstyled header).
//
// It runs its own server, so it needs no `python3 -m http.server`. The server
// lets assets live in the browser cache for a year (an exaggeration of
// GitHub Pages' ten minutes, so nothing here depends on timing) and keeps the
// html fresh, like a visitor whose page has expired but whose files have not.
//
//   1. Prime the browser cache with an old build: html plus an old copy of each of
//      the shared files, and the two home-only ones, under the plain URLs (styles.css, app.js, hero-bg.css ...). Each
//      old file leaves a mark: huge black icons, default bullets, a flag on <html>.
//   2. CONTROL: load the current pages with the version stamps removed. They must
//      come out wrong because of the old stylesheet. If they do not, the harness no
//      longer reproduces the failure and the result below means nothing, so that
//      is a failure too.
//   3. TEST: load the pages as committed (styles.css?v=<hash>). Every one of the
//      four files must have been fetched under its stamped URL, none of the old
//      marks may show, and the icons, list and header must be the current ones.
//
// What it cannot show: GitHub's CDN ignores the query string, so a stamp protects
// the visitor's browser cache, not the CDN's copy (see stamp.js).
//
// iOS Chrome runs on WebKit, so `ENGINE=webkit node verify/stale-cache.js` repeats
// the run there. The pages ask the browser to upgrade plain http to https, which
// WebKit applies even to localhost; the server removes that one directive from the
// pages it serves under ENGINE=webkit so the plain-http server still works.
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ENGINE = process.env.ENGINE || 'chromium';
const { pinBg } = require('./_common');
const launch = ENGINE === 'chromium'
  ? require('./_common').launch
  : () => require('playwright')[ENGINE].launch();

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = ['tokens.css', 'colors_and_type.css', 'styles.css', 'app.js'];
const HOME_ONLY = ['hero-bg.css', 'hero-bg.js'];   // linked by index.html only (see stamp.js)
const ALL = ASSETS.concat(HOME_ONLY);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

// What each old file does to the new markup. The real old styles.css did the
// equivalent of the icon rule by not styling .icon at all.
const OLD_FILES = {
  'tokens.css': '/* old tokens */',
  'colors_and_type.css': 'ul{list-style:disc;padding-left:40px}',
  'styles.css': '.icon{width:380px;height:380px;fill:#000}',
  'app.js': "document.documentElement.setAttribute('data-stale-app', '1');",
  'hero-bg.css': '.hero{outline:9px solid #f0f}',
  'hero-bg.js': "document.documentElement.setAttribute('data-stale-hero', '1');",
};
const OLD_HTML = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>old</title>' +
  ALL.map((a) => (a.endsWith('.css') ? `<link rel="stylesheet" href="${a}">` : `<script src="${a}"></script>`)).join('') +
  '</head><body><main><p>old build</p></main></body></html>';

const PAGES_TO_TRY = ['index.html', 'services.html', 'about.html'];
const STRIP_UPGRADE = ENGINE !== 'chromium';
const STAMPS = new RegExp(`((?:href|src)="(?:${ALL.map((a) => a.replace(/\./g, '\\.')).join('|')}))\\?v=[0-9a-f]+"`, 'g');
let mode = 'old';           // 'old' serves the primed build, 'new' serves the repo
const hits = [];            // every request the server actually received

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const name = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
  hits.push(`${mode} ${name}${url.search}`);
  const isPage = name.endsWith('.html');
  // Assets are cacheable for a year; pages are always revalidated.
  res.setHeader('cache-control', isPage ? 'no-store' : 'public, max-age=31536000');
  if (mode === 'old') {
    if (isPage) { res.setHeader('content-type', TYPES['.html']); return res.end(OLD_HTML); }
    if (OLD_FILES[name] !== undefined) {
      res.setHeader('content-type', TYPES[path.extname(name)]);
      return res.end(OLD_FILES[name]);
    }
  }
  const file = path.join(ROOT, name);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
  if (isPage) {
    let html = fs.readFileSync(file, 'utf8');
    if (req.headers['x-strip-stamps']) html = html.replace(STAMPS, '$1"');
    if (STRIP_UPGRADE) html = html.replace(/;?\s*upgrade-insecure-requests/, '');
    return res.end(html);
  }
  res.end(fs.readFileSync(file));
});

const hashOf = (f) => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await launch();
  let failures = 0;
  const say = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

  const measure = (page) => page.evaluate(() => {
    const icon = document.querySelector('main .icon, .site-header .icon');
    const cs = (e, p) => (e ? getComputedStyle(e)[p] : null);
    const ul = document.querySelector('main ul');
    return {
      icon: icon ? Math.round(icon.getBoundingClientRect().width) : null,
      header: cs(document.querySelector('.site-header'), 'position'),
      bullet: ul ? cs(ul, 'listStyleType') : null,
      staleApp: document.documentElement.hasAttribute('data-stale-app'),
      staleHero: document.documentElement.hasAttribute('data-stale-hero'),
      heroOutline: document.querySelector('.hero') ? getComputedStyle(document.querySelector('.hero')).outlineStyle : null,
      sheets: [...document.styleSheets].map((s) => (s.href || '').replace(/^.*\//, '')),
      scripts: [...document.scripts].map((s) => s.getAttribute('src')).filter(Boolean),
    };
  });

  for (const p of PAGES_TO_TRY) {
    for (const variant of ['control', 'test']) {
      // One context per run: a fresh in-memory cache, primed with the old build.
      const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
      await ctx.addInitScript(pinBg);   // the hero background is drawn at random per visit; pin it so the home page is the same one every run
      const page = await ctx.newPage();
      mode = 'old';
      await page.goto(base + p, { waitUntil: 'load' });         // primes the cache
      mode = 'new';
      if (variant === 'control') await ctx.setExtraHTTPHeaders({ 'x-strip-stamps': '1' });
      hits.length = 0;
      await page.goto(base + p, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const m = await measure(page);

      if (variant === 'control') {
        // The OLD stylesheet is the one in use (its 380px icons), straight from the
        // cache: the harness reproduces the bug, and for the reason intended.
        const fromCache = !hits.some((h) => h === 'new styles.css');
        say(m.icon === 380 && fromCache,
          `control ${p}: unstamped page keeps the old stylesheet (icon ${m.icon}px, header ${m.header}, styles.css refetched: ${!fromCache})`);
      } else {
        const wanted = p === 'index.html' ? ALL : ASSETS;
        const missing = wanted.filter((a) => !hits.includes(`new ${a}?v=${hashOf(a)}`));
        say(missing.length === 0, `${p}: all ${wanted.length} files it links were fetched under their stamped URL${missing.length ? ` (not fetched: ${missing.join(', ')})` : ''}`);
        if (p !== 'index.html') {
          const strays = HOME_ONLY.filter((a) => hits.some((h) => h.startsWith(`new ${a}`)));
          say(strays.length === 0, `${p}: the home-only files were not requested${strays.length ? ` (requested: ${strays.join(', ')})` : ''}`);
        }
        const applied = wanted.filter((a) => a.endsWith('.css')).every((a) => m.sheets.includes(`${a}?v=${hashOf(a)}`)) &&
          wanted.filter((a) => a.endsWith('.js')).every((a) => m.scripts.includes(`${a}?v=${hashOf(a)}`));
        say(applied, `${p}: the applied stylesheets and scripts carry the stamps of the files on disk`);
        const listOk = m.bullet === null || m.bullet === 'none';
        const heroOk = p !== 'index.html' || (!m.staleHero && (m.heroOutline === null || m.heroOutline === 'none'));
        say(m.icon !== null && m.icon <= 100 && m.header === 'sticky' && listOk && !m.staleApp && heroOk,
          `${p}: nothing of the old build shows (icon ${m.icon}px, header ${m.header}, list ${m.bullet}, old app.js ${m.staleApp ? 'ran' : 'did not run'}${p === 'index.html' ? `, old hero files ${heroOk ? 'absent' : 'showing'}` : ''})`);
      }
      await ctx.close();
    }
  }

  await browser.close();
  server.close();
  console.log(failures === 0
    ? `stale-cache (${ENGINE}): a cached old copy of the shared files cannot be paired with the new pages`
    : `stale-cache (${ENGINE}): ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
