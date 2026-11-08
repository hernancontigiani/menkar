import { appendFile, chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import { onPath } from '../../../src/core/sessions/installed'
import { type ReadRange, SessionScanner } from '../../../src/core/sessions/scanner'
import {
  aiTitle,
  assistant,
  cursorUser,
  customTitle,
  ID,
  ID2,
  jsonl,
  user,
} from '../../factories/transcript'

let root = ''
let roots = { claudeProjects: '', cursorProjects: '' }
let n = 0

beforeEach(async () => {
  n += 1
  root = join(process.env.MENKAR_TEST_ROOT ?? '', `agents-${n}`)
  roots = { claudeProjects: join(root, 'claude'), cursorProjects: join(root, 'cursor') }
  await mkdir(roots.claudeProjects, { recursive: true })
  await mkdir(roots.cursorProjects, { recursive: true })
})

async function put(path: string, content: string | Buffer): Promise<string> {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content)
  return path
}

const both = { claude: true, cursor: true }

describe('discovery', () => {
  test('SES-1 only a non-empty <uuid>.jsonl directly in a project folder is a session', async () => {
    const folder = join(roots.claudeProjects, '-home-demo-api')
    await put(
      join(folder, `${ID}.jsonl`),
      jsonl([user('hi', { cwd: '/home/demo/api' })]).padEnd(2048, ' '),
    )
    await put(join(folder, 'notes.jsonl'), jsonl([user('not a session')]))
    await put(join(folder, `${ID2}.jsonl`), '')
    await put(join(folder, ID, 'subagents', 'agent-a1.jsonl'), jsonl([user('sub')]))
    await put(join(folder, `${ID.toUpperCase()}.jsonl`), jsonl([user('upper')]))
    const sessions = await new SessionScanner().scan(roots, both)
    expect(sessions.map((s) => [s.agent, s.id, s.cwd])).toEqual([['claude', ID, '/home/demo/api']])
  })

  test('SES-2 an agent whose CLI is not on the PATH contributes no session', async () => {
    await put(join(roots.claudeProjects, '-a', `${ID}.jsonl`), jsonl([user('hi')]))
    await put(
      join(roots.cursorProjects, 'a', 'agent-transcripts', 'abc', 'abc.jsonl'),
      jsonl([cursorUser('q')]),
    )
    const scanner = new SessionScanner()
    expect(await scanner.scan(roots, { claude: false, cursor: false })).toEqual([])
    expect(
      (await scanner.scan(roots, { claude: false, cursor: true })).map((s) => s.agent),
    ).toEqual(['cursor'])
  })

  test('SES-2 an agent is installed when an executable of its name is on the PATH', async () => {
    const bin = join(root, 'bin')
    await put(join(bin, 'claude'), '#!/bin/sh\n')
    await chmod(join(bin, 'claude'), 0o755)
    await put(join(bin, 'cursor-agent'), 'not executable')
    expect(await onPath('claude', `/nonexistent:${bin}`)).toBe(true)
    expect(await onPath('cursor-agent', bin)).toBe(false)
    expect(await onPath('claude', '')).toBe(false)
  })

  test("SES-6 a Cursor session's folder is rebuilt against the filesystem", async () => {
    const real = join(root, 'home', 'demo', 'my-app')
    await mkdir(real, { recursive: true })
    const encoded = real.slice(1).replace(/[^A-Za-z0-9]/g, '-')
    await put(
      join(roots.cursorProjects, encoded, 'agent-transcripts', 'abc', 'abc.jsonl'),
      jsonl([cursorUser('q')]),
    )
    const missing = join(root, 'gone', 'my-app')
      .slice(1)
      .replace(/[^A-Za-z0-9]/g, '-')
    await put(
      join(roots.cursorProjects, missing, 'agent-transcripts', 'def', 'def.jsonl'),
      jsonl([cursorUser('q')]),
    )
    const sessions = await new SessionScanner().scan(roots, both)
    const byId = Object.fromEntries(sessions.map((s) => [s.id, s.cwd]))
    expect(byId.abc).toBe(real)
    expect(byId.def).toBe(join(root, 'gone', 'my', 'app'))
  })

  test('SES-7 a Cursor directory without <id>.jsonl is read from its first .jsonl; one with none is skipped', async () => {
    const transcripts = join(roots.cursorProjects, 'p', 'agent-transcripts')
    await put(join(transcripts, 'xyz', 'other.jsonl'), jsonl([cursorUser('from other')]))
    await put(join(transcripts, 'empty', 'readme.txt'), 'x')
    const sessions = await new SessionScanner().scan(roots, both)
    expect(sessions.map((s) => [s.id, s.preview])).toEqual([['xyz', 'from other']])
  })

  test('newest modification first, across both agents', async () => {
    const a = await put(join(roots.claudeProjects, '-a', `${ID}.jsonl`), jsonl([user('a')]))
    const b = await put(
      join(roots.cursorProjects, 'b', 'agent-transcripts', 'c1', 'c1.jsonl'),
      jsonl([cursorUser('b')]),
    )
    const { utimes } = await import('node:fs/promises')
    await utimes(a, 1_000, 1_000)
    await utimes(b, 2_000, 2_000)
    expect((await new SessionScanner().scan(roots, both)).map((s) => s.id)).toEqual(['c1', ID])
  })
})

describe('incremental reading', () => {
  test('SES-14 a /rename appended to a 40 MB transcript is read alone on the next rescan', async () => {
    const file = join(roots.claudeProjects, '-big', `${ID}.jsonl`)
    const filler = `${JSON.stringify(assistant('x'.repeat(1000)))}\n`
    const lines = [
      jsonl([user('start', { cwd: '/big' }), customTitle('alpha')]),
      filler.repeat(40 * 1024),
    ]
    await put(file, lines.join(''))
    const reads: Array<[number, number]> = []
    const counting: ReadRange = async (path, start, end) => {
      reads.push([start, end])
      const { readRange } = await import('../../../src/core/sessions/scanner')
      return readRange(path, start, end)
    }
    const scanner = new SessionScanner(counting)
    expect((await scanner.scan(roots, both))[0]?.customTitle).toBe('alpha')
    const before = (await stat(file)).size
    const appended = `${JSON.stringify(customTitle('gamma'))}\n`
    await appendFile(file, appended)
    reads.length = 0
    expect((await scanner.scan(roots, both))[0]?.customTitle).toBe('gamma')
    expect(reads.length).toBeGreaterThan(0)
    const nameReads = reads.filter(([start]) => start === before)
    expect(nameReads).toEqual([[before, before + appended.length]])
    for (const [start, end] of reads) {
      expect(start).toBeGreaterThan(before - 64 * 1024 - 1)
      expect(end - start).toBeLessThanOrEqual(64 * 1024)
    }
  })

  test('SES-15 a last line without its newline waits for it', async () => {
    const file = join(roots.claudeProjects, '-a', `${ID}.jsonl`)
    await put(file, jsonl([user('hi')]) + JSON.stringify(customTitle('beta')))
    const scanner = new SessionScanner()
    expect((await scanner.scan(roots, both))[0]?.customTitle).toBeNull()
    await appendFile(file, '\n')
    expect((await scanner.scan(roots, both))[0]?.customTitle).toBe('beta')
  })

  test('a file that became shorter, or was replaced, is read again from the start', async () => {
    const file = join(roots.claudeProjects, '-a', `${ID}.jsonl`)
    await put(file, jsonl([user('one'), customTitle('long name here'), aiTitle('t')]))
    const scanner = new SessionScanner()
    await scanner.scan(roots, both)
    await writeFile(file, jsonl([user('two')]))
    const [session] = await scanner.scan(roots, both)
    expect([session?.customTitle, session?.aiTitle, session?.preview]).toEqual([null, null, 'two'])
  })

  test('the preview and badge follow a growing file', async () => {
    const file = join(roots.claudeProjects, '-a', `${ID}.jsonl`)
    await put(file, jsonl([{ type: 'summary' }]))
    const scanner = new SessionScanner()
    expect((await scanner.scan(roots, both))[0]?.preview).toBe('')
    await appendFile(file, jsonl([user('now typed'), assistant('Shall I?')]))
    const [session] = await scanner.scan(roots, both)
    expect([session?.preview, session?.badge]).toEqual(['now typed', 'waiting'])
  })

  test('a transcript that disappears leaves the list', async () => {
    const file = join(roots.claudeProjects, '-a', `${ID}.jsonl`)
    await put(file, jsonl([user('hi')]))
    const scanner = new SessionScanner()
    expect(await scanner.scan(roots, both)).toHaveLength(1)
    const { rm } = await import('node:fs/promises')
    await rm(file)
    expect(await scanner.scan(roots, both)).toEqual([])
  })
})

describe("the agents' files are read, never written", () => {
  test('a scan and a rescan leave every transcript with its bytes and mtime', async () => {
    const files = [
      await put(
        join(roots.claudeProjects, '-a', `${ID}.jsonl`),
        jsonl([user('hi'), customTitle('n'), assistant('Ok?')]),
      ),
      await put(
        join(roots.cursorProjects, 'p', 'agent-transcripts', 'c', 'c.jsonl'),
        jsonl([cursorUser('q')]),
      ),
    ]
    const before = await Promise.all(
      files.map(async (f) => [await readFile(f), (await stat(f)).mtimeMs] as const),
    )
    expect(before).toHaveLength(2)
    const scanner = new SessionScanner()
    await scanner.scan(roots, both)
    await scanner.scan(roots, both)
    const after = await Promise.all(
      files.map(async (f) => [await readFile(f), (await stat(f)).mtimeMs] as const),
    )
    expect(after).toEqual(before)
  })
})
