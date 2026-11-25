// Visual-regression gate. Capture a baseline before a refactor, then compare after. Scope: all for `against`, root
// for baseline and current, as below.
//   node verify/screenshot.js baseline | current | compare
//   node verify/screenshot.js bar
//   node verify/screenshot.js against [rev]
// Animations are disabled during capture so the marquee cannot cause false diffs.
//
// The pages are captured armed (armGa, so nothing real is contacted) with the consent answer pinned to denied:
// the consent bar never enters the baseline, so a diff is a change to the page, not to whether a bar happens to
// be up. The footer's Cookie settings link is part of the page and does show.
//
// Every root page is captured once per theme, as <page>-<theme>.png. The home hero's drafting
// sheet is still and always drawn, so the same tree gives the same pixels.
//
// The scope: for `against`, the root pages and the generated pages of either tree; for baseline and current, the
// root pages, the stored baseline that `against` replaces; and for `bar`, the home page of each written language.
//
// `bar` is a separate mode for looking at the bar itself, viewport only (not full page), in each theme under
// test: first visit, the bar reopened from the footer, and a first visit scrolled to the end of the page (the
// footer against the bar). The home page of each written language (writtenHomes() in _common.js: index.html and
// sv.html) at 390x844 and 1440x900, or VW x VH. It writes to current-bar/ for review by eye and is not part of
// `compare`.
//
// `against` is the visual net on demand, for a refactoring pull request, and keeps no stored baseline. It checks
// rev out into a temporary git worktree (git worktree add --detach; default rev: the merge base of HEAD and
// origin/main), serves that tree and this working tree, uncommitted changes included, each on a free port of its
// own (python3 -m http.server; BASE is not used), and captures every page in both exactly as the modes above
// capture: armed, the answer pinned to denied, the pause stored, images decoded, every section shown, the same
// settling. Each page is captured full page at 390x844 and at 1440x900 (or at VW x VH alone). The pages are the
// root pages (pagesIn('root') in _common.js) and the generated pages of either tree (generatedPages()), 114 today, and
// PAGES=index.html,es/about.html narrows them. The themes are those of THEMES, but with THEMES unset it runs the
// first theme only, mono-light (THEMES=mono-light,mono-dark runs both). Each pair is compared with pixelmatch at
// the threshold `compare` uses, and the run prints every page, width and theme that differs, and any page that
// exists in one tree only. For each pair that differs it writes the diff image, <page>-<theme>-<width>x<height>
// .diff.png, beside the two captures (.rev.png from rev, .tree.png from this tree) under diff-against/
// (gitignored; emptied at the start of a run; SUFFIX applies). Two captures of different height (a layout change
// usually moves the page's height) are compared on the taller canvas, so the part one of them lacks shows in the
// diff as changed. It exits 1 on any difference, 0 on none, 2 on a wrong argument.
// The worktree and the two servers are removed at the end, on a failure and on Ctrl-C too. The rev must carry
// the consent module (one var GA_ID and one var PURGE_ONLY line in app.js), as for a baseline. A full run, 456
// captures in one theme, took 9 minutes 40 seconds in series on a 4-core machine (24 November 2026), about 1.3
// seconds a capture; JOBS=n compares n pairs at a time (default 1; 2 saved a fifth of the time). Not in
// `npm run check`.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const { ROOT, BASE, THEMES, ALL_THEMES, pinTheme, pinConsent, armGa, launch, generatedPages, pagesIn, writtenHomes, scopeLine, edgeCsp, pool } = require('./_common');

const PAGES = pagesIn('root');

const MODE = process.argv[2] || 'current';
const SUFFIX = process.env.SUFFIX || '';
const OUT = path.join(__dirname, '..', (MODE === 'compare' ? 'current' : MODE === 'bar' ? 'current-bar' : MODE) + SUFFIX);
const VIEWPORT = {
  width: Number(process.env.VW) || 1440,
  height: Number(process.env.VH) || 900,
};

// One full-page capture, the same in every mode that compares: a fresh context at the viewport, armed (armGa, so
// nothing real is contacted), the theme and the consent answer pinned before first paint, then the settling below.
// o.base is the address of the tree to load (default BASE) and o.csp the policy armGa writes into a page that
// lacks the widened one (default armGa's own 'auto'); `against` sets both, because it serves two trees at once.
// o.file writes the PNG there; the PNG is returned either way. o.label names the capture in an error.
async function shoot(browser, p, theme, viewport, o = {}) {
  const base = o.base || BASE;
  const label = o.label || `${p} [${theme}]`;
  const ctx = await browser.newContext({ viewport });
  try {
    await armGa(ctx, o.csp ? { base, csp: o.csp } : { base });
    const page = await ctx.newPage();
    // Pin the theme before first paint (the site otherwise draws a colour scheme at
    // random per visit) so every capture is the same theme, never a mid-toggle frame.
    await page.addInitScript(pinTheme, theme);
    await page.addInitScript(pinConsent, 'denied');
    await page.goto(base + p, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) { /* no-op */ } });
    // The pinned answer is what keeps the bar out of the baseline; if the pin stops working (the stored format
    // changed), say so rather than capture a bar and call every page changed.
    if (await page.evaluate(() => !!document.getElementById('consent-bar'))) {
      throw new Error(`${label}: the consent bar is up although the answer is pinned to denied; check pinConsent in _common.js against app.js`);
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
    return await page.screenshot(Object.assign(o.file ? { path: o.file } : {}, { fullPage: true, animations: 'disabled', caret: 'hide' }));
  } finally {
    await ctx.close();
  }
}

async function capture() {
  console.log(scopeLine('root', PAGES));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  let shots = 0;
  for (const p of PAGES) {
    for (const theme of THEMES) {
      const file = path.join(OUT, `${p.replace(/\.html$/, '')}-${theme}.png`);
      await shoot(browser, p, theme, VIEWPORT, { file });
      console.log(`  captured ${path.basename(file)}`);
      shots++;
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
  const homes = writtenHomes();
  console.log(scopeLine('root', homes, { feature: 'the home page of each written language, with the bar up' }));
  for (const p of homes) for (const theme of THEMES) for (const [w, h] of viewports) {
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

// pixelmatch's colour threshold per pixel, the same in `compare` and in `against`.
const THRESHOLD = 0.1;

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
    const px = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold: THRESHOLD });
    if (px === 0) { console.log(`same     ${f} (encoding differs, pixels identical)`); continue; }
    fs.writeFileSync(path.join(diffDir, f), PNG.sync.write(diff));
    const pct = ((px / (imgA.width * imgA.height)) * 100).toFixed(3);
    console.log(`CHANGED  ${f} — ${px} px (${pct}%) -> diff/${f}`);
    changed++;
  }
  console.log(changed === 0 ? '\nPASS — no visual change' : `\n${changed} screenshot(s) changed — review before continuing`);
  process.exit(changed === 0 ? 0 : 1);
}

// --- against: this working tree and a git revision, captured in the same run -----------------

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function usage(msg) {
  console.error(`screenshot.js against: ${msg}`);
  process.exit(2);
}

// What `against` has to undo however the run ends: the two servers it started and the worktree it added. It is
// synchronous, so it also runs from the exit event and from the signal handlers, and running it twice is harmless.
const temp = { servers: [], worktree: null, dir: null };
function cleanUp() {
  for (const s of temp.servers.splice(0)) {
    try { s.kill(); } catch (e) { /* already gone */ }
  }
  if (temp.worktree) {
    const wt = temp.worktree;
    temp.worktree = null;
    // Forced twice, because git locks a worktree while it is being added, and an interrupted add leaves it locked.
    try { git(['worktree', 'remove', '--force', '--force', wt]); } catch (e) {
      // Not a worktree yet, or half made: delete what is there and let git drop the entry it no longer finds.
      fs.rmSync(wt, { recursive: true, force: true });
      try { git(['worktree', 'prune']); } catch (e2) { /* nothing more can be done here */ }
    }
  }
  if (temp.dir) {
    fs.rmSync(temp.dir, { recursive: true, force: true });
    temp.dir = null;
  }
}

// Serves a tree with Python's own server, as tools/README.md serves the site, on a port the system picks (port 0),
// which the server prints in its first line once it is listening. Resolves to the tree's address.
function serve(root) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', root],
      { stdio: ['ignore', 'pipe', 'ignore'] });
    temp.servers.push(child);
    const timer = setTimeout(() => reject(new Error(`python3 -m http.server did not start for ${root}`)), 15000);
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`cannot start python3 -m http.server: ${e.message}`)); });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`python3 -m http.server for ${root} stopped (exit ${code})`)); });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      const m = /port (\d+)/.exec(out);
      if (m) { clearTimeout(timer); resolve(`http://127.0.0.1:${m[1]}/`); }
    });
  });
}

// A copy of a capture on a larger canvas, the part it lacks filled with opaque magenta, a colour no page has, so
// that two captures of different height (a layout change usually changes the page's height) can still be compared
// pixel by pixel and the missing part counts, and shows in the diff, as changed.
function onCanvas(PNG, img, width, height) {
  if (img.width === width && img.height === height) return img;
  const out = new PNG({ width, height });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 255; out.data[i + 3] = 255;
  }
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

// Compares two PNG buffers. Returns null when they show the same pixels, otherwise what differs and the diff image.
function differs(PNG, pixelmatch, a, b) {
  if (a.equals(b)) return null;
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  const width = Math.max(A.width, B.width);
  const height = Math.max(A.height, B.height);
  const diff = new PNG({ width, height });
  const px = pixelmatch(onCanvas(PNG, A, width, height).data, onCanvas(PNG, B, width, height).data, diff.data, width, height, { threshold: THRESHOLD });
  const resized = A.width !== B.width || A.height !== B.height;
  if (px === 0 && !resized) return null;
  return { px, pct: ((px / (width * height)) * 100).toFixed(3), resized, a: `${A.width}x${A.height}`, b: `${B.width}x${B.height}`, diff: PNG.sync.write(diff) };
}

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function elapsed(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

async function against() {
  const t0 = Date.now();
  let pixelmatch, PNG;
  try {
    pixelmatch = require('pixelmatch');
    pixelmatch = pixelmatch.default || pixelmatch;
    PNG = require('pngjs').PNG;
  } catch (e) {
    usage('needs pixelmatch and pngjs (npm install in tools/)');
  }
  if (process.argv.length > 4) usage('takes at most one revision: node verify/screenshot.js against [rev]');
  const jobsN = process.env.JOBS === undefined ? 1 : Number(process.env.JOBS);
  if (!Number.isInteger(jobsN) || jobsN < 1) usage(`JOBS must be a whole number of 1 or more, not "${process.env.JOBS}"`);

  // The revision: the one named, or the merge base of HEAD and origin/main, which is what a pull request is merged onto.
  let rev = process.argv[3];
  let how = '';
  if (!rev) {
    try { git(['rev-parse', '--verify', '--quiet', 'origin/main^{commit}']); } catch (e) {
      usage('there is no origin/main here to take the merge base with: run git fetch origin main, or name the revision');
    }
    rev = git(['merge-base', 'HEAD', 'origin/main']);
    how = ', the merge base of HEAD and origin/main';
  }
  let sha = '';
  try { sha = git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]); } catch (e) { usage(`"${rev}" is not a commit here`); }
  const short = sha.slice(0, 7);

  const themes = process.env.THEMES ? THEMES : [ALL_THEMES[0]];
  const viewports = process.env.VW || process.env.VH ? [VIEWPORT] : [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
  const sizes = viewports.map((v) => `${v.width}x${v.height}`);

  // From here on there is something to remove, so every way out of the process removes it.
  process.on('exit', cleanUp);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(sig, () => {
      console.error(`\n${sig}: stopping, and removing the temporary worktree and the two servers`);
      cleanUp();
      process.exit(128 + os.constants.signals[sig]);
    });
  }
  temp.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vynatix-against-'));
  temp.worktree = path.join(temp.dir, 'tree');
  try { git(['worktree', 'add', '--detach', temp.worktree, sha]); } catch (e) {
    throw new Error(`git worktree add failed: ${String(e.stderr || e.message).trim()}`);
  }
  const trees = [
    { name: short, root: temp.worktree },
    { name: 'this tree', root: ROOT },
  ];

  // The pages: the root pages and the generated pages of either tree, so a page that one tree lacks is reported.
  const generatedOf = (root, name) => {
    try { return generatedPages(root); } catch (e) {
      console.log(`(the generated pages of ${name} cannot be listed, ${e.message}; taking none)`);
      return [];
    }
  };
  const universe = [...new Set([...PAGES, ...generatedPages(ROOT), ...generatedOf(temp.worktree, short)])];
  let pages = universe;
  if (process.env.PAGES) {
    pages = [...new Set(process.env.PAGES.split(',').map((s) => s.trim()).filter(Boolean))];
    const unknown = pages.filter((p) => !universe.includes(p));
    if (unknown.length) usage(`PAGES names ${unknown.join(', ')}, which is neither a root page nor a generated page of either tree`);
  }
  console.log(scopeLine('all', pages, process.env.PAGES ? { note: 'narrowed by PAGES' } : { note: 'the generated pages of either tree' }));

  for (const t of trees) {
    t.base = await serve(t.root);
    // The policy armGa writes into a page that lacks the widened one, from the tree's own EDGE-SETUP.md.
    t.csp = edgeCsp(t.root).meta;
  }
  const outDir = path.join(__dirname, '..', 'diff-against' + SUFFIX);
  const shown = path.relative(process.cwd(), outDir) || '.';
  fs.rmSync(outDir, { recursive: true, force: true });

  const both = pages.filter((p) => trees.every((t) => fs.existsSync(path.join(t.root, p))));
  const jobs = [];
  for (const p of both) for (const theme of themes) for (const v of viewports) jobs.push({ p, theme, v });
  console.log(`against ${sha.startsWith(rev) ? short : `${rev} (${short})`}${how}`);
  console.log(`  ${count(pages.length, 'page')} at ${sizes.join(' and ')}, ${themes.join(' and ')}: ${count(jobs.length, 'pair')}, ${count(jobs.length * 2, 'capture')}, ${jobsN} at a time`);
  console.log(`  ${trees.map((t) => `${t.name} at ${t.base}`).join(', ')}\n`);

  const found = [];
  for (const p of pages) {
    const has = trees.filter((t) => fs.existsSync(path.join(t.root, p)));
    if (has.length === 2) continue;
    const where = has.length ? `only in ${has[0].name}` : 'in neither tree';
    console.log(`ONLY     ${p}: ${where}`);
    found.push({ p, what: where });
  }

  const browser = await launch();
  let done = 0;
  try {
    await pool(jobs, jobsN, async (j) => {
      const size = `${j.v.width}x${j.v.height}`;
      const shots = [];
      for (const t of trees) {
        // Name the tree, the page and the width in whatever stops a capture (a rev from before the consent module
        // stops here, in rewriteGaId).
        const label = `${j.p} [${j.theme}, ${size}, ${t.name}]`;
        try {
          shots.push(await shoot(browser, j.p, j.theme, j.v, { base: t.base, csp: t.csp, label }));
        } catch (e) {
          if (!String(e.message).startsWith(label)) e.message = `${label}: ${e.message}`;
          throw e;
        }
      }
      const d = differs(PNG, pixelmatch, shots[0], shots[1]);
      const tag = `${j.p} ${size} ${j.theme}`;
      const progress = `(${++done}/${jobs.length})`;
      if (!d) { console.log(`same     ${tag}  ${progress}`); return; }
      const stem = path.join(outDir, `${j.p.replace(/\.html$/, '')}-${j.theme}-${size}`);
      fs.mkdirSync(path.dirname(stem), { recursive: true });
      fs.writeFileSync(`${stem}.diff.png`, d.diff);
      fs.writeFileSync(`${stem}.rev.png`, shots[0]);
      fs.writeFileSync(`${stem}.tree.png`, shots[1]);
      const what = d.resized ? `${d.a} in ${short}, ${d.b} here, ${d.px} px differ` : `${d.px} px differ (${d.pct}%)`;
      console.log(`CHANGED  ${tag}: ${what}, ${path.relative(process.cwd(), stem)}.diff.png  ${progress}`);
      found.push({ p: j.p, what: `${size} ${j.theme}`, pair: true });
    });
  } finally {
    await browser.close();
    cleanUp();
  }

  const took = elapsed(Date.now() - t0);
  if (!found.length) {
    console.log(`\nPASS: no visual difference from ${short} in ${count(jobs.length, 'pair')}, in ${took}`);
    return 0;
  }
  // Every page and width that differs, in the order of the pages.
  const byPage = new Map(pages.map((p) => [p, []]));
  for (const f of found) byPage.get(f.p).push(f.what);
  const hit = [...byPage].filter(([, w]) => w.length);
  const pairs = found.filter((f) => f.pair).length;
  const lone = found.length - pairs;
  console.log(`\nFAIL: ${hit.length} of ${count(pages.length, 'page')} ${hit.length === 1 ? 'differs' : 'differ'} from ${short} (${pairs} of ${count(jobs.length, 'pair')}${lone ? `, and ${count(lone, 'page')} in one tree only` : ''}), in ${took}:`);
  for (const [p, w] of hit) console.log(`  ${p}: ${w.join(', ')}`);
  if (pairs) console.log(`Each diff image is beside its two captures (.rev.png from ${short}, .tree.png from this tree) in ${shown}/.`);
  return 1;
}

(async () => {
  if (MODE === 'compare') compare();
  else if (MODE === 'bar') await captureBar();
  else if (MODE === 'against') process.exit(await against());
  else await capture();
})().catch((e) => { console.error(e); process.exit(1); });
