// Vitest's transform reads the nearest tsconfig.json of each file it compiles unless one is named,
// and `site/tsconfig.json` extends a package installed only under `site/node_modules`: a root test
// importing a `site/scripts/*.ts` file then fails wherever the site's packages are not installed.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { expect, test } from 'vitest'
import config from '../../vitest.config'

const ROOT = join(__dirname, '..', '..')

test("Vitest compiles with a named tsconfig whose chain stays in the repository's own files", () => {
  expect(config.tsconfig, "vitest.config.ts's tsconfig").toBeTypeOf('string')
  let file: string | undefined = resolve(ROOT, config.tsconfig ?? '')
  let read = 0
  while (file !== undefined) {
    read++
    expect(existsSync(file), file).toBe(true)
    expect(relative(ROOT, file).startsWith('..'), `${file} is outside the repository`).toBe(false)
    expect(relative(ROOT, file).split(/[\\/]/), file).not.toContain('node_modules')
    const extended: string | undefined = (
      JSON.parse(readFileSync(file, 'utf8')) as { extends?: string }
    ).extends
    if (extended !== undefined)
      expect(extended.startsWith('.'), `${file} extends the package ${extended}`).toBe(true)
    file = extended === undefined ? undefined : resolve(dirname(file), extended)
  }
  expect(read).toBeGreaterThan(0)
})
