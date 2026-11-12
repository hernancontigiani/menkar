// Ctrl+` in the orchestrator's tab (decision 1.78): the folders the team works in, each once, in
// the order the panes come; with one, the drawer opens there at once, as it always did.
import { describe, expect, test } from 'vitest'
import { teamFolders } from '../../../src/core/orchestration/folders'

const pane = (cwd: string, running = true) => ({ cwd, running })

describe("the folders Ctrl+` offers in the orchestrator's tab", () => {
  test('panes in /a, /b, /a → [/a, /b]', () => {
    expect(teamFolders([pane('/a'), pane('/b'), pane('/a')])).toEqual(['/a', '/b'])
  })

  test('one folder, however many panes → one, so no list', () => {
    expect(teamFolders([pane('/a'), pane('/a')])).toEqual(['/a'])
  })

  test('a pane whose agent is not running is not counted', () => {
    expect(teamFolders([pane('/a'), pane('/b', false)])).toEqual(['/a'])
  })
})
