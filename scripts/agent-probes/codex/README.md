# Codex probes

Tools for checking that the installed `codex` still behaves the way Menkar relies on. They are run by
hand on a new Codex version, outside `npm run ci` (`docs/agent-versions.md`, "On a new version").

## `responses-standin.mjs`: a stand-in for the Responses API

Codex sends every model request to a stand-in on 127.0.0.1 instead of OpenAI. That lets a probe or
an end-to-end run drive the real `codex` TUI with no login and no network, and script what the
"model" does: call Menkar's tools, run a command, stream a reply, or report enough tokens to force a
compaction.

```
node scripts/agent-probes/codex/responses-standin.mjs --port 18800 --log /tmp/<run>/api-log --script /tmp/<run>/script.json
```

Point a throwaway `CODEX_HOME` at it, in its `config.toml`:

```toml
model = "gpt-6.1-sol"
model_provider = "stub"

[model_providers.stub]
name = "stub"
base_url = "http://127.0.0.1:18800/v1"
wire_api = "responses"
env_key = "STUB_KEY"

[projects."/tmp/<run>/work"]
trust_level = "trusted"
```

Then start `codex` with `CODEX_HOME=/tmp/<run>/home STUB_KEY=x`. `STUB_KEY` can hold any value.

- **The model:** use a real catalog slug such as `gpt-6.1-sol`, so Codex applies that model's real
  capabilities (code mode, deferred MCP tools). The requests still go to the stand-in. A slug Codex
  does not know gets plain function tools instead.
- **Trust:** the `projects` entry skips the folder-trust prompt.
- **Typing:** when a probe types into the TUI, it sends the text, waits about a second, then sends
  Enter. Codex treats an Enter that comes right after the text as part of a paste.

### The script

The script is JSON, re-read on every request, so a probe can rewrite it between turns:

```json
{
  "rules": [
    {
      "match": "build the thing",
      "steps": [
        {
          "call": {
            "namespace": "mcp__menkar",
            "name": "task_review",
            "arguments": { "number": 1 }
          }
        },
        { "shell": "cat /abs/path/SKILL.md", "delayMs": 800 },
        { "text": "Done.", "stream": { "chunks": 10, "intervalMs": 200 } }
      ]
    }
  ],
  "default": "ok",
  "title": "Generated title",
  "titleDelayMs": 0,
  "usageTotal": 12
}
```

- **Matching:** the first rule whose `match` occurs in the turn's last user message answers that
  turn. Step 0 answers the user message, and step _k_ answers the _k_-th tool output after it.
  Past the last step, or with no rule matching, the answer is `default`.
- **Step kinds:**
  - `call` is a direct tool call. Use it for Menkar's tools when the session runs with
    `features.code_mode.direct_only_tool_namespaces=["mcp__menkar"]`, or on a model outside the
    catalog.
  - `exec` is the code-mode JavaScript tool. It reaches MCP tools only when they are not direct.
  - `shell` runs `exec_command`.
  - `text` is the final reply.
- **Timing, on any step:**
  - `delayMs` waits before any byte;
  - `createdDelayMs` waits after `response.created`;
  - `stream` sends a text reply as deltas.
- **Codex's hidden title request** is answered with `title` (with `null`, no title), after
  `titleDelayMs`.
- **Compactions:** `usageTotal` is the token count reported for each reply. With Codex started with
  `-c model_auto_compact_token_limit=50000`, a value of 200000 forces an automatic compaction. The
  compaction request itself gets a fixed summary.

## How it stays away from the human's data

- It writes only its log folder, and refuses to start unless that folder is under the system's
  temporary folder.
- It listens on 127.0.0.1 only and makes no connection of its own.
- It needs no credential. A probe that uses it starts `codex` with a throwaway `CODEX_HOME` under
  `/tmp`, never `~/.codex`.
- Each Codex process is stopped by its PID, after checking that `/proc/<pid>/environ` names that
  `CODEX_HOME`.

## What it leaves behind

In the log folder:

- `NNN.json`, the exact body of each request, in order;
- `requests.jsonl`, one line per request: `{n, at, model, kind, step, user}`.

`kind` is `title`, `compaction`, `call <name>`, `exec`, `shell` or `text`.

Nothing is removed, so a run can be read afterwards. Delete the folder by hand.

The throwaway `CODEX_HOME` also gets Codex's own files: rollouts, `session_index.jsonl`,
`*.sqlite`. A TUI started without `--disable plugins` also clones the plugin marketplace into
`.tmp/plugins`, which needs the network. Delete that home by hand too.
