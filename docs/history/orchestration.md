# History of `docs/orchestration.md`

## The sidebar in the mode

> Left on 2026-11-12: a double-click on a topic sets it to discussing and tells the orchestrator (decision 1.96).
the number, the title, a red mark when blocking. A click unfolds its context, who raised it and its
status, per window. It is read only. Empty, it says "No open topics".

## The orchestration mode

> Left on 2026-11-12: plan 35 adds decisions 1.99–1.104.
Decisions 1.77, 1.78, 1.83, 1.84, 1.86, 1.89–1.91, 1.93 and 1.94 (the human, 2026-11-12; the look chosen from

## The data

> Left on 2026-11-12: decision 1.100: blocking topics come right after the ★ ones.
  - **The order shown** (`shownTopics`), in the sidebar and in `topic_list`: open and discussing
    only, those raised by a ★ session first, then by number. A blocking topic is marked, not moved.

## Read-only tabs

> Left on 2026-11-12: main no longer drops a read-only pane's input, so the terminal's replies to the agent's queries arrive; the window keeps the user's input out (`set`).
- **Main drops its input** (`paneInput`, `src/main/workspace.ts`): a paste, a key or anything else
  sent to that pane never reaches the agent. The window also skips what xterm would send there
  (`setPaneBanner`, `src/renderer/terminals.ts`), so the app's shortcuts still work. Scrolling,
  selecting and copying work. Drawers share the input path and are never read only.

## Read-only tabs

> Left on 2026-11-12: the yellow banner became a fixed amber with dark text.
- **A yellow banner** across the top of the pane: "This session reports to the orchestrator.", with
