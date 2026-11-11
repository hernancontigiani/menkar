# b2: research for plan 31 (1.70, session control)

This is a research report: no code was changed in the tree. Everything was measured with the real
`claude` 2.1.322 (`~/.local/share/claude/versions/2.1.322`), driven through node-pty, with:

- **A throwaway HOME** in my scratchpad. Its `.claude.json` was seeded with onboarding done, a fake
  key approved, the folder trusted, and **one user-level MCP server `usersrv`**, to see how servers
  merge.
- **A stand-in API** on 127.0.0.1 (`ANTHROPIC_BASE_URL`). It logs each request's tool names, and
  when the prompt says `CALL mcp__menkar__ping` it answers with that `tool_use`, then with text
  once the result is back.
- **A hand-written stdio MCP server** of about 30 lines, newline-delimited JSON-RPC. It logs its
  env and every message.
- **`MENKAR_PANE=pane-probe-170`** in the pty.

The human's `~/.claude` was not touched, and nothing went to the network. Every process was
stopped by PID.

Scripts and screens are in
`/tmp/claude-1000/-home-hernan-git-menkar/a8b08f80-4038-4134-ad99-243cbd57aab0/scratchpad/m170/`:
`drive.mjs`, `fakeapi.mjs`, `mcpserver.mjs`, `httpmcp.mjs`, and `screen-<run>-0.txt`.

## 1. Handing a server to a session: `--mcp-config`, not `--settings`

| Run | Flags | Servers started | Tool call |
|---|---|---|---|
| A, F | `--mcp-config menkar.json` | `usersrv` **and** `menkar` | works |
| G | `--strict-mcp-config --mcp-config menkar.json` | `menkar` only | works |
| H | `--settings` with an `mcpServers` key, no `--mcp-config` | `usersrv` only | `Error: No such tool available: mcp__menkar__ping` |
| J | `--mcp-config '<inline JSON string>'` | both | works |

- **`--mcp-config` adds to the user's servers; it does not replace them.**
  `--strict-mcp-config` would drop the user's own servers from Menkar's sessions, so Menkar should
  not pass it.
- **`mcpServers` in the `--settings` file is ignored.** The key is not read from there.
- **`--mcp-config` takes a file path or an inline JSON string.** An inline string lets each pane
  get its own config with no file written.
- **No trust prompt** appears the first time. Servers start at launch, before the first prompt.
- **What `/mcp` shows** (run I): "2 servers". Under "User MCPs (…/.claude.json)" it lists
  `✔ usersrv 1 tool`. Under **"Built-in MCPs (always available)"** it lists `✔ menkar 1 tool`.
- **Nothing was written about it:** after the runs, the throwaway `.claude.json` holds no mention
  of `menkar`.
- **The tools are deferred.** None of the `mcp__*` tools is in the request's `tools` array (13
  tools, including `ToolSearch` and `DeferredToolPlaceholder`), but the body names
  `mcp__menkar__ping`. The stand-in model called it directly and Claude Code ran it. A real model
  will usually go through `ToolSearch` first: one extra step, but no blocker.
- **The protocol exchange:** before `initialize` (`protocolVersion` `2025-11-25`), Claude Code
  sends `server/discover` (`_meta` protocolVersion `2026-07-28`). My server answered `-32601
  Method not found`, and Claude Code went on with `initialize`, `notifications/initialized` and
  `tools/list` without complaint.

## 2. The server inherits the pty's env

The stdio server's env has `MENKAR_PANE=pane-probe-170`, and its `ppid` is the `claude` pid. It
also gets `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PROJECT_DIR`, `CLAUDECODE` and
`CLAUDE_CODE_MESSAGING_SOCKET`/`_TOKEN`. So a stdio server can name its pane from its own env, as
the SessionStart hook does (1.56).

**For the HTTP transport (run K)** there is no env, but the config's `headers` are sent on every
request. Every request (GET, `initialize`, `server/discover`, `tools/list`, `tools/call`) arrived
with `X-Menkar-Pane: pane-probe-170` and `Authorization: Bearer t0ken`. A per-pane inline
`--mcp-config` can therefore carry the pane and a secret.

## 3. Permission: a prompt unless `--settings` allows it

- **Default mode, auto (D/B, no allow rule):**
  - With `--permission-mode manual`, the call shows the usual card: "Tool use · menkar — Ping
    Tool: (MCP) · Do you want to proceed? 1. Yes / 2. Yes, and don't ask again for menkar — Ping
    commands in ~/work / 3. No".
  - In **auto** mode, the default in 2.1.322, the call goes to the server-side safety check. Through
    my stand-in gateway that check can't be reached, so the session stopped with the "Auto mode's
    safety check runs on the server…" card. I could not measure what the real classifier decides
    for an MCP call.
- **With an allow rule in Menkar's `--settings`, there is no prompt and the call runs**, in both
  auto and manual mode:
  - `"permissions": {"allow": ["mcp__menkar__ping"]}` works (run C, auto).
  - `["mcp__menkar"]` (the whole server) works (run E, manual).
  - `["mcp__menkar__*"]` works (run F, auto).

  `mcp__menkar` is the plain form. The user's settings are not touched, since Menkar's own
  `--settings` file already exists (`writeSessionSettings`, `src/core/context/settings.ts:111`),
  so the rule is one key there.
- **Caveat:** answer "2" on the manual card would make Claude Code write a rule into the project.
  With the allow rule in place that card never shows.

## 4. How the server reaches the running Menkar

- **The single-instance lock is not usable** (`src/main/index.ts:171`, `requestSingleInstanceLock`
  / `second-instance`):
  - Each call would be a full Electron start that ends at once.
  - The data goes one way only: `additionalData`, with no reply.
  - A long-lived stdio process cannot hold the lock or talk through it.
- **So it needs a channel owned by main.** Two measured shapes:
  - **(a) A stdio server per session, plus a local socket owned by main.** The server relays each
    `tools/call` over a Unix socket (a named pipe on Windows), for example under `$XDG_RUNTIME_DIR`
    or the cache dir, with mode 0600, and names its pane from `MENKAR_PANE`.
  - **(b) No extra process: main serves MCP over HTTP on 127.0.0.1.** The URL, the pane header and
    a random per-run token go in a per-pane inline `--mcp-config`. Run K worked end to end with a
    40-line JSON-only server (each POST answered as `application/json`; a GET also arrives and got
    `405` without trouble).

    This is a loopback listener. "The app makes no network connections of its own" is about
    outgoing connections, but a listening port is something the human should decide. Any local
    user could reach the port, so the token is what guards it.
- **What `menkar` runs:** `/usr/bin/menkar` → `/etc/alternatives/menkar` → `/opt/Menkar/menkar`,
  the Electron binary itself. With `ELECTRON_RUN_AS_NODE=1` it runs a script as plain Node; the
  installed build does not disable that fuse, and Menkar's statusline already runs that way
  (`statuslineCommand`, `src/main/context.ts:12`).
  - **Start-up:** `ELECTRON_RUN_AS_NODE=1 /opt/Menkar/menkar v.js` takes **0.06 s** (Node 24.22.2,
    Electron 45.2.3), against 0.02 s for the system Node.
  - **Memory, idle:** my stdio server under it uses **92 MB RSS, of which 16.8 MB is anonymous**;
    the rest is pages of the binary shared between processes. The system Node uses 46 MB RSS and
    7 MB anonymous. So with (a), each session costs about 17 MB of its own.
  - It is fast enough to be an MCP server: Claude Code had it initialized before the first prompt.

## 5. The protocol surface: a hand-written loop is enough

- **The hand-written server handled everything Claude Code sent**:
  - `server/discover` (refused).
  - `initialize`, answered with `protocolVersion` echoed, `capabilities: {tools: {}}` and
    `serverInfo`.
  - `notifications/initialized` (no reply).
  - `tools/list`.
  - `tools/call`: params `{name, arguments, _meta: {"claudecode/toolUseId", progressToken}}`,
    answered with `{content: [{type: "text", text}]}`.
- **The stdio version is about 30 lines; the HTTP JSON-only version about 40.**
- **`@modelcontextprotocol/sdk`:** latest 1.32.2, **MIT**, 4.5 MB unpacked, with 18 runtime
  dependencies (express, hono, @hono/node-server, zod, ajv, jose, cors, eventsource, cross-spawn,
  …). None of them is in `node_modules` today. That is a lot to ship in every installer for two
  tools.
- **Point to watch:** an error result should be `{content, isError: true}`, so the agent sees our
  sentence. I did not exercise that path.

## 6. How main learns a turn is over

- **Today: screen-scraping.** `src/main/agentstate.ts` gives each agent pane a `PaneWatcher`
  (`src/core/agentstate/watch.ts`, `CHECK_DELAY_MS = 250` after each burst of output) over a
  headless mirror. `nextShown` turns that into `working | blocked | idle | done`. The cheapest hook
  is in `track()`'s callback (`agentstate.ts:115`): a pane with a pending renew acts on its first
  transition from `working` to `idle`/`done`.

  It is heuristic, though: herdr's rules, tuned on what the screen shows. And when the tool call
  itself runs, the pane is `working`.
- **Measured alternative: a `Stop` hook in Menkar's `--settings`.** It is exact and carries the
  pane. Run L used `hooks.Stop` → a script.
  - It fired **50 ms after `tools/call`**, once the turn ended. The stand-in answered at once, so
    this is the gap with no model time.
  - Its env had `MENKAR_PANE=pane-probe-170`.
  - Its stdin had `session_id` and `transcript_path`.

  Menkar's `--settings` already holds a SessionStart hook that writes records main watches
  (`<cache>/session-starts/`, `src/main/pane-starts.ts`). A Stop record would be one more record of
  the same kind. Agent-state's `done` could stay as the fallback.

## Not measured

- What the real auto-mode classifier decides for an MCP call with no allow rule.
- The Windows and macOS transports.
- A renew while a subagent or a background task is still running.
- Whether `Stop` also fires on Esc or an interrupted turn.
