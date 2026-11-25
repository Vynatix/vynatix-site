#!/usr/bin/env python3
"""Moves the site's chrome and the company's facts out of the Python literals of tools/seo-head.py
(tools/REFACTORING-PLAN.md, step 2.2). Python 3, standard library only; run it from anywhere:

    python3 tools/migrate/chrome.py [SEO_HEAD]     convert that file (default: tools/seo-head.py of this tree)
    python3 tools/migrate/chrome.py -              read a seo-head.py on stdin, write the converted text to stdout
    python3 tools/migrate/chrome.py --check [...]  write nothing; exit 1 if a run would change anything
    --tools DIR                                    where templates/ and site/company.json go (default: the folder
                                                   SEO_HEAD is in, and for -, the tools/ folder this script is in)

Until step 2.2 the header, the footer, the stub of a withdrawn page and the company's facts were Python literals in
tools/seo-head.py: HEADER with NAV and MENU_CTA, FOOTER with SWEDISH_COLUMN, STUB, COMPANY_SENTENCE and ORGANIZATION.
This writes them to tools/templates/header.html, footer.html and stub.html and to tools/site/company.json, and puts the
loaders in the place of the literals, with the code and the comments around them reworded, so that the files it writes
are the files the move commit holds, byte for byte, when it is given the seo-head.py the move started from.

Why it is a script and not only a commit (tools/REFACTORING-PLAN.md, section 8). Git cannot carry a branch's edit into
the file the text moved to, and it has no base for a file both sides created. So a branch opened before the move, which
changed the footer, the menu, a contact detail or the stub in the old literals, brings main in four steps, settling
each merge as usual (node tools/sync.js carries on with a merge of an earlier commit of main):

    move=$(git log origin/main --diff-filter=A --format=%H -1 -- tools/migrate/chrome.py)
    git merge "$move^"                        # 1. main up to the commit the move started from
    git checkout "$move" -- tools/migrate/chrome.py
    python3 tools/migrate/chrome.py && python3 tools/seo-head.py
    git add -A && git commit                  # 2. the branch's own tree converted
    git merge "$move"                         # 3. the move
    git merge origin/main                     # 4. the rest of main

After step 3, tools/seo-head.py has merged without a conflict, because both sides made the same change there. A
template or company.json line the branch itself changed is an add/add conflict, confined to the lines it changed:
there, and only there, keep the branch's line, then run seo-head.py and --check. Step 1 is what confines it, as for
tools/migrate/registry.py. A branch opened before step 2.1 runs tools/migrate/registry.py in step 2 as well; the two
scripts change different lines and may run in either order.

What it reads. The eight literals by name, as plain data: strings, numbers, lists, tuples, {...} and dict(...), with
SITE, ORG_ID and COMPANY_SENTENCE as the only names the Organization node may use. The date of each language of STUB
must be the function the move started from (the day, the month's name from MONTHS and the year). The company's facts
are read from the Organization node, and the footer's own wording and the telephone number as the footer shows it from
FOOTER; every contact detail the footer shows must be the one the node gives, because after the move there is one.

What it checks before it writes anything. It renders the header (for each link of the menu, a page that is not in it,
and both kinds of page), the footer (both kinds of page), the stub (each language, on three days) and the Organization
node twice, the way the old code did from the literals and the way the new code does from the files this would write,
and stops on the first difference, naming it. Code around the literals that a branch changed is not carried: an edit
below whose first text is not found is skipped and named, and git merges those lines as it merges any other (the
merge of the move then conflicts there; keep the move's code and carry the branch's change into the template). A
name the move removes that the converted file still uses is named too.

It is idempotent. A file with none of the eight literals and with read_template() is converted and is left as it is;
one that holds some of the literals but not all is neither shape, and it stops. A data file that already exists must
hold exactly what this would write; otherwise it stops and changes nothing, because the files are then newer than the
literals (merge the move after running this, never before). It writes the data files first and seo-head.py last, so a
run that stops half way can be run again.
"""
import argparse, ast, json, os, re, sys
from string import Template

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)

LITERALS = ('COMPANY_SENTENCE', 'ORGANIZATION', 'FOOTER', 'NAV', 'MENU_CTA', 'HEADER', 'SWEDISH_COLUMN', 'STUB')
# The keys of tools/site/company.json in the order the file holds them, and where the Organization node of the old
# seo-head.py gives each (footer_sentence and telephone_shown come from FOOTER, note from COMPANY_NOTE).
COMPANY_KEYS = ('name', 'legal_name', 'sentence', 'footer_sentence', 'slogan', 'founded', 'founded_in', 'group',
                'group_url', 'org_number', 'street', 'postal_code', 'city', 'country', 'email', 'telephone',
                'telephone_shown', 'contact_type', 'knows_about', 'same_as', 'note')
IN_NODE = dict(name=('name',), legal_name=('legalName',), sentence=('description',), slogan=('slogan',),
               founded=('foundingDate',), founded_in=('foundingLocation', 'name'), group=('memberOf', 'name'),
               group_url=('memberOf', 'url'), org_number=('identifier', 'value'), street=('address', 'streetAddress'),
               postal_code=('address', 'postalCode'), city=('address', 'addressLocality'),
               country=('address', 'addressCountry'), email=('email',), telephone=('telephone',),
               contact_type=('contactPoint', 'contactType'), knows_about=('knowsAbout',), same_as=('sameAs',))
STUB_WORDS = ('title', 'desc', 'eyebrow', 'h1', 'lede', 'home', 'date')

# ------------------------------------------------------------------------------------------------ the files' own text
# What the data files hold besides the literals: the comments of the templates, the stub's fragment (code in
# stub_main() and withdraw() until the move) and the note of company.json, as the move commit holds them.
HEADER_DOC = r'''<!-- The site header. tools/seo-head.py writes it in place of the header of every page on each run, so a change to
     the menu, the logo or the buttons is made here, once, and the script run (python3 tools/seo-head.py); it is
     never edited in the pages. Not published: tools/ is excluded in _config.yml.

     The header is the fragment below, the lines between <template id="header"> and </template>. What differs from
     page to page is named as ${name}:
       ${lang}     lang="en" on a page written by hand, where the header stays English (the Swedish pages
                   included), and nothing on a page of a generated language, which translates it with the rest.
       ${current}  on the line of each link of the menu: aria-current="page" on the link to the page itself,
                   nothing on the others. Each line that names it holds one link.
     Everything else is copied as it stands. A dollar sign is written $$. -->
'''
FOOTER_DOC = r'''<!-- The site footer. tools/seo-head.py writes it in place of the footer of every page on each run, so a change to
     its links or its fine print is made here, once, and the script run (python3 tools/seo-head.py); it is never
     edited in the pages. Not published: tools/ is excluded in _config.yml.

     The footer is the fragment <template id="footer"> below, the lines between that tag and </template>. What
     differs from page to page is named as ${name}:
       ${lang}       lang="en" on a page written by hand, where the footer stays English (the Swedish pages
                     included), and nothing on a page of a generated language, which translates it with the rest.
       ${grid}       nothing on a page written by hand; " site-footer__grid--four" on a generated page, which
                     has no Swedish column.
       ${swedish}    the Swedish column, <template id="swedish"> further down, on a page written by hand, and
                     nothing on a generated page. It stands at the start of the line it comes before.
       ${languages}  the language list (languages_for in tools/seo-head.py) on every page once a generated
                     language is live, and nothing before; on a generated page, the slot the list is put in after
                     the page is translated. It stands at the start of the line it comes before.
     Any other name is a fact of the company, the key of the same name in tools/site/company.json: the contact
     details and the footer's shorter wording of the company sentence are changed there, once, and the same file
     gives them to the structured data of every page. Everything else is copied as it stands. A dollar sign is
     written $$. -->
'''
SWEDISH_DOC = r'''<!-- The footer's Swedish column: ${swedish} above, on the pages written by hand only. A generated page has the
     language list instead. -->
'''
STUB_DOC = r'''<!-- The stub a withdrawn page serves (tools/TAKEDOWN.md). A page whose registry row has "status": "withdrawn" keeps
     its URL, because GitHub Pages cannot redirect, and tools/seo-head.py puts the three parts of the fragment below
     in place of its title, its meta description and its whole <main>, filled in with the words of the page's
     language: about a hundred characters, nothing of the old text and no reason. It is built from existing
     components only (.page-hero), so a withdrawal never needs a stylesheet change or a new stamp. Not published:
     tools/ is excluded in _config.yml.

     The fragment is the lines between <template id="stub"> and </template>; ${title}, ${desc}, ${eyebrow}, ${h1}
     and ${lede} are the words of the page's language. A dollar sign is written $$. -->
'''
STUB_FRAGMENT = r'''<title>${title}</title>
<meta name="description" content="${desc}">
  <main id="main">
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow">${eyebrow}</p>
        <h1 class="page-hero__h1">${h1}</h1>
        <p class="page-hero__lede">${lede}</p>
      </div>
    </section>
  </main>
'''[:-1]   # the lines between the tags
WORDS_DOC = r'''<!-- The words, one list for each language written by hand. In the lede, ${date} is the day of the page's mod,
     written as the date says (${d} is the day, ${m} the month as a number, ${month} its name and ${y} the year),
     and ${home} is the home page the lede links. A generated language translates the English words from its
     catalogue, tools/i18n/<code>.json, as messages of their own: there the lede marks its link <1> and the day
     {date}, as STUB_LEDE and DATE_PATTERN in tools/seo-head.py write them, and seo-head.py stops when those two
     no longer say what the English lede and date say here. A changed English word is a new message, so translate
     it in the five catalogues (python3 tools/i18n.py missing <code>). tools/verify/permanence.js keeps its own copy
     of these words and fails when the two differ. -->
'''
COMPANY_NOTE = ("The company's facts, one home each. tools/seo-head.py builds the Organization node of every page "
                "from them, and puts the ones tools/templates/footer.html names (${email} and the others) into the "
                "footer. sentence is the company sentence (AGENTS.md, \"One sentence about the company\"); the pages, "
                "llms.txt and the guides repeat it by hand, so change those with it. footer_sentence is the footer's "
                "shorter wording: the sentence without its first two words and its last sentence, its first letter "
                "then a capital. tools/verify/copies.js fails when the two drift apart. The generated languages "
                "translate footer_sentence as a message of its own.")

# ------------------------------------------------------------------------------------------------ the reader
class LiteralError(Exception):
    """A literal that cannot be read, or cannot be carried across as it is."""


def _value(node, env, where):
    """The value of a literal: a string, a number, True or False, a list, a tuple, a {...} or a dict(...) of them, a
    name of env, or two strings joined with +."""
    if isinstance(node, ast.Constant) and isinstance(node.value, (str, bool, int, float)):
        return node.value
    if isinstance(node, (ast.List, ast.Tuple)):
        return [_value(e, env, where) for e in node.elts]
    if isinstance(node, ast.Dict):
        out = {}
        for k, v in zip(node.keys, node.values):
            if not (isinstance(k, ast.Constant) and isinstance(k.value, str)):
                raise LiteralError(f'{where}, line {node.lineno}: a key that is not a quoted string')
            out[k.value] = _value(v, env, where)
        return out
    if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'dict'
            and not node.args and all(kw.arg for kw in node.keywords)):
        return {kw.arg: _value(kw.value, env, where) for kw in node.keywords}
    if isinstance(node, ast.Name) and node.id in env:
        return env[node.id]
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        a, b = _value(node.left, env, where), _value(node.right, env, where)
        if isinstance(a, str) and isinstance(b, str):
            return a + b
    raise LiteralError(f'{where}, line {getattr(node, "lineno", "?")}: {ast.unparse(node)[:60]} is not plain data')


def _assignments(tree):
    """{name: statement} of the top-level `NAME = ...` statements of the module."""
    return {n.targets[0].id: n for n in tree.body if isinstance(n, ast.Assign) and len(n.targets) == 1
            and isinstance(n.targets[0], ast.Name)}


def _is_literal(name, node):
    """True when the statement assigning `name` is the old literal, not the new code that has the same name (FOOTER =
    fragment(...), an ORGANIZATION built from COMPANY, STUB = load_stub())."""
    if name in ('COMPANY_SENTENCE', 'NAV', 'MENU_CTA'):
        return True                                       # the new code has no such name
    v = node.value
    if name in ('FOOTER', 'HEADER', 'SWEDISH_COLUMN'):
        return isinstance(v, ast.Constant)
    if name == 'STUB':
        return isinstance(v, ast.Dict)
    return isinstance(v, ast.Dict) and not any(isinstance(n, ast.Name) and n.id == 'COMPANY' for n in ast.walk(v))


def literal_statements(tree):
    """{name: statement} of the names of LITERALS that the module assigns as the old literals."""
    return {n: s for n, s in _assignments(tree).items() if n in LITERALS and _is_literal(n, s)}


def read_literals(source):
    """The literals of a seo-head.py of any revision: {name: value} for each name of LITERALS the file assigns as the
    old literal, with STUB[lang]['date'] as the date word of the template ('${d} ${month} ${y}'), and MONTHS, STUB_LEDE
    and DATE_PATTERN beside them when the file has them. {} when it has none of LITERALS. Raises LiteralError on one
    that is not plain data, and SyntaxError on a file that is not Python."""
    tree = ast.parse(source)
    stmts = _assignments(tree)
    found = literal_statements(tree)
    if not found:
        return {}
    stmts = {n: s for n, s in stmts.items() if n not in LITERALS or n in found}
    env = {}
    for name in ('SITE', 'ORG_ID'):
        if name in stmts:
            env[name] = _value(stmts[name].value, env, name)
    out = {}
    for name in LITERALS + ('MONTHS', 'STUB_LEDE', 'DATE_PATTERN'):
        if name not in stmts:
            continue
        node = stmts[name].value
        if name == 'STUB':
            out[name] = _stub(node)
        else:
            out[name] = _value(node, dict(env, **({'COMPANY_SENTENCE': out['COMPANY_SENTENCE']} if 'COMPANY_SENTENCE' in out else {})), name)
    return out


def _stub(node):
    """STUB of the old seo-head.py: {lang: {word: text}}, the date a template word."""
    if not isinstance(node, ast.Dict):
        raise LiteralError(f'STUB, line {node.lineno}: not a {{...}} of languages')
    out = {}
    for k, v in zip(node.keys, node.values):
        if not (isinstance(k, ast.Constant) and isinstance(k.value, str)
                and isinstance(v, ast.Call) and isinstance(v.func, ast.Name) and v.func.id == 'dict' and not v.args):
            raise LiteralError(f'STUB, line {v.lineno}: a language that is not \'xx\': dict(...)')
        lang, row = k.value, {}
        for kw in v.keywords:
            if kw.arg == 'date':
                want = ast.parse(f"lambda y, m, d: f'{{d}} {{MONTHS[\"{lang}\"][m - 1]}} {{y}}'", mode='eval').body
                if ast.dump(kw.value) != ast.dump(want):
                    raise LiteralError(f'STUB, line {kw.value.lineno}: the date of {lang} is not the day, the month\'s name '
                                       'and the year, the only date the template can say as the old code did')
                row['date'] = '${d} ${month} ${y}'
            else:
                row[kw.arg] = _value(kw.value, {}, 'STUB')
        out[lang] = row
    return out


# ------------------------------------------------------------------------------------------------ the data files
def _dollars(s):
    return s.replace('$', '$$')


def _once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise LiteralError(f'{what} ({old!r} is found {n} times where it must be found once)')


def company(lits):
    """The facts of tools/site/company.json, in its order, from the Organization node and the footer."""
    org, footer = lits['ORGANIZATION'], lits['FOOTER']
    facts = {}
    for key in COMPANY_KEYS:
        if key in IN_NODE:
            v = org
            for step in IN_NODE[key]:
                if not isinstance(v, dict) or step not in v:
                    raise LiteralError(f'ORGANIZATION has no {".".join(IN_NODE[key])}, which company.json takes {key} from')
                v = v[step]
            facts[key] = v
        elif key == 'footer_sentence':
            m = re.findall(r'<p class="site-footer__about">(.*?)</p>', footer)
            if len(m) != 1:
                raise LiteralError(f'FOOTER has {len(m)} <p class="site-footer__about"> lines; company.json takes footer_sentence from one')
            facts[key] = m[0]
        elif key == 'telephone_shown':
            m = re.findall(r'<a href="tel:([^"]*)">(.*?)</a>', footer)
            if len(m) != 1:
                raise LiteralError(f'FOOTER has {len(m)} tel: links; company.json takes telephone_shown from one')
            facts[key] = m[0][1]
        elif key == 'note':
            facts[key] = COMPANY_NOTE
    return facts


def header_html(lits):
    head, nav, cta = lits['HEADER'], lits['NAV'], lits['MENU_CTA']
    for marker in ('@@NAV@@', '@@LANG@@'):
        _once(head, marker, f'HEADER has no single {marker} for the menu and the language')
    if not (isinstance(cta, list) and len(cta) == 2 and all(isinstance(x, str) for x in cta)
            and all(isinstance(r, list) and len(r) == 2 and all(isinstance(x, str) for x in r) for r in nav)):
        raise LiteralError('NAV is not a list of (href, label) and MENU_CTA not one (href, label)')
    rows = [f'          <li><a href="{_dollars(h)}" class="site-header__link"${{current}}>{_dollars(l)}</a></li>' for h, l in nav]
    rows.append(f'          <li class="site-header__menu-cta"><a href="{_dollars(cta[0])}" class="site-header__link">{_dollars(cta[1])}</a></li>')
    frag = _dollars(head).replace('@@NAV@@', '\n'.join(rows)).replace('@@LANG@@', '${lang}')
    return HEADER_DOC + '<template id="header">\n' + frag + '\n</template>\n'


def footer_html(lits, facts):
    frag = _dollars(lits['FOOTER'])
    for marker, name in (('@@LANG@@', 'lang'), ('@@GRID@@', 'grid'), ('@@SWEDISH@@', 'swedish'), ('@@LANGUAGES@@', 'languages')):
        _once(frag, marker, f'FOOTER has no single {marker}')
        frag = frag.replace(marker, '${' + name + '}')
    e = {k: _dollars(v) for k, v in facts.items() if isinstance(v, str)}
    for what, old, new in (
            ('its own wording', f'<p class="site-footer__about">{e["footer_sentence"]}</p>', '<p class="site-footer__about">${footer_sentence}</p>'),
            ('the email address', f'<a href="mailto:{e["email"]}">{e["email"]}</a>', '<a href="mailto:${email}">${email}</a>'),
            ('the telephone number', f'<a href="tel:{e["telephone"]}">{e["telephone_shown"]}</a>', '<a href="tel:${telephone}">${telephone_shown}</a>'),
            ('the address', f'{e["street"]}, {e["postal_code"]} {e["city"]}<br>', '${street}, ${postal_code} ${city}<br>'),
            ('the organisation number', f'Org.nr {e["org_number"]} · ', 'Org.nr ${org_number} · '),
            ('the group', f'<a href="{e["group_url"]}" rel="noopener">Part of {e["group"]}</a>', '<a href="${group_url}" rel="noopener">Part of ${group}</a>'),
            ('the legal name', f'{e["legal_name"]}</span>', '${legal_name}</span>')):
        _once(frag, old, f'FOOTER does not show {what} as ORGANIZATION gives it: make the two agree first')
        frag = frag.replace(old, new)
    column = lits['SWEDISH_COLUMN']
    if not column.endswith('\n'):
        raise LiteralError('SWEDISH_COLUMN does not end in a newline, as the lines of the footer it stands between do')
    return (FOOTER_DOC + '<template id="footer">\n' + frag + '\n</template>\n\n'
            + SWEDISH_DOC + '<template id="swedish">\n' + _dollars(column[:-1]) + '\n</template>\n')


def stub_html(lits):
    stub = lits['STUB']
    lists = []
    for lang, row in stub.items():
        if sorted(row) != sorted(STUB_WORDS):
            raise LiteralError(f'STUB of {lang} has {", ".join(row)}, not {", ".join(STUB_WORDS)}')
        words = {}
        for k in STUB_WORDS:
            v = row[k]
            if not isinstance(v, str):
                raise LiteralError(f'STUB of {lang}: {k} is not a string')
            if k == 'lede':
                v = _dollars(v).replace('{date}', '${date}').replace('{home}', '${home}')
                if re.search(r'[{}]', Template.pattern.sub('', v)):
                    raise LiteralError(f'STUB of {lang}: the lede holds a brace that is not {{date}} or {{home}}')
            elif k != 'date':
                v = _dollars(v)
            words[k] = v
        lists.append(f'<dl lang="{lang}">\n' + '\n'.join(f'  <dt>{k}</dt>{" " * (8 - len(k))}<dd>{words[k]}</dd>' for k in STUB_WORDS) + '\n</dl>')
    return STUB_DOC + '<template id="stub">\n' + STUB_FRAGMENT + '\n</template>\n\n' + WORDS_DOC + '\n\n'.join(lists) + '\n'


def company_json(facts):
    return json.dumps(facts, indent=2, ensure_ascii=False) + '\n'


# ------------------------------------------------------------------------------------------------ the round trip
# Each part rendered as the old code rendered it from the literals and as the new code renders it from the files.
def _fragments(text):
    return dict(re.findall(r'^<template id="([a-z][a-z-]*)">\n(.*?)\n</template>$', text, re.M | re.S))


def _words(text):
    return {lang: dict(re.findall(r'<dt>([a-z][a-z0-9]*)</dt>\s*<dd>(.*?)</dd>', body))
            for lang, body in re.findall(r'<dl lang="([a-z]{2})">(.*?)</dl>', text, re.S)}


def _org(facts, site, org_id):
    c = facts
    return {
      "@type": "Organization", "@id": org_id, "name": c['name'], "legalName": c['legal_name'],
      "alternateName": c['legal_name'], "url": site,
      "logo": {"@type": "ImageObject", "url": site + "assets/icon-512.png", "width": 512, "height": 512},
      "description": c['sentence'], "slogan": c['slogan'], "foundingDate": c['founded'],
      "foundingLocation": {"@type": "Place", "name": c['founded_in']},
      "memberOf": {"@type": "Organization", "name": c['group'], "url": c['group_url']},
      "identifier": {"@type": "PropertyValue", "propertyID": "Swedish organisationsnummer", "value": c['org_number']},
      "address": {"@type": "PostalAddress", "streetAddress": c['street'], "postalCode": c['postal_code'],
                  "addressLocality": c['city'], "addressCountry": c['country']},
      "email": c['email'], "telephone": c['telephone'],
      "contactPoint": {"@type": "ContactPoint", "contactType": c['contact_type'], "email": c['email'], "telephone": c['telephone']},
      "knowsAbout": c['knows_about'], "sameAs": c['same_as'],
    }


def _first_difference(a, b):
    i = next((i for i in range(min(len(a), len(b))) if a[i] != b[i]), min(len(a), len(b)))
    return f'at character {i}: {a[max(0, i - 30):i + 40]!r} against {b[max(0, i - 30):i + 40]!r}'


def round_trip(lits, files, site, org_id):
    """Stops on the first part that the files would render otherwise than the literals did."""
    def same(what, old, new):
        if old != new:
            raise LiteralError(f'{what} would change in the move, {_first_difference(old, new)}; nothing was written')
    facts = json.loads(files['company'])
    text = {k: v for k, v in facts.items() if isinstance(v, str) and k != 'note'}
    # The Organization node.
    old = json.dumps(lits['ORGANIZATION'], ensure_ascii=False, indent=1)
    same('the Organization node (the move builds it from the facts of company.json and carries nothing else)', old,
         json.dumps(_org(facts, site, org_id), ensure_ascii=False, indent=1))
    # The header, for each link of the menu, a page outside it, and both kinds of page.
    head = _fragments(files['header'])['header']
    for f in [h for h, _ in lits['NAV']] + ['index.html', 'not-in-the-menu.html']:
        for gen in (False, True):
            rows = [f'          <li><a href="{h}" class="site-header__link"{" aria-current=\"page\"" if h == f else ""}>{l}</a></li>' for h, l in lits['NAV']]
            rows.append(f'          <li class="site-header__menu-cta"><a href="{lits["MENU_CTA"][0]}" class="site-header__link">{lits["MENU_CTA"][1]}</a></li>')
            old = lits['HEADER'].replace('@@NAV@@', '\n'.join(rows)).replace('@@LANG@@', '' if gen else ' lang="en"')
            new = '\n'.join(Template(line).substitute(lang='' if gen else ' lang="en"', current=' aria-current="page"' if f' href="{f}"' in line else '')
                            for line in head.split('\n'))
            same(f'the header of {f}{" (generated)" if gen else ""}', old, new)
    # The footer, on both kinds of page, with and without a language list.
    parts = _fragments(files['footer'])
    named = re.findall(r'\$\{([a-z_]+)\}', parts['footer'])
    for k in named:
        if k in text and re.search(r'[<>&"]', text[k]):
            raise LiteralError(f'the footer shows {k}, {text[k]!r}, which holds <, >, & or a double quote; the new code '
                               'puts a fact in as it stands and refuses one that holds them')
    for gen in (False, True):
        for languages in ('', '        <!--@@languages@@-->\n', '        <nav>a list</nav>\n'):
            old = lits['FOOTER'].replace('@@LANG@@', '' if gen else ' lang="en"').replace('@@GRID@@', ' site-footer__grid--four' if gen else '')
            old = old.replace('@@SWEDISH@@', '' if gen else lits['SWEDISH_COLUMN']).replace('@@LANGUAGES@@', languages)
            new = Template(parts['footer']).substitute(text, lang='' if gen else ' lang="en"', grid=' site-footer__grid--four' if gen else '',
                                                       swedish='' if gen else Template(parts['swedish']).substitute() + '\n', languages=languages)
            same(f'the footer{" of a generated page" if gen else ""}', old, new)
    # The stub, in each language, on three days.
    page = _fragments(files['stub'])['stub']
    words = _words(files['stub'])
    months = lits.get('MONTHS') or {}
    for lang, t in lits['STUB'].items():
        if lang not in months:
            raise LiteralError(f'MONTHS has no month names for {lang}, which the date of its stub uses')
        for y, m, d in ((2026, 1, 1), (2026, 11, 5), (2027, 12, 31)):
            date = f'{d} {months[lang][m - 1]} {y}'
            lede = t['lede'].format(date=date, home=t['home'])
            old = '\n'.join([f'<title>{t["title"]}</title>', f'<meta name="description" content="{t["desc"]}">',
                             '  <main id="main">\n'
                             '    <section class="page-hero">\n'
                             '      <div class="container">\n'
                             f'        <p class="eyebrow">{t["eyebrow"]}</p>\n'
                             f'        <h1 class="page-hero__h1">{t["h1"]}</h1>\n'
                             f'        <p class="page-hero__lede">{lede}</p>\n'
                             '      </div>\n'
                             '    </section>\n'
                             '  </main>'])
            w = {k: Template(v) for k, v in words[lang].items()}
            new_lede = w['lede'].substitute(date='{date}', home='{home}').format(
                date=w['date'].substitute(d=d, m=m, month=months[lang][m - 1], y=y), home=w['home'].substitute())
            new = Template(page).substitute(title=w['title'].substitute(), desc=w['desc'].substitute(), eyebrow=w['eyebrow'].substitute(),
                                            h1=w['h1'].substitute(), lede=new_lede)
            same(f'the stub in {lang} on {y}-{m:02}-{d:02}', old, new)
    # The new code stops when the English lede and date of the template no longer say what the catalogues translate.
    en = lits['STUB'].get('en')
    if en and 'STUB_LEDE' in lits and en['lede'] != lits['STUB_LEDE'].replace('<1>', '<a href="{home}">').replace('</1>', '</a>'):
        raise LiteralError('the English lede of STUB and STUB_LEDE, the message the catalogues translate, differ; the new code '
                           'requires them to agree, so make them agree first')
    if 'DATE_PATTERN' in lits and lits['DATE_PATTERN'] != '{d} {month} {y}':
        raise LiteralError('DATE_PATTERN is not "{d} {month} {y}", the English date of the stub; the new code requires them to agree')


# ------------------------------------------------------------------------------------------------ the new code
# The edits the move makes to seo-head.py around the literals: (what the base holds, what the move commit holds). Each
# is made where its first text is found once; one that is not found (a revision words it otherwise, or a branch
# changed it) is skipped and named, and git merges those lines as it merges any other.
EDITS = [
  (r'''- the footer, from the FOOTER template below (a footer change is made there, then this is run;
  it is not edited in every file);
- the site header, from the HEADER template below (a nav change is made in NAV, then this is run); it stays
''',
   r'''- the footer, from tools/templates/footer.html and the company's facts in tools/site/company.json (a
  footer change is made there, then this is run; it is not edited in every file);
- the site header, from tools/templates/header.html (a nav change is made there, then this is run); it stays
'''),
  (r'''body, title and description are replaced by the short stub below (see TAKEDOWN.md), because on
GitHub Pages a withdrawn URL has to keep answering and must stop serving its old text.
''',
   r'''body, title and description are replaced by the stub of tools/templates/stub.html (see TAKEDOWN.md),
because on GitHub Pages a withdrawn URL has to keep answering and must stop serving its old text.
'''),
  (r'''page first went live, never moves), or after changing the footer. It is idempotent: on an
unchanged tree it changes nothing. If styles or scripts changed as well, run `npm run stamp` in
tools/ afterwards; the stamps are not this script's business, and `npm run check` fails until
they are current (stamp.js stamps the language folders with the root pages, so the two agree).
''',
   r'''page first went live, never moves), or after changing a template in tools/templates or a fact in
tools/site/company.json. It is idempotent: on an unchanged tree it changes nothing. If styles or
scripts changed as well, run `npm run stamp` in tools/ afterwards; the stamps are not this script's
business, and `npm run check` fails until they are current (stamp.js stamps the language folders with
the root pages, so the two agree).
'''),
  (r'''from html.parser import HTMLParser
''',
   r'''from html.parser import HTMLParser
from string import Template
'''),
  (r'''WEBSITE = {"@type": "WebSite", "@id": WEBSITE_ID, "url": SITE, "name": "Vynatix",
''',
   r'''WEBSITE = {"@type": "WebSite", "@id": WEBSITE_ID, "url": SITE, "name": COMPANY['name'],
'''),
  (r'''    lines += ['<meta name="author" content="Vynatix AB">',
''',
   r'''    lines += [f'<meta name="author" content="{html.escape(COMPANY["legal_name"], quote=True)}">',
'''),
  (r'''              '<meta property="og:site_name" content="Vynatix">',
''',
   r'''              f'<meta property="og:site_name" content="{html.escape(COMPANY["name"], quote=True)}">',
'''),
  (r'''# The one source of the footer. Every page's footer is replaced with this on each run, so a
# change to the contact details, the links or the fine print is made here, once.
''',
   r'''# The one source of the footer is tools/templates/footer.html, with the facts it names from tools/site/company.json.
# Every page's footer is replaced with it on each run, so a change to the links or the fine print is made there, and
# one to the contact details in company.json, once.
'''),
  (r'''# The one source of the site header, the way FOOTER is the one source of the footer. Every page's header is
# replaced with this on each run (the aria-current link is the page itself), so a nav change is made in NAV
# below, once, and this script run. The skip link and the wordmark <symbol> above the header are still
# copied by hand into every page.
''',
   r'''# The one source of the site header is tools/templates/header.html, the way footer.html is the one source of the
# footer. Every page's header is replaced with it on each run (the aria-current link is the page itself), so a nav
# change is made there, once, and this script run. The skip link and the wordmark <symbol> above the header are
# still copied by hand into every page.
'''),
  (r'''def header_for(f, gen=False):
    rows = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == f else ''
        rows.append(f'          <li><a href="{href}" class="site-header__link"{cur}>{label}</a></li>')
    rows.append(f'          <li class="site-header__menu-cta"><a href="{MENU_CTA[0]}" class="site-header__link">{MENU_CTA[1]}</a></li>')
    # On a generated page the header is translated with the rest, so it does not declare English.
    return HEADER.replace('@@NAV@@', '\n'.join(rows)).replace('@@LANG@@', '' if gen else ' lang="en"')
''',
   r'''def header_for(f, gen=False):
    # ${current} is on the line of each link of the menu: aria-current="page" on the link to the page itself. On a
    # generated page the header is translated with the rest, so it does not declare English.
    lang = '' if gen else ' lang="en"'
    return '\n'.join(Template(line).substitute(lang=lang, current=' aria-current="page"' if f' href="{f}"' in line else '')
                     for line in HEADER.template.split('\n'))
'''),
  (r'''# The footer's Swedish column: on the hand-written pages only. A generated page has the language list instead.
''',
   r'''# The footer's Swedish column: on the hand-written pages only. A generated page has the language list instead. It is
# <template id="swedish"> of footer.html, whole lines, so it ends in a newline.
'''),
  (r'''def footer_for(f, gen=False):
    s = FOOTER.replace('@@LANG@@', '' if gen else ' lang="en"').replace('@@GRID@@', ' site-footer__grid--four' if gen else '')
    s = s.replace('@@SWEDISH@@', '' if gen else SWEDISH_COLUMN)
    return s.replace('@@LANGUAGES@@', LANGUAGES_SLOT if gen else languages_for(f))
''',
   r'''def footer_for(f, gen=False):
    return FOOTER.substitute(COMPANY_TEXT, lang='' if gen else ' lang="en"', grid=' site-footer__grid--four' if gen else '',
                             swedish='' if gen else SWEDISH_COLUMN, languages=LANGUAGES_SLOT if gen else languages_for(f))
'''),
  (r'''# characters, with nothing of the old text. Built from existing components only (.page-hero), so a
# withdrawal never needs a stylesheet change or a new stamp. No reason is given on the page.
''',
   r'''# characters, with nothing of the old text: the stub of tools/templates/stub.html, in the words of the page's
# language. Built from existing components only (.page-hero), so a withdrawal never needs a stylesheet change or a
# new stamp. No reason is given on the page.
'''),
  (r'''def stub_main(f):
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
''',
   r'''def stub_page(f):
    """The stub of page f in the words of its language: its <title>, its meta description and its <main>."""
    p = ALL[f]; t = stub_for(p['lang'])
    y, m, d = (int(x) for x in p['mod'].split('-'))
    lede = t['lede'].format(date=t['date'](y, m, d), home=t['home'])
    return STUB_SHAPE.fullmatch(STUB_PAGE.substitute(title=t['title'], desc=t['desc'], eyebrow=t['eyebrow'], h1=t['h1'], lede=lede)).groups()

def withdraw(f, s):
    """Replaces the title, the meta description and the whole <main> with the stub."""
    title, desc, main = stub_page(f)
    s = re.sub(r'<title[^>]*>.*?</title>', lambda m: title, s, count=1, flags=re.S)
    s = re.sub(r'<meta name="description" content="[^"]*">', lambda m: desc, s, count=1)
    s, n = re.subn(r'(\s*)<main id="main"[^>]*>.*?</main>', lambda m: m.group(1) + main.lstrip(), s, count=1, flags=re.S)
'''),
  (r'''DATE_PATTERN = '{d} {month} {y}'       # a translation may use {m}, the month as a number, instead of {month}
''',
   r'''DATE_PATTERN = '{d} {month} {y}'       # a translation may use {m}, the month as a number, instead of {month}
# The two are the English lede and date of tools/templates/stub.html as the catalogues write them, <1> for the link
# and {date} for the day: a change to one is made to the other, and the five catalogues translate the new message.
if (STUB['en']['lede'] != STUB_LEDE.replace('<1>', '<a href="{home}">').replace('</1>', '</a>')
        or Template(read_template('stub.html')[1]['en']['date']).substitute(d='{d}', m='{m}', month='{month}', y='{y}') != DATE_PATTERN):
    raise SystemExit('tools/templates/stub.html and STUB_LEDE or DATE_PATTERN in tools/seo-head.py, the messages the catalogues '
                     'translate, no longer say the same: change them together')
'''),
  (r'''# ---------------------------------------------------------------- shared nodes
''',
   r'''# ---------------------------------------------------------------- templates and the company's facts
# The header, the footer and the stub of a withdrawn page are HTML files in tools/templates/, and the company's facts
# are tools/site/company.json. A template file holds named fragments, each a <template id="name"> element whose
# lines between the opening and the closing tag are the fragment. Around them stand comments and, in stub.html, the
# stub's words, one <dl lang="xx"> list per language written by hand. A fragment names what varies as ${name}
# (string.Template; a dollar sign is written $$). read_template() refuses a file that holds anything else, and
# fragment() a name the fragment may not use, a name it must use once and does not, $name without braces and a
# stray $, each naming the file, so a merge that left both sides stops the run instead of reaching a page.
TEMPLATE_DIR = os.path.join(EXEC, 'templates')
TEMPLATE_TOKEN = re.compile(r'\s+|<!--.*?-->|<template id="([a-z][a-z-]*)">\n(.*?)\n</template>(?=\n|\Z)'
                            r'|<dl lang="([a-z]{2})">(.*?)</dl>', re.S)
WORD_TOKEN = re.compile(r'\s+|<dt>([a-z][a-z0-9]*)</dt>\s*<dd>(.*?)</dd>', re.S)
COMPANY_KEYS = ('name', 'legal_name', 'sentence', 'footer_sentence', 'slogan', 'founded', 'founded_in', 'group',
                'group_url', 'org_number', 'street', 'postal_code', 'city', 'country', 'email', 'telephone',
                'telephone_shown', 'contact_type', 'knows_about', 'same_as', 'note')
_TEMPLATES = {}

def read_template(name):
    """The fragments and the word lists of tools/templates/<name>, read once: ({id: text}, {lang: {key: text}})."""
    if name in _TEMPLATES:
        return _TEMPLATES[name]
    rel = f'tools/templates/{name}'
    try:
        with open(os.path.join(TEMPLATE_DIR, name), encoding='utf-8') as fh:
            text = fh.read()
    except OSError as e:
        raise SystemExit(f'{rel}: cannot be read ({e.strerror})')
    where = lambda at: f'{rel}, line {text.count(chr(10), 0, at) + 1}'
    parts, words, i = {}, {}, 0
    while i < len(text):
        m = TEMPLATE_TOKEN.match(text, i)
        if not m:
            raise SystemExit(f'{where(i)}: neither a comment, a <template id="..."> nor a <dl lang="..."> '
                             f'({text[i:i + 30]!r}); a merge may have left both sides here')
        if m.group(1):
            if m.group(1) in parts:
                raise SystemExit(f'{where(i)}: a second <template id="{m.group(1)}">')
            parts[m.group(1)] = m.group(2)
        elif m.group(3):
            if m.group(3) in words:
                raise SystemExit(f'{where(i)}: a second <dl lang="{m.group(3)}">')
            body, row, j = m.group(4), {}, 0
            while j < len(body):
                w = WORD_TOKEN.match(body, j)
                if not w:
                    raise SystemExit(f'{where(m.start(4) + j)}: neither white space nor <dt>key</dt> <dd>word</dd>')
                if w.group(1):
                    if w.group(1) in row:
                        raise SystemExit(f'{where(m.start(4) + j)}: {w.group(1)} is given twice')
                    row[w.group(1)] = w.group(2)
                j = w.end()
            words[m.group(3)] = row
        i = m.end()
    _TEMPLATES[name] = (parts, words)
    return parts, words

def placeholders(text, where):
    """The names a template's text gives as ${name}, in order. A $ that names nothing, or a name without braces, stops
    the run with `where` and what is wrong."""
    found = list(Template.pattern.finditer(text))
    if any(m.group('invalid') is not None for m in found):
        raise SystemExit(f'{where} holds a $ that names nothing (a dollar sign is written $$)')
    bare = [m.group('named') for m in found if m.group('named')]
    if bare:
        raise SystemExit(f'{where} writes ${bare[0]}; write ${{{bare[0]}}}, with braces')
    return [m.group('braced') for m in found if m.group('braced')]

def fragment(name, id, values=(), names=(), once=()):
    """<template id="id"> of tools/templates/<name> as a string.Template. It may name the keys of values, whose values
    go into the page as they stand (so one it names may not hold <, >, & or a double quote), and the names given,
    which the caller fills in, and it must name each name of once exactly once."""
    rel = f'tools/templates/{name}'
    parts = read_template(name)[0]
    if id not in parts:
        raise SystemExit(f'{rel}: no <template id="{id}">')
    t = Template(parts[id])
    used = placeholders(t.template, f'{rel}: <template id="{id}">')
    allowed = sorted(set(values) | set(names) | set(once))
    for n in used:
        if n not in allowed:
            raise SystemExit(f'{rel}: <template id="{id}"> names ${{{n}}}, which is not one of its names '
                             f'({", ".join(allowed) or "it has none"})')
        if n in values and re.search(r'[<>&"]', values[n]):
            raise SystemExit(f'{rel}: <template id="{id}"> names ${{{n}}}, whose value {values[n]!r} holds <, >, & or a '
                             'double quote; it goes into the page as it stands, so write it without them')
    for n in once:
        if used.count(n) != 1:
            raise SystemExit(f'{rel}: <template id="{id}"> names ${{{n}}} {used.count(n)} times; it must name it once')
    return t

def load_company():
    """The company's facts from tools/site/company.json: every key of COMPANY_KEYS but note, each a string with text
    in it, except knows_about and same_as, which are lists of them. note stays in the file."""
    rel = 'tools/site/company.json'
    data = load_json(os.path.join(SITE_DATA, 'company.json'))
    unknown = sorted(set(data) - set(COMPANY_KEYS))
    if unknown:
        raise SystemExit(f'{rel}: unknown key {unknown} (known: {list(COMPANY_KEYS)})')
    missing = [k for k in COMPANY_KEYS if k not in data and k != 'note']
    if missing:
        raise SystemExit(f'{rel}: {missing[0]} is missing')
    text = lambda v: isinstance(v, str) and v.strip() != ''
    for k, v in data.items():
        lists = k in ('knows_about', 'same_as')
        if not (isinstance(v, list) and v and all(text(x) for x in v) if lists else text(v)):
            raise SystemExit(f'{rel}: {k} is {json.dumps(v, ensure_ascii=False)}, which is not '
                             + ('a list of strings' if lists else 'a string with text in it'))
    return {k: v for k, v in data.items() if k != 'note'}

# ---------------------------------------------------------------- shared nodes
'''),
]

# What each literal's statement becomes, whole lines, its newline included ('' for one that goes).
SPANS = {
  'COMPANY_SENTENCE': r'''# The company's facts, tools/site/company.json: the Organization node is built from them, and the footer names the
# ones it shows (tools/templates/footer.html).
COMPANY = load_company()
''',
  'ORGANIZATION': r'''ORGANIZATION = {
  "@type": "Organization",
  "@id": ORG_ID,
  "name": COMPANY['name'],
  "legalName": COMPANY['legal_name'],
  "alternateName": COMPANY['legal_name'],
  "url": SITE,
  "logo": {"@type": "ImageObject", "url": SITE + "assets/icon-512.png", "width": 512, "height": 512},
  "description": COMPANY['sentence'],
  "slogan": COMPANY['slogan'],
  "foundingDate": COMPANY['founded'],
  "foundingLocation": {"@type": "Place", "name": COMPANY['founded_in']},
  "memberOf": {"@type": "Organization", "name": COMPANY['group'], "url": COMPANY['group_url']},
  "identifier": {"@type": "PropertyValue", "propertyID": "Swedish organisationsnummer", "value": COMPANY['org_number']},
  "address": {"@type": "PostalAddress", "streetAddress": COMPANY['street'], "postalCode": COMPANY['postal_code'],
              "addressLocality": COMPANY['city'], "addressCountry": COMPANY['country']},
  "email": COMPANY['email'],
  "telephone": COMPANY['telephone'],
  "contactPoint": {"@type": "ContactPoint", "contactType": COMPANY['contact_type'],
                   "email": COMPANY['email'], "telephone": COMPANY['telephone']},
  "knowsAbout": COMPANY['knows_about'],
  "sameAs": COMPANY['same_as'],
}
''',
  'FOOTER': r'''COMPANY_TEXT = {k: v for k, v in COMPANY.items() if isinstance(v, str)}     # the facts a template may name
FOOTER = fragment('footer.html', 'footer', values=COMPANY_TEXT, once=('lang', 'grid', 'swedish', 'languages'))
''',
  'NAV': '',
  'MENU_CTA': '',
  'HEADER': r'''HEADER = fragment('header.html', 'header', names=('current',), once=('lang',))
for line in HEADER.template.split('\n'):
    if '${current}' in line and line.count(' href="') != 1:
        raise SystemExit(f'tools/templates/header.html: a line that names ${{current}} holds one link: {line.strip()}')
''',
  'SWEDISH_COLUMN': r'''SWEDISH_COLUMN = fragment('footer.html', 'swedish').substitute() + '\n'
''',
  'STUB': r'''STUB_PAGE = fragment('stub.html', 'stub', once=('title', 'desc', 'eyebrow', 'h1', 'lede'))
# The fragment is a <title> line, a meta description line and the <main>, which withdraw() puts in place of the page's.
STUB_SHAPE = re.compile(r'(<title>.*?</title>)\n(<meta name="description" content="[^"]*">)\n(\s*<main id="main">.*</main>)', re.S)
if not STUB_SHAPE.fullmatch(STUB_PAGE.substitute(title='t', desc='d', eyebrow='e', h1='h', lede='l')):
    raise SystemExit('tools/templates/stub.html: <template id="stub"> is a <title> line, a <meta name="description"> '
                     'line and a <main id="main">, in that order, and nothing else')
STUB_WORDS = ('title', 'desc', 'eyebrow', 'h1', 'lede', 'home', 'date')

def load_stub():
    """The stub's words in each language written by hand, the <dl lang> lists of tools/templates/stub.html, in the
    shape stub_for() gives a generated language: {lang: dict(title, desc, eyebrow, h1, home, lede, date)}, where lede
    is a str.format pattern with {date} and {home} and date a function of the year, the month and the day."""
    rel = 'tools/templates/stub.html'
    words = read_template('stub.html')[1]
    written = [k for k, l in LANGS.items() if l['kind'] == 'written']
    if sorted(words) != sorted(written):
        raise SystemExit(f'{rel}: the words are for {", ".join(words) or "no language"}; they are for each language '
                         f'written by hand, {", ".join(written)}')
    out = {}
    for lang, w in words.items():
        where = f'{rel}: <dl lang="{lang}">'
        if sorted(w) != sorted(STUB_WORDS):
            raise SystemExit(f'{where} gives {", ".join(w)}; it gives {", ".join(STUB_WORDS)}, once each')
        allowed = dict(lede=('date', 'home'), date=('d', 'm', 'month', 'y'))
        for k, v in w.items():
            used = placeholders(v, f'{where}, {k},')
            if set(used) - set(allowed.get(k, ())) or (k == 'lede' and used.count('date') != 1) or (k == 'date' and not used):
                raise SystemExit(f'{where}, {k}, names {", ".join("${" + n + "}" for n in used) or "nothing"}; it may name '
                                 + {'lede': '${date} once and ${home}', 'date': '${d}, ${m}, ${month} and ${y}'}.get(k, 'nothing'))
        if re.search(r'[{}]', Template.pattern.sub('', w['lede'])):
            raise SystemExit(f'{where}, lede, holds a brace of its own, which the lede may not hold')
        text = {k: Template(v).substitute() for k, v in w.items() if k not in allowed}
        out[lang] = dict(text, lede=Template(w['lede']).substitute(date='{date}', home='{home}'),
                         date=lambda y, m, d, p=Template(w['date']), lang=lang: p.substitute(d=d, m=m, month=MONTHS[lang][m - 1], y=y))
    return out

STUB = load_stub()
''',
}


def _span(source, node):
    """(start, end) offsets of a statement, whole lines, its newline included."""
    lines = source.splitlines(keepends=True)
    return sum(len(l) for l in lines[:node.lineno - 1]), sum(len(l) for l in lines[:node.end_lineno])


def convert(source):
    """(new source, the literals read, [notes]). The source comes back as it is when there is nothing to convert."""
    lits = read_literals(source)
    if not lits:
        if 'def read_template(' not in source:
            raise LiteralError('this file has none of the literals and no read_template() either: it is not a seo-head.py '
                               'this script knows')
        return source, lits, []
    missing = [n for n in LITERALS if n not in lits]
    if missing:
        raise LiteralError(f'this file holds some of the literals the move takes out but not {", ".join(missing)}: it is '
                           'neither the old shape nor the new one, or older than the footer\'s Swedish column (20 November '
                           '2026); carry it across by hand')
    notes = []
    out = source
    for old, new in EDITS:
        n = out.count(old)
        if n == 1:
            out = out.replace(old, new)
        elif n > 1:
            raise LiteralError(f'the text to reword occurs {n} times: {old.splitlines()[0][:70]}')
        elif new not in out:
            notes.append(f'not reworded (this file words it otherwise; the merge of the move will conflict here: keep the '
                         f'move\'s code and carry this file\'s change into the template): {old.splitlines()[0][:70]}')
    stmts = literal_statements(ast.parse(out))
    for (start, end), text in sorted(((_span(out, stmts[n]), SPANS[n]) for n in LITERALS), reverse=True):
        out = out[:start] + text + out[end:]
    gone = sorted({(n.id, n.lineno) for n in ast.walk(ast.parse(out)) if isinstance(n, ast.Name) and n.id in ('NAV', 'MENU_CTA', 'COMPANY_SENTENCE')})
    for name, line in gone:
        notes.append(f'the converted file still uses {name}, which the move removes, at line {line}: code this move did not reword')
    return out, lits, notes


# ------------------------------------------------------------------------------------------------ the command
def plan(source, tools):
    """(new source, {path: text} of the data files to write, [notes]). Stops with a message on a data file that exists
    and differs."""
    out, lits, notes = convert(source)
    if not lits:
        paths = [os.path.join(tools, 'templates', n) for n in ('header.html', 'footer.html', 'stub.html')]
        missing = [p for p in paths + [os.path.join(tools, 'site', 'company.json')] if not os.path.exists(p)]
        notes += [f'{p} is missing, and this file has no literals to write it from' for p in missing]
        return out, {}, notes
    facts = company(lits)
    texts = dict(header=header_html(lits), footer=footer_html(lits, facts), stub=stub_html(lits), company=company_json(facts))
    env = {}
    stmts = _assignments(ast.parse(source))
    for name in ('SITE', 'ORG_ID'):
        if name not in stmts:
            raise LiteralError(f'this file has no {name}, which the Organization node is built with')
        env[name] = _value(stmts[name].value, env, name)
    round_trip(lits, texts, env['SITE'], env['ORG_ID'])
    files = {os.path.join(tools, 'templates', 'header.html'): texts['header'],
             os.path.join(tools, 'templates', 'footer.html'): texts['footer'],
             os.path.join(tools, 'templates', 'stub.html'): texts['stub'],
             os.path.join(tools, 'site', 'company.json'): texts['company']}
    for p, text in files.items():
        if os.path.exists(p):
            with open(p, encoding='utf-8') as fh:
                if fh.read() != text:
                    raise SystemExit(f'{p} already exists and holds something other than what the literals give: the files are '
                                     'newer than the literals. Run this before merging the move, not after '
                                     '(tools/REFACTORING-PLAN.md, section 8). Nothing was changed.')
    return out, files, notes


def main(argv=None):
    ap = argparse.ArgumentParser(description='Move the header, the footer, the stub and the company\'s facts of tools/seo-head.py '
                                             'into tools/templates/ and tools/site/company.json (REFACTORING-PLAN.md, step 2.2).')
    ap.add_argument('seo_head', nargs='?', default=os.path.join(TOOLS, 'seo-head.py'), help='a seo-head.py, or - for stdin')
    ap.add_argument('--tools', help='the folder that holds templates/ and site/ (default: the folder of SEO_HEAD; for -, the '
                                    'tools/ folder of this tree)')
    ap.add_argument('--check', action='store_true', help='write nothing; exit 1 if a run would change anything')
    a = ap.parse_args(argv)
    stdin = a.seo_head == '-'
    if stdin:
        source = sys.stdin.read()
        tools = a.tools or TOOLS
    else:
        with open(a.seo_head, encoding='utf-8') as fh:
            source = fh.read()
        tools = a.tools or os.path.dirname(os.path.abspath(a.seo_head))
    try:
        out, files, notes = plan(source, tools)
    except LiteralError as e:
        raise SystemExit(f'cannot carry the literals across: {e}. Nothing was changed.')
    except SyntaxError as e:
        raise SystemExit(f'cannot read the literals: the file is not Python ({e}); one that still holds conflict markers is '
                         'a merge of the move made before this ran: abort it (git merge --abort), run this, commit, and merge '
                         'again (tools/REFACTORING-PLAN.md, section 8). Nothing was changed.')
    log = sys.stderr
    for n in notes:
        print('note ' + n, file=log)
    changed = out != source or any(not os.path.exists(p) for p in files)
    if a.check:
        print(('a run would convert ' + ('this file' if stdin else a.seo_head)) if changed
              else 'nothing to convert: the chrome is already in tools/templates', file=log)
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
        print('nothing to convert: the chrome is already in tools/templates', file=log)
        return 0
    print(f'wrote the header, the footer and the stub under {os.path.join(tools, "templates")} and the company\'s facts to '
          f'{os.path.join(tools, "site", "company.json")}; '
          + ('the converted seo-head.py is on stdout' if stdin else f'{a.seo_head} now loads them'), file=log)
    return 0


if __name__ == '__main__':
    sys.exit(main())
