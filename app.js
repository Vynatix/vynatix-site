// Site script. Three features, each in its own block below: the theme (a
// colour scheme drawn at random for each visit), the mobile nav, and consent
// for Google Analytics. The analytics block does nothing until the visitor
// presses Accept on the consent bar, and it is inert (no markup, no storage
// access, no listeners) while the measurement ID is still the placeholder.
//
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

// Consent and analytics: Google Analytics 4, loaded only after an explicit Accept.
//
// Nothing from Google is requested, and no Google cookie is set, until the
// visitor accepts: not a script, not a preconnect hint, not a beacon. The first
// visit shows a compact bar fixed to the bottom of the viewport with two
// identical buttons, Decline and Accept. The choice is kept in localStorage as
// one plain string (version, choice, UTC date) that lasts a year; anything that
// does not parse exactly, or is expired, is treated as no choice at all, so a
// damaged value fails closed. Browsing is never taken as consent, and a
// visitor whose storage is blocked gets no bar and no analytics rather than a
// button that could not remember its answer.
//
// Withdrawing is as easy as agreeing: the footer's "Cookie settings" link
// reopens the same bar, and the privacy pages carry the same two buttons in
// place. Declining or withdrawing turns Google's own switch off, tells gtag the
// storage is denied, and deletes the _ga cookies for the host and for every
// parent domain. Because a page can sit in the back/forward cache or in another
// tab, the stored choice is read again when a tab is restored, becomes visible
// again, or another tab writes it.
//
// While GA_ID below is the placeholder this block returns before doing
// anything, so the site ships with analytics fully off. To switch it on, put
// the real measurement ID in the first line and nothing else. The Content
// Security Policy on every page has to name the hosts gtag needs (script-src
// pinned to /gtag/js, and connect-src for the beacons); see EDGE-SETUP.md.
(function () {
  var GA_ID = 'G-XXXXXXXXXX';
  var PLACEHOLDER = 'G-XXXXXXXXXX';
  var CONSENT_KEY = 'vynatix-consent';  // localStorage: v1:granted:YYYY-MM-DD or v1:denied:YYYY-MM-DD
  var POLICY_VERSION = 'v1';            // bump when the wording of the choice changes, so old answers lapse
  var CONSENT_MAX_DAYS = 365;           // how long an answer is kept before the bar asks again
  var COOKIE_MAX_AGE = 31536000;        // the _ga cookie lifetime, 365 days in seconds, never past the consent period
  var DAY_MS = 86400000;
  var GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=';
  // Both buttons share this one class string. Decline and Accept must look
  // exactly alike, so there is no variant per button. The filled default is used
  // rather than the outlined one: it keeps the widest contrast margins in all
  // six themes, and its hover (a brightness shift) does not depend on the bar's
  // surface the way the outlined hover fill does.
  var BUTTON_CLASS = 'btn consent__btn';

  // The wording, in the language of the page (Swedish when <html lang> starts
  // with sv). The bar's own text has to stand alone, because a privacy page
  // cached from before a deploy can sit beside a newer bar for a few minutes.
  var COPY = {
    en: {
      label: 'Analytics cookies',
      text: 'We count visits with Google Analytics cookies, only if you accept. Change this any time under Cookie settings in the footer.',
      notice: 'Privacy notice',
      noticeHref: 'privacy.html#cookies',
      decline: 'Decline',
      accept: 'Accept',
      declineLabel: 'Decline analytics cookies',
      acceptLabel: 'Accept analytics cookies',
      on: 'Analytics is on.',
      off: 'Analytics is off.',
      undecided: 'Your choice has not been made yet.',
      liveOn: 'Analytics turned on.',
      liveOff: 'Analytics turned off.',
      saveFail: 'Your choice could not be saved, so analytics stays off.',
      footer: 'Cookie settings'
    },
    sv: {
      label: 'Cookies för statistik',
      text: 'Vi räknar besök med Google Analytics-cookies, bara om ni godkänner. Ändra under Cookie-inställningar i sidfoten.',
      notice: 'Integritetsmeddelande',
      noticeHref: 'integritet.html#cookies',
      decline: 'Avböj',
      accept: 'Godkänn',
      declineLabel: 'Avböj cookies för statistik',
      acceptLabel: 'Godkänn cookies för statistik',
      on: 'Statistik är påslagen.',
      off: 'Statistik är avstängd.',
      undecided: 'Ni har inte gjort något val än.',
      liveOn: 'Statistik slogs på.',
      liveOff: 'Statistik stängdes av.',
      saveFail: 'Ert val kunde inte sparas, så statistiken förblir avstängd.',
      footer: 'Cookie-inställningar'
    }
  };

  // Inert: with the placeholder (or anything that is not a GA4 ID) there is no
  // markup, no storage access, no listener and no class on <html>.
  if (GA_ID === PLACEHOLDER || !/^G-[A-Z0-9]{6,12}$/.test(GA_ID)) return;

  var root = document.documentElement;
  var DISABLE_FLAG = 'ga-disable-' + GA_ID;   // Google's own off switch, read by gtag.js
  var CHOICE_PATTERN = new RegExp('^' + POLICY_VERSION + ':(granted|denied):(\\d{4})-(\\d{2})-(\\d{2})$');

  var current = null;      // the choice this page is showing: 'granted', 'denied' or null
  var injected = false;    // gtag.js has been added to this page
  var bar = null;          // the bar while it is on screen
  var reopened = false;    // the bar was opened from the footer, not shown on a first visit
  var opener = null;       // the footer link that opened it, to hand focus back to
  var live = null;         // the visually hidden status node
  var interactive = false; // storage was readable at load, so the bar, the link and the panels work

  function lang() {
    return /^sv/i.test(root.lang || '') ? 'sv' : 'en';
  }

  // The stored choice, or null for "not decided". The date has to be a real
  // calendar day, not in the future, and at most CONSENT_MAX_DAYS old.
  function parseChoice(raw) {
    if (typeof raw !== 'string') return null;
    var m = CHOICE_PATTERN.exec(raw);
    if (!m) return null;
    var y = +m[2], mo = +m[3], d = +m[4];
    var t = Date.UTC(y, mo - 1, d);
    var back = new Date(t);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
    var now = new Date();
    var today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    var age = (today - t) / DAY_MS;
    if (!isFinite(age) || age < 0 || age > CONSENT_MAX_DAYS) return null;
    return m[1];
  }

  // Reads the stored choice. Unreadable storage (blocked, or throwing) is
  // reported as such, so the page can show no bar instead of a dead one.
  function readStored() {
    try {
      return { readable: true, choice: parseChoice(localStorage.getItem(CONSENT_KEY)) };
    } catch (e) {
      return { readable: false, choice: null };
    }
  }

  // Writes the choice with today's UTC date and reads it back, because some
  // browsers accept a write they then drop. Returns whether it stuck.
  function store(choice) {
    var value = POLICY_VERSION + ':' + choice + ':' + new Date().toISOString().slice(0, 10);
    try {
      localStorage.setItem(CONSENT_KEY, value);
      if (localStorage.getItem(CONSENT_KEY) === value) return true;
    } catch (e) {
      /* the write failed; fall through to clearing any older answer */
    }
    // An earlier grant must not outlive a choice that could not be recorded.
    try { localStorage.removeItem(CONSENT_KEY); } catch (e) { /* nothing more to do */ }
    return false;
  }

  // --- Cookies ------------------------------------------------------------

  // The domains a _ga cookie could have been written for: the host alone ('')
  // and every parent that still has two labels, each with and without the
  // leading dot (www.vynatix.com gives www.vynatix.com and vynatix.com). An IP
  // address has no parents.
  function cookieDomains() {
    var host = location.hostname;
    var out = [];
    if (!host || /^[\d.]+$/.test(host) || host.indexOf(':') >= 0) return out;
    var labels = host.split('.');
    for (var i = 0; i <= labels.length - 2; i++) {
      var d = labels.slice(i).join('.');
      out.push(d, '.' + d);
    }
    return out;
  }

  function expireCookie(name, domainPart) {
    try {
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + domainPart;
    } catch (e) {
      /* cookies unavailable: nothing to delete */
    }
  }

  // Deletes every cookie named _ga or starting _ga_ (the client ID and the
  // per-property session cookie), for the host and each parent domain. Any
  // other cookie is left alone.
  function purgeCookies() {
    var names = [];
    try {
      document.cookie.split(';').forEach(function (part) {
        var name = part.split('=')[0].replace(/^\s+|\s+$/g, '');
        if (name === '_ga' || name.indexOf('_ga_') === 0) names.push(name);
      });
    } catch (e) {
      return;
    }
    var domains = cookieDomains();
    names.forEach(function (name) {
      expireCookie(name, '');
      domains.forEach(function (d) { expireCookie(name, '; domain=' + d); });
    });
  }

  // --- Analytics ----------------------------------------------------------

  function gtag() {
    window.dataLayer.push(arguments);    // gtag.js reads Arguments objects, not arrays
  }

  // Loads gtag.js and starts measuring. Safe to call again: once the script is
  // on the page it only clears the off switch after a withdrawal and tells gtag
  // the storage is granted again.
  function loadAnalytics() {
    var wasOff = window[DISABLE_FLAG] === true;
    window[DISABLE_FLAG] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = gtag;
    if (injected) {
      if (!wasOff) return;
      gtag('consent', 'update', { analytics_storage: 'granted' });
      gtag('config', GA_ID, configOptions());
      return;
    }
    injected = true;
    gtag('consent', 'default', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = GTAG_SRC + encodeURIComponent(GA_ID);
    document.head.appendChild(script);
    gtag('js', new Date());
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('config', GA_ID, configOptions());
  }

  function configOptions() {
    return {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: COOKIE_MAX_AGE
    };
  }

  // Runs only while the off switch is still set, so a visitor who declines and
  // then accepts again within the second is not stripped of the new cookies.
  function purgeIfOff() {
    if (window[DISABLE_FLAG] === true) purgeCookies();
  }

  // Stops measuring: Decline, withdrawal, a refusal made in another tab, or a
  // restored page whose choice was revoked meanwhile. gtag may write one more
  // cookie as it winds down, so the cookies are cleared again a second later
  // and once more as the page is left.
  function revoke() {
    window[DISABLE_FLAG] = true;
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
    purgeCookies();
    setTimeout(purgeIfOff, 1000);
    window.addEventListener('pagehide', purgeIfOff, { once: true });
  }

  // --- Building blocks ----------------------------------------------------

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function choiceButton(choice, c) {
    var granted = choice === 'granted';
    var button = make('button', BUTTON_CLASS, granted ? c.accept : c.decline);
    button.type = 'button';
    button.setAttribute('data-consent-choice', choice);
    button.setAttribute('aria-label', granted ? c.acceptLabel : c.declineLabel);
    return button;
  }

  // The two buttons, Decline first, in the bar and in the privacy-page panel.
  function appendChoices(container, c) {
    container.appendChild(choiceButton('denied', c));
    container.appendChild(choiceButton('granted', c));
  }

  function statusText(c) {
    if (current === 'granted') return c.on;
    if (current === 'denied') return c.off;
    return c.undecided;
  }

  // Tells assistive technology what just happened. The node exists from the
  // start, so the first message is announced, and it is emptied before it is
  // filled, which gives a repeated message the best chance of being read again.
  function announce(message) {
    if (!live) return;
    live.textContent = '';
    live.textContent = message;
  }

  // --- The bar ------------------------------------------------------------

  function buildBar(showStatus) {
    var l = lang();
    var c = COPY[l];
    var section = make('section', 'consent');
    section.id = 'consent-bar';
    section.setAttribute('aria-label', c.label);
    section.setAttribute('lang', l);
    section.setAttribute('data-nosnippet', '');

    var text = make('p', 'consent__text', c.text + ' ');
    var link = make('a', 'consent__link', c.notice);
    link.href = c.noticeHref;
    text.appendChild(link);
    section.appendChild(text);

    if (showStatus) section.appendChild(make('p', 'consent__status', statusText(c)));

    var actions = make('div', 'consent__actions');
    appendChoices(actions, c);
    section.appendChild(actions);

    // Escape puts a reopened bar away without changing the choice. The listener
    // sits on the bar itself, so it runs before the document-level one that
    // closes the mobile menu, and while that menu is open the menu owns Escape.
    section.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !reopened) return;
      var nav = document.querySelector('.site-header__nav');
      if (nav && nav.classList.contains('open')) return;
      var hadFocus = bar && bar.contains(document.activeElement);
      hideBar();
      if (hadFocus) returnFocus();
    });
    return section;
  }

  function firstButton() {
    return bar && bar.querySelector('[data-consent-choice]');
  }

  // Puts the bar second in <body>, straight after the skip link, so the skip
  // link stays the first Tab stop and the bar's buttons come early in the tab
  // order. A first visit does not take focus; a reopened bar does, because the
  // visitor asked for it.
  function showBar(isReopen) {
    reopened = isReopen;
    bar = buildBar(isReopen && current !== null);
    var skip = document.querySelector('.skip-link');
    var before = skip && skip.parentNode === document.body ? skip.nextSibling : document.body.firstChild;
    document.body.insertBefore(bar, before);
    root.classList.add('consent-open');
    if (isReopen) firstButton().focus();
  }

  function hideBar() {
    if (!bar) return;
    if (bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    reopened = false;
    root.classList.remove('consent-open');
  }

  function returnFocus() {
    var target = opener;
    opener = null;
    if (target && document.body.contains(target)) target.focus();
  }

  // The footer link: reopen the bar with the current state, or, when it is
  // already open, bring focus back to it.
  function openFromLink(link) {
    var stored = readStored();
    if (!stored.readable) return false;
    current = stored.choice;
    opener = link;
    if (bar) {
      firstButton().focus();
    } else {
      showBar(true);
    }
    renderPanels();
    return true;
  }

  // --- The in-page panel (privacy pages) ----------------------------------

  // Fills each [data-consent-panel] once with a status line and the two
  // buttons, then only refreshes the status, so a button that has focus keeps
  // it. Also keeps a reopened bar's status line current.
  function renderPanels() {
    var c = COPY[lang()];
    var panels = document.querySelectorAll('[data-consent-panel]');
    for (var i = 0; i < panels.length; i++) {
      var panel = panels[i];
      var status = panel.querySelector('.consent-panel__status');
      if (!status) {
        status = make('p', 'consent-panel__status');
        panel.appendChild(status);
        var actions = make('div', 'consent-panel__actions');
        appendChoices(actions, c);
        panel.appendChild(actions);
      }
      status.textContent = statusText(c);
    }
    var barStatus = bar && bar.querySelector('.consent__status');
    if (barStatus) barStatus.textContent = statusText(c);
  }

  // The footer link reads "Cookie settings" in the markup. On a Swedish page it
  // becomes the Swedish label and points at the Swedish notice. Without this
  // script (or while it is inert) the English link to the English notice stays.
  function relabelOpeners() {
    if (lang() !== 'sv') return;
    var links = document.querySelectorAll('[data-consent-open]');
    for (var i = 0; i < links.length; i++) {
      links[i].textContent = COPY.sv.footer;
      links[i].setAttribute('lang', 'sv');
      links[i].setAttribute('href', COPY.sv.noticeHref);
    }
  }

  // --- Making a choice ----------------------------------------------------

  function choose(choice) {
    if (choice !== 'granted' && choice !== 'denied') return;
    var c = COPY[lang()];
    var saved = store(choice);
    // A choice that cannot be remembered is not acted on as consent.
    current = saved ? choice : 'denied';
    if (current === 'granted') loadAnalytics(); else revoke();
    var hadFocus = bar && bar.contains(document.activeElement);
    var wasReopen = reopened;
    hideBar();
    renderPanels();
    announce(!saved ? c.saveFail : current === 'granted' ? c.liveOn : c.liveOff);
    // A first-visit choice moves focus nowhere. A reopened bar was asked for,
    // so its focus goes back to the link that asked.
    if (wasReopen && hadFocus) returnFocus();
  }

  // Re-reads the stored choice when the page may be out of date: restored from
  // the back/forward cache, shown again, or written by another tab. Anything but
  // a grant stops measuring here, and a decision made elsewhere closes a
  // first-visit bar that is still waiting.
  function recheck() {
    var stored = readStored();
    current = stored.choice;
    if (current !== 'granted') revoke();
    if (!interactive) return;
    if (current !== null && bar && !reopened) hideBar();
    renderPanels();
  }

  function onClick(e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var link = target.closest('[data-consent-open]');
    if (link) {
      // Only a plain left click opens the bar; a modified click or a middle
      // click keeps its normal job of following the link.
      if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && openFromLink(link)) {
        e.preventDefault();
      }
      return;
    }
    var button = target.closest('[data-consent-choice]');
    if (button) choose(button.getAttribute('data-consent-choice'));
  }

  function init() {
    root.classList.add('js-consent');
    relabelOpeners();
    live = make('p', 'sr-only');
    live.id = 'consent-live';
    live.setAttribute('role', 'status');
    document.body.appendChild(live);

    var stored = readStored();
    current = stored.choice;
    if (current === 'granted') loadAnalytics(); else purgeCookies();
    // Blocked storage: analytics stays off and nothing is offered that could
    // not be remembered. The footer link then simply goes to the notice.
    interactive = stored.readable;
    if (interactive) {
      if (current === null) showBar(false);
      renderPanels();
      document.addEventListener('click', onClick);
    }
    window.addEventListener('storage', function (e) {
      if (e.key === null || e.key === CONSENT_KEY) recheck();
    });
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) recheck();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') recheck();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
