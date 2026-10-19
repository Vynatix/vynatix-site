// The Content-Security-Policy, checked statically (no browser, no server): this runs first in
// `npm run check` because everything the consent checks prove about Google traffic rests on it.
//   node verify/csp.js
//
// The policy is a security decision, not a convenience: it admits Google Analytics and nothing else, so
//  - every page carries one meta policy, and they are all identical;
//  - that policy equals the one EDGE-SETUP.md tells the edge to send, minus frame-ancestors (a meta tag
//    cannot carry it); directive order does not matter, source order inside a directive does (as headers.js);
//  - every Google source is one of GOOGLE_HOSTS from _common.js, and script-src is exactly 'self' plus the
//    path-pinned /gtag/js (a bare host would admit gtm.js and any container);
//  - script-src and connect-src hold no 'unsafe-*', bare *, https:, http:, data: or blob:;
//  - the directives that were not widened (default-src, base-uri, object-src, img-src, style-src, font-src,
//    form-action) are what they were before Google Analytics, and no other directive appears;
//  - the comment above the policy no longer describes a 'self'-only policy;
//  - no page markup hints at a Google host (preconnect, dns-prefetch, preload, prefetch, prerender, modulepreload),
//    loads a script from one, or names one anywhere else outside the policy meta. <link> and <script> tags are read
//    with a quote-agnostic attribute parser (double, single or no quotes, any attribute order), so a pasted Google
//    snippet cannot hide behind the way it is written.
// Exports run() for release-gate.js and publish.js.
const {
  PAGES, ROOT, GOOGLE_HOSTS, GTAG_SCRIPT, isGoogleHost, parseCsp, CSP_META_RE, readPage, edgeCsp, parseTags,
} = require('./_common');

// The directives Google Analytics did not touch, as they were on every page before it.
const UNCHANGED = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'img-src': ["'self'", 'data:'],
  'style-src': ["'self'"],
  'font-src': ["'self'"],
  'form-action': ["'self'"],
};
const WIDENED = ['script-src', 'connect-src'];
const KNOWN = new Set([...Object.keys(UNCHANGED), ...WIDENED, 'upgrade-insecure-requests']);
const BAD_TOKENS = ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "'wasm-unsafe-eval'", '*', 'https:', 'http:', 'data:', 'blob:', 'filesystem:', "'strict-dynamic'"];
const HINT_REL = /^(preconnect|dns-prefetch|preload|prefetch|prerender|modulepreload)$/i;

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const fmt = (list) => (list || []).join(' ') || '(none)';

const hostOf = (href) => { try { return new URL(href, 'https://vynatix.com/').hostname; } catch (e) { return null; } };

// Every Google hint link in a page's markup: <link rel="..."> whose href names a Google host.
function googleHintLinks(html) {
  const out = [];
  for (const t of parseTags(html, 'link')) {
    const rel = t.attrs.rel || '';
    const href = (t.attrs.href || '').trim();
    if (!rel.split(/\s+/).some((r) => HINT_REL.test(r))) continue;
    const host = hostOf(href);
    if (host && isGoogleHost(host)) out.push(`${rel} ${href}`);
  }
  return out;
}

// Every <script src> in a page's markup that names a Google host (the gtag loader is injected by app.js, never by markup).
function googleScriptTags(html) {
  const out = [];
  for (const t of parseTags(html, 'script')) {
    const src = (t.attrs.src || '').trim();
    const host = src ? hostOf(src) : null;
    if (host && isGoogleHost(host)) out.push(`script ${src}`);
  }
  return out;
}

// Markup that names a Google host anywhere but in the CSP meta (comments and the policy itself excluded).
function googleHostMentions(html) {
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '').replace(CSP_META_RE, '');
  const found = new Set();
  for (const m of stripped.matchAll(/(?:https?:)?\/\/([a-z0-9.-]+)/gi)) if (isGoogleHost(m[1])) found.add(m[1].toLowerCase());
  return [...found];
}

// The comment sitting directly above the policy meta, or null.
function commentAbove(html) {
  CSP_META_RE.lastIndex = 0;
  const m = CSP_META_RE.exec(html);
  if (!m) return null;
  const before = html.slice(0, m.index).replace(/\s+$/, '');
  if (!before.endsWith('-->')) return null;
  const start = before.lastIndexOf('<!--');
  return start < 0 ? null : before.slice(start + 4, -3).replace(/\s+/g, ' ').trim();
}

function run(root = ROOT, pages = PAGES) {
  const results = [];
  const add = (ok, name, detail) => results.push({ ok, name, detail: detail || '' });

  // --- the policy EDGE-SETUP.md specifies
  let edge = null;
  try { edge = edgeCsp(root); } catch (e) { add(false, 'EDGE-SETUP.md carries one Content-Security-Policy value', e.message); }
  if (edge) {
    const eh = parseCsp(edge.header);
    add(eh.directives.has('frame-ancestors') && sameList(eh.directives.get('frame-ancestors'), ["'none'"]),
      "EDGE-SETUP.md policy carries frame-ancestors 'none' (header only)");
    add(eh.duplicates.length === 0, 'EDGE-SETUP.md policy names each directive once', eh.duplicates.join(', '));
  }

  // --- each page's meta policy
  const metas = {};
  const problems = [];
  for (const p of pages) {
    let html;
    try { html = readPage(p, root); } catch (e) { problems.push(`${p}: file missing`); continue; }
    CSP_META_RE.lastIndex = 0;
    const all = [...html.matchAll(CSP_META_RE)];
    if (all.length !== 1) { problems.push(`${p}: ${all.length} Content-Security-Policy meta tags (want 1)`); continue; }
    metas[p] = all[0][1].trim().replace(/\s+/g, ' ');
  }
  add(problems.length === 0, `every page has exactly one meta policy (${pages.length} pages)`, problems.join('; '));

  const distinct = [...new Set(Object.values(metas))];
  if (distinct.length > 1) {
    const groups = distinct.map((d) => `${Object.keys(metas).filter((p) => metas[p] === d).length} page(s): ${Object.keys(metas).filter((p) => metas[p] === d).slice(0, 4).join(', ')}`);
    add(false, 'the meta policy is identical on every page', `${distinct.length} different policies. ${groups.join(' | ')}`);
  } else add(distinct.length === 1, 'the meta policy is identical on every page');

  // The reference for the structural checks: the page policy that most pages carry (all of them when identical).
  const counts = {};
  for (const d of Object.values(metas)) counts[d] = (counts[d] || 0) + 1;
  const policies = distinct.length ? distinct : [];

  if (edge) {
    const want = parseCsp(edge.meta).directives;
    const bad = [];
    for (const p of Object.keys(metas)) {
      const got = parseCsp(metas[p]).directives;
      const names = new Set([...want.keys(), ...got.keys()]);
      for (const n of names) {
        if (!want.has(n)) bad.push(`${p}: extra directive ${n}`);
        else if (!got.has(n)) bad.push(`${p}: missing directive ${n}`);
        else if (!sameList(want.get(n), got.get(n))) bad.push(`${p}: ${n} is "${fmt(got.get(n))}", EDGE-SETUP.md says "${fmt(want.get(n))}"`);
      }
    }
    add(bad.length === 0, 'the meta policy equals the EDGE-SETUP.md header value minus frame-ancestors', bad.slice(0, 6).join(' | ') + (bad.length > 6 ? ` (+${bad.length - 6} more)` : ''));
  }

  // --- structural rules, on every distinct policy so that a single odd page cannot hide
  for (const pol of policies) {
    const who = policies.length > 1 ? ` [${Object.keys(metas).filter((p) => metas[p] === pol)[0]}...]` : '';
    const d = parseCsp(pol).directives;

    const names = [...d.keys()];
    const extra = names.filter((n) => !KNOWN.has(n));
    add(extra.length === 0, 'no directive other than the known set' + who, extra.length ? `unexpected: ${extra.join(', ')}` : '');

    const script = d.get('script-src') || [];
    add(sameList(script, ["'self'", GTAG_SCRIPT]),
      `script-src is exactly 'self' plus the path-pinned ${GTAG_SCRIPT}` + who, `got: ${fmt(script)}`);

    const connect = d.get('connect-src') || [];
    add(sameList(connect, ["'self'", ...GOOGLE_HOSTS]), 'connect-src is exactly \'self\' plus GOOGLE_HOSTS' + who, `got: ${fmt(connect)}`);

    const stray = [];
    for (const n of WIDENED) for (const t of d.get(n) || []) if (BAD_TOKENS.includes(t.toLowerCase())) stray.push(`${n} ${t}`);
    add(stray.length === 0, "script-src and connect-src hold no 'unsafe-*', bare *, https:, http:, data: or blob:" + who, stray.join(', '));

    // Every Google source is a GOOGLE_HOSTS entry exactly (connect-src) or the one pinned script path.
    const googleBad = [];
    for (const [n, toks] of d) {
      for (const t of toks) {
        const m = /^(?:[a-z]+:\/\/)?([^/:\s]+)/i.exec(t.replace(/^\*\./, 'x.'));
        if (!m || t.startsWith("'")) continue;
        if (!isGoogleHost(m[1])) continue;
        const okHere = (n === 'connect-src' && GOOGLE_HOSTS.includes(t)) || (n === 'script-src' && t === GTAG_SCRIPT);
        if (!okHere) googleBad.push(`${n} ${t}`);
      }
    }
    add(googleBad.length === 0, 'every Google source is one of GOOGLE_HOSTS, or the pinned gtag path in script-src' + who, googleBad.join(', '));

    const drift = [];
    for (const [n, want] of Object.entries(UNCHANGED)) if (!sameList(d.get(n) || [], want)) drift.push(`${n}: "${fmt(d.get(n))}" (was "${fmt(want)}")`);
    if (!d.has('upgrade-insecure-requests')) drift.push('upgrade-insecure-requests missing');
    add(drift.length === 0, 'default-src, base-uri, object-src, img-src, style-src, font-src and form-action are unchanged from before Google Analytics' + who, drift.join(' | '));
  }

  // --- the comment above the policy
  const stale = [];
  for (const p of Object.keys(metas)) {
    const c = commentAbove(readPage(p, root));
    if (c === null) stale.push(`${p}: no comment above the policy`);
    else if (!/google|gtag|analytics/i.test(c)) stale.push(`${p}: comment does not mention Google Analytics ("${c.slice(0, 60)}...")`);
  }
  add(stale.length === 0, 'the comment above the policy names the Google Analytics exception (not stale)', stale.slice(0, 3).join(' | ') + (stale.length > 3 ? ` (+${stale.length - 3} more)` : ''));

  // --- hints, scripts and mentions in markup
  const hints = [], scripts = [], mentions = [];
  for (const p of pages) {
    let html;
    try { html = readPage(p, root); } catch (e) { continue; }
    for (const h of googleHintLinks(html)) hints.push(`${p}: ${h}`);
    for (const h of googleScriptTags(html)) scripts.push(`${p}: ${h}`);
    for (const h of googleHostMentions(html)) mentions.push(`${p}: ${h}`);
  }
  add(hints.length === 0, 'no page hints at a Google host (preconnect, dns-prefetch, preload, prefetch, prerender, modulepreload)', hints.join(' | '));
  add(scripts.length === 0, 'no page loads a script from a Google host by markup (app.js injects the one gtag.js, after consent)', scripts.join(' | '));
  add(mentions.length === 0, 'no page names a Google host anywhere in its markup outside the policy meta', mentions.slice(0, 6).join(' | ') + (mentions.length > 6 ? ` (+${mentions.length - 6} more)` : ''));

  return results;
}

module.exports = { run, googleHintLinks, googleScriptTags, googleHostMentions, commentAbove };

if (require.main === module) {
  const results = run();
  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(bad === 0 ? '\nPASS — the Content-Security-Policy admits Google Analytics and nothing else'
                        : `\nFAIL — ${bad} problem(s) with the Content-Security-Policy`);
  process.exit(bad === 0 ? 0 : 1);
}
