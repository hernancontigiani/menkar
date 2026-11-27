---
title: Install Menkar
description: Install Menkar on Linux from its .deb or .rpm package, and the agent it runs.
sidebar:
  order: 1
---

Menkar runs on Linux, on 64-bit x86 (amd64). Each release has two packages: a `.deb` for Debian,
Ubuntu and their derivatives, and an `.rpm` for Fedora and other RPM systems. There is no Windows
version.

## Install an agent first

Menkar runs the coding agent you already use; it does not bring one. Install and sign in to at
least one of them, so its command is on your `PATH`:

- Claude Code, the `claude` command, 2.1.267 or later;
- Codex, the `codex` command;
- Cursor's agent, the `cursor-agent` command;
- OpenCode, the `opencode` command.

[Use Claude Code, Codex, Cursor or OpenCode](/menkar/start/agents/) says what each one can do in Menkar.

## Install on Debian or Ubuntu

1. Download the repository's signing key and show it:

   ```sh
   curl -fsSL -o /tmp/menkar.key https://dl.cloudsmith.io/public/menkar/menkar-packages/gpg.32B297F2B56D38CD.key
   gpg --show-keys /tmp/menkar.key
   ```

   Go on only if it prints the fingerprint `4D80 2D23 F528 B669 95C6  529D 32B2 97F2 B56D 38CD`.

2. Add the key and the repository, then install:

   ```sh
   sudo gpg --dearmor --yes -o /usr/share/keyrings/menkar-archive-keyring.gpg /tmp/menkar.key
   echo "deb [signed-by=/usr/share/keyrings/menkar-archive-keyring.gpg] https://dl.cloudsmith.io/public/menkar/menkar-packages/deb/any-distro any-version main" | sudo tee /etc/apt/sources.list.d/menkar.list
   sudo apt update
   sudo apt install menkar
   ```

`sudo apt upgrade` then brings each new version. Package repository hosting is graciously provided
by [Cloudsmith](https://cloudsmith.com), which logs the address of each download. To keep your
machine from contacting it, install the package from the latest release instead:

1. Download `menkar_<version>_amd64.deb` and `SHA256SUMS` from the
   [latest release](https://github.com/hernancontigiani/menkar/releases/latest) into one folder.
2. In that folder, check the download and install it:

   ```sh
   sha256sum --check --ignore-missing SHA256SUMS
   sudo apt install ./menkar_*_amd64.deb
   ```

The package also installs an AppArmor profile, `/etc/apparmor.d/menkar`, which lets Menkar run
with Chromium's sandbox on Ubuntu 24.04 and later.

## Install on Fedora

Add the repository and install, so `sudo dnf upgrade` brings each new version:

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

If dnf asks to import a key, accept it only if its fingerprint is `4D80 2D23 F528 B669 95C6  529D 32B2 97F2 B56D 38CD`. dnf downloads from
Cloudsmith, which logs the address of each download. To keep your machine from contacting it,
install the package from the latest release instead:

1. Download `menkar-<version>.x86_64.rpm` and `SHA256SUMS` from the
   [latest release](https://github.com/hernancontigiani/menkar/releases/latest) into one folder.
2. In that folder, check the download and install it:

   ```sh
   sha256sum --check --ignore-missing SHA256SUMS
   sudo dnf install ./menkar-*.x86_64.rpm
   ```

## Start Menkar

Open **Menkar** from your applications, or run it from a terminal:

```sh
menkar
```

It gives the terminal back at once and keeps running when you close it. To keep it attached and
watch its log, run `menkar --foreground`. To see which build you have:

```sh
menkar --version
```

Then [open your first sessions](/menkar/start/first-sessions/).

## Update or remove Menkar

To update, install the newer package the same way: it replaces the one you have.

To remove it, run the line for your system. Your projects, settings and usage history stay in your
home folder, and so do your agents' sessions.

```sh
sudo apt remove menkar
```

```sh
sudo dnf remove menkar
```
