// The `--settings` file of the sessions Menkar starts, and the user's statusline it chains to
// (docs/spec/context.md, CTX-27 to CTX-30).
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { contextFiles } from '../../../src/core/context/files'
import { shellQuote, writeSessionSettings } from '../../../src/core/context/settings'
import { agentPaths } from '../../../src/core/paths'

const COMMAND = "ELECTRON_RUN_AS_NODE=1 '/opt/Menkar/menkar' '/opt/Menkar/statusline.js'"

function userSettings(content: string | null) {
  const path = agentPaths().claudeSettings
  mkdirSync(dirname(path), { recursive: true })
  if (content === null) rmSync(path, { force: true })
  else writeFileSync(path, content)
  return path
}

beforeEach(() => {
  rmSync(contextFiles.claudeSettings(), { force: true })
  rmSync(contextFiles.chainedStatusline(), { force: true })
  rmSync(contextFiles.integrationsRecord(), { force: true })
  userSettings(null)
})

test("CTX-27 the path to pass is the config directory's claude-settings.json", async () => {
  expect(await writeSessionSettings(COMMAND)).toBe(
    join(process.env.XDG_CONFIG_HOME ?? '', 'menkar', 'claude-settings.json'),
  )
})

test('CTX-28 the settings file is created, left alone when identical, replaced when different', async () => {
  const path = await writeSessionSettings(COMMAND)
  const text = readFileSync(path, 'utf8')
  // The statusline, and the SessionStart hook for a start, a resume, a clear and a compaction: the same
  // script, in its hook mode.
  const hook = { type: 'command', command: `${COMMAND} session-start` }
  // Plan 31: Menkar's own MCP tools need no prompt (decision 1), the Stop hook tells Menkar a turn
  // ended (decision 9), and Menkar's posts to a session it started are delivered (decision 15).
  const expected = {
    statusLine: { type: 'command', command: COMMAND },
    hooks: {
      SessionStart: [
        { matcher: 'startup', hooks: [hook] },
        { matcher: 'resume', hooks: [hook] },
        { matcher: 'clear', hooks: [hook] },
        { matcher: 'compact', hooks: [hook] },
      ],
      Stop: [{ hooks: [{ type: 'command', command: `${COMMAND} turn-end` }] }],
    },
    permissions: { allow: ['mcp__menkar'] },
    crossSessionInbound: 'accept',
  }
  expect(JSON.parse(text)).toEqual(expected)
  expect(text).toBe(`${JSON.stringify(expected, null, 2)}\n`)
  const before = statSync(path).mtimeMs
  await new Promise((resolve) => setTimeout(resolve, 20))
  await writeSessionSettings(COMMAND)
  expect(statSync(path).mtimeMs).toBe(before)
  await writeSessionSettings(`${COMMAND} --moved`)
  expect(JSON.parse(readFileSync(path, 'utf8')).statusLine.command).toBe(`${COMMAND} --moved`)
})

test("CTX-29 the user's own statusline is chained, and their file is not modified", async () => {
  const original = '{"statusLine": {"type":"command","command":"my-bar"}}'
  const path = userSettings(original)
  const before = statSync(path).mtimeMs
  await writeSessionSettings(COMMAND)
  expect(readFileSync(contextFiles.chainedStatusline(), 'utf8')).toBe('{"command": "my-bar"}\n')
  expect(readFileSync(path, 'utf8')).toBe(original)
  expect(statSync(path).mtimeMs).toBe(before)
})

test.each([
  ['missing', null],
  ['not JSON', '{"a":'],
  ['not an object', '[1]'],
  [
    "Menkar's own statusline",
    JSON.stringify({ statusLine: { type: 'command', command: COMMAND } }),
  ],
  ['a blank command', '{"statusLine": {"type": "command", "command": "  "}}'],
])('CTX-30 nothing is chained when the user settings are %s', async (_case, content) => {
  userSettings(content)
  await writeSessionSettings(COMMAND)
  expect(readFileSync(contextFiles.chainedStatusline(), 'utf8')).toBe('{"command": null}\n')
})

test('the statusline the global install replaced is the one chained', async () => {
  userSettings(JSON.stringify({ statusLine: { type: 'command', command: COMMAND } }))
  mkdirSync(dirname(contextFiles.integrationsRecord()), { recursive: true })
  writeFileSync(
    contextFiles.integrationsRecord(),
    JSON.stringify({
      statusline: { installed: {}, previous: { type: 'command', command: 'old-bar' } },
    }),
  )
  await writeSessionSettings(COMMAND)
  expect(readFileSync(contextFiles.chainedStatusline(), 'utf8')).toBe('{"command": "old-bar"}\n')
})

test.each([
  ['/opt/Menkar/menkar', '/opt/Menkar/menkar'],
  ['/home/u/My Apps/menkar', "'/home/u/My Apps/menkar'"],
  ["/tmp/it's", `'/tmp/it'"'"'s'`],
])('a path is quoted for the shell only when it needs it: %s', (path, quoted) => {
  expect(shellQuote(path)).toBe(quoted)
})
