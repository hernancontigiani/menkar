# Plan 08 — the main window: look, the project view, tabs with live sessions, windows

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 09 (`b2`); the
> seam between them is named under "The design".
>
> **Exit, when executed:** how the window, tabs and terminals are built, and why → `docs/window.md`
> (and `docs/projects.md` for the UI side of projects) with its row in `CLAUDE.md`'s docs table; the
> built parts of `docs/spec/look.md`, `projects.md`, `terminal.md` and `sessions.md` trimmed to
> pointers, removed lines to `docs/history/spec/`; `README.md` describes what the user can now do.

## Goal

Menkar becomes usable for the human's daily work: the window looks like agent-tablet's (both
interface styles, both color schemes, the themes), the sidebar shows the current project's sessions
with their groups and rows, a tab runs a session's agent in an xterm.js terminal — started new,
resumed, forked or continued with agent-tablet's exact command lines — and closing follows decision
1.9; several windows, quitting and reopening on start work as the spec says.

## What it builds, from the spec

Read whole first: `docs/spec/README.md` (with its overriding decisions), `look.md`, `projects.md`,
`terminal.md`, and `sessions.md`'s "The project list's rows".

- **look.md** — all of it except the Usage window's section and the Integrations/Preferences dialogs'
  contents: interface style and theme applied live, the sidebar shown/hidden/resized, empty states,
  the chrome's small behaviours, every palette and chrome role, fonts, window and header, sidebar,
  rows, tab strip, panes and terminal, the dialogs' common look, icons.
- **projects.md** — the UI of everything plan 07 built: the project dropdown (F21) with its dialogs,
  the project's session list, the row menu (M18, M19, M22–M25, M32) except items whose features are
  later plans (they show only when built), membership on screen, tabs (F24), several windows (F25,
  1.18), quitting (F27), reopening on start (F26), the unreadable-file notice (F28), the sidebar
  (F29). The cases plan 07 left for the window (its log, in git: `plans/07-projects-core.md` at
  `8938c4a`).
- **terminal.md** — how a tab starts (F15), the kinds of start (F16: new, resume, fork, continue
  last; the advanced dialog may wait for the Add session plan), a new session finding its transcript
  and joining its project after its first typed message (1.16), the embedded terminal and its keys
  (F18: Shift+Enter, copy, paste, find), closing a tab, a window and quitting **by hanging up the
  pty (decision 1.9)**, the command lines and the CLI's checked behaviour.
- Every acceptance case of those parts becomes a test: Vitest for logic, Playwright e2e under
  `xvfb-run` for what is on screen, named after its id, written before the code, seen red.

Not here: the `Ctrl+B` prefix and split panes (plan 10); the Add session dialog, the history
browser, details, export, replay, trash, select mode (plan 11); the quick switcher and Go to agent;
Preferences; the Usage window; file tabs; Remote Control.

## The design

- **Renderer:** plain TypeScript and DOM, CSS custom properties for every color role so a theme is a
  set of variables (both styles, both schemes); the look is matched against agent-tablet's
  screenshots in `docs/spec/img/` — an e2e screenshot of each view sits beside the spec's for the
  human to compare, and the e2e asserts the computed colors of the main roles.
- **Main:** one pty per pane (`src/main/terminal.ts`, yours), the command lines built in
  `src/core/` from the spec's table, typed into the user's shell (that shell is not the agent;
  decision 1.9 is about the agent), `&& exit` as the spec says; closing hangs up.
- **The seam with plan 09 (`b2`):** `b2` builds `src/core/agentstate/` (the detection and a headless
  screen mirror) and `src/core/context/` (the per-session `--settings` file). You call them from
  `src/main/terminal.ts` and the command builder once `b2` reports them delivered: feed each pane's
  bytes and title to the mirror; append `--settings <path>` to Claude's command lines. Until then the
  hooks are not wired, and the e2e that needs them waits for that block. Do not edit `b2`'s modules;
  ask `set` for an interface change.
- **Shared files** (`src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/index.ts`,
  `src/core/i18n/{en,es}.ts`, `CLAUDE.md`, `README.md`): re-read right before each edit, targeted
  edits only, your keys in your own block.

## Out of scope

The items listed under "Not here".

## Do not touch

`src/core/agentstate/`, `src/core/context/`, `src/main/agentstate.ts`, `src/main/context.ts`, the
statusline script and their tests (`b2`, plan 09); `src/core/usage/` (delivered; ask `set`).

## Execution blocks

### B1 — Look and the window's frame
- [x] Themes and both styles as CSS variables, fonts, the header, the sidebar frame (show/hide/resize),
      empty states; e2e screenshots of each beside the spec's; the computed-color assertions.
- **Verification:** `npm run ci`; `npm run ui-check`; the screenshots compared and noted in the log.

### B2 — The project view
- [x] The dropdown and its dialogs, the session list with groups and rows, the row menu (built
      features only), membership on screen, the notices from `projects:get`.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B3 — Tabs with live sessions
- [x] Tabs and the tab strip, starting/resuming/forking/continuing with the spec's command lines, a
      new session joining its project, the terminal's keys, closing by hang-up; the e2e uses a
      stand-in `claude` on the PATH (agent-tablet's walk did the same), never the real one.
- [x] When `b2` reports plan 09's modules delivered: wire the mirror and `--settings`.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Windows, quitting, reopening
- [x] Several windows with a project in at most one, "Move here", quitting asks and hangs up, reopening
      on start.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B5 — Exit
- [x] The exit's files; `plans/00-STATUS.md` §2 gets the human's check: "Use Menkar for a day of work:
      open your projects, start and resume sessions, close and reopen."
- **Verification:** `npm run ci`.

## Execution log

Executed by `b1` on 2026-11-08, B1 → B5. Plan 09's seam (b2) was wired as `set` relayed it.

**Built:**
- `src/core/theme.ts`, `src/core/settings.ts` and `src/core/command.ts`, with Vitest.
- `src/main/workspace.ts` (the one owner of projects, layout, panes and windows), `src/main/panes.ts`
  (the agent-pane registry b2's agent state consumes), and `src/main/terminal.ts` rewritten (one pty
  per pane, a replay buffer, "running", hang-up).
- `src/shared/workspace.ts` (`WindowState`, the `Action` union).
- The renderer: `app.ts`, `terminals.ts`, `ui.ts`, `look.ts`, `dom.ts`, `main.ts` and `style.css`.
- e2e: `look.spec.ts` (computed colors and screenshots) and `window.spec.ts` (dropdown, resume, a
  new session joining, closing with a running agent).

**Decisions applied after the plan:**
- 1.9: closing hangs up, nothing typed.
- 1.11: every string in both `en` and `es`.
- 1.12: the star in the empty states.
- set's go for `--settings`, which is always on Claude's lines.
- b2's five extra pane members (`seen`, `onSeen`, `tabTitle`, `windowFocused`, `reveal`), and
  `panes:reveal`.

**Seen red:**
- The 32 Vitest cases were red with their modules missing.
- The look e2e failed on a 1-per-channel rounding until the spec's measured values were compared
  within ±1.
- The join e2e failed with the join disabled.
- The close e2e and the terminal e2e failed with the hang-up made a no-op.

**Found on the way:**
- **node-pty's `process` is the foreground process's `argv[0]`** (`/bin/bash`, not `bash`), so
  every pane read as running and closing always asked. It is compared by base name now.
- **Quitting cut a `projects.json` write short**, leaving `.projects.json.<random>.tmp`. The last
  window now waits for its save before the app quits.
- **My slip, the second one (the first was in plan 03): I started Playwright without `xvfb-run`
  while debugging, and a Menkar window opened on the human's screen.** `e2e/app.ts` now refuses to
  launch unless `MENKAR_E2E_XVFB=1`, which only `npm run ui-check` and `npm run package:smoke` set
  inside `xvfb-run`. Seen refusing.
- Electron's `app.close()` with an agent running stops at the close confirmation, which is the
  right behaviour. The e2e helper closes its tabs before closing the app.

**Deviations and interim pieces:**
- **New session, until plan 11's Add session.** The `+` button, `Ctrl+Shift+T`, "Add session" and
  the ▾ menu's "New … session…" open a small dialog: a folder (a chooser) and a name. The ▾ menu
  also has "Continue last … session…" (a folder chooser) and "New window". The advanced dialog
  (M8) is not built.
- **Fork** is in the session row's menu, since the history row menu where the spec puts it comes
  with plan 11.
- **Not built here** (later plans or not yet): the `Ctrl+B` prefix and split panes (plan 10), the
  tab menu's "Swap the split's orientation", the main menu ⚙, Add session → Existing / "Move from"
  on screen (plan 11), Remote Control, and the find bar's per-match details beyond what
  `@xterm/addon-search` gives.
- **The PRJ/TRM/LOOK cases** that need those pieces stay in the spec. The ones built and tested on
  screen were trimmed to their history: PRJ-11, 13, 14, 27, 45; TRM-1–9, 49, 53; LOOK-2, 3, 6, 23,
  37, 39.
- **A dev dependency was added**: `@xterm/addon-search` 0.16.0, bundled into the renderer, for
  K18's find bar.
- `src/core/settings.ts` takes a structural `{ rest }` rather than `State`, so the renderer's
  compile (which sees it through the IPC types) pulls in no Node module.
- **Screenshots** for the human to compare with `docs/spec/img/`: `test-results/look/default-dark.png`,
  `default-light.png` and `nord.png`. Looked at `default-dark.png`: sidebar, accent tab, labelled
  frame and terminal colors match agent-tablet's `open-tab-dark.png`.

**For `set`:**
- `npm run ci`'s Biome step is red only on `src/core/usage/history.ts` (b2's, formatting). Every
  other step is green.
- `e2e/classifier.spec.ts` (b2's) failed once during one of my defect runs and passed in every
  other run: maybe flaky.
