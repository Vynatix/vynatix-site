#!/usr/bin/env python3
"""Cuts the fonts of the scripts Geist does not draw (Japanese, Arabic) from the pages that use them.

The English type is Geist with Fraunces italic as the one accent. Neither has kana, kanji or Arabic
letters, so each of those two languages gets two faces chosen to carry the same two roles:

    Japanese  text    M PLUS 2          a straight, open gothic whose stems track Geist's weight for weight
              accent  Shippori Mincho   an old-style Mincho: the change of genre that the italic is in Latin
    Arabic    text    Noto Sans Arabic  a monoline sans at Geist's weights, one variable file
              accent  Amiri             a book Naskh, against the sans as Fraunces is against Geist

A Japanese family is 4 to 9 MB. The pages are generated, so what they use is known: this script reads
the generated pages, subsets each source to those characters and writes four woff2 files into fonts/.
Latin letters, digits and the brand name are never in them (unicode-range in tokens.css keeps the
faces to their script as well), so Geist draws those in every language.

    python3 tools/lang-fonts.py            cut the four files again (fetches the sources, about 15 MB,
                                           into a cache outside the repo and checks their SHA-256)
    python3 tools/lang-fonts.py --check    no sources needed: exit 1 if a character a page uses is
                                           missing from the shipped file that should draw it

When to run it: after a translation adds a kanji the Japanese text face does not hold, or puts a new
kanji in an accent (an <em> in a headline, a pull quote). `node tools/verify/i18n.js` fails in both
cases and names the characters; it asks the browser which font drew each run, so it is the real gate
and this script's --check is the quick one. Arabic is cut to the whole Arabic-language repertoire and
kana to the whole syllabaries, so ordinary edits need no new cut.

Needs fontTools and brotli, pinned in tools/requirements.txt (pip install -r tools/requirements.txt). Neither is needed by `npm run check`.
AGENTS.md, "Languages" and "Assets", say why these four faces.
"""
import glob, hashlib, io, os, sys, tempfile, urllib.parse, urllib.request
from html.parser import HTMLParser

EXEC = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(EXEC)
FONTS = os.path.join(REPO, 'fonts')
CACHE = os.path.join(tempfile.gettempdir(), 'vynatix-font-sources')
SOURCE = 'https://raw.githubusercontent.com/google/fonts/main/'

# What each script owns. A character outside its language's ranges is not this script's business:
# Latin, digits and shared punctuation are Geist's, and the other languages' names in the footer
# list fall through to the device.
RANGES = {
    'ja': [(0x2E80, 0x2FDF), (0x3000, 0x30FF), (0x31F0, 0x31FF), (0x3400, 0x4DBF), (0x4E00, 0x9FFF),
           (0xF900, 0xFAFF), (0xFF00, 0xFFEF)],
    'ar': [(0x0600, 0x06FF), (0x0750, 0x077F), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)],
}
# Always in the cut, whatever the pages hold today, so that only a new kanji asks for a new cut.
KANA = set(range(0x3041, 0x3097)) | set(range(0x3099, 0x3100)) | set(range(0x3000, 0x3004)) | set(range(0x3008, 0x3012)) | {0x3005, 0x3014, 0x3015, 0x301C, 0xFF01, 0xFF08, 0xFF09, 0xFF0C, 0xFF1A, 0xFF1B, 0xFF1F, 0xFF5E}
ARABIC = set(range(0x0621, 0x063B)) | set(range(0x0640, 0x0653)) | set(range(0x0660, 0x066E)) | {0x060C, 0x061B, 0x061F, 0x0670, 0x0671}
# Japanese: a named list. '*' would pull the width, ruby and vertical alternates in through the
# closure and double the glyph count. Arabic keeps everything: its joining forms are features.
JA_FEATURES = ['ccmp', 'locl', 'kern', 'palt', 'mark', 'mkmk']

FACES = [
    dict(file='mplus2-variable-ja.woff2', lang='ja', role='text', src='ofl/mplus2/MPLUS2[wght].ttf',
         sha256='2e4f45c2391355fb03195da4854ffbe85fea49bfdff5cc51020238083af6b75c', features=JA_FEATURES),
    dict(file='shippori-mincho-500-ja.woff2', lang='ja', role='accent', src='ofl/shipporimincho/ShipporiMincho-Medium.ttf',
         sha256='700e505afc4cded2338eba29478a041e04c1c2ea5114fbb3e0b04e76c302c5d8', features=JA_FEATURES),
    dict(file='noto-sans-arabic-variable-ar.woff2', lang='ar', role='text', src='ofl/notosansarabic/NotoSansArabic[wdth,wght].ttf',
         sha256='63111b5b2e074dd48cc67692e0a2726d86ee94c1c37fe8598257b7b4e87e869e', features=['*'], pin={'wdth': 100}),
    dict(file='amiri-400-ar.woff2', lang='ar', role='accent', src='ofl/amiri/Amiri-Regular.ttf',
         sha256='ab391c4147d054c48976e98322ad0eefe1427aa0e0502a12a4c75d80a70cfcd7', features=['*']),
]

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
SPOKEN = ('alt', 'title', 'aria-label', 'placeholder')


class Page(HTMLParser):
    """The characters a page can put on screen, and those of them set in the editorial face.

    The editorial face is what styles.css and colors_and_type.css give var(--font-editorial): an <em>
    in an h1 or h2, a pull quote (not its <cite>), .editorial and .case__metric--text. The browser
    check in verify/i18n.js reads the computed style, so a selector missed here fails there.
    """
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.text, self.accent = [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag not in VOID:
            self.stack.append((tag, (attrs.get('class') or '').split()))
        for k, v in attrs.items():
            if v and (k in SPOKEN or k.startswith('data-i18n')):
                self.text.append(v)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        tags = [t for t, _ in self.stack]
        if any(t in ('script', 'style', 'head') for t in tags):
            return
        self.text.append(data)
        classes = {c for _, cs in self.stack for c in cs}
        editorial = ('em' in tags and ('h1' in tags or 'h2' in tags)) or ('blockquote' in tags and 'cite' not in tags) \
            or 'editorial' in classes or 'case__metric--text' in classes
        if editorial:
            self.accent.append(data)


def owned(lang, chars):
    return {ord(c) for c in chars if any(a <= ord(c) <= b for a, b in RANGES[lang])}


def page_chars(lang):
    text, accent = set(), set()
    pages = sorted(glob.glob(os.path.join(REPO, lang, '*.html')))
    assert pages, f'{lang}/ holds no pages: run python3 tools/seo-head.py first'
    for path in pages:
        p = Page()
        p.feed(open(path, encoding='utf-8').read())
        text |= set(''.join(p.text))
        accent |= set(''.join(p.accent))
    return owned(lang, text), owned(lang, accent)


def wanted(face):
    text, accent = page_chars(face['lang'])
    always = KANA if face['lang'] == 'ja' else ARABIC
    if face['lang'] == 'ar':            # small enough to hold the language whole, in both faces
        return text | always
    return (text if face['role'] == 'text' else accent) | always


def needed(face):
    """What the pages ask of this face today (the --check, without the always-held sets)."""
    text, accent = page_chars(face['lang'])
    return text if face['role'] == 'text' else accent


def fetch(face):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, os.path.basename(face['src']))
    if not os.path.exists(path):
        url = SOURCE + urllib.parse.quote(face['src'])
        print(f'  fetching {url}')
        with urllib.request.urlopen(url, timeout=300) as r, open(path, 'wb') as out:
            out.write(r.read())
    digest = hashlib.sha256(open(path, 'rb').read()).hexdigest()
    if digest != face['sha256']:
        sys.exit(f"{path}: SHA-256 {digest} is not the recorded {face['sha256']}.\n"
                 'The source changed upstream. Look at what changed, render the pages with it, and only then '
                 'record the new hash in FACES (delete the cached file to fetch again).')
    return path


def cut(face):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    font = TTFont(fetch(face))
    if face.get('pin'):
        font = instancer.instantiateVariableFont(font, face['pin'])
        buf = io.BytesIO(); font.save(buf); buf.seek(0); font = TTFont(buf)    # the subsetter wants a settled gvar
    cmap = font.getBestCmap()
    want = wanted(face)
    missing = sorted(c for c in needed(face) if c not in cmap)
    if missing:
        sys.exit(f"{face['src']} has no glyph for {''.join(map(chr, missing))}: the face cannot set these pages.")
    opts = subset.Options()
    opts.layout_features = face['features']
    opts.flavor = 'woff2'
    opts.hinting = False
    opts.desubroutinize = True
    opts.notdef_outline = True
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]      # the copyright and licence stay in the file
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(c for c in want if c in cmap))
    s.subset(font)
    font.flavor = 'woff2'
    out = os.path.join(FONTS, face['file'])
    font.save(out)
    print(f"  {face['file']:38s} {os.path.getsize(out) / 1024:6.1f} KB  {font['maxp'].numGlyphs} glyphs")


def check():
    from fontTools.ttLib import TTFont
    bad = 0
    for face in FACES:
        path = os.path.join(FONTS, face['file'])
        if not os.path.exists(path):
            print(f"FAIL {face['file']}: not in fonts/"); bad += 1; continue
        cmap = TTFont(path).getBestCmap()
        missing = sorted(c for c in needed(face) if c not in cmap)
        if missing:
            bad += 1
            print(f"FAIL {face['file']}: the {face['lang']}/ pages set {''.join(map(chr, missing))} in the {face['role']} face "
                  'and the file has no glyph for it. Run python3 tools/lang-fonts.py.')
        else:
            print(f"ok   {face['file']}: holds all {len(needed(face))} characters the {face['lang']}/ pages set in the {face['role']} face")
    return bad


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(1 if check() else 0)
    print('Cutting the script faces from the generated pages:')
    for f in FACES:
        cut(f)
    sys.exit(1 if check() else 0)
