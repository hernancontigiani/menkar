---
title: Reach a session from your phone
description: Turn on Claude Code's Remote Control for a session, to follow and answer it from the Claude app or claude.ai.
sidebar:
  order: 6
---

Remote Control is Claude Code's own: it connects a running session to the Claude app on your phone
and to claude.ai, under the session's name. Menkar turns it on per session, and it is off until you
do. Cursor sessions do not have it.

## Turn on Remote Control

- For a new session, turn on :ui[rc.switch] before you click :ui[newSession.start].
- For a session you already have, choose :ui[rc.item] in its menu in the sidebar, or in the menu
  of a tab that holds only that session. A tick marks it on.
- If the session is running, Menkar asks first. Choose :ui[rc.restartNow] to connect it at once:
  the session starts again in its tab with its conversation, and a message typed and not sent is
  lost. Choose :ui[rc.later] to connect it the next time it starts, or type `/remote-control` in
  the session. While the session is working or waiting for you, only :ui[rc.later] is offered.

Menkar starts that session with Remote Control from then on, until you choose :ui[rc.item] again
to take the tick off.

## See which sessions are connected

A phone icon on a session's row says its Remote Control is connected now, whichever way it was
turned on.
