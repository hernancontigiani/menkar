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

- Built: `docs/preferences.md` describes how; `src/core/theme.ts` holds it.

### Languages (F56)

- Built: `docs/preferences.md` describes how; plan 12 built it.

### About (F57, M6)

- Built: `docs/preferences.md` describes how; plan 12 built it.

## Data contracts

### `state.json`

- Built: `src/core/settings.ts` holds every key and its default; `docs/foundations.md` describes how the file is written.

### Restart

- Built: `docs/preferences.md` describes how; plan 12 built it.

## Acceptance cases

- Built and tested: `e2e/preferences.spec.ts`, `e2e/preferences-rows.spec.ts`, `e2e/integrations.spec.ts`, `e2e/chat.spec.ts` (PRF-30) and `tests/core/` (settings, i18n, jsonstate, agentstate) carry the PRF ids.
- PRF-5's terminal half is tested; its file-tab half (a file tab opened after a font change uses it) belongs to the file tabs.
- Checked by hand: PRF-19's desktop notification and its sound (`plans/00-STATUS.md` §2).

## Look

- Built: `src/renderer/preferences.ts`, `about.ts`, `windows.css`. Reference screenshots: `img/preferences-*.png`, `img/integrations-*.png`, `img/about-*.png`.
