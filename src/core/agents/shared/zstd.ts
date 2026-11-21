import { createReadStream } from 'node:fs'
import type { Readable } from 'node:stream'
import { createZstdDecompress } from 'node:zlib'

const NEWLINE = 0x0a

// The file's lines, read as a stream, decompressed on the way when it is a zstd frame. Stopping
// the loop early (a `break`, a `return`) closes the file: a reader that needs only the head never
// decompresses the rest. The last line counts even without its newline.
export async function* streamLines(path: string): AsyncGenerator<string> {
  const file = createReadStream(path)
  const decompress = path.endsWith('.zst') ? createZstdDecompress() : null
  const source: Readable = decompress ? file.pipe(decompress) : file
  // A pipe does not pass the file's errors on: they are re-raised where the loop reads.
  if (decompress) file.on('error', (error) => decompress.destroy(error))
  let carry = Buffer.alloc(0)
  try {
    for await (const chunk of source) {
      let bytes = carry.length > 0 ? Buffer.concat([carry, chunk as Buffer]) : (chunk as Buffer)
      let nl = bytes.indexOf(NEWLINE)
      while (nl !== -1) {
        if (nl > 0) yield bytes.toString('utf8', 0, nl)
        bytes = bytes.subarray(nl + 1)
        nl = bytes.indexOf(NEWLINE)
      }
      carry = Buffer.from(bytes)
    }
    if (carry.length > 0) yield carry.toString('utf8')
  } finally {
    source.destroy()
    file.destroy()
  }
}
