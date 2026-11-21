// The orchestration mode's marks live on the project in projects.json: switching the mode off
// keeps them, one orchestrator per project, and every move or removal of a session carries them.
import { describe, expect, test } from 'vitest'
import { forgetSession } from '../../../src/core/projects/earlier'
import { removeMember } from '../../../src/core/projects/model'
import {
  addFolder,
  removeFolder,
  setBoard,
  setConsultantsCollapsed,
  setDoneTodayOpen,
  setMode,
  setOrchestrator,
  setOrchestratorCollapsed,
  setOthersCollapsed,
  setParked,
  setRole,
  setSkills,
  setTopicsCollapsed,
  setWithYou,
  setWorkersCap,
  tabGroupColor,
} from '../../../src/core/projects/orchestration'
import { followNewId, followResume } from '../../../src/core/projects/rekey'
import { parseProjects, serializeProjects } from '../../../src/core/projects/store'
import { group, project, projects } from '../../factories/projects'

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

  // Decision 1.115: Consultants open and Done today folded by default; each choice saved per project.
  test('Consultants folded and Done today unfolded round-trip; undone, no key is written', () => {
    let s = setConsultantsCollapsed(work(), 'p1', true)
    s = setDoneTodayOpen(s, 'p1', true)
    expect(roundTrip(s).projects[0]).toMatchObject({
      consultantsCollapsed: true,
      doneTodayOpen: true,
    })
    const written = serializeProjects(s).projects as Record<string, unknown>[]
    expect(written[0]).toMatchObject({ consultants_collapsed: true, done_today_open: true })
    s = setDoneTodayOpen(setConsultantsCollapsed(s, 'p1', false), 'p1', false)
    const undone = serializeProjects(s).projects as Record<string, unknown>[]
    for (const key of ['consultants_collapsed', 'done_today_open'])
      expect(undone[0]).not.toHaveProperty(key)
  })

  // Decision 1.177: one sidebar view, so the Work/Team choice an earlier version saved is dropped.
  test('team_view is not read and not written back', () => {
    const file = JSON.parse(JSON.stringify(serializeProjects(work())))
    file.projects[0].team_view = true
    const read = parseProjects(file)
    expect(read.projects[0]).not.toHaveProperty('teamView')
    expect((serializeProjects(read).projects as Record<string, unknown>[])[0]).not.toHaveProperty(
      'team_view',
    )
  })

  // Decision 1.177: the orchestrator folded by default, saved as orchestrator_open only while
  // unfolded; the orchestrator_collapsed an earlier version wrote is not read, and dropped.
  test.each([
    ['orchestrator_collapsed: true', { orchestrator_collapsed: true }],
    ['neither key', {}],
    ['orchestrator_collapsed: false', { orchestrator_collapsed: false }],
  ])('a file with %s reads folded and writes no fold key', (_, keys) => {
    const file = JSON.parse(JSON.stringify(serializeProjects(work())))
    Object.assign(file.projects[0], keys)
    const read = parseProjects(file)
    expect(read.projects[0]).not.toHaveProperty('orchestratorOpen')
    const written = (serializeProjects(read).projects as Record<string, unknown>[])[0]
    expect(written).not.toHaveProperty('orchestrator_open')
    expect(written).not.toHaveProperty('orchestrator_collapsed')
  })

  test('orchestrator_open: true reads unfolded and is written back', () => {
    const file = JSON.parse(JSON.stringify(serializeProjects(work())))
    file.projects[0].orchestrator_open = true
    const read = parseProjects(file)
    expect(read.projects[0]).toMatchObject({ orchestratorOpen: true })
    expect((serializeProjects(read).projects as Record<string, unknown>[])[0]).toMatchObject({
      orchestrator_open: true,
    })
  })

  // Decision 1.171: the orchestrator group and Others fold, saved per project.
  test('the orchestrator unfolded and Others folded round-trip; the defaults write no key', () => {
    let s = setOthersCollapsed(setOrchestratorCollapsed(work(), 'p1', false), 'p1', true)
    expect(roundTrip(s).projects[0]).toMatchObject({
      orchestratorOpen: true,
      othersCollapsed: true,
    })
    expect((serializeProjects(s).projects as Record<string, unknown>[])[0]).toMatchObject({
      orchestrator_open: true,
      others_collapsed: true,
    })
    s = setOthersCollapsed(setOrchestratorCollapsed(s, 'p1', true), 'p1', false)
    const undone = serializeProjects(s).projects as Record<string, unknown>[]
    for (const key of ['orchestrator_open', 'orchestrator_collapsed', 'others_collapsed'])
      expect(undone[0]).not.toHaveProperty(key)
  })

  // Decisions 1.126 and 1.198: the Board is open unless the human closed it in the project; that
  // closing and its last height are saved per project.
  test('the Board closed and its height round-trip; Default size and reopening write no key', () => {
    const s = setBoard(work(), 'p1', { open: false, height: 240 })
    expect(roundTrip(s).projects[0]).toMatchObject({ boardClosed: true, boardHeight: 240 })
    expect((serializeProjects(s).projects as Record<string, unknown>[])[0]).toMatchObject({
      board_open: false,
      board_height: 240,
    })
    const reset = setBoard(setBoard(s, 'p1', { height: null }), 'p1', { open: true })
    const written = (serializeProjects(reset).projects as Record<string, unknown>[])[0]
    expect(written).not.toHaveProperty('board_open')
    expect(written).not.toHaveProperty('board_height')
    expect(setBoard(s, 'p1', { open: true }).projects[0]?.boardHeight).toBe(240)
  })

  test('a project that never closed the Board reads it open, an earlier board_open: true too', () => {
    const file = serializeProjects(work()) as { projects: Record<string, unknown>[] }
    expect(file.projects[0]).not.toHaveProperty('board_open')
    expect(parseProjects(file).projects[0]).not.toHaveProperty('boardClosed')
    const earlier = { ...file, projects: [{ ...file.projects[0], board_open: true }] }
    const read = parseProjects(JSON.parse(JSON.stringify(earlier)))
    expect(read.projects[0]).not.toHaveProperty('boardClosed')
    expect((serializeProjects(read).projects as Record<string, unknown>[])[0]).not.toHaveProperty(
      'board_open',
    )
  })

  test('a board height the version cannot read is dropped alone', () => {
    const file = serializeProjects(setBoard(work(), 'p1', { open: false })) as {
      projects: Record<string, unknown>[]
    }
    for (const bad of ['tall', -5, 0, Number.NaN, null]) {
      const first = { ...file.projects[0], board_height: bad }
      const read = parseProjects(JSON.parse(JSON.stringify({ ...file, projects: [first] })))
      expect(read.projects[0]?.boardClosed).toBe(true)
      expect(read.projects[0]).not.toHaveProperty('boardHeight')
    }
  })

  test('switching the mode off forgets the Board closed, keeping its height', () => {
    const s = setBoard(setMode(work(), 'p1', true), 'p1', { open: false, height: 300 })
    expect(setMode(s, 'p1', true).projects[0]?.boardClosed).toBe(true)
    const off = setMode(s, 'p1', false)
    expect(off.projects[0]?.boardClosed).toBeUndefined()
    expect(off.projects[0]?.boardHeight).toBe(300)
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

// Decision 1.124: folders the human adds by hand to a project, in projects.json beside the marks.
describe('the added folders', () => {
  test('an added folder round-trips as folders, once; removed, it is no longer listed', () => {
    let s = addFolder(work(), 'p1', '/repo/other')
    s = addFolder(s, 'p1', '/repo/other')
    expect(roundTrip(s).projects[0]?.orchestration?.folders).toEqual(['/repo/other'])
    expect((serializeProjects(s).projects as Record<string, unknown>[])[0]?.orchestration).toEqual({
      on: false,
      folders: ['/repo/other'],
    })
    s = removeFolder(s, 'p1', '/repo/other')
    expect(s.projects[0]).not.toHaveProperty('orchestration')
  })

  test('in the file, a relative path or a non-text entry is dropped alone', () => {
    const raw = JSON.parse(JSON.stringify(serializeProjects(marked())))
    raw.projects[0].orchestration.folders = ['/ok', 'relative', 3, '/ok']
    expect(parseProjects(raw).projects[0]?.orchestration?.folders).toEqual(['/ok'])
    raw.projects[0].orchestration.folders = 'not a list'
    expect(parseProjects(raw).projects[0]?.orchestration).not.toHaveProperty('folders')
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

// Decisions 1.152 and 1.154: a session's skills are stored by Menkar, each read only or maintained
// by one session, set only by the human; Menkar's own skills are never stored.
describe('the stored skills', () => {
  const withSkills = (skills: unknown) => {
    const raw = JSON.parse(JSON.stringify(serializeProjects(marked())))
    raw.projects[0].orchestration.skills = skills
    return parseProjects(raw).projects[0]?.orchestration?.skills
  }

  test('valid entries are kept in order; a malformed entry is dropped alone', () => {
    expect(
      withSkills({
        X: [
          { name: 'packager', maintainer: true },
          {},
          { name: 3 },
          { name: '' },
          { name: 'claude-cli' },
        ],
      }),
    ).toEqual({ X: [{ name: 'packager', maintainer: true }, { name: 'claude-cli' }] })
  })

  test('a repeated name keeps the first; a menkar: name is dropped', () => {
    expect(
      withSkills({
        X: [{ name: 'deploy' }, { name: 'deploy', maintainer: true }, { name: 'menkar:worker' }],
      }),
    ).toEqual({ X: [{ name: 'deploy' }] })
  })

  test('two maintainers of one name: the second member in order reads it read only', () => {
    expect(
      withSkills({
        X: [{ name: 'deploy', maintainer: true }],
        A: [
          { name: 'deploy', maintainer: true },
          { name: 'docs', maintainer: true },
        ],
      }),
    ).toEqual({
      A: [
        { name: 'deploy', maintainer: true },
        { name: 'docs', maintainer: true },
      ],
      X: [{ name: 'deploy' }],
    })
  })

  test('maintainer is written only while true; no skills key when every list is empty', () => {
    let s = setSkills(marked(), 'p1', 'X', [
      { name: 'packager', maintainer: true },
      { name: 'cli' },
    ])
    if (!s.ok) throw new Error(s.refusal)
    const written = serializeProjects(s.projects).projects as Record<string, unknown>[]
    expect(written[0]?.orchestration).toMatchObject({
      skills: { X: [{ name: 'packager', maintainer: true }, { name: 'cli' }] },
    })
    expect(roundTrip(s.projects).projects[0]?.orchestration?.skills).toEqual({
      X: [{ name: 'packager', maintainer: true }, { name: 'cli' }],
    })
    s = setSkills(s.projects, 'p1', 'X', [])
    if (!s.ok) throw new Error(s.refusal)
    const emptied = serializeProjects(s.projects).projects as Record<string, unknown>[]
    expect(emptied[0]?.orchestration).not.toHaveProperty('skills')
  })

  test('a project with no skills writes the same bytes as before the key existed', () => {
    expect(JSON.stringify(serializeProjects(roundTrip(marked())))).toBe(
      '{"version":1,"current":"p1","projects":[{"id":"p1","name":"Work","members":["O","A","B","X"],"groups":[],"orchestration":{"on":true,"orchestrator":"O","roles":{"X":"Fabric expert"},"with_you":["X"]}}],"windows":[]}',
    )
  })

  test('kept to members, followed to a new id, kept with the mode off', () => {
    const s = setSkills(marked(), 'p1', 'X', [{ name: 'packager', maintainer: true }])
    if (!s.ok) throw new Error(s.refusal)
    const followed = followNewId(s.projects, 'X', 'Y')
    expect(followed.projects[0]?.orchestration?.skills).toEqual({
      Y: [{ name: 'packager', maintainer: true }],
    })
    expect(setMode(followed, 'p1', false).projects[0]?.orchestration?.skills).toEqual({
      Y: [{ name: 'packager', maintainer: true }],
    })
    expect(removeMember(followed, 'Y').projects[0]?.orchestration).not.toHaveProperty('skills')
    expect(withSkills({ GONE: [{ name: 'packager' }] })).toBeUndefined()
  })

  test('setSkills refuses a second maintainer, naming the skill and its maintainer', () => {
    const s = setSkills(marked(), 'p1', 'A', [{ name: 'deploy', maintainer: true }])
    if (!s.ok) throw new Error(s.refusal)
    const names: Record<string, string> = { A: 'packager', X: 'fabric' }
    const refused = setSkills(
      s.projects,
      'p1',
      'X',
      [{ name: 'deploy', maintainer: true }],
      (id) => names[id] ?? id,
    )
    expect(refused).toEqual({
      ok: false,
      refusal: 'refusal.maintainedBy',
      params: { name: 'deploy', session: 'packager' },
    })
    const readOnly = setSkills(s.projects, 'p1', 'X', [{ name: 'deploy' }])
    expect(readOnly.ok && readOnly.projects.projects[0]?.orchestration?.skills).toEqual({
      A: [{ name: 'deploy', maintainer: true }],
      X: [{ name: 'deploy' }],
    })
    // Its own maintained skill saved again is no conflict.
    expect(setSkills(s.projects, 'p1', 'A', [{ name: 'deploy', maintainer: true }]).ok).toBe(true)
  })

  test('setSkills refuses a menkar: skill and replaces the list whole', () => {
    expect(setSkills(marked(), 'p1', 'X', [{ name: 'menkar:worker' }])).toEqual({
      ok: false,
      refusal: 'refusal.menkarSkill',
      params: { name: 'menkar:worker' },
    })
    const first = setSkills(marked(), 'p1', 'X', [{ name: 'a' }, { name: 'b' }])
    if (!first.ok) throw new Error(first.refusal)
    const second = setSkills(first.projects, 'p1', 'X', [{ name: 'c' }])
    expect(second.ok && second.projects.projects[0]?.orchestration?.skills).toEqual({
      X: [{ name: 'c' }],
    })
  })
})

describe("a session tab's group line", () => {
  const grouped = () =>
    projects([
      project(
        'p1',
        'Work',
        ['A', 'B', 'C'],
        [group('g', ['A', 'B'], '#111111'), group('h', ['C'], '#222222')],
      ),
    ])

  test("the panes' shared group colour, with the mode off", () => {
    const p = grouped().projects[0]
    expect(tabGroupColor(p, ['A'])).toBe('#111111')
    expect(tabGroupColor(p, ['A', 'B'])).toBe('#111111')
    expect(tabGroupColor(p, ['A', 'C'])).toBeNull()
    expect(tabGroupColor(p, [])).toBeNull()
    expect(tabGroupColor(undefined, ['A'])).toBeNull()
  })

  test('none with the mode on, and back when it goes off (1.183)', () => {
    const on = setMode(grouped(), 'p1', true)
    expect(tabGroupColor(on.projects[0], ['A'])).toBeNull()
    expect(tabGroupColor(setMode(on, 'p1', false).projects[0], ['A'])).toBe('#111111')
  })
})
