# Menkar's orchestration mode

This guide is written for a person using Menkar and for an agent reading it on their behalf. It
ships inside Menkar, so any session can read it from disk. An agent asked to help set the mode up
should read it whole, then ask the person the questions it raises; it should not guess their
answers.

## What it is for

Several Claude Code sessions work on one project at once. Without help, the person ends up
talking to every one of them, and keeping in their own head who does what and what is waiting for
a decision. In the orchestration mode, the person talks to **one session, the orchestrator**. The
orchestrator hands the work out to the other sessions, reads their reports, and keeps for the
person the **topics** that need a decision, and a **task** for each piece of work it delegates.
Menkar shows in its sidebar what waits on the person and how far each task is, and the team.

The mode is per project. It is switched on with the **Orchestration** switch in the window's
header (beside Usage) or with the team icon of the project in the project list. Switching it off
keeps everything set in it, so switching it on again finds the team as it was. With the mode off,
Menkar is the ordinary Menkar.

## The marks

Each mark is set from a session's menu in the sidebar (right-click a row, or its `⋯`), while the
mode is on:

- **Orchestrator**: the session the person talks to. One per project; marking another one moves
  the mark.
- **Role…**: a free label for what a session is, such as "Fabric expert", "Reviewer" or
  "Documentation". An empty label removes it. A session with a role under the orchestrator is an
  expert; a loose one is a consultant (see "Four profiles" below).
- **With you**: the person is talking with this session directly right now. The orchestrator gives
  it no work until the person clears the mark. Menkar never sets it by itself.

## The sidebar in the mode

A switch at its top, **Work | Team**, chooses what it shows, per project; Work is the default.

**Work** is what waits on the person and how far the work is, from the top:

1. **Counts**: open topics, tasks in progress, tasks waiting.
2. **Topics**: the open topics, those of a ★ task first, then blocking ones (with a red mark),
   then the rest by number, so the top one is the one to take. A click unfolds its context, who
   raised it and its status. The list is read only: a topic is discussed in the orchestrator's
   chat, and closed there. Everything that waits on the person is a topic.
3. **Tasks**: the open tasks, ★ first: title, who has it, its steps ("3/5") and its latest note,
   with a red edge while it waits. A click selects that session's tab; a right-click sets or
   removes the ★. Past six, "See all" opens the Board.
4. **Consultants**: one row each, with its state; a click opens its tab.
5. **Done today**: topics closed and tasks done since midnight, folded until opened.

**Team** is the team: the Topics, then the orchestrator with the sessions it started under it
(those without a tab folded into one "earlier" row a click unfolds), the **Consultants** (every
loose session with a role), and **Others** with their groups as in the ordinary list. Each
session's row shows its current task and step under its name, and the ★ while that task has it.

**The Board**, a tab opened with the **Board** button beside the Orchestration switch, shows every
topic and task in columns: Topics, Queued, In progress, Waiting, To review, Done (today's; older
ones folded under "Done before"). A card's click selects its session's tab.

## Topics

A topic is something the person must decide or know. Agents keep them with Menkar's tools, which
every session Menkar starts has:

- `topic_add`: a title, a context written so the person can decide from it, and whether work is
  blocked on it. Menkar records who raised it and gives it the next number of the project; numbers
  are never reused.
- `topic_update`: changes its title, context, whether it blocks, or its status (open or
  discussing).
- `topic_close`: closes it with the decision taken. A closed topic keeps its decision, so "what did
  we decide on topic 7?" has an answer.
- `topic_list`: the open topics in the order the sidebar shows them; with `all`, the closed ones
  too, with their decisions.

The orchestrator usually keeps the topics. Any session of the project may add one, and may name
the task it belongs to (`topic_add`'s task), so the topics of a ★ task come first.

## Tasks

A task is a piece of work the orchestrator delegated, so the person can see how far it is:

- `task_add`: the orchestrator creates it when it hands the work out, with a title and the session
  that does it, and names its number in the handoff. It starts **queued**.
- `task_steps`: the session splits it into 3 to 7 short steps; it goes **in progress** at step 1.
- `task_progress`: the session reports each advance, the step it is at and a one-line note; with
  what it waits on (a topic, a session) it is **waiting**.
- `task_review`: the session says it is done; it is **to review**.
- `task_close`: only the orchestrator, after reviewing it, closes it as **done** or **dropped**, so
  "done" always means reviewed. A review that is the person's (a change to try) reaches them as a
  topic.
- `task_list`: the open tasks, ★ first; with `all`, the closed ones too.

**The ★ belongs to a task**, not to a session: the person sets it from the task's right-click (in
the Work view or the Board), or the orchestrator when the person asks. A ★ task's topics come
first, and when several sessions finish at once the orchestrator hears first of those on ★ tasks.
Consultants get no tasks: they are asked, and raise topics.

## Notifications, read-only tabs and handing sessions over

- **Who notifies**: with the mode on, the sessions under the orchestrator make no sound, toast or
  desktop notice; the orchestrator tells the person what matters, as a topic when they must act. A
  session marked "with you", the orchestrator itself and sessions not under it notify as usual.
  Any session can be muted from its row menu ("Mute"), in any mode. The dots still show every
  session's state.
- **A new topic** notifies the person, as a waiting session does, and so does a topic that becomes
  blocking. While a topic is being discussed, new ones arrive without sound.
- **Read-only tabs**: the tab of a session under the orchestrator takes no keys or pastes, under a
  yellow banner with "Take control". Taking control marks it "with you" (a blue banner, with "Back
  to reporting to the orchestrator"); the orchestrator is told both times. While the session waits at a
  permission prompt, its tab takes keys.
- **Handing a session over**: "Report to the orchestrator" in its row menu (and "Stop reporting to
  the orchestrator"), the first-time card's list of sessions the orchestrator manages, or
  `adopt_session`, which the orchestrator calls only when the person asks for it. Nothing
  restarts; only who is woken changes.

## Who may start sessions

With the mode on and an orchestrator marked, **only the orchestrator** starts sessions with
`start_session`. Another session that tries is refused and told to ask the orchestrator to
delegate the work. A session may always use its own subagents for research or review. With the
mode off, or with no orchestrator marked, any session Menkar started may start others, as usual.

`list_sessions` tells an agent, for each session of the project, its role, whether it is the
orchestrator, whether its current task has the ★ and whether it is with the person, and whether
the mode is on.

## Skills to load

Menkar ships skills every session it starts can load:

- `menkar:orchestrator`: the orchestrator loads it when it starts, and again after a renew or a
  compaction.
- `menkar:worker`: a session handed a task by the orchestrator loads it.
- `menkar:specialize`: a session that should become the expert of an area loads it to write down
  its role and its boundaries.
- `menkar:distill`: a long-lived expert loads it when a task closes, to keep what it learned.

## Four profiles

- **The orchestrator**: the session the person talks to. It hands out work, follows it, and keeps
  the topics.
- **An expert**: a worker **under the orchestrator** that always implements one part of the
  system, with a skill of its own (for example the session that always runs releases). The
  orchestrator hands it the work of its part; the person rarely talks to it, and takes control of
  its tab when they do.
- **A generalist worker**: under the orchestrator, in its repository, implementing whatever it is
  handed. Usually started for a task and renewed or closed after it.
- **A consultant**: **always loose**, never under the orchestrator. It knows an area (often
  another repository) and answers anyone who asks — the person, the orchestrator, a worker — but
  does not execute for the orchestrator. Its tab is always writable.

Menkar needs no extra mark for this: a session with a role under the orchestrator is an expert,
one with a role that is loose is a consultant, and one with no role under the orchestrator is a
generalist.

## Three shapes of an orchestration

What changes between projects is how much the orchestrator itself knows, and so how much the
experts and consultants beside it carry.

1. **The orchestrator knows everything.** A small team: the person talks only to the orchestrator;
   it designs the work, hands it to generalist workers and reviews what comes back.
2. **The orchestrator manages, with expertise, beside a few experts.** Generalist workers are
   started for a task and go when it ends; one or two experts stay for the parts they always
   implement. The orchestrator decides who takes the work and when, by priority, and which
   sessions may work at the same time, by the files and resources they touch.
3. **The orchestrator manages, without the expertise, beside experts and consultants.** It starts
   the workers and orders the work, but sends a worker's question about an area to the consultant
   who owns it. With no consultant for an area, it asks the person, until the same kind of question
   has come often enough that one is created for it.

## Working with consultants and experts

- **A consultant knows; workers execute.** For work in a consultant's area, the orchestrator asks
  the consultant for the key points and traps (or a plan), starts a worker for it, and tells the
  worker to ask that consultant about the area. When the worker reports, the orchestrator may ask
  the consultant to review the result. Several workers can then work in one area at once, while
  the consultant stays free to think with the person.
- **An expert executes its part.** Hand a session to the orchestrator ("Report to the orchestrator")
  to make it an expert of its part: the orchestrator then drives it (a release, say) and is woken
  when it finishes, so the person need not watch both.
- **Workers can run on a smaller model** when a consultant answers their questions and reviews
  their work. Which model is the project's choice: write it in the project's own instructions or
  memory (below); the orchestrator never guesses one.
- **How a consultant or an expert stays current.** Its skill holds ways of working and points to
  the project's docs by file and section, never the facts themselves, and a worker that changes a
  feature updates its doc in the same change: the skill follows without being touched. A
  consultant reviews the workers' results in its area, so it sees what changed; a session back
  after a gap first hears from the orchestrator what changed since its last task; and when what
  changed alters how it works, not only a fact, it runs `menkar:distill` to update its skill.

## What a project writes down for its orchestrator

`menkar:orchestrator` is written for any project. What is particular to one project goes in that
project's own instructions (its `CLAUDE.md`, or the docs it points to) or in the agent's memory for
that project, where the orchestrator reads it when it starts. The instructions are shared with
everyone who works on the repository; the memory is the person's own, on their machine. Rules of
the team (working trees, commits, the environment) go in the instructions; how this person
orchestrates (which experts, which model for workers) may go in the memory when others working on
the repository do not orchestrate:

- whether sessions share one working tree or use worktrees, and who commits and pushes;
- where the project keeps its decisions;
- the experts and consultants and their areas, if their own skills and roles do not say it;
- the model generalist workers run on;
- how the project's environment is started, seeded and migrated, if workers verify against it.

A few lines are usually enough. A project needs a role file or a skill of its own for its
orchestrator only when that list grows into a method of its own (how plans are written, executed
and closed, for example).

## Setting it up

The first time the mode is switched on in a project, Menkar asks who orchestrates: one of the
project's sessions, or a new session it starts, which is told to load `menkar:orchestrator` and
that the orchestration is new. In the card's list of sessions the orchestrator manages, leave
unchecked the consultants and any session still in the middle of something with you: a checked
one comes under the orchestrator and its tab turns read only.

An orchestrator that finds nothing configured yet (no session under it, no role, no task) reads
this guide and walks you through the rest, as if you did not know the mode: what each session is,
which ones to hand it, the project's rules to write down. You don't need to know this guide to
start. When it cannot answer something from the guide, it says what was missing.

From then on:

1. Talk to the orchestrator. Let it start the workers and create the tasks.
2. Read the Work view; answer a topic in the orchestrator's chat (a double-click on it tells the
   orchestrator).
3. To talk to a session under the orchestrator, press "Take control" on its banner, and "Back to
   reporting to the orchestrator" when you are done; ask it to tell the orchestrator what came
   out of it.
