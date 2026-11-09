# History of `docs/spec/remote-control.md`

## Acceptance cases

> Left on 2026-11-08: built by plan 13, described in `docs/files.md` and `docs/sessions.md`.
- **RC-1** Add session → New, Claude Code, name `JWT auth`, switch on, Start session with app-chosen
  id `5e0a…` → `remote_control` in `state.json` contains `5e0a…` immediately; the command contains
  `--remote-control='JWT auth'` before `--settings`.
- **RC-2** Open New again after RC-1 → the switch is off.
- **RC-5** Session `9c1b…` named `billing` in the list, opened → command
  `{cli} --resume 9c1b… --remote-control=billing --settings {settings} && exit`.
- **RC-6** Session not in the list, opened → no `--remote-control` in its command.
- **RC-7** Session in the list with no `custom-title`, no app name, no `ai-title`, first message
  `fix the login bug` → `--remote-control='fix the login bug'`.
- **RC-8** The name computation given a blank name `"  "` and folder `/home/ana/src/shop` → `shop`;
  given a blank name and no folder, id `d4e5f6a7-…` → `d4e5f6a7`.
- **RC-9** Session in the list named `  spaced  ` → `--remote-control=spaced` (trimmed).
- **RC-10** Session named `-x` → the argument is `--remote-control=-x`, one word.
- **RC-13** Row menu of a Claude Code session → the section `Open`, `Open beside the current tab`,
  `Stop`, `Remote control` (check). Row menu of a Cursor session → no `Remote control`.
- **RC-15** Check `Remote control` in the row menu → the tab menu's item for that session is checked
  too, and `state.json` lists the id.
- **RC-16** Running session started without the flag, check `Remote control` → toast
  `Remote control connects when this session restarts, or type /rc in it` for 6 s; nothing typed
  into the terminal; row icon tooltip `Remote control from this session's next start, or type /rc in it`.
- **RC-22** `state.json` with `"remote_control": ["a", 3, null]` → only `a` is on; on the next save
  the list is `["a"]`.
- **RC-23** `state.json` with no `remote_control` key → every session is off.
- **RC-24** Toggling writes `state.json` sorted: turning on `b` then `a` → `["a", "b"]`.

## Who can have it

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
- **Claude Code sessions only.** Cursor has no such flag: Cursor sessions have no switch, no menu
  item and no icon.
- **Starts it applies to:** a new session started from New with the switch on; every resume of a
  session whose Remote Control is on — opening it, Open beside the current tab, reopening tabs on
  start, Add session → Existing.
- **Starts it never applies to:** a fork (a new session; its source's setting is not carried, and
  the fork's id is not added to the list); Continue last (the session it continues is not known
  beforehand); the advanced new session unless the switch on New is turned on (the advanced flow
  ends on New, so the switch is there); a split shell; the native chat tabs and Open in Ghostty
  (`chat.md`).

## On from New (the switch)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
- On Add session → New, at the name step, a switch row `Remote control — phone and claude.ai`,
  under the Agent row.
- **Off every time the page opens** (the human, 2026-11-07): a session is connected on purpose.
- Shown only while the chosen agent supports it: choosing Cursor in the Agent row hides it and
  turns it off; choosing Claude Code again shows it, off.
- `Start session` with the switch on: the new session's id (chosen by the app) is added to the
  Remote Control list **at once**, before Claude has created the session, and the session starts
  with `--remote-control=<its name>` (the name typed on New).

## On or off from a menu (M17, M21)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
- **Row menu** (M21): in a project-list row's menu (⋯ or right-click), in the first section after
  `Open`, `Open beside the current tab`, `Stop`, a check item `Remote control`, checked when the
  session is in the list. Shown when the session is a known Claude Code session.
- **Tab menu** (M17): in a tab's right-click menu, a second section holding the check item
  `Remote control`, below `Rename…`, `Copy session ID`, `Swap the split's orientation`, `Close`.
  Shown only when the tab holds **exactly one** session (a split shell does not count; two sessions
  side by side: no item) and that session is Claude Code. A new session's tab gets the item once
  the session has joined its project (before that it has no session id); a fork's tab, likewise,
  once it has joined.
- Both items reflect the same state: toggling one changes the other, in that window.
- **Toggling saves at once** (`state.json`) and refreshes the row's icon and the tab strip.
- **Turned on while the session runs** in a pane that was not started with it: a toast
  `Remote control connects when this session restarts, or type /rc in it` (6 s). Nothing is typed;
  the session connects at its next start, or now if the user types `/rc` (`/remote-control`) in
  it themself.
- **Turned on while running and already started with it** (it was turned off and on again): no
  toast.
- **Turned on while not running**: no toast; it takes effect at the next open.
- **Turned off**: no toast. It takes effect from the session's next start: the running process
  stays connected until it ends (the CLI cannot disconnect a running session without driving its
  dialog by keystrokes, which breaks the day the dialog changes).

## The name it connects under

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
The session shows on the phone and claude.ai under, in order of preference:

1. the name the app shows for it, trimmed (`sessions.md`: Claude's name `custom-title`, else the
   name set in the app for a session Claude never named, else `ai-title`, else the first typed
   message's preview, else the first 8 characters of the id);
2. else (that name is blank) its folder's name (the last component of its working folder);
3. else the first 8 characters of its session id.

Since the display name itself ends in the id, steps 2 and 3 are reached only for a name made of
spaces; a new session uses the name typed on New, which is required.

Never empty: given no name, the CLI would make one up. The name is computed at each start, so a
session renamed in the app connects under the new name at its next start; a `/rename` inside a
running session does not change the remote name until then (checked behaviour of the CLI).

## The phone icon on the row

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
On the project list (`sessions.md`, `look.md`), a session row shows a phone icon after its status
dot, before its name, with a tooltip:

| Session in the list | Running in a pane started with Remote Control | Running in a pane started without | Not running |
|---|---|---|---|
| **yes** | `Remote control on` | `Remote control from this session's next start, or type /rc in it` | `Remote control on` |
| **no** | `Remote control until this session restarts` | no icon | no icon |

"Running" is `terminal.md`'s: the pane's shell has a foreground command (the agent). "Started with
Remote Control" is a property of the pane, set when it started with the flag and kept until the
pane goes. The tab shows no icon (the human, 2026-11-07); the history rows of Add session → Existing
show none.

## What it does not do

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
- It does not read whether Claude Code reports the session connected
  (`replBridgePlaceholders` in `~/.claude.json` is the agent's own, undocumented).
- It does not remove an id from the list when the session is trashed, deleted, removed from its
  project, or when a new session with the switch on is closed before it has a typed message (and so
  never joins): the id stays in the list, harmlessly.
- Its time and tokens count as any other session's (`usage.md`): its own process writes the
  transcript.

## The CLI flag

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
| Flag | Checked behaviour (Claude Code 2.1.319, 2026-11-07) |
|---|---|
| `--remote-control [name]` | the name is optional to the CLI, so the app always passes one; passed as **one argument**, `--remote-control=<name>` (accepted), so a name starting with `-` is not read as the next flag |
| inside a session: `/remote-control`, `/rc` | connects the running session on the spot (typed by the user, never by the app) |
| `/rename` inside a session | does not change the remote name, which is the one given at start |

On the command line (`terminal.md`), it comes after the identity flags and before `--settings`:

- New: `{cli} [options] --session-id {id} -n {name} --remote-control={rc name} --settings {settings}`
- Resume: `{cli} --resume {id} --remote-control={rc name} --settings {settings}`

`{rc name}` is shell-quoted as a whole word when needed: `--remote-control='JWT auth'`.

## `state.json`

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
| Key | Type | Default | Meaning |
|---|---|---|---|
| `remote_control` | array of strings (session ids), written sorted | `[]` | sessions started and resumed with Remote Control |

Reading: entries that are not strings are dropped; a missing key is the empty list. The file is
written whole through a temporary file and a rename (Menkar's JSON state rule). In Menkar the file
is `$XDG_CONFIG_HOME/menkar/state.json`; on first start the list is imported from agent-tablet's
`$XDG_CONFIG_HOME/agent-tablet/state.json` (`remote_control`), read only (Menkar 1.8).

## Per running pane

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
| Field | Meaning |
|---|---|
| remote name | the `{rc name}` the pane started with, or none |
| live | true from a start with the flag until the pane goes; drives the icon's tooltip and the toast |

## Acceptance cases

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
The cases built and tested (RC-1, 2, 5–10, 13, 15, 16, 22–24) left for the history; the tests carry their
ids.

- **RC-3** On New, choose agent Cursor → the switch row is hidden; choose Claude Code → shown, off.
- **RC-4** Only Cursor installed → New shows no Agent row and no switch.
- **RC-11** Fork of a session in the list → no `--remote-control`; the fork's id is not added to the
  list.
- **RC-12** Continue last → no `--remote-control`.
- **RC-14** Tab menu of a tab holding one Claude Code session → a second section with `Remote control`;
  of a tab with two sessions side by side → none; of a tab with a session and a shell → present; of a
  file tab → none; of a new session's tab before its first message → none.
- **RC-17** Stopped session, check `Remote control` → no toast; icon tooltip `Remote control on`;
  the next open carries the flag.
- **RC-18** Running session started with the flag, uncheck → no toast; the id leaves the list; icon
  tooltip `Remote control until this session restarts`; close and reopen → no icon, no flag.
- **RC-19** Running session started with the flag, uncheck then check → no toast; tooltip
  `Remote control on`.
- **RC-20** Session not in the list and not running → no phone icon on its row.
- **RC-21** Session in the list, renamed in the app from `api` to `api v2` while running → still
  connected as `api` (the CLI's); the next start passes `--remote-control='api v2'`.
- **RC-25** Session in the list trashed → its id stays in `remote_control`.
- **RC-26** Reopen tabs on start with a session in the list → the resumed tab carries the flag; Open
  beside the current tab with it → the pane carries the flag.
- **RC-27** First start of Menkar with agent-tablet's `state.json` listing `["7f3a…"]` → Menkar's
  list holds `7f3a…`; agent-tablet's file is unchanged.

## Look

> Left on 2026-11-08: built and tested by plan 15, described in `docs/sessions.md`.
- `img/new-remote-switch-dark.png` (light: `img/new-remote-switch-light.png`) — Add session → New at
  the name step: the chosen folder row (folder icon, name, path, `Change`), the `Name` entry row,
  and the `Remote control — phone and claude.ai` switch row, off; `Start session` below, right
  aligned.
- `img/remote-control-menu-dark.png` (light: `img/remote-control-menu-light.png`) — after checking
  Remote control on a running session: the toast
  `Remote control connects when this session restarts, or type /rc in it` at the bottom of the
  content, and the phone icon on the `JWT auth` row, between the status dot and the name.
- `img/tab-menu-dark.png` — the tab menu's first section; the Remote control section follows it
  for a tab of one Claude Code session.

Measurable details:

- **Switch row**: a standard switch row in the New page's boxed list, the last of its rows (folder,
  Name, Agent when more than one agent is installed, Remote control).
- **Menu items**: a check item (a check mark when on) labelled `Remote control`; in the row menu, in
  the same section as Open / Open beside / Stop; in the tab menu, alone in its own section after a
  separator.
- **Phone icon**: the symbolic "phone" icon (a handset/smartphone outline; `phone-symbolic`), the
  dim (secondary text) color, vertically centered, in the row's horizontal box with 8 px spacing
  after the status dot and before the name/folder text. Its tooltip is the row-table string above.
- **Toast**: the window's standard toast at the bottom of the content area, with a close (×)
  button, 6 s.
