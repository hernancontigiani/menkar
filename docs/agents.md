# Agents — how the code is organised

Menkar runs more than one coding agent: Claude Code, Cursor, Codex and OpenCode. What differs per
agent is kept in one place per agent, so a change to one agent cannot break another and shared code never
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
  variants, its versions and which word of its `--version` output is the version — Codex prints
  `codex-cli 0.169.0`), in `src/core/agents/<id>/descriptor.ts`, gathered by `src/core/agents/descriptors.ts`,
  which imports nothing from Node. The renderer reads `descriptorOf(info.agent).caps.fork`, never
  the agent's name, and never a kit.
- **A capability is a fact the renderer shows, mirrored by a kit's nullness**: `fork` ⇔
  `kit.fork`, `remote` ⇔ `mainKit.remote`, `trash` ⇔ `kit.catalog.trash`, `chat` ⇔ `kit.chat`
  (and a non-empty `chat` list), `context` ⇔ `kit.context`, `tools` (its sessions can use Menkar's
  tools, so the orchestration mode can start them) ⇔ `kit.mcp`, `namedAtStart` ⇔
  `kit.namer.atStart(…) !== null`, `firstPrompt` ⇔ the launcher puts a prompt file on the command
  line (what "Ask an agent" needs). The descriptor's `teamLimits` is what the first-time card says
  of an agent that orchestrates or works for the orchestrator with limits (Cursor's, an idle wake
  being a restart and each tool asking unless allowed), `null` for the others.
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
(2026-11-20). It has no fork, chat, trash, Remote Control or inbox: each is `null` in its kit,
and the renderer offers none of them for a Codex session. Its team block is below ("Codex: the team
block").

- **The command**: `codex [-m <model>] [--add-dir <files>] [-c notify=[…]] [-c
  mcp_servers.menkar.…] [-c developer_instructions=…] [-- "<prompt>"]`, and `codex resume
  [--add-dir …] [-c notify=[…]] [-c mcp_servers.menkar.…] [-c developer_instructions=…] <id> [--
  "<prompt>"]`. Options go after `resume`;
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
- **Its `DeclaredWrites`** (`src/core/agents/codex/writes.ts`) are what `codex queue` writes at
  Menkar's wake, measured by `codex` (0.169.0, snapshot diffs in a home that exists): its queue row
  in `queue_1.sqlite`, its log in `logs_2.sqlite`, their `-wal`/`-shm`, the `-shm` of `state_5`,
  `goals_1` and `memories_1`, and `.sqlite-maintenance.lock` created once. The session taking the
  row is Codex's own turn, not Menkar's write.

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
- **`--disable plugins`, and the daemon:** a plain `codex queue` runs its own server, which syncs
  Codex's plugin marketplace (`git ls-remote` to GitHub, an empty `.tmp/git-XXXXXX/` left in its
  home) at every wake; `--disable plugins` does none of it. With Codex's shared daemon running, any
  override (`-c`, `--disable`) is refused ("cannot queue through an embedded app server while a
  local app-server daemon is running"); on that line alone the plain call is made, and the daemon
  queues it, syncing nothing here.
- **The outcome:** exit 0 → `posted`; another exit → a failure, logged with its error output.
  **A thread with no rollout** (a Codex session before its first message, or a provisional id)
  fails exactly as an unknown id does, so the rollout is looked for first and the answer is
  `no session`, the command not run.
- **A stopped session:** `codex queue` still exits 0 and the message waits in the queue until the
  thread is resumed, where it is the first turn, or the same turn as a resume's prompt. Menkar wakes
  only a session with a pane; a Codex that ended with an error leaves its shell, and so its pane,
  open, and a message queued then waits for the thread's next resume.

## Codex: naming

Decision 1.195 (the human, 2026-11-20, amending D5), measured by `codex` on codex-cli 0.169.0,
widened by decision 1.196 (the human, 2026-11-20): `codex` measured (its research file item 27)
that a Codex TUI with Menkar's MCP server mounted generates no title, so a session Menkar leaves
unnamed stays without one.

- **Which sessions:** every Codex session Menkar starts with a name, after its first message: from
  New, from the first-time card, from `start_session` (workers, consultants), and a renew of any of
  them, whose new thread is named the same. Each named session is kept in `state.json`'s
  `agent_named` (`docs/sessions.md`), so a renew after a restart still names. New and the card
  hold a named session under a provisional id until it binds, as `start_session` does. A session
  opened from New without a name is left to Codex, and a name on a session Menkar did not start is
  never touched.
- **The call** (`src/main/agents/codex/namer.ts`): `thread/name/set` sent to a separate `codex
  app-server --disable plugins` on the same home (`initialize` with a client name and version,
  `initialized`, the call, then its input closed: it exits 0 whatever it answered, so the answer is
  read). Codex appends the name to `session_index.jsonl` and sets `threads.name`; the running TUI
  never sees it, and its footer keeps no name. A thread with no rollout and an unknown id answer
  alike, `no rollout found…`: `no session`. A thread that already has the name is not called.
- **As soon as the rollout appears:** Codex accepts the call from the thread's first message.
  While a named session's pane waits for its id, Codex's home and the day folder its rollout will
  be in are watched, and each change looks for the pane's thread at once (the `/proc` bind), not
  only at the 1.5 s poll; the call follows the bind.
- **Codex's generated title:** while the TUI holds no name of its own it asks the model for a
  title at every user message and saves it only if the thread still has no name. Named from
  outside, the TUI never learns it, so **each message of a named thread costs one hidden title
  request** (accepted by 1.195). A title that landed before Menkar's call is Codex's own and is
  overwritten, and the name is looked at once more when the first turn ends, for the title saved
  between the TUI's check and its write. After that, a change is the human's `/rename`, which
  Codex stores exactly as a generated title: never overwritten.
- **Names are not unique** in Codex: two threads may share one, and `codex resume <name>` or
  `codex queue --thread <name>` then refuse. Menkar addresses threads by id only.

## Codex as a worker

Plan 39 P1b.2, measured by `codex` on codex-cli 0.169.0 (2026-11-20).

- **Menkar's MCP server** is mounted on every Codex start by one `-c mcp_servers.menkar.<key>=…`
  per key (`src/core/agents/codex/mcp.ts`), each value a TOML string: `command` Electron's binary,
  `args` the server program (`LaunchContext.mcpServer`), `env` `ELECTRON_RUN_AS_NODE`,
  `MENKAR_PANE` and `MENKAR_AGENT=codex`, `env_vars` the three XDG names, and
  `default_tools_approval_mode="approve"`, so Menkar's tools run with no approval card; and
  `-c 'features.code_mode.direct_only_tool_namespaces=["mcp__menkar"]'`, below. Codex gives
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
- **Menkar's tools are listed directly** (`DIRECT_KEY`, measured by `codex`, 2026-11-20): the
  catalog's models run in code mode, where an MCP server's tools are deferred: the model sees only
  the namespace `mcp__menkar` and calls a tool inside the `exec` tool as
  `tools.mcp__menkar__task_review(…)`. With `features.code_mode.direct_only_tool_namespaces`
  naming `mcp__menkar`, every tool comes with its schema in the first request, a turn `codex
  queue` opens included, and is called as `task_review` of the namespace. Spelled without
  `features.` the key is ignored, with a warning. A model outside Codex's catalog always lists
  them directly. The user's own value of that key, if any, is replaced for the session.

## Codex as the orchestrator

Plan 39 P1b.6. The first-time card (`docs/orchestration.md`) can start a new orchestrator of any
installed agent whose sessions can use Menkar's tools (`caps.tools`).

- **Marked at once under a provisional id**: `startNewSession` with `orchestrator: true` places an
  agent that picks its own id under `pending:<uuid>` as member and orchestrator, as
  `start_session` places its sessions; the real id takes its place at the bind.
- **Its first prompt is its agent's** (`TeamDelivery.orchestratorPrompt`, an i18n key built in
  main with the project's name, the guide's path and the orchestrator skill's `SKILL.md`): Claude
  Code's loads the skill with the Skill tool, Codex's reads its `SKILL.md` by path.
- **Named as the human typed it** (decision 1.196, as every Codex session Menkar starts with a
  name): through the same namer as `start_session`'s Codex sessions, once its thread exists, with
  the same `agent_named` mark, so a renew keeps it.

## Codex: the team block

Plan 39 P1b.5, measured by `codex` on codex-cli 0.169.0 (2026-11-20, its research file item 26).
Assembled as Claude's (`docs/session-control.md`, "The team block"); its part is
`plugin/team/codex.md`, and its delivery `src/core/agents/codex/team.ts`.

- **Delivered by `-c developer_instructions`** on every start, new and resumed: the pane's file
  `codex-developer-instructions.toml` (`LaunchPlan.files`) holds one TOML string, Menkar's block,
  a blank line, then the user's own `developer_instructions` from `config.toml`, byte for byte,
  read through the shell as `"developer_instructions=$(cat <file>)"`. A `-c` value replaces the
  file's for the run, so without it the user's own would be lost. The text is the first item of
  Codex's second developer message, before its skills, permissions and tools blocks; `AGENTS.md`
  stays a user message of its own. Codex sets no limit on its size. Without the team block (the
  mode off) nothing is passed and the user's own stays in effect; a block file that cannot be read
  passes the user's own alone.
- **A resume holds what the thread recorded** (`records: true`): Codex replays the developer
  message written at the thread's creation, and the run's `-c` is not seen until a compaction. So
  main keeps, per session, what it holds (`src/core/team/recorded.ts`, one JSON file per session in
  `controlPaths().teamHeld`, written whole when it changes, `null` for a session that held
  nothing), and a resume starts from it: one post if the facts changed while it was stopped, the
  whole block if nothing was recorded, none if they did not change. The file of a session trashed
  or deleted from Menkar is removed with it.
- **A compaction rebuilds the instructions from the running process's config**, the run's `-c`,
  manual or automatic alike: what the pane `started` with, as for Claude. Every resume therefore
  passes the block again, or the next compaction would drop it. The signal is the rollout's
  `compacted` line: Codex's catalog counts those a rollout grows by (`compaction.ts`, the line told
  by its start, its payload never parsed), carried on the session's row as `compactions`, and main
  takes a count that grew for a pane's session as the compaction record.
- **A change is told through Codex's waker** (`codex queue`), as its own turn; a thread with no
  rollout yet cannot be woken, so the post waits for the bind, which recomputes the pane's facts.
  A provisional id is no session to tell or record.
- **Skills by their `SKILL.md`** (decision 1.155 Q1): Codex has no flag that adds a skills folder,
  and reads a file outside its folder with no approval card. The block names each stored skill
  found with its file (`FoundSkill.file`, the nearest of a name), Menkar's own from the plugin's
  `skills/` folder, and one not found by its name alone; it is loaded "by reading its SKILL.md at
  the path given".

## OpenCode: its server and the panes' proxies

OpenCode's kit is `src/core/agents/opencode/` and `src/main/agents/opencode/`; measured by
`opencode` on OpenCode 2.3.0 (2026-11-21). It has no fork, chat, trash, Remote Control, inbox file
or namer: each is `null` in its kit. Its TUI is only a client of an OpenCode server, so Menkar runs
one of its own and attaches every OpenCode pane to it.

- **Menkar's server** (`server.ts`, `OpenCodeServer`): `opencode serve --stdio --port <p>`, started
  with the first OpenCode pane and stopped with the last one and at quit; the port a free one on
  127.0.0.1, the password random per server life, in `OPENCODE_PASSWORD` (Basic auth, user
  `opencode`). Its stdin is held by main: a server whose stdin closes exits, so a Menkar that dies
  leaves no server behind. Stopped by closing stdin, then its process group signalled by PID if it
  is still alive. One that dies while panes use it is started again on the same port with the same
  password, the next try no sooner than `RETRY_EVERY_MS` after the last; a first start that fails
  is retried only by the next pane's start.
- **Its environment** is `withoutSessionEnv` of Menkar's, without the pane variables
  (`MENKAR_PANE`, `MENKAR_FILES`, `MENKAR_PRIVATE`): an MCP server it starts inherits the server's
  whole environment but the password, so nothing of a pane or of the session that started Menkar
  may be in it.
- **`OPENCODE_CONFIG_CONTENT`** (`serverConfig`, `prepare.ts`) is the user's own, when they set
  one, plus `permission: {"menkar_*": "allow"}` beside their rules, so Menkar's tools run with no
  approval card; nothing else. It changes no model request (`opencode`, item 69). No skills path:
  OpenCode lists a skills folder to every session of its server.
- **Feature checks**: `GET /openapi.json` must list the instruction-entry route (the team block)
  and the per-folder MCP route (Menkar's tools); without one, that part is not done and a log line
  says why. Nothing in the window says it yet (`docs/NOT_BUILT_YET.md`).
- **The proxy** (`proxy.ts`, `OpenCodeProxies`): one loopback port per OpenCode pane, relaying to
  the server byte for byte and adding no credential: the TUI sends its own Basic auth from the
  password in the pane's environment. The TUI's `--server` is the proxy, so Menkar knows which pane
  each request comes from.
- **Its own network traffic**, the model catalog's fetch, is OpenCode's and left on: `docs/packaging.md`
  (decision 1.206).
- **Its own update check is the user's**: Menkar never sets `autoupdate` in what it passes, so the
  TUI's "Update available" modal shows in Menkar's panes as outside them, and no silent update
  leaves a version Menkar was not validated with (decision 1.208). Menkar's first prompt goes by the
  API, not typed, so the modal never takes it.
- **Why a server and proxies, not one TUI per session on its own**: a TUI alone starts the user's
  shared OpenCode service; and the server's events, its inbox and its per-folder MCP are what give
  Menkar the turn's end, a wake and its tools without typing into a terminal.

## OpenCode: starting a session

- **The session is made before its TUI** (`OpenCodePreparer.prepare`, the kit's `Preparer`):
  `POST /api/session {id, title?, location, model?}` with an id Menkar mints in OpenCode's own
  form (`ids.ts`, `ses_…`) and the name typed in New as its title, which OpenCode never replaces;
  the team entry put or removed; Menkar's MCP added to its folder when it has a team block; the
  pane's proxy opened; the server's event stream awaited; then a first prompt, if any, as
  `POST …/prompt {text, delivery:"steer"}`.
- **The command** (`launch.ts`): `opencode --server <proxy> -s <id>`, nothing else. A first prompt
  is never `--prompt`: OpenCode submits that again in the next session after a `/new`. The model
  is given at the create, as `provider/model`; a name not of that form is dropped, logged.
- **A start that cannot be prepared** (the server does not start, the create is refused) runs a
  plain shell in the pane with Menkar's own line saying so (`terminal.serverFailed`).
- **The environment** (`env.ts`): a Menkar started from inside OpenCode would inherit its session's
  id, its server's password and its markers; those are dropped, `AGENT` only when `OPENCODE` came
  with it, and `BUN_BE_BUN` always (an `opencode` that inherits it runs as Bun). The user's
  configuration variables are kept.
- **Its `DeclaredWrites`** (`writes.ts`): what Menkar's calls make OpenCode's server write, its
  database and its `-wal` and `-shm`.

## OpenCode: its sessions

`src/core/agents/opencode/catalog.ts` reads `opencode.db` (`$XDG_DATA_HOME/opencode/`, or
`OPENCODE_DB` taken from that folder), never in place:

- **SQLite, read without writing beside the agent's file** (`openAgentDb`,
  `src/core/agents/shared/db.ts`, every agent's route): with neither `-wal` nor `-shm` the
  database is opened `immutable=1`, read only; with both (OpenCode's server keeps both from its
  start, and a SIGKILL leaves both) the database and its `-wal` are copied into
  `<cache>/agent-db/` and the copy is read, since a read-only open in place rebuilds the `-shm`
  and moves its mtime, and `immutable=1` misses the `-wal`'s frames. The database file is copied
  again only when its size, mtime or inode moved, the `-wal` when it moved; a reader that may run
  beside another names its own copy folder. With a `-wal` and no `-shm` nothing is opened
  (`unreadable for now`).
- **On a worker thread** (`reads.ts`, `db-worker.ts`, built as `opencode-db.js`): node:sqlite and
  the copy are synchronous and the sessions scan runs in main, so every read of the catalog goes to
  one long-lived thread, started at the first read and ended when OpenCode is found uninstalled
  and at quit (`SessionCatalog.close`). Nothing is read, and no thread started, while OpenCode is
  not installed or has no database.
- **Listed** as OpenCode's own picker lists them: root sessions (`parent_id` null), not archived,
  with a user message. The title is the session's name whoever gave it (OpenCode's generated title
  and the user's look the same). Watched by its data folder; a find reads nothing while the
  database and its `-wal` keep their inode, size and mtime.

## OpenCode: which session a pane shows

The TUI moves between sessions on its own (`/new`, its picker on Ctrl+X L) and tells nobody, so the
pane's proxy reads it from the TUI's requests (D14):

- **Bound by** `POST /api/rpc/opencode.goal/get {"input":{"sessionID":…}}`, which the TUI sends
  only for the session it shows (at its start, after a create, at every picker switch), on the
  request alone, whatever the answer; by a create's body `{id}`; and by `…/prompt`'s path, each
  answered 2xx. `/view` is not read: it names a session being left. Every other route may name
  any session of its tab strip.
- **A move** goes to the pane's follow path: to a session its TUI created, as after a `/clear`; to
  one its picker opened, as after an in-session `/resume`.
- **A subagent's tool call** names its own session in `_meta["ai.opencode/sessionID"]`
  (`SESSION_META`); main follows `GET /api/session/<id>`'s `parentID`, up to 8 levels, to the
  session a pane shows (`MainAgentKit.callers`, `paneOfCaller` in `src/main/agents/registry.ts`).

## OpenCode: its state

- **The screen** (`state.ts`, from v2.3.0's TUI), read whole (`reads: 'wholeScreen'`): the TUI
  leaves its hidden cursor wherever it last drew, far above the card or the footer. Blocked is the
  permission card (its heading and its choices) in the last 12 lines, or the question tool's card
  (its keys' row, "↑↓ select  enter submit  esc dismiss", in the last 3); working is "esc
  interrupt" in the footer's last line only, so a reply that quotes it is not a turn. The tab
  strip's spinner also turns while a message only waits in the inbox, so it is not read.
- **The server's events** (`events.ts`, `Executions`): an execution's end is the pane's turn-end
  record. A subagent runs in a session of its own and its root's execution ends while it works: a
  root counts as running while any session under it does (by `session.created`'s `parentID`), its
  idle screen then reads working (`ServerRuns`, read by `PaneWatcher`), and its turn ends only when
  nothing under it runs, `SETTLE_MS` after a subagent's end.

## OpenCode: usage and context

Read from `opencode.db` through `openAgentDb`, with a copy of the usage pass's own:
`docs/usage.md` ("Per agent", OpenCode) for turns, tokens, the exact cost and
`usage-opencode.jsonl`; `docs/context.md` (OpenCode's reading) for the ring.

## OpenCode: waking

`inboxWaker` (`waker.ts`): `POST /api/session/<id>/prompt {text, delivery:"queue"}` on Menkar's
server, OpenCode's durable inbox. A busy session takes it after its running step, an idle one at
once; it waits behind a pending permission, which it never answers; nothing is typed into the
terminal, so a half-typed message stays in the composer. 404 is `no session`, and so is a wake
while Menkar's server is not running: Menkar wakes only a session with a pane.

## OpenCode in the orchestration mode

- **Menkar's MCP per session folder**: `PUT /api/experimental/mcp/menkar?location[directory]=<folder>`
  (`mcpEntry`, `mcp.ts`: Electron's binary and the server program, `ELECTRON_RUN_AS_NODE`,
  `MENKAR_AGENT=opencode`, `codemode: false` so the tools are listed directly), once per server
  life and folder, when a session there starts with a team block or is given one later. The match
  is exact: a session in a subfolder gets nothing. A session outside the mode sends exactly the
  request it sends on any server (`e2e/opencode.spec.ts`).
- **The caller**: one MCP connection serves every session of a folder, so no `MENKAR_PANE` names
  it; the server program reads the session from `_meta[descriptor.callerMeta]` and main finds its
  pane through the proxy (above). A session no pane shows is refused.
- **Skills through `load_skill {name}`** (`McpMount.servesSkills`): its team entry names the
  stored skills, and the tool answers a skill's text with "Base directory for this skill:" and its
  folder, as OpenCode's own skill tool does: Menkar's own (`menkar:<name>`, from the plugin) or one
  found for the pane's session. Listed only to a caller whose kit serves skills.
- **The team block** is the session's instruction entry `menkar.team`
  (`PUT /api/experimental/session/<id>/instructions/entries/menkar.team`): put before the first
  prompt, replaced whole when the facts change (`tell` answers `stored`: OpenCode gives the model
  the new text at its next step, with no turn of its own), removed when the session holds no
  block. Its part is `plugin/team/opencode.md`; the table is `docs/session-control.md`'s, "The
  team block, per agent".
- **A session open in another OpenCode server too** (D9, decision 1.205): Menkar's server reports
  only its own executions, while `session_v2`'s busy and idle times are written by whichever
  server ran the session last. At a resume and before each wake, a session whose row says a turn
  runs that Menkar's server does not run is logged, and its pane shows one line of Menkar's own
  once its TUI has drawn (`Terminal.say`, never the pty's input). A server killed mid-turn leaves
  the row busy, so the line can be shown in error until that session's next turn ends.

## Cursor: its integrations items

Two items in Settings' Cursor section, each turned on by the user and removable on its own
(decision 1.140), offered by the kit's `integrations` (`src/core/agents/cursor/integrations.ts`)
and listed by main for every agent whose kit has them (`src/main/agent-integrations.ts`), greyed
with a line while the agent's CLI is not on the PATH:

- **Menkar's hooks** (D13): one entry each for `beforeSubmitPrompt`, `stop` and
  `afterAgentResponse` in `~/.cursor/hooks.json`, always there whatever `CURSOR_CONFIG_DIR` says.
  A plugin's turn hooks run only when the user's own file has a hook for the same event; these
  entries run Menkar's hook program (`cursor-hook.js`, shipped beside main's entry) through
  `/usr/bin/env ELECTRON_RUN_AS_NODE=1 <electron>`, and Cursor runs `command` through a shell.
  Each carries `timeout: 3`: Cursor waits for a hook before going on, so a hung program costs a
  turn up to that per event. **None sets `failClosed`**: with it false (Cursor's default) a hook
  whose program is missing or fails is skipped with no delay and nothing on screen (`cursor`,
  measured on 2026.11.13-eacade1, 2026-11-23).
- **Allow entries** (D7): one, `Mcp(plugin-<folder>-menkar:*)`, in `permissions.allow` of
  `cli-config.json`, which Cursor reads from `$CURSOR_CONFIG_DIR`, else `$XDG_CONFIG_HOME/cursor`,
  else `~/.cursor`. Cursor names a plugin's server after its folder's basename, so every pane's
  plugin folder shares one name, and the wildcard covers every tool, those added later included.
  **The folder's name is the flavour's directory name** (`menkar` or `menkar-sandbox`, `set`,
  2026-11-23), so neither flavour's removal can take the other's entry.
- **The rest of the file keeps its bytes**: the text is edited in place (`json-text.ts`), an
  added element after the last with the separator its container already uses, so removing it
  deletes exactly those bytes; keys created to hold an entry are removed when left empty. The
  file keeps its mode, a symlink is followed to its target, and a dated copy goes to Menkar's
  `settings-backup` first. What was added is recorded in Menkar's own data
  (`cursor-integrations.json`), and removing finds it by value: **Cursor rewrites
  `cli-config.json` at each start** in its own layout and drops keys it does not know, so no
  marker of Menkar's can live in it. A missing `hooks.json` is created and, when it holds only what
  Menkar created, deleted on removal; a missing `cli-config.json` is refused (Cursor creates it).
- **The sandbox's entries name its own program**: its section says to turn them off before
  uninstalling it, and uninstalling first leaves entries that Cursor skips, as above.
