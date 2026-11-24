import type { Namer } from '../types'

// Nothing outside Cursor can name a chat: no option, no file Menkar may write. A worker the
// orchestration starts keeps the name it was started with in Menkar's own data, for good, since
// that name is how the other sessions address it (D22). Cursor's own title is not read.
export const namer: Namer = { atStart: () => null, kept: (name) => name }
