import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface Transcript {
  readonly path: string
  readonly sessionId: string
}

function entries(dir: string): string[] {
  try {
    return readdirSync(dir).sort()
  } catch {
    return [] // a folder that vanished or cannot be listed has no transcripts to read
  }
}

// Every Claude Code transcript with the session it counts for: `<project>/<session>.jsonl`, and a
// subagent's `<project>/<session>/subagents/<agent>.jsonl`, which counts for its parent session.
export function listTranscripts(projectsDir: string): Transcript[] {
  const found: Transcript[] = []
  const subagents: Transcript[] = []
  for (const project of entries(projectsDir)) {
    const projectDir = join(projectsDir, project)
    for (const name of entries(projectDir)) {
      if (name.endsWith('.jsonl')) {
        found.push({ path: join(projectDir, name), sessionId: name.slice(0, -'.jsonl'.length) })
        continue
      }
      for (const agent of entries(join(projectDir, name, 'subagents'))) {
        if (agent.endsWith('.jsonl')) {
          subagents.push({ path: join(projectDir, name, 'subagents', agent), sessionId: name })
        }
      }
    }
  }
  return [...found, ...subagents]
}
