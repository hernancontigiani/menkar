# Usage — turns, time, tokens, cost, the history, the Usage window, `menkar usage`

How long Claude worked and how many tokens it used, per session and per project: what a **turn** is,
**execution** and **blocked** time, **tokens** deduplicated across transcripts, the **list-price
cost** (and the exact cost when the statusline reported it), the permanent **usage history**
(SQLite) with its newer-version and unreadable-file handling, the **hourly pass**, the **Usage
window** (main menu → Usage, **M4**) and the **`menkar usage`** command. Also how categories
**appear** in usage while classification is on (the classification itself is `classifier.md`'s).
Index rows: **F38**, **F39**, **F40**, **F41**, **M4**. No keyboard shortcut belongs to this area.

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

- Built: `docs/classifier.md` describes how; `src/core/usage/` holds it.

### The usage history file (F39)

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The passes

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Periods

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The report

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The Usage window (F40, M4)

- Built (2026-11-18): `docs/preferences.md` describes how it is wired, `docs/usage.md` how its
  figures are read. What the user sees:
  - **A left bar of three sections**, 180 px, as Settings' list: **Spend**, **Your time**, **Task
    times** (decision 1.184), Up and Down moving through them. The window opens on Spend, 7 days.
  - **The scope at the bar's foot**, under a dim "Projects": the opener window's project and "All
    projects", one pressed. It is shown only when the window has an opener; the scope chosen holds
    in every section (decision 1.15).
  - **The header holds only the section's period**: Spend — Today, 7 days, 30 days, Month; Your time
    — Day, Week; Task times — Today, 7 days, 30 days (Today added 2026-11-19).
  - **Spend** is the Totals and By day of before, with the metric, the stack, the month stepper and
    the footer, unchanged.
  - **Your time**, the human's own activity. **Day**: a stepper over the day's name; "Active 4.1h ·
    3 burst(s) · 38 messages sent · 6 prompts answered"; the bursts as bands on a lane (a burst of
    one action a tick, ‹ or › where the day clips one), away hatched, and per hour the messages sent
    and prompts answered as two bars, the hours 00–23 under them, a dashed "now" on today, "No
    activity on this day." on an empty one. A hover on a band shows its whole start – end and
    length, the part on this day when it is clipped, its counts and, in All projects, its messages
    per project ("Shop 29 · Blog 12"). **Week**: one row per day — its strip, Active, Messages sent,
    Prompts — and a Total; a click on a row (or Enter) opens that day. The arrows stop at today and
    at the history's first day. The footer says what a burst is (actions less than 10 min apart;
    away ends one) and that messages typed while an agent works are not counted yet.
  - **Task times**, how long tasks spent in each state: "14 tasks · 9 done · 1 dropped · 4 open",
    with "◦ 3 from their baseline" when some tasks were already open when recording began; a table
    of Queued, In progress, Waiting and To review, each with its waiters folded under it (▾/▸, kept
    while the window is open; To review lists its four waiters always, an empty one dim with "—"),
    and per row the tasks, the median per task, the total and a share bar. The footer explains the
    median and the total and, with a baseline, from when those tasks are counted. With no task the
    card says "No tasks in this project in these 7 days." (or 30, "today", or "in any project").
  - **The period carries across sections** (decision 1.184, the reading decided 2026-11-18): a
    period picked in one section is taken by the next when that section has the same span (Today,
    7 days, 30 days; Today is Day on today, 7 days the current week); otherwise the section keeps
    its own. The periods last while the window is open, not across openings.
  - While an answer is on its way the body shows the turning star; the bar, its foot and the header
    stay usable, and a late answer to an older choice is dropped (decision 1.131).

### `menkar usage` (F41)

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

## Data contracts

### Transcript fields read (`~/.claude/projects/**.jsonl`, never written)

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The history — `$XDG_DATA_HOME/menkar/history.sqlite`

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The cache — `$XDG_CACHE_HOME/menkar/usage.sqlite`

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### The statusline's log — `$XDG_CACHE_HOME/menkar/usage.jsonl`

- Built: `src/core/usage/statusline.ts` reads it; `docs/context.md` describes the writer.

### The price table

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Memberships

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

### Paths and environment

- Built: `docs/usage.md` describes how; `src/core/usage/` holds it.

## Acceptance cases

- Built and tested: the Vitest tests in `tests/core/usage/`, `tests/core/latest.test.ts` and `e2e/usage-window.spec.ts` carry the USG ids; the sections, the scope and the carry are `e2e/usage-sections.spec.ts`, Your time `e2e/usage-time.spec.ts`, Task times `e2e/usage-tasks.spec.ts`.

## Look

- Built: `src/renderer/usage.ts` and `usage.css` (the window and its left bar), `usage-spend.ts`, `usage-time.ts` and `usage-time.css`, `usage-tasks.ts` and `usage-tasks.css`; LOOK-50 and LOOK-51 in `e2e/usage-window.spec.ts` assert the series colors and the Totals card. Reference screenshots: `img/usage-*.png` (Spend); the three sections' specs save theirs, dark and light, under `test-results/usage-{sections,time,tasks}/`.
