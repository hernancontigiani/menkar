import { afterEach, describe, expect, test, vi } from 'vitest'
import { catalog, chooseLanguage, LANGUAGES, setLanguage, t } from '../../src/core/i18n'
import { en } from '../../src/core/i18n/en'
import { interpolate } from '../../src/core/i18n/interpolate'

afterEach(() => {
  setLanguage('en')
  vi.doUnmock('../../src/core/i18n/es')
  vi.resetModules()
})

describe('i18n', () => {
  test.each([
    [undefined, ['es-AR', 'en-US'], 'es'],
    [undefined, ['fr-FR', 'es_ES'], 'es'],
    [undefined, ['fr-FR'], 'en'],
    [undefined, [], 'en'],
    ['en', ['es-AR'], 'en'],
    ['xx', ['es-AR'], 'es'],
  ] as const)('setting %s with locales %j picks %s', (setting, locales, expected) => {
    expect(chooseLanguage(setting, locales)).toBe(expected)
  })

  test('a key missing from a translation shows its English text, without crashing', async () => {
    vi.doMock('../../src/core/i18n/es', () => ({ es: {} }))
    vi.resetModules()
    const fresh = await import('../../src/core/i18n')
    fresh.setLanguage('es')
    expect(fresh.t('window.title')).toBe(en['window.title'])
    expect(fresh.catalog('es')).toEqual(en)
  })

  test('every language has a catalog with every English key', () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(2)
    for (const language of LANGUAGES) {
      expect(Object.keys(catalog(language)).sort()).toEqual(Object.keys(en).sort())
    }
  })

  test('t() reads the language that was set', () => {
    setLanguage('es')
    expect(t('window.title')).toBe(catalog('es')['window.title'])
  })

  test('placeholders take their values; one without a value stays visible', () => {
    expect(interpolate('{n} of {total} sessions', { n: 2, total: 5 })).toBe('2 of 5 sessions')
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}')
  })
})
