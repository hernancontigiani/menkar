# Plan 20: a temporary terminal under each tab

> **Status:** written 2026-11-09, ready to execute. Executed by `b2`, coordinating with `b1`,
> whose terminal and tab code it touches.
>
> **Exit, when executed:**
> - `docs/window.md` gains "The drawer terminal".
> - The K table in `docs/spec/README.md` gains the key.
> - Decision 1.29 stays in `plans/00-STATUS.md` §1.
> - The rest goes to `git log`.

## Goal

The human often needs a shell for a moment while working in a Claude session, for example to run
git in the session's folder. Today that means a terminal tab, which is easily forgotten and piles
up among the sessions. The drawer gives each tab a shell that opens under it with one key and
hides with the same key. It never becomes a tab.

## Decided (the human, 2026-11-09; decision 1.29)

- **Ctrl+`** toggles the drawer of the current tab. Ctrl+Shift+T stays Add session → New.
- **Where it goes.** The drawer is a full-width strip at the bottom of the tab's content, under
  all of its panes.
  - It starts at 30 % of the tab's height, and a divider resizes it. The height is remembered per
    window for the session of the app, not saved.
  - It gets the same terminal frame and look as a pane, with its own label (e.g. "shell · <folder>").
- **Its folder** is the cwd of the focused agent pane: the folder that Claude Code was started in.
  A tab with no agent uses the tab's own folder.
- **Focus.** Opening the drawer focuses it. Hiding it returns the focus to the pane that had it.
- **Hiding keeps it alive.** The shell process keeps running, and reopening shows the same
  scrollback and cwd. `exit` in the shell closes the drawer for real, and the next Ctrl+` starts a
  fresh shell.
- **What it is not:**
  - not a tab, and not a pane in the layout;
  - not in the session list or the tab strip;
  - not saved in the window layout, and not reopened on start;
  - not counted in Usage, and not watched for agent state.
- **Lifetime.** Closing the tab hangs up its drawer's shell with SIGHUP, as closing a terminal
  does (decision 1.9). Nothing is typed into it. Quitting the app does the same.
  - A drawer with a process running in its foreground does not add a "running" question on
    close. Only agents count today, so this rule is unchanged.
- **One drawer per tab.** A split tab still has one drawer, which follows the focused pane's folder
  at the moment it is first opened.

## What it builds

- **Main:** the drawer's pty is spawned through the same terminal service as a pane's shell (a
  plain shell, with no command fed). It is kept per tab and hung up on tab close and on quit.
  IPC is targeted edits to the shared types: open, close, attach, input, resize. Reuse the pane
  channels if a drawer can be a pane-like id that is never in the layout. Prefer that over new
  channels, if it is clean.
- **Renderer:**
  - the drawer element in the tab body, which is patched in place (keep f6c6e3e's no-rebuild
    rule, so no click is lost);
  - the divider, the key and the focus rules;
  - xterm with the same options, find (Ctrl+Shift+G) and the context menu (1.20).
- **Keys:** add Ctrl+` to the K table, and check that it clashes with nothing. In xterm, Ctrl+`
  must not reach the shell.
- **Strings:** the drawer label, and a tooltip on the divider, in en and es.

## Do not touch

- The layout schema and the session/tab rules.
- Usage.
- Agent-state watching.
- Ctrl+Shift+T.

## Verification

- **Vitest** for any pure logic: the cwd choice, and the per-tab registry of open, closed and
  exited drawers.
- **e2e:**
  - Ctrl+` opens a drawer under the tab, in the agent's folder: `pwd` prints it;
  - Ctrl+` hides it, and focus goes back to the pane;
  - reopening shows the same scrollback;
  - `exit` closes it, and Ctrl+` starts a fresh shell;
  - the drawer is not in the tab strip, the session list or the saved layout, and is gone after a
    restart;
  - closing the tab ends the drawer's process (by PID);
  - LOOK-60 (no drag box over controls) stays green.
- Each test is seen red first.
- `npm run ci`; `npm run ui-check` from a clean `out/`.
- Screenshots: `/tmp/menkar-shots/drawer-{tui,classic}-dark.png`.

## Execution blocks

### B1: build
- [ ] Main, renderer, keys, strings, tests.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2: exit
- [ ] Docs, K table, the log.
- **Verification:** `npm run ci`.

## Execution log
