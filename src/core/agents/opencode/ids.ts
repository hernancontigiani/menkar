import { randomBytes } from 'node:crypto'
import { now } from '../../clock'
import type { SessionIds } from '../types'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const RANDOM_CHARS = 14
const TIME_HEX = 12

let last = 0
let counter = 0

// OpenCode's own form (v2.3.0): `ses_`, then the low six bytes of NOT(ms × 4096 + a counter that
// restarts each millisecond) so a newer id sorts first, then 14 random base-62 characters. Its
// server takes any id starting with `ses`, and a create with an id it already has answers with that
// session unchanged, so a collision would pass unseen.
export function sessionId(ms: number = now()): string {
  if (ms !== last) {
    last = ms
    counter = 0
  }
  counter += 1
  const time = ~(BigInt(ms) * 0x1000n + BigInt(counter)) & 0xffff_ffff_ffffn
  const random = [...randomBytes(RANDOM_CHARS)].map((byte) => BASE62[byte % 62]).join('')
  return `ses_${time.toString(16).padStart(TIME_HEX, '0')}${random}`
}

// Menkar names the session it creates on OpenCode's server before the TUI attaches to it.
export const ids: SessionIds = { newId: () => sessionId() }
