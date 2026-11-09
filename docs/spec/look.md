# Look — the whole window, both styles, every theme

The window's look, which the human likes and Menkar reproduces as closely as HTML and CSS allow:
the window and its header, the sidebar (project dropdown, session rows, group headings), the tab
strip, panes and terminals, the dialogs, the Usage window, the two interface styles
(**Terminal workspace**, the default, and **Classic (Adwaita)**) and every color theme in its light
and dark variants, fonts and icons. Index rows specified here: **F29** (the sidebar toggle and its
remembered width, shared with `projects.md`), **F55** (themes coloring the whole window and the
Classic style, shared with `preferences.md`, which owns the settings' rows), **F58** (empty states),
**K11** (`F9`) and **K36** (`Ctrl+B b`). Every other area file names its widgets' behaviour; this
file is where their measurements and colors live.

Where a number comes from agent-tablet's own stylesheet or code it is stated as such. Where a widget
takes its look from libadwaita 1.5 (the toolkit agent-tablet uses; GTK 4.14) the libadwaita value is
given, since Menkar has no libadwaita and must write it itself. Colors read from the reference
screenshots (pixel samples at 1× scale) are marked "measured".

## Behaviour

### Interface style and theme, applied live (F55)

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### The sidebar: shown, hidden, resized (F29, K11, K36)

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Empty states (F58)

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Small visible behaviours of the chrome

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

## Data contracts

### Theme palettes

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Chrome roles in Terminal workspace

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Classic palette (libadwaita 1.5 stock)

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

## Acceptance cases

Every case is built and tested; `e2e/look.spec.ts`, `tests/core/ring.test.ts` and, for LOOK-50 and
LOOK-51 (the Usage window), `e2e/usage-window.spec.ts` carry the ids.

Checked by hand (`plans/00-STATUS.md` §2): LOOK-5 (an unfocused window keeps its bars: needs a real
window manager), LOOK-22 and LOOK-29 (need real blocked or working agents).

## Look

### Fonts

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Window and header

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Sidebar

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Rows

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Tab strip

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Panes and terminal

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Dialogs

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Usage window

- Built: `docs/preferences.md` describes how; plan 12 built it.

### Other surfaces' fixed colors

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Icons

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.

### Not determined from the code

- Built and tested: `docs/window.md` describes how; `src/core/theme.ts` and `src/renderer/` (`look.ts`, `style.css`) hold it.
