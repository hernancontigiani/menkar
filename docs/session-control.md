# Session control: Menkar's MCP server, renewing, starting, waking, and its skills

Decisions 1.70, 1.72, 1.73 and 1.74 (the human, 2026-11-11). A session renews itself when its task
is done (a `/clear` nobody types), an orchestrator starts its workers in Menkar tabs, a worker's
last reply is read by name, and a parent session is woken when a worker it started needs it or
ends a turn. The skills that teach agents to use these tools ship with Menkar as a plugin
(decisions 1.71 and 1.79–1.84, 2026-11-12; "The skills plugin" below). The orchestration mode
(`docs/orchestration.md`) adds four tools for topics and `adopt_session`, and shapes
`list_sessions`, `start_session` and the wake order.

## The shape

- **The server** (`src/core/control/server.ts`) is a program of its own, built to
  `out/main/mcp-server.js` by a main entry in `electron.vite.config.ts`, as the statusline is. It
  imports nothing from Electron or the DOM.
  - **How Claude Code starts it:** every Claude command Menkar runs carries `--mcp-config` with
    inline JSON (`mcpConfig` in `src/core/command.ts`): the command is Electron's binary, the
    argument the script, and `env: {"ELECTRON_RUN_AS_NODE": "1"}`. The config is not run through
    a shell, which is why the variable goes in `env`. Claude Code adds it to the pane's environment.
  - **Who is calling:** the server reads `MENKAR_PANE` from that environment and refuses every
    call without one.
  - **The protocol** (`protocol.ts`) is newline-delimited JSON-RPC written by hand:
    - `initialize` echoes the client's protocol version and offers `tools`; `ping` gets `{}`.
    - `tools/list` names nine tools; `tools/call` runs one.
    - Anything else with an id gets -32601, which is what Claude Code's first `server/discover`
      receives.
    - A failed call is `{content: [{type: "text", text}], isError: true}` with Menkar's own English
      sentence: it goes to the agent, not to the user.
- **The nine tools.** A session is always named by its name, never by its id: a renew or a
  `/clear` gives it a new id, and an id an agent kept would name nothing.
  - **`renew { prompt? }`:** once this turn ends, the session is hung up as closing a tab does, and
    a fresh session starts in the same tab with the same name and the optional first prompt.
  - **`start_session { name, prompt? | prompt_file?, remote_control?, group?, model?, loose?,
    role? }`:** a new Claude session in the caller's project, in a tab right after the caller's, not
    selected. The caller becomes its parent, unless `loose` is true.
    - **`loose`** and **`role`** (decision 1.111, 2026-11-13): loose records no parent (a
      consultant: never woken for, never read only); `role` is the label it is born with, empty
      for none (`readPlacement`, `placeStarted`, `src/core/orchestration/started.ts`). No tool
      changes an existing session's role.
    - **`model`** (decision 1.106, 2026-11-12) is passed as it is, `claude --model <model>`, so the
      orchestrator picks it per task. It becomes a command-line argument: anything but one word
      not starting with `-` is refused (`readModel`, `src/core/control/model.ts`). Menkar keeps it
      for the session (decision 1.108, below, at Renewing); a resume runs with Claude Code's own
      record of the session. `--model` is "Model for the current session" (`claude --help`,
      2.1.323): it never changes the user's default, which only `/model` does.
    - Over a reused name, the namesake's model follows to the new session, as after a renew; a
      `model` given wins.
    - A name another session of the project already uses in a tab is refused, and so is a group
      the project does not have.
    - The session starts in the caller's folder.
    - **A reused name** (decision 1.92, 2026-11-12): when stopped sessions of the project (members
      without a tab, not earlier conversations) have the name, the new session takes them over as
      after a renew (`takeOverName`, `src/core/projects/rekey.ts`). The most recently active one
      gives its place in the list, its group (the `group` argument wins when given), its hidden
      flag, its orchestration marks and its children; every one of them, with its own earlier
      conversations, becomes an earlier conversation of the new one, so the sidebar never shows two
      rows with that name. The caller is still the parent.
    - With the orchestration mode on and an orchestrator marked, a caller that is not the
      orchestrator is refused: "Only this project's orchestrator, ‹name›, starts sessions. Ask it to
      delegate the work." (`mayStart`, `src/core/orchestration/mayStart.ts`, decision 1.84). With
      the mode off, or none marked, anyone may.
  - **`list_sessions {}`:** the caller's project, name first, then the id, the shown state, the
    context percentage, the parent's name, and whether the session has a tab. Earlier
    conversations are left out. Each session also carries the orchestration mode's marks — `role`
    (its label or null), `orchestrator`, `priority` (the ★ of its current task, decision 1.114)
    and `with_you` — and the answer says whether the mode is on (`orchestration`). With the mode
    off the marks read null and false: off is the ordinary Menkar (`sessionMarks`,
    `sessionsAnswer`). A snapshot an older Menkar wrote, without
    them, reads the same.
  - **`last_reply { name }`:** the last text a session of the caller's project replied. It is read
    from the end of its transcript (`src/core/sessions/lastreply.ts`, read only, in chunks, never
    the whole file) and cut to its first `REPLY_MAX_CHARS` with a note. When the session has not
    replied since it renewed or was cleared, the answer is the last reply of its most recent earlier
    conversation, after a note that says so (`lastReplyAnswer`, decision 1.84, 2026-11-12): a
    worker's report outlives the renew that follows it.
    When two sessions of the project share the name (a stopped one kept it), the one with a tab is
    read, else the most recently active (`sessionOfProject`, 2026-11-12).
  - **`topic_add { title, context, blocking?, task? }`, `topic_update { number, title?, context?,
    blocking?, status? }`, `topic_close { number, decision }`, `topic_list { all? }`:** the
    project's topics for the human (`docs/orchestration.md`), kept by main in `topics.json`. Any
    session of the project may call them; a number of another project is "not found". `task`
    names the task the topic belongs to; a number the project has no task for is refused. Status
    set by hand is "open" or "discussing"; only `topic_close` closes. `topic_list` gives one topic
    per two lines — number, ★ when its task has the ★, title, who raised it by name, blocking, its
    task, status, decision when closed, then the context — in the sidebar's order (`topicTool`,
    `src/core/orchestration/topics.ts`).
  - **The task tools** (decision 1.113, `taskTool`, `src/core/orchestration/tasks.ts`), kept by main
    in `tasks.json`. Who may call each is part of the decision, and the refusals are our own
    sentences:
    - `task_add { title, assignee, star? }`: the orchestrator only, with the mode on ("Only the
      orchestrator adds tasks.", "The orchestration mode is off in this project."); the assignee by
      name (`sessionOfProject`). Answers "Task N added."; the task is queued.
    - `task_steps { number, steps }`: the assignee only ("Only the session the task is assigned to
      reports on it."); 3 to 7 non-empty lines; in progress at step 1.
    - `task_progress { number, step?, note, waiting_on? }`: the assignee only, after its steps;
      `step` from 1 to the number of steps, kept when omitted; with `waiting_on` the task is
      waiting, without it in progress.
    - `task_review { number, note }`: the assignee only; to review.
    - `task_close { number, outcome }`: the orchestrator only, with the mode on; `done` or
      `dropped`. A closed task takes no more reports ("Task N is closed.").
    - `task_list { all? }`: anyone; the open tasks, ★ first, each with its steps and the current one
      marked; `all` adds the closed ones.
  - **`adopt_session { name }`:** the orchestrator makes a session of its project its child, so
    Menkar wakes it for that session (decision 1.102, `docs/orchestration.md`). Refused to any
    other caller ("Only the orchestrator can adopt a session.") and with the mode off; the
    orchestrator's skill calls it only when the human asks explicitly.
- **The files between the server and main** live in `<cache>/control/` (`controlPaths` in
  `src/core/control/files.ts`). There is no socket and no port. Every file is written in `tmp/`
  and renamed into place, so nothing ever reads half of one.
  - **`alive.json`:** main's pid, written at start and removed at quit. Missing, or naming a pid
    that is gone, the server answers "Menkar is not running" at once.
  - **`requests/<id>.json` and `responses/<id>.json`:**
    - The server writes a request and waits up to `RESPONSE_WAIT_MS` for its response, through
      `fs.watch` and a short poll. Unanswered, it takes the request back, so main never acts after
      the agent was told it failed.
    - Main (`src/main/control.ts`, `RequestQueue`) passes over `requests/` on every change and once
      a second, and takes each id once. A request older than `REQUEST_MAX_AGE_MS` is dropped (Menkar
      was closed); a malformed one gets a refusal.
  - **`snapshot/<project>.json`:** written by main, debounced, whenever a project's sessions change
    state, context, tab or membership. `list_sessions` reads the snapshot that lists its own pane,
    without asking main.
  - **`turn-ends/<pane>.json`:** written by the Stop hook (`docs/context.md`) at each turn's end,
    with the session id.
  - **`prompts/<id>.md`:** the first prompt of a session Menkar starts. A `prompt_file` an agent
    names is read in main and copied here: an absolute path, a regular file, at most
    `PROMPT_MAX_BYTES`, UTF-8 with no NUL. Copies older than `PROMPT_KEEP_MS` are swept.
- **The command line** reads the prompt as `"$(cat '<copy>')"`, right after the session's identity
  (`buildCommand`'s `promptFile`). The prompt itself is never put on the line, so it needs no
  quoting.
- **Renewing** (`renew` in `src/main/workspace.ts`):
  1. The renew is noted.
  2. At the turn's end, from the Stop hook's record whose session id is the pane's, the tab is
     re-keyed to a new id first. This is `followClear`, the same function a followed `/clear` runs:
     project place, group, hidden flag, parents, Remote Control, mute, model, and the old id as an
     earlier conversation.
  3. The pane is hung up. Its exit leaves the tab in place.
  4. The new session starts in that tab, with `--model` when the old one was started with one
     (decision 1.108, 2026-11-13): `models` in `state.json` (`src/core/models.ts`, see
     `docs/sessions.md`), read before the re-key.

  Starting it first would race its own SessionStart record. When no record comes within
  `RENEW_FALLBACK_MS`, the pane's shown state turning idle or done stands in.
- **Parents** are on the project in `projects.json` (`docs/projects.md`). They are re-keyed by every
  follow, so a wake reaches a parent that renewed.
- **Waking a parent:**
  - **The event:** a child's shown state entering `blocked` ("‹name› is waiting at a permission
    prompt"), or leaving `working` for `idle` or `done` ("‹name› finished its turn"). It comes from
    `onShownChange` in `src/main/agentstate.ts`.
  - **Batching** (`WakeBatcher`, `src/core/control/events.ts`): per parent, events wait until no
    new one has come for `WAKE_DELAY_MS`, a child keeps only its latest, and all go in one message.
    In it, the events of children whose current task has the ★ come first; otherwise they keep the
    order the children first spoke in (decisions 1.78 and 1.114).
  - **The post** (`postToSession`, `post.ts`):
    - Main finds the parent's process in Claude Code's registry, `~/.claude/sessions/<pid>.json`,
      read only, by `sessionId`, and requires `peerProtocol` 1.
    - It connects to the registry's `messagingSocketPath`, writes one line
      `{"type":"user","message":{"content":"[Menkar] … (14:32:05)"},"from":"menkar","msg_id":"…"}`,
      and closes.
    - **Every post ends with the local time, seconds included** (`wakeFrame`, read through
      `src/core/clock.ts`; 2026-11-13). Claude Code drops a message identical to the sender's
      previous one ("Dropped a peer message from menkar: identical to the previous message from
      this sender"): a child that finished two turns in a row, before and after a renew, woke its
      parent once. Wakes are batched for `WAKE_DELAY_MS`, so two to one parent fall in different
      seconds; only the human repeating the same action within a second could match, and that
      repeat is the one dropped.
    - A parent with no Claude tab, or no entry in the registry, is logged and not woken.
  - Nothing is typed into a terminal.
- **Other posts to the orchestrator**, through the same `postToSession` and never batched: "[Menkar]
  The human wants to discuss topic N" (a double-click on a topic), "[Menkar] The human took control
  of ‹name›" and "[Menkar] The human handed ‹name› back" (a read-only tab's banner, decision 1.101).

## The skills plugin

- **What it is:** `plugin/` in the repository, `.claude-plugin/plugin.json` named `menkar` and four
  skills, `skills/<folder>/SKILL.md`. Claude Code names a skill after its folder, so they load as
  `menkar:orchestrator`, `menkar:worker`, `menkar:distill` and `menkar:specialize`.
  - **orchestrator:** coordinating sessions. Only it starts sessions or hands out work; it adds a
    task when it delegates, names its number in the handoff, and closes it after reviewing (a
    review that is the human's goes to them as a topic).
  - **worker:** taking a task from another session; with a task number, it sets 3 to 7 steps,
    reports each advance and hands it to review, never closing it; the report is its last
    message.
  - **distill:** keeping a specialist's skill current when its task is closed, then renewing.
  - **specialize:** turning what a session knows into a role with a skill of its own.
- **How a session gets it:** every Claude command Menkar builds carries `--plugin-dir <plugin>`
  (`buildCommand`'s `pluginDir`), after `--mcp-config` and before `--settings`. Cursor gets none.
  The folder is resolved when called (`pluginFolder` in `src/core/paths.ts`, from
  `skillsPluginDir` in `src/main/control.ts`): `resources/plugin` beside app.asar when packaged
  (`electron-builder.yml`'s `extraResources`, since `claude` cannot read inside the archive), the
  repository's `plugin/` in development. `package:check` requires the manifest, the four
  `SKILL.md` files and the orchestration mode's guide (`guide/orchestration-mode.md`) in the .deb.
- **The texts' rules,** held by `tests/core/plugin.test.ts`:
  - a body under 200 lines, with detail beyond that in `.md` reference files beside `SKILL.md`,
    each one named by it;
  - each skill declares its admission criterion ("What earns a line here: …");
  - no session's or project's name of this repository;
  - every tool written in backticks is one the MCP server lists.
- **What the skills lean on in Menkar:**
  - renewing always with a prompt that is the handoff: who the session is, the skill to load, what
    is in flight (1.84);
  - `last_reply` reading the previous conversation when a session has not replied since its renew;
  - the report also sent by name when the session handing the task did not start the worker, since
    a wake reaches only the parent;
  - screenshots and long outputs in `$MENKAR_FILES`.
- **What Claude Code writes on its own for a plugin**, in `~/.claude.json`:
  `pluginUsage["menkar@inline"]` on each start and `skillUsage["menkar:<skill>"]` when one is
  used. Menkar writes nothing under `~/.claude`. The skills' texts, once loaded, are part of the
  session's transcript like any other message.

## Measured on Claude Code 2.1.322 (2026-11-11, a throwaway home, a local stand-in for the API)

- **`--mcp-config` adds Menkar's server to the user's own.** `/mcp` lists it under "Built-in MCPs".
  Nothing about it is written under `~/.claude`, and there is no trust prompt. `mcpServers` in the
  `--settings` file is ignored, so it cannot carry the server.
- **The server inherits the pty's environment,** `MENKAR_PANE` included, also when the config gives
  an `env` of its own.
- **`--add-dir` and `--mcp-config` take every word that follows,** up to the next option. A prompt
  placed after them reached the session as one more folder. The prompt goes before them.
- **Menkar's own `--settings` removes the permission prompt.** With `permissions.allow:
  ["mcp__menkar"]` the tools ran without a prompt in both auto and manual modes. Without it, manual
  mode showed a permission card and auto mode sent the call to its server-side check.
- **The Stop hook** fires at the turn's end, after the tool call, with `MENKAR_PANE` and
  `session_id`.
- **A post to the messaging socket** from a process that is not the session's child behaves as
  follows:
  - It wakes an idle session into a new turn. The model reads "Another Claude session sent a
    message: …" with Claude Code's note that it is not the user.
  - It leaves a permission card as it was: nothing is approved, and the message is delivered when
    the card closes.
  - In bypass mode it is held behind a card, unless `crossSessionInbound` is `accept`.
  - Linux needs no auth line, and nothing is read back.
- **Claude Code's registry entries depend on the environment.** A claude started with
  `CLAUDE_CODE_CHILD_SESSION` (inherited from a Claude Code session that started Menkar) writes no
  `sessions/<pid>.json`, so it cannot be woken. A Menkar started from the desktop does not carry
  that variable.
- **The real check, end to end:**
  - A parent called `start_session`. The child opened in a tab after the parent's, not selected,
    and stopped at its Bash card.
  - The idle parent was woken once `WAKE_DELAY_MS` had passed, with "[Menkar] child is waiting at a
    permission prompt".
  - The parent called `renew`. A fresh session started in its tab with the given first prompt, and
    the child's parent moved to the fresh id.

## Rejected

- **A Unix socket or named pipe owned by main:** needed only for synchronous answers, which no tool
  needs. The files reuse the pattern of the SessionStart records.
- **A loopback HTTP server:** it is the only option that opens a port.
- **SQLite for the shared state:** it cannot tell another process that something changed, and a
  second SQLite file would amend the rule that the app's state is JSON.
- **Typing into the parent's terminal to wake it:** against the rule that nothing is typed into a
  running agent. For agents without a message channel this is an open decision.
- **A long-blocking `wait_for_event` tool:** the orchestrator would show as working, the human's
  own messages would queue behind it, and Claude Code moves such a call to the background after a
  while.
- **A plugin monitor as the wake:** it works, but a running monitor makes the registry say
  `shell` and `claude agents --json` say `busy` while the session is idle. That hides the very
  state Menkar reads, and the monitor outlives a killed agent.
- **`@modelcontextprotocol/sdk`:** a web framework, a schema library and more ship with it, for
  a handful of tools.
- **`--strict-mcp-config`:** it would drop the user's own MCP servers from Menkar's sessions.
- **Skills through `--add-dir` of a folder holding `.claude/skills/`:** they load, but the folder is
  opened to the agent's file tools.
- **Skills as MCP prompts:** only the human can call them (`/mcp__menkar__<name>`); the model can't
  load them.
- **MCP-served skills:** compiled off in Claude Code 2.1.322.
- **Installing the skills into `~/.claude/skills`:** a write under `~/.claude`, which is the human's
  decision, and a copy that goes stale with every Menkar update.
- **Folders named `menkar-orchestrator`, …:** they would read `menkar:menkar-orchestrator`.
