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

## 2. First start, with the agent-tablet import

Close agent-tablet first. Start Menkar from the launcher (not from a terminal).

**Passes when**:

- a window opens and a session tab shows a working terminal: the sandbox is on (`ps -ef | grep
  /opt/Menkar/menkar` shows no `--no-sandbox`);
- your agent-tablet projects, groups and settings (theme, font, language) are there;
- the Usage window (the header's Usage button, period "All") shows days from before Menkar's first start;
- agent-tablet's own files are unchanged (it still starts and shows the same projects).

## 3. A day of work

Use Menkar instead of agent-tablet for a working day: open your projects, start and resume
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

## 8. The Markdown preview on a real screen

Open a Markdown file with headings, a code block, a table and a local image; `Ctrl+Shift+V`.

**Passes when** it renders readably at your screen's scale in both a light and a dark theme, and
nothing is fetched from the network (a remote image is not loaded).

## 9. Retake the squeezed screenshots

Some reference screenshots in `docs/spec/img/` came out wrong under the headless capture: the
Preferences and Integrations pages were drawn too narrow (titles wrap letter by letter), and the
Markdown preview could not start at all. Retake them from agent-tablet on a real display:
`preferences-{dark,light}.png`, `integrations-{dark,light}.png`, `file-preview-{dark,light}.png`.

**Passes when** each row's title is on one line and the preview shows rendered Markdown. Compare
them with Menkar's same pages; a difference you do not like is a defect to report.

## 10. Remove

```sh
sudo apt remove menkar
```

**Passes when** the launcher, `/opt/Menkar`, `/usr/bin/menkar` and `/etc/apparmor.d/menkar` are
gone, and Menkar's own data (`~/.config/menkar`, `~/.local/share/menkar`) is still there for a
reinstall.
