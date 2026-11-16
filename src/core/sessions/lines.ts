import type { AgentId } from '../agents/ids'

export type Agent = AgentId

export { chunkLines, type Line, messageText, parseLine } from '../agents/shared/jsonl'
