#!/usr/bin/env python3
"""Rewrites the generated parts of the twenty-one pages from one registry, so every page agrees
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
  it is not edited in twenty-one files);
- lang="en" on the site header, which stays English on the Swedish pages;
- sitemap.xml, from the registry's mod dates and language pairs.

What it never touches: anything inside <main>, the <title> and the meta description (the page
is the source of truth for both; the block repeats them), and the ?v= stamps on the stylesheets
and app.js.

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
# The order here is the order of sitemap.xml.
PAGES = {
  'index.html':        dict(lang='en', type='WebPage',        og='website', pub='2026-05-14', mod='2026-10-20', alt={'sv': 'sv.html'}),
  'about.html':        dict(lang='en', type='AboutPage',      og='website', pub='2026-06-27', mod='2026-10-20'),
  'services.html':     dict(lang='en', type='WebPage',        og='website', pub='2026-06-27', mod='2026-10-18'),
  'work.html':         dict(lang='en', type='CollectionPage', og='website', pub='2026-06-27', mod='2026-10-18'),
  'membership.html':   dict(lang='en', type='WebPage',        og='website', pub='2026-06-27', mod='2026-10-17'),
  'contact.html':      dict(lang='en', type='ContactPage',    og='website', pub='2026-06-27', mod='2026-10-17'),
  'privacy.html':      dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-10-20', alt={'sv': 'integritet.html'}),
  'terms.html':        dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-08-19'),
  'accessibility.html':dict(lang='en', type='WebPage',        og='website', pub='2026-08-19', mod='2026-10-20'),
  'sv.html':                                    dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-19', alt={'en': 'index.html'}),
  'android-automotive-development.html':        dict(lang='en', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-20', alt={'sv': 'android-automotive-utveckling.html'}),
  'android-automotive-utveckling.html':         dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-20', alt={'en': 'android-automotive-development.html'}),
  'ai-engineering.html':                        dict(lang='en', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-20', alt={'sv': 'ai-utveckling.html'}),
  'ai-utveckling.html':                         dict(lang='sv', type='WebPage', og='website', pub='2026-10-18', mod='2026-10-20', alt={'en': 'ai-engineering.html'}),
  'android-automotive-consultancies-gothenburg.html': dict(lang='en', type='CollectionPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True, alt={'sv': 'konsultbolag-android-automotive-goteborg.html'}),
  'konsultbolag-android-automotive-goteborg.html':    dict(lang='sv', type='CollectionPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True, alt={'en': 'android-automotive-consultancies-gothenburg.html'}),
  'valja-konsultbolag.html':                    dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True),
  'platform-engineering.html':                  dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True),
  'ai-assistent-interna-dokument.html':         dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True),
  'ai-konsultbolag-sverige.html':               dict(lang='sv', type='WebPage', og='article', pub='2026-10-18', mod='2026-10-20', article=True),
  'integritet.html':                            dict(lang='sv', type='WebPage', og='website', pub='2026-10-19', mod='2026-10-19', alt={'en': 'privacy.html'}),
}
for f, p in PAGES.items():
    p.setdefault('alt', {}); p.setdefault('article', False)
assert all('pub' in p and 'mod' in p for p in PAGES.values())

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
    loc = {'en': 'en_GB', 'sv': 'sv_SE'}
    lines = ['<!-- Search and sharing: the canonical address, the other-language version, Open Graph, and',
             '     structured data (a JSON-LD data block: never executed, so script-src does not apply). -->',
             f'<link rel="canonical" href="{u}">']
    if p['alt']:
        versions = {p['lang']: f, **p['alt']}
        for lang in ('en', 'sv'):
            if lang in versions:
                lines.append(f'<link rel="alternate" hreflang="{lang}" href="{url_of(versions[lang])}">')
        lines.append(f'<link rel="alternate" hreflang="x-default" href="{url_of(versions.get("en", f))}">')
    lines += ['<meta name="author" content="Vynatix AB">',
              '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
              f'<meta property="og:type" content="{p["og"]}">',
              '<meta property="og:site_name" content="Vynatix">',
              f'<meta property="og:title" content="{html.escape(title, quote=True)}">',
              f'<meta property="og:description" content="{html.escape(desc, quote=True)}">',
              f'<meta property="og:url" content="{u}">',
              f'<meta property="og:locale" content="{loc[p["lang"]]}">']
    for lang in p['alt']:
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
    if p['alt']:
        other = list(p['alt'].values())[0]
        # The English page is the original; the Swedish page is its translation.
        if p['lang'] == 'sv':
            page["translationOfWork"] = {"@id": url_of(other)}
        else:
            page["workTranslation"] = {"@id": url_of(other)}
    faqs, frag = faq_items(main_html, f)
    graph = [ORGANIZATION, WEBSITE, page]
    if faqs:
        fid = u + '#' + frag
        page["hasPart"] = {"@id": fid}
        graph.append({"@type": "FAQPage", "@id": fid, "url": fid, "inLanguage": p['lang'],
                      "isPartOf": {"@id": u},
                      "mainEntity": [{"@type": "Question", "name": q,
                                      "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})
    if p['article']:
        graph.append({"@type": "Article", "@id": u + "#article", "headline": h1_text(main_html) or title,
                      "description": desc, "inLanguage": p['lang'], "mainEntityOfPage": {"@id": u},
                      "author": {"@id": ORG_ID}, "publisher": {"@id": ORG_ID},
                      "datePublished": p['pub'], "dateModified": p['mod']})
    graph += extra_nodes or []
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

# ---------------------------------------------------------------- read helpers
def read(f): return open(os.path.join(REPO, f), encoding='utf-8').read()
def write(f, s): open(os.path.join(REPO, f), 'w', encoding='utf-8').write(s)

def extra_nodes_for(f):
    """The page's own JSON-LD nodes (Service, ItemList, ...) from tools/seo/<page>.json, if any.
    That file holds either "extra_nodes" (the nodes themselves) or "extra_nodes_from", which names
    where the nodes live, so a node that more than one page carries has one source. Two forms:
      "extra_nodes_from": "services.json", "ids": [...]      one file, and the ids taken from it;
      "extra_nodes_from": [{"file": "services.json", "ids": [...]}, {"file": "work.json", "ids": [...]}]
                                                            several files, each with its own ids.
    Either way a listed id picks the "extra_nodes" entry of that file whose "@id" it is, and the
    nodes come out in the order of the sources and, within one, of its "ids". An id a file does not
    have stops the run."""
    path = os.path.join(SEO_DIR, f[:-len('.html')] + '.json')
    if not os.path.exists(path):
        return None
    data = json.load(open(path, encoding='utf-8'))
    src = data.get('extra_nodes_from')
    if not src:
        return data.get('extra_nodes')
    if isinstance(src, str):
        src = [{'file': src, 'ids': data.get('ids')}]
    elif 'ids' in data:
        raise SystemExit(f + ': a top-level "ids" goes with the string form of extra_nodes_from; '
                         'in the list form each entry carries its own')
    out = []
    for s in src:
        if not isinstance(s, dict) or 'file' not in s or not s.get('ids'):
            raise SystemExit(f + ': each extra_nodes_from entry needs a "file" and a non-empty "ids" list')
        nodes = {n['@id']: n for n in json.load(open(os.path.join(SEO_DIR, s['file']), encoding='utf-8')).get('extra_nodes', [])}
        missing = [i for i in s.get('ids', []) if i not in nodes]
        if missing:
            raise SystemExit(f + ': ' + s['file'] + ' has no node with @id ' + ', '.join(missing))
        out += [nodes[i] for i in s.get('ids', [])]
    return out

def main_of(s):
    m = re.search(r'(\s*<main id="main">.*?</main>)', s, re.S); return m.group(1) if m else ''

# ---------------------------------------------------------------- pages
def update_existing(f):
    # The page is the source of truth for its title, description and FAQ markup; the head block,
    # the footer and the header lang are rewritten from them and from the registry.
    s = read(f)
    title = html.unescape(re.search(r'<title>(.*?)</title>', s, re.S).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)">', s).group(1))
    block = head_block(f, title, desc, main_of(s), extra_nodes_for(f))
    s = re.sub(r'\n?<!-- seo -->.*?<!-- /seo -->', '', s, flags=re.S)
    s = re.sub(r'(<meta name="description" content="[^"]*">)', lambda m: m.group(1) + '\n' + block, s, count=1)
    s = re.sub(r'  <!-- =+ Footer -->\n  <footer class="site-footer inverse"( lang="en")?>.*?</footer>', lambda m: FOOTER, s, count=1, flags=re.S)
    s = s.replace('<header class="site-header" role="banner">', '<header class="site-header" role="banner" lang="en">')
    write(f, s)

# ---------------------------------------------------------------- sitemap
def sitemap():
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for f, p in PAGES.items():
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

if __name__ == '__main__':
    only = [os.path.basename(a) for a in sys.argv[1:]]
    unknown = [f for f in only if f not in PAGES]
    if unknown:
        raise SystemExit('not in PAGES: ' + ', '.join(unknown))
    for f in PAGES:
        if only and f not in only: continue
        update_existing(f); print('  updated', f)
    sitemap(); print('  sitemap.xml')
