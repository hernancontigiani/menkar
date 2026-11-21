// The sidebar in the orchestration mode (decision 1.89, mock C1): the orchestrator and its children
// first, then "Consultants" (decision 1.107), then "Others", one flat list with no group headings (decision 1.183). A child sits under its
// parent wherever the parent is; children without a tab fold into one "N earlier" row.
import { describe, expect, test } from 'vitest'
import {
  awaitingRows,
  modeRows,
  prNamed,
  rowWeight,
  tasksFolded,
} from '../../../src/core/orchestration/rows'
import type { ProjectInfo } from '../../../src/core/projects/info'

const info = (over: Partial<ProjectInfo> = {}): ProjectInfo => ({
  id: 'p1',
  name: 'Work',
  members: ['O', 'W1', 'W2', 'W3', 'E', 'S', 'G1', 'G2'],
  hidden: [],
  groups: [{ name: 'G', color: '#5ec4b6', members: ['G1', 'G2'] }],
  earlier: {},
  parents: { W1: 'O', W2: 'O', W3: 'O' },
  orchestration: {
    on: true,
    orchestrator: 'O',
    roles: { E: 'Fabric expert' },
    withYou: [],
    parked: [],
    workersCap: null,
    folders: [],
  },
  topicsCollapsed: false,
  consultantsCollapsed: false,
  orchestratorCollapsed: false,
  othersCollapsed: false,
  doneTodayOpen: false,
  board: { open: false, height: null },
  ...over,
})

const view = (over: Partial<Parameters<typeof modeRows>[1]> = {}) => ({
  listed: ['O', 'W1', 'W2', 'W3', 'E', 'S', 'G1', 'G2'],
  open: new Set(['O', 'W1']),
  unfolded: new Set<string>(),
  ...over,
})

const short = (rows: ReturnType<typeof modeRows>) =>
  rows.map((r) => {
    if (r.kind === 'session') {
      const fold = r.fold?.folded ? ` folded(${r.fold.ids.length})` : ''
      return r.depth === 1 ? `  ${r.id}` : `${r.id}${fold}`
    }
    if (r.kind === 'earlier') return `earlier(${r.ids.length})${r.open ? ' open' : ''}`
    if (r.kind === 'parked') return `parked(${r.ids.length})${r.open ? ' open' : ''}`
    if (r.kind === 'heading') return `heading ${r.heading}${r.collapsed ? ' collapsed' : ''}`
    if (r.kind === 'group') return `group ${r.name}${r.collapsed ? ' collapsed' : ''}`
    return 'no group'
  })

describe('the sidebar in the orchestration mode', () => {
  test('O with W1 (tab), W2 and W3 (no tab), E with a role, S plain, group G', () => {
    expect(short(modeRows(info(), view()))).toEqual([
      'O',
      '  W1',
      'earlier(2)',
      'heading consultants',
      'E',
      'heading others',
      'S',
      'G1',
      'G2',
    ])
  })

  test('Others has no group headings; each row keeps its group as its drag section (1.183)', () => {
    const rows = modeRows(info(), view())
    const others = rows.slice(rows.findIndex((r) => r.kind === 'heading' && r.heading === 'others'))
    expect(others.some((r) => r.kind === 'group' || r.kind === 'noGroup')).toBe(false)
    expect(others.flatMap((r) => (r.kind === 'session' ? [[r.id, r.section]] : []))).toEqual([
      ['S', ''],
      ['G1', 'G'],
      ['G2', 'G'],
    ])
  })

  test('the earlier row unfolds its children, one level of indent', () => {
    const rows = modeRows(info(), view({ unfolded: new Set(['O']) }))
    expect(short(rows).slice(0, 5)).toEqual(['O', '  W1', 'earlier(2) open', '  W2', '  W3'])
  })

  test('a child of a child nests under the same top row; a child sits under an expert or a plain parent too', () => {
    const p = info({ parents: { W1: 'O', W2: 'W1', W3: 'E', G2: 'S' } })
    expect(short(modeRows(p, view({ open: new Set(['O', 'W1', 'W2', 'W3', 'G2']) })))).toEqual([
      'O',
      '  W1',
      '  W2',
      'heading consultants',
      'E',
      '  W3',
      'heading others',
      'S',
      '  G2',
      'G1',
    ])
  })

  test('a nested child with a role stays nested; the orchestrator never shows as an expert', () => {
    const p = info({
      orchestration: {
        on: true,
        orchestrator: 'O',
        roles: { O: 'Lead', W1: 'Docs', E: 'Fabric expert' },
        withYou: [],
        parked: [],
        workersCap: null,
        folders: [],
      },
    })
    expect(short(modeRows(p, view())).slice(0, 5)).toEqual([
      'O',
      '  W1',
      'earlier(2)',
      'heading consultants',
      'E',
    ])
  })

  test("a collapsed group's members still show in Others; without an orchestrator or consultants, Others alone", () => {
    const p = info({
      groups: [{ name: 'G', color: '#5ec4b6', members: ['G1', 'G2'], collapsed: true }],
      parents: {},
      orchestration: {
        on: true,
        orchestrator: null,
        roles: {},
        withYou: [],
        parked: [],
        workersCap: null,
        folders: [],
      },
    })
    expect(short(modeRows(p, view()))).toEqual([
      'heading others',
      'O',
      'W1',
      'W2',
      'W3',
      'E',
      'S',
      'G1',
      'G2',
    ])
  })

  test('a row not listed (hidden, earlier conversation) stays out; its children are top rows', () => {
    const rows = modeRows(info(), view({ listed: ['W1', 'W2', 'E', 'S'] }))
    expect(short(rows)).toEqual(['heading consultants', 'E', 'heading others', 'W1', 'W2', 'S'])
  })
})

// Decision 1.120: parked workers show apart, in a folded "Parked · N" row under the orchestrator.
describe('parked workers', () => {
  const parked = () =>
    info({
      orchestration: {
        on: true,
        orchestrator: 'O',
        roles: { E: 'Fabric expert' },
        withYou: [],
        parked: ['W2'],
        workersCap: null,
        folders: [],
      },
    })

  test('W2 parked, W3 stopped: "earlier(1)" then "parked(1)" under O; unfolded, W2 nested', () => {
    expect(short(modeRows(parked(), view())).slice(0, 4)).toEqual([
      'O',
      '  W1',
      'earlier(1)',
      'parked(1)',
    ])
    expect(short(modeRows(parked(), view({ parkedOpen: true }))).slice(0, 5)).toEqual([
      'O',
      '  W1',
      'earlier(1)',
      'parked(1) open',
      '  W2',
    ])
  })

  test('a parked worker that runs again is a plain child', () => {
    expect(
      short(modeRows(parked(), view({ open: new Set(['O', 'W1', 'W2']) }))).slice(0, 4),
    ).toEqual(['O', '  W1', '  W2', 'earlier(1)'])
  })
})

// Decision 1.171: in the Team view the orchestrator's group, Consultants and Others fold, each saved
// per project.
describe('folding the Team view', () => {
  test('the orchestrator folded: its row alone, standing for all 3 under it (tab, earlier, parked)', () => {
    const p = info({
      orchestratorCollapsed: true,
      orchestration: { ...info().orchestration, parked: ['W3'] },
    })
    const rows = modeRows(p, view({ unfolded: new Set(['O']), parkedOpen: true }))
    expect(short(rows).slice(0, 3)).toEqual(['O folded(3)', 'heading consultants', 'E'])
    const top = rows[0]
    expect(top?.kind === 'session' && top.fold?.ids).toEqual(['W1', 'W2', 'W3'])
    const unfolded = modeRows(info(), view())[0]
    expect(unfolded?.kind === 'session' && unfolded.fold).toEqual({
      ids: ['W1', 'W2', 'W3'],
      folded: false,
    })
  })

  test('an orchestrator with no one under it has nothing to fold', () => {
    const p = info({ parents: {}, orchestratorCollapsed: true })
    const rows = modeRows(p, view())
    expect(short(rows).slice(0, 2)).toEqual(['O', 'heading consultants'])
    expect(rows[0]).not.toHaveProperty('fold')
  })

  test('Consultants folded: its heading alone, with E and its children', () => {
    const p = info({ consultantsCollapsed: true, parents: { W1: 'O', W2: 'E' } })
    expect(short(modeRows(p, view({ open: new Set(['O', 'W1', 'W2']) })))).toEqual([
      'O',
      '  W1',
      'heading consultants collapsed',
      'heading others',
      'W3',
      'S',
      'G1',
      'G2',
    ])
  })

  test('Others folded: its heading alone, its rows hidden', () => {
    expect(short(modeRows(info({ othersCollapsed: true }), view()))).toEqual([
      'O',
      '  W1',
      'earlier(2)',
      'heading consultants',
      'E',
      'heading others collapsed',
    ])
  })
})

describe('the tasks in the single view', () => {
  // Decision 1.177: at most 3 tasks, the rest behind "See all (N) →".
  test.each([
    [8, 3, 5],
    [3, 3, 0],
    [0, 0, 0],
  ])('%i open → %i rows, %i more', (open, rows, more) => {
    const tasks = Array.from({ length: open }, (_, i) => i + 1)
    const folded = tasksFolded(tasks)
    expect(folded.rows).toEqual(tasks.slice(0, rows))
    expect(folded.more).toBe(more)
  })
})

describe("a row's weight", () => {
  // Decision 1.176: a worker's name says where its tab is — bold with a pin when pinned, regular in
  // the background, italic in the peek; regular with no tab at all (D5); rows of sessions that are
  // not workers are drawn as before (Q5).
  test.each([
    [true, 'ordinary', 'pinned'],
    [true, 'background', 'background'],
    [true, 'peek', 'peek'],
    [true, null, 'none'],
    [false, 'ordinary', null],
    [false, null, null],
  ] as const)('worker %s, tab %s → %s', (worker, place, weight) => {
    expect(rowWeight(worker, place)).toBe(weight)
  })
})

// Decision 1.197: "Awaiting you" shows each task whose PR waits on the human, after the topics.
describe('"Awaiting you"', () => {
  const review = (number: number, on: 'orchestrator' | 'human' | 'pr-approval' | 'pr-merge') => ({
    number,
    state: 'to review' as const,
    reviewWait: { on },
  })

  test('the topics first, then the tasks waiting on a PR approval or merge, in their order', () => {
    const tasks = [
      review(3, 'pr-merge'),
      review(4, 'human'),
      { number: 5, state: 'in progress' as const },
      review(6, 'pr-approval'),
      review(7, 'orchestrator'),
    ]
    expect(awaitingRows(['t1', 't2'], tasks)).toEqual([
      { kind: 'topic', topic: 't1' },
      { kind: 'topic', topic: 't2' },
      { kind: 'pr', task: tasks[0] },
      { kind: 'pr', task: tasks[3] },
    ])
    expect(awaitingRows([], [review(4, 'human')])).toEqual([])
  })

  test("the PR a wait's note names", () => {
    expect(prNamed('#436')).toBe('#436')
    expect(prNamed(' 436 ')).toBe('#436')
    expect(prNamed('PR #436')).toBe('#436')
    expect(prNamed('https://github.com/acme/app/pull/436')).toBe('#436')
    expect(prNamed('https://github.com/acme/app/pull/436/files')).toBe('#436')
    expect(prNamed('the release PR')).toBe('the release PR')
    expect(prNamed('')).toBe('')
  })
})
