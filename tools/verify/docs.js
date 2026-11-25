// The docs' facts and the blocks of styles.css. Static, no browser, no server, no npm install.
//
//   node verify/docs.js               the blocks of styles.css, and the page counts the docs state
//   node verify/docs.js --facts       print the facts the docs keep typing: the page counts, the storage keys of
//                                     app.js, the steps of the check chain and the names of the styles.css blocks
//   node verify/docs.js --literals    print every number the docs put before "pages", and how each is read
//   node verify/docs.js --self-test   prove that each rule can fail
//   node verify/docs.js --root <dir>  read another copy of the tree (a scratch copy, for instance)
//
// 1. The blocks of styles.css. The file is a run of blocks, each opened by a banner: a comment whose first line is a
//    rule of dashes (a block) or of equals signs (a group of blocks; the blocks under it follow it), with the
//    block's title on the next line. BLOCKS below is the list of their names in source order, and the check fails
//    when the banners of the file are not exactly that list: a block moved, renamed, added, removed, or turned from
//    a group into a block. A banner matches a name when its title is the name, or the name followed by a colon, an
//    opening bracket or a spaced em dash and a subtitle, so a subtitle can be reworded without touching this list.
//    The order matters because later blocks restyle earlier ones, and the docs name blocks, never positions: with
//    the order held here, a sentence such as "the Liquid Glass block" stays true however many blocks are added.
//
// 2. The page counts in the docs (AGENTS.md, CLAUDE.md, tools/README.md). A number in front of "pages" is read
//    only in the forms listed in RULES, each of which says what it counts ("all 34 pages", "fourteen Swedish
//    pages", "the other 33 pages"), and that form fails when the number is not the one the tree holds. Wrapped
//    lines are read as one line. A number in any other form (a sample, "axe on three pages of each", or a dated
//    measurement) is not read: --literals lists those too, so a person can see what the check leaves alone.
//
// The facts come from the registry and the language table, tools/site/pages and tools/site/langs.json (read by
// _common.js, as every check reads them), and from the files on disk; nothing here parses seo-head.py.
const fs = require('fs');
const path = require('path');
const { ROOT: REPO, readRegistry, readLangs, generatedPages, stripJsComments } = require('./_common');

const DOCS = ['AGENTS.md', 'CLAUDE.md', 'tools/README.md'];

// The blocks of styles.css in source order, by the names the docs use. A group is [name, [its blocks]].
const BLOCKS = [
  'Document',
  'Icons',
  'Layout',
  'Top app bar',
  'Inverse bands',
  'Hero (home)',
  'Hero fit',
  'Sections',
  'Case cards',
  'Metric cards',
  'Call-to-action band',
  'Page hero',
  'Contact page',
  'Long-form pages',
  'Home page, content structure pass',
  'Footer',
  'Consent',
  'Home page',
  'Print',
  'Utilities',
  'Liquid Glass',
  'Silk waves',
  'Rate calculator',
  ['The English home page: its pictures', [
    'Cases',
    'The drawing grows',
    'One sheet',
    'Insights',
    'One picture across the services',
    'Two sets of pictures',
  ]],
  'Languages',
];

// --- 1. the blocks -----------------------------------------------------------------------------------------------

// The list above as rows { name, group }: a group's row, then a row for each of its blocks.
function expectedRows(blocks = BLOCKS) {
  const rows = [];
  for (const b of blocks) {
    if (Array.isArray(b)) {
      rows.push({ name: b[0], group: true });
      for (const c of b[1]) rows.push({ name: c, group: false });
    } else rows.push({ name: b, group: false });
  }
  return rows;
}

// The banners of a stylesheet: { line, group, title } in source order. A banner starts a line with "/*" and a rule
// of at least ten dashes or equals signs; its title is the next line that is not empty.
function readBanners(css) {
  const lines = css.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\/\*\s*([-=])\1{9,}\s*$/.exec(lines[i]);
    if (!m) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    out.push({ line: i + 1, group: m[1] === '=', title: (lines[j] || '').trim().replace(/\s*\*\/$/, '') });
  }
  return out;
}

// True when a banner's title carries the name: the whole title, or the name and then a subtitle after a colon, an
// opening bracket or a spaced em dash.
function titleHasName(title, name) {
  if (title === name) return true;
  if (!title.startsWith(name)) return false;
  const rest = title.slice(name.length);
  return rest.startsWith(': ') || rest.startsWith(' (') || rest.startsWith(' \u2014 ');
}

// The problems of a stylesheet's banners against the list, [] when they are the list.
function blockProblems(css, blocks = BLOCKS) {
  const rows = expectedRows(blocks);
  const problems = [];
  const names = rows.map((r) => r.name);
  const twice = names.filter((n, i) => names.indexOf(n) !== i);
  if (twice.length) problems.push(`BLOCKS in docs.js names ${twice.join(', ')} twice: every block needs a name of its own`);
  const banners = readBanners(css);
  // Each banner is given the longest name in the list that its title carries, so "Home page" and "Home page,
  // content structure pass" cannot be mistaken for each other.
  const named = banners.map((b) => {
    const hits = names.filter((n) => titleHasName(b.title, n)).sort((a, c) => c.length - a.length);
    return Object.assign({}, b, { name: hits.length ? hits[0] : null });
  });
  // The longest run of banners that is in the order of BLOCKS; every banner outside it, and every name of BLOCKS
  // that it does not reach, is a problem of its own, so one moved block is reported once and not as a shift of
  // every block after it.
  const a = names;
  const b = named.map((x) => x.name);
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) L[i][j] = b[j] !== null && a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const inOrder = new Map();         // banner index -> row index
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (b[j] !== null && a[i] === b[j]) { inOrder.set(j, i); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  const reached = new Set(inOrder.values());
  const seen = new Set();
  named.forEach((got, j) => {
    const at = `styles.css:${got.line}`;
    if (got.name === null) {
      problems.push(`${at}: the banner "${got.title}" carries no name in BLOCKS (a renamed block: rename it in BLOCKS and in the docs that cite it; a new block: add its name to BLOCKS, in its place)`);
    } else if (seen.has(got.name)) {
      problems.push(`${at}: a second banner for "${got.name}"`);
    } else if (!inOrder.has(j)) {
      const i = names.indexOf(got.name);
      problems.push(`${at}: "${got.name}" is out of place (BLOCKS puts it ${i === 0 ? 'first' : `after "${names[i - 1]}"`}): a moved block goes back, or moves in BLOCKS and in the docs that cite its place`);
    } else {
      const want = rows[inOrder.get(j)];
      if (got.group !== want.group) problems.push(`${at}: "${want.name}" ${want.group ? 'opens a group in BLOCKS, so its banner is a rule of equals signs' : 'is a block in BLOCKS, so its banner is a rule of dashes'}`);
    }
    if (got.name !== null) seen.add(got.name);
  });
  rows.forEach((want, i) => {
    if (!reached.has(i) && !named.some((x) => x.name === want.name)) problems.push(`"${want.name}" is in BLOCKS but has no banner in styles.css (removed or renamed: take it out of BLOCKS, or rename it there)`);
  });
  return problems;
}

// --- the facts ---------------------------------------------------------------------------------------------------

// The page counts, from the registry, the language table and the folders on disk.
function pageFacts(root) {
  const reg = readRegistry(root);
  const langs = readLangs(root);
  const files = Object.keys(reg);
  const rootEnglish = files.filter((f) => reg[f].lang === 'en').length;
  const rootSwedish = files.filter((f) => reg[f].lang === 'sv').length;
  const withdrawn = files.filter((f) => reg[f].status === 'withdrawn').length;
  const onDisk = fs.readdirSync(root).filter((f) => f.endsWith('.html')).length;
  const gen = generatedPages(root);
  const perLanguage = {};
  const status = {};
  for (const [code, l] of Object.entries(langs)) {
    if (l.kind !== 'generated') continue;
    perLanguage[code] = gen.filter((p) => p.startsWith(code + '/')).length;
    status[code] = l.status || 'live';
  }
  const codes = Object.keys(perLanguage);
  const generated = codes.reduce((s, c) => s + perLanguage[c], 0);
  const generatedLive = codes.filter((c) => status[c] === 'live').reduce((s, c) => s + perLanguage[c], 0);
  const rootHomes = Object.values(langs).filter((l) => l.kind === 'written' && l.home && reg[l.home]).length;
  const generatedHomes = codes.filter((c) => gen.includes(c + '/index.html')).length;
  const pairs = files.filter((f) => reg[f].lang === 'en' && reg[f].alt && reg[f].alt.sv && reg[reg[f].alt.sv]);
  const livePairs = pairs.filter((f) => reg[f].status === 'live' && reg[reg[f].alt.sv].status === 'live').length;
  return {
    rootEnglish, rootSwedish, rootTotal: files.length, onDisk, withdrawn,
    perLanguage, status, generated, generatedLive, all: files.length + generated, allLive: files.length + generatedLive,
    rootHomes, generatedHomes, allHomes: rootHomes + generatedHomes, pairs: pairs.length, livePairs,
  };
}

// The storage keys app.js uses: { key: ['localStorage' | 'sessionStorage', ...] }. A key is a 'vynatix-...' string
// in the code (comments left out); its storage is read from the calls that take the key or the variable that
// holds it. A key with no such call maps to [].
function storageKeys(appSrc) {
  const code = stripJsComments(appSrc);
  const out = {};
  for (const m of code.matchAll(/['"](vynatix-[a-z-]+)['"]/g)) out[m[1]] = out[m[1]] || [];
  for (const key of Object.keys(out)) {
    const esc = key.replace(/[-]/g, '\\-');
    const holders = [...code.matchAll(new RegExp(String.raw`\b([A-Za-z_$][\w$]*)\s*=\s*['"]${esc}['"]`, 'g'))].map((m) => m[1]);
    const args = [String.raw`['"]${esc}['"]`, ...holders.map((h) => String.raw`\b${h}\b`)].join('|');
    for (const m of code.matchAll(new RegExp(String.raw`\b(localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*(?:${args})`, 'g'))) {
      if (!out[key].includes(m[1])) out[key].push(m[1]);
    }
    out[key].sort();
  }
  return out;
}

// The steps of `npm run check`, with every `npm run <script>` in it opened up: [{ step, via }].
function chainSteps(pkg, name = 'check', via = null, seen = new Set()) {
  const scripts = (pkg && pkg.scripts) || {};
  if (typeof scripts[name] !== 'string') throw new Error(`tools/package.json has no "${name}" script`);
  if (seen.has(name)) throw new Error(`tools/package.json: the script "${name}" runs itself`);
  const out = [];
  for (const raw of scripts[name].split('&&')) {
    const step = raw.trim();
    const m = /^npm run ([\w:-]+)$/.exec(step);
    if (m) out.push(...chainSteps(pkg, m[1], `npm run ${m[1]}`, new Set([...seen, name])));
    else out.push({ step, via });
  }
  return out;
}

// --- 2. the page counts in the docs ------------------------------------------------------------------------------

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const UNDER100 = String.raw`(?:(?:${TENS.slice(2).join('|')})(?:[- ](?:${UNITS.slice(1, 10).join('|')}))?|${UNITS.slice().reverse().join('|')})`;
// A count: digits, or words up to "nine hundred and ninety-nine".
const NUM = String.raw`(?:\d[\d,]*|(?:(?:${UNITS.slice(1, 10).join('|')}|a) hundred(?: and ${UNDER100})?)|${UNDER100})`;

// The value of a count as written (digits or words), or NaN.
function numberOf(text) {
  const t = text.toLowerCase().replace(/,/g, '').trim();
  if (/^\d+$/.test(t)) return Number(t);
  let n = 0;
  let rest = t;
  const h = /^(\w+) hundred(?: and )?(.*)$/.exec(rest);
  if (h) {
    const k = h[1] === 'a' ? 1 : UNITS.indexOf(h[1]);
    if (k < 1) return NaN;
    n = 100 * k;
    rest = h[2];
    if (!rest) return n;
  }
  const u = UNITS.indexOf(rest);
  if (u >= 0) return n + u;
  const m = /^(\w+)(?:[- ](\w+))?$/.exec(rest);
  if (!m || TENS.indexOf(m[1]) < 2) return NaN;
  const unit = m[2] ? UNITS.indexOf(m[2]) : 0;
  if (unit < 0 || unit > 9) return NaN;
  return n + 10 * TENS.indexOf(m[1]) + unit;
}

// The forms a page count is read in. Each has a pattern with one N (the count), what it counts, and the values that
// make it true. The first form that matches a count decides; later forms only see the counts left over.
const RULES = [
  { re: String.raw`\bthe other (N) (?:root |hand-written )?pages\b`, counts: 'every page but one',
    ok: (f) => [f.rootTotal - 1, f.all - 1, f.allLive - 1] },
  { re: String.raw`\b(N) generated home pages\b`, counts: 'the home pages of the generated languages', ok: (f) => [f.generatedHomes] },
  { re: String.raw`\b(N) home pages\b`, counts: 'the home pages, at the root or in all', ok: (f) => [f.rootHomes, f.allHomes] },
  // Only with the word "generated": "axe on three pages of each language" is a sample, not a count.
  { re: String.raw`\b(N) (?:generated pages (?:per|in each|of each|for each|in every) language|pages (?:per|in each|of each|for each|in every) generated language)\b`,
    counts: 'the pages of one generated language',
    ok: (f) => { const v = [...new Set(Object.values(f.perLanguage))]; return v.length === 1 ? v : []; } },
  { re: String.raw`\b(N) generated pages\b`, counts: 'the generated pages', ok: (f) => [f.generated, f.generatedLive] },
  { re: String.raw`\b(N) (?:root |hand-written )?English pages\b`, counts: 'the English pages at the root', ok: (f) => [f.rootEnglish] },
  { re: String.raw`\b(N) (?:root |hand-written )?Swedish pages\b`, counts: 'the Swedish pages', ok: (f) => [f.rootSwedish] },
  { re: String.raw`\b(N) (?:root|hand-written) pages\b`, counts: 'the pages at the root', ok: (f) => [f.rootTotal] },
  { re: String.raw`\b(N) of them (?:are )?withdrawn\b`, counts: 'the withdrawn stubs', ok: (f) => [f.withdrawn] },
  { re: String.raw`\b(N) withdrawn (?:stubs|pages)\b`, counts: 'the withdrawn stubs', ok: (f) => [f.withdrawn] },
  { re: String.raw`\ball (N) pages\b`, counts: 'every page, at the root or in all', ok: (f) => [f.rootTotal, f.all, f.allLive] },
  { re: String.raw`\b(N) pages (?:in total|in all)\b`, counts: 'every page, at the root or in all', ok: (f) => [f.rootTotal, f.all, f.allLive] },
  { re: String.raw`\bthe (N) pages (?:above|listed)\b`, counts: 'every page, at the root or in all', ok: (f) => [f.rootTotal, f.all, f.allLive] },
  { re: String.raw`\b(N) pages:`, counts: 'every page, at the root or in all (a count that a list follows)', ok: (f) => [f.rootTotal, f.all, f.allLive] },
];
// "N core English pages" and "M English deep pages" are read as a pair: the docs split the English pages into the
// eleven of the menu, the home page and the notices, and the rest, and no table in the tree says which page is
// which, so only the sum is checked (it has to be the number of English pages at the root).
const CORE = String.raw`\b(N) core English pages\b`;
const DEEP = String.raw`\b(N) (?:English deep|deep English) pages\b`;
const PAIR_SPAN = 400;      // how far after a core count its deep count may stand, in characters of the joined text

const compile = (re) => new RegExp(re.replace('(N)', `(${NUM})`), 'gid');

// The text with every run of white space made one space, so a phrase wrapped over two lines is read as one, and the
// line of each character of it.
function flatten(text) {
  let flat = '';
  const line = [];
  let ln = 1;
  let space = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!space) { flat += ' '; line.push(ln); }
      space = true;
      if (ch === '\n') ln++;
    } else {
      flat += ch;
      line.push(ln);
      space = false;
    }
  }
  return { flat, line };
}

// Every number within the four words before "pages" (not across a stop, a comma or a closing bracket):
// { at, text, phrase }.
function pageNumbers(flat) {
  const out = [];
  const num = new RegExp(String.raw`\b${NUM}\b`, 'gi');
  for (const p of flat.matchAll(/\bpages\b/gi)) {
    const before = flat.slice(Math.max(0, p.index - 160), p.index);
    const words = before.split(' ');
    let start = before.length - words.slice(-5).join(' ').length;
    const stop = Math.max(...['. ', '; ', ': ', '? ', ', ', ') '].map((s) => before.lastIndexOf(s)));
    if (stop >= 0 && stop + 2 > start) start = stop + 2;
    let last = null;
    for (const m of before.slice(start).matchAll(num)) last = m;
    if (!last) continue;
    const at = p.index - before.length + start + last.index;
    out.push({ at, text: last[0], phrase: flat.slice(at, p.index + p[0].length) });
  }
  return out;
}

// The counts of one doc: { checked: [{ line, phrase, n, counts, ok, want }], other: [{ line, phrase }] }.
function readCounts(text, facts) {
  const { flat, line } = flatten(text);
  const taken = new Map();       // where a count starts -> what was read there
  for (const rule of RULES) {
    for (const m of flat.matchAll(compile(rule.re))) {
      const at = m.indices[1][0];
      if (taken.has(at)) continue;
      const n = numberOf(m[1]);
      const want = rule.ok(facts);
      taken.set(at, { line: line[m.index], phrase: m[0], n, counts: rule.counts, ok: want.includes(n), want: [...new Set(want)] });
    }
  }
  const cores = [...flat.matchAll(compile(CORE))];
  const deeps = [...flat.matchAll(compile(DEEP))];
  for (const c of cores) {
    const at = c.indices[1][0];
    const d = deeps.find((x) => x.index > c.index && x.index - c.index <= PAIR_SPAN);
    if (!d) continue;
    const n = numberOf(c[1]) + numberOf(d[1]);
    const read = { line: line[c.index], phrase: `${c[0]} ... ${d[0]}`, n, counts: 'the English pages at the root (core and deep together)',
      ok: n === facts.rootEnglish, want: [facts.rootEnglish] };
    taken.set(at, read);
    taken.set(d.indices[1][0], Object.assign({}, read, { pairPart: true }));
  }
  const checked = [...taken.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r).filter((r) => !r.pairPart);
  const other = pageNumbers(flat).filter((p) => !taken.has(p.at)).map((p) => ({ line: line[p.at], phrase: p.phrase }));
  return { checked, other };
}

// --- running -------------------------------------------------------------------------------------------------------

function run(root) {
  const results = [];
  const add = (ok, name, detail) => results.push({ ok, name, detail: detail || '' });
  const read = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { return null; } };

  const css = read('styles.css');
  if (css === null) add(false, 'styles.css can be read', 'file missing');
  else {
    const bad = blockProblems(css);
    add(bad.length === 0, `the blocks of styles.css are the ${expectedRows().length} of BLOCKS, in order`, bad.join(' | '));
  }

  let facts = null;
  try { facts = pageFacts(root); } catch (e) { add(false, 'the page facts can be read (registry, languages, folders)', e.message); }
  if (facts) {
    add(facts.onDisk === facts.rootTotal, `the root holds the ${facts.rootTotal} pages of the registry`,
      facts.onDisk === facts.rootTotal ? '' : `${facts.onDisk} *.html files at the root; publish.js names the difference`);
    for (const doc of DOCS) {
      const text = read(doc);
      if (text === null) { add(false, `${doc} can be read`, 'file missing'); continue; }
      const { checked } = readCounts(text, facts);
      for (const c of checked) {
        add(c.ok, `${doc}:${c.line} "${c.phrase}" (${c.counts}: ${c.want.join(' or ')})`,
          c.ok ? '' : `it says ${c.n}; write the sentence without the number, or take the number from node verify/docs.js --facts`);
      }
    }
  }
  return results;
}

function printFacts(root) {
  const f = pageFacts(root);
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, Math.max(n, s.length));
  const out = [];
  out.push('Pages (the registry and the language table in tools/site, and the folders on disk)');
  out.push(`  ${pad('root, English', 26)}${f.rootEnglish}`);
  out.push(`  ${pad('root, Swedish', 26)}${f.rootSwedish}`);
  out.push(`  ${pad('root, in all', 26)}${f.rootTotal} (${f.withdrawn} of them withdrawn stubs)`);
  for (const [code, n] of Object.entries(f.perLanguage)) out.push(`  ${pad(`generated, ${code}`, 26)}${n}${f.status[code] === 'live' ? '' : ` (${f.status[code]}, not published)`}`);
  out.push(`  ${pad('generated, in all', 26)}${f.generated}${f.generated === f.generatedLive ? '' : ` (${f.generatedLive} of them live)`}`);
  out.push(`  ${pad('all pages', 26)}${f.all}${f.all === f.allLive ? '' : ` (${f.allLive} published)`}`);
  out.push(`  ${pad('home pages', 26)}${f.rootHomes} at the root, ${f.generatedHomes} generated, ${f.allHomes} in all`);
  out.push(`  ${pad('English/Swedish pairs', 26)}${f.livePairs} live${f.pairs === f.livePairs ? '' : ` (${f.pairs} in the registry, ${f.pairs - f.livePairs} of them withdrawn)`}`);

  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const keys = storageKeys(app);
  const by = (s) => Object.keys(keys).filter((k) => keys[k].includes(s)).sort();
  out.push('', 'Storage keys (app.js, the one script the pages load)');
  out.push(`  ${pad('localStorage', 26)}${by('localStorage').join(', ') || 'none'}`);
  out.push(`  ${pad('sessionStorage', 26)}${by('sessionStorage').join(', ') || 'none'}`);
  const loose = Object.keys(keys).filter((k) => !keys[k].length).sort();
  if (loose.length) out.push(`  ${pad('named, no storage call', 26)}${loose.join(', ')}`);

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'package.json'), 'utf8'));
  const steps = chainSteps(pkg);
  out.push('', `The check chain (npm run check, tools/package.json): ${steps.length} steps, run from tools/`);
  steps.forEach((s, i) => out.push(`  ${pad(String(i + 1), 4)}${s.step}${s.via ? `   (${s.via})` : ''}`));

  out.push('', 'The blocks of styles.css, in order (the names the docs use; BLOCKS in this script)');
  let i = 0;
  for (const b of BLOCKS) {
    i++;
    if (Array.isArray(b)) {
      out.push(`  ${pad(String(i), 4)}${b[0]} (a group)`);
      for (const c of b[1]) out.push(`        ${c}`);
    } else out.push(`  ${pad(String(i), 4)}${b}`);
  }
  console.log(out.join('\n'));
}

function printLiterals(root) {
  const facts = pageFacts(root);
  for (const doc of DOCS) {
    const text = fs.readFileSync(path.join(root, doc), 'utf8');
    const { checked, other } = readCounts(text, facts);
    const rows = [
      ...checked.map((c) => ({ line: c.line, s: `${c.ok ? 'true ' : 'FALSE'} ${doc}:${c.line} "${c.phrase}": ${c.counts}, ${c.n} (the tree: ${c.want.join(' or ')})` })),
      ...other.map((o) => ({ line: o.line, s: `not read ${doc}:${o.line} "${o.phrase}"` })),
    ].sort((a, b) => a.line - b.line);
    for (const r of rows) console.log(r.s);
  }
}

// --- self-test: each rule fails on the case it exists for, and passes on the case next to it ------------------------

function selfTest(root) {
  const results = [];
  const t = (ok, name, detail) => results.push({ ok: !!ok, name, detail: detail || '' });

  // Blocks: a stylesheet written from BLOCKS passes, and each damage fails for its own reason.
  const banner = (title, group) => {
    const r = group ? '='.repeat(63) : '-'.repeat(63);
    return `/* ${r}\n   ${title}\n   ${r} */\n.x { margin: 0; }\n`;
  };
  const sheet = (rows) => rows.map((r) => banner(r.title, r.group)).join('\n');
  const rows = expectedRows().map((r) => ({ title: r.name, group: r.group }));
  const subtitled = rows.map((r, i) => (i % 3 === 0 ? Object.assign({}, r, { title: `${r.title}: a subtitle` })
    : i % 3 === 1 ? Object.assign({}, r, { title: `${r.title} \u2014 a subtitle` }) : r));
  t(blockProblems(sheet(rows)).length === 0, 'blocks: a stylesheet with the banners of BLOCKS passes', blockProblems(sheet(rows)).join(' | '));
  t(blockProblems(sheet(subtitled)).length === 0, 'blocks: a subtitle after a colon or a spaced em dash is not a rename', blockProblems(sheet(subtitled)).join(' | '));
  const fails = (name, css, reason) => {
    const p = blockProblems(css);
    t(p.length > 0 && p.some((x) => reason.test(x)), `blocks: ${name} fails`, p.length ? `the problems were: ${p.join(' | ')}` : 'it passed');
  };
  const iPrint = rows.findIndex((r) => r.title === 'Print');
  const swapped = rows.slice(); [swapped[iPrint], swapped[iPrint + 1]] = [swapped[iPrint + 1], swapped[iPrint]];
  fails('two blocks swapped (Print and Utilities)', sheet(swapped), /"(Print|Utilities)" is out of place/);
  const iLang = rows.findIndex((r) => r.title === 'Languages');
  const moved = rows.slice(); moved.splice(iLang, 1); moved.splice(iLang - 7, 0, rows[iLang]);
  fails('Languages moved in front of the pictures', sheet(moved), /"Languages" is out of place \(BLOCKS puts it after "Two sets of pictures"\)/);
  const iHome = rows.findIndex((r) => r.title === 'Home page');
  const homes = rows.slice(); const iStruct = rows.findIndex((r) => r.title === 'Home page, content structure pass');
  [homes[iHome], homes[iStruct]] = [homes[iStruct], homes[iHome]];
  fails('the two "Home page" blocks swapped', sheet(homes), /"Home page(, content structure pass)?" is out of place/);
  fails('a block renamed (Silk waves to Silk)', sheet(rows.map((r) => (r.title === 'Silk waves' ? Object.assign({}, r, { title: 'Silk' }) : r))), /"Silk" carries no name/);
  fails('a name run into its subtitle (Hero fitting)', sheet(rows.map((r) => (r.title === 'Hero fit' ? Object.assign({}, r, { title: 'Hero fitting' }) : r))), /"Hero fitting" carries no name/);
  fails('a new block at the end', sheet(rows) + banner('Print, again', false), /"Print, again" carries no name/);
  fails('a block removed', sheet(rows.filter((r) => r.title !== 'Consent')), /"Consent" is in BLOCKS but has no banner/);
  fails('a block given two banners', sheet(rows) + banner('Footer', false), /a second banner for "Footer"/);
  fails('the group drawn as a block', sheet(rows.map((r) => Object.assign({}, r, { group: false }))), /opens a group in BLOCKS/);
  t(blockProblems('', ['A', 'B', 'A']).some((x) => /names A twice/.test(x)), 'blocks: a name given twice in BLOCKS fails');
  // The same on the real file: a block moved there is caught by the parser that reads it.
  let real = null;
  try { real = fs.readFileSync(path.join(root, 'styles.css'), 'utf8'); } catch (e) { /* reported below */ }
  t(real !== null, 'blocks: styles.css can be read for the self-test');
  if (real) {
    const lines = real.split('\n');
    const at = (title) => lines.findIndex((l, i) => i > 0 && /^\/\* -{10,}/.test(lines[i - 1]) && l.trim().startsWith(title)) - 1;
    const a = at('Print');
    const b = at('Utilities');
    const c = at('Liquid Glass');
    t(a > 0 && b > a && c > b, 'blocks: the Print, Utilities and Liquid Glass banners are found in styles.css');
    if (a > 0 && b > a && c > b) {
      const swappedReal = [...lines.slice(0, a), ...lines.slice(b, c), ...lines.slice(a, b), ...lines.slice(c)].join('\n');
      fails('Print and Utilities swapped in the real styles.css', swappedReal, /"(Print|Utilities)" is out of place/);
    }
  }

  // Counts: fixed facts (the tree as it stood on 24 November 2026), and sentences that must pass or fail.
  const per = { es: 16, fr: 16, de: 16, ja: 16, ar: 16 };
  const F = { rootEnglish: 20, rootSwedish: 14, rootTotal: 34, onDisk: 34, withdrawn: 3, perLanguage: per,
    status: { es: 'live', fr: 'live', de: 'live', ja: 'live', ar: 'live' }, generated: 80, generatedLive: 80, all: 114, allLive: 114,
    rootHomes: 2, generatedHomes: 5, allHomes: 7, pairs: 11, livePairs: 10 };
  const verdict = (text, facts = F) => readCounts(text, facts).checked;
  const pass = (text, facts) => { const c = verdict(text, facts); t(c.length > 0 && c.every((x) => x.ok), `counts: "${text.replace(/\s+/g, ' ')}" is read and true`, JSON.stringify(c)); };
  const fail = (text, facts) => { const c = verdict(text, facts); t(c.some((x) => !x.ok), `counts: "${text.replace(/\s+/g, ' ')}" fails`, JSON.stringify(c)); };
  const ignored = (text) => { const c = verdict(text); t(c.length === 0, `counts: "${text}" is not read as a count of the site's pages`, JSON.stringify(c)); };
  pass('Thirty-four pages: eleven core English pages (`blog.html`), nine English\n  deep pages and fourteen Swedish pages.');
  fail('Thirty-four pages: eleven core English pages, ten English deep pages and fourteen Swedish pages.');
  fail('Thirty-five pages: eleven core English pages, nine English deep pages and fourteen Swedish pages.');
  fail('Thirty-four pages: eleven core English pages, nine English deep pages and fifteen Swedish pages.');
  pass('Thirty-four pages in total, three of them withdrawn stubs');
  pass('Three of them are withdrawn stubs, of the thirty-four pages above.');
  fail('Four of them are withdrawn stubs.');
  fail('the four withdrawn stubs');
  pass('the meta on all 34 pages');
  pass('on all 114 pages');
  fail('undecided on all\n  23 pages sends nothing');
  fail('LCP equals first paint on all 20 pages');
  fail('so the other twenty-three pages never download it');
  pass('so the other thirty-three pages never download it');
  pass('the other 113 pages');
  pass('the 80 generated pages, 16 generated pages per language');
  pass('sixteen pages in each generated language');
  fail('the 81 generated pages');
  fail('17 generated pages per language');
  fail('16 pages in each generated language', Object.assign({}, F, { perLanguage: Object.assign({}, per, { de: 17 }) }));
  pass('The two home pages');
  pass('applied to seven home pages');
  fail('the three home pages');
  pass('the five generated home pages');
  pass('the 34 root pages');
  fail('the thirty-three root pages');
  pass('twenty English pages');
  fail('nineteen hand-written English pages');
  pass('one hundred and fourteen pages in total');
  fail('a hundred and fifteen pages in all');
  ignored('pixels over the live silk (twelve pages, both themes)');
  ignored('axe on three pages of each language');
  ignored('the two deep pages');
  ignored('eleven core English pages');
  t(numberOf('Thirty-four') === 34 && numberOf('one hundred and fourteen') === 114 && numberOf('a hundred') === 100 && numberOf('1,641') === 1641 && numberOf('eleven') === 11,
    'counts: numbers are read in digits and in words');
  const listed = readCounts('down five pages, both themes', F).other;
  t(listed.length === 1 && listed[0].phrase === 'five pages', '--literals: a number that is not read is still listed', JSON.stringify(listed));

  // The printers: storage keys by storage, and the chain with its npm scripts opened up.
  const keys = storageKeys("var K = 'vynatix-a'; // localStorage.getItem('vynatix-c')\nlocalStorage.setItem(K, 1); sessionStorage.getItem('vynatix-b'); var L = 'vynatix-d';");
  t(JSON.stringify(keys) === JSON.stringify({ 'vynatix-a': ['localStorage'], 'vynatix-b': ['sessionStorage'], 'vynatix-d': [] }),
    '--facts: storage keys are read by storage, comments left out', JSON.stringify(keys));
  const steps = chainSteps({ scripts: { check: 'node a.js && npm run sub && node c.js', sub: 'node b.js --x && node b2.js' } });
  t(steps.map((s) => s.step).join(',') === 'node a.js,node b.js --x,node b2.js,node c.js' && steps[1].via === 'npm run sub',
    '--facts: the chain opens up npm run', JSON.stringify(steps));
  let loop = '';
  try { chainSteps({ scripts: { check: 'npm run check' } }); } catch (e) { loop = e.message; }
  t(/runs itself/.test(loop), '--facts: a chain that runs itself is refused', loop);
  return results;
}

function report(results, passText, failText) {
  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${!r.ok && r.detail ? ': ' + r.detail : ''}`);
  }
  console.log(bad === 0 ? `\nPASS: ${passText}` : `\nFAIL: ${bad} problem(s) ${failText}`);
  return bad === 0 ? 0 : 1;
}

module.exports = { BLOCKS, readBanners, blockProblems, pageFacts, storageKeys, chainSteps, readCounts, numberOf, run, selfTest };

if (require.main === module) {
  const argv = process.argv.slice(2);
  let root = REPO;
  const r = argv.indexOf('--root');
  if (r >= 0) {
    if (!argv[r + 1]) { console.error('--root needs a directory'); process.exit(2); }
    root = path.resolve(argv[r + 1]);
  }
  const known = ['--facts', '--literals', '--self-test', '--root'];
  const unknown = argv.filter((a, i) => a.startsWith('--') && !known.includes(a) && argv[i - 1] !== '--root');
  if (unknown.length) { console.error(`unknown option ${unknown[0]} (known: ${known.join(', ')})`); process.exit(2); }
  if (argv.includes('--facts')) { printFacts(root); process.exit(0); }
  if (argv.includes('--literals')) { printLiterals(root); process.exit(0); }
  if (argv.includes('--self-test')) {
    process.exit(report(selfTest(root), 'the block check and the count check fail for the right reasons', 'in the self-test'));
  }
  process.exit(report(run(root), 'the blocks of styles.css are in order and every page count the docs state is true', 'in the docs or in styles.css'));
}
