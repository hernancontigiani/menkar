# History of `docs/project-files.md`

## The Files section

> Left on 2026-11-11: the section became its own container, ⬇ became Add, and it shows the 5 newest
> files then "N more…" (decision 1.62).
- At the foot of the session list, under the sessions and the "N hidden" foot, also on an empty
  project: a heading `▾ Files · N` (plan 29's group heading button, its chevron and hover) with ⬇
  (bring in) and 📂 (open the folder in the file manager), then the folder's regular files, not
  subfolders and not dotfiles, newest first by modification time, with a relative age. Collapsed
  (saved per project, `files_collapsed`), it is the heading alone.

> Left on 2026-11-11: a double click opens a file the editor can show in a Menkar file tab, and a
> row has a right-click menu (decision 1.65).
- **Double click** opens the file with its app (`shell.openPath`). **Dragging a row out** hands the
  file to another app: the page's `dragstart` names the file (`dragProjectFile`), and main resolves
  the path itself and refuses one that is not a plain name of that folder — `..`, an absolute path,
  a dotfile, a name with a separator (`insideFolder`) — then calls `webContents.startDrag`.

> Left on 2026-11-12: the right-click menu gains "Move to Trash" (decisions 1.88, 1.97).
- **Right click** shows "Open in Menkar", disabled with the check's reason as its tooltip when the
  file can't be shown (`checkProjectFile`), and "Open with the system's app". Ctrl+click on a
  terminal link or path still opens with the system's app.

## Bringing a file in

> Left on 2026-11-11: ⬇ became Add (decision 1.62).
- ⬇ shows, as Settings says (`files_bring`), the system's file chooser in the incoming folder

## The title

> Left on 2026-11-17: `--add-dir` was dropped for the --settings file's additional directory.
# Project files — a folder per project, the sidebar's Files section, `--add-dir`

## The sessions Menkar starts

> Left on 2026-11-17: Claude Code 2.1.326's trust dialog on `--add-dir`; the folder goes in `permissions.additionalDirectories`.
- **Every agent pane** (Claude Code or Cursor) of a project gets `MENKAR_FILES=<project folder>` in
  its environment, beside the pane's own id, and the folder is made before it starts. **A Claude
  Code session** also gets `--add-dir <project folder>`, after its identity and before
  `--settings`; Cursor has no such flag. It is a command-line flag, never a settings write.
