# Toolchain — what builds and checks Menkar, and why these tools

The versions are in `package.json`; the commands in `README.md` ("Development"). This file keeps
what neither says: why each piece, and what was rejected.

## The pieces

- **electron-vite** bundles main, preload and renderer, and serves the renderer from Vite in
  development. **The preload is built as CommonJS** (`index.cjs`): a sandboxed preload cannot be an
  ES module, and the renderer runs with `sandbox: true`.
- **TypeScript, one config per layer** (`tsconfig.core.json`, `.main`, `.renderer`, `.node`), so
  `src/core/` compiles without the DOM library and without Electron's types: a DOM or Electron
  call there is a compile error, not a review comment. `npm run typecheck` runs all four.
- **TypeScript 6, not 7.** TypeScript 7 (the native compiler) ships its compiler API only under
  `unstable/` entry points, and the code-rule and test-integrity checks parse the sources with that
  API. Moving to 7 is a version bump once its API is stable.
- **Biome** lints and formats, with `noExplicitAny` as an error. It looks only at code
  (`src/`, `tests/`, `e2e/`, `scripts/`, root configs), never at the Markdown documents.
- **Vitest** for `src/core/` and main-side logic. `tests/setup.ts` points `HOME` and the XDG
  directories at a temporary directory before any test runs.
- **Playwright's `_electron.launch`** on the built app, under `xvfb-run -a`, with `forbidOnly`, no
  retries and a trace only on a retry. `e2e/app.ts` launches with a temporary `HOME` and XDG set,
  on its worker's own X server (below).

## Running in parallel (2026-11-10)

- **One Xvfb per Playwright worker** (`e2e/display.ts`, `ensureDisplay()`), so no two tests share a
  screen. Several tests read the whole screen back or size and maximize their window.
  - **It runs once per worker process,** before its first launch.
  - **It picks a display** from its own band (`:100 + 10 × TEST_PARALLEL_INDEX`), skipping a number
    with a lock or a socket, as `xvfb-run -a` does. So another session's run on the machine never
    collides.
  - **It starts the server** as `Xvfb :<n> -screen 0 1280x1024x24 -nolisten tcp` with an xauth
    cookie, and waits for it on `-displayfd`.
  - **It sets `DISPLAY` and `XAUTHORITY`** in the worker's environment. Every app a test starts
    copies that environment: `launchApp`, the direct `menkar open` spawns, detach's pty.
  - **It stops the server** by PID when the worker exits.
- **The session bus is dropped** in the same place (`DBUS_SESSION_BUS_ADDRESS`), so a test's
  desktop notification never reaches the developer's own desktop. Chromium then marks the bus
  `disabled:`. `e2e/display.spec.ts` asserts the display and the bus.
- **`xvfb-run -a` and `MENKAR_E2E_XVFB=1` stay around the whole run** as the backstop. A worker
  that never reached `ensureDisplay` still lands on a virtual display, never the developer's.
- **Workers:** `MENKAR_E2E_WORKERS`, 4 by default, with `fullyParallel: true`. `look.spec.ts` and
  `projects.spec.ts` hold about a quarter of the tests, and per-file workers would leave each in
  one worker.
  - Measured on 2026-11-10 on a 16-core machine with 27 GB, full suite, 260 tests:

    | Workers | Wall time | Result |
    |---|---|---|
    | 1 | 390 s | green |
    | 4 | about 107 s | green |
    | 6 | 84 s | load-sensitive tests fail |
    | 8 | 72 s | load-sensitive tests fail |

  - Memory in use peaked at 6.1 GB with 1 worker, 6.6 GB with 4, and 8.3 GB with 8.
- **Load shows races in tests:** a read made right after an action, before the window or main has
  caught up.
  - The fix is to wait for what the test means: `expect.poll` on the file, or the visible state that
    follows the write. Never a longer sleep, and never a retry (`retries: 0` stays).
  - A test that cannot be fixed goes to `e2e/FLAKY.md` with a date.
- **The e2e launch forces X11** (`--ozone-platform=x11`, no `WAYLAND_DISPLAY`): on a Wayland desktop
  Electron otherwise opens its window on the developer's screen, whatever `xvfb-run` sets `DISPLAY`
  to. An e2e test asserts it. Playwright passes `--no-sandbox` to Electron, so these runs are
  unsandboxed.
- **Electron is never started bare for a check**: without `HOME` and the XDG variables pointed
  elsewhere it writes its profile to the developer's `~/.config/menkar/`.
- **node-pty is rebuilt for Electron** by `postinstall` (`@electron/rebuild`): the binary npm
  builds is for Node's ABI and does not load in Electron. Nothing under Vitest loads node-pty.
- **`npm install` may not fetch Electron's binary**; `node node_modules/electron/install.js` does.

## The checks in `npm run ci`

| Script | What it holds |
|---|---|
| `scripts/check-code-rules.mjs` | No `Date.now()` / `new Date()` outside `src/core/clock.ts` (in `src/` and `tests/`); nothing under `src/core/` imports `electron` or a file outside `src/core/`; no `any` without a `biome-ignore` reason on its line or the one above |
| `scripts/check-i18n.mjs` | Every `t()` key under `src/` is in the English catalog, and no translation has a key English lacks (`docs/foundations.md`) |
| `scripts/check-test-integrity.mjs` | Against `main` (or `MENKAR_TEST_BASELINE`): the number of test declarations in `tests/` and `e2e/` never goes down, and no `expect(` line is removed or rewritten. No override |
| `scripts/check-flaky.mjs` | A row of `e2e/FLAKY.md` whose date has passed fails the run |
| `scripts/nothing-lost.mjs` | Every line that left a decision document since `HEAD` is in its history under `docs/history/`, and no history lost a line |

The first two parse the sources with the TypeScript compiler API rather than grep, so a mention
inside a comment or a string does not count and one split over two lines does.

The test-integrity check compares against `main`, so on `main` itself it measures the uncommitted
work against the last commit. It writes both sides to temporary directories and diffs those:
`git diff <ref>` sees only tracked files, and a session's new tests are untracked until `set`
commits them.

`npm run ci` stops at the first red step. While a test-integrity failure is accepted but not yet
committed, the steps after it do not run: run `node scripts/check-flaky.mjs` and
`node scripts/nothing-lost.mjs` by hand and report them on their own (2026-11-12).

**UI work is reported after `npm run ui-check` runs whole**, not only the specs it touched: in
plan 34 only the full run caught a new popover icon taking the place of the button another spec
clicks. Specs write their screenshots to `/tmp/menkar-shots/` only; a worker copies its own into
`$MENKAR_FILES` by hand, because a spec that wrote there would fill the human's folder whenever a
Menkar session runs it (2026-11-12).

## Rejected

- **ESLint + Prettier**: two tools and two configs where Biome is one.
- **`node:test`**: Vitest's fake timers (the clock rules), watch mode and parallel runs.
- **A UI framework**: nothing needs one for a terminal; a feature plan can justify one.
- **webpack or Electron Forge**: electron-vite is lighter, and Vite is what the human's other
  projects use.
