// Site script. Four features, each in its own block below: the theme (the
// Monochrome scheme, light or dark), the mobile nav, the silk
// background's drift and its pause button, and last (tools/verify/consent.js
// cuts the file there for its baseline, so it stays last) consent for Google
// Analytics. The analytics block does nothing until the visitor has
// accepted on the consent bar (a stored Accept from an earlier visit counts),
// and it is inert (no markup, no storage access, no listeners) while the
// measurement ID is still the placeholder.
//
// Theme — one colour scheme, Monochrome, light or dark.
//
// The design system has three brand directions (Forest, Teal, Monochrome),
// each with a light and a dark theme. The site uses Monochrome only
// (mono-light, mono-dark), set with the Liquid Glass surfaces in styles.css.
// Light or dark follows the visitor's own choice from the toggle
// (localStorage) and, without one, their operating-system preference.
//
// This file loads in the <head>, without defer, so the first block below sets
// data-theme before the page paints. The CSP rules out an inline script, so a
// small blocking file is the way to avoid a flash of the wrong theme. Without
// JavaScript the page keeps the Monochrome light theme its markup names.
(function () {
  var root = document.documentElement;
  var THEME_KEY = 'vynatix-theme';  // localStorage: the visitor's light/dark choice
  // Every id the toggle has ever stored is still read, for its light/dark half
  // only, so a visitor who chose dark before the site went Monochrome keeps it.
  var THEMES = ['light', 'dark', 'teal-light', 'teal-dark', 'mono-light', 'mono-dark'];
  // The canvas of each theme (md-sys-color-surface), for the browser chrome
  // colour before the body exists to be measured.
  var CANVAS = { 'mono-light': '#F5F1EA', 'mono-dark': '#14110F' };
  // The display face and its italic (the hero's accent line), in fonts/ as
  // <name>-latin.woff2.
  var DISPLAY_FACES = ['geist-variable', 'fraunces-italic-variable'];

  function isDark(theme) { return /(^|-)dark$/.test(theme); }

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
    return CANVAS[theme] || CANVAS['mono-light'];
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
  // in the display face and one in its italic; fetch both now rather than
  // after the stylesheet names them.
  function preloadHeadlineFaces() {
    if (!/\/(index\.html)?$/.test(location.pathname) || !document.head) return;
    DISPLAY_FACES.forEach(function (name) {
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = 'fonts/' + name + '-latin.woff2';
      document.head.appendChild(link);
    });
  }

  // First paint: set the theme before anything renders.
  applyTheme(wantsDark() ? 'mono-dark' : 'mono-light', null);
  preloadHeadlineFaces();

  // After the page is parsed: wire the toggle and settle the chrome colour
  // from the rendered background.
  function init() {
    var button = document.querySelector('.theme-toggle');
    applyTheme(root.getAttribute('data-theme') || 'mono-light', button);
    if (!button) return;
    // The toggle is invisible until it can work (styles.css), the same opt-in
    // the mobile nav uses, so it never sits dead for a no-JS visitor.
    root.classList.add('js-theme');

    button.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') || 'mono-light';
      var next = isDark(current) ? 'mono-light' : 'mono-dark';
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
  // Opt into the collapsible mobile nav at once, here in the blocking head, so a phone
  // never paints the wrapped no-JS nav first and then collapses it (on a slow load that
  // moved the whole page about 115px under the reader). Without this class the nav stays
  // visible and wraps, so a no-JS visitor on a phone still has every link. init() takes
  // the class back off on a page with no menu button or nav, so no control sits dead.
  document.documentElement.classList.add('js-nav');

  // The listeners are delegated from the document and registered here too, so the menu
  // button works from the moment it is painted, not only once the page has been parsed.
  function parts() {
    return { toggle: document.querySelector('.mobile-toggle'), nav: document.querySelector('.site-header__nav') };
  }
  function setOpen(p, open) {
    p.nav.classList.toggle('open', open);
    p.toggle.setAttribute('aria-expanded', String(open));
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var p = parts();
    if (!p.toggle || !p.nav) return;
    if (t.closest('.mobile-toggle')) {
      setOpen(p, !p.nav.classList.contains('open'));
    } else if (t.closest('.site-header__nav .site-header__link')) {
      // Close the menu after following a link.
      setOpen(p, false);
    }
  });

  // Escape closes the menu and hands focus back to the button.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var p = parts();
    if (p.toggle && p.nav && p.nav.classList.contains('open')) {
      setOpen(p, false);
      p.toggle.focus();
    }
  });

  function init() {
    var p = parts();
    if (!p.toggle || !p.nav) document.documentElement.classList.remove('js-nav');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Silk waves — the page background is drawn live, and the visitor can stop it.
//
// styles.css paints a still silk behind every page (two soft layers of folds,
// body::before and body::after). When motion is wanted, this block lays a
// <canvas> over that still silk and draws the folds itself, frame by frame, in
// a small WebGL shader: the folds are computed, so they form, lean and dissolve
// rather than slide past as a picture would. The cloth also answers the
// visitor: it gives way softly around the pointer and rides with the scroll
// (listeners exist only while the canvas does). The three colours are read from
// the page (the canvas colour and the two silk layers' own), so the shader
// follows the theme and uses no colour of its own.
//
// The still silk is every other state, and no canvas exists in any of them:
// no JavaScript, prefers-reduced-motion, forced colours, a stored pause, a
// browser without WebGL, or a lost WebGL context. The footer's "Pause
// background motion" button (hidden until js-motion says it can work) stops
// the drawing and removes the canvas; the choice is kept in localStorage so
// every page agrees. Any stored value but "off" means moving. The phase comes
// from the clock, so the pattern carries on across pages instead of restarting.
(function () {
  var root = document.documentElement;
  var MOTION_KEY = 'vynatix-motion';  // localStorage: "off" once paused, "on" once resumed
  var LABEL = { on: 'Pause background motion', off: 'Play background motion' };
  var LOOP_MS = 240000;               // the whole pattern repeats seamlessly after four minutes
  var MAX_PIXELS = 1300000;           // the drawing buffer is capped; the silk is soft, so CSS scales it up unseen
  var quiet = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)') : null;
  var button = null, canvas = null, gl = null, uniforms = null, watcher = null;
  var frameId = 0, lastDraw = 0, unusable = false;
  // What the silk answers to: the pointer (where it is, and how strongly it presses: 1 while it is over the
  // page, 0 once it has left) and how far the page has scrolled. Each has a target, set by the listeners, and a
  // current value that the frame loop eases towards it, so the cloth never jumps.
  var want = { x: 0.5, y: 0.5, press: 0, scroll: 0 };
  var have = { x: 0.5, y: 0.5, press: 0, scroll: 0 };

  var VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  // Two sine fields make the folds, and three passes of warping, each finer
  // and on its own slow beat, bend the space they are drawn in: that is what
  // makes the cloth swirl and pour like liquid instead of sliding. Where the
  // fields' sum is high the cloth catches the light, where it is low it falls
  // into shade. Every time term is
  // a whole multiple of one angle, so the pattern loops without a seam. The
  // last lines add up to one level of noise per pixel, which keeps the 8-bit
  // output from showing each brightness level as a stripe (colour banding).
  var FRAGMENT = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 size;uniform float a;uniform vec3 c0;uniform vec3 c1;uniform vec3 c2;uniform vec3 m;uniform float s;',
    'void main(){',
    'vec2 u=gl_FragCoord.xy/size.y;',
    'vec2 dm=u-m.xy;float f=m.z*exp(-dot(dm,dm)*7.);',   // the pointer: a soft press, about a third of the view across
    'u+=dm*f*.4;u.y+=s;',                                // the cloth gives way around it, and rides with the scroll
    'vec2 q=vec2(u.x*.9-u.y*.44,u.x*.44+u.y*.9)*vec2(.8,2.3);',
    'q+=.28*vec2(sin(q.y*1.5+a*7.),cos(q.x*1.8-a*5.));',
    'q+=.17*vec2(sin(q.y*2.9-a*11.+1.3),cos(q.x*2.6+a*8.+.6));',
    'q+=.09*vec2(sin(q.y*5.1+a*13.+2.1),cos(q.x*4.7-a*9.+4.));',
    'float w=.6*sin(q.y*3.1+q.x*.9+a*6.)+.4*sin(q.y*5.3-q.x*1.7-a*10.+2.)+.5*f;',
    'float l=smoothstep(0.,1.,w);float d=smoothstep(0.,1.,-w);',
    'vec3 c=mix(c0,c1,.9*l*l);',
    'c=mix(c,c2,.8*d*d);',
    'vec2 g=mod(gl_FragCoord.xy,vec2(251.,241.));',
    'c+=(fract(sin(dot(g,vec2(12.9898,78.233)))*43758.5453)-.5)/127.5;',
    'gl_FragColor=vec4(c,1.);}'
  ].join('\n');

  function stored() {
    try { return localStorage.getItem(MOTION_KEY); } catch (e) { return null; }
  }
  function label(moving) {
    root.classList.toggle('js-waves', moving);
    if (button) button.textContent = moving ? LABEL.on : LABEL.off;
  }

  // "rgb(245, 241, 234)" or "color(srgb 0.94 0.92 0.88)" to three numbers from 0 to 1.
  function tone(text) {
    var n = (text || '').match(/-?\d*\.?\d+(?:e-?\d+)?/g);
    if (!n || n.length < 3) return null;
    var unit = /^color\(/.test(text) ? 1 : 255;
    return [n[0] / unit, n[1] / unit, n[2] / unit];
  }
  function readTones() {
    if (!gl || !document.body) return false;
    var c0 = tone(getComputedStyle(document.body).backgroundColor);
    var c1 = tone(getComputedStyle(document.body, '::before').backgroundColor);
    var c2 = tone(getComputedStyle(document.body, '::after').backgroundColor);
    if (!c0 || !c1 || !c2) return false;
    gl.uniform3f(uniforms.c0, c0[0], c0[1], c0[2]);
    gl.uniform3f(uniforms.c1, c1[0], c1[1], c1[2]);
    gl.uniform3f(uniforms.c2, c2[0], c2[1], c2[2]);
    return true;
  }
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var k = Math.min(1, Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uniforms.size, w, h);
  }
  // Eased by elapsed time, not by frame count, so it feels the same at 60 and at 120 frames a second.
  function ease(dt) {
    var near = function (ms) { return 1 - Math.exp(-dt / ms); };
    have.x += (want.x - have.x) * near(180); have.y += (want.y - have.y) * near(180);
    have.press += (want.press - have.press) * near(320);
    have.scroll += (want.scroll - have.scroll) * near(140);
  }
  function onPointer(e) {
    var h = window.innerHeight || 1;
    want.x = e.clientX / h; want.y = 1 - e.clientY / h;   // the shader's units: view heights, from the bottom left
    if (!want.press) { have.x = want.x; have.y = want.y; } // arriving: press in where it is, do not sweep across
    want.press = 1;
  }
  function onLeave() { want.press = 0; }
  function onScroll() { want.scroll = (window.pageYOffset || 0) / (window.innerHeight || 1) * 0.22; }
  function listen(on) {
    var f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('pointermove', onPointer, { passive: true });
    window[f]('scroll', onScroll, { passive: true });
    document.documentElement[f]('pointerleave', onLeave);
    window[f]('blur', onLeave);
  }
  function draw(dt) {
    fit();
    ease(dt);
    gl.uniform3f(uniforms.m, have.x, have.y, have.press);
    gl.uniform1f(uniforms.s, have.scroll);
    gl.uniform1f(uniforms.a, (Date.now() % LOOP_MS) / LOOP_MS * 6.283185307179586);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // Every frame the display offers: liquid has to be smooth, and a skipped frame shows as a stutter.
  function frame(now) {
    frameId = requestAnimationFrame(frame);
    var dt = Math.min(100, Math.max(0, now - lastDraw));
    lastDraw = now;
    draw(dt);
  }

  function shader(type, source) {
    var s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  // Builds the canvas and its program. False (and unusable, for good) when the browser cannot do it.
  function build() {
    canvas = document.createElement('canvas');
    canvas.className = 'silk-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
    if (!gl) return false;
    var vs = shader(gl.VERTEX_SHADER, VERTEX), fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
    var program = gl.createProgram();
    if (!vs || !fs) return false;
    gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle over the whole view
    var at = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    uniforms = {
      size: gl.getUniformLocation(program, 'size'), a: gl.getUniformLocation(program, 'a'),
      c0: gl.getUniformLocation(program, 'c0'), c1: gl.getUniformLocation(program, 'c1'), c2: gl.getUniformLocation(program, 'c2'),
      m: gl.getUniformLocation(program, 'm'), s: gl.getUniformLocation(program, 's')
    };
    return true;
  }

  function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    if (watcher) watcher.disconnect();
    watcher = null;
    listen(false);
    root.classList.remove('js-waves-live');
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; gl = null; uniforms = null;
  }
  function giveUp() {
    unusable = true;
    stop();
    label(false);
    root.classList.remove('js-motion');   // no dead button
  }
  // Starts the live silk if it is wanted and allowed. True when it is running.
  function start() {
    if (canvas) return true;
    if (unusable || !document.body || (quiet && quiet.matches) || !root.classList.contains('js-waves')) return false;
    if (!build() || !readTones()) { giveUp(); return false; }
    canvas.addEventListener('webglcontextlost', function () {
      // Phones drop contexts freely. Back to the still silk; the button offers to start again.
      stop();
      label(false);
    });
    onScroll();
    have.scroll = want.scroll; want.press = 0; have.press = 0;
    listen(true);
    lastDraw = window.performance && performance.now ? performance.now() : 0;
    draw(0);
    document.body.insertBefore(canvas, document.body.firstChild);
    root.classList.add('js-waves-live');   // only now does the still silk step aside
    if (window.MutationObserver) {
      watcher = new MutationObserver(function () { if (gl) readTones(); });
      watcher.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
    frameId = requestAnimationFrame(frame);
    return true;
  }

  // First paint: only the class, so the button's label is right; the drawing starts after the page is up.
  label(stored() !== 'off');

  function init() {
    button = document.querySelector('.motion-toggle');
    label(root.classList.contains('js-waves'));
    if (!window.WebGLRenderingContext || !window.requestAnimationFrame) { giveUp(); return; }
    if (button) {
      root.classList.add('js-motion');
      button.addEventListener('click', function () {
        var moving = !root.classList.contains('js-waves');
        label(moving);
        if (moving) start(); else stop();
        try {
          localStorage.setItem(MOTION_KEY, moving ? 'on' : 'off');
        } catch (e) {
          /* storage unavailable — the button still works for this page */
        }
      });
    }
    if (quiet && quiet.addEventListener) quiet.addEventListener('change', function () { if (quiet.matches) stop(); else start(); });
    // Not even one frame is asked for where nothing will be drawn (reduced motion, forced colours, a stored pause).
    if (root.classList.contains('js-waves') && !(quiet && quiet.matches)) requestAnimationFrame(function () { setTimeout(start, 0); });
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
// Withdrawing is one link away on every page: the footer's "Cookie settings"
// link reopens the same bar, and the privacy pages carry the same two buttons
// in place. Declining or withdrawing turns Google's own switch off, tells gtag
// the storage is denied, and deletes the _ga cookies for the host and for every
// parent domain. Because a page can sit in the back/forward cache or in another
// tab, the stored choice is read again when a tab is restored, becomes visible
// again, or another tab writes it.
//
// While GA_ID below is the placeholder this block returns before doing
// anything, so the site ships with analytics fully off. Switching it on is a
// procedure, not an edit: tools/PRE-FLIP-CHECKLIST.md says what must be true
// first (the notices, the property, the paperwork) and the release gate
// refuses until it is. PURGE_ONLY, just below, is the emergency stop and has to
// be false for analytics to run. The Content Security Policy on every page has
// to name the hosts gtag needs (script-src pinned to /gtag/js, and connect-src
// for the beacons); see EDGE-SETUP.md.
(function () {
  var GA_ID = 'G-XXXXXXXXXX';
  // The emergency stop. Setting the ID back to the placeholder only makes this
  // block inert, which leaves the _ga cookies of everyone who accepted in their
  // browsers. With PURGE_ONLY true (and the real ID still in place) the block
  // measures nothing for anyone, shows no bar, deletes the _ga cookies on every
  // page load and removes the stored choice, which also stops tabs that are
  // already open.
  var PURGE_ONLY = false;
  var CONSENT_KEY = 'vynatix-consent';  // localStorage: v1:granted:YYYY-MM-DD or v1:denied:YYYY-MM-DD
  var POLICY_VERSION = 'v1';            // bump when the wording of the choice changes, so old answers lapse
  var CONSENT_MAX_DAYS = 365;           // how long an answer is kept before the bar asks again
  // cookie_expires for the _ga cookies: configured to expire at most 365 days
  // after the last hit. A renewal can carry it past the consent record, and the
  // next visit then purges it.
  var COOKIE_MAX_AGE = 31536000;        // 365 days in seconds
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
      saveFail: 'Your choice could not be saved, so analytics stays off on this page.',
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
      saveFail: 'Ert val kunde inte sparas, så statistiken förblir avstängd på den här sidan.',
      footer: 'Cookie-inställningar'
    }
  };

  // Inert: with the placeholder (or anything that is not a GA4 ID) there is no
  // markup, no storage access, no listener and no class on <html>.
  if (/^G-X+$/.test(GA_ID) || !/^G-[A-Z0-9]{6,12}$/.test(GA_ID)) return;

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
    try {
      var value = POLICY_VERSION + ':' + choice + ':' + new Date().toISOString().slice(0, 10);
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

  // Runs only while this page's off switch is still set and the stored choice
  // is still not a grant. A visitor who declines and then accepts again within
  // the second keeps the new cookies, and so does one who accepted in another
  // tab: a stale tab closing must not wipe the cookies a granted tab is using.
  function purgeIfOff() {
    if (window[DISABLE_FLAG] === true && readStored().choice !== 'granted') purgeCookies();
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

  // Puts the bar straight after the skip link, so the skip link stays the first
  // Tab stop and the bar's buttons come early in the tab order. If a page ever
  // carries more than one skip link, it is the last of them that the bar follows.
  // A first visit does not take focus; a reopened bar does, because the visitor
  // asked for it.
  function showBar(isReopen) {
    reopened = isReopen;
    bar = buildBar(isReopen);
    var skips = document.querySelectorAll('body > .skip-link');
    var skip = skips.length ? skips[skips.length - 1] : null;
    var before = skip ? skip.nextSibling : document.body.firstChild;
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
      // Already up (a first-visit bar): it now counts as asked for, so Escape
      // puts it away and focus goes back to the link.
      reopened = true;
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
    try {
      if (current === 'granted') loadAnalytics(); else revoke();
    } catch (e) {
      /* the bar still has to close and the choice still be announced */
    }
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

  // Holding Enter on the footer link opens the bar and moves focus to Decline;
  // the key's auto-repeat would then press it. A choice needs a deliberate press.
  function onKeydown(e) {
    if (e.repeat && e.key === 'Enter' && e.target && e.target.closest && e.target.closest('[data-consent-choice]')) {
      e.preventDefault();
    }
  }

  function init() {
    // A second copy of this script on the page would double the bar and the
    // beacons; the class from the first copy is the sign it already ran.
    if (root.classList.contains('js-consent')) return;
    if (PURGE_ONLY) {
      window[DISABLE_FLAG] = true;
      purgeCookies();
      try { localStorage.removeItem(CONSENT_KEY); } catch (e) { /* nothing stored that could be read back */ }
      return;
    }
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
      document.addEventListener('keydown', onKeydown, true);
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
