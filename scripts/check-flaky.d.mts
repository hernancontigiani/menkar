export interface Row {
  test: string
  reason: string
  expires: string
}
export function readQuarantine(
  markdown: string,
  today: string,
): { rows: Row[]; expired: Row[]; errors: string[] }
export function localDay(date: Date): string
