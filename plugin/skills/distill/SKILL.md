---
name: distill
description: Your task is closed and your context will go. Keep what it taught you, each item where it belongs. Your role's skill takes only what passes its admission criterion and points to the project's docs; project facts are proposed as documentation and the human's preferences go to memory. Then send the summary by name and renew with a handoff prompt. Load it when the session that handed you the task, or the human, tells you the task is closed and to distill. Not for a compaction.
---

# Distill, then renew

Your task is closed, and your context is about to go. What you learned is lost with it unless you
write it where the next session in your role will find it.

What earns a line here: it binds any specialist keeping its skill, in any project. **Not for a
compaction**: a compaction keeps the thread. If you were only asked to save what you know, do steps
1 to 4 and don't renew.

## 1. Find your skill

- It is the skill for your area or role, the one you loaded or were told about when you started.
- If you have none, use `menkar:specialize` to write one, or ask the session that handed you the
  task (or the human) where it goes. Do not invent a place.
- Read it whole before changing it, its **admission criterion** first: the skill's own rule for
  what earns a line. If it has none, the base one holds: "if a session that never loads this skill
  still needs it, it is not skill material".

## 2. Decide what goes where

Your skill is not documentation: it stays short and points to the project's docs by **file and
section, never by line**, so it stays right when they change. Each thing you learned goes to one
place:

- **A fact about the project** (a trap in the code, where a value is decided, a command that works,
  how a part behaves): propose it to the human as documentation for the repository, with its
  reason. Write it there once the human agrees, following the project's rules for its docs, and
  point the skill to that section. If a command can answer it, point to the command, not the value.
  With no human at hand, send the proposal to the orchestrator as a topic, or carry it in your
  handoff prompt; never drop it.
- **The human's preferences** (how they want things asked, shown or named): the user's memory, not
  the skill.
- **Today's state** (open branches, locks held, who waits for what): your handoff prompt (step 5).
  Never the skill, never a file.
- **What the skill keeps** is the role: its boundaries, its authority per action, what it does for
  each kind of request, whom to ask, what not to decide, its self-checks. Only what passes the
  admission criterion.

**No story, but each rule keeps the case that produced it**, in one line ("never X: in ‹month› X
lost a block silently"). A rule without its case gets deleted by the next reader.

Leave out:

- What the code or the docs already say: a pointer is enough. If a doc says something the code
  contradicts, the code wins; propose the doc's correction.
- Anything true only for this task.
- Private data: no secrets (tokens, keys, passwords), no client names, emails, real business data
  or clients' rule texts.

## 3. Rewrite, delete, re-read

- Fold each new point into the section where it belongs. Merge it with what is there, correct what
  turned out wrong, and **delete** what is no longer true or what the docs now say better.
- **Ask yourself, and the human when unsure, what to delete**, not only what to add: a skill that
  only grows stops being read.
- **Aim at 60 to 120 lines, 200 at most.** Past that, cut first what the docs now say better, then
  the least useful lines, never the newest just because they are new.
- **Re-read the boundaries** (owns, advises on, must not decide, defers to): the human changes
  them. If this task showed one is wrong, propose the change to the human; don't move it yourself.
- Keep the frontmatter `description` accurate: it is the situation that should load the skill.

## 4. Send the summary

- Do not commit: the skill may live in a repository you cannot push to.
- Send the session that handed you the task, **by name** with `SendMessage`, one message: the
  files you changed, the points you added, fixed or removed (one line each), and the documentation
  you proposed. Not as your last reply: after a renew it is read only through the previous
  conversation, and late.

## 5. Renew with a handoff prompt

Call Menkar's `renew` tool, **always with a prompt**. The prompt is the handoff, and nothing else
carries it:

- who you are and your role: "You are ‹name›, the ‹area› expert of ‹project›";
- the skill to load: "load ‹skill›";
- what is in flight: locks you hold, answers you owe, half-done work;
- your next task, if you know it; else "wait for the next task".

The fresh session keeps your name and your tab. When its next task comes after a gap, it first asks
the session that hands it what changed: the skill points to the docs, but it doesn't know what
moved.
