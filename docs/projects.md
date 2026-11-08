# Projects — the model, the layout, `projects.json`, the first-start import

`src/core/projects/` holds projects with their groups and members, the layout of windows and tabs,
`projects.json`, and the one-time import of agent-tablet's data. None of it imports Electron;
`src/main/projects.ts` runs the import, loads the projects and answers `projects:get`. The rules
come from `docs/spec/projects.md` and the first-start section of `docs/spec/sessions.md`; this file
keeps how they are built and why.

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
- Names are unique ignoring case and surrounding spaces, stored trimmed. A rename may change only the
  case of its own name.
- `joinTarget`: a new session joins the project its tab was started in, or `current` when that
  project is gone.
- Ids are the first 12 hex characters of a random UUID.

## The layout — `layout.ts`

- A `Layout` is windows; a window shows one project and keeps the tabs of every project it holds,
  with the tab last selected in each. A tab is a session tab (1–2 joined sessions, an
  orientation), a file tab, or a transient tab (a new session not joined yet, a fork, chat, replay)
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

## `projects.json` — `store.ts`

- **Read strictly**, version 1: a shape the model cannot hold makes the file unreadable. It is moved
  aside through `jsonstate` (`UnreadableShape`), never deleted, and a fresh Default starts. The
  moved file's name comes back for the notice. What can be repaired is repaired: a session listed
  in two projects stays in the first, group members that are not the project's are dropped, a
  missing color is `#5ec4b6`, an unknown `current` is the first project, and `windows` that is not
  a list is empty.
- **Unknown keys** at the top level and in a project are written back as they came, before the
  known ones; a group keeps only its three keys. Written whole, indented 2 spaces, non-ASCII as is.
- A missing file is a fresh Default; nothing is written until the first save.

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

## Watching an agent's folder that appears later

When `~/.claude/projects` (or Cursor's) does not exist, the sessions service watches its nearest
existing ancestor instead (`src/core/sessions/service.ts`). The ancestor's change event starts the
rescan that finds the new directory, and the scan after it watches the directory itself.

## On screen

The window (`docs/window.md`) draws this model; it does not change it. Every action of the project
dropdown, the session rows' menu and the tab strip goes to `src/main/workspace.ts`, which calls
these functions and pushes the new state to every window. A refusal comes back as its key and is
shown as the spec says: the dropdown's error line, an error dialog, or a 4 s toast.
