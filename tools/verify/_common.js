// Shared config for the verification scripts.
const fs = require('fs');

const PAGES = [
  'index.html', 'about.html', 'services.html',
  'work.html', 'membership.html', 'contact.html',
  'privacy.html', 'terms.html', 'accessibility.html',
  // English deep pages and the list page (each has a Swedish twin below)
  'android-automotive-development.html', 'ai-engineering.html',
  'android-automotive-consultancies-gothenburg.html',
  // Swedish pages: the hub, the twins and the guides
  'sv.html', 'android-automotive-utveckling.html', 'ai-utveckling.html',
  'konsultbolag-android-automotive-goteborg.html', 'valja-konsultbolag.html',
  'platform-engineering.html', 'ai-assistent-interna-dokument.html',
  'ai-konsultbolag-sverige.html',
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

// The home hero carries one of four decorative backgrounds, drawn at random per visit
// (sessionStorage "vynatix-bg", set as data-bg on <html> by app.js). BGS picks the ones the
// home-page checks run in, the way THEMES picks themes. Unlike THEMES the default is all four:
// every one of them ships, and the setting only multiplies loads of the home page (never the
// other nineteen), so the whole suite grows by a handful of page loads. BGS=sheet narrows a
// run to the background the page shows without script; set BGS=weave,sheet,dial,iris with
// THEMES=light,dark,teal-light,teal-dark,mono-light,mono-dark for the full sweep.
const ALL_BGS = ['weave', 'sheet', 'dial', 'iris'];
const BGS = (process.env.BGS || ALL_BGS.join(',')).split(',').map((b) => b.trim()).filter(Boolean);
for (const b of BGS) {
  if (!ALL_BGS.includes(b)) { console.error(`Unknown background "${b}" (expected one of ${ALL_BGS.join(', ')})`); process.exit(2); }
}
// Where a script loops over BGS, only the home page takes part: the backgrounds are scoped to
// the English home hero and every other page is identical in all four draws.
const bgsFor = (page) => (page === 'index.html' || page === 'index' ? BGS : [undefined]);

// The site draws one of three colour schemes at random per visit (sessionStorage
// "vynatix-look") and takes light or dark from the visitor's choice (localStorage
// "vynatix-theme"); it also draws one of four hero backgrounds (sessionStorage "vynatix-bg").
// A check that needs a particular look has to set them before the page loads: pass this to
// page.addInitScript(pinTheme, arg), where arg is a theme id or { theme, bg, seed }. The draw is
// ALWAYS pinned: without a bg it is "sheet" (what the page shows without script), so a caller
// that forgets still gets the same page every run. A pinned weave also gets a fixed seed (7,
// "vynatix-bg-seed"), so its cloth is the same every run; pass seed to choose another. It is
// serialised into the page, so it must stay self-contained: the defaults are written here, not
// read from the constants above.
function pinTheme(arg) {
  try {
    var theme = typeof arg === 'string' ? arg : arg.theme;
    var bg = (arg && arg.bg) || 'sheet';
    var seed = arg && arg.seed != null ? arg.seed : (bg === 'weave' ? 7 : null);
    var m = /^(teal|mono)-/.exec(theme);
    localStorage.setItem('vynatix-theme', theme);
    sessionStorage.setItem('vynatix-look', m ? m[1] : 'forest');
    sessionStorage.setItem('vynatix-bg', bg);
    if (seed != null) sessionStorage.setItem('vynatix-bg-seed', String(seed));
  } catch (e) { /* storage blocked: the page falls back to Forest and the sheet */ }
}

// For the checks that must not pin a theme (the colour draw is what they test) or that set
// their own storage: pins the hero background only, the way pinTheme does. Pass the id, or
// nothing for "sheet": page.addInitScript(pinBg, 'weave').
function pinBg(bg) {
  try {
    sessionStorage.setItem('vynatix-bg', bg || 'sheet');
    if (bg === 'weave') sessionStorage.setItem('vynatix-bg-seed', '7');
  } catch (e) { /* storage blocked: the page falls back to the sheet */ }
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

module.exports = { PAGES, BASE, THEMES, ALL_THEMES, BGS, ALL_BGS, bgsFor, pinTheme, pinBg, launch, chromePath };
