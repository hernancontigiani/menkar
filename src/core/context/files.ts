import { join } from 'node:path'
import { appDirs } from '../paths'
import { chainedStatuslineFile, sessionsDir } from './statusline'

// The files this area writes and reads, resolved when called.
export const contextFiles = {
  // what `--settings` gives the sessions Menkar starts: its statusline
  claudeSettings: () => join(appDirs().config, 'claude-settings.json'),
  // the user's own statusline, which Menkar's runs and shows instead of its own bar
  chainedStatusline: chainedStatuslineFile,
  // one file per session, written by the statusline after each assistant message
  sessionsDir,
  // what the integrations installed in ~/.claude/settings.json, and what they replaced
  integrationsRecord: () => join(appDirs().data, 'integrations.json'),
  settingsBackups: () => join(appDirs().data, 'settings-backup'),
}
