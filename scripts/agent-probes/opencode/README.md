# OpenCode probes

These check that a Menkar build and the installed `opencode` still work together the way Menkar
relies on. Run them by hand on a new OpenCode version, or on a Menkar build that changes OpenCode's
support. They are outside `npm run ci` and outside `npm run ui-check`, whose test folder is `e2e/`
(`docs/agent-versions.md`, "On a new version").

They drive a packaged build of Menkar with Playwright under `xvfb-run`, using the e2e suite's
`launchApp`. The build runs the real `opencode` found on the PATH, against a stand-in model.

## Running them

Extract the build to check, without installing it:

```
mkdir -p /tmp/menkar-build && dpkg-deb -x <menkar-sandbox_….deb> /tmp/menkar-build
```

Then, from the repository's root:

```
MENKAR_E2E_EXECUTABLE=/tmp/menkar-build/opt/Menkar-sandbox/menkar-sandbox \
  xvfb-run -a env MENKAR_E2E_XVFB=1 \
  npx playwright test -c scripts/agent-probes/opencode/playwright.config.ts
```

- **One probe:** add its file name, such as `alone`.
- **A given `opencode`:** set `OPENCODE_BIN` to its path. Otherwise the first `opencode` on the
  PATH is used.
- **Time:** about two minutes for the three.
- **Results:** Playwright says passed or failed per probe, with the failing line.

| Probe            | What it checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alone.spec.ts`  | A session from New: its title kept, its first prompt drawn running and sent once (`/new` resends nothing). Working, "esc again to interrupt", idle after the second Esc. The permission card and the question card read `blocked`, and `idle` once answered. A subagent keeps its root `working` until the end, with one change. The picker (Ctrl+X L) brings the pane back to the first session. Closing the last tab stops Menkar's `opencode serve`, and so does a SIGKILL of Menkar.                                                                                                                                                             |
| `worker.spec.ts` | An OpenCode worker of a Claude orchestrator (the e2e suite's Claude stand-in). Its first request lists Menkar's tools by name, and its team entry names it and `load_skill`. A role change during a two-step turn reaches the next step as a `<system-update>`, with one execution (rows user, system, idle). A Menkar tool runs with no card. `load_skill` returns a stored skill's text. A wake sent while a permission card is up waits: the card is untouched and the wake runs after the human's answer. A mode-off session in the same folder has no team entry; it does get Menkar's tools, by design (decision 1.141: one mount per folder). |
| `usage.spec.ts`  | Menkar's Usage view gives the cost and tokens of OpenCode's own `session_v2` row. About lists OpenCode's version as plain digits, though Playwright runs the app with `FORCE_COLOR=1`. A second `opencode serve` on the same database runs a turn of the session; when Menkar reopens it, its pane shows the `[menkar] warning` line (D9, decision 1.205).                                                                                                                                                                                                                                                                                           |

Before trusting a change to a probe, see it fail. Each probe failed on the build before task 201's
fixes (0.1.0-491), where the cards did not read as blocked and the version kept its colour codes.

## The stand-in model

`standin.mjs` is an OpenAI-compatible chat endpoint on a free loopback port. It is declared in the
throwaway `opencode.json` as provider `stub`, model `m1`:

- priced at 3 / 15 / 0.3 / 3.75 USD per million tokens;
- `limit.context` 50,000;
- shell calls set to `ask`;
- OpenCode's own `autoupdate` off, because its "Update available" modal takes the keys a probe
  types.

The stand-in answers by keywords in the last user message:

| Keyword              | It answers with                          |
| -------------------- | ---------------------------------------- |
| `CALL:<tool> <json>` | a call to that tool with those arguments |
| `RUNTOOL`            | a `shell` call (a permission card)       |
| `ASKQ`               | a `question` card                        |
| `SUBAGENT`           | a child that takes 4 s                   |
| `SLOW`               | a 20 s wait                              |

It also fills in OpenCode's compaction template. Every answer reports 1,000 prompt tokens, 300 of
them cached, and 10 completion tokens.

The context ring cannot be compared with this stand-in. Menkar reads the limit from OpenCode's
model catalog, and a provider defined only in the user's config is not in it.

## How it stays away from the human's data

- **Folders:** `launchApp` gives the app a fresh `HOME` and XDG set under the system's temporary
  folder, with a PATH of its own. OpenCode's config, database, state and pty folders all land
  there, never in the human's home or `~/.local/share/opencode`.
- **Servers:** the app's `opencode` attaches to Menkar's own `serve --stdio`, never to the user's
  background service. `usage.spec.ts`'s second server runs on the same throwaway folders.
- **Credentials:** none is read or copied. The model is the stand-in on 127.0.0.1.
- **Network:** OpenCode itself may fetch its model catalog from models.opencode.ai, as it does
  anywhere. That is the agent's own traffic, not Menkar's.
- **Processes:** every one ends with the app's close; `alone.spec.ts`'s killed app has its folder
  removed by the probe. A probe stopped by hand can leave `opencode` processes whose command line
  names a `/tmp/menkar-e2e-*` folder; stop them by PID.

## What it leaves behind

- **`/tmp/menkar-probe-opencode-<random>/`**, one per probe file. It holds:
  - the stand-in's request log, `<probe>-model.log`;
  - a probe's notes, `<probe>.txt`;
  - its screenshots.
- **`/tmp/menkar-probe-opencode-results/`**: Playwright's traces of a failure.

Nothing there is removed, so a failure can be read; delete them by hand. The app's own
`/tmp/menkar-e2e-*` folder is removed when the app closes.
