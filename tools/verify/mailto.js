// The subject lines of the mailto links on the pages. Static, no browser.
//   node verify/mailto.js            checks every page in PAGES
//   node verify/mailto.js --self-test
//
// contact.html tells the sender to start the subject line with Project or Membership, and a guide's call to
// action may add the guide's own slug after it, so an enquiry arrives tagged with the page that prompted it
// while analytics are off. Nothing else constrained the subject (a hostile or careless one passed csp, links,
// seo and publish), so this does. A mailto link that names a subject must have:
//  - the address front.disk@vynatix.com and exactly one parameter, subject (no body, cc or second subject);
//  - the subject spelled with %20, never +;
//  - a decoded subject that is "Project" or "Membership", optionally followed by ": " and the page's own slug,
//    and nothing else, at most 80 characters, with no em dash, exclamation mark or ellipsis;
//  - a slug (the file name without .html) of a-z, 0-9 and hyphens that does not contain the routing words, so a
//    word-matching inbox rule cannot be confused by it.
// A tagged subject is only allowed on a page whose slug it names, and that page must link the email section of the
// privacy notice in its language (privacy.html#email or integritet.html#email), which must exist: the notices are
// where the tag and the per-guide count are disclosed. A mailto link without a subject is fine, but
// it must still go to that address and carry no cc, bcc or body. The href is read the way a browser reads it:
// entities decoded, tabs, newlines and surrounding spaces removed, the scheme case-insensitive.
const { ROOT, PAGES, readPage, pageLang, parseTags, decodeEntities } = require('./_common');
const NOTICE_EMAIL = { en: 'privacy.html#email', sv: 'integritet.html#email' };

const ADDRESS = 'front.disk@vynatix.com';

// The problems of one mailto href on the page with the given file name, [] when it is fine.
const clean = (href) => decodeEntities(String(href)).replace(/[\t\n\r]/g, '').trim();

function subjectProblems(rawHref, file) {
  const href = clean(rawHref);
  const m = /^mailto:([^?]*)(?:\?([\s\S]*))?$/i.exec(href);
  if (!m) return [];
  const query = m[2];
  const out = [];
  if (decodeURIComponent(m[1]).toLowerCase() !== ADDRESS) out.push(`address ${m[1]} (want ${ADDRESS})`);
  if (query === undefined || !/(^|&)subject=/i.test(query)) {
    if (query !== undefined && query !== '') out.push(`parameters ${query} without a subject (a mailto link here carries only a subject)`);
    return out;
  }
  const params = query.split('&');
  if (params.length !== 1) out.push(`${params.length} parameters (want only subject)`);
  const raw = params.find((p) => /^subject=/i.test(p)).slice('subject='.length);
  if (/\+/.test(raw)) out.push('"+" in the subject (spell a space %20)');
  let subject;
  try { subject = decodeURIComponent(raw); } catch (e) { out.push('subject does not decode'); return out; }
  const slug = file.replace(/\.html$/, '');
  const ok = new RegExp('^(Project|Membership)(: ' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')?$').test(subject);
  if (!ok) out.push(`subject "${subject}" (want Project or Membership, optionally followed by ": ${slug}")`);
  if (subject.length > 80) out.push('subject longer than 80 characters');
  if (/—|!|…|\.\.\./.test(subject)) out.push('em dash, exclamation mark or ellipsis in the subject');
  if (subject.includes(':') && !/^[a-z0-9-]+$/.test(slug)) out.push(`slug "${slug}" is not a-z, 0-9 and hyphens`);
  if (subject.includes(':') && /project|membership/i.test(slug)) out.push(`slug "${slug}" contains a routing word`);
  return out;
}

function selfTest() {
  const good = [
    ['mailto:front.disk@vynatix.com?subject=Project', 'contact.html'],
    ['mailto:front.disk@vynatix.com?subject=Membership', 'contact.html'],
    ['mailto:front.disk@vynatix.com?subject=Project:%20choose-a-software-consultancy', 'choose-a-software-consultancy.html'],
    ['mailto:front.disk@vynatix.com?subject=Membership:%20blog', 'blog.html'],
    ['mailto:front.disk@vynatix.com', 'about.html'],
    ['https://vynatix.com/', 'about.html'],
    [' MAILTO:front.disk@vynatix.com?SUBJECT=Project\n', 'contact.html'],
  ];
  const bad = [
    ['mailto:front.disk@vynatix.com?subject=Project:%20choose-a-software-consultancy%20-%20membership', 'choose-a-software-consultancy.html'],
    ['mailto:front.disk@vynatix.com?subject=Project:+choose-a-software-consultancy', 'choose-a-software-consultancy.html'],
    ['mailto:front.disk@vynatix.com?subject=Project:%20another-page', 'choose-a-software-consultancy.html'],
    ['mailto:front.disk@vynatix.com?subject=Project&body=hello', 'contact.html'],
    ['mailto:front.disk@vynatix.com?subject=Re:%20Project', 'contact.html'],
    ['mailto:front.disk@vynatix.com?subject=Project:%20choose-a-software-consultancy%E2%80%94', 'choose-a-software-consultancy.html'],
    ['mailto:someone@example.com?subject=Project', 'contact.html'],
    ['mailto:front.disk@vynatix.com?subject=Project:%20membership-guide', 'membership-guide.html'],
    ['mailto:front.disk@vynatix.com?subject=Project&subject=Membership', 'contact.html'],
    ['mailto:front.disk@vynatix.com?subject=Project:%20choose-a-software-consultancy&bcc=a@b.c\n', 'choose-a-software-consultancy.html'],
    ['mailto:front.disk@vynatix.com?bcc=evil@x.com', 'about.html'],
    ['mailto:someone@example.com', 'about.html'],
    ['mailto:front.disk@vynatix.com?subject=Project&amp;body=hi', 'contact.html'],
  ];
  let bad_ = 0;
  for (const [h, f] of good) if (subjectProblems(h, f).length) { bad_++; console.log(`FAIL accepted-by-design rejected: ${h} on ${f}: ${subjectProblems(h, f).join('; ')}`); }
  for (const [h, f] of bad) if (!subjectProblems(h, f).length) { bad_++; console.log(`FAIL hostile subject passed: ${h} on ${f}`); }
  console.log(bad_ ? `\nFAIL — ${bad_} self-test problem(s)` : `ok   self-test: ${good.length} accepted, ${bad.length} refused`);
  return bad_;
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 1 : 0);
  let bad = selfTest();
  let links = 0;
  const tagged = new Set();
  for (const p of PAGES) {
    for (const t of parseTags(readPage(p), 'a')) {
      const href = t.attrs.href || '';
      if (!/^mailto:/i.test(clean(href))) continue;
      links++;
      if (/subject=[^&]*%3A|subject=[^&]*:/i.test(clean(href))) tagged.add(p);
      const problems = subjectProblems(href, p);
      if (problems.length) { bad++; console.log(`FAIL ${p}: ${href}\n       ${problems.join('; ')}`); }
    }
  }
  for (const p of tagged) {
    const lang = (pageLang(p) || 'en').slice(0, 2);
    const want = NOTICE_EMAIL[lang] || NOTICE_EMAIL.en;
    const notice = want.split('#')[0];
    if (!parseTags(readPage(p), 'a').some((t) => clean(t.attrs.href || '') === want)) { bad++; console.log(`FAIL ${p}: its button carries the page's slug in the subject, but the page does not link ${want}, where the tag is disclosed`); }
    if (!/\bid="email"/.test(readPage(notice))) { bad++; console.log(`FAIL ${notice} has no id="email" section, which ${p} relies on`); }
  }
  if (!bad) console.log(`ok   ${links} mailto links, all to ${ADDRESS} and all well formed; ${tagged.size} page(s) with a tagged subject, each linking the notice's email section`);
  console.log(bad ? `\nFAIL — ${bad} problem(s)` : '\nPASS — mailto subjects');
  process.exit(bad ? 1 : 0);
}
module.exports = { subjectProblems };
