// Helpers shared by the consent checks (consent.js, consent-layout.js, release-gate.js). Kept apart from
// _common.js, which every script loads: this file is only for the checks that drive or read the consent module.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  ROOT, BASE, TEST_ID, NOTICE_PAGES, armGa, pinTheme, pinConsent, readApp, readPage, pageLang, htmlToText,
} = require('./_common');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DISABLE_FLAG = 'ga-disable-' + TEST_ID;
const SNAPSHOT = path.join(__dirname, 'consent-copy.snapshot.json');

// The `ok`/`FAIL` line every script prints, with a count of failures.
function reporter() {
  let problems = 0;
  return {
    check(ok, name, detail) {
      if (!ok) problems++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
      return !!ok;
    },
    get problems() { return problems; },
  };
}

// A Node-side poll: resolves true as soon as fn() is truthy, false after ms.
async function until(fn, ms = 3000, step = 25) {
  const end = Date.now() + ms;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() > end) return false;
    await sleep(step);
  }
}

// Records every observable side effect of a page's scripts: storage calls, cookie writes, listeners,
// nodes added to the document, and focus() calls. Used to prove the inert module does nothing.
const SPY_JS = `(function () {
  if (window.__spy) return;
  var S = window.__spy = { storage: [], cookie: [], listeners: [], dom: [], focus: [] };
  function area(o) {
    try { if (o === window.localStorage) return 'local'; } catch (e) {}
    try { if (o === window.sessionStorage) return 'session'; } catch (e) {}
    return '?';
  }
  ['getItem', 'setItem', 'removeItem', 'clear'].forEach(function (m) {
    var orig = Storage.prototype[m];
    Storage.prototype[m] = function (k) { S.storage.push(area(this) + '.' + m + '(' + k + ')'); return orig.apply(this, arguments); };
  });
  var cd = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(Document.prototype, 'cookie', {
    configurable: true, enumerable: true,
    get: function () { return cd.get.call(this); },
    set: function (v) { S.cookie.push(String(v).slice(0, 120)); return cd.set.call(this, v); }
  });
  var add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type) {
    var t = this === window ? 'window' : this === document ? 'document' : (this.nodeName || 'other');
    S.listeners.push(t + ':' + type);
    return add.apply(this, arguments);
  };
  var focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function () { S.focus.push(this.nodeName + '#' + this.id); return focus.apply(this, arguments); };
  new MutationObserver(function (recs) {
    recs.forEach(function (r) {
      if (r.type === 'childList') r.addedNodes.forEach(function (n) {
        if (n.nodeType === 1) S.dom.push('+' + n.nodeName.toLowerCase() + '#' + (n.id || '') + '.' + (typeof n.className === 'string' ? n.className : '') + ' ' + (n.rel || '') + ' ' + (n.href || n.src || ''));
      });
      else if (r.type === 'attributes' && r.target === document.documentElement) S.dom.push('html@' + r.attributeName + '=' + document.documentElement.getAttribute(r.attributeName));
    });
  }).observe(document, { childList: true, subtree: true, attributes: true });
})();`;

// Hands every securitypolicyviolation in the page to Node (window.__cspHit is a context binding, so it
// survives navigations). Any violation under the widened policy means the policy is missing a source.
const CSP_RECORDER = `(function () {
  document.addEventListener('securitypolicyviolation', function (e) {
    if (window.__cspHit) window.__cspHit(e.effectiveDirective + ' blocked ' + (e.blockedURI || 'inline'));
  });
})();`;

// A browser context armed for the consent checks: Google stubbed and every other off-origin request
// aborted (armGa), the theme pinned if asked, violations and page errors collected.
//   o.viewport, reducedMotion, forcedColors, colorScheme, javaScriptEnabled, bypassCSP, deviceScaleFactor: context options
//   o.theme: pinTheme id   o.consent: 'granted' | 'denied' | 'undecided' pins the answer on every load
//   o.arm: armGa options   o.spy: install SPY_JS   o.init: extra init scripts [[fn, arg], ...]
//   o.ignoreHTTPSErrors: certificate errors are ignored unless the run is a live one (o.arm.live: Google is
//   really contacted, so a certificate that does not verify must fail the run, not be waved through)
async function armedContext(browser, o = {}) {
  const live = !!(o.arm && o.arm.live);
  const ctxOpts = { viewport: o.viewport || { width: 1280, height: 800 }, ignoreHTTPSErrors: o.ignoreHTTPSErrors !== undefined ? !!o.ignoreHTTPSErrors : !live, serviceWorkers: 'block' };
  for (const k of ['reducedMotion', 'forcedColors', 'colorScheme', 'javaScriptEnabled', 'bypassCSP', 'deviceScaleFactor']) {
    if (o[k] !== undefined) ctxOpts[k] = o[k];
  }
  const ctx = await browser.newContext(ctxOpts);
  ctx.setDefaultTimeout(10000);                    // a missing element fails the scenario in seconds, not half a minute
  const ga = await armGa(ctx, o.arm || {});
  const env = { ctx, ga, violations: [], refused: [], pageErrors: [], async close() { try { await ctx.close(); } catch (e) { /* closed */ } } };
  await ctx.exposeBinding('__cspHit', (_src, msg) => { env.violations.push(msg); });
  ctx.on('page', (p) => {
    p.on('pageerror', (e) => env.pageErrors.push(String(e && e.message || e)));
    p.on('console', (m) => { if (/Refused to|Content Security Policy/i.test(m.text())) env.refused.push(m.text().slice(0, 200)); });
  });
  if (o.theme) await ctx.addInitScript(pinTheme, o.theme);
  if (o.consent) await ctx.addInitScript(pinConsent, o.consent);
  if (o.spy) await ctx.addInitScript(SPY_JS);
  await ctx.addInitScript(CSP_RECORDER);
  for (const [fn, arg] of o.init || []) await ctx.addInitScript(fn, arg);
  return env;
}

async function open(ctx, rel, waitUntil = 'load') {
  const page = await ctx.newPage();
  await page.goto(BASE + rel, { waitUntil, timeout: 20000 });
  return page;
}

const gaCookies = async (ctx) => (await ctx.cookies()).filter((c) => c.name === '_ga' || c.name.startsWith('_ga_')).map((c) => `${c.name}@${c.domain}`);
const allCookies = async (ctx) => (await ctx.cookies()).map((c) => `${c.name}@${c.domain}`);
const barButton = (choice) => `#consent-bar [data-consent-choice=${choice}]`;

// The visible state of the consent module in a page.
function snap(page) {
  return page.evaluate(([key, flag]) => {
    const bar = document.getElementById('consent-bar');
    const ae = document.activeElement;
    const status = bar && bar.querySelector('.consent__status');
    const panel = document.querySelector('[data-consent-panel]');
    const link = document.querySelector('[data-consent-open]');
    let ls;
    try { ls = localStorage.getItem(key); } catch (e) { ls = 'THROWS'; }
    return {
      bar: !!bar, barCount: document.querySelectorAll('#consent-bar').length, status: status ? status.textContent : null,
      htmlClass: document.documentElement.className,
      live: (document.getElementById('consent-live') || {}).textContent,
      ls, flag: window[flag],
      scripts: [...document.scripts].filter((s) => /googletagmanager/.test(s.src)).map((s) => s.getAttribute('src')),
      cookie: (() => { try { return document.cookie; } catch (e) { return 'THROWS'; } })(),
      dl: window.dataLayer ? Array.from(window.dataLayer, (a) => Array.from(a, (x) => (x instanceof Date ? 'Date' : x))) : null,
      stub: window.__gaStub ? { cmds: window.__gaStub.cmds, sent: window.__gaStub.sent.length, blocked: window.__gaStub.blocked.length, failed: window.__gaStub.failed.length } : null,
      active: ae ? (ae === document.body ? 'body' : (ae.id ? '#' + ae.id : ae.tagName.toLowerCase() + (ae.getAttribute('data-consent-choice') ? '[' + ae.getAttribute('data-consent-choice') + ']' : '') + (ae.hasAttribute('data-consent-open') ? '[open]' : ''))) : null,
      footerLink: link ? { text: link.textContent.trim(), href: link.getAttribute('href'), lang: link.getAttribute('lang') } : null,
      panel: panel ? { text: panel.textContent.trim().replace(/\s+/g, ' '), children: panel.childNodes.length, buttons: panel.querySelectorAll('button').length, status: (panel.querySelector('.consent-panel__status') || {}).textContent || null } : null,
    };
  }, ['vynatix-consent', DISABLE_FLAG]);
}

// Sentences the copy rules (seo.js applies the same to the visible text) forbid.
function copyIssues(s) {
  const out = [];
  if (/—/.test(s)) out.push('em dash');
  if (/\s–\s/.test(s)) out.push('en dash as punctuation');
  if (/!/.test(s)) out.push('exclamation mark');
  if (/…|\.\.\./.test(s)) out.push('ellipsis');
  return out;
}

// --- the consent-text snapshot -----------------------------------------------------------------

const h12 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

// The text of the #cookies section of a notice page as one hash per block (heading, paragraph, list item, table cell).
function sectionBlocks(html) {
  const start = html.search(/<h2\b[^>]*\bid="cookies"/);
  if (start < 0) return null;
  const rest = html.slice(start);
  const end = rest.slice(5).search(/<h2\b|<\/main>/);
  const section = end < 0 ? rest : rest.slice(0, end + 5);
  const text = htmlToText(section);
  return text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// What a visitor is shown when asked for consent: the COPY strings in app.js and the #cookies section of each notice page.
// files: { 'app.js': text, 'privacy.html': text, ... } replaces what is read from disk (release-gate.js --self-test).
function consentDigest(root = ROOT, files = {}) {
  const app = readApp(root, files['app.js']);
  const copy = {};
  for (const lang of Object.keys(app.copy || {})) for (const [k, v] of Object.entries(app.copy[lang])) copy[`${lang}.${k}`] = h12(String(v));
  const sections = {};
  for (const page of Object.values(NOTICE_PAGES)) {
    let blocks = null;
    try { blocks = sectionBlocks(files[page] !== undefined ? files[page] : readPage(page, root)); } catch (e) { blocks = null; }
    sections[`${page}#cookies`] = blocks ? blocks.map((b) => ({ h: h12(b), t: b.slice(0, 60) })) : null;
  }
  return { policyVersion: app.policyVersion, copy, sections };
}

// How the current digest differs from the checked-in snapshot: { exists, changes, bumped, from }.
// snapText replaces the file's content (release-gate.js --self-test); null means "there is no snapshot".
function snapshotDiff(cur, snapPath = SNAPSHOT, snapText) {
  let snapDoc;
  try {
    const text = snapText !== undefined ? snapText : fs.readFileSync(snapPath, 'utf8');
    snapDoc = text === null ? null : JSON.parse(text);
  } catch (e) { snapDoc = null; }
  if (!snapDoc || typeof snapDoc !== 'object') return { exists: false, changes: [], bumped: false, from: null };
  const changes = [];
  for (const k of new Set([...Object.keys(snapDoc.copy || {}), ...Object.keys(cur.copy)])) {
    if ((snapDoc.copy || {})[k] !== cur.copy[k]) changes.push(`app.js COPY ${k}`);
  }
  for (const k of new Set([...Object.keys(snapDoc.sections || {}), ...Object.keys(cur.sections)])) {
    const a = (snapDoc.sections || {})[k], b = cur.sections[k];
    if (b === null || b === undefined) { changes.push(`${k}: section not found`); continue; }
    const had = new Set((a || []).map((x) => x.h)), now = new Set(b.map((x) => x.h));
    const added = b.filter((x) => !had.has(x.h)), removed = (a || []).filter((x) => !now.has(x.h));
    if (a === null || a === undefined) changes.push(`${k}: not in the snapshot`);
    else if (added.length || removed.length) changes.push(`${k}: ${added.length} block(s) new or changed${added.length ? ' (e.g. "' + added[0].t + '")' : ''}, ${removed.length} removed`);
  }
  return { exists: true, changes, bumped: snapDoc.policyVersion !== cur.policyVersion, from: snapDoc.policyVersion };
}

// Compares the current digest with the checked-in snapshot.
// Returns { ok, note, detail, changes }: ok is false when the consent text moved while POLICY_VERSION did not.
function compareSnapshot(cur, snapPath = SNAPSHOT, snapText) {
  const d = snapshotDiff(cur, snapPath, snapText);
  if (!d.exists) {
    return { ok: false, changes: [], detail: `no snapshot at ${path.relative(ROOT, snapPath)}. Review the consent text, then take the first snapshot with: node verify/consent.js --update` };
  }
  if (!d.changes.length) return { ok: true, changes: [] };
  if (d.bumped) {
    return { ok: true, changes: d.changes, note: `consent text changed and POLICY_VERSION moved ${d.from} -> ${cur.policyVersion}; take the snapshot with: node verify/consent.js --update` };
  }
  const missing = d.changes.some((c) => /section not found/.test(c));
  return {
    ok: false,
    changes: d.changes,
    detail: `${d.changes.join('; ')}. ${missing ? '' : 'Review the consent text diff (git diff). Bump POLICY_VERSION in app.js (and in _common.js) if the change alters what a visitor agrees to, so old answers lapse; it is still ' + cur.policyVersion + '. Take the snapshot with node verify/consent.js --update (plus --same-version when the wording changed and POLICY_VERSION stays) only after that review'}${missing ? 'Run node verify/consent.js --update once every notice page has its #cookies section' : ''}`,
  };
}

function snapshotDoc(cur) {
  return {
    note: 'Hashes of the consent text: the COPY strings in app.js and the #cookies section of each notice page. Written by node verify/consent.js --update, which refuses when the text changed and POLICY_VERSION did not (unless --same-version). consent.js fails when the text changes and POLICY_VERSION does not.',
    policyVersion: cur.policyVersion,
    copy: cur.copy,
    sections: cur.sections,
  };
}

function writeSnapshot(cur, snapPath = SNAPSHOT) {
  fs.writeFileSync(snapPath, JSON.stringify(snapshotDoc(cur), null, 2) + '\n');
}

module.exports = {
  sleep, until, reporter, SPY_JS, CSP_RECORDER, armedContext, open, gaCookies, allCookies, barButton, snap, copyIssues,
  DISABLE_FLAG, SNAPSHOT, sectionBlocks, consentDigest, snapshotDiff, compareSnapshot, snapshotDoc, writeSnapshot, pageLang, NOTICE_PAGES,
};
