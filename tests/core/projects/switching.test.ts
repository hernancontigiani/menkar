// The project switcher's list (decision 1.38): the active projects only — those with tabs open
// anywhere, and the one this window shows — the most recently used first.
import { expect, test } from 'vitest'
import type { Layout, Tab } from '../../../src/core/projects/layout'
import { activeProjects, touched } from '../../../src/core/projects/switching'
import { project, projects } from '../../factories/projects'

const tab = (id: string, projectId: string): Tab => ({ kind: 'transient', id, project: projectId })
const all = projects([
  project('a', 'Alpha'),
  project('b', 'Beta'),
  project('c', 'Gamma'),
  project('d', 'Delta'),
])
// w1 shows a (two tabs) and holds c's tab; w2 shows b (one tab); d has no tab anywhere.
const layout: Layout = {
  windows: [
    { id: 'w1', shown: 'a', tabs: [tab('t1', 'a'), tab('t2', 'a'), tab('t3', 'c')], selected: {} },
    { id: 'w2', shown: 'b', tabs: [tab('t4', 'b')], selected: {} },
  ],
}

test('only projects with open tabs, and the shown one, most recent first; each with its window and tab count', () => {
  const list = activeProjects(layout, all, ['a', 'c', 'b', 'd'], 'w1')
  expect(list.map((p) => p.id)).toEqual(['a', 'c', 'b'])
  expect(list.map((p) => [p.name, p.window, p.tabs, p.here])).toEqual([
    ['Alpha', 'w1', 2, true],
    ['Gamma', 'w1', 1, true],
    ['Beta', 'w2', 1, false],
  ])
})

test('the shown project is listed even with no tab; projects never used keep the layout order after the rest', () => {
  const empty: Layout = {
    windows: [{ id: 'w1', shown: 'd', tabs: [tab('t1', 'b'), tab('t2', 'a')], selected: {} }],
  }
  expect(activeProjects(empty, all, ['d'], 'w1').map((p) => p.id)).toEqual(['d', 'b', 'a'])
})

test('using a project moves it to the front, once', () => {
  expect(touched(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b'])
  expect(touched(['a', 'b'], 'a')).toEqual(['a', 'b'])
  expect(touched([], 'x')).toEqual(['x'])
})

test('the shown project comes first even when another was used later', () => {
  expect(activeProjects(layout, all, ['b', 'c', 'a'], 'w1').map((p) => p.id)).toEqual([
    'a',
    'b',
    'c',
  ])
})
