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

// One drawer per tab, by tab id, each with an id of its own that the terminal channels carry.
export class DrawerRegistry<S extends HangsUp> {
  readonly #byTab = new Map<string, { id: string; shell: S }>()

  constructor(private readonly newId: () => string) {}

  // The tab's drawer, started when it has none; `fresh` says whether it was just started.
  open(tabId: string, start: () => S): { id: string; shell: S; fresh: boolean } {
    const found = this.#byTab.get(tabId)
    if (found) return { ...found, fresh: false }
    const drawer = { id: this.newId(), shell: start() }
    this.#byTab.set(tabId, drawer)
    return { ...drawer, fresh: true }
  }

  ofTab(tabId: string): string | undefined {
    return this.#byTab.get(tabId)?.id
  }

  byId(id: string): S | undefined {
    for (const drawer of this.#byTab.values()) if (drawer.id === id) return drawer.shell
    return undefined
  }

  // Its shell ended: the drawer closes for real. The tab it belonged to, if it still was its own.
  exited(id: string): string | undefined {
    for (const [tabId, drawer] of this.#byTab) {
      if (drawer.id !== id) continue
      this.#byTab.delete(tabId)
      return tabId
    }
    return undefined
  }

  // The tab closed: its shell is hung up, as closing a terminal does.
  closeTab(tabId: string): void {
    const drawer = this.#byTab.get(tabId)
    if (!drawer) return
    this.#byTab.delete(tabId)
    drawer.shell.hangUp()
  }

  closeAll(): void {
    for (const tabId of [...this.#byTab.keys()]) this.closeTab(tabId)
  }
}
