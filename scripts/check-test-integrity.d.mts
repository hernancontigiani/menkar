export function countTests(source: string): number
export function removedExpects(diff: string): string[]
export function baseline(env: Readonly<Record<string, string | undefined>>, cwd: string): string
