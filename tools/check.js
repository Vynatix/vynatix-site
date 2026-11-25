// The runner of the check chain: every step of `npm run check`, with its own server, the browser checks side by
// side, and one summary at the end.
//
//   node check.js                  from tools/ (or node tools/check.js from the root): the whole chain
//   node check.js --static         the static steps only: no server, no browser, no npm install
//   node check.js --only a,b       only the steps named (csp, seo.js, verify/a11y.js, check:bg, a whole command, or
//                                  one sweep job as the summary prints it, "node verify/bg-fit.js --sweep 4")
//   node check.js --jobs N         at most N browser checks at a time (default: 4, or fewer cores if there are fewer)
//   node check.js --since <rev>    skip the two hero guards when no input of the hero changed since <rev>
//   node check.js --list           print what each step proves, from the first comment block of its script
//
// The chain is not written down here. The runner reads the `check` script of tools/package.json, splits it on &&
// and expands each `npm run <name>` into that script's own steps, so a check added to the chain is picked up
// without an edit to this file, and `npm run check` stays what it was: the same steps, one after the other. The
// `check` script therefore has to stay the chain itself; a chain that names check.js is refused, because it would
// run itself.
//
// A step is a browser step when its script calls launch( (the one in _common.js), directly or through a local
// helper it requires other than _common.js, or through a sibling script it runs as a child process (bg-fit.js runs
// bg-sheet.js that way). Every other step is static: the Python generator's --check, stamp.js --check and the
// self-tests among them. The static steps run first, one after the other, as in the chain. Then the runner starts
// its own server over the repository root on a free port, sets BASE to it for every child, and runs the browser
// steps as child processes, N at a time. The two hero guards start first: bg-sheet.js is the longest check by far,
// so the run cannot end before it does, and every other check fits beside it. A script that answers --sweeps
// (bg-fit.js) is started as that many jobs, `--sweep 1` to `--sweep N`, in place of its plain step; the runner never
// asks a script that does not name the flag in its source, because an unknown flag would run the whole check.
//
// The server answers the way `python3 -m http.server` does, which is the server the checks were proven against:
// the query string is ignored, a directory answers with its index.html (and a directory named without its
// trailing slash is redirected to it), every file is sent byte for byte with the content type Python's own table
// gives it, Content-Length and Last-Modified are sent and If-Modified-Since is honoured, GET and HEAD only, and
// anything outside the repository answers 404. The one difference: a directory without an index.html answers 404,
// as on GitHub Pages, where Python would list it.
//
// Each child's output is captured whole and written to a log in a temporary folder. When a step ends, one line
// says so; at the end the summary lists every step with its verdict and its time, the total wall time, and for
// each failing step every line of its output that says FAIL and the last 40 lines. The exit code is 1 if any step
// failed, 2 if the runner could not start (an unknown name, a chain it cannot read), 130 when it was stopped, and 0
// otherwise. A skipped step is printed as skipped, never as passed. Ctrl-C stops every child with its browsers,
// starts no other and prints what ran.
//
// --since compares <rev> with the working tree, untracked files included. The inputs of the hero are the
// stylesheets, the fonts, the sheet's art, index.html, app.js, the two guards with _common.js, and the lock file
// that pins the browser (HERO_INPUTS below). When none of them changed, bg-sheet.js and bg-fit.js are skipped and
// the runner says so; when one did, or <rev> cannot be read (a shallow clone), they run and the runner says why.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { ROOT, stripJsComments } = require('./verify/_common');

const TOOLS = __dirname;
const COMMON = path.join(TOOLS, 'verify', '_common.js');
const SELF = __filename;

// The hero guards, by script name, and what they read: a change to any of these can move the hero or the guard.
// A path that ends with / is a folder, one that ends with * a prefix.
const HERO_GUARDS = ['bg-sheet.js', 'bg-fit.js'];
const HERO_INPUTS = [
  'styles.css', 'tokens.css', 'colors_and_type.css', 'hero-bg.css', 'fonts/', 'assets/bg-sheet-*', 'index.html',
  'app.js', 'tools/verify/bg-sheet.js', 'tools/verify/bg-fit.js', 'tools/verify/_common.js', 'tools/package-lock.json',
];

// The content types `python3 -m http.server` sends (Python 3.13, mimetypes), so a check sees what it saw there.
const TYPES = {
  '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/vnd.microsoft.icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.txt': 'text/plain', '.xml': 'application/xml', '.md': 'text/markdown',
  '.yml': 'application/yaml', '.yaml': 'application/yaml', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.py': 'text/x-python',
};

const TAIL = 40;            // lines of a failing step's output printed at the end
const FAIL_LINES = 40;      // at most this many earlier lines that say FAIL, printed above the tail

// --- Arguments -------------------------------------------------------------------------------------------------

function usageError(msg) {
  console.error(`check.js: ${msg}`);
  console.error('usage: node check.js [--static] [--only name,...] [--jobs N] [--since <rev>] [--list]');
  process.exit(2);
}

function parseArgs(argv) {
  const o = { static: false, only: null, jobs: null, since: null, list: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let v = null;
    const eq = a.indexOf('=');
    if (a.startsWith('--') && eq > 0) { v = a.slice(eq + 1); a = a.slice(0, eq); }
    const value = () => {
      if (v !== null) return v;
      if (i + 1 >= argv.length) usageError(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--static') o.static = true;
    else if (a === '--list') o.list = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--only') o.only = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--since') o.since = value();
    else if (a === '--jobs') {
      const n = Number(value());
      if (!Number.isInteger(n) || n < 1) usageError('--jobs takes a whole number of 1 or more');
      o.jobs = n;
    } else usageError(`unknown argument ${argv[i]}`);
  }
  if (o.only && !o.only.length) usageError('--only needs at least one name');
  return o;
}

// --- The chain -------------------------------------------------------------------------------------------------

// The steps of the `check` script, in order, with every `npm run <name>` replaced by the steps of that script.
// Each step is { cmd, env, program, args, script, from, index } where script is the absolute path of the file it
// runs, from the npm script it came from (null for a step of check itself) and index its place in the chain.
function readChain() {
  const pkgFile = path.join(TOOLS, 'package.json');
  let scripts;
  try { scripts = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).scripts || {}; } catch (e) { usageError(`cannot read ${pkgFile}: ${e.message}`); }
  if (!scripts.check) usageError('tools/package.json has no check script');
  const steps = [];
  const expand = (name, stack) => {
    if (stack.includes(name)) usageError(`npm run ${name} runs itself (${stack.concat(name).join(' > ')})`);
    if (scripts[name] === undefined) usageError(`the chain runs npm run ${name}, which tools/package.json does not define`);
    for (const part of scripts[name].split('&&').map((s) => s.trim())) {
      if (!part) usageError(`the ${name} script has an empty step`);
      if (/["'`$|;<>(){}\\&*?~]/.test(part)) usageError(`cannot run the step "${part}" of the ${name} script without a shell; write it as [NAME=value ...] program args`);
      const tokens = part.split(/\s+/);
      const env = {};
      while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) {
        const t = tokens.shift();
        env[t.slice(0, t.indexOf('='))] = t.slice(t.indexOf('=') + 1);
      }
      if (!tokens.length) usageError(`the step "${part}" of the ${name} script runs nothing`);
      if (tokens[0] === 'npm') {
        if (tokens[1] !== 'run' || tokens.length !== 3 || Object.keys(env).length) usageError(`cannot expand "${part}": only a plain npm run <name> is understood`);
        expand(tokens[2], stack.concat(name));
        continue;
      }
      const [program, ...args] = tokens;
      const first = args.find((x) => !x.startsWith('-'));
      const script = first ? path.resolve(TOOLS, first) : null;
      if (script === SELF) usageError(`the ${name} script runs check.js: the check script has to stay the chain itself, because check.js reads it`);
      steps.push({ cmd: part, env, program, args, script, from: stack.length ? name : null, index: steps.length });
    }
  };
  expand('check', []);
  return steps;
}

// Why a script is a browser step ('calls launch()', 'through x.js', 'runs x.js'), or null for a static one.
function browserReason(file, seen = new Set()) {
  if (!file || seen.has(file) || file === COMMON || !/\.js$/.test(file)) return null;
  seen.add(file);
  let code;
  try { code = stripJsComments(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  if (/\blaunch\s*\(/.test(code)) return 'calls launch()';
  const dir = path.dirname(file);
  for (const m of code.matchAll(/\brequire\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g)) {
    let dep;
    try { dep = require.resolve(path.resolve(dir, m[2])); } catch (e) { continue; }
    if (dep === COMMON) continue;
    if (browserReason(dep, seen)) return `through ${path.relative(dir, dep)}`;
  }
  if (/\brequire\(\s*['"]child_process['"]\s*\)/.test(code)) {
    for (const m of code.matchAll(/(['"`])([\w.-]+\.js)\1/g)) {
      const sib = path.join(dir, m[2]);
      if (sib !== file && fs.existsSync(sib) && browserReason(sib, seen)) return `runs ${m[2]}`;
    }
  }
  return null;
}

// Whether a script declares --sweeps in its own code (a string literal, not a comment).
function declaresSweeps(file) {
  try { return /(['"`])--sweeps\1/.test(stripJsComments(fs.readFileSync(file, 'utf8'))); } catch (e) { return false; }
}

function spawnTarget(step) {
  return step.program === 'node' ? process.execPath : step.program;
}

// How many sweeps the script says it has, or null when it cannot say.
function sweepCount(step) {
  const r = spawnSync(spawnTarget(step), step.args.concat('--sweeps'), { cwd: TOOLS, env: Object.assign({}, process.env, step.env), encoding: 'utf8', timeout: 30000 });
  const n = Number(String(r.stdout || '').trim());
  return r.status === 0 && Number.isInteger(n) && n > 0 ? n : null;
}

// The names a step answers to in --only: the whole command, the command without its program, the script as the
// chain names it, its file name with and without the extension, and the npm script it came from.
function namesOf(step) {
  const out = new Set([step.cmd, step.cmd.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*\S+\s+/, '')]);
  const first = step.args.find((x) => !x.startsWith('-'));
  if (first) {
    out.add(first);
    out.add(path.basename(first));
    out.add(path.basename(first).replace(/\.[^.]+$/, ''));
  }
  if (step.from) out.add(step.from);
  return out;
}

const scriptName = (step) => (step.script ? path.basename(step.script) : step.program);
const isHeroGuard = (step) => HERO_GUARDS.includes(scriptName(step));

// --- The first comment block -----------------------------------------------------------------------------------

// The header of a script as plain lines: the leading // or # comments of a script, or the docstring of a Python
// module, with the comment marks taken off. A blank line stays blank.
function headerLines(file) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
  const lines = src.split('\n');
  let i = 0;
  if (lines[0] && lines[0].startsWith('#!')) i++;
  if (/\.py$/.test(file)) {
    while (i < lines.length && !lines[i].trim()) i++;
    const m = /^\s*[rub]*("""|''')(.*)$/i.exec(lines[i] || '');
    if (m) {
      const q = m[1];
      const out = [];
      let rest = m[2];
      for (;;) {
        const end = rest.indexOf(q);
        if (end >= 0) { out.push(rest.slice(0, end)); return out; }
        out.push(rest);
        if (++i >= lines.length) return out;
        rest = lines[i];
      }
    }
    const out = [];
    for (; i < lines.length && /^\s*#/.test(lines[i]); i++) out.push(lines[i].replace(/^\s*#\s?/, ''));
    return out;
  }
  const out = [];
  for (; i < lines.length && /^\s*\/\//.test(lines[i]); i++) out.push(lines[i].replace(/^\s*\/\/ ?/, ''));
  return out;
}

// A usage line names a command: `node verify/x.js ...`, `cd tools && ...`, `python3 ...`, `npm ...`, or an
// environment variable set before one.
const USAGE = /^\s*(?:(?:[A-Z][A-Z0-9_]*=\S*\s+)+)?(?:cd\s|node\s|python3?\s|npm\s)/;

// The first paragraph of the header: the lines up to the first blank line, the first usage line or the first item
// of a list, joined into one.
function firstParagraph(lines) {
  const out = [];
  for (const l of lines) {
    if (!l.trim()) { if (out.length) break; continue; }
    if (USAGE.test(l)) { if (out.length) break; continue; }
    if (out.length && (/^\s*[-*]\s/.test(l) || /^\s*[A-Z0-9]\s{2,}\S/.test(l) || /^\s*\d+\.\s/.test(l))) break;
    out.push(l.trim());
  }
  return out.join(' ').replace(/:$/, '.');      // a paragraph that leads into a usage line ends with a colon
}

// What the header's usage line says a set of arguments does (`node verify/x.js --self-test   proves ...`), with
// the lines that continue it, or null when no usage line names exactly these arguments.
function usageFor(lines, script, args) {
  const want = args.join(' ');
  const base = path.basename(script);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!USAGE.test(l)) continue;
    const at = l.indexOf(base);
    if (at < 0) continue;
    const after = l.slice(at + base.length);
    const m = /^((?:\s+-[-\w]+(?:\s+<[^>]+>)?)*)(\s{2,}(.*))?$/.exec(after);
    if (!m || m[1].trim() !== want || !m[3]) continue;
    const indent = l.length - l.trimStart().length;
    const text = [m[3].trim()];
    const col = l.indexOf(m[3]);
    for (let j = i + 1; j < lines.length; j++) {
      const n = lines[j];
      if (!n.trim() || USAGE.test(n)) break;
      const lead = n.length - n.trimStart().length;
      if (lead <= indent || lead < col - 2) break;
      text.push(n.trim());
    }
    return text.join(' ');
  }
  return null;
}

function wrap(text, width, indent) {
  const out = [];
  let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + w.length > width) { out.push(indent + line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(indent + line);
  return out.join('\n');
}

function printList(steps, total) {
  const counted = { static: 0, browser: 0 };
  for (const s of steps) counted[s.tier]++;
  const which = steps.length === total ? `${total} steps` : `${steps.length} of its ${total} steps`;
  console.log(`The chain of \`npm run check\` (the check script of tools/package.json), read by check.js: ${which}, ${counted.static} static and ${counted.browser} browser.`);
  console.log('The static steps run first, one after the other; then the browser steps run side by side against the runner\'s own server.\n');
  const described = new Set();
  for (const s of steps) {
    const extra = [];
    if (s.from) extra.push(`from npm run ${s.from}`);
    if (s.tier === 'browser') extra.push(s.reason);
    if (s.sweeps) extra.push(`started as ${s.sweeps} jobs, --sweep 1 to ${s.sweeps}`);
    console.log(`${s.tier.padEnd(8)} ${s.cmd}${extra.length ? `   (${extra.join('; ')})` : ''}`);
    const lines = headerLines(s.script);
    const own = s.args.slice(s.args.findIndex((x) => !x.startsWith('-')) + 1);
    const usage = own.length ? usageFor(lines, s.script, own) : null;
    let text = described.has(s.script) ? '' : firstParagraph(lines);
    if (usage) text += `${text ? ' ' : ''}With ${own.join(' ')}: ${usage.replace(/[.,;:]?$/, '.')}`;
    if (!text) text = described.has(s.script) ? '(the same script as above)' : '(its script has no comment block at the top)';
    described.add(s.script);
    console.log(wrap(text, 110, '         ') + '\n');
  }
}

// --- --since ---------------------------------------------------------------------------------------------------

// Which inputs of the hero changed between rev and the working tree: { ok, changed: [...], why }.
function heroChanges(rev) {
  const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  const v = git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]);
  if (v.status !== 0) return { ok: false, why: `git cannot resolve ${rev} here (a shallow clone stops at its depth)` };
  const d = git(['diff', '--name-only', '--no-renames', v.stdout.trim(), '--']);
  const u = git(['ls-files', '--others', '--exclude-standard']);
  if (d.status !== 0 || u.status !== 0) return { ok: false, why: `git diff against ${rev} failed: ${(d.stderr || u.stderr || '').trim()}` };
  const files = (d.stdout + u.stdout).split('\n').map((f) => f.trim()).filter(Boolean);
  const hit = (f) => HERO_INPUTS.some((p) => (p.endsWith('/') ? f.startsWith(p) : p.endsWith('*') ? f.startsWith(p.slice(0, -1)) : f === p));
  return { ok: true, changed: [...new Set(files.filter(hit))].sort() };
}

// --- The server ------------------------------------------------------------------------------------------------

function startServer() {
  const server = http.createServer((req, res) => {
    const fail = (code, msg) => {
      res.writeHead(code, { 'Content-Type': 'text/html;charset=utf-8', 'Content-Length': Buffer.byteLength(msg) });
      res.end(req.method === 'HEAD' ? undefined : msg);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(501, 'Unsupported method');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { return fail(400, 'Bad request'); }
    if (pathname.includes('\0')) return fail(400, 'Bad request');
    let file = path.join(ROOT, path.normalize(pathname));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return fail(404, 'File not found');
    fs.stat(file, (err, st) => {
      if (!err && st.isDirectory()) {
        if (!pathname.endsWith('/')) {
          const u = new URL(req.url, 'http://localhost');
          res.writeHead(301, { Location: u.pathname + '/' + u.search, 'Content-Length': 0 });
          return res.end();
        }
        file = path.join(file, 'index.html');
        try { st = fs.statSync(file); } catch (e) { return fail(404, 'File not found'); }
        if (!st.isFile()) return fail(404, 'File not found');
      } else if (err || !st.isFile() || pathname.endsWith('/')) return fail(404, 'File not found');
      const mtime = Math.floor(st.mtimeMs / 1000) * 1000;
      const ims = req.headers['if-modified-since'];
      if (ims && !req.headers['if-none-match']) {
        const t = Date.parse(ims);
        if (!Number.isNaN(t) && mtime <= t) { res.writeHead(304); return res.end(); }
      }
      fs.readFile(file, (e2, body) => {
        if (e2) return fail(404, 'File not found');
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Content-Length': body.length,
          'Last-Modified': new Date(mtime).toUTCString(),
        });
        res.end(req.method === 'HEAD' ? undefined : body);
      });
    });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// --- Running ---------------------------------------------------------------------------------------------------

const running = new Set();       // the children still running, each the leader of its own process group
let interrupted = null;          // the signal that stopped the run, once one has: no job starts after it

function killAll(signal) {
  for (const child of running) {
    try { process.kill(-child.pid, signal); } catch (e) { try { child.kill(signal); } catch (e2) { /* already gone */ } }
  }
}

function fmtTime(ms) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
}

// Runs one job as a child process in its own process group, so that stopping it also stops the browsers it started.
function runJob(job, env, logDir) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const chunks = [];
    let child;
    const done = (status, signal, error) => {
      if (child) running.delete(child);
      const out = Buffer.concat(chunks).toString('utf8');
      job.ms = Date.now() - t0;
      job.output = error ? `${out}${out && !out.endsWith('\n') ? '\n' : ''}check.js: ${error}\n` : out;
      job.ok = !error && status === 0 && !signal && !interrupted;
      job.exit = interrupted ? `stopped by check.js on ${interrupted}` : error ? 'could not start' : signal ? `killed by ${signal}` : `exit ${status}`;
      job.log = path.join(logDir, job.cmd.replace(/^node\s+|^python3?\s+/, '').replace(/[^\w.-]+/g, '_') + '.log');
      try { fs.writeFileSync(job.log, job.output); } catch (e) { job.log = null; }
      console.log(`${job.ok ? 'ok  ' : 'FAIL'} ${fmtTime(job.ms).padStart(8)}  ${job.cmd}${job.ok ? '' : `  (${job.exit})`}`);
      resolve(job);
    };
    try {
      child = spawn(spawnTarget(job), job.args, { cwd: TOOLS, env: Object.assign({}, env, job.env), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    } catch (e) { return done(null, null, e.message); }
    running.add(child);
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => chunks.push(d));
    let settled = false;
    child.on('error', (e) => { if (!settled) { settled = true; done(null, null, e.message); } });
    child.on('close', (status, signal) => { if (!settled) { settled = true; done(status, signal, null); } });
  });
}

async function runPool(jobs, n, env, logDir) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => {
    while (next < jobs.length && !interrupted) await runJob(jobs[next++], env, logDir);
  }));
}

function failureReport(job) {
  const lines = job.output.replace(/\s+$/, '').split('\n');
  const tail = lines.slice(-TAIL);
  const earlier = lines.slice(0, Math.max(0, lines.length - TAIL)).filter((l) => /\bFAIL/.test(l));
  const out = [`FAIL ${job.cmd} (${job.exit}, ${fmtTime(job.ms)})${job.log ? `; the whole output is in ${job.log}` : ''}`];
  if (earlier.length) {
    out.push(`  the lines above the tail that say FAIL (${earlier.length}${earlier.length > FAIL_LINES ? `, the first ${FAIL_LINES}` : ''}):`);
    for (const l of earlier.slice(0, FAIL_LINES)) out.push('  | ' + l);
    out.push(`  the last ${tail.length} lines:`);
  }
  for (const l of tail) out.push('  | ' + l);
  return out.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(headerLines(SELF).slice(0, 10).join('\n'));
    return 0;
  }
  const t0 = Date.now();
  let steps = readChain();
  const total = steps.length;
  for (const s of steps) {
    s.reason = s.program === 'node' ? browserReason(s.script) : null;
    s.tier = s.reason ? 'browser' : 'static';
    s.names = namesOf(s);
  }
  if (opts.only) {
    // A name may also be one sweep job as the summary prints it (bg-fit.js --sweep 4): that step, that sweep alone.
    const sweepOf = (n) => /^(.+?)\s+--sweep\s+(\d+)$/.exec(n);
    const matches = (s, n) => s.names.has(n) || (sweepOf(n) !== null && s.names.has(sweepOf(n)[1]) && declaresSweeps(s.script));
    const unknown = opts.only.filter((n) => !steps.some((s) => matches(s, n)));
    if (unknown.length) {
      const known = [...new Set(steps.map((s) => path.basename(s.args.find((x) => !x.startsWith('-')) || s.program).replace(/\.[^.]+$/, '')))];
      usageError(`--only names no step of the chain: ${unknown.join(', ')} (the steps: ${known.join(', ')})`);
    }
    steps = steps.filter((s) => opts.only.some((n) => matches(s, n)));
    for (const s of steps) {
      if (opts.only.some((n) => s.names.has(n))) continue;          // named whole: every sweep
      s.onlySweeps = opts.only.filter((n) => sweepOf(n) && s.names.has(sweepOf(n)[1])).map((n) => Number(sweepOf(n)[2]));
    }
  }
  if (opts.static) steps = steps.filter((s) => s.tier === 'static');
  for (const s of steps) if (s.tier === 'browser' && declaresSweeps(s.script)) s.sweeps = sweepCount(s);
  for (const s of steps) {
    if (!s.onlySweeps) continue;
    const bad = s.onlySweeps.filter((k) => !s.sweeps || k < 1 || k > s.sweeps);
    if (bad.length) usageError(`${s.cmd} has ${s.sweeps ? `sweeps 1 to ${s.sweeps}` : 'no sweeps it can name'}, not --sweep ${bad.join(', ')}`);
  }

  if (opts.list) { printList(steps, total); return 0; }

  // --since: the hero guards are skipped only when it is certain that nothing they read has changed.
  const skipped = [];
  if (opts.since && steps.some(isHeroGuard)) {
    const h = heroChanges(opts.since);
    if (!h.ok) console.log(`--since ${opts.since}: ${h.why}, so the hero guards run.`);
    else if (h.changed.length) console.log(`--since ${opts.since}: the hero guards run, because ${h.changed.length === 1 ? 'an input of the hero changed' : `${h.changed.length} inputs of the hero changed`}: ${h.changed.join(', ')}.`);
    else {
      const reason = `no input of the hero changed since ${opts.since}`;
      console.log(`--since ${opts.since}: ${reason} (${HERO_INPUTS.join(', ')}), so ${HERO_GUARDS.join(' and ')} are skipped.`);
      for (const s of steps.filter(isHeroGuard)) skipped.push(Object.assign(s, { skipReason: reason }));
      steps = steps.filter((s) => !isHeroGuard(s));
    }
  }

  // The jobs: a script with sweeps becomes one job per sweep; the hero guards go to the front of the browser queue.
  const toJobs = (s) => (s.sweeps
    ? Array.from({ length: s.sweeps }, (_, k) => k + 1).filter((k) => !s.onlySweeps || s.onlySweeps.includes(k))
      .map((k) => Object.assign({}, s, { cmd: `${s.cmd} --sweep ${k}`, args: s.args.concat('--sweep', String(k)), sweep: k }))
    : [Object.assign({}, s, { sweep: 0 })]);
  const staticJobs = steps.filter((s) => s.tier === 'static').flatMap(toJobs);
  const browserSteps = steps.filter((s) => s.tier === 'browser');
  const browserJobs = browserSteps.filter(isHeroGuard).concat(browserSteps.filter((s) => !isHeroGuard(s))).flatMap(toJobs);
  const cpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const jobs = opts.jobs || Math.max(1, Math.min(4, cpus));
  for (const s of steps) if (s.tier === 'browser' && declaresSweeps(s.script) && !s.sweeps) console.log(`note ${s.cmd} declares --sweeps but did not say how many, so it runs as one job`);

  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vynatix-check-'));
  const env = Object.assign({}, process.env);
  let server = null;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const tiers = [];
  if (staticJobs.length) tiers.push(`${plural(staticJobs.length, 'static step', 'static steps')} in series`);
  if (browserJobs.length) tiers.push(`${plural(browserJobs.length, 'browser job', 'browser jobs')}, at most ${jobs} at a time`);
  console.log(`check.js: ${tiers.join(', then ') || 'nothing to run'}. Logs: ${logDir}`);
  for (const j of staticJobs) if (!interrupted) await runJob(j, env, logDir);
  if (browserJobs.length) {
    server = await startServer();
    env.BASE = `http://127.0.0.1:${server.address().port}/`;
    console.log(`serving ${ROOT} at ${env.BASE}`);
    await runPool(browserJobs, jobs, env, logDir);
    server.close();
  }

  // The summary is in the order of the chain, whatever order the jobs ran in.
  const all = staticJobs.concat(browserJobs).sort((a, b) => a.index - b.index || a.sweep - b.sweep);
  const ran = all.filter((j) => j.ms !== undefined);
  const failed = ran.filter((j) => !j.ok);
  const notRun = all.filter((j) => j.ms === undefined);
  const wall = Date.now() - t0;
  const work = ran.reduce((a, j) => a + j.ms, 0);
  console.log('');
  for (const j of failed) console.log((interrupted ? `FAIL ${j.cmd} (${j.exit}); its output is in ${j.log}` : failureReport(j)) + '\n');
  console.log('Summary');
  for (const j of ran) console.log(`  ${j.ok ? 'ok  ' : 'FAIL'} ${fmtTime(j.ms).padStart(8)}  ${j.tier.padEnd(8)} ${j.cmd}`);
  for (const j of notRun) console.log(`  not run${''.padStart(5)}  ${j.tier.padEnd(8)} ${j.cmd}   (stopped on ${interrupted})`);
  for (const s of skipped) console.log(`  skip ${''.padStart(8)}  ${s.tier.padEnd(8)} ${s.cmd}   (${s.skipReason})`);
  const counts = [`${ran.length - failed.length} passed`, `${failed.length} failed`];
  if (notRun.length) counts.push(`${notRun.length} not run`);
  if (skipped.length) counts.push(`${skipped.length} skipped`);
  console.log(`${interrupted ? `Stopped on ${interrupted}: ` : ''}${counts.join(', ')}; wall time ${fmtTime(wall)}, the jobs' own times add up to ${fmtTime(work)}.`);
  return interrupted ? 130 : failed.length ? 1 : 0;
}

module.exports = { readChain, browserReason, firstParagraph, headerLines, usageFor, heroChanges, startServer, HERO_INPUTS, TYPES };

if (require.main === module) {
  // A first Ctrl-C (or SIGTERM, SIGHUP) stops every running check with its browsers and starts no other, then prints
  // the summary of what ran; a check that has not stopped five seconds later, or a second signal, gets SIGKILL.
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
      if (interrupted) return killAll('SIGKILL');
      interrupted = sig;
      console.log(`check.js: ${sig}, stopping every running check`);
      killAll('SIGTERM');
      setTimeout(() => killAll('SIGKILL'), 5000).unref();
    });
  }
  process.on('exit', () => killAll('SIGKILL'));
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(e); killAll('SIGTERM'); process.exit(2); });
}
