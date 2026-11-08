import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

export const AGENT_COMMANDS = { claude: 'claude', cursor: 'cursor-agent' } as const

// The absolute path of the first executable file of that name on the PATH, or null.
export async function findOnPath(
  command: string,
  path = process.env.PATH ?? '',
): Promise<string | null> {
  for (const dir of path.split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, command)
    try {
      await access(candidate, constants.X_OK)
      if ((await stat(candidate)).isFile()) return candidate
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT' && code !== 'EACCES' && code !== 'ENOTDIR') throw error
    }
  }
  return null
}

// An agent is installed when an executable file of its command's name is on the PATH.
export async function onPath(command: string, path = process.env.PATH ?? ''): Promise<boolean> {
  return (await findOnPath(command, path)) !== null
}
