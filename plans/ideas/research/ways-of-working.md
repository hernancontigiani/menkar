# Ways of working with teams of coding-agent sessions — research

Web research, 2026-11-12. Every claim carries a URL. **(inferred)** marks my own reading, not a
source's. Sources were read through a fetch tool that summarises pages; quotes are as returned.
Gas Town details come from its README and secondary summaries (Yegge's Medium posts were not opened).

## 1. What the tool makers and practitioners document

### Anthropic

- **Orchestrator-workers** is one of the base patterns: a central model splits work at runtime
  ("subtasks aren't pre-defined, but determined by the orchestrator"), hands pieces to workers and
  combines results; **evaluator-optimizer** is a drafter plus a reviewer looping on clear criteria.
  https://www.anthropic.com/research/building-effective-agents
- **Multi-agent research system**: a lead agent delegates to parallel subagents; each subagent
  needs "an objective, an output format", tools and boundaries, or work is duplicated or missed;
  effort-scaling rules go in the prompt; multi-agent "use about 15× more tokens than chats";
  token usage "explains 80% of the variance"; domains where agents must share context or have many
  dependencies — coding named explicitly — are a poor fit; the lead saves its plan to memory and can
  spawn fresh subagents with a handoff; subagents write output to the filesystem and pass
  references back, avoiding a relay "game of telephone"; a synchronous lead cannot steer mid-task.
  https://www.anthropic.com/engineering/multi-agent-research-system
- **Context engineering**: subagents explore with "tens of thousands of tokens" but return "a
  condensed, distilled summary (often 1,000-2,000 tokens)"; structured note-taking (NOTES.md,
  to-do lists) persisted outside the window; compaction keeps decisions and open bugs and drops
  tool output; just-in-time context via file paths rather than pasted content.
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **Long-running harness**: an *initializer* session writes `init.sh`, a progress file
  (`claude-progress.txt`) and a JSON feature list; every later *coding* session starts by reading
  git log and the progress file, picks one feature, and ends by committing and updating progress.
  Failure modes: one-shotting, declaring done early, marking done without real testing. The authors
  leave open whether specialised agents ("a testing agent, a quality assurance agent, or a code
  cleanup agent") beat one generalist.
  https://anthropic.com/engineering/effective-harnesses-for-long-running-agents
- **Claude Code best practices**: interview the human until a `SPEC.md` exists, then build in a
  *fresh* session; review by "someone who didn't write the code"; a reviewer prompt must say "skip
  style" because "a reviewer that's asked to find problems will always find *something*"; "Handing
  the same task to a subagent doesn't make the answer any better. A fresh reviewer does help";
  `/clear` between unrelated tasks, and after two failed corrections; team procedures go in skills
  (loaded on demand), not CLAUDE.md; a second session "is the easiest independent reviewer… with you
  carrying the messages". https://code.claude.com/docs/en/best-practices
- **Subagents** are role definitions as data: Markdown + frontmatter `name`, `description` ("when
  Claude should delegate"), `tools` allowlist, `model`, `skills` (preloaded in full), `memory`
  (`user`/`project`/`local` directory whose `MEMORY.md` first 200 lines load at start). A named
  subagent can be resumed by `SendMessage`. https://code.claude.com/docs/en/sub-agents
- **Agent teams** (experimental): a fixed *lead*, teammates in their own context, a **shared task
  list** (pending / in progress / completed, dependencies, file-locked self-claiming) and a
  **mailbox per agent**; any teammate may message any other by name; the human can talk to any
  teammate directly. A teammate's role comes from a subagent definition (its body becomes or extends
  the system prompt). Teammates read the team config's `members` array "to discover other team
  members" — a roster. Idle teammates notify the lead automatically ("The lead doesn't need to
  poll"). Advice: 3–5 teammates, 5–6 tasks each, each teammate owns different files, start with
  research and review, not parallel implementation. Limits: no nested teams, the lead cannot be
  transferred, permission prompts bubble to the lead.
  https://code.claude.com/docs/en/agent-teams
- **Cross-session messaging** between independent sessions: `ListAgents` + `SendMessage`, addressed
  by the session's name (`--name`, `/rename`); idle sessions are woken by an incoming message; a
  one-shot `notify_when_idle` subscription. A message "can't approve anything", can't change
  configuration, and commands in it are plain text. Loops are throttled. "A message is a piece of
  text one Claude writes to another, never the sender's conversation history."
  https://code.claude.com/docs/en/cross-session-messaging
- **Advisor**: a cheaper executor calls a stronger advisor model mid-task; the advisor sees the full
  context and advises, it does not act. https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool ,
  https://claude.com/blog/the-advisor-strategy

### OpenAI

- **Agents SDK** names two shapes: *agents as tools* (a manager keeps the conversation and calls
  specialists — use when one agent owns the answer and guardrails) and *handoffs* (a specialist
  becomes the active agent). It recommends specialised agents over one generalist and
  code-driven orchestration for determinism. https://openai.github.io/openai-agents-python/multi_agent/
- **Codex subagents**: built-in roles `default`, `worker` (implementation), `explorer` (read-heavy);
  custom roles are TOML with `name`, `description`, `developer_instructions`, model and effort;
  subagents inherit sandbox and approvals; parallel agents suit "exploration, tests, triage, and
  summarization", be careful with parallel writes; the main thread stays on "requirements and
  decisions". https://learn.chatgpt.com/docs/agent-configuration/subagents
- **AGENTS.md**: the open, tool-neutral project-instructions file, now under the Linux
  Foundation's Agentic AI Foundation. https://openai.com/index/agentic-ai-foundation/

### Google

- **ADK**: a coordinator `LlmAgent` with `sub_agents`; delegation by LLM transfer chosen from each
  agent's `description`, or by `AgentTool` (call and return). Transfer to parent or peers can be
  disabled. https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/ ,
  https://adk.dev/workflows/patterns/
- **A2A**: each agent publishes an *Agent Card* (JSON, well-known URL) listing its skills with id,
  name, description, tags, examples — a self-description others discover. Exact path differs by
  version in the sources. https://tyk.io/learning-center/a2a-protocol-architecture-and-technical-specification/ ,
  https://docs.cloud.google.com/agent-registry/a2a-protocol

### Cognition (Devin)

- **"Don't Build Multi-Agents"** (2025): "Share context, and share full agent traces, not just
  individual messages"; "Actions carry implicit decisions, and conflicting decisions carry bad
  results" (the Flappy Bird example: two subagents build mismatched halves).
  https://cognition.com/blog/dont-build-multi-agents
- **"Multi-Agents: What's Actually Working"** (April 2026): what works is single-threaded *writes*
  with other agents contributing intelligence — a clean-context reviewer loop, a "smart friend"
  (consultant model), and a manager splitting work map-reduce style; "unstructured agent networks"
  are "mostly a distraction". Still failing: children assume shared state with siblings, findings
  don't propagate back up, managers over-prescribe without codebase context.
  https://cognition.com/blog/multi-agents-working
- **Managed Devins**: a coordinator session scopes, launches children with prompts, playbooks and
  budgets, sends follow-ups, reads children's full trajectories, stops them.
  https://docs.devin.ai/work-with-devin/advanced-capabilities , https://cognition.com/blog/devin-can-now-manage-devins

### Cursor

- **Scaling long-running autonomous coding** (Jan 2026): flat peers with a shared lock file failed —
  "Twenty agents would slow down to the effective throughput of two or three", and agents became
  risk-averse. Moved to **planners** (may spawn sub-planners) → **workers** that "don't coordinate
  with other workers" → a **judge** at cycle end, with fresh starts against drift. An *integrator*
  role was removed: it "created more bottlenecks than it solved". "The prompts matter more"; a
  different model per role. https://cursor.com/blog/scaling-agents

### Practitioners

- **Simon Willison**: parallel agents for research, proofs of concept, small maintenance and
  carefully specified work; "the natural bottleneck on all of this is how fast I can review the
  results". https://simonwillison.net/2025/Oct/5/parallel-coding-agents/ ; "vibe engineering" =
  experienced engineers running several agents with tests, plans, docs and review discipline.
  https://simonwillison.net/2025/Oct/7/vibe-engineering/
- **Gas Town (Steve Yegge)**: *Mayor* (the coordinator you talk to), *Crew* (your hands-on
  workspace; per summaries named, persistent agents for design/review), *Polecats* ("persistent
  identity but ephemeral sessions"), *Witness* (per-repo monitor, unsticks agents), *Refinery*
  (merge queue), *Deacon* + *Dogs* (patrol/maintenance). Work items are *beads*; escalation runs
  Deacon → Mayor → human; `gt seance` lets a session read its predecessor's log.
  https://github.com/steveyegge/gastown . The Mayor as "Chief of Staff… manages the information flow
  so you can make decisions" (secondary): https://dark-factory-kb.pages.dev/steve-yegge-hierarchy.html .
  It later collapsed under a model's "just two more things" tic; Gas City rebuilt it as a toolkit
  with declarative topology. https://simonwillison.net/2026/aug/4/steve-yegge ,
  https://rywalker.com/research/gas-city
- **Amp's Oracle**: a read-only consultant subagent on a stronger reasoning model that "analyzes
  and advises but doesn't implement". https://ampcode.com/news/oracle , https://ampcode.com/docs/models-and-subagents
- **Kiro / spec-driven**: per feature `requirements.md` → `design.md` → `tasks.md` before code, plus
  *steering* files of durable conventions. https://kiro.dev/blog/from-chat-to-specs-deep-dive/

### Roles named across sources, and how a role is given

| Role | Where it appears |
|---|---|
| Orchestrator / lead / planner / Mayor / manager | all of the above |
| Implementer / worker / Polecat | Codex `worker`, Cursor, Gas Town, Devin children |
| Reviewer / judge / evaluator (clean context) | Anthropic evaluator-optimizer, best practices, Cognition, Cursor judge |
| Explorer / researcher (read-only) | Codex `explorer`, Anthropic research subagents, Willison |
| Consultant / advisor / oracle (advises, no writes) | Cognition "smart friend", Amp Oracle, Anthropic advisor |
| Monitor / unsticker (Witness), merger (Refinery), maintenance (Dogs) | Gas Town |
| Tester, QA, cleanup | named as future work by Anthropic's harness post |

Roles are given by: a definition file with a *description used for routing* plus a body used as
system prompt (Claude subagents, Codex TOML, ADK `description`); preloaded skills; persistent
per-role memory directory (Claude `memory`); the shared AGENTS.md/CLAUDE.md for everything common;
a spawn prompt for the task. The routing description is short; detail lives in the body
(Claude warns past 15,000 tokens of descriptions). https://code.claude.com/docs/en/sub-agents

## 2. Hierarchy, flat, peer-to-peer: evidence

- **MAST** ("Why Do Multi-Agent LLM Systems Fail?", NeurIPS 2025 D&B): 1,600+ traces, 7
  frameworks, failure rates 41%–86.7%, 14 modes in 3 groups — *system design* (disobey task spec
  11.8%, step repetition 15.7%, unaware of termination 12.4%, loss of history 2.8%),
  *inter-agent misalignment* (reasoning-action mismatch 13.2%, task derailment 7.4%, fail to ask
  for clarification 6.8%, withholding 0.85%), *verification* (incorrect 9.1%, none/incomplete 8.2%,
  premature termination 6.2%). Better role specs alone: +9.4%; a top-level objective verification
  step: +15.6%. "MAS failure is not merely a function of challenges in the underlying model."
  https://arxiv.org/abs/2503.13657
- **Towards a Science of Scaling Agent Systems** (Google/MIT, 180 configurations): independent
  agents amplify errors **17.2×**, centralised (hub) **4.4×** — the orchestrator acts as a
  "validation bottleneck"; centralised +80.8% on parallelisable tasks; decentralised better on web
  navigation; **every multi-agent variant degraded sequential reasoning by 39–70%**; returns
  diminish or turn negative once a single agent passes ~45% on the task; tool-heavy tasks pay most
  for coordination. https://arxiv.org/abs/2512.08296v2 ,
  https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/
- **Cursor**: flat self-coordination failed at scale; hierarchy with non-communicating workers
  worked; too much structure "creates fragility". https://cursor.com/blog/scaling-agents
- **Anthropic/Cognition agree** coding is less parallelisable than research, and parallel writers
  conflict through implicit decisions. Links above.

**When each works (inferred from the above):**
- *Single session* — sequential, tightly coupled work; most bug fixes.
- *Hub-and-spoke (flat, one orchestrator)* — independent tasks with clear deliverables; the hub
  validates. Cost: the hub's context fills with every report; it is a serial bottleneck.
- *Two-level hierarchy* — when one hub cannot hold every area: sub-leads per repo/area own their
  workers. Cost: each level is a lossy summary (Cognition: findings don't propagate up), and errors
  compound through relays.
- *Peer-to-peer* — debate, review, competing hypotheses (agent-teams' example), cross-area
  notices ("I changed the API you consume"). Not for dividing implementation: no one owns the whole.

## 3. Communication patterns

| Pattern | Sources | Notes |
|---|---|---|
| Hub-and-spoke reports to the orchestrator | Anthropic research, Devin, Codex | Results return condensed (1–2k tokens); full output to files |
| Direct peer messages by name | Claude agent teams, cross-session messaging | Messages are untrusted text, can't grant consent, rate-limited |
| Shared task list / board with claim, status, dependencies | Claude agent teams, Gas Town beads, Cursor planners | The task list, not chat, is the source of truth for who does what |
| Files as the medium (progress, spec, findings doc) | Anthropic harness and research, best practices (SPEC.md), agent-teams "findings doc" | Avoids the "game of telephone" |
| Handoff (active agent changes) | OpenAI SDK, ADK transfer | Fits a human-facing triage; less relevant to parallel sessions (inferred) |
| Escalation chain | Gas Town `gt escalate` (Deacon → Mayor → human) | Severity decides how far it climbs |

**How agents learn each other's profiles**: a roster with names and types (Claude team config
`members`, `ListAgents`), descriptions written for routing (subagents, ADK), self-published cards
with skills (A2A Agent Card). Links above.

**Human entering and leaving**: Claude agent teams let the human select any teammate and message
it directly; Gas Town has the human attach to the Mayor or work in a Crew workspace. No source
found prescribes how a session briefs the orchestrator after a side conversation. The closest
primitives: cross-session messages carry a *summary written by the sender* ("Explain what we just
did to the session working on the payments API"), not history; Gas Town's `seance` reads a
predecessor's event log; Anthropic's harness has each session end by writing the progress file.
https://code.claude.com/docs/en/cross-session-messaging , https://github.com/steveyegge/gastown

## 4. Long-lived specialists vs fresh sessions

- Fresh context is recommended for **builders after a spec** and for **reviewers** (best practices;
  Cognition's reviewer "sees only the diff"; Cursor resets each cycle against drift).
- Persistent identity with ephemeral sessions is Gas Town's answer (Polecats); per-role memory
  directories are Claude's (`memory:` scope, `MEMORY.md` capped at 200 lines and curated).
- Knowledge that must survive belongs in **skills** (procedures, loaded on demand), **CLAUDE.md /
  AGENTS.md / steering** (always-true rules), **progress / notes files** (state), and
  **git history** — not in a long conversation. Links in §1.
- Hygiene: `/clear` between unrelated tasks and after two failed corrections; a fresh session
  costs less than a resumed long one after the cache expires. https://code.claude.com/docs/en/best-practices
- **(inferred)** A long-lived specialist is worth it when its area recurs and the knowledge it
  accumulates can be *distilled to its memory/skill* at the end of each task; then renewing the
  session is cheap and safe. A specialist whose value lives only in its context is a liability.

## 5. Human in the loop

- The agent should **keep working while a question is pending**, separate non-blocking
  notifications from blocking approvals, and apply defaults or timeouts for non-critical
  questions. https://myengineeringpath.dev/genai-engineer/human-in-the-loop/ ,
  https://besthub.dev/articles/how-to-build-production-ready-agent-hitl-state-machines-event-sourcing-and-distributed-coordination-b7d1d10338ce
- Route by **irreversibility, blast radius, compliance and confidence**.
  https://myengineeringpath.dev/genai-engineer/human-in-the-loop/
- Ask the human "only where judgment or authority is required". https://arxiv.org/pdf/2606.03115
- Batch: one framework groups tool calls from one response into a single human request.
  https://dzone.com/articles/agent-frameworks-human-loop
- Claude agent teams push idle notifications to the lead; cross-session `notify_when_idle` replaces
  polling; permission prompts of teammates bubble to the lead. Links in §1.
- The review queue is the binding constraint: "the queue lengthens and each approval gets
  shorter". https://hackernoon.com/human-in-the-loop-ai-needs-better-review-gates ; Willison, above.
- Ask with **multiple-choice questions** until a spec exists (best practices "interview me").

## 6. Templates worth copying

**Role definition** (Claude subagent / Codex agent shape):
```
name: ci-specialist
description: Owns CI pipelines of repos A and B. Ask before changing any workflow file.   # routing, one line
tools: [Read, Grep, Bash]          # an allowlist; a consultant gets no Edit/Write
model: sonnet
skills: [ci-runbook]
memory: project                     # .../agent-memory/ci-specialist/MEMORY.md, ≤200 lines
---
You own ... You never ... When done, write the report to ... and message the orchestrator one line.
```
https://code.claude.com/docs/en/sub-agents , https://learn.chatgpt.com/docs/agent-configuration/subagents

**Delegation brief** (Anthropic research system): objective, output format, tools/sources,
boundaries (what not to touch), effort budget. https://www.anthropic.com/engineering/multi-agent-research-system

**Session-start routine** (Anthropic harness): confirm directory → read git log and progress file →
pick the top unfinished item → run the smoke check → work → commit → update progress.
https://anthropic.com/engineering/effective-harnesses-for-long-running-agents

**Report**: condensed result (1–2k tokens) in the message, full detail in a file referenced by
path. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

**Reviewer prompt**: compare against the spec, report gaps that affect correctness, "skip style".
https://code.claude.com/docs/en/best-practices

**Task list item** (agent teams): id, title, owner, state (pending/in progress/completed),
blocked-by. https://code.claude.com/docs/en/agent-teams

## 7. For Menkar

Everything in this section is **(inferred)** from the sources above, applied to Menkar's two shapes.

### The model: one roster, roles as data, edges as policy

1. **A role is data attached to a session**, not a different kind of session: `role` (one of a
   small fixed set), `area` (free text: "docs", "CI of repo X"), `writes` (yes/no), `reportsTo`
   (a session name). The role's *instructions* live where the agent already reads them — a skill
   or an agent definition in the repository, one per role — and Menkar only records which one a
   session uses. This mirrors subagent/Codex definitions and keeps Menkar from owning prompts.
2. **Fixed role set** (enough for both shapes; the evidence supports each one):
   - `orchestrator` — talks to the human, plans, hands out work, is the only one who asks the human.
   - `lead` — an orchestrator for one area under another orchestrator (the second level).
   - `worker` — writes; generalist or specialist depending on `area`.
   - `consultant` — advises, never writes (Oracle, smart friend, advisor). `writes: no`.
   - `reviewer` — fresh-context review against a spec; also `writes: no`.
   Documentation, CI, troubleshooting are **areas** of a worker or consultant, not new roles; that
   keeps the set closed while the client's specialists still exist.
3. **The roster is a file Menkar writes and every session can read** (like the team config's
   `members`): name, role, area, writes, reportsTo, state (working / idle / blocked at a prompt /
   stopped), and where its reports go. Generated from Menkar's data, never hand-edited, so it
   cannot drift. Sessions use it to know whom to ask; the human reads the same thing in the UI.
4. **Who may talk to whom** — a default policy, not a mesh:
   - Work assignment flows only down `reportsTo` edges; results flow back up as *one-line message
     + file path*.
   - Any session may send a **notice** to a peer in the same project (an interface changed, a
     question settled) — the Claude cross-session use case — but a notice never assigns work.
   - Any session may **consult** a consultant directly; the answer goes to the asker.
   - Only the top orchestrator raises topics to the human; others escalate up their edge.
   This keeps writes single-threaded per area (Cognition), keeps the hub as validator (4.4× vs
   17.2×), and allows the useful peer traffic (notices, consultation, debate) without a free mesh.
5. **The small Menkar shape** is this model with one orchestrator (also the expert, no consultant),
   two generalist workers with `reportsTo: set`, reports to `plans/`/files, and the topics list. No
   second level, no peer assignment. Nothing extra to configure.
6. **The large shape** adds `lead` sessions per repo with their own workers, consultants per
   domain, area-specialist workers that are renewed rather than replaced (identity persists,
   session is fresh — Polecats; knowledge distilled to the role's skill/memory before renewal).

### Human questions

7. **One topics queue per orchestration**, owned by the top orchestrator, each item with
   *blocking / not blocking*, the options and one recommendation (already the repository's rule),
   and who is waiting. Sessions below never ask the human; they ask up. Menkar shows the count and
   notifies on a *blocking* item only; non-blocking items wait for the human to open the list.
   Permission prompts stay what they are — a session blocked at a prompt wakes its orchestrator,
   which can tell the human, but never answers it (Claude: a message "can't approve anything").

### Entering and leaving orchestration

8. **Leaving**: the human opens any session and talks to it directly (agent teams allow exactly
   this). Menkar marks that session *with the human* in the roster so the orchestrator does not
   hand it work meanwhile.
9. **Returning**: when the human goes back to the orchestrator, the side session owes it a
   **debrief** — a short message written by that session (decisions taken, files changed, open
   questions) with a path to a fuller note, the same "summary not history" rule as cross-session
   messaging. Menkar can prompt for it (offer a "debrief the orchestrator" action) but must not type
   into the agent's terminal on the human's behalf; the session writes it when the human asks.
   No source prescribes this; it is the gap Menkar would fill.

### Trade-offs

- Every added level is a lossy summary and a serial bottleneck; two levels is the ceiling the
  evidence tolerates (Cognition, Cursor's integrator removal, MAST's misalignment class).
- Parallel *writers* need separate files or worktrees; parallel *readers* (consultants, reviewers,
  researchers) are where multi-session pays off at all (Codex, agent teams, Willison).
- Tokens scale with active sessions (15× in Anthropic's research system); idle long-lived
  specialists cost cache, not tokens, until woken.
- The human's review rate, not the number of sessions, is the throughput limit (Willison).

### Leave out

- A free peer mesh, voting or consensus protocols, and sessions assigning work to peers.
- An integrator/merger session (Cursor removed it) until conflicts actually hurt.
- Self-claiming from a shared board — Menkar's orchestrator assigns; a board can come later as a
  view of assignments, not as a protocol.
- Menkar-authored role prompts; roles point at skills/definitions the user's repository owns.
- Automatic monitoring/unsticking agents (Witness, Deacon): Menkar already sees agent state from
  the terminal and can wake the orchestrator itself.
- More than two levels, and nested orchestrators spawned by agents on their own (Claude's agent
  teams also forbid nested teams).
