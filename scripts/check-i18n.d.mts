export interface Use {
  file: string
  line: number
  key: string | null
}
export function findUses(file: string, source: string): Use[]
export function compare(
  uses: Use[],
  en: Record<string, string>,
  translations: Record<string, Record<string, string>>,
): { errors: string[]; warnings: string[] }
