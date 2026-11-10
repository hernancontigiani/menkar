import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { addSink, formatRecord, log, openFileSink } from '../../src/core/log'
import { logFile } from '../../src/core/paths'

const at = Date.UTC(2026, 10, 9, 2, 59, 30, 5)

function capture(): string[] {
  const lines: string[] = []
  const remove = addSink((line) => lines.push(line))
  removers.push(remove)
  return lines
}
const removers: Array<() => void> = []

afterEach(() => {
  for (const remove of removers.splice(0)) remove()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('log', () => {
  test('a record is local time, level and message, with the identifiers as fields apart', () => {
    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires')
    expect(
      formatRecord(at, 'warning', 'state file is not JSON', {
        path: '/tmp/a b/state.json',
        session: 'f3a9',
        count: 3,
        error: new Error('Unexpected token'),
      }),
    ).toBe(
      '2026-11-08T23:59:30.005-03:00 WARNING state file is not JSON path="/tmp/a b/state.json" session=f3a9 count=3 error="Error: Unexpected token"',
    )
  })

  test('notices, warnings and errors are written by default; info and debug only when MENKAR_LOG asks', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const lines = capture()
    log.debug('d')
    log.info('i')
    log.notice('n')
    log.warn('w')
    log.error('e')
    expect(lines.map((l) => l.split(' ')[1])).toEqual(['NOTICE', 'WARNING', 'ERROR'])
    vi.stubEnv('MENKAR_LOG', 'debug')
    log.debug('d')
    expect(lines.at(-1)).toMatch(/ DEBUG d$/)
  })

  test("the log file of a test lands under the temporary directory, never the developer's", () => {
    expect(logFile()).toBe(
      join(process.env.MENKAR_TEST_ROOT ?? '', 'cache', 'menkar', 'menkar.log'),
    )
  })

  test('the log file rotates to .1 when it would pass its size', async () => {
    const path = join(process.env.MENKAR_TEST_ROOT ?? '', 'rotate', 'menkar.log')
    const file = await openFileSink(path, 30)
    file.sink('first record, 21 b')
    file.sink('second record, 22 b')
    file.sink('third')
    await file.close()
    expect(await readFile(`${path}.1`, 'utf8')).toBe('first record, 21 b\n')
    expect(await readFile(path, 'utf8')).toBe('second record, 22 b\nthird\n')
  })
})
