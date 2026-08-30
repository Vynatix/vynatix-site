// Theme toggle — light/dark, persisted, respects OS preference.
(function () {
  var root = document.documentElement;
  var STORAGE_KEY = 'vynatix-theme';

  function labelFor(theme) {
    return theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }

  function applyTheme(theme, button) {
    root.setAttribute('data-theme', theme);
    // Keep the browser chrome colour matching what is actually rendered.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D2A2C' : '#F3F0E9');
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

    // Opt into the collapsible mobile nav. Without this class the nav stays
    // visible and wrapped, so a no-JS visitor on a phone still has every link.
    document.documentElement.classList.add('js-nav');

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

    // The arrows are hidden in CSS until they actually work; the reel itself
    // scrolls natively without them.
    controls.classList.add('is-ready');
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

// Client marquee — pause/play control. WCAG 2.2.2 asks for a mechanism to stop
// motion that starts on its own and runs for more than five seconds. The button
// is hidden in CSS until this runs, so it never sits dead for no-JS visitors.
(function () {
  function init() {
    var marquee = document.querySelector('.marquee');
    if (!marquee) return;
    var track = marquee.querySelector('.marquee__track');
    var toggle = marquee.querySelector('.marquee__toggle');
    if (!track || !toggle) return;

    toggle.classList.add('is-ready');

    toggle.addEventListener('click', function () {
      var paused = track.classList.toggle('is-paused');
      toggle.classList.toggle('is-paused', paused);
      // aria-pressed carries the state; the label stays constant so the two
      // never contradict each other ("Resume…, pressed" reads as nonsense).
      toggle.setAttribute('aria-pressed', String(paused));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
