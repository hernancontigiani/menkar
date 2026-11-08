import type { Key, Messages } from '../core/i18n'
import { interpolate, type Params } from '../core/i18n/interpolate'

let messages: Messages | undefined

// Main chose the language and sends its whole catalog once, already filled in with English for
// any key the language lacks.
export async function loadCatalog(): Promise<void> {
  messages = (await window.menkar.i18n.catalog()).messages
}

export function t(key: Key, params?: Params): string {
  if (!messages) throw new Error(`t('${key}') called before the catalog was loaded`)
  return interpolate(messages[key], params)
}

// For a key that arrives as data (a refusal or a notice from main), not written at the call: the
// key itself was checked where it was written.
export function translate(key: Key, params?: Params): string {
  if (!messages) throw new Error(`translate('${key}') called before the catalog was loaded`)
  return interpolate(messages[key], params)
}
