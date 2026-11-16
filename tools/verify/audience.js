// The audience switch on the English home page ("Hire a team" / "Join the team"). Needs the site served
// (python3 -m http.server 8000) and a browser; in `npm run check`.
//   node verify/audience.js
//
// The switch is two plain links and CSS :target (styles.css, "Audience switch"): #join shows the joiner
// view, any other address the client view, nothing is stored, and app.js only mirrors the state into
// aria-current. What this proves:
//  1. Each view shows exactly its own sections: the default address shows every .view-hire section and no
//     .view-join one, #join the reverse, and every top-level section of main has exactly one of the two
//     classes. The same with JavaScript off, because the switch must not depend on the script.
//  2. The switch moves both ways without a reload, and Back undoes it.
//  3. aria-current follows the view (JavaScript on).
//  4. The joiner view's skip link keeps the view (the normal one points at #main and would drop :target), and
//     the normal one is first on the plain address.
//  5. Every same-page link on the home page is #main, #hire or #join. :target holds one fragment at a time, so
//     any other in-page link (a #faq deep link, say) would silently reset the view; add it here deliberately.
//  6. The joiner view says nothing new: every block marked data-from="membership.html" is found word for word
//     in that page's main, and every link in the joiner view goes to contact, membership or work.
//  7. The switch and its classes exist on index.html only (the Swedish home and every other page have none).
//  8. A visitor who lands on #join and then switches (no reload) sees the same hero, in each of the four
//     backgrounds, as one who loaded the page directly, with no console error; and #join logs no warning (an
//     unused font preload, say) in any of the three looks.
const { PAGES, BASE, readPage, launch, pinTheme } = require('./_common');
const { PNG } = require('pngjs');

let problems = 0;
const ok = (cond, msg, detail) => {
  if (cond) console.log(`ok   ${msg}`);
  else { problems++; console.log(`FAIL ${msg}${detail ? ' - ' + detail : ''}`); }
};

const SAME_PAGE = new Set(['#main', '#hire', '#join']);
const JOIN_TARGETS = new Set(['contact.html', 'membership.html', 'work.html']);
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

// What each view shows, read from the rendered page.
const state = () => {
  const shown = (el) => getComputedStyle(el).display !== 'none';
  const secs = [...document.querySelectorAll('main > section')];
  const hire = secs.filter((s) => s.classList.contains('view-hire'));
  const join = secs.filter((s) => s.classList.contains('view-join'));
  return {
    total: secs.length,
    untagged: secs.filter((s) => s.classList.contains('view-hire') === s.classList.contains('view-join')).length,
    hire: hire.length, hireShown: hire.filter(shown).length,
    join: join.length, joinShown: join.filter(shown).length,
    hash: location.hash,
    current: [...document.querySelectorAll('.audience__link')].map((a) => a.getAttribute('aria-current')),
  };
};
const isHire = (s) => s.hire > 0 && s.hireShown === s.hire && s.joinShown === 0;
const isJoin = (s) => s.join > 0 && s.joinShown === s.join && s.hireShown === 0;
const brief = (s) => `hire ${s.hireShown}/${s.hire}, join ${s.joinShown}/${s.join}, hash "${s.hash}"`;

(async () => {
  // ---- 7. Index only (static) ---------------------------------------------------------------------------------
  {
    const strays = PAGES.filter((p) => p !== 'index.html' && /audience__|view-join|view-hire|view-anchor/.test(readPage(p)));
    ok(strays.length === 0, 'the audience switch and its view classes are on index.html only', strays.join(', '));
    const home = readPage('index.html');
    ok(/class="audience__link audience__link--hire" href="#hire">Hire a team</.test(home) && /class="audience__link audience__link--join" href="#join">Join the team</.test(home),
      'index.html carries the two links, "Hire a team" and "Join the team"');
  }

  const browser = await launch();
  const pin = (theme, bg) => ({ theme, bg });

  // ---- 1 to 5. The two views, with and without JavaScript ------------------------------------------------------
  for (const js of [true, false]) {
    const tag = js ? 'JavaScript on' : 'JavaScript off';
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: js });
    const page = await ctx.newPage();
    if (js) await page.addInitScript(pinTheme, pin('light', 'sheet'));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    let s = await page.evaluate(state);
    ok(s.total > 0 && s.untagged === 0, `${tag}: every top-level section of main has exactly one view class`, `${s.untagged} of ${s.total} do not`);
    ok(isHire(s), `${tag}: the plain address shows the client view and none of the joiner view`, brief(s));

    await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    s = await page.evaluate(state);
    ok(isJoin(s), `${tag}: #join shows the joiner view and none of the client view`, brief(s));

    // Switch both ways by clicking, then Back.
    await page.click('.audience__link--hire');
    s = await page.evaluate(state);
    ok(isHire(s) && s.hash === '#hire', `${tag}: "Hire a team" switches back without a reload`, brief(s));
    await page.goBack();
    s = await page.evaluate(state);
    ok(isJoin(s), `${tag}: Back returns to the joiner view`, brief(s));

    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.click('.audience__link--join');
    s = await page.evaluate(state);
    ok(isJoin(s) && s.hash === '#join', `${tag}: "Join the team" switches without a reload`, brief(s));
    await page.goBack();
    s = await page.evaluate(state);
    ok(isHire(s), `${tag}: Back from the joiner view returns to the client view`, brief(s));

    // The skip links.
    await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    const skips = await page.evaluate(() => [...document.querySelectorAll('.skip-link')].map((a) => ({
      href: a.getAttribute('href'), shown: getComputedStyle(a).display !== 'none' })));
    const wantSkip = js ? (skips.length === 2 && skips[0].href === '#main' && !skips[0].shown && skips[1].href === '#join' && skips[1].shown) : true;
    if (js) {
      ok(wantSkip, `${tag}: in the joiner view only the skip link that keeps the view is shown`, JSON.stringify(skips));
      await page.focus('.skip-link--join');
      await page.keyboard.press('Enter');
      s = await page.evaluate(state);
      ok(isJoin(s), `${tag}: following the joiner view's skip link keeps the joiner view`, brief(s));
      await page.goto(BASE + 'index.html', { waitUntil: 'load' });
      const first = await page.evaluate(() => [...document.querySelectorAll('.skip-link')].filter((a) => getComputedStyle(a).display !== 'none').map((a) => a.getAttribute('href')));
      ok(first.length === 1 && first[0] === '#main', 'JavaScript on: on the plain address the only skip link shown is the one to #main', first.join(','));
    }

    // aria-current mirrors the view (script only).
    if (js) {
      await page.goto(BASE + 'index.html', { waitUntil: 'load' });
      let cur = await page.evaluate(() => [...document.querySelectorAll('.audience__link')].map((a) => a.getAttribute('aria-current')));
      ok(cur[0] === 'true' && cur[1] === null, 'aria-current marks "Hire a team" on the plain address', JSON.stringify(cur));
      await page.click('.audience__link--join');
      await page.waitForFunction(() => document.querySelector('.audience__link--join').getAttribute('aria-current') === 'true', null, { timeout: 2000 }).catch(() => {});
      cur = await page.evaluate(() => [...document.querySelectorAll('.audience__link')].map((a) => a.getAttribute('aria-current')));
      ok(cur[0] === null && cur[1] === 'true', 'aria-current follows a click to "Join the team"', JSON.stringify(cur));
      await page.goBack();
      await page.waitForFunction(() => document.querySelector('.audience__link--hire').getAttribute('aria-current') === 'true', null, { timeout: 2000 }).catch(() => {});
      cur = await page.evaluate(() => [...document.querySelectorAll('.audience__link')].map((a) => a.getAttribute('aria-current')));
      ok(cur[0] === 'true' && cur[1] === null, 'aria-current follows Back', JSON.stringify(cur));
    }
    ok(errors.length === 0, `${tag}: no script errors`, errors.join(' | '));
    await ctx.close();
  }

  // ---- 5 and 6. Same-page links, and the joiner view's words and links --------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')));
    const stray = hrefs.filter((h) => !SAME_PAGE.has(h));
    ok(stray.length === 0, 'every same-page link on the home page is #main, #hire or #join (a view lives in one fragment)', stray.join(', '));

    const blocks = await page.evaluate(() => [...document.querySelectorAll('[data-from]')].map((el) => ({
      from: el.getAttribute('data-from'),
      parts: ['P', 'H2', 'H3', 'LI'].includes(el.tagName) ? [el.textContent] : [...el.querySelectorAll('h2, h3, p, li')].map((n) => n.textContent),
    })));
    const bad = [];
    let parts = 0;
    const main = {};
    for (const b of blocks) {
      if (!main[b.from]) {
        await page.goto(BASE + b.from, { waitUntil: 'load' });
        main[b.from] = norm(await page.evaluate(() => document.querySelector('main').textContent));
      }
      for (const t of b.parts) { parts++; if (!main[b.from].includes(norm(t))) bad.push(norm(t).slice(0, 70)); }
    }
    ok(blocks.length >= 4 && parts >= 20, 'the joiner view marks its lifted blocks (data-from)', `${blocks.length} blocks, ${parts} parts`);
    ok(bad.length === 0, 'every lifted sentence is word for word on membership.html', bad.join(' | '));

    await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    const targets = await page.evaluate(() => [...document.querySelectorAll('.view-join a[href]')].map((a) => a.getAttribute('href')));
    const wrong = targets.filter((h) => !JOIN_TARGETS.has(h));
    ok(targets.length > 0 && wrong.length === 0, 'every link in the joiner view goes to contact, membership or work', wrong.join(', '));
    await ctx.close();
  }

  // ---- 8a. Switching without a reload leaves the hero as a direct load draws it ---------------------------------
  const BGS = (process.env.BGS || 'weave,sheet,dial,iris').split(',');
  const heroShot = async (page) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
    return PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 96, width: 1440, height: 804 }, animations: 'disabled' }));
  };
  for (const bg of BGS) {
    const shoot = async (url, click) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(pinTheme, pin('light', bg));
      await page.goto(BASE + url, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      if (click) await page.click('.audience__link--hire');
      const png = await heroShot(page);
      await ctx.close();
      return { png, errors };
    };
    const direct = await shoot('index.html', false);
    const switched = await shoot('index.html#join', true);
    let n = 0;
    if (direct.png.width !== switched.png.width || direct.png.height !== switched.png.height) n = -1;
    else for (let i = 0; i < direct.png.data.length; i += 4) {
      if (direct.png.data[i] !== switched.png.data[i] || direct.png.data[i + 1] !== switched.png.data[i + 1] || direct.png.data[i + 2] !== switched.png.data[i + 2]) n++;
    }
    ok(n === 0, `${bg}: landing on #join and switching to "Hire a team" draws the hero exactly as a direct load does`, n < 0 ? 'sizes differ' : `${n} differing pixels`);
    ok(direct.errors.length + switched.errors.length === 0, `${bg}: no script errors on either path`, [...direct.errors, ...switched.errors].join(' | '));
  }

  // ---- 8b. #join logs nothing in any of the three looks (an unused font preload warns a few seconds after load) -----
  for (const theme of ['light', 'teal-light', 'mono-light']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 120)}`); });
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
    await page.addInitScript(pinTheme, pin(theme, 'sheet'));
    await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    await page.waitForTimeout(4000);
    ok(logs.length === 0, `#join in ${theme}: no console warning or error`, logs.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(problems === 0 ? '\nPASS - the audience switch holds' : `\nFAIL - ${problems} problem(s)`);
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
