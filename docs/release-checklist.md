# Release checklist — what the human checks before calling a build a version

The sessions build the package and run every automated check (`docs/packaging.md`, "Cutting a
release"). What is left needs a person on a real desktop, with their own data. Go in order: a
later check assumes the earlier ones passed. A check that fails stops the release; say which step
and what you saw.

Version under check: **0.1.0**, `release/menkar_0.1.0_amd64.deb`, Ubuntu 24.04 amd64.
The build's own version, `0.1.0-<commits>.g<hash>`, is what
`dpkg-deb -f release/menkar_0.1.0_amd64.deb Version` prints; note it with the result.

## 1. Install

```sh
sudo apt install ./release/menkar_0.1.0_amd64.deb
```

**Passes when** apt finishes without an error; the **Menkar** launcher with its icon is in the
applications grid; `menkar` runs from a terminal; `/etc/apparmor.d/menkar` exists.

## 2. First start

Start Menkar from the launcher (not from a terminal).

**Passes when**:

- a window opens and a session tab shows a working terminal: the sandbox is on (`ps -ef | grep
  /opt/Menkar/menkar` shows no `--no-sandbox`).

## 3. A day of work

Use Menkar for a working day: open your projects, start and resume
sessions, split panes, open a second window, close and reopen the app.

**Passes when** nothing is lost across a restart (windows, tabs, projects, names), closing a window
with agents working asks first, and no agent received keystrokes you did not type.

## 4. Usage

At the end of the day, open the Usage window and run `menkar usage` in a terminal.

**Passes when** Today and 7 days show the day's sessions under the right projects; the window's
Totals and `menkar usage` agree; with the status line integration on (Preferences → Integrations),
the footer shows the 5-hour and 7-day limits, three spaces after the blocked time.

## 5. The classifier

Preferences → Integrations: turn on "Classify turns". Then "Classify earlier turns…" for a day a
week back.

**Passes when** the estimate counts turns and its cost before anything is sent; after the run the
line under the switch says how many were classified; Usage's Totals split each project by category and By
day offers the Category stack; Stop ends a run in progress. It spends a little of your plan's
quota.

## 6. Notifications

With an agent working in a tab you are not looking at (another tab, or the window unfocused), let
it finish.

**Passes when** a desktop notification appears with the completion sound; with "Notify about
sessions you're not watching" off, no notification; with "Play a sound" off, no sound.

## 7. Remote Control from the phone

Turn Remote Control on for a session (New's switch or its menu), start it, and open the session
from the Claude app on the phone or claude.ai.

**Passes when** the phone drives the session and its answers show in Menkar's terminal.

Then, on a session already running without it and idle, check Remote control in its menu and
choose **Restart now** (decision 1.209). **Passes when** the session resumes in the same tab with
its conversation, and the phone or claude.ai reaches it after the restart. This is the one check
of the bridge reconnecting after a resume; no automated test can make it, since it needs a real
claude.ai login.

## 8. The Markdown preview on a real screen

Open a Markdown file with headings, a code block, a table and a local image; `Ctrl+Shift+V`.

**Passes when** it renders readably at your screen's scale in both a light and a dark theme, and
nothing is fetched from the network (a remote image is not loaded).

## 8b. The team block on the real Claude Code

In a project with the orchestration mode on, start a session with `start_session` (a role and a
parent) and ask it who it is. Give another running session a new role, ask it, then restart
Menkar ("Restart now") and ask its restored tab again.

**Passes when** the new session's first answer knows its name, role and parent without being told;
the running session knows its new role at once, and its restored tab still knows it after the
restart; the command line of a session of a project with the mode off carries no
`--append-system-prompt-file`.

## 8c. Agents moved behind their kits (P0)

Every agent concern (starting, transcripts, state, waking, the MCP, chat) moved behind one kit per
agent, with no change meant for the user (decision 1.142).

In the daily Menkar: a day of work with Claude and Cursor sessions as usual. Start a new session,
resume one, fork one, turn Remote Control on, use the orchestration mode with the team block, let
a worker wake its orchestrator, open Usage.

In Menkar Sandbox, installed beside it: name projects with a `sandbox-` prefix (1.159). Its
launcher, header and About say "Menkar Sandbox", with the amber icon (1.166).

**Passes when** each of those behaves as it did before in the daily Menkar; in the sandbox, no
daily session is offered for resume, trash or delete, the classifier is absent, and nothing it
does shows up in the daily Menkar's projects or sessions.

## 8d. Codex as a session (P1a)

Codex runs as a session beside Claude Code and Cursor (plan 39, phase P1a), checked in Menkar
Sandbox with your own `codex` installed and logged in. The orchestration mode with Codex is not
part of this check.

1. New → Codex, in a folder of a `sandbox-` project. Before typing, the tab has no session yet.
   Send a first message that makes Codex run a command needing your approval.
2. While the turn runs, then at the approval, then after it ends, look at the tab's and the row's
   state dot.
3. Wait for Codex to title the thread (or rename it in Codex); look at the row.
4. With a `notify` of your own in `~/.codex/config.toml`, check that it still ran.
5. In the same tab, `/new` and a message; then `/fork` and a message.
6. Close the tab; open the session again from its row and send a message.
7. Open Usage and run `menkar usage`.

**Passes when** the row appears in the project as soon as the first message is sent, before the
turn ends; the dot shows working, then blocked at the approval, then idle or done; the row shows
Codex's name for the thread; your own `notify` ran as before; after `/new` the tab runs the new
thread and the old one is under "Earlier conversations ▸", and after `/fork` the tab runs the fork
the same way; reopening resumes the same thread (its earlier messages are on screen), not a new
one; the tab's ring shows the context Codex's own footer shows; Usage lists the Codex session's
turns under the project, with tokens and a cost marked as an estimate, and `menkar usage` agrees.

## 8e. Codex in the orchestration mode (P1b)

A Claude Code orchestrator with Codex workers (plan 39, phase P1b), checked in Menkar Sandbox with
your own `claude` and `codex` installed and logged in, in a `sandbox-` project with no orchestrator
yet.

1. Switch the orchestration mode on. On the first-time card, look at the "Agent" line under "A new
   session" and at the agent named beside each listed session; pick Codex, then Claude Code, and
   Start with a new Claude Code orchestrator.
2. Ask the orchestrator to start a Codex worker for a small task (`start_session` with
   `agent: "codex"` and a task), and let the worker do it and report with `task_review`.
3. Ask the orchestrator for the worker's last reply (`last_reply`), then to send it a message;
   have the worker answer with `send_message`.
4. Give the worker a role ("Configure role…") while it runs.
5. On a second `sandbox-` project, open the first-time card again; then start a new Codex
   orchestrator from it and send it nothing.
6. On a Markdown file tab, "Ask an agent" with a Codex tab focused, then with no agent tab open.

**Passes when** the card shows the Agent line only because two agents are installed, Cursor
offered with a line saying its limits; the worker runs in the background under the
orchestrator, named `<project>-t<N>`, with its team block (it loads the worker skill by reading its
`SKILL.md`); its review wakes the orchestrator once, at its turn's end; `last_reply` returns the
worker's last answer; each message arrives as "[Menkar] from ‹name› (‹agent›)…" in the other's
next turn; the role reaches the worker as a team update that wakes nobody; the second card
defaults to the agent last started; the new Codex orchestrator is marked at once, reads the
orchestrator skill by its path and is named "orchestrator" once its thread exists; "Ask an agent"
starts Codex with a Codex tab focused, and the agent last started with none.

## 8f. OpenCode (P2)

OpenCode as a session and as a worker of a Claude Code orchestrator (plan 39, phase P2), checked
in Menkar Sandbox with your own `opencode` installed and signed in to a provider, and your own
`claude`, in `sandbox-` projects. Menkar runs its own `opencode serve` for its OpenCode tabs; your
own OpenCode keeps running as it is.

1. New → OpenCode, in a folder of a `sandbox-` project with the orchestration mode off, with a
   name. Send a first message that makes OpenCode run a shell command needing your approval.
2. While the turn runs, then at the approval, then after it ends, look at the tab's and the row's
   state dot. Then ask it for a job that uses a subagent, and watch the dot while the subagent
   works.
3. Ask it which tools it has.
4. In the same tab, `/new` and a message; then OpenCode's own session picker (Ctrl+X L) back to
   the first session.
5. Close the tab; in a terminal, `ps -ef | grep 'opencode serve'`. Open the session again from its
   row and send a message.
6. Open Usage and run `menkar-sandbox usage`; compare the tab's ring with OpenCode's own footer.
7. In another `sandbox-` project, switch the orchestration mode on with a Claude Code orchestrator.
   Ask it to start an OpenCode worker for a small task (`start_session` with `agent: "opencode"`
   and a task) and let the worker do it and report with `task_review`.
8. Ask the orchestrator for the worker's last reply, then to send it a message; have the worker
   answer with `send_message`. Give the worker a role ("Configure role…") while it runs.
9. In a terminal, open your own `opencode` TUI on the first session (`opencode -s <id>`) and start a
   long turn there; meanwhile close its tab in Menkar Sandbox, if open, and open it again from its
   row.

**Passes when** the tab shows OpenCode's own screen with the name you typed as the session's title,
and the row appears once the first message is sent; the dot shows working, then blocked at the
approval, then idle or done, and stays working while the subagent works; outside the orchestration
mode none of its tools is Menkar's; after `/new` the tab runs the new session and the old one is
under "Earlier conversations ▸", and the picker brings the tab back to the first; with no OpenCode
tab open no `opencode serve` of Menkar Sandbox runs; reopening resumes the same session with its
earlier messages; Usage lists its turns under the project with OpenCode's own cost (not marked as
an estimate, for a model OpenCode prices) and `menkar-sandbox usage` agrees; the ring shows what OpenCode's footer shows; the
worker runs in the background under the orchestrator, named `<project>-t<N>`, loads the worker
skill with Menkar's `load_skill` tool and uses Menkar's tools with no approval card; its review
wakes the orchestrator once, at its turn's end; `last_reply` returns its last answer; each message
arrives as "[Menkar] from ‹name› (‹agent›)…" in the other's next turn; the role reaches the worker
without a turn of its own and wakes nobody; the reopened session's pane shows one line of
Menkar's saying it also has a turn running in another `opencode`.

## 8g. Cursor (P3)

Cursor's integrations items, and Cursor as a worker of a Claude Code orchestrator (plan 39, phase
P3), checked in Menkar Sandbox with your own `cursor-agent` and `claude` installed and logged in,
in `sandbox-` projects. Before: copy `~/.cursor/hooks.json` and Cursor's `cli-config.json` aside.

1. Settings → Cursor: the two switches, off. Turn each on, then off, comparing the files with
   your copies after each step. Leave both off.
2. In a `sandbox-` project whose folder Cursor has never run in, switch the orchestration mode on
   with a new Claude Code orchestrator. Ask it to start a Cursor worker for a small task
   (`start_session` with `agent: "cursor"` and a task). Look at the worker's tab and row before
   answering Cursor's workspace trust prompt yourself.
3. Let the worker do the task and report with `task_review`; watch its tab each time it calls
   one of Menkar's tools, and approve each card.
4. Ask the orchestrator for the worker's last reply, then to send it a message while the worker is
   idle with something typed in its box; then delete what you typed.
5. Turn both switches on. Ask the orchestrator for a second Cursor worker, and a message for it
   while a long turn of it runs. Have that worker answer the orchestrator with `send_message`.
6. Give the second worker a role ("Configure role…") while it is idle, then have the orchestrator
   send it a message.
7. In the second worker's tab, `/new` and a message. Then `/summarize`, and ask it what its name
   and its orchestrator are.
8. Open Usage and run `menkar-sandbox usage`.
9. **Before uninstalling Menkar Sandbox, turn both switches off** (S11).

**Passes when** each switch adds only its own entries and turning it off gives back your file as
it was (`cli-config.json` as Cursor last rewrote it: Cursor rewrites it at each start), the other
switch's file untouched throughout; the first-time card offers Cursor with a line saying its
limits; the worker runs in the background under the orchestrator, named `<project>-t<N>`, and its
row and dot show blocked at the trust prompt and at each card; with the switches off each of
Menkar's tools asks first, with them on none does; its review wakes the orchestrator once, at its
turn's end; `last_reply` returns its last answer; the message waits while your text is in the
box, nothing is typed into it, and once the box is empty the worker restarts in the same tab with
the message as its first, its earlier messages on screen; with the switches on the message
arrives as a new turn right after the running one ends, with no restart, and the role reaches the
worker with that next message, waking nobody by itself; each message arrives as "[Menkar] from
‹name› (‹agent›)…"; after `/new` the tab runs the new chat and the old one is under "Earlier
conversations ▸"; after `/summarize` it still knows its name and orchestrator; Usage lists the
second worker's turns (none of the first's) under the project with tokens, and
`menkar-sandbox usage` agrees.

## 9. (none)

No step: the number stays so the later steps keep theirs. The squeezed reference screenshots in
`docs/spec/img/` (`preferences-*`, `integrations-*`, `file-preview-*`) can no longer be retaken and
stay as they are.

## 10. Remove

```sh
sudo apt remove menkar
```

**Passes when** the launcher, `/opt/Menkar`, `/usr/bin/menkar` and `/etc/apparmor.d/menkar` are
gone, and Menkar's own data (`~/.config/menkar`, `~/.local/share/menkar`) is still there for a
reinstall.

## 11. The public site

A session recaptures and checks the site; the human looks and deploys.

```sh
npm run captures                       # every screen; writes only the images that changed
npm run captures:reviewed -- --all-changed   # after opening each changed image
npm run site:install && npm run site:check -- --release
```

Then read the "What comes next" page (`site/src/content/docs/reference/roadmap.md` and its Spanish
twin) against `plans/00-STATUS.md`: it names only what is decided, with no dates. Deploy by hand:
Actions → `docs` → Run workflow (the first time, Settings › Pages → Source: GitHub Actions first).

**Passes when** `site:check -- --release` ends without a problem (no pending install block left),
the contact sheets in `/tmp/menkar-captures/` show this version's screens, and the published site
opens at `https://hernancontigiani.github.io/menkar/` in English and in Spanish.
