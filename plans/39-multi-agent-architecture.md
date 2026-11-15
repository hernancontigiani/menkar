# Plan 39 — The software architecture of multi-agent support

> **Status: written, 2026-11-15, by the architect (`menkar-t13`, task 13). Not reviewed yet**: a
> Fable 5.2 review next (1.135 step 2), then the human. **Not executed until the human says so.**
> The four decisions 38 did not take were answered by the human the same day (1.155, §2.14) and
> are folded in; Q3 made the branch's build a **sandbox** beside the human's Menkar (§2.12).
>
> **From:** plan 38 (`plans/38-multi-agent.md`, the design: what and why), decided as D1–D22 in
> `plans/00-STATUS.md` 1.137–1.143; 1.135 (strategies, never `if`/`else` on the agent), 1.136 (a
> branch in its own worktree), 1.142 (the phases; P0 merges to `main` early), 1.150–1.154 (plan 40,
> the team block: its delivery is one more per-agent concern here; D10 amended by 1.151).
> Research: `plans/ideas/research/agents-compared.md` (cited `cmp §n`), `codex.md`, `cursor.md`,
> `opencode.md`; the consultants' answers of 2026-11-15 to this plan (`codex`: `--add-dir`, telling
> a new thread from a resumed one, `codex queue`; `opencode`: version detection, `serve --stdio`;
> `cursor`: `--new-session-id`) — recorded in their research files or below where they are used.
>
> **Plan 38 stays the design; this is how.** Nothing here repeats 38's reasons: it cites them.
>
> **Precondition: plan 40 is on `main`.** Its team block for Claude (`teamFacts`, `teamBlock`,
> `buildCommand`'s `teamFile`, the `started`/`told` rule) is not built at the time of writing
> (HEAD `5407f37`); this plan cites plan 40's sections as **requirements**, and P0.3 moves what plan
> 40 actually built, read from the tree then. R10's snapshot (P0.1) is taken after plan 40 lands.

## Exit — where each part goes when executed

| Part | Goes to |
|---|---|
| The architecture: the pattern, the module layout, the interfaces per concern, how a kit is chosen, the dependency rules and their check, what was rejected (§2.1–§2.5, §2.15) | New `docs/agents.md`, "How the code is organised" (P0.7); its per-agent sections are added by each phase (P1a, P1b, P2, P3), with plan 38's exit for the rest (38's header: integration per agent, what was rejected) |
| The rule "no agent named outside its folder", its enforcement | `AGENTS.md`'s existing per-agent bullet gains "enforced by `scripts/check-code-rules.mjs`" (P0.7); `docs/toolchain.md`'s checks table gains the rule's row |
| The branch, its worktree, its build, `ui-check` beside `main`'s, fixes flowing in (§2.12) | `docs/toolchain.md`, new section "A long-lived branch" (P0.1); removed into its history when the branch merges for good (close block) |
| R10's snapshot: what it holds, who refreshes it | `docs/toolchain.md`, same section (P0.1) |
| The hand checks per phase | `docs/release-checklist.md`, a section per phase (P0.8, P1a.7, P1b.6, P2.7, P3.5) |
| The readers' rules (incremental reading per agent, SQLite read-only, zstd, rewritten transcripts) | `docs/sessions.md` and `docs/usage.md`, a line each pointing to `docs/agents.md` (P1a, P2, P3) |
| Menkar's `opencode serve`, the proxy | `docs/agents.md`, OpenCode; `docs/session-control.md`'s port rejection amended, the old text to its history (P2.7, plan 38's exit) |
| The shipped hook and notify programs | `docs/packaging.md` (P1a.4, P3.3) |
| `smol-toml`, the one new runtime dependency | `docs/toolchain.md`'s dependency list, with its reason (P1a.2) |
| The engines floor (`>=22.15.0`, for zlib's zstd under Vitest) | `package.json` and `docs/toolchain.md` (P1a.3) |
| 1.155 (Q1–Q4): its "where it lives" | `plans/00-STATUS.md` 1.155 points at `docs/agents.md` (Q1, Q2), `docs/sessions.md` (Q4) and `docs/toolchain.md` (Q3, the sandbox) |
| The sandbox flavour: what differs, what is still shared and how it is kept safe (§2.12) | `docs/toolchain.md`, "A long-lived branch"; the package side to `docs/packaging.md`, "The sandbox package" (P0.0) |
| What is deferred (§3) | `docs/NOT_BUILT_YET.md`, each with its trigger (close block) |
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

### What exists (verified at `5407f37`)

- **The agent is a string union written out in seven places:** `Agent` (`src/core/sessions/lines.ts:1`),
  `PaneAgent` (`src/shared/workspace.ts:12`), `agents` (`:118`), `startNew.agent` (`:233`),
  `ChatAgent` (`src/core/chat/variants.ts:3`), `provider` (`src/main/panes.ts:7`, `:62`), the
  renderer's `Agent` (`src/renderer/addsession.ts:22`), `installedAgents`
  (`src/main/workspace.ts:277`).
- **The name checks: 60 lines at this HEAD** (`grep -rn "'cursor'\|=== 'claude'\|!== 'claude'" src`):
  `src/main/workspace.ts` 18, `src/renderer/addsession.ts` 8, `src/core/sessions/` 15 (transcript 4,
  scanner 3, lines 2, badges 2, head 2, names 1, service 1), `src/core/chat/` 4,
  `src/core/agentstate/detect.ts` 3, `src/renderer/app.ts` 3, `src/shared/workspace.ts` 3,
  `src/renderer/sessionmenus.ts` 2, `src/main/panes.ts` 2, `src/core/command.ts` 1,
  `src/main/remote-live.ts` 1. The grep misses more that P0.2's rule finds: the literal
  `agent: 'claude'` in actions (`workspace.ts:1531`, `:1658`, `:2938`, `:2988`,
  `src/renderer/orchestration.ts:412`), property accesses by name (`AGENT_COMMANDS.cursor`,
  `workspace.ts:2291`; `installed.claude`, `scanner.ts:204`) and the usage cache's `claude`
  property (`src/core/usage/cache.ts:412`, the `names.claude` column).
- **"Unknown means Claude" in two places that matter:** `resumeSpec` resumes a session main does
  not know as Claude (`workspace.ts:2249`, `info?.agent ?? 'claude'`), and `agentName` reads
  anything not Cursor as Claude (`:288`). **Saved state holds no agent at all**: a saved tab is
  session ids (`SavedTab`, `src/core/projects/model.ts:73`), a member is a session id; the only
  agent value saved is `last_agent` (`src/core/settings.ts:29`). So plan 38 §3.6's hazard is
  concrete: a Codex tab saved by the branch's build would run `claude --resume <codex-id>` on
  `main`. P0.6's tolerance answers it (§2.4).
- **Tabs restore after the first scan** (`startShownTabs`, `workspace.ts:722`, gated on
  `sessionsLoading`), so an unknown id at restore means "no reader found it", not "not scanned yet".
- **A new session whose id is unknown** (Cursor today, `workspace.ts:2392`) waits as a `Pending`
  (`src/core/sessions/join.ts`) and joins when a transcript with a typed message appears.
- **`buildCommand`** (`src/core/command.ts:53`) gates every Claude option on `agent === 'claude'`;
  `startPaneHeld` (`workspace.ts:790`) builds the options inline, `--settings`, `--mcp-config` and
  `--plugin-dir` Claude-only (`:818–830`).
- **The scanner** reads JSONL files only (`src/core/sessions/scanner.ts`): `claudeTranscripts`,
  `cursorTranscripts`, an incremental per-file state (inode, offset, head, tail). `SessionInfo.file`
  (`src/core/sessions/info.ts`) is used by main for the context tracker (`workspace.ts:618`),
  `lastReply` (`:1745`), details (`:3040`), export (`:3061`), "show in folder" (`:3072`), trash and
  delete (`:3082–3083`).
- **Usage:** `runPass` (`src/core/usage/pass.ts`) ingests Claude's transcripts into a derived cache
  (`usage-cache`, `SCHEMA_VERSION = 1`, rebuilt when its version differs) and writes the history
  (`HISTORY_VERSION = 3`, never rebuilt). `UsageHistory.write` needs only four methods of the cache
  (`pending`, `turnUsage`, `names`, `written`, `history.ts:224–297`); the classifier reads a turn's
  bytes through `extent`/`previousHuman` (`src/core/classifier/turns.ts`). Exact cost comes from the
  statusline's running totals (`readStatusline`, `src/core/usage/statusline.ts:68`), applied over
  the price table's estimate per session (`report.ts:118–136`).
- **State:** `detectState(provider, …)` (`src/core/agentstate/detect.ts:103`) branches on the name;
  a turn's end comes from Claude's Stop hook as a record in `turnEndsDir()`
  (`src/core/context/statusline.ts:53`), read by `src/main/control.ts:81`.
- **Menkar's MCP:** `answer` (`src/core/control/protocol.ts:304`) lists one constant `TOOLS`,
  `capabilities: { tools: {} }`; the caller is `MENKAR_PANE` (`server.ts:37`); `handleControl`
  refuses any non-Claude pane (`workspace.ts:1136`); `resume_session` too (`:1259`); `wakeSession`
  is Claude's socket only (`:1810`).
- **Environment:** `SESSION_ENV` / `withoutSessionEnv` (`src/core/sessionenv.ts`), Claude's
  variables only.
- **The shape-rule checker exists**: `scripts/check-code-rules.mjs` parses with the TypeScript
  compiler (the clock, `src/core` imports, `any`); `tests/core/shortcut-handlers.test.ts` is the
  precedent of a literal rule with an `ALLOWED` map, each entry with its reason.
- **`scripts/check-test-integrity.mjs`** fails on any removed `expect(` line, with no override,
  against `MENKAR_TEST_BASELINE` (default `main`). **So P0 rewrites no existing test line holding
  `expect(`** (§2.11).
- **Node:** Electron 45.2.3 runs Node 24.22.2; Vitest runs the system Node (22.21.1 here,
  `engines: >=22.12.0 <23`). `zlib.zstdDecompressSync` exists in both (checked 2026-11-15); it
  appeared in Node 22.15.
- **SQLite read-only, measured here (2026-11-15, node:sqlite on Node 22.21.1, a WAL database whose
  writer had closed):** `new DatabaseSync(path, { readOnly: true })` **creates `-shm` and `-wal`
  and leaves them** after close; `file:<path>?immutable=1` read-only creates nothing; a plain
  read-only open while a writer holds the database adds no file (the writer's own are there).
  §2.6's reader rule follows from it.
- **Stand-ins** are inline in `e2e/fixtures.ts` (a `claude` that records `claude-args.txt`, a
  messaging socket); `e2e/path.ts` builds the closed PATH.

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
- **What the renderer needs is data**: `AgentDescriptor` (id, the CLI's command name, label key,
  glyph, capabilities), in `src/core/agents/<id>/descriptor.ts`, importing nothing from Node, so
  the renderer reads `descriptorOf(info.agent).caps.fork` instead of `info.agent === 'claude'`.
- **Shared mechanisms stay shared and are fed by the strategies**: one turn-end record format, one
  way a pending pane binds its id, one wake batcher, one Usage history, one MCP server program, one
  team-block rule (§2.5). The strategy produces or consumes; the mechanism never asks who.

**Why this and not the alternatives** (each with what it would break):

- **A class hierarchy** (`abstract class Agent`, `class Codex extends Agent`): a fix in a base
  method reaches every agent, which is exactly the coupling the human ruled out; and the concerns
  vary independently (Cursor shares Claude's `--plugin-dir` mounting but nothing else).
- **Capability flags read in shared code** (`if (caps.lateId) … else …`): still `if`/`else` on the
  agent, one step removed; every new agent edits shared code. Flags are kept only for what the
  **renderer** shows (menu entries), where the alternative would be shipping functions to it.
  **Shared code may test whether a concern is `null`** (the type forces it: no MCP mount → refuse
  Menkar's tools); it never tests which agent it is, nor a flag that stands for one — a question
  with an agent-specific answer is a method of the strategy (`ids.newId()` returns a UUID or
  `null`, not `kind === 'chosen' ? randomUUID() : null` in `workspace.ts`).
- **One interface for everything** (`interface Agent { … 40 methods }`): every agent stubs what it
  lacks, and a stub that returns a plausible value hides a missing feature; per-concern interfaces
  with `null` make "Cursor has no context" a type the caller must handle.
- **Loading agents dynamically (plugins)**: no consumer; four agents known at build time.

### 2.2 Where the code lives, and the rules a test holds

```
src/core/agents/
  ids.ts            AgentId, AGENT_IDS (order offered), DEFAULT_AGENT, parseAgentId(value) → AgentId | null
  types.ts          the interfaces of §2.3 (types only)
  registry.ts       kitOf, descriptorOf, DESCRIPTORS — the only importer of the agent folders (core)
  shared/           helpers several agents use: JSONL slices, the SQLite read-only open (§2.6),
                    zstd, the turn-end record writer; imports no agent folder
  claude/  cursor/  codex/  opencode/
                    descriptor.ts (renderer-safe), launch.ts, catalog.ts, usage.ts, state.ts,
                    env.ts, mcp.ts, team.ts, names.ts, writes.ts, … index.ts (the kit)
src/main/agents/
  registry.ts       mainKitOf — the only importer of the main agent folders
  shared/           e.g. the wake router's helpers
  claude/  cursor/  codex/  opencode/
                    waker.ts, prepare.ts (calls before the command), server.ts/proxy.ts (OpenCode),
                    namer.ts (Codex's app-server), index.ts
```

Programs an agent runs (Codex's `notify`, Cursor's hooks) are entries in
`electron.vite.config.ts` beside `statusline` and `mcp-server`, their source in the agent's core
folder (`src/core/agents/codex/notify.ts`), so they run as plain Node with no Electron.

**The rules, in `scripts/check-code-rules.mjs`, parsed with the TypeScript compiler** (AGENTS.md:
a shape rule is a parse, not a grep):

| Rule | What it forbids | Where it does not apply |
|---|---|---|
| `agent-literal` | A string literal (or no-substitution template) whose whole text is an agent id or an agent's CLI name (`'claude'`, `'cursor-agent'`, `'codex'`, `'opencode'`, …, read from `ids.ts` and the descriptors by the script itself) | The agent's own folders, `ids.ts`, the two registries, `tests/`, `e2e/` |
| `agent-property` | A property access, element access with a literal, object-literal key or type-literal key named as an agent id (`AGENT_COMMANDS.cursor`, `{ claude: … }`, `installed.claude`) | Same |
| `agent-import` | An import of `agents/<id>/…` from anywhere but its registry; an import from `agents/<id>/` into `agents/<other>/`; an import of an agent folder from `agents/shared/` | — |

An `ALLOWED` map (`'<file>:<text>': '<reason>'`, as `shortcut-handlers.test.ts`) holds the
exceptions. P0.2 starts it with **every current site**, each reason "moved in P0.n"; each P0
block empties its lines; **P0.7 leaves it holding only reasons that are not agent behaviour**, e.g.
the classifier's own model provider (it runs `claude -p` whatever the session's agent, D19:
the classifier kit is chosen as `kitOf(CLASSIFIER_AGENT)`, so even that is a registry lookup and
the map may end empty). `tests/scripts/check-code-rules.test.ts` gains a case per rule, each seen
failing once on an injected line.

### 2.3 The interfaces, checked on paper against the four agents

`types.ts` declares them; the cells are each agent's implementation. **m/r/i** as in `cmp`.
Names are the plan's; an executor may rename a member, not merge two concerns.

| Concern (interface, side) | Claude | Cursor | Codex | OpenCode | Pressure on the seam |
|---|---|---|---|---|---|
| **Descriptor** (data, core, renderer-safe) | `claude`, ✳, caps: remote, fork, trash, chat, context, ids chosen, named at start | `cursor-agent`, ➤, caps: trash, chat; P3: ids chosen (`--new-session-id`, m) | `codex`; caps: context; ids **late**; named **after first turn** | `opencode`; caps: context; ids chosen (`POST /api/session {id}`); named at start; **needs Menkar's server** | Capabilities are data the renderer reads; shared main code reads strategies, not flags |
| **Launcher** `plan(start, ctx) → LaunchPlan` (core, pure): `{ words, env, files }` | today's command; plan 40's `--append-system-prompt-file` | today's (`--resume`); P3: prompt, `--model`, `--new-session-id`, per-pane `--plugin-dir` | `codex [resume <id>] [-m] [--add-dir] -c notify=… -c mcp_servers.menkar.… -c developer_instructions=… "<prompt>"` (cmp 1.1, codex answer 2026-11-15: `--add-dir` exists, r) | `opencode --server <proxy url> -s <id> --prompt "<p>"`, password in `env` | `LaunchPlan.files` are written before the command (the team file, a per-pane plugin folder); `ctx` carries the MCP mount, the team block, the prompt file, add-dirs |
| **Preparer** `prepare(start, ctx) → Promise<Prepared>` (main) | none | none | none | `session.create {id, title, model}`, the instruction entry PUT, the MCP added for the folder (D20) | Only OpenCode makes calls before its command: the seam is async and main-side, and `null` for the others |
| **SessionCatalog** (core): `find`, `read(found, prev)`, `watchTargets`, `lastReply`, `details`, `exportMarkdown`, `location`, `trash \| null` | JSONL per file, today's reader | rewritten JSONL (cmp 1.2): head and tail re-read on any change, never an offset trusted | rollouts by date + `session_index.jsonl` names + `.zst` older than 7 days | **rows in `opencode.db`**, no file per session: `location` → `null`; watched through the database's files | `find` returns `Found { id, locator, folder, cwd? }` — `locator` is a path for file agents and `opencode.db#<id>` for OpenCode; only the agent's own catalog interprets it |
| **UsageSource** (core): `open(paths) → TurnSource { ingest, pending, turnUsage, names, written, turnText, close }` | today's `UsageCache`, its file untouched | P3: the hook log (Menkar's own file) + transcript text | own cache file; `task_started`/`task_complete`, `token_count` | own cache file; rows; cost lines (§2.5) | `UsageHistory.write` takes a `TurnSource` (the four methods it already uses); `runPass` loops the installed agents' sources |
| **StateRules** `detect(title, screen) → RawState` (core, pure) | `detect.ts`'s `claude` | `detect.ts`'s `cursor`; P3: the trust prompt | M16 strings; **the composer alone never means idle** | screen strings + server events (main) | Pure, so each agent's rules have their own fixtures |
| **TurnSignal** (where a turn's end comes from) | Stop hook in `--settings` → record | P3: `stop` hook (D13) → record | `notify` program (D6) → record, pane passed as an argument | server events in main → record | **One record format** in `turnEndsDir()`; the producer is the agent's; the consumer (`control.ts:81`) is shared |
| **IdBinding** (core): `newId() → string \| null` (a chosen id, or `null` when the agent's is late), `isRealId(id)`, `classify(previous, next) → 'clear' \| 'resume'` | chosen; SessionStart's `source` | chosen (P3) | **late**: the first record with a real id binds the pane; a thread id with no rollout is the title thread, ignored (codex M13); `/new` → a rollout created after the pane's start = `clear`, else `resume` (codex, 2026-11-15, m) | chosen; `/new` from the proxy (D14) | Binding by record is shared; what counts as real and which kind of change is the agent's |
| **Waker** `wake(target, text) → Promise<WakeOutcome>` (main) | socket post (`postToSession`) | `followup_message` at `stop`; idle + empty box → end-and-resume; else held (D1) | `codex queue --thread <uuid> --message` (codex, m), `CODEX_HOME` from the env | inbox `POST …/prompt {delivery:"queue"}` | The batcher (`WakeBatcher`) and the frame are shared; the transport is the kit's |
| **McpMount** (core) + caller | `--mcp-config`, `MENKAR_PANE` inherited | P3: per-pane `--plugin-dir` folder `…/<pane>/menkar/.mcp.json` (one basename, cmp 1.4) | `-c mcp_servers.menkar.{command,args,env}` with `MENKAR_PANE` in `env` | per folder on Menkar's server (main, 1.141); caller from `_meta["ai.opencode/sessionID"]` through the proxy | The server program reads the caller from `MENKAR_PANE` or from a `_meta` key the descriptors list (`callerMetaKeys`), so the server names no agent |
| **TeamDelivery** (core + main) | `--append-system-prompt-file` (plan 40 §2.3); resume holds **current** (snapshot off) | P3: `sessionStart` hook's `additional_context`; resume holds **recorded** (frozen at creation) | `-c developer_instructions`, chaining the user's own; resume holds **recorded** until compaction | instruction entry; **server**: a change arrives by itself | `holds: 'current' \| 'recorded' \| 'server'` decides the shared rule: `recorded` persists `told` per session (§2.5); `skillRef` says how a skill is named in the block (a name, or a `SKILL.md` path for Codex, 1.155) |
| **Namer** (core + main) | at start (`-n`) | Menkar-held for workers (D22) | after the first turn, `thread/name/set` (main, D5/1.139) | at start (`title`) | `kind` + an async main hook for Codex only |
| **EnvRules** (core, data) | today's `SESSION_ENV` | §1.7 of `cursor.md`, marker `CURSOR_AGENT` | `CODEX_THREAD_ID`, … | `opencode.md` §1.7 | `withoutSessionEnv` applies **every** registered agent's rules (Menkar may be started from inside any agent), not the started one's |
| **ContextSource** (core) | the statusline (today) | `null` (D8) | `token_count` from the rollout tail | `GET …/context` (main) | `null` is a type the sidebar handles |
| **IntegrationItems** (core + main) | statusline, retention (today) | D13 hooks, D7 allow entries | none | none | Items greyed when the CLI is not found (1.140) |
| **DeclaredWrites** (core, data) | `-n` | D7, D13 files | `session_index.jsonl`/`threads.name` (D5), `queue_1.sqlite` rows | `opencode.db` session row, inbox rows | The R9 test's allow-list per agent, and `docs/agents.md`'s list (D17) |
| **ChatStrategy** (core + main) | today's variant | today's two | `null` | `null` | Today's `VARIANTS` and `AGENT_CLIS` move into the kits |

**Codex's late id, OpenCode's server-held sessions, SQLite stores and Cursor's consent-gated hooks
each land on one seam above and none forces a branch in shared code**: the late id on IdBinding,
the server on Preparer + Waker + the main-side TurnSignal, SQLite on SessionCatalog/UsageSource
through `agents/shared`'s read-only open, the consent on IntegrationItems (without the item,
Cursor's TurnSignal produces nothing and its Waker falls back to end-and-resume, D1).

### 2.4 Choosing once, and the unknown agent

- **`parseAgentId(value)`** is the one way a saved or received string becomes an `AgentId`;
  unknown → `null`. Used for `last_agent`, `session_agents`, an IPC action's `agent`, a
  `start_session`'s `agent` argument.
- **`session_agents`** (new key of `state.json`, carried by `parseState`'s `rest` as every newer key
  is, `src/core/state.ts:6`): `{ "<session id>": "<agent id>" }` for **every session Menkar starts or
  resumes whose agent is not `DEFAULT_AGENT`**, written when its pane starts. Claude sessions are
  never written, so a Claude-only user's `state.json` does not change. Pruned with the session
  (trash, delete).
- **Restoring a tab** (`resumeSpec`): the agent is `SessionInfo.agent` when a reader found it; else
  the recorded `session_agents` value; else `DEFAULT_AGENT` (today's behaviour, for a Claude
  session whose transcript is gone). **A recorded value this build does not know** (`parseAgentId`
  → `null`) starts **no agent**: the tab is restored with one line in its pane, through
  `t()` — "[Menkar] This session's agent (‹id›) is not supported by this version of Menkar." — and
  the tab and its session stay saved untouched (1.155, Q4).
- **New agent values are never read as another agent anywhere**: `agentName` and every `?:` on the
  agent go through `descriptorOf`, which has no default.

### 2.5 The shared mechanisms the strategies feed

1. **Turn-end records.** One format (today's, `turnEndsDir()`), written by every agent's producer
   through `agents/shared`'s writer: `{ pane, session_id, at }` plus optional `tokens` and
   `last_reply` (Codex's `notify` and Cursor's `stop` carry them; read by the agent's UsageSource
   and catalog, never by shared code). A **parity test** between the writer's keys and
   `control.ts`'s reader (AGENTS.md: an enum that crosses a boundary).
2. **Binding a late id.** A pane with no session (`Pending`, `join.ts`) binds on the first
   turn-end record naming it whose id its kit's `isRealId` accepts — before any transcript guess.
   For a session `start_session` starts (P1b) the pane holds a **provisional id**
   `pending:<pane-id>` as member, child and assignee, re-keyed to the real id through the path a
   `/clear` uses today (`followNewIdInLayout`, the follow functions of `followPaneStart`), which is
   plan 38 §3.3's "by its pane". A provisional id is never resumed: on load, one left over (Menkar
   quit before the first turn) is dropped with `forgetSession` and a log line.
3. **Waking.** `wakeSession(parent, text)` keeps the batcher, the counts and the frame; it calls
   `pane.kit.waker.wake(...)`. The bridged frame (38 §3.1) is built once in `src/core/control/`.
4. **Caller identity.** `ControlRequest` gains `caller: { pane } | { agentSession: { meta, id } }`;
   main resolves an `agentSession` caller through the OpenCode proxy's map (P2). P1b builds the
   shape; only P2 fills the second branch.
5. **Usage.** `runPass` opens one `TurnSource` per installed agent with a UsageSource and writes
   each into the one history (no schema change, 38 §3.6). **Turn uuids are prefixed by the agent's
   id for every agent but Claude** (`codex:<turn id>`), so no two agents can collide on the history's
   primary key, and Claude's rows keep today's bytes. **Each new agent's derived cache is its own
   file** (`usage-cache-<id>.sqlite`): Claude's cache keeps `SCHEMA_VERSION = 1`, so `main` and the
   branch never rebuild each other's (a shared file with new tables would). **Exact cost** where an
   agent has it (OpenCode, `cmp 1.2`) is appended by its source to a Menkar-owned log in the
   statusline log's format (`at`, `session_id`, running `cost_usd`), `usage-<id>.jsonl` in the
   cache directory, and passed to `buildReport` among `statuslineLogs` — so `readStatusline` and
   `report.ts:118` stay as they are. Codex's cost is the price table's, marked `~` (D15).
6. **The team block** (plan 40 §2.2–§2.4) is assembled as plan 40 builds it, the per-agent part
   read as data (`plugin/team/<id>.md`); what differs is delivery (TeamDelivery). Plan 40's
   `started`/`told` rule holds for all; **`holds: 'recorded'`** (Codex, Cursor) adds a persisted
   `told` per session (`controlPaths().teamTold/<session>.txt`, in the flavour's cache, written whole, swept with
   the session), because those agents keep the block recorded at creation across a resume: on a
   resume, facts equal to the persisted `told` → nothing; different → the facts are posted once the
   pane can be woken. **`holds: 'server'`** (OpenCode) never posts: a change updates the entry.
7. **Environment.** `withoutSessionEnv` takes the union of every kit's `EnvRules` (identity always
   stripped; marker-gated variables only when that agent's marker is inherited, 38 §3.5).

### 2.6 The readers

- **Incremental reading per agent** is the catalog's and the usage source's own business, behind
  `read(found, prev)` / `ingest()`:
  - **Claude**: today's (offsets, slices of 4 MB, head and tail windows).
  - **Cursor's transcripts are rewritten** (cmp 1.2): the catalog keys its state by size and mtime,
    re-reads the head and tail windows on any change, never trusts an offset. Cursor's Usage reads
    no transcript bytes by offset: its turns come from the hook log (Menkar's own, append-only) and
    a turn's text for the classifier is the hook's prompt text kept in that log.
  - **Codex**: a rollout is append-only while live and compressed to `.zst` after 7 days. The usage
    cache keys a file by its path; a `.zst` that replaces an ingested `.jsonl` (same thread id) is
    **recognised by the thread id and not re-ingested** (its turns are already in the history);
    a `.zst` never seen is decompressed whole (`zlib.zstdDecompressSync`, off the UI path — the
    usage worker), once. The classifier's `turnText` for a compressed rollout decompresses it.
  - **OpenCode**: rows, read by `time_updated` greater than the last one seen.
- **SQLite read-only, without writing beside the agent's database** (§1, measured): `agents/shared`'s
  `openAgentDb(path)` opens `file:<path>?immutable=1` read-only when no `<path>-wal` exists (no
  writer), else a plain read-only open, closed at once after the query; never held open across
  passes. Its test is R9's (below), with a writer process and without.
- **Large and growing**: no reader holds a whole JSONL; Codex's `.zst` is bounded by one rollout.

### 2.7 OpenCode's server and proxy (P2)

- **Started** with the first OpenCode tab as `opencode serve --stdio --port <random free port>`,
  `OPENCODE_PASSWORD` and `OPENCODE_CONFIG_CONTENT` in its env, **its stdin held by main**: it exits
  when its stdin closes, so a Menkar crash leaves no orphan (`opencode`, 2026-11-15, m, research
  items 35–37), and in stdio mode it removes the password from what its MCP servers inherit.
  Stopped by PID with the last OpenCode tab and on quit.
- **Version check by feature**: `GET /openapi.json` lists the experimental instruction route; without
  it, the team block for OpenCode is not delivered and a log line says why (`/api/info`'s version
  only for the log).
- **The proxy**: one loopback port per OpenCode pane, forwarding to the server, adding no
  credential; it reads `POST /api/session/<id>/view` and `…/prompt` to know the pane's session
  (D14, m oc M29), and gives main the `{ id → pane }` map for the caller (§2.5.4).
- **A restart of the server with TUIs attached** (it died): main restarts it on the same port;
  the TUIs reconnect or show their own error; a test asserts main restarts it once and logs, and
  does not loop (one retry per 30 s).

### 2.8 Reading `~/.codex/config.toml` (D6, the team block's chaining)

Menkar reads the user's `notify` (an array of strings) and `developer_instructions` (a string,
possibly multi-line) from `$CODEX_HOME/config.toml` (default `~/.codex`), honouring a top-level
`profile = "<p>"` whose `[profiles.<p>]` table overrides them. **`smol-toml` (pinned, BSD-3-Clause,
no dependencies)** parses it: the new runtime dependency, justified because a wrong parse of the
user's file means chaining a wrong command or dropping their own instructions silently, and TOML's
strings (escapes, literal and multi-line forms) are what a one-key parser gets wrong. Read only;
a file that does not parse → no chaining and a log line, never a refused start.

### 2.9 Programs shipped

- **Codex's `notify`**: `-c notify=["<electron>","<resources>/codex-notify.cjs","--pane","<pane>","--chain","<json of the user's notify>"]`
  with `ELECTRON_RUN_AS_NODE=1` in Codex's environment for it — it writes the turn-end record, then
  runs the user's own `notify` with the same argument Codex gave, waiting at most
  `CHAINED_TIMEOUT_MS` (as the statusline chains, `src/core/context/statusline.ts:20`).
- **Cursor's hooks** (P3): one program for `beforeSubmitPrompt`, `stop`, `afterAgentResponse`,
  `sessionStart`; it exits at once without `MENKAR_PANE` (1.140); it writes turn records and the
  tokens to Menkar's hook log, **never `user_email`** (D21: a test feeds a payload holding it and
  asserts no file and no log line contains it); for `stop`, it answers a held wake as
  `followup_message`.
- Both are `electron.vite.config.ts` entries and `scripts/check-package.mjs` requires them in the
  .deb (`docs/packaging.md`).

### 2.10 Tests

- **R10, the byte snapshot (38 §2)**, P0.1, **taken on `main` after plan 40 lands**, in
  `tests/core/r10.test.ts` with file snapshots (`toMatchFileSnapshot`) under `tests/core/r10/`:
  - `buildCommand` for Claude: new (with id, name, model, remote, prompt file, add-dir), resume
    (with remote), fork; each with the mode off and with a team file (plan 40); Cursor new and
    resume;
  - the `--settings` file's bytes (`sessionSettingsFile`'s content builder);
  - `initialize`'s and `tools/list`'s replies from `answer` (`protocol.ts:304`);
  - what a Claude session is given of the plugin: `plugin/skills/**` and `plugin/guide/**` (list and
    bytes) and plan 40's `plugin/team/common.md` and `claude.md` — not the whole folder, which
    gains other agents' team parts (`plugin/team/codex.md`, …) that no Claude session reads;
  - `wakeFrame`'s bytes for a fixed text, id and counts; `WAKE_DELAY_MS`;
  - `withoutSessionEnv` on a fixed environment holding every listed variable and a few of the user's;
  - `watchedDirs` and the scanned roots with only Claude installed, and with Claude and Cursor;
  - the usage cache directory's file list after a pass with only Claude installed.
  And **`e2e/r10.spec.ts`**: with the stand-in `claude` alone on the PATH, the app's descendant
  processes (by `/proc`) are the expected set and **no socket of the app's processes listens**
  (`/proc/net/tcp*` against the processes' inodes). R10's Cursor rows guard P0–P2 only (38 §2): P3
  changes Cursor's command on purpose, so the Cursor rows are their own snapshot files
  (`tests/core/r10/cursor-*`): P3.2 rewrites those files' contents (never an `expect(` line), with
  `set`'s sign-off — the one branch-side write of R10's snapshot; a later merge of `main` keeps the
  branch's Cursor files.
- **Contract tests per concern, run over every registered agent** (`tests/core/agents/contract/`):
  each agent's fixtures in `tests/data/agents/<id>/` (a scripted conversation of two turns, a name,
  a tool call) and one `expected.json`; the catalog, usage source and state rules of every agent
  are asserted against it. **These are the parity tests per reader**: the same conversation gives
  the same normalised result (two turns, the preview, the last reply, tokens per turn) whatever the
  agent's format.
- **R9's no-write test** (38 §2), one per agent, from `DeclaredWrites`: every file under the agent's
  home keeps its bytes and mtime and the tree its listing, except the declared paths; with a writer
  process holding the database and without (§2.6).
- **Stand-ins per agent** (`e2e/standins/<id>.ts`, a script text and helpers, beside today's inline
  `claude`): `codex` (writes a rollout and `session_index.jsonl`, calls the `-c notify` command it was
  given, serves `codex queue`, records its arguments); `opencode` (a small HTTP server: session
  create, view, prompt with `delivery: queue`, the instruction route, `/openapi.json`, events; and a
  TUI mode that connects to `--server`); `cursor-agent` (P3: fires the plugin's hooks, writes a
  rewritten transcript).
- **The real-agent checks**, before a phase merges or is called validated: each consultant
  (`claude-cli`, `cursor`, `codex`, `opencode`) runs the branch's build against the real CLI **in a
  throwaway home** (their research files' method) and reports by name; a task on the Board each
  (1.148). What each checks is in the phase's last block.

### 2.11 P0 without rewriting a test

`check-test-integrity` refuses any removed `expect(` line, with no override. So **P0 keeps every
function the existing tests call, with its signature**, as a thin facade over the registry
(`buildCommand(agent, start, options)` → `kitOf(agent).launch.plan(...)` joined into today's
string; `readHead(head, agent)`, `badgeOf(tail, agent, …)`, `detectState(provider, …)` the same).
A facade names no agent: it looks the kit up by the value it was given. New tests for the moved
code are added beside the agent's folder; old ones stay where they are and keep passing — which
is also R10 at the unit level. Where a facade would be wrong (a test asserts the old shape on
purpose), the block stops and asks `set`.

### 2.12 The branch and its worktree (1.136)

- **Branch `multi-agent`, worktree `/home/hernan/git/menkar-multi-agent`**, created by `set` from
  `main` once plan 40 is on `main` (1.136: `set` creates it). Nobody checks out another branch in the
  shared tree.
- **Its own `node_modules`** (`npm ci`, which runs the Electron rebuild of `node-pty`), its own
  `out/`, `release/` and `test-results/`. `ui-check` already runs on its own displays per worker
  (`docs/toolchain.md`, "Running in parallel"), so `main`'s and the branch's runs do not collide on
  screens; **they share the machine's CPU**: a session does not start a full `ui-check` in one tree
  while one runs in the other (it asks `set`).
- **The test-integrity baseline is the current branch**: `scripts/ci.mjs` sets
  `MENKAR_TEST_BASELINE` to `git rev-parse --abbrev-ref HEAD` when unset (on `main` that is `main`,
  today's behaviour); in the worktree it is `multi-agent`. P0.1 does it.
- **Fixes flow in, never out**: a fix lands on `main` (and ships), and `set` merges `main` into
  `multi-agent` (a merge, not a rebase: other sessions hold the worktree). **R10's snapshot is only
  ever written on `main`**: when a fix on `main` changes a snapshotted output, it is refreshed in
  that `main` commit; the branch receives it by the merge. A branch session never runs the R10 test
  with `-u` (Do not touch).
- **P0 merges into `main`** at P0.8 (1.142), with its .deb; the branch continues from there.
**The human's build of the branch is a sandbox (1.155, Q3).** The human works on `main`'s Menkar
every day; the branch's build must not be able to touch it. So the branch is built in a second
**flavour**, installed **beside** `menkar` as its own package:

- **One build-time constant** (`src/core/flavor.ts`, from a Vite `define` the build sets;
  `menkar` when unset) gives: the state directories' name (`menkar-sandbox` under
  `$XDG_CONFIG_HOME`, `$XDG_CACHE_HOME`, `$XDG_DATA_HOME`: `src/core/paths.ts`'s `APP`), the files
  folder (`~/Menkar-sandbox`, `filesRoot`), the CLI's name (`menkar-sandbox`), the window title and
  About ("Menkar Sandbox", through `t()`). Electron's user data lives under the cache directory
  (`electronUserData`, `src/main/index.ts:92`), and `requestSingleInstanceLock` is keyed on it, so
  **the single-instance lock is the flavour's own** with no further code (without the flavour, the
  sandbox would hand its launch to the running `main` instance — `packager`, 2026-11-15). The
  statusline, MCP server and hook programs are built with the same constant, so each writes into
  its own flavour's directories. **With the constant unset every output is today's** (R10 holds on
  `main`).
- **The package** `menkar-sandbox`, from a second config, `electron-builder.sandbox.yml` (`extends:
  ./electron-builder.yml`). `packager` read app-builder-lib's templates (2026-11-15): the
  post-install, post-remove and AppArmor templates follow `executableName` and the sanitized product
  name, so `/opt/Menkar-sandbox/menkar-sandbox`, `/usr/bin/menkar-sandbox`, the alternatives name,
  `/etc/apparmor.d/menkar-sandbox` and the icon's file are disjoint from `menkar`'s, and each
  post-remove unloads only its own profile. **Four names do not follow and are set explicitly**,
  each a P0.0 test on the built package's metadata: `deb.packageName: menkar-sandbox` (without it
  both packages are `Package: menkar` and apt installs the sandbox **as an upgrade replacing the
  human's Menkar**); `extraMetadata.desktopName: menkar-sandbox.desktop` (else both ship
  `/usr/share/applications/menkar.desktop`, dpkg refuses the conflict, and their windows group as
  one app); its own `artifactName` (else it overwrites `main`'s .deb in `release/`); its own
  `appId`. `scripts/package.mjs` and `scripts/check-package.mjs` take the flavour as an argument
  (both hard-code `/opt/Menkar` today), with a recorded sandbox variant in `tests/data/package/`.
  **A second AppArmor profile and `/usr/bin/menkar-sandbox` are installed outside `/opt/Menkar`**:
  `docs/packaging.md`'s rule wants that recorded in STATUS before the code — it follows from 1.155,
  and `set` records it (P0.0 waits on it).
- **What is still shared, and how it is kept safe:**
  - **The agents' own data** (`~/.claude`, `~/.codex`, `~/.cursor`, OpenCode's): the sessions the
    sandbox starts are real sessions, written there by the agents. `main` lists the sandbox's
    Claude and Cursor sessions in Add session and counts their tokens in Usage as unfiled (they are
    real use); it never adds them to a project by itself. Codex and OpenCode sessions stay invisible
    to `main` until the merge. Nothing else of the sandbox's reaches `main`'s directories.
  - **`~/.claude/settings.json`** (`main`'s statusline integration, if installed): a session the
    sandbox starts gets the sandbox's own statusline through `--settings`, which outranks it; but
    Menkar's statusline **chains** the user's (`chainedCommand`, `src/core/context/settings.ts:102`),
    which would be `main`'s, and `main`'s would then log the sandbox's sessions into `main`'s
    `usage.jsonl`. So **a flavour never chains to a Menkar statusline** of any flavour (recognised
    by its program's file name under a Menkar resources folder), a test in P0.0. And only one
    `statusLine` fits that file, so **the sandbox does not offer the items that write
    `~/.claude/settings.json`** (statusline, retention): its integrations page shows them read
    only, "managed by Menkar" — the flavour cannot isolate that file, so it must not write it.
  - **Cursor's global items** (P3, `~/.cursor/hooks.json`): the sandbox's entries name the sandbox's
    hook program, beside any of `main`'s; a pane of a flavour other than the default carries
    `MENKAR_FLAVOR` (set only then, so `main`'s panes keep today's environment), and a hook
    program acts only on panes of its own flavour (P3.3's test: a `main` pane's payload reaching the
    sandbox's program writes nothing). D7's allow entries are the same strings for both.
  - **Claude Code's messaging registry**: the human's `main` sessions can see and message the
    sandbox's (as any local session); wakes go by session id, so neither flavour wakes the other's.
  - **Ports**: OpenCode's server is per Menkar process, on a random port (§2.7).
- **So 38 §3.6's state compatibility is relaxed for the sandbox** (it never reads `main`'s state);
  P0's tolerance (§2.4, Q4) is kept on `main` anyway, and §2.5's choices (own cache files, prefixed
  uuids, no history schema change) stay: they cost nothing and keep the merge simple.
- **Hand checks**: each phase adds its section to `docs/release-checklist.md` (P0.8, P1a.7,
  P1b.6, P2.7, P3.5): what the human does in the sandbox — its own Menkar state, starting empty,
  over their real agents and accounts — and what passes. Only P0.8 is also checked on their own
  Menkar, since P0 is the one phase that ships to `main`.

### 2.13 Who executes what

- **Per-task workers** started by `set` in the worktree (`menkar-t<N>`, 1.118), **at most two at
  once on the branch** (the project's cap is 3, 1.153, leaving one for `main`), **never two on one
  file**: each block lists the files it owns; blocks that share one are sequential (§5's tables).
- **Consultants**, asked by name with short questions while a block runs, and given a task for each
  phase's real-agent check: `claude-cli` (P0, P1b's re-listing stub, every phase's Claude rows),
  `cursor` (P0, P3), `codex` (P1a, P1b), `opencode` (P2). `packager` builds the sandbox .deb for each
  phase's hand check, and `main`'s .deb for P0.8.
- **`set`** reviews each block, commits on the branch, merges P0 into `main`, merges `main` into
  the branch, and runs the gates with the human.

### 2.14 Decisions taken by the human for this plan (1.155, 2026-11-15)

- **Q1** — A Codex session loads a skill by **reading its `SKILL.md`**; the team block names each
  skill by absolute path (Menkar's from the plugin folder, the stored ones from where Menkar found
  them, plan 40 §2.6). No `load_skill` tool, no bodies in `developer_instructions`. → P1b.5.
- **Q2** — The first-time card shows an **agent choice only when two or more agents are
  installed**, defaulting to the last one used (`last_agent`); its place is decided by the human
  with a mock-up in P1b.6. "Ask an agent" (1.95) starts the agent of the project's focused agent
  pane, else `last_agent` (the recommendation taken with Q2). → P1b.6.
- **Q3** — The branch's build is tried in a **sandbox** that cannot touch the human's Menkar
  (§2.12). → P0.0 and every hand check.
- **Q4** — `main` restores a saved tab of an agent it does not know **without starting it**, one
  `[Menkar]` line in its pane, the tab kept untouched (§2.4). → P0.6.

### 2.15 Decisions the code must hold, and their tests

| Decision | Test (written before the code, its comment naming the decision) |
|---|---|
| 1.135: no agent named in shared code | `tests/scripts/check-code-rules.test.ts`: `if (a === 'cursor')` in `src/main/x.ts` → `agent-literal`; `AGENT_COMMANDS.codex` → `agent-property`; `import … from '../agents/cursor/catalog'` in `src/core/agents/claude/` → `agent-import`; the same lines inside the agent's folder → nothing |
| 1.135: a change to one agent cannot break another | `tsc` (the registries are `Record<AgentId, …>`) and the contract suite: `vitest tests/core/agents/contract -t codex` runs Codex alone |
| R10 (38 §2) | `tests/core/r10.test.ts` and `e2e/r10.spec.ts` (§2.10) |
| 38 §3.6 / D16: an unknown agent is never read as another | `tests/core/agents/ids.test.ts`: `parseAgentId('gemini')` → `null`; `resumeSpec` with `session_agents = { s1: 'gemini' }` → no command, Q4's line; with nothing recorded and no reader → `DEFAULT_AGENT`'s resume (today); `agentName('gemini')` impossible by type |
| §2.4: a Claude-only user's `state.json` does not change | P0.6's test: start and resume a Claude session → `session_agents` absent from the written file |
| R9 / D17 | the per-agent no-write tests (§2.10), allow-list from `DeclaredWrites` |
| §2.6: no `-shm`/`-wal` left beside an agent's database | `tests/core/agents/shared/db.test.ts`: a WAL database, writer closed → `openAgentDb` read, listing unchanged; writer open → read, listing unchanged after both close |
| §2.5.5: Claude's usage cache and history bytes unchanged | R10's cache listing; `usage` tests unchanged; a Codex turn's uuid is `codex:<id>` |
| D21: `user_email` never stored | P3.3's hook test |
| D3: when `send_message` and `agent` are listed | P1b.1's `tools/list` table test per caller agent × installed set |
| 1.155 Q3: the sandbox cannot touch the human's Menkar | P0.0's tests: disjoint directories, files folder and package paths; `Package: menkar-sandbox`; no chaining to a Menkar statusline; no `~/.claude/settings.json` item offered |
| D6: the user's `notify` chained | P1a.4: a fixture `config.toml` with `notify = ["x"]` → the program runs `x` with Codex's argument; with a profile override → the profile's |

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

## 4. Do not touch

- R10's snapshot files, from the branch: refreshed only on `main` (§2.12), except P3.2's Cursor files.
- Any existing test line holding `expect(` (§2.11).
- The user's `~/.claude`, `~/.codex`, `~/.cursor`, `~/.config/opencode`, `~/.local/share/opencode`,
  except the consented items and D17's declared writes; the human's own Menkar, config and sessions
  (tests use temporary homes; the consultants use throwaway homes).
- `HISTORY_VERSION`, the history's tables, Claude's `usage-cache` schema and file.
- `wakeFrame`'s format, `WAKE_DELAY_MS`, the counts tail; plan 40's block text.
- `main`'s tree from the branch's sessions: they work in the worktree only.

---

## 5. Execution blocks

Each block: tests first (each naming its decision), the build, then **Verify** — `npm run ci` in the
worktree at least, `npm run ui-check` where it says so, and one injected defect seen failing for
each new check. A block that changes the UI declares its screenshots.

### P0 — Claude and Cursor behind the kits, no behaviour change (merged into `main`)

| Block | Files it owns | After |
|---|---|---|
| P0.0 | `src/core/flavor.ts` (new), `src/core/paths.ts`, `electron.vite.config.ts` (the define), `electron-builder.sandbox.yml` (new), `scripts/package.mjs`, `scripts/check-package.mjs`, `tests/data/package/**` (sandbox variant), `src/core/context/settings.ts` (`chainedCommand`), the integrations page's offer (`src/main/preferences.ts` or its module), `src/core/i18n/{en,es}.ts` (the title), `docs/packaging.md`, `tests/core/flavor.test.ts` | P0.1 (R10 is snapshotted before any change), and the STATUS row for the files outside `/opt/Menkar` (§2.12) |
| P0.1 | `tests/core/r10.test.ts`, `tests/core/r10/**`, `e2e/r10.spec.ts`, `scripts/ci.mjs`, `docs/toolchain.md` | — |
| P0.2 | `src/core/agents/{ids,types,registry}.ts`, `src/core/agents/{claude,cursor}/descriptor.ts`, `src/core/agents/{claude,cursor}/index.ts`, `src/main/agents/registry.ts`, `src/main/agents/{claude,cursor}/index.ts`, `scripts/check-code-rules.mjs`, `tests/scripts/check-code-rules.test.ts`, `tests/core/agents/ids.test.ts`, `src/core/agents.ts` (re-exports, then removed in P0.7) | P0.1 |
| P0.3 | `src/core/command.ts` (facade), `src/core/agents/{claude,cursor}/{launch,mcp,team,env}.ts`, `src/core/sessionenv.ts` (facade over the union), plan 40's `src/core/team/*` delivery parts, `src/main/workspace.ts` (`startPaneHeld` only), `tests/core/agents/{claude,cursor}/launch.test.ts` | P0.2 |
| P0.4 | `src/core/sessions/**` (facades), `src/core/agents/{claude,cursor}/catalog.ts`, `src/core/agents/shared/jsonl.ts`, `src/main/workspace.ts` (details, export, lastReply, location, trash), `tests/core/agents/contract/catalog.test.ts`, `tests/data/agents/{claude,cursor}/**` | P0.3 (workspace.ts) |
| P0.5 | `src/core/agentstate/detect.ts` (facade), `src/core/agents/{claude,cursor}/state.ts`, `src/core/agentstate/notify.ts`, `src/main/panes.ts`, `src/main/remote-live.ts`, `src/main/agentstate.ts`, `tests/core/agents/contract/state.test.ts` | P0.4 (every P0 block edits `ALLOWED` in `scripts/check-code-rules.mjs`, so P0 runs in turn) |
| P0.6 | `src/main/workspace.ts` (the rest), `src/main/agents/{claude,cursor}/waker.ts`, `src/core/state.ts` (`session_agents` helpers), `src/core/i18n/{en,es}.ts` (Q4's line), `e2e/agent-panes.spec.ts` or a new `e2e/unknown-agent.spec.ts` | P0.5 and P0.0 (both write `en.ts`/`es.ts`) |
| P0.7 | `src/shared/workspace.ts`, `src/renderer/{addsession,sessionmenus,app,orchestration,chat}.ts`, `src/core/chat/**`, `src/main/chat.ts`, `src/core/usage/{cache,history}.ts` (the `claude` property → `given`), `src/core/classifier/**` (its kit lookup), `docs/agents.md` (new), `AGENTS.md`, `docs/toolchain.md` | P0.6 |
| P0.8 | `docs/release-checklist.md` | P0.7 |

#### P0.0 — the sandbox flavour and its package (1.155, Q3; `packager` with a worker)

- [ ] Tests first, `tests/core/flavor.test.ts` and `tests/scripts/check-package.test.ts`:
  - flavour unset → `appDirs()` = today's three paths, `filesRoot('')` = `~/Menkar`, the title
    unchanged (R10: nothing differs on `main`);
  - flavour `sandbox` → `…/menkar-sandbox` under each XDG home, `~/Menkar-sandbox`, "Menkar
    Sandbox";
  - `chainedCommand` with `~/.claude/settings.json`'s `statusLine` set to another Menkar's
    statusline command (`/opt/Menkar/resources/…/statusline.cjs`) → `null`; to the user's own
    script → that script (today's case unchanged);
  - the sandbox's integrations page offers no item that writes `~/.claude/settings.json`;
  - the sandbox package's metadata: `Package: menkar-sandbox`, `/usr/share/applications/
    menkar-sandbox.desktop`, its own `appId`, its artifact name, every installed path disjoint from
    `menkar`'s recorded list (`tests/data/package/`).
- [ ] Build: the constant and its readers (§2.12); the second config with the four explicit names;
  `package.mjs`/`check-package.mjs` taking `--flavour`; `npm run package:sandbox`.
- [ ] `docs/packaging.md`, "The sandbox package" (P0.1's toolchain section already points to it).
- **Verify:** `npm run ci`; `packager` builds both .debs and runs `package:check` on each; a
  throwaway install check: installing `menkar-sandbox` beside `menkar` in a container or VM leaves
  `dpkg -L menkar` and `/opt/Menkar` unchanged, and both apps run at once with their own windows
  (not on the human's machine until P0.8). Injected defect: drop `deb.packageName` → the metadata
  test fails.

#### P0.1 — R10's snapshot on `main`, and the branch's baseline

- [ ] Tests: `tests/core/r10.test.ts` and `e2e/r10.spec.ts` exactly as §2.10 lists. Run once on the
  worktree at its first commit (= `main`'s HEAD, plan 40 built), which writes the snapshots.
- [ ] `scripts/ci.mjs`: `MENKAR_TEST_BASELINE` defaults to the current branch; a test in
  `tests/scripts/` asserts it reads the branch name and keeps an explicit value.
- [ ] `docs/toolchain.md`, "A long-lived branch": §2.12's rules (the sandbox flavour pointing to
  `docs/packaging.md`, "The sandbox package"), and what R10's snapshot holds.
- **Verify:** `npm run ci`, `npm run ui-check` (the new spec alone first, then whole). Injected
  defect: append a space to `buildCommand`'s output → the snapshot test fails; start a dummy
  listening socket in the app under a test flag → the spec fails. **`set` commits this block on
  `main`'s side too** (the snapshot is `main`'s, §2.12).

#### P0.2 — ids, descriptors, registries, and the rule that forbids new name checks

- [ ] Tests first: `ids.test.ts` (`parseAgentId` of each id, of `''`, `'gemini'`, a number →
  `null`; `AGENT_IDS` order = today's offer order, Claude then Cursor); `check-code-rules.test.ts`
  (§2.15's first row, each rule failing once on an injected line, and `ALLOWED` lines not reported).
- [ ] `ids.ts`, `types.ts` (every interface of §2.3, types only, members as named there),
  descriptors for Claude and Cursor (today's glyphs `✳`/`➤`, `agent.claude`/`agent.cursor` keys,
  capabilities matching today: Claude remote, fork, trash, chat, context, ids chosen, named at start;
  Cursor trash, chat), kits holding only what later blocks fill (typed, `null` where empty).
- [ ] The three rules in `check-code-rules.mjs`; `ALLOWED` seeded with every current site
  (`npm run ci` lists them), each reason "moved in P0.n".
- **Verify:** `npm run ci`; R10 unchanged.

#### P0.3 — Launcher, MCP mount, team delivery, environment

- [ ] Tests first: `launch.test.ts` per agent, the `LaunchPlan` for each start kind; **R10's
  command and settings snapshots unchanged**; `withoutSessionEnv` snapshot unchanged.
- [ ] Move `buildCommand`'s body into the two Launchers (Claude: identity flags, prompt before
  `--add-dir`, `--mcp-config`, `--plugin-dir`, `--settings`, plan 40's team file last and the
  snapshot flag on resume; Cursor: `--resume` only). `buildCommand` stays as the facade.
  `startPaneHeld` builds `ctx` once and asks the kit — the `spec.agent === 'claude'` lines there go.
  `sessionenv.ts` keeps `SESSION_ENV` as Claude's `EnvRules` re-exported.
- [ ] Remove this block's lines from `ALLOWED`.
- **Verify:** `npm run ci`, `npm run ui-check` (sessions start, plan 40's specs).

#### P0.4 — the session catalog

- [ ] Tests first: the catalog contract over Claude and Cursor fixtures (`tests/data/agents/<id>/`,
  copied from today's test fixtures, not moved); today's `tests/core/sessions/*` untouched and green.
- [ ] Claude's and Cursor's readers move into their catalogs (`claudeTranscripts`, `cursorCwd`, the
  head, names, badges, `cursorUserText`, `role`); the scanner asks each installed kit's catalog;
  `watchedDirs` asks `watchTargets`; `Roots` and `Installed` become maps by `AgentId`. Main's six
  uses of `SessionInfo.file` (§1) go through the catalog (`lastReply`, `details`, `exportMarkdown`,
  `location`, `trash`). `SessionInfo` keeps its fields (`file` holds the locator).
- **Verify:** `npm run ci`, `npm run ui-check`; R10's watched-dirs snapshot unchanged.

#### P0.5 — state rules

- [ ] Tests first: the state contract over each agent's screen fixtures (today's
  `tests/core/agentstate/` cases stay; the contract adds one per agent per state).
- [ ] `detect.ts`'s `claude`/`cursor` functions move into the kits; `detectState` is the facade.
  `AGENT_NAMES` from the descriptors; `provider` typed `AgentId`; `remote-live.ts` skips a pane
  whose kit's remote concern is `null`.
- **Verify:** `npm run ci`.

#### P0.6 — main's remaining checks, the wake, and the tolerance

- [ ] Tests first: §2.15's tolerance rows (`resumeSpec` cases; a Claude-only start writes no
  `session_agents`; a Cursor start writes `{ id: 'cursor' }`); a unit test of the Claude waker
  against today's socket fixture (frame bytes = R10's).
- [ ] `wakeSession` calls `pane.kit.waker`; `handleControl`'s gate and `resume_session`'s refusal
  test whether the kit's McpMount is `null` (Cursor's is, until P3); `followPaneStart` asks the
  kit's IdBinding to `classify`; `forkSession` and remote test their concern for `null`;
  `installedAgents` (the registry's CLIs on the PATH), `agentName`, `startNew`'s id
  (`kit.ids.newId()`), the
  first-time card's and "Ask an agent"'s agent (`DEFAULT_AGENT`, unchanged until Q2's block).
- [ ] `session_agents` written and pruned; Q4's line in `en.ts`/`es.ts`.
- [ ] E2E: a saved layout with a tab of session `s1` and `state.json` `session_agents: { s1:
  'gemini' }` → the tab shows Q4's line, no process started, and `state.json`/`projects.json` keep
  `s1` after a save.
- **Verify:** `npm run ci`, `npm run ui-check`; screenshot of the tab with Q4's line (light, dark).

#### P0.7 — renderer, chat, usage, classifier; the rule at zero

- [ ] Tests first: the renderer's menus per descriptor (an existing spec extended: a Cursor row has
  no Fork, no Remote Control, as today).
- [ ] `PaneAgent = AgentId | 'shell'`; the shared types use `AgentId`; the renderer reads
  descriptors (label, glyph, caps); chat variants and CLIs move into the kits' `ChatStrategy`; the
  usage cache's `claude` property → `given` (SQL column unchanged); the classifier finds its CLI
  through `kitOf(CLASSIFIER_AGENT)`.
- [ ] `ALLOWED` ends empty, or holding only non-behaviour reasons named in the review; the old
  `src/core/agents.ts` removed.
- [ ] `docs/agents.md`, "How the code is organised" (§2.1–§2.5 condensed, with what was rejected);
  `AGENTS.md`'s per-agent bullet gains "enforced by `scripts/check-code-rules.mjs`"; the toolchain
  table's row.
- **Verify:** `npm run ci`, `npm run ui-check` whole; R10 whole; `grep` is not the proof — the rule is.

#### P0.8 — the merge gate (1.142)

- [ ] `docs/release-checklist.md`, "Agents moved behind their kits (P0)": a day of work with Claude
  and Cursor sessions as usual; start, resume, fork, Remote Control, the orchestration mode, a wake,
  Usage — each passes when it behaves as before.
- [ ] Real checks: `claude-cli` and `cursor` run the P0 build's commands against the real CLIs in
  throwaway homes (the command line, `--settings`, the MCP's `tools/list`, a wake, a Cursor resume).
- [ ] `packager`'s `menkar-sandbox` .deb from the worktree; the human installs it beside their
  Menkar and runs the hand check in it (1.155); then `set` merges `multi-agent` into `main`, and
  `packager` builds `main`'s own .deb, which the human installs over their Menkar for the same
  check against their own data (P0 is the one phase that changes `main`'s build, 1.142).
- **Verify:** `npm run ci`, `npm run ui-check`, R10 unchanged against `main`'s snapshot.

### P1a — Codex as a session (R1–R4, R9, R11)

| Block | Files it owns | After |
|---|---|---|
| P1a.1 | `e2e/standins/codex.ts`, `tests/data/agents/codex/**`, `src/core/agents/shared/db.ts`, `tests/core/agents/shared/db.test.ts`, `tests/core/agents/contract/nowrite.test.ts` | P0 |
| P1a.2 | `src/core/agents/codex/{ids,descriptor,launch,env,config}.ts`, `src/core/agents/{ids,registry}.ts`, `src/main/agents/registry.ts`, `src/main/agents/codex/index.ts`, `package.json` (`smol-toml`), `docs/toolchain.md` | P1a.1 |
| P1a.3 | `src/core/agents/codex/catalog.ts`, `src/core/agents/shared/zstd.ts`, `package.json` (engines), contract fixtures | P1a.2 |
| P1a.4 | `src/core/agents/codex/{notify,binding}.ts`, `electron.vite.config.ts`, `scripts/check-package.mjs`, `src/core/sessions/join.ts`, `src/main/control.ts`, `src/main/workspace.ts` (binding, follow), `docs/packaging.md` | P1a.3 |
| P1a.5 | `src/core/agents/codex/state.ts`, state fixtures | P1a.4 (each block registers its strategy in the kit's `index.ts`, so they run in turn) |
| P1a.6 | `src/core/agents/codex/{usage,context}.ts`, `src/core/usage/{pass,history}.ts` (the `TurnSource` loop), `src/core/usage/prices.ts` (OpenAI rows), `src/core/classifier/**` (`turnText`) | P1a.5 |
| P1a.7 | `e2e/codex.spec.ts`, `docs/agents.md` (Codex), `docs/sessions.md`, `docs/usage.md`, `docs/release-checklist.md` | P1a.6 |

- **P1a.1** — Stand-in and fixtures: a scripted Codex (rollouts under `sessions/Y/M/D/`, one `.zst`,
  `session_index.jsonl`, a `state_5.sqlite` copy, `notify` invoked with codex's JSON argument
  including `input-messages`, the title thread's extra notify with no rollout). `openAgentDb` and its
  test (§2.15). The no-write harness generic over `DeclaredWrites`, Claude's and Cursor's rows first.
  **Verify:** `npm run ci`; inject: drop `immutable=1` → the listing test fails.
- **P1a.2** — Codex's descriptor, Launcher (new: `-m`, `--add-dir` for the files folder, `-c notify`
  per §2.9, the positional prompt; resume: `codex resume <id> "<prompt>"`), EnvRules (`codex.md`
  §1.7, D12), `config.ts` reading `config.toml` with `smol-toml` (§2.8). The New picker lists Codex
  from the descriptor. Tests: the command for each start, quoting of a prompt with quotes; config
  fixtures (plain, profile, unparsable → no chaining). **Verify:** `npm run ci`; R10 unchanged (no
  `codex` on the PATH).
- **P1a.3** — Catalog: find rollouts, names from `session_index.jsonl` (the last line per thread
  wins), cwd and preview from `session_meta` and the first user message, badges, `lastReply` from
  `task_complete.last_agent_message`, details, export; `.zst` read whole off the UI path; engines
  `>=22.15.0`. Contract: Codex's fixture conversation = `expected.json`. **Verify:** `npm run ci`.
- **P1a.4** — The `notify` program (writes the record, chains the user's, §2.9) shipped; IdBinding
  late: a pending pane binds on the first record with a real id (rollout exists); `/new` and
  `/resume` classified by whether the rollout existed before the pane's last start (`codex`,
  2026-11-15, m), followed as 1.56/1.57; the record writer/reader parity test. Tests with the
  stand-in: the title thread's notify ignored; the pane bound to the real thread. **Verify:** `npm
  run ci`, `npm run ui-check` (new spec: start, first turn, the tab follows the id).
- **P1a.5** — State rules from `codex.md` M16: working, blocked (the command approval), idle only
  with "Worked for" and no working line, the trust prompt as blocked; fixtures per state.
  **Verify:** `npm run ci`.
- **P1a.6** — Usage: Codex's `TurnSource` in `usage-cache-codex.sqlite`, a turn per user message
  (`task_started`…`task_complete`, spans from its times), tokens from `token_count`'s
  `last_token_usage`, uuids `codex:<turn id>`; `runPass` loops sources; OpenAI rows in `prices.ts`
  with their source and date (D15); context from the rollout tail's `token_count`; the classifier's
  `turnText` (D19: only when `claude` is installed, else unclassified and said in the Usage window —
  the sentence through `t()`). Tests: the contract's tokens per turn; a midnight-spanning turn
  counted on its opening day as Claude's are; a `.zst` replacing an ingested `.jsonl` not
  re-counted; Claude's cache file untouched (R10). **Verify:** `npm run ci`, `npm run ui-check`
  (Usage window with a Codex session; screenshot).
- **P1a.7** — Gate: `e2e/codex.spec.ts` (New → Codex, prompt, state dots, resume after restart,
  details, export, Usage); docs; release-checklist "Codex as a session"; `codex`'s real check in a
  throwaway `CODEX_HOME` (command line, notify chaining with a user `notify`, `--add-dir`, state
  strings on the real screen, Usage numbers against the rollout). **Verify:** `npm run ci`, `npm run
  ui-check` whole, R10.

### P1b — the orchestration bridge, with Codex (R5–R8)

| Block | Files it owns | After |
|---|---|---|
| P1b.1 | `src/core/control/{protocol,server,files}.ts`, `src/core/agents/types.ts` (caller), `tests/core/control/**` | P1a |
| P1b.2 | `src/core/agents/codex/mcp.ts`, `src/main/workspace.ts` (`handleControl`, `start_session`'s `agent`, resume/park/renew/adopt per kit), `src/core/projects/**` (provisional ids) | P1b.1 |
| P1b.3 | `src/main/agents/codex/waker.ts`, `src/main/agents/shared/wake.ts`, `src/core/control/post.ts` (the bridged frame builder beside `wakeFrame`, which is untouched), `send_message` | P1b.2 |
| P1b.4 | `src/main/agents/codex/namer.ts` | P1b.3 (the kit's `index.ts`) |
| P1b.5 | `plugin/team/codex.md`, `src/core/agents/codex/team.ts`, the `told` persistence (`src/core/team/**`), skills per Q1 | P1b.4 |
| P1b.6 | `src/renderer/orchestration.ts` (first-time card per Q2), i18n, `e2e/orchestration-codex.spec.ts`, docs, release-checklist | P1b.5 |

- **P1b.1** — Before code: `claude-cli` measures with a stub server that Claude re-lists on
  `notifications/tools/list_changed` and keeps the prompt cache (38 §3.1). Then: `tools/list` shaped
  per caller (D3) from the snapshot's installed agents and the caller's agent; `listChanged: true`
  declared **only when a non-Claude CLI is installed** (so R10's `initialize` bytes hold for a
  Claude-only user); tools only added mid-session; `ControlRequest.caller`. Test: the D3 table —
  caller agent × installed set → listed tools and `agent` field; Claude-only → R10's bytes.
  **Verify:** `npm run ci`.
- **P1b.2** — Codex's McpMount (`-c mcp_servers.menkar.command/args/env`, `MENKAR_PANE` in `env`,
  approval mode `approve`, cmp 1.4); `handleControl` serves any kit whose McpMount is not `null`;
  `start_session { agent }` (D4: the caller's; `parseAgentId`, refusal for an agent not installed);
  provisional ids (§2.5.2); `resume_session`/`park_session`/`renew` (end and resume fresh)/
  `adopt_session` per kit (R11). Tests: start a Codex worker by `start_session` from a Claude caller
  → member and child by its provisional id, re-keyed on the first record; Menkar quits before it →
  dropped on load. **Verify:** `npm run ci`, `npm run ui-check`.
- **P1b.3** — Codex's waker (`codex queue`, outcome by exit status and its "Queued message" line;
  no rollout → `'no session'`); `send_message { name, text }` routed through the target's waker;
  Claude→Claude refused with "use SendMessage"; the bridged frame names the sender and the reply
  tool (38 §3.1). Tests: each D2/D3 case; the stand-in's queue receives the frame bytes.
  **Verify:** `npm run ci`, `npm run ui-check`.
- **P1b.4** — Codex naming after the first turn: a short-lived `codex app-server` on the same
  `CODEX_HOME` sends `thread/name/set` (D5, 1.139); until then the pane holds the name (§2.5.2).
  Test with the stand-in's app-server mode. **Verify:** `npm run ci`.
- **P1b.5** — Codex's team part and delivery (`-c developer_instructions` = Menkar's block, then the
  user's own from `config.toml`); `holds: 'recorded'` with the persisted `told`; skills per **Q1**
  (1.155): Codex's team part says "to load a skill, read its `SKILL.md` and follow it", and the
  facts line names each skill by absolute path, through a `skillRef(skill)` member of TeamDelivery
  (Claude's returns the name, so its block stays byte-identical, R10) — Menkar's from the shipped plugin folder
  (`pluginFolder`, `src/core/paths.ts`), a stored one from where `listSkills` found it (plan 40
  §2.6), a skill not found as plan 40 names it. Test: the Codex block's skills line for the
  orchestrator, a worker with one stored skill, and a not-found skill.
  Tests: plan 40's rule cases for `recorded` (resume with facts unchanged → no post; changed → one
  post once wakeable). **Verify:** `npm run ci`.
- **P1b.6** — The first-time card per **Q2** (1.155): the agent choice shows only with two or more
  agents installed, default `last_agent` — a mock-up for the human first, its place their choice,
  then built — and the Cursor warning of 38 "Mixed projects"; "Ask an agent" starts the focused
  agent pane's agent, else `last_agent` (tests: one agent installed → no choice shown, the card as
  today; two → the choice, default the last used); e2e: a Claude orchestrator with a Codex worker —
  start, report, wake, `last_reply`, `send_message` both ways; screenshots of the card. Gate: `codex` and
  `claude-cli` real checks (a mixed project in throwaway homes), release-checklist "Codex in the
  orchestration mode". **Verify:** `npm run ci`, `npm run ui-check` whole, R10.

### P2 — OpenCode (R1–R11)

| Block | Files it owns | After |
|---|---|---|
| P2.1 | `e2e/standins/opencode.ts`, `tests/data/agents/opencode/**` | P1b |
| P2.2 | `src/main/agents/opencode/server.ts`, its tests | P2.1 |
| P2.3 | `src/main/agents/opencode/proxy.ts`, caller resolution in `src/main/workspace.ts` | P2.2 |
| P2.4 | `src/core/agents/opencode/{descriptor,catalog,env,ids}.ts`, registries | P2.1 (parallel with P2.2, which does not touch a kit's `index.ts`: P2.5 wires the server in) |
| P2.5 | `src/core/agents/opencode/{launch,state,mcp,team}.ts`, `src/main/agents/opencode/{prepare,waker,events}.ts`, `plugin/team/opencode.md` | P2.3, P2.4 |
| P2.6 | `src/core/agents/opencode/{usage,context}.ts` | P2.5 |
| P2.7 | `e2e/opencode.spec.ts`, docs (`agents.md`, `session-control.md` port amendment + history), release-checklist | P2.6 |

- **P2.1** — The stand-in server and TUI (§2.10) and an `opencode.db` fixture in WAL mode.
- **P2.2** — The server's life (§2.7): `serve --stdio`, password, random port, feature check, stop
  with the last tab and on quit, one restart per 30 s. Tests: no port before the first OpenCode tab
  (R10's spec extended with `opencode` absent and present-but-unused); main killed → the stand-in
  server gone (stdin closed); restart counted. **Verify:** `npm run ci`, `npm run ui-check`.
- **P2.3** — The per-pane proxy (D14, 1.138: `127.0.0.1` only, no credential added); the session
  map; the caller's `_meta` resolved to its pane; `/new` followed as a clear. **Verify:** `npm run
  ci`.
- **P2.4** — Catalog from `opencode.db` through `openAgentDb`; watched by the database file's mtime
  and `-wal`'s; read only when OpenCode is installed (R10). Contract fixture = `expected.json`; R9.
  **Verify:** `npm run ci`.
- **P2.5** — Preparer (create `{id, title, model}`, the instruction entry), Launcher (`--server
  <proxy> -s <id> --prompt`), state (screen + `session.execution.*`/`permission.asked` events as
  records), waker (inbox), MCP per folder when the mode is on (D20, 1.141), skills config, team
  `holds: 'server'`, the two-servers warning (D9). **Verify:** `npm run ci`, `npm run ui-check`.
- **P2.6** — Usage (a turn per user message, D9; spans from steps; tokens summed; cost lines to
  `usage-opencode.jsonl`, §2.5.5) and context (the API route). **Verify:** `npm run ci`.
- **P2.7** — Gate: e2e (an OpenCode session alone and as a worker of a Claude orchestrator);
  `opencode`'s real check (server life, proxy, Usage cost against the database, a TUI of the user
  beside Menkar's); docs; release-checklist. **Verify:** `npm run ci`, `npm run ui-check` whole, R10.

### P3 — Cursor completed (R1–R8)

| Block | Files it owns | After |
|---|---|---|
| P3.1 | `src/core/agents/cursor/integrations.ts`, `src/main/preferences.ts` / the integrations page, `docs/preferences.md`, i18n | P2 |
| P3.2 | `src/core/agents/cursor/{launch,mcp,team,state,ids}.ts`, R10's Cursor snapshot rows (with `set`) | P3.1 |
| P3.3 | `src/core/agents/cursor/{hooks,usage}.ts`, `electron.vite.config.ts`, `scripts/check-package.mjs`, `docs/packaging.md` | P3.2 |
| P3.4 | `src/main/agents/cursor/waker.ts`, `src/core/agents/cursor/names.ts` | P3.3 |
| P3.5 | `e2e/cursor.spec.ts`, docs, release-checklist | P3.4 |

- **P3.1** — The two integrations items (D13 `~/.cursor/hooks.json` entries; D7 allow entries in
  `~/.cursor/cli-config.json`), each consented and removable on its own, leaving the rest of the file
  byte-identical; greyed when `cursor-agent` is not found (1.140); the page says what is lost
  without them. Tests on fixture files: install, remove, a user's own entries kept byte-for-byte.
  **Verify:** `npm run ci`, `npm run ui-check` (screenshot of the page).
- **P3.2** — Launcher: first prompt, `--model`, `--new-session-id <uuid>` so the id is chosen
  (`cursor`, 2026-11-15, m: the chat's id is that uuid and `--resume` finds it; the flag is hidden —
  if a version drops it, the fallback is a positional start with the id from `sessionStart`'s
  `conversation_id`, behind the same IdBinding); the per-pane plugin folder (`…/<pane>/menkar/`,
  `.mcp.json` with `MENKAR_PANE`, the `sessionStart` hook for the team block); the trust prompt in
  the state rules. R10's Cursor rows refreshed in this block, `set` signing the diff. **Verify:**
  `npm run ci`, `npm run ui-check`.
- **P3.3** — The hook program (§2.9), acting only on panes of its own flavour (§2.12's test),
  records, Cursor's usage source from the hook log (time from
  `beforeSubmitPrompt`→`stop`, tokens from `stop`; no cost, `model: default` shown as such); D21's
  test. **Verify:** `npm run ci`.
- **P3.4** — Waker (D1): mid-turn → the next `stop` answers `followup_message`; idle with the empty
  placeholder ("→ Add a follow-up") → end and `--resume <id> "<event>"`; otherwise held until the box
  empties or the next `stop`; names per D22. Tests: each branch with the stand-in, a draft never lost.
  **Verify:** `npm run ci`, `npm run ui-check`.
- **P3.5** — Gate: e2e (Cursor worker of a Claude orchestrator, with and without the items);
  `cursor`'s real check; docs; release-checklist. **Verify:** `npm run ci`, `npm run ui-check` whole.

### Close (when the human calls the branch validated)

- [ ] `set` merges `multi-agent` into `main`; the worktree is removed; `docs/toolchain.md`'s "A
  long-lived branch" keeps only what holds for the next one (the sandbox flavour and package stay:
  they are how the human tries any long-lived branch), the rest to its history.
- [ ] Plan 38's exit (its header) completed: `docs/agents.md` whole, `README.md`, `AGENTS.md`'s D17
  rewording (old text to `docs/history/root/AGENTS.history.md`), `docs/preferences.md`,
  `docs/NOT_BUILT_YET.md` (38 §7 and §3 here, each with its trigger); STATUS rows 1.137–1.143 and
  1.155 point at their docs.
- [ ] Delete `plans/38-multi-agent.md` and this plan, their §3 rows to the history.
- **Verify:** `npm run ci` (the history check).

---

## 6. Execution log

*(Written by the sessions that execute it.)*
