// Shared config for the verification scripts.
const fs = require('fs');
const path = require('path');

// The repository root: the tree these scripts read static files from (EDGE-SETUP.md,
// app.js, the pages). The scripts that open a browser read the tree through BASE.
const ROOT = path.join(__dirname, '..', '..');

// The page registry: tools/site/pages/<slug>.json, one JSON file per page written by hand (the row of about.html is
// about.json). tools/seo-head.py documents the keys, refuses an unknown key or a value of the wrong type, and loads
// the same files into its PAGES; `seo-head.py --check` is in the chain. Read here (Python is not run):
// { 'file.html': { lang, type, og, pub, mod, alt: { sv: 'file.html' }, article, status, kind, original } }, in the
// registry's order, which is the order of sitemap.xml: the rows that carry an `order` by it, then the others by
// `pub` and then by slug, compared as plain strings, as load_pages() in seo-head.py sorts them. `alt` defaults to
// {}, `article` to false, `status` to 'live' and `kind` to null. `original` is the effective value: the key when
// given, otherwise true for an English page (the English page of a pair is its original unless the registry says
// otherwise). `order` and `note` say nothing about the page and are left out. A folder or a file it cannot read, a
// file that holds no JSON object, and a bad status or kind throw, because a row that is silently dropped or misread
// would turn a withdrawn page into a live one for the checks that use it.
const REGISTRY_DIR = path.join('tools', 'site', 'pages');
function registryOrder(a, b) {
  const ao = a.row.order, bo = b.row.order;
  if (ao !== undefined || bo !== undefined) {
    if (ao === undefined) return 1;
    if (bo === undefined) return -1;
    if (ao !== bo) return ao < bo ? -1 : 1;
  }
  const ap = String(a.row.pub), bp = String(b.row.pub);
  if (ap !== bp) return ap < bp ? -1 : 1;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
function readRegistry(root = ROOT) {
  let names;
  try { names = fs.readdirSync(path.join(root, REGISTRY_DIR)).sort(); } catch (e) {
    throw new Error(`tools/site/pages cannot be read (${e.code || e.message}); the registry is one JSON file per page there`);
  }
  const rows = [];
  for (const name of names) {
    const rel = `tools/site/pages/${name}`;
    if (!/^[^./][^/]*\.json$/.test(name)) throw new Error(`${rel}: only rows belong in tools/site/pages, one <slug>.json per page`);
    let row;
    try { row = JSON.parse(fs.readFileSync(path.join(root, REGISTRY_DIR, name), 'utf8')); } catch (e) { throw new Error(`${rel} cannot be read as JSON (${e.message})`); }
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${rel} holds no JSON object`);
    rows.push({ slug: name.slice(0, -'.json'.length), row });
  }
  rows.sort(registryOrder);
  const out = {};
  for (const { slug, row } of rows) {
    const e = { alt: {}, article: false, status: 'live', kind: null };
    for (const [k, v] of Object.entries(row)) if (k !== 'order' && k !== 'note') e[k] = v;
    if (!['live', 'withdrawn'].includes(e.status)) throw new Error(`tools/site/pages/${slug}.json has status "${e.status}" (live or withdrawn)`);
    if (e.kind !== null && e.kind !== 'post') throw new Error(`tools/site/pages/${slug}.json has kind "${e.kind}" (post, or leave it out)`);
    if (typeof e.original !== 'boolean') e.original = e.lang === 'en';
    out[slug + '.html'] = e;
  }
  return out;
}

// PAGES: the root pages, written by hand. They are the files of the registry, in its order; every check that walks
// the pages walks this list, and publish.js holds it equal to the *.html files at the root. It is read when a script
// first asks for it (module.exports.PAGES, at the end of this file), so a registry that cannot be read stops that
// script with the reader's error instead of giving an empty list that every check would pass over, and a script
// that never asks, such as check.js, still starts.
let rootPagesRead = null;
const rootPages = () => (rootPagesRead = rootPagesRead || Object.keys(readRegistry(ROOT)));

// The language table: tools/site/langs.json, { es: { name, tag, locale, dir, kind, status, pub, mod, checked, by },
// ... } in the file's order, which is the order of LANGS in tools/seo-head.py (it documents and checks the keys).
// kind is 'written' (English, Swedish: the pages in PAGES) or 'generated' (a folder of pages tools/seo-head.py builds
// from the English ones and tools/i18n/<code>.json). `note` is left out. A file it cannot read, or an entry without
// its kind, tag and dir, throws.
function readLangs(root = ROOT) {
  const rel = 'tools/site/langs.json';
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch (e) { throw new Error(`${rel} cannot be read as JSON (${e.message})`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${rel} holds no JSON object`);
  const out = {};
  for (const [code, l] of Object.entries(data)) {
    if (!/^[a-z]{2}$/.test(code) || !l || typeof l !== 'object' || !l.kind || !l.tag || !l.dir) throw new Error(`${rel}: cannot read the entry for ${code}`);
    const e = {};
    for (const [k, v] of Object.entries(l)) if (k !== 'note') e[k] = v;
    out[code] = e;
  }
  if (!out.en) throw new Error(`${rel}: no entry for en`);
  return out;
}
// The pages of the generated languages on disk, 'es/services.html', in the order of LANGS. A tree from before the
// language table became data (tools/REFACTORING-PLAN.md, step 2.1), such as the merge base that screenshot.js
// against reads, has no tools/site/langs.json; there the languages are the ones tools/i18n/messages.json lists, which
// seo-head.py writes in the same order. A langs.json that exists and cannot be read still throws.
function generatedLanguages(root) {
  try { return Object.entries(readLangs(root)).filter(([, l]) => l.kind === 'generated').map(([code]) => code); } catch (e) {
    if (fs.existsSync(path.join(root, 'tools', 'site', 'langs.json'))) throw e;
    let listed;
    try { listed = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'i18n', 'messages.json'), 'utf8')).languages; } catch (e2) { throw e; }
    if (!Array.isArray(listed) || !listed.every((c) => /^[a-z]{2}$/.test(c))) throw e;
    return listed;
  }
}
function generatedPages(root = ROOT) {
  const out = [];
  for (const code of generatedLanguages(root)) {
    let files = [];
    try { files = fs.readdirSync(path.join(root, code)).filter((f) => f.endsWith('.html')).sort(); } catch (e) { /* not built */ }
    for (const f of files) out.push(code + '/' + f);
  }
  return out;
}

// The page that carries the privacy notice (and the in-page consent panel) in each language.
const NOTICE_PAGES = { en: 'privacy.html', sv: 'integritet.html' };

const BASE = process.env.BASE || 'http://localhost:8000/';

// The site's two theme ids: Monochrome light and dark, its one colour scheme (the design
// system's Forest and Teal themes stay in tokens.css but no page shows them). The checks run on
// both by default; THEMES=mono-light or THEMES=mono-dark narrows a run.
const ALL_THEMES = ['mono-light', 'mono-dark'];
const THEMES = (process.env.THEMES || ALL_THEMES.join(',')).split(',').map((t) => t.trim()).filter(Boolean);
for (const t of THEMES) {
  if (!ALL_THEMES.includes(t)) { console.error(`Unknown theme "${t}" (expected one of ${ALL_THEMES.join(', ')})`); process.exit(2); }
}

// The site has one colour scheme, Monochrome, and takes light or dark from the visitor's choice
// (localStorage "vynatix-theme", of which app.js reads only the light/dark half, so a legacy id
// such as "light" still pins mono-light). A check that needs a particular theme has to set it
// before the page loads: pass this to page.addInitScript(pinTheme, id), where id is a theme id.
// It is serialised into the page, so it must stay self-contained. (The home hero's drafting
// sheet is pure CSS and always drawn: there is nothing to pin for it.)
function pinTheme(theme) {
  try {
    localStorage.setItem('vynatix-theme', theme);
    localStorage.setItem('vynatix-motion', 'off');     // the silk background still: pixel checks need one pose (waves.js tests the drift)
  } catch (e) { /* storage blocked: the page follows the system's light/dark */ }
}

// --- Consent -------------------------------------------------------------------------------

// localStorage key and answer format the consent module in app.js uses:
// "<POLICY_VERSION>:granted|denied:<UTC date of the click>". consent.js asserts that
// POLICY_VERSION and CONSENT_KEY below still equal the ones in app.js.
const CONSENT_KEY = 'vynatix-consent';
const POLICY_VERSION = 'v1';
// The other key the site writes (the theme IIFE in app.js). Both notices name both in <code>.
const THEME_KEY = 'vynatix-theme';
// The key the retired colour-scheme draw used to write. Nothing may write it now, and the notices no longer name it.
const LOOK_KEY = 'vynatix-look';
// What the retired hero-background draw used: its storage keys all began with this, and it set this attribute on
// <html>. The hero has one background now, the drafting sheet, and nothing is drawn, stored or set for it.
const BG_KEY_PREFIX = 'vynatix-bg';
const BG_ATTR = 'data-bg';

// The Measurement ID every browser check runs with, and the shape app.js treats as "not set yet".
const TEST_ID = 'G-TEST000000';
const PLACEHOLDER_ID = 'G-XXXXXXXXXX';

// The only Google sources the Content-Security-Policy may name (EDGE-SETUP.md, contract section 8):
// connect-src carries the three hosts, script-src carries the one path on the first.
const GOOGLE_HOSTS = ['https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com'];
const GTAG_SCRIPT = 'https://www.googletagmanager.com/gtag/js';

// Does a real host name fall under a CSP host source such as https://*.google-analytics.com?
// A wildcard needs at least one label in front, as in CSP: *.example.com does not match example.com.
function hostMatchesSource(hostname, source) {
  const host = String(source).replace(/^[a-z]+:\/\//, '').replace(/[:/].*$/, '').toLowerCase();
  const h = String(hostname).toLowerCase();
  if (host.startsWith('*.')) return h.endsWith(host.slice(1)) && h.length > host.length - 1;
  return h === host;
}
const isAllowedGoogleHost = (hostname) => GOOGLE_HOSTS.some((s) => hostMatchesSource(hostname, s));
// Any host that belongs to Google, allow-listed or not: used to catch a request or CSP source that strays.
const GOOGLEISH = /(^|\.)(google(\.[a-z]{2,3}){1,2}|googleapis\.com|gstatic\.com|googletagmanager\.com|google-analytics\.com|googleadservices\.com|googlesyndication\.com|doubleclick\.net|googleusercontent\.com|ggpht\.com|youtube\.com|g\.co)$/i;
const isGoogleHost = (hostname) => GOOGLEISH.test(String(hostname));

// Sets the stored consent answer before the page loads, the way app.js writes it, with today's UTC date:
// page.addInitScript(pinConsent, 'granted' | 'denied' | 'undecided'). "undecided" removes the key.
// It writes on every navigation, so a check that clicks Accept and then loads another page must not pin.
// Serialised into the page, so it must stay self-contained.
function pinConsent(value) {
  if (value !== 'granted' && value !== 'denied' && value !== 'undecided') throw new Error('pinConsent: unknown state ' + value);
  try {
    if (value === 'undecided') { localStorage.removeItem('vynatix-consent'); return; }
    localStorage.setItem('vynatix-consent', 'v1:' + value + ':' + new Date().toISOString().slice(0, 10));
  } catch (e) { /* storage blocked: the module treats that as no answer */ }
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

// Masks anything shaped like a Measurement ID except the dummy one, for output that may carry a request URL.
const redact = (s) => String(s).replace(/G-[A-Z0-9]{6,12}/g, (m) => (m === TEST_ID ? m : 'G-REDACTED'));

// --- The constants of app.js -------------------------------------------------------------------------------------
// appConst(name, src, type) is the one reader of a constant of app.js: no check matches `var NAME = ...` with a
// pattern of its own. It reads the file without running it and returns the value of the name's one declaration,
// `var NAME = <value>;` (let and const are read the same way), which has to stand at the top level of the file or
// of one of its feature blocks. It evaluates only a literal it can prove: a string, a number, true or false, an
// array or object of those, and a product, quotient or sum of numbers (365 * 24 * 60 * 60, 5 / 52). Everything else
// throws, with the
// name and the line: a name that is not declared, a name declared twice anywhere in the file (in two feature
// blocks, or as a var and a function) or assigned again after its declaration, a declaration inside a nested block
// or function, and a value that is not such a literal (a call, another name, two strings joined with
// +). So a reformat of app.js either reads the same value or stops the check that asked, and never hands it a wrong
// number, as the old pattern for `var NAME = (\d+)` did with a product, which it read as its first factor.
// type ('string', 'number', 'boolean', 'array' or 'object') makes a value of another kind throw as well.
// Comments are blanked first (stripJsComments), and a string or a regular expression literal is one token, so a
// comment or a string that says `var NAME =` is no declaration. What it cannot see: a property written later on an
// object constant (COPY.en.label = ...); app.js writes none. src is the text of app.js; without it the file in the
// tree is read.
const JS_PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=',
  '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
// The operators that write to the name in front of them (and ++ or -- in front of a name writes to it too).
const JS_WRITE = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=', '++', '--']);
// After these words a slash opens a regular expression; the same list as in stripJsComments, so the two agree.
const JS_REGEX_AFTER = /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else)$/;
const JS_NUMBER = /0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

// The tokens of app.js, comments left out: { type: 'name' | 'num' | 'str' | 'template' | 'regex' | 'punct', text,
// line }. A slash opens a regular expression exactly where stripJsComments takes it for one.
function jsTokens(src) {
  const code = stripJsComments(src);
  const out = [];
  const n = code.length;
  let i = 0, line = 1;
  const fail = (why, at) => { throw new Error(`app.js: ${why} on line ${at}, so no constant of it can be read`); };
  while (i < n) {
    const c = code[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    const start = i, at = line, prev = out[out.length - 1];
    let type = 'punct';
    if (/[A-Za-z_$]/.test(c)) {
      while (i < n && /[\w$]/.test(code[i])) i++;
      type = 'name';
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(code[i + 1] || ''))) {
      JS_NUMBER.lastIndex = i;
      JS_NUMBER.exec(code);
      i = JS_NUMBER.lastIndex;
      type = 'num';
    } else if (c === '"' || c === "'" || c === '`') {
      for (i++; i < n && code[i] !== c; i++) {
        if (code[i] === '\\') { if (code[i + 1] === '\n') line++; i++; continue; }
        if (code[i] === '\n') { if (c !== '`') fail('a string runs past the end of its line', at); line++; }
      }
      if (i >= n) fail('a string is not closed', at);
      i++;
      type = c === '`' ? 'template' : 'str';
    } else if (c === '/' && (!prev || (prev.type === 'punct' && /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev.text)) || (prev.type === 'name' && JS_REGEX_AFTER.test(prev.text)))) {
      let inClass = false;
      for (i++; i < n && code[i] !== '\n'; i++) {
        if (code[i] === '\\') { i++; continue; }
        if (code[i] === '[') inClass = true;
        else if (code[i] === ']') inClass = false;
        else if (code[i] === '/' && !inClass) break;
      }
      if (code[i] !== '/') fail('a regular expression is not closed', at);
      for (i++; i < n && /[A-Za-z]/.test(code[i]); i++);
      type = 'regex';
    } else {
      const p = JS_PUNCT.find((q) => code.startsWith(q, i));
      i += p ? p.length : 1;
    }
    out.push({ type, text: code.slice(start, i), line: at });
  }
  return out;
}

// Every declaration in app.js and every later write to a variable, by name: { toks, decls, writes }. A declaration
// is { line, depth (braces open around it), kind ('var' or 'function'), init (the token its value starts at, or -1) }.
// The commas of a var statement are told from those inside its values by the bracket level the statement opened at.
const constIndexes = new Map();
function constIndex(src) {
  if (constIndexes.has(src)) return constIndexes.get(src);
  const toks = jsTokens(src);
  const decls = new Map(), writes = new Map();
  const note = (map, name, v) => { if (!map.has(name)) map.set(name, []); map.get(name).push(v); };
  const is = (t, text) => !!t && t.type === 'punct' && t.text === text;
  const lists = [];                    // the bracket levels of the var statements still open, innermost last
  let level = 0, depth = 0, expect = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], prev = toks[i - 1], next = toks[i + 1];
    const open = lists.length ? lists[lists.length - 1] : -1;
    const declarator = expect;
    expect = false;
    if (t.type === 'punct') {
      if (t.text === '(' || t.text === '[' || t.text === '{') { level++; if (t.text === '{') depth++; }
      else if (t.text === ')' || t.text === ']' || t.text === '}') {
        level--;
        if (t.text === '}') depth--;
        while (lists.length && lists[lists.length - 1] > level) lists.pop();
      } else if (t.text === ';' && open === level) lists.pop();
      else if (t.text === ',' && open === level) expect = true;
      continue;
    }
    if (t.type !== 'name' || is(prev, '.') || is(prev, '?.')) continue;   // a property is no variable
    if (t.text === 'var' || t.text === 'let' || t.text === 'const') {
      if (open === level) lists.pop();                                     // the last statement lacked its semicolon
      lists.push(level);
      expect = true;
      continue;
    }
    if (declarator) {
      note(decls, t.text, { line: t.line, depth, kind: 'var', init: is(next, '=') ? i + 2 : -1 });
      if (is(next, '=')) i++;                                              // the = that gives the value writes nothing more
      continue;
    }
    if (t.text === 'function' && next && next.type === 'name') { note(decls, next.text, { line: next.line, depth, kind: 'function', init: -1 }); i++; continue; }
    if ((t.text === 'in' || t.text === 'of') && open === level) { lists.pop(); continue; }   // for (var k in o)
    if ((next && next.type === 'punct' && JS_WRITE.has(next.text)) || is(prev, '++') || is(prev, '--')) note(writes, t.text, t.line);
  }
  if (constIndexes.size >= 32) constIndexes.clear();                      // the release gate's self-test reads many variants
  const index = { toks, decls, writes };
  constIndexes.set(src, index);
  return index;
}

// The value of a JavaScript string literal, quotes included in `text`. An escape the reader cannot be sure of (an
// octal one, a malformed \x or \u) throws.
function jsString(text, fail) {
  const body = text.slice(1, -1);
  const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' };
  let out = '';
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '\\') { out += body[i]; continue; }
    const d = body[++i];
    if (Object.prototype.hasOwnProperty.call(simple, d)) out += simple[d];
    else if (d === '0' && !/[0-9]/.test(body[i + 1] || '')) out += '\0';
    else if (/[0-9]/.test(d)) fail('a string has an octal escape');
    else if (d === 'x') {
      if (!/^[0-9a-fA-F]{2}$/.test(body.slice(i + 1, i + 3))) fail('a string has a malformed \\x escape');
      out += String.fromCharCode(parseInt(body.slice(i + 1, i + 3), 16));
      i += 2;
    } else if (d === 'u' && body[i + 1] === '{') {
      const end = body.indexOf('}', i);
      const hex = end < 0 ? '' : body.slice(i + 2, end);
      if (!/^[0-9a-fA-F]{1,6}$/.test(hex) || parseInt(hex, 16) > 0x10ffff) fail('a string has a malformed \\u{} escape');
      out += String.fromCodePoint(parseInt(hex, 16));
      i = end;
    } else if (d === 'u') {
      if (!/^[0-9a-fA-F]{4}$/.test(body.slice(i + 1, i + 5))) fail('a string has a malformed \\u escape');
      out += String.fromCharCode(parseInt(body.slice(i + 1, i + 5), 16));
      i += 4;
    } else if (d === '\r') { if (body[i + 1] === '\n') i++; }            // a line continuation adds nothing
    else if (d !== '\n' && d !== '\u2028' && d !== '\u2029') out += d;   // any other escaped character is itself
  }
  return out;
}

function appConst(name, src, type) {
  if (src === undefined) src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const { toks, decls, writes } = constIndex(src);
  const all = decls.get(name) || [];
  if (!all.length) throw new Error(`app.js: ${name} is not declared (no var ${name} = ...; outside comments and strings)`);
  if (all.length > 1) throw new Error(`app.js: ${name} is declared ${all.length} times (lines ${all.map((d) => d.line).join(' and ')}), so which value counts cannot be read`);
  const d = all[0];
  const again = writes.get(name) || [];
  if (again.length) throw new Error(`app.js: ${name} (line ${d.line}) is assigned again on line ${again.join(' and ')}, so the value it is declared with is not proven`);
  if (d.depth > 1) throw new Error(`app.js: ${name} (line ${d.line}) is declared inside a nested block or function, not at the top of a feature block`);
  if (d.kind !== 'var' || d.init < 0) throw new Error(`app.js: ${name} (line ${d.line}) is given no value where it is declared`);
  const is = (t, text) => !!t && t.type === 'punct' && t.text === text;
  const shown = (t) => (t ? `"${t.text.length > 40 ? t.text.slice(0, 40) + '...' : t.text}" on line ${t.line}` : 'the end of the file');
  const fail = (why, t) => {
    throw new Error(`app.js: ${name} (line ${d.line}) is not a literal the reader can prove: ${why}${t !== undefined ? ` at ${shown(t)}` : ''}. ` +
      'It reads only a string, a number, true or false, an array or object of those, and a product, quotient or sum of numbers');
  };
  const number = (i) => {
    let sign = 1;
    if (is(toks[i], '-')) { sign = -1; i++; }
    const t = toks[i];
    if (!t || t.type !== 'num') fail('a value it cannot evaluate', t);
    if (/^0[0-9]/.test(t.text)) fail('a number with a leading zero (an old octal form)', t);
    return { v: sign * Number(t.text), i: i + 1 };
  };
  const product = (i) => {
    let r = number(i);
    while (is(toks[r.i], '*') || is(toks[r.i], '/')) { const op = toks[r.i].text; const f = number(r.i + 1); r = { v: op === '*' ? r.v * f.v : r.v / f.v, i: f.i }; }
    return r;
  };
  const sum = (i) => {
    let r = product(i);
    while (is(toks[r.i], '+')) { const p = product(r.i + 1); r = { v: r.v + p.v, i: p.i }; }
    if (!Number.isFinite(r.v)) fail('a number that is not finite', toks[i]);
    return r;
  };
  const value = (i) => {
    const t = toks[i];
    if (t && t.type === 'str') return { v: jsString(t.text, (why) => fail(why, t)), i: i + 1 };
    if (t && t.type === 'name' && (t.text === 'true' || t.text === 'false')) return { v: t.text === 'true', i: i + 1 };
    if (is(t, '[')) {
      const out = [];
      i++;
      while (!is(toks[i], ']')) {
        const r = value(i);
        out.push(r.v);
        i = r.i;
        if (is(toks[i], ',')) i++;
        else if (!is(toks[i], ']')) fail('an array that does not go on with , or end with ]', toks[i]);
      }
      return { v: out, i: i + 1 };
    }
    if (is(t, '{')) {
      const out = {};
      i++;
      while (!is(toks[i], '}')) {
        const k = toks[i];
        let key;
        if (k && k.type === 'name') key = k.text;
        else if (k && k.type === 'str') key = jsString(k.text, (why) => fail(why, k));
        else if (k && k.type === 'num') key = String(number(i).v);
        else fail('an object key that is not a name, a string or a number', k);
        if (key === '__proto__') fail('an object key __proto__, which sets the prototype instead of a key', k);
        if (Object.prototype.hasOwnProperty.call(out, key)) fail(`the object key ${key} twice`, k);
        if (!is(toks[i + 1], ':')) fail('an object key without a : and a value', toks[i + 1]);
        const r = value(i + 2);
        out[key] = r.v;
        i = r.i;
        if (is(toks[i], ',')) i++;
        else if (!is(toks[i], '}')) fail('an object that does not go on with , or end with }', toks[i]);
      }
      return { v: out, i: i + 1 };
    }
    return sum(i);
  };
  const r = value(d.init);
  // The literal has to be the whole value: what follows ends the declaration (a ; or , or the } of its block, or
  // a new statement on a later line), so `'a' + 'b'` or `5 - 2` is refused rather than read as its first part.
  const after = toks[r.i], last = toks[r.i - 1];
  const ends = !after || is(after, ';') || is(after, ',') || is(after, '}') ||
    (after.line > last.line && after.type === 'name' && after.text !== 'in' && after.text !== 'instanceof');
  if (!ends) fail('more after the literal', after);
  if (type !== undefined) {
    const kind = Array.isArray(r.v) ? 'array' : typeof r.v;
    if (kind !== type) throw new Error(`app.js: ${name} (line ${d.line}) is ${kind === 'array' || kind === 'object' ? 'an' : 'a'} ${kind}, not ${type === 'array' || type === 'object' ? 'an' : 'a'} ${type}`);
  }
  return r.v;
}

// Reads app.js without running it: the Measurement ID line, and POLICY_VERSION, CONSENT_KEY and COPY through
// appConst, so a value that is not a plain literal throws with its name and line instead of reading as null.
// The Measurement ID is read by its line, on purpose: rewriteGaIdSource rewrites exactly one `var GA_ID = '...';`
// line, and the release gate and consent.js require that line once (gaLines), so its shape is the rule and is not
// left to the general reader.
function readApp(root = ROOT, source) {
  const src = source !== undefined ? source : fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const gaLines = src.match(/var GA_ID = '[^']*';/g) || [];
  const gaId = gaLines.length === 1 ? /'([^']*)'/.exec(gaLines[0])[1] : null;
  return {
    src, gaLines: gaLines.length, gaId,
    policyVersion: appConst('POLICY_VERSION', src, 'string'),
    consentKey: appConst('CONSENT_KEY', src, 'string'),
    copy: appConst('COPY', src, 'object'),
  };
}
// A Measurement ID the module would act on: GA4 shape and not the placeholder.
const isActiveShape = (id) => typeof id === 'string' && /^G-[A-Z0-9]{6,12}$/.test(id) && !/^G-X+$/.test(id);

// The one `var PURGE_ONLY = true|false;` declaration, at the start of a line (a comment that mentions it does not
// count). The tests run the module with PURGE_ONLY false whatever the file ships, so that the whole suite also
// passes in the exit state where the file ships true; release-gate.js owns the value that ships.
const PURGE_DECL = /^([ \t]*)var PURGE_ONLY = (true|false);/gm;

// Replaces the one `var GA_ID = '...';` line, and normalises the one PURGE_ONLY declaration to false (the module the
// browser checks run is the live one, whatever the exit switch says in the tree). Fails loudly (and never prints
// the line) if the file has none or several of either.
function rewriteGaIdSource(src, id) {
  const re = /var GA_ID = '[^']*';/g;
  const n = (src.match(re) || []).length;
  if (n !== 1) throw new Error(`rewriteGaId: expected exactly one "var GA_ID = '...';" line in app.js, found ${n}. Refusing to run.`);
  const out = src.replace(re, () => `var GA_ID = '${id}';`);
  if ((out.match(re) || []).length !== 1 || !out.includes(`var GA_ID = '${id}';`)) throw new Error('rewriteGaId: the rewrite did not produce the expected line');
  return normalisePurgeOnly(out, false);
}
// Sets the one PURGE_ONLY declaration to `value` (default false). Throws unless there is exactly one.
function normalisePurgeOnly(src, value = false) {
  const n = (src.match(PURGE_DECL) || []).length;
  if (n !== 1) throw new Error(`rewriteGaId: expected exactly one "var PURGE_ONLY = true|false;" line in app.js, found ${n}. Refusing to run.`);
  return src.replace(PURGE_DECL, (m, indent) => `${indent}var PURGE_ONLY = ${value ? 'true' : 'false'};`);
}

// JavaScript with its comments blanked (line structure kept), so a rule can look at code only. Strings, template
// literals and regular expression literals are skipped over, not mistaken for comments. Enough for app.js, which
// is ES5; it is not a parser.
function stripJsComments(src) {
  const KEYWORDS = /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else)$/;
  let out = '';
  let i = 0;
  let prev = '';                     // last significant character
  let word = '';                     // the identifier that ended just before
  const n = src.length;
  const skipQuoted = (at) => {
    const q = src[at];
    let j = at + 1;
    while (j < n && src[j] !== q) { if (src[j] === '\\') j++; j++; }
    return j;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const from = i; while (i < n && src[i] !== '\n') i++; out += ' '.repeat(i - from); continue; }
    if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e < 0 ? n : e + 2;
      out += src.slice(i, end).replace(/[^\n]/g, ' ');
      i = end;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const j = skipQuoted(i);
      out += src.slice(i, j + 1);
      prev = c; word = ''; i = j + 1;
      continue;
    }
    if (c === '/' && (prev === '' || /[(,=:\[!&|?{};+\-*%<>~^]/.test(prev) || KEYWORDS.test(word))) {
      let j = i + 1, inClass = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) break;
        j++;
      }
      out += src.slice(i, j + 1);
      prev = '/'; word = ''; i = j + 1;
      continue;
    }
    out += c;
    if (/[A-Za-z0-9_$]/.test(c)) word += c; else if (!/\s/.test(c)) word = '';
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

// Where and how app.js assigns PURGE_ONLY, comments excluded: { assignments, falseDecls }.
function purgeOnlyState(src) {
  const code = stripJsComments(src);
  return {
    assignments: (code.match(/\bPURGE_ONLY\s*=(?!=)/g) || []).length,
    falseDecls: (code.match(/var PURGE_ONLY = false;/g) || []).length,
  };
}

// --- Reading markup -----------------------------------------------------------------------------
// The pages are plain files in this repo, but markup is still read the way it has to be read anywhere: by scanning,
// not by pattern-stripping. A string with a comment or a script cut out of it by one regex pass can contain exactly
// what was cut (`<!<!-- x -->--` becomes `<!--`), and decoding `&amp;` before `&lt;` turns `&amp;lt;` into `<`.
// These helpers keep going until nothing is left, and decode every entity in one pass.

// Lower-cases ASCII letters only, so every index in the result is an index in the input.
const lowerAscii = (s) => String(s).replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

// A string for use inside a RegExp, with every special character escaped, the backslash included.
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `html` without its comments. An unterminated comment runs to the end, as in a browser.
function stripComments(html) {
  let s = String(html);
  for (;;) {
    const open = s.indexOf('<!--');
    if (open < 0) return s;
    const close = s.indexOf('-->', open + 4);
    s = close < 0 ? s.slice(0, open) : s.slice(0, open) + s.slice(close + 3);
  }
}

// `html` without the elements named in `names` (their tags and everything between them), e.g. ['script', 'style'].
// The end tag may carry spaces or be upper case (`</SCRIPT >`); an element that never closes runs to the end.
function stripElements(html, names) {
  let s = String(html);
  for (const name of names) {
    for (;;) {
      const lower = lowerAscii(s);
      let open = -1;
      for (let i = lower.indexOf('<' + name); i >= 0; i = lower.indexOf('<' + name, i + 1)) {
        const after = lower[i + 1 + name.length];
        if (after === undefined || /[\s/>]/.test(after)) { open = i; break; }
      }
      if (open < 0) break;
      const close = lower.indexOf('</' + name, open);
      if (close < 0) { s = s.slice(0, open); break; }
      const gt = s.indexOf('>', close);
      s = s.slice(0, open) + (gt < 0 ? '' : s.slice(gt + 1));
    }
  }
  return s;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", ndash: '–', nbsp: ' ' };
// The entities the pages use, decoded in ONE pass: `&amp;lt;` becomes `&lt;`, never `<`.
const decodeEntities = (s) => String(s).replace(/&(amp|lt|gt|quot|#39|ndash|nbsp);/g, (m, name) => ENTITIES[name]);

// The tags after which text starts on a new line.
const BLOCK_TAGS = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'td', 'th', 'caption', 'div', 'table', 'ul', 'ol']);

// The visible text of a page or a fragment, one block per line: comments, scripts and styles dropped, every tag
// dropped (a `>` inside a quoted attribute value does not end it), a new line after a closing block tag and after
// `<br>`, entities decoded. `blocks` is the set of block tag names.
function htmlToText(html, blocks = BLOCK_TAGS) {
  const src = stripElements(stripComments(html), ['script', 'style']);
  let out = '';
  for (let i = 0; i < src.length;) {
    if (src[i] !== '<' || !/[A-Za-z/!?]/.test(src[i + 1] || '')) { out += src[i]; i++; continue; }   // text, or a bare "<"
    let j = i + 1;
    let quote = '';
    for (; j < src.length; j++) {
      const c = src[j];
      if (quote) { if (c === quote) quote = ''; } else if (c === '"' || c === "'") quote = c; else if (c === '>') break;
    }
    const m = /^(\/?)([A-Za-z][A-Za-z0-9-]*)/.exec(src.slice(i + 1, j));
    if (m) {
      const name = m[2].toLowerCase();
      if (name === 'br' || (m[1] && blocks.has(name))) out += '\n';
    }
    i = j + 1;
  }
  return decodeEntities(out);
}

// The tags named `name` in a page, with their attributes: quote-agnostic (double, single or no quotes, any
// attribute order, a `>` inside a quoted value), HTML comments ignored. Returns [{ attrs: { lower-case name: value },
// raw, index }]. A regex over `rel="..."` misses `rel=preconnect` and `href='...'`; this does not.
function parseTags(html, name) {
  const src = String(html).replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
  const open = new RegExp('<' + name + '(?=[\\s/>])', 'gi');
  const out = [];
  let m;
  while ((m = open.exec(src))) {
    const start = m.index;
    let pos = start + m[0].length;
    const attrs = {};
    for (;;) {
      while (pos < src.length && /[\s/]/.test(src[pos])) pos++;
      if (pos >= src.length || src[pos] === '>') break;
      const nm = /[^\s"'<>\/=]+/y;
      nm.lastIndex = pos;
      const a = nm.exec(src);
      if (!a) { pos++; continue; }
      pos += a[0].length;
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      let value = '';
      if (src[pos] === '=') {
        pos++;
        while (pos < src.length && /\s/.test(src[pos])) pos++;
        if (src[pos] === '"' || src[pos] === "'") {
          const q = src[pos];
          const e = src.indexOf(q, pos + 1);
          value = src.slice(pos + 1, e < 0 ? src.length : e);
          pos = e < 0 ? src.length : e + 1;
        } else {
          const v = /[^\s>]*/y;
          v.lastIndex = pos;
          value = v.exec(src)[0];
          pos += value.length;
        }
      }
      if (!(a[0].toLowerCase() in attrs)) attrs[a[0].toLowerCase()] = value;
    }
    out.push({ attrs, raw: src.slice(start, pos + 1), index: start });
    open.lastIndex = Math.max(open.lastIndex, pos);
    if (/^(script|style)$/i.test(name)) {                  // raw-text elements: what is inside is not markup
      const close = src.toLowerCase().indexOf('</' + name.toLowerCase(), pos);
      if (close > 0) open.lastIndex = close;
    }
  }
  return out;
}

// Serves app.js with the Measurement ID replaced, so a browser check runs the same module the visitors get
// but never with a real ID. The source is fetched here, once, outside the route, so a missing or doubled
// line rejects this call (a throw inside a route handler would be swallowed). Playwright runs the most
// recently registered matching route first, so call this after any catch-all route. base is the address the tree
// is served from (default BASE): app.js is fetched from that tree.
async function rewriteGaId(context, id = TEST_ID, base = BASE) {
  const res = await context.request.get(new URL('app.js', base).href);
  if (!res.ok()) throw new Error(`rewriteGaId: ${base}app.js answered ${res.status()}`);
  const body = rewriteGaIdSource(await res.text(), id);
  await context.route((url) => url.pathname.endsWith('/app.js'), (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', headers: { 'cache-control': 'no-store' }, body }));
}

// --- Content-Security-Policy -----------------------------------------------------------------

// "a; b c" -> [['a'], ['b', 'c']] kept in source order; directive names lower-case.
function parseCsp(str) {
  const out = new Map();
  const dup = [];
  for (const part of String(str).split(';')) {
    const toks = part.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const name = toks.shift().toLowerCase();
    if (out.has(name)) dup.push(name); else out.set(name, toks);
  }
  return { directives: out, duplicates: dup };
}
const CSP_META_RE = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?>/gi;

function readPage(p, root = ROOT) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function pageLang(p, root = ROOT) {
  try { const m = /<html[^>]*\blang="([^"]*)"/i.exec(readPage(p, root)); return m ? m[1] : null; } catch (e) { return null; }
}

// The policy EDGE-SETUP.md tells the edge to send, and the meta form of it (the same minus frame-ancestors,
// which a meta tag cannot carry). There must be exactly one such policy in the file.
function edgeCsp(root = ROOT) {
  const text = fs.readFileSync(path.join(root, 'EDGE-SETUP.md'), 'utf8');
  const found = [...new Set(text.split('\n').map((l) => l.trim()).filter((l) => /^default-src\s/.test(l)))];
  if (found.length !== 1) throw new Error(`EDGE-SETUP.md: expected exactly one line starting "default-src" (the header value), found ${found.length}`);
  const header = found[0];
  const meta = header.split(';').map((d) => d.trim()).filter((d) => d && !/^frame-ancestors\b/i.test(d)).join('; ');
  return { header, meta };
}

// --- armGa ---------------------------------------------------------------------------------

// A script that behaves like gtag.js as far as the consent module depends on it, and nothing more: it reads
// the dataLayer commands, honours window['ga-disable-<id>'] and the consent state the way Google documents
// them, writes the _ga and _ga_<id> cookies when analytics storage is granted, and sends a collect hit on
// config. It pushes nothing to the dataLayer itself. It is a stand-in for the documented behaviour, not
// Google's code: real gtag behaviour is covered only by consent-live.js and the pre-flip checklist.
// cfg.straggle: milliseconds after a "denied" update at which it writes the cookies once more (as gtag may).
// cfg.parentDomain: also write the cookies for the last two labels of the host (a synthetic origin only).
function gtagStub(cfg) {
  return `(function () {
  var cfg = ${JSON.stringify(cfg || {})};
  var id = new URL(document.currentScript.src).searchParams.get('id');
  var flag = 'ga-disable-' + id;
  var S = window.__gaStub = { id: id, loads: ((window.__gaStub && window.__gaStub.loads) || 0) + 1, cmds: [], sent: [], blocked: [], failed: [], consent: {} };
  function cookies() {
    var parts = location.hostname.split('.');
    var d = cfg.parentDomain && parts.length > 2 ? '; domain=' + parts.slice(-2).join('.') : '';
    var attrs = '; path=/; max-age=31536000' + d;
    document.cookie = '_ga=GA1.1.111111111.1700000000' + attrs;
    document.cookie = '_ga_' + id.slice(2) + '=GS2.1.s1700000000' + attrs;
  }
  function send(name) {
    if (window[flag] === true) { S.blocked.push(name); return; }
    var granted = S.consent.analytics_storage === 'granted';
    S.sent.push({ name: name, granted: granted });
    fetch('https://www.google-analytics.com/g/collect?v=2&tid=' + id + '&en=' + name + '&gcs=' + (granted ? 'G101' : 'G100'),
      { method: 'POST', mode: 'no-cors', keepalive: true }).catch(function (e) { S.failed.push(name); });
  }
  S.send = send;
  function handle(a) {
    var args = Array.prototype.slice.call(a);
    S.cmds.push(args.map(function (x) { return x instanceof Date ? 'Date' : x; }));
    if (args[0] === 'consent' && args[1] === 'default') S.consent = Object.assign({}, args[2]);
    if (args[0] === 'consent' && args[1] === 'update') {
      Object.assign(S.consent, args[2]);
      if (args[2].analytics_storage === 'denied' && cfg.straggle) cfg.straggle.forEach(function (ms) {
        setTimeout(function () { if (S.consent.analytics_storage !== 'granted') cookies(); }, ms);
      });
    }
    if (args[0] === 'config' && window[flag] !== true) {
      if (S.consent.analytics_storage === 'granted') cookies();
      send('page_view');
    }
  }
  var dl = window.dataLayer = window.dataLayer || [];
  for (var i = 0; i < dl.length; i++) handle(dl[i]);
  var push = dl.push;
  dl.push = function () { for (var j = 0; j < arguments.length; j++) handle(arguments[j]); return push.apply(dl, arguments); };
})();`;
}

// Every armed context, so that one run which reaches a Google host it should not fails as a whole, whichever
// script made it (see the exit hook below).
const ARMED = [];
let exitHook = false;
function installExitHook() {
  if (exitHook) return;
  exitHook = true;
  process.on('exit', () => {
    const leaks = ARMED.flatMap((ga) => ga.leaks.map((l) => l.url));
    if (!leaks.length) return;
    console.error(`\nFAIL — an armed browser reached a Google host it should not have (aborted): ${[...new Set(leaks)].slice(0, 5).join(', ')}`);
    process.exitCode = 1;
  });
}

const FOOTER_ANCHOR = /(<li><a href="privacy\.html">Privacy<\/a><\/li>)/;
const FOOTER_LINK = '\n            <li><a href="privacy.html#cookies" data-consent-open>Cookie settings</a></li>';

// The one arming every browser check uses. It makes the consent module active and every Google request
// harmless, without needing the tree to be integrated yet:
//  - serves app.js with the Measurement ID replaced by the dummy G-TEST000000 and the exit switch PURGE_ONLY set to
//    false, whatever the file ships (rewriteGaId; fails loudly unless there is exactly one of each line);
//  - rewrites the page's Content-Security-Policy meta to the one in EDGE-SETUP.md, and inserts the footer
//    "Cookie settings" link, each only when the served page does not already carry it;
//  - answers www.googletagmanager.com/gtag/js with the stub above and collect hits on *.google-analytics.com
//    and *.analytics.google.com with 204, so nothing real is contacted;
//  - aborts and logs every other request that is not the site's own (ga.blocked), and records any request that
//    reaches a Google host it should not (another path, another ID) as a leak (ga.leaks). assertArmClean() throws on a leak.
// Options: id (default the dummy; a valid-shaped other ID needs controlId, a placeholder or malformed one
// gives an inert module), inert (leave app.js as the tree has it), csp ('auto' | 'asis' | a policy string),
// footer (false to leave the footer alone), stub (gtagStub options), origins (extra origins to serve from
// BASE, for cookie-domain checks on a made-up host name). Two options are for consent-live.js alone: live (the
// CSP's own Google hosts get the real network instead of the stand-ins; any request that carries another
// Measurement ID is still aborted) and stripUpgrade (drop upgrade-insecure-requests from the policy, which WebKit
// applies even to http://localhost; on by default under ENGINE=webkit). One option is for screenshot.js against,
// which serves two trees at once: base (default BASE), the address of the tree this context loads, whose origin
// counts as the site's own and whose app.js is the one rewritten. Returns the log object.
async function armGa(context, opts = {}) {
  const o = Object.assign({ id: TEST_ID, inert: false, csp: 'auto', footer: true, stub: {}, origins: [], controlId: false, live: false, stripUpgrade: process.env.ENGINE === 'webkit', base: BASE }, opts);
  if (!o.inert && isActiveShape(o.id) && o.id !== TEST_ID && !o.controlId) {
    throw new Error('armGa: refusing to arm an active-looking ID other than the dummy ' + TEST_ID);
  }
  const base = new URL(o.base);
  const ga = { id: o.id, gtag: [], collect: [], blocked: [], leaks: [], errors: [], pages: [], live: [], t0: Date.now() };
  ga.google = () => ga.gtag.concat(ga.collect, ga.leaks);
  ga.reset = () => { ga.gtag.length = ga.collect.length = ga.blocked.length = ga.leaks.length = ga.errors.length = 0; };
  let edgeMeta = null;
  const wanted = () => (edgeMeta = edgeMeta || edgeCsp().meta);

  await context.route('**/*', async (route) => {
    const req = route.request();
    let u;
    try { u = new URL(req.url()); } catch (e) { return route.abort(); }
    try {
      const local = u.origin === base.origin || o.origins.includes(u.origin);
      if (local) {
        const mapped = u.origin !== base.origin;
        const isHtml = /\.html$/.test(u.pathname) || u.pathname.endsWith('/');
        if (!mapped && !isHtml) return route.continue();
        const resp = await route.fetch(mapped ? { url: new URL(u.pathname + u.search, base).href } : {});
        const headers = Object.assign({}, resp.headers());
        delete headers['content-length']; delete headers['content-encoding'];
        if (!isHtml || resp.status() !== 200) return route.fulfill({ response: resp, headers });
        let html = await resp.text();
        const note = { path: u.pathname, csp: 'missing', footer: 'none' };
        CSP_META_RE.lastIndex = 0;
        const m = CSP_META_RE.exec(html);
        if (m) {
          if (o.csp === 'asis' || /googletagmanager\.com\/gtag\/js/.test(m[1])) note.csp = 'kept';
          else {
            const policy = o.csp === 'auto' ? wanted() : o.csp;
            html = html.replace(m[0], () => m[0].replace(m[1], () => policy));
            note.csp = 'rewritten';
          }
        }
        if (o.footer) {
          if (/data-consent-open/.test(html)) note.footer = 'present';
          else if (FOOTER_ANCHOR.test(html)) { html = html.replace(FOOTER_ANCHOR, (a) => a + FOOTER_LINK); note.footer = 'inserted'; }
        }
        if (o.stripUpgrade) html = html.replace(/;\s*upgrade-insecure-requests/g, '');
        ga.pages.push(note);
        return route.fulfill({ response: resp, headers, body: html });
      }
      const t = Date.now() - ga.t0;
      if (o.live) {
        const other = (u.href.match(/G-[A-Z0-9]{6,12}/g) || []).filter((x) => x !== o.id);
        if (!other.length && isAllowedGoogleHost(u.hostname)) {
          ga.live.push({ method: req.method(), url: redact(u.href), host: u.hostname, type: req.resourceType(), t });
          return route.continue();
        }
      }
      if (u.hostname === 'www.googletagmanager.com' && u.pathname === '/gtag/js' && u.searchParams.get('id') === o.id) {
        ga.gtag.push({ url: u.href, t });
        return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: gtagStub(o.stub) });
      }
      const ids = (u.href.match(/G-[A-Z0-9]{6,12}/g) || []).filter((x) => x !== o.id);
      if ((/(^|\.)google-analytics\.com$/.test(u.hostname) || /(^|\.)analytics\.google\.com$/.test(u.hostname)) && !ids.length) {
        ga.collect.push({ method: req.method(), url: u.href, t });
        return route.fulfill({ status: 204, body: '' });
      }
      ga.blocked.push(u.href);
      if (isGoogleHost(u.hostname)) ga.leaks.push({ url: redact(u.href), t });
      return route.abort();
    } catch (e) {
      if (!/closed|disposed|aborted|Target page|Target closed|detached/i.test(String(e && e.message))) ga.errors.push('route: ' + redact(e && e.message));
      try { await route.abort(); } catch (e2) { /* already handled */ }
    }
  });
  if (!o.inert) await rewriteGaId(context, o.id, o.base);
  context.__ga = ga;
  ARMED.push(ga);
  installExitHook();
  return ga;
}

// For a context that is deliberately NOT armed (requests.js measures the raw network): nothing may reach a Google
// host, whatever ID is in app.js. The page may still try, so the check sees the attempt, but the request is aborted.
async function abortGoogle(context) {
  await context.route((url) => isGoogleHost(url.hostname), (route) => route.abort());
}

// Throws if an armed run reached a Google host it should not have (a leak), or if the route layer failed.
function assertArmClean(ga) {
  if (ga.leaks.length) throw new Error('armed run reached a non-stubbed Google host: ' + ga.leaks.map((l) => l.url).join(', '));
  if (ga.errors.length) throw new Error('armed run route errors: ' + ga.errors.join(' | '));
}

// --- Misc ----------------------------------------------------------------------------------

// Runs fn over items with at most n in flight, keeping the results in order.
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// Chromium lives in a versioned directory; find it rather than pinning a version.
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const root = '/opt/pw-browsers';
  try {
    const dir = fs.readdirSync(root)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort()
      .pop();
    // Newer Chromium builds unpack to chrome-linux64.
    if (dir) return [`${root}/${dir}/chrome-linux/chrome`, `${root}/${dir}/chrome-linux64/chrome`].find((f) => fs.existsSync(f)) || `${root}/${dir}/chrome-linux/chrome`;
  } catch (e) { /* fall through to Playwright's own resolution */ }
  return undefined;
}

// ENGINE=firefox or webkit (installed with `npx playwright install firefox webkit`) runs a check that has no
// Chromium-only calls in another engine; consent.js is one. Launch options that only Chromium understands are dropped.
async function launch(opts = {}) {
  const pw = require('playwright');
  const engine = process.env.ENGINE || 'chromium';
  if (engine !== 'chromium') {
    const { ignoreDefaultArgs, args, ...rest } = opts;     // eslint-disable-line no-unused-vars
    return pw[engine].launch(rest);
  }
  const executablePath = chromePath();
  const { liveSilk, ...rest } = opts;
  const browser = await pw.chromium.launch(Object.assign(executablePath ? { executablePath } : {}, rest));
  if (!liveSilk) stillSilk(browser);
  return browser;
}

// The silk background draws itself live in WebGL, thirty frames a second (app.js, Silk waves). Under a headless,
// software-rendered browser that is heavy enough to disturb timing tests, and a frame loop is exactly what the
// at-rest checks forbid. So every context a check opens starts with the pause stored, whether or not the check pins
// anything else, and the page shows the still silk. waves.js is the one check that asks for the live silk
// (launch({ liveSilk: true })) and it tests the drawing, the button and every still state.
function stillSilk(browser) {
  const still = () => { try { localStorage.setItem('vynatix-motion', 'off'); } catch (e) { /* storage blocked */ } };
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => { const ctx = await newContext(o); await ctx.addInitScript(still); return ctx; };
  browser.newPage = async (o) => (await browser.newContext(o)).newPage();
}

// The home hero is drawn in its own unit, --hero-u, which the hero fit scales to the window's height
// (styles.css, "Hero fit"): 1 at the design size. The art's constants are multiples of it, so a guard
// that compares a distance with one of them multiplies its number by this first.
async function heroUnit(page) {
  return page.evaluate(() => {
    const hero = document.querySelector('.hero');
    return (hero && parseFloat(getComputedStyle(hero).getPropertyValue('--hero-u'))) || 1;
  });
}

module.exports = {
  ROOT, readRegistry, readLangs, generatedPages, NOTICE_PAGES, BASE, THEMES, ALL_THEMES, pinTheme, launch, chromePath, pool, heroUnit,
  CONSENT_KEY, POLICY_VERSION, THEME_KEY, LOOK_KEY, BG_KEY_PREFIX, BG_ATTR, PURGE_DECL, normalisePurgeOnly, stripJsComments, purgeOnlyState, parseTags, TEST_ID, PLACEHOLDER_ID, GOOGLE_HOSTS, GTAG_SCRIPT,
  hostMatchesSource, isAllowedGoogleHost, isGoogleHost, GOOGLEISH, pinConsent, todayUtc, redact,
  readApp, appConst, isActiveShape, rewriteGaIdSource, rewriteGaId, armGa, abortGoogle, assertArmClean, gtagStub,
  parseCsp, CSP_META_RE, readPage, pageLang, edgeCsp,
  lowerAscii, escapeRegExp, stripComments, stripElements, decodeEntities, BLOCK_TAGS, htmlToText,
};
// PAGES is read on first use (rootPages, above).
Object.defineProperty(module.exports, 'PAGES', { enumerable: true, get: rootPages });
