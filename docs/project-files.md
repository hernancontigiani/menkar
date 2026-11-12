# Project files — a folder per project, the sidebar's Files section, `--add-dir`

Each project has a folder of its own for the files that come in (from Slack, mail, the browser)
and go out (what an agent generates to share), outside every repository (decisions 1.51, 1.58,
1.60, 1.61, 2026-11-11). The core is Node-only and Electron-free (`src/core/files/folders.ts`,
`trash.ts`, `filesRoot` in `src/core/paths.ts`); main does the I/O (`src/main/project-files.ts`);
the renderer draws the section and names files, never paths.

## The folder

- **The root is `~/Menkar`** (`%USERPROFILE%\Menkar`), or `files_root` when set. Changing it in
  Settings moves nothing; the row says where the old folder stays.
- **A project's folder is `<root>/<name>/files`**, the name made safe for every system
  (`safeFolderName`: `<>:"/\|?*` and control characters become `-`, trailing dots and spaces go,
  an empty or Windows-reserved name — `CON`, `NUL`, `COM1`…, any case, with or without an
  extension — takes a `_`). A name another project took, or that is already in the root, compared
  ignoring case, takes ` (2)`, ` (3)` (`uniqueFolderName`).
- **The name is chosen once and saved** on the project (`files_folder` in `projects.json`), so it
  never changes behind the user's back. **It is made when first needed**: bringing a file in, 📂 or
  `Ctrl+B f`, or an agent pane of the project starting. Nothing is made for a project nobody uses.
- **Renaming a project renames its folder** when the folder exists and the new safe name is free;
  otherwise it keeps its old name, logged, since moving files an app may have open is worse.
  **Deleting a project leaves its folder.**
- **Not the app's state.** The folder holds the user's files, which they open, drag and delete.
  Menkar writes there only the moves, folder creation and renames the user's actions cause, and
  the trash timer, which the user can set to 0. Its own data about it (`files_folder`,
  `files_collapsed`, the settings) stays in `projects.json` and `state.json`.

## The Files section

- At the foot of the sidebar, its own container (`#files-section`) between the session list and
  Add session, also on an empty project: a heading `▾ Files · N` (plan 29's group heading rules,
  its chevron and hover) with **Add** (a tray-with-arrow icon and the word, styled as the header's
  buttons, to bring a file in) and 📂 (open the folder in the file manager), then the folder's
  regular files, not subfolders and not dotfiles, newest first by modification time, with a
  relative age. Collapsed (saved per project, `files_collapsed`), it is the heading alone.
- **At most the 5 newest files** (decision 1.62, 2026-11-11); when there are more, a last row
  "N more…" opens the folder in the file manager, as 📂 does. The heading's count is the total.
- Main lists the folder with async I/O and watches it while its project is shown in some window,
  re-reading shortly after the last change (`syncShown`, called on every workspace change). The
  listing reaches the window in its state (`files`).
- **Double click** opens the file in a Menkar file tab when the editor can show it — the same file
  check as `Ctrl+O` (`checkFile`, in `docs/files.md`), Markdown with its preview button — and
  anything the check refuses (PDF, image, archive, Office) with the system's
  app (`shell.openPath`), with no toast (decision 1.65, 2026-11-11). Main runs the check, async,
  then decides (`openProjectFile`); the renderer only names the file.
- **Right click** shows "Open in Menkar", disabled with the check's reason as its tooltip when the
  file can't be shown (`checkProjectFile`), "Open with the system's app", and "Move to Trash".
  Ctrl+click on a terminal link or path still opens with the system's app.
- **Move to Trash** (decisions 1.88, 1.97, 2026-11-12) sends the file to the system's trash
  (`shell.trashItem`, never a delete) with no confirmation: the trash gives it back. A file open in
  file tabs, in any window, has those tabs closed after it is trashed. When its editor has unsaved
  edits, the tab's own close question comes first (Save, Discard, Cancel): Save saves then trashes,
  Discard trashes without saving, Cancel trashes nothing and leaves the tab. Main resolves the
  path as for a drag (`trashProjectFile`); a trash the system refuses leaves the tabs and shows
  "The file could not be moved to the trash."
- **Dragging a row out** hands the file to another app: the page's `dragstart` names the file
  (`dragProjectFile`), and main resolves the path itself and refuses one that is not a plain name of
  that folder — `..`, an absolute path, a dotfile, a name with a separator (`insideFolder`) — then
  calls `webContents.startDrag`.

## Bringing a file in

- **Add** shows, as Settings says (`files_bring`), the system's file chooser in the incoming folder
  (several files may be chosen), or a menu of that folder's 5 newest files. The incoming folder is
  `files_incoming`, or the system's Downloads (`app.getPath('downloads')`) while it is empty: core
  cannot know Downloads, so `''` means the default for both folder settings.
- The chosen files are **moved**, not copied: Downloads would fill with copies, and Undo covers a
  mistake. A name already in the project's folder takes ` (2)` before the extension (`clashFree`).
- **A move never replaces a file** (`moveExclusive`, `src/core/files/move.ts`): `rename()` would
  silently replace one that appeared after the free name was chosen, so a move is a hard link,
  which refuses an existing name atomically, then the source's removal. Where no link can be made
  (another file system, or one without hard links) it is an exclusive copy then the removal; a
  failed copy leaves the source and removes only its own partial copy. A name taken meanwhile moves
  the file to the next free ` (n)`. Files from the newest menu must be in the incoming folder
  itself.
- A toast "<file> → <project>" (or "N files → <project>") offers **Undo** for 8 s: each file goes
  back to its original path, or beside it with ` (2)` when that name was taken since.

## Old files go to the trash

- A file of a project's folder not modified for `files_trash_days` (default 30, 0 = never) goes to
  the system's trash (`shell.trashItem`), each one logged; a failure is logged and skipped.
- Checked a few seconds after the start (off the start's path, and late enough for a test to
  replace the trash) and then every 24 h. Time is read through `src/core/clock.ts`; "older than N days" is
  `now − mtime > N × 24 h`, so midnight and a clock jump change nothing beyond the file's own age.
- `filesToTrash` chooses over a listing and is pure: regular files directly in a project's folder,
  never the root's or the incoming folder's own files, never a subfolder or a dotfile, never a file
  open in a file tab.

## The sessions Menkar starts

- **Every agent pane** (Claude Code or Cursor) of a project gets `MENKAR_FILES=<project folder>` in
  its environment, beside the pane's own id, and the folder is made before it starts. **A Claude
  Code session** also gets `--add-dir <project folder>`, after its identity and before
  `--settings`; Cursor has no such flag. It is a command-line flag, never a settings write.
- Making the agent write its outputs there is the user's instruction or a repository's
  `CLAUDE.md`, not Menkar's.

## Opening folders

- `Ctrl+B f` and 📂 open the shown project's folder in the file manager, making it first.
- `Ctrl+B o` opens the focused pane's working folder, the same folder `Ctrl+\`` starts its shell in
  (`drawerFolder`), so an agent that `cd`'d elsewhere opens where it was started. "Open folder" is
  also in a session row's menu (the session's folder) and a tab's right-click menu (its focused
  pane's). A folder that is gone shows "That folder no longer exists." and nothing opens.

## Rejected, and why

- **Two folders, in and out**: the human chose one; nothing to sort.
- **Copying a download instead of moving it**: Downloads fills with copies; Undo covers a mistake.
- **A header button or a tab for the files**: the human chose the sidebar's foot.
- **Trashing by hand only**: the human chose the timer, with 0 to turn it off.
- **The folder named by the project's id**: unreadable in the file manager and in Slack's picker.
- **Renaming the folder whatever is in the way**: could move files out from under an open app.
- **The folder inside the repository**: would show in `git status` and be committed by accident.
