# History of `docs/usage.md`

## Limits

> Replaced 2026-11-09 by decision 1.26: Haiku 5.5's long-prompt rate is decided per request.
- Haiku 5.5's long-prompt rate applies to what is priced at once, which is a (model, UTC hour,
  project, session) group. The history keeps no per-request tokens, so a busy hour of short
  requests can be priced at the long rate.

## The export

> Replaced 2026-11-09 by decision 1.26: the long-prompt key is documented.
| `models` | By model id as stored: `input`, `output`, `cache_write`, `cache_write_1h`, `cache_read`, `cost_usd` (list price) and `priced` |
