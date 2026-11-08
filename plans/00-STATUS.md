# Status — what is decided, what is open, what is in flight

> **The index of the whole design, kept current by every session.** Read it **before** designing or
> building anything. It does not explain decisions: it says where each one is explained. A decision
> recorded here is not re-litigated without saying so explicitly.
>
> **A live index, 300 lines at most.** Written as **current state with a date**; what stops being
> current leaves for `docs/history/plans/00-STATUS.md` in the same change, verbatim.
>
> Last updated: 2026-11-08.

## 1. Decided

| # | Decision | Date | Where it lives |
|---|---|---|---|
| 1.1 | Menkar is agent-tablet's multiplatform successor, a new repository, GPL-3.0-or-later, written from scratch from agent-tablet's documents and behaviour, with all its features and a look as close as possible to its current one | 2026-11-08 | `CLAUDE.md` · `README.md` |
| 1.2 | Electron with TypeScript for the whole app, back end and UI; xterm.js on node-pty; validated against Claude Code 2.1.319 on Ubuntu in agent-tablet's plan 11 (its results are in agent-tablet's `docs/NOT_BUILT_YET.md`, "Running natively on Windows and macOS") | 2026-11-08 | `CLAUDE.md` |
| 1.3 | Ubuntu first: the first finished version is Linux; Windows and macOS follow on the same code | 2026-11-08 | this row |
| 1.4 | Everything in the repository is in English; the conversation may be Spanish | 2026-11-08 | `CLAUDE.md` |
| 1.5 | `set` designs, reviews and commits; `b1` and `b2` execute; no hosted CI, `npm run ci` is the gate | 2026-11-08 | `CLAUDE.md` |
| 1.6 | Toolchain: Node 22, npm, TypeScript strict, Biome, Vitest, Playwright on the real Electron app under `xvfb-run`, electron-vite to build, electron-builder to package | 2026-11-08 | plan 01 |
| 1.7 | Not carried over from agent-tablet: the question card over the terminal (answers are given in the terminal itself, so nothing is typed into an agent on the user's behalf) | 2026-11-08 | `CLAUDE.md` · `docs/spec/` |
| 1.8 | On its first start Menkar imports agent-tablet's own data, read only: `projects.json` (projects, groups, members), `state.json` (settings, hidden sessions, the Remote control list) and the usage history (`history.sqlite`); agent-tablet's files are never written | 2026-11-08 | `docs/spec/` |
| 1.9 | Closing a running agent (close tab, Stop, close window, quit, after the confirmations) hangs up its pty as closing a terminal does (SIGHUP); nothing is typed into it, not even `/exit`, and a turn in progress is cut | 2026-11-08 | `docs/spec/README.md` |
| 1.10 | Decided by `set` after the spec (technical, within the rules): the agent-tablet import also takes `usage.jsonl`; integrations' record and settings backups live in the data directory (no fourth one); `unknown` turns show their own category; menus keep the sans font; the Classic style's terminal uses xterm.js colors close to VTE's defaults; About carries the human's copyright and one credit line to agent-tablet and Agent Session Manager; "Restart now" asks and saves like quitting | 2026-11-08 | `docs/spec/README.md` |
| 1.11 | The interface is in English and Spanish, both kept complete: `check-i18n` fails on a key Spanish lacks, so a new string is translated in the same change. agent-tablet's German, French and Hungarian are not carried over | 2026-11-08 | `docs/foundations.md` · `docs/NOT_BUILT_YET.md` |

## 2. Open

| # | Question | Owner | Blocks |
|---|---|---|---|
| 2.1 | The shell of Menkar's terminals on Windows: Git Bash (recommended), PowerShell as fallback, or WSL | Human | Windows |
| 2.2 | The human's check of the package: install the `.deb` (`sudo apt install ./release/menkar_0.0.0_amd64.deb`), start Menkar from the launcher, and see a terminal in it | Human | Trusting the sandbox on the installed app |

## 3. Roadmap and plans in flight

| Order | Plan | State |
|---|---|---|
| 5 | `09-state-and-context.md` (agent state from the terminal, counts, notifications; the context ring's data, the statusline script, `--settings`, the integrations) | Written 2026-11-08; `b2` |
| 5 | `08-window.md` (the main window: look and themes, the project view, tabs with terminals that start, resume and close sessions, notices) | Written 2026-11-08; `b1` |
| 4 | The features, designed by `set` from `docs/spec/` once plans 01 and 02 are delivered: the window, tabs and terminals; projects and windows; agent state, notifications, switcher and keys; preferences, themes, i18n; context ring, statusline and integrations; the Usage window; the classifier; file tabs; remote control; packaging for Ubuntu | Not designed yet |

## 4. Next plan number

The highest `NN` in `plans/` plus one, taken by creating the empty file. A delivered plan's number
is never reused (`git log --all -- 'plans/NN-*'` shows the ones already taken).

## 5. Closing a plan

Its row leaves §3, and its closing note goes to `docs/history/plans/00-STATUS.md`. What it left
open enters §2 in one line; what it decided goes to the document that owns it.
