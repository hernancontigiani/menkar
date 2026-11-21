# Claude Code probes

Checks that the installed `claude` still behaves the way Menkar relies on. They are run by hand on a
new Claude Code version, outside `npm run ci` (`docs/agent-versions.md`, "On a new version").

```
node --experimental-strip-types scripts/agent-probes/claude/all.mjs
```

Or one probe at a time: `node --experimental-strip-types scripts/agent-probes/claude/<probe>.mjs`.
Each prints `PASS` or `FAIL` per check with the run's folder, and exits 1 when one failed. `all.mjs`
takes about four minutes.

| Probe             | What it checks                                                                                                                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permission.mjs`  | Three cards are read as `blocked` by main's `detectState` at every burst end: the Bash card (manual mode), auto mode's confirmation card (the classifier answering "block" three times), and auto mode's card before a read outside the working directories                       |
| `add-dir.mjs`     | Whether `--add-dir` shows the trust dialog (recorded, not judged), and that `permissions.additionalDirectories` in `--settings` grants the folder with no dialog                                                                                                                  |
| `team-block.mjs`  | `--append-system-prompt-file` text is in the first request's system prompt; a missing file stops Claude Code before any request                                                                                                                                                   |
| `wake.mjs`        | A one-line post to the session's messaging socket wakes it into a new turn, and its transcript records a peer user turn from `menkar`                                                                                                                                             |
| `prompt-hook.mjs` | The orchestrator's prompt hook, declared as `promptSubmitHooks` writes it and run by `statusline.ts` over an inbox for pane `p1`: the model gets the inbox's lines on each prompt, the transcript records them as `hook_additional_context`, the screen shows nothing             |
| `peer-turn.mjs`   | A resumed session whose first turn is a `[Menkar]` post: its first request lists no plugin skill (a peer turn gets no attachments), the Skill tool still finds the skill by name, and the listing comes after the first tool call; the same resume with a prompt lists it at once |

## How it stays away from the human's data

- Every run makes its own throwaway `HOME` under the system's temporary folder and refuses to start
  if it is the real home. Claude Code writes only there.
- The environment is built from nothing: no variable of the session that runs the probe, no
  `XDG_RUNTIME_DIR`, so the messaging socket is bound under `/tmp`, and `wake.mjs` refuses any
  other.
- No credential is ever copied in. The API key is a fake one the throwaway `.claude.json` marks as
  approved; every model request goes to a stand-in API on 127.0.0.1 inside the probe.
- Each `claude` runs under `script` (util-linux) in its own process group, which is killed at the
  end.

To see a check fail before trusting it, point `PROBE_DETECT` at a module whose `detectState` returns
`'idle'`; `permission.mjs` then fails.

## What it leaves behind

One folder per run, `/tmp/menkar-probe-claude-<probe>-<random>/`. Each holds:

- the throwaway `home/` and `work/`;
- `pty.raw`, the exact bytes the terminal received;
- for `permission.mjs`, `card.txt`, the screen text judged on the card.

Nothing is removed, so a failure can be read. Delete them by hand.
