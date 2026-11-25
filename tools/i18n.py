#!/usr/bin/env python3
"""The translation engine behind the generated languages. Python 3, standard library only.

The English pages are the source. tools/seo-head.py renders each one, hands the text to this
module, and writes the result to <lang>/<page>.html; nothing here writes a page. What this
module does:

- extract(text): the translatable messages of a page, in document order. A message is the inner
  HTML of the outermost element that holds text of its own (a p, an h2, an li, a link label), or
  the value of a translatable attribute (alt, aria-label, title, placeholder, any data-i18n-*,
  and the content of the meta description). Inline markup inside a message is replaced by
  numbered placeholders, so a translator never sees or breaks an attribute:
      Read <1>the guide</1> or write to us <2/>
  <N>...</N> is an inline element (a link, an em), <N/> one that is carried over whole (an
  icon, a line break, a <code>, anything marked translate="no").
- translate(text, lang, ...): the page in that language. Every message is looked up in the
  catalogue tools/i18n/<lang>.json, which maps the English message to its translation, the way
  gettext does. That is also the drift check: when an English sentence changes, its message is
  no longer in the catalogue, the sentence falls back to English (marked lang="en") and
  `python3 tools/i18n.py` reports it as missing until it is translated again.
- Relative links are rewritten for the language folder: a page that exists in the language
  keeps its name, everything else (stylesheets, images, the English-only notices) gains "../".

What is never translated: scripts, styles, inline SVG, <code>, anything with translate="no"
or with a lang attribute of its own, and messages without a letter in them (figures).

Dates are not part of a message's wording. A date that is the whole text of an inline element (on the
site a <time>, as in the bylines) stands in the message as {date}, so the byline of a guide is
      Published <1>{date}</1>
and the catalogue maps that pattern to its translation once (Publicado el <1>{date}</1>). The date is
then written in the language's own form, from two kinds of message every catalogue carries anyway for
the withdrawn stub: the date pattern ('{d} {month} {y}') and the twelve month names. So a guide that is
re-dated, or a new guide with the byline of the others, needs no new translation in any catalogue. The
rule is exact: a day, an English month name and a year, alone between <N> and </N>; a date anywhere
else stays part of the wording. A translation keeps each {date} in its own pair, wherever it puts the pair.

One way out of translate="no", and it is the catalogue's to take: an element held that way which
has words of its own (the brand line in the home hero) is an optional message. No language owes
it a translation and none is reported as missing; a catalogue that does carry one releases the
element for that language, and it is then set like any other message, in the page's language.
That is how the brand line is English in Spanish, French and German and has a rendering of its
own in Japanese and Arabic. optional(text) lists these messages; messages.json keeps them apart.

    python3 tools/i18n.py                 per language: messages, missing, obsolete; exits 1 if any is missing
    python3 tools/i18n.py missing <lang>  the missing messages of one language, as a JSON list, and on
                                          stderr the previous wording of each one that replaces a sentence
    python3 tools/i18n.py prune           do what `dates` does, then drop catalogue entries no page uses any more
    python3 tools/i18n.py dates           carry each entry whose English still holds a date into its pattern

Dates as patterns arrived in step 2.5 of tools/REFACTORING-PLAN.md. Before it, a catalogue held one entry per
date (Published <1>6 November 2026</1>), and a branch opened before the change may still hold some. `dates`
carries them across: an entry whose English holds a date in a pair gives way to the entry of its pattern, whose
translation is the old one with the date, as that catalogue writes a date, taken out (the pattern takes the place
of the first of its entries, where messages.json lists it too). It drops nothing else and needs no current
messages.json, so it can run first, before tools/seo-head.py, and on a branch between an English edit and its
retranslation. It leaves an entry as it is, and names it, when its translation writes the date in another way or
when the entries of one pattern disagree about the rest of the wording; prune then stops, so that no translation
is lost, until that pattern is translated by hand. prune runs the same step first. A branch opened before the
change runs this before it merges the commit that made the change. Where the branch's catalogues are in the order
prune writes, each pattern then stands on the same line on both sides and the merge is clean (rehearsed with a
branch that had re-dated a guide by hand in five catalogues; merging first instead conflicts in all five there):

    move=$(git log origin/main --format=%H --reverse -S"def patterned" -- tools/i18n.py | head -1)
    git merge "$move^"                        # main up to the commit before the change
    git checkout "$move" -- tools/i18n.py
    python3 tools/i18n.py dates && python3 tools/seo-head.py
    git add -A && git commit                  # the branch's own catalogues in the new shape
    git merge "$move" && git merge origin/main

The previous wording: when an English sentence changes, its old entry stays in the catalogue as an
obsolete (stale) entry until prune drops it. `missing` looks among them for the one closest to each
missing message (difflib, a ratio of at least SIMILAR, an entry of the same page first) and prints its
old English and its translation, so a retranslation starts from the sentence before, not from nothing.
So run prune after the retranslation, not before. stdout stays the bare JSON list, which can be written
to a file; the previous wording goes to stderr.

tools/i18n/messages.json (written by tools/seo-head.py, never by hand) lists every message and
the pages it is on. See AGENTS.md, "Languages".
"""
import difflib, html, json, os, re, sys
from html.parser import HTMLParser

EXEC = os.path.dirname(os.path.abspath(__file__))
I18N_DIR = os.path.join(EXEC, 'i18n')
MESSAGES = os.path.join(I18N_DIR, 'messages.json')

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
SKIP = {'script', 'style'}                       # never looked into
OPAQUE = {'svg', 'code', 'kbd', 'samp', 'var'}   # carried over whole, as <N/> inside a message
ATTRS = ('alt', 'aria-label', 'aria-valuetext', 'title', 'placeholder')
URL_ATTRS = ('href', 'src', 'poster', 'action')
# Elements that should not turn up inside a message: one that does means the page has loose text
# beside a block, and the whole block would become one message.
BLOCKS = {'p', 'div', 'section', 'ul', 'ol', 'li', 'table', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'header', 'footer', 'main', 'nav', 'article', 'aside', 'form', 'fieldset', 'dl', 'figure'}


class Node:
    __slots__ = ('tag', 'attrs', 'start', 'inner', 'inner_end', 'end', 'kids', 'text', 'raw', 'parent', 'void')

    def __init__(self, tag, attrs, start, raw, parent, void=False):
        self.tag = tag; self.attrs = dict(attrs); self.start = start; self.raw = raw
        self.inner = start + len(raw); self.inner_end = self.inner; self.end = self.inner
        self.kids = []; self.text = False; self.parent = parent; self.void = void


class _Tree(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.src = text
        self.lines = [0]
        for m in re.finditer('\n', text):
            self.lines.append(m.end())
        self.root = Node('#root', [], 0, '', None)
        self.root.inner = 0
        self.cur = self.root
        self.feed(text); self.close()
        self.root.inner_end = self.root.end = len(text)

    def pos(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.pos(), self.get_starttag_text(), self.cur, void=tag in VOID)
        self.cur.kids.append(n)
        if not n.void:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        n = Node(tag, attrs, self.pos(), self.get_starttag_text(), self.cur, void=True)
        self.cur.kids.append(n)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is self.root:
            return                                   # a stray end tag: left where it is
        p = self.pos()
        close = self.src.index('>', p) + 1
        m = self.cur
        while m is not n:                            # an element left open closes here
            m.inner_end = m.end = p; m = m.parent
        n.inner_end = p; n.end = close
        self.cur = n.parent

    def _mark(self):
        if self.cur.tag not in SKIP:
            self.cur.text = True

    def handle_data(self, d):
        if d.strip():
            self._mark()

    def handle_entityref(self, name): self._mark()
    def handle_charref(self, name): self._mark()


def _held(n):
    """An element whose words stay as they are: translate="no", or a language of its own."""
    return n.attrs.get('translate') == 'no' or ('lang' in n.attrs and n.tag != 'html')


def _is_opaque(n):
    return n.void or n.tag in OPAQUE or n.tag in SKIP or _held(n)


def _attr_span(raw, name):
    """(start, end) of the value of attribute `name` in a raw start tag, or None."""
    m = re.search(r'\s' + re.escape(name) + r'\s*=\s*"([^"]*)"', raw)
    return (m.start(1), m.end(1)) if m else None


def _norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def _wordless(msg):
    return not re.search(r'[^\W\d_]', re.sub(r'</?\d+/?>|&[#\w]+;', '', msg))


def _message(src, n):
    """The message of unit n and the pieces its placeholders stand for:
    (msgid, {N: ('pair', node) | ('whole', node)})."""
    parts = []; pieces = {}; count = [0]

    def walk(node):
        at = node.inner
        for k in node.kids:
            parts.append(src[at:k.start])
            count[0] += 1; i = count[0]
            if _is_opaque(k):
                pieces[i] = ('whole', k); parts.append(f'<{i}/>')
            else:
                pieces[i] = ('pair', k); parts.append(f'<{i}>'); walk(k); parts.append(f'</{i}>')
            at = k.end
        parts.append(src[at:node.inner_end])
    walk(n)
    text = re.sub(r'<!--.*?-->', '', ''.join(parts), flags=re.S)
    return _norm(text), pieces


def _attr_messages(n):
    """[(attribute, raw value)] of the translatable attributes of one element."""
    out = []
    names = [a for a in n.attrs if a in ATTRS or a.startswith('data-i18n-')]
    if n.tag == 'meta' and n.attrs.get('name') == 'description':
        names.append('content')
    for a in names:
        span = _attr_span(n.raw, a)
        if span and n.raw[span[0]:span[1]].strip():
            out.append((a, n.raw[span[0]:span[1]]))
    return out


def _units(root):
    """Every element in document order with what it is: 'unit' (a message), 'held' or 'plain'."""
    out = []

    def walk(n, inside_held):
        for k in n.kids:
            if k.tag in SKIP:
                continue
            held = inside_held or _held(k)
            if k.tag in OPAQUE:
                out.append(('opaque', k)); continue
            if k.text and not held and not k.void:
                out.append(('unit', k)); continue
            out.append(('held' if held else 'plain', k))
            walk(k, held)
    walk(root, False)
    return out


def _descend(n):
    for k in n.kids:
        yield k
        if k.tag not in SKIP:
            yield from _descend(k)


def extract(text):
    """The messages of a page in document order (duplicates removed), and warnings."""
    tree = _Tree(text); seen = {}; warn = []
    for kind, n in _units(tree.root):
        if kind in ('unit', 'plain'):
            for a, v in _attr_messages(n):
                seen.setdefault(_norm(v), None)
        if kind == 'unit':
            msg, pieces = _message(text, n)
            for i, (how, k) in pieces.items():
                if k.tag in BLOCKS:
                    warn.append(f'<{n.tag}> holds loose text beside a <{k.tag}>: "{msg[:60]}"')
                if how == 'pair':
                    for a, v in _attr_messages(k):
                        seen.setdefault(_norm(v), None)
                    for d in _descend(k):
                        if not _is_opaque(d) or d.void:
                            for a, v in _attr_messages(d):
                                seen.setdefault(_norm(v), None)
            if not _wordless(msg):
                seen.setdefault(frame(msg)[0], None)       # a date in its own element is not part of the wording
    return [m for m in seen if not _wordless(m)], warn


def _releasable(n):
    """Held by translate="no" and with words of its own: a catalogue may carry it (an optional message)."""
    return n.attrs.get('translate') == 'no' and n.text and not n.void and n.tag not in OPAQUE and n.tag not in SKIP


def optional(text):
    """The optional messages of a page: the outermost translate="no" elements with words of their own."""
    tree = _Tree(text); seen = {}

    def walk(n):
        for k in n.kids:
            if k.tag in SKIP or k.tag in OPAQUE:
                continue
            if _releasable(k):
                msg, _ = _message(text, k)
                if not _wordless(msg):
                    seen.setdefault(frame(msg)[0], None)
                continue
            if not _held(k):
                walk(k)
    walk(tree.root)
    return list(seen)


PLACEHOLDER = re.compile(r'<(/?)(\d+)(/?)>')
RTL_CHARS = re.compile('[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]')     # Hebrew and Arabic letters


def placeholders(msg):
    return sorted(m.group(0) for m in PLACEHOLDER.finditer(msg))


# ---------------------------------------------------------------- dates
# The English month names and the English form of a date, as tools/seo-head.py has them (MONTHS['en'] and
# DATE_PATTERN), which puts them in messages.json for translation. This module reads a date with them and finds the
# language's own form under them in the catalogue; seo-head.py stops if its copies and these differ.
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
          'November', 'December']
DATE_PATTERN = '{d} {month} {y}'      # a translation may use {m}, the month as a number, instead of {month}
DATE_IN_PAIR = re.compile(r'<(\d+)>(\d{1,2}) (' + '|'.join(MONTHS) + r') (\d{4})</\1>')
SLOT = re.compile(r'<(\d+)>\{date\}</\1>')


def frame(msg):
    """A message as the catalogues key it, and its dates: (the message with each date that is the whole text of a
    numbered pair replaced by {date}, {pair number: (year, month, day)}). A message without one is its own key."""
    dates = {}

    def cut(m):
        dates[m.group(1)] = (int(m.group(4)), MONTHS.index(m.group(3)) + 1, int(m.group(2)))
        return f'<{m.group(1)}>{{date}}</{m.group(1)}>'
    return DATE_IN_PAIR.sub(cut, msg), dates


def slots(msg):
    """The numbers of the pairs that hold a {date}, sorted: a translation keeps each one in its own pair."""
    return sorted(m.group(1) for m in SLOT.finditer(msg))


def _dates_kept(key, t):
    return slots(t) == slots(key) and t.count('{date}') == key.count('{date}')


def write_date(cat, y, m, d):
    """One date in the catalogue's language, from its date pattern and month names: (text, None), or (None, the
    message the catalogue lacks for it). No English stands in for a missing part: the message is then missing."""
    pattern = cat.get(DATE_PATTERN)
    if not isinstance(pattern, str) or not pattern.strip():
        return None, DATE_PATTERN
    month = cat.get(MONTHS[m - 1])
    if '{month}' in pattern and (not isinstance(month, str) or not month.strip()):
        return None, MONTHS[m - 1]
    try:
        return pattern.format(d=d, m=m, month=month, y=y), None
    except (KeyError, IndexError, ValueError):
        return None, DATE_PATTERN


def translation(cat, msg):
    """The catalogue's translation of one message, with its dates written in the language: (text, None), or
    (None, what is missing or unusable: the message's key, or the date pattern or month name a date of it needs)."""
    key, dates = frame(msg)
    t = cat.get(key)
    if not isinstance(t, str) or not t.strip() or placeholders(t) != placeholders(key) or not _dates_kept(key, t):
        return None, key
    for n, (y, m, d) in dates.items():
        w, lack = write_date(cat, y, m, d)
        if w is None:
            return None, lack
        t = t.replace(f'<{n}>{{date}}</{n}>', f'<{n}>{w}</{n}>', 1)
    return t, None


class Page:
    """One translation of one page."""

    def __init__(self, text, catalogue, source_lang='en', url=None, start_tag=None, rtl=False):
        self.src = text; self.cat = catalogue; self.source_lang = source_lang; self.rtl = rtl
        self.url = url or (lambda value, node: value)
        self.start_tag = start_tag or (lambda raw, node: raw)
        self.missing = []; self.tree = _Tree(text)

    def lookup(self, msg):
        if _wordless(msg):
            return msg
        t, lack = translation(self.cat, msg)
        if t is None:
            self.missing.append(lack)
        return t

    def tag(self, n, mark_source=False, translate_attrs=True, ltr=False):
        raw = n.raw
        if ltr and 'dir' not in n.attrs and not mark_source:
            raw = re.sub(r'^<([\w-]+)', lambda m: f'<{m.group(1)} dir="ltr"', raw, count=1)
        if translate_attrs:
            for a, v in _attr_messages(n):
                t = self.lookup(_norm(v))
                if t is not None:
                    s, e = _attr_span(raw, a)
                    raw = raw[:s] + t.replace('"', '&quot;') + raw[e:]
        for a in URL_ATTRS:
            span = _attr_span(raw, a)
            if span:
                raw = raw[:span[0]] + self.url(raw[span[0]:span[1]], n) + raw[span[1]:]
        if mark_source and 'lang' not in n.attrs and n.tag != 'title':
            raw = re.sub(r'^<([\w-]+)', lambda m: f'<{m.group(1)} lang="{self.source_lang}" dir="ltr"', raw, count=1)
        return self.start_tag(raw, n)

    def whole(self, n, translate_attrs=False):
        """An element carried over as it is: only its links are rewritten."""
        if n.void:
            return self.tag(n, translate_attrs=translate_attrs)
        mark = _held(n) and n.attrs.get('translate') == 'no'
        out = [self.tag(n, mark_source=mark, translate_attrs=False)]
        at = n.inner
        for k in n.kids:
            out.append(self.src[at:k.start]); out.append(self.whole(k)); at = k.end
        out.append(self.src[at:n.inner_end]); out.append(self.src[n.inner_end:n.end])
        return ''.join(out)

    def released(self, n):
        """The catalogue's translation of an optional message (a translate="no" element), or None."""
        if not _releasable(n):
            return None
        msg, _ = _message(self.src, n)
        return translation(self.cat, msg)[0]

    def unit(self, n, release=False):
        msg, pieces = _message(self.src, n)
        t = self.released(n) if release else self.lookup(msg)
        if t is None:                                     # not translated: the English, marked as English
            return self.plain(n, mark_source=True, units=False)
        inner = self.src[n.inner:n.inner_end]
        lead = inner[:len(inner) - len(inner.lstrip())]; trail = inner[len(inner.rstrip()):]

        def piece(m):
            how, k = pieces[int(m.group(2))]
            if how == 'whole':
                return self.whole(k, translate_attrs=True)
            return self.src[k.inner_end:k.end] if m.group(1) else self.tag(k)
        # On a right-to-left page a message that stays in Latin script (a name, "© 2026 Vynatix AB") keeps its
        # own order: without dir="ltr" the line's direction would reorder its figures and marks.
        ltr = self.rtl and n.tag != 'title' and not RTL_CHARS.search(t) and re.search(r'[A-Za-z]', PLACEHOLDER.sub('', t))
        start = self.tag(n, ltr=bool(ltr))
        if release:                                       # now in the page's language: no longer held
            start = re.sub(r'\s+translate="no"', '', start, count=1)
        return start + lead + PLACEHOLDER.sub(piece, t) + trail + self.src[n.inner_end:n.end]

    def plain(self, n, mark_source=False, units=True):
        out = [] if n.tag == '#root' else [self.tag(n, mark_source=mark_source)]
        at = n.inner
        for k in n.kids:
            out.append(self.src[at:k.start]); out.append(self.node(k, units)); at = k.end
        out.append(self.src[at:n.inner_end]); out.append(self.src[n.inner_end:n.end])
        return ''.join(out)

    def node(self, n, units=True):
        if n.tag in SKIP or n.tag in OPAQUE or n.void:
            return self.whole(n, translate_attrs=n.void)
        if _held(n):
            return self.unit(n, release=True) if units and self.released(n) else self.whole(n)
        if units and n.text:
            return self.unit(n)
        return self.plain(n, units=units)

    def render(self):
        return self.plain(self.tree.root)


def translate(text, catalogue, source_lang='en', url=None, start_tag=None, rtl=False):
    """(the translated page, the messages that had no translation)."""
    p = Page(text, catalogue, source_lang, url, start_tag, rtl)
    out = p.render()
    return out, list(dict.fromkeys(p.missing))


def translate_message(msg, catalogue):
    """One message outside a page (structured data, the withdrawn stub); None when missing."""
    if _wordless(msg):
        return msg
    return translation(catalogue, msg)[0]


# ---------------------------------------------------------------- catalogues
def load(lang):
    path = os.path.join(I18N_DIR, lang + '.json')
    if not os.path.exists(path):
        return {}
    return json.load(open(path, encoding='utf-8'))


def save(lang, cat):
    os.makedirs(I18N_DIR, exist_ok=True)
    with open(os.path.join(I18N_DIR, lang + '.json'), 'w', encoding='utf-8') as fh:
        json.dump(cat, fh, ensure_ascii=False, indent=1); fh.write('\n')


def messages():
    return json.load(open(MESSAGES, encoding='utf-8'))


def patterned(cat):
    """The catalogue with its entries of the shape before dates were patterns carried into their patterns (see
    `dates` at the head of this file): (the new catalogue, the number of entries carried, [(pattern, note)] on the
    entries left as they are). An entry Published <1>6 November 2026</1> gives way to Published <1>{date}</1>, whose
    translation is the old one with the date, written as this catalogue writes a date, taken out; the pattern stands
    where the first of its entries stood. A pattern the catalogue already holds is left alone, and its old entries
    for prune. An entry is carried only if the pattern, filled with its date, gives back its translation exactly."""
    found = {}
    for k, t in cat.items():
        key, dates = frame(k)
        if key == k or key in cat or not isinstance(t, str):
            continue
        out = t
        for n, (y, m, d) in dates.items():
            w, _ = write_date(cat, y, m, d)
            whole = f'<{n}>{w}</{n}>'
            if w is None or out.count(whole) != 1:
                out = None; break
            out = out.replace(whole, f'<{n}>{{date}}</{n}>')
        if out is not None and translation({**cat, key: out}, k)[0] != t:
            out = None
        found.setdefault(key, []).append((k, out))
    take, notes = {}, []
    for key, entries in found.items():
        derived = list(dict.fromkeys(o for _, o in entries))
        if None in derived:
            bad = [k for k, o in entries if o is None]
            notes.append((key, f'{json.dumps(bad[0], ensure_ascii=False)}: its translation does not write the date the way '
                               'the date pattern and month names of this catalogue do'))
        elif len(derived) > 1:
            notes.append((key, f'{json.dumps(key, ensure_ascii=False)}: its {len(entries)} entries differ in more than the date'))
        else:
            take[key] = derived[0]
    out = {}
    for k, t in cat.items():
        key = frame(k)[0]
        if key in take:
            out.setdefault(key, take[key])
        else:
            out[k] = t
    return out, sum(len(found[key]) for key in take), notes


def problems(msg, t):
    """Why a translation cannot be used, or None."""
    if not isinstance(t, str) or not t.strip():
        return 'empty'
    if placeholders(t) != placeholders(msg):
        return f'placeholders differ: {" ".join(placeholders(msg)) or "none"} expected'
    if not _dates_kept(msg, t):
        return 'a {date} has left its pair: ' + (' '.join(f'<{n}>{{date}}</{n}>' for n in slots(msg)) or 'none') + ' expected'
    rest = PLACEHOLDER.sub('', t)
    if '<' in rest or '>' in rest:
        return 'markup other than the numbered placeholders'
    if re.search(r'&(?![#\w]+;)', rest):
        return 'a bare & (write &amp;)'
    return None


def status(lang):
    data = messages(); cat = load(lang); ids = [m['id'] for m in data['messages']]
    missing = [i for i in ids if i not in cat]
    broken = {i: problems(i, cat[i]) for i in ids if i in cat and problems(i, cat[i])}
    optional_ids = set(data.get('optional', []))           # may be translated, never owed
    broken.update({i: problems(i, cat[i]) for i in optional_ids if i in cat and problems(i, cat[i])})
    obsolete = [i for i in cat if i not in set(ids) and i not in optional_ids]
    return ids, missing, broken, obsolete


# ---------------------------------------------------------------- the previous wording
SIMILAR = 0.6      # the difflib ratio from which a stale entry is offered as the sentence a message replaced


def stale(lang):
    """The stale entries of one catalogue, those whose English is no longer a current message, as
    [(English, translation, pages)] in catalogue order. A stale entry has left messages.json, so its pages
    are inferred: those of the nearest current entry before it and after it in the catalogue. That holds
    because prune writes a catalogue in the order of messages.json, which is page by page, and a sentence
    that changes keeps its old entry where it was. The inference only ranks the candidates (previous()),
    it never removes one, so a catalogue in another order costs the preference and nothing else."""
    data = messages(); cat = load(lang)
    pages = {m['id']: m['pages'] for m in data['messages']}
    keep = set(pages) | set(data.get('optional', []))
    keys = list(cat); out = []
    for at, k in enumerate(keys):
        if k in keep or not isinstance(cat[k], str) or not cat[k].strip():
            continue
        before = next((keys[i] for i in range(at - 1, -1, -1) if keys[i] in pages), None)
        after = next((keys[i] for i in range(at + 1, len(keys)) if keys[i] in pages), None)
        out.append((k, cat[k], list(dict.fromkeys(pages.get(before, []) + pages.get(after, [])))))
    return out


def previous(lang, missing):
    """For each missing message that has one, the stale entry closest to it, as
    [(message, old English, old translation, ratio, pages in common, pages of the stale entry)].
    Closest: a stale entry on a page the message is on beats one that is not, then the higher ratio wins,
    then the earlier entry. Below SIMILAR nothing is offered, so a sentence that is new is shown alone.
    autojunk is off: with it on, a message of 200 characters or more treats its common letters as junk
    and a rewritten paragraph can fall far under the threshold (0.06 instead of 0.40 for one pair)."""
    old = stale(lang)
    if not old:
        return []
    where = {m['id']: set(m['pages']) for m in messages()['messages']}
    out = []
    for msg in missing:
        best = None; on = where.get(msg, set())
        sm = difflib.SequenceMatcher(None, autojunk=False)
        sm.set_seq2(msg)                                   # difflib caches what it learns of the second sequence
        for english, t, near in old:
            same = any(p in on for p in near)
            sm.set_seq1(english)
            # real_quick_ratio() and quick_ratio() are cheap upper bounds of ratio(): a candidate is dropped at
            # the first of the three that is under SIMILAR or cannot beat the best so far (a tie keeps the earlier).
            for bound in (sm.real_quick_ratio, sm.quick_ratio, sm.ratio):
                r = bound()
                if r < SIMILAR or (best and (same, r) <= best[0]):
                    break
            else:
                best = ((same, r), english, t, near)
        if best:
            (_, r), english, t, near = best
            out.append((msg, english, t, r, [p for p in near if p in on], near))
    return out


def _pages_note(pages):
    return ', '.join(pages[:3]) + (f' and {len(pages) - 3} more' if len(pages) > 3 else '')


if __name__ == '__main__':
    args = sys.argv[1:]
    data = messages()
    langs = data['languages']
    if args[:1] == ['missing']:
        if len(args) != 2 or args[1] not in langs:
            raise SystemExit('usage: python3 tools/i18n.py missing <' + '|'.join(langs) + '>')
        ids, missing, broken, _ = status(args[1])
        print(json.dumps(missing + list(broken), ensure_ascii=False, indent=1))
        # The previous wording goes to stderr, so that stdout stays the JSON list above, byte for byte.
        hints = previous(args[1], missing)
        if hints:
            sys.stdout.flush()
            q = lambda s: json.dumps(s, ensure_ascii=False)
            err = lambda s='': print(s, file=sys.stderr)
            err(f'\nThe previous wording, for {len(hints)} of the {len(missing)} missing: the closest stale entry of '
                f'tools/i18n/{args[1]}.json (difflib ratio {SIMILAR} or more, an entry of the same page first). '
                'Start the new translation from the old one.')
            for msg, english, t, r, common, near in hints:
                err(); err(f' missing  {q(msg)}'); err(f' was      {q(english)}'); err(f' {args[1]} was   {q(t)}')
                err(f'          ratio {r:.2f}, ' + (f'the same page ({_pages_note(common)})' if common else
                    f'another page ({_pages_note(near)})' if near else 'its page unknown'))
        sys.exit(0)
    if args[:1] in (['dates'], ['prune']):
        if len(args) != 1:
            raise SystemExit('usage: python3 tools/i18n.py [missing <lang> | prune | dates]')
        current = {m['id'] for m in data['messages']} | set(data.get('optional', []))
        left = []
        for lang in langs:
            cat = load(lang)
            new, carried, notes = patterned(cat)
            if carried:
                save(lang, new)
            if carried or notes or args[0] == 'dates':
                print(f'  {lang}: {carried} entries with a date carried into {len(new) - len(cat) + carried} patterns')
            for key, note in notes:
                print(f'    left as it is: {note}')
                left += [key] if key in current else []
        if args[0] == 'dates':
            sys.exit(0)
        # A messages.json written before dates were patterns lists the old messages, and prune would drop the patterns.
        old = [m['id'] for m in data['messages'] if frame(m['id'])[0] != m['id']]
        if old:
            raise SystemExit(f'prune stopped, nothing dropped: tools/i18n/messages.json still lists {old[0]!r} with its date; '
                             'run python3 tools/seo-head.py first')
        # prune drops what no page uses, and an entry left above may be the only translation a current pattern has.
        if left:
            raise SystemExit('prune stopped, nothing dropped: translate ' + ', '.join(repr(k) for k in dict.fromkeys(left)) +
                             ' by hand from the entries named above, then run it again')
    if args[:1] == ['prune']:
        for lang in langs:
            ids, _, _, obsolete = status(lang)
            cat = load(lang)
            for i in obsolete:
                del cat[i]
            save(lang, {i: cat[i] for i in ids + data.get('optional', []) if i in cat})
            print(f'  {lang}: {len(obsolete)} obsolete entries removed')
        sys.exit(0)
    if args:
        raise SystemExit('usage: python3 tools/i18n.py [missing <lang> | prune | dates]')
    bad = 0
    for lang in langs:
        ids, missing, broken, obsolete = status(lang)
        bad += len(missing) + len(broken)
        print(f'{lang}: {len(ids)} messages, {len(missing)} missing, {len(broken)} unusable, {len(obsolete)} obsolete')
        for i, why in list(broken.items())[:10]:
            print(f'    unusable ({why}): {i[:70]}')
        for i in missing[:5]:
            print(f'    missing: {i[:90]}')
    if bad:
        print('a missing or unusable message is shown in English on the page (python3 tools/i18n.py missing <lang> lists them)')
    sys.exit(1 if bad else 0)
