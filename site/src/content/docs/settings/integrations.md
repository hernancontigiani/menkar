---
title: Turn on the status line and longer transcripts
description: Add Menkar's status line to every Claude Code session, and keep Claude Code's transcripts for years instead of a month.
sidebar:
  order: 2
---

The sessions Menkar starts get what they need from Menkar without any change to your Claude Code
settings. Two additions reach further, and each is off until you turn it on. Menkar adds each one
to `~/.claude/settings.json` on its own, keeps a copy of the file before every change, and leaves
the rest of the file as you had it. Turning one off takes it out again.

## Show the status line in every Claude Code session

Open :ui[header.settings] › :ui[settings.section.statusline] and turn on
:ui[integrations.statusline].

![](shot:settings-integrations)

Claude Code sessions you run outside Menkar then report their context and usage too. Your own
status line, if you have one, keeps showing. If you change the status line in that file yourself
afterwards, Menkar leaves your change in place when you turn it off.

## Keep transcripts for years

Claude Code deletes a session's transcript 30 days after its last change unless its settings say
otherwise. After that the session can no longer be resumed, read or exported.

Open :ui[header.settings] › :ui[settings.section.retention]. The section says how long Claude Code
keeps transcripts now; turn on :ui[integrations.retention] to keep them for 10 years. A longer time
you set yourself is kept. Turning it off puts back what was there.

Menkar's own usage history keeps every turn's time, tokens and cost either way.
