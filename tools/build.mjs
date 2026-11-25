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

const iconFiles = new Map() // relative Papirus path -> output file name
const iconText = new Map()

function iconFor(reference, label) {
  const relative = reference.startsWith('apps:')
    ? `apps/${reference.slice('apps:'.length)}`
    : `mimetypes/${reference}`
  if (!iconFiles.has(relative)) {
    const text = readIcon(relative)
    assertRenderable(text, label)
    const output = `${relative.replace(/[/]/g, '__')}.svg`
    iconFiles.set(relative, output)
    iconText.set(output, text)
  }
  return `icons/files/${iconFiles.get(relative)}`
}

fs.rmSync(OUT_ICONS, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT_ICONS, 'files'), { recursive: true })
fs.mkdirSync(path.join(OUT_ICONS, 'folders'), { recursive: true })
fs.mkdirSync(path.join(OUT_ICONS, 'themes'), { recursive: true })

const fileIcons = new Map()
for (const [ext, reference] of Object.entries(extensions)) {
  fileIcons.set(ext, iconFor(reference, `extension .${ext}`))
}
const nameIcons = new Map()
for (const [name, reference] of Object.entries(filenames)) {
  nameIcons.set(name, iconFor(reference, `file ${name}`))
}

for (const [output, text] of iconText) {
  fs.writeFileSync(path.join(OUT_ICONS, 'files', output), text)
}

const writeFolderIcon = (name, relative) => {
  const output = path.join(OUT_ICONS, 'folders', `${name}.svg`)
  const text = readIcon(relative)
  assertRenderable(text, relative)
  fs.writeFileSync(output, text)
  return `icons/folders/${name}.svg`
}

const themes = []
for (const [color, label] of Object.entries(variants)) {
  const folder = writeFolderIcon(`${color}`, `places/folder-${color}`)
  const folderOpen = writeFolderIcon(`${color}-open`, `places/folder-${color}-open`)

  const folderNames = {}
  for (const [name, category] of Object.entries(folders.closed)) {
    folderNames[name] = writeFolderIcon(`${color}-${category}`, `places/folder-${color}-${category}`)
  }
  const folderNamesExpanded = {}
  for (const [name, category] of Object.entries(folders.expanded)) {
    folderNamesExpanded[name] = writeFolderIcon(
      `${color}-${category}-open`,
      `places/folder-${color}-${category}-open`
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
  fs.writeFileSync(path.join(OUT_ICONS, 'themes', `${color}.json`), JSON.stringify(theme, null, 2) + '\n')
  themes.push({ id, title: `Papirus ${label}`, path: `icons/themes/${color}.json` })
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

const svgCount = fs.readdirSync(path.join(OUT_ICONS, 'files')).length +
  fs.readdirSync(path.join(OUT_ICONS, 'folders')).length
console.log(
  `built ${themes.length} variants, ${Object.keys(extensions).length} extensions, ` +
    `${Object.keys(filenames).length} file names, ${svgCount} SVGs`
)
