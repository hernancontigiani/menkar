// Decision 1.60: a file in a project's folder not modified for N days goes to the trash; nothing
// outside project folders is ever chosen.
import { describe, expect, test } from 'vitest'
import { DAY_MS, filesToTrash, type TrashListing } from '../../../src/core/files/trash'

const NOW = new Date(2026, 10, 11, 0, 0, 30).getTime()
const P = '/h/Menkar/P/files'
const Q = '/h/Menkar/Q/files'

const listing = (entries: TrashListing['entries']): TrashListing => ({
  root: '/h/Menkar',
  incoming: '/h/Downloads',
  folders: [P, Q],
  entries,
})
const old = NOW - 30 * DAY_MS - 1000
const recent = NOW - 30 * DAY_MS + 1000

describe('the trash timer', () => {
  test('30 days and a second old is trashed; a second short of 30 days is kept', () => {
    const chosen = filesToTrash(
      listing([
        { path: `${P}/old.pdf`, file: true, mtimeMs: old },
        { path: `${Q}/recent.pdf`, file: true, mtimeMs: recent },
      ]),
      NOW,
      30,
      new Set(),
    )
    expect(chosen).toEqual([`${P}/old.pdf`])
  })

  test('0 days is off: nothing is trashed', () => {
    expect(
      filesToTrash(listing([{ path: `${P}/old.pdf`, file: true, mtimeMs: 0 }]), NOW, 0, new Set()),
    ).toEqual([])
  })

  test('a subfolder, a dotfile and a file open in a file tab are kept', () => {
    const chosen = filesToTrash(
      listing([
        { path: `${P}/sub`, file: false, mtimeMs: old },
        { path: `${P}/.hidden`, file: true, mtimeMs: old },
        { path: `${P}/open.md`, file: true, mtimeMs: old },
      ]),
      NOW,
      30,
      new Set([`${P}/open.md`]),
    )
    expect(chosen).toEqual([])
  })

  test('the incoming folder, the root, and a folder deeper in a project folder are never chosen', () => {
    const chosen = filesToTrash(
      listing([
        { path: '/h/Downloads/old.pdf', file: true, mtimeMs: old },
        { path: '/h/Menkar/old.pdf', file: true, mtimeMs: old },
        { path: `${P}/sub/old.pdf`, file: true, mtimeMs: old },
        { path: '/elsewhere/old.pdf', file: true, mtimeMs: old },
      ]),
      NOW,
      30,
      new Set(),
    )
    expect(chosen).toEqual([])
  })

  test('a project folder that is the incoming folder is never trashed in', () => {
    const chosen = filesToTrash(
      { ...listing([{ path: `${P}/old.pdf`, file: true, mtimeMs: old }]), incoming: P },
      NOW,
      30,
      new Set(),
    )
    expect(chosen).toEqual([])
  })
})
