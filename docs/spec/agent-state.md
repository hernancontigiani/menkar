# Agent state

What each running agent is doing — **working**, **blocked** (waiting on an approval or a question),
**idle** (ready for input) or **done** (finished while nobody was looking) — read from the terminal's
title and screen for Claude Code and from the prompts for Cursor (a simplified port of herdr's
agent-detection rules, herdr.dev, Apache-2.0); how a state rolls up to a tab, to the session's row
and to the blocked count on the project dropdown; the notifications and sound when an agent nobody
is watching finishes or needs the user; and the two jump dialogs, the quick switcher and Go to agent.
Index rows: **F30–F34**; keys **K10, K35, K41, K42**.

## Behaviour

### When the state is read (F30)

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### Claude Code's rules

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### Cursor's rules

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### From raw state to shown state: done and seen

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### Roll-up (F30)

- **Tab**: the most urgent state among its panes: blocked, then working, then done, else idle.
  A tab whose state is done or blocked "needs attention".
- **Session row** in the project list: the shown state of the session's own pane when it has a tab;
  *stopped* otherwise (`projects.md`).
- **History rows** (Add session → Existing, `sessions.md`): a session with a tab is *open*, or
  *attention* when its tab is done or blocked; a session with no tab shows no dot. The history's
  count line counts open sessions from this.
- **Tab strip**: the tab's state dot, hidden when idle (`projects.md`).
- **Go to agent**: the tab's state (below).

### Blocked count (F31)

- On the dropdown's face: the number of sessions whose shown state is **blocked**, among the members
  of every project **except** the one this window shows, across **every** window (1.18). Hidden at
  0. Tooltip "Sessions waiting for you".
- In the dropdown's popover: each project's own blocked count on its row, hidden at 0, same tooltip.
- Only members count; a tab whose session has not joined a project yet does not.
- agent-tablet recomputes a window's badge only when that window itself refreshes, so a session
  blocking in window 2 can show late in window 1's badge; Menkar updates every window's badge when
  any session's state changes.

### Notifications and sound (F32)

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### Quick switcher — `Ctrl+Shift+K` (F33, K10, K41, K42)

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

### Go to agent — `Ctrl+B g` (F34, K35)

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

- AST cases not listed below: built; the Vitest tests in `tests/core/` carry these ids.

AST-18. A shell split pane printing "Do you want to proceed?" → no state, no notification; its tab's
state comes from the agent pane only.

AST-28. Desktop notification clicked for a session whose tab is in window 2, project B (not shown
there) → window 2 comes forward, shows B, its tab selected.

AST-32. `Ctrl+Shift+K` in project A with members "api" (folder todo-api, first message "add auth")
and "site" → two entries; typing "AUTH" leaves "api"; Enter opens it (selects its tab or resumes it).

AST-33. Quick switcher, query matches 80 sessions → 50 rows; the first selected; `↑` on the first
row keeps it selected.

AST-34. Quick switcher, typing part of a session id → that session is listed.

AST-35. Quick switcher does not list sessions of other projects, nor members hidden while "Show
hidden sessions" is off.

AST-36. `Esc` closes the switcher; the terminal of the selected tab has the focus.

AST-37. Quick switcher open, `Ctrl+Shift+K` again → still one dialog.

AST-38. `Ctrl+B g` with window 1 (A: "api" working, a file tab "notes.md") and window 2 (B:
"tests" blocked) → entries "A · api" ("claude · working"), "A · notes.md" ("file · idle"), "B ·
tests" ("claude · blocked"); typing "blocked" leaves only "B · tests"; Enter → window 2 forward,
showing B, "tests" selected.

AST-39. `Ctrl+B g` with no tabs anywhere → an empty list; Enter does nothing.

## Look

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
