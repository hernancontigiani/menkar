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
- Packaging: a `.deb` with an AppArmor profile; Windows needs an installer (NSIS/MSI), macOS a
  signed `.dmg`.
- e2e: runs under `xvfb` (`MENKAR_E2E_XVFB`), absent on Windows/macOS.
- Notifications, the dock badge, `gsettings` reads in docs and scripts.

## The proposed approach (to confirm)

1. **Audit and isolate** first: every platform-specific call behind one module per concern with a
   Linux implementation and a stub that fails loudly elsewhere; a code-rules check that forbids
   `/proc`, `setsid`, `'/bin/sh'` and similar outside those modules.
2. **Vitest on Windows**: `npm run ci` runs on a Windows machine — cheap, catches paths and process
   handling.
3. **e2e on Windows**: Playwright drives Electron natively there (no xvfb), on a real desktop —
   ideally a Windows VM so windows never open on the human's own screen; the `MENKAR_E2E_XVFB` guard
   gets a Windows equivalent.
4. **A hand checklist** per platform: install, the launcher, Remote Control from the phone,
   notifications, the shell.

Open, for the human: where Windows runs (a local VM, or a hosted runner as the one exception to
"no hosted CI", decision 1.5).
