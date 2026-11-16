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

  // Decision 1.171: the Team view's orchestrator group and Others fold, saved per project.
  test('the orchestrator and Others folded round-trip; unfolded, no key is written', () => {
    let s = setOthersCollapsed(setOrchestratorCollapsed(work(), 'p1', true), 'p1', true)
    expect(roundTrip(s).projects[0]).toMatchObject({
      orchestratorCollapsed: true,
      othersCollapsed: true,
    })
    expect((serializeProjects(s).projects as Record<string, unknown>[])[0]).toMatchObject({
      orchestrator_collapsed: true,
      others_collapsed: true,
    })
    s = setOthersCollapsed(setOrchestratorCollapsed(s, 'p1', false), 'p1', false)
    const undone = serializeProjects(s).projects as Record<string, unknown>[]
    for (const key of ['orchestrator_collapsed', 'others_collapsed'])
      expect(undone[0]).not.toHaveProperty(key)
  })

  // Decision 1.126: whether the Board is open and its last height, per project.
  test('the Board open and its height round-trip; Default size and closing write no key', () => {
    const s = setBoard(work(), 'p1', { open: true, height: 240 })
    expect(roundTrip(s).projects[0]).toMatchObject({ boardOpen: true, boardHeight: 240 })
    expect((serializeProjects(s).projects as Record<string, unknown>[])[0]).toMatchObject({
      board_open: true,
      board_height: 240,
    })
    const reset = setBoard(setBoard(s, 'p1', { height: null }), 'p1', { open: false })
    const written = (serializeProjects(reset).projects as Record<string, unknown>[])[0]
    expect(written).not.toHaveProperty('board_open')
    expect(written).not.toHaveProperty('board_height')
    expect(setBoard(s, 'p1', { open: false }).projects[0]?.boardHeight).toBe(240)
  })

  test('a board height the version cannot read is dropped alone', () => {
    const file = serializeProjects(setBoard(work(), 'p1', { open: true })) as {
      projects: Record<string, unknown>[]
    }
    for (const bad of ['tall', -5, 0, Number.NaN, null]) {
      const first = { ...file.projects[0], board_height: bad }
      const read = parseProjects(JSON.parse(JSON.stringify({ ...file, projects: [first] })))
      expect(read.projects[0]?.boardOpen).toBe(true)
      expect(read.projects[0]).not.toHaveProperty('boardHeight')
    }
  })

  test('switching the mode off closes the Board, keeping its height', () => {
    const s = setBoard(setMode(work(), 'p1', true), 'p1', { open: true, height: 300 })
    const off = setMode(s, 'p1', false)
    expect(off.projects[0]?.boardOpen).toBeUndefined()
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
