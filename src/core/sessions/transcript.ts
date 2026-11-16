import { kitOf } from '../agents/registry'
import type { TranscriptReading } from '../agents/types'
import type { Details } from './details'
import type { Agent } from './lines'

export type { Details, RecentMessage } from './details'

// The agent's transcript reading, for an agent whose sessions are JSONL transcripts.
export function transcriptOf(agent: Agent): TranscriptReading {
  const transcript = kitOf(agent).catalog.transcript
  if (!transcript) throw new Error(`the agent ${agent} keeps no transcripts`)
  return transcript
}

// What the session menus read from a whole transcript: details and export. Pure functions
// over the file's text; the caller reads it off the UI path.
export function details(file: string, agent: Agent): Details {
  return transcriptOf(agent).details(file)
}

// The name with every character that is not a letter, digit, space, `-` or `_` replaced by `_`.
export function safeFileName(name: string): string {
  const safe = name.replace(/[^\p{L}\p{N} _-]/gu, '_').trim()
  return `${safe || 'session'}.md`
}

export function exportMarkdown(name: string, id: string, file: string, agent: Agent): string {
  return transcriptOf(agent).exportMarkdown(name, id, file)
}
