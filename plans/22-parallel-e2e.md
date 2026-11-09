# Plan 22: parallel e2e, one virtual display per worker

> **Status:** stub, written 2026-11-09. Executed by `b2`, not before 2026-11-10 (the human's call).
> Needs `/design-plan` into blocks before it runs.
>
> **Exit, when executed:** `docs/ui-verification.md` (or the e2e doc that exists then) gains "Running
> in parallel"; the rest → `git log`.

## Goal

`npm run ui-check` and `package:smoke` take 6–10 minutes because `playwright.config.ts` runs
`workers: 1`: about 240 real Electron starts in a row, on a 16-core machine. Every test already has
its own temp dirs, so the serial run is only there because all of them share one Xvfb display, and
several tests capture the full screen (LOOK-56's overlay pixel, LOOK-63's line under the buttons) —
two windows on one display would cover each other.

## Idea (to design)

- Each Playwright worker starts its own Xvfb (`:100 + workerIndex`, its own screen size) in a
  worker-scoped fixture and launches its Electron with that `DISPLAY`; `xvfb-run` wraps only what
  still needs it. Workers: start with 4, measure, pick the number (RAM: an Electron is ~300–500 MB).
- What must change to be parallel-safe: every test that finds processes by scanning (detach,
  drawer PID, tab close, Restart) filters on its own temp root; anything global (ports, fixed paths,
  `~/.cache` defaults) audited; the `MENKAR_E2E_XVFB` guard kept.
- Acceptance: the full suite green 5 runs in a row at the chosen worker count, from a clean `out/`,
  and `package:smoke` too; the wall time before and after in the log. Load-sensitive tests that
  start failing are fixed or quarantined with a date, never retried silently (`retries: 0` stays).

## Do not touch

The tests' assertions; `retries: 0`; the e2e-only-under-xvfb rule.
