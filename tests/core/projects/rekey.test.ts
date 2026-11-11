import { describe, expect, test } from 'vitest'
import type { Layout } from '../../../src/core/projects/layout'
import { followNewId, followNewIdInLayout, followResume } from '../../../src/core/projects/rekey'
import { group, project, projects } from '../../factories/projects'

describe('a cleared session’s new id takes the old one’s place', () => {
  test('in the project’s members, its group and its leader mark; the old id stays, ungrouped, right after it', () => {
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
    expect(followed.projects[0]).toEqual(
      project(
        'p1',
        'Work',
        ['a', 'new', 'old', 'b'],
        [{ ...group('auth', ['new', 'a']), leader: 'new' }, group('ui', ['b'])],
      ),
    )
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

describe('a session resumed inside a tab joins the tab’s project', () => {
  test('out of another project and its group there (its leader mark dropped), shown; the session left stays', () => {
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
    const followed = followResume(state, 'p1', 'picked')
    expect(followed.projects[0]).toEqual(project('p1', 'Work', ['left', 'picked']))
    expect(followed.projects[1]).toEqual({
      ...project('p2', 'Other', ['x'], [group('g', ['x'])]),
      hidden: [],
    })
  })

  test('a session already in the tab’s project stays where it is, shown', () => {
    const state = projects([{ ...project('p1', 'Work', ['picked', 'left']), hidden: ['picked'] }])
    expect(followResume(state, 'p1', 'picked').projects[0]).toEqual({
      ...project('p1', 'Work', ['picked', 'left']),
      hidden: [],
    })
  })
})
