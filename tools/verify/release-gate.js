// The release gate: what must be true before GA_ID in app.js is set to a real Measurement ID and the branch is merged.
//   node verify/release-gate.js              npm run release-gate
//   node verify/release-gate.js --self-test  proves the gate fails for the right reason (no browser, no server)
//
// `npm run check` runs only the --self-test: the check has to pass on a branch that ships the module switched off,
// and the gate is the reverse. It FAILS (exit 1) while the placeholder is in place, and on every other open item a
// script can see: a [[CONFIRM ...]] marker, a draft banner (and a marker on a page that has lost its banner), an
// unticked box in sections 1 to 9 of tools/PRE-FLIP-CHECKLIST.md or a blank fill-in field in its header or sign-off
// block, PURGE_ONLY not false, a policy constant that is not 365 days, a notice that does not say 12 months /
// 12 månader or does not name the three storage keys, a notice date that is not the `mod` in tools/seo-head.py or is
// older than 14 days, a stale "no analytics" sentence, a missing footer link, a CSP that differs, a snapshot that is
// not current. Each line is `ok` or `FAIL`, with the file it is about.
//
// It exits 0 only when every scripted gate holds, and then it does NOT print a bare PASS: it prints
// `scripted gates pass, N human gates open`, because the gates a script cannot see (counsel, Google's terms, the
// real-ID run, the keyboard and screen reader passes) are printed above it and are still the owner's.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  ROOT, PAGES, NOTICE_PAGES, TEST_ID, THEME_KEY, LOOK_KEY, readApp, isActiveShape, readPage, purgeOnlyState, normalisePurgeOnly,
  stripJsComments, todayUtc,
} = require('./_common');
const csp = require('./csp');
const pub = require('./publish');
const C = require('./_consent');

const CHECKLIST = 'tools/PRE-FLIP-CHECKLIST.md';
const SEO_HEAD = 'tools/seo-head.py';
const SNAPSHOT_REL = 'tools/verify/consent-copy.snapshot.json';
const MAX_NOTICE_AGE_DAYS = 14;                       // a notice date older than this is stale at the flip
const COOKIE_MAX_AGE_WANT = 31536000;                 // 365 days in seconds: the "12 months" the notices say
const CONSENT_MAX_DAYS_WANT = 365;
const LIFETIME_WORDS = { en: '12 months', sv: '12 månader' };

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

// Sentences that match TRIGGER or TRIGGER_SV and are true: they describe what the site does now (nothing before a
// choice, an honest note on the past). Read once by eye, then listed here per file so that a NEW sentence of this kind
// stands out as the only WARN. Exact sentences (compared in lower case, quotes and spacing ignored), so a reworded
// one is a WARN again. The count of suppressed sentences is printed.
const READ_BY_EYE_OK = {
  'privacy.html': [
    'Until you choose, and if you decline, nothing is sent to Google and no analytics cookies are set.',
    'No cookies are set until you accept analytics.',
    'If you decline, or never choose, nothing is sent to Google and no analytics cookie is set.',
    'Before that the site used no analytics and set no cookies.',
  ],
  'integritet.html': [
    'Innan ni har valt, och om ni avböjer, skickas ingenting till Google och inga cookies för statistik sätts.',
    'Inga cookies sätts förrän ni godkänner statistik.',
    'Om ni avböjer, eller aldrig väljer, skickas ingenting till Google och ingen cookie för statistik sätts.',
    'Dessförinnan fanns meddelandet bara på engelska, och webbplatsen använde ingen statistik och satte inga cookies.',
  ],
};
const MAX_WARN_LINES = 12;

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
// plus the fixed list. Returns { sentences: [normalised], source, fixed, history }. Memoised per root: the self-test asks often.
const staleCache = new Map();
function staleSentences(root = ROOT) {
  if (staleCache.has(root)) return staleCache.get(root);
  const fixed = new Set(STALE_FIXED.map(norm));
  const set = new Set(fixed);
  let source = 'no git history available';
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
    if (versions) source = `${versions} earlier versions of privacy.html and SECURITY.md in git history`;
  } catch (e) { /* not a git checkout */ }
  const res = { sentences: [...set], source, fixed: fixed.size, history: set.size - fixed.size, git: source !== 'no git history available' };
  staleCache.set(root, res);
  return res;
}

// The draft banner of a notice page: its headline, or null when the page carries none. Matches the English and the
// Swedish wording, and any warning note (class banner--warning) on the page, so a reworded banner is not missed.
function draftBanner(html) {
  if (!html) return null;
  const note = /<div class="[^"]*\bbanner--warning\b[^"]*"[^>]*>/i.exec(html);
  if (note) {
    const head = /<b>([^<]*)<\/b>/.exec(html.slice(note.index, note.index + 1500));
    return (head ? head[1] : 'a warning note').trim().replace(/\.$/, '');
  }
  const phrase = /(Draft pending legal review|Utkast i väntan på juridisk granskning)/i.exec(html);
  return phrase ? phrase[1] : null;
}

// The [[CONFIRM markers of a page, matched loosely (spacing, case, a stray ] inside): [{ text }].
function confirmMarkers(html) {
  if (!html) return [];
  const out = [];
  for (const m of html.matchAll(/\[\[\s*CONFIRM/gi)) {
    const rest = html.slice(m.index + m[0].length);
    const end = rest.search(/\]\]|<|\n/);
    out.push({ text: rest.slice(0, end < 0 ? 60 : end).replace(/^[:\s]+/, '').replace(/\s+/g, ' ').slice(0, 60) });
  }
  return out;
}

// --- the checklist (T2) -----------------------------------------------------------------------------------------
// Sections 1 to 9 are gated: an unticked `- [ ]` box fails. Sections 10 and 11 (the exit runbook and the quarterly
// review) are meant to stay unticked and half blank, and are not read. The fill-in fields are the blanks (______) in
// everything before section 1 (the header block) and in the Sign-off block at the end.
function parseChecklist(text) {
  const lines = String(text).split('\n');
  const info = { sections: new Set(), unticked: [], ticked: 0, headerBlanks: 0, signoffBlanks: 0, signoff: false };
  let where = 'header';
  let last = '';
  for (const line of lines) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      const num = /^(\d+)\./.exec(h[1]);
      if (num) { where = +num[1]; info.sections.add(+num[1]); last = ''; }
      else if (/^sign-?off\b/i.test(h[1])) { where = 'signoff'; info.signoff = true; }
      else if (where === 'signoff') where = 'after';
      else if (typeof where === 'number') where = 'other';
      continue;
    }
    if (where === 'header') { info.headerBlanks += (line.match(/_{3,}/g) || []).length; continue; }
    if (where === 'signoff') { info.signoffBlanks += (line.match(/_{3,}/g) || []).length; continue; }
    if (typeof where === 'number' && where >= 1 && where <= 9) {
      const box = /^\s*[-*+]\s+\[( |x|X)\]\s*(?:\*\*)?\s*(\d+\.\d+)?/.exec(line);
      if (box) {
        if (box[2]) last = box[2];
        if (box[1] === ' ') info.unticked.push(box[2] || `${last || 'section ' + where} (item)`); else info.ticked++;
      }
    }
  }
  return info;
}

// --- dates (T4) -------------------------------------------------------------------------------------------------
const MONTHS = {
  en: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  sv: ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'],
};
const pad = (n) => String(n).padStart(2, '0');
// "Last updated 19 October 2026" / "Senast uppdaterad 19 oktober 2026" -> "2026-10-19", or null.
function visibleDate(html, lang) {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const m = /(?:Last updated|Senast uppdaterad)\s+(\d{1,2})\s+([A-Za-zåäöÅÄÖ]+)\s+(\d{4})/i.exec(text);
  if (!m) return null;
  const mi = MONTHS[lang].indexOf(m[2].toLowerCase());
  return mi < 0 ? null : `${m[3]}-${pad(mi + 1)}-${pad(+m[1])}`;
}
const formatDate = (iso, lang) => `${+iso.slice(8, 10)} ${lang === 'sv' ? MONTHS.sv[+iso.slice(5, 7) - 1] : MONTHS.en[+iso.slice(5, 7) - 1].replace(/^./, (c) => c.toUpperCase())} ${iso.slice(0, 4)}`;
// The `mod` of a page in the PAGES registry of tools/seo-head.py (read as text; Python is not run).
const registryEntry = (py, page) => new RegExp('([\'"]' + page.replace(/\./g, '\\.') + '[\'"]\\s*:\\s*dict\\()([^)]*)(\\))').exec(py || '');
function modOf(py, page) {
  const e = registryEntry(py, page);
  const m = e ? /\bmod\s*=\s*['"](\d{4}-\d{2}-\d{2})['"]/.exec(e[2]) : null;
  return m ? m[1] : null;
}
const dayNum = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;

// Runs every check against a tree. overrides: { 'app.js': '...' } replaces a file's content (used by --self-test);
// today: 'YYYY-MM-DD' replaces the clock for the date rule.
function runChecks({ root = ROOT, overrides = {}, today = todayUtc() } = {}) {
  const results = [];
  const warns = [];
  const notes = [];
  const read = (rel) => (overrides[rel] !== undefined ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'));
  const tryRead = (rel) => { try { return read(rel); } catch (e) { return null; } };
  const add = (id, file, ok, name, detail, count) => results.push({ id, file, ok, name, detail: detail || '', count });

  // 1. The Measurement ID
  const app = readApp(root, overrides['app.js']);
  const shape = app.gaId === null ? `${app.gaLines} GA_ID lines` : /^G-X+$/.test(app.gaId) ? 'the placeholder' : app.gaId === TEST_ID ? 'the dummy test ID' : isActiveShape(app.gaId) ? `valid shape, ${app.gaId.length} characters` : 'not a GA4 ID';
  add('ga-id', 'app.js', app.gaLines === 1 && isActiveShape(app.gaId) && app.gaId !== TEST_ID, 'GA_ID is a valid Measurement ID and not the placeholder or the test ID', `now: ${shape}`);

  // 1b. The exit switch and the policy constants (T3)
  const purge = purgeOnlyState(app.src);
  const purgeNow = (/^[ \t]*var PURGE_ONLY = (true|false);/m.exec(app.src) || [])[1];
  add('purge-only', 'app.js', purge.assignments === 1 && purge.falseDecls === 1, 'PURGE_ONLY is false (exactly one "var PURGE_ONLY = false;"; true is the emergency stop, a re-flip sets it back)',
    purge.assignments === 1 && purge.falseDecls === 1 ? '' : `now: ${purge.assignments} assignment(s), PURGE_ONLY ${purgeNow || 'not declared'}`);
  const code = stripJsComments(app.src);
  const constOf = (name) => { const all = [...code.matchAll(new RegExp('var ' + name + ' = (\\d+);', 'g'))]; return all.length === 1 ? Number(all[0][1]) : null; };
  const maxAge = constOf('COOKIE_MAX_AGE'), maxDays = constOf('CONSENT_MAX_DAYS');
  add('policy-constants', 'app.js', maxAge === COOKIE_MAX_AGE_WANT && maxDays === CONSENT_MAX_DAYS_WANT,
    `COOKIE_MAX_AGE is ${COOKIE_MAX_AGE_WANT} (365 days in seconds) and CONSENT_MAX_DAYS is ${CONSENT_MAX_DAYS_WANT}: the "12 months" both notices say`,
    maxAge === COOKIE_MAX_AGE_WANT && maxDays === CONSENT_MAX_DAYS_WANT ? '' : `now: COOKIE_MAX_AGE ${maxAge === null ? 'not found once' : maxAge}, CONSENT_MAX_DAYS ${maxDays === null ? 'not found once' : maxDays}`);

  // 2. The notice pages: the section and one empty panel; 3. banner and markers; 4. lifetime words and storage keys; 5. dates
  const py = tryRead(SEO_HEAD);
  const sitemap = tryRead('sitemap.xml');
  const pages = {};
  const keys = [app.consentKey, THEME_KEY, LOOK_KEY];
  for (const lang of Object.keys(NOTICE_PAGES)) {
    const rel = NOTICE_PAGES[lang];
    const html = tryRead(rel);
    pages[rel] = html;
    if (html === null) {
      for (const id of ['notice', 'banner', 'confirm', 'marker-banner', 'lifetime', 'keys', 'dates', 'dates-generated']) add(`${id}-${rel}`, rel, false, `${id} check`, 'file missing');
      continue;
    }
    const panels = (html.match(/data-consent-panel/g) || []).length;
    const empty = (html.match(/<div\b[^>]*data-consent-panel[^>]*>\s*<\/div>/g) || []).length;
    add('notice-' + rel, rel, /\bid="cookies"/.test(html) && panels === 1 && empty === 1, 'has id="cookies" and exactly one empty data-consent-panel', `id=${/\bid="cookies"/.test(html)}, panels ${panels}, empty ${empty}`);

    const banner = draftBanner(html);
    const marks = confirmMarkers(html);
    add('banner-' + rel, rel, !banner, 'carries no draft banner',
      banner ? `still present ("${banner}"); it comes off only on counsel's written sign-off (checklist 5.2)` : '');
    add('confirm-' + rel, rel, marks.length === 0, 'carries no [[CONFIRM marker', marks.length ? `${marks.length} open: ${marks.map((m) => m.text).join(' | ')}` : '');
    add('marker-banner-' + rel, rel, !(marks.length && !banner), 'a [[CONFIRM marker is never left on a page that no longer has its draft banner',
      marks.length && !banner ? `${marks.length} marker(s) and no banner: the banner was removed before the markers were resolved` : '');

    const words = LIFETIME_WORDS[lang];
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    add('lifetime-' + rel, rel, text.includes(words), `says "${words}" (the cookie and answer lifetime, 365 days in app.js)`, text.includes(words) ? '' : `no "${words}" in the visible text`);
    const lost = app.consentKey ? pub.storageKeyProblems(html, keys) : ['CONSENT_KEY (not found in app.js)'];
    add('keys-' + rel, rel, lost.length === 0, `names the three storage keys in <code> (${keys.join(', ')})`, lost.length ? `missing: ${lost.join(', ')}` : '');

    // dates (T4)
    const seen = visibleDate(html, lang);
    const mod = modOf(py, rel);
    const age = seen && mod ? dayNum(today) - dayNum(mod) : null;
    const flipStep = 'follow the checklist flip-day step (9.2): set the visible "Last updated" line to the flip day, set mod for the page in tools/seo-head.py to the same day, run python3 tools/seo-head.py';
    let why = '';
    if (!seen) why = `no parseable "${lang === 'sv' ? 'Senast uppdaterad' : 'Last updated'} D month YYYY" line`;
    else if (!mod) why = `no mod date for ${rel} in the PAGES registry of ${SEO_HEAD}`;
    else if (seen !== mod) why = `the visible date is ${seen} but mod is ${mod}`;
    else if (age < 0) why = `the date ${mod} is in the future (today is ${today})`;
    else if (age > MAX_NOTICE_AGE_DAYS) why = `the date ${mod} is ${age} days old (today is ${today}; at most ${MAX_NOTICE_AGE_DAYS})`;
    add('dates-' + rel, rel, !why, `the visible date equals mod in ${SEO_HEAD} and is at most ${MAX_NOTICE_AGE_DAYS} days old`, why ? `${why}. ${flipStep[0].toUpperCase()}${flipStep.slice(1)}` : `${seen}`);
    // The generated copies of mod: seo-head.py writes them, so a mod moved without running it shows here.
    let gen = '';
    if (mod) {
      const meta = /<meta\s+property="article:modified_time"\s+content="([^"]*)"/i.exec(html);
      const lastmod = sitemap ? new RegExp('<loc>https://vynatix\\.com/' + rel.replace(/\./g, '\\.') + '</loc>(?:(?!</url>)[\\s\\S])*?<lastmod>([^<]*)</lastmod>').exec(sitemap) : null;
      if (!meta || meta[1] !== mod) gen += `article:modified_time is ${meta ? meta[1] : 'missing'}; `;
      if (!lastmod || lastmod[1] !== mod) gen += `sitemap lastmod is ${lastmod ? lastmod[1] : 'missing'}; `;
    }
    add('dates-generated-' + rel, rel, mod !== null && !gen, 'article:modified_time and the sitemap lastmod equal mod (the generated copies)', mod === null ? 'no mod to compare with' : gen ? `${gen}run python3 tools/seo-head.py` : '');
  }

  // 6. No stale "no analytics" claim anywhere a visitor, crawler or AI engine reads it
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
    else for (const s of sentences(h.text)) if (TRIGGER.test(s) || TRIGGER_SV.test(s)) loose.push({ file: h.file, where: h.where, s });
  }
  add('stale', 'privacy.html, integritet.html, SECURITY.md, llms.txt, every page meta, og and JSON-LD description', staleHits.length === 0,
    'no sentence the site used to say about having no analytics or cookies', staleHits.length ? `${staleHits.length}: ${staleHits.slice(0, 4).join(' | ')}${staleHits.length > 4 ? ' ...' : ''}` : `checked against ${staleNorm.length} stale sentences (${stale.fixed} in the fixed list${stale.git ? `, ${stale.history} added from ${stale.source}` : `; ${stale.source}`})`, staleHits.length);
  // Sentences that still mention "no analytics" or "no cookies": the ones read and listed in READ_BY_EYE_OK are counted, the rest are WARN lines.
  const seenLoose = new Set();
  let suppressed = 0;
  const fresh = [];
  for (const l of loose) {
    const key = `${l.file}|${l.where}|${norm(l.s)}`;
    if (seenLoose.has(key)) continue;
    seenLoose.add(key);
    if ((READ_BY_EYE_OK[l.file] || []).some((ok) => norm(ok) === norm(l.s))) { suppressed++; continue; }
    fresh.push(`read by eye, this sentence still says "no analytics" or "no cookies" in some form: ${l.file} (${l.where}): "${l.s.slice(0, 90)}"`);
  }
  fresh.slice(0, MAX_WARN_LINES).forEach((w) => warns.push(w));
  if (fresh.length > MAX_WARN_LINES) warns.push(`${fresh.length - MAX_WARN_LINES} more read-by-eye sentence(s) not shown (the list stops at ${MAX_WARN_LINES}); fix the first ones and run the gate again`);
  if (suppressed) notes.push(`${suppressed} read-by-eye sentence(s) matched READ_BY_EYE_OK in tools/verify/release-gate.js (read once, true today) and are not printed`);

  // 7. The footer link on every page (the same test as verify/publish.js)
  const noLink = [];
  for (const rel of PAGES) {
    const html = rel in pages ? pages[rel] : tryRead(rel);
    if (html === null) { noLink.push(rel + ' (missing)'); continue; }
    if (pub.footerLinkProblems(html).length) noLink.push(rel);
  }
  add('footer', 'every page in PAGES', noLink.length === 0, 'the footer carries the Cookie settings link (data-consent-open, href privacy.html#cookies)', noLink.length ? `missing on ${noLink.length}: ${noLink.slice(0, 5).join(', ')}` : '');

  // 8. The CSP, identical everywhere and equal to EDGE-SETUP.md
  let cspResults = [];
  try { cspResults = csp.run(root, PAGES); } catch (e) { cspResults = [{ ok: false, name: 'csp.js ran', detail: e.message }]; }
  const cspBad = cspResults.filter((r) => !r.ok);
  add('csp', 'every page, EDGE-SETUP.md', cspBad.length === 0, 'the Content-Security-Policy is identical on every page and equals EDGE-SETUP.md minus frame-ancestors (verify/csp.js)',
    cspBad.length ? cspBad.map((r) => r.name).slice(0, 3).join(' | ') + (cspBad.length > 3 ? ` (+${cspBad.length - 3}; run node verify/csp.js)` : '') : '');

  // 9. The accessibility statement
  const acc = tryRead('accessibility.html');
  add('a11y-statement', 'accessibility.html', acc !== null && /consent bar/i.test(acc), 'mentions the consent bar', acc === null ? 'file missing' : '');

  // 10. The checklist: it exists, every box in sections 1 to 9 is ticked, the header and sign-off fields are filled in
  const listText = tryRead(CHECKLIST);
  add('checklist', CHECKLIST, listText !== null, 'exists', listText !== null ? '' : `write ${CHECKLIST} from the pre-flip checklist (GA4 design brief, section 6)`);
  if (listText !== null) {
    const c = parseChecklist(listText);
    const missingSections = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !c.sections.has(n));
    const shapeOk = !missingSections.length && c.signoff && (c.ticked + c.unticked.length) > 0;
    add('checklist-shape', CHECKLIST, shapeOk, 'has numbered sections 1 to 9 with boxes, and a Sign-off block (so the two checks below read something)',
      shapeOk ? `${c.ticked + c.unticked.length} boxes in sections 1 to 9` : `not recognised: ${missingSections.length ? 'no section ' + missingSections.join(', ') + '; ' : ''}${c.signoff ? '' : 'no Sign-off heading; '}${c.ticked + c.unticked.length} boxes`);
    add('checklist-boxes', CHECKLIST, c.unticked.length === 0, 'every box in sections 1 to 9 is ticked (sections 10 and 11 stay open by design)',
      c.unticked.length ? `${c.unticked.length} unticked: ${c.unticked.slice(0, 10).join(', ')}${c.unticked.length > 10 ? ' ...' : ''}` : `${c.ticked} ticked`);
    const blanks = c.headerBlanks + c.signoffBlanks;
    add('checklist-fields', CHECKLIST, blanks === 0, 'the fill-in fields of the header block and the Sign-off block are filled in',
      blanks ? `${c.headerBlanks} blank field(s) in the header block, ${c.signoffBlanks} in the Sign-off block` : '');
  } else {
    for (const id of ['checklist-shape', 'checklist-boxes', 'checklist-fields']) add(id, CHECKLIST, false, 'is read', 'file missing');
  }

  // 11. The consent-text snapshot matches what is on the pages
  try {
    const snapText = tryRead(SNAPSHOT_REL);
    const snap = C.compareSnapshot(C.consentDigest(root, overrides), undefined, snapText === null ? null : snapText);
    add('snapshot', SNAPSHOT_REL, snap.ok && !snap.note, 'matches the consent text on the pages (review the diff, then node verify/consent.js --update; add --same-version when POLICY_VERSION stays)', snap.detail || snap.note || '');
  } catch (e) { add('snapshot', SNAPSHOT_REL, false, 'matches the consent text on the pages', e.message); }

  return { results, warns, notes };
}

// Gates only a person can pass.
const HUMAN_GATES = [
  "Counsel has reviewed and signed off the privacy notice and the Swedish notice, and the sign-off is dated in " + CHECKLIST + ". The draft banners come off only on that written sign-off.",
  "Google terms: the Analytics property belongs to Vynatix, the data processing terms are accepted and a copy is kept; the contracting entity named in the notice is the one shown in the account.",
  "Data Privacy Framework: the listing of the Google entity that receives the data, the listings of GitHub and Cloudflare, and the state of the Latombe appeal were checked on dataprivacyframework.gov and the check is dated.",
  "Real-ID test in three browsers, by hand: Chromium, Firefox and WebKit each ran accept, decline and a ten-second wait with the real property ID, with a securitypolicyviolation listener on and the GA DebugView or Realtime report open, and the cookie names, domain and lifetimes in the notice are the ones observed. (npm run consent-live is the rehearsal with the dummy ID G-TEST000000; it refuses any other ID, so it cannot stand in for this.)",
  "GA property settings are evidenced: data retention 2 months, Google Signals off, ad personalisation off, outbound clicks and downloads off, internal traffic excluded, and a lookup and a deletion by client ID work.",
  "Records exist: the Article 30 entry and the written DPIA screening.",
  "A keyboard-only walk and a screen-reader pass (VoiceOver or NVDA) of the bar, the reopen and the announcements, in the three browsers.",
];

// The last line: never a bare PASS while the human gates are open.
function summary(report) {
  const bad = report.results.filter((r) => !r.ok).length;
  return bad === 0 ? `scripted gates pass, ${HUMAN_GATES.length} human gates open`
                   : `FAIL — ${bad} release gate(s) not met; do not set GA_ID`;
}

function printReport(report) {
  let bad = 0;
  for (const r of report.results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file}: ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  report.warns.forEach((w) => console.log(`WARN ${w}`));
  report.notes.forEach((n) => console.log(`note ${n}`));
  console.log('\nGates this script cannot check. Tick each off by hand before the real ID goes in:');
  HUMAN_GATES.forEach((g, i) => console.log(`WARN ${i + 1}. ${g}`));
  console.log('\n' + summary(report));
  return bad;
}

// --- the self-test ----------------------------------------------------------------------------------------------
// A tree that has been through the whole procedure, built from the files on disk: a valid ID, PURGE_ONLY false, every
// marker and banner gone, the dates the flip day sets, the checklist ticked and filled in, the snapshot re-taken. Every
// rule is then tried by breaking that tree in one way and asking for that rule's row, so "fails on the regression"
// cannot be mistaken for "fails anyway".
function removeBalancedDiv(html, open) {
  const m = open.exec(html);
  if (!m) return html;
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = m.index;
  let depth = 0, t;
  while ((t = re.exec(html))) {
    depth += t[0][1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(0, m.index) + html.slice(re.lastIndex);
  }
  return html;
}
const withId = (src, id) => src.replace(/var GA_ID = '[^']*';/, `var GA_ID = '${id}';`);

function readyFiles(today) {
  const o = {};
  o['app.js'] = normalisePurgeOnly(withId(readApp().src, 'G-ABCDEF1234'), false);
  let py = fs.readFileSync(path.join(ROOT, SEO_HEAD), 'utf8');
  let map = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  for (const [lang, rel] of Object.entries(NOTICE_PAGES)) {
    let html = readPage(rel);
    html = html.replace(/<mark\b[^>]*>\s*\[\[\s*CONFIRM[\s\S]*?\]\]\s*<\/mark>/gi, '').replace(/\s*\[\[\s*CONFIRM[^\]]*\]\]/gi, '');
    html = removeBalancedDiv(html, /<div class="[^"]*\bbanner--warning\b[^"]*"[^>]*>/i);
    html = html.replace(/(Last updated|Senast uppdaterad)\s+\d{1,2}\s+[A-Za-zåäöÅÄÖ]+\s+\d{4}/, (m, w) => `${w} ${formatDate(today, lang)}`);
    html = html.replace(/(<meta\s+property="article:modified_time"\s+content=")[^"]*(")/i, `$1${today}$2`);
    o[rel] = html;
    py = py.replace(registryEntry(py, rel)[0], (all) => all.replace(/\bmod\s*=\s*['"]\d{4}-\d{2}-\d{2}['"]/, `mod='${today}'`));
    map = map.replace(new RegExp('(<loc>https://vynatix\\.com/' + rel.replace(/\./g, '\\.') + '</loc>(?:(?!</url>)[\\s\\S])*?<lastmod>)[^<]*'), `$1${today}`);
  }
  o[SEO_HEAD] = py;
  o['sitemap.xml'] = map;
  // tick sections 1 to 9, fill the blanks before section 1 and after the Sign-off heading
  let where = 'header';
  o[CHECKLIST] = fs.readFileSync(path.join(ROOT, CHECKLIST), 'utf8').split('\n').map((line) => {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      const num = /^(\d+)\./.exec(h[1]);
      if (num) where = +num[1]; else if (/^sign-?off\b/i.test(h[1])) where = 'signoff'; else if (where !== 'header') where = 'other';
      return line;
    }
    if (where === 'header' || where === 'signoff') return line.replace(/_{3,}/g, 'filled');
    if (typeof where === 'number' && where >= 1 && where <= 9) return line.replace(/^(\s*[-*+]\s+)\[ \]/, '$1[x]');
    return line;
  }).join('\n');
  o[SNAPSHOT_REL] = JSON.stringify(C.snapshotDoc(C.consentDigest(ROOT, o)), null, 2) + '\n';
  return o;
}

function selfTest() {
  const today = todayUtc();
  let bad = 0;
  const t = (ok, name) => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} self-test: ${name}`); };
  const ready = readyFiles(today);
  const run = (patch = {}, opts = {}) => runChecks(Object.assign({ overrides: Object.assign({}, ready, patch), today }, opts));
  const rowOf = (rep, id) => rep.results.find((r) => r.id === id);
  const ok = (patch, id, opts) => { const r = rowOf(run(patch, opts), id); return !!r && r.ok; };
  const failedIds = (rep) => rep.results.filter((r) => !r.ok).map((r) => r.id);
  const EN = NOTICE_PAGES.en, SV = NOTICE_PAGES.sv;
  const sub = (key, from, to) => ({ [key]: ready[key].replace(from, to) });
  const banner = '<div class="banner banner--warning" role="note"><b>Draft pending legal review.</b> text</div>';
  const bannerSv = '<div class="banner banner--warning" role="note"><b>Utkast i väntan på juridisk granskning.</b> text</div>';
  const pageOf = (rel) => (ready[rel] !== undefined ? ready[rel] : readPage(rel));
  const addToMain = (rel, html) => ({ [rel]: pageOf(rel).replace(/<main\b([^>]*)>/, `<main$1>${html}`) });

  // The ready tree passes, and the last line is not a bare PASS.
  const base = run();
  t(failedIds(base).length === 0, `the ready tree (valid ID, markers and banners gone, checklist ticked, dates fresh, snapshot taken) passes every scripted gate${failedIds(base).length ? ': ' + failedIds(base).join(', ') : ''}`);
  t(summary(base) === `scripted gates pass, ${HUMAN_GATES.length} human gates open` && !/^PASS/.test(summary(base)), 'a pass says "scripted gates pass, N human gates open" with N the printed human gates, never a bare PASS');
  t(/^FAIL/.test(summary(run(sub('app.js', "'G-ABCDEF1234'", "'G-XXXXXXXXXX'")))), 'a failing tree ends with FAIL and the count, not with the pass line');

  // GA_ID
  const id = (v) => ok({ 'app.js': withId(ready['app.js'], v) }, 'ga-id');
  t(id('G-XXXXXXXXXX') === false, 'the inert placeholder fails the GA_ID gate');
  t(id('G-XXXXXX') === false, 'a placeholder-shaped ID fails');
  t(id('G-TEST000000') === false, 'the dummy test ID fails (it must never ship)');
  t(id('g-abcdef1234') === false, 'a malformed ID fails');
  t(id('G-ABCDEF1234') === true, 'a valid-shaped ID passes');
  t(ok({ 'app.js': ready['app.js'] + "\nvar GA_ID = 'G-ABCDEF1234';" }, 'ga-id') === false, 'two GA_ID lines fail');
  const others = (v) => run({ 'app.js': withId(ready['app.js'], v) }).results.filter((r) => r.id !== 'ga-id').map((r) => `${r.id}:${r.ok}`).join();
  t(others('G-ABCDEF1234') === others('G-XXXXXXXXXX'), 'swapping the ID changes the GA_ID gate and no other gate');

  // T1: the draft banner and the markers
  const mark = '<mark class="draft-marker">[[CONFIRM: a fact]]</mark>';
  t(ok(addToMain(EN, banner), 'banner-' + EN) === false, 'T1: the English draft banner fails its gate');
  t(ok(addToMain(SV, bannerSv), 'banner-' + SV) === false, 'T1: the Swedish draft banner fails its gate');
  t(ok(addToMain(SV, bannerSv), 'banner-' + EN) === true, 'T1: the Swedish banner does not fail the English page');
  t(ok(addToMain(EN, '<div class="banner banner--warning"><p>Different words, same class.</p></div>'), 'banner-' + EN) === false, 'T1: a reworded warning banner (class banner--warning, no bold headline) still fails');
  t(ok(addToMain(EN, `<p>${mark}</p>`), 'confirm-' + EN) === false, 'T1: a wrapped [[CONFIRM marker fails the marker gate');
  t(ok(addToMain(EN, '<p>[[CONFIRM: a bare one]]</p>'), 'confirm-' + EN) === false, 'T1: a bare [[CONFIRM marker fails');
  t(ok(addToMain(EN, '<p>[[ confirm : spaced and lower case ]]</p>'), 'confirm-' + EN) === false, 'T1: [[ confirm with spaces and lower case is matched loosely');
  t(ok(addToMain(EN, '<p>[[CONFIRM: a ] inside the marker]]</p>'), 'confirm-' + EN) === false, 'T1: a marker with a ] inside is still found');
  t(ok(addToMain(SV, '<p>[[CONFIRM: sv]]</p>'), 'confirm-' + EN) === true, 'T1: a marker on the Swedish page does not fail the English page');
  t(ok(addToMain(EN, `<p>${mark}</p>`), 'marker-banner-' + EN) === false, 'T1: a marker on a page without a banner fails the marker-without-banner gate');
  t(ok(addToMain(EN, `${banner}<p>${mark}</p>`), 'marker-banner-' + EN) === true, 'T1: a marker beside the banner does not fail that gate (the marker gate fails it)');
  t(ok(addToMain(SV, `<p>[[CONFIRM: fakta]]</p>`), 'marker-banner-' + SV) === false, 'T1: the same for the Swedish page');

  // T2: the checklist
  const list = ready[CHECKLIST];
  const inSection = (n, line) => list.replace(new RegExp('(^## ' + n + '\\. [^\\n]*\\n)', 'm'), `$1\n${line}\n`);
  t(ok({}, 'checklist-boxes') && ok({}, 'checklist-fields') && ok({}, 'checklist-shape'), 'T2: the ticked and filled checklist passes the three checklist gates');
  t(ok({ [CHECKLIST]: inSection(3, '- [ ] **3.9 an open box**') }, 'checklist-boxes') === false, 'T2: an unticked box in section 3 fails');
  t(ok({ [CHECKLIST]: inSection(1, '- [ ] **1.9 an open box**') }, 'checklist-boxes') === false, 'T2: an unticked box in section 1 fails');
  t(ok({ [CHECKLIST]: inSection(9, '  - [ ] **9.9 an open nested box**') }, 'checklist-boxes') === false, 'T2: an unticked box in section 9 (indented) fails');
  t(ok({ [CHECKLIST]: inSection(10, '- [ ] **10.9 left open on purpose**') }, 'checklist-boxes') === true, 'T2: an unticked box in section 10 (the exit runbook) is not read');
  t(ok({ [CHECKLIST]: inSection(11, '- [ ] **a quarterly item**') }, 'checklist-boxes') === true, 'T2: an unticked box in section 11 (the quarterly review) is not read');
  t(ok({ [CHECKLIST]: inSection(4, '- [X] **4.9 ticked with a capital**') }, 'checklist-boxes') === true, 'T2: [X] counts as ticked');
  t(ok({ [CHECKLIST]: list.replace(/^## 1\. /m, 'PR: ______\n\n## 1. ') }, 'checklist-fields') === false, 'T2: a blank field (______) in the header block fails');
  t(ok({ [CHECKLIST]: list + '\nCounsel sign-off (5.2) dated ______.\n' }, 'checklist-fields') === false, 'T2: a blank field in the Sign-off block fails');
  t(ok({ [CHECKLIST]: inSection(10, 'Exit clock: flip commit ______ at ______') }, 'checklist-fields') === true, 'T2: blanks in section 10 (filled in after the merge) are not read');
  t(ok({ [CHECKLIST]: list.replace(/^## 5\. .*$/m, '## Five') }, 'checklist-shape') === false, 'T2: a checklist that has lost a numbered section is refused, not read as "no boxes"');
  t(ok({ [CHECKLIST]: list.replace(/^## Sign-?off\b.*$/mi, '## Signed') }, 'checklist-shape') === false, 'T2: a checklist without its Sign-off heading is refused');
  t(ok({ [CHECKLIST]: '# empty\n' }, 'checklist-shape') === false, 'T2: an empty checklist is refused');

  // T3: the exit switch, the constants, the notices' wording
  const app = ready['app.js'];
  t(ok({ 'app.js': app.replace('var PURGE_ONLY = false;', 'var PURGE_ONLY = true;') }, 'purge-only') === false, 'T3: PURGE_ONLY = true fails (a re-flip must set it back to false)');
  t(ok({ 'app.js': app.replace('var PURGE_ONLY = false;', 'var PURGE_ONLY = false;\n  var PURGE_ONLY = false;') }, 'purge-only') === false, 'T3: two PURGE_ONLY lines fail');
  t(ok({ 'app.js': app.replace(/^[ \t]*var PURGE_ONLY = false;.*$/m, '') }, 'purge-only') === false, 'T3: no PURGE_ONLY line fails');
  t(ok({ 'app.js': app + '\n// var PURGE_ONLY = true; (a comment that mentions it)\n' }, 'purge-only') === true, 'T3: a comment that mentions "var PURGE_ONLY = true;" is not code');
  t(ok({ 'app.js': app.replace(/var COOKIE_MAX_AGE = \d+;/, 'var COOKIE_MAX_AGE = 63072000;') }, 'policy-constants') === false, 'T3: COOKIE_MAX_AGE of two years fails');
  t(ok({ 'app.js': app.replace(/var CONSENT_MAX_DAYS = \d+;/, 'var CONSENT_MAX_DAYS = 730;') }, 'policy-constants') === false, 'T3: CONSENT_MAX_DAYS of 730 fails');
  t(ok({ 'app.js': app.replace(/var CONSENT_MAX_DAYS = \d+;/, '') }, 'policy-constants') === false, 'T3: a missing CONSENT_MAX_DAYS fails');
  t(ok(sub(EN, /12 months/g, '24 months'), 'lifetime-' + EN) === false, 'T3: the English notice without "12 months" fails');
  t(ok(sub(SV, /12 månader/g, '24 månader'), 'lifetime-' + SV) === false, 'T3: the Swedish notice without "12 månader" fails');
  t(ok(sub(SV, /12 månader/g, '12 months'), 'lifetime-' + SV) === false, 'T3: "12 months" does not satisfy the Swedish notice');
  for (const k of ['vynatix-consent', 'vynatix-theme', 'vynatix-look']) {
    t(ok({ [EN]: ready[EN].split(`<code>${k}</code>`).join(`<em>${k}</em>`) }, 'keys-' + EN) === false, `T3: the English notice without <code>${k}</code> fails`);
    t(ok({ [SV]: ready[SV].split(`<code>${k}</code>`).join(k) }, 'keys-' + SV) === false, `T3: the Swedish notice without <code>${k}</code> fails`);
  }
  t(ok({ 'app.js': app.replace("var CONSENT_KEY = 'vynatix-consent'", "var CONSENT_KEY = 'vynatix-choice'") }, 'keys-' + EN) === false, 'T3: CONSENT_KEY renamed in app.js while the notices still say vynatix-consent fails');

  // T4: the dates
  const day = (offset) => { const d = new Date(dayNum(today) * 86400000 + offset * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const setDates = (rel, lang, iso, mod = iso) => {
    const py = ready[SEO_HEAD].replace(registryEntry(ready[SEO_HEAD], rel)[0], (all) => all.replace(/\bmod\s*=\s*['"]\d{4}-\d{2}-\d{2}['"]/, `mod='${mod}'`));
    return { [rel]: ready[rel].replace(/(Last updated|Senast uppdaterad)\s+\d{1,2}\s+[A-Za-zåäöÅÄÖ]+\s+\d{4}/, (m, w) => `${w} ${formatDate(iso, lang)}`), [SEO_HEAD]: py };
  };
  t(ok(setDates(EN, 'en', day(-1)), 'dates-' + EN) === true, 'T4: a notice dated yesterday with mod equal passes');
  t(ok(setDates(EN, 'en', day(-MAX_NOTICE_AGE_DAYS)), 'dates-' + EN) === true, `T4: ${MAX_NOTICE_AGE_DAYS} days old passes`);
  t(ok(setDates(EN, 'en', day(-MAX_NOTICE_AGE_DAYS - 1)), 'dates-' + EN) === false, `T4: ${MAX_NOTICE_AGE_DAYS + 1} days old fails (the flip-day step names the fix)`);
  t(ok(setDates(SV, 'sv', day(-40)), 'dates-' + SV) === false, 'T4: a Swedish notice 40 days old fails');
  t(ok(setDates(EN, 'en', day(1)), 'dates-' + EN) === false, 'T4: a date in the future fails');
  t(ok(setDates(EN, 'en', today, day(-1)), 'dates-' + EN) === false, 'T4: a visible date that differs from mod fails (visible today, mod yesterday)');
  t(ok(setDates(SV, 'sv', day(-1), today), 'dates-' + SV) === false, 'T4: a visible date that differs from mod fails (Swedish, mod newer)');
  t(ok(sub(EN, /Last updated\s+\d{1,2}\s+\w+\s+\d{4}/, 'Updated recently'), 'dates-' + EN) === false, 'T4: a page without a parseable "Last updated" line fails');
  t(ok(sub(SV, /Senast uppdaterad\s+\d{1,2}\s+\w+\s+\d{4}/, 'Senast uppdaterad 19 oktobre 2026'), 'dates-' + SV) === false, 'T4: an unknown Swedish month name fails');
  t(ok({ [SEO_HEAD]: ready[SEO_HEAD].replace(registryEntry(ready[SEO_HEAD], EN)[0], "'x.html': dict(") }, 'dates-' + EN) === false, 'T4: a page missing from the registry in seo-head.py fails');
  t(ok({ 'sitemap.xml': ready['sitemap.xml'].replace(new RegExp('(<loc>https://vynatix\\.com/' + EN.replace('.', '\\.') + '</loc>(?:(?!</url>)[\\s\\S])*?<lastmod>)[^<]*'), `$1${day(-3)}`) }, 'dates-generated-' + EN) === false, 'T4: a sitemap lastmod that is not mod fails (seo-head.py was not run)');
  t(ok(sub(SV, /(<meta\s+property="article:modified_time"\s+content=")[^"]*/, `$1${day(-3)}`), 'dates-generated-' + SV) === false, 'T4: an article:modified_time that is not mod fails');

  // T5: read-by-eye WARN, with the known-good sentences suppressed and counted. Counted against the ready tree's own
  // WARN lines, so that a sentence reworded on the pages (a WARN the owner reads) does not break the self-test.
  const nowWarn = (patch) => run(patch).warns.filter((w) => /read by eye/.test(w));
  const w0 = nowWarn({}).length;
  t(nowWarn(addToMain(EN, '<p>This page uses no analytics at all.</p>')).length === w0 + 1, 'T5: a new sentence that says "no analytics" is one more WARN');
  t(nowWarn(addToMain(SV, '<p>No cookies are set until you accept analytics.</p>')).length === w0 + 1, 'T5: a listed sentence on a page it is not listed for (the English one on the Swedish notice) is a WARN');
  t(nowWarn(addToMain(EN, '<p>No cookies are set until you accept analytics, ever.</p>')).length === w0 + 1, 'T5: a listed sentence reworded is a WARN again');
  t(nowWarn(addToMain(EN, '<p>No cookies are set until you accept analytics.</p>')).length === w0, 'T5: a listed sentence is not a WARN (it is counted in a note)');
  const many = Array.from({ length: MAX_WARN_LINES + 3 }, (_, i) => `<p>Number ${i} says no analytics here.</p>`).join('');
  const manyRep = run(addToMain(EN, many));
  t(manyRep.warns.filter((w) => /read by eye/.test(w)).length === MAX_WARN_LINES && manyRep.warns.some((w) => new RegExp(`${w0 + 3} more read-by-eye`).test(w)), 'T5: a long list is cut at the limit and the cut is counted');
  t(run().notes.some((n) => /read-by-eye sentence\(s\) matched READ_BY_EYE_OK/.test(n)), 'T5: the number of suppressed known-good sentences is printed');

  // The stale-claim gate: the old sentence fails, the honest change note passes.
  const priv = ready[EN];
  const add = (s) => ({ [EN]: priv.replace(/<main\b([^>]*)>/, `<main$1><p>${s}</p>`) });
  const staleOf = (patch) => run(patch).results.find((r) => r.id === 'stale').count;
  const sbase = staleOf({});
  t(staleOf(add('This site collects no analytics, sets no cookies, and loads nothing from a third party.')) > sbase, 'the old sentence "collects no analytics, sets no cookies" adds a stale-claim hit');
  t(staleOf(add('There are <strong>no cookies</strong>. We set none, so there is no consent banner to click.')) > sbase, 'the old "no cookies ... no consent banner" sentences add a hit');
  t(staleOf(add('Before then the site used no analytics and set no cookies.')) === sbase, 'an honest history sentence ("Before then the site used no analytics") adds none');

  // The footer link row shares publish.js's test.
  t(ok({ 'about.html': fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8').replace(/data-consent-open/g, '') }, 'footer') === false, 'a page whose footer link lost data-consent-open fails the footer gate');
  console.log(bad === 0 ? '\nPASS — the release gate fails for the right reasons' : `\nFAIL — ${bad} self-test(s) wrong`);
  return bad;
}

module.exports = { runChecks, staleSentences, selfTest, readyFiles, HUMAN_GATES, parseChecklist, draftBanner, confirmMarkers, visibleDate, modOf, summary, READ_BY_EYE_OK };

if (require.main === module) {
  if (process.argv.includes('--self-test')) process.exit(selfTest() === 0 ? 0 : 1);
  const report = runChecks();
  process.exit(printReport(report) === 0 ? 0 : 1);
}
