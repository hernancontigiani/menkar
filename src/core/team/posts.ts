import type { Timers } from '../control/events'
import type { PostOutcome } from '../control/post'

// Keeping a running session's team facts current. A session believes the block its system prompt
// was started with, plus the posts it had since; a compaction or a clear drops the posts.

export interface TeamText {
  // The facts, as `teamFacts` gives them.
  readonly facts: string
  // The whole block: facts, the common part and the agent's.
  readonly block: string
}

// What a pane's session holds of its team: `started`, the block in its system prompt (null when
// it started without one); `held`, what it believes now.
export interface PaneTeam {
  readonly started: TeamText | null
  readonly held: TeamText | null
}

// What `wakeFrame` puts before every text Menkar sends, and what a reader matches.
export const TEAM_UPDATE = 'Team update:'
export const TEAM_MARKER = `[Menkar] ${TEAM_UPDATE}`

export const TEAM_SETTLE_MS = 2000
export const TEAM_POST_TRIES = 5
export const TEAM_POST_GAP_MS = 2000

const NO_REPLY = 'No reply is needed.'

const withoutHeading = (facts: string) => facts.split('\n').slice(1).join('\n')

// (1) What a session holds at start: a fork carries its source's block, not its own.
export function teamAtStart(started: TeamText | null, fork: boolean): PaneTeam {
  return { started, held: fork ? null : started }
}

// A compaction or a clear rebuilds the prompt from the start text.
export const rebuilt = (team: PaneTeam): PaneTeam => ({ ...team, held: team.started })

// An in-tab resume brings back whatever that conversation recorded.
export const resumedOther = (team: PaneTeam): PaneTeam => ({ ...team, held: null })

// A SessionStart record naming the pane. A tab's own `--resume` start names the pane's session and
// changes nothing: the snapshot flag gave it its block. An in-tab `/resume` names another.
export function afterStartRecord(
  team: PaneTeam,
  source: 'clear' | 'compact' | 'resume',
  sameSession: boolean,
): PaneTeam {
  if (source !== 'resume') return rebuilt(team)
  return sameSession ? team : resumedOther(team)
}

export const delivered = (team: PaneTeam, current: TeamText | null): PaneTeam => ({
  ...team,
  held: current,
})

// (3) How a change is told: the text to post, or null when the session already believes it.
export function teamPost(held: TeamText | null, current: TeamText | null): string | null {
  if (held && !current)
    return `${TEAM_UPDATE} the "Your team in Menkar" instructions no longer apply to you. ${NO_REPLY}`
  if (!held && current)
    return `${TEAM_UPDATE} your team instructions, replacing any earlier ones:\n${current.block.trimEnd()}\n${NO_REPLY}`
  if (held && current && held.facts !== current.facts)
    return `${TEAM_UPDATE} your facts are now:\n${withoutHeading(current.facts)}\n${NO_REPLY}`
  return null
}

// Changes come in bursts (the first-time card makes three): a pane's recompute waits until they
// settle, so one post carries the latest.
export class TeamSettle {
  private readonly waiting = new Map<string, unknown>()

  constructor(
    private readonly run: (pane: string) => void,
    private readonly timers: Timers,
  ) {}

  trigger(pane: string): void {
    const timer = this.waiting.get(pane)
    if (timer !== undefined) this.timers.clear(timer)
    this.waiting.set(
      pane,
      this.timers.set(() => {
        this.waiting.delete(pane)
        this.run(pane)
      }, TEAM_SETTLE_MS),
    )
  }

  forget(pane: string): void {
    const timer = this.waiting.get(pane)
    if (timer !== undefined) this.timers.clear(timer)
    this.waiting.delete(pane)
  }

  dispose(): void {
    for (const timer of this.waiting.values()) this.timers.clear(timer)
    this.waiting.clear()
  }
}

// A session just started or joined may not be reachable yet: it is tried again a few times.
export async function postWithTries(
  post: () => Promise<PostOutcome>,
  wait: (ms: number) => Promise<void>,
): Promise<PostOutcome> {
  let outcome: PostOutcome = 'no session'
  for (let i = 0; i < TEAM_POST_TRIES; i++) {
    if (i > 0) await wait(TEAM_POST_GAP_MS)
    outcome = await post()
    if (outcome !== 'no session') return outcome
  }
  return outcome
}
