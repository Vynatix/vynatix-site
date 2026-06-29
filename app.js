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

// Mobile nav — toggle the menu open/closed from the hamburger button.
(function () {
  function init() {
    var toggle = document.querySelector('.mobile-toggle');
    var nav = document.querySelector('.site-header__nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    // Close the menu after following a link.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('.site-header__link')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
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

// Case reel — edge-fade only while scrolling. At rest the card edges are sharp;
// a debounced class toggle re-hides the mask once scroll-snap settles. With no JS
// the mask is never applied, so the (correct) sharp-edged rest state is the default.
(function () {
  var SETTLE_MS = 200; // ~--dur-micro; outlasts the smooth-scroll snap

  function wire(reel) {
    var timer = null; // per-reel debounce id, kept in this closure
    reel.addEventListener('scroll', function () {
      reel.classList.add('is-scrolling');
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        reel.classList.remove('is-scrolling');
        timer = null;
      }, SETTLE_MS);
    }, { passive: true });
  }

  function init() {
    var reels = document.querySelectorAll('.reel');
    for (var i = 0; i < reels.length; i++) wire(reels[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
