# Papirus Icon Theme for Orca

Papirus file and folder icons for [Orca](https://github.com/stablyai/orca), with
25 selectable folder colors.

Orca ships a built-in icon set for its file explorer. This plugin replaces it with
Papirus artwork and adds one icon theme per Papirus folder color, so you can pick
the one that matches your setup under **Settings → Appearance → Icon theme**.

## Variants

Adwaita · Black · Blue · Blue Grey · Breeze · Brown · Carmine · Cyan · Dark Cyan ·
Deep Orange · Green · Grey · Indigo · Magenta · Nordic · Orange · Pale Brown ·
Pale Orange · Pink · Red · Teal · Violet · White · Yaru · Yellow

Each color also has a **Large** variant for Blue, Teal, Orange, Red, Green, Violet
and Pink. Large themes zoom the artwork 1.2× inside the same row height. Orca caps
a plugin at 32 icon themes, which is why only those seven colors get a Large theme
by default; `data/sizes.json` controls the list.

<!-- prettier-ignore -->
> Orca sets the file-tree icon box; a plugin cannot change the row height. The Large
> themes only scale the artwork inside that box. To change the whole UI scale, use
> Orca's zoom shortcuts.


## Coverage

- 322 file extensions (code, config, documents, images, audio, video, archives,
  disks, executables, fonts, 3D/CAD)
- 30 well-known file names (`package.json`, `Dockerfile`, `.gitignore`,
  `README.md`, `LICENSE`, lock files, ...)
- 30 folder names and 16 expanded folder names (`src`, `docs`, `assets`,
  `.github`, `node_modules`, `tests`, ...)

File type icons are shared by every variant; only folder icons change color.
Icons come from Papirus 48×48 artwork, which is what Papirus itself serves for
16 px lookups.

## Install

Requires Orca 1.4.246 or newer.

```sh
orca plugin install marcelofrau/orca-papirus-icon-theme
```

Or install a local checkout:

```sh
git clone https://github.com/marcelofrau/orca-papirus-icon-theme
orca plugin install ./orca-papirus-icon-theme
```

Then open **Settings → Appearance → Icon theme** and choose `Papirus Blue` (or any
other color). The plugin is content-only: it runs no code and needs no approval.

To uninstall: `orca plugin uninstall marcelofrau.papirus-icon-theme`.

## What it does not change

Orca's plugin API exposes **file and folder icons only**. Papirus itself has
thousands of application icons, but Orca's toolbar, sidebar, button and status
icons are built into the app and are not part of an icon theme, so they stay as
they are. Replacing them would mean patching Orca's internal assets, which breaks
on updates.

## Development

The generated `icons/` folder and `orca-plugin.json` are committed, so installing
does not require a build. To regenerate them from a Papirus checkout:

```sh
git clone --depth 1 https://github.com/PapirusDevelopmentTeam/papirus-icon-theme .papirus
npm run build -- --source .papirus/Papirus
npm run validate
```

`PAPIRUS_DIR` works instead of `--source`. Load the checkout in place and Orca
reloads it on changes:

```sh
orca plugin dev load .
```

The mapping lives in `data/`:

| File | Meaning |
| --- | --- |
| `extensions.json` | extension (without dot) to Papirus mimetype icon |
| `filenames.json` | exact lower-case file name to Papirus icon |
| `folders.json` | folder name to Papirus folder category, closed and expanded |
| `variants.json` | folder color to display label |
| `sizes.json` | size variants, artwork zoom and which colors get each size |
| `icon-bounds.json` | content bounds used to zoom each Large icon without clipping |
| `upstream.json` | Papirus release and commit used for the committed icons |

Papirus icon references are mimetype names (`text-x-python`) or app icons with an
`apps:` prefix (`apps:git`). The build follows Papirus symlinks, rejects SVGs with
elements that Orca's sanitizer drops, and fails if a reference is missing. Orca
caps an icon theme at 512 mappings and 512 distinct SVGs; the build enforces both.

Committed icons were generated from Papirus `a1fd8b31` (release `20250501`).

## License

GPL-3.0-only. Papirus artwork is GPL-3.0, © the
[Papirus Development Team](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
See `LICENSE`.
