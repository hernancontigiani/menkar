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
- Cursor's agent, the `cursor-agent` command.

[Use Claude Code or Cursor](/menkar/start/agents/) says what each one can do in Menkar.

## Install on Debian or Ubuntu

<!-- plan 28: apt commands -->
<!-- /plan 28 -->

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

<!-- plan 28: rpm commands -->
<!-- /plan 28 -->

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
