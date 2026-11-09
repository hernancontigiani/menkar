# Plan 23: a jump-to-bottom button in agent terminals; no phone icon on tabs

> **Status:** written 2026-11-10 (blocks added by `b1` from the stub's decisions); executed by `b1`.
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

## 3. The design (b1, 2026-11-10, verified in the tree)

- **Every terminal gets it**: agent panes, shells and the drawer are all built by `create()` in
  `src/renderer/terminals.ts`, so the button lives there once. It is a `button.jump-bottom` with
  the `down` icon in the pane's `.frame`, absolutely placed at the bottom right, **left of the
  scrollbar column** (xterm 6 draws its own `.xterm-scrollable-element > .scrollbar.vertical`
  inside `.term`), so it never covers the thumb or the track.
- **Shown iff scrolled up**: `buffer.active.viewportY < buffer.active.baseY`, re-read on
  `term.onScroll` and after each write (`onWriteParsed`). A click calls `term.scrollToBottom()`
  and gives the terminal its focus back. New output while scrolled up still does not move the
  view (xterm's default; `scrollOnUserInput` only scrolls on typing).
- **The new-output hint** (my call): while the button shows, output that arrives gives it an accent
  dot (`.jump-bottom.fresh`); reaching the bottom clears it. One class, no counter.
- **The key: Ctrl+Shift+End.** xterm sends every modified End to the pty (`ESC[1;<m>F`), so plain
  Shift+End and Ctrl+End reach the agent and stay theirs. Ctrl+Shift+End is caught in the
  terminal's custom key handler for every event type, scrolls to the bottom, and never reaches the
  agent. xterm's own Shift+PageUp / Shift+PageDown keep scrolling a page. The tooltip says
  "Jump to the bottom (Ctrl+Shift+End)"; the K table gains **K44**.
- **The phone off the tab**: `phoneFor` stays on the row only; the tab is dot, name, ring, ×.

Rejected: a button outside the frame (it would sit over the next pane in a split); scrolling on
new output (it would yank a reader back down); Shift+End (the agent's own select-to-end).

## 4. Tests, written first and seen red

- **TRM-58** (terminal.spec): with output taller than the pane, scrolling up shows
  `.jump-bottom`; its box misses the vertical scrollbar's box; a click reaches the bottom
  (`viewportY === baseY`) and hides it; new output while scrolled up keeps `viewportY` and adds
  `.fresh`; Ctrl+Shift+End reaches the bottom, and the fake agent's raw input log receives no
  byte for it.
- **TRM-59** (terminal.spec): the drawer's terminal has the same button.
- **RC-27** (remote-live or remote spec): a session with the phone shows it in its row and no
  `.phone` inside any `.tab`.

## 5. Blocks

1. Tests TRM-58, TRM-59 and RC-27, red on the current build.
2. The button, the hint and the key in `terminals.ts` and `style.css`; strings in en and es.
   Verify: TRM-58, TRM-59, LOOK-60, then `npm run ci`.
3. The phone off the tab (`app.ts` `tabButton`). Verify: RC-27 and the remote specs, then `npm run ci`.
4. Docs: `docs/window.md` (the button and its key), `docs/sessions.md` (the phone on the row only),
   K44 in `docs/spec/README.md`, decision 1.19 reworded in STATUS with the old row in history.
   Verify: `npm run ci` (nothing-lost), a full ui-check from a clean `out/`.

## Execution log

Executed by `b1` on 2026-11-10.

- TRM-58, TRM-59 and RC-27 were red on the build before block 2. TRM-58 was also run against an
  injected leak (the handler letting Ctrl+Shift+End through to xterm), and it failed on the agent's
  raw input log.
- The tests sit in a new `e2e/scroll.spec.ts`, so `b2`'s `drawer.spec.ts` stays untouched.
  RC-27 is in `remote-live.spec.ts`. The first remote-live test's tab-phone assertions (title,
  outline, position before the name) became "no phone on the tab".
- **At the bottom** is read from the DOM as "the cursor's row is drawn". The scrollbar thumb's
  position was off by 3 px between the first end and the end after a jump (xterm's rounding), so
  it could not be the signal.
- The hint is an accent dot (`.jump-bottom.fresh`), set by `onWriteParsed` while scrolled up and
  cleared at the bottom.

### Plan 24, the header part (also `b1`; `b2` owns the plan 24 file)

- **Header:**
  - "+ New ▾" gained a plus icon.
  - The gear menu (`#main-menu`) is gone. "⚙ Settings" (`#settings-button`) takes its place in the
    sidebar header and calls `b2`'s `{ type: 'openSettings' }` with no section.
  - "Usage" (`#usage-button`, a new chart icon) sits right after New ▾. The human found it odd
    beside the title, so it moved there; the title stays alone in the centre.
  - The three text buttons share `.header-text`, now valid in both headers.
  - A double click on any header button no longer maximizes.
- **The gear's items:**
  - Open session file… went into New ▾, after Open file….
  - Show hidden sessions became a switch at the foot of Add session → Existing.
  - MCP servers, Preferences and About are `b2`'s Settings sections.
- **Close all** left the header. A tab's menu has Close, Close other tabs (a new action,
  `closeOtherTabs`) and Close all tabs, none of which asks. `WindowState.tabCount`, which existed
  only to show Close all with two tabs, is gone.
- **Sidebar:**
  - `DEFAULT_SETTINGS.sidebar_width` is 250 and `SIDEBAR_MIN_WIDTH` is 180 (the CSS minimum
    follows).
  - A double click on the divider sets 250 and saves it.
  - A saved width is read as before.
- **Decision 1.31:** `last_agent` in `state.json` settings (a string, '' when absent or of the
  wrong type) is written by `startNew`. New preselects it when it is installed, else Claude Code
  when installed, else the first installed agent.
- **Tests** LOOK-69, PRJ-65, LOOK-70, SES-73 and SES-74 were red on a build of `HEAD` made in a
  temporary copy (`git archive`), so the shared `out/` was not needed. The jump-button screenshots
  were built the same way. LOOK-66 (Close all as a header button) was deleted with the button.
