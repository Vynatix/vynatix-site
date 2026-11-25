#!/usr/bin/env python3
"""Split AGENTS.md into an index and one topic file per block, word for word (tools/REFACTORING-PLAN.md, step 4.3).

    python3 tools/migrate/agents-split.py            split AGENTS.md of this tree, write tools/docs/*.md
    python3 tools/migrate/agents-split.py --check    write nothing; say whether the tree is split and the split is exact
    python3 tools/migrate/agents-split.py --dry-run  print what it would write

The four long sections of AGENTS.md (Architecture & conventions; Posts, permanence and withdrawal; Analytics;
Assets) move to tools/docs/, every line of them exactly once and in its order, and AGENTS.md keeps its other
sections as they are and gains a *Topics* index in their place: one heading per block, named as the block is
named today, because published comments, tool messages and CLAUDE.md cite them by name ("AGENTS.md, Hero
background"). A block of "Architecture & conventions" opens with a bold lead (**Hero fit.**); the paragraphs after
it belong to it until the next block opens. Three paragraphs that sit after another block today are filed with
the block they describe (REGROUP). A bold lead the script does not know stays with the block before it and is
reported, so a new paragraph is never lost and never silently filed.

It is idempotent: an AGENTS.md that already has the *Topics* index is left as it is, and the date it writes is
the day of the split (DATE), not today, so a branch that runs it later writes the same headers.

A branch opened before the split carries its edits across in this order (plan, section 8), so its edits to the
old sections arrive in the topic files instead of conflicting in an AGENTS.md that no longer holds them:

    move=$(git log origin/main --diff-filter=A --format=%H -1 -- tools/migrate/agents-split.py)
    git merge "$move^"                                 # main up to the commit before the split
    git checkout "$move" -- tools/migrate/agents-split.py
    python3 tools/migrate/agents-split.py              # split the branch's own AGENTS.md
    git add -A && git commit -m "Split AGENTS.md as main did"
    git merge "$move"                                  # a topic file conflicts only where the branch edited it
    git merge origin/main

At the merge of the split a topic file is an add/add conflict on the lines the branch itself changed, and the
branch's side is the one to keep there.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
DOCS = os.path.join(REPO, 'tools', 'docs')
MARK = '## Topics'
DATE = '25 November 2026'          # the day of the split; every run writes it, so reruns agree

# The blocks of "Architecture & conventions": (file, the bold lead that opens the block). In the order of the file.
BLOCKS = [
    ('three-layer-css', 'Three-layer CSS.'),
    ('version-stamps', 'Version stamps on the four shared files.'),
    ('theming', 'Theming.'),
    ('liquid-glass', 'Liquid Glass.'),
    ('silk-waves', 'Silk waves.'),
    ('home-hero', 'The home hero.'),
    ('hero-background', 'Hero background.'),
    ('hero-fit', 'Hero fit.'),
    ('audience-switch', 'Audience switch (retired, November 2026).'),
    ('shared-chrome', 'Shared chrome: the header and the footer are templates, the rest is duplicated.'),
    ('javascript', 'JavaScript'),
    ('progressive-enhancement', 'Progressive enhancement / accessibility'),
    ('largest-contentful-paint', 'Largest contentful paint.'),
    ('search', 'Search, AI engines and structured data.'),
    ('english-home-page', 'The English home page'),
    ('other-pages', 'The other pages.'),
    ('rate-calculator', 'Rate calculator.'),
    ('swedish-pages', 'Swedish pages'),
    ('languages', 'Languages.'),
    ('list-pages-withdrawn', 'The list pages are withdrawn.'),
    ('copy', 'Copy'),
    ('icons', 'Icons'),
]
# Paragraphs that sit after another block today but describe this one: the lead, and the block they go to. The
# paragraphs after them follow, until the next known lead.
REGROUP = {'Bronze budget.': 'hero-background'}
# Leads that belong where they stand (sub-paragraphs of the block before them): known, so not reported.
KNOWN_SUB = {
    'Bringing `main` into a branch.', 'A branch opened before the registry became data', 'The headline copy drives the geometry, and the guard says when it moves.',
    'Guards.', 'Measured costs and known limits', 'Changing it.', 'The Google entries are a recorded security downgrade',
    'The policy lives in three places that change together:', 'One sentence about the company',
    'What the Geoptie audit of 23 November 2026 changed', 'The second report of 23 November 2026',
    "The page's pictures", 'The one exception: Chinese and Hindi, deleted on 21 November 2026.',
}
# The other three sections move whole, one file each.
WHOLE = [('posts-permanence-withdrawal', 'Posts, permanence and withdrawal'), ('analytics', 'Analytics'), ('assets', 'Assets')]
MOVING = ['Architecture & conventions'] + [t for _, t in WHOLE]


def title_of(lead):
    return lead[:-1] if lead.endswith(('.', ':')) else lead


def lead_of(par):
    m = re.match(r'\*\*(.+?)\*\*', par[0])
    return m.group(1) if m else None


def paragraphs(lines):
    """[(first line index, [lines])], split on blank lines; the blank lines are not in a paragraph."""
    out, cur, start = [], [], None
    for i, l in enumerate(lines):
        if l.strip() == '':
            if cur:
                out.append((start, cur))
            cur, start = [], None
        else:
            if not cur:
                start = i
            cur.append(l)
    if cur:
        out.append((start, cur))
    return out


def split(text):
    lines = text.split('\n')
    heads = [(i, l[3:].strip()) for i, l in enumerate(lines) if l.startswith('## ')]
    names = [h for _, h in heads]
    for s in MOVING:
        if s not in names:
            raise SystemExit(f'AGENTS.md has no "## {s}" section: not the shape this script splits')
    idx = {h: i for i, h in heads}
    order = [h for _, h in heads]
    first = order.index(MOVING[0])
    if order[first:first + len(MOVING)] != MOVING:
        raise SystemExit('the four sections to move are not next to each other in AGENTS.md: ' + ', '.join(order))
    begin = idx[MOVING[0]]
    after = order[first + len(MOVING)] if first + len(MOVING) < len(order) else None
    end = idx[after] if after else len(lines)
    bounds = {}
    for k, s in enumerate(MOVING):
        bounds[s] = (idx[s] + 1, idx[MOVING[k + 1]] if k + 1 < len(MOVING) else end)

    topics = {slug: [] for slug, _ in BLOCKS + WHOLE}     # slug -> [paragraph lines]
    leads_in = {slug: [] for slug in topics}
    unknown = []
    a0, a1 = bounds['Architecture & conventions']
    start_of = {lead: slug for slug, lead in BLOCKS}
    cur = None
    for at, par in paragraphs(lines[a0:a1]):
        lead = lead_of(par)
        if lead in start_of:
            cur = start_of[lead]
        elif lead in REGROUP:
            cur = REGROUP[lead]
        elif lead and lead not in KNOWN_SUB:
            unknown.append((a0 + at + 1, lead))
        if cur is None:
            raise SystemExit(f'AGENTS.md:{a0 + at + 1}: text before the first block of "Architecture & conventions"')
        if lead and lead not in start_of:
            leads_in[cur].append(title_of(lead))
        topics[cur].append(par)
    for slug, sec in WHOLE:
        s0, s1 = bounds[sec]
        for at, par in paragraphs(lines[s0:s1]):
            lead = lead_of(par)
            if lead:
                leads_in[slug].append(title_of(lead))
            topics[slug].append(par)
    return lines, begin, end, topics, leads_in, unknown


def render(lines, begin, end, topics, leads_in, date):
    titles = {slug: title_of(lead) for slug, lead in BLOCKS}
    titles.update({slug: t for slug, t in WHOLE})
    files = {}
    for slug, pars in topics.items():
        head = [f'# {titles[slug]}', '',
                f'Moved word for word from `AGENTS.md` on {date} (`tools/REFACTORING-PLAN.md`, step 4.3); its index is',
                '`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).', '']
        body = []
        for par in pars:
            body += par + ['']
        files[slug] = '\n'.join(head + body).rstrip('\n') + '\n'
    idx = [MARK, '',
           'The working rules for each part of the site are in `tools/docs/`, one file per topic, moved there word',
           f'for word from this file on {date}. Open the topic your change touches; a heading below is the name',
           'the pages, the tools and `CLAUDE.md` cite ("AGENTS.md, Hero background"), and "Also here" names the',
           'paragraphs inside it that are cited by their own name.', '']
    for slug in [s for s, _ in BLOCKS] + [s for s, _ in WHOLE]:
        idx.append(f'### {titles[slug]}')
        idx.append('')
        also = '' if not leads_in[slug] else ' Also here: ' + '; '.join(f'*{n}*' for n in leads_in[slug]) + '.'
        idx.append(f'`tools/docs/{slug}.md`.{also}')
        idx.append('')
    new = lines[:begin] + idx + lines[end:]
    return '\n'.join(new), files


def verify(old_lines, begin, end, new_text, files):
    """Every non-blank line of the moved region is in exactly one topic file, in its order; nothing else is."""
    problems = []
    moved = [l for l in old_lines[begin:end] if l.strip() and not l.startswith('## ')]
    got = []
    for slug, t in files.items():
        body = t.split('\n')[5:]
        got += [(slug, l) for l in body if l.strip()]
    if sorted(moved) != sorted(l for _, l in got):
        problems.append(f'the topic files hold {len(got)} lines, the moved sections {len(moved)}: not the same lines')
    pos = {}
    for k, l in enumerate(moved):
        pos.setdefault(l, []).append(k)
    for slug, t in files.items():
        seen = -1
        used = {}
        for l in [x for x in t.split('\n')[5:] if x.strip()]:
            n = used.get(l, 0)
            used[l] = n + 1
            p = pos.get(l, [])
            # the n-th time a line occurs in this file maps to its occurrences in the source in order; enough to
            # catch a reordered block, not a proof of every repeated line's position
            if not p:
                problems.append(f'{slug}.md holds a line the source does not: {l[:60]!r}')
                break
            if min(p) < seen and len(p) == 1:
                problems.append(f'{slug}.md is out of order at {l[:60]!r}')
                break
            seen = max(seen, min(p))
    kept_old = old_lines[:begin] + old_lines[end:]
    kept_new = [l for l in new_text.split('\n')]
    i = kept_new.index(MARK)
    j = next((k for k in range(i + 1, len(kept_new)) if kept_new[k].startswith('## ')), len(kept_new))
    if kept_new[:i] + kept_new[j:] != kept_old:
        problems.append('the sections AGENTS.md keeps are not byte for byte as they were')
    return problems


def main(argv):
    path = os.path.join(REPO, 'AGENTS.md')
    text = open(path, encoding='utf-8').read()
    if '\n' + MARK + '\n' in text:
        if '--check' in argv:
            missing = [s for s, _ in BLOCKS + WHOLE if not os.path.exists(os.path.join(DOCS, s + '.md'))]
            print('AGENTS.md is split' + (f'; missing topic files: {missing}' if missing else ', and every topic file is there'))
            return 1 if missing else 0
        print('AGENTS.md is already split (it has the Topics index): nothing to do')
        return 0
    date = os.environ.get('SPLIT_DATE') or DATE
    lines, begin, end, topics, leads_in, unknown = split(text)
    new_text, files = render(lines, begin, end, topics, leads_in, date)
    problems = verify(lines, begin, end, new_text, files)
    for at, lead in unknown:
        print(f'note AGENTS.md:{at}: a bold lead this script does not know, kept with the block before it: {lead!r}')
    if problems:
        for p in problems:
            print('FAIL ' + p)
        return 1
    n = sum(len([l for l in t.split('\n')[5:] if l.strip()]) for t in files.values())
    print(f'ok   {len(files)} topic files hold the {n} lines of the four sections, each once and in its order; '
          f'AGENTS.md keeps its other sections byte for byte and goes from {len(lines)} to {len(new_text.split(chr(10)))} lines')
    if '--check' in argv or '--dry-run' in argv:
        return 0
    os.makedirs(DOCS, exist_ok=True)
    for slug, t in files.items():
        open(os.path.join(DOCS, slug + '.md'), 'w', encoding='utf-8').write(t)
    open(path, 'w', encoding='utf-8').write(new_text)
    print(f'wrote AGENTS.md and {len(files)} files in tools/docs/')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
