// Shared config for the verification scripts.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// The repository root: the tree these scripts read static files from (EDGE-SETUP.md,
// app.js, the pages). The scripts that open a browser read the tree through BASE.
const ROOT = path.join(__dirname, '..', '..');

const PAGES = [
  'index.html', 'about.html', 'services.html',
  'work.html', 'membership.html', 'contact.html',
  'privacy.html', 'terms.html', 'accessibility.html',
  // English deep pages and the list page (each has a Swedish twin below)
  'android-automotive-development.html', 'ai-engineering.html',
  'android-automotive-consultancies-gothenburg.html',
  // Swedish pages: the hub, the twins, the guides and the Swedish privacy notice
  'sv.html', 'android-automotive-utveckling.html', 'ai-utveckling.html',
  'konsultbolag-android-automotive-goteborg.html', 'valja-konsultbolag.html',
  'platform-engineering.html', 'ai-assistent-interna-dokument.html',
  'ai-konsultbolag-sverige.html', 'integritet.html',
];

// The page that carries the privacy notice (and the in-page consent panel) in each language.
const NOTICE_PAGES = { en: 'privacy.html', sv: 'integritet.html' };

const BASE = process.env.BASE || 'http://localhost:8000/';

// The design system's six theme ids. The checks run on the Forest pair by
// default; set THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark to
// sweep every theme the role tokens have to hold in.
const ALL_THEMES = ['light', 'dark', 'teal-light', 'teal-dark', 'mono-light', 'mono-dark'];
const THEMES = (process.env.THEMES || 'light,dark').split(',').map((t) => t.trim()).filter(Boolean);
for (const t of THEMES) {
  if (!ALL_THEMES.includes(t)) { console.error(`Unknown theme "${t}" (expected one of ${ALL_THEMES.join(', ')})`); process.exit(2); }
}

// The site draws one of three colour schemes at random per visit (sessionStorage
// "vynatix-look") and takes light or dark from the visitor's choice (localStorage
// "vynatix-theme"). A check that needs a particular theme has to set both before
// the page loads: pass this to page.addInitScript(pinTheme, themeId). It is
// serialised into the page, so it must stay self-contained.
function pinTheme(theme) {
  try {
    var m = /^(teal|mono)-/.exec(theme);
    localStorage.setItem('vynatix-theme', theme);
    sessionStorage.setItem('vynatix-look', m ? m[1] : 'forest');
  } catch (e) { /* storage blocked: the page falls back to Forest */ }
}

// --- Consent -------------------------------------------------------------------------------

// localStorage key and answer format the consent module in app.js uses:
// "<POLICY_VERSION>:granted|denied:<UTC date of the click>". consent.js asserts that
// POLICY_VERSION and CONSENT_KEY below still equal the ones in app.js.
const CONSENT_KEY = 'vynatix-consent';
const POLICY_VERSION = 'v1';
// The other two keys the site writes (the theme IIFE in app.js). Both notices name all three in <code>.
const THEME_KEY = 'vynatix-theme';
const LOOK_KEY = 'vynatix-look';

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

// Reads app.js: the Measurement ID line, POLICY_VERSION and the COPY object, without running the module.
function skipString(src, i) {
  const q = src[i];
  for (i++; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === q) return i;
  }
  throw new Error('unterminated string in app.js');
}
function objectLiteralAt(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"') { i = skipString(src, i); continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error('unbalanced braces in app.js');
}
function readApp(root = ROOT, source) {
  const src = source !== undefined ? source : fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const gaLines = src.match(/var GA_ID = '[^']*';/g) || [];
  const gaId = gaLines.length === 1 ? /'([^']*)'/.exec(gaLines[0])[1] : null;
  const pv = /var POLICY_VERSION = '([^']*)'/.exec(src);
  const ck = /var CONSENT_KEY = '([^']*)'/.exec(src);
  let copy = null;
  const at = src.indexOf('var COPY = {');
  if (at >= 0) {
    try { copy = vm.runInNewContext('(' + objectLiteralAt(src, src.indexOf('{', at)) + ')', {}, { timeout: 1000 }); } catch (e) { copy = null; }
  }
  return { src, gaLines: gaLines.length, gaId, policyVersion: pv ? pv[1] : null, consentKey: ck ? ck[1] : null, copy };
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
// recently registered matching route first, so call this after any catch-all route.
async function rewriteGaId(context, id = TEST_ID) {
  const res = await context.request.get(new URL('app.js', BASE).href);
  if (!res.ok()) throw new Error(`rewriteGaId: ${BASE}app.js answered ${res.status()}`);
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
// applies even to http://localhost; on by default under ENGINE=webkit). Returns the log object.
async function armGa(context, opts = {}) {
  const o = Object.assign({ id: TEST_ID, inert: false, csp: 'auto', footer: true, stub: {}, origins: [], controlId: false, live: false, stripUpgrade: process.env.ENGINE === 'webkit' }, opts);
  if (!o.inert && isActiveShape(o.id) && o.id !== TEST_ID && !o.controlId) {
    throw new Error('armGa: refusing to arm an active-looking ID other than the dummy ' + TEST_ID);
  }
  const base = new URL(BASE);
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
  if (!o.inert) await rewriteGaId(context, o.id);
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
    if (dir) return `${root}/${dir}/chrome-linux/chrome`;
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
  return pw.chromium.launch(Object.assign(executablePath ? { executablePath } : {}, opts));
}

module.exports = {
  ROOT, PAGES, NOTICE_PAGES, BASE, THEMES, ALL_THEMES, pinTheme, launch, chromePath, pool,
  CONSENT_KEY, POLICY_VERSION, THEME_KEY, LOOK_KEY, PURGE_DECL, normalisePurgeOnly, stripJsComments, purgeOnlyState, parseTags, TEST_ID, PLACEHOLDER_ID, GOOGLE_HOSTS, GTAG_SCRIPT,
  hostMatchesSource, isAllowedGoogleHost, isGoogleHost, GOOGLEISH, pinConsent, todayUtc, redact,
  readApp, isActiveShape, rewriteGaIdSource, rewriteGaId, armGa, abortGoogle, assertArmClean, gtagStub,
  parseCsp, CSP_META_RE, readPage, pageLang, edgeCsp,
  lowerAscii, escapeRegExp, stripComments, stripElements, decodeEntities, BLOCK_TAGS, htmlToText,
};
