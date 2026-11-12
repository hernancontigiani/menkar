# History of `docs/projects.md`

## The layout — `layout.ts`

> Left on 2026-11-10: replay removed from Menkar (decision 1.33).
  orientation), a file tab, or a transient tab (a new session not joined yet, a fork, chat, replay)

## `projects.json` — `store.ts`

> Left on 2026-11-11: a group gained `collapsed` and `leader` (decision 1.54).
  known ones; a group keeps only its three keys. Written whole, indented 2 spaces, non-ASCII as is.

## Projects — the model, the layout, `projects.json`, the first-start import

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
# Projects — the model, the layout, `projects.json`, the first-start import
`projects.json`, and the one-time import of agent-tablet's data. None of it imports Electron;
`src/main/projects.ts` runs the import, loads the projects and answers `projects:get`. The rules
come from `docs/spec/projects.md` and the first-start section of `docs/spec/sessions.md`; this file
keeps how they are built and why.

## The first-start import — `import.ts`

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
## The first-start import — `import.ts`
- **A first start** is one where neither `state.json` nor `projects.json` exists in Menkar's config
  directory. Main runs the import before the first window and before the sessions' first scan
  (which reads `state.json`), so no later write can make a first start look like a second one.
- agent-tablet's `projects.json` and `state.json` are read with `readFile` only, on Linux only, and
  never renamed or moved aside, even when unreadable. A test asserts their bytes and mtimes, and
  that nothing appears in their folder.
- **Read leniently**, unlike Menkar's own file: each good entry is kept, the rest dropped and
  counted in one warning. An unreadable file (not JSON, not an object, or a projects file that is
  not version 1 or has no list) gives a notice key (`import.projectsUnreadable`,
  `import.stateUnreadable`); a missing one is silent. The saved windows and unknown keys are not
  imported. Settings keep their names and meaning when their type is right.
- **Both of Menkar's files are written**, even when nothing was imported. `state.json` goes first;
  if `projects.json` then fails, `state.json` is removed, so a failed write leaves the next start a
  first start again.
- The notices, and an unreadable `projects.json` of Menkar's own, reach the renderer in
  `projects:get` until the window plan shows them.
