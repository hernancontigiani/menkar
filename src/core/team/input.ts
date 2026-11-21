import type { Project } from '../projects/model'
import { keptOrchestration } from '../projects/orchestration'
import { keptParents } from '../projects/parents'
import { type TeamAgent, type TeamInput, teamBlock, teamFacts } from './block'
import type { TeamText } from './posts'

export interface TeamInputArgs {
  readonly project: Project
  // Null while the session is not yet a member: the human's new session, a fork.
  readonly session: string | null
  // The name a session not yet a member started with.
  readonly startName?: string
  // A session's name: its custom title or the one Menkar started it with. Claude's derived title
  // is not one: it changes as the conversation goes, and would post every time.
  readonly named: (sessionId: string) => string | undefined
  // Whether the session can load a stored skill of this name.
  readonly found: (skill: string) => boolean
  // That skill's SKILL.md, for an agent that loads a skill by reading it.
  readonly file?: (skill: string) => string | undefined
  // The folder of Menkar's own skills.
  readonly ownSkills?: string
  readonly context: TeamInput['context']
}

// How another session is called in the facts when it has no name of its own.
const callName = (named: TeamInputArgs['named'], id: string) => named(id) ?? id.slice(0, 8)

// Null with the mode off: such a project's sessions get no block at all.
export function teamInput(args: TeamInputArgs): TeamInput | null {
  const { project, session, named, context } = args
  const own = args.ownSkills ? { ownSkills: args.ownSkills } : {}
  const o = keptOrchestration(project.orchestration, project.members)
  if (!o?.on) return null
  const orchestrator: TeamInput['orchestrator'] =
    o.orchestrator === undefined
      ? null
      : o.orchestrator === session
        ? 'self'
        : { name: callName(named, o.orchestrator) }
  if (session === null)
    return {
      project: project.name,
      ...(args.startName ? { name: args.startName } : {}),
      orchestrator,
      skills: [],
      context,
      ...own,
    }
  const name = named(session)
  const role = o.roles?.[session]
  const parent = keptParents(project)[session]
  const stored = o.skills ?? {}
  const maintainerOf = (skill: string) =>
    Object.entries(stored).find(
      ([id, list]) => id !== session && list.some((s) => s.name === skill && s.maintainer),
    )?.[0]
  return {
    project: project.name,
    ...(name ? { name } : {}),
    ...(role ? { role } : {}),
    orchestrator,
    ...(parent
      ? { parent: { name: callName(named, parent), orchestrator: parent === o.orchestrator } }
      : {}),
    skills: (stored[session] ?? []).map((s) => {
      const holder = s.maintainer ? undefined : maintainerOf(s.name)
      const found = args.found(s.name)
      const file = found ? args.file?.(s.name) : undefined
      return {
        name: s.name,
        maintainer: s.maintainer === true,
        ...(holder ? { maintainedBy: callName(named, holder) } : {}),
        found,
        ...(file ? { file } : {}),
      }
    }),
    context,
    ...own,
  }
}

export function teamText(
  input: TeamInput,
  agent: TeamAgent,
  common: string,
  part: string,
): TeamText {
  const facts = teamFacts(input, agent)
  return { facts, block: teamBlock(facts, common, part) }
}
