# Packaging — the Ubuntu .deb

How the package is built and why that way. The commands are in `README.md`.

## What builds it

**electron-builder** (`electron-builder.yml`) builds a `.deb` for amd64 into `release/`. The app id
is `io.github.hernancontigiani.Menkar`, the product name Menkar, and the executable `menkar`. The
category is Development.

- **Contents:** the app in `/opt/Menkar/`, with `app.asar` and node-pty unpacked beside it; it is
  rebuilt for Electron during the package build. Also the launcher,
  `/usr/share/applications/menkar.desktop` (`StartupWMClass=menkar`, kept in step with
  `desktopName` in `package.json`), and the icon at
  `/usr/share/icons/hicolor/512x512/apps/menkar.png`.
- **The post-install** (electron-builder's own template) links `/usr/bin/menkar` through
  `update-alternatives` and sets `chrome-sandbox` to `0755`. When the system's AppArmor understands
  `abi/4.0` it also copies `resources/apparmor-profile` to `/etc/apparmor.d/menkar` and loads it.
- **The package's version is the app's with a revision of its build** (decided 2026-11-10):
  `0.1.0-<commits>.g<hash>`, and `.dirty.<UTC time>` when the tree has changes not committed.
  `scripts/package.mjs` computes it from git (`debianRevision`) and hands it to electron-builder as
  `buildNumber`, which becomes fpm's `--iteration`. Every build sorts after the one before it for
  dpkg, with no state kept, so `apt install` of a newer build is an upgrade, not "0 upgraded". The
  app itself stays `0.1.0` (About, `package.json`), and so does the file name,
  `release/menkar_0.1.0_amd64.deb`, so the install command never changes. Read a build's version
  with `dpkg-deb -f release/menkar_0.1.0_amd64.deb Version`.
- **`publish: null`**: no update feed and no `app-update.yml` in the package. Nothing leaves the
  machine.
- `build/icons/512x512.png` is **provisional**, drawn for Menkar (a prompt and a star) until the
  human picks an icon.

## Chromium's sandbox

Ubuntu 24.04 sets `kernel.apparmor_restrict_unprivileged_userns=1`. An unconfined program cannot
use the user namespace Chromium's sandbox needs, and without that a development build only starts
with `--no-sandbox`. The package solves it as Ubuntu does for VS Code, Slack and Obsidian, whose
profiles ship in `/etc/apparmor.d`:

```
profile "menkar" "/opt/Menkar/menkar" flags=(unconfined) { userns, … }
```

The profile grants the namespace to that one executable and confines nothing else.

- **Ubuntu 22.04:** its AppArmor rejects `abi/4.0`, so the post-install skips the profile. That
  release does not restrict user namespaces, so the sandbox works without it.
- **The setuid helper is not used.** The template sets `chrome-sandbox` to `4755` only when user
  namespaces do not work at all. Its test runs as root, where they always work, so on a current
  kernel the helper stays `0755`.

**Rejected:** a post-install of our own forcing `chrome-sandbox` to `root:root 4755`. That adds a
setuid-root binary, which is what Ubuntu is moving away from, and leaves a script for us to
maintain (decided 2026-11-08). **AppImage first:** it cannot carry a setuid helper or install a
profile, so it needs `--no-sandbox`; it can come later as a second target. **Snap and Flatpak:**
each is a sandbox of its own, with `claude` and `~/.claude` outside it.

## The command in a terminal

Decision 1.27 (2026-11-09): `/usr/bin/menkar` run from a terminal gives it back at once, as VS
Code's `code` does. When stdout is a terminal, the process starts a copy of itself with an internal
`--menkar-detached` first argument, in a session of its own (`setsid`, so closing the terminal
sends it no SIGHUP) with stdin, stdout and stderr on `/dev/null`, and exits 0. The copy then runs
as any start does, single-instance hand-off included. The decision is `shouldDetach` in
`src/core/launch.ts`.

- **Stays attached:** `menkar usage …`, `menkar open` with no file (it prints how to use it),
  `--help`, `--version`, `--foreground` / `-f`, and any start whose stdout is not a terminal (the
  launcher, a pipe, Playwright).
- **Never detaches:** under `ELECTRON_RUN_AS_NODE` (the statusline helper), the UI checks
  (`MENKAR_E2E_XVFB`, `MENKAR_E2E_EXECUTABLE`), the dev server (`ELECTRON_RENDERER_URL`), and on
  Windows.
- **The log** is `$XDG_CACHE_HOME/menkar/menkar.log` however the app starts (warnings and errors
  unless `MENKAR_LOG` asks for more). Its copy on stderr goes to `/dev/null` once detached. From
  the launcher it goes wherever GNOME sends a launched app's output: on the human's Ubuntu 24.04,
  no Menkar line was found in the user journal (2026-11-09). `menkar -f` shows it in the terminal.
- **The test** (`e2e/detach.spec.ts`) runs the built app under a pseudo-terminal with those
  variables removed, and against the packaged one under `package:smoke`.

## Checks

- **`npm run package:check`** (`scripts/check-package.mjs`) installs nothing. It reads the `.deb`
  with `dpkg-deb` and fails when one of these is missing: the app, `chrome-sandbox`, node-pty's
  native module, the launcher (whose `Exec` passes no extra flag), the icon, the post-install's
  link, its `0755` and its profile install and load, or the profile's `userns`. An update feed in
  the package also fails it. Vitest runs the same check on the post-install, profile and launcher
  recorded from a real build (`tests/data/package/`), so an upstream template change shows as a red.
  It also fails a Version that is not the app's plus a build revision.
- **`npm run package:smoke`** runs the e2e suite against `release/linux-unpacked/menkar`, under
  `xvfb-run` with Playwright's `--no-sandbox`. It proves the packaged app starts, loads node-pty
  from the asar and keeps Chromium's data out of the config directory. It cannot prove the sandbox.
- **The sandbox itself is the human's check**: install, start Menkar from the launcher, and see a
  terminal. A session never installs the package.
- `apparmor_parser --skip-kernel-load --debug` accepts the packaged profile (AppArmor 4.0.1, checked
  2026-11-08).
- Neither runs in `npm run ci`: the package takes about a minute to build.

## Cutting a release

A release is cut by a session and checked by the human; nothing is published anywhere.

1. The version in `package.json` (and the two matching fields of `package-lock.json`), one change.
   The package's name follows it: `release/menkar_<version>_amd64.deb`.
2. `npm run ci` and `npm run ui-check` green on the tree being released.
3. `npm run package`, then `npm run package:check` and `npm run package:smoke` against that build.
   `package:check` reads the `.deb` named after `package.json`'s version.
4. The `.deb`'s size and entry count go in the release's log, to compare with the next one.
5. `README.md` "Install" names the version; `docs/release-checklist.md` names it too.
6. The human goes through `docs/release-checklist.md` on their own desktop. Until every step passes
   the build is a release candidate; a session never installs the package.
