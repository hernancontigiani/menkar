// The site's captures: the registry, the committed images, their sign-off and their alt text agree;
// and the importer keeps an image only when it shows the same picture.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'
import { CAPTURES, type Capture, LOCALES, THEMES } from '../../e2e/captures/registry'
import { en } from '../../e2e/captures/strings/en'
import { es } from '../../e2e/captures/strings/es'
import {
  MAX_CHANGED_SHARE,
  MAX_CHANNEL_DELTA,
  onPalette,
  type Pixels,
  samePicture,
  TIE_LEVELS,
} from '../../site/scripts/same-picture'

const SITE = join(__dirname, '..', '..', 'site')
const DIR = join(SITE, 'src', 'assets', 'captures')
const DOCS = join(SITE, 'src', 'content', 'docs')
const REVIEWED = 'reviewed.json'

const filesUnder = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => relative(dir, join(e.parentPath, e.name)))
    : []

const expected = LOCALES.flatMap((locale) =>
  THEMES.flatMap((theme) => CAPTURES.map((c) => `${locale}/${theme}/${c.slug}.png`)),
)
const images = filesUnder(DIR).filter((f) => f !== REVIEWED)

describe('the registry and the committed images', () => {
  test('the registry names each slug once, and a `same` names a slug of the registry', () => {
    const slugs = CAPTURES.map((c) => c.slug)
    expect(slugs.length).toBeGreaterThan(0)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const c of CAPTURES as readonly Capture[])
      for (const other of c.same ?? []) expect(slugs, `${c.slug}'s same`).toContain(other)
  })

  test('every capture has its alt text in every locale', () => {
    const strings: Record<string, Readonly<Record<string, string>>> = { en, es }
    expect(Object.keys(strings).sort()).toEqual([...LOCALES].sort())
    for (const locale of LOCALES)
      for (const c of CAPTURES)
        expect(strings[locale]?.[`alt:${c.slug}`]?.trim(), `${locale} alt:${c.slug}`).toBeTruthy()
  })

  test('every capture has its image for every locale and theme, and no image is outside the registry', () => {
    expect(images.length).toBeGreaterThan(0)
    expect(images.filter((f) => !expected.includes(f))).toEqual([])
    expect(expected.filter((f) => !images.includes(f))).toEqual([])
  })

  test('every committed image is the one signed off in reviewed.json', () => {
    const reviewed: Record<string, string> = JSON.parse(readFileSync(join(DIR, REVIEWED), 'utf8'))
    expect(images.length).toBeGreaterThan(0)
    const unsigned = images.filter((f) => {
      const hash = createHash('sha256')
        .update(readFileSync(join(DIR, f)))
        .digest('hex')
      return reviewed[f.replace(/\.png$/, '')] !== hash
    })
    expect(
      unsigned,
      'changed since someone opened it: open it, then npm run captures:reviewed',
    ).toEqual([])
  })

  test('every shot: in a page names a capture of the registry', () => {
    const slugs = new Set<string>(CAPTURES.map((c) => c.slug))
    const pages = filesUnder(DOCS).filter((f) => /\.mdx?$/.test(f))
    expect(pages.length).toBeGreaterThan(0)
    const unknown = pages.flatMap((f) =>
      [...readFileSync(join(DOCS, f), 'utf8').matchAll(/\]\(shot:([^)\s]+)\)/g)]
        .map((m) => m[1] ?? '')
        .filter((slug) => !slugs.has(slug))
        .map((slug) => `${f}: ${slug}`),
    )
    expect(unknown).toEqual([])
  })
})

describe('the importer keeps an image only when it shows the same picture', () => {
  const W = 400
  const H = 250
  const blank = (): Pixels => {
    const data = new Uint8Array(W * H * 4)
    for (let i = 0; i < data.length; i += 4) data.set([239, 241, 245, 255], i)
    return { width: W, height: H, data }
  }
  const paint = (p: Pixels, x0: number, y0: number, w: number, h: number, rgb: number[]) => {
    const data = new Uint8Array(p.data)
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) data.set(rgb, (y * W + x) * 4)
    return { ...p, data }
  }
  // A word's glyphs: 24 strokes of dark text on the light background.
  const word = (p: Pixels) => {
    let out = p
    for (let k = 0; k < 24; k++) out = paint(out, 100 + k * 3, 120, 1, 9, [76, 79, 105])
    return out
  }
  // Antialiasing that moved: as many pixels as the share allows, each by the largest delta.
  const edges = (p: Pixels, count: number, delta: number) => {
    const data = new Uint8Array(p.data)
    for (let k = 0; k < count; k++) data[k * 4 * 7] = 239 - delta
    return { ...p, data }
  }

  test('the bounds are 64 levels in a channel and 0.1 % of the pixels; a tie is within 8 levels', () => {
    expect(MAX_CHANNEL_DELTA).toBe(64)
    expect(MAX_CHANGED_SHARE).toBe(0.001)
    expect(TIE_LEVELS).toBe(8)
  })

  test('antialiasing within the delta, on few pixels, is the same picture', () => {
    const allowed = Math.floor(W * H * MAX_CHANGED_SHARE)
    expect(samePicture(blank(), edges(blank(), allowed, MAX_CHANNEL_DELTA))).toBe(true)
  })

  test('a changed word is a new picture', () => {
    expect(samePicture(blank(), word(blank()))).toBe(false)
  })

  test('both bounds hold: a small delta on too many pixels, or one pixel past the delta, is a new picture', () => {
    const allowed = Math.floor(W * H * MAX_CHANGED_SHARE)
    expect(samePicture(blank(), edges(blank(), allowed + 1, 1))).toBe(false)
    expect(samePicture(blank(), edges(blank(), 1, MAX_CHANNEL_DELTA + 1))).toBe(false)
  })

  test('a near tie keeps the committed colour, so the same capture reads as the same picture', () => {
    // The committed file holds two colours 6 levels apart; the quantizer drew a pixel halfway
    // between them with the farther one, everywhere in the lower half.
    const committed = paint(blank(), 0, 0, W, H / 2, [100, 100, 100])
    const reduced = paint(committed, 0, H / 2, W, H / 2, [106, 106, 106])
    const raw = paint(blank(), 0, 0, W, H, [102, 102, 102])
    const drawn = onPalette(raw, reduced)
    expect(drawn.data.subarray((H - 1) * W * 4, (H - 1) * W * 4 + 3)).toEqual(
      new Uint8Array([106, 106, 106]),
    )
    expect(samePicture(drawn, reduced)).toBe(true)
  })

  test('a changed word drawn on the committed palette is still a new picture', () => {
    const reduced = word(blank())
    const raw = paint(blank(), 0, 0, 1, 1, [76, 79, 105])
    expect(samePicture(onPalette(raw, reduced), reduced)).toBe(false)
    expect(samePicture(onPalette(reduced, raw), raw)).toBe(false)
  })

  test('a different size is a new picture', () => {
    expect(samePicture(blank(), { width: H, height: W, data: blank().data })).toBe(false)
  })
})
