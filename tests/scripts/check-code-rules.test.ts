import { describe, expect, test } from 'vitest'
import { findViolations } from '../../scripts/check-code-rules.mjs'

const rules = (file: string, source: string) => findViolations(file, source).map((v) => v.rule)

describe('check-code-rules', () => {
  test.each([
    ["import { app } from 'electron'", 'core-imports-electron'],
    ["import type { BrowserWindow } from 'electron'", 'core-imports-electron'],
    ["export { ipcMain } from 'electron'", 'core-imports-electron'],
    ["const e = await import('electron')", 'core-imports-electron'],
    ["const e = require('electron/main')", 'core-imports-electron'],
    ["import { x } from '../main/window'", 'core-imports-outside'],
  ])('src/core cannot reach Electron or the other layers: %s', (source, rule) => {
    expect(rules('src/core/sessions.ts', source)).toEqual([rule])
  })

  test('the main process may import electron, and core may import node builtins and itself', () => {
    expect(rules('src/main/index.ts', "import { app } from 'electron'")).toEqual([])
    expect(
      rules('src/core/a.ts', "import { join } from 'node:path'\nimport { now } from './clock'"),
    ).toEqual([])
  })

  test.each([
    'const t = Date.now()',
    'const t = globalThis.Date.now()',
    'const d = new Date()',
    'const d = new Date',
  ])('time is read only through the clock: %s', (source) => {
    expect(rules('src/core/usage.ts', source)).toEqual(['time-outside-clock'])
    expect(rules('tests/core/usage.test.ts', source)).toEqual(['time-outside-clock'])
    expect(rules('src/core/clock.ts', source)).toEqual([])
  })

  test('a date built from a value, or the words in a comment or string, is not reading the time', () => {
    const source = "const d = new Date(0)\n// Date.now() here is prose\nconst s = 'new Date()'"
    expect(rules('src/core/usage.ts', source)).toEqual([])
  })

  test('`any` needs a line-scoped reason', () => {
    expect(rules('src/main/a.ts', 'let x: any')).toEqual(['no-any'])
    expect(rules('src/main/a.ts', 'let x: unknown[] = [] as any[]')).toEqual(['no-any'])
    const justified =
      '// biome-ignore lint/suspicious/noExplicitAny: the library types this as any\nlet x: any'
    expect(rules('src/main/a.ts', justified)).toEqual([])
  })

  test.each([
    ['src/core/sessions.ts', "console.log('x')"],
    ['src/main/index.ts', 'console.error(error)'],
    ['src/renderer/main.ts', 'const warn = console.warn'],
    ['tests/core/a.test.ts', 'console.info(1)'],
  ])('logging goes through the one module: %s', (file, source) => {
    expect(rules(file, source)).toEqual(['console-outside-log'])
  })

  test('the logging module itself may write, and a word in a string is not a call', () => {
    expect(rules('src/core/log.ts', "console.error('x')")).toEqual([])
    expect(rules('src/core/a.ts', "const s = 'console.log(1)'")).toEqual([])
  })
})
