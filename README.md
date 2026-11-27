# Menkar

A desktop app for working with several coding-agent sessions at once: the session list on the
left, the real agent in an embedded terminal on the right, with projects, tabs, split panes,
several windows, usage tracking and file tabs. It runs **Claude Code, Codex, Cursor and OpenCode**
(below). Electron and TypeScript, for Linux on amd64; macOS experimental, after 1.0; there is no
Windows version.

**Documentation:** the site, in English and Spanish, at <https://hernancontigiani.github.io/menkar/>.

## Install

Menkar ships as a `.deb` for Debian, Ubuntu and their derivatives, and an `.rpm` for Fedora and
other dnf systems, for amd64. Install it from the package repository, so `apt upgrade` or `dnf
upgrade` brings each new version.

**Debian, Ubuntu and their derivatives:**

```sh
curl -fsSL -o /tmp/menkar.key https://dl.cloudsmith.io/public/menkar/menkar-packages/gpg.32B297F2B56D38CD.key
gpg --show-keys /tmp/menkar.key
sudo gpg --dearmor --yes -o /usr/share/keyrings/menkar-archive-keyring.gpg /tmp/menkar.key
echo "deb [signed-by=/usr/share/keyrings/menkar-archive-keyring.gpg] https://dl.cloudsmith.io/public/menkar/menkar-packages/deb/any-distro any-version main" | sudo tee /etc/apt/sources.list.d/menkar.list
sudo apt update
sudo apt install menkar
```

`gpg --show-keys` must print the fingerprint `4D80 2D23 F528 B669 95C6  529D 32B2 97F2 B56D 38CD`.

**Fedora and other dnf systems:**

```sh
sudo rpm --import https://dl.cloudsmith.io/public/menkar/menkar-packages/gpg.32B297F2B56D38CD.key
sudo tee /etc/yum.repos.d/menkar.repo > /dev/null <<'EOF'
[menkar]
name=Menkar
baseurl=https://dl.cloudsmith.io/public/menkar/menkar-packages/rpm/any-distro/any-version/$basearch
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://dl.cloudsmith.io/public/menkar/menkar-packages/gpg.32B297F2B56D38CD.key
EOF
sudo dnf install menkar
```

Installing from the repository means apt or dnf contacts Cloudsmith, which logs the address of each
download; Menkar itself connects to nothing. To avoid it, download the `.deb` or `.rpm` and
`SHA256SUMS` from the [latest release](https://github.com/hernancontigiani/menkar/releases/latest),
check them with `sha256sum --check --ignore-missing SHA256SUMS`, then `sudo apt install
./menkar_*_amd64.deb` or `sudo dnf install ./menkar-*.x86_64.rpm`. A single file gets no updates:
each new version is installed the same way.

Package repository hosting is graciously provided by [Cloudsmith](https://cloudsmith.com).

It installs the app under `/opt/Menkar`, a **Menkar** launcher with its icon, and the `menkar`
command (`/usr/bin/menkar`). Run from a terminal, `menkar` (and `menkar open <file>…`) starts the
app on its own and gives the terminal back at once, as `code` does; closing the terminal leaves
the app running. `menkar --foreground` (or `-f`) keeps it attached, to watch its log. `menkar
usage` prints in the terminal as before. Where AppArmor runs, the post-install also installs an
AppArmor profile, `/etc/apparmor.d/menkar`, that lets Chromium's sandbox create its user namespace.
Ubuntu 24.04 blocks that for unconfined apps, and ships the same kind of profile for VS Code, Slack
and Obsidian. The installed app runs with the sandbox, never with `--no-sandbox`. `sudo apt remove
menkar` (or `sudo dnf remove menkar`) takes it all out.

## The agents

Menkar runs the agent's own command in its terminal, with your login and settings; it does not
bring one. Install and sign in to at least one:

| Agent | Command | In Menkar |
|---|---|---|
| Claude Code | `claude`, 2.1.267 or later | The context ring, usage, the orchestration mode, Remote Control, forking, chat tabs |
| Codex | `codex` | The context ring, usage, the orchestration mode |
| Cursor | `cursor-agent` | Usage (with its hooks on), the orchestration mode as a worker only, chat tabs |
| OpenCode | `opencode` | The context ring, usage, the orchestration mode |

Every agent's sessions run in tabs, show their state and notify. The site's
[agents page](https://hernancontigiani.github.io/menkar/start/agents/) says what each one does in
Menkar, and Settings › About shows the version of each that this release was tested with.

## Using the window

- **Projects** are picked, created, renamed and deleted from the dropdown at the top of the
  sidebar. A project lists the sessions you put in it, from any folder, in groups if you like (a
  row's ⋮ menu → Group). A project is open in one window at a time.
- **A session runs in a tab**: double-click its row, or ⋮ → Open, to resume it in its real
  agent. "Open beside the current tab" puts it next to another one. The `+` button starts a new session in a folder you choose; the ▾ menu also continues the last
  session of a folder, or opens a new window.
- **Closing a tab, a window or the app hangs up its agent**, as closing a terminal does; nothing is
  typed into it. Closing a window with agents still working asks first.
- **Files** open in tabs from the ▾ menu or `Ctrl+Shift+O`, with syntax colors; `Ctrl+S` saves, and
  a Markdown file has a rendered preview (`Ctrl+Shift+V`). Claude Code's own files (`~/.claude`,
  `~/.claude.json`) open read only. From a terminal, `menkar open <file>…` opens files in the
  running app.
- **Remote Control** (phone and claude.ai) is turned on per Claude Code session: the switch on
  New, or "Remote control" in a session's menu; it applies from the session's next start.
- **On the next start** the windows and their tabs come back (the `reopen_tabs` setting turns it off).
- **The orchestration mode** (the "Orchestration" switch beside Usage, or a project's team icon in
  the dropdown) is for a project where several sessions work together: you talk to one session,
  the orchestrator, which hands the work out as tasks. The sidebar's **Work** view shows the topics
  waiting for your decision and how far each task is ("3/5 · building .deb"); **Team** shows the
  team by role; the **Board** button opens every topic and task in columns. A session's menu sets
  the orchestrator, a role and "with you"; a task's right-click sets its ★. The first time, Menkar asks who orchestrates and offers its guide, which ships
  with the app (`/opt/Menkar/resources/plugin/guide/orchestration-mode.md` on Ubuntu) so any
  session can read it.
- **Add session** (the sidebar's button) lists every session your agents have on the machine, by
  folder, to add to this project or move from another; its **New** page starts a new one. A
  session's menu also gives its details, Markdown export, and, for Claude Code and Cursor, moving
  it to the trash (asked first).
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

The header's Usage button opens a window with how long your agents worked and how many tokens
they used, per project and session, by period or by day.

## Chat, MCP servers and Ghostty

Besides its terminal tab, a Claude Code or Cursor session in Add session's history can be
continued in a chat tab: Claude Code in a chat that asks before every file edit or command (Allow once, Always allow, Deny), and
Cursor read-only or trusted to run edits on its own. It can also be opened in
[Ghostty](https://ghostty.org) when it is installed. Settings' MCP servers lists the servers Claude
Code is configured with, read only.

## Usage in the terminal

`menkar usage` prints how long your agents worked and how many tokens they used, per project and
session, from Menkar's usage history. It opens no window.

```sh
menkar usage                          # the last 7 days
menkar usage --period today           # today, 7d, 30d or all
menkar usage --month 2026-10          # a calendar month
menkar usage --from 2026-11-01 --to 2026-11-03   # both days included
menkar usage --period today --by hour # one report per hour (or day, month)
menkar usage --json                   # JSON instead of text
menkar usage now --json               # the burst in progress, for a break reminder of your own
```

Costs marked `~` are list-price estimates, not a bill. A `+` means some model had no price.

`menkar usage now --json` is for a program you run yourself: it tells it whether you are in a burst
of activity and since when, whether you are away, and today's active time. Menkar itself never
alerts you to take a break.

`menkar usage export` writes every turn as a row, for a spreadsheet or for an AI session to
analyse: who opened it, when, its project and category, its time, and its tokens and cost by model.
No prompt or answer text is in it.

```sh
menkar usage export --month 2026-10                 # JSON lines, one per turn
menkar usage export --period 30d --format csv       # CSV, for a spreadsheet
menkar usage export --project "Client work" --output turns.jsonl
menkar usage export --period today --rows panes     # sessions blocked and working, per 15 minutes
```

`--rows panes` gives, for every 15 minutes, how many sessions were blocked, working, idle and done
at most at once and for how long, over every project, and how much of those 15 minutes Menkar was
running to see it.

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

To build and install the package from source:

```sh
npm run package                                   # builds release/menkar_<version>_amd64.deb
sudo apt install ./release/menkar_<version>_amd64.deb
```

Before a build is called a version, go through `docs/release-checklist.md`: the checks only a
person on a real desktop can make.

The public site lives in `site/`, with its own dependencies; it needs the Node 22 release Astro
asks for (`site/package.json`'s `engines`). Its tone guide is `site/AGENTS.md`.

```sh
npm run site:install                 # the site's own dependencies, once
npm run site:dev                     # the site with live reload, English at / and Spanish at /es/
npm run site:build                   # the static site, into site/dist/
npm run site:check                   # builds, then checks links, twins and that nothing loads from elsewhere
npm run captures                     # screenshots of the real app under xvfb-run, into the site
npm run captures:reviewed -- <slug>… # signs off the changed images you opened (or --all-changed)
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
