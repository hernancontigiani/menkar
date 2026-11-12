# History of `docs/projects.md`

## The layout — `layout.ts`

> Left on 2026-11-10: replay removed from Menkar (decision 1.33).
  orientation), a file tab, or a transient tab (a new session not joined yet, a fork, chat, replay)

## `projects.json` — `store.ts`

> Left on 2026-11-11: a group gained `collapsed` and `leader` (decision 1.54).
  known ones; a group keeps only its three keys. Written whole, indented 2 spaces, non-ASCII as is.

## Projects — the model, the layout, `projects.json`, the first-start import

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
# Projects — the model, the layout, `projects.json`, the first-start import
`projects.json`, and the one-time import of agent-tablet's data. None of it imports Electron;
`src/main/projects.ts` runs the import, loads the projects and answers `projects:get`. The rules
come from `docs/spec/projects.md` and the first-start section of `docs/spec/sessions.md`; this file
keeps how they are built and why.

## The first-start import — `import.ts`

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
## The first-start import — `import.ts`
- **A first start** is one where neither `state.json` nor `projects.json` exists in Menkar's config
  directory. Main runs the import before the first window and before the sessions' first scan
  (which reads `state.json`), so no later write can make a first start look like a second one.
- agent-tablet's `projects.json` and `state.json` are read with `readFile` only, on Linux only, and
  never renamed or moved aside, even when unreadable. A test asserts their bytes and mtimes, and
  that nothing appears in their folder.
- **Read leniently**, unlike Menkar's own file: each good entry is kept, the rest dropped and
  counted in one warning. An unreadable file (not JSON, not an object, or a projects file that is
  not version 1 or has no list) gives a notice key (`import.projectsUnreadable`,
  `import.stateUnreadable`); a missing one is silent. The saved windows and unknown keys are not
  imported. Settings keep their names and meaning when their type is right.
- **Both of Menkar's files are written**, even when nothing was imported. `state.json` goes first;
  if `projects.json` then fails, `state.json` is removed, so a failed write leaves the next start a
  first start again.
- The notices, and an unreadable `projects.json` of Menkar's own, reach the renderer in
  `projects:get` until the window plan shows them.

## Collapsed groups and the group's leader

> Left on 2026-11-12: groups lose their leader; a group is only visual (decision 1.76).
## Collapsed groups and the group's leader (decisions 1.50 and 1.54, 2026-11-11)
- A group may carry `collapsed: true` and `leader: <session id>`, both optional. **Collapsed is the
  group's data, not the window's**: saved in `projects.json` and shown so in every window
  (`setCollapsed`, the action `collapseGroup`). A session joining a collapsed group keeps it
  collapsed, and nothing expands it but a click on its heading: not a member turning blocked, not
  its tab being selected, not Go to agent or a notification. "No group" never collapses.
- **The leader is one of the group's members, always the first** (`setLeader` moves it to the
  front and replaces any other; `clearLeader` keeps the order; the action `setLeader`). A dragged
  leader does not move, and a row dropped before it lands right after it. **It leaves with its
  membership**: every way out of a group goes through `leaveGroups` (`setGroup`, `newGroup`,
  `removeMember`, joining another project), which drops the leader there once. A session in "No
  group" cannot lead.
- Read leniently: a `collapsed` that is not `true` is expanded, a `leader` that is not one of the
  group's (repaired) members is dropped, and a leader written anywhere but first is read back
  first. An older Menkar drops both keys on its next save; the groups survive, so no version bump.
  while the "N hidden" toggle shows them), `★ <leader's name>`, then the state dot and the ring in
  the rows' columns. The dot is `groupState` (`src/core/agentstate/shown.ts`, `rollup` over the
  **running** members, so blocked wins and a collapsed group never hides what needs the human),
  stopped when none runs; the ring is the fullest reading among the running members, none when
  none runs. It carries `contains-selected` (the accent's left bar) while the window's selected
  tab holds a member, since that row is not visible. Expanded, the heading shows only the chevron,
  the dot and the name. The leader's row has a `★` after its name; the row menu's entry after
  Group is "Make group leader" or, on the leader, "Not the group's leader".
  already does it across windows); collapsed per window and not saved; the leader's row staying
  visible while collapsed (one row would become two); expanding on blocked (it moves the list under
  the pointer; the red dot already says it); a tooltip naming which member gives the state and the
  ring (not asked for); a schema version 2 (the keys are optional and an older reader survives
  them); a leader in "No group" (a leader leads a group).
  known ones. A group writes `name`, `color`, `members`, then `collapsed` and `leader` only when
  set, so a file using neither is written as before; a group's unknown keys are not kept. Written

> Left on 2026-11-12: each saved window keeps whether it is maximized (decision 1.98).
- **What is saved** (`toSaved`): per window, the shown project and its session tabs (joined panes)
  and file tabs, grouped by project, leaving out projects with none.
  its path is still a regular file. With "Reopen tabs on start" off, or nothing usable left, the
  result is one window on `current` with no tabs.
