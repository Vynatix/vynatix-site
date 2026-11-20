#!/usr/bin/env python3
"""DRAFT TOOLING for the home page proposal. Not part of the site and not run at deploy time.

Copies the live index.html to tools/drafts/home/index.html with four small markup changes (home-draft.css does
the rest), so the draft carries the live page's copy word for word and follows it: run this again after a copy
change.

    python3 tools/drafts/home/build.py        # writes index.html beside this file and prints the copy ledger

The four changes, each one class or one decorative, aria-hidden element:
  1. In numbers: the list takes .metrics--story and its first figure .metric--scale, with a decorative "47" so the
     before and the after can be drawn to scale.
  2. Cases: the list takes .cases--lead, so the first case is the wide one.
  3. Partnership: four frames of the hero's drawing, one stage further in each, under the band's heading.
  4. The contents row is unchanged in markup; the stylesheet stops it pinning.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SRC = (ROOT / 'index.html').read_text(encoding='utf-8')
out = SRC


def swap(old, new, count=1):
    global out
    if out.count(old) < 1:
        sys.exit(f'build.py: not found in index.html: {old!r}')
    out = out.replace(old, new, count)


# 1. In numbers
swap('<dl class="metrics metrics--3">', '<dl class="metrics metrics--3 metrics--story">')
swap('<div class="metric">\n              <dt class="metric__lbl">Minutes per build</dt>',
     '<div class="metric metric--scale">\n              <dt class="metric__lbl">Minutes per build</dt>\n'
     '              <dd class="scale" aria-hidden="true"><span class="scale__n">47</span></dd>')

# 2. Cases
swap('<div class="cases">', '<div class="cases cases--lead">')

# 3. Partnership: the frames go after the band's heading block
i = out.index('id="partnership"')
j = out.index('</section>', i)
band = out[i:j]
k = band.rindex('</div>')            # the band's own closing tag
frames = ('  <div class="grow" aria-hidden="true">\n'
          + ''.join(f'          <span class="fig fig--{n} fig--inverse"></span>\n' for n in (1, 2, 3, 4))
          + '        </div>\n      ')
out = out[:i] + band[:k] + frames + band[k:] + out[j:]

# ---- the head: no search block, not indexable, and the draft's own stylesheet ----------------------------------------------
a = out.index('<!-- seo -->')
b = out.index('<!-- The Vynatix Design System:')
out = out[:a] + '<!-- DRAFT of the home page: built by tools/drafts/home/build.py, never published (tools/ is excluded). -->\n<meta name="robots" content="noindex, nofollow">\n' + out[b:]
out = re.sub(r'<title>.*?</title>', '<title>Draft: home page proposal</title>', out, count=1)
out = re.sub(r'(href|src|srcset)="(?!#|https?:|mailto:|tel:|data:|/)([^"]+)"', r'\1="../../../\2"', out)
swap('<!-- Icons. favicon.svg', '<link rel="stylesheet" href="home-draft.css">\n<!-- Icons. favicon.svg')
(HERE / 'index.html').write_text(out, encoding='utf-8')


# ---- copy ledger: the text of <main>, live against draft ------------------------------------------------------------------
def pieces(html):
    html = html[html.index('<main'):html.index('</main>')]
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    return [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'<[^>]+>', html) if p.strip()]


live, draft = pieces(SRC), pieces(out)
missing = [p for p in dict.fromkeys(live) if p not in set(draft)]
added = [p for p in dict.fromkeys(draft) if p not in set(live)]
print(f'wrote {HERE / "index.html"} ({len(out):,} bytes)')
print(f'copy ledger: {len(set(live))} pieces of text in the live <main>; missing from the draft: {missing or "none"}; added: {added or "none"}')
if len(draft) - len(live) != 1:
    print(f'  note: the draft has {len(draft) - len(live)} more text pieces than the live page (1 expected, the decorative 47)')
