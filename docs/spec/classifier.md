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

- Built: `docs/classifier.md` describes how; `src/core/classifier/prompt.ts` holds them.

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

- Built: `docs/classifier.md` describes how; `src/core/classifier/settings.ts` holds it.

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

- Built and tested: the tests in `tests/core/classifier/`, `tests/core/latest.test.ts`, `tests/scripts/` and `e2e/integrations.spec.ts` carry the CLS ids.

## Look

- Built: `src/renderer/integrations.ts` and the Usage window; the category colors are the series colors LOOK-50 asserts. Reference screenshots: `img/integrations-*.png`, `img/classify-earlier-*.png`, `img/usage-by-category-*.png`.
