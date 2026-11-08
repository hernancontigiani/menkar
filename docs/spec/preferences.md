# Preferences, themes, languages, About

Every setting the app keeps, its default, where it is changed and what it does; the Preferences
dialog row by row; the color themes and interface styles by name and how one is chosen (their color
values are in `look.md`); the languages; the About dialog. Index rows: F54, F55 (with `look.md`),
F56, F57, K9, K37, M5, M6. The Integrations page's two groups are listed here as rows; their
behaviour is specified in `context.md` (status line, F37) and `classifier.md` (classify turns,
F42–F43).

## Behaviour

### Opening Preferences

- Built: `docs/preferences.md` describes how; plan 12 built it.

### General page

- Built: `docs/preferences.md` describes how; plan 12 built it.

### Integrations page

- Built: `docs/preferences.md` describes how; plan 12 built it.

### Themes (F55)

Twelve choices, in this order, each a radio row named exactly so (names are not translated):

1. Default
2. Tango Dark
3. Solarized Dark
4. Solarized Light
5. Dracula
6. Gruvbox Dark
7. Nord
8. Catppuccin Mocha
9. Tokyo Night
10. Monokai
11. One Dark
12. Catppuccin Latte

Each theme other than Default is a foreground, a background and the 16 ANSI colors (values in
`look.md`).

**Which palette is in use** — from the interface style, the theme and the light / dark scheme:

| Interface style | Theme | Terminals | The rest of the window |
|---|---|---|---|
| Terminal workspace | Default | Catppuccin Mocha when dark, Catppuccin Latte when light | Recolored from the same palette |
| Terminal workspace | any other | That theme, whatever the scheme | Recolored from that theme |
| Classic (Adwaita) | Default | The terminal's own default colors, following light / dark | The plain system style |
| Classic (Adwaita) | any other | That theme | The plain system style (the theme colors only the terminals) |

So the out-of-the-box look (Terminal workspace, Default) is Catppuccin, Mocha or Latte by the
system's scheme. A fixed theme (e.g. Nord) does not change with the scheme; only Default does.

- **Choosing**: selecting a theme's radio saves `terminal_theme`, updates the expander's subtitle
  and recolors at once (see "Opening Preferences" for which windows).
- **Swatch** next to each theme's name: a strip showing its background, a bar of its foreground,
  and its six accent colors (ANSI 1–6: red, green, yellow, blue, magenta, cyan). Default shows a
  plain neutral gray strip.
- **An unknown saved theme name** (e.g. a theme a later version removed) is treated as Default:
  the dialog selects Default and the app colors as Default.
- **Accent**: in Terminal workspace the accent color (active tab, focused pane frame) is the theme's
  magenta (ANSI 5), except Catppuccin Mocha, Catppuccin Latte and Dracula, which have their own
  (values in `look.md`).

**Interface styles**: "Terminal workspace" (`tui`, the default) recolors the whole window from
the theme and flattens it into a terminal-workspace look (herdr's layout and color roles);
"Classic (Adwaita)" (`classic`) is the plain system look. Their details are in `look.md`.

### Languages (F56)

- Built: `docs/preferences.md` describes how; plan 12 built it.

### About (F57, M6)

- Built: `docs/preferences.md` describes how; plan 12 built it.

## Data contracts

### `state.json`

`$XDG_CONFIG_HOME/menkar/state.json` (agent-tablet: `$XDG_CONFIG_HOME/agent-tablet/state.json`,
which Menkar imports once, read only, by decision 1.8). Written whole through a temporary file and
a rename, pretty-printed, after every change.

```json
{
  "names": {"<session id>": "<name set in the app>"},
  "hidden": ["<session id>"],
  "remote_control": ["<session id>"],
  "settings": {"font": "", "scrollback": 10000, "color_scheme": "system", "...": "..."}
}
```

`names`, `hidden`, `remote_control` are specified in `sessions.md` and `remote-control.md`.

**`settings`** — stored values are merged over the defaults, so a missing key reads as its default
and an unknown key is kept:

| Key | Type | Default | Set by | Read by |
|---|---|---|---|---|
| `font` | string, a font description; `""` = default | `""` | Font row | terminals, new file tabs |
| `scrollback` | integer, lines | `10000` | Scrollback lines row | terminals |
| `color_scheme` | `"system"` \| `"light"` \| `"dark"` | `"system"` | Color scheme row | the whole app |
| `terminal_theme` | string, a theme name of the list above | `"Default"` | Color theme row | terminals, the window in Terminal workspace |
| `ui_style` | `"tui"` \| `"classic"` | `"tui"` | Interface style row | the whole app |
| `language` | string, a language code; `""` = system | `""` | Language row | start |
| `notify_idle` | boolean | `true` | Notify about background agents | `agent-state.md` |
| `notify_sound` | boolean | `true` | Play a sound | `agent-state.md` |
| `new_session_dir` | string, a folder; `""` = none | `""` | every folder chosen for a new session or chat | the folder pickers (`sessions.md`, `chat.md`) |
| `sidebar_width` | integer, px | `300` | dragging the sidebar's edge, saved 600 ms after the drag stops | each window on open (`look.md`) |
| `reopen_tabs` | boolean | `true` | Reopen tabs on start | start (`projects.md`) |
| `show_folder_path` | boolean | absent = `false` | Show folder path | Add session (`sessions.md`) |
| `classify_since` | number (epoch seconds) or `null` | absent = off | Classify each new turn | `classifier.md` |
| `classify_last` | object | absent | the classifier | `classifier.md` |

`sidebar_width` and `new_session_dir` have no row in Preferences: they are remembered from what
the user does.

### Restart

- Built: `docs/preferences.md` describes how; plan 12 built it.

## Acceptance cases

- PRF cases not listed below: built; the tests in `e2e/preferences.spec.ts`, `e2e/integrations.spec.ts` and `tests/core/settings.test.ts` carry their ids.

**General page rows**

- PRF-5. Choose font "DejaVu Sans Mono 14" → `settings.font` = "DejaVu Sans Mono 14"; every terminal
  pane of the window redraws in it; a file tab opened next uses it.
- PRF-6. With a font saved, click the reset button → `settings.font` = `""`; the button shows the
  default font; the terminals use the default font.
- PRF-7. Open the dialog with `font` = `""` and close it without touching anything → `state.json`
  is not rewritten with a font.
- PRF-9. Color scheme "Dark" on a light desktop → the app turns dark at once; `color_scheme` =
  `"dark"`; with theme Default and Terminal workspace, the terminals turn Catppuccin Mocha.
- PRF-10. Color scheme "Follow system", desktop switches from dark to light → with theme Default and
  Terminal workspace, every window's terminals and chrome switch from Catppuccin Mocha to Catppuccin
  Latte.
- PRF-11. Theme "Nord", desktop switches dark → light → the terminals stay Nord.
- PRF-12. Interface style "Classic (Adwaita)" → `ui_style` = `"classic"`; the window takes the plain
  system look; terminals' frame labels hide; with theme Default the terminals use their default
  colors; with theme "Dracula" the terminals stay Dracula while the window is plain.
- PRF-13. Interface style back to "Terminal workspace" → the window is recolored from the theme;
  frame labels show.
- PRF-18. Show folder path on → `show_folder_path` = `true`; the next Add session dialog shows a
  folder path under each history row that has a folder.
- PRF-19. Notify about background agents off → `notify_idle` = `false`; an agent in an unwatched
  tab finishing raises no desktop notification. Play a sound off → `notify_sound` = `false`; no
  sound.
- PRF-20. Reopen tabs on start off, quit with three tabs open → the next start opens one window with
  no tabs; `reopen_tabs` = `false` in `state.json`.

**Languages**

- PRF-21. The Language expander lists "System default" first, then each language the app ships, in
  its own name (agent-tablet: English, Magyar, Deutsch, Español, Français).
- PRF-25. "Español" chosen, dialog closed, no restart → nothing changes now; the next start is in
  Spanish.
- PRF-26. `language` = `"es"` and a string missing from the Spanish catalog → that string shows in
  English.
- PRF-27. `language` = `""` on a system whose language the app has no catalog for (e.g. `ja_JP`) →
  English.

**State file**

- PRF-28. Any row changed → `state.json` is rewritten whole through a temporary file in the same
  directory and renamed over it; a concurrent reader never sees half a file.
- PRF-29. Drag the sidebar to 420 px and stop → after 600 ms `sidebar_width` = 420; a new window
  opens with a 420 px sidebar.
- PRF-30. Choose a folder for a new session → `new_session_dir` is that folder; the next folder
  picker (session or chat) starts there; when that folder has since been deleted, the picker starts
  at its own default.


## Look

Reference screenshots (dark theme, demo data, Terminal workspace with Default theme). The capture
tool draws the Preferences dialog's rows too narrow, so long titles wrap letter by letter ("F-o-nt");
the real dialog lays each row out on one line. Read them for the content and order, not the wrapping:

- `img/preferences-dark.png` — the General page: the header's page switcher ("General" with a
  tools icon, "Integrations" with a puzzle-piece icon), the Terminal group (Font with the font
  button "Monospace Regular 13.33px" and the reset button with its tooltip "Reset to default font";
  Scrollback lines 10000 with − and + buttons) and the start of Appearance (Color scheme "Dark",
  Interface style collapsed with its subtitle "Terminal workspace", Color theme). Light:
  `img/preferences-light.png`.
- `img/integrations-dark.png` — the Integrations page: the group "Claude Code settings" with its
  description and the status line switch row. Light: `img/integrations-light.png`.
- `img/about-dark.png` — the About dialog: icon, name, developer, version badge "1.1.1", rows
  "Details", "Report an Issue" (with an external-link icon), "Credits", "Legal". Light:
  `img/about-light.png`.

The two Preferences screenshots were taken with the dialog narrower than its content, so the row
titles wrap one character per line ("F-o-nt", "S-t-a-t-us l-i-ne…"); that is a defect of the
capture, not the look to copy — rows keep their titles on one line, wrapping by word.

**Measurable details** (from the code):

| Element | Detail |
|---|---|
| Dialog | a preferences dialog: header bar with the page switcher and a close button; each page a centered column of titled groups (bold group titles, rows in a rounded card, separators between rows) |
| General page icon | "preferences-system-symbolic" (rendered as crossed tools) |
| Integrations page icon | "application-x-addon-symbolic" (a puzzle piece) |
| Font reset button | flat, icon "edit-clear-symbolic" (a backspace-shaped clear mark), vertically centered after the font button |
| Theme swatch | 130 × 22 px, vertically centered at the row's end: the background fills it; a foreground bar 10 px wide at x 6, from y 4 to 4 px above the bottom; six accent bars (ANSI 1–6, in that order) 13 px wide with 3 px gaps, ending at the right edge, same height; Default: the whole strip gray (55 % of white on each channel) |
| Expander rows | radio button at each choice row's start; the collapsed row's subtitle is the current choice |
| "Restart now" | accented (suggested-action) button in the Language group's header, vertically centered, hidden until needed |
| Language group | description "Restart to apply" under its title |
| About | a standard About dialog: app icon (a tablet with a sidebar and a terminal prompt, in the accent colors), name in large bold type, developer under it, the version in an accent-tinted pill, then grouped navigation rows |

Colors, fonts and the Terminal workspace / Classic styles of these dialogs come from the theme
tokens in `look.md`; nothing here is colored outside them.
