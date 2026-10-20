// Behaviour of the consent module in app.js, in a real browser, with every Google request stubbed.
//   node verify/consent.js            about two minutes
//   FULL=1 node verify/consent.js     the whole table of damaged stored answers
//   node verify/consent.js --update   re-take the consent-text snapshot (see the last check) and stop. It refuses
//                                     (exit 2) when the consent text changed and POLICY_VERSION did not: review the diff,
//                                     bump POLICY_VERSION if the change alters what a visitor agrees to, or pass
//                                     --same-version to say the wording changed and the version stays
//
// Every scenario runs armed (armGa in _common.js): app.js is served with the dummy Measurement ID
// G-TEST000000, gtag.js is a stand-in that writes the _ga cookies and sends a collect hit, collect hits are
// answered 204, and any other request that leaves the site is aborted and counted. So nothing real is
// contacted, and a page that reaches for any other host fails the scenario. The pages are armed with the
// widened Content-Security-Policy and the footer link only if they do not carry them yet, and the run fails if
// any page needed either (the shipped tree carries both on every page).
//
// What this proves, and what it cannot: the stand-in behaves as Google documents gtag, nothing more. Real
// gtag cookie and network behaviour is covered only by consent-live.js and the pre-flip checklist.
const {
  PAGES, BASE, TEST_ID, PLACEHOLDER_ID, CONSENT_KEY, POLICY_VERSION, NOTICE_PAGES, launch, pool, pinConsent,
  readApp, rewriteGaIdSource, normalisePurgeOnly, PURGE_DECL, todayUtc, redact, isActiveShape, GOOGLEISH, pageLang,
  stripComments, stripElements, decodeEntities, htmlToText, escapeRegExp,
} = require('./_common');
const C = require('./_consent');
const { googleHostMentions } = require('./csp');

const { sleep, until, snap, barButton: btn, gaCookies, allCookies, armedContext, open } = C;
const FULL = !!process.env.FULL;
const app = readApp();
const copy = app.copy;
const today = todayUtc();
const langOf = (p) => (/^sv/i.test(pageLang(p) || '') ? 'sv' : 'en');
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((y) => [y, x[y]])) : x));
const rep = C.reporter();
const ck = rep.check;

if (process.argv.includes('--update')) {
  const cur = C.consentDigest();
  const d = C.snapshotDiff(cur);
  if (d.exists && d.changes.length && !d.bumped && !process.argv.includes('--same-version')) {
    console.error(`REFUSED: the consent text changed and POLICY_VERSION is still ${cur.policyVersion}, so the snapshot was not taken.
  changed: ${d.changes.join('; ')}
  Review the consent text diff first (git diff). If the change alters what a visitor agrees to, bump POLICY_VERSION in app.js
  (and in _common.js) so old answers lapse, then run --update again. If the wording changed and the version should stay,
  say so: node verify/consent.js --update --same-version`);
    process.exit(2);
  }
  C.writeSnapshot(cur);
  const missing = Object.entries(cur.sections).filter(([, v]) => !v).map(([k]) => k);
  console.log(`snapshot written: POLICY_VERSION ${cur.policyVersion}, ${Object.keys(cur.copy).length} COPY strings, ${Object.entries(cur.sections).filter(([, v]) => v).map(([k, v]) => `${k} (${v.length} blocks)`).join(', ') || 'no notice section'}`);
  if (missing.length) console.log(`WARN  no #cookies section found in ${missing.join(', ')}: run --update again once the page exists`);
  process.exit(0);
}

// The current COOKIE_MAX_AGE and limits in app.js, to compare with what the module sends.
const maxAge = Number((/var COOKIE_MAX_AGE = (\d+)/.exec(app.src) || [])[1]);
const maxDays = Number((/var CONSENT_MAX_DAYS = (\d+)/.exec(app.src) || [])[1]);
const dAgo = (n) => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - n)).toISOString().slice(0, 10); };

const rendered = [];                 // every string the module showed, for the copy rules
const armNotes = { csp: {}, footer: {} };
const synthetic = [];                // scenarios that fell back to a synthetic event because the real one did not happen here
const noteArming = (ga) => ga.pages.forEach((n) => { armNotes.csp[n.csp] = (armNotes.csp[n.csp] || 0) + 1; armNotes.footer[n.footer] = (armNotes.footer[n.footer] || 0) + 1; });

// Common closing assertions for a scenario's environment: nothing off-origin, no violation, no error.
function clean(env, name) {
  const bad = [];
  if (env.ga.blocked.length) bad.push('blocked requests: ' + env.ga.blocked.map(redact).join(', '));
  if (env.ga.leaks.length) bad.push('leaks: ' + env.ga.leaks.map((l) => l.url).join(', '));
  if (env.violations.length) bad.push('CSP violations: ' + env.violations.join(' | '));
  if (env.refused.length) bad.push('console: ' + env.refused.join(' | '));
  if (env.pageErrors.length) bad.push('page errors: ' + env.pageErrors.join(' | '));
  if (env.ga.errors.length) bad.push('route errors: ' + env.ga.errors.join(' | '));
  ck(bad.length === 0, `${name}: no CSP violation, page error or request outside the stubs`, bad.join('; '));
}

(async () => {
  const t0 = Date.now();
  const browser = await launch();
  const timings = [];
  const scenario = async (title, fn) => {
    const t = Date.now();
    console.log(`\n== ${title}`);
    try { await fn(); } catch (e) { ck(false, `${title}: scenario crashed`, e && e.message ? e.message.split('\n')[0] : String(e)); }
    timings.push([title, (Date.now() - t) / 1000]);
  };

  // ---------------------------------------------------------------------------------------------
  await scenario('UNITS: the test helpers and the constants they share with app.js', async () => {
    let threw = false;
    try { rewriteGaIdSource('var x = 1;', TEST_ID); } catch (e) { threw = /exactly one/.test(e.message); }
    ck(threw, 'rewriteGaId fails loudly when app.js has no GA_ID line');
    threw = false;
    try { rewriteGaIdSource(app.src + "\nvar GA_ID = 'G-AAAAAA';", TEST_ID); } catch (e) { threw = /found 2/.test(e.message); }
    ck(threw, 'rewriteGaId fails loudly when app.js has two GA_ID lines');
    threw = false;
    try { rewriteGaIdSource(app.src.replace(PURGE_DECL, ''), TEST_ID); } catch (e) { threw = /PURGE_ONLY/.test(e.message) && /found 0/.test(e.message); }
    ck(threw, 'rewriteGaId fails loudly when app.js has no PURGE_ONLY declaration');
    threw = false;
    try { rewriteGaIdSource(app.src.replace(PURGE_DECL, (m, indent) => `${m}\n${indent}var PURGE_ONLY = false;`), TEST_ID); } catch (e) { threw = /PURGE_ONLY/.test(e.message) && /found 2/.test(e.message); }
    ck(threw, 'rewriteGaId fails loudly when app.js has two PURGE_ONLY declarations');
    const exitState = app.src.replace(PURGE_DECL, (m, indent) => `${indent}var PURGE_ONLY = true;`);
    ck(/var PURGE_ONLY = false;/.test(rewriteGaIdSource(exitState, TEST_ID)) && !/var PURGE_ONLY = true;/.test(rewriteGaIdSource(exitState, TEST_ID)),
      'rewriteGaId serves PURGE_ONLY false even when the file ships true (the exit state), so the whole suite still passes there');
    ck(app.gaLines === 1, "app.js has exactly one var GA_ID = '...'; line", `${app.gaLines}`);
    ck(readApp(undefined, rewriteGaIdSource(app.src, TEST_ID)).gaId === TEST_ID, `rewriteGaId yields the dummy ID ${TEST_ID}`);
    ck(app.policyVersion === POLICY_VERSION && app.consentKey === CONSENT_KEY,
      'POLICY_VERSION and CONSENT_KEY in _common.js equal app.js (pinConsent writes what the module reads)',
      `app.js ${app.consentKey}/${app.policyVersion}, _common.js ${CONSENT_KEY}/${POLICY_VERSION}`);
    ck(maxAge > 0 && maxDays > 0 && maxAge <= maxDays * 86400, 'the _ga cookie lifetime is never longer than the consent record', `${maxAge}s against ${maxDays} days`);
    ck(!!copy && copy.en && copy.sv, 'app.js has COPY for en and sv');

    // The markup helpers read the pages for several checks. They scan instead of pattern-stripping, so what they cut
    // out cannot be left behind or put back together, and they decode every entity in one pass.
    ck(stripComments('a<!-- x -->b') === 'ab' && stripComments('a<!<!-- x -->--b') === 'a' && !stripComments('<!<!-- x -->-->').includes('<!--') && stripComments('a<!-- never closed') === 'a',
      'stripComments removes comments, cannot be made to leave "<!--" behind by nesting one, and ends an unterminated comment at the end');
    ck(stripElements('<p>a</p><script>x</script >b<STYLE type=x>y</STYLE>c', ['script', 'style']) === '<p>a</p>bc' && stripElements('<scr<script></script>ipt>alert(1)</script>', ['script']) === '' && stripElements('<scripty>k</scripty>', ['script']) === '<scripty>k</scripty>' && stripElements('a<script>never closed', ['script']) === 'a',
      'stripElements ignores case and spaces in the end tag, cannot be made to reassemble a <script> by nesting, leaves <scripty> alone and ends an unclosed element at the end');
    ck(decodeEntities('&amp;lt;') === '&lt;' && decodeEntities('&lt;b&gt; &amp; &quot;x&quot; &#39;y&#39; a&ndash;b&nbsp;c') === '<b> & "x" \'y\' a–b c',
      'decodeEntities decodes every entity once: "&amp;lt;" becomes "&lt;", never "<"');
    ck(htmlToText('<h2 class="a">Title</h2><p>One <a title="a>b" href=\'x>y\'>two</a> 3 < 4<br>next</p><ul><li>L1</li><li>L2</li></ul><!-- c --><script>var a = "<p>";</script>')
      === 'Title\nOne two 3 < 4\nnext\nL1\nL2\n\n',
      'htmlToText keeps a ">" inside a quoted attribute out of the text, treats a bare "<" as text, breaks lines after block tags and <br>, and drops comments and scripts');
    ck(new RegExp('^' + escapeRegExp('a\\b.c+d(e)') + '$').test('a\\b.c+d(e)') && !new RegExp('^' + escapeRegExp('a.c') + '$').test('abc') && escapeRegExp('\\') === '\\\\',
      'escapeRegExp escapes every special character, the backslash included');

    const env = await armedContext(browser);
    const page = await open(env.ctx, 'robots.txt');
    const format = /^v1:(granted|denied):\d{4}-\d{2}-\d{2}$/;
    await page.evaluate(pinConsent, 'granted');
    const g = await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY);
    await page.evaluate(pinConsent, 'denied');
    const d = await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY);
    await page.evaluate(pinConsent, 'undecided');
    const u = await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY);
    ck(format.test(g) && g.endsWith(today) && /:granted:/.test(g) && format.test(d) && /:denied:/.test(d) && u === null,
      'pinConsent writes the exact app.js format with today\'s UTC date, and undecided removes the key', `${g} | ${d} | ${u}`);
    let bad = false;
    try { await page.evaluate(pinConsent, 'maybe'); } catch (e) { bad = true; }
    ck(bad, 'pinConsent rejects an unknown state');
    await env.close();
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('INERT: the module does nothing while GA_ID is the placeholder or not a GA4 ID', async () => {
    // Baseline: the same app.js with the consent module cut off the end. Anything the inert module does shows as a difference.
    const probe = await armedContext(browser, { arm: { inert: true } });
    const raw = await (await probe.ctx.request.get(BASE + 'app.js')).text();
    await probe.close();
    const cut = raw.lastIndexOf('(function () {', raw.indexOf("var GA_ID"));
    ck(cut > 0, 'found the consent module at the end of app.js to cut for the baseline');
    const stripped = raw.slice(0, cut);

    const run = async (rel, { arm = {}, strip = false, seed = false }) => {
      const env = await armedContext(browser, { theme: 'light', consent: seed ? 'granted' : undefined, spy: true, arm: strip ? { inert: true } : arm });
      if (strip) await env.ctx.route((u) => u.pathname.endsWith('/app.js'), (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: stripped }));
      await env.ctx.addCookies([{ name: '_ga', value: 'keep', url: BASE }, { name: '_ga_TEST000000', value: 'keep', url: BASE }]);
      const page = await open(env.ctx, rel);
      await sleep(2000);                                     // well past the module's one-second timer, if it had one
      const spy = await page.evaluate(() => window.__spy);
      const s = await snap(page);
      const fp = {
        spy, htmlClass: s.htmlClass, bar: s.bar, live: s.live === undefined ? null : s.live, footer: s.footerLink, panel: s.panel,
        cookies: (await gaCookies(env.ctx)).sort(), google: env.ga.google().length + env.ga.blocked.length, dl: s.dl, scripts: s.scripts,
        errors: env.pageErrors.length,
      };
      await env.close();
      return fp;
    };
    const diff = (a, b) => {
      const out = [];
      for (const k of ['storage', 'cookie', 'listeners', 'dom', 'focus']) if (canon(a.spy[k]) !== canon(b.spy[k])) out.push(`${k}: ${canon(a.spy[k]).slice(0, 160)} vs baseline ${canon(b.spy[k]).slice(0, 160)}`);
      for (const k of ['htmlClass', 'bar', 'live', 'footer', 'panel', 'cookies', 'google', 'dl', 'scripts', 'errors']) if (canon(a[k]) !== canon(b[k])) out.push(`${k}: ${canon(a[k])} vs baseline ${canon(b[k])}`);
      if (a.spy.storage.some((s) => s.includes(CONSENT_KEY))) out.push('read or wrote ' + CONSENT_KEY);
      return out;
    };
    const base = {};
    for (const rel of ['index.html', 'sv.html']) base[rel] = await run(rel, { strip: true });
    ck(base['index.html'].cookies.length === 2 && !base['index.html'].bar, 'baseline (no consent module): the planted _ga cookies stay and there is no bar');

    const cases = [
      ['index.html', 'placeholder', { arm: { id: PLACEHOLDER_ID } }],
      ['index.html', 'placeholder with an answer already stored', { arm: { id: PLACEHOLDER_ID }, seed: true }],
      ['index.html', 'empty ID', { arm: { id: '' } }],
      ['index.html', 'five characters (G-ABCDE)', { arm: { id: 'G-ABCDE' } }],
      ['index.html', 'thirteen characters', { arm: { id: 'G-ABCDEFGHIJKLM' } }],
      ['index.html', 'lower case (g-test000000)', { arm: { id: 'g-test000000' } }],
      ['index.html', 'a Universal Analytics ID', { arm: { id: 'UA-12345-1' } }],
      ['index.html', 'six X (placeholder-shaped)', { arm: { id: 'G-XXXXXX' } }],
      ['index.html', 'eleven X (placeholder-shaped)', { arm: { id: 'G-XXXXXXXXXXX' } }],
      ['sv.html', 'placeholder on a Swedish page', { arm: { id: PLACEHOLDER_ID } }],
    ];
    if (!isActiveShape(app.gaId)) {
      cases.unshift(['index.html', 'the file as shipped (no rewrite)', { arm: { inert: true } }], ['sv.html', 'the file as shipped, Swedish page', { arm: { inert: true } }]);
    } else console.log('note  the shipped app.js carries an active-looking ID, so the "as shipped" run is skipped (every case above rewrites the ID)');
    const out = await pool(cases, 3, async ([rel, label, o]) => ({ rel, label, d: diff(await run(rel, o), base[rel]) }));
    for (const r of out) ck(r.d.length === 0, `inert: ${r.label} (${r.rel}) leaves no trace`, r.d.join(' | '));

    // Control: a valid-shaped ID must be detected as active, or the comparison above proves nothing.
    const ctl = await run('index.html', { arm: { id: 'G-ABCDEF', controlId: true } });
    ck(diff(ctl, base['index.html']).length > 0 && ctl.bar, 'control: a valid-shaped ID makes the same comparison fail (bar and listeners appear)');
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('UNDECIDED and LANGUAGE: every page, nothing from Google, the bar in the page\'s language', async () => {
    const rows = await pool(PAGES, 4, async (p) => {
      const env = await armedContext(browser, { init: [[(re) => {
        const hosts = new RegExp(re, 'i');
        const win = (window.__scan = { dcl: [], later: [] });
        const host = (u) => { try { return new URL(u, location.href).hostname; } catch (e) { return ''; } };
        const HINT = /(^|\s)(preconnect|dns-prefetch|prefetch|prerender|preload|modulepreload)(\s|$)/i;
        const scan = (into) => {
          document.querySelectorAll('link[href], script[src], img[src], iframe[src], source[src], source[srcset], video[src], audio[src], object[data], embed[src]').forEach((el) => {
            const u = el.getAttribute('href') || el.getAttribute('src') || el.getAttribute('srcset') || el.getAttribute('data') || '';
            const rel = el.localName === 'link' ? el.getAttribute('rel') || '' : '';
            if (hosts.test(host(u)) && (el.localName !== 'link' || HINT.test(rel) || /stylesheet|icon/i.test(rel))) into.push(`${el.localName} ${rel} ${u}`);
          });
        };
        // at DOMContentLoaded, after the module's own handler (this listener is first in line, so look one task later)
        document.addEventListener('DOMContentLoaded', () => setTimeout(() => scan(win.dcl), 0));
        new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((n) => {
          if (n.nodeType === 1 && (hosts.test(host(n.getAttribute && (n.getAttribute('href') || n.getAttribute('src')) || '')))) win.later.push(`${n.localName} ${n.getAttribute('rel') || ''} ${n.getAttribute('href') || n.getAttribute('src')}`);
        }))).observe(document, { childList: true, subtree: true });
        window.__scanNow = () => { const out = []; scan(out); return out; };
      }, GOOGLEISH.source]] });
      const raw = await (await env.ctx.request.get(BASE + p)).text();
      const page = await open(env.ctx, p);
      const s0 = await snap(page);
      await sleep(3000);
      const info = await page.evaluate(() => {
        const bar = document.getElementById('consent-bar');
        const q = (sel) => bar && bar.querySelector(sel);
        const text = q('.consent__text');
        const fl = document.querySelector('[data-consent-open]');
        return {
          barLang: bar && bar.getAttribute('lang'), label: bar && bar.getAttribute('aria-label'),
          text: text && text.firstChild ? text.firstChild.textContent.trim() : null, fullText: text ? text.textContent : '',
          link: q('.consent__link') ? { text: q('.consent__link').textContent, href: q('.consent__link').getAttribute('href') } : null,
          buttons: bar ? [...bar.querySelectorAll('button')].map((b) => ({ text: b.textContent, label: b.getAttribute('aria-label') })) : [],
          footer: fl ? { text: fl.textContent.trim(), href: fl.getAttribute('href'), lang: fl.getAttribute('lang') } : null,
          scan: window.__scan, later: window.__scanNow ? window.__scanNow() : [], dl: typeof window.dataLayer, gtag: typeof window.gtag,
          ls: (() => { try { return localStorage.getItem('vynatix-consent'); } catch (e) { return 'THROWS'; } })(),
        };
      });
      const cookies = await allCookies(env.ctx);
      noteArming(env.ga);
      const out = { p, lang: langOf(p), s0, info, raw: googleHostMentions(raw), cookies, google: env.ga.google().length, blocked: env.ga.blocked.slice(), violations: env.violations.concat(env.refused), pageErrors: env.pageErrors.slice() };
      await env.close();
      return out;
    });
    for (const r of rows) {
      const L = copy[r.lang];
      const issues = [];
      if (r.google || r.blocked.length) issues.push(`${r.google} Google request(s), ${r.blocked.length} blocked: ${r.blocked.map(redact).join(', ')}`);
      if (r.cookies.length) issues.push('cookies: ' + r.cookies.join(', '));
      if (r.info.ls !== null) issues.push(`${CONSENT_KEY} is ${r.info.ls}`);
      if (r.info.dl !== 'undefined' || r.info.gtag !== 'undefined') issues.push('dataLayer or gtag exists before a choice');
      if (!r.s0.bar || r.s0.barCount !== 1) issues.push('no single bar');
      if (r.info.buttons.length !== 2) issues.push(`${r.info.buttons.length} buttons`);
      if (r.raw.length) issues.push('served HTML names Google: ' + r.raw.join(', '));
      const hints = [].concat((r.info.scan || {}).dcl || [], (r.info.scan || {}).later || [], r.info.later);
      if (hints.length) issues.push('Google hint or resource in the DOM: ' + hints.join(' | '));
      if (r.violations.length || r.pageErrors.length) issues.push('violations or errors: ' + r.violations.concat(r.pageErrors).join(' | '));
      // language
      const lang = [];
      if (r.info.barLang !== r.lang) lang.push(`bar lang "${r.info.barLang}"`);
      if (r.info.label !== L.label) lang.push(`aria-label "${r.info.label}"`);
      if (r.info.text !== L.text) lang.push(`text "${r.info.text}"`);
      if (!r.info.link || r.info.link.text !== L.notice || r.info.link.href !== L.noticeHref) lang.push(`notice link ${JSON.stringify(r.info.link)}`);
      const [dec, acc] = r.info.buttons;
      if (!dec || dec.text !== L.decline || dec.label !== L.declineLabel || !acc || acc.text !== L.accept || acc.label !== L.acceptLabel) lang.push(`buttons ${JSON.stringify(r.info.buttons)}`);
      const want = r.lang === 'sv' ? { text: L.footer, href: L.noticeHref, lang: 'sv' } : { text: L.footer, href: L.noticeHref, lang: null };
      if (!r.info.footer || r.info.footer.text !== want.text || r.info.footer.href !== want.href || r.info.footer.lang !== want.lang) lang.push(`footer link ${JSON.stringify(r.info.footer)} (want ${JSON.stringify(want)})`);
      if (r.info.footer && !r.info.fullText.includes(r.info.footer.text)) lang.push(`the bar does not name the footer link "${r.info.footer.text}"`);
      if (r.lang === 'sv' && !/[åäö]/i.test(r.info.fullText + r.info.footer.text)) lang.push('no Swedish letters in the rendered text');
      if (/&[a-z]+;|&#|Ã/.test(r.info.fullText + (r.info.footer || {}).text)) lang.push('entity or encoding artefact in the text');
      ck(!issues.length && !lang.length, `${r.p} (${r.lang}): undecided is silent, bar and footer link in the page's language`, issues.concat(lang).join(' | '));
      if (r.p === 'index.html' || r.p === 'sv.html') rendered.push(...[r.info.label, r.info.text, r.info.link && r.info.link.text, r.info.footer && r.info.footer.text, ...r.info.buttons.flatMap((b) => [b.text, b.label])].filter(Boolean).map((t) => [r.p + ' bar', t]));
    }
    const kept = armNotes.csp.kept || 0, rewritten = armNotes.csp.rewritten || 0, present = armNotes.footer.present || 0, inserted = armNotes.footer.inserted || 0;
    console.log(`note  armed pages: policy already widened on ${kept}, rewritten on ${rewritten}; footer link already present on ${present}, inserted on ${inserted}`);
    ck(inserted === 0 && rewritten === 0 && present === PAGES.length && kept === PAGES.length,
      'the armed run did not have to repair any page: every page already carries the widened policy and the Cookie settings link (the harness inserts them only into a tree that lacks them)',
      `policy kept on ${kept} of ${PAGES.length}, rewritten on ${rewritten}; footer link present on ${present}, inserted on ${inserted}`);
    // Three navigations without choosing: still nothing.
    const env = await armedContext(browser);
    for (const p of ['index.html', 'about.html', 'contact.html']) { await open(env.ctx, p); await sleep(200); }
    ck(env.ga.google().length === 0 && env.ga.blocked.length === 0 && (await allCookies(env.ctx)).length === 0, 'three page loads without a choice: no Google request, no cookie');
    await env.close();
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('ACCEPT by a real click', async () => {
    const env = await armedContext(browser, { spy: true });
    const page = await open(env.ctx, 'index.html');
    ck((await allCookies(env.ctx)).length === 0 && env.ga.google().length === 0, 'before the click: no cookie, no Google request');
    await page.click(btn('granted'));
    ck(await until(() => env.ga.collect.length >= 1), 'a collect hit is sent after Accept', `${env.ga.collect.length}`);
    await sleep(300);
    const s = await snap(page);
    ck(env.ga.gtag.length === 1 && s.scripts.length === 1, 'gtag.js is requested exactly once', `${env.ga.gtag.length} requests, ${s.scripts.length} script elements`);
    ck(s.scripts[0] === `https://www.googletagmanager.com/gtag/js?id=${TEST_ID}`, 'the script URL is the path-pinned one with the ID', redact(String(s.scripts[0])));
    const names = await gaCookies(env.ctx);
    ck(names.some((n) => n.startsWith('_ga@')) && names.some((n) => n.startsWith('_ga_TEST000000@')), 'the _ga cookies appear only now', names.join(', '));
    const want = [
      ['consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }],
      ['js', 'Date'],
      ['consent', 'update', { analytics_storage: 'granted' }],
      ['config', TEST_ID, { allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: maxAge }],
    ];
    ck(canon(s.stub && s.stub.cmds) === canon(want), 'gtag commands in the contract order, with the contract arguments, no anonymize_ip or client_storage', canon(s.stub && s.stub.cmds));
    const kinds = await page.evaluate(() => Array.from(window.dataLayer, (x) => Object.prototype.toString.call(x)));
    ck(kinds.length === 4 && kinds.every((k) => k === '[object Arguments]'), 'the dataLayer holds Arguments objects, as gtag.js reads them', kinds.join(','));
    ck(s.ls === `${POLICY_VERSION}:granted:${today}`, 'the choice persists as v1:granted:<UTC date>', s.ls);
    ck(!s.bar && !/consent-open/.test(s.htmlClass) && s.flag === false, 'the bar is gone, consent-open removed, Google\'s off switch is false');
    ck(s.live === copy.en.liveOn && s.active === 'body', 'the choice is announced in the live region and focus is not moved', `live "${s.live}", active ${s.active}`);
    const spy = await page.evaluate(() => window.__spy);
    ck(spy.focus.length === 0, 'no focus() call after a first-visit choice', spy.focus.join(','));
    const hints = await page.evaluate(() => [...document.querySelectorAll('link')].filter((l) => /preconnect|dns-prefetch|prefetch|prerender|preload/.test(l.rel) && /google/.test(l.href)).map((l) => l.rel + ' ' + l.href));
    ck(hints.length === 0, 'no preconnect, dns-prefetch or preload hint to Google is added', hints.join(', '));
    // Next page: the answer is kept and gtag loads again.
    await page.goto(BASE + 'about.html', { waitUntil: 'load' });
    const s2 = await snap(page);
    ck(await until(() => env.ga.gtag.length === 2), 'the next page loads gtag.js again without asking', `${env.ga.gtag.length} requests`);
    ck(!s2.bar && s2.ls === s.ls, 'the next page shows no bar and keeps the answer');
    ck(await until(() => env.ga.collect.length >= 2), 'the next page sends its own collect hit', `${env.ga.collect.length}`);
    clean(env, 'accept');
    await env.close();
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('DECLINE by a real click', async () => {
    const env = await armedContext(browser);
    await env.ctx.addCookies([{ name: '_ga', value: 'x', url: BASE }, { name: '_ga_TEST000000', value: 'x', url: BASE }, { name: '_gid', value: 'x', url: BASE }, { name: 'other', value: 'x', url: BASE }]);
    const page = await open(env.ctx, 'index.html');
    await sleep(250);
    const names = (await allCookies(env.ctx)).map((n) => n.split('@')[0]).sort();
    ck(!names.includes('_ga') && !names.includes('_ga_TEST000000') && names.includes('_gid') && names.includes('other'), 'an undecided visit deletes leftover _ga and _ga_* cookies and no other cookie', names.join(', '));
    await page.click(btn('denied'));
    await sleep(300);
    const s = await snap(page);
    ck(s.ls === `${POLICY_VERSION}:denied:${today}` && !s.bar && s.flag === true && s.live === copy.en.liveOff, 'Decline persists v1:denied:<date>, closes the bar, sets Google\'s off switch and announces', `${s.ls} flag ${s.flag} live "${s.live}"`);
    for (const p of ['about.html', 'contact.html']) {
      await page.goto(BASE + p, { waitUntil: 'load' });
      await sleep(250);
      const s2 = await snap(page);
      ck(!s2.bar && s2.ls === s.ls && env.ga.google().length === 0 && (await gaCookies(env.ctx)).length === 0, `after Decline, ${p}: no bar, no Google request, no _ga cookie`);
    }
    clean(env, 'decline');
    await env.close();
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('WITHDRAW from the footer link: reopen, Escape, Decline, no more hits', async () => {
    const env = await armedContext(browser, { arm: { stub: { straggle: [300] } }, spy: true });
    const page = await open(env.ctx, 'index.html');
    await page.click(btn('granted'));
    await until(() => env.ga.collect.length >= 1);
    ck((await gaCookies(env.ctx)).length >= 2, 'granted: the _ga cookies exist');
    await page.click('[data-consent-open]');
    let s = await snap(page);
    ck(s.bar && s.status === copy.en.on && s.active === 'button[denied]' && /consent-open/.test(s.htmlClass), 'the footer link reopens the bar with the status "on" and focus on the first button', `status "${s.status}", active ${s.active}`);
    rendered.push(['reopen on', s.status]);
    await page.keyboard.press('Escape');
    s = await snap(page);
    ck(!s.bar && s.ls === `${POLICY_VERSION}:granted:${today}` && s.active === 'a[open]' && !/consent-open/.test(s.htmlClass), 'Escape hides the bar without changing the choice and returns focus to the link', `ls ${s.ls}, active ${s.active}`);
    await page.click('[data-consent-open]');
    const before = env.ga.collect.length;
    await page.click(btn('denied'));
    s = await snap(page);
    ck(s.flag === true && s.live === copy.en.liveOff && s.active === 'a[open]' && s.ls === `${POLICY_VERSION}:denied:${today}`, 'Decline withdraws: off switch set, announced, focus back on the link', `flag ${s.flag}, live "${s.live}", active ${s.active}`);
    const last = s.dl[s.dl.length - 1];
    ck(canon(last) === canon(['consent', 'update', { analytics_storage: 'denied' }]), 'gtag is told analytics_storage is denied', canon(last));
    ck((await gaCookies(env.ctx)).length === 0, 'the _ga cookies are gone at once');
    await sleep(2000);                                     // the stand-in writes them once more at 300 ms; the second purge is at 1000 ms
    ck((await gaCookies(env.ctx)).length === 0, 'and stay gone after gtag writes them once more (second purge)');
    await page.evaluate(() => window.__gaStub.send('scroll'));
    await sleep(300);
    const st = (await snap(page)).stub;
    ck(env.ga.collect.length === before && st.blocked >= 1, 'no further collect hit after withdrawal; the off switch stops it', `collect ${before} -> ${env.ga.collect.length}, blocked ${st.blocked}`);
    await page.reload({ waitUntil: 'load' });
    await sleep(300);
    ck(env.ga.gtag.length === 1 && (await gaCookies(env.ctx)).length === 0, 'after a reload nothing loads and nothing is set');
    clean(env, 'withdraw');
    await env.close();
  });

  await scenario('WITHDRAW from the privacy page panel: one click', async () => {
    for (const lang of ['en', 'sv']) {
      const rel = NOTICE_PAGES[lang];
      const L = copy[lang];
      const env = await armedContext(browser, { consent: 'granted' });
      const page = await open(env.ctx, rel + '#cookies');
      await until(() => env.ga.collect.length >= 1);
      let s = await snap(page);
      const anchor = await page.evaluate(() => ({ target: !!document.getElementById('cookies'), hash: location.hash }));
      ck(anchor.target && anchor.hash === '#cookies', `${rel}#cookies resolves to an element`);
      ck(s.panel && s.panel.status === L.on && s.panel.buttons === 2 && !s.bar, `${rel}: the panel shows the status and both buttons, and no bar for a stored answer`, JSON.stringify(s.panel));
      rendered.push([rel + ' panel on', s.panel && s.panel.status]);
      const classes = await page.evaluate(() => [...document.querySelectorAll('[data-consent-panel] button')].map((b) => b.className));
      ck(classes.length === 2 && classes[0] === classes[1], `${rel}: the panel buttons have identical classes`, classes.join(' | '));
      ck((await gaCookies(env.ctx)).length >= 2, `${rel}: granted, cookies exist`);
      await page.click('[data-consent-panel] [data-consent-choice=denied]');
      await sleep(150);
      s = await snap(page);
      ck(s.panel.status === L.off && !s.bar && s.flag === true && s.ls === `${POLICY_VERSION}:denied:${today}` && s.live === L.liveOff, `${rel}: one click on Decline in the panel withdraws`, JSON.stringify(s.panel) + ` flag ${s.flag}`);
      ck((await gaCookies(env.ctx)).length === 0, `${rel}: cookies removed`);
      rendered.push([rel + ' panel off', s.panel.status], [rel + ' live', s.live]);
      await page.click('[data-consent-panel] [data-consent-choice=granted]');
      await until(() => env.ga.collect.length >= 2);
      s = await snap(page);
      ck(s.panel.status === L.on && env.ga.collect.length >= 2, `${rel}: Accept in the panel measures again`);
      clean(env, 'panel ' + lang);
      await env.close();

      // First visit on the notice page: the bar and the panel agree, and a choice in the panel closes the bar.
      const e2 = await armedContext(browser);
      const p2 = await open(e2.ctx, rel);
      s = await snap(p2);
      ck(s.bar && s.panel && s.panel.status === L.undecided, `${rel}: first visit shows the bar and the panel says no choice yet`, JSON.stringify(s.panel));
      rendered.push([rel + ' panel undecided', s.panel && s.panel.status]);
      await p2.click('[data-consent-panel] [data-consent-choice=denied]');
      s = await snap(p2);
      ck(!s.bar && s.panel.status === L.off, `${rel}: a choice in the panel closes the first-visit bar`);
      await e2.close();
    }
  });

  await scenario('WITHDRAW across tabs, bfcache and a stale tab', async () => {
    // A storage event in a second page revokes the first.
    let env = await armedContext(browser);
    const A = await open(env.ctx, 'index.html');
    await A.click(btn('granted'));
    await until(() => env.ga.collect.length >= 1);
    const B = await open(env.ctx, 'about.html');
    await B.evaluate(([k, v]) => localStorage.setItem(k, v), [CONSENT_KEY, `${POLICY_VERSION}:denied:${today}`]);
    ck(await until(async () => (await snap(A)).flag === true, 1500), 'a storage event from another tab revokes: the off switch is set in the first tab');
    ck(await until(async () => (await gaCookies(env.ctx)).length === 0, 1500), 'and the cookies are removed');
    await A.evaluate(() => window.__gaStub.send('x'));
    const hits = env.ga.collect.length;
    await sleep(200);
    ck(env.ga.collect.length === hits, 'and no hit follows');
    await env.close();

    // A stale tab that declined earlier must not wipe the cookies of a tab that accepted since.
    env = await armedContext(browser);
    const stale = await open(env.ctx, 'index.html');
    await stale.click(btn('denied'));
    await sleep(2000);                                      // past this tab's own second purge at 1000 ms
    const live = await open(env.ctx, 'about.html');
    await live.click('[data-consent-open]');
    await live.click(btn('granted'));
    await until(() => env.ga.collect.length >= 1);
    const have = (await gaCookies(env.ctx)).length;
    await stale.close();
    await sleep(2500);                                      // the closed tab's pagehide purge has run, and a late one would have shown
    ck(have >= 2 && (await gaCookies(env.ctx)).length === have, 'closing a stale tab does not delete the cookies of a tab that is granted', `${have} before, ${(await gaCookies(env.ctx)).length} after`);
    clean(env, 'tabs');
    await env.close();

    // Accept, Decline, Accept in one page, counted by collect hits.
    env = await armedContext(browser);
    const page = await open(env.ctx, 'index.html');
    await page.click(btn('granted'));
    await until(() => env.ga.collect.length >= 1);
    const c1 = env.ga.collect.length;
    await page.click('[data-consent-open]');
    await page.click(btn('denied'));
    await page.evaluate(() => window.__gaStub.send('between'));
    await sleep(250);
    const c2 = env.ga.collect.length;
    await page.click('[data-consent-open]');
    await page.keyboard.press('Tab');                       // Decline -> Accept, then press it with the keyboard
    await page.keyboard.press('Enter');
    ck(await until(() => env.ga.collect.length > c2), 'Accept after Decline in the same page sends a hit again (keyboard)', `hits ${c1} -> ${c2} -> ${env.ga.collect.length}`);
    await sleep(2000);                                      // the first Decline's second purge must not wipe the fresh cookies
    const s = await snap(page);
    ck(c1 === 1 && c2 === 1 && env.ga.collect.length === 2, 'collect hits count 1, 1, 2 across Accept, Decline, Accept', `${c1}, ${c2}, ${env.ga.collect.length}`);
    ck(env.ga.gtag.length === 1 && s.scripts.length === 1 && s.flag === false, 'the script is not loaded twice and the off switch is cleared');
    ck((await gaCookies(env.ctx)).length >= 2, 'the cookies set after the second Accept survive the first Decline\'s delayed purge');
    clean(env, 'accept-decline-accept');
    await env.close();
  });

  await scenario('WITHDRAW after a back/forward cache restore', async () => {
    const bf = await launch({ ignoreDefaultArgs: ['--disable-back-forward-cache'], args: ['--enable-features=BackForwardCache'] });
    const env = await armedContext(bf);
    const A = await env.ctx.newPage();
    await A.addInitScript(() => { window.addEventListener('pageshow', (e) => { (window.__ps = window.__ps || []).push(e.persisted); }); });
    await A.goto(BASE + 'index.html', { waitUntil: 'load' });
    await A.click(btn('granted'));
    await until(() => env.ga.collect.length >= 1);
    await A.evaluate(() => { window.__marker = 'alive'; });
    await A.goto(BASE + 'about.html', { waitUntil: 'load' });
    const B = await open(env.ctx, 'contact.html');
    await B.evaluate(([k, v]) => localStorage.setItem(k, v), [CONSENT_KEY, `${POLICY_VERSION}:denied:${today}`]);   // declined elsewhere while A sits in the cache
    await sleep(200);
    await A.goBack({ waitUntil: 'commit' });
    await sleep(700);
    const real = (await A.evaluate(() => window.__marker)) === 'alive';
    if (!real) {
      synthetic.push('back/forward cache restore');
      console.log('note  the back/forward cache did not engage here (route interception can keep it out), so this restore is a synthetic pageshow event on the same document, not a real cache restore');
      // The cache did not engage under route interception here: grant again, then write the refusal into the same
      // document (no storage event) and fire the event the browser would fire on a restore.
      await A.evaluate(([k, v]) => localStorage.setItem(k, v), [CONSENT_KEY, `${POLICY_VERSION}:granted:${today}`]);
      await A.goto(BASE + 'index.html', { waitUntil: 'load' });
      const hitsBefore = env.ga.collect.length;
      await until(() => env.ga.collect.length > hitsBefore);
      await A.evaluate(([k, v]) => localStorage.setItem(k, v), [CONSENT_KEY, `${POLICY_VERSION}:denied:${today}`]);
      await A.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await sleep(200);
    }
    const s = await snap(A);
    ck(s.flag === true && (await gaCookies(env.ctx)).length === 0, `a restored page re-reads the answer and revokes (${real ? 'real back/forward cache restore' : 'synthetic pageshow: the cache did not engage here'})`, `flag ${s.flag}, cookies ${(await gaCookies(env.ctx)).join(',')}`);
    const hits = env.ga.collect.length;
    await A.evaluate(() => window.__gaStub && window.__gaStub.send('after_restore'));
    await sleep(200);
    ck(env.ga.collect.length === hits, 'and sends no hit afterwards');
    await env.close();
    await bf.close();
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('PROMINENCE: Decline and Accept are equals, and the bar is not a dialog', async () => {
    for (const [rel, vw, vh] of [['index.html', 390, 844], ['index.html', 1440, 900], ['sv.html', 390, 844], ['sv.html', 1440, 900]]) {
      const env = await armedContext(browser, { viewport: { width: vw, height: vh }, theme: 'light' });
      const page = await open(env.ctx, rel);
      const d = await page.evaluate(() => {
        const bar = document.getElementById('consent-bar');
        const bs = [...bar.querySelectorAll('button')];
        const sig = (b) => { const c = getComputedStyle(b); return ['fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'minHeight', 'height', 'borderTopWidth', 'borderTopStyle', 'borderRadius', 'backgroundColor', 'color', 'borderTopColor', 'textTransform', 'opacity', 'textDecorationLine'].map((k) => `${k}:${c[k]}`).join('|'); };
        const r = bs.map((b) => b.getBoundingClientRect());
        const stops = [];
        return {
          tags: bs.map((b) => b.tagName), classes: bs.map((b) => b.getAttribute('class')), sigs: bs.map(sig),
          w: r.map((x) => x.width), h: r.map((x) => x.height), top: r.map((x) => x.top), left: r.map((x) => x.left),
          order: bs.map((b) => b.getAttribute('data-consent-choice')),
          closeLike: [...bar.querySelectorAll('*')].filter((e) => /^[×xX✕✖]$/.test(e.textContent.trim()) || /close|dismiss|stäng/i.test((e.getAttribute('aria-label') || '') + ' ' + e.className)).length,
          role: bar.getAttribute('role'), modal: bar.getAttribute('aria-modal'), tabindex: bar.querySelectorAll('[tabindex]').length, headings: bar.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]').length,
          prev: bar.previousElementSibling && bar.previousElementSibling.className, idx: [...document.body.children].indexOf(bar), nosnippet: bar.hasAttribute('data-nosnippet'),
          tag: bar.tagName, active: document.activeElement === document.body, buttons: bs.length, stops,
        };
      });
      const tag = `${rel} ${vw}px`;
      ck(d.buttons === 2 && d.tags.every((t) => t === 'BUTTON') && d.order[0] === 'denied' && d.order[1] === 'granted', `${tag}: two <button> elements, Decline first, Accept second`, d.order.join(','));
      ck(d.classes[0] === d.classes[1], `${tag}: identical class attribute`, d.classes.join(' | '));
      ck(d.sigs[0] === d.sigs[1], `${tag}: identical computed font, padding, height, colours, border`, d.sigs[0] === d.sigs[1] ? '' : d.sigs.join(' !== '));
      const narrow = vw < 700;
      ck(Math.abs(d.h[0] - d.h[1]) <= 0.5 && (narrow ? Math.abs(d.w[0] - d.w[1]) <= 1 : d.w[0] / d.w[1] > 0.7 && d.w[0] / d.w[1] < 1.43), `${tag}: same height and ${narrow ? 'equal width' : 'comparable width'}`, `${d.w.map(Math.round)} x ${d.h.map(Math.round)}`);
      ck(Math.abs(d.top[0] - d.top[1]) <= 1 && d.left[0] < d.left[1], `${tag}: same row, Decline to the left of Accept`);
      ck(d.closeLike === 0 && d.headings === 0 && !d.role && !d.modal && d.tabindex === 0 && d.tag === 'SECTION', `${tag}: no close X, no heading, no role or aria-modal, no tabindex`, `close ${d.closeLike} role ${d.role} modal ${d.modal}`);
      ck(d.prev && d.prev.includes('skip-link') && d.idx === 1 && d.nosnippet, `${tag}: directly after .skip-link in the DOM, and data-nosnippet`, `prev "${d.prev}", index ${d.idx}`);
      ck(d.active, `${tag}: no focus at load`);
      // Tab order and no trap: skip link, then the bar (link, Decline, Accept), then the page.
      const order = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        order.push(await page.evaluate(() => { const a = document.activeElement; return (a.closest('#consent-bar') ? 'bar:' + (a.getAttribute('data-consent-choice') || 'link') : a.classList.contains('skip-link') ? 'skip' : a === document.body ? 'body' : 'page'); }));
      }
      ck(canon(order.slice(0, 5)) === canon(['skip', 'bar:link', 'bar:denied', 'bar:granted', 'page']), `${tag}: Tab goes skip link, bar link, Decline, Accept, then out into the page (no trap)`, order.join(' > '));
      await env.close();
    }
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('NO-JS: no bar, no Google, the footer link is a plain link to the notice', async () => {
    for (const rel of ['index.html', 'sv.html', 'privacy.html', 'integritet.html']) {
      const env = await armedContext(browser, { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
      const page = await open(env.ctx, rel);
      const r = await page.evaluate(() => {
        const a = document.querySelector('.site-footer [data-consent-open]');
        const box = a && a.getBoundingClientRect();
        const cs = a && getComputedStyle(a);
        const panel = document.querySelector('[data-consent-panel]');
        return {
          bar: document.querySelectorAll('.consent, #consent-bar, #consent-live').length, gtag: document.querySelectorAll('script[src*="googletagmanager"]').length,
          cls: document.documentElement.className,
          link: a ? { text: a.textContent.trim(), href: a.getAttribute('href'), visible: box.width > 0 && box.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden', tabindex: a.getAttribute('tabindex') } : null,
          panel: panel ? panel.children.length : null,
        };
      });
      const L = copy.en;
      ck(r.bar === 0 && r.gtag === 0 && !/js-consent|consent-open/.test(r.cls) && env.ga.google().length === 0 && env.ga.blocked.length === 0, `${rel} without JavaScript: no bar, no live region, no Google script, no request`, JSON.stringify(r));
      ck(r.link && r.link.visible && r.link.tabindex !== '-1' && r.link.href === L.noticeHref && r.link.text === L.footer, `${rel} without JavaScript: the footer link is visible, focusable and ends in ${L.noticeHref}`, JSON.stringify(r.link));
      ck(r.panel === null || r.panel === 0, `${rel} without JavaScript: the panel, if any, is empty`, `${r.panel}`);
      if (rel === 'index.html') {
        await page.click('.site-footer [data-consent-open]');
        await page.waitForURL(/#cookies$/);
        await page.waitForLoadState('load');
        const there = await page.evaluate(() => ({ url: location.pathname + location.hash, target: !!document.getElementById('cookies') }));
        ck(/privacy\.html#cookies$/.test(there.url) && there.target, 'clicking the link goes to the notice\'s #cookies section', there.url);
      }
      await env.close();
    }
  });

  await scenario('BLOCKED STORAGE: no bar, no error, no Google request; a failed save is not consent', async () => {
    for (const rel of ['index.html', 'sv.html', 'privacy.html']) {
      const env = await armedContext(browser, { init: [[() => {
        const block = { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } };
        Object.defineProperty(window, 'localStorage', block);
        Object.defineProperty(window, 'sessionStorage', block);
      }, null]] });
      const page = await open(env.ctx, rel);
      await sleep(300);
      const r = await page.evaluate(() => ({ bar: document.querySelectorAll('#consent-bar, .consent').length, cls: document.documentElement.className, panel: (document.querySelector('[data-consent-panel]') || { children: [] }).children.length }));
      ck(r.bar === 0 && r.panel === 0 && env.ga.google().length === 0 && env.ga.blocked.length === 0 && env.pageErrors.length === 0, `${rel} with storage blocked: no bar, no dead panel, no error, no request`, JSON.stringify(r) + env.pageErrors.join('|'));
      await page.click('.site-footer [data-consent-open]');
      await page.waitForURL(/#cookies$/);
      await page.waitForLoadState('load');
      const there = await page.evaluate(() => ({ url: location.pathname + location.hash, target: !!document.getElementById('cookies') }));
      ck(/(privacy|integritet)\.html#cookies$/.test(there.url) && there.target, `${rel} with storage blocked: the footer link still reaches the notice`, there.url);
      await env.close();
    }
    for (const [label, init] of [
      ['setItem throws', () => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k) { if (k === 'vynatix-consent') throw new DOMException('quota', 'QuotaExceededError'); return o.apply(this, arguments); }; }],
      ['setItem silently drops the write', () => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k) { if (k === 'vynatix-consent') return undefined; return o.apply(this, arguments); }; }],
    ]) {
      const env = await armedContext(browser, { init: [[init, null]] });
      const page = await open(env.ctx, 'index.html');
      await page.click(btn('granted'));
      await sleep(300);
      const s = await snap(page);
      ck(!s.bar && s.live === copy.en.saveFail && env.ga.google().length === 0 && s.scripts.length === 0 && s.ls === null, `an Accept that cannot be saved (${label}) loads nothing and says so`, `live "${s.live}", ls ${s.ls}`);
      rendered.push(['save failure', s.live]);
      await page.reload({ waitUntil: 'load' });
      ck((await snap(page)).bar && env.ga.google().length === 0, '... and the next visit asks again');
      await env.close();
    }
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('POISONED answers are undecided: no request, no injected node', async () => {
    const R = (n) => '9'.repeat(n);
    const bad = [
      ['an impossible date (2026-13-45)', 'v1:granted:2026-13-45'],
      ['2026-02-30', 'v1:granted:2026-02-30'],
      ['tomorrow', `v1:granted:${dAgo(-1)}`],
      ['a far future date', 'v1:granted:2999-12-31'],
      [`${maxDays + 1} days old`, `v1:granted:${dAgo(maxDays + 1)}`],
      ['version v2', `v2:granted:${today}`],
      ['upper case choice', `v1:GRANTED:${today}`],
      ['trailing newline', `v1:granted:${today}\n`],
      ['an HTML payload', '"><img src=x onerror=window.__xss=1>'],
      ['an HTML payload in the date', `v1:granted:<img src=x onerror=window.__xss=2>`],
      ['__proto__', '__proto__'],
      ['a huge value', `v1:granted:${R(1 << 20)}`],
    ];
    if (FULL) bad.push(
      ['month 13', 'v1:granted:2026-13-01'], ['month 00', 'v1:granted:2026-00-10'], ['day 32', 'v1:granted:2026-10-32'],
      ['2026-04-31', 'v1:granted:2026-04-31'], ['year 0026', 'v1:granted:0026-10-19'], ['upper case version', `V1:granted:${today}`],
      ['mixed case choice', `v1:Granted:${today}`], ['version v10', `v10:granted:${today}`], ['trailing CRLF', `v1:granted:${today}\r\n`],
      ['leading space', ` v1:granted:${today}`], ['trailing space', `v1:granted:${today} `], ['embedded NUL', `v1:granted:${today}\u0000`],
      ['unpadded date', 'v1:granted:2026-1-9'], ['compact date', 'v1:granted:20261019'], ['slashes', 'v1:granted:2026/10/19'],
      ['full-width digits', 'v1:granted:２０２６-10-19'], ['extra suffix', `v1:granted:${today}:x`], ['both choices', `v1:granted|denied:${today}`],
      ['bare granted', 'granted'], ['true', 'true'], ['1', '1'], ['JSON', '{"v":1,"c":"granted"}'], ['a script payload', '<script>alert(1)</script>'],
      ['constructor', 'constructor'], ['null as text', 'null'], ['empty string', ''], ['valid shape plus a 2 MB tail', `v1:granted:${today}${'a'.repeat(2 << 20)}`],
    );
    const good = [
      ['granted today', `v1:granted:${today}`, 'GRANTED'], ['denied today', `v1:denied:${today}`, 'DENIED'],
      [`granted exactly ${maxDays} days ago`, `v1:granted:${dAgo(maxDays)}`, 'GRANTED'], [`denied exactly ${maxDays} days ago`, `v1:denied:${dAgo(maxDays)}`, 'DENIED'],
    ];
    const cases = bad.map(([l, v]) => [l, v, 'UNDECIDED']).concat(good);
    const out = await pool(cases, 4, async ([label, value, want]) => {
      const env = await armedContext(browser, { init: [[(v) => { window.__xss = undefined; try { localStorage.setItem('vynatix-consent', v); } catch (e) { /* too large for this browser */ } }, value]] });
      const page = await open(env.ctx, 'index.html');
      await sleep(350);
      const s = await snap(page);
      const d = await page.evaluate(() => ({ img: !!document.querySelector('img[src="x"]'), xss: window.__xss, title: document.title }));
      const got = env.ga.gtag.length > 0 ? 'GRANTED' : s.bar ? 'UNDECIDED' : 'DENIED';
      const res = { label, want, got, hit: env.ga.google().length, node: d.img, xss: d.xss, errors: env.pageErrors.length + env.violations.length, off: env.ga.blocked.length };
      await env.close();
      return res;
    });
    for (const r of out) {
      const ok = r.got === r.want && (r.want !== 'UNDECIDED' || r.hit === 0) && !r.node && !r.xss && !r.errors && !r.off;
      ck(ok, `stored answer "${r.label}" is ${r.want.toLowerCase()}`, ok ? '' : `got ${r.got}, ${r.hit} Google request(s), node ${r.node}, xss ${r.xss}, errors ${r.errors}`);
    }
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('INPUT: Escape yields to the open menu; modified clicks fall through; only a click writes the answer', async () => {
    let env = await armedContext(browser, { viewport: { width: 375, height: 667 }, consent: 'denied' });
    let page = await open(env.ctx, 'index.html');
    await page.focus('[data-consent-open]');
    await page.keyboard.press('Enter');
    ck((await snap(page)).bar, 'Enter on the footer link reopens the bar');
    await page.click('.mobile-toggle');
    const navOpen = () => page.evaluate(() => document.querySelector('.site-header__nav').classList.contains('open'));
    ck(await navOpen(), 'the mobile menu is open');
    await page.focus(btn('denied'));
    await page.keyboard.press('Escape');
    ck(!(await navOpen()) && (await snap(page)).bar, 'Escape with the menu open closes the menu and leaves the bar');
    await page.focus(btn('denied'));
    await page.keyboard.press('Escape');
    const s = await snap(page);
    ck(!s.bar && s.active === 'a[open]', 'the next Escape closes the bar and returns focus to the footer link', `active ${s.active}`);
    await env.close();

    env = await armedContext(browser, { consent: 'denied' });
    page = await open(env.ctx, 'index.html');
    const rows = await page.evaluate(() => {
      const a = document.querySelector('[data-consent-open]');
      const rows = [];
      window.addEventListener('click', (ev) => { rows.push([ev.__label, ev.defaultPrevented]); ev.preventDefault(); }, false);
      [['plain', { button: 0 }], ['ctrl', { button: 0, ctrlKey: true }], ['meta', { button: 0, metaKey: true }], ['shift', { button: 0, shiftKey: true }], ['alt', { button: 0, altKey: true }], ['middle', { button: 1 }]].forEach(([label, init]) => {
        const ev = new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true }, init));
        ev.__label = label;
        a.dispatchEvent(ev);
        const bar = document.getElementById('consent-bar');
        rows[rows.length - 1].push(!!bar);
        if (bar) { bar.remove(); document.documentElement.classList.remove('consent-open'); }
      });
      return rows;
    });
    ck(rows[0][1] === true && rows[0][2] === true && rows.slice(1).every((r) => r[1] === false && r[2] === false), 'a plain click opens the bar; ctrl, meta, shift, alt and middle clicks fall through to the link', JSON.stringify(rows));
    await env.close();

    for (const seed of ['undecided', 'denied', 'granted']) {
      env = await armedContext(browser, { consent: seed, spy: true });
      page = await open(env.ctx, 'privacy.html');
      await sleep(300);
      await page.evaluate(() => {
        const fire = (t, ev) => t.dispatchEvent(ev);
        fire(document, new Event('visibilitychange'));
        fire(window, new PageTransitionEvent('pageshow', { persisted: true }));
        fire(window, new PageTransitionEvent('pagehide', { persisted: true }));
        fire(window, new StorageEvent('storage', { key: null }));
        fire(window, new StorageEvent('storage', { key: 'vynatix-consent', newValue: 'x' }));
        fire(document, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fire(document, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        (document.querySelector('.consent__text') || document.body).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await sleep(2500);                                    // past the one-second purge timer and the pagehide purge
      const writes = (await page.evaluate(() => window.__spy.storage)).filter((x) => x.includes(CONSENT_KEY) && /setItem|removeItem|clear/.test(x));
      ck(writes.length === 0, `${seed}: events other than a click on a choice never write the answer`, writes.join(','));
      await env.close();
    }
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('COOKIE DOMAINS: the purge reaches the parent domains and nothing else', async () => {
    const SYN = 'https://www.vynatix.test';
    const fmt = (cs) => cs.map((c) => `${c.name}@${c.domain}${c.path}`).sort();
    const plant = (ctx) => ctx.addCookies([
      { name: '_ga', value: '1', url: SYN + '/' },
      { name: '_ga', value: '2', domain: '.www.vynatix.test', path: '/', secure: true },
      { name: '_ga', value: '3', domain: '.vynatix.test', path: '/', secure: true },
      { name: '_ga_TEST000000', value: '3', domain: '.vynatix.test', path: '/', secure: true },
      { name: '_ga_OTHERID123', value: '3', domain: '.vynatix.test', path: '/', secure: true },
      { name: '_gid', value: 'x', domain: '.vynatix.test', path: '/' },
      { name: '_gat', value: 'x', domain: '.vynatix.test', path: '/' },
      { name: '_gcl_au', value: 'x', domain: '.vynatix.test', path: '/' },
      { name: '__ga', value: 'x', domain: '.vynatix.test', path: '/' },
      { name: '_gaX', value: 'x', domain: '.vynatix.test', path: '/' },
      { name: 'session', value: 'x', url: SYN + '/' },
      { name: '_ga', value: 'sibling', url: 'https://other.vynatix.test/' },
    ]);
    const gaNames = (list) => list.filter((c) => /^_ga(@|_)/.test(c));
    const survive = ['_gid@.vynatix.test/', '_gat@.vynatix.test/', '_gcl_au@.vynatix.test/', '__ga@.vynatix.test/', '_gaX@.vynatix.test/', 'session@www.vynatix.test/', '_ga@other.vynatix.test/'];
    let env = await armedContext(browser, { arm: { origins: [SYN], stub: { parentDomain: true } } });
    await plant(env.ctx);
    let page = await env.ctx.newPage();
    await page.goto(SYN + '/index.html', { waitUntil: 'load' });
    await sleep(400);
    let left = fmt(await env.ctx.cookies());
    ck(gaNames(left).filter((c) => !c.includes('other.')).length === 0, 'an undecided visit on www.vynatix.test deletes _ga and _ga_* for the host and each parent domain', gaNames(left).join(', '));
    ck(survive.every((c) => left.includes(c)), 'and leaves _gid, _gat, _gcl_au, __ga, _gaX, session and the sibling host alone', left.join(', '));
    await page.click(btn('granted'));
    const parentCookies = async () => (await env.ctx.cookies()).filter((c) => c.name === '_ga' && c.domain === '.vynatix.test' && c.value.startsWith('GA1.'));
    await until(async () => (await parentCookies()).length > 0, 3000);       // the stand-in's own cookie, not the planted ones
    const withDomain = (await parentCookies()).length;
    await page.click('[data-consent-open]');
    await page.click(btn('denied'));
    await sleep(2000);
    left = fmt(await env.ctx.cookies());
    if (!withDomain && process.env.ENGINE && process.env.ENGINE !== 'chromium') console.log(`note  ${process.env.ENGINE} stored no parent-domain cookie for the made-up host, so deleting one is not exercised here`);
    else ck(withDomain > 0 && gaNames(left).filter((c) => !c.includes('other.')).length === 0 && survive.every((c) => left.includes(c)), 'Accept then Decline removes the cookies gtag wrote for the parent domain too', `${withDomain} written, left ${left.join(', ')}`);
    await env.close();

    env = await armedContext(browser, { arm: { origins: [SYN], id: PLACEHOLDER_ID } });
    await plant(env.ctx);
    const before = fmt(await env.ctx.cookies());
    page = await env.ctx.newPage();
    await page.goto(SYN + '/index.html', { waitUntil: 'load' });
    await sleep(400);
    ck(canon(fmt(await env.ctx.cookies())) === canon(before), 'the inert module deletes no cookie at all');
    await env.close();
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('PURGE_ONLY: the emergency stop measures nothing, shows no bar, fills no panel and leaves nothing behind', async () => {
    // The module is run with PURGE_ONLY false for every other scenario, whatever the file ships (rewriteGaIdSource
    // normalises it), so this suite also passes in the exit state where the file ships true. What ships is
    // release-gate.js's to check; here the build with the stop on is made from the normalised one.
    ck((app.src.match(PURGE_DECL) || []).length === 1, 'app.js declares PURGE_ONLY on exactly one line (var PURGE_ONLY = true|false;)');
    const env = await armedContext(browser, { theme: 'light', consent: 'granted' });
    const base = rewriteGaIdSource(await (await env.ctx.request.get(BASE + 'app.js')).text(), TEST_ID);
    const purgeBody = normalisePurgeOnly(base, true);
    ck(/var PURGE_ONLY = false;/.test(base) && /var PURGE_ONLY = true;/.test(purgeBody) && !/var PURGE_ONLY = false;/.test(purgeBody), 'the harness can serve the module with PURGE_ONLY false (every normal run) and true (the stop)');
    let purge = false;                                      // the route serves either build, so one browser profile sees both
    await env.ctx.route((u) => u.pathname.endsWith('/app.js'), (r) =>
      r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', headers: { 'cache-control': 'no-store' }, body: purge ? purgeBody : base }));
    await env.ctx.addCookies([{ name: '_ga', value: 'x', url: BASE }, { name: '_ga_TEST000000', value: 'x', url: BASE }, { name: 'other', value: 'x', url: BASE }]);

    // A tab that accepted and is measuring when the stop is deployed elsewhere.
    const open1 = await open(env.ctx, 'index.html');
    await sleep(400);
    const before = await snap(open1);
    ck(before.ls && /granted/.test(before.ls) && env.ga.gtag.length === 1, 'baseline: with the normal build the granted tab loads gtag', `${before.ls} gtag ${env.ga.gtag.length}`);
    // Control for the panel check below: with the normal build the notice page's panel is filled.
    const ctl = await open(env.ctx, 'privacy.html');
    await sleep(400);
    const sc = await snap(ctl);
    ck(sc.panel && sc.panel.children > 0 && sc.panel.buttons === 2, 'control: with the normal build the panel on privacy.html is filled (status and two buttons)', JSON.stringify(sc.panel));
    await ctl.close();
    env.ga.reset();
    await env.ctx.addCookies([{ name: '_ga', value: 'x', url: BASE }, { name: '_ga_TEST000000', value: 'x', url: BASE }]);

    purge = true;                                           // the stop is deployed; another page of the same visitor loads
    const page = await open(env.ctx, 'sv.html');
    await sleep(500);
    const s = await snap(page);
    const names = (await allCookies(env.ctx)).map((n) => n.split('@')[0]).sort();
    ck(!s.bar && !s.htmlClass.includes('js-consent') && !s.live, 'purge mode: no bar, no js-consent class, no live region', JSON.stringify({ bar: s.bar, cls: s.htmlClass }));
    ck(s.ls === null || s.ls === undefined, 'purge mode removes the stored choice', String(s.ls));
    ck(!names.includes('_ga') && !names.includes('_ga_TEST000000') && names.includes('other'), 'purge mode deletes the _ga cookies and nothing else', names.join(', '));
    ck(s.flag === true && env.ga.google().length === 0, 'purge mode sets Google\'s off switch and requests nothing', `flag ${s.flag} google ${env.ga.google().length}`);
    ck(s.footerLink && s.footerLink.href.endsWith('privacy.html#cookies') && s.footerLink.text === 'Cookie settings', 'purge mode leaves the footer link as the plain English link (no relabel, no handler)', JSON.stringify(s.footerLink));
    // The notice page has the panel; in purge mode its buttons would be dead, so the panel must stay empty.
    const pp = await open(env.ctx, 'privacy.html');
    await sleep(500);
    const sp = await snap(pp);
    ck(sp.panel !== null && sp.panel.children === 0, 'purge mode fills no panel: [data-consent-panel] on privacy.html exists and has no child nodes', JSON.stringify(sp.panel));
    await pp.close();

    // The tab that was measuring hears the removal through the storage event and stops.
    await sleep(500);
    const old = await snap(open1);
    const oldNames = (await allCookies(env.ctx)).map((n) => n.split('@')[0]);
    ck(old.flag === true && !oldNames.includes('_ga'), 'the tab that was measuring revokes when the stop removes the choice', `flag ${old.flag} cookies ${oldNames.join(', ')}`);
    clean(env, 'purge');
    await env.close();
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('COPY: every state in English and Swedish follows the copy rules', async () => {
    for (const [rel, lang] of [['index.html', 'en'], ['sv.html', 'sv']]) {
      const L = copy[lang];
      const env = await armedContext(browser);
      const page = await open(env.ctx, rel);
      await page.click(btn('granted'));
      await sleep(200);
      rendered.push([`${rel} live on`, (await snap(page)).live]);
      await page.click('[data-consent-open]');
      let s = await snap(page);
      rendered.push([`${rel} reopened on`, s.status]);
      ck(s.status === L.on, `${rel}: the reopened bar says "${L.on}"`, `"${s.status}"`);
      await page.click(btn('denied'));
      s = await snap(page);
      rendered.push([`${rel} live off`, s.live]);
      ck(s.live === L.liveOff, `${rel}: Decline announces "${L.liveOff}" (not the other string)`, s.live);
      await page.click('[data-consent-open]');
      s = await snap(page);
      rendered.push([`${rel} reopened off`, s.status]);
      ck(s.status === L.off, `${rel}: the reopened bar says "${L.off}"`, `"${s.status}"`);
      await env.close();
    }
    const all = [];
    for (const lang of Object.keys(copy)) for (const [k, v] of Object.entries(copy[lang])) all.push([`COPY.${lang}.${k}`, String(v)]);
    for (const [where, t] of rendered) all.push([where, t]);
    const bad = all.filter(([, t]) => C.copyIssues(t).length).map(([w, t]) => `${w} "${t.slice(0, 40)}": ${C.copyIssues(t).join(', ')}`);
    ck(bad.length === 0, `${all.length} strings (COPY and every rendered state): no em dash, spaced en dash, exclamation mark or ellipsis`, bad.join(' | '));
    const must = [
      [copy.en.text, [/Google Analytics/, /cookie/i, /accept/i, /footer/i], 'English bar text names Google Analytics, cookies, the condition and where to change it'],
      [copy.sv.text, [/Google Analytics/, /cookie/i, /godk/i, /sidfot/i], 'Swedish bar text names Google Analytics, cookies, the condition and where to change it'],
    ];
    for (const [text, res, name] of must) ck(res.every((re) => re.test(text)), name, text);
    ck(/[åäö]/.test(Object.values(copy.sv).join('')), 'the Swedish strings use real å, ä and ö');
    console.log('note  sentence case is checked by inspection, not here');
  });

  // ---------------------------------------------------------------------------------------------
  await scenario('SNAPSHOT: the consent text only changes with a POLICY_VERSION decision', async () => {
    // The notice link in each language leads to that language's notice. Checked before the snapshot, because a wrong
    // link is not a wording change a re-taken snapshot should be able to wave through.
    for (const [lang, page] of Object.entries(NOTICE_PAGES)) {
      const href = copy[lang] && copy[lang].noticeHref;
      ck(typeof href === 'string' && href.split('#')[0] === page, `COPY.${lang}.noticeHref leads to the ${lang} notice, ${page}`, String(href));
    }
    const cur = C.consentDigest();
    const r = C.compareSnapshot(cur);
    ck(r.ok, 'the COPY strings and the #cookies section of each notice page equal the checked-in snapshot, or POLICY_VERSION moved', r.detail || '');
    if (r.note) console.log('note  ' + r.note);
    const missing = Object.entries(cur.sections).filter(([, v]) => !v).map(([k]) => k);
    ck(missing.length === 0, 'both notice pages have a #cookies section to snapshot', missing.join(', '));
  });

  await browser.close();
  const total = (Date.now() - t0) / 1000;
  console.log('\ntimings: ' + timings.map(([n, s]) => `${n.split(':')[0]} ${s.toFixed(0)}s`).join(', ') + `; total ${total.toFixed(0)}s`);
  if (synthetic.length) console.log(`note  synthetic fallback used (the real event did not happen here): ${synthetic.join(', ')}`);
  const problems = rep.problems;
  console.log(problems === 0 ? '\nPASS — the consent module is silent before a choice, honours Accept, Decline and withdrawal, and fails closed' + (synthetic.length ? ` (with a synthetic fallback for: ${synthetic.join(', ')})` : '')
                             : `\nFAIL — ${problems} problem(s)`);
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
