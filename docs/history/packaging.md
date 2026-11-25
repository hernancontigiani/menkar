# History of `docs/packaging.md`

## Chromium's sandbox

> Replaced 2026-11-20: the AppImage is deferred at 1.0 (the human, 2026-11-19, plan 28's D4), its trigger in `docs/NOT_BUILT_YET.md`. It was:
maintain (decided 2026-11-08). **AppImage first:** it cannot carry a setuid helper or install a
profile, so it needs `--no-sandbox`; it can come later as a second target. **Snap and Flatpak:**
each is a sandbox of its own, with `claude` and `~/.claude` outside it.

## The sandbox package

> Replaced 2026-11-17: the sandbox's icon is variant A, the star on an amber tile (1.166, task 53). It was:
- **Its own icon** (1.166): `build/icons-sandbox/`, a copy of Menkar's until the human picks a
  variant from a mock-up.

## The command in a terminal

> Replaced 2026-11-20: `--version` printed nothing and started the app (task 138); it now prints the package's version and ends, `-v` with it. It was:
- **Stays attached:** `menkar usage …`, `menkar open` with no file (it prints how to use it),
  `--help`, `--version`, `--foreground` / `-f`, and any start whose stdout is not a terminal (the
  launcher, a pipe, Playwright).

## The programs agents run

> Replaced 2026-11-23: Cursor's hook program, `cursor-hook.js`, ships as a fourth (plan 39 P3.3, task 220). It was:
Three programs ship inside app.asar beside the app, each its own `electron.vite.config.ts` entry
Node, `statusline.js` and `mcp-server.js` (Claude Code) and `codex-notify.js` (Codex's `notify`).
