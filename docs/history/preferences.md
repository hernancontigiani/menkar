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

