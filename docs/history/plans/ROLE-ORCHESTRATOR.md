# History of `plans/ROLE-ORCHESTRATOR.md`

## What is yours and nobody else's

> Left on 2026-11-12: what holds for any project moved to the `menkar:orchestrator` skill, which this file now loads first (decision 1.71, plan 33).
- **Deciding when a worker's context is reset.** A worker cannot clear or compact itself, and the
  human runs the command in its tab, so you say when and which. Between tasks, once its work is
  committed and nothing is owed to it, the default is `/clear`: the plan and the tree hold
  everything the next task needs. `/compact` (with `/compact-safe` first, so the worker writes its
  handoff) only when a long task fills it mid-way. Ask for it as a topic in one line, naming the
  worker, never in the middle of the worker's block.

## Why you verify what is reported, even when you trust it

> Left on 2026-11-12: what holds for any project moved to the `menkar:orchestrator` skill, which this file now loads first (decision 1.71, plan 33).
## Why you verify what is reported, even when you trust it
Almost every defect worth finding lives in the **discrepancy between two views**, not inside one: a
plan against the tree, a doc against the code, one session's report against another's. Each view is
correct about its own part; the defect is that nobody put them side by side. The orchestrator is the
one place where that comparison can be made on purpose, because it sees two reports of the same
tree. **A subagent's or a session's report is a claim until checked against the tree.**

## Working with the human and the workers, day to day

> Left on 2026-11-12: what holds for any project moved to the `menkar:orchestrator` skill, which this file now loads first (decision 1.71, plan 33).
## Working with the human and the workers, day to day
- **The human talks only to you.** You send the workers their instructions yourself with
  `SendMessage`; the human never relays them by hand. A worker's instruction is self-contained: the
  facts you measured (file:line, numbers), what is decided, what to do, which gates to run, and "no
  commit".
- **Topics for the human live in a list, not in the chat** (a trial since 2026-11-11, decision 1.52,
  to learn what a Menkar panel would need). Keep `prompts/TOPICS.md` (gitignored): one entry per
  topic, with a number, a title, a short paragraph of context, where it came from (a worker, a
  file), and its status (`open` → `discussing` → `decided`, with the decision and its date). When
  you need the human, add the topic and say its number in one line; when the human says "topic 7",
  read it from the file. A decided topic goes to its home (`00-STATUS.md`, a doc) and leaves the
  list.
- **Workers' reports go to files, not into your chat.** Ask each worker to write its report to
  `prompts/reports/<worker>-<topic>.md` and send you one line with the path. Read reports between
  topics, or when the human asks, never in the middle of a topic you are discussing with them. Don't
  subscribe to idle notices (`notify_when_idle`): each one costs you a turn and says nothing a
  report doesn't.
- **Address sessions by name, never by their `[ref]` or session id**, and tell the workers to send
  their one-line report to `set` by name: a `/clear` or a renew gives a session a new id, and a
  message to the old one is lost (1.74).

## How you start

> Left on 2026-11-12: what holds for any project moved to the `menkar:orchestrator` skill, which this file now loads first (decision 1.71, plan 33).
Confirm with a one-screen summary: what is done, what is in flight, what you propose to do first,
and **what you found out of date or contradictory** between the docs and the tree. That last part is
usually the most useful thing a new orchestrator delivers.

## This repository's conventions, day to day

> Left on 2026-11-12: the topics-file trial (1.52) ends; topics go through Menkar's topic tools (plan 34).
- **The topics file is `prompts/TOPICS.md`** (gitignored; a trial since 2026-11-11, decision 1.52,
  to learn what a Menkar panel would need). A decided topic goes to `00-STATUS.md` or the doc that
  owns it.
