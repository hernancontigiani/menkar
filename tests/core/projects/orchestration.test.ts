// The orchestration mode's marks live on the project in projects.json: switching the mode off
// keeps them, one orchestrator per project, and every move or removal of a session carries them.
import { describe, expect, test } from 'vitest'
import { forgetSession } from '../../../src/core/projects/earlier'
import { removeMember } from '../../../src/core/projects/model'
import {
  setConsultantsCollapsed,
  setDoneTodayOpen,
  setMode,
  setOrchestrator,
  setParked,
  setRole,
  setTeamView,
  setTopicsCollapsed,
  setWithYou,
  setWorkersCap,
} from '../../../src/core/projects/orchestration'
import { followNewId, followResume } from '../../../src/core/projects/rekey'
import { parseProjects, serializeProjects } from '../../../src/core/projects/store'
import { project, projects } from '../../factories/projects'

const work = () => projects([project('p1', 'Work', ['O', 'A', 'B', 'X'])])
const roundTrip = (state: ReturnType<typeof work>) =>
  parseProjects(JSON.parse(JSON.stringify(serializeProjects(state))))

const marked = () => {
  let s = setMode(work(), 'p1', true)
  s = setOrchestrator(s, 'p1', 'O')
  s = setRole(s, 'p1', 'X', 'Fabric expert')
  s = setWithYou(s, 'p1', 'X', true)
  return s
}

describe('orchestration marks', () => {
  test('switching the mode off keeps every mark, and they survive the file', () => {
    const off = roundTrip(setMode(marked(), 'p1', false))
    expect(off.projects[0]?.orchestration).toEqual({
      on: false,
      orchestrator: 'O',
      roles: { X: 'Fabric expert' },
      withYou: ['X'],
    })
    const written = serializeProjects(off).projects as Record<string, unknown>[]
    expect(written[0]?.orchestration).toEqual({
      on: false,
      orchestrator: 'O',
      roles: { X: 'Fabric expert' },
      with_you: ['X'],
    })
  })

  test('a project with nothing set writes no orchestration key', () => {
    const written = serializeProjects(work()).projects as Record<string, unknown>[]
    expect(written[0]).not.toHaveProperty('orchestration')
    expect(written[0]).not.toHaveProperty('topics_collapsed')
  })

  test('one orchestrator per project: marking B unmarks A', () => {
    const s = setOrchestrator(setOrchestrator(work(), 'p1', 'A'), 'p1', 'B')
    expect(s.projects[0]?.orchestration?.orchestrator).toBe('B')
    expect(setOrchestrator(s, 'p1', null).projects[0]?.orchestration?.orchestrator).toBeUndefined()
  })

  test('an empty role removes the label; unsetting with you removes the id', () => {
    let s = setRole(marked(), 'p1', 'X', '  ')
    s = setWithYou(s, 'p1', 'X', false)
    expect(s.projects[0]?.orchestration).toEqual({ on: true, orchestrator: 'O' })
  })

  test('the marks follow a /clear: X → Y, Y has the role and with you, X none', () => {
    const s = followNewId(marked(), 'X', 'Y')
    expect(s.projects[0]?.orchestration).toEqual({
      on: true,
      orchestrator: 'O',
      roles: { Y: 'Fabric expert' },
      withYou: ['Y'],
    })
    expect(followNewId(marked(), 'O', 'O2').projects[0]?.orchestration?.orchestrator).toBe('O2')
  })

  test('the marks follow an in-tab /resume, and the resumed session drops its marks elsewhere', () => {
    let s = projects([project('p1', 'Work', ['O', 'X']), project('p2', 'Other', ['R'])])
    s = setOrchestrator(s, 'p1', 'O')
    s = setRole(s, 'p1', 'X', 'Docs')
    s = setWithYou(s, 'p2', 'R', true)
    const after = followResume(s, 'X', 'R', 'p1')
    expect(after.projects[0]?.orchestration).toEqual({
      on: false,
      orchestrator: 'O',
      roles: { R: 'Docs' },
    })
    expect(after.projects[1]?.orchestration).toBeUndefined()
  })

  test('leaving the project drops the marks: no key names X', () => {
    for (const s of [removeMember(marked(), 'X'), forgetSession(marked(), 'X')]) {
      expect(JSON.stringify(s.projects[0]?.orchestration)).not.toContain('"X"')
      expect(s.projects[0]?.orchestration?.orchestrator).toBe('O')
    }
    expect(removeMember(marked(), 'O').projects[0]?.orchestration?.orchestrator).toBeUndefined()
  })

  // Decisions 1.112 and 1.115: Work by default, Consultants open and Done today folded by default;
  // each choice saved per project.
  test('the Work view: Team, Consultants folded and Done today unfolded round-trip; undone, no key is written', () => {
    let s = setTeamView(work(), 'p1', true)
    s = setConsultantsCollapsed(s, 'p1', true)
    s = setDoneTodayOpen(s, 'p1', true)
    expect(roundTrip(s).projects[0]).toMatchObject({
      teamView: true,
      consultantsCollapsed: true,
      doneTodayOpen: true,
    })
    const written = serializeProjects(s).projects as Record<string, unknown>[]
    expect(written[0]).toMatchObject({
      team_view: true,
      consultants_collapsed: true,
      done_today_open: true,
    })
    s = setDoneTodayOpen(
      setConsultantsCollapsed(setTeamView(s, 'p1', false), 'p1', false),
      'p1',
      false,
    )
    const undone = serializeProjects(s).projects as Record<string, unknown>[]
    for (const key of ['team_view', 'consultants_collapsed', 'done_today_open'])
      expect(undone[0]).not.toHaveProperty(key)
  })

  test('topics collapsed round-trips and is removed when expanded', () => {
    const s = setTopicsCollapsed(work(), 'p1', true)
    expect(roundTrip(s).projects[0]?.topicsCollapsed).toBe(true)
    expect(setTopicsCollapsed(s, 'p1', false).projects[0]).not.toHaveProperty('topicsCollapsed')
  })
})

// Decision 1.118: a per-project cap on workers running at once, absent = unlimited.
describe('the workers cap', () => {
  test('a cap round-trips as workers_cap; cleared, no key; a wrong one in the file is dropped alone', () => {
    const s = setWorkersCap(marked(), 'p1', 2)
    expect(roundTrip(s).projects[0]?.orchestration?.workersCap).toBe(2)
    const written = serializeProjects(s).projects as Record<string, unknown>[]
    expect(written[0]?.orchestration).toMatchObject({ workers_cap: 2 })
    const cleared = setWorkersCap(s, 'p1', null)
    expect(cleared.projects[0]?.orchestration).not.toHaveProperty('workersCap')
    expect(setWorkersCap(work(), 'p1', 3).projects[0]?.orchestration).toEqual({
      on: false,
      workersCap: 3,
    })
    for (const wrong of [0, -1, 2.5, '2', null]) {
      const raw = JSON.parse(JSON.stringify(serializeProjects(s)))
      raw.projects[0].orchestration.workers_cap = wrong
      expect(parseProjects(raw).projects[0]?.orchestration).toEqual({
        on: true,
        orchestrator: 'O',
        roles: { X: 'Fabric expert' },
        withYou: ['X'],
      })
    }
  })
})

// Decision 1.118: a parked worker keeps its mark while it waits, under whatever id its tab takes,
// and loses it when resumed.
describe('the parked mark', () => {
  test('X parked; X → Y: Y parked; resumed Y → none; it survives the file as parked', () => {
    let s = setParked(marked(), 'p1', 'X', true)
    expect(roundTrip(s).projects[0]?.orchestration?.parked).toEqual(['X'])
    expect(
      (serializeProjects(s).projects as Record<string, unknown>[])[0]?.orchestration,
    ).toMatchObject({ parked: ['X'] })
    s = followNewId(s, 'X', 'Y')
    expect(s.projects[0]?.orchestration?.parked).toEqual(['Y'])
    s = setParked(s, 'p1', 'Y', false)
    expect(s.projects[0]?.orchestration).not.toHaveProperty('parked')
  })

  test('a parked session that leaves the project leaves the mark', () => {
    const s = removeMember(setParked(marked(), 'p1', 'A', true), 'A')
    expect(s.projects[0]?.orchestration).not.toHaveProperty('parked')
  })
})
