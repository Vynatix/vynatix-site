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
| `node verify/screenshot.js baseline` | Capture 6 pages x light/dark into `baseline/` |
| `node verify/screenshot.js current` | Capture into `current/` |
| `node verify/screenshot.js compare` | Pixel-diff `current/` against `baseline/` |

`screenshot.js compare` is the gate for any visual refactor: capture a baseline
before the change, then compare after.
