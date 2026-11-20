#!/usr/bin/env python3
"""DRAFT TOOLING for the home page proposal. Not part of the site and not run at deploy time.

Reassembles the live index.html into tools/drafts/home/index.html: the same copy, word for word, in a new order
and with new wrappers (home-draft.css styles them). Nothing is written by hand here except the wrappers, so the
draft follows index.html: run it again after a copy change.

    python3 tools/drafts/home/build.py        # writes index.html beside this file and prints the copy ledger

The ledger at the end lists every piece of client-view text in the live page that is not in the draft. It should
list only the labels of the old contents row.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SRC = (ROOT / 'index.html').read_text(encoding='utf-8')
L = SRC.split('\n')


def find(needle, start=0, end=None):
    for i in range(start, end if end is not None else len(L)):
        if needle in L[i]:
            return i
    sys.exit(f'build.py: not found in index.html: {needle!r}')


def span(needle, start=0, end=None):
    """(first, last) line numbers of the element opened on the line holding `needle`."""
    i = find(needle, start, end)
    indent = len(L[i]) - len(L[i].lstrip())
    tag = re.match(r'\s*<([a-z0-9]+)', L[i]).group(1)
    if re.search(rf'</{tag}>\s*$', L[i]):
        return i, i
    for j in range(i + 1, len(L)):
        if L[j].startswith(' ' * indent + f'</{tag}>'):
            return i, j
    sys.exit(f'build.py: no closing tag for {needle!r}')


def block(needle, start=0, end=None):
    i, j = span(needle, start, end)
    return '\n'.join(L[i:j + 1])


def line(needle, start=0, end=None):
    return L[find(needle, start, end)].strip()


def inner(html):
    """The text of a one-line element."""
    return re.sub(r'^\s*<[^>]+>|</[^>]+>\s*$', '', html)


# ---- the fixed parts ------------------------------------------------------------------------------------------------
TOC = find('============ On this page')
JOIN = find('============ Joiner view: hero')
pre = '\n'.join(L[:TOC])
post = '\n'.join(L[JOIN:])

# ---- services ---------------------------------------------------------------------------------------------------------
s0, s1 = span('<section class="section view-hire" id="services"')
svc_eyebrow = line('<p class="eyebrow">Services</p>', s0, s1)
svc_h = line('id="services-title"', s0, s1)
svc_lead = line('<p class="section__lead">', s0, s1)
w0, w1 = span('<div class="work-index" id="work">', s0, s1)
wi_eyebrow = line('<p class="eyebrow">Selected work</p>', w0, w1)
wi_h = line('work-index__h', w0, w1)
wi_lead = line('work-index__lead', w0, w1)
wi_list = block('<ol class="work-index__list', w0, w1)
svc_foot = block('<div class="chapter-foot">', s0, s1)


def plate(cid, flip):
    c0, c1 = span(f'id="{cid}">', s0, s1)
    t0, t1 = span('<div class="chapter__text">', c0, c1)
    eyebrow = line('<p class="eyebrow">', t0, t1)
    h3 = line('<h3 class="two-up__h3">', t0, t1)
    body = [L[i].strip() for i in range(t0, t1) if '<p class="two-up__body">' in L[i]]
    more = [L[i].strip() for i in range(t0, t1) if '<a class="more"' in L[i]]
    case = block('<article class="case chapter__case">', c0, c1)
    p0, p1 = span('<div class="panel chapter__panel">', c0, c1)
    label = inner(line('<p class="eyebrow eyebrow--muted">', p0, p1))
    ul = block('<ul>', p0, p1)
    nl = '\n              '
    return f'''
        <div class="plate{' plate--flip' if flip else ''}" id="{cid}">
          <div class="plate__head">
            <div>
              {eyebrow}
              {h3}
            </div>
            {more[0] if more else ''}
          </div>
{case}
          <details class="fold">
            <summary><span class="eyebrow eyebrow--muted">{label}</span></summary>
            <div class="fold__body">
              <div class="fold__text">
              {nl.join(body)}
              </div>
              <div class="panel">
{ul}
              </div>
            </div>
          </details>
        </div>'''


plates = ''.join(plate(cid, i % 2 == 1) for i, cid in enumerate(['application-development', 'ai-engineering', 'cloud-platforms']))

# The peak: the one published before-and-after figure, drawn to scale. Its words are the Volvo Cars case card's.
k0, k1 = span('id="cloud-platforms">', s0, s1)
a0, a1 = span('<article class="case chapter__case">', k0, k1)
peak_meta = inner(line('<span>', a0, a1).split('<svg')[0]).replace('<span>', '').replace('</span>', '')
peak_h = inner(line('<h3><a href="work.html#volvo-cars">', a0, a1))        # the <a> and its text
peak_note = line('<p>Same tests', a0, a1)
peak_metric = inner(line('<p class="case__metric">', a0, a1))

# ---- who we are ---------------------------------------------------------------------------------------------------------
who_top = block('<div class="two-up who__top">').replace('<div class="two-up who__top">', '<div class="two-up who__top" id="who-we-are">')
glance = block('<div class="glance">')

# ---- further reading ----------------------------------------------------------------------------------------------------
reading = block('id="further-reading"').replace('section section--surface view-hire', 'section view-hire')

# ---- how we work: the head becomes the overture, the four steps the stations ---------------------------------------------
h0, h1 = span('id="how-we-work"')
how_head = block('<div class="section__head">', h0, h1)
steps = []
i = h0
for _ in range(4):
    c0, c1 = span('<li class="cap">', i, h1)
    steps.append((inner(line('<span class="cap__num"', c0, c1)), inner(line('<h3>', c0, c1)), inner(line('<p>', c0, c1))))
    i = c1
t0, t1 = span('<div class="container terms">', h0, h1)
terms_intro = line('Vynatix differs from', t0, t1)
terms_table = block('<table class="compare"', t0, t1)
terms_capacity = line('We take on new work only', t0, t1)
terms_writing = line('We are based in Gothenburg', t0, t1)
terms_quote = line('<blockquote>', t0, t1)
terms_photo = block('<figure class="photo">', t0, t1)

# ---- questions ------------------------------------------------------------------------------------------------------------
f0, f1 = span('id="faq"')
faq_head = block('<div class="section__head">', f0, f1)
items = []
i = f0
while True:
    try:
        q0 = next(n for n in range(i, f1) if '<div class="qa__item" data-faq-item>' in L[n])
    except StopIteration:
        break
    q0, q1 = span('<div class="qa__item" data-faq-item>', q0, f1)
    rows = L[q0:q1 + 1]
    rows[0] = rows[0].replace('<div class="qa__item" data-faq-item>', '<details class="qa__item" data-faq-item>')
    rows[1] = re.sub(r'(<h3>.*</h3>)', r'<summary>\1</summary>', rows[1])
    rows[-1] = rows[-1].replace('</div>', '</details>')
    items.append('\n'.join(rows))
    i = q1 + 1
faq_items = '\n'.join(items)

# ---- closing band ---------------------------------------------------------------------------------------------------------
cta = block('id="contact"')
cta = cta.replace('</h2>\n        </div>', '</h2>\n          <span class="fig fig--4 fig--inverse cta-fig" aria-hidden="true"></span>\n        </div>', 1)


def station(n, body, extra_class=''):
    num, title, text = steps[n - 1]
    return f'''
    <!-- ============================================================ Station {num} -->
    <section class="section stop{extra_class} view-hire" id="step-{n}" aria-labelledby="step-{n}-title">
      <span class="datum" aria-hidden="true"><span class="datum__num">{num}</span></span>
      <div class="container">
        <header class="station">
          <div class="station__text">
            <p class="station__num" aria-hidden="true">{num}</p>
            <h2 class="station__title" id="step-{n}-title">{title}</h2>
            <p class="station__body">{text}</p>
          </div>
          <span class="fig fig--{n} station__fig" aria-hidden="true"></span>
        </header>
{body}
      </div>
    </section>
'''


frames = '\n'.join(
    f'          <li class="frame"><a href="#step-{n}"><span class="fig fig--{n}" aria-hidden="true"></span><span class="frame__num" aria-hidden="true">{num}</span><span class="frame__t">{title}</span></a></li>'
    for n, (num, title, _) in enumerate(steps, 1))

overture = f'''    <!-- ============================================================ Overture
         DRAFT. The old "How we work" heading and lead open the page's story, and the four steps become the page's
         four stations: one drawing, one stage further at each. This replaces the pinned contents row, so the header
         is the only thing that ever sticks. -->
    <section class="overture view-hire" id="how-we-work" aria-labelledby="how-it-goes">
      <div class="container">
{how_head}
        <ol class="frames list-reset" role="list">
{frames}
        </ol>
        <div class="overture__notes">
          <p class="eyebrow eyebrow--muted" id="toc-label">On this page</p>
          <ul class="toc__list list-reset" aria-labelledby="toc-label">
            <li><a href="#faq">Common questions</a></li>
            <li><a href="#further-reading">Further reading</a></li>
            <li><a href="#join">For senior engineers</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>
      </div>
    </section>
'''

st1 = station(1, f'''{who_top}
        <div class="pull">
          {terms_quote}
          {terms_capacity}
        </div>''')

st2 = station(2, f'''        <div class="two-up svc-intro" id="services">
          <div>
            {svc_eyebrow}
            {svc_h}
            {svc_lead}
          </div>
          <div class="work-index" id="work">
            <div>
              {wi_eyebrow}
              {wi_h}
              {wi_lead}
            </div>
{wi_list}
          </div>
        </div>
{plates}
{svc_foot}''')

peak = f'''
    <!-- ============================================================ The peak
         DRAFT. The one before-and-after figure the site has published, as two dimension lines drawn to scale
         (6 is 12.8% of 47). Every word is the Volvo Cars case card's. -->
    <section class="peak band--inset inverse view-hire" aria-labelledby="peak-title">
      <p class="eyebrow">{peak_meta}</p>
      <div class="dims" aria-hidden="true">
        <div class="dim dim--before"><span class="dim__val">47</span><span class="dim__line"></span></div>
        <div class="dim dim--after"><span class="dim__val">6</span><span class="dim__line"></span></div>
      </div>
      <div class="peak__foot">
        <h2 class="peak__h" id="peak-title">{peak_h}</h2>
        <div>
          <p class="peak__metric">{peak_metric}</p>
          {peak_note}
        </div>
      </div>
    </section>
'''

st3 = station(3, f'''        <div class="two-up ledger">
          <div>
            {terms_intro}
{terms_table}
            {terms_writing}
          </div>
{terms_photo}
        </div>''')

st4 = station(4, glance)

faq = f'''
    <!-- ============================================================ Common questions
         DRAFT. Each answer folds into a native <details>; the data-faq container and every word are unchanged. -->
    <section class="section view-hire" id="faq" aria-labelledby="faq-title">
      <div class="container">
{faq_head}
        <div class="qa" data-faq>
{faq_items}
        </div>
      </div>
    </section>
'''

main = '\n'.join([overture, st1, st2, peak, st3, st4, faq, '    <!-- ============================================================ Further reading -->', reading, '',
                  '    <!-- ============================================================ Let us talk -->', cta, ''])
out = pre + '\n' + main + '\n' + post

# ---- the head: no search block, not indexable, and the draft's own stylesheet ----------------------------------------------
a = out.index('<!-- seo -->')
b = out.index('<!-- The Vynatix Design System:')
out = out[:a] + '<!-- DRAFT of the home page: built by tools/drafts/home/build.py, never published (tools/ is excluded). -->\n<meta name="robots" content="noindex, nofollow">\n' + out[b:]
out = re.sub(r'<title>.*?</title>', '<title>Draft: home page proposal</title>', out, count=1)
out = re.sub(r'(href|src|srcset)="(?!#|https?:|mailto:|tel:|data:|/)([^"]+)"', r'\1="../../../\2"', out)
out = out.replace('<!-- Icons. favicon.svg', '<link rel="stylesheet" href="home-draft.css">\n<!-- Icons. favicon.svg', 1)
(HERE / 'index.html').write_text(out, encoding='utf-8')

# ---- copy ledger: every piece of client-view text in the live page must be in the draft ------------------------------------
def pieces(html):
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    return [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'<[^>]+>', html) if p.strip()]


live = pieces('\n'.join(L[TOC:JOIN]))
draft = set(pieces(main))
missing = [p for p in dict.fromkeys(live) if p not in draft]
print(f'wrote {HERE / "index.html"} ({len(out):,} bytes)')
print(f'copy ledger: {len(set(live))} pieces of client-view text in the live page, {len(missing)} not in the draft')
for p in missing:
    print('  missing:', p)
