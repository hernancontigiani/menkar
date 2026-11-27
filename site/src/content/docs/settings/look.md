---
title: Change the look and the language
description: Pick light or dark, a theme, the font and the size of the interface, the language, and when Menkar notifies you.
sidebar:
  order: 1
---

Click :ui[header.settings] in the header, or press `Ctrl+,`. Settings opens in a window of its own,
its sections on the left. A change reaches every window at once.

## Pick colors, font and size

Open :ui[settings.section.appearance].

![](shot:settings-look)

| Setting | Choices |
|---|---|
| :ui[prefs.colorScheme] | :ui[prefs.schemeSystem], :ui[prefs.schemeLight] or :ui[prefs.schemeDark] |
| :ui[prefs.interfaceStyle] | :ui[prefs.styleTui] or :ui[prefs.styleClassic] |
| :ui[prefs.colorTheme] | VS Code, Catppuccin Mocha and Latte, Solarized Dark and Light |
| :ui[prefs.terminalColors] | :ui[prefs.terminalUbuntu], :ui[prefs.terminalNeutral] or :ui[prefs.terminalTheme] |
| :ui[prefs.interfaceSize] | From 90 % to 150 %, for Menkar's text and controls; the terminals keep their font size |
| :ui[prefs.font] | Any monospace font installed, and its size, for the terminals and the file editor |

How many lines a terminal keeps to scroll back is under :ui[settings.section.terminal].

## Change the language

Open :ui[settings.section.language], pick English, Spanish or :ui[prefs.systemDefault], and click
:ui[prefs.restartNow]. Menkar asks about unsaved file edits first; then it stops the running
sessions without asking, restarts, and resumes them in their tabs.

## Choose when Menkar notifies you

Under :ui[settings.section.notifications], :ui[prefs.notifyIdle] and :ui[prefs.notifySound] act
when a session you are not looking at finishes or needs your input. Click a notification to go to
that session.

## Set when the context ring warns

Each Claude Code, Codex and OpenCode session shows a ring with how full its context is: green,
yellow from 60 %, red from 90 %.
Change both thresholds under :ui[settings.section.context]. Hover a ring for the exact figure.

## Start without the last tabs

Menkar reopens each window with its tabs and resumes their sessions. To start empty, turn off
:ui[prefs.reopenTabs] under :ui[settings.section.sessions].
