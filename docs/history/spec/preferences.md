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
