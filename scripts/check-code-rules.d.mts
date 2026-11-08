export interface Violation {
  file: string
  line: number
  rule: string
  message: string
}
export function findViolations(file: string, source: string): Violation[]
