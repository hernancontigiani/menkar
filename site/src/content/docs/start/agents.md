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
| Time, tokens and cost in :ui[header.usage] | Yes | Time and tokens, with :ui[integrations.cursorHooks] on |
| [The orchestration mode](/menkar/orchestration/) | Yes | Yes, as a worker, see [Use Cursor in the orchestration mode](#use-cursor-in-the-orchestration-mode) |
| [Remote Control](/menkar/sessions/remote-control/) | Yes | No |
| Fork a session | Yes | No |
| [Continue as a chat](/menkar/sessions/chat/) | Asks before every edit and command | Read only, or runs edits and commands without asking |

## Use Cursor in the orchestration mode

Cursor can't be the orchestrator: mark a Claude Code session as the orchestrator, and give Cursor
sessions their tasks as workers.

Open :ui[header.settings], choose Cursor, and turn on :ui[integrations.cursorHooks] and
:ui[integrations.cursorAllow]. Without the second, Cursor asks you before each of Menkar's tools
runs. Without the first, a message for a Cursor session waits until it is idle with nothing typed
in its box, and Menkar then restarts it with the message; with it, the message arrives as soon as
the running turn ends. Turn both off before you uninstall Menkar.

## Keep the agent up to date

Menkar is tested with one version of each agent. Open :ui[header.settings] and choose
:ui[settings.section.about]: under :ui[about.agents] each agent shows the version installed and the
one this release was tested with.

A banner under the header warns you when an installed agent is older than Menkar needs, or much
newer than the version it was tested with. Claude Code 2.1.267 or later is needed.
