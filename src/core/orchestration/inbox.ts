import { type InboxLine, inboxText } from './inbox-text'

// What the orchestrator is told without a line on the human's screen, waiting for its next prompt
// or its inbox call.

export const INBOX_MAX = 30

export interface InboxEntry extends InboxLine {
  // One pending entry per key: a later one replaces it.
  readonly key: string
}

// One per Menkar run, shared by every inbox and never reset: a delivery the transcript confirmed
// earlier in the run names numbers no new entry can take.
export function sequence(): () => number {
  let last = 0
  return () => {
    last += 1
    return last
  }
}

export class Inbox {
  private list: InboxEntry[] = []
  private lost = 0
  private readonly nextSeq: () => number
  private readonly now: () => number

  constructor(nextSeq: () => number, now: () => number) {
    this.nextSeq = nextSeq
    this.now = now
  }

  // Goes last, replacing a pending entry of the same key; past the cap the oldest goes, counted.
  add(key: string, text: string): InboxEntry {
    const entry: InboxEntry = { seq: this.nextSeq(), at: this.now(), key, text }
    this.list = [...this.list.filter((x) => x.key !== key), entry]
    while (this.list.length > INBOX_MAX) {
      this.list.shift()
      this.lost += 1
    }
    return entry
  }

  // Removed unread: what it said no longer holds.
  retract(key: string): void {
    this.list = this.list.filter((x) => x.key !== key)
  }

  get entries(): readonly InboxEntry[] {
    return this.list
  }

  get dropped(): number {
    return this.lost
  }

  text(maxBytes?: number): string {
    return inboxText(this.list, this.lost, maxBytes)
  }

  // Everything pending, given once and gone.
  take(): { readonly entries: readonly InboxEntry[]; readonly dropped: number } {
    const taken = { entries: this.list, dropped: this.lost }
    this.list = []
    this.lost = 0
    return taken
  }

  // The model got the entries up to `seq`, and with the first of them the count of those dropped.
  deliveredThrough(seq: number): void {
    const first = this.list[0]
    if (first && first.seq <= seq) this.lost = 0
    this.list = this.list.filter((x) => x.seq > seq)
  }

  clear(options: { readonly keep?: readonly string[] } = {}): void {
    const keep = new Set(options.keep ?? [])
    this.list = this.list.filter((x) => keep.has(x.key))
    this.lost = 0
  }
}
