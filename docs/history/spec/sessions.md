# History of `docs/spec/sessions.md`

## Discovery (F1)

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
- On start the app scans every **installed** agent's transcripts off the UI path. An agent is
  installed when its CLI is on the `PATH`: `claude` for Claude Code, `cursor-agent` for Cursor. An
  agent that is not installed contributes no sessions, even if its transcripts are on disk.
- **Claude Code**: every file `~/.claude/projects/<folder>/<id>.jsonl` where `<id>` is a lowercase
  UUID (`8-4-4-4-12` hex digits) and the file is not empty. Files with other names, and anything
  deeper (`<id>/subagents/…`, `<id>/tool-results/…`, `memory/`), are not sessions.
- **Cursor**: every directory `~/.cursor/projects/<folder>/agent-transcripts/<id>/`; its transcript
  is `<id>/<id>.jsonl`, else the first `*.jsonl` in that directory; an empty file, or a directory
  with no `.jsonl`, is skipped. The session's id is the directory's name.
- For each session the scan reads: its folder (`cwd`), a preview (the first message the user
  typed), the transcript's modification time ("last active") and size, its tail state (waiting /
  interrupted, F3) and, for Claude, its names (F2). All sessions of all agents form one list, newest
  modification time first.
- **Live updates.** The app watches, for Claude, `~/.claude/projects/` and each folder directly
  inside it; for Cursor, `~/.cursor/projects/`, each folder inside it and each `agent-transcripts/`
  inside those. Any change starts a **2000 ms** debounce; when it ends the whole list is rescanned.
  The watches are set again after every scan, so a folder Claude creates later is watched too.
- One scan and one set of watches serve every window.

## A session's name (F2)

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
- The name shown everywhere (history row, project list row, tab title, dialogs) is the first that
  is not empty of:
  1. **Claude's name**: the `customTitle` of the **last** `custom-title` line in the transcript
     (written by `claude -n <name>` at start and by `/rename` inside the session);
  2. **the app's name** for the session, set with Rename (kept in Menkar's `state.json`, `names`);
  3. **Claude's generated title**: the `aiTitle` of the last `ai-title` line;
  4. the **preview** (the first typed message, see Data contracts);
  5. the first 8 characters of the session id.
- Names are read incrementally: per transcript the app keeps how far it read; each rescan reads
  only the complete lines appended since. A file that became shorter is read again from the start.
  A last line without its newline is left for the next read.
- Cursor sessions have no Claude name nor generated title: their name is the app's, else the
  preview, else the id's first 8 characters.

## Waiting and interrupted badges (F3)

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
- From the last **64 KiB** of the transcript, line by line in order, considering only lines whose
  message has text (a string content, or the `text` blocks of a list, joined):
  - text containing `[Request interrupted by user` → the latest event is *interrupted* (any line
    type);
  - else a Claude `assistant` line → the latest event is *assistant*, and its text is kept;
  - else a Claude `user` line whose trimmed text does not start with `<` → *user*.
- **Interrupted** when the latest event is *interrupted*; **waiting** when it is *assistant* and
  that text, right-trimmed, ends with `?`; otherwise no badge. Cursor: the same with `role`
  instead of `type`, the user's text stripped of `<user_query>` tags, and never *interrupted*.

## Paths

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
**Cursor's folder → `cwd`.** The encoding loses where the `-` were, so the `cwd` is rebuilt against
the real filesystem: from `/`, take the longest run of the remaining dash-separated parts that,
joined by `-`, names an existing directory under the path built so far; descend into it and repeat.
When no run exists, the rest of the parts are joined by `/`. Example: `home-demo-my-app` with
`/home/demo/my-app` on disk → `/home/demo/my-app`; with nothing on disk → `/home/demo/my/app`.

## Formats shown

> Left on 2026-11-08: built by plan 05, described in `docs/sessions.md`.
| Value | Format |
|---|---|
| Size | under 1024: "{n} B" (no decimals); then "{x.x} KB", "{x.x} MB", "{x.x} GB" (1024 steps, one decimal, GB the last unit) |
| Tokens | ≥ 1,000,000: "{x.x}M"; ≥ 1,000: "{x.x}k"; else the number |
| Timestamp | local time `YYYY-MM-DD HH:MM`; a value that does not parse is shown as written; none is "—" |

## Acceptance cases

> Left on 2026-11-08: built by plan 05; the Vitest tests carry these ids.
- **SES-1** `claude` on the `PATH`; `~/.claude/projects/-home-demo-api/` holds
  `1b4e28ba-2fa1-11d2-883f-0016d3cca427.jsonl` (2 KB), `notes.jsonl`, an empty
  `9c2d…-uuid.jsonl` and `1b4e…427/subagents/agent-a1.jsonl` → exactly one session, id
  `1b4e28ba-2fa1-11d2-883f-0016d3cca427`.
- **SES-3** A new transcript appears in a watched folder → it is listed within 2 s plus one scan;
  ten files written within one second cause one rescan, not ten.
- **SES-4** A new folder `-home-demo-new` is created under `~/.claude/projects/` and a transcript
  written in it → listed; a second transcript written there later is also picked up (the folder is
  watched after the scan that found it).
- **SES-5** A file event arrives while a scan runs → another scan follows it, and the change shows.
- **SES-6** Cursor: `~/.cursor/projects/home-demo-my-app/agent-transcripts/abc/abc.jsonl` with
  `/home/demo/my-app` existing → a Cursor session id `abc`, folder `/home/demo/my-app`; with no
  such directory on disk → folder `/home/demo/my/app`.
- **SES-7** Cursor session directory `xyz/` containing only `other.jsonl` (non-empty) → session
  `xyz` read from `other.jsonl`; a directory with no `.jsonl` → no session.
- **SES-8** Transcript with `custom-title` "alpha", later `custom-title` "beta", and `ai-title`
  "Fix login" → the name is "beta".
- **SES-9** No `custom-title`; app name "Mine"; `ai-title` "Fix login" → "Mine". App name cleared →
  "Fix login".
- **SES-10** No titles, no app name, first `user` line text `<command-name>/clear</command-name>`,
  second `user` line "  fix   the\nlogin bug " → name and preview "fix the login bug".
- **SES-11** No titles, no typed message, id `1b4e28ba-…` → name "1b4e28ba".
- **SES-12** A first typed message of 300 characters → preview is its first 120 characters.
- **SES-14** `/rename gamma` appends `custom-title` "gamma" to a 40 MB transcript → after the next
  rescan the name is "gamma", and that rescan read only the appended bytes.
- **SES-15** The last line of a transcript is a `custom-title` without its newline → not applied;
  once the newline is written, applied on the next rescan.
- **SES-19** Last text-bearing line: an `assistant` line "Should I also update the tests?" → waiting
  badge with tooltip "Claude is waiting for your reply".
- **SES-20** An `assistant` question followed by a `user` line "yes" → no badge.
- **SES-21** Last text-bearing line: a `user` line "[Request interrupted by user]" → interrupted
  badge, tooltip "You interrupted Claude here".
- **SES-22** An `assistant` question followed only by `user` lines holding `tool_result` blocks →
  waiting (tool results carry no text).
