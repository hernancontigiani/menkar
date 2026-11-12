// The drawer: a shell a tab opens under its panes and hides again with the same key. It is never a
// tab or a pane, so nothing about it is saved; it lives until its shell exits or its tab closes.

export interface DrawerPane {
  readonly id: string
  readonly agent: boolean
  readonly cwd: string | null
}

// The folder a tab's drawer starts in: where the focused agent was started, else another agent of
// the tab, else the tab's shell, else the folder given for a tab with no pane (a chat's). Null
// lets the shell start in the home folder.
export function drawerFolder(
  panes: readonly DrawerPane[],
  focused: string | null,
  tabFolder: string | null,
): string | null {
  const focusedPane = panes.find((p) => p.id === focused)
  const order = [
    ...(focusedPane?.agent ? [focusedPane] : []),
    ...panes.filter((p) => p.agent),
    ...(focusedPane ? [focusedPane] : []),
    ...panes,
  ]
  return order.find((p) => p.cwd !== null)?.cwd ?? tabFolder
}

export interface HangsUp {
  hangUp(): void
}

// One drawer per tab, by tab id, each with an id of its own that the terminal channels carry. In
// the orchestrator's tab each folder picked keeps a shell of its own (decision 1.93): the tab
// shows one at a time, its current one, and the others stay alive, hidden.
interface Drawer<S> {
  readonly id: string
  readonly shell: S
}

export class DrawerRegistry<S extends HangsUp> {
  readonly #byTab = new Map<string, { current: string; byFolder: Map<string, Drawer<S>> }>()

  constructor(private readonly newId: () => string) {}

  // The tab's drawer for `folder`, started when it has none, made the tab's current one; without
  // a folder, the tab's current drawer. `fresh` says whether it was just started.
  open(tabId: string, start: () => S, folder?: string): { id: string; shell: S; fresh: boolean } {
    const tab = this.#byTab.get(tabId) ?? { current: '', byFolder: new Map<string, Drawer<S>>() }
    this.#byTab.set(tabId, tab)
    const key = folder ?? (tab.byFolder.has(tab.current) ? tab.current : '')
    tab.current = key
    const found = tab.byFolder.get(key)
    if (found) return { ...found, fresh: false }
    const drawer = { id: this.newId(), shell: start() }
    tab.byFolder.set(key, drawer)
    return { ...drawer, fresh: true }
  }

  // The tab's current drawer.
  ofTab(tabId: string): string | undefined {
    const tab = this.#byTab.get(tabId)
    return tab?.byFolder.get(tab.current)?.id
  }

  // Every drawer of the tab, the hidden folder shells too.
  idsOf(tabId: string): string[] {
    return [...(this.#byTab.get(tabId)?.byFolder.values() ?? [])].map((d) => d.id)
  }

  byId(id: string): S | undefined {
    for (const tab of this.#byTab.values())
      for (const drawer of tab.byFolder.values()) if (drawer.id === id) return drawer.shell
    return undefined
  }

  // Its shell ended: the drawer closes for real. The tab it belonged to, when it was that tab's
  // current drawer.
  exited(id: string): string | undefined {
    for (const [tabId, tab] of this.#byTab)
      for (const [key, drawer] of tab.byFolder) {
        if (drawer.id !== id) continue
        tab.byFolder.delete(key)
        if (tab.byFolder.size === 0) this.#byTab.delete(tabId)
        return key === tab.current ? tabId : undefined
      }
    return undefined
  }

  // The tab closed: its shells are hung up, as closing a terminal does.
  closeTab(tabId: string): void {
    const tab = this.#byTab.get(tabId)
    if (!tab) return
    this.#byTab.delete(tabId)
    for (const drawer of tab.byFolder.values()) drawer.shell.hangUp()
  }

  closeAll(): void {
    for (const tabId of [...this.#byTab.keys()]) this.closeTab(tabId)
  }
}
