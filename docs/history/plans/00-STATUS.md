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
