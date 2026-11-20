# History of `plans/00-STATUS.md`

## 3. Roadmap and plans in flight

> Left §3 on 2026-11-08: plan 01 closed.
| 1 | `01-scaffold.md` (the Electron + TypeScript skeleton, the toolchain, `npm run ci`, `npm run ui-check`) | Written 2026-11-08; `b1` |

> Closed 2026-11-08 — plan 01, "The skeleton and the toolchain", built by `b1`.
> Built the three layers (`src/core` without Electron or DOM, `src/main`, `src/renderer` behind a
> typed preload and `src/shared/ipc.ts`), one window with an xterm.js terminal on node-pty, the clock
> and paths modules, `npm run ci` (Biome, `tsc` per layer, Vitest, code rules, test integrity, the
> flaky quarantine, the history check ported to Node) and `npm run ui-check` (Playwright on the real
> app under `xvfb-run`). Deviation: TypeScript 6, since 7's compiler API is unstable and two checks
> use it. How to build and run is in `README.md`; the tools' why-nots in `docs/toolchain.md`.

> Left §3 on 2026-11-08: plan 03 closed.
| 2 | `03-foundations.md` (logging, JSON state, i18n and its check, SQLite) | Written 2026-11-08; `b1` |

> Closed 2026-11-08 — plan 03, "Foundations", built by `b1`: `log.ts`, `jsonstate.ts` (written
> whole, a broken file moved aside), `i18n.ts` with `en` and `es` and `check-i18n` in `npm run ci`,
> `db.ts` on `node:sqlite` (works in Vitest on Node 22 and in Electron 45's main; no native module).
> Found and fixed: under a Wayland session Electron ignored xvfb's display, so e2e forces X11 and a
> test asserts it. Their why-nots are in `docs/foundations.md`.

> Left §3 on 2026-11-08: plans 02 and 04 closed.
| 1 | `02-spec.md` (agent-tablet's behaviour and look, feature by feature, in `docs/spec/`) | Written 2026-11-08; `b2` |
| 2 | `04-ubuntu-package.md` (the `.deb` with Chromium's sandbox, `menkar` command and launcher; Electron's data in the cache) | Written 2026-11-08; `b1` |

> Closed 2026-11-08 — plan 02, "agent-tablet's behaviour and look", built by `b2`: `docs/spec/`,
> an index of 58 features (every shortcut and menu item counted against the code) and twelve area
> files with 589 acceptance cases and 22 views in both themes; 13 deferred entries carried into
> `docs/NOT_BUILT_YET.md`. Open points it raised were decided in §1 1.9 and 1.10. The Integrations,
> Preferences and Markdown-preview screenshots are Broadway's and need retaking on a real display.

> Closed 2026-11-08 — plan 04, "The Ubuntu package", built by `b1`: a `.deb` with the launcher, the
> `menkar` command and an AppArmor userns profile (the premise of a setuid `chrome-sandbox` was wrong
> on 24.04: electron-builder's postinst sets 0755 and installs the profile, as Ubuntu does for VS
> Code); `package:check` and `package:smoke`; Electron's userData under the cache. Left open: the
> human's install check (§2 2.2). How it is built is in `docs/packaging.md`.

> Left §3 on 2026-11-08: plans 05 and 06 took the first two features.
| 2 | The features, designed by `set` from `docs/spec/` once plans 01 and 02 are delivered: sessions and transcripts; the window, tabs and terminals; projects and windows; agent state, notifications, switcher and keys; preferences, themes, i18n; context ring, statusline and integrations; usage history and window; the classifier; file tabs; remote control; packaging for Ubuntu | Not designed yet |

> Left §3 on 2026-11-08: plan 05 closed.
| 3 | `05-sessions-core.md` (discovery, names, badges, hidden; watched; IPC) | Written 2026-11-08; `b1` |

> Closed 2026-11-08 — plan 05, "Sessions in core", built by `b1`: discovery of Claude Code and
> Cursor sessions read incrementally, names, badges, the hidden set, a coalescing watcher in `core`,
> and the `sessions:*` IPC; a generated 2 GB tree scanned in 1.7 s with no stall over 8 ms. Found:
> the agent-tablet import must land before the first UI that writes `state.json` (plan 07 does it),
> and a projects directory created after start was not watched (plan 07 too). In `docs/sessions.md`.

> Left §3 on 2026-11-08: plans 06 and 07 closed.
| 3 | `06-usage-core.md` (turns, tokens, cost, the history, `menkar usage`, the agent-tablet import) | Written 2026-11-08; `b2` |
| 3 | `07-projects-core.md` (projects, groups, membership, the layout model, `projects.json`, the agent-tablet import of projects and state) | Written 2026-11-08; `b1` |

> Closed 2026-11-08 — plan 06, "Usage in core", built by `b2`: turns, time, tokens, cost, the cache
> and history with passes on a worker thread, `menkar usage`, the import of agent-tablet's history
> and `usage.jsonl`; on generated data its monthly report was byte-identical to agent-tablet's. In
> `docs/usage.md`.

> Closed 2026-11-08 — plan 07, "Projects in core", built by `b1`: the model, membership, the layout
> model, `projects.json`, the first-start import of agent-tablet's projects and state before any
> window, and a projects directory that appears after start. In `docs/projects.md`. Cases that need
> the window are listed in its log for plan 08.

> Left §3 on 2026-11-08: plan 09 built, waiting to be committed with plan 08.
| 5 | `09-state-and-context.md` (agent state from the terminal, counts, notifications; the context ring's data, the statusline script, `--settings`, the integrations) | Written 2026-11-08; `b2` |

> Left §3 on 2026-11-08: plans 08 and 09 closed; plan 10 waits on its evaluation run.
| 5 | `08-window.md` (the main window: look and themes, the project view, tabs with terminals that start, resume and close sessions, notices) | Written 2026-11-08; `b1` |
| 5 | `09-state-and-context.md` (agent state from the terminal, counts, notifications; the context ring's data, the statusline script, `--settings`, the integrations) | Built 2026-11-08 by `b2`; to commit with plan 08 |
| 6 | `10-classifier-core.md` (the opt-in classification: hourly pass, earlier turns, the evaluation; no widgets) | Written 2026-11-08; `b2` |

> Closed 2026-11-08 — plan 08, "The main window", built by `b1`: the look in both styles and schemes
> with every theme, the project view, tabs with live sessions started, resumed, forked and continued
> with agent-tablet's command lines, closing by hang-up (1.9), several windows, quitting and
> reopening. Found: node-pty reports argv[0] as the process, so "running" compares base names; a quit
> could cut a `projects.json` write short, now awaited. A Menkar window opened twice on the human's
> screen during development; e2e now refuse to run outside `xvfb-run`. In `docs/window.md`.

> Closed 2026-11-08 — plan 09, "Agent state and context", built by `b2`: states from a headless mirror
> per agent pane, roll-up, counts, notifications and sound; the statusline in Node run by Electron's
> binary from inside `app.asar`; `--settings`; the context reading; the integrations' logic. Found: a
> watcher kept the app from quitting (now `unref`'d). In `docs/agent-state.md` and `docs/context.md`.

> Left §3 on 2026-11-08: plan 10 closed.
| 6 | `10-classifier-core.md` (the opt-in classification: hourly pass, earlier turns, the evaluation; no widgets) | Built and committed 2026-11-08; closes when its evaluation run is logged |

> Closed 2026-11-08 — plan 10, "The classifier in core", built by `b2`: the hourly pass, earlier turns
> with estimate, progress and stop, inheritance, the runner's lock, and `scripts/classify-eval.mjs`.
> The evaluation on the human's 141 labelled turns (6 Haiku calls, the human's OK): 72% on the 50,
> 63% on the 141, against agent-tablet's 74% / 66% with the same prompt — within one rerun's spread;
> `other` stays the weakest category. In `docs/classifier.md`.

> Left §3 on 2026-11-08: plan 11 closed.
| 7 | `11-keys-panes-sessions-ui.md` (the `Ctrl+B` keys, split panes, the switcher, the ⚙ menu; Add session and the session menus) | Written 2026-11-08; `b1` |

> Closed 2026-11-08 — plan 11, "Keys, panes, the switcher; Add session and the session menus", built
> by `b1`. Left for later plans: the Remote control switch on New, MCP servers, the details' Tokens
> row from the usage module, Open in Ghostty and Continue in chat; trash is not exercised in e2e (it
> needs the desktop's trash service). In `docs/window.md` and `docs/sessions.md`.

> Left §3 on 2026-11-08: plan 12 built, waiting to be committed with plan 13.
| 7 | `12-preferences-usage-window.md` (Preferences, Integrations, About; the Usage window) | Written 2026-11-08; `b2` |

> Left §3 on 2026-11-08: plans 12, 13 and 14 closed.
| 7 | `12-preferences-usage-window.md` (Preferences, Integrations, About; the Usage window) | Built 2026-11-08 by `b2`; to commit with plan 13 |
| 8 | `13-files-remote-control.md` (file tabs, the Markdown preview, `menkar open`; Remote Control; the details' Tokens row) | Built 2026-11-08 by `b1`; to commit with plans 12 and 14 |
| 8 | `14-chat-mcp-ghostty.md` (chat tabs with the permission card, the MCP servers browser, Open in Ghostty) | Written 2026-11-08; `b2` |

> Closed 2026-11-08 — plan 12, "Preferences and the Usage window", built by `b2`: Preferences
> (General, themes, languages, Restart now through `quitApp`), Integrations, About, the Usage window.
> Found: the usage passes ran with no memberships, so every turn would have been "(no project)". In
> `docs/preferences.md` and `docs/usage.md`.

> Closed 2026-11-08 — plan 13, "Files and Remote Control", built by `b1`: file tabs, the Markdown
> preview, `menkar open`, Remote Control per session, the details' tokens. Found: every state push
> took the focus from an editor or terminal; an edit's echo lost keystrokes. Cases left untested go to
> plan 15. In `docs/files.md` and `docs/sessions.md`.

> Closed 2026-11-08 — plan 14, "Chat, MCP servers, Ghostty", built by `b2`: chat tabs with Claude's
> permission card and Cursor's two variants, Continue in chat, the MCP browser, Open in Ghostty; CTX-22
> no longer races the clock. In `docs/chat.md`.

> Replaced 2026-11-08 by the 0.1.0 release checklist (plan 16): §2 row 2.2 was
| 2.2 | The human's check of the package: install the `.deb` (`sudo apt install ./release/menkar_0.0.0_amd64.deb`), start Menkar from the launcher, and see a terminal in it | Human | Trusting the sandbox on the installed app |

| 9 | `16-spec-closure-b2-release.md` (every remaining case of `b2`'s spec areas closed; Menkar 0.1.0 as a release candidate for Ubuntu, with the human's checklist) | Written 2026-11-08; `b2` |

> Closed 2026-11-08 — plan 16, "Spec closure in `b2`'s areas and the 0.1.0 release candidate", built
> by `b2`: every case of usage, classifier, context, preferences and chat tested, checked by hand
> (PRF-19, §2) or decided against (CHT-7); `latestOnly` for answers that arrive out of order; the
> `.deb` 0.1.0 with `docs/release-checklist.md`; then, by the human's decisions 1.13–1.15, the
> Usage window filling its window, the By-day axis and labels, and its scope to the opener's
> project. Found: cards square in Terminal workspace, the footer's spaces collapsed, the chat look
> off its table, PRF-24's relaunch test blind to the packaged build. In `docs/usage.md`,
> `docs/packaging.md` and `docs/release-checklist.md`.

| 10 | `17-usage-export-models.md` (tokens and cost by model in the report and the window; `menkar usage export` for an LLM session to analyse) | Written 2026-11-08; `b2`, after 16 |

> Closed 2026-11-08 — plan 17, "Usage by model, and an export an LLM session can analyse", built
> by `b2`: tokens and list-price cost by model in every report node, `--json` and the window's
> Model stack (Tokens and Cost only: time is per turn, decision 1.16); `menkar usage export`, one
> JSONL or CSV row per turn, whole, with exact cost attributed turn by turn so the rows add up to
> the report. Found: an exact session's cost cannot split by model (per-model cost is the list
> price); an unknown `--project` listed comma-joined names, ambiguous with a comma in a name. The
> MCP server is deferred in `docs/NOT_BUILT_YET.md`. In `docs/usage.md`.

| 9 | `15-spec-closure-b1.md` (every remaining case of `b1`'s spec areas built and tested, checked by hand, or decided against) | Written 2026-11-08; `b1` |

> Closed 2026-11-08 — plan 15, "Closing the spec in `b1`'s areas", built by `b1`: every case of
> look, terminal, projects, agent state, sessions, files and Remote Control tested by id, checked by
> hand (§2.6–2.12) or decided against (TRM-16, 39, 41–46, 51; PRJ-1's no-file clause; SES-44's UI
> path); FIL-39 built; the human's header star, gear, tab ring order and group line. Found: the
> divider could not be grabbed or dragged, a pane's output could show twice, the editor ignored the
> font, a delete missed sessions running in another window, Open beside kept the focus, a file tab's
> rename did nothing, `~` paths guessed home, the preview lost its scroll. The spec areas now point
> at `docs/window.md`, `docs/sessions.md`, `docs/files.md`, `docs/projects.md`.

| 4 | The features, designed by `set` from `docs/spec/` once plans 01 and 02 are delivered: the window, tabs and terminals; projects and windows; agent state, notifications, switcher and keys; preferences, themes, i18n; context ring, statusline and integrations; the Usage window; the classifier; file tabs; remote control; packaging for Ubuntu | Not designed yet |

> Removed 2026-11-08: every feature it listed is built (plans 03–17).

| 11 | `18-remote-control-live-icon.md` (the phone icon from the live bridge state, however Remote Control was turned on) | Written 2026-11-09; `b2` |

> Closed 2026-11-09 — plan 18, "The phone icon shows Remote Control as it is now", built by `b2`:
> the phone reads Claude Code's per-process registry (`~/.claude/sessions/<pid>.json`,
> `bridgeSessionId`) for the pane's claude, found under its shell through `/proc` and matched by
> pid, session and start time; anything unreadable falls back to the app's list, never to off
> (1.18). The emoji became a phone outline in the row and on the tab (1.19). Found: the watcher's
> first pass cleared its running mark before it was set, so no later pass ran; the renderer's
> `running` is not pushed when an agent reaches the foreground (left to `b1`). In
> `docs/sessions.md`.

> Replaced 2026-11-09: §2 row 2.5 gained the dock's count (a seen pane's notification is closed). It was:
| 2.5 | The human's check of notifications (PRF-19): with an agent in a tab you are not watching, let it finish — a desktop notification and the completion sound; turn "Notify about background agents" off — no notification; turn "Play a sound" off — no sound | Human | Trusting the notifications |

| 12 | `19-hide-in-project.md` (hide a session from its project's list, keeping it a member) | Written 2026-11-09; `b1`, after the current batch |

> Closed 2026-11-09 — plan 19, "Hide a session from its project's list", built by `b1`: Hide and
> Show in a row's menu, a hidden member staying a member (usage still counts it), off while it has
> a tab, back on a start, a pick in Add session or the quick switcher; a "N hidden" foot toggling
> them back dimmed. Found: the search the plan named does not exist (the quick switcher it is); a
> usage test that could not see hidden-means-removed. With it, the tab content patched in place
> instead of rebuilt on every state. In `docs/projects.md`.

> Replaced 2026-11-09: About's credit no longer names agent-tablet or links the repository.
| 1.10 | Decided by `set` after the spec (technical, within the rules): the agent-tablet import also takes `usage.jsonl`; integrations' record and settings backups live in the data directory (no fourth one); `unknown` turns show their own category; menus keep the sans font; the Classic style's terminal uses xterm.js colors close to VTE's defaults; About carries the human's copyright and one credit line to agent-tablet and Agent Session Manager; "Restart now" asks and saves like quitting | 2026-11-08 | `docs/spec/README.md` |

| 13 | `20-terminal-drawer.md` (Ctrl+` opens a temporary shell under the tab) | Written 2026-11-09; `b2` |

> Closed 2026-11-10 — plan 20, "The drawer terminal", built by `b2`: Ctrl+` (K43, and New ▾'s
> "Terminal in this tab") opens a shell under the selected tab, in its agent's folder; hiding keeps
> it running, `exit` ends it, closing the tab, window or app hangs it up. Never a tab, a pane of the
> layout, a session or saved. Added at the human's request: a ⌄ button that hides it, covered by
> LOOK-60. Deviations accepted by `set`: a file tab's drawer starts in the file's folder and a chat
> tab's in `HOME`; "gone after a restart" is asserted as "not in `projects.json`". Found: the state
> push on the shell's exit is only testable by timing (the running-panes poll shows it anyway). In
> `docs/window.md`.

> Replaced 2026-11-10: §1 row 1.29 points at `docs/window.md` now that plan 20 is closed. It was:
| 1.29 | Ctrl+` toggles a temporary shell under the current tab, in its agent's folder: hidden, not closed; never a tab, never saved | 2026-11-09 | plan 20 |

| 14 | `21-new-menu.md` (New ▾ with four items, the agent picker in Add session) | Written 2026-11-09; `b1` |

> Closed 2026-11-10 — plan 21, "One New ▾ menu, and the agent chosen in Add session", built by
> `b1` (committed in 8e4c76f): the header's `+` and split arrow became one text button "New ▾" with
> New session, Terminal in this tab, Open file… and New window, each showing its key; Add session →
> New gained a segmented agent picker, an agent not on the PATH greyed out and saying so. The
> advanced new session, Continue last and New chat were deleted with their flags and tests; chat
> stays reachable through Continue in chat. Found: the agent table had to move to a pure core
> module for the renderer to read it. In `docs/window.md` and `docs/sessions.md`.

> Replaced 2026-11-10: §1 row 1.30's document became `docs/window.md` when plan 21 closed. It was:
| 1.30 | The header's New is a text button "New ▾" whose menu holds New session, Terminal in this tab, Open file and New window with their shortcuts; the agent (Claude Code, Cursor…) is chosen in Add session → New, uninstalled ones greyed; the advanced dialog, Continue last and chat entries leave the menu | 2026-11-09 | plan 21 |

> Replaced 2026-11-10: §1 row 1.19 took the phone off the tab (plan 23); the row keeps it. It was:
| 1.19 | The Remote Control icon is a phone outline in the text color (9×13, stroke 1.5), not the emoji, in the row (after the state dot) and the tab | 2026-11-09 | `docs/sessions.md` |

> Replaced 2026-11-09 by the Settings window (plan 24): no window is modal any more.
| 1.24 | The Usage window is an independent top-level window (usable beside the main one or on another monitor); Preferences, About and MCP stay modal dialogs | 2026-11-09 | `docs/usage.md` |

| 16 | `23-scroll-and-rc-tab.md` (jump-to-bottom button in terminals; the phone icon off the tab) | Stub 2026-11-09; for 2026-11-10 |

> Closed 2026-11-10 — plan 23, "A jump-to-bottom button in terminals; no phone icon on tabs", built by
> `b1` (committed in 45ebd41 with plan 24's header part): every terminal (agent pane, shell, drawer)
> scrolled up shows a round down-arrow button left of its scrollbar; a click or `Ctrl+Shift+End`
> (K44, caught before the agent) goes to the end, and output arriving while scrolled up keeps the
> view and marks the button. The phone left the tab; the row keeps it (1.19 reworded). Found: every
> modified End reaches the agent through xterm, so only `Ctrl+Shift+End` is the view's; "at the
> bottom" is read from the drawn cursor row, the scrollbar thumb being off by a few pixels. The
> plan 24 header part (b1) was logged in it. In `docs/window.md` and `docs/sessions.md`.

| 17 | `24-settings-window-and-header.md` (Settings as a sectioned window, no blocking windows, header with Usage, Close all to the tab menu, transcript retention) | Stub 2026-11-09; for 2026-11-10 |

> Closed 2026-11-10 — plan 24, "A Settings window with sections, non-blocking windows, the header
> reorganized, transcript retention", built by `b2` (Settings, retention) and `b1` (the header, the
> tab menu, the sidebar width). Settings is one window of its own, laid out as Ubuntu's: grouped
> sections with icons under a title, About and MCP among them (decisions 1.24, 1.34). Transcript
> retention raises `cleanupPeriodDays` with consent, never shortening it, puts the old value back
> on removal, and shows the current period read from the file, Claude Code's default only when the
> key is absent. Found: the integrity check flags every moved selector (ten renames, read and
> accepted by `set`); a type imported from a Node module pulled Node into the renderer's
> typecheck. In `docs/preferences.md`, `docs/context.md`, `docs/window.md`.

| 18 | `25-startup-and-project-tabs.md` (start timings, a turning star at once, each project's tabs started when shown) | Stub 2026-11-09 |

> Closed 2026-11-10 — plan 25, "A fast first paint, a measured start, and each project's tabs",
> built by `b1` (committed in d846252 with decision 1.33): the window no longer waits for the first
> scan of the agents' folders (6.3 s → about 0.5 s to the first window over a 2 GB history), the
> scan finds name lines by searching bytes instead of decoding every slice (about 6.1 s → 2.4 s to
> the list), a `start timings` notice line names each phase's time at the new default `notice`
> level, and a turning star shows while the scan runs, only after 300 ms. A project's saved tabs
> start the first time its window shows it (1.32). Found: the human's "only the last project's
> tabs reopen" was a misreading (PRJ-66 passed before any change); the remaining ~1.9 s of the
> scan is JSON-parsing the lines that quote the marker, left as a proposal. Suite green: 258
> passed, 1 skipped. In `docs/window.md`, `docs/projects.md`, `docs/sessions.md` and
> `docs/foundations.md`.

| 15 | `22-parallel-e2e.md` (e2e in parallel, one Xvfb per worker) | Stub 2026-11-09; `b2`, from 2026-11-10 |

> Closed 2026-11-10 — plan 22, "parallel e2e, one virtual display per worker", built by `b2`:
> each Playwright worker starts its own Xvfb (`e2e/display.ts`) and drops the session bus, so no
> test notification reaches the developer's desktop. The suite runs at 4 workers with
> `fullyParallel` (`MENKAR_E2E_WORKERS`): 390 s → about 107 s, with five full runs in a row green
> and `package:smoke` green. Found under load: tests that read state right after an action
> (CHT-9, PRF-24, TRM-57, PRF-31, retention, the row phone, LOOK-67), each fixed by waiting for
> what it means. PRF-24 could never see a real relaunch (the copy carries Playwright's loader), so
> it now checks that the relaunch is asked for during the quit, and the real one is the human's
> check (§2 2.17). FIL-33 failed once in 15 runs and was not reproduced. In `docs/toolchain.md`.

| 19 | `26-ubuntu-terminal-theme.md` (a theme matching the human's GNOME Terminal; why Claude Code's colours vanish in one look) | Stub 2026-11-09; low priority, last |

> Closed 2026-11-10 — plan 26, "a theme matching the human's Ubuntu terminal", built by `b2`:
> every pty now says `COLORTERM=truecolor`. A Menkar started from the desktop had none, so Claude
> Code drew in 256 colours instead of its own RGB theme. The "Ubuntu" theme is Yaru-dark's
> aubergine `#300a24` and white with GNOME's palette, in both styles, and was compared against the
> human's own terminal: the colours match, and the type size is the Font setting (decision 1.35).
> The "one-colour look" was not a defect: the human misremembered, and no look showed it. In
> `docs/window.md`.

> Left §1 and §2 on 2026-11-10: "Restart now" no longer asks (1.43; its question opened behind Settings).
| 1.10 | Decided by `set` after the spec (technical, within the rules): the agent-tablet import also takes `usage.jsonl`; integrations' record and settings backups live in the data directory (no fourth one); `unknown` turns show their own category; menus keep the sans font; the Classic style's terminal uses xterm.js colors close to VTE's defaults; About carries the human's copyright and one credit line to Agent Session Manager, with no link (2026-11-09); "Restart now" asks and saves like quitting | 2026-11-08 | `docs/spec/README.md` |
| 2.17 | The human's check of Restart now (PRF-24) on the real desktop, since e2e cannot see a real relaunch (the copy carries Playwright's loader and never reaches Menkar's code): Settings → Language, pick the other language, Restart now with nothing running — Menkar closes and opens again by itself, in the new language; with a session running, Cancel keeps it open and nothing opens later | Human | Trusting Restart now |

> Left §1 on 2026-11-10: unsaved file edits now stop "Restart now" (1.44).
| 1.43 | "Restart now" saves the layout, hangs up the running sessions as quitting does and relaunches, without asking; the sessions that were running are resumed in their tabs; quitting by closing the windows still asks | 2026-11-10 | `docs/preferences.md` |

> Left the header on 2026-11-11: the index was updated again.
> Last updated: 2026-11-08.

> Left §2 on 2026-11-11: the folder's name was decided (1.58).
| 2.19 | The name of the generic Menkar folder in the home directory (1.51); it has to work on Windows too | Human | The files-folder plan |

> Left §1 on 2026-11-11: 1.50 and 1.54 delivered by plan 29 (now in `docs/projects.md`), 1.56 and 1.57 delivered (now in `docs/sessions.md`).
| 1.50 | A group in the sidebar can collapse into one row (its name and color, its member count, the roll-up state of its running members, the worst context ring); a group can optionally mark one member as its leader (for an orchestration: the orchestrator talks to the leaders); a project with no leader or no orchestration loses nothing | 2026-11-11 | `plans/ideas/groups-and-orchestration.md` (until its plan) |
| 1.54 | 1.50's look and behaviour (the human, 2026-11-11): a click on the group's heading collapses or expands it (no jump from the collapsed row); the collapsed state is saved in `projects.json`, on the group; the leader is set from the row's menu, shown with ★ and listed first in its group, hidden with the rest when collapsed, its name on the collapsed row; a group never expands by itself | 2026-11-11 | `plans/29-collapsible-groups.md` (until delivered) |
| 1.56 | When a session in a tab gets a new id (`/clear`, told by the SessionStart hook's `source: "clear"` with the new id), the tab follows the new id; the new session takes the old one's place in its project and its group (its leader mark too); the old one stays a stopped row in the same project | 2026-11-11 | this row (until its task is delivered) |
| 1.57 | An in-tab `/resume` is followed as 1.56 follows `/clear` (SessionStart `source: "resume"`): the tab takes the resumed session's id, the resumed session joins the tab's project (moving out of another project if it was in one, and out of its group there), and the session left stays a stopped row | 2026-11-11 | this row (until its task is delivered) |

> Left §3 on 2026-11-11: plan 29 delivered (ea1a35a) — a group collapses into one row and can have a leader; executed by b1, with picking a session's own group made a no-op on the way. Open from it: nothing; who leads a group, read outside the sidebar, is in `docs/NOT_BUILT_YET.md`.
| 1 | `29-collapsible-groups.md` — 1.50, collapsible groups with an optional leader | Written 2026-11-11, ready to execute; no shared runtime resource beyond each session's own e2e app data |

> Left §1 on 2026-11-11: 1.51, 1.58, 1.60 and 1.61 delivered by plan 30 (now in `docs/project-files.md`).
| 1.51 | A per-project folder for the files that come in and go out (from Downloads, to Slack or mail), outside the repositories, under one generic Menkar folder in the home directory meant to hold more than files later; bring the latest download in, drag a file from a Menkar tab out to another app, open the folder in the file manager, old files go to the trash | 2026-11-11 | `plans/ideas/groups-and-orchestration.md` (until its plan) |
| 1.58 | The generic Menkar folder of 1.51 is `~/Menkar` (`%USERPROFILE%\Menkar` on Windows), one folder per project inside; its place can be changed in Settings → Data, and a change moves nothing already there (Menkar says where the old one is) | 2026-11-11 | this row (until the files-folder plan) |
| 1.60 | 1.51's look and behaviour (the human, 2026-11-11): a collapsible "Files" section at the foot of the sidebar lists the project's files newest first, dragged out or opened; Settings names the folder where shared files arrive (Downloads by default), and bringing a file in opens the system's chooser there or lists its 5 newest (a setting), then moves the chosen ones with an Undo toast; files untouched for 30 days (configurable, 0 = off) go to the trash by themselves; the sessions Menkar starts get `--add-dir` for the folder and `MENKAR_FILES`; one folder for what comes in and what goes out; `Ctrl+B f` opens it in the file manager | 2026-11-11 | `plans/30-files-folder.md` (until delivered) |
| 1.61 | `Ctrl+B o` opens the focused pane's working folder in the file manager (Nautilus, Explorer), as `Ctrl+\`` opens a shell there; "Open folder" in the session row's menu and the tab's right-click menu | 2026-11-11 | `plans/30-files-folder.md` (until delivered) |

> Left §3 on 2026-11-11: plan 30 delivered (1e5869c) — a files folder per project; executed by b1, with moves made exclusive (link or exclusive copy) on the way. Open from it: the human's hand checks (a real drag out, Nautilus opening, the chooser in Downloads), in §2.
| 1 | `30-files-folder.md` — 1.51, a files folder per project | Written 2026-11-11, ready to execute |

> Left §1 on 2026-11-11: 1.63 delivered (9347fe9).
| 1.63 | Amends 1.56 and 1.57 (the human, 2026-11-11): the session a tab leaves through `/clear` or an in-tab `/resume` becomes an **earlier conversation** of the session that replaced it — still a member of the project (Usage counts it there), but in neither the list nor the "N hidden" foot; the row's menu lists its earlier conversations ("Earlier conversations ▸", newest first, by date and time) and opening one makes it an ordinary session of the list again; Add session finds them when searched | 2026-11-11 | this row (until its task is delivered) |

> Left §1 on 2026-11-11: 1.59 delivered (b33c78a).
| 1.59 | Amends 1.47 (the human, 2026-11-11: the http(s)-only limit was never theirs): Ctrl+click hands any terminal link to the system, as GNOME Terminal does — `file://` opens with the file's default app (a folder in the file manager), other schemes with the app the system has for them; a plain click still selects | 2026-11-11 | `docs/window.md` (when delivered) |

> Left §2 on 2026-11-11: the human checked these by hand over three days of daily use, and removed and reinstalled build 0.1.0-120.ga9fde33d (2.2's step 10). 0.1.0's release checklist passes.
| 2.2 | The human's check of the 0.1.0 release candidate: `docs/release-checklist.md`, in order (install, first start with the import, a day of work, Usage, the classifier, notifications, Remote Control, the preview, the screenshots, remove) | Human | Calling 0.1.0 the first version |
| 2.3 | The human's check of the window: use Menkar for a day of work — open your projects, start and resume sessions, close and reopen | Human | Trusting the window for daily use |
| 2.4 | The human's check of Remote Control: turn it on for a session (New's switch or its menu), start it, and drive it from the phone or claude.ai | Human | Trusting Remote Control |
| 2.5 | The human's check of notifications (PRF-19): with an agent in a tab you are not watching, let it finish — a desktop notification and the completion sound; turn "Notify about background agents" off — no notification; turn "Play a sound" off — no sound; then open that tab: its notification leaves the tray and the count on Menkar's icon in the dock goes down with it | Human | Trusting the notifications |
| 2.6 | The human's check of LOOK-5: with the window unfocused, the header and the tab strip keep their colors (no fade) | Human | Trusting the look on a real desktop |
| 2.7 | The human's check of LOOK-22 and LOOK-29 with real agents: a session blocked in another project puts a red count beside the project's name (none when none is); a working tab shows the yellow dot, an idle one none | Human | Trusting the states on screen |
| 2.8 | The human's check of TRM-15: New session (advanced)…, cancel the folder chooser — no dialog, no tab, the remembered folder unchanged | Human | Trusting the native chooser |
| 2.9 | The human's check of SES-64, SES-66, SES-68 with the desktop's trash: Cancel leaves the file; Move to Trash puts the `.jsonl` in the trash, keeps `<id>/subagents/`, removes the row and closes a running tab of it; a transcript in a folder you cannot write says "Could not trash transcript"; trashing three with one failing trashes two and shows one error | Human | Trusting the trash |
| 2.11 | The human's check of AST-28: click the desktop notification of a session whose tab is in another window, in a project not shown there — that window comes forward, shows the project, the tab selected | Human | Trusting the notifications |
| 2.12 | The human's check of AST-38 with real agents: `Ctrl+B g` lists every tab with its project and state across windows; typing "blocked" keeps only the blocked one; Enter brings its window forward with the tab selected | Human | Trusting Go to agent |
| 2.14 | The human's check of the frameless main window (LOOK-55–58) on a real desktop: drag the header to move the window; double-click the header's empty space to maximize, again to restore (once each, not twice); the minimize, maximize and close buttons at the header's right; resize from every edge and corner; snap to the screen's edges and corners; Preferences, Usage, About and MCP keep the system's frame, and no window has a menu bar | Human | Trusting the window's frame |
| 2.15 | The human's check of the live phone (1.18): in a session in a tab, `/remote-control` connect shows the phone on its row and tab within a second or two ("Remote Control connected"); disconnect removes it; a session started with the flag shows it once its bridge connects | Human | Trusting the phone icon |
| 2.16 | The human's check of the Usage window (1.24) on the real desktop: with Usage open, clicks and keys reach the main window; Usage has its own entry in the dock and Alt+Tab and can sit beside the main window or on another monitor; closing the main window it came from leaves Usage open, showing every project | Human | Trusting Usage beside the main window |
| 2.17 | The human's check of Restart now (PRF-24) on the real desktop, since e2e cannot see a real relaunch (the copy carries Playwright's loader and never reaches Menkar's code): Settings → Language, pick the other language, Restart now — Menkar closes and opens again by itself, in the new language, without asking even with sessions running (1.43); the sessions that were running come back resumed in their tabs | Human | Trusting Restart now |
| 2.18 | The human's check of the dropdowns' lists on the real desktop (2026-11-10), since xvfb never draws a native popup: in Settings, with the dark scheme and then the light one, open each dropdown (Color scheme, Interface size, Font) — every option is readable, not only the highlighted one | Human | Trusting the dropdowns |
| 2.20 | The human's check of the files folder (plan 30) on the real desktop, since xvfb cannot: drag a file from the sidebar's Files section into Slack, the mail client and Nautilus; 📂, `Ctrl+B f` and `Ctrl+B o` open Nautilus; ⬇ in chooser mode opens the system's chooser in Downloads; and of 1.59: Ctrl+click on a `[file] ….pdf` in a Claude tab opens the PDF viewer | Human | Trusting the files folder and file links |

> Left §2 on 2026-11-11: decided as 1.68.
| 2.13 | After 0.1.0 is accepted: which of the three agent-tablet mentions 0.1.0 keeps also go — the first-start import (1.8), the credit in the README and About (1.10), the checklist's comparisons — then a plan removes the rest (1.17) | Human | Removing agent-tablet |

> Left §2 on 2026-11-11: the human checked it on build 0.1.0-120.
| 2.10 | The human's check of FIL-34: with Menkar closed and two windows saved, `menkar open x.md` reopens both windows, then asks "Open in which window?" | Human | Trusting `menkar open` from a terminal |

> Left §1 on 2026-11-11: the human confirmed the three names.
| 1.71 | Menkar ships its own skills for orchestration — `menkar-orchestrator`, `menkar-worker`, `menkar-distill` (names proposed by set, to confirm) — written for any project and aware of Menkar's MCP (1.70); this repository's orchestrator uses them, keeping in `plans/ROLE-ORCHESTRATOR.md` only what is Menkar's own. Written after plan 31, so they name tools that exist; how they reach a session (installed files, a plugin, or served by Menkar's MCP) is open | 2026-11-11 | this row |

> Left §3 on 2026-11-11: plan 31 was written.
| 1 | `31-session-control.md` — 1.70, Menkar's MCP/CLI to renew and start sessions | Stub, being designed by `set` with the human, 2026-11-11 |

> Left §1 on 2026-11-11: 1.67 delivered; its two edge cases settled by set.
| 1.67 | Picking, in one window, a project another window holds (it shows it or has its tabs) asks: "Bring it to this window" or "Go to the other window". Bringing it moves its tabs with their running sessions, without restarting them; the other window keeps showing what it showed (or another project when it showed that one). A project is still open in one window at most | 2026-11-11 | `docs/window.md` (when delivered) |

> Left §1 on 2026-11-11: 1.70, 1.72, 1.73 and 1.74 delivered by plan 31 (now in `docs/session-control.md`).
| 1.70 | Menkar gives the sessions it starts its own MCP server (passed like `--settings`, nothing in `~/.claude`), with a CLI over the same core: `renew` ends the calling session once its turn is over and starts a fresh one in the same tab, with the same name and an optional first prompt, the old one becoming its earlier conversation (a `/clear` without typing anything); `start_session` starts a new session in a Menkar tab (name, project, prompt from a file, Remote Control, group). Low risk, so the agents use them without asking the human; any session Menkar started may start others, in its own project; the new tab opens after the caller's without taking the focus; `renew` keeps what a followed `/clear` keeps (the human, 2026-11-11). Nothing is typed into a running agent. 1.16's "no MCP server for now" was about usage data and stands for it | 2026-11-11 | `plans/31-session-control.md` (until delivered) |
| 1.72 | Plan 31's channel (the human, 2026-11-11, after two studies in `prompts/reports/research-orchestrator-transport.md` and `research-wake-orchestrator.md`): the MCP process and Menkar talk through **files** Menkar watches (`fs.watch` plus a ~1 s check) — request and response pairs, a published snapshot of the sessions and their states, an inbox per orchestrator, a file saying Menkar is alive; no socket, no port. An idle orchestrator is woken by **Menkar posting the event through Claude Code's documented cross-session messaging** (it cannot answer a permission prompt and arrives marked as from another session; `crossSessionInbound: "accept"` in Menkar's `--settings`), behind one `wake(session, text)` per agent. This is not typing into a terminal | 2026-11-11 | `plans/31-session-control.md` (until delivered) |
| 1.73 | A worker's report is written once, as its last message in its own chat; the orchestrator reads it with a fourth tool of Menkar's MCP, `last_reply { session }` (read from the transcript, read only), instead of a report file (the human, 2026-11-11: no interim change to how workers report today) | 2026-11-11 | `plans/31-session-control.md` (until delivered) |
| 1.74 | In Menkar's MCP tools and wake messages a session is addressed by its **name**, stable across a renew or a `/clear`, never by its id, which changes; names are unique among a project's sessions with a tab; a parent recorded by id is re-keyed on every follow (the human, 2026-11-11, after a worker's message went to the orchestrator's previous id) | 2026-11-11 | `plans/31-session-control.md` (until delivered) |

> Left §3 on 2026-11-11: plan 31 delivered (3fc82df) — renew, start_session, list_sessions, last_reply, waking the parent; executed by b2 after three measured studies, checked with the real claude 2.1.322. Open from it: the human's hand check (2.22) and whether Menkar strips Claude Code's variables from its panes (a topic).
| 1 | `31-session-control.md` — 1.70, Menkar's MCP/CLI to renew and start sessions | Written 2026-11-11, ready to execute |

> Left §3 on 2026-11-11: plan 32 block 1 delivered (56e1593).
| 2 | `32-remove-agent-tablet.md` — 1.68, agent-tablet leaves Menkar | Written 2026-11-11; block 1 (docs) now, block 2 after plan 31 |

> Left §1 and §3 on 2026-11-11: plan 32 delivered — agent-tablet leaves Menkar (1.68 settles 1.8 and 1.17; the record is git log). Executed by b1. One string stays, as data: the file name of the usage log copied at an earlier first start.
| 1.8 | On its first start Menkar imports agent-tablet's own data, read only: `projects.json` (projects, groups, members), `state.json` (settings, hidden sessions, the Remote control list) and the usage history (`history.sqlite`); agent-tablet's files are never written | 2026-11-08 | `docs/spec/` |
| 1.17 | agent-tablet is deprecated and may be deleted: Menkar stops depending on it or naming it. 0.1.0 keeps what the switch needs (the first-start import, the release checklist's comparisons, the credit line); after 0.1.0 is accepted, every other mention goes — code comments, docs, the spec's references, tests' wording — and new text never names it | 2026-11-09 | this row |
| 1.68 | Settles 2.13 (the human, 2026-11-11, with 0.1.0's checklist passed): the first-start import of agent-tablet's data (1.8) and the release checklist's comparisons with agent-tablet go; the credit line to Agent Session Manager stays (it names the idea's origin, not agent-tablet); then every other mention of agent-tablet in code, docs and tests goes, as 1.17 planned | 2026-11-11 | this row (until its plan is delivered) |
| 1 | `32-remove-agent-tablet.md` — 1.68, agent-tablet leaves Menkar | Block 1 (docs) delivered 2026-11-11; block 2 (the import and the code) ready |

> Left §1 on 2026-11-12: 1.75 delivered.
| 1.75 | Menkar's terminals do not inherit the variables that describe a running Claude Code session (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_MESSAGING_*`, `CLAUDE_CODE_ENTRYPOINT` and the like), so a Menkar started from inside Claude Code starts clean sessions it can wake; the user's configuration (`CLAUDE_CONFIG_DIR`, `ANTHROPIC_*`) is passed as it was (the human, 2026-11-12) | 2026-11-12 | this row (until delivered) |

> Left §1 on 2026-11-12: 1.76's removal delivered.
| 1.76 | Amends 1.50 and 1.54 (the human, 2026-11-12): a group is only a visual way to gather sessions; **the leader mark per group goes** (the ★, its menu entries, `leader` in `projects.json`, read leniently and dropped). Roles belong to the orchestration mode, per session, not to groups: experts in an area, consultants, troubleshooting, documentation — to be designed with that mode | 2026-11-12 | this row (until the removal is delivered) |

> Left §1 on 2026-11-12: the plugin namespaces the names.
| 1.71 | Menkar ships its own skills for orchestration — `menkar-orchestrator`, `menkar-worker`, `menkar-distill` — written for any project and aware of Menkar's MCP (1.70); this repository's orchestrator uses them, keeping in `plans/ROLE-ORCHESTRATOR.md` only what is Menkar's own. Written after plan 31, so they name tools that exist; how they reach a session (installed files, a plugin, or served by Menkar's MCP) is open | 2026-11-11 | this row |

> Left §3 on 2026-11-12: the mode's design became plan 34.
| 2 | The orchestration mode's design (roles, roster, entering and leaving, the panel) | To design after plan 33, from `plans/ideas/` |

> Left §1 and §3 on 2026-11-12: plan 33 delivered (77e66a3) — Menkar's four skills through a plugin; executed by b1, reviewed by the human, the LaburoMenos orchestrator, ccai's controlplane, documentation and guardian, and flabe-reviewer. 1.71 and 1.79–1.84 now point to `docs/session-control.md`; 1.73 names `last_reply { name }`.
| 1.71 | Menkar ships its own skills for orchestration — `menkar:orchestrator`, `menkar:worker`, `menkar:distill` (plugin namespace; first written `menkar-orchestrator`, `menkar-worker`, `menkar-distill`) — written for any project and aware of Menkar's MCP (1.70); this repository's orchestrator uses them, keeping in `plans/ROLE-ORCHESTRATOR.md` only what is Menkar's own. Written after plan 31, so they name tools that exist; how they reach a session (installed files, a plugin, or served by Menkar's MCP) is open | 2026-11-11 | this row |
| 1.73 | A worker's report is written once, as its last message in its own chat; the orchestrator reads it with a fourth tool of Menkar's MCP, `last_reply { session }` (read from the transcript, read only), instead of a report file (the human, 2026-11-11: no interim change to how workers report today) | 2026-11-11 | `docs/session-control.md` |
| 1.79 | A fourth Menkar skill, `menkar:specialize`: a session whose expertise lives only in its context defines its role — kind, area, **boundaries** (what it owns, advises on, must not decide, whom it defers to) — finds what it lacks by researching and by asking the orchestrator and the human for feedback, and writes its own skill, which `menkar:distill` keeps current (the human, 2026-11-12) | 2026-11-12 | `plans/33-menkar-skills.md` (until delivered) |
| 1.80 | A skill written by `menkar:specialize` or kept by `menkar:distill` is not documentation: it points to the repository's docs by file and section (never a line), so it follows their changes; knowledge documented nowhere is proposed as documentation for the repository, and the skill points to it; the skill keeps only ways of working, constraints, whom to ask and what not to decide (the human, 2026-11-12) | 2026-11-12 | `plans/33-menkar-skills.md` (until delivered) |
| 1.81 | Two points for Menkar's skills (the human, 2026-11-12): the orchestrator follows the project's rule on working trees — one shared tree sequenced by files, or worktrees where the running environment has one owner at a time, taken in turns (priority first), and the shared state (e.g. migrations) brought to what the next branch expects by the project's documented procedure, else asked; a worker that validated a visual change saves screenshots in `$MENKAR_FILES`, named with its session's name first, and lists them in its report. How a project starts its environment, its seeds and its migration steps belong to that project's own skills and docs | 2026-11-12 | `plans/33-menkar-skills.md` (until delivered) |
| 1.82 | Menkar's skills (the human, 2026-11-12, after the LaburoMenos orchestrator's feedback): a skill's body may reach **200 lines** (was 150), and beyond that uses reference files in its folder; **commits follow the project's rule** — one committing session or each session on its own branch — while only validated work is committed, by path, never another session's in-flight files | 2026-11-12 | `plans/33-menkar-skills.md` (until delivered) |
| 1.83 | After four specialists' reviews of `menkar:specialize` (the human, 2026-11-12): a role is described by what it owns, advises on, must not decide and defers to, and **what it does for each kind of request** — no forced kind; in the orchestration mode a session's role is **a free label** (e.g. "Fabric expert"), amending 1.77's fixed list (the orchestrator mark stays); a skill aims at **60–120 lines**, 200 at most, and **declares its own admission criterion** ("if a session that never loads it still needs it, it is not skill material"); no story, but **each rule keeps in one line the case that produced it** | 2026-11-12 | `plans/33-menkar-skills.md` (until delivered) |
| 1.84 | After the final review of Menkar's skills (the human, 2026-11-12): a renewed session's **handoff note is its renew prompt** (who it is, the skill to load, what is in flight), never a file; **only the orchestrator orchestrates** — another session never starts sessions or acts as one; it may ask the orchestrator to delegate work to an existing expert session, and may always use its own subagents for research, discovery or review (amends 1.70's "any session may start others"; enforced in the tool once the orchestrator is marked, plan 34); Menkar's four skills declare their admission criterion, the case-per-rule of 1.83 binds only role skills | 2026-11-12 | `plans/33-menkar-skills.md` (until delivered) |
| 1 | `33-menkar-skills.md` — 1.71, Menkar's skills `menkar:orchestrator`, `menkar:worker`, `menkar:distill` through a plugin | Written 2026-11-12, ready to execute; the texts are read by the human before closing |

> Left §3 on 2026-11-12: plan 34 moved up to first.
| 2 | `34-orchestration-mode.md` — 1.77, the orchestration mode in the app | Stub, being designed by `set` with the human, 2026-11-12 |

## 2026-11-12 — updated by `set` (plan 34's details decided, 1.86–1.88)

> Last updated: 2026-11-11.
| 1 | `34-orchestration-mode.md` — 1.77, the orchestration mode in the app | Stub, being designed by `set` with the human, 2026-11-12 |

> Left §3 on 2026-11-12: plan 34 written.
| 1 | `34-orchestration-mode.md` — 1.77, the orchestration mode in the app | Stub, being designed by `set` with the human, 2026-11-12; to be executed by a `b1` that `set` starts with `start_session` (2.22) |

> Left §3 on 2026-11-12: 1.92 added to the small tasks.
| 2 | Small tasks, not urgent: 1.87 (statusline without the total), 1.88 (Move to Trash in Files) | To assign after plan 34, or beside it if they share no file |

## 2026-11-12 — plan 34 closed: the orchestration mode built by `b1` (started by `set` with `start_session`)

| 1.77 | The orchestration mode (the human, 2026-11-12): **per project**, switched on and off from the project's menu; **roles are Menkar's data** set from a row's menu (Orchestrator — one per project —, Expert, Consultant, Reviewer, Worker; plus a free-text area and skill), read by agents through `list_sessions`; **a panel beside the orchestrator's tab** with the open topics (priority sessions' first, blocking marked) and the team's states; **the sidebar ordered by role** in the mode, workers nested under the session that started them | 2026-11-12 | `plans/34-orchestration-mode.md` (until delivered) |
| 1.78 | The orchestration mode, continued (the human, 2026-11-12): topics through Menkar's MCP tools (`topic_add`, `topic_update`, `topic_close`, `topic_list`), kept as Menkar's data per project; a session's **priority flag** from its row's menu, shown as a yellow ★, its topics first; `Ctrl+\`` in the orchestrator's tab asks which of the active sessions' folders; talking to a session directly marks it "with you" and the session briefs the orchestrator by name when the human asks it, Menkar typing nothing | 2026-11-12 | `plans/34-orchestration-mode.md` (until delivered) |
| 1.86 | Plan 34's three open details (the human, 2026-11-12): the panel's team list shows one row per session — state dot, priority ★, name, role label, context ring, "with you" — a click selects its tab, a right-click opens the row's menu; **"with you" is a toggle the human sets and clears by hand** (row menu and panel), read by agents through `list_sessions`; topics are answered **only in the orchestrator's chat**, the panel is read only (a click unfolds a topic's context) | 2026-11-12 | `plans/34-orchestration-mode.md` (until delivered) |
| 1.89 | Plan 34's look (the human, 2026-11-12, from mock-ups A–D): **no panel** — the topics are a collapsible "Topics" section at the top of the sidebar, seen from any tab, and the team is the sidebar itself, ordered by role (amends 1.77 point 3; 1.86's row click and menu apply to the sidebar rows); in the row menu, "Orchestrator", "Role…", "Priority" and "With you" sit loose in their own block, only while the mode is on; a session's children with a tab are nested and indented under it, those without a tab gathered in one "N earlier" row that unfolds on a click; the mode is switched from an icon per project in the project popover, lit when on, **and from a toggle beside Usage in the header**, so it can be discovered | 2026-11-12 | `plans/34-orchestration-mode.md` (until delivered) |
| 1.90 | The first time a project enters the orchestration mode (no orchestrator marked), Menkar guides the user: a card says what the mode is for, explains in a line what an orchestrator is, and asks which existing session will be it or offers to start a new one; it points to a **guide written to be read by agents** too, shipped inside Menkar so any session can read it from disk, with a way to hand it to another session to ask it questions; the same guide published online later (the human, 2026-11-12: "documentation must be accessible to agents") | 2026-11-12 | `plans/34-orchestration-mode.md` (until delivered) |
| 1.91 | 1.89 and 1.90 settled (the human, 2026-11-12, mock-ups E and F): the header toggle is a switch with the word "Orchestration" beside Usage; the first-time guide is a card over the window — what the mode is, "Who orchestrates?" with the project's sessions or a new one, "Open the guide" (a read-only Menkar file tab) and "Copy a prompt for another session"; "Not now" leaves the mode off; no external link until the guide is published with plan 28's site | 2026-11-12 | `plans/34-orchestration-mode.md` (until delivered) |
| 1.93 | `Ctrl+\`` in the orchestrator's tab keeps **one shell per folder**: picking a folder shows that folder's drawer (started the first time), and the others stay alive and hidden; nothing is hung up by a pick. Closing the tab hangs them all up as today (the human, 2026-11-12, b1's question in plan 34 block 7) | 2026-11-12 | `plans/34-orchestration-mode.md` (until delivered) |
| 1 | `34-orchestration-mode.md` — 1.77, the orchestration mode in the app | Written 2026-11-12, ready; executed by a `b1` that `set` starts with `start_session` (2.22) |
| 2 | Small tasks, not urgent: 1.87 (statusline without the total), 1.88 (Move to Trash in Files), 1.92 (a reused name makes the stopped session an earlier conversation) | After plan 34: they touch `src/main/workspace.ts` and the renderer, which plan 34 is changing |
| 2.22 | The human's check of plan 31 on the real desktop: in a real tab an agent calls `start_session` — the new tab appears after it without taking the focus; when that child stops at a permission prompt, its idle parent wakes with a [Menkar] message; `renew` restarts the tab with the same name and the old conversation under "Earlier conversations" | Human | Trusting session control |

### Plan 34's execution log, verbatim


Executed by `b1`, 2026-11-12, blocks 1–8 in order. Every new test was seen red first (a missing
module, or a defect injected and removed).

**Decisions taken on the way, by the human through `set`:**
- **1.93, one shell per folder** (block 7): §2.6 did not say what a pick does while the tab's
  hidden drawer lives in another folder. The human decided that each folder picked in the
  orchestrator's tab keeps its own drawer. `DrawerRegistry` keeps a current drawer and one per
  folder for each tab; every other tab keeps one.
- **The orchestrator's row is labelled "Orchestrator"** where the role goes when it has no label of
  its own (`set`, from mock C1, after checking the screenshots of blocks 1–5).
- **check-test-integrity:** adding the topic tools removes the line
  `expect(TOOL_NAMES).toEqual([... four names])`. `set` accepted it, to be noted at commit; its
  replacement is as strict (an exact eight-name list on `tools/list`, and `TOOL_NAMES` equal to
  it). Until that commit `npm run ci` stops at that step; the steps after it (flaky quarantine,
  history) were run by hand each time and passed.
- **plans/00-STATUS.md** rows 1.77, 1.78, 1.86, 1.89–1.91 and 1.93 and their history are left to
  `set`, who was editing both files; `set` repoints them when it closes the plan.

**Deviations, and files touched beyond the ones named:**
- `src/main/projects.ts`: it maps `ProjectInfo` too, so it had to carry the new fields; it also got
  `addNotice` for the topics file's moved-aside notice.
- `ProjectInfo` also gained `parents`, which `modeRows` needs to nest children.
- `PaneView` gained an optional `cwd`, which the renderer needs to gather the team's folders for
  `Ctrl+\`` and for the card's folder list.
- New modules beyond the plan's names: `src/renderer/orchestration.ts` (switch, popover icon, row
  menu block, Topics section, card), `src/main/topics.ts` (the store main keeps), and
  `folderPicker` in `src/renderer/switcher.ts` (a list over `jumpDialog`).
- `WindowState` gained `topics` and `guidePath`.
- The topic tools' logic is a pure `topicTool` in `src/core/orchestration/topics.ts`, tested on its
  own, so `handleControl`'s cases stay one call.
- The read-only key for the guide is `files.readOnlyMenkar`: `checkFile` takes an optional folder
  of Menkar's own (the plugin folder), checked through links.
- `scripts/check-package.mjs` and its test now require `resources/plugin/guide/orchestration-mode.md`
  in the .deb, so "package:check lists it" is asserted, not just looked at.
- `tests/core/plugin.test.ts` gained a guard for the guide: it names the topic tools, names only
  tools the server lists, and no project of this repository.
- `docs/window.md` and `docs/files.md` were made false by blocks 7 and 6 (one drawer per tab; what
  opens read only), so both were corrected, with their history.

**My choices, labelled:**
- "Open the guide" closes the card and leaves the mode off. "Copy a prompt" keeps the card open and
  shows a toast. Escape is "Not now".
- In a row in the mode, the role and the folder share the line under the name (`Role · folder`)
  when both show; the ★ goes before the name and "with you" after it.
- The "N earlier" row's wording is the plan's, in Spanish "N anteriores".
- `followNewId`/`followResume`: the old id's marks replace the new id's own where both have one
  (a role, the orchestrator mark); a mark only the new id has stays (as `followParents` does).
- Reopening a topic with `topic_update { status }` drops a decision it had, which can only happen
  to a topic closed by `topic_close`, since only open and discussing can be set.
- The card's folder list is the project's running sessions' folders (the `Ctrl+\`` list), else the
  recent folders. Its sessions are the listed ones: not hidden, not an earlier conversation.

- The popover's team icon sits after rename and delete. First placed before them, it took the
  first button's place, which `e2e/window.spec.ts` clicks to rename (caught by the full ui-check).

**What the plan did not anticipate:**
- The mock-ups were not on disk. The look follows §2's text, and `set` checked the screenshots
  against the mock-ups.
- `Ctrl+\`` with a hidden drawer in another folder (decision 1.93 above).
- A test cannot copy into `$MENKAR_FILES` (another user's run would write there), so the specs
  write to `/tmp/menkar-shots/` and the `b1-` copies were made by hand.

> Left §3 on 2026-11-12: 1.96 added to the small tasks.
| 1 | Small tasks, not urgent: 1.87 (statusline without the total), 1.88 (Move to Trash in Files), 1.92 (a reused name makes the stopped session an earlier conversation), `last_reply` preferring the session with a tab when two share a name (seen 2026-11-12: it read the stopped `b1`) | Next, for one worker: they touch `src/main/workspace.ts` and the renderer |

### Plan 34's execution log, final (after 1.94 and 1.95), verbatim


Executed by `b1`, 2026-11-12, blocks 1–8 in order. Every new test was seen red first (a missing
module, or a defect injected and removed).

**Decisions taken on the way, by the human through `set`:**
- **1.93, one shell per folder** (block 7): §2.6 did not say what a pick does while the tab's
  hidden drawer lives in another folder. The human decided that each folder picked in the
  orchestrator's tab keeps its own drawer. `DrawerRegistry` keeps a current drawer and one per
  folder for each tab; every other tab keeps one.
- **The orchestrator's row is labelled "Orchestrator"** where the role goes when it has no label of
  its own (`set`, from mock C1, after checking the screenshots of blocks 1–5).
- **check-test-integrity:** adding the topic tools removes the line
  `expect(TOOL_NAMES).toEqual([... four names])`. `set` accepted it, to be noted at commit; its
  replacement is as strict (an exact eight-name list on `tools/list`, and `TOOL_NAMES` equal to
  it). Until that commit `npm run ci` stops at that step; the steps after it (flaky quarantine,
  history) were run by hand each time and passed.
- **plans/00-STATUS.md** rows 1.77, 1.78, 1.86, 1.89–1.91 and 1.93 and their history are left to
  `set`, who was editing both files; `set` repoints them when it closes the plan.

**Deviations, and files touched beyond the ones named:**
- `src/main/projects.ts`: it maps `ProjectInfo` too, so it had to carry the new fields; it also got
  `addNotice` for the topics file's moved-aside notice.
- `ProjectInfo` also gained `parents`, which `modeRows` needs to nest children.
- `PaneView` gained an optional `cwd`, which the renderer needs to gather the team's folders for
  `Ctrl+\`` and for the card's folder list.
- New modules beyond the plan's names: `src/renderer/orchestration.ts` (switch, popover icon, row
  menu block, Topics section, card), `src/main/topics.ts` (the store main keeps), and
  `folderPicker` in `src/renderer/switcher.ts` (a list over `jumpDialog`).
- `WindowState` gained `topics` and `guidePath`.
- The topic tools' logic is a pure `topicTool` in `src/core/orchestration/topics.ts`, tested on its
  own, so `handleControl`'s cases stay one call.
- The read-only key for the guide is `files.readOnlyMenkar`: `checkFile` takes an optional folder
  of Menkar's own (the plugin folder), checked through links.
- `scripts/check-package.mjs` and its test now require `resources/plugin/guide/orchestration-mode.md`
  in the .deb, so "package:check lists it" is asserted, not just looked at.
- `tests/core/plugin.test.ts` gained a guard for the guide: it names the topic tools, names only
  tools the server lists, and no project of this repository.
- `docs/window.md` and `docs/files.md` were made false by blocks 7 and 6 (one drawer per tab; what
  opens read only), so both were corrected, with their history.

**My choices, labelled:**
- "Copy a prompt" keeps the card open and shows a toast. Escape is "Not now". ("Open the guide"
  closing the card was replaced by 1.94 below.)
- In a row in the mode, the role and the folder share the line under the name (`Role · folder`)
  when both show; the ★ goes before the name and "with you" after it.
- The "N earlier" row's wording is the plan's, in Spanish "N anteriores".
- `followNewId`/`followResume`: the old id's marks replace the new id's own where both have one
  (a role, the orchestrator mark); a mark only the new id has stays (as `followParents` does).
- Reopening a topic with `topic_update { status }` drops a decision it had, which can only happen
  to a topic closed by `topic_close`, since only open and discussing can be set.
- The card's folder list is the project's running sessions' folders (the `Ctrl+\`` list), else the
  recent folders. Its sessions are the listed ones: not hidden, not an earlier conversation.

- The popover's team icon sits after rename and delete. First placed before them, it took the
  first button's place, which `e2e/window.spec.ts` clicks to rename (caught by the full ui-check).

**After review, two decisions of the human (through `set`):**
- **1.94 (mock G1):** "Open the guide" hides the card instead of closing it. Closing the guide's
  tab brings the card back with the radio, the name and the folder chosen, kept per window in
  memory, and the mode does not move until Start or Not now. The watch on the guide's tab is
  registered when the frame is built, since app's listeners do not exist while the module loads.
- **1.95:** "Ask an agent" on every Markdown editor tab. `set` defined the name and the folder;
  `startNew`'s body became `startNewSession`, which can insert the new tab after a given one, and
  `askAboutFile` calls it. Also my choices: the button sits at the left of the Save/Preview row,
  in a wrapper (`.file-actions`), so the existing specs' `.preview-row button:not(.save)` still
  finds one button; it is on editor tabs only, not on the Markdown preview tab, which has no row;
  "the project's focused agent pane" is the focused pane of the session tab last selected in that
  project in this window, else its first session tab; names still starting in a tab count as
  taken, so two quick clicks don't get one name.

**What the plan did not anticipate:**
- The mock-ups were not on disk. The look follows §2's text, and `set` checked the screenshots
  against the mock-ups.
- `Ctrl+\`` with a hidden drawer in another folder (decision 1.93 above).
- A test cannot copy into `$MENKAR_FILES` (another user's run would write there), so the specs
  write to `/tmp/menkar-shots/` and the `b1-` copies were made by hand.

> Left §2 on 2026-11-12: the human saw every part of plan 31 on the real desktop — a child's tab opening without the focus, the parent woken when the child finished a turn and when it stopped at a permission prompt, and `renew` keeping the tab and name with the old conversation under "Earlier conversations".
| 2.22 | The human's check of plan 31 on the real desktop. Seen 2026-11-12: a `start_session` child's tab opened without taking the focus, and its idle parent was woken with "[Menkar] b1 finished its turn". Still to see: the wake at a permission prompt, and `renew` restarting the tab with the same name and the old conversation under "Earlier conversations" | Human | Trusting session control |

> Left §3 on 2026-11-12: the small tasks were built by `b1` and tried by the human.
| 1 | Small tasks, not urgent: 1.87 (statusline without the total), 1.88 (Move to Trash in Files), 1.92 (a reused name makes the stopped session an earlier conversation), 1.96 (double-click a topic to discuss it), `last_reply` preferring the session with a tab when two share a name (seen 2026-11-12: it read the stopped `b1`) | Next, for `b1` after plan 34 is committed: they touch `src/main/workspace.ts` and the renderer |

> Left on 2026-11-12: 1.98 built by `b2`.
| 1.98 | Menkar remembers whether the last window closed was maximized, and opens the next start's window maximized or not to match (the human, 2026-11-12). Not built yet | 2026-11-12 | this row (until built) |
| 1 | 1.98 (remember a maximized window) | For `b2`, restarted by `set` with `start_session` (which also tries 1.92 on the real desktop) |

> Left §3 on 2026-11-12: plan 35 written.
| 1 | `35-orchestration-notifications.md` — notifications through the orchestrator, and states reported by the sessions | Stub, being designed by `set` with the human, 2026-11-12 |

## 2026-11-12 — plan 35 closed (built by `b1`, tried by the human); 1.105 built by `b2`

| 1.99 | Notifications in the orchestration mode (the human, 2026-11-12, topic 3): while the mode is on, only the orchestrator and a session marked "with you" notify (sound, toast, desktop notice, dock count); the others, ★ ones included, notify only through the orchestrator; the sidebar's dots and blocked counts still show every session. When a child waits at a permission prompt, the orchestrator turns that wake into a blocking topic, which notifies the human | 2026-11-12 | `plans/35-orchestration-notifications.md` (until delivered) |
| 1.100 | Amends 1.77's topic order (the human, 2026-11-12, topic 5): topics from ★ sessions first, then blocking ones, then the rest by number, so the top topic is the one to take | 2026-11-12 | `plans/35-orchestration-notifications.md` (until delivered) |
| 1.101 | Read-only tabs in the orchestration mode (the human, 2026-11-12, topic 7): a session under the orchestrator (its parent is the orchestrator) opens read only — every key blocked, scrolling, selecting and copying still work — under a yellow warning banner "This session reports to the orchestrator. Take control?"; taking control marks it "with you" and the banner turns blue, "This session is with you. Hand it back?"; both moves post a [Menkar] message to the orchestrator; a permission prompt makes the tab writable while it waits; loose sessions and the orchestrator have no banner | 2026-11-12 | `plans/35-orchestration-notifications.md` (until delivered) |
| 1.102 | A session comes under the orchestrator (becomes its child) from the row menu ("Hand to the orchestrator" / "Take back from the orchestrator"), from the first-time card's list of sessions the orchestrator manages (all checked by default), or from a new MCP tool the orchestrator calls only when the human asks it explicitly; nothing restarts or is typed, only who is woken changes (the human, 2026-11-12, topic 8) | 2026-11-12 | `plans/35-orchestration-notifications.md` (until delivered) |
| 1.103 | Topic notifications in the orchestration mode (the human, 2026-11-12, topic 4): every new topic notifies as a blocked session does (sound, toast, desktop notice, dock count); a change notifies only when a topic becomes blocking; a click opens the orchestrator's tab with the topic unfolded; the dock counts open topics not yet seen (unfolded or double-clicked), added to every other project's notifications; while a topic is "discussing", new topics make no sound but still show and count | 2026-11-12 | `plans/35-orchestration-notifications.md` (until delivered) |
| 1.104 | Amends 1.99 (the human, 2026-11-12, topic 9): in the mode, loose sessions (not under the orchestrator) notify as today; only the sessions under the orchestrator are muted. Any session, in any mode, can be muted from its row menu ("Mute" / "Unmute"): no sound, toast or desktop notice, shown with a muted-speaker icon in its row; its dot still shows | 2026-11-12 | `plans/35-orchestration-notifications.md` (until delivered) |
| 1.105 | A session whose agent still has a background task running (a shell or an agent it started in the background) shows as working (yellow), not free, in any mode; read from the screen if Claude Code shows it reliably, else from a hook — to be measured first (the human, 2026-11-12, topic 10, after seeing b1 green while its own `ui-check` ran). Not built yet | 2026-11-12 | this row (until built) |
| 1 | `35-orchestration-notifications.md` — notifications through the orchestrator, mute, read-only tabs, handing sessions over | Written 2026-11-12, ready; to `b1` |

### Plan 35's execution log, verbatim


Executed by `b1` on 2026-11-12, blocks 1–5 in order, `npm run ci` green after each.

**Deviations and what the plan did not anticipate:**
- **The dock count (§2.2):** Menkar sets no badge; the dock counts the desktop's open notices. Asked
  `set`, who chose: a topic's desktop notice goes in the agents' tray under its project and number,
  and seeing the topic closes it; a toast stays out of the count. §2.2 corrected accordingly.
- **Topic notices only while the mode is on** (b1's choice): off, the Topics section is not shown,
  so a notice's Show would lead nowhere.
- **A topic becoming blocking sounds even while another is discussed** (b1's choice): §2.2 silences
  only new topics then.
- **Show opens a collapsed Topics section** (b1's choice), or the unfolded topic would not show.
- **The blue banner** needed a blue the themes did not have: a new role `blue` (the theme's ANSI 4;
  libadwaita's blue in Classic), `--blue` in the page (`src/core/theme.ts`, `src/renderer/look.ts`).
- **The banner is per pane**, at the top of the pane like the find bar, not across a two-pane tab:
  a tab body's flex layout would have put it beside the panes.
- **Mute follows a resume and a reused name too**, as §2.1 says, though Remote Control follows only
  a clear and a renew; `followMute` is called from `followClear`, the resume path and
  `startForAgent`'s name takeover.
- **The card's default (all checked)** made three older specs' sessions fold under the
  orchestrator; their `startWithFirst` now unchecks the boxes.
- **Test integrity:** the old order test was kept with non-blocking topics (its rule still holds);
  the new order is a new test.
- **The guide** (`plugin/guide/orchestration-mode.md`) said the old topic order: corrected, with a
  short section on notifications, read-only tabs and handing sessions over.
- **Not anticipated:** read only drops every byte the renderer sends to that pane, terminal replies
  included (focus reports, answers to queries). Nothing in the stand-in needs them; with the real
  Claude Code, untried.

**After `set`'s review (2026-11-12):**
- **Read only moved to the window**, reversing §2.3's "main drops its input": dropping every byte
  also swallowed the terminal's replies to Claude Code's queries. The renderer now blocks the user's
  keys, pastes, drops and input-method text; xterm's `onData` passes. Main refuses only what Menkar
  sends for a key (`pty:typed`: Shift+Enter's newline, a passed-on Ctrl+B). The spec checks that a
  read-only pane's stand-in gets the reply to its CSI 6n while typed keys, pastes (keys, menu,
  event) and a drop reach nothing.
- **The yellow banner** is a fixed amber (`#f5c211`) with dark text, the same in every look and
  scheme; at 30 % of the theme's yellow it read brown.
- **A topic closed before it was seen** kept its desktop notice, and the dock its count, for good
  (the human, on a real desktop). Every change now closes the notices of topics closed, seen, or in
  a project out of the mode or deleted (`closeStaleTopicNotices`).

> Left on 2026-11-12: built in the small tasks (commit 2bd4a3f); their rows point to their docs.
| 1.87 | Amends 1.49 (the human, 2026-11-12): the statusline bar drops the all-time `$… total`; it shows the cost since the last compaction only (`set · 22% · $12.40`). Not built yet | 2026-11-12 | this row (until built) |
| 1.88 | A file's right-click menu in the sidebar's Files section gains "Move to Trash" (the human left trash or delete to `set`, 2026-11-12: trash, recoverable, as 1.66). Not built yet | 2026-11-12 | this row (until built) |
| 1.92 | When `start_session` starts a session with the name of a stopped session of the project (no tab), the stopped one becomes an earlier conversation of the new one, as after `renew` (1.63, 1.70), bringing its own earlier conversations; the sidebar never shows two rows with one name from it (the human, 2026-11-12, after `set` restarted `b1`). Not built yet | 2026-11-12 | this row (until built) |
| 1.96 | A double-click on a topic in the sidebar's Topics section sets it to "discussing", selects the orchestrator's tab and posts to the orchestrator "[Menkar] The human wants to discuss topic N" through the same cross-session messaging as the wakes (1.72); nothing is typed into its terminal (the human, 2026-11-12). Not built yet | 2026-11-12 | this row (until built) |
| 1.97 | Amends 1.88 (the human, 2026-11-12): "Move to Trash" on a file open in a Menkar file tab trashes it and closes its tab; a tab with unsaved edits asks first with the tab's own close question, and Cancel cancels the trash | 2026-11-12 | this row (until built) |

> Left on 2026-11-13: 1.107 built.
| 1.107 | Four profiles in the orchestration mode (the human, 2026-11-13): the **orchestrator**; an **expert**, a worker under the orchestrator that always implements one part of the system, with its skill (e.g. the session that runs releases); a **generalist worker**, under the orchestrator, in its repository; a **consultant**, always loose, answering anyone (the human, the orchestrator, another session) and not executing for the orchestrator. No new mark: a loose session with a role label is a consultant, a session under the orchestrator with a label an expert, without one a generalist. The sidebar's "Experts and consultants" becomes "Consultants"; experts show nested under the orchestrator with their label. Not built yet | 2026-11-13 | this row (until built) |

> Left on 2026-11-13: 1.108 built.
| 1.108 | Menkar remembers the model a session was started with (`models` in `state.json`, like `remote_control`) and passes it again with `--model` when the session renews; it follows a `/clear`, a resume and a reused name. `--model` sets the session's model only and never the user's default, unlike `/model`, which only the human can type (the human, 2026-11-13, topic 17). Not built yet | 2026-11-13 | this row (until built) |

> Left on 2026-11-13: 1.111 built, with the "Report to" rename the human added.
| 1.111 | Starting specialists (the human, 2026-11-13, topic 18): the blue banner's button becomes "Back to reporting to the orchestrator" / "Volver a reportar al orquestador" (it ends "with you"); the row menu's "Take back from the orchestrator" becomes "Stop reporting to the orchestrator" / "Dejar de reportar al orquestador" (it makes the session loose); `start_session` gains `loose: true` (no parent: a consultant) and `role` (the label the session is born with); changing an existing session's role stays the human's, from the row menu, with no tool for it. Not built yet | 2026-11-13 | this row (until built) |

> Left §3 on 2026-11-13: plan 36 written.
| 1 | `36-work-view.md` — delegated tasks with steps, the Work view, the Board | Stub, being designed by `set` with the human, 2026-11-13 |

## 2026-11-13 — plan 36 closed (built by `b1`)

| 1.112 | The work view (the human, 2026-11-13, mock-ups M1 and M3): in the orchestration mode the sidebar has a switch "Work | Team" at its top, **Work by default**; Team is today's sidebar; Work shows count tiles, "Waiting on you", the delegated tasks with their steps ("3/5 · building .deb"), and "Done today". A **Board** opens as a tab among the others (columns by the work's state, every task), from a "Board" button right of the header's Orchestration switch (only in the mode) and from a "See all (N) →" at the end of the Tasks section when they don't fit; if open, both select it. Tasks are new data, through Menkar's MCP like topics. Not built yet | 2026-11-13 | `plans/36-work-view.md` (until delivered) |
| 1.113 | A task's life (the human, 2026-11-13, topic 19): the orchestrator creates a task when it delegates (title, assignee by name) and the handoff names its number; the assignee splits it into 3 to 7 short steps and reports each advance with a one-line note; states queued → in progress (step n of m) → waiting (on a named topic or session) → to review (the assignee says done) → done or dropped, which only the orchestrator sets, after reviewing. Not built yet | 2026-11-13 | `plans/36-work-view.md` (until delivered) |
| 1.114 | Amends 1.78 point 6 and 1.100 (the human, 2026-11-13): **the ★ belongs to a task, not a session.** The human sets it from a task (right-click in the Work view or the Board), or the orchestrator when the human asks, at `task_add`; a session row shows ★ while its current task has one, and the row menu's "Priority" goes; a topic may name its task, and topics of ★ tasks come first; wakes of sessions on ★ tasks reach the orchestrator first; a session's saved ★ in `projects.json` is read and dropped. Not built yet | 2026-11-13 | `plans/36-work-view.md` (until delivered) |
| 1.115 | The Work view's sections (the human, 2026-11-13, topic 20): from the top, count tiles, **Topics** (everything waiting on the human is a topic: a review that is the human's reaches them as a topic; no separate "waiting on you"), the tasks, a **Consultants** section (one compact row per consultant with its state dot, a click opens its tab; consultants raise topics, never get tasks), and **Done today** (topics closed and tasks done since local midnight), **folded by default**; Consultants and Done today fold like other sections and their state is saved. Expect 3–4 consultants in a project like ccai. Not built yet | 2026-11-13 | `plans/36-work-view.md` (until delivered) |
| 1.116 | The Board and tasks in the Team view (the human, 2026-11-13, topic 21): the Board tab has columns Topics · Queued · In progress · Waiting · To review · Done; a card shows title, assignee with its state dot, steps and the current note; a click selects the assignee's tab; read only; done tasks of today shown, older ones folded under "Done before". In the Team view each session row shows its current task and step under its name. Not built yet | 2026-11-13 | `plans/36-work-view.md` (until delivered) |
| 1 | `36-work-view.md` — delegated tasks with steps, the ★ on tasks, the Work view, the Board | Written 2026-11-13, ready; to `b1` |

### Plan 36's execution log, verbatim


Executed by `b1`, 2026-11-13, blocks 1 to 5 in order, each ending with `npm run ci` (the
test-integrity step red only on the six accepted lines below; flaky and history run by hand, green).

- **Accepted integrity lines (block 2):** six `expect(` lines left: the row menu's labels with
  "Priority", `orchestration.priority` after a reused name, and four `shownTopics(...)` lines whose
  first argument was the project's session ★ (`{ orchestration: { priority } }` or `{}`); the
  function now takes the starred task numbers. Their cases are kept with tasks.
- **Work by default changed what existing specs see:** the orchestration and session-control specs
  that read team rows now seed `team_view: true` or click "Team"; no expect changed for it.
- **Not anticipated:**
  - `showSession` already existed (showing a hidden member); selecting the assignee's tab is
    `selectSessionTab`, which starts nothing when the session has no tab.
  - `TaskState` lives in `src/core/orchestration/taskState.ts`, apart from the store, so the window
    can name it without the store's Node imports (one definition, no parity test needed).
  - A line of a doc cut in the middle reaches its history whole (the history check compares whole
    lines).
  - "Done today" is computed when a window state is built; past midnight it changes at the next
    state push, not exactly at 00:00.
- **b1's choices (labelled in the report):** `task_progress` without `step` keeps the current step;
  `task_steps` on a task already in progress re-plans it at step 1; the tiles count tasks in
  progress ("working") and waiting, not sessions; the Work view keeps the Files section at the
  bottom; a click on a task row (not only a Board card) selects its assignee's tab; the Board's
  Done column shows dropped tasks struck through.
- **The human decided (through `set`, 2026-11-13)** the question b1 left open: switching the mode
  off closes the project's Board tab in every window (`closeBoards`), tested in `layout.test.ts`
  and `work-view.spec.ts`, both seen failing first.
- **ui-check:** the first full run had one failure outside this plan, `terminal.spec.ts:607` (the
  window told when an agent reaches the foreground), green 3 of 3 alone: load-sensitive.

> Left §3 on 2026-11-13: plan 37 written.
| 1 | `37-worker-per-task.md` — a worker per task, parking and resuming, the cap | Stub, being designed by `set` with the human, 2026-11-13 |

## 2026-11-13 — plan 37 closed (built by `b1`)

| 1.55 | Amends 1.5 (the human, 2026-11-11): `set` runs from Menkar's own repository and decides which plan or task each worker takes; the workers stay two, `b1` and `b2` — a third was weighed before and rejected, since the sessions' work overlapped too much | 2026-11-11 | `CLAUDE.md` · `plans/ROLE-ORCHESTRATOR.md` |
| 1.118 | **A worker per task** (the human, 2026-11-13): the orchestrator starts a new generalist worker for each task instead of reusing fixed ones, named `<project>-t<task number>` (names must be unique across the machine: cross-session messages go by name); a worker whose task waits long (a PR under review) is **parked** — stopped, transcript kept — and **resumed by name** with its context when the wait ends; when its task closes it is hidden; a per-project cap on workers running at once, **unlimited by default**, parked ones not counted. Amends 1.55 for this repository (b1 and b2 give way to per-task workers; its reason, overlapping work, is kept by a cap of 2). Usage per task is not changed. Not built yet | 2026-11-13 | `plans/37-worker-per-task.md` (until delivered) |
| 1.119 | Experts and several tasks (the human, 2026-11-13): an expert may hold several tasks, **one in progress** at a time, the others waiting or queued; the orchestrator gives it another only while its current one waits on something outside (a long build), naming the task in every message, and gives no third. When an area needs real parallel work, the orchestrator starts a per-task worker that **loads the expert's skill read only**; **a skill has one keeper**, the named expert, the only one that distills it; a worker's lesson for that skill goes in its report and the orchestrator hands it to the expert. Generalist workers hold one task. Not built yet | 2026-11-13 | `plans/37-worker-per-task.md` (until delivered) |
| 1.120 | Plan 37's details (the human, 2026-11-13, topics 22–24): parked workers show apart in the Team view, in a folded "Parked · N" row under the orchestrator, each with what it waits on; a closed task's worker is hung up and hidden **at once**; the cap on workers running at once is set in **Settings → Work**, per project, empty = unlimited. Not built yet | 2026-11-13 | `plans/37-worker-per-task.md` (until delivered) |
| 1.121 | The first-time card also asks for the cap on workers running at once ("Workers at once", a number field, empty = unlimited by default), saved as the project's cap; Settings → Work → Orchestration changes it later (the human, 2026-11-13). Not built yet | 2026-11-13 | `plans/37-worker-per-task.md` (until delivered) |
| 1.122 | Amends 1.120's place for the cap (the human, 2026-11-13): orchestration settings are the project's, not the app's — **no Orchestration section in Settings**; the project popover's mode icon opens (right-click, or an "Orchestration settings…" item) a small dialog with that project's orchestration settings, the cap on workers at once first; the first-time card still asks for it (1.121). Not built yet | 2026-11-13 | `plans/37-worker-per-task.md` (until delivered) |
| 1.123 | The orchestrator can change its project's orchestration settings (the cap first) with an MCP tool, `set_workers_cap { cap }` (empty = unlimited), only when the human asks it explicitly; refused to anyone but the orchestrator (the human, 2026-11-13). Not built yet | 2026-11-13 | `plans/37-worker-per-task.md` (until delivered) |
| 1 | `37-worker-per-task.md` — a worker per task, parking and resuming, experts with several tasks, the cap | Written 2026-11-13, ready; to `b1` |

### Plan 37's execution log, verbatim


(Written by the session that executes it: `b1`, 2026-11-13.)

### What was built, and where it deviates

- **Pure rules in a new `src/core/orchestration/workers.ts`**: `workerName`, `startName`,
  `workerTeam`, `isWorker`, `startsWorker`, `runningWorkers`, `atCap`, `capRefusal`, `mayPark`,
  `hideOnClose`, `capTool`. Tasks gained `assignTask` and `untakenRefusal`; `Task.assignee` is
  optional; the one-in-progress rule is in `taskTool`.
- **`start_session`'s schema no longer requires `name`** (with `task` it may be omitted): the
  expect asserting `required: ['name']` in `tests/core/control/server.test.ts` was rewritten to
  `toBeUndefined()`, accepted by `set`; the guarantee moved to `startName`'s test (neither name
  nor task → refused). `npm run ci` reports this one line under test integrity until committed.
- **Parking and closing share one mechanism** (`stopAfterTurn` in `src/main/workspace.ts`): at once
  when the pane's shown state is idle or done, else at the Stop hook's record or the next idle
  check (renew's interval). Renew's own map is untouched.
- **`resume_session` refreshes the session list first**: the stand-in's transcript was not yet in
  the list when it was asked, and the session read as no Claude session.
- **A parked mark is cleared on resume and on close only**; the Team view shows a parked session
  under "Parked" only while it has no tab, so a parked worker the human reopens by hand shows as
  a plain child (`rows.test.ts`).
- **The e2e types for the worker after "Take control"**: its tab is read only under the
  orchestrator, as decided (1.101).
- **`ProjectInfo.orchestration` gained `parked` and `workersCap`**: the e2e constant `marks` in
  `e2e/orchestration.spec.ts` (data, not an expect line) and the factories in `rows.test.ts` got
  the two keys.
- **Nothing was built in Settings** (1.122 arrived before block 3).
- **`docs/session-control.md` counted "nine tools"** (already stale at fifteen); the count left
  prose ("The tools (`TOOL_NAMES`)"), with its history.

### Choices of mine (labelled)

- `workerName` of a project whose name has no `[a-z0-9]` at all: `project-t<N>`.
- A cap is a whole number from 1; `0`, negatives, fractions and strings read as absent (lenient).
- `resume_session` refuses a non-Claude session ("Only a Claude Code session is resumed."): a
  prompt could not reach it.
- The card's and the dialog's field: a value that is not a whole number from 1 shows a toast and
  saves nothing (the card stays open).

### Not anticipated

- An intermittent Vitest failure inside `npm run ci`, twice in about ten runs, not reproduced in
  eight more; its name was lost to an output filter. Not traced to this plan's files.

### Closing

The plan is not deleted by `b1`: its exit includes `plans/ROLE-ORCHESTRATOR.md` and
`plans/00-STATUS.md`, which are `set`'s.

### Answers from `set` (2026-11-13)

1. The cap bounds workers: only a start or resume of a session that would itself count (the
   orchestrator's child, no role, not loose) is refused at the cap.
2. Parking is for per-task workers (1.118): only the orchestrator's child with no role label whose
   current task waits; an expert is never parked.
3. `task_close` on an assignee mid-turn: hung up after its turn, as park and renew do, never
   mid-turn; at once if idle; then hidden.
4. `start_session { task }` on a task assigned to another session, open or parked, is refused
   ("Task N is assigned to ‹name›."): moving it would lose the context 1.118 keeps. A task with no
   assignee takes the worker; a closed one is refused.

### Additions from `set` (2026-11-13)

- 1.121 (the human): the first-time card's "Workers at once" field, in block 3.
- 1.123 (the human): the MCP tool `set_workers_cap`, in block 1.

### The settings dialog's entry (the human, 2026-11-13)

Asked through `set` with three options (right-click the mode icon; a one-item menu on right-click;
a gear beside the mode icon), the human chose the gear, shown only while that project's mode is on,
with no right-click behaviour. Replaced in §2.5: "The project popover's mode icon (right-click), or
an "Orchestration settings…" item there, opens a small dialog"; in block 3: "from the popover's mode
icon (right-click) or an "Orchestration settings…" item".

### Lines replaced by 1.122 (the human, 2026-11-13)

- §2.5: "**Settings → Work → Orchestration** (a new section in the Work group): one row per project
  with the mode on, a number field, empty = unlimited."
- Block 3: "Settings → Work → Orchestration: a cap row per project with the mode on; strings
  en/es."
- Block 3's title: "Block 3 — Team view and Settings".
- Block 3: "Spec and screenshots `‹name›-parked.png`, `‹name›-settings-cap.png`."
- Exit: "`docs/preferences.md`: the Orchestration section in Settings' Work group."
- §1 "What already exists": the Settings sections line no longer applies.

> Left on 2026-11-14: 1.126 gains the drawer rule.
| 1.126 | Amends 1.112 and 1.116 (the human, 2026-11-14, from mock-ups): **the Board is a panel, not a tab** — between the header and the tab strip, across the right-hand area; the header's "Board" button toggles it, light blue while open; default height fits two cards per column (about 165 px, not a percentage); a divider resizes it; "Show all" grows it to every card, at most 70 % of the height; "Default size" goes back; per project, `projects.json` keeps whether it is open and its last height, so it reopens as it was after a restart; "See all (N) →" opens it on Show all; switching the mode off closes it; a saved Board tab is dropped. Not built yet | 2026-11-14 | this row (until built) |

> Left on 2026-11-14: 1.124 and 1.125 built by menkar-t1 and menkar-t2, tasks 1 and 2.
| 1.124 | **A project's folders** (the human, 2026-11-14, topic 25): the folders of all its sessions, running or not, earlier conversations included (each session's `cwd`), plus folders the human adds by hand in the project's orchestration settings (the gear: a "Folders" list, added through the system's chooser, removable; the automatic ones are not). `start_session` gains `folder`, accepted only when it is one of the project's folders, refused otherwise with a sentence listing them; `Ctrl+\`` in the orchestrator's tab and the first-time card offer the same list. A plan touching several repositories becomes one task per session and folder. Not built yet | 2026-11-14 | this row (until built) |
| 1.125 | Every post Menkar sends **to the orchestrator** ends, after its time, with the Work view's three counts — `[Menkar] packager finished its turn (08:47:33) · 2 topics · 1 working · 1 waiting` (open topics, tasks in progress, tasks waiting) — so the human, following the orchestrator from their phone through Remote Control, sees the team's state: the statusline does not reach the phone and the session title is its name (claude-cli, 2.1.325, 2026-11-14); the posts were seen on the phone (the human, 2026-11-14). Posts to other sessions are unchanged. Not built yet | 2026-11-14 | this row (until built) |

> Replaced 2026-11-14: 1.126 built (task 3).
| 1.126 | Amends 1.112 and 1.116 (the human, 2026-11-14, from mock-ups): **the Board is a panel, not a tab** — between the header and the tab strip, across the right-hand area; the header's "Board" button toggles it, light blue while open; default height fits two cards per column (about 165 px, not a percentage); a divider resizes it; "Show all" grows it to every card, at most 70 % of the height; "Default size" goes back; per project, `projects.json` keeps whether it is open and its last height, so it reopens as it was after a restart; "See all (N) →" opens it on Show all; switching the mode off closes it; a saved Board tab is dropped; it never overlaps the shell drawer nor takes its height — its space comes from the agent's pane (the human, 2026-11-14). Not built yet | 2026-11-14 | this row (until built) |
> Replaced 2026-11-14: the index's date.
> Last updated: 2026-11-12.

> Replaced 2026-11-14: Gemini CLI left out (its sign-in for individuals no longer served).
| 1.133 | The multi-agent design (1.127, 1.129) is made with the research of **Codex, Cursor, OpenCode and Gemini CLI** beside Claude Code: OpenCode by the human's wish, Gemini by `set`'s, the human leaving it to them since nothing else waits on it; Pi is left out (another public; reconsidered if asked). Each agent gets a loose consultant whose research mirrors `plans/ideas/research/codex.md`; Codex is still the first to be built (the human, 2026-11-14) | 2026-11-14 | this row · `docs/NOT_BUILT_YET.md` |

> Replaced 2026-11-14: 1.130 and 1.131 built (task 5).
| 1.130 | In the Usage window's Totals, a project's **category rows** (the Software Development Lifecycle's Plan, Design, Build, Test, Deploy, Maintain, Other, shown while classification is on) **open collapsed**: the project shows its categories, each with ▸, and a click shows its sessions; projects open expanded as before. What is expanded is kept while the window is open, as today (the human, 2026-11-14, from a screenshot). Not built yet | 2026-11-14 | this row (until built) |
| 1.131 | The Usage window never shows figures of another period or scope while a report is on its way: on a change of period, month, view's scope or "All projects", the Totals and the chart give way to Menkar's turning star until the new report arrives (the human, 2026-11-14: switching 7 days to a month kept the old numbers for 3–5 s). Why a report takes seconds is measured before anything is changed. Not built yet | 2026-11-14 | this row (until built) |

> Replaced 2026-11-14: 1.132 built (task 7).
| 1.132 | Amends 1.126's default height (the human, 2026-11-14, from a screenshot where one card and a bit showed): the Board's default height is measured from a **full sample card** — a two-line title, the assignee line, the step bar and a note line — so two real cards fit; still one fixed height, not measured from the cards shown. Not built yet | 2026-11-14 | this row (until built) |

> Closed 2026-11-14: 2.22 decided as 1.136 (a separate branch).
| 2.22 | How multi-agent support lands without destabilising what ships: it touches many parts, so the human wants a stable package now (2026-11-14, from HEAD cff7630) and expects the next one to need much validation. Options for the architecture phase (1.135): build it on a branch, merged when validated; or on main behind the agent entries (an agent not enabled until validated, as `NOT_BUILT_YET.md` already says per platform) with Claude Code's path covered by the existing suite; plus which hand checks `docs/release-checklist.md` gains | Human, at the architecture (1.135 step 2) | The multi-agent implementation |

> Replaced 2026-11-14: an agent's integrations items greyed, not hidden, while it is not installed (the human).
| 1.140 | Plan 38's D13, D7, D6 and D21 (the human, 2026-11-14): **two separate integrations-menu items for Cursor**, each consented and removable on its own — Menkar's three turn hooks in `~/.cursor/hooks.json` (they run in every Cursor session; outside Menkar they exit at once without `MENKAR_PANE`), and the allow entries for Menkar's tools in `~/.cursor/cli-config.json` (`--force` rejected: it approves everything). Without them Cursor still works with less, and the page says what is lost. **An agent's integrations items are not shown while that agent is not installed** (its CLI not found on the PATH). **Codex's turn end is `-c notify` per session, chaining the user's own `notify`** (read from their `config.toml`, never written). The `user_email` Cursor's hooks carry is never stored or logged | 2026-11-14 | `plans/38-multi-agent.md` (until built) |

> Replaced 2026-11-14: the rules file moved to `AGENTS.md` (1.143); these rows point there now.
| 1.135 | How multi-agent support reaches code (the human, 2026-11-14): **(1)** the design and plan (what is unified, what stays native, D1–D13) is reviewed by a fresh Fable 5.2 session, then by the human, who tries it with `set`; **(2)** once approved, a **software architecture** for it — patterns, module organisation, the line between common and per-agent code — is written by another session, not necessarily `set`, and reviewed by a Fable 5.2 session (the same or a new one); **(3)** only then implementation starts. The code divides per-agent behaviour as strategies, one per agent behind each concern's interface, never `if`/`else` on the agent in shared code, so a change for Cursor cannot break Claude Code (`CLAUDE.md`) | 2026-11-14 | this row · `CLAUDE.md` |
| 1.137 | Plan 38's D22 (the human, 2026-11-14): a **Cursor worker** started by `start_session` keeps `<project>-t<N>` as its name in Menkar's own data for good, since nothing outside Cursor can name a chat; Cursor's generated title is not shown for it — the name only has to let sessions message each other; a `/rename` by the human is followed. Cursor sessions the human starts keep Cursor's title. An exception to "the name is the one the agent has", for workers of an agent that cannot be named from outside; `CLAUDE.md` says so when plan 38 is built | 2026-11-14 | `plans/38-multi-agent.md` (until built) |
| 1.139 | Plan 38's D17 and D5 (the human, 2026-11-14): Menkar never writes an agent's files, but **an agent may write its own data at Menkar's request, through its own API, only for what `docs/agents.md` names** — today: OpenCode's session title at creation (`opencode.db`); **Codex's name set after its first turn** (`thread/name/set`, so a worker is `<project>-t<N>` on Codex's side too, seen outside Menkar); one queue row per wake in Codex's `queue_1.sqlite` and OpenCode's inbox in `opencode.db`, deleted on delivery. Claude's `-n` was already this. Any further such write is a decision for the human first. `CLAUDE.md`'s rule "the agents' data is read, never rewritten" is reworded to say so when plan 38 is built | 2026-11-14 | `plans/38-multi-agent.md` (until built) |

> Replaced 2026-11-14: plan 38 approved; its architecture queued.
| 1 | 38 — more coding agents: Codex, OpenCode, Cursor in the orchestration mode | Design for review (1.135 step 1): Fable 5.2, then the human |

> Replaced 2026-11-14: 1.144 and 1.145 built (tasks 14, 15).
| 1.144 | The orchestrator can set or remove a task's ★ with an MCP tool, `task_star { number, star }`, **only when the human asks it explicitly** (the ★ is theirs, as the cap is in 1.123); refused to anyone but the orchestrator, in the orchestration mode. The orchestrator skill says so (the human, 2026-11-14) | 2026-11-14 | `docs/orchestration.md` · `docs/session-control.md` (when built) |
| 1.145 | A task card's title on the Board is **clamped to two lines** with an ellipsis, the full title in its tooltip, so every card is as tall as the full sample card the default height is measured from (1.132) and two cards always fit (the human, 2026-11-14, from a screenshot where a three-line title hid the second card's step bar). Not built yet | 2026-11-14 | this row (until built) |

> Replaced 2026-11-14: 1.146 built (task 16); the Work view's count says "for you".
| 1.146 | What the UI calls **topics** is renamed (the human, 2026-11-14), so it says whose turn it is: **"Awaiting you" / "Pendientes tuyos"** for the sidebar's section and the Board's column, "awaiting you" / "pendientes" for the Work view's count, "Item N" / "Pendiente N" for a notice; "Needs review" rejected (read as code review), "Waiting on you" rejected (clashes with the Board's Waiting column), "Pending on you" not idiomatic. **Only what the user sees** changes: the MCP tools (`topic_add`, `topic_close`…) and the word "topic" in code and docs stay, since other projects' orchestrators already use them. Not built yet | 2026-11-14 | this row (until built) |

> Replaced 2026-11-14: "another day" is unclear, so it is asked (the human).
| 1.149 | When the human defers work, the orchestrator reads the horizon (the human, 2026-11-14): **"tomorrow", "another day", a named day** — near and meant → a task in the queue; **"in the future", "someday we'll improve it"** — not near → no task: it goes where the project keeps deferred work with its trigger (here `docs/NOT_BUILT_YET.md`); **unclear → ask** the human whether to queue a task. Built with 1.148 (task 17), in the orchestrator skill | 2026-11-14 | this row (until built) |

> Replaced 2026-11-15: plan 39 goes once plan 40 is settled (the human).
| 1 | 38 — more coding agents: Codex, OpenCode, Cursor in the orchestration mode | Design approved, D1–D22 decided (1.137–1.143). Next: plan 39, its software architecture (1.135 step 2), by a new Opus session with `/design-plan` — **queued until the human says go** (2026-11-14); its launch prompt is `prompts/PROMPT-architect.md` |

> Replaced 2026-11-15: plan 39 written (the architect, task 13).
| 3 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3) | Being written by the architect (task 13), 2026-11-15; then its Fable 5.2 review, then the human; no implementation until the human says so |

> Replaced 2026-11-15: plans 40 and 39 progressed.
| 2 | 40 — the team block (1.150), stored skills and "Configure role…" (1.152), a generic `specialize`, the orchestrator skill's task rules (1.148, 1.149) | Being designed by `designer-40` (task 22), 2026-11-15; ships on `main` before the multi-agent work |
| 3 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3) | Written by the architect (task 13), 2026-11-15, with 1.155 folded in: P0 (9 blocks, merged to `main`), P1a 7, P1b 6, P2 7, P3 5, a close; next its Fable 5.2 review, then the human; no implementation until the human says so |

> Replaced 2026-11-16: plan 39's review folded in.
| 1.159 | Plan 39's review decisions (the human, 2026-11-15, all as the reviewer recommended; `plans/ideas/research/review-39.md`): B1 the sandbox refuses resume, add, trash and delete for a session it did not start, and its projects take names no daily project has; B3 a saved tab of a known agent whose session is not found is kept with one `[Menkar]` line; S6 Cursor's prompt text is kept in Menkar's hook log only while the classifier is on; S7 a facts change for an idle Cursor session waits for its next wake; S11 the classifier stays off in the sandbox. **The classifier becomes configurable per agent** when multi-agent support lands: Haiku through `claude -p` needs Claude Code, so a user without it, or preferring another agent, chooses which agent and model classify turns, where feasible | 2026-11-15 | `plans/39-multi-agent-architecture.md` (until built) |
| 3 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3) | Written (48a3efa) and reviewed by Fable 5.2; **its findings are not folded in yet** (`plans/ideas/research/review-39.md`; decisions 1.157–1.159); the next editor folds them, then P0 waits for the human's go and for plan 40 on `main` |

> Replaced 2026-11-16: plan 40 delivered; its rows point at the docs, 1.84 and 1.109 amended (task 36).
| 1.84 | After the final review of Menkar's skills (the human, 2026-11-12): a renewed session's **handoff note is its renew prompt** (who it is, the skill to load, what is in flight), never a file; **only the orchestrator orchestrates** — another session never starts sessions or acts as one; it may ask the orchestrator to delegate work to an existing expert session, and may always use its own subagents for research, discovery or review (amends 1.70's "any session may start others"; enforced in the tool once the orchestrator is marked, plan 34); Menkar's four skills declare their admission criterion, the case-per-rule of 1.83 binds only role skills | 2026-11-12 | `docs/session-control.md` |
| 1.109 | Context in the orchestration mode (the human, 2026-11-13): the orchestrator decides when the sessions under it (experts, workers) distill and renew, between tasks; a consultant (loose) manages its own: when a consultation closes and its row in `list_sessions` is past the yellow mark, it distills and renews with a prompt naming its skill, preferring that to a compaction; an expert past the red mark tells the orchestrator instead of renewing. The rule lives in `menkar:specialize` and so in every role skill, and reads the session's parent at that moment (no separate skills per profile). The orchestrator raises a topic when a consultant is past the red mark, without messaging it | 2026-11-13 | `plugin/skills/specialize/SKILL.md` · `plugin/skills/orchestrator/SKILL.md` |
| 1.148 | Everything delegated shows on the Board (the human, 2026-11-14): **every request that needs more than a short answer gets a task** — to a worker, to an expert (a .deb from the packaging expert was missing), and to a consultant (a research, a probe, a review); a short question to a consultant needs none. A task that waits on something outside (a build, a hosted CI, a release) is set to **waiting** with a note saying on what, so working and waiting stay apart. The orchestrator skill says so. Not built yet: queued for another day | 2026-11-14 | this row (until built) |
| 1.149 | When the human defers work, the orchestrator reads the horizon (the human, 2026-11-14): **"tomorrow" or a named day** — near and meant → a task in the queue; **"in the future", "someday we'll improve it", "tolerable for now"** — not near → no task: it goes where the project keeps deferred work with its trigger (here `docs/NOT_BUILT_YET.md`); **"another day" and anything unclear → ask** the human whether to queue a task. Built with 1.148 (task 17), in the orchestrator skill | 2026-11-14 | this row (until built) |
| 1.150 | **The team block** (the human, 2026-11-15, from `plans/ideas/team-protocol.md` and the research in `plans/ideas/research/mcp-instructions.md`): what a session needs to work in the team — who it is, its role, parent and orchestrator, which skills to load, and the protocol (messaging by name, the report as the last message, a non-parent also gets it by name, `[Menkar]` posts are the app's, renew with a handoff) — is written **once**, filled per session, and delivered by Menkar to every session of a project **with the orchestration mode on**; the four skills point to it instead of repeating it. **Kept as compact as possible**: it costs tokens in every session. For Claude it goes with **`--append-system-prompt-file`** (system-prompt weight, no 4,096-character cap, present before the first prompt; MCP `instructions` rejected for Claude: a conversation message, capped, may arrive after the first prompt, framed as tool usage). Its source is a common part plus one communication part per agent (`plugin/team/`); how each other agent receives it is that agent's strategy, researched with the multi-agent work | 2026-11-15 | this row (until built) |
| 1.152 | **A session's skills are stored by Menkar**, several allowed, each marked kept or read only (one keeper per skill, 1.119), and named in its team block; **only the human sets them**, in a **"Configure role…" window** that replaces the row menu's "Role…" (the role's label and its skills, chosen from the skills Menkar finds: the plugin's, the project's `.claude/skills/`, the user's). Where things go in that window is decided with a mock-up. A change reaches a running session **at once**, through a `[Menkar]` post (the block of a resumed Claude session is otherwise frozen until its next compaction). `specialize` becomes generic: no Menkar, no team protocol, no policy copied into role skills; at its end it asks the human to set the skill it wrote (the human, 2026-11-15) | 2026-11-15 | this row (until built) |
| 1.154 | Plan 40's choices (the human, 2026-11-15): the "Configure role…" window is **mock-up C** (one checklist of the skills found, grouped by source, with a filter; ticking adds a skill and shows its switch on its line; skills not found listed first under "Not found" with Remove) — chosen because only the project's and the user's own skills are listed (installed plugins' and MCP servers' skills are not: they are available to every session already, and nobody in the team maintains them), about 10–15 per project; **Menkar's own skills never show in the window** — how they are stored and delivered is Menkar's choice; the switch reads **"Maintainer · Read only"** ("Mantiene · Solo lectura"), the data's `keep` named `maintainer`; a stored skill no longer found stays flagged until the human removes it. Q1: the context policy (1.109) is one line of the block per profile, with the human's own percentages; Q2: switching the mode on posts the whole block to each running session of the project, off posts one line; Q3: the orchestrator mark and the parent also trigger the at-once post | 2026-11-15 | `plans/40-team-block.md` (until built) |
| 1.157 | Plan 40's and plan 39's pending points (the human, 2026-11-15): **S1** the four skills stay usable with the orchestration mode off, each pointing in one line to the block's section, else to `plugin/team/*.md`; **Q4** Menkar reads `claude --version` once per binary; below the flags' floor, mode-on sessions start without the team block, it is logged and one toast per run says to update Claude Code; **Q5** "Configure role…" lists **only the skills a session can load: those of its own folder's repository** (its folder up to the repository root) and the user's — a project's other repositories' skills are not shown, since a session cannot load them; **P1** the sandbox build (1.155) may install outside `/opt/Menkar` a second AppArmor profile and `/usr/bin/menkar-sandbox`, under its own package name so apt never treats it as an upgrade of `menkar` | 2026-11-15 | `plans/40-team-block.md` · `plans/39-multi-agent-architecture.md` (until built) |
> Replaced 2026-11-16: plan 40 delivered.
| 3 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3) | Written and reviewed by Fable 5.2, every finding folded in (2026-11-16, §2.16); Q-a (P0.1 and P0.2 on `main` before the branch) and Q-b (the per-agent classifier as P1a.8) wait for the human; P0 waits for plan 40 on `main` and the human's go |
> Replaced 2026-11-16: the index's date.
> Last updated: 2026-11-14.

> Left §3 on 2026-11-16: plan 40 closed.
| 2 | 40 — the team block (1.150), stored skills and "Configure role…" (1.152), a generic `specialize`, the orchestrator skill's task rules (1.148, 1.149) | **Approved; being built** (2026-11-15): blocks 1–3 committed (abe0742, 0e366f3); block 4 (task 33) waits on `claude-cli`'s task 28 (`--system-prompt-snapshot off` over many requests — the run across a midnight left); then block 5 ("Configure role…", mock-up C) and block 6 (close); then a .deb for the human's other project |

> Closed 2026-11-16 — plan 40, "The team block, stored skills, a generic `specialize`", designed by
> `designer-40` (task 22), reviewed by a Fable 5.2 session (task 26), built by per-task workers
> (tasks 30–33, 35) and closed by `menkar-t36` (task 36). A mode-on Claude session starts with a
> team block appended to its system prompt (`--append-system-prompt-file`, a resume also with
> `--system-prompt-snapshot off`) saying who it is, its role, parent and orchestrator, the skills
> to have loaded and how the team talks; running sessions get coalesced `[Menkar] Team update:`
> posts when their facts change, whose turns wake no parent and are passed over by `last_reply`.
> Skills are stored per session by the human in "Configure role…" (mock-up C), one maintainer per
> skill; the four skills point to the block, `specialize` is generic, and the orchestrator skill
> holds 1.148 and 1.149. Deviations: it landed in four commits (blocks 1–2, 3, 4, 5), not one;
> the version floor is Claude Code 2.1.267 (the snapshot flag is in the changelog there, in the CLI
> reference at 2.1.257), and a CLI whose version cannot be read starts without the flags too;
> task 28 measured the snapshot flag's cost as nil (the `system` text stayed byte-identical over
> 12 requests across a branch, a commit and a new file), so it is passed on every resume and the
> "only when the block changed" record was not needed; a session with no name is called by its
> id's first eight characters in another's facts; main's side lives in `src/main/team.ts`, the
> input in `src/core/team/input.ts`, the floor in `src/core/team/version.ts`. The plan's execution
> log was left empty by the blocks; this note is built from their commits and the docs. At the
> close, four of §2.10's rejections that had not reached `docs/session-control.md` were added,
> `docs/orchestration.md`'s rejection of "Tasks for consultants" (false since 1.148) left for its
> history, and "keeper" became "maintainer" in two docs (with `set`'s ok). Left to the human: the
> hand check on the real Claude Code (`docs/release-checklist.md`, 8b). How it works is in
> `docs/session-control.md` ("The team block"), `docs/orchestration.md`, `docs/projects.md` and
> `docs/context.md`; the per-agent parts are deferred in `docs/NOT_BUILT_YET.md` (plan 38's P1a).

> Replaced 2026-11-16: 1.163 built (task 39).
| 1.163 | `list_sessions` gives **each session's folder** and the **project's folders** (its sessions' folders and the ones the human added, 1.124), so the orchestrator knows where `start_session { folder }` may start a worker without a refused call (the human, 2026-11-16, topic 31, from ccai's first start). Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16: 1.164 built (task 43).
| 1.164 | **Whom a task under review waits on**, built now, ahead of the flow metrics (the human, 2026-11-16, prioritised for the other project, where tasks sit in "To review" for long waiting on a pull request): a task in To review carries who it waits on — **the orchestrator** (the default), **the human**, **a PR's approval**, **a PR's merge** — with its note (the PR); the assignee sets it with `task_review`, and the orchestrator can change it after its own review; the card shows it as the waiting tasks' note line already does; **a worker whose task is in To review waiting on a PR can be parked** (it then stops counting toward the cap). The column stays one. The time-per-state metrics stay deferred (1.156) and will read this field | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16: the presence shortcut confirmed.
| 1.167 | The human's presence (1.165), designed (the human, 2026-11-16, topic 33, from mock-ups): set **in Settings**, not a header button; while away, **a thin amber banner under the header of every window** with "I'm back"; **no return time, no note, no dates**; away ends **only by "I'm back"** — or when the human, asked by an orchestrator whether they are back, says so explicitly, and that orchestrator clears it with an MCP tool (orchestrator only, only on the human's explicit answer); writing to an orchestrator by Remote Control does not clear it by itself; **opening Menkar always counts as returning** (the state is not kept across a quit); a new **blocking topic waits for the return**, no notification; "The human is back" goes to **the running orchestrators**; the option shows **only when some project has the orchestration mode on**; desktop notifications are **not** silenced; a keyboard shortcut, proposed `Ctrl+B a` (free today), to confirm | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16: plan 39 being built.
| 2 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3) | Written and reviewed by Fable 5.2, every finding folded in (2026-11-16, §2.16); Q-a (P0.1 and P0.2 on `main` before the branch) and Q-b (the per-agent classifier as P1a.8) wait for the human; P0 waits for the human's go (plan 40 is on `main`) |

> Replaced 2026-11-16: the presence is set from a chip at the sidebar's foot (1.170).
| 1.167 | The human's presence (1.165), designed (the human, 2026-11-16, topic 33, from mock-ups): set **in Settings**, not a header button; while away, **a thin amber banner under the header of every window** with "I'm back"; **no return time, no note, no dates**; away ends **only by "I'm back"** — or when the human, asked by an orchestrator whether they are back, says so explicitly, and that orchestrator clears it with an MCP tool (orchestrator only, only on the human's explicit answer); writing to an orchestrator by Remote Control does not clear it by itself; **opening Menkar always counts as returning** (the state is not kept across a quit); a new **blocking topic waits for the return**, no notification; "The human is back" goes to **the running orchestrators**; the option shows **only when some project has the orchestration mode on**; desktop notifications are **not** silenced; the shortcut **`Ctrl+B a`** sets and clears it (the human, confirmed) | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16 by 1.170: the Settings section "Profile" is dropped; the chip at the sidebar's foot holds Away.
| 1.168 | Settings gains a section **"Profile" ("Perfil")** for what concerns the person themselves, first holding the "Away" switch (1.167); it sits at the top of the Sessions/Notifications/Context group and is listed only while some project has the orchestration mode on, until it holds something else (the human, 2026-11-16, topic 35) | 2026-11-16 | `docs/preferences.md` (when built) |

> Replaced 2026-11-16: the human's presence built (task 48).
| 1.165 | **The human's presence, away or here** (`docs/NOT_BUILT_YET.md`), built as soon as possible without holding P0 (the human, 2026-11-16, topic 32): **global** — the user's own state, Menkar's first piece of user data; **away means "not working, not watching the phone or Remote Control"** — talking to a session through Remote Control is being here, so nothing changes in Remote Control; it concerns **the orchestrator only**, no other session; on return Menkar posts `[Menkar] The human is back` and the orchestrator gives a short preliminary summary first. Where it is set and how it looks are decided with mock-ups. Not built yet | 2026-11-16 | this row (until built) |
| 1.167 | The human's presence (1.165), designed (the human, 2026-11-16, topic 33, from mock-ups): set **from a chip at the sidebar's foot** (1.170), not a header button; while away, **a thin amber banner under the header of every window** with "I'm back"; **no return time, no note, no dates**; away ends **only by "I'm back"** — or when the human, asked by an orchestrator whether they are back, says so explicitly, and that orchestrator clears it with an MCP tool (orchestrator only, only on the human's explicit answer); writing to an orchestrator by Remote Control does not clear it by itself; **opening Menkar always counts as returning** (the state is not kept across a quit); a new **blocking topic waits for the return**, no notification; "The human is back" goes to **the running orchestrators**; the option shows **only when some project has the orchestration mode on**; desktop notifications are **not** silenced; the shortcut **`Ctrl+B a`** sets and clears it (the human, confirmed) | 2026-11-16 | this row (until built) |
| 1.170 | **Where "set me away" goes** (the human, 2026-11-16, topic 36, from mock-ups A–D, replacing 1.168's Settings section "Profile", now removed): **a chip at the sidebar's foot**, above "Add session", reading "● Here · Set me away…" and, while away, amber "● Away · I'm back"; a click toggles; shown only while some project has the orchestration mode on (1.167). The spot is the person's own: later it may open a profile menu holding this and other options (`docs/NOT_BUILT_YET.md`) | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16: Menkar Sandbox's icon chosen (variant A).
| 1.166 | Menkar Sandbox (1.155) looks different at a glance (the human, 2026-11-16, topic 34): **its own icon** (a variant of Menkar's, chosen from a mock-up), and **"Menkar Sandbox" wherever the app shows its name** — the header's title at the top of every window, the window title, About — so the human never works in the wrong one | 2026-11-16 | `plans/39-multi-agent-architecture.md` (until built) |

> Replaced 2026-11-16: the current topic and the specialize/distill wording built (task 51).
| 1.169 | **The current topic** (the human, 2026-11-16, topic 39, from ccai's feedback, no mock-up needed): the topic in "discussing" is the current one; it comes **first** in the Topics section and in `topic_list` (before ★ and blocking ones) and its row carries **a green dot** (the red blocking mark stays); no new section. The orchestrator sets it when it takes a topic up and, on closing one, sets the next. The orchestrator's skill gains (ccai's proposal, 2026-11-16): the chat with the human is a scarce channel; an event that needs nothing from the human produces no visible text (no "nothing new", no "still waiting", no summary): it is processed (status, topics, tasks, messages) and the turn ends; the orchestrator writes only when it needs the human now, inside the topic under discussion; it orders the queue, shows it once, and proposes the next topic on closing one. Not built yet | 2026-11-16 | this row (until built) |
| 1.174 | **A role skill written before Menkar goes through specialize** (the human, 2026-11-16, topic 38, from ccai's question): specialize's description says to use distill only for a role skill *with its boundaries and admission criterion*; one written before has them added by specialize, merging into it at step 0; distill's step 1 says a skill with no role or criterion goes through specialize first. Built with task 51. Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16: the sidebar's default 300 and minimum 270 (the human), the gear-only header dropped.
| 1.172 | **The sidebar's minimum width is 210 px** (the human, 2026-11-16, topic 41; was 180, at which the header's project button, "Files · N", and in Spanish "Configuración", "Pendientes tuyos" and Files' "Agregar" broke): measured as the narrowest with no break in English; the Files heading shortens with "…" instead of wrapping, so Spanish also fits at 210 (it wrapped up to 270, even at the default 250); the default stays 250; an e2e checks both languages at 210; below about 240 px the header's Settings button shows only its gear, the word kept in its tooltip, so the project's name stays readable (the human, same day, topic 45). Built with task 52. Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16: 1.171 and 1.172 built (task 52), 1.173 built (task 54).
| 1.171 | **Folding in the Team view, and at most 5 topics** (the human, 2026-11-16, topic 40, option c, no mock-up; seen in ccai's tall sidebar): in the Team view a triangle folds **the orchestrator's group** (all its children hidden; folded, its row shows how many are under it and the dot of the worst state among them, red when one waits at a permission prompt), **Consultants** and **Others**, each saved per project as `topics_collapsed` is; **"Awaiting you" shows at most 5 topics, in both views**, then an "N more" row that unfolds the rest, as Files does. Not built yet | 2026-11-16 | this row (until built) |
| 1.172 | **The sidebar's width: default 300 px, minimum 270 px** (the human, 2026-11-16, topics 41 and 45; was 250 and 180, at which the header's project button, "Files · N", and in Spanish "Configuración", "Pendientes tuyos" and Files' "Agregar" broke): 270 is the narrowest with no break in Spanish (measured by task 48; 210 in English), so the Settings button keeps its word; the Files heading shortens with "…" instead of wrapping, should a count grow; a saved width below 270 opens at 270; an e2e checks both languages at 270. Built with task 52. Not built yet | 2026-11-16 | this row (until built) |
| 1.173 | **Fewer wakes for the orchestrator** (the human, 2026-11-16, topic 42, option a; Claude Code cannot fold or hide peer messages, and every woken turn must end with visible text): **one wake per report** — a session whose turn ends with a message to the orchestrator (a SendMessage to it after the turn's last other tool use, read from the session's own transcript; set, 2026-11-16, task 54) gets no `[Menkar] … finished its turn` for that turn; an early question in the turn still lets its end wake the orchestrator — and **wakes arriving within a few seconds are coalesced into one post**: the human's own (away/back, took control/handed back, wants to discuss topic N) first, then ★ children, then the rest; team updates stay apart. Deferring the rest to the human's next prompt (a `UserPromptSubmit` hook) stays in `docs/NOT_BUILT_YET.md`. Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16: tasks 52 and 54 (1.171–1.173).
| 1.172 | **The sidebar's minimum width is 210 px** (the human, 2026-11-16, topic 41; was 180, at which the header's project button, "Files · N", and in Spanish "Configuración", "Pendientes tuyos" and Files' "Agregar" broke): measured as the narrowest with no break in English; the Files heading shortens with "…" instead of wrapping, so Spanish also fits at 210 (it wrapped up to 270, even at the default 250); the default stays 250; an e2e checks both languages at 210. Built with task 52. Not built yet | 2026-11-16 | this row (until built) |
| 1.173 | **Fewer wakes for the orchestrator** (the human, 2026-11-16, topic 42, option a; Claude Code cannot fold or hide peer messages, and every woken turn must end with visible text): **one wake per report** — a session that sent the orchestrator a message during its turn gets no `[Menkar] … finished its turn` for that turn — and **wakes arriving within a few seconds are coalesced into one post**. Deferring the rest to the human's next prompt (a `UserPromptSubmit` hook) stays in `docs/NOT_BUILT_YET.md`. Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-16: plan 39's state (P0.3, P0.4 committed on the branch).
| 2 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3, P4) | **Being built** (2026-11-16): P0.1 and P0.2 committed on `main` (3cbe1e4, 635caa0); branch `multi-agent` in its worktree `/home/hernan/git/menkar-multi-agent` (its own `node_modules`); P0.0 (the sandbox) committed there (32c27d6). Next: P0.3, then P0.4–P0.8 in turn, on the branch; `main`'s fixes are merged into the branch by `set` before each block; P0 merges into `main` at P0.8 |

> Replaced 2026-11-16: tasks 60 and 57 first; the next .deb waits for them.
| 3 | Background workers and one peek tab (1.176) with the single sidebar view (1.177) | Decided 2026-11-16; needs a plan (task 60): mock-ups of 1.177 first, then `/design-plan`; amends `AGENTS.md`'s rule that a session runs only while it has a tab |

> Replaced 2026-11-17: 1.177's rows keep everything the Team view's rows have.
| 1.177 | **One sidebar view in the orchestration mode, no Work/Team switch** (the human, 2026-11-16, topic 46, option a with their notes; so background workers (1.176) are found without knowing a Team view exists): in order (1) "Awaiting you", at most 5 topics and "N more" (1.171); (2) **Tasks, at most 5** (today 6) with "See all (N) →" opening the Board, as now; (3) **the orchestrator, folded by default**, its row showing how many are under it and the worst state's dot (1.171), unfolded showing its workers with their task and step as the Team view does; (4) Consultants; (5) Others; (6) Done today, folded. The three count tiles go. Mock-ups first; designed in the same plan as 1.176. Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-17: 1.175 built (task 57).
| 1.175 | **Where an orchestrator keeps its status file** (the human, 2026-11-16, topic 43, from ccai): **plan A — versioned in the project's repository**, which the orchestrator proposes to the human (it survives a change of computer); **plan B, if the human declines — a per-project Menkar folder for what the project or its orchestrator keeps unversioned**, beside the files folder but not it (the files folder is temporary: the human deletes from it freely), not shown in the sidebar's Files, `~/Menkar/<project>/private/` with **`MENKAR_PRIVATE`** in every agent pane, as `MENKAR_FILES` (the name: the human, same day). The skill and the guide say both. Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-17: 1.177 from task 60's mock-ups — the tiles stay, 3 tasks, the three choices.
| 1.177 | **One sidebar view in the orchestration mode, no Work/Team switch** (the human, 2026-11-16, topic 46, option a with their notes; so background workers (1.176) are found without knowing a Team view exists): in order (1) "Awaiting you", at most 5 topics and "N more" (1.171); (2) **Tasks, at most 5** (today 6) with "See all (N) →" opening the Board, as now; (3) **the orchestrator, folded by default**, its row showing how many are under it and the worst state's dot (1.171), unfolded showing its workers with their task and step as the Team view does; (4) Consultants; (5) Others; (6) Done today, folded. The three count tiles go. **Every session row keeps what the Team view's rows have today** — the Remote Control icon, the state dot, the role label, the task and step, the row menu (⋮) with its per-session settings — so nothing the Team view offers is lost (the human, 2026-11-17). Mock-ups first; designed in the same plan as 1.176. Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-17: plan 41 being designed; task 57 landed.
| 3 | Background workers and one peek tab (1.176) with the single sidebar view (1.177) | Decided 2026-11-16; needs a plan (task 60, ★): mock-ups of 1.177 first, then `/design-plan`; amends `AGENTS.md`'s rule that a session runs only while it has a tab. **Priority** (the human, 2026-11-16): tasks 60 and 57 (`$MENKAR_PRIVATE`, 1.175) come first, and **the next .deb is built only once both are in** |

> Replaced 2026-11-17: a .deb before plan 41, for the --add-dir fix.
| 3 | 41 — background workers and one peek tab (1.176) with the single sidebar view (1.177) | **Being designed** (2026-11-17) by `menkar-t60` (task 60, ★), from its approved mock-ups; amends `AGENTS.md`'s rule that a session runs only while it has a tab. **Priority** (the human, 2026-11-16): the next .deb is built only once plan 41 is in (task 57 landed, 4dc515a) |

> Replaced 2026-11-18: plan 41's questions decided (topic 51).
| 1.176 | **Workers without a tab, and one peek tab** (the human, 2026-11-16, topic 44, option a, from task 59's mock-ups `$MENKAR_FILES/menkar-t59-*`): in the orchestration mode the orchestrator's workers **run without a tab** (Menkar keeps the process and its terminal's screen); a click on a worker's row shows it in **one peek tab**, italic with a pin button, that the next click replaces; pinning makes it an ordinary tab; closing a worker's tab only hides it, with a toast the first time ("‹name› keeps running in the background · Show"); the orchestrator, consultants and "with you" sessions keep ordinary tabs, first, then pinned ones, the peek last; rows show it by the name's weight (bold with a tab, regular in the background, italic in the peek, a pin when pinned); a background worker at a permission prompt shows a red pill in the tab strip that opens it in the peek, besides the row's red dot; a click on a pinned worker selects its tab and leaves the peek. **Amends the rule that a session runs only while it has a tab** (`AGENTS.md`), for these workers. Needs a plan. Not built yet | 2026-11-16 | this row (until built) |

> Replaced 2026-11-18: plan 39 P0 merged; plan 41 being built; plan 42 being designed.
| 2 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3, P4) | **Being built** (2026-11-16): P0.1 and P0.2 on `main` (3cbe1e4, 635caa0); branch `multi-agent` in its worktree `/home/hernan/git/menkar-multi-agent` (its own `node_modules`), with P0.0 (32c27d6), P0.3 (f081f01) and P0.4 (02bd9f2) committed and `main` merged in at 7e8add4 (1dec648; ci green, R10 equal to main's). Next: P0.5, then P0.6–P0.8 in turn, one worker at a time; `set` merges `main` into the branch before each block; P0 merges into `main` at P0.8 |
| 3 | 41 — background workers and one peek tab (1.176) with the single sidebar view (1.177) | **Being designed** (2026-11-17) by `menkar-t60` (task 60, ★), from its approved mock-ups; amends `AGENTS.md`'s rule that a session runs only while it has a tab. **Priority** (the human, 2026-11-16): plan 41 first. A .deb was cut before it (the human, 2026-11-17, task 65) for task 57's fix of Claude Code 2.1.326's --add-dir trust dialog, which blocked every new session |

> Replaced 2026-11-18: plan 42's questions decided (topic 54).
| 1.178 | **The orchestrator is woken only by what moves the work; the rest waits in an inbox** (the human, 2026-11-17, topic 48, option a; replaces 1.173's coalescing as the answer to the noise in the orchestrator's chat): Menkar wakes the orchestrator only for a task set to review and a worker's question; every other event (control taken or handed back, a topic to discuss, away/back, a turn ended without a report, a permission prompt) goes to **an inbox Menkar keeps per orchestrator**, reaching it **invisibly with the human's next message** (a `UserPromptSubmit` hook in Menkar's `--settings`) and through an MCP tool `inbox`; a worker's permission prompt wakes nobody (the red pill, 1.176) and Menkar raises its blocking topic itself; workers report with `task_review` and ask with a Menkar tool, not SendMessage. Polling was rejected: the orchestrator acts only within a turn, so polling every few seconds costs a turn each. Needs a plan. Not built yet | 2026-11-17 | this row (until built) |

> Replaced 2026-11-18: 1.180's bursts decided (topic 56).
| 1.180 | **The human's own activity, and the task flow metrics, measured as soon as possible** (the human, 2026-11-18, topic 55, option a; with 1.156's task flow metrics folded into the same plan and prioritised): Menkar records, with no text, each action of the human with its time and project — a message sent to a session (already in the usage history as a turn of origin `human`), a permission prompt answered (a session's `blocked` → working), a topic discussed, a topic closed — and each task's state changes (state, whom it waits on, when); the Usage window gains a view of the human: a day by the hour (messages, prompts answered, the bursts of activity as bands with their length) and a week, per project and for all; the task flow (how long tasks spend queued, in progress, waiting and to review, and on whom) beside it. A burst is the human's actions closer than a gap to be decided. **Recording starts first**, so data accumulates while the views are designed; the views with mock-ups. A nudge after a long burst is deferred until the human has seen the data. Not built yet | 2026-11-18 | this row (until built) |

> Replaced 2026-11-18: the burst gap starts at 10 min (the human).
| 1.180 | **The human's own activity, and the task flow metrics, measured as soon as possible** (the human, 2026-11-18, topic 55, option a; with 1.156's task flow metrics folded into the same plan and prioritised): Menkar records, with no text, each action of the human with its time and project — a message sent to a session (already in the usage history as a turn of origin `human`), a permission prompt answered (a session's `blocked` → working), a topic discussed, a topic closed — and each task's state changes (state, whom it waits on, when); the Usage window gains a view of the human: a day by the hour (messages, prompts answered, the bursts of activity as bands with their length) and a week, per project and for all; the task flow (how long tasks spend queued, in progress, waiting and to review, and on whom) beside it. **Bursts** (the human, 2026-11-18, topic 56): the human's actions closer than **15 min** (one constant; measured on their history: 9 bursts a day, median 18 min) — messages, prompts answered, topics discussed or closed, and **presence in Menkar's focused window** (keys, clicks, scroll, a tab change; no content, at most one mark a minute) — while **away (1.167) the human is not present**: an away period ends a burst and counts nothing. **Recording starts first**, so data accumulates while the views are designed; the views with mock-ups. A nudge after a long burst is deferred until the human has seen the data. Not built yet | 2026-11-18 | this row (until built) |

> Replaced 2026-11-18: plan 42 being built; plan 43 written.
| 4 | 42 — the orchestrator's inbox and fewer wakes (1.178) | Being designed (2026-11-18) by `menkar-t62` (task 62); its blocks never run alongside plan 41's blocks 3 and 6 |

> Replaced 2026-11-18: 1.179's place decided (topic 57).
| 1.179 | **The coding agents' versions Menkar is validated with** (the human, 2026-11-17, topic 52, option b; after Claude Code 2.1.326 brought the --add-dir trust dialog and broke a screen rule): (1) `docs/agent-versions.md`, one row per agent (Claude Code, Codex, Cursor, OpenCode): the last version validated, its date, what was measured and how to repeat it; each agent's consultant owns its row; on a new version the consultant reads its changelog, runs its checks in a throwaway home (a suite that can run in the background), updates the row and brings what is new or deprecated as a topic. (2) **Menkar tells the user** which version of each agent they run against the validated one, read locally (`--version`; nothing leaves the machine): older than Menkar's floor → asks them to update the agent; newer than validated → says Menkar was tested with an older one, so bugs or regressions may show, more likely the larger the jump, and to wait for a Menkar release. Where and how it shows is decided with mock-ups. Not built yet | 2026-11-17 | this row (until built) |

> Replaced 2026-11-18: 1.179's large jump decided (topic 59) and built.
| 1.179 | **The coding agents' versions Menkar is validated with** (the human, 2026-11-17, topic 52, option b; after Claude Code 2.1.326 brought the --add-dir trust dialog and broke a screen rule): (1) `docs/agent-versions.md`, one row per agent (Claude Code, Codex, Cursor, OpenCode): the last version validated, its date, what was measured and how to repeat it; each agent's consultant owns its row; on a new version the consultant reads its changelog, runs its checks in a throwaway home (a suite that can run in the background), updates the row and brings what is new or deprecated as a topic. (2) **Menkar tells the user** which version of each agent they run against the validated one, read locally (`--version`; nothing leaves the machine): older than Menkar's floor → asks them to update the agent; newer than validated → says Menkar was tested with an older one, so bugs or regressions may show, more likely the larger the jump, and to wait for a Menkar release. **Where it shows** (the human, 2026-11-18, topic 57, from task 70's mock-ups `$MENKAR_FILES/menkar-t70-*`): **Settings › About, always**, a "Coding agents" section with each agent's installed and validated version and its state; and **a banner under the header** like the away one, only when there is something to say (older than the floor in red, newer than validated in blue for a small jump and amber for a large one), with Details and Hide, hidden until the next version. "Validated" reads "the version Menkar was tested with before this release". Not built yet | 2026-11-17 | this row (until built) |

> Replaced 2026-11-18: 1.183 also drops Others' groups in the mode (topic 61).
| 1.183 | **No group underline on tabs in the orchestration mode** (the human, 2026-11-18, from ccai's tab strip): with the project's mode on, a session tab carries no group colour line (`groupColor` null), since groups are not how the mode organises sessions; with the mode off, as today. Not built yet | 2026-11-18 | this row (until built) |

> Replaced 2026-11-18: plans 41 and 42 built and shipped; plan 43 recording built; 0.1.0-347 installed.
| 3 | 41 — background workers and one peek tab (1.176) with the single sidebar view (1.177) | **Being built** (2026-11-18), one block at a time on `main`: block 1 committed (d5894d7). Next: block 2. The next .deb waits for it, except the one cut for P0's merge |
| 4 | 42 — the orchestrator's inbox and fewer wakes (1.178) | **Being built** (2026-11-18): reviewed and fixed, questions decided (topic 54); block 1 with `menkar-t89`; its blocks never run alongside plan 41's blocks 3 and 6 |
| 5 | 43 — the human's activity and the task flow metrics (1.180, 1.156) | Written (2026-11-18, `menkar-t87`), ★; **recording first** (blocks 1, 2, 3, 3c, then 3b after plan 42's block 3), the views later with mock-ups |
| — | The next .deb | **Waits** (the human, 2026-11-18) for: plan 41 block 5 (the looks) and block 6, plan 43 blocks 3 and 3b (recording live, with `prompted_start`), `trash_files` (1.182), and plan 42 blocks 2–3 (the inbox). Before cutting it, `set` lists for the human what goes in and what is still in flight |

## 2026-11-18 — plans 41 and 42 closed (built by `menkar-t78`, `t82`, `t84`, `t88`, `t95`, `t99` and plan 42's workers; shipped in 0.1.0-347)

Plan 41 (background workers, one peek tab, one sidebar view) and plan 42 (the orchestrator's inbox and fewer wakes) were built on `main` (plan 41's last block 1c5d5b7, plan 42's a62ea09) and shipped in 0.1.0-347. Each part went to the destination its exit table declared (`docs/window.md`, `docs/orchestration.md`, `docs/projects.md`, `docs/sessions.md`, `docs/session-control.md`, `docs/context.md`, `docs/agents.md`, `docs/NOT_BUILT_YET.md`, `AGENTS.md`, the plugin's guide and skills); the plans were deleted. Plan 38's row was also brought up to date (plan 39's P0 merged, 127d4f1).

> Replaced 2026-11-18: 1.176, 1.177 and 1.178 built; plan 38's row out of date; plans 41 and 42 closed.
| 1.176 | **Workers without a tab, and one peek tab** (the human, 2026-11-16, topic 44, option a, from task 59's mock-ups `$MENKAR_FILES/menkar-t59-*`): in the orchestration mode the orchestrator's workers **run without a tab** (Menkar keeps the process and its terminal's screen); a click on a worker's row shows it in **one peek tab**, italic with a pin button, that the next click replaces; pinning makes it an ordinary tab; closing a worker's tab only hides it, with a toast the first time ("‹name› keeps running in the background · Show"); the orchestrator, consultants and "with you" sessions keep ordinary tabs, first, then pinned ones, the peek last; rows show it by the name's weight (bold with a tab, regular in the background, italic in the peek, a pin when pinned); a background worker at a permission prompt shows a red pill in the tab strip that opens it in the peek, besides the row's red dot; a click on a pinned worker selects its tab and leaves the peek. **Amends the rule that a session runs only while it has a tab** (`AGENTS.md`), for these workers. **Plan 41's questions decided** (the human, 2026-11-18, topic 51, all as recommended): AGENTS.md's rule gains that in the orchestration mode a worker's tab may be in the background or in the peek, closing it sends it there, and only Stop, parking, its task closing, its window closing or quitting end it; only workers (no role) go to the background, experts keep ordinary tabs; the mode off turns their tabs ordinary, nothing stops; a double-click on a worker's row opens it pinned; the weights only on workers' rows, and a worker with no tab is regular; one pill per waiting worker, in the tabs' order; one peek per project; closing a worker's tab with a second pane closes that pane and backgrounds the worker; ⋮ Open opens it pinned; "N hidden" after Others, before Done today. Plan 41. Not built yet | 2026-11-16 | this row (until built) |
| 1.177 | **One sidebar view in the orchestration mode, no Work/Team switch** (the human, 2026-11-16, topic 46, option a with their notes; so background workers (1.176) are found without knowing a Team view exists): in order (1) "Awaiting you", at most 5 topics and "N more" (1.171); (2) **Tasks, at most 3** (today 6) with "See all (N) →" opening the Board, as now; (3) **the orchestrator, folded by default**, its row showing how many are under it and the worst state's dot (1.171), unfolded showing its workers with their task and step as the Team view does; (4) Consultants; (5) Others; (6) Done today, folded. **The three count tiles stay**, at the top (for you · working · waiting). **Every session row keeps what the Team view's rows have today** — the Remote Control icon, the state dot, the role label, the task and step, the row menu (⋮) with its per-session settings — so nothing the Team view offers is lost (the human, 2026-11-17). From task 60's mock-ups (`$MENKAR_FILES/menkar-t60-sheet.png`, the human, 2026-11-17): the folded group's count after its name ("ccai 6 ●"); Done today last, folded; at a low height "Awaiting you" stays and the rest scrolls. Designed in the same plan as 1.176. Not built yet | 2026-11-16 | this row (until built) |
| 1.178 | **The orchestrator is woken only by what moves the work; the rest waits in an inbox** (the human, 2026-11-17, topic 48, option a; replaces 1.173's coalescing as the answer to the noise in the orchestrator's chat): Menkar wakes the orchestrator only for a task set to review and a worker's question; every other event (control taken or handed back, a topic to discuss, away/back, a turn ended without a report, a permission prompt) goes to **an inbox Menkar keeps per orchestrator**, reaching it **invisibly with the human's next message** (a `UserPromptSubmit` hook in Menkar's `--settings`) and through an MCP tool `inbox`; a worker's permission prompt wakes nobody (the red pill, 1.176) and Menkar raises its blocking topic itself; workers report with `task_review` and ask with a Menkar tool, not SendMessage. Polling was rejected: the orchestrator acts only within a turn, so polling every few seconds costs a turn each. **Plan 42's questions decided** (the human, 2026-11-18, topic 54, as recommended): only a mode-on project's orchestrator has an inbox; the inbox reaches it with any prompt it gets, the human's or a wake, always invisibly; Menkar raises the permission topic for any child of the orchestrator not "with you", experts included; the topic is raised at once unless the human is looking at that session, closed 3 s after the prompt is answered (one topic for a chain), kept out of Done today, its notice opening the waiting session. By `set`: the question tool is `ask`, it does not set the task waiting, the answer goes by SendMessage, and a review from any assignee of the project wakes the orchestrator. Plan 42. Not built yet | 2026-11-17 | this row (until built) |
| 1 | 38 — more coding agents: Codex, OpenCode, Cursor in the orchestration mode | Design approved, D1–D22 decided (1.137–1.143). Next: plan 39, its software architecture (1.135 step 2), by a new Opus session with `/design-plan` — **launched once plan 40's open questions are settled** (the human, 2026-11-15), with task 20 (how each agent receives the team block) as its research, then its Fable review; **no multi-agent implementation** until the human says so; its launch prompt is `prompts/PROMPT-architect.md` |
| 3 | 41 — background workers and one peek tab (1.176) with the single sidebar view (1.177) | **Built** (2026-11-18, blocks 1–6, last 1c5d5b7) and shipped in 0.1.0-347; **to close** (`set`): move what is left to its docs, delete the plan |
| 4 | 42 — the orchestrator's inbox and fewer wakes (1.178) | **Built** (2026-11-18, blocks 1–4, last a62ea09) and shipped in 0.1.0-347; **to close** (`set`) as plan 41 |

### Plan 41's execution log, verbatim


(Written by the session that executes it.)

#### Block 1 — `menkar-t78` (task 78), 2026-11-18

**Built** (core only; nothing in main or the renderer calls it yet):

- `src/core/projects/place.ts`: `type TabPlace = 'background' | 'peek'`, nothing else.
- `src/core/projects/model.ts`: `SavedTab`'s session variant gains `place?: 'background'`.
- `src/core/projects/layout.ts`:
  - `SessionTab.place?: TabPlace` (absent = ordinary).
  - `shownTabs` (so `shownTab`, `stepTab`, `nthTab`, `openBeside`'s target) skip background tabs.
  - The neighbour rule: `withoutTab`'s selection logic is now `selectionWithout(w, tabId)`, which
    picks a **drawn** neighbour of the same project (next, else previous); `closeTab` and
    `toBackground` share it.
  - `select(layout, windowId, tabId)`: a background tab → the project's peek, moved after the
    project's last tab, the project's previous peek → background in place; any tab → selected.
    **It also sets `shown` to the tab's project** (as `revealPane` and `openSession` did).
    Unknown tab → same layout.
  - `toBackground(layout, windowId, tabId)`: session tab with **exactly one pane** in `tab.panes`
    → `place: 'background'` in place, selection by the neighbour rule; a two-pane tab, a file tab
    or an already background one → the same layout object. Main must hang up the second pane
    first (D2) — and main's `tabPanes` (a split shell) is not seen here.
  - `pin(layout, windowId, tabId)`: a peek → ordinary in place, selected; a background tab →
    ordinary, moved **right before the project's peek** (or last when there is none), selected,
    the peek stays; any other tab → `select`.
  - `ordinaryUnless(layout, keep)`: **signature differs from §2.3's** `(layout, backgroundable,
    selected)`: it is `keep: (tab: SessionTab) => boolean`, by tab, so main can combine
    `backgroundable(session)` with its `tabPanes` count; the selection is read from the layout.
    A placed tab loses its place when `keep` is false **or `tab.panes.length !== 1`**. A selected
    peek → ordinary in place; every other losing tab → ordinary, re-inserted before the project's
    surviving peek (or last when none survives), in their original order; nothing selected changes.
    Returns **the same layout object** when nothing changes, so `changed()` can call it cheaply.
  - `openSession(..., newId, options: OpenOptions = {})`, `OpenOptions = { pin?, worker? }`. A
    found tab → `pin` when `options.pin`, else `select` (a background tab is peeked). A new tab: a
    worker's (`worker(sessionId)`) goes before the project's peek; anyone else's after the
    project's last tab that is not a worker's (a tab with a `place`, or whose panes include a
    `worker`), or first among the project's tabs when all are workers'. Without `worker`, every
    unplaced tab counts as ordinary, so a new tab lands before background tabs and the peek.
  - `openBeside`: the tab it extends loses its `place` (a peek given a second pane is pinned).
  - `moveSessionHere`: a placed tab that comes here (from another window, or re-projected in this
    one) arrives as background and is `select`ed → the peek; an ordinary one is inserted before the
    peek and selected, as before. **My choice**: a background tab already in this window's shown
    project is peeked too (before: Add session on it changed nothing).
  - `insertTabAfter`: an unplaced tab that would land after its project's peek goes right before
    it; a background tab goes where asked.
  - `toSaved`: background and peek → `place: 'background'`; `reopen` reads only
    `place === 'background'`, anything else ordinary.
- `tests/core/projects/layout.test.ts`: 17 tests for the list above, then **the sweep**: one case
  per exported function of `layout.ts`, discovered from the module (`Object.entries`, a floor of
  20); a new export without a case fails. Each case runs the function over every window, tab and
  session of a layout with background tabs in two windows and three projects, and checks no
  `selected` names a background tab, no project has two peeks, and no returned tab id is a
  background one.

**Seen red**: six defects injected one at a time into `layout.ts` and reverted — the neighbour
allowed to be background, the previous peek not demoted, `shownTabs` drawing background tabs,
`toSaved` dropping `place`, `ordinaryUnless` keeping a two-pane placed tab, an uncovered export —
each failed its tests (and the sweep, where it applies).

**Not done here, for block 3**: main does not call any of it; `revealPane`, `revealTab`, the
`selectTab` action and the selection writes at `workspace.ts` 2386–2633/2984 still write
`selected` directly. **The plan's "peek is the last tab" holds only through these functions**:
`moveTab` (dragging) stays free, as §2.3 says.

**Checks**: `npm run ci` green (108 files, 1437 tests; biome, tsc, R10, code rules, i18n, test
integrity, history), output in `$MENKAR_FILES/menkar-t78-41-b1-ci.log`.

#### Block 2 — `menkar-t82` (task 82), 2026-11-18

**Built** (core only; nothing in main or the renderer calls it yet):

- `src/core/orchestration/workers.ts`: `backgroundable(team: WorkerTeam, withYou: readonly
  string[], id)` = `isWorker(team, id) && !withYou.includes(id)` (Q2). Mode off is covered by
  `workerTeam` giving `orchestrator: null`. **My choice**: `withYou` is the array
  `OrchestrationInfo.withYou` already carries (`ProjectInfo.orchestration.withYou`), not a set;
  the tab count (one pane, by `tabPanes`) stays main's, combined with this in the `keep` predicate
  block 1's `ordinaryUnless` takes.
- `src/core/orchestration/rows.ts`, beside `TOPICS_SHOWN`/`topicsFolded`:
  - `TASKS_SHOWN = 3`; `tasksFolded<T>(open: readonly T[])` → `{ rows, more }`, the first 3 and
    the rest's count. **No `unfolded` argument** (unlike `topicsFolded`): the rest opens the Board,
    as the plan says. The caller passes the tasks already in the order it shows them.
  - `type RowWeight = 'pinned' | 'background' | 'peek' | 'none'` (exported, **my choice**, for
    block 5's class mapping) and `rowWeight(worker: boolean, place: TabPlace | 'ordinary' | null)`
    → `RowWeight | null`: not a worker → `null` whatever the place (Q5); `'ordinary'` → `'pinned'`;
    `'background'`, `'peek'` as given; `null` (no tab) → `'none'`, drawn regular (D5). `worker`
    is the caller's to compute — block 5 decides whether it is `isWorker` or `backgroundable`
    (a worker "with you" has an ordinary tab and would read `'pinned'` under `isWorker`).
- Tests: `tests/core/orchestration/workers.test.ts` "who goes to the background" (a worker, one
  with you, an expert, the orchestrator, a session the human started, a worker with the mode
  off); `tests/core/orchestration/rows.test.ts` "the tasks in the single view" (8 → 3 + 5,
  3 → 3 + 0, 0 → 0 + 0) and "a row's weight" (one case per value, and a non-worker with and
  without a tab → `null`).

**Seen red**: six defects injected one at a time and reverted — `withYou` ignored, the role
ignored, `TASKS_SHOWN = 6`, `more` negative, a non-worker given a weight, no tab drawn as
pinned — each failed exactly one test.

**Not done here**: `SHOWN_TASKS` in `src/renderer/work.ts` is untouched (block 4 removes it).

**Checks**: `npm run ci` green (120 files, 1590 tests; biome with 23 warnings, none in these
files; tsc, R10, code rules, i18n, test integrity, history), output in
`$MENKAR_FILES/menkar-t82-41-b2-ci.log`.

#### Block 3 — `menkar-t84` (task 84), 2026-11-18

**Built** (main, and the renderer's minimum):

- `src/shared/workspace.ts`: `TabView.place?: TabPlace` (the type from `place.ts`, so main and
  renderer share it); `openSession` takes `pin?: true`; a new action `pinTab { tab }`;
  `ActionResult.backgrounded?: { names, first }`.
- `src/core/background-toast.ts`: `backgroundToastShown(state)` (`background_toast === true`) and
  `markBackgroundToast(state)`, beside `mute.ts`; `tests/core/background-toast.test.ts`.
- `src/main/workspace.ts`:
  - `mayHide(sessionId)` = `backgroundable(workerTeam(project), orchestrationInfo(project).withYou,
    id)` of the session's project; `staysPlaced(tab)` = one pane by `tabPanes` (the tab's
    `panes` while it is not started) and every session `mayHide`: the `keep` of
    `layout = ordinaryUnless(layout, staysPlaced)`, the first line of `changed()` after the
    buffers, before `startShownTabs()`.
  - `selectTabIn(windowId, tabId)`: `select` then `putWindow` (so the recent projects follow);
    `revealPane`, `revealTab` and the `selectTab` action call it. **Left as they were**: the
    selection writes of file tabs, new and forked sessions and `discussTopic` (the orchestrator's
    tab, never placed).
  - `start_session` and `resume_session` give the new tab `place: 'background'` when `mayHide`
    (after `placeStarted`, so the parent is already set); `insertTabAfter` puts it after the
    caller's tab.
  - `closeOrHide(tabId)`: the human's close. An already background tab → nothing; a session tab
    (not a chat) with a session that `mayHide` → every other pane of it hung up as the `closeTab`
    function does (`tabId` moved to `closed-…`, out of `tabPanes`), the layout tab reduced to
    that session, `toBackground`, `changed()`, its name returned; anything else → the `closeTab`
    function, unchanged. Used by the `closeTab` action (after its unsaved check), `closePane` on
    a tab's only pane, `closeAllTabs` and `closeOtherTabs` (over every project's tabs, as before).
    `closePane` on a pane of a two-pane tab still hangs up that pane, a worker's included (the
    plan names only the only-pane case).
  - `backgroundedResult(names)`: `{}` when none; else `first` read and `background_toast` set in
    one `sessions.updateState`, a failed write logged and `first: false`.
  - `pinTab` → `pin` in the tab's window; `openSession` passes `{ pin: action.pin === true,
    worker: mayHide }`; `splitPane` on a placed tab pins it first (`openBeside` already does it
    in the layout).
- `src/renderer/app.ts`: `renderStrip` skips `place === 'background'`; a row's click sends
  `selectSessionTab` when its session's tab has a place, `selectTab` otherwise, as before; its
  double-click and ⋮ Open send `openSession` with `pin: true` (D3; `pin` on a tab that has no
  place just selects it, so every row passes it). ⋮'s labels and order are untouched. **⋮ Open
  was added here by `set`'s decision (2026-11-18)**: no block named it.
- `e2e/background-workers.spec.ts` (new): a started worker has no tab and its pid lives; a row
  click shows it last and selected, as the peek; × → background, pid alive; `Ctrl+B x` → the
  same; ⋮ Open → an ordinary tab; a pinned worker's × → background; Close all → no tab, pid
  alive; ⋮ Stop → pid gone, no tab. A second test: the layout saved with `"place":"background"`,
  the window closed, a relaunch on the same root resumes the worker (`--resume`) with one tab in
  the strip and the worker's tab background. Places are read through `menkar.window.state()`.
- `e2e/app.ts` (granted by `set` for this): `endSessions(app)`, used by `close()`: Close all,
  then `stopSession` for every session still open — Close all no longer ends workers, and a
  running one would leave the app's close waiting on "Stop N running".
- `e2e/session-control.spec.ts`: the per-task worker, the To review/cap and the `task_star` tests
  reach the worker by its row (the last one switches to the Team view first); task 2's worker is
  asserted in the background, then shown from its row. The tests at `:367–384` and `:818` (the
  role makes the worker ordinary) pass unchanged; `orchestration.spec.ts` needed nothing.

**My choices**: a tab of two sessions where one `mayHide` keeps that one (the first) and hangs up
the other — the D2 rule applied to a second *session* pane too, so two workers sharing a tab lose
the second one. The row click uses `selectSessionTab` only for a placed tab. `closeOrHide` on an
already background tab does nothing and names no one (Close all over background tabs).

**Seen red**: the core test against `background_toast !== undefined`; the e2e against three
injected defects, rebuilt each time and reverted — nothing `mayHide` (both tests fail), close
always hanging up (the first fails at "background"), the strip drawing background tabs (both
fail at the tab count).

**Not done here, for later blocks**: no looks (block 5: the peek's italic and pin button, the
pills, the toast from `backgrounded`); the agent-facing replies still say "in a tab after yours"
(block 6). New file tabs and new sessions appended by main (`openFileTab`, `addTransientTab`) still
land after the peek, as block 1's note says of `moveTab`.

**Checks**: `npm run ci` green (121 files, 1599 tests; biome 23 warnings, none new in these
files; tsc, R10, code rules, i18n, test integrity, flaky, history), output in
`$MENKAR_FILES/menkar-t84-41-b3-ci.log`; `npm run ui-check` green (381 passed) in
`$MENKAR_FILES/menkar-t84-41-b3-ui-check.log`; screenshots `menkar-t84-41-b3-background.png`,
`menkar-t84-41-b3-peek.png`.

#### Block 4 — `menkar-t88` (task 88), 2026-11-18

**Built** (1.177: the single view and the fold's key):

- `src/core/projects/model.ts`: `teamView` gone; **`Project.orchestratorOpen?: true`** replaces
  `orchestratorCollapsed` (a flag set only while true, like the others). **Deviation, agreed with
  `set`**: the plan kept `Project.orchestratorCollapsed`; with it a project created in code (no
  key) would read unfolded, and folded by default must hold for those too.
  `ProjectInfo.orchestratorCollapsed` stays, derived in `src/main/projects.ts` and
  `src/main/workspace.ts` as `p.orchestratorOpen !== true`; `ProjectInfo.teamView` gone.
- `src/core/projects/orchestration.ts`: `setTeamView` and the `teamView` flag gone;
  `setOrchestratorCollapsed(state, id, collapsed)` keeps its signature and sets `orchestratorOpen`
  to `!collapsed`.
- `src/core/projects/store.ts`: reads and writes `orchestrator_open` (absent = folded);
  `team_view` and `orchestrator_collapsed` are destructured out of the project's unknown keys, so
  they are neither read nor written back.
- `src/main/workspace.ts`, `src/shared/workspace.ts`: the `setTeamView` action gone.
- `src/renderer/work.ts`: `viewSwitch`, `workView`, `consultantsSection`/`consultantIds` and
  `SHOWN_TASKS` gone. New `modeTop(s, project)` = the three tiles + `topicsSection`;
  `tasksSection` (exported) uses block 2's `tasksFolded`, "See all (N) →" shown when `more > 0`;
  `doneSection` exported.
- `src/renderer/app.ts`: `#view-switch` gone from `buildFrame`; `renderSessionList` with the mode on
  fills `#topics-section` with `modeTop` and `#session-list` with `tasksSection`, `modeList`, the
  "N hidden" foot, `doneSection`, then the drag marker; the `work` class gone.
- `src/renderer/style.css`: `#view-switch` and `.consultant-row`/`.consultant-role` rules gone;
  `.work-tiles` gets a 6 px top margin, now that it is the first thing under the header.
- `src/core/i18n/{en,es}.ts`: `work.view`, `work.work`, `work.team` gone, **and also
  `work.consultants`, `work.consultantsExpand`, `work.consultantsCollapse`** (my choice: they were
  used only by Work's consultants section, which the block removes; the single view's Consultants
  heading is `orch.consultants`).
- Granted by `set` outside the block's list: `tests/core/orchestration/rows.test.ts` and
  `started.test.ts` (the `teamView: false` fixture line), `e2e/background-workers.spec.ts` (seeds
  `orchestrator_open: true`).
- Tests: `tests/core/projects/orchestration.test.ts` — `team_view` not read nor written back;
  `orchestrator_collapsed: true`, `false` and neither → folded, no fold key written;
  `orchestrator_open: true` → unfolded and written back; the fold round-trip.
- e2e: `work-view.spec.ts` — the seed's `teamView` became `orchestratorOpen` (writes
  `orchestrator_open`) and `SeedMore.hidden`; a new test asserts the order of `#session-list`
  (Tasks · 8, 3 tasks, See all (8) →, the orchestrator folded with its count, Consultants, Others,
  "1 hidden", Done today · 1 folded), no `#view-switch`, the tiles and Awaiting you in
  `#topics-section`, ⋮ on a worker row listing the 19 labels `rowMenu` gives today, and at
  1280×600 the list scrolled to its end with the tiles and Awaiting you still in view; the
  triangle saves `orchestrator_open`, and folding removes it. The rest rewritten off the switch.
  `orchestration.spec.ts` and `session-control.spec.ts`: the seeds' `team_view: true` became
  `orchestrator_open: true` (they relied on the unfolded orchestrator); the switch's clicks gone;
  two list-order expectations gain Tasks and Done today.
  The orchestrator's red dot when a child waits at a prompt is the existing fold test's.

**Seen red**: the store tests before the code (4 failing); then, injected and reverted, Done today
put before the "N hidden" foot (the order test fails) and the fold flag not inverted (two e2e and
one core test fail).

**Not done here**: comments still saying "Work view" in `src/renderer/board.ts:73` and
`src/core/orchestration/counts.ts:14` (outside the block's files); the agent-facing texts and
docs are block 6's.

**Checks**: `npm run ui-check` green (382 passed), output in
`$MENKAR_FILES/menkar-t88-41-b4-ui-check.log`; screenshots `menkar-t88-41-b4-folded-{dark,light}.png`,
`menkar-t88-41-b4-unfolded-{dark,light}.png` (1280×800), `menkar-t88-41-b4-scrolled-600.png`.
`npm run ci`: biome (none in these paths), tsc, vitest (1656), code rules, i18n, flaky and history
green on this block's tree; **test integrity red by design**: 15 `expect(` lines rewritten because
the switch, Work's consultant rows and the 6-task limit are gone, listed in
`$MENKAR_FILES/menkar-t88-41-b4-removed-expects.txt`, for a person to read. Output in
`$MENKAR_FILES/menkar-t88-41-b4-ci.log`.

#### Block 5 — `menkar-t95` (task 95), 2026-11-18

**Built** (1.176's looks, from task 59's approved mock-ups):

- **`rowWeight`'s `worker` is `backgroundable`, not `isWorker`** (block 2 left it open): a worker
  "with you" keeps an ordinary tab no close can hide, so under `isWorker` its row would read bold +
  pin, claiming a pin the human never made; under `backgroundable` it is drawn as before (Q5), as
  1.176 lists "with you" sessions beside the orchestrator and consultants.
- **New `src/core/orchestration/team.ts`** (Node-free: `WorkerTeam`, `isWorker`, `backgroundable`),
  re-exported by `workers.ts` so no caller changed — `set`'s pick (B) over a second copy of the
  rule in the renderer, like P0's `details.ts`/`raw.ts`. `workers.ts` pulls Node into the
  renderer's compile (`projects/orchestration`, `parents` → `model.ts`, `tasks.ts`); `team.ts`
  types `parents` as the record itself because even a type import of `parents.ts` brings
  `model.ts` into the renderer's program.
- `src/renderer/app.ts`:
  - `act` is now a function: when a result carries `backgrounded.first`, the toast
    "‹first name› keeps running in the background" with Show; Show finds that name among the
    background tabs' sessions and sends `selectSessionTab`. In `act`, so every close (×, middle
    click, Close, Close others/all, `Ctrl+B x` from `keys.ts`) shows it without a second caller.
  - `tabButton`: a peek gets the `peek` class (italic, regular) and a `.pin` button (`icon('pin')`,
    `tab.pin`) left of × → `pinTab`; a double-click on a peek → `pinTab`. The pin is `.pin`, not
    `.close`, so the existing `.close` locators stay unique; the drag ignores both.
  - `workerPills`: one `button.blocked-pill.worker-pill` per tab of the shown project with
    `place === 'background'` and a pane whose state is `blocked`, in the tabs' order (D6, Q6),
    "‹tab title› · permission", before `#prefix-pill`; a click → `selectTab` (main's `select`, so
    the peek).
  - `teamText`: the `.name` gets `weight-‹pinned|background|peek|none›` from `weightOf` (the
    session's tab in `state.tabs`: `place`, `'ordinary'`, or none), and a pinned one a
    `.pin-mark` (`row.pinned`). Mode off: rows untouched (they never reach `teamText`).
- `src/renderer/style.css`: `.tab.peek .title` italic 400; `.tab .pin` styled as `.close`;
  `.worker-pill` (pushed right, `margin-left: auto`, `#prefix-pill` after it at 6 px);
  `.row .name.weight-{background,none,peek}` 400, `weight-peek` italic; `.pin-mark` beside the
  muted icon. Placed so Biome's `noDescendingSpecificity` count stays at the tree's 11.
- `src/renderer/dom.ts` (granted by `set`): one `pin` path, the mock-up's glyph.
- i18n, both catalogs, as the plan proposed: `tab.pin`, `tab.blockedWorker`, `row.pinned`,
  `toast.background` (Spanish for `set` to check).
- `e2e/background-workers.spec.ts`: `open({ helper })` seeds a stopped worker (parent the
  orchestrator); a new test "the looks": two background workers (SPAWN1, WORKT) and the stopped
  one regular, the orchestrator bold; a row click → italic peek with its pin button, the row
  italic; a click on the other worker replaces the peek; the pin button → bold tab without pin,
  the row bold + `.pin-mark`; the tab's double-click pins; the toast once with Show peeking it,
  none on the second close; Take control in the peek → still selected, bold; ASK, hand back, ×
  → the pill, which peeks it and goes; ⋮ With you on a background worker → an ordinary tab, not
  selected. Screenshots in both schemes.

**Deviations from the block's e2e list**: "a parked worker regular" is tested as a stopped worker
with no tab — the same `'none'` weight; parking in the stand-in needs Take control, which makes
the worker "with you". "Take control from a background worker's row menu" is ⋮ **With you**:
the row menu has no Take control item, and both set the same mark (`setWithYou`).

**Seen red**: the new test before the code (rows not regular); then, injected, rebuilt and
reverted: the toast on every close (caught only after the toast check became a single count —
`toHaveCount(0)` retried until the toast expired by itself), pills for every placed tab, the peek
row not italic.

**Not done here**: the docs and agent-facing texts (block 6).

**Checks**: `npm run ui-check` green (385 passed), output in
`$MENKAR_FILES/menkar-t95-41-b5-ui-check.log`; screenshots
`menkar-t95-41-b5-{background,peek,pinned-and-peek,toast,pill}-{dark,light}.png`.
`npm run ci` (`$MENKAR_FILES/menkar-t95-41-b5-ci.log`): biome green (`--diagnostic-level=error`
clean; `noDescendingSpecificity` in `style.css` at the tree's 11), tsc green; **vitest 2 red, both
other sessions' work in the shared tree**: `tests/core/r10.test.ts` (tools/list changed by an
uncommitted `protocol.ts` edit) and `tests/core/usage/export.test.ts` (plan 43); 1706 passed.
The steps after vitest, run by hand (`$MENKAR_FILES/menkar-t95-41-b5-ci-rest.log`): i18n, test
integrity, flaky and history green; code rules red only on `tests/core/usage/cli.test.ts:176–177`
(`Date.now()`, plan 43's).

#### Block 6 — `menkar-t99` (task 99), 2026-11-18

**Built** (what agents read, the docs, AGENTS.md's rule; no behaviour change):

- `src/core/control/protocol.ts`: `start_session` — "Starts a new Claude Code session in your
  Menkar project, without taking the focus. A worker you start runs in the background, with no tab
  of its own, until the human opens it; any other session gets a tab after yours. …", "unique
  among the project's running sessions"; `list_sessions` — "whether it is running (tab)" (the
  field stays `tab`); `park_session` — "hangs it up, as Stop does"; `resume_session` — "without
  taking the focus: a worker runs in the background, with no tab of its own, until the human
  opens it; any other session gets a tab after yours".
- `src/main/workspace.ts` (held by me with `set`'s leave, released after): a helper
  `whereStarted(tab)` above `startForAgent` — "in the background, with no tab of its own until
  the human opens it" for a tab with `place: 'background'`, else "in a tab after yours" — used by
  `start_session`'s three replies and `resume_session`'s. **My choice**: the task variant reads
  `Started "x" for task N, now assigned to it, ‹where›; …` (the task moved before the place, which
  no longer reads well after it). Refusals: `"x" is already running.`, `A session called "x" is
  already running in this project.`
- `e2e/session-control.spec.ts` (granted by `set`): `:247`'s refusal; `:343`, `:403`, `:442`
  assert `Started "client-work-tN" for task N, now assigned` — only the part that fits the
  terminal's first row (the whole reply wraps at 80 columns; the tests already assert the tab
  count that shows the background).
- `plugin/guide/orchestration-mode.md`: "The sidebar in the mode" rewritten for the single view
  (counts and Awaiting you fixed; Tasks past three → See all; the team, the orchestrator folded
  until opened; "N hidden"; Done today) plus a paragraph "Workers run in the background" (peek,
  pin, close, what ends a worker, the rows' weights, the pills, who keeps ordinary tabs); a card's
  and a task's click "shows" the session; parking "hangs it up"; a closed task's worker "is hung
  up"; the cap line: closing a worker's tab frees no place; Take control in the peek keeps the tab
  as ordinary; "Read the sidebar".
- `plugin/skills/orchestrator/workers.md`: "Parked" in the sidebar; the cap bullet gains "A worker
  runs in the background, with no tab, until the human opens it; the human closing its tab sends it
  back there and frees no slot."
- `docs/window.md`: new section "Background workers and the peek tab" (place, who goes there, the
  peek, `select`, what starts there, what closes and what hangs up, pinning, `ordinaryUnless`, the
  pills, restart, the drawer, the screen, and §2.8's window-side rejections as its "Rejected"
  list — window.md has no Rejected section of its own); "Closing hangs up" names the exception.
- `docs/orchestration.md`: the data's keys (`orchestrator_open`, no `team_view`); "The sidebar in
  the mode" — one view in 1.177's order replaces the Work/Team paragraphs; the folds' key; the
  workers' row weights paragraph; Topics section, Board, parking, resuming and the cap updated;
  two §2.8 lines in "Rejected".
- `docs/projects.md`: the marks' keys (`orchestrator_open`; `team_view` and
  `orchestrator_collapsed` neither read nor written back); a tab's `place` in the layout, saved
  and reopened.
- `docs/sessions.md`: `background_toast` in the `state.json` section.
- `docs/session-control.md` (granted by `set`): `start_session`, the name refusal,
  `list_sessions`, `park_session`, `resume_session`, the posts' "sidebar's three counts".
- `docs/NOT_BUILT_YET.md`: the two deferrals of §2.4, each with its trigger.
- `AGENTS.md`: Q1's accepted wording appended to the tab rule; the doc table's row for
  `docs/orchestration.md` says "the sidebar's one view" (it said "the Work and Team views": a
  line of the same file the block made false).
- Histories, verbatim: `docs/history/root/AGENTS.history.md` (both AGENTS.md lines),
  `docs/history/{orchestration,window,projects,session-control}.md` (the sidebar section whole,
  the rest as the lines that left).

**Not done here**: R10 (`tests/core/r10/`) is not refreshed — `set`'s, per §5: `tools/list`
(protocol.ts) and the plugin snapshots of `guide/orchestration-mode.md` and
`skills/orchestrator/workers.md` move. `skills/orchestrator/SKILL.md`'s snapshot also fails, from
another session's uncommitted edit of that file, not this block's. Comments saying "Work view" in
`src/renderer/board.ts:73` and `src/core/orchestration/counts.ts:14` (block 4's note) are outside
the block's files and stay.

**Seen red**: `session-control.spec.ts` against the old strings rebuilt into `workspace.ts` (3
tests failed), then restored and rebuilt.

**Checks**: `npx playwright test e2e/session-control.spec.ts` 15 passed
(`$MENKAR_FILES/menkar-t99-41-b6-session-control.log`). `npm run ci`
(`$MENKAR_FILES/menkar-t99-41-b6-ci.log`): biome and tsc green; vitest 1707 passed, 4 failed, all
R10 snapshots (above); the steps after vitest run by hand
(`$MENKAR_FILES/menkar-t99-41-b6-ci-rest.log`): code rules, i18n, test integrity, flaky and history
(35 documents, 0 lines lost) green. No screenshots: the block changes nothing a user sees.


### Plan 42's execution log, verbatim


(Written by the session that executes it.)

#### Block 1 — `menkar-t89` (task 89), 2026-11-18

**Built** (core only; nothing calls it yet, R10 does not move):

- `src/core/orchestration/inbox-text.ts` (new): `INBOX_TEXT_MAX_BYTES` = 1,500, `InboxLine`,
  `inboxText(entries, dropped, maxBytes?)`. Imports nothing; formats the local time from `at` with
  `new Date(at)` (the code rule only forbids the argument-less form).
- `src/core/orchestration/inbox.ts` (new): `INBOX_MAX` = 30, `sequence()` (the run's one counter,
  passed to every `Inbox`), `Inbox` with `add`, `retract`, `entries`, `dropped`, `text`, `take`,
  `deliveredThrough`, `clear({ keep })`.
- `src/core/control/events.ts`: `WakeBatcher.wake(parent, child, key, text)`; the `events` map is
  keyed by key and holds the child (a `note` keys by the child as before); `send` gets a third
  argument, the batch's `{ key, text }` entries, so main's two-argument callback compiles unchanged.
  The constructor's parameter properties became plain fields. `route(input)` with `RouteInput`
  and `Route`.
- `src/core/orchestration/permission.ts` (new): `PERMISSION_CLOSE_MS` = 3,000, `permissionTopic`
  (the stored English title and context), `PERMISSION_ANSWERED`, `openPermissionTopic`,
  `PermissionTopics` (`blocked`, `unblocked`, `exited`, `dispose`) over injected `actions`
  (`openTopic`, `raise`, `close`) and `Timers`.
- `src/core/orchestration/topics.ts`: optional `kind?: 'permission'` on `Topic` and `NewTopic`;
  `parseTopic` keeps it and drops any other value.
- `src/core/control/files.ts`: `controlPaths().inbox`.
- `src/core/agents/claude/inbox.ts` (new): `deliveredThrough(transcript, from)` → `{ through,
  offset }`, reading `attachment` records of `type: hook_additional_context`, `hookEvent:
  UserPromptSubmit`, whose `content` (an array of strings) names "(events a–b)".
- `src/core/context/statusline.ts`: `inboxDir()`, `PROMPT_SUBMIT_ARG` = `prompt-submit`,
  `runPromptSubmit(stdin, pane)`, the header's import list (three of Menkar's modules). Written
  last, after `set`'s go (§4's seam).
- Tests: new `tests/core/orchestration/inbox.test.ts` (with the two import checks, by the
  TypeScript compiler API), new `tests/core/orchestration/permission.test.ts` (with the `kind`
  round-trip tests), new `tests/core/agents/claude/inbox.test.ts`; added to
  `tests/core/control/events.test.ts`, `tests/core/context/statusline.test.ts` (the hook run as a
  process under `TZ=Asia/Tokyo`), `tests/core/sessions/lastreply.test.ts`. `src/core/sessions/
  lastreply.ts` unchanged: its test passed with the record.
- `tests/factories/transcript.ts`: `hookContext(text, hookEvent?)`, added with `set`'s ok; its
  shape is copied from `claude-cli`'s 2.1.327 probe transcripts (`/tmp/menkar-probe-claude-*`).

**Seen red**, each against a defect injected and removed: `<` for `≤` in `deliveredThrough`; the
sequence reset in `clear()`; `wake` keyed by the child; the review rule after the renew, team or
report rule; the `seen` check dropped; a return to `blocked` not cancelling the close; `kind`
dropped by the parser; the transcript read from 0 instead of the offset; any hook event counted; a
half-written last line read; the hook ignoring `session_id`; the hook without the budget.

**Choices the plan left open (mine):**

- The dropped count goes on the text's first line after the range: "Menkar's inbox (events 2–31)
  (1 earlier events dropped): …", so the first line holds both what main reads back and §2.2's
  wording.
- An entry too long for the budget alone (an `ask` can be 2,000 characters): the hook gives the
  header without a range and "N more: call inbox.", so nothing is confirmed and the tool gives it
  whole.
- `Inbox.deliveredThrough(n)` resets `dropped` when `n` reaches the first pending entry (the model
  got the line that said so); `take()` and `clear()` reset it too.
- `route`: `'human'` is an event of its own (always `inbox`); `parentIsOrchestrator: false` gives
  `none` for a prompt or a turn end without a pending review, since that session's own parent is
  woken by today's path, which `route` does not replace.
- `PermissionTopics.blocked` adopts an open or discussing permission topic of the session that it
  did not raise (an earlier pane's), and closes it in turn once the prompt is answered; it closes
  only a topic still open, so one closed by hand is never closed again.
- `deliveredThrough` on a file shorter than `from` confirms nothing and returns its size as the
  offset; the inode check stays main's (block 2).
- The hook prints nothing when any entry in the file is malformed, not only when the JSON is.

#### Block 2 — `menkar-t100` (task 100), 2026-11-18

**Built** (plumbing only: nothing routes an event to an inbox yet; the only entry a running
Menkar can make is an `ask` its parent could not be woken for):

- `src/core/context/settings.ts`: `promptSubmitHooks(statuslineCommand)`, declared in every
  `--settings` file beside SessionStart and Stop: `if [ -f <inbox dir>/"$MENKAR_PANE".json ]; then
  <statusline command> prompt-submit; fi`, `"timeout": 5`; the folder is `shellQuote`d as a word.
- `src/main/agents/types.ts`: `PromptInbox` (`publish`, `delivered`, `forget`) and
  `MainAgentKit.inbox`. Claude's is new `src/main/agents/claude/inbox.ts` (writes
  `{ session_id, dropped, entries: [{ seq, at, text }] }` whole through `writeAtomic`, removes it when
  empty; `delivered` is core's `deliveredThrough`); Cursor's is `null`.
- `src/main/inbox.ts` (new): `Inboxes`, one `Inbox` per mode-on project with one `sequence()` for
  the run, fed by a `locate()` that workspace gives (each mode-on project → its orchestrator's pane,
  session id, transcript and kit, or null when it is not running; a project left out is not in the
  mode, and its inbox and file go). `sync()` compares where each orchestrator runs with the file last
  written and only then works; `add`, `paneTurned`, `paneExited`, `read` (for the tool). Every write
  goes through one queue per project: confirm from the transcript first (inode and size checked; a
  session first seen is read from its transcript's end, or from 0 when it has none yet), then write
  the file where the orchestrator runs now, removing the one of a pane it left; a file is not
  rewritten when its pane, session id, `dropped` and `seq`s are unchanged.
- `src/main/control.ts`: `startControl` removes and recreates `control/inbox`.
- `src/main/workspace.ts`: `orchestratorPanes()` and `inboxes` before `changed()`, which calls
  `inboxes.sync()` first; `sync()` after a pane starts, `paneExited` at its exit; a second
  `onShownChange` listener calls `paneTurned` on `working`, `idle` and `done` (the wake listener is
  untouched); `handleControl`'s `ask` (`askFor`) and `inbox` cases; `wakeSession` returns its
  `WakeOutcome` (`'no pane'` with no waker, `'error'` on a throw); the batcher still ignores it.
- `src/core/orchestration/ask.ts` (new): `ASK_MAX_CHARS`, `WakeOutcome`, `askText`, `askTool`
  (2.5's answers), `inboxTool`.
- `src/core/control/files.ts` (`TOOL_NAMES` + `ask`, `inbox`), `src/core/control/protocol.ts` (the
  two tools and their descriptions).
- Tests: new `tests/core/orchestration/ask.test.ts`; `tests/core/context/settings.test.ts`,
  `tests/core/control/server.test.ts`; `e2e/fixtures.ts` (`QUESTION`, `INBOX`),
  `e2e/session-control.spec.ts` (one test: ask posted and answered in under a second; `inbox`
  empty; the orchestrator unwakeable → the question in its pane's file; RENEW → the file is the new
  pane's, with the new id, the old one gone). `tests/core/agents/parity.test.ts` unchanged: it lists
  caps, not `MainAgentKit`'s members.

**Seen red**, each against a defect injected and removed: the settings test before the hook
existed; the server tests before the tools; `ASK_MAX_CHARS + 1`; the inbox fallback dropped; the
ask key without its number; the mode-off check dropped; `inbox` not emptying; in the e2e, the
old pane's file not removed (both at the pane change and at exit), and `ask` with no inbox
fallback.

**The hook probe** (`claude-cli`, Claude Code 2.1.327, `$MENKAR_FILES/menkar-t100-42-hook-probe.txt`):
the model got both lines and "(events 1–2)", the screen showed nothing, and the transcript holds a
`hook_additional_context` record with that text; the hook clears nothing, so a second prompt got
them again. A queued message withdrawn with Up writes no record and the model saw nothing: no loss,
nothing to report before block 3. Esc does not withdraw a queued message: it interrupts the tool
and submits it, which the model sees and the transcript records.

**R10** moves in exactly `tests/core/r10/mcp-tools-list.json` and `tests/core/r10/settings.json`;
not refreshed, as `set` asked (it refreshes them on `main`). Until then `npm run ci` fails on those
two snapshots only. The settings snapshot first held the test's temporary cache path (the
hook's guard names the inbox folder): `tests/core/r10.test.ts` now pins `XDG_CACHE_HOME` to
`/home/demo/.cache` for that test, as the statusline's path is pinned (fix asked by `set`; my choice
of the two it offered, since it keeps the hook's command as it is).

**Decided by `set`, 2026-11-18:**

- The plan's e2e premise was corrected: a test cannot write the inbox file for main, which is its
  only writer and holds the entries in memory (a written file is replaced at the next publish).
  The entry comes in through `ask` with the orchestrator unwakeable, then RENEW.
- The `inbox` tool's answers are a pure `inboxTool` in `src/core/orchestration/ask.ts`, tested in
  `ask.test.ts`, so no test file outside the block's list.
- The stand-in's words are new ones because its `ASK` already prints a permission question. `set`
  approved `ASKPARENT`; it is `QUESTION`, since typing `ASKPARENT` passes through `ASK` and the
  stand-in prints a permission question there.
- **No run id**: §5's "the run's counter and `run` id" has no consumer. The one counter per run
  (F6) plus reading a transcript from its end the first time a session is seen already keeps an
  earlier run's records from confirming this run's entries. Block 3 should not add it back.

**Choices the plan left open (mine):**

- An empty `ask` (or not text) answers "Write the question to ask."; the question is trimmed
  before the checks and the post.
- `ask`'s "(task N)" is the asker's `currentTask` only when it is in progress or waiting.
- `ask` puts the question in the inbox when the parent is the project's orchestrator in the
  mode (`workerTeam(project).orchestrator`), whatever its agent; a Cursor orchestrator's inbox keeps
  it unread (§3).
- The inbox's emptying when the mark moves (keeping `presence`) is left to block 3, which lists it;
  block 2 empties a project's inbox only when the mode goes off. The file follows the mark either
  way.
- Main reads the transcript when the orchestrator's pane turns `working`, `idle` or `done`, before
  each publish and on `inbox`; never on the UI path.
- The `inbox` tool gives the text with no budget, so a long question comes whole there.
- `startControl` empties the folder after `startWorkspace` has run; no inbox entry exists before
  `startControl` today, but block 3's start-up review entries must be added after it.

#### Blocks 3 and 4 — `menkar-t101` (task 101), 2026-11-18

**Block 3, built** (with plan 43's block 3b `askPresence` half):

- `src/main/workspace.ts`, the wake section: `inboxOrchestrator(project)` (the mode on, an
  orchestrator, and its kit's `inbox` non-null; Q1); `turns` per pane (`open`, `ended-shown`,
  `ended-stop`) so a turn ends once, at the first of the shown state leaving `working`/`blocked`
  for `idle`/`done`, the Stop record (`stopRecorded`, called first in `turnEnded`) and the pane's
  exit; `turnEnd` applying `route` (renewing read before any await; the transcript read only when
  rules 1–2 do not settle it); `reviews` per session, noted by `noteReview` in `taskFor`'s success
  path (the assignee, the task now `to review`, not the orchestrator); the review wake through
  `wakes.wake('orch:‹project›', …)`, its key `review:‹session›:‹task›`; `sendWake` resolving
  `orch:` at flush and falling back to `inboxes.add` per entry when not posted. Today's path
  (`wakesParent`, `wakes.note`) is unchanged for every parent that is not the inbox orchestrator.
- The permission topic: `PermissionTopics` wired in the first `onShownChange` listener before the
  turn-end reading is asked (F19), to `onPaneExit`, and `closeLeftPermissionTopics()` at the start
  of `startWorkspace`; `raisePermissionTopic` through `addTopic`, `setTopics`, `noticeTopics`,
  `changed`; `permissionTopicText` (t() with the session's name now) in `topicViews` and the
  notice; `doneTodayView` skips closed permission topics; `showTopic` reveals the waiting pane for
  a permission topic, so both the toast's Show and the desktop notice lead there. `paneSeen(pane)`
  factored out of the pane's `seen` lambda, for `seen` in the subject.
- The human's posts: `askPresence`, take control / hand back and `discussTopic` add to the inbox
  when the project's orchestrator is the inbox orchestrator, else today's `wakes.post`; the
  orchestrator that set away or back has `presence` retracted. `askFor` retracts `turn:‹asker›`.
  `renewing` holds `null` from `renew`'s start (before its first await) until the hang-up sets the
  resolver; `onPaneExit` takes the renew path only on a resolver. `orchestratorMarkMoved` on the
  `setOrchestrator` action and the card's new orchestrator → `inboxes.moved` (keeps `presence`).
  `adopt_session`'s answer no longer says "wakes you when it waits or ends its turn".
- `src/main/inbox.ts`: `retract(project, key)` and `moved(project)`.
- `src/main/control.ts` (granted by `set`): `ControlHandlers.ready()`, called by `startControl`
  right after it recreates the inbox folder; workspace's `ready` waits for the first scan
  (`firstScan`), then adds "Task N is to review (‹assignee›): ‹note›" per task in To review waiting
  on the orchestrator (`review:‹task›`).
- `src/main/activity.ts`: `recordPresence(away)` → an `away` or `back` line; called by
  `askPresence` when the state changed (plan 43, F6).
- `src/core/i18n/en.ts`, `es.ts`: `topics.permissionTitle`, `topics.permissionContext`.
- e2e: `e2e/orchestration.spec.ts` (new: the permission topic, and the same in Spanish; rewritten:
  discuss topic and take control / hand back → inbox lines, no post), `e2e/session-control.spec.ts`
  (new: the review wake with the F7 case and the turn without a report; the start-up review entry;
  rewritten: away/back, the team-block turn test, block 2's `ask` test, whose `inbox` now first
  gives the take-control line), `e2e/activity.spec.ts` (new: away/back journaled),
  `e2e/fixtures.ts` (granted by `set`: `REVIEW1`, `task_review` without ending the turn).

**Block 4, built:** §2.8's texts (the orchestrator skill's "When you are woken" with the inbox,
`workers.md`, the worker skill, `team/common.md`, the guide), `task_review`'s and `adopt_session`'s
descriptions; `docs/session-control.md` (waking a parent rewritten, "The orchestrator's wakes and
its inbox", `ask` and `inbox` in the tools, the Rejected items of §2.10), `docs/context.md` (the
`UserPromptSubmit` bullet, the statusline's imports), `docs/agents.md` (`PromptInbox`),
`docs/orchestration.md` (the posts, double-click, banners, presence, the permission topic, Show),
`docs/NOT_BUILT_YET.md` (the conversation entry narrowed; `answer`; a Cursor orchestrator's inbox),
`docs/usage.md` (granted by `set`: `away` / `back` row), each with its lines in `docs/history/`
(`docs/history/agents.md` new).

**Seen red**, each against a defect injected and removed: `noteReview` not called; a SendMessage
to the parent silencing the review (F7); `seen` forced false (a topic in view); Done today not
filtering; the routed child falling through to today's wake (posts); `ready` not adding the
review lines; `recordPresence` not called; the notice's title not translated (the Spanish toast);
presence posted instead of put in the inbox; take control posted instead of put in the inbox.

**Choices the plan left open (mine):**

- A Stop record with no `working` seen since the last turn end counts as a turn (a turn too short
  to be shown), so the stand-in's `REVIEWPR`, which shows no `working`, still ends its turn.
- Rule 5's inbox line, the permission line and the topic apply only when the session's parent is
  the inbox orchestrator; a session in the mode whose parent is another session keeps today's
  wakes to that parent, and only its review wakes the orchestrator.
- A turn-end reading that fails puts the "without a report" line in the inbox (today's path wakes).
- `ready` adds the review lines whatever the orchestrator's agent (no session is known that early;
  an inbox nobody reads only keeps them), and only once the first scan settled, so the assignee is
  named: before it, names are id prefixes.
- The away/back line goes to every mode-on project's orchestrator's inbox, running or not (it
  waits for the next start of that orchestrator); `postRecipients` still applies to orchestrators
  without an inbox.
- The review wake's text leaves out ": ‹note›" when the note is empty.
- `raisePermissionTopic` returns 0 for a session in no project (not reached: the subject is a
  member of a mode-on project).
- The toast's text is "Item N: …" ("Pendiente N" in Spanish), as every topic notice is today; the
  plan's e2e said "Topic N".

**Premises the tree contradicted:** the task state is `to review`, not `review`. The plugin's own
tests bound §2.8's texts: the orchestrator skill under 200 lines, no word "set" (a session's name),
no `SendMessage` in a skill (the team block carries it), the common and Claude team parts under 800
bytes. So the skill quotes the wake as "[Menkar] ‹name› … task N to review: ‹note›" and says
"answer it by name"; `team/common.md`'s line is §2.8's, shortened to fit.

**R10** moves in exactly these, not refreshed: `tests/core/r10/mcp-tools-list.json`,
`tests/core/r10/plugin/guide/orchestration-mode.md`, `tests/core/r10/plugin/skills/orchestrator/
SKILL.md`, `tests/core/r10/plugin/skills/orchestrator/workers.md`, `tests/core/r10/plugin/skills/
worker/SKILL.md`, `tests/core/r10/plugin/team/common.md`, `tests/core/r10/team-blocks.txt`,
`tests/core/r10/team-posts.txt`.

**`test integrity`** fails on three removed `expect(` lines, the assertions block 3 asks to
rewrite (the discuss post, the away and back post counts): read by a person, as the check says.

## 2026-11-18 — plan 43's §3 row, before its views were built

| 3 | 43 — the human's activity and the task flow metrics (1.180, 1.156) | **Recording built** (blocks 1–3c, shipped in 0.1.0-347) and checked by hand by the human (task 104, 5/5). Views placed by the human (1.184, topic 62): a left bar Usage / Activity / Task flow. **Next:** block 4b (the left bar's mock-up) and block 5 (bursts reading, core) in parallel; then 6, 7 |

## 2026-11-18 — the next .deb's row, before 0.1.0-368

| — | The next .deb | 0.1.0-347 installed 2026-11-18. Since then on main: no groups in the mode (1.183), a stuck worker's row (task 79), a shell named as a shell (task 67). Before cutting the next one, `set` lists for the human what goes in and what is in flight |

## 2026-11-18 — plan 43 closed

Plan 43 (the human's activity and the task flow metrics, 1.180, 1.156, 1.184) built in blocks 1–7e (last e730062), shipped in 0.1.0-368 and checked by hand by the human the same day; every part of its exit table is in `docs/usage.md`, `docs/spec/usage.md`, `docs/preferences.md` and `docs/NOT_BUILT_YET.md` (the nudge; messages typed while an agent works, its Q7). The rows it replaced, verbatim:

| 1.156 | **Before the first release** (the human, 2026-11-15): the task flow metrics — how long tasks spend in each state, and whom a task under review waits on (`docs/NOT_BUILT_YET.md`, "Task flow metrics"); and, wished but not mandatory, **seeing the Board away from the PC** (`plans/ideas/remote-board.md`), an idea still to be thought through | 2026-11-15 | this row · `docs/NOT_BUILT_YET.md` · `plans/ideas/remote-board.md` |
| 1.180 | **The human's own activity, and the task flow metrics, measured as soon as possible** (the human, 2026-11-18, topic 55, option a; with 1.156's task flow metrics folded into the same plan and prioritised): Menkar records, with no text, each action of the human with its time and project — a message sent to a session (already in the usage history as a turn of origin `human`), a permission prompt answered (a session's `blocked` → working), a topic discussed, a topic closed — and each task's state changes (state, whom it waits on, when); the Usage window gains a view of the human: a day by the hour (messages, prompts answered, the bursts of activity as bands with their length) and a week, per project and for all; the task flow (how long tasks spend queued, in progress, waiting and to review, and on whom) beside it. **Bursts** (the human, 2026-11-18, topic 56): the human's actions closer than **10 min** to start with (the human, same day; one constant, changed without rewriting data; on their messages alone it gave 12.7 bursts a day, median 9 min, before presence in the window was counted) — messages, prompts answered, topics discussed or closed, and **presence in Menkar's focused window** (keys, clicks, scroll, a tab change; no content, at most one mark a minute) — while **away (1.167) the human is not present**: an away period ends a burst and counts nothing. **Recording starts first**, so data accumulates while the views are designed; the views with mock-ups. A nudge after a long burst is deferred until the human has seen the data. Not built yet | 2026-11-18 | this row (until built) |
| 1.184 | **The activity and task-flow views: where they go and how they look** (the human, 2026-11-18, topic 62, from task 106's mock-ups): the Usage window gets **a left bar like Settings' with three sections, Usage / Activity / Task flow** (Totals and By day stay inside Usage; neither of the mock-ups' placements A or B); the **week** is strips per day and a click on a day opens it; the **task flow** shows median and total; the day view is as mocked. **The period across sections:** each section remembers its own last period; on a switch the chosen one is carried when the other section has it (Usage today ↔ Activity's day, Usage 7 days ↔ Activity's week ↔ Task flow 7 days, Usage 30 days ↔ Task flow 30 days), otherwise the other keeps its own and the choice is not overwritten; the project scope (this project / all projects) applies to all three and is always carried. A new mock-up of the window with the left bar comes before plan 43's block 7 | 2026-11-18 | plan 43 §2.8 |

| 3 | 43 — the human's activity and the task flow metrics (1.180, 1.156) | **Built** (2026-11-18): recording (blocks 1–3c, in 0.1.0-347, checked by hand, task 104), the readings (5, 6) and the views (7a–7e, last e730062): the Usage window's left bar Spend / Your time / Task times (1.184, topics 62–64). **Next:** in the next .deb, the human's hand check; then `set` closes it (1.156 and 1.180's destinations, Q7 open) |

Its execution log, verbatim:

### Plan 43 §7, Execution log

(Written by the executing sessions.)

### Review (task 90, `prompts/reports/menkar-t90-review-43.md`): decided by `set`, 2026-11-18

- **F1** (block 3's `wait_kind: session`): as the review proposes — `src/main/activity.ts` resolves
  after the event's `at` through `sessions.list()`, among the task's project's members with that
  exact name; several → the newest; none → `other`; a worker known only to `startedNames` records
  `other`, written in the limits.
- **F2, F3, F4** go with block 1, each as the review proposes.
- **F5, F6:** block 3b is split. Its `startPane` call (`prompted_start`, at the launch plan, with
  `spec.sessionId ?? spec.start.id`) is built right after plan 41's block 4 is committed, and the
  first .deb that records anything carries it, so no day is recorded without it. The
  `askPresence` call rides with plan 42's block 3.

### Block 1 — `menkar-t92` (task 92), 2026-11-18

Built: `HISTORY_VERSION = 4`; the two tables in `HISTORY_SCHEMA` and as migration `3:`, all
`IF NOT EXISTS` (F2 (a)); `UsageHistory.importActivity(path)` and `importActivityDir(dir)` at the
end of the class (null when the history is too new, every file left as it was); new
`src/core/usage/activity.ts` with the line types, `parseJournalLine`, `importBatch(db, path)`,
`activityDir()`, `batchPath(dir, ms)` and `batchFiles(dir)`. F3: `batchPath` names a batch
`batch-‹fileStamp›-‹8 hex›.jsonl`, so block 3 must take its names from it. F4: a batch holding a
line of a higher `v` is imported for what is known and renamed `newer-*`, which `batchFiles` does
not list; the §2.10 row was built that way. N9: a batch missing on read or on delete is no error.
Every new test was seen red against an injected defect (`INSERT` for `INSERT OR IGNORE`, the
too-new check skipped, `IF NOT EXISTS` removed, migration 3 emptied, `newer` deleted, no random
part in the name).

Choices the plan left open (mine):
- The journal line's keys are camelCase (`projectId`, `sessionId`, `blockedSeconds`, `waitKind`,
  `waitRef`), and `baseline` is a boolean (`true`), not `1`: the line is a TypeScript object main
  serializes; the columns stay snake_case. Block 3 writes `JournalEvent` as typed here.
- `next` and `state` are stored as any non-empty string, not checked against the shown states or
  `TASK_STATES`: the history copies what was journaled, as it copies what a transcript says.
- A line of the current `v` with an unknown kind, or missing a required field, is `bad` (skipped,
  counted, the file deleted); empty lines are not counted.
- Not done (pre-existing, outside F2 (a)): two workers creating a **brand-new** history at once
  still race on `HISTORY_SCHEMA`'s first `CREATE TABLE turns`; only the new tables are
  `IF NOT EXISTS`.

### Block 2 — `menkar-t93` (task 93), 2026-11-18

Built: new `src/core/activity/record.ts` (`taskEvents(before, after, sessionIdByName)`,
`topicEvents(before, after)`, the `waitKind` resolution) and `src/core/activity/prompts.ts`
(`PromptTracker`: `change(paneId, sessionId, previous, next, atSeconds)` and `closed(paneId)`),
both pure, importing only types from `../orchestration/*` and `../agentstate/shown`. Tests in
`tests/core/activity/{record,prompts}.test.ts`: every §2.10 row of the two files, the permission
row included (plan 42 block 1 is committed, `0762852`), and a parity test that each event,
stamped with `v`, `id` and `at`, comes back whole from block 1's `parseJournalLine`. Each was seen
red against an injected defect (16 in all: waits ignored, the typed name or the PR note stored,
the assignee or step as a state, no permission skip, `open` recorded, a negative wait, `closed`
not forgetting, only `blocked → working`, `blocked → blocked` restarting the wait, the resolver
asked outside the project, the topic pattern, a new task ignored, the topic kinds swapped, a
snake_case key).

Choices the plan left open (mine):
- The events carry neither `v`, `id`, `at` nor `baseline`: main stamps them (block 3). Their keys
  are block 1's camelCase journal keys, so `{ v, id, at, ...event }` is a `JournalEvent`.
- `sessionIdByName` takes `(projectId, name)`, so main can look only among that project's members
  (F1).
- A task absent before is recorded in its current state, whatever it is; a task that disappears
  records nothing. A change of `waitingOn` while waiting, or of `reviewWait.on` while to review,
  is recorded; a change of the review's note alone is not.
- A topic absent before that is already `discussing` or `closed` is recorded; a topic raised
  `open` is not. `closed → discussing` (reopened by `topic_update`) is a `topic_discussed`.
- `blocked → blocked` keeps the first entry time; a pane leaving `blocked` with no entry (blocked
  before the tracker existed) gives nothing.
- Not done: N6 (a pane leaving `blocked` because its agent exited) is not filtered here; the
  tracker has no way to know, and the review leaves it to main (`AgentPane.foreground()`).
- `taskStateEvent` (one task's event) is kept private; block 3's baseline can be
  `taskEvents(emptyTasks(), openOnly, …)` or export it then.

### Block 3 — `menkar-t96` (task 96), 2026-11-18

Built: new `src/main/activity.ts` (one promise chain for every append and rename of
`<data>/activity/journal.jsonl`; `recordTasks`/`recordTopics`, called once each from `setTasks` and
`setTopics` with the value before and after; the `onShownChange` listener feeding `PromptTracker`,
with `closed` on each agent pane's close; the baseline; `app_start`; `importActivity`) and
`src/main/activity-worker.ts` (a third worker entry in `electron.vite.config.ts`);
`src/main/index.ts` starts it after `startAgentState` and stops its listeners at `will-quit`;
`src/core/usage/cli.ts` imports leftover batches after opening the history, before a report or an
export. F1: the rule is `src/core/activity/names.ts` (pure); main feeds it `sessions.list()` and
`currentProjects()`, only when a wait names something that is not a topic; the event's `at` is
taken before. F3: batches are named by block 1's `batchPath`. Docs: `docs/usage.md`, a new section
"The human's activity and the task flow" (placed before "Exporting for analysis": the export's key
test reads that section to the end of the file, so block 5's activity key table must sit where that
test can tell it apart); `docs/NOT_BUILT_YET.md`, Task flow metrics rewritten and the nudge
entered, the old lines in its history.

Tests: `e2e/activity.spec.ts` (one launch and a restart: the start's import of `app_start` and the
baseline — task 3 waiting on `api` recorded as `session` with the orchestrator's id, the closed task
left out —, `prompt_answered` with `blockedSeconds > 0` after `ASK` then `TURN`, `topic_discussed`
on a double-click, `task_state` queued for `TASKADD` and in progress for `STEPS`, no title in the
journal or the history, and after a restart every row imported once, the journal and batches gone,
no second baseline); `tests/core/activity/names.test.ts`; one `test.each` in
`tests/core/usage/cli.test.ts`. Seen red: the e2e before the code and with the baseline's resolver
skipped (`wait_kind` other); the names tests with the oldest winning and with the membership check
removed; the cli case before the code.

Decided by `set`, 2026-11-18, on my questions:
- **F2 (b)**: no timer of its own. The journal is rotated and imported after every usage pass,
  start and hourly, in the pass's `after` callback (the import first, then the classifier). Rows
  reach the history up to an hour late.
- **N3**: a journal a crash or a quit left is rotated before `app_start` is appended.
- **N2**: the baseline is keyed on a marker file, `activity/baseline`, written after the baseline's
  lines are appended, not on the directory's absence.
- **N6**: no `prompt_answered` when the pane's agent is no longer in its foreground; in the limits.
- `src/core/activity/names.ts`, its test, and the case in `tests/core/usage/cli.test.ts`: files
  the block did not name, granted.

Choices the plan left open (mine):
- The baseline's rows take the same `at` as `app_start`.
- The task diff is first computed with a resolver that names nobody; `sessions.list()` (which
  waits for the first scan) is read only when that diff asked for a name, so a progress note costs
  no list.
- No worker starts when no `batch-*` file waits; the worker's result is logged by main
  (`activity imported`, with the counts).
- A `prompt_answered` takes its project from its session's membership at that moment; an unjoined
  pane's has none (N10, as the plan says).
- `cli.ts` logs and goes on when the import throws: the report never fails on the journal.

### Block 3c — `menkar-t98` (task 98), 2026-11-18

Built: new `src/core/activity/marks.ts` (`markDue(lastMs, nowMs)`, `MARK_INTERVAL_MS`; a clock set
back gives a mark at once); new `src/renderer/presence.ts` (`watchPresence()`, started in
`src/renderer/main.ts` beside `watchKeyboardLayout()`); `'activity:present': Record<string, never>`
in `SendChannels` and `menkar.activity.present()` in `MenkarApi` and the preload;
`src/main/index.ts` routes it to `recordPresent(() => windowState(event.sender)?.shown)`; in
`src/main/activity.ts`, `recordPresent` keeps one mark a minute across every window with the same
`markDue`, asks the window's shown project only for a mark it writes, and journals
`{kind: 'present', projectId}` at the time main received it.

How it listens without touching xterm's key handler: three listeners on `window` — `keydown`,
`pointerdown`, `wheel` — each `{ capture: true, passive: true }`. The window's capture phase runs
before the document's capture listener in `main.ts` that stops the app's own keys, and before
xterm's textarea, so every key is seen, including the ones the app takes; the listener reads
`document.hasFocus()` and the clock, and never calls `preventDefault`, `stopPropagation` or
`stopImmediatePropagation`. `setAppKeyFilter` and `terminals.ts` are untouched. The Usage and
Settings windows load their own entries, so they send none.

Tests: `tests/core/activity/marks.test.ts` — `markDue`'s cases, and a source test (TypeScript
compiler API) that `presence.ts` adds exactly those three listeners, each passive and capturing,
and calls none of the three blocking methods. `e2e/activity.spec.ts` gains one test: a key alone →
one `present` with the window's project; a double-click, a click and `ASK` typed into the pane
within the minute → still one, and the stand-in's question appears (the keys reached the pane);
a wheel over the sidebar once 61 s have passed → a second, ≥ 60 s after the first. It waits a real
minute (no clock is faked in the e2e). Block 3's test now leaves `present` out of its kinds list:
its clicks make marks. `agent-panes.spec.ts` was run with it (set's word). Seen red: `markDue`
without the clock-back rule, with `>` for `>=`; `presence.ts` with an injected `preventDefault`,
with one listener `passive: false`; the e2e with `markDue` always true (7 marks within the minute).

Choices the plan left open (mine):
- Marks are journaled while the human is away too; the bursts' reading already counts nothing
  inside an away period (§2.10), and main has no read of the away state outside `workspace.ts`.
- The e2e's first mark comes from a bare `Shift` press, once the session list is drawn: a key sent
  before the renderer's entry ran was lost in a first run.
- The source test lives in `marks.test.ts`, the one test file the block names.

### Block 3b, the `startPane` half — `menkar-t98` (task 98), 2026-11-18

Built: `recordPromptedStart(sessionId, projectId)` in `src/main/activity.ts`; in
`src/main/workspace.ts`, `startPaneHeld` calls it right after the launch plan is made, when
`spec.promptFile` is set, with `spec.sessionId ?? start.id` (F5). One call covers every path that
starts with a prompt: `start_session`, `resume_session`, a renew, and the orchestration card. The
`askPresence` half is not built here: it rides with plan 42's block 3 (F6).

The plan's check, "no path from the UI starts a session with a prompt", found one: the
orchestration first-time card (`src/renderer/orchestration.ts`, `startTeam`) sends `startNew` with
`orch.firstPrompt`, saved by `savePrompt`, not `prompted`. **Decided by `set`, 2026-11-18: (a)** it
records `prompted_start` too — the prompt is Menkar's text, so its first turn is not the human's;
the click on Start is a presence mark already. (Rejected: (b) a flag on `PaneSpec` to skip it.)

Tests: `e2e/activity.spec.ts`'s first test — after `WORKT` (`start_session` with a prompt; the
fixture's project has no group `pair`, so `SPAWN1` would be refused there), exactly one
`prompted_start` with the worker's id and the project; the session opened from the list before it
(a resume from the UI) gave none; after the restart the history holds it once. Seen red with
`recordPromptedStart` returning at once.

Choices the plan left open (mine):
- The event's project is the tab's, known in `startPaneHeld`, not `projectOf` the session: a new
  worker may not be a member yet when its pane starts.
- A pane that fails to find its CLI records nothing: the call sits where the command line is made.

### Block 5 — `menkar-t108` (task 108), 2026-11-18

Built: new `src/core/usage/bursts.ts` — `BURST_GAP_SECONDS = 600`, `awayPeriods(presence, end)`,
`humanActionsOf(rows)` (the prompted-start exclusion), `bursts(actions, away, gap?)`,
`clipToDay`, `activityDay(rows, day, now)`, `activityWeek(rows, first, now)` and
`readActivity(source, bounds, now, project?)`; `UsageHistory.humanActions(low, high, project?)`
and `activityRows(low, high)` at the end of the class (reading only: no write path, no schema
change); in `nodes.ts` the types the page receives (`ActivityBurst`, `ActivityHour`,
`ActivityDay`, `ActivityWeekDay`, `ActivityWeek`); `menkar usage export --rows turns|activity`
(`export.ts`: `ACTIVITY_EXPORT_KEYS`, `exportActivityRows`, `exportActivityCsv`; `cli.ts`: the
flag, `turns` the default and its output unchanged). Docs: `docs/usage.md` — the bursts' section
says how it is read, the limits' prompted-start line is corrected, the export's usage line and a
new "Activity rows" key table (after the turns' example, so the turns' key test reads up to it);
the replaced lines in `docs/history/usage.md` (the history check asked for them).

Tests: `tests/core/usage/bursts.test.ts` (every §2.10 burst row, the task-104 case of present
marks while away, an away of two minutes splitting a burst, an open away read at 23:59, a second
away while away, the day's 24 hours, the clip at the day's first instant, and three readings on a
real history: the join and the project scope, an away begun two days before the day read, a
burst begun more than a day before); in `tests/core/usage/export.test.ts`, `--rows activity`'s
rows, its project scope, its CSV, a bad value, and its documented table; the turns' table test now
stops at "### Activity rows". Seen red, each restored: away never holding (the task-104 test among
the three red), an away not splitting, `<` for `<=`, no prompted exclusion, no clip, no widening,
an open away dropped, a second away restarting, the last presence before the range not read,
messages not scoped; in the export, presence dropped from a project, a key undocumented, the turns'
table read to the end, the project's id for its name, the flag ignored.

Granted by `set`, 2026-11-18: `usage.cli.exportHelp` in `src/core/i18n/{en,es}.ts` names
`--rows activity` (files the block did not name).

Choices the plan left open (mine):
- An away with neither `back` nor `app_start` after it runs to the reading's `now`; a second
  `away` while away, or a `back` while present, changes nothing. An action at an away's first
  instant is inside it, at its last (the `back`) outside.
- Scoped to a project, the bursts are made from that project's actions alone (its messages by the
  turn's stored project, its marks, prompts and topics by theirs); away is every project's.
  Prompted starts are read for every project, since only the turn's uuid matters.
- A day counts messages and prompts answered; presence marks and topics shape bursts but are not
  counted. Each `ActivityBurst` carries the whole burst's messages and prompts (for the hover),
  not the day's part.
- A burst that only ends at a day's first instant is not in that day; a one-action burst there is.
- `readActivity` reads a day on each side and widens a day at a time while the first burst starts,
  or the last ends, within G of the edge read; the last presence event before the range says
  whether it opens away.
- The activity export: keys `schema, event, kind, at, at_epoch, project, session_id, topic, task,
  next, blocked_seconds`; `task_state` rows are not in it (block 6's `--rows tasks`); with
  `--project`, the project's rows plus `away`, `back` and `app_start`.

Not reached yet: nothing calls `readActivity` / `activityDay` / `activityWeek` outside the tests;
block 7 (the Usage window's Activity section, through `usage-query-worker.ts`) is their consumer.

### Block 6 — `menkar-t109` (task 109), 2026-11-18

Built: new `src/core/usage/flow.ts` — `TaskStateRow`, `FLOW_STATES`, `taskFlow(rows, bounds, now)`;
`UsageHistory.taskStateRows(low, high, project?)` at the end of the class (reading only: the rows in
range and each task's last row before `low`, one `UNION ALL`; no write path, schema or version
change); in `nodes.ts` the types the page receives (`FlowState`, `FlowFigure`, `FlowStateFigure`,
`TaskFlow`); `menkar usage export --rows tasks` (`export.ts`: `TASK_EXPORT_KEYS`,
`exportTaskRows`, `exportTaskCsv`; `cli.ts`: the choice). Docs: `docs/usage.md` — a section "The
task flow", the export's usage line, a "Task rows" key table at the end; the replaced lines in
`docs/history/usage.md`; `usage.cli.exportHelp` in `src/core/i18n/{en,es}.ts` names `--rows tasks`.
Granted by `set`, 2026-11-18: `docs/NOT_BUILT_YET.md`'s "Task flow metrics" now says only the view
is unbuilt, its old line in `docs/history/NOT_BUILT_YET.md`.

Tests: `tests/core/usage/flow.test.ts` (§2.10's flow row and its 10:00 clip, a baseline inside the
window counted from it and marked and one before it not, two rows in the same state as one
stretch, dropped and done ending a wait, the median per task across stretches, tasks told apart
by project and rows out of order, nothing past now or the window, a review with no waiter, and on
a real history the 30-day and 7-day windows with a task begun 40 days before, a task closed
before the window, the project scope and the baseline flag read back); in
`tests/core/usage/export.test.ts`, `--rows tasks`'s rows, scope, CSV and its documented table, and
the activity table test now stops at "### Task rows". Seen red, each restored: the baseline mark
ignoring the window, never marked, no clip at the window's start, the open stretch dropped, rows
unsorted, the median per stretch, terminal rows counted, tasks merged across projects, the
even median's upper middle, the last row before the window not read, `baseline` not read back;
the export tests before the code.

How §2.8 was read: it asks for "median and total per state and per whom it waits on" and says
nothing per stretch, so the median is per task (a task's whole time in that state, or with that
waiter, inside the window), as the task's brief proposed.

Choices the plan left open (mine):
- **The median is of the clipped part**, not the whole stretch: the view says "over 7 or 30 days",
  the total must be the window's time, and a median of whole stretches would describe time the
  total leaves out (a task queued for 40 days would show 40 days in a 7-day view). Both figures
  then describe the same time.
- **Marked** (`sinceBaseline`) only when the task's first row is a baseline **inside** the window:
  one whose baseline is before the window start is known for the whole window, so marking it
  would flag every old task forever.
- A task counts in a state only with time in it inside the window; zero-length stretches (two rows
  at one instant) count nothing. `done` and `dropped` count no time and end the stretch before them.
- Waiters are grouped by `wait_kind` as stored (`session`, not each session's id); a waiting or to
  review row with none recorded counts in its state under waiter `null`. Order: topic, session,
  other, orchestrator, human, pr-approval, pr-merge, any other, then null.
- An open stretch runs to `min(now, bounds.end)`; a window after now is empty.
- The task export: keys `schema, event, at, at_epoch, project, task, state, wait_kind, wait_ref,
  assignee, baseline` (`baseline` a boolean); in range by its `at`, so the last-row-before rows
  the reading needs are not exported.

Not reached yet: nothing calls `taskFlow` / `taskStateRows` outside the tests; block 7 (the Task
flow section, through `usage-query-worker.ts`) is their consumer.

### Block 7a — `menkar-t111` (task 111), 2026-11-18

Built: new `src/core/usage/sections.ts` — `UsageSection`, `SpendPeriod`, `TimePeriod`,
`TasksPeriod`, `Sections`, `initialSections(today)`, `choose`, `switchTo`, `currentWeek`, `weekOf`,
`stepTime`, `timeToggle`, `timeArrows`; new `src/core/usage/timeline.ts` — `countAxis`, `along`,
`bandLabel`; in `nodes.ts`, `ActivityBurst.byProject`, `ActivityDay.away`,
`ActivityWeekDay.{bursts,away}`, `TaskFlow.{done,dropped,open,baselineAt}`; in `bursts.ts`,
`HumanAction.project`, `ActivityRows.messages[].project`, `Burst.byProject`, the away periods
clipped per day and each week day's bursts (one `readDay` for both); in `history.ts`, `project_id`
in `humanActions`' message SELECT only; in `flow.ts`, the counts, `baselineAt`, `REVIEW_WAITERS`,
`FlowRow` and `flowTable`.

Deviations, agreed with `set` (2026-11-18): `initialSections(today)` takes no month (Spend starts on
7 days and a Month period carries its own stepper, so the stepper stays the page's); `timeToggle`
added for Day ↔ Week inside Your time, which 7b consumes. Block 7's signature list says both.

Tests: `tests/core/usage/sections.test.ts` (new: the window's start, every carry and keep of
§2.10, 1.184's example, a stepped-back day and week, a week chosen as current carrying nothing
past midnight, inside Your time, the arrows, a step across a year and across Santiago's
midnight daylight-saving change); `tests/core/usage/timeline.test.ts` (new: `countAxis`'s cases,
`along` on a 25-hour day, `bandLabel`); `bursts.test.ts` (`byProject`, the day's and week's away
across midnight, each week day's bursts equal that day's, the project read back from the
history); `flow.test.ts` (the counts with a task done after the window and now before its end,
`baselineAt`, `flowTable`'s rows and shares). The existing `toEqual`s needed no figure changed:
the bursts' compare spans or `objectContaining`, the flow's compare figures; the bursts' row
literals gained `project: null`. Seen red, each restored: the carry ignoring `chosen`, any day as
today, any week as current, `weekOf` rounding, the arrows with no history, Week → Day on its first
day, `byProject` unsorted, a null project first, away unclipped, a week day without bursts, the
project not read, a task's state read past the window's end, the latest baseline, a baseline before
the window marking, waiting without its session row, the share off, no floor of 5, a 2.5 step, a
24-hour day.

Choices the plan left open (mine):
- `byProject` ties sort by id, a turn with no project after every project; a burst with no
  message has an empty `byProject`.
- An away clipped to nothing in a day (it only touches the day's edge) is not in that day's `away`.
- `switchTo` the section already shown returns the state unchanged (`chosen` kept).
- `flowTable`: a waiter other than the always-listed ones is listed only because it holds a task
  (the flow's waiters exist only with time in the window); rows follow the flow's waiter order.
- `countAxis(6)` is top 6, step 2 (three intervals): the rule as written, the first multiple at or
  above; it does not round up to 10.

Not reached yet: nothing outside the tests calls `sections.ts`, `timeline.ts` or `flowTable`; 7b
(the page and the two paths), 7c and 7d are their consumers.

### Block 7b — `menkar-t112` (task 112), 2026-11-18

Built: the Usage window's left bar (180 px, Settings' classes, `data-section` spend | time | tasks,
Up and Down), the scope at its foot (`[data-key="this-project"]`, `[data-key="all-projects"]`,
shown only when the last answer carries a project), one `[data-toggles="period"]` per section in
the header, the `Sections` state through `sections.ts` (`choose`, `switchTo`, `timeToggle`), one
`latestOnly()` for the three asks. Spend's body moved to new `src/renderer/usage-spend.ts`
(`spendBody`, `spendWhich`, `spendAnswered`, `startStepper`; it also exports `toggles` and `svg`
for 7c and 7d); new stubs `usage-time.ts` (`timeBody(view, ctx)`) and `usage-tasks.ts`
(`tasksBody(view, ctx)`) drawing an empty body; `SectionContext` (locale, scheme, allProjects,
today, loading, `choose`, `render`, `star`) and `SectionBody` (`nodes`, optional `draw`) are
exported as types from `usage.ts`. The path: `ActivityWhich`, `ActivityView`, `TaskFlowView` in
`nodes.ts` (types only, granted by `set`), `'usage:activity'` and `'usage:flow'` in `ipc.ts`, the
preload, the two handlers in `preferences.ts` (one `openerProject` shared with `'usage:view'`),
`activityView` / `flowView` in `src/main/usage.ts` (the pass awaited, then `importActivity()`, then
the worker), the worker's `activity` and `flow` queries. Every string of 7b–7d in `en.ts` and
`es.ts` (`usage.section.*`, `usage.scope.projects`, `usage.readFailed`, `usage.time.*`,
`usage.tasks.*`).

Deviations, agreed with `set` (2026-11-18): the three view types added to `nodes.ts`, which the
file table did not list; the fill-the-window test measures By day's chart against the section's
pane, not the window (the left bar takes 180 px, decision 1.184) — one changed `expect`, which
`check-test-integrity` reports.

Tests: new `e2e/usage-sections.spec.ts` — the window opens on Spend, 7 days, the bar 180 px, each
section's own toggles, Up and Down (dark and light); the foot, All projects carried to Your time
and Task times' asks and kept pressed, back to this project; no opener, no foot; the carry and the
keep through the headers (Spend 30d → Task times 30d, Your time keeps its week, Month kept, Today →
Day on today, the current Week → 7 days in both); a late answer across sections dropped, the star
held while Spend's slower answer is on its way, the bar usable. Seen red, each restored: the
switch not carrying, Task times reset on entry, the scope reset on entering Your time, the guard
dropped from the flow's answer, a 250 px bar. `e2e/usage-window.spec.ts` passes with the one
changed `expect` above.

Choices the plan left open (mine):
- "All projects" still turns back to this project when pressed again (the 1.15 test clicks it
  twice); "this project" sets it.
- The foot is its own bordered group, not `.segmented` (a vertical stack would break the
  controls test's divider check, which reads left borders).
- A refused ask shows `usage.readFailed` in the body instead of a star turning for ever.
- The too-new page keeps the left bar; the header goes, as before.
- A section shown for the first time shows the star, not "Reading the transcripts…" (kept for
  Spend's first answer).
- The tab that had the focus keeps it across the redraw an answer brings (found by the Up/Down
  test: the bar is drawn again with every answer).
- "{n} task(s)" for the summary, as the plan's "{n} burst(s)"; Spanish "preguntas respondidas"
  for prompts answered, after `topics.permissionTitle`'s "pregunta de permiso".

Found, not changed: after `await usageRunner.request()`, a pass another ask starts while this
ask's `importActivity()` runs would open the history beside the import; the plan's ordering keeps
each ask's import after its own pass, not after every later one.

### Block 7c — `menkar-t113` (task 113), 2026-11-18

Built: Your time's day and week in `src/renderer/usage-time.ts` and new `usage-time.css`, as block 7 describes, over 7a's readings and 7b's shell. Test: new `e2e/usage-time.spec.ts`.

The seed is a history from yesterday and three days ago, at fixed local hours:
- Shop: messages at 10:05–10:52 (six in hour 10), 13:05 and 14:09.
- Blog: messages at 11:10 and 13:40.
- Presence marks in Shop that join them, away 12:00–12:20, prompts answered at 11:15 and 13:20, and a lone mark at 18:30.
- One message three days ago.

The transcripts are in the temporary HOME, and the journal is in its data dir before launch.

The spec checks:
- **The week**: seven `[data-day]` rows, today's last, a Total. Yesterday's strip has 3 bursts and 1 away, with 8 messages. › is disabled on the current week.
- **A click on yesterday's row**: Day on yesterday, with its name.
- **The day**:
  - The summary reads 3 burst(s), 8 messages sent, 2 prompts answered.
  - 3 bands, one of them a tick, and 1 away. Hour 10 has 6 messages and hour 11 one prompt.
  - 24 hours, and no "now" on a past day.
- **The hover** (scoped): "start – end · 1.9h", "6 messages sent · 1 prompts answered", no project line. It hides when the mouse leaves.
- **All projects**: 10 messages, and the hover reads "7 messages sent …" and "Shop 6 · Blog 1".
- **The steps**: one day back is empty ("No activity on this day.", 0 burst(s)). The history's first day disables ‹. Three steps with › reach today, which disables › and draws "now".

Seen red, each defect restored:
- a row click opening the wrong day: failed on the day's name;
- the per-project line dropped: failed on "Shop 6 · Blog 1";
- the day's away not drawn: failed on the `[data-away]` count.

Deviation from §2.10's row: it seeds "10:05–14:09 one burst, away 12:00–12:20". Away ends a burst (§2.5, the bursts' own test), so an away inside 10:05–14:09 makes two bursts: 10:05–11:58 and 12:21–14:09. The spec seeds and asserts two, plus a lone tick, so that the screen shows away ending a burst. Everything else in the row is asserted as written.

Choices the plan left open (mine):
- A band's label is the length drawn on this day (the clipped part). The hover gives the whole length and "… on this day".
- Clock times in the hover use the app language's own conventions (`Intl` with `hour: '2-digit'`), so en-US reads "10:05 AM". The mock showed 24-hour times.
- The week's name adds the year only when the week is not in this year, as the day's name does.
- The week's columns have 8 px gaps and Prompts is 7ch wide, so the strips keep about 190 px beside "Messages sent", which is wider than the mock's "Messages".
- A week row is `role="button"` with `tabindex="0"`, so Enter and Space open the day as a click does.
- One hatch pattern (`#usage-time-hatch`) in an out-of-flow SVG serves every plot on the page, because an id belongs to the whole document.
- Summary: "{n} burst(s)" counts ticks as bursts, as `ActivityDay.bursts` does.

### Block 7d — `menkar-t114` (task 114), 2026-11-18

Built:
- Task times in `src/renderer/usage-tasks.ts` and the new `usage-tasks.css`:
  - the summary;
  - `flowTable`'s rows, with median, total and share;
  - To review's four waiters always listed, empty ones dim with "—";
  - Waiting and To review folding, kept for the window's life;
  - the footer and the baseline's footnote with its date;
  - the empty card per scope and period.

Tests: new `e2e/usage-tasks.spec.ts` covers §2.10's "Task times" row, plus exact figures and the fold kept across periods, over a journal seeded at fixed local hours. Seen red, each restored: the median as the total, the empty text's scope, zero waiters hidden, the footnote dropped.

Choices the plan left open (mine): an unknown waiter reads "on something else"; the empty sentence follows `view.scoped`; a state with no task is listed dim; the date is day and short month. "Share of the time" wraps over the mock's 80 px column.

Found: in progress's median of 67.5 min reads "1.1h", because `formatDuration` switches to hours at 60 min. The spec's first expectation was wrong, not the code.

### Block 7e — `menkar-t115` (task 115), 2026-11-18

Built (docs only, plus one string): `docs/spec/usage.md` describes the Usage window's three
sections, the scope at the bar's foot, the header's periods, the carry and the star, and names the
three new specs and the sections' modules; `docs/preferences.md` the shell and its modules, the
three paths, the pass then the import, one `latestOnly()`, `usage.readFailed`, the new specs and the
Vitest files; `docs/usage.md` the sections, the carry rule with its date, why the periods live in
the page's memory, the day's away, each week day's bursts, `byProject`, `timeline.ts`, the flow's
counts, `baselineAt`, `flowTable` and why the view waits for a pass, and the "up to an hour late"
limit narrowed to `menkar usage`. "Task flow metrics" left `docs/NOT_BUILT_YET.md`; the nudge's
entry now points at Your time. Every replaced line is in its history file. `usage.tasks.colShare`
reads "Share" / "Parte" (granted by `set`): no e2e asserted the old text.

Not mine to change, left for `set`: `plans/00-STATUS.md`'s 1.156 row still cites
`docs/NOT_BUILT_YET.md`, "Task flow metrics", and 1.180's row's destination is still "this row
(until built)" (the plan's exit table).

The next .deb's row, before the plan's name was swept:

| — | The next .deb | 0.1.0-368.gd57c2b82 installed 2026-11-18 (plan 43's views, 1.183, tasks 79 and 67). Before cutting the next one, `set` lists for the human what goes in and what is in flight |

## 2026-11-19 — plan 44's §3 row, before its execution

| 3 | 44 — `menkar usage now --json`, the burst in progress for the human's own break reminder (1.185) | To design (task 118, `/design-plan`), a small plan |

## 2026-11-19 — the next .deb's row, before 0.1.0-381

| — | The next .deb | 0.1.0-368.gd57c2b82 installed 2026-11-18 (the activity and task-flow views, 1.183, tasks 79 and 67). Before cutting the next one, `set` lists for the human what goes in and what is in flight |

## 2026-11-19 — the next .deb's row, before 0.1.0-387

| — | The next .deb | 0.1.0-381.g778390ca installed 2026-11-19 (Task times' Today, `menkar usage now`, 1.186, 1.187, Claude Code 2.1.328). Before cutting the next one, `set` lists for the human what goes in and what is in flight |

## 2026-11-19 — decision 1.190 swept (task 129, `menkar-t129`): plan 27 deleted, question 2.1 left §2

> Replaced 2026-11-19 by decision 1.190: no native Windows; Linux, with macOS not decided.
| 1.3 | Ubuntu first: the first finished version is Linux; Windows and macOS follow on the same code | 2026-11-08 | this row |

> Replaced 2026-11-19: 1.190 swept into the files that own it (task 129).
| 1.190 | **No native Windows** (the human, 2026-11-19, topic 74): native Windows goes to `docs/NOT_BUILT_YET.md`, its trigger users asking for it; **WSL2 is neither tested nor promised**; a release states only what it supports, **Linux's `.deb` and `.rpm`**, and people install them where they like. Plan 27 (Windows validation), question 2.1 (Windows' shell) and plan 28's Windows installer go; "Linux first, then Windows and macOS" becomes Linux, with macOS undecided | 2026-11-19 | this row (until swept) |

> Left §2 on 2026-11-19: no native Windows (1.190); the shell is the first question of `docs/NOT_BUILT_YET.md`, "Native Windows".
| 2.1 | The shell of Menkar's terminals on Windows: Git Bash (recommended), PowerShell as fallback, or WSL | Human | Windows |

> Plan 27, `plans/27-windows-validation.md`, deleted 2026-11-19 unexecuted by decision 1.190 (the human, topic 74). Its Linux-only pieces moved to `docs/NOT_BUILT_YET.md`, "Native Windows". Its text, verbatim but for its headings, two levels down:

### Plan 27: how Menkar is validated on Windows (and macOS)

> **Status:** stub, written 2026-11-09 with the human; not before the Windows port starts (§2 2.1,
> the shell, is the first decision it needs). Needs `/design-plan` then.
>
> **Exit, when executed:** `docs/platforms.md` (new: what differs per platform and where it lives),
> `docs/toolchain.md` (how the suites run on each); decisions in `plans/00-STATUS.md` §1.

#### Known Linux-only pieces (found 2026-11-09, not exhaustive)

- `src/core/tilde.ts`: home prefix compared with `/`; Windows paths are `C:\Users\…`.
- `src/core/remote/live.ts` / `src/main/remote-live.ts`: the agent's pid found through `/proc`.
- `src/core/launch.ts` / `src/main/index.ts`: detaching uses `setsid` semantics; closing agents
  relies on SIGHUP (decision 1.9).
- Terminals start `bash` (§2 2.1: Git Bash, PowerShell or WSL).
- Terminal links (1.53): Claude Code turns OSC 8 hyperlinks on from the environment; Menkar sets
  `FORCE_HYPERLINK=1`. Check on Windows what Claude Code reads there (it also knows `WT_SESSION`)
  and that links still span the rows it breaks, in the shell 2.1 picks. Not investigated yet.
- Packaging: a `.deb` with an AppArmor profile; Windows needs an installer (NSIS/MSI), macOS a
  signed `.dmg`.
- e2e: runs under `xvfb` (`MENKAR_E2E_XVFB`), absent on Windows/macOS.
- Notifications, the dock badge, `gsettings` reads in docs and scripts.

#### The goal (the human, 2026-11-09)

Not a Windows CI: `npm run ci` stays a Linux gate. The goal is that **the app works when it is
shared with a developer on Windows who installs it** — once there is a Windows installer to offer.
Validation serves that, before each Windows release, not every change.

#### The proposed approach (to confirm when the port starts)

1. **Audit and isolate**: every platform-specific call behind one module per concern, with a Linux
   implementation and a Windows one; a code-rules check (on Linux, in `npm run ci`) that forbids
   `/proc`, `setsid`, `'/bin/sh'` and similar outside those modules, so new Linux-only code cannot
   slip in unnoticed.
2. **Unit tests for the Windows implementations run on Linux** where they are pure (paths with `\`,
   drive letters, `C:\Users\…`), so most of the Windows logic is checked without Windows.
3. **Before a Windows release**: the installer built, installed on a Windows machine or VM, and a
   smoke run there (Playwright drives Electron natively, no xvfb) plus a hand checklist: install,
   the launcher, a Claude session in a terminal, Remote Control, notifications, uninstall.

#### Carried over from the predecessor's validation (2026-11-08, Claude Code 2.1.319, Ubuntu only)

Kept here because the predecessor's repository is being deleted. On Linux an Electron spike showed
that xterm.js and `@xterm/headless` read the agent's working / blocked / idle states unchanged, that
Shift+Enter, Ctrl+C, Esc, a 5,000-character bracketed paste, scrollback, `/exit` and resizing
behave, and that Playwright's `_electron.launch` drives the real app reliably. **Nothing was checked
on Windows or macOS.** What it left for them:
- Windows terminals run on ConPTY through node-pty: the same `Terminal` class, a different backend
  to verify (signals: there is no SIGHUP, so 1.9 / 1.48's hang-up needs its Windows equivalent).
- The shell is decision 2.1 (Git Bash recommended, since Claude Code on Windows already needs Git
  for Windows; PowerShell the fallback; WSL the other way).
- Nothing on the agents' side may assume `python3`: the statusline and the hooks must run with what
  Menkar ships (Node or its own binary).
- WebKit is never the engine: Electron's Chromium on every platform, so the UI checks done on Linux
  hold, but the native pieces (dialogs, the trash, `openPath`, drag out, the frameless window's
  snapping) are checked by hand on each platform.

> Replaced 2026-11-19 by decision 1.191: macOS experimental, after 1.0.
| 1.3 | Linux first: the first finished version is Linux, and a release states only Linux's `.deb` and `.rpm`; native Windows is not built (1.190); macOS is not decided | 2026-11-19 | this row |

## 2026-11-19 — plan 39's §3 row, before P1a waited on the project's folder

| 2 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3, P4) | **P0 merged into `main`** (2026-11-18, 127d4f1): every agent concern behind per-agent kits, Menkar Sandbox with its own icon; real checks against Claude Code 2.1.326 and Cursor found no difference, and the human checked the sandbox by hand (topic 53). Next: P1a (Codex as a session), on the branch `multi-agent` again, merging `main` in before each block; names tests import, frozen during P0, move into their agents' folders (docs/agents.md) |

## 2026-11-20 — plan 28 brought in line with topic 72 (task 131, `menkar-t131`)

The plan was written before the human's answers of 2026-11-19 and assumed a private repository,
a trial PR and an AppImage. The lines that stated something as decided and stopped being true:

### Plan 28 §1, Decided, used as given

- **Public on GitHub at 1.0**, `git@github.com:hernancontigiani/menkar.git` (checked by `set`).
- **The release workflow listens to `v*` tags only**: the full suite, the packages, a GitHub
  Release with them attached. Linux x64 on one Ubuntu runner (`.deb`, `.rpm`, AppImage — see D4);
  no Windows installer (1.190, §3); macOS experimental, after 1.0 (1.191); no Flatpak or Snap.

### Plan 28 §3, the human's block

**The human, 2026-11-19 (topic 72), with a premise corrected:**
- **The repository is already public**: `github.com/hernancontigiani/menkar` answers as public
  (checked by `set` through the GitHub API, 2026-11-19), and its pushed history is public, about 160
  commits behind the local `main`. **The account is GitHub Free.** Everything written below for "the
  private repository" is wrong. Actions on a public repository have free standard runners, and
  Pages publishes from it. D6's "what becomes public" is already public: it becomes a secrets scan
  of what is already out.

### Plan 28 §4, Out of scope

- A CHANGELOG (none until the first tagged release, then only with the human's approval —
  `AGENTS.md`); the release notes are GitHub's generated list, edited by the human in the draft.

### Plan 28 §5, Do not touch

- How `set` commits today (directly on `main`, 1.5/1.85) until block 8.

### Plan 28 §2.8, The boundary with plan 46

- **The first Pages deploy** is a step of block 8 (going public): Pages on a private repository
  needs a paid plan.

## 2026-11-20 — §3's rows for plans 39, 28 and 46, before the day's work

| 2 | 39 — the software architecture of multi-agent support (1.135 step 2): plan 38's design as per-agent strategies, phase by phase (P0, P1a, P1b, P2, P3, P4) | **P0 merged into `main`** (2026-11-18, 127d4f1): every agent concern behind per-agent kits, Menkar Sandbox with its own icon; real checks against Claude Code 2.1.326 and Cursor found no difference, and the human checked the sandbox by hand (topic 53). Next: P1a (Codex as a session), on the branch `multi-agent` (fast-forwarded to `main` b95026a on 2026-11-19), merging `main` in before each block; **waits for the human to add `/home/hernan/git/menkar-multi-agent` to the project's folders**, so its worker can start there; names tests import, frozen during P0, move into their agents' folders (docs/agents.md) |
| 5 | 28 — going public at 1.0: branches, GitHub CI, releases, the APT repository (topic 72) | To design (task 127) |
| 6 | 46 — the public documentation site (1.189): Starlight, EN/ES, screenshots with seeds, Copy page, the tone guide | To design (task 128) |

## 2026-11-20 — plan 46 §2.1 brought in line with a public repository and dispatch-only workflows (task 144, `menkar-t144`)

§2.1 was written for a private repository and a docs workflow triggered by pushes. The repository
is public, and the human decided (2026-11-19, plan 28's §3) that every workflow runs only by hand
until the first official release. The lines that stopped being true:

### Plan 46 §2.1, Where it lives, and how it builds and deploys

```
.github/workflows/docs.yml         build on every push to main touching site/**, deploy when public
```

- **Deploy**: `.github/workflows/docs.yml`, its own file (plan 28 owns `pr.yml` and the release
  workflow). Triggers: `push` to `main` with `paths: ['site/**', 'e2e/captures/registry.ts',
  'e2e/captures/strings/**', 'src/core/i18n/**', 'src/core/shortcuts.ts']`, and
  `workflow_dispatch`. Job `build`: checkout, Node from `site/package.json`'s `engines`, `npm
  --prefix site ci`, `npm run site:check -- --release` (which builds), upload with
  `actions/upload-pages-artifact`. Job `deploy`: `actions/deploy-pages`, permissions `pages:
  write`, `id-token: write`, and **`if: ${{ !github.event.repository.private }}`**. Actions are
  pinned by full commit SHA, the version in a comment. `ASTRO_TELEMETRY_DISABLED=1` in the
  workflow's `env` too.
- **What the private repository changes**: on GitHub Free a private repository cannot publish to
  Pages. Until 1.0 the `build` job runs on every push (it checks the site), and `deploy` is
  skipped by its `if`, so nothing fails and nothing is published; the site is previewed locally
  (`npm run site:dev`, or `site:build` then `npx --prefix site astro preview`). The first deploy
  is a step of plan 28's going-public checklist: make the repository public → Settings › Pages,
  source "GitHub Actions" → run `docs.yml` by dispatch. Upgrading to Pro to publish earlier would
  publish a public site of a private product: not proposed.

### Plan 46 §8, Block 6

- [ ] Per §2.1: triggers, the two jobs, `if` on `private`, SHA-pinned actions, telemetry off.
- **Verify**: `actionlint` if available, else `npx --yes @action-validator/cli` in a scratch
  folder, never added to the repository; reading the file against §2.1. It cannot run until
  pushed: `set` checks the first run's `build` job after its commit (deploy skipped while
  private).
