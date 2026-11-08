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

Preferences → page "Integrations" (icon: a puzzle piece, `application-x-addon-symbolic`) → a second
group titled **"Classify turns"**, under the "Claude Code settings" group of `context.md`.

- A switch row, title **"Classify each new turn by development stage"**, **off by default**.
  Its subtitle is always:
  "Each prompt you type from now on is sent to Claude Haiku with your login, with your previous
  prompt and the files and commands the agent used, and counts against your plan. The Usage window
  then splits each project by category."
  followed, on a second line, by the status of the last run when there is one (below).
- **Turning it on** stores the current time as `classify_since`; **turning it off** stores `null`.
  Turning it off and on again starts again from the new moment: turns opened while it was off are
  never sent by the hourly pass (only by "Classify earlier turns"). Off, nothing is sent and nothing
  runs; time, tokens and cost stay by project and session.
- The switch does not touch `~/.claude/settings.json`; unlike the status line row above it, it is
  the app's own setting.

**The status line** (second line of the subtitle), from the last run's record `classify_last`:

- success: "{count} turns classified · {when}" — `count` is how many turns that run got a category
  for (it can be 0);
- failure: "Could not run Claude (see the log) · {when}".

`{when}` is the run's local time as `HH:MM` when it is today (local date), otherwise
`YYYY-MM-DD HH:MM`. With no record (never ran) the line is absent. agent-tablet's `docs/usage.md`
quotes the failure text without " · {when}"; the code appends it.

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

Below the switch, a row titled **"Classify earlier turns"**, **visible only while the switch is
on**, with subtitle "Turns from before you turned it on, from a date you choose." and a button
**"Classify earlier turns…"** at its end.

1. The button opens a dialog: heading **"Classify earlier turns"**, body
   "Turns opened from this day on that have no category yet are sent to Claude Haiku.", a month
   calendar with **today minus 7 days** preselected, and under it a line with a spinner and
   "Counting turns…". Responses: **"Cancel"** (also Esc / closing) and a suggested button that
   reads **"Counting…"**, disabled, while counting.
2. Counting runs in the background for the selected day (from its local midnight to now):
   - which turns: origin `human` **or** `unknown` (transcripts from before Claude Code wrote
     `turnOrigin`), opened at or after that midnight, no category, fewer than 3 tries, and ready
     (as in the hourly pass: a later turn in the session, or older than an hour);
   - each is checked only against its transcript's **size**, never its text (reading thousands of
     turns made the dialog wait): a turn whose transcript is unknown to the cache, missing, or now
     no longer than the turn's recorded offset counts as **unavailable**; the rest are **to send**
     (agent-tablet's docs say only "whether each transcript is still there"; the code also counts
     a transcript cut shorter than the turn's offset).
3. When counting ends, the spinner hides, the line shows the estimate, one line each:
   - "Turns to send: {turns}"
   - "Estimated use of your plan: {cost}" — `turns × 0.021 / 141` US$, shown "under US$0.01" below
     one cent, else "US$" with two decimals (e.g. `US$0.04`);
   - "Estimated time: {took}, in the background" — calls = ⌈turns / 30⌉, seconds = calls × 68 / 5
     (13.6 s per call), minutes rounded to the nearest: "under a minute" when that is 0, else
     "about {minutes} min";
   - only when some are unavailable: "Left unclassified, their transcript is gone: {count}".

   The button reads **"Classify {count} turns"** and is enabled when turns to send > 0; with 0 it
   reads "Classify" and stays disabled. If the history or the cache cannot be read, the line reads
   "Could not read the usage history (see the log)." and the button stays disabled with "Classify".
4. Picking another day restarts counting (button back to "Counting…", disabled); a count that
   finishes for a day no longer selected is dropped.
5. **Confirming** starts the run at once in the background and closes the dialog. It waits for an
   hourly pass in flight, then re-reads what is still unclassified (so no turn is sent twice), and
   sends **all** of them in batches of 30, with **no** per-pass cap. A turn whose text can no longer
   be read when its batch is built is skipped **with no try counted**.
6. While it runs, the row's button is replaced by **"Stop"** and the subtitle shows
   **"{sent} of {total}"** (starting at "0 of N"; `sent` advances by each batch's size, the last
   step reaching `total`). Preferences re-reads the progress once a second while it is open; the run
   continues when Preferences is closed.
7. **Stop** ends the run after the call in flight; what was classified stays.
8. When the run ends (finished, stopped, or failed) its result becomes `classify_last` and the
   switch's status line updates ("{count} turns classified · {when}" or the failure line); the row
   returns to its button and its usual subtitle.
9. Running it again continues where it stopped: it only ever picks turns with no category.

Edge: turning the switch off during a run hides the row (and its Stop button) but does not stop the
run.

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
- **CLS-25** Switch off → the "Classify earlier turns" row is hidden; switch on → it shows with the
  button "Classify earlier turns…" and subtitle
  "Turns from before you turned it on, from a date you choose."
- **CLS-26** Opening the earlier-turns dialog on 2026-11-08 → the calendar's selected day is
  2026-11-01; while counting, the button reads "Counting…" and is disabled and the line reads
  "Counting turns…".
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
