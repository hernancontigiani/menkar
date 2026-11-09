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

### Dragging sessions and tabs

"Open beside the current tab" from a row's menu puts a session in a tab's second pane; rows and tabs
are not reordered by dragging.

**Trigger:** the human misses dragging a row onto a tab, or reordering rows. First question: is the
order of a project's sessions worth saving, or is the group enough?

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
In agent-tablet's evaluation no local model came close to Haiku's agreement with the human's labels
(`docs/spec/classifier.md`), and each needed a download of hundreds of megabytes to gigabytes that an
installer would have to ship or fetch.

**Trigger:** a local multilingual model is published that reaches Haiku's agreement on the
evaluation set, or the human wants classification without the network. First question: whether it
runs inside the app or as a separate download the user accepts.

### Pruning the usage history

The history keeps every turn forever: in agent-tablet two months of the human's use took a few
megabytes, so years fit without a limit, and a limit would drop exactly what the history exists to
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

Menkar speaks English and Spanish, both complete (`plans/00-STATUS.md` §1 1.11). agent-tablet also had
German, French and Hungarian from Agent Session Manager, each covering about 230 of its 370 strings;
every new string would need three translations nobody here can check, and a stale catalog shows a mix
of languages.

**Trigger:** someone asks for a language. First question: who reviews its translation, and whether a
partial catalog is acceptable or `check-i18n` holds it to complete like Spanish.

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

### Menkar's own copy of the transcripts

Transcript retention (2026-11-10) asks Claude Code to keep its transcripts longer, through
`cleanupPeriodDays` in `~/.claude/settings.json`. The other way, option B, would have Menkar copy a
member session's transcript into its data directory and show the copy in the replay tab after
Claude Code deletes the original. That is a second store of the user's prompts and code, which
would have to be kept, sized and deleted; and the integration already covers whoever turns it on.

**Trigger:** someone who will not touch Claude Code's settings loses a transcript they needed, or
retention through the setting stops working. First question: which sessions get copied (members
only, or everything seen), and when a copy is deleted.
