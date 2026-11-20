---
title: Group work into projects
description: Keep each piece of work's sessions under one name, group them, and clear out the ones you no longer need.
sidebar:
  order: 2
---

A project is a list of sessions under one name, from any folders. Each window shows one project,
and its tab strip shows only that project's tabs.

## Create and switch projects

Click the project's name at the top of the sidebar.

![](shot:project-dropdown)

- To create one, type its name in :ui[projects.newName] and click :ui[projects.create].
- To switch, click another project. Its tabs come back as you left them.
- To rename or delete one, use the pencil and the bin on its row.

`Ctrl+Shift+E` switches between the projects you are using, the most recent first, as `Alt+Tab`
switches windows.

Deleting a project takes its sessions off the list and stops the running ones; their
conversations stay with the agent, and you can add them to another project.

## Group sessions inside a project

Choose :ui[row.group] in a session's menu, then a group, :ui[row.newGroup] or :ui[row.noGroup]. Each
group has its own color; click its heading to fold it. Drag a row to reorder it within its group.

## Move a session between projects

A session belongs to one project at most. Open :ui[sidebar.addSession] in the project you want it
in, find the session on :ui[add.existing] and click its button to move it from the other project.

## Clear out sessions

| To | In the session's menu | What happens to the conversation |
|---|---|---|
| Keep it in the project, off the list | :ui[row.hideInProject] (close its tab first) | Kept; the list's hidden count shows it again |
| Take it out of the project | :ui[row.remove] | Kept with the agent |
| Move its transcript to the system's trash | :ui[row.trash], on :ui[add.existing] | Restorable from the trash |
| Delete its transcript | :ui[row.delete], on :ui[add.existing] | Lost for good |

Deleting a transcript cannot be undone, and the agent loses the session with it.

## Read or export a session

A session's menu also has :ui[row.details] (its messages, models, tools and tokens) and
:ui[row.export], which writes the conversation to a Markdown file you choose.
