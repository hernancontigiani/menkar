---
title: Arrange sessions in tabs and panes
description: Put two sessions side by side, open a shell beside an agent, and move between tabs without the mouse.
sidebar:
  order: 1
---

Each session runs in a tab of the strip at the top. The strip shows only the tabs of the project
the window shows. A tab holds one or two panes.

## Put two sessions side by side

Choose :ui[row.openBeside] in a session's menu in the sidebar. It opens in a second pane of the
tab you are looking at.

![](shot:split-panes)

Each tab shows its sessions' state dot and context ring. To turn the split from side by side to
one above the other, right-click the tab and choose :ui[tab.menuSwap].

## Open a shell beside an agent

- To split a tab with a shell in the session's folder, press `Ctrl+B` then `v` (right) or `-`
  (down). Close the pane with `Ctrl+B` then `x`.
- For a quick command, such as git in the session's folder, press ``Ctrl+` `` or choose
  :ui[menu.drawer] in the header's :ui[header.new] menu: a shell opens under the tab's panes. The same key hides it and
  keeps it running; type `exit` to end it.

## Move around without the mouse

`Ctrl+B` works as in tmux: press it, let go, then press the command's key. `Ctrl+B` then `?` lists
every command.

| To | Press |
|---|---|
| Go to the pane on a side | `Ctrl+B` then `h`, `j`, `k` or `l` |
| Zoom the pane to the whole tab, and back | `Ctrl+B` then `z` |
| Go to the next or the previous tab | `Ctrl+Tab`, `Ctrl+Shift+Tab` |
| Go to tab 1 to 9 | `Ctrl+B` then the number |
| Jump to a session of the project | `Ctrl+Shift+K` |
| Jump to any tab of any window, by name or state | `Ctrl+B` then `g` |

Every key is in [Keyboard shortcuts](/menkar/reference/shortcuts/).

## Rename, reorder and close tabs

- Drag a tab to move it along the strip.
- Right-click a tab for :ui[tab.menuRename], :ui[tab.menuCloseOthers] and :ui[tab.menuCloseAll].
- Closing a tab stops its sessions; their conversations stay with the agent. Closing a window asks
  first when a session in it is still running.
