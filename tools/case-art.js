#!/usr/bin/env node
// Writes the drawn pictures of the English home page: the three case covers and the one figure that runs across the
// three services. Plain Node, no dependencies:  node tools/case-art.js
//
// Every picture is a pair of alpha-only SVG masks, an ink layer and an accent layer (the `-accent` file). styles.css
// lays each over a role colour ("The English home page: its pictures"), so one pair serves both themes and no file
// holds a colour: `currentColor` is there only because a mask needs something opaque.
//
//   cover-cite          the regulated client. A question, the lines of its answer, and the answer's mark tied to three
//                       bracketed lines of a page (the accent layer: every answer cites its source). A second question
//                       finds an empty bracket under the page and goes on to a person. No glyph in it, so the
//                       right-to-left page mirrors it.
//   cover-build         Volvo Cars. Two lengths from one datum on one scale, a tick a minute: BUILD.before above,
//                       BUILD.after in the accent, and the minutes that went as a dashed (hidden) line. Wide file for
//                       the 16:9 slot, `-tall` for the strip beside a compact card.
//   cover-media         Volvo Trucks. An FM scale, 88 to 108, and under it a playback track; the tuner's needle comes
//                       down and is the playhead (the accent). Wide and `-tall`, as above.
//   services-line       One sheet, three thirds: a model among its tools and sources, a platform in three layers,
//                       three screens on a ground line. One accent line runs through all three at one height, so it
//                       carries across the columns. 4:1; styles.css shows a third in each column.
//
// The figures in cover-build are the case's own (work.html, and the card beside the picture): change them there and
// here together. tools/verify/publish.js reads BUILD from this file and fails if the card says something else, if a
// file in assets/ is not what this script writes, or if styles.css and assets/ disagree about which files there are.
// No file carries a word: the page exists in seven languages and a mask cannot be translated. Digits are drawn as
// single strokes (a mask is an image and cannot load the page's fonts). The four glyphs are Material Symbols
// (weight 300, outlined, @material-symbols/svg-300 0.47.5, Apache 2.0), as assets/icons/ are.
//
// Assets are not version-stamped: a retuned file takes a new name (change NAMES below and the url()s in styles.css),
// as assets/AGENTS.md says of every mask.

const fs = require('fs');
const path = require('path');

const BUILD = { before: 47, after: 6 };   // minutes per build, Volvo Cars 2025
const NAMES = { cite: 'cover-cite', build: 'cover-build', media: 'cover-media', services: 'services-line' };
const OUT = path.join(__dirname, '..', 'assets');

const f = (n) => +n.toFixed(2);
// Stroke weights. A tall cover is shown at about its own size; a wide one mostly on a phone, at about half of its
// size, so it is drawn heavier and its figures larger.
const W = { line: 2, hair: 1.25, heavy: 4.5 };
const WIDE = { line: 3, hair: 1.8, heavy: 6.5 };

// Single-stroke digits in a 6 by 10 cell.
const DIGIT = {
  0: 'M3 0C1.1 0 0 1.9 0 5s1.1 5 3 5 3-1.9 3-5S4.9 0 3 0Z',
  1: 'M1.2 2.3 3.6 0V10',
  4: 'M4.5 10V0L0 7H6',
  6: 'M5.3 1.1C4.8.4 4 0 3.1 0 1.2 0 0 2 0 5.4V6.9C0 8.7 1.3 10 3 10s3-1.3 3-3.1-1.3-3-3-3C1.6 3.9.4 4.8 0 6.2',
  7: 'M0 0H6L2.4 10',
  8: 'M3 4.7C1.6 4.7.7 3.7.7 2.4.7 1 1.7 0 3 0s2.3 1 2.3 2.4c0 1.3-.9 2.3-2.3 2.3C1.3 4.7 0 5.8 0 7.3 0 8.9 1.3 10 3 10s3-1.1 3-2.7c0-1.5-1.3-2.6-3-2.6Z',
};
const GAP = 2.6;   // between two digits, in cell units
// A number set in those digits: centred on cx, its top at `top`, `h` high, drawn `sw` thick.
function num(n, cx, top, h, sw) {
  const s = h / 10, chars = String(n).split('');
  const width = (chars.length * 6 + (chars.length - 1) * GAP) * s;
  let x = cx - width / 2;
  const out = chars.map((c) => {
    const nine = c === '9';
    const g = `<path transform='translate(${f(x)} ${f(top)}) scale(${f(s)})${nine ? ' rotate(180 3 5)' : ''}' d='${DIGIT[nine ? 6 : c]}'/>`;
    x += (6 + GAP) * s;
    return g;
  }).join('');
  return `<g stroke-width='${f(sw / s)}' stroke-linecap='round' stroke-linejoin='round'>${out}</g>`;
}

// Material Symbols, viewBox 0 -960 960 960.
const GLYPH = {
  play: 'M340-238.39v-487.68l383.07 243.84L340-238.39Zm45.39-243.84Zm0 161 253.99-161-253.99-161v322Z',
  next: 'M670-267.69v-424.62h45.38v424.62H670Zm-425.38 0v-424.62L552.92-480l-308.3 212.31ZM290-480Zm0 125.38L473.69-480 290-605.77v251.15Z',
  prev: 'M244.62-267.69v-424.62H290v424.62h-45.38Zm470.76 0L407.08-480l308.3-212.31v424.62ZM670-480Zm0 125.38v-251.15L486.69-480 670-354.62Z',
  person: 'M384.69-530.31q-37.38-37.38-37.38-95.5 0-58.11 37.38-95.3 37.39-37.2 95.31-37.2t95.31 37.2q37.38 37.19 37.38 95.3 0 58.12-37.38 95.5-37.39 37.39-95.31 37.39t-95.31-37.39ZM180-187.69v-75.93q0-32.23 17.08-56.15t44.38-36.77q63.16-28.07 121.77-42.31 58.62-14.23 116.77-14.23t116.46 14.54q58.31 14.54 121.46 42 27.92 12.85 45 36.77T780-263.62v75.93H180Zm45.39-45.39h509.22v-30.54q0-15.61-9.88-29.92-9.88-14.31-25.81-22.46-59-28.69-111.3-40.19-52.3-11.5-107.62-11.5-55.32 0-108.43 11.5-53.11 11.5-111.11 40.19-15.92 8.15-25.5 22.46-9.57 14.31-9.57 29.92v30.54Zm316.99-330.15q24.93-24.92 24.93-62.38 0-37.47-24.93-62.39-24.92-24.92-62.38-24.92T417.62-688q-24.93 24.92-24.93 62.39 0 37.46 24.93 62.38 24.92 24.92 62.38 24.92t62.38-24.92ZM480-625.61Zm0 392.53Z',
};
// A glyph `size` across, centred on (cx, cy). Filled: these are shapes, not strokes.
const glyph = (name, cx, cy, size) => `<path fill='currentColor' stroke='none' transform='translate(${f(cx - size / 2)} ${f(cy + size / 2)}) scale(${f(size / 960)})' d='${GLYPH[name]}'/>`;

const svg = ({ w, h, box, sw = W.line }, body) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box || `0 0 ${w} ${h}`}' width='${w}' height='${h}' fill='none' stroke='currentColor' stroke-width='${sw}'>\n${body.filter(Boolean).join('\n')}\n</svg>\n`;
const DASHDOT = "stroke-dasharray='14 4 2 4'";
// The oblique stroke that ends a dimension line.
const slash = (x, y, s = 5) => `M${f(x - s)} ${f(y + s)}L${f(x + s)} ${f(y - s)}`;

// ---------------------------------------------------------------- cover-build
// horizontal: both lengths run right from a datum at x0, `pitch` to the minute. Vertical: both rise from a ground line.
function build(tall) {
  const { before, after } = BUILD;
  const ink = [], accent = [];
  if (!tall) {
    const w = 640, h = 360, pitch = 12, x0 = (w - before * pitch) / 2, x1 = x0 + before * pitch, xa = x0 + after * pitch;
    const y1 = 152, y2 = 250;
    let ticks = '', aticks = '';
    for (let i = 0; i <= before; i++) ticks += `M${f(x0 + i * pitch)} ${y1}v${i % 10 === 0 ? 21 : i % 5 === 0 ? 15 : 9}`;
    for (let i = 0; i <= after; i++) aticks += `M${f(x0 + i * pitch)} ${y2}v${i % 5 === 0 ? 15 : 9}`;
    ink.push(
      `<path d='M${x0} ${y1 - 62}V${y2 + 46}' stroke-width='${WIDE.hair}' ${DASHDOT}/>`,                  // the datum
      `<path d='M${x1} ${y1 - 24}V${y2 + 24}' stroke-width='${WIDE.hair}'/>`,                              // the far extension line
      `<path d='M${x0} ${y1}H${x1}'/>`,
      `<path d='${ticks}' stroke-width='${WIDE.hair}'/>`,
      `<path d='${slash(x0, y1, 7)}${slash(x1, y1, 7)}'/>`,
      `<path d='M${f(xa + 12)} ${y2}H${x1}' stroke-width='${WIDE.hair}' stroke-dasharray='9 8'/>`,          // the minutes that went
      num(before, (x0 + x1) / 2, y1 - 54, 34, 3));
    accent.push(
      `<path d='M${x0} ${y2}H${xa}' stroke-width='${WIDE.heavy}'/>`,
      `<path d='${aticks}' stroke-width='${WIDE.hair + 0.4}'/>`,
      num(after, (x0 + xa) / 2, y2 - 52, 34, 3.2));
    return { w, h, sw: WIDE.line, ink, accent };
  }
  const w = 180, h = 340, pitch = 5.4, y0 = 300, y1 = y0 - before * pitch, ya = y0 - after * pitch;
  const xb = 66, xa = 118;
  let ticks = '';
  for (let i = 0; i <= before; i++) ticks += `M${xb} ${f(y0 - i * pitch)}h-${i % 10 === 0 ? 12 : i % 5 === 0 ? 8.5 : 5}`;
  ink.push(
    `<path d='M22 ${y0}H158' stroke-width='${W.hair}' ${DASHDOT}/>`,
    `<path d='M${xb - 14} ${f(y1)}H${xa + 14}' stroke-width='${W.hair}'/>`,
    `<path d='M${xb} ${y0}V${f(y1)}'/>`,
    `<path d='${ticks}' stroke-width='1'/>`,
    `<path d='${slash(xb, y0, 4)}${slash(xb, y1, 4)}'/>`,
    `<path d='M${xa} ${f(ya - 8)}V${f(y1)}' stroke-width='${W.hair}' stroke-dasharray='6 5'/>`,
    num(before, xb, y1 - 28, 18, 1.9));
  accent.push(
    `<path d='M${xa} ${y0}V${f(ya)}' stroke-width='4'/>`,
    `<path d='M${xa - 7} ${f(ya)}h14' stroke-width='1.5'/>`,
    num(after, xa + 22, ya + 4, 18, 2.1));
  return { w, h, ink, accent };
}

// ---------------------------------------------------------------- cover-media
const FM = { from: 88, to: 108, at: 93.4 };   // where the needle stands: between two labels, and no station's frequency
function media(tall) {
  const w = tall ? 180 : 640, h = tall ? 340 : 360;
  const x0 = tall ? 24 : 58, x1 = w - x0, per = (x1 - x0) / (FM.to - FM.from);
  const yT = tall ? 92 : 110, yP = tall ? 196 : 216, yG = tall ? 268 : 290;
  const t = tall ? { long: 12, mid: 8, short: 5, digit: 13, dsw: 1.5, r: 6.5, small: 28, big: 42, step: 42 }
                 : { long: 22, mid: 15, short: 9, digit: 24, dsw: 2.6, r: 11, small: 38, big: 56, step: 74 };
  const S = tall ? W : WIDE;
  const xn = x0 + (FM.at - FM.from) * per;
  let ticks = '';
  for (let m = FM.from; m <= FM.to; m++) { const k = m - FM.from; ticks += `M${f(x0 + k * per)} ${yT}v-${k % 10 === 0 ? t.long : k % 5 === 0 ? t.mid : t.short}`; }
  const ink = [
    `<path d='M${x0} ${yT}H${x1}'/>`,
    `<path d='${ticks}' stroke-width='${tall ? 1 : S.hair}'/>`,
    ...[0, 10, 20].map((k) => num(FM.from + k, x0 + k * per, yT - t.long - 6 - t.digit, t.digit, t.dsw)),
    `<path d='M${x0} ${yP}H${x1}' stroke-width='${S.hair}'/>`,
    `<path d='M${x0} ${yP}H${f(xn)}' stroke-width='${tall ? 3.5 : S.heavy}' stroke-linecap='round'/>`,
    `<path d='M${x1} ${yP - (tall ? 6 : 9)}v${tall ? 12 : 18}'/>`,
    glyph('prev', w / 2 - t.step, yG, t.small), glyph('play', w / 2, yG, t.big), glyph('next', w / 2 + t.step, yG, t.small),
  ];
  const accent = [
    `<path d='M${f(xn)} ${yT - t.long - 8}V${yP}' stroke-width='${tall ? 1.6 : 2.6}'/>`,
    `<circle cx='${f(xn)}' cy='${yP}' r='${t.r}' fill='currentColor' stroke='none'/>`,
  ];
  return { w, h, sw: S.line, ink, accent };
}

// ---------------------------------------------------------------- cover-cite
function cite() {
  const w = 608, h = 342, dy = 26;
  const C = { line: 2.4, hair: 1.6 };
  const qx = 66, ax0 = 96, page = { x: 372, y: 38 + dy, w: 168, h: 240 }, rule = 15, first = page.y + 26;
  const lx0 = page.x + 22, lx1 = page.x + page.w - 22;
  const cited = [6, 7, 8];                                   // the lines of the page the answer rests on
  const ya = first + cited[1] * rule;                        // the answer's last line is level with their middle
  const answer = [[ya - 54, 204], [ya - 36, 188], [ya - 18, 198], [ya, 112]];
  const y2 = page.y + page.h + 30;                           // the second question passes under the page
  const lens = [1, 0.86, 0.95, 0.7, 1, 0.9, 0, 0, 0, 0.82, 1, 0.93, 0.6, 0.97, 0.88];
  let rules = '';
  lens.forEach((l, i) => { if (l) rules += `M${lx0} ${first + i * rule}h${f((lx1 - lx0) * l)}`; });
  const fold = 20;
  const markX = ax0 + answer[3][1] + 16;
  const ink = [
    // the page, two more behind it, its lines
    `<path d='M${page.x} ${page.y}H${page.x + page.w - fold}l${fold} ${fold}V${page.y + page.h}H${page.x}Z'/>`,
    `<path d='M${page.x + page.w - fold} ${page.y}v${fold}h${fold}' stroke-width='${C.hair}'/>`,
    `<path d='M${page.x + 9} ${page.y - 8}H${page.x + page.w + 9}V${page.y + page.h - 9}M${page.x + 18} ${page.y - 16}H${page.x + page.w + 18}V${page.y + page.h - 18}' stroke-width='${C.hair}' stroke-opacity='.55'/>`,
    `<path d='${rules}' stroke-width='${C.hair}' stroke-opacity='.7'/>`,
    // the first question and its answer
    `<circle cx='${qx}' cy='${answer[0][0]}' r='7'/>`,
    `<path d='${answer.map(([y, l]) => `M${ax0} ${y}h${l}`).join('')}' stroke-width='3.4' stroke-linecap='round' stroke-opacity='.8'/>`,
    // the second: nothing hangs from it; an empty bracket where its passage would be; on to a person
    `<circle cx='${qx}' cy='${y2}' r='7'/>`,
    `<path d='M${qx + 7} ${y2}H${lx0 - 12}' stroke-width='${C.hair}'/>`,
    `<path d='M${lx0 + 8} ${y2 - 11}h-8v22h8M${lx1 - 8} ${y2 - 11}h8v22h-8' stroke-width='${C.hair}' stroke-dasharray='4 4'/>`,
    `<path d='M${lx1 + 12} ${y2}H${page.x + page.w + 34}' stroke-width='${C.hair}' ${DASHDOT}/>`,
    glyph('person', page.x + page.w + 62, y2 - 3, 50),
  ];
  const accent = [
    `<circle cx='${markX}' cy='${ya}' r='5.5' fill='currentColor' stroke='none'/>`,
    `<path d='M${markX} ${ya}H${lx0 - 12}' stroke-width='${C.hair + 0.2}'/>`,
    `<path d='M${lx0 - 4} ${ya - rule - 7}h-8v${2 * rule + 14}h8'/>`,
    `<path d='${cited.map((i, k) => `M${lx0} ${first + i * rule}h${f((lx1 - lx0) * [0.96, 1, 0.74][k])}`).join('')}' stroke-width='3'/>`,
  ];
  return { w, h, box: `38 ${dy + 6} ${w} ${h}`, sw: C.line, ink, accent };
}

// ---------------------------------------------------------------- services-line
// 1600 by 400. styles.css shows a third in each column and hides what lies under the two column gaps, so each third
// keeps its drawing inside x 40..480, 580..1020 and 1120..1560, and everything inside y 40..360.
function services() {
  const w = 1600, h = 400, yL = 200, yD = 338;
  const S = { line: 2.6, hair: 1.6 };
  const ink = [], accent = [];
  let ticks = '';
  for (let x = 0; x <= w; x += 40) ticks += `M${x} ${yD}v${x % 200 === 0 ? 14 : 7}`;
  ink.push(`<path d='M0 ${yD}H${w}' stroke-width='${S.hair}'/>`, `<path d='${ticks}' stroke-width='${S.hair}'/>`);

  // 1: a model among its tools and sources
  const hub = { x: 262, y: yL, r: 34, R: 110 };
  const spokes = [[-128, 'sq'], [-90, 'doc'], [-52, 'sq'], [128, 'doc'], [90, 'sq'], [52, 'doc']];
  let spokeD = '', boxes = '';
  spokes.forEach(([deg, kind]) => {
    const a = deg * Math.PI / 180, cx = hub.x + hub.R * Math.cos(a), cy = hub.y + hub.R * Math.sin(a);
    spokeD += `M${f(hub.x + hub.r * Math.cos(a))} ${f(hub.y + hub.r * Math.sin(a))}L${f(hub.x + (hub.R - 22) * Math.cos(a))} ${f(hub.y + (hub.R - 22) * Math.sin(a))}`;
    boxes += kind === 'sq'
      ? `M${f(cx - 15)} ${f(cy - 15)}h30v30h-30Z`
      : `M${f(cx - 13)} ${f(cy - 17)}h18l8 8v26h-26ZM${f(cx - 7)} ${f(cy - 2)}h14M${f(cx - 7)} ${f(cy + 6)}h14`;
  });
  ink.push(
    `<circle cx='${hub.x}' cy='${hub.y}' r='${hub.r}' stroke-width='${S.line}'/>`,
    `<circle cx='${hub.x}' cy='${hub.y}' r='${hub.R}' stroke-width='${S.hair}' stroke-dasharray='3 9' stroke-opacity='.7'/>`,
    `<path d='${spokeD}' stroke-width='${S.hair}'/>`,
    `<path d='${boxes}' stroke-width='${S.line}' stroke-linejoin='round'/>`,
    `<path d='M${hub.x} ${hub.y - hub.R - 34}V${yD + 10}' stroke-width='${S.hair}' ${DASHDOT} stroke-opacity='.7'/>`);

  // 2: a platform in three layers
  const st = { x: 800, hw: 156, hh: 29, ys: [yL - 66, yL, yL + 66] };
  const plate = (y) => `M${st.x - st.hw} ${y}L${st.x} ${y - st.hh}L${st.x + st.hw} ${y}L${st.x} ${y + st.hh}Z`;
  ink.push(
    `<path d='${st.ys.map(plate).join('')}' stroke-width='${S.line}' stroke-linejoin='round'/>`,
    `<path d='M${st.x - st.hw} ${st.ys[0]}V${st.ys[2]}M${st.x + st.hw} ${st.ys[0]}V${st.ys[2]}M${st.x} ${st.ys[0] + st.hh}V${st.ys[1] - st.hh}M${st.x} ${st.ys[1] + st.hh}V${st.ys[2] - st.hh}' stroke-width='${S.hair}' stroke-opacity='.75'/>`,
    `<path d='M${st.x - st.hw} ${st.ys[2]}V${yD}M${st.x + st.hw} ${st.ys[2]}V${yD}' stroke-width='${S.hair}' stroke-dasharray='3 7' stroke-opacity='.7'/>`);
  let nodes = '';
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const nx = st.x + (i - j) * 46, ny = st.ys[0] + (i + j) * 8.5; nodes += `<circle cx='${nx}' cy='${f(ny)}' r='4.5' fill='currentColor' stroke='none'/>`; }
  ink.push(nodes);

  // 3: three screens on a ground line
  const g = 312;
  const phone = { x: 1150, w: 78, h: 152 }, wide = { x: 1264, w: 196, h: 134 }, watch = { x: 1494, w: 50, h: 58 };
  ink.push(
    `<rect x='${phone.x}' y='${g - phone.h}' width='${phone.w}' height='${phone.h}' rx='12' stroke-width='${S.line}'/>`,
    `<path d='M${phone.x + 28} ${g - phone.h + 13}h22' stroke-width='${S.hair}'/>`,
    `<rect x='${wide.x}' y='${g - wide.h - 22}' width='${wide.w}' height='${wide.h}' rx='6' stroke-width='${S.line}'/>`,
    `<path d='M${wide.x} ${g - wide.h - 2}h${wide.w}M${wide.x + 70} ${g}h56M${wide.x + 98} ${g - 22}v22' stroke-width='${S.hair}'/>`,
    `<path d='M${wide.x + 18} ${g - 72}h70M${wide.x + 18} ${g - 56}h52' stroke-width='${S.hair}' stroke-opacity='.7'/>`,
    `<rect x='${watch.x}' y='${g - watch.h - 18}' width='${watch.w}' height='${watch.h}' rx='13' stroke-width='${S.line}'/>`,
    `<path d='M${watch.x + 11} ${g - watch.h - 18}v-13h28v13M${watch.x + 11} ${g - 18}v13h28v-13' stroke-width='${S.hair}'/>`,
    `<path d='M${phone.x - 26} ${g}H${watch.x + watch.w + 22}' stroke-width='${S.hair}'/>`);

  // the one line through all three, and where it lands
  const end = wide.x + wide.w - 44;
  accent.push(
    `<path d='M0 ${yL}H${end}' stroke-width='3'/>`,
    `<circle cx='${hub.x}' cy='${yL}' r='7' fill='currentColor' stroke='none'/>`,
    `<circle cx='${st.x}' cy='${yL}' r='7' fill='currentColor' stroke='none'/>`,
    `<circle cx='${end}' cy='${yL}' r='7' fill='currentColor' stroke='none'/>`);
  return { w, h, ink, accent };
}

// Every file this script writes, by name.
function render() {
  const arts = {
    [NAMES.cite]: cite(),
    [NAMES.build]: build(false), [`${NAMES.build}-tall`]: build(true),
    [NAMES.media]: media(false), [`${NAMES.media}-tall`]: media(true),
    [NAMES.services]: services(),
  };
  const files = {};
  for (const [name, art] of Object.entries(arts)) {
    files[`${name}.svg`] = svg(art, art.ink);
    files[`${name}-accent.svg`] = svg(art, art.accent);
  }
  return files;
}

if (require.main === module) {
  const files = render();
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), body);
  console.log(`wrote ${Object.keys(files).join(', ')} to assets/`);
}

module.exports = { BUILD, FM, NAMES, render };
