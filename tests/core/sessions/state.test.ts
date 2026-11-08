import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  loadState,
  parseState,
  saveState,
  setAppName,
  setHidden,
  statePath,
} from '../../../src/core/state'

describe("Menkar's state.json, the sessions' keys", () => {
  test('SES-17 a name is trimmed when set', () => {
    expect(setAppName(parseState({}), 's1', '  Payments  ').names).toEqual({ s1: 'Payments' })
  })

  test('SES-18 an empty name removes the key', () => {
    const named = setAppName(parseState({}), 's1', 'Payments')
    expect(setAppName(named, 's1', '   ').names).toEqual({})
  })

  test('SES-62 hiding adds the id, kept sorted and once; unhiding removes it', () => {
    let state = setHidden(parseState({}), ['s3', 's1'], true)
    state = setHidden(state, ['s1', 's2'], true)
    expect(state.hidden).toEqual(['s1', 's2', 's3'])
    expect(setHidden(state, ['s2'], false).hidden).toEqual(['s1', 's3'])
  })

  test('wrong-typed values take the defaults, and keys this area does not know survive', () => {
    const state = parseState({
      names: { s1: 'A', s2: 3, s3: '  ' },
      hidden: ['s1', 4],
      settings: { font: 'Mono' },
      x: 1,
    })
    expect(state.names).toEqual({ s1: 'A' })
    expect(state.hidden).toEqual(['s1'])
    expect(state.rest).toEqual({ settings: { font: 'Mono' }, x: 1 })
    expect(parseState([1, 2])).toEqual({ names: {}, hidden: [], rest: {} })
  })

  test('saved and loaded through the config directory, other keys intact', async () => {
    const path = statePath()
    expect(path).toBe(join(process.env.MENKAR_TEST_ROOT ?? '', 'config', 'menkar', 'state.json'))
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, JSON.stringify({ settings: { scrollback: 5000 }, hidden: ['b'] }))
    const loaded = await loadState()
    await saveState(setHidden(loaded, ['a'], true))
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      settings: { scrollback: 5000 },
      names: {},
      hidden: ['a', 'b'],
    })
  })
})
