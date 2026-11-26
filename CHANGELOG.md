# Changelog

## 2.0.1 — 2026-11-26

- Adds a cover image (`docs/preview.png`) for Orca's plugin page.
- `data/upstream.json` and the README now say the icons come from Papirus
  `master` at `a1fd8b31`, 176 commits after release `20250501`, instead of
  calling that commit release `20250501`.
- Credits say what the build changes in the Papirus SVGs.

## 2.0.0 — 2026-11-25

- Ships only the maximized artwork: 25 themes, one per folder color, no separate
  Large set and no `Large` suffix in theme names.
- Per-icon content bounds keep tall icons from clipping at the 1.2× zoom.
- Breaking: theme ids changed from `papirus-<color>-large` to `papirus-<color>`.
  Reselect the theme after updating.
- Removes `data/sizes.json`, which only the Large variants used.

## 1.1.0 — 2026-11-25

- Adds Large icon themes (1.2× artwork) for Blue, Teal, Orange, Red, Green,
  Violet and Pink.
- Adds `data/sizes.json` so the build can generate further size variants.
- Adds per-icon bounds so Large artwork is not clipped.
- Adds a rendered preview and a documented README for the public repository.

## 1.0.0 — 2026-11-25

- First release: 25 Papirus folder colors, 322 file extensions, 30 file names,
  30 folder names and 16 expanded folder names.
