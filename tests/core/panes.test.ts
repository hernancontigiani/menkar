import { describe, expect, test } from 'vitest'
import { focusTarget, type Rect } from '../../src/core/panes'

const left: Rect = { x: 0, y: 0, width: 100, height: 100 }
const right: Rect = { x: 100, y: 0, width: 100, height: 100 }
const top: Rect = { x: 0, y: 0, width: 200, height: 50 }
const bottom: Rect = { x: 0, y: 50, width: 200, height: 50 }

describe('focus by direction', () => {
  test('TRM-34 from the right pane, left goes to the agent; again stays; up stays', () => {
    expect(focusTarget([left, right], 1, 'left')).toBe(0)
    expect(focusTarget([left, right], 0, 'left')).toBe(0)
    expect(focusTarget([left, right], 0, 'up')).toBe(0)
    expect(focusTarget([left, right], 0, 'right')).toBe(1)
  })

  test('stacked panes: down and up', () => {
    expect(focusTarget([top, bottom], 0, 'down')).toBe(1)
    expect(focusTarget([top, bottom], 1, 'up')).toBe(0)
    expect(focusTarget([top, bottom], 1, 'right')).toBe(1)
  })

  test('the nearest wins, the sideways offset counted double', () => {
    const from: Rect = { x: 0, y: 40, width: 10, height: 10 }
    const ahead: Rect = { x: 50, y: 40, width: 10, height: 10 }
    const diagonal: Rect = { x: 20, y: 0, width: 10, height: 10 }
    // ahead: 50 + 0; diagonal: 20 + 2 × 40 = 100
    expect(focusTarget([from, ahead, diagonal], 0, 'right')).toBe(1)
  })
})
