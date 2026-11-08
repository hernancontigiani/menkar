# Plan 03 — foundations: logging, JSON state, i18n, SQLite

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 02 (`b2`): no
> shared file.
>
> **Exit, when executed:** each module's why-not → `docs/foundations.md` with its row in
> `CLAUDE.md`'s docs table; the i18n check joins `npm run ci` (`README.md` "Development" names it);
> the rest → `git log`.

## Goal

The four pieces every feature plan needs and `CLAUDE.md` already requires, built once, tested, with
no feature on top yet: one logging module, the app's JSON state written whole, `t()` with its
catalogs and their check, and the SQLite access the usage history will use.

## What already exists

`src/core/clock.ts`, `src/core/paths.ts` (XDG on Linux, `usePlatformDirs` from main elsewhere),
`src/shared/ipc.ts`, `scripts/ci.mjs` and its checks, `tests/setup.ts` pointing the paths at a
temporary directory. Laburomenos (`~/git/lm-app/frontend/scripts/check-i18n.mjs`) checks every
`t('…')` literal against its catalog, imported for real so a catalog that does not evaluate fails.

## The design

- **`src/core/log.ts`** — the one logging module: `log.warn(message, fields)` and kin, structured
  fields apart from the message, level from `MENKAR_LOG` (`warning` by default, `debug` raises it),
  one line per record to stderr; main also writes the same lines to `<cache>/menkar.log`, rotated at
  a size. A code rule (in `check-code-rules.mjs`) fails on `console.*` outside this module and the
  scripts.
- **`src/core/jsonstate.ts`** — `readJson(path, parse)` / `writeJson(path, value)`: the write is a
  temporary file in the same directory, `fsync`, then `rename`; a file that does not parse is moved
  aside to `<name>.broken-<local timestamp>` (never deleted), logged, and the caller gets its
  default; unknown keys survive a read-modify-write. Async, never blocking.
- **`src/core/i18n.ts`** — `t(key, params?)` with `{name}` placeholders, catalogs in
  `src/core/i18n/<lang>.ts` (`en` the source, `es` the first translation, as agent-tablet has),
  language from the setting or the system locale, English as fallback. Usable from main and, through
  the preload, from the renderer (the catalog is sent once). `scripts/check-i18n.mjs` in
  `npm run ci`: every `t('literal')` key under `src/` exists in `en` (error); keys in `es` missing
  from `en` (error); `en` keys missing in `es` and unreferenced keys (warnings).
- **SQLite** — B0 checks whether `node:sqlite` (built into Node 22) works in both Vitest on plain
  Node 22 and Electron 45's main process; if it does, `src/core/db.ts` wraps it and no native module
  is added; if not, `better-sqlite3` rebuilt for Electron, justified in the log. `db.ts` gives open
  (with a busy timeout), a transaction helper and `user_version` read/write; the history's own rules
  (newer file left untouched, unreadable one moved aside) are the usage plan's.

**Rejected:** a logging library (one sink, structured fields and a level are a page of code); a
JSON-store library (the atomic rename and the broken file's rule are the whole value, and ours);
i18next (no plurals or ICU needed so far; a later plan can justify it).

## Product decisions and the test that holds each

| Decision | Test |
|---|---|
| State is written whole | a write interrupted after the temporary file (simulated) leaves the old file intact |
| A broken state file is kept | garbage bytes → moved to `.broken-<timestamp>` with the same bytes, default returned, a warning logged |
| Unknown keys survive | read `{a, x}`, change `a`, write → `x` still there |
| One logging module | the code rule fails on an injected `console.log` in `src/core` (seen red) |
| Every string through `t()` | `check-i18n` fails on an injected `t('no.such.key')` (seen red) |
| Translation falls back | `es` missing a key → the English text, no crash |
| Paths stay temporary in tests | the log file and state files of every test land under the temporary directory |
| SQLite works where it will run | the B0 check, recorded with versions |

## Out of scope

Any feature; the settings' list (Preferences' plan); the usage history's schema.

## Do not touch

`docs/spec/`, `docs/NOT_BUILT_YET.md` and `plans/02-spec.md` (`b2`).

## Execution blocks

### B0 — SQLite where it runs
- [ ] `node:sqlite` in Vitest and in Electron's main (a scratch run under `xvfb-run`); the answer and
      versions in the log.
- **Verification:** the log says which and why.

### B1 — log, jsonstate, db
- [ ] The three modules and their tests; the `console` code rule.
- **Verification:** `npm run ci`; each rule seen red.

### B2 — i18n
- [ ] `t()`, `en` and `es` catalogs (the strings of plan 01's window, if any), the preload bridge,
      `check-i18n.mjs` in `npm run ci`.
- **Verification:** `npm run ci`; `npm run ui-check` still green.

### B3 — Exit
- [ ] `docs/foundations.md`, its `CLAUDE.md` row, `README.md` "Development" names the i18n check.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
