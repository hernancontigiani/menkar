# History of `docs/session-control.md`

## Session control: Menkar's MCP server, renewing, starting, waking

> Left on 2026-11-12: the skills ship with Menkar as a plugin, described in this document (plan 33).
# Session control: Menkar's MCP server, renewing, starting, waking
ends a turn. The skills that use these tools are not part of this subsystem.

## The shape

> Left on 2026-11-12: groups lose their leader; a group is only visual (decision 1.76).
     project place, group, leader mark, hidden flag, parents, Remote Control, and the old id as an

> Left on 2026-11-12: last_reply falls back to the previous conversation after a renew (decision 1.84).
    the whole file) and cut to its first `REPLY_MAX_CHARS` with a note.

## Session control: Menkar's MCP server, renewing, starting, waking, and its skills

> Left on 2026-11-12: the orchestration mode adds four topic tools and shapes list_sessions, start_session and the wake order (plan 34).
(decisions 1.71 and 1.79–1.84, 2026-11-12; "The skills plugin" below).

## The shape

> Left on 2026-11-12: the orchestration mode adds four topic tools and shapes list_sessions, start_session and the wake order (plan 34).
    - `tools/list` names four tools; `tools/call` runs one.
- **The four tools.** A session is always named by its name, never by its id: a renew or a `/clear`
  gives it a new id, and an id an agent kept would name nothing.
    conversations are left out.

## The skills plugin

> Left on 2026-11-12: the orchestration mode adds four topic tools and shapes list_sessions, start_session and the wake order (plan 34).
  repository's `plugin/` in development. `package:check` requires the manifest and the four
  `SKILL.md` files in the .deb.

## Rejected

> Left on 2026-11-12: the orchestration mode adds four topic tools and shapes list_sessions, start_session and the wake order (plan 34).
  four tools.

## Session control: Menkar's MCP server, renewing, starting, waking, and its skills

> Left on 2026-11-12: plan 35 adds adopt_session (decision 1.102).
(`docs/orchestration.md`) adds four tools for topics and shapes `list_sessions`, `start_session`
and the wake order.

## The shape

> Left on 2026-11-12: adopt_session is the ninth tool (decision 1.102).
    - `tools/list` names eight tools; `tools/call` runs one.

## The shape

> Left on 2026-11-12: adopt_session is the ninth tool (decision 1.102).
- **The eight tools.** A session is always named by its name, never by its id: a renew or a

> Left on 2026-11-12: start_session takes an optional model (decision 1.106).
  - **`start_session { name, prompt? | prompt_file?, remote_control?, group? }`:** a new Claude
    session in the caller's project, in a tab right after the caller's, not selected. The caller
    becomes its parent.

> Left on 2026-11-13: Menkar keeps a session's model and passes it again on a renew (decision 1.108).
      not starting with `-` is refused (`readModel`, `src/core/control/model.ts`). Only the start
      carries it; a later resume runs with Claude Code's own record of the session.
  4. The new session starts in that tab.
     project place, group, hidden flag, parents, Remote Control, and the old id as an
     earlier conversation.

> Left on 2026-11-13: every post ends with the local time, so Claude Code does not drop a repeat.
      `{"type":"user","message":{"content":"[Menkar] …"},"from":"menkar","msg_id":"…"}`, and
      closes.

## The shape

> Left on 2026-11-13: start_session gained loose and role (decision 1.111).
  - **`start_session { name, prompt? | prompt_file?, remote_control?, group?, model? }`:** a new
    Claude session in the caller's project, in a tab right after the caller's, not selected. The
    caller becomes its parent.

## The shape

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114).
    (its label or null), `orchestrator`, `priority` and `with_you` — and the answer says whether
    the mode is on (`orchestration`).

## The shape

> Left on 2026-11-13: topic_add gained task, and the task tools joined (decisions 1.113, 1.114).
  - **`topic_add { title, context, blocking? }`, `topic_update { number, title?, context?,
    blocking?, status? }`, `topic_close { number, decision }`, `topic_list { all? }`:** the
    project's topics for the human (`docs/orchestration.md`), kept by main in `topics.json`. Any
    session of the project may call them; a number of another project is "not found". Status set
    by hand is "open" or "discussing"; only `topic_close` closes. `topic_list` gives one topic per
    two lines — number, ★ when raised by a priority session, title, who raised it by name,
    blocking, status, decision when closed, then the context — in the sidebar's order
    (`topicTool`, `src/core/orchestration/topics.ts`).

## The shape

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114).
    In it, the events of children with the ★ come first; otherwise they keep the order the children
    first spoke in (decision 1.78).

## The shape

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114); the whole line.
    the mode is on (`orchestration`). With the mode off the marks read null and false: off is the
    ordinary Menkar (`sessionMarks`, `sessionsAnswer`). A snapshot an older Menkar wrote, without

## The skills plugin

> Left on 2026-11-13: the skills learned tasks (decision 1.113).
  - **orchestrator:** coordinating sessions. Only it starts sessions or hands out work.
  - **worker:** taking a task from another session; the report is its last message.

## The shape

> Left on 2026-11-13: plan 37 adds `start_session`'s `task`, an optional assignee, and the workers' tools (decisions 1.118–1.123); the tools are no longer counted in prose.
- **The nine tools.** A session is always named by its name, never by its id: a renew or a
  - **`start_session { name, prompt? | prompt_file?, remote_control?, group?, model?, loose?,
    role? }`:** a new Claude session in the caller's project, in a tab right after the caller's, not
    selected. The caller becomes its parent, unless `loose` is true.
    - `task_add { title, assignee, star? }`: the orchestrator only, with the mode on ("Only the
      name (`sessionOfProject`). Answers "Task N added."; the task is queued.

> Left on 2026-11-14: `start_session` gained `folder` (decision 1.124).
    loose?, role? }`:** a new Claude session in the caller's project, in a tab right after the
    caller's, not selected. The caller becomes its parent, unless `loose` is true.

## The skills plugin

> Left on 2026-11-16: the team block says who a session is and how the team talks; the skills point to it (decisions 1.150–1.152).
  - renewing always with a prompt that is the handoff: who the session is, the skill to load, what
    is in flight (1.84);
  - the report also sent by name when the session handing the task did not start the worker, since
    a wake reaches only the parent;

## The skills plugin

> Left on 2026-11-16: "keeper" is "maintainer" (plan 40).
    is read only, its lesson goes in the report (one keeper per skill, 1.119).

## The shape

> Left on 2026-11-16: `task_review` says whom a task in To review waits on, and the orchestrator may change it (decision 1.164).
    - `task_review { number, note }`: the assignee only; to review.
    child, no role) whose current task is waiting (`mayPark`). Once the worker's turn is over — its

## The team block

> Left on 2026-11-16: the team block's delivery per agent is asked of the agent's kit (plan 39, P0.3).
  is the one without the team, to the byte. An agent with no entry in `TEAM_AGENTS` (Cursor) gets
  - `buildCommand`'s `teamFile` appends `--append-system-prompt-file '<path>'` **last**; a resume
- **Three pieces kept apart,** so another agent can bring its own: what a session holds at start
  (`teamAtStart`), how a start delivers (the file and the flags), how a change is told (`teamPost`
  and its triggers). `teamPost` itself is agent-neutral.

> Replaced 2026-11-16: tasks 52 and 54 (1.171–1.173).
- **Batching** (`WakeBatcher`, `src/core/control/events.ts`): per parent, events wait until no
new one has come for `WAKE_DELAY_MS`, a child keeps only its latest, and all go in one message.
In it, the events of children whose current task has the ★ come first; otherwise they keep the
order the children first spoke in (decisions 1.78 and 1.114).
- **Other posts to the orchestrator**, through the same `postToSession` and never batched: "[Menkar]
The human wants to discuss topic N" (a double-click on a topic), "[Menkar] The human took control
of ‹name›" and "[Menkar] The human handed ‹name› back" (a read-only tab's banner, decision 1.101).

## The shape

> Left on 2026-11-17: waking is asked of the parent's agent's kit (plan 39, P0.6).
    - A parent with no Claude tab, or no entry in the registry, is logged and not woken.

## The shape

> Left on 2026-11-18: a worker starts and resumes in the background; "has a tab" became "running" (decision 1.176; plan 41).
    loose?, role?, folder? }`:** a new Claude session in the caller's project, in a tab right after
    the caller's, not selected. The caller becomes its parent, unless `loose` is true.
    - A name another session of the project already uses in a tab is refused, and so is a group
    context percentage, the parent's name, and whether the session has a tab. Earlier
    closing its tab does, never mid-turn, and marks it parked (`orchestration.parked`).
    a parked or stopped Claude Code session of the project, refused when it has a tab. It opens in
    a tab after the orchestrator's, not selected, as `--resume <id>`, the prompt as its first
      Work view's three counts, " · 2 topics · 1 working · 1 waiting" (decision 1.125, 2026-11-14):

## The shape

> Left on 2026-11-18: the orchestrator is woken only for a review and a question; the rest waits in its inbox (decision 1.178, plan 42).
      without `waiting_on` (decision 1.164).
    back" does, and the other running orchestrators get "The human is back", the caller not
    and the other running orchestrators get "The human is away", the caller not (`awayTool`).
    new one has come for `WAKE_DELAY_MS`, and all go in one message, joined by "; ". A child keeps
    only its latest event. The human's own posts to the orchestrator (`post`, below) join it, keyed
    (`presence`, `control:‹session›`, `topic:‹n›`) so the latest of a key wins: away then back
    within the wait leaves "The human is back". In the message the human's posts come first, then
    the events of children whose current task has the ★, then the rest, each in the order they
    first came (decisions 1.78, 1.114 and 1.173). `forget` drops a pending post the parent no
    longer needs: the orchestrator that called `human_back` is not told the human was away.
    Nor is the one that called `human_away` told what it just did.
      in the registry, is logged and not woken.
- **The human's own posts to the orchestrator** go through the same batch (decision 1.173):
  "The human wants to discuss topic N" (a double-click on a topic), "The human took control of
  ‹name›" and "The human handed ‹name› back" (a read-only tab's banner, decision 1.101), and "The
  human is away: …" or "The human is back" (`docs/orchestration.md`). Team updates stay apart:
  they have their own settle, and a turn they alone opened is recognised by the post starting
  with "[Menkar] Team update:".

## The shape

> Left on 2026-11-19: "The human wants to discuss topic N" wakes the orchestrator; the inbox only when it cannot be woken (decision 1.186, task 119).
    mode on, whose agent's kit has an inbox (`MainAgentKit.inbox`, Claude's alone), is posted to
    for two things only, a task set to review and a question (below, "The orchestrator's wakes and
    its inbox"); everything else it used to be woken for waits in its inbox. Every other parent —
- **The human's own news for the orchestrator** (decisions 1.173, 1.178): "The human wants to
  discuss topic N" (a double-click on a topic), "The human took control of ‹name›" and "The human
  handed ‹name› back" (a read-only tab's banner, decision 1.101), and "The human is away: …" or
  "The human is back" (`docs/orchestration.md`) go to the orchestrator's inbox under their keys; to
  an orchestrator without one, through the batch as before. Team updates stay apart: they have
