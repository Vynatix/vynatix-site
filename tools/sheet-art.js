// Writes the two alpha masks of the home hero's "sheet" background: assets/bg-sheet-art-2.svg (neutral ink) and
// assets/bg-sheet-edge-2.svg (bronze ink), and the five stage figures of the same drawing (assets/stage-*.svg, at the end). Plain Node, no dependencies:  node tools/sheet-art.js
// Run with its defaults it reproduces the shipped files byte for byte. Geometry lives here, colour in hero-bg.css (each file
// is a CSS mask over a role-token colour). Coordinates are the drawing's own frame, in container units: x = 0 is the
// container's left edge, and the hero shows the frame from y = lift (its top edge), so a point drawn at y stands
// y - lift below the hero's top. One SVG px is one CSS px at a 16px hero font size; the CSS sizes the mask in em so it
// follows text zoom. To retune, override fields of P as JSON in ART (for example ART='{"lift": 160}' node tools/sheet-art.js)
// and change the matching numbers in hero-bg.css (87.5em by 50em, calc(50% + 40em - 576px)). ART does not rename the
// files, and they must be WRITTEN UNDER NEW NAMES: assets are cached under fixed URLs and are not version-stamped (see
// assets/AGENTS.md). Change the two names at the end of the hero part below, the url() in hero-bg.css and the ART list in
// tools/verify/bg-sheet.js, which reads the apex and datum from the art file itself (from the axis, drawn 30 above the
// apex to 24 below the datum: change the guard with it if that changes).
const fs = require('fs');
const path = require('path');
const f = (n) => +n.toFixed(1);
const P = Object.assign({
  X0: 60, W: 1400, H: 800,
  // The A-frame was drawn for a taller headline, with its apex on the second baseline at 325. The headline is now one
  // roman line over the italic one and two lines of lede, so the hero shows the drawing 168 higher: the apex at 157 of
  // the hero, on the first line's cap line, and the datum at 540, the foot of the buttons (AGENTS.md, Hero background).
  // The stage figures crop the drawing in its own frame and do not use this.
  lift: 168,
  A0x: 1005, A0y: 325, D: 708, fl: 850, fr: 1160, thin: 18, thick: 70,
  legW: 2.5, arcW: 1.6, arcA: 0.9, hatchA: 0.6, fillThick: 0.14, fillThin: 0.07, fillWedge: 0.035,
  gridPitch: 24, gridA: 0.22, gridMajorA: 0.34,
  gx0: 870, gx1: 1010, gx2: 1250, gx3: 1340,   // grid beside the message: horizontal fade (in, full, full, out)
  gy0: 300, gy1: 390, gy2: 650, gy3: 735,      // and vertical fade
  nx0: 1040, nx1: 1140, ny0: 60, ny1: 140,     // the notch under the ruler, right of the eyebrow: x and y fade-in (y in the hero's units, 0 its top)
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
// vignette beside the message (B) and, when `notch` is on, the pocket under the ruler, right of the eyebrow (A).
const ny0 = P.ny0 + P.lift, ny1 = P.ny1 + P.lift;   // the notch's edges in the drawing's frame
const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
const axB = (x) => Math.min(ramp(x, P.gx0, P.gx1), 1 - ramp(x, P.gx2, P.gx3));
const axA = (x) => P.notch ? Math.min(ramp(x, P.nx0, P.nx1), 1 - ramp(x, P.gx2, P.gx3)) : 0;
const ayB = (y) => Math.min(ramp(y, P.gy0, P.gy1), 1 - ramp(y, P.gy2, P.gy3));
const ayA = (y) => P.notch ? Math.min(ramp(y, ny0, ny1), 1 - ramp(y, P.gy2, P.gy3)) : 0;
const q = (a) => Math.round(a * 12) / 12;
const vlines = {}, hlines = {};
for (let x = 0; x <= W - X0; x += P.gridPitch) {
  const major = x % 120 === 0; const classA = P.notch && x >= P.nx0;
  const a = q(classA ? Math.max(axA(x), axB(x)) : axB(x)); if (a <= 0) continue;
  const key = (major ? 'M' : 'm') + a + (classA ? 'A' : 'B'); (vlines[key] = vlines[key] || []).push(`M${x + .5} ${classA ? ny0 : P.gy0}V${P.gy3}`);
}
for (let y = D - 24 * 27; y <= P.gy3; y += P.gridPitch) {
  const major = ((D - y) % 120) === 0; const classA = P.notch && y < P.gy0;
  const a = q(classA ? ayA(y) : ayB(y)); if (a <= 0) continue;
  const key = (major ? 'M' : 'm') + a + (classA ? 'A' : 'B'); (hlines[key] = hlines[key] || []).push(`M${classA ? P.nx0 : P.gx0} ${y + .5}H${P.gx3}`);
}
const gridGroups = (lines, gradPrefix) => Object.entries(lines).map(([key, ds]) => { const major = key[0] === 'M'; const cls = key[key.length - 1]; const a = +key.slice(1, -1); const op = f((major ? P.gridMajorA : P.gridA) * a); return `<path d='${ds.join('')}' stroke='url(#${gradPrefix}${cls})' stroke-opacity='${op}'/>`; }).join('\n ');
const stops = (o) => o.map(([off, op]) => `<stop offset='${f(off)}'${op === 0 ? " stop-opacity='0'" : ''}/>`).join('');
const grad = (id, axis, a, b, s) => `<linearGradient id='${id}' gradientUnits='userSpaceOnUse' ${axis === 'x' ? `x1='${a}' x2='${b}' y1='0' y2='0'` : `x1='0' x2='0' y1='${a}' y2='${b}'`}>${stops(s.map(([v, o]) => [(v - a) / (b - a), o]))}</linearGradient>`;
const ink = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${-X0} ${P.lift} ${W} ${H}' width='${W}' height='${H}' fill='none' stroke='currentColor' stroke-width='1.5'>
<defs>
 ${grad('fxB', 'x', P.gx0, P.gx3, [[P.gx0, 0], [P.gx1, 1], [P.gx2, 1], [P.gx3, 0]])}
 ${grad('fxA', 'x', P.nx0, P.gx3, [[P.nx0, 0], [P.nx1, 1], [P.gx2, 1], [P.gx3, 0]])}
 ${grad('fyB', 'y', P.gy0, P.gy3, [[P.gy0, 0], [P.gy1, 1], [P.gy2, 1], [P.gy3, 0]])}
 ${grad('fyA', 'y', ny0, P.gy3, [[ny0, 0], [ny1, 1], [P.gy2, 1], [P.gy3, 0]])}
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
const accent = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${-X0} ${P.lift} ${W} ${H}' width='${W}' height='${H}' fill='none' stroke='currentColor' stroke-width='2'>
<path d='M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}' stroke-width='2.5'/>
<path d='${ticks}' stroke-width='1.8'/>
<path d='${cross(A0x, A0y, 30, 12)}' stroke-width='2.2'/>
</svg>
`;
fs.mkdirSync(P.outDir, { recursive: true });
fs.writeFileSync(path.join(P.outDir, 'bg-sheet-art-2.svg'), ink);
fs.writeFileSync(path.join(P.outDir, 'bg-sheet-edge-2.svg'), accent);

// ---- The stage figures: the same A-frame at four build stages, for the home page's Partnership band
// (styles.css, "The drawing grows"). They share every constant above, so the hero and the stages cannot drift
// apart: retune P and both follow. Each file is an alpha mask over a role colour, cropped to the figure, and
// its datum line runs from edge to edge so four frames side by side share one line.
//   stage-1.svg  set out      the datum line, the dashed axis, the two feet
//   stage-2.svg  joined       ... and the two legs
//   stage-3.svg  dimensioned  ... and three arcs and the ticked edge
//   stage-4.svg  sectioned    ... the fills and the hatch; its ticked edge and apex mark are stage-edge.svg (bronze)
// Like the hero masks, a retuned stage is written under a new name (assets are not version-stamped).
{
  const S = 1.5;                                   // stroke scale: the figures are shown at about half the hero's size
  const VB = { x: 760, y: 262, w: 490, h: 496 };   // the crop
  const stageArcs = P.arcs.map(([r]) => {
    const p = (deg) => [A0x + r * Math.sin(deg * Math.PI / 180), A0y + r * Math.cos(deg * Math.PI / 180)];
    const [x0, y0] = p(-40), [x1, y1] = p(40);
    return `M${f(x0)} ${f(y0)}A${r} ${r} 0 0 0 ${f(x1)} ${f(y1)}`;
  }).join('');
  const edge = `<path d='M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}' stroke-width='${f(2.5 * S)}'/><path d='${ticks}' stroke-width='${f(1.8 * S)}'/>`;
  const apex = `<path d='${cross(A0x, A0y, 30, 12)}' stroke-width='${f(2.2 * S)}'/>`;
  const layers = {
    setOut: `<path d='M${VB.x} ${D}H${VB.x + VB.w}' stroke-width='${f(1.5 * S)}'/><path d='${axis}' stroke-dasharray='34 7 5 7' stroke-opacity='.8' stroke-width='${f(1 * S)}'/><path d='${feet}' stroke-opacity='.9' stroke-width='${f(1.5 * S)}'/>`,
    legs: `<path d='${shape}' stroke-width='${f(P.legW * S)}' stroke-linejoin='miter'/>`,
    arcs: `<path d='${stageArcs}' stroke-width='${f(P.arcW * S)}' stroke-opacity='${P.arcA}'/>`,
    fills: `<defs><pattern id='hatch' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><path d='M0 .5H8' stroke='#000' stroke-width='${f(1 * S)}' stroke-opacity='${P.hatchA}'/></pattern></defs><g stroke='none'><path d='${wedge}' fill='#000' fill-opacity='${P.fillWedge}'/><path d='${thinLeg}' fill='#000' fill-opacity='${P.fillThin}'/><path d='${thickLeg}' fill='#000' fill-opacity='${P.fillThick}'/><path d='${thickLeg}' fill='url(#hatch)'/></g>`,
  };
  const svg = (body) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${VB.x} ${VB.y} ${VB.w} ${VB.h}' width='${VB.w}' height='${VB.h}' fill='none' stroke='#000'>${body}</svg>\n`;
  const stages = {
    'stage-1.svg': layers.setOut,
    'stage-2.svg': layers.setOut + layers.legs,
    'stage-3.svg': layers.setOut + layers.legs + layers.arcs + edge,
    'stage-4.svg': layers.fills + layers.setOut + layers.legs + layers.arcs,
    'stage-edge.svg': edge + apex,
  };
  for (const [name, body] of Object.entries(stages)) fs.writeFileSync(path.join(P.outDir, name), svg(body));
}
console.log({ Q, edge: [a, b].map((p) => [f(p.x), f(p.y)]), vl: Object.values(vlines).flat().length, hl: Object.values(hlines).flat().length, ink: ink.length, accent: accent.length });
