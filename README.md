# Menkar

A desktop app for working with several Claude Code (and Cursor) sessions at once: the session list
on the left, the real agent in an embedded terminal on the right, with projects, tabs, split panes,
several windows, usage tracking and file tabs. Electron and TypeScript; Linux first, then Windows
and macOS.

**Status:** in construction. Not usable yet.

Menkar is the multiplatform successor of agent-tablet, itself started from
[Agent Session Manager](https://github.com/r4nd3l/agent-session-manager) by Máté Molnár. It is
written from scratch from agent-tablet's documented behaviour; no code is carried over.

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

On Ubuntu's desktop, `npm run dev` starts Electron with `--no-sandbox`: AppArmor stops the
development build's `chrome-sandbox`. Playwright's runs are unsandboxed too (it passes
`--no-sandbox` itself).

`npm run ui-check` never opens a window on your display, and the app it starts uses a temporary
`HOME` and XDG directories, never yours. Its screenshots land in `test-results/`.

## License

GPL-3.0-or-later. See `LICENSE`.
