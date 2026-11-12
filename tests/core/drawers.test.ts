// Decision 1.29: each tab can open a shell under its panes (the drawer), toggled with Ctrl+`. It is
// never a tab or a pane; it lives until its shell exits or its tab closes.
import { describe, expect, test } from 'vitest'
import { DrawerRegistry, drawerFolder } from '../../src/core/drawers'

describe('the folder a drawer opens in', () => {
  const agent = (id: string, cwd: string | null) => ({ id, agent: true, cwd })
  const shell = (id: string, cwd: string | null) => ({ id, agent: false, cwd })

  test("the focused agent pane's folder, the one Claude Code was started in", () => {
    expect(drawerFolder([agent('a', '/work/api'), agent('b', '/work/web')], 'b', null)).toBe(
      '/work/web',
    )
  })

  test('with a shell pane focused in a split, the agent beside it', () => {
    expect(drawerFolder([shell('s', '/tmp'), agent('a', '/work/api')], 's', null)).toBe('/work/api')
  })

  test("a tab with no agent uses the tab's own folder: its shell's, else the one given", () => {
    expect(drawerFolder([shell('s', '/work/notes')], 's', null)).toBe('/work/notes')
    expect(drawerFolder([], null, '/work/chat')).toBe('/work/chat')
    expect(drawerFolder([], null, null)).toBeNull()
  })

  test('an agent pane with no known folder falls through to the next one that has one', () => {
    expect(drawerFolder([agent('a', null), shell('s', '/work/x')], 'a', null)).toBe('/work/x')
  })
})

class Shell {
  hungUp = 0
  hangUp(): void {
    this.hungUp += 1
  }
}

function registry() {
  let n = 0
  return new DrawerRegistry<Shell>(() => {
    n += 1
    return `drawer-${n}`
  })
}

describe('the drawers of the tabs', () => {
  test('opening twice keeps the same shell: hiding never ends it', () => {
    const drawers = registry()
    const first = drawers.open('tab-1', () => new Shell())
    const again = drawers.open('tab-1', () => new Shell())
    expect(again.id).toBe(first.id)
    expect(again.shell).toBe(first.shell)
    expect(first.fresh).toBe(true)
    expect(again.fresh).toBe(false)
    expect(drawers.byId(first.id)).toBe(first.shell)
  })

  test('one drawer per tab, each its own shell', () => {
    const drawers = registry()
    const a = drawers.open('tab-1', () => new Shell())
    const b = drawers.open('tab-2', () => new Shell())
    expect(a.id).not.toBe(b.id)
    expect(drawers.ofTab('tab-2')).toBe(b.id)
  })

  test('a shell that exits closes its drawer; the next open starts a fresh one', () => {
    const drawers = registry()
    const first = drawers.open('tab-1', () => new Shell())
    expect(drawers.exited(first.id)).toBe('tab-1')
    expect(drawers.ofTab('tab-1')).toBeUndefined()
    const next = drawers.open('tab-1', () => new Shell())
    expect(next.fresh).toBe(true)
    expect(next.id).not.toBe(first.id)
  })

  test("a late exit of an old shell leaves the tab's new drawer alone", () => {
    const drawers = registry()
    const old = drawers.open('tab-1', () => new Shell())
    drawers.closeTab('tab-1')
    const fresh = drawers.open('tab-1', () => new Shell())
    expect(drawers.exited(old.id)).toBeUndefined()
    expect(drawers.ofTab('tab-1')).toBe(fresh.id)
  })

  // Decision 1.93: in the orchestrator's tab each folder picked keeps its own shell.
  test('one shell per folder picked: pick /b, hide, pick /a → two live, /a current; pick /b → the same /b shell; closing the tab hangs up both', () => {
    const drawers = registry()
    const b = drawers.open('tab-1', () => new Shell(), '/b')
    const a = drawers.open('tab-1', () => new Shell(), '/a')
    expect(a.id).not.toBe(b.id)
    expect(a.fresh).toBe(true)
    expect(drawers.ofTab('tab-1')).toBe(a.id)
    expect(drawers.byId(b.id)).toBe(b.shell)
    const again = drawers.open('tab-1', () => new Shell(), '/b')
    expect([again.id, again.shell, again.fresh]).toEqual([b.id, b.shell, false])
    expect(drawers.ofTab('tab-1')).toBe(b.id)
    // Without a folder, the tab's current drawer, as an ordinary toggle shows it.
    expect(drawers.open('tab-1', () => new Shell()).id).toBe(b.id)
    expect(drawers.idsOf('tab-1')).toEqual([b.id, a.id])
    drawers.closeTab('tab-1')
    expect([a.shell.hungUp, b.shell.hungUp]).toEqual([1, 1])
    expect(drawers.ofTab('tab-1')).toBeUndefined()
  })

  test('a hidden folder shell that exits leaves the current drawer alone', () => {
    const drawers = registry()
    const b = drawers.open('tab-1', () => new Shell(), '/b')
    const a = drawers.open('tab-1', () => new Shell(), '/a')
    expect(drawers.exited(b.id)).toBeUndefined()
    expect(drawers.ofTab('tab-1')).toBe(a.id)
    expect(drawers.exited(a.id)).toBe('tab-1')
    expect(drawers.ofTab('tab-1')).toBeUndefined()
  })

  test('closing a tab hangs up its drawer only; quitting hangs up every one, once', () => {
    const drawers = registry()
    const a = drawers.open('tab-1', () => new Shell())
    const b = drawers.open('tab-2', () => new Shell())
    drawers.closeTab('tab-1')
    expect([a.shell.hungUp, b.shell.hungUp]).toEqual([1, 0])
    expect(drawers.byId(a.id)).toBeUndefined()
    drawers.closeAll()
    drawers.closeAll()
    expect([a.shell.hungUp, b.shell.hungUp]).toEqual([1, 1])
    expect(drawers.ofTab('tab-2')).toBeUndefined()
  })
})
