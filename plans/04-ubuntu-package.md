# Plan 04 — the Ubuntu package, and Chromium's data out of the config directory

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 02 (`b2`): no
> shared file.
>
> **Exit, when executed:** installing and the sandbox's requirement → `README.md` ("Install");
> how the package is built and why that way → `docs/packaging.md` with its row in `CLAUDE.md`'s docs
> table; the rest → `git log`.

## Goal

From the skeleton on, every feature lands in an app the human can install on Ubuntu like any other:
a `.deb` that installs Menkar with Chromium's sandbox working (no `--no-sandbox`), a launcher with
its icon, and a `menkar` command. And Electron's own data (Chromium caches, Crashpad, local storage)
stops sitting next to `state.json`.

## What already exists

- `npm run dev` passes `--no-sandbox` on Linux desktops; agent-tablet's plan 11 found why: Ubuntu
  24.04's AppArmor forbids unprivileged user namespaces, so Chromium needs `chrome-sandbox` owned by
  root with mode 4755, or an AppArmor profile for the app.
- `src/core/paths.ts` resolves `config`, `cache`, `data`; Electron's `userData` still defaults to
  `$XDG_CONFIG_HOME/menkar/` (found by plan 03).
- The icon: agent-tablet's `data/icons/io.github.hernancontigiani.AgentTablet.svg` is provisional;
  Menkar gets its own name in the launcher and keeps a provisional icon until the human picks one.

## The design

- **`userData`** is set before `app.ready` to `<cache>/electron` (Linux) — Chromium's data is
  rebuildable, so it belongs in the cache; `state.json` and `projects.json` stay alone in `<config>`.
  Windows and macOS keep Electron's default, which is already per-app.
- **electron-builder** (already chosen, `plans/00-STATUS.md` §1 1.6) builds a `.deb` for amd64:
  app id `io.github.hernancontigiani.Menkar`, product name Menkar, executable `menkar`, category
  Development; the `.desktop` entry and icon; `/usr/bin/menkar` linked. **The sandbox:** the package's
  post-install sets `chrome-sandbox` to `root:root` and `4755` (electron-builder's deb does this when
  the sandbox is enabled; verify it rather than assume), so the installed app starts without
  `--no-sandbox`. An AppArmor profile is the alternative only if the setuid path fails on 24.04; the
  log says which was used.
- **`npm run package`** builds it into `release/`. Not part of `npm run ci` (it takes minutes);
  `npm run package:check` installs nothing: it inspects the built `.deb` (`dpkg-deb -c` / `-I`) for
  the files, the post-install script and `chrome-sandbox`'s mode.
- **Installing is the human's**: `sudo apt install ./release/menkar_<v>_amd64.deb`. A session never
  installs it.

**Rejected:** AppImage first (it cannot set a setuid helper, so it needs `--no-sandbox` or a
user-namespace profile anyway; it can come later as a second target); Snap and Flatpak (each a
sandbox of its own to reason about, with `claude` and `~/.claude` outside it).

## Product decisions and the test that holds each

| Decision | Test |
|---|---|
| Chromium's data is not in the config dir | Vitest: the userData path main sets is under `<cache>`; e2e: after a run, the temporary config dir holds no Chromium files |
| The installed app keeps the sandbox | `package:check` asserts `chrome-sandbox` is in the package and the post-install sets 4755 root; the human's check: starts from the launcher with no `--no-sandbox` |
| The package has the launcher and the command | `package:check` lists the `.desktop`, the icon and `/usr/bin/menkar` |

## Out of scope

Windows and macOS installers; auto-update (never: nothing leaves the machine); the final icon.

## Do not touch

`docs/spec/`, `docs/NOT_BUILT_YET.md`, `plans/02-spec.md` (`b2`).

## Execution blocks

### B1 — userData
- [ ] Set before ready; the Vitest and e2e checks.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — The `.deb`
- [ ] electron-builder config, `npm run package`, `npm run package:check`.
- **Verification:** `package:check` green; the log lists the package's files and the post-install.

### B3 — Exit
- [ ] `README.md` "Install" (the `apt install` line, what the post-install does), `docs/packaging.md`,
      its row in `CLAUDE.md`; §2 of `plans/00-STATUS.md` gets the human's check: "Install the `.deb`,
      start Menkar from the launcher, and see a terminal in it".
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
