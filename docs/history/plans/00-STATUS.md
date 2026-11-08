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
