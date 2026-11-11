# History of `docs/context.md`

> Replaced 2026-11-10: Preferences became the Settings window. It was:
  1–100, yellow below red) when `state.json` is read and when Preferences saves one; anything else
  Preferences shows at once. The agent-tablet import has no such settings, so they start at the

## The shape

> Left on 2026-11-10: replay removed from Menkar (decision 1.33).
    `cleanupPeriodDays` says otherwise, and with it go the replay, the details and the

## The shape (the cost since the last compaction)

> Left on 2026-11-11: the hook also kept for `resume` and `clear`, its record naming the pane, so a tab follows a cleared or resumed session (decisions 1.56, 1.57).
  - **The hook.** The `--settings` file also declares a SessionStart hook, two entries, matchers
    `startup` and `compact`. Its command is the statusline's own, with the argument
    `session-start` (`sessionStartHooks` in `settings.ts`). Checked in Claude Code 2.1.322's
    binary: the hook's stdin carries `session_id` and `source` (one of `startup`, `resume`,
    `clear`, `compact` or `fork`), and the matcher is compared with `source`.
  - **The record.** The hook writes `<cache>/session-starts/<id>.json` (`session_id`, `source`,
    `at`). It is not under `sessions/`, which main watches for readings.
  - **The baseline.** On its next run the statusline sees a record it has not used and keeps a
    baseline in `<cache>/cost-baselines/<id>.json` (`baseline_usd`, `start_at`): 0 after
    `startup`, the current total after `compact`. A resume leaves it, so the count goes on from the
    last compaction.
  - **Unknown.** `clear` and `fork` are not kept: whether their total starts again is not
    Menkar's to know. A session first seen with no record is taken as new when its total is below a
    cent, and otherwise as unknown, so its bar shows the total alone until it compacts. That covers
    sessions started outside Menkar, and those whose last compaction came before this.
