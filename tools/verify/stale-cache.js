// Proves a browser holding an OLD copy of the site's stylesheet cannot be paired
// with the NEW page: the failure iOS Chrome showed after the design-system
// migration (new html, old styles.css: icons at full width in black, default
// list bullets, an unstyled header).
//
// It runs its own server, so it needs no `python3 -m http.server`. The server
// lets assets live in the browser cache for a year (an exaggeration of
// GitHub Pages' ten minutes, so nothing here depends on timing) and keeps the
// html fresh, like a visitor whose page has expired but whose stylesheet has not.
//
//   1. Prime the browser cache with an old build: html plus a stylesheet that
//      knows nothing about this markup, under the plain URLs (styles.css).
//   2. CONTROL: load the current pages with the version stamps removed. This
//      must break. If it does not, the harness no longer reproduces the failure
//      and the result below means nothing, so that is a failure too.
//   3. TEST: load the pages as committed (styles.css?v=<hash>). The icons, the
//      list and the header must come out as the current styles.css makes them.
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { launch } = require('./_common');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = ['tokens.css', 'colors_and_type.css', 'styles.css', 'app.js'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

// What the old build's files do to the new markup: size every icon at 380px,
// black. (The real old styles.css did the equivalent by not styling .icon at all.)
const OLD_FILES = {
  'tokens.css': '/* old tokens */',
  'colors_and_type.css': '/* old system */',
  'styles.css': '.icon{width:380px;height:380px;fill:#000}',
  'app.js': '/* old app */',
};
const OLD_HTML = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>old</title>' +
  ASSETS.map((a) => (a.endsWith('.css') ? `<link rel="stylesheet" href="${a}">` : `<script src="${a}"></script>`)).join('') +
  '</head><body><main><p>old build</p></main></body></html>';

const PAGES_TO_TRY = ['index.html', 'services.html', 'about.html'];
let mode = 'old';           // 'old' serves the primed build, 'new' serves the repo
const hits = [];            // every request the server actually received

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let name = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
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
  if (isPage && req.headers['x-strip-stamps']) {
    const strip = new RegExp(`((?:href|src)="(?:${ASSETS.map((a) => a.replace(/\./g, '\\.')).join('|')}))\\?v=[0-9a-f]+"`, 'g');
    return res.end(fs.readFileSync(file, 'utf8').replace(strip, '$1"'));
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
      sheets: [...document.styleSheets].map((s) => (s.href || '').replace(/^.*\//, '')),
    };
  });

  for (const p of PAGES_TO_TRY) {
    // One context per page: a fresh in-memory cache, primed with the old build.
    for (const variant of ['control', 'test']) {
      const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
      const page = await ctx.newPage();
      mode = 'old';
      await page.goto(base + p, { waitUntil: 'load' });         // primes the cache
      mode = 'new';
      if (variant === 'control') await ctx.setExtraHTTPHeaders({ 'x-strip-stamps': '1' });
      hits.length = 0;
      await page.goto(base + p, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const m = await measure(page);
      const refetchedStyles = hits.some((h) => h.startsWith('new styles.css?v='));
      const broken = m.icon === null || m.icon > 100 || m.header !== 'sticky';

      if (variant === 'control') {
        // The old stylesheet is still being used: the harness reproduces the bug.
        say(broken && !refetchedStyles, `control ${p}: unstamped page keeps the old stylesheet (icon ${m.icon}px, header ${m.header}, sheets ${m.sheets.filter((s) => /styles/.test(s)).join(',')})`);
      } else {
        say(!broken && refetchedStyles, `${p}: stamped page fetches the current stylesheet past the cache (icon ${m.icon}px, header ${m.header}, list ${m.bullet})`);
        say(m.sheets.includes(`styles.css?v=${hashOf('styles.css')}`), `${p}: the applied styles.css carries the stamp of the file on disk`);
      }
      await ctx.close();
    }
  }

  await browser.close();
  server.close();
  console.log(failures === 0 ? 'stale-cache: a cached old stylesheet cannot be paired with the new pages' : `stale-cache: ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
