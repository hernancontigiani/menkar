// Decision 1.27: `menkar` started from a terminal gives the terminal back at once, as VS Code's
// `code` does; the commands that print stay in the foreground.
import { describe, expect, test } from 'vitest'
import { asksVersion, cliArguments, DETACHED, shouldDetach, versionOf } from '../../src/core/launch'

const packaged = (...args: string[]) => ['/opt/Menkar/menkar', ...args]
const dev = (...args: string[]) => ['/repo/node_modules/electron/dist/electron', '.', ...args]

function decide(
  argv: readonly string[],
  options: {
    tty?: boolean
    env?: Record<string, string>
    platform?: string
    isPackaged?: boolean
  } = {},
): boolean {
  return shouldDetach({
    argv,
    packaged: options.isPackaged ?? true,
    stdoutIsTTY: options.tty ?? true,
    env: options.env ?? {},
    platform: options.platform ?? 'linux',
  })
}

describe('whether menkar leaves the terminal', () => {
  test.each([
    ['the app alone', packaged()],
    ['files to open', packaged('open', 'notes.md')],
    ['a Chromium switch before the command', packaged('--ozone-platform=x11')],
  ])('%s, from a terminal, detaches', (_name, argv) => {
    expect(decide(argv)).toBe(true)
  })

  test('the unpackaged app, from a terminal, detaches too', () => {
    expect(decide(dev(), { isPackaged: false })).toBe(true)
  })

  test.each([
    ['a usage report', packaged('usage', 'today')],
    ['a usage export', packaged('usage', 'export', '--period', 'today')],
    ['open with no file, which prints how to use it', packaged('open')],
    ['--foreground', packaged('--foreground')],
    ['-f', packaged('-f')],
    ['-f with files', packaged('-f', 'open', 'notes.md')],
    ['--help', packaged('--help')],
    ['--version', packaged('--version')],
    ['-v', packaged('-v')],
    ['the detached child itself', packaged(DETACHED)],
  ])('%s stays in the foreground', (_name, argv) => {
    expect(decide(argv)).toBe(false)
  })

  test('without a terminal on stdout (the launcher, a pipe) nothing changes', () => {
    expect(decide(packaged(), { tty: false })).toBe(false)
  })

  test.each([
    ['ELECTRON_RUN_AS_NODE', { ELECTRON_RUN_AS_NODE: '1' }],
    ['the UI checks under xvfb', { MENKAR_E2E_XVFB: '1' }],
    ['a packaged build under test', { MENKAR_E2E_EXECUTABLE: '/tmp/menkar' }],
    [
      'the dev server, which keeps the app it started',
      { ELECTRON_RENDERER_URL: 'http://localhost:5173' },
    ],
  ])('%s never detaches', (_name, env) => {
    expect(decide(packaged(), { env })).toBe(false)
  })

  test('only where a process can leave its terminal: not on Windows', () => {
    expect(decide(packaged(), { platform: 'win32' })).toBe(false)
    expect(decide(packaged(), { platform: 'darwin' })).toBe(true)
  })
})

describe("the command's own arguments", () => {
  test.each([
    [packaged(DETACHED, 'open', 'a.md'), ['open', 'a.md']],
    [packaged('--foreground', 'usage', 'today'), ['usage', 'today']],
    [packaged('-f'), []],
    [packaged('--ozone-platform=x11', 'usage', '--json'), ['usage', '--json']],
  ])('%j → %j', (argv, expected) => {
    expect(cliArguments(argv, true)).toEqual(expected)
  })

  test('unpackaged, the app folder after the switches is not an argument', () => {
    expect(cliArguments(['/e/electron', DETACHED, '.', 'open', 'a.md'], false)).toEqual([
      'open',
      'a.md',
    ])
  })
})

describe('asking for the version', () => {
  test.each([
    ['--version', packaged('--version')],
    ['-v', packaged('-v')],
    ['--version after a Chromium switch', packaged('--ozone-platform=x11', '--version')],
    ['--version with -f', packaged('-f', '--version')],
    ['-v after the detached marker', packaged(DETACHED, '-v')],
  ])('%s asks for it', (_name, argv) => {
    expect(asksVersion(argv, true)).toBe(true)
  })

  test.each([
    ['the app alone', packaged()],
    ['a file named -v to open', packaged('open', '-v')],
    ['a usage report', packaged('usage', 'today')],
    ['--help', packaged('--help')],
  ])('%s does not', (_name, argv) => {
    expect(asksVersion(argv, true)).toBe(false)
  })

  test('unpackaged, after the app folder', () => {
    expect(asksVersion(dev('--version'), false)).toBe(true)
    expect(asksVersion(dev('-v'), false)).toBe(true)
    expect(asksVersion(dev(), false)).toBe(false)
  })
})

describe('the version printed', () => {
  test("a package's build gives its whole version, as dpkg shows it", () => {
    expect(versionOf({ version: '0.1.0', packageVersion: '0.1.0-412.g0d1bd1a2' })).toBe(
      '0.1.0-412.g0d1bd1a2',
    )
  })

  test("without one (the dev app, the UI checks) it is the app's own", () => {
    expect(versionOf({ version: '0.1.0' })).toBe('0.1.0')
    expect(versionOf({ version: '0.1.0', packageVersion: '' })).toBe('0.1.0')
  })

  test.each([[null], ['0.1.0'], [{}], [{ version: 1 }]])('%j gives none', (json) => {
    expect(versionOf(json)).toBeNull()
  })
})
