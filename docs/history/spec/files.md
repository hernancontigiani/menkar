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

## Opening a file from the window (F45, K3, M10)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
- **"Open file…"** in the `+` split button's menu (the item shows the accelerator `Ctrl+Shift+O`),
  or **`Ctrl+Shift+O`** anywhere in the window (captured before the terminal sees it), opens a
  dialog titled **"Open file"** (a header bar with the title and a close button):
  - an entry, placeholder **"A full path: /… or ~/…"**, focused, and beside it a button
    **"Browse…"**;
  - a hidden error line under them (error color);
  - an **"Open"** button, right-aligned, accent-colored and pill-shaped.
- **Enter** in the entry or **Open** checks the typed text:
  1. trimmed; `~` alone or a leading `~/` is replaced by the home folder; anything else must be an
     absolute path (`~user/…` is not expanded). Empty or relative →
     "Type a full path, starting with / or ~.";
  2. a folder → "That is a folder; choose a file.";
  3. nothing there → "There is no file at that path.";
  4. then the file check below (off the UI thread); a refusal shows its sentence in the error line.
  Errors show inside the dialog, which stays open. On success the dialog closes and the file opens.
- **Browse…** opens the system file chooser titled **"Choose a file"**. It starts in the project's
  folder **when every session of the project has the same working folder** (and it exists);
  otherwise in the chooser's own default. A project has no folder of its own. Choosing a file
  **puts its path in the entry and hides the error**; it does not open it (the user presses Open).
  Cancelling, or a location with no local path, changes nothing.

## The file check (every way of opening)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
Done off the UI thread, on the path resolved through symbolic links:

| Condition, in this order | Result |
|---|---|
| the path cannot be stat'ed or read | refused: "The file could not be read." |
| not a regular file | refused: "Only files open in a tab, not folders." |
| larger than 10 MiB (10 × 1024 × 1024 bytes) | refused: "The file is larger than 10 MiB." |
| a NUL byte in its first 8 KiB (8 × 1024 bytes) | refused: "The file looks binary, not text." |
| not valid UTF-8 | refused: "The file is not UTF-8 text." |
| otherwise | opens; read only when one of the rules below says so |

From the dialog, a refusal is the dialog's error line. From `menkar open` or a Markdown link, it is
an error dialog with heading **"The file was not opened"**, the sentence as body and an "OK"
button. From reopening a saved layout it is only logged (the tab is dropped).

## The tab (F45)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
- The tab opens **in the project the window shows**, at the end of the tab strip, and is selected;
  the editor gets the keyboard focus.
- **A file tab belongs to its project and reopens with it**, like a session tab: switching the
  window to another project hides it; switching back shows it.
- **Within one project, opening a file it already has a tab for selects that tab** (the editor and
  the preview are matched separately). The same file can have a tab in each of several projects,
  in one window or several.
- **One buffer per file** for the whole app (every window, every project): identity is the path
  resolved through symbolic links, so a link and its target are one file. An edit in one tab shows
  in every tab of that file at once, and so does the unsaved mark; the file is saved once. The
  buffer lives while any tab (editor or preview) holds it.
- **Title**: the file's name (base name); with unsaved edits, the name followed by ` •`
  (e.g. `notes.md •`). The tooltip is the full resolved path. In the tab strip the title is cut at
  28 characters with an ellipsis at the end. A file tab shows no state dot and no context ring.
- **The editor**: a source-code view with **line numbers**, the **current line highlighted**,
  **syntax colors** by the language guessed from the file's name and content type, monospace, no
  line wrapping, scrollable. Its font is the **terminal font** setting (family and size) taken
  when the tab opens; empty setting → the system monospace font. (A font changed in Preferences
  reaches file tabs opened afterwards, not those already open.) Its color scheme follows the app's
  light / dark state: the GtkSourceView schemes "Adwaita" (light) and "Adwaita-dark" (dark),
  switching live; it does not follow the app's color theme (Catppuccin etc.).
- **Loading and saving never block the window** (asynchronous). On load the cursor goes to line 1
  (or, on a reload, to the line it was on, clamped to the last line). A load that fails is logged;
  the tab stays as it was.

## Read only (F47)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
A file opens read only, with a bar across the top of the tab saying why:

| Rule | Bar text |
|---|---|
| the resolved path is `~/.claude.json`, the `~/.claude` folder, or anything inside `~/.claude` (each resolved through links, so a dotfile manager's links count) | "This file belongs to Claude Code: Menkar only reads it." |
| otherwise, the user has no write permission on it | "You cannot write this file." |

The text cannot be edited. The save path refuses the agents' data **again right before writing**,
whatever the tab says. `Ctrl+S` on a read-only tab opens the error dialog
"{name} was not saved" with the bar's sentence as body.

## Saving (K13)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
- **`Ctrl+S`** saves the selected file tab — **only while a file tab (editor or preview) is
  selected**; in a terminal `Ctrl+S` is the terminal's (XOFF). On a preview tab it does nothing
  (the key is still taken).
- A save **writes over any change made on disk** meanwhile (the bar already told the user; no
  modification-time check). After a save the unsaved mark clears and the app's own write is not
  reported as a change on disk.
- A save that fails → error dialog, heading **"{name} was not saved"**, body
  **"It could not be written; the edits are still in the tab."**; the edits stay.

## Changes on disk (F47)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
The app watches each open file:

| On disk | Buffer has unsaved edits? | What happens |
|---|---|---|
| changed (written, created, moved in, renamed) | no | reloads silently, cursor kept on its line |
| changed | yes | a bar: **"The file changed on disk, and you have unsaved edits."** with buttons **"Reload"** (drops the edits, reloads, cursor kept on its line) and **"Keep mine"** (hides the bar; the next save overwrites the disk) |
| deleted or moved away | either | a bar: **"The file was deleted on disk; saving writes it again."**, no buttons; the text stays; saving recreates the file |
| written by the app's own save | — | nothing |

A successful load or save clears the bar. The bar appears in every tab of that file.

## Closing with unsaved edits (F47)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
- **Closing a file's last editor tab** (across all windows) while the file has unsaved edits asks;
  closing an editor tab while another editor tab of the same file remains anywhere does not ask.
  Closing a preview tab never asks.
- **Closing a window** asks first about the files with unsaved edits **whose every editor tab is in
  this window** (a file also open in another window keeps its edits there and is not asked about),
  once for all of them; only then come the running sessions' confirmation (`projects.md`).
  Quitting is closing the last window.
- The question: heading **"Save changes to {names}?"** (`names` = the files' names joined with
  `, `), body **"Unsaved edits are lost if you discard them."**, responses **"Cancel"** (also
  Esc), **"Discard"** (destructive), **"Save"** (suggested, default).
  - Cancel: nothing closes.
  - Discard: each file goes back to its disk content (or, deleted, just loses its unsaved mark);
    then the tab or window closes.
  - Save: every file is saved; when all succeeded the tab or window closes. A file that fails shows
    "{name} was not saved" with the read-only reason or "It could not be written; the edits are
    still in the tab.", and the close does not happen.

## The Markdown preview (F46, K14)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
- A file is Markdown when its guessed language is Markdown (by name and content type: `.md`,
  `.markdown`…). Its editor tab has a small row above the text, right-aligned, with a flat button
  **"Preview"**, tooltip **"Show it rendered (Ctrl+Shift+V)"**. The button is there in read-only
  tabs too.
- **"Preview"**, or **`Ctrl+Shift+V`** in that editor tab, opens a tab **"Preview — {name}"**
  (`{name}` the file's name; never an unsaved mark) placed **right after the file's editor tab** in
  the strip and selected; if this project already has the preview, that tab is selected instead.
  `Ctrl+Shift+V` in a **preview** tab goes back to the same project's editor tab of that file, when
  there is one. In a file tab that is not Markdown it does nothing. In a terminal `Ctrl+Shift+V` is
  paste: the file keys act only while a file tab is selected.
- **What it renders**: the shared buffer's text — so it follows the editor's unsaved text, and the
  disk whenever the buffer reloads — rendered as **CommonMark plus tables and strikethrough**.
  Raw HTML in the Markdown is **shown as text** (escaped), never interpreted. No linkify, no
  typographic replacements.
- **When**: once on opening; then **300 ms after the last change** to the text (each change
  restarts the wait); on each load from disk; and when the app switches light / dark.
- **Scroll is kept** across refreshes: the vertical position before the refresh is restored once
  the new page has loaded.
- **Read only**; it has no editor and is never "unsaved".
- **Nothing leaves the machine and no page runs code**:
  - the page carries the Content-Security-Policy
    `default-src 'none'; img-src file: data:; style-src 'unsafe-inline'` — only local images and its
    own inline style;
  - JavaScript in page content is off and developer tools are off;
  - the page's base is the file's folder, so relative image paths resolve next to the file;
  - **links**: a link to the page itself or a `#fragment` of it stays on the page (headings get no
    ids, so a `#heading` link does not scroll); an `http://` or `https://` link
    opens in the user's default browser; a `file:` link (a relative link resolves against the
    file's folder) whose path ends in **`.md`** (ignoring any `#fragment`) opens that file in a
    file tab of the window's current project (through the file check); **every other link does
    nothing** (e.g. a link to a `.txt` or `.png` file, `mailto:`). The view never navigates away
    from its page, opens no window and downloads nothing.
  - agent-tablet's `docs/files.md` says "a relative link to a `.md` file opens it"; the code opens
    any `file:` link ending in `.md`, absolute ones included.
- A preview tab reopens with its project, like an editor tab, as a preview.

## `menkar open <file>…` (F45)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
- `menkar open <file> [<file>…]` hands the files to the running app. Each relative path is made
  absolute against the **caller's** working folder before it is handed over. With no file:
  prints "Usage: menkar open <file> [<file>…]" to stderr and exits with status 2.
- **The app is running**: the files go to it (the command returns; no second instance).
  - One window: they open there, in the project it shows; the window is raised.
  - Several windows: a dialog on the active window, heading **"Open in which window?"**, body the
    files' base names joined with `, `, responses **"Cancel"** and one per window labelled with
    the project that window shows — the active window first, suggested and default, then the
    others. Choosing one raises it and opens every file there. Cancel opens nothing.
- **The app is not running**: it starts, opens its windows as any start does (reopening tabs per
  the setting), then delivers the files the same way (one window → there; several → the question).
  If no window exists at that point, a new window on the current project opens them.
- Each file goes through the file check; a refused one shows "The file was not opened" with its
  reason in that window; the others still open.

## Open session file… (F48, M1)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
"Open session file…" is the first item of the main menu (⚙ in the sidebar header). What it really
does is **replay** a transcript chosen from disk — it does not resume, start, or add a session to
the project (the index's "opened as a session" is a replay):

1. A system file chooser titled **"Open session transcript"**, whose only filter is
   **"Session transcripts (*.jsonl)"** (`*.jsonl`), starting in `~/.claude` when that folder
   exists.
2. Cancelling does nothing. A chosen location with no local path → error dialog with heading
   **"Choose a local file"** and body
   "This location is not on this computer. Choose a folder or file on a local disk."
3. The file is read as a session, read only:
   - the session id is the file's name without its extension;
   - the agent: the first non-empty line that is a JSON object with a top-level `type` → Claude
     Code; with a top-level `role` → Cursor; otherwise (unreadable, not JSON) Cursor when the path
     contains `.cursor`, else Claude Code;
   - the working folder: the first `cwd` string among the first 50 lines / 256 KiB;
   - a preview text: the first `user` entry's text (in those lines) not starting with `<`,
     whitespace collapsed, 120 characters;
   - for Claude Code, the session's names from `custom-title` and `ai-title` (`sessions.md`).
   If the path cannot be stat'ed or is not a regular file → error dialog, heading
   **"Could not open transcript"**, body **"The file couldn't be read as a session transcript."**
   Any other file — even one that is not JSONL — opens.
4. A **Replay tab** opens in the current project, titled **"Replay — {name}"** (`{name}`: Claude's
   name, else the app's name for that session id, else the `ai-title`, else the preview text, else
   the first 8 characters of the id), tooltip `replay — {folder name} — {session id}` (the folder
   name is the last part of `cwd`, else the transcript's parent folder's name). It behaves as the
   replay of `sessions.md` (F9); with no turns it shows "Nothing to replay yet." with its controls
   disabled.
5. The replay tab is **not saved** with the layout: it does not reopen on the next start.
6. Choosing the same file again opens a second replay tab.

## The saved layout (in `$XDG_CONFIG_HOME/menkar/projects.json`, under each window's `tabs`)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
A file tab is one entry in its project's tab list (`projects.md` owns the rest of the shape):

| Field | Type | Meaning |
|---|---|---|
| `file` | string | the absolute, link-resolved path |
| `preview` | boolean | `true` = the Markdown preview tab, `false` = the editor |

- An entry whose `file` is not a string is not a file tab. `preview` is `true` only when the value
  is exactly `true`.
- On reopening: an entry whose file no longer exists as a regular file is dropped when the layout
  is read; one that exists but fails the file check is dropped with a log line; every remaining
  tab reopens in its saved place (files are checked off the UI thread first, so the order is kept).
- Reopening at all follows the "Reopen tabs on start" setting (`preferences.md`).

## Settings read

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
| Key (`state.json` `settings`) | Use |
|---|---|
| `font` | the editor's font (Pango-style description, e.g. `"JetBrains Mono 11"`); `""` = monospace default |

## Command line

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
| Command | Exit | Effect |
|---|---|---|
| `menkar open <file>…` | 0 once handed over | files opened in the window in use (above) |
| `menkar open` | 2 | "Usage: menkar open <file> [<file>…]" on stderr |

## Paths

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
- `~/.claude/` and `~/.claude.json`: opened read only, never written.
- Files opened anywhere else are read and, on the user's `Ctrl+S` or Save, written whole.

## Constants

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
| Name | Value |
|---|---|
| largest file | 10 MiB |
| binary probe | first 8 KiB |
| preview delay after the last change | 300 ms |
| transcript scan for "Open session file…" | 50 lines or 256 KiB |
| preview text | 120 characters |

## The preview's page

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
An HTML5 page, `charset` UTF-8, the CSP above, one inline `<style>`, the rendered body; the root
element carries `data-theme="light"` or `"dark"`. Styles (both themes; the color variables below):

| Element | Style |
|---|---|
| `body` | `15px/1.6 system-ui, sans-serif`; max width `52em`, centered; padding `1.5em 2em` |
| `h1`, `h2` | a `1px` bottom rule in the rule color, `.3em` padding below |
| `code`, `pre` | `ui-monospace, monospace` at 90 %, code background |
| inline `code` | padding `.1em .3em`, radius `4px` |
| `pre` | padding `.8em 1em`, radius `6px`, horizontal scroll; `pre code` has no padding or background |
| `table` | collapsed borders; `th`, `td` `1px` rule-colored border, padding `.3em .7em` |
| `blockquote` | no margin, `1em` left padding, `3px` left rule, muted text color |
| `img` | max width 100 % |
| `a` | link color |

| Variable | Light | Dark |
|---|---|---|
| page background | `#ffffff` | `#1e1e1e` |
| text | `#1e1e1e` | `#e8e8ea` |
| rule (borders) | `#d0d0d7` | `#45454d` |
| code background | `#f0f0f3` | `#2e2e35` |
| muted (quotes) | `#5e5c64` | `#b0afb8` |
| link | `#1c71d8` | `#78aeed` |

## Acceptance cases

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
The cases built and tested (FIL-1–6, 8, 10, 12, 13, 15, 20, 23–25, 31, 32) left for the history; the tests
carry their ids.

- **FIL-7** Browse… in a project whose two sessions both run in `/work/api` → the chooser starts
  there; with sessions in `/work/api` and `/work/web` → the chooser's default folder. Choosing
  `/work/api/README.md` puts that path in the entry and does not open it.
- **FIL-9** Opening the same file again in the same project → no new tab; the existing one is
  selected. Opening it in project B (same or other window) → a second tab; typing in either shows
  in both, both titles get ` •`, one `Ctrl+S` clears both.
- **FIL-11** Switching the window from project A to B hides A's file tabs; switching back shows
  them unchanged, unsaved edits included.
- **FIL-14** `Ctrl+S` in a terminal tab → the terminal receives `Ctrl+S`; `Ctrl+Shift+V` in a
  terminal tab → paste. In a file tab → save / preview, and the terminal receives nothing.
- **FIL-16** No unsaved edits; another program rewrites the file → the tab shows the new content
  with the cursor on the same line number (or the last line if shorter); no bar.
- **FIL-17** Unsaved edits; another program rewrites the file → the bar
  "The file changed on disk, and you have unsaved edits." with Reload and Keep mine. Reload → the
  disk content, ` •` gone, bar gone. Keep mine → bar gone, edits kept; `Ctrl+S` then overwrites the
  other program's content.
- **FIL-18** The file is deleted → the bar "The file was deleted on disk; saving writes it again."
  with no buttons; `Ctrl+S` → the file exists again with the tab's text, bar gone.
- **FIL-19** A save the system refuses (e.g. the disk is full) → "{name} was not saved" /
  "It could not be written; the edits are still in the tab."; the ` •` stays.
- **FIL-21** The same edited file has an editor tab in projects A and B; closing A's → closes with
  no question; closing B's afterwards → asks.
- **FIL-22** Closing a window holding the only editors of edited `a.md` and `b.txt` → one question
  "Save changes to a.md, b.txt?"; Save → both saved, then the running-sessions confirmation (if
  any), then the window closes. A file also edited in another window → not in the question.
- **FIL-26** Typing in the editor → the preview updates 300 ms after the last keystroke, not
  before; typing continuously for 2 s → one update ~300 ms after it stops. The preview's scroll
  position is the same after the update.
- **FIL-27** `![](img/a.png)` with `img/a.png` next to the file → the image shows; `![](https://
  example.com/a.png)` → nothing is fetched (no network request).
- **FIL-28** Clicking `[x](https://example.com)` → the default browser opens it; the preview still
  shows the page. `[d](docs/guide.md)` with that file present → a file tab opens for it in the
  current project. `[t](notes.txt)` → nothing happens. `[s](#setup)` → the preview stays on its page.
- **FIL-29** Switching the app to dark → the preview re-renders with background `#1e1e1e` and text
  `#e8e8ea`, and the editor switches to the "Adwaita-dark" scheme.
- **FIL-30** Closing the app with a project holding `notes.md` and its preview, then starting it →
  both tabs reopen in the same order and project; if `notes.md` was deleted meanwhile, neither
  reopens and no error is shown.
- **FIL-33** App running with windows on A (active) and B; `menkar open a.md b.md` → dialog "Open
  in which window?", body "a.md, b.md", buttons Cancel, A (suggested), B; choosing B → both open in
  B's project; Cancel → none opens.
- **FIL-34** App not running, its saved layout has two windows; `menkar open x.md` → both windows
  reopen, then "Open in which window?" is asked.
- **FIL-35** `menkar open big.bin` (binary) to a running app → error dialog "The file was not
  opened" / "The file looks binary, not text."; with `ok.md` in the same command, `ok.md` still
  opens.
- **FIL-36** "Open session file…" → a chooser titled "Open session transcript" showing only
  `*.jsonl` files, in `~/.claude` when it exists. Choosing a Claude Code transcript named
  `3f2a….jsonl` whose `custom-title` is "Login flow" → a tab "Replay — Login flow" in the current
  project; the session is not started and not added to the project; after a restart the tab is
  gone.
- **FIL-37** Choosing an empty `.jsonl` file → a replay tab showing "Nothing to replay yet." with
  disabled controls (no error dialog).
- **FIL-38** Choosing a transcript whose first line has a top-level `role` → replayed as a Cursor
  transcript.
- **FIL-39** The chosen file is removed between choosing and reading → "Could not open transcript"
  / "The file couldn't be read as a session transcript.".

## Look

> Left on 2026-11-08: built and tested by plan 15, described in `docs/files.md`.
- `img/file-tab-dark.png` (`img/file-tab-light.png`): a Markdown file tab `notes.md •` with unsaved
  edits, selected (selected-tab style of `look.md`: accent fill, bold), its `×`; under the strip the
  right-aligned flat "Preview" button; the editor with a line-number gutter (current line's number
  bold and its line highlighted across the full width), Markdown colors (list markers in an accent
  orange).
- `img/file-read-only-dark.png` (`img/file-read-only-light.png`): two file tabs, `settings.json`
  selected; the read-only bar under the strip, full width, a tinted band with the sentence
  left-aligned; a one-line JSON file with key and string colors.
- `img/file-preview-dark.png` (`img/file-preview-light.png`): **does not show a preview** — the
  capture shows the empty "No session open" state, because WebKit's own sandbox cannot start inside
  the sandboxed screenshot walk (agent-tablet's `docs/ui-verification.md`). It needs retaking where
  WebKit can run; the page's look is specified by the CSS above.

Measurable details:

- **Bars** (read-only, and on-disk): a band across the tab's top, sliding down when shown; inside,
  a row with spacing 8 px and margins top 6, bottom 6, start 12, end 8 px; the label left-aligned,
  wrapping, filling the width; the on-disk bar's buttons after it (regular buttons).
  - read-only bar background: the accent background color at 15 % opacity;
  - on-disk bar background: the warning background color at 30 % opacity.
- **Preview button row** (Markdown editors only): right-aligned, spacing 6 px, margins top 4,
  bottom 4, end 8 px; a flat button labelled "Preview".
- **Editor**: GtkSourceView look — line-number gutter, current-line highlight, monospace at the
  terminal font's family and size, schemes "Adwaita" / "Adwaita-dark".
- **Tab strip entry** of a file or preview tab: no group swatch, no state dot, no context ring; the
  title (≤ 28 characters, ellipsized at the end) and the close icon (`window-close-symbolic`, an ×).
- **"Open file" dialog**: width 560 px; a header bar; body margins 18 px on all sides, vertical
  spacing 12 px; first row: the entry (expanding) and "Browse…", spacing 6 px; then the error line
  (error color, wrapping, left-aligned, hidden until needed); then "Open", right-aligned,
  suggested-action, pill-shaped.
- **"Open in which window?"**: a standard alert dialog; the first window's button in the suggested
  (accent) appearance.
- **Unsaved-edits question**: a standard alert dialog; "Discard" in the destructive (red)
  appearance, "Save" suggested.
- **Preview page**: the CSS and color table under Data contracts, in both themes.
