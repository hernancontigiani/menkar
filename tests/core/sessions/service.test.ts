import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { Coalescer, type SessionInfo, SessionsService } from '../../../src/core/sessions/service'
import { statePath } from '../../../src/core/state'
import { customTitle, ID, ID2, jsonl, user } from '../../factories/transcript'

afterEach(() => {
  vi.useRealTimers()
})

describe('rescans', () => {
  test('SES-3 ten events within one second cause one rescan, 2 s after the last', async () => {
    vi.useFakeTimers()
    const work = vi.fn(async () => {})
    const coalescer = new Coalescer(work, 2000)
    for (let i = 0; i < 10; i += 1) {
      coalescer.request()
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(work).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1900)
    expect(work).toHaveBeenCalledTimes(1)
  })

  test('SES-5 an event while a scan runs causes one more scan after it, not none', async () => {
    let release: () => void = () => {}
    const runs: number[] = []
    const coalescer = new Coalescer(async () => {
      runs.push(runs.length)
      if (runs.length === 1) await new Promise<void>((resolve) => (release = resolve))
    }, 2000)
    const first = coalescer.now()
    coalescer.request()
    coalescer.request()
    release()
    await first
    expect(runs).toEqual([0, 1])
  })
})

const ALL = async () => ({ claude: true, cursor: true })

function service(root: string): SessionsService {
  return new SessionsService({
    roots: () => ({ claudeProjects: join(root, 'claude'), cursorProjects: join(root, 'cursor') }),
    installed: ALL,
    debounceMs: 50,
  })
}

function nextList(
  svc: SessionsService,
  until: (list: readonly SessionInfo[]) => boolean,
): Promise<readonly SessionInfo[]> {
  return new Promise((resolve) => {
    const off = svc.onChange((list) => {
      if (until(list)) {
        off()
        resolve(list)
      }
    })
  })
}

describe('the sessions service', () => {
  test('SES-4 a folder created later is watched after the scan that found it', async () => {
    const root = join(process.env.MENKAR_TEST_ROOT ?? '', 'svc-watch')
    await mkdir(join(root, 'claude'), { recursive: true })
    const svc = service(root)
    try {
      expect(await svc.list()).toEqual([])
      const folder = join(root, 'claude', '-home-demo-new')
      const first = nextList(svc, (list) => list.length === 1)
      await mkdir(folder)
      await writeFile(join(folder, `${ID}.jsonl`), jsonl([user('one')]))
      expect((await first).map((s) => s.id)).toEqual([ID])
      const second = nextList(svc, (list) => list.length === 2)
      await writeFile(join(folder, `${ID2}.jsonl`), jsonl([user('two')]))
      expect((await second).map((s) => s.id).sort()).toEqual([ID, ID2].sort())
    } finally {
      svc.stop()
    }
  })

  test("a session's name and hidden flag come from state.json; hiding saves and re-emits", async () => {
    const root = join(process.env.MENKAR_TEST_ROOT ?? '', 'svc-state')
    const folder = join(root, 'claude', '-a')
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, `${ID}.jsonl`), jsonl([user('preview text')]))
    await writeFile(join(folder, `${ID2}.jsonl`), jsonl([user('x'), customTitle('From Claude')]))
    await mkdir(join(statePath(), '..'), { recursive: true })
    await writeFile(
      statePath(),
      JSON.stringify({ names: { [ID]: 'Mine', [ID2]: 'Ignored' }, settings: { a: 1 } }),
    )
    const svc = service(root)
    try {
      const list = await svc.list()
      const byId = Object.fromEntries(list.map((s) => [s.id, s]))
      expect([byId[ID]?.name, byId[ID]?.claudeNamed]).toEqual(['Mine', false])
      expect([byId[ID2]?.name, byId[ID2]?.claudeNamed]).toEqual(['From Claude', true])
      const hidden = nextList(svc, (l) => l.some((s) => s.hidden))
      await svc.setHidden([ID], true)
      expect((await hidden).filter((s) => s.hidden).map((s) => s.id)).toEqual([ID])
      expect(JSON.parse(await readFile(statePath(), 'utf8'))).toEqual({
        names: { [ID]: 'Mine', [ID2]: 'Ignored' },
        hidden: [ID],
        settings: { a: 1 },
      })
    } finally {
      svc.stop()
    }
  })
})
