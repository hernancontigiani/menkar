# History of `docs/spec/terminal.md`

## Behaviour

> Left on 2026-11-08: built by plan 08, described in `docs/window.md`.
> **Conflict with CLAUDE.md, for `set`.** Menkar's rule: *"Nothing is typed into a running
> agent's terminal on the user's behalf: at a permission prompt an Enter approves the highlighted
> choice, and a half-written message would be sent."* agent-tablet's graceful close (F17) does
> exactly that: closing a tab, Stop, `Ctrl+B x`, closing a window and quitting all type
> `/exit` + Enter into every running Claude Code pane, whatever the agent is showing — at a
> permission prompt the Enter lands on the prompt's highlighted choice, and with a half-written
> message `/exit` is appended to it and the whole line sent. Once the agents are gone it also types
> `exit` + Enter into each pane's shell. agent-tablet's own Remote Control design (`remote-control.md`)
> refuses to type `/rc` for that very reason, so agent-tablet is inconsistent with itself here.
> Specified below as agent-tablet does it (§ Graceful close); whether Menkar keeps it, and how
> (e.g. a hangup / SIGTERM to the agent instead), is the human's decision. Two related typings,
> outside the rule's letter because no agent is running yet, for `set` to confirm: the agent's
> command typed into a fresh shell at start (§ How a tab starts), and a split shell receiving a
> stray ` && exit` (§ Split panes, a bug).

## Command lines

> Left on 2026-11-08: built by plan 08, described in `docs/window.md`.
| Start | Claude Code (`claude`) | Cursor (`cursor-agent`) |
|---|---|---|
| New | `{cli} [--model M] [--permission-mode P] [--add-dir D] --session-id {new id} -n {name} [--remote-control={rc name}] --settings {settings}` | `{cli} [--model M] [--mode plan\|ask]` (no id, no name) |
| Resume | `{cli} --resume {id} [--remote-control={rc name}] --settings {settings}` | `{cli} --resume {id}` |
| Fork | `{cli} --resume {id} --fork-session --session-id {new id} --settings {settings}` | — (not offered) |
| Continue last | `{cli} --continue --settings {settings}` | `{cli} --continue` |
| Split shell | nothing (Menkar; see the bug above) | nothing |

## Acceptance cases

> Left on 2026-11-08: built by plan 08, described in `docs/window.md`.
- **TRM-1** New Claude Code session, folder `/home/ana/src/shop`, name `checkout flow`, Remote
  Control off, app-chosen id `0b6c…e1` → the shell in `/home/ana/src/shop` is typed
  `/usr/local/bin/claude --session-id 0b6c…e1 -n 'checkout flow' --settings /home/ana/.config/menkar/claude-settings.json && exit`
  and Enter; the tab is titled `checkout flow`.
- **TRM-2** Resume session `7f3a…` whose Remote Control is off → typed
  `/usr/local/bin/claude --resume 7f3a… --settings /home/ana/.config/menkar/claude-settings.json && exit`.
- **TRM-3** Fork of `7f3a…` (Remote Control on for `7f3a…`), new id `c41d…` →
  `… --resume 7f3a… --fork-session --session-id c41d… --settings … && exit`, no
  `--remote-control`; tab titled `{name} (fork)`.
- **TRM-4** Continue last Claude Code session in `/home/ana/src/shop` → `… --continue --settings … && exit`;
  tab titled `shop`; `new_session_dir` becomes `/home/ana/src/shop`.
- **TRM-5** Advanced new Claude Code session with Model `Opus`, Permission mode `Accept edits`, extra
  directory `/home/ana/docs`, name `api` → `… --model opus --permission-mode acceptEdits --add-dir /home/ana/docs --session-id {id} -n api --settings … && exit`.
- **TRM-6** Advanced new with every field at `Default` and no extra directory → the line has no
  `--model`, `--permission-mode` nor `--add-dir`.
- **TRM-7** New Cursor session, Model `GPT-5`, Permission mode `Ask (read-only)`, name `spike` →
  `{cursor-agent path} --model gpt-5 --mode ask && exit`; no id, no name, no `--settings`; tab titled
  `spike`.
- **TRM-8** Resume a Cursor session `ab12…` → `{cursor-agent path} --resume ab12… && exit`.
- **TRM-9** A name containing `Ana's` → it is passed as one shell word: `-n 'Ana'"'"'s'`.
- **TRM-49** Close a window with two running sessions `api` and `web` → dialog
  `Stop 2 running session(s)?`, body `api, web` + blank line + `Their conversations stay in Claude.`;
  `Cancel` → nothing; `Stop and close` → layout saved, both tabs exit gracefully, the window closes.
- **TRM-53** Open a session already in a tab of this window → its tab is selected; no second agent
  starts.
