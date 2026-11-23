# Research: the OpenCode CLI in Menkar (decisions 1.127, 1.133)

Date: 2026-11-14. Written by `opencode` (the future OpenCode consultant) for `set`. Research before
any plan: nothing here is decided. Its sections mirror `plans/ideas/research/codex.md`.

## Sources and how each fact is marked

- **OpenCode source**: github.com/sst/opencode, shallow clone of tag `v2.3.0` at `a6b15d3`
  (2026-11-13 07:33 UTC). Paths below are relative to `packages/` unless they say otherwise. Two
  read-only subagents read parts of it; every fact below that changes the picture was re-read by
  me at the cited line.
- **Installed binary**: `opencode v2.3.0` at `~/.opencode/bin/opencode` (measured,
  `opencode --version`). Every run used a throwaway home: `HOME`, `XDG_CONFIG_HOME`,
  `XDG_DATA_HOME`, `XDG_CACHE_HOME` and `XDG_STATE_HOME` in my scratchpad, `XDG_RUNTIME_DIR`
  unset. The human's `~/.config/opencode`, `~/.local/share/opencode` and `~/.local/state/opencode`
  were listed, never read past a file name, never written.
- **Untouched and still running** (seen with `ps`/`ss`, read only):
  - OpenCode Desktop's background service, `~/.config/ai.opencode.desktop/cli/2.3.0-x64/opencode-cli
    serve --service`, PID 912105, listening on 127.0.0.1:49374. Desktop's own processes (PID
    911720 and children) are alive although `/opt/OpenCode` was removed: uninstalling did not stop
    them.
  - The human's `opencode` TUI in `~/Downloads`, PID 919313, **a client of that service** (its
    only loopback connection goes to :49374; it holds no file descriptor on `opencode.db`).
- **Model turns ran only against a local stand-in API** (the human's choice, 2026-11-14, through
  `set`): an OpenAI-compatible stub on 127.0.0.1 declared per run as a custom provider. No
  OpenCode Zen model, no provider key, nothing left the machine. See "Turns against a stand-in
  API" below.
- **The human's service was restarted during the probes, not by them.** Their log shows the
  service PID 912105 receiving SIGTERM at 13:57:44 UTC ("shutdown started"), and a new
  `serve --service` (PID 1164718, parent systemd --user after detaching) starting at 13:57:50.
  OpenCode Desktop's processes and the TUI PID 919313 were gone afterwards. Every command of mine
  ran through a wrapper that sets the throwaway XDG folders; none was `serve --service` in the
  human's home. Only the start and stop lines of their `opencode.log` were read, to establish
  this.
- **agent-deck** (github.com/asheshgoplani/agent-deck, MIT, `9fa44b5`, 2026-11-14), read as
  documentation, never copied, never run.
- **Markers**: **read** means read in source, with the source. **measured** means run, with the
  command and version. **inferred** means not verified. Every *inferred* fact is a probe to run
  before a plan relies on it.

## 0. What changes the picture

1. **OpenCode has an official inbound channel that needs no typing: `POST /api/session/<id>/prompt`
   on the server the TUI runs against** (§2). The message goes into a durable per-session inbox.
   Measured: an idle TUI ran it as a turn about 50 ms after the post; behind a pending permission
   it waited 25 s with the card untouched and ran right after the approval; a half-typed draft
   stayed in the composer. That gives 2.21 the same answer as `codex queue`, and faster.
2. **The TUI is only a client. All work runs in a server**, and by default that is **the user's
   one shared background service on a fixed port, 49374** (§1.6). Per-run configuration
   (`OPENCODE_CONFIG_CONTENT`, the counterpart of `--settings`) is read **by the server process at
   its start**, so a TUI's environment cannot give its session Menkar's MCP server while the TUI
   uses the shared service. **Menkar would run its own `opencode serve`** with its own
   environment, and start every OpenCode TUI with `--server <url>` (measured).
3. **One server serves many sessions, so a pane cannot be named by an environment variable.**
   The MCP server inherits the *server's* whole environment (measured), not the pane's. Instead,
   OpenCode stamps **every MCP tool call with `_meta["ai.opencode/sessionID"]`** (measured), which
   Menkar maps to its pane. And by default **MCP tools reach the model only through "Code Mode"**
   (one `execute` tool), not as tools of their own; `codemode: false` on the server entry gives
   them back (measured).
4. **OpenCode reads `AGENTS.md` and never `CLAUDE.md`** (read). This repository has only
   `CLAUDE.md`, so an OpenCode session here would start with none of its rules.
5. **Turn ends and busy state come from the server's event stream** (`session.execution.*`, §1.3),
   and Menkar can **choose the session id and its title at creation** through the API (measured).
   Little has to be read from the screen.
6. **agent-deck** creates OpenCode 2.x sessions through `opencode api session.create`, reads
   state from the service's event stream, and has a "queue" through `session.prompt`; but it
   **types for its default send and writes the user's `opencode.json` for MCP** (§6). Neither of
   those is open to Menkar.

## Measured on opencode v2.3.0 (2026-11-14, a throwaway home, no login, no model turn)

Setup: the throwaway home above; a scratch git repository (`git init`, no commits); private tmux
servers (`tmux -L ocprobe*`) for the TUI; my own `opencode serve --hostname 127.0.0.1 --port 47901`
(PIDs 1011874, then 1085814), stopped by PID after checking `/proc/<pid>/cmdline` and that its
environment named my scratchpad.

1. **Models without a login** (`opencode models --standalone`): 12 models of OpenCode's own
   provider, OpenCode Zen: `opencode/big-pickle`, `beam-free`, `deepseek-v4.1-flash-free`,
   `flint-40b-free`, `glm-5.3-flash-free`, `iceman-free`, `inkling-2-small-free`,
   `longcat-2.5-free`, `mimo-v2.6-flash-free`, `minimax-m3.1-flash-free`,
   `nemotron-3.5-lightning-free`, `nemotron-3.5-super-vl-free`. `auth list`: "No authenticated
   integrations". The TUI's default is "Big Pickle" (its footer: `Build · Big Pickle OpenCode`).
   Any turn would go to OpenCode's servers unless a provider is configured.
2. **Files written** by `--help`, `debug paths`, `models` and `auth list`: only
   `<data>/opencode/opencode.db` (11.9 MB, created with the full schema) and
   `<data>/opencode/log/opencode.log`. `debug paths` also names `tmp = /tmp/opencode`, **shared by
   every home** (not created by these runs).
3. **A second home cannot start its own background service while the human's runs.** The TUI with
   no flag printed "Starting background server..." then "Error: Managed service port 49374 on
   127.0.0.1 is already in use by PID 912105 (…opencode-cli serve --service). Configure another
   port with `opencode service set port <port>` and start the service again." and exited. It
   retried for about 15 s. The human's service was only detected, not contacted.
4. **`--standalone`** spawned a child `opencode serve --stdio --port 0`, listening on a random
   loopback port (35143) with a random `OPENCODE_PASSWORD` in the child's environment; `/api/info`
   without it answered 401. The child inherited the TUI's environment (my `MENKAR_PANE` was in its
   `/proc/<pid>/environ`). One earlier `--standalone` start failed with "Server exited
   unexpectedly" and nothing in the log; the next one worked.
5. **`opencode serve`** prints its URL and a random password (`server password …`) unless
   `OPENCODE_PASSWORD` is set, which it then uses (the second run, password `probepass`). Every
   route needs HTTP Basic `opencode:<password>` (401 without). `/openapi.json` lists about 150
   routes under `/api`.
6. **Sessions through the API** (`curl` against my server):
   - `POST /api/session {title, location:{directory}}` created `ses_e25ae61acffeUjDFncARK0vLHt`.
   - `POST /api/session {id:"ses_menkarprobe0002", title:"menkar-t9", location, permissions:[…]}`
     created a session **with the id and title Menkar chose**, and the permission rules.
   - `PATCH /api/session/<id> {title}` renamed it; `opencode session list --server …` and
     `opencode api session.list --server …` (with `OPENCODE_PASSWORD`) listed it.
7. **A queued message, without a turn:** `POST /api/session/<id>/prompt {text, delivery:"queue",
   resume:false}` answered `{id:"msg_…", type:"user", payload:{text}, delivery:"queue"}`;
   `GET …/inbox` listed it; `GET …/message` stayed empty; `DELETE …/inbox/<msg id>` removed it.
8. **A TUI attached with `--server http://127.0.0.1:47901 -s <id>`** (password in
   `OPENCODE_PASSWORD`):
   - an API rename showed in the TUI at once;
   - an API-queued message showed above the composer as "`1 queued · [Menkar] probe two: queued,
     resume false`", and the session's tab showed a Braille spinner (`⠧`) while it waited;
   - cancelling it through the API cleared both. No turn ran (`GET …/message` empty,
     `GET /api/session/active` `{}`).
   - The TUI keeps tabs of the sessions it opened (`renamed-while-attached   menkar-t9   +`).
9. **`-s <id>` with an id that does not exist** opened an empty session; `GET /api/session/<id>`
   answered `SessionNotFoundError` until a first prompt (none was sent). Creating it first through
   the API (item 6) makes `-s` open it.
10. **MCP from `OPENCODE_CONFIG_CONTENT` on the server** (`{"mcp":{"menkar":{"type":"local",
    "command":[node, stub, log], "environment":{"FROM_CONFIG":"cfg-pane"}}}}`, the v1 form):
    - it loaded with no prompt; the attached TUI showed "`⊙ 1 MCP /mcps`";
    - the stub's environment was **the server's whole environment** plus `FROM_CONFIG`:
      `MENKAR_PANE` was the server's (`serve-env-pane`), and it also held **`OPENCODE_PASSWORD`
      and `OPENCODE_CONFIG_CONTENT`**, and every variable of the shell that started the server
      (Claude Code's own among them, since I started it from one);
    - the handshake was `initialize` (protocol `2025-11-25`, client `opencode 2.3.0`),
      `notifications/initialized`, `tools/list`. Connections are per location (folder): it
      started when the TUI opened a session there.
11. **The database** (`opencode.db`, read with Python's `sqlite3` in `mode=ro`): `journal_mode`
    WAL; 59 migrations; tables `session_v2`, `session_message`, `session_part`, `session_inbox`,
    `event`, `instruction_entry`, `project`, `permission`, … (§1.2). The probe session's row had
    `slug` `curious-wolf`, `version` `2.3.0`, `title` as set, `project_id` `global` (a repository
    with no commit).

## Turns against a stand-in API (2026-11-14, same home, the human's choice)

Setup:
- **The stub** (`stub/api.mjs` in my scratchpad, port 47911, PID 1217652): OpenAI chat
  completions with streaming. It answers "ack N: <the last user text>" after 1.5 s (20 s when
  the text has `SLOW`), calls the `bash` tool with `touch b.txt` when the text has `RUNTOOL`, and
  calls Menkar's stub tool when it has `CALLMENKAR`. It logs every request body.
- **My server** (PIDs 1225324, then 1309882) with `OPENCODE_CONFIG_CONTENT` = `{"provider":{"stub":
  {"npm":"@ai-sdk/openai-compatible","options":{"baseURL":"http://127.0.0.1:47911/v1",…},
  "models":{"m1":{…}}}}, "model":"stub/m1", "small_model":"stub/m1", "mcp":{"menkar":{"type":
  "local","command":[node, mcp stub],"codemode":false}}, "permission":{"bash":"ask",
  "menkar_*":"allow"}, "skills":{"paths":[<folder>]}, "instructions":[<file>]}` (v1 forms,
  accepted).
- **The TUI** in `tmux -L octurn`: `opencode --server http://127.0.0.1:47901 -s ses_menkarturn0001
  --prompt '…' <repo>`, on a session created first through the API with that id and the title
  `menkar-turns`.
- **The event stream:** `curl -N /api/event`. Everything was stopped by PID afterwards; the stub
  log, the event log and the throwaway home stay in my scratchpad.

12. **`--prompt` on a created session** ran at once as the first turn (screen: "Switched agent to
    Build", "Switched model to m1", the prompt, "ack 2: first prompt from --prompt", "Build · m1 ·
    1.6s · 923.1 tok/s · 1.5s ttft"). **The title stayed `menkar-turns`**: no title was generated
    for a titled session. The footer shows the context as "`1.0K (1%)`".
13. **Waking an idle session:** `POST …/prompt {text:"[Menkar] wake probe: idle session",
    delivery:"queue"}` at 14:00:46.851 UTC; the stub received the turn at 14:00:46.903. The TUI
    showed it as an ordinary user message, then the reply. Events: `session.execution.started`,
    then `.succeeded`.
14. **A pending permission:**
    - `RUNTOOL` raised "`△ Permission required`", "`$ touch b.txt`", "`Allow once   Always allow
      Reject`". `GET /api/permission/request` listed it as `action: "shell"`, `resources:
      ["touch b.txt"]`, `save: ["touch *"]`.
    - A queued message posted at 14:01:06: **25 s later the card was untouched**, `b.txt` absent,
      the message still in the inbox.
    - After Enter in my probe TUI (Allow once) at 14:01:37.18, the tool ran, the model's next step
      came at 14:01:37.41, and **the queued message ran as the next turn at 14:01:38.99**.
15. **A half-typed draft** ("half typed draft", no Enter): a queued message ran as its own turn,
    and **the draft stayed in the composer, unsent**.
16. **`steer` against `queue` during a turn** (a `SLOW` turn that also asked a permission):
    - both showed at once: the steer in the transcript as a pending user message, the queue as
      "`1 queued · [Menkar] queue during a turn`";
    - after the approval, **the steer reached the model in the same turn**, right after the tool
      result; **the queue ran after that step ended**;
    - all three were **one execution**: one `session.execution.succeeded` and **one `idle`
      message** for the `RUNTOOL` turn, the steer and the queued message together.
17. **Busy screen:** "`⬝⬝⬝⬝⬝⬝⬝⬝ esc interrupt`" in the footer row; during a tool, "`Press ctrl+b to
    move running work to the background`". While busy, `session_v2.time_busy` (1794664983388) was
    later than `time_idle` (1794664966659, outcome `succeeded`).
18. **Menkar's MCP:**
    - With Code Mode on (the default), the model's tool list was `edit, glob, grep, question,
      read, shell, skill, subagent, webfetch, websearch, write, execute`: no MCP tool by name, and
      a direct call to `menkar_ping_menkar` failed with "No tool named … is currently available".
    - With `codemode: false`, the call ran **with no approval card** under
      `permission: {"menkar_*":"allow"}`, and the MCP server received
      `{"method":"tools/call","params":{"name":"ping_menkar","arguments":{},"_meta":
      {"ai.opencode/sessionID":"ses_menkarturn0001","progressToken":2}}}`.
    - Without the `allow` rule it was not tried.
19. **Skills and instructions per run reached the model.** The system message listed the skill
    from Menkar's folder inside `<available_skills>` (`<id>menkar-probe</id>`, its description),
    beside OpenCode's built-in skills, and carried "`Instructions from: <file>`" with the file's
    text. The `skill` tool takes `{id}`.
20. **The database after the turns** (read only):
    - `session_v2`: `title` `menkar-turns`, `time_busy`, `time_idle`, `idle_outcome` `succeeded`,
      `tokens_input` 13104, `tokens_output` 234, `cost` 0 (the stub declares no price).
    - `session_message` rows `user`, `assistant`, `idle`. Each `assistant` row had `time
      {created, firstToken, streamed, completed}`, `content` with `text` or `tool` parts, `finish`,
      `cost` and `tokens`.
    - `session_part` was **empty**: parts were inline.
    - The `bash` call was stored as `name: "bash"` with `executed: false` and a result telling the
      model "There is no "bash" tool, so this ran as "shell"". The permission's action is `shell`.
21. **Event types seen:** `session.execution.started/succeeded`, `session.inbox.enqueued/delivered`,
    `session.step.started/streamed/ended`, `session.text.*`, `session.tool.*`,
    `session.usage.updated`, `permission.asked/replied`, `shell.created/exited`. A turn's end:
    `{"type":"session.execution.succeeded","data":{"sessionID":…},"durable":{"seq":99,…}}`.

## Two servers on one session, and `/new` (2026-11-14, second run, same home and stub)

Asked by `set` after `agents-compared.md`. Setup: the stand-in API again (PID 1423789); **two
servers on the same throwaway home** — "Menkar's" `opencode serve --port 47901` (PID 1423790) and a
second one, standing for the human's service, `--port 47902` (PID 1423791) — both with the same
`OPENCODE_CONFIG_CONTENT`, no `MENKAR_PANE` in their environment; an event listener on each; TUIs
in `tmux -L ocdual`. Everything stopped by PID afterwards. opencode v2.3.0.

22. **Two servers start and share one `opencode.db` without complaint**: no error or lock in
    either log. A session created through 47901 (`ses_twoservers0001`) was readable at once
    through 47902's API.
23. **Each server and its TUI see only their own live activity.** A post to 47901 ran there; the
    TUI attached to 47902 on the same session showed nothing, though 47902's
    `GET …/message` listed the new rows (it reads the database). Each event stream carried only its
    own server's `session.execution.*`.
24. **Two turns ran at once on one session.** A `SLOW` turn ran on 47901 (posted 14:17:32.667);
    a message posted to 47902 with `delivery:"queue"` at 14:17:35.692 **did not wait**: 47902's
    `GET /api/session/active` was `{}` while 47901's said `running`, and 47902 sent its own model
    request at 14:17:35.729. That request held 47901's in-flight user message with no reply yet,
    then 47902's. 47902 answered and wrote its `idle` at 14:17:37; 47901's reply came at 14:17:52
    and wrote a second `idle`.
25. **No corruption, but an interleaved history:**
    - `PRAGMA integrity_check` `ok`; the inbox empty; no error in either server's log;
    - rows by `seq`: user "SLOW turn on A" (14), user "queue on B" (17), B's assistant (18), idle
      (24), **A's assistant (25, `time_created` earlier than 17)**, idle (31);
    - `session_v2.time_busy` held 47902's start: the busy columns are last-writer-wins;
    - the next turn on 47901 sent the model the whole merged history in `seq` order (both
      replies, A's after B's), so the model saw B's exchange, but **47901's TUI never showed it**,
      and 47902's TUI never showed A's.
26. **`/new` in a TUI makes no session until the first prompt** (only `session.viewed`). The first
    prompt emitted `session.created` with `{sessionID: "ses_e25932e68ffept3ujYBXML1GK6", slug,
    location, agent, model}`, then `session.renamed` (the generated title, "stub title"), and
    the turn's events.
27. **The new session's MCP call carried its new id**: `"_meta":{"ai.opencode/sessionID":
    "ses_e25932e68ffept3ujYBXML1GK6"}`.
28. **Nothing names the TUI that made it.** `session.created` and `session.viewed` (`{sessionID,
    idle}`) carry no client. The TUI's environment (`MENKAR_PANE=pane-A`) is sent to the server
    with `PUT /api/session/<id>/environment` but kept **in memory only** (read,
    `core/src/session/environment.ts:18-28`): it was found nowhere in the database or the events.
    The only headers clients send are `x-opencode-directory` and `x-opencode-ticket` (read).
29. **A per-pane proxy binds it.** A 20-line Node HTTP proxy on port 47921 forwarding to 47901,
    with a TUI started as `--server http://127.0.0.1:47921`: the TUI worked through it, event
    stream included. The proxy saw `POST /api/session` (the create), then
    `POST /api/session/ses_e259297acffes88RP16CehOgLM/view`, `…/model` and `…/prompt` — the id
    of the session that pane shows, at the moment it shows it. The TUI also polls the sessions of
    its other tabs (`GET /api/session/<id>/message`, `…/inbox`), so a binding reads `/view` and
    `/prompt`, not every path.
30. **Memory:** each `opencode serve` had about 270 MB resident (`VmRSS` 283264 kB and 267328 kB)
    after a few turns; a server per pane would cost that per OpenCode tab.
31. **The TUI's tabs are shared by every TUI of the user.** They live in
    `$XDG_STATE_HOME/opencode/latest/tui/tabs.json`, per folder: a TUI in this repository showed
    tabs for the sessions of my earlier probes, made by other TUIs and other servers. So a
    Menkar-started TUI lists the human's own OpenCode sessions in that folder as tabs, and the
    human's own TUI lists Menkar's (inferred: same file when both use the human's
    `XDG_STATE_HOME`). One click in either opens a session the other is running.

## What Menkar's MCP server costs per request, and `list_changed` (2026-11-14, third run)

Asked by `set` for plan 38's review. Same throwaway home and stand-in API (PID 1653641), opencode
v2.3.0, one fresh `opencode serve` per configuration (PIDs 1653642, 1654355, 1655127), each
stopped by PID.

- **The real tool list:** `out/main/mcp-server.js` from the tree (built 2026-11-14 11:25), run once
  under plain `node` with `MENKAR_PANE=probe-pane` and throwaway `HOME`/XDG folders, fed
  `initialize`, `notifications/initialized`, `tools/list` on stdin. It answered **18 tools**
  (`renew` … `resume_session`), **8,847 bytes** of compact JSON; it wrote no file. Plain `node`
  instead of Electron under `ELECTRON_RUN_AS_NODE` is enough for a listing (the server imports
  nothing from Electron).
- **The server in the probes:** a replay stub (`stub/replay.mjs`) answering that exact list,
  declaring `tools.listChanged`. After its first `tools/call` it added a tool `probe_added` and sent
  `notifications/tools/list_changed`.
- **Three configurations,** the same `OPENCODE_CONFIG_CONTENT` otherwise (the stub provider, the
  skills folder, `permission`): no Menkar MCP; Menkar's with `codemode:false`; Menkar's with Code
  Mode on (the default). One session each, a one-word first prompt.

32. **The first model request's body** (compact JSON, bytes):

    | Configuration | Body | Tools | Tool definitions | System prompt (chars) |
    |---|---|---|---|---|
    | No Menkar MCP | 22,872 | 12 | 13,553 | 8,911 |
    | Menkar, `codemode:false` | 32,654 (**+9,782**) | 30 (+18 `menkar_*`) | 23,335 (`menkar_*`: 9,783) | 8,911 |
    | Menkar, Code Mode (default) | 26,637 (**+3,765**) | 12 | 13,553 | 12,593 (+3,682) |

    - With `codemode:false`, **every request grows by the 18 tools' definitions, ~9.8 KB**; it was
      the same in every later request of that session.
    - With Code Mode the tools stay out of the tool list; the system prompt gains a "`# Code Mode`"
      section ("The tools listed below, and `search`, cannot be called directly: they only work as
      JavaScript inside the `execute` tool… The catalog is partial") with typed signatures, +3.7
      KB. The model must then write `await tools.<ns>.<tool>(…)` inside `execute`.
33. **In tokens, roughly:** ~**2,400–2,800 tokens per request** for `codemode:false` (9,782 bytes
    at 3.5–4 bytes per token, the usual range for English and JSON schema text; no tokenizer was
    run, nothing left the machine), and ~900–1,100 with Code Mode. The definitions sit at the
    start of the request, so a provider with prompt caching would bill them as cached reads after
    the first request (inferred; depends on the provider OpenCode talks to).
34. **`notifications/tools/list_changed` is honoured.** The stub sent it at 14:43:39.369;
    OpenCode asked `tools/list` again at 14:43:39.380 (11 ms), and **the very next model request
    (the step after the call) already listed `menkar_probe_added`** (31 tools, +164 bytes).

## Version and orphans (2026-11-15, for plan 39)

Asked by `menkar-t13`. Throwaway home, opencode v2.3.0, every process mine and stopped by PID.

35. **The version, three ways:** `opencode --version` prints `opencode v2.3.0`; a running server's
    `GET /api/info` answers `{"version":"2.3.0","pid":…,"urls":[…],…}`; and `GET /openapi.json`
    lists each route, so `/api/experimental/session/{sessionID}/instructions/entries/{key}` can be
    checked by presence rather than by version number (all m).
36. **`opencode serve` outlives its parent.** A Node parent spawned `opencode serve --hostname
    127.0.0.1 --port <p>`, once with stdin piped and once ignored, and was killed with SIGKILL: both
    servers were reparented to the user's systemd and **still answered `/api/info` 25 s later**.
37. **`opencode serve --stdio --port <p>` dies with it.** Spawned with stdin piped and
    `OPENCODE_PASSWORD` in its environment, it listened on the given port with that password, printed
    `{"url":"http://127.0.0.1:47933"}` on stdout, and **was gone within 5 s of its parent's
    SIGKILL** (stdin closed; read, `cli/src/services/standalone.ts:41-80`). In stdio mode it also
    deletes `OPENCODE_PASSWORD` from its own environment before starting tools and MCP servers
    (read, `cli/src/server-process.ts:87-90`), which closes the leak of item 10. So Menkar's server
    is best run as `serve --stdio`, with Menkar's port and password.

## What a stand-in imitates (2026-11-21, for plan 39's P2.1)

Asked by `menkar-t177`. opencode v2.3.0 (`opencode --version`), a fresh throwaway home (the
scratchpad had been cleared again), the stand-in API, a Node parent holding `serve --stdio`'s
stdin, a logging proxy, a TUI in `tmux -L octui`; every process stopped by PID. All measured unless
marked. Paths below write `<dir>` for the session's folder.

38. **`serve --stdio --port 47901`** with `OPENCODE_PASSWORD` and `OPENCODE_CONFIG_CONTENT` in its
    env: stdout is exactly one line, `{"url":"http://127.0.0.1:47901"}\n`, about 6 s after spawn;
    **nothing on stderr**. The wrapper `exec`s, so the spawned PID is the server's. Closing its stdin:
    **exit code 0 within 100 ms**.
39. **Auth:** HTTP Basic, user `opencode`; any other user or no header → `401`, headers
    `www-authenticate: Basic realm="Secure Area"`, `content-type: application/json`, body
    `{"_tag":"UnauthorizedError","message":"Authentication required"}`.
40. **The MCP child's environment had no `OPENCODE_PASSWORD`** (stdio mode removes it), but kept
    `OPENCODE_CONFIG_CONTENT` and **every variable of the server's parent**, Claude Code's and
    `MENKAR_PANE` included: Menkar's `withoutSessionEnv` must apply to the server's env.
41. **Routes and shapes** (`/openapi.json`: OpenAPI 3.1.0, 139 paths):
    - `GET /api/info` → `{"version":"2.3.0","pid":N,"hostname":"…","urls":["http://127.0.0.1:P"],
      "paths":{"tmp":"/tmp/opencode"},"capabilities":{"persistentPty":true}}`.
    - The instruction route: `paths["/api/experimental/session/{sessionID}/instructions/entries/{key}"]`
      with `put` and `delete` (operationIds `experimental.session.instructions.entry.put`, `…remove`),
      and `…/instructions/entries` with `get`. The per-folder MCP route:
      `paths["/api/experimental/mcp/{server}"]` with `put` and `delete` (`experimental.mcp.add`,
      `experimental.mcp.remove`); its folder is the query `location` in `deepObject` style:
      `?location%5Bdirectory%5D=<url-encoded dir>`; body `{"config":{"type":"local","command":[…],
      "codemode":false}}` → `204`; then `GET /api/mcp?directory=<dir>` →
      `{"location":{"directory":"<dir>"},"data":[{"name":"menkar","status":{"status":"pending"}}]}`.
    - `POST /api/session {id,title,location:{directory}}` → `200 {"data":{"id","projectID","cost":0,
      "tokens":{"input":0,"output":0,"reasoning":0,"cache":{"read":0,"write":0}},"time":{"created",
      "updated"},"title","location":{"directory"}}}`; `GET /api/session/<id>` the same `data`.
    - `PATCH /api/session/<id> {title}` → `204`, empty body.
    - Unknown session → `404 {"_tag":"SessionNotFoundError","sessionID":"<id>","message":"Session
      not found: <id>"}`.
    - Entries: `PUT …/entries/<key> {value}` → `204`; `GET …/entries` → `{"data":[{"key","value"}]}`;
      `DELETE` → `204`; a bad key → `400 {"_tag":"InvalidRequestError","message":"Expected a string
      matching the RegExp ^[a-z0-9][a-z0-9._-]*$\n  at [\"key\"]","kind":"Params"}`.
    - `POST /api/session/<id>/view` needs `{"idle":<ms>}` (the idle row's `time.created`; `{}` →
      `400 …"Missing key\n  at [\"idle\"]","kind":"Payload"`) → `204`.
    - `POST …/prompt {text, delivery:"queue", resume:false}` → `200 {"data":{"id":"msg_…",
      "sessionID","time":{"created"},"type":"user","payload":{"text"},"delivery":"queue"}}`; without
      `delivery` it reads `"steer"`. `GET …/inbox` → `{"data":[<that same object>]}`;
      `DELETE …/inbox/<msg id>` → `204`.
    - `GET /api/session/active` → `{"data":{}}` idle, `{"data":{"<id>":{"type":"running"}}}` busy.
    - `GET /api/permission/request` → `{"location":{"directory"},"data":[{"id":"per_…","sessionID",
      "action":"shell","resources":["touch b.txt"],"save":["touch *"],"source":{"type":"tool",
      "messageID","id":"call_…"}}]}`.
42. **`GET /api/event`**: `content-type: text/event-stream`, chunked; frames are only
    `data: <json>\n\n` (no `event:` or `id:` lines) and comments `: heartbeat\n\n` (three in about
    a minute). The first frame is `{"id":"evt_…","type":"server.connected","data":{}}`. Every other
    event: `{"id":"evt_…","created":<ms>,"type",["location":{"directory"}],"data":{…},
    ["durable":{"aggregateID":"<session id>","seq":N,"version":1}]}`. `data` per type:
    `session.created` `{sessionID,slug,version,projectID,location,subpath:"",title}` for a root; a
    subagent's child adds `"parentID":"<root>"` after `projectID` and `"agent":"general"` at the end
    (m, item 82);
    `session.renamed` `{sessionID,title}`; `session.viewed` `{sessionID,idle}`;
    `session.inbox.enqueued` `{inboxID,sessionID,item:{type:"user",payload:{text},delivery}}`;
    `session.inbox.delivered` / `.cancelled` `{sessionID,inboxID}`; `session.execution.started` /
    `.succeeded` `{sessionID}`; `permission.asked` = a `permission/request` item;
    `permission.replied` `{sessionID,requestID,reply:"once"}`; `mcp.status.changed` `{server}`.
43. **The database** after two turns: `journal_mode` `wal`, `user_version` 0, `schema_version` 45,
    59 rows in `migration` (last `20261030054400_job`), the 24 tables of item 11. `session_part`
    empty. `session_v2.agent` and `.model` stayed NULL although each `assistant` row names them.
    Row `data`, as stored: `user` `{"time":{"created"},"text"}`; `assistant` `{"time":{"created",
    "firstToken","streamed","completed"},"agent":"build","model":{"id","providerID"},"content":[{"type":
    "text","text"}],"snapshot":{"start","end","files":[]},"finish":"stop","rawFinish":"stop","cost",
    "tokens":{"input","output","reasoning","cache":{"read","write"}}}`, a tool step's `content` being
    `[{"type":"tool","id":"call_…","name":"bash","executed":false,"state":{"status":"completed",
    "input":{…},"content":[{"type":"text","text"}],…}}]` with `finish` `tool-calls`; `idle`
    `{"time":{"created"},"outcome":"succeeded"}`. The DDL of `session_v2`, `session_message`,
    `session_part`, `session_inbox`, `instruction_entry` and `project` was sent to `menkar-t177` as a
    file.
44. **WAL, in three states:**
    - **a server running, before any write**: `-wal` and `-shm` exist from its start;
    - **after a clean stop** (stdin closed): checkpointed, **both removed**, the main file updated;
    - **after SIGKILL**: **both remain** (`-wal` 24,752 bytes, `-shm` 32,768). A
      `file:…?immutable=1` read then **misses the last write** (the old title), and a plain
      `mode=ro` read sees it but **touched `-shm`'s mtime**. So a SIGKILLed OpenCode leaves the
      "a writer is live" state, not plan 39's "`-wal` without `-shm`".
45. **The TUI** (`opencode --server <proxy> -s <id> --prompt "first prompt" <dir>`, on a session
    created first):
    - at start it sent `POST /api/rpc/opencode.goal/get?location…`, `POST /api/session/<id>/agent
      {"agent":"build"}`, `POST …/model {"model":{"providerID","id"}}` and `POST …/prompt
      {"id":"msg_…","text":"first prompt","files":[],"agents":[],"delivery":"steer"}`, and about 30
      kinds of `GET` (`/api/session/<id>`, `…/message`, `…/inbox`, `…/permission`, `…/form`,
      `/api/session/active`, `/api/event`, `/api/info`, `/api/config`, …). **No `/view`** and no
      `PUT …/environment` in this run (`/view` was seen on a `/new`, item 29);
    - the screen: a tab strip ` • <title>   +` (a Braille spinner in place of `•` while busy),
      "Switched agent to Build", "Switched model to m1", the prompt, the reply, then
      "`Build · m1 · 840ms · 1250.0 tok/s · 808ms ttft`"; the composer's last line "`Build · m1
      Stub`" over `╹▀▀▀…`; the footer "`<path>:master    1.0K (1%)  ctrl+p commands`". **No
      "Ask anything" placeholder** in a session view;
    - busy: the footer becomes "`⬝⬝⬝⬝⬝⬝⬝⬝ esc interrupt    1.0K (1%)  ctrl+p commands`"; a queued
      post shows "`1 queued · <text>`" in the composer;
    - permission: "`△ Permission required`", "`$ touch b.txt`", "`Allow once   Always allow
      Reject    ctrl+f fullscreen  ⇆ select  enter confirm`", above "`Press ctrl+b to move running
      work to the background`";
    - **Esc on the card rejects and interrupts**: the step line ends "`· interrupted`";
    - **one Ctrl+C with an empty composer exits, code 0**, after a banner with the logo,
      "`Session   <title>`" and "`Continue  opencode -s <id>`".
46. **Answering a permission** (the TUI through the proxy): Enter on "Allow once" sent
    `POST /api/session/<id>/permission/<per_…>/reply {"decision":"once"}`; "Reject" (two Rights,
    Enter) `{"decision":"reject"}` and the step ended "`· interrupted`"; the body schema is
    `{decision, message?}`, replies `204|400|401|404` (openapi). **Text typed while a card was up
    was taken as keys of the card and answered it `{"decision":"always"}`** — the rule against
    typing, seen happening.
47. **`/new`:**
    - with no prompt typed, it sends nothing; the TUI just leaves the old session
      (`POST /api/session/<old>/view {"idle":<its last idle>}` was sent once, when that session had
      a turn);
    - the first prompt sends `POST /api/session {"id":"ses_…","agent":"build","model":
      {"providerID","id"},"location":{"directory"}}` — **an id made by the TUI, in OpenCode's
      format, and no title** — then `…/model`, `…/prompt`, and after the turn
      `…/view {"idle":<that turn's idle>}`. No `/view` for a session with no turn;
    - **a TUI started with `--prompt` submits that prompt again in the new session**, at once.
48. **A TUI with `--server` and no `OPENCODE_PASSWORD`** prints "`Error: Server at <url> requires
    a password; set OPENCODE_PASSWORD`" with a stack and `[cause]: UnauthorizedError:
    Authentication required`, and exits with code 1.
49. **For the feature checks** (asked by `menkar-t179`): `GET /openapi.json` needs the Basic auth
    too (401 without, 200 with); its `paths` hold
    `"/api/experimental/session/{sessionID}/instructions/entries/{key}"` and
    `"/api/experimental/mcp/{server}"`, each with exactly `put` and `delete`.
50. **A taken port:** `serve --stdio --port <p>` with `p` already bound exits with **code 1 after
    ~210 ms**, nothing on stdout, and on stderr `ServeError:` … `[cause]: Error: Failed to start
    server. Is port <p> in use?` with a stack.
51. **Its MCP children go with it:** with Menkar's MCP added through `PUT /api/experimental/mcp/…`,
    the stub ran as the server's child; closing the server's stdin ended the server (code 0, 84 ms)
    **and the MCP child**, gone 2 s later.
52. **For the catalog** (asked by `menkar-t180`):
    - OpenCode's session picker asks for `parentID: null, archived: false` and filters
      `!parentID` and `time.archived === undefined` again (read,
      `tui/src/component/dialog-session-list.tsx:75-101`): **no archived, no subagent sessions**.
    - **An untitled session's `title` is NULL** in the database (m: a `/new` session before its
      title was generated). A title is generated only when the title is NULL or exactly
      `New session - <created ISO>` (read, `core/src/session/title.ts:38-42`, `llm.ts:202`), and
      readers show NULL as "New session" / "Child session" (read,
      `util/src/session-title-fallback.ts`). A generated title is written by the same
      `session.renamed {sessionID, title}` as a user's `/rename` or a `PATCH` (read,
      `schema/src/session-event.ts:92-99`), and the `event` table held no rows after these runs
      (m): **a reader cannot tell a generated title from a user-set one**.
    - **`BUN_BE_BUN=1` turns the `opencode` binary into Bun**: `BUN_BE_BUN=1 opencode --version`
      printed `1.4.4` (m). OpenCode sets it only for an MCP server whose command is `opencode` and
      for some formatters (read, `core/src/mcp/client.ts:472`, `core/src/formatter/builtins.ts`).
      `OPENCODE_TERMINAL=1` is set only in OpenCode's shells and ptys, `OPENCODE=1` only by its shell
      tool (read, `core/src/shell.ts:897`, `core/src/pty.ts:175`,
      `core/src/tool/plugin/shell.ts:400`).
    - `OPENCODE_DB`: `path.resolve(<data>/opencode, value)`, so an absolute path is used as is and a
      relative one is under the data folder; `:memory:` allowed (read, `cli/src/database-path.ts`).
      The channel is compiled in; the installed binary logs `channel=latest` (m) and writes
      `opencode.db`. A reader cannot learn the channel without running the binary
      (`opencode debug paths` prints the database's path, m).
    - Message types (read, `schema/src/session-message.ts`): `user` (`text`, files, agents,
      skills) is the human's or an API prompt (Menkar's wakes too); `shell` (`command`, `output`,
      `exit`) is the human's `!command` in the TUI's shell mode; `synthetic` (`text`,
      `description`) comes from the API or a plugin and reaches the model as a plain user message
      (m, item of the team-block section); `system` holds `<system-update>` text; `skill` a loaded
      skill's text. The agent's words are `assistant` rows' `text` parts (`reasoning` parts are
      thinking). `experimental.part_rows` is **off unless configured** ("without one, it is off",
      read, `core/src/session/projector.ts:316`); `session_part` was empty in every run (m).
53. **A session id Menkar mints:** the only check is "starts with `ses`" (read,
    `schema/src/session-id.ts`: `Schema.isStartingWith("ses")`). `POST /api/session` refused a
    bare UUID (`400 {"_tag":"InvalidRequestError","message":"Expected a string starting with
    \"ses\"\n  at [\"id\"]","kind":"Payload"}`) and accepted `ses_<uuid>`, `sesX` and an
    OpenCode-form id (m). **A second create with an existing id answered `200` with the existing
    session, unchanged** (its first title kept, m): no error to detect a collision. OpenCode mints
    `"ses_" + 12 hex + 14 base62` = 30 characters: the hex is the six bytes of
    `~(ms * 0x1000 + counter)` (descending, so newer ids sort first), the rest random over
    `0-9A-Za-z` (read, `schema/src/identifier.ts`).

**What the per-pane proxy depends on** (2026-11-21, asked by `menkar-t184`; a proxy logging each
connection, HTTP version, headers and body, between a TUI and `serve --stdio`; all measured).

54. **The wire is plain HTTP/1.1** on the proxy's port only: 53 requests at a TUI's start, all
    `http/1.1`, `connection: keep-alive`, no `Upgrade` (no WebSocket), no HTTP/2, request bodies with
    `content-length` (never chunked), about 10 connections kept alive and reused. The TUI process
    had no connection to the server's own port; only the proxy did. **Every request carried
    `Authorization: Basic`** from the TUI's `OPENCODE_PASSWORD`, so the proxy passes headers through.
    The only absolute URL in a response is `GET /api/info`'s `"urls":["http://127.0.0.1:<server
    port>"]`; the TUI did not use it. The event stream is SSE on `GET /api/event`, piped through,
    with `: heartbeat` **every 15 s**.
55. **`--server`:** a trailing slash works (`http://127.0.0.1:P/` → `/api/info`, …); a path is kept
    as a prefix (`http://127.0.0.1:P/base` → `GET /base/api/info`, which the server answers with its
    web page) and the TUI exits: "Error: Server at … did not provide a compatible V2 health
    response: UnsupportedContentType: text/html".
56. **Session ids on the wire at a start with `-s <id>`:** `GET /api/info`, `GET /api/session/<id>`
    first, then `GET /api/event`, then **the TUI also polls every session of its tab list** (the
    shared `tabs.json`): `GET /api/session/<other>`, `…?parentID=<other>`, `…/<other>/message`,
    `/inbox`, `/permission`, `/form`. Only the shown session gets **`POST /api/rpc/opencode.goal/get
    {"input":{"sessionID":"<id>"}}`** and **`GET /api/experimental/session/<id>/terminal`**.
57. **Switching:**
    - **`/new` sends nothing** until the first prompt; then `POST /api/session {"id":"ses_…",
      "agent","model","location"}` (the TUI-made id), `GET …/<new>/terminal`, `POST rpc/opencode.goal/
      get {"input":{"sessionID":"<new>"}}`, `…/model`, `…/prompt`, and after the turn `…/view`.
    - **Picking a session in the TUI's picker** (Ctrl+X then L) sent `GET …/<picked>/terminal`,
      `GET /api/session?…parentID=null&archived=false&project=…`, the picked session's GETs, and
      `POST /api/rpc/opencode.goal/get {"input":{"sessionID":"<picked>"}}`: **no `/view`, no
      `/prompt`**.
    - So "the pane now shows X" is read from `POST /api/rpc/opencode.goal/get`'s
      `input.sessionID` (also `GET /api/experimental/session/X/terminal`), on a start, a picker
      switch and a `/new` alike; `/view` and `/prompt` miss a switch with no turn.
58. **A subagent's MCP call carries the child's id:** the root called OpenCode's `subagent` tool
    (`agent: "general"`); the child's call to Menkar's MCP arrived with
    `"_meta":{"ai.opencode/sessionID":"<child id>"}`. `GET /api/session/<child>` answers
    `"parentID":"<root id>"` (also `session_v2.parent_id`). The TUI only GETs the child's rows (to
    draw "↳ General finished · probe child"): no `goal/get` or `terminal` for it. When the child
    finished, the parent woke on its own and ran a turn.
59. **An MCP server added before its program existed** stayed `failed` ("Cannot find module …")
    after a second `PUT` of the same config; `POST /api/experimental/mcp/<server>/connect?location…`
    → 204 then `connected`.
60. **`goal/get` on every switch:** a TUI started with `-s A` sent `POST /api/rpc/opencode.goal/get
    {"input":{"sessionID":"A"}}` twice at start (with `GET …/A/terminal` twice); picker → B, → A
    (shown before), → B again: each switch sent `GET …/<picked>/terminal` then one `goal/get` for
    the picked session, re-visits included. In the subagent run, the child was only GET (`/session/
    <child>`, `/permission`, `/form`): **no `goal/get` and no `terminal` for a session the pane does
    not show**, child or tab.
61. **`goal/get`'s answers:** a known session with no goal and an unknown id
    (`ses_doesnotexist0`, even `notases`) both → `200 {"output":null}`, with or without
    `?location…`; `{"input":{}}` → `400 {"_tag":"RpcError","type":"rpc.invalid_input","message":
    "Missing key\n  at [\"sessionID\"]"}`. **The first call, ~7 s after the server printed its URL,
    answered `400 {"_tag":"RpcError","type":"rpc.unavailable","message":"RPC is unavailable:
    opencode.goal"}`**; a second, seconds later, `200`. The plugin behind it loads after the
    server is up.

**For the preparer, launcher, state and waker** (2026-11-21, asked by `menkar-t185`; three
servers on one throwaway home — plain, with `permission {"menkar_*":"allow"}`, with a `skills`
path — the stand-in API logging whole request bodies, a strace of a fresh server; all stopped by
PID).

62. **Create:** `POST /api/session {id,title,location,model}` writes the `session_v2` row at once
    (read right after, before any prompt: `title`, `directory`, `model` `{"id","providerID"}`,
    `agent` NULL). `model` must be an object `{"providerID","id"[, "variant"]}`; the string
    `"stub/m1"` → `400 …"Expected Model.Ref | null\n  at [\"model\"]"`. A titled session kept its
    title through every turn (also item 12; generation only when the title is NULL or the fallback,
    item 52).
63. **The first prompt posted before the TUI:** `POST …/prompt {text, delivery:"steer"}` right
    after the create and the entry PUT, then `opencode --server <url> -s <id> <dir>` (no
    `--prompt`) two seconds later: the TUI drew the user message and the busy footer of the running
    turn, with its tab's spinner; the turn finished normally.
64. **Resume** with `-s <id> <dir>`, `<dir>` a different folder: the TUI's footer, the database row
    and the model's "Working directory" all stayed the session's own folder: **`<dir>` is ignored
    for an existing session**.
65. **Waking:** a queued post to an unknown id → `404 {"_tag":"SessionNotFoundError",…}` (no
    session created); omitting `resume` runs the post (items 13, 63); `resume:false` only enqueues
    (item 7).
66. **The entry PUT during a running turn** → `204`; the change reached the model **inside the same
    turn**, at the next step: a `<system-update>` user message after the tool result; still one
    `session.execution.started`/`.succeeded` pair, no extra turn.
67. **A turn opened by a queued post** (the session idle, Menkar's MCP mounted on its folder with
    `codemode:false`, a `skills` path on the server): its **first** model request already listed
    `menkar_ping` in `tools` and the skill in `<available_skills>`; the model's `skill` tool with
    `{"id":"menkar-probe"}` returned `<skill_content name="menkar-probe"> # Skill: menkar-probe …
    Base directory for this skill: …`. Nothing is deferred.
68. **MCP per folder:** `environment` in the `PUT` config is applied **over** the server's env
    (`MENKAR_AGENT=opencode` added, `XDG_CONFIG_HOME` replaced by the given value); otherwise the
    child had the server's whole env (XDG_*, HOME, PATH, `OPENCODE_CONFIG_CONTENT`, the parent's
    `MENKAR_*`), only the password missing (item 40), and its cwd was the folder. **The folder is
    matched exactly**: `GET /api/mcp?location[directory]=<dir>/sub` → `[]`, and a session created in
    `<dir>/sub` had no `menkar_*` tool ("No tool named \"menkar_ping\" is currently available").
69. **What changes the model's request:** with no extra config and with
    `permission {"menkar_*":"allow"}` the system text (8,736 characters) and the 13 tools were
    byte-identical; a `skills` path added its skill to `<available_skills>` (8,876 characters) for
    **every** session of that server. `PATCH /api/experimental/config` is "Update global
    configuration… the highest-precedence global configuration document" (openapi): the user's
    file, not a per-folder route. With no permission rule in the config, the shell tool ran
    `touch b.txt` with no card.
70. **Events of a subagent:** the child emits its own `session.created` (with `parentID`) and
    `session.execution.started/succeeded`; **the parent's execution ended (`succeeded`) before the
    child's**, and the parent started a new execution when the child finished. Form cards are
    `form.created` / `form.replied` / `form.cancelled` (read, `schema/src/form.ts:173-175`).
71. **Network of a fresh `serve --stdio`** through start, a create and one turn (strace of every
    `connect`): only loopback — the stand-in API (47911) and probes of **127.0.0.1:1234, :8000 and
    :11434** (local model servers such as LM Studio and Ollama), twice each. No DNS, no external
    address, in this run.
72. **Files written** by a create, an entry PUT and a queued post: only `opencode.db-wal` and
    `log/opencode.log` changed. Over these runs OpenCode also created, under its own XDG folders:
    `<data>/opencode/{snapshot/<project>,shell/<project>,repos,log}`, `<data>/opentui/tree-sitter`,
    `<cache>/opencode/bin/opencode-pty`, `<state>/opencode/{prompt-history.jsonl,
    latest/tui/tabs.json,locks,pty}` (the last two by the TUI), and `/tmp/opencode` (shared by every
    home).

**Usage, context, state flips and the terminal** (2026-11-21, asked by `menkar-t193` and
`menkar-t190`; the stand-in now reports `prompt_tokens` 1,000 with `cached_tokens` 300 and
`completion_tokens` 10, the model priced at 3 / 15 / 0.3 / 3.75 USD per million and limited to
50,000 tokens of context; a TUI sampled every ~57 ms; all stopped by PID).

73. **Correction to item 71: the server does reach the network.** The model catalog is fetched
    from `https://models.opencode.ai` (read, `core/src/models-dev.ts`, `defaultSource`) and kept in
    `opencode.db`'s **`kv` table** (keys `models-dev:v2:catalog`, 13 MB, and `…:meta`
    `{"updatedAt","digest","etag"}`), refreshed when older than **5 minutes** and then every 5
    minutes while the server runs (read, `models-dev.ts:562,678,703`). Measured: `updatedAt` moved
    from …382292 to …682454 (300 s) on one running server, with a new `etag`. The strace of item 71
    saw no external connection only because another server had refreshed the shared row less than
    5 minutes before. `OPENCODE_DISABLE_MODELS_FETCH` turns it off (read, item 7 of §1.7's list);
    the bundled snapshot is then used.
74. **Tokens and cost per step:** each `assistant` row's `tokens.input` **excludes** the cached
    part (`input` 700 = 1,000 − 300 `cache.read`), and `cost` = 700×3 + 10×15 + 300×0.3 per million
    = 0.00234 exactly. An unpriced model gives `cost` 0. **An interrupted step**: `time.created`
    and `time.completed`, `content: []`, `finish: "error"`, `error: {"type":"aborted","message":
    "Step interrupted"}`, **no `cost` and no `tokens`**; the idle row says `interrupted`. **A
    provider error (HTTP 500)**: OpenCode retried (`session.retry.scheduled`, data `{sessionID,
    assistantMessageID, attempt, at, error:{type:"provider.internal",message,status:500,…}}`) until
    interrupted; that step's row had no `cost`, `tokens` or `finish`.
75. **Session totals:** `session_v2.cost` and `tokens_*` = the sum of the session's own `assistant`
    rows **plus its `compaction` rows** (0.02574 + 0.00234 = 0.02808; input 7,700 + 700 = 8,400),
    **not its children**: the subagent's own row held its cost (0.00468), the root's did not.
76. **A compaction** (`POST …/compact`) is one execution with `session.compaction.started/delta/
    ended`; its summary step is **not** an `assistant` row but the `compaction` row itself:
    `{"metadata":{"keepID":"msg_…"},"time":{"created"},"status":"completed","reason":"manual",
    "model","cost","tokens"}` (the summary text in `summary`), followed by an `idle`.
77. **A subagent's root:** `user` "SUBAGENT go" → `assistant` (tool call `subagent`, "working in
    the background") → `assistant` "tool done" → **`idle` `succeeded`** while the child still runs;
    when the child ends, a **`synthetic`** row opens the root's next execution:
    `{"metadata":{"source":"subagent","childID":"ses_…","agent":"General","state":"completed"},
    "text":"<subagent sessionID=\"ses_…\" state=\"completed\" description=\"probe child\">\n…\n
    </subagent>","description":"probe child"}`, then `assistant`, `idle`. A queued `user` row's
    `time_created` is **when it was delivered** into the execution (13,029 ms after it was
    enqueued), not when it was posted.
78. **`GET /api/session/<id>/context`** answers `{"data":[…]}`: **the messages now in the model's
    window** — after a compaction the `compaction` row (with `metadata.recent`) and what follows,
    otherwise every row (`user`, `assistant`, `idle`, …) with its id — **not a number or a
    percentage**. `{"data":[]}` for a session that never ran a turn; a session another server ran is
    answered from the shared database; an unknown id → `404 SessionNotFoundError`. The TUI's reading
    (read, `tui/src/util/session.ts:46-61`, `client/src/solid/usage.ts:8-22`): the last `assistant`
    row **with `tokens`** after the last `compaction` row whose `status` is `completed`;
    `input + output + reasoning + cache.read + cache.write` over the model's `limit.context`,
    `Math.round(…*100)`; the limit comes from the catalog (item 73) or the user's config
    `provider.<p>.models.<m>.limit.context` (m: 50,000 here, the footer read "1.0K (2%)" and
    "$0.01").
79. **The working signal through a turn:** a turn of four tool steps (8.2 s): the footer showed "esc
    interrupt" in **every** sample from the first to the last (no gap ≥ 57 ms), and the server sent
    one `execution.started` … `.succeeded` with `step.started/ended` inside. A compaction: one
    execution, the footer busy throughout. **A subagent**: the root's footer went **idle for 836 ms**
    (its execution `succeeded` at +2,220 ms, the child's ran until +3,026, the root restarted at
    +3,031): one idle stretch per subagent, as long as the child runs. A queued post into an idle
    session starts an execution at once; one queued during a turn joins it (items 13, 16).
80. **The terminal (decision 1.205):** the TUI runs in the **alternate screen** (`tmux
    #{alternate_on}` = 1). A line written to its pty by another process
    (`printf '\r\n\033[1;33mMenkar\033[0m …\r\n' > /dev/pts/N`) was drawn at once and **was still
    there after 3 s and after a whole turn**: the TUI repaints only what changes, so the line stays
    until its cells are redrawn. A line printed before the TUI started was **hidden while it ran**
    and visible again after it exited.
81. **The catalog row, read without the server:** `kv.value` is JSON text whose `body` is **itself a
    JSON string** (11.6 MB), an object keyed by provider id, then `models` keyed by model id (the
    key equals the model's `id` in all 9,937 models). So the limit is
    `json_extract(json_extract(value,'$.body'), '$."<providerID>".models."<modelID>".limit.context')`
    (m: 200000 for `opencode`/`big-pickle`, 1000000 for `zai`/`glm-5.3-flashx`). Keys hold `.`,
    `/`, `:` and `@` (provider `wafer.ai`; models such as `google/gemma-3`, `…:free`, `…@eu`), never
    `"`: quote both keys. 192 models have no `limit.context`. A provider defined only in the user's
    config (here `stub`) is not in the catalog. **A user's `limit.context` override is stored
    nowhere in the database** (no row holds a limit): only in their config.
82. **Subagent events, with times from the post** (`/api/event`):
    - one child: root `execution.started` (+581); child `session.created {parentID}` (+1,425),
      `inbox.enqueued` (its prompt), `execution.started` (+1,431); **root `execution.succeeded`
      (+2,286), after the child had started**; child `execution.succeeded` (+3,095); root
      `inbox.enqueued` `synthetic` "<subagent …>" (+3,098), root `execution.started` (+3,100),
      `succeeded` (+3,936). No moment with nothing running; the root restarts **3–5 ms** after the
      child ends;
    - two children in one step: both created and started within 30 ms; the faster child's report
      came while the root was still running and joined that execution (`synthetic` enqueued and
      delivered, no new start); the root ended (+2,573) while the slower child ran; that child's end
      (+3,894) restarted the root 4 ms later;
    - a child that cannot start (`model: "stub/nomodel"`): **no child is created**; the root's tool
      fails (`session.tool.failed` on the root) and the root's execution continues and ends
      normally.
83. **`kv`'s DDL:** ``CREATE TABLE `kv` (`key` text PRIMARY KEY, `value` text NOT NULL,
    `time_created` integer NOT NULL, `time_updated` integer NOT NULL)``, no other index. **A fresh
    home with `OPENCODE_DISABLE_MODELS_FETCH=1`** had **no `kv` rows** after the server started and
    answered `GET /api/model`: the bundled snapshot stays in memory; the row exists only after a
    fetch.

## Real check of Menkar's OpenCode support (2026-11-23, task 198)

Menkar Sandbox 0.1.0-491.g813d0f17 (`multi-agent` at `813d0f1`), extracted from its `.deb` and
driven by Playwright under xvfb with the real opencode 2.3.0, throwaway HOME/XDG and the stand-in
model; full results per point in `prompts/reports/opencode-t198-real-check.md`. Measured:

84. Passed: New's title and first prompt (no re-submit on `/new`); working, "esc again to
    interrupt" and idle after an interrupt; a subagent keeps the root working with one end;
    `/new` and the picker followed; no server or MCP child after the last tab, none after a
    SIGKILL of Menkar; worker tools without a card; a team update mid-turn as a `<system-update>`
    at the next step in one execution; a wake waits behind a permission card; Menkar's usage cost
    and tokens equal `session_v2`'s (0.00936); D9's line and log notice.
85. Failed: **the real permission card stayed `working`, never `blocked`**, though it sat within
    the rule's last 12 non-blank lines; **About's version had ANSI codes** when the app's
    environment had `FORCE_COLOR=1` (`opencode --version` colours its output then). Both go to a
    fix and a re-check (set, 2026-11-23). As designed, not a failure: a mode-off session in a
    folder where a mode-on session mounted Menkar's MCP gets every `menkar_*` tool — decision 1.141
    mounts per folder on Menkar's one server, so every OpenCode session in that folder pays it,
    mode on or off; "exact folder" means a session in another folder (a subfolder included) gets
    none.
86. Not checkable with a stand-in: the context ring for a model outside the catalog (OpenCode's
    footer read "1.0K (2%)" from the config's limit; Menkar drew none), and a real model using
    `load_skill` unprompted.
87. The TUI checks for updates itself: with v2.4.0 published it showed "/update to install
    v2.4.0" and an "Update available" modal over a new session's home screen, taking keystrokes;
    `"autoupdate": false` in the (throwaway) user config stops it.
89. **Re-check on build 0.1.0-492.gd937c868 (task 201's fixes, 2026-11-23):** the permission card
    and the question card now read `blocked` (from ~2 s after the card appears), working and the
    Esc steps unchanged, a subagent still keeps its root working, and About reads `2.3.0` under
    `FORCE_COLOR=1`. The cause of the earlier miss, measured for task 201: with a card up, the
    TUI hides its cursor and leaves it high on the screen (row 7 for the permission card, at the
    running tool's spinner line; row 0 for the question card), and Menkar's mirror read only up
    to the cursor's row.
88. The question tool's card: "→ Asked 1 question", `Questions`, the question, numbered options
    with descriptions, "Type your own answer", "↑↓ select  enter submit  esc dismiss"; Menkar's
    dot stays `working` while it waits.

## 1. The five facts

### 1.1 Starting and resuming

- **The TUI:** `opencode [flags] [directory]` (measured, `opencode --help`, 2.3.0). Flags:
  `--standalone`, `--server <url>`, `--auto` ("Auto-approve permissions that are not explicitly
  denied"), `-c/--continue`, `-s/--session <id>` ("Session ID to continue, or to create if it does
  not exist"), `--prompt <text>`.
  - **`--prompt` is submitted on its own** once the model and agent are ready (read,
    `tui/src/routes/home.tsx:67-78`; measured, item 12). So **start and resume take a first
    prompt**: `opencode --server <url> -s <id> --prompt "<text>" <dir>`.
  - **No `--model`, `--agent` or `--title` on the TUI** (measured). 2.x removed them; agent-deck
    hit launches dying in ~260 ms when it still passed them (its CHANGELOG:838). The model and the
    agent go with `session.create` (`model: {providerID, id, variant}`, `agent`), or
    `POST /api/session/<id>/model` for a resumed one.
  - `opencode mini` (a minimal interface) has `-m/--model`, `--agent`, `--prompt`, `--fork`,
    `--replay`; `opencode run [message]` is the non-interactive mode, with `--title`, `--model`,
    `--format json`, `--archived` (measured, `--help`).
- **A name at start, through the API:** `session.create` takes `id` and `title` (measured, item 6).
  The title is the session's only name (read, `core/src/session/sql.ts`, `session_v2.title`):
  - Renamed by the TUI's `/rename` or ctrl+r, by `PATCH /api/session/<id> {title}`, by
    `run --title`, and by the agent's own `session_rename` tool (read,
    `tui/src/routes/session/index.tsx:1057-1068`, `core/src/tool/plugin/opencode.ts:120-135`).
  - **An untitled root session gets a title generated by a model** after its first prompt (read,
    `core/src/session/runner/llm.ts:202-203`, `core/src/session/title.ts:114-163`), at most 100
    characters. A session created with a title keeps it.
  - Nothing stored tells a user's name from a generated title: every path emits the same
    `SessionEvent.Renamed` (read, `core/src/session/projector.ts:981-983`).
- **The session id can be chosen by Menkar**, as `--session-id` is for Claude: `session.create
  {id}` with an id matching `^ses` (measured, item 6; read, `schema/src/session-id.ts:5`).
  OpenCode's own ids are `ses_` + 12 hex digits of the bitwise NOT of `ms*4096+counter` + 14
  random characters, so **newer ids sort first** (read, `schema/src/identifier.ts:16-31`). A
  Menkar-chosen id breaks that order for its rows (inferred: whether anything relies on it is
  unknown; making the id in OpenCode's format avoids the question).
- **Resume:** `opencode -s <id>` (or `-c` for the last one). With `--prompt` it resumes with a
  first message (read, as above).
- **Fork:** `POST /api/session/<id>/fork`; `run --fork` (measured, `--help` and `/openapi.json`).
- **Archive and delete** are OpenCode's own: `PATCH …{archived:true}`, `DELETE /api/session/<id>`,
  `opencode session delete` (measured, `/openapi.json`, `--help`). They are the counterparts of
  the user-started trash and delete.
- **No folder trust prompt** appeared in a fresh home (measured, items 8–10). Unlike Codex,
  nothing must be written to start in a new folder.

### 1.2 Transcripts

- **Where:** `$XDG_DATA_HOME/opencode/opencode.db`, default `~/.local/share/opencode/opencode.db`
  (measured, `opencode debug paths`). `OPENCODE_DB` overrides it; a channel other than
  latest/dev/beta/next uses `opencode-<channel>.db` (read, `cli/src/database-path.ts:4-12`).
  - SQLite in WAL mode, `busy_timeout=5000`, files 0600 (read,
    `core/src/database/database.ts:42-49,87-99`; measured, item 11). No exclusive locking (read).
    Reading it with `mode=ro` worked while my server wrote it (measured).
  - **No JSON files.** v1's `session`/`message`/`part` tables are copied into the v2 tables and
    never dropped (read, `core/src/database/v1-migration.bun.ts:577-698`): a reader takes only
    `session_v2`. agent-deck still reads v1's JSON tree under `storage/` (§6), which 2.x no longer
    writes (inferred from the absence of a writer).
  - The schema is undocumented and moves (59 migrations, names dated up to 2026-10-30). A reader
    checks `PRAGMA table_info` and treats the JSON columns defensively (inferred).
- **The tables Menkar needs** (read, `core/src/session/sql.ts:28-128`; measured, item 11):
  - `session_v2`: `id, project_id, parent_id, fork_session_id, slug, directory, path, title,
    version, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read,
    tokens_cache_write, agent, model (JSON), time_created, time_updated, time_busy, time_idle,
    idle_outcome, time_archived, …`. Times are epoch milliseconds.
  - `session_message(id, session_id, type, seq, time_created, time_updated, data JSON)`. Types:
    `user, assistant, synthetic, system, skill, shell, compaction, idle, agent-switched,
    model-switched, location-switched` (read, `schema/src/session-message.ts:306-318`).
  - `session_part(message_id, ordinal, type, call_id, data JSON)`. Parts are either inline in
    `session_message.data.content` or rows here (when `experimental.part_rows` is on); OpenCode's
    own reader takes rows first in `ordinal` order, then the inline content (read,
    `core/src/session/history.ts:91-122`).
  - `session_inbox(id, session_id, type, payload, delivery, enqueued_seq, time_created)`: messages
    waiting to be delivered (§2).
- **What Menkar needs, by consumer** (read unless marked):
  - **Session list:** root sessions are `parent_id IS NULL` (subagent sessions have one);
    archived ones have `time_archived`; `directory` is the cwd; `title` the name; `time_updated`
    the last activity (read, `core/src/session/store.ts:156-189`).
  - **Running or not, without the screen:** `time_busy` (the current run's start) and `time_idle`
    with `idle_outcome` (`succeeded|failed|interrupted`): running when `time_busy > time_idle`
    (measured, items 17 and 20).
  - **`last_reply`:** each execution ends with an `idle` message carrying `outcome` and `error`
    (read, `session-message.ts:293-304`; measured). The reply is the text parts of the last
    `assistant` message before it, walking back past steps that ended in `tool-calls` (inferred
    from the schema).
  - **Usage's time and tokens per turn:** an `assistant` message is one model step, with
    `time {created, firstToken, streamed, completed}`, `tokens {input, output, reasoning,
    cache{read, write}}`, `cost` in USD, `model`, `finish` (read, `session-message.ts:220-248`;
    measured, item 20). **Cost is in the data**, unlike Codex.
  - **One `idle` marker can close several user messages**: a steered and a queued message that
    arrive during a turn run in the same execution (measured, item 16). So Menkar's "turn" for
    OpenCode is either *each user message to the next user message or idle* (one per message, as
    for Claude), or *one execution* (one per idle). That is a definition to choose once, in
    `src/core/usage/`.
  - **The classifier's input:** the user's `data.text`, the assistant's `text` parts, the `tool`
    parts (`name`, `state.input`).
- **Menkar writes nothing there.** A second way to read, if the schema moves too often: the
  server's own `GET /api/session`, `…/message`, `/api/experimental/session/<id>/export` (measured,
  `/openapi.json`), which needs a running server (§1.6).

### 1.3 Running state in the terminal

- **Working:** a spinner followed by "`esc interrupt`", which becomes "`esc again to interrupt`"
  after one Esc (read, `tui/src/component/prompt/index.tsx:139-145,1921-1935`). Measured:
  "`⬝⬝⬝⬝⬝⬝⬝⬝ esc interrupt`" in the footer row, and "`Press ctrl+b to move running work to the
  background`" during a tool (item 17). The session's tab
  also shows a Braille spinner, **also while a message only waits in the inbox** (measured,
  item 8): that spinner alone does not mean a turn runs.
- **Permission:** "`△ Permission required`" and a title, with `Allow once` / `Always allow` /
  `Reject` (measured, item 14); Esc rejects; **the prompt replaces the composer** (read,
  `tui/src/routes/session/permission.tsx:199-240`, `tui/src/routes/session/index.tsx:1619-1628`).
- **Idle:** the composer's placeholder "`Ask anything… "<example>"`" (read,
  `prompt/index.tsx:1614-1622`); a first screen shows a "Getting started" card (measured).
- **Errors:** an `ExecutionError` on the turn's idle marker; toasts "Creating a session failed",
  "Failed to set up session"; "Restarting service…" and "Connection lost…" when the server goes
  (read, `tui/src/component/reconnecting.tsx:31`).
- agent-deck's strings agree: busy `esc interrupt`, `Thinking...`, `Generating...`; idle `Ask
  anything`; prompt `enter submit` / `esc dismiss`; and it blanks the welcome logo's block rows,
  which read as a spinner (its `internal/tmux/patterns.go:58-74`, #2523).
- **Signals that need no screen reading** (read, `schema/src/session-event.ts:244-264`,
  `schema/src/permission.ts:45-53`):
  - **`GET /api/event`** (server-sent events, filterable with `?types=`): `session.execution.started`,
    `.succeeded`, `.failed`, `.interrupted` (reason `user|shutdown|superseded|inactivity`) — a
    turn's start and end; `permission.asked`, `permission.replied`; `session.inbox.enqueued`,
    `.delivered`. `session.status` exists in the schema but nothing publishes it (read).
  - `GET /api/session/active`, `GET /api/permission/request`, and
    `POST /api/experimental/session/<id>/wait` (blocks until idle).
  - These come from the server Menkar runs (§1.6), with its password. **No hook, no trust, no
    write** is needed, unlike Codex's `notify` and hooks.
  - Server plugins see the same events (`plugin/src/effect/event.ts:6-10`) and have hooks such as
    `permission.evaluate`, which can answer a permission and which Menkar must never use.

### 1.4 Status line and context reading

- **No external status line command** (read: none in source). TUI plugins can fill render slots
  such as `prompt.footer.status` (read, `plugin/src/tui/context.ts:191-203`); they load from the
  user's `cli.json` or `OPENCODE_CLI_CONFIG_CONTENT` (read, `cli/src/config/config.ts:31-34`).
- **The context the TUI shows:** the last assistant message with tokens after the last finished
  compaction; `input + output + reasoning + cache.read + cache.write` over the model's
  `limit.context` (read, `tui/src/util/session.ts:46-61`). The limit comes from the model catalog
  (models.dev), not the database. **`GET /api/session/<id>/context`** gives the reading from the
  server (measured, `/openapi.json`; its fields unprobed).

### 1.5 Remote mode

- `opencode pair` prints one-time links to connect a browser or app; `--remote` pairs "through
  the OpenTunnel remote address … (exposes the server to the internet)" (measured, `--help`). It
  turns on remote access in the service's settings and restarts it (read,
  `cli/src/commands/handlers/pair.ts:14-31`).
- **Server-wide, never per session**; share links were removed (read,
  `tui/src/config/keybind.ts:126`). A session on Menkar's own server (§1.6) is not on the user's
  paired service. Menkar's agent entry should declare **no remote mode for OpenCode**.

### 1.6 The shared service, a private server, and Menkar's own server

- **The background service** (read, `cli/src/services/service-config.ts`,
  `client/src/effect/service.ts:49-127`):
  - Its settings are `$XDG_CONFIG_HOME/opencode/service.json` (`disabled, remote, hostname, port,
    password, cors, env`); its registration (url, pid, version, password) is
    `$XDG_STATE_HOME/opencode/service.json`. The human has both (listed, not read).
  - **Port 49374** (0xC0DE) on 127.0.0.1 for every latest-channel install (read,
    `service-config.ts:46-60`; measured, items 3 and the human's `ss`).
  - Any TUI or command started with no flag finds it through the registration, or starts it
    detached **with its own environment**; a version mismatch makes the TUI replace it (read,
    `client/src/service-contender.ts:19-23`, `client/src/service-probe.ts:22-31`). One service
    serves every folder of the user (it `chdir`s to `$HOME`, `cli/src/server-process.ts:63-65`).
  - So the service's configuration is whatever environment the first client had, plus
    `opencode service set env`. **Today it is OpenCode Desktop's.**
- **`--standalone`:** a private `serve --stdio --port 0` per TUI, with the TUI's environment and a
  random password Menkar cannot learn; it is never registered (measured, item 4; read,
  `cli/src/services/standalone.ts:17-80`). Per-run configuration works there, but **Menkar
  cannot post to it**.
- **Menkar's own server** — `opencode serve --hostname 127.0.0.1 --port <port>` with
  `OPENCODE_PASSWORD` and `OPENCODE_CONFIG_CONTENT` in its environment — and TUIs started with
  `--server <url>` and `OPENCODE_PASSWORD` (measured, items 5, 8, 10). It uses the user's
  `opencode.db` and config like any other server (inferred: it uses the same XDG paths), so
  Menkar's OpenCode sessions are the user's sessions, as Menkar's Claude sessions are.
  - Several servers on one database is what `--standalone` already does (read), with WAL.
  - **The same session open in two servers at once** (Menkar's and the human's TUI on the
    service) **runs two turns at once**: a queued post to one server does not wait for a turn
    running on the other, each TUI shows only its own server's activity, and the history is
    interleaved by write order; the database stays intact (measured, items 22–25). It is like a
    Claude session resumed in two terminals, and made likelier by the shared tab list (item 31).
  - The TUI's own environment still reaches its session's shell commands: the TUI sends it with
    `PUT /api/session/<id>/environment` (read, `cli/src/env.ts:15-22`, `tui/src/app.tsx:536`), so
    `MENKAR_PANE` reaches the bash tool, not the MCP server.
  - In `serve` mode **the password stays in the server's environment**, and the MCP server
    inherited it (measured, item 10); in stdio mode it is removed (read,
    `server-process.ts:87-90`). Anything the agent runs as the same user can reach the server
    anyway (inferred), so this is a cost to state, not a new exposure.

### 1.7 Environment variables a running OpenCode sets for its children

Read in source. The `sessionenv.ts` counterpart:

| Variable | Set where | Says |
|---|---|---|
| `OPENCODE=1`, `AGENT=1` | the bash tool (`core/src/tool/plugin/shell.ts:399-400`) | "I run under OpenCode" |
| `AI_AGENT=opencode` (only if unset) | the bash tool (`shell.ts:401`) | already in Menkar's `identity` list for Claude |
| `OPENCODE_SESSION_ID` | the bash tool (`shell.ts:402`) | the parent session |
| `OPENCODE_TERMINAL=1`, `TERM=xterm-256color` | shells and ptys (`core/src/shell.ts:894-898`, `core/src/pty.ts:171-176`) | an OpenCode terminal |
| `OPENCODE_PASSWORD` | inherited from a `serve` started with it (measured, item 10) | the parent server's credential |
| `BUN_BE_BUN=1` | an MCP server whose command is `opencode` (`core/src/mcp/stdio.ts`) | — |

- A Menkar started from OpenCode's bash tool would hand on `OPENCODE_SESSION_ID`,
  `OPENCODE_PASSWORD` and the rest. `OPENCODE_PASSWORD` would authenticate a TUI to the wrong
  server only with a matching `--server`, but it is a credential and goes (inferred).
- The variables that are configuration and are kept: `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`,
  `OPENCODE_CONFIG_CONTENT`, `OPENCODE_DB`, `OPENCODE_FLAGS`, `OPENCODE_DISABLE_*`, provider keys.
  Menkar's own server would set `OPENCODE_CONFIG_CONTENT` **merged with** a user's own, not over
  it (§4).
- **The reverse direction:** OpenCode started by Menkar must not get Claude Code's variables.
  `withoutSessionEnv` already strips them from every pty; **Menkar's `opencode serve` needs the
  same**, since its environment reaches every MCP server and shell it starts (measured, item 10).

## 2. Messages: waking an OpenCode session, and sending and receiving

**`POST /api/session/<id>/prompt` (official API; read and measured)**

- Body `{text, files?, agents?, skills?, id?, metadata?, delivery?: "steer"|"queue", resume?}`:
  "Durably admit one session input and schedule agent-loop execution unless resume is false"
  (measured, `/openapi.json`).
- **The inbox is durable**, in `session_inbox` (measured, item 7). `GET …/inbox` lists it,
  `DELETE …/inbox/<id>` cancels an item, `PATCH` edits it.
- **Delivery** (read, `core/src/session/inbox.ts:52-57,565-585`, `core/src/session/prompt.ts:52`;
  measured, item 16):
  - `steer` (the default) joins a running turn at its next step boundary;
  - **`queue` waits for the current step's end**, then runs, in the same execution;
  - an idle session is woken at once (the post "rings a doorbell",
    `core/src/session/run-coordinator.ts:135-144`): **about 50 ms** (measured, item 13). A busy
    one is never interrupted or refused.
- **While a permission is pending** nothing is approved and the message waits: 25 s with the card
  untouched, then it ran 1.6 s after the human's approval (measured, item 14; read,
  `core/src/permission.ts:256-280`).
- **A TUI on the same server shows it:** "`1 queued · …`" above the composer, then the turn as an
  ordinary user message (measured, items 8 and 13). **A half-typed draft survives** (measured,
  item 15).
- The text arrives as a **user** message. `POST /api/session/<id>/synthetic` adds a *synthetic*
  message instead, with a `description`; whether the model and the TUI treat it differently is
  unprobed. Either way the frame says "[Menkar] …", as today.
- **`opencode run --session <id> "<msg>"` is not a way in.** It posts with `steer`, and **answers
  every pending permission of that session tree** (reject, or allow with `--auto`), cancels forms,
  and interrupts the session on Ctrl+C (read, `cli/src/run/noninteractive.ts:96-112,153-155,
  217-234`).
- **`opencode api session.prompt …`** is the same post from the command line; it finds the
  *registered service* and its password (read, `cli/src/commands/handlers/api.ts:21-41`), or the
  `--server` given with `OPENCODE_PASSWORD` (measured). Menkar would use HTTP directly.
- **OpenCode's own parent and child sessions:** `session.create {parentID}` makes a child whose
  every finished round "sends a `<subagent>` report to the parent's inbox and wakes the parent"
  (measured, `/openapi.json`). That is OpenCode's version of what Menkar does for workers, but
  its children are subagent sessions (`parent_id` set), hidden from session lists and not
  Menkar's tabs (inferred).

**The ways to wake an OpenCode session, against the rule that nothing is typed (2.21)**

| Way | Keeps the rule | Notes |
|---|---|---|
| **`POST /api/session/<id>/prompt {delivery:"queue"}`** on Menkar's server | **Yes**: no keystrokes | Official; durable; idle wake ~50 ms; waits behind a permission; keeps a draft (all measured); needs Menkar's own server (§1.6) |
| The same on the user's shared service | Yes | Possible with the registration's password (read only), but Menkar's MCP and settings cannot reach a session there (§4) |
| End and `opencode -s <id> --prompt "<event>"` | Yes | Fallback only; the costs of `wake-orchestrator.md` §5 |
| `opencode run --session <id>` | Yes, but **answers permissions** | Not usable |
| Typing into the pty (agent-deck's default) | **No** | Not needed |
| ACP (`opencode acp`) | n/a | An editor protocol over stdio with its own standalone server (read, `cli/src/commands/handlers/acp.ts:24-35`); a future chat tab could use it |

**Recommendation for 2.21, for the human:** for OpenCode, the inbox post keeps the rule, as
`codex queue` does for Codex. It depends on Menkar running its own `opencode serve`.

## 3. Mixed teams

- **Nothing in the transport stops OpenCode taking part.** Each direction:

| Direction | Wake / report | What Menkar adds |
|---|---|---|
| Claude parent → OpenCode child | Menkar sees the child's turn end on its server's event stream and posts to the Claude parent's socket, as today | OpenCode state from events; `last_reply` from the database or API |
| OpenCode parent → any child | Menkar posts `[Menkar] …` to the parent's inbox (`delivery: queue`) | the OpenCode `wake`; the parent's session id (Menkar chose it) |
| OpenCode ↔ Codex, Cursor | as above, each side through its own `wake` | — |
| Any session → a named session | OpenCode has no `SendMessage`; Claude's reaches only Claude sessions | **a Menkar MCP tool `send_message { name, text }`**, as `codex.md` §3 proposes |

- **Who is calling Menkar's MCP server:** `_meta["ai.opencode/sessionID"]` on every `tools/call`
  (read, `core/src/mcp/client.ts:711-718`; measured, item 18); Menkar knows each
  pane's session id because it created it. The server's check that refuses calls without
  `MENKAR_PANE` needs a second way in for OpenCode.
- **A session Menkar did not create** (the human's `/new` in a Menkar tab, or a click on another
  tab of the shared list) calls with an id Menkar never mapped (measured, items 26–28). The
  server's events and the database do not say which TUI made or shows it. Ways to bind it:
  - **a per-pane proxy inside Menkar** (one loopback port per OpenCode pane, forwarding to the
    one server): the pane's `POST …/view` and `…/prompt` paths name its current session
    (measured, item 29). No extra process; Menkar's main process listens.
  - a server per pane: the pane is then the server, and `MENKAR_PANE` in the server's environment
    reaches the MCP server (measured, item 10), at about 270 MB per OpenCode tab (item 30).
  - refuse unmapped ids: the call fails with Menkar's sentence until the human returns to the
    pane's own session.
- **`start_session { agent? }`** as in `codex.md`: `model` becomes `session.create`'s `model`
  (`provider/model`), the name its `title`; `remote_control` is refused.
- agent-deck does not let an OpenCode session be a conductor (its
  `cmd/agent-deck/conductor_cmd.go:213`): only Claude, Codex, Hermes and Pi. Its OpenCode workers
  get status only, no messages (its `docs/comms.md:130`).

## 4. Menkar's MCP server and skills in an OpenCode session

- **Per run, without touching `~/.config/opencode`:** the server's environment
  (read, `cli/src/server-process.ts:122-134`; `core/src/config.ts:291-303,367-377`):
  - `OPENCODE_CONFIG_CONTENT` (inline JSON) is the **last config layer before managed policy**,
    above the user's global and project files. There is no deep merge: an MCP server of the same
    name replaces the user's; `permissions` concatenate (last match wins); `instructions`,
    `skills` and `plugins` are unioned (read, `core/src/config/plugin/mcp.ts:46-54`).
  - `OPENCODE_CONFIG` (a file) sits **below** the project's files; `OPENCODE_CONFIG_DIR`
    **replaces** the global config folder (the user's `opencode.json`, `AGENTS.md`, skills), so it
    is not for Menkar.
  - **There is no CLI flag** for any of it (read, `cli/src/commands/commands.ts:7-47`).
  - **It works only on a server Menkar starts** (§1.6): on the shared service it is read once, from
    whoever started it. If the user has their own `OPENCODE_CONFIG_CONTENT`, Menkar merges into it
    rather than replacing it (inferred, a design point).
- **The MCP entry:** `{"mcp":{"menkar":{"type":"local","command":[<electron>, <script>],
  "environment":{"ELECTRON_RUN_AS_NODE":"1"}}}}` (measured with the v1 form, item 10; v2's form
  is `mcp.servers.<name>`, read, `schema/src/mcp.ts:26-43`).
  - **The pty's environment does not reach the MCP server; the server's does, all of it**
    (measured, item 10). One MCP connection serves every session of a folder (read,
    `core/src/mcp/index.ts:1130`), so `MENKAR_PANE` cannot name the caller; `_meta` does (§3).
  - **`codemode: false` is needed** for the tools to be the model's own: with the default, MCP
    tools are reached only through OpenCode's `execute` tool (Code Mode), and the skills'
    "call `menkar_…`" would name a tool that is not there (measured, item 18). **Its cost: the 18
    tools' definitions, ~9.8 KB, ~2.4–2.8k tokens, in every request**; Code Mode costs ~3.7 KB
    (measured, items 32–33). The server's `tools/list` can shrink it per caller, and OpenCode
    re-lists on `notifications/tools/list_changed` within the same turn (measured, item 34).
  - **No approval card:** `permission: {"menkar_*":"allow"}` (v1 form) in the same JSON (measured,
    item 18), or `permissions: [{action:"menkar_*", resource:"*", effect:"allow"}]` (v2 form) or on
    `session.create` (accepted, item 6). The action is `<server>_<tool>` (read,
    `core/src/tool/mcp.ts:23-25`). Whether an MCP tool asks at all without the rule is unprobed.
  - Also possible: `PUT /api/experimental/mcp/<server>` adds a server to one folder of a running
    server until it restarts (read, `server/src/handlers/mcp.ts:34-40`).
- **Skills** (read, `core/src/config/plugin/skill.ts:86-104`, `compatibility.ts:45`,
  `discovery.ts:59-167`):
  - Folders: `skill/` and `skills/` under each config folder (global and each project
    `.opencode/`), `~/.claude/skills`, `~/.agents/skills`, and every `.claude/skills` and
    `.agents/skills` walking up from the cwd. `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS` drops the
    `.claude` ones.
  - **A per-run skills folder exists: the config key `skills`** (`["/abs/dir"]`, or v1's
    `{paths:[…]}`), in Menkar's `OPENCODE_CONFIG_CONTENT`. A `SKILL.md` with Claude's `name` and
    `description` frontmatter loaded from it and was listed to the model (measured, item 19).
    Menkar's plugin folder keeps its skills under `skills/`, so it can be named as it is
    (inferred).
  - A skill can also be started through the API: `POST /api/experimental/session/<id>/skill {id}`
    (measured, `/openapi.json`).
  - The skills' text names Claude Code tools (`SendMessage`, `--plugin-dir`), as `codex.md` says.
- **Per-session instructions:** `PUT /api/experimental/session/<id>/instructions/entries/<key>`
  "Attach or replace one durable instruction entry" (measured, `/openapi.json`; stored in
  `instruction_entry`). This is a per-session system-prompt addition with no file at all
  (unprobed: what the model sees).
- **Plugins** load per run from `plugins: ["/abs/dir"]` in the same JSON (read,
  `core/src/config/plugin/source.ts:139-156`); none is needed for the above.

## 5. Project instructions (the OpenCode side only; `claude-cli` covers Claude Code)

Read in `core/src/config/plugin/instruction.ts:30-177` and
`core/src/instruction-discovery.ts:120-122`.

- **Only `AGENTS.md`.** No `CLAUDE.md`, `CONTEXT.md`, `.claude/rules` or `@`-imports anywhere in
  core or server (read: grep over the source; `.claude` is read only for skills,
  `cli/src/server-process.ts:127`).
- **Global:** `$XDG_CONFIG_HOME/opencode/AGENTS.md`.
- **Project:** every `AGENTS.md` walking up from the cwd to the git root (or to `$HOME` when the
  folder is under it). A nested `AGENTS.md` below the cwd is added when the read tool opens a file
  under it (read, `core/src/tool/plugin/read.ts:129-150`).
- **The `instructions` key** takes absolute paths, globs and URLs (fetched with a 5 s timeout).
  So Menkar could give its OpenCode sessions this repository's `CLAUDE.md` with
  `instructions: ["<repo>/CLAUDE.md"]` in its own `OPENCODE_CONFIG_CONTENT`, without a file in the
  repository: a file named there reached the model as "`Instructions from: <path>`" and its text
  (measured, item 19).
- **No size limit** (read); each file is rendered as `Instructions from: <path>` and its text.
- **For the move (1.127):** `AGENTS.md` holding the text serves OpenCode and Codex directly;
  `CLAUDE.md` then holds `@AGENTS.md` if Claude Code follows the import (`claude-cli`'s answer).
  OpenCode has no fallback-file setting like Codex's `project_doc_fallback_filenames`.

## 6. agent-deck on OpenCode, in short

Read at `9fa44b5`. It checks `opencode --version` once and treats 1.x and 2.x apart (its
`internal/session/opencode_version.go:14-26`).

| Area | agent-deck (2.x) | Takeable by Menkar |
|---|---|---|
| Start | `opencode api session.create` with title, folder, model, agent, then `opencode -s <id>` | yes: the idea, done over HTTP |
| Session id | the one it created; otherwise polls `api session.list` by folder, skipping children | yes, as knowledge |
| Transcripts | v1's JSON tree under `storage/`, no SQLite ("on the design machine the SQLite tables are empty") | no: 2.3.0 writes only SQLite |
| State | the service's `/api/event` (URL from `opencode service status`, password from the registration), `session.execution.*`; screen as fallback | yes: the events |
| Messages | default: tmux `send-keys` + Enter; "queue": `api session.prompt {delivery:"queue"}`, never falling back to typing | the queue: **yes**; typing **no** |
| MCP | writes `[mcp.servers]` into the project's or the user's `opencode.json` | **no** |
| Instructions | `OPENCODE_CONFIG_CONTENT={"instructions":[<file>]}` per run, only if unset | the idea, merged; on Menkar's own server |
| Shared service | "one `serve --service` per host … must never be killed with a session" (its CHANGELOG:706) | yes, as a rule |
| Conductor | not OpenCode | n/a |

## Team block delivery (decision 1.150; 2026-11-15)

Asked by `set` (task 25): the best per-session route for Menkar's ~25-line team block in an
OpenCode session, with nothing written in the user's config. Source re-read at `a6b15d3`;
measured on opencode v2.3.0 in a fresh throwaway home (the scratchpad had been cleared and was
rebuilt), with the stand-in API (PIDs 22523, then 25044) and my own `opencode serve` (PIDs 22621,
then 26408, the second standing for a resume), all stopped by PID. The stand-in answered OpenCode's
compaction template with a fixed summary.

**Setup:** one session `ses_teamblock0001`, created through the API, carrying four marked texts at
once: the repository's own `AGENTS.md` (`PROJECT-AGENTS-3333`), a file named in the server's
`OPENCODE_CONFIG_CONTENT` `instructions` (`CFG-INSTR-…`), the `instructions` returned by an MCP
stub's `initialize` (`MCP-INSTR-…`), and a per-session instruction entry put with
`PUT /api/experimental/session/<id>/instructions/entries/menkar.team {value}` before the first
prompt (`ENTRY-TEAM-…`). Every model request body was logged.

### The routes

| Route | Per session | Where it lands | Before the first prompt | Changed mid-session | After compaction | After a resume (new server) | Cap |
|---|---|---|---|---|---|---|---|
| **Instruction entry** (`PUT …/instructions/entries/<key>`) | **yes** | **system prompt**, last, as `<context key="menkar.team">…</context>` (m) | **yes**, if put before the prompt (m) | a `<system-update>` user message before the next prompt: "The context under "menkar.team" changed and supersedes the previous value" (m) | **system prompt rebuilt with the current value** (m) | **kept**: stored in `instruction_entry`; the system prompt as recorded, changes as a `<system-update>` (m) | 256 KiB per value (r, `schema/src/instruction-entry.ts:30`); key `^[a-z0-9][a-z0-9._-]*$` |
| `instructions: [file]` in Menkar's server config | no: per server, so per folder for every session on it | system prompt, after `AGENTS.md`, as `Instructions from: <path>` (m) | yes (m) | `<system-update>` "The instructions changed: …" (m; the file is watched) | rebuilt, current (m) | changes as a `<system-update>` (m) | none (r) |
| MCP `initialize` → `instructions` | no: one connection per folder; the server cannot know the session at `initialize` | system prompt, as `<mcp_instructions><server name="menkar">…` (m) | yes (m) | on reconnect, a `<system-update>` "The following MCP server instructions have changed…" (m, at the resume) | rebuilt (i, as the others) | as left (m) | none seen (r) |
| `POST …/synthetic {text}` | yes | **a plain user message** in the conversation, unmarked (m) | only if posted before the prompt | a new message | **summarized away** (i: it is conversation) | in the history | — |
| An agent's `system` (`agents.<id>.system`, config) | per agent, chosen at `session.create {agent}` | **replaces OpenCode's base prompt** (r, `core/src/session/model-request.ts:115-125`) | yes | no | — | — | — |
| `prompt`/`session.create` fields | — | no system field exists (m, `/openapi.json`) | — | — | — | — | — |
| A server plugin hook (`session.context`, `model.request`) | yes, by code keyed on the session | wherever the plugin puts it (r) | yes | yes | yes | yes | — |

Notes (m unless marked):
- **The system prompt is frozen at a session's first request** and reused byte for byte (the
  provider's cache prefix stays valid). Changes to any instruction source go as one
  `<system-update>` user message, inserted before the next prompt and kept in the history. After a
  compaction, the system prompt is rebuilt from the current values and the old updates are
  summarized: the compaction prompt itself says "The next agent receives current versions of all
  of these separately".
- **Order in the system prompt:** OpenCode's base prompt, tools in Code Mode, `<mcp_instructions>`,
  `<available_skills>`, every `AGENTS.md` (`Instructions from: <path>`), the config
  `instructions` files, the environment block, then the session's `<context key=…>` entries. All
  are **added together**; none replaces the user's `AGENTS.md`.
- **Token cost:** the block's own size in every request, as part of the system prefix: a 25-line
  block of ~1.5 KB is ~400 tokens (3.5–4 bytes per token, i), cached as a prefix by providers that
  cache (i). A change costs one `<system-update>` message once, then it is history.
- **Inside an update, the entry's tags are HTML-escaped** (`&lt;context key="menkar.team"&gt;`), as
  OpenCode renders them (m); harmless, but the text the model sees differs from the first render.
- **A session's entries are listed** with `GET …/instructions/entries`, removed with `DELETE`;
  the route is under `/api/experimental/` (m), so its shape may change between versions.

### Recommendation

1. **The per-session instruction entry**, put by Menkar right after `session.create` and before the
   TUI submits its `--prompt`: per session, system-prompt weight, there before the first answer,
   persistent across resume, rebuilt after compaction, updated mid-session with a marked
   `<system-update>` (which also serves 1.152's "a change reaches a running session at once"
   without a `[Menkar]` post), no file written anywhere, up to 256 KiB. Its cost: it is an
   experimental route; a version check belongs in the OpenCode adapter.
2. **Second best: a file per session named in `instructions`** — but the config is per server, so
   this needs **a server per session** (~270 MB each, item 30), or one file per folder shared by
   every session there. Only as a fallback if the entries route disappears.

MCP `instructions` reach the system prompt in OpenCode (unlike Claude, where they are a capped
conversation message), but one text serves every session of a folder, so they cannot carry who
the session is.

## What Menkar would need to build

1. **An agent entry for OpenCode** in `src/core/agents.ts`: command `opencode`; no remote mode;
   enabled on Linux; name at start (through `session.create`); resume `-s <id>`; how to wake.
2. **Menkar's own `opencode serve`**, one per Menkar, started when the first OpenCode tab opens:
   a loopback port and password of Menkar's, `withoutSessionEnv` applied, and
   `OPENCODE_CONFIG_CONTENT` carrying Menkar's MCP server (with `codemode: false`), `permissions`
   for `menkar_*`, and the skills folder. Stopped by PID with Menkar. Never the user's service.
3. **Starting a session:** `POST /api/session {id, title, location, model?, permissions}`, then
   the TUI `opencode --server <url> -s <id> [--prompt "<first>"] <dir>` with `OPENCODE_PASSWORD`
   in the pty.
4. **An OpenCode reader** in `src/core/` over `opencode.db` read only (`session_v2`,
   `session_message`, `session_part`; idle markers as turn ends), for the session list,
   `last_reply`, Usage (time, tokens and cost per turn) and the classifier. Schema checks first.
5. **State from the event stream** of Menkar's server (`session.execution.*`,
   `permission.asked`), with the screen strings of §1.3 as a fallback.
6. **Context** from `GET /api/session/<id>/context` or the last step's tokens.
7. **`wake` for OpenCode = `POST /api/session/<id>/prompt {text:"[Menkar] …", delivery:"queue"}`**.
8. **The MCP server's caller from `_meta["ai.opencode/sessionID"]`**, mapped to the pane; the map
   kept current by a per-pane proxy's `/view` and `/prompt` (§3), and the pane's session in
   Menkar's list following it, as a `/clear` does for Claude.
9. **`start_session { agent? }`, `send_message`, skills served** as `codex.md` items 8–10 say.
10. **`sessionenv.ts` for OpenCode:** the variables in §1.7, applied to the panes and to
    Menkar's server.
11. **What stays the human's (topics for `set`):**
    - adopting the inbox post for 2.21, and with it **Menkar running its own OpenCode server**
      beside the user's service;
    - naming: Menkar sets `title` when it creates the session, through OpenCode's API — a
      start-time name like `claude -n`, but written into the agent's data by Menkar's call;
    - the same session open in Menkar's server and in the human's own TUI at once runs two turns
      at once (measured): whether Menkar warns, refuses to start a session its database shows
      busy (`time_busy > time_idle`), or accepts it as the human's choice; and the shared tab
      list that makes it one click away;
    - how a pane's caller is bound after `/new`: a per-pane proxy (recommended by me: exact, no
      process), a server per pane, or refusing;
    - `CLAUDE.md` versus `AGENTS.md` here, or `instructions` per run;
    - OpenCode Desktop's service still running after its uninstall (the human's machine, not
      Menkar's design).

    - which "turn" Usage counts for OpenCode: per user message, or per execution (§1.2).

## Still unknown

The first list (queued wake, approval, draft, busy columns and events, `--prompt` on a created
session, MCP approval and `_meta`, skills and instructions) was measured on 2026-11-14 against
the stand-in API; see "Turns against a stand-in API". Still open, each asked of `set` first:

1. (Answered in items 22–31: two servers run two turns at once on one session, without
   corruption; `/new` is bound only by watching the pane's own requests.) Whether a busy check
   on `time_busy` across servers is reliable enough to refuse a second start.
2. A TUI of another version against Menkar's server (the service replaces itself on a mismatch;
   `--server` may not).
3. Whether an MCP tool asks for approval at all without an `allow` rule; whether a `synthetic`
   post differs from a user one for the model or the TUI.
4. A real model's behaviour with Menkar's skills and tools (the stub only proves the plumbing).
5. Windows and macOS: the service port (Windows moves it to 0x70DE), paths.
