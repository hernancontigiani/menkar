import { shellQuote } from '../../command'
import { claudeVersion, TEAM_FLOOR, teamFlagsAllowed } from '../../team/version'
import type { TeamDelivery } from '../types'

export const team: TeamDelivery = {
  skill: (name) => `\`${name}\``,
  own: (name) => `\`menkar:${name}\``,
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
