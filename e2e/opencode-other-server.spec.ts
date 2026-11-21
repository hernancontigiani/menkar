// Decision 1.205: an OpenCode session Menkar resumes while another OpenCode server runs a turn of
// it (the human's own TUI) gets one line of Menkar's own in its pane, once its TUI has drawn,
// saying what is sent to it may interleave with that turn. Not a toast; nothing typed into it.
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare } from './fixtures'
import { opencodeStandIn } from './standins/opencode'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

const ID = 'ses_0000000000a1OtherServer01'
const PASSWORD = 'theirs'

// The human's own OpenCode server over the same database, with a long turn of the session running.
async function otherServer(
  command: string,
  env: Readonly<Record<string, string>>,
  folder: string,
): Promise<ChildProcessWithoutNullStreams> {
  const child = spawn(command, ['serve', '--stdio', '--port', '0'], {
    env: { ...env, OPENCODE_PASSWORD: PASSWORD, FAKE_OPENCODE_TURN_MS: '120000' },
  })
  const url = await new Promise<string>((resolve, reject) => {
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8')
      const line = out.split('\n').find((l) => l.startsWith('{'))
      if (line) resolve((JSON.parse(line) as { url: string }).url)
    })
    child.on('exit', () => reject(new Error('the other server exited')))
  })
  const auth = `Basic ${Buffer.from(`opencode:${PASSWORD}`).toString('base64')}`
  const post = (path: string, body: unknown) =>
    fetch(`${url}${path}`, {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  expect((await post('/api/session', { id: ID, location: { directory: folder } })).status).toBe(200)
  await post(`/api/session/${ID}/prompt`, { text: 'a long job, elsewhere', delivery: 'steer' })
  return child
}

test("decision 1.205 a resumed OpenCode session another server is running shows one line of Menkar's in its pane", async () => {
  let bin = ''
  let work = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = prepare(dirs)
      bin = join(dirs.root, 'bin')
      work = join(dirs.home, 'work')
      opencodeStandIn(bin)
      return env
    },
  })
  let other: ChildProcessWithoutNullStreams | null = null
  try {
    other = await otherServer(join(bin, 'opencode'), launched.env, work)
    const page = launched.window
    const listed = async () =>
      (
        (await page.evaluate(() =>
          (
            globalThis as unknown as { menkar: { sessions: { list(): Promise<unknown> } } }
          ).menkar.sessions.list(),
        )) as { id: string }[]
      ).some((s) => s.id === ID)
    await expect.poll(listed, { timeout: 15_000 }).toBe(true)
    await act(page, { type: 'openSession', session: ID })
    const rows = page.locator('.xterm-rows')
    await expect(rows).toContainText('ctrl+p commands')
    await expect(rows).toContainText('also has a turn running in another `opencode`', {
      timeout: 15_000,
    })
    const text = await rows.textContent()
    expect(text?.split('also has a turn running').length).toBe(2)
    const files = process.env.MENKAR_FILES
    if (files) await page.screenshot({ path: join(files, 'menkar-t193-d9-line.png') })
  } finally {
    other?.stdin.end()
    await launched.close()
  }
})
