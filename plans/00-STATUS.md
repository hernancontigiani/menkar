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
| 1.12 | Menkar's logo is an eight-pointed star (four long points, four short), one color, near white (`build/icons/menkar.svg`); the launcher icon sets it on a dark rounded tile; the empty window shows the same star instead of agent-tablet's folder illustration | 2026-11-08 | `build/icons/` |
| 1.13 | The Usage window's By-day axis: 7 days labels every bar with weekday and day ("Mon 2" / "lun 2"); 30 days and Month label the first bar, then every 1, 2, 3, 7 or 14 days, the smallest stride whose labels fit the plot's width; dates through `Intl` in the app's language | 2026-11-08 | `docs/usage.md` |
| 1.14 | The By-day axis top is the first multiple of a 1/2/2.5/5 × 10ⁿ step at or above the tallest bar (at most five intervals; time stepped in the unit shown), for Exec, Tokens and Cost alike; the Usage views fill the window | 2026-11-08 | `docs/usage.md` |
| 1.15 | The Usage window opens scoped to the project of the window it was opened from, with an "All projects" toggle; scoped, By day stacks by category when the classifier is on and is a plain bar otherwise; an empty project stays scoped | 2026-11-08 | `docs/usage.md` |
| 1.16 | Usage data for analysis goes out through the CLI (`menkar usage export`, JSONL or CSV, one row per turn, tokens and cost per model; no prompt text); no MCP server for now; time is per turn, never split by model | 2026-11-08 | plan 17 |
| 1.17 | agent-tablet is deprecated and may be deleted: Menkar stops depending on it or naming it. 0.1.0 keeps what the switch needs (the first-start import, the release checklist's comparisons, the credit line); after 0.1.0 is accepted, every other mention goes — code comments, docs, the spec's references, tests' wording — and new text never names it | 2026-11-09 | this row |

## 2. Open

| # | Question | Owner | Blocks |
|---|---|---|---|
| 2.1 | The shell of Menkar's terminals on Windows: Git Bash (recommended), PowerShell as fallback, or WSL | Human | Windows |
| 2.2 | The human's check of the 0.1.0 release candidate: `docs/release-checklist.md`, in order (install, first start with the import, a day of work, Usage, the classifier, notifications, Remote Control, the preview, the screenshots, remove) | Human | Calling 0.1.0 the first version |
| 2.3 | The human's check of the window: use Menkar for a day of work — open your projects, start and resume sessions, close and reopen | Human | Trusting the window for daily use |
| 2.4 | The human's check of Remote Control: turn it on for a session (New's switch or its menu), start it, and drive it from the phone or claude.ai | Human | Trusting Remote Control |
| 2.5 | The human's check of notifications (PRF-19): with an agent in a tab you are not watching, let it finish — a desktop notification and the completion sound; turn "Notify about background agents" off — no notification; turn "Play a sound" off — no sound | Human | Trusting the notifications |
| 2.6 | The human's check of LOOK-5: with the window unfocused, the header and the tab strip keep their colors (no fade) | Human | Trusting the look on a real desktop |
| 2.7 | The human's check of LOOK-22 and LOOK-29 with real agents: a session blocked in another project puts a red count beside the project's name (none when none is); a working tab shows the yellow dot, an idle one none | Human | Trusting the states on screen |
| 2.8 | The human's check of TRM-15: New session (advanced)…, cancel the folder chooser — no dialog, no tab, the remembered folder unchanged | Human | Trusting the native chooser |
| 2.9 | The human's check of SES-64, SES-66, SES-68 with the desktop's trash: Cancel leaves the file; Move to Trash puts the `.jsonl` in the trash, keeps `<id>/subagents/`, removes the row and closes a running tab of it; a transcript in a folder you cannot write says "Could not trash transcript"; trashing three with one failing trashes two and shows one error | Human | Trusting the trash |
| 2.10 | The human's check of FIL-34: with Menkar closed and two windows saved, `menkar open x.md` reopens both windows, then asks "Open in which window?" | Human | Trusting `menkar open` from a terminal |
| 2.11 | The human's check of AST-28: click the desktop notification of a session whose tab is in another window, in a project not shown there — that window comes forward, shows the project, the tab selected | Human | Trusting the notifications |
| 2.12 | The human's check of AST-38 with real agents: `Ctrl+B g` lists every tab with its project and state across windows; typing "blocked" keeps only the blocked one; Enter brings its window forward with the tab selected | Human | Trusting Go to agent |
| 2.13 | After 0.1.0 is accepted: which of the three agent-tablet mentions 0.1.0 keeps also go — the first-start import (1.8), the credit in the README and About (1.10), the checklist's comparisons — then a plan removes the rest (1.17) | Human | Removing agent-tablet |
| 2.14 | The human's check of the frameless main window (LOOK-55–58) on a real desktop: drag the header to move the window; double-click the header's empty space to maximize, again to restore (once each, not twice); the minimize, maximize and close buttons at the header's right; resize from every edge and corner; snap to the screen's edges and corners; Preferences, Usage, About and MCP keep the system's frame, and no window has a menu bar | Human | Trusting the window's frame |

## 3. Roadmap and plans in flight

| Order | Plan | State |
|---|---|---|

## 4. Next plan number

The highest `NN` in `plans/` plus one, taken by creating the empty file. A delivered plan's number
is never reused (`git log --all -- 'plans/NN-*'` shows the ones already taken).

## 5. Closing a plan

Its row leaves §3, and its closing note goes to `docs/history/plans/00-STATUS.md`. What it left
open enters §2 in one line; what it decided goes to the document that owns it.
