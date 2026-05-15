// Vynatix content loader.
//
// Fetches content.md, parses the YAML frontmatter, and injects values into
// elements tagged with data-bind / data-bind-attr / data-bind-list attributes.
//
// On any failure (network, missing file, malformed YAML), the existing static
// HTML stays in place — it is the fallback that crawlers see too.
(function () {
  'use strict';

  var REVEAL_CLASS = 'content-ready';
  var SAFETY_REVEAL_MS = 600;
  var CONTENT_URL = 'content.md';

  // Reveal the page even if the loader itself fails to run.
  var safetyTimer = setTimeout(reveal, SAFETY_REVEAL_MS);

  function reveal() {
    document.documentElement.classList.add(REVEAL_CLASS);
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function libsReady() {
    return typeof window.marked !== 'undefined' && typeof window.jsyaml !== 'undefined';
  }

  function waitForLibs(maxMs) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function poll() {
        if (libsReady()) return resolve();
        if (Date.now() - start > maxMs) return reject(new Error('libs (marked/js-yaml) failed to load'));
        setTimeout(poll, 30);
      })();
    });
  }

  function extractFrontmatter(text) {
    // Allow an optional UTF-8 BOM and leading whitespace before the first ---.
    var m = text.match(/^﻿?\s*---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n[\s\S]*)?$/);
    if (!m) throw new Error('content.md is missing the --- YAML frontmatter block');
    return m[1];
  }

  function getPath(root, path) {
    if (!path) return undefined;
    var parts = path.split('.');
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // Resolve a binding path against a scope. '.' is the scope itself
  // (for arrays of primitives). Paths starting with '.' resolve against
  // the local item; absolute paths resolve from the document root.
  function resolve(absRoot, scope, path) {
    if (path === '.') return scope;
    if (path.charAt(0) === '.') {
      var sub = path.slice(1);
      return sub === '' ? scope : getPath(scope, sub);
    }
    return getPath(absRoot, path);
  }

  function renderInline(value) {
    if (value == null) return '';
    var str = String(value);
    var html = window.marked.parseInline(str, { mangle: false, headerIds: false });
    // Preserve hard line breaks from YAML block scalars.
    return html.replace(/\n/g, '<br>');
  }

  function bindScalar(el, absRoot, scope) {
    var path = el.getAttribute('data-bind');
    if (!path) return;
    var value = resolve(absRoot, scope, path);
    if (value === undefined) return; // leave static fallback
    el.innerHTML = renderInline(value);
  }

  function bindAttrs(el, absRoot, scope) {
    var spec = el.getAttribute('data-bind-attr');
    if (!spec) return;
    spec.split(',').forEach(function (pair) {
      var idx = pair.indexOf(':');
      if (idx < 0) return;
      var name = pair.slice(0, idx).trim();
      var path = pair.slice(idx + 1).trim();
      var value = resolve(absRoot, scope, path);
      if (value === undefined) return;
      el.setAttribute(name, String(value));
    });
  }

  function bindClassFrom(el, absRoot, scope) {
    var spec = el.getAttribute('data-bind-class-from');
    if (!spec) return;
    var value = resolve(absRoot, scope, spec);
    if (value === undefined) return;
    el.classList.add(String(value));
  }

  function bindClassIf(el, absRoot, scope) {
    var spec = el.getAttribute('data-bind-class-if');
    if (!spec) return;
    // Format: "className:path"
    var idx = spec.indexOf(':');
    if (idx < 0) return;
    var cls = spec.slice(0, idx).trim();
    var path = spec.slice(idx + 1).trim();
    var value = resolve(absRoot, scope, path);
    if (value) el.classList.add(cls);
  }

  function renderSubtree(root, absRoot, scope) {
    // Lists first, since they replace container children.
    var lists = Array.prototype.slice.call(root.querySelectorAll('[data-bind-list]'));
    lists.forEach(function (container) {
      renderList(container, absRoot, scope);
    });

    // Scalars + attributes within whatever remains. Skip nodes that live
    // inside a rendered list — those were bound with the item scope already.
    var bound = Array.prototype.slice.call(root.querySelectorAll('[data-bind], [data-bind-attr], [data-bind-class-from], [data-bind-class-if]'));
    bound.forEach(function (el) {
      if (el.closest('[data-bind-list-rendered]')) return;
      bindScalar(el, absRoot, scope);
      bindAttrs(el, absRoot, scope);
      bindClassFrom(el, absRoot, scope);
      bindClassIf(el, absRoot, scope);
    });
  }

  function renderList(container, absRoot, scope) {
    var spec = container.getAttribute('data-bind-list');
    if (!spec) return;
    var parts = spec.split(',').map(function (s) { return s.trim(); });
    var path = parts[0];
    var templateSel = parts[1];
    var dupCount = parts[2] ? parseInt(parts[2], 10) : 1;
    if (!path || !templateSel) return;

    var items = resolve(absRoot, scope, path);
    if (!Array.isArray(items)) return;

    var template = document.querySelector(templateSel);
    if (!template || !template.content) return;

    // Mark as rendered so the outer scan does not re-walk our subtree.
    container.setAttribute('data-bind-list-rendered', '');
    container.innerHTML = '';

    for (var dup = 0; dup < dupCount; dup++) {
      items.forEach(function (item) {
        var frag = template.content.cloneNode(true);
        // Render attributes/scalars within the fragment scoped to this item.
        renderFragment(frag, absRoot, item);
        container.appendChild(frag);
      });
    }
  }

  function renderFragment(frag, absRoot, scope) {
    // Nested lists inside the template fragment.
    var lists = Array.prototype.slice.call(frag.querySelectorAll('[data-bind-list]'));
    lists.forEach(function (container) {
      renderList(container, absRoot, scope);
    });
    var bound = Array.prototype.slice.call(frag.querySelectorAll('[data-bind], [data-bind-attr], [data-bind-class-from], [data-bind-class-if]'));
    bound.forEach(function (el) {
      if (el.closest('[data-bind-list-rendered]')) return;
      bindScalar(el, absRoot, scope);
      bindAttrs(el, absRoot, scope);
      bindClassFrom(el, absRoot, scope);
      bindClassIf(el, absRoot, scope);
    });
  }

  function applyMeta(content) {
    if (content && content.meta) {
      if (content.meta.title) document.title = content.meta.title;
      if (content.meta.description) {
        var m = document.querySelector('meta[name="description"]');
        if (m) m.setAttribute('content', content.meta.description);
      }
    }
  }

  function run() {
    waitForLibs(SAFETY_REVEAL_MS)
      .then(function () { return fetch(CONTENT_URL, { cache: 'no-cache' }); })
      .then(function (r) {
        if (!r.ok) throw new Error('content.md fetch failed: HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        var fm = extractFrontmatter(text);
        var content = window.jsyaml.load(fm);
        if (!content || typeof content !== 'object') throw new Error('content.md frontmatter did not parse to an object');
        applyMeta(content);
        renderSubtree(document.body, content, content);
      })
      .catch(function (err) {
        // Static HTML remains visible. Warn for dev visibility.
        // eslint-disable-next-line no-console
        console.warn('[content] using static fallback:', err && err.message ? err.message : err);
      })
      .then(function () {
        clearTimeout(safetyTimer);
        reveal();
      });
  }

  ready(run);
})();
