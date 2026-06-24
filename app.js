// Theme toggle — light/dark, persisted, respects OS preference.
(function () {
  var root = document.documentElement;
  var STORAGE_KEY = 'vynatix-theme';

  function labelFor(theme) {
    return theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }

  function applyTheme(theme, button) {
    root.setAttribute('data-theme', theme);
    if (button) {
      button.setAttribute('aria-label', labelFor(theme));
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    }
  }

  function preferredTheme() {
    var stored;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      stored = null;
    }
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function init() {
    var button = document.querySelector('.theme-toggle');
    applyTheme(preferredTheme(), button);
    if (!button) return;

    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, button);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {
        /* storage unavailable — toggle still works for the session */
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Case reel — wire the Previous/Next controls to scroll one card at a time.
(function () {
  function stepFor(reel) {
    var card = reel.querySelector('.reel__card');
    if (!card) return reel.clientWidth;
    var gap = parseFloat(getComputedStyle(reel).columnGap || getComputedStyle(reel).gap) || 0;
    return card.getBoundingClientRect().width + gap;
  }

  function wire(controls) {
    var wrap = controls.closest('.reel-wrap');
    var reel = wrap && wrap.querySelector('.reel');
    if (!reel) return;

    var buttons = controls.querySelectorAll('.reel__btn');
    var prev = buttons[0];
    var next = buttons[1];

    function scrollByCards(dir) {
      reel.scrollBy({ left: dir * stepFor(reel), behavior: 'smooth' });
    }

    if (prev) prev.addEventListener('click', function () { scrollByCards(-1); });
    if (next) next.addEventListener('click', function () { scrollByCards(1); });
  }

  function init() {
    var controls = document.querySelectorAll('.reel__controls');
    for (var i = 0; i < controls.length; i++) wire(controls[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
