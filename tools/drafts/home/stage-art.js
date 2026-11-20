// DRAFT TOOLING for the home page proposal (tools/drafts/home/). Not part of the site and not run at deploy time.
// Writes the hero's A-frame drawing at four build stages, as alpha masks beside this file:
//   stage-1.svg  set out      the datum line, the dashed axis, the two feet
//   stage-2.svg  joined       ... and the two legs
//   stage-3.svg  dimensioned  ... and the three arcs and the ticked edge
//   stage-4.svg  sectioned    ... the fills and the hatch (its ticked edge and apex mark are in stage-edge.svg)
//   stage-edge.svg            the bronze layer of stage 4: the ticked edge and the apex mark
// The geometry is the A-frame of tools/sheet-art.js (same constants), cropped to the figure. If the proposal is taken
// up, the stages belong in sheet-art.js itself as a stage table, so the hero and the stations cannot drift apart.
//   node tools/drafts/home/stage-art.js
const fs = require('fs');
const path = require('path');
const f = (n) => +n.toFixed(1);
const P = { A0x: 1005, A0y: 325, D: 708, fl: 850, fr: 1160, thin: 18, thick: 70, arcs: [118, 215, 312], edgeOff: 34, edgeT0: 115, edgeExtra: 20 };
const S = 1.5;                                   // stroke scale: the figures are shown at about half the hero's size
const VB = { x: 760, y: 262, w: 490, h: 496 };   // the crop
const { A0x, A0y, D, fl, fr } = P;
const k = (A0x - fl) / (D - A0y);
const Q = (() => { const xl = fl + P.thin, xr = fr - P.thick; const s = (xr - xl) / (2 * k); return { x: xl + k * s, y: D - s }; })();
const shape = `M${fl} ${D}L${A0x} ${A0y}L${fr} ${D}H${fr - P.thick}L${f(Q.x)} ${f(Q.y)}L${fl + P.thin} ${D}Z`;
const thickLeg = `M${A0x} ${A0y}L${fr} ${D}H${fr - P.thick}L${f(Q.x)} ${f(Q.y)}Z`;
const thinLeg = `M${fl} ${D}L${A0x} ${A0y}L${f(Q.x)} ${f(Q.y)}L${fl + P.thin} ${D}Z`;
const wedge = `M${fl + P.thin} ${D}L${f(Q.x)} ${f(Q.y)}L${fr - P.thick} ${D}Z`;
const arcPath = (r) => {
  const p = (a) => [A0x + r * Math.sin(a * Math.PI / 180), A0y + r * Math.cos(a * Math.PI / 180)];
  const [x0, y0] = p(-40), [x1, y1] = p(40);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 0 0 ${f(x1)} ${f(y1)}`;
};
const arcs = P.arcs.map(arcPath).join('');
const cross = (x, y, s, r) => `M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}` + (r ? `M${x + r} ${y}A${r} ${r} 0 1 1 ${x - r} ${y}A${r} ${r} 0 1 1 ${x + r} ${y}` : '');
const feet = [[fl, D], [fr, D]].map(([x, y]) => cross(x, y, 16, 7)).join('');
const axis = `M${A0x} ${A0y - 30}V${D + 24}`;
const ux = A0x - fr, uy = A0y - D; const len = Math.hypot(ux, uy); const dx = ux / len, dy = uy / len;
const nx = -dy, ny = dx;
const pt = (t) => ({ x: fr + nx * P.edgeOff + dx * t, y: D + ny * P.edgeOff + dy * t });
const ea = pt(P.edgeT0), eb = pt(len + P.edgeExtra);
let ticks = '';
for (let t = P.edgeT0, i = 0; t <= len + P.edgeExtra; t += 30, i++) { const l = i % 5 === 0 ? 22 : 11; const p = pt(t); ticks += `M${f(p.x)} ${f(p.y)}L${f(p.x - nx * l)} ${f(p.y - ny * l)}`; }
const edge = `<path d='M${f(ea.x)} ${f(ea.y)}L${f(eb.x)} ${f(eb.y)}' stroke-width='${f(2.5 * S)}'/><path d='${ticks}' stroke-width='${f(1.8 * S)}'/>`;
const apex = `<path d='${cross(A0x, A0y, 30, 12)}' stroke-width='${f(2.2 * S)}'/>`;

const layers = {
  setOut: `<path d='M${VB.x} ${D}H${VB.x + VB.w}' stroke-width='${f(1.5 * S)}'/><path d='${axis}' stroke-dasharray='34 7 5 7' stroke-opacity='.8' stroke-width='${f(1 * S)}'/><path d='${feet}' stroke-opacity='.9' stroke-width='${f(1.5 * S)}'/>`,
  legs: `<path d='${shape}' stroke-width='${f(2.5 * S)}' stroke-linejoin='miter'/>`,
  arcs: `<path d='${arcs}' stroke-width='${f(1.6 * S)}' stroke-opacity='.9'/>`,
  fills: `<defs><pattern id='hatch' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><path d='M0 .5H8' stroke='#000' stroke-width='${f(1 * S)}' stroke-opacity='.6'/></pattern></defs><g stroke='none'><path d='${wedge}' fill='#000' fill-opacity='.035'/><path d='${thinLeg}' fill='#000' fill-opacity='.07'/><path d='${thickLeg}' fill='#000' fill-opacity='.14'/><path d='${thickLeg}' fill='url(#hatch)'/></g>`,
};
const svg = (body) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${VB.x} ${VB.y} ${VB.w} ${VB.h}' width='${VB.w}' height='${VB.h}' fill='none' stroke='#000'>${body}</svg>\n`;
const stages = {
  'stage-1.svg': layers.setOut,
  'stage-2.svg': layers.setOut + layers.legs,
  'stage-3.svg': layers.setOut + layers.legs + layers.arcs + edge,
  'stage-4.svg': layers.fills + layers.setOut + layers.legs + layers.arcs,
  'stage-edge.svg': edge + apex,
};
for (const [name, body] of Object.entries(stages)) fs.writeFileSync(path.join(__dirname, name), svg(body));
console.log(Object.keys(stages).join(' '));
