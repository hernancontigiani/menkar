# The Settings and Usage windows — how they are built

Menkar's own windows besides the main one. The code says what each does. This file keeps why they
are shaped this way.

## The shape

- **Settings and Usage are windows of their own** (`src/main/windows.ts`), never children of a
  main window: GNOME's mutter keeps a child window attached to its parent, and the parent then
  takes no clicks while it is open (decision 1.24 for Usage, 2026-11-10 for the rest).
  - **Settings** is one window for the app. `openSettings(section?)` shows the open one, focuses it
    and sends it the asked section on `settings:section`. The window actions are `openSettings`
    (with an optional section), `Ctrl+,` and `Ctrl+B s`.
  - **Usage** is one per main window, scoped to that window's project (decision 1.15). Closing the
    opener leaves Usage open and reloads it, now showing every project.
- **Settings is laid out as Ubuntu's Settings** (2026-11-10): a list of sections on the left, the
  chosen section on the right under its title.
  - Appearance holds everything visual: the scheme, the style, the theme, Terminal colors
    (decision 1.42), Interface size, and the font of the terminals and the file editor. Terminal
    keeps only behaviour, the scrollback (decision 1.36).
- **Interface size** (decision 1.36, `ui_scale`: 90, 100, 110, 125 or 150; anything else reads as
  100) scales Menkar's own text and controls in every window, live.
  - **Why page zoom:** it is each window's page zoom (`src/main/zoom.ts`), not a root font size,
    because the styles are in pixels; a root font size would grow the text and leave the boxes as
    they were. Every window starts at the zoom (`zoomFactor`), and a change reaches every open one.
  - **What must not scale:**
    - The terminals' and the editor's font is divided by the zoom (`screenFont` in
      `terminals.ts`), so it keeps the Font setting's size on the screen.
    - The system's window buttons are sized in the window's pixels, so main scales the header
      height the page sends by its zoom, and sends it again when the zoom changes (the page's
      header does not change in its own pixels).
    - Settings and Usage open at their size × the zoom and are resized with it, so their content
      still fits.
- **Dropdowns** (2026-11-10): every window's root carries `color-scheme` (`dark` or `light`, from
  the resolved look), so Chromium draws a dropdown's native list and the scrollbars in that scheme.
  Before that, a dark page's white option text sat on a white list. Options also take the theme's
  `--bg` / `--fg`. e2e checks the options' own colours (4.5:1) and the scheme; xvfb never draws the
  native popup, so how it looks is the human's check (STATUS §2).
  - The list's order and its group separators are one constant, `SETTINGS_LIST`
    (`src/core/preferences.ts`), and the section names are typed from it.
  - Up and Down move through the list. The page remembers the last section shown, in its own
    storage, only as a convenience.
  - About and the MCP servers browser are sections, not windows. MCP reads `~/.claude.json` again
    each time it is shown, and never writes it. The other sections are built once.
- **Each window has its own page** (`src/renderer/{settings,usage}.html`, each with its own entry in
  `electron.vite.config.ts`). It imports the main window's `look.ts`, `dom.ts` and `i18n.ts`
  read-only. Its CSS is its own (`windows.css`, `usage.css`), so it shares no file with the main
  window's renderer.
- **Settings**: a row writes through `settings:set`. Main checks the value
  (`src/core/preferences.ts`, `validSetting`), writes it through `sessions.updateState()` (the one
  holder of `state.json`), then pushes every main window's state (`pushWindowStates()`) and sends
  `settings:changed` to every window. So a theme, style, scheme, font or scrollback change reaches
  every window at once (the original reached only the window that opened its Preferences).
- **Files** (2026-11-11, after Usage in the Data group): the Menkar folder and where shared files
  arrive, each a path with "Choose…" (`settings:choose-folder`, the system's folder chooser from
  the Settings window; `''` shows and means the default, `PreferencesInfo.filesDefaults`); what ⬇
  shows (`files_bring`); and the days before the trash (`files_trash_days`, 0–365). Changing the
  Menkar folder moves nothing: a line under the row says where the old one stays
  (`docs/project-files.md`).
- **The language** is read once at start, before any window (`src/main/index.ts`). "Restart now"
  calls the workspace's `quitApp()`, which saves the layout as the last window's close does and
  hangs up every pty (SIGHUP, decision 1.9), **with no question even while sessions run**
  (2026-11-10): the question opened behind the Settings window, so the button seemed to do nothing.
  `app.relaunch()` is registered on `will-quit` before the quit starts; asked for after the quit
  ran to its end, it never happened. The next start reopens the saved tabs, and the shown
  project's sessions start again with `claude --resume`; another project's wait until it is shown
  (decision 1.32).
- **Unsaved file edits stop Restart now** (2026-11-10): `app:restart` first answers with the
  edited files of every window (`unsavedEverywhere()`), and the Settings window asks the window
  close's question, "Save changes to …?", on itself, where the button was pressed. Cancel asks
  for nothing more, so no relaunch is registered; Save writes the files and restarts (a refused
  write shows "… was not saved" and stays); Discard restarts.
- **Integrations**: the status line switch calls `installStatusline` / `removeStatusline`, and the
  transcript retention switch calls `installRetention` / `removeRetention` (`docs/context.md`). A refused change comes back with our sentence, shown for 8 s, and the switch
  shows what the files say. The classification switch and its earlier-turns dialog use the
  classifier's IPC (`docs/classifier.md`).
- **Cursor** (the human, 2026-11-23, option A of topic 108): a section after Transcript retention
  holding Cursor's own items, its hooks and its allow entries (`docs/agents.md`, "Cursor: its
  integrations items"). The section is generic: main lists every agent whose kit offers items
  (`integrations:agent-items`), one group each, and the section is named after those agents and
  absent when none offers any. While the agent's CLI is not on the PATH, looked up each time the
  section is shown, its group is greyed with a line saying so and a change is refused; in the
  sandbox a line says to turn the items off before uninstalling it.
- **The classifier with its agent missing** (the human, 2026-11-27, option (a) of topic 111): the
  "Classify turns" group is greyed the same way, with the line from `classifier:status`'s `missing`
  above its card; a switch left on can be turned off, not on (`docs/classifier.md`).
- **About** opens its two links (website, issues) only on a click, through `app:open-link`, which
  knows those two addresses and no other.
  Its "Coding agents" card lists every agent Menkar can run, with its installed and validated
  version and its standing, from `agents:versions` (`src/main/agent-versions.ts`,
  `docs/agent-versions.md`); it fills again whenever main reads the versions anew.
- **The Usage window** (2026-11-18) has a left bar of three sections, Spend, Your time and Task
  times, in Settings' classes (`settings-side`, `section-list`, `section-item`) at 180 px, with the
  scope's two buttons at its foot. `src/renderer/usage.ts` holds the shell — the bar, the foot, the
  header's one `[data-toggles="period"]`, the sections' state through `src/core/usage/sections.ts`
  (Node-free: the carry is tested in Vitest, the page only calls it) — and each section's body is
  its own module: `usage-spend.ts`, `usage-time.ts`, `usage-tasks.ts`, given a `SectionContext`
  (the locale, the scheme, the scope, today, `choose`, `render`, the star).
  - **Three paths**, one per section: `usage:view` (Spend), `usage:activity` (a day or a week) and
    `usage:flow` (7 or 30 days), each with `allProjects`. Their handlers in `src/main/preferences.ts`
    resolve the opener window's shown project the same way (`openerProject`).
  - **Main runs a pass first**, on the same one-at-a-time runner as the hourly pass, so the human's
    turns are in the history. Your time and Task times then **import the activity journal**
    (`importActivity()`): otherwise the journal reaches the history only from the callback each pass
    starts and does not wait for, and the figures could lag the Board by up to an hour. The import
    comes after the pass, never beside it: both open the history. Then the usage query worker
    (`src/main/usage-query-worker.ts`) builds the answer: Spend's Totals and one report per bar, the
    day or week of `readActivity`, or `taskFlow`.
  - The chart's series, axis and labels are computed in core (`src/core/usage/chart.ts`), the day's
    count axis and positions in `src/core/usage/timeline.ts`, the flow's rows in `flowTable`
    (`flow.ts`); all Node-free, the page only draws them.
  - **One `latestOnly()` serves the three asks**: any newer ask — a period, a step, a section, the
    scope — drops an older answer, whatever section it was for, and the star covers the body until
    the newest arrives. A section switch always asks: the figures change as the human works.
  - A refused ask shows our sentence (`usage.readFailed`) in the body instead of a star turning for
    ever.

## Why

- **Windows of their own, not dialogs inside the main window**: a page of their own keeps Settings
  and Usage out of the main window's renderer, which another session builds, and gives the
  Usage window the size and life of its own the spec asks for.
- **The Font row lists the installed monospace families (`fc-list`) with a size**: Electron has no
  system font chooser. The setting's form is `"Family Size"`, which the terminals read. A size with the default family is stored as `monospace <size>` (2026-11-10), the alias
  the terminals fall back to, and the row shows it as the default again. It used to store nothing,
  so a size change with the default family was lost. The default family at 10 pt stays the empty
  setting.
- **The earlier-turns dialog uses the system's date picker** instead of an always-open month
  calendar. It picks the same day, today minus seven by default.
- **The usage passes get the current projects' memberships** (`currentMemberships()`). They were
  started with none while projects did not exist, which would have filed every turn under
  "(no project)".

## Checks

- Vitest: `tests/core/settings.test.ts`, `tests/core/usage/{chart,stepper}.test.ts`.
- Vitest for Cursor's items: `tests/core/agents/cursor/integrations.test.ts` (byte for byte) and
  `tests/main/agent-integrations.test.ts` (greyed, the sandbox's line).
- e2e under `npm run ui-check`: `e2e/settings.spec.ts` (one window with no parent, the sections and
  their groups, the keys, the retention switch, screenshots in `/tmp/menkar-shots/settings-*.png`),
  `e2e/preferences.spec.ts` (the rows at their defaults, themes reaching every window, languages,
  Restart now with nothing running, and with a session running: no question, the agent hung up,
  and a next start on the same directories resuming it in its tab; with an unsaved file, the
  question on Settings, Cancel keeping the app and the edit, Save writing it and restarting),
  `e2e/integrations.spec.ts` (the status line switch with its backup and refusal, the
  classification switch and the earlier-turns dialog with the stand-in `claude`, About),
  `e2e/usage-window.spec.ts` (periods, the stepper, Totals and By day; screenshots in
  `test-results/usage/`), `e2e/usage-sections.spec.ts` (the left bar and its keys, the foot and the
  scope carried, the carry and the keep across sections, a late answer dropped across a switch),
  `e2e/usage-time.spec.ts` (the day, the hover, the week and its steps over a seeded history and
  journal) and `e2e/usage-tasks.spec.ts` (the flow's figures, the folds, the baseline, the empty
  card); each saves its screenshots, dark and light, under `test-results/usage-{sections,time,tasks}/`.
- Vitest for the sections and the readings: `tests/core/usage/{sections,timeline,bursts,flow}.test.ts`.
- `e2e/integrations.spec.ts` also covers the classifier with no `claude` on the PATH (greyed, its
  line, a switch left on turned off; `test-results/integrations/classifier-missing.png`).
- `e2e/integrations.spec.ts` also covers the Cursor section with and without the stand-in
  `cursor-agent`, its screenshots in `test-results/integrations/cursor-*.png`.
