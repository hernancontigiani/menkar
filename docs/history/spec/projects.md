# History of `docs/spec/projects.md`

## Reopening on start (F26)

> Left on 2026-11-08: built by plan 07, described in `docs/projects.md`.
What reopens, from the saved `windows` (Data contracts), in order:
- A window entry needs a string `current`; other entries are skipped.
- A project id that no longer exists, or that an earlier window already took, is skipped (a
  project is in one window).
- A session tab keeps, in order, the pane ids that are still members of that project and were not
  already placed in an earlier tab, at most two; with none left, the tab is dropped. An unknown
  orientation reads as side by side.
- A file tab whose path is no longer a regular file is dropped; one that exists but no longer opens
  (`files.md`) is dropped when opened, with a log line.
- The window's shown project is its saved `current` if it exists and is not taken; else the first
  project it has tabs of; else the window is dropped.
- If nothing usable is left, one window on `current`, no tabs.

## `projects.json`, version 1

> Left on 2026-11-08: built by plan 07, described in `docs/projects.md`.
Top level:

| Key | Type | Meaning | Read rule |
|---|---|---|---|
| `version` | int | Format version | Must be `1`, else the file is unreadable |
| `current` | string | The project last chosen in a window; new windows and a start without reopening open on it | Not a project's id → the first project |
| `projects` | array of project | In display order (creation order) | Not an array, or empty → unreadable |
| `windows` | array of window | The saved layout | Not an array → `[]` |
| any other key | any | Written by a later version | Kept and written back as it came, before the known keys |

Project:

| Key | Type | Meaning | Read rule |
|---|---|---|---|
| `id` | string | 12 lowercase hex characters, random (the first 12 of a random UUID's hex) | Not a string → unreadable |
| `name` | string | Unique ignoring case and surrounding spaces; stored trimmed | Not a string → unreadable |
| `members` | array of string | Session ids, in the order they joined | Missing → `[]`; not an array of strings → unreadable. An id already a member of an earlier project is dropped from this one |
| `groups` | array of group | In creation order | Missing or `null` → `[]` |
| any other key | any | Later version | Kept and written back as it came |

Group:

| Key | Type | Meaning | Read rule |
|---|---|---|---|
| `name` | string | Unique in the project ignoring case and spaces | Not a string, or the group not an object → unreadable |
| `color` | string | `#rrggbb`, from the palette at creation | Missing or empty → `#5ec4b6`; any other value is stringified |
| `members` | array of string | Session ids, each also in the project's `members` | Not an array of strings → unreadable; ids not in the project's members are dropped; a group left with none is dropped |
| other keys | — | — | **Not** kept (agent-tablet drops them) |

Window (in `windows`), written from the live windows on every save; unknown keys here are not kept:

| Key | Type | Meaning |
|---|---|---|
| `current` | string | The project the window shows |
| `tabs` | object: project id → array of tab | The window's tabs of each project, in tab order; only projects with at least one saved tab appear |

Tab, one of two shapes:

| Shape | Keys | Meaning |
|---|---|---|
| Session tab | `panes`: array of 1–2 session ids; `orientation`: `"horizontal"` (side by side, the default) or `"vertical"` (stacked) | The sessions that have joined a project, primary pane first; shell panes are not saved. A tab with no such session (a new session not joined yet, a fork before joining) is not saved |
| File tab | `file`: absolute path; `preview`: bool (`true` = the rendered Markdown) | `files.md` |

Chat and replay tabs are never saved.
**Written form**: UTF-8, non-ASCII kept as is, indented 2 spaces, keys in the order: unknown top-level
keys, `version`, `current`, `projects`, `windows`; in each project its unknown keys, then `id`,
`name`, `members`, `groups`.
**A missing file** is a fresh state: one project "Default" with a new id, `current` = it, no
windows; nothing is created on disk until the first save.

## Acceptance cases

> Left on 2026-11-08: built by plan 07, described in `docs/projects.md`.
PRJ-3. `projects.json` has `"version": 2` → treated as unreadable, as PRJ-2.
PRJ-4. `projects.json` has `"projects": []` → unreadable, as PRJ-2.
PRJ-5. A project whose `members` is `"abc"` (a string) → unreadable, as PRJ-2.
PRJ-6. Session `S` is in the `members` of projects A then B → after loading, `S` is in A only; the
next save writes it only in A.
PRJ-7. A group lists a session that is not in its project's `members` → that id is dropped from the
group; if none remain the group is gone.
PRJ-8. A group with no `color` → it shows and saves `#5ec4b6`.
PRJ-9. `current` names no project → the first project is current.
PRJ-10. A file with a top-level key `"future": {"x": 1}` and a project key `"pinned": true` → after
renaming any project, the saved file still has both, unchanged.
PRJ-49. Saved panes `["S1","S2","S3"]` all members → reopens with S1, S2 only.
PRJ-50. Saved tab with a session no longer a member of that project → that pane is dropped; a tab
with no pane left is dropped.
PRJ-51. Two saved windows both listing project A → A's tabs reopen only in the first; the second,
with nothing else usable, is dropped.
PRJ-52. Saved file tab whose file was deleted → not reopened, no error shown.
PRJ-53. "Reopen tabs on start" off → one window on `current`, no tabs, whatever `windows` says.
PRJ-55. A saved file is reread: 2-space indentation, non-ASCII project names unescaped ("Café"
written as `"Café"`), key order `version`, `current`, `projects`, `windows`.

> Left on 2026-11-08: built by plan 08, described in `docs/window.md`.
PRJ-11. Create with "  " → the popover stays open with "A project needs a name."; no project added.
PRJ-13. Create "Infra" → it is appended last in the dropdown, the window shows it with the empty
state, the entry is cleared, the popover closed, `current` is its id in the file.
PRJ-14. Rename "Work" to "WORK" → allowed (same project); renaming "Docs" to "work" → error dialog
"The project was not renamed" / "There is already a project with that name."
PRJ-27. Open (double click) a stopped member → a new tab at the end of the strip, selected, titled
with the session's name, resuming it; Open again → the same tab is selected, no second tab.
PRJ-45. Close a window with 2 running sessions "api" and "tests" → "Stop 2 running session(s)?" /
"api, tests\n\nTheir conversations stay in Claude."; Cancel → nothing; Stop and close → both exit
and the window closes.

> Left on 2026-11-08: the pointer rewritten by plan 08 to name the cases built on screen.
The cases built in `core` (PRJ-3–10, 49–53, 55) left for the history; the Vitest tests in
`tests/core/projects/` carry their ids.

## The model

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
- A **project** is an id, a name, an ordered list of member sessions (by session id) and an ordered
  list of groups. It has no folder of its own; members come from any folder.
- A project called **Default** exists from the first start, empty. There is always at least one
  project.
- A **group** is a name, a color and an ordered list of members, all of them members of the same
  project. A session is in at most one group. A group with no members does not exist (it is dropped
  the moment its last member leaves).
- A **tab** belongs to one project (the one the window showed when it was opened) and holds either
  one or two terminal panes, or one file (its text, or its rendered Markdown, see `files.md`), or a
  chat or replay view (`chat.md`, `sessions.md`). A pane runs a session's agent, or a plain shell
  (a split, `terminal.md`).
- A **window** shows one project at a time and keeps the tabs of every project it has shown: they
  keep running while hidden. The tab strip shows only the shown project's tabs.

## The project dropdown (F21)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
At the top of the sidebar, a full-width button showing the current project's name (bold, ellipsized
at the end), then the blocked badge (F31, `agent-state.md`), then a down-arrow. Tooltip
"Projects". Clicking opens a popover:

- One row per project, in the file's order (creation order): a check mark visible only on the
  project this window shows; the name (ellipsized); a red badge with the number of that project's
  blocked sessions (only when > 0, tooltip "Sessions waiting for you"); "open in another window"
  (dim, small) when another window holds it; the member count (dim, tooltip "Sessions in this
  project" — it counts every member, including ones whose transcript is gone); a pencil button
  (tooltip "Rename project"); a trash button (tooltip "Delete project").
- Below a separator: an entry (placeholder "New project name") and a **Create** button (accent
  colored). Enter in the entry is Create.
- Below them, an error line (red, wrapped), hidden until a create fails and hidden again when the
  popover closes.

**Switch.** Clicking a project row closes the popover and shows that project in this window:

- If another window holds it (shows it or has a tab of it), that window is brought forward and
  nothing changes here (1.18).
- Otherwise the window shows it; the file's `current` becomes it and is saved. The content shows
  the tab of that project last selected in this window, else its first tab, else the empty state
  "No session open" / "Pick a session from the sidebar, or start a new one." The previous project's
  tabs stay, running and hidden.
- Choosing the project already shown does nothing.

**Create.** The name is trimmed. Refused, with the error shown in the popover's error line and the
popover left open:
- empty → "A project needs a name."
- equal to an existing project's name ignoring case and surrounding spaces → "There is already a
  project with that name."

Otherwise the project is appended (empty, no groups), saved, the entry cleared, the popover closed,
and this window switches to it.

**Rename** (pencil). The popover closes first, then a dialog: heading "Rename project", the current
name in an entry (placeholder "Name"), Cancel / **Save** (Save is the default response, accent
colored). The same two refusals as Create apply, excluding the project itself (renaming "work" to
"Work" is allowed); a refusal shows an error dialog, heading "The project was not renamed", body the
refusal sentence, one button "OK". Any project can be renamed, Default included (1.19).

**Delete** (trash). The popover closes first.
- When it is the only project: an error dialog, heading "The project was not deleted", body "The
  last project cannot be deleted.", "OK".
- Otherwise a confirmation: heading "Delete “{name}”?", body "Its sessions leave the list; their
  conversations stay in Claude." and, when some of its sessions are running, a space and "{n}
  running session(s) will be stopped first."; buttons Cancel (default) and **Delete**
  (destructive). On Delete: its running sessions are stopped (each closes gracefully,
  `terminal.md`); its tabs that hold no joined session (file, chat, replay, a new session not
  joined yet) close — a file with unsaved edits asks (`files.md`); the project and its groups are
  removed; its members are released (in no project; Claude's data is untouched). If this window
  showed it, it shows the first remaining project. If the file's `current` was it, `current` becomes
  the first remaining project. Saved.
- A project open in **another** window: agent-tablet counts and stops only the sessions running in
  the window where Delete was pressed, and the other window keeps the deleted project's tabs — a
  defect. Menkar counts and stops its sessions in whichever window runs them, and the window that
  showed it switches to the first remaining project.

## The project's session list

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
Below the dropdown, the shown project's members, as `sessions.md` describes each row (name,
folder, context ring, ⋯ menu, Remote control phone). What this area decides:

- **Sections.** Each group in order, as a heading (a ● in the group's color, then the group's name)
  followed by its members in the order they joined the group; then the members in no group, in
  the order they joined the project. The loose members get a heading "No group" only when at
  least one group heading is shown; with no groups the list has no headings.
- Members whose transcript the app does not know (deleted, not scanned yet) are not shown; a group
  all of whose members are unknown shows no heading. Hidden sessions (F11) are shown: hiding only
  takes a session out of the history browser.
- **Folder line.** Under each name, the basename of the session's folder — only when the shown
  members are in more than one folder; when all share one folder (or have none), no row shows it.
- **State dot** at the left of each row: the session's agent state (`agent-state.md`) when it has a
  tab, else *stopped*. Its tooltip is the state word.
- **Empty list**: an icon (a bulleted list), title "{name} has no sessions", description "Add one
  Claude already knows, or start a new one in any folder.", and a pill **Add session** button
  (accent colored) that opens Add session on Existing.
- Below the list, always: an **Add session** button that opens Add session on Existing.
- A **single click** on a row selects the session's tab when it has one; a stopped session waits
  for a double click. A **double click** is Open (M18).

## The session row's menu (M18, M19, M22–M25, M32)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
Opened with the row's ⋯ button or a right click; built anew each time. Sections: *Open, Open beside
the current tab, Stop, Remote control (`remote-control.md`), Group ▸* / *Rename…, Details…, Replay…,
Copy session ID, Export as Markdown…, Reveal transcript* (`sessions.md`) / *Remove from project*.

**Open (M18)** — also a double click and the quick switcher's choice:
- Running in a tab of this window → that tab is selected.
- Not a member of any project → it joins the shown project (appended, saved), then as below.
- A member of another project → that project is shown (in this window if no other window holds it;
  if another window holds it, that window comes forward and **the session is opened there**:
  agent-tablet also opens a second tab for it in the first window, a defect that would run it
  twice). 
- Otherwise a new tab is appended at the end of this window's tabs, in the shown project, selected:
  the agent resumes the session (`terminal.md`). Title: the session's name. Tooltip: "{folder
  basename} — {session id}".

**Open beside the current tab (M19)** puts the session in the second pane of the selected tab:
- When there is no selected tab, or it is not a terminal tab (a file, chat or replay tab), or it
  belongs to another project: it acts as Open.
- A member of another project → refused with a toast (4 s): "It belongs to another project; add it
  here first".
- Already in the selected tab → nothing.
- The selected tab has two panes already → toast (4 s): "A tab holds two panes at most".
- A session with no project joins the shown one.
- Running alone in its own tab of this window → its pane **moves** into the selected tab without
  stopping, and its old tab disappears. Running in a two-pane tab → toast (4 s): "It is already
  beside another session".
- Not running → it is resumed in the new pane.
- The new pane goes beside the focused pane, side by side (left | right), each taking half; it takes
  the focus. The tab's title becomes both names joined by " │ " (space, U+2502, space), primary
  pane first. The tab's state, group color and ring take both sessions into account.

**Stop** (`terminal.md`): the session's pane stops; a single-pane tab closes with it.

**Group ▸ (M22)** — a submenu: one item per group of the shown project, by name (M23); **No group**
(M24); **New group…** (M25).
- A group (M23): the session leaves its group, if any, and is appended to that one. A group that the
  move emptied is dropped; choosing a group that was dropped meanwhile (the menu was built before)
  brings it back with this session alone, its name and color kept.
- No group (M24): the session leaves its group; an emptied group is dropped.
- New group… (M25): a dialog, heading "New group", body "Groups belong to this project; they never
  change a session's name.", an empty entry (placeholder "Name"), Cancel / **Save**. The name is
  trimmed. Refused, with an error dialog heading "The group was not created" and the sentence as
  body: empty → "A group needs a name."; equal to one of this project's groups ignoring case and
  spaces → "There is already a group with that name.". Otherwise the session leaves its previous
  group (an emptied one is dropped), and the new group is appended with this session as its only
  member and the color `GROUP_COLORS[n mod 5]`, where n is the number of groups the project has at
  that moment (after the drop) and the palette is, in order, `#5ec4b6` (teal), `#c17be0` (violet),
  `#e0b45b` (amber), `#7fb2ff` (blue), `#e57c9a` (pink). Two groups can share a color.
- Every change is saved and the list redrawn.

**Remove from project (M32).**
- Not running → removed at once, no question: it leaves the members and its group (an emptied group
  is dropped). Saved.
- Running → a confirmation: heading "Remove “{name}” from the project?", body "It is running, so it
  is stopped first. Its conversation stays in Claude.", Cancel (default) / **Stop and remove**
  (destructive). On confirm it is stopped, then removed as above.
- The session's transcript is untouched; it stays in the history browser and can be added again.

## Membership (F23, F5)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
- Adding a session to a project removes it from the one that had it (and from that project's
  groups). The project it came from is the one the dialog names in "Move from {name}"
  (`sessions.md`).
- **Its tab moves with it (F5, 1.18).** Picking a session in Add session → Existing (Add or Move
  from…) while its tab is in **another window**: the tab is moved into this window, appended at the
  end, in this window's shown project, selected — without stopping it, its state carried over. If
  that tab holds two sessions, nothing moves and nothing changes; a toast (4 s): "It shares a tab
  with another session there". The other window then shows its project's remaining tabs, or the
  empty state.
- A session with a tab **in this window**, in another project's tab, moved here: its tab becomes a
  tab of this project. agent-tablet moves the whole tab even when it holds a second session, which
  then runs in a project it is not a member of — a defect; Menkar moves the session's pane alone
  into a new tab of the target project (as agent-tablet's own layout model does), leaving the other
  session in its tab.
- Picking a session adds it; it does not open it.
- **A new session joins its project once Claude has a message the user typed in it** (1.16):
  started from New, from "continue last", or as a fork (`terminal.md`), its tab sits in the shown
  project but the session is not a member yet. The app waits for its transcript; when the
  transcript exists and has a first typed message, the session is appended to the project the tab
  was started in and saved, and the tab becomes that session's tab (its state, ring and layout entry
  start). If the tab was closed after a message was typed but before the transcript was seen, it
  still joins (without a tab). If it closes with no typed message, nothing joins. If that project
  was deleted meanwhile, it joins the project in the file's `current`. agent-tablet records the
  target as the file's `current` (the project last chosen in *any* window) rather than the window's
  shown project — a defect with two windows; Menkar uses the shown project of the window the tab
  was started in.
- Chat and replay tabs belong to the shown project but are never members and never reopen (1.17).
- Cursor sessions are members under the same rules (1.15).

## Tabs (F24)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
**The tab strip** (under the header) shows the shown project's tabs, in the order they were opened
in this window, then a "+" button (tooltip "New session in this project"; opens Add session on
New). While the `Ctrl+B` prefix waits, a PREFIX pill shows right of the tabs (`terminal.md`).

Each tab shows, left to right: a ● in the group's color when every session in it is in one same
group; the agent-state dot unless the state is idle (`agent-state.md`); the context ring when known
(`context.md`); the title, ellipsized past 28 characters; a close "×". Its tooltip: the tab's
tooltip (for a session tab, "{folder basename} — {session id}"; for a file, its path).

- Left click selects. Middle click closes. Right click opens the tab menu. The "×" closes (its click
  is not a select).
- Tab titles: a session's name; a fork "{name} (fork)"; a new session its given name, else its
  folder's basename; two panes "A │ B"; a file its name (`files.md`); replay "Replay — {name}";
  chat "Chat — {folder}" or "Chat — {name}".

**Tab menu** (right click; anchored under the tab, no arrow): Rename… (M13), Copy session ID
(M14, `sessions.md`), Swap the split's orientation (M15, `terminal.md`), Close (M16), and, in a
second section, Remote control (M17) when the tab holds exactly one Claude session.

- **Rename… (M13)** and `Ctrl+B T` (K33, on the selected tab): a tab whose first pane is a
  session that has joined a project opens that session's rename (`sessions.md`: it renames the
  session, and the row and tab follow). Any other tab (a new session not joined yet, a fork, a file,
  chat, replay) opens a dialog heading "Rename session", body "Tab name", the current title, Cancel
  / Save; the tab's title becomes the trimmed text, an empty text keeps the old title. This local
  title is not saved anywhere.
- **Close (M16)**, `Ctrl+Shift+W` (K4), `Ctrl+B X` (K34), middle click, "×": the tab closes; a
  running agent in it is asked to exit first and the tab stays until it does (graceful close,
  `terminal.md`); a file with unsaved edits asks (`files.md`). No confirmation for sessions. Its
  sessions stop; their rows stay, *stopped*.
- **Close all tabs**: a header button (an icon of a tab with a ×, tooltip "Close all tabs") visible
  while this window has two tabs or more — counting the tabs of **every** project the window holds,
  not only the shown one — closes every tab of the window, each as Close does.
- When the shown project's last tab closes, the content shows the empty state.
- If the selection moves to a tab of a project the window is not showing (e.g. a neighbour after a
  close), the window goes back to the shown project's last-selected tab, or its first, or the
  empty state.

**Moving between tabs** — only among the shown project's tabs:
- `Ctrl+PgDn`, `Ctrl+Tab`, `Ctrl+B n` (K5, K6, K29): next tab; past the last wraps to the first.
- `Ctrl+PgUp`, `Ctrl+Shift+Tab`, `Ctrl+B p` (K7, K8, K30): previous; wraps.
- With fewer than two tabs, nothing happens.
- `Ctrl+B 1`…`9` (K31): the Nth tab of the shown project, 1-based; a number past the count does
  nothing.
- These keys are captured before the terminal sees them.

**Tabs hold at most two panes** (MAX_PANES = 2). A split of a shell counts as a pane but is not
saved; a tab's title, state, color and ring come from its session panes (`terminal.md` for splits).

## Several windows (F25, 1.18)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
- **New window**: the `+` split-button menu's "New window" (M12) and `Ctrl+Shift+N` (K12, an
  application key, works in any window). It opens a window on the first project, in the file's
  order, that no window holds, with no tabs. When every project is held: a dialog, heading "New
  project", body "Every project is open in a window already; a new window needs a new project.",
  an entry (placeholder "Name"), Cancel / Save. Save creates the project (the create refusals
  apply, shown in an error dialog headed "No new window") and opens a window on it.
- Every window has the same layout and menus; its title is "Menkar"; default size 1280 × 800 (the
  size is not saved).
- Starting `menkar` while it runs brings the active window forward (single instance).
- The project dropdown, in every window, marks projects other windows hold ("open in another
  window"); choosing one brings that window forward.
- **Closing a window** (its close button or the system's):
  1. Unsaved file tabs ask first (`files.md`).
  2. With no running agent (no pane whose foreground process is something other than the shell),
     the window closes at once.
  3. Otherwise a confirmation: heading "Stop {n} running session(s)?", body the running panes'
     names joined by ", " (a session's name, or the agent's name for a pane with no session yet),
     a blank line, "Their conversations stay in Claude."; Cancel (default) / **Stop and close**
     (destructive). On confirm, the layout is recorded first (below), every tab is closed
     gracefully, and the window closes as soon as it has no tabs, or after 50 checks 300 ms apart
     (about 15 s) at most.
  - A window that closes while others remain leaves the saved layout. The last window keeps its own
    layout in the file, and closing it quits the app.

## Quitting (F27)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
There is no Quit command: closing the last window quits, through the confirmation above (1.13) —
running sessions are stopped and the layout of that last window is kept for the next start. Of the
earlier-closed windows nothing is kept. ("Restart now" in Preferences quits without asking,
`preferences.md`.)

## Reopening on start (F26)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
With "Reopen tabs on start" on (the default, `preferences.md`), the start reopens every saved
window with its shown project and its tabs; off, it opens one window on the file's `current`
project with no tabs (the saved windows are overwritten by the next save).

What reopens is computed by `src/core/projects/layout.ts` (`reopen`); `docs/projects.md` has the
rules.

Each window waits for the first scan of the transcripts, checks its file tabs off the UI thread, then
opens the tabs project by project in their saved order: each session is resumed (`terminal.md`) and
its second pane opened beside it (as M19); a saved vertical orientation is restored by swapping the
split; a session the scan does not know is skipped. Then the window shows its saved project.
Chat, replay and shell panes never reopen.

## An unreadable projects file (F28)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
When `projects.json` exists but is not JSON, or its shape is invalid (Data contracts), it is moved
aside — never deleted — and a fresh file with an empty Default starts. A toast that stays until
dismissed: "The projects file could not be read; it was kept as {name} and a new one started", with
{name} the moved file's name. (agent-tablet shows it in each window opened during that run.)

## The sidebar (F29)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
The sidebar and the content are separated by a draggable divider. The sidebar's width defaults to
300 px, cannot be dragged below 220 px, and does not grow when the window does. A drag is saved
(setting `sidebar_width`) 600 ms after it stops, only if the sidebar is visible and the width is at
least 150 px; every window opens with that width. `F9`, `Ctrl+B b` and the header's toggle button
(tooltip "Toggle sidebar (F9)") show and hide it (`look.md`).

## Files

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
| Path | What | Written |
|---|---|---|
| `$XDG_CONFIG_HOME/menkar/projects.json` (`~/.config/menkar/` when unset) | Projects, groups, members, the current project, the saved windows | Whole, through a temporary file in the same directory and a rename (`docs/foundations.md`, JSON state) |
| next to it, the moved-aside file | An unreadable `projects.json` | Renamed, never deleted. agent-tablet names it `projects.json.broken` (replacing an earlier one); Menkar's JSON-state rule names it `projects.json.broken-<yyyymmdd-hhmmss>` (`-2`, `-3`… if taken) |
| `$XDG_CONFIG_HOME/menkar/state.json` | Settings this area reads: `reopen_tabs` (bool, default `true`), `sidebar_width` (int px, default `300`) | `preferences.md` |

On the first start Menkar imports agent-tablet's `~/.config/agent-tablet/projects.json` read only
(F14, decision 1.8): the format below is the same, version 1, so it is read with the same rules.

## `projects.json`, version 1

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
```json
{
  "version": 1,
  "current": "3f9c0a1b2d4e",
  "projects": [
    {
      "id": "3f9c0a1b2d4e",
      "name": "Default",
      "members": ["0b6f2c9e-1d4a-4c3b-9a8e-5f7d6c2b1a00"],
      "groups": []
    },
    {
      "id": "a17e55c0de42",
      "name": "Client work",
      "members": [
        "5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c",
        "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
        "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
      ],
      "groups": [
        {
          "name": "api pair",
          "color": "#5ec4b6",
          "members": ["5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c", "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a"]
        }
      ]
    }
  ],
  "windows": [
    {
      "current": "a17e55c0de42",
      "tabs": {
        "a17e55c0de42": [
          {
            "panes": ["5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c", "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a"],
            "orientation": "horizontal"
          },
          { "file": "/home/demo/notes/plan.md", "preview": true }
        ],
        "3f9c0a1b2d4e": [
          { "panes": ["0b6f2c9e-1d4a-4c3b-9a8e-5f7d6c2b1a00"], "orientation": "vertical" }
        ]
      }
    }
  ]
}
```

Read and written by `src/core/projects/store.ts`; `docs/projects.md` has the read rule of each key,
the windows and tabs saved, the written form and a missing file.

**When it is written**: on every change to projects, groups or membership; on switching project
(`current`); and the layout 500 ms after the last change to any window's tabs (a tab opened,
closed, moved, retitled or changing state: the first change schedules one save 500 ms later, and
changes before it fires ride on it). The layout written is every open window's, except windows already confirmed
closing. Once the last window is closing, layout saves stop so the closing tabs do not erase it.

## Acceptance cases

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
The cases built in `core` (PRJ-3–10, 49–53, 55) and on screen (PRJ-11, 13, 14, 27, 45) left for the
history; the Vitest tests in `tests/core/projects/` and the e2e tests carry their ids.

PRJ-1. No `projects.json` → the window shows "Default" in the dropdown, an empty list titled
"Default has no sessions", and no file exists until the first change.

PRJ-2. `projects.json` is `{` (not JSON) → it is renamed aside (not deleted), the app starts with
one empty "Default", and a toast reads "The projects file could not be read; it was kept as
<moved name> and a new one started" until dismissed.

PRJ-12. Projects "Work" exists; create "work " → "There is already a project with that name."

PRJ-15. One project only; press its trash button → error dialog "The project was not deleted" /
"The last project cannot be deleted."

PRJ-16. Delete project P (2 members, 1 running in a tab) → dialog "Delete “P”?" with body "Its
sessions leave the list; their conversations stay in Claude. 1 running session(s) will be stopped
first."; Delete → the running session receives the agent's exit, its tab closes, P is gone, the
window shows the first project, and neither member is in any project.

PRJ-17. Delete project P while P is open in window 2 and has a running session there, pressing
Delete in window 1 → the confirmation counts that session, it is stopped in window 2, and window 2
shows the first remaining project.

PRJ-18. Window 1 shows A; window 2 holds B. In window 1, choose B in the dropdown → window 2 comes
forward; window 1 still shows A.

PRJ-19. Window shows A with tabs T1, T2 (T2 selected); switch to B (no tabs) → empty state "No
session open"; T1 and T2's agents keep running; switch back to A → T2 is selected.

PRJ-20. Project with groups "api pair" (S1, S2) and loose S3 → the list shows heading "● api pair",
S1, S2, heading "No group", S3. With no groups, S1–S3 show with no heading.

PRJ-21. Members in `/home/demo/todo-api` and `/home/demo/site` → each row has its folder's basename
under the name; when all members share one folder, no row shows a folder.

PRJ-22. Row menu → Group → New group… "pair" for S3 in a project with 1 group → group "pair" is
created with color `#c17be0`, S3 alone in it; a second New group "pair" → error "The group was not
created" / "There is already a group with that name."

PRJ-23. Group "solo" holds only S1; choose Group → No group for S1 → the heading "solo" disappears
and the file has no group "solo".

PRJ-24. S1 is in group G1; choose Group → G2 → S1 leaves G1 and is last in G2.

PRJ-25. Remove from project a stopped session → it leaves the list at once with no dialog, and
leaves its group.

PRJ-26. Remove from project a running session → "Remove “<name>” from the project?" / "It is
running, so it is stopped first. Its conversation stays in Claude."; "Stop and remove" → the tab
closes after the agent exits; the session is in no project; Cancel → nothing changes.

PRJ-28. Open beside with tab T (S1 alone) selected and S2 stopped → T has two panes side by side,
S2 resumed in the right one with focus, title "S1 │ S2".

PRJ-29. Open beside with S2 running alone in its own tab U → U disappears, S2's pane (same process,
not restarted) is in T beside S1.

PRJ-30. Open beside on a tab that has two panes → toast "A tab holds two panes at most"; nothing
else changes.

PRJ-31. Open beside for a session of another project → toast "It belongs to another project; add it
here first".

PRJ-32. Open beside for S2 running in a two-pane tab → toast "It is already beside another session".

PRJ-33. Open beside while a file tab is selected → it acts as Open (a new tab for the session).

PRJ-34. Add session → Existing, pick S which runs alone in a tab in window 2 (project B) → the tab
moves to the end of window 1's strip (shown project A), selected, its agent not restarted; S is in A
only; window 2 shows its remaining B tabs or "No session open".

PRJ-35. As PRJ-34 but S shares a two-pane tab in window 2 → toast "It shares a tab with another
session there"; S stays in B and in its tab.

PRJ-36. Start a new session from New in project A and close its tab before typing → A's members do
not change. Type one message, then close → the session joins A.

PRJ-37. Start a new session in window 2 (showing B) after choosing A last in window 1 → once it has a
typed message, it joins B.

PRJ-38. Strip with T1, T2, T3 of the shown project (T3 selected) and T4 of another project in the
same window → `Ctrl+Tab` selects T1; `Ctrl+Shift+Tab` from T1 selects T3; T4 is never selected.

PRJ-39. `Ctrl+B 2` → T2 selected; `Ctrl+B 7` with 3 tabs → nothing.

PRJ-40. One tab only; `Ctrl+PgDn` → nothing changes.

PRJ-41. Middle click a tab → it closes (gracefully, if running). Right click → menu Rename…, Copy
session ID, Swap the split's orientation, Close.

PRJ-42. Rename… on a file tab with text "" → the title is unchanged; with "Notes" → the tab reads
"Notes"; after a restart the file tab has its file's name again.

PRJ-43. Window with one tab of A and one of B (shown A) → the "Close all tabs" button is visible;
pressing it closes both.

PRJ-44. Three projects, window 1 holds the first, `Ctrl+Shift+N` → a window opens on the second, no
tabs. All three held → the "New project" dialog; Save "Ops" → window on "Ops"; Save "" → error
dialog "No new window" / "A project needs a name.".

PRJ-46. Close a window with no running agent → it closes with no dialog.

PRJ-47. Two windows; close window 2 (which held B's tabs), then close window 1 (A, tabs T1, T2) →
the saved `windows` has one entry for A with T1, T2; next start opens one window on A with T1, T2
resumed and nothing of B.

PRJ-48. Saved window with a tab `{"panes": ["S1","S2"], "orientation": "vertical"}` → reopens one
tab with S1 above S2.

PRJ-54. A fork tab, a chat tab and a replay tab open at close → none is in the saved `windows`.

PRJ-56. Drag the sidebar to 360 px → after 600 ms `sidebar_width` is 360; a new window opens with a
360 px sidebar. Hide the sidebar → the width is not overwritten.

PRJ-57. A member whose transcript was deleted → no row; the dropdown's count still includes it.

## Look

> Left on 2026-11-08: built and tested by plan 15, described in `docs/projects.md`.
Screenshots (dark theme, demo data; light copies under the same names with `-light`):

- `img/project-list-dark.png` — the sidebar with the dropdown "Client work", a group heading "api
  pair" (teal ●), two rows with folder lines, the "No group" heading and one row; the "Add session"
  button at the bottom; the empty content "No session open".
- `img/project-dropdown-dark.png` — the dropdown's popover: three projects, the check on the shown
  one, member counts, pencil and trash buttons, the "New project name" entry and the accent
  "Create" button.
- `img/open-tab-dark.png`, `img/tab-ring-dark.png` — a selected tab on the strip: the group ●, the
  context ring, the title, the ×, then "+".
- `img/tab-menu-dark.png` — the tab menu (here on a file tab with a local title).
- `img/two-windows-dark.png` — a second window on another project.

Measurements (from the code; "TUI" is the default terminal-workspace style, "Classic" the plain
style — `look.md` has the palette tokens; Catppuccin Mocha / Latte values given for TUI dark / light):

| Element | Classic | TUI |
|---|---|---|
| Dropdown button | full width of the sidebar header, padding 4 px 8 px; content spacing 6 px: name (bold heading style, ellipsized), badge, down arrow (`pan-down-symbolic`) | same; on the header color (mantle `#181825` / `#e6e9ef`) |
| Dropdown popover | content min width 280 px, spacing 6 px; rows: spacing 6 px, side margins 4 px; check `object-select-symbolic` (transparent when not current); count dim; pencil `document-edit-symbolic` and trash `user-trash-symbolic` flat buttons; "open in another window" dim caption; error label in the error color | rows square-cornered |
| Blocked badge | bg `#e01b24`, white text, radius 9 px, padding 0 6 px, smaller bold text | bg red (`#f38ba8` / `#d20f39`), text mantle color |
| Group heading | padding 10 px 10 px 4 px 10 px; spacing 8 px; ● in the group color; name in caption-heading style, dim | dim color overlay0 (`#6c7086` / `#9ca0b0`) |
| Session row | margins 6 px top/bottom, 10 px left, 4 px right; spacing 8 px; state dot; name bold, folder dim caption; ring; ⋯ (`view-more-symbolic`, flat, tooltip "Actions for {name}") | rows square, text subtext0 color, on mantle |
| Empty list | status page, compact, icon `view-list-symbolic`; pill "Add session" accent | — |
| "Add session" button | margins 6 px top/bottom, 8 px sides | — |
| Tab strip | padding 3 px 6 px; tabs spacing 2 px | bg window color, padding 2 px 6 px 0 6 px |
| Tab | padding 2 px 10 px; content spacing 6 px; title max 28 chars; unselected labels at 60 % opacity; selected: bg `#D97757` at 22 %, a 3 px `#D97757` bottom inset line, bold label | radius 0, min height 22 px, bg surface0 (`#313244` / `#ccd0da`), text subtext0 (`#a6adc8` / `#6c6f85`); selected: bg accent (`#cba6f7` / `#8839ef`), text the window background color; labels full opacity |
| Tab close | icon `window-close-symbolic`, padding 2 px, right margin −4 px, round, 70 % opacity, 100 % on hover with bg currentColor at 15 %; pointer cursor | same |
| "+" on the strip | a flat "+" text button | same |
| Close all tabs | header button, bundled icon `tab-close-symbolic` | same |
| Sidebar | default 300 px, min 220 px | bg mantle |
| Window | 1280 × 800 default; title "Menkar" | header min height 34 px |
| Toasts | 4 s for refusals ("A tab holds two panes at most" …); the projects-file toast stays until dismissed | same |

Status dots on rows and tabs: `agent-state.md`, Look.

## Projects, tabs and windows

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
start, and quitting. It holds agent-tablet's decisions 1.13, 1.15–1.19. Index rows: **F5** (the
cross-window move; the dialog itself is in `sessions.md`), **F20** (what a tab's panes mean for a
window; a project is open in at most one window.** Where agent-tablet's code breaks one of them,
the case says so and gives the behaviour that keeps it.
