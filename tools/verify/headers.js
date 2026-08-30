// Asserts the security response headers described in EDGE-SETUP.md are present
// and correct. Run against the live origin once the edge is in place:
//   BASE=https://vynatix.com/ node verify/headers.js
// Against a plain GitHub Pages origin (or the local server) every header-only
// control is expected to be MISSING — that is the gap the edge closes.
const { BASE, launch } = require('./_common');

// These are the literal values EDGE-SETUP.md tells you to set. Keep the two in
// sync: if the runbook changes, this must change with it.
const EXPECTED = {
  'strict-transport-security':   /^max-age=31536000; includeSubDomains/,
  'x-content-type-options':      /^nosniff$/i,
  'x-frame-options':             /^DENY$/i,
  'referrer-policy':             /^strict-origin-when-cross-origin$/i,
  'cross-origin-opener-policy':  /^same-origin$/i,
  'cross-origin-resource-policy':/^same-origin$/i,
};

// Every feature the runbook's Permissions-Policy denies.
const PERMISSIONS = ['accelerometer', 'camera', 'geolocation', 'gyroscope',
  'magnetometer', 'microphone', 'payment', 'usb'];

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

  // Permissions-Policy: check every denied feature the runbook lists.
  const pp = headers['permissions-policy'];
  if (!pp) { missing++; console.log('MISSING  permissions-policy'); }
  else {
    const absent = PERMISSIONS.filter((f) => !new RegExp(f + '\\s*=\\s*\\(\\)').test(pp));
    if (absent.length) { missing++; console.log(`WRONG    permissions-policy: not denied -> ${absent.join(', ')}`); }
    else console.log(`ok       permissions-policy: all ${PERMISSIONS.length} features denied`);
  }

  // The meta CSP must survive alongside the header one (defence in depth), and
  // the two must stay in sync: the header is the meta plus frame-ancestors.
  const meta = await page.evaluate(() => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
    return m ? m.getAttribute('content') : null;
  });
  const headerCsp = headers['content-security-policy'];
  if (!meta) { missing++; console.log('MISSING  meta CSP fallback'); }
  else if (!headerCsp) { missing++; console.log('MISSING  content-security-policy header'); }
  else {
    const norm = (c) => c.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean).sort();
    const metaSet = norm(meta);
    const headerSet = norm(headerCsp);
    const onlyHeader = headerSet.filter((d) => !metaSet.includes(d));
    const onlyMeta = metaSet.filter((d) => !headerSet.includes(d));
    const synced = onlyMeta.length === 0
      && onlyHeader.length === 1
      && /^frame-ancestors 'none'$/.test(onlyHeader[0]);
    if (synced) {
      console.log("ok       CSP header == meta + frame-ancestors 'none'");
    } else {
      missing++;
      console.log('WRONG    CSP header/meta out of sync');
      if (onlyHeader.length) console.log(`           header-only: ${onlyHeader.join(' | ')}`);
      if (onlyMeta.length) console.log(`           meta-only:   ${onlyMeta.join(' | ')}`);
    }
  }

  console.log(missing === 0
    ? `\nPASS — every header in EDGE-SETUP.md is present and correct at ${BASE}`
    : `\nFAIL — ${missing} check(s) missing or wrong at ${BASE}`);
  await browser.close();
  process.exit(missing === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
