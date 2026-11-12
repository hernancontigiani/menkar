// Decision 1.95: "Ask an agent" on a Markdown tab starts a new session named after the file,
// unique among the project's sessions with a tab.
import { describe, expect, test } from 'vitest'
import { askName } from '../../../src/core/files/ask'

describe('the name of a session asked about a file', () => {
  test('"about <file name>", then " 2", " 3"… while the name is taken', () => {
    expect(askName('notes.md', new Set())).toBe('about notes.md')
    expect(askName('notes.md', new Set(['about notes.md']))).toBe('about notes.md 2')
    expect(askName('notes.md', new Set(['about notes.md', 'about notes.md 2']))).toBe(
      'about notes.md 3',
    )
    expect(askName('notes.md', new Set(['about notes.md 2']))).toBe('about notes.md')
  })
})
