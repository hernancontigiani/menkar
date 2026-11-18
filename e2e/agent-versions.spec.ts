// The coding agents' versions (decision 1.179): a banner under the header when the installed
// version is below Menkar's floor or newer than the validated one, and Settings › About's
// "Coding agents" section always. The stand-in claude prints FAKE_CLAUDE_VERSION for --version.
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { catppuccin, prepare } from './fixtures'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

type Scheme = 'dark' | 'light'

function launch(version: string, scheme: Scheme, cursor?: string) {
  return launchApp({
    prepare: (dirs) => {
      const env = prepare(dirs)
      writeFileSync(
        join(dirs.root, 'config', 'menkar', 'state.json'),
        JSON.stringify({
          settings: {
            color_scheme: scheme,
            terminal_theme: catppuccin(scheme),
            terminal_colors: 'theme',
          },
        }),
      )
      if (cursor) {
        const file = join(dirs.root, 'bin', 'cursor-agent')
        writeFileSync(file, `#!/bin/sh\necho ${cursor}\n`)
        chmodSync(file, 0o755)
      }
      return { ...env, FAKE_CLAUDE_VERSION: version }
    },
  })
}

async function openAbout(launched: Awaited<ReturnType<typeof launchApp>>): Promise<Page> {
  const [settings] = await Promise.all([
    launched.app.waitForEvent('window'),
    act(launched.window, { type: 'openSettings', section: 'about' }),
  ])
  await settings.waitForLoadState('domcontentloaded')
  await expect(settings.locator('main[data-section="about"] [data-key="agents"]')).toBeVisible()
  return settings
}

// The colour a theme role resolves to, as the page draws it.
const role = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${n})`
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, name)

const shot = async (page: Page, name: string) => {
  const files = process.env.MENKAR_FILES
  if (files) await page.screenshot({ path: join(files, `menkar-t94-${name}.png`) })
}

const CASES = [
  {
    standing: 'old',
    version: '2.1.240',
    color: '--red',
    text: 'Claude Code 2.1.240 is too old for Menkar: it needs 2.1.267 or later. Update Claude Code.',
    about: 'Too old: update it',
  },
  {
    standing: 'newer',
    version: '2.1.330',
    color: '--blue',
    text: 'Claude Code 2.1.330 is newer than the version Menkar was validated with (2.1.327). Small differences may show until a Menkar update.',
    about: 'Newer than validated',
  },
  {
    standing: 'muchNewer',
    version: '2.3.0',
    color: '--yellow',
    text: 'Claude Code 2.3.0 is much newer than the version Menkar was validated with (2.1.327). Expect bugs or regressions; wait for a Menkar release.',
    about: 'Much newer than validated',
  },
] as const

for (const scheme of ['dark', 'light'] as const)
  for (const c of CASES)
    test(`1.179 Claude Code ${c.version} (${c.standing}, ${scheme}): the banner in its colour, across the sidebar, and About's row`, async () => {
      const launched = await launch(c.version, scheme)
      const page = launched.window
      try {
        await page.setViewportSize({ width: 1280, height: 800 })
        const banner = page.locator('#versions-banner')
        await expect(banner).toBeVisible()
        await expect(banner.locator('.bar-text')).toHaveText(c.text)
        await expect(banner).toHaveAttribute('data-standing', c.standing)
        const iconColor = await banner.locator('.icon').evaluate((n) => getComputedStyle(n).color)
        expect(iconColor).toBe(await role(page, c.color))
        await expect(banner.locator('[data-key=hide]')).toHaveAttribute(
          'title',
          'Hidden until the next Claude Code version',
        )
        const side = page.locator('#versions-side')
        await expect(side).toBeVisible()
        await expect
          .poll(async () => (await side.boundingBox())?.height)
          .toBe((await banner.boundingBox())?.height)
        await shot(page, `banner-${c.standing}-${scheme}`)

        const about = await openAbout(launched)
        await about.setViewportSize({ width: 1280, height: 800 })
        const row = about.locator('.agent-version[data-agent="claude"]')
        await expect(row.locator('.row-subtitle')).toHaveText(
          `Installed ${c.version} · validated 2.1.327`,
        )
        await expect(row.locator('.agent-standing')).toHaveText(c.about)
        await expect(about.locator('.agent-version[data-agent="cursor"]')).toContainText(
          'Not installed',
        )
        await expect(about.locator('[data-key="agents"]')).toContainText(
          'Validated: the version Menkar was tested with before this release.',
        )
        await shot(about, `about-${c.standing}-${scheme}`)
      } finally {
        await launched.close()
      }
    })

test('1.179 Hide hides the banner for that version and is kept in state.json; Details opens About', async () => {
  const launched = await launch('2.3.0', 'dark')
  const page = launched.window
  try {
    const banner = page.locator('#versions-banner')
    await expect(banner).toBeVisible()
    const about = await Promise.all([
      launched.app.waitForEvent('window'),
      banner.locator('[data-key=details]').click(),
    ]).then(([w]) => w)
    await expect(about.locator('main[data-section="about"]')).toBeVisible()
    await banner.locator('[data-key=hide]').click()
    await expect(banner).toBeHidden()
    await expect(page.locator('#versions-side')).toBeHidden()
    const state = JSON.parse(
      readFileSync(join(launched.root, 'config', 'menkar', 'state.json'), 'utf8'),
    )
    expect(state.agent_versions_hidden).toEqual({ claude: '2.3.0' })
    expect(state.settings.color_scheme).toBe('dark')
  } finally {
    await launched.close()
  }
})

test('1.179 the validated version and an agent with no validated one: no banner; About says so', async () => {
  const launched = await launch('2.1.327', 'dark', '2026.11.13-eacade1')
  const page = launched.window
  try {
    const about = await openAbout(launched)
    const claude = about.locator('.agent-version[data-agent="claude"]')
    await expect(claude.locator('.agent-standing')).toHaveText('Validated')
    const cursor = about.locator('.agent-version[data-agent="cursor"]')
    await expect(cursor.locator('.row-subtitle')).toHaveText('Installed 2026.11.13-eacade1')
    await expect(cursor.locator('.agent-standing')).toHaveText('Not validated yet')
    await expect(page.locator('#versions-banner')).toBeHidden()
    await expect(page.locator('#versions-side')).toBeHidden()
  } finally {
    await launched.close()
  }
})
