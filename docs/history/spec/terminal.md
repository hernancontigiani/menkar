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

> Left on 2026-11-08: built by plan 11, described in `docs/window.md` and `docs/sessions.md`.
- **TRM-26** Terminal focused, `Ctrl+B` → PREFIX pill shown; the terminal received nothing; `v` → a
  shell pane opens to the right in the primary's folder, focused; pill hidden.
- **TRM-28** `Ctrl+B`, `q` (no command) → prefix ends, nothing happens, the terminal received
  nothing.
- **TRM-31** `Ctrl+B ?` → dialog `Ctrl+B, then…` with the 21 lines listed above, in that order, and
  `OK`.
- **TRM-32** Tab with two panes, `Ctrl+B -` → no third pane; toast `A tab holds two panes at most`
  for 4 s.
- **TRM-34** Tab split right (left: agent, right: shell focused), `Ctrl+B h` → the agent pane gets
  focus; `Ctrl+B h` again → focus stays; `Ctrl+B k` → focus stays.
- **TRM-35** Two panes, `Ctrl+B z` → only the focused pane shows; `Ctrl+B z` → both show; with one
  pane `Ctrl+B z` → nothing.
- **TRM-37** Tab side by side → tab menu `Swap the split's orientation` → stacked; again → side by
  side; on a single-pane tab → nothing changes.
- **TRM-38** Split (agent + shell), focus on the shell, `Ctrl+B x` → the shell is hung up; the agent
  pane fills the tab.
- **TRM-54** A new split shell pane → nothing is typed into it (no `syntax error` line); its frame
  label reads `shell`.

## Behaviour

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
> Decided (`plans/00-STATUS.md` 1.9): closing a running agent hangs up its pty; nothing is typed
> into it. Where this file describes `/exit` and `exit` being typed, that is agent-tablet's
> behaviour, not Menkar's.

## How a tab starts (F15)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
1. The app runs the user's login-independent interactive shell — `$SHELL`, or `/bin/bash` when
   `SHELL` is unset or empty — with no arguments, in a pseudo-terminal, with the app's own
   environment inherited unchanged, in the session's folder.
2. When the shell has started, the app types the agent's command line followed by `\n` into it
   (see Data contracts for each command). Typing it into the user's shell, instead of `exec`-ing the
   agent, keeps the user's aliases, functions and environment; and since the command ends with
   ` && exit`, the shell exits — and the tab closes — when the agent ends cleanly (exit status 0:
   `/exit`, `Ctrl+D` twice, `Ctrl+C` twice). An agent that fails to start (status ≠ 0) leaves the
   shell at its prompt with the agent's error visible; the tab stays open.
3. **The folder is gone.** If the session's folder does not exist (or is not a directory), the
   shell starts in the home folder and the terminal shows, before the shell's output, the app
   message `warning: project dir {cwd} no longer exists, starting in HOME`.
4. **The agent is not installed.** If the agent's executable (`claude`, `cursor-agent`) is not on
   the `PATH`, nothing is typed and the terminal shows `` warning: `{cli}` not found in PATH —
   starting a plain shell `` (`{cli}` is the executable's name).
5. **The shell cannot start.** The terminal shows `failed to start shell: {msg}`. agent-tablet puts
   the exception's message in `{msg}`; Menkar's rule forbids that: Menkar shows its own sentence
   (e.g. `The shell {shell} could not be started.`) and logs the error.
6. **App messages** are written to the terminal's display (not to the shell's input): a blank line,
   then `[session manager]` in bold yellow (SGR `1;33`), a reset, a space, the text, and a line
   break. The tag `[session manager]` is not translated in agent-tablet; Menkar names it as it
   chooses (e.g. `[menkar]`), through `t()` like the text.
7. **The tab closes when the shell exits** (not when the agent exits). If the tab has a split, only
   that pane goes (see Split panes).
8. **"Running"** — used by close, Stop, the window's close question and Remote Control — means:
   the terminal's foreground process group is something other than the shell itself (the agent, or
   any command the user started in that shell). A shell sitting at its prompt is not running.

## The kinds of start (F16)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
Every agent start of Claude Code carries `--settings <the app's settings file>` (the app's
statusline, `context.md`), written or rewritten just before the command is built when its content
would change. Cursor's commands carry no app flags. Each argument is shell-quoted (POSIX quoting:
left bare when it has only `A–Z a–z 0–9 @ % + = : , . / - _`, else single-quoted). The executable
is the absolute path found on the `PATH`.

| Start | Reached from | Tab title | Tab tooltip | Joins the project |
|---|---|---|---|---|
| **New** | Add session → New → Start session (`sessions.md`, F6), or via the advanced flow below | the name typed (or, if empty, the folder's name) | `new {Agent} session — {cwd}` | once its transcript has a message the user typed (1.16) |
| **Resume** (open) | a row's Open, double click, Existing → Add, reopen on start | the session's display name | `{project folder name} — {session id}` | it is already a member (opening makes it one: `projects.md`) |
| **Fork** (M35, Claude only) | Add session → Existing, a history row's menu, "Fork session" | `{display name} (fork)` | `{project folder name} — {source session id}` | as a new session, under its own new id |
| **Continue last** (M9) | `+` menu, "Continue last {Agent} session…" | the folder's name | `continue {Agent} — {cwd}` | as a new session; its transcript is the newest in the folder |
| **Advanced new** (M8) | `+` menu, "New {Agent} session (advanced)…" | as New | as New | as New |

The tooltip strings and ` (fork)` are not translated in agent-tablet; in Menkar they go through
`t()`.

**Resume of a session already in a tab** selects that tab instead of starting a second one (in this
window; across windows: `projects.md`). A fork always starts a new tab.

**Fork** is offered only for Claude Code (Cursor has no fork). The app chooses the fork's id (a new
random UUID) and starts it with `--resume <source id> --fork-session --session-id <new id>`; a fork
never carries Remote Control.

**Continue last** (M9): a folder chooser titled `Choose project directory` opens, starting at the
remembered folder (setting `new_session_dir`) when it still exists. Cancelling does nothing. A folder
not on this computer (a remote location) shows the error dialog `Choose a local folder` /
`This location is not on this computer. Choose a folder or file on a local disk.` (button `OK`) and
nothing starts. Otherwise the folder is remembered as `new_session_dir` and a tab starts the agent
with `--continue`. Since the session's id is not known beforehand, it never carries Remote Control.

**Advanced new session** (M8): the same folder chooser as Continue last (same title, start folder,
error and remembering), then a dialog:

- Heading `New {Agent} session`, body `Optional flags for this session.`
- **Model** — a drop-down: `Default` (no flag), then the agent's choices.
  Claude Code: `Opus` → `opus`, `Sonnet` → `sonnet`, `Haiku` → `haiku` (the CLI's aliases).
  Cursor: `Sonnet 4` → `sonnet-4`, `Sonnet 4 (thinking)` → `sonnet-4-thinking`, `GPT-5` → `gpt-5`.
- **Permission mode** — `Default` (no flag), then: Claude Code `Plan (read-only)` → `plan`,
  `Accept edits` → `acceptEdits`, `Bypass permissions` → `bypassPermissions`; Cursor
  `Plan (read-only)` → `plan`, `Ask (read-only)` → `ask`.
- **Extra directory** (Claude Code only) — subtitle `None` until chosen, then the chosen path;
  a `Choose…` button opens a folder chooser titled `Choose a directory`; a non-local choice shows
  the same `Choose a local folder` error and keeps the previous value. One directory at most.
- Buttons `Cancel` and `Start` (the suggested and default response).

`Start` opens Add session on **New**, at its name step with the folder already chosen and the agent
preselected (`sessions.md`); the chosen flags are carried to the start. Only `Default` is
translated in agent-tablet; the model and mode labels are literal (Menkar: through `t()`).
Edge: the agent drop-down on New can still be changed after the flags were chosen for another agent;
the flags are then translated for the agent finally chosen (Cursor keeps the model and drops a
permission mode other than `plan`/`ask`; Claude Code receives `--model sonnet-4` as given).

## A new session finds its transcript

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
A new, forked or continued tab watches for its transcript so it can join the project (1.16) and be
known by its id; this does not apply to a resume (its transcript is known) nor to a shell pane.

- Starting 1.5 s after the tab opens and every 1.5 s after that.
- **Id known** (a Claude Code new session or fork: the app chose it): it waits for exactly
  `<Claude projects dir>/<encoded folder>/<id>.jsonl`, for as long as the tab lives — the user may
  type the first message much later.
- **Id not known** (Continue last; any Cursor start): it takes the newest transcript of the folder
  (by modification time), and gives up after 120 tries (about 3 minutes).
- A new session whose tab closes before it has a typed message leaves nothing in the project; one
  typed just before closing still joins (`projects.md`).

## The embedded terminal (F15, F18)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
- Scrollback: the setting `scrollback`, default 10 000 lines, set from Preferences → Terminal →
  "Scrollback lines" (`preferences.md`; a value that is not a number keeps the previous one). The view does not scroll on output; it scrolls to
  the bottom on a keystroke. The mouse pointer hides while typing. Scrollbars appear when needed.
- Font: the setting `font` (empty = the terminal's default monospace). Colors: from the effective
  theme (`preferences.md`, `look.md`). Changing either in Preferences applies to every open terminal
  at once.
- The terminal takes focus when its tab is opened or selected, when a pane is split or closed, and
  when the find bar closes.

**Keys handled by the terminal** (only while a terminal has focus; any other key goes to the
agent):

| # | Key | Does |
|---|---|---|
| K15 | `Shift+Enter` (also keypad Enter and ISO Enter; not with `Ctrl`) | sends `ESC CR` (bytes `1B 0D`), which Claude Code reads as "insert a line break" instead of "submit" (terminals send the same byte for Enter and Shift+Enter) |
| K16 | `Ctrl+Shift+C` | copies the terminal's selection as plain text to the clipboard |
| K17 | `Ctrl+Shift+V` | pastes the clipboard into the terminal (as a paste: the terminal's bracketed-paste applies) |
| K18 | `Ctrl+Shift+G` | opens the find bar, or closes it if open |

`Ctrl+Shift+V` in a file tab is the Markdown preview (`files.md`); window-level shortcuts
(`Ctrl+Shift+T`, `Ctrl+Shift+W`, `Ctrl+Tab`… `look.md`/`projects.md`) are taken before the terminal
sees them, for every event type of the key.

**Find in terminal** (K18): a bar above the terminal with a search field (placeholder
`Find in terminal…`), an "up" button (tooltip `Previous match`), a "down" button (tooltip
`Next match`) and a close button.

- The text is searched literally (no regular expression), case-insensitive, across line breaks,
  wrapping around at either end; matches are highlighted.
- Typing searches upwards from the bottom: the nearest match above the prompt is selected.
- `Enter` and the up button go to the previous match (upwards); the down button and the search
  field's "next match" key (`Ctrl+G`) go to the next one; `Ctrl+Shift+G` inside the field goes to
  the previous match.
- An empty field clears the highlight. `Esc` or the close button closes the bar, clears the
  highlight and gives focus back to the terminal.
- Each terminal pane has its own bar.

## The `Ctrl+B` prefix (F19, K19–K39)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
herdr's / tmux's style: `Ctrl+B`, released, then one key.

- `Ctrl+B` (with `b` or `B`) is caught by the window before the focused widget, **unless** the focus
  is in a text field (a search box, an entry) or inside a dialog — those keep their own `Ctrl+B`.
  It is not sent to the terminal.
- While the prefix waits, a **PREFIX** pill shows on the tab strip. It waits indefinitely (no
  timeout).
- Modifier keys alone (`Shift`, `Ctrl`, `Alt`, `Super`, `AltGr`, `Caps Lock`) do not end it, so
  `Shift` can be pressed on the way to `N`, `T`, `X`, `%`, `"`, `?`.
- The next other key ends the prefix (the pill hides) and runs its command; **a key with no command
  just ends the prefix** and is not sent to the terminal either.
- `Ctrl+B` again (K39) sends the byte `02` (`Ctrl+B`) to the focused pane of the current tab (if the
  current tab is a terminal tab).

| # | Keys | Does |
|---|---|---|
| K19 | `v` or `%` | split right: a shell beside the focused pane |
| K20 | `-` or `"` | split down: a shell below the focused pane |
| K21 | `h` or `←` | focus the pane to the left |
| K22 | `j` or `↓` | focus the pane below |
| K23 | `k` or `↑` | focus the pane above |
| K24 | `l` or `→` | focus the pane to the right |
| K25 | `Tab` | focus the next pane |
| K26 | `z` | zoom the focused pane / unzoom |
| K27 | `x` | close the focused pane (a single pane: close the tab) |
| K28 | `c` | new session in this project (Add session on New; `sessions.md`) |
| K29 / K30 | `n` / `p` | next / previous tab of this project (`projects.md`) |
| K31 | `1`–`9` | go to the project's tab N, if it exists (`projects.md`) |
| K32 | `N` | Add session on Existing (`sessions.md`) |
| K33 | `T` | rename tab (`projects.md`) |
| K34 | `X` | close tab (`projects.md`) |
| K35 | `g` | Go to agent (`agent-state.md`) |
| K36 | `b` | toggle the sidebar (`look.md`) |
| K37 | `s` | Preferences (`preferences.md`) |
| K38 | `?` | the prefix help |
| K39 | `Ctrl+B` | send `Ctrl+B` to the terminal |

Pane commands (K19–K27) do nothing when the current tab is not a terminal tab (a file, chat or
replay tab).

**The prefix help** (K38): a dialog with heading `Ctrl+B, then…`, a monospace block of one line per
command — the keys left-aligned in 8 columns, a space, the description — and an `OK` button. The
lines, in this order (descriptions are translated):

```
v  %     split right (a shell)
-  "     split down (a shell)
h  ←     pane to the left
j  ↓     pane below
k  ↑     pane above
l  →     pane to the right
Tab      next pane
z        zoom the pane
x        close the pane
c        new session in this project
n        next tab
p        previous tab
1–9      go to tab
N        add a session
T        rename tab
X        close tab
g        go to agent
b        toggle sidebar
s        preferences
?        this help
Ctrl+B   send Ctrl+B to the terminal
```

## Split panes (F20)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
A tab holds **at most two panes**, side by side or stacked. The first pane (the *primary*) names
the tab; either pane may hold an agent session or a plain shell.

- **Split** (K19 right, K20 down): a new plain **shell** pane opens next to the focused pane, in the
  primary pane's folder (the folder-gone warning applies), runs no agent, and takes focus. The two
  panes share the space evenly once laid out; neither can be shrunk below its minimum size; the
  divider is a thin line that can be dragged. Splitting a zoomed tab unzooms it first.
  - A tab with two panes already: nothing splits, and a toast says `A tab holds two panes at most`
    (4 s).
  - **Bug in agent-tablet, not to be carried:** the shell pane is typed ` && exit` + Enter at
    start (an empty command with the ` && exit` suffix), so `bash` prints
    `` syntax error near unexpected token `&&' `` in every new split. Menkar types nothing into a
    shell pane.
- **A session beside the current tab** ("Open beside the current tab", M19, `projects.md`) is
  always placed side by side, and carries the session's Remote Control.
- **Focus by direction** (K21–K24): among the visible panes, those whose center lies strictly
  ahead of the focused pane's center along that axis; the nearest wins, with the sideways offset
  counted double (`distance = ahead + 2 × |sideways|`). None ahead: focus stays.
- **Next pane** (K25): the next one in layout order (left/top first), wrapping around. One pane:
  nothing. While zoomed, agent-tablet asks focus for the hidden pane and does not unzoom (the
  toolkit gives no focus to a hidden widget, so nothing visible happens); not specified further.
- **Zoom** (K26): with two panes, shows only the focused one, filling the tab; again restores both.
  With one pane: nothing. Closing a pane unzooms; a refused split (tab full) leaves the zoom.
  Zoom is not saved with the layout.
- **Swap the split's orientation** (M15, the tab's right-click menu): side by side ⇄ stacked; the
  item is always in the menu and does nothing on a tab without a split. The orientation is saved
  with the layout and restored (`projects.md`).
- **Close the pane** (K27): with one pane, closes the tab (graceful, below). With two, **stops the
  focused pane**: a Claude Code session pane whose agent is running is typed `/exit` + Enter (its
  shell then exits through ` && exit`); any other pane (a shell, a Cursor session, an agent not
  running) is hung up (SIGHUP to its shell). There is no time-out fallback for a single pane.
- **A pane's shell exits** (by any means): in a split, that pane is removed and the other pane takes
  the whole tab and becomes the primary; the tab's title is recomputed from the sessions left (a
  tab of two sessions is titled `{name 1} │ {name 2}`; with only a shell left, the title stays).
  Alone, the tab closes.
- A frame around each terminal is labelled with the pane's agent id (`claude`, `cursor`) or
  `shell` — visible in the terminal-workspace (TUI) style only (Look).

## Closing a tab: graceful exit (F17)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
Closing a terminal tab — its ×, `Ctrl+Shift+W` (K4), the tab menu's Close, `Ctrl+B X`, "Close all
tabs", Stop on a single-pane tab, closing the window, deleting a project, Remove from project —
goes through this:

1. **Nothing running** in any pane: the tab closes at once; the split shell, if any, is hung up and
   the primary's terminal is destroyed (its shell is hung up).
2. **Something running**, and **every running pane's agent has a clean exit** (Claude Code; a split
   shell counts as its tab's agent): the tab stays, and each running pane is typed `/exit` + `CR`.
   Every 300 ms the app checks the panes:
   - none running any more: each pane is typed `exit` + `CR` (a shell left at its prompt — e.g. an
     agent that failed — exits, and the tab with it);
   - after 40 checks (about 12 s) something still runs: the tab is **force-closed** (as in 1,
     whatever runs is hung up).
3. **Something running whose agent has no clean exit** (Cursor; decision 1.15): the whole tab is
   force-closed at once — including a Claude Code pane beside it, which then gets no `/exit`.
4. Closing a tab again while its graceful exit is under way does not restart it nor force it.
5. Edge, as agent-tablet does it: a split shell running a command (say a pager) beside a Claude
   Code session is also typed `/exit` + `CR`, since the shell pane's agent is the tab's.

**Stop** (M20, a session row's menu, `projects.md`): if the session has no tab, nothing. If its tab
holds only it, the tab is closed (as above). If its tab has two panes, only its pane is stopped (as
`Ctrl+B x` on that pane).

When a session's tab or pane goes, the session is no longer running: its row's dot shows stopped
and Remote Control's "live" state ends (`remote-control.md`).

## Closing a window and quitting (F25, F27 — the terminal side)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
The questions and the layout belong to `projects.md`; what the terminals do:

1. Unsaved file tabs are asked about first (`files.md`).
2. The window lists its running panes: each one's session display name, or the agent's name
   (`Claude Code`, `Cursor`) for a pane with no session yet (a new session not yet joined, a split
   shell running a command).
3. None: the window closes at once. Some: a confirmation —
   heading `Stop {n} running session(s)?`, body the names joined by `, `, a blank line, then
   `Their conversations stay in Claude.`; buttons `Cancel` (default) and `Stop and close`
   (destructive).
4. On `Stop and close`: the layout is saved first (so reopening restores these tabs), every tab is
   closed through the graceful exit above, and the window closes once it has no tabs, checked every
   300 ms, or after 50 checks (about 15 s) regardless. Closing the last window quits the app.

## Command lines

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
`{cli}` is the executable's absolute path from the `PATH`; `{settings}` the app's settings file,
`$XDG_CONFIG_HOME/menkar/claude-settings.json` (agent-tablet: `…/agent-tablet/claude-settings.json`;
its content: `context.md`). `[ ]` = present only when set. Every line is typed into the shell
followed by ` && exit` and `\n`.

Built by `src/core/command.ts` (its tests carry the TRM ids); `docs/window.md` describes it.

- `-n {name}` is given only when a name was typed (New requires one: `sessions.md`).
- `--remote-control={rc name}` is one argument (`remote-control.md`).
- Flag order above is the order on the line: options, identity, then the app's session flags last.
- `{new id}` is a random UUID (version 4) chosen by the app.

## The CLI's checked behaviour (Claude Code 2.1.319, agent-tablet `docs/projects.md`, 2026-11-06)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
| Fact | Consequence |
|---|---|
| `--session-id <uuid> -n <name>`: the transcript is `<uuid>.jsonl`; its first lines carry the name (`custom-title`, `agent-name`) before the first `user` line | the app knows a new session's transcript path |
| `--fork-session --session-id <uuid>` together are accepted; the fork's transcript takes that id | same, for a fork |
| `--continue` keeps the id of the session it continues; creates no new file | Continue last resolves the newest transcript of the folder |
| `/exit`, `Ctrl+D` twice, `Ctrl+C` twice exit with status 0; a failing start (e.g. an invalid `--session-id`) exits with 1 | ` && exit` closes the tab on every clean way out and keeps a failed start's message |
| `/exit` before any typed message writes a transcript with the name and the `/exit` command but no typed message; `Ctrl+D`/`Ctrl+C` before typing write none | neither joins a project |
| In 2.1.319 the folder-trust dialog defaults to "No, exit" | a new folder's first start may end at once with status ≠ 0 |

Cursor's `--continue` and `--mode` are passed as the code does; they were not re-checked against
`cursor-agent` for this spec.

## Bytes sent to a terminal

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
| What | Bytes | When |
|---|---|---|
| The start command | `{command} && exit\n` | once the shell has started |
| Newline in the prompt | `1B 0D` (ESC CR) | `Shift+Enter` |
| Literal `Ctrl+B` | `02` | `Ctrl+B Ctrl+B` |
| Graceful exit (Claude Code) | `/exit\r` | closing a tab with a running agent; stopping a pane (**conflict, above**) |
| Leftover shell | `exit\r` | graceful exit, once no pane runs anything |
| Hangup | SIGHUP to the pane's shell process | force close, closing a non-agent pane |

## Transcript locations (for a new session's resolution)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
| Agent | Path |
|---|---|
| Claude Code | `~/.claude/projects/<folder with every character outside A–Z a–z 0–9 replaced by "-">/<id>.jsonl` (e.g. `/home/ana/src/shop_v2` → `-home-ana-src-shop-v2`); only file names that are UUIDs count as transcripts |
| Cursor | `~/.cursor/projects/<the same encoding, leading "-" removed>/agent-transcripts/<id>/<id>.jsonl`; the newest by modification time |

## Settings read (from `state.json` → `settings`, `preferences.md`)

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
| Key | Type | Default | Used for |
|---|---|---|---|
| `font` | string (font description, e.g. `"Monospace 11"`) | `""` (terminal default) | terminal font |
| `scrollback` | integer | `10000` | scrollback lines |
| `color_scheme`, `terminal_theme` | string | `"system"`, `"Default"` | terminal colors |
| `ui_style` | `"tui"` \| `"classic"` | `"tui"` | the frame label's visibility |
| `new_session_dir` | string (folder) | `""` | start folder of the advanced / continue choosers; written with the chosen folder |

## Environment

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
`SHELL` (the shell to run; `/bin/bash` if unset or empty); `PATH` (finding `claude`,
`cursor-agent`); everything else inherited by the shell unchanged. `XDG_CONFIG_HOME` for the
settings file.

## Timers

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
| What | Value |
|---|---|
| Graceful-exit check | every 300 ms, force-close after 40 checks (~12 s) |
| Window close wait | every 300 ms, close after 50 checks (~15 s) |
| New session's transcript lookup | every 1.5 s; unknown id: give up after 120 tries (~3 min); known id: until the tab closes |
| Toast `A tab holds two panes at most` | 4 s |

## Acceptance cases

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
The prefix and split cases built and tested (TRM-26, 28, 31, 32, 34, 35, 37, 38, 54) left for the history;
the tests carry their ids.

Built and tested (TRM-1–9, 49, 53) left for the history; the Vitest and e2e tests carry their ids.

Examples use `claude` at `/usr/local/bin/claude`, `XDG_CONFIG_HOME=/home/ana/.config`, so
`{settings}` = `/home/ana/.config/menkar/claude-settings.json`.

- **TRM-10** `claude` not on the `PATH`, resume → nothing typed; the terminal shows
  `` [session manager] warning: `claude` not found in PATH — starting a plain shell `` (tag in bold
  yellow) and the shell prompt.
- **TRM-11** Resume a session whose folder `/home/ana/old` was deleted → the shell starts in
  `/home/ana`; the terminal shows `warning: project dir /home/ana/old no longer exists, starting in HOME`
  first, then the typed command.
- **TRM-12** `SHELL` unset → `/bin/bash` runs.
- **TRM-13** The agent exits with status 0 (`/exit`) in a single-pane tab → the shell exits through
  ` && exit` and the tab closes.
- **TRM-14** The agent exits with status 1 (failed start) → the tab stays open at the shell prompt
  with the agent's error visible; the tab counts as not running.
- **TRM-15** Advanced menu item, folder chooser cancelled → no dialog, no tab, `new_session_dir`
  unchanged.
- **TRM-16** Advanced or Continue with a non-local folder (e.g. an SFTP location) → error dialog
  `Choose a local folder` / `This location is not on this computer. Choose a folder or file on a local disk.`; no tab.
- **TRM-17** Advanced dialog for Cursor → no `Extra directory` row; Model lists `Default`,
  `Sonnet 4`, `Sonnet 4 (thinking)`, `GPT-5`; Permission mode lists `Default`, `Plan (read-only)`,
  `Ask (read-only)`.
- **TRM-18** Advanced dialog → `Start` opens Add session on New at the name step with the folder
  shown and the agent preselected; `Cancel` closes with nothing started.
- **TRM-19** New Claude Code session, the user types nothing for 10 minutes, then a first message →
  the session joins the current project after the message (the lookup was still waiting for
  `{id}.jsonl`).
- **TRM-20** Continue last in a folder with no transcript ever appearing → after 120 lookups
  (~3 min) the tab stops looking; it never joins a project.
- **TRM-21** Terminal focused, `Shift+Enter` → the agent receives `1B 0D`; plain `Enter` → `0D`;
  `Ctrl+Shift+Enter` → not intercepted (goes to the terminal as is).
- **TRM-22** Text selected, `Ctrl+Shift+C` → the clipboard holds the selection as plain text;
  `Ctrl+Shift+V` → the clipboard's text is pasted into the terminal.
- **TRM-23** Terminal showing `Error: Timeout` 50 lines up, `Ctrl+Shift+G`, type `timeout` → the find
  bar opens, the match is selected and scrolled to (case-insensitive); `Esc` → the bar closes, the
  highlight goes, the terminal has focus.
- **TRM-24** Find text `a.b` → matches only the literal `a.b`, not `axb`.
- **TRM-25** Find with two matches, after the last one the down button → wraps to the first.
- **TRM-27** `Ctrl+B`, `Shift` (held), `N` → Add session opens on Existing (Shift did not end the
  prefix).
- **TRM-29** `Ctrl+B`, `Ctrl+B` → the focused pane receives byte `02`; the pill hides.
- **TRM-30** Focus in the sidebar's search field or in any dialog, `Ctrl+B` → no prefix; the field
  handles the key.
- **TRM-33** Current tab is a file tab, `Ctrl+B v` → nothing.
- **TRM-36** Zoomed two-pane tab, `Ctrl+B x` → the focused pane stops; the other pane shows,
  unzoomed, filling the tab. Zoomed, `Ctrl+B l` → focus stays (hidden panes are skipped).
- **TRM-39** Split (Claude Code session running + shell), focus on the agent, `Ctrl+B x` →
  `/exit\r` is typed into the agent pane; after it exits the shell remains alone and is the tab's
  primary; the tab title is unchanged.
- **TRM-40** Single-pane tab, `Ctrl+B x` → the same as closing the tab (TRM-41…).
- **TRM-41** Close a tab whose Claude Code agent is running → the tab stays; `/exit\r` is typed; when
  the agent has exited, `exit\r` is typed; the tab closes.
- **TRM-42** Close a tab whose Claude Code agent ignores `/exit` (still running after 40 checks) →
  the tab is force-closed at about 12 s.
- **TRM-43** Close a tab whose Claude Code agent failed (shell at its prompt) → the tab closes at
  once, nothing typed.
- **TRM-44** Close a Cursor tab with `cursor-agent` running → the tab closes at once (force), nothing
  typed.
- **TRM-45** Tab with a running Claude Code session beside a running Cursor session, close → the
  whole tab is force-closed at once; no `/exit` typed.
- **TRM-46** Press × twice on a tab during its graceful exit → one `/exit\r` typed in total; the
  12 s timer is not reset.
- **TRM-47** Stop (row menu) on a session in a two-pane tab → only its pane stops; the other pane
  stays and becomes the primary.
- **TRM-48** Stop on a session with no tab → nothing.
- **TRM-50** Close a window with no running pane → no dialog; it closes.
- **TRM-51** Close a window whose agent never exits → the window closes after about 15 s anyway.
- **TRM-52** A new-session tab not yet joined (no typed message) is running at window close → it is
  listed as `Claude Code`.
- **TRM-55** Change the font in Preferences → every open terminal uses it at once.
- **TRM-56** `scrollback` set to `"abc"` in `state.json` → terminals keep 10 000 lines.

## Look

> Left on 2026-11-08: built and tested by plan 15, described in `docs/window.md`.
- `img/open-tab-dark.png` (light: `img/open-tab-light.png`) — a resumed session's tab in the
  terminal-workspace style: the frame labelled `claude`, the app's `[session manager]` warning (bold
  yellow tag) for a folder that no longer exists, then the typed command ending in
  `--settings …/claude-settings.json && exit`.
- `img/tab-menu-dark.png` (light: `img/tab-menu-light.png`) — the tab's right-click menu: `Rename…`,
  `Copy session ID`, `Swap the split's orientation`, `Close` (shown on a file tab, so without the
  Remote control section).

Measurable details:

- **Terminal frame** (TUI style only; `look.md` for the palette tokens): 1 px solid border in the
  theme's `surface1`; square corners; margins 12 px top, 6 px right, bottom and left (room for the
  label); the border turns the theme's accent while any widget inside has focus. The label (agent
  id or `shell`) sits on the top border line, 10 px from the left, in the accent color, on the
  window background, with 4 px padding left and right, pulled up 9 px. The terminal has 2 px
  vertical and 6 px horizontal padding. In the Classic style the frame has the toolkit's default
  look and no label.
- **App messages**: bold yellow (ANSI SGR 1;33, the theme's palette yellow) tag, default color text.
- **Find bar**: across the top of the pane, above the frame; the search field takes the width, then
  the up button (icon: an upward chevron, `go-up-symbolic`), the down button (a downward chevron,
  `go-down-symbolic`), 6 px apart, then the bar's close button (×).
- **PREFIX pill**: the text `PREFIX` on the tab strip, right after the tabs, vertically centered;
  accent background, accent foreground text, bold, 0.8 em, padding 1 px × 8 px, margin 0 × 6 px.
  Hidden except while the prefix waits.
- **Prefix help**: a standard alert dialog; the block in the monospace font, left-aligned.
- **Split**: a thin divider (not the wide handle) between the panes; each pane has its own frame
  (TUI), so the focused pane is the one with the accent border.
- **Advanced dialog**: an alert dialog with a boxed list of three rows (two drop-down rows, one row
  with the chosen path as subtitle and a `Choose…` button on the right); `Start` in the suggested
  (accent) style.
- **Window close confirmation**: an alert dialog, `Stop and close` in the destructive (red) style.
