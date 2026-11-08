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

function xdgBase(variable: string, fallback: string): string {
  const value = process.env[variable]
  return value?.startsWith('/') ? value : join(homedir(), fallback)
}

// What the agents and agent-tablet own: read only, never written by Menkar except where a user
// action confirms it.
export interface AgentPaths {
  readonly claudeProjects: string
  readonly claudeConfig: string
  readonly cursorProjects: string
  readonly agentTabletConfig: string
  readonly agentTabletData: string
  readonly agentTabletCache: string
}

export function agentPaths(): AgentPaths {
  const home = homedir()
  return {
    claudeProjects: join(home, '.claude', 'projects'),
    claudeConfig: join(home, '.claude.json'),
    cursorProjects: join(home, '.cursor', 'projects'),
    agentTabletConfig: join(xdgBase('XDG_CONFIG_HOME', '.config'), 'agent-tablet'),
    agentTabletData: join(xdgBase('XDG_DATA_HOME', '.local/share'), 'agent-tablet'),
    agentTabletCache: join(xdgBase('XDG_CACHE_HOME', '.cache'), 'agent-tablet'),
  }
}
