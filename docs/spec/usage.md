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

- Built: `docs/preferences.md` describes how; plan 12 built it.

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

- Built and tested: the Vitest tests in `tests/core/usage/`, `tests/core/latest.test.ts` and `e2e/usage-window.spec.ts` carry the USG ids.

## Look

- Built: `src/renderer/usage.ts` and `usage.css`; LOOK-50 and LOOK-51 in `e2e/usage-window.spec.ts` assert the series colors and the Totals card. Reference screenshots: `img/usage-*.png`.
