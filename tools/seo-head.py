#!/usr/bin/env python3
"""Rewrites the generated parts of every page from one registry, so every page agrees
with the others and with sitemap.xml. Python 3, standard library only; run it from anywhere:

    python3 tools/seo-head.py [page.html ...]      (no arguments: every page in PAGES)

What it rewrites, on every page it is given:
- the search and sharing block in <head>, between <!-- seo --> and <!-- /seo -->: canonical,
  hreflang, the robots meta, Open Graph with article:published_time and article:modified_time,
  twitter:card with twitter:title and twitter:description (the same strings as og:title and
  og:description), and the JSON-LD graph (the Organization node, identical on every page; the
  WebSite node; the page node with datePublished and dateModified; a FAQPage node built from the
  page's visible FAQ, [data-faq] and [data-faq-item]; an Article node for the guides; and the
  page's extra nodes from tools/seo/<page>.json, when that file exists, with the items of the
  ItemList of blog.html built from tools/site/lists.json, LISTS below);
- the footer, from tools/templates/footer.html and the company's facts in tools/site/company.json (a
  footer change is made there, then this is run; it is not edited in every file);
- the site header, from tools/templates/header.html (a nav change is made there, then this is run); it stays
  English, with lang="en", on the Swedish pages;
- sitemap.xml, from the registry's mod dates and language versions;
- the guide lines of llms.txt, one "- [title](url): description" line per guide, from tools/site/lists.json
  (LISTS below); the other lines of the file are written by hand;
- the generated languages (LANGS below: Spanish, French, German, Japanese, Arabic): every English page except
  the notices, rebuilt in <code>/ from the catalogue tools/i18n/<code>.json by tools/i18n.py, with
  its own head block, translated header and footer and the language list; tools/i18n/messages.json,
  the list of every message to translate; the draft languages' lines in _config.yml exclude; and,
  for a live generated language, its block in llms.txt. Never edit a page in a language folder.

What it never touches: anything inside <main>, the <title> and the meta description (the page
is the source of truth for both; the block repeats them), and the ?v= stamps on the stylesheets
and app.js. The one exception is a page whose registry status is 'withdrawn': the whole page
body, title and description are replaced by the stub of tools/templates/stub.html (see TAKEDOWN.md),
because on GitHub Pages a withdrawn URL has to keep answering and must stop serving its old text.

    python3 tools/seo-head.py --check     reports (and exits 1 on) any generated part that differs
                                          from what a run would write, without writing anything

When to run it: after editing a FAQ (the FAQPage data must repeat the visible answers word for
word), after moving a page's `mod` date in its row because its content changed (`pub`, the date the
page first went live, never moves), after changing a template in tools/templates or a fact in
tools/site/company.json, and after changing a guide's title or description or a list in
tools/site/lists.json (llms.txt and the ItemList repeat them). It is idempotent: on an unchanged tree it
changes nothing. If styles or scripts changed as well, run `npm run stamp` in tools/ afterwards; the stamps
are not this script's business, and `npm run check` fails until they are current (stamp.js stamps the
language folders with the root pages, so the two agree).
After editing an English page, `python3 tools/i18n.py` lists what the catalogues now lack.
"""
import json, os, re, sys, html
from html.parser import HTMLParser
from string import Template

EXEC = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, EXEC)
import i18n                      # tools/i18n.py: the translation engine for the generated languages
REPO = os.path.dirname(EXEC)
SEO_DIR = os.path.join(EXEC, 'seo')
SITE = 'https://vynatix.com/'

ORG_ID = SITE + '#organization'
WEBSITE_ID = SITE + '#website'

# ---------------------------------------------------------------- registry
# Every page written by hand has one row, the file tools/site/pages/<slug>.json (the row of about.html is
# about.json): a JSON object with the keys below, in this order, and only the ones the page needs, because a key
# left out takes its default.
# lang: the page language. type: the schema.org page type. og: website|article.
# pub: datePublished, the date the page first went live (first commit for the original nine);
#      it never moves. mod: dateModified; move it when the page's content changes, then run this.
# alt: the twin in the other language (hreflang). article: the page also carries an Article node.
# original: which page of an alt pair is the original and which the translation (translationOfWork /
#      workTranslation). Default: the English page is the original. Give true on a Swedish original
#      and false on its English twin; exactly one page of each pair must be the original.
# kind: "post" marks a guide or blog post written after the blog was added (the visible-date check
#      of tools/verify/permanence.js applies to these; the older guides are not marked).
# status: "live" (default) or "withdrawn". A withdrawn page keeps its URL but is replaced by a short
#      stub, carries noindex and no hreflang, and is left out of sitemap.xml (and so of llms.txt).
# order: the page's place in sitemap.xml. The 34 pages registered before the rows became files carry 1 to 34,
#      the order of the table they came from; a new page needs none and comes after them, by pub and then by
#      slug, so two branches that each add a page cannot tie unseen.
# note: a remark for the person who reads the row, where a comment beside it would go; nothing reads it.
# load_pages() reads the rows into PAGES, in that order, which is the order of sitemap.xml, and refuses an
# unknown key or a value of the wrong type; tools/verify/_common.js reads the same files.
SITE_DATA = os.path.join(EXEC, 'site')
PAGE_KEYS = ('lang', 'type', 'og', 'pub', 'mod', 'alt', 'article', 'original', 'kind', 'status', 'order', 'note')
LANG_KEYS = ('name', 'tag', 'locale', 'dir', 'kind', 'home', 'status', 'checked', 'by', 'waived', 'pub', 'mod', 'note')

def load_json(path):
    """The JSON object in a data file of tools/site/. A file that cannot be read, is not JSON, is not an object or
    names a key twice (as a merge that kept both sides of a line would) stops the run, naming the file."""
    rel = os.path.relpath(path, REPO)
    def once(pairs):
        keys = [k for k, _ in pairs]
        twice = sorted({k for k in keys if keys.count(k) > 1})
        if twice:
            raise SystemExit(f'{rel}: {twice[0]} is given twice')
        return dict(pairs)
    try:
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh, object_pairs_hook=once)
    except OSError as e:
        raise SystemExit(f'{rel}: cannot be read ({e.strerror})')
    except ValueError as e:
        raise SystemExit(f'{rel}: is not JSON ({e})')
    if not isinstance(data, dict):
        raise SystemExit(f'{rel}: holds a JSON {type(data).__name__}, not an object')
    return data

def load_pages():
    """PAGES from tools/site/pages/: {'file.html': row}, the rows with an order by it, then the others by pub and
    then by slug. Each key and its type is checked here; order and note stay in the files, so a row of PAGES holds
    the page's own keys only."""
    folder = os.path.join(SITE_DATA, 'pages')
    try:
        names = sorted(os.listdir(folder))
    except OSError as e:
        raise SystemExit(f'tools/site/pages: cannot be read ({e.strerror}); it holds one JSON file per page')
    types = dict(alt=dict, article=bool, original=bool, order=int)
    rows = []
    for name in names:
        rel = f'tools/site/pages/{name}'
        if not re.fullmatch(r'[^./][^/]*\.json', name):
            raise SystemExit(f'{rel}: only rows belong in tools/site/pages, one <slug>.json per page')
        row = load_json(os.path.join(folder, name))
        unknown = sorted(set(row) - set(PAGE_KEYS))
        if unknown:
            raise SystemExit(f'{rel}: unknown registry key {unknown} (known: {list(PAGE_KEYS)})')
        for k, v in row.items():
            want = types.get(k, str)
            if not isinstance(v, want) or (want is int and (isinstance(v, bool) or v < 1)):
                raise SystemExit(f'{rel}: {k} is {json.dumps(v, ensure_ascii=False)}, which is not '
                                 + {str: 'a string', bool: 'true or false', int: 'a whole number from 1'}.get(want, 'an object'))
        if not all(isinstance(a, str) and isinstance(b, str) for a, b in row.get('alt', {}).items()):
            raise SystemExit(f'{rel}: alt maps a language to a page, {{"sv": "sv.html"}}')
        rows.append((name[:-len('.json')], row))
    placed = {}
    for slug, row in rows:
        if 'order' in row and placed.setdefault(row['order'], slug) != slug:
            raise SystemExit(f"tools/site/pages/{placed[row['order']]}.json and {slug}.json have the same order, "
                             f"{row['order']}; a new page needs none")
    rows.sort(key=lambda r: (0, r[1]['order'], '', '') if 'order' in r[1] else (1, 0, r[1].get('pub', ''), r[0]))
    return {slug + '.html': {k: v for k, v in row.items() if k not in ('order', 'note')} for slug, row in rows}

def load_langs():
    """LANGS from tools/site/langs.json, in the file's order. Each key is checked, and every value is a string;
    note stays in the file."""
    langs = load_json(os.path.join(SITE_DATA, 'langs.json'))
    for k, l in langs.items():
        if not isinstance(l, dict):
            raise SystemExit(f'tools/site/langs.json: {k} is not an object')
        unknown = sorted(set(l) - set(LANG_KEYS))
        if unknown:
            raise SystemExit(f'tools/site/langs.json: {k} has an unknown key {unknown} (known: {list(LANG_KEYS)})')
        not_text = [a for a, b in l.items() if not isinstance(b, str)]
        if not_text:
            raise SystemExit(f'tools/site/langs.json: {k}: {not_text[0]} is not a string')
    return {k: {a: b for a, b in l.items() if a != 'note'} for k, l in langs.items()}

PAGES = load_pages()
for f, p in PAGES.items():
    p.setdefault('alt', {}); p.setdefault('article', False); p.setdefault('status', 'live')
assert all('pub' in p and 'mod' in p for p in PAGES.values())
KEYS = {'lang', 'type', 'og', 'pub', 'mod', 'alt', 'article', 'original', 'kind', 'status'}
for f, p in PAGES.items():
    assert set(p) <= KEYS, f'{f}: unknown registry key {sorted(set(p) - KEYS)} (known: {sorted(KEYS)})'
    assert p['status'] in ('live', 'withdrawn'), f'{f}: status is live or withdrawn'
    assert p.get('kind') in (None, 'post'), f'{f}: kind is post, or leave it out'

def is_original(f):
    """True for the original of an alt pair (the English page unless the registry says otherwise)."""
    p = PAGES.get(f) or GEN[f]              # a generated page is never the original
    return p['original'] if 'original' in p else p['lang'] == 'en'

for f, p in PAGES.items():
    for other in p['alt'].values():
        assert other in PAGES, f'{f}: alt {other} is not in PAGES'
        assert f in PAGES[other]['alt'].values(), f'{f} names {other} as its twin, but {other} does not name {f} back'
        assert is_original(f) != is_original(other), (
            f'{f} and {other}: exactly one page of a pair is the original '
            f"(set original=True on the original and original=False on the translation)")
        assert not (p['status'] == 'live' and PAGES[other]['status'] == 'withdrawn'), (
            f'{f}: alt {other} is withdrawn; remove the alt from {f} first')

# ---------------------------------------------------------------- languages
# Every language the site is in, in the order the language list shows them: tools/site/langs.json, one entry per
# language code, each a JSON object of strings with the keys below, in this order. load_langs() above reads it.
# name: the language's own name. tag: the value of lang and hreflang. locale: og:locale. dir: ltr or rtl.
# kind: "written" (pages written by hand and registered in PAGES above: English and Swedish) or
#       "generated" (every English page except UNTRANSLATED, rebuilt in the folder <code>/ from the
#       catalogue tools/i18n/<code>.json by tools/i18n.py; never edit a generated page).
# home: a written language's home page, which the language list links to.
# A generated language also has:
# status: "draft" or "live". A draft is built and checked but not published: its folder is named in
#       _config.yml exclude (this script keeps that list), its pages carry noindex and no hreflang, no
#       other page links to it, and it has no row in sitemap.xml, llms.txt or tools/urls.lock. "live"
#       publishes it, and its URLs are then permanent like every other; a live language never goes
#       back to draft. The brand voice requires a native reader's check first, so "live" needs:
# checked, by: the date of that check and who made it (a name or a role); or
# waived: the date the owner decided to publish the language without that check. It says the check has
#       NOT been made. Never write a date in `checked` for a check nobody made; when a reader has been
#       through the language, fill in checked and by and leave waived as the record of what came first.
# pub: the day the language goes live (set it on that day); mod: move it when its catalogue changes.
# note: a remark for the person who reads the entry; nothing reads it.
LANGS = load_langs()
# The notices are legal text and are not translated: the English text governs, and a generated page
# links to it and says so (hreflang="en").
UNTRANSLATED = ('privacy.html', 'terms.html', 'accessibility.html')
GENERATED = [k for k, l in LANGS.items() if l['kind'] == 'generated']
for k, l in LANGS.items():
    assert re.fullmatch(r'[a-z]{2}', k), f'{k}: a language code is two letters (it is also the folder name)'
    assert l['kind'] in ('written', 'generated') and l['dir'] in ('ltr', 'rtl'), f'{k}: kind or dir'
    if l['kind'] == 'generated':
        assert l['status'] in ('draft', 'live'), f'{k}: status is draft or live'
        assert all(re.fullmatch(r'\d{4}-\d{2}-\d{2}', l[d]) for d in ('pub', 'mod')), f'{k}: pub and mod are dates'
        assert l['status'] == 'draft' or (re.fullmatch(r'\d{4}-\d{2}-\d{2}', l['checked']) and l['by'].strip()) or re.fullmatch(r'\d{4}-\d{2}-\d{2}', l.get('waived', '')), (
            f"{k}: a language goes live only after a native reader's check (set checked to its date and by to who made it), "
            f"or on the owner's decision to publish without one (set waived to the date of that decision)")
for p in PAGES.values():
    assert LANGS.get(p['lang'], {}).get('kind') == 'written', 'PAGES holds the pages written by hand (English and Swedish) only'

def locked_urls():
    try:
        text = open(os.path.join(REPO, 'tools', 'urls.lock'), encoding='utf-8').read()
    except FileNotFoundError:
        return set()
    return {l.split()[0] for l in text.splitlines() if l.strip() and not l.startswith('#')}

def url_of(f):
    if f == 'index.html': return SITE
    return SITE + (f[:-len('index.html')] if f.endswith('/index.html') else f)

def sources(lang):
    """The English pages a generated language holds: every live one that is translated, and a
    withdrawn one whose translation has been public (its URL must keep answering, as the stub)."""
    locked = locked_urls()
    return [f for f, p in PAGES.items() if p['lang'] == 'en' and f not in UNTRANSLATED
            and (p['status'] == 'live' or url_of(f'{lang}/{f}') in locked)]

# The generated pages, 'es/services.html': the registry entry of the English page with the language's own dates.
GEN = {}
for k in GENERATED:
    for f in sources(k):
        p = PAGES[f]; l = LANGS[k]
        GEN[f'{k}/{f}'] = dict(lang=k, type=p['type'], og=p['og'], pub=max(p['pub'], l['pub']), mod=max(p['mod'], l['mod']),
                               alt={}, article=p['article'], status=p['status'], original=False, src=f)
ALL = {**PAGES, **GEN}
for k in GENERATED:
    if LANGS[k]['status'] == 'draft':
        was = sorted(u for u in locked_urls() if u.startswith(SITE + k + '/'))
        assert not was, f'{k}: {was[0]} has been public, so the language stays live (withdraw a page instead)'

def is_public(f):
    """False for a withdrawn page and for a page of a language still in draft."""
    p = ALL[f]
    return p['status'] == 'live' and LANGS[p['lang']].get('status', 'live') == 'live'

def english_of(f):
    p = ALL[f]
    return p.get('src') or (f if p['lang'] == 'en' else p['alt'].get('en'))

def cluster(f, drafts=False):
    """{language: page} of every version of a page, itself included, in the order of LANGS:
    the hand-written twins and the generated translations (the live ones; with drafts, all)."""
    p = ALL[f]; en = english_of(f)
    v = {p['lang']: f}
    v.update(PAGES[en]['alt'] if en else p['alt'])
    if en:
        v['en'] = en
        if PAGES[en]['status'] == 'live':
            for k in GENERATED:
                if f'{k}/{en}' in GEN and (drafts or LANGS[k]['status'] == 'live'):
                    v[k] = f'{k}/{en}'
    return {k: v[k] for k in LANGS if k in v}

# ---------------------------------------------------------------- templates and the company's facts
# The header, the footer and the stub of a withdrawn page are HTML files in tools/templates/, and the company's facts
# are tools/site/company.json. A template file holds named fragments, each a <template id="name"> element whose
# lines between the opening and the closing tag are the fragment. Around them stand comments and, in stub.html, the
# stub's words, one <dl lang="xx"> list per language written by hand. A fragment names what varies as ${name}
# (string.Template; a dollar sign is written $$). read_template() refuses a file that holds anything else, and
# fragment() a name the fragment may not use, a name it must use once and does not, $name without braces and a
# stray $, each naming the file, so a merge that left both sides stops the run instead of reaching a page.
TEMPLATE_DIR = os.path.join(EXEC, 'templates')
TEMPLATE_TOKEN = re.compile(r'\s+|<!--.*?-->|<template id="([a-z][a-z-]*)">\n(.*?)\n</template>(?=\n|\Z)'
                            r'|<dl lang="([a-z]{2})">(.*?)</dl>', re.S)
WORD_TOKEN = re.compile(r'\s+|<dt>([a-z][a-z0-9]*)</dt>\s*<dd>(.*?)</dd>', re.S)
COMPANY_KEYS = ('name', 'legal_name', 'sentence', 'footer_sentence', 'slogan', 'founded', 'founded_in', 'group',
                'group_url', 'org_number', 'street', 'postal_code', 'city', 'country', 'email', 'telephone',
                'telephone_shown', 'contact_type', 'knows_about', 'same_as', 'note')
_TEMPLATES = {}

def read_template(name):
    """The fragments and the word lists of tools/templates/<name>, read once: ({id: text}, {lang: {key: text}})."""
    if name in _TEMPLATES:
        return _TEMPLATES[name]
    rel = f'tools/templates/{name}'
    try:
        with open(os.path.join(TEMPLATE_DIR, name), encoding='utf-8') as fh:
            text = fh.read()
    except OSError as e:
        raise SystemExit(f'{rel}: cannot be read ({e.strerror})')
    where = lambda at: f'{rel}, line {text.count(chr(10), 0, at) + 1}'
    parts, words, i = {}, {}, 0
    while i < len(text):
        m = TEMPLATE_TOKEN.match(text, i)
        if not m:
            raise SystemExit(f'{where(i)}: neither a comment, a <template id="..."> nor a <dl lang="..."> '
                             f'({text[i:i + 30]!r}); a merge may have left both sides here')
        if m.group(1):
            if m.group(1) in parts:
                raise SystemExit(f'{where(i)}: a second <template id="{m.group(1)}">')
            parts[m.group(1)] = m.group(2)
        elif m.group(3):
            if m.group(3) in words:
                raise SystemExit(f'{where(i)}: a second <dl lang="{m.group(3)}">')
            body, row, j = m.group(4), {}, 0
            while j < len(body):
                w = WORD_TOKEN.match(body, j)
                if not w:
                    raise SystemExit(f'{where(m.start(4) + j)}: neither white space nor <dt>key</dt> <dd>word</dd>')
                if w.group(1):
                    if w.group(1) in row:
                        raise SystemExit(f'{where(m.start(4) + j)}: {w.group(1)} is given twice')
                    row[w.group(1)] = w.group(2)
                j = w.end()
            words[m.group(3)] = row
        i = m.end()
    _TEMPLATES[name] = (parts, words)
    return parts, words

def placeholders(text, where):
    """The names a template's text gives as ${name}, in order. A $ that names nothing, or a name without braces, stops
    the run with `where` and what is wrong."""
    found = list(Template.pattern.finditer(text))
    if any(m.group('invalid') is not None for m in found):
        raise SystemExit(f'{where} holds a $ that names nothing (a dollar sign is written $$)')
    bare = [m.group('named') for m in found if m.group('named')]
    if bare:
        raise SystemExit(f'{where} writes ${bare[0]}; write ${{{bare[0]}}}, with braces')
    return [m.group('braced') for m in found if m.group('braced')]

def fragment(name, id, values=(), names=(), once=()):
    """<template id="id"> of tools/templates/<name> as a string.Template. It may name the keys of values, whose values
    go into the page as they stand (so one it names may not hold <, >, & or a double quote), and the names given,
    which the caller fills in, and it must name each name of once exactly once."""
    rel = f'tools/templates/{name}'
    parts = read_template(name)[0]
    if id not in parts:
        raise SystemExit(f'{rel}: no <template id="{id}">')
    t = Template(parts[id])
    used = placeholders(t.template, f'{rel}: <template id="{id}">')
    allowed = sorted(set(values) | set(names) | set(once))
    for n in used:
        if n not in allowed:
            raise SystemExit(f'{rel}: <template id="{id}"> names ${{{n}}}, which is not one of its names '
                             f'({", ".join(allowed) or "it has none"})')
        if n in values and re.search(r'[<>&"]', values[n]):
            raise SystemExit(f'{rel}: <template id="{id}"> names ${{{n}}}, whose value {values[n]!r} holds <, >, & or a '
                             'double quote; it goes into the page as it stands, so write it without them')
    for n in once:
        if used.count(n) != 1:
            raise SystemExit(f'{rel}: <template id="{id}"> names ${{{n}}} {used.count(n)} times; it must name it once')
    return t

def load_company():
    """The company's facts from tools/site/company.json: every key of COMPANY_KEYS but note, each a string with text
    in it, except knows_about and same_as, which are lists of them. note stays in the file."""
    rel = 'tools/site/company.json'
    data = load_json(os.path.join(SITE_DATA, 'company.json'))
    unknown = sorted(set(data) - set(COMPANY_KEYS))
    if unknown:
        raise SystemExit(f'{rel}: unknown key {unknown} (known: {list(COMPANY_KEYS)})')
    missing = [k for k in COMPANY_KEYS if k not in data and k != 'note']
    if missing:
        raise SystemExit(f'{rel}: {missing[0]} is missing')
    text = lambda v: isinstance(v, str) and v.strip() != ''
    for k, v in data.items():
        lists = k in ('knows_about', 'same_as')
        if not (isinstance(v, list) and v and all(text(x) for x in v) if lists else text(v)):
            raise SystemExit(f'{rel}: {k} is {json.dumps(v, ensure_ascii=False)}, which is not '
                             + ('a list of strings' if lists else 'a string with text in it'))
    return {k: v for k, v in data.items() if k != 'note'}

# ---------------------------------------------------------------- lists
# What each list of guides holds, and in what order: tools/site/lists.json, one JSON array per list, under the
# names below, in this order. Neither can be derived (no list is in registry or pub order, and the lists differ
# from each other), so the file says it (tools/REFACTORING-PLAN.md, step 2.4, part b). An entry is a page's slug,
# "test-automation" for test-automation.html, or, where a copy differs from its page on purpose, an object:
#     {"slug": "platform-engineering", "override": {"description": ""}}
# The override gives the text the copy holds instead of the page's own <title> (without ", Vynatix") or meta
# description; "" is a description the copy leaves out. Every override is also an exception, with its reason, in
# EXCEPTIONS of tools/verify/copies.js, which compares each list with its pages and the overrides with its own
# exceptions, so a difference is recorded twice on purpose: once to write it and once to check it.
# 'written' says what this script does with the list:
# - llms.txt: writes it, the guide lines of llms.txt, "- [title](url): description" (llms_guides below).
# - blog.html#guides: writes it, the items of the ItemList of blog.html, the node with that @id in
#   tools/seo/blog.json, which holds the rest of the node (item_list below). Both of these list guides only, pages
#   whose row has "article": true, because an item names the page's Article node.
# - the other four are the lists on the hub pages, inside <main>, which this script never writes: the sections
#   #english and #swedish of blog.html and ul.reads in #insights of index.html and #guider of sv.html. Their entries
#   are written by hand until the owner allows step 2.4, part c; the file holds their order so that a later step
#   can write them, and copies.js holds the pages to it meanwhile.
# A slug that is not a page, a page given twice in one list and a withdrawn page stop the run, so a withdrawal
# (tools/TAKEDOWN.md, step 3) takes the page out of every list here, and that takes it out of llms.txt and the
# ItemList on the next run.
LISTS = {
    'blog.html#english': dict(written=False, fields=('title', 'description')),
    'blog.html#swedish': dict(written=False, fields=('title', 'description')),
    'index.html#insights': dict(written=False, fields=('title', 'description')),
    'sv.html#guider': dict(written=False, fields=('title', 'description')),
    'blog.html#guides': dict(written=True, fields=('title',)),
    'llms.txt': dict(written=True, fields=('title', 'description')),
}
BRAND = ', Vynatix'            # the suffix of every <title>, which a list entry leaves out

def load_lists():
    """{list name: [(page file, override)]} from tools/site/lists.json, every name of LISTS, in the file's order of
    each list. Each entry is checked against the registry here; what the pages show is the checks' business."""
    rel = 'tools/site/lists.json'
    data = load_json(os.path.join(SITE_DATA, 'lists.json'))
    names = list(data)
    if names != list(LISTS):
        unknown = [n for n in names if n not in LISTS]
        missing = [n for n in LISTS if n not in names]
        raise SystemExit(f'{rel}: ' + (f'unknown list {unknown[0]}' if unknown else f'no list {missing[0]}' if missing else
                                       'the lists are out of order') + f' (it holds {", ".join(LISTS)}, in that order)')
    out = {}
    for name, entries in data.items():
        if not isinstance(entries, list):
            raise SystemExit(f'{rel}: {name} is not a list of slugs')
        rows = []
        for i, e in enumerate(entries, 1):
            where = f'{rel}: {name}, entry {i}'
            if isinstance(e, dict):
                if set(e) - {'slug', 'override', 'note'} or 'slug' not in e:
                    raise SystemExit(f'{where}: an entry is a slug, or an object with "slug", "override" and "note"')
                slug, override = e['slug'], e.get('override', {})
            else:
                slug, override = e, {}
            if not isinstance(slug, str) or not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', slug):
                raise SystemExit(f'{where}: {json.dumps(slug, ensure_ascii=False)} is not a slug ("test-automation" for test-automation.html)')
            f = slug + '.html'
            if isinstance(e, dict) and 'override' in e and (not isinstance(override, dict) or not override or any(
                    k not in LISTS[name]['fields'] or not isinstance(v, str) for k, v in override.items())):
                raise SystemExit(f'{where}: the override of {slug} gives {" or ".join(LISTS[name]["fields"])} as a string, at least one')
            if f not in PAGES:
                raise SystemExit(f'{where}: {slug} is not a page (no tools/site/pages/{slug}.json)')
            if any(f == g for g, _ in rows):
                raise SystemExit(f'{where}: {slug} is in {name} twice')
            if PAGES[f]['status'] != 'live':
                raise SystemExit(f'{where}: {f} is withdrawn; take it out of every list of {rel} (tools/TAKEDOWN.md, step 3): '
                                 + ', '.join(n for n, es in data.items() if slug in [x['slug'] if isinstance(x, dict) else x for x in es]))
            if LISTS[name]['written'] and not PAGES[f]['article']:
                raise SystemExit(f'{where}: {f} is not a guide (its row has no "article": true), and {name} lists guides only')
            rows.append((f, override))
        out[name] = rows
    return out

LIST = load_lists()

def guide_facts(f):
    """A page's <title> without ", Vynatix" and its meta description, as a list repeats them: entities decoded, white
    space run together. A title without the suffix stops the run, because a list could not tell what to leave out."""
    s = read(f)
    title = re.sub(r'\s+', ' ', html.unescape(re.search(r'<title>(.*?)</title>', s, re.S).group(1))).strip()
    desc = re.sub(r'\s+', ' ', html.unescape(re.search(r'<meta name="description" content="([^"]*)">', s).group(1))).strip()
    if not title.endswith(BRAND):
        raise SystemExit(f'{f}: its <title> "{title}" does not end in "{BRAND}", which the lists of tools/site/lists.json leave out')
    return title[:-len(BRAND)], desc

def item_list(node, name):
    """The ItemList node of tools/seo/blog.json with its items: numberOfItems and itemListElement, from the list
    `name` of tools/site/lists.json, after the keys the file gives."""
    if 'numberOfItems' in node or 'itemListElement' in node:
        raise SystemExit(f'tools/seo/blog.json: the ItemList {node["@id"]} gives its own items, which the list {name} of '
                         'tools/site/lists.json holds now; a branch opened before the move runs tools/migrate/lists.py')
    items = []
    for i, (f, override) in enumerate(LIST[name], 1):
        title = override.get('title', guide_facts(f)[0])
        items.append({"@type": "ListItem", "position": i,
                      "item": {"@type": "Article", "@id": url_of(f) + "#article", "url": url_of(f), "name": title,
                               "inLanguage": LANGS[PAGES[f]['lang']]['tag']}})
    return {**node, "numberOfItems": len(items), "itemListElement": items}

# ---------------------------------------------------------------- shared nodes
# The company's facts, tools/site/company.json: the Organization node is built from them, and the footer names the
# ones it shows (tools/templates/footer.html).
COMPANY = load_company()

ORGANIZATION = {
  "@type": "Organization",
  "@id": ORG_ID,
  "name": COMPANY['name'],
  "legalName": COMPANY['legal_name'],
  "alternateName": COMPANY['legal_name'],
  "url": SITE,
  "logo": {"@type": "ImageObject", "url": SITE + "assets/icon-512.png", "width": 512, "height": 512},
  "description": COMPANY['sentence'],
  "slogan": COMPANY['slogan'],
  "foundingDate": COMPANY['founded'],
  "foundingLocation": {"@type": "Place", "name": COMPANY['founded_in']},
  "memberOf": {"@type": "Organization", "name": COMPANY['group'], "url": COMPANY['group_url']},
  "identifier": {"@type": "PropertyValue", "propertyID": "Swedish organisationsnummer", "value": COMPANY['org_number']},
  "address": {"@type": "PostalAddress", "streetAddress": COMPANY['street'], "postalCode": COMPANY['postal_code'],
              "addressLocality": COMPANY['city'], "addressCountry": COMPANY['country']},
  "email": COMPANY['email'],
  "telephone": COMPANY['telephone'],
  "contactPoint": {"@type": "ContactPoint", "contactType": COMPANY['contact_type'],
                   "email": COMPANY['email'], "telephone": COMPANY['telephone']},
  "knowsAbout": COMPANY['knows_about'],
  "sameAs": COMPANY['same_as'],
}
WEBSITE = {"@type": "WebSite", "@id": WEBSITE_ID, "url": SITE, "name": COMPANY['name'],
           "inLanguage": [l['tag'] for l in LANGS.values() if l.get('status', 'live') == 'live'], "publisher": {"@id": ORG_ID}}

# ---------------------------------------------------------------- parsing helpers
VOID = ('br', 'img', 'input', 'meta', 'link', 'source', 'use', 'path', 'hr')
class FaqParser(HTMLParser):
    """[data-faq-item]: the first h3 is the question; p and li elements, in document order, are the
    answer (an li inside an ol is prefixed "1. ", "2. " so the order survives in the text).
    frag is the id of the nearest ancestor-or-self of [data-faq] that has one (the FAQPage @id)."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []; self.stack = []; self.ids = []; self.cur = None; self.cap = None; self.lists = []; self.frag = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in VOID: return
        self.stack.append((tag, 'data-faq-item' in a)); self.ids.append(a.get('id'))
        if 'data-faq' in a:
            self.frag = next((i for i in reversed(self.ids) if i), None)
        if 'data-faq-item' in a:
            self.cur = {'q': '', 'a': []}
        elif self.cur is not None and tag == 'h3' and not self.cur['q']:
            self.cap = ('q', len(self.stack), ''); self.buf = ''
        elif self.cur is not None and tag == 'p':
            self.cap = ('a', len(self.stack), ''); self.buf = ''
        elif self.cur is not None and tag in ('ol', 'ul'):
            self.lists.append([tag, 0])
        elif self.cur is not None and tag == 'li':
            prefix = ''
            if self.lists and self.lists[-1][0] == 'ol':
                self.lists[-1][1] += 1; prefix = f"{self.lists[-1][1]}. "
            self.cap = ('a', len(self.stack), prefix); self.buf = ''
    def handle_endtag(self, tag):
        if tag in VOID: return
        if not self.stack: return
        depth = len(self.stack)
        if self.cap and self.cap[1] == depth:
            text = re.sub(r'\s+', ' ', self.buf).strip()
            if self.cap[0] == 'q': self.cur['q'] = text
            else: self.cur['a'].append(self.cap[2] + text)
            self.cap = None
        t, is_item = self.stack.pop(); self.ids.pop()
        if t in ('ol', 'ul') and self.lists: self.lists.pop()
        if is_item and self.cur is not None:
            self.items.append((self.cur['q'], ' '.join(self.cur['a'])))
            self.cur = None
    def handle_data(self, d):
        if self.cap: self.buf += d

def faq_items(main_html, f=''):
    p = FaqParser(); p.feed(main_html)
    items = [(q, a) for q, a in p.items if q and a]
    if items and not p.frag:
        raise SystemExit(f + ': the [data-faq] container needs an id on itself or an ancestor')
    return items, p.frag

def h1_text(main_html):
    m = re.search(r'<h1[^>]*>(.*?)</h1>', main_html, re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1)))).strip() if m else None

# ---------------------------------------------------------------- head block
def head_block(f, title, desc, main_html, extra_nodes):
    p = ALL[f]; u = url_of(f); tag = LANGS[p['lang']]['tag']
    withdrawn = p['status'] == 'withdrawn'
    public = is_public(f)                      # a page of a draft language is built, but kept out of search
    versions = cluster(f) if public else {p['lang']: f}
    lines = ['<!-- Search and sharing: the canonical address, the other-language version, Open Graph, and',
             '     structured data (a JSON-LD data block: never executed, so script-src does not apply). -->',
             f'<link rel="canonical" href="{u}">']
    if len(versions) > 1:
        for lang, other in versions.items():
            lines.append(f'<link rel="alternate" hreflang="{LANGS[lang]["tag"]}" href="{url_of(other)}">')
        lines.append(f'<link rel="alternate" hreflang="x-default" href="{url_of(versions.get("en", f))}">')
    robots = 'index, follow, max-snippet:-1, max-image-preview:large' if public else 'noindex'
    lines += [f'<meta name="author" content="{html.escape(COMPANY["legal_name"], quote=True)}">',
              f'<meta name="robots" content="{robots}">',
              f'<meta property="og:type" content="{"website" if withdrawn else p["og"]}">',
              f'<meta property="og:site_name" content="{html.escape(COMPANY["name"], quote=True)}">',
              f'<meta property="og:title" content="{html.escape(title, quote=True)}">',
              f'<meta property="og:description" content="{html.escape(desc, quote=True)}">',
              f'<meta property="og:url" content="{u}">',
              f'<meta property="og:locale" content="{LANGS[p["lang"]]["locale"]}">']
    for lang in versions:
        if lang != p['lang']:
            lines.append(f'<meta property="og:locale:alternate" content="{LANGS[lang]["locale"]}">')
    lines += [f'<meta property="article:published_time" content="{p["pub"]}">',
              f'<meta property="article:modified_time" content="{p["mod"]}">']
    lines += [f'<meta property="og:image" content="{SITE}assets/icon-512.png">',
              '<meta property="og:image:width" content="512">',
              '<meta property="og:image:height" content="512">',
              '<meta property="og:image:alt" content="The Vynatix mark">',
              '<meta name="twitter:card" content="summary">',
              f'<meta name="twitter:title" content="{html.escape(title, quote=True)}">',
              f'<meta name="twitter:description" content="{html.escape(desc, quote=True)}">']
    # JSON-LD graph
    page = {"@type": p['type'], "@id": u, "url": u, "name": title, "description": desc,
            "inLanguage": tag, "isPartOf": {"@id": WEBSITE_ID},
            "publisher": {"@id": ORG_ID}, "datePublished": p['pub'], "dateModified": p['mod']}
    if p.get('src', f) in ('index.html', 'sv.html', 'about.html'):
        page["about"] = {"@id": ORG_ID}
    others = [x for x in versions.values() if x != f]
    if others:
        # The original carries workTranslation, a translation carries translationOfWork. The English
        # page is the original unless the registry says otherwise (original=True / original=False).
        if is_original(f):
            refs = [{"@id": url_of(x)} for x in others]
            page["workTranslation"] = refs[0] if len(refs) == 1 else refs
        else:
            page["translationOfWork"] = {"@id": url_of(next(x for x in others if is_original(x)))}
    faqs, frag = ([], None) if withdrawn else faq_items(main_html, f)
    graph = [ORGANIZATION, WEBSITE, page]
    if faqs:
        fid = u + '#' + frag
        page["hasPart"] = {"@id": fid}
        graph.append({"@type": "FAQPage", "@id": fid, "url": fid, "inLanguage": tag,
                      "isPartOf": {"@id": u},
                      "mainEntity": [{"@type": "Question", "name": q,
                                      "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})
    if p['article'] and not withdrawn:
        graph.append({"@type": "Article", "@id": u + "#article", "headline": h1_text(main_html) or title,
                      "description": desc, "inLanguage": tag, "mainEntityOfPage": {"@id": u},
                      "author": {"@id": ORG_ID}, "publisher": {"@id": ORG_ID},
                      "datePublished": p['pub'], "dateModified": p['mod']})
    graph += [] if withdrawn else (extra_nodes or [])
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    ld = ld.replace('</', '<\\/')
    lines += ['<script type="application/ld+json">', ld, '</script>']
    return '<!-- seo -->\n' + '\n'.join(lines) + '\n<!-- /seo -->'

# ---------------------------------------------------------------- footer
# The one source of the footer is tools/templates/footer.html, with the facts it names from tools/site/company.json.
# Every page's footer is replaced with it on each run, so a change to the links or the fine print is made there, and
# one to the contact details in company.json, once.
COMPANY_TEXT = {k: v for k, v in COMPANY.items() if isinstance(v, str)}     # the facts a template may name
FOOTER = fragment('footer.html', 'footer', values=COMPANY_TEXT, once=('lang', 'grid', 'swedish', 'languages'))

# ---------------------------------------------------------------- header
# The one source of the site header is tools/templates/header.html, the way footer.html is the one source of the
# footer. Every page's header is replaced with it on each run (the aria-current link is the page itself), so a nav
# change is made there, once, and this script run. The skip link and the wordmark <symbol> above the header are
# still copied by hand into every page.
HEADER = fragment('header.html', 'header', names=('current',), once=('lang',))
for line in HEADER.template.split('\n'):
    if '${current}' in line and line.count(' href="') != 1:
        raise SystemExit(f'tools/templates/header.html: a line that names ${{current}} holds one link: {line.strip()}')

def header_for(f, gen=False):
    # ${current} is on the line of each link of the menu: aria-current="page" on the link to the page itself. On a
    # generated page the header is translated with the rest, so it does not declare English.
    lang = '' if gen else ' lang="en"'
    return '\n'.join(Template(line).substitute(lang=lang, current=' aria-current="page"' if f' href="{f}"' in line else '')
                     for line in HEADER.template.split('\n'))

# The footer's Swedish column: on the hand-written pages only. A generated page has the language list instead. It is
# <template id="swedish"> of footer.html, whole lines, so it ends in a newline.
SWEDISH_COLUMN = fragment('footer.html', 'swedish').substitute() + '\n'
LANGUAGES_SLOT = '        <!--@@languages@@-->\n'      # where a generated page's language list goes, once it is translated

def relative(target, f):
    """The link from page f to page target ('es/about.html' to 'about.html' is '../about.html')."""
    here = f.split('/')[:-1]; there = target.split('/')
    if here == there[:-1]:
        return there[-1]
    return '../' * len(here) + target

def languages_for(f, label='Language'):
    """The language list in the footer: every language a visitor may see from this page, each in its own
    name, linked to this page in that language or, where it has none, to that language's home page.
    Empty while no generated language is live, so the hand-written pages stay as they are; a page of a
    draft language lists the other drafts as well, so a reviewer can move between them."""
    p = ALL[f]
    drafts = LANGS[p['lang']].get('status') == 'draft'
    shown = [k for k, l in LANGS.items() if l['kind'] == 'written' or l['status'] == 'live' or drafts]
    if not any(LANGS[k]['kind'] == 'generated' for k in shown):
        return ''
    versions = cluster(f, drafts=drafts)
    rows = []
    for k in shown:
        l = LANGS[k]
        target = versions.get(k)
        if not target or ALL[target]['status'] != 'live':      # no version, or a withdrawn one: that language's home page
            target = l['home'] if l['kind'] == 'written' else f'{k}/index.html'
        cur = ' aria-current="true"' if k == p['lang'] else ''
        rows.append(f'          <li><a href="{relative(target, f)}" lang="{l["tag"]}" hreflang="{l["tag"]}"{cur}>{l["name"]}</a></li>')
    rows = ['  ' + r for r in rows]
    return (f'        <nav class="site-footer__langs" aria-label="{html.escape(label, quote=True)}">\n'
            '          <ul class="site-footer__langlist list-reset">\n' + '\n'.join(rows) + '\n          </ul>\n        </nav>\n')

def footer_for(f, gen=False):
    return FOOTER.substitute(COMPANY_TEXT, lang='' if gen else ' lang="en"', grid=' site-footer__grid--four' if gen else '',
                             swedish='' if gen else SWEDISH_COLUMN, languages=LANGUAGES_SLOT if gen else languages_for(f))

# ---------------------------------------------------------------- read helpers
CHECK = '--check' in sys.argv
STALE = []

def read(f): return open(os.path.join(REPO, f), encoding='utf-8').read()
def write(f, s):
    # With --check nothing is written: a file that a run would change is recorded as stale instead.
    if CHECK:
        try:
            if read(f) == s: return
        except FileNotFoundError:
            pass
        STALE.append(f); return
    os.makedirs(os.path.dirname(os.path.join(REPO, f)), exist_ok=True)
    open(os.path.join(REPO, f), 'w', encoding='utf-8').write(s)

def extra_nodes_for(f):
    """The page's own JSON-LD nodes (Service, ItemList, ...) from tools/seo/<page>.json, if any.
    That file holds either "extra_nodes" (the nodes themselves) or "extra_nodes_from" (another file
    in tools/seo/) with "ids": the "extra_nodes" of that file whose "@id" is listed, in the order
    of "ids", so a node that more than one page carries has one source. A node whose @id names a list
    of tools/site/lists.json that this script writes (blog.html#guides) gets its items from there."""
    path = os.path.join(SEO_DIR, f[:-len('.html')] + '.json')
    lists = {SITE + name: name for name, l in LISTS.items() if l['written'] and '#' in name}
    if not os.path.exists(path):
        if any(name.startswith(f + '#') for name in lists.values()):
            raise SystemExit(f'{f}: no tools/seo/{f[:-len(".html")]}.json to hold the ItemList that tools/site/lists.json fills')
        return None
    data = json.load(open(path, encoding='utf-8'))
    src = data.get('extra_nodes_from')
    if not src:
        nodes = data.get('extra_nodes')
    else:
        found = {n['@id']: n for n in json.load(open(os.path.join(SEO_DIR, src), encoding='utf-8')).get('extra_nodes', [])}
        missing = [i for i in data.get('ids', []) if i not in found]
        if missing:
            raise SystemExit(f + ': ' + src + ' has no node with @id ' + ', '.join(missing))
        nodes = [found[i] for i in data.get('ids', [])]
    for u, name in lists.items():
        if name.startswith(f + '#') and not any(n.get('@id') == u for n in nodes or []):
            raise SystemExit(f'tools/seo/{f[:-len(".html")]}.json: no node with @id {u}, which the list {name} of tools/site/lists.json fills')
    return None if nodes is None else [item_list(n, lists[n['@id']]) if n.get('@id') in lists else n for n in nodes]

def main_of(s):
    m = re.search(r'(\s*<main id="main"[^>]*>.*?</main>)', s, re.S); return m.group(1) if m else ''

# ---------------------------------------------------------------- withdrawn pages
# A withdrawn page keeps its URL (GitHub Pages cannot redirect) and says so, in about a hundred
# characters, with nothing of the old text: the stub of tools/templates/stub.html, in the words of the page's
# language. Built from existing components only (.page-hero), so a withdrawal never needs a stylesheet change or a
# new stamp. No reason is given on the page.
MONTHS = {'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
                 'October', 'November', 'December'],
          'sv': ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september',
                 'oktober', 'november', 'december']}
STUB_PAGE = fragment('stub.html', 'stub', once=('title', 'desc', 'eyebrow', 'h1', 'lede'))
# The fragment is a <title> line, a meta description line and the <main>, which withdraw() puts in place of the page's.
STUB_SHAPE = re.compile(r'(<title>.*?</title>)\n(<meta name="description" content="[^"]*">)\n(\s*<main id="main">.*</main>)', re.S)
if not STUB_SHAPE.fullmatch(STUB_PAGE.substitute(title='t', desc='d', eyebrow='e', h1='h', lede='l')):
    raise SystemExit('tools/templates/stub.html: <template id="stub"> is a <title> line, a <meta name="description"> '
                     'line and a <main id="main">, in that order, and nothing else')
STUB_WORDS = ('title', 'desc', 'eyebrow', 'h1', 'lede', 'home', 'date')

def load_stub():
    """The stub's words in each language written by hand, the <dl lang> lists of tools/templates/stub.html, in the
    shape stub_for() gives a generated language: {lang: dict(title, desc, eyebrow, h1, home, lede, date)}, where lede
    is a str.format pattern with {date} and {home} and date a function of the year, the month and the day."""
    rel = 'tools/templates/stub.html'
    words = read_template('stub.html')[1]
    written = [k for k, l in LANGS.items() if l['kind'] == 'written']
    if sorted(words) != sorted(written):
        raise SystemExit(f'{rel}: the words are for {", ".join(words) or "no language"}; they are for each language '
                         f'written by hand, {", ".join(written)}')
    out = {}
    for lang, w in words.items():
        where = f'{rel}: <dl lang="{lang}">'
        if sorted(w) != sorted(STUB_WORDS):
            raise SystemExit(f'{where} gives {", ".join(w)}; it gives {", ".join(STUB_WORDS)}, once each')
        allowed = dict(lede=('date', 'home'), date=('d', 'm', 'month', 'y'))
        for k, v in w.items():
            used = placeholders(v, f'{where}, {k},')
            if set(used) - set(allowed.get(k, ())) or (k == 'lede' and used.count('date') != 1) or (k == 'date' and not used):
                raise SystemExit(f'{where}, {k}, names {", ".join("${" + n + "}" for n in used) or "nothing"}; it may name '
                                 + {'lede': '${date} once and ${home}', 'date': '${d}, ${m}, ${month} and ${y}'}.get(k, 'nothing'))
        if re.search(r'[{}]', Template.pattern.sub('', w['lede'])):
            raise SystemExit(f'{where}, lede, holds a brace of its own, which the lede may not hold')
        text = {k: Template(v).substitute() for k, v in w.items() if k not in allowed}
        out[lang] = dict(text, lede=Template(w['lede']).substitute(date='{date}', home='{home}'),
                         date=lambda y, m, d, p=Template(w['date']), lang=lang: p.substitute(d=d, m=m, month=MONTHS[lang][m - 1], y=y))
    return out

STUB = load_stub()

def stub_page(f):
    """The stub of page f in the words of its language: its <title>, its meta description and its <main>."""
    p = ALL[f]; t = stub_for(p['lang'])
    y, m, d = (int(x) for x in p['mod'].split('-'))
    lede = t['lede'].format(date=t['date'](y, m, d), home=t['home'])
    return STUB_SHAPE.fullmatch(STUB_PAGE.substitute(title=t['title'], desc=t['desc'], eyebrow=t['eyebrow'], h1=t['h1'], lede=lede)).groups()

def withdraw(f, s):
    """Replaces the title, the meta description and the whole <main> with the stub."""
    title, desc, main = stub_page(f)
    s = re.sub(r'<title[^>]*>.*?</title>', lambda m: title, s, count=1, flags=re.S)
    s = re.sub(r'<meta name="description" content="[^"]*">', lambda m: desc, s, count=1)
    s, n = re.subn(r'(\s*)<main id="main"[^>]*>.*?</main>', lambda m: m.group(1) + main.lstrip(), s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f + ': no <main id="main"> to replace with the stub')
    return s

# ---------------------------------------------------------------- pages
def render(f, gen=False):
    # The page is the source of truth for its title, description and FAQ markup; the head block,
    # the header and the footer are rewritten from them and from the registry. Returns the new text;
    # nothing is written here, so a run that fails on one page has written none.
    # gen: the same page as the source of a generated language (header and footer without lang="en",
    # no Swedish column, a slot for the language list); render_gen() below takes it from there.
    s = read(f)
    if PAGES[f]['status'] == 'withdrawn':
        s = withdraw(f, s)
    title = html.unescape(re.search(r'<title>(.*?)</title>', s, re.S).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)">', s).group(1))
    block = head_block(f, title, desc, main_of(s), extra_nodes_for(f))
    s = re.sub(r'\n?<!-- seo -->.*?<!-- /seo -->', '', s, flags=re.S)
    s = re.sub(r'(<meta name="description" content="[^"]*">)', lambda m: m.group(1) + '\n' + block, s, count=1)
    s, n = re.subn(r'  <!-- =+ Footer -->\n  <footer class="site-footer inverse"( lang="en")?>.*?</footer>', lambda m: footer_for(f, gen), s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f + ': no footer marker ("<!-- ==== Footer -->" then <footer class="site-footer inverse">) to rewrite')
    s, n = re.subn(r'  <!-- =+ Header -->\n  <header class="site-header".*?</header>', lambda m: header_for(f, gen), s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f + ': no header marker ("<!-- ==== Header -->" then <header class="site-header">) to rewrite')
    return s

# ---------------------------------------------------------------- generated languages
# Messages that are on no English page but are needed in every generated language: the label of the
# language list, and the withdrawn stub with its date (TAKEDOWN.md: a translated page that has been
# public is withdrawn with its English source, and must say so in its own language).
STUB_LEDE = 'Vynatix removed this page on {date}. <1>Go to the home page</1>.'
DATE_PATTERN = '{d} {month} {y}'       # a translation may use {m}, the month as a number, instead of {month}
# The two are the English lede and date of tools/templates/stub.html as the catalogues write them, <1> for the link
# and {date} for the day: a change to one is made to the other, and the five catalogues translate the new message.
if (STUB['en']['lede'] != STUB_LEDE.replace('<1>', '<a href="{home}">').replace('</1>', '</a>')
        or Template(read_template('stub.html')[1]['en']['date']).substitute(d='{d}', m='{m}', month='{month}', y='{y}') != DATE_PATTERN):
    raise SystemExit('tools/templates/stub.html and STUB_LEDE or DATE_PATTERN in tools/seo-head.py, the messages the catalogues '
                     'translate, no longer say the same: change them together')
EXTRA_MESSAGES = (['Language', STUB['en']['title'], STUB['en']['desc'], STUB['en']['eyebrow'], STUB['en']['h1'],
                   STUB_LEDE, DATE_PATTERN] + MONTHS['en'])
LD_TEXT = ('name', 'description', 'serviceType', 'keywords', 'headline')     # the strings of a page's own JSON-LD nodes that are prose

def stub_for(lang):
    if lang in STUB:
        return STUB[lang]
    cat = i18n.load(lang)
    t = lambda m: i18n.translate_message(m, cat) or m
    months = [t(m) for m in MONTHS['en']]; pattern = t(DATE_PATTERN)
    return dict(title=t(STUB['en']['title']), desc=t(STUB['en']['desc']), eyebrow=t(STUB['en']['eyebrow']), h1=t(STUB['en']['h1']),
                home='index.html', lede=t(STUB_LEDE).replace('<1>', '<a href="{home}">').replace('</1>', '</a>'),
                date=lambda y, m, d: pattern.format(d=d, m=m, month=months[m - 1], y=y))

def ld_strings(nodes):
    out = []
    def walk(o, key=None):
        if isinstance(o, dict):
            for a, b in o.items(): walk(b, a)
        elif isinstance(o, list):
            for x in o: walk(x, key)
        elif isinstance(o, str) and key in LD_TEXT:
            out.append(html.escape(o, quote=False))
    walk(nodes or [])
    return out

def ld_localised(nodes, lang, cat, local, missing):
    """A page's own JSON-LD nodes for a generated language: prose from the catalogue, the addresses
    of translated pages moved into the language folder, inLanguage set."""
    def fix(o, key=None):
        if isinstance(o, dict): return {a: fix(b, a) for a, b in o.items()}
        if isinstance(o, list): return [fix(x, key) for x in o]
        if not isinstance(o, str): return o
        if key == 'inLanguage': return LANGS[lang]['tag'] if o == 'en' else o
        m = re.fullmatch(re.escape(SITE) + r'([\w-]+\.html)(#.*)?', o)
        if m and m.group(1) in local: return url_of(f'{lang}/{m.group(1)}') + (m.group(2) or '')
        if key in LD_TEXT:
            msg = html.escape(o, quote=False); t = i18n.translate_message(msg, cat)
            if t is None: missing.append(msg); return o
            return html.unescape(t)
        return o
    return fix(nodes) if nodes else nodes

def render_gen(gf, missing):
    """One page of a generated language: the English page, translated message by message from the
    language's catalogue, with its own head block, links and language list."""
    p = GEN[gf]; k = p['lang']; l = LANGS[k]; src = p['src']
    cat = i18n.load(k); local = set(sources(k)); lost = []

    def url(value, node):
        if node.tag == 'link' and node.attrs.get('rel') in ('canonical', 'alternate'): return value
        if value.startswith('mailto:') and 'subject=' in value:
            # The language rides along in the subject, so an enquiry says which page it came from.
            return re.sub(r'(subject=[^&]*)', lambda m: m.group(1) + f'%20%5B{k}%5D', value, count=1)
        if not value or value[0] in '#/' or re.match(r'[a-zA-Z][\w+.-]*:', value): return value
        return value if re.split(r'[?#]', value, maxsplit=1)[0] in local else '../' + value

    def start_tag(raw, node):
        if node.tag == 'html':
            raw = re.sub(r'\slang="[^"]*"', lambda m: f' lang="{l["tag"]}" dir="{l["dir"]}"', raw, count=1)
        if l['dir'] == 'rtl' and node.tag != 'html' and 'dir' not in node.attrs and (
                'lang' in node.attrs or (node.tag == 'a' and (node.attrs.get('href') or '').startswith(('tel:', 'mailto:')))):
            # English, Swedish, a phone number and an address read left to right on a right-to-left page.
            raw = raw[:-1].rstrip('/') + ' dir="ltr"' + ('/>' if raw.endswith('/>') else '>')
        if node.tag == 'a' and 'hreflang' not in node.attrs:
            page = re.split(r'[?#]', node.attrs.get('href') or '', maxsplit=1)[0]
            if page in PAGES and page not in local:          # a page that exists in English or Swedish only
                raw = raw[:-1] + f' hreflang="{LANGS[PAGES[page]["lang"]]["tag"]}">'
        return raw

    s, lost = i18n.translate(render(src, gen=True), cat, 'en', url, start_tag, rtl=l['dir'] == 'rtl')
    if p['status'] == 'withdrawn':
        s = withdraw(gf, s); lost = []
    # The hero background belongs to the English home page alone (hero-bg.css, :lang(en)).
    s = re.sub(r'\n<link rel="stylesheet" href="\.\./hero-bg\.css[^"]*">', '', s)
    title = html.unescape(re.search(r'<title[^>]*>(.*?)</title>', s, re.S).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)">', s).group(1))
    nodes = ld_localised(extra_nodes_for(src), k, cat, local, lost)
    block = head_block(gf, title, desc, main_of(s), nodes)
    s = re.sub(r'\n?<!-- seo -->.*?<!-- /seo -->', '', s, flags=re.S)
    s = re.sub(r'(<meta name="description" content="[^"]*">)', lambda m: m.group(1) + '\n' + block, s, count=1)
    label = i18n.translate_message('Language', cat)
    if label is None: lost.append('Language')
    assert LANGUAGES_SLOT in s, gf + ': the footer has no slot for the language list'
    s = s.replace(LANGUAGES_SLOT, languages_for(gf, label or 'Language'))
    missing.setdefault(k, {}).update(dict.fromkeys(lost))
    return s

def message_list():
    """tools/i18n/messages.json: every message of the generated languages, with the pages it is on."""
    seen = {}; warnings = []; optional = {}
    pages = list(dict.fromkeys(f for k in GENERATED for f in sources(k)))
    for f in pages:
        if PAGES[f]['status'] != 'live': continue
        found, warn = i18n.extract(render(f, gen=True))
        optional.update(dict.fromkeys(i18n.optional(render(f, gen=True))))
        warnings += [f'{f}: {w}' for w in warn]
        for m in found + [m for m in ld_strings(extra_nodes_for(f)) if not i18n._wordless(m)]:
            seen.setdefault(m, []).append(f)
    for m in EXTRA_MESSAGES:
        seen.setdefault(m, []).append('(the language list and the withdrawn stub)')
    # optional: what translate="no" holds (the brand line). A catalogue may carry one and no language owes it.
    data = {"languages": GENERATED, "messages": [{"id": m, "pages": list(dict.fromkeys(v))} for m, v in seen.items()],
            "optional": [m for m in optional if m not in seen]}
    write(os.path.join('tools', 'i18n', 'messages.json'), json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    return warnings

# llms.txt: the pages of each live generated language, between these two lines, before "## Optional".
# The rest of the file is written by hand, apart from its guide lines (llms_guides below); a draft language is not
# in it.
LLMS_OPEN = '<!-- Generated languages: written by tools/seo-head.py from LANGS, not by hand -->'
LLMS_CLOSE = '<!-- end of the generated languages -->'

def llms(rendered):
    text = read('llms.txt')
    parts = []
    for k in GENERATED:
        if LANGS[k]['status'] != 'live': continue
        rows = []
        for gf, p in GEN.items():
            if p['lang'] != k or not is_public(gf): continue
            s = rendered.get(gf) or read(gf)
            title = html.unescape(re.search(r'<title[^>]*>(.*?)</title>', s, re.S).group(1))
            desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)">', s).group(1))
            rows.append(f'- [{re.sub(r"[,،，]\s*Vynatix$", "", title)}]({url_of(gf)}): {desc}')
        parts.append(f'## {LANGS[k]["name"]} ({LANGS[k]["tag"]})\n\n' + '\n'.join(rows) + '\n')
    block = (LLMS_OPEN + '\n\n' + '\n'.join(parts) + '\n' + LLMS_CLOSE + '\n\n') if parts else ''
    text = re.sub(re.escape(LLMS_OPEN) + r'.*?' + re.escape(LLMS_CLOSE) + r'\n\n', '', text, flags=re.S)
    text = llms_guides(text)
    if block:
        if '## Optional' not in text:
            raise SystemExit('llms.txt: no "## Optional" section to put the generated languages before')
        text = text.replace('## Optional', block + '## Optional', 1)
    write('llms.txt', text)

def llms_guides(text):
    """llms.txt with its guide lines written from the list llms.txt of tools/site/lists.json. A guide line is a
    "- [...](url)" line that links a page whose row has "article": true, live or withdrawn; every other line is
    written by hand and kept as it is. Each written language has one "## " section, the one with the line that
    links its home page, and its guides stand there in one unbroken run, in the order of the list: the run of guide
    lines it holds is replaced, and a section that holds none gets its run after the last line of its list. A guide
    line anywhere else, or a run broken by a hand-written line, stops the run, because what to do with it is a
    person's call."""
    lines = text.split('\n')
    def page(line):
        m = re.match(r'- \[[^\]\n]*\]\((' + re.escape(SITE) + r'[^)\s]*)\)', line)
        f = m and ('index.html' if m.group(1) == SITE else m.group(1)[len(SITE):])
        return f if f in PAGES else None
    guide = lambda i: bool(page(lines[i]) and PAGES[page(lines[i])]['article'])
    heads = [i for i, l in enumerate(lines) if l.startswith('## ')]
    sections = list(zip(heads, heads[1:] + [len(lines)]))
    where = {}
    for k, l in LANGS.items():
        if l['kind'] != 'written': continue
        found = [s for s in sections if any(page(lines[i]) == l['home'] for i in range(*s))]
        if len(found) != 1:
            raise SystemExit(f'llms.txt: {len(found)} "## " sections link {l["home"]}, the home page of {l["name"]} '
                             f'(want 1: its guide lines go in that section)')
        where[k] = found[0]
    # The text here has no generated block, so a refusal names a line by its section and its text, not by a number.
    under = lambda i: next((f'under "{lines[h]}"' for h in reversed(heads) if h <= i), 'above the first "## " heading')
    stray = [i for i in range(len(lines)) if guide(i) and not any(a <= i < b for a, b in where.values())]
    if stray:
        raise SystemExit(f'llms.txt: the line that links the guide {page(lines[stray[0]])} stands {under(stray[0])}, outside '
                         'the section of a written language; move or remove it')
    runs = {}
    for k, (a, b) in where.items():
        at = [i for i in range(a, b) if guide(i)]
        if at and at != list(range(at[0], at[-1] + 1)):
            gap = next(i for i in range(at[0], at[-1]) if not guide(i))
            raise SystemExit(f'llms.txt: the hand-written line "{lines[gap][:60]}" stands inside the run of guide lines '
                             f'{under(gap)}; the run is written whole, so move the line out of it')
        last = max([i for i in range(a, b) if lines[i].startswith('- ')] or [a + 1])
        runs[k] = (at[0], at[-1] + 1) if at else (last + 1, last + 1)
    for k in sorted(runs, key=lambda k: runs[k], reverse=True):     # from the bottom up, so the places above hold
        rows = []
        for f, override in LIST['llms.txt']:
            if PAGES[f]['lang'] != k: continue
            title, desc = guide_facts(f)
            title, desc = override.get('title', title), override.get('description', desc)
            if not title or ']' in title:
                raise SystemExit(f'tools/site/lists.json: llms.txt: {f} would get the title "{title}", which a "- [title](url)" line cannot hold')
            rows.append(f'- [{title}]({url_of(f)})' + (f': {desc}' if desc else ''))
        lines[runs[k][0]:runs[k][1]] = rows
    return '\n'.join(lines)

# _config.yml: the folders of the draft languages are named in `exclude`, between these two lines, so a
# draft is never published. This script keeps the list; tools/verify/publish.js reads the result.
CONFIG_OPEN = '  # Generated languages still in draft: written by tools/seo-head.py from LANGS (AGENTS.md, "Languages")'
CONFIG_CLOSE = '  # end of the draft languages'

def config():
    text = read('_config.yml')
    drafts = [f'  - {k}' for k in GENERATED if LANGS[k]['status'] == 'draft']
    block = '\n'.join([CONFIG_OPEN] + drafts + [CONFIG_CLOSE])
    if CONFIG_OPEN in text:
        text = re.sub(re.escape(CONFIG_OPEN) + r'.*?' + re.escape(CONFIG_CLOSE), lambda m: block, text, flags=re.S)
    else:
        if not re.search(r'^exclude:\n(  - .*\n?)+\Z', text, re.M):
            raise SystemExit('_config.yml: exclude is expected to be the last list in the file')
        text = text.rstrip('\n') + '\n' + block + '\n'
    write('_config.yml', text)

# ---------------------------------------------------------------- sitemap
def sitemap():
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for f, p in ALL.items():
        if not is_public(f): continue
        rows.append('  <url>')
        rows.append(f'    <loc>{url_of(f)}</loc>')
        versions = cluster(f)
        if len(versions) > 1:
            for lang, other in versions.items():
                rows.append(f'    <xhtml:link rel="alternate" hreflang="{LANGS[lang]["tag"]}" href="{url_of(other)}"/>')
            rows.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{url_of(versions.get("en", f))}"/>')
        rows.append(f'    <lastmod>{p["mod"]}</lastmod>')
        rows.append('  </url>')
    rows.append('</urlset>')
    write('sitemap.xml', '\n'.join(rows) + '\n')

# ---------------------------------------------------------------- URL lock
LOCK = os.path.join('tools', 'urls.lock')
LOCK_HEAD = '''# Every URL this site has ever registered, and the date it first went live (pub).
# Append-only and written by tools/seo-head.py; never edit a row (a row whose URL has never been on main may be
# corrected before its first merge: AGENTS.md, "Dates when a branch sits"). GitHub Pages cannot redirect, so a URL
# that has been public must keep answering for good: as the live page, or as the withdrawn stub.
# tools/verify/permanence.js fails if a locked URL has no file, if a registered URL is missing here, or
# if a pub date differs from the registry. tools/ is not published.
'''

def lock():
    try:
        text = read(LOCK)
    except FileNotFoundError:
        text = LOCK_HEAD
    rows = [l.split() for l in text.splitlines() if l.strip() and not l.startswith('#')]
    for r in rows:
        if len(r) != 2 or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', r[1]):
            raise SystemExit(f'{LOCK}: a row is not "<url> <YYYY-MM-DD>": {" ".join(r)}')
    dup = sorted({r[0] for r in rows if [x[0] for x in rows].count(r[0]) > 1})
    if dup:
        raise SystemExit(f'{LOCK}: duplicate rows for {", ".join(dup)}; the lock is append-only, one row per URL')
    have = {r[0] for r in rows}
    if text and not text.endswith('\n'):
        text += '\n'
    for f, p in ALL.items():
        if f in GEN and LANGS[p['lang']]['status'] != 'live':
            continue                                    # a draft language has no public URL yet
        if url_of(f) not in have:
            text += f'{url_of(f)} {p["pub"]}\n'
    write(LOCK, text)

if __name__ == '__main__':
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    unknown_flags = [a for a in flags if a != '--check']
    if unknown_flags:
        raise SystemExit('unknown option ' + ', '.join(unknown_flags) + ' (the only option is --check)')
    if (DATE_PATTERN, MONTHS['en']) != (i18n.DATE_PATTERN, i18n.MONTHS):   # i18n.py writes the bylines' dates with its copies
        raise SystemExit('DATE_PATTERN or MONTHS["en"] differs from its copy in tools/i18n.py: make them equal')
    only = [os.path.basename(a) for a in sys.argv[1:] if not a.startswith('--')]
    unknown = [f for f in only if f not in PAGES]
    if unknown:
        raise SystemExit('not in PAGES: ' + ', '.join(unknown))
    chosen = [f for f in PAGES if not only or f in only]
    rendered = {f: render(f) for f in chosen}      # every page first, so a failure writes nothing
    missing = {}
    for gf, p in GEN.items():
        if p['src'] in chosen:
            rendered[gf] = render_gen(gf, missing)
    for f, text in rendered.items():
        write(f, text)
        if not CHECK and f in PAGES: print('  updated', f)
    # A page left in a language folder that the registry no longer produces (a draft's, since a
    # public one stays in tools/urls.lock and is kept as the stub).
    for k in GENERATED:
        folder = os.path.join(REPO, k)
        for name in (sorted(os.listdir(folder)) if os.path.isdir(folder) else []):
            if name.endswith('.html') and f'{k}/{name}' not in GEN:
                if CHECK: STALE.append(f'{k}/{name} (no longer generated)')
                else: os.remove(os.path.join(folder, name)); print('  removed', f'{k}/{name}')
    warnings = message_list()
    sitemap(); lock(); config(); llms(rendered)
    for w in warnings:
        print('  note:', w)
    for k in GENERATED:
        n = sum(1 for gf in rendered if gf.startswith(k + '/'))
        gaps = len(missing.get(k, {}))
        if not CHECK and n:
            print(f'  {k}/: {n} pages, {LANGS[k]["status"]}' + (f', {gaps} messages not translated (shown in English)' if gaps else ''))
    if CHECK:
        scope = ', '.join(chosen) if only else 'every page'
        if STALE:
            print('stale (a run of tools/seo-head.py would change): ' + ', '.join(STALE))
            sys.exit(1)
        print(f'every generated part is current ({scope}, the generated languages, sitemap.xml, tools/urls.lock, _config.yml)')
    else:
        print('  sitemap.xml'); print('  ' + LOCK.replace(os.sep, '/')); print('  tools/i18n/messages.json'); print('  _config.yml')
