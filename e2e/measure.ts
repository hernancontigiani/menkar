import type { ElectronApplication, Page } from '@playwright/test'

// The color the window really shows at a point, as #rrggbb: what the compositor drew, so
// transparency over whatever lies beneath is already resolved.
export async function pixel(
  app: ElectronApplication,
  x: number,
  y: number,
  windowIndex = 0,
): Promise<string> {
  return app.evaluate(
    async ({ BrowserWindow }, [px, py, index]) => {
      const win = BrowserWindow.getAllWindows()[index ?? 0]
      if (!win) return 'no window'
      const image = await win.webContents.capturePage({
        x: px ?? 0,
        y: py ?? 0,
        width: 1,
        height: 1,
      })
      const [b, g, r] = image.toBitmap()
      return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`
    },
    [x, y, windowIndex],
  )
}

// The pixel at an element's point, `dx`/`dy` from its top-left corner (negative: from the
// bottom-right one).
export async function pixelOf(
  app: ElectronApplication,
  page: Page,
  selector: string,
  dx = 2,
  dy = 2,
): Promise<string> {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) return 'missing'
  const x = dx >= 0 ? box.x + dx : box.x + box.width + dx
  const y = dy >= 0 ? box.y + dy : box.y + box.height + dy
  return pixel(app, Math.floor(x), Math.floor(y))
}

// Within `step` per channel: the spec's measured values carry their rounding.
export function near(actual: string, expected: string, step = 2): boolean {
  const ch = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const a = ch(actual)
  return ch(expected).every((v, i) => Math.abs((a[i] ?? -99) - v) <= step)
}

export async function style(
  page: Page,
  selector: string,
  properties: readonly string[],
): Promise<Record<string, string>> {
  return page.evaluate(
    ([sel, props]) => {
      const node = document.querySelector(sel as string)
      if (!node) return { missing: 'true' }
      const computed = getComputedStyle(node)
      return Object.fromEntries((props as string[]).map((p) => [p, computed.getPropertyValue(p)]))
    },
    [selector, properties] as const,
  )
}
