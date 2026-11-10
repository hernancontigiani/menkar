// The project switcher (decision 1.38): which projects it lists and in what order.

import type { ActiveProject } from './info'
import { holder, type Layout } from './layout'
import type { Projects } from './model'

// The projects in use: the one this window shows, then those with a tab open in any window, the
// most recently used first; any never used yet follow in the windows' order.
export function activeProjects(
  layout: Layout,
  projects: Projects,
  recent: readonly string[],
  windowId: string,
): ActiveProject[] {
  const shown = layout.windows.find((w) => w.id === windowId)?.shown
  const ids: string[] = shown ? [shown] : []
  for (const w of layout.windows)
    for (const tab of w.tabs) if (!ids.includes(tab.project)) ids.push(tab.project)
  const rank = (id: string) => {
    const i = recent.indexOf(id)
    return i < 0 ? recent.length + ids.indexOf(id) : i
  }
  // The shown one first, whatever came before: the list starts on the one before it.
  return ids
    .filter((id) => projects.projects.some((p) => p.id === id))
    .sort((a, b) => (a === shown ? -1 : b === shown ? 1 : rank(a) - rank(b)))
    .map((id) => {
      const window = holder(layout, id) ?? windowId
      return {
        id,
        name: projects.projects.find((p) => p.id === id)?.name ?? '',
        window,
        tabs: layout.windows.reduce((n, w) => n + w.tabs.filter((t) => t.project === id).length, 0),
        here: window === windowId,
      }
    })
}

// The recent list once a project is used: it goes first, once.
export function touched(recent: readonly string[], projectId: string): string[] {
  return [projectId, ...recent.filter((id) => id !== projectId)]
}
