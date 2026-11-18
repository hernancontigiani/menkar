import { describe, expect, test } from 'vitest'
import * as layoutModule from '../../../src/core/projects/layout'
import {
  bringProject,
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
  openSession,
  ordinaryUnless,
  pin,
  removeWindow,
  reopen,
  select,
  setMaximized,
  shownTab,
  stepTab,
  switchProject,
  type Tab,
  toBackground,
  toSaved,
} from '../../../src/core/projects/layout'
import type { TabPlace } from '../../../src/core/projects/place'
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

// Decision 1.126: the Board is a panel, no longer a tab; a Board tab an earlier version saved is
// dropped on read, the tabs around it kept.
describe('a saved Board tab', () => {
  test('is dropped on read', () => {
    const state = projects([project('A', 'A', ['S1'])], 'A')
    const reopened = reopen(
      {
        ...state,
        windows: [
          {
            current: 'A',
            tabs: { A: [{ board: true }, { panes: ['S1'], orientation: 'horizontal' }] },
          },
        ] as never,
      },
      { reopenTabs: true, isFile: () => true, newId: ids('id') },
    )
    expect(reopened.windows[0]?.tabs.map((x) => x.kind)).toEqual(['session'])
  })
})

const placedTab =
  (place: TabPlace) =>
  (id: string, projectId: string, pane: string): Tab => ({
    kind: 'session',
    id,
    project: projectId,
    panes: [pane],
    orientation: 'horizontal',
    place,
  })
const bgTab = placedTab('background')
const peekTab = placedTab('peek')
const placeIn = (l: Layout, tabId: string): TabPlace | 'ordinary' | 'gone' => {
  const tab = l.windows.flatMap((w) => w.tabs).find((t) => t.id === tabId)
  if (!tab) return 'gone'
  return tab.kind === 'session' ? (tab.place ?? 'ordinary') : 'ordinary'
}
const order = (l: Layout, windowId: string, projectId?: string) =>
  tabsOf(l, windowId)
    .filter((t) => projectId === undefined || t.project === projectId)
    .map((t) => t.id)
const sel = (l: Layout, windowId: string, projectId: string) =>
  l.windows.find((w) => w.id === windowId)?.selected[projectId]

// Decision 1.176, plan 41 §2: an orchestrator's worker keeps running in a tab the strip does not
// draw, and is seen in its project's one peek tab, the last one.
describe('background workers and the peek tab (decision 1.176)', () => {
  test('a worker sent to the background keeps its tab, undrawn, and the selection goes to a drawn neighbour', () => {
    const l = layoutOf(
      win('w', 'X', [session('orch', 'X', ['o']), session('t9', 'X', ['w9'])], { X: 't9' }),
    )
    const after = toBackground(l, 'w', 't9')
    expect(order(after, 'w')).toEqual(['orch', 't9'])
    expect(placeIn(after, 't9')).toBe('background')
    expect(sel(after, 'w', 'X')).toBe('orch')
    const w = after.windows[0] as LayoutWindow
    expect(shownTab(w)).toBe('orch')
    expect(nthTab(w, 2)).toBeNull()
    expect(stepTab(w, 1)).toBeNull()
  })

  test('a tab with two panes is never sent to the background', () => {
    const l = layoutOf(win('w', 'X', [session('t9', 'X', ['w9', 's2'])], { X: 't9' }))
    expect(toBackground(l, 'w', 't9')).toBe(l)
  })

  test('closing or hiding the peek selects the next drawn tab, never a background one', () => {
    const l = layoutOf(
      win(
        'w',
        'X',
        [
          session('orch', 'X', ['o']),
          peekTab('A', 'X', 'wa'),
          bgTab('B', 'X', 'wb'),
          session('c1', 'X', ['c']),
        ],
        { X: 'A' },
      ),
    )
    expect(sel(closeTab(l, 'w', 'A'), 'w', 'X')).toBe('c1')
    expect(sel(toBackground(l, 'w', 'A'), 'w', 'X')).toBe('c1')
    const atEnd = layoutOf(
      win('w', 'X', [session('orch', 'X', ['o']), peekTab('A', 'X', 'wa'), bgTab('B', 'X', 'wb')], {
        X: 'A',
      }),
    )
    expect(sel(closeTab(atEnd, 'w', 'A'), 'w', 'X')).toBe('orch')
  })

  test('D1: one peek per project; selecting a background worker makes it the peek, last and selected, and the previous peek goes back', () => {
    const l = layoutOf(
      win(
        'w',
        'X',
        [
          session('orch', 'X', ['o']),
          bgTab('A', 'X', 'wa'),
          bgTab('B', 'X', 'wb'),
          session('c1', 'X', ['c']),
          peekTab('P', 'Y', 'wp'),
          session('y1', 'Y', ['y']),
        ],
        { X: 'orch', Y: 'P' },
      ),
    )
    const a = select(l, 'w', 'A')
    expect(order(a, 'w', 'X')).toEqual(['orch', 'B', 'c1', 'A'])
    expect(placeIn(a, 'A')).toBe('peek')
    expect(sel(a, 'w', 'X')).toBe('A')
    const b = select(a, 'w', 'B')
    expect(order(b, 'w', 'X')).toEqual(['orch', 'c1', 'A', 'B'])
    expect([placeIn(b, 'A'), placeIn(b, 'B')]).toEqual(['background', 'peek'])
    expect(sel(b, 'w', 'X')).toBe('B')
    // Another project's peek is its own.
    expect(placeIn(b, 'P')).toBe('peek')
    expect(sel(b, 'w', 'Y')).toBe('P')
  })

  test('a tab opened while the project has a peek goes before it, so the peek stays last', () => {
    const state = projects([project('X', 'X', ['o', 'wa', 'c2'])])
    const l = select(
      layoutOf(win('w', 'X', [session('orch', 'X', ['o']), bgTab('A', 'X', 'wa')], { X: 'orch' })),
      'w',
      'A',
    )
    const opened = openSession(l, state, 'w', 'c2', ids('t'))
    expect(order(opened.layout, 'w')).toEqual(['orch', 't1', 'A'])
    expect(sel(opened.layout, 'w', 'X')).toBe('t1')
    expect(placeIn(opened.layout, 'A')).toBe('peek')
  })

  test('pinning the peek makes it ordinary where it is, selected; the next peek comes after it', () => {
    const l = select(
      layoutOf(
        win('w', 'X', [session('orch', 'X', ['o']), bgTab('A', 'X', 'wa'), bgTab('B', 'X', 'wb')], {
          X: 'orch',
        }),
      ),
      'w',
      'A',
    )
    const pinned = pin(l, 'w', 'A')
    expect(order(pinned, 'w')).toEqual(['orch', 'B', 'A'])
    expect(placeIn(pinned, 'A')).toBe('ordinary')
    expect(sel(pinned, 'w', 'X')).toBe('A')
    const next = select(pinned, 'w', 'B')
    expect(order(next, 'w')).toEqual(['orch', 'A', 'B'])
    expect([placeIn(next, 'A'), placeIn(next, 'B')]).toEqual(['ordinary', 'peek'])
  })

  test('pinning a background worker makes it ordinary right before the peek, selected; the peek stays', () => {
    const l = layoutOf(
      win(
        'w',
        'X',
        [
          session('orch', 'X', ['o']),
          bgTab('B', 'X', 'wb'),
          session('c1', 'X', ['c']),
          peekTab('A', 'X', 'wa'),
        ],
        { X: 'orch' },
      ),
    )
    const pinned = pin(l, 'w', 'B')
    expect(order(pinned, 'w')).toEqual(['orch', 'c1', 'B', 'A'])
    expect([placeIn(pinned, 'B'), placeIn(pinned, 'A')]).toEqual(['ordinary', 'peek'])
    expect(sel(pinned, 'w', 'X')).toBe('B')
  })

  test('selecting a pinned worker leaves the peek where it is (1.176)', () => {
    const l = layoutOf(
      win(
        'w',
        'X',
        [session('orch', 'X', ['o']), session('C', 'X', ['wc']), peekTab('A', 'X', 'wa')],
        {
          X: 'A',
        },
      ),
    )
    const after = select(l, 'w', 'C')
    expect(sel(after, 'w', 'X')).toBe('C')
    expect(order(after, 'w')).toEqual(['orch', 'C', 'A'])
    expect(placeIn(after, 'A')).toBe('peek')
  })

  test('a session that is not a worker opens before the pinned workers; a worker opens before the peek', () => {
    const state = projects([project('X', 'X', ['o', 'w9', 'c', 'w5', 'wa'])])
    const worker = (id: string) => id.startsWith('w')
    const l = layoutOf(
      win('w', 'X', [session('orch', 'X', ['o']), session('t9', 'X', ['w9'])], { X: 'orch' }),
    )
    expect(order(openSession(l, state, 'w', 'c', ids('n'), { worker }).layout, 'w')).toEqual([
      'orch',
      'n1',
      't9',
    ])
    const withPeek = layoutOf(
      win(
        'w',
        'X',
        [session('orch', 'X', ['o']), session('t9', 'X', ['w9']), peekTab('A', 'X', 'wa')],
        {
          X: 'A',
        },
      ),
    )
    expect(order(openSession(withPeek, state, 'w', 'c', ids('n'), { worker }).layout, 'w')).toEqual(
      ['orch', 'n1', 't9', 'A'],
    )
    expect(
      order(openSession(withPeek, state, 'w', 'w5', ids('n'), { worker }).layout, 'w'),
    ).toEqual(['orch', 't9', 'n1', 'A'])
  })

  test('Q3: a tab whose worker stops being one turns ordinary; a selected peek stays where it is, selected', () => {
    const tabs = [
      session('orch', 'X', ['o']),
      bgTab('B', 'X', 'wb'),
      session('c1', 'X', ['c']),
      peekTab('A', 'X', 'wa'),
    ]
    const l = layoutOf(win('w', 'X', tabs, { X: 'A' }))
    const none = ordinaryUnless(l, () => false)
    // A stays in place and selected; B, no peek left to go before, goes last.
    expect(order(none, 'w')).toEqual(['orch', 'c1', 'A', 'B'])
    expect([placeIn(none, 'A'), placeIn(none, 'B')]).toEqual(['ordinary', 'ordinary'])
    expect(sel(none, 'w', 'X')).toBe('A')
    const keepA = ordinaryUnless(l, (t) => t.id === 'A')
    expect(order(keepA, 'w')).toEqual(['orch', 'c1', 'B', 'A'])
    expect([placeIn(keepA, 'A'), placeIn(keepA, 'B')]).toEqual(['peek', 'ordinary'])
    // An unselected peek: ordinary, not selected.
    const unselected = ordinaryUnless(
      layoutOf(win('w', 'X', tabs, { X: 'c1' })),
      (t) => t.id === 'B',
    )
    expect([placeIn(unselected, 'A'), placeIn(unselected, 'B')]).toEqual(['ordinary', 'background'])
    expect(sel(unselected, 'w', 'X')).toBe('c1')
    expect(ordinaryUnless(l, () => true)).toBe(l)
    // A placed tab with two panes never keeps its place.
    const split = layoutOf(
      win('w', 'X', [{ ...peekTab('A', 'X', 'wa'), panes: ['wa', 's'] } as Tab]),
    )
    expect(
      placeIn(
        ordinaryUnless(split, () => true),
        'A',
      ),
    ).toBe('ordinary')
  })

  test('a saved background tab of a session that is no longer a worker reopens ordinary', () => {
    const state = projects([project('X', 'X', ['S1', 'S2'])], 'X')
    const l = reopen(
      {
        ...state,
        windows: [
          {
            current: 'X',
            tabs: { X: [{ panes: ['S1'] }, { panes: ['S2'], place: 'background' }] },
          },
        ] as never,
      },
      { reopenTabs: true, isFile: () => true, newId: ids('id') },
    )
    const placeOf = (layout: Layout) =>
      layout.windows[0]?.tabs.map((t) => (t.kind === 'session' ? t.place : 'file'))
    expect(placeOf(l)).toEqual([undefined, 'background'])
    expect(placeOf(ordinaryUnless(l, (t) => t.panes.includes('S2')))).toEqual([
      undefined,
      'background',
    ])
    expect(placeOf(ordinaryUnless(l, (t) => t.panes.includes('S1')))).toEqual([
      undefined,
      undefined,
    ])
  })

  test('a peek given a second pane by Open beside is pinned first', () => {
    const state = projects([project('X', 'X', ['o', 'wa', 's2'])])
    const l = layoutOf(
      win('w', 'X', [session('orch', 'X', ['o']), peekTab('A', 'X', 'wa')], { X: 'A' }),
    )
    const out = openBeside(l, state, 'w', 's2')
    if (out.kind !== 'done') throw new Error(out.kind)
    expect(tabsOf(out.layout, 'w')[1]).toEqual(session('A', 'X', ['wa', 's2']))
    expect(placeIn(out.layout, 'A')).toBe('ordinary')
  })

  test('next, previous, the Nth tab and the shown tab never land on a background tab', () => {
    const w = win(
      'w',
      'X',
      [
        bgTab('B0', 'X', 'b0'),
        session('T1', 'X', ['a']),
        bgTab('B1', 'X', 'b1'),
        session('T2', 'X', ['c']),
      ],
      { X: 'T2' },
    )
    expect(stepTab(w, 1)).toBe('T1')
    expect(stepTab(w, -1)).toBe('T1')
    expect([nthTab(w, 1), nthTab(w, 2), nthTab(w, 3)]).toEqual(['T1', 'T2', null])
    expect(shownTab({ ...w, selected: {} })).toBe('T1')
    expect(shownTab({ ...w, selected: { X: 'B1' } })).toBe('T1')
  })

  test('D3: opening a background worker shows it in the peek; opening it pinned makes it ordinary', () => {
    const state = projects([project('X', 'X', ['o', 'wa', 'wb'])])
    const l = layoutOf(
      win('w', 'X', [session('orch', 'X', ['o']), bgTab('B', 'X', 'wb'), peekTab('A', 'X', 'wa')], {
        X: 'orch',
      }),
    )
    const peeked = openSession(l, state, 'w', 'wb', ids('n'))
    expect(peeked.tab).toBe('B')
    expect(order(peeked.layout, 'w')).toEqual(['orch', 'A', 'B'])
    expect([placeIn(peeked.layout, 'A'), placeIn(peeked.layout, 'B')]).toEqual([
      'background',
      'peek',
    ])
    expect(sel(peeked.layout, 'w', 'X')).toBe('B')
    const pinned = openSession(l, state, 'w', 'wb', ids('n'), { pin: true })
    expect(order(pinned.layout, 'w')).toEqual(['orch', 'B', 'A'])
    expect([placeIn(pinned.layout, 'A'), placeIn(pinned.layout, 'B')]).toEqual(['peek', 'ordinary'])
    expect(sel(pinned.layout, 'w', 'X')).toBe('B')
  })

  test('Add session on a background worker brings it into the peek', () => {
    const state = projects([project('X', 'X', ['sx']), project('Y', 'Y', ['wb', 'sy'])])
    const l = layoutOf(
      win('w1', 'X', [session('x1', 'X', ['sx'])], { X: 'x1' }),
      win('w2', 'Y', [session('y1', 'Y', ['sy']), bgTab('B', 'Y', 'wb')], { Y: 'y1' }),
    )
    const moved = moveSessionHere(l, state, 'w1', 'wb', ids('n'))
    if (!moved.ok) throw new Error(moved.refusal)
    expect(order(moved.layout, 'w1')).toEqual(['x1', 'B'])
    expect(tabsOf(moved.layout, 'w1')[1]).toMatchObject({ project: 'X', place: 'peek' })
    expect(sel(moved.layout, 'w1', 'X')).toBe('B')
    const here = moveSessionHere(
      layoutOf(win('w2', 'Y', [session('y1', 'Y', ['sy']), bgTab('B', 'Y', 'wb')], { Y: 'y1' })),
      state,
      'w2',
      'wb',
      ids('n'),
    )
    if (!here.ok) throw new Error(here.refusal)
    expect(placeIn(here.layout, 'B')).toBe('peek')
    expect(sel(here.layout, 'w2', 'Y')).toBe('B')
  })

  test('a tab started by the peek: a background one goes after it, unseen; an ordinary one before it', () => {
    const l = layoutOf(
      win('w', 'X', [session('orch', 'X', ['o']), peekTab('A', 'X', 'wa')], { X: 'A' }),
    )
    const hidden = insertTabAfter(l, 'A', bgTab('n', 'X', 'wn'))
    expect(order(hidden, 'w')).toEqual(['orch', 'A', 'n'])
    expect(sel(hidden, 'w', 'X')).toBe('A')
    expect(order(insertTabAfter(l, 'A', session('m', 'X', ['m'])), 'w')).toEqual(['orch', 'm', 'A'])
  })

  test('saved, a background tab and the peek are both background; on reopening an unknown place is ordinary', () => {
    const l = layoutOf(
      win('w', 'X', [session('x1', 'X', ['S1']), bgTab('B', 'X', 'S2'), peekTab('A', 'X', 'S3')], {
        X: 'A',
      }),
    )
    const saved = toSaved(l)
    expect(saved[0]?.tabs.X).toEqual([
      { panes: ['S1'], orientation: 'horizontal' },
      { panes: ['S2'], orientation: 'horizontal', place: 'background' },
      { panes: ['S3'], orientation: 'horizontal', place: 'background' },
    ])
    const state = projects([project('X', 'X', ['S1', 'S2', 'S3'])], 'X')
    const options = { reopenTabs: true, isFile: () => true, newId: ids('id') }
    const back = reopen({ ...state, windows: saved }, options)
    expect(back.windows[0]?.tabs.map((t) => t.kind === 'session' && t.place)).toEqual([
      undefined,
      'background',
      'background',
    ])
    const odd = reopen(
      {
        ...state,
        windows: [
          {
            current: 'X',
            tabs: {
              X: [
                { panes: ['S1'], place: 'peek' },
                { panes: ['S2'], place: 7 },
              ],
            },
          },
        ] as never,
      },
      options,
    )
    expect(odd.windows[0]?.tabs.map((t) => t.kind === 'session' && t.place)).toEqual([
      undefined,
      undefined,
    ])
  })

  test('D1: bringing a project moves its background tabs and its peek, their places kept', () => {
    const l = layoutOf(
      win(
        'w1',
        'M',
        [
          session('m1', 'M', ['sm']),
          session('x1', 'X', ['sx']),
          peekTab('A', 'X', 'wa'),
          bgTab('B', 'X', 'wb'),
        ],
        { M: 'm1', X: 'A' },
      ),
      win('w2', 'Y', [session('y1', 'Y', ['sy'])], { Y: 'y1' }),
    )
    const out = bringProject(l, 'w2', 'X', [], ['M', 'X', 'Y'])
    if (out.kind !== 'brought') throw new Error(out.kind)
    expect(order(out.layout, 'w2')).toEqual(['y1', 'x1', 'A', 'B'])
    expect([placeIn(out.layout, 'A'), placeIn(out.layout, 'B')]).toEqual(['peek', 'background'])
    expect(sel(out.layout, 'w2', 'X')).toBe('A')
  })
})

// Plan 41 §2.2's invariant, over every exported function: a case per export, so a new one without
// a case fails here.
describe('no function of the layout leaves a background tab selected (decision 1.176)', () => {
  const state = projects([
    project('X', 'X', ['sx1', 'wa', 'wp', 'wb', 'free']),
    project('Y', 'Y', ['sy1', 'wy']),
    project('Z', 'Z', ['sz1', 'wz']),
  ])
  const base = layoutOf(
    win(
      'w1',
      'X',
      [
        session('x1', 'X', ['sx1']),
        bgTab('xa', 'X', 'wa'),
        session('z1', 'Z', ['sz1']),
        bgTab('zb', 'Z', 'wz'),
        peekTab('xp', 'X', 'wp'),
        bgTab('xb', 'X', 'wb'),
      ],
      { X: 'xp', Z: 'z1' },
    ),
    win('w2', 'Y', [bgTab('yb', 'Y', 'wy'), session('y1', 'Y', ['sy1'])], { Y: 'y1' }),
  )
  const windowIds = base.windows.map((w) => w.id)
  const tabIds = base.windows.flatMap((w) => w.tabs.map((t) => t.id))
  const sessionIds = [...state.projects.flatMap((p) => p.members), 'loose']
  const projectIds = ['X', 'Y', 'Z', 'Q']
  const background = new Set(['xa', 'zb', 'xb', 'yb'])
  const over = <A, B>(as: readonly A[], bs: readonly B[]): [A, B][] =>
    as.flatMap((a) => bs.map((b): [A, B] => [a, b]))
  const reopened = (l: Layout) =>
    reopen(
      { ...state, windows: toSaved(l) },
      { reopenTabs: true, isFile: () => true, newId: ids('r') },
    )

  const cases: Record<string, () => unknown[]> = {
    holder: () => projectIds.map((p) => holder(base, p)),
    shownTab: () => base.windows.map(shownTab),
    stepTab: () => base.windows.flatMap((w) => [stepTab(w, 1), stepTab(w, -1)]),
    nthTab: () => base.windows.flatMap((w) => [1, 2, 3, 4].map((n) => nthTab(w, n))),
    switchProject: () =>
      over(windowIds, projectIds).map(([w, p]) => {
        const out = switchProject(base, w, p)
        return out.kind === 'shown' ? out.layout : null
      }),
    bringProject: () =>
      over(windowIds, projectIds).map(([w, p]) => {
        const out = bringProject(base, w, p, [], projectIds)
        return out.kind === 'brought' ? out.layout : null
      }),
    openSession: () =>
      over(windowIds, sessionIds).flatMap(([w, s]) => [
        openSession(base, state, w, s, ids('n')).layout,
        openSession(base, state, w, s, ids('n'), { pin: true }).layout,
        openSession(base, state, w, s, ids('n'), { worker: (id) => id.startsWith('w') }).layout,
      ]),
    openBeside: () =>
      over(windowIds, sessionIds).map(([w, s]) => {
        const out = openBeside(base, state, w, s)
        return out.kind === 'done' ? out.layout : null
      }),
    moveSessionHere: () =>
      over(windowIds, sessionIds).map(([w, s]) => {
        const out = moveSessionHere(base, state, w, s, ids('n'))
        return out.ok ? out.layout : null
      }),
    insertTabAfter: () =>
      tabIds.flatMap((t) => [
        insertTabAfter(base, t, session('new', 'X', ['n1'])),
        insertTabAfter(base, t, bgTab('newbg', 'X', 'n2')),
      ]),
    closeTab: () => over(windowIds, tabIds).map(([w, t]) => closeTab(base, w, t)),
    moveTab: () =>
      over(windowIds, tabIds).flatMap(([w, t]) => [
        moveTab(base, w, t, null),
        ...tabIds.map((before) => moveTab(base, w, t, before)),
      ]),
    select: () => over(windowIds, tabIds).map(([w, t]) => select(base, w, t)),
    pin: () => over(windowIds, tabIds).map(([w, t]) => pin(base, w, t)),
    toBackground: () => over(windowIds, tabIds).map(([w, t]) => toBackground(base, w, t)),
    ordinaryUnless: () => [
      ordinaryUnless(base, () => false),
      ordinaryUnless(base, () => true),
      ordinaryUnless(base, (t) => t.id === 'xa'),
    ],
    newWindowProject: () => [newWindowProject(base, state)],
    removeWindow: () => windowIds.map((w) => removeWindow(base, w)),
    setMaximized: () => windowIds.map((w) => setMaximized(base, w, true)),
    toSaved: () => [reopened(base)],
    reopen: () => [reopened(base), ...tabIds.map((t) => reopened(select(base, 'w1', t)))],
  }

  const isLayout = (x: unknown): x is Layout =>
    typeof x === 'object' && x !== null && Array.isArray((x as Layout).windows)
  const broken = (l: Layout): string[] =>
    l.windows.flatMap((w) => {
      const selectedBackground = Object.values(w.selected).filter((id) =>
        w.tabs.some((t) => t.id === id && t.kind === 'session' && t.place === 'background'),
      )
      const peeks = w.tabs.filter((t) => t.kind === 'session' && t.place === 'peek')
      const twoPeeks = peeks.filter((p, i) => peeks.findIndex((q) => q.project === p.project) !== i)
      return [
        ...selectedBackground.map((id) => `${w.id} selects background ${id}`),
        ...twoPeeks.map((p) => `${w.id} has a second peek in ${p.project}`),
      ]
    })

  test('every exported function has a case', () => {
    const exported = Object.entries(layoutModule)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
      .sort()
    expect(exported.length).toBeGreaterThanOrEqual(20)
    expect(Object.keys(cases).sort()).toEqual(exported)
  })

  test.each(Object.keys(cases))('%s', (name) => {
    const outcomes = cases[name]?.() ?? []
    expect(outcomes.length).toBeGreaterThan(0)
    for (const out of outcomes) {
      if (isLayout(out)) expect(broken(out)).toEqual([])
      if (typeof out === 'string') expect(background.has(out)).toBe(false)
    }
  })
})
