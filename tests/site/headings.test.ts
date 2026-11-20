// The tone guide's mechanical rule on headings: none starts with a number, since a section is
// pointed at by its name.
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { pageShape, readPages } from '../../site/scripts/twins.mjs'

const DOCS = join(__dirname, '..', '..', 'site', 'src', 'content', 'docs')

const numbered = (source: string) =>
  pageShape(source).headingTexts.filter((text) => /^\d/.test(text))

test('no heading in a page starts with a number', () => {
  const found = [...readPages(DOCS)].flatMap(([path, source]) =>
    numbered(source).map((text) => `${path}: ${text}`),
  )
  expect(found).toEqual([])
})

test('a numbered heading is found, at any level', () => {
  expect(numbered('## 1. Install\n\n### 2 Open\n\n## Install')).toEqual(['1. Install', '2 Open'])
})
