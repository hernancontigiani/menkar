---
title: Use Claude Code or Cursor
description: What Menkar does with a Claude Code session and with a Cursor session.
sidebar:
  order: 3
---

Menkar runs the agent's own command in a terminal, `claude` for Claude Code and `cursor-agent` for
Cursor, so a session behaves in Menkar as it does in any terminal, with your login, settings and
tools. Pick the agent when you [start a new session](/menkar/start/first-sessions/#start-a-new-session);
the sessions both agents already have are listed side by side.

## Choose an agent for a session

| In Menkar | Claude Code | Cursor |
|---|---|---|
| Run, resume and close a session in a tab | Yes | Yes |
| The session's state (:ui[state.working], :ui[state.blocked], :ui[state.idle]) and notifications | Yes | Yes |
| Context ring by each session | Yes | No |
| Time, tokens and cost in :ui[header.usage] | Yes | No |
| [The orchestration mode](/menkar/orchestration/) | Yes | No |
| [Remote Control](/menkar/sessions/remote-control/) | Yes | No |
| Fork a session | Yes | No |
| [Continue as a chat](/menkar/sessions/chat/) | Asks before every edit and command | Read only, or runs edits and commands without asking |

## Keep the agent up to date

Menkar is tested with one version of each agent. Open :ui[header.settings] and choose
:ui[settings.section.about]: under :ui[about.agents] each agent shows the version installed and the
one this release was tested with.

A banner under the header warns you when an installed agent is older than Menkar needs, or much
newer than the version it was tested with. Claude Code 2.1.267 or later is needed.
