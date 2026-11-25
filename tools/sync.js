// One command to bring origin/main into a work branch (tools/REFACTORING-PLAN.md, step 0.6). Static, no browser, no
// npm install: git, Node and Python 3, as the generator needs.
//
//   node tools/sync.js              fetch origin/main, merge it without committing, settle what may be settled, regenerate
//   node tools/sync.js --no-fetch   the same with the origin/main this clone already has (it says so)
//   node tools/sync.js --self-test  build the two-branch cases in temporary repositories and prove each rule holds
//   (npm run sync in tools/ runs the first.)
//
// Why it exists. Every page carries the ?v= stamps of the five stamped files, so two branches that both touch a
// stylesheet conflict in every page, and each person or agent used to settle 114 files in their own way. Taking one
// side of a root page is not safe: part of a page is written by hand, and both --checks pass on a tree that has lost
// the other branch's sentence. Taking one side of tools/urls.lock is not safe either: the generator writes the rows
// it misses back with the registry's date, which is not always the date main holds, and the checks stay green. So
// this command settles only what can be settled without a judgement, and stops for a person on the rest.
//
// What it does, in order:
// 1. It fetches origin/main (and fails if it cannot, unless --no-fetch is given). If no merge is in progress it
//    starts one with `git merge --no-commit --no-ff origin/main`, on a branch other than main and only when no
//    tracked file has an uncommitted change. If a merge is in progress it carries on with that one, which must be a
//    merge of origin/main or of an earlier commit of it.
// 2. It settles each conflicted file by its kind:
//    - a file a tool writes whole (a page in a generated language folder, sitemap.xml, tools/i18n/messages.json) is
//      taken from this branch, or deleted when one side deleted it, because the generator writes it again in step 4;
//    - a root page is never taken whole. Its three merge stages (:1: the merge base, :2: this branch, :3: origin/main)
//      are merged again by `git merge-file` on temporary copies, with every ?v= value replaced by one constant (MASK
//      below). A stamp can then no longer conflict, so what still conflicts is a real conflict in the hand-written
//      part: the page is written with only those conflicts marked, left unmerged and named for a person. The constant
//      stays in the settled pages until stamp.js writes the real stamps in step 4;
//    - tools/urls.lock keeps every row of origin/main as it stands (a row that has been on main is never edited), and
//      the generator appends this branch's own rows in step 4;
//    - tools/urls.retired is written by hand and no tool appends to it, so it keeps every line of origin/main, with
//      the lines this branch added after them;
//    - every other file, llms.txt and _config.yml included (part of each is written by hand, so neither is ever taken
//      whole), is left as git merged it, and if it conflicts it is listed for a person.
// 3. If anything is left for a person, it stops there and regenerates nothing: the generator cannot run while
//    tools/seo-head.py or a catalogue holds conflict markers, and a stamp taken from a conflicted stylesheet is wrong.
//    Settle each file it names, `git add` it, and run the command again; `git merge --abort` gives the merge up.
// 4. When nothing is left, it checks that no changed file still holds a conflict marker, runs python3
//    tools/seo-head.py and node tools/stamp.js, then both --checks and tools/verify/permanence.js, checks that no
//    page still carries the constant, and stages the result. It never commits: the merge is left for the person to
//    look over and commit.
//
// A rerun never overwrites a hand resolution. A root page that is still unmerged but holds no conflict marker has
// been settled by hand and is only named (git add it); one that still holds a marker and the constant was written by
// an earlier run, so it is left exactly as it is. Run the command before editing a conflicted page by hand: a page
// that still holds git's own markers is merged again from its stages.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
// The constant every stamp is replaced by while a page is merged again. It is eight hex digits, the shape stamp.js
// writes and recognises, so stamp.js replaces it with the real stamp in step 4.
const MASK = '00000000';
const MASKED = '?v=' + MASK;
// A stamp as stamp.js writes it: ?v= and eight hex digits, and no ninth, so a longer value is never cut in two.
const STAMP = /\?v=[0-9a-f]{8}(?![0-9a-f])/g;
// The start or the end of a conflict, as git writes it in every conflict style.
const MARKER = /^(?:<{7}|>{7})(?: |$)/m;
// The files a tool writes whole, besides the pages of the generated language folders.
const WHOLE = ['sitemap.xml', 'tools/i18n/messages.json'];
const LOCK = 'tools/urls.lock';
const RETIRED = 'tools/urls.retired';
const BUFFER = 256 << 20;

const firstLine = (s) => String(s || '').trim().split('\n')[0];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

// Bring origin/main into the branch checked out at `root`. Every git call, every tool and every file it touches is
// taken from `root`, never from this file's own folder, so the self-test can point it at a temporary clone.
// Returns { code, stopped, regenerated }: code 0 when the merge is settled, regenerated, checked and staged.
function sync(root, opt = {}) {
  const env = opt.env || process.env;
  const log = opt.log || ((s) => console.log(s));
  const result = { code: 1, stopped: [], regenerated: false };
  const run = (cmd, args, o = {}) => {
    const r = spawnSync(cmd, args, { cwd: root, env, encoding: o.encoding === undefined ? 'utf8' : o.encoding, maxBuffer: BUFFER });
    if (r.error) throw r.error;
    return r;
  };
  const git = (...args) => {
    const r = run('git', args);
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${firstLine(r.stderr || r.stdout)}`);
    return r.stdout;
  };
  const gitOk = (...args) => run('git', args).status === 0;
  const rev = (name) => { const r = run('git', ['rev-parse', '--verify', '--quiet', name + '^{commit}']); return r.status === 0 ? r.stdout.trim() : ''; };
  const short = (sha) => sha.slice(0, 7);
  const blob = (sha) => { const r = run('git', ['cat-file', 'blob', sha], { encoding: 'latin1' }); if (r.status !== 0) throw new Error(`cannot read blob ${sha}`); return r.stdout; };
  const abs = (f) => path.join(root, f);
  const readText = (f) => { try { return fs.readFileSync(abs(f), 'latin1'); } catch (e) { return null; } };
  const inChunks = (args, files) => { for (let i = 0; i < files.length; i += 200) git(...args, '--', ...files.slice(i, i + 200)); };
  const unmerged = () => {
    const out = new Map();
    for (const rec of git('ls-files', '-u', '-z').split('\0')) {
      if (!rec) continue;
      const tab = rec.indexOf('\t');
      const [mode, sha, stage] = rec.slice(0, tab).split(' ');
      const f = rec.slice(tab + 1);
      if (!out.has(f)) out.set(f, {});
      out.get(f)[stage] = { mode, sha };
    }
    return out;
  };
  const how = (st) => (st[2] && st[3] ? (st[1] ? 'changed on both sides' : 'added on both sides') : st[2] ? 'deleted on origin/main and changed here' : 'deleted here and changed on origin/main');

  // --- 1. origin/main, and the merge
  const top = run('git', ['rev-parse', '--show-toplevel']);
  if (top.status !== 0 || fs.realpathSync(top.stdout.trim()) !== fs.realpathSync(root)) {
    log(`FAIL ${root} is not the top of a git checkout (sync works on the repository whose tools/ folder it is in)`);
    return result;
  }
  if (opt.fetch !== false) {
    const r = run('git', ['fetch', '--quiet', 'origin', 'main']);
    if (r.status !== 0) {
      log(`FAIL origin/main could not be fetched: ${firstLine(r.stderr)} (run with --no-fetch to use the origin/main this clone has)`);
      return result;
    }
  }
  const main = rev('origin/main');
  if (!main) { log('FAIL there is no origin/main in this clone (fetch it: git fetch origin main)'); return result; }
  const branch = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']).stdout.trim();
  if (branch === 'main') { log('FAIL this is main: sync brings origin/main into a work branch, so switch to the branch first'); return result; }
  const where = branch || 'the detached HEAD';
  let mergeHead = rev('MERGE_HEAD');
  if (!mergeHead) {
    if (unmerged().size) { log('FAIL files are in conflict but no merge is in progress (a rebase, a cherry-pick or a stash?): finish that first'); return result; }
    const dirty = git('status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean);
    if (dirty.length) {
      log(`FAIL ${plural(dirty.length, 'tracked file has', 'tracked files have')} uncommitted changes: commit them or set them aside, then run sync again`);
      for (const l of dirty.slice(0, 10)) log('  ' + l);
      return result;
    }
    if (gitOk('merge-base', '--is-ancestor', main, 'HEAD')) {
      log(`ok   ${where} already contains origin/main ${short(main)}${opt.fetch === false ? ' (not fetched now)' : ''}: there is nothing to merge`);
      result.code = 0;
      return result;
    }
    log(`note merging origin/main ${short(main)}${opt.fetch === false ? ' (not fetched now)' : ''} into ${where}: git merge --no-commit --no-ff origin/main`);
    const r = run('git', ['merge', '--no-commit', '--no-ff', 'origin/main']);
    mergeHead = rev('MERGE_HEAD');
    if (!mergeHead) {
      log(`FAIL git merge did not start a merge: ${firstLine(r.stderr || r.stdout)}`);
      log('     (in a shallow clone the merge base may be missing: git fetch --deepen=100 origin main, then run sync again)');
      return result;
    }
  } else {
    if (mergeHead !== main) {
      if (!gitOk('merge-base', '--is-ancestor', mergeHead, main)) {
        log(`FAIL the merge in progress is with ${short(mergeHead)}, which is neither origin/main nor an earlier commit of it: finish it or abort it (git merge --abort) first`);
        return result;
      }
      log(`note the merge in progress is with ${short(mergeHead)}, and origin/main has moved on to ${short(main)}: settle and commit this merge, then run sync again`);
    }
    log(`note carrying on with the merge of ${short(mergeHead)} into ${where} that is in progress`);
  }

  // --- 2. settle each conflicted file by its kind
  // The generated language folders are the languages tools/i18n/messages.json lists, on either side of the merge.
  const langs = new Set();
  for (const side of ['HEAD', mergeHead]) {
    const r = run('git', ['show', `${side}:${WHOLE[1]}`]);
    if (r.status !== 0) continue;                             // that side has no generated language
    let data;
    try { data = JSON.parse(r.stdout); } catch (e) {
      log(`FAIL ${WHOLE[1]} cannot be read on ${side === 'HEAD' ? 'this branch' : 'origin/main'} (${e.message}), so the generated language folders are not known`);
      return result;
    }
    for (const k of data.languages || []) if (/^[a-z]{2}$/.test(k)) langs.add(k);
  }
  const kind = (f) => {
    if (WHOLE.includes(f)) return 'whole';
    const m = /^([a-z]{2})\/[^/]+\.html$/.exec(f);
    if (m && langs.has(m[1])) return 'whole';
    if (/^[^/]+\.html$/.test(f)) return 'page';
    if (f === LOCK) return 'lock';
    if (f === RETIRED) return 'retired';
    return 'other';
  };

  const conflicted = unmerged();
  const left = [];                                            // [file, why]: what a person settles
  const settled = [];                                         // written here, staged below
  const fromBranch = [];
  const dropped = [];
  let pagesMerged = 0;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vynatix-sync-'));
  try {
    // Merge three texts with git merge-file. Latin-1 maps every byte to one character, so the bytes come back as
    // they went in, whatever the page holds.
    const mergeFile = (base, ours, theirs) => {
      const p = ['ours', 'base', 'theirs'].map((n) => path.join(scratch, n));
      fs.writeFileSync(p[0], ours, 'latin1'); fs.writeFileSync(p[1], base, 'latin1'); fs.writeFileSync(p[2], theirs, 'latin1');
      const r = run('git', ['merge-file', '-p', '-L', 'HEAD', '-L', 'merge base', '-L', 'origin/main', ...p], { encoding: 'latin1' });
      if (r.status === null || r.status > 127) throw new Error(`git merge-file failed: ${firstLine(r.stderr)}`);
      return { text: r.stdout, conflicts: r.status };
    };
    for (const [f, st] of conflicted) {
      const k = kind(f);
      if (k === 'whole') { (st[2] && st[3] ? fromBranch : dropped).push(f); continue; }
      if (k === 'page') {
        if (!st[2] || !st[3]) { left.push([f, `${how(st)}: a public page is never deleted (tools/TAKEDOWN.md withdraws one instead)`]); continue; }
        const mask = (s) => s.replace(STAMP, MASKED);
        const m = mergeFile(st[1] ? mask(blob(st[1].sha)) : '', mask(blob(st[2].sha)), mask(blob(st[3].sha)));
        const now = readText(f);
        if (now !== m.text && now !== null) {
          // Never overwrite what a person may have written. No marker left: settled by hand. A marker and the
          // constant: written by an earlier run of sync and edited since, or about to be.
          if (!MARKER.test(now)) { left.push([f, 'settled by hand but not staged: git add it, then run sync again']); continue; }
          if (now.includes(MASKED)) { left.push([f, 'partly settled by hand (it still holds a conflict marker): finish it, git add it, then run sync again']); continue; }
        }
        if (now !== m.text) fs.writeFileSync(abs(f), m.text, 'latin1');
        if (m.conflicts) left.push([f, `${plural(m.conflicts, 'conflict')} in the hand-written part, marked in the file (its stamps read ?v=${MASK} until sync runs stamp.js): settle it, git add it, then run sync again`]);
        else { settled.push(f); pagesMerged++; }
        continue;
      }
      if (k === 'lock') {
        if (!st[3]) { left.push([f, `${how(st)}: the lock is append-only and is never deleted`]); continue; }
        fs.writeFileSync(abs(f), blob(st[3].sha), 'latin1');
        settled.push(f);
        continue;
      }
      if (k === 'retired') {
        if (!st[2] || !st[3]) { left.push([f, `${how(st)}: settle it by hand`]); continue; }
        const lines = (s) => s.split('\n').filter((l, i, a) => i < a.length - 1 || l !== '');
        const theirs = blob(st[3].sha);
        const known = new Set([...(st[1] ? lines(blob(st[1].sha)) : []), ...lines(theirs)]);
        const own = lines(blob(st[2].sha)).filter((l) => !known.has(l));
        const out = (theirs && !theirs.endsWith('\n') ? theirs + '\n' : theirs) + own.map((l) => l + '\n').join('');
        const now = readText(f);
        if (now !== null && now !== out && !MARKER.test(now)) { left.push([f, 'settled by hand but not staged: git add it, then run sync again']); continue; }
        fs.writeFileSync(abs(f), out, 'latin1');
        settled.push(f);
        continue;
      }
      left.push([f, how(st)]);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  if (fromBranch.length) { inChunks(['checkout', '--ours'], fromBranch); inChunks(['add'], fromBranch); }
  if (dropped.length) inChunks(['rm', '-q', '-f'], dropped);
  if (settled.length) inChunks(['add'], settled);
  const lockDone = settled.includes(LOCK);
  const retiredDone = settled.includes(RETIRED);
  if (conflicted.size) {
    const parts = [];
    if (pagesMerged) parts.push(`${plural(pagesMerged, 'root page')} merged again with the stamps masked`);
    if (fromBranch.length + dropped.length) parts.push(`${plural(fromBranch.length + dropped.length, 'file')} the generator writes whole taken from this branch${dropped.length ? ` (${dropped.length} deleted)` : ''}`);
    if (lockDone) parts.push(`${LOCK} taken from origin/main`);
    if (retiredDone) parts.push(`${RETIRED} kept from origin/main with this branch's lines after them`);
    log(`note ${plural(conflicted.size, 'file')} conflicted${parts.length ? '; settled: ' + parts.join(', ') : ''}`);
  } else log('note git merged every file without a conflict');

  // --- 3. stop for a person
  if (left.length) {
    result.stopped = left.map(([f]) => f);
    log(`\nSTOP ${plural(left.length, 'file needs', 'files need')} a person, so nothing was regenerated or stamped:`);
    for (const [f, why] of left) log(`  ${f}: ${why}`);
    log('Settle each one and git add it, then run node tools/sync.js again (git merge --abort gives the merge up).');
    return result;
  }

  // --- 4. regenerate, check, stage
  const still = unmerged();
  if (still.size) { log(`FAIL still in conflict: ${[...still.keys()].join(', ')}`); result.stopped = [...still.keys()]; return result; }
  const marked = [];
  for (const f of git('diff', '--name-only', '-z', 'HEAD').split('\0').filter(Boolean)) {
    let b;
    try { b = fs.readFileSync(abs(f)); } catch (e) { continue; }   // deleted
    if (b.subarray(0, 8000).includes(0)) continue;             // binary
    if (MARKER.test(b.toString('latin1'))) marked.push(f);
  }
  if (marked.length) {
    result.stopped = marked;
    log(`\nSTOP ${plural(marked.length, 'file still holds', 'files still hold')} a conflict marker, so nothing was regenerated or stamped: ${marked.join(', ')}`);
    return result;
  }
  // Run one tool. On success the detail is its last line (seo-head.py's is a file name, so it gets none); on a
  // failure, the lines that say what failed.
  const step = (name, cmd, args, quiet) => {
    const r = run(cmd, args);
    const out = (r.stdout || '') + (r.stderr || '');
    const tail = out.trim().split('\n').filter(Boolean);
    if (r.status === 0) return { ok: true, name, detail: quiet ? '' : tail.slice(-1)[0] || '' };
    return { ok: false, name, detail: tail.filter((l) => /FAIL|STALE|MISSING|UNEXPECTED|stale|Error|error/.test(l)).slice(0, 12).join(' | ') || tail.slice(-5).join(' | ') };
  };
  const py = 'python3';
  for (const [name, cmd, args, quiet] of [['python3 tools/seo-head.py', py, ['tools/seo-head.py'], true], ['node tools/stamp.js', process.execPath, ['tools/stamp.js']]]) {
    const s = step(name, cmd, args, quiet);
    if (!s.ok) { log(`FAIL ${name} failed, so the merge is not settled: ${s.detail}`); return result; }
    log(`ok   ${name}${s.detail ? ': ' + s.detail : ''}`);
  }
  result.regenerated = true;
  const checks = [
    step('python3 tools/seo-head.py --check', py, ['tools/seo-head.py', '--check']),
    step('node tools/stamp.js --check', process.execPath, ['tools/stamp.js', '--check']),
    step('node tools/verify/permanence.js', process.execPath, ['tools/verify/permanence.js']),
  ];
  const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
  for (const k of langs) { try { for (const f of fs.readdirSync(abs(k))) if (f.endsWith('.html')) pages.push(`${k}/${f}`); } catch (e) { /* not built */ } }
  const masked = pages.filter((f) => (readText(f) || '').includes(MASKED));
  checks.push({ ok: masked.length === 0, name: `no page still carries the constant ?v=${MASK}`, detail: masked.length ? `stamp.js did not replace it in ${masked.slice(0, 5).join(', ')}${masked.length > 5 ? ` and ${masked.length - 5} more` : ''} (a ?v= value on a file stamp.js does not stamp?)` : '' });
  for (const c of checks) log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? ': ' + c.detail : ''}`);
  git('add', '-u', '--', '.');
  const folders = [...langs].filter((k) => fs.existsSync(abs(k)));
  if (folders.length) git('add', '-A', '--', ...folders);
  if (checks.every((c) => c.ok)) {
    result.code = 0;
    log(`\nPASS origin/main ${short(mergeHead)} is merged into ${where}, regenerated, restamped and staged, and not committed.`);
    log('Look it over (git diff --cached --stat), then commit it yourself: git commit --no-edit');
  } else {
    log(`\nFAIL the merge is staged but a check failed: do not commit it. Fix what failed, then run node tools/sync.js again.`);
  }
  return result;
}

// --- self-test: the two-branch cases, in temporary repositories built from the files of this tree
const SENTENCE = 'Sync self-test: this sentence was written on the branch.';
const MAIN_SENTENCE = 'Sync self-test: this sentence was written on main.';

function selfTest() {
  const started = Date.now();
  const results = [];
  const t = (ok, name, detail) => results.push([!!ok, name, ok ? '' : detail || '']);
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sync-self-test-')));
  if ((tmp + path.sep).startsWith(fs.realpathSync(ROOT) + path.sep)) {
    fs.rmSync(tmp, { recursive: true, force: true });
    return report([[false, 'the temporary folder is outside this repository', `${tmp} is inside it (set TMPDIR elsewhere)`]], 'nothing was tested');
  }
  // Children see no GIT_ variable of the caller (a GIT_DIR or GIT_INDEX_FILE would point them at the real
  // repository) and no global or system configuration, only an identity of their own.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const gitconfig = path.join(tmp, 'gitconfig');
  fs.writeFileSync(gitconfig, '[user]\n\tname = sync self-test\n\temail = sync-self-test@example.invalid\n[commit]\n\tgpgsign = false\n[init]\n\tdefaultBranch = main\n');
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitconfig, GIT_TERMINAL_PROMPT: '0' });
  const exec = (cwd, cmd, args) => {
    const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: BUFFER });
    if (r.error) throw r.error;
    return r;
  };
  const g = (cwd, ...args) => {
    const r = exec(cwd, 'git', args);
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} in ${cwd}: ${firstLine(r.stderr)}`);
    return r.stdout;
  };
  const tool = (cwd, cmd, args) => exec(cwd, cmd === 'node' ? process.execPath : cmd, args);
  const must = (r, what) => { if (r.status !== 0) throw new Error(`${what}: ${(r.stdout + r.stderr).trim().split('\n').slice(-3).join(' | ')}`); return r; };
  const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
  const write = (dir, f, s) => fs.writeFileSync(path.join(dir, f), s);
  const edit = (dir, f, fn) => {
    const before = read(dir, f);
    const after = fn(before);
    if (after === before) throw new Error(`the self-test's edit of ${f} changed nothing (has the file changed shape?)`);
    write(dir, f, after);
  };
  const commit = (dir, msg) => { g(dir, 'add', '-A'); g(dir, 'commit', '-q', '-m', msg); };
  const inside = (dir) => {
    const top = fs.realpathSync(g(dir, 'rev-parse', '--show-toplevel').trim());
    if (!top.startsWith(tmp + path.sep)) throw new Error(`${dir} resolves to the repository ${top}, outside the temporary folder: stopping before anything is changed`);
  };
  // The files of this tree as they are now, uncommitted edits included, so the tools under test are these. The list
  // is read with the caller's own environment: it is this repository's, and reading it changes nothing.
  let files = [];
  const listFiles = () => {
    const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8', maxBuffer: BUFFER });
    if (r.status !== 0) throw new Error(`cannot list the files of this tree: ${firstLine(r.stderr)}`);
    return r.stdout.split('\0').filter(Boolean).filter((f) => { try { return fs.lstatSync(path.join(ROOT, f)).isFile(); } catch (e) { return false; } });
  };
  const repos = (name, prepare) => {
    const dir = path.join(tmp, name);
    const main = path.join(dir, 'main');
    const work = path.join(dir, 'work');
    for (const f of files) {
      fs.mkdirSync(path.dirname(path.join(main, f)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, f), path.join(main, f));
    }
    if (prepare) prepare(main);
    g(dir, 'init', '-q', '-b', 'main', main);
    inside(main);
    commit(main, 'base');
    g(dir, 'clone', '-q', main, work);
    inside(work);
    g(work, 'switch', '-q', '-c', 'branch');
    return { main, work };
  };
  const syncIn = (work) => {
    const lines = [];
    const r = sync(work, { env, log: (s) => lines.push(s) });
    r.log = lines.join('\n');
    return r;
  };
  const logTail = (r) => r.log.split('\n').filter(Boolean).slice(-8).join(' | ');
  const pagesOf = (dir) => {
    const out = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
    for (const k of JSON.parse(read(dir, WHOLE[1])).languages) for (const f of fs.readdirSync(path.join(dir, k))) if (f.endsWith('.html')) out.push(`${k}/${f}`);
    return out;
  };
  const hashOf = (dir, f) => crypto.createHash('sha256').update(read(dir, f).replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
  const paragraph = (s) => (html) => html.replace('</main>', `<p>${s}</p>\n</main>`);

  try {
    files = listFiles();
    // 1. The case that costs 114 files today. The branch writes a sentence in about.html and a comment at the top of
    // styles.css and restamps; main writes a comment at the end of styles.css and restamps, so the stylesheet merges
    // cleanly and every page conflicts in its stamps. Both sides add a line to urls.retired. Two rows of generated
    // pages are taken out of the base lock: the branch's generator writes both back with the registry's date, and
    // main writes one of them back by hand, a day off that date, as main holds such rows today
    // (tools/REFACTORING-PLAN.md, section 5, item 6). A resolver that took the branch's lock would move that row.
    let gone = [];
    const one = repos('one', (dir) => {
      edit(dir, LOCK, (s) => {
        const rows = s.split('\n');
        const at = rows.map((l, i) => (/^https:\/\/vynatix\.com\/[a-z]{2}\/\S* \d{4}-\d{2}-\d{2}$/.test(l) ? i : -1)).filter((i) => i >= 0).slice(-2);
        gone = at.map((i) => rows[i].split(' ')[0]);
        return rows.filter((l, i) => !at.includes(i)).join('\n');
      });
    });
    edit(one.work, 'about.html', paragraph(SENTENCE));
    edit(one.work, 'styles.css', (s) => '/* Sync self-test: a comment the branch put at the top. */\n' + s);
    fs.appendFileSync(path.join(one.work, RETIRED), '# Sync self-test: a line the branch added.\n');
    must(tool(one.work, 'python3', ['tools/seo-head.py']), 'the branch runs seo-head.py');
    must(tool(one.work, 'node', ['tools/stamp.js']), 'the branch runs stamp.js');
    commit(one.work, 'branch');
    const branchRows = gone.map((u) => (read(one.work, LOCK).split('\n').find((l) => l.startsWith(u + ' ')) || ''));
    t(gone.length === 2 && branchRows.every(Boolean), "the branch's generator wrote back both rows taken out of the base lock", `rows: ${branchRows.join(', ')}`);
    const r0 = syncIn(one.work);
    t(r0.code === 0 && !exec(one.work, 'git', ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']).stdout.trim() && /nothing to merge/.test(r0.log), 'with origin/main already in the branch, sync merges nothing and says so', logTail(r0));

    edit(one.main, 'styles.css', (s) => s.replace(/\n*$/, '\n') + '/* Sync self-test: a comment main put at the end. */\n');
    fs.appendFileSync(path.join(one.main, RETIRED), '# Sync self-test: a line main added.\n');
    const [day] = branchRows[0].split(' ').slice(1);
    const offDay = new Date(Date.parse(day + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
    edit(one.main, LOCK, (s) => s.replace(/\n*$/, '\n') + `${gone[0]} ${offDay}\n`);
    must(tool(one.main, 'node', ['tools/stamp.js']), 'main runs stamp.js');
    commit(one.main, 'main');
    const branchCommit = g(one.work, 'rev-parse', 'HEAD').trim();

    const r1 = syncIn(one.work);
    const w = one.work;
    t(r1.code === 0 && r1.regenerated, 'sync settles the stamp conflicts, regenerates, passes its checks and stages the merge', logTail(r1));
    t(read(w, 'about.html').includes(SENTENCE), "the branch's sentence in about.html survives the merge", 'the sentence is gone');
    t(read(w, 'es/about.html').includes(SENTENCE), 'the generated pages were rebuilt from the merged page', 'es/about.html lacks the sentence');
    const css = read(w, 'styles.css');
    t(css.includes('a comment the branch put at the top') && css.includes('a comment main put at the end'), 'styles.css holds both comments', 'a comment is missing');
    const want = hashOf(w, 'styles.css');
    const stale = pagesOf(w).filter((f) => !read(w, f).includes(`styles.css?v=${want}"`));
    t(stale.length === 0, `every page names the merged styles.css by its own hash (${want}, computed here)`, `stale in ${stale.slice(0, 5).join(', ')}${stale.length > 5 ? ` and ${stale.length - 5} more` : ''}`);
    const sc = tool(w, 'node', ['tools/stamp.js', '--check']);
    t(sc.status === 0, 'stamp.js --check passes on the result', (sc.stdout || '').trim().split('\n').slice(-2).join(' | '));
    const shc = tool(w, 'python3', ['tools/seo-head.py', '--check']);
    t(shc.status === 0, 'seo-head.py --check passes on the result', (shc.stdout || '').trim().split('\n').slice(-1)[0]);
    const mainLock = g(w, 'show', 'origin/main:' + LOCK);
    const lockNow = read(w, LOCK);
    t(lockNow.startsWith(mainLock), "every row of main's lock is unchanged and in its place, the one a day off the registry included", `main has "${gone[0]} ${offDay}"; the result has "${lockNow.split('\n').find((l) => l.startsWith(gone[0] + ' '))}"`);
    t(lockNow.slice(mainLock.length) === branchRows[1] + '\n', "the generator appended the branch's own row after them, and nothing else", `after main's rows: ${JSON.stringify(lockNow.slice(mainLock.length).slice(0, 200))}`);
    const mainRetired = g(w, 'show', 'origin/main:' + RETIRED);
    t(read(w, RETIRED) === mainRetired + '# Sync self-test: a line the branch added.\n', "urls.retired keeps every line of main, with the branch's line after them", JSON.stringify(read(w, RETIRED).slice(-160)));
    const masked = pagesOf(w).filter((f) => read(w, f).includes(MASKED));
    t(masked.length === 0, `no page still carries the constant ?v=${MASK}`, masked.slice(0, 5).join(', '));
    const mh = exec(w, 'git', ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']).stdout.trim();
    t(mh && mh === g(w, 'rev-parse', 'origin/main').trim() && g(w, 'rev-parse', 'HEAD').trim() === branchCommit, 'the merge of origin/main is left in progress, not committed', `MERGE_HEAD ${mh || 'none'}`);
    t(!g(w, 'ls-files', '-u').trim() && !g(w, 'diff', '--name-only').trim() && exec(w, 'git', ['diff', '--cached', '--quiet']).status === 1, 'nothing is left in conflict and the whole result is staged', `unstaged: ${g(w, 'diff', '--name-only').trim().split('\n').slice(0, 5).join(', ')}`);

    // 2. A real conflict. Both sides write a different sentence in the same place of about.html and a different
    // comment at the end of styles.css. Sync has to stop, name both, mark only the real conflict in about.html and
    // regenerate nothing; a rerun must not overwrite a page settled by hand; and once both are settled and added, the
    // next run completes.
    const two = repos('two');
    edit(two.work, 'about.html', paragraph(SENTENCE));
    edit(two.work, 'styles.css', (s) => s.replace(/\n*$/, '\n') + '/* Sync self-test: the branch at the end. */\n');
    must(tool(two.work, 'node', ['tools/stamp.js']), 'the branch runs stamp.js');
    commit(two.work, 'branch');
    edit(two.main, 'about.html', paragraph(MAIN_SENTENCE));
    edit(two.main, 'styles.css', (s) => s.replace(/\n*$/, '\n') + '/* Sync self-test: main at the end. */\n');
    must(tool(two.main, 'node', ['tools/stamp.js']), 'main runs stamp.js');
    commit(two.main, 'main');
    const v = two.work;

    edit(v, 'contact.html', (s) => s + '\n');
    const rd = syncIn(v);
    t(rd.code === 1 && !exec(v, 'git', ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']).stdout.trim() && /uncommitted changes/.test(rd.log), 'with an uncommitted change to a tracked file, sync starts no merge', logTail(rd));
    g(v, 'checkout', '--', 'contact.html');

    const r2 = syncIn(v);
    const stopped = [...r2.stopped].sort().join(', ');
    t(r2.code === 1 && stopped === 'about.html, styles.css', 'a real conflict in a page and one in the stylesheet stop the command, and it names exactly those two', `code ${r2.code}, named: ${stopped || 'nothing'} | ${logTail(r2)}`);
    t(!r2.regenerated, 'when it stops it regenerates nothing', 'it regenerated');
    const page = read(v, 'about.html');
    const hunks = page.match(/^<{7} [\s\S]*?^>{7} .*$/gm) || [];
    t(hunks.length === 1 && hunks[0].includes(SENTENCE) && hunks[0].includes(MAIN_SENTENCE) && !hunks[0].includes('?v='), 'about.html is left with one conflict marked, the two sentences, and no stamp in it', `${hunks.length} conflict(s) marked`);
    t(g(v, 'ls-files', '-u', '--', 'about.html').trim() !== '', 'about.html is left unmerged for the person', 'it was staged');
    t(read(v, 'index.html').includes(MASKED) && !g(v, 'ls-files', '-u', '--', 'index.html').trim(), `a page whose only conflict was its stamps is settled and staged, still carrying ?v=${MASK}, because stamp.js has not run`, 'index.html was not settled that way');
    const r2b = syncIn(v);
    t(r2b.code === 1 && read(v, 'about.html') === page, 'running it again before anything is settled changes nothing', logTail(r2b));

    // The person starts on about.html (a byte outside the conflict) and stops halfway: the next run keeps it.
    const partly = page.replace('</html>', '</html>\n<!-- Sync self-test: a person was here. -->');
    write(v, 'about.html', partly);
    const r2c = syncIn(v);
    t(r2c.code === 1 && /about\.html: partly settled by hand/.test(r2c.log) && read(v, 'about.html') === partly, 'a page partly settled by hand, still holding a marker, is named and keeps the hand text', `code ${r2c.code} | ${logTail(r2c)}`);

    // about.html settled by hand and not added; styles.css added as it stands, conflict markers and all.
    const hand = page.replace(/^<{7} [\s\S]*?^>{7} .*\n/m, `<p>${SENTENCE}</p>\n<p>${MAIN_SENTENCE}</p>\n`);
    write(v, 'about.html', hand);
    g(v, 'add', 'styles.css');
    const r3 = syncIn(v);
    t(r3.code === 1 && r3.stopped.join() === 'about.html' && /about\.html: settled by hand but not staged/.test(r3.log) && read(v, 'about.html') === hand, 'a page settled by hand but not staged is named, not merged again, and keeps the hand text', `code ${r3.code}, named ${r3.stopped.join(', ')} | ${logTail(r3)}`);
    g(v, 'add', 'about.html');
    const r3b = syncIn(v);
    t(r3b.code === 1 && r3b.stopped.join() === 'styles.css' && !r3b.regenerated && /still holds? a conflict marker/.test(r3b.log) && read(v, 'index.html').includes(MASKED), 'a stylesheet added with its conflict markers stops the command before anything is regenerated or stamped', `code ${r3b.code}, named ${r3b.stopped.join(', ')} | ${logTail(r3b)}`);
    write(v, 'styles.css', g(v, 'show', 'MERGE_HEAD:styles.css') + '/* Sync self-test: the branch, settled by hand. */\n');
    g(v, 'add', 'styles.css');
    const r4 = syncIn(v);
    t(r4.code === 0 && r4.regenerated, 'once both are settled and added, the next run regenerates, passes its checks and stages the merge', logTail(r4));
    const settledPage = read(v, 'about.html');
    t(settledPage.includes(SENTENCE) && settledPage.includes(MAIN_SENTENCE) && !MARKER.test(settledPage), 'the settled about.html keeps both sentences', 'a sentence is gone');
    const want2 = hashOf(v, 'styles.css');
    const stale2 = pagesOf(v).filter((f) => !read(v, f).includes(`styles.css?v=${want2}"`));
    t(stale2.length === 0 && tool(v, 'node', ['tools/stamp.js', '--check']).status === 0, 'every page names the settled styles.css by its own hash', `stale in ${stale2.slice(0, 5).join(', ')}`);

    // 3. The same conflict, but the person starts the merge with git, settles about.html by hand from git's own
    // output (real stamps, no marker left) and does not add it. Sync must name the page and leave the hand text.
    const three = repos('three');
    edit(three.work, 'about.html', paragraph(SENTENCE));
    edit(three.work, 'styles.css', (s) => s.replace(/\n*$/, '\n') + '/* Sync self-test: the branch at the end. */\n');
    must(tool(three.work, 'node', ['tools/stamp.js']), 'the branch runs stamp.js');
    commit(three.work, 'branch');
    edit(three.main, 'about.html', paragraph(MAIN_SENTENCE));
    edit(three.main, 'styles.css', (s) => s.replace(/\n*$/, '\n') + '/* Sync self-test: main at the end. */\n');
    must(tool(three.main, 'node', ['tools/stamp.js']), 'main runs stamp.js');
    commit(three.main, 'main');
    const u = three.work;
    // First the two refusals: on main, and with a merge in progress that is not of origin/main.
    g(u, 'switch', '-q', 'main');
    const rm = syncIn(u);
    t(rm.code === 1 && /this is main/.test(rm.log) && !exec(u, 'git', ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']).stdout.trim(), 'on main, sync refuses and starts no merge', logTail(rm));
    g(u, 'switch', '-q', '-c', 'side', 'branch');
    edit(u, 'contact.html', (s) => s + '\n');
    commit(u, 'side');
    g(u, 'switch', '-q', 'branch');
    g(u, 'merge', '-q', '--no-commit', '--no-ff', 'side');
    const rs = syncIn(u);
    t(rs.code === 1 && /neither origin\/main nor an earlier commit of it/.test(rs.log) && !rs.regenerated, 'with a merge of another branch in progress, sync refuses and touches nothing', logTail(rs));
    g(u, 'merge', '--abort');
    g(u, 'fetch', '-q', 'origin', 'main');
    exec(u, 'git', ['merge', '--no-commit', '--no-ff', 'origin/main']);
    const byHand = paragraph(MAIN_SENTENCE)(g(u, 'show', ':2:about.html'));
    write(u, 'about.html', byHand);
    const r5 = syncIn(u);
    t(r5.code === 1 && r5.stopped.includes('about.html') && /about\.html: settled by hand but not staged/.test(r5.log) && read(u, 'about.html') === byHand, "a page settled by hand from git's own output and not staged is named and keeps the hand text", `code ${r5.code}, named ${r5.stopped.join(', ')} | ${logTail(r5)}`);
  } catch (e) {
    t(false, 'the self-test ran to the end', e.message);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return report(results, `every rule of sync.js holds (${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

function report(lines, title) {
  let bad = 0;
  for (const [ok, name, detail] of lines) {
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
  }
  console.log(bad === 0 ? `\nPASS: ${title}` : `\nFAIL: ${bad} problem(s): ${title}`);
  return bad === 0 ? 0 : 1;
}

function main(argv) {
  const known = ['--self-test', '--no-fetch'];
  const unknown = argv.filter((a) => !known.includes(a));
  if (unknown.length || (argv.includes('--self-test') && argv.length > 1)) {
    console.error('usage: node tools/sync.js [--no-fetch] | node tools/sync.js --self-test');
    return 2;
  }
  if (argv.includes('--self-test')) return selfTest();
  try {
    return sync(ROOT, { fetch: !argv.includes('--no-fetch') }).code;
  } catch (e) {
    console.log(`FAIL ${e.message} (the merge, if one started, is left as it is: git status shows it, git merge --abort gives it up)`);
    return 1;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { sync, MASK };
