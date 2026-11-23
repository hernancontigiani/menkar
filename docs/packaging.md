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
- **Menkar's skills plugin** goes in `/opt/Menkar/resources/plugin/`, outside `app.asar`
  (`extraResources`), because `claude --plugin-dir` reads plain files and cannot read inside an
  asar. `package:check` fails when its manifest, guide or any of its skills is missing.
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
- **`Depends`** is electron-builder's own list plus `libasound2t64 | libasound2` (2026-11-16):
  Electron links `libasound.so.2`, which electron-builder does not list, and on a system without a
  desktop sound stack the app died at start with "libasound.so.2: cannot open shared object file"
  (seen in a minimal Ubuntu 24.04 container). `package:check` fails a package without it.
- **`publish: null`**: no update feed and no `app-update.yml` in the package. Nothing leaves the
  machine.
- **What connects to the network is the agents Menkar runs**, as they would without it. That
  includes the `opencode serve` Menkar runs for its OpenCode tabs (`docs/agents.md`), which fetches
  OpenCode's model catalog from https://models.opencode.ai at its start and every five minutes
  while it runs (measured by `opencode` on 2.3.0, 2026-11-21): OpenCode's own traffic, as with the
  user's own OpenCode, and only while an OpenCode tab exists. Menkar does not set
  `OPENCODE_DISABLE_MODELS_FETCH` (decision 1.206, the human, 2026-11-21).
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
maintain (decided 2026-11-08). **The AppImage:** it cannot carry a setuid helper or install a
profile, so on Ubuntu 24.04 it starts only with `--no-sandbox`; deferred at 1.0 (the human,
2026-11-19), with its trigger in `docs/NOT_BUILT_YET.md`. **Snap and Flatpak:** each is a sandbox
of its own, with `claude` and `~/.claude` outside it.

## The command in a terminal

Decision 1.27 (2026-11-09): `/usr/bin/menkar` run from a terminal gives it back at once, as VS
Code's `code` does. When stdout is a terminal, the process starts a copy of itself with an internal
`--menkar-detached` first argument, in a session of its own (`setsid`, so closing the terminal
sends it no SIGHUP) with stdin, stdout and stderr on `/dev/null`, and exits 0. The copy then runs
as any start does, single-instance hand-off included. The decision is `shouldDetach` in
`src/core/launch.ts`.

- **Stays attached:** `menkar usage …`, `menkar open` with no file (it prints how to use it),
  `--help`, `--version` / `-v`, `--foreground` / `-f`, and any start whose stdout is not a terminal
  (the launcher, a pipe, Playwright).
- **`menkar --version`** (or `-v`, 2026-11-20) prints the version on stdout and exits 0: the
  package's whole Version (`0.1.0-<commits>.g<hash>`, what `dpkg-deb -f` and `rpm -q` show), which
  `scripts/package.mjs` writes into the asar's `package.json` as `packageVersion`; run from the
  tree, `package.json`'s `version`. It opens no window, takes no single-instance lock and makes none
  of the app's folders (`asksVersion` in `src/core/launch.ts`, `e2e/version.spec.ts`, which under
  `package:smoke` also asserts the build's revision).
- **Never detaches:** under `ELECTRON_RUN_AS_NODE` (the statusline helper), the UI checks
  (`MENKAR_E2E_XVFB`, `MENKAR_E2E_EXECUTABLE`), the dev server (`ELECTRON_RENDERER_URL`), and on
  Windows.
- **The log** is `$XDG_CACHE_HOME/menkar/menkar.log` however the app starts (warnings and errors
  unless `MENKAR_LOG` asks for more). Its copy on stderr goes to `/dev/null` once detached. From
  the launcher it goes wherever GNOME sends a launched app's output: on the human's Ubuntu 24.04,
  no Menkar line was found in the user journal (2026-11-09). `menkar -f` shows it in the terminal.
- **The test** (`e2e/detach.spec.ts`) runs the built app under a pseudo-terminal with those
  variables removed, and against the packaged one under `package:smoke`.

## The programs agents run

Three programs ship inside app.asar beside the app, each its own `electron.vite.config.ts` entry
under `out/main/`, and each run by an agent as `ELECTRON_RUN_AS_NODE=1 <electron> <app.asar>/out/main/<program>.js`:
Electron serves the script from the archive, so none is unpacked (`asarUnpack` is only for native
modules and for files another program opens itself).

- `statusline.js`: Claude Code's statusline and Menkar's hooks, through `--settings`.
- `mcp-server.js`: Menkar's MCP server, through `--mcp-config`.
- `codex-notify.js`: Codex's `notify`, through `-c notify=[…]`, its argv starting
  `/usr/bin/env ELECTRON_RUN_AS_NODE=1` so the variable never enters Codex's own environment.

## Checks

- **`npm run package:check`** (`scripts/check-package.mjs`) installs nothing. It reads the `.deb`
  with `dpkg-deb` and fails when one of these is missing: the app, `chrome-sandbox`, node-pty's
  native module, the launcher (whose `Exec` passes no extra flag), the icon, the post-install's
  link, its `0755` and its profile install and load, or the profile's `userns`. An update feed in
  the package also fails it. Vitest runs the same check on the post-install, profile and launcher
  recorded from a real build (`tests/data/package/`), so an upstream template change shows as a red.
  It also fails a Version that is not the app's plus a build revision.
  **It reads app.asar's header** (the first megabyte of the archive, out of the package, parsed by
  hand: a pickle holding the header's size, then the JSON tree) and fails when one of the programs
  Electron's binary runs is missing from it: `out/main/index.js`, and the three agents run as plain
  Node, `statusline.js` and `mcp-server.js` (Claude Code) and `codex-notify.js` (Codex's `notify`).
- **`npm run package:smoke`** runs the e2e suite against `release/linux-unpacked/menkar`, under
  `xvfb-run` with Playwright's `--no-sandbox`. It proves the packaged app starts, loads node-pty
  from the asar and keeps Chromium's data out of the config directory. It cannot prove the sandbox.
- **The sandbox itself is the human's check**: install, start Menkar from the launcher, and see a
  terminal. A session never installs the package.
- `apparmor_parser --skip-kernel-load --debug` accepts the packaged profile (AppArmor 4.0.1, checked
  2026-11-08).
- Neither runs in `npm run ci`: the package takes about a minute to build.

## The sandbox package

The multi-agent branch is tried in a second **flavour**, Menkar Sandbox, that cannot touch the
human's daily Menkar (1.155 Q3) and duplicates everything it needs to run on its own (1.158).

- **The flavour is a build-time constant** (`src/core/flavor.ts`, defined by
  `electron.vite.config.ts`): `MENKAR_FLAVOR_BUILD` when set, else `menkar` on `main` and `sandbox`
  on any other branch, so a build in the branch's worktree is never a `menkar` package by mistake.
  The build writes it to `out/main/flavor.txt`, and `scripts/package.mjs` packages that flavour,
  refusing a `--flavour` that differs. `npm run package:sandbox` builds and packages a sandbox;
  `npm run package:check -- --flavour sandbox` checks it. `ui-check` builds as `menkar` on any
  branch: the e2e suite tests the app as it ships.
- **A checkout on a detached HEAD builds a sandbox.** `git rev-parse --abbrev-ref HEAD` prints
  `HEAD` there, not `main`, so a clean clone of a `main` commit (the way to package one while
  others edit the live tree) needs `MENKAR_FLAVOR_BUILD=menkar npm run package`. Without it,
  `package.mjs` follows `out/main/flavor.txt` and builds `menkar-sandbox` (seen 2026-11-18).
- **Its own package**, from `electron-builder.sandbox.yml` (`extends: ./electron-builder.yml`):
  `menkar-sandbox`, in `/opt/Menkar-sandbox/`, built into `release/sandbox/` so its
  `linux-unpacked` never replaces the daily one's. The post-install, post-remove and AppArmor
  templates follow the executable and product names, so its command, alternatives name, profile,
  launcher and icon file are its own. **Four names do not follow and are set explicitly**: the
  package name (without it apt installs the sandbox as an upgrade that replaces the daily Menkar),
  the launcher's `desktopName`, the artifact name and the app id. `package:check` and its test
  fail when the package is not `menkar-sandbox` or shares any installed file with `menkar`'s.
- **Outside `/opt/Menkar`, as the human allowed (1.157 P1):** `/usr/bin/menkar-sandbox` and
  `/etc/apparmor.d/menkar-sandbox`, plus its launcher and icon under `/usr/share`. Each package's
  post-remove unloads only its own profile.
- **Its own icon** (1.166, variant A): Menkar's star, dark (`#1e1e2e`), on an amber tile
  (`#f5a524`) instead of the dark one. `build/icons-sandbox/menkar-sandbox.svg` is its source and
  `512x512.png` is rendered from it (Playwright's Chromium, a screenshot of the SVG at 512 px with a
  transparent background); a change to the SVG is rendered again by hand.
- **What the flavour changes in the app:** its state directories (`menkar-sandbox` under the XDG
  config, cache and data homes, so its own state, records, logs, usage history and single-instance
  lock), its files folder (`~/Menkar-sandbox`), its name wherever the app shows one ("Menkar
  Sandbox"), and its panes carry `MENKAR_FLAVOR=sandbox`. Both flavours strip an inherited
  `MENKAR_FLAVOR` first. The statusline and MCP server programs are built with the same constant
  and ship in its own package with its own plugin copy.

**What it still shares, because it cannot own it, and how each stays safe:**

| Shared | How it stays safe |
|---|---|
| The agents' own data (`~/.claude/projects`, `~/.cursor/projects`) | It acts only on the sessions it started (`started_sessions` in its own `state.json`): its windows list no other, and every action naming another is refused before it does anything (1.159 B1) |
| Claude Code's messaging registry | Sandbox projects take names no daily project has (a hand check); wakes go by session id |
| `~/.claude/settings.json` | No flavour chains to a Menkar statusline of any flavour; the sandbox shows the statusline and retention items read only, "managed by Menkar", and its own sessions get its statusline through `--settings` |
| The agents' logins | Never read or copied |
| The classifier's account use | Off in the sandbox, its setting hidden (1.159 S11) |

**The install check is in a throwaway container**, never on the human's machine: both .debs
installed side by side, `dpkg -L menkar` and `/opt/Menkar` unchanged by the sandbox's install, and
both apps running at once with their own windows. AppArmor profiles cannot be loaded inside a
container, so there only their files are checked. The human installs the sandbox at the end of the
branch's first phase.

## The RPM

The same app as the `.deb`, for Fedora and the other RPM systems, built by the same command with
`--targets deb,rpm`: `npm run package -- --targets deb,rpm` writes `release/menkar_<version>_amd64.deb`
and `release/menkar-<version>.x86_64.rpm`. With no `--targets` only the `.deb` is built, so a
local build needs no `rpmbuild` (`sudo apt-get install rpm` provides it on Ubuntu). The sandbox is
never released and stays a `.deb` alone: `package.mjs` refuses `rpm` with its flavour.

- **Its version** is the `.deb`'s: Version is the app's, and Release is the build's revision
  (`<commits>.g<hash>[.dirty.<UTC time>]`), which `package.mjs` hands to electron-builder as the
  build number for both formats. `dnf` orders builds as `apt` does.
- **Requires**: electron-builder's own list plus `alsa-lib`, for the same reason as the `.deb`'s
  ALSA line: Electron links `libasound.so.2`.
- **It owns `/opt/Menkar`** (`fpm: ['--directories', '/opt/Menkar']` in `electron-builder.yml`).
  fpm lists only files in an `.rpm`, so before it `dnf remove menkar` took every file and left
  `/opt/Menkar`'s directories behind, empty (seen 2026-11-20 on Fedora 45).
- **The post-install is the `.deb`'s**, from electron-builder's one template for both formats
  (`tests/data/package/rpm/scripts` holds it, and a test asserts it equals the `.deb`'s). On
  Fedora, `update-alternatives` is `alternatives` and links `/usr/bin/menkar`; there is no
  AppArmor, so the profile branch is skipped without a word; SELinux does not restrict
  unprivileged user namespaces, so the template leaves `chrome-sandbox` `0755` and Chromium's
  sandbox works without a profile. On a distribution with AppArmor 4 (openSUSE) the profile is
  installed as on Ubuntu: not tried.
- **A container is not a host**: Docker's default seccomp profile refuses `unshare --user`, so in
  a plain `docker run` the template sets `chrome-sandbox` to `4755` (seen 2026-11-20). With
  `--security-opt seccomp=unconfined`, as a Fedora host behaves, it stays `0755`.
- **`package:check -- --targets deb,rpm`** checks both; on the `.rpm` it reads `rpm -qp --info`,
  `--requires`, `--scripts` and `rpm2cpio | cpio -t` (so it needs `rpm` and `cpio`) and fails when
  the Name is not `menkar`, the Version is not the app's, the Release is not a build revision,
  `alsa-lib` is not required, `/opt/Menkar` is not the package's, or anything the `.deb` must hold
  is missing (the same files, post-install lines, profile and launcher, and no update feed).
  Vitest runs it on the recorded `tests/data/package/rpm/` (the packager's address scrubbed from
  `info`).
- **Checked in containers** (2026-11-20): built in Ubuntu 24.04 with `rpm` installed, then in
  `fedora:latest` (Fedora 45) `dnf install ./menkar-*.rpm`, `rpm -q menkar` with the revision,
  `/usr/bin/menkar` → `/opt/Menkar/menkar`, `chrome-sandbox` `0755`, the app's window shown under
  `xvfb-run`, and `dnf remove menkar` taking `/opt/Menkar` and the link away.

## The package repository

Users who install from the repository get every later version with `apt upgrade` or `dnf upgrade`.
It is hosted by **Cloudsmith** on its free open-source plan (the human, 2026-11-19): workspace
`menkar`, repository **`menkar-packages`** (the slug `menkar` stayed reserved after a first,
private repository was deleted), visibility Open source, licence GPL-3.0-or-later. One repository
holds both formats, uploaded as `any-distro/any-version`, so one package serves every Debian,
Ubuntu, Fedora and RPM release.

- **What reaches it**: only a published GitHub Release's own `.deb` and `.rpm`, the files the human
  checked on the draft. `.github/workflows/publish.yml` downloads them with `gh release download`,
  checks them against the release's `SHA256SUMS`, and pushes them with `cloudsmith push deb|rpm
  menkar/menkar-packages/any-distro/any-version … --republish` through
  `cloudsmith-io/cloudsmith-cli-action` (pinned by commit). `--republish` lets a run by hand finish
  an upload that failed halfway: the file already there is replaced by the same bytes. A
  prerelease is never uploaded.
- **Its credential** is reachable only from the GitHub environment `packages`, whose only allowed
  refs are `v*` tags, so no PR workflow reaches it, and a run by hand must be started from the tag
  ("Use workflow from"), not from `main`. The upload goes by **OIDC** first: Cloudsmith's service
  account `sa-menkar` (Write on `menkar-packages` only) and its OIDC provider `github-actions` accept
  a GitHub token only with the claims `repository` = `hernancontigiani/menkar` and `environment` =
  `packages`, so no long-lived secret is used. The action verifies the exchange (`verify-auth`)
  before any push; only if it is refused does the job fall back to the API key
  `CLOUDSMITH_API_KEY` stored in that environment, and says so with a warning on the run. The key
  is deleted once a real run shows OIDC working; then the fallback step fails, as it should.
- **The signing key** is Cloudsmith's, generated for the repository; it signs APT's `InRelease` and
  RPM's metadata. Fingerprint **`4D80 2D23 F528 B669 95C6  529D 32B2 97F2 B56D 38CD`**, RSA 3072,
  created 2026-11-23, **no expiry**, no subkeys (read 2026-11-23 with `gpg --show-keys` from the
  key served at `https://dl.cloudsmith.io/public/menkar/menkar-packages/gpg.32B297F2B56D38CD.key`;
  Cloudsmith's web app does not show it). The same key is served at `…/gpg.key` and
  `…/cfg/gpg/gpg.32B297F2B56D38CD.key`. A key that is rotated or given an expiry changes this line
  and every user's keyring; `docs/release-checklist.md` checks `apt update` with no signature
  warning at every release.
- **Its limits**: the free plan gives at least 50 GB stored and **200 GB delivered a month**, across
  the owner's open-source repositories, about 1,900 downloads of a 102 MB package, upgrades
  included. What happens past it is not documented. Reaching it is the trigger to ask Cloudsmith for
  sponsorship or to self-host (`docs/NOT_BUILT_YET.md`, "A self-hosted package repository").
- **What Cloudsmith sees**: every download is logged for the maintainer with its time, user agent,
  IP address and its location. Installing from the repository means apt or dnf contacts
  Cloudsmith; Menkar itself still connects to nothing. The single file from GitHub Releases is the
  way to avoid it.
- **Its URLs name `dl.cloudsmith.io`**: a custom domain is not on the free plan, so leaving
  Cloudsmith means every user changes their source line and key once. The GitHub Releases keep
  every file.
- **The attribution** the free plan requires: README and the site say "Package repository hosting
  is graciously provided by Cloudsmith", linking to cloudsmith.com.

## Installing from the repository

The source of truth for these commands: `README.md` and the site's Install page copy them. They are
the manual steps, not Cloudsmith's `curl … | sudo bash` script: the reader sees each thing added to
their system. The lines are those Cloudsmith serves for this repository
(`…/config.deb.txt?distro=any-distro&codename=any-version`,
`…/cfg/setup/config.rpm.txt?distro=any-distro&codename=any-version`, read 2026-11-23), with the
keyring and the files named after Menkar instead of `menkar-menkar-packages`, and the `.repo` file
keeping only the architecture's section (Menkar ships no `noarch` package and no source package).

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

**The single file**, for a machine that should not contact Cloudsmith: the `.deb` or `.rpm` and
`SHA256SUMS` from `https://github.com/hernancontigiani/menkar/releases/latest`, checked with
`sha256sum --check --ignore-missing SHA256SUMS`, then `sudo apt install ./menkar_*_amd64.deb` or
`sudo dnf install ./menkar-*.x86_64.rpm`. apt installs a file under the home folder as root and
says so with a notice, because its `_apt` user cannot read it there; a copy in `/tmp`, or `sudo
dpkg -i` followed by `sudo apt -f install`, avoids the notice. A single file gets no updates: each
new version is installed the same way.

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
