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
