import { describe, expect, test } from 'vitest'
import { PromptTracker } from '../../../src/core/activity/prompts'

describe('prompts answered', () => {
  test('a prompt answered is a pane leaving blocked, with how long it was blocked', () => {
    const t = new PromptTracker()
    expect(t.change('p1', 's1', 'idle', 'blocked', 100)).toBeUndefined()
    expect(t.change('p1', 's1', 'blocked', 'working', 112.5)).toEqual({
      kind: 'prompt_answered',
      sessionId: 's1',
      next: 'working',
      blockedSeconds: 12.5,
    })
  })

  // Refusing is the human acting too.
  test('blocked to idle is an answer as well', () => {
    const t = new PromptTracker()
    t.change('p1', 's1', 'working', 'blocked', 100)
    expect(t.change('p1', 's1', 'blocked', 'idle', 130)).toEqual({
      kind: 'prompt_answered',
      sessionId: 's1',
      next: 'idle',
      blockedSeconds: 30,
    })
  })

  test('a change that neither leaves nor enters blocked is no answer', () => {
    const t = new PromptTracker()
    expect(t.change('p1', 's1', 'working', 'idle', 100)).toBeUndefined()
    t.change('p1', 's1', 'idle', 'blocked', 110)
    expect(t.change('p1', 's1', 'blocked', 'blocked', 120)).toBeUndefined()
    // blocked → blocked kept the first entry: the wait counts from 110.
    expect(t.change('p1', 's1', 'blocked', 'working', 125)).toMatchObject({ blockedSeconds: 15 })
    // Answered once: leaving blocked again without entering it is nothing.
    expect(t.change('p1', 's1', 'blocked', 'working', 130)).toBeUndefined()
  })

  test('an unjoined pane’s answer carries no session', () => {
    const t = new PromptTracker()
    t.change('p1', null, 'idle', 'blocked', 100)
    const e = t.change('p1', null, 'blocked', 'working', 101)
    expect(e).toEqual({ kind: 'prompt_answered', next: 'working', blockedSeconds: 1 })
  })

  test('panes are tracked apart', () => {
    const t = new PromptTracker()
    t.change('p1', 's1', 'idle', 'blocked', 100)
    t.change('p2', 's2', 'idle', 'blocked', 105)
    expect(t.change('p2', 's2', 'blocked', 'idle', 106)).toMatchObject({
      sessionId: 's2',
      blockedSeconds: 1,
    })
    expect(t.change('p1', 's1', 'blocked', 'idle', 110)).toMatchObject({
      sessionId: 's1',
      blockedSeconds: 10,
    })
  })

  test('a clock jumping back never gives a negative wait', () => {
    const t = new PromptTracker()
    t.change('p1', 's1', 'idle', 'blocked', 100)
    expect(t.change('p1', 's1', 'blocked', 'working', 90)).toMatchObject({ blockedSeconds: 0 })
  })

  test('a pane closed while blocked is not an answer', () => {
    const t = new PromptTracker()
    t.change('p1', 's1', 'idle', 'blocked', 100)
    t.closed('p1')
    expect(t.change('p1', 's1', 'blocked', 'idle', 120)).toBeUndefined()
  })
})
