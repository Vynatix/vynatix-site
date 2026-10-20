// Visual-regression gate. Capture a baseline before a refactor, then compare after.
//   node verify/screenshot.js baseline | current | compare
//   node verify/screenshot.js bar
// Animations are disabled during capture so the marquee cannot cause false diffs.
//
// The pages are captured armed (armGa, so nothing real is contacted) with the consent answer pinned to denied:
// the consent bar never enters the baseline, so a diff is a change to the page, not to whether a bar happens to
// be up. The footer's Cookie settings link is part of the page and does show.
//
// The home page is captured once for each hero background under test (BGS, default all
// four), as index-<theme>-<bg>.png; every other page once, as <page>-<theme>.png. The
// draw is always pinned (a weave with its fixed seed, a dial at rest, an iris still
// waiting: a capture takes seconds, the iris opens after twenty seconds of silence),
// so the same tree gives the same pixels. Changing the home page changes its files by
// design: regenerate those baselines deliberately, not the other pages'.
//
// `bar` is a separate mode for looking at the bar itself, viewport only (not full page), in each theme under
// test: first visit, the bar reopened from the footer, and a first visit scrolled to the end of the page (the
// footer against the bar). Pages index.html and sv.html at 390x844 and 1440x900, or VW x VH. It writes to
// current-bar/ for review by eye and is not part of `compare`. The hero background is pinned to the sheet there
// (pinTheme's default), not looped: the bar is a fixed card with its own opaque surface, whichever background sits behind it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PAGES, BASE, THEMES, bgsFor, pinTheme, pinConsent, armGa, launch } = require('./_common');

const MODE = process.argv[2] || 'current';
const SUFFIX = process.env.SUFFIX || '';
const OUT = path.join(__dirname, '..', (MODE === 'compare' ? 'current' : MODE === 'bar' ? 'current-bar' : MODE) + SUFFIX);
const VIEWPORT = {
  width: Number(process.env.VW) || 1440,
  height: Number(process.env.VH) || 900,
};

async function capture() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  let shots = 0;
  for (const p of PAGES) {
    for (const theme of THEMES) for (const bg of bgsFor(p)) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      await armGa(ctx);
      const page = await ctx.newPage();
      // Pin the theme before first paint (the site otherwise draws a colour scheme at
      // random per visit) so every capture is the same theme, never a mid-toggle frame.
      await page.addInitScript(pinTheme, { theme, bg });
      await page.addInitScript(pinConsent, 'denied');
      await page.goto(BASE + p, { waitUntil: 'load', timeout: 20000 });
      await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) { /* no-op */ } });
      // The pinned answer is what keeps the bar out of the baseline; if the pin stops working (the stored format
      // changed), say so rather than capture a bar and call every page changed.
      if (await page.evaluate(() => !!document.getElementById('consent-bar'))) {
        throw new Error(`${p} [${theme}${bg ? ' ' + bg : ''}]: the consent bar is up although the answer is pinned to denied; check pinConsent in _common.js against app.js`);
      }
      // Force every image to load and decode before capturing. fullPage grows the
      // viewport after this point, so loading="lazy" covers would otherwise still
      // be racing the screenshot and produce false diffs on an unchanged page.
      // This only affects the capture, never the shipped markup.
      await page.evaluate(async () => {
        const imgs = [...document.images];
        imgs.forEach((img) => { img.loading = 'eager'; });
        await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
      });
      // Show every section in full. styles.css lets the browser skip the sections below
      // the home pages' hero (content-visibility: auto), and a skipped section has only a
      // placeholder height until it has been shown, then a remembered height that can sit
      // a fraction of a pixel off the laid-out one. A capture would record either, and this
      // gate compares the design, not the browser's bookkeeping. (CSSOM, not markup, so
      // style-src 'self' allows it.) That rule's own rendering is checked by hand: scroll
      // the page and confirm the sections look the same as with the rule off.
      await page.evaluate(() => {
        document.querySelectorAll('main > section').forEach((s) => s.style.setProperty('content-visibility', 'visible'));
      });
      await page.waitForTimeout(300);
      const file = path.join(OUT, `${p.replace(/\.html$/, '')}-${theme}${bg ? '-' + bg : ''}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
      console.log(`  captured ${path.basename(file)}`);
      shots++;
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${shots} screenshots written to ${OUT}`);
}

// The bar itself, viewport only: first visit, reopened, and a first visit scrolled to the end of the page.
async function captureBar() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const viewports = process.env.VW || process.env.VH ? [[VIEWPORT.width, VIEWPORT.height]] : [[390, 844], [1440, 900]];
  let n = 0;
  for (const p of ['index.html', 'sv.html']) for (const theme of THEMES) for (const [w, h] of viewports) {
    for (const state of ['first', 'reopened', 'first-end']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      await armGa(ctx);
      const page = await ctx.newPage();
      await page.addInitScript(pinTheme, theme);
      if (state === 'reopened') await page.addInitScript(pinConsent, 'denied');
      await page.goto(BASE + p, { waitUntil: 'load', timeout: 20000 });
      await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) { /* no-op */ } });
      if (state === 'reopened') {
        await page.evaluate(() => document.querySelector('[data-consent-open]').scrollIntoView({ block: 'center' }));
        await page.click('[data-consent-open]');
        await page.evaluate(() => scrollTo(0, 0));
      }
      if (state === 'first-end') await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      const file = path.join(OUT, `${p.replace(/\.html$/, '')}-${theme}-${w}x${h}-${state}.png`);
      await page.screenshot({ path: file, fullPage: false, animations: 'disabled', caret: 'hide' });
      console.log(`  captured ${path.basename(file)}`);
      n++;
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${n} bar screenshots written to ${OUT}`);
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
    // pixelmatch v7+ ships as ESM; require() hands back the namespace object.
    pixelmatch = require('pixelmatch');
    pixelmatch = pixelmatch.default || pixelmatch;
    PNG = require('pngjs').PNG;
  } catch (e) {
    console.log('(pixelmatch/pngjs not installed — falling back to exact hash comparison)\n');
  }
  const diffDir = path.join(__dirname, '..', 'diff' + SUFFIX);
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
  else if (MODE === 'bar') await captureBar();
  else await capture();
})().catch((e) => { console.error(e); process.exit(1); });
