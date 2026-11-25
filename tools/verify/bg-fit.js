// The hero background on a scaled hero. Scope: root, the English home page, through bg-sheet.js.
//
// The hero fit (styles.css, "Hero fit") scales the hero to the window's height, and hero-bg.css
// multiplies the drafting sheet's constants by the same unit. bg-sheet.js runs its full sweep at
// the design size (a 1248px-high window); this script runs it again at the heights where the hero
// is scaled, one width, so that the art is proven against the text there too:
//   650px   the bottom of the envelope, the unit about 0.89 (the message, the clients' rule on the fold)
//   790px   the unit is 1 with spare room under the buttons (the owner's window, 1440 by 790)
//   864px   the state with the client row on the first screen, at its floor, 0.82
//   900px   the same state, about 0.88
// In each run the guard multiplies its own distances (the 24px clearance, the gaps) by the unit it
// reads from the page.
//
//   node verify/bg-fit.js                (serve the repo root first, as for the other checks)
//   HEIGHTS=790 node verify/bg-fit.js    one height
//   node verify/bg-fit.js --sweeps       print how many sweeps there are (one per height) and stop
//   node verify/bg-fit.js --sweep <k>    run only the k-th sweep, counted from 1 in the order above
// THEMES narrows it as it narrows the guard, and HEIGHTS narrows --sweeps and --sweep too. Without an option it
// runs every sweep, one after the other; tools/check.js starts each sweep as a job of its own instead, so the
// four run side by side.
const { spawnSync } = require('child_process');
const path = require('path');
const { scopeLine } = require('./_common');

const HEIGHTS = (process.env.HEIGHTS || '650,790,864,900').split(',').map(Number);
const GUARDS = [
  ['bg-sheet.js', { WIDTHS: '1440', ZOOMS: '1,1.25,1.5,2' }],   // 125 percent too: in a 790px window it is where the A-frame's feet would first reach the clients' rule
];

// The sweeps, in the order the plain run takes them. --sweep picks one of them by its place in this list.
const SWEEPS = [];
for (const h of HEIGHTS) for (const [guard, env] of GUARDS) SWEEPS.push([h, guard, env]);

const args = process.argv.slice(2);
if (args.includes('--sweeps')) { console.log(SWEEPS.length); process.exit(0); }
let only = null;
if (args.includes('--sweep')) {
  only = Number(args[args.indexOf('--sweep') + 1]);
  if (!Number.isInteger(only) || only < 1 || only > SWEEPS.length) {
    console.error(`bg-fit: --sweep takes a number from 1 to ${SWEEPS.length}`);
    process.exit(2);
  }
}

console.log(scopeLine('root', ['index.html'], { feature: 'the English home page, its hero scaled to the window' }));
let failed = 0;
for (const [i, [h, guard, env]] of SWEEPS.entries()) {
  if (only !== null && i + 1 !== only) continue;
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
