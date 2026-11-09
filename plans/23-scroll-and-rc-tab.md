# Plan 23: a jump-to-bottom button in agent terminals; no phone icon on tabs

> **Status:** stub, written 2026-11-09, for 2026-11-10. Needs `/design-plan` into blocks before it runs.
>
> **Exit, when executed:** `docs/window.md` (the button) and `docs/sessions.md` (where the phone
> shows); decision 1.19 corrected in `plans/00-STATUS.md` §1; the rest → `git log`.

## 1. Jump to the bottom (the human, 2026-11-09)

Reading a Claude Code session means scrolling up a lot; getting back to the end means scrolling all
the way down. Wanted: when a terminal pane is scrolled up from its bottom, a small floating button
with a down arrow, pinned near the scrollbar's lower end, that jumps to the bottom in one click and
disappears once at the bottom — as chat apps do. To design: which panes (agent panes, shells, the
drawer — likely all terminals), whether new output while scrolled up shows a hint on it, and a
keyboard shortcut (check what xterm.js already offers, e.g. Shift+End or Ctrl+Shift+End, and what
reaches the agent) so it is discoverable from the button's tooltip.

## 2. Regression: the phone icon on tabs (the human, 2026-11-09)

The Remote Control phone shows on the sidebar row only, never on the tab — decided in agent-tablet
(its plan 10, "a phone icon on the row only; tab emoji removed"). Plan 18 / decision 1.19 put the
outline on the tab too: `set`'s instruction said "the row and the tab", which was wrong. Remove it
from the tab (the tab is state dot, name, ring, ×), keep the row; fix 1.19's wording and move the
old one to history; the remote-live e2e asserts no `.phone` inside `.tab`.
