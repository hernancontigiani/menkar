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
- [ ] Core `models`, parity test; CLI JSON; window Model stack and tooltips.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — The export
- [ ] `menkar usage export`, JSONL and CSV, its tests.
- **Verification:** `npm run ci`; run it once against a fixture history and paste five rows into
  the log.

### B3 — Exit
- [ ] The exit's files.
- **Verification:** `npm run ci`.

## Execution log
