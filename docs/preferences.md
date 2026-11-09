# Preferences, About and the Usage window — how they are built

Menkar's own windows besides the main one. The code says what each does. This file keeps why they
are shaped this way.

## The shape

- **Preferences and About are child windows of the main window that asked**
  (`src/main/windows.ts`): `openPreferences(parent, page?)` and `openAbout(parent)` are modal over
  it, as the spec's dialogs are. **Usage is a window of its own** (decision 1.24, 2026-11-09):
  `openUsage(opener)` gives it no parent, since GNOME's mutter keeps a child window attached to its
  parent and the parent then takes no clicks while it is open. There is still one per main window,
  scoped to that window's project (decision 1.15); closing the opener leaves Usage open and reloads
  it, now showing every project. b1's ⚙ menu, `Ctrl+,` and `Ctrl+B s` call them through the
  workspace's `openPreferences`, `openUsage` and `openAbout` actions.
- **Each has its own page** (`src/renderer/{preferences,about,usage}.html`, their own entries in
  `electron.vite.config.ts`) and imports the main window's `look.ts`, `dom.ts` and `i18n.ts`
  read-only. Its CSS is its own (`windows.css`, `usage.css`), so it shares no file with the main
  window's renderer.
- **Settings**: a row writes through `settings:set`. Main checks the value
  (`src/core/preferences.ts`, `validSetting`), writes it through `sessions.updateState()` (the one
  holder of `state.json`), then pushes every main window's state (`pushWindowStates()`) and sends
  `settings:changed` to every window. So a theme, style, scheme, font or scrollback change reaches
  every window at once (agent-tablet reached only the window that opened Preferences).
- **The language** is read once at start, before any window (`src/main/index.ts`). "Restart now"
  calls the workspace's `quitApp()` (one question for the running sessions, the layout saved), and
  registers `app.relaunch()` only once that quit was confirmed, so a cancelled restart never
  relaunches later (decision 1.10).
- **Integrations**: the status line switch calls `installStatusline` / `removeStatusline`
  (`docs/context.md`). A refused change comes back with our sentence, shown for 8 s, and the switch
  shows what the files say. The classification switch and its earlier-turns dialog use the
  classifier's IPC (`docs/classifier.md`).
- **About** opens its two links (website, issues) only on a click, through `app:open-link`, which
  knows those two addresses and no other.
- **The Usage window** asks `usage:view` for a period. Main runs a pass on the same one-at-a-time
  runner as the hourly pass, then builds the Totals and one report per bar in the usage query worker
  (`src/main/usage-query-worker.ts`). The chart's series, axis and labels are computed in core
  (`src/core/usage/chart.ts`, Node-free); the page only draws them. A report that arrives after
  another period was chosen is dropped.

## Why

- **Windows of their own, not dialogs inside the main window**: a page of their own keeps Preferences,
  About and Usage out of the main window's renderer, which another session builds, and gives the
  Usage window the size and life of its own the spec asks for.
- **The Font row lists the installed monospace families (`fc-list`) with a size**: Electron has no
  system font chooser. The setting keeps agent-tablet's form, `"Family Size"`, which the terminals
  already read.
- **The earlier-turns dialog uses the system's date picker** instead of an always-open month
  calendar. It picks the same day, today minus seven by default.
- **The usage passes get the current projects' memberships** (`currentMemberships()`). They were
  started with none while projects did not exist, which would have filed every turn under
  "(no project)".

## Checks

- Vitest: `tests/core/settings.test.ts`, `tests/core/usage/{chart,stepper}.test.ts`.
- e2e under `npm run ui-check`: `e2e/preferences.spec.ts` (the General page, themes reaching every
  window, languages, Restart now with nothing running and with a session running),
  `e2e/integrations.spec.ts` (the status line switch with its backup and refusal, the
  classification switch and the earlier-turns dialog with the stand-in `claude`, About),
  `e2e/usage-window.spec.ts` (periods, the stepper, Totals and By day; screenshots in
  `test-results/usage/`).
