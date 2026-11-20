---
title: Use several windows
description: Open a window per project, and bring a project from one window to another.
sidebar:
  order: 3
---

Each window shows one project, and a project is open in one window at a time.

## Open a new window

Choose :ui[menu.newWindow] in the header's :ui[header.new] menu, or press `Ctrl+Shift+N`. It opens on a project
no other window holds; when every project is open somewhere, create a new project for it.

## Bring a project to this window

Pick, in the project list, a project another window holds. Menkar asks what to do:

- :ui[projects.bringHere] moves its tabs here, in their order; its sessions keep running.
- :ui[projects.goThere] brings that window forward and changes nothing.

`Ctrl+Shift+E` and :ui[shortcut.goToAgent] (`Ctrl+B` then `g`) always bring the other window forward.

## Close a window

Closing a window stops its sessions, and asks first when one of them is still running. The last
window closed keeps its tabs for the next start, and whether it was maximized.
