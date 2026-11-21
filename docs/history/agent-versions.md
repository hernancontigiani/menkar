# History of `docs/agent-versions.md`

> Replaced 2026-11-17: the probes' place was decided (`set`, task 73), `scripts/agent-probes/<agent>/`. It was:
2. **Runs the checks in a throwaway home**: a `HOME` (and the agent's config directory) under the
   session's scratchpad, a stand-in API on 127.0.0.1, a fresh environment with none of the parent
**Where the checks live — open.** Today the harness is rebuilt each time in a scratchpad, and
scratchpads are wiped. The proposal, pending `set`'s go-ahead: keep each agent's harness in the
repository, `scripts/agent-probes/<agent>/` (for Claude Code: the stand-in API, the pty driver, and
the screen replay that runs main's `detectState` over captured bytes), run by hand and outside
`npm run ci`.

> Replaced 2026-11-18: Claude Code validated at 2.1.327 (task 80). It was:
## Claude Code — validated at 2.1.326 (2026-11-17), owner: `claude-cli`
| `--add-dir` stops every start at a trust dialog whose default is "No, exit"; the files folder goes as `permissions.additionalDirectories` in `--settings` instead | measured 2.1.326 | `docs/project-files.md` |
| The team block by `--append-system-prompt-file`: in the first request's system prompt, read once at start, kept on `--resume` until a compaction unless `--system-prompt-snapshot off`; a missing file exits at once | measured 2.1.325 | `docs/session-control.md` |
| The state screens: the permission card ("Do you want to proceed?"), auto mode's consecutive-block card with its 2-minute countdown (after which Claude Code blocks the call itself and the turn ends), the footer's background pills | measured 2.1.326 (cards); pills read 2.1.323 | `docs/agent-state.md` |
| Waking: a post to the registry's messaging socket wakes an idle session, leaves a permission card untouched, is held in bypass mode without `crossSessionInbound: "accept"`; identical repeats are dropped | measured 2.1.322 (2.1.325 for the transcript record) | `docs/session-control.md` |

> Replaced 2026-11-18: what the user sees was built (task 94). It was:
What Menkar tells the user about their installed version (1.179, part 2) is not built yet.

> Replaced 2026-11-19: Claude Code validated at 2.1.328 (task 121). It was:
## Claude Code — validated at 2.1.327 (2026-11-18), owner: `claude-cli`
| `--add-dir` stops every start at a trust dialog whose default is "No, exit"; the files folder goes as `permissions.additionalDirectories` in `--settings` instead | measured 2.1.327 (probes: `add-dir.mjs`) | `docs/project-files.md` |
| The team block by `--append-system-prompt-file`: in the first request's system prompt, read once at start, kept on `--resume` until a compaction unless `--system-prompt-snapshot off`; a missing file exits at once | first request and missing file measured 2.1.327 (`team-block.mjs`); resume and snapshot measured 2.1.325 | `docs/session-control.md` |
| The state screens: the permission card ("Do you want to proceed?"), auto mode's consecutive-block card with its 2-minute countdown (after which Claude Code blocks the call itself and the turn ends), the footer's background pills | cards measured 2.1.327 (`permission.mjs`), the countdown's expiry 2.1.326; pills read 2.1.323 | `docs/agent-state.md` |
| Waking: a post to the registry's messaging socket wakes an idle session, leaves a permission card untouched, is held in bypass mode without `crossSessionInbound: "accept"`; identical repeats are dropped | idle wake and transcript record measured 2.1.327 (`wake.mjs`); the card and bypass cases 2.1.322 | `docs/session-control.md` |

> Replaced 2026-11-19: no banner for a patch newer than validated (decision 1.187, task 122). It was:
**What the user sees** (1.179, part 2): Settings › About lists each agent's installed and
validated version; a banner under the header says when the installed one is below Menkar's floor
(red), or newer than validated by a patch (blue) or by a minor or major version (amber), until Hide
for that version. A row's version here is the descriptor's `versions.validated`

> Replaced 2026-11-20: Claude Code validated at 2.1.329 (task 130). It was:
## Claude Code — validated at 2.1.328 (2026-11-19), owner: `claude-cli`
| `--add-dir` stops every start at a trust dialog whose default is "No, exit"; the files folder goes as `permissions.additionalDirectories` in `--settings` instead | measured 2.1.328 (probes: `add-dir.mjs`) | `docs/project-files.md` |
| The team block by `--append-system-prompt-file`: in the first request's system prompt, read once at start, kept on `--resume` until a compaction unless `--system-prompt-snapshot off`; a missing file exits at once | first request and missing file measured 2.1.328 (`team-block.mjs`); resume and snapshot measured 2.1.325 | `docs/session-control.md` |
| The state screens: the permission card ("Do you want to proceed?"), auto mode's consecutive-block card with its 2-minute countdown (after which Claude Code blocks the call itself and the turn ends), the footer's background pills | cards measured 2.1.328 (`permission.mjs`), the countdown's expiry 2.1.326; pills read 2.1.323 | `docs/agent-state.md` |
| Waking: a post to the registry's messaging socket wakes an idle session, leaves a permission card untouched, is held in bypass mode without `crossSessionInbound: "accept"`; identical repeats are dropped | idle wake and transcript record measured 2.1.328 (`wake.mjs`); the card and bypass cases 2.1.322 | `docs/session-control.md` |
| The orchestrator's prompt hook: a `UserPromptSubmit` hook in `--settings` whose `additionalContext` reaches the model on the next prompt of any kind (typed, from the command line, a wake, a peer's message) and is recorded as a `hook_additional_context` attachment, nothing on screen; built-in commands (`/clear`, `/compact`, `/model`, `/rename`) do not run it; whole up to 10,000 characters; run under `/bin/sh -c` | Menkar's real hook measured 2.1.328 (by hand, not yet in `all.mjs`); the cases and the size 2.1.327 | `docs/context.md` |

> Replaced 2026-11-21: Claude Code validated at 2.1.330 (task 173). It was:
## Claude Code — validated at 2.1.329 (2026-11-20), owner: `claude-cli`
| `--add-dir` stops every start at a trust dialog whose default is "No, exit"; the files folder goes as `permissions.additionalDirectories` in `--settings` instead | measured 2.1.329 (probes: `add-dir.mjs`) | `docs/project-files.md` |
| The team block by `--append-system-prompt-file`: in the first request's system prompt, read once at start, kept on `--resume` until a compaction unless `--system-prompt-snapshot off`; a missing file exits at once | first request and missing file measured 2.1.329 (`team-block.mjs`); resume and snapshot measured 2.1.325 | `docs/session-control.md` |
| The state screens: the permission card ("Do you want to proceed?"), auto mode's consecutive-block card with its 2-minute countdown (after which Claude Code blocks the call itself and the turn ends), the footer's background pills | cards measured 2.1.329 (`permission.mjs`), the countdown's expiry 2.1.326; the shell's and monitor's "N … still running" measured 2.1.329 (by hand), a scheduled task shows none; pills read 2.1.323 | `docs/agent-state.md` |
| Waking: a post to the registry's messaging socket wakes an idle session, leaves a permission card untouched, is held in bypass mode without `crossSessionInbound: "accept"`; identical repeats are dropped | idle wake and transcript record measured 2.1.329 (`wake.mjs`); the card and bypass cases 2.1.322 | `docs/session-control.md` |
| The orchestrator's prompt hook: a `UserPromptSubmit` hook in `--settings` whose `additionalContext` reaches the model on the next prompt of any kind (typed, from the command line, a wake, a peer's message) and is recorded as a `hook_additional_context` attachment, nothing on screen; built-in commands (`/clear`, `/compact`, `/model`, `/rename`) do not run it; whole up to 10,000 characters; run under `/bin/sh -c` | Menkar's real hook measured 2.1.329 (`prompt-hook.mjs`); the cases and the size 2.1.327 | `docs/context.md` |
