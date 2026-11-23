import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { descriptorOf } from '../agents/descriptors'
import { type AgentId, DEFAULT_AGENT, parseAgentId } from '../agents/ids'
import {
  AGENT_ENV,
  type Caller,
  type ControlAnswer,
  callMenkar,
  menkarAlive,
  NOT_RUNNING,
  readShape,
  sessionsAnswer,
  snapshotOfPane,
} from './files'
import { answer, type ServerContext } from './protocol'

// Menkar's MCP server. Claude Code starts it for each session Menkar starts, through
// `--mcp-config`, as a program of its own run by Electron's binary as plain Node: no Electron, no
// DOM. It inherits the pane's environment, so `MENKAR_PANE` says which tab is calling, and
// `MENKAR_AGENT` which agent, when its mount names one. An agent whose one MCP server serves many
// sessions names the calling session in each call's `_meta` instead, and main finds its pane.

const NOT_LISTED = 'This session is not in a Menkar project yet; try again in a moment.'

async function listSessions(pane: string): Promise<ControlAnswer> {
  if (!(await menkarAlive())) return { ok: false, text: NOT_RUNNING }
  const snapshot = await snapshotOfPane(pane)
  if (!snapshot) return { ok: false, text: NOT_LISTED }
  return { ok: true, text: sessionsAnswer(snapshot) }
}

export function serverContext(pane: string | null, agent: AgentId = DEFAULT_AGENT): ServerContext {
  return {
    pane,
    callerMeta: descriptorOf(agent).callerMeta,
    shape: () => readShape(agent),
    call: (tool, args, caller: Caller = { pane: pane ?? '' }) =>
      'pane' in caller && tool === 'list_sessions'
        ? listSessions(caller.pane)
        : callMenkar({ caller, tool, args }),
  }
}

function serve(): void {
  const ctx = serverContext(
    process.env.MENKAR_PANE || null,
    parseAgentId(process.env[AGENT_ENV]) ?? DEFAULT_AGENT,
  )
  const send = (reply: object) => process.stdout.write(`${JSON.stringify(reply)}\n`)
  createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      return
    }
    if (typeof message !== 'object' || message === null) return
    answer(message, ctx).then(
      (reply) => {
        if (reply) send(reply)
      },
      (error: unknown) => {
        // Our own sentence to the agent; the details only to stderr, which Claude Code logs.
        process.stderr.write(`menkar mcp: ${String(error)}\n`)
        const id = (message as { id?: unknown }).id
        if (id !== undefined)
          send({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: 'Menkar could not do this.' }],
              isError: true,
            },
          })
      },
    )
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) serve()
