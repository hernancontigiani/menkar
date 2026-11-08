// The MCP servers browser's content, from Claude Code's ~/.claude.json, read only. No Node import:
// main reads the file and hands the text here.

export interface McpServer {
  readonly name: string
  readonly summary: string
}

export interface McpSection {
  // null for the global section, whose title and description the view says
  readonly path: string | null
  readonly servers: readonly McpServer[]
}

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function serverSummary(server: unknown): string {
  const s = isObject(server) ? server : {}
  const type = typeof s.type === 'string' ? s.type : null
  if (typeof s.url === 'string') return `${type ?? 'http'} · ${s.url}`
  if (typeof s.command === 'string') {
    const args = Array.isArray(s.args) ? s.args.map(String) : []
    return `${type ?? 'stdio'} · ${[s.command, ...args].join(' ')}`.trim()
  }
  return type ?? '—'
}

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function servers(map: unknown): McpServer[] {
  if (!isObject(map)) return []
  return Object.keys(map)
    .sort(byName)
    .map((name) => ({ name, summary: serverSummary(map[name]) }))
}

// The sections to show: the global servers, then one per project that defines its own, by path.
// Nothing configured, or a file that cannot be read as an object: no sections.
export function mcpSections(text: string | null): McpSection[] {
  if (text === null) return []
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  if (!isObject(data)) return []
  const sections: McpSection[] = []
  const global = servers(data.mcpServers)
  if (global.length > 0) sections.push({ path: null, servers: global })
  const projects = isObject(data.projects) ? data.projects : {}
  for (const path of Object.keys(projects).sort(byName)) {
    const project = projects[path]
    const own = servers(isObject(project) ? project.mcpServers : undefined)
    if (own.length > 0) sections.push({ path, servers: own })
  }
  return sections
}
