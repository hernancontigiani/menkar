// The desktop notifications agents raised, one per session. The dock counts what is still in the
// tray, so a notification is closed as soon as the user has looked at its pane, not only when a
// newer one for the same session replaces it.

export interface Closable {
  close(): void
}

export class NotificationTray<N extends Closable> {
  readonly #shown = new Map<string, N>()

  get size(): number {
    return this.#shown.size
  }

  keys(): string[] {
    return [...this.#shown.keys()]
  }

  show(identity: string, notification: N): void {
    this.#shown.get(identity)?.close()
    this.#shown.set(identity, notification)
  }

  // The pane was looked at, or closed: its notification leaves the tray.
  seen(identity: string): void {
    this.#shown.get(identity)?.close()
    this.#shown.delete(identity)
  }

  closeAll(): void {
    for (const notification of this.#shown.values()) notification.close()
    this.#shown.clear()
  }
}
