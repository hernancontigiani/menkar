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
