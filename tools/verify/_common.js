// Shared config for the verification scripts.
const fs = require('fs');

const PAGES = [
  'index.html', 'about.html', 'services.html',
  'work.html', 'membership.html', 'contact.html',
  'privacy.html', 'terms.html', 'accessibility.html',
];

const BASE = process.env.BASE || 'http://localhost:8000/';

// The design system's six theme ids. The checks run on the Forest pair by
// default; set THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark to
// sweep every theme the role tokens have to hold in.
const ALL_THEMES = ['light', 'dark', 'teal-light', 'teal-dark', 'mono-light', 'mono-dark'];
const THEMES = (process.env.THEMES || 'light,dark').split(',').map((t) => t.trim()).filter(Boolean);
for (const t of THEMES) {
  if (!ALL_THEMES.includes(t)) { console.error(`Unknown theme "${t}" (expected one of ${ALL_THEMES.join(', ')})`); process.exit(2); }
}

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

module.exports = { PAGES, BASE, THEMES, ALL_THEMES, launch, chromePath };
