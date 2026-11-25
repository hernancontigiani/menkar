// §2.6 of the multi-agent architecture: Cursor's TUI writes its transcript whole from its own state,
// so a rewrite can drop lines anywhere, the head included (a headless turn it never saw), and keep
// the file's inode. Nothing read before is trusted: a change of size or mtime reads the head and the
// tail again.
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { catalog } from '../../../../src/core/agents/cursor/catalog'
import { readRange } from '../../../../src/core/agents/shared/jsonl'

const FIXTURE = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'cursor', 'rewritten')
const ID = '5a1e0099'

function home(): { root: string; file: string } {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'cursor-catalog-'))
  const dir = join(root, 'home-demo-api', 'agent-transcripts', ID)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${ID}.jsonl`)
  copyFileSync(join(FIXTURE, 'before.jsonl'), file)
  return { root, file }
}

async function readOnce(root: string, reader: ReturnType<typeof catalog.reader>) {
  const [found] = await catalog.find(root)
  if (!found) throw new Error('no session found')
  return reader.read(found)
}

test('a transcript rewritten in place is read again from its head', async () => {
  const { root, file } = home()
  const reader = catalog.reader(readRange)
  const before = await readOnce(root, reader)
  expect(before?.preview).toBe('Reply exactly: WAKE-HOTEL')
  expect(before?.badge).toBe('waiting')
  const ino = statSync(file).ino
  writeFileSync(file, readFileSync(join(FIXTURE, 'after.jsonl')))
  expect(statSync(file).ino).toBe(ino)
  const after = await readOnce(root, reader)
  expect(after?.preview).toBe('List the files in src')
  expect(after?.badge).toBeNull()
  expect(after?.size).toBe(statSync(file).size)
})

test('a rewrite that keeps the size is told by its mtime', async () => {
  const { root, file } = home()
  const reader = catalog.reader(readRange)
  await readOnce(root, reader)
  const text = readFileSync(file, 'utf8')
  const same = text.replace('WAKE-HOTEL', 'WAKE-INDIA').replace('WAKE-HOTEL', 'WAKE-INDIA')
  expect(same.length).toBe(text.length)
  writeFileSync(file, same)
  const later = new Date(statSync(file).mtimeMs + 5000)
  utimesSync(file, later, later)
  expect((await readOnce(root, reader))?.preview).toBe('Reply exactly: WAKE-INDIA')
})
