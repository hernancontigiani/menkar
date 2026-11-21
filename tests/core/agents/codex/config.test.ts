// What Menkar reads of the user's Codex config.toml to pass it on: its `notify` and its
// `developer_instructions`, from the base file only (codex-cli 0.169.0 refuses a top-level
// `profile`), and nothing at all from a file it cannot parse.
import { copyFile, mkdir, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { codexHome, readUserConfig, tomlString } from '../../../../src/core/agents/codex/config'
import { addSink } from '../../../../src/core/log'

const CONFIGS = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'codex', 'config')

// A Codex home whose config.toml is the named fixture, or has none.
async function homeWith(fixture: string | null): Promise<string> {
  const home = await mkdtemp(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-home-'))
  if (fixture) await copyFile(join(CONFIGS, fixture), join(home, 'config.toml'))
  return home
}

// What was logged while `run` ran.
async function logged<T>(run: () => Promise<T>): Promise<{ value: T; lines: string[] }> {
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  const lines: string[] = []
  const remove = addSink((line) => lines.push(line))
  try {
    return { value: await run(), lines }
  } finally {
    remove()
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("the user's config.toml", () => {
  test('its notify and developer instructions are read as written', async () => {
    expect(await readUserConfig(await homeWith('plain.toml'))).toEqual({
      notify: ['/home/ana/bin/notify-me', '--sound', "it's done"],
      developerInstructions: '  Answer in English.\nKeep "quotes" and $HOME as written.\n',
    })
  })

  test('a file with a top-level profile, which Codex refuses, gives nothing to chain', async () => {
    const { value, lines } = await logged(async () =>
      readUserConfig(await homeWith('profile.toml')),
    )
    expect(value).toEqual({ notify: null, developerInstructions: null })
    expect(lines.join('\n')).toContain('top-level profile')
  })

  test('a file that does not parse gives nothing to chain, and says so once', async () => {
    const { value, lines } = await logged(async () =>
      readUserConfig(await homeWith('unparsable.toml')),
    )
    expect(value).toEqual({ notify: null, developerInstructions: null })
    expect(lines.filter((line) => line.includes('does not parse'))).toHaveLength(1)
  })

  test('values of a type Codex would refuse are not passed on', async () => {
    expect(await readUserConfig(await homeWith('types.toml'))).toEqual({
      notify: null,
      developerInstructions: null,
    })
  })

  test('no file is nothing to chain, silently', async () => {
    const { value, lines } = await logged(async () => readUserConfig(await homeWith(null)))
    expect(value).toEqual({ notify: null, developerInstructions: null })
    expect(lines).toEqual([])
  })

  test('the home is CODEX_HOME when set, else ~/.codex, read when called', async () => {
    vi.stubEnv('HOME', '/home/ana')
    vi.stubEnv('CODEX_HOME', '')
    expect(codexHome()).toBe('/home/ana/.codex')
    const home = await homeWith('plain.toml')
    vi.stubEnv('CODEX_HOME', home)
    expect(codexHome()).toBe(home)
    expect((await readUserConfig()).notify).toEqual([
      '/home/ana/bin/notify-me',
      '--sound',
      "it's done",
    ])
  })

  test('a config.toml that cannot be read is nothing to chain, and is logged', async () => {
    const home = await homeWith(null)
    await mkdir(join(home, 'config.toml'))
    const { value, lines } = await logged(() => readUserConfig(home))
    expect(value).toEqual({ notify: null, developerInstructions: null })
    expect(lines.join('\n')).toContain('could not be read')
  })
})

describe('a text as a TOML value for `-c`', () => {
  test.each([
    ['edge spaces and quotes', '  "MK1" line one\n\'two\'  '],
    ['what TOML would read as another type', '42'],
    ['a boolean', 'true'],
    ['an array', '[x]'],
    ['escapes and controls', 'a\\b\tc\u007f\u0001$HOME `x` $(y)'],
    ['non-ASCII', 'Ñandú 🦤 ✳'],
  ])('%s comes back byte for byte', (_, text) => {
    expect(parse(`v = ${tomlString(text)}`).v).toBe(text)
  })

  test('a lone surrogate, which TOML cannot hold, is replaced and the rest kept', () => {
    expect(parse(`v = ${tomlString('a\uD800b\uDC00c🦤')}`).v).toBe('a�b�c🦤')
  })
})
