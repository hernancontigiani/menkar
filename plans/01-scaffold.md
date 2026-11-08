# Plan 01 — the skeleton and the toolchain

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 02 (`b2`): the two
> share no file.
>
> **Exit, when executed:** how to build, run and check the app → `README.md` ("Development");
> the toolchain's why-nots → `docs/toolchain.md` with its row in `CLAUDE.md`'s docs table; the rest
> → `git log`.

## Goal

An Electron + TypeScript app that opens one window with one xterm.js terminal on a node-pty running
the user's shell, built and checked by `npm run ci` and seen by `npm run ui-check` — the base every
feature plan builds on, with the three layers of `CLAUDE.md` in place from the first commit.

## What already exists

- The repository: `CLAUDE.md`, `plans/`, `.claude/skills/`, `.claude/rules/ts-tests.md`,
  `docs/history/` with `nothing_lost.py` (Python, to be ported here), `LICENSE`, `README.md`.
- Validated on this machine (agent-tablet's plan 11, 2026-11-08): Electron 45 + TypeScript +
  node-pty 1.1 + `@xterm/xterm` and `@xterm/headless` 6 + Playwright's `_electron.launch` under
  `xvfb-run`. Found there: `npm install` may not fetch Electron's binary
  (`node node_modules/electron/install.js` does); node-pty is rebuilt for Electron with
  `@electron/rebuild`; on the human's Ubuntu 24.04 desktop Electron needs `--no-sandbox` in
  development (AppArmor and `chrome-sandbox`), not under `xvfb-run`; xterm.js's custom key handler
  sees keydown and keypress; the fit addon must measure an element without padding.
- From the laburomenos repository (`~/git/lm-app/frontend`), worth keeping: the tsconfig flags, the
  test-integrity check, the flaky quarantine with an expiry, the i18n key check, and Playwright with
  `forbidOnly`, no local retries and traces only on the first retry.

## The design

- **Layout:** `src/core/` (no Electron, no DOM), `src/main/`, `src/preload/`, `src/renderer/`,
  `src/shared/ipc.ts` (every channel and payload, typed once); `tests/` for Vitest, `e2e/` for
  Playwright; `scripts/` for the checks.
- **Build:** electron-vite (main, preload and renderer bundled; renderer served by Vite in dev).
  `npm run dev` (with `--no-sandbox` on Linux desktops), `npm run build`.
- **tsconfig:** `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `noImplicitOverride`, `exactOptionalPropertyTypes`, `isolatedModules`; one config per layer so
  `core` cannot see DOM or Electron types (`lib` without DOM, no Electron in `types`).
- **Biome** for lint and format (one tool), with `noExplicitAny` an error.
- **Vitest** for `core` and main-side logic; `tests/setup.ts` points the paths module at a temporary
  directory for every test.
- **The renderer's security:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, a
  CSP meta that allows only `'self'`; the preload exposes one typed object.
- **The first feature, minimal:** one window, one terminal (`@xterm/xterm` + fit addon in the renderer,
  node-pty in main, data over IPC), the user's `$SHELL`, resize forwarded, the pty killed by PID when
  the window closes.
- **`npm run ci`** runs in order, failing on the first red: `biome ci`, `tsc --noEmit` for every layer,
  `vitest run`, `scripts/check-code-rules.mjs` (no `Date.now()` / `new Date()` outside
  `src/core/clock.ts`, no `electron` import under `src/core/`, no `any` — by parsing the sources with
  the TypeScript compiler API, not grep), `scripts/check-test-integrity.mjs` (against `main`: the
  number of `test(`/`it(` declarations never goes down and no `expect(` line is removed, as
  laburomenos does, with no override), `scripts/check-flaky.mjs` (`e2e/FLAKY.md` rows with a past
  date fail), `scripts/nothing-lost.mjs` (the Node port of `docs/history/nothing_lost.py`, which is
  then deleted). The i18n check comes with the i18n module, in a later plan.
- **`npm run ui-check`:** builds, then runs Playwright's `_electron.launch` under `xvfb-run -a` with
  `forbidOnly`, `retries: 0`, trace on first retry, screenshots into `test-results/`; it never opens a
  window on the human's display and never touches the human's directories (the app's paths point at
  a temporary `HOME` / XDG set for the run).

**Rejected:** ESLint + Prettier (two tools where Biome is one); `node:test` (Vitest's watch, mocking
of time and parallel runs are what the clock rules need); a UI framework now (none is needed for one
terminal; a feature plan can justify one); webpack/Electron Forge (electron-vite is lighter and Vite
is what laburomenos already uses).

## Product decisions and the test that holds each

| Decision | Test |
|---|---|
| `core` imports nothing from Electron or the DOM | `check-code-rules.mjs` fails on an injected `import 'electron'` in a `core` file (seen red) |
| Time only through the clock | the same script fails on an injected `Date.now()` (seen red) |
| A test cannot be weakened silently | `check-test-integrity.mjs` fails on a branch that deletes a test and on one that removes an `expect(` (both seen red in a scratch commit, then dropped) |
| No line of a decision doc is lost | `nothing-lost.mjs` reproduces `nothing_lost.py`'s results on the same scratch change |
| The terminal works | e2e: launch, the terminal shows a prompt, type `echo menkar-ok` + Enter, the buffer has `menkar-ok`, screenshot; close the window and the pty's PID is gone |
| Paths never reach the developer's home in tests | a Vitest test asserts the paths module resolves under the temporary directory |

## Out of scope

Sessions, projects, any Claude-specific behaviour, packaging, i18n, themes.

## Do not touch

`docs/spec/` (plan 02, `b2`); `plans/` other than this plan's log; `CLAUDE.md` except the docs table
row of the exit.

## Execution blocks

### B1 — Skeleton and the gate

- [ ] `package.json` (Node 22, npm), electron-vite, TypeScript configs per layer, Biome, Vitest, the
      clock and paths modules in `core` with their tests, `src/shared/ipc.ts`.
- [ ] `npm run ci` with Biome, `tsc`, Vitest and `check-code-rules.mjs`.
- **Verification:** `npm run ci` green; both code rules seen red once.

### B2 — The terminal and ui-check

- [ ] One window, one xterm.js terminal on node-pty (rebuild for Electron), resize, kill on close.
- [ ] `npm run ui-check` and its first test (the terminal row above).
- **Verification:** `npm run ci`; `npm run ui-check` green three runs in a row; the screenshot looked at.

### B3 — The guards

- [ ] `check-test-integrity.mjs`, `check-flaky.mjs` with an empty `e2e/FLAKY.md`, `nothing-lost.mjs`
      (and delete `docs/history/nothing_lost.py`), all in `npm run ci`.
- **Verification:** each seen red as the table says; `npm run ci` green.

### B4 — Exit

- [ ] `README.md` "Development" (install, `node node_modules/electron/install.js` if needed, `npm run
      dev`, `npm run ci`, `npm run ui-check`, the `--no-sandbox` note); `docs/toolchain.md` with the
      rejected tools; its row in `CLAUDE.md`.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
