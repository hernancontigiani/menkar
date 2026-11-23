# History of `docs/NOT_BUILT_YET.md`

## Menkar's own copy of the transcripts

> Left on 2026-11-10: option B dropped by the human on 2026-11-09, because the retention
> integration (`cleanupPeriodDays`) covers the need.
### Menkar's own copy of the transcripts
Transcript retention (2026-11-10) asks Claude Code to keep its transcripts longer, through
`cleanupPeriodDays` in `~/.claude/settings.json`. The other way, option B, would have Menkar copy a
member session's transcript into its data directory and show the copy in the replay tab after
Claude Code deletes the original. That is a second store of the user's prompts and code, which
would have to be kept, sized and deleted; and the integration already covers whoever turns it on.
**Trigger:** someone who will not touch Claude Code's settings loses a transcript they needed, or
retention through the setting stops working. First question: which sessions get copied (members
only, or everything seen), and when a copy is deleted.

> Replaced 2026-11-10: the coding agents entry gained the remote mode, per-platform enabling and Agent Desktop as a reference.
its status line or context reading offers. Adding one before those are known would put it in the
New picker with half of Menkar not working for it. Cursor the editor is out of scope; only an
agent: the four facts above, read from its docs and a real session, before any code.

> Replaced 2026-11-10: an agent not enabled on a platform does not appear there, not even greyed; the reference is Agent Desk.
  each agent's entry says on which platforms it is enabled, and the picker shows it (installed or
  greyed) only there. Set in the code per release, not by the user.
- **A reference.** The human points to the open-source *Agent Desktop*, which supports many of
agent: the five facts above, read from its docs, Agent Desktop's code and a real session, before

## Dragging sessions and tabs

> Left on 2026-11-10: session rows now reorder by dragging within their group (the human, 2026-11-10); dragging a row onto a tab stays not built.

### Dragging sessions and tabs

"Open beside the current tab" from a row's menu puts a session in a tab's second pane; rows and tabs
are not reordered by dragging.

**Trigger:** the human misses dragging a row onto a tab, or reordering rows. First question: is the
order of a project's sessions worth saving, or is the group enough?

## Deliberately not built yet

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
In agent-tablet's evaluation no local model came close to Haiku's agreement with the human's labels
The history keeps every turn forever: in agent-tablet two months of the human's use took a few
megabytes, so years fit without a limit, and a limit would drop exactly what the history exists to
Menkar speaks English and Spanish, both complete (`plans/00-STATUS.md` §1 1.11). agent-tablet also had
German, French and Hungarian from Agent Session Manager, each covering about 230 of its 370 strings;
every new string would need three translations nobody here can check, and a stale catalog shows a mix
of languages.

## Who leads a group

> Left on 2026-11-12: groups lose their leader; a group is only visual (decision 1.76).
### Who leads a group, read by something other than the sidebar
A group's leader (decision 1.54) is shown only in the session list: a star on its row, its name on
the collapsed row. Nothing else reads it, so there is no API, CLI output or message that names it;
designing one without a reader would guess its shape.
**Trigger:** a session or a tool needs to know who leads a group (the orchestration board is the
likely first). First question: whether it reads `projects.json` or asks the running app.

## Notifications for a new topic

> Left on 2026-11-12: built by plan 35 (decision 1.103, `docs/orchestration.md`).
### Notifications for a new topic

A new topic shows in the sidebar's Topics section only: no toast, sound, desktop notice or count on
the dock, as `blocked` has. Left out of the orchestration mode on 2026-11-12 because nobody had
decided which of them, or for which topics (all, blocking ones, a priority session's).

**Trigger:** the human misses a topic that waited for them. First question: which topics notify,
and whether through the same settings as a blocked session.

> Left on 2026-11-13: dropped, not deferred (the human): read-only tabs (1.101) make "with you" explicit — the human must press "Take control" to type — so there is nothing left to guess.

### "With you" known by itself

A session is marked "with you" by hand, from its menu, and cleared by hand (decision 1.86). Menkar
could guess it from the human typing in the pane, or from a timer, but a prompt sent from the phone
would not be seen, and a wrong guess would keep work from a session or send work to a busy one.

**Trigger:** the human forgets to set or clear the mark often enough to ask for it. First question:
which signal counts — keys typed in the pane, focus, Remote Control traffic — and how long it holds.

**Trigger:** after 1.0, the human installs one of them on Ubuntu to try it. First question, per

> Replaced 2026-11-14: "Agent Desk" was agent-deck (the human).
- **A reference.** The human points to the open-source *Agent Desk*, which supports many of
agent: the five facts above, read from its docs, Agent Desk's code and a real session, before

> Replaced 2026-11-14: Pi left out of the candidate agents (the human).
### More coding agents: Codex, OpenCode, Pi
`src/core/agents.ts`. The human wants OpenAI's Codex CLI, OpenCode and Pi too (2026-11-10), after
1.0. An agent is more than a command:
1.0. An agent is more than a command: Menkar needs, per agent, how to start and resume a session,

> Replaced 2026-11-14: Gemini CLI joins the candidates (1.133).
### More coding agents: Codex, OpenCode

> Replaced 2026-11-14: Gemini CLI left out (1.133).
### More coding agents: Codex, OpenCode, Gemini CLI
reconsidered if asked (the human, 2026-11-14). An agent is more than a command: Menkar needs, per agent, how to start

> Replaced 2026-11-15: task flow metrics wanted before the first release (1.156).
**Trigger:** the human asks for flow metrics, or feels a bottleneck they cannot see. First
question: which states and reviewers to record, and where the numbers show.

> Replaced 2026-11-16: the return gets a short preliminary summary first.
happened and what awaits a decision. Whether a new blocking topic still notifies while away is the
human's call.
human's call. Related: the "with you" mark (1.78) is per session; this is the human's own, per

> Built 2026-11-16 (task 48; decisions 1.165, 1.167, 1.170); how it works is in `docs/orchestration.md`, "The human's presence".

### The human's presence: away or here

The human's idea, relayed by another project's orchestrator (2026-11-16): a state the human sets
when they go into a meeting or out for a couple of hours — **away** — and clears when they return.
Today an orchestrator does not know whether anyone reads its chat: it keeps writing a summary per
event (a worker finished, a PR is ready), spending context and tokens, and the human comes back to
a pile instead of one summary. With the state: while away, the orchestrator writes events to topics
and the status file instead of the chat and goes on with what does not depend on the human; on
return, a `[Menkar] The human is back` post, and the orchestrator answers with one summary of what
happened and what awaits a decision — first **a preliminary summary of a few lines** (how many
things happened, which await a decision), and from it the human chooses to go through them one by
one or to read the full summary the orchestrator prepared (the human, 2026-11-16). Whether a new
blocking topic still notifies while away is the human's call. Related: the "with you" mark (1.78) is per session; this is the human's own, per
project or global.

**Trigger:** the human asks to build it. First question: per project or global, where the switch
sits (the header, the tray), and whether Remote Control activity counts as "here".


> Corrected 2026-11-16: Claude Code answers a silent turn with a reminder that starts another turn; it does not refuse it (read by the Claude Code consultant).
reach the orchestrator outside the human's chat. Measured by it the same day: Claude Code's harness refuses a turn with no visible
text ("Your previous response had no visible output"), so the skill alone cannot make it silent; a
minimal "·" is the stopgap. A third idea from ccai's human (2026-11-16): hide, fold or filter in the orchestrator's
model invisibly but only with the human's next prompt; the empty-turn refusal is switched per model,

> Replaced 2026-11-17: `src/core/agents.ts` is gone; the agents are registered in `src/core/agents/ids.ts` (plan 39, P0.7).
Menkar runs two agents today: Claude Code and Cursor's terminal agent (`cursor-agent`), listed in
`src/core/agents.ts`. The human wants OpenAI's Codex CLI and OpenCode too (2026-11-10); Codex comes

> Replaced 2026-11-18: the task states are recorded (1.180); the reading and the view are not built.
- **To review needs to say whose review.** Today "To review" holds both the orchestrator's review
  and the human's (a visual check, a behaviour to try: a topic naming the task, closing-a-task
  step 8); Menkar knows nothing of a PR waiting for approval or merge. The column stays one; the
  task gains **who it waits on** (the orchestrator, the human, a PR's review, a PR's merge), set
  with `task_review`/`task_progress`, shown on the card and kept with the state change, so the
  human can tell whether their own checks or the PRs are the bottleneck.
- **Storage:** an append-only table of state changes (state, reviewer, when; the task's number
  and project only to pair entries and exits — the metric itself is not per task), next to the
  usage history in SQLite (the one exception to "the app's state is JSON", already the home of
  Menkar's metrics), while `tasks.json` stays the live state. Moving all of `tasks.json` to SQLite
  is not needed for this. Time through `src/core/clock.ts`; a task spanning midnight, a restart, a
  state re-entered.
- **Shown** in the Usage window beside time and tokens, or the Board; where is the human's call.

**Trigger:** fired — wanted before the first release (1.156, 2026-11-15). First question:
which states and reviewers to record, and where the numbers show.

### The orchestrator's conversation, apart from the events

> Left on 2026-11-18: narrowed to the separate interface: the events' noise is answered by the orchestrator's inbox (decision 1.178, plan 42).
From ccai's human, relayed by its orchestrator (2026-11-16): the chat with an orchestrator mixes the
conversation with the human and the noise of the events (`[Menkar] … finished its turn`), and each
event wakes it and tends to produce visible text. Two ideas, beyond the current topic (1.169): **an
order of the topics the orchestrator sets** (today ★, blocking, number), and **a separate interface
to talk with the orchestrator** where the human does not see what goes on behind.
ccai's orchestrator adds (2026-11-16): `[Menkar] … finished its turn` wakes arrive as turns of the
human's chat; if a turn must still end with some text, Menkar could hide it, or those wakes could
reach the orchestrator outside the human's chat. Seen by it the same day: Claude Code answers a turn with no visible text with a
reminder ("Your previous response had no visible output") that starts another turn, so the skill
alone cannot make it silent; a minimal "·" is the stopgap. A third idea from ccai's human (2026-11-16): hide, fold or filter in the orchestrator's
chat the messages other sessions send it (`Another Claude session sent a message: …`, both
Menkar's events and workers' cross-session messages), which Claude Code draws, not Menkar; or
deliver the events by another channel. Asked of the Claude Code consultant (2026-11-16, 2.1.325): no setting folds or
hides peer messages in the TUI (`crossSessionInbound` only accepts, holds or refuses delivery); a
plugin monitor wakes with a one-line event instead of a prompt row, but was rejected before
(`docs/session-control.md`, Rejected); a `UserPromptSubmit` hook's `additionalContext` reaches the
model invisibly but only with the human's next prompt; the empty-turn reminder is switched per model,
not by the user. The levers left are posting fewer, coalesced events and deferring the rest to the
human's next prompt.
**Trigger:** the human finds the current topic (1.169) and the skill's silence on events not
enough. First question: what the separate interface shows, and where.

## Task flow metrics: how long tasks spend in each state

> Replaced 2026-11-18 (plan 43, block 6): the task flow's reading is built in core.
and the task flow"), and the tasks open at the first start that records are a baseline. **Not
built: the reading and the view** — time per state over 7 and 30 days, per whom it waits on.

## Task flow metrics: how long tasks spend in each state

> Left on 2026-11-18 (plan 43, block 7e): the views are built — Task times in the Usage window, with Spend and Your time.
### Task flow metrics: how long tasks spend in each state

The human's idea (2026-11-15): record a timestamp each time a task enters a state, so Menkar can
show, over the last 7 or 30 days, how long tasks spent queued, in progress, waiting and to review —
a measure of the team's flow that shows the bottleneck. Long in queue: too few workers at once, or
more tasks created than the short term can take. Long to review: reviews to speed up.

**Recorded since 2026-11-18** (decision 1.180): each task's state changes, with whom a wait or a
review waits on, go into the usage history's `task_states` (`docs/usage.md`, "The human's activity
and the task flow"), and the tasks open at the first start that records are a baseline. **Not
built: the view** — time per state over 7 and 30 days, per whom it waits on (the reading is
`src/core/usage/flow.ts`).

**Trigger:** fired — wanted before the first release (1.156, 1.180). First question: where the
view sits, from mock-ups the human picks.

## A nudge after a long burst of the human's activity

> Left on 2026-11-18 (plan 43, block 7e): Your time shows the bursts.
a nudge, and whether one helps at all, is read from the bursts the views will show.

## A nudge after a long burst of the human's activity

> Left on 2026-11-19 (plan 44): its trigger fired and decision 1.185 answered it: Menkar does not alert; `menkar usage now --json` serves the human's own service.
### A nudge after a long burst of the human's activity

1.180 (2026-11-18): Menkar could tell the human when a burst of their activity has run long (a
break is due). Deferred by the human until they have seen their own data: the length that deserves
a nudge, and whether one helps at all, is read from the bursts Your time shows (built 2026-11-18).

**Trigger:** the human has looked at their bursts in the Usage window and asks for it. First
question: the length, and whether away (1.167) or a quiet minute resets it.

## Ending what outlives a hang-up on macOS and Windows

> Replaced 2026-11-19 by decision 1.190: no Windows port is planned; native Windows is an entry of its own.
**Trigger:** the Windows port. First question: how node-pty's ConPTY ends its child tree there,
and whether macOS's `ps -o sess` gives the same session to follow.

## The live Remote Control phone on macOS and Windows

> Replaced 2026-11-19 by decision 1.190: no Windows port is planned; native Windows is an entry of its own.
**Trigger:** the macOS or Windows port. First question: whether Claude Code's registry keeps the
same shape there, and how each system lists a process's children.

## More coding agents: Codex, OpenCode

> Replaced 2026-11-19 by decision 1.190: no Windows release is planned.
- **Enabled per platform.** A release may ship an agent on Linux before it is tested on Windows:

## `menkar usage now` on Windows while the app rotates the journal

> Replaced 2026-11-19 by decision 1.190: Menkar does not run on Windows until native Windows is built.
**Trigger:** Menkar runs on Windows. First question: whether the app's rename of the journal

## A documentation site

> Left on 2026-11-20: the public site is built (`site/`, `docs/site.md`), not yet published.
### A documentation site

`README.md` is the user's guide and `docs/` is internal; nothing is published. A site is one more
thing to keep true.

**Trigger:** the README stops fitting on a few screens, or someone other than the human uses the
app. First question: whether it is generated from `README.md` or written apart.

## The orchestration mode's guide online

> Left on 2026-11-20: the site exists, unpublished until the first release; the trigger became its publishing.
(decisions 1.90, 1.91). Nothing links to an online copy: no site exists, and the app opens no URL
of its own.
**Trigger:** the documentation site exists ("A documentation site" above). First question: whether
the card links to it, and whether that link counts as the app opening a URL of its own.

## OpenCode's form card read as blocked

> Left on 2026-11-23: built (task 201) from the screen `opencode` measured on OpenCode 2.3.0's real TUI; the screen, not the server's event, is the signal.
### OpenCode's form card read as blocked

OpenCode's question tool shows a form (`form.created` among its server's events) that waits for the
human, like a permission card. Its screen was never captured on a real TUI, so OpenCode's state
rules do not read it: an OpenCode session at a form shows idle, not blocked, and no notification
says it waits. A rule written from the event alone, or a guessed screen, could read a reply that
quotes a form as blocked.

**Trigger:** `opencode` measures the form on a real TUI (its screen, and whether the event names
the session), or the human sees a session wait at a form unnoticed. First question: whether the
screen or the server's event is the signal, as the permission card is read from the screen.
