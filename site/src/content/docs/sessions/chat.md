---
title: Continue a session as a chat
description: Pick up an earlier session in a chat tab that asks before it edits or runs anything, or in Ghostty.
sidebar:
  order: 5
---

## Continue a session in a chat tab

1. Open :ui[sidebar.addSession] and stay on :ui[add.existing].
2. Right-click the session and choose :ui[chat.continueSole]. A Cursor session offers two chats:
   :ui[chat.modeAskReadOnly] and :ui[chat.modeTrustedAutoRun].
3. Type in the box at the bottom and press `Enter`.

The chat continues the session's conversation; its earlier messages are not shown in the tab.

## Answer what the session asks

A Claude Code chat stops before every file edit and every command and shows a card.

![](shot:chat-permission)

- :ui[chat.allowOnce] lets this one through.
- Always allow lets every use of that tool through, until you close the tab.
- :ui[chat.deny] refuses, and the session is told so.

A read-only Cursor chat analyses and answers, and never edits. A trusted one runs edits and
commands without asking: use it only in a folder you can restore.

## Open a session in Ghostty

When [Ghostty](https://ghostty.org) is installed, the same menu has :ui[row.ghostty], which resumes
the session in a Ghostty window.

## See the MCP servers Claude Code uses

:ui[header.settings] › :ui[settings.section.mcp] lists the MCP servers Claude Code is configured
with. It only reads them; change them in Claude Code.
