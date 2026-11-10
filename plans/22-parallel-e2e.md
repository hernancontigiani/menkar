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
- **B1, delivered 2026-11-10:**
  - `e2e/display.ts` (`ensureDisplay`, `displays`) is called by `launchApp`, `open.spec.ts`'s FIL-31
    and `detach.spec.ts`. `files-cases.spec.ts`'s spawn uses `launched.env`, which already has it.
  - **Deviation:** the session bus is dropped in `ensureDisplay` (the worker's environment), not in
    `launchApp`, so every spawn loses it too. In the app it reads `disabled:` (Chromium's own
    marking), not absent.
  - **Test:** `e2e/display.spec.ts`. Seen red with no `ensureDisplay` call (the app was on
    `xvfb-run`'s `:100`), and with the bus line removed.
  - **Not written:** the plan's "two workers get different displays" test. A worker sees only its
    own display. Uniqueness holds by construction (each slot has its own band, and a locked number
    is skipped), and 15 full runs at 4 workers never collided.
  - A first full run at 1 worker on the moving tree (`b1`'s plan 25 in progress) failed only
    `b1`'s unfinished spec.
- **B2, measured 2026-11-10** on a snapshot (`HEAD` 45ebd41 plus this plan's files), because
  `b1`'s work in progress moved under runs on the tree:

  | Workers | Wall | Result | Peak memory used |
  |---|---|---|---|
  | 1 | 390 s | 259 passed, 1 skipped | 6107 MB |
  | 4 | 107 s | green | 6612 MB |
  | 6 | 84 s | CHT-9 failed | 7825 MB |
  | 8 | 72 s | CHT-9 and detach failed (detach's 2 s budget) | 8259 MB |

  - The baseline is 4881 MB.
  - **Chosen: 4.** That is 3.6× faster, and green.
  - `playwright.config.ts`: `workers: MENKAR_E2E_WORKERS ?? 4`, `fullyParallel: true`.
- **Races shown under load, each fixed by waiting for what the test means** (seen red where it can
  be forced):
  - **CHT-9:** it asserted no `.dialog` after closing the window, on a page that could already be
    closed. Now a dialog is watched from before the close until the app exits.
    - Seen red by inverting the assertion.
    - An `expect(` rewrite, accepted by `set`.
  - **PRF-24** "nothing running": the "relaunched" process it found was Electron with Playwright's
    loader. It never reached Menkar's code (a probe in the snapshot only); under load it was
    sometimes not seen within 20 s.
    - Now a spy on `app.relaunch` records the phase, and the test expects `['will-quit']`: asked
      for once, while the quit runs.
    - Seen red 3/3 with the code from before bedb729 (`if (await quitApp()) app.relaunch()` gave
      `running`).
    - The real relaunch became the human's check, STATUS §2 2.17.
  - **TRM-57:** read the selection right after the double click. Now an `expect.poll`; accepted by
    `set`, already in d846252.
  - **PRF-31:** read `settings.json` right after `toggle.check()`; the switch flips before main
    writes. Now a poll on the file first, after check and after uncheck. Lines were added only;
    the original asserts stay.
  - **Retention round trip** (`settings.spec.ts`): the same race on uncheck. It now waits for the
    text that follows the write.
  - **Remote-live** row phone: measured the row while it was being redrawn. It now waits for the
    svg to be visible.
  - **LOOK-67:** read `.tab`'s radius while the strip was being redrawn (NaN). It now waits for the
    two tabs, and the radius is an `expect.poll`; an `expect(` rewrite.
  - **FIL-33**, observed once in 15 runs: the `menkar open` dialog did not appear within 15 s. Not
    reproduced: 4/4 alone, and 66/66 with the file specs repeated 3× at 4 workers. Left as it is;
    if it recurs, it goes to `e2e/FLAKY.md` with a date.
- **B3, acceptance 2026-11-10 on the real tree** (`HEAD` d846252 plus this plan), `rm -rf out` and
  `npm run ui-check` each time:
  - Batches that a race broke, each fixed and then started again from run 1:
    - 112, 115, 112 ✗ CHT-9, 111, 111 s (on the snapshot);
    - 106, 107, 111 ✗ PRF-24, 109, 112 s (on the snapshot);
    - 106 ✗ TRM-57, 107, 107, 108, 108 s;
    - 106, 108, 109 ✗ PRF-31, 111, 109 s;
    - 130 ✗ remote-live, 107, 107, 107 ✗ LOOK-67, 106 s;
    - 109 ✗ FIL-33, 107, 107, 106, 107 ✗ LOOK-67 s.
  - **Final batch, 5 in a row, all green** (258 passed, 1 skipped, TRM-25 quarantined): 107, 107,
    108, 108, 107 s.
  - **`npm run package`:** 53 s, exit 0, never installed. electron-builder downloaded Electron's zip
    into its cache, the build tool's own fetch.
  - **`npm run package:smoke`:** exit 0, 258 passed, 1 skipped, 107 s.
  - **Docs:** `docs/toolchain.md` gains "Running in parallel".
