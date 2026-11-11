import { dirname } from 'node:path'

export const DAY_MS = 24 * 60 * 60 * 1000

export interface TrashListing {
  readonly root: string
  readonly incoming: string
  // The project folders whose files may go.
  readonly folders: readonly string[]
  readonly entries: readonly {
    readonly path: string
    readonly file: boolean
    readonly mtimeMs: number
  }[]
}

// The files to send to the trash: a regular file, not a dotfile, directly in a project's folder
// (never the root's or the incoming folder's own), not open in a file tab, and not modified for
// more than `days` × 24 h. Age only, so midnight changes nothing. 0 days is off.
export function filesToTrash(
  listing: TrashListing,
  now: number,
  days: number,
  open: ReadonlySet<string>,
): string[] {
  if (days <= 0) return []
  const folders = new Set(
    listing.folders.filter((f) => f !== listing.root && f !== listing.incoming),
  )
  return listing.entries
    .filter(
      (e) =>
        e.file &&
        folders.has(dirname(e.path)) &&
        !(e.path.split(/[/\\]/).pop() ?? '').startsWith('.') &&
        !open.has(e.path) &&
        now - e.mtimeMs > days * DAY_MS,
    )
    .map((e) => e.path)
}
