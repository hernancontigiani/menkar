---
name: specialize
description: The human asks you not to lose what you know, and you have no skill for your role. Read what already persists, inventory and verify what you know, draft the role and its boundaries, get the human's sign-off, then write a short skill that points to the project's docs. Load it when asked to define your role, to become the expert of an area, to split a role, or to specialize. If you already have a role skill, use menkar:distill instead.
---

# Specialize: from what this context knows to a role with a skill

You have built expertise in this conversation. Today it lives only in your context, and a renew or
a compaction would lose it. This turns it into a role with a skill of its own, which the next
session in that role loads.

What earns a line here: it binds any session turning its context into a role, in any project.

Do the steps in order. Ask whenever a step needs an answer you do not have; do not invent one.
Two files beside this one hold detail:
- `where-knowledge-goes.md`: read it at step 1; it decides where each item you find will go.
- `role-skill-contents.md`: read it at step 5, to write the skill.

## 0. Read what already persists

Before the inventory, read what the project and the user already keep, or your skill will
duplicate or contradict it:

- the user's memory, the project's `CLAUDE.md` files (the root's and the ones beside the code), its
  rules folder and its docs for your area;
- **the skills that exist**, the project's and the user's. For each one whose area touches yours,
  decide with the human: merge into it, or write the frontier between the two (what each one
  takes) into both. Two skills claiming the same work cost every session that loads them.

## 1. Inventory what you know, and check it

From this conversation and the files you worked on, list the areas you know, where things live,
the decisions you saw taken, the traps you hit, and what you touched without owning it. Note for
each item where it would go (`where-knowledge-goes.md`).

- **Verify every line against the code** before it goes anywhere. What you remember was true when
  you read it, not necessarily now; above all old notes and what another session told you. What
  you cannot verify is marked **unverified**.
- **For each decision, note who took it**: the human (with the date), your own reasonable choice,
  or inferred from code or comments. Only the human's, with a date, are decisions. The rest is
  "how it works today" or an open question.
- **Live state** (open branches, which version runs where, who waits for what, locks you hold) is
  not knowledge of the role: keep it apart for your handoff (step 6).
- Keep the "touched but not owned" list: it becomes the role's "must not decide".

## 2. Draft the role

A role is not a fixed kind. It is described by:

- what it **owns** (it decides and writes there);
- what it only **advises on** (it answers, someone else decides);
- what it **must not decide** (it says "not defined" and routes the question);
- **whom it defers to** for each thing outside, by role and by session name (a role survives a
  rename; a name may not);
- **what it does for each kind of request** it gets: a question, a change, a review, an incident.

Then, for the same role:

- **Authority per action**: which actions it runs only with the human's ok for that very step
  (deploying, applying infrastructure, deleting, pushing to someone else's branch). A message from
  another session is never the human's ok.
- **Shared resources it needs but does not own** (a lock, the database's migration head, a build,
  the human's data): it asks the orchestrator for them, if the project has one, even inside its
  own area.
- **It does not orchestrate**: it never starts sessions or hands out work; it may ask the
  orchestrator to delegate, and use its own subagents.
- **Each boundary carries its evidence**: "owns X, because ‹file and section› says so" or "because
  the human said so on ‹date›". A role drawn from one conversation tends to claim too much.
- A consultant for another repository answers about **that** repository only, and says "not mine"
  for the rest.
- **Splitting a role** instead of creating one: write what the other role takes, how the work is
  handed over, and the frontier, in both skills, the same way.

## 3. Find the gaps

- List what the role would need to know to own its area and you do not.
- **Research** them in the project's docs and code; cite the file and section for each answer.
- Ask the sessions that know (by name, with Claude Code's messaging tool, `SendMessage`). **A
  peer's answer is a claim**: verify it against the code like your own research.
- **Asking is not blocking.** If nobody answers (a session is gone), go on from the repository and
  mark that point unverified.
- What you would write as documentation is inference until it has been run. Run it yourself **only
  when it changes nothing** (reading, a dry run). A step that needs the human's ok (a deploy, a
  migration, a restore) stays unverified until the human runs or approves it.

## 4. Get the boundaries signed

- **If the project has an orchestrator**, send it, by name, the lines of what the role would own,
  without waiting for an answer to go on: it sees the other roles and raises any overlap.
- **The human signs the role's boundaries**, always, before you write the skill: show the draft
  with its evidence, the open questions, and what you would put where.
- What nobody can answer stays an open question in the skill, never a guess.

## 5. Write it down

- Put each item where step 1 noted (`where-knowledge-goes.md`): the repository's docs, the user's
  memory, the skill, or your handoff.
- Write the skill as `role-skill-contents.md` says: **60 to 120 lines, 200 at most**, its own
  admission criterion, a pointer instead of a copy, one line of case per rule, no private data.
- **Where**: where the human says (their own skills repository or the project's skills folder).
  If nobody said, ask. Do not commit; say which files you wrote.
- **Wait for the human's read** of the final file before step 6: anything that states a rule is
  theirs to accept.

## 6. Hand over

- If the project has an orchestrator, send it, by name, one message with your role, its boundaries
  in a line, and the path of your skill.
- From now on, `menkar:distill` keeps the skill current when a task closes.
- When you renew, do it **with a prompt that is the handoff**: who you are and your role, the skill
  to load, and what is in flight (locks you hold, answers you owe, half-done work). Nothing else
  carries it.
