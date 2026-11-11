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

## Bringing a file in

> Left on 2026-11-11: ⬇ became Add (decision 1.62).
- ⬇ shows, as Settings says (`files_bring`), the system's file chooser in the incoming folder
