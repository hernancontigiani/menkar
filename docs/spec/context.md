# Context — the context ring, the statusline, `--settings`, the integrations page

How full each session's context window is, shown as a small ring by the session's row and on its
tab; where that figure comes from (Claude Code's statusline command, which Menkar provides, or an
estimate from the transcript); how the statusline reaches the sessions Menkar starts (`--settings`,
writing nothing under `~/.claude`) and, only when the user turns it on, every Claude session (the
Integrations page of Preferences). The statusline also records the exact cost and the
subscription's limits, which `usage.md` reads. Index rows: **F35** (the ring), **F36** (the
statusline through `--settings`), **F37** (the Integrations page). No keyboard shortcut or menu item
belongs to this area; the Integrations page is reached through Preferences (M5, K9, K37 —
`preferences.md`), and its second group, "Classify turns", is specified in `classifier.md`.

## Behaviour

### The context ring (F35)

- **Where.** One ring in each session row of the project list (between the name/folder text and the
  row's ⋯ button), and one on each tab of the tab strip (after the group color swatch and the state
  dot, before the title). History rows (Add session → Existing) have none.
- **No reading, no ring.** A session with neither a statusline report nor any assistant message in
  its transcript shows no ring (the widget is hidden, not drawn empty). A tab shows a ring only
  when at least one of its sessions has a reading.
- **The tab's ring** shows the **fullest** reading among the tab's sessions (the pane about to run
  out is what matters): the reading with the highest percentage.
- **Level and color**, from the percentage: below 60 → green ("ok"); 60 up to below 80 → yellow
  ("warn"); 80 and above → red ("full"). The thresholds are inclusive at 60 and 80.
- **Fill.** The ring fills clockwise from 12 o'clock in proportion to the percentage, clamped to
  0–100 (a reading above 100 draws a full ring, the tooltip still says the real figure).
- **Exact vs estimate.** A statusline reading is drawn opaque; an estimate is drawn faint (see
  Look) and its tooltip says so.
- **Tooltip** (the exact figure, rounded to a whole percent; the window as `200k` or `1M`):
  - statusline: `"{pct}% of {window}"` — e.g. "47% of 200k";
  - estimate: `"~{pct}% of {window} (estimate)"` — e.g. "~31% of 200k (estimate)".
  The window label is the whole number of millions followed by `M` when the window is 1,000,000
  tokens or more, otherwise the whole number of thousands followed by `k` (integer division:
  1,500,000 → "1M", 200,000 → "200k").

**Where the reading comes from** — built: `docs/context.md` describes how; `src/core/` holds it.

### The statusline (F36)

- Built: `docs/context.md` describes how; `src/core/` holds it.

### `--settings` (F36)

- Built: `docs/context.md` describes how; `src/core/` holds it.

### The Integrations page (F37)

Preferences has a second page, **"Integrations"** (icon: a puzzle piece,
`application-x-addon-symbolic`), listing what Menkar may add to `~/.claude/settings.json` — one
switch per piece, **all off until the user turns them on**, each removable on its own. Today one
piece:

- Group title: **"Claude Code settings"**; group description: **"Each piece is added to
  ~/.claude/settings.json only when you turn it on, and taken out when you turn it off. A copy of
  the file is kept before every change."**
- Switch row: title **"Status line in every Claude session"**, subtitle **"Context and usage for
  sessions started outside Menkar too. Your own status line, if you have one, keeps showing."**
- The page's second group, "Classify turns", is `classifier.md`'s.

**The switch's state, turning it on and off** — built: `docs/context.md` describes how; `src/core/` holds it.

**Errors.** A refused change shows a **toast for 8 seconds** with one of these sentences (with
`{path}` the full path of the settings file), and the switch goes back to what the files say,
without trying the change again:

| Case | Toast |
|---|---|
| The settings file exists but cannot be read | `"{path} could not be read."` |
| It is not valid JSON | `"{path} is not valid JSON; it was left as it is."` |
| It holds JSON that is not an object | `"{path} does not hold a JSON object; it was left as it is."` |
| Off, but its `statusLine` changed since the install | `"The status line in {path} changed since it was installed; it was left as it is."` |

agent-tablet's `docs/context.md` says the switch "says why" a removal was refused; the code shows a
toast instead, as above.

## Data contracts

### What Claude Code passes to the statusline (stdin)

- Built: `docs/context.md` describes how; `src/core/` holds it.

### The session file — `$XDG_CACHE_HOME/menkar/sessions/<session_id>.json`

- Built: `docs/context.md` describes how; `src/core/` holds it.

### The usage log — `$XDG_CACHE_HOME/menkar/usage.jsonl`

- Built: `docs/context.md` describes how; `src/core/` holds it.

### The transcript fields the estimate reads

- Built: `docs/context.md` describes how; `src/core/` holds it.

### Menkar's files for this area

- Built: `docs/context.md` describes how; `src/core/` holds it.

### What is written under `~/.claude`

- Built: `docs/context.md` describes how; `src/core/` holds it.

## Acceptance cases

- CTX-1 to CTX-39: built; the Vitest tests in `tests/core/context/` carry these ids.

## Look

Screenshots: `img/context-rings-dark.png` (rings in the project list: yellow on "JWT auth", faint
estimates on the others), `img/tab-ring-dark.png` (a ring on a tab), `img/integrations-dark.png`
(the Integrations page; the screenshot tool draws the page too narrow, so the switch row wraps
letter by letter — the real dialog lays out the row on one line). Light copies:
`img/context-rings-light.png`, `img/tab-ring-light.png`, `img/integrations-light.png`.

**The ring**

| Property | Value |
|---|---|
| Size | 14 × 14 px, vertically centered in its row / tab |
| Stroke | 2.5 px; radius = half the smaller side − 1.5 px (5.5 px) |
| Track | the full circle in the level's color at 25 % of the ring's opacity |
| Arc | from 12 o'clock clockwise, length = percentage (clamped 0–100) of the circle |
| Colors (both themes) | ok `#66BF73` (0.40, 0.75, 0.45); warn `#F2BF40` (0.95, 0.75, 0.25); full `#EB5454` (0.92, 0.33, 0.33) |
| Opacity | statusline 1.0 (track 0.25); estimate 0.45 (track 0.1125) |
| Hidden | when there is no reading |

The colors do not follow the color theme: the same three in every theme, light and dark.

**The statusline bar** is plain text in Claude Code's own UI: name, percentage and cost separated by
` · `.

**The Integrations page** is a standard preferences page: the page tab shows a puzzle-piece icon and
"Integrations" beside "General"; the group has a bold title, a dim description paragraph, and a
boxed list holding one switch row (title, dim subtitle, the switch at the right). The toast appears
at the bottom of the Preferences dialog.
