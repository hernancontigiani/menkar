import { stat } from 'node:fs/promises'
import { terminalPath } from '../links'
import { log } from '../log'

// What a path that is not there, or not ours to see, answers.
const ABSENT = new Set(['ENOENT', 'ENOTDIR', 'EACCES', 'ENAMETOOLONG', 'ELOOP'])

// Whether a path printed in a terminal names a file or folder on disk, `~/` under `home`.
export async function terminalPathExists(text: string, home: string): Promise<string | null> {
  const path = terminalPath(text, home)
  if (!path) return null
  try {
    await stat(path)
    return path
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? ''
    if (!ABSENT.has(code)) log.warn('a terminal path could not be checked', { path, error })
    return null
  }
}
