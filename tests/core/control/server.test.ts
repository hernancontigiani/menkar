// Menkar's MCP server, a newline-delimited JSON-RPC loop with eight tools; it
// talks to main through files (decision 8) and refuses every call outside a Menkar pane.
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  watch,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { callMenkar, controlPaths, writeAtomic } from '../../../src/core/control/files'
import { answer, TOOL_NAMES } from '../../../src/core/control/protocol'
import { serverContext } from '../../../src/core/control/server'
import {
  sessionMarks,
  setMode,
  setOrchestrator,
  setPriority,
  setRole,
  setWithYou,
} from '../../../src/core/projects/orchestration'
import { project, projects } from '../../factories/projects'

const ctx = (pane: string | null, calls: unknown[] = []) => ({
  pane,
  call: async (tool: string, args: Record<string, unknown>) => {
    calls.push([tool, args])
    return { ok: true, text: `ran ${tool}` }
  },
})

const rpc = (method: string, params?: unknown, id: number | null = 1) => ({
  jsonrpc: '2.0',
  ...(id === null ? {} : { id }),
  method,
  ...(params === undefined ? {} : { params }),
})

afterEach(() => rmSync(controlPaths().root, { recursive: true, force: true }))

describe('the protocol', () => {
  test('server/discover is refused with -32601; initialize echoes the version and offers tools', async () => {
    expect(await answer(rpc('server/discover', {}), ctx('p1'))).toMatchObject({
      id: 1,
      error: { code: -32601 },
    })
    expect(
      await answer(rpc('initialize', { protocolVersion: '2025-11-25' }), ctx('p1')),
    ).toMatchObject({
      id: 1,
      result: {
        protocolVersion: '2025-11-25',
        capabilities: { tools: {} },
        serverInfo: { name: 'menkar' },
      },
    })
    expect(await answer(rpc('notifications/initialized', undefined, null), ctx('p1'))).toBe(null)
  })

  test('tools/list names exactly renew, start_session, list_sessions, last_reply and the four topic tools', async () => {
    const reply = (await answer(rpc('tools/list'), ctx('p1'))) as {
      result: { tools: { name: string; inputSchema: unknown }[] }
    }
    expect(reply.result.tools.map((t) => t.name)).toEqual([
      'renew',
      'start_session',
      'list_sessions',
      'last_reply',
      'topic_add',
      'topic_update',
      'topic_close',
      'topic_list',
    ])
    expect(TOOL_NAMES).toEqual(reply.result.tools.map((t) => t.name))
  })

  test('a call goes to Menkar with its arguments, and its answer comes back as text', async () => {
    const calls: unknown[] = []
    const reply = await answer(
      rpc('tools/call', { name: 'start_session', arguments: { name: 'api' } }),
      ctx('p1', calls),
    )
    expect(calls).toEqual([['start_session', { name: 'api' }]])
    expect(reply).toMatchObject({
      result: { content: [{ type: 'text', text: 'ran start_session' }] },
    })
  })

  test('without MENKAR_PANE every call is an error with our sentence, and Menkar is never asked', async () => {
    const calls: unknown[] = []
    for (const name of TOOL_NAMES) {
      const reply = (await answer(
        rpc('tools/call', { name, arguments: {} }),
        ctx(null, calls),
      )) as {
        result: { isError: boolean; content: { text: string }[] }
      }
      expect(reply.result.isError).toBe(true)
      expect(reply.result.content[0]?.text).toMatch(/only in a session Menkar started/)
    }
    expect(calls).toEqual([])
  })

  test('an unknown tool is an error', async () => {
    const reply = await answer(rpc('tools/call', { name: 'rm', arguments: {} }), ctx('p1'))
    expect(reply).toMatchObject({ result: { isError: true } })
  })
})

function aliveNow(): void {
  const { root, alive } = controlPaths()
  mkdirSync(root, { recursive: true })
  writeFileSync(alive, JSON.stringify({ pid: process.pid, started: 1 }))
}

describe('the files between the server and main', () => {
  test('a call writes its request by rename, waits for the response and deletes it', async () => {
    aliveNow()
    const { requests, responses } = controlPaths()
    mkdirSync(requests, { recursive: true })
    mkdirSync(responses, { recursive: true })
    const seen: string[] = []
    const watcher = watch(requests, (_, name) => {
      if (!name) return
      seen.push(name)
      for (const file of readdirSync(requests)) {
        const request = JSON.parse(readFileSync(join(requests, file), 'utf8'))
        unlinkSync(join(requests, file))
        writeFileSync(
          join(responses, file),
          JSON.stringify({ id: request.id, ok: true, text: `hi ${request.pane}` }),
        )
      }
    })
    try {
      const answer = await callMenkar({ pane: 'p1', tool: 'renew', args: {} })
      expect(answer).toEqual({ ok: true, text: 'hi p1' })
    } finally {
      watcher.close()
    }
    expect(seen.every((name) => name.endsWith('.json'))).toBe(true)
    expect(readdirSync(responses)).toEqual([])
  })

  test('no alive.json: "Menkar is not running" at once, and no request is left', async () => {
    const started = performance.now()
    const answer = await callMenkar({ pane: 'p1', tool: 'renew', args: {} })
    expect(answer.ok).toBe(false)
    expect(answer.text).toMatch(/Menkar is not running/)
    expect(performance.now() - started).toBeLessThan(500)
  })

  test('alive.json naming a pid that is gone reads as not running', async () => {
    const { root, alive } = controlPaths()
    mkdirSync(root, { recursive: true })
    writeFileSync(alive, JSON.stringify({ pid: 2 ** 22 + 7, started: 1 }))
    expect((await callMenkar({ pane: 'p1', tool: 'renew', args: {} })).text).toMatch(
      /Menkar is not running/,
    )
  })

  test('no response in time: the timeout sentence, and the request is taken back', async () => {
    aliveNow()
    const answer = await callMenkar({ pane: 'p1', tool: 'renew', args: {} }, 300)
    expect(answer.ok).toBe(false)
    expect(answer.text).toMatch(/did not answer/)
    expect(readdirSync(controlPaths().requests)).toEqual([])
  })
})

describe('list_sessions', () => {
  test('reads the snapshot that holds the calling pane, without the panes', async () => {
    aliveNow()
    const { snapshots } = controlPaths()
    await writeAtomic(snapshots, 'other.json', {
      project: { id: 'other', name: 'Other' },
      sessions: [
        { name: 'x', id: 'x1', state: 'idle', context: null, parent: null, tab: true, pane: 'p9' },
      ],
    })
    await writeAtomic(snapshots, 'work.json', {
      project: { id: 'work', name: 'Work' },
      sessions: [
        { name: 'orch', id: 'o1', state: 'idle', context: 41, parent: null, tab: true, pane: 'p1' },
        {
          name: 'api',
          id: 'a1',
          state: 'blocked',
          context: 7,
          parent: 'o1',
          tab: true,
          pane: 'p2',
        },
      ],
    })
    const answer = await serverContext('p2').call('list_sessions', {})
    expect(answer.ok).toBe(true)
    const off = { role: null, orchestrator: false, priority: false, with_you: false }
    expect(JSON.parse(answer.text)).toEqual({
      project: 'Work',
      orchestration: false,
      sessions: [
        { name: 'orch', id: 'o1', state: 'idle', context: 41, parent: null, tab: true, ...off },
        { name: 'api', id: 'a1', state: 'blocked', context: 7, parent: 'o1', tab: true, ...off },
      ],
    })
    expect((await serverContext('p404').call('list_sessions', {})).ok).toBe(false)
  })

  test('in the orchestration mode each session carries its role, orchestrator, ★ and with you', async () => {
    aliveNow()
    let state = projects([project('work', 'Work', ['o1', 'e1', 'w1'])])
    state = setOrchestrator(setMode(state, 'work', true), 'work', 'o1')
    state = setPriority(setRole(state, 'work', 'e1', 'Fabric expert'), 'work', 'e1', true)
    state = setWithYou(state, 'work', 'w1', true)
    const session = (id: string, pane: string, p = state.projects[0]) => ({
      name: id,
      id,
      state: 'idle',
      context: null,
      parent: null,
      tab: true,
      pane,
      ...(p ? sessionMarks(p, id) : {}),
    })
    const on = state.projects[0]
    if (!on) throw new Error('no project')
    await writeAtomic(controlPaths().snapshots, 'work.json', {
      project: { id: 'work', name: 'Work' },
      orchestration: true,
      sessions: [session('o1', 'p1'), session('e1', 'p2'), session('w1', 'p3')],
    })
    const plain = { state: 'idle', context: null, parent: null, tab: true }
    expect(JSON.parse((await serverContext('p1').call('list_sessions', {})).text)).toEqual({
      project: 'Work',
      orchestration: true,
      sessions: [
        {
          name: 'o1',
          id: 'o1',
          ...plain,
          role: null,
          orchestrator: true,
          priority: false,
          with_you: false,
        },
        {
          name: 'e1',
          id: 'e1',
          ...plain,
          role: 'Fabric expert',
          orchestrator: false,
          priority: true,
          with_you: false,
        },
        {
          name: 'w1',
          id: 'w1',
          ...plain,
          role: null,
          orchestrator: false,
          priority: false,
          with_you: true,
        },
      ],
    })
    const off = setMode(state, 'work', false).projects[0]
    if (!off) throw new Error('no project')
    expect(sessionMarks(off, 'e1')).toEqual({
      role: null,
      orchestrator: false,
      priority: false,
      withYou: false,
    })
    // A snapshot an older Menkar wrote, without the fields: the mode reads as off.
    await writeAtomic(controlPaths().snapshots, 'work.json', {
      project: { id: 'work', name: 'Work' },
      sessions: [
        { name: 'o1', id: 'o1', state: 'idle', context: null, parent: null, tab: true, pane: 'p1' },
      ],
    })
    expect(JSON.parse((await serverContext('p1').call('list_sessions', {})).text)).toEqual({
      project: 'Work',
      orchestration: false,
      sessions: [
        {
          name: 'o1',
          id: 'o1',
          ...plain,
          role: null,
          orchestrator: false,
          priority: false,
          with_you: false,
        },
      ],
    })
  })
})
