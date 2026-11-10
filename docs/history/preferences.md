# History of `docs/preferences.md`

## The shape

> Replaced 2026-11-09 by decision 1.24: Usage has no parent window.
- **Each is a child window of the main window that asked** (`src/main/windows.ts`):
  `openPreferences(parent, page?)` and `openAbout(parent)` are modal over it, as the spec's dialogs
  are; `openUsage(parent)` is not, and there is one per main window. b1's ⚙ menu, `Ctrl+,` and
  `Ctrl+B s` call them through the workspace's `openPreferences`, `openUsage` and `openAbout`
  actions.

> Replaced 2026-11-09 by decision 1.24 (Usage has no parent):
- **Child windows, not dialogs inside the main window**: a page of their own keeps Preferences,


> Replaced 2026-11-10: Preferences, About and MCP became one Settings window of its own, with sections; transcript retention joined the integrations. It was:
# Preferences, About and the Usage window — how they are built
- **Preferences and About are child windows of the main window that asked**
  (`src/main/windows.ts`): `openPreferences(parent, page?)` and `openAbout(parent)` are modal over
  it, as the spec's dialogs are. **Usage is a window of its own** (decision 1.24, 2026-11-09):
  `openUsage(opener)` gives it no parent, since GNOME's mutter keeps a child window attached to its
  parent and the parent then takes no clicks while it is open. There is still one per main window,
  scoped to that window's project (decision 1.15); closing the opener leaves Usage open and reloads
  it, now showing every project. b1's ⚙ menu, `Ctrl+,` and `Ctrl+B s` call them through the
  workspace's `openPreferences`, `openUsage` and `openAbout` actions.
- **Each has its own page** (`src/renderer/{preferences,about,usage}.html`, their own entries in
  `electron.vite.config.ts`) and imports the main window's `look.ts`, `dom.ts` and `i18n.ts`
  every window at once (agent-tablet reached only the window that opened Preferences).
- **Integrations**: the status line switch calls `installStatusline` / `removeStatusline`
  (`docs/context.md`). A refused change comes back with our sentence, shown for 8 s, and the switch
- **Windows of their own, not dialogs inside the main window**: a page of their own keeps Preferences,
  About and Usage out of the main window's renderer, which another session builds, and gives the
- e2e under `npm run ui-check`: `e2e/preferences.spec.ts` (the General page, themes reaching every
  window, languages, Restart now with nothing running and with a session running),

> Replaced 2026-11-10: a size with the default family is now stored. It was:
  already read.

## The shape

> Left on 2026-11-10: Appearance gained Terminal colors (decision 1.42).
  - Appearance holds everything visual: the scheme, the style, the theme, Interface size, and the
    font of the terminals and the file editor. Terminal keeps only behaviour, the scrollback
    (decision 1.36).
