---
title: What Menkar keeps, and what it never sends
description: What Menkar stores on your computer, what it reads of your agents' files, and which connections are the agents' own.
sidebar:
  order: 2
---

## What Menkar never sends

Menkar makes no network connection of its own: no telemetry, no update check, no crash reports, no
remote fonts or scripts in its windows. It checks for nothing online; update it by installing a
newer package.

A link opens in your browser only when you click it: a link a session printed, or the two links
in :ui[header.settings] › :ui[settings.section.about].

## What the agents send

Menkar runs each agent's own command, and that agent connects to its own service as it does in any
terminal, with your login: Claude Code to Anthropic, Cursor's agent to Cursor. What a session sends
is the agent's business and follows its settings.

Two things Menkar starts go through Claude Code, each only when you turn it on:

- [Remote Control](/menkar/sessions/remote-control/) connects a session to the Claude app and
  claude.ai.
- [Splitting usage by stage](/menkar/usage/window/#split-each-project-by-stage) sends each prompt
  you type, with your previous prompt and the files and commands the agent used, to Claude Haiku
  with your login.

## What Menkar reads and writes of your agents' files

Menkar reads the agents' sessions to list them, name them and count their usage, and never
rewrites them. It writes under `~/.claude` only when you ask it to:

- moving a transcript to the trash, or deleting it, each after you confirm;
- the [status line and transcript retention](/menkar/settings/integrations/), each when you turn it
  on, with a copy of the file kept first.

Menkar's file tabs open Claude Code's own files read only.

## What Menkar keeps on your computer

| Folder | What it holds |
|---|---|
| `~/.config/menkar/` | Settings, projects, windows and tabs, the orchestration mode's items and tasks |
| `~/.local/share/menkar/` | The usage history, and the copies of `~/.claude/settings.json` made before each change |
| `~/.cache/menkar/` | The log, and the working files of the sessions Menkar runs |
| `~/Menkar/<project>/` | Each project's files folder, and a private folder its sessions may keep notes in |

When your system sets `XDG_CONFIG_HOME`, `XDG_DATA_HOME` or `XDG_CACHE_HOME`, the first three
folders are under those instead.

The usage history keeps, for each turn, when it ran, how long it took, its tokens and cost, and
its session's and project's names. It keeps no prompt or answer text. What it records of your own
activity, for [your time](/menkar/usage/window/#see-your-own-time), is moments without any text.

Removing the package leaves these folders. Delete them to remove what Menkar kept.
