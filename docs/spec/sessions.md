# Sessions

Finding every session the installed agents have on disk (Claude Code's and Cursor's), the name a
session shows, the history browser and its rows (the **Existing** page of Add session), the
project list's rows as far as the session goes, a session's details, export as Markdown, replay,
copy ID and reveal, hide / unhide, move to trash, delete permanently, select mode, the **New** page
of Add session, and the one-time import of agent-tablet's own data on Menkar's first start.
Index rows: **F1–F14** (F5 shared with `projects.md`; F14 replaced, see "First start"), **K1, K2,
K28, K32**, **M2, M7, M14, M26–M31, M33, M37–M45**. What a tab runs (commands, flags) is in
`terminal.md`; the agent states and the dot colors of a running session in `agent-state.md`; the
context ring in `context.md`; Remote Control in `remote-control.md`; projects, groups and windows
in `projects.md`; the Ghostty, fork and chat items of the history menu (M34–M36) in `chat.md` and
`terminal.md`.

## Behaviour

### Discovery (F1)

- Built: `docs/sessions.md` describes how; `src/core/sessions/` holds it. It covers which files are sessions, what a scan reads, the live updates, and one scan for every window.
- The history's refresh button (tooltip "Refresh session list") rescans at once. A rescan asked
  while one runs is dropped in agent-tablet (so an event during a long scan can be missed until the
  next one); Menkar runs one more scan after the running one instead.

### A session's name (F2)

- Built: `docs/sessions.md` describes how; `src/core/sessions/` holds it. It covers the name's precedence, incremental reading, and Cursor's names.
- **Rename** (history row ✎ button, M26, M37): if the session has a Claude name, the app refuses
  with an error dialog — heading "This name comes from Claude", body "Change it with /rename inside
  the session; the list follows on its next refresh.", button "OK". Otherwise the rename dialog:
  heading "Rename session", body the session's preview (or its id when it has none), an entry with
  the current app name (empty if none) and placeholder "Custom name", buttons "Cancel" and "Save"
  (suggested, the default: Enter saves). Save trims the text; an empty name removes the app's name
  (the session falls back to Claude's generated title, preview or id). The row and the session's
  tab title change at once.
- A name set in the app never reaches Claude: nothing is written to the transcript.

### Waiting and interrupted badges (F3)

- Built: `docs/sessions.md` describes how; `src/core/sessions/` holds it. It covers which lines decide waiting and interrupted, and Cursor.
- Waiting shows a question-mark icon in amber with tooltip "Claude is waiting for your reply";
  interrupted a stop icon in red with tooltip "You interrupted Claude here". The same strings are
  used for Cursor sessions.

### The history browser (F4)

The **Existing** page of Add session. Top: a search entry (placeholder "Search sessions…"), then
four flat icon buttons: collapse all (tooltip "Collapse all groups"), expand all ("Expand all
groups"), select mode toggle ("Select sessions"), refresh ("Refresh session list"). Then the list,
then (in select mode) the selection bar, then the count line.

- **Groups by folder.** Sessions are grouped by their folder's name: the last component of `cwd`
  (the whole `cwd` when that is empty, e.g. `/`; when the transcript has no `cwd`, the name of the
  directory holding the transcript). Two different folders with the same last name share one group.
  Groups are ordered by their most recent session; sessions inside a group newest first.
- **Group header row**: an arrow (pointing right when collapsed, down when expanded), a folder
  icon, the folder name in UPPERCASE, and the number of sessions in the group in a badge. Clicking
  the header toggles the group.
- **Collapsed by default**: a group is collapsed the first time it appears in this browser; a group
  the user expanded or collapsed keeps that state across live refreshes while the dialog lives.
  Collapse all / expand all set every group.
- **Search**: the query is trimmed and lowercased; a session matches when the query is a substring
  of the lowercased "name + folder name + preview + session id". While a query is typed the
  collapsed state is ignored: every matching row shows, and only the headers of groups with a match.
  The header's count does not change with the search.
- **Hidden sessions** are left out unless "Show hidden sessions" (M2) is checked (F11).
- **Count line** at the bottom: "{n} sessions · {n} projects · {size}", plus " · {n} open" when at
  least one session has a tab. It counts **every** discovered session, hidden ones included;
  "projects" here is the number of distinct folder names; size is the sum of the transcripts'
  sizes (see Data contracts for the format). The index lists "N sessions · N projects · N open";
  the code also shows the size.
- **Empty**: when no session is discovered at all, a page with a folder icon, title "No sessions
  found" and description "Run claude in a project directory first — sessions will appear here
  automatically."
- K2 (`Ctrl+Shift+F`) opens Add session on Existing. agent-tablet calls nothing to focus the search
  entry; Menkar puts the focus in it, as the shortcut's purpose says.

### A history row

Top line, left to right: the selection check (select mode only), the status dot, the agent's icon
(tooltip the agent's name, "Claude Code" or "Cursor"), the name (bold, ellipsized at the end), the
waiting / interrupted badge (F3), a flat ✎ button (tooltip "Rename session"), and the **pick
button** (F5). Below:

- a subtitle "{folder name} · {last active}", where last active is relative to now: under 60 s
  "just now", under an hour "{m}m ago", under a day "{h}h ago", under 7 days "{d}d ago", else the
  date `YYYY-MM-DD` (agent-tablet does not translate these; Menkar does, through `t()`);
- the folder path, only when Preferences' "Show folder path" is on and the session has a `cwd`:
  the home folder written as `~`, ellipsized at the **start** so the last folder stays visible;
- the preview, hidden when empty, ellipsized at the end.

The status dot says whether the session has a tab in a window: none (a faint dot), **open** (it
has a tab), **attention** (its tab asks for attention). Colors in Look.

Activating a row (a click): in select mode it toggles the row's check; otherwise it does what the
pick button does when that button is enabled, and nothing when it is disabled. Right-click opens the
history row menu.

### The history row menu (M33–M45)

Three sections:

1. **Open** (M33), **Open in Ghostty** (M34, only when `ghostty` is on the `PATH`), **Fork
   session** (M35, Claude only), **Continue in chat** / **Continue in chat ({mode})** (M36, one per
   chat variant of the agent).
2. **Rename…** (M37), **Details…** (M38), **Replay…** (M39), **Copy session ID** (M40), **Export
   as Markdown…** (M41), **Reveal transcript** (M42).
3. **Hide session** or **Unhide session** (M43, by the session's current state), **Move transcript
   to trash…** (M44), **Delete permanently…** (M45).

**Open** puts the session in a project and opens it (`terminal.md` for the command):
- not in any project → it joins the window's current project, then opens in a tab here;
- already in the current project → its tab is selected if it has one, else a tab opens;
- in another project → that project is shown (if another window holds it, that window comes
  forward and the session opens **there**). agent-tablet's code, in that last case, brings the
  other window forward and still opens the tab in the current window, under the current project,
  which breaks "a project is open in at most one window"; Menkar follows the rule.

### Add session → Existing: Add, Added, Move from (F5)

The dialog's title is "Add a session to {project name}". Each history row's pick button says:

| The session's project | Button | Enabled |
|---|---|---|
| none | "Add" | yes (suggested style) |
| the current project | "Added" | no (flat) |
| another project, named P | "Move from P" | yes (suggested style) |

Picking (the button or a click on the row):
- If the session has a tab in **another window**, its tab moves into this window, still running,
  and is selected. If that tab holds a second session, nothing moves and nothing changes; a toast
  says "It shares a tab with another session there" for 4 s.
- The session joins the current project; leaving its previous project also takes it out of the
  previous project's group. A tab it has in this window now belongs to the current project.
- `projects.json` is saved; every row's button is recomputed. **The dialog stays open** and the
  session is not started: Add only puts it in the project.

### Add session → New (F6, K1, K28, M7)

Opened by the header's `+` button click, `Ctrl+Shift+T` (K1), `Ctrl+B c` (K28, "new session in
this project"), and "New {agent} session…" in the `+` menu (M7, one item per installed agent, which
also preselects that agent). The sidebar's "Add session" button, `Ctrl+B N` (K32) and K2 open the
same dialog on Existing. The page has two steps.

**Step 1 — the folder.** A search entry (placeholder "Search folders…") over a list of folders:
every distinct `cwd` of the discovered sessions (hidden ones included), the most recently used
first (by each folder's newest session). Each row: a folder icon, the folder's name (bold), and
below it where it is (its parent, with the home folder as `~`, ellipsized at the start). The last
row, always shown whatever the search, is "Another folder…" with an open-folder icon. Typing
filters by a case-insensitive substring of the full path; Enter chooses the first folder shown.
"Another folder…" opens a folder chooser titled "Choose a folder"; cancelling leaves the list.
Choosing a folder moves to step 2.

**Step 2 — the name.** A form described "The name is Claude's own: sessions find each other by
it.":
- the chosen folder (folder icon, its name, its parent below) with a flat "Change" button that goes
  back to step 1;
- "Name", an entry; Enter in it starts the session;
- "Agent", a dropdown of the installed agents, shown only when more than one is installed;
- "Remote control — phone and claude.ai", a switch, **off every time the page opens**, shown only
  when the chosen agent supports Remote Control (Claude Code); choosing an agent without it hides
  and turns off the switch;
- an error line (red, wrapping, hidden until needed);
- "Start session", a pill button in the suggested style, aligned right.

**Skipping step 1.** When Preferences' remembered folder (`new_session_dir`) names a directory
that exists, or the dialog is opened with a folder (the advanced new session, `terminal.md`), the
New page opens directly on step 2 with that folder.

**Start session**: the name is trimmed.
- Empty name → the error line "Give the session a name: sessions find each other by it."
- Folder no longer a directory → "That folder does not exist."
- Otherwise the dialog closes, the folder is remembered as `new_session_dir`, and a tab titled with
  the name starts a new session there with an id the app picks and the name (`terminal.md`). With
  the switch on, the new id joins `remote_control` before the start.
- With no agent installed nothing starts.

**Joining the project** (agent-tablet's decision 1.16): the new session joins the project that was
current when it started — or the current project, if that one was deleted meanwhile — on the first
rescan where its transcript exists **and has a preview** (a message the user typed). A tab closed
before that leaves nothing in the project. Fork and "Continue last" join the same way
(`terminal.md`).

### The project list's rows (the session's part)

The sidebar lists the current project's sessions (layout and groups in `projects.md`). Each row:
the state dot (`agent-state.md`; "stopped" when it has no tab; the dot's tooltip is the state
word), a phone icon when Remote Control is on (`remote-control.md`), the session's name (F2, bold),
below it the folder name only when the project's sessions come from more than one folder, the
context ring (`context.md`), and a flat ⋯ button (tooltip "Actions for {name}") that opens the
session row menu; right-click opens the same menu. A single click selects the session's tab when
it has one; a double click opens it. A member whose transcript is no longer discovered (trashed,
deleted, its agent uninstalled) is not shown, but stays a member in `projects.json`. Hidden
sessions are shown here: hiding acts on the history only.

The session row menu's items specified here: **Rename…** (M26), **Details…** (M27), **Replay…**
(M28), **Copy session ID** (M29), **Export as Markdown…** (M30), **Reveal transcript** (M31); the
others (Open, Open beside, Stop, Remote control, Group, Remove from project) in `projects.md`,
`terminal.md` and `remote-control.md`.

### Session details (F7, M27, M38)

A dialog titled "Session details", 480 × 560 px. Its header shows the session's name as title and
its folder name as subtitle. While the whole transcript is read off the UI path it shows one row
"Reading transcript…" with a spinner; then these rows (each a title with its value below):

| Row | Value | Shown |
|---|---|---|
| "Agent" | "Claude Code" or "Cursor" | always |
| "Session ID" | the full id | always |
| "Directory" | the `cwd`, or "unknown" | always |
| "Created" | the first `timestamp` in the file, local time `YYYY-MM-DD HH:MM` | when there is one (never for Cursor) |
| "Last activity" | the last `timestamp`, same format | same |
| "Messages" | "{u} user · {a} assistant" | always |
| "Tool calls" | the count of `tool_use` blocks | when more than 0 |
| "Models" | the distinct `message.model` values, sorted, comma-separated | when any |
| "Tokens" | "{in} in · {out} out · {cache} cache-read" | when any is more than 0 |
| "Transcript size" | the file's size | always |

- Counting (Claude): a *user message* is a `user` line whose text (string content or joined `text`
  blocks), trimmed, is not empty and does not start with `<` (tool results and injected content are
  not messages). An *assistant message* is every `assistant` line. A model starting with `<` is
  ignored.
- Claude Code writes one transcript line per content block of a response, so the assistant count
  counts lines, and agent-tablet's token sums add the same response's usage once per line.
  **Menkar takes the Tokens row from its usage module**, deduplicated as `usage.md` defines, so the
  details and the Usage window agree.
- **MCP** section (title "MCP"), shown when servers are configured or used: "Available to this
  project" — the server names from `~/.claude.json` (`mcpServers` at the top level, plus
  `projects[<cwd>].mcpServers`), sorted, comma-separated, "—" if none (Claude only; Cursor shows
  "—"); "Tools used in this session" — "{server}: {count}" joined by " · ", most used first, "—" if
  none. A tool named `mcp__<server>__<tool>` counts for `<server>`.
- **Recent activity** section: the last **12** messages, oldest first, each titled "You" or the
  agent's name, with its text whitespace-collapsed and cut to **500** characters (Claude), wrapping
  without truncation in the row. For Claude, assistant lines with text count; for Cursor, every
  `user` / `assistant` line with text, the user's stripped of `<user_query>` tags, not cut.
- Cursor: "Messages" counts every `role: user` and `role: assistant` line; there are no timestamps,
  models, tokens or tool calls, so those rows are absent.
- README says the details show "usage"; the code shows the token row, not a usage section.

### Export as Markdown (F8, M30, M41)

- A save dialog titled "Export session as Markdown", proposing `{safe name}.md`: the session's
  name with every character that is not a letter, digit, space, `-` or `_` replaced by `_`,
  trimmed, or `session` when nothing is left. The dialog asks before replacing a file.
- The file is written off the UI path, UTF-8, in this format (`{…}` filled in; lines in brackets
  only when the value exists):

  ```
  # {name}

  - **Session:** `{session id}`
  [- **Project:** `{cwd}`]
  [- **Created:** {first timestamp, as written in the transcript}]
  [- **Last activity:** {last timestamp, as written}]

  ---

  {turns, separated by one blank line}
  ```

  and a final newline. Each turn is `### You` + blank line + the user's full text (a `user` line
  whose trimmed text is not empty and does not start with `<`), or `### Claude` + blank line + the
  assistant line's text, then, if the line has `tool_use` blocks, a blank line and
  `*Used `Name1`, `Name2`*`. An assistant line with neither text nor tools adds nothing. With no
  turns the body is `_No messages._`.
- Export reads Claude's format only: a Cursor session exports as `_No messages._`. Menkar exports
  Cursor sessions with the same rules applied to `role` lines (found in the code: agent-tablet's
  export of a Cursor session is empty).
- A failure shows an error dialog headed "Export failed". agent-tablet puts the system's error text
  in the body; Menkar shows its own sentence, "The file could not be written. Check that the folder
  exists and that you can write to it.", and logs the error.

### Replay (F9, M28, M39)

- Opens a tab titled "Replay — {name}" in the current project. A replay tab is not a member and is
  not reopened on start. The transcript is read once, whole (not followed live); Menkar reads it
  off the UI path.
- A toolbar: Previous (skip-backward icon, tooltip "Previous"), Play / Pause (play icon, tooltip
  "Play"; a pause icon while playing), Next (skip-forward icon, tooltip "Next"), "Show all", and on
  the right a dim "{shown} / {total}". Below, the turns as chat bubbles.
- It opens with the **first** turn shown. Next adds one turn, Previous removes the last one shown,
  Show all shows every turn, Play adds one turn every **800 ms** until the end, then stops. The view
  scrolls to the newest turn shown. Previous is disabled at 0; Next and Show all at the end; Play
  at the end unless playing. Closing the tab stops the playing.
- A transcript with no turns shows "Nothing to replay yet." and disables every control.
- **Turns** (Claude), in file order:
  - a `user` line: its text (string, or `text` blocks joined by spaces), trimmed, when not empty and
    not starting with `<` → a user bubble;
  - an `assistant` line: its `text` blocks gathered into one bubble, closed at each `tool_use`
    block and at the end; a bubble whose text is exactly "No response requested." or "(no content)"
    is dropped; `thinking` and other blocks are skipped;
  - a `tool_use` block → a tool chip "🔧 {summary}": for `Edit`, `Write`, `Read`, `NotebookEdit`,
    "{tool} {file name of `file_path` or `notebook_path`}"; for `Bash`, "Bash: {the command,
    whitespace-collapsed, first 60 characters}"; for `Grep`, `Glob`, "{tool} {pattern}"; for
    `Task`, "Task: {description}"; any other, the tool's name (also when the input names nothing);
  - an `AskUserQuestion` `tool_use` → an assistant bubble: "❓ {header, or 'Question'}", then the
    question, then "- {label}" per option, of its first question only.
- **Turns** (Cursor): each `user` / `assistant` line's text, the user's stripped of `<user_query>`
  tags, trimmed, when not empty and not starting with `<`.
- "Open session file…" (M1, `files.md`) opens a chosen `.jsonl` as a replay too.

### Copy session ID and reveal transcript (F10, M14, M29, M31, M40, M42)

- **Copy session ID** puts the full id on the clipboard; nothing is shown. From the tab menu (M14)
  it copies the id of the tab's first pane; a new session that has no transcript yet, and a tab
  that is not a session, copy nothing.
- **Reveal transcript** opens the folder holding the transcript in the file manager, with the file
  selected where the file manager supports it.

### Hide and show hidden (F11, M2, M43)

- **Hide session** adds the id to `hidden` in `state.json` at once, without asking; the row leaves
  the history. **Unhide session** removes it. Hidden sessions stay in their project's list, keep
  running, and still count in the history's count line.
- **Show hidden sessions** (main menu, a check, M2) shows hidden sessions in the history with the
  others, unmarked; their menu says "Unhide session". It starts unchecked on every start and is not
  saved. In agent-tablet the check belongs to each window while the list it filters is shared, so
  checking it in one window shows hidden sessions in every window's history; Menkar applies it to
  the history of the window where it was checked.

### Move to trash and delete permanently (F12, M44, M45)

The only writes under `~/.claude`, each started and confirmed by the user.

- **Move transcript to trash…**: a confirmation, heading "Move transcript to trash?", body
  "“{name}” will be removed from Claude's history." + newline + "The file is moved to the trash and
  can be restored.", buttons "Cancel" (the default) and "Move to Trash" (destructive). Confirmed:
  the `.jsonl` file goes to the desktop's trash; the session leaves the list at once; if it has a
  tab, the tab closes (which stops it). It stays a member of its project (not shown, see above).
- **Delete permanently…**: heading "Delete session permanently?", body "“{name}” and its transcript
  file will be permanently deleted. This cannot be undone.", buttons "Cancel" (default) and "Delete
  permanently" (destructive). Confirmed: the `.jsonl` file is unlinked; the rest as for trash.
- Only the `.jsonl` file moves or goes: the session's sibling directory (`<id>/subagents/`,
  `<id>/tool-results/`) stays where it is.
- Failure: an error dialog, heading "Could not trash transcript" or "Could not delete transcript".
  agent-tablet's body is the system's error text (or "session not found" when the session vanished
  meanwhile); Menkar's bodies are its own sentences: "The file could not be moved to the trash." /
  "The file could not be deleted." / "The session is no longer on disk.", with the error logged.
- In agent-tablet only a tab in the **same** window is closed after a trash or delete; Menkar closes
  the session's tab in whichever window holds it.

### Select mode (F13)

- The select toggle shows a check box on every row and reveals a bar at the bottom: on the left
  "{n} selected" (untranslated in agent-tablet; Menkar uses `t()`), "All" (tooltip "Select all
  (filtered) sessions"), "None" (tooltip "Clear selection"); on the right, from right to left,
  trash (tooltip "Move selected transcripts to trash…"), hide (tooltip "Hide selected"), open
  (tooltip "Open selected in tabs").
- A click on a row toggles its check. **All** checks every row **currently shown** — by the search
  and by the collapsed groups: rows of a collapsed group are not checked. **None** unchecks every
  row.
- Leaving select mode clears the selection. A selected session that disappears on a rescan leaves
  the selection.
- **Open selected** opens each one as Open does (M33). **Hide selected** hides them all, without
  asking. **Trash selected**: heading "Move {n} transcript(s) to trash?", body "The files are moved
  to the trash and can be restored.", "Move to Trash" (destructive); each is trashed and its tab
  closed; failures are listed in one error dialog headed "Some transcripts could not be trashed",
  one line per session ("{name}: {reason}", Menkar's reason being its own sentence). Nothing
  happens with an empty selection. Select mode stays on after an action.

### First start: importing agent-tablet's data (decision 1.8)

- **A first start** is a start where Menkar's config directory (`$XDG_CONFIG_HOME/menkar/`) has
  **neither** `state.json` **nor** `projects.json`. Their content does not matter: an unreadable
  file of Menkar's own is handled by Menkar's own rule (moved aside), never by re-importing.
- On a first start Menkar reads, **read only**, agent-tablet's
  `$XDG_CONFIG_HOME/agent-tablet/projects.json` and `$XDG_CONFIG_HOME/agent-tablet/state.json`
  (`$XDG_CONFIG_HOME` resolved as Menkar resolves its own; `~/.config` when unset or relative), on
  Linux only (agent-tablet never ran elsewhere). It imports projects, groups and members from the
  first; the app's names, hidden sessions, the Remote Control list and the settings from the
  second; then **writes Menkar's own `projects.json` and `state.json`**, both, even when nothing was
  imported, so the next start is not a first start. If writing fails, the error is logged and the
  next start is a first start again.
- agent-tablet's files are opened for reading only: never written, renamed, moved aside or touched,
  even when unreadable (unlike Menkar's own files). agent-tablet may be running: it writes through a
  temporary file and a rename, so a read sees a whole file.
- The usage history import (agent-tablet's `history.sqlite`) is specified in `usage.md`.
- What each file contributes, and how a bad one is handled, is in Data contracts.
- Messages: an unreadable source file (not JSON, not an object, or for `projects.json` a version
  other than 1 or no `projects` list) logs a warning and shows a toast that stays until closed —
  "Agent Tablet's projects could not be read, so they were not imported." or "Agent Tablet's
  settings could not be read, so names, hidden sessions and settings were not imported." (Menkar's
  own strings; agent-tablet has none). A missing source file is silent. Entries dropped from a
  partly valid file are logged with their count, without a toast.
- agent-tablet's own first start imported Agent Session Manager's names (F14 as agent-tablet does
  it); **that import is not carried over**: Menkar reads nothing of Agent Session Manager's.
- Not imported (not named by decision 1.8): the `windows` layout of `projects.json` (no tab is
  reopened from agent-tablet's last run) and agent-tablet's `integrations.json`
  (`$XDG_STATE_HOME/agent-tablet/`, `context.md`).

## Data contracts

### Paths

| What | Path |
|---|---|
| Claude transcripts | `~/.claude/projects/<encoded cwd>/<uuid>.jsonl`; the folder name is the `cwd` with every character outside `A–Z a–z 0–9` replaced by `-` (`/a/b_c` → `-a-b-c`) |
| Claude's config (MCP servers) | `~/.claude.json`, read only |
| Cursor transcripts | `~/.cursor/projects/<encoded cwd>/agent-transcripts/<id>/<id>.jsonl`; the folder name is the `cwd` encoded as Claude's with the leading `-` removed |
| Menkar's state | `$XDG_CONFIG_HOME/menkar/state.json`, `projects.json` |
| agent-tablet's state (import source) | `$XDG_CONFIG_HOME/agent-tablet/state.json`, `projects.json` |

agent-tablet lets the environment move the first three (`CSM_PROJECTS_DIR`, `CSM_CLAUDE_CONFIG`,
`CSM_CURSOR_PROJECTS_DIR`) for demos and tests; Menkar resolves them through its paths module so a
test points them at a temporary directory.

**Cursor's folder → `cwd`:** Built: `docs/sessions.md` describes how; `src/core/sessions/` holds it.

### Claude Code transcript lines

One JSON object per line; a line that is not JSON or not an object is skipped everywhere.

| Field / line | Used for |
|---|---|
| file name `<uuid>.jsonl` | the session id (the `sessionId` inside lines is not read) |
| `type` | `user`, `assistant`, `custom-title`, `ai-title` are read; every other type is ignored for sessions |
| `cwd` (string, any line) | the session's folder: the first line carrying it, within the scan limit below |
| `timestamp` (ISO 8601 string, e.g. `2026-11-08T14:03:12.511Z`) | details' Created / Last activity, export; the first and the last line carrying one |
| `message.content` | a string, or a list of blocks; `{"type":"text","text":…}` gives the text (text blocks joined by one space); `{"type":"tool_use","id":…,"name":…,"input":{…}}`; `{"type":"tool_result","tool_use_id":…}` (in `user` lines); `thinking` ignored |
| `message.model` | details' Models (`assistant`) |
| `message.usage.input_tokens`, `output_tokens`, `cache_read_input_tokens` | the token figures (via `usage.md`) |
| `{"type":"custom-title","customTitle":"…","sessionId":"…"}` | Claude's name; the last one wins; trimmed |
| `{"type":"ai-title","aiTitle":"…","sessionId":"…"}` | Claude's generated title; the last one wins; trimmed |
| `{"type":"agent-name","agentName":"…"}` | written by `-n` beside `custom-title`; not read |
| `{"type":"summary","summary":"…","leafUuid":"…"}` | older Claude Code versions; not read, never a name |
| `isSidechain`, `isMeta`, `turnOrigin`, `requestId`, `message.id` | not read by this area; `usage.md` uses them |

- **Preview**: within the first **50** lines and the first **256 KiB** of the file, the first `user`
  line whose text, trimmed, is not empty and does not start with `<` (commands, reminders and other
  injected content start with `<`); whitespace runs collapsed to one space; the first **120**
  characters. The same scan finds the `cwd`; it stops once both are found. A session whose first
  typed message comes later has no preview.
- A `user` line whose content is only `tool_result` blocks has no text: it is not a message.
- A user text containing `[Request interrupted by user` marks an interruption (F3).
- Subagent transcripts live in `<uuid>/subagents/` and are not sessions.

### Cursor transcript lines

`{"role":"user"|"assistant","message":{"content": <string or list of text blocks>}}`. No `type`,
no `cwd`, no timestamps, no model, no usage. The user's text is wrapped in `<user_query>` …
`</user_query>`, removed before use. The preview is the first `user` line's stripped text within the
same 50-line / 256 KiB limit, collapsed, not starting with `<`, first 120 characters.

**Telling the agent of an arbitrary file** (Open session file…): the first non-empty line, if JSON,
decides — a top-level `type` → Claude, a top-level `role` → Cursor; otherwise a path containing
`.cursor` → Cursor, else Claude.

### Formats shown

`src/core/format.ts` holds them (sizes, token counts, timestamps), described in `docs/sessions.md`.

### Menkar's `state.json` (this area's keys)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `names` | object, session id → string | `{}` | the app's names (F2); a key is removed when the name is cleared |
| `hidden` | array of session ids, sorted | `[]` | hidden sessions (F11) |
| `remote_control` | array of session ids, sorted | `[]` | `remote-control.md` |
| `settings.new_session_dir` | string | `""` | the folder New remembers |
| `settings.show_folder_path` | boolean | `false` | the history's folder path line |

The other settings are in `preferences.md`. Written whole through a temporary file and a rename,
on every change.

### agent-tablet's `projects.json` (import source)

```json
{
  "version": 1,
  "current": "3f9a1c2b7d4e",
  "projects": [
    {
      "id": "3f9a1c2b7d4e",
      "name": "Client work",
      "members": ["0b6e…uuid", "5d21…uuid"],
      "groups": [{ "name": "api pair", "color": "#5ec4b6", "members": ["0b6e…uuid"] }]
    }
  ],
  "windows": [
    { "current": "3f9a1c2b7d4e",
      "tabs": { "3f9a1c2b7d4e": [ { "panes": ["0b6e…uuid"], "orientation": "horizontal" },
                                  { "file": "/home/demo/notes.md", "preview": true } ] } }
  ]
}
```

| Key | Type | Meaning in agent-tablet |
|---|---|---|
| `version` | integer, `1` | any other value makes agent-tablet treat the file as unreadable |
| `current` | string | the id of the project shown at start; an unknown id means the first project |
| `projects` | non-empty array | in order |
| `projects[].id` | string (12 hex digits when agent-tablet made it) | |
| `projects[].name` | string | unique, case-insensitively, by agent-tablet's own checks |
| `projects[].members` | array of session ids | a session in an earlier project is dropped from a later one |
| `projects[].groups` | array | each `name` (string), `color` (string `#rrggbb`; missing → `#5ec4b6`), `members` (ids, kept only if members of the project); a group left with no member is dropped |
| `windows` | array | the saved layout: per window `current` and `tabs` (project id → tabs; a tab is `panes` (≤ 2 ids) + `orientation` `horizontal`\|`vertical`, or `file` + `preview`) |
| any other key, at the top or in a project | any | kept as it came by agent-tablet |

Written with 2-space indentation, UTF-8 unescaped. agent-tablet moves an unreadable file of its own
aside as `projects.json.broken`; Menkar never reads that file.

**What Menkar imports from it:**
- File not JSON, not an object, `version` ≠ 1, or `projects` not an array → nothing (toast above);
  Menkar starts with one empty project "Default".
- Each project entry that is an object with a string `id` and a string `name` is imported with that
  id and name; any other entry is skipped (agent-tablet would reject the whole file; Menkar keeps
  the good ones). Two entries with the same id: the first wins.
- Members: strings only, each kept in the first project that lists it, once.
- Groups: an object with a string `name`; members kept only if members of its project and not
  already in an earlier group of that project; a group with no member left is dropped; `color` kept
  when a string, else `#5ec4b6`.
- No project left → one empty "Default". `current` imported when it names an imported project,
  else the first one.
- `windows` and unknown keys are not imported.

### agent-tablet's `state.json` (import source)

```json
{
  "names": { "5d21…uuid": "Homepage redesign" },
  "hidden": ["7a10…uuid"],
  "remote_control": ["0b6e…uuid"],
  "settings": {
    "font": "", "scrollback": 10000, "color_scheme": "system", "terminal_theme": "Default",
    "ui_style": "tui", "language": "", "notify_idle": true, "notify_sound": true,
    "new_session_dir": "/home/demo/projects/todo-api", "sidebar_width": 300, "reopen_tabs": true,
    "show_folder_path": false, "classify_since": 1762560000.0,
    "classify_last": { "at": 1762563600.0, "classified": 42, "failed": false }
  }
}
```

| Key | Type | Default when absent |
|---|---|---|
| `names` | object, id → string | `{}` |
| `hidden` | array of ids (sorted when written) | `[]` |
| `remote_control` | array of ids (sorted; non-strings ignored on read) | `[]` |
| `settings.font` | string, `""` = the terminal's default | `""` |
| `settings.scrollback` | integer, lines | `10000` |
| `settings.color_scheme` | `"system"` \| `"light"` \| `"dark"` | `"system"` |
| `settings.terminal_theme` | string, a theme's name | `"Default"` |
| `settings.ui_style` | `"tui"` \| `"classic"` | `"tui"` |
| `settings.language` | string, a language code, `""` = the system's | `""` |
| `settings.notify_idle` | boolean | `true` |
| `settings.notify_sound` | boolean | `true` |
| `settings.new_session_dir` | string, a folder | `""` |
| `settings.sidebar_width` | integer, px | `300` |
| `settings.reopen_tabs` | boolean | `true` |
| `settings.show_folder_path` | boolean | absent = `false` |
| `settings.classify_since` | number (Unix seconds) or `null`; not `null` = classification on | absent = off |
| `settings.classify_last` | object `{at: number, classified: integer, failed: boolean}` | absent |

Only these four top-level keys are written by agent-tablet; another top-level key (left by Agent
Session Manager in a file agent-tablet never re-saved) is ignored. Written with 2-space indentation.

**What Menkar imports from it:**
- Not JSON or not an object → nothing (toast above); Menkar's defaults.
- `names`: each pair whose key and trimmed value are non-empty strings. A name for a session Claude
  has named since is imported but not shown (F2's order).
- `hidden`, `remote_control`: each string; anything else dropped; a key of the wrong type is `[]`.
- `settings`: each key of the table whose value has the listed type (and, for the enumerations,
  one of the listed values) is imported under the same meaning (`preferences.md` maps them to
  Menkar's settings); a wrong-typed value takes Menkar's default; unknown keys are not imported.
  `classify_since` carries the user's opt-in to classification (`classifier.md`).

## Acceptance cases

The cases of discovery, names and badges that are built (SES-1, 3–12, 14, 15, 19–22) left for the
history; the Vitest tests in `tests/core/sessions/` carry their ids.

Discovery

- **SES-2** Transcripts exist under `~/.claude/projects/` but `claude` is not on the `PATH` → no
  Claude session is listed; the history shows "No sessions found" when Cursor has none either.

Names and preview

- **SES-13** The first typed message is on line 51 → no preview; a new session with that file does
  not join its project.
- **SES-16** Rename on a session with a Claude name → error dialog "This name comes from Claude";
  `state.json` unchanged.
- **SES-17** Rename on an unnamed session, type "  Payments  ", Save → `names[id]` is "Payments";
  the row and its open tab show "Payments"; the transcript's bytes and mtime are unchanged.
- **SES-18** Rename with an empty entry → `names` loses the id.

Badges

History browser

- **SES-23** Sessions in `/home/demo/api` (newest 1 h ago) and `/home/demo/web` (newest 5 min ago)
  → groups "WEB" then "API", both collapsed on first show, counts 1 and 2.
- **SES-24** Expand "API", then a rescan → "API" stays expanded; a new group appearing later starts
  collapsed.
- **SES-25** Sessions in `/home/demo/api` and `/srv/api` → one group "API" with both.
- **SES-26** Search "LOGIN" with a session whose preview has "login" in a collapsed group → the row
  and its header show, other headers hidden; clearing the search re-collapses the group.
- **SES-27** Search by the first 8 characters of an id → that session shows.
- **SES-28** 7 sessions in 5 folders totalling 37,274 bytes, one with a tab → "7 sessions · 5
  projects · 36.4 KB · 1 open"; none with a tab → no "open" part.
- **SES-29** Relative times at now = 2026-11-08 12:00: mtime 11:59:30 → "just now"; 11:15 → "45m
  ago"; 2026-11-08 02:00 → "10h ago"; 2026-11-05 12:00 → "3d ago"; 2026-10-31 → "2026-10-31".
- **SES-30** "Show folder path" on, `cwd` `/home/demo/projects/api` with home `/home/demo` → path
  line "~/projects/api"; a session without `cwd` → no path line.

Add session

- **SES-31** Existing, a session in no project → button "Add"; pressing it → member of the current
  project, button now "Added" (disabled), dialog still open, no tab started.
- **SES-32** A session in project "Research" → "Move from Research"; pressing → member of the
  current project only, and out of its group in "Research".
- **SES-33** A session running in window B is moved from window A → its tab moves to A still
  running (same process), selected.
- **SES-34** Same, but its tab in B holds a second session → toast "It shares a tab with another
  session there"; membership and tabs unchanged.
- **SES-35** New with remembered folder `/home/demo/api` existing → opens on step 2 with "api" /
  "~" shown; remembered folder deleted → opens on step 1.
- **SES-36** New: folders used by sessions at 10:00 (`/a/x`), 11:00 (`/b/y`), 09:00 (`/a/x`) → list
  "y", "x", then "Another folder…"; typing "zzz" leaves only "Another folder…".
- **SES-37** Step 1, type "x", press Enter → step 2 with `/a/x`.
- **SES-38** Start with name "   " → "Give the session a name: sessions find each other by it.";
  nothing starts.
- **SES-39** Start with a folder deleted after it was chosen → "That folder does not exist."
- **SES-40** Start "Billing" in `/a/x`, switch on → dialog closes; a tab "Billing" starts;
  `remote_control` holds the new id; `new_session_dir` is `/a/x`.
- **SES-41** Reopening New after SES-40 → the Remote control switch is off.
- **SES-42** Only Claude installed → no Agent row; Cursor chosen with both installed → no Remote
  control switch, and it is off.
- **SES-43** A new session whose user exits before typing → after its transcript (with only the
  name and `/exit`) appears, it does not join the project; once a typed message exists, it joins
  the project that was current when it started.
- **SES-44** The project current at start is deleted before the transcript appears → the session
  joins the window's current project.
- **SES-45** `Ctrl+Shift+T`, `Ctrl+B c` and the `+` click open on New; "Add session", `Ctrl+B N`
  and `Ctrl+Shift+F` on Existing, with the focus in "Search sessions…"; "New Cursor session…"
  opens New with Cursor selected.

Open from the history

- **SES-46** Open on a session in no project → joins the current project; a tab opens.
- **SES-47** Open on a session of project P shown by window B → window B comes forward and the tab
  opens in B; window A gets no tab.

Details, export, replay

- **SES-48** Details of a Claude transcript with 3 typed `user` lines, 2 `user` lines with only
  `tool_result`, 5 `assistant` lines with 2 `tool_use` blocks named `mcp__github__search` and
  `Bash` → "Messages" "3 user · 5 assistant", "Tool calls" "2", "Tools used in this session"
  "github: 1".
- **SES-49** Details of a Cursor session → no Created, Last activity, Models, Tokens or Tool calls
  row; "Directory" is the decoded folder; MCP "Available to this project" not read from
  `~/.claude.json`.
- **SES-50** Details while a 50 MB transcript is read → the dialog shows "Reading transcript…" at
  once and the window keeps responding.
- **SES-51** Details' recent activity with 20 text messages → the last 12, oldest first; a 900-char
  Claude message shows its first 500 characters.
- **SES-52** Export of "Fix: login/OAuth?" → proposed file name "Fix_ login_OAuth_.md"; of "???"
  → "___.md"; of a name that is only spaces → "session.md".
- **SES-53** Export of a transcript with one typed message "hi" and one assistant line "Hello" with
  a `tool_use` `Read` → the file is exactly the header block, `---`, then `### You\n\nhi\n\n###
  Claude\n\nHello\n\n*Used `Read`*\n`.
- **SES-54** Export of a session with no messages → body `_No messages._`.
- **SES-55** Export to a folder without write permission → error "Export failed" with Menkar's
  sentence; no partial file left by the app.
- **SES-56** Replay of a transcript with a user message, an assistant line "Let me look." + `Read
  {file_path: "/a/b/c.py"}` + "Done." → turns: user bubble, "Let me look.", chip "🔧 Read c.py",
  "Done."; progress "1 / 4" at open.
- **SES-57** Replay: Play → one more turn every 800 ms; at 4 / 4 Play stops and Next, Show all are
  disabled.
- **SES-58** Replay of a transcript with only injected `<…>` user lines and "(no content)" →
  "Nothing to replay yet.", all controls disabled.
- **SES-59** Replay chip for `Bash` with a 100-character command → "🔧 Bash: " + its first 60
  characters.

Copy, hide, trash, delete, select

- **SES-60** Copy session ID → the clipboard holds the full 36-character id.
- **SES-61** Copy session ID from the tab menu of a new session whose transcript does not exist yet
  → the clipboard is unchanged.
- **SES-62** Hide a session in the current project → it leaves the history, stays in the project
  list; `hidden` holds its id; "Show hidden sessions" → it is back in the history with "Unhide
  session" in its menu.
- **SES-63** Restart after checking "Show hidden sessions" → unchecked.
- **SES-64** Trash, Cancel → file untouched. Trash, "Move to Trash" → the `.jsonl` is in the
  desktop's trash, `<id>/subagents/` is still in place, the row is gone, a running tab of it (in any
  window) is closed.
- **SES-65** Delete permanently → the `.jsonl` no longer exists; the project still lists the id in
  `projects.json`; the project list does not show it.
- **SES-66** Trash of a transcript whose folder is not writable (permission denied) → "Could not
  trash transcript" with Menkar's sentence; the row stays.
- **SES-67** Select mode: group "API" collapsed (3 sessions), "WEB" expanded (2), All → "2
  selected".
- **SES-68** Select 3, trash selected, one fails → two trashed, one error dialog "Some transcripts
  could not be trashed" with one line.
- **SES-69** Leave select mode with 2 selected, enter again → "0 selected".
- **SES-70** A selected session's transcript is deleted outside the app → after the rescan the count
  drops by one.

First start

- **SES-71** No Menkar config, agent-tablet's two files valid (2 projects, 3 groups, 5 members, 2
  names, 1 hidden, 1 Remote Control id, `ui_style` "classic") → Menkar starts with those projects,
  ids, groups (colors kept), members, names, hidden, Remote Control list and the classic style;
  Menkar's `projects.json` and `state.json` exist afterwards.
- **SES-72** No Menkar config and no `~/.config/agent-tablet/` → Menkar starts with one empty
  project "Default" and default settings; no toast; both Menkar files are written.
- **SES-73** agent-tablet's `projects.json` is `{"version": 1, "projects": [` (cut off) → no
  project imported, one "Default", the projects toast shown; `state.json` still imported;
  agent-tablet's file keeps its bytes and name (no `.broken` made).
- **SES-74** agent-tablet's `state.json` is a JSON array → nothing from it imported, the settings
  toast shown; projects still imported.
- **SES-75** agent-tablet's `projects.json` has `"version": 2` → treated as unreadable (SES-73).
- **SES-76** Partly valid `projects.json`: projects `[{"id":"a1","name":"A","members":["s1","s2",
  7]}, {"name":"no id"}, {"id":"b2","name":"B","members":["s2","s3"],"groups":[{"name":"g",
  "members":["s1","s3"]},{"name":"empty","members":["s9"]}]}]` → A with s1, s2; B with s3 and group
  "g" holding s3 with color `#5ec4b6`; no group "empty"; the log records the dropped entries; no
  toast.
- **SES-77** Partly valid `state.json`: `"hidden": ["s1", 3]`, `"names": {"s2": "  ", "s3":
  "Ok"}`, `"settings": {"scrollback": "lots", "notify_sound": false}` → hidden `["s1"]`, names
  `{"s3": "Ok"}`, scrollback Menkar's default, sound off.
- **SES-78** `current` names a project not in the file → the first imported project is current.
- **SES-79** Second start (Menkar's files exist) with agent-tablet's files changed meanwhile →
  nothing imported; Menkar's state is as it left it.
- **SES-80** Menkar's `projects.json` deleted by hand, `state.json` present → not a first start;
  nothing imported; a fresh "Default" (Menkar's own rule).
- **SES-81** After a first start that imported both files, agent-tablet's `projects.json` and
  `state.json` have the same bytes and the same mtime as before, and no file was created in
  `~/.config/agent-tablet/`.
- **SES-82** No file of Agent Session Manager is read on a first start, even when
  `~/.config/agent-session-manager/state.json` exists.
- **SES-83** Writing Menkar's files fails on the first start (read-only config dir) → an error is
  logged; the next start is again a first start.
- **SES-84** agent-tablet's `windows` lists two windows with tabs → Menkar opens one window on the
  imported `current` project with no tabs.

## Look

Screenshots (demo data): `img/add-session-existing-dark.png` (the history, groups collapsed, the
count line), `img/add-session-new-dark.png` (New, step 1), `img/project-list-dark.png` (the project
list's rows); the light-theme copies `img/add-session-existing-light.png`,
`img/add-session-new-light.png`, `img/project-list-light.png`. Theme tokens (`@tsm_*`) and the two
styles (terminal-workspace "tui", the default, and Classic) are defined in `look.md` and
`preferences.md`.

**Add session dialog**: 560 × 640 px content; a header bar whose title is a two-tab view switcher
(wide): "Existing" with a recent-documents icon (`document-open-recent-symbolic`), "New" with a plus
(`list-add-symbolic`); the header's close button on the right.

**History** (the dialog carries the sidebar's style, so in "tui" its background is `@tsm_mantle`,
row text `@tsm_subtext0`, dim text `@tsm_overlay0` at full opacity, entries on `@tsm_surface0`):
- Search row: margins start / end 8 px, bottom 6 px, spacing 2 px; the entry expands; then four
  flat icon buttons: up chevron (`pan-up-symbolic`), down chevron (`pan-down-symbolic`), a check
  (`object-select-symbolic`, a toggle), circular arrow (`view-refresh-symbolic`).
- Group header: padding 10 px 10 px 4 px 10 px, spacing 6 px; arrow `pan-end-symbolic` /
  `pan-down-symbolic` (dim), folder icon `folder-symbolic` (dim), the label uppercase in the
  caption-heading style, dim, ellipsized; count badge right-aligned: Classic background
  `alpha(currentColor, 0.1)`, radius 10 px, padding 1 px 8 px, font 0.8 em; "tui" radius 0.
- Session row (`session-child`): Classic — margin left 20 px, right 16 px, background
  `alpha(currentColor, 0.06)`, left border 2 px `alpha(currentColor, 0.15)`, radius 0 8 px 8 px 0;
  hover background 0.1 and border 0.3. "tui" — margin right 6 px, transparent, left border 1 px
  `@tsm_surface0`, radius 0; hover background `@window_bg_color`. Content margins top / bottom 8 px,
  start 10 px, end 12 px; lines 2 px apart; top line spacing 6 px. Name in the heading (bold) style;
  subtitle, path and preview in dim caption.
- Status dot: 8 × 8 px circle. None: `alpha(currentColor, 0.25)`. Open: Classic filled `#2ec27e`;
  "tui" a ring (inset 1.5 px) of `@tsm_green`. Attention: Classic `#3584e4`; "tui" `@tsm_yellow`.
- Badges: waiting `dialog-question-symbolic` in `#e5a50a`; interrupted `process-stop-symbolic` in
  `#e01b24` (both styles).
- Agent icons: the app's own `agent-claude-symbolic` and `agent-cursor-symbolic`, dim.
- Rename: flat `document-edit-symbolic` (a pencil on a page). Pick button: text, suggested style
  (the accent color) when enabled, flat and insensitive for "Added".
- Count line: dim caption, margins top 4 px, bottom 6 px, centered, ellipsized.
- Selection bar: an action bar sliding up from the bottom; check boxes vertically centered at the
  row's start; icons `user-trash-symbolic` (a bin), `view-conceal-symbolic` (an eye struck
  through), `tab-new-symbolic` (a tab with a plus), flat.
- Empty page: compact status page, `folder-symbolic`.

**New page**: step 1 box margins 12 px, spacing 6 px; folder rows margins 6 px, spacing 10 px,
`folder-symbolic` (a folder) and for "Another folder…" `folder-open-symbolic` (an open folder); the
name bold, the parent dim caption. Step 2 margins 18 px, spacing 12 px; a boxed preferences list
(folder row with `folder-symbolic` and a flat "Change", entry row "Name", combo row "Agent", switch
row); the error label in the error color; "Start session" a pill in the accent color, aligned right.
Steps change with a horizontal slide.

**Project list row**: margins top / bottom 6 px, start 10 px, end 4 px, spacing 8 px; dot as above
(states in `agent-state.md`); `phone-symbolic` (a phone) dim; name bold; folder dim caption; the
context ring; ⋯ `view-more-symbolic` (three dots) flat. Group headings: a "●" in the group's color
and the name in dim caption-heading; "No group" the same without the dot. Empty project: compact
status page with `view-list-symbolic`, title "{name} has no sessions", description "Add one Claude
already knows, or start a new one in any folder.", and an "Add session" pill in the accent color.

**Details dialog**: 480 × 560 px, a header with title (the name) and subtitle (the folder name); a
preferences page of property rows (title small and dim above the value); groups "MCP" and "Recent
activity" titled; recent messages wrap without line limit.

**Replay tab**: toolbar margins top / bottom 6 px, start / end 12 px, spacing 6 px; icons
`media-skip-backward-symbolic`, `media-playback-start-symbolic` / `media-playback-pause-symbolic`,
`media-skip-forward-symbolic`; the progress dim, right-aligned. Turn list margins top / bottom
10 px, start / end 12 px, spacing 8 px. Bubbles: padding 8 px 12 px, radius 14 px, wrap at word or
character, at most 64 characters wide, selectable; the user's aligned right on `#D97757` with white
text, plain; the agent's aligned left on `alpha(currentColor, 0.08)`, with light Markdown (code
spans and fenced code in monospace, `**bold**` and headings bold, `-` / `*` bullets as "•"). Tool
chips: font 0.85 em, opacity 0.6, padding 2 px 4 px, wrapping.

**Confirmations**: an alert dialog with "Cancel" (the default) and the destructive button in the
destructive color; error dialogs have a single "OK".
