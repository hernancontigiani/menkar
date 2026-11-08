# Usage — turns, time, tokens, cost, the history, the Usage window, `menkar usage`

How long Claude worked and how many tokens it used, per session and per project: what a **turn** is,
**execution** and **blocked** time, **tokens** deduplicated across transcripts, the **list-price
cost** (and the exact cost when the statusline reported it), the permanent **usage history**
(SQLite) with its newer-version and unreadable-file handling, the **hourly pass**, the **Usage
window** (main menu → Usage, **M4**) and the **`menkar usage`** command. Also how categories
**appear** in usage while classification is on (the classification itself is `classifier.md`'s),
and, for **F14** (Menkar decision 1.8), how Menkar's first start imports agent-tablet's usage
history. Index rows: **F38**, **F39**, **F40**, **F41**, **M4**, and the usage-history part of
**F14**. No keyboard shortcut belongs to this area.

## Behaviour

### Where the numbers come from

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The turn

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Execution and blocked time

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Tokens and deduplication

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Cost

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Names and projects

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Categories in usage (while classification is on)

The classification (which turns, how, failures) is `classifier.md`'s. Here, only how it shows:

- **Off** (the default): reports are project → session; the category is never read.
- **On**: the window's Totals are **project → category → session**, By day gains a
  **`[Project | Category]`** stack switch, and `menkar usage --json` carries the category level.
  The **text** report of `menkar usage` stays project → session.
- The seven categories, in this fixed order: `plan`, `design`, `build`, `test`, `deploy`,
  `maintain`, `other`, shown as "Plan", "Design", "Build", "Test", "Deploy", "Maintain", "Other";
  turns with none are **"(unclassified)"**, shown as "Unclassified", always last.
- **A `human` turn shows its own category. Any other origin** (`peer`, `task_notification`,
  `system`, `sdk`, **and `unknown`**) takes the category of its session's latest `human` turn
  opened before it (ties by id); with none, or one not yet classified, "(unclassified)". This is
  resolved when the report is built, never written, so a late classification reaches the turns
  after it.
  *Contradiction, for the human to decide:* agent-tablet's `docs/usage.md` names only
  peer / task_notification / system as inheriting, and its earlier-turns run classifies `unknown`
  turns; but its report makes `unknown` inherit too, so an `unknown` turn's own category is never
  shown (and in a pre-`turnOrigin` transcript, which has no `human` turn, it is always
  "(unclassified)"). This spec states the code's behaviour.
- The statusline's exact cost goes to the category of the turn in effect when it was reported.
- Each category keeps one color everywhere (Look); "(unclassified)" is gray.

### The usage history file (F39)

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The passes

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Periods

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The report

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The Usage window (F40, M4)

**Opening.** Main menu → **Usage** opens a window titled **"Usage"**, 760 × 600 by default,
attached to the main window it was opened from. One per main window: choosing Usage again while it
is shown brings it forward. The first time, it shows a status page **"Reading the transcripts…"**
(a loading icon) while it runs a pass and builds the report off the UI thread; later refreshes keep
the previous report on screen until the new one is ready. A result that arrives after the user
chose another period (or month) is discarded.

**Too new.** A history from a newer Menkar replaces the whole content with a status page: title
**"Usage history is from a newer version of Menkar"**, description **"It was left as it is. Update
the app to see it."**, a warning icon.

**Header**: a linked group of four toggle buttons as the title — **"Today"**, **"7 days"** (chosen
when the window opens), **"30 days"**, **"Month"** — and the window's close button.

**Month.** Choosing Month shows a row above the views: ‹ (tooltip "Previous month"), the month's
name in the user's language ("October 2026"), › (tooltip "Next month"), and an **"All"** toggle.
- It starts at the current month.
- ‹ is disabled at the first month with data (the month of the first turn in the history); with
  an empty history it stays enabled. › is disabled at the current month. Both are disabled while
  All is on.
- **All** on: the label reads "All" and the period is the whole history, by month. Pressing ‹ or ›
  while All is on turns All off and shows the stepped month.
- Leaving Month for another period hides the row; All keeps its state, so choosing Month again
  with All on shows All.
- A period, a month step and All each refresh (a pass, then the report).

**Views**: a centered row with a linked pair **"Totals"** / **"By day"** (Totals when opened); in
By day it adds a linked trio **"Exec"** / **"Tokens"** / **"Cost"** (Exec when opened) and, while
classification is on, a pair **"Project"** / **"Category"** (Project when opened). The By-day label
stays "By day" when the bars are hours (Today) or months (All). Switching view, metric or stack
redraws without a new pass.

**Totals** (the table):
- A heading line: **"Project / session"** (dim) and the right-aligned column titles **"Exec"**,
  **"Blocked"**, **"Tokens"**, **"Cost"**.
- One row per project, then its children (sessions; with categories, categories then sessions),
  indented 18 px per level. A row with children has an arrow button (pointing down when expanded,
  right when collapsed); a click collapses or expands it. All rows start expanded; the collapsed
  set lasts while the window is open. A leaf has an invisible arrow-sized spacer, so names line up.
- Project names are bold. Category rows show the translated category name.
- **Exec** cell tooltip: **"Started by: {parts}"**, the parts `"<origin> <duration>"` sorted by
  origin name and joined by ", " — e.g. "Started by: human 1.2h, peer 3m". Origins are shown as
  their raw keys.
- No rows in the period → a single line **"Nothing in this period."**
- **Formats** (shared with the CLI): a duration of an hour or more is hours with one decimal
  (`2.7h`); under an hour, whole minutes rounded (`52m`, `0m`; 59 m 40 s shows `60m`); tokens of a
  million or more are millions with one decimal (`1.4M`), otherwise whole thousands rounded
  (`456k`, `0k`); cost as above (`~$0.68`, `$0.68`, `~$0.68+`).

**By day** (the chart): one bar per bucket on a shared axis, stacked, with a legend below.
- **Stacked by project**: the five projects largest over the whole period by the chosen metric
  (only those above 0) keep a color of their own, ordered by name (case-insensitive) with
  "(no project)" last; the rest are summed into **"Other"** (gray), placed last. A project's color
  is its slot in that order, so a project keeps its color while the top five stay the same.
- **Stacked by category** (only while classification is on): the categories present (above 0 in
  some bar), in their fixed order, "(unclassified)" last, summed across projects; each category
  always has its own slot's color, "(unclassified)" gray.
- Segments are drawn bottom to top in legend order; an empty bucket is an empty slot.
- The axis top is the smallest 1, 2 or 5 × a power of ten at or above the tallest bar (1 when all
  are 0); the labels at 0, half and top are in the metric's format (`0m`, `42m`, `1.4h`; `0k`;
  `$0.00`). Chart values carry no `~` or `+`.
- Bar labels under the axis: the hour (`09`) for Today, the day of the month (`2`) for day
  buckets, the abbreviated month name in the user's language (`Oct`) for All; when they would not
  fit, only every n-th bar is labelled (n = ⌈bars / ⌊plot width / 28⌋⌉).
- **Tooltip** over a bar's slot: a heading — `HH:00` for an hour, the month's full name and year
  for a month, `YYYY-MM-DD` for a day — then one line per series above 0 in that bar,
  `"<name>: <value>"` (e.g. "Client work: 1.3h"); none → "Nothing in this period."
- The legend lists each stacked series: a color square and its name.
- The chart follows the theme: it is redrawn with the dark or light palette when the style changes.

**Footer** (under either view, dim, wrapping):
- `"Blocked waiting on you: {time}"` — the period's total blocked time;
- when the statusline reported limits: three spaces, then `"5-hour limit {five}% · 7-day {seven}%"`
  (whole percents);
- a new line: `"~ is a list-price estimate, not a bill; + means a model with no price."`
- **While classification is off**, a further dim line: **"Turn on “Classify turns” in
  Preferences → Integrations to split each project by category."**

### `menkar usage` (F41)

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### First start: importing agent-tablet's usage history (F14, Menkar decision 1.8)

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

## Data contracts

### Transcript fields read (`~/.claude/projects/**.jsonl`, never written)

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The history — `$XDG_DATA_HOME/menkar/history.sqlite`

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The cache — `$XDG_CACHE_HOME/menkar/usage.sqlite`

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The statusline's log — `$XDG_CACHE_HOME/menkar/usage.jsonl`

Read only here; written by the statusline (`context.md`): `at`, `session_id`, `cost_usd`,
`five_hour_pct`, `seven_day_pct` are used. Lines that are not JSON objects, or lack a string
`session_id`, a numeric `cost_usd` or a parseable `at`, are skipped for cost; for limits only lines
with both percentages numeric count.

### The price table

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Memberships

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Paths and environment

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

## Acceptance cases

- USG-1 to USG-43 and USG-55 to USG-69: built; the Vitest tests in `tests/core/usage/` carry these ids.

**Window**

- **USG-44** Open Usage → "7 days" and "Totals" chosen; the first time, "Reading the transcripts…"
  shows until the report is ready.
- **USG-45** Choose Month on 2026-11-08 → "November 2026", › disabled; history's first turn in
  2026-09 → ‹ enabled at November and October, disabled at September.
- **USG-46** Month, All on → label "All", ‹ › disabled, By day shows one bar per month from the first
  month to November. Turn All off → back to the stepped month.
- **USG-47** Choose "Today", By day → 24 bars labelled by hour; Month → one bar per day; All → one
  per month.
- **USG-48** Seven projects with time in the period, By day, Exec → five named series sorted by name
  plus "Other" (gray) last; the legend shows six entries.
- **USG-49** A bar's tooltip on 2026-11-04 with Client work 1.3h and Default 52m → "2026-11-04",
  "Client work: 1.3h", "Default: 52m"; an empty day → "2026-11-05", "Nothing in this period."
- **USG-50** No turns in the period → the table shows "Nothing in this period."; footer "Blocked
  waiting on you: 0m".
- **USG-51** Limits reported 41.4 and 12.6 → footer "Blocked waiting on you: 0m   5-hour limit 41%
  · 7-day 13%" then the estimate line.
- **USG-52** Exec cell of a session with human 4,320 s and peer 360 s → shows "1.3h", tooltip
  "Started by: human 1.2h, peer 6m".
- **USG-53** Collapse "Client work" → its sessions disappear and its arrow points right; switch to
  By day and back → still collapsed.
- **USG-54** Pick "30 days" then "Today" quickly → only the Today report is shown, whichever
  finishes first.

## Look

Screenshots: `img/usage-totals-dark.png` (Totals, 7 days, classification off), `img/usage-by-day-dark.png`
(By day, Exec, stacked by project), `img/usage-month-dark.png` (Month with the stepper, the footer
and the hint), `img/usage-by-category-dark.png` (Totals with categories: project → Unclassified →
session). Light copies: `img/usage-totals-light.png`, `img/usage-by-day-light.png`,
`img/usage-month-light.png`, `img/usage-by-category-light.png`. The window's colors follow the
color theme (`preferences.md`, `look.md`); only the chart's series colors below are fixed.

**Window**: 760 × 600 default; header bar with the period toggles as its title; content scrolls.
Body margins 12 px on all sides; 12 px between the stepper, the views row, the table or chart, the
footer and the hint.

**Toggles**: linked groups of toggle buttons (one chosen at a time, highlighted); the views row is
centered with 12 px between its groups.

**Month stepper**: centered, 6 px spacing: flat ‹ button (icon `go-previous-symbolic`, a left
chevron), the month label (bold "heading" style, 16 characters wide), flat › button
(`go-next-symbolic`), and the "All" toggle.

**Table**: the heading line has 12 px side margins and 12 px spacing; "Project / session" dim. The
list is a boxed list (rounded card, separators between rows). Each row: 6 px top and bottom margin,
12 px spacing, left margin 12 + 18 px per depth, right margin 12 px. The expand arrow is a flat
button with `pan-down-symbolic` (a down-pointing triangle) when expanded and `pan-end-symbolic`
(right-pointing) when collapsed. The name expands and ellipsizes at the end. The four number
columns are right-aligned, tabular figures, 7 / 8 / 8 / 9 characters wide. Project names in the
bold "heading" style; category and session names regular. "Nothing in this period." has 12 px
above and below.

**Chart**: 260 px tall, full width; plot margins left 64, bottom 22, top 10, right 8 px. Three
horizontal lines at 0, half and top, 1 px, in the foreground color at opacity 0.35 (the base line)
and 0.12 (the other two); axis labels in "Sans 8" at opacity 0.7, right-aligned 6 px left of the
plot, vertically centered on their line. Bar width = 70 % of its slot, clamped to 2–28 px, centered
in the slot; bucket labels "Sans 8", opacity 0.7, centered under the bar. Segments stack bottom to
top with a 2 px gap of background between them (a segment is at least 1 px); the top segment has
rounded top corners of radius min(4 px, half the bar, its height). The chart box puts 8 px between
the chart and the legend. Legend: centered, 18 px between entries; each entry a 12 × 12 px square
of the series color and its name, 6 px apart.

**Series colors** (fixed slots; projects use slots 1–5 by their place in the order; categories one
slot each, in order plan, design, build, test, deploy, maintain, other):

| Slot | Category | Light | Dark |
|---|---|---|---|
| 1 | plan | `#2a78d6` | `#3987e5` |
| 2 | design | `#eb6834` | `#d95926` |
| 3 | build | `#1baf7a` | `#199e70` |
| 4 | test | `#eda100` | `#c98500` |
| 5 | deploy | `#e87ba4` | `#d55181` |
| 6 | maintain | `#008300` | `#008300` |
| 7 | other | `#6250d6` | `#9085e9` |
| — | "Other" projects, "(unclassified)" | `#8a8986` | `#8f8e8a` |

Validated for color-vision deficiencies against light and dark view backgrounds; three light slots
are under 3:1 against white, which is accepted because the legend and the tooltip name every value
and Totals is the table.

**Footer and hint**: dim text, left-aligned, wrapping.

**Status pages**: "Reading the transcripts…" with a loading icon (`content-loading-symbolic`); the
too-new page with a warning icon (`dialog-warning-symbolic`, a triangle with an exclamation mark).
