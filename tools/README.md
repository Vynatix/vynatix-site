# Verification tools

Local-only checks for the site. **These are not part of the site build** — the
site itself is hand-written static files with no build step, and everything in
this directory is excluded from the published output via `_config.yml`.

## Setup

Requires Node and Playwright's browser bindings:

```sh
cd tools
npm init -y && npm i playwright
```

Chromium is expected at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.
Override with `CHROME=/path/to/chrome`. Nothing here is committed except the
scripts — `node_modules/` and generated screenshots are gitignored.

## Running

Serve the site from the repo root first:

```sh
python3 -m http.server 8000
```

Then, from `tools/`:

| Command | Checks |
|---|---|
| `node verify/adversarial.js` | CSP actually **blocks** injected scripts/styles/images/handlers; localStorage poisoning; URL reflection; framing |
| `node verify/requests.js` | **Zero** off-origin requests; self-hosted fonts resolve; no CSP violations |
| `node verify/a11y.js` | axe-core (WCAG 2.0/2.1/2.2 A+AA) on every page in both themes, plus skip link, marquee pause control, no-JS and reduced-motion fallbacks |
| `node verify/links.js` | Every internal link, script, style and image resolves |
| `node verify/headers.js` | Security response headers (see `EDGE-SETUP.md`) |
| `node verify/screenshot.js baseline` | Capture 9 pages x light/dark into `baseline/` |
| `node verify/screenshot.js current` | Capture into `current/` |
| `node verify/screenshot.js compare` | Pixel-diff `current/` against `baseline/` |

`screenshot.js compare` is the gate for any visual refactor: capture a baseline
before the change, then compare after. Captures force images to decode first, so
a lazy-loaded cover cannot race the screenshot and produce a false diff.

`headers.js` fails against a plain GitHub Pages origin by design — those headers
are exactly what the edge layer in `EDGE-SETUP.md` adds. Point it at the live
site with `BASE=https://vynatix.com/ node verify/headers.js`.

`a11y.js` bypasses CSP only to inject the scanner; `script-src 'self'` correctly
refuses it otherwise. CSP enforcement is proven separately by `adversarial.js`.

Other useful env vars: `VW`/`VH` set the screenshot viewport (e.g. `VW=390
VH=844` for mobile) and `SUFFIX` writes to a separate directory set.
