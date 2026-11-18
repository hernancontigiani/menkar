import { describe, expect, it } from 'vitest'
import {
  AWAY_POST,
  awayTool,
  BACK_POST,
  backTool,
  chipShown,
  HERE,
  postRecipients,
  presenceAsked,
  presencePost,
  presenceView,
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
