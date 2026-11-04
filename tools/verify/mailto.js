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
// A tagged subject is only allowed on a page whose slug it names. Plain links without a subject are not this
// script's business.
const { ROOT, PAGES, readPage, parseTags } = require('./_common');

const ADDRESS = 'front.disk@vynatix.com';

// The problems of one mailto href on the page with the given file name, [] when it is fine.
function subjectProblems(href, file) {
  const m = /^mailto:([^?]*)(?:\?(.*))?$/i.exec(href);
  if (!m) return [];
  const query = m[2];
  if (query === undefined || !/(^|&)subject=/i.test(query)) return [];
  const out = [];
  if (m[1].toLowerCase() !== ADDRESS) out.push(`address ${m[1]} (want ${ADDRESS})`);
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
  for (const p of PAGES) {
    for (const t of parseTags(readPage(p), 'a')) {
      const href = t.attrs.href || '';
      if (!/^mailto:/i.test(href) || !/[?&]subject=/i.test(href)) continue;
      links++;
      const problems = subjectProblems(href, p);
      if (problems.length) { bad++; console.log(`FAIL ${p}: ${href}\n       ${problems.join('; ')}`); }
    }
  }
  if (!bad) console.log(`ok   ${links} mailto links with a subject, all well formed`);
  console.log(bad ? `\nFAIL — ${bad} problem(s)` : '\nPASS — mailto subjects');
  process.exit(bad ? 1 : 0);
}
module.exports = { subjectProblems };
