# History of `docs/session-control.md`

## Session control: Menkar's MCP server, renewing, starting, waking

> Left on 2026-11-12: the skills ship with Menkar as a plugin, described in this document (plan 33).
# Session control: Menkar's MCP server, renewing, starting, waking
ends a turn. The skills that use these tools are not part of this subsystem.

## The shape

> Left on 2026-11-12: groups lose their leader; a group is only visual (decision 1.76).
     project place, group, leader mark, hidden flag, parents, Remote Control, and the old id as an

> Left on 2026-11-12: last_reply falls back to the previous conversation after a renew (decision 1.84).
    the whole file) and cut to its first `REPLY_MAX_CHARS` with a note.

## Session control: Menkar's MCP server, renewing, starting, waking, and its skills

> Left on 2026-11-12: the orchestration mode adds four topic tools and shapes list_sessions, start_session and the wake order (plan 34).
(decisions 1.71 and 1.79–1.84, 2026-11-12; "The skills plugin" below).

## The shape

> Left on 2026-11-12: the orchestration mode adds four topic tools and shapes list_sessions, start_session and the wake order (plan 34).
    - `tools/list` names four tools; `tools/call` runs one.
- **The four tools.** A session is always named by its name, never by its id: a renew or a `/clear`
  gives it a new id, and an id an agent kept would name nothing.
    conversations are left out.

## The skills plugin

> Left on 2026-11-12: the orchestration mode adds four topic tools and shapes list_sessions, start_session and the wake order (plan 34).
  repository's `plugin/` in development. `package:check` requires the manifest and the four
  `SKILL.md` files in the .deb.

## Rejected

> Left on 2026-11-12: the orchestration mode adds four topic tools and shapes list_sessions, start_session and the wake order (plan 34).
  four tools.

## Session control: Menkar's MCP server, renewing, starting, waking, and its skills

> Left on 2026-11-12: plan 35 adds adopt_session (decision 1.102).
(`docs/orchestration.md`) adds four tools for topics and shapes `list_sessions`, `start_session`
and the wake order.

## The shape

> Left on 2026-11-12: adopt_session is the ninth tool (decision 1.102).
    - `tools/list` names eight tools; `tools/call` runs one.

## The shape

> Left on 2026-11-12: adopt_session is the ninth tool (decision 1.102).
- **The eight tools.** A session is always named by its name, never by its id: a renew or a

> Left on 2026-11-12: start_session takes an optional model (decision 1.106).
  - **`start_session { name, prompt? | prompt_file?, remote_control?, group? }`:** a new Claude
    session in the caller's project, in a tab right after the caller's, not selected. The caller
    becomes its parent.

> Left on 2026-11-13: Menkar keeps a session's model and passes it again on a renew (decision 1.108).
      not starting with `-` is refused (`readModel`, `src/core/control/model.ts`). Only the start
      carries it; a later resume runs with Claude Code's own record of the session.
  4. The new session starts in that tab.
     project place, group, hidden flag, parents, Remote Control, and the old id as an
     earlier conversation.
