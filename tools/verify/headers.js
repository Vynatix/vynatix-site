// Asserts the security response headers described in EDGE-SETUP.md are present
// and correct. Run against the live origin once the edge is in place:
//   BASE=https://vynatix.com/ node verify/headers.js
// Against a plain GitHub Pages origin (or the local server) every header-only
// control is expected to be MISSING — that is the gap the edge closes.
const { BASE, launch } = require('./_common');

const EXPECTED = {
  'strict-transport-security':   /max-age=\d{7,}/,
  'x-content-type-options':      /^nosniff$/i,
  'x-frame-options':             /^(DENY|SAMEORIGIN)$/i,
  'referrer-policy':             /strict-origin-when-cross-origin/i,
  'permissions-policy':          /camera=\(\)/i,
  'cross-origin-opener-policy':  /same-origin/i,
  'cross-origin-resource-policy':/same-origin/i,
  'content-security-policy':     /frame-ancestors 'none'/i,
};

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  const resp = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const headers = resp.headers();

  let missing = 0;
  for (const [name, pattern] of Object.entries(EXPECTED)) {
    const got = headers[name];
    if (!got) { missing++; console.log(`MISSING  ${name}`); continue; }
    if (!pattern.test(got)) { missing++; console.log(`WRONG    ${name}: ${got}`); continue; }
    console.log(`ok       ${name}: ${got.length > 90 ? got.slice(0, 90) + '…' : got}`);
  }

  // The meta CSP must survive alongside the header one (defence in depth).
  const meta = await page.evaluate(() => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
    return m ? m.getAttribute('content') : null;
  });
  console.log(meta ? 'ok       meta CSP still present as fallback'
                   : 'MISSING  meta CSP fallback');
  if (!meta) missing++;

  console.log(missing === 0
    ? `\nPASS — all ${Object.keys(EXPECTED).length} headers present at ${BASE}`
    : `\nFAIL — ${missing} header(s) missing or wrong at ${BASE}`);
  await browser.close();
  process.exit(missing === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
