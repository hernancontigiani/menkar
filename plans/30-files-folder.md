# Plan 30: a files folder per project (1.51, 1.58, 1.60, 1.61)

> **Status:** written 2026-11-11 by `set` with the human's answers of the same day (1.58, 1.60).
> Ready to execute.
>
> **Exit, when executed:**
> - `docs/project-files.md` (new): the folder, its naming and renaming, the Files section, bringing
>   in and Undo, the trash timer, `--add-dir` / `MENKAR_FILES`, and "Rejected" below. Its row
>   enters the subsystem table in `CLAUDE.md` ("Open it when: the per-project files folder, the
>   sidebar's Files section, bringing a file in, or `--add-dir`").
> - `docs/preferences.md`: the Files section of Settings and its four rows.
> - `docs/window.md`: `Ctrl+B f` is generated from the shortcuts table; one line where the
>   sidebar's foot is described, pointing to `docs/project-files.md`.
> - `plans/00-STATUS.md`: this row leaves §3 (closing note to its history); 1.51, 1.58 and 1.60
>   point to `docs/project-files.md`.
> - The rest → `git log`.
>
> Replaces nothing.

## Goal

Each project has a folder of its own, outside every repository, for the files that come in (from
Slack, mail, the browser) and go out (what an agent generates to share). Menkar lists it at the
foot of the sidebar, brings a shared file into it, lets a file be dragged out to another app, opens
it in the file manager, gives the sessions it starts access to it, and sends old files to the
trash.

## What already exists (verified 2026-11-11)

- **Paths:** `src/core/paths.ts`, resolved when called (`appDirs()`); Windows and macOS take
  Electron's directories through `usePlatformDirs`. Nothing for a user-visible folder yet.
- **Settings:** `SETTINGS_LIST` (`src/core/preferences.ts:95`) orders the sections; the Data group
  holds only `usage`. A row writes through `settings:set`, checked by `validSetting`, stored in
  `state.json` (`src/core/state.ts`, unknown keys kept in `rest`), pushed to every window
  (`docs/preferences.md`, "Settings").
- **Agent commands:** `buildCommand` (`src/core/command.ts:27`) — options then `--settings`; the
  three start kinds (`new`, `resume`, `fork`). Called at `src/main/workspace.ts:539`.
- **Pty env:** `StartOptions.env` (`src/main/terminal.ts:45`, added for 1.56) and the agent pane's
  `env: { [PANE_ENV]: id }` (`src/main/workspace.ts`, `startPaneHeld`).
- **Projects:** `renameProject` / `deleteProject` (`src/core/projects/model.ts:120,127`), handled at
  `src/main/workspace.ts:1272`. A project keeps unknown keys in `rest`.
- **Shortcuts:** one table, `src/core/shortcuts.ts`; prefix chords with `after(...)`; `f` after the
  prefix is free.
- **Opening and trashing:** `shell.openPath` (1.59, `openLink`), `shell.trashItem`
  (`workspace.ts:1698`), `dialog.showOpenDialog` (`workspace.ts:1210, 1444`).
- **Toasts with an action:** `toast(text, { action })` in `src/renderer/ui.ts:124`.
- **The sidebar's list and group headings:** `renderList`, `src/renderer/app.ts` (plan 29 made a
  group heading a collapsing button; reuse its look).
- **Folder watching:** `src/main/files.ts:95` watches a file's folder with `persistent: false`.

## The design

### Decided by the human (1.51, 1.58, 1.60)

1. **The root is `~/Menkar`** (`%USERPROFILE%\Menkar`), changeable in Settings; a change moves
   nothing and says where the old one is.
2. **One folder per project**, `<root>/<project folder>/files`, for what comes in and what goes
   out alike.
3. **A collapsible "Files" section at the foot of the sidebar**, under the sessions and the
   "N hidden" foot: heading `▾ Files · N` with two buttons, ⬇ (bring in) and 📂 (open the folder);
   its files newest first (name, relative age). Double-click opens a file with its app; dragging a
   row out hands the file to the other app (Slack, mail, the file manager). Collapsed, it is the
   heading alone. The collapsed state is saved per project.
4. **Bringing a file in:** Settings names the folder where shared files arrive (default: the
   system's Downloads). ⬇ either opens the system's file chooser in that folder (several files
   may be chosen) or shows a menu of its 5 newest files by modification time; which one is a
   setting. The chosen files are **moved** into the project's folder, and a toast
   "<file> → <project>" offers **Undo** for 8 s, which moves them back.
5. **Old files go to the trash by themselves**: a file not modified for 30 days (Settings, 0 =
   off) goes to the system's trash, checked at start and then every 24 h.
6. **The sessions Menkar starts** get `--add-dir <project folder>` (Claude only) and every agent
   pane gets `MENKAR_FILES=<project folder>`.
7. **`Ctrl+B f`** opens the shown project's folder in the file manager, as 📂 does.
7b. **`Ctrl+B o`** opens the focused pane's working folder (the agent's or the shell's, the same
    folder `Ctrl+\`` starts its shell in) in the file manager, Nautilus or Explorer
    (`shell.openPath`). Also "Open folder" in the session row's menu (the session's folder) and in
    the tab's right-click menu (the focused pane's).

### Decided by `set` within those (technical, 2026-11-11)

8. **The project's folder name** is its name made safe for every platform: `<>:"/\|?*` and
   control characters become `-`, trailing dots and spaces go, an empty result or a Windows
   reserved name (`CON`, `NUL`, `COM1`…, any case, with or without an extension) gets a `_`
   suffix. Two projects whose safe names collide (case-insensitively, for Windows and macOS) get
   ` (2)`, ` (3)`. The name chosen is **saved on the project** (`files_folder` in `projects.json`)
   the first time the folder is made, so it never changes behind the user's back.
9. **Renaming a project renames its folder** when the folder exists and the new safe name is
   free; otherwise the folder keeps its old name (logged), since moving files the user may have
   open is worse than an old name. **Deleting a project leaves its folder** as it is.
10. **The folder is made when first needed**: bringing a file in, 📂 / `Ctrl+B f`, or a Claude
    session of that project starting (so `--add-dir` names a folder that exists). Nothing is made
    for a project nobody uses.
11. **What the section lists:** the folder's regular files, not subfolders and not dotfiles,
    newest first by mtime; read with async I/O in main, re-read on a watch of the folder
    (debounced 200 ms) while the project is shown in some window.
12. **A name clash on moving in** gets ` (2)` before the extension. A move across filesystems
    copies then removes the source, and a failed copy leaves the source where it was. Undo moves
    each file back to its original path if that is free, else beside it with ` (2)`.
13. **The trash timer** reads time through `src/core/clock.ts`; "older than N days" is
    `now - mtime > N × 24 h`, so midnight and a clock jump change nothing beyond the file's own
    age. It trashes files only, in project folders only (never the incoming folder, never the
    root), and logs each; a failure is logged and skipped. A file open in a Menkar file tab is
    skipped.
14. **Settings rows** (a new section **Files**, after Usage in the Data group): the Menkar folder
    (path + "Choose…"), "Shared files arrive in" (path + "Choose…", default `app.getPath
    ('downloads')`), "Bring in shows" (the file chooser / the 5 newest), "Move files to the trash
    after" (days, 0–365, 0 = never; default 30). Stored in `state.json`: `files_root`,
    `files_incoming`, `files_bring` (`chooser` | `newest`), `files_trash_days`; an absent or
    invalid one reads as its default.
15. **Dragging out** uses Electron's `webContents.startDrag({ file, icon })`, asked from the
    renderer's `dragstart` through a typed IPC call naming the project and the file's name — main
    resolves the path itself and refuses one outside the project's folder.

### Where a CLAUDE.md rule does not fit, and what replaces it

- **"The app's own state lives in its own directories."** `~/Menkar` is not the app's state: it
  holds the user's files, which the user opens, drags and deletes, as the human decided (1.58).
  The app's own data about it (`files_folder`, the settings) stays in `projects.json` and
  `state.json`. **What replaces the guarantee:** Menkar never writes there except the moves,
  folder creation and renames the user's actions cause, and the trash timer the user can set to 0;
  a test asserts the trash timer touches nothing outside project folders.
- **"Paths are resolved through one module":** the root goes through `src/core/paths.ts`
  (`filesRoot()`), resolved when called, so tests point it at a temporary directory.

### Rejected, and why

- **Two folders, in and out** — the human chose one (2026-11-11): nothing to sort.
- **Copying a download instead of moving it** — Downloads fills with copies; Undo covers a mistake.
- **A header button or a tab for the files** — the human chose the sidebar's foot.
- **Trashing by hand only** — the human chose the timer, with 0 to turn it off.
- **The folder named by the project's id** — unreadable in the file manager and in Slack's picker.
- **Renaming the folder whatever is in the way** — could move files out from under an open app.
- **The folder inside the repository** — would show in `git status` and be committed by accident.

## Tests that hold the decisions (written before the code, in the block that names them)

| Decision | Test | Case → expected |
|---|---|---|
| 8 safe names | `tests/core/files/folders.test.ts` (new) | `Guardian AI` → `Guardian AI`; `a/b:c?` → `a-b-c-`; `con` → `con_`; `Nul.txt` → `Nul.txt_`; `name. ` → `name`; `` → `_`; existing `["API"]`, new `api` → `api (2)` |
| 8, 9 saved and renamed | `tests/core/projects/model.test.ts` | rename keeps `files_folder` unless told the folder moved; a store round-trip keeps `files_folder` |
| 12 clash and undo | `tests/core/files/folders.test.ts` | moving `a.pdf` into a folder holding `a.pdf` → `a (2).pdf`; undo to a taken original → `a (2).pdf` beside it |
| 13 trash selection | `tests/core/files/trash.test.ts` (new) | with `now` at 2026-11-11 00:00:30 and N = 30: mtime 30 d + 1 s ago → trashed; 30 d − 1 s → kept; N = 0 → nothing; a subfolder and a dotfile → kept; the incoming folder and the root → never listed; a path open in a file tab → kept |
| 6 command | `tests/core/command.test.ts` | `new`, `resume`, `fork` with `addDirs: ['/h/Menkar/p/files']` → `--add-dir /h/Menkar/p/files` before `--settings`; Cursor → no `--add-dir`; a path with a space is quoted |
| 14 settings | `tests/core/preferences.test.ts` | `files_trash_days` 400, -1, "x" → refused; `files_bring` "other" → refused; absent → defaults |
| 15 drag guard | `tests/core/files/folders.test.ts` | `../x`, an absolute path, a dotfile, a name with `/` → refused |
| 3, 4 window | `e2e/project-files.spec.ts` (new) | with `files_root` and `files_incoming` in temp dirs and two files in incoming: the section shows `Files · 0`; ⬇ (newest mode) lists both, newest first; choosing one → it is in the project folder, gone from incoming, the row shows it; Undo → back in incoming; collapse → heading only, still collapsed after a restart |
| 3 drag out | same | `dragstart` on a row asks main with the project and name (the IPC stubbed to record), and a crafted request for `../x` is refused |
| 5 timer | same | a file with mtime 40 days ago, `files_trash_days` 30, start → `shell.trashItem` called with its path (stubbed) |
| 6 env | `e2e/terminal.spec.ts` or the new spec | an agent pane's `echo $MENKAR_FILES` prints the project's folder |
| 7 shortcut | the new spec | `Ctrl+B f` → `shell.openPath` called with the folder (stubbed), the folder exists |
| 7b session folder | the new spec | `Ctrl+B o` in an agent pane → `shell.openPath` with the pane's cwd; "Open folder" in the row's menu → the session's folder; a session whose folder is gone → a toast, no call |

## Out of scope

- Subfolders inside a project's folder (listed or browsed); a search box in the section.
- Moving files between projects; a per-file menu beyond Open and Show in folder.
- Making the agent write its outputs there: that is the user's instruction or a repository's
  `CLAUDE.md`, not Menkar's.
- Watching the incoming folder (the 5 newest are read when ⬇ is pressed).
- Windows and macOS checks beyond what the e2e covers on Linux (plan 27).
- Migrating the folder when the root changes (decision 1: it moves nothing).

## Do not touch

- `~/.claude` and anything an agent owns: `--add-dir` is a command-line flag, never a settings
  write.
- The sidebar's session list, groups and their collapse (plan 29), and the "N hidden" foot.
- `buildCommand`'s existing order and quoting; `--settings` stays last before `&& exit`.
- The file tabs' buffer and check code (`src/main/files.ts`, `src/core/files/check.ts`), except
  reading which paths are open (decision 13).

## Execution blocks

### Block 1 — core: paths, names, moves, trash selection, the command

- [ ] Write the core tests above (folders, trash, command, preferences); see them fail.
- [ ] `filesRoot()` in `src/core/paths.ts` (setting or `~/Menkar`, resolved when called).
- [ ] `src/core/files/folders.ts`: `safeFolderName`, `uniqueFolderName`, `clashFree`,
      `insideFolder` (the drag guard); `src/core/files/trash.ts`: `filesToTrash(listing, now,
      days, open)` as a pure function over a listing.
- [ ] `CommandOptions.addDirs` in `buildCommand`, Claude only.
- [ ] The four settings in `validSetting` and their defaults; `files_folder` on a project in the
      store (kept as a known key, written only when set).
- **Verify:** `npm run ci`.

### Block 2 — main: folders, moves, the timer, the agents

- [ ] A main module `src/main/project-files.ts`: make the folder (10), list it (11) with async
      I/O, watch it while shown, move in with clash names and cross-device fallback (12), Undo,
      open the folder (`shell.openPath`), open a file, `startDrag` (15), the trash timer (5, 13)
      at start and every 24 h through the clock, skipping open file tabs.
- [ ] Rename and delete of a project (9) in `src/main/workspace.ts` beside `renameProject`.
- [ ] `--add-dir` and `MENKAR_FILES` where the agent command and the pane env are built
      (`startPaneHeld`), making the folder first.
- [ ] Typed IPC for the section (list, bring in: chooser or newest, undo, open, drag) in the one
      IPC module, and the project's files pushed to the window when they change.
- **Verify:** `npm run ci`.

### Block 3 — Settings: the Files section

- [ ] `files` after `usage` in `SETTINGS_LIST`, its icon, the four rows (14), "Choose…" through
      `dialog.showOpenDialog({ properties: ['openDirectory'] })`; changing the root says where
      the old one is (a line under the row).
- [ ] Strings in English and Spanish.
- **Verify:** `npm run ci`; `npm run ui-check` on the settings specs; a screenshot of the
  section, dark and light.

### Block 4 — the sidebar's Files section and `Ctrl+B f`

- [ ] Write `e2e/project-files.spec.ts` (table above); see it fail.
- [ ] The section in `renderList` after the hidden foot: the collapsing heading styled as a group
      heading, ⬇ and 📂, the rows, double-click, `dragstart` → IPC, the newest-5 menu, the Undo
      toast; collapsed state saved per project (`files_collapsed` on the project).
- [ ] `openFilesFolder` (`after('f')`) and `openPaneFolder` (`after('o')`) in
      `src/core/shortcuts.ts`, dispatched like the others; Settings → Keyboard shortcuts and the
      `Ctrl+B ?` help pick them up from the table. "Open folder" in the row's menu (after Open
      beside) and in the tab's right-click menu; the pane's cwd as the drawer finds it
      (`drawerFolder`).
- [ ] Strings in English and Spanish.
- **Verify:** `npm run ci`; `npm run ui-check` (full); screenshots of the section expanded with
  files, collapsed, and the newest-5 menu, dark and light, looked at before reporting.

### Block 5 — docs

- [ ] `docs/project-files.md` (new), its row in `CLAUDE.md`'s table; `docs/preferences.md`;
      `docs/window.md`'s one line.
- [ ] Execution log below.
- **Verify:** `npm run ci`.

## Execution log

_Written by the executing session._
