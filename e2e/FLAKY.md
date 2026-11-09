# Quarantine

An e2e test that fails now and then and **cannot be fixed today** is written here instead of staying
red or disappearing. `npm run ci` reads the rows (`scripts/check-flaky.mjs`).

**`expires` is what keeps this from becoming a graveyard.** A row names a concrete day, and on that
day the test **is fixed or deleted**. The date is not extended: if the fix did not come in a month,
what the row was hiding is that the test is not worth what it costs.

What does **not** go here: a test that fails twenty runs out of twenty is not flaky, **it is
broken**, and goes straight to review.

The format is exactly these three columns — the check parses them.

| test                                                 | reason                                                                                                                                                                                                                                                                                                                                                    | expires    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| TRM-25 after the last match, down wraps to the first | 2026-11-09: under the full suite the second down button left the selection on the first match (expected its top 213, got 138; poll timed out at 15 s). Never reproduced alone, 25 times under parallel load, or in a full run with a trace (which waited 300 ms between finds); the addon's debounced highlighting of every match is the unproven suspect | 2026-12-09 |
