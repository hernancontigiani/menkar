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

- Built: `docs/preferences.md` describes how; plan 12 built it.

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

- USG-1 to USG-50, USG-52, USG-53 and USG-55 to USG-69: built (USG-44 to USG-53 by plan 12, in `e2e/usage-window.spec.ts` and `tests/core/usage/{chart,stepper}.test.ts`); the Vitest tests in `tests/core/usage/` carry these ids.

**Window**

- **USG-51** Limits reported 41.4 and 12.6 → footer "Blocked waiting on you: 0m   5-hour limit 41%
  · 7-day 13%" then the estimate line.
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
