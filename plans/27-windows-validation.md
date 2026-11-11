# Plan 27: how Menkar is validated on Windows (and macOS)

> **Status:** stub, written 2026-11-09 with the human; not before the Windows port starts (§2 2.1,
> the shell, is the first decision it needs). Needs `/design-plan` then.
>
> **Exit, when executed:** `docs/platforms.md` (new: what differs per platform and where it lives),
> `docs/toolchain.md` (how the suites run on each); decisions in `plans/00-STATUS.md` §1.

## Known Linux-only pieces (found 2026-11-09, not exhaustive)

- `src/core/tilde.ts`: home prefix compared with `/`; Windows paths are `C:\Users\…`.
- `src/core/remote/live.ts` / `src/main/remote-live.ts`: the agent's pid found through `/proc`.
- `src/core/launch.ts` / `src/main/index.ts`: detaching uses `setsid` semantics; closing agents
  relies on SIGHUP (decision 1.9).
- Terminals start `bash` (§2 2.1: Git Bash, PowerShell or WSL).
- Terminal links (1.53): Claude Code turns OSC 8 hyperlinks on from the environment; Menkar sets
  `FORCE_HYPERLINK=1`. Check on Windows what Claude Code reads there (it also knows `WT_SESSION`)
  and that links still span the rows it breaks, in the shell 2.1 picks. Not investigated yet.
- Packaging: a `.deb` with an AppArmor profile; Windows needs an installer (NSIS/MSI), macOS a
  signed `.dmg`.
- e2e: runs under `xvfb` (`MENKAR_E2E_XVFB`), absent on Windows/macOS.
- Notifications, the dock badge, `gsettings` reads in docs and scripts.

## The goal (the human, 2026-11-09)

Not a Windows CI: `npm run ci` stays a Linux gate. The goal is that **the app works when it is
shared with a developer on Windows who installs it** — once there is a Windows installer to offer.
Validation serves that, before each Windows release, not every change.

## The proposed approach (to confirm when the port starts)

1. **Audit and isolate**: every platform-specific call behind one module per concern, with a Linux
   implementation and a Windows one; a code-rules check (on Linux, in `npm run ci`) that forbids
   `/proc`, `setsid`, `'/bin/sh'` and similar outside those modules, so new Linux-only code cannot
   slip in unnoticed.
2. **Unit tests for the Windows implementations run on Linux** where they are pure (paths with `\`,
   drive letters, `C:\Users\…`), so most of the Windows logic is checked without Windows.
3. **Before a Windows release**: the installer built, installed on a Windows machine or VM, and a
   smoke run there (Playwright drives Electron natively, no xvfb) plus a hand checklist: install,
   the launcher, a Claude session in a terminal, Remote Control, notifications, uninstall.

## Carried over from the predecessor's validation (2026-11-08, Claude Code 2.1.319, Ubuntu only)

Kept here because the predecessor's repository is being deleted. On Linux an Electron spike showed
that xterm.js and `@xterm/headless` read the agent's working / blocked / idle states unchanged, that
Shift+Enter, Ctrl+C, Esc, a 5,000-character bracketed paste, scrollback, `/exit` and resizing
behave, and that Playwright's `_electron.launch` drives the real app reliably. **Nothing was checked
on Windows or macOS.** What it left for them:
- Windows terminals run on ConPTY through node-pty: the same `Terminal` class, a different backend
  to verify (signals: there is no SIGHUP, so 1.9 / 1.48's hang-up needs its Windows equivalent).
- The shell is decision 2.1 (Git Bash recommended, since Claude Code on Windows already needs Git
  for Windows; PowerShell the fallback; WSL the other way).
- Nothing on the agents' side may assume `python3`: the statusline and the hooks must run with what
  Menkar ships (Node or its own binary).
- WebKit is never the engine: Electron's Chromium on every platform, so the UI checks done on Linux
  hold, but the native pieces (dialogs, the trash, `openPath`, drag out, the frameless window's
  snapping) are checked by hand on each platform.
