# Sessions — how they are found, read and named

`src/core/sessions/` finds every Claude Code and Cursor session on the machine, reads what a row
needs, and keeps the list current. `src/main/sessions.ts` gives the list to every window over IPC
(`sessions:list`, `sessions:changed`, `sessions:set-hidden`). The rules come from
`docs/spec/sessions.md`; this file keeps how they are built and why.

## Reading a transcript

- **Discovery** (`scanner.ts`): a Claude session is a non-empty `<lowercase uuid>.jsonl` directly in
  a folder of `~/.claude/projects/`; anything deeper (`subagents/`, `tool-results/`) is not one. A
  Cursor session is a directory under `~/.cursor/projects/<folder>/agent-transcripts/`, read from
  `<id>.jsonl` or else its first `*.jsonl` by name. An agent contributes only when its CLI
  (`claude`, `cursor-agent`) is an executable on the `PATH` (`installed.ts`), checked on every
  scan. The list is newest modification first, ties by id.
- **Three reads per file, each as small as the rule allows:**
  - **Names** (`names.ts`): `custom-title` and `ai-title`, the last of each wins, trimmed. Read
    **incrementally**: the scanner keeps the inode and how far it read, and on each rescan reads
    only the complete lines appended since, in 4 MiB slices so a first read never holds a large
    file whole. A last line without its newline waits for the next read. A file that shrank or
    was replaced (another inode) is read from the start. Lines without `-title"` are not parsed.
  - **Head** (`head.ts`): within the first 50 lines and 256 KiB, the first `cwd` and the preview
    (the first typed user message, not starting with `<`, whitespace collapsed, 120 characters).
    It is read again until both are found or the window is full, then never again for that file.
  - **Tail** (`badges.ts`): the last 64 KiB, re-read when the size or mtime changes, for the
    waiting / interrupted badge. A tail that starts mid-file drops its first, cut line.
- **A session's name** (`sessionName`): Claude's name, then the app's name (`state.json` `names`),
  then Claude's generated title, then the preview, then the id's first 8 characters. Cursor has no
  Claude names. `claudeNamed` tells the UI that Rename must refuse.
- **Cursor's folder → cwd** (`cursor.ts`): rebuilt against the filesystem, taking at each level the
  longest run of dash-joined parts that names an existing directory; the rest joined by `/` when
  none exists.
- **Read only**: transcripts are opened with `'r'` and never written; a test asserts that a scan and
  a rescan leave every transcript's bytes and mtime unchanged.

## Keeping it current

- **Watches** (`service.ts`): non-recursive `fs.watch` on `~/.claude/projects/` and each folder in
  it, and on `~/.cursor/projects/`, each folder in it and each `agent-transcripts/` in those. They
  are set again after every scan, so a folder created later is watched too. Not recursive:
  a running session's `subagents/` and `tool-results/` change constantly and hold no session.
  A projects directory that does not exist when a scan runs is not watched until a later scan
  finds it (the refresh, or an event elsewhere).
- **Debounce and coalescing** (`Coalescer`): an event starts a 2000 ms quiet period; a request
  while a scan runs schedules exactly one more scan after it. agent-tablet dropped that request and
  could miss a change until the next event.
- **Off the UI path**: all I/O is async. Measured 2026-11-08 on a generated tree of 400 transcripts,
  2 GB (never the human's files): a first scan took 1.7 s; the longest event-loop stall was about
  8 ms. A rescan with nothing changed took 11 ms. No worker thread is needed.
- **One service for every window**: main pushes the whole list to every window after each scan and
  after each change to the hidden set.

## Menkar's `state.json`

`src/core/state.ts` reads and writes the sessions' keys, `names` (id → name; a cleared name
removes the key) and `hidden` (sorted, unique). Every other key is carried through untouched, so a
later area's settings survive a save. It is written whole through `jsonstate`.

**Only a user action writes it** (hiding a session). Reading never creates it, because a start
without `state.json` and `projects.json` is the first start that imports agent-tablet's data.

## Formats

`src/core/format.ts`: sizes (`B`, then `KB`/`MB`/`GB` in 1024 steps with one decimal, GB the
last), token counts (`k`, `M`), and timestamps (local `YYYY-MM-DD HH:MM`; one that does not parse
is shown as written; none is `—`).

## On screen

- **Add session** (`src/renderer/addsession.ts`) builds the history browser from
  `src/core/sessions/history.ts`: groups by folder name, the search, the count line, relative times
  and recent folders, all pure and tested. A group starts collapsed and keeps its state while the
  dialog lives. Picking calls the layout's `moveSessionHere`: the session's tab comes with it
  across windows; a pane alone leaves a two-pane tab. New skips to the name step when the
  remembered folder still exists. The advanced dialog carries model, permission mode and an extra
  folder to the start.
- **Details, export and replay** read the whole transcript in main and use
  `src/core/sessions/transcript.ts`. Details' Tokens row is left out until it can come from the
  usage module, as the spec asks.
- **Trash and delete** are the only writes under `~/.claude`, each confirmed in the renderer. Only
  the `.jsonl` goes; its sibling directory stays. An e2e asserts every other file under `~/.claude`
  keeps its bytes and mtime.

## Remote Control, and the details' tokens

- **Remote Control** is `remote_control` in `state.json` (`src/core/remote.ts`: sorted, strings
  only), written through the sessions service. A Claude Code resume of a session in the list
  carries `--remote-control=<name>` before `--settings`. The name is the display name trimmed,
  else the folder's name, else the id's first 8 characters. New's switch (off every time the page
  opens) adds the new id **before** the start.
- Forks and Continue last never carry it. Nothing is ever typed into a running session: turning it
  on while the session runs without the flag shows the 6 s toast; the session connects at its
  next start or when the user types `/rc`.
- **What the phone shows** (decision 1.18, 2026-11-09): whether a Remote Control bridge is
  connected **now** for the session's running process, however it was turned on (New's switch, the
  menu, or `/remote-control` typed in the session). The switch in the menus and on New keeps its
  meaning: what Menkar does when it starts the session.
  - **The source** is Claude Code's per-process registry, `~/.claude/sessions/<pid>.json`, read
    only. Its shape, as of Claude Code 2.1.319: `{"pid":…, "sessionId":"…", "procStart":"…",
    "status":"idle", …, "bridgeSessionId":"session_…"}`. `bridgeSessionId` is a string while a
    bridge is connected, `null` after a disconnect, and absent in a process that never had one.
  - **How it is read** (`src/core/remote/live.ts`, `src/main/remote-live.ts`): the agent is found
    as the descendant of the pane's shell named `claude` (or a `node …/claude` script), by
    `/proc/<pid>/task/*/children` and `cmdline`; its file must match its pid, its session (once
    the pane knows it) and its start time (`/proc/<pid>/stat`, field 22), so a reused pid is not
    taken for it. The folder is watched (250 ms debounce) and polled every 5 s, since a watch can
    miss events; the result rides on the agent-state push, `remoteLive` per pane.
  - **The fallback**: the format is undocumented, so a missing or unreadable file, an unexpected
    shape, or a pid that does not match reads as *unknown*, never as off. Then a running session
    in Menkar's list, or one started with the flag, keeps the phone with the tooltip "Remote
    Control on at start (state unknown)". A malformed file is logged once per pid.
  - A session with no running pane shows no phone; its setting stays in the menu's switch. The
    phone is the same outline in the row (after the state dot) and on the tab (before its name),
    in the dimmed text color (decision 1.19).
  - **Rejected sources**: the transcript records each connect (`bridge_status`) but never a
    disconnect, and a resume reconnects without writing one; `replBridgePlaceholders` in
    `~/.claude.json` is keyed by bridge, not session, capped and swept later; the statusline's
    input has no bridge field (its `remote` is the remote *mode*); no hook concerns the bridge;
    `argv` shows only the flag.
- The details' **Tokens** row comes from the usage history, `sessionTokens()` in
  `src/main/usage.ts` (deduplicated, subagents counted for their parent), shown when any count is
  above 0.
