---
title: Edit and preview files
description: Open files in tabs beside your sessions, preview Markdown, and keep each project's shared files in one folder.
sidebar:
  order: 4
---

## Open a file in a tab

- Choose :ui[menu.openFile] in the header's :ui[header.new] menu, or press `Ctrl+Shift+O`, and type or browse to
  the file.
- `Ctrl+click` a path a session printed in its terminal. Text and Markdown open in a tab; folders,
  images and PDFs open in the system's app. `Ctrl+Shift+click` always opens the system's app.
- From a terminal, with Menkar running:

  ```sh
  menkar open notes.md src/app.ts
  ```

A file tab colors the code. Edit it and press `Ctrl+S`, or click :ui[files.save]. If the file
changes on disk while you have unsaved edits, choose :ui[files.reload] or :ui[files.keepMine].
Claude Code's own files, under `~/.claude`, open read only.

## Preview Markdown

In a Markdown file's tab, click :ui[files.preview] or press `Ctrl+Shift+V`. The preview opens in a
tab of its own and follows your edits.

![](shot:markdown-preview)

To ask questions about a Markdown file, click :ui[files.askAgent]: a new Claude Code session opens
beside it, already told to read that file.

## Keep a project's shared files in one folder

Each project has a files folder, `~/Menkar/<project>/files`, listed under Files at the foot of the
sidebar, the newest first. Use it for what comes in from mail or chat, and for what a session makes
for you to share.

- Click :ui[files.add] and choose files: the chooser opens in your Downloads folder, and the files
  move into the project's folder. A toast offers :ui[files.undo] for a few seconds.
- Double-click a file to open it; right-click it for :ui[files.openInMenkar],
  :ui[files.openWithSystem] or :ui[files.moveToTrash].
- Drag a file from the list into another app, such as a mail or chat window.

Every session Menkar starts in the project finds the folder's path in `$MENKAR_FILES`, and a Claude
Code session may read and write it without asking. Ask a session to save there what you will share.

Files not changed for 30 days go to the system's trash. Change the days, or set 0 to keep them, in
:ui[header.settings] › :ui[settings.section.files].
