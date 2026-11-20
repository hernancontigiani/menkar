import { stat } from 'node:fs/promises'
import { terminalPath } from '../links'
import { log } from '../log'
import { checkFile } from './check'

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

// Where a path Ctrl+clicked in a terminal opens (decision 1.192): a file the editor opens, by the
// same file check every file tab passes, in a file tab; a folder, a file it refuses (a PDF, an
// image), or any path with Shift held, in the system's app.
export async function terminalOpensIn(
  path: string,
  home: string,
  system: boolean,
): Promise<'tab' | 'system'> {
  if (system) return 'system'
  return 'refusal' in (await checkFile(path, home)) ? 'system' : 'tab'
}
