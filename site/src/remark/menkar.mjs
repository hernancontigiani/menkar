// The site's two Markdown extensions and the generated shortcuts table, for the HTML build (a
// Sätteri mdast plugin, Astro's Markdown processor) and for each page's `.md` alike, so what an
// agent copies says what the page says:
//   ![](shot:<slug>)  a capture from the registry, in the page's locale
//   :ui[<key>]        a label of the app, from the app's own catalog
//   ::shortcuts       the keyboard table, from the keys the app handles
// Anything unknown throws: a page that names a missing label or capture must not build.
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPTURES } from '../../../e2e/captures/registry.ts'
import { en as shotEn } from '../../../e2e/captures/strings/en.ts'
import { es as shotEs } from '../../../e2e/captures/strings/es.ts'
import { en as appEn } from '../../../src/core/i18n/en.ts'
import { es as appEs } from '../../../src/core/i18n/es.ts'
import { SHORTCUTS, shownChords } from '../../../src/core/shortcuts.ts'
import siteEn from '../content/i18n/en.json'
import siteEs from '../content/i18n/es.json'

const APP = { en: appEn, es: appEs }
const SITE = { en: siteEn, es: siteEs }
const THEMES = /** @type {const} */ (['light', 'dark'])
// Starlight's own utility classes: each hides its element in the theme it names.
const HIDDEN_IN = { light: 'dark:sl-hidden', dark: 'light:sl-hidden' }

/** @param {string} path a page's file path; Spanish pages live under `docs/es/` */
export function localeOf(path) {
  return path.split(sep).join('/').includes('/content/docs/es/') ? 'es' : 'en'
}

/** Where a page's Markdown is served, from its route id (`''` is the splash). */
export function markdownPath(id) {
  return `${id.replace(/\/$/, '') || 'index'}.md`
}

/** The app's label for a key in a locale; a key Spanish lacks shows the English text, as the app does. */
export function uiLabel(key, locale) {
  if (!Object.hasOwn(appEn, key)) throw new Error(`:ui[${key}] is not a key of the app's catalog`)
  return APP[locale]?.[key] ?? appEn[key]
}

function siteString(key, locale) {
  const text = SITE[locale]?.[key] ?? SITE.en[key]
  if (text === undefined) throw new Error(`the site has no string ${key}`)
  return text
}

/**
 * The extensions over one registry. A test passes its own registry and alt texts; the build uses
 * the real ones.
 */
export function createMenkar({
  captures = CAPTURES,
  alts = { en: shotEn, es: shotEs },
  capturesDir = fileURLToPath(new URL('../assets/captures', import.meta.url)),
} = {}) {
  const slugs = new Set(captures.map((capture) => capture.slug))

  function alt(slug, locale) {
    if (!slugs.has(slug)) throw new Error(`shot:${slug} is not in the capture registry`)
    const text = alts[locale]?.[`alt:${slug}`]
    if (!text) throw new Error(`shot:${slug} has no alt text in ${locale}`)
    return text
  }

  /** The file of a capture, absolute. */
  function captureFile(slug, locale, theme) {
    return join(capturesDir, locale, theme, `${slug}.png`)
  }

  /** mdast for the HTML page: the light and the dark image, each shown only in its theme. */
  function shotForPage(slug, locale, pagePath) {
    const text = alt(slug, locale)
    return THEMES.map((theme) => ({
      type: 'emphasis',
      data: { hName: 'span', hProperties: { className: [HIDDEN_IN[theme]] } },
      children: [
        {
          type: 'image',
          url: relative(dirname(pagePath), captureFile(slug, locale, theme))
            .split(sep)
            .join('/'),
          alt: text,
        },
      ],
    }))
  }

  /** mdast for the `.md`: one image, the light one, at the URL `imageUrl(path)` gives for its path
   *  under the captures folder (`<locale>/<theme>/<slug>.png`). */
  function shotForMarkdown(slug, locale, imageUrl) {
    return { type: 'image', url: imageUrl(`${locale}/light/${slug}.png`), alt: alt(slug, locale) }
  }

  return { shotForPage, shotForMarkdown, captureFile }
}

export function uiNode(key, locale) {
  return { type: 'strong', children: [{ type: 'text', value: uiLabel(key, locale) }] }
}

/** The keyboard table: a heading and a table per group, in the order the app lists them. */
export function shortcutsNodes(locale) {
  const groups = [...new Set(SHORTCUTS.map((shortcut) => shortcut.group))]
  const cell = (children) => ({ type: 'tableCell', children })
  return groups.flatMap((group) => [
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: uiLabel(`shortcutGroup.${group}`, locale) }],
    },
    {
      type: 'table',
      align: [null, null],
      children: [
        {
          type: 'tableRow',
          children: [
            cell([{ type: 'text', value: siteString('menkar.shortcuts.action', locale) }]),
            cell([{ type: 'text', value: siteString('menkar.shortcuts.keys', locale) }]),
          ],
        },
        ...SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => ({
          type: 'tableRow',
          children: [
            cell([{ type: 'text', value: uiLabel(shortcut.description, locale) }]),
            cell(
              shownChords(shortcut).flatMap((caps, index) => [
                ...(index > 0 ? [{ type: 'text', value: ', ' }] : []),
                { type: 'inlineCode', value: caps.join('+') },
              ]),
            ),
          ],
        })),
      ],
    },
  ])
}

function directiveKey(node) {
  const text = (node.children ?? []).map((child) => child.value ?? '').join('')
  if (!text) throw new Error(':ui needs a key, as :ui[key]')
  return text
}

/**
 * Replaces each extension in an mdast tree through `replace(node, nodes)`; shared by the HTML
 * plugin and the `.md` endpoint. `shot(slug)` returns the nodes for a capture.
 */
export function transformNode(node, { locale, shot }) {
  if (node.type === 'textDirective') {
    if (node.name !== 'ui') return undefined
    return [uiNode(directiveKey(node), locale)]
  }
  if (node.type === 'leafDirective') {
    if (node.name !== 'shortcuts') return undefined
    return shortcutsNodes(locale)
  }
  if (node.type === 'image' && node.url.startsWith('shot:')) {
    const nodes = shot(node.url.slice('shot:'.length))
    return Array.isArray(nodes) ? nodes : [nodes]
  }
  return undefined
}

/** The Sätteri mdast plugin of the HTML build. */
export function menkarPlugin(options) {
  const menkar = createMenkar(options)
  return ({ fileURL }) => {
    if (!fileURL) return null
    const pagePath = fileURLToPath(fileURL)
    const locale = localeOf(pagePath)
    const context = { locale, shot: (slug) => menkar.shotForPage(slug, locale, pagePath) }
    const visit = (node, ctx) => {
      const nodes = transformNode(node, context)
      if (nodes) ctx.replaceNode(node, nodes)
    }
    return { name: 'menkar', textDirective: visit, leafDirective: visit, image: visit }
  }
}
