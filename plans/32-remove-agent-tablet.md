# Plan 32: agent-tablet leaves Menkar (1.68, 1.17)

> **Status:** written 2026-11-11 by `set`. Ready to execute, block 1 now, block 2 after plan 31 is
> committed (it shares files with plan 31).
>
> **Exit, when executed:** the docs this plan edits say what Menkar is on its own; every removed
> line of a decision document goes verbatim to its history (the history check); `plans/00-STATUS.md`:
> 1.8 and 1.17 settled by 1.68 point to `git log`; this plan's row leaves §3. The rest → `git log`.

## Goal

0.1.0 is accepted (STATUS, 2026-11-11) and agent-tablet's repository is being deleted. Menkar stops
naming it, importing from it and comparing with it (1.68). The credit line to Agent Session Manager
stays (`README.md`, About).

## What exists (verified 2026-11-11)

42 files outside `docs/history/` name agent-tablet (`grep -rli "agent-tablet\|agent tablet"`):
- **The first-start import** (1.8): `src/core/projects/import.ts`, `src/core/usage/importer.ts`,
  `src/main/projects.ts` (its call), the agent-tablet paths in `src/core/paths.ts`, their tests
  (`tests/core/projects/import.test.ts`, `tests/core/usage/import.test.ts`,
  `tests/core/paths.test.ts`), the import's strings in `src/core/i18n/{en,es}.ts`, the import e2e
  in `e2e/projects.spec.ts`, and the import rows of `docs/projects.md`, `docs/usage.md`.
- **Comments and wording** in `src/core/{agentstate/detect.ts, classifier/*, context/*,
  usage/nodes.ts, usage/statusline.ts}`, `tests/core/usage/{history,measure}.test.ts`,
  `e2e/integrations.spec.ts`.
- **Docs**: `CLAUDE.md` (intro, the spec row), `docs/spec/*` (written "from agent-tablet's
  documents": source citations such as "agent-tablet's `plans/00-STATUS.md` 1.24"),
  `docs/release-checklist.md` (comparisons), and nine subsystem docs.

## The design

- **The import goes whole**: code, tests, strings, docs. A first start is then just a fresh
  `projects.json` and `state.json`. Menkar's own data already imported stays untouched.
- **A comment or doc line that cites agent-tablet as a source** is rewritten to say the fact in
  Menkar's own terms, or dropped when it adds nothing ("as agent-tablet did" → nothing).
- **`docs/spec/`** keeps its feature ids and requirements; its sentences about where they were
  read from go. Its README's first paragraph says the spec is what Menkar must do.
- **The release checklist** loses its comparison steps; what each step checks stays.
- **`CLAUDE.md`**'s intro keeps "written from scratch" and drops the predecessor's name and path;
  "new text never names agent-tablet" becomes "nothing names agent-tablet".
- **Not touched**: `docs/history/` (it records what was), the credit to Agent Session Manager, git
  history.

## Out of scope / Do not touch

- `~/.config/agent-tablet` on the human's machine (theirs to delete).
- Plans 27 and 28, and `plans/ideas/` (already free of the name, or historical).
- Any behaviour other than the import.

## Execution blocks

### Block 1 — docs only (now)

- [ ] `CLAUDE.md`, `docs/spec/*`, `docs/release-checklist.md`, and the nine subsystem docs except
      the import rows of `docs/projects.md` and `docs/usage.md` (block 2): rewritten as above;
      removed lines verbatim to their history files.
- **Verify:** `npm run ci` (history check: 0 lines lost).

### Block 2 — the import and the code's wording (after plan 31 is committed)

- [ ] Remove the import (code, call, paths, strings en/es, tests, e2e) and its doc rows.
- [ ] Rewrite the remaining comments and test wording.
- [ ] `grep -rli "agent-tablet\|agent tablet"` outside `docs/history/` → nothing.
- **Verify:** `npm run ci`; `npm run ui-check` (full).

## Execution log

_Written by the executing session._
