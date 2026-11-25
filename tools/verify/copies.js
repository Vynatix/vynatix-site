// Copies that are meant to be exact and that no other check compares. Static: no browser, no server. Scope: root,
// the root pages that hold the copies (the generated languages are written from them by tools/seo-head.py).
//   node verify/copies.js               the self-test, then the check of the tree
//   node verify/copies.js --self-test   only the self-test: each part must fail on a changed copy
//   node verify/copies.js --root DIR    the same on another tree, a scratch copy for instance
//   node verify/copies.js --verbose     also prints what each case of the self-test was caught by
//
// Five parts, all on the root pages (the generated languages are written from these by tools/seo-head.py):
//  faq           The Common questions of index.html are questions of contact.html, word for word (the comment
//                above the block says so). Every [data-faq-item] of index.html must have an item on contact.html
//                with the same question, and the two items must be the same markup once white space is
//                normalised, so a reworded answer and a changed link both fail. The order may differ, because the
//                two pages order their questions differently.
//  deliverables  The "What we deliver" list of each service card on index.html (#services) is the list of the
//                section of services.html that the card's link names (services.html#ai-engineering), item for
//                item and in the same order.
//  calc          The percentages printed in the rate calculator of membership.html are the constants of app.js
//                that its arithmetic uses (RATES below), times 100 and rounded to two decimals, so 5 / 52 is
//                printed as 9.62% and 0.045 as 4.5%. A printed percentage that RATES does not name fails.
//  guides        Every entry of the guide lists (blog.html, #english and #swedish; index.html, ul.reads in
//                #insights, and sv.html, ul.reads in #guider), every line of llms.txt that links a guide and every
//                item of the ItemList in the structured data of blog.html repeats the linked page's <title> without
//                ", Vynatix", its meta description and, where a date shows, its pub in the registry, in the datetime
//                and in the text shown. A guide is a page that blog.html lists. Not every list carries every field:
//                the ItemList has only the name, sv.html shows no date, and llms.txt is read only above its
//                generated languages.
//  lists         Every list holds the pages that tools/site/lists.json gives it, in that order, and every override
//                there is an exception here with the same text (each exception on a hub list is an override there,
//                too). The hub lists are written by hand, so this is what holds them to the file.
//  footer        The footer's shorter wording of the company sentence. In tools/site/company.json, footer_sentence
//                is the sentence without its first two words and its last sentence, its first letter then a
//                capital ("Vynatix is the senior ..." gives "The senior ..."), and the about line of the footer of
//                every root page says footer_sentence (tools/seo-head.py writes the footer from
//                tools/templates/footer.html, which names it). The generated languages translate it as a message
//                of its own, so their footers are not read.
//
// The copies that differ from their page today, on purpose or until the owner decides (tools/REFACTORING-PLAN.md,
// section 5, item 3), are named in EXCEPTIONS with the exact text they hold. Such a copy fails when it moves off
// that text, and also when it comes to equal its page, because the exception is then no longer needed. An
// exception that matches no entry fails too, so the list cannot go stale.
//
// Two of the lists are written by tools/seo-head.py from tools/site/lists.json: the guide lines of llms.txt and the
// ItemList of blog.html, each from its pages and the overrides of the file. For those two, the guides part repeats
// what the generator does, on purpose: it reads the files as they ship and holds its own copy of the differences in
// EXCEPTIONS, so a fault in the generator, or an override changed without its reason, fails here and is not
// trusted. permanence.js (H) holds the posts on the hubs. The parser fails closed: a list that yields no entry, an
// entry it cannot read, a link that is not a root page, or a page whose <title> does not end in ", Vynatix" is a
// failure, never a skip. Every problem line starts with FAIL and names its part.
const fs = require('fs');
const path = require('path');
const { ROOT, readRegistry, scopeLine, parseTags, htmlToText, decodeEntities, appConst } = require('./_common');

const SUFFIX = ', Vynatix';
const SITE = 'https://vynatix.com/';
const LLMS_GENERATED = '<!-- Generated languages';

// The lists of tools/site/lists.json, in its order, and the name EXCEPTIONS give the file each is in: the two sections
// of blog.html, ul.reads in #insights of index.html and in #guider of sv.html, the ItemList of blog.html (by its @id)
// and the guide lines of llms.txt. WRITTEN are the two that tools/seo-head.py writes from the file (LISTS there).
const LISTS = {
  'blog.html#english': 'blog.html', 'blog.html#swedish': 'blog.html', 'index.html#insights': 'index.html',
  'sv.html#guider': 'sv.html', 'blog.html#guides': 'blog.html#guides', 'llms.txt': 'llms.txt',
};
const WRITTEN = new Set(['blog.html#guides', 'llms.txt']);
const ITEMLIST = SITE + 'blog.html#guides';

// The calculator's printed rates: the data-calc-out key of the figure beside the label, and the app.js constant
// its arithmetic multiplies by. A change to a term is made in app.js, in the label and in tools/verify/calc.js.
const RATES = { employer: 'EMPLOYER_FEE', holiday: 'HOLIDAY', pension: 'PENSION', pensionTax: 'PENSION_TAX' };

// The copies that differ from their page today. `src` is the list, `page` the page it links, `field` the field
// (title, description, datetime or date), `text` exactly what the copy holds ('' for a field that is absent).
const EXCEPTIONS = [
  { src: 'blog.html', page: 'valja-konsultbolag.html', field: 'description',
    text: 'Vynatix i Göteborg om att välja konsultbolag för mjukvaruutveckling: frågorna att ställa, varningssignalerna och när ett större bolag passar bättre.',
    why: 'the description the guide dropped on 20 November 2026; kept or corrected on the owner\'s word (plan, section 5, item 3)' },
  { src: 'index.html', page: 'platform-engineering.html', field: 'description',
    text: 'Platform engineering explained by Vynatix in Gothenburg: what an internal developer platform is, when it pays off, what to measure and how to start.',
    why: 'a Swedish guide on the English home page is described in English, so the page reads in one language (the comment above the list)' },
  { src: 'llms.txt', page: 'platform-engineering.html', field: 'title',
    text: 'Platform engineering: vad det är och när det lönar sig',
    why: 'a shorter title than the page\'s; kept or corrected on the owner\'s word (plan, section 5, item 3)' },
  { src: 'llms.txt', page: 'platform-engineering.html', field: 'description', text: '',
    why: 'one of the three Swedish guides of 18 October 2026 listed without a description (plan, section 5, item 3)' },
  { src: 'llms.txt', page: 'ai-assistent-interna-dokument.html', field: 'description', text: '',
    why: 'one of the three Swedish guides of 18 October 2026 listed without a description (plan, section 5, item 3)' },
  { src: 'llms.txt', page: 'valja-konsultbolag.html', field: 'description', text: '',
    why: 'one of the three Swedish guides of 18 October 2026 listed without a description (plan, section 5, item 3)' },
  { src: 'llms.txt', page: 'choose-a-software-consultancy.html', field: 'description',
    text: 'the questions to ask, the warning signs and how to judge whether the developers are really senior; also available in Swedish',
    why: 'its own wording, which names the Swedish twin (plan, section 5, item 3)' },
];

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  sv: ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'],
};
// A pub date as the pages print it: "24 November 2026", "18 oktober 2026". null for a language without month names.
function longDate(iso, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  const names = MONTHS[String(lang || '').slice(0, 2)];
  return m && names ? `${Number(m[3])} ${names[Number(m[2]) - 1]} ${m[1]}` : null;
}

// --- reading HTML ----------------------------------------------------------------------------------------------

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style', 'title', 'textarea']);

// Every tag of a page, comments blanked first (blanked, not removed, so an index into the page stays valid):
// { name, close, attrs, start, end }, with end just after the tag's ">". The attributes are read by parseTags of
// _common.js, so a ">" inside a quoted value does not end the tag. What a script, style or title holds is text.
function tagList(src) {
  const out = [];
  const re = /<(\/?)([A-Za-z][A-Za-z0-9-]*)/g;
  let m;
  while ((m = re.exec(src))) {
    let j = re.lastIndex;
    let quote = '';
    for (; j < src.length; j++) {
      const c = src[j];
      if (quote) { if (c === quote) quote = ''; } else if (c === '"' || c === "'") quote = c; else if (c === '>') break;
    }
    const name = m[2].toLowerCase();
    const close = m[1] === '/';
    const end = Math.min(j + 1, src.length);
    const attrs = close ? {} : ((parseTags(src.slice(m.index, end), name)[0] || {}).attrs || {});
    out.push({ name, close, attrs, start: m.index, end });
    re.lastIndex = end;
    if (!close && RAW_TEXT.has(name)) {
      const stop = src.toLowerCase().indexOf('</' + name, end);
      re.lastIndex = stop < 0 ? src.length : stop;
    }
  }
  return out;
}
const docs = new Map();
function parse(html) {
  if (!docs.has(html)) {
    const src = String(html).replace(/<!--[\s\S]*?(?:-->|$)/g, (c) => ' '.repeat(c.length));
    docs.set(html, { src, tags: tagList(src) });
  }
  return docs.get(html);
}

// The elements of `doc` whose start tag passes `test`, inside `within` when given, in document order:
// { name, attrs, start, open, close, end, inner }, where open is the end of the start tag and close the start of the
// end tag. The end tag is found by counting the tags of the same name; an element that never closes throws.
function find(doc, test, within) {
  const out = [];
  const list = doc.tags;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (t.close || (within && (t.start < within.open || t.start >= within.close)) || !test(t)) continue;
    if (VOID.has(t.name)) { out.push(Object.assign({}, t, { open: t.end, close: t.end, inner: '' })); continue; }
    let depth = 0;
    let k = i;
    for (; k < list.length; k++) {
      if (list[k].name !== t.name) continue;
      depth += list[k].close ? -1 : 1;
      if (depth === 0) break;
    }
    if (k >= list.length) throw new Error(`a <${t.name}> that starts at character ${t.start} is never closed`);
    const u = list[k];
    out.push({ name: t.name, attrs: t.attrs, start: t.start, open: t.end, close: u.start, end: u.end, inner: doc.src.slice(t.end, u.start) });
  }
  return out;
}
const hasAttr = (t, a) => Object.prototype.hasOwnProperty.call(t.attrs, a);
const hasClass = (t, c) => String(t.attrs.class || '').split(/\s+/).includes(c);
const one = (list, what) => {
  if (list.length !== 1) throw new Error(`${list.length} ${what} (want 1)`);
  return list[0];
};

// The visible text of a fragment on one line, entities decoded.
const text = (html) => htmlToText(html).replace(/\s+/g, ' ').trim();
// A fragment's markup with white space normalised: runs become one space, and the space around a block tag goes,
// so indentation does not count and a word, an inline tag or an attribute does.
const markup = (html) => String(html).replace(/\s+/g, ' ').replace(/\s*(<\/?(?:div|h[1-6]|p|ul|ol|li|dl|dt|dd|br)\b[^>]*>)\s*/gi, '$1').trim();
// Where two strings part, for a failure message.
function parting(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 24);
  return `they part at character ${i}: "${a.slice(from, i + 40)}" against "${b.slice(from, i + 40)}"`;
}

// The footer's shorter wording of a company sentence: without its first two words and its last sentence, its first
// letter then a capital. A sentence ends at a full stop followed by a space; null when there is no second sentence.
function footerWording(sentence) {
  const rest = String(sentence).trim().split(/\s+/).slice(2).join(' ');
  const parts = rest.split(/(?<=\.) /);
  if (parts.length < 2) return null;
  const kept = parts.slice(0, -1).join(' ');
  return kept.charAt(0).toUpperCase() + kept.slice(1);
}

// The root page a link names: "test-automation.html", "https://vynatix.com/test-automation.html" and
// "https://vynatix.com/" (index.html) are root pages; anything else is null.
function linkedFile(href) {
  let h = decodeEntities(String(href || '')).trim();
  if (h.startsWith(SITE)) h = h.slice(SITE.length);
  h = h.replace(/[?#].*$/, '');
  if (h === '') return 'index.html';
  return /^[a-z0-9-]+\.html$/.test(h) ? h : null;
}

// A page's <title> (entities decoded, white space normalised), its meta description and its <html lang>. Throws
// unless the head has exactly one title and the page one meta description (an SVG may hold a <title> of its own).
function pageFacts(html) {
  const doc = parse(html);
  const head = doc.tags.find((t) => t.close && t.name === 'head');
  const title = decodeEntities(one(find(doc, (t) => t.name === 'title' && (!head || t.start < head.start)), '<title> elements in the head').inner).replace(/\s+/g, ' ').trim();
  const desc = one(doc.tags.filter((t) => !t.close && t.name === 'meta' && String(t.attrs.name || '').toLowerCase() === 'description'), 'meta descriptions');
  const root = doc.tags.find((t) => !t.close && t.name === 'html');
  return { title, description: decodeEntities(desc.attrs.content || '').replace(/\s+/g, ' ').trim(), lang: root ? root.attrs.lang : null };
}

// The ItemList node of a page's structured data (the one with the @id ITEMLIST), read from its JSON-LD blocks as they
// ship. Throws unless there is exactly one and every block parses.
function itemList(html) {
  const nodes = [];
  for (const m of String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j;
    try { j = JSON.parse(m[1]); } catch (e) { throw new Error(`a JSON-LD block does not parse (${e.message})`); }
    nodes.push(...(Array.isArray(j['@graph']) ? j['@graph'] : [j]));
  }
  return one(nodes.filter((n) => n && n['@type'] === 'ItemList' && n['@id'] === ITEMLIST), `ItemList nodes with the @id ${ITEMLIST} in the structured data`);
}

// --- the check -------------------------------------------------------------------------------------------------

// Runs every part on the tree that `read` reads (a file name relative to the root gives its text) and returns
// { problems: [{ part, msg }], notes: [{ part, msg }] }: notes are the measurements printed as ok lines.
function check(read, opts = {}) {
  const exceptions = opts.exceptions || EXCEPTIONS;
  const registry = opts.registry || {};
  const problems = [];
  const notes = [];
  const fail = (part, msg) => problems.push({ part, msg });
  const note = (part, msg) => notes.push({ part, msg });
  const guard = (part, fn) => { try { fn(); } catch (e) { fail(part, e.message); } };

  // The page facts the lists repeat, read once per page: the <title> without its suffix and the meta description.
  const facts = new Map();
  function page(file) {
    if (!facts.has(file)) {
      let f;
      try {
        f = pageFacts(read(file));
        if (!f.title.endsWith(SUFFIX)) throw new Error(`its <title> "${f.title}" does not end in "${SUFFIX}"`);
        f = Object.assign({}, f, { title: f.title.slice(0, -SUFFIX.length) });
      } catch (e) { f = { error: `${file}: ${e.message}` }; }
      facts.set(file, f);
    }
    return facts.get(file);
  }

  // 1. The Common questions of the home page against contact.html.
  guard('faq', () => {
    function items(file) {
      const doc = parse(read(file));
      const box = one(find(doc, (t) => hasAttr(t, 'data-faq')), `[data-faq] blocks on ${file}`);
      const all = find(doc, (t) => hasAttr(t, 'data-faq-item'));
      const inside = all.filter((it) => it.start >= box.open && it.end <= box.close);
      if (inside.length !== all.length) throw new Error(`${file}: ${all.length - inside.length} [data-faq-item] outside its [data-faq] block`);
      if (!all.length) throw new Error(`${file}: no [data-faq-item] in its [data-faq] block`);
      const out = new Map();
      for (const it of all) {
        const h3 = find(doc, (t) => t.name === 'h3', it);
        if (!h3.length) throw new Error(`${file}: a [data-faq-item] without an h3, its question`);
        const q = text(h3[0].inner);
        if (out.has(q)) throw new Error(`${file}: the question "${q}" is asked twice`);
        out.set(q, markup(it.inner));
      }
      return out;
    }
    const home = items('index.html');
    const contact = items('contact.html');
    let same = 0;
    for (const [q, html] of home) {
      if (!contact.has(q)) fail('faq', `index.html asks "${q}", which contact.html does not ask in those words`);
      else if (contact.get(q) !== html) fail('faq', `index.html and contact.html answer "${q}" differently; ${parting(html, contact.get(q))}`);
      else same++;
    }
    note('faq', `${same} of the ${home.size} Common questions of index.html equal their items on contact.html (which asks ${contact.size})`);
  });

  // 2. The deliverables of each service on the home page against services.html.
  guard('deliverables', () => {
    const idoc = parse(read('index.html'));
    const sdoc = parse(read('services.html'));
    const section = one(find(idoc, (t) => t.name === 'section' && t.attrs.id === 'services'), 'section#services on index.html');
    const lists = find(idoc, (t) => t.name === 'ul' && hasClass(t, 'cap__list'), section);
    if (!lists.length) throw new Error('index.html: no ul.cap__list in #services');
    const cards = find(idoc, (t) => t.name === 'div' && hasClass(t, 'cap'), section);
    if (cards.length !== lists.length) fail('deliverables', `index.html: ${cards.length} service cards in #services and ${lists.length} ul.cap__list (want one list in every card)`);
    let items = 0;
    let same = 0;
    for (const list of lists) {
      const card = one(cards.filter((c) => c.open <= list.start && list.end <= c.close), 'service cards around a ul.cap__list on index.html');
      const link = one(find(idoc, (t) => t.name === 'a' && /^services\.html#./.test(t.attrs.href || ''), card), 'links to services.html#... in a service card on index.html');
      const id = link.attrs.href.slice('services.html#'.length);
      const home = find(idoc, (t) => t.name === 'li', list).map((li) => markup(li.inner));
      const target = one(find(sdoc, (t) => t.name === 'section' && t.attrs.id === id), `section#${id} on services.html`);
      const panel = one(find(sdoc, (t) => t.name === 'div' && hasClass(t, 'panel'), target), `div.panel in section#${id} of services.html`);
      const theirs = find(sdoc, (t) => t.name === 'li', one(find(sdoc, (t) => t.name === 'ul', panel), `lists in the panel of section#${id} on services.html`)).map((li) => markup(li.inner));
      if (!home.length) fail('deliverables', `index.html: the card that links services.html#${id} lists no deliverable`);
      items += home.length;
      const n = Math.max(home.length, theirs.length);
      for (let i = 0; i < n; i++) {
        if (home[i] === theirs[i]) { same++; continue; }
        if (home[i] === undefined) fail('deliverables', `services.html#${id} delivers "${text(theirs[i])}" (item ${i + 1}), which the card on index.html does not list`);
        else if (theirs[i] === undefined) fail('deliverables', `index.html lists "${text(home[i])}" under services.html#${id} (item ${i + 1}), which services.html does not`);
        else fail('deliverables', `item ${i + 1} under services.html#${id}: index.html "${home[i]}", services.html "${theirs[i]}"`);
      }
    }
    note('deliverables', `${same} of the ${items} deliverables of the ${lists.length} service cards on index.html equal services.html, in order`);
  });

  // 3. The rates printed in the calculator against app.js.
  guard('calc', () => {
    const doc = parse(read('membership.html'));
    const app = read('app.js');
    const calc = one(find(doc, (t) => hasAttr(t, 'data-calc')), '[data-calc] blocks on membership.html');
    const PCT = /\((\d+(?:\.\d+)?)%\)/;
    const printed = [];
    for (const dt of find(doc, (t) => t.name === 'dt', calc)) {
      const label = text(dt.inner);
      const m = PCT.exec(label);
      if (!m) continue;
      const dd = doc.tags.find((t) => !t.close && t.name === 'dd' && t.start >= dt.end);
      printed.push({ label, n: m[1], key: dd ? dd.attrs['data-calc-out'] : undefined });
    }
    const shown = (text(calc.inner).match(new RegExp(PCT.source, 'g')) || []).length;
    if (shown !== printed.length) fail('calc', `membership.html: ${shown} percentages in brackets in the calculator, ${printed.length} of them in a <dt> label beside a figure`);
    let same = 0;
    for (const p of printed) {
      const name = RATES[p.key];
      if (!name) { fail('calc', `membership.html prints "${p.label}" beside data-calc-out="${p.key}", which RATES in copies.js does not name`); continue; }
      if (printed.filter((q) => q.key === p.key).length > 1) { fail('calc', `membership.html prints a rate for ${p.key} twice`); continue; }
      let value;
      try { value = constant(app, name); } catch (e) { fail('calc', e.message); continue; }
      const want = Number((value * 100).toFixed(2));
      if (Number(p.n) !== want) fail('calc', `membership.html prints "${p.label}" but app.js has ${name} = ${value}, which is ${want}%`);
      else same++;
    }
    for (const [key, name] of Object.entries(RATES)) {
      if (!printed.some((p) => p.key === key)) fail('calc', `membership.html prints no rate beside data-calc-out="${key}" (${name} in app.js)`);
    }
    note('calc', `${same} of the ${printed.length} rates printed in the calculator equal app.js (${Object.values(RATES).join(', ')})`);
  });

  // 4. The guide lists against the guides. The lists are read once, as they ship, into `shipped` (the lists part
  // below reads them too): { name in tools/site/lists.json: { src, entries, broken } }, where src is the name
  // EXCEPTIONS give the file the list is in, and broken says that some of the list could not be read, which this
  // part reports.
  const shipped = {};
  guard('guides', () => {
    const open = (name) => (shipped[name] = { src: LISTS[name], entries: [], broken: false });
    const broken = (list, msg) => { list.broken = true; fail('guides', msg); };
    const entry = (list, where, href, fields) => {
      const file = linkedFile(href);
      if (!file) { broken(list, `${list.src}, ${where}: the link "${href}" is not a root page`); return; }
      list.entries.push({ src: list.src, where, page: file, fields });
    };
    const timeFields = (doc, li, fields) => {
      for (const p of find(doc, (t) => t.name === 'p' && hasClass(t, 'read__date'), li)) one(find(doc, (t) => t.name === 'time', p), 'dates in a p.read__date');
      const times = find(doc, (t) => t.name === 'time', li);
      if (times.length > 1) throw new Error(`${times.length} dates in one entry`);
      if (times.length) { fields.datetime = times[0].attrs.datetime || ''; fields.date = text(times[0].inner); }
      return fields;
    };

    // blog.html: <li><a href>title</a><br>description</li> in the two sections.
    const blog = parse(read('blog.html'));
    for (const id of ['english', 'swedish']) {
      const list = open(`blog.html#${id}`);
      let lis;
      try { lis = find(blog, (t) => t.name === 'li', one(find(blog, (t) => t.name === 'section' && t.attrs.id === id), `section#${id} on blog.html`)); } catch (e) { broken(list, e.message); continue; }
      if (!lis.length) broken(list, `blog.html: no entry in #${id}`);
      lis.forEach((li, i) => {
        const where = `#${id} entry ${i + 1}`;
        try {
          const a = one(find(blog, (t) => t.name === 'a', li), 'links');
          const br = one(blog.tags.filter((t) => t.name === 'br' && t.start >= li.open && t.start < li.close), '<br> between the title and the description');
          if (br.start < a.end) throw new Error('the <br> comes before the link');
          entry(list, where, a.attrs.href, { title: text(a.inner), description: text(blog.src.slice(br.end, li.close)) });
        } catch (e) { broken(list, `blog.html, ${where}: ${e.message}`); }
      });
    }
    const guides = new Set([...shipped['blog.html#english'].entries, ...shipped['blog.html#swedish'].entries].map((e) => e.page));

    // index.html and sv.html: ul.reads in the section the list's name gives, <li class="read"><h3 class="read__h">
    // <a>title</a></h3> <p>description</p>, and on index.html <p class="read__date">Published <time datetime>date</time></p>.
    for (const name of ['index.html#insights', 'sv.html#guider']) {
      const list = open(name);
      const [file, id] = name.split('#');
      const doc = parse(read(file));
      let lis;
      try {
        const section = one(find(doc, (t) => t.name === 'section' && t.attrs.id === id), `section#${id} on ${file}`);
        lis = find(doc, (t) => t.name === 'li', one(find(doc, (t) => t.name === 'ul' && hasClass(t, 'reads'), section), `ul.reads in #${id} of ${file}`));
      } catch (e) { broken(list, e.message); continue; }
      if (!lis.length) broken(list, `${file}: no entry in ul.reads`);
      lis.forEach((li, i) => {
        const where = `ul.reads entry ${i + 1}`;
        try {
          if (!hasClass(li, 'read')) throw new Error('the entry is not li.read');
          const h = one(find(doc, (t) => t.name === 'h3' && hasClass(t, 'read__h'), li), 'h3.read__h');
          const a = one(find(doc, (t) => t.name === 'a', h), 'links in the h3');
          const p = one(find(doc, (t) => t.name === 'p' && !hasClass(t, 'read__date'), li), 'description paragraphs');
          entry(list, where, a.attrs.href, timeFields(doc, li, { title: text(a.inner), description: text(p.inner) }));
        } catch (e) { broken(list, `${file}, ${where}: ${e.message}`); }
      });
    }

    // llms.txt, above the generated languages: "- [title](url): description" for every line that links a guide.
    // tools/seo-head.py writes these lines from tools/site/lists.json; this reads them as they ship, on its own terms.
    const llms = read('llms.txt');
    const llmsList = open('llms.txt');
    const cut = llms.indexOf(LLMS_GENERATED);
    if (cut < 0) broken(llmsList, `llms.txt: no "${LLMS_GENERATED}" line, so the hand-written part cannot be told from the generated one`);
    else {
      llms.slice(0, cut).split('\n').forEach((line, i) => {
        if (!line.startsWith('- [')) return;
        const m = /^- \[([^\]]+)\]\(([^)\s]+)\)(?:: (.*))?$/.exec(line.replace(/\s+$/, ''));
        if (!m) { broken(llmsList, `llms.txt, line ${i + 1}: does not read as "- [title](url): description"`); return; }
        const file = linkedFile(m[2]);
        if (file && guides.has(file)) entry(llmsList, `line ${i + 1}`, m[2], { title: m[1].trim(), description: (m[3] || '').trim() });
      });
      if (!llmsList.entries.length) broken(llmsList, 'llms.txt: no "- [title](url)" line above the generated languages links a guide of blog.html');
    }

    // The ItemList of blog.html, where it ships: the name of every item in the page's structured data. tools/seo-head.py
    // writes the items from tools/site/lists.json; this reads the published JSON-LD, not the generator's input.
    const items = open('blog.html#guides');
    let els;
    try { els = itemList(read('blog.html')).itemListElement; } catch (e) { broken(items, `blog.html: ${e.message}`); }
    if (!items.broken && (!Array.isArray(els) || !els.length)) broken(items, 'blog.html: the ItemList has no itemListElement');
    else if (!items.broken) els.forEach((el, i) => {
      const it = el && el.item;
      if (!it || typeof it.url !== 'string' || typeof it.name !== 'string') { broken(items, `the ItemList of blog.html, item ${i + 1}: no item with a url and a name`); return; }
      entry(items, `position ${el.position}`, it.url, { title: it.name });
    });

    // Compare every field with its page, through the exceptions.
    const used = new Set();
    const tally = {};
    for (const e of Object.values(shipped).flatMap((l) => l.entries)) {
      const t = tally[e.src] || (tally[e.src] = { entries: 0, fields: 0, same: 0, held: 0, dates: 0 });
      t.entries++;
      const f = page(e.page);
      if (f.error) { fail('guides', `${e.src}, ${e.where}: ${f.error}`); continue; }
      const pub = (registry[e.page] || {}).pub;
      let listLang = null;
      try { if (e.src.endsWith('.html')) listLang = pageFacts(read(e.src)).lang; } catch (err) { /* the list page itself was read above */ }
      for (const [field, got] of Object.entries(e.fields)) {
        let want;
        if (field === 'title' || field === 'description') want = f[field];
        else if (field === 'datetime') want = pub;
        else if (field === 'date') want = longDate(pub, listLang);
        if (want === undefined || want === null) { fail('guides', `${e.src}, ${e.where}: no ${field} to compare for ${e.page} (no pub in the registry, or no month names for the list's language)`); continue; }
        t.fields++;
        if (field === 'datetime' || field === 'date') t.dates++;
        const ex = exceptions.find((x) => x.src === e.src && x.page === e.page && x.field === field);
        if (ex) {
          used.add(ex);
          if (got === want) fail('guides', `${e.src}, ${e.where}: the ${field} of ${e.page} now equals the page; remove its exception from copies.js`);
          else if (got !== ex.text) fail('guides', `${e.src}, ${e.where}: the ${field} of ${e.page} has moved off the text its exception in copies.js records; ${parting(got, ex.text)}. Make it equal the page and remove the exception, or record the new text`);
          else t.held++;
        } else if (got !== want) {
          fail('guides', `${e.src}, ${e.where}: the ${field} of ${e.page} differs from the page's ${field === 'title' ? '<title>' : field === 'description' ? 'meta description' : 'pub'}; ${parting(got, want)}`);
        } else t.same++;
      }
    }
    for (const x of exceptions) if (!used.has(x)) fail('guides', `the exception for the ${x.field} of ${x.page} in ${x.src} matches no entry; remove it from copies.js`);
    for (const [src, t] of Object.entries(tally)) {
      note('guides', `${src}: ${t.entries} entries, ${t.same} of their ${t.fields} fields equal the page${t.dates ? ` (${t.dates} of the fields are dates)` : ''}, ${t.held} held by a recorded exception`);
    }
  });

  // 5. The footer's shorter wording against the company sentence, and the footers of the root pages against both.
  guard('footer', () => {
    const rel = 'tools/site/company.json';
    let company;
    try { company = JSON.parse(read(rel)); } catch (e) { throw new Error(`${rel} cannot be read as JSON (${e.message.split('\n')[0]})`); }
    const { sentence, footer_sentence: footer } = company || {};
    if (typeof sentence !== 'string' || typeof footer !== 'string') throw new Error(`${rel} has no sentence or no footer_sentence, as strings`);
    const want = footerWording(sentence);
    if (want === null) fail('footer', `the sentence in ${rel} has no last sentence to leave out of the footer's wording: "${sentence}"`);
    else if (footer !== want) fail('footer', `footer_sentence in ${rel} is not its sentence without the first two words and the last sentence, the first letter then a capital; ${parting(footer, want)}`);
    const pages = Object.keys(registry);
    if (!pages.length) throw new Error('no root page to read the footer of (the registry is empty)');
    let same = 0;
    for (const f of pages) {
      const about = one(find(parse(read(f)), (t) => t.name === 'p' && hasClass(t, 'site-footer__about')), `footer about lines (p.site-footer__about) on ${f}`);
      const got = text(about.inner);
      if (got !== footer) fail('footer', `the footer of ${f} does not say footer_sentence of ${rel}; ${parting(got, footer)} (run python3 tools/seo-head.py)`);
      else same++;
    }
    note('footer', `footer_sentence is the company sentence's shorter wording, and the footers of ${same} of the ${pages.length} root pages say it`);
  });

  // 6. What each list holds, and in what order, against tools/site/lists.json.
  guard('lists', () => {
    let data;
    try { data = JSON.parse(read('tools/site/lists.json')); } catch (e) { throw new Error(`tools/site/lists.json cannot be read as JSON (${e.message})`); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('tools/site/lists.json does not hold a JSON object');
    const names = Object.keys(LISTS);
    if (Object.keys(data).join('|') !== names.join('|')) fail('lists', `tools/site/lists.json holds the lists ${Object.keys(data).join(', ') || 'none'}; want ${names.join(', ')}, in that order`);
    let entries = 0;
    let overrides = 0;
    let compared = 0;
    for (const name of names) {
      if (!Array.isArray(data[name])) { if (name in data) fail('lists', `tools/site/lists.json: ${name} is not a list`); continue; }
      const want = [];
      const over = [];
      data[name].forEach((e, i) => {
        const slug = typeof e === 'string' ? e : e && typeof e === 'object' ? e.slug : undefined;
        if (typeof slug !== 'string') { fail('lists', `tools/site/lists.json: ${name}, entry ${i + 1}, is neither a slug nor an object with a slug`); return; }
        want.push(slug + '.html');
        for (const [field, txt] of Object.entries((e && e.override) || {})) over.push({ page: slug + '.html', field, text: txt });
      });
      entries += want.length;
      overrides += over.length;
      // (a) The pages the list links, in order. A list the guides part could not read whole is left to that part.
      const got = shipped[name];
      if (got && !got.broken) {
        compared++;
        const have = got.entries.map((x) => x.page);
        const hint = WRITTEN.has(name) ? 'run python3 tools/seo-head.py, which writes it from tools/site/lists.json' : 'the list is written by hand, so make the page and tools/site/lists.json agree';
        const missing = want.filter((f) => !have.includes(f));
        const extra = have.filter((f) => !want.includes(f));
        const at = have.findIndex((f, k) => f !== want[k]);
        if (missing.length) fail('lists', `${name} lacks ${missing.join(', ')}, which tools/site/lists.json lists there; ${hint}`);
        else if (extra.length) fail('lists', `${name} holds ${extra.join(', ')}, which tools/site/lists.json does not list there; ${hint}`);
        else if (have.length !== want.length) fail('lists', `${name} holds ${have.length} entries and tools/site/lists.json ${want.length}, so a page is in one of them twice; ${hint}`);
        else if (at >= 0) fail('lists', `${name} holds its entries in another order than tools/site/lists.json: entry ${at + 1} is ${have[at]}, where the file has ${want[at]}; ${hint}`);
      }
      // (b) Each override is an exception of copies.js with the same text. On a hub list, which nothing writes yet,
      // each exception for a page the list holds is also an override, so that the file can write the list when the
      // owner allows it (step 2.4, part c). On llms.txt and the ItemList the guides part already fails when the
      // generator writes the page's text where an exception is recorded.
      for (const o of over) {
        const ex = exceptions.find((x) => x.src === LISTS[name] && x.page === o.page && x.field === o.field);
        if (!ex) fail('lists', `tools/site/lists.json: ${name} overrides the ${o.field} of ${o.page}, which no exception of copies.js records for ${LISTS[name]}; record it there with its reason, or take the override out`);
        else if (ex.text !== o.text) fail('lists', `tools/site/lists.json: ${name} overrides the ${o.field} of ${o.page} with another text than its exception in copies.js; ${parting(o.text, ex.text)}`);
      }
      if (!WRITTEN.has(name)) {
        for (const x of exceptions) {
          if (x.src === LISTS[name] && want.includes(x.page) && !over.some((o) => o.page === x.page && o.field === x.field)) fail('lists', `tools/site/lists.json: ${name} holds ${x.page} without the override of its ${x.field} that its exception in copies.js records`);
        }
      }
    }
    note('lists', `tools/site/lists.json: ${names.length} lists, ${entries} entries, ${overrides} overridden fields; ${compared} of the lists as they ship name its pages, in its order`);
  });

  return { problems, notes };
}

// A numeric constant of app.js, read by appConst in _common.js, the one reader of the constants of app.js (it
// throws, with the name and the line, on anything that is not one proven number).
function constant(src, name) {
  return appConst(name, src, 'number');
}

// --- the self-test ---------------------------------------------------------------------------------------------

// Each case changes one copy in memory, by the structure the check reads rather than by today's sentences (the
// exception rules are tested with a made-up exception instead, so the cases hold whatever EXCEPTIONS lists), and
// must make the check report a new problem in its own part and in no other. A problem is known by its part and its
// text with the place numbers left out, so that on a tree that already fails, a case that moves an entry does not
// count the tree's own problem again because it now names another entry number.
function selfTest(root, verbose = false) {
  const cache = new Map();
  const disk = (f) => { if (!cache.has(f)) cache.set(f, fs.readFileSync(path.join(root, f), 'utf8')); return cache.get(f); };
  const registry = readRegistry(root);
  const base = check(disk, { registry });
  const key = (p) => p.part + ': ' + p.msg.replace(/\b(entry|line|position|item) \d+/g, '$1 #');
  const baseKeys = new Set(base.problems.map(key));
  const at = (s, i, add) => s.slice(0, i) + add + s.slice(i);
  const first = (html, test, inTest) => {
    const doc = parse(html);
    const within = inTest ? find(doc, inTest)[0] : undefined;
    if (inTest && !within) throw new Error('the element the case changes is not there');
    const el = find(doc, test, within)[0];
    if (!el) throw new Error('the element the case changes is not there');
    return el;
  };
  // The link of the first entry of a section of blog.html (the section's lead may hold a link of its own).
  const blogLink = (s, id) => {
    const doc = parse(s);
    const section = find(doc, (t) => t.name === 'section' && t.attrs.id === id)[0];
    const li = section && find(doc, (t) => t.name === 'li', section)[0];
    const a = li && find(doc, (t) => t.name === 'a', li)[0];
    if (!a) throw new Error(`no entry in #${id} of blog.html`);
    return a;
  };
  const guide1 = () => linkedFile(blogLink(disk('blog.html'), 'english').attrs.href);
  // The first guide of blog.html whose line in llms.txt carries no exception, so a change to it must fail as such.
  const plainLlmsGuide = () => {
    const doc = parse(disk('blog.html'));
    const excepted = new Set(EXCEPTIONS.filter((x) => x.src === 'llms.txt').map((x) => x.page));
    for (const section of find(doc, (t) => t.name === 'section' && (t.attrs.id === 'english' || t.attrs.id === 'swedish'))) {
      for (const li of find(doc, (t) => t.name === 'li', section)) {
        const a = find(doc, (t) => t.name === 'a', li)[0];
        const file = a && linkedFile(a.attrs.href);
        if (file && !excepted.has(file)) return file;
      }
    }
    throw new Error('every guide of blog.html has an exception in llms.txt');
  };
  // The page of the first ItemList entry: the exception cases below record a made-up exception for its name, so
  // they do not depend on which exceptions the tree has today.
  const itemPage = () => linkedFile(itemList(disk('blog.html')).itemListElement[0].item.url);
  const madeUp = () => ({ src: 'blog.html#guides', page: itemPage(), field: 'title', text: 'A text the self-test recorded', why: 'the self-test' });
  // The ItemList of blog.html, changed as data where it ships, in the page's JSON-LD: fn takes the node and changes it.
  const editItems = (s, fn) => {
    const m = /(<script type="application\/ld\+json">)([\s\S]*?)<\/script>/.exec(s);
    if (!m) throw new Error('no JSON-LD block on blog.html');
    const j = JSON.parse(m[2]);
    const node = (j['@graph'] || []).find((n) => n['@type'] === 'ItemList' && n['@id'] === ITEMLIST);
    if (!node) throw new Error('no ItemList in the structured data of blog.html');
    fn(node);
    const from = m.index + m[1].length;
    return s.slice(0, from) + '\n' + JSON.stringify(j, null, 1) + '\n' + s.slice(from + m[2].length);
  };
  const renameItem = (s) => editItems(s, (n) => { n.itemListElement[0].item.name += ' changed'; });
  // tools/site/lists.json, changed as data: fn takes the object and changes it.
  const editLists = (s, fn) => { const j = JSON.parse(s); fn(j); return JSON.stringify(j, null, 2) + '\n'; };
  const slugOf = (e) => (typeof e === 'string' ? e : e.slug);
  const swap = (s, a, b) => s.slice(0, a.start) + s.slice(b.start, b.end) + s.slice(a.end, b.start) + s.slice(a.start, a.end) + s.slice(b.end);
  // A case that has nothing to change on this tree says so; it is not a failure, because another case covers its rule.
  const notApplicable = (why) => Object.assign(new Error(why), { notApplicable: true });
  const llmsLine = (s, file) => s.split('\n').findIndex((l) => l.startsWith('- [') && l.includes(`(${SITE}${file})`));
  const editLine = (s, i, fn) => { if (i < 0) throw new Error('the llms.txt line the case changes is not there'); const lines = s.split('\n'); lines[i] = fn(lines[i]); return lines.join('\n'); };
  // tools/site/company.json changed as data: fn takes its object and changes it.
  const editCompany = (s, fn) => { const o = JSON.parse(s); fn(o); return JSON.stringify(o, null, 2) + '\n'; };

  const cases = [
    ['faq', 'a word added to the first answer on index.html', 'index.html', (s) => at(s, first(s, (t) => t.name === 'p', (t) => hasAttr(t, 'data-faq-item')).open, 'Changed ')],
    ['faq', 'a link target changed in an answer on index.html', 'index.html', (s) => {
      const doc = parse(s);
      const a = find(doc, (t) => t.name === 'a' && hasAttr(t, 'href') && find(doc, (u) => hasAttr(u, 'data-faq-item')).some((it) => it.open <= t.start && t.start < it.close))[0];
      if (!a) throw notApplicable('no answer on index.html holds a link');
      return at(s, s.indexOf('href=', a.start) + 'href="'.length, 'x-');
    }],
    ['faq', 'a question reworded on index.html', 'index.html', (s) => at(s, first(s, (t) => t.name === 'h3', (t) => hasAttr(t, 'data-faq-item')).open, 'So, ')],
    ['faq', 'the matching answer changed on contact.html', 'contact.html', (s) => {
      const q = text(first(disk('index.html'), (t) => t.name === 'h3', (t) => hasAttr(t, 'data-faq-item')).inner);
      const doc = parse(s);
      const item = find(doc, (t) => hasAttr(t, 'data-faq-item')).find((it) => text(find(doc, (t) => t.name === 'h3', it)[0].inner) === q);
      if (!item) throw new Error('contact.html does not ask the first question of index.html');
      return at(s, find(doc, (t) => t.name === 'p', item)[0].open, 'Changed ');
    }],
    ['deliverables', 'a deliverable reworded on index.html', 'index.html', (s) => at(s, first(s, (t) => t.name === 'li', (t) => t.name === 'ul' && hasClass(t, 'cap__list')).open, 'Changed ')],
    ['deliverables', 'a service card that has lost its list on index.html', 'index.html', (s) => { const ul = first(s, (t) => t.name === 'ul' && hasClass(t, 'cap__list'), (t) => t.name === 'section' && t.attrs.id === 'services'); return s.slice(0, ul.start) + s.slice(ul.end); }],
    ['deliverables', 'a deliverable removed from services.html', 'services.html', (s) => { const li = first(s, (t) => t.name === 'li', (t) => t.name === 'div' && hasClass(t, 'panel')); return s.slice(0, li.start) + s.slice(li.end); }],
    ['deliverables', 'two deliverables swapped on services.html', 'services.html', (s) => {
      const doc = parse(s);
      const lis = find(doc, (t) => t.name === 'li', find(doc, (t) => t.name === 'div' && hasClass(t, 'panel'))[0]);
      if (lis.length < 2) throw new Error('the first panel has fewer than two deliverables');
      const [a, b] = lis;
      return s.slice(0, a.start) + s.slice(b.start, b.end) + s.slice(a.end, b.start) + s.slice(a.start, a.end) + s.slice(b.end);
    }],
    ['calc', 'a printed rate changed on membership.html', 'membership.html', (s) => {
      const dt = find(parse(s), (t) => t.name === 'dt').find((d) => /\(\d+(?:\.\d+)?%\)/.test(d.inner));
      if (!dt) throw new Error('no printed rate on membership.html');
      const inner = dt.inner.replace(/\((\d+)((?:\.\d+)?)%\)/, (m, i, d) => `(${Number(i) + 1}${d}%)`);
      return s.slice(0, dt.open) + inner + s.slice(dt.close);
    }],
    ['calc', 'a constant changed in app.js', 'app.js', (s) => { const i = s.indexOf(`var ${Object.values(RATES)[0]} = `); if (i < 0) throw new Error('no such constant'); return at(s, i + `var ${Object.values(RATES)[0]} = `.length, '0.001 + '); }],
    ['calc', 'a rate printed that RATES does not name', 'membership.html', (s) => { const dt = first(s, (t) => t.name === 'dt', (t) => hasAttr(t, 'data-calc')); return s.slice(0, dt.open) + dt.inner + ' (12%)' + s.slice(dt.close); }],
    ['guides', 'a title changed on blog.html', 'blog.html', (s) => at(s, blogLink(s, 'swedish').open, 'Ändrad ')],
    ['guides', 'a description changed on blog.html', 'blog.html', (s) => { const doc = parse(s); const li = find(doc, (t) => t.name === 'li', find(doc, (t) => t.name === 'section' && t.attrs.id === 'english')[0])[0]; const br = doc.tags.find((t) => t.name === 'br' && t.start > li.start); return at(s, br.end, 'Changed '); }],
    ['guides', 'a title changed on index.html', 'index.html', (s) => at(s, first(s, (t) => t.name === 'a', (t) => t.name === 'h3' && hasClass(t, 'read__h')).open, 'Changed ')],
    ['guides', 'a description changed on index.html', 'index.html', (s) => at(s, first(s, (t) => t.name === 'p' && !hasClass(t, 'read__date'), (t) => t.name === 'li' && hasClass(t, 'read')).open, 'Changed ')],
    ['guides', 'a datetime changed on index.html', 'index.html', (s) => { const tm = first(s, (t) => t.name === 'time', (t) => t.name === 'ul' && hasClass(t, 'reads')); const i = s.indexOf('datetime="', tm.start) + 'datetime="'.length; return s.slice(0, i) + '2000-01-01' + s.slice(i + 10); }],
    ['guides', 'a date shown changed on index.html', 'index.html', (s) => at(s, first(s, (t) => t.name === 'time', (t) => t.name === 'ul' && hasClass(t, 'reads')).open, '1')],
    ['guides', 'a description changed on sv.html', 'sv.html', (s) => at(s, first(s, (t) => t.name === 'p', (t) => t.name === 'li' && hasClass(t, 'read')).open, 'Ändrad ')],
    ['guides', 'a guide line changed in llms.txt', 'llms.txt', (s) => editLine(s, llmsLine(s, plainLlmsGuide()), (l) => l + ' Changed')],
    ['guides', 'a guide line that does not parse in llms.txt', 'llms.txt', (s) => editLine(s, llmsLine(s, guide1()), (l) => l.replace('](', '] ('))],
    ['guides', 'ul.reads outside the section its list is named after on index.html', 'index.html', (s) => {
      const id = Object.keys(LISTS).find((n) => n.startsWith('index.html#')).split('#')[1];
      const section = first(s, (t) => t.name === 'section' && t.attrs.id === id);
      const i = s.indexOf(`id="${id}"`, section.start);
      return s.slice(0, i) + `id="${id}-renamed"` + s.slice(i + `id="${id}"`.length);
    }],
    ['guides', 'llms.txt with no line read as a link', 'llms.txt', (s) => { const cut = s.indexOf(LLMS_GENERATED); if (cut < 0) throw new Error('no generated block in llms.txt'); return s.slice(0, cut).replace(/^- \[/gm, '* [') + s.slice(cut); }],
    ['guides', 'a name changed in the ItemList of blog.html', 'blog.html', renameItem],
    ['guides', 'a guide\'s own <title> changed', guide1, (s) => at(s, first(s, (t) => t.name === 'title').open, 'Changed ')],
    ['guides', 'a guide\'s own meta description changed', guide1, (s) => { const i = s.search(/<meta name="description" content="/); if (i < 0) throw new Error('no meta description'); return at(s, i + '<meta name="description" content="'.length, 'Changed '); }],
    ['guides', 'a copy moved off the text its exception records', 'blog.html', renameItem, () => [madeUp(), ...EXCEPTIONS]],
    ['guides', 'a copy that equals its page while an exception names it, so the exception is stale', null, null, () => [madeUp(), ...EXCEPTIONS]],
    ['guides', 'an exception that names no entry', null, null, () => [...EXCEPTIONS, { src: 'blog.html', page: 'no-such-guide.html', field: 'title', text: '', why: 'the self-test' }]],
    ['footer', 'a word added to the company sentence and not to footer_sentence', 'tools/site/company.json', (s) => editCompany(s, (o) => { o.sentence = o.sentence.replace(/^(\S+ \S+ )/, '$1very '); })],
    ['footer', 'a word added to footer_sentence and not to the company sentence', 'tools/site/company.json', (s) => editCompany(s, (o) => { o.footer_sentence = o.footer_sentence.replace(/^(\S+ )/, '$1very '); })],
    ['footer', 'footer_sentence that keeps the last sentence', 'tools/site/company.json', (s) => editCompany(s, (o) => { const rest = o.sentence.split(' ').slice(2).join(' '); o.footer_sentence = rest.charAt(0).toUpperCase() + rest.slice(1); })],
    ['footer', 'footer_sentence that keeps the small first letter', 'tools/site/company.json', (s) => editCompany(s, (o) => { o.footer_sentence = o.footer_sentence.charAt(0).toLowerCase() + o.footer_sentence.slice(1); })],
    ['footer', 'the footer of about.html with a word added', 'about.html', (s) => at(s, first(s, (t) => t.name === 'p' && hasClass(t, 'site-footer__about')).open, 'Changed ')],
    ['lists', 'two entries swapped in #english on blog.html', 'blog.html', (s) => {
      const doc = parse(s);
      const lis = find(doc, (t) => t.name === 'li', find(doc, (t) => t.name === 'section' && t.attrs.id === 'english')[0]);
      if (lis.length < 2) throw new Error('#english on blog.html has fewer than two entries');
      return swap(s, lis[0], lis[1]);
    }],
    ['lists', 'an entry taken out of ul.reads on sv.html', 'sv.html', (s) => { const li = first(s, (t) => t.name === 'li' && hasClass(t, 'read'), (t) => t.name === 'ul' && hasClass(t, 'reads')); return s.slice(0, li.start) + s.slice(li.end); }],
    ['lists', 'two guide lines swapped in llms.txt', 'llms.txt', (s) => {
      const lines = s.split('\n');
      const i = llmsLine(s, guide1());
      if (i < 0 || !/^- \[/.test(lines[i + 1] || '')) throw new Error('the guide line of the first guide of blog.html is not followed by another line of the list');
      [lines[i], lines[i + 1]] = [lines[i + 1], lines[i]];
      return lines.join('\n');
    }],
    ['lists', 'two items swapped in the ItemList of blog.html', 'blog.html', (s) => editItems(s, (n) => {
      const e = n.itemListElement;
      if (e.length < 2) throw new Error('the ItemList has fewer than two items');
      [e[0].item, e[1].item] = [e[1].item, e[0].item];
    })],
    ['lists', 'a page added to a list of tools/site/lists.json', 'tools/site/lists.json', (s) => editLists(s, (j) => {
      const name = Object.keys(LISTS)[0];
      const have = new Set(j[name].map(slugOf));
      const other = Object.values(j).flat().map(slugOf).find((x) => !have.has(x));
      if (!other) throw new Error(`every page of the file is in ${name} already`);
      j[name].push(other);
    })],
    ['lists', 'an override changed in tools/site/lists.json', 'tools/site/lists.json', (s) => editLists(s, (j) => {
      const e = Object.values(j).flat().find((x) => x && typeof x === 'object' && x.override);
      if (!e) throw notApplicable('tools/site/lists.json has no override');
      const k = Object.keys(e.override)[0];
      e.override[k] += ' changed';
    })],
    ['lists', 'an override taken out of a hub list of tools/site/lists.json', 'tools/site/lists.json', (s) => editLists(s, (j) => {
      for (const name of Object.keys(LISTS).filter((n) => !WRITTEN.has(n))) {
        const i = j[name].findIndex((x) => x && typeof x === 'object' && x.override);
        if (i >= 0) { j[name][i] = j[name][i].slug; return; }
      }
      throw notApplicable('no hub list of tools/site/lists.json has an override');
    })],
    ['lists', 'a list of tools/site/lists.json under a name it does not know', 'tools/site/lists.json', (s) => editLists(s, (j) => { j['blog.html#other'] = []; })],
  ];

  let bad = 0;
  let skipped = 0;
  // A case is [part, name, file or a function that names it, the change, the exceptions or a function giving them].
  for (const [part, name, fileOf, edit, exceptionsOf] of cases) {
    const overlay = {};
    let exceptions;
    try {
      exceptions = typeof exceptionsOf === 'function' ? exceptionsOf() : exceptionsOf;
      if (edit) {
        const file = typeof fileOf === 'function' ? fileOf() : fileOf;
        const before = disk(file);
        const after = edit(before);
        if (after === before) throw new Error('the case changed nothing');
        overlay[file] = after;
      }
    } catch (e) {
      if (e.notApplicable) { skipped++; console.log(`ok   self-test, ${part}, ${name}: not applicable on this tree (${e.message})`); continue; }
      bad++;
      console.log(`FAIL self-test, ${part}, ${name}: the case cannot be set up (${e.message})`);
      continue;
    }
    const read = (f) => (f in overlay ? overlay[f] : disk(f));
    const got = check(read, { registry, exceptions }).problems.filter((p) => !baseKeys.has(key(p)));
    const parts = [...new Set(got.map((p) => p.part))];
    if (!got.length) { bad++; console.log(`FAIL self-test, ${part}, ${name}: the check did not notice`); }
    else if (parts.length !== 1 || parts[0] !== part) { bad++; console.log(`FAIL self-test, ${part}, ${name}: reported in ${parts.join(', ')}: ${got.map((p) => p.msg).join(' | ')}`); }
    else if (verbose) console.log(`ok   self-test, ${part}, ${name}: ${got[0].msg}${got.length > 1 ? ` (and ${got.length - 1} more)` : ''}`);
  }
  if (!bad) console.log(`ok   self-test: ${cases.length - skipped} changed copies, each caught by its own part${skipped ? `; ${skipped} not applicable` : ''}`);
  return bad;
}

if (require.main === module) {
  const arg = process.argv.indexOf('--root');
  const root = arg > 0 ? path.resolve(process.argv[arg + 1] || '.') : ROOT;
  const only = process.argv.includes('--self-test');
  let bad = selfTest(root, process.argv.includes('--verbose'));
  if (!only) {
    console.log(scopeLine('root', [], { what: 'the root pages that hold the copies (each part names its own), with llms.txt, tools/seo/blog.json and app.js' }));
    const { problems, notes } = check((f) => fs.readFileSync(path.join(root, f), 'utf8'), { registry: readRegistry(root) });
    for (const n of notes) console.log(`ok   ${n.part}: ${n.msg}`);
    for (const p of problems) console.log(`FAIL ${p.part}: ${p.msg}`);
    bad += problems.length;
  }
  const what = only ? 'the self-test of copies.js' : 'the copies';
  console.log(bad ? `\nFAIL: ${bad} problem(s), ${what}` : `\nPASS: ${what}`);
  process.exit(bad ? 1 : 0);
}
module.exports = { check, constant, linkedFile, longDate, EXCEPTIONS, RATES };
