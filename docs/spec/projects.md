# Projects, tabs and windows

What the app opens on and where each session runs: projects (a name and the sessions the user put
in it, from any folder), groups inside a project, the tabs of the project a window shows (each of
one or two panes, or one file), several windows, the layout saved in `projects.json` and reopened on
start, and quitting. It holds agent-tablet's decisions 1.13, 1.15–1.19. Index rows: **F5** (the
cross-window move; the dialog itself is in `sessions.md`), **F20** (what a tab's panes mean for a
project and the saved orientation; the panes themselves are in `terminal.md`), **F21–F28**, **F29**
(the sidebar width; its look is in `look.md`); keys **K4–K8, K12, K29–K31, K33, K34**; menu items
**M12, M13, M16, M18, M19, M22–M25, M32**.

The invariants every case below holds (Menkar `CLAUDE.md`, product rules): **a session belongs to
one project at most, runs if and only if it has a tab, and is in at most one tab across every
window; a project is open in at most one window.** Where agent-tablet's code breaks one of them,
the case says so and gives the behaviour that keeps it.

## Behaviour

### The model

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### The project dropdown (F21)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### The project's session list

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### The session row's menu (M18, M19, M22–M25, M32)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### Membership (F23, F5)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### Tabs (F24)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### Several windows (F25, 1.18)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### Quitting (F27)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### Reopening on start (F26)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### An unreadable projects file (F28)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### The sidebar (F29)

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

## Data contracts

### Files

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

### `projects.json`, version 1

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.

## Acceptance cases

Every case is built and tested; `e2e/projects.spec.ts`, `e2e/window.spec.ts` and
`tests/core/projects/` carry the ids.

Decided against: PRJ-1's "no file exists until the first change" — the first start's import writes
both of Menkar's files at once, so that the next start is not a first start (`docs/projects.md`).

## Look

- Built and tested: `docs/projects.md` describes how; `src/core/projects/` and `src/main/workspace.ts` hold it.
