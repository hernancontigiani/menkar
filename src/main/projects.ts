import { log } from '../core/log'
import { firstStartImport } from '../core/projects/import'
import type { Notice, ProjectsSnapshot } from '../core/projects/info'
import type { Projects } from '../core/projects/model'
import { loadProjects } from '../core/projects/store'

let projects: Projects | undefined
let notices: Notice[] = []

// Before the first window and before the sessions' first scan (which reads state.json): the import
// decides whether this is a first start by Menkar's files being absent.
export async function startProjects(): Promise<void> {
  try {
    const imported = await firstStartImport()
    notices = imported.notices.map((key) => ({ key }))
  } catch (error) {
    log.error("agent-tablet's data could not be imported", { error })
  }
  const loaded = await loadProjects()
  projects = loaded.projects
  if (loaded.movedTo !== null)
    notices.push({ key: 'projects.fileUnreadable', params: { name: loaded.movedTo } })
}

export function projectsSnapshot(): ProjectsSnapshot {
  const state = projects
  if (!state) return { current: '', projects: [], notices }
  return {
    current: state.current,
    projects: state.projects.map(({ id, name, members, groups }) => ({
      id,
      name,
      members,
      groups,
    })),
    notices,
  }
}
