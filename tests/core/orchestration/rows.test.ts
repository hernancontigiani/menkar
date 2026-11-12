// The sidebar in the orchestration mode (decision 1.89, mock C1): the orchestrator and its children
// first, then "Experts and consultants", then "Others" with groups as today. A child sits under its
// parent wherever the parent is; children without a tab fold into one "N earlier" row.
import { describe, expect, test } from 'vitest'
import { modeRows } from '../../../src/core/orchestration/rows'
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
    priority: [],
    withYou: [],
  },
  topicsCollapsed: false,
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
    if (r.kind === 'session') return r.depth === 1 ? `  ${r.id}` : r.id
    if (r.kind === 'earlier') return `earlier(${r.ids.length})${r.open ? ' open' : ''}`
    if (r.kind === 'heading') return `heading ${r.heading}`
    if (r.kind === 'group') return `group ${r.name}${r.collapsed ? ' collapsed' : ''}`
    return 'no group'
  })

describe('the sidebar in the orchestration mode', () => {
  test('O with W1 (tab), W2 and W3 (no tab), E with a role, S plain, group G', () => {
    expect(short(modeRows(info(), view()))).toEqual([
      'O',
      '  W1',
      'earlier(2)',
      'heading experts',
      'E',
      'heading others',
      'group G',
      'G1',
      'G2',
      'no group',
      'S',
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
      'heading experts',
      'E',
      '  W3',
      'heading others',
      'group G',
      'G1',
      'no group',
      'S',
      '  G2',
    ])
  })

  test('a nested child with a role stays nested; the orchestrator never shows as an expert', () => {
    const p = info({
      orchestration: {
        on: true,
        orchestrator: 'O',
        roles: { O: 'Lead', W1: 'Docs', E: 'Fabric expert' },
        priority: [],
        withYou: [],
      },
    })
    expect(short(modeRows(p, view())).slice(0, 5)).toEqual([
      'O',
      '  W1',
      'earlier(2)',
      'heading experts',
      'E',
    ])
  })

  test('a collapsed group shows its heading alone; without an orchestrator or experts, Others alone', () => {
    const p = info({
      groups: [{ name: 'G', color: '#5ec4b6', members: ['G1', 'G2'], collapsed: true }],
      parents: {},
      orchestration: { on: true, orchestrator: null, roles: {}, priority: [], withYou: [] },
    })
    expect(short(modeRows(p, view()))).toEqual([
      'heading others',
      'group G collapsed',
      'no group',
      'O',
      'W1',
      'W2',
      'W3',
      'E',
      'S',
    ])
  })

  test('a row not listed (hidden, earlier conversation) stays out; its children are top rows', () => {
    const rows = modeRows(info(), view({ listed: ['W1', 'W2', 'E', 'S'] }))
    expect(short(rows)).toEqual(['heading experts', 'E', 'heading others', 'W1', 'W2', 'S'])
  })
})
