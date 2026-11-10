# History of `docs/spec/README.md`

## Features

> Left on 2026-11-09: one New ▾ menu; the advanced new session, Continue last and New chat removed (decision 1.30).
| F16 | Start, resume, fork, continue last (per provider), advanced new session (model, permission mode, extra directories, continue) | terminal | R · S 1.17 |
| F50 | Native streaming chat tabs with permission cards (Allow once / Always allow / Deny); New chat; Continue in chat (Cursor: ask, trusted) | chat | R · S 1.17 |

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
