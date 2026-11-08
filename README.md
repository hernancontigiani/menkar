# Menkar

A desktop app for working with several Claude Code (and Cursor) sessions at once: the session list
on the left, the real agent in an embedded terminal on the right, with projects, tabs, split panes,
several windows, usage tracking and file tabs. Electron and TypeScript; Linux first, then Windows
and macOS.

**Status:** in construction, usable for daily work on Ubuntu: projects, sessions in tabs, split panes,
several windows, the history of every session.

## Install (Ubuntu)

Build the package and install it with apt (Ubuntu 24.04, amd64):

```sh
npm run package                                   # builds release/menkar_<version>_amd64.deb
sudo apt install ./release/menkar_0.0.0_amd64.deb
```

It installs the app under `/opt/Menkar`, a **Menkar** launcher with its icon, and the `menkar`
command (`/usr/bin/menkar`). The post-install also installs an AppArmor profile,
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
- **Add session** (the sidebar's button) lists every session Claude Code and Cursor have on the
  machine, by folder, to add to this project or move from another; its **New** page starts a new
  one. A session's menu also gives its details, a replay, Markdown export, and moving it to the
  trash (asked first).
- Keys: `F9` sidebar, `Ctrl+Shift+T` new session, `Ctrl+Shift+F` add a session, `Ctrl+Shift+K`
  jump to a session, `Ctrl+Shift+W` close tab, `Ctrl+Tab` / `Ctrl+PgDn` / `Ctrl+PgUp` move between
  tabs, `Ctrl+Shift+N` new window; in a terminal `Shift+Enter` a line break, `Ctrl+Shift+C` /
  `Ctrl+Shift+V` copy and paste, `Ctrl+Shift+G` find. `Ctrl+B` then a key, as in tmux: `v` / `-`
  split, `h j k l` move between panes, `z` zoom, `x` close the pane, `g` go to any agent, `?` the
  full list.

## Preferences and usage

The ⚙ menu (or `Ctrl+,`) opens Preferences: terminal font and scrollback, the color scheme, the
interface style and the color theme, the language (English or Spanish), notifications, and reopening
tabs on start. Its Integrations page turns on Menkar's status line in every Claude session and the
classification of your turns by development stage, both off until you turn them on. The ⚙ menu's
Usage opens a window with how long Claude worked and how many tokens it used, per project and
session, by period or by day.

## Chat, MCP servers and Ghostty

Besides terminal tabs, the `+` menu opens chat tabs: Claude Code in a chat that asks before every
file edit or command (Allow once, Always allow, Deny), and Cursor read-only or trusted to run edits
on its own. A session in Add session's history can be continued in chat, or opened in
[Ghostty](https://ghostty.org) when it is installed. The ⚙ menu's MCP servers lists the servers
Claude Code is configured with, read only.

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

Menkar began as agent-tablet, a fork of Máté Molnár's Agent Session Manager. It has been
rewritten from scratch since, but the idea started there.

## License

GPL-3.0-or-later. See `LICENSE`.
