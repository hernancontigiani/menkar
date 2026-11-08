import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { readJson, writeJson } from '../../src/core/jsonstate'
import { addSink } from '../../src/core/log'

const dir = () => mkdtemp(join(process.env.MENKAR_TEST_ROOT ?? '', 'state-'))
type State = { a: number } & Record<string, unknown>
const parse = (value: unknown): State => {
  const object = typeof value === 'object' && value !== null ? value : {}
  const a = 'a' in object && typeof object.a === 'number' ? object.a : 0
  return { ...object, a }
}
const fallback = (): State => ({ a: 0 })

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('jsonstate', () => {
  test('a write interrupted after the temporary file leaves the old file intact', async () => {
    const path = join(await dir(), 'state.json')
    await writeJson(path, { a: 1 })
    const before = await readFile(path)
    const crash = { rename: () => Promise.reject(new Error('simulated crash before rename')) }
    await expect(writeJson(path, { a: 2 }, crash)).rejects.toThrow('simulated crash')
    expect(await readFile(path)).toEqual(before)
    expect(await readdir(join(path, '..'))).toEqual(['state.json'])
  })

  test('a broken state file is moved aside with its bytes, a warning logged, the default returned', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 8, 23, 59, 30))
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const lines: string[] = []
    const remove = addSink((line) => lines.push(line))
    try {
      const folder = await dir()
      const path = join(folder, 'state.json')
      const garbage = Buffer.from([0x7b, 0x22, 0x61, 0xff, 0x00, 0x0a])
      await writeFile(path, garbage)
      expect(await readJson(path, parse, fallback)).toEqual({ a: 0 })
      const broken = join(folder, 'state.json.broken-20261108-235930')
      expect(await readFile(broken)).toEqual(garbage)
      expect(await readdir(folder)).toEqual(['state.json.broken-20261108-235930'])
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain('WARNING state file is not JSON; moved aside')
      expect(lines[0]).toContain(`movedTo=${broken}`)

      await writeFile(path, garbage)
      await readJson(path, parse, fallback)
      expect((await readdir(folder)).sort()).toEqual([
        'state.json.broken-20261108-235930',
        'state.json.broken-20261108-235930-2',
      ])
    } finally {
      remove()
    }
  })

  test('unknown keys survive a read-modify-write', async () => {
    const path = join(await dir(), 'state.json')
    await writeFile(path, JSON.stringify({ a: 1, x: { from: 'a newer version' } }))
    const state = await readJson(path, parse, fallback)
    await writeJson(path, { ...state, a: 2 })
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      a: 2,
      x: { from: 'a newer version' },
    })
  })

  test('a missing file gives the default without creating anything', async () => {
    const folder = await dir()
    expect(await readJson(join(folder, 'state.json'), parse, fallback)).toEqual({ a: 0 })
    expect(await readdir(folder)).toEqual([])
  })

  test('writes to one path land in call order', async () => {
    const path = join(await dir(), 'state.json')
    await Promise.all([1, 2, 3, 4, 5].map((a) => writeJson(path, { a })))
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ a: 5 })
  })
})
