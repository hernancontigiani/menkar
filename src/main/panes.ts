import { ScreenMirror } from '../core/agentstate/mirror'

// The agent panes alive in any window, for the agent-state module: each gets its screen mirror
// before its first byte, sees every write and resize, and the mirror is disposed after onClose.
export interface AgentPane {
  readonly id: string
  readonly provider: 'claude' | 'cursor'
  sessionId(): string | null
  readonly mirror: ScreenMirror
  // The agent still owns the pty's foreground (it is not back at the shell).
  foreground(): boolean
  onClose(listener: () => void): () => void
  // Its tab is its window's selected tab and that window is focused.
  seen(): boolean
  // Fires whenever seen() may have turned true (a window activated, a tab selected).
  onSeen(listener: () => void): () => void
  tabTitle(): string
  windowFocused(): boolean
  // Brings its window forward, shows its tab's project and selects its tab.
  reveal(): void
}

export interface PaneWhereabouts {
  sessionId(): string | null
  foreground(): boolean
  seen(): boolean
  tabTitle(): string
  windowFocused(): boolean
  reveal(): void
}

const seenListeners = new Set<() => void>()

// The workspace calls this when a window is activated or a tab selected.
export function notifySeen(): void {
  for (const listener of seenListeners) listener()
}

const live = new Map<string, AgentPane>()
const listeners = new Set<(pane: AgentPane) => void>()

export function onAgentPane(listener: (pane: AgentPane) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function agentPanes(): readonly AgentPane[] {
  return [...live.values()]
}

export interface PaneHandle {
  write(data: string): void
  resize(cols: number, rows: number): void
  close(): void
}

export function registerAgentPane(
  id: string,
  provider: 'claude' | 'cursor',
  size: { cols: number; rows: number },
  where: PaneWhereabouts,
): PaneHandle {
  const mirror = new ScreenMirror(size.cols, size.rows)
  const closers = new Set<() => void>()
  const pane: AgentPane = {
    id,
    provider,
    sessionId: () => where.sessionId(),
    mirror,
    foreground: () => where.foreground(),
    onClose: (listener) => {
      closers.add(listener)
      return () => closers.delete(listener)
    },
    seen: () => where.seen(),
    onSeen: (listener) => {
      seenListeners.add(listener)
      const off = () => seenListeners.delete(listener)
      closers.add(off)
      return off
    },
    tabTitle: () => where.tabTitle(),
    windowFocused: () => where.windowFocused(),
    reveal: () => where.reveal(),
  }
  live.set(id, pane)
  for (const listener of listeners) listener(pane)
  return {
    write: (data) => mirror.write(data),
    resize: (cols, rows) => mirror.resize(cols, rows),
    close: () => {
      if (!live.delete(id)) return
      for (const listener of closers) listener()
      mirror.dispose()
    },
  }
}
