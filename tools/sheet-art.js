// Writes the two alpha masks of the home hero's "sheet" background: assets/bg-sheet-art.svg (neutral ink) and
// assets/bg-sheet-edge.svg (bronze ink). Plain Node, no dependencies:  node tools/sheet-art.js
// Run with its defaults it reproduces the shipped pair byte for byte. Geometry lives here, colour in styles.css (each file
// is a CSS mask over a role-token colour). Coordinates are container units: x = 0 is the container's left edge, y = 0 the
// hero's top. One SVG px is one CSS px at a 16px hero font size; the CSS sizes the mask in em so it follows text zoom.
// To retune, override fields of P as JSON in ART (for example ART='{"A0y": 330}' node tools/sheet-art.js), change the
// matching numbers in the sheet block of styles.css (87.5em by 50em, calc(50% + 40em - 576px)) and tools/verify/bg-sheet.js,
// and WRITE THE FILES UNDER NEW NAMES: assets are cached under fixed URLs and are not version-stamped (see assets/AGENTS.md).
const fs = require('fs');
const path = require('path');
const f = (n) => +n.toFixed(1);
const P = Object.assign({
  X0: 60, W: 1400, H: 800,
  A0x: 1005, A0y: 325, D: 708, fl: 850, fr: 1160, thin: 18, thick: 70,
  legW: 2.5, arcW: 1.6, arcA: 0.9, hatchA: 0.6, fillThick: 0.14, fillThin: 0.07, fillWedge: 0.035,
  gridPitch: 24, gridA: 0.22, gridMajorA: 0.34,
  gx0: 870, gx1: 1010, gx2: 1250, gx3: 1340,   // grid below the headline: horizontal fade (in, full, full, out)
  gy0: 300, gy1: 390, gy2: 650, gy3: 735,      // and vertical fade
  nx0: 1040, nx1: 1140, ny0: 60, ny1: 140,     // the notch right of the first headline line: x and y fade-in
  notch: 1,
  arcs: [[118, 838], [215, 838], [312, 838]],
  edgeOff: 34, edgeT0: 115, edgeExtra: 20,
  outDir: path.join(__dirname, '..', 'assets'),
}, JSON.parse(process.env.ART || '{}'));
const { A0x, A0y, D, fl, fr, X0, W, H } = P;
const k = (A0x - fl) / (D - A0y);
const Q = (() => { const xl = fl + P.thin, xr = fr - P.thick; const s = (xr - xl) / (2 * k); return { x: xl + k * s, y: D - s }; })();
const shape = `M${fl} ${D}L${A0x} ${A0y}L${fr} ${D}H${fr - P.thick}L${f(Q.x)} ${f(Q.y)}L${fl + P.thin} ${D}Z`;
const thickLeg = `M${A0x} ${A0y}L${fr} ${D}H${fr - P.thick}L${f(Q.x)} ${f(Q.y)}Z`;
const thinLeg = `M${fl} ${D}L${A0x} ${A0y}L${f(Q.x)} ${f(Q.y)}L${fl + P.thin} ${D}Z`;
const wedge = `M${fl + P.thin} ${D}L${f(Q.x)} ${f(Q.y)}L${fr - P.thick} ${D}Z`;
const arcPath = (r, xmin) => {
  const a0 = -Math.min(44, Math.asin(Math.min(1, (A0x - xmin) / r)) * 180 / Math.PI);
  const p = (a) => [A0x + r * Math.sin(a * Math.PI / 180), A0y + r * Math.cos(a * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(44);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 0 0 ${f(x1)} ${f(y1)}`;
};
const arcs = P.arcs.map(([r, xmin]) => arcPath(r, xmin)).join('');
const cross = (x, y, s, r) => `M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}` + (r ? `M${x + r} ${y}A${r} ${r} 0 1 1 ${x - r} ${y}A${r} ${r} 0 1 1 ${x + r} ${y}` : '');
const feet = [[fl, D], [fr, D]].map(([x, y]) => cross(x, y, 16, 7)).join('');
const axis = `M${A0x} ${A0y - 30}V${D + 24}`;
// grid: per-line alpha (quantised) with a gradient along the line for the other axis. Two regions: the
// vignette below the headline (B) and, when `notch` is on, the pocket right of the first headline line (A).
const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
const axB = (x) => Math.min(ramp(x, P.gx0, P.gx1), 1 - ramp(x, P.gx2, P.gx3));
const axA = (x) => P.notch ? Math.min(ramp(x, P.nx0, P.nx1), 1 - ramp(x, P.gx2, P.gx3)) : 0;
const ayB = (y) => Math.min(ramp(y, P.gy0, P.gy1), 1 - ramp(y, P.gy2, P.gy3));
const ayA = (y) => P.notch ? Math.min(ramp(y, P.ny0, P.ny1), 1 - ramp(y, P.gy2, P.gy3)) : 0;
const q = (a) => Math.round(a * 12) / 12;
const vlines = {}, hlines = {};
for (let x = 0; x <= W - X0; x += P.gridPitch) {
  const major = x % 120 === 0; const classA = P.notch && x >= P.nx0;
  const a = q(classA ? Math.max(axA(x), axB(x)) : axB(x)); if (a <= 0) continue;
  const key = (major ? 'M' : 'm') + a + (classA ? 'A' : 'B'); (vlines[key] = vlines[key] || []).push(`M${x + .5} ${classA ? P.ny0 : P.gy0}V${P.gy3}`);
}
for (let y = D - 24 * 27; y <= P.gy3; y += P.gridPitch) {
  const major = ((D - y) % 120) === 0; const classA = P.notch && y < P.gy0;
  const a = q(classA ? ayA(y) : ayB(y)); if (a <= 0) continue;
  const key = (major ? 'M' : 'm') + a + (classA ? 'A' : 'B'); (hlines[key] = hlines[key] || []).push(`M${classA ? P.nx0 : P.gx0} ${y + .5}H${P.gx3}`);
}
const gridGroups = (lines, gradPrefix) => Object.entries(lines).map(([key, ds]) => { const major = key[0] === 'M'; const cls = key[key.length - 1]; const a = +key.slice(1, -1); const op = f((major ? P.gridMajorA : P.gridA) * a); return `<path d='${ds.join('')}' stroke='url(#${gradPrefix}${cls})' stroke-opacity='${op}'/>`; }).join('\n ');
const stops = (o) => o.map(([off, op]) => `<stop offset='${f(off)}'${op === 0 ? " stop-opacity='0'" : ''}/>`).join('');
const grad = (id, axis, a, b, s) => `<linearGradient id='${id}' gradientUnits='userSpaceOnUse' ${axis === 'x' ? `x1='${a}' x2='${b}' y1='0' y2='0'` : `x1='0' x2='0' y1='${a}' y2='${b}'`}>${stops(s.map(([v, o]) => [(v - a) / (b - a), o]))}</linearGradient>`;
const ink = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${-X0} 0 ${W} ${H}' width='${W}' height='${H}' fill='none' stroke='currentColor' stroke-width='1.5'>
<defs>
 ${grad('fxB', 'x', P.gx0, P.gx3, [[P.gx0, 0], [P.gx1, 1], [P.gx2, 1], [P.gx3, 0]])}
 ${grad('fxA', 'x', P.nx0, P.gx3, [[P.nx0, 0], [P.nx1, 1], [P.gx2, 1], [P.gx3, 0]])}
 ${grad('fyB', 'y', P.gy0, P.gy3, [[P.gy0, 0], [P.gy1, 1], [P.gy2, 1], [P.gy3, 0]])}
 ${grad('fyA', 'y', P.ny0, P.gy3, [[P.ny0, 0], [P.ny1, 1], [P.gy2, 1], [P.gy3, 0]])}
 <linearGradient id='fd' gradientUnits='userSpaceOnUse' x1='${fl - 70}' x2='${W - X0}' y1='0' y2='0'><stop offset='0' stop-opacity='0'/><stop offset='.2'/><stop offset='.85'/><stop offset='1' stop-opacity='0'/></linearGradient>
 <linearGradient id='fa' gradientUnits='userSpaceOnUse' x1='${P.arcs[0][1]}' x2='${W - X0}' y1='0' y2='0'><stop offset='0' stop-opacity='0'/><stop offset='.1'/><stop offset='.7'/><stop offset='1' stop-opacity='0'/></linearGradient>
 <pattern id='hatch' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><path d='M0 .5H8' stroke-width='1' stroke-opacity='${P.hatchA}'/></pattern>
</defs>
<g stroke-width='1'>
 ${gridGroups(vlines, 'fy')}
 ${gridGroups(hlines, 'fx')}
</g>
<g stroke='none'>
 <path d='${wedge}' fill='currentColor' fill-opacity='${P.fillWedge}'/>
 <path d='${thinLeg}' fill='currentColor' fill-opacity='${P.fillThin}'/>
 <path d='${thickLeg}' fill='currentColor' fill-opacity='${P.fillThick}'/>
 <path d='${thickLeg}' fill='url(#hatch)'/>
</g>
<path d='${shape}' stroke-width='${P.legW}' stroke-linejoin='miter'/>
<path d='${arcs}' stroke='url(#fa)' stroke-width='${P.arcW}' stroke-opacity='${P.arcA}'/>
<path d='M${fl - 70} ${D}H${W - X0}' stroke='url(#fd)' stroke-width='1.5'/>
<path d='${axis}' stroke-dasharray='34 7 5 7' stroke-opacity='.8' stroke-width='1'/>
<path d='${feet}' stroke-opacity='.9'/>
</svg>
`;
// bronze: a ticked edge standing off the right leg, and the apex mark
const ux = A0x - fr, uy = A0y - D; const len = Math.hypot(ux, uy); const dx = ux / len, dy = uy / len;
const nx = -dy, ny = dx; const off = P.edgeOff;
const pt = (t) => ({ x: fr + nx * off + dx * t, y: D + ny * off + dy * t });
const a = pt(P.edgeT0), b = pt(len + P.edgeExtra);
let ticks = '';
for (let t = P.edgeT0, i = 0; t <= len + P.edgeExtra; t += 30, i++) { const major = i % 5 === 0; const l = major ? 22 : 11; const p = pt(t); ticks += `M${f(p.x)} ${f(p.y)}L${f(p.x - nx * l)} ${f(p.y - ny * l)}`; }
const accent = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${-X0} 0 ${W} ${H}' width='${W}' height='${H}' fill='none' stroke='currentColor' stroke-width='2'>
<path d='M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}' stroke-width='2.5'/>
<path d='${ticks}' stroke-width='1.8'/>
<path d='${cross(A0x, A0y, 30, 12)}' stroke-width='2.2'/>
</svg>
`;
fs.mkdirSync(P.outDir, { recursive: true });
fs.writeFileSync(path.join(P.outDir, 'bg-sheet-art.svg'), ink);
fs.writeFileSync(path.join(P.outDir, 'bg-sheet-edge.svg'), accent);
console.log({ Q, edge: [a, b].map((p) => [f(p.x), f(p.y)]), vl: Object.values(vlines).flat().length, hl: Object.values(hlines).flat().length, ink: ink.length, accent: accent.length });
