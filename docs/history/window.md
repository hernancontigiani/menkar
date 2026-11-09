# History of `docs/window.md`

## A new session joining its project

> Left on 2026-11-09: one New ▾ menu; the advanced new session, Continue last and New chat removed (decision 1.30).
session or a fork) waits until the tab closes, then one last check. An unknown id (Continue last,
Cursor) takes the newest session of that folder modified since the tab started, and gives up after

> Replaced 2026-11-10: Preferences, About and MCP became the Settings window, which has no segmented page switch. It was:
- Preferences, Usage, About and MCP keep the system's frame.
- Every segmented control (Add session's Existing / New, Usage's rows, Preferences' pages) shares

## The frame (2026-11-09)

> Left on 2026-11-10: the header reorganized and the main menu removed (plan 24).
- "Close all" in the content header is a text button (2026-11-09): its ✕ icon read as the window's
  close. Being text among icons it has a resting fill and a 1 px edge, so it reads as a button; the
  icon buttons stay flat. It still closes every tab with no question, and shows with two tabs or
  more.
- "New ▾" is the header's one menu for starting things (decision 1.30, 2026-11-09), a text button in
  Close all's look: New session, Terminal in this tab, Open file…, New window, each showing its
  key. The agent is picked on Add session → New, not per menu item.

## Keys, panes and jumping

> Left on 2026-11-10: the header reorganized and the main menu removed (plan 24).
- **The ⚙ main menu**: Open session file… (a chosen `.jsonl` as a replay), Show hidden sessions (a
  check per window, not saved), Usage, Preferences, About. The last three call
  `openUsage`/`openPreferences`/`openAbout` in main, which log until plan 12 provides their
  windows.

> Replaced 2026-11-10: plan 24 was closed, and its lines name decision 1.34 instead. It was:
- **The header's text buttons** (plan 24, 2026-11-10), each an icon with its word, with a resting
  (plan 24, 2026-11-10).
