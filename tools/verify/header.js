// The header's controls sit where the design puts them at every width: the logo
// at the left, and the right-hand group (theme toggle, the "Book a call" button
// where it shows, the menu button on narrow screens) packed together at the right
// edge, never floating mid-bar. A collapsed menu leaves nothing to push the group
// to the right, which once left the theme toggle in the middle of the bar on phones.
const { PAGES, BASE, launch, pinTheme } = require('./_common');

const WIDTHS = [320, 360, 390, 430, 599, 600, 768, 904, 905, 1024, 1280];
const PAGES_TO_TRY = ['index.html', 'services.html', 'contact.html'].filter((p) => PAGES.includes(p));
// The tools sit within one flex gap of the menu button (--space-6 is the widest, 24px).
const MAX_GAP = 28;

(async () => {
  const browser = await launch();
  let failures = 0;
  const say = (ok, msg) => { if (!ok) failures++; if (!ok || process.env.VERBOSE) console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    for (const p of PAGES_TO_TRY) {
      const page = await ctx.newPage();
      await page.addInitScript(pinTheme, 'light');
      await page.goto(BASE + p, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => {
        const box = (sel) => {
          const e = document.querySelector(sel);
          if (!e) return null;
          const cs = getComputedStyle(e);
          const b = e.getBoundingClientRect();
          return { l: b.left, r: b.right, t: b.top, b: b.bottom, shown: cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 };
        };
        return {
          header: box('.site-header'), logo: box('.site-header__logo'), tools: box('.site-header__tools'),
          theme: box('.theme-toggle'), menu: box('.mobile-toggle'), nav: box('.site-header__nav'),
          cta: box('.site-header__cta'),
        };
      });
      const where = `${p} @${w}px`;
      const inside = (b) => b.l >= r.header.l - 0.5 && b.r <= r.header.r + 0.5;
      say(r.theme && r.theme.shown, `${where}: the theme toggle is visible`);
      say([r.logo, r.tools, r.theme].every(inside) && (!r.menu.shown || inside(r.menu)), `${where}: logo, tools and menu button stay inside the bar`);
      say(r.logo.r <= r.tools.l + 0.5, `${where}: the tools do not overlap the logo`);

      if (w <= 904) {
        say(r.menu.shown, `${where}: the menu button shows`);
        const gap = r.menu.l - r.tools.r;
        say(gap >= -0.5 && gap <= MAX_GAP, `${where}: the tools sit beside the menu button (gap ${Math.round(gap)}px, at most ${MAX_GAP}px)`);
        say(!r.nav.shown, `${where}: the nav is collapsed behind the menu button`);
        say(w >= 600 ? r.cta.shown : !r.cta.shown, `${where}: the header button ${w >= 600 ? 'shows' : 'is hidden (it is in the menu)'}`);
      } else {
        say(!r.menu.shown, `${where}: no menu button`);
        const edge = r.header.r - r.tools.r;
        say(edge >= 0 && edge <= 32, `${where}: the tools sit at the right edge of the bar (${Math.round(edge)}px in)`);
        say(r.nav.shown && r.nav.l >= r.logo.r - 0.5 && r.nav.r <= r.tools.l + 0.5, `${where}: the nav sits between the logo and the tools`);
      }
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();
  console.log(failures === 0 ? `header: layout holds at ${WIDTHS.length} widths on ${PAGES_TO_TRY.length} pages` : `header: ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
