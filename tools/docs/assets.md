# Assets

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

`assets/` holds the logo as the system's ink files, `vynatix-wordmark-<ink>.svg`
and `vynatix-mark-<ink>.svg`, in the three Forest inks: `forest` (on Cream and
light surfaces), `cream` (reversed, on Forest and the dark canvas) and `bronze`
(print foil only, never small). The pages do not reference them: the wordmark
is inlined once per page as a `<symbol>` filled with `currentColor` and placed
with `<use>` in the header (`md-sys-color-primary`) and footer
(`md-sys-color-inverse-on-surface`), so it follows the theme. The files are for
places where inline SVG cannot go (email, documents) and for regenerating the
icons. The system holds the other inks (teal, ink, cloud, champagne, charcoal,
paper) for the other directions.

The English home page's pictures are generated photographs (`services-workbench*.webp` and
three `case-*.webp`, each with a `-dark` twin; see `assets/CREDITS.md`), shown in full colour
with no filter or overlay. They illustrate the work and show no client system, and the page
says so in the line under the case cards. The Swedish hub still carries the three stock
photographs (`case-*.jpg`, each with a `.webp` sibling), under the line naming their
photographers. No text is set on a picture, and none is used as an uncaptioned band. The client mark in
the home-page list is an inline SVG `<symbol>` in `index.html`, referenced with
`<use>` and filled with `currentColor` (provenance in `assets/CREDITS.md`).

The hero's drafting sheet draws from two alpha-only SVG masks,
`assets/bg-sheet-art-2.svg` and `bg-sheet-edge-2.svg` (generator in `tools/`, see
`assets/AGENTS.md`); they are requested only from 1200px up, on the home page. The same
generator writes the five `assets/stage-*.svg` masks of the Partnership band from the same
constants, so the hero's drawing and its four stages cannot drift apart.

The app icons (`icon-192/512.png`, `apple-touch-icon.png`) are the Cream V mark
on a Forest field; `favicon.ico` is the Forest mark on transparent;
`favicon.svg` switches between the two with `prefers-color-scheme`. All five
were rendered offline through Chromium from the mark files. If the mark or the
direction changes, regenerate all five.

**Fonts** are self-hosted woff2 subsets made from the design system's TTF
files with fontTools, every OpenType feature and variable axis kept. Each face
is split into a Latin file (Swedish included) and a Latin Extended file,
declared with `unicode-range` in `tokens.css`, so a page fetches the second only
when its text needs it:

```sh
pyftsubset Fraunces-VariableFont_SOFT_WONK_opsz_wght.ttf --layout-features='*' --flavor=woff2 \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --output-file=fraunces-variable-latin.woff2
pyftsubset Fraunces-VariableFont_SOFT_WONK_opsz_wght.ttf --layout-features='*' --flavor=woff2 \
  --unicodes="U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" \
  --output-file=fraunces-variable-latin-ext.woff2
```

Forest renders in Fraunces (display, editorial), Aptos (body) and Geist
(eyebrows, the system voice); Teal would use Instrument Serif and Geist,
Monochrome Geist, and `code` is JetBrains Mono in every theme, so all of those
faces ship (a browser fetches only the ones a page uses). The home page
preloads the drawn direction's display face and its italic (Fraunces for
Forest, Instrument Serif for Teal, Geist and Fraunces italic for Monochrome),
one for each line of the hero headline. Instrument Serif and JetBrains
Mono are SIL Open Font License fonts (`fonts/licences/`), Fraunces and Geist
too, and so are the four faces of the other scripts (M PLUS 2, Shippori Mincho, Noto Sans Arabic, Amiri:
*Languages*, "The faces of the other scripts"; they are cut by `tools/lang-fonts.py`, not by the commands
above). **Aptos is Microsoft's typeface**: the design system itself says to check
its terms before shipping it outside Vynatix's own documents, and that check
has not been recorded here. If it fails, delete the seven `aptos-*.woff2`
files and their `@font-face` rules; `--font-body` falls back to Geist. Don't
add third-party font/CDN requests for fonts.
