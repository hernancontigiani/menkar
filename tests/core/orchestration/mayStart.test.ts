// Only the orchestrator orchestrates (decision 1.84): with the mode on and an orchestrator marked,
// no other session of the project may start sessions. Off, or with none marked, anyone may.
import { describe, expect, test } from 'vitest'
import { mayStart } from '../../../src/core/orchestration/mayStart'
import { setMode, setOrchestrator } from '../../../src/core/projects/orchestration'
import { project, projects } from '../../factories/projects'

const names: Record<string, string> = { O: 'orchestrator', W: 'api' }
const nameOf = (id: string) => names[id] ?? id

const team = (on: boolean, orchestrator: string | null) => {
  const s = setOrchestrator(
    setMode(projects([project('p1', 'Work', ['O', 'W'])]), 'p1', on),
    'p1',
    orchestrator,
  )
  const p = s.projects[0]
  if (!p) throw new Error('no project')
  return p
}

describe('who may start sessions', () => {
  test('on, with O marked: O may, W is refused with a sentence naming O', () => {
    expect(mayStart(team(true, 'O'), 'O', nameOf)).toBeNull()
    expect(mayStart(team(true, 'O'), 'W', nameOf)).toBe(
      "Only this project's orchestrator, orchestrator, starts sessions. Ask it to delegate the work.",
    )
  })

  test('off, with O marked: W may', () => {
    expect(mayStart(team(false, 'O'), 'W', nameOf)).toBeNull()
  })

  test('on, with none marked: W may', () => {
    expect(mayStart(team(true, null), 'W', nameOf)).toBeNull()
  })
})
