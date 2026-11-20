# History of `docs/toolchain.md`

> Replaced 2026-11-10: e2e runs in parallel, each worker on its own X server. It was:
  retries and a trace only on a retry. `e2e/app.ts` launches with a temporary `HOME` and XDG set.

> Replaced 2026-11-16: the test-integrity baseline became the merge base of `main` and `HEAD`, for a
  long-lived branch that merges `main`. It was:
| `scripts/check-test-integrity.mjs` | Against `main` (or `MENKAR_TEST_BASELINE`): the number of test declarations in `tests/` and `e2e/` never goes down, and no `expect(` line is removed or rewritten. No override |
The test-integrity check compares against `main`, so on `main` itself it measures the uncommitted
work against the last commit. It writes both sides to temporary directories and diffs those:
`git diff <ref>` sees only tracked files, and a session's new tests are untracked until `set`
commits them.

> Replaced 2026-11-20: Biome also lints the public site's scripts and TypeScript. It was:
- **Biome** lints and formats, with `noExplicitAny` as an error. It looks only at code
  (`src/`, `tests/`, `e2e/`, `scripts/`, root configs), never at the Markdown documents.
