import { describe, expect, test } from 'vitest'
import type { Layout } from '../../../src/core/projects/layout'
import { followNewId, followNewIdInLayout, followResume } from '../../../src/core/projects/rekey'
import { group, project, projects } from '../../factories/projects'

describe('a cleared session’s new id takes the old one’s place', () => {
  test('in the project’s members, its group and its leader mark; the old id stays, ungrouped, right after it, as an earlier conversation', () => {
    const state = projects([
      project(
        'p1',
        'Work',
        ['a', 'old', 'b'],
        [{ ...group('auth', ['old', 'a']), leader: 'old' }, group('ui', ['b'])],
      ),
      project('p2', 'Other', ['c']),
    ])
    const followed = followNewId(state, 'old', 'new')
    expect(followed.projects[0]).toEqual({
      ...project(
        'p1',
        'Work',
        ['a', 'new', 'old', 'b'],
        [{ ...group('auth', ['new', 'a']), leader: 'new' }, group('ui', ['b'])],
      ),
      earlier: { new: ['old'] },
    })
    expect(followed.projects[1]).toBe(state.projects[1])
  })

  test('a group whose leader is another member keeps that leader', () => {
    const state = projects([
      project('p1', 'Work', ['a', 'old'], [{ ...group('g', ['a', 'old']), leader: 'a' }]),
    ])
    expect(followNewId(state, 'old', 'new').projects[0]?.groups).toEqual([
      { ...group('g', ['a', 'new']), leader: 'a' },
    ])
  })

  test('a hidden old id passes its hidden flag to the new one, and shows as the stopped row', () => {
    const state = projects([{ ...project('p1', 'Work', ['old', 'x']), hidden: ['x', 'old'] }])
    expect(followNewId(state, 'old', 'new').projects[0]?.hidden).toEqual(['x', 'new'])
  })

  test('nothing changes when the old id is in no project, the ids are equal, or the new id already is a member', () => {
    const state = projects([project('p1', 'Work', ['old']), project('p2', 'Other', ['new'])])
    expect(followNewId(state, 'stranger', 'fresh')).toBe(state)
    expect(followNewId(state, 'old', 'old')).toBe(state)
    expect(followNewId(state, 'old', 'new')).toBe(state)
  })

  test('the tab that ran the old id runs the new one in the same pane; other tabs are left', () => {
    const layout: Layout = {
      windows: [
        {
          id: 'w1',
          shown: 'p1',
          selected: { p1: 't1' },
          tabs: [
            {
              kind: 'session',
              id: 't1',
              project: 'p1',
              panes: ['a', 'old'],
              orientation: 'vertical',
            },
            { kind: 'file', id: 't2', project: 'p1', path: '/x', preview: false },
            { kind: 'session', id: 't3', project: 'p1', panes: ['b'], orientation: 'horizontal' },
          ],
        },
      ],
    }
    const followed = followNewIdInLayout(layout, 'old', 'new')
    expect(followed.windows[0]?.tabs).toEqual([
      { kind: 'session', id: 't1', project: 'p1', panes: ['a', 'new'], orientation: 'vertical' },
      layout.windows[0]?.tabs[1],
      layout.windows[0]?.tabs[2],
    ])
    expect(followNewIdInLayout(layout, 'old', 'old')).toBe(layout)
  })
})

describe('a session resumed inside a tab joins the tab’s project, in the left one’s place', () => {
  test('out of another project and its group there (its leader mark dropped), shown; the session left is its earlier conversation', () => {
    const state = projects([
      project('p1', 'Work', ['left']),
      {
        ...project(
          'p2',
          'Other',
          ['x', 'picked'],
          [{ ...group('g', ['picked', 'x']), leader: 'picked' }],
        ),
        hidden: ['picked'],
      },
    ])
    const followed = followResume(state, 'left', 'picked', 'p1')
    expect(followed.projects[0]).toEqual({
      ...project('p1', 'Work', ['picked', 'left']),
      earlier: { picked: ['left'] },
    })
    expect(followed.projects[1]).toEqual({
      ...project('p2', 'Other', ['x'], [group('g', ['x'])]),
      hidden: [],
    })
  })

  test('a session already in the tab’s project moves to the left one’s place, shown', () => {
    const state = projects([
      { ...project('p1', 'Work', ['picked', 'x', 'left']), hidden: ['picked'] },
    ])
    expect(followResume(state, 'left', 'picked', 'p1').projects[0]).toEqual({
      ...project('p1', 'Work', ['x', 'picked', 'left']),
      hidden: [],
      earlier: { picked: ['left'] },
    })
  })

  test('resuming one of its own earlier conversations swaps them: the one left is earlier now', () => {
    const state = projects([
      {
        ...project('p1', 'Work', ['now', 'before', 'oldest']),
        earlier: { now: ['before', 'oldest'] },
      },
    ])
    expect(followResume(state, 'now', 'before', 'p1').projects[0]).toEqual({
      ...project('p1', 'Work', ['before', 'now', 'oldest']),
      earlier: { before: ['now', 'oldest'] },
    })
  })

  test('a resumed session brings its earlier conversations from its project into the tab’s', () => {
    const state = projects([
      project('p1', 'Work', ['left']),
      { ...project('p2', 'Other', ['picked', 'its-old', 'y']), earlier: { picked: ['its-old'] } },
    ])
    const followed = followResume(state, 'left', 'picked', 'p1')
    expect(followed.projects[0]).toEqual({
      ...project('p1', 'Work', ['picked', 'left', 'its-old']),
      earlier: { picked: ['left', 'its-old'] },
    })
    expect(followed.projects[1]).toEqual(project('p2', 'Other', ['y']))
  })
})

describe('a chain of clears', () => {
  test('a session cleared again passes its earlier conversations on: the newest lists them all', () => {
    let state = projects([project('p1', 'Work', ['first'])])
    state = followNewId(state, 'first', 'second')
    state = followNewId(state, 'second', 'third')
    expect(state.projects[0]).toEqual({
      ...project('p1', 'Work', ['third', 'second', 'first']),
      earlier: { third: ['second', 'first'] },
    })
  })
})
