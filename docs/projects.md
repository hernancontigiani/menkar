# Projects — the model, the layout, `projects.json`

`src/core/projects/` holds projects with their groups and members, the layout of windows and tabs,
and `projects.json`. None of it imports Electron; `src/main/projects.ts` loads the projects and
answers `projects:get`. The rules come from `docs/spec/projects.md`; this file keeps how they are
built and why.

## The model — `model.ts`

- Pure functions over an immutable `Projects` (current, projects, the saved windows as read, the
  file's unknown keys). A change returns a new state, or a refusal: a key of `t()`
  (`projects.nameEmpty`, `projects.nameTaken`, `projects.lastProject`, `groups.nameEmpty`,
  `groups.nameTaken`) that the UI translates and shows.
- **One project per session**: `addMember` takes a session out of the project that had it and out
  of that project's group; `removeMember` and every group change drop a group left empty.
- `setGroup` takes the group the menu showed (name and color), so a group dropped since the menu was
  built comes back with this session alone. `newGroup` colors by `GROUP_COLORS[n mod 5]`, where n
  counts the groups left after the session's old group was dropped.
- Picking a session's own group again changes nothing (2026-11-11): leaving and rejoining would
  move it last and take its lead.
- Names are unique ignoring case and surrounding spaces, stored trimmed. A rename may change only the
  case of its own name.
- `joinTarget`: a new session joins the project its tab was started in, or `current` when that
  project is gone.
- Ids are the first 12 hex characters of a random UUID.

## Reordering rows (2026-11-10)

- A group's rows are listed in `group.members` order, "No group"'s in `project.members` order.
  `moveMember(state, session, target, 'before' | 'after')` rewrites that one array; it changes
  nothing when the target is in another group (or one is grouped and the other is not), is the
  session itself, or is not a member. **A drop never changes a group**: that stays in the row's
  menu. Group headings are not dragged, so groups keep their order.
- The move is relative to a row the user saw, the one after the gap, or the last one when the gap is
  at the end. So a hidden member not shown keeps its place between the rows it sat between; shown,
  it is dragged like the rest.
- The window's list uses the tab strip's drag (`dragToReorder` in `src/renderer/app.ts`): the same
  5 px threshold, the marker in the gap, nothing moved when let go outside the list. A row drops
  only among its own section's rows: over another group the marker stays at its own section's
  nearest end, and a row alone in its section does not start a drag. The rows are not selectable,
  since selected text would start the browser's own drag, which cancels the pointer. The action is
  `moveSession`, saved as every project change is.

## Collapsed groups (decision 1.50, 2026-11-11)

- A group may carry `collapsed: true`, optional. **Collapsed is the group's data, not the window's**:
  saved in `projects.json` and shown so in every window (`setCollapsed`, the action
  `collapseGroup`). A session joining a collapsed group keeps it collapsed, and nothing expands it
  but a click on its heading: not a member turning blocked, not its tab being selected, not Go to
  agent or a notification. "No group" never collapses.
- **A group is only visual** (decision 1.76, 2026-11-12): a name, a color, its members in the order
  the user gave them and whether it is collapsed. It has no leader; roles per session belong to the
  orchestration mode.
- Read leniently: a `collapsed` that is not `true` is expanded. A `leader` an earlier version wrote
  is not read, and the next save leaves it out. An older Menkar drops `collapsed` on its next save;
  the groups survive, so no version bump.
- **The sidebar** (`renderSessionList` in `src/renderer/app.ts`): a group's heading is a button
  with a chevron (`▾`/`▸`, drawn by CSS so the heading's text is unchanged); "No group"'s stays a
  plain heading. Collapsed, the heading is the group's one row, in a session row's height: the name
  in the group's color with the count of the rows it would list expanded (the hidden members only
  while the "N hidden" toggle shows them), then the state dot and the ring in the rows' columns. The
  dot is `groupState` (`src/core/agentstate/shown.ts`, `rollup` over the **running** members, so
  blocked wins and a collapsed group never hides what needs the human), stopped when none runs; the
  ring is the fullest reading among the running members, none when none runs. It carries
  `contains-selected` (the accent's left bar) while the window's selected tab holds a member, since
  that row is not visible. Expanded, the heading shows only the chevron, the dot and the name.
- **Rejected**: a double click on the collapsed row jumping to the member most in need (Go to agent
  already does it across windows); collapsed per window and not saved; expanding on blocked (it
  moves the list under the pointer; the red dot already says it); a tooltip naming which member
  gives the state and the ring (not asked for); a schema version 2 (the key is optional and an
  older reader survives it).

## Hidden in a project (decision 1.25, 2026-11-09)

- A project keeps a `hidden` list of its own members (`model.ts` `hideMember`, `showMember`). A
  hidden member leaves the project's list and **stays a member**: usage still counts it under the
  project, and no other project or the history's global hide is touched.
- Only a session without a tab can be hidden (a tab is never without its row): the row menu's
  Hide is off for it, saying to close its tab first.
- It is shown again from its menu's Show (with the list's "N hidden" toggle on, which is per window
  and not saved), by being picked in Add session, or by being started from anywhere: running
  implies shown (`startPane`). The quick switcher lists hidden members, dimmed.
- In `projects.json` the list sits after `groups`, only when not empty. It is read leniently: ids
  that are not members are dropped, and a malformed list reads as none; a member leaving the
  project leaves the list too.

## Earlier conversations (decision 1.63, 2026-11-11)

- A project keeps `earlier`, a map from a session to the sessions its tab left through `/clear`
  or an in-session `/resume` (`src/core/projects/earlier.ts`; how a tab follows is in
  `docs/sessions.md`). They stay members, so usage counts them under the project; the list, the
  hidden count, the quick switcher and the project's count leave them out.
- **What always holds** (`keptEarlier`), whatever changed the members since: a key and every id in
  a list are members, an id is in one list at most and is never a key, and no list is empty.
  Anything else is dropped, so a session whose key left the project shows as an ordinary row
  again. The renderer receives the map already kept so.
- In `projects.json` it sits on the project after the files keys, only when not empty. It is read
  leniently, as `hidden` is: ids that are not members and values that are not lists of strings are
  dropped, and a malformed map reads as none.

## Parents (decisions 1.70 and 1.74, 2026-11-11)

- A project keeps `parents`, a map from a session another one started through Menkar's
  `start_session` to its starter (`src/core/projects/parents.ts`). It says whom Menkar wakes
  (`docs/session-control.md`).
- **What always holds** (`keptParents`): child and parent are both members of the project and
  differ. An entry that stops holding is dropped. `forgetSession` (a transcript trashed or deleted)
  tidies it like `earlier`.
- **It follows new ids:** `followNewId` (a `/clear` and a renew) moves an id both as a child and as
  a parent, so a wake reaches a parent that renewed. Ids are what is kept; the agents address
  sessions by name.
- In `projects.json` it sits after `earlier`, only when not empty, and is read leniently: entries
  that are not strings or do not hold are dropped.
- **A session started for another agent's sake** opens in a tab inserted right after the caller's
  (`insertTabAfter` in `layout.ts`), in the window that holds the project, with that window's
  selected tab left as it was.

## The layout — `layout.ts`

- A `Layout` is windows; a window shows one project and keeps the tabs of every project it holds,
  with the tab last selected in each. A tab is a session tab (1–2 joined sessions, an
  orientation), a file tab, or a transient tab (a new session not joined yet, a fork, chat)
  that is never saved.
- **The invariants are held by construction, not checked after.** `holder()` finds the one window
  that shows a project or has a tab of it. Every operation that places a session first looks for
  the tab it already has (`findSession`) and moves that tab or pane instead of adding a second one.
- Open (`openSession`), Open beside (`openBeside`), and picking in Add session (`moveSessionHere`,
  F5) return what changed, or a refusal key (`layout.twoPanesMax`, `layout.otherProject`,
  `layout.alreadyBeside`, `layout.sharesTab`) for the toast. Moving between tabs (`stepTab`,
  `nthTab`) only counts the shown project's tabs.
- **What is saved** (`toSaved`): per window, the shown project and its session tabs (joined panes)
  and file tabs, grouped by project, leaving out projects with none.
- **What reopens** (`reopen`): the saved windows as the file had them, each entry checked on its
  own. A project already taken by an earlier window is skipped. A session is placed once, only
  while it is a member of that tab's project, and at most two per tab. A file tab is kept only if
  its path is still a regular file. With "Reopen tabs on start" off, or nothing usable left, the
  result is one window on `current` with no tabs.
- **When a project's tabs start** (decision 1.32, 2026-11-09): every project's saved tabs are
  reopened into its window, but only the shown project's sessions start at boot. Another project's
  session tabs stay in the layout, saved, with no process, until the window first shows that
  project; then they start, and they keep running when the window shows another project again.
  In `src/main/workspace.ts`, a session tab with no panes that is not being started is deferred,
  and `startShownTabs`, run on every change, starts the shown project's deferred tabs. Every way a
  project becomes shown (switching, Go to agent, a new window, an opened session) goes through a
  change, so none of them starts tabs itself. Closing a deferred tab only drops it.

## `projects.json` — `store.ts`

- **Read strictly**, version 1: a shape the model cannot hold makes the file unreadable. It is moved
  aside through `jsonstate` (`UnreadableShape`), never deleted, and a fresh Default starts. The
  moved file's name comes back for the notice. What can be repaired is repaired: a session listed
  in two projects stays in the first, group members that are not the project's are dropped, a
  missing color is `#5ec4b6`, an unknown `current` is the first project, and `windows` that is not
  a list is empty.
- **Unknown keys** at the top level and in a project are written back as they came, before the
  known ones. A group writes `name`, `color`, `members`, then `collapsed` only when set, so a file
  without it is written as before; a group's unknown keys are not kept. Written
  whole, indented 2 spaces, non-ASCII as is.
- A missing file is a fresh Default; nothing is written until the first save.
- The notice of a file moved aside reaches the renderer in `projects:get`.

## Watching an agent's folder that appears later

When `~/.claude/projects` (or Cursor's) does not exist, the sessions service watches its nearest
existing ancestor instead (`src/core/sessions/service.ts`). The ancestor's change event starts the
rescan that finds the new directory, and the scan after it watches the directory itself.

## On screen

The window (`docs/window.md`) draws this model; it does not change it. Every action of the project
dropdown, the session rows' menu and the tab strip goes to `src/main/workspace.ts`, which calls
these functions and pushes the new state to every window. A refusal comes back as its key and is
shown as the spec says: the dropdown's error line, an error dialog, or a 4 s toast.
