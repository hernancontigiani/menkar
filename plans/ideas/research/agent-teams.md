# Agent teams as the base of Menkar's orchestration mode — research

2026-11-12, Claude Code 2.1.322. Sources: the official docs (fetched as Markdown with `curl` from
`code.claude.com/docs/en/*.md`), the changelog, the binary's strings, and probes with the real CLI
in a throwaway HOME against a stand-in API on 127.0.0.1. **(inferred)** marks my own reading, not a
source's or a measurement's. Probe scripts and raw output:
`/tmp/claude-1000/-home-hernan-git-menkar/9291d37f-d7fd-4033-b21f-a83974fd6071/scratchpad/teams/`
(`fakeapi.mjs`, `drive.mjs`, `watch.sh`, runs `r2`/`r3` in-process, `r6` tmux).

## 1. Enabling, creating, spawning, display modes

- **Enabled** by the env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, in the shell or in a settings
  `env` block (user, project, local, `--settings`, managed); `0` turns it off live.
  https://code.claude.com/docs/en/agent-teams#enable-agent-teams
- **There is no "create team" step any more.** 2.1.178 removed `TeamCreate`/`TeamDelete`: "every
  session now has one implicit team — spawn teammates directly with the Agent tool's `name`
  parameter" (changelog). Measured: with the flag on, `~/.claude/teams/session-<8 hex>/config.json`
  appears at **session start**, before any teammate exists (r3 watcher, 08:47:32 vs spawn 08:47:36).
- **Who spawns:** only the lead, by calling the `Agent` tool with a `name` (not a fork, no
  `isolation`); "Claude Code doesn't ask you to confirm the launch", and Claude may name a subagent on
  its own, so "teams can form even when you didn't ask for one". The human spawns only by asking the
  lead in natural language. Not in `-p`/SDK sessions. https://code.claude.com/docs/en/agent-teams#how-claude-starts-agent-teams
- **Display modes** (`teammateMode` setting, or the hidden `--teammate-mode` flag): `in-process`
  (default), `auto`, `tmux`, `iterm2`. Split panes need tmux or iTerm2's `it2`; "not supported in VS
  Code's integrated terminal, Windows Terminal, or Ghostty".
  https://code.claude.com/docs/en/agent-teams#choose-a-display-mode
- **Measured — in-process:** one `claude` process; `pstree` shows no child process for the teammate
  (r2). The teammate has **no session id of its own**: its transcript is a sidechain under the lead's
  session, `projects/<cwd>/<lead-session-id>/subagents/agent-a<name>-<hash>.jsonl` plus a
  `.meta.json` (`"taskKind":"in_process_teammate"`, `teamName`, `agentType`, `permissionMode`).
- **Measured — tmux:** outside tmux, Claude starts **its own tmux server** with socket
  `claude-swarm-<lead pid>` under `$TMUX_TMPDIR/tmux-<uid>/` and shows "View teammates:
  `tmux -L claude-swarm-<pid> a`". The teammate is a **separate `claude` process** in pane `%0`,
  launched as
  `<binary> --agent-id carol@session-3fb47338 --agent-name carol --team-name session-3fb47338
  --agent-color blue --parent-session-id <lead uuid> --agent-type general-purpose
  --dangerously-skip-permissions --model claude-opus-5-5`, with **its own session id and ordinary
  top-level transcript** (`projects/<cwd>/821f2419-….jsonl`, entries carry `agentName`, `teamName`).
  It wrote a `sessions/<pid>.*.key` but no `sessions/<pid>.json` (r6). A long `TMUX_TMPDIR` fails:
  "Failed to create swarm session: … (File name too long)" (r4, r5).
- The binary reads `CLAUDE_CODE_TEAMMATE_COMMAND` to replace the executable launched in a pane
  (strings: `let o=process.env[Wra],{cmd:r,…}=o?…:eu({pinToCurrentBinary:!0})`). Undocumented
  (absent from https://code.claude.com/docs/en/env-vars). The **pane backend itself is not pluggable**:
  the registry chooses tmux or iTerm2 only (`[BackendRegistry] … No pane backend available`).

## 2. What lives on disk, its shape, and whether an outside program can read it

All under the user's `~/.claude` (docs: https://code.claude.com/docs/en/agent-teams#architecture;
shapes measured in r3/r6).

| What | Path | Lifetime |
|---|---|---|
| Team config | `~/.claude/teams/session-<8>/config.json` | removed when the session ends (docs); **left behind on SIGKILL** (measured) |
| Mailboxes | `~/.claude/teams/session-<8>/inboxes/<name>.json` | same directory |
| Task list | `~/.claude/tasks/session-<8>/<id>.json` + `.lock` | stays, cleaned by `cleanupPeriodDays` |
| Teammate transcript | in-process: `<lead-session>/subagents/agent-a<name>-<hash>.jsonl`; tmux: its own `<uuid>.jsonl` | ordinary transcript lifetime |

- **`config.json`**: `name`, `createdAt`, `leadAgentId` (`team-lead@session-…`), `leadSessionId`,
  `leadProcess {pid, pidSpace, claimedAt, procStart}`, `members[]` with `agentId` (`name@team`),
  `name`, `agentType` (`team-lead` for the lead), `color`, `joinedAt`, `tmuxPaneId` (`leader`,
  `in-process`, `%0`), `backendType` (`in-process`/`tmux`), `model`, `prompt` (the spawn prompt),
  `planModeRequired`, `cwd`, `subscriptions`, `isActive`. Docs: "holds runtime state … don't edit it
  by hand … overwritten on the next state update". Rewritten several times while a teammate joins.
- **Inbox entry**: `{from, text, summary?, timestamp, color?, msgV:1, msg_id, type:"message",
  read:false}`. Protocol messages are JSON inside `text`, e.g. an idle notice:
  `{"type":"idle_notification","from":"bob","idleReason":"available","result":"REPLY-3"}`.
- **Inboxes are a queue, not a log**: the recipient consumes and rewrites the file to `[]` within
  ~1 s (r3: written 08:47:36.898, `[]` at 08:47:37.812). A lead→in-process message was never seen
  in the file at 20 ms polling. The **durable record is the transcripts**: the lead's transcript
  gets a user entry `Another Claude session sent a message:\n<teammate-message teammate_id="bob"
  color="blue">{…idle_notification…}</teammate-message>`; the teammate's gets
  `<teammate-message teammate_id="team-lead" summary="…">text</teammate-message>`.
- **Task file**: `{id:"1", subject, description, status:"pending", blocks:[], blockedBy:[]}`
  (owner/claim fields appear on claim, not measured). Writers lock `.lock`.
- **Reading from outside, read only: yes, with caveats (inferred).** All plain JSON, but (a) the
  directory name is derived from the lead's session id, so Menkar can map it to the tab it started;
  (b) inboxes are transient — a panel shows "pending" mail at best, history must come from
  transcripts; (c) the format is internal and experimental, no compatibility promise; (d) a stale
  directory after a crash must be recognised by `leadProcess.pid`/`procStart`. **Writing** to any of
  it (to send a message or move a task) is a new write under `~/.claude` — a decision for the human
  under CLAUDE.md, and the docs warn the config is overwritten.

## 3. Roles, roster, messaging, permissions, persistence, limits

- **Role** = a subagent definition named at spawn ("Spawn a teammate using the security-reviewer
  agent type"). Applied: `tools` (plus `SendMessage` and Task tools added), `model`; in-process only:
  `disallowedTools`, `effort`, `autoCompactWindow`, body **appended** to the system prompt; split-pane:
  body **replaces** the system prompt, `mcpServers` honoured. **`skills` are not applied** in either
  mode. https://code.claude.com/docs/en/agent-teams#use-subagent-definitions-for-teammates
- **Roster**: `members` in `config.json`; "Teammates can read this file to discover other team
  members". Names are given by the lead at spawn; tell it the names to get predictable ones.
- **Messaging by name**: `SendMessage` to one recipient; no broadcast ("send one message per
  recipient"). Measured tool result: `{"success":true,"message":"Message sent to alice's inbox",
  "msg_id":…,"routing":{"sender":"team-lead","target":"@alice",…}}`. A message to an unknown name:
  "Not sent — no agent named 'carol' is reachable." Since 2.1.239 `ListAgents` lists live teammates.
- **The human to a teammate directly**: in-process, ↓ in the lead's agent panel, Enter, type
  ("Viewing @bob · esc to return", prompt "Message @bob…", measured r3); split-pane, click the pane.
  Both are **inside the lead's terminal or its tmux server** — there is no external entry point.
- **Idle notices**: automatic, carry the teammate's final answer (since 2.1.251) or the API error;
  the lead "doesn't need to poll". Measured: "Teammate @alice finished / REPLY-2" in the lead.
  Hooks: `TeammateIdle` (exit 2 keeps it working), `TaskCreated`, `TaskCompleted`.
- **Permissions**: teammates start in the lead's mode, no per-teammate mode at spawn; an in-process
  teammate runs under the lead's live rules; "Teammate permission prompts appear in the lead
  session". A message from another agent can't approve anything.
  https://code.claude.com/docs/en/agent-teams#permissions
- **Task list needs opt-in on current models.** Measured r2 (Opus 5.5): "No such tool available:
  TaskCreate. TaskCreate is disabled for this session". Task tools are default only on "Opus 4.7,
  Sonnet 4.6, Haiku 4.5, and earlier"; elsewhere `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` or
  `--allowedTools TaskCreate`. https://code.claude.com/docs/en/tools-reference#task-tool-availability
  With it set (r3), the task appeared in the lead and in the teammate's view.
- **Persistence**: one team per session, scoped to that session, cannot be shared; `/resume` and
  `/rewind` don't restore in-process teammates; the team directory is removed at session end. A
  message to a stopped in-process teammate revives it *within* the same running session.
- **Limits**: no nested teams (only the lead manages); lead fixed for its lifetime; no hard size
  limit, advice 3–5 teammates, 5–6 tasks each; teammates don't get the lead's history, only the
  spawn prompt plus CLAUDE.md/MCP/skills. https://code.claude.com/docs/en/agent-teams#limitations
- **Measured orphan**: SIGKILL of the lead left the tmux teammate and its tmux server running (r6;
  stopped by PID afterwards). Docs' own "Orphaned tmux sessions" troubleshooting entry agrees.

## 4. Stability

- Still labelled **experimental** at 2.1.322, "known limitations around session resumption, task
  coordination, and shutdown behavior"; `--teammate-mode` "is experimental and doesn't appear in
  `claude --help`".
- **The model has changed shape recently**: 2.1.178 removed explicit teams; 2.1.234 removed
  `teammateDefaultModel`; 2.1.251 changed the model-selection order and idle-notice content;
  2.1.290 changed an in-process teammate's `agent_id`; `team_name` in hooks is "Deprecated … will be
  removed".
- **Fixes in the last ~20 releases** (changelog): 2.1.317 "deleted agent team inboxes being
  re-created by a teammate's late message", "a re-created agent teammate being removed from its team
  by an earlier shutdown approval", tmux teammates "starting in auto mode when the lead session was in
  manual mode"; 2.1.311 "empty task list when coming back with `--resume`…"; 2.1.304 "approving a
  shutdown request from the main session no longer exits the whole CLI"; 2.1.257 "a teammate
  permission request being answered twice"; 2.1.207 "a crash loop … malformed teammate mailbox
  message". **(inferred)** active development, internal formats not frozen.

## 5. The three profiles mapped onto agent teams

From `plans/ideas/groups-and-orchestration.md` §"Three real profiles".

| Need | Agent teams | Fit |
|---|---|---|
| Orchestrator delegates to ephemeral generalist workers, reviews (Menkar) | Lead + named teammates, idle notices with results, task list | **Good** — but this is also what subagents already do, and the human says "in practice it works like subagents" |
| Workers created for a plan, gone after (LaburoMenos, ccai) | Spawn/shutdown by name | Good |
| Long-lived experts kept open for days, the human talks to one for an hour (LaburoMenos, ccai) | Team dies with the lead's process; no resume of in-process teammates; tmux teammates are orphaned, not reattached | **No** |
| Experts who exist before and outside the orchestration, opened by the human in Menkar tabs | Teammates can only be spawned by the lead; an existing session cannot join a team | **No** |
| Each worker in its own Menkar tab, with Menkar's states, usage, renaming | In-process: all inside the lead's pty, no own session id. tmux: own process and transcript, but owned by a tmux server Claude starts, not by Menkar's node-pty | **No** without driving tmux from Menkar |
| The human messages a teammate directly | Only through the lead's TUI (agent panel) or the tmux pane | Partial — works, but not from a Menkar tab |
| Orchestrator says "ask ‹expert›" (ccai) | Any teammate messages any other by name; roster in `members` | Good **inside one team** |
| Scheduling by resources (who may run together) | Task dependencies (`blockedBy`), file-locked claiming; nothing about resources | Partial — the lead's own judgement |
| Ask the human when no expert exists (ccai) | Lead asks in its own terminal | Fits only if the human is at the lead |
| Roles as definitions | Subagent definitions; **skills not applied** to teammates | Partial — Menkar's role skills would need copying into the body |
| Permission prompts | All bubble to the lead (or lead's mode inherited) | Mixed — central, but one terminal for every prompt |
| Several projects/repos (ccai, three products) | One team per session, teammates share the lead's settings sources | Weak (inferred) |
| Codex / Gemini later | Claude-only | **No** |

## 6. Recommendation: own blocks, borrowing agent teams' design; teams only as an option inside one tab

**Recommendation (inferred, for the human to decide): build the orchestration mode on Menkar's own
blocks**, and copy the parts of agent teams that are design rather than mechanism: names as
addresses, a roster readable by every member, roles as definitions, automatic idle notices carrying
the final answer, a task list with `blockedBy`, "ask the human" routed to the lead. Leave agent
teams usable **as they are, inside a single tab**, for short parallel bursts a lead decides on
(research, competing hypotheses, multi-lens review), and let Menkar **read** that team read-only to
show it.

Why not build on teams:
1. **Lifetime mismatch** — the two richer profiles depend on experts that last days and exist
   outside the orchestrator; a team lives and dies with one lead process and cannot be resumed.
2. **Tabs** — Menkar's value is each session in its own tab with its own states and usage; in-process
   teammates have no session or pty of their own, and tmux teammates belong to a tmux server.
   Hosting them would mean Menkar emulating or driving tmux (`CLAUDE_CODE_TEAMMATE_COMMAND` only swaps
   the binary, not the backend), against an undocumented, experimental contract.
3. **Writes under `~/.claude`** — anything beyond showing a team (sending mail, moving a task) is
   writing an agent's data, which CLAUDE.md reserves for the human's decision.
4. **Claude-only** — the mode must later carry Codex/Gemini sessions.
5. **Instability** — formats and semantics changed several times since 2.1.178.

What Menkar already has covers the same ground across independent sessions: its MCP server
(`start_session`, `renew`, `list_sessions`, `last_reply`), cross-session messaging by name with
waking and `notify_when_idle` (https://code.claude.com/docs/en/cross-session-messaging), and
sessions addressed by name — each a normal tab, resumable, in any project. What it lacks, and agent
teams show is worth having: **a roster the sessions can read** (who is who and their role), **a
shared task list** with dependencies, and **an automatic idle notice with the final answer** to the
orchestrator (today a one-shot subscription).

The mix, concretely (inferred):
- **Own blocks** for the mode: roster and roles as Menkar data exposed through its MCP server;
  tasks as Menkar data; messages over cross-session messaging; experts as ordinary tabs.
- **Agent teams inside one tab**, untouched: if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is ever passed
  by Menkar, it goes through `--settings` per session, never `~/.claude/settings.json`, and only for a
  session the human marks; never for all sessions, because the flag turns every named subagent into
  a teammate.
- **A read-only panel** for a tab whose session leads a team: members and state from
  `teams/session-<8 of the tab's session id>/config.json`, tasks from `tasks/session-<8>/`, the
  conversation from the transcripts, with tolerant parsing and a "format not recognised" fallback.

Risks of the recommendation:
- Menkar re-implements what Anthropic may later stabilise (an external team API, a pluggable pane
  backend); re-evaluate if the docs ever document a backend or a team protocol for outside programs.
- Cross-session messaging is itself young; its throttling and message-trust rules apply to every hop.
- Without the team's built-in idle notice, the orchestrator's knowledge of who is done depends on
  Menkar's own signals (agent state, `last_reply`, `notify_when_idle`).
- The read-only team panel can break on any release; it must fail closed.

Risks if the human chooses teams anyway: experts lost on every lead restart; every prompt and every
direct conversation through one terminal; a hard dependency on tmux on Linux and none on Windows
(Windows Terminal unsupported for split panes); orphans after a crash (measured).

## 7. Open points (not measured)

- Task claiming fields (`owner`, `in_progress`) and plan-approval/shutdown protocol messages were not
  driven by the stand-in API; only their existence is documented.
- Whether a session *outside* the team can `SendMessage` a teammate by name (`ListAgents` lists live
  teammates since 2.1.239, but cross-team addressing was not probed).
- The `--agent-id … --team-name …` flags a tmux teammate receives are undocumented; launching such a
  process from Menkar's own pty would make a teammate a Menkar tab, but would depend on internals.
