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
  retries and a trace only on a retry. `e2e/app.ts` launches with a temporary `HOME` and XDG set.
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

## Rejected

- **ESLint + Prettier**: two tools and two configs where Biome is one.
- **`node:test`**: Vitest's fake timers (the clock rules), watch mode and parallel runs.
- **A UI framework**: nothing needs one for a terminal; a feature plan can justify one.
- **webpack or Electron Forge**: electron-vite is lighter, and Vite is what the human's other
  projects use.
