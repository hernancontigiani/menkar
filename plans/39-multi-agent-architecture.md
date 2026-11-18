# Plan 39 — The software architecture of multi-agent support

> **Status: written 2026-11-15 by the architect (`menkar-t13`, task 13); reviewed by a Fable 5.2
> session (`menkar-t29`, task 29); revised for every finding by `designer-40` (task 34,
> 2026-11-16) — §2.16 says where each went.** Not executed until the human says so.
>
> - **Decided by the human:** 1.155 (Q1–Q4, §2.14), 1.157 P1 (the sandbox installs outside
>   `/opt/Menkar`), 1.158 (the sandbox duplicates everything it needs), 1.159 (the review's B1, B3,
>   S6, S7, S11 as recommended; the classifier configurable per agent).
>   **1.160** (Q-a): P0.1 and P0.2 land on `main` right after the team block (1.150–1.154, 1.157)
>   and the .deb for the human's other project, before the branch exists (§2.12). **1.161** (Q-b): the classifier per agent is one
>   block after P3, P4, with all four agents in view; until then only `claude -p` classifies
>   (§2.17).
>
> **From:** plan 38 (`plans/38-multi-agent.md`, the design: what and why), decided as D1–D22 in
> `plans/00-STATUS.md` 1.137–1.143; 1.135 (strategies, never `if`/`else` on the agent), 1.136 (a
> branch in its own worktree), 1.142 (the phases; P0 merges to `main` early), 1.150–1.154 and 1.157
> (the team block, built: `docs/session-control.md`, "The team block"; its delivery is one more
> per-agent concern here; D10 amended by 1.151).
> Research: `plans/ideas/research/agents-compared.md` (cited `cmp §n`), `codex.md`, `cursor.md`,
> `opencode.md`, `mcp-instructions.md` §6–§7 (Claude's flags, measured); the consultants' answers
> of 2026-11-15 and 2026-11-16 — recorded in their research files or below where they are used.
>
> **Plan 38 stays the design; this is how.** Nothing here repeats 38's reasons: it cites them.
>
> **Precondition, met: the team block is on `main`, whole** (`dd28a29`): `src/core/team/block.ts`
> (`TeamInput`, `TeamAgent`, `TEAM_AGENTS`, `teamFacts`, `teamBlock`), `src/core/team/skills.ts`
> (`listSkills`, `foundFor`), `plugin/team/{common,claude}.md`, its delivery and posts with
> `started`/`held` (`src/main/team.ts`, `src/core/team/posts.ts`) and "Configure role…";
> described in `docs/session-control.md` ("The team block"), `docs/orchestration.md` and
> `docs/projects.md`. P0.3 moves what it built, **read from the tree then**; R10's snapshot (P0.1)
> is taken on that tree.

## Exit — where each part goes when executed

| Part | Goes to |
|---|---|
| The architecture: the pattern, the module layout, the interfaces per concern, how a kit is chosen, the dependency rules and their check, what was rejected (§2.1–§2.5, §2.15) | New `docs/agents.md`, "How the code is organised" (P0.7); its per-agent sections are added by each phase (P1a, P1b, P2, P3), with plan 38's exit for the rest |
| The rules "no agent named outside its folder" and "no default agent compared", their enforcement | `AGENTS.md`'s existing per-agent bullet gains "enforced by `scripts/check-code-rules.mjs`" (P0.7); `docs/toolchain.md`'s checks table gains the rules' rows (P0.2) |
| The branch, its worktree, its build, `ui-check` beside `main`'s, fixes flowing in, the test baseline and R10's byte guard (§2.12) | `docs/toolchain.md`, new section "A long-lived branch" (P0.1); removed into its history when the branch merges for good (close block) |
| R10's snapshot: what it holds, who refreshes it | `docs/toolchain.md`, same section (P0.1) |
| The hand checks per phase | `docs/release-checklist.md`, a section per phase (P0.8, P1a.7, P1b.6, P2.7, P3.5) |
| The readers' rules (incremental reading per agent, SQLite read-only, zstd, rewritten transcripts) | `docs/sessions.md` and `docs/usage.md`, a line each pointing to `docs/agents.md` (P1a, P2, P3) |
| The team block per agent (today's Claude delivery, generalised) | `docs/session-control.md`, "The team block" gains "Per agent" (P0.3; each phase adds its agent) |
| Menkar's `opencode serve`, the proxy | `docs/agents.md`, OpenCode; `docs/session-control.md`'s port rejection amended, the old text to its history (P2.7, plan 38's exit) |
| The shipped hook and notify programs | `docs/packaging.md` (P1a.4, P3.3) |
| `smol-toml`, the one new runtime dependency | `docs/toolchain.md`'s dependency list, with its reason (P1a.2) |
| The engines floor (`>=22.15.0`, for zlib's zstd under Vitest) | `package.json` and `docs/toolchain.md` (P1a.3) |
| The classifier per agent (1.159, 1.161) | `docs/classifier.md`, "Which agent classifies" (P4); D19's text amended, old to its history |
| 1.155, 1.157 P1, 1.158, 1.159: their "where it lives" | `plans/00-STATUS.md`: each points at `docs/agents.md`, `docs/sessions.md`, `docs/toolchain.md` and `docs/packaging.md` (the sandbox), `docs/classifier.md` |
| The sandbox flavour: what differs, what is still shared and how it is kept safe (§2.12) | `docs/toolchain.md`, "A long-lived branch"; the package side to `docs/packaging.md`, "The sandbox package" (P0.0) |
| What is deferred (§3) | `docs/NOT_BUILT_YET.md`, each with its trigger (close block) |
| `plans/ideas/research/review-39.md` | Deleted by this revision: every finding is in this plan (§2.16) |
| The rest | `git log`; this plan and plan 38 are deleted by the close block |

---

## 1. Goal, and what exists

**Goal.** Turn plan 38 into code where **each coding agent's behaviour is a set of strategies, one
per concern, assembled into one kit per agent, and chosen once** from the session's agent — so a
change to Cursor's kit cannot break Claude's, shared code names no agent, and a test fails the day
someone writes `if (agent === 'cursor')` in shared code (the human, 2026-11-14, 1.135). Phase by
phase: **P0** (Claude and Cursor moved behind the interfaces, no behaviour change, merged into
`main`), **P1a** (Codex as a session), **P1b** (the orchestration bridge, with Codex), **P2**
(OpenCode), **P3** (Cursor completed).

### What exists (verified at `5407f37`; re-checked at `44da355` where marked ✓)

- **The agent is a string union written out in seven places:** `Agent` (`src/core/sessions/lines.ts:1`),
  `PaneAgent` (`src/shared/workspace.ts:12`), `agents` (`:118`), `startNew.agent` (`:233`),
  `ChatAgent` (`src/core/chat/variants.ts:3`), `provider` (`src/main/panes.ts:7`, `:62`), the
  renderer's `Agent` (`src/renderer/addsession.ts:22`), `installedAgents`
  (`src/main/workspace.ts:277`).
- **The name checks: 60 lines at `5407f37`** (`grep -rn "'cursor'\|=== 'claude'\|!== 'claude'" src`):
  `src/main/workspace.ts` 18, `src/renderer/addsession.ts` 8, `src/core/sessions/` 15 (transcript 4,
  scanner 3, lines 2, badges 2, head 2, names 1, service 1), `src/core/chat/` 4,
  `src/core/agentstate/detect.ts` 3, `src/renderer/app.ts` 3, `src/shared/workspace.ts` 3,
  `src/renderer/sessionmenus.ts` 2, `src/main/panes.ts` 2, `src/core/command.ts` 1,
  `src/main/remote-live.ts` 1. The grep misses more that P0.2's rules find: the literal
  `agent: 'claude'` in actions (`workspace.ts:1531`, `:1658`, `:2938`, `:2988`,
  `src/renderer/orchestration.ts:412`), property accesses by name (`AGENT_COMMANDS.cursor`,
  `workspace.ts:2291`; `installed.claude`, `scanner.ts:204`), the usage cache's `claude`
  property (`src/core/usage/cache.ts:412,417`, `history.ts:290`, the `names.claude` column), and
  **identifiers named after an agent** (`claudeArgs`, `claudeEvents`, `cursorTurn`,
  `src/core/chat/processes.ts:12-13,98-143` ✓; `agentPaths().claude*`; `src/core/context/*`;
  `src/core/usage/{cache,transcript,files}.ts`; `src/core/control/post.ts`). **The team block adds
  one per-agent table outside an agent folder**: `TEAM_AGENTS` (`src/core/team/block.ts:33` ✓,
  `Partial<Record<Agent, TeamAgent>>`, Claude only).
- **Not agent behaviour, though spelled like it:** xterm's theme key `cursor:` (the caret colour,
  `src/renderer/terminals.ts:66,88` ✓) and the SQL column `claude` (`usage/cache.ts:417`,
  `history.ts:290` ✓). They are the rules' permanent exceptions (§2.2).
- **"Unknown means Claude" in two places that matter:** `resumeSpec` resumes a session main does
  not know as Claude (`workspace.ts:2249`, `info?.agent ?? 'claude'`), and `agentName` reads
  anything not Cursor as Claude (`:288`). **Saved state holds no agent at all**: a saved tab is
  session ids (`SavedTab`, `src/core/projects/model.ts:73`), a member is a session id; the only
  agent value saved is `last_agent` (`src/core/settings.ts:29`).
- **Unknown sessions are dropped before tabs start** ✓: `dropUnknownSessions`
  (`workspace.ts:743-755`) removes from every saved session tab the panes whose id no reader found,
  and the tab when none is left; it runs at `:2275`, before `startShownTabs` (`:722`, gated on
  `sessionsLoading`). So an unknown id at restore is gone before anything could tolerate it — P0.6
  changes it (§2.4).
- **A new session whose id is unknown** (Cursor today, `workspace.ts:2392`) waits as a `Pending`
  (`src/core/sessions/join.ts`) and joins when a transcript with a typed message appears.
- **`buildCommand`** (`src/core/command.ts:53`) gates every Claude option on `agent === 'claude'`;
  `startPaneHeld` (`workspace.ts:790`) assembles the options inline (`:813-830`): `--settings`,
  `--mcp-config` and `--plugin-dir` Claude-only, the files folder as `--add-dir`, the pane's
  environment (`MENKAR_PANE`, `MENKAR_FILES`).
- **Remote Control's live reading** is Claude's registry reader (`src/main/remote-live.ts:67,72,95`).
- **Fork** is Claude-only today (`forkSession`, `workspace.ts:2987-2992`).
- **The scanner** reads JSONL files only (`src/core/sessions/scanner.ts`): `claudeTranscripts`,
  `cursorTranscripts`, an incremental per-file state (inode, offset, head, tail). Cursor's reader
  today reads Cursor's transcript **with the same offset logic** as Claude's.
  `SessionInfo.file` (`src/core/sessions/info.ts`) is used by main for the context tracker
  (`workspace.ts:618`), `lastReply` (`:1745`), details (`:3040`), export (`:3061`), "show in
  folder" (`:3072`), trash and delete (`:3077-3083`). Its tests call the facades with today's
  types (`tests/core/sessions/discover.test.ts:25,36,60`, `service.test.ts:42-46`).
- **Usage:** `runPass` (`src/core/usage/pass.ts`) ingests Claude's transcripts into a derived cache
  (`usage-cache`, `SCHEMA_VERSION = 1`, rebuilt when its version differs) and writes the history
  (`HISTORY_VERSION = 3`, never rebuilt). `UsageHistory.write` needs only four methods of the cache
  (`pending`, `turnUsage`, `names`, `written`, `history.ts:224-297`); the classifier reads a turn's
  bytes through `extent`/`previousHuman` (`src/core/classifier/turns.ts`) and runs `claude -p`
  with Haiku. Exact cost comes from the statusline's running totals (`readStatusline`,
  `src/core/usage/statusline.ts:68`), applied over the price table's estimate per session
  (`report.ts:118-136`).
- **State:** `detectState(provider, …)` (`src/core/agentstate/detect.ts:103`) branches on the name;
  a turn's end comes from Claude's Stop hook as **one record per pane, `<pane>.json`, overwritten
  each turn** in `turnEndsDir()` (`src/core/context/statusline.ts:53`), read by
  `src/main/control.ts:63-82`.
- **SessionStart records** (`startup`, `resume`, `clear`, `compact`; no `fork` matcher,
  `START_SOURCES`, `statusline.ts:61`); `followPaneStart` (`workspace.ts:1848`) tells a `/clear`
  from an in-session `/resume` by the record's `source` (`:1850`, `:1867`).
- **Menkar's MCP:** `answer` (`src/core/control/protocol.ts:304`) lists one constant `TOOLS`,
  `capabilities: { tools: {} }`; the caller is `MENKAR_PANE` (`server.ts:37`); `handleControl`
  refuses any non-Claude pane (`workspace.ts:1136`); `resume_session` too (`:1259`); `wakeSession`
  is Claude's socket only (`:1810`).
- **Environment:** `SESSION_ENV` / `withoutSessionEnv` (`src/core/sessionenv.ts`), Claude's
  variables only.
- **The shape-rule checker exists**: `scripts/check-code-rules.mjs` parses with the TypeScript
  compiler (the clock, `src/core` imports, `any`); `tests/core/shortcut-handlers.test.ts` is the
  precedent of a literal rule with an `ALLOWED` map, each entry with its reason.
- **`scripts/check-test-integrity.mjs`** ✓ fails on any removed `expect(` line, with no override,
  against `MENKAR_TEST_BASELINE` (default `'main'`, `:19`). On a branch that has merged `main`,
  `main` is the right baseline only when it is the merge base; P0.1 makes it so (§2.12).
- **Node:** Electron 45.2.3 runs Node 24.22.2; Vitest runs the system Node (22.21.1 here,
  `engines: >=22.12.0 <23`). `zlib.zstdDecompressSync` and the streaming `createZstdDecompress`
  exist in both (checked 2026-11-15); they appeared in Node 22.15.
- **SQLite read-only, measured here (2026-11-15, node:sqlite on Node 22.21.1):** on a WAL database
  whose writer had closed, `new DatabaseSync(path, { readOnly: true })` **creates `-shm` and `-wal`
  and leaves them** after close; `file:<path>?immutable=1` read-only creates nothing; a plain
  read-only open while a writer holds the database adds no file (the writer's own are there).
  A third state is not measured: a leftover `-wal` with no `-shm` (a writer that crashed); §2.6's
  rule treats it.
- **Claude Code's flags for the team block** (`mcp-instructions.md` §6–§7, measured on 2.1.325):
  the file is read once at start; `--resume` keeps the recorded block until a compaction unless
  `--system-prompt-snapshot off`, which rebuilds the system prompt per request, byte-identical
  across a branch, a commit and a new file (date and git status live in messages, not in
  `system`); **a later resume without the flag reverts to the block recorded at the
  conversation's first request**; the snapshot flag's floor is **2.1.267** (the changelog; the doc
  says 2.1.257); an unknown flag stops Claude before any request (`unknown option`, exit 1).
- **A Menkar post as it lands in a Claude transcript** (`mcp-instructions.md` §7, run 11): a `user`
  record whose `message.content` is a string starting `"Another Claude session sent a message:\n"`
  then Menkar's text, with `isMeta: true`, `origin.kind: "peer"`, `origin.from: "menkar"`; preceded
  by a `queue-operation` and an `api-request-blob` record (a type no reader keeps today).
- **Stand-ins** are inline in `e2e/fixtures.ts` (a `claude` that records `claude-args.txt` and
  `claude-env.json`, `:27-29`; a messaging socket); `e2e/path.ts` builds the closed PATH.

---

## 2. The design

### 2.1 The pattern: a kit of strategies per agent, chosen once

- **Strategy, one interface per concern** (§2.3). Each agent implements the concerns it has; a
  concern it lacks is **`null` in its kit**, never a stub that pretends (Cursor has no context
  reading: `context: null`; Codex and OpenCode have no trash: `trash: null`, D18).
- **A kit per agent** groups its strategies: one object, `AgentKit`, built in the agent's folder
  (`src/core/agents/<id>/index.ts`), plus `MainAgentKit` for what needs Electron's main process or
  long-lived processes (`src/main/agents/<id>/index.ts`). Assembling once per agent is what lets a
  test run one agent alone (`vitest tests/core/agents/codex`).
- **A registry chooses**: `kitOf(id)` (core) and `mainKitOf(id)` (main) are each a `Record<AgentId,
  …>` literal, so `tsc` refuses a registered id without a kit. **They are the only code that maps an
  id to behaviour.** A pane stores its kit when it is made (`pane.kit = mainKitOf(spec.agent)`);
  a session's kit is looked up from `SessionInfo.agent` once per call site that needs it.
- **What the renderer and the MCP server program need is data**: `AgentDescriptor` (id, the CLI's
  command name, label key, glyph, capabilities), in `src/core/agents/<id>/descriptor.ts`, gathered
  by **`src/core/agents/descriptors.ts`** (`descriptorOf`, `DESCRIPTORS`), which imports only the
  descriptor files and nothing from Node (S3; a rule holds it, §2.2). The renderer reads
  `descriptorOf(info.agent).caps.fork` instead of `info.agent === 'claude'`.
- **A capability is a fact the renderer shows, mirrored by a kit's nullness.** Each cap has a
  concern behind it (`fork` ⇔ `kit.fork !== null`, `remote` ⇔ `mainKit.remote !== null`, `trash`
  ⇔ `catalog.trash !== null`, `chat` ⇔ `kit.chat !== null`, `context` ⇔ `kit.context !== null`); a
  **parity test** over every registered agent asserts each pair (S2). Shared main code reads the
  kit, never the cap.
- **Shared mechanisms stay shared and are fed by the strategies**: one turn-end record format, one
  way a pending pane binds its id, one wake batcher, one Usage history, one MCP server program, one
  team-block rule (§2.5). The strategy produces or consumes; the mechanism never asks who.

**Why this and not the alternatives** (each with what it would break):

- **A class hierarchy** (`abstract class Agent`, `class Codex extends Agent`): a fix in a base
  method reaches every agent, which is exactly the coupling the human ruled out; and the concerns
  vary independently (Cursor shares Claude's `--plugin-dir` mounting but nothing else).
- **Capability flags read in shared code** (`if (caps.lateId) … else …`): still `if`/`else` on the
  agent, one step removed. Flags are kept only for what the **renderer** shows. **Shared code may
  test whether a concern is `null`** (the type forces it); it never tests which agent it is, nor a
  flag or a discriminant that stands for one — a question with an agent-specific answer is a
  **method** of the strategy (`ids.newId()` returns a UUID or `null`; a team delivery's
  `heldAtStart(start, …)` returns what the session holds, not a `holds: 'recorded'` tag that
  shared code would switch on — S2).
- **One interface for everything** (`interface Agent { … 40 methods }`): every agent stubs what it
  lacks, and a stub that returns a plausible value hides a missing feature.
- **Loading agents dynamically (plugins)**: no consumer; four agents known at build time.

### 2.2 Where the code lives, and the rules a test holds

```
src/core/agents/
  ids.ts            AgentId, AGENT_IDS (order offered), DEFAULT_AGENT, CLASSIFIER_AGENT (until §2.17),
                    parseAgentId(value) → AgentId | null
  types.ts          the interfaces of §2.3 (types only), each added by the block that first implements it
  descriptors.ts    descriptorOf, DESCRIPTORS — imports only <id>/descriptor.ts; Node-free
  registry.ts       kitOf — the only importer of the agent folders' kits (core)
  shared/           helpers several agents use: JSONL slices, the SQLite read-only open (§2.6),
                    zstd, the turn-end record writer; imports no agent folder
  claude/  cursor/  codex/  opencode/
                    descriptor.ts (renderer-safe), launch.ts, catalog.ts, usage.ts, state.ts,
                    env.ts, mcp.ts, team.ts, ids.ts, … index.ts (the kit)
src/main/agents/
  registry.ts       mainKitOf — the only importer of the main agent folders
  shared/           e.g. the wake router's helpers
  claude/  cursor/  codex/  opencode/
                    waker.ts, remote.ts (Claude), prepare.ts, server.ts/proxy.ts (OpenCode),
                    namer.ts (Codex), index.ts
```

Programs an agent runs (Codex's `notify`, Cursor's hooks) are entries in
`electron.vite.config.ts` beside `statusline` and `mcp-server`, their source in the agent's core
folder (`src/core/agents/codex/notify.ts`), so they run as plain Node with no Electron.

**The rules, in `scripts/check-code-rules.mjs`, parsed with the TypeScript compiler** (AGENTS.md:
a shape rule is a parse, not a grep). "Its folder" means `src/core/agents/<id>/` and
`src/main/agents/<id>/`; the agent ids and CLI names are read by the script from `ids.ts` and the
descriptors.

| Rule | What it forbids | Where it does not apply |
|---|---|---|
| `agent-literal` | A string literal (or no-substitution template) whose whole text is an agent id or an agent's CLI name (`'claude'`, `'cursor-agent'`, `'codex'`, …) | The agent's own folders, `ids.ts`, `descriptors.ts`, the two registries, `tests/`, `e2e/` |
| `agent-property` | A property access, element access with a literal, object-literal key or type-literal key named as an agent id (`AGENT_COMMANDS.cursor`, `{ claude: … }`, `installed.claude`) | Same |
| `agent-identifier` | A declared identifier (function, variable, parameter, property, type) whose name contains an agent id as a word part (`claudeArgs`, `cursorTurn`, `codexHome`) — S1 | Same |
| `agent-import` | An import of `agents/<id>/…` from anywhere but its registry (or `descriptors.ts` for `<id>/descriptor.ts`); an import from `agents/<id>/` into `agents/<other>/`; an import of an agent folder from `agents/shared/` | — |
| `agent-default` | `DEFAULT_AGENT` or `CLASSIFIER_AGENT` as an operand of `===`, `!==`, `==`, `!=` or a `switch` discriminant or `case` (B2: comparing to the default is a name check in disguise) | `ids.ts`, the two registries |
| `descriptors-node-free` | `src/core/agents/descriptors.ts` or a `descriptor.ts` importing anything but another descriptor file and `ids.ts`; the renderer or `src/core/control/server.ts` (the MCP server program) importing `registry.ts` or an agent's kit (S3) | — |

**The `ALLOWED` map** (`'<file>': { '<rule>': <count> }` with a reason per entry, as
`shortcut-handlers.test.ts` keeps reasons) holds **counts per file and rule**, and the check fails
when a file has **more** hits than its entry — so a count may only go down (S1). P0.2 seeds it with
every current site, each reason "moved in P0.n"; each P0 block lowers its entries; **P0.7 leaves
only the permanent ones**, each named with its reason:

- `src/renderer/terminals.ts`: `agent-property` 2 — xterm's theme key `cursor` is the caret's
  colour, not the agent;
- `src/core/usage/cache.ts`, `src/core/usage/history.ts`: `agent-property` — the SQL column
  `claude` (`names.claude`), kept for the history's bytes (§3, no schema change); the TypeScript
  property becomes `given`;
- nothing else: what remains named after an agent outside its folder at the end of P0
  (`agentPaths().claude*` and the `src/core/context/*`, `usage/{cache,transcript,files}.ts`,
  `control/post.ts`, `chat/processes.ts` identifiers) **moves into the agent's folder** in the P0
  block that owns that file, or is renamed for what it is (`agentPaths().claudeProjects` →
  Claude's catalog's `roots`). Where a move is not worth it, the entry stays in `ALLOWED` with its
  reason, and `docs/agents.md` lists it.

`tests/scripts/check-code-rules.test.ts` gains a case per rule, each seen failing once on an
injected line, and a case where a count above its entry fails.

### 2.3 The interfaces, checked on paper against the four agents

`types.ts` declares them, **each in the block that first implements it** (S2: no interface
without a consumer). The cells are each agent's implementation; **m/r/i** as in `cmp`. Names are
the plan's; an executor may rename a member, not merge two concerns. The column "First in" is the
block that adds the interface to `types.ts`.

| Concern (interface, side) | First in | Claude | Cursor | Codex | OpenCode | Pressure on the seam |
|---|---|---|---|---|---|---|
| **Descriptor** (data, core, renderer-safe) | P0.2 | `claude`, ✳, caps: remote, fork, trash, chat, context | `cursor-agent`, ➤, caps: trash, chat | `codex`; caps: context | `opencode`; caps: context | Caps mirror kit nullness (parity test, §2.1); nothing in it says "how" |
| **Launcher** `plan(start, ctx) → LaunchPlan` (core, pure): `{ words, env, files }` | P0.3 | today's command; the team flags (§2.5.6) | today's (`--resume`); P3: prompt, `--model`, `--new-session-id`, per-pane `--plugin-dir` | `codex [resume <id>] [-m] [--add-dir] -c notify=… -c mcp_servers.menkar.… -c developer_instructions=… "<prompt>"` (cmp 1.1) | `opencode --server <proxy url> -s <id> --prompt "<p>"`, password in `env` | `LaunchPlan.files` are written before the command (the team file, a per-pane plugin folder, Codex's chained instructions and notify arguments, minor); `ctx` carries the MCP mount, the team block, the prompt file, add-dirs, the pane's base environment |
| **Preparer** `prepare(start, ctx) → Promise<Prepared>` (main) | P2.5 | `null` | `null` | `null` | `session.create {id, title, model}`, the instruction entry PUT, the MCP added for the folder (D20) | Only OpenCode makes calls before its command |
| **SessionCatalog** (core): `find`, `read(found, prev)`, `watchTargets`, `lastReply`, `details`, `exportMarkdown`, `location`, `trash \| null` | P0.4 | JSONL per file, today's reader | **today's reader, moved unchanged** in P0.4; P3: rewritten-JSONL rules (cmp 1.2) | rollouts by date + `session_index.jsonl` names + `.zst` older than 7 days | rows in `opencode.db`: `location` → `null` | `find` returns `Found { id, locator, folder, cwd? }`; only the agent's own catalog interprets `locator` |
| **UsageSource** (core): `open(paths) → TurnSource { ingest, pending, turnUsage, names, written, turnText, close }` | P1a.6 (Claude's wrapped then) | today's `UsageCache`, its file untouched | P3: the hook log + transcript text | own cache file; `task_started`/`task_complete`, `token_count` | own cache file; rows; cost lines (§2.5) | `UsageHistory.write` takes a `TurnSource`; `runPass` loops the installed agents' sources |
| **StateRules** `detect(title, screen) → RawState` (core, pure) | P0.5 | `detect.ts`'s `claude` | `detect.ts`'s `cursor`; P3: the trust prompt | M16 strings; the composer alone never means idle | screen strings + server events (main) | Pure; each agent's rules have their own fixtures |
| **TurnSignal** (where a turn's end comes from) | P1a.4 (Claude's documented then) | Stop hook in `--settings` → record | P3: `stop` hook (D13) → record | `notify` program (D6) → record | server events in main → record | **One record format and file** (§2.5.1); the producer is the agent's; the consumer is shared |
| **IdBinding** (core), split in two (S4): **`ids`**: `newId() → string \| null`, `isRealId(id)`; **`follow`**: `classify(record, pane) → 'clear' \| 'resume' \| null` | P0.6 | `newId` = UUID; `classify` from the SessionStart record's `source` (`followPaneStart`'s rule moved) | `newId` = `null` (P3: UUID, `--new-session-id`) | `newId` = `null`; `isRealId` = a rollout exists; early bind by the rollout the process holds open (§2.5.2, S5); `/new` → a rollout created after the pane's start = `clear`, else `resume` | UUID; `/new` from the proxy (D14) | Binding by record is shared; what counts as real and which kind of change is the agent's |
| **Waker** `wake(target, text) → Promise<WakeOutcome>` (main) | P0.6 | socket post (`postToSession`) | P3: `followup_message` at `stop`; idle + empty box → end-and-resume; else held (D1) | `codex queue --thread <uuid> --message` | inbox `POST …/prompt {delivery:"queue"}` | The batcher and the frame are shared; the transport is the kit's |
| **Messaging** (core): `native: { tool, reaches(other: AgentId) } \| null` (B2) | P1b.1 | `{ tool: 'SendMessage', reaches: claude }` | `null` | `null` | `null` | D3's `send_message` table is computed from kits: listed to a caller when some installed agent it must reach is not reached by its native tool and has a Waker (S8) |
| **McpMount** (core) + caller | P0.6 (its nullness gates `handleControl`) | `--mcp-config`, `MENKAR_PANE` inherited | P3: per-pane `--plugin-dir` folder `…/<pane>/menkar/.mcp.json` | `-c mcp_servers.menkar.{command,args,env}` with `MENKAR_PANE` in `env` | per folder on Menkar's server (1.141); caller from `_meta["ai.opencode/sessionID"]` through the proxy | The server program reads the caller from `MENKAR_PANE` or from a `_meta` key the descriptors list (`callerMetaKeys`) |
| **Fork** (core): `plan(source, newId) → Start` (B2) | P0.6 | `--resume <src> --fork-session --session-id <id>` | `null` | `null` (38 §7) | `null` (38 §7) | `forkSession` asks it; `null` → no Fork entry (the cap) |
| **Remote** (main): `live(pane) → boolean`, reading Claude's registry (B2) | P0.5 | `remote-live.ts`'s reader, moved to `src/main/agents/claude/remote.ts` | `null` | `null` | `null` | `remote-live.ts` keeps the loop, asks the kit |
| **TeamDelivery** (core + main), the team block's three pieces (`docs/session-control.md`, "The team block"; §2.5.6) | P0.3 | `part` `claude.md`; `skill`/`own` names; `atStart`: the file and the flags (snapshot off on every resume); `heldAtStart`: new and resume → the block, fork → `null`; `afterCompaction` → `started`; `tell` → a post | P3: `sessionStart` hook's `additional_context`; resume → the recorded (persisted) block; idle facts change waits for the next wake (1.159) | `-c developer_instructions`, chaining the user's own; resume → recorded until compaction; compaction from the rollout's `compacted` item (S7) | instruction entry; `tell` updates the entry, no post | Methods, not a `holds` tag (S2); `skill` names a skill (a name; for Codex a `SKILL.md` path, 1.155 Q1) |
| **Namer** (core + main): `atStart(name) → words \| null`, `after(session) → Promise<void> \| null` | P0.3 (`atStart`); P1b.4 (`after`) | `-n` | Menkar-held for workers (D22) | after the first turn, `thread/name/set` (main, D5) | `title` at create | Two methods, not a `kind` (S2) |
| **EnvRules** (core, data) | P0.3 | today's `SESSION_ENV` | `cursor.md` §1.7, marker `CURSOR_AGENT` | `CODEX_THREAD_ID`, … | `opencode.md` §1.7 | `withoutSessionEnv` applies **every** registered agent's rules |
| **ContextSource** (core) | P1a.6 | the statusline (today) | `null` (D8) | `token_count` from the rollout tail | `GET …/context` (main) | `null` is a type the sidebar handles |
| **IntegrationItems** (core + main) | P3.1 | statusline, retention (today, not moved in P0) | D13 hooks, D7 allow entries | none | none | Items greyed when the CLI is not found (1.140) |
| **DeclaredWrites** (core, data) | P1a.1 | `-n` | D7, D13 files | `session_index.jsonl`/`threads.name` (D5), `queue_1.sqlite` rows | `opencode.db` session row, inbox rows | The R9 allow-list per agent (D17) |
| **ChatStrategy** (core + main) | P0.7 | today's variant | today's two | `null` | `null` | Today's `VARIANTS` and `AGENT_CLIS` move into the kits |
| **Classifier** (core + main, §2.17) | P4 | `claude -p` with a model | where feasible | where feasible | where feasible | `null` where the agent cannot classify |

**Codex's late id, OpenCode's server-held sessions, SQLite stores and Cursor's consent-gated hooks
each land on one seam above and none forces a branch in shared code**: the late id on IdBinding,
the server on Preparer + Waker + the main-side TurnSignal, SQLite on SessionCatalog/UsageSource
through `agents/shared`'s read-only open, the consent on IntegrationItems.

### 2.4 Choosing once, and the unknown agent

- **`parseAgentId(value)`** is the one way a saved or received string becomes an `AgentId`;
  unknown → `null`. Used for `last_agent`, `session_agents`, an IPC action's `agent`, a
  `start_session`'s `agent` argument.
- **`session_agents`** (new key of `state.json`, carried by `parseState`'s `rest` as every newer key
  is, `src/core/state.ts:6`): `{ "<session id>": "<agent id>" }` for **every session Menkar starts or
  resumes whose agent is not `DEFAULT_AGENT`** (the registry's `isDefault(id)`, not a comparison in
  shared code — `agent-default`), written **when its pane starts, or when a late id binds**
  (minor). Claude sessions are never written, so a Claude-only user's `state.json` does not change.
  Pruned with the session (trash, delete).
- **Restoring a tab** (B3, 1.155 Q4, 1.159). P0.6 replaces `dropUnknownSessions`' rule: a saved
  pane is **kept** when a reader found its session, **or** `session_agents` names it; else dropped
  as today. Then `resumeSpec`:
  - a reader found it → its agent's resume (today);
  - not found, `session_agents` names an agent **this build knows** → the tab is restored and
    **not started**, one line in its pane through `t()`: "[Menkar] This session was not found: its
    agent (‹label›) may be uninstalled or its files gone." (1.159, B3); the tab and session stay
    saved untouched;
  - not found, `session_agents` names an agent **this build does not know** (`parseAgentId` →
    `null`) → restored and not started, Q4's line: "[Menkar] This session's agent (‹id›) is not
    supported by this version of Menkar."; saved untouched (1.155 Q4);
  - not found and not named → dropped (today: a Claude session whose transcript is gone).
- **New agent values are never read as another agent anywhere**: `agentName` and every `?:` on the
  agent go through `descriptorOf`, which has no default.

### 2.5 The shared mechanisms the strategies feed

1. **Turn-end records.** One format and **one file per pane, `<pane>.json`, overwritten each turn**
   (today's, `turnEndsDir()`, `control.ts:63-82`; S4 keeps it), written by every agent's producer
   through `agents/shared`'s writer: `{ pane, session_id, at }` plus optional `tokens` and
   `last_reply` (read by the agent's UsageSource and catalog, never by shared code). A **parity
   test** between the writer's keys and `control.ts`'s reader.
2. **Binding a late id.** A pane with no session (`Pending`, `join.ts`) binds on the first evidence
   its kit's `isRealId` accepts:
   - **Codex, early (S5; `codex`, 2026-11-16):** the rollout file appears when the session starts,
     before the first turn's end (m), its uuid is the thread id `codex resume` takes (m). On Linux,
     main reads the pane's agent process's open files (`/proc/<pid>/fd`) for a
     `rollout-*-<uuid>.jsonl` under `$CODEX_HOME/sessions/`, about 1 s after start, three tries
     (agent-deck's method, read by `codex`, not measured by us). That ties the id to the pane's own
     process, so two Codex sessions in one folder cannot be confused. Elsewhere, and if it finds
     nothing, the first turn-end record binds (today's plan).
   - **Codex's title thread**: its `notify` carries a thread with no rollout; **the notify program
     writes no record for it** (S4: it checks that the rollout exists before writing), so no other
     code needs to know about it.
   - For a session `start_session` starts (P1b) the pane holds a **provisional id**
     `pending:<pane-id>` as member, child and assignee until bound, re-keyed to the real id through
     the path a `/clear` uses today (`followNewIdInLayout`, the follow functions). **The loss
     window** (S5): Menkar quitting or crashing before the bind — seconds with the early bind on
     Linux, the whole first turn without it — drops the provisional id on load with
     `forgetSession` and a log line: the worker's tab, parent and assignee are lost; its rollout
     stays in Codex's data and shows in Add session. `codex` measures the window (P1a.4).
3. **Waking.** `wakeSession(parent, text)` keeps the batcher, the counts and the frame; it calls
   `pane.kit.waker.wake(...)`. The bridged frame (38 §3.1) is built once in `src/core/control/`.
4. **Caller identity.** `ControlRequest` gains `caller: { pane } | { agentSession: { meta, id } }`;
   main resolves an `agentSession` caller through the OpenCode proxy's map (P2). P1b builds the
   shape; only P2 fills the second branch.
5. **Usage.** `runPass` opens one `TurnSource` per installed agent with a UsageSource and writes
   each into the one history (no schema change, 38 §3.6). **Turn uuids are prefixed by the agent's
   id for every agent but Claude** (`codex:<turn id>`); Claude's rows keep today's bytes. **Each new
   agent's derived cache is its own file** (`usage-cache-<id>.sqlite`). **Exact cost** where an
   agent has it (OpenCode) is appended by its source to a Menkar-owned log in the statusline log's
   format, `usage-<id>.jsonl` in the cache directory, and passed to `buildReport` among
   `statuslineLogs`. Codex's cost is the price table's, marked `~` (D15).
6. **The team block, per agent** (as built: `docs/session-control.md`, "The team block").
   Assembly stays as built (`teamFacts`, `teamBlock`, the part read as data `plugin/team/<part>`);
   **P0.3 moves `TEAM_AGENTS`' Claude entry into Claude's kit** (`kit.team`, whose `part`, `skill`,
   `own` are today's `TeamAgent`), and `teamAgent(agent)` becomes `kitOf(agent).team` (`null` → no block).
   The **`started`/`held`** rule (`teamPost(held, current)`, that doc's "Keeping a running session
   current") stays agent-neutral; what differs per agent is that doc's **three pieces kept apart**,
   as `TeamDelivery` methods:
   - **(1) what a start holds** — `heldAtStart(start, block, recorded) → string | null`: Claude:
     new and resume → the block (resume with `--system-prompt-snapshot off`, on **every** mode-on
     resume, since a later resume without it reverts to the conversation's first block, research
     §7), fork → `null`; Codex and Cursor: new → the block, resume → `recorded` (they keep the block
     recorded at creation); OpenCode: always the block (server-held). `afterCompaction(started,
     current)` → Claude: `started`; Codex: `current` if its instructions re-render at compaction,
     else `started` (`codex` to confirm in P1b.5).
   - **(2) how a start delivers** — `atStart(start, block) → LaunchPlan` part: Claude: the file and
     its flags, below its floor nothing (1.157 Q4; the floor read by the kit's
     `versionFloor`, 2.1.267); Codex: `-c developer_instructions` (§2.8); Cursor (P3): the
     `sessionStart` hook's `additional_context`; OpenCode: the instruction entry (Preparer).
   - **(3) how a change is told** — `tell(pane, text) → Promise<'posted' \| 'no session' \|
     'held' \| 'failed'>` (main): Claude: `postToSession`; Codex: its Waker; OpenCode: the entry
     PUT, so the session holds the current block with no turn; Cursor: held until the next wake
     when idle (1.159, S7), answered as `followup_message` at the next `stop`.
   - **`recorded`** (Codex, Cursor) is a persisted `held` per session
     (`controlPaths().teamHeld/<session>.txt`, in the flavour's cache, written whole, swept with the
     session), read by `heldAtStart` on a resume. **The compaction signal** that resets `held` to
     `afterCompaction(…)`: Claude's SessionStart `compact` record (as built); Codex's rollout
     `compacted` item (`codex.md:278`), read by its catalog's tail watch and handed to main as a
     record (S7); Cursor's (P3, from `cursor`); OpenCode needs none.
   - The team posts' consequences (the settle, no parent wake and the `last_reply` skip by
     `onlyTeamUpdates`, `held` only on delivery) are shared and hold for every agent whose `tell`
     posts.
7. **Environment.** `withoutSessionEnv` takes the union of every kit's `EnvRules` (identity always
   stripped; marker-gated variables only when that agent's marker is inherited, 38 §3.5), and
   strips an inherited `MENKAR_FLAVOR` (§2.12).

### 2.6 The readers

- **Incremental reading per agent** is the catalog's and the usage source's own business, behind
  `read(found, prev)` / `ingest()`:
  - **Claude**: today's (offsets, slices of 4 MB, head and tail windows).
  - **Cursor**: **P0.4 moves today's reader unchanged** (S6: no behaviour change in P0). P3.2 adds
    the rewritten-transcript rules (cmp 1.2): state keyed by size and mtime, head and tail windows
    re-read on any change, no offset trusted; its own contract fixture (a transcript rewritten
    between two reads). Cursor's Usage (P3.3) reads no transcript bytes by offset: its turns come
    from the hook log (Menkar's own, append-only).
  - **Codex**: a rollout is append-only while live and compressed to `.zst` after 7 days. A `.zst`
    that replaces an ingested `.jsonl` (same thread id) is **recognised by the thread id and not
    re-ingested**. A `.zst` never seen is read **streaming** (`createZstdDecompress`, async, in the
    usage worker — never whole in main, S6); the catalog reads only its head (`session_meta`, the
    first user message) and stops the stream there. The classifier's `turnText` for a compressed
    rollout streams to the turn's extent.
  - **OpenCode**: rows, read by `time_updated` greater than the last one seen.
- **SQLite read-only, without writing beside the agent's database**: `agents/shared`'s
  `openAgentDb(path)` opens `file:<path>?immutable=1` read-only when **neither** `<path>-wal` nor
  `<path>-shm` exists (no writer); a plain read-only open when **both** exist (a writer is live);
  **with a `-wal` and no `-shm`** (a writer that crashed, S6) it opens nothing and returns
  `'unreadable for now'`, logged once — opening would create the `-shm` beside the agent's
  database, and a stale `-wal` read with `immutable=1` misses its frames. Closed at once after the
  query; never held open across passes. R9's test asserts the sidecars' listing in all three
  states.
- **Large and growing**: no reader holds a whole JSONL; Codex's `.zst` is streamed.
- **Cursor's prompt text in Menkar's hook log** (S6, 1.159) is a new copy of the user's prompts at
  rest: it is kept **only while the classifier is on** for Cursor's turns (§2.17); with it off, the
  hook writes the turn's times and tokens and no text, and turning the classifier off removes the
  text already kept at the next pass.

### 2.7 OpenCode's server and proxy (P2)

- **Started** with the first OpenCode tab as `opencode serve --stdio --port <random free port>`,
  `OPENCODE_PASSWORD` and `OPENCODE_CONFIG_CONTENT` in its env, **its stdin held by main**: it exits
  when its stdin closes, so a Menkar crash leaves no orphan (`opencode`, 2026-11-15, m), and in
  stdio mode it removes the password from what its MCP servers inherit. Stopped by PID with the last
  OpenCode tab and on quit.
- **`OPENCODE_CONFIG_CONTENT` holds** (S12) only what Menkar's sessions need on its own server,
  merged by OpenCode over the user's config: the server's `permission` defaults left as the user's,
  the skills paths (the stored skills, 1.152), and nothing else at start. Menkar's MCP is **not** in
  it: it is added per folder through the API when the first session there enters a mode-on project
  (1.141), so a session of a mode-off project sends exactly the request it sends today (a test
  against the stand-in: a mode-off session's `tools` array and system text equal those of a server
  started with no `OPENCODE_CONFIG_CONTENT`).
- **Version check by feature**: `GET /openapi.json` lists the experimental instruction route **and
  the experimental per-folder MCP route** (S12); without the first, the team block is not
  delivered; without the second, Menkar's MCP is not mounted (OpenCode sessions then cannot use the
  orchestration's tools, and the first-time card says so); a log line says why (`/api/info`'s
  version only for the log).
- **The proxy**: one loopback port per OpenCode pane, forwarding to the server, adding no
  credential; it reads `POST /api/session/<id>/view` and `…/prompt` to know the pane's session
  (D14), and gives main the `{ id → pane }` map for the caller (§2.5.4).
- **A restart of the server with TUIs attached** (it died): main restarts it on the same port;
  the TUIs reconnect or show their own error; a test asserts main restarts it once and logs, and
  does not loop (one retry per 30 s).

### 2.8 Reading `~/.codex/config.toml` (D6, the team block's chaining)

Menkar reads the user's `notify` (an array of strings) and `developer_instructions` (a string,
possibly multi-line) from `$CODEX_HOME/config.toml` (default `~/.codex`), honouring a top-level
`profile = "<p>"` whose `[profiles.<p>]` table overrides them. **`smol-toml` (pinned,
BSD-3-Clause, no dependencies)** parses it: the new runtime dependency, justified because a wrong
parse of the user's file means chaining a wrong command or dropping their own instructions
silently. Read only; a file that does not parse → no chaining and a log line, never a refused
start. **What Menkar passes goes through `LaunchPlan.files`** (minor): the joined
`developer_instructions` (Menkar's block, then the user's own) and the user's `notify` argv are
written to files under the pane's folder and named on the command line by path, never inlined into
`-c` (quoting a multi-line string into a TOML value on a shell line is the error to avoid).

### 2.9 Programs shipped

- **Codex's `notify`**: `-c notify=["<electron>","<resources>/codex-notify.cjs","--pane","<pane>","--chain-file","<file of the user's notify>"]`
  with `ELECTRON_RUN_AS_NODE=1` in Codex's environment for it — it writes the turn-end record
  (only for a thread whose rollout exists, §2.5.2), then runs the user's own `notify` with the same
  argument Codex gave, waiting at most `CHAINED_TIMEOUT_MS` (as the statusline chains,
  `src/core/context/statusline.ts:20`).
- **Cursor's hooks** (P3): one program for `beforeSubmitPrompt`, `stop`, `afterAgentResponse`,
  `sessionStart`; it exits at once without `MENKAR_PANE` (1.140) and acts only on panes of its own
  flavour (§2.12); it writes turn records and the tokens to Menkar's hook log, the prompt text only
  while the classifier is on (§2.6), **never `user_email`** (D21); for `stop`, it answers a held
  wake as `followup_message`, and **never waits**: with no held wake it exits at once (minor).
- Both are `electron.vite.config.ts` entries and `scripts/check-package.mjs` requires them in the
  .deb (`docs/packaging.md`), and the team parts `plugin/team/{codex,cursor,opencode}.md` as each
  phase adds them (S7).

### 2.10 Tests

- **R10, the byte snapshot (38 §2)**, P0.1, **taken on `main` with the team block whole and before
  the branch exists** (B4), in `tests/core/r10.test.ts` with file snapshots under `tests/core/r10/`:
  - `buildCommand` for Claude: new (with id, name, model, remote, prompt file, add-dir), resume
    (with remote), fork; each with the mode off and with a team file (the snapshot flag on
    resume); Cursor new and resume (in `tests/core/r10/cursor-*` files);
  - the `--settings` file's bytes;
  - `initialize`'s and `tools/list`'s replies from `answer`;
  - what a Claude session is given of the plugin: `plugin/skills/**`, `plugin/guide/**` and
    `plugin/team/{common,claude}.md` (list and bytes);
  - the team block for a fixed `TeamInput` set (each variant `tests/core/team/block.test.ts`
    covers) and its post texts;
  - `wakeFrame`'s bytes for a fixed text, id and counts; `WAKE_DELAY_MS`;
  - `withoutSessionEnv` on a fixed environment holding every listed variable and a few of the
    user's;
  - `watchedDirs` and the scanned roots with only Claude installed, and with Claude and Cursor;
  - the usage cache directory's file list after a pass with only Claude installed.

  And **`e2e/r10.spec.ts`** (S9), with the stand-ins:
  - **`startPaneHeld`'s assembly**, from the stand-ins' recorded argv and environment
    (`claude-args.txt`, `claude-env.json`, `e2e/fixtures.ts:27-29`, and Cursor's stand-in doing the
    same): new, resume, fork, Remote Control, for Claude; new and resume for Cursor; each with the
    mode off and on. The environment is compared with the variables that vary per run (the pane's
    id, the temporary home) replaced by placeholders;
  - with the stand-in `claude` alone on the PATH, the app's descendant processes (by `/proc`) are
    the expected set and **no socket of the app's processes listens** (`/proc/net/tcp*` against the
    processes' inodes).

  **R10 is guarded byte for byte** (B4): `scripts/ci.mjs` gains a step, "R10 unchanged", that
  compares every file under `tests/core/r10/` with `git show main:<path>` and fails on a
  difference **or a missing file**, except `tests/core/r10/cursor-*` after P3.2 (§4). It runs on the
  branch only (on `main` it compares with itself). And `npm run ci` runs Vitest with `CI=1`, under
  which Vitest writes no new snapshot and fails on a missing one instead (the executor checks this
  on Vitest's version in the tree and records it in `docs/toolchain.md`).
  R10's Cursor rows guard P0–P2 only (38 §2): P3.2 rewrites those files' contents with `set`'s
  sign-off; a later merge of `main` keeps the branch's Cursor files.
- **Contract tests per concern, run over every registered agent** (`tests/core/agents/contract/`):
  each agent's fixtures in `tests/data/agents/<id>/` and one `expected.json`; the catalog, usage
  source and state rules of every agent are asserted against it — the parity tests per reader.
  Plus the **descriptor ⇔ kit parity** of §2.1.
- **R9's no-write test** (38 §2), one per agent, from `DeclaredWrites`: every file under the agent's
  home keeps its bytes and mtime and the tree its listing, except the declared paths; for SQLite
  agents in §2.6's three states (no writer, a live writer, a crashed writer's `-wal`), asserting the
  sidecars' listing (S6).
- **Stand-ins per agent** (`e2e/standins/<id>.ts`): `codex` (rollouts, `session_index.jsonl`, the
  `-c notify` command, `codex queue`, its arguments, a held-open rollout for the `/proc` bind);
  `opencode` (a small HTTP server: session create, view, prompt with `delivery: queue`, the
  instruction route, the MCP route, `/openapi.json`, events; a TUI mode); `cursor-agent` (P3: fires
  the plugin's hooks, writes a rewritten transcript, records argv and environment from P0.1 on).
- **The real-agent checks**, before a phase merges or is called validated: each consultant runs the
  branch's build against the real CLI **in a throwaway home** and reports by name; a task on the
  Board each (1.148).

### 2.11 P0 without rewriting a test

`check-test-integrity` refuses any removed `expect(` line, with no override. So **P0 keeps every
function the existing tests call, with its signature and its parameter and return types**, as a
thin facade over the registry (`buildCommand(agent, start, options)` → `kitOf(agent).launch.plan(…)`
joined into today's string; `readHead(head, agent)`, `badgeOf(tail, agent, …)`,
`detectState(provider, …)` the same). Where a moved type gains members (`Roots`, `Installed` as
maps by `AgentId`), the facade's parameter type stays today's shape (or a `Partial` of the new
one), so `tests/core/sessions/discover.test.ts:25,36,60` and `service.test.ts:42-46`, which build
those objects literally, compile and pass untouched (S10). A facade names no agent: it looks the kit
up by the value it was given. New tests for the moved code are added beside the agent's folder.
Where a facade would be wrong (a test asserts the old shape on purpose), the block stops and asks
`set`.

### 2.12 The branch, its worktree, and the sandbox (1.136, 1.155 Q3, 1.157 P1, 1.158, 1.159)

**Before the branch exists, on `main`** (B4; **1.160**: right after the team block and the .deb for
the human's other project):
- **P0.1** — R10's snapshot and the CI guard (§2.10), the test baseline (below) — committed on
  `main` by `set`.
- **P0.2** — ids, descriptors, the registries' skeleton and the rules with `ALLOWED` seeded (1.160):
  from then on no new name check can enter `main` while the branch lives (a new one fails the
  count). Nothing runs differently: types, data and a check.
- Then `set` creates the branch from that `main`.

**The branch.**
- **Branch `multi-agent`, worktree `/home/hernan/git/menkar-multi-agent`**, created by `set`
  (1.136). Nobody checks out another branch in the shared tree.
- **Its own `node_modules`** (`npm ci`, which runs the Electron rebuild of `node-pty`), its own
  `out/`, `release/` and `test-results/`. `ui-check` runs on its own displays per worker; **they
  share the machine's CPU**: a session does not start a full `ui-check` in one tree while one runs
  in the other (it asks `set`).
- **The test-integrity baseline** (B4): `scripts/check-test-integrity.mjs`'s default becomes
  `git merge-base main HEAD` (on `main` that is `HEAD`, today's behaviour). A branch that merged
  `main` then compares with the last merge, so a test line `main` removed and the merge brought in
  is not reported, and a line the branch removes always is. An explicit `MENKAR_TEST_BASELINE`
  wins. A test in `tests/scripts/` asserts both.
- **Fixes flow in, never out**: a fix lands on `main` (and ships), and `set` merges `main` into
  `multi-agent`. **R10's snapshot is only ever written on `main`**; the branch's CI step compares
  with it (§2.10).
- **P0 merges into `main`** at P0.8 (1.142), with its .deb; the branch continues from there.
- **Workers**: the branch's share of the project's cap of 3 (1.153) is `set`'s to give per block;
  never two on one file (§2.13).

**The sandbox** (1.155 Q3, 1.158). The human works on `main`'s Menkar every day; the branch's build
must not be able to touch it. So the branch is built in a second **flavour**, installed **beside**
`menkar` as its own package, and it **duplicates everything it needs to run on its own** (1.158).

- **One build-time constant** (`src/core/flavor.ts`, from a Vite `define`). **Its default comes
  from the branch, never silently `menkar` off `main`** (S11): `electron.vite.config.ts` reads
  `MENKAR_FLAVOR_BUILD` if set, else `menkar` when `git rev-parse --abbrev-ref HEAD` is `main`,
  else `sandbox` — so a .deb built in the worktree can never be a `menkar` package by mistake; a
  test of the config's resolver asserts the three cases. It gives:
  - the state directories' name (`menkar-sandbox` under `$XDG_CONFIG_HOME`, `$XDG_CACHE_HOME`,
    `$XDG_DATA_HOME`: `src/core/paths.ts`'s `APP`) — so its own `state.json`, `projects.json`,
    topics, tasks, control and wake files, turn-end and session-start records, statusline log, usage
    history and caches, classifier data, prompts and team files;
  - the files folder (`~/Menkar-sandbox`, `filesRoot`), the CLI's name (`menkar-sandbox`), the
    window title and About ("Menkar Sandbox", through `t()`);
  - **the single-instance lock**, keyed on Electron's user data under the cache directory
    (`electronUserData`, `src/main/index.ts:92`), so it is the flavour's own with no further code;
  - the statusline, MCP server and hook programs built with the same constant, **shipped in the
    sandbox's own package** (`/opt/Menkar-sandbox/resources/…`) with its own plugin copy, so each
    writes into its own flavour's directories;
  - its own `opencode serve` (§2.7: per Menkar process, its own random ports and password).

  **With the constant `menkar`, every output is today's** (R10 holds on `main`).
- **Panes carry the flavour** (S11): a pane of the sandbox carries `MENKAR_FLAVOR=sandbox`; a pane
  of `menkar` carries none, and **both strip an inherited `MENKAR_FLAVOR`** before setting their own
  (§2.5.7), so a sandbox started from a daily pane, or the reverse, never passes the wrong flavour
  on. Hook programs act only on panes of their own flavour.
- **The package** `menkar-sandbox`, from a second config, `electron-builder.sandbox.yml` (`extends:
  ./electron-builder.yml`). `packager` read app-builder-lib's templates (2026-11-15): the
  post-install, post-remove and AppArmor templates follow `executableName` and the sanitized product
  name, so `/opt/Menkar-sandbox/menkar-sandbox`, `/usr/bin/menkar-sandbox`, the alternatives name,
  `/etc/apparmor.d/menkar-sandbox` and the icon's file are disjoint from `menkar`'s, and each
  post-remove unloads only its own profile. **Four names do not follow and are set explicitly**,
  each a P0.0 test on the built package's metadata: `deb.packageName: menkar-sandbox` (without it
  apt installs the sandbox **as an upgrade replacing the human's Menkar**);
  `extraMetadata.desktopName: menkar-sandbox.desktop`; its own `artifactName`; its own `appId`.
  `scripts/package.mjs` and `scripts/check-package.mjs` take the flavour as an argument (both
  hard-code `/opt/Menkar` today). **The second AppArmor profile and `/usr/bin/menkar-sandbox` are
  installed outside `/opt/Menkar`, as the human allowed (1.157 P1)**; `docs/packaging.md` records it
  (P0.0).
- **What is still shared, because the sandbox cannot own it, and how each stays safe** (1.158, B1):

  | Shared | Risk | How it stays safe |
  |---|---|---|
  | **The agents' own data** (`~/.claude/projects`, `~/.cursor/projects`, `~/.codex`, OpenCode's database): the sessions the sandbox starts are real sessions the agents write there | The sandbox scans the same folders, so it could resume a session live in a daily tab, trash or delete its transcript, or add it to a project (B1) | **1.159:** the sandbox **refuses resume, add, trash and delete for a session it did not start**. It keeps the ids it started (or that bound in its panes) in its own `state.json`, `started_sessions`; Add session lists only those; the row menu's Resume, Trash, Delete and "Add to project" are absent for any other (a sandbox-only branch of the flavour, not of the agent: `flavor.ownsOnly`). A test in P0.0: a session found but not started → each action refused, and no file under the agent's home changes. `main` lists the sandbox's Claude and Cursor sessions in Add session and counts their tokens as unfiled (real use); it never adds them by itself |
  | **Claude Code's messaging registry** (`~/.claude/sessions/*.json`, the `cc-socks` sockets) | Workers named `<project>-t<N>` in the sandbox and in `main` could collide, so a `SendMessage` by name could land in a daily session (B1) | **1.159:** sandbox projects take **names no daily project has** — a hand check (P0.8's checklist: name each sandbox project with a `sandbox-` prefix); wakes go by session id, so neither flavour wakes the other's |
  | **`~/.claude/settings.json`** (`main`'s statusline integration) | Only one `statusLine` fits; Menkar's statusline chains the user's, which would be `main`'s, logging the sandbox's sessions into `main`'s `usage.jsonl` | **A flavour never chains to a Menkar statusline** of any flavour (recognised by its program's file name under a Menkar resources folder; P0.0's test). **The sandbox does not offer the items that write `~/.claude/settings.json`** (statusline, retention): its integrations page shows them read only, "managed by Menkar". Sessions it starts get its own statusline through `--settings` |
  | **Cursor's global files** (P3, `~/.cursor/hooks.json`, `cli-config.json`) | The sandbox's hook entries beside `main`'s; **uninstalling the sandbox leaves its entries naming a deleted program** (S11) | Entries name the flavour's own program and act only on its panes (§2.9). Before uninstalling, the sandbox's integrations page removes its items ("Remove before uninstalling" in its checklist section); `cursor` confirms in P3.1 what Cursor does with a hook whose program is missing (it must not block the agent), and the answer goes to `docs/packaging.md` |
  | **The agents' logins** | None written: the CLIs read their own | Menkar never reads or copies them |
  | **The classifier's account use** | The sandbox would run `claude -p` on the human's account for test traffic | **1.159, S11:** the classifier is **off in the sandbox** and its setting hidden; a hand check |
  | **The machine's CPU** | `ui-check` in both trees | §2.12, the branch: one full run at a time |

- **So 38 §3.6's state compatibility is relaxed for the sandbox** (it never reads `main`'s state);
  P0's tolerance (§2.4) is kept on `main` anyway, and §2.5's choices (own cache files, prefixed
  uuids, no history schema change) stay.
- **Hand checks**: each phase adds its section to `docs/release-checklist.md` (P0.8, P1a.7,
  P1b.6, P2.7, P3.5): what the human does in the sandbox — its own Menkar state, starting empty,
  over their real agents and accounts — and what passes. Only P0.8 is also checked on their own
  Menkar, since P0 is the one phase that ships to `main`.
- **Installing the sandbox for P0.0's check** is `packager`'s, in a container (minor): `packager`
  builds both .debs and runs the install in a throwaway container it starts and stops by id; the
  human's machine gets the sandbox only at P0.8 (`docs/packaging.md`, "The sandbox package").

### 2.13 Who executes what

- **Per-task workers** started by `set` in the worktree (`menkar-t<N>`, 1.118), within the
  project's cap of 3 (1.153), **never two on one file**: each block lists the files it owns; blocks
  that share one are sequential (§5's tables).
- **Consultants**, asked by name with short questions while a block runs, and given a task for each
  phase's real-agent check: `claude-cli` (P0, P1b's re-listing stub, every phase's Claude rows),
  `cursor` (P0, P3), `codex` (P1a, P1b), `opencode` (P2). `packager` builds the sandbox .deb for each
  phase's hand check, and `main`'s .deb for P0.8.
- **`set`** reviews each block, commits on the branch, merges P0 into `main`, merges `main` into
  the branch, and runs the gates with the human.

### 2.14 Decisions taken by the human for this plan

- **1.155 (2026-11-15):**
  - **Q1** — A Codex session loads a skill by **reading its `SKILL.md`**; the team block names each
    skill by absolute path through `kit.team.skill` (Menkar's from the plugin folder, the stored
    ones from `FoundSkill.place`, `listSkills`, `src/core/team/skills.ts`). → P1b.5.
  - **Q2** — The first-time card shows an **agent choice only when two or more agents are
    installed**, defaulting to `last_agent`; its place by mock-up in P1b.6. "Ask an agent" starts the
    focused agent pane's agent, else `last_agent`. → P1b.6.
  - **Q3** — The branch's build is tried in a **sandbox** (§2.12). → P0.0 and every hand check.
  - **Q4** — `main` restores a saved tab of an agent it does not know **without starting it** (§2.4).
    → P0.6.
- **1.157 P1** — the sandbox installs a second AppArmor profile and `/usr/bin/menkar-sandbox`
  outside `/opt/Menkar`, under its own package name. → P0.0.
- **1.158** — the sandbox duplicates everything it needs; only what it cannot own is shared, each
  with its safety (§2.12's table). → P0.0, P2.2.
- **1.159** — B1 (the sandbox refuses others' sessions; distinct project names), B3 (a known agent's
  session not found keeps its tab, one line), S6 (Cursor's prompt text only while the classifier is
  on), S7 (an idle Cursor's facts change waits for the next wake), S11 (the classifier off in the
  sandbox); **the classifier configurable per agent** (§2.17).
- **1.160** — P0.1 and P0.2 on `main` right after the team block and the .deb for the human's other
  project, before the branch (§2.12).
- **1.161** — the classifier per agent is one block after P3 (P4), with all four agents in view;
  until then only `claude -p` classifies (§2.17).

### 2.15 Decisions the code must hold, and their tests

| Decision | Test (written before the code, its comment naming the decision) |
|---|---|
| 1.135: no agent named in shared code | `tests/scripts/check-code-rules.test.ts`: `if (a === 'cursor')` in `src/main/x.ts` → `agent-literal`; `AGENT_COMMANDS.codex` → `agent-property`; `const claudeArgs` → `agent-identifier`; `x === DEFAULT_AGENT` → `agent-default`; `import … from '../agents/cursor/catalog'` in `src/core/agents/claude/` → `agent-import`; `import … registry` in `src/renderer/` → `descriptors-node-free`; the same lines inside the agent's folder → nothing; a file one hit above its `ALLOWED` count → fails |
| 1.135: a change to one agent cannot break another | `tsc` (the registries are `Record<AgentId, …>`) and the contract suite: `vitest tests/core/agents/contract -t codex` runs Codex alone |
| §2.1: caps mirror kits | `tests/core/agents/parity.test.ts`: for each registered agent, each cap ⇔ its concern's nullness |
| R10 (38 §2) | `tests/core/r10.test.ts`, `e2e/r10.spec.ts`, and CI's "R10 unchanged" step (§2.10) |
| B4: the baseline | `tests/scripts/check-test-integrity.test.ts`: default = `git merge-base main HEAD`; explicit value wins |
| 38 §3.6 / D16: an unknown agent is never read as another | `tests/core/agents/ids.test.ts`: `parseAgentId('gemini')` → `null`; `resumeSpec` with `session_agents = { s1: 'gemini' }` → no command, Q4's line; nothing recorded and no reader → dropped (today) |
| B3, 1.159: a known agent's session not found keeps its tab | P0.6's unit test of the keep rule and its e2e: `session_agents = { s1: 'cursor' }`, no transcript → tab kept, one line, nothing started, saved untouched |
| §2.4: a Claude-only user's `state.json` does not change | P0.6's test: start and resume a Claude session → `session_agents` absent from the written file |
| R9 / D17 | the per-agent no-write tests (§2.10), allow-list from `DeclaredWrites` |
| §2.6: no sidecar created beside an agent's database | `tests/core/agents/shared/db.test.ts`: the three states; listing unchanged in each |
| §2.5.5: Claude's usage cache and history bytes unchanged | R10's cache listing; `usage` tests unchanged; a Codex turn's uuid is `codex:<id>` |
| D21: `user_email` never stored | P3.3's hook test |
| S6, 1.159: Cursor's prompt text only while the classifier is on | P3.3: classifier off → the hook log has no text; turned off → removed at the next pass |
| D3, S8: when `send_message` and `agent` are listed | P1b.1's `tools/list` snapshots for {claude} (R10's bytes), {claude, cursor} before P3.4 (no `send_message`: Cursor has no Waker until then), {claude, codex} |
| 1.155 Q3, 1.158: the sandbox cannot touch the human's Menkar | P0.0's tests: disjoint directories, files folder and package paths; `Package: menkar-sandbox`; no chaining to a Menkar statusline; no `~/.claude/settings.json` item offered; the flavour resolver's three cases; `MENKAR_FLAVOR` stripped and set |
| 1.159 B1: the sandbox refuses others' sessions | P0.0's test: a session found but not in `started_sessions` → resume, add, trash, delete refused; the agent's home unchanged |
| D6: the user's `notify` chained | P1a.4: a fixture `config.toml` with `notify = ["x"]` → the program runs `x` with Codex's argument; with a profile override → the profile's |
| 1.159, 1.161: the classifier configurable per agent, after P3 | P4.1's tests |

### 2.16 Where each review finding went (task 29 → task 34)

| Finding | Where |
|---|---|
| B1 the sandbox reaches the daily sessions | §2.12's table (1.159): `started_sessions`, refusals, distinct names; §2.15 |
| B2 missing concerns, disguised name checks | §2.3: Fork, Remote, Messaging; §2.2: `agent-default` |
| B3 the tolerance never runs | §2.4: P0.6 replaces `dropUnknownSessions`' rule; known-agent-not-found per 1.159 |
| B4 holes at the merge gate | §2.12: P0.1 on `main` before the branch, baseline = merge base; §2.10: CI's byte guard, `CI=1` |
| S1 the source rule | §2.2: counts per file and rule, permanent exceptions named, `agent-identifier`, the moves |
| S2 interfaces per phase; discriminants | §2.3's "First in"; `TeamDelivery`, `Namer`, descriptor as methods/data; §2.1's parity |
| S3 Node-free descriptors | §2.2: `descriptors.ts`, `descriptors-node-free` |
| S4 IdBinding split; title thread; record keys | §2.3 (`ids`/`follow`); §2.5.1, §2.5.2, §2.9 |
| S5 the provisional window | §2.5.2: early bind by `/proc/<pid>/fd` (`codex`, 2026-11-16), the loss stated, measured in P1a.4 |
| S6 readers | §2.6: Cursor's reader moved unchanged; zstd streamed; `openAgentDb`'s third state; R9's sidecars; prompt text per 1.159 |
| S7 team block per agent | §2.5.6: compaction signals, Cursor idle waits (1.159); §2.9: team parts in the package |
| S8 D3's trigger | §2.3 Messaging; §2.15's snapshots |
| S9 R10 and `startPaneHeld` | §2.10: the assembly e2e; P0.2 on `main` (1.160) |
| S10 facade types | §2.11 |
| S11 sandbox details | §2.12: flavour from the branch, `MENKAR_FLAVOR`, classifier off, Cursor's leftovers |
| S12 OpenCode's config | §2.7 |
| Minors | P1a.2 screenshot (glyph); P2.2/P2.7 e2e ownership; P2.4 creates the kit's `index.ts`; P1b.1's fallback; P0.0's container (§2.12); the packaging rule (1.157 P1); the branch cap (§2.12); P3.4's `stop` never waits (§2.9); `LaunchPlan.files` for Codex (§2.8); `session_agents` at bind (§2.4) |
| Team block alignment | Header; §2.5.6 (`started`/`held`, the three pieces, `TEAM_AGENTS` into kits, floor 2.1.267, snapshot off on every resume); §2.10 (the block in R10); P0.3 |

### 2.17 The classifier per agent (1.159, 1.161)

- **Today:** `claude -p` with Haiku classifies every turn; D19 classifies non-Claude turns only when
  `claude` is installed. **1.159** makes it configurable per agent: a user without Claude Code, or
  preferring another agent, chooses which agent and model classify, where feasible.
- **The concern:** `Classifier` in each kit, `null` where the agent cannot run a one-shot prompt
  with a chosen model and return its text:
  `run(prompt, model, cwd) → Promise<string>` (main), `models() → readonly string[]` (the ones
  offered, data). Claude's is today's `claude -p` (moved in P0.7, `kitOf(CLASSIFIER_AGENT)` until
  P4). Candidates (each agent's consultant confirms in the block): Codex `codex exec -m`,
  OpenCode `opencode run -m`, Cursor `cursor-agent -p --model`.
- **The setting**: "Classify turns with ‹agent› · ‹model›", offered among the installed agents whose
  `Classifier` is not `null`; default Claude with Haiku when installed (today), else the first
  installed one that can, else off. **Its place in Settings is the human's, from a mock-up** in the
  block. `CLASSIFIER_AGENT` is replaced by the setting, and the `agent-default` rule's mention of it
  goes.
- **Where (1.161):** one block, **P4**, after P3, with the four agents in view. **Until then only
  `claude -p` classifies**, as D19 says: non-Claude turns only when `claude` is installed, else
  unclassified and said in the Usage window. No phase before P4 adds a `Classifier`.
- **The sandbox:** the setting is hidden and the classifier off (1.159, S11).
- **D19's text** in `docs/classifier.md` and plan 38 is amended (old text to its history).
- **Evaluation:** `npm run classify:eval` (the existing one) runs per agent and model chosen; a
  model is offered only after its accuracy is recorded in `docs/classifier.md` (the human sees the
  number before choosing).

---

## 3. Out of scope

- Plan 38 §7 as decided: Windows and macOS for the new agents, remote mode but Claude's, fork and
  chat tabs for Codex and OpenCode, Cursor's status line (D8), trash and delete for Codex and
  OpenCode (D18).
- Typing into any terminal (D1's plan B for Cursor stays deferred).
- A history schema change, a renamed `names.claude` column (the TS property is renamed, the column
  is not).
- Loading agents dynamically; more than the four agents; Pi, Gemini, Antigravity (1.133).
- `AGENTS.md`'s D17 rewording and `docs/agents.md`'s integration text are written by the phases as
  plan 38's exit says; this plan adds only the architecture section.
- The team block's delivery, posts and "Configure role…": built on `main` before P0.1 (`dd28a29`).

## 4. Do not touch

- R10's snapshot files, from the branch: written only on `main` (§2.12), except P3.2's Cursor files.
- Any existing test line holding `expect(` (§2.11).
- The user's `~/.claude`, `~/.codex`, `~/.cursor`, `~/.config/opencode`, `~/.local/share/opencode`,
  except the consented items and D17's declared writes; the human's own Menkar, config and sessions
  (tests use temporary homes; the consultants use throwaway homes).
- `HISTORY_VERSION`, the history's tables, Claude's `usage-cache` schema and file.
- `wakeFrame`'s format, `WAKE_DELAY_MS`, the counts tail; the team block's text and post texts.
- `main`'s tree from the branch's sessions: they work in the worktree only.

---

## 5. Execution blocks

Each block: tests first (each naming its decision), the build, then **Verify** — `npm run ci` in the
worktree at least (on `main` for P0.1 and P0.2), `npm run ui-check` where it says so, and one
injected defect seen failing for each new check. A block that changes the UI declares its
screenshots. **Every block that lowers `ALLOWED` counts edits `scripts/check-code-rules.mjs`**, so
P0's blocks run in turn.

### P0 — Claude and Cursor behind the kits, no behaviour change (merged into `main`)

| Block | Files it owns | After |
|---|---|---|
| P0.1 (on `main`) | `tests/core/r10.test.ts`, `tests/core/r10/**`, `e2e/r10.spec.ts`, `e2e/fixtures.ts` (the Cursor stand-in records argv and env), `scripts/ci.mjs` (the R10 step, `CI=1`), `scripts/check-test-integrity.mjs` (the merge-base default), `tests/scripts/check-test-integrity.test.ts`, `docs/toolchain.md` | The team block whole on `main` and the .deb for the human's other project (1.160) |
| P0.2 (on `main`, 1.160) | `src/core/agents/{ids,types,descriptors,registry}.ts`, `src/core/agents/{claude,cursor}/{descriptor,index}.ts`, `src/main/agents/registry.ts`, `src/main/agents/{claude,cursor}/index.ts`, `scripts/check-code-rules.mjs`, `tests/scripts/check-code-rules.test.ts`, `tests/core/agents/{ids,parity}.test.ts`, `docs/toolchain.md` (the rules' rows) | P0.1 |
| P0.0 (branch) | `src/core/flavor.ts` (new), `src/core/paths.ts`, `electron.vite.config.ts` (the define and its resolver), `electron-builder.sandbox.yml` (new), `scripts/package.mjs`, `scripts/check-package.mjs`, `tests/data/package/**` (sandbox variant), `src/core/context/settings.ts` (`chainedCommand`), the integrations page's offer, `src/core/sessionenv.ts` (`MENKAR_FLAVOR`), `src/core/state.ts` (`started_sessions`), the sandbox's refusals in `src/main/workspace.ts`, `src/core/i18n/{en,es}.ts` (the title, the refusals), `docs/packaging.md`, `tests/core/flavor.test.ts` | P0.2, the branch created |
| P0.3 | `src/core/command.ts` (facade), `src/core/agents/{claude,cursor}/{launch,mcp,team,env}.ts`, `src/core/sessionenv.ts` (facade over the union), `src/core/team/block.ts` (`TEAM_AGENTS` → the kits; `teamAgent` → `kitOf(…).team`), the team delivery code in main (`src/main/team.ts`), `src/main/workspace.ts` (`startPaneHeld` only), `tests/core/agents/{claude,cursor}/launch.test.ts`, `docs/session-control.md` ("Per agent"), `src/core/team/version.ts` (`claudeVersion`) | P0.0 |
| P0.4 | `src/core/sessions/**` (facades), `src/core/agents/{claude,cursor}/catalog.ts`, `src/core/agents/shared/jsonl.ts`, `src/main/workspace.ts` (details, export, lastReply, location, trash), `tests/core/agents/contract/catalog.test.ts`, `tests/data/agents/{claude,cursor}/**`, `src/core/paths.ts`, `src/main/sessions.ts`, `src/core/usage/pass.ts` (the roots) | P0.3 |
| P0.5 | `src/core/agentstate/detect.ts` (facade), `src/core/agents/{claude,cursor}/state.ts`, `src/core/agentstate/notify.ts`, `src/main/panes.ts`, `src/main/remote-live.ts`, `src/main/agents/claude/remote.ts`, `src/main/agentstate.ts`, `tests/core/agents/contract/state.test.ts` | P0.4 |
| P0.6 | `src/main/workspace.ts` (the rest, `dropUnknownSessions`), `src/main/agents/{claude,cursor}/waker.ts`, `src/core/agents/{claude,cursor}/{ids,fork}.ts`, `src/core/state.ts` (`session_agents`), `src/core/i18n/{en,es}.ts` (the two restore lines), `e2e/unknown-agent.spec.ts` (new) | P0.5 |
| P0.7 | `src/shared/workspace.ts`, `src/renderer/{addsession,sessionmenus,app,orchestration,chat}.ts`, `src/core/chat/**`, `src/main/chat.ts`, `src/core/usage/{cache,history,transcript,files}.ts`, `src/core/context/**` (the moves of §2.2), `src/core/control/post.ts`, `src/core/classifier/**` (its kit lookup), `docs/agents.md` (new), `AGENTS.md`, `src/core/files/check.ts` (`isClaudeData`), `src/renderer/switcher.ts`, `src/renderer/integrations.ts` (`claudeSwitch`) | P0.6 |
| P0.8 | `docs/release-checklist.md` | P0.7 |

#### P0.1 — R10's snapshot, its guard, and the baseline (on `main`, before the branch)

- [ ] Tests: `tests/core/r10.test.ts` and `e2e/r10.spec.ts` exactly as §2.10 lists, the assembly
  rows included (S9). Run once on `main` (the team block whole), which writes the snapshots;
  `set` commits them on `main`.
- [ ] `scripts/check-test-integrity.mjs`: default baseline `git merge-base main HEAD`; its test.
- [ ] `scripts/ci.mjs`: Vitest with `CI=1`; the "R10 unchanged" step (skipped when HEAD is `main`).
- [ ] `docs/toolchain.md`, "A long-lived branch": §2.12's rules and what R10 holds.
- **Verify:** `npm run ci`, `npm run ui-check` (the new spec alone first, then whole). Injected
  defects: a space appended to `buildCommand`'s output → the snapshot test fails; a snapshot file
  deleted → Vitest under `CI=1` fails; on a scratch branch, one snapshot byte changed → the R10 step
  fails; a dummy listening socket under a test flag → the spec fails.

#### P0.2 — ids, descriptors, registries, and the rules (on `main`, 1.160)

- [ ] Tests first: `ids.test.ts` (`parseAgentId` of each id, `''`, `'gemini'`, a number → `null`;
  `AGENT_IDS` order = Claude then Cursor); `check-code-rules.test.ts` (§2.15's first row, each rule
  failing once on an injected line; an `ALLOWED` count exceeded → fails); `parity.test.ts`.
- [ ] `ids.ts`, `types.ts` **with only the Descriptor's types** (each later block adds the
  interface it first implements, §2.3), `descriptors.ts`, descriptors for Claude and Cursor
  (today's glyphs `✳`/`➤`, `agent.claude`/`agent.cursor`, caps matching today), kits holding only
  what later blocks fill.
- [ ] The six rules; `ALLOWED` seeded with every current site's count (`npm run ci` lists them),
  each reason "moved in P0.n" or a permanent reason (§2.2).
- **Verify:** `npm run ci`; R10 unchanged; `set` commits on `main`, then creates the branch.

#### P0.0 — the sandbox flavour and its package (1.155 Q3, 1.157 P1, 1.158, 1.159; `packager` with a worker)

- [ ] Tests first, `tests/core/flavor.test.ts` and `tests/scripts/check-package.test.ts`:
  - flavour `menkar` → `appDirs()` = today's three paths, `filesRoot('')` = `~/Menkar`, the title
    unchanged (R10);
  - flavour `sandbox` → `…/menkar-sandbox` under each XDG home, `~/Menkar-sandbox`, "Menkar
    Sandbox";
  - the resolver: `MENKAR_FLAVOR_BUILD` wins; on `main` → `menkar`; on any other branch → `sandbox`;
  - a pane's environment: an inherited `MENKAR_FLAVOR` stripped; the sandbox's carries `sandbox`;
    `menkar`'s carries none (R10's environment snapshot unchanged);
  - `chainedCommand` with `statusLine` set to another Menkar's statusline → `null`; to the user's
    own script → that script;
  - the sandbox's integrations page offers no item that writes `~/.claude/settings.json`, and no
    classifier setting (classifier off);
  - **1.159 B1**: a session found by the scanner but not in `started_sessions` → resume, add, trash,
    delete refused (one sentence through `t()`), and its transcript's bytes and mtime unchanged;
  - the sandbox package's metadata: `Package: menkar-sandbox`, `/usr/share/applications/
    menkar-sandbox.desktop`, its own `appId`, its artifact name, every installed path disjoint from
    `menkar`'s recorded list.
- [ ] Build: the constant, its resolver and readers (§2.12); `started_sessions`; the refusals; the
  second config with the four explicit names; `package.mjs`/`check-package.mjs` taking
  `--flavour`; `npm run package:sandbox`.
- [ ] `docs/packaging.md`, "The sandbox package": the files outside `/opt/Menkar` (1.157 P1), what
  is shared and how (§2.12's table), the container install check.
- **Verify:** `npm run ci`; `packager` builds both .debs, runs `package:check` on each, and installs
  `menkar-sandbox` beside `menkar` in a throwaway container: `dpkg -L menkar` and `/opt/Menkar`
  unchanged, both apps run at once with their own windows. Injected defect: drop
  `deb.packageName` → the metadata test fails.

#### P0.3 — Launcher, MCP mount, team delivery, environment, naming at start

- [ ] Tests first: `launch.test.ts` per agent, the `LaunchPlan` for each start kind, the team
  delivery's three methods for Claude (§2.5.6: snapshot off on every mode-on resume; below 2.1.267
  no team flags; fork holds `null`); **R10's command, settings, team-block and environment
  snapshots unchanged**; the team block's tests (`tests/core/team/**`) unchanged.
- [ ] Move `buildCommand`'s body into the two Launchers; `buildCommand` stays as the facade.
  `startPaneHeld` builds `ctx` once and asks the kit — the `spec.agent === 'claude'` lines there go.
  `TEAM_AGENTS`' entry moves into Claude's kit (`kit.team`); `teamAgent` asks the registry; the
  team delivery and `tell` code in main asks `pane.kit.team`. `sessionenv.ts` keeps `SESSION_ENV`
  as Claude's `EnvRules`. The `TeamDelivery`, `Launcher`, `McpMount`, `EnvRules` and `Namer.atStart`
  interfaces enter `types.ts`.
- [ ] `docs/session-control.md`, "The team block": "Per agent" (the three pieces, Claude's
  implementation).
- [ ] Lower this block's `ALLOWED` counts.
- **Verify:** `npm run ci`, `npm run ui-check` (sessions start, the team block's specs, R10's
  assembly spec).

#### P0.4 — the session catalog

- [ ] Tests first: the catalog contract over Claude and Cursor fixtures (`tests/data/agents/<id>/`,
  copied from today's test fixtures, not moved); today's `tests/core/sessions/*` untouched and green
  (S10: facade types as §2.11).
- [ ] Claude's and **Cursor's readers move unchanged** into their catalogs (S6); the scanner asks
  each installed kit's catalog; `watchedDirs` asks `watchTargets`; `Roots` and `Installed` become
  maps by `AgentId` behind the facades' old shapes. Main's uses of `SessionInfo.file` go through
  the catalog. `SessionInfo` keeps its fields (`file` holds the locator).
- **Verify:** `npm run ci`, `npm run ui-check`; R10's watched-dirs snapshot unchanged.

#### P0.5 — state rules and Remote

- [ ] Tests first: the state contract over each agent's screen fixtures (today's
  `tests/core/agentstate/` cases stay); Claude's `remote.live` against today's registry fixture.
- [ ] `detect.ts`'s functions move into the kits; `detectState` is the facade. `AGENT_NAMES` from
  the descriptors; `provider` typed `AgentId`; `remote-live.ts`'s reader moves to
  `src/main/agents/claude/remote.ts` (B2), the loop asks `mainKit.remote` and skips `null`.
- **Verify:** `npm run ci`.

#### P0.6 — main's remaining checks, wake, ids, fork, and the tolerance

- [ ] Tests first: §2.15's tolerance rows (B3's keep rule; `resumeSpec` cases; a Claude-only start
  writes no `session_agents`; a Cursor start writes `{ id: 'cursor' }`); Claude's waker against
  today's socket fixture (frame bytes = R10's); `ids`/`follow` for Claude (`followPaneStart`'s
  cases); Claude's `fork.plan`.
- [ ] `wakeSession` calls `pane.kit.waker`; `handleControl`'s gate and `resume_session`'s refusal
  test whether the kit's McpMount is `null`; `followPaneStart` asks `kit.follow.classify`;
  `forkSession` asks `kit.fork`; `installedAgents` (the registry's CLIs on the PATH), `agentName`,
  `startNew`'s id (`kit.ids.newId()`); the first-time card's and "Ask an agent"'s agent (the
  registry's default, unchanged until Q2's block).
- [ ] `dropUnknownSessions` keeps a pane named by `session_agents` (B3); `session_agents` written
  and pruned; the two restore lines (§2.4) in `en.ts`/`es.ts`.
- [ ] E2E (`e2e/unknown-agent.spec.ts`): a saved tab of `s1` with `session_agents: { s1: 'gemini' }`
  → Q4's line, nothing started, `s1` kept after a save; with `{ s1: 'cursor' }` and no transcript →
  the "not found" line, same.
- **Verify:** `npm run ci`, `npm run ui-check`; screenshots of both lines (light, dark).

#### P0.7 — renderer, chat, usage, classifier, context; the rule at its floor

- [ ] Tests first: the renderer's menus per descriptor (an existing spec extended: a Cursor row has
  no Fork, no Remote Control, as today).
- [ ] `PaneAgent = AgentId | 'shell'`; the shared types use `AgentId`; the renderer reads
  descriptors; chat variants and CLIs move into the kits' `ChatStrategy`; the usage cache's
  `claude` property → `given` (SQL column unchanged); the classifier finds its CLI through
  `kitOf(CLASSIFIER_AGENT)`; the named identifiers of §2.2 move or are renamed.
- [ ] `ALLOWED` holds only §2.2's permanent entries; the old `src/core/agents.ts`, if any, removed.
- [ ] `docs/agents.md`, "How the code is organised" (§2.1–§2.5 condensed, with what was rejected,
  and any `ALLOWED` entry kept with its reason); `AGENTS.md`'s per-agent bullet gains "enforced by
  `scripts/check-code-rules.mjs`".
- **Verify:** `npm run ci`, `npm run ui-check` whole; R10 whole.

#### P0.8 — the merge gate (1.142)

- [ ] `docs/release-checklist.md`, "Agents moved behind their kits (P0)": a day of work with Claude
  and Cursor sessions as usual; start, resume, fork, Remote Control, the orchestration mode with
  the team block, a wake, Usage — each passes when it behaves as before. In the sandbox: projects
  named with a `sandbox-` prefix (1.159 B1); no daily session offered for resume, trash or delete;
  the classifier absent.
- [ ] Real checks: `claude-cli` and `cursor` run the P0 build's commands against the real CLIs in
  throwaway homes (the command line, `--settings`, the team flags, the MCP's `tools/list`, a wake, a
  Cursor resume).
- [ ] `packager`'s `menkar-sandbox` .deb from the worktree; the human installs it beside their
  Menkar and runs the hand check in it; then `set` merges `multi-agent` into `main`, and `packager`
  builds `main`'s own .deb, which the human installs over their Menkar for the same check.
- **Verify:** `npm run ci`, `npm run ui-check`, CI's R10 step green against `main`.

### P1a — Codex as a session (R1–R4, R9, R11)

| Block | Files it owns | After |
|---|---|---|
| P1a.1 | `e2e/standins/codex.ts`, `tests/data/agents/codex/**`, `src/core/agents/shared/db.ts`, `tests/core/agents/shared/db.test.ts`, `tests/core/agents/contract/nowrite.test.ts` | P0 |
| P1a.2 | `src/core/agents/codex/{ids,descriptor,launch,env,config}.ts`, `src/core/agents/{ids,descriptors,registry}.ts`, `src/main/agents/registry.ts`, `src/main/agents/codex/index.ts`, `package.json` (`smol-toml`), `docs/toolchain.md` | P1a.1 |
| P1a.3 | `src/core/agents/codex/catalog.ts`, `src/core/agents/shared/zstd.ts`, `package.json` (engines), contract fixtures | P1a.2 |
| P1a.4 | `src/core/agents/codex/{notify,binding}.ts`, `src/main/agents/codex/bind.ts` (`/proc` read), `electron.vite.config.ts`, `scripts/check-package.mjs`, `src/core/sessions/join.ts`, `src/main/control.ts`, `src/main/workspace.ts` (binding, follow), `docs/packaging.md` | P1a.3 |
| P1a.5 | `src/core/agents/codex/state.ts`, state fixtures | P1a.4 |
| P1a.6 | `src/core/agents/codex/{usage,context}.ts`, `src/core/agents/claude/usage.ts` (today's cache wrapped as a `TurnSource`), `src/core/usage/{pass,history}.ts`, `src/core/usage/prices.ts` (OpenAI rows), `src/core/classifier/**` (`turnText`) | P1a.5 |
| P1a.7 | `e2e/codex.spec.ts`, `docs/agents.md` (Codex), `docs/sessions.md`, `docs/usage.md`, `docs/release-checklist.md` | P1a.6 |

- **P1a.1** — Stand-in and fixtures (rollouts, one `.zst`, `session_index.jsonl`, a `state_5.sqlite`
  copy, `notify` with codex's JSON argument, the title thread's extra notify with no rollout, a
  rollout held open by the stand-in's process). `openAgentDb` and its test in the three states
  (§2.6). The no-write harness generic over `DeclaredWrites`, Claude's and Cursor's rows first.
  **Verify:** `npm run ci`; inject: drop `immutable=1` → the listing test fails.
- **P1a.2** — Codex's descriptor (glyph proposed in the block, shown in a screenshot — a UI choice
  the human confirms), Launcher (`-m`, `--add-dir`, `-c notify` per §2.9, the positional prompt;
  resume: `codex resume <id> "<prompt>"`; files through `LaunchPlan.files`, §2.8), EnvRules
  (`codex.md` §1.7, D12), `config.ts` with `smol-toml`. Tests: the command for each start; quoting;
  config fixtures (plain, profile, unparsable → no chaining). **Verify:** `npm run ci`, `npm run
  ui-check` (the New picker with Codex; screenshot); R10 unchanged (no `codex` on the PATH).
- **P1a.3** — Catalog: rollouts, names from `session_index.jsonl` (the last line per thread wins),
  cwd and preview from `session_meta` and the first user message, badges, `lastReply` from
  `task_complete.last_agent_message`, details, export; a `.zst` streamed async (§2.6); engines
  `>=22.15.0`. Contract: Codex's fixture conversation = `expected.json`. **Verify:** `npm run ci`.
- **P1a.4** — The `notify` program (writes the record only for a thread whose rollout exists,
  chains the user's, §2.9) shipped; IdBinding: the early bind through `/proc/<pid>/fd` (Linux) and
  the record bind as fallback; `/new` and `/resume` classified; the record writer/reader parity
  test. Tests with the stand-in: the title thread writes no record; the pane bound before the first
  turn ends when the stand-in holds its rollout open. **`codex` measures** (a task, set's OK, a
  throwaway home): ms from start to the rollout's creation, and the `/proc` bind on the real CLI;
  the numbers go to `docs/agents.md`. **Verify:** `npm run ci`, `npm run ui-check` (start, first
  turn, the tab follows the id).
- **P1a.5** — State rules from `codex.md` M16; fixtures per state. **Verify:** `npm run ci`.
- **P1a.6** — Usage: Claude's cache wrapped as its `TurnSource` (bytes unchanged); Codex's in
  `usage-cache-codex.sqlite`, a turn per user message, tokens from `token_count`, uuids
  `codex:<turn id>`; `runPass` loops sources; OpenAI rows in `prices.ts` (D15); context from the
  rollout tail; the classifier's `turnText` (D19, until P4). Tests: the contract's tokens per
  turn; a midnight-spanning turn counted on its opening day; a `.zst` replacing an ingested `.jsonl`
  not re-counted; Claude's cache file untouched (R10). **Verify:** `npm run ci`, `npm run ui-check`
  (Usage with a Codex session; screenshot).
- **P1a.7** — Gate: `e2e/codex.spec.ts`; docs; release-checklist "Codex as a session"; `codex`'s
  real check. **Verify:** `npm run ci`, `npm run ui-check` whole, R10.

### P1b — the orchestration bridge, with Codex (R5–R8)

| Block | Files it owns | After |
|---|---|---|
| P1b.1 | `src/core/control/{protocol,server,files}.ts`, `src/core/agents/types.ts` (caller, Messaging), `src/core/agents/claude/messaging.ts`, `tests/core/control/**` | P1a |
| P1b.2 | `src/core/agents/codex/mcp.ts`, `src/main/workspace.ts` (`handleControl`, `start_session`'s `agent`, resume/park/renew/adopt per kit), `src/core/projects/**` (provisional ids) | P1b.1 |
| P1b.3 | `src/main/agents/codex/waker.ts`, `src/main/agents/shared/wake.ts`, `src/core/control/post.ts` (the bridged frame builder), `send_message` | P1b.2 |
| P1b.4 | `src/main/agents/codex/namer.ts` | P1b.3 |
| P1b.5 | `plugin/team/codex.md`, `src/core/agents/codex/team.ts`, the `recorded` persistence (`src/core/team/**`), `scripts/check-package.mjs` (the team part) | P1b.4 |
| P1b.6 | `src/renderer/orchestration.ts` (first-time card per Q2), i18n, `e2e/orchestration-codex.spec.ts`, docs, release-checklist | P1b.5 |

- **P1b.1** — Before code: `claude-cli` measures with a stub server that Claude re-lists on
  `notifications/tools/list_changed` and keeps the prompt cache (38 §3.1). **If Claude does not
  re-list** (minor), the fallback: `send_message` and `agent` are listed from a session's start
  whenever another installed agent qualifies (D3's table at start, not mid-session), so a Claude
  session started before Codex was installed sees them only after a renew — stated in
  `docs/agents.md`. Then: `tools/list` shaped per caller from the installed agents' kits (Messaging
  and Waker, S8); `listChanged: true` declared only when a non-Claude CLI is installed;
  `ControlRequest.caller`. Tests: §2.15's D3 snapshots. **Verify:** `npm run ci`.
- **P1b.2** — Codex's McpMount (`-c mcp_servers.menkar.command/args/env`, `MENKAR_PANE`, approval
  mode `approve`); `handleControl` serves any kit whose McpMount is not `null`; `start_session
  { agent }` (D4; `parseAgentId`, refusal for an agent not installed); provisional ids (§2.5.2);
  `resume_session`/`park_session`/`renew`/`adopt_session` per kit (R11). Tests: a Codex worker by
  `start_session` from a Claude caller → member and child by its provisional id, re-keyed at the
  bind; Menkar quits before it → dropped on load with the log line. **Verify:** `npm run ci`, `npm
  run ui-check`.
- **P1b.3** — Codex's waker (`codex queue`, outcome by exit status; no rollout → `'no session'`);
  `send_message { name, text }` through the target's waker; Claude→Claude refused with "use
  SendMessage" (Messaging `reaches`); the bridged frame. Tests: each D2/D3 case; the stand-in's queue
  receives the frame bytes. **Verify:** `npm run ci`, `npm run ui-check`.
- **P1b.4** — Codex naming after the first turn (`Namer.after`, `thread/name/set`, D5); until then
  the pane holds the name. **Verify:** `npm run ci`.
- **P1b.5** — Codex's team part and delivery (§2.5.6): `atStart` (`developer_instructions` through
  `LaunchPlan.files`, then the user's own), `heldAtStart` (`recorded` on resume, persisted),
  `afterCompaction` (`codex` confirms whether `developer_instructions` re-render at compaction),
  the compaction signal from the rollout's `compacted` item (S7), `tell` through its waker; skills
  per **Q1** (`kit.team.skill` → the `SKILL.md`'s absolute path from `FoundSkill.place`; Menkar's
  from the plugin folder; not-found as the block names it today). Tests: the `teamPost` rule cases
  with Codex's methods (resume with facts unchanged → no post; changed → one post once wakeable;
  compaction); the skills line for the orchestrator, a worker with one stored skill, a not-found
  skill; Claude's block bytes unchanged (R10). **Verify:** `npm run ci`.
- **P1b.6** — The first-time card per **Q2**: the agent choice only with two or more agents
  installed, default `last_agent` — a mock-up for the human first, then built — and the Cursor
  warning of 38 "Mixed projects"; "Ask an agent" per Q2. Tests: one agent installed → the card as
  today; two → the choice. E2E: a Claude orchestrator with a Codex worker — start, report, wake,
  `last_reply`, `send_message` both ways, a team update not waking the orchestrator; screenshots.
  Gate: `codex` and `claude-cli` real checks, release-checklist "Codex in the orchestration mode".
  **Verify:** `npm run ci`, `npm run ui-check` whole, R10.

### P2 — OpenCode (R1–R11)

| Block | Files it owns | After |
|---|---|---|
| P2.1 | `e2e/standins/opencode.ts`, `tests/data/agents/opencode/**` | P1b |
| P2.2 | `src/main/agents/opencode/server.ts`, its tests, `e2e/r10.spec.ts` (the `opencode` rows: absent, present but unused) | P2.1 |
| P2.3 | `src/main/agents/opencode/proxy.ts`, caller resolution in `src/main/workspace.ts` | P2.2 |
| P2.4 | `src/core/agents/opencode/{descriptor,catalog,env,ids,index}.ts` (it **creates** the kit's `index.ts`), `src/main/agents/opencode/index.ts`, registries | P2.1 (parallel with P2.2 and P2.3: P2.5 wires the server into the kit) |
| P2.5 | `src/core/agents/opencode/{launch,state,mcp,team}.ts`, `src/main/agents/opencode/{prepare,waker,events}.ts`, `plugin/team/opencode.md`, `scripts/check-package.mjs` | P2.3, P2.4 |
| P2.6 | `src/core/agents/opencode/{usage,context}.ts` | P2.5 |
| P2.7 | `e2e/opencode.spec.ts` (alone and as a worker), docs (`agents.md`, `session-control.md` port amendment + history), release-checklist | P2.6 |

- **P2.1** — The stand-in server and TUI and an `opencode.db` fixture in WAL mode (the three states
  of §2.6).
- **P2.2** — The server's life (§2.7): `serve --stdio`, password, random port, the feature checks
  (instruction route, MCP route), stop with the last tab and on quit, one restart per 30 s. Tests:
  no port before the first OpenCode tab (R10's spec extended); main killed → the stand-in server
  gone; restart counted. **Verify:** `npm run ci`, `npm run ui-check`.
- **P2.3** — The per-pane proxy (D14, 1.138); the session map; the caller's `_meta` resolved;
  `/new` followed as a clear. **Verify:** `npm run ci`.
- **P2.4** — Catalog from `opencode.db` through `openAgentDb`; watched by the database file's mtime
  and `-wal`'s; read only when OpenCode is installed (R10). Contract fixture; R9 in three states.
  **Verify:** `npm run ci`.
- **P2.5** — Preparer, Launcher, state (screen + events as records), waker (inbox), MCP per folder
  when the mode is on (D20, 1.141), `OPENCODE_CONFIG_CONTENT` (§2.7, S12: a mode-off session's
  request unchanged), team delivery (`tell` = the entry PUT), the two-servers warning (D9).
  **Verify:** `npm run ci`, `npm run ui-check`.
- **P2.6** — Usage (a turn per user message, D9; cost lines to `usage-opencode.jsonl`) and context.
  **Verify:** `npm run ci`.
- **P2.7** — Gate: e2e; `opencode`'s real check; docs; release-checklist. **Verify:** `npm run ci`,
  `npm run ui-check` whole, R10.

### P3 — Cursor completed (R1–R8)

| Block | Files it owns | After |
|---|---|---|
| P3.1 | `src/core/agents/cursor/integrations.ts`, the integrations page, `docs/preferences.md`, i18n | P2 |
| P3.2 | `src/core/agents/cursor/{launch,mcp,team,state,ids,catalog}.ts` (the rewritten-transcript rules), `plugin/team/cursor.md`, `scripts/check-package.mjs`, R10's Cursor snapshot files (with `set`) | P3.1 |
| P3.3 | `src/core/agents/cursor/{hooks,usage}.ts`, `electron.vite.config.ts`, `scripts/check-package.mjs`, `docs/packaging.md` | P3.2 |
| P3.4 | `src/main/agents/cursor/waker.ts`, `src/core/agents/cursor/names.ts` | P3.3 |
| P3.5 | `e2e/cursor.spec.ts`, docs, release-checklist | P3.4 |

- **P3.1** — The two integrations items (D13, D7), each consented and removable on its own, the rest
  of the file byte-identical; greyed when `cursor-agent` is not found; in the sandbox, "Remove
  before uninstalling" (S11), and `cursor` confirms what Cursor does with a hook whose program is
  missing. **Verify:** `npm run ci`, `npm run ui-check` (screenshot).
- **P3.2** — Launcher (first prompt, `--model`, `--new-session-id <uuid>`, the fallback behind the
  same IdBinding); the per-pane plugin folder; the team delivery (`sessionStart`'s
  `additional_context`, `heldAtStart` `recorded`, its compaction signal from `cursor`); the
  rewritten-transcript reader (§2.6, its own fixture); the trust prompt. R10's Cursor rows
  refreshed, `set` signing the diff. **Verify:** `npm run ci`, `npm run ui-check`.
- **P3.3** — The hook program (§2.9: own flavour only, prompt text only while the classifier is
  on, `stop` never waits), records, Cursor's usage source; D21's test. **Verify:** `npm run ci`.
- **P3.4** — Waker (D1) and team `tell` (1.159, S7: an idle session's facts change held until the
  next wake); names per D22. Tests: each branch with the stand-in, a draft never lost. **Verify:**
  `npm run ci`, `npm run ui-check`.
- **P3.5** — Gate: e2e (Cursor worker of a Claude orchestrator, with and without the items);
  `cursor`'s real check; docs; release-checklist. **Verify:** `npm run ci`, `npm run ui-check` whole.

### P4 — the classifier per agent (1.159, 1.161; after P3)

| Block | Files it owns | After |
|---|---|---|
| P4.1 | `src/core/agents/{claude,codex,opencode,cursor}/classifier.ts`, the `Classifier` interface in `types.ts`, `src/core/classifier/**` (runs through the chosen kit), `src/core/agents/ids.ts` (`CLASSIFIER_AGENT` removed), `scripts/check-code-rules.mjs` (`agent-default`'s mention of it), the setting (Settings page, `src/core/settings.ts`, i18n), `scripts/classify-eval.mjs` (per agent and model), `docs/classifier.md` | P3 |

- **P4.1** — Before code: each consultant (`codex`, `opencode`, `cursor`) confirms in a throwaway
  home whether its CLI runs a one-shot prompt with a chosen model and returns plain text (`codex
  exec -m`, `opencode run -m`, `cursor-agent -p --model`); an agent that cannot keeps `Classifier`
  `null`. Then: a mock-up of the setting for the human, its place their choice; the setting (§2.17:
  offered among installed agents whose `Classifier` is not `null`; default Claude with Haiku when
  installed, else the first that can, else off); `classify:eval` per agent and model, a model
  offered only once its accuracy is recorded; D19's text amended (old to its history); hidden in
  the sandbox. Tests: the default with and without `claude`; an agent with `Classifier` `null` not
  offered; a turn classified through Codex's stand-in; the sandbox hides it; Claude's classifier
  bytes and prompts unchanged (R10). **Verify:** `npm run ci`, `npm run ui-check` (screenshots of
  the setting, light and dark).

### Close (when the human calls the branch validated)

- [ ] `set` merges `multi-agent` into `main`; the worktree is removed; `docs/toolchain.md`'s "A
  long-lived branch" keeps only what holds for the next one (the sandbox flavour and package stay),
  the rest to its history.
- [ ] Plan 38's exit (its header) completed: `docs/agents.md` whole, `README.md`, `AGENTS.md`'s D17
  rewording (old text to `docs/history/root/AGENTS.history.md`), `docs/preferences.md`,
  `docs/NOT_BUILT_YET.md` (38 §7 and §3 here, each with its trigger); STATUS rows 1.137–1.143,
  1.155, 1.157 P1, 1.158–1.161 point at their docs.
- [ ] Delete `plans/38-multi-agent.md` and this plan, their §3 rows to the history.
- **Verify:** `npm run ci` (the history check).

---

## 6. Execution log

*(Written by the sessions that execute it.)*

### P0.3 (`menkar-t56`, task 56, 2026-11-16)

- **Decided by set, 2026-11-16:** the main kit holds `settings: (() => Promise<string>) | null`
  (Claude: `sessionSettingsFile`; Cursor: `null`), so no settings file is written on a Cursor-only
  start, as before.
- **Decided by set, 2026-11-16:** `pane.remote`'s `spec.agent === 'claude'` line in
  `startPaneHeld` stays for P0.5 (`mainKit.remote`); `src/main/workspace.ts`'s `agent-literal`
  count went 25 → 22, its reason now naming P0.5.
- **Decided by set, 2026-11-16:** `src/core/team/version.ts` stays (its test imports
  `claudeVersion`, `TEAM_FLOOR`, `teamFlagsAllowed` and `tests/core/team/**` stays unchanged);
  Claude's kit imports it as its `floor`. Its `ALLOWED` entry is kept as permanent with that
  reason — P0.7's `docs/agents.md` lists it.
- **Deviations:** `LaunchPlan` has no `files` member and `TeamDelivery` no `afterCompaction` yet:
  neither has a producer or an answer that differs in P0 (no abstraction without a consumer); they
  enter with Codex (P1a, P1b.5). The team file is still written by main before the Launcher is
  asked, so a failed write still leaves the pane outside the team. `heldAtStart` takes
  `(start, block)`: the `recorded` argument enters with the first agent that keeps one (Codex).
- `MainAgentKit` and `MainTeamDelivery` are declared in `src/main/agents/types.ts` (new); the
  `SESSION_ENV` export of `src/core/sessionenv.ts` is now the union of every kit's `EnvRules`.

### P0.4 (`menkar-t58`, task 58, 2026-11-16)

- **Decided by set, 2026-11-16 — the fixtures' premise corrected:** the plan said
  `tests/data/agents/<id>/` would be "copied from today's test fixtures"; none existed
  (`tests/core/sessions/*` build transcripts at run time with `tests/factories/transcript.ts`). They
  are synthetic files in the factories' shapes, a `home/` tree per agent plus `expected.json`,
  copied into a temporary HOME by `tests/core/agents/contract/catalog.test.ts`. `expected.json` was
  written by the readers as they were **before** the move, so the contract asserts no behaviour
  change; later phases extend these files with real recordings.
- **Decided by set, 2026-11-16:** `AgentPaths` keeps `claudeProjects` and `cursorProjects`
  (`tests/core/paths.test.ts` asserts the first); each catalog's `root()` reads `agentPaths()`, so
  paths stay resolved in the paths module only. `src/core/paths.ts` keeps its count of 12.
- **Decided by set, 2026-11-16:** `PassPaths` keeps `claudeProjects` (the usage and classifier
  tests build it literally); `src/core/usage/pass.ts` is untouched, its count 2 with the reason
  "P1a.6: TurnSource replaces PassPaths' root".
- **Decided by set, 2026-11-16:** `SessionCatalog` has `transcript: TranscriptReading | null` (head,
  `headFinal`, badge, `titles`, details and export over text) — how a JSONL agent reads its lines,
  null for a SQLite one later. The facades `readHead`, `badgeOf`, `details`, `exportMarkdown` and
  `sessionName` go through `kitOf(agent).catalog.transcript`; whether Claude's titles count is
  `transcript.titles !== null`, the same test `toInfo`'s `claudeNamed` uses.
- **Decided by set, 2026-11-16:** `read(found, prev)` became a stateful `reader(read)` per catalog
  (`SessionReader`: `read(found)`, `retain(locators)`), one per agent in the scanner; Claude's and
  Cursor's are the same shared `JsonlReader` (`agents/shared/jsonl.ts`) fed by each agent's
  `TranscriptReading` — today's incremental logic, unchanged.
- **Decided by set, 2026-11-16:** the facades' old `Roots` shape is
  `Partial<Record<\`${AgentId}Projects\`, string>>`; a missing key means the catalog's own root, so
  `src/main/sessions.ts` passes no roots. Left for later blocks, as they use `SessionInfo.file`
  outside P0.4's list: `src/main/workspace.ts` `trackContext(id, info.file)` (context, P1a.6) and
  `onlyTeamUpdates(file)` in `onShownChange` (P0.6).
- **Decided by set, 2026-11-16:** `Details`, `RecentMessage`, `Badge` and `Head` live in the
  Node-free `src/core/sessions/details.ts`, and `src/shared/workspace.ts`'s one `Details` import
  points at it: the renderer's `tsc` has no Node types and type-checks every file it reaches, and
  `transcript.ts`, now a facade over the registry, reaches `node:fs`. `src/core/sessions/info.ts`
  takes `AgentId` from `ids.ts` for the same reason.
- **Decided by set, 2026-11-16:** `tests/core/agents/parity.test.ts`'s `trash` pair names its
  concern, `kitOf(id).catalog.trash`.
- **My choices:** agent-neutral reading helpers several catalogs can use (`parseLine`,
  `messageText`, the name and cwd byte scans, `applyNameLines`, `dashedPath`, the directory
  helpers, `markdownExport`) are in `agents/shared/jsonl.ts`, so the facades the tests import
  (`sessions/{lines,names,scanner,cursor}.ts`) re-export them without importing an agent folder;
  `cursorCwd` is that re-export's alias of `dashedPath`. `sessions/lastreply.ts` stays where it is
  (no agent named in it) and is Claude's `catalog.lastReply`; Cursor's is `null`, as `replyOf`
  answered before. A catalog whose `trash` is `null` answers a trash or delete with the existing
  "could not" refusal (no such agent yet).
- **`ALLOWED`:** the entries of `sessions/{badges,cursor,head,lines,names,scanner,transcript}.ts`
  and `src/main/sessions.ts` are gone; `sessions/service.ts` 9 → 1 and `sessions/info.ts` 1, both
  `claudeNamed` (P0.7, read by the renderer and main); `src/main/workspace.ts`'s `agent-literal`
  22 → 21, its reason now P0.5 and P0.6.
- **Decided by set, 2026-11-16:** `docs/sessions.md`'s "Details and export" sentence now names the
  agent's catalog; the old lines went verbatim to `docs/history/sessions.md`.
- **CI on 2026-11-16:** every step green except "R10 unchanged", because `main` moved to `7e8add4`
  (task 51, five plugin snapshots). The branch's R10 files are byte-equal to the merge base
  `fbbf0e5`, and the step clears when `main` is merged in.

### P0.5 (`menkar-t61`, task 61, 2026-11-17)

- **Decided by set, 2026-11-17:** `bottom` and the splitlines `LINE_BREAK` both agents' rules use
  live in `src/core/agents/shared/screen.ts`, so no import cycle runs detect → registry → a kit's
  `state.ts` → detect.
- **Decided by set, 2026-11-17:** the state contract's fixtures are
  `tests/data/agents/<id>/screens.json` (name, title, screen, expected raw state), checked against
  the rules as they were before the move (the facade alone, on the unmoved `detect.ts`), with the
  edge of each line window (Claude's 14 and 3, Cursor's 10) so a moved count fails the contract.
- **Decided by set, 2026-11-17:** Claude's `remote.live` is tested in
  `tests/main/agents/claude/remote.test.ts` with a temporary HOME holding a registry `<pid>.json`
  and a real throwaway process running a script named `claude`, killed by its process group in the
  teardown.
- **Decided by set, 2026-11-17 — §2.3 corrected:** Remote is `live(pane) → Promise<BridgeState>`
  (`'on' | 'off' | 'unknown'`), not `boolean`: 'unknown' makes the icon fall back to the app's own
  list, and a boolean would lose it. It also has `folder()`, the registry folder the loop watches.
  `Remote` and `RemotePane` are in `src/main/agents/types.ts`.
- **Decided by set, 2026-11-17:** `tests/core/agents/parity.test.ts`'s `remote` pair is
  `mainKitOf(id).remote`, as P0.4 filled `trash`.
- **Decided by set, 2026-11-17 — P0.4's trap again:** `src/core/agentstate/shown.ts` (reached by
  the renderer's `tsc`) imported `RawState` from `detect.ts`, now a facade over the registry that
  reaches `node:fs`. `RAW_STATES` and `RawState` live in the Node-free `src/core/agentstate/raw.ts`,
  re-exported by `detect.ts`; `shown.ts`'s one import line points at it, as P0.4's `details.ts` did.
- **Decided by set, 2026-11-17:** `AGENT_NAMES` (`agentstate/notify.ts`) is gone; a notification
  names its agent with the descriptor's label through `translate(key)`, a new export of
  `src/core/i18n.ts`, the twin of the renderer's (`check-i18n` takes only a literal in `t()`). A test
  asserts every descriptor's label key is in `en` and in `es` themselves, and that both read
  'Claude Code' and 'Cursor', the names shown before.
- **Decided by set, 2026-11-17:** `docs/agent-state.md` (the shape, the background pill) and
  `docs/sessions.md` (Remote Control, how it is read) name the kits now; the old lines went verbatim
  to their histories.
- `detectState(provider: string, …)` keeps its signature: it parses the id (`parseAgentId`) and an
  unknown one is idle, as before; `src/core/agentstate/watch.ts` is unchanged. `StateRules` is
  `state` in every kit (never `null`: every agent has rules). The loop in `remote-live.ts` resolves
  the kits' folders on each watch attempt, as `agentPaths()` was read before.
- **`ALLOWED`:** the entries of `agentstate/{detect,notify}.ts`, `src/main/panes.ts` and
  `src/main/remote-live.ts` are gone; `src/main/workspace.ts`'s `agent-literal` 21 → 20, its reason
  now P0.6 alone (`pane.remote` asks `mainKitOf(spec.agent).remote`).

### P0.6 (`menkar-t64`, task 64, 2026-11-17)

- **Decided by set, 2026-11-17 — files beyond §5's row:** `src/core/agents/types.ts` and
  `src/core/agents/{claude,cursor}/index.ts` (`ids`, `follow`, `fork`), `src/main/agents/types.ts`
  and `src/main/agents/{claude,cursor}/index.ts` (`Waker`), `src/core/agents/registry.ts`
  (`isDefault`, §2.4's "the registry's"), `tests/core/agents/parity.test.ts` (the `fork` pair,
  `kitOf(id).fork`), `src/core/agents/{claude,cursor}/catalog.ts` (`turnEnd`, below), and the new
  test files beside each piece.
- **Decided by set, 2026-11-17 — a child's turn end (gap A):** `onShownChange` gated a *child's*
  turn end waking its parent on Claude, and read the child's transcript with `onlyTeamUpdates` and
  `reportClosedTurn`. That is the child's catalog's concern, not the parent's waker:
  `SessionCatalog.turnEnd: { onlyTeamUpdates, reportedTo } | null` (Claude's from
  `sessions/lastreply.ts`, Cursor's `null`); `onShownChange` returns when it is `null`, and the
  catalog interprets the locator, so P0.4's `onlyTeamUpdates(file)` leftover is gone.
  `reportClosedTurn` stays in `lastreply.ts` and is Claude's `turnEnd.reportedTo`.
- **Decided by set, 2026-11-17 — "restored and not started" (gap B):** every pane runs a shell, so
  a kept pane is a plain shell pane holding the session id (agent `'shell'`: no state detection, no
  team delivery), with the line written above it, as the "CLI not found" path does
  (`PaneSpec.notice`). The saved tab and the member stay as they were; closing the shell closes the
  tab, as any pane's exit does.
- **Decided by set, 2026-11-17 (gap C):** `agentName('shell')` answers the default agent's label, as
  before (the quit list names a running shell split "Claude Code"); the fix is task 67.
- **Decided by set, 2026-11-17 (gap D):** IdBinding enters as `ids.newId()` and
  `follow.classify(source)`; `isRealId` waits for Codex, its first consumer.
- **Decided by set, 2026-11-17 (gap E):** `start_session` starts `DEFAULT_AGENT` and "Ask an agent"
  (a file tab's) too; a renew restarts the pane's own agent. Renew's and `start_session`'s ids stay
  `randomUUID()` (P1b.2's provisional ids own them); `startNew`'s and a fork's come from
  `kit.ids.newId()`.
- **`session_agents`** lives in `src/core/state.ts` (`sessionAgents`, `withSessionAgent`, which
  returns the same state when nothing changes, so main skips the write), with the restore rule
  `restoreOf(found, named)` → `resume` / `missing` / `unsupported` / `unnamed`, read by both
  `dropUnknownSessions` (keeps all but `unnamed`) and `resumeSpec` (`unnamed` resumes as
  `DEFAULT_AGENT`, as `?? 'claude'` did). Main writes it at a pane's start with a session (not for
  a kept pane) and when a pending session joins, never for the default agent (`isDefault`), and
  forgets it on trash and delete. `dropUnknownSessions` reads it from the state after the first
  scan, so a slow state load cannot drop a tab it names.
- **`Waker`** (`src/main/agents/types.ts`): `wake(sessionId, text, counts) → Promise<PostOutcome>`,
  `PostOutcome` being the existing type. Claude's (`src/main/agents/claude/waker.ts`) is the post
  `wakeSession` made; Claude's `team.tell` is the same function. Cursor's main kit has `waker:
  null`, so no `src/main/agents/cursor/waker.ts` exists yet (P3.4 adds it). The wake batcher's
  human posts (presence, control, topic) are gated on the orchestrator's pane having a waker.
- **`follow.classify`** for Claude: `clear` → `clear`, `resume` → `resume`, `compact` → `null`;
  `followPaneStart`'s own `compact` early return went with it (the team record is still noted
  first). The two restore lines are `terminal.restoreMissing` and `terminal.restoreUnsupported`,
  after `[menkar]`, the tag every app line has.
- **`ALLOWED`:** `src/main/workspace.ts`'s entry is gone (agent-literal 20 and agent-property 2 →
  0). `AGENT_COMMANDS[spec.agent]` in `startPaneHeld` stays (P0.7 removes `src/core/agents.ts`).
- **The e2e's Claude-start case** waits for the new session to join before reading `state.json`:
  a new Claude session's id binds late (a `Pending`), and a fixed wait passed with `isDefault`
  broken.

### P0.7 (`menkar-t71`, task 71, 2026-11-17)

- **Decided by set, 2026-11-17 — files beyond §5's row:** `src/core/agents/types.ts`,
  `src/core/agents/{claude,cursor}/{index,descriptor}.ts` and the new `{claude,cursor}/chat.ts`,
  `tests/core/agents/parity.test.ts`, and `src/main/workspace.ts:959` only
  (`AGENT_COMMANDS[spec.agent]` → `descriptorOf(spec.agent).command`), so `src/core/agents.ts` is
  deleted. Also `docs/chat.md` and `docs/NOT_BUILT_YET.md` (lines this block made false, old ones
  to their histories) and `AGENTS.md`'s table row for `docs/agents.md`.
- **Decided by set, 2026-11-17 — test-pinned names (§2.11 against §2.2's "move or rename"):** names
  the tests import stay where they are, as `ALLOWED` entries whose reason is "tests import it by
  this name (§2.11, P0 rewrites no test); moves into its agent's folder with its test after P0.8":
  `chat/protocol.ts` (`claudeArgs`, `cursorArgs`, `claudeEvents`, `cursorEvents`),
  `chat/processes.ts` (`cursorTurn`, now an alias of `sendChat`), `classifier/run.ts`
  (`findClaude`, `claudeCall`), `context/files.ts` (`contextFiles.claudeSettings`),
  `context/integrations.ts` (`CLAUDE_DEFAULT_CLEANUP_DAYS`), `files/check.ts` (`isClaudeData`),
  `sessions/{info,service}.ts` (`claudeNamed`). **One follow-up after P0.8 merges**: move each with
  its test and drop its entry (listed in `docs/agents.md` too). Unpinned locals were renamed
  (`startClaude` → Claude's `chat.open`, `claudeDir`/`claudeJson`, the usage cache's `claude`
  variable and property → `given`, `claudeSwitch` → `settingsSwitch`).
- **Decided by set, 2026-11-17 — chat variants are renderer data:** each descriptor holds its
  `chat: readonly ChatVariant[]` (today's bytes); `variants.ts` keeps `VARIANTS`, `variantsFor`,
  `variantOf` as facades over `DESCRIPTORS`, `ChatAgent = AgentId`; `AGENT_CLIS` and `AGENT_NAMES`
  are gone (the descriptor's command and label). The kit's `chat: ChatStrategy | null`
  (`open(chat, env)`, `send(chat, text, env)`) replaces the `variant.transport` switches in
  `startChat` and `chat:send`; `transport` stays in the data. Parity: `chat` ⇔ `kit.chat`, and a
  non-empty list.
- **Decided by set, 2026-11-17:** the descriptor gains `namedAtStart` (Add session's
  `newSession.needName`), with a parity row against `kit.namer.atStart('x') !== null`.
- **Decided by set, 2026-11-17:** `classifier/input.ts`'s `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
  is a permanent entry ("Claude Code's own variable; only `claude -p` classifies until P4");
  `usage/pass.ts` keeps "P1a.6"; `paths.ts` keeps its reason ("P0.7 or later" now reads "after
  P0.8"). The classifier's CLI is `descriptorOf(CLASSIFIER_AGENT).command` (§2.3's
  "`kitOf(CLASSIFIER_AGENT)`": the command is the descriptor's).
- **The renderer's `tsc` trap again:** the descriptor's types (`AgentCap`, `AgentDescriptor`,
  `ChatVariant`, `VariantKey`) live in `descriptors.ts`, re-exported by `types.ts`, which reaches
  Node; the renderer now imports `descriptors.ts` and `ids.ts`.
- **An import cycle found by the suite:** a kit's `chat.ts` importing `sessionenv.ts` ran
  `kitOf` before the registry existed (`sessionenv.ts` reads every kit's `EnvRules` at load), so
  `processes.ts` passes `withoutSessionEnv(process.env)` in, computed when it was before; the
  chats' shared machinery (`Chat`, `findOnPath`, the sink, `follow`) moved to the new
  `chat/session.ts`, which imports no registry. `processes.ts` re-exports what the tests import.
- **`ALLOWED`** holds 16 files: `agentstate/mirror.ts` 1, `renderer/terminals.ts` 2,
  `usage/cache.ts` 2 and `usage/history.ts` 1 (the SQL column), `team/version.ts` 1,
  `classifier/input.ts` 1 (permanent); `usage/pass.ts` 2 (P1a.6), `paths.ts` 12; and the pinned
  names above (`chat/protocol.ts` 4, `chat/processes.ts` 1, `classifier/run.ts` 2,
  `context/files.ts` 1, `context/integrations.ts` 1, `files/check.ts` 1, `sessions/info.ts` 1,
  `sessions/service.ts` 1). No renderer or `src/shared/` file has a hit.
- The quit list's `agentName('shell')` is untouched (task 67).
