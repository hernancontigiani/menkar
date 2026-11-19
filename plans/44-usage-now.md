# 44 — `menkar usage now --json`: the burst in progress, for the human's own service

> **Status:** written, 2026-11-19, by `menkar-t118` (task 118). Not executed. Three decisions
> for the human (D1–D3, below) change details of blocks 3–4, not the shape; the blocks are
> written with the recommended options.
>
> **Comes from:** decision 1.185 (the human, 2026-11-19, topic 65): Menkar does not alert; it
> exposes the burst in progress through one documented command, for the human's own service,
> which polls it (about once a minute) and keeps its own thresholds and snooze.
>
> **Exit when executed:**
> - What the user runs → `README.md`, "Usage in the terminal": one example line and one sentence
>   (block 5).
> - How `now` reads, its schema, what was rejected and why, its measured cost and its limits →
>   `docs/usage.md`, a new subsection "The burst in progress (`menkar usage now`)" under "The
>   human's activity and the task flow" (block 5). Two recorded lines change there: "Where it is
>   stored" point 4 ("never the live journal, which the running app owns") and the limit "Up to an
>   hour late outside the Usage window"; their old text goes verbatim to `docs/history/usage.md`
>   in the same change.
> - Concurrent openers re-check the version inside the transaction → one sentence in
>   `docs/usage.md`, "The shape" (block 1's why: an outside poller opens the cache and the history
>   every minute beside the app).
> - The USG ids of the new tests → `docs/spec/usage.md`, "`menkar usage` (F41)" (block 5).
> - `docs/NOT_BUILT_YET.md` "A nudge after a long burst of the human's activity": its trigger fired
>   and 1.185 answered it (no nudge in Menkar); the entry leaves for
>   `docs/history/NOT_BUILT_YET.md`, verbatim. New entries there: the text form (if D1 is B), a
>   `--project` scope (D3), and reading the journal on Windows while the app renames it (block 5).
> - `plans/00-STATUS.md`: 1.185's "Where it lives" becomes `docs/usage.md` (`set`, at closing).
> - The rest (the measurement's numbers beyond the one table, the block order) → `git log`.
>
> **Replaces or modifies:** no plan. It amends two lines of `docs/usage.md` (above); no decision.

---

## 1. Goal, and what already exists

**Goal.** One command, `menkar usage now --json`, that prints **one JSON object** with a schema
version: the human's burst in progress (start, length, last action) or none, whether they are away,
the last action, and today's active time — all from the one definition of a burst in
`src/core/usage/bursts.ts`, **with the live journal included** (1.185: "it reads the live journal
before answering, as the Usage window does"). Cheap enough to run every minute; never writes the
journal.

**What exists, verified in the tree on 2026-11-19:**

- `menkar usage` runs in Electron's main process before `ready`, with no single-instance lock and
  no window (`src/main/index.ts:194`, `runUsageCommand` in `src/main/usage.ts:62`), so it runs the
  same whether the app runs or not. `runUsageCli` (`src/core/usage/cli.ts:433`) dispatches
  `export` on `argv[0]`; `now` is today an "unrecognized argument" (exit 2), so the word is free.
- Every `menkar usage` command runs a pass first (`runPass`, `src/core/usage/pass.ts:17`) and
  imports the **batches** the app set aside (`importLeftActivity`, `cli.ts:322`), **never the
  live journal** (`docs/usage.md:300–301`).
- The bursts: `readActivity(source, bounds, now)` (`bursts.ts:228`) reads a day on each side of
  `bounds` and widens while a burst touches the edge; `activityDay` (`bursts.ts:188`) gives a day's
  clipped bursts, `burstSeconds`, `messages`, `prompts`, `away`; `awayPeriods` and `bursts` are
  exported. `ActivitySource` is one method, `humanActions(low, high, project?)` (`bursts.ts:217`).
- `UsageHistory.humanActions` (`history.ts:692`) returns the rows **without ids**: messages from
  `turns`, actions and presence from `activity` (with the last presence row before `low`), and
  prompted starts joined to their session's first turn at or after them.
- The journal: main appends one JSON line per event to `<data>/activity/journal.jsonl` through one
  promise chain (`src/main/activity.ts:60`); after each pass `importActivity` renames it to
  `batch-<stamp>-<random>.jsonl` (`rotate`, `activity.ts:73`) and a worker imports every batch
  (`importBatch`, `src/core/usage/activity.ts:150`: one transaction, `INSERT OR IGNORE` by id,
  **then** `unlinkSync`). `parseJournalLine` (`activity.ts:105`) returns an event, `'bad'` (a torn
  line) or `'newer'`.
- `isoLocal` (`src/core/usage/report.ts:217`) is the export's local time with offset.
- Whether the app runs: `menkarAlive()` (`src/core/control/files.ts:100`), async, reads
  `<cache>/control/alive.json` (written by `startControl`, `src/main/control.ts:54`, removed at
  quit) and probes its pid with signal 0.
- `openDb` transactions are `BEGIN IMMEDIATE` (`src/core/db.ts:21`); the cache and the history
  open with a 30 s busy timeout. `UsageHistory`'s constructor reads `user_version` **outside** the
  migration transaction (`history.ts:184–213`); migration 3 was made idempotent for exactly the
  race of two openers (`history.ts:66`, test `history.test.ts:197–209`), migrations 1 and 2 and
  the version-0 creation were not. `UsageCache` checks its schema outside the rebuild transaction
  (`cache.ts:97–126`).

## 2. The design

### 2.1 How `now` sees the live journal — read only, beside the history

`now` runs the pass (as every `menkar usage` does), opens the history, and **reads the journal
and the batches without moving or importing them**, overlaying their events on the history's rows
in memory. Nothing in `<data>/activity/` is renamed, written or deleted by `now`.

**The order of reads is what makes it correct while the app rotates and imports:** first the
journal, then the batches' listing and contents, then the history. An event only ever moves
journal → batch (rename) → history (import commits, *then* the batch is unlinked). Whatever was in
the journal when it was read is caught; if it had already left, it was in a batch or the history
at that moment, and a batch read after it either still has it or was unlinked only after its rows
committed, so the history read after that has it. A batch that disappears between the listing and
its read (`ENOENT`) was imported. Duplicates (an event both read from a file and already in the
history) are dropped by id.

- **Events read from the files** are kept by id (`Map`), skipping `'bad'` lines (a torn last line
  while the app appends — silently: polled every minute, a warning would fill the log) and
  `'newer'` ones (a newer Menkar's).
- **Which of those the history already holds**: one query, `UsageHistory.knownActivityIds(ids)`
  (`SELECT id FROM activity WHERE id IN (SELECT value FROM json_each(?))`), so `humanActions` keeps
  its shape.
- **The overlay** (`withJournal(history, events)`, an `ActivitySource`) returns the history's
  `humanActions(low, high)` plus the file events not known to it: `prompt_answered`,
  `topic_discussed`, `topic_closed`, `present` into `actions`; `away`, `back`, `app_start` into
  `presence` — in `[low, high)`, and **for the one row before `low`, the latest of the history's
  and the files'** (a journal a quit left days ago can hold the `away` that is still open);
  `prompted_start` into `promptedStarts`, its first turn found by
  `UsageHistory.firstTurnAt(sessionId, at)` (the same subquery `humanActions` uses). Messages come
  only from the history: the pass just brought them. `task_state` lines are ignored. No project
  scope (D3).

**Rejected, and why:**

- **Asking the running app** (a control request; the app runs `historyUpToNow` and answers). Two
  paths, one with the app and one without it; it makes the app rotate the journal and start an
  import worker every minute — the pattern already rejected as "a timer of its own" (12 history
  opens an hour, racing the start's pass on the migration; `docs/usage.md:314`), here 60 an hour;
  and 1.185 says no local server.
- **`now` rotating and importing the journal itself**: the journal has one writer, the app's
  promise chain; a rename from another process lands between the app's `stat` and `rename`
  (`rotate`) and logs a failure there, and on Windows renaming a file another process appends to is
  not dependable. It would also write the history's activity every minute for a read.
- **No pass, only the journal** (cheaper by ~50 ms): the human's messages reach the history only
  through a pass, so a burst made of messages sent through Remote Control, and the first-turn
  correction of a prompted start, would lag up to an hour. Presence marks cover typing in a
  focused window, not the rest; 1.185 names the one definition of a burst, which counts messages.
- **Importing the batches as the other commands do** (`importLeftActivity`): the overlay reads
  them anyway, and `now` stays a reader of the activity directory.

### 2.2 What it prints — `schema` 1

One JSON object, pretty-printed as `menkar usage --json` prints (`JSON.stringify(v, null, 2)`),
on standard output. `schema` changes only when a field changes meaning or goes away, never when one
is added (the export's rule, `docs/usage.md:358–359`). Times are **whole Unix seconds**
(`Math.floor`) with the same moment as local ISO with offset (`isoLocal`); my choice, because
the service compares them with its own clock and a fraction of a second means nothing to a break.

| Field | What it holds |
|---|---|
| `schema` | 1 |
| `status` | `ok`, `history_too_new` or `history_unavailable`; on anything but `ok`, the object holds only `schema`, `status`, `now`, `now_epoch` |
| `now`, `now_epoch` | The moment the reading was made (`src/core/clock.ts`) |
| `menkar_running` | Whether a Menkar app runs now (`alive.json`'s pid answers); D2 |
| `away` | `null`, or `{ "since", "since_epoch" }` when the human is away now: the open away period's start (one with no `back` and no `app_start` after it runs to now, `awayPeriods`) |
| `last_action` | `null`, or `{ "at", "at_epoch" }`: the latest of the human's actions counted (outside away) in the rows read (from yesterday's local midnight at least) |
| `burst` | `null`, or the burst in progress: `{ "start", "start_epoch", "last_action", "last_action_epoch", "length_seconds", "messages", "prompts" }` |
| `today` | `{ "active_seconds", "messages", "prompts" }`: today's `activityDay` — `burstSeconds`, its messages and prompts answered, outside away |

- **The burst in progress** is the last burst of `bursts(humanActionsOf(rows), away)` when the
  human is not away now and `now - burst.end <= BURST_GAP_SECONDS`; otherwise `null`. A burst is in
  progress until the gap that would end it has passed, the same 10 minutes that define it. While
  away there is none: an away ends a burst.
- **`length_seconds` is `last_action − start`**, the burst as Menkar defines it (its `end` is its
  last action). The service has `now` to compute `now − start` if it prefers; my choice, not to
  invent a second length.
- **A burst crossing midnight** is whole in `burst` (its start yesterday), and only its part since
  midnight counts in `today.active_seconds` (`activityDay` clips, `bursts.ts:161`).
- **Scope: every project** (away is every project's already). D3.
- **Never in it**: a project, a session, a name, a path, any text.

Exit codes: `0` with `status: ok`; `1` with `history_too_new` (the history is from a newer
Menkar: nothing read, the batches left as they are) or `history_unavailable` (the history cannot be
opened, `usage.cli.cannotOpen` on standard error); `2` for a bad argument, with the usage line on
standard error and nothing on standard output. A **failed pass** (a busy history past its timeout,
a full disk) prints `usage.cli.passFailed` on standard error and answers from what the history has,
`status: ok`, as the other commands do. An unreadable (damaged) history is moved aside and a new
one created by `UsageHistory`'s constructor, as for every opener — the rule of `AGENTS.md`, not a
new behaviour; `now` then answers from the journal alone.

### 2.3 When the app is not running

The same reading: the journal a quit or a crash left, and any batch, are read as they are (the next
start sets them aside and imports them). `menkar_running` is `false`. With the app quit, no action
is recorded, so no burst can be in progress more than 10 minutes after the last one; an away left
open runs to now, as `awayPeriods` reads it ("away is not kept across a quit, so a start ends it",
`bursts.ts:57`: only a start ends it).

`menkar_running` is read **synchronously** from `alive.json` (the CLI path is synchronous): the
pid check of `menkarAlive` moves into one sync function both use (`src/core/control/files.ts`),
so they cannot disagree. A crashed app's stale file reads `false` (the pid is gone). **Rejected:**
taking Electron's single-instance lock to test for a running app — while `now` held it, an app
being started would think another instance runs and exit.

### 2.4 Concurrent openers (block 1)

A poller opens the cache and the history every minute beside the app's worker, so "two openers"
stops being rare. `BEGIN IMMEDIATE` and the busy timeout already serialize the writes; what is not
safe is **acting on a version read before the lock**: two openers of a version-N history both run
step N, the second on an already migrated file; two openers of a cache with an old schema both
rebuild, and the second drops what the first's pass ingested. The fix: **inside the transaction,
re-read the version and skip the step when it has moved** — for each history migration, the
version-0 creation, and the cache rebuild. Migration 3's own idempotence stays (harmless).

### 2.5 Cost per call — measured 2026-11-19

On a **copy** of the human's data (339 transcripts, 2.8 GB; cache 126 MB; history 8 MB), in a
throwaway home, Node 22.21, the built `/opt/Menkar` binary for the process:

| Step | Time |
|---|---|
| A pass with nothing new (`runPass`) | 51–52 ms |
| A pass after one transcript grew by 5 lines | 77 ms |
| Read-only reading (open the history, `readActivity` for today, `activityDay`, `bursts`), journal of 120 lines | 47–49 ms |
| The same, journal of 5,000 lines | 52–55 ms |
| The whole `menkar usage --period today --json` process (Electron start, pass, report, exit), warm | 0.26 s wall, 125 MB peak RSS |

So `now` costs about **0.3 s and 125 MB for a moment, once a minute**. The journal's size does not
matter (an hour holds ~60 presence marks; 5,000 lines add 5 ms). The worst case is **waiting**: the
pass waits up to the busy timeout (30 s) when the app's own pass holds the cache — normally under a
second, but the start's catch-up after a long time off can take tens of seconds (a full re-read of
this volume took 29 s, when the copy changed every inode). Then the history open can wait as long
again. The service gives the command a timeout of a minute or more, or skips a poll; `docs/usage.md`
says so. Block 4 re-measures with the built command and records it.

### 2.6 Product decisions the code must hold, and their tests

Each sentence goes in its test's comment; each test is written in its block before the code.

| Decision | Test (block) | The case |
|---|---|---|
| `now` never writes the activity directory | `now.test.ts` "USG-69 …" (2) — §2.10-style rows | journal, one `batch-*`, one `newer-*`: after a reading, each keeps its bytes and mtime and the directory its listing |
| An event is counted once wherever it is read | `now.test.ts` (2) | one id in the journal and in the history's `activity`: one action |
| The files' events join the history's | `now.test.ts` (2) | history: away at day−3 10:00 absent, back at day−4; journal: `away` at day−3 10:00 → away since day−3 10:00 |
| A torn last line is skipped, nothing printed | `now.test.ts` (2) | journal ending in `{"v":1,"id":"x","at":` → no throw, no `err` output |
| A prompted start in the journal still drops its first turn | `now.test.ts` (2) | `prompted_start` s1 at 10:00 in the journal, s1's turn of origin human at 10:00:05 in the history → not a message |
| The seeded reading prints exactly | `now.test.ts` "USG-70" (3) | below, §2.7 |
| Away now: no burst, `away.since` | `now.test.ts` "USG-71" (3) | actions to 14:58, `away` 15:00, now 15:42 → `burst: null`, `away.since_epoch` 15:00, `last_action` 14:58 |
| Back after away starts a new burst | `now.test.ts` (3) | … then `back` 15:41 and `present` 15:41 → burst start 15:41, `length_seconds` 0 |
| A burst crossing midnight is whole; today counts its part | `now.test.ts` "USG-72" (3) | actions 23:30, 23:39, 23:48, 23:57, 00:06, 00:15, 00:20; now 00:25 → `start_epoch` 1795141800, `last_action_epoch` 1795144800, `length_seconds` 3000, `today.active_seconds` 1200 |
| Past the gap the burst is over | `now.test.ts` (3) | last action 15:31:59, now 15:42:00 → `burst: null`; at 15:42:00 with last action 15:32:00 → in progress |
| A restart does not end a burst | `now.test.ts` (3) | actions every 9 min from 14:30 to 15:30, `app_start` 15:33, `present` 15:36 → one burst 14:30–15:36 |
| A clock set back gives no negative field | `now.test.ts` (3) | last action at now + 120 s → burst in progress, `length_seconds` ≥ 0 |
| The keys are exactly the schema's | `now.test.ts` (3) | the top-level keys and `burst`'s, `away`'s, `today`'s, against the table of §2.2 |
| A newer history: `history_too_new`, exit 1, batches untouched | `cli.test.ts` "USG-73" (4) | `user_version` 99 |
| An unopenable history: `history_unavailable`, exit 1 | `cli.test.ts` (4) | the history path is a directory |
| Without `--json` (D1) / a bad argument: exit 2, nothing on stdout | `cli.test.ts` (4) | `usage now`, `usage now --period today` |
| `menkar_running` follows `alive.json` | `control/files` test (4) | no file → false; own pid → true; a pid that does not exist → false |
| Two openers of an old history both succeed, one migration each | `history.test.ts` (1) | a version-1 file; the step re-run with the version already moved: no throw, version unchanged |
| A cache rebuilt by another opener is not rebuilt again | cache test (1) | schema already current when the transaction starts: rows kept |

### 2.7 The seeded case (USG-70)

`TZ=America/Argentina/Buenos_Aires` (UTC−3, no daylight saving), the clock at
**2026-11-19 15:42:00** (`now_epoch` 1795113720), `alive.json` absent.

- History: human turns at 09:00 and 10:00 with presence marks every 9 minutes between them; human
  turns at 14:30:00 and 14:55:00.
- Journal: `present` at 14:31, 14:40, 14:50, 15:00, 15:10, 15:20, 15:30, 15:40; `prompt_answered`
  at 15:35; `topic_discussed` at 15:38.

Expected: `status: ok`, `menkar_running: false`, `away: null`, `last_action` 15:40:00
(1795113600), `burst` start 14:30:00 (1795109400), last action 15:40:00, `length_seconds` 4200,
`messages` 2, `prompts` 1; `today` `active_seconds` 7800, `messages` 4, `prompts` 1. The test
holds the whole printed text.

## 3. Out of scope

- Any alert, notification, threshold or snooze in Menkar (1.185).
- A local server, a socket, or the journal's format as an interface (1.185).
- A `--project` scope (D3), a text form unless D1 says so, any period other than now and today.
- Changing the definition of a burst, the 10-minute gap, or what counts as an action.
- A shorter busy timeout for `now`'s pass (deferred with the waiting it would cut; §2.5).
- Windows and macOS: Linux is checked; reading the journal on Windows while the app renames it is
  an entry in `docs/NOT_BUILT_YET.md` (block 5).

## 4. Do not touch

- The journal's writer and its rotation (`src/main/activity.ts`), `importBatch`, the batches'
  naming: `now` only reads.
- `UsageHistory.humanActions`'s shape and SQL, `readActivity`, `activityDay`, `bursts`,
  `awayPeriods` (Your time reads them): `now` composes them, it does not change them.
- The existing `menkar usage`, `--json` and `export` outputs and their tests.
- The human's data and running Menkar: every measurement on a copy or synthetic data, the built
  command run with `env -i` and a throwaway `HOME` and `XDG_*`.

## 5. Decisions for the human

**Decided by the human, 2026-11-19 (topic 66): D1 (a), D2 (a), D3 (a)**, the recommended ones. Block 1 (concurrent openers) accepted by `set` the same day.

**D1 — Without `--json`.** (a) **`--json` is required**: `menkar usage now` alone prints the usage
line and exits 2; a text form is an entry in `docs/NOT_BUILT_YET.md` with its trigger (the human
wants to read it by eye). (b) A short text form of the same facts ("Burst: 1 h 10 min since 14:30 ·
today 2 h 10 min"), translated, needing new strings in both catalogs. **Recommended: (a)** — 1.185
names one command for a service; the JSON reads well enough with `jq`, and the plan stays small.

**D2 — `menkar_running`.** (a) **Include it** (§2.3), so the service tells "no activity" from
"Menkar is closed" and can say so or fall back to its other sources. (b) Leave it out; the service
infers it from `last_action`'s age. **Recommended: (a)** — a closed Menkar and a quiet human look
the same otherwise, and the check is one small read.

**D3 — Scope.** (a) **Every project, no flag** (away is already every project's; a break is the
human's, not a project's). (b) A `--project NAME` as the export has. **Recommended: (a)**, with
(b) in `docs/NOT_BUILT_YET.md`, trigger: the human's service asks for one project's burst.

## 6. Execution blocks

Each block leaves `npm run ci` green, and is small enough for one worker. Blocks 1 and 2 share no
file and may run in parallel; 3 needs 2; 4 needs 3; 5 last. No block changes the UI, so no
`npm run ui-check`.

### Block 1 — Concurrent openers re-check the version

Files: `src/core/usage/history.ts`, `src/core/usage/cache.ts`, `tests/core/usage/history.test.ts`,
a new `tests/core/usage/cache.test.ts`.

- [ ] Tests first (§2.6's last two rows); see each fail against the current code.
- [ ] `UsageHistory`'s constructor: the version-0 creation and each migration step re-read
  `user_version` inside their transaction and do nothing when it is no longer the one read.
- [ ] `UsageCache`: the rebuild re-reads the schema inside its transaction and returns when it is
  current.
- [ ] Verify: `npm run ci`; the existing migration tests (`history.test.ts:167–240`) unchanged.

### Block 2 — Reading the journal read only, and the overlay

Files: `src/core/usage/activity.ts` (`readJournal(dir)`), `src/core/usage/history.ts`
(`knownActivityIds`, `firstTurnAt`), a new `src/core/usage/now.ts` (`withJournal`), a new
`tests/core/usage/now.test.ts`. If block 1 runs at the same time, it holds `history.ts`: block 2
waits for it or the two are given to one worker.

- [ ] Tests first: §2.6's rows marked (2), with USG-69 the no-write rows (every file under the activity
  directory keeps its bytes and mtime, and the directory its listing); see each fail once against an injected defect (e.g. reading
  the history before the journal, or a rename left in).
- [ ] `readJournal(dir)`: the journal, then the batches by `batchFiles`, each read whole with
  `readFileSync`, `ENOENT` skipped; events by id; `'bad'` and `'newer'` counted, not logged.
- [ ] `knownActivityIds(ids)`: one statement with `json_each`; `firstTurnAt(sessionId, at)`: the
  subquery of `humanActions` (`history.ts:733–734`), shared, not copied.
- [ ] `withJournal(history, events)`: §2.1's overlay, the reads in the order journal → batches →
  history.
- [ ] Verify: `npm run ci`.

### Block 3 — The reading and its JSON

Files: `src/core/usage/now.ts` (`readNow(source, nowSeconds, running)` → the schema-1 object),
`tests/core/usage/now.test.ts`.

- [ ] Tests first: §2.6's rows marked (3), USG-70 (§2.7, the whole text), USG-71, USG-72, with
  `TZ=America/Argentina/Buenos_Aires` and fake `Date` as `cli.test.ts` does; see the burst-in-
  progress test fail with the gap check off by one (`<` for `<=`).
- [ ] `readNow`: `readActivity(source, periodBounds('today', now), now)`, then `awayPeriods`,
  `humanActionsOf`, `bursts` and `activityDay` on the same rows; §2.2's fields, whole seconds,
  `isoLocal`. No new definition of a burst: only `BURST_GAP_SECONDS` and the functions above.
- [ ] Verify: `npm run ci`.

### Block 4 — The command

Files: `src/core/usage/cli.ts` (`now` dispatched on `argv[0]`, its parser, `CliDeps.running?:
() => boolean`), `src/core/control/files.ts` (the sync alive check, the async one built on it),
`src/core/i18n/en.ts` and `es.ts` (the `now` usage line only), `tests/core/usage/cli.test.ts`, the
test that covers `src/core/control/files.ts`.

- [ ] Tests first: §2.6's rows marked (4), USG-73.
- [ ] `runNow`: parse (`--json` required under D1 (a); `--help`), `runPass` (failure → stderr,
  go on), open the history (`tooNew` → `history_too_new`, exit 1; a throw → stderr `cannotOpen`,
  `history_unavailable`, exit 1), `readJournal`, `withJournal`, `readNow`, print, close. No
  `importLeftActivity`.
- [ ] Verify: `npm run ci`; then `npm run build` and, against a **throwaway** home (synthetic
  transcripts and journal, `env -i HOME=… XDG_DATA_HOME=… XDG_CACHE_HOME=… XDG_CONFIG_HOME=…`), run
  the built app's `usage now --json` three times: record the output, the wall time and peak RSS
  (`/usr/bin/time -f '%e s %M KB'`) in the execution log; and check the throwaway activity
  directory's listing and mtimes are unchanged.

### Block 5 — Documents

Files: `docs/usage.md`, `docs/history/usage.md`, `README.md`, `docs/spec/usage.md`,
`docs/NOT_BUILT_YET.md`, `docs/history/NOT_BUILT_YET.md`.

- [ ] `docs/usage.md`: the new subsection (§2.1's reading and its rejections, §2.2's table and
  exit codes, §2.3, §2.5's table and the advice on the service's timeout); "Where it is stored"
  point 4 and the "Up to an hour late" limit rewritten in the present; one sentence in "The shape"
  for §2.4. The old lines verbatim to `docs/history/usage.md` under their section headings.
- [ ] `README.md`: `menkar usage now --json  # the burst in progress, for a break reminder of
  your own` and one sentence that Menkar itself never alerts.
- [ ] `docs/spec/usage.md`: F41 names `now` and USG-69–73.
- [ ] `docs/NOT_BUILT_YET.md`: the nudge entry to history; new entries for D1 (b) if (a), D3 (b),
  and Windows' journal read, each with its trigger.
- [ ] Verify: `npm run ci` (the history check passes).

## 7. Execution log

*(Written by the session that executes it.)*
