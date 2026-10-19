// Theme — a colour scheme picked at random for each visit, light or dark.
//
// The design system has six themes over one set of colour roles: three brand
// directions (Forest, Teal, Monochrome), each with a light and a dark theme.
// On arrival the site picks one direction at random and keeps it for the rest
// of the visit (sessionStorage), so moving between pages never changes the
// look; a new tab or a later visit draws again. Light or dark is not random:
// it follows the visitor's own choice from the toggle (localStorage) and,
// without one, their operating-system preference. The toggle flips light and
// dark within the direction the visit drew.
//
// This file loads in the <head>, without defer, so the first block below sets
// data-theme before the page paints. The CSP rules out an inline script, so a
// small blocking file is the way to avoid a flash of the wrong theme. If
// storage is blocked the pick cannot be kept, so the site stays on Forest
// rather than redrawing on every page. Without JavaScript the page keeps the
// Forest light theme its markup names.
(function () {
  var root = document.documentElement;
  var THEME_KEY = 'vynatix-theme';  // localStorage: the visitor's light/dark choice
  var LOOK_KEY = 'vynatix-look';    // sessionStorage: the direction drawn for this visit
  var THEMES = ['light', 'dark', 'teal-light', 'teal-dark', 'mono-light', 'mono-dark'];
  var LOOKS = ['forest', 'teal', 'mono'];
  var PREFIX = { forest: '', teal: 'teal-', mono: 'mono-' };
  // The canvas of each theme (md-sys-color-surface), for the browser chrome
  // colour before the body exists to be measured.
  var CANVAS = {
    'light': '#EFE8DA', 'dark': '#1B1A16',
    'teal-light': '#F3F0E9', 'teal-dark': '#0D2A2C',
    'mono-light': '#F5F1EA', 'mono-dark': '#14110F'
  };
  // The display face and its italic (the hero's accent line) each direction
  // sets the headline in, in fonts/ as <name>-latin.woff2.
  var DISPLAY_FACES = {
    forest: ['fraunces-variable', 'fraunces-italic-variable'],
    teal: ['instrument-serif-400', 'instrument-serif-400-italic'],
    mono: ['geist-variable', 'fraunces-italic-variable']
  };

  function isDark(theme) { return /(^|-)dark$/.test(theme); }
  // '' for Forest, 'teal-' or 'mono-' for the other directions.
  function direction(theme) {
    var i = theme.indexOf('-');
    return i < 0 ? '' : theme.slice(0, i + 1);
  }

  // The direction for this visit: the one already drawn, else a fresh random
  // pick, kept for the visit. Anything stored that is not one of the three is
  // discarded rather than trusted.
  function pickLook() {
    try {
      var stored = sessionStorage.getItem(LOOK_KEY);
      if (LOOKS.indexOf(stored) < 0) {
        stored = LOOKS[Math.floor(Math.random() * LOOKS.length)];
        sessionStorage.setItem(LOOK_KEY, stored);
      }
      return stored;
    } catch (e) {
      return 'forest';
    }
  }

  function wantsDark() {
    var stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch (e) {
      stored = null;
    }
    if (THEMES.indexOf(stored) >= 0) return isDark(stored);
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function canvasColour(theme) {
    var bg = '';
    try { bg = getComputedStyle(document.body).backgroundColor; } catch (e) { bg = ''; }
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
    return CANVAS[theme] || CANVAS.light;
  }

  function applyTheme(theme, button) {
    root.setAttribute('data-theme', theme);
    // Keep the browser chrome colour matching what is actually rendered.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', canvasColour(theme));
    // The button keeps one name ("Dark theme") and aria-pressed carries the
    // state, so the two never contradict each other in an announcement.
    if (button) button.setAttribute('aria-pressed', String(isDark(theme)));
  }

  // The home page headline is the largest text on the site and sets one line
  // in the display face and one in its italic; fetch both for the drawn
  // direction now rather than after the stylesheet names them.
  function preloadHeadlineFaces(look) {
    if (!/\/(index\.html)?$/.test(location.pathname) || !document.head) return;
    DISPLAY_FACES[look].forEach(function (name) {
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = 'fonts/' + name + '-latin.woff2';
      document.head.appendChild(link);
    });
  }

  // First paint: draw the direction, then set the theme before anything renders.
  var look = pickLook();
  applyTheme(PREFIX[look] + (wantsDark() ? 'dark' : 'light'), null);
  preloadHeadlineFaces(look);

  // After the page is parsed: wire the toggle and settle the chrome colour
  // from the rendered background.
  function init() {
    var button = document.querySelector('.theme-toggle');
    applyTheme(root.getAttribute('data-theme') || 'light', button);
    if (!button) return;
    // The toggle is invisible until it can work (styles.css), the same opt-in
    // the mobile nav uses, so it never sits dead for a no-JS visitor.
    root.classList.add('js-theme');

    button.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') || 'light';
      var next = direction(current) + (isDark(current) ? 'light' : 'dark');
      applyTheme(next, button);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* storage unavailable — the toggle still works for this page */
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Hero background — one of four, drawn at random for each visit.
//
// The home hero carries one piece of background art: a woven cloth ('weave'),
// the headline's drafting sheet ('sheet'), a vernier dial ('dial') or an iris
// ('iris'). Like the colour scheme, the draw is made once per visit, kept in
// sessionStorage so every page of the visit agrees, and made again in a new
// tab or a later visit. It is stored as data-bg on <html>, which every
// background rule in styles.css and every background feature below is scoped
// to, so only the drawn one has any effect. This block runs in the blocking
// first script, before the page paints, for the same reason the theme draw
// does: the art must be there on first paint, not appear after it.
//
// If storage is blocked the draw cannot be kept, so the page uses the sheet,
// the one background that needs no script, rather than redrawing on every
// navigation. Without JavaScript <html> has no data-bg, and styles.css treats
// that as the sheet too. To pin the site to one background, replace
// pickBg()'s body with return 'sheet'; (or 'weave', 'dial', 'iris').
(function () {
  var BG_KEY = 'vynatix-bg';  // sessionStorage: the background drawn for this visit
  var BGS = ['weave', 'sheet', 'dial', 'iris'];

  // The background for this visit: the one already drawn, else a fresh random
  // pick, kept for the visit. Anything stored that is not one of the four is
  // discarded rather than trusted.
  function pickBg() {
    try {
      var stored = sessionStorage.getItem(BG_KEY);
      if (BGS.indexOf(stored) < 0) {
        stored = BGS[Math.floor(Math.random() * BGS.length)];
        sessionStorage.setItem(BG_KEY, stored);
      }
      return stored;
    } catch (e) {
      return 'sheet';
    }
  }

  document.documentElement.setAttribute('data-bg', pickBg());
})();

// Mobile nav — toggle the menu open/closed from the menu button.
(function () {
  function init() {
    var toggle = document.querySelector('.mobile-toggle');
    var nav = document.querySelector('.site-header__nav');
    if (!toggle || !nav) return;

    // Opt into the collapsible mobile nav. Without this class the nav stays
    // visible and wraps, so a no-JS visitor on a phone still has every link.
    document.documentElement.classList.add('js-nav');

    function setOpen(open) {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });

    // Close the menu after following a link.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('.site-header__link')) setOpen(false);
    });

    // Escape closes the menu and hands focus back to the button.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// bg:weave:begin
// Hero background 'weave': a seed per visit becomes a cloth tile, handed to CSS as a mask.
//
// This is the weave's whole script. It returns at once unless the visit drew the weave (the
// draw above sets data-bg on <html>), and it only acts on the home page, so every other draw
// and every other page gets no listener, no timer, no observer, no animation frame and no
// storage write from it. It runs in the blocking first script, straight after the draw, so
// --weave-tile is on <html> before the body is parsed and before first paint.
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-bg') !== 'weave') return;
  if (!/\/(index\.html)?$/.test(location.pathname)) return;

  var KEY = 'vynatix-bg-seed';   // sessionStorage: one whole number, the visit's cloth

  function mulberry32(a) {
    return function () {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // The cloth, in CSS px: a 6px pitch with a 3px thread and a 3px gap, so every edge sits on
  // the pixel grid at 1x and 2x. A cell shows either a warp float (a vertical bar) or a weft
  // float (a horizontal one); a run of cells is one bar, and it stops 1px short of the next
  // cell so no two threads touch. Runs wrap round the tile, so the cloth is seamless.
  var C = 6, T = 3, E = 1;

  // A drawdown: end i, pick j shows warp when (thread(i) + treadle(j)) mod m < m / 2, so the cloth
  // is always a balanced twill (2/2, 3/3 or 4/4, by m = 4, 6 or 8) and every draw carries the
  // same amount of ink. Kinds: 0 point, 1 straight, 2 straight reversed. Returns the warp
  // floats and the weft floats as two path strings.
  function draft(r, th, tr, m, p, q) {
    function at(kind, x) {
      x %= r;
      return kind === 0 ? (x > r / 2 ? r - x : x) : kind === 1 ? x : -x;
    }
    function up(i, j) {
      return ((at(th, i + p) + at(tr, j + q)) % m + m) % m < m / 2;
    }
    function bar(warp, t, a, n, gap) {
      var f = t * C + T / 2, s = a * C, e = (a + n) * C - gap;
      return warp ? 'M' + f + ' ' + s + 'V' + e : 'M' + s + ' ' + f + 'H' + e;
    }
    function floats(warp) {
      var d = '', on = [], t, u, n, w;
      for (t = 0; t < r; t++) {
        for (u = 0; u < r; u++) on[u] = warp ? up(t, u) : !up(u, t);
        for (u = 0; u < r; u++) {
          if (!on[u] || on[(u + r - 1) % r]) continue;
          for (n = 1; n < r && on[(u + n) % r]; n++);
          w = u + n > r;
          d += bar(warp, t, u, w ? r - u : n, w ? 0 : E);
          if (w) d += bar(warp, t, 0, u + n - r, E);
        }
      }
      return d;
    }
    return [floats(true), floats(false)];
  }

  // The tile as a CSS value. Only the alpha of the drawing is used (it is a mask), so the stroke
  // is currentColor and the cloth takes its colour from the role tokens in styles.css. The warp
  // floats are full strength and the weft floats .35, which is what lets the diagonal read.
  function tile(r, d) {
    var s = r * C;
    return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + s + '\' height=\'' + s +
      '\'%3E%3Cg fill=\'none\' stroke=\'currentColor\' stroke-width=\'' + T + '\' shape-rendering=\'crispEdges\'%3E' +
      '%3Cpath stroke-opacity=\'.35\' d=\'' + d[1] + '\'/%3E%3Cpath d=\'' + d[0] + '\'/%3E%3C/g%3E%3C/svg%3E")';
  }

  // Seed -> one of the vetted cloths: a structure (diamond, herringbone either way, chevron
  // either way), a weave as [ends, m] (a 2/2 of 32 ends, a 4/4 of 16, a 3/3 of 24, a 4/4 of 24
  // or of 32, so the motif is 96 to 192px across) and a seeded phase.
  var SHAPES = [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]];
  var CLOTHS = [[16, 8], [24, 6], [24, 8], [32, 4], [32, 8]];
  function weave(seed) {
    var rnd = mulberry32(seed);
    var s = SHAPES[rnd() * SHAPES.length | 0];
    var c = CLOTHS[rnd() * CLOTHS.length | 0];
    var p = rnd() * c[0] | 0, q = rnd() * c[0] | 0;
    return tile(c[0], draft(c[0], s[0], s[1], c[1], p, q));
  }

  // The seed for this visit: the one kept, else a fresh draw, kept for the visit. Anything
  // stored that is not a plain number is discarded rather than trusted. If storage refuses
  // the write the visit still gets a cloth, a fresh one on each load of the page.
  function readSeed() {
    var s;
    try {
      s = sessionStorage.getItem(KEY);
      if (/^\d{1,10}$/.test(s) && +s <= 4294967295) return +s;
    } catch (e) { /* blocked: draw below, keep nothing */ }
    s = Math.floor(Math.random() * 4294967296);
    try { sessionStorage.setItem(KEY, String(s)); } catch (e) { /* not kept */ }
    return s;
  }

  root.style.setProperty('--weave-tile', weave(readSeed()));
})();
// bg:weave:end

// bg:sheet:begin
// Hero background 'sheet': no script. The headline's drafting sheet is pure CSS (styles.css, the block that
// starts "Hero background: the headline's drafting sheet"), so that it is also what the page shows without
// JavaScript or with blocked storage. Nothing here listens, schedules or stores anything.
// bg:sheet:end

// bg:dial:begin
// Hero background "dial": the pointer input for the vernier dial drawn in styles.css.
//
// When the dial is the visit's background (data-bg="dial", set by the draw above), the pointer turns
// grating B (the headline's ::after) about the circle's centre, up to 1.364deg either way (6px at the
// 252px bezel), so the beat between the two gratings slides along the arc and stops when the pointer
// stops. The turn is one paused Web Animation on the pseudo-element whose currentTime is scrubbed: the
// compositor holds the layer, and a write costs a small fraction of the style recalculation that a rule
// or custom property write does. No loop, no timer: a pointer move schedules a frame, and a few more
// follow only while B catches up with a pointer that jumped (at most 0.35 of its travel a frame). The
// theme toggle fires one sweep. It does nothing for any other draw, off the English home page, for
// touch, under prefers-reduced-motion or below 1200px; then the dial is the still scale.
(function () {
  if (document.documentElement.getAttribute('data-bg') !== 'dial') return;
  // The home page only, the same test as the headline preload above: no listener on any other page.
  if (!/\/(index\.html)?$/.test(window.location.pathname)) return;
  if (!window.matchMedia || !window.requestAnimationFrame) return;

  var BEZEL = 252;         // px: the bezel radius in assets/bg-dial-*.svg (tools/dial-masks.py --radius)
  var GAIN = 6 / BEZEL * 180 / Math.PI; // degrees at k = 1: 6px of travel at the bezel, 1.364
  var SLEW = 0.35;         // the most k may change in one frame

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 1200px)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var el = null;           // the headline, which owns the two pseudo-elements
  var header = null;
  var boxTop = null;       // the arc's top in the headline's own frame, in px, as styles.css puts it; read on first use, never before the first paint
  var anim = null;         // the paused animation that holds B's angle
  var failed = false;
  var width = 0;           // the window's width for the pointer's k, read on first use
  var cur = 0;             // k as last written, -1 to 1
  var target = 0;          // k the pointer asks for
  var pending = false;
  var sweeping = false;

  // 0 to 2000ms is -GAIN to +GAIN. An engine that ignores the pseudoElement
  // option would turn the whole headline, so check where the animation landed.
  function getAnim() {
    if (anim || failed) return anim;
    try {
      anim = el.animate(
        [{ rotate: -GAIN + 'deg' }, { rotate: GAIN + 'deg' }],
        { duration: 2000, easing: 'linear', fill: 'both', pseudoElement: '::after' }
      );
      if (!anim.effect || anim.effect.pseudoElement !== '::after') throw new Error('pseudoElement');
      anim.pause();
      anim.currentTime = (cur + 1) * 1000;
    } catch (e) {
      if (anim) anim.cancel();
      anim = null;
      failed = true;
    }
    return anim;
  }

  // A pseudo-element that goes away (the window narrower than 1200px, print, forced
  // colours) takes its animation with it for good, even though the animation still
  // reports itself paused: make a new one once it is back. Reduced motion going on
  // lets the dial come to rest.
  function reset() {
    if (anim) anim.cancel();
    anim = null;
    forget();
    if (still.matches) { cur = 0; target = 0; }
    else if (wide.matches) getAnim();
  }

  // The window's width and the used top of the arc are layout reads (innerWidth flushes style and layout), so
  // they wait for the first pointer move: a forced layout at DOMContentLoaded would hold up the first paint.
  // They are read again after a resize or a media change.
  function forget() {
    width = 0;
    boxTop = null;
  }

  function schedule() {
    if (!pending) {
      pending = true;
      window.requestAnimationFrame(frame);
    }
  }

  function frame() {
    pending = false;
    if (sweeping || !anim) return;
    var d = target - cur;
    cur = d > SLEW ? cur + SLEW : d < -SLEW ? cur - SLEW : target;
    anim.currentTime = (cur + 1) * 1000;
    if (cur !== target) schedule();
  }

  // The arc sits under the glass header once the page has scrolled far enough: turning B then would
  // make the header's backdrop blur again on every frame, so B is left alone while the two overlap.
  function underHeader() {
    if (boxTop === null) boxTop = parseFloat(window.getComputedStyle(el, '::after').top) || 0;
    return el.getBoundingClientRect().top + boxTop < (header ? header.getBoundingClientRect().bottom : 0);
  }

  function onMove(e) {
    if (e.pointerType === 'touch' || document.hidden || still.matches || !wide.matches) return;
    if (underHeader() || !getAnim()) return;
    if (!width) width = window.innerWidth;
    var k = (e.clientX / width) * 2 - 1;
    target = k < -1 ? -1 : k > 1 ? 1 : k;
    schedule();
  }

  // One sweep when the theme flips: a second animation over the first, from
  // the far end of B's travel (away from where it rests) back to where it
  // was, so there is no class to flip and no layout to force.
  function onToggle() {
    if (still.matches || document.hidden || !wide.matches || !getAnim()) return;
    var done = function () { sweeping = false; if (cur !== target) schedule(); };
    sweeping = true;
    el.animate(
      [{ rotate: (cur > 0 ? -GAIN : GAIN) + 'deg' }, { rotate: cur * GAIN + 'deg' }],
      { duration: 500, easing: 'cubic-bezier(0.2, 0, 0, 1)', pseudoElement: '::after' }
    ).finished.then(done, done);
  }

  function start() {
    // Only the English home page has the arc (styles.css: :lang(en)).
    el = document.querySelector('#home .hero__h1');
    if (!el || !/^en\b/i.test(document.documentElement.lang)) return;
    header = document.querySelector('.site-header');
    window.addEventListener('resize', forget, { passive: true });
    if (fine.matches) window.addEventListener('pointermove', onMove, { passive: true });
    ['(min-width: 1200px)', '(forced-colors: active)', '(prefers-contrast: more)', '(prefers-reduced-transparency: reduce)', '(prefers-reduced-motion: reduce)', 'print'].forEach(function (q) {
      var m = window.matchMedia(q);
      if (m.addEventListener) m.addEventListener('change', reset);
    });
    var toggle = document.querySelector('.theme-toggle');
    if (toggle) toggle.addEventListener('click', onToggle);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
// bg:dial:end

// bg:iris:begin
// Hero background "iris": after 20 seconds without input the English home hero opens the inner dial of its
// iris, once per visit (styles.css draws the art in both states; this only times the opening). It does
// nothing at all unless the iris is the background drawn for this visit. The first half runs in the
// blocking head and must set iris-armed before the first paint, or the dial would flash and then be
// erased. Any input ends the opening at once, settled. Storage is sessionStorage only: 'vynatix-bg-iris'
// is written when the opening starts, and 'vynatix-bg-iris-idle' is only ever read (a shorter silence, in
// milliseconds, for the checks; the site never writes it).
(function () {
  var root = document.documentElement;
  if (root.getAttribute('data-bg') !== 'iris') return;
  var KEY = 'vynatix-bg-iris';
  var IDLE_KEY = 'vynatix-bg-iris-idle';
  function mq(q) { return window.matchMedia(q).matches; }
  if (!window.matchMedia || !window.IntersectionObserver || !document.getAnimations) return;
  if (!/\/(index\.html)?$/.test(location.pathname)) return;   // the home page, as in the theme block
  if (!/^en/i.test(root.lang || '')) return;                   // English only: the art is in the English home hero

  var seen = true;   // blocked storage counts as seen, so the opening never replays on every page
  try { seen = sessionStorage.getItem(KEY) !== null; } catch (e) { /* seen */ }
  if (seen || !mq('(prefers-reduced-motion: no-preference)') || !mq('(min-width: 1280px)') ||
      mq('(forced-colors: active)') || mq('(prefers-reduced-transparency: reduce)') ||
      mq('(prefers-contrast: more)')) return;
  root.classList.add('iris-armed');

  function start() {
    var hero = document.querySelector('.hero');
    var header = document.querySelector('.site-header');
    var art = hero && hero.querySelector('.iris');
    var dial = art && art.querySelector('.iris__dial');
    if (!dial || !header || getComputedStyle(art).display === 'none') return;   // no art here

    var idle = 20000;
    try {
      var o = Number(sessionStorage.getItem(IDLE_KEY));
      if (o >= 200 && o <= 600000) idle = o;
    } catch (e) { /* default */ }

    var last = Date.now();
    var timer = 0, inView = true, held = false, playing = false, ended = false;
    var EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'];
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var io = new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].isIntersecting;
      sync();
    }, { threshold: 0 });

    // The art's own box (the part of the dial the page shows). On a short window only part of a tall
    // hero is in view. The box's top must clear the glass header, because a layer moving under it makes
    // the blur redo itself every frame, and at least half of it must be on screen.
    function artBox() {
      if (getComputedStyle(art).display === 'none') return null;
      var r = art.getBoundingClientRect();
      return r.height > 0 ? r : null;
    }
    function clear(b) { return b.top >= header.getBoundingClientRect().bottom + 8; }

    // Any input: a running opening ends on the spot and the settled dial stays.
    function onInput() {
      last = Date.now();
      if (playing && !ended) finish();
    }

    function sync() {
      var hold = document.visibilityState !== 'visible' || !inView;
      root.classList.toggle('iris-hold', hold);
      if (held && !hold) last = Date.now();   // coming back starts a fresh silent window
      held = hold;
    }

    function check() {
      timer = 0;
      var wait = idle - (Date.now() - last);
      if (wait > 50) { timer = setTimeout(check, wait); return; }
      var b = document.visibilityState === 'visible' && inView && artBox();
      if (b && clear(b) && Math.min(b.bottom, window.innerHeight) - Math.max(b.top, 0) >= 0.5 * b.height) { play(); return; }
      last = Date.now();                // a condition failed: a fresh silent window
      timer = setTimeout(check, idle);
    }

    function play() {
      playing = true;
      // The flag goes down as the opening starts: someone who leaves at two seconds has seen it
      // begin, and the next view is still.
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* the head check treats a throw as seen */ }
      dial.addEventListener('animationend', onEnd);
      dial.addEventListener('animationcancel', onEnd);
      root.classList.add('iris-play');
    }

    function onEnd(e) { if (e.animationName === 'iris-open') finish(); }

    function finish() {
      if (ended) return;
      ended = true;
      root.classList.add('iris-done');          // the settled dial in styles.css takes over
      root.classList.remove('iris-play', 'iris-hold');
      clearTimeout(timer);
      io.disconnect();
      EVENTS.forEach(function (n) { window.removeEventListener(n, onInput, true); });
      document.removeEventListener('visibilitychange', sync);
      dial.removeEventListener('animationend', onEnd);
      dial.removeEventListener('animationcancel', onEnd);
      if (reduce.removeEventListener) reduce.removeEventListener('change', onReduce);
    }

    // The visitor switches motion off mid-opening: stop where we are, settled.
    function onReduce() { if (reduce.matches) finish(); }

    EVENTS.forEach(function (n) { window.addEventListener(n, onInput, { passive: true, capture: true }); });
    document.addEventListener('visibilitychange', sync);
    if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
    io.observe(hero);
    timer = setTimeout(check, idle);
  }

  function later() {
    try {
      if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 2000 });
      else setTimeout(start, 200);
    } catch (e) { /* the dial simply stays unrevealed */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later);
  else later();
})();
// bg:iris:end
