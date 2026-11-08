// The chat core: variants, the two protocols, the conversation model, the Markdown subset, the MCP
// browser's content and Ghostty's arguments (docs/spec/chat.md). No process is started.
import { describe, expect, test } from 'vitest'
import { ghosttyArgs } from '../../../src/core/chat/ghostty'
import { renderMarkdown } from '../../../src/core/chat/markdown'
import { mcpSections } from '../../../src/core/chat/mcp'
import { ChatModel } from '../../../src/core/chat/model'
import {
  allowLine,
  claudeArgs,
  claudeEvents,
  cursorArgs,
  cursorEvents,
  denyLine,
  LineSplitter,
  userLine,
} from '../../../src/core/chat/protocol'
import { type ChatAgent, variantOf, variantsFor } from '../../../src/core/chat/variants'

const claude = variantOf('claude', 'default')
const ask = variantOf('cursor', 'ask')
const trusted = variantOf('cursor', 'trusted')
if (!claude || !ask || !trusted) throw new Error('variants missing')

const delta = (text: string) =>
  JSON.stringify({
    type: 'stream_event',
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  })
const permission = (
  id: string,
  tool: string,
  input: unknown,
  extra: Record<string, unknown> = {},
) =>
  JSON.stringify({
    type: 'control_request',
    request_id: id,
    request: { subtype: 'can_use_tool', tool_name: tool, input, ...extra },
  })

function feed(model: ChatModel, ...lines: string[]) {
  const replies = []
  for (const line of lines) for (const event of claudeEvents(line)) replies.push(model.apply(event))
  return replies.filter(Boolean)
}

describe('variants', () => {
  test('CHT-1, CHT-2, CHT-3 an agent offers its variants only while its CLI is installed', () => {
    const both = new Set<ChatAgent>(['claude', 'cursor'])
    expect(variantsFor(both).map((v) => `${v.agent}:${v.key}`)).toEqual([
      'claude:default',
      'cursor:ask',
      'cursor:trusted',
    ])
    expect(variantsFor(new Set<ChatAgent>(['claude'])).map((v) => v.key)).toEqual(['default'])
    expect(variantsFor(new Set<ChatAgent>(['claude']), 'cursor')).toEqual([])
    expect(variantsFor(both, 'cursor').map((v) => v.mode)).toEqual([
      'askReadOnly',
      'trustedAutoRun',
    ])
  })
})

describe("Claude's stdin stream", () => {
  test('CHT-6, CHT-9 the argv, with --resume only when continuing', () => {
    expect(claudeArgs(null)).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--permission-mode',
      'default',
      '--permission-prompt-tool',
      'stdio',
    ])
    expect(claudeArgs('1b2c').slice(-2)).toEqual(['--resume', '1b2c'])
  })

  test('CHT-15 a sent message is one user line, trimmed', () => {
    const model = new ChatModel(claude, false)
    const text = model.send('  what is this repo?  ')
    expect(text).toBe('what is this repo?')
    expect(userLine(text ?? '')).toBe(
      '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"what is this repo?"}]}}\n',
    )
    expect(model.items).toEqual([{ kind: 'user', text: 'what is this repo?' }])
    expect([model.thinking, model.busy]).toEqual([true, true])
  })

  test('CHT-14 blank text sends nothing', () => {
    const model = new ChatModel(claude, false)
    expect(model.send('   ')).toBeNull()
    expect(model.items).toEqual([])
  })

  test('CHT-16, CHT-17 text grows one bubble; thinking is not shown', () => {
    const model = new ChatModel(claude, false)
    model.send('hi')
    feed(
      model,
      JSON.stringify({
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } },
      }),
    )
    expect(model.thinking).toBe(true)
    feed(model, delta('Hel'), delta('lo **there**'))
    expect(model.items.at(-1)).toEqual({ kind: 'assistant', text: 'Hello **there**' })
    expect(model.thinking).toBe(false)
  })

  test('CHT-18 a tool starts a chip, and the text after it a new bubble', () => {
    const model = new ChatModel(claude, false)
    model.send('hi')
    feed(
      model,
      delta('Looking'),
      JSON.stringify({
        type: 'stream_event',
        event: { type: 'content_block_start', content_block: { type: 'tool_use', name: 'Read' } },
      }),
      delta('Done'),
    )
    expect(model.items.slice(1)).toEqual([
      { kind: 'assistant', text: 'Looking' },
      { kind: 'tool', name: 'Read' },
      { kind: 'assistant', text: 'Done' },
    ])
  })

  test("CHT-19, CHT-20, CHT-21 a result ends the turn; an error says the CLI's text or status", () => {
    const model = new ChatModel(claude, false)
    model.send('hi')
    feed(
      model,
      JSON.stringify({ type: 'result', is_error: false, result: 'Done', total_cost_usd: 0.03 }),
    )
    expect([model.busy, model.thinking]).toEqual([false, false])
    expect(model.items).toHaveLength(1)
    feed(model, JSON.stringify({ type: 'result', is_error: true, result: 'Prompt is too long' }))
    feed(model, JSON.stringify({ type: 'result', is_error: true, api_error_status: 529 }))
    expect(model.items.slice(1)).toEqual([
      { kind: 'notice', notice: 'error', text: 'Prompt is too long' },
      { kind: 'notice', notice: 'error', text: '529' },
    ])
  })

  test('CHT-22 a rate limit other than allowed is a notice', () => {
    const model = new ChatModel(claude, false)
    feed(
      model,
      JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } }),
    )
    expect(model.items).toEqual([])
    feed(
      model,
      JSON.stringify({
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', resetsAt: 1 },
      }),
    )
    expect(model.items).toEqual([{ kind: 'notice', notice: 'rateLimited' }])
  })

  test('CHT-23 the session ending is said once and the chat takes no more messages', () => {
    const model = new ChatModel(claude, false)
    model.end()
    model.end()
    expect(model.items).toEqual([{ kind: 'notice', notice: 'ended' }])
    expect(model.send('more')).toBeNull()
  })

  test('CHT-25 a line split across reads is parsed once; a line that is not JSON is skipped', () => {
    const lines = new LineSplitter()
    expect(lines.push('{"type":"res')).toEqual([])
    const [line] = lines.push('ult","is_error":false}\n')
    expect(claudeEvents(line ?? '')).toEqual([{ kind: 'turnEnd' }])
    expect(claudeEvents('not json')).toEqual([])
    expect(claudeEvents(JSON.stringify({ type: 'assistant', message: {} }))).toEqual([])
  })

  test('the init line carries the session id', () => {
    expect(
      claudeEvents(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'abc' })),
    ).toEqual([{ kind: 'session', id: 'abc' }])
  })
})

describe('the permission card', () => {
  test('CHT-32, CHT-33, CHT-34 its title and body', () => {
    const [plain] = claudeEvents(permission('r1', 'Bash', { command: 'npm test' }))
    expect(plain).toMatchObject({
      kind: 'permission',
      requestId: 'r1',
      tool: 'Bash',
      title: 'Bash',
      body: 'npm test',
    })
    const [named] = claudeEvents(
      permission(
        'r1',
        'Bash',
        { command: 'npm test' },
        { display_name: 'Run shell command', description: 'Runs the tests' },
      ),
    )
    expect(named).toMatchObject({ title: 'Run shell command', body: 'Runs the tests' })
    expect(
      claudeEvents(permission('r', 'Edit', { file_path: '  ', path: 'src/a.ts' }))[0],
    ).toMatchObject({ body: 'src/a.ts' })
    expect(claudeEvents(permission('r', 'Edit', { old: 'x' }))[0]).toMatchObject({ body: null })
    expect(claudeEvents(permission('r', 'Bash', { path: 'a', command: 'ls' }))[0]).toMatchObject({
      body: 'ls',
    })
  })

  test('CHT-35 allowing once writes the input back unchanged and records it', () => {
    const model = new ChatModel(claude, false)
    model.send('hi')
    feed(model, permission('r1', 'Bash', { command: 'npm test' }))
    const reply = model.answer('r1', 'once')
    expect(reply).toEqual({ allow: true, requestId: 'r1', input: { command: 'npm test' } })
    expect(allowLine('r1', { command: 'npm test' })).toBe(
      '{"type":"control_response","response":{"subtype":"success","request_id":"r1","response":{"behavior":"allow","updatedInput":{"command":"npm test"}}}}\n',
    )
    expect(model.items.some((i) => i.kind === 'card')).toBe(false)
    expect(model.items.at(-1)).toEqual({ kind: 'outcome', outcome: 'allowed', tool: 'Bash' })
    expect(model.thinking).toBe(true)
    expect(model.answer('r1', 'once')).toBeNull()
  })

  test('CHT-36 denying writes the sentence given', () => {
    const model = new ChatModel(claude, false)
    feed(model, permission('r1', 'Bash', {}))
    expect(model.answer('r1', 'deny')).toEqual({ allow: false, requestId: 'r1' })
    expect(denyLine('r1', 'The user declined this action.')).toBe(
      '{"type":"control_response","response":{"subtype":"success","request_id":"r1","response":{"behavior":"deny","message":"The user declined this action."}}}\n',
    )
    expect(model.items.at(-1)).toEqual({ kind: 'outcome', outcome: 'denied', tool: 'Bash' })
  })

  test('CHT-37, CHT-38 always allowing answers that tool at once in this tab only', () => {
    const model = new ChatModel(claude, false)
    feed(model, permission('r1', 'Bash', {}))
    model.answer('r1', 'always')
    const replies = feed(model, permission('r2', 'Bash', { command: 'ls' }))
    expect(replies).toEqual([{ allow: true, requestId: 'r2', input: { command: 'ls' } }])
    expect(model.items.at(-1)).toEqual({ kind: 'outcome', outcome: 'auto', tool: 'Bash' })
    feed(model, permission('r3', 'Edit', {}))
    expect(model.items.at(-1)).toMatchObject({ kind: 'card', requestId: 'r3' })
    const fresh = new ChatModel(claude, false)
    feed(fresh, permission('r4', 'Bash', {}))
    expect(fresh.items.at(-1)).toMatchObject({ kind: 'card' })
  })
})

describe("Cursor's spawn resume", () => {
  test('CHT-11, CHT-12 one process per message; ask is read-only, trusted forces', () => {
    expect(cursorArgs(trusted, '9f8e', 'hi')).toEqual([
      '-p',
      '--output-format',
      'stream-json',
      '--stream-partial-output',
      '--trust',
      '--resume',
      '9f8e',
      '--force',
      'hi',
    ])
    expect(cursorArgs(ask, null, 'list files').slice(-4)).toEqual([
      '--trust',
      '--mode',
      'ask',
      'list files',
    ])
  })

  test('CHT-30 the final whole message is not shown twice', () => {
    const model = new ChatModel(ask, false)
    model.send('hi')
    const assistant = (extra: Record<string, unknown>) =>
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Hi' }] },
        ...extra,
      })
    for (const line of [assistant({ timestamp_ms: 1 }), assistant({})])
      for (const e of cursorEvents(line)) model.apply(e)
    expect(model.items.at(-1)).toEqual({ kind: 'assistant', text: 'Hi' })
  })

  test('CHT-31 a tool call key names the chip', () => {
    expect(
      cursorEvents(
        JSON.stringify({ type: 'tool_call', subtype: 'started', tool_call: { editToolCall: {} } }),
      ),
    ).toEqual([{ kind: 'tool', name: 'Edit' }])
    expect(cursorEvents(JSON.stringify({ type: 'thinking', subtype: 'delta', text: 'x' }))).toEqual(
      [],
    )
  })
})

describe('Markdown in assistant bubbles', () => {
  test('CHT-26 headings, bullets, inline and fenced code; other text literally', () => {
    expect(renderMarkdown('# Plan\n- one\n  * two\n`x`\n```\ncode\n```')).toEqual([
      { kind: 'line', spans: [{ text: 'Plan', bold: true }] },
      { kind: 'line', spans: [{ text: '• ' }, { text: 'one' }] },
      { kind: 'line', spans: [{ text: '  • ' }, { text: 'two' }] },
      { kind: 'line', spans: [{ text: 'x', code: true }] },
      { kind: 'code', text: 'code' },
    ])
    expect(renderMarkdown('a < b & c')).toEqual([{ kind: 'line', spans: [{ text: 'a < b & c' }] }])
    expect(renderMarkdown('Hello **there**')).toEqual([
      { kind: 'line', spans: [{ text: 'Hello ' }, { text: 'there', bold: true }] },
    ])
  })
})

describe('the MCP servers browser', () => {
  test('CHT-42 global then each project with servers, by name and by path', () => {
    const file = JSON.stringify({
      mcpServers: {
        web: { type: 'http', url: 'https://mcp.example.com' },
        fs: { command: 'npx', args: ['-y', 'fs-server', '/tmp/x'] },
      },
      projects: {
        '/home/user/src/shop': { mcpServers: { db: { type: 'stdio', command: 'db-mcp' } } },
        '/home/user/src/blog': {},
      },
    })
    expect(mcpSections(file)).toEqual([
      {
        path: null,
        servers: [
          { name: 'fs', summary: 'stdio · npx -y fs-server /tmp/x' },
          { name: 'web', summary: 'http · https://mcp.example.com' },
        ],
      },
      { path: '/home/user/src/shop', servers: [{ name: 'db', summary: 'stdio · db-mcp' }] },
    ])
  })

  test('CHT-43, CHT-44, CHT-45 type alone, nothing, and files that are not an object', () => {
    expect(
      mcpSections(JSON.stringify({ mcpServers: { a: { type: 'sse' }, b: {} } }))[0]?.servers,
    ).toEqual([
      { name: 'a', summary: 'sse' },
      { name: 'b', summary: '—' },
    ])
    for (const text of [null, '[1,2]', '{"mcpServers":']) expect(mcpSections(text)).toEqual([])
    expect(
      mcpSections(JSON.stringify({ projects: { '/p': { mcpServers: { x: {} } } } }))[0]?.path,
    ).toBe('/p')
  })
})

test('CHT-48, CHT-49 Ghostty resumes the session in its folder', () => {
  expect(ghosttyArgs('/home/user/src/shop', 'claude', '1b2c')).toEqual([
    '--working-directory=/home/user/src/shop',
    '-e',
    'claude',
    '--resume',
    '1b2c',
  ])
})

test('a continued chat starts with its notice', () => {
  expect(new ChatModel(claude, true).items).toEqual([{ kind: 'notice', notice: 'continuing' }])
})
