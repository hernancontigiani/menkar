export interface PageShape {
  headings: number[]
  shots: string[]
  uiKeys: string[]
  headingTexts: string[]
  order: string | null
}
export function pageShape(source: string): PageShape
export function readPages(docsDir: string): Map<string, string>
export function twinProblems(pages: Map<string, string>): string[]
