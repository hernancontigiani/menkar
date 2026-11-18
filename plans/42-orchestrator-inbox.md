# Plan 42 — The orchestrator's inbox: wakes only for reviews and questions

**Status:** written 2026-11-18 by `menkar-t62` (task 62); reviewed by `menkar-t85` (task 85,
`prompts/reports/menkar-t85-review-42.md`, findings F1–F23); fixed by `menkar-t86` (task 86), each
finding's outcome in §6.3. **Q2, Q3, Q5 and Q8 are decided** (`set`, 2026-11-18).
**Q1, Q4, Q6 and Q7 are decided by the human (2026-11-18, topic 54)**, each as recommended, and
written in one place, §2.9's table, which the blocks cite.

**Comes from:** decision 1.178 (`plans/00-STATUS.md` §1, the human, 2026-11-17, topic 48), taken as
given; it replaces 1.173's coalescing as the answer to the noise in the orchestrator's chat. The
hook's facts are the Claude Code consultant's measurements (§2.3), not memory.

**Exit when executed:**

| Part | Goes to |
|---|---|
| Which events wake a parent and which go to the inbox, in their order (§2.1); the inbox (store, keys, cap, clearing, the counter); `inbox`, `ask`; the review wake at the turn's end; the fallback to the inbox; the permission topic | `docs/session-control.md`: "Waking a parent" and "The human's own posts" rewritten; the replaced paragraphs verbatim to `docs/history/session-control.md` |
| The `UserPromptSubmit` hook in the `--settings` file, its file, delivery confirmed from the transcript, what was measured and on which version | `docs/context.md`, a bullet beside the Stop hook |
| `inbox-text.ts` joining the statusline's short import list | `docs/context.md`, where the statusline's import limit is described |
| The new kit concern `PromptInbox` (Claude's, null for Cursor) | `docs/agents.md`, the concerns' list |
| What the orchestrator and the human see in the mode: the permission topic and its notice, away/back reaching the orchestrator with its next prompt | `docs/orchestration.md`, "Notifications in the mode" and "The human's presence" (replaced lines to `docs/history/orchestration.md`) |
| What agents read: the orchestrator skill, the worker skill, the team block, the guide, the tools' descriptions | `plugin/skills/orchestrator/SKILL.md`, `plugin/skills/orchestrator/workers.md`, `plugin/skills/worker/SKILL.md`, `plugin/team/common.md`, `plugin/guide/orchestration-mode.md`, `src/core/control/protocol.ts` |
| The `answer` tool for a worker whose agent has no messaging; "The orchestrator's conversation, apart from the events" narrowed to the separate interface; a Cursor orchestrator's inbox | `docs/NOT_BUILT_YET.md` (the old entry's lines to its history) |
| What was rejected and why (§2.10) | the "Rejected" section of `docs/session-control.md` |
| Row 1.178 marked built; the answers to Q1, Q4, Q6, Q7, and Q8 as decided | `plans/00-STATUS.md` (by `set`) |
| The rest | `git log` |

**Modifies:** no plan. **Replaces:** 1.173's batching of the human's posts with the orchestrator's
wakes (the batcher stays for what still wakes). **Seam:** plan 41 (§4, "The seam with plan 41").

---

## 1. Goal, and what already exists

**Goal.** In a project with the orchestration mode on, Menkar posts to the orchestrator's chat only
when a task is set to review or a session asks it something. Everything else Menkar used to post
there waits in an inbox, and reaches the orchestrator without a line on the human's screen: with
its next prompt (a `UserPromptSubmit` hook, Claude only) or when it calls `inbox`. A child at a
permission prompt wakes nobody; Menkar raises a blocking topic for it, with its notice, and closes
it once the prompt is answered. **No event the orchestrator gets today is lost**: what cannot be
posted lands in the inbox.

**What exists, verified in the tree at `f1d3037`:**

- **The batcher** (`src/core/control/events.ts`): `wakeEvent(name, previous, next)` (`:9`) gives
  "‹name› is waiting at a permission prompt" on entering `blocked` and "‹name› finished its turn"
  only on `working` → `idle`/`done` (`:12`). `WakeBatcher` (`:22`) keeps, per parent, a `human` map
  (keys `presence`, `control:‹session›`, `topic:‹n›`) and an `events` map **keyed by the child**
  (`note`, `:37–47`): `add` deletes the key and sets it again (`:59–66`), so a child's second event
  inside the wait replaces its first. Every post restarts the `WAKE_DELAY_MS` (3000) timer
  (`:63–64`); `flush` sends human first, then ★ children, then the rest, joined with "; "
  (`:68–77`). Its constructor has `private readonly` parameters (`:30–35`), which Node's type
  stripping does not run. `wakesParent` (`:88–99`) decides whether a transition wakes.
- **The wiring** (`src/main/workspace.ts`): `wakes = new WakeBatcher(…)` (`:2062`); `onShownChange`
  (`:2074`) returns when the kit's `catalog.turnEnd` is null (`:2077`) — a Cursor child wakes nobody
  — and when the session has no parent (`:2082`); it notes the event with the parent's **session id
  at that moment** (`:2101`). `wakeSession(parent, text)` (`:2105`) posts through
  `mainKitOf(agent).waker` and **only logs** every failure: no pane or no waker (`:2108–2110`), an
  outcome other than `'posted'` (`:2121–2122`; `'no session'` and `'protocol'` are
  `src/core/control/post.ts:71–84`), a thrown socket error (`:2123–2124`).
- **A parent's id changes** under it: `followClear` (`:2178`) gives the pane a new id on `/clear`
  and on a renew (`renew`, `:1769`, new id at `:1778`); `paneOfSession(old id)` (`:367`) then finds
  nothing. Pane ids are new per start (`newId()`, `:928`; `MENKAR_PANE` is the pane id).
- **Renewing**: `renewRequests` (`:1287`) and `renewing` (`:1289`). `renew` deletes the request
  (`:1772`), awaits (`:1779`), and sets `renewing` only at `:1790`: in between, the pane is in
  neither map.
- **A turn can end from `blocked`**: `nextShown` (`src/core/agentstate/shown.ts:25–29`) gives `idle`
  after `blocked`; `wakeEvent` and `wakesParent` only count `working` → `idle`/`done`. The Stop
  hook's record reaches main as `turnEnded(pane, session)` (`workspace.ts:1751`).
- **`reportClosedTurn`** is Claude's `TurnEndReading.reportedTo(locator, parentName)`
  (`src/core/agents/types.ts:141`, over `src/core/sessions/lastreply.ts:130`).
- **The human's posts**: presence in `askPresence` (`workspace.ts:1513`; `wakes.post(id, 'presence',
  …)` `:1522`, `wakes.forget(clearedBy, 'presence')` `:1523`; texts `AWAY_POST`, `BACK_POST` in
  `src/core/presence.ts`); take control / hand back (`:2966`, key `control:‹session›`); "The human
  wants to discuss topic N" (`:3044`, key `topic:‹n›`). Each checks `wakeable(…)` (`:334`) first.
- **The waker is Claude's kit's**: `MainAgentKit` (`src/main/agents/types.ts:30–39`: `settings`,
  `team`, `remote`, `waker`); Claude's `src/main/agents/claude/waker.ts` posts with `postToSession`;
  Cursor's main kit has `waker: null`. Cursor's core kit has `mcp: null`
  (`src/core/agents/cursor/index.ts:10`), so a Cursor session calls no Menkar tool.
- **The `--settings` file** is per project (`writeSessionSettings`, `src/core/context/settings.ts`),
  holding the statusline, the SessionStart and Stop hooks, `permissions` and
  `crossSessionInbound: "accept"`. The hooks' command is the statusline's own program with an
  argument (`src/core/context/statusline.ts:358–366`). The statusline runs as it is under plain
  Node, its imports limited to Node's modules and `../clock.ts`, `../paths.ts` with `.ts`
  specifiers (header, `:6–16`); `turnEndsDir()` repeats the control folder and a test holds the two
  equal.
- **The control folder**: `startControl` (`src/main/control.ts:44–46`) creates `requests`,
  `responses`, `turnEnds`, `snapshots`, and sweeps prompt copies and team files only.
- **The MCP server ↔ main** go through files (`src/core/control/files.ts`: `TOOL_NAMES`,
  `callMenkar`, `controlPaths()`), dispatched in `handleControl` (`workspace.ts:1302`). `task_review`'s
  rules are `taskTool` (`src/core/orchestration/tasks.ts:443` — the orchestrator changing only whom
  it waits on — and `:470`). The e2e stand-in calls only the tools in its table
  (`e2e/fixtures.ts:199–219`).
- **Topics** (`src/core/orchestration/topics.ts`): `Topic { number (never reused, :9), title,
  context, from, blocking, task?, status, decision?, created, updated, seen? }`, `addTopic` (`:62`);
  `parseTopic` drops an unknown field. A topic raised through a tool goes `topicFor` (`workspace.ts:
  1648`): `setTopics`, `noticeTopics(project, before, after)` (`:1674`, its only caller), `changed()`;
  `noticeTopics` applies 1.167's silence while away (`topicNoticeNow`, `:1681`) and its click shows
  the orchestrator's tab (`showTopic`, `:1711`). The title shows in the topic row
  (`src/renderer/orchestration.ts:742–766`, context at `:766`), the Board's Topics
  column and its Done rows (`src/renderer/work.ts:358–370`, `:290–292`), Done today (`doneTodayView`, `workspace.ts:610`) and the notice
  (`src/main/agentstate.ts:140–151`); `topicViews` (`workspace.ts:589`) feeds the renderer. Nothing
  draws `decision`. A double-click sets `discussing` (`:3032`).
- **In the mode a child's own notice is suppressed** (`notifiesFor`,
  `src/core/orchestration/notifies.ts`): it reaches the human through the orchestrator's topics.
- **Plan 41** is being built: blocks 1–2 committed, block 3 in progress (`menkar-t84`); its §4
  ("The seam with 1.178") lists the shared files.

## 2. The design

### 2.1 What wakes, and what goes to the inbox

For a project with the mode on whose orchestrator's kit has an inbox **(decided 2026-11-18, Q1, topic 54)**.
Any other parent — the mode off, or a parent that is not the orchestrator — is woken exactly as
today: same events, same batcher, same `wakesParent`.

**The turn end** of a pane is one moment, reached by the first of: the shown state becoming `idle`
or `done` from `working` **or `blocked`**, the Stop hook's record (`turnEnded`), the pane's exit.
Main keeps per pane a `turnOpen` flag, set on entering `working` or `blocked` and cleared at the turn
end, so a turn ends once whichever comes first.

**Events in the orchestrator's project**, decided by `route(input)` (§5, block 1) from one record of
inputs: `{ event, parentIsOrchestrator, reviewPending, renewing, onlyTeamUpdates, reportedToParent }`.

| Event | Today | With this plan |
|---|---|---|
| A session calls `task_review` on its task (the assignee, not the orchestrator changing whom it waits on) | nothing; the turn end wakes | **notes a pending review**; the review wake fires at that session's turn end (2.4; Q8) |
| A session calls `ask` | (a SendMessage) | **posted at once**, not batched; inbox if it cannot be (2.5) |
| A child enters `blocked` | wake | **inbox** "‹name› is waiting at a permission prompt" (key `permission:‹child›`) + **Menkar's blocking topic** (2.6) |
| The human takes control / hands back | wake (batched) | **inbox**, key `control:‹session›` |
| The human double-clicks a topic | wake (batched) | **inbox**, key `topic:‹n›` |
| Away / back | wake (batched) | **inbox**, key `presence` |

**A turn end**, its rules **in this order, the first that applies wins**:

1. **A pending review** for this session → **wake** "‹name› set task N to review: ‹note›"; the
   note is cleared; the turn adds nothing else. Always, whatever else is true of the turn (a renew
   in it, a SendMessage to the parent closing it, only team updates opening it): one wake too many
   beats none.
2. A renew in flight for the pane (`renewRequests`, `renewing`, or `renew` between the two; F22) →
   nothing.
3. Only Menkar's team updates opened the turn → nothing.
4. A child's turn closed by a SendMessage to its parent → nothing (Claude Code delivered it).
5. Otherwise, for a child → **inbox** "‹name› ended its turn without a report" (key `turn:‹child›`),
   also after an `ask` earlier in the turn (1.173 kept that end visible; now it is an invisible
   line). For a non-child → nothing.

Rule 2's state is read **synchronously, before any await**, so a turn end seen while `renew` awaits
is not taken for a turn without a report: `renew` adds the pane to `renewing` (as a set entry
holding no resolver yet) before its first await.

### 2.2 The inbox

- **One per project with the mode on**, in main's memory, for whoever is its orchestrator now: it
  follows a renew and a `/clear` (same project), and is **emptied** when the mark moves to another
  session or the mode goes off — **except `presence`**, kept across a mark move so the next
  orchestrator learns the human is away (F23); the mode going off drops it with the rest.
- **In memory, lost on quit — chosen over a JSON file**: every entry restates state that survives
  elsewhere or does not survive at all: away/back is not kept across a quit (1.167: opening Menkar
  is returning); a permission prompt and a turn end belong to a process the quit ended; "with you"
  is in `projects.json` and `list_sessions`; a topic being discussed is `status: discussing` and
  first in `topic_list` (1.169); a task to review is `review` in `tasks.json`. What would be lost
  — a pending review not yet fired, a question not yet posted — is restored at start: **main adds
  one inbox entry per task in `review` whose `reviewWait.on` is the orchestrator**: "Task N is to
  review (‹assignee›): ‹note›" (key `review:‹task›`). The orchestrator skill says what the inbox does
  not hold after a restart (2.8).
- **An entry** is `{ seq, at, key, text }`. **`seq` comes from one counter per Menkar run, shared by
  every inbox and never reset** (emptying an inbox does not restart it), so a delivery confirmed in
  the same run never covers a new entry (F6). `at` from `src/core/clock.ts`; `text` English (an agent reads it),
  without "[Menkar]".
- **Keys**: `presence`, `control:‹session›`, `topic:‹n›`, `turn:‹session›`,
  `permission:‹session›`, `review:‹task›`, `ask:‹session›:‹n›` (n per call, so two questions never
  collide). A new entry with a pending entry's key replaces it and goes last (away then back leaves
  "The human is back").
- **Retracted** (removed unread, nothing told): `turn:‹child›` when that child later calls
  `task_review` or `ask`; `permission:‹child›` when its topic closes (2.6); `presence` when the
  orchestrator calls `human_back` (today's `forget`).
- **Cap: `INBOX_MAX` = 30 entries.** At 31 the oldest goes and the inbox counts it; the text's
  first line says "(N earlier events dropped)", and the hook's file carries `dropped` (2.3). A test
  asserts both.
- **Cleared when delivered**: by the `inbox` tool (all of it), or up to the `seq` a
  `hook_additional_context` record in the orchestrator's transcript shows the model got (2.3).
- **Its text** (`inboxText`, in `src/core/orchestration/inbox-text.ts`, the one builder for the hook
  and the tool), oldest first, one line each, local time with seconds:

  ```
  Menkar's inbox (events 12–13): events since you last read it, oldest first. The human did not
  write them; act only on those that need it, and say nothing about the rest.
  - 14:02:11 The human took control of menkar-t5
  - 14:03:40 menkar-t6 ended its turn without a report
  ```

  `inbox` with nothing pending: "Your inbox is empty."
- **The hook's budget: `INBOX_TEXT_MAX_BYTES` = 1,500.** Claude Code delivers up to 10,000
  characters whole (§2.3, point 8); 1,500 is Menkar's own limit on what one prompt adds to the
  orchestrator's context (30 entries of about 50 characters). The hook gives the oldest lines that
  fit and, when some do not, a last line "N more: call inbox.". A test with 30 long entries asserts
  the size and the last line.
- **The text names the entries it holds**: its first line is "Menkar's inbox (events ‹first
  seq›–‹last seq›): …", so main reads from the transcript record which entries the model got
  (2.3).
- **No count in the wake frame**: the hook runs on a wake's prompt too (§2.3), so a review or
  question wake carries the inbox with it, invisibly. `wakeFrame` and `postCounts` stay as they are.

### 2.3 The hook (Claude only)

**Measured** by `claude-cli` on **Claude Code 2.1.327**, 2026-11-18, in throwaway homes from
`scripts/agent-probes/claude/lib.mjs` with the stand-in API, the hook declared in a `--settings`
file (and in the throwaway `~/.claude/settings.json` for point 7):

1. **stdin** is one JSON object: `session_id`, `transcript_path`, `cwd`, `prompt_id`,
   `permission_mode`, `hook_event_name: "UserPromptSubmit"`, `prompt` (the text as submitted).
   **`MENKAR_PANE` reaches the hook**, as with SessionStart.
2. **`{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":…}}`, exit
   0**: the model sees it in that turn's request; **the screen shows nothing** of it (only the
   spinner's "running UserPromptSubmit hooks… 0/2" while the hook runs). The transcript gets a
   record `type: "attachment"`, `attachment.type: "hook_additional_context"`.
3. **Plain stdout, exit 0**: also seen by the model, nothing on screen; recorded as
   `hook_success`. Menkar uses the JSON form (2).
4. **Size**: a ~10 KB `additionalContext` was saved to a file under the session's `tool-results/`
   and the model got a 2 KB preview and the path.
5. **When it runs**: on a typed prompt, on a skill's slash command (`prompt: "/probeskill"`), and
   **on a `[Menkar]` wake** posted to the messaging socket (`prompt` is the raw body).
6. **Failures**: exit 1 → the prompt goes on, the screen shows "UserPromptSubmit hook failed" and
   stderr; **exit 2 blocks the prompt**; past its `timeout` the prompt goes on, the output is
   discarded, and the screen says it timed out. So the hook **always exits 0, writes nothing to
   stderr**, and is declared with `"timeout": 5` (seconds).
7. **Two sources**: a `UserPromptSubmit` hook of the user's own `settings.json` and Menkar's in
   `--settings` both run, and the model gets both contexts.

**The cases the review found unmeasured (F4)**, measured by `claude-cli` on **Claude Code
2.1.327**, 2026-11-18, the same way (its table: `$MENKAR_FILES/claude-cli-42-hook-cases.txt`).
"Model saw" means a request carrying the context; "record" a `hook_additional_context` attachment
in the transcript:

| Case | Hook ran | Model saw it | Record |
|---|---|---|---|
| 8. Size | — | whole up to 10,000 characters; 10,010 and above: a file and a preview; 1,500 whole | — |
| 9. `/clear`, `/compact`, `/model`, `/rename x` | **no** | — | — |
| 9b. The next prompt after each (after `/clear`, in the new session) | yes | yes, whole | yes (in the new transcript after `/clear`) |
| 10a. The human's message typed and queued mid-turn | yes, **at queue time** | yes, at the next request, when the tool ends (6.7 s later in the probe) | yes |
| 10b. A `[Menkar]` frame posted mid-turn | yes, **at drain time** (the next tool round) | yes, same request | yes |
| 11. Remote Control | not measurable in a throwaway home (needs a claude.ai login and the phone) | | |
| 12. `claude "<p>"`, `claude --resume <id> "<p>"` | yes | yes, whole | yes |
| 13a. A real peer's SendMessage (`prompt` is the wrapped `<cross-session-message …>` text) | yes | yes, same turn | yes |
| 13b. Another `UserPromptSubmit` hook exits 2 and blocks the prompt | **yes** | **no**: no request at all | **no** |
| 14. The guarded command, file present / absent, `SHELL` sh or bash | runs under `/bin/sh -c` always; present → yes; absent → the program is not started | present → yes | present → yes |

Not measured: a queued message (10a) withdrawn (Esc, Up) or the turn interrupted between the hook
and the next request; the hook's own timeout (point 6: its output is discarded). Both are, like
13b, a hook that ran and a model that saw nothing.

**The rule that follows: the hook does not decide what was delivered; the transcript does.** 13b
cannot be told apart from stdin (the other hook's verdict comes after Menkar's runs), nor can a
timeout or a withdrawn queued message, so an ack written by the hook on printing would lose the
entries in all three. Instead **main drops an entry only when the orchestrator's transcript holds a
`hook_additional_context` record whose text names its `seq`** (point 2; 13b leaves none). Until
then the hook gives it again on every prompt: an entry may reach the model twice (a second prompt
before main read the first record), never zero times. Built-ins (9) do not run the hook at all, so
they cost nothing; the entries go with the next prompt, into the new session after `/clear`, which
main follows (2.3, publishing on an id change). **Block 2's probe also measures** whether a
withdrawn queued message leaves a record; if it does, it is reported to `set` before block 3, as a
residual loss of that rare case.

The shape:

- **The settings file declares** `hooks.UserPromptSubmit: [{ hooks: [{ type: "command", command,
  timeout: 5 }] }]` beside SessionStart and Stop (`promptSubmitHooks(statuslineCommand)` in
  `src/core/context/settings.ts`), in every session Menkar starts (the mark can move to a running
  session, which never re-reads its settings).
- **The command is the statusline's program** with the argument `prompt-submit`, wrapped so a
  pane with no inbox file never starts Electron: `if [ -f '<cache>/control/inbox/'"$MENKAR_PANE"'.json' ];
  then <statusline command> prompt-submit; fi` (exit 0 either way; point 14). Windows' form is out
  of scope (§3).
- **The file** `<cache>/control/inbox/<pane>.json`, written whole by main (tmp + rename), only for
  the orchestrator's pane and only through Claude's kit (2.7): `{ session_id, dropped, entries: [{
  seq, at, text }] }`. Main is its only writer; the hook only reads it.
- **The hook** (`runPromptSubmit` in `statusline.ts`): reads stdin, reads the file, ignores it when
  its `session_id` is not stdin's; prints the JSON of point 2 with `inboxText` over the entries
  that fit the budget. Nothing in the file → prints nothing. Any failure → prints nothing, exit 0,
  no stderr. It writes nothing and does not read `prompt`.
- **Main confirms delivery from the transcript** (through the kit, `delivered`): it reads the
  orchestrator's transcript **incrementally, from the offset it reached last** (the file's inode and
  size checked as `src/core/usage/cache.ts:168–179` does; at the first publish of a run it starts at
  the file's current end, so a record of an earlier run never confirms a new entry), finds the
  `hook_additional_context` records of `hookEvent: "UserPromptSubmit"`, reads "(events a–b)" from
  their text, and drops entries `seq ≤ b`. It reads when the orchestrator's pane turns `working`, at
  its turn end, before each publish, and when `inbox` is called; never on the UI path, never
  waiting for the hook. The transcript is read, never written (a test asserts its bytes and mtime
  unchanged).
- **Main publishes the file whenever the orchestrator's pane or session id changes**, not only on
  an inbox change (F5): a pane starting whose session is the orchestrator (a renew's new pane, a
  resume of a stopped orchestrator), `followClear` (`/clear`, renew), `followResume`, the mark
  moving to another session (the old pane's file removed, the new pane's written; the transcript
  offset restarts at the new transcript's end, or 0 when it does not exist yet, as after a
  `/clear`). **A pane's file is removed at its exit**, and **`startControl` creates the `inbox`
  folder and empties it** at start (every pane id of an earlier run is dead).
- **The folder is repeated** in the statusline as `inboxDir()`, as `turnEndsDir` is; the existing
  test that holds `turnEndsDir()` equal to `controlPaths().turnEnds` gains `inboxDir()` equal to
  `controlPaths().inbox`.
- **The import limit** (F18): `statusline.ts` imports `inboxText` and `INBOX_TEXT_MAX_BYTES` from
  `src/core/orchestration/inbox-text.ts`, which imports nothing (the time is formatted from the
  entry's `at`), uses `.ts` specifiers if it ever imports, and holds nothing Node's type stripping
  cannot run (no parameter properties, no enums). The `Inbox` class lives apart, in
  `src/core/orchestration/inbox.ts`. The statusline's header names the third module.

### 2.4 The review wake

- `task_review` by the assignee (`taskTool`'s `:470` branch, not the orchestrator's `:443` change of
  whom it waits on) notes a pending review for that session: `{ task, note }`, the latest call
  winning. The assignee may be any session of the project, child or not (Q8, decided);
  the orchestrator calling it on its own task notes nothing.
- **At that session's turn end** (2.1, rule 1) the wake "‹name› set task N to review: ‹note›" goes
  through the batcher with the key `review:‹session›:‹task›` and the address of **the project's
  orchestrator** (2.4.1), and the turn adds no inbox entry. A later `turn:‹session›` entry is
  retracted by it.
- **Why at the turn end, not at the call:** the worker skill calls `task_review` *before* writing
  its report, and the orchestrator reads the report with `last_reply`; a wake at the call would
  have it read the previous reply.
- Any `reviewWait` (orchestrator, human, a PR) wakes: the orchestrator reviews first, and may then
  change whom it waits on (1.164).

#### 2.4.1 The batcher's third entry, and its address

- **`WakeBatcher.wake(parent, child, key, text)`**: kept in the `events` map under its own key, with
  the child it is about, so the ★ order holds (a ★ child's wakes first). `note` keys by the child as
  today; the review uses `review:‹child›:‹task›`. Two events of one child inside the wait — a review
  and a turn-end wake of a mode-off parent, two reviews of two tasks — all arrive, in their order.
- **The address is resolved when the batch flushes**, not when the event came: a wake for the
  orchestrator is batched under `orch:‹project id›`, and main's `send` resolves it then to the
  project's orchestrator now (a renew or `/clear` inside the 3 s has changed its id). Other parents
  keep their session id, as today.
- **`wakeSession` returns its outcome** (`'posted'`, the post's outcomes, or `'no pane'`/`'error'`),
  and `send` receives the batch's entries `{ key, text }`. **When a batch to an orchestrator is not
  posted, each of its entries becomes an inbox entry** under its key, so it reaches the orchestrator
  with its next prompt or `inbox`. A batch to any other parent is logged as today.

### 2.5 The question tool, `ask` (decided: Q2, Q3, Q5)

- **`ask { question }`**: any session whose project records a parent for it (`keptParents`), mode
  on or off; the caller's parent, by its id now, receives it.
- **The question is posted at once, not through the batcher**: main posts "‹name› (task N) asks:
  ‹question›" with `wakeSession` and **waits for its outcome** (one socket write) before answering.
  N is the asker's current task (in progress or waiting), "(task N)" left out when it has none.
  Two `ask` calls are two posts (F1 cannot happen to a question).
- **Its answers**, our own sentences, tested:
  - posted → "Sent to ‹parent›. Its answer comes as a message from it. Go on with what does not
    depend on it; if nothing does, set your task waiting on ‹parent› with task_progress and end your
    turn." It never touches the task itself (Q3).
  - not posted, and the parent is the orchestrator of a mode-on project → the question becomes an
    inbox entry (`ask:‹session›:‹n›`): "‹parent› could not be woken now. Your question is in its
    inbox and reaches it with its next message. Go on with what does not depend on it; if nothing
    does, set your task waiting on ‹parent› and end your turn."
  - not posted otherwise → "‹parent› cannot be woken now (it is not running). Your question was not
    sent."
  - no parent → "You have no parent session in Menkar to ask. Send your question to the session
    that handed you the task."
  - empty → refused; longer than **`ASK_MAX_CHARS` = 2,000** → "A question is at most 2,000
    characters: put the details in a file and name its path."
- **The answer comes back by the agent's own messaging** (Q5): the orchestrator answers with
  `SendMessage` to the session by name. A Menkar `answer` tool is deferred to
  `docs/NOT_BUILT_YET.md` with its trigger: a worker whose agent has no messaging under an
  orchestrator (plan 39's later phases).

### 2.6 Menkar's permission topic

- **Raised** when a session whose parent is the orchestrator of a mode-on project — **not "with
  you"** **(decided 2026-11-18, Q6, topic 54)** — enters `blocked`, the project has no open (`open` or
  `discussing`) permission topic for that session, and **its pane is not seen** (`pane.seen()`, as
  the shown state reads it: the human is looking at it) **(decided 2026-11-18, topic 54)**. It is raised
  **through the same three calls as `topicFor`**: `setTopics`, `noticeTopics(project, before,
  after)`, `changed()` — so it sounds, toasts and notifies as a raised topic does, and keeps 1.167's
  silence while away (F8). Fields: `from` = the waiting session, `blocking: true`, `task` = its
  current task, a new optional field **`kind: 'permission'`**, `title` "‹name› is waiting at a
  permission prompt", `context` "Answer it in its tab. Menkar closes this topic once it is
  answered." (English, as stored and as `topic_list` gives them).
- **Shown in the user's language** (F13): main resolves the title and the context of a `kind:
  'permission'` topic through `t()` with the session's current name, in **one function**
  (`permissionTopicText`), used by `topicViews`, `doneTodayView` and `noticeTopics` before
  `notifyTopic`. The renderer and `TopicView` do not change. The stored `decision` ("The prompt was
  answered") is drawn nowhere and stays English.
- **Closed** by Menkar (`status: closed`, `decision` "The prompt was answered") when the session
  has stayed out of `blocked` for **`PERMISSION_CLOSE_MS` = 3,000 ms**, or its pane exits. A return
  to `blocked` within those 3 s cancels the close: one topic for a chain of prompts **(decided 2026-11-18, Q7,
  topic 54)**.
- **Kept out of Done today** and **its notice opens the waiting session's pane**, not the
  orchestrator's tab **(decided 2026-11-18, topic 54)**: `doneTodayView` skips a closed `kind:
  'permission'` topic, and `noticeTopics`' `onClick` reveals `paneOfSession(topic.from)` when the
  topic is a permission topic and the pane exists.
- **No duplicates**: the check is "an open or discussing topic with `kind: 'permission'` and this
  `from`"; the topic's number is kept in memory per pane only to cancel the close; on start main
  closes every open `kind: 'permission'` topic (their processes are gone).
- **The human closing it by hand**, or the orchestrator with `topic_close`, is allowed; the next
  block raises a new one.
- **Wired before `onShownChange`'s return on a null `turnEnd`** (F19): the topic and the
  `permission:‹child›` inbox entry read no transcript, so a child whose agent has no turn-end
  reading still raises them.
- **Plan 41's pill** reads the same `blocked` pane state; nothing of it changes.

### 2.7 Every agent: the kit concern

- **`PromptInbox`** in `src/main/agents/types.ts`, `MainAgentKit.inbox: PromptInbox | null`:
  `publish(pane, sessionId, dropped, entries): Promise<void>` (writes the file of 2.3, or removes it
  when `entries` is empty), `delivered(transcript, from): Promise<{ through: number; offset: number
  }>` (the highest `seq` the new `hook_additional_context` records name, 0 if none, and the offset
  read to), `forget(pane): Promise<void>` (removes the file). Reading Claude's transcript format is
  why it is the kit's.
  **Claude's** is `src/main/agents/claude/inbox.ts`; **Cursor's is `null`**.
- **A Cursor orchestrator** has no MCP mount and no hook: it can read its inbox neither way. That
  is no regression (it has no waker today) and is out of scope: Cursor in the orchestration mode
  is plan 39's (§3). The inbox of such a project still keeps its 30 entries.
- The hook's declaration lives in Claude's settings file, already Claude's kit's `settings`
  concern; Cursor's is `null`.
- **The routing (2.1) is shared code** and never asks the agent: it reads the kit's `inbox`
  nullness for Q1's condition, and the `turnEnd` reading's nullness as today.
- **Not changed here:** a Cursor child's turn end still reads no transcript (`onShownChange`
  returns on a null `turnEnd` after the permission wiring of 2.6).

### 2.8 What agents read

| File | Change |
|---|---|
| `plugin/skills/orchestrator/SKILL.md`, "When you are woken" | Two wakes: "‹name› set task N to review" (read the report with `last_reply`, then `closing-a-task.md`) and "‹name› (task N) asks" (answer by `SendMessage` to it by name, or raise a topic when the human must decide). The rest arrives **from your inbox**, unseen by the human, with your next prompt of any kind, or with `inbox` (call it when the inbox's last line says "N more: call inbox."): what each inbox line means — took control / handed back, away / back (the preliminary summary when back), a topic to discuss, a turn ended without a report (`last_reply`, then ask it with SendMessage if needed), a permission prompt (Menkar raised the topic: do not raise another), a question that could not be posted, a task to review. **After Menkar restarts, your inbox holds only the tasks to review: read `task_list`, `topic_list` and `list_sessions` for the rest** (F11). |
| `plugin/skills/orchestrator/workers.md` | One line: sessions report with `task_review` and ask with `ask`; a SendMessage from one still reaches you. |
| `plugin/skills/worker/SKILL.md`, "Your task's steps", "Never invent" and "Your report" | Ask your parent with `ask`, not SendMessage; it does not wait: go on, or set the task waiting and end your turn. **Blocked: say so with `ask`.** `task_review` before the report wakes the orchestrator at your turn's end. **With no task number, send your report to your parent by name** (F9). |
| `plugin/team/common.md`, the report line (`:4`) | "When your task is done, call `task_review`, then write your report as your last message: it is read with `last_reply`. If you are blocked, say so with `ask`. With no task number, send your report to your parent by name. If the session that handed you the work is not your parent, also send it your report by name." |
| `plugin/team/claude.md` | Unchanged (SendMessage stays how a parent answers and how non-parents are told). |
| `plugin/guide/orchestration-mode.md` | "Away or here" (`:176–182`): "hears … with its next prompt, or when it reads its inbox"; a short "The inbox" paragraph after "Notifications"; the permission topic Menkar raises. |
| `src/core/control/protocol.ts` | Block 2: the `inbox` and `ask` tools and their descriptions. Block 4: `task_review`'s description gains "At your turn's end it wakes the orchestrator." |

### 2.9 Open decisions, each in one place

| | Status | Built as | Used in |
|---|---|---|---|
| Q1 | **decided 2026-11-18, topic 54** | The inbox only for a mode-on project's orchestrator; other parents as today | 2.1, 2.7, B3 |
| Q2 | decided (`set`, 2026-11-18) | The tool is named `ask` | 2.5, B2, B4 |
| Q3 | decided (`set`, 2026-11-18) | `ask` does not change the task; the session sets it waiting itself | 2.5, B2 |
| Q4 | **decided 2026-11-18, topic 54** | The hook gives the inbox with any prompt the model sees (the human's, a wake, a peer's), not only the human's | 2.2, 2.3, B1 |
| Q5 | decided (`set`, 2026-11-18) | The answer by SendMessage; `answer` deferred | 2.5, B4 |
| Q6 | **decided 2026-11-18, topic 54** | The permission topic for every child of the orchestrator not "with you" | 2.6, B1, B3 |
| Q7 | **decided 2026-11-18, topic 54** | Raised at once unless the pane is seen; closed 3 s after the prompt is answered; kept out of Done today; its notice opens the waiting session | 2.6, B1, B3 |
| Q8 | decided (`set`, 2026-11-18) | The review wake for any assignee of the project, child or not | 2.1, 2.4, B3, B4 |

### 2.10 Rejected, and why

- **Polling** (the orchestrator checks every few seconds): it acts only within a turn, so each poll
  is a turn — the noise this plan removes (1.178).
- **A JSON file for the inbox**: 2.2; nothing in it outlives the processes it is about, and the one
  thing that does (a task to review) is rebuilt from `tasks.json` at start.
- **The hook asking main through `callMenkar`**: the prompt would wait on main's request loop (up
  to `RESPONSE_WAIT_MS`), and a response written after the hook gave up would clear entries never
  delivered. The file has one writer and no wait.
- **The hook clearing the file itself, or writing an ack when it prints**: the hook runs and the
  model sees nothing when another hook blocks the prompt (§2.3, 13b), when the hook times out, and
  possibly when a queued message is withdrawn; an ack or a clear on printing loses those entries.
  The transcript's record is written only for what the model got.
- **The hook skipping prompts it knows the model will not see** (a `/` built-in): built-ins do not
  run it at all (§2.3, 9), and the cases that do lose output cannot be told apart from stdin.
- **Waking at `task_review`'s call**: the report is not written yet (2.4).
- **`ask` through the batcher**: its answer would have to promise a post it has not made, and a
  batch is lost whole if the parent's id changes inside the wait (F2); a question is shown anyway.
- **`ask` waiting for the answer inside the call**: the turn would show `working` for minutes and
  hold the MCP call past `RESPONSE_WAIT_MS`; 1.178 asks for a call that does not block.
- **Folding inbox lines into the review/question wakes' text**: they would be visible again; the
  hook gives them with the wake, invisibly.
- **A count " · N in your inbox" in the wake frame**: needless once the hook runs on wakes.
- **The hook skipping prompts that start with "[Menkar] "** to deliver only with the human's:
  delivery is invisible either way, the orchestrator would act later, and a peer's SendMessage
  cannot be told apart by its text (Q4).
- **Resetting `seq` with the inbox**: a record confirming `seq` 7 earlier in the run would drop
  the new inbox's first seven entries (F6).
- **A per-child slot in the batcher for the review**: a second event of the child would replace it
  (F1).
- **Raising the permission topic only after a delay** (Q7's other option): a prompt answered within
  the delay raises nothing, but the human may be away and the topic is what holds it; not raising
  it while the pane is seen covers the quick prompt the human is answering.
- **The hook only in the orchestrator's settings**: the mark can move to a running session, which
  never re-reads `--settings`; the `[ -f … ]` guard makes it free elsewhere.
- **Keeping block 2's routing apart from the texts** (the order the first draft had): a commit of
  the routing alone sends events to an inbox nothing reads (F3).

## 3. Out of scope

- A separate interface to talk with the orchestrator (`docs/NOT_BUILT_YET.md`, kept, narrowed).
- Cursor in the orchestration mode: a Cursor orchestrator reading its inbox, a Cursor child's turn
  end (2.7).
- The `answer` tool (Q5).
- Windows' form of the hook's guard (`docs/NOT_BUILT_YET.md` already holds Windows).
- Anything in plan 41's §2 (tabs, peek, pills, the sidebar).
- The task flow metrics (1.156).

## 4. Do not touch

- `postToSession`, `wakeFrame`'s bytes, `postCounts`, the registry read, `crossSessionInbound`.
- The team updates' path (`src/main/team.ts`, "[Menkar] Team update:") and its settle.
- `reportClosedTurn` / `TurnEndReading`: used as they are.
- Topics' existing fields and their file's version: `kind` is optional and new. An older Menkar
  that rewrites the file drops it (`parseTopic`); the topic then shows its English title.
- `src/shared/workspace.ts` and the renderer's topic row: 2.6 resolves the text in main.
- Plan 41's files outside the lines this plan names; `e2e/background-workers.spec.ts`.
- The worktree `/home/hernan/git/menkar-multi-agent`.
- The human's `~/.claude` and running Menkar: the hook is probed only in a throwaway home.

### The seam with plan 41

Plan 41's §4 ("The seam with 1.178") names the files both plans touch: `src/main/workspace.ts`,
`src/core/control/protocol.ts`, `src/renderer/app.ts`, `e2e/session-control.spec.ts`,
`e2e/fixtures.ts`, `plugin/guide/orchestration-mode.md`, `plugin/skills/orchestrator/workers.md`,
`docs/orchestration.md`, `docs/session-control.md`, R10's files, and the `ui-check` lock. Plan 42
also touches `src/core/i18n/en.ts`, `es.ts` and `e2e/orchestration.spec.ts`, which plan 41's blocks
3–5 touch.

- **Block 1** touches none of those files. It runs **beside plan 41's blocks 4 and 5, never
  beside its block 3 or 6** (`plans/00-STATUS.md`, plan 42's row). Because plan 41's `ui-check`
  builds the app from the shared tree, block 1 writes its `statusline.ts` change last, in one
  edit once its own tests pass, and tells `set` before it does, so it does not land during a plan
  41 `ui-check`; it runs no `ui-check` itself.
- **Blocks 2–4 start after plan 41's block 6 is committed** (its R10 refreshed on `main`), so plan
  42's R10 moves are never in a tree with plan 41's.
- Behaviour while only plan 41 is in: a background worker at a prompt wakes its parent and shows
  the pill; block 3 removes the wake and adds the topic, reading the same `blocked`.

## 5. Execution blocks

One worker at a time per block; every block ends with `npm run ci` green, its output in the report.
**Commits:** block 1 alone; block 2 alone (it adds tools and a hook that nothing routes to: safe in
a .deb by itself); **blocks 3 and 4 are one commit, and no package is cut between them** (block 3
changes what the orchestrator is woken for; block 4 tells it so).

### Block 1 — the inbox, the routing, the batcher's entry, the permission topic, the hook's program (core only)

Files: new `src/core/orchestration/inbox.ts`, new `src/core/orchestration/inbox-text.ts`, new
`src/core/orchestration/permission.ts`, `src/core/control/events.ts`,
`src/core/orchestration/topics.ts`, `src/core/control/files.ts` (`controlPaths().inbox` only),
`src/core/context/statusline.ts` (`runPromptSubmit`, `inboxDir`, the `prompt-submit` argument, the
header's import list; **not** `settings.ts`), new `tests/core/orchestration/inbox.test.ts`, new
`tests/core/orchestration/permission.test.ts`, `tests/core/control/events.test.ts`,
`tests/core/context/statusline.test.ts`, `tests/core/sessions/lastreply.test.ts`, and
`src/core/sessions/lastreply.ts` only if that test fails, new `src/core/agents/claude/inbox.ts`
(`deliveredThrough`, the transcript records' parser) and its test in `tests/core/agents/claude/`.

- [ ] Tests first, each a decision's sentence in its comment:
  - `Inbox`: add three keys → `inboxText` lists them oldest first with `HH:MM:SS`; a same key
    replaces and goes last (away then back → one line "The human is back"); `retract(key)` removes
    unread; 31 adds → 30 kept, first line "(1 earlier events dropped)", `dropped` 1; `take()`
    empties; `deliveredThrough(n)` drops `seq ≤ n`; **after `deliveredThrough(7)` and `clear()`, a
    new entry has `seq` 8 and is given** (one counter per run, F6); `clear({ keep: ['presence'] })`
    keeps the presence entry (F23); at 23:59:59 → 00:00:01 the order is by `seq`; a clock jumping
    back keeps `seq` order.
  - `inbox-text.ts` imports nothing; `statusline.ts`'s imports are Node's and three of Menkar's
    (read from the source's import declarations with the TypeScript compiler API, not grep).
  - `route(input)` in `events.ts` → `'wake' | 'inbox' | 'none'`, from the record of §2.1, **one
    case per rule and one per overlap**: a pending review with a SendMessage to the parent closing
    the turn → wake; a pending review with a renew → wake; a pending review in a turn only team
    updates opened → wake; a renew alone → none; team updates alone → none; a SendMessage to the
    parent → none; an `ask` earlier, then the turn ends → inbox; a non-child with nothing pending →
    none; blocked → inbox; mode off (`parentIsOrchestrator` false) → today's `wakeEvent` and
    `wakesParent` unchanged.
  - `WakeBatcher.wake`: two `wake`s of one child with two keys inside the wait both arrive, in
    order; a `wake` and a `note` of one child both arrive; a ★ child's `wake` comes before an
    unstarred child's `note`; `send` receives the entries with their keys.
  - `PermissionTopics` (pure, timers injected as `WakeBatcher`'s): blocked → raise once; blocked
    again while open → nothing; blocked while its topic is `discussing` → nothing; out of blocked →
    close after 3,000 ms (at 2,999 still open); re-blocked at 2,000 ms → no close, no second topic;
    pane exit → close at once; "with you" → no topic; not the orchestrator's child → no topic; the
    pane seen → no topic (Q7).
  - `topics.ts`: `kind: 'permission'` round-trips; a file without it reads as today; one with an
    unknown `kind` value reads as no kind.
  - `runPromptSubmit`: no file → no output; another `session_id` → no output; entries 1–3 → output
    with three lines and the first line naming "(events 1–3)"; run again → the same output (the hook
    clears nothing); the hook's folder holds no file it wrote; `dropped` 2 → "(2 earlier events
    dropped)"; a
    corrupt file → no output, exit 0; `inboxDir()` equals `controlPaths().inbox`; 30 entries of 120
    characters → `additionalContext` under 1,500 bytes, last line "N more: call inbox.", the first
    line naming only the entries given; exit 0 and no stderr in every case.
  - `deliveredThrough` from records: a transcript fixture with two `hook_additional_context`
    records "(events 1–3)" and "(events 4–4)" and one `hook_success` → 4; read again from the
    returned offset with nothing new → 0; a record before the start offset → ignored; the fixture's
    bytes and mtime unchanged after reading. (Core, `src/core/agents/claude/inbox.ts`; main's
    `src/main/agents/claude/inbox.ts` calls it as the kit's `delivered`.)
  - `lastreply.test.ts`: a turn whose transcript holds a `hook_additional_context` attachment
    record gives the same `last_reply`, `onlyTeamUpdates` and `reportedTo` as without it.
- [ ] Build them. See each new test fail once against an injected defect (`<` for `≤` in the
  delivered filter; `seq` reset in `clear()`; the batcher keying `wake` by child), then remove it.
- Verify: `npm run ci`. Nothing calls the new code yet; R10 does not move.

### Block 2 — the plumbing, routing nothing: the kit concern, the inboxes, `inbox`, `ask`, the hook's declaration

Files: `src/main/agents/types.ts`, new `src/main/agents/claude/inbox.ts`,
`src/main/agents/claude/index.ts`, `src/main/agents/cursor/index.ts`, new `src/main/inbox.ts` (the
per-project inboxes and their publishing), `src/main/control.ts` (the `inbox` folder, emptied at
start), `src/main/workspace.ts` (`handleControl`'s two cases, `wakeSession`'s outcome, publishing on
the orchestrator's pane or id changing, a pane's files at its exit), `src/core/control/files.ts`
(`TOOL_NAMES`), `src/core/control/protocol.ts` (the two tools), new `src/core/orchestration/ask.ts`
and `tests/core/orchestration/ask.test.ts`, `src/core/context/settings.ts` (`promptSubmitHooks`),
`tests/core/context/settings.test.ts`, `tests/core/control/server.test.ts`,
`tests/core/agents/parity.test.ts` if it lists `MainAgentKit`'s members, `e2e/fixtures.ts` (the
stand-in's `ASK` and `INBOX` words), `e2e/session-control.spec.ts`, R10's `mcp-tools-list.json` and
`settings.json`. **After plan 41's block 6 is committed.**

- [ ] Tests first: `askTool`'s answers of 2.5 with their exact sentences (posted; not posted to a
  mode-on orchestrator → the inbox entry; not posted otherwise; no parent; empty; 2,001
  characters), the wake text with and without a task; `inbox`: not the orchestrator → "Only the
  orchestrator has an inbox."; mode off → "The orchestration mode is off in this project."; empty →
  "Your inbox is empty."; three entries → `inboxText`, then empty; an entry a transcript record
  confirmed is not given again. `settings.test.ts`: `UserPromptSubmit` with the guarded command and
  `"timeout": 5`, the statusline's path quoted as the other hooks are.
- [ ] `PromptInbox` in the kit types; Claude's writes and removes the file of 2.3 and confirms delivery from the transcript; Cursor's
  `null`.
- [ ] `src/main/inbox.ts`: the inboxes per project, the run's counter and `run` id, `publish` on
  each change and on the orchestrator's pane or id changing (2.3); `startControl` empties the
  folder; a pane's exit forgets its files.
- [ ] `wakeSession` returns its outcome; `ask` posts directly and answers from it.
- [ ] e2e (stand-in): a worker calls `ask` → its MCP call answers "Sent to …" within a second, the
  orchestrator gets "[Menkar] worker (task N) asks: …"; the orchestrator calls `inbox` → "Your
  inbox is empty."; an inbox file written by the test for the orchestrator's pane, then RENEW →
  the new pane's file holds the entries with the new session id, the old pane's file is gone (F5).
- [ ] A probe with `scripts/agent-probes/claude/` in a throwaway home, by `claude-cli` or with its
  harness: a Menkar-written settings file, an inbox file with two entries → the model echoes both
  lines on the next prompt, the screen shows nothing of them, and the transcript's record names
  "(events 1–2)"; then a message queued mid-turn and withdrawn with Esc → whether a record is
  written (§2.3). Its output in
  `$MENKAR_FILES/‹worker›-42-hook-probe.txt`.
- [ ] R10: `npx vitest run -u tests/core/r10.test.ts`; `git diff --stat tests/core/r10/` shows only
  `mcp-tools-list.json` and `settings.json`; anything else is reported before it is kept.
- Verify: `npm run ci` green (R10 included); `npm run ui-check` under the lock `set` names.

### Block 3 — the routing: events to the inbox, the review wake, the permission topic

Files: `src/main/workspace.ts` (the wake section `:2058–2126`, `askPresence`, the control and topic
posts, `taskFor`'s review path, `renew`'s mark before its first await, `topicViews`,
`doneTodayView`, `noticeTopics`, `showTopic`'s target, start-up), `src/main/inbox.ts`,
`src/core/i18n/en.ts`, `src/core/i18n/es.ts` (the permission topic's title and context),
`e2e/orchestration.spec.ts`, `e2e/session-control.spec.ts`. After block 2. **Committed with block
4.**

- [ ] e2e first, on the stand-in (as `session-control.spec.ts:299` does today):
  - a worker under the orchestrator, its pane not shown, reaches a permission prompt → **no post**
    to the orchestrator within `WAKE_DELAY_MS` + 1 s; the toast "Topic N: worker is waiting at a
    permission prompt" appears (F8); a blocking topic appears in "Awaiting you"; the prompt
    answered → the topic closes after 3 s and is not in Done today; the inbox file of the
    orchestrator's pane holds one entry; while away (`AWAY`), the same prompt raises the topic with
    no toast; the same worker with its pane shown → no topic (Q7);
  - take control / hand back (`orchestration.spec.ts:1000`, `:1012`) and discuss topic 3 (`:671`)
    → **no post**, the inbox file holds the lines; rewrite those assertions;
  - away/back (`session-control.spec.ts:535–640`) → no post; the inbox holds "The human is back";
  - a worker calls `task_review` then ends its turn → **one post** "worker set task N to review:
    …" and no "finished its turn"; the same with a SendMessage to the parent as the turn's last
    call → still one post (F7); the same worker ends a turn without it → no post, an inbox entry;
  - with the mode **off**, a child at a prompt still wakes its parent as today (Q1).
- [ ] Route `onShownChange`'s outcome and the three human posts through `route`, with the turn end
  of 2.1 (`turnOpen`; idle/done from working or blocked, `turnEnded`, the pane's exit); the batcher
  keeps only wakes; `forget` becomes `retract` on the inbox for `human_back`.
- [ ] The pending review per session in `taskFor`'s success path (assignee only); its wake through
  `wakes.wake` to `orch:‹project›`; the flush resolves the address and falls back to the inbox
  (2.4.1).
- [ ] `PermissionTopics` wired **before** the null-`turnEnd` return, to the pane's exit, and to
  start-up (close every open `kind: 'permission'` topic); raised through `setTopics`,
  `noticeTopics`, `changed`; `permissionTopicText` in `topicViews`, `doneTodayView`,
  `noticeTopics`; the notice's click reveals the waiting pane.
- [ ] Start-up: one inbox entry per task in `review` waiting on the orchestrator (2.2).
- [ ] The mark moving keeps `presence` (F23); renewing panes add nothing (rule 2, read before any
  await).
- Verify: `npm run ci`; `npm run ui-check` under the lock `set` names; screenshots in
  `$MENKAR_FILES` as `‹worker›-42-b3-*`: the permission topic in "Awaiting you" (English and
  Spanish), its toast, and the list after it closed (Done today without it).

### Block 4 — what agents read, the docs, R10 (on `main`, with `set`; committed with block 3)

Files: every file of §2.8's table, `docs/session-control.md`, `docs/context.md`, `docs/agents.md`,
`docs/orchestration.md`, `docs/NOT_BUILT_YET.md` and their `docs/history/` files, R10's
`team-blocks.txt`, `team-posts.txt` if a team post quotes the report line, and the plugin files
R10 snapshots. After block 3.

- [ ] The texts of §2.8, `task_review`'s description; the docs per the exit table, with the history
  moves in the same change.
- [ ] R10: `npx vitest run -u tests/core/r10.test.ts`; `git diff --stat tests/core/r10/` shows only
  §2.8's files; anything else is reported before it is kept.
- Verify: `npm run ci` (the history check included).

## 6. Decisions and questions

### 6.1 Decided

- **Q2** — the question tool is named `ask` (`set`, 2026-11-18).
- **Q3** — `ask` does not set the asker's task waiting; the session calls `task_progress
  waiting_on` itself when it stops (`set`, 2026-11-18).
- **Q5** — the answer reaches the session by the orchestrator's `SendMessage`; `answer` deferred
  until an agent without messaging is a worker (`set`, 2026-11-18).
- **Q8** — a review from any assignee of the project, child of the orchestrator or not, wakes the
  orchestrator: `task_review` is a report (`set`, 2026-11-18). The other option, children only,
  was rejected: a consultant with a task (1.148) would report to nobody.

### 6.2 Pending

- **Q1 (decided 2026-11-18, topic 54)** — Who has an inbox? (a) only a mode-on project's orchestrator; other
  parents keep today's wakes. (b) every parent. **Recommended (a)**: 1.178 speaks of the
  orchestrator; a parent with the mode off is an ordinary session whose human reads its chat.
- **Q4 (decided 2026-11-18, topic 54)** — The hook runs on every prompt, wakes and peers' messages included.
  (a) give the inbox with any prompt the model sees; (b) only with the human's, skipping prompts
  that start with "[Menkar] " (a peer's SendMessage cannot be told apart). **Recommended (a)**:
  delivery is invisible either way, so earlier costs nothing; it reads 1.178's "with the human's
  next message" as "at the latest with it".
- **Q6 (decided 2026-11-18, topic 54)** — Which sessions get Menkar's permission topic? (a) every child of
  the orchestrator not "with you"; (b) only workers (no role); (c) every child. **Recommended
  (a)**: an expert at a prompt is as unseen as a worker; "with you" is in front of the human.
- **Q7 (decided 2026-11-18, topic 54)** — What the permission topic costs on the screen (F20). Every closed
  topic is a row in Done today and burns a number (`topics.ts:9`); a worker in the default
  permission mode asks many times per task; a prompt the human is already answering raises a topic
  at once; its notice opens the orchestrator's tab. (a) raised at once, closed 3 s after the answer,
  a Done today row, the notice opening the orchestrator's tab — what topic 54 shows today;
  (b) **as (a), but not raised while the pane is seen, kept out of Done today, and its notice
  opening the waiting session**. **Recommended (b)**: the human sees what costs nothing and is led
  to the session that waits. Both options are with the human in topic 54.
### 6.3 The review's findings and what changed

| Finding | Verdict on the tree | What changed |
|---|---|---|
| F1 two wakes of one child, one kept | Confirmed (`events.ts:37–47`, `:59–66`) | 2.4.1: `WakeBatcher.wake` with keys `review:‹child›:‹task›`; `ask` not batched (2.5); block 1's tests |
| F2 a wake not posted is dropped; `ask` said "Sent" | Confirmed (`workspace.ts:2108–2124`, `:2101`, `:2178–2183`) | 2.4.1: the address resolved at flush, `wakeSession`'s outcome, the inbox as fallback; 2.5: `ask` posts at once and answers from the outcome |
| F3 block 2 alone routes to an unread inbox | Confirmed | §5 reordered: block 2 plumbing only (tools, hook, inboxes, nothing routed); blocks 3 (routing) and 4 (texts) one commit, no package between |
| F4 cases where the hook runs unseen | Measured by `claude-cli` on 2.1.327: one case (another hook blocking with exit 2), two unmeasured (a withdrawn queued message, the timeout); built-ins never run the hook | §2.3: the table; the hook writes no ack; main confirms delivery from the transcript's `hook_additional_context` records, so a hook that ran unseen loses nothing; block 2's probe measures the withdrawn queued message |
| F5 the file not rewritten on renew, `/clear`, resume | Confirmed (`:928`, `:1778`, `:2183`; `control.ts:44–46`) | 2.3: publish on the pane or id changing, files removed at exit, folder emptied at start; block 2's e2e |
| F6 `seq` restarting inside a run | Confirmed by the design's own rules | 2.2: one counter per run, never reset; block 1's test |
| F7 no order among the rows; `blocked` → `idle` missed | Confirmed (`shown.ts:25–29`, `events.ts:12`) | 2.1: the turn end defined once, rules in order, a pending review always wakes; `route` takes a record; one test per overlap |
| F8 the topic raised without a notice | Confirmed (`noticeTopics` has one caller, `:1666`) | 2.6: raised through `setTopics`, `noticeTopics`, `changed`; block 3's e2e (toast; none while away) |
| F9 blocked or task-less work loses its wake | Confirmed (`common.md:4`) | 2.8: the team line and the worker skill name both cases |
| F10 a non-child assignee wakes nobody | Confirmed (`:2082`) | Q8, decided by `set` (2026-11-18): any assignee's review wakes the orchestrator |
| F11 nothing to re-read after a restart | Confirmed (`SKILL.md:37–38` is about something else) | 2.2: tasks to review rebuilt into the inbox at start; 2.8: the skill names what to re-read |
| F12 an early `ask` silences the turn end | Confirmed against 1.173 | 2.1 rule 5: the inbox entry after an `ask` too |
| F13 the topic's text in four places, not the renderer | Confirmed (`orchestration.ts:742–766`, `work.ts:290`, `:610`, `agentstate.ts:140–151`) | 2.6: `permissionTopicText` in main, used by three callers; the renderer, `TopicView` and `src/shared/workspace.ts` untouched; "the red pill" dropped from the context |
| F14 Cursor reading with `inbox` | Confirmed (`cursor/index.ts:10`) | 2.7 and §3: neither way; out of scope, no regression |
| F15 no place for `dropped` | Confirmed | 2.3: the file carries `dropped` |
| F16 block 3 ends red | Confirmed | Each block refreshes the R10 files it moves; every block ends green |
| F17 files missing | Confirmed (`fixtures.ts:199–219`) | `e2e/fixtures.ts` in block 2; `protocol.ts` split (tools in 2, `task_review` in 4); `src/shared/workspace.ts` not needed (F13) |
| F18 the statusline's import limit | Confirmed (`statusline.ts:6–16`, `events.ts:30–35`) | 2.3: `inbox-text.ts` imports nothing; `Inbox` apart; a test reads the imports |
| F19 permission wiring behind the null `turnEnd` | Confirmed (`:2077`) | 2.6: wired before that return |
| F20 the topic's cost on the screen | Confirmed (`:610`, `topics.ts:9`, `:1711`, `:3032`) | Q7 rewritten with both options, recommending (b); "open" includes `discussing` |
| F21 block 1 beside plan 41's blocks 2–5 | Confirmed: it contradicted `00-STATUS.md` | `set` confirmed (2026-11-18). §4's seam: block 1 beside plan 41's blocks 4–5 only, never 3 or 6, its `statusline.ts` edit announced to `set`; blocks 2–4 after plan 41's block 6 |
| F22 the renew gap | Confirmed (`:1772`, `:1779`, `:1790`) | 2.1: `renew` marks the pane before its first await; rule 2 read synchronously |
| F23 `presence` lost on a mark move | Confirmed | 2.2: `presence` kept across a mark move |

**Where this plan departs from the review:** F16's "the block that adds the tools refreshes that
file itself" makes R10 move in two blocks of this plan (2 and 4) instead of once. The purpose of
plan 41's "R10 is refreshed once per plan" — never one plan's R10 moves in a tree with the other's
— still holds: both blocks run after plan 41's block 6 is on `main`.

## 7. Execution log

(Written by the session that executes it.)

### Block 1 — `menkar-t89` (task 89), 2026-11-18

**Built** (core only; nothing calls it yet, R10 does not move):

- `src/core/orchestration/inbox-text.ts` (new): `INBOX_TEXT_MAX_BYTES` = 1,500, `InboxLine`,
  `inboxText(entries, dropped, maxBytes?)`. Imports nothing; formats the local time from `at` with
  `new Date(at)` (the code rule only forbids the argument-less form).
- `src/core/orchestration/inbox.ts` (new): `INBOX_MAX` = 30, `sequence()` (the run's one counter,
  passed to every `Inbox`), `Inbox` with `add`, `retract`, `entries`, `dropped`, `text`, `take`,
  `deliveredThrough`, `clear({ keep })`.
- `src/core/control/events.ts`: `WakeBatcher.wake(parent, child, key, text)`; the `events` map is
  keyed by key and holds the child (a `note` keys by the child as before); `send` gets a third
  argument, the batch's `{ key, text }` entries, so main's two-argument callback compiles unchanged.
  The constructor's parameter properties became plain fields. `route(input)` with `RouteInput`
  and `Route`.
- `src/core/orchestration/permission.ts` (new): `PERMISSION_CLOSE_MS` = 3,000, `permissionTopic`
  (the stored English title and context), `PERMISSION_ANSWERED`, `openPermissionTopic`,
  `PermissionTopics` (`blocked`, `unblocked`, `exited`, `dispose`) over injected `actions`
  (`openTopic`, `raise`, `close`) and `Timers`.
- `src/core/orchestration/topics.ts`: optional `kind?: 'permission'` on `Topic` and `NewTopic`;
  `parseTopic` keeps it and drops any other value.
- `src/core/control/files.ts`: `controlPaths().inbox`.
- `src/core/agents/claude/inbox.ts` (new): `deliveredThrough(transcript, from)` → `{ through,
  offset }`, reading `attachment` records of `type: hook_additional_context`, `hookEvent:
  UserPromptSubmit`, whose `content` (an array of strings) names "(events a–b)".
- `src/core/context/statusline.ts`: `inboxDir()`, `PROMPT_SUBMIT_ARG` = `prompt-submit`,
  `runPromptSubmit(stdin, pane)`, the header's import list (three of Menkar's modules). Written
  last, after `set`'s go (§4's seam).
- Tests: new `tests/core/orchestration/inbox.test.ts` (with the two import checks, by the
  TypeScript compiler API), new `tests/core/orchestration/permission.test.ts` (with the `kind`
  round-trip tests), new `tests/core/agents/claude/inbox.test.ts`; added to
  `tests/core/control/events.test.ts`, `tests/core/context/statusline.test.ts` (the hook run as a
  process under `TZ=Asia/Tokyo`), `tests/core/sessions/lastreply.test.ts`. `src/core/sessions/
  lastreply.ts` unchanged: its test passed with the record.
- `tests/factories/transcript.ts`: `hookContext(text, hookEvent?)`, added with `set`'s ok; its
  shape is copied from `claude-cli`'s 2.1.327 probe transcripts (`/tmp/menkar-probe-claude-*`).

**Seen red**, each against a defect injected and removed: `<` for `≤` in `deliveredThrough`; the
sequence reset in `clear()`; `wake` keyed by the child; the review rule after the renew, team or
report rule; the `seen` check dropped; a return to `blocked` not cancelling the close; `kind`
dropped by the parser; the transcript read from 0 instead of the offset; any hook event counted; a
half-written last line read; the hook ignoring `session_id`; the hook without the budget.

**Choices the plan left open (mine):**

- The dropped count goes on the text's first line after the range: "Menkar's inbox (events 2–31)
  (1 earlier events dropped): …", so the first line holds both what main reads back and §2.2's
  wording.
- An entry too long for the budget alone (an `ask` can be 2,000 characters): the hook gives the
  header without a range and "N more: call inbox.", so nothing is confirmed and the tool gives it
  whole.
- `Inbox.deliveredThrough(n)` resets `dropped` when `n` reaches the first pending entry (the model
  got the line that said so); `take()` and `clear()` reset it too.
- `route`: `'human'` is an event of its own (always `inbox`); `parentIsOrchestrator: false` gives
  `none` for a prompt or a turn end without a pending review, since that session's own parent is
  woken by today's path, which `route` does not replace.
- `PermissionTopics.blocked` adopts an open or discussing permission topic of the session that it
  did not raise (an earlier pane's), and closes it in turn once the prompt is answered; it closes
  only a topic still open, so one closed by hand is never closed again.
- `deliveredThrough` on a file shorter than `from` confirms nothing and returns its size as the
  offset; the inode check stays main's (block 2).
- The hook prints nothing when any entry in the file is malformed, not only when the JSON is.

### Block 2 — `menkar-t100` (task 100), 2026-11-18

**Built** (plumbing only: nothing routes an event to an inbox yet; the only entry a running
Menkar can make is an `ask` its parent could not be woken for):

- `src/core/context/settings.ts`: `promptSubmitHooks(statuslineCommand)`, declared in every
  `--settings` file beside SessionStart and Stop: `if [ -f <inbox dir>/"$MENKAR_PANE".json ]; then
  <statusline command> prompt-submit; fi`, `"timeout": 5`; the folder is `shellQuote`d as a word.
- `src/main/agents/types.ts`: `PromptInbox` (`publish`, `delivered`, `forget`) and
  `MainAgentKit.inbox`. Claude's is new `src/main/agents/claude/inbox.ts` (writes
  `{ session_id, dropped, entries: [{ seq, at, text }] }` whole through `writeAtomic`, removes it when
  empty; `delivered` is core's `deliveredThrough`); Cursor's is `null`.
- `src/main/inbox.ts` (new): `Inboxes`, one `Inbox` per mode-on project with one `sequence()` for
  the run, fed by a `locate()` that workspace gives (each mode-on project → its orchestrator's pane,
  session id, transcript and kit, or null when it is not running; a project left out is not in the
  mode, and its inbox and file go). `sync()` compares where each orchestrator runs with the file last
  written and only then works; `add`, `paneTurned`, `paneExited`, `read` (for the tool). Every write
  goes through one queue per project: confirm from the transcript first (inode and size checked; a
  session first seen is read from its transcript's end, or from 0 when it has none yet), then write
  the file where the orchestrator runs now, removing the one of a pane it left; a file is not
  rewritten when its pane, session id, `dropped` and `seq`s are unchanged.
- `src/main/control.ts`: `startControl` removes and recreates `control/inbox`.
- `src/main/workspace.ts`: `orchestratorPanes()` and `inboxes` before `changed()`, which calls
  `inboxes.sync()` first; `sync()` after a pane starts, `paneExited` at its exit; a second
  `onShownChange` listener calls `paneTurned` on `working`, `idle` and `done` (the wake listener is
  untouched); `handleControl`'s `ask` (`askFor`) and `inbox` cases; `wakeSession` returns its
  `WakeOutcome` (`'no pane'` with no waker, `'error'` on a throw); the batcher still ignores it.
- `src/core/orchestration/ask.ts` (new): `ASK_MAX_CHARS`, `WakeOutcome`, `askText`, `askTool`
  (2.5's answers), `inboxTool`.
- `src/core/control/files.ts` (`TOOL_NAMES` + `ask`, `inbox`), `src/core/control/protocol.ts` (the
  two tools and their descriptions).
- Tests: new `tests/core/orchestration/ask.test.ts`; `tests/core/context/settings.test.ts`,
  `tests/core/control/server.test.ts`; `e2e/fixtures.ts` (`QUESTION`, `INBOX`),
  `e2e/session-control.spec.ts` (one test: ask posted and answered in under a second; `inbox`
  empty; the orchestrator unwakeable → the question in its pane's file; RENEW → the file is the new
  pane's, with the new id, the old one gone). `tests/core/agents/parity.test.ts` unchanged: it lists
  caps, not `MainAgentKit`'s members.

**Seen red**, each against a defect injected and removed: the settings test before the hook
existed; the server tests before the tools; `ASK_MAX_CHARS + 1`; the inbox fallback dropped; the
ask key without its number; the mode-off check dropped; `inbox` not emptying; in the e2e, the
old pane's file not removed (both at the pane change and at exit), and `ask` with no inbox
fallback.

**The hook probe** (`claude-cli`, Claude Code 2.1.327, `$MENKAR_FILES/menkar-t100-42-hook-probe.txt`):
the model got both lines and "(events 1–2)", the screen showed nothing, and the transcript holds a
`hook_additional_context` record with that text; the hook clears nothing, so a second prompt got
them again. A queued message withdrawn with Up writes no record and the model saw nothing: no loss,
nothing to report before block 3. Esc does not withdraw a queued message: it interrupts the tool
and submits it, which the model sees and the transcript records.

**R10** moves in exactly `tests/core/r10/mcp-tools-list.json` and `tests/core/r10/settings.json`;
not refreshed, as `set` asked (it refreshes them on `main`). Until then `npm run ci` fails on those
two snapshots only. The settings snapshot first held the test's temporary cache path (the
hook's guard names the inbox folder): `tests/core/r10.test.ts` now pins `XDG_CACHE_HOME` to
`/home/demo/.cache` for that test, as the statusline's path is pinned (fix asked by `set`; my choice
of the two it offered, since it keeps the hook's command as it is).

**Decided by `set`, 2026-11-18:**

- The plan's e2e premise was corrected: a test cannot write the inbox file for main, which is its
  only writer and holds the entries in memory (a written file is replaced at the next publish).
  The entry comes in through `ask` with the orchestrator unwakeable, then RENEW.
- The `inbox` tool's answers are a pure `inboxTool` in `src/core/orchestration/ask.ts`, tested in
  `ask.test.ts`, so no test file outside the block's list.
- The stand-in's words are new ones because its `ASK` already prints a permission question. `set`
  approved `ASKPARENT`; it is `QUESTION`, since typing `ASKPARENT` passes through `ASK` and the
  stand-in prints a permission question there.
- **No run id**: §5's "the run's counter and `run` id" has no consumer. The one counter per run
  (F6) plus reading a transcript from its end the first time a session is seen already keeps an
  earlier run's records from confirming this run's entries. Block 3 should not add it back.

**Choices the plan left open (mine):**

- An empty `ask` (or not text) answers "Write the question to ask."; the question is trimmed
  before the checks and the post.
- `ask`'s "(task N)" is the asker's `currentTask` only when it is in progress or waiting.
- `ask` puts the question in the inbox when the parent is the project's orchestrator in the
  mode (`workerTeam(project).orchestrator`), whatever its agent; a Cursor orchestrator's inbox keeps
  it unread (§3).
- The inbox's emptying when the mark moves (keeping `presence`) is left to block 3, which lists it;
  block 2 empties a project's inbox only when the mode goes off. The file follows the mark either
  way.
- Main reads the transcript when the orchestrator's pane turns `working`, `idle` or `done`, before
  each publish and on `inbox`; never on the UI path.
- The `inbox` tool gives the text with no budget, so a long question comes whole there.
- `startControl` empties the folder after `startWorkspace` has run; no inbox entry exists before
  `startControl` today, but block 3's start-up review entries must be added after it.

### Blocks 3 and 4 — `menkar-t101` (task 101), 2026-11-18

**Block 3, built** (with plan 43's block 3b `askPresence` half):

- `src/main/workspace.ts`, the wake section: `inboxOrchestrator(project)` (the mode on, an
  orchestrator, and its kit's `inbox` non-null; Q1); `turns` per pane (`open`, `ended-shown`,
  `ended-stop`) so a turn ends once, at the first of the shown state leaving `working`/`blocked`
  for `idle`/`done`, the Stop record (`stopRecorded`, called first in `turnEnded`) and the pane's
  exit; `turnEnd` applying `route` (renewing read before any await; the transcript read only when
  rules 1–2 do not settle it); `reviews` per session, noted by `noteReview` in `taskFor`'s success
  path (the assignee, the task now `to review`, not the orchestrator); the review wake through
  `wakes.wake('orch:‹project›', …)`, its key `review:‹session›:‹task›`; `sendWake` resolving
  `orch:` at flush and falling back to `inboxes.add` per entry when not posted. Today's path
  (`wakesParent`, `wakes.note`) is unchanged for every parent that is not the inbox orchestrator.
- The permission topic: `PermissionTopics` wired in the first `onShownChange` listener before the
  turn-end reading is asked (F19), to `onPaneExit`, and `closeLeftPermissionTopics()` at the start
  of `startWorkspace`; `raisePermissionTopic` through `addTopic`, `setTopics`, `noticeTopics`,
  `changed`; `permissionTopicText` (t() with the session's name now) in `topicViews` and the
  notice; `doneTodayView` skips closed permission topics; `showTopic` reveals the waiting pane for
  a permission topic, so both the toast's Show and the desktop notice lead there. `paneSeen(pane)`
  factored out of the pane's `seen` lambda, for `seen` in the subject.
- The human's posts: `askPresence`, take control / hand back and `discussTopic` add to the inbox
  when the project's orchestrator is the inbox orchestrator, else today's `wakes.post`; the
  orchestrator that set away or back has `presence` retracted. `askFor` retracts `turn:‹asker›`.
  `renewing` holds `null` from `renew`'s start (before its first await) until the hang-up sets the
  resolver; `onPaneExit` takes the renew path only on a resolver. `orchestratorMarkMoved` on the
  `setOrchestrator` action and the card's new orchestrator → `inboxes.moved` (keeps `presence`).
  `adopt_session`'s answer no longer says "wakes you when it waits or ends its turn".
- `src/main/inbox.ts`: `retract(project, key)` and `moved(project)`.
- `src/main/control.ts` (granted by `set`): `ControlHandlers.ready()`, called by `startControl`
  right after it recreates the inbox folder; workspace's `ready` waits for the first scan
  (`firstScan`), then adds "Task N is to review (‹assignee›): ‹note›" per task in To review waiting
  on the orchestrator (`review:‹task›`).
- `src/main/activity.ts`: `recordPresence(away)` → an `away` or `back` line; called by
  `askPresence` when the state changed (plan 43, F6).
- `src/core/i18n/en.ts`, `es.ts`: `topics.permissionTitle`, `topics.permissionContext`.
- e2e: `e2e/orchestration.spec.ts` (new: the permission topic, and the same in Spanish; rewritten:
  discuss topic and take control / hand back → inbox lines, no post), `e2e/session-control.spec.ts`
  (new: the review wake with the F7 case and the turn without a report; the start-up review entry;
  rewritten: away/back, the team-block turn test, block 2's `ask` test, whose `inbox` now first
  gives the take-control line), `e2e/activity.spec.ts` (new: away/back journaled),
  `e2e/fixtures.ts` (granted by `set`: `REVIEW1`, `task_review` without ending the turn).

**Block 4, built:** §2.8's texts (the orchestrator skill's "When you are woken" with the inbox,
`workers.md`, the worker skill, `team/common.md`, the guide), `task_review`'s and `adopt_session`'s
descriptions; `docs/session-control.md` (waking a parent rewritten, "The orchestrator's wakes and
its inbox", `ask` and `inbox` in the tools, the Rejected items of §2.10), `docs/context.md` (the
`UserPromptSubmit` bullet, the statusline's imports), `docs/agents.md` (`PromptInbox`),
`docs/orchestration.md` (the posts, double-click, banners, presence, the permission topic, Show),
`docs/NOT_BUILT_YET.md` (the conversation entry narrowed; `answer`; a Cursor orchestrator's inbox),
`docs/usage.md` (granted by `set`: `away` / `back` row), each with its lines in `docs/history/`
(`docs/history/agents.md` new).

**Seen red**, each against a defect injected and removed: `noteReview` not called; a SendMessage
to the parent silencing the review (F7); `seen` forced false (a topic in view); Done today not
filtering; the routed child falling through to today's wake (posts); `ready` not adding the
review lines; `recordPresence` not called; the notice's title not translated (the Spanish toast);
presence posted instead of put in the inbox; take control posted instead of put in the inbox.

**Choices the plan left open (mine):**

- A Stop record with no `working` seen since the last turn end counts as a turn (a turn too short
  to be shown), so the stand-in's `REVIEWPR`, which shows no `working`, still ends its turn.
- Rule 5's inbox line, the permission line and the topic apply only when the session's parent is
  the inbox orchestrator; a session in the mode whose parent is another session keeps today's
  wakes to that parent, and only its review wakes the orchestrator.
- A turn-end reading that fails puts the "without a report" line in the inbox (today's path wakes).
- `ready` adds the review lines whatever the orchestrator's agent (no session is known that early;
  an inbox nobody reads only keeps them), and only once the first scan settled, so the assignee is
  named: before it, names are id prefixes.
- The away/back line goes to every mode-on project's orchestrator's inbox, running or not (it
  waits for the next start of that orchestrator); `postRecipients` still applies to orchestrators
  without an inbox.
- The review wake's text leaves out ": ‹note›" when the note is empty.
- `raisePermissionTopic` returns 0 for a session in no project (not reached: the subject is a
  member of a mode-on project).
- The toast's text is "Item N: …" ("Pendiente N" in Spanish), as every topic notice is today; the
  plan's e2e said "Topic N".

**Premises the tree contradicted:** the task state is `to review`, not `review`. The plugin's own
tests bound §2.8's texts: the orchestrator skill under 200 lines, no word "set" (a session's name),
no `SendMessage` in a skill (the team block carries it), the common and Claude team parts under 800
bytes. So the skill quotes the wake as "[Menkar] ‹name› … task N to review: ‹note›" and says
"answer it by name"; `team/common.md`'s line is §2.8's, shortened to fit.

**R10** moves in exactly these, not refreshed: `tests/core/r10/mcp-tools-list.json`,
`tests/core/r10/plugin/guide/orchestration-mode.md`, `tests/core/r10/plugin/skills/orchestrator/
SKILL.md`, `tests/core/r10/plugin/skills/orchestrator/workers.md`, `tests/core/r10/plugin/skills/
worker/SKILL.md`, `tests/core/r10/plugin/team/common.md`, `tests/core/r10/team-blocks.txt`,
`tests/core/r10/team-posts.txt`.

**`test integrity`** fails on three removed `expect(` lines, the assertions block 3 asks to
rewrite (the discuss post, the away and back post counts): read by a person, as the check says.
