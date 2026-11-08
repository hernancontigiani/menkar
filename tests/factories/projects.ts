import type { Group, Project, Projects } from '../../src/core/projects/model'

export function project(
  id: string,
  name: string,
  members: string[] = [],
  groups: Group[] = [],
): Project {
  return { id, name, members, groups, rest: {} }
}

export function group(name: string, members: string[], color = '#5ec4b6'): Group {
  return { name, color, members }
}

export function projects(list: Project[], current = list[0]?.id ?? ''): Projects {
  return { current, projects: list, windows: [], rest: {} }
}

// Deterministic ids for what a test creates: p1, p2, … or w1, t1, …
export function ids(prefix: string): () => string {
  let n = 0
  return () => {
    n += 1
    return `${prefix}${n}`
  }
}
