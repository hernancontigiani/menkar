// Pane geometry, without the DOM: the renderer passes the rectangles of the visible panes.
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type Direction = 'left' | 'right' | 'up' | 'down'

// Among the panes whose center lies strictly ahead of the focused one's along that axis, the
// nearest, with the sideways offset counted double; none ahead keeps the focus where it is.
export function focusTarget(rects: readonly Rect[], focused: number, direction: Direction): number {
  const from = rects[focused]
  if (!from) return focused
  const cx = (r: Rect) => r.x + r.width / 2
  const cy = (r: Rect) => r.y + r.height / 2
  let best = focused
  let bestDistance = Number.POSITIVE_INFINITY
  rects.forEach((r, i) => {
    if (i === focused) return
    const dx = cx(r) - cx(from)
    const dy = cy(r) - cy(from)
    const [ahead, sideways] =
      direction === 'right'
        ? [dx, dy]
        : direction === 'left'
          ? [-dx, dy]
          : direction === 'down'
            ? [dy, dx]
            : [-dy, dx]
    if (ahead <= 0) return
    const distance = ahead + 2 * Math.abs(sideways)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  })
  return best
}
