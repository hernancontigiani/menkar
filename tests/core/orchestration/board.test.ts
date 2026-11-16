// Decision 1.126: the Board is a panel whose default height fits two cards per column, whose
// "Show all" fits every card up to 70 % of the right-hand area, and which never takes the shell
// drawer's height nor leaves the agent's pane under six rows.
import { describe, expect, test } from 'vitest'
import {
  boardCap,
  defaultBoardHeight,
  MIN_PANE_ROWS,
  showAllHeight,
} from '../../../src/core/orchestration/board'

const sizes = { bar: 24, heading: 16, card: 50, gap: 6, padding: 18, scrollbar: 0 }

describe('the Board panel’s heights', () => {
  test('the default fits the bar, a heading and two cards with their gaps, whatever the window', () => {
    expect(defaultBoardHeight(sizes)).toBe(24 + 18 + 16 + 2 * (6 + 50))
    expect(defaultBoardHeight({ ...sizes, card: 60 })).toBe(24 + 18 + 16 + 2 * (6 + 60))
  })

  // The columns keep a minimum width: on a narrow right-hand area the panel scrolls sideways, and
  // its scrollbar must not cover the second card.
  test('a sideways scrollbar of 14 px adds 14 px to the default', () => {
    expect(defaultBoardHeight({ ...sizes, scrollbar: 14 })).toBe(defaultBoardHeight(sizes) + 14)
  })

  test('Show all fits every card, at most 70 % of the right-hand area', () => {
    expect(showAllHeight(300, 1000)).toBe(300)
    expect(showAllHeight(900, 1000)).toBe(700)
    expect(showAllHeight(900, 555)).toBe(388)
  })

  test('the cap keeps the drawer’s height and six rows of the agent’s pane', () => {
    expect(MIN_PANE_ROWS).toBe(6)
    const area = { area: 800, strip: 30, drawer: 240, row: 17, chrome: 10 }
    expect(boardCap(area)).toBe(800 - 30 - 240 - (6 * 17 + 10))
    expect(boardCap({ ...area, drawer: 0 })).toBe(800 - 30 - (6 * 17 + 10))
    expect(boardCap({ ...area, area: 300 })).toBe(0)
  })
})
