#!/usr/bin/env python3
"""Moves the page registry and the language table of tools/seo-head.py into data files (tools/REFACTORING-PLAN.md,
step 2.1). Python 3, standard library only; run it from anywhere:

    python3 tools/migrate/registry.py [SEO_HEAD]     convert that file (default: tools/seo-head.py of this tree)
    python3 tools/migrate/registry.py -              read a seo-head.py on stdin, write the converted text to stdout
    python3 tools/migrate/registry.py --check [...]  write nothing; exit 1 if a run would change anything
    --site DIR                                       where the data files go (default: site/ beside SEO_HEAD, and
                                                     for -, tools/site of the tree this script is in)

Until step 2.1 the registry was two Python literals in tools/seo-head.py: PAGES, one `'file.html': dict(...)` per
page, and LANGS, one `'xx': dict(...)` per language. This writes each PAGES row to site/pages/<slug>.json (the row of
about.html is about.json), LANGS to site/langs.json, and puts the loader in the place of the two literals, with the
comments above them reworded, so that the file it writes is the file the move commit holds, byte for byte, when it
is given the seo-head.py the move started from.

Why it is a script and not only a commit (tools/REFACTORING-PLAN.md, section 8). Git cannot carry a branch's edit
into the file the text moved to, and it has no base for a file both sides created. So a branch opened before the
move, which changed a row or added a page in the old table, brings main in four steps, settling each merge as
usual (node tools/sync.js carries on with a merge of an earlier commit of main):

    move=$(git log origin/main --diff-filter=A --format=%H -1 -- tools/migrate/registry.py)
    git merge "$move^"                        # 1. main up to the commit the move started from
    git checkout "$move" -- tools/migrate/registry.py
    python3 tools/migrate/registry.py && python3 tools/seo-head.py
    git add -A && git commit                  # 2. the branch's own tree converted
    git merge "$move"                         # 3. the move
    git merge origin/main                     # 4. the rest of main

After step 3, tools/seo-head.py has merged without a conflict, because both sides made the same change there. A
row the branch itself edited is an add/add conflict, confined to the lines it changed: there, and only there, keep
the branch's line, then run seo-head.py and --check. Step 1 is what confines it: without it, every row main changed
after the branch was opened conflicts too, and the branch's side of those is the stale one (tested: five rows whose
dates main had moved, which keeping the branch's line would have moved back).

What it writes. A row holds the keys its literal held and no others (a key left out takes its default, so a row
reads as it did), in the order the comment of the registry documents them. The 34 pages registered when the rows
became files carry `order`, 1 to 34, the order of the table on that day, which is the order of sitemap.xml; ORDER
below is that list, so a row a branch inserted in the middle of its table does not move any other row's number.
Any other page gets no order and sorts after the 34, by pub and then by slug. A comment beside a row, or on a line
of its own inside the table, becomes the row's `note` (the next row's, for a comment on a line of its own); there
were none on the day of the move.

It is idempotent. A table that is no longer a literal is left alone, so a converted file is left as it is, and a
half-converted one (PAGES read from the files, LANGS still a literal) has only LANGS converted. A data file that
already exists must hold exactly what this would write, and the folder must hold no row the table lacks; otherwise
it stops and changes nothing, because the files are then newer than the table (merge the move after running this,
never before). It writes the data files first and seo-head.py last, so a run that stops half way can be run again.

read_tables() is the reader: tools/redate.py uses it when its --base still holds the Python table.
"""
import argparse, ast, io, json, os, sys, tokenize

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)

# The keys of a page row and of a language, in the order the comments of tools/seo-head.py document them.
PAGE_KEYS = ('lang', 'type', 'og', 'pub', 'mod', 'alt', 'article', 'original', 'kind', 'status', 'order', 'note')
LANG_KEYS = ('name', 'tag', 'locale', 'dir', 'kind', 'home', 'status', 'checked', 'by', 'waived', 'pub', 'mod', 'note')

# The 34 pages of the table on the day of the move, in its order (the order of sitemap.xml). Their rows carry this
# place as `order`, whatever table they are read from.
ORDER = [
  'index.html', 'about.html', 'services.html', 'industries.html', 'work.html', 'membership.html', 'contact.html',
  'blog.html', 'privacy.html', 'terms.html', 'accessibility.html', 'sv.html', 'android-automotive-development.html',
  'android-automotive-utveckling.html', 'ai-engineering.html', 'ai-utveckling.html',
  'android-automotive-consultancies-gothenburg.html', 'konsultbolag-android-automotive-goteborg.html',
  'valja-konsultbolag.html', 'platform-engineering.html', 'ai-assistent-interna-dokument.html',
  'ai-konsultbolag-sverige.html', 'choose-a-software-consultancy.html', 'integritet.html', 'testautomatisering.html',
  'systemutveckling.html', 'systemintegration-och-forvaltning.html', 'ai-i-befintlig-produkt.html',
  'fordonsmjukvara.html', 'test-automation.html', 'custom-software-development.html',
  'system-integration-and-maintenance.html', 'ai-in-your-existing-product.html', 'automotive-software.html',
]
assert len(ORDER) == len(set(ORDER)) == 34

# ------------------------------------------------------------------------------------------------ the reader
class TableError(Exception):
    """A table that cannot be read as plain data."""


def _value(node, where):
    """The value of a literal in the table: a string, a number, True or False, a {...} or a dict(...) of them."""
    if isinstance(node, ast.Constant) and isinstance(node.value, (str, bool, int, float)):
        return node.value
    if isinstance(node, ast.Dict):
        out = {}
        for k, v in zip(node.keys, node.values):
            if not (isinstance(k, ast.Constant) and isinstance(k.value, str)):
                raise TableError(f'{where}, line {node.lineno}: a key that is not a quoted string')
            if k.value in out:
                raise TableError(f'{where}, line {k.lineno}: {k.value} is given twice')
            out[k.value] = _value(v, where)
        return out
    if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'dict'
            and not node.args and all(kw.arg for kw in node.keywords)):
        out = {}
        for kw in node.keywords:
            if kw.arg in out:
                raise TableError(f'{where}, line {kw.value.lineno}: {kw.arg} is given twice')
            out[kw.arg] = _value(kw.value, where)
        return out
    raise TableError(f'{where}, line {getattr(node, "lineno", "?")}: {ast.dump(node)[:60]} is not plain data')


def _assignment(tree, name):
    """The top-level `NAME = ...` statement of the module, or None."""
    for node in tree.body:
        if (isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name)
                and node.targets[0].id == name):
            return node
    return None


def _comments(source):
    """{line number: comment text without its #} for every comment in the source."""
    out = {}
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        if tok.type == tokenize.COMMENT:
            out[tok.start[0]] = tok.string.lstrip('#').strip()
    return out


def read_tables(source):
    """The literal tables of a seo-head.py of any revision: {'PAGES': table or None, 'LANGS': table or None}, where a
    table is a list of (key, row, note) in the order written, a row holds exactly the keys its literal holds, in
    their written order, and note is the text of the comments inside the row's lines or on lines of their own just
    above it ('' when there are none). None means the file holds no literal for that table (it is converted).
    Raises TableError on a table that is not plain data, and SyntaxError on a file that is not Python."""
    tree = ast.parse(source)
    comments = None
    out = {}
    for name in ('PAGES', 'LANGS'):
        node = _assignment(tree, name)
        if node is None or not isinstance(node.value, ast.Dict):
            out[name] = None
            continue
        if comments is None:
            comments = _comments(source)
        d = node.value
        rows = []
        for k, v in zip(d.keys, d.values):
            if not (isinstance(k, ast.Constant) and isinstance(k.value, str)):
                raise TableError(f'{name}, line {d.lineno}: a key that is not a quoted string')
            row = _value(v, name)
            if not isinstance(row, dict):
                raise TableError(f'{name}, line {k.lineno}: the row of {k.value} is not a dict(...)')
            if any(r[0] == k.value for r in rows):
                raise TableError(f'{name}, line {k.lineno}: {k.value} is registered twice')
            rows.append([k.value, row, [], v.end_lineno])
        # A comment belongs to the first row that ends on or after its line (beside a row, or above the next one);
        # one after the last row belongs to the last.
        for line in sorted(l for l in comments if d.lineno < l <= d.end_lineno):
            owner = next((r for r in rows if r[3] >= line), rows[-1] if rows else None)
            if owner is not None and comments[line]:
                owner[2].append(comments[line])
        out[name] = [(k, row, ' '.join(note)) for k, row, note, _ in rows]
    return out


# ------------------------------------------------------------------------------------------------ the writer
def _ordered(row, keys):
    """The row with its keys in the documented order; a key the documentation lacks goes last, in written order."""
    return {**{k: row[k] for k in keys if k in row}, **{k: v for k, v in row.items() if k not in keys}}


def dump(data):
    """A data file as it is committed: two-space JSON, the characters as they are, a newline at the end."""
    return json.dumps(data, indent=2, ensure_ascii=False) + '\n'


def page_files(table):
    """{file name in site/pages/: text} for a PAGES table from read_tables()."""
    out = {}
    for f, row, note in table:
        if not f.endswith('.html') or '/' in f:
            raise TableError(f'PAGES: {f} is not a page at the root (name.html)')
        row = dict(row)
        if f in ORDER:
            row['order'] = ORDER.index(f) + 1
        if note:
            row['note'] = note
        out[f[:-len('.html')] + '.json'] = dump(_ordered(row, PAGE_KEYS))
    return out


def langs_file(table):
    """The text of site/langs.json for a LANGS table from read_tables()."""
    data = {}
    for k, row, note in table:
        row = dict(row)
        if note:
            row['note'] = note
        data[k] = _ordered(row, LANG_KEYS)
    return dump(data)


# ------------------------------------------------------------------------------------------------ the new text
# The loader that takes the place of the PAGES literal. LANGS = load_langs() takes the place of the other one.
LOADER = '''\
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
        if not re.fullmatch(r'[^./][^/]*\\.json', name):
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
'''

# The other edits the move makes to seo-head.py: (what the base holds, what the move commit holds). Each is made
# where its first text is found once; one that is not found (an older revision words it otherwise) is skipped and
# named, and git merges that line as it merges any other.
EDITS = [
  ("word), after moving a page's `mod` date in PAGES because its content changed (`pub`, the date the\n",
   "word), after moving a page's `mod` date in its row because its content changed (`pub`, the date the\n"),
  ("""\
# ---------------------------------------------------------------- registry
# lang: the page language. type: the schema.org page type. og: website|article.
""", """\
# ---------------------------------------------------------------- registry
# Every page written by hand has one row, the file tools/site/pages/<slug>.json (the row of about.html is
# about.json): a JSON object with the keys below, in this order, and only the ones the page needs, because a key
# left out takes its default.
# lang: the page language. type: the schema.org page type. og: website|article.
"""),
  ("""\
#      workTranslation). Default: the English page is the original. Give True on a Swedish original
#      and False on its English twin; exactly one page of each pair must be the original.
# kind: 'post' marks a guide or blog post written after the blog was added (the visible-date check
""", """\
#      workTranslation). Default: the English page is the original. Give true on a Swedish original
#      and false on its English twin; exactly one page of each pair must be the original.
# kind: "post" marks a guide or blog post written after the blog was added (the visible-date check
"""),
  ("""\
# status: 'live' (default) or 'withdrawn'. A withdrawn page keeps its URL but is replaced by a short
#      stub, carries noindex and no hreflang, and is left out of sitemap.xml (and so of llms.txt).
# One entry per line, as written here: tools/verify/_common.js reads this table as text.
# The order here is the order of sitemap.xml.
""", """\
# status: "live" (default) or "withdrawn". A withdrawn page keeps its URL but is replaced by a short
#      stub, carries noindex and no hreflang, and is left out of sitemap.xml (and so of llms.txt).
# order: the page's place in sitemap.xml. The 34 pages registered before the rows became files carry 1 to 34,
#      the order of the table they came from; a new page needs none and comes after them, by pub and then by
#      slug, so two branches that each add a page cannot tie unseen.
# note: a remark for the person who reads the row, where a comment beside it would go; nothing reads it.
# load_pages() reads the rows into PAGES, in that order, which is the order of sitemap.xml, and refuses an
# unknown key or a value of the wrong type; tools/verify/_common.js reads the same files.
"""),
  ("""\
# Every language the site is in, in the order the language list shows them. One entry per line.
# name: the language's own name. tag: the value of lang and hreflang. locale: og:locale. dir: ltr or rtl.
# kind: 'written' (pages written by hand and registered in PAGES above: English and Swedish) or
#       'generated' (every English page except UNTRANSLATED, rebuilt in the folder <code>/ from the
#       catalogue tools/i18n/<code>.json by tools/i18n.py; never edit a generated page).
# A generated language also has:
# status: 'draft' or 'live'. A draft is built and checked but not published: its folder is named in
""", """\
# Every language the site is in, in the order the language list shows them: tools/site/langs.json, one entry per
# language code, each a JSON object of strings with the keys below, in this order. load_langs() above reads it.
# name: the language's own name. tag: the value of lang and hreflang. locale: og:locale. dir: ltr or rtl.
# kind: "written" (pages written by hand and registered in PAGES above: English and Swedish) or
#       "generated" (every English page except UNTRANSLATED, rebuilt in the folder <code>/ from the
#       catalogue tools/i18n/<code>.json by tools/i18n.py; never edit a generated page).
# home: a written language's home page, which the language list links to.
# A generated language also has:
# status: "draft" or "live". A draft is built and checked but not published: its folder is named in
"""),
  ("""\
#       other page links to it, and it has no row in sitemap.xml, llms.txt or tools/urls.lock. 'live'
""", """\
#       other page links to it, and it has no row in sitemap.xml, llms.txt or tools/urls.lock. "live"
"""),
  ("""\
#       back to draft. The brand voice requires a native reader's check first, so 'live' needs:
""", """\
#       back to draft. The brand voice requires a native reader's check first, so "live" needs:
"""),
  ("""\
# pub: the day the language goes live (set it on that day); mod: move it when its catalogue changes.
LANGS = {""", """\
# pub: the day the language goes live (set it on that day); mod: move it when its catalogue changes.
# note: a remark for the person who reads the entry; nothing reads it.
LANGS = {"""),
]


def _span(source, node):
    """(start, end) offsets of a statement, whole lines, its newline included."""
    lines = source.splitlines(keepends=True)
    start = sum(len(l) for l in lines[:node.lineno - 1])
    end = sum(len(l) for l in lines[:node.end_lineno])
    return start, end


def convert(source):
    """(new source, {name: table read}, [notes]). The tables are those read from the literals (None for one already
    converted); new source equals source when there was nothing to convert."""
    tables = read_tables(source)
    notes = []
    if tables['PAGES'] is None and tables['LANGS'] is None:
        return source, tables, notes
    out = source
    for old, new in EDITS:
        n = out.count(old)
        if n == 1:
            out = out.replace(old, new)
        elif n > 1:
            raise TableError(f'the text to reword occurs {n} times: {old.splitlines()[0][:70]}')
        elif new not in out:
            notes.append(f'not reworded (this revision words it otherwise): {old.splitlines()[0][:70]}')
    # The literals, last first so the offsets of the first stay true.
    tree = ast.parse(out)
    spans = []
    if tables['LANGS'] is not None:
        spans.append((_span(out, _assignment(tree, 'LANGS')), 'LANGS = load_langs()\n'))
    if tables['PAGES'] is not None:
        spans.append((_span(out, _assignment(tree, 'PAGES')), LOADER))
    elif 'def load_langs(' not in out:
        raise TableError('PAGES is no longer a literal but there is no load_langs() to read LANGS with')
    for (start, end), text in sorted(spans, reverse=True):
        out = out[:start] + text + out[end:]
    return out, tables, notes


# ------------------------------------------------------------------------------------------------ the command
def plan(source, site):
    """(new source, {path: text} of the data files to write, [notes]). Stops with a message on a data file that
    exists and differs, and on a row in the folder that the table lacks."""
    out, tables, notes = convert(source)
    files = {}
    if tables['PAGES'] is not None:
        folder = os.path.join(site, 'pages')
        want = page_files(tables['PAGES'])
        have = sorted(os.listdir(folder)) if os.path.isdir(folder) else []
        extra = [n for n in have if n not in want]
        if extra:
            raise SystemExit(f'{folder} already holds rows the table lacks ({", ".join(extra[:5])}): the files are newer than '
                             'the table. Run this before merging the move, not after (tools/REFACTORING-PLAN.md, section 8). Nothing was changed.')
        for name, text in want.items():
            files[os.path.join(folder, name)] = text
    if tables['LANGS'] is not None:
        files[os.path.join(site, 'langs.json')] = langs_file(tables['LANGS'])
    for p, text in files.items():
        if os.path.exists(p):
            with open(p, encoding='utf-8') as fh:
                if fh.read() != text:
                    raise SystemExit(f'{p} already exists and holds something other than its row in the table: the files are '
                                     'newer than the table. Run this before merging the move, not after (tools/REFACTORING-PLAN.md, '
                                     'section 8). Nothing was changed.')
    return out, files, notes


def main(argv=None):
    ap = argparse.ArgumentParser(description='Move PAGES and LANGS of tools/seo-head.py into tools/site/ (REFACTORING-PLAN.md, step 2.1).')
    ap.add_argument('seo_head', nargs='?', default=os.path.join(TOOLS, 'seo-head.py'), help='a seo-head.py, or - for stdin')
    ap.add_argument('--site', help='the folder for the data files (default: site/ beside SEO_HEAD; for -, tools/site of this tree)')
    ap.add_argument('--check', action='store_true', help='write nothing; exit 1 if a run would change anything')
    a = ap.parse_args(argv)
    stdin = a.seo_head == '-'
    if stdin:
        source = sys.stdin.read()
        site = a.site or os.path.join(TOOLS, 'site')
    else:
        with open(a.seo_head, encoding='utf-8') as fh:
            source = fh.read()
        site = a.site or os.path.join(os.path.dirname(os.path.abspath(a.seo_head)), 'site')
    try:
        out, files, notes = plan(source, site)
    except TableError as e:
        raise SystemExit(f'cannot read the tables: {e}. Nothing was changed.')
    except SyntaxError as e:
        raise SystemExit(f'cannot read the tables: the file is not Python ({e}); one that still holds conflict markers is '
                         'a merge of the move made before this ran: abort it (git merge --abort), run this, commit, and merge '
                         'again (tools/REFACTORING-PLAN.md, section 8). Nothing was changed.')
    log = sys.stderr
    for n in notes:
        print('note ' + n, file=log)
    changed = out != source or any(not os.path.exists(p) for p in files)
    if a.check:
        print(('a run would convert ' + ('this file' if stdin else a.seo_head)) if changed else 'nothing to convert: the registry is already data', file=log)
        if stdin:
            sys.stdout.write(out)
        return 1 if changed else 0
    for p, text in files.items():
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
    if stdin:
        sys.stdout.write(out)
    elif out != source:
        with open(a.seo_head, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(out)
    if not changed:
        print('nothing to convert: the registry is already data', file=log)
        return 0
    rows = sum(1 for p in files if not p.endswith('langs.json'))
    langs = any(p.endswith('langs.json') for p in files)
    print(f'wrote {rows} page rows{" and the language table" if langs else ""} under {site}; '
          + ('the converted seo-head.py is on stdout' if stdin else f'{a.seo_head} now loads them'), file=log)
    return 0


if __name__ == '__main__':
    sys.exit(main())
