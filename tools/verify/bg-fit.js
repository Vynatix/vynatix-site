// The four hero backgrounds on a scaled hero.
//
// The hero fit (styles.css, "Hero fit") scales the hero to the window's height, and hero-bg.css
// multiplies each background's constants by the same unit. The four guards run their full sweep at
// the design size (a 1248px-high window); this script runs each of them again at the heights where
// the hero is scaled, one width, so that the art is proven against the text there too:
//   900px   the unit is about 0.86: everything scales together
//   790px   about 0.69: the lede has stopped at its floor and the rest goes on shrinking
//   660px   about 0.47: the bottom of the envelope
//   1100px  the state with the client row on the first screen, the unit about 0.83
// In each run the guards multiply their own distances (the 24px clearance, the dial's box, the gaps)
// by the unit they read from the page, and the iris's aim is left to the design size.
//
//   node verify/bg-fit.js                (serve the repo root first, as for the other checks)
//   HEIGHTS=790 node verify/bg-fit.js    one height
// THEMES and BGS narrow it as they narrow the guards.
const { spawnSync } = require('child_process');
const path = require('path');

const HEIGHTS = (process.env.HEIGHTS || '900,790,660,1100').split(',').map(Number);
const GUARDS = [
  ['bg-weave.js', { WIDTHS: '1440', ZOOMS: '1,1.5' }],
  ['bg-sheet.js', { WIDTHS: '1440', ZOOMS: '1,1.5' }],
  ['bg-dial.js', { WIDTHS: '1440', ZOOMS: '1,1.5', STATES: 'rest' }],   // the pointer's turn is an angle: it does not depend on the scale
  ['bg-iris.js', { WIDTHS: '1440', ZOOM_WIDTHS: '1440', ZOOMS: '1.25', CHECKS: 'BP' }],
];

let failed = 0;
for (const h of HEIGHTS) for (const [guard, env] of GUARDS) {
  const r = spawnSync(process.execPath, [path.join(__dirname, guard)], { env: Object.assign({}, process.env, env, { HEIGHT: String(h) }), encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  if (!ok) failed++;
  const last = out.trim().split('\n').pop() || '';
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${guard} in a ${h}px-high window - ${last.trim()}`);
  if (!ok) console.log(out.split('\n').filter((l) => /FAIL|fail/.test(l)).map((l) => '       ' + l.trim()).join('\n'));
}
console.log(failed ? `bg-fit: ${failed} failing` : 'bg-fit: ok');
process.exit(failed ? 1 : 0);
