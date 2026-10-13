// Theme toggle — light or dark within the page's brand direction, persisted.
//
// The design system has six themes over one set of colour roles: Forest
// (light, dark), Teal (teal-light, teal-dark) and Monochrome (mono-light,
// mono-dark). The page's <html data-theme> names the direction the site ships
// in; this toggle only flips between that direction's light and dark theme.
// The stored value is the full theme id, but only its light/dark half is read
// back, so a choice made while the site was one direction still applies if
// the site is later moved to another.
(function () {
  var root = document.documentElement;
  var STORAGE_KEY = 'vynatix-theme';
  var THEMES = ['light', 'dark', 'teal-light', 'teal-dark', 'mono-light', 'mono-dark'];
  // The canvas of each theme (md-sys-color-surface), used for the browser
  // chrome colour if the rendered background cannot be read.
  var CANVAS = {
    'light': '#EFE8DA', 'dark': '#1B1A16',
    'teal-light': '#F3F0E9', 'teal-dark': '#0D2A2C',
    'mono-light': '#F5F1EA', 'mono-dark': '#14110F'
  };

  function isDark(theme) { return /(^|-)dark$/.test(theme); }
  // '' for Forest, 'teal-' or 'mono-' for the other directions.
  function direction(theme) {
    var i = theme.indexOf('-');
    return i < 0 ? '' : theme.slice(0, i + 1);
  }
  function pageDirection() {
    var current = root.getAttribute('data-theme') || 'light';
    return THEMES.indexOf(current) >= 0 ? direction(current) : '';
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

  function preferredTheme() {
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      stored = null;
    }
    var dark;
    if (THEMES.indexOf(stored) >= 0) {
      dark = isDark(stored);
    } else {
      dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return pageDirection() + (dark ? 'dark' : 'light');
  }

  function init() {
    var button = document.querySelector('.theme-toggle');
    applyTheme(preferredTheme(), button);
    if (!button) return;
    // The toggle is invisible until it can work (styles.css), the same opt-in
    // the mobile nav uses, so it never sits dead for a no-JS visitor.
    root.classList.add('js-theme');

    button.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') || 'light';
      var next = direction(current) + (isDark(current) ? 'light' : 'dark');
      applyTheme(next, button);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {
        /* storage unavailable — the toggle still works for the session */
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
