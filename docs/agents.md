# Agents — how the code is organised

Menkar runs more than one coding agent (Claude Code and Cursor today). What differs per agent is
kept in one place per agent, so a change to one agent cannot break another and shared code never
asks which agent it has (1.135). The code says what each piece does; this file keeps why it is
shaped this way and what was rejected.

## The pattern: a kit of strategies per agent, chosen once

- **One interface per concern** (`src/core/agents/types.ts`, `src/main/agents/types.ts`): starting
  (`Launcher`, `McpMount`, `Namer`, `EnvRules`), the team block's delivery (`TeamDelivery`,
  `MainTeamDelivery`), the sessions (`SessionCatalog`), the state read from the screen
  (`StateRules`), ids (`SessionIds`, `PaneFollow`), `Fork`, Remote Control (`Remote`), waking
  (`Waker`), the orchestrator's inbox file and its delivery read back from the transcript
  (`PromptInbox`, `MainAgentKit.inbox`; decision 1.178), the settings file and chat tabs
  (`ChatStrategy`). An interface enters with the first
  agent that implements it, never ahead of its consumer.
- **A kit per agent** groups its strategies: `src/core/agents/<id>/index.ts` (`AgentKit`, plain
  Node) and `src/main/agents/<id>/index.ts` (`MainAgentKit`, what needs Electron's main process).
  **A concern the agent lacks is `null` in its kit**, never a stub that pretends: Cursor has no
  fork, no Remote Control, no team block, no waker, no inbox.
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
ends; elsewhere than Linux it binds when the first turn ends.
