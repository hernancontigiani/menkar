// Decision 1.124: a project's folders, offered by Ctrl+` in the orchestrator's tab, the first-time
// card and the project's orchestration settings, and accepted by start_session's folder.
import { describe, expect, test } from 'vitest'
import {
  membersFolders,
  missingFolders,
  presentFolders,
  projectFolders,
  startFolder,
} from '../../../src/core/orchestration/folders'

// Decision 1.124: a project's folders are those of all its sessions, running or not, earlier
// conversations included, plus the ones the human added by hand.
describe("a project's folders", () => {
  test('every session counts once, stopped and earlier ones too; a missing cwd is skipped', () => {
    expect(projectFolders(['/a', null, '/b', undefined, '/a'], [])).toEqual([
      { path: '/a', added: false },
      { path: '/b', added: false },
    ])
  })

  test('added folders come after, marked; one a session already has is shown once, automatic', () => {
    expect(projectFolders(['/a'], ['/c', '/a'])).toEqual([
      { path: '/a', added: false },
      { path: '/c', added: true },
    ])
  })

  test('a trailing slash names the same folder', () => {
    expect(projectFolders(['/a/'], ['/a'])).toEqual([{ path: '/a', added: false }])
  })
})

// Decision 1.124: start_session's folder is one of the project's folders or nothing.
describe("start_session's folder", () => {
  const known = ['/repo/one', '/repo/two']

  test('without folder, the caller’s folder: null', () => {
    expect(startFolder(undefined, known)).toEqual({ folder: null })
  })

  test('one of the project’s folders is accepted, a trailing slash too', () => {
    expect(startFolder('/repo/two', known)).toEqual({ folder: '/repo/two' })
    expect(startFolder('/repo/two/', known)).toEqual({ folder: '/repo/two' })
  })

  test('a foreign folder is refused, naming the project’s folders', () => {
    const answer = startFolder('/elsewhere', known)
    expect(answer).toHaveProperty('refusal')
    const refusal = 'refusal' in answer ? answer.refusal : ''
    expect(refusal).toContain('/elsewhere')
    expect(refusal).toContain('/repo/one, /repo/two')
  })

  test('a relative path or a non-text value is refused', () => {
    for (const wrong of ['repo/one', '', 3, true])
      expect(startFolder(wrong, known)).toHaveProperty('refusal')
  })
})

describe("a project's folders from its members", () => {
  const session = (id: string, cwd: string | null) => ({ id, cwd })

  test('by path; a member with no transcript yet takes its pane’s folder; non-members are not counted', () => {
    const sessions = [
      session('b', '/repo/b'),
      session('a', '/repo/a'),
      session('none', null),
      session('stranger', '/stranger'),
    ]
    expect(
      membersFolders(['b', 'a', 'none', 'fresh'], sessions, new Map([['fresh', '/repo/c']]), [
        '/added',
      ]).map((f) => f.path),
    ).toEqual(['/repo/a', '/repo/b', '/repo/c', '/added'])
  })
})

// A folder gone from disk is not offered where a session or a shell would start in it; the
// project's settings still list it, marked, so the human sees why.
describe('folders that no longer exist on disk', () => {
  const folders = projectFolders(['/repo/a', '/repo/gone'], ['/added/gone', '/added/ok'])

  test('missingFolders asks the disk once per folder and keeps the order', async () => {
    const asked: string[] = []
    const exists = async (path: string) => {
      asked.push(path)
      return !path.endsWith('/gone')
    }
    expect(await missingFolders(folders, exists)).toEqual(['/repo/gone', '/added/gone'])
    expect(asked).toEqual(['/repo/a', '/repo/gone', '/added/gone', '/added/ok'])
  })

  test('Ctrl+` and the card get only the present ones', () => {
    expect(presentFolders(folders, ['/repo/gone', '/added/gone'])).toEqual(['/repo/a', '/added/ok'])
  })
})
