import { BrowserWindow } from 'electron'
import { agentPaths } from '../core/paths'
import { SessionsService } from '../core/sessions/service'

// One scan and one set of watches serve every window.
export const sessions = new SessionsService({
  roots: () => {
    const paths = agentPaths()
    return { claudeProjects: paths.claudeProjects, cursorProjects: paths.cursorProjects }
  },
})

export function broadcastSessions(): () => void {
  return sessions.onChange((list) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('sessions:changed', list)
    }
  })
}
