// main answers each request file once, whether it learns of it from fs.watch
// or from its 1 s pass; a request older than 60 s is dropped (Menkar was closed); a malformed one
// gets a refusal, so the server is never left waiting.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { controlPaths } from '../../../src/core/control/files'
import { REQUEST_MAX_AGE_MS, RequestQueue } from '../../../src/core/control/requests'

function put(name: string, body: unknown): void {
  const { requests } = controlPaths()
  mkdirSync(requests, { recursive: true })
  writeFileSync(join(requests, name), typeof body === 'string' ? body : JSON.stringify(body))
}

const response = (id: string) =>
  JSON.parse(readFileSync(join(controlPaths().responses, `${id}.json`), 'utf8'))

describe('the request queue', () => {
  test('a request seen by the event and by the pass is handled once', async () => {
    let calls = 0
    const queue = new RequestQueue(
      async () => {
        calls += 1
        await new Promise((r) => setTimeout(r, 20))
        return { ok: true, text: 'done' }
      },
      () => 1000,
    )
    put('r1.json', { id: 'r1', pane: 'p1', tool: 'renew', args: {}, at: 1000 })
    await Promise.all([queue.pass(), queue.pass()])
    await queue.pass()
    expect(calls).toBe(1)
    expect(response('r1')).toEqual({ id: 'r1', ok: true, text: 'done' })
    expect(existsSync(join(controlPaths().requests, 'r1.json'))).toBe(false)
  })

  test('a request older than 60 s is dropped without an answer', async () => {
    let calls = 0
    const queue = new RequestQueue(
      async () => {
        calls += 1
        return { ok: true, text: '' }
      },
      () => 100_000 + REQUEST_MAX_AGE_MS + 1,
    )
    put('old.json', { id: 'old', pane: 'p1', tool: 'renew', args: {}, at: 100_000 })
    await queue.pass()
    expect(calls).toBe(0)
    expect(readdirSync(controlPaths().requests)).not.toContain('old.json')
    expect(existsSync(join(controlPaths().responses, 'old.json'))).toBe(false)
  })

  test.each([
    ['not JSON', '{"id":'],
    ['an unknown tool', { id: 'bad', pane: 'p1', tool: 'rm', args: {}, at: 1 }],
    ['no pane', { id: 'bad', tool: 'renew', args: {}, at: 1 }],
  ])('%s gets a refusal response', async (_, body) => {
    const queue = new RequestQueue(
      async () => ({ ok: true, text: '' }),
      () => 1,
    )
    put('bad.json', body)
    await queue.pass()
    expect(response('bad')).toMatchObject({ id: 'bad', ok: false })
    expect(response('bad').text).toMatch(/^[A-Z].*\.$/)
  })
})
