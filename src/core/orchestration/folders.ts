export interface ProjectFolder {
  readonly path: string
  // The human added it by hand, so it can be removed; the others come from the sessions.
  readonly added: boolean
}

// No Node import: the renderer compiles this file too.
export const isAbsoluteFolder = (path: string): boolean => /^(\/|[A-Za-z]:[\\/])/.test(path)

const trimmed = (path: string): string => {
  const cut = path.replace(/[\\/]+$/, '')
  return cut === '' || /^[A-Za-z]:$/.test(cut) ? path : cut
}

// The folders of the project's sessions, running or not, each once in the order given, then the
// ones added by hand that no session already has.
export function projectFolders(
  cwds: readonly (string | null | undefined)[],
  added: readonly string[],
): ProjectFolder[] {
  const seen = new Set<string>()
  const out: ProjectFolder[] = []
  const take = (path: string, isAdded: boolean) => {
    const key = trimmed(path)
    if (seen.has(key)) return
    seen.add(key)
    out.push({ path: key, added: isAdded })
  }
  for (const cwd of cwds) if (cwd) take(cwd, false)
  for (const path of added) take(path, true)
  return out
}

// start_session's folder, in English for the agent that called; absent, null: the caller's own.
export function startFolder(
  value: unknown,
  known: readonly string[],
): { readonly folder: string | null } | { readonly refusal: string } {
  if (value === undefined) return { folder: null }
  if (typeof value !== 'string' || !isAbsoluteFolder(value))
    return { refusal: 'The folder must be an absolute path.' }
  const folder = trimmed(value)
  if (known.includes(folder)) return { folder }
  return {
    refusal: `${folder} is not one of this project's folders: ${known.join(', ') || 'none yet'}. The human adds one in the project's orchestration settings.`,
  }
}

// A project's folders from its members, earlier conversations included, by path so a list of them
// stays put while sessions write. A session just started has no transcript yet: its pane's folder
// stands in.
export function membersFolders(
  members: readonly string[],
  sessions: readonly { readonly id: string; readonly cwd: string | null }[],
  paneCwds: ReadonlyMap<string, string>,
  added: readonly string[],
): ProjectFolder[] {
  const byId = new Map(sessions.map((s) => [s.id, s.cwd]))
  const cwds = members.flatMap((id) => {
    const cwd = byId.get(id) ?? paneCwds.get(id)
    return cwd ? [cwd] : []
  })
  return projectFolders(
    cwds.sort((a, b) => a.localeCompare(b)),
    added,
  )
}

// The ones gone from disk, in order. `exists` is the caller's: main asks the disk, off the UI path.
export async function missingFolders(
  folders: readonly ProjectFolder[],
  exists: (path: string) => Promise<boolean>,
): Promise<string[]> {
  const present = await Promise.all(folders.map((f) => exists(f.path)))
  return folders.flatMap((f, i) => (present[i] ? [] : [f.path]))
}

// What Ctrl+` and the first-time card offer: a shell or a session cannot start in a folder gone.
export const presentFolders = (
  folders: readonly ProjectFolder[],
  missing: readonly string[],
): string[] => folders.flatMap((f) => (missing.includes(f.path) ? [] : [f.path]))
