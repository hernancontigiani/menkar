// A label of the app is written :ui[key] in a page, and the key must be one the app has, so the
// page says what the app shows in each language.
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { pageShape, readPages } from '../../site/scripts/twins.mjs'
import { en } from '../../src/core/i18n/en'

const DOCS = join(__dirname, '..', '..', 'site', 'src', 'content', 'docs')

test("every :ui[key] in a page is a key of the app's catalog", () => {
  const unknown = [...readPages(DOCS)].flatMap(([path, source]) =>
    pageShape(source)
      .uiKeys.filter((key) => !Object.hasOwn(en, key))
      .map((key) => `${path}: :ui[${key}]`),
  )
  expect(unknown).toEqual([])
})

test('a :ui key in inline code or a code block is text, not a label', () => {
  expect(pageShape('Write `:ui[a.b]`.\n\n```md\n:ui[c.d]\n```\n\nPress :ui[e.f].').uiKeys).toEqual([
    'e.f',
  ])
})
