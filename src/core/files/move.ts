import { constants } from 'node:fs'
import { copyFile, link, unlink } from 'node:fs/promises'

export interface MoveOps {
  readonly link: typeof link
  readonly copyFile: typeof copyFile
  readonly unlink: typeof unlink
}

const errno = (error: unknown) => (error as NodeJS.ErrnoException).code

// Where a hard link cannot be made: another file system, or one without hard links.
const NO_LINK = new Set(['EXDEV', 'EPERM', 'ENOTSUP', 'EOPNOTSUPP'])

// Moves a file, failing with EEXIST rather than replacing one already at `to`, even one that
// appeared after its free name was chosen: rename() would silently replace it. A hard link is
// made first, which refuses an existing name atomically, then the source is removed; where no link
// can be made, an exclusive copy then the removal. A failed copy leaves the source, and removes
// only its own partial copy, never a file that was there.
export async function moveExclusive(
  from: string,
  to: string,
  ops: MoveOps = { link, copyFile, unlink },
): Promise<void> {
  try {
    await ops.link(from, to)
    await ops.unlink(from)
    return
  } catch (error) {
    if (!NO_LINK.has(errno(error) ?? '')) throw error
  }
  try {
    await ops.copyFile(from, to, constants.COPYFILE_EXCL)
  } catch (error) {
    if (errno(error) !== 'EEXIST')
      await ops.unlink(to).catch((cleanup: unknown) => {
        if (errno(cleanup) !== 'ENOENT') throw cleanup
      })
    throw error
  }
  await ops.unlink(from)
}
