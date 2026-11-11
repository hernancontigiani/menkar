# Specification — what agent-tablet does and how it looks

What Menkar must do, feature by feature, read from agent-tablet (`~/git/agent-tablet`, `main` at
`2f6e564`): its README, its docs, its decision index and its code, read for behaviour and data
only. Each area file holds four parts: **Behaviour**, **Data contracts**, **Acceptance cases**,
**Look**. A feature plan of Menkar is designed from its area file; once the feature is built, its
plan moves what it built into `docs/<subsystem>.md` and trims the area file.

"Found in the code" marks a feature agent-tablet's README and docs do not name.

## The areas

| File | Area |
|---|---|
| [`sessions.md`](sessions.md) | Finding sessions (Claude Code's and Cursor's), their names, the project list's and the history's rows, details, export, replay, hide / trash / delete, select mode, the Add session dialog (Existing, New) |
| [`terminal.md`](terminal.md) | Starting, resuming, forking and continuing a session (commands, flags, `--settings`, `&& exit`), the embedded terminal and its keys, the `Ctrl+B` prefix, split panes, close and stop, graceful exit |
| [`projects.md`](projects.md) | Projects, groups, tabs of up to two panes, several windows, the layout saved and reopened, agent-tablet's decisions 1.13, 1.15–1.19 |
| [`agent-state.md`](agent-state.md) | Working / blocked / idle / done detection, the counts, notifications and sound, the quick switcher, Go to agent |
| [`context.md`](context.md) | The context ring, the statusline script and what it writes, `--settings`, the integrations page |
| [`usage.md`](usage.md) | The turn, execution and blocked time, tokens and deduplication, prices, the history, the Usage window, `usage` CLI |
| [`classifier.md`](classifier.md) | The opt-in SDLC classification, its invocation, the earlier-turns backfill, the evaluation |
| [`files.md`](files.md) | File tabs, the editor, the Markdown preview, `open` CLI, opening a session file |
| [`remote-control.md`](remote-control.md) | Remote Control per session |
| [`chat.md`](chat.md) | Native chat tabs, the MCP servers browser, Ghostty; the question card, not carried over |
| [`preferences.md`](preferences.md) | Every setting, its default and where it shows; themes and color schemes; languages; the About dialog |
| [`look.md`](look.md) | The whole window's look: header, sidebar, rows, tab strip, panes, dialogs, both themes, fonts, icons, the terminal-workspace style vs Classic |

## Features

Each feature once, with its area. Source: **R** README, **D** a doc (`docs/<name>.md`), **S**
`plans/00-STATUS.md` §1 row, **C** found in the code.

| # | Feature | Area | Source |
|---|---|---|---|
| F1 | Session discovery: every Claude Code transcript under `~/.claude/projects/`, and Cursor's, off the UI thread, with file monitors and live updates | sessions | R · C |
| F2 | A session's name is Claude's (`-n`, `/rename`, `custom-title`, `ai-title`); a name set in the app only for sessions Claude never named | sessions | R · S 1.9 |
| F3 | Waiting ("Claude is waiting for your reply") and interrupted ("You interrupted Claude here") badges on history rows | sessions | R · C |
| F4 | The history browser: grouped by folder, search box, collapse / expand all, refresh, count line ("N sessions · N projects · <total size> · N open"), optional folder path | sessions | R · C |
| F5 | Add session → Existing: Add / Added / "Move from <project>", moving a running session's tab across windows | sessions · projects | R · S 1.18 · C |
| F6 | Add session → New: folder (recent folders, search, "Another folder…"), required name, agent, Remote control switch, Start session; joins the project once its transcript exists | sessions | R · S 1.16 · 1.17 |
| F7 | Session details: messages, models, tokens, recent messages peek, MCP servers, usage | sessions | R |
| F8 | Export a session as Markdown | sessions | R |
| F10 | Copy session ID; reveal transcript in the file manager | sessions | R |
| F11 | Hide / unhide a session; "Show hidden sessions" as a switch in Add session → Existing | sessions | R · S 1.17 |
| F12 | Move a transcript to the trash; delete permanently — each confirmed; the only writes under `~/.claude` | sessions | R · S 1.10 |
| F13 | Select mode: All, None, open selected in tabs, hide selected, trash selected | sessions | R |
| F14 | First start imports agent-tablet's own data, read only: `projects.json`, `state.json`, the usage history (Menkar decision 1.8; agent-tablet's own import of Agent Session Manager is not carried over) | sessions · usage | R · C · Menkar 1.8 |
| F15 | A tab runs the agent in an embedded terminal: `$SHELL` with the agent's command in the session's folder | terminal | R |
| F16 | Start, resume, fork (per provider; the agent is picked on Add session → New) | terminal | R · S 1.17 · S 1.30 |
| F17 | Graceful close: closing a tab sends Claude Code's `/exit` first; Cursor is force-closed | terminal | R · S 1.15 |
| F18 | Terminal keys: `Shift+Enter` newline, `Ctrl+Shift+C` / `V` copy / paste, `Ctrl+Shift+G` find | terminal | R · C |
| F19 | The `Ctrl+B` prefix (herdr's keys), the PREFIX pill on the tab strip while it waits, `Ctrl+B ?` help, `Ctrl+B Ctrl+B` sends `Ctrl+B` through | terminal | R · C |
| F20 | Split panes: a shell right or down, focus by direction, cycle, zoom, close; swap the split's orientation | terminal · projects | R · C |
| F21 | Projects: dropdown to switch, create, rename, delete; Default from the first start; `projects.json` | projects | R · S 1.13 · 1.19 |
| F22 | Groups inside a project, each with a color; Group submenu: a group, No group, New group… | projects | R · S 1.13 |
| F23 | Membership: a session in one project at most; Remove from project | projects | S 1.13 |
| F24 | Tabs: at most two panes, the tab strip shows only the current project's tabs, rename tab, close tab, close all tabs, open beside the current tab, next / previous / go to tab 1–9 | projects | R · S 1.13 · C |
| F25 | Several windows; a project open in at most one; New window; closing a window asks and stops its sessions | projects | R · S 1.18 |
| F26 | Reopen tabs on start: each window with its project, tabs and splits | projects | S 1.13 · 1.18 |
| F27 | Quitting asks and stops every session | projects | S 1.13 |
| F28 | An unreadable projects file is kept aside and a new one started, with a toast | projects | C |
| F29 | Sidebar: toggle (`F9`), its width remembered | look · projects | R · C |
| F30 | Agent states working / blocked / idle / done from the terminal's title and screen (Claude) and prompts (Cursor), rolled up to the tab | agent-state | R |
| F31 | Blocked count badge on the project dropdown ("Sessions waiting for you"), spanning every window | agent-state | S 1.18 · C |
| F32 | Desktop notifications and sound for an agent not being watched; clicking one focuses the session | agent-state | R · C |
| F33 | Quick switcher (`Ctrl+Shift+K`) over the current project | agent-state | R · S 1.17 |
| F34 | Go to agent (`Ctrl+B g`): every tab of every window (sessions, files, chats), filterable by state | agent-state | R · S 1.17 |
| F35 | Context ring by each session and on each tab: green, yellow from 60 %, red from 80 %, exact figure on hover; estimated from the transcript when there is no statusline report | context | R · D context |
| F36 | The app's statusline passed with `--settings` to the sessions it starts | context | D context |
| F37 | Integrations page: the status line in every Claude session, off by default, removable, the user's own status line kept | context | R · D context · S 1.12 |
| F38 | Usage: execution and blocked time, tokens, list-price cost, per project and session, by who started each turn | usage | R · D usage |
| F39 | The usage history (SQLite, one row per turn, never pruned), read on start and every hour; newer-version and unreadable files handled | usage | D usage · S 1.22 |
| F40 | The Usage window: Today / 7 days / 30 days / Month (previous, next, All); Totals or By day; Exec / Tokens / Cost; stacked by Project or Category; 5-hour and 7-day limit footer | usage | R · C |
| F41 | `usage` CLI: `--period`, `--month`, `--from`, `--to`, `--by`, `--json` | usage | R · C |
| F42 | Classify turns by SDLC stage, opt in, through Haiku and the user's login | classifier | R · D usage · S 1.20–1.25 |
| F43 | Classify earlier turns from a date: count and estimate first, progress, Stop | classifier | R · S 1.25 |
| F44 | The classifier evaluation (`scripts/classify_eval.py`, `eval/`) | classifier | C |
| F45 | File tabs: open from the `+` menu, `Ctrl+Shift+O`, `open` CLI; syntax colors, line numbers, `Ctrl+S` | files | R · D files · S 1.24 |
| F46 | Markdown rendered in a read-only second tab (`Ctrl+Shift+V`, "Preview") | files | R · D files |
| F47 | A file changed or deleted on disk: Reload / Keep mine; one buffer shared across projects; `~/.claude/` opens read only; unsaved files asked on close | files | R · D files · C |
| F49 | Remote Control per session: New's switch, the row's and the tab's menu, `--remote-control=<name>`, phone icon on the row | remote-control | R · S 1.26 |
| F50 | Native streaming chat tabs with permission cards (Allow once / Always allow / Deny); Continue in chat (Cursor: ask, trusted) | chat | R · S 1.17 · S 1.30 |
| F51 | The question card over the terminal for Claude's AskUserQuestion — **not carried over** (Menkar decision 1.7); listed in `chat.md` only | chat | C · Menkar 1.7 |
| F52 | MCP servers browser (Settings → MCP servers) | chat | R |
| F53 | Open in Ghostty, when `ghostty` is on the `PATH` | chat | R |
| F54 | Preferences: terminal font, scrollback lines, color scheme, interface style, color theme, Add session's folder path, language (restart), notifications, sound, reopen tabs on start | preferences | R · C |
| F55 | Themes: VS Code by default (Dark or Light Modern by the scheme), Catppuccin Mocha and Latte, Solarized Dark and Light, coloring the whole window; the terminals' own colours (Ubuntu terminal by default, neutral, or the theme's); the Classic (Adwaita) style | preferences · look | R · S 1.41 · S 1.42 |
| F56 | Languages through the i18n catalogs (`po/`) | preferences | C |
| F57 | About dialog | preferences | C |
| F58 | Empty states: "No session open", "<project> has no sessions", "No sessions found", "Nothing in this period." | look | C |
| F59 | Links in a terminal open with `Ctrl+click`, as in GNOME Terminal: an address in the output (whole across the rows it wraps over) and an OSC 8 hyperlink of any scheme, handed to the system (a `file:` one opens with the file's default app, decision 1.59); a plain click selects | terminal | Menkar 2026-11-10 |

59 features.

## Keyboard shortcuts

Every key the code handles, by where it is registered. "Window" keys are captured before the
terminal sees them.

| # | Keys | Action | Where | Area |
|---|---|---|---|---|
| K1 | `Ctrl+Shift+T` | Add session on New | window | sessions |
| K2 | `Ctrl+Shift+F` | Add session on Existing, search focused | window | sessions |
| K3 | `Ctrl+Shift+O` | Open a file in a tab | window | files |
| K4 | `Ctrl+Shift+W` | Close the current tab | window | projects |
| K5 | `Ctrl+PgDn` | Next tab of this project | window | projects |
| K6 | `Ctrl+Tab` | Next tab of this project | window | projects |
| K7 | `Ctrl+PgUp` | Previous tab of this project | window | projects |
| K8 | `Ctrl+Shift+Tab` | Previous tab of this project | window | projects |
| K9 | `Ctrl+,` | Preferences | window | preferences |
| K10 | `Ctrl+Shift+K` | Quick switcher | window | agent-state |
| K11 | `F9` | Toggle the sidebar | window | look |
| K12 | `Ctrl+Shift+N` | New window | application | projects |
| K13 | `Ctrl+S` | Save (a file tab only) | window, file tab shown | files |
| K14 | `Ctrl+Shift+V` | Markdown preview (a file tab only) | window, file tab shown | files |
| K15 | `Shift+Enter` | Newline in the agent's prompt (sends ESC CR) | terminal | terminal |
| K16 | `Ctrl+Shift+C` | Copy | terminal | terminal |
| K17 | `Ctrl+Shift+V` | Paste | terminal | terminal |
| K18 | `Ctrl+Shift+G` | Find in the terminal | terminal | terminal |
| K19 | `Ctrl+B` `v` / `%` | Split right, a shell | prefix | terminal |
| K20 | `Ctrl+B` `-` / `"` | Split down, a shell | prefix | terminal |
| K21 | `Ctrl+B` `h` / `←` | Pane to the left | prefix | terminal |
| K22 | `Ctrl+B` `j` / `↓` | Pane below | prefix | terminal |
| K23 | `Ctrl+B` `k` / `↑` | Pane above | prefix | terminal |
| K24 | `Ctrl+B` `l` / `→` | Pane to the right | prefix | terminal |
| K25 | `Ctrl+B` `Tab` | Next pane | prefix | terminal |
| K26 | `Ctrl+B` `z` | Zoom the pane | prefix | terminal |
| K27 | `Ctrl+B` `x` | Close the pane | prefix | terminal |
| K28 | `Ctrl+B` `c` | New session in this project | prefix | sessions |
| K29 | `Ctrl+B` `n` | Next tab | prefix | projects |
| K30 | `Ctrl+B` `p` | Previous tab | prefix | projects |
| K31 | `Ctrl+B` `1`–`9` | Go to tab N | prefix | projects |
| K32 | `Ctrl+B` `N` | Add a session (Existing) | prefix | sessions |
| K33 | `Ctrl+B` `T` | Rename tab | prefix | projects |
| K34 | `Ctrl+B` `X` | Close tab | prefix | projects |
| K35 | `Ctrl+B` `g` | Go to agent | prefix | agent-state |
| K36 | `Ctrl+B` `b` | Toggle the sidebar | prefix | look |
| K37 | `Ctrl+B` `s` | Preferences | prefix | preferences |
| K38 | `Ctrl+B` `?` | The prefix help | prefix | terminal |
| K39 | `Ctrl+B` `Ctrl+B` | Send `Ctrl+B` to the terminal | prefix | terminal |
| K40 | `Enter` (no `Shift`) | Send the message | chat entry | chat |
| K41 | `↓` / `↑` | Move the selection | quick switcher | agent-state |
| K42 | `Esc` | Close the switcher | quick switcher | agent-state |
| K43 | `Ctrl+`` ` `` | Show or hide the tab's drawer shell (the key left of `1`) | window | terminal |
| K44 | `Ctrl+Shift+End` | Jump to the bottom of the terminal (also the button shown while scrolled up) | terminal | terminal |
| K45 | `Ctrl+Shift+E` | Switch project: the projects in use, most recent first; held, each `E` moves down, letting `Ctrl` go jumps (decision 1.38) | window | projects |

**Count against the code:**

| Registered in the code | Code | Here |
|---|---|---|
| Window shortcut controller (`window.py` `_install_shortcuts`) | 11 triggers, 9 actions | K1–K11 |
| Application accelerator (`app.py`, `set_accels_for_action`) | 1 | K12 |
| File-tab keys (`window.py` `_on_file_key`) | 2 | K13–K14 |
| Terminal keys (`terminal.py` `_on_key_pressed`) | 4 | K15–K18 |
| Prefix commands (`window.py` `_prefix_commands`) | 20 entries + the double `Ctrl+B` | K19–K39 (21) |
| Chat entry (`chatsessionview.py` `_on_key`) | 1 | K40 |
| Quick switcher (`switcher.py` `_on_key`) | 3 keys | K41–K42 (`↓` / `↑` as one row) |
| **Total** | **42 rows** | **K1–K42** |

What any `Ctrl+B` command can do is also reachable without it except K19–K27 (splits and panes),
K31 (go to tab N) and K38–K39.

## Menus

| # | Menu | Item | Action | Area |
|---|---|---|---|---|
| M2 | Add session → Existing (a switch, not a menu) | Show hidden sessions | `show-hidden` | sessions |
| M3 | Settings (a section, not a menu) | MCP servers | `mcp-servers` | chat |
| M4 | Header (a button, not a menu) | Usage | `usage` | usage |
| M5 | Header (⚙ Settings, a button, not a menu) | Settings | `preferences` | preferences |
| M6 | Settings (a section, not a menu) | About | `about` | preferences |
| M7 | New ▾ (header text button) | New session (shows `Ctrl+Shift+T`; opens Add session on New) | `new-session` | sessions |
| M10 | New ▾ | Open file… (shows `Ctrl+Shift+O`) | `open-file` | files |
| M46 | New ▾ | Terminal in this tab (shows `Ctrl+`` ` ``; the tab's drawer) | `toggle-drawer` | terminal |
| M12 | New ▾ | New window (shows `Ctrl+Shift+N`) | `new-window` | projects |
| M13 | Tab (right-click on a tab) | Rename… | `rename-tab` | projects |
| M14 | Tab | Copy session ID | `copy-tab-session-id` | sessions |
| M15 | Tab | Swap the split's orientation | `toggle-split` | terminal |
| M16 | Tab | Close | `close-menu-tab` | projects |
| M17 | Tab | Remote control (a check; Claude only) | `remote-control-<id>` | remote-control |
| M18 | Session row (⋯ or right-click, project list) | Open | `open-session` | projects |
| M19 | Session row | Open beside the current tab | `open-beside` | projects |
| M20 | Session row | Stop | `stop-session` | terminal |
| M21 | Session row | Remote control (a check; Claude only) | `remote-control-<id>` | remote-control |
| M22 | Session row | Group ▸ (submenu) | — | projects |
| M23 | Session row › Group | each group of the project | `set-group` | projects |
| M24 | Session row › Group | No group | `set-group` | projects |
| M25 | Session row › Group | New group… | `new-group` | projects |
| M26 | Session row | Rename… | `rename-session` | sessions |
| M27 | Session row | Details… | `session-details` | sessions |
| M29 | Session row | Copy session ID | `copy-session-id` | sessions |
| M30 | Session row | Export as Markdown… | `export-session` | sessions |
| M31 | Session row | Reveal transcript | `reveal-transcript` | sessions |
| M32 | Session row | Remove from project | `remove-from-project` | projects |
| M33 | History row (right-click, Add session → Existing) | Open | `open-session` | sessions |
| M34 | History row | Open in Ghostty (when installed) | `open-ghostty` | chat |
| M35 | History row | Fork session (Claude only) | `fork-session` | terminal |
| M36 | History row | Continue in chat / Continue in chat ({mode}) — one per chat variant | `resume-chat` | chat |
| M37 | History row | Rename… | `rename-session` | sessions |
| M38 | History row | Details… | `session-details` | sessions |
| M40 | History row | Copy session ID | `copy-session-id` | sessions |
| M41 | History row | Export as Markdown… | `export-session` | sessions |
| M42 | History row | Reveal transcript | `reveal-transcript` | sessions |
| M43 | History row | Hide session / Unhide session | `hide-session` | sessions |
| M44 | History row | Move transcript to trash… | `trash-session` | sessions |
| M45 | History row | Delete permanently… | `delete-session` | sessions |

**Count against the code:** 45 item templates in 5 menus — main 6 (`window.py` `app_menu`), `+` 6
templates (`new_menu`; with Claude Code and Cursor both installed: 11 items, since chat variants
are Claude 1 and Cursor 2), tab 5 (`tab_menu` plus the Remote control section), session row 15
(`_menu_for`, with its submenu, plus one item per group), history row 13 (`sidebar.py`
`show_row_menu`). Every item's action is one of the 46 the code registers: 21 plain, 22 with a
session parameter, `show-hidden`, `app.focus-session`, `app.new-window`, plus one `remote-control-<id>`
per session.

**Registered actions with no menu item**, reached otherwise: `new-session` (`+` click, K1),
`add-session` ("Add session" button), `focus-search` (K2), `new-space` (K32), `new-in-space` (K28,
the tab strip's `+`), `close-tab` (K4, K34), `next-tab` / `prev-tab` (K5–K8, K29–K30),
`quick-switch` (K10), `toggle-sidebar` (K11, K36, the header toggle), `refresh` (the history's
refresh button), `app.focus-session` (a notification or toast).

**Buttons that are actions but not menus** (in their area files): the sidebar's "Add session"; the
header's sidebar toggle, ⚙ Settings and Usage; the tab strip's `+` and each tab's
×; the project dropdown's entry and Create, and each project's ✎ rename and 🗑 delete; the history's
select, refresh, search, collapse all, expand all; select mode's All, None, open / hide / trash
selected; the file tab's Reload, Keep mine, Preview; the chat's Stop, Send, Allow once, Always
allow, Deny; Usage's period, view, metric and stack
switches, previous / next month and All; Preferences' Restart now, Classify earlier turns…, Stop.

## Command line

| Command | Does | Area |
|---|---|---|
| `agent-tablet` | Opens the window | — |
| `agent-tablet open <file>…` | Opens the files in the window in use | files |
| `agent-tablet usage [--period today\|7d\|30d\|all] [--month YYYY-MM] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--by hour\|day\|month] [--json]` | The usage report in the terminal, no window | usage |

## Decided against agent-tablet

- **F51, the question card, is not carried over** (Menkar `plans/00-STATUS.md` 1.7, 2026-11-08):
  it typed the chosen answer into the agent's terminal; Menkar answers questions in the terminal
  itself.
- **F14 imports agent-tablet's data, not Agent Session Manager's** (1.8, 2026-11-08): on its first
  start Menkar reads agent-tablet's `projects.json`, `state.json` and `history.sqlite`, never
  writing them.

## Decisions that override the area files (2026-11-08)

Where an area file describes agent-tablet's behaviour and one of these says otherwise, this wins
(`plans/00-STATUS.md` §1):

- **Closing a running agent hangs up its pty** (SIGHUP), as closing a terminal does: close tab,
  Stop, `Ctrl+B x`, closing a window and quitting, after their confirmations. The hang-up goes to
  the shell and to the agent's process group. Whatever of the pty's session is still there 3 s
  later gets SIGCONT and SIGTERM, and whatever is left 2 s after that gets SIGKILL. Quit and
  Restart now wait for that, at most 5 s. Nothing is typed: not `/exit`, and not `exit` into a
  leftover shell (its pty is closed the same way). (1.9, amended 2026-11-10)
- The agent-tablet import (F14) also takes `usage.jsonl`, so imported turns keep their exact cost.
- The integrations record and the settings backups live in the data directory.
- Turns with origin `unknown` show their own category in reports.
- Popover menus keep the sans font; the Classic style's terminal uses xterm.js colors close to VTE's
  defaults.
- About: the human's copyright, and one credit line to Agent Session Manager, with no link.
- "Restart now" saves the layout and hangs up the running sessions as quitting does, without asking
  about them (2026-11-10); unsaved file edits are asked about first, on the Settings window
  (2026-11-10). Quitting by closing the windows still asks.
- No main menu (decision 1.34, 2026-11-10): its items moved to New ▾ (Open session file…), Add session →
  Existing (Show hidden sessions), the header's Usage and ⚙ Settings buttons, and Settings'
  sections (MCP servers, About). Close all and Close other tabs are in a tab's menu.
- No replay (decision 1.33, 2026-11-09): a session is not replayed in a tab (F9, M28, M39), and no
  transcript is opened from disk (F48, M1). Details and export as Markdown stay.
- One "New ▾" menu (1.30, 2026-11-09): New session, Terminal in this tab, Open file…, New window,
  each with its key. The advanced new session (M8), Continue last (M9) and New chat (M11) are gone;
  the agent is picked on Add session → New, where an agent that is not installed is greyed out. The
  menu counts above are agent-tablet's.
