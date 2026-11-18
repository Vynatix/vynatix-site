// Writes the masks of the silk background (styles.css, Silk waves): assets/silk-light.png and
// assets/silk-shade.png, and the grain tile assets/silk-grain.png (described where it is written, below). Each is a few soft folds drawn as blurred strokes; only the alpha is used (the colour
// comes from a role token in styles.css). They are small rasters on purpose: the first version masked with the
// SVG itself, and re-rendering its 38px blur over a full-screen layer stalled a theme toggle for a third of a
// second. A 480x300 image scaled up is as soft and costs almost nothing to repaint.
//
//   cd tools && node silk-masks.js        (needs Playwright; never run at deploy time)
//
// If the shapes change, give the files new names (images carry no version stamp) and re-measure text contrast
// as AGENTS.md, Silk waves, describes.
const fs = require('fs');
const path = require('path');
const { launch } = require('./verify/_common');

const W = 480, H = 300;
const FOLDS = {
  'silk-light.png': [
    ['M-200 180 C 300 -40, 700 420, 1100 180 S 1700 120, 1900 320', 110, 0.85],
    ['M-200 520 C 250 380, 620 760, 1020 520 S 1600 360, 1900 640', 140, 0.7],
    ['M-200 880 C 380 700, 760 1080, 1180 820 S 1650 760, 1900 940', 120, 0.8],
    ['M300 -150 C 520 220, 240 560, 620 1150', 70, 0.45],
  ],
  'silk-shade.png': [
    ['M-200 340 C 320 160, 680 600, 1080 350 S 1640 240, 1900 480', 120, 0.8],
    ['M-200 700 C 300 560, 700 920, 1100 680 S 1620 560, 1900 800', 150, 0.65],
    ['M-200 40 C 360 -120, 760 240, 1200 20 S 1700 -20, 1900 140', 100, 0.6],
    ['M1150 -150 C 1380 260, 1080 600, 1460 1150', 80, 0.5],
  ],
};
const svg = (folds) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="${W}" height="${H}" preserveAspectRatio="none">
<defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="38"/></filter></defs>
<g fill="none" stroke="#fff" stroke-linecap="round" filter="url(#b)">${folds.map(([d, w, o]) => `<path d="${d}" stroke-width="${w}" opacity="${o}"/>`).join('')}</g></svg>`;

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const [name, folds] of Object.entries(FOLDS)) {
    await page.setContent(`<!doctype html><body style="margin:0;background:transparent">${svg(folds)}</body>`);
    const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
    fs.writeFileSync(path.join(__dirname, '..', 'assets', name), buf);
    console.log(`wrote assets/${name} (${buf.length} bytes)`);
  }
  await browser.close();

  // The grain: a 128x128 tile of white whose alpha is random between 0 and GRAIN of 255, laid over each fold mask
  // (styles.css composites the two masks). The folds span only 10 to 25 brightness levels across hundreds of
  // pixels, so without it every level shows as a stripe (colour banding); the grain moves each pixel's alpha by
  // up to about one output level, which dithers the stripes away. A fixed seed, so the file is reproducible.
  const { PNG } = require('pngjs');
  const N = 128, GRAIN = 28;
  const png = new PNG({ width: N, height: N });
  let seed = 0x5117c0de;
  const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  for (let i = 0; i < N * N * 4; i += 4) { png.data[i] = png.data[i + 1] = png.data[i + 2] = 255; png.data[i + 3] = Math.floor(rnd() * (GRAIN + 1)); }
  const grain = PNG.sync.write(png);
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'silk-grain.png'), grain);
  console.log(`wrote assets/silk-grain.png (${grain.length} bytes)`);
})().catch((e) => { console.error(e); process.exit(1); });
