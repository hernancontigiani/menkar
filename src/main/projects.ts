import { keptEarlier } from '../core/projects/earlier'
import type { Notice, ProjectsSnapshot } from '../core/projects/info'
import type { Projects } from '../core/projects/model'
import { orchestrationInfo } from '../core/projects/orchestration'
import { keptParents } from '../core/projects/parents'
import { loadProjects } from '../core/projects/store'

let projects: Projects | undefined
let notices: Notice[] = []

export async function startProjects(): Promise<void> {
  const loaded = await loadProjects()
  projects = loaded.projects
  if (loaded.movedTo !== null)
    notices.push({ key: 'projects.fileUnreadable', params: { name: loaded.movedTo } })
}

export function currentProjects(): Projects | undefined {
  return projects
}

export function setProjects(next: Projects): void {
  projects = next
}

export function addNotice(notice: Notice): void {
  notices.push(notice)
}

export function currentNotices(): Notice[] {
  return notices
}

export function dismissNotice(index: number): void {
  notices = notices.filter((_, i) => i !== index)
}

export function projectsSnapshot(): ProjectsSnapshot {
  const state = projects
  if (!state) return { current: '', projects: [], notices }
  return {
    current: state.current,
    projects: state.projects.map((p) => ({
      id: p.id,
      name: p.name,
      members: p.members,
      hidden: p.hidden ?? [],
      groups: p.groups,
      earlier: keptEarlier(p),
      parents: keptParents(p),
      orchestration: orchestrationInfo(p),
      topicsCollapsed: p.topicsCollapsed === true,
    })),
    notices,
  }
}
