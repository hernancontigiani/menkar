import { describe, expect, test } from 'vitest'
import { compare, findLiterals, findUses } from '../../scripts/check-i18n.mjs'

const en = { 'a.one': 'One', 'a.two': 'Two' }

describe('check-i18n', () => {
  test('finds each t() call and its literal key, and nothing in comments or strings', () => {
    const source =
      "t('a.one')\nconst x = t(\"a.two\", { n: 1 })\n// t('in.comment')\nconst s = \"t('in.string')\"\nt(key)"
    expect(findUses('src/x.ts', source)).toEqual([
      { file: 'src/x.ts', line: 1, key: 'a.one' },
      { file: 'src/x.ts', line: 2, key: 'a.two' },
      { file: 'src/x.ts', line: 5, key: null },
    ])
  })

  test('a key that is not in English is an error; so is a key that is not a literal', () => {
    const uses = findUses('src/x.ts', "t('a.one')\nt('no.such.key')\nt(key)")
    expect(compare(uses, en, {}).errors).toEqual([
      "src/x.ts:2: 'no.such.key' is not in en",
      'src/x.ts:3: t() takes a literal key',
    ])
  })

  test('a translation with a key English lacks is an error; a missing translation and an unused key warn', () => {
    const uses = findUses('src/x.ts', "t('a.one')")
    expect(compare(uses, en, { es: { 'a.one': 'Uno', 'a.gone': 'Ido' } })).toEqual({
      errors: ["es: 'a.gone' is not in en"],
      warnings: ["es: 'a.two' has no translation", "en: 'a.two' is not used under src/"],
    })
  })

  test('a key written as a literal outside the catalogs counts as used', () => {
    const literals = findLiterals("const refusal: Key = 'a.two'\n// 'a.one' in a comment")
    expect(literals).toEqual(['a.two'])
    expect(compare([], en, {}, literals).warnings).toEqual(["en: 'a.one' is not used under src/"])
  })
})
