# Quarantine

An e2e test that fails now and then and **cannot be fixed today** is written here instead of staying
red or disappearing. `npm run ci` reads the rows (`scripts/check-flaky.mjs`).

**`expires` is what keeps this from becoming a graveyard.** A row names a concrete day, and on that
day the test **is fixed or deleted**. The date is not extended: if the fix did not come in a month,
what the row was hiding is that the test is not worth what it costs.

What does **not** go here: a test that fails twenty runs out of twenty is not flaky, **it is
broken**, and goes straight to review.

The format is exactly these three columns — the check parses them.

| test | reason | expires |
| ---- | ------ | ------- |
