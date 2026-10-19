// The release gate: what must be true before GA_ID in app.js is set to a real Measurement ID and the branch is merged.
//   node verify/release-gate.js              npm run release-gate
//   node verify/release-gate.js --self-test  proves the gate fails for the right reason (no browser, no server)
//
// It is NOT part of `npm run check`, which has to pass on a branch that ships the module switched off. This is the
// reverse: it fails on the shipped placeholder, on a notice that still carries a [[CONFIRM ...]] marker, on a page that
// still says "no analytics", and so on. Each line is `ok` or `FAIL`, with the file it is about. Exit code 1 on any FAIL.
// The human gates a script cannot see are printed at the end as WARN lines for the owner to tick off by hand.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, PAGES, NOTICE_PAGES, TEST_ID, readApp, isActiveShape, readPage } = require('./_common');
const csp = require('./csp');
const C = require('./_consent');

const CHECKLIST = 'tools/PRE-FLIP-CHECKLIST.md';

// A phrase that makes a sentence a claim the site no longer makes true.
const TRIGGER = /no analytics|no google analytics|no consent banner|sets no cookies|no cookies|loads nothing from a third party/i;
// The same kind of claim in Swedish. integritet.html is new, so there is no history to take its stale sentences from;
// a match is a WARN to read by eye.
const TRIGGER_SV = /ingen analys|ingen statistik|inga cookies|ingen cookie|inget samtyckesbanner|ingen cookiebanner|laddar ingenting fr(å|a)n tredje part|sätter inga cookies/i;
// The stale sentences as they stood on origin/main, for a checkout without git history (and as a floor under the derived list).
const STALE_FIXED = [
  'No analytics, no cookies, no third-party content.',
  'This site collects no analytics, sets no cookies, and loads nothing from a third party.',
  'There is no analytics of any kind.',
  'No Google Analytics, no Plausible, no server-side page counting we control.',
  'There are no cookies.',
  'We set none, so there is no consent banner to click.',
  'The site sets none, so there is no consent banner to click.',
  'No analytics, cookies or tracking of any kind.',
];

const norm = (s) => String(s).toLowerCase().replace(/[“”"'`]/g, '').replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

// Text blocks of an HTML page (headings, paragraphs, items) plus the page's meta, Open Graph and JSON-LD descriptions.
function htmlTexts(html) {
  const out = [];
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  body.replace(/<\/(p|li|h[1-6]|tr|td|th|caption|div|table|ul|ol|section|header|footer|nav|main|a)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').forEach((l) => { if (l.trim()) out.push({ where: 'visible text', text: l.replace(/\s+/g, ' ').trim() }); });
  for (const m of html.matchAll(/<meta\s+(?:name|property)="((?:og:|twitter:)?description)"\s+content="([^"]*)"/gi)) out.push({ where: `meta ${m[1]}`, text: m[2].replace(/&amp;/g, '&') });
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) { if ((k === 'description' || k === 'text') && typeof v === 'string') out.push({ where: 'JSON-LD ' + k, text: v }); else walk(v); }
      };
      walk(JSON.parse(m[1]));
    } catch (e) { /* seo.js reports unparseable JSON-LD */ }
  }
  return out;
}
const sentences = (text) => text.split(/(?<=[.!?])\s+(?=[A-Z(])/).map((s) => s.trim()).filter(Boolean);
const claimsIn = (blocks) => {
  const out = [];
  for (const b of blocks) for (const s of sentences(b.text)) if (TRIGGER.test(s)) out.push(s);
  return out;
};

// Stale sentences: those of every committed version of a notice page from before the consent change (no consent panel),
// plus the fixed list. Returns { sentences: [normalised], source }.
function staleSentences(root = ROOT) {
  const set = new Set(STALE_FIXED.map(norm));
  let source = 'the fixed list (no git history available)';
  try {
    const run = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });
    let versions = 0;
    for (const [file, isOld] of [['privacy.html', (t) => !/data-consent-panel/.test(t)], ['SECURITY.md', (t) => !/consent/i.test(t)]]) {
      const revs = run('log', '--format=%H', '-n', '60', '--', file).split('\n').filter(Boolean);
      for (const rev of revs) {
        const text = run('show', `${rev}:${file}`);
        if (!isOld(text)) continue;
        versions++;
        const blocks = file.endsWith('.html') ? htmlTexts(text) : text.split('\n').map((l) => ({ text: l.replace(/[*_`#>-]+/g, ' ').replace(/\s+/g, ' ').trim() }));
        for (const s of claimsIn(blocks)) if (s.length >= 12) set.add(norm(s));
      }
    }
    if (versions) source = `git history (${versions} earlier versions of privacy.html and SECURITY.md) and the fixed list`;
  } catch (e) { /* not a git checkout */ }
  return { sentences: [...set], source };
}

// The draft banner of a notice page: its headline, or null when the page carries none. Matches the English and the
// Swedish wording, and any warning note (class banner--warning) on the page, so a reworded banner is not missed.
function draftBanner(html) {
  if (!html) return null;
  const note = /<div class="banner banner--warning"[^>]*>[\s\S]*?<b>([^<]*)<\/b>/i.exec(html);
  if (note) return note[1].trim().replace(/\.$/, '');
  const phrase = /(Draft pending legal review|Utkast i väntan på juridisk granskning)/i.exec(html);
  return phrase ? phrase[1] : null;
}

// Runs every check against a tree. overrides: { 'app.js': '...' } replaces a file's content (used by --self-test).
function runChecks({ root = ROOT, overrides = {} } = {}) {
  const results = [];
  const warns = [];
  const read = (rel) => (overrides[rel] !== undefined ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'));
  const tryRead = (rel) => { try { return read(rel); } catch (e) { return null; } };
  const add = (id, file, ok, name, detail, count) => results.push({ id, file, ok, name, detail: detail || '', count });

  // 1. The Measurement ID
  const app = readApp(root, overrides['app.js']);
  const shape = app.gaId === null ? `${app.gaLines} GA_ID lines` : /^G-X+$/.test(app.gaId) ? 'the placeholder' : app.gaId === TEST_ID ? 'the dummy test ID' : isActiveShape(app.gaId) ? `valid shape, ${app.gaId.length} characters` : 'not a GA4 ID';
  add('ga-id', 'app.js', app.gaLines === 1 && isActiveShape(app.gaId) && app.gaId !== TEST_ID, 'GA_ID is a valid Measurement ID and not the placeholder or the test ID', `now: ${shape}`);

  // 2. The notice pages carry the section and one empty panel; 3. no [[CONFIRM marker left
  const pages = {};
  for (const lang of Object.keys(NOTICE_PAGES)) {
    const rel = NOTICE_PAGES[lang];
    const html = tryRead(rel);
    pages[rel] = html;
    if (html === null) { add('notice-' + rel, rel, false, 'exists with id="cookies" and one empty data-consent-panel', 'file missing'); add('confirm-' + rel, rel, false, 'carries no [[CONFIRM marker', 'file missing'); continue; }
    const panels = (html.match(/data-consent-panel/g) || []).length;
    const empty = (html.match(/<div\b[^>]*data-consent-panel[^>]*>\s*<\/div>/g) || []).length;
    add('notice-' + rel, rel, /\bid="cookies"/.test(html) && panels === 1 && empty === 1, 'has id="cookies" and exactly one empty data-consent-panel', `id=${/\bid="cookies"/.test(html)}, panels ${panels}, empty ${empty}`);
    const marks = [...html.matchAll(/\[\[CONFIRM[^\]]*\]\]/g)].map((m) => m[0].replace(/\[\[CONFIRM:?\s*/, '').replace(/\]\]$/, ''));
    add('confirm-' + rel, rel, marks.length === 0, 'carries no [[CONFIRM marker', marks.length ? `${marks.length} open: ${marks.map((m) => m.slice(0, 60)).join(' | ')}` : '');
  }

  // 4. No stale "no analytics" claim anywhere a visitor, crawler or AI engine reads it
  const stale = staleSentences(root);
  const staleNorm = stale.sentences;
  const hay = [];
  for (const rel of PAGES) {
    const html = rel in pages ? pages[rel] : tryRead(rel);
    if (html === null) continue;
    const blocks = htmlTexts(html);
    const keep = Object.values(NOTICE_PAGES).includes(rel) ? blocks : blocks.filter((b) => b.where !== 'visible text');
    keep.forEach((b) => hay.push({ file: rel, where: b.where, text: b.text }));
  }
  for (const rel of ['SECURITY.md', 'llms.txt']) {
    const t = tryRead(rel);
    if (t !== null) t.split('\n').forEach((l) => hay.push({ file: rel, where: 'text', text: l.replace(/[*_`#>]+/g, ' ').replace(/\s+/g, ' ').trim() }));
  }
  const staleHits = [];
  const loose = [];
  for (const h of hay) {
    const n = norm(h.text);
    const hit = staleNorm.find((s) => n.includes(s));
    if (hit) staleHits.push(`${h.file} (${h.where}): "${hit.slice(0, 70)}"`);
    else for (const s of sentences(h.text)) if (TRIGGER.test(s) || TRIGGER_SV.test(s)) loose.push(`${h.file} (${h.where}): "${s.slice(0, 90)}"`);
  }
  add('stale', 'privacy.html, integritet.html, SECURITY.md, llms.txt, every page meta, og and JSON-LD description', staleHits.length === 0,
    'no sentence the site used to say about having no analytics or cookies', staleHits.length ? `${staleHits.length}: ${staleHits.slice(0, 4).join(' | ')}${staleHits.length > 4 ? ' ...' : ''}` : `checked against ${staleNorm.length} stale sentences from ${stale.source}`, staleHits.length);
  for (const l of [...new Set(loose)].slice(0, 12)) warns.push(`read by eye, this sentence still says "no analytics" or "no cookies" in some form: ${l}`);

  // 5. The footer link on every page
  const noLink = [];
  for (const rel of PAGES) {
    const html = rel in pages ? pages[rel] : tryRead(rel);
    if (html === null) { noLink.push(rel + ' (missing)'); continue; }
    const footer = (/<footer[\s\S]*<\/footer>/i.exec(html) || [''])[0];
    if (!/<a\b[^>]*\bdata-consent-open\b[^>]*>/.test(footer) || !/<a\b[^>]*href="privacy\.html#cookies"[^>]*data-consent-open|<a\b[^>]*data-consent-open[^>]*href="privacy\.html#cookies"/.test(footer)) noLink.push(rel);
  }
  add('footer', 'every page in PAGES', noLink.length === 0, 'the footer carries the Cookie settings link (data-consent-open, href privacy.html#cookies)', noLink.length ? `missing on ${noLink.length}: ${noLink.slice(0, 5).join(', ')}` : '');

  // 6. The CSP, identical everywhere and equal to EDGE-SETUP.md
  let cspResults = [];
  try { cspResults = csp.run(root, PAGES); } catch (e) { cspResults = [{ ok: false, name: 'csp.js ran', detail: e.message }]; }
  const cspBad = cspResults.filter((r) => !r.ok);
  add('csp', 'every page, EDGE-SETUP.md', cspBad.length === 0, 'the Content-Security-Policy is identical on every page and equals EDGE-SETUP.md minus frame-ancestors (verify/csp.js)',
    cspBad.length ? cspBad.map((r) => r.name).slice(0, 3).join(' | ') + (cspBad.length > 3 ? ` (+${cspBad.length - 3}; run node verify/csp.js)` : '') : '');

  // 7. The accessibility statement
  const acc = tryRead('accessibility.html');
  add('a11y-statement', 'accessibility.html', acc !== null && /consent bar/i.test(acc), 'mentions the consent bar', acc === null ? 'file missing' : '');

  // 8. The checklist
  const listPath = path.join(root, CHECKLIST);
  add('checklist', CHECKLIST, fs.existsSync(listPath), 'exists', fs.existsSync(listPath) ? '' : `write ${CHECKLIST} from the pre-flip checklist (GA4 design brief, section 6)`);

  // 9. The consent-text snapshot matches what is on the pages
  try {
    const snap = C.compareSnapshot(C.consentDigest(root));
    add('snapshot', 'tools/verify/consent-copy.snapshot.json', snap.ok && !snap.note, 'matches the consent text on the pages (run node verify/consent.js --update after the final wording)', snap.detail || snap.note || '');
  } catch (e) { add('snapshot', 'tools/verify/consent-copy.snapshot.json', false, 'matches the consent text on the pages', e.message); }

  // The Draft banner is not a failure, it is a decision for counsel. It is the warning note near the top of each
  // notice page, in the page's own language ("Draft pending legal review", "Utkast i väntan på juridisk granskning").
  for (const rel of Object.values(NOTICE_PAGES)) {
    const banner = draftBanner(pages[rel]);
    if (banner) warns.push(`${rel}: the draft banner ("${banner}") is still present; remove it only on counsel's written sign-off`);
  }
  return { results, warns };
}

// Gates only a person can pass.
const HUMAN_GATES = [
  "Counsel has reviewed and signed off the privacy notice and the Swedish notice, and the sign-off is dated in " + CHECKLIST + ".",
  "Google terms: the Analytics property belongs to Vynatix, the data processing terms are accepted and a copy is kept; the contracting entity named in the notice is the one shown in the account.",
  "Data Privacy Framework: the Google contracting entity's listing, and the state of the Latombe appeal, were checked on dataprivacyframework.gov and the check is dated.",
  "Real-ID test in three browsers, by hand: Chromium, Firefox and WebKit each ran accept, decline and a ten-second wait with the real property ID, with a securitypolicyviolation listener on and the GA DebugView or Realtime report open, and the cookie names, domain and lifetimes in the notice are the ones observed. (npm run consent-live is the rehearsal with the dummy ID G-TEST000000; it refuses any other ID, so it cannot stand in for this.)",
  "GA property settings are evidenced: data retention 2 months, Google Signals off, ad personalisation off, outbound clicks and downloads off, internal traffic excluded.",
  "Records exist: the Article 30 entry and the written DPIA screening.",
  "A keyboard-only walk and a screen-reader pass (VoiceOver or NVDA) of the bar, the reopen and the announcements, in the three browsers.",
];

function printReport({ results, warns }) {
  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file}: ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  warns.forEach((w) => console.log(`WARN ${w}`));
  console.log('\nGates this script cannot check. Tick each off by hand before the real ID goes in:');
  HUMAN_GATES.forEach((g, i) => console.log(`WARN ${i + 1}. ${g}`));
  console.log(bad === 0 ? '\nPASS — every scripted release gate holds (the WARN lines above are still yours)'
                        : `\nFAIL — ${bad} release gate(s) not met; do not set GA_ID`);
  return bad;
}

// Proves the gate refuses for the right reason, whatever state the tree is in.
function selfTest() {
  const app = readApp();
  const withId = (id) => app.src.replace(/var GA_ID = '[^']*';/, `var GA_ID = '${id}';`);
  const gaOk = (src) => runChecks({ overrides: { 'app.js': src } }).results.find((r) => r.id === 'ga-id').ok;
  let bad = 0;
  const t = (ok, name) => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} self-test: ${name}`); };
  t(gaOk(withId('G-XXXXXXXXXX')) === false, 'the inert placeholder fails the GA_ID gate');
  t(gaOk(withId('G-XXXXXX')) === false, 'a placeholder-shaped ID fails');
  t(gaOk(withId('G-TEST000000')) === false, 'the dummy test ID fails (it must never ship)');
  t(gaOk(withId('g-abcdef1234')) === false, 'a malformed ID fails');
  t(gaOk(withId('G-ABCDEF1234')) === true, 'a valid-shaped ID passes');
  t(gaOk(app.src + "\nvar GA_ID = 'G-ABCDEF1234';") === false, 'two GA_ID lines fail');
  // The placeholder is the only reason the GA_ID gate fails here: nothing else changes with the ID.
  const before = runChecks({ overrides: { 'app.js': withId('G-ABCDEF1234') } }).results.filter((r) => r.id !== 'ga-id').map((r) => `${r.id}:${r.ok}`).join();
  const after = runChecks({ overrides: { 'app.js': withId('G-XXXXXXXXXX') } }).results.filter((r) => r.id !== 'ga-id').map((r) => `${r.id}:${r.ok}`).join();
  t(before === after, 'swapping the ID changes the GA_ID gate and no other gate');
  // The stale-claim gate: the old sentence fails, the honest change note passes.
  const priv = readPage('privacy.html');
  const add = (s) => priv.replace('<h2 id="storage">', `<p>${s}</p>\n<h2 id="storage">`);
  const staleOf = (html) => runChecks({ overrides: { 'privacy.html': html } }).results.find((r) => r.id === 'stale').count;
  const base = staleOf(priv);                  // the tree may already carry stale text elsewhere; compare against it
  t(staleOf(add('This site collects no analytics, sets no cookies, and loads nothing from a third party.')) > base, 'the old sentence "collects no analytics, sets no cookies" adds a stale-claim hit');
  t(staleOf(add('There are <strong>no cookies</strong>. We set none, so there is no consent banner to click.')) > base, 'the old "no cookies ... no consent banner" sentences add a hit');
  t(staleOf(add('Before then the site used no analytics and set no cookies.')) === base, 'an honest history sentence ("Before then the site used no analytics") adds none');
  // The draft-banner warning is shown for each language's wording, and not shown when the banner is gone.
  const bannerWarns = (o) => runChecks({ overrides: o }).warns.filter((w) => /draft banner/.test(w)).map((w) => w.split(':')[0]);
  const sv = '<main><div class="banner banner--warning" role="note"><b>Utkast i väntan på juridisk granskning.</b> text</div><h2 id="cookies">x</h2></main>';
  const en = '<main><div class="banner banner--warning" role="note"><b>Draft pending legal review.</b> text</div><h2 id="cookies">x</h2></main>';
  const none = '<main><h2 id="cookies">x</h2></main>';
  t(bannerWarns({ 'privacy.html': en, 'integritet.html': sv }).join() === 'privacy.html,integritet.html', 'both the English and the Swedish draft banner raise a WARN');
  t(bannerWarns({ 'privacy.html': none, 'integritet.html': sv }).join() === 'integritet.html', 'the Swedish banner alone raises its own WARN (not an all-clear)');
  t(bannerWarns({ 'privacy.html': none, 'integritet.html': none }).length === 0, 'no WARN once both banners are gone');
  console.log(bad === 0 ? '\nPASS — the release gate fails for the right reasons' : `\nFAIL — ${bad} self-test(s) wrong`);
  return bad;
}

module.exports = { runChecks, staleSentences, selfTest, HUMAN_GATES };

if (require.main === module) {
  if (process.argv.includes('--self-test')) process.exit(selfTest() === 0 ? 0 : 1);
  const report = runChecks();
  process.exit(printReport(report) === 0 ? 0 : 1);
}

