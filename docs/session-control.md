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
- **The tools** (`TOOL_NAMES`). A session is always named by its name, never by its id: a renew or a
  `/clear` gives it a new id, and an id an agent kept would name nothing.
  - **`renew { prompt? }`:** once this turn ends, the session is hung up as closing a tab does, and
    a fresh session starts in the same tab with the same name and the optional first prompt.
  - **`start_session { name?, task?, prompt? | prompt_file?, remote_control?, group?, model?,
    loose?, role?, folder? }`:** a new Claude session in the caller's project, in a tab right after
    the caller's, not selected. The caller becomes its parent, unless `loose` is true.
    - **`folder`** (decision 1.124, 2026-11-14): an absolute path where it starts, one of the
      project's folders (its sessions' folders, earlier conversations included, and the ones the
      human added; `docs/orchestration.md`). One that is not is refused: "‹folder› is not one of
      this project's folders: ‹the list›. The human adds one in the project's orchestration
      settings." (`startFolder`, `src/core/orchestration/folders.ts`); one that no longer exists on
      disk is refused with the list too. Without it, the caller's folder. It combines with `task`,
      `loose`, `role` and `model`.
    - **`task`** (decision 1.118, 2026-11-13): the session is named `<project>-t<N>` by Menkar and
      becomes the task's assignee (`startName`, `src/core/orchestration/workers.ts`; `assignTask`);
      `name` may then be omitted, and a given one must be that name. Without `task`, a name is
      needed ("A name is needed to start a session: give name, or task."). A task assigned to
      another session ("Task N is assigned to ‹name›."), closed, or unknown is refused.
    - **The cap** (decision 1.118): when the new session would be a worker (the orchestrator's
      child, no role, not loose) and the project runs its `workers_cap` of them, it is refused:
      "This project runs at most N workers at once; N are running. Leave the task queued and start
      it when one finishes." (`capRefusal`). An expert or a consultant is not.
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
    Each session also carries `skills`, `[{ name, maintainer }]` as the human stored them for it
    (decision 1.152), `[]` with the mode off, so the orchestrator can name an expert's skill, read
    only, in a worker's task.
    Each session carries its `folder` (where its pane runs, else the one its transcript records;
    null when neither is known), and the answer the project's `folders` (decision 1.163): its
    sessions' folders and the ones the human added, minus those gone from disk — what
    `start_session { folder }` accepts, so the orchestrator starts a worker in another repository
    without a refused call. Both are there with the mode on and off; a snapshot an older Menkar
    wrote reads as null and `[]`.
  - **`last_reply { name }`:** the last text a session of the caller's project replied. It is read
    from the end of its transcript (`src/core/sessions/lastreply.ts`, read only, in chunks, never
    the whole file) and cut to its first `REPLY_MAX_CHARS` with a note. When the session has not
    replied since it renewed or was cleared, the answer is the last reply of its most recent earlier
    conversation, after a note that says so (`lastReplyAnswer`, decision 1.84, 2026-11-12): a
    worker's report outlives the renew that follows it.
    When two sessions of the project share the name (a stopped one kept it), the one with a tab is
    read, else the most recently active (`sessionOfProject`, 2026-11-12).
    A turn opened only by Menkar's team updates (below, "The team block") is passed over and the
    search goes on before it, so a worker's report stays its last reply; a turn a team update
    opened that also had a peer's or the human's message is returned (2026-11-16).
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
    - `task_add { title, assignee?, star? }`: the orchestrator only, with the mode on ("Only the
      orchestrator adds tasks.", "The orchestration mode is off in this project."); the assignee by
      name (`sessionOfProject`), or none until `start_session { task }` (decision 1.118). Answers
      "Task N added."; the task is queued.
    - `task_steps { number, steps }`: the assignee only ("Only the session the task is assigned to
      reports on it."); 3 to 7 non-empty lines; in progress at step 1.
    - `task_progress { number, step?, note, waiting_on? }`: the assignee only, after its steps;
      `step` from 1 to the number of steps, kept when omitted; with `waiting_on` the task is
      waiting, without it in progress.
    - One in progress per assignee (decision 1.119): `task_steps`, or `task_progress` without
      `waiting_on`, while another of the assignee's tasks is in progress is refused ("Finish or
      wait on task N first.").
    - `task_review { number, note?, waiting_on?, waiting_note? }`: the assignee, with its `note`,
      hands the task to review; `waiting_on` is whom it waits on there, `orchestrator` (the default
      when omitted), `human`, `pr-approval` or `pr-merge`, and `waiting_note` one line beside it
      (the PR's number). The orchestrator, after its own review, calls it on a task in To review to
      change only those two, and its `note` if it gives one; refused on a task in another state or
      without `waiting_on` (decision 1.164).
    - `task_close { number, outcome }`: the orchestrator only, with the mode on; `done` or
      `dropped`. A closed task takes no more reports ("Task N is closed.").
    - `task_list { all? }`: anyone; the open tasks, ★ first, each with its steps and the current one
      marked; `all` adds the closed ones.
    - `task_star { number, star }` (decision 1.144): the orchestrator only, with the mode on ("Only
      the orchestrator sets a task's ★, when the person asks."); an open task of the project
      (`setTaskStar`), `true` sets the ★ and `false` removes it. The orchestrator's skill calls it
      only when the human asks explicitly.
  - **`adopt_session { name }`:** the orchestrator makes a session of its project its child, so
    Menkar wakes it for that session (decision 1.102, `docs/orchestration.md`). Refused to any
    other caller ("Only the orchestrator can adopt a session.") and with the mode off; the
    orchestrator's skill calls it only when the human asks explicitly.
  - **`park_session { name }`** (decisions 1.118, 1.120): the orchestrator only, for a worker (its
    child, no role) whose current task is waiting, or whose task is in To review waiting on a PR
    (`mayPark`, decision 1.164). Once the worker's turn is over — its
    shown state idle or done, or the Stop hook's record — Menkar stops it as
    closing its tab does, never mid-turn, and marks it parked (`orchestration.parked`).
  - **`resume_session { name, prompt? }`** (decision 1.118): the orchestrator only, with the mode on;
    a parked or stopped Claude Code session of the project, refused when it has a tab. It opens in
    a tab after the orchestrator's, not selected, as `--resume <id>`, the prompt as its first
    message; its parked mark goes. A worker is refused at the cap, as `start_session` is.
  - **`task_close`'s worker** (decision 1.120): the worker started for that task — the
    orchestrator's child, no role, named `<project>-t<N>` for it (`hideOnClose`) — is stopped after
    its turn, as parking does, and hidden.
  - **`set_workers_cap { cap }`** (decision 1.123): the orchestrator only, with the mode on; a whole
    number from 1, or null or absent for any number (`capTool`). The orchestrator's skill calls it
    only when the human asks explicitly.
  - **`human_back {}`** (decision 1.167): the orchestrator only, with the mode on, and only when
    the human has said explicitly that they are back; it clears the human's away state as "I'm
    back" does, and the other running orchestrators get "The human is back", the caller not
    (`backTool`, `src/core/presence.ts`).
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
    - **A post to the orchestrator** of a project with the mode on ends, after the time, with the
      Work view's three counts, " · 2 topics · 1 working · 1 waiting" (decision 1.125, 2026-11-14):
      `wakeSession` passes them in (`postCounts`, `src/core/orchestration/counts.ts`, the tiles'
      own count), so `post.ts` stays pure. In English, like the rest of the frame: an agent reads
      it. Posts to other sessions have no counts.
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
  - The orchestrator's `workers.md` (decisions 1.118–1.120, 1.123): a worker per task, parking and
    resuming, the cap, experts with several tasks; the worker's skill: an expert's skill it loads
    is read only, its lesson goes in the report (one maintainer per skill, 1.119).
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
  - the team block (below): who the session is, what to load, and how the team talks. The
    `orchestrator`, `worker` and `distill` skills point to it in one sentence, and, for a session
    with no block (the mode off), to `team/common.md` and `team/claude.md` in the plugin folder;
  - renewing with a prompt that is the handoff of what is in flight; Menkar's block says who the
    new session is and what it loads (1.84, amended 2026-11-16);
  - `last_reply` reading the previous conversation when a session has not replied since its renew;
  - screenshots and long outputs in `$MENKAR_FILES`.
- **What Claude Code writes on its own for a plugin**, in `~/.claude.json`:
  `pluginUsage["menkar@inline"]` on each start and `skillUsage["menkar:<skill>"]` when one is
  used. Menkar writes nothing under `~/.claude`. The skills' texts, once loaded, are part of the
  session's transcript like any other message.

## The team block

What a Claude session of a project in the orchestration mode needs to work in the team (decisions
1.150–1.154, 1.157), written once and delivered by Menkar, not by a handoff another agent writes.

- **Its text,** English, read by an agent: three parts joined by a blank line (`teamBlock`).
  - **The facts,** built per session by `teamFacts` (`src/core/team/block.ts`) from a plain
    `TeamInput` (`teamInput`, `src/core/team/input.ts`): who it is, its role, its parent and the
    orchestrator, the skills to have loaded (`menkar:orchestrator` for the orchestrator, then the
    stored ones: maintained, read only with their maintainer, or not found), `menkar:worker` when
    a task is handed to it, and when to renew, with the human's `ring_warn`/`ring_full`.
  - **The common part,** `plugin/team/common.md`, and **the agent's,** `plugin/team/claude.md`.
    `package:check` requires both in the .deb.
  - **A name** in the facts is a custom title or the name Menkar started the session with; Claude's
    derived title is not one, so it never changes the facts. A session with none reads as "a new
    session"; another session with none is called by its id's first eight characters.
- **Only with the mode on.** With it off no input is built, no file is written and the command line
  is the one without the team, to the byte. An agent whose kit has no team delivery (Cursor) gets
  nothing.
- **The input at start** is built for every Claude pane whose tab belongs to a mode-on project: a
  member from the project; a session not yet a member (the human's new session, a fork) from the
  identity it starts with, with no role, parent or skills. That is what it will be once it joins.
  Which stored skills it can load is read when it starts (`listSkills` on its folder and the
  user's skills, `foundFor`).
- **Delivery for Claude** (measured on 2.1.325):
  - The block is written to `<cache>/menkar/control/team/<pane-id>.md` (`controlPaths().team`)
    through `writeTextAtomic` **before** the command is built: Claude stops at once on a missing
    file. Files older than a day are swept hourly with the prompt copies (`sweepTeamFiles`).
  - Claude's Launcher, given the `teamFile`, appends `--append-system-prompt-file '<path>'` **last**; a resume
    puts `--system-prompt-snapshot off` before it, on **every** resume of a mode-on tab. Claude
    reads the file once, at start; a compaction or `/clear` rebuilds the prompt from that text.
  - **Why the snapshot flag on every resume:** without it a resumed conversation keeps the block
    recorded when it began until its next compaction, and a later resume without it falls back to
    that first text even after one with it. With it, the `system` text stayed byte-identical over
    12 requests across a branch, a commit and a new file: the date and the git status live in the
    messages, not in `system`. Its only cost is one cache write on the first request after a
    resume whose block changed.
  - **If the file cannot be written** the pane starts without the flags, the pane's id is logged,
    and the pane is outside the team for its life: never posted.
- **The version floor: Claude Code 2.1.267.** `--system-prompt-snapshot` is in the changelog at
  2.1.267 and in the CLI reference at 2.1.257; the later one is the floor (`TEAM_FLOOR`,
  `src/core/team/version.ts`). `--append-system-prompt-file` exists by 2.1.69. An older CLI given
  an unknown option exits at once, so main reads `claude --version` once per binary (path and
  mtime, off the UI path) and, below the floor or when it says no version, starts
  mode-on panes without the flags, logs it, and the pane is outside the team. Below the floor one
  toast per run says so (`team.oldClaude`).
- **Keeping a running session current** (`src/core/team/posts.ts`, `src/main/team.ts`). Per Claude
  pane main keeps `started` (the block its system prompt started with, null without one) and `held`
  (what it believes now: `started`, null for a fork, which carries its source's, then the latest
  delivered post). `teamPost(held, current)`: a block and now none → the leaving line; none and now
  a block → the whole block; other facts → the facts; the same facts → nothing.
  - **What triggers a recompute:** a `projects.json` change (role, stored skills, the orchestrator
    mark, a parent, the session leaving the project, the mode switched, the project's name), a
    change in the sessions list (names) or the settings (the ring thresholds), a pending session's
    join, and a SessionStart record naming the pane: `compact` and `clear` set `held` back to
    `started`; a `resume` naming **another** session (an in-tab `/resume`) sets it to null; the
    record a tab's own `--resume` start writes names the pane's session and changes nothing.
  - **Coalesced:** each trigger restarts the pane's `TEAM_SETTLE_MS` wait, so a burst (the
    first-time card's mode, mark and hand-over) is one post carrying the latest. No disk is rescanned
    by a recompute.
  - **Posted** through `postToSession` (`wakeFrame`'s time, and the counts to the orchestrator):
    "[Menkar] Team update: your facts are now: …", "… your team instructions, replacing any earlier
    ones: …" or "… the "Your team in Menkar" instructions no longer apply to you.", each ending "No
    reply is needed." `held` changes only on `'posted'`; `'no session'` is tried
    `TEAM_POST_TRIES` times `TEAM_POST_GAP_MS` apart; anything else is logged and the next trigger
    tries again.
- **A post starts a turn.** At a working → idle/done of a pane delivered a team post since its last
  turn end, main reads its transcript (`onlyTeamUpdates`, beside `lastReply`): when every message
  that opened the turn is a team update, its parent is not woken (`wakesParent`). A pane delivered
  no team post reads nothing. A team update is a user line with `origin.kind` `peer` and
  `origin.from` `menkar` whose delivered text (after the line Claude Code puts before a peer's)
  **starts** with "[Menkar] Team update:", as Claude Code 2.1.325 records it.
- **Three pieces kept apart,** so another agent can bring its own: what a session holds at start,
  how a start delivers, how a change is told. `teamPost`, its triggers and the posts'
  consequences are agent-neutral.

### Per agent

What differs per agent is a `TeamDelivery` in its kit (`kitOf(agent).team`, core) and a
`MainTeamDelivery` in its main kit (`mainKitOf(agent).team`); `null` in either means no block, no
flag and no post. `teamAgent(agent)` and `TEAM_AGENTS` are read from the kits.

| Piece | Member | Claude (`src/core/agents/claude/team.ts`, `src/main/agents/claude/index.ts`) |
|---|---|---|
| How it names skills, its protocol part | `skill`, `own`, `part` | `` `name` ``, `` `menkar:name` ``, `claude.md` |
| (1) What a start holds | `heldAtStart(start, block)` | new and resume → the block; fork → `null` |
| (2) How a start delivers | `atStart(start, file)`, words its Launcher puts last | `--append-system-prompt-file`, with `--system-prompt-snapshot off` before it on every resume |
| The version floor | `floor` (`null`: no check) | 2.1.267, read from `--version`; below it no flag and one `team.oldClaude` toast |
| (3) How a change is told | `tell(session, text, counts)` (main) | `postToSession` on Claude's messaging socket |

Cursor's kit has none of them. Main writes the block's file before asking the Launcher (a write
that fails leaves the pane outside the team, as above), so the file is not part of the plan the
Launcher returns.

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
- **MCP `instructions` for the team block:** a conversation message framed as tool usage, capped
  at 4,096 characters, which may arrive after the first prompt (1.150). It may be another agent's
  way.
- **A post on every resume, or a stored "last told" file:** the snapshot flag gives a resumed
  session its current block in the system prompt.
- **Rewriting the team file on a change:** Claude reads it once, at start.
- **The snapshot flag on a fork:** not measured, and a fork must be told it is not its source
  anyway; the whole block is posted when it joins.
- **The team flag before `--settings`:** it works, but last is where no option can take it for its
  value.
- **Making every new session a member before its command:** the project a session joins is decided
  where it started; building the input from the tab's project and the start's identity changes no
  membership rule.
- **A turn mark set when a post is delivered:** a real message in the same turn was lost with it;
  the transcript at the turn's end decides.
- **A post with no "No reply is needed" and no `last_reply` filter:** the post's own answer would
  replace a worker's report (1.73).
- **A check of which skills a session loaded:** the cause, a handoff that forgot to name them, is
  removed at the source: Menkar names them in the team block.
- **`menkar:worker` implied by the parent:** an expert does not always work a task, and a
  consultant gets tasks without being a child (1.148).
- **"You were started for task N: load `menkar:worker` now":** a per-task worker's first prompt is
  its task, so the block's "when a session hands you a task" line applies at once, and it also
  holds for an expert or a consultant handed a task later.
- **The team facts in a template file:** their variants are logic, clearer as one tested function
  (`teamFacts`); the protocol, which has none, stays in files.
