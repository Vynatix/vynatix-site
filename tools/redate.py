#!/usr/bin/env python3
"""Re-dates a branch on the day it is merged. Python 3, standard library only; run it from anywhere:

    python3 tools/redate.py [--base origin/main] [--date YYYY-MM-DD] [--dry-run]

A page's `pub` is the day it first goes live, not the day it was written, so a branch that waits before it is
merged carries dates that are no longer true (AGENTS.md, "Dates when a branch sits"). This moves them, and only
them, to the merge day (today, or --date):

- a NEW page (its file is not in --base): `pub` and `mod` in PAGES of tools/seo-head.py, the Published /
  Publicerad and Last updated / Senast uppdaterad <time> of its byline, its legal__meta date line, and its row in
  tools/urls.lock;
- a CHANGED page (in --base, and the branch moved its `mod`): `mod`, the Last updated / Senast uppdaterad <time>
  of its byline and its legal__meta date line. A page whose only change is the generated header or footer (a nav
  or footer link) has the same `mod` as on --base and is not touched.

Then it runs tools/seo-head.py, which writes the generated copies (head, JSON-LD, sitemap). Every other date is
left alone: event dates such as the list pages' Checked / Kontrollerad lines, the sv.html guider lead, the
rehearsal date in tools/TAKEDOWN.md, the dates in tools/CITATION-LOG.md.

It refuses, changing nothing: a tree with uncommitted changes to tracked files (so the re-date is its own
reviewable commit); a date in the future, or earlier than a date it would replace; a page whose visible date
does not equal the registry before the change; and any lock row whose URL is on --base (a row is never edited
once its URL has been on main). --dry-run prints the plan and exits 1 if anything would change, 0 if the branch
is already dated today, so it can stand in a merge checklist.
"""
import argparse, datetime, os, re, subprocess, sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(TOOLS)
SITE = 'https://vynatix.com/'
MONTHS = {'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
                 'October', 'November', 'December'],
          'sv': ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september',
                 'oktober', 'november', 'december']}
ENTRY = re.compile(r"^\s*'([^']+\.html)'\s*:\s*dict\((.*)\),?\s*(?:#.*)?$")
DATE = r'\d{4}-\d{2}-\d{2}'


def day(iso, lang):
    y, m, d = (int(x) for x in iso.split('-'))
    return f'{d} {MONTHS[lang][m - 1]} {y}'


def git(*args, check=True):
    r = subprocess.run(['git', '-C', REPO, *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit('git ' + ' '.join(args) + ' failed: ' + r.stderr.strip())
    return r


def registry(text):
    """{file: {'lang', 'pub', 'mod'}} from the one-line PAGES entries of seo-head.py."""
    out = {}
    for line in text.split('\n'):
        m = ENTRY.match(line)
        if not m:
            continue
        body = m.group(2)
        get = lambda k: (re.search(rf"\b{k}='({DATE}|[a-z]+)'", body) or [None, None])[1]
        out[m.group(1)] = {'lang': get('lang'), 'pub': get('pub'), 'mod': get('mod')}
    return out


def main():
    ap = argparse.ArgumentParser(description='Re-date a branch on the day it is merged (AGENTS.md, "Dates when a branch sits").')
    ap.add_argument('--base', default='origin/main', help='the branch the merge goes into (default origin/main)')
    ap.add_argument('--date', help='the merge day, YYYY-MM-DD (default today)')
    ap.add_argument('--dry-run', action='store_true', help='print the plan; exit 1 if anything would change')
    a = ap.parse_args()

    today = datetime.date.today().isoformat()
    when = a.date or today
    if not re.fullmatch(DATE, when):
        raise SystemExit(f'--date {when} is not YYYY-MM-DD')
    if when > today:
        raise SystemExit(f'refusing a date in the future: {when} (today is {today})')
    git('rev-parse', '--verify', a.base + '^{commit}')
    if not a.dry_run and git('status', '--porcelain', '--untracked-files=no').stdout.strip():
        raise SystemExit('refusing: the tree has uncommitted changes to tracked files; commit them first, so the re-date is its own commit')

    py_path = os.path.join(TOOLS, 'seo-head.py')
    py = open(py_path, encoding='utf-8').read()
    now = registry(py)
    base_py = git('show', f'{a.base}:tools/seo-head.py', check=False)
    was = registry(base_py.stdout) if base_py.returncode == 0 else {}
    on_base = lambda f: git('cat-file', '-e', f'{a.base}:{f}', check=False).returncode == 0

    plan = []   # (file, kind, {'pub': (old, new)?, 'mod': (old, new)})
    for f, e in now.items():
        if not on_base(f):
            kind = 'new'
        elif f in was and was[f]['mod'] != e['mod']:
            kind = 'changed'
        else:
            continue
        moves = {}
        if kind == 'new' and e['pub'] != when:
            moves['pub'] = (e['pub'], when)
        if e['mod'] != when:
            moves['mod'] = (e['mod'], when)
        for k, (old, new) in moves.items():
            if new < old:
                raise SystemExit(f'refusing to move {f} {k} backwards, from {old} to {new}')
        if moves:
            plan.append((f, kind, moves))

    base_lock = git('show', f'{a.base}:tools/urls.lock', check=False)
    base_rows = {l.split()[0] for l in base_lock.stdout.split('\n') if l.strip() and not l.startswith('#')} if base_lock.returncode == 0 else set()

    edits = {}   # path -> new text
    notes = []
    def text(path):
        if path not in edits:
            edits[path] = open(os.path.join(REPO, path), encoding='utf-8').read()
        return edits[path]

    for f, kind, moves in plan:
        lang = now[f]['lang'] or 'en'
        # the registry line of this page only
        lines = text('tools/seo-head.py').split('\n')
        for i, line in enumerate(lines):
            m = ENTRY.match(line)
            if m and m.group(1) == f:
                for k, (old, new) in moves.items():
                    line, n = re.subn(rf"\b{k}='{old}'", f"{k}='{new}'", line)
                    assert n == 1, (f, k)
                lines[i] = line
        edits['tools/seo-head.py'] = '\n'.join(lines)
        # the visible dates that repeat them: the byline (<p class="prose__meta">) and the legal__meta line
        page = text(f)
        spans = []   # (start, end, replacement)
        for bm in re.finditer(r'<p\b[^>]*\bclass="[^"]*\bprose__meta\b[^"]*"[^>]*>(.*?)</p>', page, re.S):
            for tm in re.finditer(rf'(Published|Publicerad|Last updated|Senast uppdaterad)(\s*<time\b[^>]*\bdatetime=")({DATE})("[^>]*>)([^<]*)(</time>)', bm.group(1)):
                k = 'pub' if tm.group(1).startswith('Publ') else 'mod'
                shown, shown_text = tm.group(3), tm.group(5).strip()
                expect = moves[k][0] if k in moves else now[f][k]
                if shown != expect or shown_text != day(expect, lang):
                    raise SystemExit(f'refusing: {f} shows {tm.group(1)} {shown} "{shown_text}" but the registry says {expect}; fix the page first')
                if k in moves:
                    start = bm.start(1) + tm.start(3)
                    spans.append((start, bm.start(1) + tm.end(5), moves[k][1] + tm.group(4) + day(moves[k][1], lang)))
        for lm in re.finditer(r'<p class="legal__meta">(Last updated|Senast uppdaterad) ([^<]*)</p>', page):
            expect = moves['mod'][0] if 'mod' in moves else now[f]['mod']
            if lm.group(2).strip() != day(expect, lang):
                raise SystemExit(f'refusing: {f} shows {lm.group(1)} "{lm.group(2).strip()}" but mod is {expect}; fix the page first')
            if 'mod' in moves:
                spans.append((lm.start(2), lm.end(2), day(moves['mod'][1], lang)))
        for start, end, rep in sorted(spans, reverse=True):
            page = page[:start] + rep + page[end:]
        edits[f] = page
        # the lock row of a new page
        if kind == 'new' and 'pub' in moves:
            url = SITE if f == 'index.html' else SITE + f
            if url in base_rows:
                raise SystemExit(f'refusing: {url} is in the lock on {a.base}; a row is never edited once its URL has been on main')
            lock = text('tools/urls.lock')
            lock, n = re.subn(rf'^{re.escape(url)} {moves["pub"][0]}$', f'{url} {moves["pub"][1]}', lock, flags=re.M)
            if n == 1:
                edits['tools/urls.lock'] = lock
            else:
                notes.append(f'{url} has no lock row yet; seo-head.py will write it')

    if not plan:
        print(f'nothing to re-date: every new or changed page against {a.base} is already dated {when}')
        return 0
    print(f're-dating to {when} against {a.base}:')
    for f, kind, moves in plan:
        print(f'  {kind:7} {f}: ' + ', '.join(f'{k} {o} -> {n}' for k, (o, n) in moves.items()))
    for n in notes:
        print('  note: ' + n)
    if a.dry_run:
        print('dry run: nothing written')
        return 1
    for path, t in edits.items():
        open(os.path.join(REPO, path), 'w', encoding='utf-8').write(t)
    r = subprocess.run([sys.executable, py_path], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('tools/seo-head.py failed after the re-date:\n' + r.stdout + r.stderr)
    r = subprocess.run([sys.executable, py_path, '--check'], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()))
    print('now review the diff, run `npm run check` in tools/, and commit the re-date on its own')
    return 0 if r.returncode == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
