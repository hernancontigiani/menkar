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
