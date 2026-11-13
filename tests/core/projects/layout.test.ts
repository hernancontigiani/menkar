import { describe, expect, test } from 'vitest'
import {
  bringProject,
  closeBoards,
  closeTab,
  holder,
  insertTabAfter,
  type Layout,
  type LayoutWindow,
  moveSessionHere,
  moveTab,
  newWindowProject,
  nthTab,
  openBeside,
  openBoard,
  openSession,
  removeWindow,
  reopen,
  setMaximized,
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

describe('bringing a project another window holds (decision 1.67)', () => {
  const file = (id: string, projectId: string): Tab => ({
    kind: 'file',
    id,
    project: projectId,
    path: `/x/${id}`,
    preview: false,
  })

  test('its tabs move in their order with the selected one; the other window keeps showing what it showed and its other tabs', () => {
    const layout = layoutOf(
      win('w1', 'M', [session('m1', 'M', ['s0']), session('c1', 'C', ['s1']), file('c2', 'C')], {
        M: 'm1',
        C: 'c2',
      }),
      win('w2', 'B', [session('b1', 'B', ['s9'])], { B: 'b1' }),
    )
    const out = bringProject(layout, 'w2', 'C', [], ['M', 'C', 'B'])
    expect(out).toEqual({
      kind: 'brought',
      from: 'w1',
      layout: layoutOf(
        win('w1', 'M', [session('m1', 'M', ['s0'])], { M: 'm1' }),
        win('w2', 'C', [session('b1', 'B', ['s9']), session('c1', 'C', ['s1']), file('c2', 'C')], {
          B: 'b1',
          C: 'c2',
        }),
      ),
    })
    if (out.kind === 'brought') expect(holder(out.layout, 'C')).toBe('w2')
  })

  test('a window that showed it shows its most recent other project no other window holds', () => {
    const layout = layoutOf(
      win('w1', 'C', [session('c1', 'C', ['s1']), session('d1', 'D', ['s2'])], { C: 'c1' }),
      win('w2', 'B', [session('b1', 'B', ['s9'])]),
      win('w3', 'E', []),
    )
    // B is w2's, E is w3's: D (its own tab) beats F, never used.
    const out = bringProject(layout, 'w2', 'C', ['B', 'E', 'D', 'C'], ['B', 'C', 'D', 'E', 'F'])
    if (out.kind !== 'brought') throw new Error('expected brought')
    expect(out.layout.windows[0]).toEqual(win('w1', 'D', [session('d1', 'D', ['s2'])], {}))
    const none = bringProject(layout, 'w2', 'C', [], ['B', 'C', 'E', 'F'])
    if (none.kind !== 'brought') throw new Error('expected brought')
    expect(none.layout.windows[0]?.shown).toBe('F')
  })

  test('the project this window leaves goes to the other one when it is free; with nothing free, it is refused', () => {
    const swap = layoutOf(win('w1', 'C', []), win('w2', 'B', []))
    const out = bringProject(swap, 'w2', 'C', [], ['B', 'C'])
    if (out.kind !== 'brought') throw new Error('expected brought')
    expect(out.layout).toEqual(layoutOf(win('w1', 'B', []), win('w2', 'C', [])))
    const stuck = layoutOf(win('w1', 'C', []), win('w2', 'B', [session('b1', 'B', ['s9'])]))
    expect(bringProject(stuck, 'w2', 'C', [], ['B', 'C'])).toEqual({
      kind: 'refused',
      refusal: 'layout.nothingElse',
    })
  })

  test('a project no other window holds is simply shown', () => {
    const layout = layoutOf(win('w1', 'A', []), win('w2', 'B', []))
    expect(bringProject(layout, 'w2', 'C', [], ['A', 'B', 'C'])).toEqual({
      kind: 'brought',
      from: null,
      layout: layoutOf(win('w1', 'A', []), win('w2', 'C', [])),
    })
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
        maximized: false,
      },
    ])
  })

  test('PRJ-54 fork, chat and new-session tabs are never saved; a project with no saved tab is left out', () => {
    const layout = layoutOf(
      win('w1', 'A', [
        { kind: 'transient', id: 'fork', project: 'A' },
        { kind: 'transient', id: 'chat', project: 'B' },
        { kind: 'file', id: 'f', project: 'A', path: '/n.md', preview: true },
      ]),
    )
    expect(toSaved(layout)).toEqual([
      { current: 'A', tabs: { A: [{ file: '/n.md', preview: true }] }, maximized: false },
    ])
  })

  test('decision 1.98: a window maximized, then restored or not, is saved as it last was', () => {
    const layout = layoutOf(win('w1', 'A', []), win('w2', 'B', []))
    const maximized = setMaximized(layout, 'w2', true)
    expect(toSaved(maximized).map((w) => w.maximized)).toEqual([false, true])
    expect(toSaved(setMaximized(maximized, 'w2', false)).map((w) => w.maximized)).toEqual([
      false,
      false,
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

  test('decision 1.98: a window saved maximized reopens maximized; anything but true reads as not', () => {
    const layout = reopenWith([
      { current: 'A', tabs: {}, maximized: true },
      { current: 'B', tabs: {}, maximized: 'yes' },
    ])
    expect(layout.windows.map((w) => [w.shown, w.maximized])).toEqual([
      ['A', true],
      ['B', false],
    ])
    expect(reopenWith([{ current: 'A', tabs: {} }]).windows[0]?.maximized).toBe(false)
  })

  test('decision 1.98: with reopening off, the one window opens maximized as the first saved window was', () => {
    const off = { reopenTabs: false }
    expect(reopenWith([{ current: 'B', tabs: {}, maximized: true }], off).windows).toMatchObject([
      { shown: 'A', tabs: [], maximized: true },
    ])
    expect(reopenWith([], off).windows[0]?.maximized).toBe(false)
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

describe('reordering tabs (decision 1.23)', () => {
  const layout = layoutOf(
    win('w', 'a', [
      session('A1', 'a', ['s1']),
      session('B1', 'b', ['s9']),
      session('A2', 'a', ['s2']),
      session('A3', 'a', ['s3']),
    ]),
  )
  const ids = (l: Layout) => tabsOf(l, 'w').map((t) => t.id)
  const ofA = (l: Layout) => ids(l).filter((id) => id.startsWith('A'))

  test('PRJ-58 a tab moves before another of its project, or last when dropped after them all', () => {
    expect(ofA(moveTab(layout, 'w', 'A3', 'A1'))).toEqual(['A3', 'A1', 'A2'])
    expect(ofA(moveTab(layout, 'w', 'A1', null))).toEqual(['A2', 'A3', 'A1'])
    expect(ids(moveTab(layout, 'w', 'A1', null))).toEqual(['B1', 'A2', 'A3', 'A1'])
  })

  test('PRJ-58 onto itself, onto another project’s tab or an unknown one, nothing moves', () => {
    expect(moveTab(layout, 'w', 'A2', 'A2')).toBe(layout)
    expect(moveTab(layout, 'w', 'A2', 'B1')).toBe(layout)
    expect(moveTab(layout, 'w', 'nope', 'A1')).toBe(layout)
  })
})

// Plan 31, decision 16: a session another one starts opens right after the caller's tab, in the
// window that holds the project, and the window keeps the tab it had selected.
describe('a tab started by another session', () => {
  test('goes right after the caller’s tab; the selection does not change', () => {
    const before = layoutOf(
      win('w1', 'p1', [session('a', 'p1', ['s1']), session('b', 'p1', ['s2'])], { p1: 'b' }),
      win('w2', 'p2', [session('c', 'p2', ['s3'])], { p2: 'c' }),
    )
    const after = insertTabAfter(before, 'a', session('new', 'p1', ['s9']))
    expect(tabsOf(after, 'w1').map((t) => t.id)).toEqual(['a', 'new', 'b'])
    expect(after.windows[0]?.selected).toEqual({ p1: 'b' })
    expect(after.windows[1]).toBe(before.windows[1])
  })

  test('a caller’s tab that is gone changes nothing', () => {
    const before = layoutOf(win('w1', 'p1', [session('a', 'p1', ['s1'])], { p1: 'a' }))
    expect(insertTabAfter(before, 'gone', session('new', 'p1', ['s9']))).toBe(before)
  })
})

// Decision 1.112: the Board is a tab of its own, one per project; opening it again selects it, and
// it is saved with the layout like a file tab.
describe('the Board tab', () => {
  test('opening it adds one board tab and selects it; opening it again selects the same one', () => {
    const layout = layoutOf(win('w1', 'A', [session('t1', 'A', ['S1'])], { A: 't1' }))
    const once = openBoard(layout, 'w1', ids('b'))
    const board = tabsOf(once, 'w1').filter((x) => x.kind === 'board')
    expect(board).toHaveLength(1)
    expect(once.windows[0]?.selected.A).toBe(board[0]?.id)
    const back = { windows: [{ ...(once.windows[0] as LayoutWindow), selected: { A: 't1' } }] }
    const twice = openBoard(back, 'w1', ids('c'))
    expect(tabsOf(twice, 'w1').filter((x) => x.kind === 'board')).toHaveLength(1)
    expect(twice.windows[0]?.selected.A).toBe(board[0]?.id)
  })

  test('another project shown gets its own board', () => {
    const layout = openBoard(layoutOf(win('w1', 'A', [])), 'w1', ids('b'))
    const other = openBoard(
      { windows: [{ ...(layout.windows[0] as LayoutWindow), shown: 'B' }] },
      'w1',
      ids('c'),
    )
    expect(tabsOf(other, 'w1').map((x) => [x.kind, x.project])).toEqual([
      ['board', 'A'],
      ['board', 'B'],
    ])
  })

  test('saved as { board: true } and reopened as a board tab, once per project', () => {
    const layout = openBoard(layoutOf(win('w1', 'A', [session('t1', 'A', ['S1'])])), 'w1', ids('b'))
    const saved = toSaved(layout)
    expect(saved[0]?.tabs.A).toEqual([
      { panes: ['S1'], orientation: 'horizontal' },
      { board: true },
    ])
    const state = projects([project('A', 'A', ['S1'])], 'A')
    const reopened = reopen(
      {
        ...state,
        windows: [{ current: 'A', tabs: { A: [{ board: true }, { board: true }] } }] as never,
      },
      { reopenTabs: true, isFile: () => true, newId: ids('id') },
    )
    expect(reopened.windows[0]?.tabs.map((x) => x.kind)).toEqual(['board'])
  })
})

// The human, 2026-11-13: switching the mode off closes the project's Board in every window, so
// nothing of the mode shows with it off.
describe('closing the Board when the mode goes off', () => {
  test("the project's board goes from every window, its selection moving to a neighbour; other projects' boards stay", () => {
    let layout = layoutOf(
      win('w1', 'A', [session('t1', 'A', ['S1'])], { A: 't1' }),
      win('w2', 'B', []),
    )
    layout = openBoard(layout, 'w1', ids('a'))
    layout = openBoard(layout, 'w2', ids('b'))
    const closed = closeBoards(layout, 'A')
    expect(tabsOf(closed, 'w1').map((x) => x.kind)).toEqual(['session'])
    expect(closed.windows[0]?.selected.A).toBe('t1')
    expect(tabsOf(closed, 'w2').map((x) => [x.kind, x.project])).toEqual([['board', 'B']])
    expect(closeBoards(closed, 'A')).toEqual(closed)
  })
})
