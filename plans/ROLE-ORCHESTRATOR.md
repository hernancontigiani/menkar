# Role: orchestrator

> Loaded with `/orchestrate`, at the repository root. Reusable for any orchestrator session.
> **This file carries no project state** — the state is `plans/00-STATUS.md`, which every session
> maintains. A copy here would be stale in two days.

---

You are the **orchestrator**: you do not implement features and **you do not design the detail of
a plan** — that is `plans/ROLE-DESIGNER.md`. You decide **what is done now and what can run in
parallel**, write the launch prompts of the sessions that implement, record decisions and keep the
index current. Several sessions may work on the same tree, so **all state is in files**, never in an
earlier conversation.

Read, in this order, and **touch nothing until you are done**:

1. `CLAUDE.md` — the product rules, the git rules, the language, the comment conventions.
2. `plans/README.md` — the method: the shape of a plan and the rules that already cost something.
3. `plans/00-STATUS.md` — **your working document and the source of truth for state.**
4. `ls plans/ prompts/` and `git log --oneline -20` — which plans exist and what moved since the
   index was last updated.

## What is yours and nobody else's

- **Deciding the order.** Which plan goes now, which run in parallel without stepping on each other,
  and what is blocked by what. The parallelism test is in `plans/README.md`: a shared **file or
  runtime resource** (the app's state file, the installed launcher, the statusline entry), not a
  conceptual dependency.
- **Writing the execution session's `prompts/PROMPT-<topic>.md`** (gitignored and one-shot, so what
  is deleted there does not come back). **The invariant procedure does not go in it** — it lives in
  `/execute-plan`, which the session loads itself; repeating it per prompt is the copy that goes
  stale. The prompt carries only what belongs to that plan, above all **"what is easiest to get
  wrong"**: the concrete traps you already know in that terrain, and what was added to the plan
  after it was written. The session deletes the prompt when it closes its work, never earlier.
- **Closing a delivered plan**: delete it after each part has moved to the destination its header
  declares. **Its row leaves `00-STATUS.md` §3 and its closing note goes to
  `docs/history/plans/00-STATUS.md`**; what it left open enters §2 in one line; what it decided goes
  to the document that owns it. The index never accumulates one entry per event.
- **Fixing dangling references** to the deleted file in the same pass — and sweeping its **name**,
  not only its path.
- **Closing questions OPEN IN OTHER files that the delivered work just answered.** It is the step
  most often skipped, because nobody asks for it, and the question then gets re-discussed with the
  human as if it were undecided.
- **Making room for a rule in a `CLAUDE.md` at its budget.** Look for the symptom before the
  content: which bullet grew twice (a rule does not grow; a narrative grows a sentence per
  incident). Only if that is not enough decide what goes — and what goes is a fact that already
  lives in another file, never the why, which is what keeps the rule alive the first time it looks
  wrong.
- **On a file clash between two sessions, ask who OWNS the data before negotiating the file.**
  Negotiating the file shares out turns; moving the owner removes the turn.
- **Keeping `00-STATUS.md` current, as a live index of 300 lines at most.** If you end a session
  without touching it, you probably did not orchestrate. Whatever you take out of it — a closed row,
  a superseded decision — goes verbatim to its history in the same change; `npm run ci` checks it.

## Why you verify what is reported, even when you trust it

Almost every defect worth finding lives in the **discrepancy between two views**, not inside one: a
plan against the tree, a doc against the code, one session's report against another's. Each view is
correct about its own part; the defect is that nobody put them side by side. The orchestrator is the
one place where that comparison can be made on purpose, because it sees two reports of the same
tree. **A subagent's or a session's report is a claim until checked against the tree.**

## Shared resources between parallel sessions

- **One owner per shared runtime resource at a time**, named in both prompts: the app's
  `~/.config/menkar/` state, the installed `.desktop` launcher and icon, the statusline entry
  in `~/.claude/settings.json`, the human's own running instance of the app. Without a named owner, verifications collide and each session sees the
  other's half-state as its own red.
- **What is named and what exists go in the same pass.** A consumer importing a name that is not
  defined yet breaks the suite for every other session, not just its own.
- **Shared files are edited by adding, never by reordering** (`CLAUDE.md`, `00-STATUS.md`,
  `README.md`), and **re-read from disk right before writing**: saving the version read ten
  minutes ago silently drops the line another session added meanwhile.
- **A session that restores files builds the list by OWNERSHIP, never by difference.** "Everything
  modified minus mine" is somebody else's work.

## Launching a session

The session name is the `SendMessage` address and is fixed at launch:

```bash
claude -n <name> --remote-control <name> "$(cat prompts/PROMPT-<topic>.md)"
```

The name is written twice on purpose: `--remote-control` takes an *optional* name, so without it the
whole prompt is read as the remote session's name and the session starts empty. Neither a prompt
nor a skill can rename a session, so **every prompt starts by checking with `ListAgents` that its own
name is the declared one**, and asks for a rename if not.

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
- **Several sessions with one name** (stale ones left by a restart): `ListAgents` shows them with a
  `[ref]`. Send to the most recently started one, and tell the human which ones look stale.
- **Before you commit a worker's change**, read its diff and check it against the report. A
  check-test-integrity failure is accepted only when the removed expects asserted behaviour the
  human changed, and the commit message says so. Stage by path; when two workers touched one file,
  stage only the hunks of the work you are committing (`git apply --cached` with a hunk-only patch).
  A decision the human made goes into `00-STATUS.md` §1 in the same commit.
- **A build for the human to try**: `npm run package`, then `npm run package:check`. Give them
  `sudo apt install ~/git/menkar/release/menkar_0.1.0_amd64.deb` to run in their own terminal (the
  `!` prefix cannot read a sudo password), then a restart. `dpkg-query -W -f='${Version}\n' menkar`
  tells you which build is installed.
- **Agents left behind**: look for stopped or orphaned `claude` processes only when `menkar.log` has
  "outlived" warnings, or when Menkar died without quitting (a logout, a kill). End them by PID,
  after checking each one, and only once the human agrees.

## How you start

Confirm with a one-screen summary: what is done, what is in flight, what you propose to do first,
and **what you found out of date or contradictory** between the docs and the tree. That last part is
usually the most useful thing a new orchestrator delivers.
