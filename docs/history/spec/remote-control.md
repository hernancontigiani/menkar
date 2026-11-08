# History of `docs/spec/remote-control.md`

## Acceptance cases

> Left on 2026-11-08: built by plan 13, described in `docs/files.md` and `docs/sessions.md`.
- **RC-1** Add session → New, Claude Code, name `JWT auth`, switch on, Start session with app-chosen
  id `5e0a…` → `remote_control` in `state.json` contains `5e0a…` immediately; the command contains
  `--remote-control='JWT auth'` before `--settings`.
- **RC-2** Open New again after RC-1 → the switch is off.
- **RC-5** Session `9c1b…` named `billing` in the list, opened → command
  `{cli} --resume 9c1b… --remote-control=billing --settings {settings} && exit`.
- **RC-6** Session not in the list, opened → no `--remote-control` in its command.
- **RC-7** Session in the list with no `custom-title`, no app name, no `ai-title`, first message
  `fix the login bug` → `--remote-control='fix the login bug'`.
- **RC-8** The name computation given a blank name `"  "` and folder `/home/ana/src/shop` → `shop`;
  given a blank name and no folder, id `d4e5f6a7-…` → `d4e5f6a7`.
- **RC-9** Session in the list named `  spaced  ` → `--remote-control=spaced` (trimmed).
- **RC-10** Session named `-x` → the argument is `--remote-control=-x`, one word.
- **RC-13** Row menu of a Claude Code session → the section `Open`, `Open beside the current tab`,
  `Stop`, `Remote control` (check). Row menu of a Cursor session → no `Remote control`.
- **RC-15** Check `Remote control` in the row menu → the tab menu's item for that session is checked
  too, and `state.json` lists the id.
- **RC-16** Running session started without the flag, check `Remote control` → toast
  `Remote control connects when this session restarts, or type /rc in it` for 6 s; nothing typed
  into the terminal; row icon tooltip `Remote control from this session's next start, or type /rc in it`.
- **RC-22** `state.json` with `"remote_control": ["a", 3, null]` → only `a` is on; on the next save
  the list is `["a"]`.
- **RC-23** `state.json` with no `remote_control` key → every session is off.
- **RC-24** Toggling writes `state.json` sorted: turning on `b` then `a` → `["a", "b"]`.
