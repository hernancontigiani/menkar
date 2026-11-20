import { AGENT_IDS } from '../agents/ids'
import { kitOf } from '../agents/registry'
import type { Agent } from '../sessions/lines'

export interface TeamSkill {
  readonly name: string
  readonly maintainer: boolean
  /** The session that maintains it, when it is not this one. */
  readonly maintainedBy?: string
  /** Loadable from this session's folder chain or the user's skills. */
  readonly found: boolean
  /** Its SKILL.md, when found. */
  readonly file?: string
}

export interface TeamInput {
  readonly project: string
  /** Absent while the session has no name of its own (not Claude's derived title). */
  readonly name?: string
  readonly role?: string
  readonly orchestrator: 'self' | { readonly name: string } | null
  readonly parent?: { readonly name: string; readonly orchestrator: boolean }
  readonly skills: readonly TeamSkill[]
  /** The human's ring thresholds, in percent. */
  readonly context: { readonly warn: number; readonly full: number }
  /** The folder of Menkar's own skills, for an agent that loads a skill by its file. */
  readonly ownSkills?: string
}

export interface TeamAgent {
  /** How the agent is told to load a project's or the user's skill, given its SKILL.md if found. */
  readonly skill: (name: string, file?: string) => string
  /** How the agent is told to load one of Menkar's own skills, given their folder. */
  readonly own: (name: string, folder?: string) => string
  /** How the agent loads a skill by name, one its listing may not show yet: a clause. */
  readonly byName: string
  /** The agent's part of the protocol, a file in the plugin's `team/` folder. */
  readonly part: string
}

// The agents that have a team delivery, each with its record.
export const TEAM_AGENTS: Readonly<Partial<Record<Agent, TeamAgent>>> = Object.fromEntries(
  AGENT_IDS.flatMap((id) => {
    const team = kitOf(id).team
    return team ? [[id, team]] : []
  }),
)

export function teamAgent(agent: Agent): TeamAgent | null {
  return kitOf(agent).team
}

const ROLE_MAX = 60

// The role is agent-written; it must not break the line or the quotes it sits in.
function cleanRole(role: string): string {
  const one = role
    .replace(/[`"]/g, '')
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .trim()
  return one.length > ROLE_MAX ? `${one.slice(0, ROLE_MAX - 1)}…` : one
}

function who(input: TeamInput, role: string): string {
  const parts = [
    input.name === undefined
      ? `You are a new session of the Menkar project "${input.project}", in orchestration mode.`
      : `You are \`${input.name}\`, a session of the Menkar project "${input.project}", in orchestration mode.`,
  ]
  if (role) parts.push(`Your role: "${role}".`)
  const { orchestrator, parent } = input
  if (orchestrator === 'self') parts.push('You are its orchestrator.')
  else if (parent?.orchestrator) parts.push(`Your parent is \`${parent.name}\`, the orchestrator.`)
  else if (parent && orchestrator)
    parts.push(`Your parent is \`${parent.name}\`; the orchestrator is \`${orchestrator.name}\`.`)
  else if (parent)
    parts.push(`Your parent is \`${parent.name}\`. The project has no orchestrator yet.`)
  else if (orchestrator)
    parts.push(`You have no parent; the orchestrator is \`${orchestrator.name}\`.`)
  else parts.push('The project has no orchestrator yet.')
  return parts.join(' ')
}

function skills(input: TeamInput, agent: TeamAgent): string | null {
  const items: string[] = []
  const own = (name: string) => agent.own(name, input.ownSkills)
  if (input.orchestrator === 'self') items.push(own('orchestrator'))
  let explained = false
  for (const skill of input.skills) {
    const name = agent.skill(skill.name, skill.file)
    if (!skill.found) items.push(`${name} (not found: tell the human)`)
    else if (skill.maintainer) {
      items.push(
        explained
          ? `${name}, which you maintain`
          : `${name}, which you maintain (only you change it, with ${own('distill')})`,
      )
      explained = true
    } else if (skill.maintainedBy)
      items.push(`${name}, read only (\`${skill.maintainedBy}\` maintains it)`)
    else items.push(`${name}, read only`)
  }
  if (items.length === 0) return null
  return `Skills to have loaded (any not loaded yet you load ${agent.byName}): ${items.join('; ')}.`
}

function renewal(input: TeamInput, agent: TeamAgent, role: string): string | null {
  const { warn, full } = input.context
  if (input.orchestrator === 'self') return null
  if (input.parent)
    return `Your parent decides when you renew; when your context (your row in \`list_sessions\`) passes ${full}%, tell it by name.`
  if (!role) return null
  const distill = input.skills.some((skill) => skill.maintainer)
    ? `run ${agent.own('distill', input.ownSkills)}, then renew`
    : 'renew'
  return `You decide when you renew: when a consultation closes and your context (your row in \`list_sessions\`) is past ${warn}%, ${distill}; prefer that to a compaction.`
}

/** The session's facts: who it is in the team, what to load, when to renew. */
export function teamFacts(input: TeamInput, agent: TeamAgent): string {
  const role = cleanRole(input.role ?? '')
  const lines = ['# Your team in Menkar', who(input, role)]
  const load = skills(input, agent)
  if (load) lines.push(load)
  if (input.orchestrator !== 'self')
    lines.push(
      `When a session hands you a task, load ${agent.own('worker', input.ownSkills)} first, ${agent.byName}.`,
    )
  const renew = renewal(input, agent, role)
  if (renew) lines.push(renew)
  return lines.join('\n')
}

export function teamBlock(facts: string, common: string, part: string): string {
  return `${[facts, common, part].map((text) => text.trimEnd()).join('\n\n')}\n`
}
