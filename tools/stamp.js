// Version stamps for the four files every page loads: tokens.css,
// colors_and_type.css, styles.css and app.js.
//
// Why this exists. GitHub Pages serves every file at a fixed URL with
// Cache-Control: max-age=600, and nothing forces a browser to refetch a
// stylesheet when the page that uses it changes. After a redesign a phone can
// hold the NEW html next to the OLD styles.css: icons render at full width in
// black, lists get default bullets, the header loses its layout. (That is
// exactly what iOS Chrome showed after the design-system migration.) Putting a
// short hash of each file's content in the URL (styles.css?v=1a2b3c4d) makes the
// html name the exact stylesheet it was written for: a changed file is a URL the
// visitor's browser has never cached.
//
// What this does NOT cover. GitHub's CDN ignores the query string (it keys on the
// path), so it can still answer a new stamp with the previous bytes until its own
// copy is replaced; a deploy replaces it, and the html it serves is the same age.
// And the opposite pairing, an OLD html page next to the NEW stylesheet, cannot be
// fixed on a host that keeps one file per path. Fonts and images are not stamped
// either: they are replaced in place under fixed names, and app.js preloads fonts
// by the plain URL the @font-face rule uses, which the two must keep identical to
// be reused. If a font or image ever changes in a way a stale copy would make
// visible (glyph coverage, metrics, a different picture), give it a new file name
// and change it in tokens.css and in app.js's DISPLAY_FACES together.
//
// Usage, from tools/:
//   node stamp.js           rewrite the stamps in every root *.html page
//   node stamp.js --check   exit 1 if any stamp is missing or out of date
//
// Run it after any change to one of the four files, then commit the pages with
// the change. `npm run check` fails until you do.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = ['tokens.css', 'colors_and_type.css', 'styles.css', 'app.js'];

// Hash the text with line endings normalised, so a Windows checkout with
// autocrlf computes the same stamp as the LF files GitHub Pages serves.
function stampOf(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
}

const stamps = Object.fromEntries(ASSETS.map((a) => [a, stampOf(a)]));
const escaped = ASSETS.map((a) => a.replace(/\./g, '\\.')).join('|');
// href="styles.css" or href="styles.css?v=abc123", on a <link> or a <script src>.
const REF = new RegExp(`((?:href|src)=")(${escaped})(\\?v=[0-9a-f]*)?(")`, 'g');

const args = process.argv.slice(2);
if (args.some((a) => a !== '--check')) {
  console.error('usage: node stamp.js [--check]');
  process.exit(2);
}
const check = args.includes('--check');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
let problems = 0;
let changed = 0;

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const found = new Set();
  const out = html.replace(REF, (m, pre, asset, old, post) => {
    found.add(asset);
    const want = `?v=${stamps[asset]}`;
    if (check && old !== want) {
      problems++;
      console.log(`STALE   ${page}: ${asset}${old || ''} should be ${asset}${want}`);
    }
    return pre + asset + want + post;
  });
  for (const a of ASSETS) {
    if (!found.has(a)) { problems++; console.log(`MISSING ${page} never loads ${a}`); }
  }
  if (!check && out !== html) {
    fs.writeFileSync(path.join(ROOT, page), out);
    changed++;
  }
}

if (check) {
  console.log(`${pages.length} pages checked, ${problems} stamp problem${problems === 1 ? '' : 's'}${problems ? ' (run: node stamp.js)' : ''}`);
  process.exit(problems === 0 ? 0 : 1);
}
console.log(`stamped ${pages.length} pages (${changed} changed): ${ASSETS.map((a) => `${a}?v=${stamps[a]}`).join('  ')}`);
process.exit(problems === 0 ? 0 : 1);
