import { descriptor as claude } from './claude/descriptor'
import { descriptor as cursor } from './cursor/descriptor'
import type { AgentId } from './ids'
import type { AgentDescriptor } from './types'

export const DESCRIPTORS: Readonly<Record<AgentId, AgentDescriptor>> = { claude, cursor }

export function descriptorOf(id: AgentId): AgentDescriptor {
  return DESCRIPTORS[id]
}
