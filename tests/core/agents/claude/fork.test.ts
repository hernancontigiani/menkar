// §2.3 of the multi-agent architecture (B2): a fork is Claude's kit's concern. Its start builds
// the command R10 holds for a fork, byte for byte; Cursor has none, so no Fork entry is offered.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { kitOf } from '../../../../src/core/agents/registry'
import { buildCommand, mcpConfig } from '../../../../src/core/command'
import { ID, ID2 } from '../../../factories/transcript'

describe('forking a session', () => {
  test("Claude's fork plan is a fork start of the source under the new id", () => {
    expect(kitOf('claude').fork?.plan(ID, ID2)).toEqual({ kind: 'fork', source: ID, id: ID2 })
  })

  test("Claude's fork plan builds R10's fork command", () => {
    const start = kitOf('claude').fork?.plan(ID, ID2)
    if (!start) throw new Error('Claude has a fork')
    const command = buildCommand('claude', start, {
      cli: '/home/demo/.local/bin/claude',
      settings: '/home/demo/.config/menkar/claude-settings.json',
      remoteControl: "the demo's api",
      promptFile: "/home/demo/.cache/menkar/prompts/it's a prompt.txt",
      mcpConfig: mcpConfig('/opt/Menkar/menkar', '/opt/Menkar/resources/mcp-server.cjs'),
      pluginDir: '/opt/Menkar/resources/plugin',
    })
    expect(command).toBe(
      readFileSync(join(import.meta.dirname, '..', '..', 'r10', 'claude-fork-off.txt'), 'utf8'),
    )
  })

  test('Cursor has no fork', () => {
    expect(kitOf('cursor').fork).toBeNull()
  })
})
