// Each project's files folder under the Menkar folder (decisions 1.51, 1.58, 1.60): made when first
// needed, listed while its project is shown, files brought in from where shared files arrive and
// moved back on Undo, opened and dragged out, and old ones sent to the trash. Nothing here writes
// anywhere but a project's folder, the root's folder names, and the files the user brings in.
import { type FSWatcher, watch } from 'node:fs'
import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { app, BrowserWindow, dialog, shell, type WebContents } from 'electron'
import { now } from '../core/clock'
import { clashFree, insideFolder, safeFolderName, uniqueFolderName } from '../core/files/folders'
import { moveExclusive } from '../core/files/move'
import { DAY_MS, filesToTrash } from '../core/files/trash'
import { log } from '../core/log'
import { filesRoot, projectFilesFolder } from '../core/paths'
import type { Project } from '../core/projects/model'
import type { Settings } from '../core/settings'
import type { ProjectFile } from '../shared/workspace'

export interface ProjectFilesDeps {
  readonly projects: () => readonly Project[]
  readonly settings: () => Settings
  // The name a project's folder took, saved on the project.
  readonly named: (projectId: string, folderName: string) => void
  // Paths open in a file tab, which the trash timer leaves alone.
  readonly openFiles: () => ReadonlySet<string>
  // A shown project's listing changed.
  readonly listed: () => void
}

const LIST_DEBOUNCE_MS = 200
const NEWEST = 5
// The first trash run waits for the start to finish; then once a day.
const TRASH_FIRST_DELAY_MS = 5000
const TRASH_EVERY_MS = DAY_MS
const UNDO_KEEP_MS = 60_000

let deps: ProjectFilesDeps | undefined
const listings = new Map<string, readonly ProjectFile[]>()
const watches = new Map<string, { folder: string; watcher: FSWatcher; timer?: NodeJS.Timeout }>()
const undos = new Map<string, { moves: readonly Move[]; timer: NodeJS.Timeout }>()
let undoCount = 0

interface Move {
  readonly from: string
  readonly to: string
}

const errno = (error: unknown) => (error as NodeJS.ErrnoException).code

function need(): ProjectFilesDeps {
  if (!deps) throw new Error('project files used before startProjectFiles')
  return deps
}

const root = () => filesRoot(need().settings().files_root)

export function incomingFolder(): string {
  return need().settings().files_incoming || app.getPath('downloads')
}

function project(projectId: string): Project | undefined {
  return need()
    .projects()
    .find((p) => p.id === projectId)
}

// The folder, or null while it was never made.
export function folderOf(projectId: string): string | null {
  const name = project(projectId)?.filesFolder
  return name ? projectFilesFolder(root(), name) : null
}

async function namesIn(folder: string): Promise<string[]> {
  try {
    return await readdir(folder)
  } catch (error) {
    if (errno(error) === 'ENOENT') return []
    throw error
  }
}

// Made when first needed; its name is chosen once, safe and unique, and saved on the project.
export async function ensureFolder(projectId: string): Promise<string | null> {
  const p = project(projectId)
  if (!p) return null
  let name = p.filesFolder
  if (!name) {
    const taken = [
      ...need()
        .projects()
        .flatMap((other) => (other.filesFolder ? [other.filesFolder] : [])),
      ...(await namesIn(root())),
    ]
    name = uniqueFolderName(safeFolderName(p.name), taken)
  }
  const folder = projectFilesFolder(root(), name)
  await mkdir(folder, { recursive: true })
  if (!p.filesFolder) {
    log.info('a project files folder was made', { project: projectId, folder })
    need().named(projectId, name)
  }
  return folder
}

// A project renamed: its folder follows when it exists and the new name is free; else it keeps
// its old name, since moving files an app may have open is worse. The new name, or undefined.
export async function renameFolder(
  projectId: string,
  newName: string,
): Promise<string | undefined> {
  const p = project(projectId)
  if (!p?.filesFolder) return undefined
  const old = join(root(), p.filesFolder)
  const safe = safeFolderName(newName)
  if (safe === p.filesFolder) return undefined
  const others = need()
    .projects()
    .flatMap((o) => (o.id !== projectId && o.filesFolder ? [o.filesFolder.toLowerCase()] : []))
  const onDisk = (await namesIn(root())).map((n) => n.toLowerCase())
  const sameIgnoringCase = safe.toLowerCase() === p.filesFolder.toLowerCase()
  if (
    others.includes(safe.toLowerCase()) ||
    (!sameIgnoringCase && onDisk.includes(safe.toLowerCase()))
  ) {
    log.info('a project files folder kept its name: the new one is taken', { folder: old, safe })
    return undefined
  }
  try {
    await stat(old)
  } catch (error) {
    if (errno(error) !== 'ENOENT') throw error
    return safe
  }
  try {
    await rename(old, join(root(), safe))
  } catch (error) {
    log.warn('a project files folder could not be renamed; it keeps its name', {
      folder: old,
      error,
    })
    return undefined
  }
  closeWatch(projectId)
  return safe
}

async function listFolder(folder: string): Promise<ProjectFile[]> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(folder, { withFileTypes: true })
  } catch (error) {
    if (errno(error) === 'ENOENT') return []
    throw error
  }
  const files = await Promise.all(
    entries
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map(async (e) => {
        try {
          return { name: e.name, mtimeMs: (await stat(join(folder, e.name))).mtimeMs }
        } catch (error) {
          if (errno(error) === 'ENOENT') return null
          throw error
        }
      }),
  )
  return files.filter((f): f is ProjectFile => f !== null).sort((a, b) => b.mtimeMs - a.mtimeMs)
}

export function filesOf(projectId: string): readonly ProjectFile[] {
  return listings.get(projectId) ?? []
}

async function refresh(projectId: string): Promise<void> {
  const folder = folderOf(projectId)
  const listed = folder ? await listFolder(folder) : []
  listings.set(projectId, listed)
  need().listed()
}

function closeWatch(projectId: string): void {
  const w = watches.get(projectId)
  if (!w) return
  clearTimeout(w.timer)
  w.watcher.close()
  watches.delete(projectId)
}

// The shown projects' folders are watched and listed; the others are let go.
export function syncShown(shown: ReadonlySet<string>): void {
  if (!deps) return
  for (const id of [...watches.keys()]) if (!shown.has(id)) closeWatch(id)
  for (const id of [...listings.keys()]) if (!shown.has(id)) listings.delete(id)
  for (const id of shown) {
    const folder = folderOf(id)
    const current = watches.get(id)
    if (current && current.folder === folder) continue
    closeWatch(id)
    if (!listings.has(id) || current) void refresh(id).catch(logListFailure(id))
    if (!folder) continue
    try {
      const watcher = watch(folder, { persistent: false }, () => {
        const w = watches.get(id)
        if (!w) return
        clearTimeout(w.timer)
        w.timer = setTimeout(() => void refresh(id).catch(logListFailure(id)), LIST_DEBOUNCE_MS)
      })
      watcher.on('error', (error) => {
        log.warn('stopped watching a project files folder', { folder, error })
        closeWatch(id)
      })
      watches.set(id, { folder, watcher })
    } catch (error) {
      // Not made yet, or gone: listed as empty until it is made.
      if (errno(error) !== 'ENOENT')
        log.warn('could not watch a project files folder', { folder, error })
    }
  }
}

const logListFailure = (projectId: string) => (error: unknown) =>
  log.warn('a project files folder could not be listed', { project: projectId, error })

// Moves `from` into `folder` under `name`, or the next free ` (n)` name when one appears there
// meanwhile: a file already at the target is never replaced. The path it went to.
async function moveFree(from: string, folder: string, name: string): Promise<string> {
  const taken = new Set(await namesIn(folder))
  let chosen = clashFree(name, (n) => taken.has(n))
  for (;;) {
    const to = join(folder, chosen)
    try {
      await moveExclusive(from, to)
      return to
    } catch (error) {
      if (errno(error) !== 'EEXIST') throw error
      taken.add(chosen)
      chosen = clashFree(name, (n) => taken.has(n))
    }
  }
}

export interface Brought {
  readonly undo: string
  readonly names: readonly string[]
}

// Moves the files into the project's folder, a name already there taking ` (2)`.
export async function bringIn(
  projectId: string,
  paths: readonly string[],
): Promise<Brought | null> {
  const folder = await ensureFolder(projectId)
  if (!folder || paths.length === 0) return null
  const moves: Move[] = []
  for (const from of paths) {
    try {
      moves.push({ from, to: await moveFree(from, folder, basename(from)) })
    } catch (error) {
      log.warn('a file could not be brought into a project', { from, folder, error })
    }
  }
  if (moves.length === 0) return null
  syncShown(new Set([...watches.keys(), projectId]))
  void refresh(projectId).catch(logListFailure(projectId))
  undoCount += 1
  const undo = String(undoCount)
  undos.set(undo, { moves, timer: setTimeout(() => undos.delete(undo), UNDO_KEEP_MS) })
  return { undo, names: moves.map((m) => basename(m.to)) }
}

// Each file back where it came from, or beside it with ` (2)` when that name was taken since.
export async function undoBring(undo: string): Promise<void> {
  const found = undos.get(undo)
  if (!found) return
  clearTimeout(found.timer)
  undos.delete(undo)
  for (const m of found.moves) {
    try {
      await moveFree(m.to, dirname(m.from), basename(m.from))
    } catch (error) {
      log.warn('a brought-in file could not be moved back', { from: m.to, to: m.from, error })
    }
  }
}

// The newest regular files where shared files arrive, for ⬇'s menu.
export async function newestIncoming(): Promise<{ path: string; name: string; mtimeMs: number }[]> {
  const folder = incomingFolder()
  const files = await listFolder(folder)
  return files.slice(0, NEWEST).map((f) => ({ ...f, path: join(folder, f.name) }))
}

export async function chooseIncoming(contents: WebContents): Promise<string[]> {
  const window = BrowserWindow.fromWebContents(contents)
  const options = {
    defaultPath: incomingFolder(),
    properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[],
  }
  const chosen = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  return chosen.canceled ? [] : chosen.filePaths
}

// '' when opened; the system's message otherwise.
export async function openFolder(folder: string): Promise<string> {
  const error = await shell.openPath(folder)
  if (error) log.warn('a folder could not be opened', { folder, error })
  return error
}

export async function openProjectFolder(projectId: string): Promise<void> {
  const folder = await ensureFolder(projectId)
  if (folder) await openFolder(folder)
}

export async function openProjectFile(projectId: string, name: string): Promise<void> {
  const folder = folderOf(projectId)
  const path = folder ? insideFolder(folder, name) : null
  if (!path)
    return log.warn('a file outside its project folder was refused', { project: projectId, name })
  const error = await shell.openPath(path)
  if (error) log.warn('a project file could not be opened', { path, error })
}

// Main resolves the path itself: the renderer only names the file.
export async function dragProjectFile(
  contents: WebContents,
  projectId: string,
  name: string,
): Promise<boolean> {
  const folder = folderOf(projectId)
  const path = folder ? insideFolder(folder, name) : null
  if (!path) {
    log.warn('a drag outside its project folder was refused', { project: projectId, name })
    return false
  }
  try {
    await stat(path)
  } catch (error) {
    if (errno(error) !== 'ENOENT') throw error
    return false
  }
  contents.startDrag({ file: path, icon: await app.getFileIcon(path) })
  return true
}

export async function runTrash(): Promise<void> {
  const d = need()
  const days = d.settings().files_trash_days
  if (days <= 0) return
  const folders = d
    .projects()
    .flatMap((p) => (p.filesFolder ? [projectFilesFolder(root(), p.filesFolder)] : []))
  const entries = (
    await Promise.all(
      folders.map(async (folder) => {
        let found: import('node:fs').Dirent[]
        try {
          found = await readdir(folder, { withFileTypes: true })
        } catch (error) {
          if (errno(error) === 'ENOENT') return []
          throw error
        }
        return Promise.all(
          found.map(async (e) => {
            const path = join(folder, e.name)
            return { path, file: e.isFile(), mtimeMs: e.isFile() ? (await stat(path)).mtimeMs : 0 }
          }),
        )
      }),
    )
  ).flat()
  const chosen = filesToTrash(
    { root: root(), incoming: incomingFolder(), folders, entries },
    now(),
    days,
    d.openFiles(),
  )
  for (const path of chosen) {
    try {
      await shell.trashItem(path)
      log.info('an old project file went to the trash', { path, days })
    } catch (error) {
      log.warn('an old project file could not go to the trash', { path, error })
    }
  }
}

export function startProjectFiles(given: ProjectFilesDeps): void {
  deps = given
  const run = () =>
    void runTrash().catch((error: unknown) => log.warn('the trash check failed', { error }))
  setTimeout(() => {
    run()
    setInterval(run, TRASH_EVERY_MS)
  }, TRASH_FIRST_DELAY_MS)
}
