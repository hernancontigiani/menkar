# History of `docs/spec/preferences.md`

## Opening Preferences

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
- Main menu (⚙) → "Preferences" (M5), `Ctrl+,` (K9) or `Ctrl+B s` (K37) opens the Preferences
  dialog over the window that asked, titled "Preferences", with two pages switched by a header
  toggle: "General" and "Integrations".
- Every change is saved to `state.json` at once (no Apply or Cancel button) and takes effect as
  each row below says.
- A change that recolors or refonts terminals is pushed to the terminal panes of **the window that
  opened the dialog**; other windows' open terminals take it only when the light / dark scheme next
  flips (which re-applies every window), and new terminals anywhere read the current settings when
  they start. Found in the code; Menkar should apply each change to every window at once.

## General page

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
Groups and rows in order. "Saved as" is the key under `settings` in `state.json`.

| Group | Row (title / subtitle) | Control | Saved as | Default | Effect | Restart |
|---|---|---|---|---|---|---|
| "Terminal" | "Font" / "Applies to all terminal tabs" | a font button showing the current font, and a reset button (tooltip "Reset to default font") | `font` (a font description string, e.g. "JetBrains Mono 12") | `""` = the terminal's own default monospace font | Terminal panes refont at once (see above); file tabs opened afterwards use it as their editor font (`files.md`) | no |
| "Terminal" | "Scrollback lines" | a number spinner, 1 000 to 1 000 000 in steps of 1 000 | `scrollback` (integer) | `10000` | Terminal panes keep that many lines of scrollback (applied as the font) | no |
| "Appearance" | "Color scheme" | a drop-down: "Follow system", "Light", "Dark" | `color_scheme`: `system` \| `light` \| `dark` | `system` | The whole app switches light / dark at once; in every window, the interface theme and the terminals' colors follow (a scheme flip re-applies every window) | no |
| "Appearance" | "Interface style" / the current style's name | an expander with two radio rows: "Terminal workspace", "Classic (Adwaita)" | `ui_style`: `tui` \| `classic` | `tui` | The whole app's stylesheet changes at once; each terminal's frame label (the agent's name on the frame line) shows only in "Terminal workspace" | no |
| "Appearance" | "Color theme" / the current theme's name | an expander with one radio row per theme, each with a color swatch | `terminal_theme` (a theme name) | `Default` | See "Themes" below; at once | no |
| "Add session" | "Show folder path" / "Show each session's folder path in the session browser" | a switch | `show_folder_path` (boolean) | `false` (absent from the defaults, read as false) | The Add session dialog's history rows show each session's folder path under the name; takes effect the next time Add session opens | no |
| "Language" (description "Restart to apply"; header button "Restart now") | "Language" / the current language's name | an expander with one radio row per language | `language` (a code; `""` = the system's) | `""` | See "Languages" below | **yes** |
| "Notifications" | "Notify about background agents" / "A notice when an agent you are not watching finishes or needs your input" | a switch | `notify_idle` (boolean) | `true` | Desktop notifications for agents not being watched (`agent-state.md`) | no |
| "Notifications" | "Play a sound" / "When an agent you are not watching finishes or needs your input" | a switch | `notify_sound` (boolean) | `true` | The sound for the same events (`agent-state.md`) | no |
| "Start" | "Reopen tabs on start" / "Resume the sessions that were in tabs, in their windows, with their splits" | a switch | `reopen_tabs` (boolean) | `true` | Read at the next start (`projects.md`) | next start |

**Scrollback lines** — found in the code, not in the index (F54 does not name it).

**Font row**: the font button opens the system font chooser. When no font is saved it shows the
terminal's default font (on Ubuntu "Monospace Regular" at the default size), without saving it.
The reset button sets `font` back to `""` and shows the default again, without saving the default
as a choice.

**Expander rows** (Interface style, Color theme, Language): collapsed, each shows its title and,
as its subtitle, the name of the current choice; expanded, one row per choice with a radio button
at its start; activating a row selects its radio. The subtitle follows the selection at once.

## Integrations page

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
Shown as the dialog's second page. Its rows (behaviour in the files named):

| Group | Row | Saved | Default | Spec |
|---|---|---|---|---|
| "Claude Code settings" (description "Each piece is added to ~/.claude/settings.json only when you turn it on, and taken out when you turn it off. A copy of the file is kept before every change.") | "Status line in every Claude session" / "Context and usage for sessions started outside Menkar too. Your own status line, if you have one, keeps showing." — a switch | In `~/.claude/settings.json` itself, not in `state.json` | off | `context.md` |
| "Classify turns" | "Classify each new turn by development stage" — a switch with an explanatory subtitle | `classify_since` (epoch seconds, or `null`) | `null` (off) | `classifier.md` |
| "Classify turns" | "Classify earlier turns" — buttons "Classify earlier turns…" / "Stop"; shown only while classifying is on | `classify_last` (the last run's result) | absent | `classifier.md` |

## Languages (F56)

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
- agent-tablet offers, in this order (each name in its own language, not translated): "System
  default" (`""`), "English" (`en`), "Magyar" (`hu`), "Deutsch" (`de`), "Español" (`es`), "Français"
  (`fr`). Its catalogs (`po/de.po`, `es.po`, `fr.po`, `hu.po`) each translate 230 strings, fewer than
  the code has (about 370 distinct): a string without a translation shows in English.
- Menkar lists "System default" plus the languages it ships a catalog for. Its catalogs and the rule
  that picks the language from the setting and the system are in `docs/foundations.md` (today `en`
  and `es`). "System default" goes through t() in Menkar.
- **Choosing** a language saves `language` and updates the expander's subtitle; the UI does not
  change yet. The "Restart now" button (accented, in the group's header) shows while the selection
  differs from the language the dialog opened with, and hides again if the user goes back to it.
- **Restart now**: the app quits and starts again about 1.5 s later in the new language. agent-tablet
  quits directly, without the quit confirmation of F27 (running sessions are not asked about);
  reopened tabs come back if "Reopen tabs on start" is on. Found in the code; for Menkar, whether
  Restart now goes through the normal quit confirmation is the human's call.
- Without restarting, the new language applies at the next start.
- The language is read once, at start, before any window opens.

## About (F57, M6)

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
Main menu → "About Menkar" (agent-tablet: "About Agent Tablet") opens the About dialog:

- the app's icon, its name, the developer's name ("Hernan Contigiani") and the version as a badge
  (agent-tablet: "1.1.1", from its package; Menkar: the version in `package.json`);
- "Details": the comments "Manage and resume your AI coding agent sessions.", a blank line, then
  "Unofficial community tool — not affiliated with or endorsed by Anthropic.", and the website link;
- "Report an Issue": opens the issue tracker's URL in the browser (only when the user clicks it;
  the app makes no connection of its own);
- "Credits": the developer, and a section "Based on";
- "Legal": the copyright lines and the license, GPL-3.0 (Menkar: GPL-3.0-or-later).

agent-tablet's values, for contrast: copyright "© 2026 Máté Molnár (Agent Session Manager)" and
"© 2026 Hernan Contigiani (Agent Tablet)"; "Based on": "Agent Session Manager by Máté Molnár
https://github.com/r4nd3l/agent-session-manager"; website and issues at agent-tablet's GitHub.

Menkar's: name "Menkar"; "Based on" holds the credit line of Menkar's `CLAUDE.md` and `README.md` —
Menkar is the successor of agent-tablet, itself started from Agent Session Manager by Máté Molnár
(`https://github.com/r4nd3l/agent-session-manager`), and no code is carried over from either. Not
determined from agent-tablet: Menkar's website and issue URLs, and whether Menkar's copyright lines
keep Máté Molnár's (no code of his is carried over) — for `set`.

## Restart

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
The relaunch runs the same app binary with no arguments, after the current instance has exited, so
the single-instance lock is free when the new one starts (agent-tablet waits 1.5 s).

## Acceptance cases

> Left on 2026-11-08: built by plan 12; the tests in `e2e/preferences.spec.ts`, `e2e/integrations.spec.ts` and `tests/core/settings.test.ts` carry these ids.
- PRF-1. `Ctrl+,` in a window → the Preferences dialog opens over that window on the "General" page.
- PRF-2. `Ctrl+B` then `s` → the same dialog opens; main menu → "Preferences" → the same.
- PRF-3. No `state.json` → the dialog shows: Font = the terminal's default font, Scrollback lines
  10000, Color scheme "Follow system", Interface style subtitle "Terminal workspace", Color theme
  subtitle "Default", Show folder path off, Language subtitle "System default", Notify on, Play a
  sound on, Reopen tabs on.
- PRF-4. `state.json` has `"settings": {"scrollback": 5000, "zoom": 2}` → Scrollback shows 5000;
  every other row its default; after any change the file still has `"zoom": 2`.
- PRF-8. Scrollback: type 999 → the spinner holds 1000; 2 000 000 → 1000000; set 20000 →
  `settings.scrollback` = 20000 and the terminals keep 20 000 lines.
- PRF-14. Select "Tokyo Night" → `terminal_theme` = `"Tokyo Night"`; the expander's subtitle reads
  "Tokyo Night"; the window's terminals and chrome recolor at once.
- PRF-15. `terminal_theme` = `"Solarized Pink"` (unknown) in `state.json` → the dialog's subtitle
  reads "Default", its radio is selected, and the app colors as Default.
- PRF-16. The theme list shows exactly the twelve names of "Themes", in that order, each with a
  swatch; Default's swatch is plain gray.
- PRF-17. Two windows open, Preferences opened from window A, theme set to "Monokai" → A's
  terminals turn Monokai at once (agent-tablet: B's existing terminals change only on the next
  scheme flip; Menkar: B's too, at once).
- PRF-22. Language "System default", choose "Español" → `language` = `"es"`; subtitle "Español";
  "Restart now" appears; the dialog's own texts are still in the old language.
- PRF-23. Then choose "System default" again → "Restart now" hides; `language` = `""`.
- PRF-24. "Español" chosen, "Restart now" clicked → the app quits and starts again; the new window's
  menus read in Spanish.
- PRF-31. The Integrations page shows, in order, the group "Claude Code settings" with the switch
  "Status line in every Claude session" (its subtitle naming Menkar, not Agent Tablet), and the
  group "Classify turns" with "Classify each new turn by development stage"; "Classify earlier
  turns" is hidden while that switch is off.
- PRF-32. Main menu → "About Menkar" → the dialog shows the Menkar icon, "Menkar", "Hernan
  Contigiani" and the version from `package.json` as a badge.
- PRF-33. About → "Details" → "Manage and resume your AI coding agent sessions." and
  "Unofficial community tool — not affiliated with or endorsed by Anthropic."
- PRF-34. About → "Credits" → a "Based on" section crediting agent-tablet and Agent Session Manager
  by Máté Molnár with its URL.
- PRF-35. About → "Legal" → the GPL-3.0-or-later license.
- PRF-36. Opening About makes no network connection; "Report an Issue" opens the system browser
  only when clicked.

## Acceptance cases

> Left on 2026-11-08: group headers whose cases plan 12 built.
**Dialog and keys**
**Integrations rows**
**About**

## Themes (F55)

> Left on 2026-11-08: built; `src/core/theme.ts` holds the themes and which palette is in use; PRF-9 to PRF-17 test it.
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

## `state.json`

> Left on 2026-11-08: built; `src/core/settings.ts` parses every key with its default.
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

## Acceptance cases

> Left on 2026-11-08: every case built and tested, checked by hand, or split; see the pointer left in place.
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

> Left on 2026-11-08: built in `src/renderer/preferences.ts`, `about.ts` and `windows.css`; cards are 12 px in both styles (LOOK-51 caught them square).
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
