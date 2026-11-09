# Plan 17 — usage by model, and an export an LLM session can analyse

> **Status:** written 2026-11-08, ready to execute after plans 15 and 16 are committed. Executed by
> `b2`.
>
> **Exit, when executed:** `docs/usage.md` gains "By model" and "Exporting for analysis" (the row
> format, its `schema` number, what is and is not in it); decision 1.16 stays in
> `plans/00-STATUS.md` §1; the MCP server is recorded in `docs/NOT_BUILT_YET.md` with its trigger;
> the rest → `git log`.

## Goal

The human wants to analyse their usage in finer detail than the window shows, and to hand that
analysis to an LLM session: "what did Opus cost me on project X in October", "which category
burns the most cache reads". The data is already there: the history stores tokens per turn, per
model, per hour (`tokens` table in `src/core/usage/history.ts`). This plan adds no new storage.
It makes the per-model data visible, and it makes the raw rows exportable through the existing
`menkar usage` command.

## Decided (the human, 2026-11-08; decision 1.16)

- **Option A: the CLI export.** No MCP server now. An LLM session runs `menkar usage export …`
  through its shell. The MCP server (`menkar mcp`, tools such as `query_usage`) goes to
  `docs/NOT_BUILT_YET.md` with its trigger: the export proves too coarse for a real analysis, or the
  human asks for it. A server would also need registering in Claude's settings, which is an
  integrations-menu consent.
- **Reading `history.sqlite` directly is not offered.** The schema is internal and migrates.
  `docs/usage.md` says the file exists, that the export is the supported interface, and why.
- **Time is per turn, not per model.** One turn can use several models: the main model answers
  while a subagent runs on Haiku. Splitting its seconds between models would invent data. So:
  - tokens and cost are broken down by model;
  - execution and blocked time stay on the turn;
  - nowhere shows "time per model". In the window, Exec offers no Model stack.

## What it builds

### B1 — By model in the report (core, CLI JSON, window)

- **Core.** `Node` gains `models: Record<model, { tokens: Tokens; cost: number; priced: boolean }>`,
  summed exactly like `tokens` and `cost` today, so the two stay consistent. This parity is
  asserted: for every node, the sum over `models` equals `tokens` and `cost`.
  - Model ids are kept as stored (`claude-opus-…`). Display names come from the price table
    when it knows the id, and are otherwise the raw id.
- **CLI JSON.** `nodeJson` gains `models` (snake_case token fields, as `tokens` already uses). The
  text report is unchanged.
- **Window, By day.** A **Model** stack beside Project/Category: the top 5 models and the rest as
  "Other", the same rule as the project series.
  - Offered only with the Tokens and Cost metrics. With Exec selected, the Model button is disabled
    and its tooltip says time is not split by model. Switching to Exec while Model is chosen falls
    back to Project.
  - Respects decision 1.15's single-project scope.
- **Window, Totals.** No new column. A row's tooltip lists its tokens and cost per model.

### B2 — `menkar usage export`

```
menkar usage export [--period P | --month YYYY-MM | --from D --to D] [--project NAME]
                    [--format jsonl|csv] [--output FILE]
```

- **Which turns.** The same period flags as the report, parsed by the same code. A turn belongs to
  the range by its `opened` time and is never clipped. Say so in `--help` and in the doc. The
  default period is the same as the report's (`7d`). `--project` matches a project's name
  exactly; an unknown name is an error that lists the known ones. The output goes to stdout, or
  to `--output`, written whole through a temporary file.
- **JSONL (the default).** One object per turn, in `opened` order:
  ```json
  {"schema":1,"turn":"<uuid>","session_id":"…","session_name":"…","project":"…"|null,
   "category":"build"|null,"origin":"…","opened":"2026-11-08T10:42:05-03:00","opened_epoch":1762...,
   "execution_seconds":{"<kind>":n,…},"blocked_seconds":n,
   "models":{"<model id>":{"input":n,"output":n,"cache_write":n,"cache_write_1h":n,"cache_read":n,
             "cost_usd":n,"priced":true}},
   "cost_usd":n,"cost_exact":bool}
  ```
  - The field names and meanings are the doc's table. `schema` changes only when a field changes
    meaning or is removed. Adding a field does not change it.
- **CSV.** One row per turn, for spreadsheets. It has the same scalar fields; the token fields are
  totals, and `models` holds the model ids joined by `;`. The doc says that per-model analysis
  uses JSONL.
- **What is not in it, and stays out.** Prompt or answer text: the history does not store it,
  and the export must not reach for the transcripts. No paths beyond the project name. A test
  asserts the row keys are exactly the documented set.
- **The pass first.** Like the report, the export runs a pass before reading, so it includes
  the latest turns. The pass is shared code, not copied.
- **Strings.** The new messages for `--help` and the errors, in en and es. The field names stay
  English: they are a data format, not UI.

### B3 — Exit

- `docs/usage.md`: two new sections, "By model" and "Exporting for analysis". The second has the
  row table and one worked example of an LLM prompt using it, for instance "run `menkar usage
  export --month 2026-10` and tell me the cost per model per project".
- `docs/NOT_BUILT_YET.md`: the MCP entry with its trigger.
- Decision 1.16 is already in STATUS §1 (`set` adds it at commit).

## Do not touch

- The history schema. No migration: everything needed is stored already.
- `b1`'s areas.
- The text report's layout.

## Verification

Each block:
- `npm run ci`;
- `npm run ui-check` for B1;
- each new test seen red first.

Vitest:
- models parity on a fixture with two models in one turn (a subagent on Haiku);
- export rows from a fixture history: keys, the `opened`-range rule at both boundaries, `--project`,
  csv quoting of a name that contains a comma and a quote.

e2e:
- the Model stack disabled under Exec, and the fallback to Project.

Screenshot:
- By day, Tokens, stacked by Model → `/tmp/menkar-shots/usage-by-model.png`.

## Execution blocks

### B1 — By model in the report
- [x] Core `models`, parity test; CLI JSON; window Model stack and tooltips.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — The export
- [x] `menkar usage export`, JSONL and CSV, its tests.
- **Verification:** `npm run ci`; run it once against a fixture history and paste five rows into
  the log.

### B3 — Exit
- [x] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

### Found in the code, and `set`'s calls (2026-11-08, under 1.10, technical)

- **Model parity on cost** (a): a session the statusline reported carries its exact cost, while
  per-model costs can only be list-price estimates. The parity holds the tokens always and the
  cost only where `cost_exact` is false; a model's cost is documented as the estimate and marked
  "~" in the tooltip.
- **The export's exact cost per turn** (b): each statusline increment goes to the session's turn in
  effect when it was reported, the categories' rule; a session reported in the range is exact for
  every turn (0 for one with no increment). Asserted: the rows' `cost_usd` add up to the report's
  cost over a range no turn crosses, for an exact session and an estimated one.
- **`execution_seconds` per turn** is keyed by the turn's origin, as the report's JSON keys it
  (the plan wrote `<kind>`); a turn has one origin, so the object has one entry or none.

### B1 — By model (2026-11-08)

- Core: `ModelUsage`, `Models`, `addModels` (`src/core/usage/nodes.ts`); the history's usage
  keeps tokens and list-price cost by model (`history.ts`); `Node.models` summed in `sum()`
  (`report.ts`); `tokensJson()` and `NodeJson.models` (snake_case, `cost_usd`, `priced`).
- Chart: a `model` stack (`chart.ts`): the five models with the most tokens or cost by name, the
  rest "Other", through one `topSeries()` shared with projects; under Exec it is the project
  chart. `modelName()` (`prices.ts`): "Opus 4.5" for a known id, dated or `[1m]`; else the id.
- Window (`src/renderer/usage.ts`): the stack switch is Project / Category / Model (scoped: the
  project's own stack and Model); Model disabled under Exec with the tooltip, Exec falls back to
  Project; Totals' tokens and cost cells list their models. Strings `usage.model`,
  `usage.modelNoTime`, `usage.byModel` in en and es.
- Tests, each red first: model parity (`tests/core/usage/measure.test.ts`); `--json` models
  (`cli.test.ts`); the model series, Exec's fallback and `modelName` (`chart.test.ts`); e2e "plan
  17: Model stacks tokens and cost…" (`e2e/usage-window.spec.ts`), red with the fallback removed
  and with Model enabled under Exec. Three decision-1.15 assertions now name the stack's buttons
  instead of its absence (test integrity reports them; for `set`).
- `docs/usage.md` "By model". Screenshot: `/tmp/menkar-shots/usage-by-model.png`.

### B2 — The export (2026-11-08)

- `src/core/usage/export.ts`: `EXPORT_SCHEMA`, `EXPORT_KEYS`, `exportRows()`, `exportJsonl()`,
  `exportCsv()`; `history.ts`: `turnAt()`, `turnsOpened()` (whole turns, opened in the range);
  `cli.ts`: `menkar usage export` with the report's period flags (`whichOf`, `checkPeriodFlags`
  shared), `--project`, `--format`, `--output` written whole, `--help`. Strings
  `usage.cli.cannotWrite`, `usage.cli.unknownProject`, `usage.cli.exportHelp` in en and es.
- Tests (`tests/core/usage/export.test.ts`), red before the module and then each against its own
  defect: the keys and two models in a turn; the range at both edges, never clipped; `--project`
  and an unknown name; CSV quoting; `--output`; the cost parity; the doc's table against
  `EXPORT_KEYS`.
- Run once against a fixture history (a throwaway HOME and XDG set in the scratchpad; the dev build
  with `--no-sandbox`, as Playwright runs it): `menkar usage export --period 7d --output rows.jsonl`
  gave five rows; JSONL, CSV, `--project 'Shop, API'` (two rows) and an unknown project (exit 2,
  the names listed quoted, after the first run showed a comma-listed "Blog, Shop, API" to be
  ambiguous) all as documented:

```
{"schema":1,"turn":"t-blog-0","session_id":"bbbb2222-0000-4000-8000-000000000002","session_name":null,"project":"Blog","category":null,"origin":"human","opened":"2026-11-06T11:00:00-03:00","opened_epoch":1793973600,"execution_seconds":{"human":150},"blocked_seconds":0,"models":{"claude-sonnet-4-5":{"input":4000,"output":700,"cache_write":0,"cache_write_1h":0,"cache_read":0,"cost_usd":0.0225,"priced":true}},"cost_usd":0.0225,"cost_exact":false}
{"schema":1,"turn":"t-blog-1","session_id":"bbbb2222-0000-4000-8000-000000000002","session_name":null,"project":"Blog","category":null,"origin":"human","opened":"2026-11-07T14:00:00-03:00","opened_epoch":1794070800,"execution_seconds":{"human":360},"blocked_seconds":0,"models":{"claude-sonnet-4-5":{"input":8000,"output":2500,"cache_write":5000,"cache_write_1h":0,"cache_read":0,"cost_usd":0.08025,"priced":true}},"cost_usd":0.08025,"cost_exact":false}
{"schema":1,"turn":"t-blog-2","session_id":"bbbb2222-0000-4000-8000-000000000002","session_name":null,"project":"Blog","category":null,"origin":"human","opened":"2026-11-07T16:00:00-03:00","opened_epoch":1794078000,"execution_seconds":{"human":60},"blocked_seconds":0,"models":{"claude-sonnet-4-5":{"input":3000,"output":900,"cache_write":0,"cache_write_1h":0,"cache_read":0,"cost_usd":0.0225,"priced":true}},"cost_usd":0.0225,"cost_exact":false}
{"schema":1,"turn":"t-auth-1","session_id":"aaaa1111-0000-4000-8000-000000000001","session_name":"JWT auth","project":"Shop, API","category":null,"origin":"human","opened":"2026-11-08T09:00:00-03:00","opened_epoch":1794139200,"execution_seconds":{"human":240},"blocked_seconds":0,"models":{"claude-haiku-4-5":{"input":30000,"output":400,"cache_write":0,"cache_write_1h":0,"cache_read":0,"cost_usd":0.032,"priced":true},"claude-opus-4-5":{"input":12000,"output":1800,"cache_write":0,"cache_write_1h":0,"cache_read":40000,"cost_usd":0.125,"priced":true}},"cost_usd":0.61,"cost_exact":true}
{"schema":1,"turn":"t-auth-2","session_id":"aaaa1111-0000-4000-8000-000000000001","session_name":"JWT auth","project":"Shop, API","category":null,"origin":"peer","opened":"2026-11-08T09:30:00-03:00","opened_epoch":1794141000,"execution_seconds":{"peer":120},"blocked_seconds":0,"models":{"claude-opus-4-5":{"input":2000,"output":600,"cache_write":0,"cache_write_1h":0,"cache_read":0,"cost_usd":0.025,"priced":true}},"cost_usd":0,"cost_exact":true}
```

### B3 — Exit (2026-11-08)

- `docs/usage.md`: "By model" and "Exporting for analysis" (the row table, held to `EXPORT_KEYS` by
  a test; what is in and never in a row; the exact-cost rule; the worked prompt).
- `docs/NOT_BUILT_YET.md`: "An MCP server for usage", with its trigger.
- `README.md` "Usage in the terminal": the export, three examples and the prompt.
- Decision 1.16 goes to `plans/00-STATUS.md` §1 with `set`'s commit.

Verification: `npm run ci`: Biome, tsc, Vitest (612 passed), i18n, flaky and history green; code
rules red only on `console.log` lines in `b1`'s `e2e/files-cases.spec.ts`; test integrity red on
the three decision-1.15 assertions B1 replaced. `npm run ui-check`: 189 passed, 4 failed, all in
`b1`'s in-flight areas (FIL-22, FIL-26, FIL-33/35, TRM-18); every Usage, integrations and
preferences case green.

