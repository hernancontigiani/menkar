# Cursor probes

These check that a Menkar build and the installed `cursor-agent` still work together the way
Menkar relies on: a Cursor worker of a Claude orchestrator in the orchestration mode. Run them by
hand on a new Cursor version, or on a Menkar build that changes Cursor's support. They are outside
`npm run ci` and outside `npm run ui-check`, whose test folder is `e2e/` (`docs/agent-versions.md`,
"On a new version").

**Each run spends the human's real Cursor requests.** Cursor has no stand-in model (decision
1.213): the probes run the real `cursor-agent` on the human's own Cursor login, with the human's
approval for that run. A full run is several dozen model turns. On the Free plan, the probes of one
month (task 226, 2026-11-24) used up its requests before they finished. Run only the probe you
need, and ask before running any.

## Running them

Extract the build to check, without installing it:

```
mkdir -p /tmp/menkar-build && dpkg-deb -x <menkar-sandbox_….deb> /tmp/menkar-build
```

Then, from the repository's root:

```
MENKAR_E2E_EXECUTABLE=/tmp/menkar-build/opt/Menkar-sandbox/menkar-sandbox \
  scripts/agent-probes/cursor/run.sh [probe]
```

- **One probe:** name its file, such as `waker`.
- **A given `cursor-agent`:** set `CURSOR_BIN` to its path. Otherwise the one at
  `~/.local/bin/cursor-agent` is used.
- **Results:** each check prints `PASS` or `FAIL` with what it saw, and the run's notes go to a
  `menkar-probe-cursor-<random>/` folder (see "What it leaves behind"). A probe's own Playwright
  result passes unless it crashed: the checks are soft, so one run reports every point.

| Probe            | What it checks |
| ---------------- | -------------- |
| `worker.spec.ts` | The two integrations items turned on: in `~/.cursor/hooks.json` and `cli-config.json` only Menkar's part is added, the user's own entries kept. A worker from `start_session`: `--new-session-id`, `--add-dir`, `--plugin-dir`, `--`. The trust prompt read as `blocked`. The team block obeyed (it names itself and its orchestrator). Menkar's tools found by `GetDynamicTools` and run with no card. A skill read by its `SKILL.md`. The hook program's records, with no email in Menkar's files. Esc mid-turn. A message during a turn sent as Cursor's followup; a multi-line one whole. A team update held. `/summarize`. `last_reply`. Usage's tokens. `/new` and `/resume` followed by the tab. Both items off: hooks.json byte-identical, the permissions as the user had them. |
| `waker.spec.ts`  | The waker, with waits on the hook log: a team update held, and handed over by the idle wake (hangup and `--resume` with the text). A draft in the box waited out, nothing typed. `/new` and `/resume` followed by the tab. |
| `alone.spec.ts`  | Without the items: the real "Run this MCP tool?" card read as `blocked`, and the screen kept in the notes. A Cursor orchestrator starting a Claude worker, woken by that worker's messages: one resume per idle wake, the followup while it works. |

## How it stays away from the human's data

- **Folders:** e2e's `launchApp` gives the app a fresh `HOME` and XDG set under `TMPDIR`. `run.sh`
  sets it to `/tmp/menkar-cursor-probe` (mode 700), short enough for Electron's singleton socket.
  Cursor's `~/.cursor`, its `cli-config.json`, its chats and transcripts all land there, never in
  the human's.
- **Credentials:** the human's `~/.config/cursor/auth.json` is copied into the run's own XDG config
  folder, where Cursor looks for it, and removed with the app's root when the app closes. If a root
  outlives a run (a crash, a probe stopped by hand), `run.sh` says so: remove it at once, it holds
  that copy.
- **The agent:** a wrapper on the run's PATH records each `cursor-agent` command line in the run's
  HOME (`cursor-args.txt`) and runs the real one.
- **Network:** only Cursor's own traffic, to Cursor's servers, as anywhere.
- **Processes:** every one ends with the app's close. A probe stopped by hand can leave
  `cursor-agent` processes whose environment names a `menkar-e2e-*` HOME: check
  `/proc/<pid>/environ`, and stop them by PID.

## What it leaves behind

- **`$TMPDIR/menkar-probe-cursor-<random>/`**, one per probe file. It holds:
  - its notes and `PASS`/`FAIL` lines (`<probe>.txt`, `<probe>-results.txt`);
  - the hook log and the command lines it saw;
  - screens and screenshots.
- **`$TMPDIR/menkar-probe-cursor-results/`**: Playwright's traces of a crash.

Nothing there is removed, so a failure can be read. Delete them by hand.
