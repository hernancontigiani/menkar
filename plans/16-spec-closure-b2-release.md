# Plan 16 — closing the spec in `b2`'s areas, and the first release candidate for Ubuntu

> **Status:** written 2026-11-08, ready to execute. Executed by `b2`, beside plan 15 (`b1`).
>
> **Exit, when executed:** `b2`'s area files hold only pointers (plus hand checks moved to
> `plans/00-STATUS.md` §2), removed lines to `docs/history/spec/`; `README.md` "Install" describes the
> release candidate; `docs/packaging.md` gains how a release is cut; the rest → `git log`.

## Goal

Two things that end the first version: every remaining acceptance case of `usage.md`,
`classifier.md`, `context.md`, `preferences.md` and `chat.md` built and tested, checked by hand, or
decided against (as plan 15 does for `b1`'s areas); and Menkar 0.1.0 as a release candidate for
Ubuntu — the `.deb` built, inspected and smoke-tested, with one page of what the human checks by hand
before calling it the first version.

## What it builds

- **B1 — Inventory and closure** of the five area files, as plan 15 describes (built and tested /
  checked by hand / decided against; nothing "built but untested"). Send `set` the inventory first.
- **B2 — The release candidate:** the version set to `0.1.0` in `package.json` (one change, shared
  file); `npm run package`, `package:check`, `package:smoke` green against it; the `.deb`'s size and
  file count in the log; `README.md` "Install" for 0.1.0; and `docs/release-checklist.md` — the human's
  checks gathered from `plans/00-STATUS.md` §2 into one ordered list (install, first start with the
  agent-tablet import, a day of work, Usage, the classifier, Remote Control from the phone, the
  Markdown preview on a real screen, retaking the screenshots that Broadway squeezed), each with what
  "passes" means. Never install the package; that is the human's.

## Do not touch

`b1`'s areas and files (plan 15 is closing them in the same tree): the renderer's main window
modules, `src/main/workspace.ts`, `terminal.ts`, `files.ts`, `panes.ts`, `src/core/projects/`,
`src/core/sessions/`, `src/core/files/`.

## Execution blocks

### B1 — Inventory and closure
- [ ] The inventory to `set`; then each case to one of the three states.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — The release candidate
- [ ] Version, package, checks, the checklist.
- **Verification:** `npm run ci`; `npm run package:check`; `npm run package:smoke`.

### B3 — Exit
- [ ] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
