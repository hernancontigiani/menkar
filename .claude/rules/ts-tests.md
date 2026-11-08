---
paths:
  - "**/*.test.ts"
  - "tests/**/*.ts"
---

# Writing a TypeScript test

A checklist, not an explanation. If it contradicts `CLAUDE.md`, `CLAUDE.md` wins and this file is
out of date.

## Before writing

- **Find the closest existing test and extend it** — a new case in a `test.each` is cheaper than a
  new test, a new test cheaper than a new file.
- **Vitest only** for `src/core/` and `src/main/` logic; Playwright on the real Electron app only for
  what the user sees (`npm run ui-check`).
- **Name the test as the sentence it proves** (`"Claude's name wins over the folder name"`), not
  after the function it calls.

## The data

- **Data is built by shared factories in `tests/factories/`** (a transcript line, a project). A helper
  copied into a test file is the next one to drift.
- **Real files in a temporary directory**: a transcript is a real `.jsonl`, the state a real
  `state.json`. A fake is only for what a test cannot run (a live `claude`, a pty) and lives in one
  place, driven from recorded output in `tests/data/`.
- **Recorded output from a real session is scrubbed before it is committed**: a transcript carries
  prompts, paths and code.

## The environment

- **Never read the developer's machine**: not `~/.claude`, not `~/.claude.json`, not the app's own
  directories. Tests point the paths module at a temporary directory; a forgotten one reads an empty
  directory, never the human's files.
- **No Electron in a unit test**: logic a window calls lives in `src/core/` and is tested there.
- **No real clock**: inject the time; cover midnight, a span over two days, and a `TZ` other than
  the developer's.

## What the test asserts

- **If it discovers what it compares** (files, lines, channels), **it first asserts a floor** of what
  it found — a loop over nothing passes.
- **If it asserts that something is not written** (into a transcript, into `~/.claude`), **it asserts
  by invariance** — the bytes are identical before and after.
- **Seen red once**: break the code under test from the test or invert the assertion, watch it fail,
  then put it back.
- **Tests run in parallel**: no test depends on another having run first.

## When done

- The file alone first (`npx vitest run <file>`), then `npm run ci`.
- Format and lint-fix only your own files.
