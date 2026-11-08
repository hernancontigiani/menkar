import { type Reading, readingFor, sameReading } from './reading'

// The readings of the sessions the app shows, kept current as the statusline writes. At most one
// read is in flight per session: requests that arrive meanwhile cost exactly one more read when it
// lands, so a burst of file events costs two reads, not one per event.
export class ReadingTracker {
  private readonly transcripts = new Map<string, string>()
  private readonly readings = new Map<string, Reading | null>()
  private readonly inFlight = new Set<string>()
  private readonly again = new Set<string>()
  private readonly listeners = new Set<(sessionId: string, reading: Reading | null) => void>()

  constructor(
    private readonly read: (sessionId: string, transcript: string) => Promise<Reading | null> = (
      sessionId,
      transcript,
    ) => readingFor(sessionId, transcript),
  ) {}

  get(sessionId: string): Reading | null {
    return this.readings.get(sessionId) ?? null
  }

  // Starts following a session (again, when its transcript moved) and reads it.
  track(sessionId: string, transcript: string): Promise<void> {
    this.transcripts.set(sessionId, transcript)
    return this.request(sessionId)
  }

  // A statusline file was created or finished changing. Names starting with `.` (the statusline's
  // temporary files) and names not ending in `.json` are not session files.
  fileChanged(name: string): Promise<void> {
    if (name.startsWith('.') || !name.endsWith('.json')) return Promise.resolve()
    return this.request(name.slice(0, -'.json'.length))
  }

  // Fires when a session's reading changes in any field; an unchanged one fires nothing.
  onChange(listener: (sessionId: string, reading: Reading | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  request(sessionId: string): Promise<void> {
    const transcript = this.transcripts.get(sessionId)
    if (transcript === undefined) return Promise.resolve()
    if (this.inFlight.has(sessionId)) {
      this.again.add(sessionId)
      return Promise.resolve()
    }
    this.inFlight.add(sessionId)
    return this.read(sessionId, transcript)
      .then((reading) => {
        if (!sameReading(this.readings.get(sessionId) ?? null, reading)) {
          this.readings.set(sessionId, reading)
          for (const listener of this.listeners) listener(sessionId, reading)
        } else {
          this.readings.set(sessionId, reading)
        }
      })
      .finally(() => {
        this.inFlight.delete(sessionId)
        if (this.again.delete(sessionId)) void this.request(sessionId)
      })
  }
}
