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
