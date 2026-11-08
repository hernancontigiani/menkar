import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

export const AGENT_COMMANDS = { claude: 'claude', cursor: 'cursor-agent' } as const

// An agent is installed when an executable file of its command's name is on the PATH.
export async function onPath(command: string, path = process.env.PATH ?? ''): Promise<boolean> {
  for (const dir of path.split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, command)
    try {
      await access(candidate, constants.X_OK)
      if ((await stat(candidate)).isFile()) return true
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT' && code !== 'EACCES' && code !== 'ENOTDIR') throw error
    }
  }
  return false
}
