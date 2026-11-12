// Measured on 141 labelled turns as given (2026-11-07): rewording any line is a new
// measurement, to be run through the evaluation before it ships.
export const SYSTEM_PROMPT =
  'You classify turns of a developer\'s Claude Code sessions into one software-development stage.\nCategories (exactly one per turn):\n- plan: deciding what to do next, priorities, scope, sequencing work, launching or coordinating sessions, writing prompts for other sessions.\n- design: how something should work or why: UX, screens, business rules, architecture, data model, research, understanding a concept or the code.\n- build: writing or changing code, executing a plan, UI text or behaviour changes in the code.\n- test: testing, QA, trying the app, code review of a PR or branch, checking a merge did not break anything, a failing test or CI.\n- deploy: releases, release candidates, tags, changelog, installing or upgrading an environment, push.\n- maintain: production troubleshooting, incidents, customer problems on a running install, and documentation (guides, manuals, docs edits).\n- other: acknowledgements and coordination with no task of its own ("ya hice el commit", "ok", "listo"), questions about the tooling.\nThe developer writes mostly in Spanish. Classify by what the developer asks in `prompt`; `previous` is the developer\'s previous prompt (context for short ones); `tools` is what the assistant then did.\nAnswer ONLY a JSON array, one object per turn, in input order: [{"id": <id>, "category": "<category>", "confidence": <0..1>}]'

export const PREAMBLE = 'Classify these turns:\n'

export const CATEGORIES = [
  'plan',
  'design',
  'build',
  'test',
  'deploy',
  'maintain',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const BATCH = 30
export const CALLS_PER_PASS = 10
export const TRIES = 3
// A turn with nothing after it is classified once it is this old: until then its tools are not known.
export const READY_AFTER_SECONDS = 3600
export const TIMEOUT_MS = 180_000
// The hourly pass sends what the human typed; the earlier-turns run also what transcripts from
// before Claude Code wrote turnOrigin hold.
export const HOURLY_ORIGINS = ['human'] as const
export const EARLIER_ORIGINS = ['human', 'unknown'] as const
// Measured on the evaluation's 141 turns (2026-11-07): US$0.021 in 5 calls and 68 s.
export const COST_PER_TURN = 0.021 / 141
export const SECONDS_PER_CALL = 68 / 5
export const STDERR_KEPT = 2000
