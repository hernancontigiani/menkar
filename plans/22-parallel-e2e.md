# Plan 22: parallel e2e, one virtual display per worker

> **Status:** designed 2026-11-10 by `b2` (the human made it top priority after the 23+24 commit).
> Executed by `b2` once `set` has committed plans 23 and 24 and said go; until then nothing in
> `playwright.config.ts` or `e2e/` changes, since `b1` runs the suite.
>
> **Exit, when executed:** `docs/toolchain.md` (the e2e doc that exists; `docs/ui-verification.md`
> does not) gains "Running in parallel"; the rest → `git log`.

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

## The audit (2026-11-10, against the tree with plans 23 and 24 in it)

Twenty-eight spec files; all but `detach.spec.ts` launch through `e2e/app.ts`'s `launchApp`, and
every environment a test builds (`launchApp`, `open.spec.ts`'s and `files-cases.spec.ts`'s direct
`spawn` of Electron, `detach.spec.ts`'s pty) is copied from `process.env`. So **whatever sets
`DISPLAY` in a worker's own `process.env` before its first launch reaches every app that worker
starts**: a Playwright worker is a process of its own.

| What is shared | Where | Parallel-safe? | What it needs |
|---|---|---|---|
| One X display (`xvfb-run -a` around the whole run) | every spec | **No** | One Xvfb per worker (below) |
| The whole screen read back (`desktopCapturer`, `screen.getPrimaryDisplay()`) | `titlebar.spec.ts` `screenPixel` (LOOK-56, LOOK-63) | Only with a display per worker | Nothing more once each worker has its own screen: one test, one app, at a time per display |
| Window size and position (1280 × 800 asserted, maximize, full screen) | `look.spec.ts` LOOK-1, LOOK-10; `titlebar.spec.ts` LOOK-58, LOOK-64 | Only with a display per worker | The same screen as `xvfb-run`'s default, `1280x1024x24` |
| `/proc` scanned for processes | `detach.spec.ts` (`HOME=<root>/` in the environment, or `<root>/` on the command line); `preferences.spec.ts` PRF-24 (`HOME=<root>/home`) | **Yes**: both filter on the test's own temporary root | Nothing |
| A process checked or killed by PID | `drawer.spec.ts`, `terminal.spec.ts`, `window.spec.ts`, `detach.spec.ts`, PRF-24 | Yes: a PID the test read from its own app | Nothing |
| Temporary folders | `launchApp` (`mkdtemp` under `tmpdir()`), `chat.spec.ts` logs, `detach`/`open` roots | Yes: `mkdtemp` | Nothing |
| Fixed output files | `test-results/{look,files,usage}/…`, `test-results/{terminal,rc-live}.png`, `/tmp/menkar-shots/{drawer,settings}-*.png` | Yes: each path is written by one test only | Nothing; a new screenshot keeps a name of its own |
| Module-level `let` (`home`, `root`, `typed`) | `addsession`, `files`, `remote`, `remote-live`, `fixtures.ts` | Yes: set in `prepare` and read by the same test, and a worker runs its tests one at a time | Nothing, also under `fullyParallel` |
| Electron's single-instance lock | `src/main/index.ts` | Yes: it lives in `userData`, under each test's `XDG_CONFIG_HOME` | Nothing |
| Network ports | none found | — | — |
| The session D-Bus (`DBUS_SESSION_BUS_ADDRESS`, inherited) | desktop notifications (`src/main/agentstate.ts`) | Not a parallel problem, **but a finding**: a test whose agent finishes in an unwatched tab can send a notification to the developer's real desktop, under `xvfb-run` today too | Block 1 drops the variable in `launchApp`. With no bus the app skips notifications when `Notification.isSupported()` is false, and nothing reaches the developer's desktop. To be verified when built, since what Electron does with no bus is not known yet. Asserted by a test |
| Load: fixed sleeps (`waitForTimeout`, 150 ms – 2.5 s) and timing-based polls | about 30 sites (`panes`, `files-cases`, `agent-panes`, `chat`, `integrations`, `drawer`…) | Sensitive to CPU load, not to sharing | Measured in block 3; a test that starts failing under load is fixed or quarantined with a date (`retries: 0` stays) |

Other runs on the same machine (`b1`'s or `set`'s suite) are one more reason for the display
choice below: `xvfb-run -a` already probes for a free number; each worker must too.

## The design

- **`e2e/display.ts`**, one export, `ensureDisplay(): Promise<void>`, called first thing by
  `launchApp`, `open.spec.ts`'s and `files-cases.spec.ts`'s spawns, and `detach.spec.ts`:
  - once per worker process (a module-level promise), it picks the first free display from
    `:100 + TEST_WORKER_INDEX × 10` (no `/tmp/.X<n>-lock`), writes an X cookie with `xauth` into a
    temporary file, starts `Xvfb :<n> -screen 0 1280x1024x24 -nolisten tcp -auth <file>`, waits for
    its socket, and sets `process.env.DISPLAY` and `XAUTHORITY`; a start that loses the race to
    another run tries the next number (as `xvfb-run -a` does);
  - it stops its Xvfb by PID on the worker's `exit`, and removes the cookie file.
- **The guard stays**: `launchApp` still refuses without `MENKAR_E2E_XVFB=1`, and the npm scripts
  still set it. `ui-check` and `package:smoke` keep `xvfb-run -a` around the run, so a worker that
  somehow skipped `ensureDisplay` still lands on a virtual display and never the developer's.
- **`playwright.config.ts`**: `workers` from `MENKAR_E2E_WORKERS`, default the number block 3 picks;
  `fullyParallel: true`, since `look.spec.ts` (34 tests) and `projects.spec.ts` (33) would otherwise
  each hold one worker for most of the run. `retries: 0` and `forbidOnly` stay.
- Rejected: a worker-scoped fixture through `test.extend` (every spec's import changes, for the same
  effect); one display for all with windows placed apart (LOOK-56's screen reads and the
  maximize tests would see the other windows); `xvfb-run` per worker from a wrapper script
  (Playwright starts the workers, not us).

## Execution blocks

- **B1, a display per worker** (after `set`'s go): `e2e/display.ts`; the calls to `ensureDisplay`;
  `DBUS_SESSION_BUS_ADDRESS` dropped in `launchApp`. Tests: one asserting that two workers' apps
  report different `DISPLAY`s (a spec with two tests under `fullyParallel`, checking each display
  against the worker index) and that `DISPLAY` is not the one `xvfb-run` set; one asserting the
  app's environment has no session bus. Seen red: `ensureDisplay` a no-op. Still `workers: 1`:
  the full suite green, so the change alone breaks nothing.
- **B2, the worker count**: the config reads `MENKAR_E2E_WORKERS`, `fullyParallel: true`. Measure
  the full suite at 1 (the "before"), 4, 6 and 8 workers from a clean `out/`: wall time and, from
  `free`, the peak memory. Pick the count; failures that appear only under load are listed with
  their cause.
- **B3, acceptance**: the full suite 5 times in a row at the chosen count from a clean `out/`, and
  `package:smoke` once (a packaged build: `npm run package` first, never installed). Each run's wall
  time in the log. A test that fails is fixed, or quarantined in `e2e/FLAKY.md` with a date and its
  cause — never retried. `docs/toolchain.md` gains "Running in parallel"; this plan is deleted on
  delivery.

## Execution log
