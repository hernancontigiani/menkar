import { type ControlAnswer, TOOL_NAMES, type ToolName } from './files'

export { TOOL_NAMES }

// The MCP methods Claude Code sends, answered by hand: initialize, tools/list and tools/call.
// Anything else with an id is "method not found", which Claude Code takes in its stride (it
// probes with `server/discover` first); a notification gets no answer.

export const NO_PANE = "Menkar's tools work only in a session Menkar started in one of its tabs."
const UNKNOWN_TOOL = 'Menkar has no tool by that name.'

const TOOLS: readonly { name: ToolName; description: string; inputSchema: object }[] = [
  {
    name: 'renew',
    description:
      "Ends this session once the current turn is over and starts a fresh one in the same Menkar tab, with the same name; this conversation becomes its earlier conversation. Use it when your task is done and its lessons are saved. Optionally give the fresh session's first prompt.",
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: "The fresh session's first prompt." },
      },
    },
  },
  {
    name: 'start_session',
    description:
      "Starts a new Claude Code session in a Menkar tab right after yours, in your project, without taking the focus. You become its parent: Menkar tells you when it waits at a permission prompt or finishes a turn. Its name, unique among the project's sessions with a tab, is how you address it.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "The session's name." },
        prompt: { type: 'string', description: 'Its first prompt.' },
        prompt_file: {
          type: 'string',
          description: 'An absolute path to a file holding its first prompt, instead of prompt.',
        },
        remote_control: { type: 'boolean', description: 'Turn Remote Control on for it.' },
        group: { type: 'string', description: 'An existing group of the project to put it in.' },
        model: {
          type: 'string',
          description:
            "The model the new session runs, as the agent names it, e.g. a smaller one for a generalist worker; omit it for the user's default.",
        },
        loose: {
          type: 'boolean',
          description:
            'Start it with no parent, as a consultant: Menkar never wakes you for it and its tab is never read only.',
        },
        role: {
          type: 'string',
          description:
            "The role label it is born with, as the human's Role… sets it; no tool changes it later.",
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_sessions',
    description:
      'Lists the sessions of your Menkar project: name, id, shown state (working, blocked, idle, done), context used, parent, and whether it has a tab.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'last_reply',
    description:
      "Returns the last reply of a session of your Menkar project, by its name: a worker's report is its last message. At most 20,000 characters.",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: "The session's name." } },
      required: ['name'],
    },
  },
  {
    name: 'topic_add',
    description:
      "Adds a topic for the human to your Menkar project's open topics, shown in Menkar's sidebar; you are recorded as who raised it, and its number is returned.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short title.' },
        context: { type: 'string', description: 'What the human needs to know to decide.' },
        blocking: { type: 'boolean', description: 'Work waits on it.' },
      },
      required: ['title', 'context'],
    },
  },
  {
    name: 'topic_update',
    description:
      'Changes an open topic of your Menkar project by its number: its title, context, whether it blocks, or its status (open or discussing).',
    inputSchema: {
      type: 'object',
      properties: {
        number: { type: 'integer', description: "The topic's number." },
        title: { type: 'string' },
        context: { type: 'string' },
        blocking: { type: 'boolean' },
        status: { type: 'string', enum: ['open', 'discussing'] },
      },
      required: ['number'],
    },
  },
  {
    name: 'topic_close',
    description:
      'Closes a topic of your Menkar project by its number, keeping the decision taken so it can be looked up later.',
    inputSchema: {
      type: 'object',
      properties: {
        number: { type: 'integer', description: "The topic's number." },
        decision: { type: 'string', description: 'What was decided.' },
      },
      required: ['number', 'decision'],
    },
  },
  {
    name: 'topic_list',
    description:
      "Lists your Menkar project's open topics, those raised by priority sessions first: number, title, who raised it, whether it blocks, status and context; with all, the closed ones too, with their decision.",
    inputSchema: {
      type: 'object',
      properties: {
        all: { type: 'boolean', description: 'Include closed topics and their decisions.' },
      },
    },
  },
  {
    name: 'adopt_session',
    description:
      'Makes a session of your Menkar project your child, so Menkar wakes you when it waits or ends its turn. Only the orchestrator, in the orchestration mode; call it only when the human asks for it explicitly.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: "The session's name." } },
      required: ['name'],
    },
  },
]

export interface ServerContext {
  readonly pane: string | null
  call(tool: ToolName, args: Record<string, unknown>): Promise<ControlAnswer>
}

interface Message {
  readonly id?: unknown
  readonly method?: unknown
  readonly params?: unknown
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTool = (name: unknown): name is ToolName =>
  typeof name === 'string' && (TOOL_NAMES as readonly string[]).includes(name)

const toolResult = (answer: ControlAnswer) => ({
  content: [{ type: 'text', text: answer.text }],
  ...(answer.ok ? {} : { isError: true }),
})

export async function answer(message: Message, ctx: ServerContext): Promise<object | null> {
  if (message.id === undefined) return null
  const reply = (result: object) => ({ jsonrpc: '2.0', id: message.id, result })
  const params = isObject(message.params) ? message.params : {}
  switch (message.method) {
    case 'initialize':
      return reply({
        protocolVersion:
          typeof params.protocolVersion === 'string' ? params.protocolVersion : '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'menkar', version: '1' },
      })
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      if (!ctx.pane) return reply(toolResult({ ok: false, text: NO_PANE }))
      if (!isTool(params.name)) return reply(toolResult({ ok: false, text: UNKNOWN_TOOL }))
      const args = isObject(params.arguments) ? params.arguments : {}
      return reply(toolResult(await ctx.call(params.name, args)))
    }
    default:
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: 'Method not found' },
      }
  }
}
