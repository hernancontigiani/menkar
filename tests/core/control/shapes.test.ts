// D3 and S8: which tools a caller is listed, from the installed agents' kits. A Claude user with
// no other agent installed is listed exactly what R10 recorded, with or without a published file.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import type { AgentId } from '../../../src/core/agents/ids'
import { controlPaths, PLAIN_SHAPE, readShape } from '../../../src/core/control/files'
import { answer } from '../../../src/core/control/protocol'
import { serverContext } from '../../../src/core/control/server'
import { toolsFile } from '../../../src/core/control/shapes'

const R10 = join(import.meta.dirname, '..', 'r10')
const snapshot = (name: string) => `./d3/${name}`

// Who Menkar can wake once each phase has given its agent a Waker: Codex's lands in P1b.3,
// Cursor's in P3.4.
const wakeable =
  (...ids: AgentId[]) =>
  (id: AgentId) =>
    ids.includes(id)

function publish(installed: AgentId[], canWake: (id: AgentId) => boolean): void {
  mkdirSync(controlPaths().root, { recursive: true })
  writeFileSync(controlPaths().tools, JSON.stringify(toolsFile(installed, canWake)))
}

const replies = async (agent: AgentId) => {
  const ctx = serverContext('p1', agent)
  const initialize = await answer(
    { id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } },
    ctx,
  )
  const list = await answer({ id: 2, method: 'tools/list' }, ctx)
  return {
    initialize: `${JSON.stringify(initialize, null, 2)}\n`,
    list: `${JSON.stringify(list, null, 2)}\n`,
  }
}

const listed = async (agent: AgentId) => {
  const reply = (await answer({ id: 2, method: 'tools/list' }, serverContext('p1', agent))) as {
    result: { tools: { name: string; inputSchema: { properties: Record<string, unknown> } }[] }
  }
  const tools = reply.result.tools
  return {
    sendMessage: tools.some((t) => t.name === 'send_message'),
    agent: 'agent' in (tools.find((t) => t.name === 'start_session')?.inputSchema.properties ?? {}),
  }
}

afterEach(() => rmSync(controlPaths().root, { recursive: true, force: true }))

describe("R10: a Claude user with no other agent sees today's tools", () => {
  test.each([
    ['no tools file', () => {}],
    ['only Claude installed', () => publish(['claude'], wakeable('claude'))],
  ])('%s: initialize and tools/list are R10 byte for byte', async (_, setup) => {
    setup()
    const { initialize, list } = await replies('claude')
    expect(initialize).toBe(readFileSync(join(R10, 'mcp-initialize.json'), 'utf8'))
    expect(list).toBe(readFileSync(join(R10, 'mcp-tools-list.json'), 'utf8'))
  })
})

describe("D3's snapshots, per installed set and caller", () => {
  test.each([
    // With Cursor's Waker (P3.4), a Claude caller needs send_message to reach Cursor.
    ['claude-cursor', 'claude', ['claude', 'cursor'], wakeable('claude', 'cursor')],
    ['claude-cursor', 'cursor', ['claude', 'cursor'], wakeable('claude', 'cursor')],
    // With Codex's Waker (P1b.3), a Claude caller needs send_message to reach Codex.
    ['claude-codex', 'claude', ['claude', 'codex'], wakeable('claude', 'codex')],
    ['claude-codex', 'codex', ['claude', 'codex'], wakeable('claude', 'codex')],
  ] as const)('{%s} installed, caller %s', async (name, caller, installed, canWake) => {
    publish([...installed], canWake)
    const { initialize, list } = await replies(caller)
    await expect(initialize).toMatchFileSnapshot(snapshot(`${name}-${caller}-initialize.txt`))
    await expect(list).toMatchFileSnapshot(snapshot(`${name}-${caller}-tools-list.txt`))
  })
})

describe('S8: send_message is listed where an installed agent is out of native reach and wakeable', () => {
  test.each([
    // [installed, wakeable, caller, send_message, start_session's agent]
    [['claude'], ['claude'], 'claude', false, false],
    [['claude', 'cursor'], ['claude'], 'claude', false, true],
    [['claude', 'cursor'], ['claude', 'cursor'], 'claude', true, true],
    [['claude', 'cursor'], ['claude', 'cursor'], 'cursor', true, true],
    [['claude', 'codex'], ['claude'], 'claude', false, true],
    [['claude', 'codex'], ['claude', 'codex'], 'claude', true, true],
    [['claude', 'codex'], ['claude', 'codex'], 'codex', true, true],
    // R6: a Codex-only user has no other way to message by name.
    [['codex'], ['codex'], 'codex', true, false],
    [['codex'], [], 'codex', false, false],
  ] as const)(
    'installed %j, wakeable %j, caller %s → send_message %s, agent %s',
    async (installed, canWake, caller, sendMessage, agent) => {
      publish([...installed], wakeable(...canWake))
      expect(await listed(caller)).toEqual({ sendMessage, agent })
    },
  )

  test('listChanged is declared only when an agent other than Claude is installed', () => {
    expect(toolsFile(['claude'], wakeable('claude')).listChanged).toBe(false)
    expect(toolsFile(['claude', 'cursor'], wakeable('claude')).listChanged).toBe(true)
    expect(toolsFile(['codex'], wakeable()).listChanged).toBe(true)
  })

  test("start_session's agent offers exactly the installed agents", async () => {
    publish(['claude', 'codex'], wakeable('claude'))
    const reply = (await answer(
      { id: 2, method: 'tools/list' },
      serverContext('p1', 'claude'),
    )) as {
      result: { tools: { name: string; inputSchema: { properties: { agent?: unknown } } }[] }
    }
    const start = reply.result.tools.find((t) => t.name === 'start_session')
    expect(start?.inputSchema.properties.agent).toMatchObject({ enum: ['claude', 'codex'] })
  })
})

// An agent whose team names skills it cannot be given as files reads them through load_skill:
// listed to its sessions only, and the file of everyone else keeps its bytes.
describe('load_skill is listed only where the caller is given its skills through Menkar', () => {
  test.each([
    ['opencode', true],
    ['claude', false],
    ['codex', false],
  ] as const)('caller %s → %s', async (caller, offered) => {
    publish(['claude', 'codex', 'opencode'], wakeable('claude', 'codex', 'opencode'))
    const reply = (await answer({ id: 2, method: 'tools/list' }, serverContext('p1', caller))) as {
      result: { tools: { name: string }[] }
    }
    expect(reply.result.tools.some((t) => t.name === 'load_skill')).toBe(offered)
  })

  test('a file of callers who are not given skills that way says nothing of it', () => {
    const file = toolsFile(['claude', 'codex'], wakeable('claude', 'codex'))
    expect(JSON.stringify(file)).not.toContain('loadSkill')
    expect(toolsFile(['opencode'], wakeable('opencode')).callers.opencode?.loadSkill).toBe(true)
  })
})

describe('the tools file, read by the server', () => {
  test.each([
    ['not JSON', '{"listChanged":'],
    ['no callers', '{"listChanged":true}'],
    ['the caller not listed', '{"listChanged":true,"callers":{"codex":{"sendMessage":true}}}'],
  ])('%s gives the plain list', async (_, text) => {
    mkdirSync(controlPaths().root, { recursive: true })
    writeFileSync(controlPaths().tools, text)
    expect(await readShape('claude')).toEqual(PLAIN_SHAPE)
  })

  test('an agent the build does not know is dropped from the offered agents', async () => {
    mkdirSync(controlPaths().root, { recursive: true })
    writeFileSync(
      controlPaths().tools,
      '{"listChanged":true,"callers":{"claude":{"sendMessage":false,"agents":["claude","gemini","codex"]}}}',
    )
    expect((await readShape('claude')).agents).toEqual(['claude', 'codex'])
  })

  test("send_message's call reaches main with its arguments, as every tool's does", async () => {
    publish(['claude', 'codex'], wakeable('claude', 'codex'))
    const calls: unknown[] = []
    const ctx = {
      ...serverContext('p1', 'codex'),
      call: async (tool: string, args: Record<string, unknown>) => {
        calls.push([tool, args])
        return { ok: true, text: 'Sent to cx.' }
      },
    }
    const reply = await answer(
      {
        id: 3,
        method: 'tools/call',
        params: { name: 'send_message', arguments: { name: 'cx', text: 'hi' } },
      },
      ctx,
    )
    expect(reply).toMatchObject({ result: { content: [{ type: 'text', text: 'Sent to cx.' }] } })
    expect(reply).not.toMatchObject({ result: { isError: true } })
    expect(calls).toEqual([['send_message', { name: 'cx', text: 'hi' }]])
  })
})
