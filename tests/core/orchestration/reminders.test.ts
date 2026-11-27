// Decision 1.217: the orchestrator is reminded of the sessions it sent work to with no open task,
// and nothing is refused.
import { expect, test } from 'vitest'
import { sentWithoutTask } from '../../../src/core/orchestration/reminders'

test('one line per session still running with no open task; the rest forgotten', () => {
  const result = sentWithoutTask(['a', 'b', 'c'], {
    hasOpenTask: (id) => id === 'b',
    running: (id) => id !== 'c',
    name: (id) => id.toUpperCase(),
  })
  expect(result).toEqual({
    keep: ['a'],
    lines: ['You sent work to A, which has no open task: give it one with task_add.'],
  })
})
