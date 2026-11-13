# History of `docs/NOT_BUILT_YET.md`

## Menkar's own copy of the transcripts

> Left on 2026-11-10: option B dropped by the human on 2026-11-09, because the retention
> integration (`cleanupPeriodDays`) covers the need.
### Menkar's own copy of the transcripts
Transcript retention (2026-11-10) asks Claude Code to keep its transcripts longer, through
`cleanupPeriodDays` in `~/.claude/settings.json`. The other way, option B, would have Menkar copy a
member session's transcript into its data directory and show the copy in the replay tab after
Claude Code deletes the original. That is a second store of the user's prompts and code, which
would have to be kept, sized and deleted; and the integration already covers whoever turns it on.
**Trigger:** someone who will not touch Claude Code's settings loses a transcript they needed, or
retention through the setting stops working. First question: which sessions get copied (members
only, or everything seen), and when a copy is deleted.

> Replaced 2026-11-10: the coding agents entry gained the remote mode, per-platform enabling and Agent Desktop as a reference.
its status line or context reading offers. Adding one before those are known would put it in the
New picker with half of Menkar not working for it. Cursor the editor is out of scope; only an
agent: the four facts above, read from its docs and a real session, before any code.

> Replaced 2026-11-10: an agent not enabled on a platform does not appear there, not even greyed; the reference is Agent Desk.
  each agent's entry says on which platforms it is enabled, and the picker shows it (installed or
  greyed) only there. Set in the code per release, not by the user.
- **A reference.** The human points to the open-source *Agent Desktop*, which supports many of
agent: the five facts above, read from its docs, Agent Desktop's code and a real session, before

## Dragging sessions and tabs

> Left on 2026-11-10: session rows now reorder by dragging within their group (the human, 2026-11-10); dragging a row onto a tab stays not built.

### Dragging sessions and tabs

"Open beside the current tab" from a row's menu puts a session in a tab's second pane; rows and tabs
are not reordered by dragging.

**Trigger:** the human misses dragging a row onto a tab, or reordering rows. First question: is the
order of a project's sessions worth saving, or is the group enough?

## Deliberately not built yet

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
In agent-tablet's evaluation no local model came close to Haiku's agreement with the human's labels
The history keeps every turn forever: in agent-tablet two months of the human's use took a few
megabytes, so years fit without a limit, and a limit would drop exactly what the history exists to
Menkar speaks English and Spanish, both complete (`plans/00-STATUS.md` §1 1.11). agent-tablet also had
German, French and Hungarian from Agent Session Manager, each covering about 230 of its 370 strings;
every new string would need three translations nobody here can check, and a stale catalog shows a mix
of languages.

## Who leads a group

> Left on 2026-11-12: groups lose their leader; a group is only visual (decision 1.76).
### Who leads a group, read by something other than the sidebar
A group's leader (decision 1.54) is shown only in the session list: a star on its row, its name on
the collapsed row. Nothing else reads it, so there is no API, CLI output or message that names it;
designing one without a reader would guess its shape.
**Trigger:** a session or a tool needs to know who leads a group (the orchestration board is the
likely first). First question: whether it reads `projects.json` or asks the running app.

## Notifications for a new topic

> Left on 2026-11-12: built by plan 35 (decision 1.103, `docs/orchestration.md`).
### Notifications for a new topic

A new topic shows in the sidebar's Topics section only: no toast, sound, desktop notice or count on
the dock, as `blocked` has. Left out of the orchestration mode on 2026-11-12 because nobody had
decided which of them, or for which topics (all, blocking ones, a priority session's).

**Trigger:** the human misses a topic that waited for them. First question: which topics notify,
and whether through the same settings as a blocked session.

> Left on 2026-11-13: dropped, not deferred (the human): read-only tabs (1.101) make "with you" explicit — the human must press "Take control" to type — so there is nothing left to guess.

### "With you" known by itself

A session is marked "with you" by hand, from its menu, and cleared by hand (decision 1.86). Menkar
could guess it from the human typing in the pane, or from a timer, but a prompt sent from the phone
would not be seen, and a wrong guess would keep work from a session or send work to a busy one.

**Trigger:** the human forgets to set or clear the mark often enough to ask for it. First question:
which signal counts — keys typed in the pane, focus, Remote Control traffic — and how long it holds.
