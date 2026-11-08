// Transcript lines with what usage reads from them — who opened a turn, tool calls and their
// results, responses with tokens — and the directories a pass reads and writes. Synthetic only.
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Memberships } from '../../src/core/usage/history'

export type Line = Record<string, unknown>

// Local wall time on 2026-11-08 (or another day), as the transcript's UTC ISO string.
export function at(time: string, day = '2026-11-08'): string {
  return new Date(`${day}T${time}`).toISOString()
}

export function prompt(time: string, extra: Line = {}): Line {
  return { type: 'user', uuid: `u-${time}`, timestamp: at(time), turnOrigin: 'human', ...extra }
}

export function plainPrompt(time: string, extra: Line = {}): Line {
  return {
    type: 'user',
    uuid: `p-${time}`,
    timestamp: at(time),
    message: { content: 'hi' },
    ...extra,
  }
}

export interface Tokens {
  input?: number
  output?: number
  cacheWrite?: number
  cacheWrite1h?: number
  cacheRead?: number
}

export function response(
  time: string,
  options: {
    id?: string
    request?: string | null
    model?: string
    tokens?: Tokens
    tools?: { id: string; name?: string }[]
    extra?: Line
  } = {},
): Line {
  const t = options.tokens ?? { output: 10 }
  const usage: Line = {
    input_tokens: t.input ?? 0,
    output_tokens: t.output ?? 0,
    cache_creation_input_tokens: t.cacheWrite ?? 0,
    cache_read_input_tokens: t.cacheRead ?? 0,
  }
  if (t.cacheWrite1h !== undefined)
    usage.cache_creation = { ephemeral_1h_input_tokens: t.cacheWrite1h }
  const content = (options.tools ?? []).map((tool) => ({
    type: 'tool_use',
    id: tool.id,
    name: tool.name ?? 'Bash',
    input: {},
  }))
  const line: Line = {
    type: 'assistant',
    timestamp: at(time),
    message: {
      id: options.id ?? `msg_${time}`,
      model: options.model ?? 'claude-opus-5-5',
      usage,
      content,
    },
    ...options.extra,
  }
  if (options.request !== null) line.requestId = options.request ?? `req_${time}`
  return line
}

export function result(time: string, toolId: string, extra: Line = {}): Line {
  return {
    type: 'user',
    timestamp: at(time),
    toolUseResult: { stdout: '' },
    message: { content: [{ type: 'tool_result', tool_use_id: toolId, content: 'ok' }] },
    ...extra,
  }
}

export function jsonl(lines: readonly (Line | string)[]): string {
  return `${lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n')}\n`
}

// A fresh set of directories for one test: the transcripts, the cache and the history.
export function usageDirs(name: string) {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', `usage-${name}-`))
  const claudeProjects = join(root, 'claude', 'projects')
  mkdirSync(claudeProjects, { recursive: true })
  return {
    root,
    claudeProjects,
    cache: join(root, 'cache', 'usage.sqlite'),
    history: join(root, 'data', 'history.sqlite'),
    statuslineLog: join(root, 'cache', 'usage.jsonl'),
    // a transcript of `session` in folder `project`
    transcript(session: string, lines: readonly (Line | string)[], project = '-home-demo-app') {
      const dir = join(claudeProjects, project)
      mkdirSync(dir, { recursive: true })
      const path = join(dir, `${session}.jsonl`)
      writeFileSync(path, jsonl(lines))
      return path
    },
    append(path: string, lines: readonly (Line | string)[]) {
      appendFileSync(path, jsonl(lines))
    },
    subagent(parent: string, agent: string, lines: readonly Line[], project = '-home-demo-app') {
      const dir = join(claudeProjects, project, parent, 'subagents')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${agent}.jsonl`), jsonl(lines))
    },
  }
}

export function memberships(
  sessions: Record<string, [string, string]> = {},
  projectNames: Record<string, string> = {},
): Memberships {
  const names = new Map(Object.entries(projectNames))
  for (const [id, name] of Object.values(sessions)) if (!names.has(id)) names.set(id, name)
  return {
    sessions: new Map(Object.entries(sessions).map(([s, [id, name]]) => [s, { id, name }])),
    projectNames: names,
  }
}
