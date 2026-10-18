// Tell Bing (and the other IndexNow engines) which pages changed, so Microsoft Copilot and
// the Bing side of ChatGPT search pick up new and edited pages within hours, not weeks.
//
//   node indexnow.js                 submit every URL in ../sitemap.xml
//   node indexnow.js sv.html work.html   submit only these pages
//
// Run it AFTER the change is live on vynatix.com: the engines fetch the key file
// (https://vynatix.com/<key>.txt, at the site root) to prove the request comes from the
// site owner, so a ping before deploy fails with 403. Not part of the site build and never
// run at deploy time; tools/ is excluded from the published output.
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const HOST = 'vynatix.com';
const keyFile = fs.readdirSync(ROOT).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error('No IndexNow key file (32 hex characters + .txt) at the repo root.'); process.exit(2); }
const key = fs.readFileSync(path.join(ROOT, keyFile), 'utf8').trim();

const args = process.argv.slice(2);
const urlList = args.length
  ? args.map((p) => (p === 'index.html' ? `https://${HOST}/` : `https://${HOST}/${p}`))
  : [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const body = JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList });
const req = https.request('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) },
}, (res) => {
  // 200 accepted, 202 accepted (key validation pending), 403 key not found on the site,
  // 422 a URL does not belong to the host, 429 too many requests.
  console.log(`IndexNow: HTTP ${res.statusCode} for ${urlList.length} URL(s)`);
  process.exit(res.statusCode === 200 || res.statusCode === 202 ? 0 : 1);
});
req.on('error', (e) => { console.error('IndexNow request failed:', e.message); process.exit(1); });
req.end(body);
