import { describe, expect, test } from 'vitest'
import {
  closeTab,
  holder,
  type Layout,
  type LayoutWindow,
  moveSessionHere,
  newWindowProject,
  nthTab,
  openBeside,
  openSession,
  removeWindow,
  reopen,
  shownTab,
  stepTab,
  switchProject,
  type Tab,
  toSaved,
} from '../../../src/core/projects/layout'
import { ids, project, projects } from '../../factories/projects'

const session = (
  id: string,
  projectId: string,
  panes: string[],
  orientation: 'horizontal' | 'vertical' = 'horizontal',
): Tab => ({
  kind: 'session',
  id,
  project: projectId,
  panes,
  orientation,
})

function win(
  id: string,
  shown: string,
  tabs: Tab[],
  selected: Record<string, string> = {},
): LayoutWindow {
  return { id, shown, tabs, selected }
}

const layoutOf = (...windows: LayoutWindow[]): Layout => ({ windows })
const tabsOf = (layout: Layout, windowId: string) =>
  layout.windows.find((w) => w.id === windowId)?.tabs ?? []

describe('switching project', () => {
  test('PRJ-18 a project another window holds brings that window forward; this one is unchanged', () => {
    const layout = layoutOf(win('w1', 'A', []), win('w2', 'B', []))
    expect(switchProject(layout, 'w1', 'B')).toEqual({ kind: 'focus', window: 'w2' })
    expect(holder(layout, 'B')).toBe('w2')
  })

  test('PRJ-19 switching away keeps the tabs; switching back selects the tab last selected there', () => {
    const layout = layoutOf(
      win('w1', 'A', [session('t1', 'A', ['s1']), session('t2', 'A', ['s2'])], { A: 't2' }),
    )
    const toB = switchProject(layout, 'w1', 'B')
    if (toB.kind !== 'shown') throw new Error('expected shown')
    expect(shownTab(toB.layout.windows[0] as LayoutWindow)).toBeNull()
    expect(tabsOf(toB.layout, 'w1')).toHaveLength(2)
    const back = switchProject(toB.layout, 'w1', 'A')
    if (back.kind !== 'shown') throw new Error('expected shown')
    expect(shownTab(back.layout.windows[0] as LayoutWindow)).toBe('t2')
    expect(switchProject(back.layout, 'w1', 'A')).toEqual({ kind: 'same' })
  })
})

describe('opening', () => {
  test('PRJ-27 opening a stopped member appends a selected tab; opening it again selects that tab', () => {
    const state = projects([project('A', 'A', ['s1'])])
    const first = openSession(layoutOf(win('w1', 'A', [])), state, 'w1', 's1', ids('t'))
    expect(first.window).toBe('w1')
    expect(tabsOf(first.layout, 'w1')).toEqual([session('t1', 'A', ['s1'])])
    const again = openSession(first.layout, first.projects, 'w1', 's1', ids('x'))
    expect(tabsOf(again.layout, 'w1')).toHaveLength(1)
    expect(again.tab).toBe('t1')
  })

  test('opening a session in no project makes it a member of the shown project', () => {
    const result = openSession(
      layoutOf(win('w1', 'A', [])),
      projects([project('A', 'A')]),
      'w1',
      's1',
      ids('t'),
    )
    expect(result.projects.projects[0]?.members).toEqual(['s1'])
  })

  test('SES-47 a member of a project another window holds opens there, and this window gets no tab', () => {
    const state = projects([project('A', 'A'), project('P', 'P', ['s1'])])
    const result = openSession(
      layoutOf(win('w1', 'A', []), win('w2', 'P', [])),
      state,
      'w1',
      's1',
      ids('t'),
    )
    expect(result.window).toBe('w2')
    expect(tabsOf(result.layout, 'w1')).toEqual([])
    expect(tabsOf(result.layout, 'w2')).toEqual([session('t1', 'P', ['s1'])])
  })

  test('a member of a project no window holds: this window shows that project and opens it there', () => {
    const state = projects([project('A', 'A'), project('P', 'P', ['s1'])])
    const result = openSession(layoutOf(win('w1', 'A', [])), state, 'w1', 's1', ids('t'))
    expect(result.layout.windows[0]).toMatchObject({
      shown: 'P',
      tabs: [session('t1', 'P', ['s1'])],
    })
  })
})

describe('open beside', () => {
  const state = projects([project('A', 'A', ['s1', 's2', 's3']), project('B', 'B', ['b1'])])

  test('PRJ-28 a stopped session goes into the selected tab beside the first', () => {
    const layout = layoutOf(win('w1', 'A', [session('T', 'A', ['s1'])], { A: 'T' }))
    const result = openBeside(layout, state, 'w1', 's2')
    expect(result.kind).toBe('done')
    if (result.kind === 'done')
      expect(tabsOf(result.layout, 'w1')).toEqual([session('T', 'A', ['s1', 's2'])])
  })

  test('PRJ-29 a session running alone in its own tab moves into the selected tab, its old tab gone', () => {
    const layout = layoutOf(
      win('w1', 'A', [session('T', 'A', ['s1']), session('U', 'A', ['s2'])], { A: 'T' }),
    )
    const result = openBeside(layout, state, 'w1', 's2')
    if (result.kind !== 'done') throw new Error(result.kind)
    expect(tabsOf(result.layout, 'w1')).toEqual([session('T', 'A', ['s1', 's2'])])
  })

  test('PRJ-30 a tab that has two panes refuses', () => {
    const layout = layoutOf(win('w1', 'A', [session('T', 'A', ['s1', 's3'])], { A: 'T' }))
    expect(openBeside(layout, state, 'w1', 's2')).toEqual({
      kind: 'refused',
      refusal: 'layout.twoPanesMax',
    })
  })

  test('PRJ-31 a session of another project refuses', () => {
    const layout = layoutOf(win('w1', 'A', [session('T', 'A', ['s1'])], { A: 'T' }))
    expect(openBeside(layout, state, 'w1', 'b1')).toEqual({
      kind: 'refused',
      refusal: 'layout.otherProject',
    })
  })

  test('PRJ-32 a session running beside another refuses', () => {
    const layout = layoutOf(
      win('w1', 'A', [session('T', 'A', ['s1']), session('U', 'A', ['s2', 's3'])], { A: 'T' }),
    )
    expect(openBeside(layout, state, 'w1', 's2')).toEqual({
      kind: 'refused',
      refusal: 'layout.alreadyBeside',
    })
  })

  test('PRJ-33 with a file tab selected, or none, it acts as Open; in the same tab, nothing', () => {
    const file: Tab = { kind: 'file', id: 'F', project: 'A', path: '/n.md', preview: false }
    expect(openBeside(layoutOf(win('w1', 'A', [file], { A: 'F' })), state, 'w1', 's2')).toEqual({
      kind: 'open',
    })
    expect(openBeside(layoutOf(win('w1', 'A', [])), state, 'w1', 's2')).toEqual({ kind: 'open' })
    const layout = layoutOf(win('w1', 'A', [session('T', 'A', ['s1'])], { A: 'T' }))
    expect(openBeside(layout, state, 'w1', 's1')).toEqual({ kind: 'noop' })
  })

  test('a session in no project joins the shown one when placed beside', () => {
    const layout = layoutOf(win('w1', 'A', [session('T', 'A', ['s1'])], { A: 'T' }))
    const result = openBeside(layout, state, 'w1', 'loose')
    if (result.kind !== 'done') throw new Error(result.kind)
    expect(result.projects.projects[0]?.members).toContain('loose')
  })
})

describe('picking a session in Add session', () => {
  const state = projects([project('A', 'A'), project('B', 'B', ['s', 'o'])])

  test('PRJ-34 a session alone in a tab of another window: the tab moves here, last, selected; it joins A', () => {
    const layout = layoutOf(
      win('w1', 'A', [session('a1', 'A', ['x'])]),
      win('w2', 'B', [session('U', 'B', ['s']), session('V', 'B', ['o'])]),
    )
    const result = moveSessionHere(layout, state, 'w1', 's', ids('n'))
    if (!result.ok) throw new Error(result.refusal)
    expect(tabsOf(result.layout, 'w1').map((t) => t.id)).toEqual(['a1', 'U'])
    expect(tabsOf(result.layout, 'w1')[1]).toMatchObject({ project: 'A' })
    expect(result.layout.windows[0]?.selected.A).toBe('U')
    expect(tabsOf(result.layout, 'w2').map((t) => t.id)).toEqual(['V'])
    expect(result.projects.projects.map((p) => p.members)).toEqual([['s'], ['o']])
  })

  test('PRJ-35 a session sharing a tab in another window: refused, nothing changes', () => {
    const layout = layoutOf(win('w1', 'A', []), win('w2', 'B', [session('U', 'B', ['s', 'o'])]))
    expect(moveSessionHere(layout, state, 'w1', 's', ids('n'))).toEqual({
      ok: false,
      refusal: 'layout.sharesTab',
    })
  })

  test('a session in a two-pane tab of this window, another project: its pane alone moves to a new tab here', () => {
    const layout = layoutOf(win('w1', 'A', [session('U', 'B', ['s', 'o'])]))
    const result = moveSessionHere(layout, state, 'w1', 's', ids('n'))
    if (!result.ok) throw new Error(result.refusal)
    expect(tabsOf(result.layout, 'w1')).toEqual([
      session('U', 'B', ['o']),
      session('n1', 'A', ['s']),
    ])
  })
})

describe('moving between tabs', () => {
  const w = win(
    'w1',
    'A',
    [
      session('T1', 'A', ['a']),
      session('T4', 'B', ['b']),
      session('T2', 'A', ['c']),
      session('T3', 'A', ['d']),
    ],
    { A: 'T3' },
  )

  test('PRJ-38 next and previous wrap among the shown project’s tabs only', () => {
    expect(stepTab(w, 1)).toBe('T1')
    expect(stepTab({ ...w, selected: { A: 'T1' } }, -1)).toBe('T3')
  })

  test('PRJ-39 the Nth tab, 1-based; past the count, nothing', () => {
    expect(nthTab(w, 2)).toBe('T2')
    expect(nthTab(w, 7)).toBeNull()
  })

  test('PRJ-40 with one tab, nothing changes', () => {
    expect(stepTab(win('w1', 'A', [session('T1', 'A', ['a'])], { A: 'T1' }), 1)).toBeNull()
  })

  test('closing the selected tab selects a neighbour of the same project', () => {
    const after = closeTab(layoutOf(w), 'w1', 'T3')
    expect(after.windows[0]?.selected.A).toBe('T2')
    expect(
      shownTab(
        closeTab(layoutOf(win('w1', 'A', [session('T1', 'A', ['a'])], { A: 'T1' })), 'w1', 'T1')
          .windows[0] as LayoutWindow,
      ),
    ).toBeNull()
  })
})

describe('windows', () => {
  test('PRJ-44 a new window takes the first project no window holds, else none', () => {
    const state = projects([project('A', 'A'), project('B', 'B'), project('C', 'C')])
    expect(newWindowProject(layoutOf(win('w1', 'A', [])), state)).toBe('B')
    expect(
      newWindowProject(
        layoutOf(win('w1', 'A', [session('t', 'C', ['x'])]), win('w2', 'B', [])),
        state,
      ),
    ).toBeNull()
  })
})

describe('the saved layout', () => {
  test('PRJ-47 a window closed first leaves the saved layout; the last one is kept whole', () => {
    const layout = layoutOf(
      win('w1', 'A', [session('T1', 'A', ['s1']), session('T2', 'A', ['s2'])]),
      win('w2', 'B', [session('U', 'B', ['b1'])]),
    )
    expect(toSaved(removeWindow(layout, 'w2'))).toEqual([
      {
        current: 'A',
        tabs: {
          A: [
            { panes: ['s1'], orientation: 'horizontal' },
            { panes: ['s2'], orientation: 'horizontal' },
          ],
        },
      },
    ])
  })

  test('PRJ-54 fork, chat, replay and new-session tabs are never saved; a project with no saved tab is left out', () => {
    const layout = layoutOf(
      win('w1', 'A', [
        { kind: 'transient', id: 'fork', project: 'A' },
        { kind: 'transient', id: 'chat', project: 'B' },
        { kind: 'file', id: 'f', project: 'A', path: '/n.md', preview: true },
      ]),
    )
    expect(toSaved(layout)).toEqual([
      { current: 'A', tabs: { A: [{ file: '/n.md', preview: true }] } },
    ])
  })
})

describe('reopening on start', () => {
  const state = projects([project('A', 'A', ['S1', 'S2', 'S3']), project('B', 'B', ['B1'])], 'A')
  const exists = () => true
  const reopenWith = (
    windows: unknown[],
    options: Partial<{ reopenTabs: boolean; isFile: (p: string) => boolean }> = {},
  ) =>
    reopen(
      { ...state, windows: windows as never },
      { reopenTabs: true, isFile: exists, newId: ids('id'), ...options },
    )

  test('PRJ-48 a saved vertical two-pane tab reopens as one tab, S1 then S2, vertical', () => {
    const layout = reopenWith([
      { current: 'A', tabs: { A: [{ panes: ['S1', 'S2'], orientation: 'vertical' }] } },
    ])
    expect(layout.windows[0]?.tabs).toMatchObject([
      { kind: 'session', panes: ['S1', 'S2'], orientation: 'vertical' },
    ])
  })

  test('PRJ-49 three saved panes reopen as the first two; an unknown orientation is side by side', () => {
    const layout = reopenWith([
      { current: 'A', tabs: { A: [{ panes: ['S1', 'S2', 'S3'], orientation: 'diagonal' }] } },
    ])
    expect(layout.windows[0]?.tabs).toMatchObject([
      { panes: ['S1', 'S2'], orientation: 'horizontal' },
    ])
  })

  test('PRJ-50 a pane no longer a member is dropped, and a tab left with none; a session is placed once', () => {
    const layout = reopenWith([
      {
        current: 'A',
        tabs: { A: [{ panes: ['gone'] }, { panes: ['S1', 'B1'] }, { panes: ['S1'] }] },
      },
    ])
    expect(layout.windows[0]?.tabs).toMatchObject([{ panes: ['S1'] }])
  })

  test('PRJ-51 two windows listing A: A reopens in the first; the second, with nothing else, is dropped', () => {
    const layout = reopenWith([
      { current: 'A', tabs: { A: [{ panes: ['S1'] }] } },
      { current: 'A', tabs: { A: [{ panes: ['S2'] }] } },
    ])
    expect(layout.windows.map((w) => [w.shown, w.tabs.length])).toEqual([['A', 1]])
  })

  test('PRJ-52 a file tab whose file is gone is not reopened', () => {
    const layout = reopenWith(
      [
        {
          current: 'A',
          tabs: {
            A: [
              { file: '/gone.md', preview: false },
              { file: '/n.md', preview: true },
            ],
          },
        },
      ],
      {
        isFile: (p) => p === '/n.md',
      },
    )
    expect(layout.windows[0]?.tabs).toMatchObject([{ kind: 'file', path: '/n.md', preview: true }])
  })

  test('PRJ-53 with reopening off: one window on current, no tabs', () => {
    const layout = reopenWith([{ current: 'B', tabs: { B: [{ panes: ['B1'] }] } }], {
      reopenTabs: false,
    })
    expect(layout.windows.map((w) => [w.shown, w.tabs.length])).toEqual([['A', 0]])
  })

  test('a window whose saved project is gone shows the first project it has tabs of; nothing usable → one window on current', () => {
    const layout = reopenWith([
      { current: 'zz', tabs: { B: [{ panes: ['B1'] }] } },
      'junk',
      { current: 3 },
    ])
    expect(layout.windows.map((w) => w.shown)).toEqual(['B'])
    expect(reopenWith([]).windows.map((w) => [w.shown, w.tabs.length])).toEqual([['A', 0]])
  })
})
