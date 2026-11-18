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
