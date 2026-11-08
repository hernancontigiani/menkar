import { en } from './i18n/en'
import { es } from './i18n/es'
import { interpolate, type Params } from './i18n/interpolate'

export type Key = keyof typeof en
export type Messages = Readonly<Record<Key, string>>
export const LANGUAGES = ['en', 'es'] as const
export type Language = (typeof LANGUAGES)[number]

const translations: Record<Language, Partial<Record<Key, string>>> = { en, es }

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value)
}

// The setting wins when it names a language the app has; otherwise the first of the system's
// preferred locales whose language the app has (`es-AR` → `es`); otherwise English.
export function chooseLanguage(setting: string | undefined, locales: readonly string[]): Language {
  if (setting && isLanguage(setting)) return setting
  for (const locale of locales) {
    const primary = locale.toLowerCase().split(/[-_]/)[0] ?? ''
    if (isLanguage(primary)) return primary
  }
  return 'en'
}

export function catalog(language: Language): Messages {
  return { ...en, ...translations[language] }
}

let current: Messages = catalog('en')

export function setLanguage(language: Language): void {
  current = catalog(language)
}

export function t(key: Key, params?: Params): string {
  return interpolate(current[key], params)
}
