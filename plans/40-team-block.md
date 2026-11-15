# Plan 40 — the team block, stored skills, a generic `specialize`

> **Status: written, 2026-11-15, by `designer-40` (task 22). Not yet reviewed** — a Fable 5.2
> review, then the human. The human's answers of 2026-11-15 (1.154: mock-up C, `maintainer`,
> Menkar's skills never in the window, Q1–Q3) are folded in. What Claude Code does was measured by
> `claude-cli` (task 19) and answered by it on 2026-11-15 (§2.3, §2.6).
>
> **From:** decisions 1.148–1.154 (`plans/00-STATUS.md` §1), the human's ideas
> `plans/ideas/team-protocol.md` (Ideas A, A′, B, C) and `plans/ideas/research/mcp-instructions.md`.
>
> **Ships on `main`, in one commit, before plan 38's P0 snapshot** (the human, 2026-11-15): the
> lines that leave the skills need the block they move to, and the block needs the stored skills.
> Blocks 1–3 may land in the tree before block 4, but `set` commits nothing until block 4 passes.
>
> **Modifies:** decision 1.109's "where it lives" (the context policy leaves `menkar:specialize`
> and the role skills, 1.152) and 1.83's "Role…" dialog (replaced by "Configure role…"). 1.151
> amends plan 38's D10; plan 38's file is not edited here (`set` owns it).

## Exit — where each part goes when executed

| Part | Goes to |
|---|---|
| The team block: its source, how it is assembled, its file, its delivery for Claude, the posts that carry a change, what a resumed tab sees | `docs/session-control.md`, new section "The team block"; its "What the skills lean on" list is rewritten (the old text verbatim to `docs/history/session-control.md`) |
| The stored skills: the key in `projects.json`, one maintainer, following ids | `docs/projects.md`, "The orchestration mode's marks" (one bullet added) |
| "Configure role…" (mock-up C): behaviour, the skills Menkar lists and why only those, not found, maintained elsewhere; the first-time card's new order; the mode switched while sessions run | `docs/orchestration.md`, "Switching it, and the marks" ("Role…" bullet replaced; old text verbatim to `docs/history/orchestration.md`) |
| What the user reads about roles, skills and the block | `plugin/guide/orchestration-mode.md`, "The marks" and "Skills to load" |
| What was rejected (MCP `instructions` for Claude, skills set by agents, a loaded-skill check, implicit `menkar:worker` from the parent) | `docs/session-control.md` and `docs/orchestration.md`, their "Rejected" sections |
| The per-agent parts for Codex, Cursor and OpenCode, and how each receives the block | `docs/NOT_BUILT_YET.md`, a line in "More coding agents: Codex, OpenCode" (trigger: plan 38's P1a) |
| Rows 1.148–1.152 "this row (until built)", 1.154 "`plans/40-team-block.md` (until built)" | `plans/00-STATUS.md`: each row's "Where it lives" points at the docs above; 1.109's row gets its new home (the block, 1.154 Q1) |
| `plans/ideas/team-protocol.md` | Deleted on delivery (its own header says so); the research file stays until plan 38 uses it |
| The rest | `git log` |

---

## 1. Goal, and what already exists

**Goal.** Every Claude session of a project in the orchestration mode knows, from its first request
and after any compaction or renew, who it is in the team, what to load, and how the team talks —
without depending on another agent writing the right handoff. The team's communication lines are
written once (`plugin/team/`), the four skills point to it, the role's skills are stored by Menkar
and set by the human, and `specialize` binds any project. With the mode off nothing changes, to
the byte.

**What exists (verified at `543b228`):**

- `buildCommand` (`src/core/command.ts:53`) builds every agent command; Claude-only options sit in
  `if (claude)` lines after the identity: prompt file, `--add-dir`, `--mcp-config`, `--plugin-dir`,
  `--settings` (`command.ts:76-81`). Its tests are `tests/core/command.test.ts` (exact strings).
- `startPaneHeld` (`src/main/workspace.ts:790`) is the one place a pane's command is built; it
  knows the tab's project (`tabById(tabId)?.project`, :805), the agent and the start.
- Menkar's files under the cache: `controlPaths()` (`src/core/control/files.ts:52`), with
  `prompts/` written by `savePrompt` through `writeTextAtomic` (`src/core/control/prompt.ts:45`)
  and swept after a day.
- The marks: `Orchestration` (`src/core/projects/model.ts:19`) with `roles` by session id, parsed
  leniently, kept to members, followed to a new id (`followOrchestration`,
  `src/core/projects/orchestration.ts:113`), set by `setRole` (:169). `sessionMarks` (:268) feeds
  `list_sessions`.
- "Role…": `orchestrationItems` / `roleDialog` (`src/renderer/orchestration.ts:429-471`), action
  `setRole` (`src/main/workspace.ts:1377`, :2630), strings `orch.role*` (`src/core/i18n/en.ts:75-79`).
- Posting to a session: `postToSession` / `wakeFrame` (`src/core/control/post.ts`), used by
  `wakeSession` (`workspace.ts:1810`), Claude panes only, English text read by an agent.
- The first-time card's `startTeam` (`src/renderer/orchestration.ts:398`) starts a new orchestrator
  with `orch.firstPrompt` ("Load `menkar:orchestrator`…", `en.ts:117`) **and switches the mode on
  last** — so with this plan as-is, a new orchestrator would start with no block (fixed in block 4).
- The plugin (`plugin/`, `--plugin-dir`), its four skills, the guide, and their text rules in
  `tests/core/plugin.test.ts`; `scripts/check-package.mjs:40-43` requires its files in the .deb;
  `electron-builder.yml:30` ships the whole `plugin/` folder.
- E2E: `e2e/fixtures.ts` has a stand-in `claude` that records its arguments (`claude-args.txt`)
  and a messaging socket (`e2e/session-control.spec.ts:250`, a wake through it).
- **Where the communication lines are today** (each one leaves, block 3): orchestrator
  `SKILL.md:47-53, 56-59, 95, 106-107, 199-202`; worker `SKILL.md:39-40, 98-103, 131-134`; distill
  `SKILL.md:18-19, 70-73, 75-87`; specialize `SKILL.md:78-79, 88-89, 105-119`,
  `role-skill-contents.md:28-29, 37-38`.

## 2. The design

### 2.1 The block's text

Three parts, in this order: **the facts** (built by Menkar per session, `src/core/team/block.ts`),
**the common part** (`plugin/team/common.md`), **the agent's communication part**
(`plugin/team/claude.md`). English: it is read by an agent, not shown in the UI (as `wakeFrame`).

**The facts**, one line each, a line left out when it has nothing to say:

```
# Your team in Menkar
You are packager, a session of the Menkar project "menkar", in orchestration mode. Your role: Packaging. Your parent is set, the orchestrator.
Load these skills now: `packager`, which you maintain (only you change it, with `menkar:distill`); `claude-cli`, read only (claude-cli maintains it).
When a session hands you a task, load `menkar:worker` first.
Your parent decides when you renew; tell it by name when your context passes 90%.
```

Variants of line 2's tail (`teamFacts` chooses, tested case by case):
- the orchestrator: "You are its orchestrator." and line 3 starts with `menkar:orchestrator`;
  no `menkar:worker` line, no context line (its skill covers its context);
- a parent that is the orchestrator: "Your parent is ‹name›, the orchestrator.";
- another parent: "Your parent is ‹name›; the orchestrator is ‹name›.";
- loose: "You have no parent; the orchestrator is ‹name›."; no orchestrator marked: "The project
  has no orchestrator yet.";
- no role: "Your role:" left out.

Line 3, per stored skill: maintainer → "‹name›, which you maintain (only you change it, with
`menkar:distill`)" (the parenthesis once, on the first one); read only → "‹name›, read only
(‹session› maintains it)" or "read only" alone when no session maintains it; not found on disk →
"‹name› (not found: tell the human)". Line 5 is 1.154's answer to Q1; the percentages are the human's own
`ring_warn` / `ring_full` settings (`docs/context.md`, "The levels"), read at the block's writing.

**The common part** (`plugin/team/common.md`), as drafted:

```
## How the team works
- Address a session by its name, never by its id: a renewed session keeps its name and gets a new id.
- Messages that start with "[Menkar]" come from the app, not from a person.
- When you finish work another session handed you, or are blocked, your report is your last message: it is read with `last_reply`. If that session is not your parent, also send it the report by name: Menkar wakes only your parent.
- Renew only with `renew` and a prompt that is your handoff: what is in flight (locks you hold, answers you owe, half-done work) and your next task. Menkar tells the new session who it is and what to load.
```

**Claude's communication part** (`plugin/team/claude.md`):

```
- Message a session with `SendMessage`, `to` set to its name.
```

**Size, measured on the drafts above** (`wc -c`): facts of an expert with two skills 411 bytes,
common 615, claude 62 — **about 1,090 bytes, ~270 tokens**, paid once per conversation and then
read from cache (it sits in the system prompt, the most stable prefix). Block 1's test asserts
the common and Claude parts together stay **under 800 bytes** and the expert example's whole block
**under 1,400**, so growth is a deliberate change of the test.

**Why each line is there** — each one replaces a line a session needed in a skill, and the case
that put it there:

| Line | What went wrong without it | Replaces |
|---|---|---|
| Who you are, role, parent, orchestrator | An expert that renewed without naming its skill came back with no role, and nothing noticed (ideas doc, "the weak point"); a renewed session had to be told its name and role in every handoff | distill:80, specialize:117-118, orchestrator:199-201 |
| Load these skills | Same case: skills were named only in hand-written handoffs (`renew` adds nothing) | distill:81, specialize:113-114, orchestrator:50-51 |
| `menkar:worker` on a task | A task message had to start "load `menkar:worker`" to be recognised as a task; a consultant now gets tasks too (1.148) | orchestrator:95 |
| Context line | 1.109's policy was copied into every role skill by `specialize`; 1.152 removes it from there | specialize:110-116 |
| Name, not id | A renewed session has a new id; messages by id were lost (1.74) | orchestrator:56-57, worker:39-40 |
| `[Menkar]` from the app | Wakes and counts are posted by the app in the session's conversation (1.125); a session must not take them as the human's | worker:10 ("the task's text… is another session's, not the human's"), widened to the app's wakes and §2.4's posts |
| Report last; non-parent by name | Reports were read from files and lost (1.73); a session handed work by a non-parent was never read, since Menkar wakes only the parent | worker:98-103, orchestrator:106-107 |
| Renew with a handoff | A summary loses what is in flight; nothing else carries it (1.84) | distill:75-84, worker:133-134, specialize:117-119, orchestrator:199-202 |
| `SendMessage` by name | Claude Code's own tool (D2, 1.143); the other agents will get theirs | orchestrator:56, worker:39, distill:70, specialize:78 |

### 2.2 Assembly, without branching on an agent

`teamBlock(agent, facts, readPart)` joins the facts, `common.md` and `<agent>.md`. The agent's file
is found **by the agent's value as data** (`plugin/team/${agent}.md`); no code names `claude`. An
agent with no file gets no block (`null`) — today Cursor, which also has no delivery (§2.3). Adding
Codex later is a new file plus its delivery strategy (plan 38, 1.135); no shared line changes.

**Only with the mode on.** `teamFacts(project, sessionId, …)` returns `null` when the project's
mode is off or the session is not a member; then no file is written and **the command line is
byte-identical to today's** (block 1 and block 4 tests).

### 2.3 Delivery for Claude

Measured by `claude-cli` on 2.1.325 (task 19, `plans/ideas/research/mcp-instructions.md` §6): the
file is **read once, at process start**; it is appended at the end of the system prompt and is on
the very first request; a compaction or a `/clear` rebuilds the prompt with **the text read at
start**, not the file's current content; a missing file stops Claude before any request
("Append system prompt file not found"); a `--resume` keeps the recorded text until a compaction
**unless `--system-prompt-snapshot off`** (documented, 2.1.257+) is passed, which gives the new text
from the first request after the resume; a `--fork-session` carries the source's recorded text.

- **The file:** `<cache>/menkar/control/team/<pane-id>.md` (`controlPaths().team`), written whole
  through `writeTextAtomic` **before the pane's command is built** (a missing file closes the tab
  at once). One per start, since Claude reads it only then; swept after a day like the prompts
  (`sweepTeamFiles`, `PROMPT_KEEP_MS`, through the clock).
- **The flags:** `buildCommand` gains `teamFile?: string`; for Claude it appends
  `--append-system-prompt-file <quoted path>` **last**, after `--settings` (measured: last is the
  safest place; only the positional prompt must stay before `--add-dir`), and for a **resume** also
  `--system-prompt-snapshot off` before it. Absent, nothing is added.
- **Why the snapshot flag on resume, rather than a post:** a tab restored after a restart then
  starts with its current block in the system prompt, where it survives compaction, and nothing
  is woken. The cost is one cache write of the prefix on the first request when the block changed,
  which a restart past the cache's lifetime pays anyway (research §6, inferred). It is passed
  **only when a team file is**, so a project with the mode off keeps today's command to the byte.
- **Why the command line and not MCP `instructions`** (1.150, recorded): MCP instructions reach
  Claude as a conversation message framed as tool usage, capped at 4,096 characters, and may arrive
  after the first prompt (research §1, §5).

### 2.4 Keeping a running session's facts current

What a Claude session believes is what its **system prompt was started with**, plus the posts it
has had since; a compaction or a `/clear` drops the posts (they may be summarised away) and goes
back to the start text. So main keeps, per Claude pane, **`started`** — the facts in its system
prompt (from the file written at its start; `null` for a fork, which carries its source's, and for
a pane started with the mode off) — and **`told`** — what it was last told. The rule:

> Whenever the session's current facts differ from what it holds, Menkar posts them.

- **A change while it runs** (Menkar recomputes every running Claude pane of the project after a
  `projects.json` change): role and stored skills (1.152), the orchestrator mark and the parent
  (1.154, Q3). When the facts differ from `told`, it posts them and sets `told`. Unchanged facts
  post nothing, so saving the dialog unchanged wakes no one.
- **A compaction or a `/clear`** (the SessionStart record with `source` `compact` or `clear`
  naming the pane, which main already watches for `clear` and `resume`, `src/main/pane-starts.ts`):
  `told` goes back to `started`; when the current facts differ, they are posted again.
- **A fork** (`started` = `null`): the whole block is posted on the pane's first start record.
- **The mode switched** (1.154, Q2): **on** → every running Claude pane of the project is posted the
  whole block ("[Menkar] This project is now in orchestration mode. Your team instructions:" + the
  block); **off** → each pane that holds a block is posted "[Menkar] This project left
  orchestration mode: the "Your team in Menkar" instructions no longer apply." In both cases the
  same rule repeats it after a compaction or a clear, since the start text says the opposite.
- **The post**, through `postToSession` (`wakeFrame`'s time closes it; the counts tail only where
  it applies today, to the orchestrator):

  ```
  [Menkar] Your team facts changed; they replace the ones in your instructions:
  <the facts, without the heading>
  (10:42:07)
  ```

  While `postToSession` answers `'no session'` (the session not yet reachable after a start
  record), it is retried `TEAM_POST_TRIES` = 5 times, 2 s apart, then logged and dropped.
- `started`/`told` live in memory with the pane: a restart restarts every pane, and a resume gets
  the current block from its command (§2.3).

### 2.5 The skills Menkar stores

- **Shape**, per project in `projects.json`, beside `roles`:
  `orchestration.skills: { "<session-id>": [{ "name": "packager", "maintainer": true }, { "name": "claude-cli" }] }`
  — `maintainer` written only while true (1.154 names it so: the session that maintains the skill
  when it distills); order kept as the human set it.
- **Only the project's and the user's skills are stored.** Menkar's own skills are never stored and
  never shown (1.154): the block derives them from the marks (`menkar:orchestrator` for the
  orchestrator, `menkar:worker` when a session is handed a task, `menkar:distill` named beside a
  maintained skill). A `menkar:` name in the file is dropped on read, and `setSkills` refuses one.
- **Read leniently** (`parseOrchestration`): an entry that is not `{ name: non-empty string }` is
  dropped alone; a repeated name in one session's list keeps the first; **a second maintainer of one
  name** (a hand-edited file) reads as read only for every session after the first in member order.
- **Kept to members, followed to a new id, kept with the mode off** — the same three rules as
  `roles` (`keptOrchestration`, `followOrchestration`; tested beside them).
- **Set only by the human** (1.152): one action, `configureRole { session, label, skills }`, from
  the window (§2.6). **`setSkills` refuses** making a session maintainer of a name another session
  maintains ("‹name› is maintained by ‹session›."); one maintainer per skill (1.119). No MCP tool
  sets skills; `start_session`'s `role` stays as it is.
- **`list_sessions`** adds `skills: [{ name, maintainer }]` per session (with the mode on), so the
  orchestrator can name an expert's skill, read only, in a per-task worker's task
  (`plugin/skills/orchestrator/workers.md:34-35`).

### 2.6 "Configure role…" — mock-up C (1.154)

The human chose **mock-up C** of task 21 (artifact `UApjJwrv7yGBFAtLrK4Y6J`, "One checklist"),
without its "Menkar" group (1.154). The window, from the top:

- **Heading** "Configure role of ‹name›" (‹name› in the accent colour); it **replaces "Role…"** in
  the row menu, same place, same condition (mode on), label `orch.configureRole` "Configure role…"
  / "Configurar rol…".
- **Role**: today's field and hint (trimmed; empty removes the label).
- **Skills**, with "‹n› chosen: ‹names›" beside the label, then one bordered list with a filter
  field ("Filter skills…") on top, scrolling:
  - **Not found** first, in red, when a stored skill is no longer found: its name struck through,
    "Not found in this project's or your skills", and a **Remove** button. It stays stored and
    flagged until the human removes it (1.154); the block names it "(not found: tell the human)".
  - Then one group per source, heading on the left ("This project", "Yours") and its path on the
    right (`.claude/skills/`, `~/.claude/skills/`); a project with several folders shows one group
    per folder holding skills, headed by the folder's name. Each skill is a row with a **checkbox**;
    the filter hides rows whose name does not contain its text (case ignored), and a group left
    empty; with none left, "No skill matches."
  - **Ticking a skill adds it**, read only, and shows on that row the switch **"Maintainer · Read
    only"** ("Mantiene · Solo lectura"); unticking removes it.
  - **A skill maintained by another session**: unticked, the row notes "maintained by ‹name›";
    ticked, "Maintained by ‹name›" in the warning colour and the switch's Maintainer disabled. To
    move a maintainer the human unsets it on the other session first.
- **Legend** under the list: "Maintainer: this session is the one that updates it when it
  distills." / "Read only: it loads it and never edits it."
- **Cancel · Save** (Save suggested): Save applies label and skills in one `configureRole`
  action; Cancel and Escape change nothing. After Save, §2.4's post when the session runs and its
  facts changed.

**Why only the project's and the user's skills** (1.154): installed plugins' and MCP servers'
skills are already available to every session, and nobody in the team maintains them; leaving them
out keeps the list to the ~10–15 skills a project has, which is what makes one checklist workable.

**The skills Menkar finds** (`listSkills`, main, async, read only), where Claude Code finds them
(`claude-cli`, from Claude Code's skills doc, 2026-11-15): a skill's name is its frontmatter
`name`, else its folder's.
- The project's: `.claude/skills/<dir>/SKILL.md` in each of the project's folders (1.124's list:
  its sessions' folders and the ones the human added) **and in each parent up to that folder's
  repository root** (the nearest parent holding `.git`, a file in a worktree included), as Claude
  loads them from a session started there. Nested `.claude/skills/` deeper in a repository, which
  Claude loads only once it touches a file there, are not listed.
- The user's: `~/.claude/skills/<dir>/SKILL.md`.
- Each with its source and the frontmatter's `description` (first 200 characters, for the row's
  tooltip). A name found in several places shows once per source; what is stored is the name,
  which is what Claude loads.
- Read with `readdir`/`readFile` only, symlinks followed, a folder unreadable skipped with a log
  line; nothing under `~/.claude` or the project's folders is written (block 2's test).

### 2.7 The first-time card's order

`startTeam` switches the mode **on first**, then starts or marks the orchestrator, then hands the
chosen sessions over and saves the cap. If `startNew` is refused, it switches the mode back off
and shows the refusal as today. So a new orchestrator starts with its block (§2.3). Per 1.154 (Q2), a
session chosen while running gets the whole block as a post. `orch.firstPrompt` keeps its text:
the block names `menkar:orchestrator` too, and the duplicate costs nothing.

### 2.8 The skills, trimmed

Per-line edits are block 3's; the principles:

- **orchestrator:** the communication lines go (table in §2.1); renewing experts says "have them
  distill if they learned something, then renew; Menkar names their skills in the new session";
  its own renew handoff keeps only "what you owe". **1.148:** "A task for each piece of work you
  delegate" becomes "every request that needs more than a short answer gets a task — to a worker,
  an expert or a consultant; a short question to a consultant needs none"; a task that waits on
  something outside (a build, a hosted CI, a release) is set waiting with what it waits on, so
  working and waiting stay apart. **1.149:** when the human defers work — "tomorrow" or a named day:
  a task in the queue; "in the future", "someday", "tolerable for now": no task, the project's
  place for deferred work with its trigger; "another day" or unclear: ask whether to queue a task.
  These go in `workers.md` if `SKILL.md`'s body would pass 199 lines.
- **worker:** messaging, report-last and renew-handoff lines go; what it reports keeps its list.
- **distill:** step 1 "Find your skill" becomes "the skills your team instructions say you
  maintain; edit only those; a read-only one never"; with none, ask the human. Step 4 drops
  `SendMessage`. Step 5: the prompt carries what is in flight and the next task; "If your
  instructions have no team section, also say who you are and the skill to load."
- **specialize, generic** (1.152): no Menkar, no `menkar:` name, no tool of Menkar's, no
  `SendMessage`, no orchestrator; no context or renew policy, and `role-skill-contents.md` stops
  asking role skills to carry one ("It never starts sessions…" and "asks the orchestrator" become
  "asks whoever coordinates the work"). Its last step: "Ask the human to record this skill as one
  this session maintains, wherever their tool keeps a session's skills."
- **The guide:** "The marks" describes "Configure role…"; "Skills to load" says Menkar names them in
  each session's team instructions, from the marks and the stored skills.

### 2.9 Decided since the first draft

The human's answers (1.154, 2026-11-15), folded in above: **Q1** — the context policy (1.109) is one
facts line per profile with the human's own percentages (§2.1); **Q2** — switching the mode on
posts the whole block to each running session of the project, off posts one line (§2.4); **Q3** —
the orchestrator mark and the parent also trigger the at-once post (§2.4); the window is mock-up C,
Menkar's own skills never show in it, `keep` is `maintainer`, a stored skill not found stays
flagged until the human removes it (§2.5, §2.6).

Answered by `claude-cli` (2026-11-15) and used above: the file is read once at start (§2.3,
§2.4); `--system-prompt-snapshot off` rebuilds a resumed prompt from the current flags (§2.3);
skills' places and names (§2.6); `Skill` with an unknown name answers "Unknown skill: ‹name›", so a
stored skill not found is named as such in the block rather than left to fail.

### 2.10 Rejected, with why

- **MCP `instructions` for Claude** — a conversation message framed as tool usage, capped at 4,096
  characters, possibly after the first prompt (1.150, research §1, §5). It may still be another
  agent's strategy.
- **Skills set by `start_session` or by `specialize`** — only the human sets them (1.152); an agent
  that wrote the wrong skill name would mis-role a session silently.
- **Listing installed plugins' and MCP servers' skills** (1.154) — every session has them already
  and nobody in the team maintains them; the list stays at a project's ~10–15 skills.
- **Showing Menkar's own skills in the window** (1.154) — they follow from the marks; storing them
  would let a session be told to load `menkar:orchestrator` without being the orchestrator.
- **A check of which skills a session loaded** — the cause is removed at the source (the ideas doc,
  "Not taken", the human 2026-11-15).
- **`menkar:worker` implied by having the orchestrator as parent** — an expert does not always work
  a task, and a consultant now gets tasks without being a child (1.148); "when a session hands you
  a task" holds for both.
- **Facts in a template file** — the variants (orchestrator, child, loose, no orchestrator) are
  logic; one tested function is clearer than placeholders with conditions. The protocol, which has
  none, stays in files.
- **A post on every resume, or a "last told" file compared on resume** — `--system-prompt-snapshot
  off` gives a resumed session its current block in the system prompt, where it outlives a
  compaction; a post would be summarised away and wakes the session for nothing.
- **Rewriting the file when the facts change** — Claude reads it once, at start; a compaction and a
  `/clear` reuse what it read (measured). Only a post reaches a running session.
- **The snapshot flag on a fork** — not measured; a fork carries its source's recorded block (its
  name, its role), so it is posted the whole block once it starts (§2.4), which is known to work.
- **The flag before `--settings`** — measured to work, but last is where nothing can take it as
  another option's value.

## 3. Out of scope

- Delivery to Codex, Cursor and OpenCode and their communication parts (plan 38; `NOT_BUILT_YET.md`).
- Any change to `start_session`, `renew` or the wake texts other than §2.4's posts.
- The "Configure role…" layout (task 21 → the human).
- Editing a skill's text from Menkar; creating skills; showing a skill's body.
- Moving a maintainer in one step.
- Listing installed plugins' or MCP servers' skills (1.154).
- `plans/38-multi-agent.md`'s D10 row (1.151 says it is amended; `set` edits that file).

## 4. Do not touch

- `orch.firstPrompt`'s text, `wakeFrame`'s format and the counts tail (1.125).
- The command line of any session of a project with the mode off, and of any Cursor session.
- `~/.claude`, the project's `.claude/skills/` and the user's skills: read only.
- The 200-line limit and the other rules of `tests/core/plugin.test.ts`: extended, never loosened.
- `docs/history/` lines already there; `plans/38-*`, `plans/27-*`, `plans/28-*`.

---

## 5. Execution blocks

**Parallel:** blocks **1, 2 and 3 share no file** and may run at once (cap 3, 1.153). Block 4 needs
1 and 2. Block 5 needs 4. Block 6 closes, after 5.

| Block | Files it owns |
|---|---|
| 1 | `plugin/team/common.md`, `plugin/team/claude.md` (new), `src/core/team/block.ts` (new), `tests/core/team/block.test.ts` (new), `scripts/check-package.mjs` |
| 2 | `src/core/projects/model.ts`, `src/core/projects/orchestration.ts`, `src/core/team/skills.ts` (new), `tests/core/projects/orchestration.test.ts`, `tests/core/team/skills.test.ts` (new) |
| 3 | `plugin/skills/**`, `plugin/guide/orchestration-mode.md`, `tests/core/plugin.test.ts` |
| 4 | `src/core/command.ts`, `tests/core/command.test.ts`, `src/core/team/posts.ts` (new), `tests/core/team/posts.test.ts` (new), `src/core/control/files.ts`, `src/core/control/prompt.ts` (the sweep), `src/main/pane-starts.ts`, `src/core/context/statusline.ts` (`paneStart`), `src/main/control.ts` (the sweep's call), `e2e/fixtures.ts`, `src/core/control/protocol.ts`, `src/core/control/server.ts` if `list_sessions` is built there, `src/main/workspace.ts`, `src/renderer/orchestration.ts` (`startTeam` only), `e2e/session-control.spec.ts`, `e2e/orchestration.spec.ts`, `docs/session-control.md`, `docs/history/session-control.md` |
| 5 | `src/renderer/orchestration.ts` (the window), its CSS, the IPC module, `src/main/workspace.ts` (the action), `src/core/i18n/{en,es}.ts`, `e2e/orchestration.spec.ts`, `docs/orchestration.md`, `docs/projects.md`, `docs/history/orchestration.md` |
| 6 | `plans/00-STATUS.md`, `docs/NOT_BUILT_YET.md`, `plans/ideas/team-protocol.md` (deleted), this plan (deleted) |

### Block 1 — the block's source and assembly (parallel with 2 and 3)

- [ ] Tests first, `tests/core/team/block.test.ts`, each comment naming its decision:
  - 1.150: `teamFacts` for a project with the mode **off** → `null`; for a non-member → `null`.
  - The five line-2 variants of §2.1 (orchestrator; parent is the orchestrator; another parent;
    loose; no orchestrator) and no role — exact strings.
  - Line 3: maintainer, read only with its maintainer, read only with none, not found; the orchestrator's
    starts with `menkar:orchestrator`; no line when nothing to load.
  - `menkar:worker` line present for every session but the orchestrator.
  - Line 5 (1.154, Q1) per profile, with `ring_warn`/`ring_full` 60/90 and 50/80 (the numbers follow the
    settings).
  - `teamBlock('claude', …)` = facts + common + claude, in that order; `teamBlock` of an agent with
    no part file → `null` (with a fake `readPart`); the source has no string literal `'claude'`
    (parse with the TypeScript compiler API, as other shape rules do).
  - Size: `common.md` + `claude.md` under 800 bytes; the §2.1 expert example's block under 1,400.
- [ ] Write `plugin/team/common.md` and `plugin/team/claude.md` with §2.1's text;
  `src/core/team/block.ts` (`teamFacts`, `teamBlock`), pure, no Electron, time not read.
- [ ] `scripts/check-package.mjs` requires `resources/plugin/team/common.md` and `claude.md`.
- **Verify:** `npm run ci`; inject a defect once (drop the `menkar:worker` line) and see its test fail.

### Block 2 — stored skills and the skills Menkar finds (parallel with 1 and 3)

- [ ] Tests first, in `tests/core/projects/orchestration.test.ts`:
  - parse: valid entries kept; `{}`/non-string/empty name dropped alone; a repeated name keeps the
    first; a `menkar:` name dropped; two maintainers of `deploy` → the second member's reads read
    only.
  - serialize: `maintainer` only when true; no `skills` key when every list is empty; a project with no
    skills writes exactly what it writes today (same bytes).
  - kept to members; followed to a new id (`followOrchestration`); kept with the mode off.
  - `setSkills`: maintainer of a name another session maintains → refusal naming it; read only of
    it → accepted; any `menkar:` name → refusal; replaces the list whole.
  - `sessionMarks` gains `skills` (mode on), `[]` with the mode off.
- [ ] `tests/core/team/skills.test.ts` on a temporary tree: two project folders and a user folder;
  names, sources, descriptions; a frontmatter `name` wins over the folder's; a project folder inside a repository also lists the skills of its
  parents up to the folder holding `.git` (a directory or a file), and nothing above it; a symlinked skill found; an unreadable folder skipped; a
  folder with no `SKILL.md` ignored; **every file's mtime and the tree's listing unchanged after**
  (nothing written).
- [ ] Build: `skills` in `Orchestration`, parse/serialize/keep/follow, `setSkills`;
  `src/core/team/skills.ts` (`listSkills(places)`, async fs, folders passed in).
- **Verify:** `npm run ci`; inject a defect (let a second maintainer through) and see it fail.

### Block 3 — the skills trimmed, `specialize` generic, task 17's rules (parallel with 1 and 2)

- [ ] Test first, `tests/core/plugin.test.ts`:
  - **no communication line in a skill** (any of the four `SKILL.md` and their reference files):
    no `SendMessage`, no "last message", no "never by (an )?id", no "wakes only", no "load
    \`menkar:" — the block says these;
  - **specialize is generic**: its files contain no `/menkar/i`, no `/orchestrat/i`, no
    `SendMessage`, and no backticked name from `TOOL_NAMES`;
  - **distill edits only the skills it maintains**: its body matches `/read.only/` and `/maintain/`;
  - **1.148/1.149**: the orchestrator's files mention a task for a consultant, "waiting" on
    something outside, and the three horizons (`tomorrow`, `in the future`, `another day`).
  Adjust the existing test that requires `renew` in distill only if the new text drops it (it
  should not: step 5 keeps `renew`).
- [ ] Edit the four skills per §2.8, line by line against §1's list; `role-skill-contents.md`;
  `where-knowledge-goes.md` if it names Menkar (today it does not). Each `SKILL.md` body stays
  under 200 lines and keeps "What earns a line here:".
- [ ] The guide's "The marks" and "Skills to load" (§2.8).
- **Verify:** `npm run ci`; re-add one `SendMessage` line and see the test fail.

### Block 4 — delivery, posts, the card's order (after 1 and 2)

- [ ] Tests first:
  - `command.test.ts`: `teamFile` → `--append-system-prompt-file '<path>'` **last**, for new and
    fork; for a resume `--system-prompt-snapshot off --append-system-prompt-file '<path>'` last;
    **without `teamFile`, each of today's exact-string tests passes unchanged** (1.150: mode off is
    byte-identical, the snapshot flag included); a Cursor command with `teamFile` given gets nothing.
  - `tests/core/team/posts.test.ts`, the pure rule of §2.4 (`teamPost(started, told, current,
    event)` → nothing, the facts, the whole block or the leaving line): a change with facts equal
    to `told` → nothing; different → the facts; a `compact` or `clear` with `told` ≠ `started` and
    current = `started` → nothing (the start text is right again); current ≠ `started` → the
    facts; a fork's first start → the whole block; per 1.154 (Q2) mode on with `started` = `null` →
    the whole block, and again after a compaction; mode off with `started` set → the leaving line.
  - `sweepTeamFiles`: a day by the clock, at 23:59 and across midnight; a newer file kept.
  - E2E (`e2e/session-control.spec.ts`, the stand-in `claude`): a project with the mode **off**
    → `claude-args.txt` has neither flag and no team file is written; **on** → the flag names a file,
    present when the stand-in starts, whose text is the block for that session; a resume carries
    `--system-prompt-snapshot off`; a role changed while it runs → one post through the messaging
    socket with the new facts, saving it unchanged → none; a `compact` start record afterwards → the
    facts posted again; per 1.154 (Q2), switching the mode on → the whole block posted.
  - E2E (`e2e/orchestration.spec.ts`): the first-time card with a new orchestrator → its first
    command carries the flag; a refused start leaves the mode off.
- [ ] Build: `controlPaths().team`; `teamFile` in `buildCommand`; in `startPaneHeld`, for an agent
  whose block is not `null`, write the file before building the command and pass it; the pane
  keeps `started` and `told`; `src/core/team/posts.ts` (`teamPost`); main applies it after
  `projects.json` changes, mode switches and start records: `paneStart`
  (`src/core/context/statusline.ts`) today passes only `clear` and `resume` records; it passes
  every source, `watchPaneStarts` hands each one to the team rule, and `followPaneStart` keeps
  acting only on `clear` and `resume` (its tests unchanged); `sweepTeamFiles` hourly with the prompts' sweep;
  `list_sessions`' `skills`; `startTeam`'s order (§2.7). The stand-in `claude` of
  `e2e/fixtures.ts` gains a way to write a `compact` start record.
- [ ] `docs/session-control.md`: "The team block" section; "What the skills lean on" rewritten,
  the old bullets verbatim to `docs/history/session-control.md`; "Rejected" gains MCP
  `instructions` for Claude.
- **Verify:** `npm run ci` and `npm run ui-check` (the two specs above pass; the rest unchanged).

### Block 5 — "Configure role…", mock-up C (after 4)

- [ ] Tests first, e2e (`e2e/orchestration.spec.ts`), mode on, with a project folder holding
  `.claude/skills/{packager,review-branch,claude-cli}` and a temporary user `~/.claude/skills/`:
  - the session's menu shows "Configure role…" and no "Role…";
  - the window lists "This project" and "Yours" and **no `menkar:` skill**;
  - ticking `packager`, setting it Maintainer, ticking `review-branch` (read only by default) and
    Save writes `projects.json` as §2.5 (`maintainer: true` on the first only);
  - with `claude-cli` maintained by another session: its row says "maintained by ‹name›", and once
    ticked the switch's Maintainer is disabled;
  - a stored skill deleted on disk shows first under "Not found"; Remove then Save drops it; Cancel
    writes nothing;
  - the filter hides non-matching rows and shows "No skill matches." when none is left;
  - screenshots of the window with a not-found skill and a maintained-elsewhere one, dark and light,
    to `$MENKAR_FILES`, the session's name first.
- [ ] Build mock-up C (§2.6): IPC `skills:list` (main runs `listSkills` with the project's folders
  and `~/.claude/skills`), action `configureRole`, strings in `en.ts` and `es.ts` ("Maintainer ·
  Read only" / "Mantiene · Solo lectura"; `orch.role*` replaced; `check-i18n` passes),
  `roleDialog` removed; the dialog's look from Menkar's existing `.dialog` styles.
- [ ] `docs/orchestration.md` ("Role…" bullet → "Configure role…", the card's order, the mode
  switched while sessions run; old text verbatim to its history); `docs/projects.md` (the `skills`
  key).
- **Verify:** `npm run ci`, `npm run ui-check`, and the screenshots listed in the report.

### Block 6 — close

- [ ] `plans/00-STATUS.md`: rows 1.148–1.152 point at their docs; 1.109's row amended per 1.154 (Q1) (the
  old cell verbatim to `docs/history/plans/00-STATUS.md`); this plan's §3 row out, its closing note
  to the history.
- [ ] `docs/NOT_BUILT_YET.md`, "More coding agents": the per-agent team parts and their delivery,
  trigger plan 38's P1a.
- [ ] Delete `plans/ideas/team-protocol.md` and this plan.
- **Verify:** `npm run ci` (the history check).

---

## 6. Execution log

*(Written by the session that executes it.)*
