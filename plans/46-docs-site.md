# Plan 46: the public documentation site

> **Status:** written 2026-11-19 by `menkar-t128` (task 128). D1 is taken as decided from the
> human's lean (relayed by `set`, 2026-11-19); **D2–D6 wait on the human** (below, "Decisions for
> the human"). Blocks 1, 3, 5 and 6 do not depend on them; block 7 needs D4 and D5; block 8 needs
> D3 and D6; block 6's `site` URL needs D2.
>
> **From:** decision 1.189 (`plans/00-STATUS.md`, the human, 2026-11-19, topic 71) and
> `plans/ideas/docs-site.md`, which holds what the human asked for, the comparison with Mintlify,
> and the advice of ccai's `documentation` session. The boundary with plan 28 was agreed with
> `menkar-t127` on 2026-11-19 ("Plan 28's side" below).
>
> **Exit, when executed:**
> - `site/` (new): the site itself. `site/AGENTS.md` holds **the tone guide and the site's working
>   rules**, and `site/CLAUDE.md` is `@AGENTS.md`.
> - `docs/site.md` (new): how the site is built, how seeds and captures work, why, and what was
>   rejected (the "Design" and "Rejected" sections of this plan). One row in `AGENTS.md`'s
>   subsystem table.
> - `AGENTS.md`: a row in "Where each thing lives" (what the public site says → `site/`), the
>   subsystem row, and one rule under "Product rules": a change to a screen the site captures
>   recaptures it, and its images are reviewed in the same change.
> - `docs/toolchain.md`: the site's checks (`tests/site/`, `npm run site:check`) and the Node
>   minimum Astro sets.
> - `docs/release-checklist.md`: recapture, review, `npm run site:check -- --release`, deploy.
> - `docs/NOT_BUILT_YET.md`: a Spanish `llms.txt`, a Content-Security-Policy for the site, and
>   (if D2 is (a)) a custom domain, each with its trigger.
> - `README.md`: a "Documentation" line with the site's address, and the `site:*` and `captures`
>   commands under "Development".
> - `plans/00-STATUS.md`: 1.189's "Where it lives" becomes `docs/site.md` · `site/AGENTS.md`;
>   D1–D6 become decisions with their dates; the §3 row leaves.
> - `scripts/nothing-lost.mjs`: `site/AGENTS.md` joins the mirrored documents
>   (`docs/history/root/site-AGENTS.history.md`), since its rules change with every editorial
>   comment and the text that stops being true must be kept.
> - The rest → `git log`.
>
> **Replaces or modifies:** nothing recorded. Plan 28's "GitHub Pages for a small site" is this
> site; plan 28 keeps releases, packages and the APT repository.

## 1. Goal

A public site that sells Menkar by the eye and teaches it: English by default, wholly in Spanish,
many screenshots of the real app in both languages and both themes, the orchestration mode first.
Every page has a "Copy page" menu for agents; the site has `llms.txt`; it tracks nobody. Its text
follows one tone guide that loads by itself for whoever edits it.

### What already exists in the tree (verified 2026-11-19)

- **No site.** No `site/`, no `.github/`. `git remote` is `github.com/<owner>/menkar`, private
  until 1.0 (plan 28).
- **Screens from the real app**: `e2e/app.ts` `launchApp({ prepare })` starts the built app
  (`out/`) under Xvfb with a throwaway `HOME` and XDG set, refusing to run outside
  `MENKAR_E2E_XVFB=1` (`e2e/app.ts:40`), and refusing a `PATH` that reaches the machine's own
  folders (`e2e/app.ts:63`). Each Playwright worker has its own X server (`e2e/display.ts`).
- **Seeds today are fixtures written by hand**: `e2e/fixtures.ts` `prepare`, `clientWork`, and
  `e2e/work-view.spec.ts` `seed()` write `projects.json`, `topics.json`, `tasks.json` and
  `state.json` as raw JSON literals, and transcripts as JSONL. The language is set through
  `state.json`'s `settings.language` (`e2e/work-view.spec.ts:122`); it is how the existing es
  screenshots were taken.
- **The app's own writers are pure and exported**, with the time passed in: `addTask(t, project,
  task, at)` (`src/core/orchestration/tasks.ts:77`), `addTopic`, `closeTopic`, `closeTask`,
  `taskTool`, `topicTool`, `serializeTasks` (`:311`), `serializeTopics`, `serializeProjects`
  (`src/core/projects/store.ts:166`), `serializeOrchestration`, `writeJson`
  (`src/core/jsonstate.ts`). **`saveTasks()`, `saveTopics()` and `saveProjects()` resolve their
  path from the calling process's environment** (`src/core/paths.ts`): called from the Playwright
  process they would write into the developer's own `~/.config/menkar/`. A seed never calls them.
- **The stand-in agent** `FAKE_CLAUDE` (`e2e/fixtures.ts:38`) prints `stand-in claude ready` and
  drives the MCP tools by keywords; it shows nothing that looks like a working agent.
- **Keys and their labels are one table**: `SHORTCUTS` (`src/core/shortcuts.ts`), each row with
  an i18n `description` key; the catalogs are `src/core/i18n/en.ts` (source) and `es.ts`
  (`Partial`, a missing key shows English). The Spanish catalog speaks **voseo** ("Elegí la
  carpeta del proyecto", "No tenés pendientes"; one stray "Haz clic" in it).
- **The rules file pattern**: `CLAUDE.md` is exactly `@AGENTS.md\n`, asserted by
  `tests/scripts/rules-file.test.ts`; path-scoped rules live in `.claude/rules/` with `paths:`
  frontmatter (`ts-tests.md`).
- **Checks**: `scripts/ci.mjs` runs Biome (whose `files.includes` lists `src/**`, `tests/**`,
  `e2e/**`, `scripts/**` and root `*.json`/`*.ts` — not `site/`), `tsc` per layer
  (`tsconfig.node.json` covers `tests`, `e2e`), Vitest (`tests/**/*.test.ts`), the code and i18n
  rules, test integrity, flaky, history. Playwright's default `testMatch` takes `*.spec.ts` and
  `*.test.ts` under `e2e/`, so a file named otherwise under `e2e/` is not run by `ui-check`.
- **The guide** `plugin/guide/orchestration-mode.md` (346 lines) explains the mode to users and
  agents; it ships with the app and is opened offline.
- **Node**: the machine has 22.21.1, `package.json` says `>=22.12.0 <23`. **Astro 7 requires Node
  ≥ 22.23.4** (its `engines`, checked 2026-11-19), so the machine's Node must be updated within 22
  before block 1 (a step for `set` and the human, not a worker: "Before block 1").

### Researched 2026-11-19 (npm registry, GitHub API, the packages' code)

| Package | Version (date) | Author | Licence | Maintenance | Used for |
|---|---|---|---|---|---|
| `astro` | 7.4.13 (2026-11-18) | Astro | MIT | core | the build |
| `@astrojs/starlight` | 0.43.1 (2026-11-13) | Chris Swithinbank | MIT | core | the docs theme, i18n, Pagefind search |
| `starlight-llms-txt` | 0.12.0 (2026-09-15) | Chris Swithinbank (a Starlight maintainer) | MIT | 118 ★, pushed 2026-11-18 | `llms.txt`, `llms-full.txt`, `llms-small.txt` — **default locale only**, no per-page `.md` |
| `starlight-links-validator` | 0.27.0 (2026-10-09) | HiDeoo (Starlight contributor) | MIT | 129 ★, pushed 2026-10-28 | broken internal links fail the build |
| `starlight-image-zoom` | 0.16.3 (2026-11-16) | HiDeoo | MIT | 128 ★ | click to zoom a capture |
| `starlight-page-actions` | 0.7.1 (2026-08-18) | Daniel Castillo | MIT | 23 ★, last push 2026-08-18 | **rejected** (below) |
| `starlight-llm-actions` | 0.13.0 (2026-08-21) | Holden Hewett | MIT | 5 ★, repo from 2026-04 | **rejected** (below) |

All MIT, compatible with GPL-3.0-or-later; none ships with the app (they live in `site/`'s own
`package.json`). Starlight uses the system font stack and loads no remote script or font; its theme
is `data-theme` on `<html>`, and its `util.css` has `light:sl-hidden` / `dark:sl-hidden`. Astro's
CLI sends telemetry unless `ASTRO_TELEMETRY_DISABLED=1`. GitHub Pages: on GitHub Free the
repository must be public; on Pro/Team a private repository can publish, and the site is public
either way. `claude.ai/new?q=` is reported not to prefill since 2025-10 (unconfirmed);
`chatgpt.com/?q=` prefills.

## 2. The design

### 2.1 Where it lives, and how it builds and deploys

```
site/
  AGENTS.md  CLAUDE.md            the tone guide and the site's rules; CLAUDE.md = "@AGENTS.md\n"
  package.json  package-lock.json  astro, starlight and the three plugins, sharp; its own install
  astro.config.mjs                 locales, sidebar, plugins, the remark plugin, base/site
  src/content/docs/                English pages (the root locale, no /en/ prefix)
  src/content/docs/es/             Spanish pages, one per English page, same path
  src/content/i18n/es.json         the site's own UI strings in Spanish (the Copy page menu)
  src/components/PageTitle.astro   the Copy page menu (overrides Starlight's PageTitle)
  src/pages/[...slug].md.ts        each page as Markdown, built at build time
  src/remark/menkar.mjs            ![](shot:slug) and :ui[key], for the HTML and the .md alike
  src/assets/captures/<locale>/<theme>/<slug>.png    captured images, committed (D4)
  src/assets/captures/reviewed.json                  slug → sha256 of each image someone opened
  scripts/check.mjs                what needs the build: links, the tracking scan, --release
  scripts/import-captures.mjs      palette, hash, unchanged-skip, duplicates, contact sheet
e2e/captures/
  registry.ts                      THE registry: every capture's slug, page, locales, themes
  strings/en.ts  strings/es.ts     the seed's text and each capture's alt text, per locale
  seed.ts                          writes a throwaway home through the app's own writers
  scenes.ts                        per slug, the imperative walk: go, wait for proof, shoot
  stand-in-claude.mjs              the terminal content of a capture (D5)
  captures.run.ts                  the Playwright entry, one test per locale × theme
playwright.captures.config.ts      testDir e2e/captures, testMatch captures.run.ts
tests/site/*.test.ts               the structural checks, in npm run ci
.github/workflows/docs.yml         build on every push to main touching site/**, deploy when public
```

- **Its own `package.json`.** The app's install, `npm run ci` and the `.deb` never pull Astro;
  a session that only touches the app never installs the site. Root scripts delegate:
  `site:install` (`npm --prefix site ci`), `site:dev`, `site:build`, `site:check`. Each sets
  `ASTRO_TELEMETRY_DISABLED=1` in `site/package.json`'s scripts themselves, so no way of running
  it sends telemetry.
- **Pages and their paths**: Starlight's `locales: { root: { label: 'English', lang: 'en' }, es:
  { label: 'Español', lang: 'es' } }`, so English is at `/` and Spanish at `/es/`. Pagefind
  builds one index per `lang`.
- **Plain Markdown, not MDX.** Pages are `.md`, so the `.md` an agent copies is the page itself.
  Two extensions, both handled by one remark plugin (`src/remark/menkar.mjs`) used by the HTML
  build and by the `.md` endpoint:
  - `![](shot:<slug>)` — a capture. In HTML it becomes the light and the dark image of the page's
    locale, each wrapped with `dark:sl-hidden` / `light:sl-hidden`, through Astro's image
    pipeline (relative paths into `src/assets/`, so they are optimised), alt text from the
    registry's strings in that locale. In the `.md` it becomes one `![alt](<absolute URL of the
    light image>)`.
  - `:ui[<i18n key>]` — a label of the app, rendered **bold** in the page's locale from the app's
    own catalog (`src/core/i18n/<locale>.ts`, imported at build time; a key Spanish lacks renders
    the English text, as the app shows it). So the Spanish page says exactly what the Spanish UI
    shows, and a renamed label changes the docs with it.
- **The keyboard reference page is generated** from `SHORTCUTS` and the catalogs, in each locale:
  its table cannot drift from the keys.
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
- **Base and site URL** (D2): with GitHub's address, `site: 'https://<owner>.github.io'`, `base:
  '/menkar'`; with a custom domain, `site` is the domain, no `base`, and `site/public/CNAME`.

### 2.2 The tone guide: where it lives and how it loads

**`site/AGENTS.md`, with `site/CLAUDE.md` holding exactly `@AGENTS.md\n`** — the repository's own
pattern (`CLAUDE.md` → `AGENTS.md`). Claude Code loads a nested `CLAUDE.md` whenever it reads a
file under that folder, as ccai's `publications/CLAUDE.md` loads; Codex and others read the nested
`AGENTS.md`. Rejected: `.claude/rules/site-tone.md` with `paths: site/**` — it loads only for
Claude Code, and the captures' alt text lives under `e2e/captures/strings/`, so the guide's first
line tells an editor of those files to read it (`site/AGENTS.md` is the one place). It is mirrored
by the history check (exit, above).

The draft below goes into `site/AGENTS.md` in block 1 and is reviewed by ccai's `documentation`
session in block 2, **asked through `set`**, never directly.

```markdown
# The site — tone guide and working rules

Rules for every page under `site/src/content/docs/` and every string in `e2e/captures/strings/`.
**An editorial comment on a page changes this file in the same turn**, with the case that produced
it, so the next page does not repeat the mistake.

## What a line must earn
- A line earns its place only if the reader can do something differently with it.
- A rule keeps its reason in the same sentence ("Close the tab first, so the session stops").
- No anecdote, no scaffolding: a page never talks about itself ("In this page we will…").
- Nothing twice: what a table says is not repeated in prose, and what another page explains is
  linked, not restated.
- A limitation the reader cannot act on is left out. One they must know before an expensive or
  hard-to-reverse choice goes in, with its consequence ("Deleting a transcript cannot be undone").

## Headings and structure
- A page or section is named for the reader's goal ("Follow the work", not "The Work view").
- A step's title is an imperative verb plus the object it acts on ("Mark an orchestrator").
- No pronouns and no numbers in headings. Point at another section by its name, never its number.
- Steps go in numbered lists; reference data (keys, settings, commands) in tables.

## Commands and labels
- A command is complete and copyable, in a code block; a step that shows it does not also
  explain it word by word.
- A label of the app is written `:ui[key]`, never typed by hand, so it matches the app in each
  language.

## Screenshots
- Every image is a capture from the registry (`e2e/captures/registry.ts`), placed with
  `![](shot:<slug>)`; no image is added by hand.
- What a capture shows is a claim: invented names only (projects, sessions, folders, people,
  domains such as `example.com`), nothing that reads as a real customer, person or repository.
- A capture is shown where it proves the sentence beside it, not as decoration.

## Both languages
- English is the source; every page has its Spanish twin at the same path under `es/`, with the
  same sections in the same order and the same captures. A change to one is made to both in the
  same change.
- Spanish speaks as the app does: voseo ("Elegí", "podés"), the same terms as the app's catalog.

## What is not built yet
- Only the roadmap page names what is not built, and only what `plans/00-STATUS.md` records as
  decided, with no dates and no plan numbers. Every other page describes the released app.

## Privacy
- The site tracks nobody: no analytics, no remote script, font, image or frame. Links out are
  plain links. `npm run site:check` fails a build that loads anything from another origin.
```

What was left out of ccai's rules: their product names, the ban on em dashes, and "never mention
what is not built" (replaced by the roadmap rule, D3).

### 2.3 Screenshots

**Seed and capture are one command, the check inside it** — `npm run captures` (root):
`electron-vite build`, then `xvfb-run -a env MENKAR_E2E_XVFB=1 playwright test -c
playwright.captures.config.ts`, then `node site/scripts/import-captures.mjs`. Options through the
environment: `CAPTURE_LOCALES=es`, `CAPTURE_THEMES=dark`, `CAPTURE_ONLY=slug,prefix-*`,
`CAPTURE_CHECK=1`.

- **The registry, one list** (`e2e/captures/registry.ts`): `export const CAPTURES = [{ slug,
  scene, clip? }] as const` and `export const LOCALES = ['en', 'es'] as const`, `THEMES = ['light',
  'dark']`. A slug names the screen (`work-view-awaiting`, `board-default`), never a reading
  order. `scenes.ts` is `Record<Scene, SceneWalk>`, so a scene without its walk, or a walk
  without a registry entry, is a compile error. The site imports `registry.ts` and the strings
  (plain TypeScript, no Playwright import) to resolve `shot:` slugs and alt text: there is no
  second list.
- **The seed** (`seed.ts`, `seed(dirs, locale, scene, now)`):
  - **The app's storage is written through the app's own writers**: `addTopic`, `topicTool`,
    `addTask`, `taskTool`, `serializeTopics/Tasks/Projects`, `serializeOrchestration`, and the
    usage history's own writer in `src/core/usage/` for the Usage window — then `writeJson` to
    **explicit paths under the throwaway root**, never `saveTasks()` and its kin (their path comes
    from the Playwright process's own environment). A format change in the app is then a compile
    error or the same output in the seed, never a drifted copy. What only an agent writes (a
    transcript) is still a fixture: the app has no writer for it, and must not.
  - **Every string comes from the seed's catalogs**, `strings/en.ts` (the source, `as const`) and
    `strings/es.ts` typed `Record<keyof typeof en, string>` — complete, not `Partial`: a missing
    Spanish string is a compile error. The app's chrome comes from the app's own catalogs through
    `settings.language`. **My choice**: the seed's text lives beside the seed, not in
    `src/core/i18n/`, because those catalogs ship in the app and `check-i18n` flags unused keys;
    the seed's project names and prompts are not the app's strings.
  - **The structure is code, the text is data**, so both locales are structurally identical by
    construction; a Vitest test seeds both into two temporary roots and compares the written JSON
    with every string replaced by its key: equal.
  - **Time is the seed's**: every timestamp is `at(offset)` from the `now` it is given, clamped
    to after today's local midnight + 1 minute, so "Done today" and "2 h ago" read the same
    whenever it runs; a run within 10 minutes before midnight waits for midnight to pass rather
    than straddle it.
  - **Invented names only**: a project "Northwind app", sessions `api-review`, `docs-writer`,
    folders under `~/work/`, people by role — the strings file's header says so.
- **The stand-in agent for captures** (`stand-in-claude.mjs`, D5): reads its session's screen
  from the seed (a short scripted screen per session, in the locale) and prints it, sets the
  terminal title the way the app reads Claude Code's state (working, blocked, idle), and waits.
  It never contacts anything; the e2e PATH guard keeps the real `claude` out of reach.
- **The walk** (`scenes.ts`), imperative per scene, ccai's two primitives: `go(action,
  readyLocator)` and `shot(slug)` / `shot(slug, clip)`. Guards in `captures.run.ts`:
  - **Proof the screen is real before each shot**: the ready locator, plus the seed's own
    numbers (the seeded project's name in that locale in the header, the seeded count of task
    rows); a mismatch fails the run and writes nothing for that slug. `CAPTURE_CHECK=1` walks
    everything and writes no image — ccai's `--check`.
  - **The app identified**: the window's title is Menkar's and the build is this tree's `out/`
    (`MENKAR_E2E_EXECUTABLE` unset), checked once per run.
  - **No `networkidle`, no fixed sleeps**: the ready locator, then one condition — no spinner
    visible and fonts loaded (`document.fonts.ready`).
  - **A fixed window**: 1280 × 800 at device scale factor 2 (`--force-device-scale-factor=2`),
    maximised state off. **My choice**: scale 2 for sharp images on HiDPI screens; the importer's
    palette reduction pays for most of the size.
  - **`CAPTURE_ONLY` filters what is written, not what is walked**: screens are stateful.
  - **`pageerror` and `console` errors collected** per window and printed at the end; any one
    fails the run.
  - **Both themes** by `settings.color_scheme` (`light`, `dark`), the terminal theme to match
    (`catppuccin()` in `e2e/fixtures.ts`), one launch per locale × theme. **Why both**: Starlight
    switches theme, and a dark capture on a light page glares; the cost is run time and review,
    not code.
  - Raw PNGs go to a temporary folder, never into `$MENKAR_FILES` (a worker copies a contact
    sheet there by hand, as `docs/toolchain.md` says for specs).
- **The importer** (`site/scripts/import-captures.mjs`, run by the same command; `sharp` is a
  `site` devDependency): for each raw PNG, reduce it to a 256-colour palette, then compare its
  decoded pixels with the committed file — **equal pixels keep the old file** (no git churn) —
  else write it. Then:
  - **hash every image written** and report which changed since the last run;
  - **two images of one run with the same pixels fail the run** (a navigation that did not happen
    photographs the previous screen again), unless the registry marks the pair `same: true`;
  - **an image that is one flat colour fails**;
  - write a **contact sheet** per locale × theme (`/tmp/menkar-captures/sheet-<locale>-<theme>.png`,
    every changed capture with its slug) for the human.
- **Every image looked at** (`src/assets/captures/reviewed.json`, slug/locale/theme → sha256):
  the session that ran the capture **opens each changed image** (Read shows it), then records it
  with `npm run captures:reviewed -- <slug>…` (or `--all-changed`), which writes the current
  hashes. `tests/site/captures.test.ts` (in `npm run ci`) fails when any committed image's hash
  differs from its reviewed one, naming it. It cannot prove anyone looked; it proves that each
  changed image was signed off by name in the same change, and the report lists them.

### 2.4 The pages: a first table of contents

Sidebar order (D6), each page English + Spanish:

| Group | Page (path) | Goal-named title | Main captures |
|---|---|---|---|
| — | `index.md` (splash) | Menkar: several coding agents, one window, one orchestrator | `hero-orchestration` (dark and light) |
| **Orchestration mode** | `orchestration/index.md` | Let one session run the team | `work-view-overview`, `board-default` |
| | `orchestration/set-up.md` | Choose an orchestrator | `first-time-card` |
| | `orchestration/follow-the-work.md` | Follow the work | `work-view-awaiting`, `task-steps` |
| | `orchestration/topics-and-tasks.md` | Decide on topics | `topic-discussing`, `task-to-review` |
| | `orchestration/board.md` | See every task at once | `board-default` |
| | `orchestration/workers.md` | Run a worker per task | `background-workers`, `peek-tab` |
| | `orchestration/roles.md` | Give a session a role and skills | `configure-role` |
| | `orchestration/away.md` | Step away and come back | `away-strip` |
| | `orchestration/team-shapes.md` | Shape a team | — |
| **Get started** | `install.md` | Install Menkar | — (plan 28's commands) |
| | `start.md` | Open your first sessions | `add-session-existing`, `add-session-new` |
| | `agents.md` | Use Claude Code or Cursor | — |
| **Work with sessions** | `sessions/tabs-and-panes.md` | Arrange sessions in tabs and panes | `split-panes` |
| | `sessions/projects.md` | Group work into projects | `project-dropdown` |
| | `sessions/windows.md` | Use several windows | — |
| | `sessions/files.md` | Edit and preview files | `markdown-preview` |
| | `sessions/chat.md` | Continue a session as a chat | `chat-permission` |
| | `sessions/remote-control.md` | Reach a session from your phone | — |
| **Usage** | `usage/window.md` | See time, tokens and cost | `usage-spend`, `usage-your-time` |
| | `usage/cli.md` | Read usage from the terminal | — |
| **Settings** | `settings/look.md` | Change the look and the language | `settings-look` |
| | `settings/integrations.md` | Turn on the status line and longer transcripts | `settings-integrations` |
| **Reference** | `reference/shortcuts.md` | Keyboard shortcuts (generated) | — |
| | `reference/privacy.md` | What Menkar keeps, and what it never sends | — |
| | `roadmap.md` | What comes next (D3) | — |

- **The orchestration mode first** (the human, 1.189): the splash leads with it, and it is the
  first sidebar group; the splash's hero has an **Install** button, so installing is one click
  from the first screen.
- The orchestration pages are written for people from `plugin/guide/orchestration-mode.md` and
  `docs/orchestration.md`; the guide stays where it is, for agents and offline use.
- **The roadmap (D3)**: the tone guide's rule that only the roadmap page names unbuilt work, and
  only what `plans/00-STATUS.md` records as decided, without dates or plan numbers. Reviewed at
  each release (`docs/release-checklist.md`).

### 2.5 The Copy page menu and llms.txt

- **`llms.txt` through `starlight-llms-txt`** (MIT, a Starlight maintainer's): `llms.txt`,
  `llms-full.txt`, `llms-small.txt`, **English only** (the plugin reads the default locale). A
  Spanish one is deferred to `docs/NOT_BUILT_YET.md` (trigger: a Spanish reader asks, or the
  plugin gains locales); an agent reads English.
- **Our own small component, not a plugin**: `src/components/PageTitle.astro` overrides
  Starlight's `PageTitle` (rendering the default inside it) and adds a menu on every page but the
  splash, built on `<details>` so it opens without script:
  - **Copy page** — fetches the page's own `.md` (same origin) and copies it;
  - **View as Markdown** — a link to `<page>.md`;
  - **llms.txt** — a link to `/llms.txt`;
  - **Open in Claude** — copies a prompt ("Read <absolute .md URL> and answer my questions about
    Menkar.") and opens `https://claude.ai/new` in a new tab, with a note "Prompt copied — paste
    it", since `?q=` is reported not to prefill there;
  - **Open in ChatGPT** — `https://chatgpt.com/?q=<the same prompt, encoded>`.
  Labels in Starlight's UI strings (`src/content/i18n/es.json` for Spanish). No MCP entries (the
  human, 2026-11-19).
- **`src/pages/[...slug].md.ts`**: a prerendered endpoint from `getCollection('docs')` writing
  each page's Markdown with the remark plugin's Markdown rendering (`shot:` → absolute image,
  `:ui[...]` → the label), frontmatter reduced to its title. The Spanish pages get theirs at
  `/es/<page>.md`.
- **Rejected**: `starlight-page-actions` — its `.md` is the raw source, so `shot:` and `:ui[...]`
  would reach the reader unrendered, it adds share links (X, LinkedIn…) we would switch off, and
  it is one developer's 23-star project; `starlight-llm-actions` — five stars, a repository from
  2026-04, one label per entry with no locales, and it takes over `PageTitle` itself. Our
  component is about a hundred lines, has no dependency, and renders what the pages really say.

### 2.6 No tracking, and how it is held

The site has no analytics and loads nothing from another origin. Held by:
1. `site/scripts/check.mjs` scans every built `.html`, `.css` and `.js` in `dist/`: any `src`,
   `srcset`, `href` on `<link>`, `poster`, `@import`, `url(...)`, `<iframe>`, `<object>`,
   `<embed>` or `<form action>` with an absolute or protocol-relative URL fails, and so does any
   `sendBeacon`, `XMLHttpRequest` or `fetch(` whose argument is not a relative path. Outbound
   `<a href>` links are navigation and pass.
2. `ASTRO_TELEMETRY_DISABLED=1` in every site script and in the workflow.
3. The tone guide's "Privacy" rule.
Rejected: a `<meta>` Content-Security-Policy — Starlight's inline theme script would need a hash
kept in step with every Starlight release, and the scan catches the same thing at build time;
deferred with its trigger (a script the scan cannot read, e.g. a third-party plugin's).

### 2.7 Tests and checks

**In `npm run ci`** (fast, no site install), `tests/site/*.test.ts`:
- `rules-file.test.ts` — `site/CLAUDE.md` is exactly `@AGENTS.md\n`.
- `locales.test.ts` — **every page has its twin**: the set of paths under `docs/` (minus `es/`)
  equals the set under `docs/es/`; each pair has the same `shot:` slugs in the same order, the
  same number of `##` headings, and the same `sidebar.order`. Fails naming the page.
- `locales.test.ts` — **the locale lists agree**: `LOCALES` in the registry, the locales in
  `astro.config.mjs` (read with a parse, not imported), and the app's catalogs under
  `src/core/i18n/` are the same set (the parity test an enum across a boundary needs).
- `captures.test.ts` — every `shot:` slug used in a page is in the registry; every registry slug
  has its file for every locale × theme; no file in `src/assets/captures/` is outside the
  registry; every file's sha256 equals `reviewed.json`'s.
- `ui-keys.test.ts` — every `:ui[key]` in a page is a key of `src/core/i18n/en.ts`.
- `headings.test.ts` — no heading starts with a number (the tone guide's mechanical rule).
- `seed.test.ts` — the two locales seed the same structure; the time function at 00:03, 12:00 and
  23:55 local (through `src/core/clock.ts`'s test clock).

**`npm run site:check`** (needs `site:install`; not in `ci`): `astro build` with
`starlight-links-validator` (broken internal link, either locale, fails), then `check.mjs`: the
tracking scan, every `<img>` in `dist/` resolving to a file. With `--release` it also fails on a
page that still holds a `<!-- plan 28: … -->` marker. Not in `npm run ci` because `ci` must not
require the site's own `node_modules`; plan 28's `pr.yml` gets a path-filtered `site` job running
it (not a required check — a required check skipped by a path filter stays pending and blocks the
merge).

**Every new check is seen failing once** against an injected defect: a page without its twin, a
`shot:` to an unknown slug, an unreviewed image, `<script src="https://example.com/a.js">` in a
page, a link to a missing page.

### 2.8 Rejected

- **Mintlify, MkDocs Material** — 1.189.
- **Captures inside `npm run ui-check` specs** — specs assert behaviour, captures sell; tying them
  would make a copy change fail the suite and a test refactor move the docs' images.
- **Captures generated in the deploy workflow** — the images would go live without anyone having
  opened them, and Actions would build Electron under Xvfb on every docs push (D4).
- **The seed writing the app's JSON by hand, as `e2e/fixtures.ts` does** — a second, undocumented
  copy of the app's formats that drifts (ccai's advice).
- **The seed's strings in the app's catalogs** — they would ship in the app, and the i18n check
  flags unused keys.
- **Masking volatile content with CSS** — the seed owns time instead.
- **MDX** — the copied `.md` would carry imports and components.
- **Generating the orchestration pages from the guide** — the guide is written for agents too,
  with tool names; the site needs captures and a selling order.

## 3. Plan 28's side (agreed with `menkar-t127`, 2026-11-19)

- Plan 46 owns `site/`, `docs.yml`, the domain and every page, the Install page's text included.
- Plan 28 owns the release workflow, packages, the APT/RPM repository and its key, the assets'
  names (`menkar_<X.Y.Z>_amd64.deb`, `menkar-<X.Y.Z>.x86_64.rpm`, `SHA256SUMS`), `pr.yml`,
  `CONTRIBUTING.md`.
- **The Install page** links releases only through `https://github.com/<owner>/menkar/releases/latest`
  — no version on the site. Its APT and RPM commands are plan 28's facts, **whose source of truth
  is `docs/packaging.md`** ("Installing from the repository"): plan 46 writes the page with
  `<!-- plan 28: apt commands -->` … `<!-- /plan 28 -->` (and `rpm commands`) around pending
  blocks; plan 28 fills only those blocks and runs `npm run site:check`, or, if plan 46 has not
  landed, writes them in `docs/packaging.md` for plan 46 to copy.
- **The Install page states only what a release supports**: Linux's `.deb` and `.rpm` (1.190).
  No Windows, no WSL, and no macOS until it ships after 1.0 (1.191).
- Whichever plan lands second adds the `site` job to `pr.yml`.
- The first deploy is a step of plan 28's going-public checklist.

## 4. Out of scope

- Hosting anywhere but GitHub Pages; a custom domain's purchase and DNS (D2 decides whether).
- Search beyond Starlight's Pagefind; an "Ask AI" box; comments; a blog; versioned docs (one
  version, the latest release).
- A Spanish `llms.txt` (deferred, above); languages beyond en and es.
- Rewriting `plugin/guide/orchestration-mode.md` or any `docs/` file beyond the exit.
- Changing the app to make a capture easier (a capture photographs the app as it is; a bug it
  finds is reported to `set`, not fixed in this plan).
- Windows and macOS screenshots (a release supports Linux only, 1.190; macOS comes after 1.0, 1.191; the Install page says so).

## 5. Do not touch

- `src/` (the site and the seed only import from it), `e2e/*.spec.ts`, `e2e/fixtures.ts`,
  `e2e/app.ts` (imported, not changed; a needed hook is asked of `set` first), `playwright.config.ts`.
- `plugin/`, `docs/spec/`, the internal `docs/` beyond the exit's files.
- `.github/workflows/pr.yml` and the release workflow (plan 28's), except the `site` job if plan 28
  landed first.
- The human's `~/.config/menkar/`, `~/.claude`, `$MENKAR_FILES` beyond the worker's own contact
  sheets, and their running Menkar. Captures run only under `xvfb-run` in throwaway homes.
- Nothing is pushed and nothing is deployed by a worker; the first deploy is the human's, at 1.0.

## 6. Decisions for the human

**Decided by the human, 2026-11-19 (topic 73):** D1 yes (Spanish captures); **D2 (a)** GitHub's
address; **D3 (a)** a "What comes next" page with only what is decided; **D4 (a)** captures
committed; **D5 (a)** a scripted stand-in terminal per session; **D6 (b), not the recommended
one: Get started first**, then the orchestration mode, which stays the headline on the splash.
**No Windows on the site** (the human, 2026-11-19, decision 1.190, topic 74): the roadmap page
names no Windows, the Install page states Linux's `.deb` and `.rpm` only, and no page mentions WSL.
macOS is on the roadmap as "macOS, experimental, after 1.0" (1.191), labelled as tested on
GitHub's runners only, not on a real Mac.

**D1 — Does the Spanish site get its own captures?** *Taken as decided*: yes, in Spanish (the
human's lean, relayed by `set` on 2026-11-19, "unless it adds a lot of complexity"). It adds no
code: the locale is a parameter of the seed and the walk from the first version. Its cost is
twice the images (22 slugs in §2.4 × 2 locales × 2 themes = 88 files) and twice the review; the run
time is measured in block 4 and reported. If the measured numbers look heavy, `set` brings them
back to the human.

**D2 — The domain.**
- **(a) GitHub's address, `<owner>.github.io/menkar` (recommended for 1.0)**: free, HTTPS by
  default, no DNS to keep. Moving later to a custom domain loses links already shared (Pages
  cannot redirect except with a page per URL).
- (b) A custom domain from the first deploy: an address that survives leaving GitHub, at a yearly
  cost and a DNS record to keep; the human buys it.

**D3 — How much roadmap goes out.**
- **(a) A "What comes next" page listing only what `00-STATUS.md` records as decided and
  user-visible (recommended)**: today Codex and OpenCode in the orchestration mode, and macOS,
  experimental, after 1.0 (1.191; labelled: tested on GitHub's runners only, not on a real Mac)
  — one line each, no dates, no plan numbers, reviewed at each release.
- (b) No roadmap: the site shows only the released app (ccai's rule); the new main feature then
  looks finished and its next steps invisible.
- (c) The public mirror of `00-STATUS.md` §3: internal order, plan numbers and states change
  daily and promise more than decided.

**D4 — Where the captured images live.**
- **(a) Committed in `site/src/assets/captures/` (recommended)**: reviewed before they go live,
  the build needs no Electron; the importer keeps an unchanged image's old file, so git grows
  only on real changes. A full recapture of 88 palette-reduced images is a few tens of MB once;
  measured in block 4.
- (b) Git LFS: a smaller clone, but LFS quotas on GitHub's free plan and one more tool for every
  contributor.
- (c) Generated in the deploy workflow: images go live unseen (§2.8).

**D5 — What the terminals show in a capture.** The headline screens are mostly terminals.
- **(a) A scripted stand-in screen per session (recommended)**: short, invented content in the
  locale (a prompt, a few lines of an agent at work, a permission question), plain enough not to
  pass for a copy of Claude Code's interface pixel for pixel; deterministic and offline.
- (b) The real Claude Code, in a throwaway home with a dedicated account: true screens, but
  network, credentials, cost and a different screen every run — against the seed discipline.
- (c) Terminals cropped out or blurred: honest but the orchestration mode loses what sells it.

**D6 — The sidebar's order.** Where things go in the UI is the human's.
- **(a) Orchestration mode first, then Get started (recommended)**, with Install as the splash's
  button — the human asked for the mode as the headline.
- (b) Get started first, then the orchestration mode: the usual docs order; the headline lives
  only on the splash.

## 7. Before block 1 (for `set` and the human)

- **Node**: update the machine's Node 22 to ≥ 22.23.4 (Astro 7's minimum); the app's `engines`
  (`>=22.12.0 <23`) still holds. A worker does not install system software.

## 8. Execution blocks

Workers at most three at once (1.153), never two on one file. **Order**: 1 → (2 ∥ 3 ∥ 5 ∥ 6) →
4 → 7 → (8 ∥ 9) → 10. Blocks 3 and 5 share no file: block 1 writes the registry's types and an
empty list both read.

### Block 1 — the skeleton and the tone guide
Files: `site/` (`package.json`, lockfile, `astro.config.mjs`, `tsconfig.json`, `AGENTS.md`,
`CLAUDE.md`, `src/content/docs/index.md`, `src/content/docs/es/index.md`, `src/content.config.ts`),
`e2e/captures/registry.ts` (types, `LOCALES`, `THEMES`, an empty `CAPTURES`),
`e2e/captures/strings/en.ts`, `es.ts` (empty), root `package.json` (scripts `site:install`,
`site:dev`, `site:build`, `site:check` only), `biome.json` (`site/scripts/**`, `site/src/**/*.ts`,
`site/src/**/*.mjs`, `site/*.mjs`), `tests/site/rules-file.test.ts`, `scripts/nothing-lost.mjs`
and `tests/scripts/nothing-lost.test.ts` (`site/AGENTS.md` mirrored to
`docs/history/root/site-AGENTS.history.md`).
- [ ] Starlight with `root` en and `es`, the three plugins, telemetry off in every script,
  `site`/`base` from D2 (`<owner>.github.io` + `/menkar` until D2 says otherwise), sidebar groups
  per §2.4 (autogenerated per folder, order per D6).
- [ ] `site/AGENTS.md` = §2.2's draft; `site/CLAUDE.md` = `@AGENTS.md\n`.
- [ ] Test first: `rules-file.test.ts`; nothing-lost's new case (a line removed from
  `site/AGENTS.md` without its mirror fails).
- **Verify**: `npm run site:install && npm run site:build` builds both locales; `npm run ci`
  green; each new test seen failing once.

### Block 2 — the tone guide reviewed (parallel with 3, 5, 6)
Files: `site/AGENTS.md` only.
- [ ] Ask `set` to forward `site/AGENTS.md` to ccai's `documentation` session for review (never
  directly). Apply each comment, each with its case; what is declined is said in the report with
  why.
- **Verify**: `npm run ci` (history check: lines removed from `site/AGENTS.md` are mirrored).

### Block 3 — the seed (parallel with 2, 5, 6)
Files: `e2e/captures/seed.ts`, `e2e/captures/strings/en.ts`, `es.ts`,
`e2e/captures/stand-in-claude.mjs`, `tests/site/seed.test.ts`.
- [ ] Tests first: both locales seed the same structure; the time function at 00:03, 12:00,
  23:55; `strings/es.ts` typed complete (a missing key is a `tsc` error — seen once).
- [ ] The seed per §2.3, through the app's writers, explicit paths only; one team project
  ("Northwind app": an orchestrator, two workers with tasks at different steps, a consultant, a
  role with skills, topics open/discussing/closed, a task in To review waiting on the human, Done
  today), usage history for a week, and the plainer scenes (Add session, files, chat, settings).
- [ ] The stand-in prints the seeded screen and sets the title for its state (find how
  `e2e/agent-state`-related specs drive the states and reuse that title format; cite the line).
- **Verify**: `npm run ci` green.

### Block 4 — the capture run and the importer (after 3)
Files: `e2e/captures/scenes.ts`, `e2e/captures/captures.run.ts`, `e2e/captures/registry.ts`
(three entries: `hero-orchestration`, `board-default`, `first-time-card`),
`playwright.captures.config.ts`, `site/scripts/import-captures.mjs`, `site/package.json`
(`sharp`), root `package.json` (`captures`, `captures:reviewed`),
`site/src/assets/captures/**`, `reviewed.json`, `tests/site/captures.test.ts`.
- [ ] Every guard of §2.3: ready proof and seeded numbers, the app identified, no fixed sleep,
  1280 × 800 at scale 2, `CAPTURE_ONLY` filtering writes, `pageerror` collected,
  `CAPTURE_CHECK=1` writes nothing.
- [ ] The importer: palette, unchanged-pixels keep, hashes, duplicates fail, flat image fails,
  contact sheets.
- [ ] Injected defects, each seen failing: a scene whose navigation is removed (duplicate
  caught), a ready locator that never appears (no image written), an image edited after review
  (`captures.test.ts` fails).
- [ ] Open every image written (2 locales × 2 themes × 3), then `captures:reviewed`.
- **Verify**: `npm run captures` twice — the second run writes no file (`git status` clean under
  `site/src/assets/captures/`); report the run's time and the images' total size (D1, D4);
  `npm run ci` green; `npm run ui-check` unaffected (the captures file is not a spec).

### Block 5 — the site's machinery (parallel with 2, 3, 6)
Files: `site/src/remark/menkar.mjs`, `site/src/components/PageTitle.astro`,
`site/src/pages/[...slug].md.ts`, `site/src/content/i18n/es.json`, `site/scripts/check.mjs`,
`site/astro.config.mjs` (the remark plugin, the override), `site/src/content/docs/reference/shortcuts.md`
and its `es/` twin (generated table), `tests/site/locales.test.ts`, `ui-keys.test.ts`,
`headings.test.ts`.
- [ ] Tests first (§2.7), each seen failing on its injected defect.
- [ ] `shot:` (until block 4 lands, a registry fixture in the test), `:ui[...]`, the `.md`
  endpoint, the Copy page menu (§2.5), the tracking scan and `--release` markers (§2.6).
- **Verify**: `npm run site:check` green; the built HTML of a test page holds two optimised
  `<img>` per shot, each in its theme wrapper; its `.md` has the absolute image and the label
  text; the open menu in both themes and locales screenshotted from the built site
  (`npx --prefix site astro preview`) under Xvfb into `$MENKAR_FILES`
  (`menkar-tNNN-copy-menu-*.png`) — with Playwright's Chromium if it is installed, else ask `set`
  before downloading a browser.

### Block 6 — the Pages workflow (parallel with 2, 3, 5)
Files: `.github/workflows/docs.yml`.
- [ ] Per §2.1: triggers, the two jobs, `if` on `private`, SHA-pinned actions, telemetry off.
- **Verify**: `actionlint` if available, else `npx --yes @action-validator/cli` in a scratch
  folder, never added to the repository; reading the file against §2.1. It cannot run until
  pushed: `set` checks the first run's `build` job after its commit (deploy skipped while
  private).

### Block 7 — every capture (after 4 and 5; needs D4, D5)
Files: `e2e/captures/registry.ts`, `scenes.ts`, `seed.ts`, `strings/*`, `site/src/assets/captures/**`,
`reviewed.json`.
- [ ] The rest of §2.4's slugs, each with its alt text in both locales.
- [ ] Open every image; `captures:reviewed`; contact sheets into `$MENKAR_FILES`
  (`menkar-tNNN-sheet-<locale>-<theme>.png`) for the human.
- **Verify**: `npm run captures` green and idempotent; `npm run ci`.

### Block 8 — the orchestration pages (after 7; parallel with 9; needs D3, D6)
Files: `site/src/content/docs/index.md`, `orchestration/**`, `roadmap.md` and their `es/` twins.
- [ ] Written to the tone guide, each English page and its Spanish twin in the same change.
- **Verify**: `npm run ci` (twins, slugs, keys, headings); `npm run site:check`.

### Block 9 — the other pages (after 7; parallel with 8)
Files: `install.md` (with plan 28's markers, or the commands from `docs/packaging.md` if plan 28
landed), `start.md`, `agents.md`, `sessions/**`, `usage/**`, `settings/**`,
`reference/privacy.md`, and their `es/` twins.
- **Verify**: as block 8.

### Block 10 — the exit (after 8 and 9)
Files: `docs/site.md`, `AGENTS.md`, `docs/toolchain.md`, `docs/release-checklist.md`,
`docs/NOT_BUILT_YET.md`, `README.md`, `plans/00-STATUS.md`, and this plan deleted.
- [ ] Each part to the file the header names; superseded lines to `docs/history/`.
- **Verify**: `npm run ci` (the history check); `AGENTS.md` under 300 lines.

## 9. Execution log

(Written by the sessions that execute it.)
