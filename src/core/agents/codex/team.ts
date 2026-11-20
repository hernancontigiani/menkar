import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { shellQuote } from '../../command'
import { log } from '../../log'
import type { LaunchFile, TeamDelivery } from '../types'
import { readUserConfig, tomlString } from './config'

// Codex has no skill flag: a session loads a skill by reading its SKILL.md, so the block names the
// file wherever it has one.
export const team: TeamDelivery = {
  skill: (name, file) => (file ? `\`${name}\` (\`${file}\`)` : `\`${name}\``),
  own: (name, folder) =>
    folder ? `\`menkar:${name}\` (\`${join(folder, name, 'SKILL.md')}\`)` : `\`menkar:${name}\``,
  byName: 'by reading its SKILL.md at the path given',
  part: 'codex.md',
  // A resume keeps the instructions the thread was created with, whatever the run passes, until
  // its next compaction rebuilds them from the run's.
  heldAtStart: (start, block, recorded) => {
    if (start.kind === 'new') return block
    if (start.kind === 'resume') return recorded ?? null
    return null
  },
  records: true,
  // `-c` replaces the user's own `developer_instructions` for the run, so the file holds both. A
  // TOML string read by the shell inside double quotes reaches Codex byte for byte.
  atStart: (_start, file) => ['-c', `"developer_instructions=$(cat ${shellQuote(file)})"`],
  floor: null,
}

// The file `atStart` names: Menkar's block, then the user's own instructions.
export const INSTRUCTIONS_FILE = 'codex-developer-instructions.toml'

export function instructionsFile(paneFiles: string, teamFile: string): LaunchFile {
  return {
    path: join(paneFiles, INSTRUCTIONS_FILE),
    text: async () => {
      const own = (await readUserConfig()).developerInstructions
      let block = ''
      try {
        block = await readFile(teamFile, 'utf8')
      } catch (error) {
        log.warn("the team block could not be read: the session gets the user's own only", {
          teamFile,
          error,
        })
      }
      return tomlString(joinInstructions(block, own))
    },
  }
}

export function joinInstructions(block: string, own: string | null): string {
  const parts = [block.trimEnd(), own ?? ''].filter((part) => part.trim() !== '')
  return parts.join('\n\n')
}
