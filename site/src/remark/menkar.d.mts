export type Locale = 'en' | 'es'
export interface MdNode {
  type: string
  [field: string]: unknown
}
export interface CaptureEntry {
  readonly slug: string
}
export interface MenkarOptions {
  captures?: readonly CaptureEntry[]
  alts?: Partial<Record<Locale, Readonly<Record<string, string>>>>
  capturesDir?: string
}
export interface Menkar {
  shotForPage(slug: string, locale: Locale, pagePath: string): MdNode[]
  shotForMarkdown(slug: string, locale: Locale, imageUrl: (path: string) => string): MdNode
  captureFile(slug: string, locale: Locale, theme: 'light' | 'dark'): string
}
export interface TransformContext {
  locale: Locale
  shot: (slug: string) => MdNode | MdNode[]
}
export function localeOf(path: string): Locale
export function markdownPath(id: string): string
export function uiLabel(key: string, locale: Locale): string
export function createMenkar(options?: MenkarOptions): Menkar
export function uiNode(key: string, locale: Locale): MdNode
export function shortcutsNodes(locale: Locale): MdNode[]
export function transformNode<N extends { readonly type: string }>(
  node: N,
  context: TransformContext,
): MdNode[] | undefined
export function menkarPlugin(options?: MenkarOptions): unknown
