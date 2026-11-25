#!/usr/bin/env python3
"""Moves what the lists of guides hold, and in what order, into tools/site/lists.json (tools/REFACTORING-PLAN.md,
step 2.4, part b). Python 3, standard library only; run it from anywhere:

    python3 tools/migrate/lists.py [ROOT]      convert the tree at ROOT (default: the tree this script is in)
    python3 tools/migrate/lists.py --check     write nothing; exit 1 if a run would change anything

Until step 2.4 the order of every list was only the order of its copy: the hub lists on blog.html (#english,
#swedish), index.html (ul.reads in #insights) and sv.html (ul.reads in #guider), the guide lines of llms.txt, and
the ItemList of blog.html, whose items tools/seo/blog.json held by hand. From the move on, tools/site/lists.json
holds one ordered list of slugs per list, tools/seo-head.py writes the guide lines of llms.txt and the items of
the ItemList from it, and tools/seo/blog.json keeps the rest of the ItemList node. This reads the old shape of any
revision and writes lists.json, then takes numberOfItems and itemListElement out of tools/seo/blog.json, so that
the files it writes are the files the move commit holds, byte for byte, when it is run on the tree the move
started from.

What it reads, the way tools/verify/copies.js reads the lists. An entry's title and description are its text
with the entities decoded and the white space run together, and a guide line of llms.txt without ": description"
has the description "". Where a copy differs from its page's <title> (without ", Vynatix") or meta description,
the entry is written as {"slug": ..., "override": {...}} with the text the copy holds, so that the generator
writes the same bytes; those are the differences EXCEPTIONS in copies.js records. A guide line of llms.txt is a
line above the generated languages that links a page whose row has "article": true, as seo-head.py reads it. It
stops and changes nothing on anything the generator could not write back exactly: a date on a home page that is
not the page's pub, an ItemList item that is not {"@type": "ListItem", "position": n, "item": {"@type": "Article",
"@id": url#article, "url": url, "name": ..., "inLanguage": its language}}, numberOfItems that is not the count or
not just before itemListElement at the end of the node, a guide line that is not "- [title](url): description"
exactly, guide lines that do not stand in one unbroken run in the section of their own language, and a list that
names a withdrawn page.

Why it is a script and not only a commit (tools/REFACTORING-PLAN.md, section 8). Git cannot carry a branch's edit
into the file the text moved to, and it has no base for a file both sides created. So a branch opened before the
move, which added a guide or reordered a list, brings main in four steps, settling each merge as usual (node
tools/sync.js carries on with a merge of an earlier commit of main):

    move=$(git log origin/main --diff-filter=A --format=%H -1 -- tools/migrate/lists.py)
    git merge "$move^"                        # 1. main up to the commit the move started from
    git checkout "$move" -- tools/migrate/lists.py
    python3 tools/migrate/lists.py
    git add -A && git commit                  # 2. the branch's own tree converted
    git merge "$move"                         # 3. the move (lists.json: keep the branch's side, below)
    git merge origin/main                     # 4. the rest of main
    python3 tools/seo-head.py && python3 tools/seo-head.py --check

Do not run tools/seo-head.py between steps 2 and 3: the branch's own seo-head.py does not know lists.json yet and
would write the ItemList without its items. After step 3, tools/seo/blog.json has merged without a conflict,
because both sides took the same keys out of it. lists.json is an add/add conflict confined to the entries the
branch itself changed, because step 1 gave both sides the same lists to start from: keep the branch's side of
each (git checkout --ours tools/site/lists.json, git add it and commit), then go on with step 4. Tested on a
branch that had swapped two ItemList items in tools/seo/blog.json and two guide lines in llms.txt, with a commit
on main after the move that reordered another list: two conflict hunks in lists.json, both the branch's, and after
step 4 the branch's two changes and main's later one all hold, and seo-head.py --check passes.

It is idempotent. A tree whose tools/seo/blog.json no longer gives the ItemList's items, and which has
tools/site/lists.json, is converted, and is left as it is. A lists.json that already exists in a tree that is not
converted must hold exactly what this would write; otherwise it stops and changes nothing, because the file is
then newer than the lists it would be read from (merge the move after running this, never before). It writes
lists.json first and blog.json last, so a run that stops half way can be run again.
"""
import argparse, html, json, os, re, sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
SITE = 'https://vynatix.com/'
BRAND = ', Vynatix'
LLMS_OPEN = '<!-- Generated languages'
ITEMLIST = SITE + 'blog.html#guides'

# The lists in the order lists.json holds them, and what each is: (page, the id of its section, how it is read).
LISTS = [
    ('blog.html#english', 'blog.html', 'english', 'blog'),
    ('blog.html#swedish', 'blog.html', 'swedish', 'blog'),
    ('index.html#insights', 'index.html', 'insights', 'reads'),
    ('sv.html#guider', 'sv.html', 'guider', 'reads'),
    ('blog.html#guides', None, None, 'itemlist'),
    ('llms.txt', None, None, 'llms'),
]


class Stop(Exception):
    """A tree this cannot convert without moving a published byte."""


# ------------------------------------------------------------------------------------------------ reading HTML
class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def text(self):
        out = []
        def walk(n):
            for c in n.children:
                if isinstance(c, str): out.append(c)
                else: walk(c)
        walk(self)
        return re.sub(r'\s+', ' ', ''.join(out)).strip()

    def find(self, test):
        out = []
        def walk(n):
            for c in n.children:
                if isinstance(c, Node):
                    if test(c): out.append(c)
                    walk(c)
        walk(self)
        return out

    def classes(self):
        return (self.attrs.get('class') or '').split()


VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class Tree(HTMLParser):
    """The elements of a page as a tree. Comments are left out; entities are decoded in the text."""
    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root', {}, None)
        self.at = self.root
        self.feed(src)
        self.close()

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.at)
        self.at.children.append(n)
        if tag not in VOID:
            self.at = n

    def handle_startendtag(self, tag, attrs):
        self.at.children.append(Node(tag, attrs, self.at))

    def handle_endtag(self, tag):
        n = self.at
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.at = n.parent

    def handle_data(self, d):
        self.at.children.append(d)


def one(found, what):
    if len(found) != 1:
        raise Stop(f'{len(found)} {what} (want 1)')
    return found[0]


def file_of(href):
    """The root page a link names ("test-automation.html", "https://vynatix.com/test-automation.html", and
    "https://vynatix.com/" for index.html), or None."""
    h = html.unescape(href or '').strip()
    if h.startswith(SITE): h = h[len(SITE):]
    h = re.sub(r'[?#].*$', '', h)
    if h == '': return 'index.html'
    return h if re.fullmatch(r'[a-z0-9-]+\.html', h) else None


# ------------------------------------------------------------------------------------------------ the tree
class Site:
    def __init__(self, root):
        self.root = root
        folder = os.path.join(root, 'tools', 'site', 'pages')
        if not os.path.isdir(folder):
            raise Stop('this tree has no tools/site/pages; its registry is still the table in tools/seo-head.py, so run '
                       'tools/migrate/registry.py first (tools/REFACTORING-PLAN.md, step 2.1)')
        self.rows = {}
        for name in sorted(os.listdir(folder)):
            if name.endswith('.json'):
                with open(os.path.join(folder, name), encoding='utf-8') as fh:
                    self.rows[name[:-len('.json')] + '.html'] = json.load(fh)
        with open(os.path.join(root, 'tools', 'site', 'langs.json'), encoding='utf-8') as fh:
            self.langs = json.load(fh)
        self.homes = {k: l['home'] for k, l in self.langs.items() if l.get('kind') == 'written'}
        self.facts = {}

    def read(self, rel):
        with open(os.path.join(self.root, rel), encoding='utf-8') as fh:
            return fh.read()

    def page(self, f):
        """(title without ", Vynatix", meta description) of a root page, as copies.js reads them."""
        if f not in self.facts:
            s = self.read(f)
            title = re.sub(r'\s+', ' ', html.unescape(re.search(r'<title>(.*?)</title>', s, re.S).group(1))).strip()
            desc = re.sub(r'\s+', ' ', html.unescape(re.search(r'<meta name="description" content="([^"]*)">', s).group(1))).strip()
            if not title.endswith(BRAND):
                raise Stop(f'{f}: its <title> "{title}" does not end in "{BRAND}"')
            self.facts[f] = (title[:-len(BRAND)], desc)
        return self.facts[f]

    def lang(self, f):
        return self.rows[f]['lang']

    def tag(self, f):
        """The value of inLanguage for a page: its language's tag in tools/site/langs.json."""
        return self.langs[self.lang(f)]['tag']


MONTHS = {'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
                 'November', 'December'],
          'sv': ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober',
                 'november', 'december']}


def long_date(iso, lang):
    """A pub date as the home pages print it: "24 November 2026", "18 oktober 2026"."""
    y, m, d = iso.split('-')
    return f'{int(d)} {MONTHS[lang][int(m) - 1]} {y}'


def url_of(f):
    return SITE if f == 'index.html' else SITE + f


def hub(site, page, section, how):
    """[(file, {'title', 'description'})] of a hub list, in its order."""
    tree = Tree(site.read(page)).root
    sec = one(tree.find(lambda n: n.tag == 'section' and n.attrs.get('id') == section), f'section#{section} on {page}')
    out = []
    if how == 'blog':
        for li in sec.find(lambda n: n.tag == 'li'):
            a = one(li.find(lambda n: n.tag == 'a'), f'links in an entry of #{section} on {page}')
            br = [i for i, c in enumerate(li.children) if isinstance(c, Node) and c.tag == 'br']
            if len(br) != 1 or a not in li.children or li.children.index(a) > br[0]:
                raise Stop(f'{page}, #{section}: an entry that is not <li><a>title</a><br>description</li>')
            rest = Node('#rest', {}, None)
            rest.children = li.children[br[0] + 1:]
            out.append((file_of(a.attrs.get('href')), {'title': a.text(), 'description': rest.text()}))
    else:
        ul = one(sec.find(lambda n: n.tag == 'ul' and 'reads' in n.classes()), f'ul.reads in #{section} of {page}')
        for li in ul.find(lambda n: n.tag == 'li'):
            h = one(li.find(lambda n: n.tag == 'h3' and 'read__h' in n.classes()), f'h3.read__h in an entry of {page}')
            a = one(h.find(lambda n: n.tag == 'a'), f'links in an h3 of {page}')
            p = one(li.find(lambda n: n.tag == 'p' and 'read__date' not in n.classes()), f'description paragraphs in an entry of {page}')
            f = file_of(a.attrs.get('href'))
            lang = site.lang(page)
            for t in li.find(lambda n: n.tag == 'time'):
                pub = site.rows.get(f, {}).get('pub')
                if not pub or t.attrs.get('datetime') != pub or t.text() != long_date(pub, lang):
                    raise Stop(f'{page}: the entry of {f} shows the date {t.attrs.get("datetime")} "{t.text()}", not its pub '
                               f'{pub}, and a list entry has no override for a date; make the date its pub first')
            out.append((f, {'title': a.text(), 'description': p.text()}))
    if not out:
        raise Stop(f'{page}: no entry in #{section}')
    return out


def item_list(site):
    """[(file, {'title'})] of the ItemList in tools/seo/blog.json, or None once its items have left the file."""
    j = json.loads(site.read(os.path.join('tools', 'seo', 'blog.json')))
    node = one([n for n in j.get('extra_nodes', []) if n.get('@id') == ITEMLIST], f'nodes with @id {ITEMLIST} in tools/seo/blog.json')
    if 'itemListElement' not in node and 'numberOfItems' not in node:
        return None
    keys = list(node)
    if keys[-2:] != ['numberOfItems', 'itemListElement']:
        raise Stop('tools/seo/blog.json: numberOfItems and itemListElement are not the last two keys of the ItemList, '
                   'in that order, where the generator writes them')
    els = node['itemListElement']
    if node['numberOfItems'] != len(els):
        raise Stop(f'tools/seo/blog.json: numberOfItems is {node["numberOfItems"]} for {len(els)} items')
    out = []
    for i, el in enumerate(els, 1):
        it = el.get('item') or {}
        f = file_of(it.get('url'))
        want = {"@type": "ListItem", "position": i, "item": {"@type": "Article", "@id": url_of(f or '') + '#article',
                "url": url_of(f or ''), "name": it.get('name'), "inLanguage": site.tag(f) if f in site.rows else None}}
        if f == 'index.html' or el != want:
            raise Stop(f'tools/seo/blog.json, item {i}: {json.dumps(el, ensure_ascii=False)} is not what the generator '
                       f'would write, {json.dumps(want, ensure_ascii=False)}')
        out.append((f, {'title': it['name']}))
    return out


def llms(site):
    """[(file, {'title', 'description'})] of the guide lines of llms.txt, in file order, after checking that each is
    one the generator writes back exactly and stands where it would write it."""
    text = site.read('llms.txt')
    cut = text.find(LLMS_OPEN)
    lines = (text if cut < 0 else text[:cut]).split('\n')
    def page(line):
        m = re.match(r'- \[[^\]\n]*\]\((' + re.escape(SITE) + r'[^)\s]*)\)', line)
        f = m and file_of(m.group(1))
        return f if f in site.rows else None
    guide = lambda i: bool(page(lines[i]) and site.rows[page(lines[i])].get('article'))
    heads = [i for i, l in enumerate(lines) if l.startswith('## ')]
    sections = list(zip(heads, heads[1:] + [len(lines)]))
    for k, home in site.homes.items():
        n = sum(any(page(lines[i]) == home for i in range(a, b)) for a, b in sections)
        if n != 1:
            raise Stop(f'llms.txt: {n} "## " sections link {home}, the home page of {k} (want 1)')
    out = []
    for a, b in sections:
        at = [i for i in range(a, b) if guide(i)]
        if not at: continue
        if at != list(range(at[0], at[-1] + 1)):
            raise Stop(f'llms.txt, section "{lines[a]}": its guide lines do not stand in one unbroken run')
        langs = {site.lang(page(lines[i])) for i in at}
        if len(langs) != 1 or not any(page(lines[i]) == site.homes.get(next(iter(langs))) for i in range(a, b)):
            raise Stop(f'llms.txt, section "{lines[a]}": its guide lines are not all in the language whose home page it links')
        for i in at:
            m = re.fullmatch(r'- \[([^\]\n]+)\]\((\S+?)\)(?:: (.*))?', lines[i])
            f = page(lines[i])
            if not m or m.group(2) != url_of(f) or m.group(3) == '' or (m.group(3) or '') != (m.group(3) or '').strip() \
                    or m.group(1) != m.group(1).strip():
                raise Stop(f'llms.txt, line {i + 1}: not "- [title](url): description" exactly, as the generator writes it')
            out.append((f, {'title': m.group(1), 'description': m.group(3) or ''}))
    if not out:
        raise Stop('llms.txt: no guide line above the generated languages')
    return out


# ------------------------------------------------------------------------------------------------ the writer
def dump(data, indent):
    return json.dumps(data, indent=indent, ensure_ascii=False) + '\n'


def entries(site, name, read):
    """The list as lists.json holds it: a slug, or a slug with the fields its copy holds instead of its page's."""
    out = []
    seen = set()
    for f, fields in read:
        if not f or f not in site.rows:
            raise Stop(f'{name}: an entry links {f or "a page that is not a root page"}, which has no registry row')
        if f in seen:
            raise Stop(f'{name}: {f} is listed twice')
        if site.rows[f].get('status', 'live') != 'live':
            raise Stop(f'{name}: {f} is withdrawn; take it out of the list first (tools/TAKEDOWN.md, step 3)')
        seen.add(f)
        title, desc = site.page(f)
        page = {'title': title, 'description': desc}
        override = {k: v for k, v in fields.items() if v != page[k]}
        slug = f[:-len('.html')]
        out.append({'slug': slug, 'override': override} if override else slug)
    return out


def plan(root):
    """(files {path: text} a run writes, notes). Empty files when the tree is converted."""
    site = Site(root)
    lists_path = os.path.join(root, 'tools', 'site', 'lists.json')
    blog_path = os.path.join(root, 'tools', 'seo', 'blog.json')
    items = item_list(site)
    if items is None:
        if os.path.exists(lists_path):
            return {}, ['nothing to convert: tools/seo/blog.json no longer gives the ItemList its items, and tools/site/lists.json exists']
        raise Stop('tools/seo/blog.json gives the ItemList no items and there is no tools/site/lists.json to hold them: '
                   'the tree is half converted; take tools/seo/blog.json from the commit before the move and run this again')
    lines = llms(site)
    data = {}
    for name, page, section, how in LISTS:
        read = hub(site, page, section, how) if how in ('blog', 'reads') else items if how == 'itemlist' else lines
        data[name] = entries(site, name, read)
    for f, _ in items + lines:
        if not site.rows[f].get('article'):
            raise Stop(f'{f} is in the ItemList or has a guide line in llms.txt, but its row has no "article": true')
    text = dump(data, 2)
    if os.path.exists(lists_path):
        with open(lists_path, encoding='utf-8') as fh:
            if fh.read() != text:
                raise Stop('tools/site/lists.json exists and differs from what this tree converts to: it is newer than the '
                           'lists it would be read from (merge the move after running this, never before)')
    blog = json.loads(site.read(os.path.join('tools', 'seo', 'blog.json')))
    if dump(blog, 1) != site.read(os.path.join('tools', 'seo', 'blog.json')):
        raise Stop('tools/seo/blog.json is not written the way this writes it back (one-space JSON, the characters as they '
                   'are, a newline at the end), so taking its items out would move other bytes too')
    for n in blog['extra_nodes']:
        if n.get('@id') == ITEMLIST:
            del n['numberOfItems'], n['itemListElement']
    overrides = sum(isinstance(e, dict) for l in data.values() for e in l)
    return {lists_path: text, blog_path: dump(blog, 1)}, [
        f'{len(data)} lists, {sum(len(l) for l in data.values())} entries, {overrides} with an override']


def main(argv=None):
    ap = argparse.ArgumentParser(description='Move the order of the lists of guides into tools/site/lists.json (REFACTORING-PLAN.md, step 2.4, part b).')
    ap.add_argument('root', nargs='?', default=os.path.dirname(TOOLS), help='the tree to convert (default: this one)')
    ap.add_argument('--check', action='store_true', help='write nothing; exit 1 if a run would change anything')
    a = ap.parse_args(argv)
    try:
        files, notes = plan(os.path.abspath(a.root))
    except (Stop, OSError, ValueError) as e:
        raise SystemExit(f'cannot convert: {e}. Nothing was changed.')
    for n in notes:
        print(n, file=sys.stderr)
    if a.check:
        if files:
            print('a run would write ' + ', '.join(os.path.relpath(p, a.root) for p in files), file=sys.stderr)
        return 1 if files else 0
    for p, text in files.items():                       # lists.json first, blog.json last
        with open(p, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
    if files:
        print('wrote ' + ', '.join(os.path.relpath(p, a.root) for p in files), file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
