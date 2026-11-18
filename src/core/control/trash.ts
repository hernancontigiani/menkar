import { insideFolder } from '../files/folders'

// trash_files: the orchestrator moves files of its project's files folder to the system's trash.

export type TrashCheck =
  | { readonly ok: false; readonly text: string }
  | { readonly ok: true; readonly names: readonly string[] }

export function trashCheck(
  orchestrator: string | null,
  caller: string,
  names: unknown,
): TrashCheck {
  if (orchestrator === null)
    return { ok: false, text: 'The orchestration mode is off in this project.' }
  if (caller !== orchestrator)
    return { ok: false, text: "Only this project's orchestrator trashes its files." }
  if (
    !Array.isArray(names) ||
    names.length === 0 ||
    !names.every((n): n is string => typeof n === 'string')
  )
    return { ok: false, text: 'names must be a list of file names.' }
  return { ok: true, names: [...new Set(names)] }
}

// The path a name may be trashed at: a plain file name of the folder itself, never a path, a
// parent or a dotfile.
export function trashPath(folder: string, name: string): string | null {
  return insideFolder(folder, name)
}

// What was found at the path, looked at without following a link: a link is never followed out
// of the folder, and a folder is not a file.
export type Found = 'file' | 'missing' | 'other'

export type TrashOutcome = 'trashed' | 'outside' | 'missing' | 'not-a-file' | 'failed'

export function outcomeBefore(path: string | null, found: Found): TrashOutcome | null {
  if (path === null) return 'outside'
  if (found === 'missing') return 'missing'
  if (found === 'other') return 'not-a-file'
  return null
}

const WHY: Record<Exclude<TrashOutcome, 'trashed'>, string> = {
  outside: "not a file of this project's files folder",
  missing: 'no such file',
  'not-a-file': 'a folder or a link, not a file',
  failed: 'the system refused to trash it',
}

export function trashAnswer(
  results: readonly { readonly name: string; readonly outcome: TrashOutcome }[],
): { readonly ok: boolean; readonly text: string } {
  const trashed = results.filter((r) => r.outcome === 'trashed').map((r) => r.name)
  const kept = results.flatMap((r) =>
    r.outcome === 'trashed' ? [] : [`${r.name} (${WHY[r.outcome]})`],
  )
  const lines = [
    trashed.length > 0 ? `Trashed: ${trashed.join(', ')}.` : 'Nothing was trashed.',
    ...(kept.length > 0 ? [`Not trashed: ${kept.join(', ')}.`] : []),
  ]
  return { ok: kept.length === 0, text: lines.join(' ') }
}
