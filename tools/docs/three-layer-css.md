# Three-layer CSS

Moved word for word from `AGENTS.md` on 25 November 2026 (`tools/REFACTORING-PLAN.md`, step 4.3); its index is
`AGENTS.md`, *Topics*. Not published (`tools/` is excluded in `_config.yml`).

**Three-layer CSS.** Every page links the three files in this order:

- `tokens.css` is the design system's generated token sheet. It declares the
  Material 3 colour roles (`--md-sys-color-*`) and their aliases (`--bg`, `--fg`,
  `--text-body`, `--text-muted`, `--text-display`, `--text-accent`,
  `--primary-hover`, `--focus-ring`, `--indicator`,
  `--inverse-on-surface-variant`, the `--success`/`--warning`/`--info` roles,
  the glass tints, `--shadow-l1`…`l5`) for all six themes, plus `--space-*`,
  `--radius-*`, `--text-*` sizes, `--leading-*`, `--tracking-*`, `--icon-*`,
  `--font-*` and the `@font-face` rules. Treat it as read-only: it is the
  system's file. The one site-specific edit is the `@font-face` block, which
  points at the woff2 subsets in `fonts/` instead of the system's TTFs and
  leaves out the 4 MB icon font (the block says so at the top).
- `colors_and_type.css` is the system's hand-written layer, copied verbatim:
  motion, the glass blurs, the reduced-motion and reduced-transparency
  overrides, the per-theme typefaces (`--font-display`, `--font-body`,
  `--font-editorial`, `--font-subhead`), the reset, the semantic helpers
  (`h1`–`h6`, `p`, `p.lede`, `a`, `ul` with the indicator dash, `blockquote`,
  `code`, tables, forms), `.eyebrow`, the `.btn` family, `.card`, `.glass`,
  `.container` and the `.ms` icon classes (unused here, see *Icons*).
- `styles.css` is the site's own layer and the only one you normally edit. It
  consumes **role tokens only**: no raw hex, no palette tokens (`--forest-*`,
  `--teal-*`, `--mono-*` and friends), no `[data-theme]` selectors. A rule
  written that way holds in all six themes automatically. Sizes come from the
  scales. New components follow the system's cards (TopAppBar, Button, Card,
  EditorialCard, MetricCard, Banner, FocusRing, Logo); the file's comments
  name which pattern each block implements.
  Each block opens with a banner (a comment headed by a rule, with the block's name on
  its next line), and the docs cite a block by that name (`styles.css`, "Hero fit"), never
  by its place in the file: `tools/verify/docs.js` holds the names in order and fails when a
  block is moved, renamed, added or removed, so a new block goes into its list in the same
  commit.
