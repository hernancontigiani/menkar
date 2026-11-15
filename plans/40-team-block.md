# Plan 40 — the team block, stored skills, a generic `specialize`

> **Status: written 2026-11-15 by `designer-40` (task 22); reviewed by a Fable 5.2 session
> (`menkar-t26`, task 26) and revised for every finding (task 27; §2.11 says where each went).**
>
> - **Folded in:** the human's answers of 2026-11-15 (1.154: mock-up C, `maintainer`, Menkar's
>   skills never in the window, Q1–Q3), and what `claude-cli` measured (task 19) or answered (§2.3,
>   §2.6).
> - **Pending the human, via `set`:**
>   - **S1:** the skills supported with the mode off through one pointer (§2.8);
>   - **Q4:** what Menkar does with a Claude Code below the version floor (§2.3);
>   - **Q5:** another folder's skills in the window (§2.6).
>
>   Each is written as recommended and marked where it is used.
> - **Block 4 waits** on `claude-cli`'s task 28: `--system-prompt-snapshot off` over many requests
>   (a date change, a git change), a later resume without it, and the flags' version floor (§2.3).
>
> **From:** decisions 1.148–1.154 (`plans/00-STATUS.md` §1), the human's ideas
> `plans/ideas/team-protocol.md` (Ideas A, A′, B, C) and `plans/ideas/research/mcp-instructions.md`.
>
> **Ships on `main`, in one commit, before plan 38's P0 snapshot** (the human, 2026-11-15). The
> lines that leave the skills need the block they move to, and the block needs the stored skills.
> Blocks 1–3 may land in the tree before block 4; `set` commits nothing until block 5 passes.
>
> **Modifies:**
> - 1.109's "where it lives": the context policy leaves `menkar:specialize` and the role skills
>   for the block (1.152, 1.154).
> - 1.84's handoff ("who the session is, the skill to load, what is in flight"): Menkar now says
>   who and what to load; the handoff keeps what is in flight.
> - 1.89's row-menu "Role…": replaced by "Configure role…".
> - 1.151 amends plan 38's D10; plan 38's file is not edited here (`set` owns it).

## Exit — where each part goes when executed

| Part | Goes to |
|---|---|
| The team block: source, assembly, file, delivery for Claude, the version floor, the posts and their turn, what a resumed tab sees | `docs/session-control.md`, new section "The team block"; "What the skills lean on" rewritten (old text verbatim to `docs/history/session-control.md`) |
| The SessionStart records main now also reads (`compact`) | `docs/context.md`, "The hook" ("Main watches the folder for `clear` and `resume` records" amended; old line to `docs/history/context.md`) |
| `last_reply` skipping a reply to a team post | `docs/session-control.md`, `last_reply`'s bullet (old text to its history) |
| The stored skills: key, one maintainer, following ids | `docs/projects.md`, "The orchestration mode's marks" (one bullet added) |
| "Configure role…" (mock-up C): behaviour, which skills it lists and why, not found, maintained elsewhere; the first-time card's order; the mode switched while sessions run | `docs/orchestration.md`, "Switching it, and the marks" ("Role…" bullet replaced; old text verbatim to `docs/history/orchestration.md`) |
| The hand check on a real Claude Code | `docs/release-checklist.md` (one line) |
| The version floor | `README.md`, "Install (Ubuntu)" (one line: the orchestration mode needs Claude Code ‹floor› or later), and `docs/session-control.md` |
| What the user reads about roles, skills and the block | `plugin/guide/orchestration-mode.md`, "The marks", "Tasks" and "Skills to load" |
| What was rejected (§2.10) | `docs/session-control.md` and `docs/orchestration.md`, their "Rejected" sections |
| Per-agent team parts and delivery for Codex, Cursor, OpenCode | `docs/NOT_BUILT_YET.md`, "More coding agents: Codex, OpenCode" (trigger: plan 38's P1a) |
| Rows 1.148–1.152 "this row (until built)", 1.154 "`plans/40-team-block.md` (until built)" | `plans/00-STATUS.md`: each points at the docs above; 1.109's and 1.84's rows amended |
| `plans/ideas/team-protocol.md` | Deleted on delivery (its header says so) |
| The rest | `git log` |

---

## 1. Goal, and what already exists

**Goal.** Every Claude session of a project in the orchestration mode knows who it is in the team,
what to load and how the team talks:
- from its first request, and after any compaction, clear or renew;
- without depending on another agent writing the right handoff.

The communication lines are written once (`plugin/team/`), the four skills point to them, the
role's skills are stored by Menkar and set by the human, and `specialize` binds any project.

**With the mode off:**
- **the command line does not change, to the byte**;
- the skills reach the same lines through the plugin folder (§2.8, S1 pending the human).

**What exists (verified at `543b228`; `src/`, `plugin/`, `tests/`, `e2e/` unchanged since, per the
review):**

- **The command.** `buildCommand` (`src/core/command.ts:53`) builds every agent command.
  - Claude-only options sit in `if (claude)` lines after the identity: prompt file, `--add-dir`,
    `--mcp-config`, `--plugin-dir`, `--settings` (:76-81).
  - Its tests are exact strings (`tests/core/command.test.ts`).
- **Starting a pane.** `startPaneHeld` (`src/main/workspace.ts:790`) builds every pane's command.
  - It knows the tab's project (:805), the agent and the start.
  - **Who is a member when the command is built:**
    - `start_session`'s sessions are members first, with their parent and task (:1637-1643);
    - so is the first-time card's new orchestrator (:2412-2416);
    - a session the human starts (`startNewSession`, :2417-2424) and a fork (:2987-2992) start
      with `sessionId: null` and a `pending`, and join only later (`joinSession`, :1036-1040).
- **Menkar's files under the cache.** `controlPaths()` (`src/core/control/files.ts:52`).
  - `prompts/` is written by `savePrompt` through `writeTextAtomic` (`src/core/control/prompt.ts:45`).
  - It is swept hourly (`src/main/control.ts:95`) of copies older than a day.
- **The marks.** `Orchestration` (`src/core/projects/model.ts:19`) holds `roles` by session id.
  - Parsed leniently, kept to members, followed to a new id (`followOrchestration`,
    `src/core/projects/orchestration.ts:113`), set by `setRole` (:169, trim only).
  - `sessionMarks` (:268) feeds `list_sessions`, which `src/core/control/files.ts:162-206`
    prints, with every key even when the mode is off (`role: null`).
- **"Role…".** `orchestrationItems` and `roleDialog` (`src/renderer/orchestration.ts:429-471`),
  action `setRole` (`workspace.ts:1377`, :2630), strings `orch.role*` (`src/core/i18n/en.ts:75-79`).
- **Posting and waking.**
  - `postToSession` and `wakeFrame` (`src/core/control/post.ts`) append the time after a space
    (:19).
  - `wakeSession` (`workspace.ts:1810`) posts to Claude panes only.
  - A child's working → idle or done wakes its parent ("‹name› finished its turn",
    `src/core/control/events.ts:12`), batched per parent by `WakeBatcher` (:22).
- **`last_reply`.** `lastReply` (`src/core/sessions/lastreply.ts:12-40`) returns the last assistant
  text, read backwards.
- **SessionStart records.** The hook keeps `startup`, `resume`, `clear`, `compact`
  (`START_SOURCES`, `src/core/context/statusline.ts:61`); it has no `fork` matcher.
  - `paneStart` (:220-232) passes only `clear` and `resume`.
  - `watchPaneStarts` (`src/main/pane-starts.ts`) hands those to `followPaneStart`.
- **The first-time card's `startTeam`** (`src/renderer/orchestration.ts:398-424`): starts or marks
  the orchestrator, hands sessions over, saves the cap, and **switches the mode on last**.
- **The plugin** (`plugin/`, `--plugin-dir`): four skills, the guide, and their text rules in
  `tests/core/plugin.test.ts`.
  - `scripts/check-package.mjs:40-43` requires its files in the .deb.
  - `electron-builder.yml:30` ships the whole folder.
  - `setting-up.md:10-11` already tells a session how to find the plugin folder ("one level up
    from `skills/`").
- **E2E.** A stand-in `claude` records its arguments (`e2e/fixtures.ts`, `claude-args.txt`), and a
  wake reaches its messaging socket (`e2e/session-control.spec.ts:250`).

## 2. The design

### 2.1 The block's text

Three parts, in this order:
1. **The facts**, built per session by `teamFacts` (`src/core/team/block.ts`) from a plain input
   (§2.2).
2. **The common part**, `plugin/team/common.md`.
3. **The agent's part**, `plugin/team/claude.md`.

It is English: read by an agent, not shown in the UI, like `wakeFrame`.

**The facts** — an expert's, in full:

```
# Your team in Menkar
You are `packager`, a session of the Menkar project "menkar", in orchestration mode. Your role: "Packaging". Your parent is `set`, the orchestrator.
Skills to have loaded (load any that is not): `packager`, which you maintain (only you change it, with `menkar:distill`); `claude-cli`, read only (`claude-cli` maintains it).
When a session hands you a task, load `menkar:worker` first.
Your parent decides when you renew; when your context (your row in `list_sessions`) passes 90%, tell it by name.
```

Session names are in backticks, the role and the project in double quotes (a session named `set`
read as a verb in the first draft). Each line's variants, as exact strings (block 1 asserts each):

- **Line 2, who.** Always "You are `‹name›`, a session of the Menkar project "‹project›", in
  orchestration mode.", then:
  - with no name yet (a session the human started without one): "You are a new session of the
    Menkar project "‹project›", in orchestration mode.";
  - with a role: ` Your role: "‹role›".` The role is free text (`start_session`'s `role` is
    agent-written), so it is made one line, its backticks and quotes removed, cut at 60 characters
    with "…";
  - the orchestrator: " You are its orchestrator.";
  - the parent is the orchestrator: " Your parent is `‹parent›`, the orchestrator.";
  - another parent: " Your parent is `‹parent›`; the orchestrator is `‹orchestrator›`.";
  - loose, with an orchestrator: " You have no parent; the orchestrator is `‹orchestrator›`.";
  - no orchestrator marked: " The project has no orchestrator yet."
- **Line 3, skills.** "Skills to have loaded (load any that is not): " and the list. It is re-read
  after every compaction and post, so "load these now" would reload what is loaded.
  - The orchestrator's list starts with `menkar:orchestrator`.
  - Each stored skill, in the order the human set:
    - the session maintains it: "`‹name›`, which you maintain (only you change it, with
      `menkar:distill`)". The parenthesis appears once, on the first one.
    - read only, with a maintainer: "`‹name›`, read only (`‹session›` maintains it)";
    - read only, with none: "`‹name›`, read only";
    - not found for this session (§2.6): "`‹name›` (not found: tell the human)".
  - No line when there is nothing to load.
- **Line 4, tasks:** "When a session hands you a task, load `menkar:worker` first." Every session
  has it, the orchestrator excepted.
  - A per-task worker's first prompt *is* that hand-off, so the conditional fires at once.
  - Why not a "You were started for task N" line: §2.10.
- **Line 5, context (1.154, Q1).** ‹full› and ‹warn› are the human's `ring_full` and `ring_warn`
  (`docs/context.md`, "The levels"), read when the facts are built.
  - with a parent: "Your parent decides when you renew; when your context (your row in
    `list_sessions`) passes ‹full›%, tell it by name.";
  - loose, with a role, maintaining a skill: "You decide when you renew: when a consultation
    closes and your context (your row in `list_sessions`) is past ‹warn›%, run `menkar:distill`,
    then renew; prefer that to a compaction.";
  - loose, with a role, maintaining none: the same without "run `menkar:distill`, then", so
    "…is past ‹warn›%, renew; prefer that to a compaction.";
  - the orchestrator, or loose with no role (an ordinary session of the human's): no line.

**The common part** (`plugin/team/common.md`):

```
## How the team works
- Address a session by its name, never by its id: a renewed session keeps its name and gets a new id.
- Messages that start with "[Menkar]" come from the Menkar app, not from a person; one may update the facts above.
- When you finish work another session handed you, or are blocked, your report is your last message: it is read with `last_reply`. If that session is not your parent, also send it the report by name: Menkar wakes only your parent.
- When you renew, call `renew` with a prompt that is your handoff: what is in flight (locks you hold, answers you owe, half-done work) and your next task. Menkar tells the new session who it is and what to load.
```

**Claude's part** (`plugin/team/claude.md`):

```
- Message a session with `SendMessage`, `to` set to its name.
```

**Size**, `wc -c` on the texts above:

| Part | Bytes |
|---|---|
| The expert's facts | 520 |
| Common | 682 |
| Claude | 62 |
| **Total** | **1,264** |

- That is ~320 tokens, at the ~4 bytes per token research §6 uses. It sits in the system prompt,
  written to cache once and then read from it.
- Block 1 asserts common + Claude **under 800 bytes** and the expert's whole block **under
  1,400**, so growth is a deliberate change of the test.

**Why each line is there** — the case that put it in a skill first:

| Line | What went wrong without it | Replaces |
|---|---|---|
| Who, role, parent, orchestrator | An expert that renewed without naming its skill came back with no role, and nothing noticed (ideas doc, "the weak point") | distill:80, specialize:117-118, orchestrator:199-201 |
| Skills to have loaded | Skills were named only in hand-written handoffs; `renew` adds nothing | distill:81, specialize:113-114, orchestrator:50-51 (the clause) |
| `menkar:worker` on a task | A task message had to say "load `menkar:worker`"; a consultant now gets tasks too (1.148) | orchestrator:95 (the load clause only) |
| Context | 1.109's policy was copied into every role skill by `specialize`; 1.152 removes it from there | specialize:110-116 |
| Name, not id | A renewed session has a new id; messages by id were lost (1.74) | orchestrator:56-57, worker:39-40 |
| `[Menkar]` from the app | Wakes and counts arrive in the conversation (1.125), and §2.4's posts update the facts; without this line they read as another session's text, or as an injection | worker:10, widened |
| Report last; non-parent by name | Reports in files were lost (1.73); work handed by a non-parent was never read, since Menkar wakes only the parent | worker:98-103, orchestrator:106-107 |
| Renew with a handoff | A summary loses what is in flight; nothing else carries it (1.84) | distill:75-84, worker:133-134, specialize:117-119, orchestrator:199-202 |
| `SendMessage` by name | Claude Code's own tool (D2, 1.143) | orchestrator:56, worker:39, distill:70, specialize:78 |

### 2.2 Assembly: a plain input, and one record per agent

- **`teamFacts(input: TeamInput, agent: TeamAgent)`** is pure. Its input is plain data that main
  builds, not a `Project`, so block 1 does not depend on block 2's types:
  - **identity:** `project`, `name?`, `role?`;
  - **place:** `orchestrator` (`'self'` | ‹name› | none), `parent?` with whether it is the
    orchestrator;
  - **skills:** each with `name`, `maintainer`, `maintainedBy?` and `found`;
  - **context:** `warn`, `full`.
- **Only with the mode on.** Main builds no input when the tab's project is not in the mode, so no
  file is written and the command is today's (block 4's exact-string tests).
- **The agent's record (S8).** `TeamAgent` holds what is the agent's:
  - how a skill is referred to: `skill(name)` and `own(name)` (for Claude, `` `name` `` and
    `` `menkar:name` ``);
  - the name of its part file (`claude.md`).

  It is found in a table by the agent's value (`TEAM_AGENTS[agent]`). Only Claude has an entry: an
  agent with none gets no block (`null`) and no flag, so Cursor is untouched. No line in
  `src/core/team/` names `'claude'` outside that table (a parsed-source test). Codex later is one
  entry, one file and its delivery strategy (plan 38, 1.135).
- **`teamBlock(facts, common, part)`** joins the three texts with a blank line.

### 2.3 Delivery for Claude

**Measured by `claude-cli` on 2.1.325** (task 19, `plans/ideas/research/mcp-instructions.md` §6):

| What | Result |
|---|---|
| When the file is read | **Once, at process start** |
| Where the text goes | Appended to the system prompt, on the very first request |
| Compaction and `/clear` | Rebuild the prompt with the text read at start, not the file's current content |
| A missing file | Claude stops before any request ("Append system prompt file not found") |
| `--resume` | Keeps the recorded text until a compaction |
| `--resume` with `--system-prompt-snapshot off` | The new text from the first request after the resume (documented, Claude Code 2.1.257+) |
| `--fork-session` | Carries the source's recorded text |

- **The input at start (B1).** It is built for every Claude pane whose **tab** belongs to a
  mode-on project, member or not yet:
  - a member: from the project;
  - a session not yet a member (the human's "New session", a fork): from the start's own identity,
    `start.name`, no role, no parent, no skills, and the orchestrator from the project. That is
    what it will be when it joins, so the join usually changes nothing (§2.4).
- **The file:** `<cache>/menkar/control/team/<pane-id>.md` (`controlPaths().team`).
  - It is written whole through `writeTextAtomic` **before the command is built**: a missing file
    closes the tab at once.
  - **If it cannot be written**, the pane starts without the team flags, and main logs it with the
    pane's id. The session then gets the whole block posted on its join or first reachability
    (§2.4, `held = null`).
  - It is swept with the prompts, hourly, after a day (`sweepTeamFiles`, `PROMPT_KEEP_MS`, through
    the clock). Claude reads it only at start.
- **The flags.** `buildCommand` gains `teamFile?: string`.
  - For Claude it appends `--append-system-prompt-file <quoted path>` **last**. Measured: last is
    the safest place; only the positional prompt must stay before `--add-dir`.
  - For a **resume** it adds `--system-prompt-snapshot off` before it.
  - Without `teamFile` nothing is added.
- **Why the snapshot flag on resume, rather than a post.** A tab restored by "Restart now" (1.43)
  then starts with its current block in the system prompt, where it survives compaction, and
  nothing is woken.
  - **Its cost is open (S3).** The rebuild runs on every request. Anything dynamic in Claude's
    default prompt (the date, git status) would then cost a prefix cache write each time it
    changes, for the rest of that tab's life (research §6, inferred; 1.134).
  - **Task 28** (`claude-cli`) measures it over many requests across a date and a git change, and
    whether a later resume *without* the flag reverts to the old recorded text. **Block 4 starts
    after its result.**
  - If the cost is real, the alternative is to pass the flag only when the block differs from the
    one the session was last started with. That needs a per-session record, and its design then
    goes to `set` before block 4.
- **The version floor (S3).** `--system-prompt-snapshot off` needs Claude Code **2.1.257**. Task 28
  also gives the floor of `--append-system-prompt-file`; the plan uses the higher of the two (‹floor›
  below).
  - **Q4 — pending the human, (a) recommended:** main reads `claude --version` once per binary
    (path and mtime), off the UI path. Below ‹floor›, mode-on panes start **without** the team
    flags and it logs. One toast per run (`team.oldClaude`, en and es): "Claude Code ‹v› is older
    than ‹floor›: sessions start without their team instructions. Update Claude Code."
  - (b) would only document the floor. Without the toast, an old CLI's mode-on tabs close at start
    with Claude's own error.
  - `README.md`'s "Install (Ubuntu)" names the floor, and `docs/release-checklist.md` gains the hand
    check (block 4): on the real `claude` in a mode-on project, a new session's first answer knows
    its name, role and parent; after "Restart now" a tab whose role changed while Menkar was closed
    knows the new one.
- **Why the command line and not MCP `instructions`** (1.150, recorded): MCP instructions reach
  Claude as a conversation message framed as tool usage, capped at 4,096 characters, and may
  arrive after the first prompt (research §1, §5).

### 2.4 Keeping a running session's facts current

**What a session holds.** A Claude session believes what its **system prompt was started with**,
plus the posts it has had since. A compaction or a `/clear` drops the posts and goes back to the
start text. So main keeps, per Claude pane:

- **`started`** — the block in its system prompt. It comes from the file written at start, or is
  `null` when the pane started without one: mode off, below the floor, file not written.
- **`held`** — what it believes now: `started` at start, **`null` for a fork** (it carries its
  source's block), and the latest text once a post is *delivered*.

**The rule** is a pure function, `teamPost(held, current)` in `src/core/team/posts.ts`:

| `held` | `current` | Post |
|---|---|---|
| block | null (mode off, or the session left the project) | The leaving line |
| null | block | The whole block |
| block | block, other facts | The facts |
| block | block, same facts | Nothing |

**When main applies it**, for each running Claude pane of a mode-on project or one that holds a
block:

- **After a change that can alter facts.** Each is coalesced per pane (below), and none rescans a
  disk: the `found` of each skill is the one computed at the pane's start or at the last
  "Configure role…" save.
  - a `projects.json` change: role, stored skills, the orchestrator mark, the parent (1.152; 1.154
    Q3), the session leaving the project, the mode switched (1.154 Q2);
  - a **name** changing in `sessionList` (S4): the session's own, its parent's, the orchestrator's,
    a maintainer's. Names are Claude's (`/rename`), and the sessions list is where Menkar sees them.
- **On a SessionStart record naming the pane:**
  - `compact` or `clear`: `held` = `started`, then the rule;
  - `resume` in the tab (1.57, S4): the process keeps its start text, but the resumed conversation
    holds whatever it recorded, so `held` = `null` and the whole block is posted. After its next
    compaction it goes back to `started`, and the rule posts the facts if they differ.
  - `paneStart` (`statusline.ts:220`) passes `compact` too; `followPaneStart` still acts only on
    `clear` and `resume`.
- **On a pending session's join** (B1): the fork's `held` = `null` posts the whole block; a human's
  new session posts only if the join changed its facts.

**The posts** go through `postToSession`; `wakeFrame` appends the time after a space, and the
counts only where they apply today, to the orchestrator:

```
[Menkar] Team update: your facts are now:
<the facts, without the heading>
No reply is needed. (10:42:07)
```

- **Mode on**, the whole block (Q2): "[Menkar] Team update: this project is now in orchestration
  mode. Your team instructions:" + the block + "No reply is needed."
- **Leaving**: "[Menkar] Team update: the "Your team in Menkar" instructions no longer apply to you.
  No reply is needed."
- The marker **"[Menkar] Team update:"** is what `last_reply` and the parent's wake recognise
  (below).

**A post starts a turn (B2).** Each consequence is handled:

- **Coalesced.** A trigger schedules the pane's recompute `TEAM_SETTLE_MS` = 2,000 ms later, and
  another trigger restarts the wait. One post then carries the latest. The first-time card's mode
  on, mark and hand-over (§2.7) become one post per pane. A test with fake timers asserts it.
- **No parent wake for it.**
  - When a team post is delivered to a pane whose shown state is idle or done, the pane is marked.
  - Its next working → idle/done is not sent to its parent, and the mark clears.
  - The mark also clears on any key the human types into that pane. A post to a working session
    sets no mark: its own turn end wakes the parent as it would anyway.
  - A test in `tests/core/control/events.test.ts` covers it, or beside the batcher.
- **`last_reply` skips a reply to a team post.** Reading backwards, an assistant text whose
  prompting user message contains "[Menkar] Team update:" is passed over, and the search goes on
  before it. So a worker's report stays its `last_reply` (1.73). Tested in
  `tests/core/sessions/lastreply.test.ts` with transcript lines.
- **`held` is set only on `'posted'`.**
  - `'no session'` (the session not reachable yet after a start or join) is retried
    `TEAM_POST_TRIES` = 5 times, `TEAM_POST_GAP_MS` = 2,000 ms apart. The constants are exported
    and asserted.
  - `'protocol'`, an error, or the last retry is logged with the pane's id, and `held` is
    unchanged, so the next trigger tries again.

**Three separable pieces (S8).** This holding model is Claude's: Codex has no snapshot flag, and
OpenCode rewrites its entry (`agents-compared.md` §1.4). So block 4 keeps three pieces apart:

| Piece | What it is | For Claude |
|---|---|---|
| (1) What a session holds at start | `started` | From its file and its start kind |
| (2) How a start delivers | — | The file and the flags |
| (3) How a change is told | — | The post and its rules |

`teamPost` itself is agent-neutral. `started` and `held` live in memory with the pane: a restart
restarts every pane, and a resume gets its block from the command (§2.3).

### 2.5 The skills Menkar stores

- **Shape**, per project in `projects.json`, beside `roles`:
  `orchestration.skills: { "<session-id>": [{ "name": "packager", "maintainer": true }, { "name": "claude-cli" }] }`.
  - `maintainer` is written only while true (1.154).
  - The order is kept as the human set it.
- **Only the project's and the user's skills are stored.** Menkar's own skills are never stored or
  shown (1.154): the block derives them from the marks (§2.1).
  - A `menkar:` name in the file is dropped on read.
  - `setSkills` refuses one (`refusal.menkarSkill`).
- **Read leniently** (`parseOrchestration`):
  - an entry that is not `{ name: non-empty string }` is dropped alone;
  - a repeated name in one list keeps the first;
  - a second maintainer of one name (a hand-edited file) reads as read only for every session
    after the first in member order.
- **Kept to members, followed to a new id, kept with the mode off**, as `roles` is.
- **Set only by the human** (1.152), with one action, `configureRole { session, label, skills }`.
  - **`setSkills` refuses** making a session maintainer of a name another session maintains
    (`refusal.maintainedBy`, "‹name› is maintained by ‹session›.", en and es), one maintainer per
    skill (1.119).
  - No MCP tool sets skills; `start_session`'s `role` stays.
- **`list_sessions`** adds `skills: [{ name, maintainer }]` per session, `[]` with the mode off, as
  `role` is `null` then. With it the orchestrator can name an expert's skill, read only, in a
  per-task worker's task (`plugin/skills/orchestrator/workers.md:34-35`). It is built in block 4
  (`sessionMarks` and `src/core/control/files.ts`), not block 2.

### 2.6 "Configure role…" — mock-up C (1.154)

The human chose **mock-up C** of task 21: https://claude.ai/artifact/UApjJwrv7yGBFAtLrK4Y6J,
"One checklist", without its "Menkar" group (1.154). The executor of block 5 opens it. The window,
from the top:

- **Heading:** "Configure role of ‹name›", the name in the accent colour.
  - It **replaces "Role…"** in the row menu: same place, same condition (mode on).
  - Its label is `orch.configureRole`, "Configure role…" / "Configurar rol…".
- **Role:** today's field and hint (trimmed; empty removes the label).
- **Skills:** "‹n› chosen: ‹names›" beside the label, "0 chosen: none" when empty. Below it, one
  bordered, scrolling list with a filter field ("Filter skills…") on top:
  - **Not found** first, in red, for a stored skill not found for this session: its name struck
    through, "Not found in this project's or your skills", and **Remove**.
    - The mock-up's "was in .claude/skills/" is deliberately not used: Menkar stores the name
      only.
    - These rows stay stored and flagged until the human removes them (1.154).
    - **The filter never hides them.**
  - **One group per place:** each of the project's folders holding skills, headed by the folder's
    name with `.claude/skills/` on the right, then "Yours" with `~/.claude/skills/`.
    - Each skill is a row with a **checkbox**.
    - The filter hides rows whose name does not contain its text (case ignored), and any group left
      empty. With none left, it shows "No skill matches.".
    - The same name in two places shows in each, and ticking one ticks both: what is stored is the
      name.
  - **Ticking adds the skill**, read only, and shows on that row the switch **"Maintainer · Read
    only"** ("Mantiene · Solo lectura"). Unticking removes it.
  - **A skill maintained by another session:** unticked, the row notes "maintained by ‹name›".
    Ticked, it shows "Maintained by ‹name›" in the warning colour, and the switch's Maintainer is
    disabled. To move a maintainer, the human unsets it on the other session first.
  - **Another folder's skill (S5; Q5, pending the human, (a) recommended).** Claude loads project
    skills from the session's own folder chain only. A skill found only in another folder of the
    project shows disabled, noting "not available in ‹session's folder›". (b) would not show other
    folders' groups.
- **Legend:** "Maintainer: this session is the one that updates it when it distills." / "Read
  only: it loads it and never edits it."
- **Cancel · Save** (Save suggested). Save applies label and skills in one `configureRole` action;
  Cancel and Escape change nothing. After Save, §2.4 posts to the session if it runs and its facts
  changed.

**Why only the project's and the user's skills** (1.154): installed plugins' and MCP servers' skills
are available to every session already, and nobody in the team maintains them. Leaving them out
keeps the list to a project's ~10–15 skills, which is what makes one checklist workable.

**Found, and where** (`listSkills`, main, async, read only; `claude-cli` from Claude Code's skills
doc, 2026-11-15). A skill's name is its frontmatter `name`, else its folder's.

- **A project folder's skills:** `.claude/skills/<dir>/SKILL.md` in that folder **and in each
  parent up to its repository root** (the nearest parent holding `.git`, a directory or a file),
  as Claude loads them from a session started there.
  - Nested `.claude/skills/` deeper down load only once Claude touches a file there; they are not
    listed.
- **The user's:** `<home>/.claude/skills/<dir>/SKILL.md`, the folder through the paths module, not
  a literal.
- **"Found" for a session** = in its own folder's chain, or the user's. It is computed at the pane's
  start and at each Save, never on an ordinary `projects.json` write.
- **Each skill carries** its place and the frontmatter's `description`, its first 200 characters,
  for the row's tooltip.
- **Read only.** `readdir` and `readFile`, symlinks followed, an unreadable folder skipped with a
  log line. Nothing under the user's or the project's folders is written (block 2's test).

### 2.7 The first-time card's order

- `startTeam` switches the mode **on first**, then starts or marks the orchestrator, then hands the
  chosen sessions over and saves the cap.
- If `startNew` is refused, it switches the mode back off and shows the refusal as today.
- So a new orchestrator starts with its block (§2.3). A running session chosen gets one coalesced
  post (§2.4).
- `orch.firstPrompt` keeps its text: the block names `menkar:orchestrator` too, and the duplicate
  costs nothing.

### 2.8 The skills, trimmed — what goes, what stays

**The pointer (S1 — pending the human; `set` recommends it).** Each of `orchestrator`, `worker` and
`distill` names, where it relied on a removed line, one uniform sentence:

> How the team talks: the "Your team in Menkar" section of your instructions; if you have none,
> read `team/common.md` and `team/claude.md` in Menkar's plugin folder (one level up from
> `skills/`).

That keeps them working with the mode off, where `start_session` still runs
(`plugin/guide/orchestration-mode.md:153`).

**orchestrator, `SKILL.md`:**

| Lines | What goes | What stays |
|---|---|---|
| 47-48 | — | `last_reply` after a renew |
| 49 | — | "To renew another session, tell it to call `renew`; you renew only yourself" |
| 50-53 | "with a prompt naming their skill" | "between tasks, have them distill if they learned something, then renew; Menkar names their skills"; a worker goes with its task; a consultant renews itself; past the red mark, a topic, no message (1.109) |
| 56-57 | "Message sessions with … (`SendMessage`), by name, never by id: a renewed session has a new id and keeps its name" | — (replaced by the pointer) |
| 57-59 | — | "A name unreachable for a moment may be renewing; look with `list_sessions`…; if it is gone, record what was pending…, don't send it to a guessed name" |
| 73-75 | "ask it, by name, and ask it to answer by name" | (1.148) "hand it a task when the request needs more than a short answer; a short question needs none" |
| 88-90 | "A consultant gets no task: ask it, and it raises topics" | (1.148) a task for every request that needs more than a short answer, to a worker, an expert or a consultant; a short question to a consultant needs none; a task waiting on something outside (a build, a hosted CI, a release) is set waiting with what it waits on |
| 95 | "; load `menkar:worker`" | "This task comes from ‹your name›, the orchestrator. It is task N." The worker relies on it (`worker/SKILL.md:10`) |
| 106-107 | the whole item 8 | — (the block) |
| 199-202 | "You are the orchestrator of ‹project›; load `menkar:orchestrator`", then | "what you **owe**: who holds which lock, who waits on your answer, what you promised" |

- **1.149** goes under "The human" in `SKILL.md`, not in `workers.md`, which is read only when
  handing out, parking or closing (`workers.md:3`):
  - "tomorrow" or a named day: a task in the queue;
  - "in the future", "someday", "tolerable for now": no task; it goes to the project's place for
    deferred work with its trigger;
  - "another day" or unclear: ask whether to queue a task.

  The body is 198 lines today; the trim frees more than the addition takes, and block 3 asserts
  the body stays under 200.
- `setting-up.md:3`: "when you load `menkar:orchestrator`" becomes "when you start as the
  orchestrator".
- `workers.md:39`: "keeper" becomes "maintainer".

**worker:**
- **Description:** "…and make your report your last message" becomes "…and report as your team
  instructions say".
- **39-40:** the messaging line goes; the pointer stands in.
- **70:** "its one keeper" becomes "its one maintainer".
- **98-103:** the heading "Your report is your last message" becomes "Your report"; the
  last-message and by-name sentences go. **What a report holds (105-118) stays.**
- **131-134:** the renew handoff details go. "a worker renews when told to" stays.

**distill:**
- **Step 1:** "the skills your team instructions say you maintain; edit only those, never a
  read-only one". With none, ask the human (`menkar:specialize`).
- **Step 4:** `SendMessage` goes ("send the session that handed you the task, by name, one
  message: …").
- **Step 5:** the prompt carries what is in flight and the next task. "If your instructions have no
  team section, also say who you are and the skill to load."

**specialize, generic (1.152).** No `menkar`, no orchestrator, no tool of Menkar's, no
`SendMessage`, in any of its files, its description included.
- **The description:** "use menkar:distill" becomes "use the distill skill".
- **Step 3:** "by name, with … `SendMessage`" goes.
- **Step 4:** the orchestrator item goes.
- **Step 6:** becomes "Ask the human to record this skill as one this session maintains, wherever
  their tool keeps a session's skills; the distill skill keeps it current from then on."
- **The policy and renew items of step 6 go.**
- **`role-skill-contents.md`:**
  - 28-29: "It never starts sessions or hands out work" goes;
  - 37-38: "asks the orchestrator for" becomes "asks whoever coordinates the work for".

**The guide:**
- "The marks" describes "Configure role…".
- "Tasks", line 100's "Consultants get no tasks" (against 1.148), becomes "Consultants get a task
  for a request that needs more than a short answer".
- "Skills to load" says Menkar names each session's skills in its team instructions, from the marks
  and the stored skills.

### 2.9 Decided since the first draft

- **The human, 2026-11-15 (1.154):**
  - Q1: the context policy is one facts line per profile (§2.1);
  - Q2: mode on posts the whole block, mode off one line (§2.4);
  - Q3: the orchestrator mark and the parent trigger the post (§2.4);
  - mock-up C; Menkar's skills never shown; `maintainer`; a skill not found flagged until removed
    (§2.5, §2.6).
- **`claude-cli`, 2026-11-15:**
  - the file is read once (§2.3);
  - `--system-prompt-snapshot off` on resume (§2.3);
  - skills' places and names (§2.6);
  - `Skill` with an unknown name answers "Unknown skill", hence "(not found: tell the human)".

### 2.10 Rejected, with why

- **MCP `instructions` for Claude.** A conversation message framed as tool usage, capped at 4,096
  characters, possibly after the first prompt (1.150). It may be another agent's strategy.
- **Skills set by `start_session` or `specialize`.** Only the human sets them (1.152). An agent
  that wrote a wrong name would mis-role a session silently.
- **Listing installed plugins' and MCP servers' skills** (1.154): every session has them, and
  nobody in the team maintains them.
- **Showing Menkar's skills in the window** (1.154): they follow from the marks. Storing them would
  let a session be told to load `menkar:orchestrator` without being the orchestrator.
- **A check of which skills a session loaded.** The cause is removed at the source (the ideas doc,
  "Not taken").
- **`menkar:worker` implied by the parent.** An expert does not always work a task, and a
  consultant now gets tasks without being a child (1.148).
- **"You were started for task N: load `menkar:worker` now" (review S2).**
  - A per-task worker's first prompt is the task, so line 4's conditional fires at once.
  - A task-specific line would change the facts whenever tasks move, posting and starting a turn
    each time.
- **Facts in a template file.** The variants are logic; one tested function is clearer. The
  protocol, which has none, stays in files.
- **For Claude: a post on every resume, or a stored "last told" file.** The snapshot flag gives a
  resumed session its block in the system prompt (§2.3, pending task 28's cost).
- **Rewriting the file on a change.** Claude reads it once (measured).
- **The snapshot flag on a fork.** Not measured, and a fork must be told it is not its source
  anyway. The whole block is posted on its join (§2.4).
- **The flag before `--settings`.** It works (measured), but last is where nothing can take it as
  another option's value.
- **Making every new session a member before its command (review B1, one option).** `joinSession`
  decides the project from where the session started (`joinTarget`). Building the input from the
  tab's project and the start's identity changes no membership rule.
- **A post with no "No reply is needed" and no `last_reply` filter.** The post's own answer would
  replace a worker's report (1.73).

### 2.11 Where each review finding went (task 26)

| Finding | Where |
|---|---|
| B1 | §2.3 (input at start), §2.4 (join), block 4 e2e |
| B2 | §2.4 ("A post starts a turn"), blocks 4 and 5 tests |
| S1 | §2.8's pointer, pending the human |
| S2 | §2.1 throughout; the per-task worker line rejected in §2.10 |
| S3 | §2.3: task 28 gates block 4; the floor and Q4; the release checklist |
| S4 | §2.4: names, in-tab resume, leaving |
| S5 | §2.6, Q5 pending the human |
| S6 | §2.8's tables |
| S7 | §5's files; block 5's post test; the exit's `docs/context.md` |
| S8 | §2.2's `TeamAgent`, §2.4's three pieces, §2.10's "for Claude" |

**Minor findings:**
- sizes re-measured (§2.1);
- the time format (§2.4);
- 1.89 and 1.84 in the header;
- §3 updated;
- "keeper" → "maintainer" (§2.8);
- i18n keys for the refusals (§2.5);
- the constants tested (§2.4);
- a file not written (§2.3);
- no rescan (§2.4, §2.6);
- the paths module (§2.6);
- the mock-up notes (§2.6);
- chat tabs (§3);
- the mock-up URL (§2.6).

## 3. Out of scope

- Delivery to Codex, Cursor and OpenCode, and their parts (plan 38; `NOT_BUILT_YET.md`).
- **Chat tabs and "Open in Ghostty" get no block**: they are not Menkar's panes' commands.
- Any change to `start_session`, `renew` or the wake texts other than §2.4's.
- Editing, creating or showing a skill's text from Menkar.
- Moving a maintainer in one step.
- Listing installed plugins' or MCP servers' skills (1.154).
- `plans/38-multi-agent.md`'s D10 row (`set` edits that file).

## 4. Do not touch

- `orch.firstPrompt`'s text; `wakeFrame`'s format and counts tail (1.125).
- The command line of any session of a project with the mode off, and of any Cursor session.
- The user's and the project's skills, and anything under `~/.claude`: read only.
- `tests/core/plugin.test.ts`'s existing rules: extended, never loosened.
- `followPaneStart`'s behaviour; `docs/history/` lines already there; `plans/38-*`, `27-*`, `28-*`.

---

## 5. Execution blocks

**Parallel and order:**
- Blocks **1, 2 and 3 share no file** and may run at once (cap 3, 1.153).
- Block 4 needs 1, 2 **and task 28's result** (§2.3).
- Block 5 needs 4.
- Block 6 closes.
- S1, Q4 and Q5 must be answered before blocks 3, 4 and 5 respectively.

| Block | Files it owns |
|---|---|
| 1 | `plugin/team/common.md`, `plugin/team/claude.md` (new), `src/core/team/block.ts` (new), `tests/core/team/block.test.ts` (new), `scripts/check-package.mjs` |
| 2 | `src/core/projects/model.ts`, `src/core/projects/orchestration.ts`, `src/core/team/skills.ts` (new), `tests/core/projects/orchestration.test.ts`, `tests/core/team/skills.test.ts` (new), the paths module (the user's skills folder) |
| 3 | `plugin/skills/**`, `plugin/guide/orchestration-mode.md`, `tests/core/plugin.test.ts` |
| 4 | Main and core: `src/core/command.ts`, `tests/core/command.test.ts`, `src/core/team/posts.ts` (new), `tests/core/team/posts.test.ts` (new), `src/core/control/files.ts` (`team` path, `list_sessions`), `src/core/control/prompt.ts` (sweep), `src/main/control.ts`, `src/core/control/events.ts` and its test (the post's turn), `src/core/sessions/lastreply.ts` and `tests/core/sessions/lastreply.test.ts`, `src/core/context/statusline.ts` (`paneStart`) and `tests/core/context/statusline.test.ts`, `src/main/pane-starts.ts`, `src/core/projects/orchestration.ts` (`sessionMarks` only), `tests/core/control/server.test.ts`, `src/core/control/protocol.ts`, `src/main/workspace.ts`, `src/renderer/orchestration.ts` (`startTeam` only), `src/core/i18n/{en,es}.ts` (`team.oldClaude`) |
| 4 | Tests and docs: `e2e/fixtures.ts`, `e2e/session-control.spec.ts`, `e2e/orchestration.spec.ts`, `docs/session-control.md`, `docs/context.md`, their history files, `docs/release-checklist.md`, `README.md` |
| 5 | `src/renderer/orchestration.ts` (the window), its CSS, the IPC module, `src/main/workspace.ts` (the action, `skills:list`), `src/core/i18n/{en,es}.ts`, `e2e/orchestration.spec.ts`, `docs/orchestration.md`, `docs/projects.md`, their history files |
| 6 | `plans/00-STATUS.md`, `docs/history/plans/00-STATUS.md`, `docs/NOT_BUILT_YET.md`, `plans/ideas/team-protocol.md` (deleted), this plan (deleted) |

### Block 1 — the block's text and assembly (parallel with 2 and 3)

- [ ] Tests first, `tests/core/team/block.test.ts`, each comment naming its decision:
  - every variant of §2.1's lines 2–5 as an exact string: no name; with and without a role; the
    orchestrator; parent is the orchestrator; another parent; loose; no orchestrator. Line 3's four
    kinds and its absence. Line 5's four cases with `warn`/`full` at 60/90 and at 50/80;
  - the role: a newline, a backtick and a quote removed; 61 characters cut to 60 with "…";
  - names in backticks; the orchestrator's skill list starts with `menkar:orchestrator`;
  - `teamBlock` = facts, common, part, blank-line separated; `TEAM_AGENTS` has no entry for
    `'cursor'` (→ `null`);
  - **a parsed-source test**: no `'claude'` string literal in `src/core/team/` outside
    `TEAM_AGENTS`, via the TypeScript compiler API;
  - size: `common.md` + `claude.md` under 800 bytes; §2.1's expert block under 1,400.
- [ ] `plugin/team/common.md`, `plugin/team/claude.md` (§2.1); `src/core/team/block.ts`
  (`TeamInput`, `TeamAgent`, `TEAM_AGENTS`, `teamFacts`, `teamBlock`). Pure, no Electron, time not
  read.
- [ ] `scripts/check-package.mjs` requires `resources/plugin/team/common.md` and `claude.md`.
- **Verify:** `npm run ci`; drop line 4 once and see its test fail.

### Block 2 — stored skills and the skills Menkar finds (parallel with 1 and 3)

- [ ] Tests first, `tests/core/projects/orchestration.test.ts`:
  - **parse:** valid entries kept; `{}`, a non-string or an empty name dropped alone; a repeated
    name keeps the first; a `menkar:` name dropped; two maintainers of `deploy`, so the second
    member's reads read only;
  - **serialize:** `maintainer` only when true; no `skills` key when every list is empty; a project
    with no skills writes the same bytes as today;
  - kept to members; followed to a new id; kept with the mode off;
  - **`setSkills`:**
    - maintainer of a name another session maintains → `refusal.maintainedBy` with both names;
    - read only of it → accepted;
    - a `menkar:` name → `refusal.menkarSkill`;
    - the list is replaced whole.
- [ ] `tests/core/team/skills.test.ts`, on a temporary tree with two project folders, one inside a
  repository, and a user folder:
  - names, places and descriptions; a frontmatter `name` wins over the folder's;
  - the folder inside the repository also lists its parents' skills, up to the folder holding
    `.git` (a directory, then a file), and nothing above;
  - a symlinked skill found; an unreadable folder skipped; a folder with no `SKILL.md` ignored;
  - **every file's mtime and the tree's listing unchanged after**;
  - `foundFor(folder, listed)` gives that folder's chain plus the user's.
- [ ] Build `skills` in `Orchestration`: parse, serialize, keep, follow, `setSkills`, the two
  refusal keys (`en`, `es`). In `src/core/team/skills.ts`: `listSkills(places)` (async fs, places
  passed in) and `foundFor`; the user's skills folder in the paths module. `sessionMarks` is block
  4's.
- **Verify:** `npm run ci`; let a second maintainer through once and see it fail.

### Block 3 — the skills trimmed, `specialize` generic, task 17's rules (parallel with 1 and 2; after S1's answer)

- [ ] Tests first, `tests/core/plugin.test.ts`:
  - **no communication line in a skill.** In every `SKILL.md` body and reference file: no
    `SendMessage`, no "last message", no "never by (an )?id", no "wakes only", no "load
    \`menkar:". Descriptions too, except that the orchestrator's may name its own skill;
  - **the pointer** (S1): the sentence of §2.8 in `orchestrator`, `worker` and `distill`;
  - **specialize is generic.** Its files and description contain no `/menkar/i`, no
    `/orchestrat/i`, no `SendMessage`, and no backticked name from `TOOL_NAMES`;
  - **distill edits only what it maintains**: its body matches `/read.only/` and `/maintain/`;
  - **1.148 and 1.149, on the orchestrator's `SKILL.md` body:** a consultant gets a task; "waiting"
    on something outside; the three horizons (`tomorrow`, `in the future`, `another day`);
    `workers.md` holds none of the three;
  - no "keeper" in any skill or the guide; the guide no longer says "Consultants get no tasks".
- [ ] Edit per §2.8's tables, and the guide.
- **Verify:** `npm run ci`, every body under 200 lines; re-add a `SendMessage` line once and see
  the test fail.

### Block 4 — delivery, posts, the card's order (after 1, 2, task 28 and Q4)

- [ ] Tests first:
  - **`command.test.ts`:**
    - `teamFile` puts `--append-system-prompt-file '<path>'` last for new and fork; a resume gets
      `--system-prompt-snapshot off --append-system-prompt-file '<path>'` last;
    - **without `teamFile` every existing exact-string test passes unchanged** (1.150);
    - a Cursor command ignores `teamFile`.
  - **`posts.test.ts`:** §2.4's table, and the event sequences:
    - a change → facts; the same change again → nothing;
    - `compact` with `held` ≠ `started` and current = `started` → nothing; with current ≠ `started`
      → facts;
    - a fork's join → the whole block;
    - an in-tab resume → the whole block, then after a compaction the facts if they differ;
    - mode on with `started` = `null` → the whole block, and again after a compaction;
    - mode off → the leaving line;
    - a session leaving the project → the leaving line;
    - a rename of its parent → facts.
  - **The settle:** three triggers within 2,000 ms give one post (fake timers).
    `TEAM_SETTLE_MS`, `TEAM_POST_TRIES` and `TEAM_POST_GAP_MS` are asserted.
  - **The post's turn:**
    - a pane marked by a team post: its next working → idle does not wake the parent; the one
      after does;
    - a key typed in between clears the mark;
    - a post to a working pane sets none.
  - **`lastreply.test.ts`:** report, then a team post, then "Noted." → the report; a post followed
    by the human's message and a reply → that reply.
  - **`statusline.test.ts`:** a `compact` record reads with its pane; `startup` still `null`.
  - **`server.test.ts`:** `skills` in `list_sessions`, `[]` with the mode off.
  - **`sweepTeamFiles`:** a day by the clock, at 23:59 and across midnight.
  - **E2E (`e2e/session-control.spec.ts`)**, with the stand-in `claude` and a `compact` record it
    can write:
    - mode **off**: neither flag in `claude-args.txt`, no team file;
    - **on**: the flag names a file present at start, holding the session's block;
    - a resume carries `--system-prompt-snapshot off`;
    - "New session" (the human's) carries the flag, and its block names it;
    - a fork gets one whole-block post after it joins;
    - a role change → one post; saving unchanged → none; then a `compact` record → the facts again;
    - the mode on → one post per running pane, however many changes the card makes;
    - a team post's turn does not wake the orchestrator;
    - per Q4 (a), a stand-in reporting an old version → no flags and one toast.
  - **E2E (`e2e/orchestration.spec.ts`):** the first-time card's new orchestrator carries the flag;
    a refused start leaves the mode off.
- [ ] Build:
  - `controlPaths().team`, `teamFile` in `buildCommand`;
  - the input at start (§2.3), for members and pending sessions;
  - the file written before the command, or flags dropped and logged;
  - `started` and `held` per pane, and `teamPost`;
  - the triggers: projects, names, start records, join; the settle; the turn mark; the
    `last_reply` skip;
  - `paneStart` passing `compact`;
  - the sweep;
  - `sessionMarks` and `list_sessions`' `skills`;
  - `startTeam`'s order;
  - the version read and Q4.
  - Keep §2.4's three pieces in separate functions.
- [ ] Docs:
  - `docs/session-control.md`: "The team block"; "What the skills lean on" and `last_reply`'s
    bullet, old text verbatim to the history;
  - `docs/context.md`: `compact` records read by main;
  - `docs/release-checklist.md`: §2.3's hand check;
  - `README.md`, "Install (Ubuntu)": the floor.
- **Verify:** `npm run ci` and `npm run ui-check`.

### Block 5 — "Configure role…", mock-up C (after 4 and Q5)

- [ ] Tests first, e2e in `e2e/orchestration.spec.ts`. The project folder, a git repository,
  holds `.claude/skills/{packager,review-branch,claude-cli}`, with a second project folder and a
  temporary user skills folder:
  - the menu shows "Configure role…" and no "Role…";
  - one group per folder and "Yours"; **no `menkar:` skill**; "0 chosen: none" at first;
  - ticking `packager` as Maintainer and `review-branch` (read only by default), then Save, writes
    §2.5's shape; **the running session gets one post** naming both (1.152, "at once");
  - with `claude-cli` maintained by another session: "maintained by ‹name›", and Maintainer
    disabled once ticked;
  - a stored skill deleted on disk shows under "Not found", and a filter that matches nothing still
    shows it. Remove, then Save, drops it. Cancel writes nothing;
  - the second folder's skills: disabled with "not available in …" (per Q5);
  - the same name in two places: ticking one ticks both;
  - screenshots, dark and light, of the window with a not-found and a maintained-elsewhere skill,
    to `$MENKAR_FILES`, the session's name first.
- [ ] Build mock-up C (§2.6, the artifact open):
  - IPC `skills:list`;
  - the action `configureRole`, which recomputes `found`;
  - strings in `en.ts` and `es.ts` ("Maintainer · Read only" / "Mantiene · Solo lectura";
    `orch.role*` replaced; `check-i18n` passes);
  - `roleDialog` removed; the look from `.dialog`.
- [ ] Docs: `docs/orchestration.md` (the window, the card's order, the mode switched while sessions
  run; old text to its history) and `docs/projects.md` (`skills`).
- **Verify:** `npm run ci`, `npm run ui-check`, the screenshots in the report.

### Block 6 — close

- [ ] `plans/00-STATUS.md`:
  - rows 1.148–1.152 and 1.154 point at their docs;
  - 1.109's and 1.84's rows amended, old cells verbatim to the history;
  - this plan's §3 row out, its closing note to the history.
- [ ] `docs/NOT_BUILT_YET.md`, "More coding agents": the per-agent team parts and how each is
  told, trigger plan 38's P1a.
- [ ] Delete `plans/ideas/team-protocol.md` and this plan.
- **Verify:** `npm run ci` (the history check).

---

## 6. Execution log

*(Written by the session that executes it.)*
