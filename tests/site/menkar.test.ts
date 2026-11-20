// The site's Markdown extensions, over a registry of the test's own: a capture resolves to its light
// and dark image in the page's locale, a label to the app's text, and anything unknown throws, so a
// page that names it does not build.
import { describe, expect, test } from 'vitest'
import {
  createMenkar,
  localeOf,
  markdownPath,
  shortcutsNodes,
  transformNode,
  uiLabel,
} from '../../site/src/remark/menkar.mjs'
import { en as appEn } from '../../src/core/i18n/en'
import { es as appEs } from '../../src/core/i18n/es'
import { SHORTCUTS } from '../../src/core/shortcuts'

const CAPTURES_DIR = '/repo/site/src/assets/captures'
const menkar = createMenkar({
  captures: [{ slug: 'board-demo' }, { slug: 'no-alt' }],
  alts: {
    en: { 'alt:board-demo': 'The Board with three tasks' },
    es: { 'alt:board-demo': 'El Tablero con tres tareas' },
  },
  capturesDir: CAPTURES_DIR,
})

describe('shot:', () => {
  test("a page shows the light and the dark image of its locale, each hidden in the other's theme", () => {
    const nodes = menkar.shotForPage(
      'board-demo',
      'es',
      '/repo/site/src/content/docs/es/orchestration/board.md',
    )
    expect(nodes).toEqual([
      {
        type: 'emphasis',
        data: { hName: 'span', hProperties: { className: ['dark:sl-hidden'] } },
        children: [
          {
            type: 'image',
            url: '../../../../assets/captures/es/light/board-demo.png',
            alt: 'El Tablero con tres tareas',
          },
        ],
      },
      {
        type: 'emphasis',
        data: { hName: 'span', hProperties: { className: ['light:sl-hidden'] } },
        children: [
          {
            type: 'image',
            url: '../../../../assets/captures/es/dark/board-demo.png',
            alt: 'El Tablero con tres tareas',
          },
        ],
      },
    ])
  })

  test("a page's Markdown shows the light image at the URL the build gives it", () => {
    const node = menkar.shotForMarkdown('board-demo', 'en', (path) => `https://example.com/${path}`)
    expect(node).toEqual({
      type: 'image',
      url: 'https://example.com/en/light/board-demo.png',
      alt: 'The Board with three tasks',
    })
  })

  test('a slug outside the registry, or one without its alt text, fails the build', () => {
    expect(() => menkar.shotForPage('nowhere', 'en', '/repo/site/src/content/docs/a.md')).toThrow(
      'shot:nowhere is not in the capture registry',
    )
    expect(() => menkar.shotForMarkdown('no-alt', 'es', (path) => path)).toThrow(
      'shot:no-alt has no alt text in es',
    )
  })

  test('an image node with a shot: URL is replaced, any other image is left alone', () => {
    const context = {
      locale: 'en' as const,
      shot: (slug: string) => menkar.shotForMarkdown(slug, 'en', (path) => `/${path}`),
    }
    expect(transformNode({ type: 'image', url: 'shot:board-demo', alt: '' }, context)).toEqual([
      { type: 'image', url: '/en/light/board-demo.png', alt: 'The Board with three tasks' },
    ])
    expect(transformNode({ type: 'image', url: './plain.png', alt: '' }, context)).toBeUndefined()
  })
})

describe(':ui[key]', () => {
  const context = { locale: 'es' as const, shot: () => [] }

  test("renders the app's label in the page's locale, bold", () => {
    expect(
      transformNode(
        { type: 'textDirective', name: 'ui', children: [{ type: 'text', value: 'board.button' }] },
        context,
      ),
    ).toEqual([{ type: 'strong', children: [{ type: 'text', value: appEs['board.button'] }] }])
    expect(uiLabel('board.button', 'en')).toBe(appEn['board.button'])
  })

  test('an unknown key fails the build', () => {
    expect(() =>
      transformNode(
        { type: 'textDirective', name: 'ui', children: [{ type: 'text', value: 'board.nope' }] },
        context,
      ),
    ).toThrow(":ui[board.nope] is not a key of the app's catalog")
  })

  test('another directive is left for Starlight', () => {
    expect(transformNode({ type: 'textDirective', name: 'kbd', children: [] }, context)).toBe(
      undefined,
    )
  })
})

describe('::shortcuts', () => {
  test("lists every key the app handles, a heading and a table per group, in the app's order", () => {
    const nodes = shortcutsNodes('en')
    const groups = [...new Set(SHORTCUTS.map((shortcut) => shortcut.group))]
    const headings = nodes.filter((node) => node.type === 'heading')
    expect(headings.map((node) => (node.children as { value: string }[])[0]?.value)).toEqual(
      groups.map((group) => appEn[`shortcutGroup.${group}` as keyof typeof appEn]),
    )
    const rows = nodes
      .filter((node) => node.type === 'table')
      .flatMap((table) => (table.children as unknown[]).slice(1))
    expect(rows).toHaveLength(SHORTCUTS.length)
  })
})

describe('paths', () => {
  test('a Spanish page is one under docs/es/', () => {
    expect(localeOf('/repo/site/src/content/docs/es/start/install.md')).toBe('es')
    expect(localeOf('/repo/site/src/content/docs/start/install.md')).toBe('en')
  })

  test("a page's Markdown is served beside it, the splash's at index.md", () => {
    expect(markdownPath('')).toBe('index.md')
    expect(markdownPath('es')).toBe('es.md')
    expect(markdownPath('start/install')).toBe('start/install.md')
  })
})
