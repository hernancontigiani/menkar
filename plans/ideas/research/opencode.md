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
    "call `menkar_…`" would name a tool that is not there (measured, item 18).
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
