# Classifier — turns by development stage

The opt-in classification of each turn the human types into one SDLC stage, through Claude Haiku
run as `claude -p` with the user's own login: the switch in Preferences → Integrations, which turns
are sent and when, the exact invocation and what it sends, how the answer is read and stored,
inheritance for turns the human did not start, the "Classify earlier turns" run (date, count,
estimate, progress, Stop) and the offline evaluation of a prompt or model change. It specifies
**F42**, **F43**, **F44** and the Preferences buttons "Classify earlier turns…" and "Stop". Where
the categories show (the Usage window, `usage --json`) is `usage.md`'s; the parts that depend on
classification are repeated here briefly so the contract is in one place. Source decisions:
agent-tablet's `plans/00-STATUS.md` 1.20, 1.21, 1.23, 1.25.

## Behaviour

### The categories

Seven, in this fixed order (the order is used for display and for colors):

| Key | Shown as | Covers (as the prompt to Haiku defines it) |
|---|---|---|
| `plan` | "Plan" | deciding what to do next, priorities, scope, sequencing; launching or coordinating sessions; writing prompts for other sessions |
| `design` | "Design" | how something should work or why: UX, screens, business rules, architecture, data model, research, understanding a concept or the code |
| `build` | "Build" | writing or changing code, executing a plan, UI text or behaviour changes in the code |
| `test` | "Test" | testing, QA, trying the app, **code review** of a PR or branch, checking a merge broke nothing, a failing test or CI |
| `deploy` | "Deploy" | releases, release candidates, tags, changelog, installing or upgrading an environment, push |
| `maintain` | "Maintain" | production troubleshooting, incidents, customer problems on a running install, and **documentation** (guides, manuals, docs edits) |
| `other` | "Other" | acknowledgements and coordination with no task of its own, questions about the tooling |

A turn with no category is shown as "Unclassified" (its report label is `(unclassified)`).

### The switch (F42)

- Built: `docs/preferences.md` describes how; plan 12 built it.

### Which turns the hourly pass sends

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### What is sent for each turn

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### The invocation

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### The system prompt

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### Reading the answer

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### Inheritance for turns the human did not start

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### Classify earlier turns (F43)

- Built: `docs/preferences.md` describes how; plan 12 built it.

### The evaluation (F44)

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

## Data contracts

### Settings (`$XDG_CONFIG_HOME/menkar/state.json`, under `settings`)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `classify_since` | number (Unix seconds) or `null` | absent = `null` | the moment the switch was last turned on; `null`/absent = off |
| `classify_last` | object or absent | absent | the last run: `{"at": <Unix seconds>, "classified": <int>, "failed": <bool>}` |

Both are imported from agent-tablet's `state.json` with the other settings (Menkar decision 1.8).
`usage --json` reads `classify_since` from `state.json` (read only) to decide whether to carry the
category level.

### The usage history (`$XDG_DATA_HOME/menkar/history.sqlite`, table `turns`)

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### The usage cache (`$XDG_CACHE_HOME/menkar/usage.sqlite`, table `turns`)

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### Transcript fields read

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### The `claude -p` reply

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### The evaluation's label files

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

### Constants

- Built: `docs/classifier.md` describes how; `src/core/` holds it.

## Acceptance cases

- CLS cases not listed below: built; the Vitest tests in `tests/core/classifier/` and `tests/scripts/` carry these ids.

- **CLS-1** Fresh install, no `classify_since` → the switch is off, the "Classify earlier turns"
  row is hidden, no `claude -p` is ever started, and the Usage report has no category level.
- **CLS-30** 0 turns to send → the button reads "Classify" and is disabled.
- **CLS-31** The history file cannot be opened while counting → "Could not read the usage history
  (see the log)." and the button disabled.
- **CLS-32** Picking day A then, before A's count returns, day B → only B's estimate is ever shown.

## Look

- `img/integrations-dark.png` (`img/integrations-light.png`): the Integrations page. The capture
  was taken at a width too narrow for the page's column, so its text wraps letter by letter — read
  it for the page's position (second page of Preferences, tab "Integrations" with a puzzle-piece
  icon next to "General" with a tools icon), not for the layout; it needs retaking wider.
- `img/classify-earlier-dark.png` (`img/classify-earlier-light.png`): the earlier-turns dialog over
  Preferences — heading centered and bold, body centered under it, a full-width month calendar
  (month and year each with ◀ ▶ arrows, weekday header Sun…Sat, days of adjacent months dimmed,
  the selected day filled with the accent color, today underlined), the three estimate lines
  left-aligned, and the two responses side by side at the bottom ("Cancel" plain, "Classify 9
  turns" in the accent color as the suggested response).
- `img/usage-by-category-dark.png` (`img/usage-by-category-light.png`): the Usage window's Totals
  with classification on: each project expands to category rows ("Unclassified" in the capture)
  indented one level, each expanding to its sessions indented a second level.

Measurable details:

- The Preferences group "Classify turns" is a standard preferences group: a switch row (title, a
  multi-line dim subtitle: the explanation, then the status line), then an action row whose
  suffix is the button "Classify earlier turns…" or, while running, the button "Stop" (both
  vertically centered, regular buttons).
- The dialog's extra content: vertical box, spacing 12 px: the calendar, then a row (spacing 8 px)
  of a spinner aligned to the top and the wrapping, left-aligned estimate text (one line per item).
- **Category colors** (the same everywhere a category is drawn: chart segments, legend swatches;
  from agent-tablet's Usage window; validated for color-vision deficiencies against light and dark
  view backgrounds):

  | Category | Light | Dark |
  |---|---|---|
  | plan | `#2a78d6` (blue) | `#3987e5` |
  | design | `#eb6834` (orange) | `#d95926` |
  | build | `#1baf7a` (green) | `#199e70` |
  | test | `#eda100` (amber) | `#c98500` |
  | deploy | `#e87ba4` (pink) | `#d55181` |
  | maintain | `#008300` (dark green) | `#008300` |
  | other | `#6250d6` (violet) | `#9085e9` |
  | Unclassified | `#8a8986` (gray) | `#8f8e8a` |

  A category keeps its color in every period. Categories are listed in the fixed order above,
  "Unclassified" last.
- While the switch is off, the Usage window shows a dim, wrapping hint:
  "Turn on “Classify turns” in Preferences → Integrations to split each project by category."
  (layout and the `[Project | Category]` stack switch: `usage.md`).
