import { open } from 'node:fs/promises'
import { messageText, parseLine } from './lines'

// A session's last reply (1.73): its transcript read backwards from the end in chunks,
// lines split on bytes so a character cut by a chunk is whole again, opened read only. A
// transcript runs to tens of MB, and the reply is near its end.

const CHUNK = 64 * 1024
// Further back than this, the session's reply is not the one an orchestrator asks for.
const MAX_BACK = 8 * 1024 * 1024

export async function lastReply(file: string): Promise<string | null> {
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    let end = size
    let carry = Buffer.alloc(0)
    while (end > 0 && size - end < MAX_BACK) {
      const start = Math.max(0, end - CHUNK)
      const chunk = Buffer.alloc(end - start)
      await handle.read(chunk, 0, chunk.length, start)
      let bytes = Buffer.concat([chunk, carry])
      end = start
      // Complete lines are those after the first newline, unless the chunk starts the file.
      for (let nl = bytes.lastIndexOf(0x0a); ; nl = bytes.lastIndexOf(0x0a)) {
        if (nl === -1 && start > 0) break
        const raw = bytes.subarray(nl + 1).toString('utf8')
        bytes = nl === -1 ? Buffer.alloc(0) : bytes.subarray(0, nl)
        const line = raw ? parseLine(raw) : null
        if (line?.type === 'assistant') {
          const text = messageText(line)?.trim()
          if (text) return text
        }
        if (nl === -1) break
      }
      carry = bytes
    }
    return null
  } finally {
    await handle.close()
  }
}
