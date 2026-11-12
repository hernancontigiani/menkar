# History of `docs/usage.md`

## Limits

> Replaced 2026-11-09 by decision 1.26: Haiku 5.5's long-prompt rate is decided per request.
- Haiku 5.5's long-prompt rate applies to what is priced at once, which is a (model, UTC hour,
  project, session) group. The history keeps no per-request tokens, so a busy hour of short
  requests can be priced at the long rate.

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
- Figures are rounded half to even (`2.5m` prints as `2m`), as agent-tablet printed them, so the two
  apps print the same report.

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
  imported from agent-tablet, or deleted before the cache read it), or whose transcript changed
  since, keeps the old pricing of its summed rows.

## The export

> Replaced 2026-11-09 by decision 1.26: the long-prompt key is documented.
| `models` | By model id as stored: `input`, `output`, `cache_write`, `cache_write_1h`, `cache_read`, `cost_usd` (list price) and `priced` |

## Checked against agent-tablet

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
## Checked against agent-tablet
On 2026-11-08, 60 synthetic sessions were generated (118 transcripts over three months). They mixed
legacy prompts, every origin, duplicate and sidechain copies, subagents, decided tools,
`AskUserQuestion`, two-hour gaps, unknown and synthetic models, Haiku 5.5 and bad lines. Both apps'
`usage --period all --by month` printed identical text, and their `--json` matched to 1e-9.
After a third of the transcripts were deleted, Menkar's first start imported agent-tablet's history
and its statusline log and printed the same report as agent-tablet, exact cost and limits included.

## Rejected, and why

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
These were inherited from agent-tablet, where each was measured or decided by the human:

## The shape

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
  Code deletes with its transcripts. Its tables and columns are agent-tablet's version 2, so
  importing agent-tablet's history is a copy.
- **The import** (`importer.ts`): the first time Menkar opens its history and finds no file at its
  path, it copies agent-tablet's `history.sqlite` (versions 1 and 2, opened read only) into a
  temporary file. The file is renamed into place once committed. agent-tablet's `usage.jsonl` is
  copied too, to `<data>/agent-tablet-usage.jsonl`, which sits in the data directory because it
  cannot be rebuilt. Reports read it before Menkar's own `usage.jsonl`. A copy that fails leaves no
  history, and the opening throws, so the next start tries again. When there is nothing to import
  (no file, an unreadable one, or one from a newer agent-tablet), Menkar starts empty and does not
  try again.
