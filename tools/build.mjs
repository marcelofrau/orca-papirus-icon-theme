#!/usr/bin/env node
// Builds the Orca plugin from a Papirus checkout. The generated icons/ folder and
// orca-plugin.json are committed, so installing the plugin needs no build step.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_ICONS = path.join(ROOT, 'icons')
const ICON_SVG_MAX_BYTES = 64 * 1024
const MAX_MAPPINGS = 512
const MAX_ICON_THEMES = 32
// Orca's file tree box is 12 px; this fills it as far as the artwork allows.
const ZOOM = 1.2

const sourceArg = process.argv.indexOf('--source')
const SOURCE =
  (sourceArg > -1 ? process.argv[sourceArg + 1] : undefined) ??
  process.env.PAPIRUS_DIR ??
  path.join(ROOT, '.papirus', 'Papirus')

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const extensions = readJson(path.join(ROOT, 'data', 'extensions.json'))
const filenames = readJson(path.join(ROOT, 'data', 'filenames.json'))
const folders = readJson(path.join(ROOT, 'data', 'folders.json'))
const variants = readJson(path.join(ROOT, 'data', 'variants.json'))
const bounds = readJson(path.join(ROOT, 'data', 'icon-bounds.json'))
const pkg = readJson(path.join(ROOT, 'package.json'))

const fail = (message) => {
  console.error(`error: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(path.join(SOURCE, '48x48'))) {
  fail(`no Papirus theme at ${SOURCE}; pass --source <Papirus theme root> or set PAPIRUS_DIR`)
}

// Papirus symlinks are plain text files in a Windows checkout, so follow them by hand.
function readIcon(relative) {
  let file = path.join(SOURCE, '48x48', `${relative}.svg`)
  for (let hop = 0; hop < 16; hop += 1) {
    if (!fs.existsSync(file)) throw new Error(`missing icon: ${relative}`)
    const text = fs.readFileSync(file, 'utf8')
    if (/^(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>/]/i.test(text.trimStart())) {
      return text
    }
    const target = text.trim()
    if (!target || target.length > 260 || /[<>]/.test(target)) {
      throw new Error(`unreadable symlink: ${file}`)
    }
    file = path.resolve(path.dirname(file), target)
  }
  throw new Error(`symlink loop: ${relative}`)
}

// Mirrors what Orca's renderer keeps when it sanitizes an icon SVG, and refuses icons
// that would render as a flat themed silhouette instead of Papirus artwork.
function assertRenderable(text, label) {
  if (Buffer.byteLength(text) > ICON_SVG_MAX_BYTES) throw new Error(`${label}: over 64 KB`)
  const body = text.replace(/^\s*(?:<\?xml[^>]*\?>\s*)?/i, '')
  for (const tag of ['style', 'use', 'image', 'text', 'filter', 'foreignObject', 'script', 'symbol', 'pattern', 'marker']) {
    if (new RegExp(`<${tag}[\\s/>]`, 'i').test(body)) throw new Error(`${label}: contains <${tag}>`)
  }
  const explicitPaint = /(?:fill|stroke)\s*[:=]\s*["']?(?:#|rgb|hsl|url\()/i.test(body)
  const onlyCurrentColor =
    /currentcolor/i.test(body) && !/(?:fill|stroke)\s*[:=]\s*["']?(?:#|rgb|hsl)/i.test(body)
  if (!explicitPaint || onlyCurrentColor) throw new Error(`${label}: no explicit color`)
}

// Orca draws plugin icons with background-size: contain, so a tighter viewBox is the
// only way a plugin can make artwork larger inside the fixed 12 px row box. Bounds
// keep tall or edge-to-edge icons from clipping.
function sizedSvg(text, boundsKey) {
  const box = bounds[boundsKey]
  let scale = ZOOM
  let centerX = 24
  let centerY = 24
  if (box) {
    scale = Math.max(1, Math.min(ZOOM, 48 / Math.max(box.w, box.h)))
    centerX = box.x + box.w / 2
    centerY = box.y + box.h / 2
  }
  const span = 48 / scale
  const offsetX = Math.min(Math.max(centerX - span / 2, 0), 48 - span)
  const offsetY = Math.min(Math.max(centerY - span / 2, 0), 48 - span)
  const viewBox = `viewBox="${offsetX} ${offsetY} ${span} ${span}"`
  if (/viewBox\s*=\s*"[^"]*"/i.test(text)) {
    return text.replace(/viewBox\s*=\s*"[^"]*"/i, viewBox)
  }
  return text.replace(/<svg\b/i, `<svg ${viewBox}`)
}

fs.rmSync(OUT_ICONS, { recursive: true, force: true })

const iconCache = new Map()

function iconFor(reference, label) {
  const relative = reference.startsWith('apps:')
    ? `apps/${reference.slice('apps:'.length)}`
    : `mimetypes/${reference}`
  if (!iconCache.has(relative)) {
    const text = sizedSvg(readIcon(relative), `files/${relative.replace(/[/]/g, '__')}`)
    assertRenderable(text, label)
    const output = `icons/files/${relative.replace(/[/]/g, '__')}.svg`
    fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true })
    fs.writeFileSync(path.join(ROOT, output), text)
    iconCache.set(relative, output)
  }
  return iconCache.get(relative)
}

function writeFolderIcon(name, relative, boundsKey) {
  const text = sizedSvg(readIcon(relative), `folders/${boundsKey}`)
  assertRenderable(text, relative)
  const output = `icons/folders/${name}.svg`
  fs.mkdirSync(path.dirname(path.join(ROOT, output)), { recursive: true })
  fs.writeFileSync(path.join(ROOT, output), text)
  return output
}

const fileIcons = new Map()
for (const [ext, reference] of Object.entries(extensions)) {
  fileIcons.set(ext, iconFor(reference, `extension .${ext}`))
}
const nameIcons = new Map()
for (const [name, reference] of Object.entries(filenames)) {
  nameIcons.set(name, iconFor(reference, `file ${name}`))
}

const themes = []
for (const [color, label] of Object.entries(variants)) {
  const folder = writeFolderIcon(color, `places/folder-${color}`, 'default')
  const folderOpen = writeFolderIcon(`${color}-open`, `places/folder-${color}-open`, 'open')

  const folderNames = {}
  for (const [name, category] of Object.entries(folders.closed)) {
    folderNames[name] = writeFolderIcon(`${color}-${category}`, `places/folder-${color}-${category}`, category)
  }
  const folderNamesExpanded = {}
  for (const [name, category] of Object.entries(folders.expanded)) {
    folderNamesExpanded[name] = writeFolderIcon(
      `${color}-${category}-open`,
      `places/folder-${color}-${category}-open`,
      `${category}-open`
    )
  }

  const theme = {
    schemaVersion: 1,
    icons: {
      file: iconFor('text-x-generic', 'fallback file'),
      folder,
      'folder-open': folderOpen
    },
    fileNames: Object.fromEntries(nameIcons),
    fileExtensions: Object.fromEntries(fileIcons),
    folderNames,
    folderNamesExpanded
  }

  const refs = [
    ...Object.values(theme.icons),
    ...Object.values(theme.fileNames),
    ...Object.values(theme.fileExtensions),
    ...Object.values(theme.folderNames),
    ...Object.values(theme.folderNamesExpanded)
  ]
  if (refs.length > MAX_MAPPINGS) fail(`${color}: ${refs.length} mappings (max ${MAX_MAPPINGS})`)
  if (new Set(refs).size > MAX_MAPPINGS) fail(`${color}: too many distinct icons`)
  for (const ref of refs) {
    if (!fs.existsSync(path.join(ROOT, ref))) fail(`${color}: missing generated ${ref}`)
  }

  const id = `papirus-${color}`
  const themePath = `icons/themes/${id}.json`
  fs.mkdirSync(path.join(OUT_ICONS, 'themes'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, themePath), JSON.stringify(theme, null, 2) + '\n')
  themes.push({ id, title: `Papirus ${label}`, path: themePath })
}

if (themes.length > MAX_ICON_THEMES) fail(`${themes.length} icon themes (max ${MAX_ICON_THEMES})`)

const manifest = {
  manifestVersion: 2,
  id: 'papirus-icon-theme',
  name: 'Papirus Icon Theme',
  version: pkg.version,
  description: 'Papirus file and folder icons for Orca, with 25 selectable folder colors.',
  author: { name: 'Marcelo Frau', url: 'https://github.com/marcelofrau' },
  license: 'GPL-3.0-only',
  repository: 'https://github.com/marcelofrau/orca-papirus-icon-theme',
  homepage: 'https://github.com/marcelofrau/orca-papirus-icon-theme',
  engines: { orca: '>=1.4.246' },
  execution: 'data',
  contributes: { iconThemes: themes },
  capabilities: []
}
fs.writeFileSync(path.join(ROOT, 'orca-plugin.json'), JSON.stringify(manifest, null, 2) + '\n')

const countSvgs = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).reduce(
        (total, entry) =>
          total + (entry.isDirectory() ? countSvgs(path.join(dir, entry.name)) : entry.name.endsWith('.svg') ? 1 : 0),
        0
      )
    : 0
console.log(
  `built ${themes.length} themes from ${Object.keys(extensions).length} extensions, ` +
    `${Object.keys(filenames).length} file names, ${countSvgs(OUT_ICONS)} SVGs`
)
