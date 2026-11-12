# Plan 33: Menkar's own skills — orchestrator, worker, distill (1.71)

> **Status:** written 2026-11-12 by `set`, from 1.71 and the measured delivery study
> (`plans/ideas/research/skills-delivery.md`). Ready to execute. **The three skills' texts are
> reviewed by the human before the plan is closed** (block 3).
>
> **Exit, when executed:**
> - `docs/session-control.md`: a section on the plugin — how it reaches a session, what is in it,
>   what Claude Code writes on its own (`~/.claude.json` usage counters), and "Rejected" below.
> - `plans/ROLE-ORCHESTRATOR.md`: keeps only what is this repository's own and loads
>   `menkar:orchestrator` for the rest; what leaves it goes verbatim to `docs/history/plans/`.
> - `plans/00-STATUS.md`: 1.71 points to `docs/session-control.md`; this row leaves §3.
> - The rest → `git log`.
>
> Replaces nothing in the code. Amends `plans/ROLE-ORCHESTRATOR.md` (block 4).

## Goal

The tools of Menkar's MCP (`start_session`, `renew`, `list_sessions`, `last_reply`) are useless
until an agent knows when and how to use them. Menkar ships three skills, to every Claude session
it starts, that teach the way of working the human has used with `set`, `b1` and `b2`, made general
for any project: the orchestrator's, a worker's, and distilling then renewing.

## What already exists (verified 2026-11-12)

- **Delivery, measured on Claude Code 2.1.322** (`plans/ideas/research/skills-delivery.md`):
  `--plugin-dir <dir>` with `.claude-plugin/plugin.json` (`{"name":"menkar",…}`) and
  `skills/<name>/SKILL.md` loads the skills as `menkar:<name>`; the model sees their descriptions
  and loads them by itself; `/menkar:<name>` works; `/skills` lists them "locked by plugin"; no
  trust prompt; **nothing written under `~/.claude/`** except Claude Code's own usage counters in
  `~/.claude.json` (`pluginUsage["menkar@inline"]`), which it writes for any plugin. A folder name
  becomes the skill's name, so `skills/orchestrator/` is `menkar:orchestrator` (not
  `menkar-orchestrator`, which would read `menkar:menkar-orchestrator`).
- **The tools the skills name**: `docs/session-control.md` (plan 31): `start_session { name,
  prompt?, prompt_file?, remote_control?, group? }`, `renew { prompt? }`, `list_sessions {}`,
  `last_reply { name }`; a parent is woken with "[Menkar] ‹name› is waiting at a permission prompt"
  / "finished its turn"; sessions are addressed by name (1.74).
- **The way of working to distill** (the source for the texts): `plans/ROLE-ORCHESTRATOR.md`
  ("Working with the human and the workers, day to day"), the decisions 1.52–1.74, and
  `plans/ideas/groups-and-orchestration.md` (the three profiles, undefined things and inventing,
  where experts come from), `plans/ideas/research/ways-of-working.md` §7.
- **The command line**: `buildCommand` (`src/core/command.ts`) adds `--settings`, `--mcp-config`,
  `--add-dir`; a Claude command is built in `startPaneHeld` (`src/main/workspace.ts`).
- **Packaging**: `electron-builder.yml` ships the app; the statusline script is a built entry
  resolved at run time (`statuslineCommand`, `src/main/context.ts`).

## The design

### Decided (1.71 and the human, 2026-11-11/12)

1. Three skills, shipped with Menkar: **`menkar:orchestrator`**, **`menkar:worker`**,
   **`menkar:distill`**. They work for any project and name Menkar's MCP tools.
2. They reach a session through a plugin passed with `--plugin-dir`; nothing is installed and
   nothing is written under `~/.claude` by Menkar.
3. The orchestrator **never decides what is not written**: it answers from what the project
   documents, citing the file, and routes anything undefined to the expert who owns it or to the
   human. It keeps track of the questions that reached the human, and when one kind repeats it
   proposes the fix: better docs, a skill or an expert, or a consultant session of another
   repository.
4. A worker's report is **its last message**, written once (1.73); the orchestrator reads it with
   `last_reply`.
5. Sessions message each other **by name** (1.74).
6. Distilling ends with **`renew`**, not with asking the human for `/clear` (1.70).

### Decided by `set` within those (technical and editorial, 2026-11-12)

7. **The plugin lives in the repository** at `plugin/` (`plugin/.claude-plugin/plugin.json`,
   `plugin/skills/{orchestrator,worker,distill}/SKILL.md`), ships with the app as an extra
   resource, and is resolved at run time (packaged: the resources folder; development: the
   repository's `plugin/`) through one function, like the statusline's script.
8. **`--plugin-dir <plugin>` is added for every Claude session Menkar starts** (new, resume, fork,
   renew, `start_session`), before `--settings`. Cursor gets nothing.
9. **What each skill says** (the executing session writes the texts from the sources above; each
   under 150 lines; English; no project's names — no "set", "b1", "ccai", "Menkar's plans/"):
   - **orchestrator** — when to load it: "you coordinate other sessions in Menkar". The human talks
     to you; you hand out work, you don't do it unless asked. **The three shapes** (you are also
     the expert / a PM with expertise beside a few experts / a PM without expertise beside many) and
     how to tell which one you are from the project and the human. **Handing out work**: who takes
     what (a worker you start with `start_session` for a plan, renewed or left when done; an
     existing expert by name); a task message is self-contained — facts measured, what is decided,
     what to do, the gates, whom to ask about what ("for X ask ‹expert›; if nothing covers it, ask
     me"), and "report as your last message". **Two sessions never write the same file at once**;
     parallel work is decided by the files and runtime resources each touches. **Being woken**: a
     "[Menkar] ‹name› finished its turn" means read its report with `last_reply`; "waiting at a
     permission prompt" means look with `list_sessions` and tell the human only if it needs them.
     **The human**: decisions are theirs, asked with concrete options and one recommendation; keep
     the open ones in a topics file, numbered, and point to the number; never in the middle of a
     topic being discussed. **Not inventing** (decision 3), and the recurring-questions record.
     **Verify a report against the tree** before relaying or acting on it. **Keep workers' contexts
     clean**: renew a worker when its task is done (or tell it to distill if it is a specialist).
   - **worker** — when to load it: "another session handed you a task". Read the task and the
     project's docs before acting; **never invent what is not defined**: ask the session the task
     names for that area, else the one that handed it to you; message by name. Stay inside the
     files the task names; ask before touching others. Run the gates the task names and report
     their real outcome. **Your report is your last message**: what changed (paths), the gates and
     their output, deviations, what is left, decisions needed — no narration while working beyond
     a line per step. Don't commit unless the task says so.
   - **distill** — when to load it: a specialist finishing a task, or told "distill". Find your own
     skill (the one for your area; ask where to create it if you have none). Keep what would help
     next time — traps, where things live, commands that worked, the human's preferences — and
     drop what the code or the project's docs already say and the story of the task. **Rewrite,
     don't append**; stay under ~150 lines. No secrets. Don't commit (the skill may live in a
     repository you can't push to): say which file changed and what. Then call **`renew`** with no
     prompt, unless your next task is known.
10. **This repository's orchestrator uses them** (1.71): `plans/ROLE-ORCHESTRATOR.md` keeps only
    what is Menkar's own (the plan method, `00-STATUS.md`, closing plans, `npm run ci`, the shared
    tree's git rules, b1 and b2) and says to load `menkar:orchestrator` for the rest.

### Rejected, and why

- **`--add-dir` of a folder holding `.claude/skills/`**: loads them too, but opens the folder to the
  agent's file tools.
- **MCP prompts**: only the human can call them (`/mcp__menkar__<name>`); the model can't load them.
- **MCP-served skills**: compiled off in 2.1.322.
- **Installing into `~/.claude/skills`**: a write under `~/.claude` (a human's decision) and a copy
  that goes stale with every Menkar update.
- **Folder names `menkar-orchestrator`, …**: would read `menkar:menkar-orchestrator`.
- **Roles, a roster file and the orchestration mode's UI**: the next design (STATUS §3 after this);
  these skills work with what exists — names, `list_sessions`, the project's docs and the human.

## Tests that hold the decisions (written before the code, in the block that names them)

| Decision | Test | Case → expected |
|---|---|---|
| 7 plugin shape | `tests/core/plugin.test.ts` (new) | `plugin/.claude-plugin/plugin.json` is JSON with `name: "menkar"`; exactly three skills, `orchestrator`, `worker`, `distill`, each a `SKILL.md` with a frontmatter `name` equal to its folder and a non-empty `description`; each body under 150 lines; none contains `set`, `b1`, `b2`, `ccai`, `agent-tablet` as a word |
| 9 tools named | same | the orchestrator's text names `start_session`, `renew`, `list_sessions`, `last_reply`; the distill text names `renew`; every tool named exists in the MCP server's `tools/list` (parity with `src/core/control/server.ts`) |
| 8 command | `tests/core/command.test.ts` | Claude `new`, `resume`, `fork` with `pluginDir: "/opt/Menkar/resources/plugin"` → `--plugin-dir /opt/Menkar/resources/plugin` before `--settings`; Cursor → none; old cases untouched |
| 7 resolution | `tests/core/paths.test.ts` or the resolver's own | packaged → the resources folder; development → the repository's `plugin/` |
| 8 reaches the pane | `e2e/window.spec.ts` (the command-line regexes) | the stand-in claude's command line carries `--plugin-dir` with an existing folder holding the three skills |
| 2 nothing written | block 3's real check | in a throwaway HOME, after a session starts with the plugin: no file under `~/.claude/` names `menkar` except the `~/.claude.json` counters |

## Out of scope

- The orchestration mode's design: roles as data, a roster, entering and leaving the mode, a panel,
  the shell drawer from the orchestrator's tab, priorities (`plans/ideas/`).
- Skills for Codex, Gemini or Cursor (`docs/NOT_BUILT_YET.md`, "More coding agents").
- The human's personal skills repository (`agent-skills`): `menkar:distill` edits whatever skill
  the specialist has; where that lives is the user's.

## Do not touch

- The MCP tools and their behaviour (plan 31): the skills describe them, never change them.
- `buildCommand`'s existing order and quoting; `--settings` stays last before `&& exit`.
- `~/.claude`: nothing written by Menkar.

## Execution blocks

### Block 1 — the plugin reaches every Claude session

- [ ] Write the shape, command and resolution tests; see them fail.
- [ ] `plugin/.claude-plugin/plugin.json` and three placeholder `SKILL.md` files with real
      frontmatter (texts come in block 2).
- [ ] `pluginDir` in `buildCommand`; the resolver; `--plugin-dir` on every Claude command Menkar
      builds; the plugin as an extra resource in `electron-builder.yml`; `npm run package:check`
      verifies it is in the .deb.
- **Verify:** `npm run ci`; `npm run ui-check` on the command-line specs; `npm run package` and
  `npm run package:check`.

### Block 2 — the three texts

- [ ] Write the three `SKILL.md` texts as decision 9 says, from the sources it names; the shape
      and tools tests pass.
- **Verify:** `npm run ci`.

### Block 3 — a real check, and the human's read

- [ ] Under `xvfb-run`, the real `claude` 2.1.322 in a throwaway HOME (never the human's
      `~/.claude` or sockets; `XDG_RUNTIME_DIR` left out; processes stopped by PID): `/skills` lists
      the three as `menkar:…`; asked "you coordinate other sessions; start a worker named w1 for
      this task", the model loads `menkar:orchestrator` and calls `start_session`; nothing under
      `~/.claude/` names `menkar` except `~/.claude.json`'s counters. Write what was seen in the log.
- [ ] **Stop and report the three texts to `set`** for the human to read; apply what the human
      changes.
- **Verify:** `npm run ci`.

### Block 4 — this repository's orchestrator uses them, and docs

- [ ] `plans/ROLE-ORCHESTRATOR.md` per decision 10; what leaves it verbatim to its history.
- [ ] `docs/session-control.md`'s plugin section.
- [ ] Execution log below.
- **Verify:** `npm run ci`.

## Execution log

_Written by the executing session._
