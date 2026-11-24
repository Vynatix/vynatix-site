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
  page's extra nodes from tools/seo/<page>.json, when that file exists);
- the footer, from the FOOTER template below (a footer change is made there, then this is run;
  it is not edited in every file);
- the site header, from the HEADER template below (a nav change is made in NAV, then this is run); it stays
  English, with lang="en", on the Swedish pages;
- sitemap.xml, from the registry's mod dates and language versions;
- the generated languages (LANGS below: Spanish, French, German, Japanese, Arabic): every English page except
  the notices, rebuilt in <code>/ from the catalogue tools/i18n/<code>.json by tools/i18n.py, with
  its own head block, translated header and footer and the language list; tools/i18n/messages.json,
  the list of every message to translate; the draft languages' lines in _config.yml exclude; and,
  for a live generated language, its block in llms.txt. Never edit a page in a language folder.

What it never touches: anything inside <main>, the <title> and the meta description (the page
is the source of truth for both; the block repeats them), and the ?v= stamps on the stylesheets
and app.js. The one exception is a page whose registry status is 'withdrawn': the whole page
body, title and description are replaced by the short stub below (see TAKEDOWN.md), because on
GitHub Pages a withdrawn URL has to keep answering and must stop serving its old text.

    python3 tools/seo-head.py --check     reports (and exits 1 on) any generated part that differs
                                          from what a run would write, without writing anything

When to run it: after editing a FAQ (the FAQPage data must repeat the visible answers word for
word), after moving a page's `mod` date in PAGES because its content changed (`pub`, the date the
page first went live, never moves), or after changing the footer. It is idempotent: on an
unchanged tree it changes nothing. If styles or scripts changed as well, run `npm run stamp` in
tools/ afterwards; the stamps are not this script's business, and `npm run check` fails until
they are current (stamp.js stamps the language folders with the root pages, so the two agree).
After editing an English page, `python3 tools/i18n.py` lists what the catalogues now lack.
"""
import json, os, re, sys, html
from html.parser import HTMLParser

EXEC = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, EXEC)
import i18n                      # tools/i18n.py: the translation engine for the generated languages
REPO = os.path.dirname(EXEC)
SEO_DIR = os.path.join(EXEC, 'seo')
SITE = 'https://vynatix.com/'

ORG_ID = SITE + '#organization'
WEBSITE_ID = SITE + '#website'

# ---------------------------------------------------------------- registry
# lang: the page language. type: the schema.org page type. og: website|article.
# pub: datePublished, the date the page first went live (first commit for the original nine);
#      it never moves. mod: dateModified; move it when the page's content changes, then run this.
# alt: the twin in the other language (hreflang). article: the page also carries an Article node.
# original: which page of an alt pair is the original and which the translation (translationOfWork /
#      workTranslation). Default: the English page is the original. Give True on a Swedish original
#      and False on its English twin; exactly one page of each pair must be the original.
# kind: 'post' marks a guide or blog post written after the blog was added (the visible-date check
#      of tools/verify/permanence.js applies to these; the older guides are not marked).
# status: 'live' (default) or 'withdrawn'. A withdrawn page keeps its URL but is replaced by a short
#      stub, carries noindex and no hreflang, and is left out of sitemap.xml (and so of llms.txt).
# One entry per line, as written here: tools/verify/_common.js reads this table as text.
# The order here is the order of sitemap.xml.
PAGES = {
  'index.html':        dict(lang='en', type='WebPage',        og='website', pub='2026-05-14', mod='2026-11-24', alt={'sv': 'sv.html'}),
  'about.html':        dict(lang='en', type='AboutPage',      og='website', pub='2026-06-27', mod='2026-11-20'),
  'services.html':     dict(lang='en', type='WebPage',        og='website', pub='2026-06-27', mod='2026-11-23'),
  'industries.html':   dict(lang='en', type='WebPage',        og='website', pub='2026-11-20', mod='2026-11-20'),
  'work.html':         dict(lang='en', type='CollectionPage', og='website', pub='2026-06-27', mod='2026-11-19'),
  'membership.html':   dict(lang='en', type='WebPage',        og='website', pub='2026-06-27', mod='2026-11-20'),
  'contact.html':      dict(lang='en', type='ContactPage',    og='website', pub='2026-06-27', mod='2026-11-23'),
  'blog.html':         dict(lang='en', type='CollectionPage', og='website', pub='2026-11-06', mod='2026-11-24'),
  'privacy.html':      dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-11-20', alt={'sv': 'integritet.html'}),
  'terms.html':        dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-08-19'),
  'accessibility.html':dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-11-20'),
  'sv.html':                                    dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-11-23', alt={'en': 'index.html'}),
  'android-automotive-development.html':        dict(lang='en', type='WebPage', og='website', pub='2026-10-18', mod='2026-11-20', alt={'sv': 'android-automotive-utveckling.html'}),
  'android-automotive-utveckling.html':         dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-11-20', alt={'en': 'android-automotive-development.html'}),
  'ai-engineering.html':                        dict(lang='en', type='WebPage', og='website', pub='2026-10-18', mod='2026-11-20', alt={'sv': 'ai-utveckling.html'}),
  'ai-utveckling.html':                         dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-11-20', alt={'en': 'ai-engineering.html'}),
  'android-automotive-consultancies-gothenburg.html': dict(lang='en', type='CollectionPage', og='article', pub='2026-10-18', mod='2026-11-20', article=True, alt={'sv': 'konsultbolag-android-automotive-goteborg.html'}, status='withdrawn'),
  'konsultbolag-android-automotive-goteborg.html':    dict(lang='sv', type='CollectionPage', og='article', pub='2026-10-18', mod='2026-11-20', article=True, alt={'en': 'android-automotive-consultancies-gothenburg.html'}, status='withdrawn'),
  'valja-konsultbolag.html':                    dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-11-20', article=True, original=True, alt={'en': 'choose-a-software-consultancy.html'}),
  'platform-engineering.html':                  dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-11-20', article=True),
  'ai-assistent-interna-dokument.html':         dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-11-20', article=True),
  'ai-konsultbolag-sverige.html':               dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-11-20', article=True, status='withdrawn'),
  'choose-a-software-consultancy.html':         dict(lang='en', type='WebPage', og='article', pub='2026-11-06', mod='2026-11-20', article=True, kind='post', original=False, alt={'sv': 'valja-konsultbolag.html'}),
  'integritet.html':                            dict(lang='sv', type='WebPage', og='website', pub='2026-10-19', mod='2026-11-20', alt={'en': 'privacy.html'}),
  'testautomatisering.html':                  dict(lang='sv', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-24', article=True, kind='post', original=True, alt={'en': 'test-automation.html'}),
  'systemutveckling.html':                    dict(lang='sv', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-24', article=True, kind='post', original=True, alt={'en': 'custom-software-development.html'}),
  'systemintegration-och-forvaltning.html':   dict(lang='sv', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-24', article=True, kind='post', original=True, alt={'en': 'system-integration-and-maintenance.html'}),
  'ai-i-befintlig-produkt.html':              dict(lang='sv', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-24', article=True, kind='post', original=True, alt={'en': 'ai-in-your-existing-product.html'}),
  'fordonsmjukvara.html':                     dict(lang='sv', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-24', article=True, kind='post', original=True, alt={'en': 'automotive-software.html'}),
  'test-automation.html':                     dict(lang='en', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-23', article=True, kind='post', original=False, alt={'sv': 'testautomatisering.html'}),
  'custom-software-development.html':         dict(lang='en', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-23', article=True, kind='post', original=False, alt={'sv': 'systemutveckling.html'}),
  'system-integration-and-maintenance.html':  dict(lang='en', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-23', article=True, kind='post', original=False, alt={'sv': 'systemintegration-och-forvaltning.html'}),
  'ai-in-your-existing-product.html':         dict(lang='en', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-23', article=True, kind='post', original=False, alt={'sv': 'ai-i-befintlig-produkt.html'}),
  'automotive-software.html':                 dict(lang='en', type='WebPage', og='article', pub='2026-11-23', mod='2026-11-23', article=True, kind='post', original=False, alt={'sv': 'fordonsmjukvara.html'}),
}
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
# Every language the site is in, in the order the language list shows them. One entry per line.
# name: the language's own name. tag: the value of lang and hreflang. locale: og:locale. dir: ltr or rtl.
# kind: 'written' (pages written by hand and registered in PAGES above: English and Swedish) or
#       'generated' (every English page except UNTRANSLATED, rebuilt in the folder <code>/ from the
#       catalogue tools/i18n/<code>.json by tools/i18n.py; never edit a generated page).
# A generated language also has:
# status: 'draft' or 'live'. A draft is built and checked but not published: its folder is named in
#       _config.yml exclude (this script keeps that list), its pages carry noindex and no hreflang, no
#       other page links to it, and it has no row in sitemap.xml, llms.txt or tools/urls.lock. 'live'
#       publishes it, and its URLs are then permanent like every other; a live language never goes
#       back to draft. The brand voice requires a native reader's check first, so 'live' needs:
# checked, by: the date of that check and who made it (a name or a role); or
# waived: the date the owner decided to publish the language without that check. It says the check has
#       NOT been made. Never write a date in `checked` for a check nobody made; when a reader has been
#       through the language, fill in checked and by and leave waived as the record of what came first.
# pub: the day the language goes live (set it on that day); mod: move it when its catalogue changes.
LANGS = {
  'en': dict(name='English', tag='en', locale='en_GB', dir='ltr', kind='written', home='index.html'),
  'sv': dict(name='Svenska', tag='sv', locale='sv_SE', dir='ltr', kind='written', home='sv.html'),
  'es': dict(name='Español', tag='es', locale='es_ES', dir='ltr', kind='generated', status='live', pub='2026-11-20', mod='2026-11-24', checked='', by='', waived='2026-11-20'),
  'fr': dict(name='Français', tag='fr', locale='fr_FR', dir='ltr', kind='generated', status='live', pub='2026-11-21', mod='2026-11-24', checked='', by='', waived='2026-11-21'),
  'de': dict(name='Deutsch', tag='de', locale='de_DE', dir='ltr', kind='generated', status='live', pub='2026-11-21', mod='2026-11-24', checked='', by='', waived='2026-11-21'),
  'ja': dict(name='日本語', tag='ja', locale='ja_JP', dir='ltr', kind='generated', status='live', pub='2026-11-21', mod='2026-11-24', checked='', by='', waived='2026-11-21'),
  'ar': dict(name='العربية', tag='ar', locale='ar_AR', dir='rtl', kind='generated', status='live', pub='2026-11-20', mod='2026-11-24', checked='', by='', waived='2026-11-20'),
}
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

# ---------------------------------------------------------------- shared nodes
COMPANY_SENTENCE = ("Vynatix is the senior software consultancy for scale-ups. Our engineers join your team, raise "
    "the pace and make your software stronger as you grow. Based in Gothenburg, part of Ultra Group.")

ORGANIZATION = {
  "@type": "Organization",
  "@id": ORG_ID,
  "name": "Vynatix",
  "legalName": "Vynatix AB",
  "alternateName": "Vynatix AB",
  "url": SITE,
  "logo": {"@type": "ImageObject", "url": SITE + "assets/icon-512.png", "width": 512, "height": 512},
  "description": COMPANY_SENTENCE,
  "slogan": "Engineering that compounds",
  "foundingDate": "2023",
  "foundingLocation": {"@type": "Place", "name": "Gothenburg, Sweden"},
  "memberOf": {"@type": "Organization", "name": "Ultra Group", "url": "https://ultragroup.se/"},
  "identifier": {"@type": "PropertyValue", "propertyID": "Swedish organisationsnummer", "value": "559445-6542"},
  "address": {"@type": "PostalAddress", "streetAddress": "Mailbox 1611", "postalCode": "411 42",
              "addressLocality": "Gothenburg", "addressCountry": "SE"},
  "email": "front.disk@vynatix.com",
  "telephone": "+46720710676",
  "contactPoint": {"@type": "ContactPoint", "contactType": "Projects and careers",
                   "email": "front.disk@vynatix.com", "telephone": "+46720710676"},
  "knowsAbout": [
    "AI engineering", "Retrieval-augmented generation", "LLM evaluation pipelines",
    "MCP servers and integrations", "Agent and harness engineering", "On-prem and sovereign cloud deployment",
    "Cloud platforms on GCP and AWS", "Kubernetes and GitOps", "Platform engineering",
    "Build pipelines", "FinOps and cost control", "Migration off legacy systems",
    "Native mobile development for iOS and Android", "Web and desktop applications",
    "Enterprise integration and SaaS", "Embedded Android", "Android Automotive (AAOS)"],
  "sameAs": ["https://www.linkedin.com/company/vynatix", "https://github.com/Vynatix"],
}
WEBSITE = {"@type": "WebSite", "@id": WEBSITE_ID, "url": SITE, "name": "Vynatix",
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
    lines += ['<meta name="author" content="Vynatix AB">',
              f'<meta name="robots" content="{robots}">',
              f'<meta property="og:type" content="{"website" if withdrawn else p["og"]}">',
              '<meta property="og:site_name" content="Vynatix">',
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
# The one source of the footer. Every page's footer is replaced with this on each run, so a
# change to the contact details, the links or the fine print is made here, once.
FOOTER = '''  <!-- ============================================================ Footer -->
  <footer class="site-footer inverse"@@LANG@@>
    <div class="container">
      <div class="site-footer__grid@@GRID@@">
        <div class="site-footer__brand">
          <a href="index.html" class="site-footer__logo" aria-label="Vynatix home">
            <svg class="vx-wordmark" viewBox="0 0 2654.79 653.758" width="162" height="40" aria-hidden="true" focusable="false"><use href="#vx-wordmark"/></svg>
          </a>
          <p class="site-footer__about">The senior software consultancy for scale-ups. Our engineers join your team, raise the pace and make your software stronger as you grow.</p>
          <address class="site-footer__addr">
            <a href="mailto:front.disk@vynatix.com">front.disk@vynatix.com</a><br>
            <a href="tel:+46720710676">+46 72 071 06 76</a><br>
            Mailbox 1611, 411 42 Gothenburg<br>
            Org.nr 559445-6542 · <a href="https://ultragroup.se/" rel="noopener">Part of Ultra Group</a>
          </address>
        </div>
        <div>
          <h2 class="site-footer__h">Services</h2>
          <ul class="site-footer__links list-reset">
            <li><a href="services.html#ai-engineering">AI engineering</a></li>
            <li><a href="services.html#cloud-platforms">Cloud platforms</a></li>
            <li><a href="services.html#application-development">Application development</a></li>
          </ul>
        </div>
        <div>
          <h2 class="site-footer__h">Company</h2>
          <ul class="site-footer__links list-reset">
            <li><a href="about.html">About</a></li>
            <li><a href="industries.html">Industries</a></li>
            <li><a href="work.html">Cases</a></li>
            <li><a href="blog.html">Insights</a></li>
            <li><a href="membership.html">Career</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
@@SWEDISH@@        <div>
          <h2 class="site-footer__h">Legal</h2>
          <ul class="site-footer__links list-reset">
            <li><a href="privacy.html">Privacy</a></li>
            <li><a href="privacy.html#cookies" data-consent-open>Cookie settings</a></li>
            <li><a href="terms.html">Terms</a></li>
            <li><a href="accessibility.html">Accessibility</a></li>
            <li class="motion-item"><button class="motion-toggle" type="button" data-i18n-play="Play background motion">Pause background motion</button></li>
          </ul>
        </div>
      </div>
      <div class="site-footer__fine">
        <span>© 2026 Vynatix AB</span>
@@LANGUAGES@@        <span>vynatix.com</span>
      </div>
    </div>
  </footer>'''

# ---------------------------------------------------------------- header
# The one source of the site header, the way FOOTER is the one source of the footer. Every page's header is
# replaced with this on each run (the aria-current link is the page itself), so a nav change is made in NAV
# below, once, and this script run. The skip link and the wordmark <symbol> above the header are still
# copied by hand into every page.
NAV = [('services.html', 'Services'), ('industries.html', 'Industries'), ('work.html', 'Cases'), ('blog.html', 'Insights'), ('membership.html', 'Career'), ('about.html', 'About'), ('contact.html', 'Contact')]
MENU_CTA = ('contact.html', 'Get in touch')   # the extra link the mobile menu shows
HEADER = '''  <!-- ============================================================ Header -->
  <header class="site-header" role="banner"@@LANG@@>
    <div class="site-header__inner">
      <a href="index.html" class="site-header__logo" aria-label="Vynatix home">
        <svg class="vx-wordmark" viewBox="0 0 2654.79 653.758" width="122" height="30" aria-hidden="true" focusable="false"><use href="#vx-wordmark"/></svg>
      </a>
      <button class="icon-btn mobile-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="primary-nav">
        <svg class="icon icon--menu" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="M140-254.62V-300h680v45.38H140Zm0-202.69v-45.38h680v45.38H140ZM140-660v-45.38h680V-660H140Z"/></svg>
        <svg class="icon icon--close" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="m250.92-218.92-32-32L448-480 218.92-709.08l32-32L480-512l229.08-229.08 32 32L512-480l229.08 229.08-32 32L480-448 250.92-218.92Z"/></svg>
      </button>
      <nav class="site-header__nav" id="primary-nav" aria-label="Primary">
        <ul class="site-header__list list-reset">
@@NAV@@
        </ul>
      </nav>
      <div class="site-header__tools">
        <button class="icon-btn theme-toggle" type="button" title="Dark theme" aria-label="Dark theme" aria-pressed="false">
          <svg class="icon icon--dark" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="M481.15-140q-141.66 0-240.83-99.17-99.16-99.16-99.16-240.83 0-135.77 92.11-232.88 92.11-97.12 225.57-105.2 4.16 0 9.12.31 4.96.31 13.96.49-27.15 30.9-41.96 71.74-14.81 40.85-14.81 85.54 0 98.33 68.84 167.17Q562.82-424 661.15-424q44.31 0 85.35-13.69 41.04-13.69 71.5-38.61.23 7.38.54 11.23.3 3.84.3 7.38-7.69 133.46-104.8 225.57Q616.92-140 481.15-140Zm0-45.39q103.23 0 181.35-62.49 78.11-62.5 101.19-149.66-23.46 9.46-49.82 14.19-26.36 4.74-52.72 4.74-116.92 0-199.15-82.23T379.77-660q0-23.23 4.42-48.62 4.42-25.38 15.5-56.15-92.61 28.16-152.88 107.47-60.27 79.31-60.27 177.3 0 122.77 85.92 208.69t208.69 85.92Zm-5.53-289.69Z"/></svg>
          <svg class="icon icon--light" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="M575.15-384.85q39.46-39.46 39.46-95.15 0-55.69-39.46-95.15-39.46-39.46-95.15-39.46-55.69 0-95.15 39.46-39.46 39.46-39.46 95.15 0 55.69 39.46 95.15 39.46 39.46 95.15 39.46 55.69 0 95.15-39.46Zm-222.61 32.31Q300-405.08 300-480q0-74.92 52.54-127.46Q405.08-660 480-660q74.92 0 127.46 52.54Q660-554.92 660-480q0 74.92-52.54 127.46Q554.92-300 480-300q-74.92 0-127.46-52.54ZM200-457.31H50v-45.38h150v45.38Zm710 0H760v-45.38h150v45.38ZM457.31-760v-150h45.38v150h-45.38Zm0 710v-150h45.38v150h-45.38ZM267.39-662.62l-93.08-90.46 32.23-33.61L296.77-694l-29.38 31.38Zm486.69 488.7-91.46-92.7L693.61-298l92.08 91.08-31.61 33ZM662-693.61l91.08-92.08 33.61 31.61-92.08 91.46L662-693.61ZM173.92-206.54 266-298l31.23 31.23-90.69 92.85-32.62-32.62ZM480-480Z"/></svg>
        </button>
        <a href="contact.html" class="btn btn--sm site-header__cta">Get in touch</a>
      </div>
    </div>
  </header>'''

def header_for(f, gen=False):
    rows = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == f else ''
        rows.append(f'          <li><a href="{href}" class="site-header__link"{cur}>{label}</a></li>')
    rows.append(f'          <li class="site-header__menu-cta"><a href="{MENU_CTA[0]}" class="site-header__link">{MENU_CTA[1]}</a></li>')
    # On a generated page the header is translated with the rest, so it does not declare English.
    return HEADER.replace('@@NAV@@', '\n'.join(rows)).replace('@@LANG@@', '' if gen else ' lang="en"')

# The footer's Swedish column: on the hand-written pages only. A generated page has the language list instead.
SWEDISH_COLUMN = '        <div lang="sv">\n          <h2 class="site-footer__h">På svenska</h2>\n          <ul class="site-footer__links list-reset">\n            <li><a href="sv.html" hreflang="sv">Vynatix på svenska</a></li>\n            <li><a href="ai-utveckling.html" hreflang="sv">AI-utveckling</a></li>\n            <li><a href="sv.html#guider" hreflang="sv">Guider</a></li>\n            <li><a href="integritet.html" hreflang="sv">Integritetsmeddelande</a></li>\n          </ul>\n        </div>\n'
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
    s = FOOTER.replace('@@LANG@@', '' if gen else ' lang="en"').replace('@@GRID@@', ' site-footer__grid--four' if gen else '')
    s = s.replace('@@SWEDISH@@', '' if gen else SWEDISH_COLUMN)
    return s.replace('@@LANGUAGES@@', LANGUAGES_SLOT if gen else languages_for(f))

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
    of "ids", so a node that more than one page carries has one source."""
    path = os.path.join(SEO_DIR, f[:-len('.html')] + '.json')
    if not os.path.exists(path):
        return None
    data = json.load(open(path, encoding='utf-8'))
    src = data.get('extra_nodes_from')
    if not src:
        return data.get('extra_nodes')
    nodes = {n['@id']: n for n in json.load(open(os.path.join(SEO_DIR, src), encoding='utf-8')).get('extra_nodes', [])}
    missing = [i for i in data.get('ids', []) if i not in nodes]
    if missing:
        raise SystemExit(f + ': ' + src + ' has no node with @id ' + ', '.join(missing))
    return [nodes[i] for i in data.get('ids', [])]

def main_of(s):
    m = re.search(r'(\s*<main id="main"[^>]*>.*?</main>)', s, re.S); return m.group(1) if m else ''

# ---------------------------------------------------------------- withdrawn pages
# A withdrawn page keeps its URL (GitHub Pages cannot redirect) and says so, in about a hundred
# characters, with nothing of the old text. Built from existing components only (.page-hero), so a
# withdrawal never needs a stylesheet change or a new stamp. No reason is given on the page.
MONTHS = {'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
                 'October', 'November', 'December'],
          'sv': ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september',
                 'oktober', 'november', 'december']}
STUB = {
  'en': dict(title='Page withdrawn, Vynatix', desc='Vynatix has withdrawn this page.', eyebrow='Withdrawn',
             h1='This page has been withdrawn', home='index.html',
             lede='Vynatix removed this page on {date}. <a href="{home}">Go to the home page</a>.',
             date=lambda y, m, d: f'{d} {MONTHS["en"][m - 1]} {y}'),
  'sv': dict(title='Sidan är återkallad, Vynatix', desc='Vynatix har tagit bort den här sidan.', eyebrow='Återkallad',
             h1='Den här sidan är återkallad', home='sv.html',
             lede='Vynatix tog bort sidan den {date}. <a href="{home}">Gå till startsidan</a>.',
             date=lambda y, m, d: f'{d} {MONTHS["sv"][m - 1]} {y}'),
}

def stub_main(f):
    p = ALL[f]; t = stub_for(p['lang'])
    y, m, d = (int(x) for x in p['mod'].split('-'))
    lede = t['lede'].format(date=t['date'](y, m, d), home=t['home'])
    return ('  <main id="main">\n'
            '    <section class="page-hero">\n'
            '      <div class="container">\n'
            f'        <p class="eyebrow">{t["eyebrow"]}</p>\n'
            f'        <h1 class="page-hero__h1">{t["h1"]}</h1>\n'
            f'        <p class="page-hero__lede">{lede}</p>\n'
            '      </div>\n'
            '    </section>\n'
            '  </main>')

def withdraw(f, s):
    """Replaces the title, the meta description and the whole <main> with the stub."""
    t = stub_for(ALL[f]['lang'])
    s = re.sub(r'<title[^>]*>.*?</title>', lambda m: f'<title>{t["title"]}</title>', s, count=1, flags=re.S)
    s = re.sub(r'<meta name="description" content="[^"]*">', lambda m: f'<meta name="description" content="{t["desc"]}">', s, count=1)
    s, n = re.subn(r'(\s*)<main id="main"[^>]*>.*?</main>', lambda m: m.group(1) + stub_main(f).lstrip(), s, count=1, flags=re.S)
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
# The rest of the file is written by hand; a draft language is not in it.
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
    if block:
        if '## Optional' not in text:
            raise SystemExit('llms.txt: no "## Optional" section to put the generated languages before')
        text = text.replace('## Optional', block + '## Optional', 1)
    write('llms.txt', text)

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
