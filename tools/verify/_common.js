// Shared config for the verification scripts.
const fs = require('fs');

const PAGES = [
  'index.html', 'about.html', 'services.html',
  'work.html', 'membership.html', 'contact.html',
  'privacy.html', 'terms.html', 'accessibility.html',
];

const BASE = process.env.BASE || 'http://localhost:8000/';

// Chromium lives in a versioned directory; find it rather than pinning a version.
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const root = '/opt/pw-browsers';
  try {
    const dir = fs.readdirSync(root)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort()
      .pop();
    if (dir) return `${root}/${dir}/chrome-linux/chrome`;
  } catch (e) { /* fall through to Playwright's own resolution */ }
  return undefined;
}

async function launch() {
  const { chromium } = require('playwright');
  const executablePath = chromePath();
  return chromium.launch(executablePath ? { executablePath } : {});
}

module.exports = { PAGES, BASE, launch, chromePath };
