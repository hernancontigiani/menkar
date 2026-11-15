# Ideas — one team protocol injected by Menkar, a generic `specialize`, and checking skill loads

> **Status: ideas, not a plan.** Written 2026-11-15 from a conversation with the human, to be
> continued in another session. Nothing here is decided; every "Proposal" is a recommendation
> waiting for the human. When accepted, each part becomes a row in `plans/00-STATUS.md` §1 and a
> numbered plan; this file is then deleted.

Checked against the tree at `f3a4201` (2026-11-14).

## Where things stand

- **Menkar passes no skill to any session.** Every Claude command it builds carries
  `--plugin-dir <plugin>`, so `menkar:orchestrator`, `menkar:worker`, `menkar:distill` and
  `menkar:specialize` are *available*; which one *loads* depends on the text a session receives.
  A renew starts the fresh session with the prompt the session gave `renew { prompt }`, and Menkar
  adds nothing (`docs/session-control.md`, "Renewing"). The only text Menkar writes itself is the
  first-time card's "Load `menkar:orchestrator`…" (`src/core/i18n/en.ts:118`).
- **Who names which skill**, all written by agents following the skills:
  - the orchestrator renews with "load `menkar:orchestrator`"
    (`plugin/skills/orchestrator/SKILL.md:199`);
  - a task message starts "…load `menkar:worker`. It is task N."
    (`plugin/skills/orchestrator/SKILL.md:95`);
  - an expert renews (when the orchestrator says so, after `menkar:distill`) with "You are ‹name›,
    the ‹area› expert… load ‹skill›" (`plugin/skills/distill/SKILL.md:75`,
    `plugin/skills/specialize/SKILL.md:117`). So a renewed expert has its role skill only; working
    a task it has both, since the task message names `menkar:worker`.
  - a per-task worker in an expert's area loads that expert's skill read only
    (`plugin/skills/orchestrator/workers.md:37`).
- **The weak point:** all of it rests on an agent writing the right handoff. An expert that renews
  without naming its skill comes back with no role, and nothing notices.
- **The team's rules of communication are repeated in four skills**: message by name with
  Claude Code's `SendMessage`, never by id; the report is the last message (read with
  `last_reply`); a session that did not start you also gets the report by name, since Menkar wakes
  only the parent; renew always with a handoff prompt. In `orchestrator/SKILL.md` (47, 56, 74,
  106), `worker/SKILL.md` (39, 98–102, 131), `distill/SKILL.md` (70, 75–84) and
  `specialize/SKILL.md` (78, 88, 107–119).

---

## Idea A — Menkar injects the team protocol, in the orchestration mode only

**Goal:** the information a session needs to work in the team is always in its context, without
depending on a skill being loaded, and it survives compaction and renew.

### What the text says

Short (target: under 25 lines), in English, the facts for **this** session filled in by Menkar:

- "You are ‹name› in project ‹project›. Your role: ‹role› — load `‹skill›`" (or "you are a worker:
  your task message says what to load"; or "you are the orchestrator: load `menkar:orchestrator`").
- "Your parent is ‹parent›; the orchestrator is ‹orchestrator›."
- The protocol, once: message by name with `SendMessage`, never by id; your report is your last
  message; a session that did not start you gets it by name too; Menkar's `[Menkar] …` posts are
  from the app, not a person; renew only with a handoff prompt (who you are, the skill, what is in
  flight).

The skills then **point to it** instead of repeating it, and get shorter.

### How it gets in — options

| Option | How | For | Against |
|---|---|---|---|
| **1. The MCP server's `instructions`** | `initialize`'s result gains `instructions` (part of MCP's `InitializeResult`); Claude Code puts a server's instructions in the session's system prompt | No new flag; the server already runs per session and knows its pane (`MENKAR_PANE`); a renew starts a new server, so the text is fresh | Today `initialize` returns none (`src/core/control/protocol.ts:296`); fixed at start, so a role or mode changed mid-session shows only after the next renew; Claude Code may cap its length |
| **2. `--append-system-prompt`** | `buildCommand` adds it, through a file as the first prompt already is (`"$(cat '<copy>')"`) | Under Menkar's control entirely; same freshness as 1 | A new flag on every command; the text is on disk in the prompts' folder |
| **3. A skill `menkar:team`** | One more skill holding the protocol | Simplest | Must be loaded, which is the problem it solves |

**Proposal:** option 1; option 2 if `instructions` cannot carry it (length, or not shown).
**Only with the orchestration mode on** for the project; with it off, nothing is added.

Neither option writes under `~/.claude` nor types into a terminal. "What the app needs in the
sessions it starts goes with `--settings`" is the closest rule: option 2 would be a sibling of it
(another command-line flag), which is a decision for the human.

### To verify before designing

1. That Claude Code 2.1.32x reads `instructions` from a stdio server's `initialize`, puts it in the
   system prompt, and whether it truncates it (the `claude-cli` consultant, or a test with a real
   session).
2. Whether the server can learn, at `initialize`, the session's name, role, parent and orchestrator
   (it has `MENKAR_PANE`; it asks main for the rest as its tools do).
3. Whether it survives `/compact` (the system prompt is not summarised; to confirm on a real one).

### Questions for the human

- Option 1 or 2?
- Does a role change (the row menu's "Role…") need to reach the session before its next renew? If
  yes, a `[Menkar]` post saying so, since the injected text is fixed at start.

---

## Idea B — Check which skill a session loaded against the one expected

**Goal:** know, at least in the log, when an expert works without its skill.

- **What was loaded:** a skill load leaves a mark in the session's transcript, which Menkar already
  reads, read only. Expected shapes (**not checked on a real transcript yet**): a `tool_use` named
  `Skill` with `input.skill` (`menkar:worker`, `deploy`), or a user message with
  `<command-name>/‹skill›</command-name>` when the human typed it. `skillUsage` in `~/.claude.json`
  is a global count, not per session, so it does not help.
- **What was expected:** nothing holds it today; a session has a role label, not a skill name.
  Options: a "skill" field per session beside the role (set in "Role…" and by `start_session`'s
  `role`), or the convention that the role label *is* the skill's name (`role-skill-contents.md`
  already makes the skill's `name` the role, lowercase with hyphens). Idea A needs the same value.
- **When to compare:** after a renew, once the first turn ends; and when a task starts (its
  assignee should load `menkar:worker`). A mismatch is logged with the session's name, role, the
  expected and the loaded skills. Later, if useful: a mark on the row in the Team view.
- **Why it still matters if the skill is well written:** a good description makes a skill load when
  a task in its area arrives, but a renewed expert told "wait for the next task" has nothing to
  trigger it. Idea A names the skill anyway; this check shows when that was not enough.

### Questions for the human

- Log only, or also a mark in the Team view?
- A skill field per session, or the role label as the skill's name?

---

## Idea C — `specialize` becomes generic

`specialize` is used **once per role**: it turns what a session knows into a role skill (or splits
a role); after that, `menkar:distill` keeps the skill current.

**What in it is Menkar's or the team's today:** sending the orchestrator the role's lines and the
result by name (88, 107), `list_sessions`, the context policy (who decides a renew, the yellow and
red marks, distill then renew) and the renew handoff (110–119). Worse, `specialize` asks every role
skill it writes to **carry that policy itself** ("a line your role skill carries for it"), so it is
copied into each role skill too.

**Proposal:**

- `specialize` keeps only what binds any project: read what persists, inventory and verify, where
  each item goes, the role and its boundaries, the human's sign-off, writing a short skill.
- The team's part (tell the orchestrator, the context policy, the handoff) moves to Idea A's
  injected text, which every session in the mode has anyway; role skills stop carrying it.
- With the mode off there is no orchestrator, and `specialize` still works on its own.

Note: `SendMessage` is Claude Code's tool, not Menkar's; what is Menkar's (or the team's) is the
convention of using it by name and what to send.

---

## Suggested order

1. The verifications of Idea A (one consultation with `claude-cli`, one real transcript for B).
2. Idea A, with the skills trimmed to point to it (one plan: the server or the command, plus the
   four skills' texts and `tests/core/plugin.test.ts`).
3. Idea C, in the same pass as the skills' trim or right after.
4. Idea B, which reuses A's "expected skill".
