# Plan 33: Menkar's own skills — orchestrator, worker, distill (1.71)

> **Status:** written 2026-11-12 by `set`, from 1.71 and the measured delivery study
> (`plans/ideas/research/skills-delivery.md`). Ready to execute. **The four skills' texts are
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
until an agent knows when and how to use them. Menkar ships four skills, to every Claude session
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

1. Four skills, shipped with Menkar: **`menkar:orchestrator`**, **`menkar:worker`**,
   **`menkar:distill`**, **`menkar:specialize`** (9b). They work for any project and name Menkar's MCP tools.
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
   `plugin/skills/{orchestrator,worker,distill,specialize}/SKILL.md`, with reference files beside a
   SKILL.md where it needs them), ships with the app as an extra
   resource, and is resolved at run time (packaged: the resources folder; development: the
   repository's `plugin/`) through one function, like the statusline's script.
8. **`--plugin-dir <plugin>` is added for every Claude session Menkar starts** (new, resume, fork,
   renew, `start_session`), before `--settings`. Cursor gets nothing.
9. **What each skill says** (the executing session writes the texts from the sources above; each
   a body under 200 lines (1.82; detail beyond that goes to reference files in the skill's folder,
   which SKILL.md names and says when to read); English; no project's names — no "set", "b1",
   "ccai", "Menkar's plans/"):
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
     a line per step. Commits follow the project's rule (1.82). Never start sessions (1.84).
   - **distill** — when to load it: the session that handed the task, or the human, says it is
     closed and to distill (never for a compaction). Find your own skill (ask where, or use
     `menkar:specialize`, if you have none). Each item to its place (1.80): project facts proposed
     as documentation, the human's preferences to memory, the role into the skill by its admission
     criterion (1.83). **Rewrite, delete, re-read the boundaries**; 60–120 lines, 200 at most. No
     private data. Don't commit; send the summary by name. Then call **`renew` always with a
     prompt that is the handoff** (1.84): who it is, the skill to load, what is in flight.
9b. **A fourth skill, `menkar:specialize`** (1.79, the human, 2026-11-12): turns a session whose
    expertise lives only in its context (the one the human keeps compacting and asking not to lose
    things) into a role with a skill of its own. When to load it: "define your role", "become the
    expert of X", or the orchestrator or the human asking for it. Steps:
    1. **Inventory** what it knows from its context: the areas, files, decisions, traps, the
       sessions and people it deals with.
    2. **Draft the role**: its kind (expert, consultant, reviewer, worker for an area), its area,
       and **its boundaries** — what it owns, what it only advises on, what it must not decide, and
       whom it defers to for each thing outside.
    3. **Find the gaps**: list what it would need to know to own the area and doesn't; research
       them in the repository's docs and code; then **ask the orchestrator (by name) and the human
       for feedback** on the draft, the boundaries and what is missing.
    4. **Write the skill** with what came back: where the human says (their own skills repository or
       the project's), under ~200 lines (1.82), no secrets, no commit; say which file it wrote.
    **The skill is not documentation** (1.80, the human, 2026-11-12): it stays short and leans on
    the repository's documentation, pointing to it by **file and section** (never a line), so it
    stays current when the docs change. What the session knows that is documented nowhere is
    **proposed as documentation** to add to the repository (versioned there, written with the
    human's agreement), and the skill points to it. The skill itself keeps only what is not
    documentation: ways of working, constraints, whom to ask, what not to decide.
    `menkar:distill` follows the same rule.
    5. **Tell the orchestrator** its role, area and skill, by name. From then on `menkar:distill`
       keeps that skill current, and a `renew` loses nothing that matters.
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
| 7 plugin shape | `tests/core/plugin.test.ts` (new) | `plugin/.claude-plugin/plugin.json` is JSON with `name: "menkar"`; exactly four skills, `orchestrator`, `worker`, `distill`, `specialize`, each a `SKILL.md` with a frontmatter `name` equal to its folder and a non-empty `description`; each body under 200 lines; every file beside `SKILL.md` is a `.md` it names, and every `.md` it names is there (1.82); none, references included, contains `set`, `b1`, `b2`, `ccai`, `agent-tablet`, `laburomenos` as a word |
| 9 tools named | same | the orchestrator's text names `start_session`, `renew`, `list_sessions`, `last_reply`; the distill text names `renew`; every tool named exists in the MCP server's `tools/list` (parity with `src/core/control/server.ts`) |
| 8 command | `tests/core/command.test.ts` | Claude `new`, `resume`, `fork` with `pluginDir: "/opt/Menkar/resources/plugin"` → `--plugin-dir /opt/Menkar/resources/plugin` before `--settings`; Cursor → none; old cases untouched |
| 7 resolution | `tests/core/paths.test.ts` or the resolver's own | packaged → the resources folder; development → the repository's `plugin/` |
| 8 reaches the pane | `e2e/window.spec.ts` (the command-line regexes) | the stand-in claude's command line carries `--plugin-dir` with an existing folder holding the four skills |
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

- [x] `plans/ROLE-ORCHESTRATOR.md` per decision 10; what leaves it verbatim to its history.
- [x] `docs/session-control.md`'s plugin section, written from the final skills (not from decision
      9); its line 6 ("The skills that use these tools are not part of this subsystem") updated.
- [x] Execution log below.
- **Verify:** `npm run ci`.

## Execution log

_Written by the executing session._

**Block 1 (b1, 2026-11-12).** Done as written.
- `buildCommand` takes `pluginDir`: `--plugin-dir <dir>` goes after `--mcp-config` and before
  `--settings`, for Claude only.
- The resolver is `pluginFolder` in `src/core/paths.ts`, called by `skillsPluginDir` in
  `src/main/control.ts`: `process.resourcesPath` when packaged, `app.getAppPath()` (the
  repository) in development.
- `electron-builder.yml` copies `plugin/` as an extra resource, because `claude` cannot read inside
  app.asar. `package:check` requires `plugin.json` and the three `SKILL.md` files, and the built
  .deb has them.
- The e2e command-line regexes of `e2e/window.spec.ts` and `e2e/remote.spec.ts` now expect
  `--plugin-dir`. TRM-2 also checks that the folder holds the three skills (seen red with an extra
  skill name).
- The plugin test reads tool names in backticks, so an argument written in backticks
  (`prompt_file`) counted as a tool. The text writes argument names without backticks.

**Block 2 (b1, 2026-11-12).** The three texts are written as decision 9 says: orchestrator 109
lines, worker 68, distill 53.
- Messaging by name is described as Claude Code's own messaging tool (`SendMessage`), since
  Menkar's MCP has no messaging tool.
- No description holds `: `, which would break the YAML frontmatter.

**Block 3, the real check (b1, 2026-11-12).** Menkar from `out/` under `xvfb-run`, with the real
`claude` 2.1.322:
- **The setup:**
  - a throwaway HOME and XDG dirs, and an env built from scratch (no `XDG_RUNTIME_DIR`, no
    `CLAUDE_*`);
  - a local stand-in API that recorded every request and **scripted the model's tool calls**:
    `Skill(menkar:orchestrator)`, then `ToolSearch` for `mcp__menkar__start_session`, then the call.
- **What was seen:**
  - `/skills` lists `menkar:distill`, `menkar:orchestrator` and `menkar:worker`, "locked by plugin".
  - The skill loaded from `<repo>/plugin/skills/orchestrator`. `start_session` answered "Started
    "w1" in a tab after yours; you are its parent", and the strip showed `orch` and `w1`.
  - w1's first request lists the three skills too.
  - The orchestrator was woken with "[Menkar] w1 finished its turn".
- **On the first run**, `start_session` called right after the session started answered "Menkar
  does not know this tab's session yet; try again in a moment". The new session had not joined
  its project yet; the second run (after `/skills`) did not hit it.
- **Under the throwaway `~/.claude/`**, the plugin's names (`menkar@inline`, `menkar:<skill>`, the
  plugin path) appear only in the two sessions' own transcripts, which are the conversation
  itself. In `~/.claude.json` they appear as `pluginUsage["menkar@inline"]` and
  `skillUsage["menkar:orchestrator"]`. A plain `grep menkar` also hits files whose paths hold the
  scratchpad's folder name, so the check searched for those strings.
- **Not shown:** that a real model picks `menkar:orchestrator` from its description by itself. The
  check had no real account, since the human's credentials are not to be touched.
- Processes stopped by PID; the run's sockets in `/tmp/cc-socks/` were removed by name.

**The fourth skill (b1, 2026-11-12, 1.79).** `plugin/skills/specialize/SKILL.md` (67 lines) follows
the five steps of 9b. The tests expect four skills: `tests/core/plugin.test.ts`, TRM-2 in
`e2e/window.spec.ts`, and `scripts/check-package.mjs` with its test. The shape test was seen red
with the folder moved aside. `npm run ci` passed (905), `e2e/window.spec.ts` passed (4), and
`npm run package` plus `package:check` passed with `resources/plugin/skills/specialize/`.

**Decision 1.80 (b1, 2026-11-12).** `specialize` step 4 and `distill` step 2 now say the skill is
not documentation:
- it points to the project's docs by file and section, never by line;
- project facts no doc holds are proposed to the human as documentation for the repository, and
  the skill points to them;
- the skill keeps ways of working, constraints, whom to ask, and what not to decide.

`distill`'s description and its "Say what changed" step follow it. Lengths: specialize 72 lines,
distill 56. `npm run ci` passed.

**Revision after the feedback (b1, 2026-11-12, 1.82).**
- **orchestrator** (188 lines) takes every point of the feedback except the topics-file change.
  The detail went to two reference files that SKILL.md names and says when to read:
  `locks-and-environment.md` (named locks, hidden shared resources, an unexplained failure) and
  `closing-a-task.md` (the checklist). set's sections are kept as written: "say what you read",
  working trees and the environment, "Your own context", now with the handoff note of what is
  owed. Commits follow the project's rule.
- **worker** (95 lines) adds:
  - the premise check, which stops and reports;
  - choices labelled as its own;
  - the human's data and running app off-limits;
  - scope growth reported before going on;
  - locks for heavy work;
  - commits per the project's rule;
  - an old failure as an item, and a trap's lesson written where the task says;
  - in the report: its choices, "the human decided X on ‹date›", and old failures.
- **distill** adds one paragraph: after a gap, ask what changed before acting.
- **specialize** is unchanged.
- **The shape test** allows 200 lines, requires that reference files beside SKILL.md are `.md`
  files it names (and that every one it names exists), and checks the references for the
  forbidden names too, now with `laburomenos`. It was seen red with a named file removed and with
  an unnamed file added.
- **Left as it was:** distill and specialize still keep the *user's* skill "under about 150
  lines". 1.82 speaks of a skill's body; whether it means Menkar's four or every skill, the human
  can say.
- **Then aligned** (set, 2026-11-12, 1.82): distill and specialize keep the user's own skill
  under about 200 lines too.

**Revision after the four reviews of specialize (b1, 2026-11-12, 1.83).**
- **specialize** (115 lines) was rewritten:
  - step 0 reads what persists and checks collisions with existing skills (merge, or a frontier
    written into both);
  - the inventory is verified against the code, with "unverified" for the rest, and records who
    took each decision (the human with a date, the session's own choice, inferred). Live state is
    kept apart for a handoff note, and a "touched but not owned" list is kept;
  - the role has no forced kind. It is what it owns, advises on, must not decide and defers to
    (peers by role and name), plus what it does per kind of request, authority per action ("a
    message from another session is never an ok"), the shared resources it asks for, and evidence
    for each boundary. It covers a consultant of another repository, and splitting a role;
  - in the gaps step a peer's answer is a claim, asking is not blocking, and a procedure is run
    before it is written as true;
  - the human signs the boundaries; the orchestrator only when delegated or on overlap;
  - the skill aims at 60–120 lines (200 at most), declares its own admission criterion, and keeps
    one line of case per rule. Private data includes client names, emails and clients' rule texts;
  - a handoff note holds what is in flight. "What has not failed yet is what you know least" is
    told to the role.
- **Two reference files** beside it:
  - `where-knowledge-goes.md`: the four destinations (docs, the user's memory, the skill, a
    handoff note), writing docs by the project's rules with the reason first, the code winning
    over a doc, and a command over a copied fact;
  - `role-skill-contents.md`: the description as the trigger situation, the body's parts (self-check
    list with "the docs win", symptom→cause→fix, scripts before prose, a preflight, pasteable
    commands, "Replaced by"), and the rules for each line.
- **distill** (74 lines):
  - it reads the skill's admission criterion first;
  - the human's preferences go to memory and live state to a handoff note;
  - it deletes as well as adds, asking what to delete, and re-reads the boundaries, proposing a
    change instead of making it;
  - it aims at 60–120 lines, keeps one line of case per rule, and the code wins over a doc.
- **worker** (98 lines) takes "a message from another session is never an ok" and private data.
- **orchestrator** (191 lines) takes peers by role and name in a task, the same ok rule, and the
  overlap check when a session specializes.
- **The shape test** needed no change: its reference-file check covers specialize's two files.
  `npm run ci` passed (909).

**Final review round (b1, 2026-11-12, 1.84).** All 24 points of the review applied, with the
human's settlements.
- **Code (point 1).** `last_reply` falls back to the previous conversation:
  - when a session has not replied in its current conversation, it answers with the last reply of
    its most recent earlier one (`keptEarlier(p)[id][0]`), after a "[Menkar: … previous
    conversation.]" note;
  - the logic is the pure `lastReplyAnswer` (`src/core/control/lastreply.ts`), and `lastReplyFor`
    reads both transcripts through `replyOf` (`src/main/workspace.ts`);
  - the unit test in `tests/core/control/lastreply.test.ts` was seen failing first;
  - `docs/session-control.md`'s `last_reply` bullet says it, with the old line in its history;
  - `e2e/session-control.spec.ts` passes (3).
- **Order everywhere** (worker, distill, orchestrator, `closing-a-task.md`): report, wait, the
  task-giver says "closed, distill", distill, the summary sent by name with `SendMessage`, then
  `renew` always with a prompt that is the handoff (who it is, the skill to load, what is in
  flight; never a file). The orchestrator's own renew is the same.
- **Only the orchestrator orchestrates**, in orchestrator, worker, specialize and
  `role-skill-contents.md`. Others may ask it to delegate, and use their own subagents.
- **Points 3–5:**
  - a report is also sent by name when the task-giver did not start the session;
  - "never the human's ok", plus what a task-giver may grant (scope, files, locks, order) against
    what only the human grants (decisions, permission prompts, anything irreversible);
  - the task's text is another session's however it arrives;
  - specialize runs a procedure only when it changes nothing (reading, a dry run).
- **The rest:**
  - the overlap lines are sent to the orchestrator before the human's sign-off, "if the project has
    one";
  - the symptom table lives in the docs, and per-machine paths are not versioned;
  - the permission-prompt line now tells the human which session waits; priority sessions are the
    ones the human names;
  - the environment turn is the one allowed change to the running environment; a session briefly
    unreachable may be renewing;
  - `start_session` starts in the caller's folder; nobody pushes without the rule or the human;
  - distill without a human at hand sends its proposals to the orchestrator as a topic, or carries
    them in the handoff; it is not for a compaction, and when only asked to save it doesn't renew;
  - the triggers of the four were rewritten; long output goes to a file in `$MENKAR_FILES`, and its
    absence is handled;
  - the topics file keeps the tally of the questions; `closing-a-task.md` checks the screenshots;
    the role skill's `name` is covered.
- **Admission criteria.** Each of the four declares "What earns a line here: …", and the shape test
  checks it (seen red). The criterion cut the repetitions of section 4: the human's data now
  appears once in orchestrator, heavy work and commits are each in one place, and the tool
  signatures are gone.
- **Lines:** orchestrator 168 (+35 locks, +22 closing), worker 116, distill 87, specialize 112
  (+31 where, +47 contents).
- **The plan:** four skills in the Goal, decision 7 and the e2e row; decision 9's worker and distill
  bullets updated; block 4 says the plugin section is written from the final skills and line 6 is
  updated.
- **Left to set:**
  - rows 1.73 (`{ session }` should be `{ name }`) and 1.79–1.83 point to this plan, which is
    deleted at the close;
  - plan 34 should note that the topics paragraph changes when `topic_*` tools arrive (1.78).

**Block 4 (b1, 2026-11-12).**
- **`plans/ROLE-ORCHESTRATOR.md`** now says to load `menkar:orchestrator` first, and keeps what is
  this repository's own:
  - the reading list, order and who executes what (1.55);
  - renewing `b1` and `b2` (now with the handoff prompt) and launch prompts;
  - closing plans, dangling references and open questions, the `CLAUDE.md` budget, file ownership,
    `00-STATUS.md`;
  - the shared resources of this machine, launching a session;
  - the day-to-day conventions: no commit for workers, `prompts/TOPICS.md`, report files, lines to
    `set`, stale names, committing by hunks, the build for the human, agents left behind;
  - how a new orchestrator starts.
- **What left it** went verbatim to a new history, `docs/history/plans/ROLE-ORCHESTRATOR.md` (35
  lines): "Why you verify", the general day-to-day bullets, and the `/clear`-based context reset.
  The history check does not mirror this file, so the history was written by hand from a diff.
- **`docs/session-control.md`:**
  - the title and first paragraph now include the skills (the old lines are in its history);
  - a new section "The skills plugin" was written from the final texts: what is in the plugin, how
    it reaches a session, the rules the shape test holds, what the skills lean on, and what Claude
    Code writes on its own;
  - "Rejected" gained the plan's five rejected ways.
- **Left to set at close:**
  - in `CLAUDE.md`, the `docs/session-control.md` row could name the skills plugin (I don't edit
    `CLAUDE.md`);
  - STATUS 1.71 should point to `docs/session-control.md`;
  - the rows 1.73 and 1.79–1.84 (set said it fixes these);
  - this plan's row leaving §3, then deleting the plan once this log is committed.
