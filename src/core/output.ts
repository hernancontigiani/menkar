// A pane's output reaches a window twice over: the buffer it asks for when it attaches, and the
// chunks sent as they come. The two travel separately and can arrive in either order, so every
// chunk carries the position its end reaches in the pane's whole output, and the buffer the
// position it ends at.
export interface Chunk {
  readonly data: string
  readonly end: number
}

export class OutputJoin {
  #attachedAt: number | null = null
  #early: Chunk[] = []

  // The chunks to write once attached: those that reach past what the buffer already held.
  attach(end: number): string {
    this.#attachedAt = end
    const late = this.#early.filter((c) => c.end > end).map((c) => c.data)
    this.#early = []
    return late.join('')
  }

  // A chunk as it arrives: what to write now ('' before the buffer is in, or already in it).
  chunk(chunk: Chunk): string {
    if (this.#attachedAt === null) {
      this.#early.push(chunk)
      return ''
    }
    return chunk.end > this.#attachedAt ? chunk.data : ''
  }
}
