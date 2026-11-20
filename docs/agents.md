# Agents — how the code is organised

Menkar runs more than one coding agent: Claude Code, Cursor and Codex. What differs per agent is
kept in one place per agent, so a change to one agent cannot break another and shared code never
asks which agent it has (1.135). The code says what each piece does; this file keeps why it is
shaped this way and what was rejected.

## The pattern: a kit of strategies per agent, chosen once

- **One interface per concern** (`src/core/agents/types.ts`, `src/main/agents/types.ts`): starting
  (`Launcher`, with the files a start writes in `LaunchPlan.files`; `McpMount`, `Namer`, `EnvRules`
  and `EnvPatterns`), the team block's delivery (`TeamDelivery`, `MainTeamDelivery`), the sessions
  (`SessionCatalog`), the state read from the screen (`StateRules`), ids (`SessionIds`,
  `PaneFollow`, and `EarlyBind`, `MainAgentKit.bind`, for an agent that picks its own id), `Fork`,
  Remote Control (`Remote`), waking (`Waker`), the orchestrator's inbox file and its delivery read
  back from the transcript (`PromptInbox`, `MainAgentKit.inbox`; decision 1.178), the settings file
  and chat tabs (`ChatStrategy`), usage (`UsageSource`, which opens a `TurnSource`), the context
  reading (`ContextSource`), and what the agent itself writes under its home while Menkar reads it
  (`DeclaredWrites`, the allow-list of the no-write test). An interface enters with the first
  agent that implements it, never ahead of its consumer.
- **A kit per agent** groups its strategies: `src/core/agents/<id>/index.ts` (`AgentKit`, plain
  Node) and `src/main/agents/<id>/index.ts` (`MainAgentKit`, what needs Electron's main process).
  **A concern the agent lacks is `null` in its kit**, never a stub that pretends: Cursor has no
  fork, no Remote Control, no team block, no waker, no inbox; Codex has no fork, Remote Control,
  team block or inbox either, and no chat or trash.
- **The registries choose**: `kitOf(id)` (`src/core/agents/registry.ts`) and `mainKitOf(id)`
  (`src/main/agents/registry.ts`) are `Record<AgentId, …>` literals, so `tsc` refuses an agent
  registered without a kit. They are the only code that imports an agent's folder. A pane keeps
  its kit from its start; a session's kit is looked up from `SessionInfo.agent` where it is needed.
- **What the renderer and the MCP server program need is data**: the `AgentDescriptor` (id, the
  CLI's command, label key, glyph, caps, whether a new session is named at start, its chat
  variants), in `src/core/agents/<id>/descriptor.ts`, gathered by `src/core/agents/descriptors.ts`,
  which imports nothing from Node. The renderer reads `descriptorOf(info.agent).caps.fork`, never
  the agent's name, and never a kit.
- **A capability is a fact the renderer shows, mirrored by a kit's nullness**: `fork` ⇔
  `kit.fork`, `remote` ⇔ `mainKit.remote`, `trash` ⇔ `kit.catalog.trash`, `chat` ⇔ `kit.chat`
  (and a non-empty `chat` list), `namedAtStart` ⇔ `kit.namer.atStart(…) !== null`.
  `tests/core/agents/parity.test.ts` asserts each pair for every registered agent. Shared main code
  reads the kit, never the cap.
- **Shared mechanisms stay shared and are fed by the strategies**: one way a pending pane binds its
  id, one wake batcher, one Usage history, one MCP server program, one team-block rule. The
  strategy produces or consumes; the mechanism never asks who.
- **Ids**: `AgentId` and `AGENT_IDS` (the order offered) in `src/core/agents/ids.ts`;
  `parseAgentId` is the one way a saved or received string becomes an id, and an unknown one is
  `null`, never read as another agent. `DEFAULT_AGENT` is the agent a session is taken for when
  nothing records another; whether an id is it is asked of `isDefault(id)`, the registry's.
  `CLASSIFIER_AGENT` names the agent whose CLI classifies turns (only `claude -p`, until the
  classifier is chosen per agent).

## Why not the alternatives

- **A class hierarchy** (`class Codex extends Agent`): a fix in a base method reaches every agent,
  the coupling 1.135 rules out; and the concerns vary independently.
- **Capability flags read in shared code** (`if (caps.lateId) … else …`): still a branch on the
  agent, one step removed. Flags are for what the renderer shows. Shared code may test whether a
  concern is `null`; a question with an agent-specific answer is a method of the strategy.
- **One interface for everything**: every agent stubs what it lacks, and a plausible stub hides a
  missing feature.
- **Agents loaded dynamically**: no consumer; the agents are known at build time.

## The rules and their check

`scripts/check-code-rules.mjs` parses every source with the TypeScript compiler. Outside an agent's
own folders (and `ids.ts`, `descriptors.ts`, the registries, `tests/`, `e2e/`):

| Rule | Forbids |
|---|---|
| `agent-literal` | a string whose whole text is an agent's id or CLI name |
| `agent-property` | a property, element access or key named as an agent id |
| `agent-identifier` | a declared name with an agent id as a word part (`claudeArgs`) |
| `agent-import` | an agent's folder imported from anywhere but its registry (or `descriptors.ts`, for a descriptor) and its own folder |
| `agent-default` | `DEFAULT_AGENT` or `CLASSIFIER_AGENT` compared or switched on |
| `descriptors-node-free` | a descriptor importing more than descriptors and `ids.ts`; the renderer or the MCP server program importing a registry or a kit |

**`ALLOWED`** in that script counts the known hits per file and rule, each with its reason; a file
with more hits than its entry fails, so a count only goes down. What is left:

- **Not the agent, though spelled like it** (permanent):
  - `src/renderer/terminals.ts`, `agent-property` 2: xterm's theme key `cursor` is the caret's
    colour;
  - `src/core/agentstate/mirror.ts`, `agent-identifier` 1: the terminal's cursor row;
  - `src/core/usage/cache.ts` (`agent-literal` 2) and `src/core/usage/history.ts` (1): the
    history's SQL column `claude`, kept for its bytes (no schema change); the TypeScript property
    is `given`.
- **Claude's own, by decision** (permanent):
  - `src/core/team/version.ts`, `agent-identifier` 1: `tests/core/team/**` imports `claudeVersion`
    from it; Claude's kit reads it as its version floor;
  - `src/core/classifier/input.ts`, `agent-identifier` 1: Claude Code's own environment variable;
    only `claude -p` classifies until the classifier is chosen per agent (1.161).
- **Kept until another block owns them**:
  - `src/core/usage/pass.ts`, `agent-identifier` 2: `PassPaths.claudeProjects`, which each agent's
    usage source replaces;
  - `src/core/paths.ts`, `agent-identifier` 12: `agentPaths()`'s members; `tests/core/paths.test.ts`
    asserts `claudeProjects`, and each catalog's `root()` reads them, so paths stay resolved in the
    paths module.
- **Pinned by the tests' imports**, while the first phase rewrote no test line (a test removed with
  an `expect(` fails the test-integrity check). **One follow-up after that phase merges**: move each
  into its agent's folder with its test, and remove its entry:
  - `src/core/chat/protocol.ts`: `claudeArgs`, `cursorArgs`, `claudeEvents`, `cursorEvents`;
  - `src/core/chat/processes.ts`: `cursorTurn` (an alias of `sendChat`);
  - `src/core/classifier/run.ts`: `findClaude`, `claudeCall`;
  - `src/core/context/files.ts`: `contextFiles.claudeSettings`;
  - `src/core/context/integrations.ts`: `CLAUDE_DEFAULT_CLEANUP_DAYS`;
  - `src/core/files/check.ts`: `isClaudeData`;
  - `src/core/sessions/info.ts`, `src/core/sessions/service.ts`: `SessionInfo.claudeNamed`.
  - `src/core/sessions/starting.ts`: the stand-in row's `claudeNamed`, which goes with that field.

## Two traps

- **The renderer's `tsc` has no Node types and checks every file it reaches**, type-only imports
  included. A type the renderer needs lives in a Node-free file: the descriptor's types are in
  `descriptors.ts`, `RawState` in `agentstate/raw.ts`, `Details` and `Head` in
  `sessions/details.ts`; `types.ts` re-exports the descriptor's types and may reach Node.
- **An import cycle through the registry**: a kit's strategy that needs shared machinery imports it
  from a module that does not import the registry (`chat/session.ts` for the chat processes,
  `agents/shared/screen.ts` for the state rules), never from the facade that asks the registry; or
  it is handed the value: a chat's environment is passed in, because `sessionenv.ts` reads every
  kit's `EnvRules` when it loads.

## Codex: starting it

Codex's kit is `src/core/agents/codex/` and `src/main/agents/codex/`; measured on codex-cli 0.169.0
(2026-11-20). It has no team block, fork, chat, trash, Remote Control or inbox: each is `null` in
its kit, and the renderer offers none of them for a Codex session.

- **The command**: `codex [-m <model>] [--add-dir <files>] [-c notify=[…]] [-c
  mcp_servers.menkar.…] [-- "<prompt>"]`, and `codex resume [--add-dir …] [-c notify=[…]] [-c
  mcp_servers.menkar.…] <id> [-- "<prompt>"]`. Options go after `resume`;
  `--` goes before the prompt, or a prompt starting with `-` is read as an option. A resume takes
  no `-m`: it would switch the thread's model. `--add-dir` names the project's files folder.
- **A `-c` value is a TOML basic string** (`tomlString`): Codex parses `-c` values as TOML and
  takes an unparsable one as a string, so a bare `42` or `true` would change type.
- **`notify`**: Menkar's `-c notify=[…]` runs its own program (`codex-notify.js`, shipped in the
  package, `docs/packaging.md`) through `/usr/bin/env ELECTRON_RUN_AS_NODE=1 <electron>`, never
  with that variable in Codex's environment, where every command Codex's shell runs would inherit
  it. A `-c` value outranks the user's `config.toml`, so the user's own `notify` is read at start
  (`config.ts`, with `smol-toml`) into the pane's chain file (`LaunchPlan.files`), and the program
  starts it detached with Codex's argument after writing its record, without waiting for it. A
  `notify` that is not a non-empty array of strings is not passed on.
- **Profiles are not read**: a top-level `profile` key in `config.toml` is an error in 0.169.0; a
  profile is only `-p`, which Menkar never passes.
- **The environment** (`env.ts`): a Codex started from Codex's own shell would inherit its parent
  thread's identity, sandbox markers and network proxy; those are dropped, with
  `CODEX_NETWORK_PROXY_SNAPSHOT_BROKERED_*` by prefix (`EnvPatterns.prefixes`) and the plugin
  folders `PLUGIN_ROOT`/`PLUGIN_DATA` only when `CODEX_THREAD_ID` is inherited too
  (`EnvPatterns.gated`). Codex's configuration (`CODEX_HOME`, keys) is the user's and kept.
- **Its `DeclaredWrites` are empty**: no call Menkar makes has Codex write into its own data (no
  name at start, no queued message yet).

## Codex: its sessions

`src/core/agents/codex/catalog.ts` reads Codex's rollouts, never its SQLite files:

- **The conversation** comes from `event_msg` lines: `item_completed` in paginated rollouts
  (`UserMessage`, `AgentMessage`, and tool items), `user_message`/`agent_message` in legacy ones.
  `response_item` messages are never read: they repeat each message and carry the injected
  environment and `AGENTS.md` text as if the user typed it.
- **Left out of the list**, as Codex's own picker does: subagent and guardian threads, `codex exec`
  runs, a rollout with no user message yet, and `archived_sessions/`.
- **Names** come from `session_index.jsonl`, read incrementally by offset; the last line per thread
  wins whatever its `updated_at`, and an empty name clears it. Codex's automatic titles and the
  user's renames look the same there; both show as the session's name.
- **A `.jsonl.zst`** (Codex compresses older rollouts) is streamed asynchronously
  (`shared/zstd.ts`, zlib's zstd, so Node `>=22.15.0`): the list reads its head and stops, and its
  badge is not shown, since its tail is not read; details, export and the last reply stream it
  whole. A plain `.jsonl` hides a `.zst` of the same name while both exist.
- **The watch** costs something: nothing is watched while Codex's home does not exist
  (`docs/sessions.md`, "Keeping it current"), so a Codex run for the first time after Menkar
  started shows its sessions at the next scan something else starts, or at Menkar's next start.

## Codex: binding a tab to its thread

Codex picks a new thread's id, so a Codex tab starts with none and binds to it later. Two sources,
in this order:

- **Its own process, on Linux** (`src/main/agents/codex/bind.ts`). At each join poll while the tab
  waits (1.5 s), main reads the open files of every process under the pane's shell and binds when
  exactly one `sessions/YYYY/MM/DD/rollout-*-<id>.jsonl` is held. A Codex tab is never joined by
  folder and time, a guess that can take another tab's thread in the same folder.
- **The turn-end record** Codex's `notify` program writes (`src/core/agents/codex/notify.ts`), only
  for a thread whose rollout exists: Codex's title generation notifies for a thread that never has
  one. The same record shows a thread change in a running tab: a thread minted after the tab
  started is a `/new` (the tab follows it as a clear), an older one a `/resume`, and a fork, whose
  rollout's first line names `forked_from_id`, is followed as a resume (1.63).

Measured on codex-cli 0.169.0 in a throwaway home with a stand-in API on 127.0.0.1 (2026-11-20,
P1a.4):

| What | Measured |
|---|---|
| A rollout while the TUI idles, before any message | none: the tab cannot be bound yet |
| The rollout after the first message is submitted | 9–24 ms (four runs) |
| The rollout with a positional prompt, from the command's start | 590 ms |
| The `/proc` read under the pane's shell, finding the thread | 8–24 ms |
| The process tree | `bash → codex`, one native binary holding the rollout open |
| After `/new` (measured by `codex`) | both rollouts held open: `/proc` serves only the first bind |
| `notify` | run once for the thread and once for the title thread; a record for the thread only; the user's own `notify` chained with its words and Codex's argument |

So a tab waits for its first message, and binds at the next poll after it, long before the turn
ends; elsewhere than Linux it binds when the first turn ends. Through Menkar's own build with the
real CLI (2026-11-20, P1a.7), a tab bound about 1.5 s after the first message was sent, from its
process, while an 8-second reply was still running; with an instant reply the turn-end record came
first.

## Codex: its state

`src/core/agents/codex/state.ts`, from Codex's screens captured on a real 0.169.0 TUI
(`tests/data/agents/codex/screens.json`). The pane's title is the strongest signal: a Braille
spinner while a turn runs (the only sign while a reply streams), `[ ! ] Action Required` at an
approval or a question. In the body, blocked is an approval or question card's footer, or the trust
prompt with its footer, in the last 14 lines; working is `esc to interrupt)` in the last 8. The
composer stays drawn while working, so it is never read; the pickers of `/model`, `/resume` and
`/new` are not questions. Not measured: the apply-patch card, a network approval and an MCP
elicitation, which are left to the title.

## Codex: usage and context

- **Tokens come from `token_usage_record` lines**, one per completed response, keyed by its
  `response_id`. `token_count` is not summed: Codex repeats it with no new request (a rate-limits
  update, a task's start, the re-estimate after a compaction). A rollout with no record (an older
  Codex) falls back to `token_count`'s `last_token_usage`, keyed by the thread's total so a repeat
  counts once. Codex's input includes the cached and written parts: Menkar's input is input − cached −
  written, its cache read the cached tokens.
- **Turns**: one per user message (`codex:<turn id>`, and `codex:<turn id>:<n>` for a message
  steered into the same task). A message starting with `[Menkar]` is a peer's. A task with no user
  message (a compaction) and a subagent's rollout open none: their tokens fall to the turn in effect,
  in the parent's session. Working time is the gaps between a turn's lines up to its end, a gap
  over two hours being idle; no blocked time is measured.
- **A fork that copies its parent's history counts nothing twice**: a copied turn keeps its
  parent's session.
- **Its cache is its own file**, `usage-cache-codex.sqlite`, beside Claude's, which is unchanged.
  A `.zst` is read only by the app's usage worker (`TurnSource.catchUp`), once; `docs/usage.md`
  says what that means for `menkar usage`.
- **Prices** are OpenAI's Standard tier rows in `prices.ts`, with their source and date.
- **Context** (`codex/context.ts`): the last `token_count` with its window in the rollout's tail,
  turned into Codex's own footer figure (a 12,000-token baseline left out). It is refreshed at each
  turn's end; a `.zst` rollout shows none.

## Messaging, and the tools each caller is listed

- **`kit.messaging`** is the agent's own way of messaging a session by name, `null` where it has
  none: Claude Code's `SendMessage` reaches Claude Code sessions only; Codex and Cursor have none.
- **What a caller is listed** is computed once, in main, from the installed agents
  (`toolsFile`, `src/core/control/shapes.ts`) and published to `control/tools.json` before any pane
  starts; the MCP server program reads it and never imports a kit:
  - `send_message` is listed to a caller when some installed agent is out of its own messaging's
    reach **and** has a Waker (`MainAgentKit.waker`). So Claude with Cursor lists none until
    Cursor's Waker exists, a Codex-only user is listed it (nothing else messages by name), and a
    Claude-only user is listed exactly the tools R10 recorded.
  - `start_session` gains `agent`, an enum of the installed agents, once two or more are installed.
  - `listChanged: true` is declared only when an agent other than the default is installed.
- **The caller's agent** is `MENKAR_AGENT` in the server's environment, set by the agent's mount;
  none means the default agent, so Claude Code's `--mcp-config` keeps its bytes.
- **Claude Code re-lists on `notifications/tools/list_changed`** (`claude-cli`, measured on
  2.1.329, 2026-11-20, a throwaway home and a stub server): `tools/list` is requested again 24–33 ms
  after the notification, and the new tool is callable by name in the same turn and the next. The
  re-list leaves the request's `tools` and `system` byte-identical: the new tool is announced in an
  appended message, so the notification does not break the prompt cache's prefix (measured on the
  request's bytes, not on the API's cache counters). Loading a deferred tool with ToolSearch is
  what inserts it in `tools`, as for any tool. ToolSearch found the new tool only from the next
  turn. Menkar sends no such notification yet: the installed agents are found once, at start, and
  a restart starts every server again (`docs/NOT_BUILT_YET.md`).
- **`send_message { name, text }`** (`src/core/control/send.ts`; D2) is answered for any caller,
  listed or not. It finds the session by name in the caller's project, as `last_reply` does, and
  posts at once through the receiver's Waker, so its answer says what the post did. It refuses a
  receiver the caller's own messaging reaches, naming that tool ("use SendMessage": a Claude
  session never takes the slower, unattributed path), the caller itself, and a message over 2,000
  characters. **The bridged frame** is the wake's own text (`wakeText`, `src/core/control/post.ts`,
  the content Claude's socket frame carries) around `from <name> (<agent>); reply with <tool>:
  <message>`: the agent in English, read by an agent, and the tool the receiver answers with, its
  own messaging when that reaches the sender, else `send_message`. A message carries no counts:
  those are the orchestrator's wakes'.

## Codex: waking

Plan 39 P1b.3, measured by `codex` on codex-cli 0.169.0 (2026-11-20).

- **The Waker is `codex queue --thread <id> --message <text>`** (`src/main/agents/codex/waker.ts`),
  Codex's own channel: the message goes to `$CODEX_HOME/queue_1.sqlite` and the session takes it
  as a turn of its own once its current turn is over, so nothing is typed into its terminal. It
  runs through `runWakeCommand` (`src/main/agents/shared/wake.ts`): the message as one argument,
  no shell, Menkar's own session variables removed, its `CODEX_HOME` the panes'.
- **Measured:** it returns in 50–75 ms; exit 0 means queued. An idle session takes the message
  within seconds, a busy one as its next turn. At an approval card the message waits and the card
  stays as it is until the human answers it: a queued message never answers an approval. Text is
  delivered byte for byte (newlines, quotes, 2,000+ characters), and two messages run as two turns.
- **Never with a `-c`:** with Codex's shared daemon running, a queue that would run its own
  embedded server is refused.
- **The outcome:** exit 0 → `posted`; another exit → a failure, logged with its error output.
  **A thread with no rollout** (a Codex session before its first message, or a provisional id)
  fails exactly as an unknown id does, so the rollout is looked for first and the answer is
  `no session`, the command not run.
- **A stopped session:** `codex queue` still exits 0 and the message waits in the queue until the
  thread is resumed, where it is the first turn, or the same turn as a resume's prompt. Menkar wakes
  only a session with a pane; a Codex that ended with an error leaves its shell, and so its pane,
  open, and a message queued then waits for the thread's next resume.

## Codex as a worker

Plan 39 P1b.2, measured by `codex` on codex-cli 0.169.0 (2026-11-20).

- **Menkar's MCP server** is mounted on every Codex start by one `-c mcp_servers.menkar.<key>=…`
  per key (`src/core/agents/codex/mcp.ts`), each value a TOML string: `command` Electron's binary,
  `args` the server program (`LaunchContext.mcpServer`), `env` `ELECTRON_RUN_AS_NODE`,
  `MENKAR_PANE` and `MENKAR_AGENT=codex`, `env_vars` the three XDG names, and
  `default_tools_approval_mode="approve"`, so Menkar's tools run with no approval card. Codex gives
  a stdio server only `HOME, LOGNAME, PATH, SHELL, USER, LANG, LC_ALL, TERM, TMPDIR, TZ`, then
  `env_vars`' names from its own environment (one not set is left out), then `env`: the pane's
  environment is not inherited, so the caller is named in `env`, and the server finds Menkar's
  state directories through the forwarded XDG names. Names, never values, are passed for them.
  The pane's environment reaches Codex's MCP client because any `-c` runs the TUI embedded.
- **`start_session`'s `agent`** is the caller's agent when absent; a name no agent has, an agent
  not installed, or one whose kit has no MCP mount (Cursor until P3) is refused.
  `remote_control` is refused for an agent with no Remote Control.
- **A provisional id.** Codex has no id until its first message, so `start_session` and `renew`
  place the new session under `pending:<random uuid>` (`src/core/projects/provisional.ts`) as
  member, child, assignee, name and model, and start its pane waiting for its real id as a New
  tab does (`/proc` at each join poll, else the first turn-end record). At the bind the real id
  takes the provisional one's place (`bindProvisional`: `followNewId`, then the provisional id
  forgotten), with its tab, task, name, model, mute, and a park or renew asked meanwhile; a first
  prompt is recorded as prompted then. A worker started with a prompt binds at its first poll.
  The provisional id never reaches `session_agents`, the sandbox's `started_sessions` or the
  activity log.
- **Menkar stopped before the bind**: at the next start every provisional id leaves its project
  (`dropProvisional`, as a forgotten session), its tasks lose their assignee (`unassign`) and keep
  their state, and its saved tab is dropped as an unknown session's; one log line names them. The
  thread, if Codex made one, stays in Codex's data and shows in Add session.
- **`renew`** ends the session and starts a new thread in its tab, as for Claude; `park_session`,
  `resume_session` (`codex resume <id>`) and `adopt_session` work as for any agent whose kit has
  an MCP mount.
