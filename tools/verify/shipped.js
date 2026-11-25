// What a change ships: the published files, compared between two revisions by their git blob ids. Static, no
// browser, no server, no npm install. The acceptance test of tools/REFACTORING-PLAN.md: a pull request that says it
// changes nothing on the site has to list nothing here.
//
//   node verify/shipped.js                     fetch origin/main, compare the working tree with the merge base
//   node verify/shipped.js --base A --head B   compare two revisions (the workflow: HEAD^1 and HEAD of the merge)
//   node verify/shipped.js --no-fetch          the same without fetching; says which origin/main it used
//   node verify/shipped.js --neutral           fail when any published file or build input differs
//   node verify/shipped.js --built <dir>       compare a Jekyll build of the head with the files it should publish
//   node verify/shipped.js --self-test         prove that each rule can fail
//
// The published set is derived the way GitHub Pages' Jekyll derives it: every tracked file except _config.yml, the
// paths named in its `exclude`, and any path with a part that begins with . _ # or ends with ~ unless `include` names
// it (.well-known). The comparison is exact only while Jekyll copies every published file through unchanged, so it
// fails outright on what would make Jekyll change a file: a .nojekyll (every tracked file would be served, tools/
// and the security notes included), a published file that begins with `---` (front matter: Jekyll renders it), and
// a published Markdown file (github-pages renders Markdown even without front matter). _config.yml and _data/ are
// not published but decide published bytes, so a change to either is listed as a build input.
//
// A pull request declares itself byte-neutral with this line, alone, in its description:
//   Byte-neutral: yes
// The workflow passes the description in PR_BODY; with the line present, any listed file fails the run. Without it
// the list is printed and the run passes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { yamlList } = require('./publish');

const ROOT = path.join(__dirname, '..', '..');
const DECLARATION = /^\s*Byte-neutral:\s*yes\s*$/m;
const BUILD_EXTRA = ['assets/css/style.css'];      // the default theme's stylesheet: GitHub adds it, the repo holds none
const RENDERED_EXT = /\.(md|markdown|mkdown|mkdn|mkd)$/i;

const git = (args, opts = {}) => execFileSync('git', args, Object.assign({ cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }, opts));
const blobId = (buf) => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

// --- the published set, from a listing { path: blobId } and the text of _config.yml
function special(part) { return /^[._#]/.test(part) || /~$/.test(part); }
function published(listing, configText) {
  const exclude = yamlList(configText || '', 'exclude');
  const include = yamlList(configText || '', 'include');
  const out = {};
  for (const f of Object.keys(listing)) {
    if (f === '_config.yml') continue;
    if (exclude.some((e) => f === e || f.startsWith(e + '/'))) continue;
    const parts = f.split('/');
    let skip = false;
    for (let i = 0; i < parts.length && !skip; i++) {
      if (!special(parts[i])) continue;
      const sofar = parts.slice(0, i + 1).join('/');
      if (!include.some((n) => sofar === n || sofar.startsWith(n + '/'))) skip = true;
    }
    if (!skip) out[f] = listing[f];
  }
  return out;
}
// The files that are not published but decide what is: _config.yml and _data/.
function inputs(listing) {
  const out = {};
  for (const f of Object.keys(listing)) if (f === '_config.yml' || f.startsWith('_data/')) out[f] = listing[f];
  return out;
}

// --- listings: { path: blobId } for a revision or the working tree, and a reader for a file's first bytes
function listRev(rev) {
  const out = {};
  for (const rec of git(['ls-tree', '-r', '-z', '--full-tree', rev]).split('\0')) {
    if (!rec) continue;
    const tab = rec.indexOf('\t');
    const [mode, type, sha] = rec.slice(0, tab).split(' ');
    if (type === 'blob') out[rec.slice(tab + 1)] = mode === '120000' ? 'symlink:' + sha : sha;
  }
  return out;
}
function listWorktree() {
  const out = {};
  for (const f of git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0')) {
    if (!f) continue;
    const abs = path.join(ROOT, f);
    let st;
    try { st = fs.lstatSync(abs); } catch (e) { continue; }       // deleted in the working tree
    if (st.isSymbolicLink()) out[f] = 'symlink:' + blobId(Buffer.from(fs.readlinkSync(abs)));
    else if (st.isFile()) out[f] = blobId(fs.readFileSync(abs));
  }
  return out;
}
function reader(rev) {
  if (rev === null) return (f) => { try { return fs.readFileSync(path.join(ROOT, f)); } catch (e) { return null; } };
  return (f) => { try { return git(['show', `${rev}:${f}`], { encoding: 'buffer' }); } catch (e) { return null; } };
}

// A .nojekyll turns Jekyll off for the whole site, `exclude` with it, so every tracked file would be served. Pages
// reads the one at the root; one in a published folder is refused too. It is looked for in the listing itself,
// because the published-set rules drop every dot file, this one included.
function nojekyllProblems(listing, configText) {
  const out = [];
  for (const f of Object.keys(listing)) {
    if (!/(^|\/)\.nojekyll$/.test(f)) continue;
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '';
    if (dir === '' || Object.keys(published({ [dir + '/probe.html']: 'x' }, configText)).length) out.push(`${f} is in the tree (Pages would then serve every tracked file, tools/ and the docs included)`);
  }
  return out;
}

// --- the rules on one published set. read(f) gives a file's bytes (or null).
function shapeProblems(pub, read) {
  const out = [];
  for (const f of Object.keys(pub)) {
    if (String(pub[f]).startsWith('symlink:')) { out.push(`${f} is a symbolic link (the Pages branch build refuses them)`); continue; }
    if (RENDERED_EXT.test(f)) { out.push(`${f} is published Markdown (github-pages renders it, so its bytes are not what ships)`); continue; }
    const b = read(f);
    if (b && b.length >= 3 && b.slice(0, 3).toString('latin1') === '---') out.push(`${f} begins with --- (front matter: Jekyll would render it instead of copying it)`);
  }
  if (Object.keys(pub).filter((f) => !String(pub[f]).startsWith('symlink:')).length === 0) out.push('nothing would be published (wrong revision, or _config.yml excludes everything)');
  return out;
}
function diff(a, b) {
  const out = [];
  for (const f of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (a[f] === b[f]) continue;
    out.push(`${a[f] === undefined ? 'added  ' : b[f] === undefined ? 'removed' : 'changed'} ${f}`);
  }
  return out;
}
// Compare a build directory with the published set it should hold.
function builtProblems(dir, pub, read) {
  const out = [];
  const seen = new Set();
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(r);
      else seen.add(r);
    }
  };
  walk('');
  for (const f of Object.keys(pub).sort()) {
    if (!seen.has(f)) { out.push(`missing from the build: ${f}`); continue; }
    const want = read(f);
    const got = fs.readFileSync(path.join(dir, f));
    if (!want || !want.equals(got)) out.push(`differs from the repository: ${f}`);
  }
  for (const f of [...seen].sort()) if (!(f in pub) && !BUILD_EXTRA.includes(f)) out.push(`in the build but not in the repository: ${f}`);
  return out;
}

function report(lines, title) {
  let bad = 0;
  for (const [ok, name, detail] of lines) {
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  }
  console.log(bad === 0 ? `\nPASS — ${title}` : `\nFAIL — ${bad} problem(s): ${title}`);
  return bad === 0 ? 0 : 1;
}

function main(argv) {
  const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
  if (argv.includes('--self-test')) return selfTest();
  const lines = [];
  const neutral = argv.includes('--neutral') || DECLARATION.test(process.env.PR_BODY || '');

  const headRev = opt('--head') || null;                    // null: the working tree
  const headList = headRev ? listRev(headRev) : listWorktree();
  const headRead = reader(headRev);
  const headConfig = (headRead('_config.yml') || Buffer.from('')).toString('utf8');
  const headPub = published(headList, headConfig);
  const headName = headRev ? `${headRev} (${git(['rev-parse', '--short', headRev]).trim()})` : 'the working tree';

  const shape = nojekyllProblems(headList, headConfig).concat(shapeProblems(headPub, headRead));
  lines.push([shape.length === 0, `${headName} publishes ${Object.keys(headPub).length} files, every one copied through unchanged by Jekyll`, shape.join(' | ')]);

  const built = opt('--built');
  if (built) {
    const b = builtProblems(path.resolve(built), headPub, headRead);
    lines.push([b.length === 0, `the build in ${built} holds exactly the published files of ${headName}, byte for byte (plus ${BUILD_EXTRA.join(', ')})`, b.slice(0, 20).join(' | ') + (b.length > 20 ? ` | and ${b.length - 20} more` : '')]);
    return report(lines, 'the build is what the repository says it publishes');
  }

  let baseRev = opt('--base');
  if (!baseRev) {
    if (!argv.includes('--no-fetch')) {
      try { git(['fetch', '--quiet', 'origin', 'main'], { stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (e) {
        lines.push([false, 'origin/main can be fetched', String(e.stderr || e.message).trim().split('\n')[0] + ' (run with --no-fetch to compare with the origin/main you have, or --base <rev>)']);
        return report(lines, 'nothing compared');
      }
    }
    let main;
    try { main = git(['rev-parse', '--verify', '--quiet', 'origin/main']).trim(); } catch (e) { main = ''; }
    if (!main) { lines.push([false, 'origin/main exists in this clone', 'there is no origin/main to compare with (fetch it, or pass --base <rev>)']); return report(lines, 'nothing compared'); }
    try { baseRev = git(['merge-base', 'origin/main', headRev || 'HEAD']).trim(); }
    catch (e) { lines.push([false, 'this branch and origin/main share a commit', 'no merge base in this clone (a shallow clone may need git fetch --deepen)']); return report(lines, 'nothing compared'); }
    console.log(`note comparing with ${baseRev.slice(0, 7)}, the merge base with origin/main ${main.slice(0, 7)}${argv.includes('--no-fetch') ? ' (not fetched now)' : ''}`);
  }
  const baseList = listRev(baseRev);
  const baseConfig = (reader(baseRev)('_config.yml') || Buffer.from('')).toString('utf8');
  const basePub = published(baseList, baseConfig);

  const moved = diff(basePub, headPub);
  const inputMoved = diff(inputs(baseList), inputs(headList));
  const listed = moved.concat(inputMoved.map((l) => l + ' (build input)'));
  for (const l of listed.slice(0, 200)) console.log('  ' + l);
  if (listed.length > 200) console.log(`  and ${listed.length - 200} more`);
  const summary = `${moved.length} published file(s) and ${inputMoved.length} build input(s) differ from ${baseRev.slice(0, 7)}`;
  if (neutral) lines.push([listed.length === 0, 'declared byte-neutral: no published file and no build input differs', listed.length ? summary : '']);
  else lines.push([true, summary + (listed.length ? ' (listed above; not declared byte-neutral, so this is a report)' : ''), '']);
  return report(lines, neutral ? 'nothing on the site changes' : 'what this change ships is listed');
}

// --- self-test: each rule fails on the case it exists for, and passes on the case next to it
function selfTest() {
  const results = [];
  const t = (ok, name) => results.push([!!ok, name, '']);
  const cfg = 'include:\n  - .well-known\nexclude:\n  - tools\n  - AGENTS.md\n  - assets/AGENTS.md\n';
  const list = { 'index.html': 'a', 'styles.css': 'b', 'tools/x.js': 'c', 'AGENTS.md': 'd', 'assets/AGENTS.md': 'e', 'assets/logo.svg': 'f', '.well-known/security.txt': 'g', '.gitignore': 'h', '_config.yml': 'i', '_data/stamps/styles.json': 'j', 'CNAME': 'k' };
  const pub = published(list, cfg);
  t(JSON.stringify(Object.keys(pub).sort()) === JSON.stringify(['.well-known/security.txt', 'CNAME', 'assets/logo.svg', 'index.html', 'styles.css']), 'the published set follows exclude, include and the dot/underscore rule');
  t(JSON.stringify(Object.keys(inputs(list)).sort()) === JSON.stringify(['_config.yml', '_data/stamps/styles.json']), '_config.yml and _data/ are build inputs');
  const bytes = { 'index.html': Buffer.from('<!doctype html>'), 'styles.css': Buffer.from('a{}') };
  const rd = (f) => bytes[f] || Buffer.from('x');
  t(shapeProblems(pub, rd).length === 0, 'a plain tree has no shape problem');
  t(nojekyllProblems(Object.assign({}, list, { '.nojekyll': 'z' }), cfg).some((p) => /^\.nojekyll/.test(p)), 'a .nojekyll at the root fails, although the dot-file rule leaves it out of the published set');
  t(nojekyllProblems(Object.assign({}, list, { 'assets/.nojekyll': 'z' }), cfg).length === 1 && nojekyllProblems(Object.assign({}, list, { 'tools/.nojekyll': 'z' }), cfg).length === 0, 'one in a published folder fails, one in an excluded folder does not');
  t(shapeProblems(pub, (f) => (f === 'styles.css' ? Buffer.from('---\n---\na{}') : rd(f))).some((p) => /styles\.css begins with ---/.test(p)), 'a published file that begins with --- fails');
  t(shapeProblems(published(Object.assign({}, list, { 'NOTES.md': 'm' }), cfg), rd).some((p) => /NOTES\.md is published Markdown/.test(p)), 'a published Markdown file fails');
  t(shapeProblems(published(Object.assign({}, list, { 'AGENTS.md': 'changed' }), cfg), rd).length === 0, 'an excluded Markdown file does not');
  t(shapeProblems(published(Object.assign({}, list, { 'x.html': 'symlink:1' }), cfg), rd).some((p) => /symbolic link/.test(p)), 'a published symbolic link fails');
  t(diff(pub, published(Object.assign({}, list, { 'tools/x.js': 'c2', 'AGENTS.md': 'd2' }), cfg)).length === 0, 'a change to an excluded file moves nothing');
  t(diff(pub, published(Object.assign({}, list, { 'styles.css': 'b2' }), cfg)).join() === 'changed styles.css', 'a change to a published file is listed');
  t(diff(inputs(list), inputs(Object.assign({}, list, { '_config.yml': 'i2' }))).join() === 'changed _config.yml', 'a change to _config.yml is listed as a build input');
  t(DECLARATION.test('Moves the docs.\n\nByte-neutral: yes\n') && !DECLARATION.test('Byte-neutral: no') && !DECLARATION.test('not Byte-neutral: yes'), 'the declaration is one line, exactly');
  // --built against a temporary directory
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipped-'));
  const put = (f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
  const small = { 'index.html': 'a', 'styles.css': 'b' };
  const sread = (f) => bytes[f] || null;
  put('index.html', '<!doctype html>'); put('styles.css', 'a{}'); put('assets/css/style.css', 'theme');
  t(builtProblems(dir, small, sread).length === 0, 'a build with the published files and the theme stylesheet passes');
  put('styles.css', 'a{color:red}');
  t(builtProblems(dir, small, sread).some((p) => /differs.*styles\.css/.test(p)), 'a build whose bytes differ fails');
  put('styles.css', 'a{}'); put('extra.html', 'x');
  t(builtProblems(dir, small, sread).some((p) => /not in the repository: extra\.html/.test(p)), 'a file the repository does not hold fails');
  fs.rmSync(path.join(dir, 'extra.html')); fs.rmSync(path.join(dir, 'index.html'));
  t(builtProblems(dir, small, sread).some((p) => /missing from the build: index\.html/.test(p)), 'a missing file fails');
  fs.rmSync(dir, { recursive: true, force: true });
  return report(results, 'every rule of shipped.js can fail');
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { published, inputs, nojekyllProblems, shapeProblems, diff, builtProblems, listRev, listWorktree, DECLARATION };
