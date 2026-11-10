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
- sitemap.xml, from the registry's mod dates and language pairs.

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
they are current.
"""
import json, os, re, sys, html
from html.parser import HTMLParser

EXEC = os.path.dirname(os.path.abspath(__file__))
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
  'index.html':        dict(lang='en', type='WebPage',        og='website', pub='2026-05-14', mod='2026-11-06', alt={'sv': 'sv.html'}),
  'about.html':        dict(lang='en', type='AboutPage',      og='website', pub='2026-06-27', mod='2026-10-20'),
  'services.html':     dict(lang='en', type='WebPage',        og='website', pub='2026-06-27', mod='2026-10-18'),
  'work.html':         dict(lang='en', type='CollectionPage', og='website', pub='2026-06-27', mod='2026-10-23'),
  'membership.html':   dict(lang='en', type='WebPage',        og='website', pub='2026-06-27', mod='2026-10-17'),
  'contact.html':      dict(lang='en', type='ContactPage',    og='website', pub='2026-06-27', mod='2026-10-17'),
  'blog.html':         dict(lang='en', type='CollectionPage', og='website', pub='2026-11-06', mod='2026-11-06'),
  'privacy.html':      dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-11-06', alt={'sv': 'integritet.html'}),
  'terms.html':        dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-08-19'),
  'accessibility.html':dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-10-20'),
  'sv.html':                                    dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-19', alt={'en': 'index.html'}),
  'android-automotive-development.html':        dict(lang='en', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-20', alt={'sv': 'android-automotive-utveckling.html'}),
  'android-automotive-utveckling.html':         dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-20', alt={'en': 'android-automotive-development.html'}),
  'ai-engineering.html':                        dict(lang='en', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-20', alt={'sv': 'ai-utveckling.html'}),
  'ai-utveckling.html':                         dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-20', alt={'en': 'ai-engineering.html'}),
  'android-automotive-consultancies-gothenburg.html': dict(lang='en', type='CollectionPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True, alt={'sv': 'konsultbolag-android-automotive-goteborg.html'}),
  'konsultbolag-android-automotive-goteborg.html':    dict(lang='sv', type='CollectionPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True, alt={'en': 'android-automotive-consultancies-gothenburg.html'}),
  'valja-konsultbolag.html':                    dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-11-06', article=True, original=True, alt={'en': 'choose-a-software-consultancy.html'}),
  'platform-engineering.html':                  dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True),
  'ai-assistent-interna-dokument.html':         dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True),
  'ai-konsultbolag-sverige.html':               dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True),
  'choose-a-software-consultancy.html':         dict(lang='en', type='WebPage', og='article', pub='2026-11-06', mod='2026-11-06', article=True, kind='post', original=False, alt={'sv': 'valja-konsultbolag.html'}),
  'integritet.html':                            dict(lang='sv', type='WebPage', og='website', pub='2026-10-19', mod='2026-11-06', alt={'en': 'privacy.html'}),
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
    p = PAGES[f]
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

def url_of(f):
    return SITE if f == 'index.html' else SITE + f

# ---------------------------------------------------------------- shared nodes
COMPANY_SENTENCE = ("Vynatix AB is a software consultancy in Gothenburg, Sweden, founded in 2023 and part of "
    "Ultra Group. Our senior engineers work as part of client organisations on Android Automotive, AI engineering "
    "and cloud platforms, with Volvo Trucks and Volvo Cars among our clients.")

ORGANIZATION = {
  "@type": "Organization",
  "@id": ORG_ID,
  "name": "Vynatix",
  "legalName": "Vynatix AB",
  "alternateName": "Vynatix AB",
  "url": SITE,
  "logo": {"@type": "ImageObject", "url": SITE + "assets/icon-512.png", "width": 512, "height": 512},
  "description": COMPANY_SENTENCE,
  "slogan": "We own the outcome. You own the code.",
  "foundingDate": "2023",
  "foundingLocation": {"@type": "Place", "name": "Gothenburg, Sweden"},
  "memberOf": {"@type": "Organization", "name": "Ultra Group", "url": "https://ultragroup.se/"},
  "identifier": {"@type": "PropertyValue", "propertyID": "Swedish organisationsnummer", "value": "559445-6542"},
  "address": {"@type": "PostalAddress", "streetAddress": "Mailbox 1611", "postalCode": "411 42",
              "addressLocality": "Gothenburg", "addressCountry": "SE"},
  "email": "front.disk@vynatix.com",
  "telephone": "+46720710676",
  "contactPoint": {"@type": "ContactPoint", "contactType": "Projects and membership",
                   "email": "front.disk@vynatix.com", "telephone": "+46720710676"},
  "knowsAbout": [
    "Android Automotive (AAOS)", "In-car software", "Native mobile development for iOS and Android",
    "Web and desktop applications", "Enterprise integration and SaaS", "AI engineering",
    "Retrieval-augmented generation", "LLM evaluation pipelines", "MCP servers and integrations",
    "Agent and harness engineering", "On-prem and sovereign cloud deployment",
    "Cloud platforms on GCP and AWS", "Kubernetes and GitOps", "Platform engineering",
    "Build pipelines", "FinOps and cost control", "Migration off legacy systems"],
  "sameAs": ["https://www.linkedin.com/company/vynatix", "https://github.com/Vynatix"],
}
WEBSITE = {"@type": "WebSite", "@id": WEBSITE_ID, "url": SITE, "name": "Vynatix",
           "inLanguage": ["en", "sv"], "publisher": {"@id": ORG_ID}}

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
    p = PAGES[f]; u = url_of(f)
    withdrawn = p['status'] == 'withdrawn'
    loc = {'en': 'en_GB', 'sv': 'sv_SE'}
    lines = ['<!-- Search and sharing: the canonical address, the other-language version, Open Graph, and',
             '     structured data (a JSON-LD data block: never executed, so script-src does not apply). -->',
             f'<link rel="canonical" href="{u}">']
    if p['alt'] and not withdrawn:
        versions = {p['lang']: f, **p['alt']}
        for lang in ('en', 'sv'):
            if lang in versions:
                lines.append(f'<link rel="alternate" hreflang="{lang}" href="{url_of(versions[lang])}">')
        lines.append(f'<link rel="alternate" hreflang="x-default" href="{url_of(versions.get("en", f))}">')
    robots = 'noindex' if withdrawn else 'index, follow, max-snippet:-1, max-image-preview:large'
    lines += ['<meta name="author" content="Vynatix AB">',
              f'<meta name="robots" content="{robots}">',
              f'<meta property="og:type" content="{"website" if withdrawn else p["og"]}">',
              '<meta property="og:site_name" content="Vynatix">',
              f'<meta property="og:title" content="{html.escape(title, quote=True)}">',
              f'<meta property="og:description" content="{html.escape(desc, quote=True)}">',
              f'<meta property="og:url" content="{u}">',
              f'<meta property="og:locale" content="{loc[p["lang"]]}">']
    for lang in ([] if withdrawn else p['alt']):
        lines.append(f'<meta property="og:locale:alternate" content="{loc[lang]}">')
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
            "inLanguage": p['lang'], "isPartOf": {"@id": WEBSITE_ID},
            "publisher": {"@id": ORG_ID}, "datePublished": p['pub'], "dateModified": p['mod']}
    if f in ('index.html', 'sv.html', 'about.html'):
        page["about"] = {"@id": ORG_ID}
    if p['alt'] and not withdrawn:
        other = list(p['alt'].values())[0]
        # The original carries workTranslation, the translation carries translationOfWork. The English
        # page is the original unless the registry says otherwise (original=True / original=False).
        if is_original(f):
            page["workTranslation"] = {"@id": url_of(other)}
        else:
            page["translationOfWork"] = {"@id": url_of(other)}
    faqs, frag = ([], None) if withdrawn else faq_items(main_html, f)
    graph = [ORGANIZATION, WEBSITE, page]
    if faqs:
        fid = u + '#' + frag
        page["hasPart"] = {"@id": fid}
        graph.append({"@type": "FAQPage", "@id": fid, "url": fid, "inLanguage": p['lang'],
                      "isPartOf": {"@id": u},
                      "mainEntity": [{"@type": "Question", "name": q,
                                      "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})
    if p['article'] and not withdrawn:
        graph.append({"@type": "Article", "@id": u + "#article", "headline": h1_text(main_html) or title,
                      "description": desc, "inLanguage": p['lang'], "mainEntityOfPage": {"@id": u},
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
  <footer class="site-footer inverse" lang="en">
    <div class="container">
      <div class="site-footer__grid">
        <div class="site-footer__brand">
          <a href="index.html" class="site-footer__logo" aria-label="Vynatix home">
            <svg class="vx-wordmark" viewBox="0 0 2654.79 653.758" width="162" height="40" aria-hidden="true" focusable="false"><use href="#vx-wordmark"/></svg>
          </a>
          <p class="site-footer__about">A Nordic software consultancy. Senior engineers, embedded in your team, and work you can read afterwards.</p>
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
            <li><a href="services.html#application-development">Application development</a></li>
            <li><a href="services.html#ai-engineering">AI engineering</a></li>
            <li><a href="services.html#cloud-platforms">Cloud platforms</a></li>
          </ul>
        </div>
        <div>
          <h2 class="site-footer__h">Company</h2>
          <ul class="site-footer__links list-reset">
            <li><a href="about.html">About</a></li>
            <li><a href="work.html">Work</a></li>
            <li><a href="blog.html">Blog</a></li>
            <li><a href="membership.html">Membership</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
        <div lang="sv">
          <h2 class="site-footer__h">På svenska</h2>
          <ul class="site-footer__links list-reset">
            <li><a href="sv.html" hreflang="sv">Vynatix på svenska</a></li>
            <li><a href="android-automotive-utveckling.html" hreflang="sv">Android Automotive</a></li>
            <li><a href="ai-utveckling.html" hreflang="sv">AI-utveckling</a></li>
            <li><a href="sv.html#guider" hreflang="sv">Guider</a></li>
            <li><a href="integritet.html" hreflang="sv">Integritetsmeddelande</a></li>
          </ul>
        </div>
        <div>
          <h2 class="site-footer__h">Legal</h2>
          <ul class="site-footer__links list-reset">
            <li><a href="privacy.html">Privacy</a></li>
            <li><a href="privacy.html#cookies" data-consent-open>Cookie settings</a></li>
            <li><a href="terms.html">Terms</a></li>
            <li><a href="accessibility.html">Accessibility</a></li>
          </ul>
        </div>
      </div>
      <div class="site-footer__fine">
        <span>© 2026 Vynatix AB</span>
        <span>vynatix.com</span>
      </div>
    </div>
  </footer>'''

# ---------------------------------------------------------------- header
# The one source of the site header, the way FOOTER is the one source of the footer. Every page's header is
# replaced with this on each run (the aria-current link is the page itself), so a nav change is made in NAV
# below, once, and this script run. The skip link and the wordmark <symbol> above the header are still
# copied by hand into every page.
NAV = [('services.html', 'Services'), ('work.html', 'Work'), ('blog.html', 'Blog'), ('about.html', 'About'), ('contact.html', 'Contact')]
MENU_CTA = ('contact.html', 'Get in touch')   # the extra link the mobile menu shows
HEADER = '''  <!-- ============================================================ Header -->
  <header class="site-header" role="banner" lang="en">
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

def header_for(f):
    rows = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == f else ''
        rows.append(f'          <li><a href="{href}" class="site-header__link"{cur}>{label}</a></li>')
    rows.append(f'          <li class="site-header__menu-cta"><a href="{MENU_CTA[0]}" class="site-header__link">{MENU_CTA[1]}</a></li>')
    return HEADER.replace('@@NAV@@', '\n'.join(rows))

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
    m = re.search(r'(\s*<main id="main">.*?</main>)', s, re.S); return m.group(1) if m else ''

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
    p = PAGES[f]; t = STUB[p['lang']]
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
    t = STUB[PAGES[f]['lang']]
    s = re.sub(r'<title>.*?</title>', lambda m: f'<title>{t["title"]}</title>', s, count=1, flags=re.S)
    s = re.sub(r'<meta name="description" content="[^"]*">', lambda m: f'<meta name="description" content="{t["desc"]}">', s, count=1)
    s, n = re.subn(r'(\s*)<main id="main">.*?</main>', lambda m: m.group(1) + stub_main(f).lstrip(), s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f + ': no <main id="main"> to replace with the stub')
    return s

# ---------------------------------------------------------------- pages
def render(f):
    # The page is the source of truth for its title, description and FAQ markup; the head block,
    # the header and the footer are rewritten from them and from the registry. Returns the new text;
    # nothing is written here, so a run that fails on one page has written none.
    s = read(f)
    if PAGES[f]['status'] == 'withdrawn':
        s = withdraw(f, s)
    title = html.unescape(re.search(r'<title>(.*?)</title>', s, re.S).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)">', s).group(1))
    block = head_block(f, title, desc, main_of(s), extra_nodes_for(f))
    s = re.sub(r'\n?<!-- seo -->.*?<!-- /seo -->', '', s, flags=re.S)
    s = re.sub(r'(<meta name="description" content="[^"]*">)', lambda m: m.group(1) + '\n' + block, s, count=1)
    s, n = re.subn(r'  <!-- =+ Footer -->\n  <footer class="site-footer inverse"( lang="en")?>.*?</footer>', lambda m: FOOTER, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f + ': no footer marker ("<!-- ==== Footer -->" then <footer class="site-footer inverse">) to rewrite')
    s, n = re.subn(r'  <!-- =+ Header -->\n  <header class="site-header".*?</header>', lambda m: header_for(f), s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f + ': no header marker ("<!-- ==== Header -->" then <header class="site-header">) to rewrite')
    return s

# ---------------------------------------------------------------- sitemap
def sitemap():
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for f, p in PAGES.items():
        if p['status'] != 'live': continue
        rows.append('  <url>')
        rows.append(f'    <loc>{url_of(f)}</loc>')
        if p['alt']:
            versions = {p['lang']: f, **p['alt']}
            for lang in ('en', 'sv'):
                rows.append(f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{url_of(versions[lang])}"/>')
            rows.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{url_of(versions["en"])}"/>')
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
    for f, p in PAGES.items():
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
    for f, text in rendered.items():
        write(f, text)
        if not CHECK: print('  updated', f)
    sitemap(); lock()
    if CHECK:
        scope = ', '.join(chosen) if only else 'every page'
        if STALE:
            print('stale (a run of tools/seo-head.py would change): ' + ', '.join(STALE))
            sys.exit(1)
        print(f'every generated part is current ({scope}, sitemap.xml, tools/urls.lock)')
    else:
        print('  sitemap.xml'); print('  ' + LOCK.replace(os.sep, '/'))
