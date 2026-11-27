// What a running session holds of its team block, and what Menkar posts so it
// believes the current facts. A compaction or a clear goes back to the start text; a fork and an
// in-tab resume hold none of their own; a tab's own resume keeps the block the snapshot flag gave.
import { existsSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { controlPaths, writeTextAtomic } from '../../../src/core/control/files'
import { PROMPT_KEEP_MS, sweepTeamFiles } from '../../../src/core/control/prompt'
import { noStepsLine } from '../../../src/core/orchestration/reminders'
import {
  afterStartRecord,
  delivered,
  type PaneTeam,
  postWithTries,
  TEAM_MARKER,
  TEAM_POST_GAP_MS,
  TEAM_POST_TRIES,
  TEAM_SETTLE_MS,
  TeamSettle,
  type TeamText,
  teamAtStart,
  teamPost,
} from '../../../src/core/team/posts'

const text = (role: string): TeamText => {
  const facts = `# Your team in Menkar\nYou are \`packager\`. Your role: "${role}".`
  return { facts, block: `${facts}\n\n## How the team works\n- by name\n` }
}
const A = text('Packaging')
const B = text('Release')

const FACTS =
  /^Team update: your facts are now:\nYou are `packager`\. Your role: "(\w+)"\.\nNo reply is needed\.$/
const WHOLE =
  /^Team update: your team instructions, replacing any earlier ones:\n# Your team in Menkar\n[\s\S]*## How the team works\n- by name\nNo reply is needed\.$/
const LEAVE =
  'Team update: the "Your team in Menkar" instructions no longer apply to you. No reply is needed.'

// What a session believes after a post, as main applies it.
function step(team: PaneTeam, current: TeamText | null): { team: PaneTeam; post: string | null } {
  const post = teamPost(team.held, current)
  return { team: post ? delivered(team, current) : team, post }
}

describe('the rule', () => {
  test.each([
    ['a block, now none', A, null, LEAVE],
    ['none, now a block', null, A, WHOLE],
    ['a block, other facts', A, B, FACTS],
    ['a block, the same facts', A, A, null],
    ['none, still none', null, null, null],
  ] as const)('%s', (_, held, current, post) => {
    const got = teamPost(held, current)
    if (post === null) expect(got).toBeNull()
    else if (typeof post === 'string') expect(got).toBe(post)
    else expect(got).toMatch(post)
  })

  // 1.217: the no-steps line coming is told; its leaving alone is not, the session set the steps.
  test('the no-steps line added → the facts; only removed → nothing; removed with more → the facts', () => {
    const withLine = (t: TeamText): TeamText => ({
      facts: `${t.facts}\n${noStepsLine(4)}`,
      block: t.block,
    })
    expect(teamPost(A, withLine(A))).toMatch(/has no steps yet/)
    expect(teamPost(withLine(A), A)).toBeNull()
    expect(FACTS.exec(teamPost(withLine(A), B) ?? '')?.[1]).toBe('Release')
  })

  test('the facts post holds the facts without their heading', () => {
    expect(FACTS.exec(teamPost(A, B) ?? '')?.[1]).toBe('Release')
  })

  test('what Menkar sends opens with the marker a reader matches', () => {
    for (const post of [teamPost(A, B), teamPost(null, A), teamPost(A, null)])
      expect(`[Menkar] ${post}`.startsWith(TEAM_MARKER)).toBe(true)
  })
})

describe('the sequences', () => {
  test('a change → the facts; the same change again → nothing', () => {
    let s = step(teamAtStart(A, false), B)
    expect(s.post).toMatch(FACTS)
    s = step(s.team, B)
    expect(s.post).toBeNull()
  })

  test('a compaction after a post: back to the start text, posted again only if it differs', () => {
    const posted = step(teamAtStart(A, false), B).team
    expect(step(afterStartRecord(posted, 'compact', true), A).post).toBeNull()
    expect(step(afterStartRecord(posted, 'compact', true), B).post).toMatch(FACTS)
    expect(step(afterStartRecord(posted, 'clear', false), B).post).toMatch(FACTS)
  })

  test("a fork's join → the whole block: it carries its source's", () => {
    expect(step(teamAtStart(A, true), A).post).toMatch(WHOLE)
  })

  test('an in-tab resume → the whole block, then after a compaction the facts if they differ', () => {
    const started = teamAtStart(A, false)
    const resumed = step(afterStartRecord(started, 'resume', false), B)
    expect(resumed.post).toMatch(WHOLE)
    expect(step(afterStartRecord(resumed.team, 'compact', true), B).post).toMatch(FACTS)
    expect(step(afterStartRecord(resumed.team, 'compact', true), A).post).toBeNull()
  })

  test("N1: the record a tab's own --resume writes names its session → nothing", () => {
    expect(step(afterStartRecord(teamAtStart(A, false), 'resume', true), A).post).toBeNull()
  })

  test('the mode switched on for a session started without a block → the whole block, again after a compaction', () => {
    const on = step(teamAtStart(null, false), A)
    expect(on.post).toMatch(WHOLE)
    expect(step(on.team, A).post).toBeNull()
    expect(step(afterStartRecord(on.team, 'compact', true), A).post).toMatch(WHOLE)
  })

  test('the mode off, or the session leaving the project → the leaving line', () => {
    expect(step(teamAtStart(A, false), null).post).toBe(LEAVE)
  })

  test('its parent renamed → the facts', () => {
    const parent = (name: string): TeamText => {
      const facts = `# Your team in Menkar\nYou are \`w\`. Your parent is \`${name}\`.`
      return { facts, block: facts }
    }
    expect(step(teamAtStart(parent('set'), false), parent('lead')).post).toMatch(
      /^Team update: your facts are now:\nYou are `w`\. Your parent is `lead`\.\n/,
    )
  })
})

describe('posting', () => {
  test('the constants', () => {
    expect([TEAM_SETTLE_MS, TEAM_POST_TRIES, TEAM_POST_GAP_MS]).toEqual([2000, 5, 2000])
  })

  test('three triggers within 2,000 ms give one recompute, 2,000 ms after the last', () => {
    vi.useFakeTimers()
    try {
      const runs: string[] = []
      const settle = new TeamSettle((pane) => runs.push(pane), {
        set: (fn, ms) => setTimeout(fn, ms),
        clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
      })
      settle.trigger('p1')
      vi.advanceTimersByTime(1500)
      settle.trigger('p1')
      vi.advanceTimersByTime(1500)
      settle.trigger('p1')
      settle.trigger('p2')
      vi.advanceTimersByTime(TEAM_SETTLE_MS - 1)
      expect(runs).toEqual([])
      vi.advanceTimersByTime(1)
      expect(runs).toEqual(['p1', 'p2'])
      settle.trigger('p1')
      settle.forget('p1')
      vi.advanceTimersByTime(TEAM_SETTLE_MS)
      expect(runs).toEqual(['p1', 'p2'])
    } finally {
      vi.useRealTimers()
    }
  })

  test("'no session' is tried 5 times 2,000 ms apart; any other outcome ends it", async () => {
    const waits: number[] = []
    const wait = async (ms: number) => {
      waits.push(ms)
    }
    let calls = 0
    expect(
      await postWithTries(async () => {
        calls++
        return 'no session'
      }, wait),
    ).toBe('no session')
    expect([calls, waits]).toEqual([5, [2000, 2000, 2000, 2000]])
    calls = 0
    expect(await postWithTries(async () => (++calls === 2 ? 'posted' : 'no session'), wait)).toBe(
      'posted',
    )
    expect(calls).toBe(2)
  })
})

describe('the team files', () => {
  // A day by the clock passed in, at 23:59 and across midnight.
  test.each([
    ['at 23:59', new Date(2026, 10, 16, 23, 59, 0).getTime()],
    ['across midnight', new Date(2026, 10, 17, 0, 0, 30).getTime()],
  ])('a file older than a day is deleted, a younger one stays (%s)', async (_, now) => {
    const { team } = controlPaths()
    const tag = String(now)
    await writeTextAtomic(team, `old-${tag}.md`, 'a')
    await writeTextAtomic(team, `young-${tag}.md`, 'b')
    const old = join(team, `old-${tag}.md`)
    const young = join(team, `young-${tag}.md`)
    const at = (ms: number) => ms / 1000
    utimesSync(old, at(now - PROMPT_KEEP_MS - 1000), at(now - PROMPT_KEEP_MS - 1000))
    utimesSync(young, at(now - 60_000), at(now - 60_000))
    await sweepTeamFiles(now)
    expect([existsSync(old), existsSync(young)]).toEqual([false, true])
  })
})
