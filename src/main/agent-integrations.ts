import { descriptorOf } from '../core/agents/descriptors'
import { AGENT_IDS, type AgentId, parseAgentId } from '../core/agents/ids'
import { kitOf } from '../core/agents/registry'
import type { IntegrationContext } from '../core/agents/types'
import { IntegrationError } from '../core/context/integrations'
import { flavorFacts } from '../core/flavor'
import { t, translate } from '../core/i18n'
import { programsFolder } from '../core/paths'
import { findOnPath } from '../core/sessions/installed'
import type { AgentItemsGroup } from '../shared/ipc'

// The integrations items each agent's kit offers for its own configuration files. An agent's items
// are greyed while its CLI is not on the PATH, looked up each time Settings asks.

const context = (): IntegrationContext => ({
  execPath: process.execPath,
  programs: programsFolder(),
})

const found = async (agent: AgentId) => (await findOnPath(descriptorOf(agent).command)) !== null

export async function agentItems(): Promise<AgentItemsGroup[]> {
  const groups: AgentItemsGroup[] = []
  for (const agent of AGENT_IDS) {
    const offered = kitOf(agent).integrations
    if (!offered) continue
    const descriptor = descriptorOf(agent)
    const here = await found(agent)
    const notes: string[] = []
    if (!here) notes.push(t('integrations.agentNotFound', { command: descriptor.command }))
    if (flavorFacts().ownsOnly) notes.push(t('integrations.agentSandbox'))
    groups.push({
      agent,
      label: translate(descriptor.label),
      title: translate(offered.title),
      description: translate(offered.description),
      notes,
      found: here,
      items: await Promise.all(
        offered.items.map(async (item) => ({
          key: item.key,
          title: translate(item.title),
          subtitle: translate(item.subtitle),
          on: await item.on(),
        })),
      ),
    })
  }
  return groups
}

export async function setAgentItem(
  agentValue: string,
  key: string,
  on: boolean,
): Promise<{ on: boolean; error: string | null }> {
  const agent = parseAgentId(agentValue)
  const item = agent ? kitOf(agent).integrations?.items.find((i) => i.key === key) : undefined
  if (!agent || !item) return { on: false, error: t('integrations.agentItemUnknown') }
  if (!(await found(agent)))
    return {
      on: await item.on(),
      error: t('integrations.agentNotFound', { command: descriptorOf(agent).command }),
    }
  try {
    await item.set(on, context())
    return { on: await item.on(), error: null }
  } catch (error) {
    if (!(error instanceof IntegrationError)) throw error
    return { on: await item.on(), error: error.message }
  }
}
