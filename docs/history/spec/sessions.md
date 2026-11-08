# History of `docs/spec/sessions.md`

## Discovery (F1)

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
- On start the app scans every **installed** agent's transcripts off the UI path. An agent is
  installed when its CLI is on the `PATH`: `claude` for Claude Code, `cursor-agent` for Cursor. An
  agent that is not installed contributes no sessions, even if its transcripts are on disk.
- **Claude Code**: every file `~/.claude/projects/<folder>/<id>.jsonl` where `<id>` is a lowercase
  UUID (`8-4-4-4-12` hex digits) and the file is not empty. Files with other names, and anything
  deeper (`<id>/subagents/…`, `<id>/tool-results/…`, `memory/`), are not sessions.
- **Cursor**: every directory `~/.cursor/projects/<folder>/agent-transcripts/<id>/`; its transcript
  is `<id>/<id>.jsonl`, else the first `*.jsonl` in that directory; an empty file, or a directory
  with no `.jsonl`, is skipped. The session's id is the directory's name.
- For each session the scan reads: its folder (`cwd`), a preview (the first message the user
  typed), the transcript's modification time ("last active") and size, its tail state (waiting /
  interrupted, F3) and, for Claude, its names (F2). All sessions of all agents form one list, newest
  modification time first.
- **Live updates.** The app watches, for Claude, `~/.claude/projects/` and each folder directly
  inside it; for Cursor, `~/.cursor/projects/`, each folder inside it and each `agent-transcripts/`
  inside those. Any change starts a **2000 ms** debounce; when it ends the whole list is rescanned.
  The watches are set again after every scan, so a folder Claude creates later is watched too.
- One scan and one set of watches serve every window.

## A session's name (F2)

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
- The name shown everywhere (history row, project list row, tab title, dialogs) is the first that
  is not empty of:
  1. **Claude's name**: the `customTitle` of the **last** `custom-title` line in the transcript
     (written by `claude -n <name>` at start and by `/rename` inside the session);
  2. **the app's name** for the session, set with Rename (kept in Menkar's `state.json`, `names`);
  3. **Claude's generated title**: the `aiTitle` of the last `ai-title` line;
  4. the **preview** (the first typed message, see Data contracts);
  5. the first 8 characters of the session id.
- Names are read incrementally: per transcript the app keeps how far it read; each rescan reads
  only the complete lines appended since. A file that became shorter is read again from the start.
  A last line without its newline is left for the next read.
- Cursor sessions have no Claude name nor generated title: their name is the app's, else the
  preview, else the id's first 8 characters.

## Waiting and interrupted badges (F3)

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
- From the last **64 KiB** of the transcript, line by line in order, considering only lines whose
  message has text (a string content, or the `text` blocks of a list, joined):
  - text containing `[Request interrupted by user` → the latest event is *interrupted* (any line
    type);
  - else a Claude `assistant` line → the latest event is *assistant*, and its text is kept;
  - else a Claude `user` line whose trimmed text does not start with `<` → *user*.
- **Interrupted** when the latest event is *interrupted*; **waiting** when it is *assistant* and
  that text, right-trimmed, ends with `?`; otherwise no badge. Cursor: the same with `role`
  instead of `type`, the user's text stripped of `<user_query>` tags, and never *interrupted*.

## Paths

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
**Cursor's folder → `cwd`.** The encoding loses where the `-` were, so the `cwd` is rebuilt against
the real filesystem: from `/`, take the longest run of the remaining dash-separated parts that,
joined by `-`, names an existing directory under the path built so far; descend into it and repeat.
When no run exists, the rest of the parts are joined by `/`. Example: `home-demo-my-app` with
`/home/demo/my-app` on disk → `/home/demo/my-app`; with nothing on disk → `/home/demo/my/app`.

## Formats shown

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
| Value | Format |
|---|---|
| Size | under 1024: "{n} B" (no decimals); then "{x.x} KB", "{x.x} MB", "{x.x} GB" (1024 steps, one decimal, GB the last unit) |
| Tokens | ≥ 1,000,000: "{x.x}M"; ≥ 1,000: "{x.x}k"; else the number |
| Timestamp | local time `YYYY-MM-DD HH:MM`; a value that does not parse is shown as written; none is "—" |

## Acceptance cases

> Left on 2026-11-08: built by plan 05; the Vitest tests carry these ids.
- **SES-1** `claude` on the `PATH`; `~/.claude/projects/-home-demo-api/` holds
  `1b4e28ba-2fa1-11d2-883f-0016d3cca427.jsonl` (2 KB), `notes.jsonl`, an empty
  `9c2d…-uuid.jsonl` and `1b4e…427/subagents/agent-a1.jsonl` → exactly one session, id
  `1b4e28ba-2fa1-11d2-883f-0016d3cca427`.
- **SES-3** A new transcript appears in a watched folder → it is listed within 2 s plus one scan;
  ten files written within one second cause one rescan, not ten.
- **SES-4** A new folder `-home-demo-new` is created under `~/.claude/projects/` and a transcript
  written in it → listed; a second transcript written there later is also picked up (the folder is
  watched after the scan that found it).
- **SES-5** A file event arrives while a scan runs → another scan follows it, and the change shows.
- **SES-6** Cursor: `~/.cursor/projects/home-demo-my-app/agent-transcripts/abc/abc.jsonl` with
  `/home/demo/my-app` existing → a Cursor session id `abc`, folder `/home/demo/my-app`; with no
  such directory on disk → folder `/home/demo/my/app`.
- **SES-7** Cursor session directory `xyz/` containing only `other.jsonl` (non-empty) → session
  `xyz` read from `other.jsonl`; a directory with no `.jsonl` → no session.
- **SES-8** Transcript with `custom-title` "alpha", later `custom-title` "beta", and `ai-title`
  "Fix login" → the name is "beta".
- **SES-9** No `custom-title`; app name "Mine"; `ai-title` "Fix login" → "Mine". App name cleared →
  "Fix login".
- **SES-10** No titles, no app name, first `user` line text `<command-name>/clear</command-name>`,
  second `user` line "  fix   the\nlogin bug " → name and preview "fix the login bug".
- **SES-11** No titles, no typed message, id `1b4e28ba-…` → name "1b4e28ba".
- **SES-12** A first typed message of 300 characters → preview is its first 120 characters.
- **SES-14** `/rename gamma` appends `custom-title` "gamma" to a 40 MB transcript → after the next
  rescan the name is "gamma", and that rescan read only the appended bytes.
- **SES-15** The last line of a transcript is a `custom-title` without its newline → not applied;
  once the newline is written, applied on the next rescan.
- **SES-19** Last text-bearing line: an `assistant` line "Should I also update the tests?" → waiting
  badge with tooltip "Claude is waiting for your reply".
- **SES-20** An `assistant` question followed by a `user` line "yes" → no badge.
- **SES-21** Last text-bearing line: a `user` line "[Request interrupted by user]" → interrupted
  badge, tooltip "You interrupted Claude here".
- **SES-22** An `assistant` question followed only by `user` lines holding `tool_result` blocks →
  waiting (tool results carry no text).

> Left on 2026-11-08: built by plan 07, described in `docs/projects.md`.
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

> Left on 2026-11-08: built by plan 11, described in `docs/window.md` and `docs/sessions.md`.
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
- **SES-31** Existing, a session in no project → button "Add"; pressing it → member of the current
  project, button now "Added" (disabled), dialog still open, no tab started.
- **SES-32** A session in project "Research" → "Move from Research"; pressing → member of the
  current project only, and out of its group in "Research".
- **SES-36** New: folders used by sessions at 10:00 (`/a/x`), 11:00 (`/b/y`), 09:00 (`/a/x`) → list
  "y", "x", then "Another folder…"; typing "zzz" leaves only "Another folder…".
- **SES-37** Step 1, type "x", press Enter → step 2 with `/a/x`.
- **SES-38** Start with name "   " → "Give the session a name: sessions find each other by it.";
  nothing starts.
- **SES-48** Details of a Claude transcript with 3 typed `user` lines, 2 `user` lines with only
  `tool_result`, 5 `assistant` lines with 2 `tool_use` blocks named `mcp__github__search` and
  `Bash` → "Messages" "3 user · 5 assistant", "Tool calls" "2", "Tools used in this session"
  "github: 1".
- **SES-49** Details of a Cursor session → no Created, Last activity, Models, Tokens or Tool calls
  row; "Directory" is the decoded folder; MCP "Available to this project" not read from
  `~/.claude.json`.
- **SES-51** Details' recent activity with 20 text messages → the last 12, oldest first; a 900-char
  Claude message shows its first 500 characters.
- **SES-52** Export of "Fix: login/OAuth?" → proposed file name "Fix_ login_OAuth_.md"; of "???"
  → "___.md"; of a name that is only spaces → "session.md".
- **SES-53** Export of a transcript with one typed message "hi" and one assistant line "Hello" with
  a `tool_use` `Read` → the file is exactly the header block, `---`, then `### You\n\nhi\n\n###
  Claude\n\nHello\n\n*Used `Read`*\n`.
- **SES-54** Export of a session with no messages → body `_No messages._`.
- **SES-56** Replay of a transcript with a user message, an assistant line "Let me look." + `Read
  {file_path: "/a/b/c.py"}` + "Done." → turns: user bubble, "Let me look.", chip "🔧 Read c.py",
  "Done."; progress "1 / 4" at open.
- **SES-58** Replay of a transcript with only injected `<…>` user lines and "(no content)" →
  "Nothing to replay yet.", all controls disabled.
- **SES-59** Replay chip for `Bash` with a 100-character command → "🔧 Bash: " + its first 60
  characters.
- **SES-65** Delete permanently → the `.jsonl` no longer exists; the project still lists the id in
  `projects.json`; the project list does not show it.
- **SES-67** Select mode: group "API" collapsed (3 sessions), "WEB" expanded (2), All → "2
  selected".
- **SES-69** Leave select mode with 2 selected, enter again → "0 selected".

## First start: importing agent-tablet's data (decision 1.8)

> Left on 2026-11-08: built by plan 07, described in `docs/projects.md`.
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
- What each file contributes, and how a bad one is handled, is in Data contracts.
- agent-tablet's own first start imported Agent Session Manager's names (F14 as agent-tablet does
  it); **that import is not carried over**: Menkar reads nothing of Agent Session Manager's.
- Not imported (not named by decision 1.8): the `windows` layout of `projects.json` (no tab is
  reopened from agent-tablet's last run) and agent-tablet's `integrations.json`
  (`$XDG_STATE_HOME/agent-tablet/`, `context.md`).

## agent-tablet's `projects.json` (import source)

> Left on 2026-11-08: built by plan 07, described in `docs/projects.md`.

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

## agent-tablet's `state.json` (import source)

> Left on 2026-11-08: built by plan 07, described in `docs/projects.md`.

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
