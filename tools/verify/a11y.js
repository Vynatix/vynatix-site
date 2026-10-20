// Accessibility checks: axe-core scan on every page in every theme under test
// (THEMES, default light,dark), plus functional tests for the skip link, the
// still client list, the no-JS and reduced-motion fallbacks, and an
// independent contrast sweep. The home page is scanned and swept once for each
// hero background under test (BGS, default all four); every other page once.
// The reduced-motion check always runs all four backgrounds, because two of them
// (the dial and the iris) use the Web Animations API, which animationName cannot see.
//
// Every page is audited the way a first-time visitor meets it: with the consent module armed (armGa, the dummy
// ID, Google stubbed) and no answer stored, so the bar is up and is part of what axe and the contrast sweep
// see. The axe scan and the contrast sweep then run a second time with the answer pinned to denied, which is
// the page every returning visitor who declined sees, bar-less. consent-layout.js adds the bar-specific
// checks (size, focus not obscured, target size, forced colours). Both passes take the home page in each
// hero background under test, so the bar is also audited over every one of the four.
const fs = require('fs');
const { PAGES, BASE, THEMES, ALL_BGS, bgsFor, pinTheme, pinBg, pinConsent, armGa, launch, pool } = require('./_common');
const AXE = require.resolve('axe-core/axe.min.js');

// The two ways a page is met: first visit (no answer stored, bar up) and after a decline (bar gone).
const PASSES = [['', undefined], [', consent pinned denied', 'denied']];

// A context with the consent module armed; pass an answer to pin it, or none for a first visit. The hero
// background is drawn at random per visit, so every context pins it (the sheet) and a check that wants another
// one says so with pinTheme({ theme, bg }) on its page, which runs after this and wins.
async function armed(browser, opts = {}, answer) {
  const ctx = await browser.newContext(opts);
  await armGa(ctx);
  await ctx.addInitScript(pinBg);
  if (answer) await ctx.addInitScript(pinConsent, answer);
  return ctx;
}

// "light", or "light weave" for the home page under a background; the label of a pass follows.
const labelOf = (theme, bg, pass) => `${theme}${bg ? ' ' + bg : ''}${pass}`;

(async () => {
  const browser = await launch();
  const axeSrc = fs.readFileSync(AXE, 'utf8');
  let problems = 0;

  // --- axe scan -----------------------------------------------------------
  {
    const jobs = [];
    for (const [label, answer] of PASSES) for (const p of PAGES) for (const theme of THEMES) for (const bg of bgsFor(p)) jobs.push({ label, answer, p, theme, bg });
    const scans = await pool(jobs, 3, async (j) => {
      // bypassCSP only for the axe scan: script-src 'self' correctly refuses the
      // injected scanner. CSP enforcement is proven separately by adversarial.js.
      const ctx = await armed(browser, { bypassCSP: true }, j.answer);
      const page = await ctx.newPage();
      await page.addInitScript(pinTheme, { theme: j.theme, bg: j.bg });
      await page.goto(BASE + j.p, { waitUntil: 'load' });
      await page.addScriptTag({ content: axeSrc });
      const res = await page.evaluate(async () => await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      }));
      const bar = await page.evaluate(() => !!document.getElementById('consent-bar'));
      await ctx.close();
      return { ...j, violations: res.violations, bar };
    });
    for (const sc of scans) {
      const v = sc.violations;
      const tag = `${sc.p} [${labelOf(sc.theme, sc.bg, sc.label)}]`;
      if (v.length) {
        problems += v.length;
        console.log(`FAIL ${tag} — ${v.length} violation(s)`);
        v.forEach((x) => console.log(`       ${x.impact}: ${x.id} — ${x.help} (${x.nodes.length} node(s))\n         e.g. ${x.nodes[0].target.join(' ')}`));
      } else {
        console.log(`ok   ${tag} — 0 axe violations`);
      }
      // The first-visit pass is only worth anything if the bar was really up, and the pinned pass if it was really gone.
      if (sc.bar !== !sc.answer) {
        problems++;
        console.log(`FAIL ${tag} — ${sc.answer ? 'the bar is up although the answer is pinned' : 'no consent bar on a first visit, so the scan did not cover it'}`);
      }
    }
  }

  // --- skip link, on every page --------------------------------------------
  {
    const page = await (await armed(browser)).newPage();
    const bad = [];
    for (const pg of PAGES) {
      await page.goto(BASE + pg, { waitUntil: 'load' });
      await page.keyboard.press('Tab');
      await page.waitForTimeout(250);          // let the reveal transition finish
      const r = await page.evaluate(() => {
        const el = document.activeElement;
        const box = el.getBoundingClientRect();
        return { cls: el.className || '', href: el.getAttribute('href'),
                 onScreen: box.top >= 0 && box.top < window.innerHeight,
                 target: !!document.querySelector('#main') };
      });
      if (!(r.cls.includes('skip-link') && r.href === '#main' && r.onScreen && r.target)) {
        bad.push(`${pg}: ${JSON.stringify(r)}`);
      }
    }
    if (bad.length) problems++;
    console.log(bad.length
      ? `FAIL skip link — ${bad.join(' | ')}`
      : `ok   skip link is the first Tab stop and reveals on focus on all ${PAGES.length} pages`);
    await page.close();
  }

  // --- the client list: one still, labelled list ---------------------------
  // The design system forbids ambient loops and auto-advancing strips, so the
  // client marks are a plain list: exactly one copy, named by a visible label,
  // every named client an off-site link that opens safely, nothing animating
  // and no pause control left over from the old marquee. (The hero backgrounds
  // are a separate matter, see the reduced-motion check below.)
  {
    const page = await (await armed(browser)).newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const lists = [...document.querySelectorAll('.clients__list')];
      const list = lists[0];
      const labelId = list && list.getAttribute('aria-labelledby');
      const label = labelId && document.getElementById(labelId);
      const links = list ? [...list.querySelectorAll('a')] : [];
      return {
        lists: lists.length,
        labelled: !!(label && label.textContent.trim()),
        items: list ? list.querySelectorAll('li').length : 0,
        hiddenCopies: document.querySelectorAll('.clients__list[aria-hidden="true"], .marquee__group').length,
        linksExternal: links.length >= 2 && links.every((a) => /^https:\/\//.test(a.getAttribute('href')) && a.getAttribute('rel') === 'noopener' && !a.hasAttribute('tabindex')),
        animation: list ? getComputedStyle(list).animationName : 'missing',
        pauseControl: !!document.querySelector('.marquee__toggle, [aria-label*="Pause" i]'),
      };
    });
    const ok = r.lists === 1 && r.labelled && r.items >= 2 && r.hiddenCopies === 0 && r.linksExternal && r.animation === 'none' && !r.pauseControl;
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} client list: one still, labelled list with off-site links — ${JSON.stringify(r)}`);
    await page.close();
  }

  // --- no-JS: nothing hidden, no dead control ------------------------------
  // On a phone with JavaScript off, the nav must still be visible (it wraps
  // under the bar), the menu button must not show (it could never open), and
  // the theme toggle must not show either (it could never switch).
  {
    const ctx = await armed(browser, { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
      const links = [...document.querySelectorAll('.site-header__link')];
      return {
        jsNav: document.documentElement.classList.contains('js-nav'),
        navLinks: links.length,
        navVisible: links.length > 0 && links.every(vis),
        menuButton: vis(document.querySelector('.mobile-toggle')),
        themeToggle: vis(document.querySelector('.theme-toggle')),
        consentBar: document.querySelectorAll('.consent').length,
      };
    });
    const ok = !r.jsNav && r.navLinks >= 4 && r.navVisible && !r.menuButton && !r.themeToggle && r.consentBar === 0;
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} no-JS: nav visible and wrapped, menu button, theme toggle and consent bar not shown — ${JSON.stringify(r)}`);
    await ctx.close();
  }

  // --- reduced motion ------------------------------------------------------
  // With reduced motion on, nothing on the site animates: not by CSS (animationName)
  // and not by script (document.getAnimations(), which also lists the Web Animations
  // the dial and the iris use, and CSS transitions still running). The remaining
  // transitions are cut to 0.01ms by the design system. Every hero background is
  // drawn in turn, at 1440 wide so that all four have their art on screen, and each
  // is shown to be drawn, so that a zero is not the zero of an empty page. Each is
  // also given every chance to move: the pointer crosses the page (the dial's input),
  // the theme button is pressed (the dial's sweep), and the iris's 20 seconds of
  // silence are cut to 200ms through its test hook, vynatix-bg-iris-idle (read-only,
  // see tools/README.md), so that an opening that was going to play would have started.
  // The consent module is armed and the answer left open, so the bar is in the page for
  // all of it: it too must not animate, and it must not get in the way of the theme button.
  for (const bg of ALL_BGS) {
    const ctx = await armed(browser, { reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(pinTheme, { theme: 'light', bg });
    if (bg === 'iris') await page.addInitScript(() => { try { sessionStorage.setItem('vynatix-bg-iris-idle', '200'); } catch (e) { /* blocked */ } });
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.mouse.move(300, 450, { steps: 6 });
    await page.mouse.move(1300, 520, { steps: 6 });
    await page.click('.theme-toggle');
    await page.waitForTimeout(1500);                // let anything that was going to start, start
    const r = await page.evaluate(() => {
      const running = [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).animationName !== 'none').length;
      const pseudo = [...document.querySelectorAll('.hero, .hero__h1, .hero__h1 em')].reduce((n, el) =>
        n + ['::before', '::after'].filter((q) => getComputedStyle(el, q).animationName !== 'none').length, 0);
      const live = document.getAnimations();
      const h1 = document.querySelector('.hero__h1');
      const iris = document.querySelector('.iris');
      const drawn = {
        weave: getComputedStyle(h1, '::before').display === 'block' && getComputedStyle(h1, '::before').content !== 'none',
        sheet: getComputedStyle(h1, '::before').content !== 'none',
        dial: getComputedStyle(h1, '::after').content !== 'none' && getComputedStyle(h1, '::after').maskImage !== 'none',
        iris: !!iris && getComputedStyle(iris).display === 'block',
      }[document.documentElement.dataset.bg];
      const card = document.querySelector('.case');
      // The iris under reduced motion: the dial is drawn settled and the opening is not even armed (the design
      // system's own rule would cut the animation to 0.01ms, which getAnimations() could not tell from "never
      // started", so look at the opening's own state: classes on <html> and the once-per-visit flag).
      const c = document.documentElement.classList, dial = document.querySelector('.iris__dial');
      const irisState = document.documentElement.dataset.bg !== 'iris' ? null : {
        armed: c.contains('iris-armed'), play: c.contains('iris-play'), done: c.contains('iris-done'),
        flag: sessionStorage.getItem('vynatix-bg-iris'), dialOpacity: dial ? getComputedStyle(dial).opacity : null,
      };
      return {
        bg: document.documentElement.dataset.bg, drawn, bar: !!document.getElementById('consent-bar'), iris: irisState, animating: running, pseudoAnimating: pseudo,
        webAnimations: live.length, which: live.map((a) => `${a.constructor.name} ${a.animationName || a.transitionProperty || ''}`).slice(0, 4),
        cardTransition: card ? getComputedStyle(card).transitionDuration : 'missing',
      };
    });
    // Chrome reports the system's 0.01ms as "1e-05s"; anything under a millisecond counts as cut.
    const cut = r.cardTransition !== 'missing' && r.cardTransition.split(',').every((d) => parseFloat(d) < 0.001);
    const irisOk = !r.iris || (!r.iris.armed && !r.iris.play && !r.iris.done && r.iris.flag === null && r.iris.dialOpacity === '1');
    const ok = r.bg === bg && r.drawn === true && r.bar === true && irisOk && r.animating === 0 && r.pseudoAnimating === 0 && r.webAnimations === 0 && cut;
    if (!ok) problems++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} reduced motion [${bg}]: art drawn and consent bar up, nothing animates (CSS or Web Animations) through pointer moves, a theme toggle and a short silence, and transitions are cut — ${JSON.stringify(r)}`);
    await ctx.close();
  }

  // --- independent contrast sweep -----------------------------------------
  // axe skips nodes whose background it cannot resolve, and it missed a 66px
  // accent at 1.75:1 outright. Compute every visible text node ourselves.
  // Inside the consent bar and the in-page panel a background that cannot be resolved is reported, never skipped.
  {
    const failures = [];
    const jobs = [];
    for (const [label, answer] of PASSES) for (const pg of PAGES) for (const theme of THEMES) for (const bg of bgsFor(pg)) jobs.push({ label, answer, pg, theme, bg });
    const swept = await pool(jobs, 3, async (j) => {
      const ctx = await armed(browser, {}, j.answer);
      const page = await ctx.newPage();
      await page.addInitScript(pinTheme, { theme: j.theme, bg: j.bg });
      await page.goto(BASE + j.pg, { waitUntil: 'load' });
      const bad = await page.evaluate(() => {
        const lum = (rgb) => {
          const c = rgb.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
          return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        };
        const nums = (str) => { const m = str.match(/[\d.]+/g); return m ? m.map(Number) : null; };
        const out = [];
        document.querySelectorAll('*').forEach((el) => {
          const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!ownText) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
          const box = el.getBoundingClientRect();
          if (!box.width || !box.height) return;
          if (el.closest('[aria-hidden="true"]')) return;
          const sel = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
          const consent = !!el.closest('.consent, .consent-panel');
          const fgAll = nums(cs.color);
          if (!fgAll) { if (consent) out.push({ sel, text: el.textContent.trim().slice(0, 24), unresolved: 'text colour' }); return; }
          const fg = fgAll.slice(0, 3);
          let bg = null, n = el, bailed = false;
          while (n) {
            const ncs = getComputedStyle(n);
            if (ncs.backgroundImage !== 'none') { bailed = true; break; }
            const c = ncs.backgroundColor;
            const parts = nums(c);
            if (parts && (parts.length < 4 || parts[3] === 1) && c !== 'rgba(0, 0, 0, 0)') {
              bg = parts.slice(0, 3);
              break;
            }
            n = n.parentElement;
          }
          if (bailed || !bg) {
            if (consent) out.push({ sel, text: el.textContent.trim().slice(0, 24), unresolved: bailed ? 'background is an image or gradient' : 'no opaque background' });
            return;
          }
          const L1 = lum(fg), L2 = lum(bg);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const px = parseFloat(cs.fontSize);
          const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
          const need = large ? 3 : 4.5;
          if (ratio < need) {
            out.push({ sel, text: el.textContent.trim().slice(0, 24), ratio: Math.round(ratio * 100) / 100, need, px: Math.round(px) });
          }
        });
        return out;
      });
      await ctx.close();
      return { ...j, bad };
    });
    for (const w of swept) {
      w.bad.forEach((b) => failures.push(b.unresolved
        ? `${w.pg} [${labelOf(w.theme, w.bg, w.label)}] ${b.sel} "${b.text}" background cannot be resolved (${b.unresolved})`
        : `${w.pg} [${labelOf(w.theme, w.bg, w.label)}] ${b.sel} "${b.text}" ${b.ratio}:1 < ${b.need} (${b.px}px)`));
    }
    if (failures.length) problems++;
    console.log(failures.length
      ? `FAIL contrast sweep — ${failures.length} node(s)\n       ${failures.slice(0, 30).join('\n       ')}`
      : `ok   contrast sweep — every visible text node meets AA in ${THEMES.join(', ')}, with the consent bar up and after a decline (home page in each of ${bgsFor('index.html').join(', ')})`);
  }

  console.log(problems === 0 ? '\nPASS — no accessibility problems found'
                             : `\nFAIL — ${problems} problem(s)`);
  await browser.close();
  process.exit(problems === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
