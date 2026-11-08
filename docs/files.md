# Files — file tabs, the Markdown preview, `menkar open`

How file tabs are built and why that way. The behaviour is `docs/spec/files.md`.

## One buffer per file, in main

- Windows are separate renderer processes, so the buffer every tab of a file shares lives in main
  (`src/main/files.ts`). Its identity is the path resolved through links, so a link and its target
  are one file. It holds the text as CodeMirror's `Text`, a version, the unsaved mark, the
  read-only reason, the on-disk bar, and the text last read from or written to disk.
- An edit in a tab goes to main as a CodeMirror `ChangeSet` with the version it was made on. Main
  applies it when the version matches and sends `file:update` (the change, the new version, the
  mark) to every window with a tab of that file. A window applies it to its other views of the
  file. An echo of the window's own edit never moves its version back, because later keystrokes
  were already sent on top of it. A stale edit is refused, and the whole text goes back to start
  again from.
- The buffer lives while any tab, editor or preview, holds it (`releaseBuffersExcept` on every
  layout change).

## The file check and read only

- `src/core/files/check.ts`, off the UI path, on the resolved path:
  - a path that cannot be stat'ed or read is refused;
  - so is anything that is not a regular file;
  - so is a file over 10 MiB, one with a NUL in its first 8 KiB, or one that is not UTF-8 (a
    fatal `TextDecoder`).
- The dialog's own refusals come first: a relative path, a folder, nothing there.
- **The agents' data is read only**: `~/.claude`, anything in it and `~/.claude.json`, each
  resolved through links, so a dotfile manager's links count too. A file the user cannot write is
  read only as well. The editor is not editable then, and `saveBuffer` refuses the agents' data
  **again right before writing**. An e2e asserts a refused save leaves the file's bytes and mtime.
- Changes on disk: the file's folder is watched (a save by rename or a deletion would end a watch
  on the file). A change equal to the last text the app read or wrote is its own and ignored. A
  real change reloads silently without unsaved edits, and shows the "changed" bar (Reload, Keep
  mine) with them. A deletion shows the "deleted" bar.

## The editor and the preview

- **CodeMirror 6**: state, view, commands, language, search, and the Markdown, JavaScript and
  TypeScript, JSON, Python, CSS and HTML modes. It was chosen over Monaco, which ships several
  megabytes of its own; with CodeMirror, its modes and markdown-it, the whole renderer bundle
  measured 1.8 MB minified (2026-11-08). It
  is bundled into the renderer, so it is not a module the installer carries. The editor follows
  the app's light/dark state, not the color theme (two `EditorView.theme`s in a `Compartment`).
- **The preview** is markdown-it (`commonmark` plus tables and strikethrough, HTML off, no
  linkify, no typography), written into an `<iframe sandbox="allow-same-origin" srcdoc>`. It has no
  scripts, and its CSP is `default-src 'none'; img-src file: data:; style-src 'unsafe-inline'`.
  Relative images become absolute `file:` URLs: the window's own policy forbids a `<base>`, so
  the renderer's `img-src` gained `file:`, local only.
- **Links** are handled by the parent window, since the frame runs no script: `http(s)` opens the
  system browser (`shell.openExternal`), a `.md` file opens in a tab, everything else does
  nothing. It re-renders 300 ms after the last change and keeps its scroll.

## `menkar open`

- The app takes Electron's single-instance lock on every start except `menkar usage`. `menkar open
  <file>…` makes each path absolute in the caller's folder and passes them as the lock's
  `additionalData`. A second instance hands them over and exits 0; a plain second start brings
  the active window forward.
- The running app (`deliverFiles`): one window opens them there. With several, the most recently
  focused one asks "Open in which window?". With none, a window opens on the current project.
  Each file goes through the file check; a refused one is an error dialog in that window. No file
  given prints the usage and exits with 2.
