# History of `docs/spec/files.md`

## Acceptance cases

> Left on 2026-11-08: built by plan 13, described in `docs/files.md` and `docs/sessions.md`.
- **FIL-1** `Ctrl+Shift+O` with a terminal focused → the "Open file" dialog opens with the entry
  focused; the terminal receives nothing.
- **FIL-2** Typing `notes.md` and Enter → the error line reads
  "Type a full path, starting with / or ~." and the dialog stays open.
- **FIL-3** Typing `~/notes.md` with that file present → it opens (the home folder replaced `~`);
  typing `~bob/x` → "Type a full path, starting with / or ~.".
- **FIL-4** Typing a folder → "That is a folder; choose a file."; a missing path →
  "There is no file at that path.".
- **FIL-5** A 12 MiB text file → "The file is larger than 10 MiB."; a file whose byte 100 is NUL →
  "The file looks binary, not text."; a Latin-1 file containing byte 0xE9 →
  "The file is not UTF-8 text."; a file without read permission → "The file could not be read.".
- **FIL-6** A file with a NUL byte only after its first 8 KiB, otherwise valid UTF-8 → opens.
- **FIL-8** Opening `/work/api/README.md` → a tab titled `README.md`, tooltip
  `/work/api/README.md`, selected, editor focused, line numbers and Markdown syntax colors.
- **FIL-10** `/home/u/link.md` is a symbolic link to `/home/u/real.md`; opening both in one project
  → one tab (the second open selects the first); its tooltip is `/home/u/real.md`.
- **FIL-12** Opening `~/.claude/settings.json` → the bar
  "This file belongs to Claude Code: Menkar only reads it."; typing changes nothing; `Ctrl+S` →
  "settings.json was not saved" with that sentence; the file's bytes and modification time are
  unchanged. Same for `~/.claude.json`, and for a file reached through a link into `~/.claude/`.
- **FIL-13** A file with mode `0444` owned by the user → the bar "You cannot write this file." and
  the text not editable.
- **FIL-15** Edit, then `Ctrl+S` → the file on disk has the new content, the ` •` clears, and no
  "changed on disk" bar appears.
- **FIL-20** Closing the only editor tab of a file with unsaved edits → "Save changes to notes.md?";
  Cancel → still open; Discard → closed, file on disk unchanged; Save → saved, then closed.
- **FIL-23** A Markdown editor tab shows the flat "Preview" button with tooltip
  "Show it rendered (Ctrl+Shift+V)"; a `.py` tab does not; `Ctrl+Shift+V` in the `.py` tab does
  nothing.
- **FIL-24** With tabs `[session] [notes.md] [other.txt]`, Preview on `notes.md` → strip becomes
  `[session] [notes.md] [Preview — notes.md] [other.txt]` with the preview selected; pressing
  Preview again → selects the same preview; `Ctrl+Shift+V` in the preview → selects `notes.md`.
- **FIL-25** A file containing a two-column pipe table and `~~old~~` → the preview shows an HTML
  table with borders and struck-through "old". A line `<script>alert(1)</script>` → shown
  literally as text, nothing runs.
- **FIL-31** `menkar open` with no file → stderr "Usage: menkar open <file> [<file>…]", exit 2.
- **FIL-32** App running with one window on project A; in `/work/api`, `menkar open README.md` → a
  tab for `/work/api/README.md` in project A, the window raised.
