// Decision 1.39: the VS Code Dark theme, VS Code's Dark Modern: a stand-in prints a Claude Code reply
// with the colours Claude Code sends in 24 bits, and a Markdown file shows VS Code's syntax colours.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, savedCursorTab, terminalText } from './app'

const rgb = (hex: string) =>
  `\\033[38;2;${[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(';')}m`
const R = '\\033[0m'
const B = '\\033[1m'
const I = '\\033[3m'

const REPLY = [
  `${B}Revisé el archivo regenerado antes de que lo commitees${R}, que es lo que pidieron. Está bien:`,
  `los mismos 112 módulos. Son ${rgb('#b1b9f9')}COPYING${R}, ${rgb('#b1b9f9')}LICENSE.txt${R} y ${rgb('#b1b9f9')}LICENSE.MPL-2.0${R}, todos legítimos.`,
  '',
  'Con eso mi parte está cerrada. Lo que sigue esperándote es la rama para fabric.',
  '',
  `${rgb('#999999')}✻ Cogitated for 1m 10s · done Monday 6:54 PM${R}`,
  '',
  `${rgb('#999999')}※ ${B}recap:${R}${rgb('#999999')} ${I}Goal: answer the reviewer's four questions.${R}`,
  '',
  `${rgb('#888888')}${'─'.repeat(60)} documentation ─${R}`,
  `${B}❯${R} `,
  `${rgb('#888888')}${'─'.repeat(76)}${R}`,
  `${rgb('#999999')}documentation · 78% · $1021.66${R}`,
  `${rgb('#ffc107')}⏵⏵ auto mode on${R}${rgb('#999999')} (shift+tab to cycle) · ← for agents${R}   ${rgb('#4eba65')}/rc${R}`,
]

const MARKDOWN = `# A heading

Body text with **bold words** and \`inline code\`, and a [link](https://example.com).

- a list item
> a quote

| a | b |
| - | - |

\`\`\`ts
const answer = 42 // a comment
\`\`\`
`

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

for (const style of ['tui', 'classic'] as const) {
  test(`decision 1.39 VS Code Dark in ${style}: a Claude Code reply on the terminal panel's #181818, and the Markdown source in VS Code's colours`, async () => {
    let home = ''
    const launched = await launchApp({
      prepare: (dirs) => {
        home = dirs.home
        const env = savedCursorTab(dirs, {
          ui_style: style,
          terminal_theme: 'VS Code Dark',
          color_scheme: 'dark',
        })
        writeFileSync(
          join(dirs.home, 'reply.sh'),
          `clear\n${REPLY.map((line) => `printf '%b\\n' "${line.replaceAll('"', '\\"').replaceAll('$', '\\$')}"`).join('\n')}\n`,
        )
        return env
      },
    })
    const page = launched.window
    try {
      await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
      await page.locator('.xterm').click()
      await page.keyboard.type('bash ~/reply.sh\n')
      await expect.poll(() => terminalText(page)).toContain('auto mode on')
      await page.waitForTimeout(300)
      mkdirSync('/tmp/menkar-shots', { recursive: true })
      await page.screenshot({ path: `/tmp/menkar-shots/vscode-dark-terminal-${style}.png` })
      const background = await page
        .locator('.xterm-scrollable-element')
        .first()
        .evaluate((n) => getComputedStyle(n).backgroundColor)
      expect(background).toBe('rgb(24, 24, 24)')

      const file = join(home, 'notes.md')
      writeFileSync(file, MARKDOWN)
      await act(page, { type: 'openFilePath', path: file })
      const editor = page.locator('.tab-body:not(.hidden) .cm-content')
      await expect(editor).toContainText('A heading')
      const colourOf = (text: string) =>
        editor.evaluate((root, wanted) => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
          for (let n = walker.nextNode(); n; n = walker.nextNode())
            if (n.textContent?.includes(wanted))
              return getComputedStyle(n.parentElement as Element).color
          return null
        }, text)
      expect(await colourOf('A heading')).toBe('rgb(86, 156, 214)')
      expect(await colourOf('inline code')).toBe('rgb(206, 145, 120)')
      await page.waitForTimeout(300)
      await page.screenshot({ path: `/tmp/menkar-shots/vscode-dark-markdown-${style}.png` })
    } finally {
      await launched.close()
    }
  })
}
