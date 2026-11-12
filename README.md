# Menkar

A desktop app for working with several Claude Code (and Cursor) sessions at once: the session list
on the left, the real agent in an embedded terminal on the right, with projects, tabs, split panes,
several windows, usage tracking and file tabs. Electron and TypeScript; Linux first, then Windows
and macOS.

**Status:** in construction, usable for daily work on Ubuntu: projects, sessions in tabs, split panes,
several windows, the history of every session.

## Install (Ubuntu)

**0.1.0** is the first release candidate, for Ubuntu 24.04 on amd64. Build the package and install
it with apt:

```sh
npm run package                                   # builds release/menkar_0.1.0_amd64.deb
sudo apt install ./release/menkar_0.1.0_amd64.deb
```

Before calling it the first version, go through `docs/release-checklist.md`: the checks only a
person on a real desktop can make.

It installs the app under `/opt/Menkar`, a **Menkar** launcher with its icon, and the `menkar`
command (`/usr/bin/menkar`). Run from a terminal, `menkar` (and `menkar open <file>…`) starts the
app on its own and gives the terminal back at once, as `code` does; closing the terminal leaves
the app running. `menkar --foreground` (or `-f`) keeps it attached, to watch its log. `menkar
usage` prints in the terminal as before. The post-install also installs an AppArmor profile,
`/etc/apparmor.d/menkar`, that lets Chromium's sandbox create its user namespace. Ubuntu 24.04
blocks that for unconfined apps, and ships the same kind of profile for VS Code, Slack and
Obsidian. The installed app runs with the sandbox, never with `--no-sandbox`. `sudo apt remove
menkar` takes it all out.

## Using the window

- **Projects** are picked, created, renamed and deleted from the dropdown at the top of the
  sidebar. A project lists the sessions you put in it, from any folder, in groups if you like (a
  row's ⋮ menu → Group). A project is open in one window at a time.
- **A session runs in a tab**: double-click its row, or ⋮ → Open, to resume it in the real
  `claude` (or `cursor-agent`). "Open beside the current tab" puts it next to another one. The
  `+` button starts a new session in a folder you choose; the ▾ menu also continues the last
  session of a folder, or opens a new window.
- **Closing a tab, a window or the app hangs up its agent**, as closing a terminal does; nothing is
  typed into it. Closing a window with agents still working asks first.
- **Files** open in tabs from the ▾ menu or `Ctrl+Shift+O`, with syntax colors; `Ctrl+S` saves, and
  a Markdown file has a rendered preview (`Ctrl+Shift+V`). Claude Code's own files (`~/.claude`,
  `~/.claude.json`) open read only. From a terminal, `menkar open <file>…` opens files in the
  running app.
- **Remote Control** (phone and claude.ai) is turned on per session: the switch on New, or
  "Remote control" in a session's menu; it applies from the session's next start.
- **On the next start** the windows and their tabs come back (the `reopen_tabs` setting turns it off).
- **The orchestration mode** (the "Orchestration" switch beside Usage, or a project's team icon in
  the dropdown) is for a project where several sessions work together: you talk to one session,
  the orchestrator, which hands the work out; the sidebar shows the team by role, with the topics
  waiting for your decision at its top. A session's menu sets the orchestrator, a role, a priority ★
  and "with you". The first time, Menkar asks who orchestrates and offers its guide, which ships
  with the app (`/opt/Menkar/resources/plugin/guide/orchestration-mode.md` on Ubuntu) so any
  session can read it.
- **Add session** (the sidebar's button) lists every session Claude Code and Cursor have on the
  machine, by folder, to add to this project or move from another; its **New** page starts a new
  one. A session's menu also gives its details, Markdown export, and moving it to the trash (asked
  first).
- Keys: `F9` sidebar, `Ctrl+Shift+T` new session, `Ctrl+Shift+F` add a session, `Ctrl+Shift+K`
  jump to a session, `Ctrl+Shift+W` close tab, `Ctrl+Tab` / `Ctrl+PgDn` / `Ctrl+PgUp` move between
  tabs, `Ctrl+Shift+N` new window; in a terminal `Shift+Enter` a line break, `Ctrl+Shift+C` /
  `Ctrl+Shift+V` copy and paste, `Ctrl+Shift+G` find. `Ctrl+B` then a key, as in tmux: `v` / `-`
  split, `h j k l` move between panes, `z` zoom, `x` close the pane, `g` go to any agent, `?` the
  full list.

## Settings and usage

The header's Settings button (or `Ctrl+,`) opens Settings, a window with its sections listed on the
left. It holds:

- the look: color scheme, interface style and color theme;
- the terminal's font and scrollback;
- reopening tabs on start;
- notifications;
- the context ring's thresholds;
- the language (English or Spanish);
- About.

Under Integrations you can turn on Menkar's status line in every Claude session, and have Claude
Code keep its transcripts for 10 years instead of 30 days. Under Usage & classifier you can turn on
the classification of your turns by development stage. All three are off until you turn them on.

The header's Usage button opens a window with how long Claude worked and how many tokens it used,
per project and session, by period or by day.

## Chat, MCP servers and Ghostty

Besides its terminal tab, a session in Add session's history can be continued in a chat tab: Claude
Code in a chat that asks before every file edit or command (Allow once, Always allow, Deny), and
Cursor read-only or trusted to run edits on its own. It can also be opened in
[Ghostty](https://ghostty.org) when it is installed. Settings' MCP servers lists the servers Claude
Code is configured with, read only.

## Usage in the terminal

`menkar usage` prints how long Claude worked and how many tokens it used, per project and
session, from Menkar's usage history. It opens no window.

```sh
menkar usage                          # the last 7 days
menkar usage --period today           # today, 7d, 30d or all
menkar usage --month 2026-10          # a calendar month
menkar usage --from 2026-11-01 --to 2026-11-03   # both days included
menkar usage --period today --by hour # one report per hour (or day, month)
menkar usage --json                   # JSON instead of text
```

Costs marked `~` are list-price estimates, not a bill. A `+` means some model had no price.

`menkar usage export` writes every turn as a row, for a spreadsheet or for an AI session to
analyse: who opened it, when, its project and category, its time, and its tokens and cost by model.
No prompt or answer text is in it.

```sh
menkar usage export --month 2026-10                 # JSON lines, one per turn
menkar usage export --period 30d --format csv       # CSV, for a spreadsheet
menkar usage export --project "Client work" --output turns.jsonl
```

For example, ask a Claude session: *"Run `menkar usage export --month 2026-10` and tell me the cost
per model for each project."*

## Development

Node 22 LTS and npm, on Linux (Ubuntu). `npm run ui-check` also needs `xvfb-run` (the `xvfb`
package).

```sh
npm install                          # also rebuilds node-pty for Electron
node node_modules/electron/install.js  # only if npm did not fetch Electron's binary
npm run dev                          # the app, with the renderer served by Vite
npm run ci                           # the gate: Biome, tsc, Vitest, the code, i18n and history checks
npm run ui-check                     # builds, then Playwright on the real app under xvfb-run
npm run package                      # the .deb, into release/ (takes about a minute)
npm run package:check                # inspects the built .deb; installs nothing
npm run package:smoke                # the e2e suite against the packaged app, under xvfb-run
```

`node scripts/classify-eval.mjs <labels.json>…` measures how often the turn classifier agrees with
hand labels, before a change of its prompt or model. It is run by hand only: it calls `claude` with
your login (one call per 30 turns of your plan), and its label files hold real prompts, so they stay
in the git-ignored `eval/` folder.

On Ubuntu's desktop, `npm run dev` starts Electron with `--no-sandbox`: AppArmor stops the
development build's `chrome-sandbox`. Playwright's runs are unsandboxed too (it passes
`--no-sandbox` itself).

`npm run ui-check` never opens a window on your display, and the app it starts uses a temporary
`HOME` and XDG directories, never yours. Its screenshots land in `test-results/`.

## Acknowledgements

Menkar grew out of Máté Molnár's Agent Session Manager. It was written from scratch, but the idea
started there.

## License

GPL-3.0-or-later. See `LICENSE`.
