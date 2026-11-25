# Deliberately not built yet

Each entry is a decision to defer, not an oversight, listed with the **trigger** that should reopen
it. A piece with no consumer is deferred here instead of being designed blind.

What a plan will build in its turn does not belong here: the roadmap is `plans/00-STATUS.md`.

An entry is:

```
### <What is not built>

Why it is deferred, and what would go wrong if it were built now.

**Trigger:** the concrete situation that reopens it, and the first question to answer then.
```

### Sessions that survive quitting the app

Quitting stops every agent; the next start resumes the ones that were in tabs (`docs/spec/projects.md`).
Keeping them alive would need a process that outlives the app and owns the pseudo-terminals (tmux,
dtach, or a daemon of Menkar's own), to install and reason about on three systems.

**Trigger:** the human loses work to a quit, or wants an agent to keep working with the app closed.
First question: does resuming lose anything the agent had not written to its transcript?

### Dragging a row onto a tab

"Open beside the current tab" from a row's menu puts a session in a tab's second pane; a row is not
dragged onto a tab. Rows reorder by dragging within their group (2026-11-10), and tabs within their
strip (decision 1.23).

**Trigger:** the human misses dragging a row onto a tab to open it beside.

### More than two panes in a tab

Two panes are what the human uses; more is unreadable at a laptop's width.

**Trigger:** a workflow that needs three agents in view at once. First question: a third pane, or a
second window on another monitor?

### Choosing which monitor a window opens on

On Wayland an app cannot place its windows, Electron's included; reopened windows land where the
compositor puts them. On X11, Windows and macOS a saved position could be restored, which would make
the same layout behave differently per system.

**Trigger:** the human rearranges windows by hand after every start. First question: does the
compositor offer a portal for it by then, and is a per-system behaviour acceptable meanwhile?

### Claude Code hooks

The statusline gives the context, the cost and the limits; the transcripts give tokens and time.
No hook event carries any of them, so the app installs none. The integrations menu is where a hook
would go, consented to and removable like the statusline.

**Trigger:** a feature needs an event the statusline and the transcript cannot give (for example,
knowing the instant a permission prompt appears). First question: can it ride `--settings` for the
sessions the app starts, before asking for a global install?

### Correcting a turn's category by hand

A turn's category is Haiku's (`docs/spec/classifier.md`), and nothing lets the human change one. A
correction would need a place per turn in the Usage window, which shows sessions, not turns, and a
rule for what a later classification does to it.

**Trigger:** the human finds a day's categories wrong often enough to want to fix them. First
question: whether a correction is per turn or "this session, from here on", and whether a corrected
turn keeps its category when its transcript is classified again.

### A local classifier model

Classification goes through Haiku with the user's login: it needs the network and the user's quota.
In the classifier's evaluation no local model came close to Haiku's agreement with the human's labels
(`docs/spec/classifier.md`), and each needed a download of hundreds of megabytes to gigabytes that an
installer would have to ship or fetch.

**Trigger:** a local multilingual model is published that reaches Haiku's agreement on the
evaluation set, or the human wants classification without the network. First question: whether it
runs inside the app or as a separate download the user accepts.

### Pruning the usage history

The history keeps every turn forever: two months of the human's use took a few megabytes, so years fit without a limit, and a limit would drop exactly what the history exists to
keep.

**Trigger:** the history file passes 200 MB on the human's machine. First question: whether old
turns are summed into one row per session and day (keeping the totals) or dropped.

### A file beside a session, in a pane

A tab holds sessions or one file; a file is not put in a pane next to its agent. Panes are terminals,
and a pane holding an editor changes what a tab's saved layout holds and what closing a pane means
for a session.

**Trigger:** the human wants a plan open next to the agent that executes it. First question: whether
the file pane counts toward the two panes of a tab, and whether it moves with the session.

### Search over a project's folders

Opening a file is a typed path or the system's chooser, which starts in the project's folder only
when all its sessions share one (`docs/spec/files.md`). A search over the folders a project's
sessions run in would need a project to name its folders, which it does not.

**Trigger:** browsing for the same repository's files is what the human does most when opening one.
First question: whether a project's folders are named by hand or taken from its sessions' folders.

### Previews of other formats

Only Markdown has a rendered view. Images, PDF and HTML open, if at all, as text, and a binary file
is refused.

**Trigger:** the human asks for one. First question: whether it is a preview tab like Markdown's or
the default application, opened outside the app.

### More interface languages

Menkar speaks English and Spanish, both complete (`plans/00-STATUS.md` §1 1.11). Agent Session
Manager's German, French and Hungarian catalogs were left out: every new string would need three
translations nobody here can check, and a stale catalog shows a mix of languages.

**Trigger:** someone asks for a language. First question: who reviews its translation, and whether a
partial catalog is acceptable or `check-i18n` holds it to complete like Spanish.

### Native Windows

Menkar ships for Linux only: a release states Linux's `.deb` and `.rpm`, and people install them
where they like. **WSL2 is neither tested nor promised** (the human, 2026-11-19, decision 1.190).
A Windows port is a second platform to build, package and check by hand before every release, with
no user asking for it yet.

What it would take, from the Linux-only pieces found on 2026-11-09 (not exhaustive):

- `src/core/tilde.ts`: home prefix compared with `/`; Windows paths are `C:\Users\…`.
- `src/core/remote/live.ts` / `src/main/remote-live.ts`: the agent's pid found through `/proc`.
- `src/core/launch.ts` / `src/main/index.ts`: detaching uses `setsid` semantics; closing agents
  relies on SIGHUP (decision 1.9).
- Terminals start `bash` (`$SHELL`); Windows needs a shell chosen: Git Bash (Claude Code on
  Windows already needs Git for Windows), PowerShell, or WSL.
- Terminal links (1.53): Claude Code turns OSC 8 hyperlinks on from the environment; Menkar sets
  `FORCE_HYPERLINK=1`. Check on Windows what Claude Code reads there (it also knows `WT_SESSION`)
  and that links still span the rows it breaks, in the shell chosen. Not investigated yet.
- Packaging: a `.deb` with an AppArmor profile; Windows needs an installer (NSIS/MSI).
- e2e: runs under `xvfb` (`MENKAR_E2E_XVFB`), absent on Windows.
- Notifications, the dock badge, `gsettings` reads in docs and scripts.
- Terminals run on ConPTY through node-pty there: the same `Terminal` class, a different backend
  to verify; there is no SIGHUP, so the hang-up of 1.9 / 1.48 needs its Windows equivalent (the
  two entries below).
- The native pieces (dialogs, the trash, `openPath`, drag out, the frameless window's snapping)
  are checked by hand there; the UI itself is Electron's Chromium everywhere.

**Trigger:** users ask for it. First question: the shell of Menkar's terminals on Windows (Git
Bash, PowerShell or WSL), and whether every platform-specific call goes behind one module per
concern, with a code-rules check that keeps new Linux-only calls out of shared code.

### Ending what outlives a hang-up on macOS and Windows

After a pty is hung up, its session's survivors are found through Linux's `/proc` (sid = the
shell's pid) and get SIGCONT, SIGTERM and then SIGKILL (`src/main/reap.ts`). macOS has no `/proc`,
and Windows has neither sessions nor these signals, so there only the hang-up itself is sent.

**Trigger:** native Windows (the entry above) or a macOS port. First question: how node-pty's
ConPTY ends its child tree on Windows, and whether macOS's `ps -o sess` gives the same session to
follow.

### The live Remote Control phone on macOS and Windows

The claude process behind a pane is found through Linux's `/proc` (its shell's children and their
command lines, and the start time that guards a reused pid). macOS and Windows have no `/proc`, so
there the phone falls back to the app's own list.

**Trigger:** native Windows (above) or a macOS port. First question: whether Claude Code's
registry keeps the same shape there, and how each system lists a process's children.

### An MCP server for usage

`menkar usage export` hands an LLM session the history's turns as rows it reads through its shell
(decision 1.16). A server (`menkar mcp`, with tools such as `query_usage`) would let a session ask
for exactly the slice it needs instead, but it is one more process and protocol to keep working,
and Claude only reaches it once registered in Claude's settings, which is the integrations menu's
consent, not a side effect.

**Trigger:** the export proves too coarse for a real analysis, or the human asks for it. First
question: which questions the export could not answer, so the tools are shaped by them.

### More coding agents: Codex, OpenCode

Menkar runs two agents today: Claude Code and Cursor's terminal agent (`cursor-agent`), registered in
`src/core/agents/ids.ts`. The human wants OpenAI's Codex CLI and OpenCode too (2026-11-10); Codex comes
before 1.0 (1.127). Pi is left out: its users are another public, unlikely to use Menkar; it is
reconsidered if asked (the human, 2026-11-14). Gemini CLI is left out too: its
sign-in for individuals is no longer served (2026-11-14). An agent is more than a command: Menkar needs, per agent, how to start
and resume a session,
where its transcripts live and their format (the session list, names, Usage's time and tokens, the
classifier's input), how its running state shows in the terminal (agent-state detection), and what
its status line or context reading offers, and **whether it has a remote mode like Claude Code's
Remote Control** (today only Claude Code does). Adding one before those are known would put it in
the New picker with half of Menkar not working for it. Cursor the editor is out of scope; only an
agent that runs in a terminal fits.

- **Remote Control per agent.** New's Remote Control switch already hides when the chosen agent
  is not Claude Code; the rule becomes "shown only for an agent that declares a remote mode", one
  field of the agent's entry, never a check on its name.
- **Enabled per platform.** A release may ship an agent on one platform before it is tested on another:
  each agent's entry says on which platforms it is enabled. On a platform where it is not enabled
  the agent **does not appear at all** — not even greyed; greyed means only "supported here, but
  not installed on this machine". Set in the code per release, not by the user.
- **A reference.** The human points to the open-source *agent-deck* (asheshgoplani/agent-deck), which supports many of
  these agents; read it for each agent's commands and transcript formats. Menkar is written from
  scratch (decision 1.1), so it is read as documentation, not copied — and its license is checked
  first.
- **Menkar's own skills** (`menkar:orchestrator`, `menkar:worker`, `menkar:distill`) reach Claude
  Code through a plugin passed with `--plugin-dir`. Codex and Gemini have **no per-session flag**
  for skills: both read `.agents/skills` inside the project (measured 2026-11-12,
  `plans/ideas/research/skills-delivery.md`), so for them the skills would be copied or linked
  into the repository, which is the user's. Decide how before shipping skills to them.
- **What the orchestration mode needs from an agent** (measured or read 2026-11-11/12,
  `plans/ideas/research/wake-orchestrator.md`): MCP support (all four have it, but each takes its
  servers its own way, not `--mcp-config`); hooks for the turn's end and a permission request
  (Codex: `Stop`, `PermissionRequest`; Gemini: `AfterAgent`, `Notification`); resuming with a
  first prompt (`codex resume <id> "<prompt>"`, `gemini -r <id> "<prompt>"`; Cursor's
  `--resume [chatId]` with a prompt is not confirmed); and how to wake it (the entry below).
- **The variables a running agent sets for its children** must not reach the agents Menkar starts
  (`src/core/sessionenv.ts` holds Claude Code's, 1.75): find each new agent's.
- **The team block for each agent** (decision 1.150, 2026-11-16). Only Claude Code has an entry
  in `TEAM_AGENTS` (`src/core/team/block.ts`) and a part, `plugin/team/claude.md`; any other agent
  gets no block and no flag. Each one needs its own communication part (how it messages a session
  by name), how it refers to a skill, and how it is told: how a start delivers the block (Claude's
  `--append-system-prompt-file`; Codex has no snapshot flag, OpenCode rewrites its entry) and how
  a change reaches it while it runs. Trigger: plan 38's P1a, Codex first.

**Trigger:** fired for Codex (1.127, 2026-11-14: before 1.0, inside the orchestration mode). First question, per
agent: the five facts above, read from its docs, agent-deck's code and a real session, before
any code.

### Telling running sessions their tool list changed

Menkar's MCP server declares `listChanged` when an agent other than Claude Code is installed, and
Claude Code re-lists on the notification (`docs/agents.md`), but the server never sends it: main
finds the installed agents once, at its start, and every session's server starts again with
Menkar. A notification now would have nothing to announce.

**Trigger:** main finds an agent installed or removed while it runs. First question: whether only
adding tools (never removing them mid-session, which leaves Claude a stale note) is enough.

### Waking an agent other than Claude Code

Menkar wakes a parent session through Claude Code's documented cross-session messaging
(`docs/session-control.md`). Codex, Gemini and Cursor have no such channel. Waking them means ending
the session and resuming it with the event as its first prompt, or typing into its terminal, which
would amend the rule that nothing is typed into a running agent.

**Trigger:** a second agent takes part in the orchestration mode (STATUS 2.21). First question:
whether ending and resuming is enough, or whether typing comes with its conditions (idle, an empty
input box, never at a prompt).

### `menkar session …`, the CLI form of the MCP tools

Decision 1.70 named a CLI over the same core (`menkar session renew`, `menkar session start`). The
MCP tools are what the agents use, so a CLI would have no caller yet. The request files make it a
thin writer: it would write a request and wait for its response as the server does.

**Trigger:** a session without MCP, or the human from a terminal, needs to renew or start a session.
First question: how the CLI names its pane or project without `MENKAR_PANE`.

### The orchestration mode's guide online

The guide ships inside Menkar (`plugin/guide/orchestration-mode.md`), read from disk by any
session, and the first-time card opens it in a file tab and copies a prompt naming its path
(decisions 1.90, 1.91). Nothing links to an online copy: the public site (`docs/site.md`) is not
published until the first release, and the app opens no URL of its own.

**Trigger:** the public site is published. First question: whether the card links to it, and
whether that link counts as the app opening a URL of its own.

### A session reporting what it waits on

Menkar reads a session's state from its screen, so a session that ended its turn waiting on another
session, or on a question it left in prose, shows as free. A survey of other tools
(`plans/ideas/research/reported-states.md`) found none that reads it from the screen; the reliable
route is the session reporting it, through a **non-blocking** MCP tool such as
`set_waiting {on: <session>, question}` (a blocking one keeps the screen at "working"), cleared by
Menkar when the session works again, the human types in its tab, or it stops. Not built
(2026-11-12, the human): in the orchestration mode a worker waits only on the orchestrator, who
already learns it from the wake and the report, and what the human must answer goes as a topic; in
the ordinary mode nothing would tell a session to call the tool (it loads no Menkar skill), so it
would need another signal, such as Claude Code's hooks for a prompt left unanswered.

**Trigger:** the human often finds a session that looked free waiting on someone, in either mode,
or two workers start waiting on each other. First question: for the ordinary mode, which signal
replaces a call the session is never told to make.


### Switching the Claude Code account

What a logout and a login with another account do, as read by `claude-cli` on 2026-11-14 (docs and
the 2.1.325 binary; **nothing measured**):

- **Kept, being the home's**: transcripts, auto-memory, every `CLAUDE.md`, `~/.claude/settings.json`,
  the user's skills, installed plugins, MCP servers, per-folder trust.
- **The account's**: credentials (a logout wipes them), `oauthAccount` and the first-start state in
  `~/.claude.json` (a logout removes them, so setup runs again), skills synced from claude.ai, and
  everything server-side (Remote Control sessions, cloud sessions, artifacts, connectors, limits).
- **What hits Menkar**: a logout revokes the old tokens, so running sessions fail until restarted —
  the switch is done with Menkar closed. Resuming a session the old account started stops at a
  dialog, "This session belongs to another account" (Exit / Change login / Copy to the new account
  and continue; copying shares its history with that account), so each saved tab stops there.
  Menkar cannot answer it for the human: that would be typing into the agent.

Unknown until tried with two real accounts: whether every local resume shows the dialog, whether
"Copy" gives a new session id that the tab must follow, and which state Menkar shows for it.

**Trigger:** the human switches accounts (planned for the week after 2026-11-14), with Menkar
closed, and reports what the saved tabs did; and the human will pass a package they know that
eases switching accounts, to be analysed for making the switch smoother in Menkar. First question:
what the package does and whether any of it writes under `~/.claude` (a decision for the human).

### A faster Usage report with categories

Since 2026-11-14 a month's report takes ~0.75 s without categories and ~2.3 s with them, on a copy
of the human's data (task 9). What is left with categories is the per-line lookup of a logged
line's project and category, still done twice (totals and bars). Resolving them in memory per
session (each session's turns loaded once, a binary search by time) would bring it near zero, but
must reproduce `projectAt`'s fallback to the first turn and the rule that a turn the human did not
start takes the latest human turn's category; and the totals could come from the bars only if
every figure adds up across days. The human finds 2.3 s tolerable for now (2026-11-14).

**Trigger:** the human finds the Usage window slow again, or the statusline log's growth (~4,500
lines a day) pushes a month with categories past ~4 s. First question: a parity test against the
SQL lookups before any change.

### A text form of `menkar usage now`

2026-11-19 (plan 44, D1): `menkar usage now` requires `--json`; the reading is for the human's own
service, and the JSON reads well enough with `jq`. A short translated line ("Burst: 1 h 10 min since
14:30 · today 2 h 10 min") would need strings in both catalogs.

**Trigger:** the human wants to read it by eye in a terminal.

### `menkar usage now` for one project

2026-11-19 (plan 44, D3): the reading is every project's; away is already every project's, and a
break is the human's, not a project's. The export's `--project NAME` would scope the actions.

**Trigger:** the human's service asks for one project's burst.

### `menkar usage now` on Windows while the app rotates the journal

2026-11-19 (plan 44): checked on Linux only, where reading `journal.jsonl` while the app renames
it disturbs neither. Not checked on Windows, where renaming a file another process has open depends
on how both opened it.

**Trigger:** native Windows (above) is built. First question: whether the app's rename of the journal
succeeds while `now` reads it, and what the app logs when it does not.

### Counting the messages typed while an agent works

2026-11-18: a message the human types while an agent is working joins that agent's turn and opens
no turn of its own, so Your time does not count it (its views say so in a note). It can be
counted: the transcript records it as a `queued_command` attachment, which the cache could read as
a human message instant, outside any turn. Not built because the files it touches (the cache's
reading and the history's write path) are the multi-agent architecture's while its Codex phase
reshapes them.

**Trigger:** the multi-agent architecture's phase that owns the usage cache and the history's
write path has landed. First question: whether a queued message the human withdrew before it was
sent leaves the same attachment.

### The orchestrator's conversation, apart from the events

From ccai's human (2026-11-16): **an order of the topics the orchestrator sets** (today ★,
blocking, number), and **a separate interface to talk with the orchestrator** where the human does
not see what goes on behind. The events' noise in its chat is answered by decision 1.178: the
orchestrator is posted to only for a review and a question, the rest reaching it through its inbox
with its next prompt (`docs/session-control.md`). What is left: those two posts, and workers'
own SendMessage, still draw in the human's chat (Claude Code draws them; no setting folds them, as
of 2.1.325).

**Trigger:** the human finds the inbox and the two posts not enough. First question: what the
separate interface shows, and where.

### An `answer` tool for a question

Decision 1.178 (Q5): a session's `ask` is answered by the parent's own `SendMessage`. A Menkar tool
that carries the answer back is not built.

**Trigger:** a worker whose agent has no messaging works under an orchestrator (more coding
agents in the mode). First question: how the answer reaches that agent without typing into it.

### A Cursor orchestrator's inbox

A Cursor orchestrator has no inbox file (`MainAgentKit.inbox` is `null`): the quiet routing of
decision 1.178 (events kept in the inbox, a wake only for a review, a question or a topic) is for
an orchestrator whose kit has one, Claude's alone, so a Cursor orchestrator is woken as any parent
is, through its waker. Each wake is held until a completed turn hands it over (with the hooks
item) or the idle session is ended and resumed with it, so a busy team can restart it often.

**Trigger:** the human orchestrates with Cursor and finds it woken or restarted too often. First
question: whether one of Cursor's hooks (`beforeSubmitPrompt`, `stop`'s followup) can carry the
inbox to the model off the human's screen, measured by `cursor`.

### Typing a wake into Cursor's box

Cursor has no channel into a running chat, so a wake for an idle Cursor session ends and resumes
it (plan 38's D1, decision 1.143). Typing the text into its box when it is empty, D1's plan B, is
not built: it would amend the rule that nothing is typed into a running agent's terminal.

**Trigger:** the restart proves too costly in use (a long resume, a lost screen), or Cursor
changes how a resume treats its chat. First question: the conditions under which typing is safe
(idle, an empty box, no card), and whether the human accepts the rule's amendment.

### Cursor's context ring and status line

Cursor sessions show no context ring (`caps.context` is false, the kit's `context` `null`) and
Menkar installs no status line for Cursor (plan 38's D8): Cursor's own footer shows its context.

**Trigger:** the human asks for the ring on Cursor tabs. First question: what Cursor exposes of a
chat's context outside its screen (a hook's payload, its files), measured by `cursor`.

### Saying in the window that an OpenCode is too old for Menkar's tools

Menkar's OpenCode server checks `/openapi.json` for the instruction-entry route and the per-folder
MCP route. Without the first the team block is not delivered, without the second Menkar's MCP is not
mounted, so an OpenCode session in the orchestration mode cannot use Menkar's tools. Only a log line
says it: the routes are known once the server runs, after the first-time card was drawn, and every
OpenCode measured (2.3.0) has both.

**Trigger:** an OpenCode release without either route, or the human starting an OpenCode worker
that cannot report. First question: where it is said (the card, the pane, a toast) and whether
`start_session` refuses such an agent, as it refuses one with no MCP mount.

### A profile menu at the sidebar's foot

The human, 2026-11-16 (1.170): the presence chip at the sidebar's foot is the person's own spot;
later it may open a drop-down of the human's profile, with "Set me away" beside other options.

**Trigger:** a second setting or action that concerns the person themselves. First question: what
else goes in it, and whether the chip's click still toggles away or opens the menu.

### Disposing a background worker's view, replaying main's buffer when peeked

A background worker's screen lives where an unselected tab's does (decision 1.176): main's 512 KiB
buffer and the renderer's xterm.js view with its scrollback, hidden. Disposing the view and
replaying main's buffer at the peek would lose what is older than 512 KiB and could start inside an
escape sequence, to save memory nobody has seen short.

**Trigger:** the renderer's memory grows with background workers on the human's machine. First
question, measured then: `webContents.getProcessMemoryInfo()` with 0 and with 10 background
workers, each having printed the same transcript through the stand-in `claude`.

### Sizing a background worker's terminal to the window

A worker started in the background runs at 80×24 until it is first shown, as any tab started
unselected (decision 1.32); the renderer fits it then.

**Trigger:** a peeked worker's earlier output reads badly wrapped at 80 columns. First question:
whether main sizes a background pty from its window's tab body, measured by the renderer
before the worker is first shown.

### A row for a session from New before its first turn

A session started from New (the first-time card's new orchestrator too) or a fork has no session id
in its pane until its transcript appears and the pane joins it; until then it has no row, no dot by
id and no menu target. A session started by `start_session` knows its id at once and has a
stand-in row (`docs/sessions.md`). Less urgent: the New session's tab is selected, in front of the
human, while a background worker's is not (decided 2026-11-18).

**Trigger:** a session started from New stuck before its first turn goes unseen by the human.
First question: whether to bind the expected id at start, as `start_session` does, or draw a row
per waiting pane.

### A symlinked `~/Menkar` or files folder, measured against Claude Code's symlink checks

Claude Code 2.1.327 added checks on symlinked paths. Menkar grants a session its project's files
folder through `permissions.additionalDirectories` in `--settings` (`docs/project-files.md`). If
`~/Menkar`, a project's folder or its `files` is a symlink (another disk, say), those checks may
turn the grant into permission prompts or refusals. Not measured; on the human's machine the three
are plain directories (2026-11-19). Moved here from a queued probe of `claude-cli` (the human,
2026-11-19).

**Trigger:** a user has `~/Menkar` or a files folder as a symlink, or reports permission prompts
on the files folder. First step: the probe in a throwaway home, on the current Claude Code.

### The AppImage

A single file that runs on any Linux, with no package manager. It cannot install the AppArmor
profile nor carry a setuid helper, so on Ubuntu 24.04, which restricts unprivileged user
namespaces, Chromium's sandbox cannot start and the app runs only with `--no-sandbox`: the
sandboxed app the README promises would not be the one users get. Menkar ships a `.deb` and an
`.rpm` (`docs/packaging.md`). Deferred at 1.0 (the human, 2026-11-19).

**Trigger:** a user on a distribution with neither APT nor RPM asks for Menkar. First question:
whether that distribution restricts user namespaces, and so whether `--no-sandbox` is the price.

### A self-hosted package repository

An APT and RPM repository of Menkar's own, on its own domain. Cloudsmith hosts it for free
(`docs/packaging.md`, "The package repository"); self-hosting now would add a bill, a domain and a
signing key to guard, for no user yet. Its costs are known: users' sources name
`dl.cloudsmith.io`, so moving later changes every user's source line and key once, and Cloudsmith
logs each download's address. Deferred at 1.0 (the human, 2026-11-19).

**Trigger:** the free plan's delivery limit is reached, Cloudsmith ends or changes the open-source
plan, or the download logs become a concern for users. First question: whether sponsorship from
Cloudsmith answers it, before building and signing a repository of our own.

### The public site's `llms.txt` in Spanish

`llms.txt`, `llms-full.txt` and `llms-small.txt` are English only: `starlight-llms-txt` reads the
default locale. Each Spanish page has its own `.md`, and an agent reads English.

**Trigger:** a Spanish reader asks for it, or the plugin gains locales. First question: whether a
second set under `/es/` is the plugin's or our own endpoint's.

### A Content-Security-Policy for the public site

The site has no `<meta>` CSP: Starlight's inline theme script would need a hash kept in step with
each Starlight release. The build's scan (`site/scripts/check.mjs`) fails anything loaded from
another origin instead.

**Trigger:** the site gets a script the scan cannot read, such as a third-party plugin's that builds
its URLs at run time. First question: whether the hash can be computed at build time.

### A custom domain for the public site

The site lives at GitHub's address, `<owner>.github.io/menkar` (decided 2026-11-19): free, HTTPS,
no DNS. Moving later loses the links already shared, since Pages cannot redirect but with a page
per URL.

**Trigger:** the project leaves GitHub, or the human wants an address of its own. First question:
which old URLs must keep working, and how (a page per URL, or a host that redirects).

### Following a `/rename` made in Cursor

Decided by the human (1.215, 2026-11-24): a Cursor worker keeps `<project>-t<N>` in Menkar's own
names, and the human renames it with Menkar's Rename. Cursor writes a human `/rename` and its own
automatic title to the same keys of the chat's `meta.json` with no mark (`cursor`, measured on
2026.11.13), so reading that title would replace a worker's name with Cursor's guess.

**Trigger:** a Cursor version tells a human title apart from its automatic one (a key, a flag, or a
record of the `/rename`). First question: whether a human title then replaces the name Menkar kept,
as Claude's `/rename` does.

### A team post that overtakes a resume's own prompt

Measured by `claude-cli` on Claude Code 2.1.330 (2026-11-21, 3 runs of 3): when `claude --resume
<id> "<prompt>"` starts and a `[Menkar]` post reaches its socket before the prompt is sent (the
socket is up at about 0.35 s), the post's turn runs first, with no attachments, and the
command-line prompt runs as the next turn. With `resume_session` or `start_session` given a prompt
and a team post soon after, the session's first turn is the team update, not its task.

**Trigger:** a session started or resumed with a task prompt is seen acting on the team post before
its task, or skipping a skill because its first turn had no listing. First question: whether Menkar
holds a post until the prompt's turn has opened, from the transcript's first `human` record.

### TypeScript 7

Measured on 7.0.2 (2026-11-21, Dependabot's PR #4, closed): the app builds byte-identical and `src/`
typechecks, but TypeScript 7.0 ships no classic compiler API, which three checks of `npm run ci`
(`check-code-rules`, `check-i18n`, `check-test-integrity`) and seven code-shape tests parse sources
with. Microsoft's bridge (`@typescript/typescript6`) works but installs a second TypeScript.
Dependabot ignores TypeScript majors until then (`.github/dependabot.yml`).

**Trigger:** TypeScript 7.1 ships its stable API. Then: move the ten files onto it in one change, and
lift the Dependabot ignore.

### The panes' raw rows in the export

2026-11-23 (1.207): `menkar usage export --rows panes` gives 15-minute windows, the shape cogload
asked for; each pane's row as stored has no consumer, and a pane id is an identifier no reader
needs yet.

**Trigger:** a consumer asks for each change of a pane's state. First question: whether its rows
carry the pane id or only the state and the moment.

### The sessions' counts per project

2026-11-23 (decision 1.204 (b)): `sessions_blocked`, `sessions_working` and the pane rows are
global, and the rows carry no session, so a per-project reading would start recording then.

**Trigger:** cogload or the human asks for one project's counts. First question: a session id on
each `pane_state` line, or the project's id.

### A chat tab's state in the counts

2026-11-23 (1.207): only agent panes have a shown state; a chat tab waiting on its permission
card is not in `sessions_blocked`.

**Trigger:** a chat tab gets a shown state. Then its tab registers with the same recorder.

### Folding old pane rows into windows

2026-11-23 (decision 1.207, D8): the pane rows are kept for good, like every row of the history;
folding rows older than some age into 15-minute windows would lose what a later reading may need,
and the real volume is not known yet.

**Trigger:** the history's size is noticed, or the measured rate (below) is above the worst case
the reading's cost was measured at (`docs/usage.md`, "The sessions' counts' cost"). First question: the age, and whether the windows keep the peak and the
pane-seconds of all four states.

### Measuring the pane rows' rate on the human's data

2026-11-23 (decision 1.207, D6): with no hold, a future agent version whose screen flickered would
write a row per flip, at most one per pane per watcher re-read; only a count on the human's own
`pane_states` would show it.

**Trigger:** a week after the build with the pane state events (1.207) is installed, with the human's go. Then `set` runs
one read-only count (rows per hour, p50, p95 and max, no ids printed) against that worst case, and
a hold before a change is journaled is decided if it is above.
