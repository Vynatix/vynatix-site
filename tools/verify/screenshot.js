// Visual-regression gate. Capture a baseline before a refactor, then compare after.
//   node verify/screenshot.js baseline | current | compare
// Animations are disabled during capture so the marquee cannot cause false diffs.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PAGES, BASE, launch } = require('./_common');

const MODE = process.argv[2] || 'current';
const SUFFIX = process.env.SUFFIX || '';
const OUT = path.join(__dirname, '..', (MODE === 'compare' ? 'current' : MODE) + SUFFIX);
const THEMES = ['light', 'dark'];
const VIEWPORT = {
  width: Number(process.env.VW) || 1440,
  height: Number(process.env.VH) || 900,
};

async function capture() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  for (const p of PAGES) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      const page = await ctx.newPage();
      // Pin the theme before first paint so we never capture a mid-toggle frame.
      await page.addInitScript((t) => {
        try { localStorage.setItem('vynatix-theme', t); } catch (e) { /* no-op */ }
      }, theme);
      await page.goto(BASE + p, { waitUntil: 'load', timeout: 20000 });
      await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) { /* no-op */ } });
      await page.waitForTimeout(300);
      const file = path.join(OUT, `${p.replace(/\.html$/, '')}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
      console.log(`  captured ${path.basename(file)}`);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${PAGES.length * THEMES.length} screenshots written to ${OUT}`);
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function compare() {
  const baseDir = path.join(__dirname, '..', 'baseline' + SUFFIX);
  const curDir = path.join(__dirname, '..', 'current' + SUFFIX);
  if (!fs.existsSync(baseDir)) {
    console.error('No baseline/ — run `node verify/screenshot.js baseline` first.');
    process.exit(1);
  }
  let pixelmatch, PNG;
  try {
    pixelmatch = require('pixelmatch');
    PNG = require('pngjs').PNG;
  } catch (e) {
    console.log('(pixelmatch/pngjs not installed — falling back to exact hash comparison)\n');
  }
  const diffDir = path.join(__dirname, '..', 'diff');
  if (pixelmatch) fs.mkdirSync(diffDir, { recursive: true });

  let changed = 0;
  for (const f of fs.readdirSync(baseDir).filter((f) => f.endsWith('.png'))) {
    const a = path.join(baseDir, f), b = path.join(curDir, f);
    if (!fs.existsSync(b)) { console.log(`MISSING  ${f}`); changed++; continue; }
    if (sha(a) === sha(b)) { console.log(`same     ${f}`); continue; }

    if (!pixelmatch) { console.log(`CHANGED  ${f} (bytes differ)`); changed++; continue; }
    const imgA = PNG.sync.read(fs.readFileSync(a));
    const imgB = PNG.sync.read(fs.readFileSync(b));
    if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
      console.log(`CHANGED  ${f} (size ${imgA.width}x${imgA.height} -> ${imgB.width}x${imgB.height})`);
      changed++;
      continue;
    }
    const diff = new PNG({ width: imgA.width, height: imgA.height });
    const px = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold: 0.1 });
    if (px === 0) { console.log(`same     ${f} (encoding differs, pixels identical)`); continue; }
    fs.writeFileSync(path.join(diffDir, f), PNG.sync.write(diff));
    const pct = ((px / (imgA.width * imgA.height)) * 100).toFixed(3);
    console.log(`CHANGED  ${f} — ${px} px (${pct}%) -> diff/${f}`);
    changed++;
  }
  console.log(changed === 0 ? '\nPASS — no visual change' : `\n${changed} screenshot(s) changed — review before continuing`);
  process.exit(changed === 0 ? 0 : 1);
}

(async () => {
  if (MODE === 'compare') compare();
  else await capture();
})().catch((e) => { console.error(e); process.exit(1); });
