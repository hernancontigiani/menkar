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
