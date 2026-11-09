# History of `docs/spec/context.md`

## Where the reading comes from

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
**Where the reading comes from**, for one session (its id and its transcript path):

1. Read the session file `sessions/<session_id>.json` that Menkar's statusline left in the cache
   directory (Data contracts). Missing, unreadable or not a JSON object → no report.
2. Find the transcript's **last assistant message**: read the last 256 KiB of the transcript,
   drop the first (cut) line of that tail, and walk the lines from the end; the first line that is
   an entry with `"type": "assistant"`, a `message.usage` object and a parseable `timestamp` gives
   the tokens in the window — `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`
   (missing or null counted as 0) — and when it was written. If the tail has none, read the whole
   file the same way. Unreadable transcript → no message.
3. **The report wins when it is fresh**: the report's `percentage` is a number, its `updated_at`
   parses, and either there is no last assistant message or `updated_at` is at or after that
   message's timestamp. Then the reading is the report's percentage, source "statusline".
4. **Otherwise the estimate**: if there is a last assistant message, percentage =
   `100 × tokens / window`, rounded to one decimal, source "estimate". With no message, no reading.
5. **The window** used in either case (and shown in the tooltip) is the report's `window` when it
   is an integer above 0, otherwise **200,000**. The transcript never says the window's size, so a
   1M-token session that never reported is estimated over 200k and reads five times too full — the
   ring says "estimate" for this reason.

**When it is read again.**

- When a session joins the shown project list (the list is rebuilt: project switched, membership
  changed, the session store updated) every member session is tracked and read.
- When a file in the cache's `sessions/` directory is **created** or **finishes changing**, the
  session named by the file (its name without `.json`) is read again. File names starting with `.`
  (the statusline's temporary files) and names not ending in `.json` are ignored.
- Reads run off the UI thread. **At most one read is in flight per session**: a request that arrives
  while one runs marks the session, and exactly one more read runs when the current one lands — a
  burst of N file events costs two reads, not N.
- When a session's reading changes (any field: percentage, window, source), every window updates
  that session's row ring and redraws its tab strip. An unchanged reading triggers nothing.
- One reading model serves every window of the app; the cache `sessions/` directory is created at
  start if missing.

## The statusline (F36)

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
Claude Code runs a **statusline command** after each assistant message, passing the session's
state as one JSON object on stdin; whatever the command prints is shown as the bar under the
prompt. Menkar provides that command. It is a standalone program: it runs inside Claude Code's
process tree, **outside the Menkar app**, whether or not Menkar is running, and depends on nothing
but its own files.

What one run does, in order:

1. Parse stdin as JSON. Not JSON, or not a JSON object → print `menkar` (the fallback bar) and exit 0;
   nothing is recorded.
2. **Record**, only when `session_id` is a non-empty string containing no `/` (a path separator
   would escape the directory):
   - write the session file `$XDG_CACHE_HOME/menkar/sessions/<session_id>.json` **atomically**
     (a temporary file named `.tmp-…` in the same directory, then renamed over the target), holding
     exactly the nine fields of the session record (Data contracts);
   - **append one line** to `$XDG_CACHE_HOME/menkar/usage.jsonl` (the usage record), opened in
     append mode and written in one write, so concurrent sessions appending never interleave inside
     a line.
   Both carry `updated_at` / `at`: the current time from the clock module, in UTC, ISO 8601 with
   offset (e.g. `2026-11-08T14:03:21.512000+00:00`). Missing directories are created.
   **An I/O error while recording (a full disk, a read-only cache) is swallowed**: the app loses a
   reading, the bar still prints.
3. **Print the bar**:
   - if the user has their own statusline to chain to (below) and running it succeeds, its output;
   - otherwise Menkar's own bar: the session's name (`session_name`), else the first 8 characters
     of `session_id`, else `menkar`; then, when `context_window.used_percentage` is a number,
     `"<n>%"` rounded to a whole number; then, when `cost.total_cost_usd` is a number,
     `"$<n.nn>"`; the parts joined by `" · "` (space, middle dot, space). E.g.
     `fix-login · 47% · $1.23`.
4. Exit 0. **The statusline never fails**: a statusline that errors shows an error in every Claude
   session.

**Chaining the user's own statusline.** The user's own statusline keeps showing, whether Menkar's
replaced it in `~/.claude/settings.json` (Integrations) or `--settings` outranks it in a session
Menkar started:

- The command to chain is computed by the app (below) and left in
  `$XDG_CONFIG_HOME/menkar/chained-statusline.json` as `{"command": "<string>"}` or
  `{"command": null}`. The script reads only that file: missing, unreadable, not JSON, not an
  object, or a `command` that is not a non-blank string → nothing to chain.
- The command is run through the shell with **the same stdin** Menkar's script received, with a
  **2-second timeout** (Claude Code cancels a statusline run when the next trigger comes). Its
  standard output, with trailing newlines removed, is the bar — only if it exited 0 and the output
  is not blank. A non-zero exit, a timeout, an error starting it, or blank output → Menkar's own bar.
- Recording (step 2) happens whether or not a chained command runs.

**Which command to chain** (computed by the app each time it writes its settings files):

1. If the Integrations record holds a statusline install, the statusline that install **replaced**
   (`previous`), when it is not null.
2. Otherwise the `statusLine` currently in `~/.claude/settings.json` — the one `--settings`
   outranks in the sessions Menkar starts. A settings file that cannot be read or parsed → nothing.
3. The candidate must be a JSON object that is **not Menkar's own** statusline object and has a
   non-blank string `command`; otherwise nothing is chained.

## `--settings` (F36)

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
Every `claude` Menkar starts — new, resume, fork, continue — carries
`--settings <path to $XDG_CONFIG_HOME/menkar/claude-settings.json>`, last on the command line (after
`--remote-control=<name>` when Remote Control is on; `terminal.md` owns the command line). Claude
Code layers that file over the user's own settings **for that session only**; nothing is written
under `~/.claude`. Cursor's command carries no such flag (Cursor has no statusline).

Each time a Claude command line is built, before it runs, the app (re)writes:

- `claude-settings.json`: `{"statusLine": {"type": "command", "command": "<statusline command>"}}`,
  pretty-printed with 2-space indentation and a trailing newline;
- `chained-statusline.json`: `{"command": <the command to chain, or null>}` and a trailing newline.

Each is written **only when its content would change** (compared with the file's current text;
missing or unreadable counts as different), atomically (a `.tmp-…` file in the same directory,
renamed over it). So an install that moved, or a changed own statusline, heals on the next command.

The statusline command is the absolute invocation of Menkar's statusline program, quoted for the
shell (agent-tablet's is the Python interpreter's path followed by the script's path). It must not
depend on Menkar's window running, nor on the current directory.

## The switch's state, turning it on and off

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
**The switch's state** is read from the files each time the page opens: **on** if and only if the
Integrations record holds a statusline install **and** `~/.claude/settings.json`'s `statusLine` is
still exactly the object that install wrote. A user who edited the key by hand sees the switch off.
A settings file that cannot be read or parsed reads as off.

**Turning it on** (install):

1. Read `~/.claude/settings.json`. Missing → treated as `{}`. Errors (below) refuse the change.
2. If `statusLine` already equals Menkar's and the switch reads as on → nothing.
3. If the file exists, copy it byte for byte to
   `$XDG_STATE_HOME/menkar/settings-backup/settings-<YYYYMMDD-HHMMSS>.json` (local time from the clock
   module).
4. Note the `statusLine` it replaces (`previous`): the current value, or null when there was none
   **or when it already was Menkar's own** (so removing never "restores" Menkar's statusline).
5. Set `statusLine` to Menkar's object (the same one `claude-settings.json` holds) and write the
   whole file back: JSON with 2-space indentation and a trailing newline, other keys kept in their
   order, atomically (temporary file in the same directory, renamed over it).
6. Write the record `$XDG_STATE_HOME/menkar/integrations.json`, keeping its other keys:
   `"statusline": {"installed": <Menkar's object>, "previous": <replaced object or null>}`.
7. Rewrite the `--settings` files (the chained command now comes from `previous`).

**Turning it off** (remove):

1. No statusline entry in the record → nothing.
2. Read `~/.claude/settings.json`. If its `statusLine` is **not exactly** what the record says was
   installed, **refuse**: the file is left as it is (the user changed it since).
3. `previous` null → remove the `statusLine` key; otherwise put `previous` back.
4. Write the file back (as in install, step 5), remove the `statusline` entry from the record
   (keeping the record's other keys), rewrite the `--settings` files.

## What Claude Code passes to the statusline (stdin)

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
One JSON object per run. Only these keys are read; any may be missing or null.

| Key | Type | Meaning | Goes to |
|---|---|---|---|
| `session_id` | string | the session's id (the transcript's file name) | session file name, both records, bar fallback |
| `session_name` | string | Claude's name for the session (`-n`, `/rename`) | session record, bar |
| `transcript_path` | string | the transcript's absolute path | session record |
| `cwd` | string | the session's working directory | both records |
| `model.id` | string | the model id, e.g. `claude-opus-5-5` | both records |
| `context_window.used_percentage` | number | how full the window is, 0–100 | session record `percentage`, bar |
| `context_window.context_window_size` | integer | the window's size in tokens (200000, 1000000) | session record `window` |
| `context_window.total_input_tokens` | integer | tokens in the window | session record `input_tokens` |
| `cost.total_cost_usd` | number | the session's running cost in USD, **reset to 0 by `/clear`** | usage record `cost_usd`, bar |
| `cost.total_lines_added` | integer | lines added so far | usage record |
| `cost.total_lines_removed` | integer | lines removed so far | usage record |
| `rate_limits.five_hour.used_percentage` | number | subscription use of the 5-hour window | usage record |
| `rate_limits.seven_day.used_percentage` | number | subscription use of the 7-day window | usage record |

A nested key whose parent is missing or not an object reads as null.

## The session file — `$XDG_CACHE_HOME/menkar/sessions/<session_id>.json`

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
Written whole by the statusline on every run, read by the app. **Exactly these nine keys**; the
statusline and the reader share one declaration of them, held by a parity test (an enum crossing a
boundary). Values are copied as received (null when missing).

| Key | Type | From |
|---|---|---|
| `session_id` | string | `session_id` |
| `session_name` | string \| null | `session_name` |
| `transcript_path` | string \| null | `transcript_path` |
| `cwd` | string \| null | `cwd` |
| `model` | string \| null | `model.id` |
| `percentage` | number \| null | `context_window.used_percentage` |
| `window` | integer \| null | `context_window.context_window_size` |
| `input_tokens` | integer \| null | `context_window.total_input_tokens` |
| `updated_at` | string | the run's time, UTC ISO 8601 with offset |

The app reads only `percentage`, `window` and `updated_at`. The file is never deleted by Menkar.

## The usage log — `$XDG_CACHE_HOME/menkar/usage.jsonl`

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
One JSON object per line, appended on every statusline run, never rewritten or pruned. Read by the
usage report (`usage.md`: the exact cost and the 5-hour / 7-day limits).

| Key | Type | From |
|---|---|---|
| `at` | string | the run's time, UTC ISO 8601 with offset |
| `session_id` | string | `session_id` |
| `cwd` | string \| null | `cwd` |
| `model` | string \| null | `model.id` |
| `cost_usd` | number \| null | `cost.total_cost_usd` |
| `lines_added` | integer \| null | `cost.total_lines_added` |
| `lines_removed` | integer \| null | `cost.total_lines_removed` |
| `five_hour_pct` | number \| null | `rate_limits.five_hour.used_percentage` |
| `seven_day_pct` | number \| null | `rate_limits.seven_day.used_percentage` |

## The transcript fields the estimate reads

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
From the last line of `~/.claude/projects/<encoded cwd>/<session_id>.jsonl` with
`"type": "assistant"`: `timestamp` (ISO 8601; a trailing `Z` means UTC) and `message.usage`'s
`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`. Nothing is written there.

## Menkar's files for this area

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
| Path | Written by | Content |
|---|---|---|
| `$XDG_CONFIG_HOME/menkar/claude-settings.json` | app, before each Claude command | `{"statusLine": {"type": "command", "command": "<statusline command>"}}` |
| `$XDG_CONFIG_HOME/menkar/chained-statusline.json` | app, before each Claude command and after each install / remove | `{"command": "<user's command>" \| null}` |
| `$XDG_CACHE_HOME/menkar/sessions/<id>.json` | statusline | the session record |
| `$XDG_CACHE_HOME/menkar/usage.jsonl` | statusline | the usage records |
| `$XDG_STATE_HOME/menkar/integrations.json` | app, on install / remove | `{"statusline": {"installed": {…}, "previous": {…} \| null}}`, other keys kept |
| `$XDG_STATE_HOME/menkar/settings-backup/settings-YYYYMMDD-HHMMSS.json` | app, on install | a byte copy of `~/.claude/settings.json` before the change |

Each `XDG_*` variable falls back to its standard default when unset or empty (`~/.config`,
`~/.cache`, `~/.local/state`). The state directory is not among the three Menkar's `CLAUDE.md`
names; on Windows and macOS it resolves through the same paths module as the others.

## What is written under `~/.claude`

> Left on 2026-11-08: built by plan 09, described in `docs/context.md`.
Only `~/.claude/settings.json`'s `statusLine` key, and only when the user turns the Integrations
switch on or off. Nothing else, ever, from this area.

## Acceptance cases

> Left on 2026-11-08: built by plan 09; the Vitest tests carry these ids.
**The ring**

- **CTX-1** Session file `{"percentage": 47.2, "window": 200000, "updated_at": "2026-11-08T10:00:05+00:00"}`;
  transcript's last assistant message at `2026-11-08T10:00:00Z` → reading 47.2 %, source statusline;
  green ring, opaque; tooltip "47% of 200k".
- **CTX-2** Same session file, but the transcript's last assistant message is at
  `2026-11-08T10:00:09Z` (newer than the report) with usage input 1,000 + cache creation 20,000 +
  cache read 99,000 → estimate 60.0 % over 200k; yellow, faint; tooltip "~60% of 200k (estimate)".
- **CTX-3** No session file; last assistant usage totals 159,999 tokens → estimate 80.0 % (rounded to
  one decimal), red; 159,000 → 79.5 %, yellow.
- **CTX-4** Percentages 59.9 → green; 60 → yellow; 79.99 → yellow; 80 → red.
- **CTX-5** Session file with `window: 1000000` but stale; last message 300,000 tokens → estimate 30.0 %,
  tooltip "~30% of 1M (estimate)".
- **CTX-6** Session file with `window: 0` or `window: "200000"` (a string) → the window used is 200,000.
- **CTX-7** Session file with `percentage: null` and a fresh `updated_at`, and a transcript with an
  assistant message → the estimate is used.
- **CTX-8** No session file and a transcript with no assistant line (only a user prompt) → no reading;
  the row shows no ring and the tab shows no ring.
- **CTX-9** Session file is `[1, 2]` or invalid JSON → treated as no report.
- **CTX-10** A transcript of 2 MB whose last assistant line lies 1 MB before the end (more than
  256 KiB) → found by the whole-file read; the reading is that line's.
- **CTX-11** A transcript whose last 256 KiB begin in the middle of an assistant line → that cut line
  is not parsed; the previous complete assistant line within the tail is used, or the whole file is
  read if none.
- **CTX-12** A reading of 130 % → full red ring, tooltip "130% of 200k".
- **CTX-13** A tab with two panes whose sessions read 35 % and 82 % → the tab's ring is red, tooltip
  "82% of 200k"; one pane with no reading and one at 35 % → the tab shows 35 %.
- **CTX-14** The statusline writes `sessions/abc.json` for a tracked session → within one read, the
  row ring and the tab ring change; a write of `sessions/.tmp-x1` triggers no read.
- **CTX-15** Ten change events for one session arrive while its read is in flight → exactly two reads
  happen in total.
- **CTX-16** A reading that is the same (percentage, window, source) as before → no redraw signal.

**The statusline script**

- **CTX-17** Stdin `{"session_id":"s1","session_name":"fix-login","context_window":{"used_percentage":47.4},"cost":{"total_cost_usd":1.234}}`,
  no chained command → prints `fix-login · 47% · $1.23`, exit 0; `sessions/s1.json` holds the nine
  keys with `model: null`, `window: null`; `usage.jsonl` gained one line with `cost_usd: 1.234`.
- **CTX-18** Stdin `{"session_id":"0123456789abcdef"}` → prints `01234567`.
- **CTX-19** Stdin `not json` → prints `menkar`, exit 0, nothing written. Stdin `[]` → same.
- **CTX-20** Stdin with `session_id: "../x"` or `""` or `5` → nothing recorded; the bar still prints
  (`menkar` for a non-string id with no name).
- **CTX-21** The cache directory is read-only → the bar prints, exit 0.
- **CTX-22** `chained-statusline.json` is `{"command": "echo mine"}` → the bar is `mine`, and the
  session file and usage line are still written.
- **CTX-23** Chained command `exit 3`, or one that prints only whitespace, or `sleep 5` → Menkar's own
  bar; the sleeping one is abandoned after 2 seconds.
- **CTX-24** The chained command receives byte-for-byte the stdin Menkar's script received.
- **CTX-25** Two statusline processes append to `usage.jsonl` at once, 1,000 times each → 2,000
  lines, each valid JSON.
- **CTX-26** Parity: the keys the statusline writes into a session file equal the keys the app's
  reader declares; a key added to one side only fails a test.

**`--settings`**

- **CTX-27** Starting a new Claude session → its command line ends with
  `--settings '<config>/menkar/claude-settings.json'`; with Remote Control on, the tail is
  `--remote-control=<name> --settings <path>`. Resume, fork and continue carry it too; a Cursor
  command does not.
- **CTX-28** `claude-settings.json` missing → created before the command runs with the exact content
  above; already identical → not rewritten (its modification time unchanged); different → replaced.
- **CTX-29** `~/.claude/settings.json` has `"statusLine": {"type":"command","command":"my-bar"}` and
  no install is recorded → `chained-statusline.json` is `{"command": "my-bar"}`; the user's file is
  not modified.
- **CTX-30** `~/.claude/settings.json` missing, or invalid JSON → `chained-statusline.json` is
  `{"command": null}`; no error is shown.

**Integrations**

- **CTX-31** First open of Preferences → Integrations with no record → the switch is off; nothing under
  `~/.claude` is written by opening the page.
- **CTX-32** Turn on with `~/.claude/settings.json` = `{"model":"opus","statusLine":{"type":"command","command":"my-bar"}}`
  → a backup `settings-<stamp>.json` with the original bytes; the file becomes
  `{"model":"opus","statusLine":<Menkar's>}` (key order kept, 2-space indent); the record holds
  `previous: {"type":"command","command":"my-bar"}`; `chained-statusline.json` holds `my-bar`; the
  switch reads on.
- **CTX-33** Then turn off → the file's `statusLine` is `{"type":"command","command":"my-bar"}` again,
  `model` untouched; the record has no `statusline` key; the switch reads off.
- **CTX-34** Turn on with no `~/.claude/settings.json` → no backup; the file is created holding only
  `statusLine`; turning off removes the key, leaving `{}`.
- **CTX-35** Turn on, then the user edits `statusLine` by hand; open Preferences → the switch reads
  off. Turning it on again installs again (new backup; `previous` = the user's edit).
- **CTX-36** Turn on, then the user edits `statusLine`; the switch still shows on in an open dialog;
  turning it off → toast "The status line in /home/u/.claude/settings.json changed since it was
  installed; it was left as it is.", the file unchanged, the switch back to what the files say.
- **CTX-37** `~/.claude/settings.json` holds `{"a":` → turning on shows "…/settings.json is not
  valid JSON; it was left as it is.", the switch returns to off, no backup is made, the file is
  unchanged. Holding `[1]` → "…does not hold a JSON object; it was left as it is.". Unreadable
  (permissions) → "…could not be read.".
- **CTX-38** `statusLine` already equals Menkar's object but no record exists → turning on records
  `previous: null`; turning off removes the key.
- **CTX-39** Two installs within the same second write the same backup name; the second replaces the
  first (agent-tablet's behaviour; the backup names have one-second resolution).

## The Integrations page (F37)

> Left on 2026-11-08: built by plan 12, described in `docs/preferences.md`.
Preferences has a second page, **"Integrations"** (icon: a puzzle piece,
`application-x-addon-symbolic`), listing what Menkar may add to `~/.claude/settings.json` — one
switch per piece, **all off until the user turns them on**, each removable on its own. Today one
piece:

- Group title: **"Claude Code settings"**; group description: **"Each piece is added to
  ~/.claude/settings.json only when you turn it on, and taken out when you turn it off. A copy of
  the file is kept before every change."**
- Switch row: title **"Status line in every Claude session"**, subtitle **"Context and usage for
  sessions started outside Menkar too. Your own status line, if you have one, keeps showing."**
- The page's second group, "Classify turns", is `classifier.md`'s.

**The switch's state, turning it on and off** — built: `docs/context.md` describes how; `src/core/` holds it.

**Errors.** A refused change shows a **toast for 8 seconds** with one of these sentences (with
`{path}` the full path of the settings file), and the switch goes back to what the files say,
without trying the change again:

| Case | Toast |
|---|---|
| The settings file exists but cannot be read | `"{path} could not be read."` |
| It is not valid JSON | `"{path} is not valid JSON; it was left as it is."` |
| It holds JSON that is not an object | `"{path} does not hold a JSON object; it was left as it is."` |
| Off, but its `statusLine` changed since the install | `"The status line in {path} changed since it was installed; it was left as it is."` |

agent-tablet's `docs/context.md` says the switch "says why" a removal was refused; the code shows a
toast instead, as above.

## The context ring (F35)

> Replaced 2026-11-09 by decision 1.22: red from 90 instead of 80, and both edges a setting.
- **Level and color**, from the percentage: below 60 → green ("ok"); 60 up to below 80 → yellow
  ("warn"); 80 and above → red ("full"). The thresholds are inclusive at 60 and 80.

## The context ring — where

> Replaced on 2026-11-09: a stopped session's row shows no ring (decision 1.21, the human), and the tab's ring sits after its title (LOOK-54).
- **Where.** One ring in each session row of the project list (between the name/folder text and the
  row's ⋯ button), and one on each tab of the tab strip (after the group color swatch and the state
  dot, before the title). History rows (Add session → Existing) have none.
