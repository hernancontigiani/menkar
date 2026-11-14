# Plan 38 — More coding agents: Codex, OpenCode, and Cursor in the orchestration mode

> **Status: design for review** (step 1 of 1.135), written by `set` on 2026-11-14, revised the same
> day after a Fable 5.2 review (`review-38`). **Not executable yet**: its execution blocks are
> written in step 2 by the software-architecture session, once the human has approved this design
> and decided D1–D22. Built **on a separate branch** in its own worktree, merged into `main` only
> once validated (1.136), except P0 (D16).
>
> **Comes from:** 1.127 (Codex before 1.0; every agent in the orchestration mode), 1.129 (Menkar's
> MCP is the layer common to every agent), 1.133 (Codex, Cursor, OpenCode; Pi and Gemini CLI out),
> 1.134 (the criterion), 1.135 (the process; per-agent code as strategies), 1.136 (a branch).
> Research: `plans/ideas/research/agents-compared.md` (the matrix and D1–D14, each cell measured or
> read), with `codex.md`, `cursor.md`, `opencode.md` behind it.
>
> **Reopens, and says so:** 1.72's "no socket, no port" and `docs/session-control.md`'s rejection of
> a loopback HTTP server (D9, D14, §3.4); the product rule "nothing written under the agents' data"
> is extended to name Menkar's calls that make an agent write its own data (D17).
>
> **Exit when executed:**
> - The human's decisions D1–D22 → `plans/00-STATUS.md` §1, one row each, with their date; 2.21
>   closes into its history with D1.
> - How each agent is integrated (command, transcripts, state, wake, MCP mounting, skills, what it
>   writes) and why, plus **what was rejected** (§6 here and the options of `agents-compared.md` §4
>   not taken) → a new `docs/agents.md`. `docs/sessions.md`, `docs/agent-state.md`,
>   `docs/session-control.md`, `docs/usage.md`, `docs/orchestration.md` (the first-time card),
>   `docs/classifier.md` (D19) and `docs/packaging.md` (the hook and notify programs) gain the lines
>   their subsystem changes, pointing to `docs/agents.md` for the per-agent part.
>   `docs/session-control.md`'s port rejection is amended there, its old text to its history.
> - What a user sees (which agents, what each needs installed, what each costs) → `README.md`.
> - Rules: 1.135's is in `CLAUDE.md`; D17's rewording of "the agents' data is read, never
>   rewritten" goes there too, the old text to `docs/history/root/CLAUDE.history.md`.
> - The integrations-menu items (D6, D7, D13) → `docs/preferences.md`.
> - Deferred, each with its trigger → `docs/NOT_BUILT_YET.md`: typing as Cursor's plan B,
>   Antigravity CLI, Pi, Windows and macOS per agent, trash and delete for the new agents (D18).
>   "More coding agents" there becomes a pointer to `docs/agents.md`, its text to its history.

## 1. Goal

Menkar runs **Codex, OpenCode and Cursor** as it runs Claude Code — listed, started, resumed,
named, measured in Usage, their state shown — and each takes part in the **orchestration mode**:
started by `start_session`, woken when its children report, read with `last_reply`, served
Menkar's MCP tools and skills, and able to message another session by name. Under 1.134: a
project with one agent is the norm and loses nothing; a mixed project works.

### What already exists (verified in the tree, HEAD 0b03aca; counts re-checked after review)

- **Two agents**, Claude Code and Cursor's terminal agent: `src/core/agents.ts` holds only
  `AGENT_COMMANDS = { claude, cursor }`. **Cursor today** is listed (no name: Menkar shows its
  preview, `docs/sessions.md:35`), started and resumed **without** a first prompt, a model or a
  chosen id (`src/core/command.ts:58–81`, all gated on Claude), its state read from the screen
  (`src/core/agentstate/detect.ts:105`), its transcripts read (`src/core/sessions/cursor.ts`); no
  part in the orchestration mode, no Usage tokens, no Remote Control.
- **The agent is branched on by name in about 60 places**: 23 `'cursor'` literals in 12 files
  (`grep -rl "'cursor'" src`) and 37 `=== 'claude'` / `!== 'claude'` comparisons, 15 of them in
  `src/main/workspace.ts` (`grep -rn "=== 'claude'\|!== 'claude'" src`). Several ternaries treat
  "not Claude" as Cursor (`src/main/workspace.ts:288`, `src/renderer/sessionmenus.ts:11`). The
  union `'claude' | 'cursor'` is written out in at least six places. **This is what 1.135
  forbids**; P0 moves it.
- **Waking** is `wakeSession` (`src/main/workspace.ts:1809`), Claude only, behind an inline name
  check: the "one function per agent" of 1.72 is a design, not yet code. `resume_session`
  refuses any non-Claude session (`workspace.ts:1258`).
- **Menkar's MCP server** (`src/core/control/`): one program, passed to Claude with
  `--mcp-config`; `tools/list` returns **one constant list** (`protocol.ts:302`) and declares no
  `listChanged` (`:300`). Its tools address sessions by name (`protocol.ts:27`, `:79`, `:154`,
  `:257`; 1.74, 1.118).
- **The skills name `SendMessage`** (`plugin/skills/orchestrator/SKILL.md:56`,
  `worker/SKILL.md:39,102`, `distill/SKILL.md:70`, `specialize/SKILL.md:78`).
- `withoutSessionEnv` (`src/core/sessionenv.ts`) holds Claude's variables; Usage
  (`src/core/usage/`) is fed by Claude's transcripts and statusline log; the classifier runs
  `claude -p` (`docs/classifier.md`).
- **The e2e** put stand-in agents on a closed PATH (`e2e/path.ts`): a fake `codex` or `opencode`
  is one more stand-in, never the real one.

## 2. Requirements

What "supported" means, per agent. Each line becomes an assertion in step 2's blocks.

| # | Requirement | Claude | Codex | OpenCode | Cursor |
|---|---|---|---|---|---|
| R1 | Listed, with name or title, folder, preview, date | ✓ today | new | new | listed today; its title (D5) is new |
| R2 | Started and resumed from New / the row, with a first prompt and a model; the id chosen where the agent allows | ✓ | new | new | **new**: prompt, model, `create-chat` id |
| R3 | Running state shown (working, waiting, idle, at an approval, at the trust prompt) without typing anything; strings **measured on a real screen** before the phase | ✓ | new; strings measured (`codex.md` M16); its composer stays visible while working, so the composer alone never means idle | new | screen ✓; the trust prompt is new |
| R4 | Usage: time and tokens per turn; cost where the agent gives it or a price table applies | ✓ | new; cost by price table (D15) | new; cost in its data | new, needs D13; no cost |
| R5 | Started by `start_session` (D4), **addressable by name** (D5), woken when a child reports (D1) | ✓ | new | new | new |
| R6 | Read by `last_reply`; its report reaches the orchestrator by name (D2, D3) | ✓ | new | new | new |
| R7 | Menkar's MCP tools without an approval card, or with one consent (D7) | ✓ | new | new | new |
| R8 | Menkar's skills, in a text that works for it (D10) | ✓ | new | new | new |
| R9 | **Writes nothing** into the agent's data or the user's config but the declared items (D7, D13, D17) | ✓ | must hold | must hold | must hold |
| R10 | **A Claude-only user is unchanged** (below) | — | — | — | — |
| R11 | Every existing feature has a stated answer per agent (the table below) | | | | |

**R10, the regression guarantee (1.134).** The baseline is a user with **no newly supported CLI**
(`codex`, `opencode`) on the PATH, whatever else they have. The Cursor snapshot guards P0–P2 only:
P3 changes Cursor's command line on purpose. Then, against a snapshot taken on `main` before the first change (and refreshed when `main`'s
fixes merge into the branch), for both a Claude session and a Cursor session as they are today:
- the command line, the `--settings` file and the skills a session gets are **byte-identical**;
- `tools/list` is byte-identical (D3's new fields appear only once another agent's CLI is found);
- **no new path is read or watched** (beyond the PATH lookup of the new CLIs' names, which
  detecting this user requires), **no new process starts, no port opens**;
- the wake frame's bytes and `WAKE_DELAY_MS` are unchanged.

**R9's test**: with stand-ins, every file under the agent's home keeps its bytes and mtime except
the items declared for that agent (the pattern of `docs/sessions.md:133`); reading `opencode.db`
or Codex's `state_5.sqlite` leaves the folder's file list unchanged (no `-wal`/`-shm` created),
also with no agent process running.

**R11, existing features × agent** (✓ supported · — not for this agent · OOS out of scope here):

| Feature | Claude | Codex | OpenCode | Cursor |
|---|---|---|---|---|
| Fork a session | ✓ | OOS | OOS | — |
| Follow `/clear`, `/new`, in-tab `/resume` (1.56, 1.57, 1.63) | ✓ | its own `/new`, `/resume`: follow (architecture) | `/new`: followed by its pane (D14) | OOS |
| `renew` | ✓ | ✓ (end and resume fresh) | ✓ | ✓ |
| `park_session` / `resume_session` | ✓ | ✓ | ✓ | ✓ |
| `adopt_session` | ✓ | ✓ | ✓ | ✓ |
| Chat tabs (`src/core/chat/variants.ts`) | ✓ | OOS | OOS | as today |
| Project files folder (`--add-dir`) | ✓ | its own flag or OOS (architecture) | OOS | OOS |
| Context reading in the sidebar | ✓ | `token_count` | the API's context route | — (D8) |
| Details, export | ✓ | ✓ | ✓ | as today |
| Trash, delete | ✓ | **D18** | **D18** | as today |
| Remote Control | ✓ | — | — | — |
| Classifier | ✓ | **D19** | **D19** | **D19** |

## 3. The design: what is unified and what stays native

The per-mechanism table, with each reason against 1.134, is `agents-compared.md` §2. In short —
**three things are unified, everything else stays each agent's own**:

1. **One interface per concern, one implementation per agent** (1.135): starting and resuming,
   naming, reading transcripts and Usage turns, reading state, waking, mounting the MCP server and
   the skills, the environment list, the remote mode, what the agent writes. The implementation
   is chosen once from the session's agent; shared code never names an agent. An agent entry
   **declares** what it supports (remote mode, per-platform enabling, trash), never a check on
   its name. **Before P0 is coded, the interfaces are checked on paper against all four agents**
   — a late id (Codex), a server-held agent (OpenCode), SQLite stores, hooks that need consent
   (Cursor) — or Claude and Cursor alone will set the wrong seams.
2. **Menkar's MCP server, one program**, mounted each agent's way (`--mcp-config`, `-c
   mcp_servers…`, `--plugin-dir`, `OPENCODE_CONFIG_CONTENT`), identifying its caller by
   `MENKAR_PANE` (Claude, Codex, Cursor) or OpenCode's `_meta` session id through a per-pane proxy
   (D14). Whether it is mounted in every non-Claude session or only in the orchestration mode is
   **D20**, with each agent's per-request cost in view (§3.2).
3. **One Usage model**, fed by one reader per agent, so a turn is defined once (`CLAUDE.md`).

### 3.1 Messaging across agents (D2, D3)

- **A bridge, not a replacement:** Claude keeps `SendMessage`; a new `send_message { name, text }`
  tool, routed through `wake`, serves the sessions `SendMessage` cannot reach.
- **`send_message` refuses a Claude→Claude call** with Menkar's sentence "use SendMessage", so a
  Claude session never takes the slower, unattributed path.
- **The bridged frame names the sender and the tool to reply with** ("from ‹name› (Codex); reply
  with send_message"), since a Claude receiver would otherwise try `SendMessage` to a non-Claude
  name.
- **Claude's skill text stays as it is (R10).** What a Claude session needs in a mixed project
  reaches it outside the skill: the `send_message` description and the frame above.
- **When the new fields are listed (D3):** `send_message` is **always** listed to a non-Claude
  caller (a Codex-only user has no other way to message by name, R6), and to a Claude caller once
  a non-Claude CLI is installed; `start_session`'s `agent` once two or more agents' CLIs are
  installed. On the human's own machine that means Claude sessions see `send_message` even in an
  all-Claude project: a name per turn (deferred) and a refused call if used Claude→Claude. A session already running when that happens
  sees them only if the server announces `listChanged` and the agent re-lists. **Claude Code does**
  (read, `claude-cli`, 2.1.325 docs and binary): an interactive session re-fetches the list on
  `notifications/tools/list_changed` (debounced ~300 ms), names new tools in an appended note so
  the prompt cache stays, and `permissions.allow: ["mcp__menkar"]` covers them. So the server
  declares `tools: { listChanged: true }` and **only adds** tools mid-session, never removes them.
  **OpenCode does too** (measured, `opencode` M34): it re-requested `tools/list` 11 ms after the
  notification and listed the new tool in the same turn's next request. Whether Codex and Cursor
  re-list is unmeasured: a running Codex or Cursor session sees a new field **from its next start**.
  Claude's re-listing is read, not measured: it is recorded in `agents-compared.md` and measured
  with a stub before P1b, since the live transition rests on it. The installed agents are read from the
  published snapshot file, not a request round trip, so R10's latency holds.

### 3.2 Waking per agent (D1)

Every channel native, none typing: Claude the socket (~50 ms); Codex `codex queue` (5–8 s);
OpenCode the inbox post on Menkar's server (~50 ms); Cursor `followup_message` for a working
session (~2.4 s, needs D13), end-and-resume for an idle one **only while its input box shows the
empty placeholder** ("→ Add a follow-up", `cursor.md` M8–M9); otherwise the event is held until the
box empties or the next `stop` delivers it, so a half-typed draft is never lost (2.21's
conditions). The same holds for `send_message` aimed at an idle Cursor session.

### 3.3 Naming and addressing (D5)

Every orchestration tool addresses a session by name, and a worker is `<project>-t<N>` (1.118).
- **Sessions the human starts**: the agent's own name or generated title.
- **Sessions `start_session` starts**: Menkar sets the name through the agent's own call — Claude
  `-n`, OpenCode `session.create {title}`, Codex `thread/name/set` sent by a separate
  `codex app-server` on the same home **right after the first turn** (measured, `codex.md` M15:
  it writes `session_index.jsonl` and `threads.name`, not the rollout; the open TUI's footer keeps
  its old name until resumed; Codex sometimes names a thread itself, which Menkar's call
  overwrites). **Cursor cannot be named from outside** (measured, `cursor.md` M19–M21: no flag, no
  file Menkar may write; only the human's `/rename`; its auto-namer names a chat once from its
  first message): D22.
  These are writes the agent makes into its own data at Menkar's call (D17).
- **Codex has no id until its first turn ends** (`codex.md` M13): from `start_session` to that
  moment the session is a member, child and assignee **by its pane**, re-keyed to the id when
  `notify` names it, as a `/clear` re-keys today (1.56). Its `menkar-tN` name is held by
  Menkar for the pane until `thread/name/set` writes it into Codex's index, so the name stays
  the agent's (1.74) once the agent has one.

### 3.4 Ports (D9, D14)

OpenCode's server is HTTP, so Menkar talks to its own child over loopback and gives each OpenCode
pane its own loopback port (D14). This **amends 1.72's "no socket, no port"** for this one agent.
Requirements: bind `127.0.0.1` only, a random free port, `OPENCODE_PASSWORD` per Menkar run; the
proxy forwards and never adds credentials (the TUI sends the password itself, `opencode.md` M8,
M29); no port opens unless an OpenCode tab exists (R10). "The app makes no network connections of
its own" is read as: none leave the machine; loopback to a child Menkar started is not one.

### 3.5 Environment (D12)

Each agent's **identity** variables — the ones its §1.7 table in `codex.md`, `cursor.md` and
`opencode.md` marks as describing a running session (`CODEX_THREAD_ID`, `CURSOR_AGENT`, …) — are
stripped, as `sessionenv.ts` strips Claude's; each agent's **configuration** keys are kept, as
`CLAUDE_CONFIG_DIR` and `ANTHROPIC_*` are (`CODEX_HOME`, `CODEX_API_KEY`, `CURSOR_API_KEY`,
`CURSOR_CONFIG_DIR`, `OPENCODE_CONFIG`, `OPENCODE_DB`, …). Un-namespaced variables an agent
injects (`GIT_EDITOR`, `GIT_CONFIG_COUNT/KEY_0/VALUE_0`, `PLUGIN_ROOT`, `PLUGIN_DATA`,
`AGENT_TRANSCRIPTS`) are stripped **only when that agent's marker** (`CURSOR_AGENT`,
`CODEX_THREAD_ID`) is in the inherited environment, since they may be the user's own.

### 3.6 Sharing the human's state with `main` (1.136)

The human tries the branch's build with their own data, then goes back to `main`. So until the
merge: **no schema bump** of the usage history (a bumped one leaves `main`'s Usage dead,
`src/core/usage/history.ts:173–178`) and **no new agent value in `state.json` or `projects.json`**
that `main` would read as Cursor (`workspace.ts:288`). A new agent value **will** be saved (the
human's check of P1a saves a Codex tab), so **P0 includes the tolerance**: an unknown agent value is
skipped, never read as Cursor — and P0 merges to `main` (D16).

### What it costs, and who pays

| Who | Gains | Pays |
|---|---|---|
| A Claude-only user | Nothing they need | Nothing at run time (R10); the code they don't run |
| A Codex user | R1–R11 | Every Menkar session runs embedded, with Codex's warning at start; a wake takes 5–8 s; `-c notify` replaces their own `notify` unless chained (D6); the trust prompt once per folder; nothing per request for Menkar's tools: Codex defers MCP schemas (+7 tokens for 18 tools, measured, `codex.md` M14) |
| An OpenCode user | R1–R11; the cleanest wake | One `opencode serve` per Menkar, ~270 MB, started with the first OpenCode tab (D9); with `codemode:false`, Menkar's 18 tool schemas in **every** request: +9.8 KB, ~2.4–2.8k tokens (measured bytes, `opencode` M32–M33; tokens estimated), ~1k with OpenCode's default Code Mode — in every session if D20 mounts it everywhere; a warning when their own TUI holds a session Menkar runs |
| A Cursor user | R1–R11 as far as Cursor allows | Three consented entries in `~/.cursor/hooks.json` (one per event), which run in **every** Cursor session, outside Menkar too, and whose payload carries `user_email` (D13); approval cards per tool — up to 18 — unless allowed once (D7; `--approve-mcps` does not remove them, measured); +125 tokens a turn for Menkar's 18 deferred tools (measured); an idle wake is a restart, delayed while a draft is in the box |
| A mixed project, or any project of a user with a second CLI | Any agent as orchestrator or worker | `send_message` listed (in Claude sessions too, deferred: a name per turn); bridged reports arrive as user messages with Menkar's frame, not `SendMessage`'s verified sender |

### Mixed projects

What works and what breaks is `agents-compared.md` §3, plus §3.1 here. Also:
- `start_session` takes `agent`, defaulting to the caller's (D4); `resume_session`,
  `park_session`, `renew` and `adopt_session` work per agent (R11); `remote_control` is refused
  for an agent with none.
- **A Cursor session is the weakest orchestrator and worker** (an idle wake is a restart; cards
  per tool unless allowed): the first-time card says so when a Cursor session is chosen as either,
  and forbids neither.
- **Two OpenCode panes on one session** (OpenCode's tab list is shared, `opencode.md` M31): Menkar
  does not follow the second pane into it, as it does not follow a Claude `/resume` into a session
  another tab holds (`workspace.ts:1857–1865`); the proxy sees the `/view` but cannot stop the TUI
  showing it.

## 4. Phases

On the branch (1.136). Each phase ends green and hand-checked; the order is D16.

| Phase | What | Why here |
|---|---|---|
| **P0** | Claude and Cursor behind the per-concern interfaces, **no behaviour change** (R10's snapshot, the whole suite); **merged into `main` as soon as it is green and hand-checked** | ~60 sites in the files `main`'s fixes touch (`workspace.ts`); the longer it waits, the more 1.136's fixes conflict |
| **P1a** | **Codex as a session**: R1–R4, R9, R11 | Useful alone to a one-agent Codex user (1.127, before 1.0) |
| **P1b** | **The orchestration bridge and Codex in it**: R5–R8; `agent`, `send_message`, list shaping, the frame, the first-time card | The shared pieces, built once, with the first agent that needs them |
| **P2** | **OpenCode**, R1–R11, with Menkar's own server and the per-pane proxy | The cleanest wake; the server is the largest new piece |
| **P3** | **Cursor, R1–R8 completed**: its title, first prompt, model and `create-chat` id, the trust prompt's state, Usage, orchestration; the integrations items D7, D13 | Already listed; its orchestration depends on D7, D13 |
| **P4** | `AGENTS.md` for this repository (D11) | Independent; on `main` whenever the human says |

## 5. Decisions for the human

D1–D14 are argued, with their options, in `agents-compared.md` §4. Revised recommendations, and
eight that this design adds:

| # | Decision | Recommended |
|---|---|---|
| D1 | Waking an agent without Claude's socket (2.21) | Native channels; Cursor `followup_message`, else end-and-resume **only with an empty box**; typing deferred as Cursor's plan B |
| D2 | Messaging by name: replace or bridge | Bridge: Claude keeps `SendMessage` |
| D3 | When `send_message` and `start_session`'s `agent` are listed | `send_message`: always to a non-Claude caller; to a Claude caller once a non-Claude CLI is installed, refusing Claude→Claude. `agent`: once two or more CLIs are installed |
| D4 | `start_session`'s `agent` default | The caller's agent |
| D5 | Naming | The human's sessions: the agent's title. `start_session`'s: Menkar names them through the agent's own call (Claude `-n`, OpenCode `title`, Codex `thread/name/set` after the first turn); Cursor: D22 |
| D6 | Codex's turn-end signal | `-c notify` **chaining the user's own `notify`** (read from `~/.codex/config.toml`), as Menkar's statusline chains Claude's |
| D7 | Cursor's card at every Menkar tool call (`--approve-mcps` does not remove it, measured; only `--force` does, approving everything) | An integrations item writing Menkar's allow entries into `~/.cursor/cli-config.json`, consented and removable (D13's pattern); one entry set covers every pane, the per-pane plugin folders sharing one basename |
| D8 | Cursor's status line | None |
| D9 | OpenCode: Menkar's own `opencode serve` (**amends 1.72's "no port"**, §3.4; the ports **decided, 1.138**); one session in two servers; OpenCode's Usage turn | Menkar's own server, loopback only; warn, don't refuse; a turn per user message |
| D10 | The skills' text across agents | Claude's unchanged; per-agent notes to the others; Claude's mixed-project needs met outside the skill (§3.1) |
| D11 | This repository's `CLAUDE.md` → `AGENTS.md` | Move, with `CLAUDE.md` = `@AGENTS.md`; history mirror `AGENTS.history.md` |
| D12 | Environment tuning | Keep the display variables; strip the rest as §3.5 |
| D13 | Cursor's turn hooks need entries in `~/.cursor/hooks.json` (three, global, `user_email` in their payload) | An integrations-menu item, consented and removable, its page saying all three facts |
| D14 | Binding an OpenCode pane's caller after `/new` (**a port per pane**, §3.4; **decided, 1.138**) | A per-pane loopback proxy in Menkar's main process |
| D15 | Codex's cost in Usage | Menkar's price table for OpenAI models, marked `~` as Claude's per-model costs are (`src/core/usage/prices.ts`) |
| D16 | Phases' order (§4) | P0 (merged to `main` early) → P1a → P1b → P2 → P3; P4 whenever |
| **D17** | **Menkar's calls that make an agent write its own data**: a title at creation or start (Claude `-n`, OpenCode `title`), **a rename of an existing session** (Codex `thread/name/set` after its first turn — the line the human should see drawn), a queued wake (D1: Codex's queue SQLite, OpenCode's inbox rows) | Allowed, each named in `docs/agents.md`; `CLAUDE.md`'s rule reworded to say so |
| **D18** | **Trash and delete for Codex and OpenCode sessions** (writes into `~/.codex`, `opencode.db`) | Not in this plan; deferred with a trigger |
| **D19** | **The classifier on non-Claude turns** (it runs `claude -p`; a Codex-only user may have no `claude`) | Classify them when `claude` is installed; otherwise their turns stay unclassified, said in the Usage window |
| **D20** | **Menkar's MCP in every non-Claude session, or only with the orchestration mode on** (1.127 "by default" vs 1.134's cost) | Measured per request for 18 tools: Codex +7 tokens, Cursor +125, OpenCode +2.4–2.8k (it does not defer). **Every session for Codex and Cursor.** For OpenCode the real granularity is **per folder on Menkar's one server** (its MCP connection is per folder; the caller is known only at `tools/call`): recommended, added for a folder when its first session enters a project with the mode on, **kept until Menkar's server stops** (removal is unmeasured, and the server only adds); every OpenCode session in that folder then pays it |
| **D21** | **Cursor's `user_email` in the hook payload**: Menkar receives it with every Cursor turn | Never stored or logged; the hook passes on only what Usage and state need |
| **D22** | **Naming a Cursor worker** (nothing outside Cursor can name a chat) | **Decided (the human, 2026-11-14, 1.137):** a Cursor session `start_session` starts keeps `<project>-t<N>` in Menkar's own data for good; Cursor's generated title is not shown for it ("the name is anecdotal as long as sessions can message each other"); a `/rename` by the human is followed. Sessions the human starts keep Cursor's title, as today |

## 6. What was rejected, and why

- **Replacing `SendMessage` for every agent.** Claude would lose `notify_when_idle`, reach to
  sessions Menkar did not start and to other machines, the verified sender, delivery feedback,
  and ~50 ms for seconds.
- **Serving skills to Claude through `load_skill`.** Saves ~420 cached tokens a turn; loses the
  description trigger, `/menkar:<name>` and re-attachment after compaction.
- **One agent-neutral skill text**, or editing Claude's for mixed projects. Weaker for the common
  case; breaks R10.
- **Typing into Codex's or OpenCode's terminal.** Both have a native queue that keeps drafts and
  approvals.
- **Using the user's own OpenCode service.** Per-run config cannot reach a session there; adding
  Menkar's MCP through its API would change the user's running agent for every session of a folder.
- **A server per OpenCode pane.** ~270 MB each; the proxy binds as exactly.
- **Pre-writing an agent's trust file** (agent-deck). The human answers the agent's own prompt.
- **Codex's `Stop` hook by `-c`** (needs `/hooks` trust, a write, or a bypass flag); **Cursor's
  `--force`** (approves everything); **`CURSOR_CONFIG_DIR`** (moves all the user's config);
  **the project's `.cursor/hooks.json`** (the user's repository).
- **Gemini CLI** (sign-in no longer served), **Antigravity CLI**, **Pi** (1.133).

## 7. Out of scope

- Windows and macOS for the new agents (an agent entry is enabled per platform; Linux first).
- Remote mode for any agent but Claude; fork for the new agents; chat tabs for Codex and OpenCode.
- Cursor's status line and context in Menkar (D8).
- Trash and delete for Codex and OpenCode (D18).

## 8. Do not touch

- Claude's and Cursor's command line, `--settings`, tools listed and skills text for a Claude-only
  user (R10).
- The rule that nothing is typed into a running agent's terminal.
- The user's `~/.claude`, `~/.codex`, `~/.cursor`, `~/.config/opencode` and the agents' data,
  except the consented items (D7, D13) and the writes D17 names (titles; Codex's `queue_1.sqlite` rows
  and OpenCode's inbox rows from D1).
- `main` while the branch is open, except fixes (merged into the branch) and P0.

## 9. What step 2 (the architecture) must produce

The software-architecture session turns this into execution blocks; its Fable 5.2 review checks:

- **The interfaces**, checked on paper against all four agents first (§3); where an agent's
  implementation lives; how one is chosen; how a test runs one agent alone.
- **P0's moves** of the ~60 name checks, proved by R10's snapshot and the suite; P0's merge to
  `main`.
- **Tests per agent**: stand-ins for `codex`, `opencode`, `cursor-agent` on the closed PATH
  (scripted turns, hooks fired, `notify` called, the inbox served), parity tests per transcript
  reader, R9's no-write test, and the real-agent checks the consultants run in throwaway homes
  before each phase merges.
- **Readers**: Cursor transcripts are **rewritten**, not appended (`agents-compared.md` §1.2),
  while the classifier and the usage cache read at byte offsets — how they read Cursor; zstd for
  Codex's old rollouts and the Node version that has it (`package.json` allows `>=22.12.0`).
- **`opencode serve`'s life**: started with the first OpenCode tab, no orphan after a crash, a
  restart with TUIs attached, its password, its port.
- **Where the hook and `notify` programs ship** (`docs/packaging.md`).
- **Reading `~/.codex/config.toml`** for D6's chaining, honouring `CODEX_HOME`: a TOML reader is a
  runtime dependency to justify, or a one-key parser.
- **The branch beside `main`** (1.136): its worktree, its build and `ui-check` not colliding with
  `main`'s, fixes flowing in, §3.6's state compatibility, the hand checks it adds to
  `docs/release-checklist.md`.
- **Who executes what**: per-task workers on the branch's worktree; `codex`, `opencode`, `cursor`,
  `claude-cli` asked by name for their agent.

## 10. Pending before the human reads this

All answered on 2026-11-14 and folded in: `claude-cli` (Claude re-lists on `list_changed`, read),
`codex` (`codex.md` M14–M17), `cursor` (`cursor.md` M17–M21; also: text plus Enter at an open
approval card **approved** the tool call — the rule against typing, measured), `opencode`
(`opencode.md` M32–M34).
