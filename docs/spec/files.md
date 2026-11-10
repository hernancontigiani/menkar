# Files — file tabs, the editor, the Markdown preview, `open`

Any text file opened in a tab of the window, read and edited with syntax colors, saved; a Markdown
file also shown rendered in a second, read-only tab; files handed to the running app from a
terminal with `menkar open`. It specifies **F45**, **F46**, **F47**, the keys **K3**
(`Ctrl+Shift+O`), **K13** (`Ctrl+S`), **K14** (`Ctrl+Shift+V`), the menu item **M10** ("Open
file…"), the command `menkar open <file>…`, and the file tab's buttons "Reload",
"Keep mine" and "Preview". Source decision: agent-tablet's `plans/00-STATUS.md` 1.24. How a file tab
is saved with its project's layout and reopened is shared with `projects.md`.

## Behaviour

### Opening a file from the window (F45, K3, M10)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### The file check (every way of opening)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### The tab (F45)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### Read only (F47)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### Saving (K13)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### Changes on disk (F47)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### Closing with unsaved edits (F47)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### The Markdown preview (F46, K14)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### `menkar open <file>…` (F45)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

## Data contracts

### The saved layout (in `$XDG_CONFIG_HOME/menkar/projects.json`, under each window's `tabs`)

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### Settings read

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### Command line

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### Paths

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### Constants

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

### The preview's page

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.

## Acceptance cases

Every case is built and tested; `e2e/files.spec.ts`, `e2e/files-cases.spec.ts`,
`e2e/open.spec.ts` and `tests/core/files/` carry the ids.

Checked by hand (`plans/00-STATUS.md` §2): FIL-34 (`menkar open` starting the app: Playwright's
launcher hides the command line).

## Look

- Built and tested: `docs/files.md` describes how; `src/core/files/`, `src/main/files.ts` and `src/renderer/editor.ts`, `preview.ts`, `fileopen.ts` hold it.
