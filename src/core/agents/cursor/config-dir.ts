import { homedir } from 'node:os'
import { join } from 'node:path'

// Cursor's config folder, where it keeps cli-config.json and each chat's metadata: its own variable,
// else XDG's config home, else the home's .cursor. Its transcripts stay under the home's .cursor.
export function cursorConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CURSOR_CONFIG_DIR?.trim()) return env.CURSOR_CONFIG_DIR
  if (env.XDG_CONFIG_HOME?.trim()) return join(env.XDG_CONFIG_HOME, 'cursor')
  return join(homedir(), '.cursor')
}
