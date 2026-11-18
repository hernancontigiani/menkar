import { describe, expect, it } from 'vitest'
import { DESCRIPTORS, paneAgentLabel } from '../../../src/core/agents/descriptors'
import { AGENT_IDS } from '../../../src/core/agents/ids'

describe('paneAgentLabel', () => {
  it('names a shell pane as a shell', () => {
    expect(paneAgentLabel('shell')).toBe('agent.shell')
  })

  it('names an agent pane by its agent', () => {
    for (const id of AGENT_IDS) expect(paneAgentLabel(id)).toBe(DESCRIPTORS[id].label)
  })
})
