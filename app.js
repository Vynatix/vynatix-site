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

// CTA "settle" — scroll-triggered entrance choreography + magnetic button.
// Built on GSAP (ScrollTrigger, SplitText) + Lenis. Plays once, never reverses.
// Degrades to the final, fully-visible state under reduced motion, with no JS,
// or if the libraries fail to load (the .js-anim hidden state is then dropped).
(function () {
  var root = document.documentElement;
  var section = document.querySelector('.cta-band');
  if (!section) return;

  // Motion tokens — mirror of the CSS custom properties in colors_and_type.css
  // (single source of truth; GSAP needs JS values, not cubic-bezier strings).
  var T = {
    ease: 'expo.out',          /* cubic-bezier(0.16, 1, 0.3, 1) — --ease-entrance */
    durHeadline: 0.9,          /* --dur-headline */
    durCopy: 0.7,              /* --dur-copy */
    durUnderline: 0.6,         /* --dur-underline */
    durMagnetRelease: 0.65,    /* --dur-magnet-release */
    staggerLine: 0.08,         /* --stagger-line */
    staggerWord: 0.045,        /* --stagger-word */
    eyebrowAt: 0,              /* t = 0.00s */
    headlineAt: 0.15,          /* t = 0.15s */
    ledeAt: 0.45,              /* t = 0.45s */
    buttonAfterLastLine: 0.15  /* button settles ~150ms after the last line starts */
  };

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Drop every .js-anim pre-hidden rule → the section shows its final state.
  function revealFinalState() { root.classList.remove('js-anim'); }

  // Hard fallback: GSAP / plugins absent (CDN blocked, offline) → just reveal.
  if (!window.gsap || !window.ScrollTrigger || !window.SplitText) {
    revealFinalState();
    return;
  }
  gsap.registerPlugin(ScrollTrigger, SplitText);

  var eyebrow   = section.querySelector('[data-cta-eyebrow]');
  var headline  = section.querySelector('[data-cta-headline]');
  var lede      = section.querySelector('[data-cta-lede]');
  var underline = section.querySelector('[data-cta-underline]');
  var button    = section.querySelector('[data-cta-button]');

  var headlineSplit = null;
  var ledeSplit = null;
  var settled = false;

  // ---- Lenis smooth scroll (the page's foundational motion layer) ----
  function initLenis() {
    if (reduceMQ.matches || !window.Lenis) return;   // native scroll under reduced motion
    var lenis = new Lenis({ duration: 1.2, lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function splitContent() {
    ledeSplit = new SplitText(lede, { type: 'words', wordsClass: 'cta-word' });
    // mask:'lines' wraps each line in an overflow-clipped element for the rise.
    headlineSplit = new SplitText(headline, { type: 'lines', mask: 'lines', linesClass: 'cta-line' });
  }

  // Pre-animation values (inline gsap.set wins over the .js-anim CSS).
  function setInitial() {
    gsap.set(eyebrow, { opacity: 0, yPercent: 40 });
    gsap.set(ledeSplit.words, { opacity: 0, yPercent: 60 });
    gsap.set(headlineSplit.lines, { yPercent: 110 });   // hidden inside the masks
    gsap.set([headline, lede], { opacity: 1 });          // containers safe to show now
    gsap.set(underline, { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(button, { opacity: 0, scale: 0.96 });
  }

  function buildTimeline() {
    var lineCount = headlineSplit.lines.length || 1;
    var lastLineStart = T.headlineAt + (lineCount - 1) * T.staggerLine;
    var underlineAt = lastLineStart + T.durHeadline;        // after the lines finish rising

    var tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 80%', once: true },  // ~80% viewport, play once
      defaults: { ease: T.ease },
      onComplete: function () { settled = true; }
    });
    tl.to(eyebrow, { opacity: 1, yPercent: 0, duration: T.durCopy }, T.eyebrowAt);
    tl.to(headlineSplit.lines, { yPercent: 0, duration: T.durHeadline, stagger: T.staggerLine }, T.headlineAt);
    tl.to(ledeSplit.words, { opacity: 1, yPercent: 0, duration: T.durCopy, stagger: T.staggerWord }, T.ledeAt);
    tl.to(underline, { scaleX: 1, duration: T.durUnderline }, underlineAt);
    tl.to(button, { opacity: 1, scale: 1, duration: T.durCopy }, lastLineStart + T.buttonAfterLastLine);
  }

  // ---- Magnetic button: pointer-fine devices only ----
  function initMagnetic() {
    if (reduceMQ.matches) return;
    if (!window.matchMedia('(pointer: fine)').matches || !window.matchMedia('(hover: hover)').matches) return;

    var label = button.querySelector('.btn-cta__label');
    var arrow = button.querySelector('.btn-cta__arrow');
    var RADIUS = 80, CAP = 14, PULL = 0.3, PARALLAX = 0.5;
    var ease = T.ease, dur = T.durMagnetRelease;

    var xTo = gsap.quickTo(button, 'x', { duration: dur, ease: ease });
    var yTo = gsap.quickTo(button, 'y', { duration: dur, ease: ease });
    var ixTo = gsap.quickTo([label, arrow], 'x', { duration: dur, ease: ease });
    var iyTo = gsap.quickTo([label, arrow], 'y', { duration: dur, ease: ease });

    var raf = 0, lastEvt = null;
    function clamp(v) { return v < -CAP ? -CAP : (v > CAP ? CAP : v); }
    function reset() { xTo(0); yTo(0); ixTo(0); iyTo(0); }

    function process() {
      raf = 0;
      var e = lastEvt;
      if (!e) { reset(); return; }
      var r = button.getBoundingClientRect();
      var inside = e.clientX >= r.left - RADIUS && e.clientX <= r.right + RADIUS &&
                   e.clientY >= r.top - RADIUS && e.clientY <= r.bottom + RADIUS;
      if (!inside) { reset(); return; }
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);
      xTo(clamp(dx * PULL));  yTo(clamp(dy * PULL));
      ixTo(clamp(dx * PARALLAX)); iyTo(clamp(dy * PARALLAX));
    }

    window.addEventListener('mousemove', function (e) {
      lastEvt = e;
      if (!raf) raf = requestAnimationFrame(process);
    }, { passive: true });

    // Pointer leaves the document → ease home.
    document.addEventListener('mouseleave', function () {
      lastEvt = null;
      if (!raf) raf = requestAnimationFrame(process);
    }, { passive: true });
  }

  // ---- Re-split on resize/orientation so masked lines reflow correctly ----
  function applyFinal() {
    gsap.set(eyebrow, { opacity: 1, yPercent: 0 });
    gsap.set(ledeSplit.words, { opacity: 1, yPercent: 0 });
    gsap.set(headlineSplit.lines, { yPercent: 0 });
    gsap.set([headline, lede], { opacity: 1 });
    gsap.set(underline, { scaleX: 1 });
    gsap.set(button, { opacity: 1, scale: 1 });
  }

  function bindResize() {
    var t;
    function onResize() {
      if (headlineSplit) headlineSplit.revert();
      if (ledeSplit) ledeSplit.revert();
      splitContent();
      if (settled) { applyFinal(); }   // already played — don't replay
      else { setInitial(); }
      ScrollTrigger.refresh();
    }
    function debounced() { clearTimeout(t); t = setTimeout(onResize, 200); }
    window.addEventListener('resize', debounced);
    window.addEventListener('orientationchange', debounced);
  }

  // Block the reveal on the headline font so the masked serif never swaps
  // mid-animation; always fall through (timeout/catch) so text is never stranded.
  function whenFontsReady(cb) {
    var done = false;
    function go() { if (!done) { done = true; cb(); } }
    if (document.fonts && document.fonts.ready) {
      try { document.fonts.load('1em "Instrument Serif"'); } catch (e) {}
      document.fonts.ready.then(go).catch(go);
      setTimeout(go, 1500);   // safety: never leave the headline hidden
    } else {
      go();
    }
  }

  function init() {
    // Reduced motion: no Lenis, no magnetic, no choreography — show final state.
    if (reduceMQ.matches) { revealFinalState(); return; }
    initLenis();
    whenFontsReady(function () {
      splitContent();
      setInitial();
      buildTimeline();
      initMagnetic();
      bindResize();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
