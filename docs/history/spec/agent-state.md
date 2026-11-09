# History of `docs/spec/agent-state.md`

## When the state is read (F30)

> Left on 2026-11-08: built by plan 09, described in `docs/agent-state.md`.
- Every terminal pane that runs an agent is watched; a plain shell pane (a split) never is.
- A check is scheduled whenever the terminal's contents change or its title changes. The first
  change schedules one check **250 ms** later; changes before it runs ride on it (bursts of output
  produce one check).
- A check reads:
  - whether something other than the shell owns the terminal's foreground (the agent is still
    running). If not — back at the shell prompt — the state is **idle**, with no further rule.
  - the **screen**: the text of as many rows as the terminal is tall, ending at the cursor's row
    (rows from *cursor row − terminal rows* up to the cursor row, clamped at 0, all columns), as
    plain text. It is read this way because a pane not on screen must be readable too.
  - the **title** the agent set (OSC title), or "".
- The state is emitted only when it differs from the pane's previous raw state. A new pane starts
  idle.
- Agents other than Claude Code and Cursor are always idle.

## Claude Code's rules

> Left on 2026-11-08: built by plan 09, described in `docs/agent-state.md`.
*Recent* = the last **14** lines of the screen that contain a non-space character, joined by
newlines, lowercased. In order, the first rule that holds decides:

1. *Recent* contains `select model` **and** `enter to set as default` → **idle** (the `/model`
   picker, not a question from the agent).
2. **blocked** when *recent* contains any of:
   - `do you want to proceed?`
   - `waiting for permission`
   - `do you want to allow this connection?`
   - `review your answers`
   - `esc to cancel` together with (`enter to confirm` or `enter to select`)
   - (`do you want to` or `would you like to`) together with `yes` (any occurrence of the letters,
     e.g. inside another word)
3. **working** when the title **starts with** one character in U+2800–U+28FF (the Braille spinner)
   or in U+25D0–U+25D3 (`◐◑◒◓`, Claude Code's spinner since 2.1.228) **followed by a space**
   (case-sensitive; the title is not lowercased) — or when *recent* contains `esc to interrupt`.
4. Otherwise **idle** (Claude Code's idle title begins with "✳ ", which matches no rule).

## Cursor's rules

> Left on 2026-11-08: built by plan 09, described in `docs/agent-state.md`.
*Recent* = the last **10** non-empty lines, lowercased; *bottom* = the last **6** non-empty lines,
lowercased. First rule that holds:

1. **blocked** when *recent*:
   - contains `run this command?` together with (`run (once) (y)` or `skip (esc or n)`), or
   - contains `write to this file?` together with `proceed (y)`, or
   - contains `(y) (enter)`, or `keep (n)`, or `skip (esc or n)`, or
   - has a line that starts with optional spaces, then optionally one non-space character and
     optional spaces, then `allow ` or `run ` (with the space), then anything, then `(y)` on the
     same line.
2. **working** when *bottom* contains `ctrl+c to stop`; or *recent* has a line that starts with
   optional spaces, then one or more Braille characters (U+2800–U+28FF), then whitespace, then a word
   of letters/digits/underscore ending in `ing` at a word boundary (e.g. `⠋ generating`); or
   *recent* contains, at word boundaries, a number from 1 upward (no leading zero), whitespace,
   `background`, whitespace, `task` or `tasks` (e.g. `2 background tasks`).
3. Otherwise **idle**.

The title is not used for Cursor.

## From raw state to shown state: done and seen

> Left on 2026-11-08: built by plan 09, described in `docs/agent-state.md`.
Each pane keeps its shown state. When a pane's raw state arrives:

- The pane is **unseen** when its tab is not the window's selected tab, or the window is not the
  active (focused) window.
- If the raw state is idle, the previous shown state was **working or done**, and the pane is
  unseen → the shown state is **done**. Otherwise the shown state is the raw state. (So blocked →
  idle while unseen is idle, not done; and a done pane that turns working is working.)
- **Seen**: whenever the window becomes active, and whenever the selected tab changes to a tab of
  the shown project, every pane of the selected tab that is **done** becomes **idle** (only when the
  window is active).
- A notification fires (below) when the pane is unseen, its shown state changed, and the new state
  is **done** or **blocked**.

## Notifications and sound (F32)

> Left on 2026-11-08: built by plan 09, described in `docs/agent-state.md`.
When a notification fires (an unseen pane became done or blocked), in the window that holds the
pane:

1. **Sound**, when the setting "Play a sound" (`notify_sound`, default on) is on — independent of
   the next setting:
   - blocked → `/usr/share/sounds/freedesktop/stereo/dialog-warning.oga`
   - done → `/usr/share/sounds/freedesktop/stereo/complete.oga`
   - the file missing (no sound theme) → the system beep.
2. When "Notify about background agents" (`notify_idle`, default on) is off, nothing more.
3. The text: blocked → "{agent} needs your input."; done → "{agent} finished.", where {agent} is the
   pane's agent name: "Claude Code" or "Cursor".
4. **Window active** (the user is in the window, looking at another tab) → an in-window toast for
   **6 s**: "{tab title}: {text}" (e.g. "JWT auth: Claude Code finished."), with a **Show** button.
5. **Window not active** → a desktop notification: title = the tab's title, body = the text. Its
   identity is the session id (or, for a tab whose session has not joined yet, the tab's title): a
   newer notification for the same session replaces the earlier one.
6. **Show**, or clicking the desktop notification, focuses the session: the window that has the
   session's tab comes forward (or the active window when none has), and that tab is selected (by
   session id, or by tab title for an unjoined tab). When the tab belongs to a project the window is
   not showing, agent-tablet's selection bounces back to the shown project, so nothing visible
   happens — a defect; Menkar shows the tab's project first, as Go to agent does.

## Acceptance cases

> Left on 2026-11-08: built by plan 09; the Vitest tests carry these ids.
AST-1. Claude pane, title "⠋ Fixing tests", screen without prompts → working.

AST-2. Claude pane, title "◐ Thinking" → working; title "✳ Ready" and no "esc to interrupt" on
screen → idle.

AST-3. Claude pane, title "⠋Fixing" (no space after the spinner) and no prompt text → idle.

AST-4. Claude pane, title "✳ x", last line "  (esc to interrupt)" → working.

AST-5. Claude pane, screen ends with "Do you want to proceed?" / "❯ 1. Yes" / "2. No" → blocked,
whatever the title.

AST-6. Claude pane, screen with "Select model" … "Enter to set as default" … "Esc to cancel" in the
last 14 non-empty lines → idle.

AST-7. Claude pane, "Esc to cancel · Enter to select" in the last lines → blocked.

AST-8. Claude pane, "Would you like to continue? Yes / No" → blocked.

AST-9. Claude pane, "Do you want to proceed?" as the 15th non-empty line from the bottom (14 newer
non-empty lines below it — "Esc to interrupt" among them, nothing else of the blocked rules —
and any number of blank lines) → working, not blocked.

AST-10. Claude pane, "Review your answers" → blocked; "Waiting for permission…" → blocked; "Do you
want to allow this connection?" → blocked.

AST-11. Cursor pane, "Run this command?" and "Run (once) (y)" in the last 10 lines → blocked.

AST-12. Cursor pane, line "  → Allow write to src/a.ts (y)" → blocked; line "Run npm test (y)" →
blocked.

AST-13. Cursor pane, "Keep (n)" → blocked; "Write to this file?" + "Proceed (y)" → blocked.

AST-14. Cursor pane, last line "⠙ Generating" → working; "  ⠙⠹ reading files" → working.

AST-15. Cursor pane, "ctrl+c to stop" as the 7th non-empty line from the bottom (and no other rule)
→ idle; as the 6th → working.

AST-16. Cursor pane, "3 background tasks" → working; "0 background tasks" → idle; "12 background
task" → working.

AST-17. The agent exits and the shell prompt is back → idle, whatever the screen shows.

AST-19. Output arrives at t = 0, 100 ms and 200 ms → one check, at 250 ms.

AST-20. A pane in an unselected tab goes working → idle → its row dot and tab dot show done; a
notification fires. Selecting that tab (window active) → idle.

AST-21. A pane in the selected tab of the active window goes working → idle → idle; no notification.

AST-22. The window is not active, its selected tab's pane goes working → idle → done, desktop
notification "<tab title>" / "Claude Code finished."; focusing the window → idle.

AST-23. An unseen pane goes blocked → idle → idle (not done), no notification for the idle.

AST-24. An unseen pane goes idle → blocked → notification "Claude Code needs your input." (desktop
or toast), sound `dialog-warning.oga`. It goes blocked → blocked again (no change) → no second one.

AST-25. The window is active and the blocked pane is in another tab → toast "<tab title>: Claude
Code needs your input." for 6 s with "Show"; Show → that tab is selected.

AST-26. `notify_sound` off, `notify_idle` on → notification, no sound. `notify_idle` off,
`notify_sound` on → sound only. Both off → nothing.

AST-27. The sound files are missing → the system beep instead.

AST-29. Tab with panes working + blocked → tab state blocked; done + idle → done; idle + idle → idle
(no dot on the strip).

AST-30. Window 1 shows A; B has 2 blocked sessions (in window 2), A has 1 → window 1's face badge
"2"; its popover rows: A "1", B "2". Window 2 (showing B) face badge "1".

AST-31. No blocked session anywhere → no badge on the face or the rows.

> Left on 2026-11-08: built by plan 11, described in `docs/window.md` and `docs/sessions.md`.
AST-32. `Ctrl+Shift+K` in project A with members "api" (folder todo-api, first message "add auth")
and "site" → two entries; typing "AUTH" leaves "api"; Enter opens it (selects its tab or resumes it).
AST-33. Quick switcher, query matches 80 sessions → 50 rows; the first selected; `↑` on the first
row keeps it selected.
AST-34. Quick switcher, typing part of a session id → that session is listed.
AST-35. Quick switcher does not list sessions of other projects, nor members hidden while "Show
hidden sessions" is off.
AST-36. `Esc` closes the switcher; the terminal of the selected tab has the focus.
AST-37. Quick switcher open, `Ctrl+Shift+K` again → still one dialog.
AST-39. `Ctrl+B g` with no tabs anywhere → an empty list; Enter does nothing.

## Roll-up (F30)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/agent-state.md`.
- **Tab**: the most urgent state among its panes: blocked, then working, then done, else idle.
  A tab whose state is done or blocked "needs attention".
- **Session row** in the project list: the shown state of the session's own pane when it has a tab;
  *stopped* otherwise (`projects.md`).
- **History rows** (Add session → Existing, `sessions.md`): a session with a tab is *open*, or
  *attention* when its tab is done or blocked; a session with no tab shows no dot. The history's
  count line counts open sessions from this.
- **Tab strip**: the tab's state dot, hidden when idle (`projects.md`).
- **Go to agent**: the tab's state (below).

## Blocked count (F31)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/agent-state.md`.
- On the dropdown's face: the number of sessions whose shown state is **blocked**, among the members
  of every project **except** the one this window shows, across **every** window (1.18). Hidden at
  0. Tooltip "Sessions waiting for you".
- In the dropdown's popover: each project's own blocked count on its row, hidden at 0, same tooltip.
- Only members count; a tab whose session has not joined a project yet does not.
- agent-tablet recomputes a window's badge only when that window itself refreshes, so a session
  blocking in window 2 can show late in window 1's badge; Menkar updates every window's badge when
  any session's state changes.

## Quick switcher — `Ctrl+Shift+K` (F33, K10, K41, K42)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
A dialog, title "Switch session", over the window:

- A search entry (placeholder "Jump to a session…") with the focus, and a list below.
- **Entries**: the members of the project this window shows that the app knows, in the history's
  order (folders ordered by their most recent session, then sessions by most recent activity).
  Hidden sessions are left out unless "Show hidden sessions" is on (`sessions.md`). Each entry:
  the session's name (bold, ellipsized) and a dim small line "{folder basename}" followed by
  " · {first typed message}" when the session has one. No state dot.
- **Filter**: as the user types (after the search entry's short pause), the query is trimmed and
  lowercased; an entry stays when its search text contains the query as a substring. The search
  text is the name, the folder basename, the first message and the session id, lowercased, joined
  by spaces. An empty query shows all. At most **50** rows show. After every filter, the first row is
  selected.
- **Keys** in the entry: `↓` / `↑` move the selection one row (no wrap; the row scrolls into view
  and typing stays in the entry) (K41); `Enter` chooses the selected row; `Esc` closes (K42). A
  click on a row chooses it.
- **Choosing** opens the session exactly as Open does (`projects.md`: selects its tab, or resumes
  it in a new tab), then the dialog closes.
- Only one jump dialog is open at a time: `Ctrl+Shift+K` or `Ctrl+B g` while one is open does
  nothing.
- When it closes, the focus returns to the focused pane of the selected tab.

## Go to agent — `Ctrl+B g` (F34, K35)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
The same dialog, title "Go to agent", placeholder "Agent, project or state…":

- **Entries**: every tab of every window — terminal tabs, and also file, preview, chat and replay
  tabs (agent-tablet's decision 1.17 says "running sessions of every project"; the code lists every
  tab). Windows in the order the system reports them (most recently focused first); within a
  window, tabs grouped by project, projects in the order of their first tab, tabs in strip order.
- Each entry: a state dot (the tab's rolled-up state; idle shows the idle ring), the title
  "{project name} · {tab title}", and the dim line "{agent} · {state}", where {agent} is
  `claude`, `cursor`, `file`, `preview`, `replay`, `claude chat`, `cursor chat` and {state} the
  English word `working`, `blocked`, `done` or `idle`. (These two words are not translated in
  agent-tablet; Menkar shows the agent's display name and translates the state.)
- **Filter**: as the quick switcher, over "{tab title} {project name} {agent} {state}" — so typing
  `blocked` lists the blocked tabs (herdr's b/w/i/d filters).
- **Choosing**: that window comes forward, shows the tab's project, and selects the tab; the dialog
  closes.
- `Ctrl+B g` is not taken while the focus is in a text entry or a dialog (`terminal.md`).

## Data contracts

> Left on 2026-11-08: built and tested by plan 15, described in `docs/agent-state.md`.
| Read or written | What | Notes |
|---|---|---|
| The terminal's title | Set by the agent through the OSC title sequence | Claude Code: a spinner (U+2800–U+28FF or U+25D0–U+25D3) and a space while busy; "✳ " when idle |
| The terminal's screen | Plain text of the rows ending at the cursor | See "When the state is read" |
| The terminal's foreground process group | Whether the agent (not the shell) runs | Linux: the PTY's foreground process group differs from the shell's |
| `state.json` → `settings.notify_idle` | bool, default `true` | Preferences: "Notify about background agents" — "A notice when an agent you are not watching finishes or needs your input" |
| `state.json` → `settings.notify_sound` | bool, default `true` | Preferences: "Play a sound" — "When an agent you are not watching finishes or needs your input" |
| Sound files | `/usr/share/sounds/freedesktop/stereo/dialog-warning.oga`, `.../complete.oga` | The freedesktop sound theme (Linux) |
| Desktop notification | Title, body, identity = session id; activating it focuses the session | Through the desktop's notification service |

Nothing of the state is saved: states start idle on every start. A session's state is never written
into its name (product rule).

| State | Meaning |
|---|---|
| `working` | The agent is busy |
| `blocked` | Waiting on an approval or a question |
| `idle` | Ready for input, or back at the shell |
| `done` | Finished (working → idle) while unseen; becomes idle once seen |
| `stopped` | (rows only) the session has no tab |

## Acceptance cases

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
- AST cases not listed below: built; the Vitest tests in `tests/core/` carry these ids.
- AST-32–37 and AST-39 (the quick switcher, Go to agent) are built too; `e2e/switcher.spec.ts` carries
  their ids.

AST-18. A shell split pane printing "Do you want to proceed?" → no state, no notification; its tab's
state comes from the agent pane only.

AST-28. Desktop notification clicked for a session whose tab is in window 2, project B (not shown
there) → window 2 comes forward, shows B, its tab selected.

AST-38. `Ctrl+B g` with window 1 (A: "api" working, a file tab "notes.md") and window 2 (B:
"tests" blocked) → entries "A · api" ("claude · working"), "A · notes.md" ("file · idle"), "B ·
tests" ("claude · blocked"); typing "blocked" leaves only "B · tests"; Enter → window 2 forward,
showing B, "tests" selected.

## Look

> Left on 2026-11-08: built and tested by plan 15, described in `docs/agent-state.md`.
Screenshots: `img/project-list-dark.png` (row state dots: idle/stopped rings at the left of each
row), `img/open-tab-dark.png` and `img/tab-ring-dark.png` (a tab with no state dot because it is
idle, and the row's green idle ring), `img/project-dropdown-dark.png` (the dropdown where the
blocked badges sit). No screenshot shows the switcher; it follows the rules below.

**State dot** — 8 × 8 px minimum, round, vertically centered; herdr's shapes: ○ idle, ● working /
done, ◉ blocked.

| State | Classic | TUI (Catppuccin Mocha / Latte) |
|---|---|---|
| idle | transparent, 1.5 px inset ring `#2ec27e` | 1.5 px inset ring green `#a6e3a1` / `#40a02b` |
| working | filled `#e5a50a` | filled yellow `#f9e2af` / `#df8e1d` |
| blocked | filled `#e01b24` | filled red `#f38ba8` / `#d20f39` with a 2 px outer halo of the red at 35 % |
| done | filled `#2ec27e` | filled green, no ring |
| stopped (rows) | transparent, 1.5 px inset ring of the text color at 35 % | 1.5 px inset ring overlay0 `#6c7086` / `#9ca0b0` |
| open (history rows) | filled `#2ec27e` | 1.5 px inset ring green |
| attention (history rows) | filled `#3584e4` | filled yellow |
| no state | text color at 25 % | same |

Other themes take green, yellow and red from their terminal palette's colors 2, 3 and 1, and
overlay0 by mixing background and foreground at 45 % (`look.md`).

**Blocked badge** — Classic: bg `#e01b24`, white bold text at a smaller size, radius 9 px, padding
0 6 px, vertically centered. TUI: bg red (`#f38ba8` / `#d20f39`), text in the mantle color
(`#181825` / `#e6e9ef`).

**Toast** — the window's toast, 6 s, one "Show" button.

**Jump dialog** (quick switcher and Go to agent) — content 560 × 460 px, fixed (does not follow its
content); a search entry with 10 px margins top, left and right; 6 px between entry and list; the
list scrolls vertically only, single selection, sidebar list style. Each row: margins 7 px top and
bottom, 12 px left and right; 2 px between its two lines; first line: the state dot (Go to agent)
then 8 px, then the title in bold, ellipsized at the end; second line dim, small, ellipsized.
