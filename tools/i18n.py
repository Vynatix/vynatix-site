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

One way out of translate="no", and it is the catalogue's to take: an element held that way which
has words of its own (the brand line in the home hero) is an optional message. No language owes
it a translation and none is reported as missing; a catalogue that does carry one releases the
element for that language, and it is then set like any other message, in the page's language.
That is how the brand line is English in Spanish, French and German and has a rendering of its
own in Japanese and Arabic. optional(text) lists these messages; messages.json keeps them apart.

    python3 tools/i18n.py                 per language: messages, missing, obsolete; exits 1 if any is missing
    python3 tools/i18n.py missing <lang>  the missing messages of one language, as a JSON list, and on
                                          stderr the previous wording of each one that replaces a sentence
    python3 tools/i18n.py prune           drop catalogue entries no page uses any more

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
                seen.setdefault(msg, None)
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
                    seen.setdefault(msg, None)
                continue
            if not _held(k):
                walk(k)
    walk(tree.root)
    return list(seen)


PLACEHOLDER = re.compile(r'<(/?)(\d+)(/?)>')
RTL_CHARS = re.compile('[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]')     # Hebrew and Arabic letters


def placeholders(msg):
    return sorted(m.group(0) for m in PLACEHOLDER.finditer(msg))


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
        t = self.cat.get(msg)
        if t is None or not t.strip() or placeholders(t) != placeholders(msg):
            self.missing.append(msg); return None
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
        t = self.cat.get(msg)
        return t if t and t.strip() and placeholders(t) == placeholders(msg) else None

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
    t = catalogue.get(msg)
    return t if t and placeholders(t) == placeholders(msg) else None


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


def problems(msg, t):
    """Why a translation cannot be used, or None."""
    if not isinstance(t, str) or not t.strip():
        return 'empty'
    if placeholders(t) != placeholders(msg):
        return f'placeholders differ: {" ".join(placeholders(msg)) or "none"} expected'
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
        raise SystemExit('usage: python3 tools/i18n.py [missing <lang> | prune]')
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
