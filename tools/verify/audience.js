// The audience switch on the English home page ("Hire a team" / "Join the team"). Needs the site served
// (python3 -m http.server 8000) and a browser; in `npm run check`.
//   node verify/audience.js
//
// The switch is two plain links and CSS :target (styles.css, "Audience switch"): #join shows the joiner
// view, any other address the client view, and nothing is stored. app.js adds three things on top, none of
// them needed to switch: js-view-join on <html> from the address in the head (so a load on #join never paints
// the client hero first), aria-current on the selected link, and focus kept on the link pressed. What this
// proves:
//  1. Each view shows exactly its own sections: the default address shows every .view-hire section and no
//     .view-join one, #join the reverse, and every child of main but the two anchors and the bar (the
//     sections, and the contents row) carries exactly one of the two classes. The same with JavaScript off,
//     because the switch must not depend on the script, skip links and selected link included.
//  2. The switch moves both ways without a reload, and Back undoes it.
//  3. aria-current follows the view (JavaScript on).
//  4. The joiner view's skip link keeps the view (the normal one points at #main and would drop :target), and
//     the normal one is first on the plain address.
//  5. Every same-page link on the home page is #main, #hire or #join, or sits in the client view and points at
//     an id in it (the contents row). :target holds one fragment at a time and any fragment but #join is the
//     client view, so those stay in the view; a link from anywhere else (the joiner view, the header, the
//     footer) to any other fragment would silently drop the view, and a link in the client view to an id in the
//     joiner view would show the wrong one.
//  6. The joiner view says nothing new: every block marked data-from="membership.html" is found word for word
//     in that page's main, every other h2, h3, p, li, button label and cap number is on the review list below,
//     any text outside those tags fails (so a new tag is added to the reader on purpose), and every link in
//     the joiner view goes to contact, membership or work.
//  7. The switch and its classes exist on index.html only (the Swedish home and every other page have none).
//  8. A visitor who lands on #join and then switches (no reload) sees the same hero, in each of the four
//     backgrounds, as one who loaded the page directly (the dial answering the pointer afterwards, too), with
//     no console error; #join logs no warning (an unused font preload, say) in three themes;
//     and, in the dial, B stays where the pointer left it when the address changes with the hero showing, and
//     after a round trip through the joiner view it is at rest and the first move obeys the slew limit (the
//     animation does not survive display: none). BGS narrows 8a and 8c (8c runs once, when the dial is among them); THEMES is not read:
//     9a sweeps all six themes, 8b runs in three, and every other check is pinned to the light theme.
//  9. Found in review, each a regression this file now catches:
//     a. the selected link differs from the other by more than its fill (an underline and a primary border,
//        which survive Windows high contrast), in all six themes and under forced colours, and it does not
//        change width when it is selected;
//     b. a fresh load of #join has js-view-join on <html> and no client view at DOMContentLoaded (set in the
//        head; the browser only sets :target after parsing, so a slow connection would paint the client hero
//        first); the percent-encoded and text-fragment spellings of #join agree between view, class and
//        aria-current (Chromium already matches them with :target; the script keeps other engines in step),
//        and #JOIN stays the client view;
//     c. Enter on a link keeps focus on it with a visible ring, also on the link already selected (no
//        hashchange follows); a mouse press leaves it focused with no ring and no scroll, from either
//        address; a modified click leaves nothing armed for a later Back; and the next Tab goes into the
//        new view;
//     d. the open mobile menu leaves nothing of the bar focusable under it;
//     e. the client view's closing band follows a client section that is not a band (a hidden joiner band
//        before it would add a margin: adjacent-sibling rules ignore display: none), and neither closing
//        band overflows at enlarged text on a phone.
const { PAGES, BASE, readPage, launch, pinTheme, ALL_THEMES, BGS: BGS_LIST } = require('./_common');
const { PNG } = require('pngjs');

let problems = 0;
const ok = (cond, msg, detail) => {
  if (cond) console.log(`ok   ${msg}`);
  else { problems++; console.log(`FAIL ${msg}${detail ? ' - ' + detail : ''}`); }
};

const SAME_PAGE = new Set(['#main', '#hire', '#join']);
const JOIN_TARGETS = new Set(['contact.html', 'membership.html', 'work.html']);
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

// The words the joiner view may carry that are not inside a [data-from] block. This is the owner's review
// list: anything else outside a lifted block fails. A string is one of
//  - NEW: wording written for the switch (approved with the plan; keep AGENTS.md, Audience switch, in step);
//  - HOME_SENTENCES: a sentence the client view of this page already carries, word for word;
//  - MEMBERSHIP: an element on membership.html, word for word (a heading or eyebrow lifted without data-from).
const NEW = new Set([
  'Stay independent. Without going it alone.',
  'Vynatix is a consultancy built and run by senior engineers. You stay freelance and you keep your work. We find and qualify the assignments, and you choose which ones to take.',
  'What members work on',
  'The work',
  'See the work',
  'Read about membership',
  'Read the full membership page',
  'Start a conversation',
  // Carried over from the old "For senior engineers" section of the home page, which the joiner view
  // absorbed: neither string is on the client view any more, and membership.html words the heading differently.
  'For senior engineers',
  'Independence, with a firm behind you.',
]);
// The sentence from the home hero that "The work" repeats: found inside the client view's text.
const HOME_SENTENCES = [
  'Right now that means in-car software on Android Automotive and the build pipelines behind it, at Volvo Trucks and Volvo Cars, with AI engineering and cloud platforms alongside.',
];

// What each view shows, read from the rendered page.
const state = () => {
  const shown = (el) => getComputedStyle(el).display !== 'none';
  // Everything in main but the two anchors and the switch itself, so a stray block cannot sit in both views.
  const secs = [...document.querySelectorAll('main > *')].filter((e) => !e.matches('.view-anchor, .audience'));
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
    ok(s.total > 0 && s.untagged === 0, `${tag}: every child of main (but the anchors and the switch) carries exactly one view class`, `${s.untagged} of ${s.total} are not`);
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
    const wantSkip = skips.length === 2 && skips[0].href === '#main' && !skips[0].shown && skips[1].href === '#join' && skips[1].shown;
    // Without script the two :has() rules decide (with it, js-view-join does), so both are looked at.
    ok(wantSkip, `${tag}: in the joiner view only the skip link that keeps the view is shown`, JSON.stringify(skips));
    {
      const deco = () => page.evaluate(() => [...document.querySelectorAll('.audience__link')].map((a) => /underline/.test(getComputedStyle(a).textDecorationLine)));
      const atJoin = await deco();
      await page.goto(BASE + 'index.html', { waitUntil: 'load' });
      const atHire = await deco();
      const plain = await page.evaluate(() => [...document.querySelectorAll('.skip-link')].filter((a) => getComputedStyle(a).display !== 'none').map((a) => a.getAttribute('href')));
      ok(atJoin[1] && !atJoin[0] && atHire[0] && !atHire[1], `${tag}: the selected link is the underlined one in each view`, `#join ${JSON.stringify(atJoin)}, plain ${JSON.stringify(atHire)}`);
      ok(plain.length === 1 && plain[0] === '#main', `${tag}: on the plain address the only skip link shown is the one to #main`, plain.join(','));
      await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    }
    if (js) {
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
    await page.addInitScript(pinTheme, pin('light', 'sheet'));
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    // Resolved, so index.html#faq and /#faq count as same-page links too.
    const links = await page.evaluate(() => {
      const here = location.pathname.replace(/index\.html$/, '');
      return [...document.querySelectorAll('a[href]')].map((a) => ({ a, u: new URL(a.getAttribute('href'), location.href) }))
        .filter(({ u }) => u.origin === location.origin && u.pathname.replace(/index\.html$/, '') === here && u.hash)
        .map(({ a, u }) => {
          let id = u.hash.slice(1); try { id = decodeURIComponent(id); } catch (e) { /* keep it */ }
          const target = document.getElementById(id);
          return { hash: u.hash, inClient: !!a.closest('.view-hire'), targetInClient: !!(target && target.closest('.view-hire')) };
        });
    });
    const stray = links.filter((l) => !SAME_PAGE.has(l.hash) && !(l.inClient && l.targetInClient)).map((l) => l.hash);
    ok(stray.length === 0, 'every same-page link on the home page is #main, #hire or #join, or stays inside the client view (a view lives in one fragment)', stray.join(', '));
    ok(links.filter((l) => l.inClient && l.targetInClient).length >= 5, 'the client view\'s own same-page links (the contents row) were read', `${links.filter((l) => l.inClient && l.targetInClient).length} links`);

    // Every text block of the joiner view, read where it is visible (the #join address), with <br> as a space.
    await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    const READ = () => {
      const text = (e) => { const c = e.cloneNode(true); c.querySelectorAll('br').forEach((b) => b.replaceWith(' ')); return c.textContent; };
      return [...document.querySelectorAll('.view-join h2, .view-join h3, .view-join p, .view-join li, .view-join a.btn, .view-join span.cap__num')]
        .map((e) => ({ text: text(e), from: (e.closest('[data-from]') || {}).getAttribute ? e.closest('[data-from]').getAttribute('data-from') : null }));
    };
    // Text the reader above cannot see: anything outside those tags (a new element type, say) fails until it is added on purpose.
    const unread = await page.evaluate(() => {
      const out = [];
      const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) {
        const t = n.textContent.replace(/\s+/g, ' ').trim(), e = n.parentElement;
        if (t && e.closest('.view-join') && !e.closest('script, style, h2, h3, p, li, a.btn, span.cap__num') && !(e.closest('svg') && !e.closest('svg title, svg desc, svg text'))) out.push(`${e.tagName}: ${t.slice(0, 50)}`);
      }
      out.push(...[...document.querySelectorAll('.view-join[aria-label], .view-join [aria-label], .view-join[title], .view-join [title], .view-join[alt], .view-join [alt]')].map((e) => `${e.tagName} attribute: ${e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('alt')}`));
      return out;
    });
    ok(unread.length === 0, 'the joiner view has no text the review below cannot read (only h2, h3, p, li, button labels and cap numbers carry words)', unread.join(' | '));
    const joinParts = (await page.evaluate(READ)).map((x) => ({ ...x, text: norm(x.text) }));
    const homeText = norm(await page.evaluate(() => [...document.querySelectorAll('.view-hire')].map((e) => e.textContent).join(' ')));
    const sources = {};
    const elementsOf = async (rel) => {
      if (!sources[rel]) {
        await page.goto(BASE + rel, { waitUntil: 'load' });
        sources[rel] = new Set((await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, main p, main li, main span.cap__num')].map((e) => {
          const c = e.cloneNode(true); c.querySelectorAll('br').forEach((b) => b.replaceWith(' ')); return c.textContent;
        }))).map(norm));
      }
      return sources[rel];
    };
    const lifted = joinParts.filter((x) => x.from);
    const froms = await page.evaluate(() => [...document.querySelectorAll('.view-join [data-from]')].map((e) => e.getAttribute('data-from')));
    ok(froms.length > 0 && froms.every((f) => f === 'membership.html'), 'every data-from mark in the joiner view names membership.html', [...new Set(froms)].join(', '));
    const wrong = [];
    for (const x of lifted) if (!(await elementsOf(x.from)).has(x.text)) wrong.push(x.text.slice(0, 70));
    ok(lifted.length >= 20, 'the joiner view marks its lifted blocks (data-from)', `${lifted.length} parts`);
    ok(wrong.length === 0, 'every lifted sentence is a whole element of membership.html, word for word', wrong.join(' | '));

    // Everything outside a lifted block is on the review list: wording written for the switch (NEW), a
    // sentence the client view already carries (HOME_SENTENCES), or a membership.html element (a heading or
    // eyebrow lifted without a data-from mark).
    const member = await elementsOf('membership.html');
    const unlisted = joinParts.filter((x) => !x.from && !NEW.has(x.text) && !member.has(x.text) && !HOME_SENTENCES.some((h) => x.text === h && homeText.includes(h)))
      .map((x) => x.text.slice(0, 70));
    ok(unlisted.length === 0, 'every other piece of joiner text is on the review list (new wording, a sentence the client view carries, or a membership.html element)', unlisted.join(' | '));
    ok(joinParts.length >= 40, 'the joiner view was read in full', `${joinParts.length} parts`);

    await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    const targets = await page.evaluate(() => [...document.querySelectorAll('.view-join a[href]')].map((a) => a.getAttribute('href')));
    const badLinks = targets.filter((h) => !JOIN_TARGETS.has(h));
    ok(targets.length > 0 && badLinks.length === 0, 'every link in the joiner view goes to contact, membership or work', badLinks.join(', '));
    await ctx.close();
  }

  // ---- 8a. Switching without a reload leaves the hero as a direct load draws it ---------------------------------
  const BGS = BGS_LIST;
  const heroShot = async (page) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
    return PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 96, width: 1440, height: 804 }, animations: 'disabled' }));
  };
  if (BGS.length < 4) console.log(`note: BGS narrows 8a and 8c to ${BGS.join(', ')}`);
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
      // The dial turns with the pointer; a hero that was hidden while the pointer moved must answer it again.
      await page.mouse.move(700, 500, { steps: 4 });
      await page.mouse.move(1100, 500, { steps: 4 });
      const png = await heroShot(page);
      await ctx.close();
      return { png, errors };
    };
    const direct = await shoot('index.html', false);
    const switched = await shoot('index.html#join', true);   // the click moves the pointer while the hero was hidden
    // The strip includes the bar. When a pill's style changes in place (the switched path) Chromium sometimes
    // rasterises two pixels of its rounded border one unit off in a channel (about one run in five; two direct
    // loads never differ), so a channel may differ by 2. The art moving or turning differs by tens.
    const TOL = 2;
    let n = 0;
    if (direct.png.width !== switched.png.width || direct.png.height !== switched.png.height) n = -1;
    else for (let i = 0; i < direct.png.data.length; i += 4) {
      if (Math.abs(direct.png.data[i] - switched.png.data[i]) > TOL || Math.abs(direct.png.data[i + 1] - switched.png.data[i + 1]) > TOL || Math.abs(direct.png.data[i + 2] - switched.png.data[i + 2]) > TOL) n++;
    }
    ok(n === 0, `${bg}: landing on #join and switching to "Hire a team" draws the hero exactly as a direct load does`, n < 0 ? 'sizes differ' : `${n} differing pixels`);
    ok(direct.errors.length + switched.errors.length === 0, `${bg}: no script errors on either path`, [...direct.errors, ...switched.errors].join(' | '));
  }

  // ---- 8c. The dial's B: left alone when the address changes with the hero showing, alive after the joiner view ---
  // Keyboard presses, not clicks: a click moves the pointer, which would turn B on its own.
  if (BGS.includes('dial')) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(pinTheme, pin('light', 'dial'));
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const angle = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#home .hero__h1'), '::after').rotate) || 0);
    const settle = async (x) => { await page.mouse.move(x, 500, { steps: 6 }); await page.waitForTimeout(500); return angle(); };
    const press = async (sel) => { await page.focus(sel); await page.keyboard.press('Enter'); await page.waitForTimeout(150); return page.evaluate(() => location.hash); };
    const GAIN = 6 / 252 * 180 / Math.PI;   // the dial's travel in degrees at k = 1 (hero-bg.js)
    const far = await settle(1400);
    ok(far > 0.9, 'dial: the pointer at the right edge turns B (the probe works)', `${far}deg`);
    const h1 = await press('.audience__link--hire');   // '' to #hire: the address changes, the hero stays
    const kept = await angle();
    ok(h1 === '#hire' && Math.abs(kept - far) < 0.05, 'dial: an address change with the hero showing leaves B where the pointer put it', `${far}deg before, ${kept}deg after, hash "${h1}"`);
    const h2 = await press('.audience__link--join');
    const h3 = await press('.audience__link--hire');
    const rest = await angle();
    ok(h2 === '#join' && h3 === '#hire' && Math.abs(rest) < 0.01, 'dial: after a round trip through the joiner view B is at rest', `${rest}deg, hashes "${h2}" "${h3}"`);
    // The first move after the hero returns starts from rest and obeys the slew limit (a stale k from before the
    // joiner view would make B jump), read on consecutive frames as bg-dial.js does.
    const frames = await page.evaluate(() => new Promise((resolve) => {
      const out = []; let n = 0;
      const el = document.querySelector('#home .hero__h1');
      const read = () => parseFloat(getComputedStyle(el, '::after').rotate) || 0;
      out.push(read());
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth - 1, clientY: 5, pointerType: 'mouse' }));
      const tick = () => { out.push(read()); if (++n < 14) requestAnimationFrame(tick); else resolve(out); };
      requestAnimationFrame(tick);
    }));
    let maxStep = 0; for (let i = 1; i < frames.length; i++) maxStep = Math.max(maxStep, Math.abs(frames[i] - frames[i - 1]));
    ok(frames[0] === 0 && maxStep <= 0.35 * GAIN + 0.01 && frames[frames.length - 1] > 0.9 * GAIN, 'dial: the first move after the round trip starts at rest and moves B by at most 0.35 of its travel a frame', `from ${frames[0]}deg, largest step ${maxStep.toFixed(3)}deg (limit ${(0.35 * GAIN).toFixed(3)}), ends at ${frames[frames.length - 1]}deg`);
    const again = await settle(1300);
    ok(again > 0.9, 'dial: and it follows the pointer again', `${again}deg`);
    ok(errors.length === 0, 'dial: no script errors', errors.join(' | '));
    await ctx.close();
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
    await page.waitForTimeout(5000);
    ok(logs.length === 0, `#join in ${theme}: no console warning or error`, logs.join(' | '));
    await ctx.close();
  }

  // ---- 9a. The selected link differs by more than its fill, in every look and under forced colours --------------
  const READ_LINKS = () => {
    const rgb = (c) => {
      const m = c.match(/-?[\d.]+/g);
      if (!m) return null;
      if (c.startsWith('color(srgb')) return m.slice(0, 3).map((v) => v * 255);
      if (c.startsWith('rgb')) return m.slice(0, 3).map(Number);
      return null;
    };
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    let page = null;
    for (let e = document.querySelector('.audience'); e; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if (c && getComputedStyle(e).backgroundColor.indexOf('rgba(0, 0, 0, 0)') < 0) { page = c; break; }
    }
    return [...document.querySelectorAll('.audience__link')].map((a) => {
      const cs = getComputedStyle(a);
      const border = rgb(cs.borderTopColor);
      return { cls: a.className.replace('audience__link ', ''), deco: cs.textDecorationLine, border: cs.borderTopColor, width: cs.borderTopWidth, w: a.getBoundingClientRect().width,
        borderVsPage: border && page ? Math.round(ratio(border, page) * 100) / 100 : null };
    });
  };
  for (const theme of ALL_THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(pinTheme, pin(theme, 'sheet'));
    const seen = {};
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    seen.hire = await page.evaluate(READ_LINKS);
    await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.classList.contains('js-view-join'), null, { timeout: 3000 }).catch(() => {});
    seen.join = await page.evaluate(READ_LINKS);
    const bad = [];
    for (const [view, sel, other] of [['hire', 'audience__link--hire', 'audience__link--join'], ['join', 'audience__link--join', 'audience__link--hire']]) {
      const on = seen[view].find((l) => l.cls === sel), off = seen[view].find((l) => l.cls === other);
      if (!/underline/.test(on.deco) || /underline/.test(off.deco)) bad.push(`${view}: underline ${on.deco} vs ${off.deco}`);
      if (on.border === off.border) bad.push(`${view}: same border colour ${on.border}`);
      if (on.borderVsPage === null || on.borderVsPage < 3) bad.push(`${view}: selected border ${on.borderVsPage}:1 against the page`);
    }
    ok(bad.length === 0, `${theme}: the selected link has an underline and a border at 3:1, the other has neither`, bad.join(' | '));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, forcedColors: 'active' });
    const page = await ctx.newPage();
    await page.addInitScript(pinTheme, pin('light', 'sheet'));
    const bad = [];
    const widths = {};
    for (const [url, sel, other] of [['index.html', 'audience__link--hire', 'audience__link--join'], ['index.html#join', 'audience__link--join', 'audience__link--hire']]) {
      await page.goto(BASE + url, { waitUntil: 'load' });
      await page.waitForTimeout(150);
      const links = await page.evaluate(READ_LINKS);
      const on = links.find((l) => l.cls === sel), off = links.find((l) => l.cls === other);
      if (!/underline/.test(on.deco) || /underline/.test(off.deco)) bad.push(`${url}: underline ${on.deco} vs ${off.deco}`);
      if (on.width === off.width) bad.push(`${url}: border widths ${on.width} and ${off.width}`);
      widths[url] = { [sel]: on.w, [other]: off.w };
    }
    // [where the link is selected, where it is not]
    for (const [c, [on, off]] of Object.entries({ 'audience__link--hire': ['index.html', 'index.html#join'], 'audience__link--join': ['index.html#join', 'index.html'] })) {
      const a = widths[on][c], b = widths[off][c];
      if (Math.abs(a - b) > 0.5) bad.push(`${c} is ${a}px wide selected and ${b}px unselected, so it moves its neighbour`);
    }
    ok(bad.length === 0, 'forced colours: the selected link keeps an underline and a heavier border, and its width', bad.join(' | '));
    await ctx.close();
  }

  // ---- 9b. First paint and the odd spellings of #join -------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(pinTheme, pin('light', 'sheet'));
    // At DOMContentLoaded Chromium has not set :target yet (it does so after parsing), which is the moment a
    // slow connection paints. The joiner view has to be in force by then, not a moment later.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const d = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).display : 'missing'; };
        window.__atDcl = { hero: d('#home'), join: d('.page-hero.view-join'), cls: document.documentElement.classList.contains('js-view-join') };
      });
    });
    await page.goto(BASE + 'index.html#join', { waitUntil: 'load' });
    const dcl = await page.evaluate(() => window.__atDcl);
    ok(dcl && dcl.cls && dcl.hero === 'none' && dcl.join !== 'none', 'a load on #join has js-view-join on <html> and the joiner view in force by DOMContentLoaded (no client-hero first paint)', JSON.stringify(dcl));
    const klass = () => page.evaluate(() => document.documentElement.classList.contains('js-view-join'));
    for (const [url, label] of [['index.html#%6Aoin', 'percent-encoded #join'], ['index.html#join:~:text=Senior', '#join with a text fragment']]) {
      await page.goto(BASE + url, { waitUntil: 'load' });
      await page.waitForTimeout(150);
      const s = await page.evaluate(state);
      ok(isJoin(s) && (await klass()) && s.current[1] === 'true' && s.current[0] === null, `${label}: the joiner view, js-view-join and aria-current agree`, `${brief(s)}, class ${await klass()}, current ${JSON.stringify(s.current)}`);
    }
    await page.goto(BASE + 'index.html#JOIN', { waitUntil: 'load' });
    await page.waitForTimeout(150);
    {
      const s = await page.evaluate(state);
      ok(isHire(s) && !(await klass()) && s.current[0] === 'true' && s.current[1] === null, '#JOIN (another case) is not the joiner view', `${brief(s)}, class ${await klass()}, current ${JSON.stringify(s.current)}`);
    }
    await ctx.close();
  }

  // ---- 9c. Focus stays on the link pressed, with its ring, and the next Tab goes into the new view -----------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(pinTheme, pin('light', 'sheet'));
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const focused = () => page.evaluate(() => ({ cls: document.activeElement.className, ring: document.activeElement.matches(':focus-visible'), inJoin: !!document.activeElement.closest('.view-join') }));
    const enter = async (sel, hash) => {
      await page.focus(sel);
      await page.keyboard.press('Enter');
      if (hash !== null) await page.waitForFunction((h) => location.hash === h, hash, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(150);
      return focused();
    };
    let f = await enter('.audience__link--join', '#join');
    ok(/audience__link--join/.test(f.cls) && f.ring, 'Enter on "Join the team" keeps focus on it, with its ring', JSON.stringify(f));
    // The link that is already selected: the address does not change, so no hashchange follows, yet the
    // fragment navigation still clears focus to the page.
    f = await enter('.audience__link--join', null);
    ok(/audience__link--join/.test(f.cls) && f.ring, 'Enter on the link that is already selected keeps focus on it too', JSON.stringify(f));
    await page.keyboard.press('Tab');
    f = await focused();
    ok(f.inJoin, 'the next Tab goes into the joiner view', JSON.stringify(f));
    f = await enter('.audience__link--hire', '#hire');
    ok(/audience__link--hire/.test(f.cls) && f.ring, 'Enter on "Hire a team" keeps focus on it, with its ring', JSON.stringify(f));
    f = await enter('.audience__link--hire', null);
    ok(/audience__link--hire/.test(f.cls) && f.ring, 'Enter on "Hire a team" while it is selected keeps focus on it too', JSON.stringify(f));
    // A modified click opens another tab and changes nothing here; it must not leave the link armed, or the
    // next Back to that address would pull focus onto it.
    await page.click('.audience__link--join', { modifiers: ['ControlOrMeta'] });
    await page.waitForTimeout(200);
    const opened = ctx.pages().length - 1;
    for (const other of ctx.pages()) if (other !== page) await other.close();
    await page.bringToFront();
    const before = await page.evaluate(() => location.hash);
    await page.goBack();
    await page.waitForFunction(() => location.hash === '#join', null, { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
    f = await focused();
    const landed = await page.evaluate(() => location.hash);
    ok(opened === 1 && before === '#hire' && landed === '#join', 'the modified click opened a tab, left this address alone, and Back returned to #join (the step is meaningful)', `tabs opened ${opened}, before "${before}", landed "${landed}"`);
    ok(!/audience__link--join/.test(f.cls), 'a modified click does not pull focus onto its link on a later Back', JSON.stringify(f));
    // A pointer press: the link ends up focused (a fragment link clears it) but shows no ring, from another
    // address and from the one it already names, and the page does not scroll.
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    for (const [sel, hash, what] of [
      ['.audience__link--join', '#join', '"Join the team" from the plain address'],
      ['.audience__link--join', '#join', '"Join the team" while it is selected'],
      ['.audience__link--hire', '#hire', '"Hire a team" from #join'],
      ['.audience__link--hire', '#hire', '"Hire a team" while it is selected'],
    ]) {
      await page.click(sel);
      await page.waitForFunction((h) => location.hash === h, hash, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(150);
      f = await page.evaluate(() => ({ cls: document.activeElement.className, ring: document.activeElement.matches(':focus-visible'), y: scrollY }));
      ok(f.cls.indexOf(sel.slice(1)) >= 0 && !f.ring && f.y === 0, `a mouse press on ${what} leaves focus on the link, with no ring and no scroll`, JSON.stringify(f));
    }
    await ctx.close();
  }

  // ---- 9d. The open mobile menu covers the bar: nothing of it may take focus ---------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript(pinTheme, pin('light', 'sheet'));
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const vis = () => page.evaluate(() => getComputedStyle(document.querySelector('.audience')).visibility);
    const before = await vis();
    await page.click('.mobile-toggle');
    const open = await vis();
    await page.keyboard.press('Escape');
    const after = await vis();
    ok(before === 'visible' && open === 'hidden' && after === 'visible', 'the bar is out of the tab order while the mobile menu is open, and back when it closes', `${before} / ${open} / ${after}`);
    await ctx.close();
  }

  // ---- 9e. Closing bands: no hidden band before the client one, no overflow at enlarged text ---------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(pinTheme, pin('light', 'sheet'));
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const band = await page.evaluate(() => {
      const c = document.getElementById('contact'), p = c.previousElementSibling;
      return { prev: p ? p.className : null, prevClient: !!p && p.classList.contains('view-hire'), prevBand: !!p && p.classList.contains('band--inset'), marginTop: getComputedStyle(c).marginTop };
    });
    ok(band.prevClient && !band.prevBand, 'the client view\'s closing band follows a client section that is not a band (a hidden joiner band before it would add a margin)', JSON.stringify(band));
    await ctx.close();
    const TEXT_SCALE = (f) => {
      const all = [document.documentElement, ...document.querySelectorAll('body *')];
      const sizes = all.map((e) => parseFloat(getComputedStyle(e).fontSize));
      const lhs = all.map((e) => getComputedStyle(e).lineHeight);
      all.forEach((e, i) => {
        e.style.setProperty('font-size', (sizes[i] * f) + 'px', 'important');
        if (/px$/.test(lhs[i])) e.style.setProperty('line-height', (parseFloat(lhs[i]) * f) + 'px', 'important');
      });
    };
    const over = [];
    for (const [url, w] of [['index.html', 360], ['index.html', 390], ['index.html#join', 360], ['index.html#join', 390]]) {
      const c = await browser.newContext({ viewport: { width: w, height: 800 } });
      const pg = await c.newPage();
      await pg.addInitScript(pinTheme, pin('light', 'sheet'));
      await pg.goto(BASE + url, { waitUntil: 'load' });
      await pg.evaluate(() => document.querySelectorAll('.cta-band').forEach((b) => b.scrollIntoView()));
      await pg.evaluate(TEXT_SCALE, 1.75);
      const r = await pg.evaluate(() => [...document.querySelectorAll('.cta-band')].filter((b) => b.getClientRects().length).map((b) => {
        const box = b.getBoundingClientRect();
        const wide = [...b.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > box.right + 1).length;
        return { wide, inner: b.querySelector('.cta-band__inner').scrollWidth - b.querySelector('.cta-band__inner').clientWidth };
      }));
      if (!r.length || r.some((x) => x.wide || x.inner > 0)) over.push(`${url} ${w}px ${JSON.stringify(r)}`);
      await c.close();
    }
    ok(over.length === 0, 'the closing band of each view stays inside its card at 1.75x text on a 360 and a 390px phone', over.join(' | '));
  }

  await browser.close();
  console.log(problems === 0 ? '\nPASS - the audience switch holds' : `\nFAIL - ${problems} problem(s)`);
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
