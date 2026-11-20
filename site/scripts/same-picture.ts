// Whether two captures show the same picture. Chromium's glyph antialiasing in a terminal varies by
// a few levels from one run to the next on the same screen, so exact pixels would rewrite every
// image every run; a changed word or number moves glyph pixels by far more than that.

export interface Pixels {
  readonly width: number
  readonly height: number
  // RGBA, one byte per channel.
  readonly data: Uint8Array
}

// The largest difference in any colour channel a pixel may show and still count as unchanged.
export const MAX_CHANNEL_DELTA = 64
// The largest share of the image's pixels that may differ at all.
export const MAX_CHANGED_SHARE = 0.001

export interface Tolerance {
  readonly maxChannelDelta: number
  readonly maxChangedShare: number
}

const DEFAULT: Tolerance = {
  maxChannelDelta: MAX_CHANNEL_DELTA,
  maxChangedShare: MAX_CHANGED_SHARE,
}

export interface Difference {
  // Pixels that differ at all, and the largest difference in any colour channel among them.
  readonly changed: number
  readonly maxDelta: number
}

// How two pictures of the same size differ; null when their sizes differ.
export function difference(a: Pixels, b: Pixels): Difference | null {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return null
  let changed = 0
  let maxDelta = 0
  for (let i = 0; i < a.data.length; i += 4) {
    let delta = 0
    for (let c = 0; c < 3; c++)
      delta = Math.max(delta, Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0)))
    if (delta === 0) continue
    changed += 1
    if (delta > maxDelta) maxDelta = delta
  }
  return { changed, maxDelta }
}

// Both must hold: every differing pixel within the channel delta, and few of them.
export function samePicture(a: Pixels, b: Pixels, tolerance: Tolerance = DEFAULT): boolean {
  const d = difference(a, b)
  return (
    d !== null &&
    d.maxDelta <= tolerance.maxChannelDelta &&
    d.changed <= a.width * a.height * tolerance.maxChangedShare
  )
}

// `raw` drawn with only the colours `reduced` uses, each pixel the nearest of them. A committed
// image is reduced to a palette the quantizer picks from the whole picture, and a few pixels moved
// by antialiasing can make it pick another one: comparing a new capture through the old palette
// asks whether the picture changed, not whether the palette did.
export function onPalette(raw: Pixels, reduced: Pixels): Pixels {
  const palette: number[][] = []
  const seen = new Set<number>()
  for (let i = 0; i < reduced.data.length; i += 4) {
    const rgb =
      ((reduced.data[i] ?? 0) << 16) |
      ((reduced.data[i + 1] ?? 0) << 8) |
      (reduced.data[i + 2] ?? 0)
    if (seen.has(rgb)) continue
    seen.add(rgb)
    palette.push([rgb >> 16, (rgb >> 8) & 255, rgb & 255])
  }
  const nearest = new Map<number, number[]>()
  const data = new Uint8Array(raw.data.length)
  for (let i = 0; i < raw.data.length; i += 4) {
    const r = raw.data[i] ?? 0
    const g = raw.data[i + 1] ?? 0
    const b = raw.data[i + 2] ?? 0
    const rgb = (r << 16) | (g << 8) | b
    let best = nearest.get(rgb)
    if (!best) {
      let distance = Number.POSITIVE_INFINITY
      for (const p of palette) {
        const d = ((p[0] ?? 0) - r) ** 2 + ((p[1] ?? 0) - g) ** 2 + ((p[2] ?? 0) - b) ** 2
        if (d < distance) {
          distance = d
          best = p
        }
      }
      best ??= [r, g, b]
      nearest.set(rgb, best)
    }
    data.set(best, i)
    data[i + 3] = raw.data[i + 3] ?? 255
  }
  return { width: raw.width, height: raw.height, data }
}
