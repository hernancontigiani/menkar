# Fable 5.2 review of plan 39 (task 29, `menkar-t29`, 2026-11-15, on commit 48a3efa)

> Kept so the findings survive the reviewer's session; to be folded into
> `plans/39-multi-agent-architecture.md` by its next editor, then this file deleted.
> Verdict: the pattern is sound and the tree claims hold (the 60 name checks match), but four
> blocking points must be settled before P0.

## Blocking

- **B1 — the sandbox reaches the human's daily sessions through the agents' shared data** (§2.12,
  Q3). It scans the same `~/.claude/projects` and `~/.cursor/projects`, so it could resume a session
  live in a daily tab, trash/delete its transcript (`workspace.ts:3077–3083`), and start workers whose
  `<project>-t<N>` names collide with daily ones in Claude's registry (a `SendMessage` by name could
  land in a daily session). Fix: list it under "still shared"; **human decision** — recommended: the
  sandbox refuses resume, add, trash and delete for a session it did not start (one test), and sandbox
  projects take names no daily project has (hand check).
- **B2 — §2.3 lacks concerns the blocks need**, so executors would write disguised name checks: Fork
  (a nullable Launcher member), Remote (Claude's registry reader `remote-live.ts:67,72,95` moved to
  `src/main/agents/claude/`), Messaging (`native: { tool, reaches(other) } | null`, so D3's table is
  computed from kits). Add a rule: `DEFAULT_AGENT`/`CLASSIFIER_AGENT` never operands of `===`/`!==`/
  `switch` outside `ids.ts` and the registries.
- **B3 — Q4's tolerance never runs**: `dropUnknownSessions` (`workspace.ts:743–755`, called at
  `:2275` before `startShownTabs`) drops the unknown pane first; P0.6's e2e cannot pass. Fix: P0.6
  owns it; an id with a `session_agents` entry is kept. **Human decision** — a known agent whose
  session is not found (CLI uninstalled, rollout gone): recommended keep the tab with one line, as Q4.
- **B4 — P0's proof has holes at the merge gate**: test integrity's baseline is the current branch
  (`check-test-integrity.mjs:19`) — default it to `git merge-base main HEAD`; the R10 snapshots are the
  tree's first and Vitest may write a missing one outside CI — add a CI step comparing
  `tests/core/r10/**` byte for byte with `main:` (except P3.2's Cursor files), failing on a missing
  file; run P0.1 on `main` before the branch is created.

## Should fix (condensed)

- **S1** the source rule: count per `ALLOWED` key that may only go down; name permanent false
  positives (xterm theme key `cursor:` in `renderer/terminals.ts:66,88`; SQL column in
  `usage/cache.ts:417`, `history.ts:290`); identifiers like `claudeArgs`, `claudeEvents`, `cursorTurn`
  (`chat/processes.ts:98–143`), `agentPaths().claude*`, `src/core/context/*`,
  `usage/{cache,transcript,files}.ts`, `control/post.ts` — move or list in `docs/agents.md`; add an
  `agent-identifier` rule.
- **S2** declare each interface in the phase that first implements it (no abstraction without a
  consumer); `TeamDelivery.holds`, Namer's `kind`, descriptor "ids late"/"needs Menkar's server" are
  discriminants — make them methods; parity test descriptor caps ⇔ kit nullness.
- **S3** `descriptorOf`/`DESCRIPTORS` in a Node-free `descriptors.ts`, held by a rule (the renderer
  and MCP server must not import kits).
- **S4** IdBinding: split id choice from following (Claude's kind comes from `followPaneStart`'s
  `source`, `workspace.ts:1850`); drop Codex's title-thread notify in the notify program; keep the
  turn record's keys (one `<pane>.json` overwritten each turn, `control.ts:63–82`).
- **S5** a provisional Codex id lasts the whole first turn (a crash mid-task loses the worker's tab,
  parent, assignee): ask `codex` whether the thread id is knowable at start; else state the loss.
- **S6** readers: Cursor's rewritten-transcript reader has no block (P0.4 would change behaviour);
  zstd: stream the head, async, not whole in main; `openAgentDb` third state (leftover `-wal`, no
  `-shm`); R9 asserts the sidecars' listing; **human decision** — Cursor's prompt text kept in
  Menkar's hook log is a new copy of prompts at rest (keep only while the classifier is on?).
- **S7** team block per agent: name Codex's compaction signal (rollout `compacted` item,
  `codex.md:278`); `plugin/team/cursor.md` and `check-package.mjs` for the three parts in a block;
  **human decision** — a facts change for an idle Cursor session (a restart) held until the next wake?
- **S8** D3's trigger: "another installed agent whose kit has a Waker", so a Claude + Cursor user
  sees no `send_message` before P3.4; snapshot `tools/list` for {claude} and {claude, cursor}.
- **S9** R10 must also cover `startPaneHeld`'s assembly (`workspace.ts:813–830`) via the stand-ins'
  recorded argv/env (`e2e/fixtures.ts:27`), for new/resume/fork/remote, Claude and Cursor; consider
  landing P0.2 (the rule) on `main` right after P0.1.
- **S10** §2.11 vs P0.4: keep the facade types or `Partial` so `discover.test.ts:25,36,60` and
  `service.test.ts:42–46` stay untouched.
- **S11** sandbox: flavour defaults from the branch, never to `menkar`; both flavours set/remove
  `MENKAR_FLAVOR` on the pty; classifier off in the sandbox (hand check); removing the sandbox leaves
  Cursor hook entries naming a deleted program.
- **S12** OpenCode's server config: say what `OPENCODE_CONFIG_CONTENT` holds; test a mode-off
  session's request unchanged (1.141); feature-check the experimental MCP route.

## Minor

P1a.2 needs `ui-check` and a screenshot (glyphs are a UI decision); P2.2's e2e ordering and
`e2e/r10.spec.ts` ownership; P2.4 creates `src/main/agents/opencode/index.ts`; P1b.1 lacks a
fallback if Claude does not re-list; P0.0's container install vs `docs/packaging.md` (who does it);
§2.12 cites a packaging rule not in that file; the branch cap of two is moot; P3.4's `stop` hook
must never wait; route `-c developer_instructions`/`--chain` through `LaunchPlan.files`;
`session_agents` for a late id written at bind.

## Good, do not change

Per-concern strategies with `null`; `Record<AgentId, …>` registries; the rejected alternatives;
facades keeping every test untouched; contract tests over one scripted conversation per agent; Usage
(a cache file per agent, prefixed uuids, no schema change, exact cost via the statusline format); the
sandbox as a build flavour with its own package; never chaining to a Menkar statusline; the measured
SQLite behaviour; `opencode serve --stdio`; the `/openapi.json` feature check; R10's Cursor rows as
separate files; fixes flowing in by merge.
