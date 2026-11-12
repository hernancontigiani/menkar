import { homedir } from 'node:os'
import { join } from 'node:path'

const APP = 'menkar'

export interface AppDirs {
  readonly config: string
  readonly cache: string
  readonly data: string
}

let platformDirs: AppDirs | undefined

// Windows and macOS take their directories from Electron's app.getPath(), which this layer cannot
// import: the main process hands them over at startup.
export function usePlatformDirs(dirs: AppDirs): void {
  platformDirs = dirs
}

function xdg(variable: string, fallback: string): string {
  const value = process.env[variable]
  // The XDG spec says a relative value is invalid and must be ignored.
  const base = value?.startsWith('/') ? value : join(homedir(), fallback)
  return join(base, APP)
}

export function appDirs(): AppDirs {
  if (process.platform !== 'linux' && platformDirs) return platformDirs
  return {
    config: xdg('XDG_CONFIG_HOME', '.config'),
    cache: xdg('XDG_CACHE_HOME', '.cache'),
    data: xdg('XDG_DATA_HOME', '.local/share'),
  }
}

export function logFile(): string {
  return join(appDirs().cache, 'menkar.log')
}

// Chromium's own data (caches, Crashpad, local storage) is rebuildable, so on Linux it lives in
// the cache and the config directory holds only the app's state.
export function electronUserData(): string {
  return join(appDirs().cache, 'electron')
}

// The Menkar folder (decision 1.58): the user's own files, one folder per project, outside every
// repository. Not the app's state, which stays in appDirs(). `setting` is files_root, '' = default.
export function filesRoot(setting: string): string {
  return setting === '' ? join(homedir(), 'Menkar') : setting
}

// The folder a project's files live in, given the name it took under the root.
export function projectFilesFolder(root: string, folderName: string): string {
  return join(root, folderName, 'files')
}

// Menkar's skills plugin: an extra resource beside app.asar when packaged, since `claude` cannot
// read inside the archive; the repository's own folder in development.
export function pluginFolder(app: {
  readonly packaged: boolean
  readonly resourcesPath: string
  readonly appPath: string
}): string {
  return join(app.packaged ? app.resourcesPath : app.appPath, 'plugin')
}

// What the agents own: read only, never written by Menkar except where a user
// action confirms it.
export interface AgentPaths {
  readonly claudeProjects: string
  readonly claudeConfig: string
  // Claude Code's per-process registry: `<pid>.json` for each running claude, read only.
  readonly claudeSessions: string
  // Claude Code's user settings: written only by an integration the user turns on or off.
  readonly claudeSettings: string
  readonly cursorProjects: string
}

export function agentPaths(): AgentPaths {
  const home = homedir()
  return {
    claudeProjects: join(home, '.claude', 'projects'),
    claudeConfig: join(home, '.claude.json'),
    claudeSessions: join(home, '.claude', 'sessions'),
    claudeSettings: join(home, '.claude', 'settings.json'),
    cursorProjects: join(home, '.cursor', 'projects'),
  }
}
