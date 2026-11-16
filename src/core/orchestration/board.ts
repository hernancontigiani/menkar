// The Board panel's heights (decision 1.126), from sizes the renderer measures.

export interface BoardSizes {
  // The panel's own bar, with Show all, Default size and ×.
  readonly bar: number
  readonly heading: number
  readonly card: number
  // Between a column's heading and each card.
  readonly gap: number
  // The columns' and the panel's vertical padding, together.
  readonly padding: number
  // The panel's sideways scrollbar, 0 while the columns fit at their minimum width.
  readonly scrollbar: number
}

export const DEFAULT_CARDS = 2
export const SHOW_ALL_SHARE = 0.7
export const MIN_PANE_ROWS = 6

export function defaultBoardHeight(s: BoardSizes): number {
  return s.bar + s.padding + s.heading + DEFAULT_CARDS * (s.gap + s.card) + s.scrollbar
}

// `area` is the right-hand area's height under the header.
export function showAllHeight(content: number, area: number): number {
  return Math.min(content, Math.floor(area * SHOW_ALL_SHARE))
}

export interface BoardRoom {
  readonly area: number
  readonly strip: number
  // The shown drawer's height, 0 when hidden: the Board never takes it.
  readonly drawer: number
  readonly row: number
  // The agent's pane's own frame around its rows.
  readonly chrome: number
}

// The tallest the Board may be: the agent's pane keeps its minimum rows under it.
export function boardCap(r: BoardRoom): number {
  return Math.max(0, r.area - r.strip - r.drawer - (MIN_PANE_ROWS * r.row + r.chrome))
}
