import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const read = (name: string) => readFileSync(join(ROOT, name), 'utf8')

describe("the repository's rules file", () => {
  test('CLAUDE.md only loads AGENTS.md, so the rules are read once by every agent', () => {
    expect(read('CLAUDE.md')).toBe('@AGENTS.md\n')
  })

  test('AGENTS.md stays under 300 lines', () => {
    expect(read('AGENTS.md').trimEnd().split('\n').length).toBeLessThan(300)
  })
})
