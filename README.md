# Menkar

A desktop app for working with several Claude Code (and Cursor) sessions at once: the session list
on the left, the real agent in an embedded terminal on the right, with projects, tabs, split panes,
several windows, usage tracking and file tabs. Electron and TypeScript; Linux first, then Windows
and macOS.

**Status:** in construction. Not usable yet.

Menkar is the multiplatform successor of agent-tablet, itself started from
[Agent Session Manager](https://github.com/r4nd3l/agent-session-manager) by Máté Molnár. It is
written from scratch from agent-tablet's documented behaviour; no code is carried over.

## Development

Node 22 LTS and npm, on Linux (Ubuntu). `npm run ui-check` also needs `xvfb-run` (the `xvfb`
package).

```sh
npm install                          # also rebuilds node-pty for Electron
node node_modules/electron/install.js  # only if npm did not fetch Electron's binary
npm run dev                          # the app, with the renderer served by Vite
npm run ci                           # the gate: Biome, tsc, Vitest and the code and history checks
npm run ui-check                     # builds, then Playwright on the real app under xvfb-run
```

On Ubuntu's desktop, `npm run dev` starts Electron with `--no-sandbox`: AppArmor stops the
development build's `chrome-sandbox`. Runs under `xvfb-run` and the packaged app keep the sandbox.

`npm run ui-check` never opens a window on your display, and the app it starts uses a temporary
`HOME` and XDG directories, never yours. Its screenshots land in `test-results/`.

## License

GPL-3.0-or-later. See `LICENSE`.
