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

### A documentation site

`README.md` is the user's guide and `docs/` is internal; nothing is published. A site is one more
thing to keep true.

**Trigger:** the README stops fitting on a few screens, or someone other than the human uses the
app. First question: whether it is generated from `README.md` or written apart.

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

### Ending what outlives a hang-up on macOS and Windows

After a pty is hung up, its session's survivors are found through Linux's `/proc` (sid = the
shell's pid) and get SIGCONT, SIGTERM and then SIGKILL (`src/main/reap.ts`). macOS has no `/proc`,
and Windows has neither sessions nor these signals, so there only the hang-up itself is sent.

**Trigger:** the Windows port. First question: how node-pty's ConPTY ends its child tree there,
and whether macOS's `ps -o sess` gives the same session to follow.

### The live Remote Control phone on macOS and Windows

The claude process behind a pane is found through Linux's `/proc` (its shell's children and their
command lines, and the start time that guards a reused pid). macOS and Windows have no `/proc`, so
there the phone falls back to the app's own list.

**Trigger:** the macOS or Windows port. First question: whether Claude Code's registry keeps the
same shape there, and how each system lists a process's children.

### An MCP server for usage

`menkar usage export` hands an LLM session the history's turns as rows it reads through its shell
(decision 1.16). A server (`menkar mcp`, with tools such as `query_usage`) would let a session ask
for exactly the slice it needs instead, but it is one more process and protocol to keep working,
and Claude only reaches it once registered in Claude's settings, which is the integrations menu's
consent, not a side effect.

**Trigger:** the export proves too coarse for a real analysis, or the human asks for it. First
question: which questions the export could not answer, so the tools are shaped by them.

### More coding agents: Codex, OpenCode

Menkar runs two agents today: Claude Code and Cursor's terminal agent (`cursor-agent`), listed in
`src/core/agents.ts`. The human wants OpenAI's Codex CLI and OpenCode too (2026-11-10); Codex comes
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
- **Enabled per platform.** A release may ship an agent on Linux before it is tested on Windows:
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
(decisions 1.90, 1.91). Nothing links to an online copy: no site exists, and the app opens no URL
of its own.

**Trigger:** the documentation site exists ("A documentation site" above). First question: whether
the card links to it, and whether that link counts as the app opening a URL of its own.

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

### Task flow metrics: how long tasks spend in each state

The human's idea (2026-11-15): record a timestamp each time a task enters a state, so Menkar can
show, over the last 7 or 30 days, how long tasks spent queued, in progress, waiting and to review —
a measure of the team's flow that shows the bottleneck. Long in queue: too few workers at once, or
more tasks created than the short term can take. Long to review: reviews to speed up.

- **To review needs to say whose review.** Today "To review" holds both the orchestrator's review
  and the human's (a visual check, a behaviour to try: a topic naming the task, closing-a-task
  step 8); Menkar knows nothing of a PR waiting for approval or merge. The column stays one; the
  task gains **who it waits on** (the orchestrator, the human, a PR's review, a PR's merge), set
  with `task_review`/`task_progress`, shown on the card and kept with the state change, so the
  human can tell whether their own checks or the PRs are the bottleneck.
- **Storage:** an append-only table of state changes (state, reviewer, when; the task's number
  and project only to pair entries and exits — the metric itself is not per task), next to the
  usage history in SQLite (the one exception to "the app's state is JSON", already the home of
  Menkar's metrics), while `tasks.json` stays the live state. Moving all of `tasks.json` to SQLite
  is not needed for this. Time through `src/core/clock.ts`; a task spanning midnight, a restart, a
  state re-entered.
- **Shown** in the Usage window beside time and tokens, or the Board; where is the human's call.

**Trigger:** fired — wanted before the first release (1.156, 2026-11-15). First question:
which states and reviewers to record, and where the numbers show.

### The orchestrator's conversation, apart from the events

From ccai's human, relayed by its orchestrator (2026-11-16): the chat with an orchestrator mixes the
conversation with the human and the noise of the events (`[Menkar] … finished its turn`), and each
event wakes it and tends to produce visible text. Two ideas, beyond the current topic (1.169): **an
order of the topics the orchestrator sets** (today ★, blocking, number), and **a separate interface
to talk with the orchestrator** where the human does not see what goes on behind.
ccai's orchestrator adds (2026-11-16): `[Menkar] … finished its turn` wakes arrive as turns of the
human's chat; if a turn must still end with some text, Menkar could hide it, or those wakes could
reach the orchestrator outside the human's chat. Seen by it the same day: Claude Code answers a turn with no visible text with a
reminder ("Your previous response had no visible output") that starts another turn, so the skill
alone cannot make it silent; a minimal "·" is the stopgap. A third idea from ccai's human (2026-11-16): hide, fold or filter in the orchestrator's
chat the messages other sessions send it (`Another Claude session sent a message: …`, both
Menkar's events and workers' cross-session messages), which Claude Code draws, not Menkar; or
deliver the events by another channel. Asked of the Claude Code consultant (2026-11-16, 2.1.325): no setting folds or
hides peer messages in the TUI (`crossSessionInbound` only accepts, holds or refuses delivery); a
plugin monitor wakes with a one-line event instead of a prompt row, but was rejected before
(`docs/session-control.md`, Rejected); a `UserPromptSubmit` hook's `additionalContext` reaches the
model invisibly but only with the human's next prompt; the empty-turn reminder is switched per model,
not by the user. The levers left are posting fewer, coalesced events and deferring the rest to the
human's next prompt.

**Trigger:** the human finds the current topic (1.169) and the skill's silence on events not
enough. First question: what the separate interface shows, and where.

### A profile menu at the sidebar's foot

The human, 2026-11-16 (1.170): the presence chip at the sidebar's foot is the person's own spot;
later it may open a drop-down of the human's profile, with "Set me away" beside other options.

**Trigger:** a second setting or action that concerns the person themselves. First question: what
else goes in it, and whether the chip's click still toggles away or opens the menu.
