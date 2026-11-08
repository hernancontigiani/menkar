# Foundations — logging, JSON state, i18n, SQLite

The four modules every feature builds on. The code says what they do; this keeps why they are
shaped so and what was rejected.

## Logging — `src/core/log.ts`

- `log.debug/info/warn/error(message, fields)`. The message is a fixed sentence; identifiers (a
  path, a session id, the error) go in `fields`, so records can be grepped by message and read by
  field. One line per record: local time with its offset, level, message, `key=value` pairs.
- Level from `MENKAR_LOG` (`debug`, `info`, `warning`, `error`), read on each record; `warning` by
  default.
- Records go to stderr, and main adds a file sink at `<cache>/menkar.log` that rotates to
  `menkar.log.1` past a size. The sink appends through a stream, so a record never waits on the
  disk; a failure of the file sink is reported on stderr, never thrown into the caller.
- A code rule fails on `console.*` anywhere in `src/`, `tests/` or `e2e/` outside this module.
- **Rejected:** a logging library — one sink, a level and structured fields are a page of code.

## JSON state — `src/core/jsonstate.ts`

- `writeJson` writes a temporary file in the same directory, `fsync`s it and renames it over the
  old one, so a crash leaves the old file or the new one, never half of either. Writes to the same
  path are queued in call order, so the last call wins.
- `readJson(path, parse, fallback)`: a missing file is `fallback()`, creating nothing. A file that is
  not JSON is renamed to `<name>.broken-<local yyyymmdd-hhmmss>` (with `-2`, `-3`… if taken), never
  deleted, a warning is logged and `fallback()` returned.
- `parse` is the caller's: it repairs what it must and **keeps the keys it does not know**, so a
  file written by a newer version survives a read-modify-write by an older one.
- **Rejected:** a JSON-store library — the atomic rename and the broken file's rule are the whole
  value, and they are ours.

## i18n — `src/core/i18n.ts`

- `t(key, params)` with `{name}` placeholders; a placeholder without a value stays visible. Keys
  are typed from the English catalog, so an unknown key is also a compile error.
- Catalogs in `src/core/i18n/<lang>.ts`: `en` is the source, `es` the first translation; a key
  missing from a translation shows its English text.
- The language: the setting if it names one the app has, else the first of the system's preferred
  languages the app has (`app.getPreferredSystemLanguages()`, `es-AR` → `es`), else English.
- Main chooses the language and sends the renderer its whole catalog once (`i18n:catalog`), already
  filled in with English; the renderer's `t()` (`src/renderer/i18n.ts`) uses the same
  interpolation.
- `scripts/check-i18n.mjs`, in `npm run ci`: every `t()` under `src/` takes a literal key that `en`
  has, and no translation has a key `en` lacks (errors); untranslated and unused keys are warnings.
  It imports the catalogs for real, so one that does not evaluate fails; they are plain TypeScript
  that Node can strip, with only type imports between them.
- **Rejected:** i18next — no plurals or ICU messages needed so far; a plan that needs them can
  justify it.

## SQLite — `src/core/db.ts`

- **`node:sqlite`, no native module.** Checked on 2026-11-08: it works in Vitest on Node 22.21.1
  (SQLite 3.50.4, with an experimental-feature warning) and in Electron 45.2.3's main process
  (Node 24.22.2, SQLite 3.53.4). `better-sqlite3` would be one more native module to rebuild for
  Electron and ship in every installer.
- `openDb(path, busyTimeoutMs)` gives `transaction(work)` (`BEGIN IMMEDIATE`, rolled back when
  `work` throws), `userVersion()` / `setUserVersion(n)`, and the raw handle.
- **It is synchronous**: a database is opened off the UI path (a worker or a utility process),
  never on Electron's main thread or in the renderer.
- The usage history's own rules (a file from a newer app left untouched, an unreadable one moved
  aside) belong to the usage history, not to this wrapper.
