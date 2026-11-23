// Usage against OpenCode's own numbers, the version word under FORCE_COLOR, and D9's line when a
// second OpenCode server runs a turn of the session (decision 1.205).
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  act,
  launch,
  noter,
  OPENCODE,
  RUN,
  sleep,
  startModel,
  state,
  typeIn,
  usageToday,
  versions,
} from './lib'

interface UsageNode {
  readonly label: string
  readonly cost: number
  readonly costExact: boolean
  readonly tokens: { readonly input: number; readonly output: number; readonly cacheRead: number }
  readonly children: readonly UsageNode[]
}

test('usage: cost and tokens equal OpenCode’s, the version, D9’s line', async () => {
  const model = await startModel('usage')
  const app = await launch(model)
  const note = noter('usage')
  let other: ReturnType<typeof spawn> | null = null
  try {
    const work = join(app.home(), 'work')
    await act(app.page, {
      type: 'startNew',
      agent: 'opencode',
      folder: work,
      name: 'probe-usage',
      prompt: 'first',
    })
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('ack', { timeout: 30_000 })
    const id = await app.session()
    await typeIn(app.page, 'second')
    await expect
      .poll(
        () =>
          app.sql(`select count(*) from session_message where session_id='${id}' and type='idle'`),
        { timeout: 20_000 },
      )
      .toEqual([[2]])
    await sleep(3000)

    const [row] = app.sql(
      `select cost,tokens_input,tokens_output,tokens_cache_read from session_v2 where id='${id}'`,
    )
    const view = (await usageToday(app.page)) as { totals: { nodes: UsageNode[] } }
    const session = view.totals.nodes[0]?.children.find((c) => c.label === 'probe-usage')
    note(`opencode row ${JSON.stringify(row)}; Menkar ${JSON.stringify(session)}`)
    expect(session?.cost).toBeCloseTo(Number(row?.[0]), 9)
    expect(session?.costExact).toBe(true)
    expect([session?.tokens.input, session?.tokens.output, session?.tokens.cacheRead]).toEqual(
      row?.slice(1),
    )

    // The version word, with the app run under FORCE_COLOR as Playwright runs it.
    const listed = (await versions(app.page)) as { agent: string; installed: string | null }[]
    note(`versions: ${JSON.stringify(listed)}`)
    expect(listed.find((v) => v.agent === 'opencode')?.installed).toMatch(/^\d+\.\d+\.\d+$/)

    // D9: the tab closed, a second server (standing for the human's own) runs a turn of the
    // session, and Menkar reopens it.
    await act(app.page, { type: 'closeTab', tab: (await state(app.page)).tabs[0]?.id, force: true })
    await sleep(3000)
    const env = {
      ...process.env,
      HOME: app.home(),
      XDG_CONFIG_HOME: join(app.root(), 'config'),
      XDG_DATA_HOME: join(app.root(), 'data'),
      XDG_CACHE_HOME: join(app.root(), 'cache'),
      XDG_STATE_HOME: join(app.root(), 'state'),
      OPENCODE_PASSWORD: 'otherpass',
    }
    other = spawn(OPENCODE, ['serve', '--stdio', '--port', '0'], {
      env,
      cwd: work,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const url = await new Promise<string>((resolve) =>
      other?.stdout?.on('data', (d) => {
        const found = /"url":"([^"]+)"/.exec(String(d))
        if (found?.[1]) resolve(found[1])
      }),
    )
    const posted = await fetch(`${url}/api/session/${id}/prompt`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from('opencode:otherpass').toString('base64')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: 'SLOW turn in the other server' }),
    })
    expect(posted.status).toBe(200)
    await sleep(2000)
    await act(app.page, { type: 'openSession', session: id })
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('[menkar] warning', {
      timeout: 20_000,
    })
    await app.page.screenshot({ path: join(RUN, 'usage-d9.png') })
  } finally {
    other?.stdin?.end()
    await app.launched.close()
    model.process.kill()
  }
})
