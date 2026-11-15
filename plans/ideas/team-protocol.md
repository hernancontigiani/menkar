# Ideas — one team block delivered by Menkar, the role's skills stored, a generic `specialize`

> **Status: ideas, not a plan.** Written 2026-11-15 from a conversation with the human, to be
> continued in another session. The human's directions below are dated; everything else is a
> proposal. When designed, the result becomes rows in `plans/00-STATUS.md` §1 and a numbered plan;
> this file is then deleted.

Checked against the tree at `66f6666` (2026-11-14), which already holds plan 38's design
(multi-agent) and its decisions 1.135–1.143.

## The human's directions (2026-11-15)

- **One change, delivered together:** everything about how sessions talk to each other moves to
  one isolated place, the role's skills are stored per session and named by Menkar, and
  `specialize` becomes generic. They cannot ship apart: the lines that leave the skills need the
  place they move to, and that place needs the stored skills to say what to load.
- **On `main`, before the multi-agent work**, but designed so the communication part can vary per
  agent (Idea A′).
- **The role's skills are stored, several allowed, each with a keeper flag** (Idea B).
- **No check of loaded skills against expected ones**: once Menkar names the skills to load from
  what is stored, the problem it would catch is solved at the source (see "Not taken").
- **Open:** how the block reaches a session (MCP `instructions` or the command line; the human
  leans to MCP), and D10's amendment.

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

## Idea A — The team block, written once, delivered by Menkar in the orchestration mode

**Goal:** what a session needs to work in the team is always in its context, without depending on
a skill being loaded or on a handoff being written right, and it survives compaction and renew.

### What it says

Short (target: under 25 lines), in English, with the facts for **this** session filled in by Menkar:

- "You are ‹name› in project ‹project›. Your role: ‹role›. Load `‹skill›`, `‹skill›`; you keep
  `‹skill›`; `‹skill›` is read only, its keeper is ‹name›" (from Idea B's stored list); or "you are
  a worker: your task message says what to load"; or "you are the orchestrator: load
  `menkar:orchestrator`".
- "Your parent is ‹parent›; the orchestrator is ‹orchestrator›."
- The protocol, once: how to message a session (per agent, Idea A′); your report is your last
  message; a session that did not start you gets it by name too; Menkar's `[Menkar] …` posts are
  from the app, not a person; renew only with a handoff prompt (who you are, what is in flight —
  the skills are no longer the handoff's job, Menkar names them).
- The context policy that `specialize` copies into every role skill today (Idea C): who decides a
  renew, the yellow and red marks, distill then renew.

The skills then **point to it** instead of repeating it, and get shorter. **Only with the
orchestration mode on** for the project; with it off, nothing is added.

### How it reaches a session — open

| Option | How | For | Against |
|---|---|---|---|
| **1. The MCP server's `instructions`** | `initialize`'s result gains `instructions` (part of MCP's `InitializeResult`) | Menkar's MCP is already the layer common to every agent (1.129), so the same route can serve them all; no new flag; the server runs per session and knows its pane (`MENKAR_PANE`); a renew starts a new server, so the text is fresh | Today `initialize` returns none (`src/core/control/protocol.ts:309`); fixed at start, so a role changed mid-session shows only after the next renew; an agent may cap or ignore it |
| **2. The command line** (`--append-system-prompt` for Claude) | `buildCommand` adds it, through a file as the first prompt already is | Under Menkar's control entirely | Claude Code's own flag: each other agent needs its own equivalent, if it has one |

**Open (the human, 2026-11-15)**, leaning to option 1 because the command line is specific to
each CLI. To verify before deciding:

1. That Claude Code 2.1.32x reads `instructions` from a stdio server's `initialize`, puts it in the
   system prompt, and whether it truncates it (the `claude-cli` consultant, or a real session).
2. Whether Codex, Cursor and OpenCode read an MCP server's `instructions` at all
   (`plans/ideas/research/agents-compared.md` §1.4 lists their other routes: OpenCode's
   per-session `instructions`, Codex's `developer_instructions`).
3. Whether the server can learn, at `initialize`, the session's name, role, skills, parent and
   orchestrator (it has `MENKAR_PANE`; it asks main for the rest as its tools do).
4. Whether it survives `/compact` (the system prompt is not summarised; to confirm on a real one).

A smaller question: does a role or skills change (the row menu) need to reach a running session
before its next renew? If yes, a `[Menkar]` post saying so.

Neither option writes under `~/.claude` nor types into a terminal.

---

## Idea A′ — The communication part varies by agent

The part that changes most between coding agents is **how to talk to another session**: a Claude
Code session uses `SendMessage`; a Codex, Cursor or OpenCode session uses Menkar's `send_message`
(plan 38 §3.1, 1.143's D2–D3); how each is woken differs too (D1). So the block is the shared part
plus **one communication text per agent**.

- **Source layout, from the start:** `plugin/team/common.md` and `plugin/team/claude.md`; later
  `codex.md`, `cursor.md`, `opencode.md`. Menkar assembles the block for the agent a session runs.
  With Claude alone today, only the first two exist; the other files come with multi-agent support.
- **How the block reaches each agent is per agent too** (Idea A's open question), one of 1.135's
  per-agent strategies.

### How it meets plan 38 — open

- **D10 (1.143): "Claude's skill text unchanged, plus per-agent notes for the others."** This
  changes Claude's skill text (the communication lines leave the skills), and the per-agent notes
  D10 planned become the per-agent communication texts above: the same aim, one mechanism for
  every agent. **An amendment of D10, open (the human, 2026-11-15).**
- **R10 (a Claude-only user byte-identical):** its baseline is a snapshot of `main` taken before
  the first multi-agent change and refreshed when `main`'s changes merge into the branch. Done on
  `main` first, the cleanup is part of the baseline.
- **§6's rejection of "one agent-neutral skill text"** is not reopened: the skills stay Claude's
  native skills; only the communication lines move out, into a text that *is* per agent.
- Claude keeps `SendMessage` (D2); the block just says it in one place.

---

## Idea B — The role's skills, stored per session

**Agreed in direction (the human, 2026-11-15):** stored, several allowed, with a keeper flag.

- **Shape**, per session in `projects.json` beside the role:
  `skills: [{ "name": "deploy", "keeper": true }, { "name": "db-schema", "keeper": false }]`.
- **Why `keeper`:** a skill has one keeper (1.119), the expert that distills it. A role may keep
  several, or keep one and read another expert's read only, as a per-task worker already does.
  `menkar:distill` edits only the ones kept; the block says which are which.
- **Proposed setters** (open): the human in the row menu ("Role…" gains the skills);
  `start_session` (a `skills` argument beside `role`); `specialize` at its end (the skill it just
  wrote, as keeper).
- Menkar can check that a named skill exists (the plugin's, the project's `.claude/skills/`, the
  user's) and warn on a typo.
- Two sessions keeping the same skill is refused, as 1.119 already rules out two sessions of one
  expert.

---

## Idea C — `specialize` becomes generic

`specialize` is used **once per role**: it turns what a session knows into a role skill (or splits
a role); after that, `menkar:distill` keeps the skill current.

**What in it is the team's today:** sending the orchestrator the role's lines and the result by
name (88, 107), `list_sessions`, the context policy (who decides a renew, the yellow and red marks,
distill then renew) and the renew handoff (110–119). Worse, it asks every role skill it writes to
**carry that policy itself** ("a line your role skill carries for it"), so it is copied into each
role skill too.

**Proposal:**

- `specialize` keeps only what binds any project: read what persists, inventory and verify, where
  each item goes, the role and its boundaries, the human's sign-off, writing a short skill.
- Its last step records the new skill in the session's stored list (Idea B) instead of telling the
  session to name it in every handoff.
- The team's part moves to the block (Idea A); role skills stop carrying it.
- With the mode off there is no orchestrator, and `specialize` still works on its own.

`SendMessage` is Claude Code's tool; what is the team's is the convention of using it by name and
what to send.

---

## Not taken

- **Checking which skills a session loaded against the expected ones** (reading `Skill` loads from
  the transcript and logging a mismatch). The human, 2026-11-15: not worth it once Menkar names the
  skills to load from the stored list; the cause is removed rather than watched.
- **Doing the trim before the block's delivery**, or a stopgap `menkar:team` skill: the human,
  2026-11-15, everything ships together.

---

## What the one change holds

Designed as one plan (`/design-plan`) once the open points are decided:

1. The block's source: `plugin/team/common.md` + `plugin/team/claude.md`.
2. Its delivery for Claude in the orchestration mode (Idea A's option, once decided).
3. The per-session `skills` list with `keeper`, its setters, and the block naming it.
4. The four skills trimmed to point to the block; `specialize` made generic; `distill` editing
   only kept skills.
5. `tests/core/plugin.test.ts` extended: no communication line left in a skill.
6. On `main`, before multi-agent's P0 snapshot.

### Open, for the next session

1. Delivery: MCP `instructions` or the command line (verifications 1–4 above first).
2. D10's amendment (1.143).
3. Who may set a session's `skills` (the human only, or also `start_session` and `specialize`).
4. Whether a role or skills change reaches a running session before its renew.
