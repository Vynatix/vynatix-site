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
