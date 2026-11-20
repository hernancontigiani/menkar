import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const SITE = join(__dirname, '..', '..', 'site')

describe("the site's rules file", () => {
  test('site/CLAUDE.md only loads site/AGENTS.md, so the tone guide is read once by every agent', () => {
    expect(readFileSync(join(SITE, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n')
  })
})
