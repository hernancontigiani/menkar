// §2.6 of the multi-agent architecture (S6): a compressed transcript is read as a stream of lines,
// never whole, and a reader that stops early closes the file.
import { mkdtempSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { expect, test, vi } from 'vitest'
import { streamLines } from '../../../../src/core/agents/shared/zstd'

const folder = () => mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'zstd-'))

async function all(path: string): Promise<string[]> {
  const lines: string[] = []
  for await (const line of streamLines(path)) lines.push(line)
  return lines
}

// The files this process holds open, by path.
const openFiles = () =>
  readdirSync('/proc/self/fd').flatMap((fd) => {
    try {
      return [readlinkSync(`/proc/self/fd/${fd}`)]
    } catch (error) {
      // The listing's own descriptor is gone by the time it is read.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  })

const TEXT = '{"a":1}\n\n{"b":"ñandú €"}\n{"c":3}'

test.each([
  ['a plain file', 'r.jsonl', Buffer.from(TEXT)],
  ['a zstd frame', 'r.jsonl.zst', zstdCompressSync(Buffer.from(TEXT))],
])(
  '%s gives its lines, skipping empty ones, the last one without its newline',
  async (_, name, bytes) => {
    const path = join(folder(), name)
    writeFileSync(path, bytes)
    expect(await all(path)).toEqual(['{"a":1}', '{"b":"ñandú €"}', '{"c":3}'])
  },
)

test('a character cut between two chunks is whole again', async () => {
  // 64 KiB chunks: the euro sign's three bytes straddle the first boundary.
  const text = `${'x'.repeat(64 * 1024 - 1)}€\nend\n`
  const path = join(folder(), 'cut.jsonl.zst')
  writeFileSync(path, zstdCompressSync(Buffer.from(text)))
  const lines = await all(path)
  expect(lines).toHaveLength(2)
  expect(lines[0]?.endsWith('x€')).toBe(true)
})

test('stopping after the first line closes the file', async () => {
  const lines = Array.from({ length: 200_000 }, (_, i) => `{"n":${i},"pad":"${'p'.repeat(40)}"}`)
  const path = join(folder(), 'big.jsonl.zst')
  writeFileSync(path, zstdCompressSync(Buffer.from(`${lines.join('\n')}\n`)))
  let first: string | null = null
  for await (const line of streamLines(path)) {
    first = line
    expect(openFiles()).toContain(path)
    break
  }
  expect(first).toBe(lines[0])
  // The descriptor is closed on libuv's thread pool, after any read in flight: under load that
  // takes longer than a turn of the event loop, so the test waits for it, with a deadline.
  await vi.waitUntil(() => !openFiles().includes(path), { timeout: 2000, interval: 10 })
  expect(openFiles()).not.toContain(path)
})

test('a file that is not zstd fails the loop instead of giving lines', async () => {
  const path = join(folder(), 'broken.jsonl.zst')
  writeFileSync(path, 'not compressed\n')
  await expect(all(path)).rejects.toThrow()
})

test('a missing file fails the loop', async () => {
  await expect(all(join(folder(), 'gone.jsonl.zst'))).rejects.toThrow()
})
