# History of `docs/spec/classifier.md`

## Which turns the hourly pass sends

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
- Only turns whose origin is `human` (the turn's `turnOrigin`, see `usage.md`), opened at or after
  `classify_since`, with no category yet and fewer than **3** failed tries.
- A turn is **ready** once its session has a later turn (of any origin), or once it is **more than
  3,600 s** old: until then the tools the agent used are not known. A turn not ready waits.
- Oldest first (by opening time, then id), in batches of **30**, at most **10 calls per pass**
  (300 turns); the rest waits for the next pass.
- **When:** right after each usage pass, i.e. on start and every hour (`usage.md`), only while the
  switch is on. The pass's result becomes `classify_last`.
- Before a batch is sent each turn's text is read from its transcript (below); a turn whose text
  cannot be read there (the transcript is gone, or the line at the recorded byte is not that turn)
  counts one try and is left out of the batch; a batch left empty is skipped.
- If `claude` is not on the `PATH`, the pass records a failure at once, whether or not anything was
  ready.
- Only one classification runs at a time (the hourly pass and "Classify earlier turns" share one
  lock). If an earlier-turns run holds it, the hourly pass is skipped silently (no record written).
- Classification runs in the background; it never holds up the usage pass or the window.

## What is sent for each turn

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
Each batch is one call. The standard input of the call is the line `Classify these turns:`
followed by a JSON array (non-ASCII characters kept as they are), one object per turn, in the
batch's order:

| Field | Value |
|---|---|
| `id` | the turn's index in the batch: 0, 1, 2… — **never the turn's uuid, the session's id or its name** |
| `previous` | the text of the previous human prompt of the same session, its first 300 characters; `""` when there is none |
| `prompt` | the turn's prompt, shaped as below |
| `tools` | one string: the tools the agent called, shaped as below |

**The prompt's text** is the text of the turn's opening `user` entry: `message.content` when it is
a string, else the `text` of its `text` blocks joined with a newline. Shaping, in order:

1. whitespace trimmed at both ends;
2. longer than 1,500 characters → its first 750 characters, a line `[...]`, its last 750
   characters (joined with newlines);
3. then, if shorter than 40 characters and there is a previous prompt → `previous: ` + the previous
   prompt's first 300 characters + a newline + `prompt: ` + the text.

**The previous prompt** is the opening line of the session's latest earlier turn whose origin is
`human` (earlier by opening time, ties broken by id).

**The tools** are the `tool_use` blocks of the `assistant` entries between the turn's opening line
and the next turn's opening line in the same file: the first 12, each as `<tool name>: <detail>`,
where the detail is the first non-empty of the call's `input.file_path`, `input.command`,
`input.pattern` (else empty), newlines replaced by spaces, cut to 70 characters; joined with `; `.
No tools → `(none)`. Tool results, the assistant's text and the tool's other inputs are never sent.

**Where the text comes from:** the usage cache records, for each turn, its transcript file and the
byte offset of its opening line (`usage.md`). The text is read from that byte to the next turn's
offset in the same file (or the end). If the first line read there is not a JSON object whose
`uuid` is the turn's, the turn's text is unavailable.

## The invocation

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
The command, with the batch text on standard input:

```
claude -p --model haiku --output-format json --tools "" --no-session-persistence \
  --strict-mcp-config --system-prompt "<the system prompt>"
```

| Part | Why |
|---|---|
| `claude` | found on the `PATH`; none → the run fails ("Could not run Claude") |
| `-p` | print mode: one answer, no interactive session |
| `--model haiku` | Claude Haiku |
| `--output-format json` | a JSON envelope whose `result` field holds the model's text |
| `--tools ""` | an empty tool list: the model can call no tool |
| `--no-session-persistence` | no transcript saved under `~/.claude/projects` |
| `--strict-mcp-config` | no MCP server from the user's configuration is loaded |
| `--system-prompt` | the classifier's own prompt, replacing Claude Code's |
| not `--bare` | it needs an API key and ignores the user's login |

- **Working directory:** the app's own folder `$XDG_DATA_HOME/menkar/classifier/`, created if
  missing and left empty, so `claude` runs nowhere near a project (no `CLAUDE.md`, no project
  settings).
- **Environment:** the app's environment **minus** `CLAUDECODE` and every variable whose name
  starts with `CLAUDE_CODE_` (so `claude` does not think it runs inside a session), **plus**
  `DISABLE_TELEMETRY=1`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
  `DISABLE_ERROR_REPORTING=1`.
- **Login:** the user's own (whatever `claude` uses); it counts against the user's plan.
- **Timeout:** 180 s per call.
- No session name, project name, path of the transcript or turn uuid is in the input.

## The system prompt

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
Eleven lines, kept **word for word** as agent-tablet has them (`agent_tablet/classify.py`,
`SYSTEM_PROMPT`): the measurements below are of that exact text, and rewording any line is a new
measurement (run the evaluation). Its structure:

1. **Role, one line:** it classifies turns of a developer's Claude Code sessions into one
   software-development stage.
2. **"Categories (exactly one per turn):"** then one line per category, `- <key>: <definition>`,
   in the order of the table above, with the definitions that table summarises (the definitions
   include the edge rules: review is `test`; documentation is `maintain`; `other` is
   acknowledgements and coordination with no task of their own — given three short quoted examples,
   "ok" and two Spanish phrases meaning "I made the commit" and "done" — and questions about the
   tooling).
3. **Context, one line:** the developer writes mostly in Spanish; classify by what the developer
   asks in `prompt`; `previous` is the developer's previous prompt (context for short ones);
   `tools` is what the assistant then did.
4. **Output, one line:** answer only a JSON array, one object per turn, in input order, each
   `{"id": <id>, "category": "<category>", "confidence": <0..1>}`.

Menkar uses that exact text (the measured prompt, read from agent-tablet's source when the feature
is built), or re-runs the evaluation for any other; the Spanish note is part of what was measured.

## Reading the answer

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
- The standard output is parsed as JSON and its `result` field taken as text. In that text, the
  span from the first `[` to the last `]` (across lines) is parsed as a JSON array.
- Each element that is an object with an integer `id` in `0 … batch size − 1` and a `category` that
  is one of the seven keys is accepted: that turn's category is written. `confidence` is ignored.
- Every turn of the batch without an accepted answer (missing id, unknown category, an element
  that is not an object, an unparseable output, no array at all) gets **one try** counted. After
  **3** tries a turn is no longer sent and stays unclassified.
- A **non-zero exit**, a **timeout**, or `claude` that **cannot be started** counts **no** try for
  anyone: the run stops there, the categories already written stay, the last 2,000 characters of
  stderr go to the log (with the exit code), and the run is recorded as failed.
- Each batch is written as soon as it comes back, so a stopped, crashed or interrupted run loses at
  most the batch in flight.
- Classification writes **only** a turn's `category` and `category_tries`; time, tokens and cost
  are identical whatever it does. Nothing is written to any transcript.

## Inheritance for turns the human did not start

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
A turn whose origin is not `human` (`peer`, `task_notification`, `system`, `sdk`, `unknown`) is
never sent by the hourly pass. When reported it **takes the category of its session's latest
`human` turn opened before it** (ties by opening time broken by id); with no such turn, or one not
classified yet, it is "Unclassified". This is resolved **when reported, never written**, so a late
classification reaches the turns after it with no second write. The statusline's exact cost
(`usage.md`) goes to the category of the turn in effect at the moment it was reported, resolved the
same way.

**Found in the code — a gap:** "Classify earlier turns" also sends `unknown` turns and writes their
category, but every report resolves a non-`human` turn by inheritance only, so an `unknown` turn's
own category is never shown: it reports its session's latest earlier `human` turn's category, which
in a transcript from before `turnOrigin` (where every turn is `unknown`) does not exist, so it shows
"Unclassified". Likewise its `previous` prompt is always empty (only `human` turns count as the
previous prompt). agent-tablet's docs say the earlier-turns run includes `unknown` turns, implying
they get a category in the report. Menkar must decide: report an `unknown` turn's own category when
it has one (and use earlier `unknown` turns as `previous`), or stop sending them.

## The evaluation (F44)

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
A developer tool, run by hand, never part of CI, that measures agreement of the app's classifier
with hand labels — to decide on a change of prompt or model.

- **Run:** a script given one or more label files, e.g.
  `eval/classifier/sample.json eval/classifier/silver.json`. With no arguments it prints its usage
  and exits with status 2; with no `claude` on the `PATH` it prints "claude is not on PATH." and
  exits 1.
- It uses **the app's own** input building, command and parsing, in batches of 30 (one call of the
  user's quota per 30 turns), from an empty folder: it points `XDG_DATA_HOME` at a fresh temporary
  directory so the user's data directory is untouched. If a call cannot run it prints
  "Could not run Claude (see the log)." and exits 1.
- **Output:** one line per file, `<file stem> <right>/<total> = <percent>%`; a line `all` over every
  file; a line `answered <n>/<total>` (turns with any accepted category); then, per category in the
  fixed order, `<category> recall <right>/<labelled as it> = <percent>%` ("nothing" when no turn is
  labelled with it). Percentages are rounded to whole numbers.
- **The label set holds the user's real prompts**, so `eval/` is git-ignored and deleted once
  evaluations are done; nothing of it goes into the repository or this spec.

**Results measured by agent-tablet** (its `docs/usage.md`, 2026-11-07), on 141 of the human's turns
labelled by hand (the human delegated the labels), 50 of them a random sample:

| Classifier | 50 random | All 141 | Most-confident half |
|---|---|---|---|
| Always `design` | 23% | — | — |
| `laya-multilingual`, CPU | — | 11–27% | not calibrated |
| Rules on the tools alone | abstain on 73; 19% of the rest | — | — |
| `multilingual-e5-small` + logistic regression, labels cleaned | 44% | 52% | 71% |
| Haiku through `claude -p` (the proof of concept) | 70% | 62% | 84% |
| Haiku with the app's code | 74% | 66% | — |

- Haiku's weak spot is `other`: 3–7 right of the 17 labelled `other` — it gives an acknowledgement
  the category of the work it continues.
- 141 turns took **5 calls and 68 s**, **US$0.021** as reported by Claude Code (plan quota on a
  subscription). The earlier-turns estimate uses exactly that rate (cost per turn 0.021 / 141,
  13.6 s per call).
- Decided from these numbers: no local model (`laya-multilingual` agreed less than always answering
  `design`, and its confidence did not separate right from wrong; the best local model reached 44%
  on random turns and needed a 0.5–4 GB download).

## The usage history (`$XDG_DATA_HOME/menkar/history.sqlite`, table `turns`)

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
| Column | Type | Meaning |
|---|---|---|
| `category` | TEXT, nullable | one of the seven keys; `NULL` = not classified (never inherited here) |
| `category_tries` | INTEGER NOT NULL DEFAULT 0 | failed tries; at 3 the turn is no longer sent |

Both are kept when the usage pass rewrites a turn's row (a turn re-read from its transcript keeps
its category and tries). Schema version 2 added them to version 1 (an `ALTER TABLE` migration in one
transaction); agent-tablet's history imported by Menkar already has them or is migrated the same
way (`usage.md` owns the history's opening rules). Other columns used here: `uuid`, `session_id`,
`origin`, `opened`.

## The usage cache (`$XDG_CACHE_HOME/menkar/usage.sqlite`, table `turns`)

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
Read only by the classifier: `uuid`, `file` (the transcript's path), `session_id`, `origin`,
`opened`, `offset` (byte where the turn's opening line starts). The next turn of the same file is
the smallest `offset` greater than the turn's.

## Transcript fields read

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
| Field | Use |
|---|---|
| `uuid` (opening line) | must equal the turn's uuid, else the text is unavailable |
| `message.content` (string, or blocks with `type: "text"` and `text`) | the prompt and the previous prompt |
| `type: "assistant"` entries' `message.content[]` blocks with `type: "tool_use"`, `name`, `input.file_path` / `input.command` / `input.pattern` | the tools line |

## The `claude -p` reply

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
`--output-format json` prints one JSON object; only its `result` (string) is read. Inside it, an
array of `{"id": int, "category": string, "confidence": number}` is expected (possibly surrounded by
other text or a code fence).

## The evaluation's label files

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
A JSON array of objects; the fields used: `prompt` (string), `prev_prompt` (string), `tools` (array
of objects with `name` and optionally `file_path`, `command`, `pattern` strings), `label` (one of
the seven keys). Other fields may be present and are ignored. agent-tablet's set: `sample.json`
(50 random turns) and `silver.json` (91 more), 141 in all.

## Constants

> Left on 2026-11-08: built by plan 10, described in `docs/classifier.md`.
| Name | Value |
|---|---|
| batch size | 30 turns |
| calls per hourly pass | 10 |
| tries before giving up | 3 |
| ready after (no later turn) | 3,600 s |
| call timeout | 180 s |
| cost per turn (estimate) | US$0.021 / 141 |
| seconds per call (estimate) | 68 / 5 = 13.6 |
| previous prompt cut | 300 characters |
| prompt cut | 1,500 (750 + 750) characters; "short" < 40 |
| tools | 12 calls, 70 characters each |
| stderr kept in the log | last 2,000 characters |
| earlier-turns default date | today − 7 days |

## Acceptance cases

> Left on 2026-11-08: built by plan 10; the Vitest tests carry these ids.
- **CLS-2** Turning the switch on at 10:00:00 → `state.json` `settings.classify_since` equals that
  moment's Unix time; turning it off → `null`; on again at 11:00 → the 11:00 value.
- **CLS-3** Switch on since 10:00; a human turn opened 09:59 and one at 10:01, both with a later
  turn in their sessions → the next pass sends only the 10:01 turn.
- **CLS-4** A human turn opened 30 minutes ago with no later turn in its session → not sent; the
  same turn 61 minutes after it opened → sent.
- **CLS-5** A `peer`, `task_notification`, `system` or `unknown` turn opened after
  `classify_since` → never in an hourly batch.
- **CLS-6** 350 ready turns → one pass makes 10 calls of 30 (300 turns) oldest first; the next pass
  sends the remaining 50 in 2 calls.
- **CLS-7** A batch's standard input starts with the line `Classify these turns:` and its array's
  objects have `id` 0…n−1; neither the turn uuids, the session id nor the session's name appears
  anywhere in the input.
- **CLS-8** A prompt of 2,000 characters → `prompt` is its first 750 characters, `\n[...]\n`, its
  last 750.
- **CLS-9** Prompt "ok, go on" (9 characters) whose previous human prompt is "Add a retry to the
  upload worker" → `prompt` is `previous: Add a retry to the upload worker\nprompt: ok, go on` and
  `previous` is the same previous prompt.
- **CLS-10** A turn whose assistant called Read on `/src/app/main.ts`, then Bash
  `npm test\n--watch=false` → `tools` is `Read: /src/app/main.ts; Bash: npm test --watch=false`.
  A turn with 15 tool calls lists the first 12. A turn with none → `(none)`.
- **CLS-11** A Bash command 200 characters long → its detail in `tools` is the first 70 characters.
- **CLS-12** The spawned process's argv is exactly `claude -p --model haiku --output-format json
  --tools "" --no-session-persistence --strict-mcp-config --system-prompt <prompt>`, its working
  directory `$XDG_DATA_HOME/menkar/classifier/` (created if missing), its environment has no
  `CLAUDECODE` and no `CLAUDE_CODE_*` other than `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, and
  has `DISABLE_TELEMETRY=1` and `DISABLE_ERROR_REPORTING=1`.
- **CLS-13** Reply `{"result": "[{\"id\":0,\"category\":\"build\",\"confidence\":0.9},{\"id\":1,
  \"category\":\"test\"}]"}` for a batch of 2 → turn 0 gets `build`, turn 1 `test`, no tries counted.
- **CLS-14** Reply whose `result` is "Here you go:\n```json\n[{\"id\":0,\"category\":\"plan\"}]\n```"
  → turn 0 gets `plan`.
- **CLS-15** Batch of 3; reply array has id 0 → `design`, id 1 → `refactor`, id 7 → `build`, and
  no id 2 → turn 0 gets `design`; turns 1 and 2 each get one try; id 7 is ignored.
- **CLS-16** `result` is not JSON-array text (e.g. "I cannot help") → every turn of the batch gets
  one try. A turn reaching 3 tries is never sent again and stays "Unclassified".
- **CLS-17** `claude` exits with status 1 on the second of three calls → the first batch's
  categories stay written, no try is counted for the second batch, the third is not sent,
  `classify_last` = `{"at": <now>, "classified": <first batch's count>, "failed": true}`, the
  stderr tail is logged, and the subtitle's second line reads
  "Could not run Claude (see the log) · HH:MM".
- **CLS-18** A call taking longer than 180 s → treated as CLS-17.
- **CLS-19** `claude` not on the `PATH`, switch on, nothing ready → after the hourly usage pass
  `classify_last.failed` is `true`.
- **CLS-20** A successful pass that classified 12 turns at 14:05 today → subtitle's second line
  "12 turns classified · 14:05"; viewed the next day → "12 turns classified · 2026-11-07 14:05"
  (the date of the run).
- **CLS-21** A ready human turn whose transcript was deleted → the hourly pass counts it one try
  and does not include it in the batch; the others of the chunk are still sent.
- **CLS-22** A session with human turn H1 (`build`) at 10:00, a `task_notification` turn T at
  10:20, human turn H2 (not yet classified) at 10:30, `peer` turn P at 10:40 → in a report T is
  `build`, P is "Unclassified"; once H2 gets `test`, P reports as `test` with no write to P's row.
- **CLS-23** A `peer` turn in a session with no human turn before it → "Unclassified".
- **CLS-24** The usage pass re-reads a classified turn (its transcript grew) → its `category` and
  `category_tries` are unchanged.
- **CLS-27** 9 turns to send, none unavailable → the line reads "Turns to send: 9", "Estimated use
  of your plan: under US$0.01", "Estimated time: under a minute, in the background", and the
  button "Classify 9 turns", enabled.
- **CLS-28** 300 turns to send → "Estimated use of your plan: US$0.04", "Estimated time: about
  2 min, in the background". 1,000 turns → "US$0.15", "about 8 min".
- **CLS-29** 40 turns to send and 5 whose transcripts are gone → an extra line "Left unclassified,
  their transcript is gone: 5"; the button reads "Classify 40 turns".
- **CLS-33** The earlier-turns count includes `unknown` turns and excludes turns with a category,
  turns with 3 tries, and the latest turn of a session that is under an hour old.
- **CLS-34** Confirming 75 turns → three calls (30, 30, 15); the row shows "Stop" and its subtitle
  goes "0 of 75", "30 of 75", "60 of 75", "75 of 75"; at the end the button returns and the switch's
  status line shows the run's count.
- **CLS-35** Stop pressed during the second call of a 5-call run → the second call's answers are
  written, no third call is made, `classify_last.failed` is `false`; running it again sends only the
  turns still without a category.
- **CLS-36** During an earlier-turns run a turn's transcript disappears → that turn is skipped with
  its `category_tries` unchanged.
- **CLS-37** An hourly pass starts while an earlier-turns run is going → it sends nothing and writes
  no `classify_last`; an earlier-turns run confirmed while an hourly pass is in flight starts its
  first call only after that pass ends, and never re-sends a turn that pass classified.
- **CLS-38** No file under `~/.claude/projects` is created by any classification call
  (`--no-session-persistence`), and no transcript is modified.
- **CLS-39** The evaluation run with no arguments → prints its usage, exit 2; with two files of 50
  and 91 records → prints a line per file stem, `all`, `answered`, and 7 recall lines; it makes
  ⌈50/30⌉ + ⌈91/30⌉ = 2 + 4 = 6 calls; the user's `$XDG_DATA_HOME/menkar/` is untouched.

## The switch (F42)

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
Preferences → page "Integrations" (icon: a puzzle piece, `application-x-addon-symbolic`) → a second
group titled **"Classify turns"**, under the "Claude Code settings" group of `context.md`.

- A switch row, title **"Classify each new turn by development stage"**, **off by default**.
  Its subtitle is always:
  "Each prompt you type from now on is sent to Claude Haiku with your login, with your previous
  prompt and the files and commands the agent used, and counts against your plan. The Usage window
  then splits each project by category."
  followed, on a second line, by the status of the last run when there is one (below).
- **Turning it on** stores the current time as `classify_since`; **turning it off** stores `null`.
  Turning it off and on again starts again from the new moment: turns opened while it was off are
  never sent by the hourly pass (only by "Classify earlier turns"). Off, nothing is sent and nothing
  runs; time, tokens and cost stay by project and session.
- The switch does not touch `~/.claude/settings.json`; unlike the status line row above it, it is
  the app's own setting.

**The status line** (second line of the subtitle), from the last run's record `classify_last`:

- success: "{count} turns classified · {when}" — `count` is how many turns that run got a category
  for (it can be 0);
- failure: "Could not run Claude (see the log) · {when}".

`{when}` is the run's local time as `HH:MM` when it is today (local date), otherwise
`YYYY-MM-DD HH:MM`. With no record (never ran) the line is absent. agent-tablet's `docs/usage.md`
quotes the failure text without " · {when}"; the code appends it.

## Classify earlier turns (F43)

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
Below the switch, a row titled **"Classify earlier turns"**, **visible only while the switch is
on**, with subtitle "Turns from before you turned it on, from a date you choose." and a button
**"Classify earlier turns…"** at its end.

1. The button opens a dialog: heading **"Classify earlier turns"**, body
   "Turns opened from this day on that have no category yet are sent to Claude Haiku.", a month
   calendar with **today minus 7 days** preselected, and under it a line with a spinner and
   "Counting turns…". Responses: **"Cancel"** (also Esc / closing) and a suggested button that
   reads **"Counting…"**, disabled, while counting.
2. Counting runs in the background for the selected day (from its local midnight to now):
   - which turns: origin `human` **or** `unknown` (transcripts from before Claude Code wrote
     `turnOrigin`), opened at or after that midnight, no category, fewer than 3 tries, and ready
     (as in the hourly pass: a later turn in the session, or older than an hour);
   - each is checked only against its transcript's **size**, never its text (reading thousands of
     turns made the dialog wait): a turn whose transcript is unknown to the cache, missing, or now
     no longer than the turn's recorded offset counts as **unavailable**; the rest are **to send**
     (agent-tablet's docs say only "whether each transcript is still there"; the code also counts
     a transcript cut shorter than the turn's offset).
3. When counting ends, the spinner hides, the line shows the estimate, one line each:
   - "Turns to send: {turns}"
   - "Estimated use of your plan: {cost}" — `turns × 0.021 / 141` US$, shown "under US$0.01" below
     one cent, else "US$" with two decimals (e.g. `US$0.04`);
   - "Estimated time: {took}, in the background" — calls = ⌈turns / 30⌉, seconds = calls × 68 / 5
     (13.6 s per call), minutes rounded to the nearest: "under a minute" when that is 0, else
     "about {minutes} min";
   - only when some are unavailable: "Left unclassified, their transcript is gone: {count}".

   The button reads **"Classify {count} turns"** and is enabled when turns to send > 0; with 0 it
   reads "Classify" and stays disabled. If the history or the cache cannot be read, the line reads
   "Could not read the usage history (see the log)." and the button stays disabled with "Classify".
4. Picking another day restarts counting (button back to "Counting…", disabled); a count that
   finishes for a day no longer selected is dropped.
5. **Confirming** starts the run at once in the background and closes the dialog. It waits for an
   hourly pass in flight, then re-reads what is still unclassified (so no turn is sent twice), and
   sends **all** of them in batches of 30, with **no** per-pass cap. A turn whose text can no longer
   be read when its batch is built is skipped **with no try counted**.
6. While it runs, the row's button is replaced by **"Stop"** and the subtitle shows
   **"{sent} of {total}"** (starting at "0 of N"; `sent` advances by each batch's size, the last
   step reaching `total`). Preferences re-reads the progress once a second while it is open; the run
   continues when Preferences is closed.
7. **Stop** ends the run after the call in flight; what was classified stays.
8. When the run ends (finished, stopped, or failed) its result becomes `classify_last` and the
   switch's status line updates ("{count} turns classified · {when}" or the failure line); the row
   returns to its button and its usual subtitle.
9. Running it again continues where it stopped: it only ever picks turns with no category.

Edge: turning the switch off during a run hides the row (and its Stop button) but does not stop the
run.

## Acceptance cases

> Left on 2026-11-08: built by plan 12; the tests in `e2e/integrations.spec.ts` carry these ids.
- **CLS-25** Switch off → the "Classify earlier turns" row is hidden; switch on → it shows with the
  button "Classify earlier turns…" and subtitle
  "Turns from before you turned it on, from a date you choose."
- **CLS-26** Opening the earlier-turns dialog on 2026-11-08 → the calendar's selected day is
  2026-11-01; while counting, the button reads "Counting…" and is disabled and the line reads
  "Counting turns…".

## The categories

> Left on 2026-11-08: built; `src/core/classifier/prompt.ts` holds the seven categories and their definitions.
Seven, in this fixed order (the order is used for display and for colors):

| Key | Shown as | Covers (as the prompt to Haiku defines it) |
|---|---|---|
| `plan` | "Plan" | deciding what to do next, priorities, scope, sequencing; launching or coordinating sessions; writing prompts for other sessions |
| `design` | "Design" | how something should work or why: UX, screens, business rules, architecture, data model, research, understanding a concept or the code |
| `build` | "Build" | writing or changing code, executing a plan, UI text or behaviour changes in the code |
| `test` | "Test" | testing, QA, trying the app, **code review** of a PR or branch, checking a merge broke nothing, a failing test or CI |
| `deploy` | "Deploy" | releases, release candidates, tags, changelog, installing or upgrading an environment, push |
| `maintain` | "Maintain" | production troubleshooting, incidents, customer problems on a running install, and **documentation** (guides, manuals, docs edits) |
| `other` | "Other" | acknowledgements and coordination with no task of its own, questions about the tooling |

A turn with no category is shown as "Unclassified" (its report label is `(unclassified)`).

## Settings (`$XDG_CONFIG_HOME/menkar/state.json`, under `settings`)

> Left on 2026-11-08: built; `src/core/classifier/settings.ts` reads and writes both keys.
| Key | Type | Default | Meaning |
|---|---|---|---|
| `classify_since` | number (Unix seconds) or `null` | absent = `null` | the moment the switch was last turned on; `null`/absent = off |
| `classify_last` | object or absent | absent | the last run: `{"at": <Unix seconds>, "classified": <int>, "failed": <bool>}` |

Both are imported from agent-tablet's `state.json` with the other settings (Menkar decision 1.8).
`usage --json` reads `classify_since` from `state.json` (read only) to decide whether to carry the
category level.

## Acceptance cases

> Left on 2026-11-08: every case built and tested; the tests in `tests/core/classifier/`, `tests/scripts/` and `e2e/integrations.spec.ts` carry the ids.
- CLS cases not listed below: built; the Vitest tests in `tests/core/classifier/` and `tests/scripts/` carry these ids.

- **CLS-1** Fresh install, no `classify_since` → the switch is off, the "Classify earlier turns"
  row is hidden, no `claude -p` is ever started, and the Usage report has no category level.
- **CLS-30** 0 turns to send → the button reads "Classify" and is disabled.
- **CLS-31** The history file cannot be opened while counting → "Could not read the usage history
  (see the log)." and the button disabled.
- **CLS-32** Picking day A then, before A's count returns, day B → only B's estimate is ever shown.

## Look

> Left on 2026-11-08: built in `src/renderer/integrations.ts` and the Usage window; the category colors are the Usage window's series colors (LOOK-50).
- `img/integrations-dark.png` (`img/integrations-light.png`): the Integrations page. The capture
  was taken at a width too narrow for the page's column, so its text wraps letter by letter — read
  it for the page's position (second page of Preferences, tab "Integrations" with a puzzle-piece
  icon next to "General" with a tools icon), not for the layout; it needs retaking wider.
- `img/classify-earlier-dark.png` (`img/classify-earlier-light.png`): the earlier-turns dialog over
  Preferences — heading centered and bold, body centered under it, a full-width month calendar
  (month and year each with ◀ ▶ arrows, weekday header Sun…Sat, days of adjacent months dimmed,
  the selected day filled with the accent color, today underlined), the three estimate lines
  left-aligned, and the two responses side by side at the bottom ("Cancel" plain, "Classify 9
  turns" in the accent color as the suggested response).
- `img/usage-by-category-dark.png` (`img/usage-by-category-light.png`): the Usage window's Totals
  with classification on: each project expands to category rows ("Unclassified" in the capture)
  indented one level, each expanding to its sessions indented a second level.

Measurable details:

- The Preferences group "Classify turns" is a standard preferences group: a switch row (title, a
  multi-line dim subtitle: the explanation, then the status line), then an action row whose
  suffix is the button "Classify earlier turns…" or, while running, the button "Stop" (both
  vertically centered, regular buttons).
- The dialog's extra content: vertical box, spacing 12 px: the calendar, then a row (spacing 8 px)
  of a spinner aligned to the top and the wrapping, left-aligned estimate text (one line per item).
- **Category colors** (the same everywhere a category is drawn: chart segments, legend swatches;
  from agent-tablet's Usage window; validated for color-vision deficiencies against light and dark
  view backgrounds):

  | Category | Light | Dark |
  |---|---|---|
  | plan | `#2a78d6` (blue) | `#3987e5` |
  | design | `#eb6834` (orange) | `#d95926` |
  | build | `#1baf7a` (green) | `#199e70` |
  | test | `#eda100` (amber) | `#c98500` |
  | deploy | `#e87ba4` (pink) | `#d55181` |
  | maintain | `#008300` (dark green) | `#008300` |
  | other | `#6250d6` (violet) | `#9085e9` |
  | Unclassified | `#8a8986` (gray) | `#8f8e8a` |

  A category keeps its color in every period. Categories are listed in the fixed order above,
  "Unclassified" last.
- While the switch is off, the Usage window shows a dim, wrapping hint:
  "Turn on “Classify turns” in Preferences → Integrations to split each project by category."
  (layout and the `[Project | Category]` stack switch: `usage.md`).

## Classifier — turns by development stage

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
classification are repeated here briefly so the contract is in one place. Source decisions:
agent-tablet's `plans/00-STATUS.md` 1.20, 1.21, 1.23, 1.25.
