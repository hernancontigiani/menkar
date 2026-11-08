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
  Development; the `.desktop` entry and icon; `/usr/bin/menkar` linked. **The sandbox (corrected
  2026-11-08 on execution; the first premise, a setuid `chrome-sandbox`, was wrong):**
  electron-builder's post-install sets `chrome-sandbox` to `0755`. Its user-namespace test runs as
  root and always passes. It then installs `resources/apparmor-profile` as `/etc/apparmor.d/menkar`
  (`flags=(unconfined) { userns, }`), the same kind of profile Ubuntu 24.04 ships for VS Code, Slack
  and Obsidian. That profile is what lets the installed app start without `--no-sandbox`. On 22.04
  the profile is skipped (no `abi/4.0`), and user namespaces are not restricted there. A forced
  setuid-root helper was rejected (`set`, 2026-11-08).
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
| The installed app keeps the sandbox | `package:check` asserts `chrome-sandbox` is in the package, the profile with `userns` is in `resources/`, and the post-install leaves the helper `0755` and installs and loads the profile; the human's check: starts from the launcher with no `--no-sandbox` |
| The package has the launcher and the command | `package:check` lists the `.desktop`, the icon and `/usr/bin/menkar` |

## Out of scope

Windows and macOS installers; auto-update (never: nothing leaves the machine); the final icon.

## Do not touch

`docs/spec/`, `docs/NOT_BUILT_YET.md`, `plans/02-spec.md` (`b2`).

## Execution blocks

### B1 — userData
- [x] Set before ready; the Vitest and e2e checks.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — The `.deb`
- [x] electron-builder config, `npm run package`, `npm run package:check`.
- **Verification:** `package:check` green; the log lists the package's files and the post-install.

### B3 — Exit
- [x] `README.md` "Install" (the `apt install` line, what the post-install does), `docs/packaging.md`,
      its row in `CLAUDE.md`; §2 of `plans/00-STATUS.md` gets the human's check: "Install the `.deb`,
      start Menkar from the launcher, and see a terminal in it".
- **Verification:** `npm run ci`.

## Execution log

Executed by `b1` on 2026-11-08, B1 → B3.

**The sandbox premise was wrong, and `set` decided (option A).** electron-builder 26.18.0's
post-install does not make `chrome-sandbox` setuid on 24.04: its namespace test runs as root, so it
sets `0755`. It installs an AppArmor `userns` profile instead. `set` chose to keep that rather than
force `4755`, and the design text above is corrected. On **22.04** the post-install skips the
profile, because its AppArmor rejects `abi/4.0`; that release does not restrict user namespaces,
so the sandbox runs anyway. `apparmor_parser --skip-kernel-load --debug` accepts the profile on
this machine (AppArmor 4.0.1).

**The package** (`release/menkar_0.0.0_amd64.deb`, about 100 MB, 291 entries):
- `/opt/Menkar/`: `menkar`, `chrome-sandbox` (0755 in the archive), `resources/app.asar`,
  `resources/apparmor-profile`, and node-pty under `resources/app.asar.unpacked/`.
- `/usr/share/applications/menkar.desktop`: `Exec=/opt/Menkar/menkar %U`,
  `StartupWMClass=menkar`, `Icon=menkar`.
- `/usr/share/icons/hicolor/512x512/apps/menkar.png`.
- `postinst`: `update-alternatives` for `/usr/bin/menkar`, `chmod 0755` on `chrome-sandbox`,
  `update-desktop-database`, the AppArmor copy and `apparmor_parser --replace`.
- `postrm` removes the link and the profile.
- Control: `Package: menkar`, `Section: devel`, `Depends` from electron-builder; the maintainer is
  the git author.

**Additions beyond the plan:**
- **`npm run package:smoke`** runs the e2e suite against `release/linux-unpacked/menkar`, using
  `MENKAR_E2E_EXECUTABLE` in `e2e/app.ts`. Its first run failed the userData test. The cause was
  `$XDG_CONFIG_HOME/ibus/bus`, written by the input method's client, not by Menkar. The test now
  asserts on `<config>/menkar` itself, which is what the rule protects. With that, 3 of 3 pass
  against the packaged app.
- **`desktopName: menkar.desktop` with `syncDesktopName`**, as electron-builder recommends, so the
  window joins its launcher (`StartupWMClass=menkar`). Whether GNOME groups the window under the
  launcher is part of the human's check.
- **A provisional icon drawn for Menkar** (`build/icons/512x512.png`: a prompt and a star), not
  agent-tablet's, until the human picks one.
- `package:check`'s logic has Vitest cases, run on the post-install, profile and launcher recorded
  from the real build (`tests/data/package/`). Each of nine mutations is seen failing.
- The userData e2e was seen red with the `setPath` disabled (received `<config>/menkar`).

**Not anticipated:**
- The archive's directories and files are group-writable (`drwxrwxr-x`, owned by root:root), taken
  from this machine's umask 002. That is harmless with group root, but lintian would complain.
- `npm run package` downloads Electron's zip and fpm on the first build (build-time network, not
  the app's).
