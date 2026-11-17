# History of `docs/agent-versions.md`

> Replaced 2026-11-17: the probes' place was decided (`set`, task 73), `scripts/agent-probes/<agent>/`. It was:
2. **Runs the checks in a throwaway home**: a `HOME` (and the agent's config directory) under the
   session's scratchpad, a stand-in API on 127.0.0.1, a fresh environment with none of the parent
**Where the checks live — open.** Today the harness is rebuilt each time in a scratchpad, and
scratchpads are wiped. The proposal, pending `set`'s go-ahead: keep each agent's harness in the
repository, `scripts/agent-probes/<agent>/` (for Claude Code: the stand-in API, the pty driver, and
the screen replay that runs main's `detectState` over captured bytes), run by hand and outside
`npm run ci`.
