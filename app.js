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
