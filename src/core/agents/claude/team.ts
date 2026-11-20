import { shellQuote } from '../../command'
import { claudeVersion, TEAM_FLOOR, teamFlagsAllowed } from '../../team/version'
import type { TeamDelivery } from '../types'

export const team: TeamDelivery = {
  skill: (name) => `\`${name}\``,
  own: (name) => `\`menkar:${name}\``,
  // A turn a peer message opens gets no skill listing until its first tool call; Skill by name
  // works before that.
  byName: 'with the Skill tool, by name, even if not in your listing yet',
  part: 'claude.md',
  // A fork carries its source's block, not its own.
  heldAtStart: (start, block) => (start.kind === 'fork' ? null : block),
  // Last on the line, where no option can take the file for its value. A resume without the
  // snapshot flag keeps the block recorded when the conversation began, until its next compaction.
  atStart: (start, file) => [
    ...(start.kind === 'resume' ? ['--system-prompt-snapshot', 'off'] : []),
    '--append-system-prompt-file',
    shellQuote(file),
  ],
  floor: {
    version: TEAM_FLOOR,
    read: claudeVersion,
    accepts: teamFlagsAllowed,
    notice: 'team.oldClaude',
  },
}
