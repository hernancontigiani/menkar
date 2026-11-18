// Which session a task waits on, when its wait names one: the id is stored, never the name typed.
import { describe, expect, test } from 'vitest'
import { sessionIdByName } from '../../../src/core/activity/names'

const projects = {
  projects: [
    { id: 'p1', members: ['old', 'new', 'other'] },
    { id: 'p2', members: ['elsewhere'] },
  ],
}

const sessions = [
  { id: 'old', name: 'reviewer', mtimeMs: 1000 },
  { id: 'new', name: 'reviewer', mtimeMs: 2000 },
  { id: 'other', name: 'writer', mtimeMs: 3000 },
  { id: 'elsewhere', name: 'fabric', mtimeMs: 4000 },
  { id: 'loose', name: 'loner', mtimeMs: 5000 },
]

describe('a waited-on session by its name', () => {
  test('a renewed session keeps its name under a new id: the newest of the project wins', () => {
    expect(sessionIdByName(sessions, projects)('p1', 'reviewer')).toBe('new')
    expect(sessionIdByName([...sessions].reverse(), projects)('p1', 'reviewer')).toBe('new')
  })

  test('only the task’s project’s members are looked at', () => {
    expect(sessionIdByName(sessions, projects)('p1', 'fabric')).toBeUndefined()
    expect(sessionIdByName(sessions, projects)('p2', 'fabric')).toBe('elsewhere')
    expect(sessionIdByName(sessions, projects)('p1', 'loner')).toBeUndefined()
  })

  test('the name must be exact', () => {
    expect(sessionIdByName(sessions, projects)('p1', 'Reviewer')).toBeUndefined()
    expect(sessionIdByName(sessions, projects)('p1', 'reviewer ')).toBeUndefined()
  })

  test('an unknown project, or no projects read yet, names nobody', () => {
    expect(sessionIdByName(sessions, projects)('p9', 'reviewer')).toBeUndefined()
    expect(sessionIdByName(sessions, undefined)('p1', 'reviewer')).toBeUndefined()
  })
})
