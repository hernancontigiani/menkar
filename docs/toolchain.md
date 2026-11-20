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
  (`src/`, `tests/`, `e2e/`, `scripts/`, root configs, and the site's scripts and TypeScript),
  never at the Markdown documents or the site's pages.
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
| `scripts/check-code-rules.mjs`, the agent rules (1.135) | Outside an agent's folders (`src/core/agents/<id>/`, `src/main/agents/<id>/`), `ids.ts`, `descriptors.ts`, the two registries, `tests/` and `e2e/`: no string literal that is an agent's id or command (`agent-literal`); no property, key or element access named as an id (`agent-property`); no declared name with an id as a word part, `claudeArgs` (`agent-identifier`); no `DEFAULT_AGENT` or `CLASSIFIER_AGENT` compared or switched on, outside `ids.ts` and the registries (`agent-default`). An agent's folder is imported only by its registry, its own folders, and `descriptors.ts` for its `descriptor.ts`, never from another agent's or `agents/shared/` (`agent-import`, tests exempt). The descriptors import only descriptors and `ids.ts` (types aside), and the renderer and the MCP server program import no registry or kit (`descriptors-node-free`). The ids and commands are read from `ids.ts` and the descriptors |
| `scripts/check-code-rules.mjs`, its `ALLOWED` map | The agent rules' known sites, counted per file and rule, each with its reason (the block that moves it, or why it stays): a file with more hits than its entry fails, so a count only goes down. The older rules have no allowance |
| `scripts/check-i18n.mjs` | Every `t()` key under `src/` is in the English catalog, and no translation has a key English lacks (`docs/foundations.md`) |
| `scripts/check-test-integrity.mjs` | Against the merge base of `main` and `HEAD` (or `MENKAR_TEST_BASELINE`): the number of test declarations in `tests/` and `e2e/` never goes down, and no `expect(` line is removed or rewritten. No override |
| `scripts/ci.mjs`, its "R10 unchanged" step | Off `main`, every file under `tests/core/r10/` holds `main`'s bytes, none missing and none added ("A long-lived branch", below) |
| `scripts/check-flaky.mjs` | A row of `e2e/FLAKY.md` whose date has passed fails the run |
| `scripts/nothing-lost.mjs` | Every line that left a decision document since `HEAD` is in its history under `docs/history/`, and no history lost a line |

**Three variables point the checks that compare against a base at another commit** (2026-11-20),
for a checkout that has no local `main` or whose tree is its `HEAD`, as the hosted CI's is:
`MENKAR_TEST_BASELINE` (test integrity's baseline), `MENKAR_HISTORY_BASE` (`nothing-lost.mjs`
compares the tree with that commit instead of `HEAD`; on a clean checkout `HEAD` would compare
nothing) and `MENKAR_R10_BASE` (the ref R10's files are compared with instead of the local `main`;
when it is set, being on `main` skips nothing). Unset, each check behaves as the table says.

The first two parse the sources with the TypeScript compiler API rather than grep, so a mention
inside a comment or a string does not count and one split over two lines does.

The test-integrity check compares against the merge base of `main` and `HEAD`, so on `main` itself
it measures the uncommitted work against the last commit. It writes both sides to temporary
directories and diffs those: `git diff <ref>` sees only tracked files, and a session's new tests
are untracked until `set` commits them.

`npm run ci` stops at the first red step. While a test-integrity failure is accepted but not yet
committed, the steps after it do not run: run `node scripts/check-flaky.mjs` and
`node scripts/nothing-lost.mjs` by hand and report them on their own (2026-11-12).

**UI work is reported after `npm run ui-check` runs whole**, not only the specs it touched: in
plan 34 only the full run caught a new popover icon taking the place of the button another spec
clicks. Specs write their screenshots to `/tmp/menkar-shots/` only; a worker copies its own into
`$MENKAR_FILES` by hand, because a spec that wrote there would fill the human's folder whenever a
Menkar session runs it (2026-11-12).

## The public site's checks (2026-11-20)

The site (`site/`, `docs/site.md`) has its own `package.json`, so `npm run ci` must not need its
`node_modules`:

- **`tests/site/*.test.ts` run in `npm run ci`** with the rest of Vitest, reading the site's
  sources, the capture registry and the committed images: the twins, the locale lists, the captures
  and their sign-off, the `:ui` keys, the headings, the seed, the Markdown plugin and the tracking
  scan's cases. `vitest.config.ts` names its tsconfig, because `site/tsconfig.json` extends a
  package installed only under `site/node_modules` (`tests/site/vitest-tsconfig.test.ts`).
- **`npm run site:check`** needs `npm run site:install` first and is not in `npm run ci`: the
  build with its links validator, then `site/scripts/check.mjs` (nothing loaded from another
  origin, every image in the build, the twins); `-- --release` also fails a page holding a pending
  `<!-- plan N: … -->` block. Run it after changing a page, the plugin or the captures.
- **The site needs a newer Node 22 than the app**: Astro sets the minimum, written in
  `site/package.json`'s `engines`, and `site/.npmrc`'s `engine-strict=true` makes `site:install`
  refuse an older one at once. The app's own `engines` is unchanged.
- **The site's TypeScript is in no gate**: `tsc -p site` is run by hand.
- **`npm run captures`** is not a check of the app and not part of `npm run ui-check`
  (`playwright.captures.config.ts` matches only `e2e/captures/captures.run.ts`); it needs
  `xvfb-run`, like `ui-check`.

## The hosted CI (2026-11-20)

The repository is public on GitHub Free, so its Actions run on free standard runners (4 vCPU,
16 GB). **Until the first official release every workflow runs only by hand**
(`workflow_dispatch`): no push, pull request or tag starts one, and `npm run ci` stays the gate
(the human, 2026-11-19, topic 72). `tests/scripts/workflows.test.ts` fails a workflow with any
other trigger; the first release turns the triggers on and changes that assertion with them.

| Workflow | What it runs |
|---|---|
| `.github/workflows/checks.yml` | Called by the others (`ref`, `base`): `ci` runs `npm run ci` with the three base variables above set from `base`; `e2e` runs `npm run ui-check` under Xvfb (4 workers, the default, until measured on the runner), keeping `test-results/` for 7 days on failure; `dco` runs `scripts/check-dco.mjs` over `base..HEAD` |
| `.github/workflows/pr.yml` | A branch against `origin/<base>` (by hand: the branch it is run on, `base` default `main`); drafts skipped and an older run of the same PR or ref cancelled, ready for when `pull_request` is added |

The release workflow checks its tag with `scripts/release-version.mjs` (the tag is `v` +
`package.json`'s version, no pre-release) and writes its notes with `scripts/release-notes.mjs`
(the version's section of `CHANGELOG.md`, the notes' only source; a release without one is
refused).

Every job runs on `ubuntu-24.04`, not `ubuntu-latest`: the label would move to a new Ubuntu with
no change in the tree, and pinned, the move is a reviewed change. Every action is pinned to a full
commit SHA with its version in a comment; Dependabot's weekly `github-actions` updates move them.
**No path filter on the PR jobs**: a required check that a filter skips stays "Expected — waiting"
and the PR cannot merge, and at one maintainer's PR volume the full run costs less than a filter
to maintain. The sign-off check is a script of ours rather than a DCO GitHub App, so nothing is
installed on the account. Workflows are linted locally with `actionlint` in a container
(`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -no-color`), since nothing
runs them before they are pushed.

## A long-lived branch (1.136, 1.160)

The multi-agent work is built on a branch that lives for weeks, `multi-agent`, in its own worktree
(`/home/hernan/git/menkar-multi-agent`), created by `set` from `main`. These rules hold while it
exists; they leave for their history when it merges for good.

- **Nobody checks out another branch in the shared tree.** The worktree has its own
  `node_modules` (`npm ci`, which rebuilds node-pty for Electron), `out/`, `release/` and
  `test-results/`.
- **One full `npm run ui-check` at a time across both trees**: they share the machine's CPU, and a
  session asks `set` before starting one while the other tree runs one.
- **Fixes flow in, never out.** A fix lands on `main` (and ships); `set` merges `main` into the
  branch. The branch's first phase merges into `main` early, with its own .deb, and the branch goes
  on from there.
- **The test-integrity baseline is the merge base** (`git merge-base main HEAD`), unless
  `MENKAR_TEST_BASELINE` names one. On `main` that is `HEAD`. On a branch that merged `main`, `main`
  itself would report each test line `main` removed and the merge brought in; the merge base
  reports only the lines the branch removed. `tests/scripts/check-test-integrity.test.ts` holds both
  cases.

### R10: what Claude and Cursor sessions get, byte for byte (2026-11-16)

Before any of it moves behind per-agent code, what Menkar gives the sessions it starts is recorded
under `tests/core/r10/`:

- **`tests/core/r10.test.ts`** (Vitest, file snapshots beside it): `buildCommand` for Claude new,
  resume and fork and for Cursor new and resume (`cursor-*`), each with the mode off and with a
  team file; the `--settings` file; the MCP server's `initialize` and `tools/list` replies; the
  plugin a Claude session is given (`plugin/skills/`, `plugin/guide/`, `plugin/team/common.md` and
  `claude.md`: the list and each file); the team block for every variant its own tests cover, at two
  ring thresholds, and its posts; `wakeFrame` and `WAKE_DELAY_MS`; `withoutSessionEnv` on a fixed
  environment; the folders watched and the sessions scanned with Claude alone and with Claude and
  Cursor; the usage cache directory's files after a pass.
- **`e2e/r10.spec.ts`** (expected bytes in `tests/core/r10/e2e/`): `startPaneHeld`'s assembly as
  the stand-ins record it, argv and environment, for Claude new, resume, fork and Remote Control and
  Cursor new and resume, the mode off and on. The environment is written as what the pane sets and
  what it strips relative to the main process's own; the run's paths, the pane's id and new
  session ids are placeholders. And, with the stand-in `claude` alone on the PATH, the set of the
  app's descendant processes and that none of them listens on TCP, Playwright's own two ports
  (the inspector and Chromium's DevTools) aside. A missing expected file fails; it is written only
  with `MENKAR_R10_WRITE=1`.

R10's files are left out of Biome (`biome.json`): they are recorded bytes, and a formatter would
rewrite the JSON and Markdown among them.

**R10 is written on `main` only, and guarded byte for byte.** `npm run ci` runs Vitest with
`CI=1`: Vitest 5.1.0 then writes no missing snapshot and fails on it instead (checked 2026-11-16).
Its "R10 unchanged" step compares every file under `tests/core/r10/` with `main`'s and fails on a
difference, a missing file or an added one; on `main` it compares nothing. So a change that alters
what a session gets is made on `main`, where `set` refreshes the files (`npx vitest run -u
tests/core/r10.test.ts`; `MENKAR_R10_WRITE=1` after deleting the e2e file that changed) and commits
them with the change, and reaches the branch with the next merge. The one planned exception, the
`cursor-*` files rewritten on the branch when Cursor's own phase changes its command, is not built:
that phase adds it to the step.

## Rejected

- **ESLint + Prettier**: two tools and two configs where Biome is one.
- **`node:test`**: Vitest's fake timers (the clock rules), watch mode and parallel runs.
- **A UI framework**: nothing needs one for a terminal; a feature plan can justify one.
- **webpack or Electron Forge**: electron-vite is lighter, and Vite is what the human's other
  projects use.
