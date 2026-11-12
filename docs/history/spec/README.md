# History of `docs/spec/README.md`

## Features

> Left on 2026-11-09: one New ▾ menu; the advanced new session, Continue last and New chat removed (decision 1.30).
| F16 | Start, resume, fork, continue last (per provider), advanced new session (model, permission mode, extra directories, continue) | terminal | R · S 1.17 |
| F50 | Native streaming chat tabs with permission cards (Allow once / Always allow / Deny); New chat; Continue in chat (Cursor: ask, trusted) | chat | R · S 1.17 |

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
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

## Menus

> Left on 2026-11-09: one New ▾ menu; the advanced new session, Continue last and New chat removed (decision 1.30).
| M7 | `+` (split button; its click opens Add session on New) | New {agent} session… — one per agent | `new-session-provider` | sessions |
| M8 | `+` | New {agent} session (advanced)… — one per agent | `new-session-advanced` | terminal |
| M9 | `+` | Continue last {agent} session… — one per agent | `continue-session` | terminal |
| M10 | `+` | Open file… (shows `Ctrl+Shift+O`) | `open-file` | files |
| M11 | `+` | New {agent} chat… / New {agent} chat ({mode}) — one per chat variant | `new-chat-provider` | chat |
| M12 | `+` | New window | `new-window` | projects |

## Decisions that override the area files (2026-11-08)

> Left on 2026-11-09: the credit no longer names agent-tablet and has no link (decision 1.10).
- About: the human's copyright, and one credit line to agent-tablet and Agent Session Manager.

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
Where an area file describes agent-tablet's behaviour and one of these says otherwise, this wins
(`plans/00-STATUS.md` §1):
  the agent is picked on Add session → New, where an agent that is not installed is greyed out. The
  menu counts above are agent-tablet's.

## Features

> Left on 2026-11-10: the header reorganized and the main menu removed (plan 24).
| F11 | Hide / unhide a session; "Show hidden sessions" in the main menu | sessions | R · S 1.17 |
| F48 | Open session file… (main menu): a `*.jsonl` transcript chosen from disk opens as a read-only replay tab | files | C |
| F52 | MCP servers browser (main menu) | chat | R |

## Menus

> Left on 2026-11-10: the header reorganized and the main menu removed (plan 24).
| M1 | Main (⚙, sidebar header) | Open session file… | `open-session-file` | files |
| M2 | Main | Show hidden sessions (a check) | `show-hidden` | sessions |
| M3 | Main | MCP servers | `mcp-servers` | chat |
| M4 | Main | Usage | `usage` | usage |
| M5 | Main | Preferences | `preferences` | preferences |
| M6 | Main | About Agent Tablet | `about` | preferences |
header's sidebar toggle and "Close all tabs" (two tabs or more); the tab strip's `+` and each tab's

> Replaced 2026-11-10: plan 24 was closed, and its lines name decision 1.34 instead. It was:
- No main menu (plan 24, 2026-11-10): its items moved to New ▾ (Open session file…), Add session →

## Features

> Left on 2026-11-10: replay removed from Menkar (decision 1.33).
| F9 | Replay a session in a tab (with "Show all") | sessions | R |
| F34 | Go to agent (`Ctrl+B g`): every tab of every window (sessions, files, chats, replays), filterable by state | agent-state | R · S 1.17 |
| F48 | Open session file… (New ▾): a `*.jsonl` transcript chosen from disk opens as a read-only replay tab | files | C |

## Menus

> Left on 2026-11-10: replay removed from Menkar (decision 1.33).
| M1 | New ▾ | Open session file… (after Open file…) | `open-session-file` | files |
| M28 | Session row | Replay… | `replay-session` | sessions |
| M39 | History row | Replay… | `replay-session` | sessions |

## Features

> Left on 2026-11-10: six themes kept, VS Code Dark the default (decision 1.41).
| F55 | Themes: Catppuccin by default, Tokyo Night, Gruvbox, Nord, Dracula and more, coloring the whole window; the Classic (Adwaita) style | preferences · look | R |

## Decisions that override the area files (2026-11-08)

> Left on 2026-11-10: Restart now no longer asks, even with sessions running (the human, 2026-11-10: its question opened behind Settings).
- "Restart now" asks and saves the layout as quitting does.

## Decisions that override the area files (2026-11-08)

> Left on 2026-11-10: Restart now asks about unsaved file edits first, on the Settings window (the human, 2026-11-10).
  (2026-11-10); quitting by closing the windows still asks.

## Features

> Left on 2026-11-10: F59, links in a terminal open with Ctrl+click (the human, 2026-11-10).
58 features.

## Decisions that override the area files

> Left on 2026-11-10: 1.9 amended, an agent that outlives the hang-up gets SIGCONT+SIGTERM after 3 s, then SIGKILL after 2 s more (the human, 2026-11-10).
- **Closing a running agent hangs up its pty** (SIGHUP), as closing a terminal does: close tab,
  Stop, `Ctrl+B x`, closing a window and quitting, after their confirmations. Nothing is typed —
  not `/exit`, and not `exit` into a leftover shell (its pty is closed the same way). (1.9)

## The features index (F59)

> Left on 2026-11-11: F59 no longer http(s) only; Ctrl+click hands any scheme to the system (decision 1.59).
| F59 | Links in a terminal open in the browser with `Ctrl+click`, as in GNOME Terminal: an address in the output (whole across the rows it wraps over) and an OSC 8 hyperlink, http(s) only; a plain click selects | terminal | Menkar 2026-11-10 |

## Specification — what agent-tablet does and how it looks

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
# Specification — what agent-tablet does and how it looks
What Menkar must do, feature by feature, read from agent-tablet (`~/git/agent-tablet`, `main` at
`2f6e564`): its README, its docs, its decision index and its code, read for behaviour and data
only. Each area file holds four parts: **Behaviour**, **Data contracts**, **Acceptance cases**,
**Look**. A feature plan of Menkar is designed from its area file; once the feature is built, its
plan moves what it built into `docs/<subsystem>.md` and trims the area file.
"Found in the code" marks a feature agent-tablet's README and docs do not name.

## The areas

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
| [`projects.md`](projects.md) | Projects, groups, tabs of up to two panes, several windows, the layout saved and reopened, agent-tablet's decisions 1.13, 1.15–1.19 |

## Command line

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
| `agent-tablet` | Opens the window | — |
| `agent-tablet open <file>…` | Opens the files in the window in use | files |
| `agent-tablet usage [--period today\|7d\|30d\|all] [--month YYYY-MM] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--by hour\|day\|month] [--json]` | The usage report in the terminal, no window | usage |

## Decided against agent-tablet

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
## Decided against agent-tablet
