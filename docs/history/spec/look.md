# History of `docs/spec/look.md`

## Acceptance cases

> Left on 2026-11-08: built by plan 08, described in `docs/window.md`.
- **LOOK-2** Window background (content area, empty state) is `#1e1e2e`; the content header row has
  the same `#1e1e2e` (no separate bar color); the sidebar, including its header row, is `#181825`.
- **LOOK-3** The line between sidebar and content is 1 px of `fg` at 15 % over the background:
  `#38394b` in Mocha.
- **LOOK-6** Press `F9`: the sidebar disappears, the content starts at the window's left edge, the
  toggle is unchecked. Press `F9` again: the sidebar is back at 300 px and the toggle checked.
- **LOOK-23** One open tab "JWT auth" selected: the tab is a square rectangle of accent `#cba6f7`
  with text `#1e1e2e`, measured 34 px tall, starting 6 px right of the divider; the `+` sits right
  after it, 2 px away; the strip's background is `#1e1e2e`.
- **LOOK-37** Theme `Nord`, scheme Dark or Light, Terminal workspace: sidebar `#282d35`, window
  `#2e3440`, selected tab `#b48ead` with text `#2e3440`, unselected tab `#424854`, focused frame
  `#b48ead`, unfocused frame `#505662`, idle dot ring `#a3be8c`.
- **LOOK-39** Theme `Default`, scheme Light, Terminal workspace: window `#eff1f5`, sidebar
  `#e6e9ef`, divider `#d6d9e0` (all measured), selected tab `#8839ef` with text `#eff1f5`,
  unselected tab `#ccd0da` with text `#6c6f85`, terminal background `#eff1f5` and text `#4c4f69`.

## Usage window

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
(Behaviour in `usage.md`; `img/usage-totals-dark.png`, `img/usage-by-day-dark.png`,
`img/usage-month-dark.png`, `img/usage-by-category-dark.png`.)

- A separate window, 760 × 600, titled "Usage", on top of the main window, themed like it (in
  Terminal workspace: `bg` background, monospace).
- Header: the period switch as its title: linked toggle buttons Today | 7 days | 30 days | Month
  (the checked one `fg` at 30 %, measured `#52556a`; the others `fg` at 10 %).
- Body: margins 12 px, items 12 px apart: the month stepper (only for Month: ‹ month name
  (16 characters wide, bold) › and an "All" toggle, 6 px apart, centered); the view row (centered,
  12 px apart: Totals | By day; in By day also Exec | Tokens | Cost and Project | Category); then the
  table or the chart; then the footer (dim, wrapping) and the classification hint (dim).
- **Table**: a heading row (12 px side margins): "Project / session" (dim, filling), then Exec,
  Blocked, Tokens, Cost right-aligned 7, 8, 8, 9 characters wide; then the rows on a boxed list
  (card background, 12 px corners). Each row: margins 6 px top/bottom, 12 px right, left 12 px +
  18 px per depth; a flat ▾/▸ toggle for rows with children (an invisible one keeps the space on
  leaves); the name (bold for projects, ellipsized); the four numbers.
- **Chart**: 260 px tall, full width; plot inset 64 px left, 8 px right, 10 px top, 22 px bottom.
  Three horizontal grid lines at 0, 50 and 100 % of the axis top (the next 1, 2 or 5 × a power of
  ten above the tallest bar), 1 px, the text color at 35 % (base line) and 12 %; their values right-
  aligned 6 px left of the plot at 70 %. Bars: one per bucket, centered in its slot, width
  70 % of the slot clamped to 2–28 px; stacked segments separated by a 2 px gap, the top segment
  with rounded top corners (radius min(4 px, half the bar)); tick labels under the bars at 70 %,
  thinned so ticks stay at least 28 px apart. Legend centered under the chart, items 18 px apart, a
  12 × 12 px square swatch then the name, 6 px apart.
- **Series colors**, by slot (projects use the first five, the largest first; categories one slot
  each in the order Plan, Design, Build, Test, Deploy, Maintain, Other):

| Slot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | "Other" projects / Unclassified |
|---|---|---|---|---|---|---|---|---|
| Light | `#2a78d6` | `#eb6834` | `#1baf7a` | `#eda100` | `#e87ba4` | `#008300` | `#6250d6` | `#8a8986` |
| Dark | `#3987e5` | `#d95926` | `#199e70` | `#c98500` | `#d55181` | `#008300` | `#9085e9` | `#8f8e8a` |

  The light/dark set follows the scheme, not the theme.
