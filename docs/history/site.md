# History of `docs/site.md`

## Captures

> Left on 2026-11-23 (task 192): the run took the real clock's day and hour, so eight captures changed with when they were taken; every run now takes one fixed instant.
- **Time is the seed's**: every timestamp derives from the `now` it is given. Today's events are
  squeezed in order after midnight when the day is young, so "Done today" holds whenever it runs;
  near midnight the run waits rather than straddle it.
