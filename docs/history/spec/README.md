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
