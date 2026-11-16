export interface Violation {
  file: string
  line: number
  rule: string
  message: string
}
export interface Roster {
  ids: readonly string[]
  commands: Readonly<Record<string, string>>
}
export interface Allowance {
  count: number
  reason: string
}
export const ALLOWED: Readonly<Record<string, Readonly<Record<string, Allowance>>>>
export function readRoster(): Roster
export function findViolations(file: string, source: string, roster?: Roster): Violation[]
export function overAllowed(
  violations: Violation[],
  allowed: Readonly<Record<string, Readonly<Record<string, Allowance>>>>,
): { file: string; rule: string; count: number; allowed: number }[]
