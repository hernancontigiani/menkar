import { describe, expect, it } from 'vitest'
import {
  ASK_AFTER_MS,
  AWAY_POST,
  awayTool,
  BACK_POST,
  backTool,
  chipShown,
  HERE,
  noticed,
  notYet,
  postRecipients,
  presenceAsked,
  presencePost,
  presenceView,
  quietDue,
  quieted,
  setAway,
  toggled,
  topicNoticeNow,
} from '../../src/core/presence'

const AT = Date.UTC(2026, 10, 16, 12, 10)
const away = { away: true, since: AT }

describe("the human's presence", () => {
  it('starts here, which is also what a start after a quit is', () => {
    expect(HERE).toEqual({ away: false, since: null })
  })

  it('toggles between away, with its time, and here', () => {
    const gone = toggled(HERE, AT)
    expect(gone).toEqual(away)
    expect(toggled(gone, AT + 60_000)).toEqual(HERE)
  })

  it('going away again keeps the first time', () => {
    expect(setAway(away, true, AT + 60_000)).toBe(away)
  })

  it('is shown only while some project has the orchestration mode on', () => {
    expect(presenceView(HERE, []).shown).toBe(false)
    expect(presenceView(HERE, [false, false]).shown).toBe(false)
    expect(presenceView(HERE, [false, true]).shown).toBe(true)
  })

  it("the sidebar's chip shows with a project in the mode, and while away even with none", () => {
    expect(chipShown(presenceView(HERE, [false]))).toBe(false)
    expect(chipShown(presenceView(HERE, [true]))).toBe(true)
    expect(chipShown(presenceView(away, [false]))).toBe(true)
  })

  it('cannot be turned away without a project in the mode, and always comes back', () => {
    expect(presenceAsked(HERE, true, AT, [false])).toBe(HERE)
    expect(presenceAsked(HERE, true, AT, [true])).toEqual(away)
    expect(presenceAsked(away, false, AT, [])).toEqual(HERE)
  })

  it('posts on a change only', () => {
    expect(presencePost(HERE, away)).toBe(AWAY_POST)
    expect(presencePost(away, HERE)).toBe(BACK_POST)
    expect(presencePost(away, away)).toBeNull()
    expect(presencePost(HERE, HERE)).toBeNull()
    expect(BACK_POST).toBe('The human is back')
  })

  it('posts to the running orchestrators only, not to the one that cleared it', () => {
    const orchestrators = [
      { sessionId: 'a', running: true },
      { sessionId: 'b', running: false },
      { sessionId: 'c', running: true },
    ]
    expect(postRecipients(orchestrators)).toEqual(['a', 'c'])
    expect(postRecipients(orchestrators, 'a')).toEqual(['c'])
  })
})

describe('a topic notice', () => {
  it('raises nothing while the human is away, and as before while here', () => {
    const notice = { sound: true }
    expect(topicNoticeNow(away, notice)).toBeNull()
    expect(topicNoticeNow(HERE, notice)).toBe(notice)
    expect(topicNoticeNow(HERE, null)).toBeNull()
  })
})

describe('human_back', () => {
  it('is refused with the mode off', () => {
    expect(backTool(null, 'x', away)).toMatchObject({ ok: false, clear: false })
  })

  it('is refused to a session that is not the orchestrator', () => {
    expect(backTool('orch', 'worker', away)).toMatchObject({ ok: false, clear: false })
  })

  it("clears the orchestrator's away state, and says so when already here", () => {
    expect(backTool('orch', 'orch', away)).toMatchObject({ ok: true, clear: true })
    expect(backTool('orch', 'orch', HERE)).toMatchObject({ ok: true, clear: false })
  })
})

describe('human_away', () => {
  it('is refused with the mode off', () => {
    expect(awayTool(null, 'x', HERE)).toMatchObject({ ok: false, set: false })
  })

  it('is refused to a session that is not the orchestrator', () => {
    expect(awayTool('orch', 'worker', HERE)).toMatchObject({ ok: false, set: false })
  })

  it('marks the human away for the orchestrator, and says so when already away', () => {
    expect(awayTool('orch', 'orch', HERE)).toMatchObject({ ok: true, set: true })
    expect(awayTool('orch', 'orch', away)).toMatchObject({ ok: true, set: false })
  })
})

// Decision 1.188: using Menkar while away asks whether the human is back; nothing clears away by
// itself. The human's answer to D1 (2026-11-19): "Not yet", and the question goes back by itself
// after 10 quiet minutes; either way it comes back on the next activity after 10 quiet minutes.
describe('the question while away', () => {
  const GAP = 600_000
  const asking = noticed(away, AT + ASK_AFTER_MS)

  it('asks a minute after away was set, not before, and keeps away and its time', () => {
    expect(ASK_AFTER_MS).toBe(60_000)
    expect(noticed(away, AT + 59_999).asking).toBe(false)
    expect(asking).toMatchObject({ away: true, since: AT, asking: true })
  })

  it('asks nothing while here; already asking it stays asking', () => {
    expect(noticed(HERE, AT)).toBe(HERE)
    expect(noticed(asking, AT + 120_000)).toMatchObject({ asking: true, away: true, since: AT })
  })

  it('a clock set back asks at once', () => {
    expect(noticed(away, AT - 500).asking).toBe(true)
  })

  it('going away twice keeps the question and its time; back is here, not asking', () => {
    expect(setAway(asking, true, AT + 300_000)).toBe(asking)
    expect(setAway(asking, false, AT + 300_000)).toBe(HERE)
    expect(setAway(HERE, true, AT + 400_000)).toEqual({ away: true, since: AT + 400_000 })
  })

  it('Not yet hides it and keeps away; activity within 10 minutes does not bring it back', () => {
    const declined = notYet(asking, AT + 120_000)
    expect(declined).toMatchObject({ away: true, since: AT, asking: false })
    expect(noticed(declined, AT + 120_000 + GAP - 1).asking).toBe(false)
  })

  it('after Not yet, activity after 10 quiet minutes asks again', () => {
    const declined = notYet(asking, AT + 120_000)
    expect(noticed(declined, AT + 120_000 + GAP).asking).toBe(true)
  })

  it('after Not yet, steady activity keeps the quiet from ever reaching 10 minutes', () => {
    let p = notYet(asking, AT + 120_000)
    for (let m = 1; m <= 30; m++) p = noticed(p, AT + 120_000 + m * 60_000)
    expect(p.asking).toBe(false)
  })

  it('10 quiet minutes while asking end the question with no click, and away stays', () => {
    expect(quietDue(asking)).toBe(AT + ASK_AFTER_MS + GAP)
    expect(quieted(asking, AT + ASK_AFTER_MS + GAP - 1)).toBe(asking)
    const rested = quieted(asking, AT + ASK_AFTER_MS + GAP)
    expect(rested).toMatchObject({ away: true, since: AT, asking: false })
    expect(quietDue(rested)).toBeNull()
    // The quiet that ended it is the 10 quiet minutes: the human's return asks again.
    expect(noticed(rested, AT + ASK_AFTER_MS + GAP + 1).asking).toBe(true)
  })

  it('Not yet while not asking changes nothing', () => {
    expect(notYet(away, AT)).toBe(away)
    expect(notYet(HERE, AT)).toBe(HERE)
  })

  it('the view carries the question, not what only decides it', () => {
    expect(presenceView(asking, [true])).toEqual({
      away: true,
      since: AT,
      asking: true,
      shown: true,
    })
  })
})
