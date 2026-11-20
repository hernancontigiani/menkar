// Imports the raw captures of a run into the site, and records which images someone opened.
//
//   node site/scripts/import-captures.mjs                      import the run's raw PNGs
//   node site/scripts/import-captures.mjs --reviewed <slug>…   sign off these slugs' current images
//   node site/scripts/import-captures.mjs --all-changed        sign off every image not yet signed
//
// An import checks the whole run before it writes anything: one image of a single flat colour, or
// two showing the same picture, fails it (a navigation that did not happen photographs the
// previous screen again). An image that, drawn in the committed file's palette, shows the same
// picture as it keeps the old file, so a run that changed nothing leaves git clean. No dithering,
// so a reduced pixel is a palette colour as near as any to its own, as that comparison draws it.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { CAPTURES, LOCALES, THEMES } from '../../e2e/captures/registry.ts'
import { difference, onPalette, samePicture } from './same-picture.ts'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEST = join(REPO, 'site', 'src', 'assets', 'captures')
const REVIEWED = join(DEST, 'reviewed.json')
const WORK = '/tmp/menkar-captures'
const RAW = join(WORK, 'raw')

const key = (c) => `${c.locale}/${c.theme}/${c.slug}`
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const destOf = (c) => join(DEST, c.locale, c.theme, `${c.slug}.png`)

function every() {
  return LOCALES.flatMap((locale) =>
    THEMES.flatMap((theme) => CAPTURES.map((c) => ({ ...c, locale, theme }))),
  )
}

function readReviewed() {
  return existsSync(REVIEWED) ? JSON.parse(readFileSync(REVIEWED, 'utf8')) : {}
}

function writeReviewed(reviewed) {
  const sorted = Object.fromEntries(Object.entries(reviewed).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(REVIEWED, `${JSON.stringify(sorted, null, 2)}\n`)
}

async function pixels(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

async function isFlat(input) {
  const { channels } = await sharp(input).stats()
  return channels.every((ch) => ch.min === ch.max)
}

async function contactSheet(locale, theme, shots) {
  const file = join(WORK, `sheet-${locale}-${theme}.png`)
  rmSync(file, { force: true })
  if (shots.length === 0) return null
  const W = 640
  const H = 400
  const LABEL = 28
  const GAP = 16
  const cols = Math.min(2, shots.length)
  const rows = Math.ceil(shots.length / cols)
  const dark = theme === 'dark'
  const tiles = []
  for (const [i, c] of shots.entries()) {
    const x = GAP + (i % cols) * (W + GAP)
    const y = GAP + Math.floor(i / cols) * (H + LABEL + GAP)
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LABEL}"><text x="0" y="20" font-family="sans-serif" font-size="16" fill="${dark ? '#ddd' : '#222'}">${c.slug}</text></svg>`,
    )
    tiles.push({ input: label, left: x, top: y })
    tiles.push({
      input: await sharp(c.bytes).resize(W, H, { fit: 'inside' }).toBuffer(),
      left: x,
      top: y + LABEL,
    })
  }
  await sharp({
    create: {
      width: GAP + cols * (W + GAP),
      height: GAP + rows * (H + LABEL + GAP),
      channels: 3,
      background: dark ? '#111' : '#f4f4f4',
    },
  })
    .composite(tiles)
    .png()
    .toFile(file)
  return file
}

async function importRun() {
  if (process.env.CAPTURE_CHECK === '1') {
    console.log('captures: check run, nothing imported')
    return 0
  }
  const found = every().filter((c) => existsSync(join(RAW, c.locale, c.theme, `${c.slug}.png`)))
  if (found.length === 0) {
    console.error(`captures: no raw image under ${RAW}`)
    return 1
  }
  const failures = []
  const run = []
  for (const c of found) {
    const raw = join(RAW, c.locale, c.theme, `${c.slug}.png`)
    if (await isFlat(raw)) failures.push(`${key(c)} is one flat colour`)
    const bytes = await sharp(raw)
      .png({ palette: true, colours: 256, dither: 0, compressionLevel: 9, effort: 10 })
      .toBuffer()
    run.push({ ...c, bytes, rawPixels: await pixels(raw) })
  }
  for (const [i, a] of run.entries())
    for (const b of run.slice(i + 1)) {
      const allowed = a.same?.includes(b.slug) || b.same?.includes(a.slug)
      if (!allowed && samePicture(a.rawPixels, b.rawPixels))
        failures.push(`${key(a)} and ${key(b)} show the same picture`)
    }
  if (failures.length > 0) {
    console.error(`captures: nothing imported\n  ${failures.join('\n  ')}`)
    return 1
  }

  const reviewed = readReviewed()
  const changed = []
  for (const c of run) {
    const dest = destOf(c)
    if (existsSync(dest)) {
      const committed = await pixels(dest)
      const drawn = onPalette(c.rawPixels, committed)
      if (samePicture(drawn, committed)) continue
      const d = difference(drawn, committed)
      c.why = d ? `${d.changed} px differ, up to ${d.maxDelta}` : 'its size changed'
    } else c.why = 'new'
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, c.bytes)
    changed.push(c)
  }
  for (const c of run) {
    const hash = sha256(readFileSync(destOf(c)))
    const mark = changed.includes(c) ? 'written' : 'kept   '
    const review = reviewed[key(c)] === hash ? '' : '  (not reviewed)'
    console.log(`  ${mark} ${key(c)} ${hash.slice(0, 12)}${review}${c.why ? `  (${c.why})` : ''}`)
  }
  const total = every()
    .filter((c) => existsSync(destOf(c)))
    .reduce((sum, c) => sum + readFileSync(destOf(c)).length, 0)
  console.log(
    `captures: ${run.length} imported, ${changed.length} written, ${run.length - changed.length} unchanged; ${(total / 1024).toFixed(0)} KiB in ${DEST}`,
  )
  for (const locale of LOCALES)
    for (const theme of THEMES) {
      const sheet = await contactSheet(
        locale,
        theme,
        changed.filter((c) => c.locale === locale && c.theme === theme),
      )
      if (sheet) console.log(`  contact sheet: ${sheet}`)
    }
  return 0
}

function signOff(args) {
  const all = args.includes('--all-changed')
  const slugs = args.filter((a) => !a.startsWith('--'))
  const known = new Set(CAPTURES.map((c) => c.slug))
  const unknown = slugs.filter((s) => !known.has(s))
  if (unknown.length > 0) {
    console.error(`captures:reviewed: not in the registry: ${unknown.join(', ')}`)
    return 1
  }
  if (!all && slugs.length === 0) {
    console.error('captures:reviewed: name the slugs you opened, or --all-changed')
    return 1
  }
  const reviewed = readReviewed()
  const signed = []
  for (const c of every()) {
    if (!all && !slugs.includes(c.slug)) continue
    if (!existsSync(destOf(c))) continue
    const hash = sha256(readFileSync(destOf(c)))
    if (reviewed[key(c)] === hash) continue
    reviewed[key(c)] = hash
    signed.push(key(c))
  }
  writeReviewed(reviewed)
  console.log(`captures:reviewed: ${signed.length} signed${signed.map((k) => `\n  ${k}`).join('')}`)
  return 0
}

const args = process.argv.slice(2)
const reviewing = args.includes('--reviewed') || args.includes('--all-changed')
process.exitCode = reviewing ? signOff(args) : await importRun()
