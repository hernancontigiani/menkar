# Ideas — seeing the Board away from the PC

> **Status: an idea, not a plan** (the human, 2026-11-15). Wished before the first release, not
> mandatory (1.156); it needs thinking. When designed, decisions go to `plans/00-STATUS.md` §1 and
> this file is deleted.

## The need

The human often works with the orchestrator from their phone through Claude Code's Remote
Control, which carries the conversation with every Claude Code feature, but shows nothing of the
Board: what is queued, in progress, waiting, to review. 1.125's counts at the end of Menkar's posts
are the only glimpse today.

## Options the human named

- **A. Keep Remote Control for talking, and add a way to see only the Board:**
  - A1. A web page of the Board served by Menkar, reached from the phone: through a public
    server, or a tunnel (e.g. a free Cloudflare tunnel, no domain needed).
  - A2. The orchestrator shows the Board in the Remote Control session when asked: an HTML file or
    an artifact generated on demand (costs tokens each time).
- **B. A web app with the Board and a chat with the orchestrator** — rejected by the human as
  reinventing what Remote Control already does well.

## What any option must face

- **"Nothing leaves the machine"** (`AGENTS.md`): Menkar makes no network connections of its own.
  A1 (a server or a tunnel serving the Board) reopens that rule: a decision for the human, with
  what is exposed, to whom, and how it is authenticated.
- A2 stays inside the rule (the agent, not Menkar, reaches claude.ai), but is paid in tokens per
  look. A cheaper A2: the orchestrator relays `task_list`/`topic_list` as plain text — a few hundred
  tokens, no rendering.
- Whatever shows the Board must not depend on the PC's screen: Menkar running is enough.

**Trigger:** before the first release (1.156), or when the human asks to think it through. First
question: is A2's plain-text relay enough, or is a picture of the Board needed — and if so, is
reopening "nothing leaves the machine" acceptable for it.
